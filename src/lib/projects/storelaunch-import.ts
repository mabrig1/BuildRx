import JSZip from "jszip";
import { isSafeFilePath } from "@/lib/agents/llm";

/** Stores complete editable StoreLaunch Worker source in an owner project.
 * This importer does not execute or deploy anything in the uploaded ZIP.
 */
import { STORELAUNCH_EDITIONS, type StoreLaunchEdition } from "./storelaunch-editions";
export { STORELAUNCH_EDITIONS } from "./storelaunch-editions";
export type StoreLaunchFile = { path: string; content: string };

const MAX_ZIP_BYTES = 1_000_000;
const MAX_FILE_BYTES = 180_000;
const MAX_TOTAL_BYTES = 1_700_000;
const MAX_FILES = 50;
const ALLOWED = /^(?:src\/[\w.-]+\.js|public\/(?:index|admin)\.html|public\/assets\/[\w.-]+\.(?:js|css)|scripts\/[\w.-]+\.mjs|tests\/[\w.-]+\.mjs|(?:schema\.sql|package\.json|wrangler\.jsonc|README\.md|OWNER_GUIDE\.md|SECURITY\.md|SETUP\.md|API_GUIDE\.md|PHARMACY_COMPLIANCE\.md|LICENSE|EDITION\.md|\.gitignore|\.dev\.vars\.example|\.env\.example))$/;
const REQUIRED = [
 "src/worker.js", "src/core.js", "src/api-bridge.js", "public/index.html",
 "public/admin.html", "schema.sql", "wrangler.jsonc", "package.json", "API_GUIDE.md",
];
export class StoreLaunchImportError extends Error {
 constructor(message: string, readonly status=422) {
  super(message); this.name="StoreLaunchImportError";
 }
}
export async function extractStoreLaunchArchive(zipBytes:Uint8Array,edition:StoreLaunchEdition):Promise<StoreLaunchFile[]> {
 const selected=STORELAUNCH_EDITIONS.find(x=>x.id===edition);
 if(!selected)throw new StoreLaunchImportError("Choose a supported StoreLaunch edition.",400);
 if(zipBytes.byteLength<200||zipBytes.byteLength>MAX_ZIP_BYTES)
   throw new StoreLaunchImportError("Choose a StoreLaunch ZIP file under 1 MB.");
 let archive:JSZip;
 try{archive=await JSZip.loadAsync(zipBytes,{checkCRC32:true});}
 catch{throw new StoreLaunchImportError("Invalid or damaged ZIP archive.");}
 const entries=Object.values(archive.files);
 // JSZip normalizes traversal paths. Reject originals that differ instead of silently importing a sanitized archive.
 if(entries.some(e=>((e as typeof e & {unsafeOriginalName?:string}).unsafeOriginalName??e.name)!==e.name))
   throw new StoreLaunchImportError("Unsafe traversal filename in ZIP.");
 if(entries.length>200)throw new StoreLaunchImportError("Too many archive entries.");
 const roots=entries.filter(e=>!e.dir&&e.name.endsWith("/src/worker.js"))
  .map(e=>e.name.slice(0,-"src/worker.js".length))
  .filter(s=>s.endsWith(selected.folder+"/"));
 if(roots.length!==1)throw new StoreLaunchImportError("The selected edition was not found exactly once in the archive.");
 const prefix=roots[0];
 const chosen=entries.filter(e=>!e.dir&&e.name.startsWith(prefix));
 if(chosen.length<10||chosen.length>MAX_FILES)throw new StoreLaunchImportError("Unexpected source file count.");
 const seen=new Set<string>(),files:StoreLaunchFile[]=[];
 let total=0;
 const decoder=new TextDecoder("utf-8",{fatal:true});
 for(const item of chosen){
  // Keep example settings but rename to the scanner-approved .env.example.
  // Real .dev.vars files and secret values are never imported.
  const rawPath=item.name.slice(prefix.length);
  const path=rawPath===".dev.vars.example"?".env.example":rawPath;
  if(!isSafeFilePath(path)||!ALLOWED.test(path)||seen.has(path))
    throw new StoreLaunchImportError("Unsafe or unexpected StoreLaunch path.");
  seen.add(path);
  const size=(item as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;
  if(typeof size!=="number"||!Number.isSafeInteger(size)||size<0||
      size>MAX_FILE_BYTES||total+size>MAX_TOTAL_BYTES)
    throw new StoreLaunchImportError("ZIP source file exceeds safe limits.");
  const bytes=await item.async("uint8array");
  if(bytes.length!==size||bytes.includes(0))throw new StoreLaunchImportError("Damaged or binary source found.");
  total+=bytes.length;
  try{files.push({path,content:decoder.decode(bytes)});}
  catch{throw new StoreLaunchImportError("Source must be valid UTF-8 text.");}
 }
 for(const path of REQUIRED)if(!seen.has(path))
   throw new StoreLaunchImportError("Incomplete StoreLaunch source: missing "+path);
 const get=(path:string)=>files.find(f=>f.path===path)!.content;
 if(!get("src/worker.js").includes("apiBridge")||
    !get("src/api-bridge.js").includes("export async function apiBridge")||
    !get("schema.sql").includes("CREATE TABLE IF NOT EXISTS api_keys")||
    !get("wrangler.jsonc").includes('"DEFAULT_TEMPLATE": "'+edition+'"'))
   throw new StoreLaunchImportError("This is not a supported API-enabled StoreLaunch snapshot.");
 let pkg:{name?:string;scripts?:Record<string,string>};
 try{pkg=JSON.parse(get("package.json"));}
 catch{throw new StoreLaunchImportError("Invalid package.json");}
 if(typeof pkg.name!=="string"||typeof pkg.scripts?.test!=="string"||
    typeof pkg.scripts?.deploy!=="string")
   throw new StoreLaunchImportError("StoreLaunch package scripts are incomplete.");
 return files;
}
