import { NextResponse } from "next/server";
import { fileWithEmbeddedCredential } from "@/lib/deploy/source";
import { getSession } from "@/lib/github/service";
import { enforceDevShieldPreflight, DevShieldPreflightError, devShieldPublicEvidence } from "@/lib/security/devshield-preflight";
import { extractStoreLaunchArchive, StoreLaunchImportError, STORELAUNCH_EDITIONS } from "@/lib/projects/storelaunch-import";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/** Imports editable Worker files only. Never runs code, changes hosting,
 * connects payment keys, or starts a live deployment.
 */
export async function POST(request:Request) {
 const session=await getSession();
 if(!session||session.demo||!session.userId)
  return NextResponse.json({error:"Sign in and connect permanent storage before importing a StoreLaunch app."},{status:401});
 const origin=request.headers.get("origin");
 const host=request.headers.get("x-forwarded-host")??request.headers.get("host");
 if(origin&&host){
  let url:URL;
  try{url=new URL(origin);}catch{return NextResponse.json({error:"Invalid origin."},{status:403});}
  if((url.protocol!=="https:"&&url.hostname!=="localhost")||url.host!==host)
   return NextResponse.json({error:"Cross-site imports are not allowed."},{status:403});
 }
 if(!(request.headers.get("content-type")||"").startsWith("multipart/form-data"))
  return NextResponse.json({error:"Upload a StoreLaunch ZIP."},{status:415});
 const declared=Number(request.headers.get("content-length")||0);
 if(declared>1_200_000)
  return NextResponse.json({error:"Archive exceeds the upload size limit."},{status:413});
 const form=await request.formData().catch(()=>null);
 const edition=form?.get("edition"),file=form?.get("archive");
 if(typeof edition!=="string"||!STORELAUNCH_EDITIONS.some(s=>s.id===edition)||
    !(file instanceof File)||file.size>1_000_000||file.size<200)
  return NextResponse.json({error:"Select a valid StoreLaunch edition and ZIP under 1 MB."},{status:400});
 const {checkProjectLimit}=await import("@/lib/billing/limits");
 const limited=await checkProjectLimit(session.userId);
 if(limited)return NextResponse.json({error:limited},{status:402});
 try{
  const spec=STORELAUNCH_EDITIONS.find(s=>s.id===edition)!;
  const files=await extractStoreLaunchArchive(new Uint8Array(await file.arrayBuffer()),spec.id);
  const credentialPath=fileWithEmbeddedCredential(files);
  if(credentialPath)return NextResponse.json({error:"Potential embedded credential in "+credentialPath},{status:422});
  // Reuse the same DevShield assessment as BuildRx's approved GitHub imports.
  const preflight=enforceDevShieldPreflight(files);
  const supabase=await createClient();
  const {data:project,error:projectError}=await supabase.from("projects").insert({
    owner_id:session.userId,
    name:"StoreLaunch "+spec.name,
    description:"Editable independent Cloudflare Worker storefront. Paystack, D1, Resend, OpenRouter and permissioned API. Not deployed.",
    status:"draft" as const,
  }).select("id").single();
  if(projectError||!project)
   return NextResponse.json({error:"Could not create project."},{status:500});
  try{
   for(let i=0;i<files.length;i+=20){
    const {error}=await supabase.from("project_files").insert(
      files.slice(i,i+20).map(f=>({project_id:project.id,path:f.path,content:f.content}))
    );
    if(error)throw Error("Project file storage failed");
   }
   const {error:contextError}=await supabase.from("chat_messages").insert({
    project_id:project.id,user_id:session.userId,role:"user",
    content:"This is a complete imported StoreLaunch Cloudflare Worker project, not Next.js. Read SETUP.md and API_GUIDE.md before running. The owner dashboard is public/admin.html. Do not claim BuildRx Next.js previews can execute Worker files; use Cloudflare after owner approval. Keep all live payments disabled.",
   });
   if(contextError)throw Error("Unable to save project instructions");
  }catch{
   await supabase.from("projects").delete().eq("id",project.id).eq("owner_id",session.userId);
   return NextResponse.json({error:"Import could not be completed; the partial project was rolled back."},{status:500});
  }
  return NextResponse.json({
   projectId:project.id,edition:spec.id,imported:true,deployed:false,verified:false,
   runtime:"cloudflare-worker",fileCount:files.length,
   securityPreflight:devShieldPublicEvidence(preflight),
   message:"Source imported. Review source, run tests, connect D1 and test payment before deploying.",
  },{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){
  if(e instanceof StoreLaunchImportError)return NextResponse.json({error:e.message},{status:e.status});
  if(e instanceof DevShieldPreflightError)
   return NextResponse.json({error:e.message,securityPreflight:devShieldPublicEvidence(e.report)},{status:422});
  return NextResponse.json({error:"StoreLaunch import failed safely; no deployment was started."},{status:500});
 }
}
