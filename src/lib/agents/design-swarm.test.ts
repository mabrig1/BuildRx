import { describe, expect, it } from "vitest";
import type { AppPlan } from "@/lib/agents/types";
import { DESIGN_KITS, DESIGN_SWARM_PASSES, selectDesignKit, assembleDesignSwarm } from "./design-swarm";
import { applyCreativeCopy } from "./ui-agent";

function app(name:string, description:string, table:string):AppPlan {
 return { appName:name, summary:description,
  pages:[{name:"Home",path:"/",description:"Overview"},{name:"Shipments",path:"/shipments",description:"Explore records"}],
  components:[{name:"DispatchBoard",description:"Manage shipping"}],
  dataModel:[{table,description:"Private records",columns:[{name:"id",type:"uuid"}]}],
  features:["search","status","responsive"] };
}
describe("BuildRx template-first swarm",()=>{
 it("selects an original domain-specific starter and runs actual design checks",()=>{
   expect(DESIGN_KITS).toHaveLength(7);
   expect(DESIGN_SWARM_PASSES).toHaveLength(12);
   expect(DESIGN_KITS.every(x=>x.origin==="BuildRx original local code")).toBe(true);
   const p=app("Courier & Deliveries","Rider dispatch tracking","shipments");
   const built=assembleDesignSwarm(p);
   expect(selectDesignKit(p).id).toBe("dispatch-atlas");
   expect(built.audit.passed).toBe(built.audit.total);
   const preview=built.files.find(x=>x.path==="preview/index.html")?.content || "";
   const page=built.files.find(x=>x.path==="src/app/page.tsx")?.content || "";
   expect(preview).toContain("Delivery command center");
   expect(preview).toContain("PX-2486");
   expect(preview).toContain("New demo delivery");
   expect(preview).toContain("addEventListener");
   expect(preview).toContain("localStorage");
   expect(preview).toContain("@media(max-width:760px)");
   expect(page).toContain("Delivery dispatch board");
   expect(page).toContain('onClick={()=>advance(focus.id)}');
   expect(built.files.some(x=>x.path==="src/app/shipments/page.tsx")).toBe(true);
 });
 it("never replaces courier with an unrelated grocery layout",()=>{
   const courier=assembleDesignSwarm(app("Parcel Express","Dispatch riders","shipments"));
   const retail=assembleDesignSwarm(app("Supermarket","Grocery products shop","products"));
   expect(courier.kit.id).toBe("dispatch-atlas");
   expect(retail.kit.id).toBe("retail-studio");
   expect(retail.files.find(x=>x.path==="preview/index.html")?.content).toContain("Premium Rice");
   expect(courier.files.find(x=>x.path==="preview/index.html")?.content).not.toContain("Premium Rice");
 });
 it("gives restaurants and schools their own templates",()=>{
   expect(selectDesignKit(app("Korie Restaurant","Menu ordering and food","menu_items")).id).toBe("restaurant-table");
   expect(selectDesignKit(app("Bright School","Courses and attendance","students")).id).toBe("academy-studio");
 });
 it("applies only safely bounded creative copy",()=>{
   const files=assembleDesignSwarm(app("Courier","Parcel delivery","shipments")).files;
   const revised=applyCreativeCopy(files,{headline:"Make every delivery count."});
   expect(revised.find(x=>x.path==="preview/index.html")?.content).toContain("Make every delivery count.");
   expect(revised.find(x=>x.path==="src/app/page.tsx")?.content).toContain("Make every delivery count.");
   const invalid=applyCreativeCopy(files,{headline:"<script>alert(1)</script>"});
   expect(invalid.find(x=>x.path==="preview/index.html")?.content).not.toContain("<script>alert(1)</script>");
 });
});
