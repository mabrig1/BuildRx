import type { AppPlan } from "@/lib/agents/types";
import { assembleDesignSwarm } from "@/lib/agents/design-swarm";

const examples=[
  {name:"Courier & Deliveries",summary:"Courier rider dispatch, parcel tracking and shipments",table:"shipments",category:"Logistics",description:"A delivery command center with interactive dispatch and sample routes"},
  {name:"MABRIG Supermarket",summary:"Retail grocery store with product inventory and customer shopping",table:"products",category:"Retail",description:"An image-led store with categorized products and a working demo cart"},
  {name:"Urban Kitchen Restaurant",summary:"Restaurant menu items, food ordering and kitchen workflow",table:"menu_items",category:"Hospitality",description:"A rich restaurant menu with food photography and interactive selection"},
  {name:"FutureSkills Academy",summary:"Online school with students, courses and lessons",table:"courses",category:"Education",description:"Discover engaging courses through a learner-friendly catalog"},
  {name:"Appointment Studio",summary:"Service appointment booking and consultation calendar",table:"appointments",category:"Services",description:"A clean service finder and demo selection workflow"},
  {name:"Evidence Research Lab",summary:"Research survey datasets, analysis and statistics",table:"datasets",category:"Research",description:"Explore real research patterns with clearly labeled sample datasets"},
  {name:"Client Operations",summary:"Business management CRM with client leads and tasks",table:"clients",category:"Business",description:"A modern operational workspace with sample customer tasks"},
] as const;

function makePlan(example:typeof examples[number]):AppPlan{
  return {
    appName:example.name,summary:example.summary,
    pages:[
      {name:"Home",path:"/",description:example.description},
      {name:"Browse",path:"/browse",description:"Browse the "+example.category+" catalog"},
      {name:"Dashboard",path:"/dashboard",description:"Review your operations"},
    ],
    components:[],features:["Search","Responsive design","Working demo interactions"],
    dataModel:[{table:example.table,description:"Sample records",columns:[{name:"id",type:"uuid"},{name:"name",type:"text"}]}],
  };
}

export function curatedDesignShowcase() {
  return examples.map(example=>{
    const result=assembleDesignSwarm(makePlan(example));
    return {
      id:result.kit.id,name:result.kit.name,category:example.category,
      description:example.description,
      brand:example.name,preview:result.files.find(f=>f.path==="preview/index.html")?.content??"",
    };
  });
}
