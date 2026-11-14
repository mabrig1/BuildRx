import type { AppPlan } from "@/lib/agents/types";

/**
 * High-fidelity, industry-aware fallback used only when the model cannot
 * deliver the relevant UI files. Generated content is visibly labeled DEMO.
 * No live payments, external data writes, or customer accounts are simulated.
 */
export type ProductIndustry = "retail" | "restaurant" | "education" | "booking" | "research" | "business";

export interface ShowcaseItem {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string | null;
  amount: number;
  label: string;
}

const PHOTO = "https://images.unsplash.com/";
const fixtures: Record<ProductIndustry, ShowcaseItem[]> = {
  retail: [
    ["rice","Premium Rice · 5kg","Pantry","Everyday family staple","photo-1586201375761-83865001e31c",18500,"Popular"],
    ["tomato","Fresh Tomatoes · Basket","Produce","Hand-selected ripe tomatoes","photo-1546470427-e5c89cd50e6c",6800,"Fresh"],
    ["bread","Soft Sliced Bread","Bakery","Freshly baked for breakfast","photo-1509440159596-0249088772ff",2200,"Popular"],
    ["milk","Full Cream Milk · 1L","Dairy","Smooth, creamy and versatile","photo-1550583724-b2692b85b150",3200,"New"],
    ["banana","Bananas · Bunch","Produce","Naturally sweet, ready to eat","photo-1571771894821-ce9b6c11b08e",2400,"Fresh"],
    ["juice","Orange Juice · 1L","Drinks","Bright and refreshing","photo-1600271886742-f049cd451bba",2800,"Popular"],
    ["eggs","Fresh Eggs · 12","Dairy","Farm fresh breakfast essential","photo-1506976785307-8732e854ad03",3700,"Fresh"],
    ["pasta","Pasta · 500g","Pantry","Quick, tasty family meals","photo-1473093295043-cdd812d0e601",1900,"New"],
    ["apple","Red Apples · Pack","Produce","Crisp, juicy favorites","photo-1560806887-1e4cd0b6cbd6",4200,"Popular"],
    ["oil","Vegetable Cooking Oil","Pantry","Daily kitchen essential","photo-1608571423902-eed4a5ad8108",6000,"Value"],
  ].map(([id,name,category,description,image,amount,label]) => ({id:String(id),name:String(name),category:String(category),description:String(description),image:PHOTO+image+"?auto=format&fit=crop&w=640&q=80",amount:Number(amount),label:String(label)})),
  restaurant: [
    ["jollof","Smoky Jollof Rice","Rice & Meals","Signature tomato rice with fragrant spices","photo-1512058564366-18510be2db19",4200,"Signature"],
    ["chicken","Grilled Chicken Platter","Grills","Juicy chicken with a delicious char","photo-1532550907401-a500c9a57435",6900,"Popular"],
    ["pizza","Stone-baked Pizza","Pizza","Golden crust, melted cheese, fresh toppings","photo-1513104890138-7c749659a591",7200,"Popular"],
    ["burger","Classic Beef Burger","Burgers","Stacked, savory and freshly prepared","photo-1568901346375-23c9450c58cd",4800,"Popular"],
    ["salad","Fresh Garden Salad","Healthy","Bright greens and crisp seasonal vegetables","photo-1512621776951-a57141f2eefd",3900,"Fresh"],
    ["pasta","Creamy Pasta","Rice & Meals","Comforting sauce with herbs","photo-1473093295043-cdd812d0e601",5600,"Special"],
    ["cake","Chocolate Cake Slice","Desserts","Rich, decadent chocolate sponge","photo-1578985545062-69928b1d9587",3200,"Sweet"],
    ["juice","Fresh Fruit Juice","Drinks","Chilled, naturally fruity","photo-1600271886742-f049cd451bba",2400,"Fresh"],
  ].map(([id,name,category,description,image,amount,label])=>({id:String(id),name:String(name),category:String(category),description:String(description),image:PHOTO+image+"?auto=format&fit=crop&w=640&q=80",amount:Number(amount),label:String(label)})),
  education: [
    ["course1","Build your first website","Practical Skills","Hands-on introduction to layouts and publishing","photo-1516321318423-f06f85e504b3",0,"Beginner"],
    ["course2","Programming Foundations","Development","Understand modern programming with practice","photo-1515879218367-8466d910aaa4",0,"Popular"],
    ["course3","Data Skills Essentials","Analytics","Learn to transform raw data into insights","photo-1551288049-bebda4e38f71",0,"New"],
    ["course4","Mobile App Design","Product Design","Design delightful experiences for small screens","photo-1551650975-87deedd944c3",0,"Practical"],
    ["course5","Project Management","Business","Plan work and track deliverables","photo-1506784983877-45594efa4cbe",0,"Popular"],
    ["course6","Digital Marketing","Growth","Reach the right audiences across channels","photo-1460925895917-afdab827c52f",0,"New"],
  ].map(([id,name,category,description,image,amount,label])=>({id:String(id),name:String(name),category:String(category),description:String(description),image:PHOTO+image+"?auto=format&fit=crop&w=640&q=80",amount:Number(amount),label:String(label)})),
  booking: [
    ["service1","Private consultation","Appointments","One-on-one session tailored to your needs","photo-1556761175-b413da4baf72",0,"Popular"],
    ["service2","Strategy session","Appointments","Plan the next big step with an expert","photo-1497366754035-f200968a6e72",0,"New"],
    ["service3","Express support","Support","Focused assistance for urgent questions","photo-1551836022-d5d88e9218df",0,"Fast"],
    ["service4","Group workshop","Workshops","Collaborative learning and practical exercises","photo-1517245386807-bb43f82c33c4",0,"Limited"],
  ].map(([id,name,category,description,image,amount,label])=>({id:String(id),name:String(name),category:String(category),description:String(description),image:PHOTO+image+"?auto=format&fit=crop&w=640&q=80",amount:Number(amount),label:String(label)})),
  research: [
    ["data1","Customer Satisfaction Study","Research","Survey data · 120 sample responses",null,0,"Sample"],
    ["data2","Student Learning Survey","Research","Survey data · 80 sample responses",null,0,"Sample"],
    ["data3","Retail Sales Trends","Analytics","Time series · 12 sample months",null,0,"Sample"],
    ["data4","Community Health Survey","Research","Descriptive dataset · 60 sample responses",null,0,"Sample"],
  ].map(([id,name,category,description,image,amount,label])=>({id:String(id),name:String(name),category:String(category),description:String(description),image: image ? PHOTO+image : null,amount:Number(amount),label:String(label)})),
  business: [
    ["lead1","Website redesign request","Projects","New customer enquiry with project brief",null,0,"New"],
    ["lead2","Product launch review","Projects","Client feedback and release checklist",null,0,"In progress"],
    ["lead3","Monthly reporting","Reports","Upcoming business insights summary",null,0,"Ready"],
    ["lead4","Client onboarding","Customers","Welcome workflow and account details",null,0,"In progress"],
    ["lead5","Support follow-up","Support","Open service conversation",null,0,"New"],
    ["lead6","Team planning","Projects","Review and assign the next priorities",null,0,"Ready"],
  ].map(([id,name,category,description,image,amount,label])=>({id:String(id),name:String(name),category:String(category),description:String(description),image: image ? PHOTO+image : null,amount:Number(amount),label:String(label)})),
};

export function classifyProductIndustry(plan: AppPlan): ProductIndustry {
  const words = [plan.appName,plan.summary,...plan.pages.map(p=>p.name),...plan.dataModel.map(d=>d.table),...plan.features].join(" ").toLowerCase();
  if (/\b(restauran|menu|kitchen|food order|meal|cater)/.test(words)) return "restaurant";
  if (/\b(supermarket|grocery|retail|store|shop|cart|checkout|inventory|catalog|marketplace|product|pos\b)/.test(words)) return "retail";
  if (/\b(school|student|course|classroom|learning|educat|academy|lesson|campus)/.test(words)) return "education";
  if (/\b(bookin|appointment|salon|clinic|reservation|consultation|schedule)/.test(words)) return "booking";
  if (/\b(statistic|survey|dataset|analysis|anova|regression|research)/.test(words)) return "research";
  return "business";
}

export function showcaseFixture(plan: AppPlan): ShowcaseItem[] {
  return fixtures[classifyProductIndustry(plan)].map(item=>({...item}));
}

export function htmlSafe(text: string): string {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

export function safeRoute(input: string): string {
  return /^\/(?:[a-z0-9-]+\/?)*$/.test(input) ? input : "/";
}

export function generatePremiumPreview(plan: AppPlan): string {
  const kind = classifyProductIndustry(plan);
  const items = showcaseFixture(plan);
  const brand = htmlSafe(plan.appName.slice(0,70));
  const summary = htmlSafe(plan.summary.slice(0,260));
  const isShopping = kind === "retail" || kind === "restaurant";
  const title = kind === "restaurant" ? "Good food. Great moments." :
    kind === "retail" ? "Everyday essentials, beautifully simple." :
    kind === "education" ? "Learn something extraordinary." :
    kind === "booking" ? "Make time for what matters." :
    kind === "research" ? "Clearer data. Better decisions." :
    "Your work, beautifully organized.";
  const eyebrow = kind === "retail" ? "CURATED GROCERY COLLECTION" :
    kind === "restaurant" ? "FRESHLY PREPARED FOR YOU" :
    kind === "education" ? "EXPLORE THE COURSE COLLECTION" :
    kind === "booking" ? "SERVICE BOOKING MADE SIMPLE" :
    kind === "research" ? "RESEARCH WORKSPACE" : "BUSINESS WORKSPACE";
  const nav = plan.pages.slice(0,7).map((page,index) =>
    '<button class="nav-link'+(index===0?' active':'')+'" type="button" data-page="'+index+'">'+htmlSafe(page.name)+'</button>'
  ).join("");
  const heroTitle = htmlSafe(title);
  const itemWord = kind==="retail"?"products":kind==="restaurant"?"menu items":kind==="education"?"courses":kind==="booking"?"services":kind==="research"?"datasets":"work items";
  const cards = items.map((item)=>{
    const picture=item.image ? '<img loading="lazy" src="'+item.image+'" alt="'+htmlSafe(item.name)+'" onerror="this.hidden=true" />' :
      '<div class="abstract-visual" aria-hidden="true"><span>✦</span></div>';
    const amount = isShopping ? '<strong class="price">₦'+item.amount.toLocaleString("en-NG")+'</strong>' : "";
    return '<article class="product-card" data-item="'+htmlSafe(item.id)+'" data-category="'+htmlSafe(item.category)+'" data-name="'+htmlSafe(item.name.toLowerCase())+'" data-price="'+item.amount+'">'+
      '<div class="product-image">'+picture+'<span class="tag">'+htmlSafe(item.label)+'</span></div>'+
      '<div class="product-content"><p class="category">'+htmlSafe(item.category)+'</p><h3>'+htmlSafe(item.name)+'</h3><p class="description">'+htmlSafe(item.description)+'</p>'+
      '<div class="product-bottom">'+amount+'<button type="button" class="add-btn" data-add="'+htmlSafe(item.id)+'">'+(isShopping?'+ Add to cart':"View details")+'</button></div></div></article>';
  }).join("\n");
  const categories = ["All",...new Set(items.map(item=>item.category))].map((category,index)=>
    '<button type="button" class="filter-pill'+(index===0?' active':'')+'" data-filter="'+htmlSafe(category)+'">'+htmlSafe(category)+'</button>').join("");
  const css = [
    ":root{--bg:#faf9f7;--surface:#fff;--ink:#18232c;--muted:#67737c;--line:#e7e8e7;--brand:#214d40;--light:#e7efe8;--accent:#f8ede0;--radius:18px}",
    "*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:var(--bg);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}",
    "button,input,select{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #9abdae;outline-offset:3px}",
    ".banner{background:#203d35;color:#f1f6f1;text-align:center;padding:9px 15px;font-size:12px;font-weight:600;letter-spacing:.025em}",
    ".header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:17px 5%;background:white;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:8}",
    ".logo{font-weight:800;font-size:21px;letter-spacing:-.05em;white-space:nowrap}.logo-mark{display:inline-grid;place-items:center;color:white;background:var(--brand);border-radius:12px;width:34px;height:34px;margin-right:10px;font-size:19px}",
    ".nav{display:flex;gap:15px;overflow:auto;scrollbar-width:none}.nav-link{white-space:nowrap;color:#5b6967;border:0;background:none;font-size:13px;padding:8px 3px;font-weight:600}.nav-link.active{color:var(--brand);border-bottom:2px solid var(--brand)}",
    ".header-actions{display:flex;align-items:center;gap:11px}.cart{border:1px solid var(--line);background:white;padding:9px 14px;border-radius:999px;font-weight:700;white-space:nowrap}.cart span{background:#dbede0;border-radius:50%;padding:2px 7px;margin-left:3px}",
    "main{max-width:1440px;margin:auto;padding:28px 5% 80px}.hero{position:relative;overflow:hidden;min-height:285px;background:linear-gradient(110deg,#dcebdd 0%,#ebefe2 55%,#f0dfc5 100%);border-radius:24px;padding:46px 45% 43px 48px;display:flex;align-items:center}",
    ".hero:after{content:'';position:absolute;right:-65px;top:-105px;width:49%;height:145%;border-radius:48%;transform:rotate(-17deg);background:radial-gradient(circle at 38% 38%,#cfe0b1 0 22%,#a1bda2 23% 44%,#466f57 45% 48%,#efe9c8 49% 52%,#d7b98b 53% 60%,transparent 61%);opacity:.7}",
    ".hero-content{position:relative;z-index:1}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;color:#3f6655}.hero h1{font-size:clamp(29px,4vw,57px);letter-spacing:-.06em;line-height:1.05;max-width:640px;margin:13px 0}.hero p{font-size:14px;color:#48635b;max-width:540px}.cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border-radius:11px;padding:12px 21px;background:var(--brand);color:white;font-weight:700;font-size:13px;border:0}",
    ".trustbar{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:25px 2px;color:#60756c;font-size:12px}.trustbar strong{color:#344c41}",
    ".section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin:15px 0 20px}.section-head h2{font-size:27px;letter-spacing:-.045em;line-height:1.1;margin:0}.section-head p{color:var(--muted);margin:8px 0 0;font-size:13px}.count{font-size:13px;color:#63766b}",
    ".toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:20px}.filters{display:flex;gap:8px;max-width:100%;overflow:auto}.filter-pill{white-space:nowrap;padding:9px 17px;border-radius:100px;border:1px solid #dde3dc;background:white;color:#52685d;font-size:12px;font-weight:700}.filter-pill.active{background:var(--brand);border-color:var(--brand);color:white}",
    ".search{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:white}.search input{min-width:165px;max-width:220px;width:100%;border:0;outline:0;background:transparent;font-size:13px}.search input:focus-visible{outline:none}",
    ".grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:19px}.product-card{background:white;border:1px solid #eaede8;border-radius:16px;overflow:hidden;box-shadow:0 4px 13px #22392d08;transition:transform .15s,box-shadow .15s}.product-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px #22392d17}",
    ".product-image{height:185px;background:linear-gradient(135deg,#e6ece5,#eadbc5);position:relative;overflow:hidden}.product-image img{width:100%;height:100%;object-fit:cover;display:block}.product-image img[hidden]{display:none}.abstract-visual{height:100%;display:grid;place-items:center;background:radial-gradient(circle at 70% 30%,#c6dccb,#e7ebe0 65%,#f0e2cb)}.abstract-visual span{font-size:68px;color:#699080}",
    ".tag{position:absolute;left:12px;top:12px;background:#fffef7;color:#456954;border:1px solid #dde7d4;font-size:10px;padding:5px 9px;border-radius:100px;font-weight:700}",
    ".product-content{padding:16px}.product-content .category{font-size:10px;font-weight:800;letter-spacing:.1em;color:#7e947f;text-transform:uppercase;margin:0 0 6px}.product-content h3{font-size:15px;line-height:1.3;margin:0;font-weight:750}.description{font-size:12px;color:var(--muted);margin:7px 0 18px;min-height:36px}.product-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px}.price{font-size:16px;white-space:nowrap}.add-btn{background:#e8f0e8;border:0;border-radius:9px;padding:9px 11px;color:#285744;font-size:11px;font-weight:750}.add-btn:hover{background:#cfe6d4}",
    ".empty{display:none;padding:38px;border:1px dashed #aebbb0;border-radius:16px;text-align:center;color:#5c7565;background:white}.muted{color:#6d8177}.demo-strip{margin-top:25px;display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;padding:15px;background:#fef8e9;border:1px solid #f4e5bb;border-radius:13px;color:#85612f;font-size:12px}",
    ".drawer{display:none;position:fixed;inset:0;background:#071a13a6;z-index:20;align-items:center;justify-content:end}.drawer.open{display:flex}.cart-panel{height:100%;width:min(440px,100%);background:#fff;padding:25px;display:flex;flex-direction:column;gap:15px;overflow:auto}.cart-panel h2{margin:0;font-size:23px}.cart-line{display:flex;justify-content:space-between;align-items:start;gap:9px;padding:12px 0;border-bottom:1px solid var(--line)}.cart-line p{margin:2px 0;color:var(--muted);font-size:12px}.cart-total{margin-top:auto;padding:15px 0;border-top:1px solid var(--line);font-weight:800;font-size:19px;display:flex;justify-content:space-between}",
    ".icon-button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:7px 12px}.footer{padding:33px 5%;border-top:1px solid var(--line);background:white;color:var(--muted);font-size:12px;text-align:center}",
    "#toast{position:fixed;bottom:24px;left:50%;transform:translate(-50%,90px);opacity:0;background:#163b2b;color:white;border-radius:11px;padding:12px 17px;transition:.2s;z-index:30;font-size:13px}#toast.show{opacity:1;transform:translate(-50%,0)}",
    "@media(max-width:1050px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}.hero{padding-right:30%}.hero:after{right:-110px}}",
    "@media(max-width:750px){.nav{display:none}.header{padding:13px 4%}.hero{min-height:230px;padding:27px 26% 28px 24px}.hero:after{right:-100px;width:60%}.hero h1{font-size:33px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.product-image{height:143px}.product-content{padding:12px}.product-bottom{align-items:stretch;flex-direction:column}.add-btn{width:100%}.search{width:100%}.search input{max-width:none}.toolbar{align-items:stretch}.trustbar{gap:8px}.section-head h2{font-size:24px}}",
    "@media(max-width:390px){.hero{padding-right:22px}.hero:after{opacity:.17}.grid{grid-template-columns:1fr}.product-image{height:200px}.header-actions{gap:4px}}",
    "@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}",
  ].join("\n");
  const data = JSON.stringify(items).replace(/</g,"\\u003c");
  const script = [
    "const items = "+data+";",
    "const cart = new Map();",
    "const cards = Array.from(document.querySelectorAll('.product-card'));",
    "let activeCategory = 'All';",
    "const formatPrice = number => '₦' + number.toLocaleString('en-NG');",
    "function toast(message){ const box=document.getElementById('toast');box.textContent=message;box.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>box.classList.remove('show'),2400); }",
    "function renderCards(){const query=document.getElementById('search').value.trim().toLowerCase();let visible=0;for(const card of cards){const ok=(activeCategory==='All'||card.dataset.category===activeCategory)&&card.dataset.name.includes(query);card.hidden=!ok;if(ok)visible++;}document.getElementById('shown').textContent=visible;document.getElementById('empty').style.display=visible?'none':'block';}",
    "document.getElementById('search').addEventListener('input',renderCards);",
    "document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{activeCategory=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===button));renderCards();}));",
    "document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x===button));document.getElementById('collection-title').textContent=button.textContent==='Home'?'Explore the collection':button.textContent;document.getElementById('catalog').scrollIntoView({behavior:'smooth',block:'start'});}));",
    "function redrawCart(){const count=Array.from(cart.values()).reduce((sum,q)=>sum+q,0);document.getElementById('cart-count').textContent=count;const body=document.getElementById('cart-lines');body.replaceChildren();let total=0;for(const [id,quantity] of cart){const item=items.find(x=>x.id===id);if(!item)continue;total+=item.amount*quantity;const line=document.createElement('div');line.className='cart-line';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=item.name;const qty=document.createElement('p');qty.textContent='Quantity: '+quantity;info.append(name,qty);const remove=document.createElement('button');remove.className='icon-button';remove.textContent='Remove';remove.addEventListener('click',()=>{cart.delete(id);redrawCart();});line.append(info,remove);body.append(line);}document.getElementById('cart-total').textContent=formatPrice(total);document.getElementById('cart-empty').hidden=cart.size>0;document.getElementById('checkout').disabled=cart.size===0;}",
    "document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>{const item=items.find(x=>x.id===button.dataset.add);if(!item)return;"+(isShopping?"cart.set(item.id,(cart.get(item.id)||0)+1);redrawCart();toast(item.name+' added to demo cart');":"toast(item.name+' · '+item.description+' (sample detail)');")+"}));",
    "document.getElementById('open-cart').addEventListener('click',()=>{document.getElementById('drawer').classList.add('open');document.getElementById('close-cart').focus();});",
    "document.getElementById('close-cart').addEventListener('click',()=>document.getElementById('drawer').classList.remove('open'));",
    "document.getElementById('drawer').addEventListener('click',event=>{if(event.target.id==='drawer')event.currentTarget.classList.remove('open');});",
    "document.addEventListener('keydown',event=>{if(event.key==='Escape')document.getElementById('drawer').classList.remove('open');});",
    "document.getElementById('checkout').addEventListener('click',()=>{toast('Demo order only · no payment, message or real purchase.');document.getElementById('drawer').classList.remove('open');});",
    "redrawCart();renderCards();",
  ].join("\n");
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>'+brand+' · Interactive demo</title><style>'+css+'</style></head>',
    '<body><div class="banner">DEMONSTRATION PREVIEW · Sample inventory, not real purchases or accounts</div>',
    '<header class="header"><div class="logo"><span class="logo-mark">✦</span>'+brand+'</div><nav class="nav" aria-label="Demo pages">'+nav+'</nav><div class="header-actions"><button class="cart" id="open-cart" type="button">'+(isShopping?'Demo cart':'Saved items')+' <span id="cart-count">0</span></button></div></header>',
    '<main><section class="hero"><div class="hero-content"><span class="eyebrow">'+eyebrow+'</span><h1>'+heroTitle+'</h1><p>'+summary+'</p><a class="cta" href="#catalog">'+(isShopping?'Shop the collection':"Explore the workspace")+' ↗</a></div></section>',
    '<div class="trustbar"><span><strong>✧ Modern design</strong> · mobile friendly</span><span><strong>✧ Real interactions</strong> · search and selection</span><span><strong>✧ Honest demo</strong> · sample data only</span></div>',
    '<section id="catalog"><div class="section-head"><div><h2 id="collection-title">'+(isShopping?'Shop favorites':'Explore the collection')+'</h2><p>Browse '+htmlSafe(itemWord)+' • curated demonstration content</p></div><span class="count"><b id="shown">'+items.length+'</b> results</span></div>',
    '<div class="toolbar"><div class="filters" role="group" aria-label="Filter by category">'+categories+'</div><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" autocomplete="off" placeholder="Search '+htmlSafe(itemWord)+'…" aria-label="Search '+htmlSafe(itemWord)+'" /></label></div>',
    '<div class="grid" id="items">'+cards+'</div><div class="empty" id="empty">No matching items. Try another search or category.</div></section>',
    '<div class="demo-strip"><strong>Sample catalog for demonstration only.</strong><span>Connect your business database, upload actual inventory and configure authenticated checkout before serving real customers.</span></div></main>',
    '<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Demonstration cart"><div class="cart-panel"><div style="display:flex;justify-content:space-between;align-items:center"><h2>Demo selection</h2><button id="close-cart" class="icon-button" type="button">Close ✕</button></div><p class="muted">Sample items only · not a real checkout</p><p id="cart-empty" class="muted">No items selected yet.</p><div id="cart-lines"></div><div class="cart-total"><span>Estimated total</span><span id="cart-total">₦0</span></div><button id="checkout" class="cta" type="button" disabled>Preview order · no payment</button></div></div>',
    '<div id="toast" role="status" aria-live="polite"></div><footer class="footer">'+brand+' · Interactive prototype. Business integrations, orders and payments are not connected.</footer><script>'+script+'</script></body></html>',
  ].join("\n");
}
