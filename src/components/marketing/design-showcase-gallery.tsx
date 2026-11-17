"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Laptop, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DesignSample {
  id:string;name:string;brand:string;category:string;description:string;preview:string;
}

/** Every preview is executed in a sandboxed opaque-origin iframe. */
export function DesignShowcaseGallery({samples}:{samples:DesignSample[]}) {
  const [active,setActive]=useState(0);
  const [device,setDevice]=useState<"desktop"|"mobile">("desktop");
  const selected=samples[active];
  if(!selected)return null;
  return <div className="grid gap-6 lg:grid-cols-[235px_minmax(0,1fr)]">
    <aside className="flex gap-2 overflow-x-auto pb-3 lg:flex-col lg:overflow-visible">
      {samples.map((item,index)=><button key={item.id} type="button"
        onClick={()=>setActive(index)} aria-pressed={active===index}
        className={"min-w-[145px] rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:min-w-0 "+
          (active===index?"border-primary bg-primary/10":"bg-background hover:border-primary/40")}>
        <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">{item.category}</span>
        <strong className="mt-1 block text-sm">{item.name}</strong>
        <span className="text-muted-foreground mt-2 block text-xs">{item.description}</span>
      </button>)}
    </aside>
    <div className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> {selected.brand}</p>
          <p className="text-muted-foreground mt-1 text-xs">Original BuildRx kit · interactive demo, not a live business app</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Preview viewport">
          <Button size="sm" variant={device==="desktop"?"default":"outline"} onClick={()=>setDevice("desktop")} aria-pressed={device==="desktop"}><Laptop className="size-4" /> Desktop</Button>
          <Button size="sm" variant={device==="mobile"?"default":"outline"} onClick={()=>setDevice("mobile")} aria-pressed={device==="mobile"}><Smartphone className="size-4" /> Mobile</Button>
        </div>
      </div>
      <div className="flex justify-center bg-slate-200/50 p-3 sm:p-5">
        <iframe
          key={selected.id+"-"+device}
          title={"Interactive "+selected.name+" design preview"}
          srcDoc={selected.preview}
          sandbox="allow-scripts"
          loading="lazy"
          referrerPolicy="no-referrer"
          className={"h-[610px] border bg-white shadow-xl transition-[width] duration-300 "+
            (device==="mobile"?"w-[370px] max-w-full rounded-3xl":"w-full rounded-xl")}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
        <p className="text-muted-foreground max-w-lg text-xs">Try the filters and sample buttons. All orders, deliveries, locations, prices and records are illustrative. Connecting live data requires configuration and testing.</p>
        <Button asChild><Link href="/signup">Build my own version <ArrowRight className="size-4" /></Link></Button>
      </div>
    </div>
  </div>;
}
