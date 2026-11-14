import type { AppPlan } from "@/lib/agents/types";
import { classifyProductIndustry, showcaseFixture, safeRoute } from "@/lib/agents/premium-ux";

/**
 * When model output is unavailable, produce a genuine responsive interactive
 * demonstration for every Next.js route rather than dead buttons and generic
 * empty cards. Sample data NEVER represents a real business backend.
 */
function js(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

export function generatePremiumNextPage(
  plan: AppPlan,
  page: { name: string; path: string; description: string },
): string {
  const industry = classifyProductIndustry(plan);
  const shopping = industry === "retail" || industry === "restaurant";
  const subjects = showcaseFixture(plan);
  const pages = plan.pages.slice(0, 8).map(p=>({name:p.name.slice(0,70),path:safeRoute(p.path)}));
  const brand = plan.appName.slice(0,90);
  const headline = industry === "restaurant" ? "Fresh flavors for every moment." :
    industry === "retail" ? "Everyday essentials, made delightful." :
    industry === "education" ? "Learning starts with discovery." :
    industry === "booking" ? "Book a better experience." :
    industry === "research" ? "Better insights begin here." :
    "A beautiful space to get work done.";
  const suffix = page.path === "/" ? "Explore the collection" : page.name;
  const itemType = industry==="retail"?"products":industry==="restaurant"?"menu items":
    industry==="education"?"courses":industry==="booking"?"services":
    industry==="research"?"datasets":"work items";
  return [
    '"use client";',
    'import { useMemo, useState } from "react";',
    'const items = ' + js(subjects) + ';',
    'const navigation = ' + js(pages) + ';',
    'const brand = ' + js(brand) + ';',
    'const pageTitle = ' + js(suffix) + ';',
    'const headline = ' + js(headline) + ';',
    'const description = ' + js(page.path==="/" ? plan.summary : page.description) + ';',
    'const itemType = ' + js(itemType) + ';',
    'const shopping = ' + String(shopping) + ';',
    'const samplePrice = (value:number) => "₦" + value.toLocaleString("en-NG");',
    '',
    'export default function DemoProductPage() {',
    ' const [search,setSearch] = useState("");',
    ' const [category,setCategory] = useState("All");',
    ' const [selection,setSelection] = useState<Record<string,number>>({});',
    ' const [showSelection,setShowSelection] = useState(false);',
    ' const categories = useMemo(()=>["All",...new Set(items.map(i=>i.category))],[]);',
    ' const filtered = useMemo(()=>items.filter(i=>(category==="All"||i.category===category)&&i.name.toLowerCase().includes(search.toLowerCase().trim())),[search,category]);',
    ' const count = Object.values(selection).reduce((total,value)=>total+value,0);',
    ' const total = items.reduce((sum,item)=>sum+item.amount*(selection[item.id]||0),0);',
    ' const add = (id:string)=>setSelection(old=>({...old,[id]:(old[id]||0)+1}));',
    ' const remove = (id:string)=>setSelection(old=>{ const next={...old}; delete next[id]; return next; });',
    ' return <div className="min-h-screen bg-[#fafaf7] text-slate-900">',
    '   <div className="bg-[#203f33] px-4 py-2.5 text-center text-[11px] font-semibold tracking-wide text-white">SAMPLE EXPERIENCE · DEMO CONTENT · NO REAL ORDERS OR PAYMENTS</div>',
    '   <header className="sticky top-0 z-10 border-b border-[#e4eae1] bg-white/95 px-4 py-4 backdrop-blur sm:px-8">',
    '    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">',
    '      <a href="/" className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#214c3b] text-white">✦</span><span>{brand}</span></a>',
    '      <nav className="hidden max-w-xl items-center gap-5 overflow-x-auto lg:flex" aria-label="App navigation">{navigation.map(link=><a key={link.path} href={link.path} className="whitespace-nowrap text-sm font-medium text-slate-600 hover:text-emerald-800">{link.name}</a>)}</nav>',
    '      <button type="button" onClick={()=>setShowSelection(value=>!value)} className="shrink-0 rounded-full border border-[#dce6d8] bg-white px-4 py-2 text-sm font-semibold text-[#214c3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">{shopping?"Demo cart":"Saved samples"} <span className="ml-1 rounded-full bg-[#e2f0e5] px-2 py-0.5">{count}</span></button>',
    '    </div>',
    '   </header>',
    '   <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-8">',
    '     <section className="relative mt-7 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#dfebd7] via-[#f0eee0] to-[#ebd6b7] p-7 sm:p-12">',
    '       <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[60px] border-[#749978]/30 sm:-right-12 sm:h-[440px] sm:w-[440px]" aria-hidden="true" />',
    '       <div className="relative max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.21em] text-[#315f4a]">Discover · Explore · Create</p>',
    '         <h1 className="mt-4 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-[#17372d] sm:text-6xl">{pageTitle=== "Explore the collection" ? headline : pageTitle}</h1>',
    '         <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#4d6a5a] sm:text-base">{description}</p>',
    '         <a href="#collection" className="mt-6 inline-flex rounded-xl bg-[#214c3b] px-5 py-3 text-sm font-bold text-white hover:bg-[#173c2f]">Browse {itemType} <span className="ml-3">↗</span></a>',
    '       </div>',
    '     </section>',
    '     <div className="flex flex-wrap justify-between gap-3 py-6 text-xs font-semibold text-[#52715f]"><span>✧ Mobile-first experience</span><span>✧ Real demo interactions</span><span>✧ Transparent sample data</span></div>',
    '     <section id="collection" className="scroll-mt-28">',
    '       <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{pageTitle}</h2><p className="mt-2 text-sm text-slate-500">Browse the sample {itemType} and explore how this interface works.</p></div><p className="text-sm text-slate-500">{filtered.length} results</p></div>',
    '       <div className="mb-6 flex flex-wrap justify-between gap-3">',
    '         <div className="flex max-w-full flex-wrap gap-2" role="group" aria-label="Filter sample categories">{categories.map(label=><button key={label} type="button" onClick={()=>setCategory(label)} className={category===label?"rounded-full bg-[#214c3b] px-4 py-2 text-xs font-semibold text-white":"rounded-full border border-[#dfe6dc] bg-white px-4 py-2 text-xs font-semibold text-[#577063]"}>{label}</button>)}</div>',
    '         <label className="flex w-full items-center gap-2 rounded-xl border border-[#e1e5dd] bg-white px-3 py-2 sm:w-64"><span aria-hidden="true">⌕</span><input aria-label={"Search "+itemType} value={search} onChange={event=>setSearch(event.target.value)} placeholder={"Search "+itemType+"..."} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>',
    '       </div>',
    '       {filtered.length===0 ? <div className="rounded-xl border border-dashed border-[#bdcdbb] bg-white p-12 text-center text-sm text-slate-500">No matching results. Try another category or search.</div> : null}',
    '       <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">',
    '       {filtered.map(item=><article key={item.id} className="group overflow-hidden rounded-2xl border border-[#e8ebe4] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">',
    '         <div className="relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br from-[#dbe7d8] to-[#eee0ca]">',
    '           {item.image ? <img loading="lazy" src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" onError={event=>{event.currentTarget.style.opacity="0"}} /> : <span aria-hidden="true" className="text-7xl text-[#749c84]">✦</span>}',
    '           <span className="absolute left-3 top-3 rounded-full border border-[#e8ebdf] bg-white/95 px-3 py-1 text-[10px] font-bold text-[#4f7654]">{item.label}</span>',
    '         </div>',
    '         <div className="p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#7c9580]">{item.category}</p><h3 className="mt-1 text-base font-bold leading-tight">{item.name}</h3>',
    '           <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-500">{item.description}</p>',
    '           <div className="mt-4 flex items-center justify-between gap-2">{shopping ? <strong className="text-lg">{samplePrice(item.amount)}</strong>: <span className="text-xs font-semibold text-[#44735b]">Sample preview</span>}',
    '             <button type="button" onClick={()=>add(item.id)} className="rounded-lg bg-[#e4f0e5] px-3 py-2 text-xs font-bold text-[#28563d] hover:bg-[#cce3cd]">{shopping?"Add to demo cart":"Save sample"}</button></div>',
    '         </div>',
    '       </article>)}',
    '       </div>',
    '     </section>',
    '     <div role="note" className="mt-9 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><strong>Design demonstration only.</strong> These sample items and selections are kept in your current tab. No real database, purchase, payment, appointment, message or account is created.</div>',
    '   </main>',
    '   {showSelection ? <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/60" role="dialog" aria-modal="true" aria-label="Sample selection" onClick={event=>{if(event.target===event.currentTarget)setShowSelection(false)}}>',
    '     <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-5 shadow-xl"><div className="flex items-center justify-between gap-2"><h2 className="text-xl font-bold">Your demo selection</h2><button type="button" onClick={()=>setShowSelection(false)} className="rounded-lg border px-3 py-2 text-sm">Close</button></div><p className="mt-2 text-xs text-slate-500">Preview selection only — nothing is transmitted.</p>',
    '       {Object.entries(selection).filter(([,quantity])=>quantity>0).map(([id,quantity])=>{const item=items.find(x=>x.id===id);return item?<div key={id} className="flex justify-between gap-3 border-b py-4"><div><strong className="text-sm">{item.name}</strong><p className="text-xs text-slate-500">Quantity: {quantity}</p></div><button type="button" onClick={()=>remove(id)} className="text-xs font-bold text-rose-700">Remove</button></div>:null})}',
    '       {count===0?<p className="mt-8 text-sm text-slate-500">No items selected yet. Browse the catalog to get started.</p>:null}',
    '       <div className="mt-auto pt-8"><div className="mb-4 flex justify-between text-lg font-bold"><span>Demo total</span><span>{shopping?samplePrice(total):count+" items"}</span></div><button type="button" onClick={()=>setShowSelection(false)} className="w-full rounded-xl bg-[#214c3b] px-4 py-3 text-sm font-bold text-white">Return to the demo</button></div>',
    '     </aside></div> : null}',
    '   <footer className="border-t bg-white px-4 py-9 text-center text-xs text-slate-500">Design prototype for {brand} · Real deployment, identity and stored data require configuration and testing.</footer>',
    ' </div>;',
    '}',
  ].join("\n");
}
