import type { AppPlan } from "@/lib/agents/types";

const INFRASTRUCTURE_TABLES = new Set([
  "profiles",
  "workspaces",
  "workspace_members",
  "members",
  "subscriptions",
]);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function singular(value: string): string {
  const label = humanize(value);
  return label.endsWith("s") ? label.slice(0, -1) : label;
}

function previewEntities(plan: AppPlan) {
  const tables = [...plan.dataModel].sort((left, right) => {
    const leftInfrastructure = INFRASTRUCTURE_TABLES.has(left.table) ? 1 : 0;
    const rightInfrastructure = INFRASTRUCTURE_TABLES.has(right.table) ? 1 : 0;
    return leftInfrastructure - rightInfrastructure;
  });

  return tables.slice(0, 6).map((table) => {
    const editable = table.columns.filter(
      (column) =>
        ![
          "id",
          "owner_id",
          "user_id",
          "workspace_id",
          "created_at",
          "updated_at",
        ].includes(column.name)
    );
    const labelField =
      editable.find((column) => /name|title|subject|label/.test(column.name))
        ?.name ?? editable[0]?.name ?? "name";
    const statusField = editable.find((column) =>
      /status|state|stage|priority|complete|done/.test(column.name)
    )?.name;
    const fields = editable.slice(0, 5).map((column) => ({
      key: column.name,
      label: humanize(column.name),
      type: /date|time/.test(column.name)
        ? "date"
        : /email/.test(column.name)
          ? "email"
          : /description|notes|content|summary/.test(column.name)
            ? "textarea"
            : "text",
    }));
    if (fields.length === 0) {
      fields.push({ key: "name", label: "Name", type: "text" });
    }

    return {
      key: table.table,
      label: humanize(table.table),
      singular: singular(table.table),
      description: table.description,
      labelField,
      statusField,
      fields,
    };
  });
}

/**
 * A deterministic, domain-aware product workspace used whenever a model
 * returns a poster, disclaimer, or truncated preview. It deliberately
 * implements the same interaction contract QA expects: multi-entity CRUD,
 * search, filtering, editing, export, feedback states, and browser persistence.
 */
export function buildFunctionalPreview(plan: AppPlan): string {
  const entities = previewEntities(plan);
  if (entities.length === 0) {
    entities.push({
      key: "items",
      label: "Items",
      singular: "Item",
      description: "Primary product records",
      labelField: "name",
      statusField: "status",
      fields: [
        { key: "name", label: "Name", type: "text" },
        { key: "status", label: "Status", type: "text" },
      ],
    });
  }

  const seed = Object.fromEntries(
    entities.map((entity) => [
      entity.key,
      ["Launch readiness", "Customer onboarding", "Quarterly review"].map(
        (name, index) => ({
          id: `${entity.key}-${index + 1}`,
          [entity.labelField]: name,
          ...(entity.statusField
            ? {
                [entity.statusField]: ["Ready", "In progress", "Review"][index],
              }
            : {}),
          created_at: new Date(Date.UTC(2026, 7, 17 - index)).toISOString(),
        })
      ),
    ])
  );
  const workflows = (plan.workflows ?? []).slice(0, 4);
  const storageKey = `buildrx-preview-${plan.appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="buildrx-capability" content="crud-persistent-preview-v1" />
<title>${escapeHtml(plan.appName)}</title>
<style>
:root{--bg:#f6f7fb;--panel:#fff;--ink:#171923;--muted:#667085;--line:#e5e7eb;--brand:#6d3be8;--brand-soft:#f2edff;--good:#067647;--bad:#b42318;--warn:#b54708}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}.shell{display:grid;grid-template-columns:245px minmax(0,1fr);min-height:100vh}.sidebar{background:#15131b;color:#d8d5df;padding:20px 14px;display:flex;flex-direction:column;gap:20px}.brand{display:flex;gap:10px;align-items:center;padding:2px 8px;color:white;font-size:18px;font-weight:800}.logo{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#a855f7,#6d28d9)}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:11px;color:#9ca3af}.entity-nav{display:grid;gap:5px}.entity-button{border:0;background:transparent;color:#b9b3c5;text-align:left;padding:10px 12px;border-radius:8px;font:inherit;font-weight:650;cursor:pointer}.entity-button:hover,.entity-button.active{background:#2b2634;color:white}.workflow-card{margin-top:auto;border:1px solid #3b3545;border-radius:11px;padding:13px;background:#211e27}.workflow-card strong{display:block;color:white;margin:4px 0}.workflow-card small{color:#aaa3b4}.main{min-width:0}.topbar{height:68px;background:white;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 28px}.topbar-actions,.actions,.filters{display:flex;gap:8px;align-items:center}.content{padding:28px;max-width:1450px;margin:auto}.heading{display:flex;justify-content:space-between;align-items:start;gap:20px}.heading h1{font-size:28px;letter-spacing:-.03em;margin:0}.heading p{color:var(--muted);margin:5px 0 0}.btn{border:1px solid var(--line);background:white;color:var(--ink);padding:9px 13px;border-radius:8px;font:inherit;font-weight:700;cursor:pointer}.btn:hover{border-color:#b9a7f5}.btn.primary{border-color:var(--brand);background:var(--brand);color:white}.btn.danger{color:var(--bad)}.btn:disabled{opacity:.5;cursor:not-allowed}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:22px 0}.metric,.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 1px 2px #1018280a}.metric{padding:17px}.metric span{font-size:12px;color:var(--muted)}.metric strong{display:block;font-size:25px;margin-top:4px}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 18px;border-bottom:1px solid var(--line)}.filters{flex:1}.search,select,.field input,.field textarea{border:1px solid #d0d5dd;background:white;color:var(--ink);border-radius:8px;padding:9px 11px;font:inherit}.search{width:min(360px,100%)}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:720px}th,td{text-align:left;padding:12px 16px;border-bottom:1px solid #eef0f3}th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:#fafafa}td.actions-cell{text-align:right}.badge{display:inline-flex;padding:4px 8px;border-radius:999px;background:#ecfdf3;color:var(--good);font-size:11px;font-weight:750}.empty{padding:52px 20px;text-align:center;color:var(--muted)}.empty strong{display:block;color:var(--ink);font-size:16px;margin-bottom:4px}.drawer-backdrop{position:fixed;inset:0;background:#11182788;display:none;align-items:stretch;justify-content:flex-end}.drawer-backdrop.open{display:flex}.drawer{width:min(440px,100%);background:white;padding:22px;box-shadow:-16px 0 40px #11182722;overflow:auto}.drawer h2{margin:0;font-size:21px}.drawer p{color:var(--muted);margin:5px 0 20px}.field{display:grid;gap:6px;margin:14px 0}.field label{font-size:12px;font-weight:750}.field textarea{min-height:96px;resize:vertical}.drawer-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:22px}.toast{position:fixed;right:24px;bottom:24px;background:#15131b;color:white;padding:12px 15px;border-radius:9px;transform:translateY(100px);opacity:0;transition:.2s}.toast.show{transform:none;opacity:1}.loading{opacity:.55;pointer-events:none}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:960px){.shell{grid-template-columns:82px 1fr}.brand span:last-child,.workflow-card,.entity-button span{display:none}.entity-button{text-align:center}.metrics{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.shell{display:block}.sidebar{display:none}.topbar{padding:0 15px}.content{padding:20px 14px}.heading{display:block}.heading .actions{margin-top:14px}.metrics{grid-template-columns:1fr 1fr}.panel-head{align-items:stretch;flex-direction:column}.filters{align-items:stretch}.search{width:100%}}
</style>
</head>
<body data-buildrx-capability="crud-persistent-preview-v1">
<div class="shell">
  <aside class="sidebar">
    <div class="brand"><span class="logo">✦</span><span>${escapeHtml(plan.appName)}</span></div>
    <div><div class="eyebrow">Workspace</div><nav id="entity-nav" class="entity-nav" aria-label="Product areas"></nav></div>
    <div class="workflow-card"><div class="eyebrow">Active workflow</div><strong>${escapeHtml(workflows[0]?.name ?? "Manage product records")}</strong><small>${escapeHtml(workflows[0]?.outcome ?? "Create, update, find, and export records")}</small></div>
  </aside>
  <main class="main">
    <header class="topbar"><div><span class="eyebrow">Live product workspace</span></div><div class="topbar-actions"><span class="badge">Autosaved</span><button class="btn" id="export">Export JSON</button></div></header>
    <section class="content">
      <div class="heading"><div><h1 id="page-title"></h1><p id="page-description"></p></div><div class="actions"><button class="btn" id="reset">Reset demo</button><button class="btn primary" id="create">+ New record</button></div></div>
      <div class="metrics"><article class="metric"><span>Total records</span><strong id="metric-total">0</strong></article><article class="metric"><span>Visible now</span><strong id="metric-visible">0</strong></article><article class="metric"><span>Product areas</span><strong>${entities.length}</strong></article><article class="metric"><span>Workflow status</span><strong style="font-size:18px;color:var(--good)">Operational</strong></article></div>
      <section class="panel" id="records-panel" aria-live="polite">
        <div class="panel-head"><div class="filters"><label class="sr-only" for="search">Search records</label><input class="search" id="search" placeholder="Search records…" /><label class="sr-only" for="status-filter">Filter status</label><select id="status-filter"><option value="">All statuses</option></select></div><span id="record-count" class="eyebrow"></span></div>
        <div class="table-wrap"><table><thead id="table-head"></thead><tbody id="table-body"></tbody></table><div id="empty" class="empty" hidden><strong>No matching records</strong>Change the filter or create a new record.</div></div>
      </section>
    </section>
  </main>
</div>
<div class="drawer-backdrop" id="drawer-backdrop" role="presentation"><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><h2 id="drawer-title">Create record</h2><p id="drawer-description"></p><form id="record-form"><div id="form-fields"></div><div class="drawer-footer"><button type="button" class="btn" id="cancel">Cancel</button><button type="submit" class="btn primary" id="save">Save record</button></div></form></aside></div>
<div class="toast" id="toast" role="status"></div>
<script>
const entities=${safeScriptJson(entities)};
const initialData=${safeScriptJson(seed)};
const storageKey=${safeScriptJson(storageKey)};
let state=loadState(),activeKey=entities[0].key,editingId=null;
const byId=(id)=>document.getElementById(id);
const safe=(input)=>String(input??'').replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[character]);
function loadState(){try{const saved=JSON.parse(localStorage.getItem(storageKey));return saved&&typeof saved==='object'?saved:structuredClone(initialData)}catch{return structuredClone(initialData)}}
function persist(){localStorage.setItem(storageKey,JSON.stringify(state));byId('records-panel').classList.add('loading');setTimeout(()=>byId('records-panel').classList.remove('loading'),120)}
function entity(){return entities.find(item=>item.key===activeKey)}
function rows(){return state[activeKey]??(state[activeKey]=[])}
function value(row,key){const result=row[key];return result==null?'':String(result)}
function toast(message){const node=byId('toast');node.textContent=message;node.classList.add('show');setTimeout(()=>node.classList.remove('show'),2200)}
function renderNav(){byId('entity-nav').innerHTML=entities.map(item=>'<button class="entity-button '+(item.key===activeKey?'active':'')+'" data-entity="'+safe(item.key)+'"><span>'+safe(item.label)+'</span></button>').join('');document.querySelectorAll('[data-entity]').forEach(button=>button.addEventListener('click',()=>{activeKey=button.dataset.entity;byId('search').value='';render()}))}
function filteredRows(){const query=byId('search').value.toLowerCase(),status=byId('status-filter').value;return rows().filter(row=>Object.values(row).join(' ').toLowerCase().includes(query)&&(!status||value(row,entity().statusField)===status))}
function renderStatusOptions(){const field=entity().statusField,select=byId('status-filter');select.hidden=!field;const statuses=field?[...new Set(rows().map(row=>value(row,field)).filter(Boolean))]:[];select.innerHTML='<option value="">All statuses</option>'+statuses.map(status=>'<option>'+safe(status)+'</option>').join('')}
function renderTable(){const config=entity(),visible=filteredRows();const columns=config.fields.slice(0,4);byId('table-head').innerHTML='<tr>'+columns.map(field=>'<th>'+safe(field.label)+'</th>').join('')+'<th>Updated</th><th><span class="sr-only">Actions</span></th></tr>';byId('table-body').innerHTML=visible.map(row=>'<tr>'+columns.map(field=>'<td>'+(field.key===config.statusField?'<span class="badge">'+safe(value(row,field.key)||'Not set')+'</span>':safe(value(row,field.key)||'—'))+'</td>').join('')+'<td>'+new Date(row.created_at).toLocaleDateString()+'</td><td class="actions-cell"><button class="btn" data-edit="'+safe(row.id)+'">Edit</button> <button class="btn danger" data-delete="'+safe(row.id)+'">Delete</button></td></tr>').join('');byId('empty').hidden=visible.length>0;byId('metric-total').textContent=rows().length;byId('metric-visible').textContent=visible.length;byId('record-count').textContent=visible.length+' shown';document.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>openDrawer(button.dataset.edit)));document.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',()=>removeRecord(button.dataset.delete)))}
function render(){const config=entity();renderNav();byId('page-title').textContent=config.label;byId('page-description').textContent=config.description||'Manage '+config.label.toLowerCase()+' from one operational workspace.';byId('create').textContent='+ New '+config.singular;renderStatusOptions();renderTable()}
function openDrawer(id=null){editingId=id;const config=entity(),row=id?rows().find(item=>item.id===id):{};byId('drawer-title').textContent=(id?'Edit ':'Create ')+config.singular;byId('drawer-description').textContent='Changes are validated and saved in this preview browser.';byId('form-fields').innerHTML=config.fields.map(field=>'<div class="field"><label for="field-'+safe(field.key)+'">'+safe(field.label)+'</label>'+(field.type==='textarea'?'<textarea id="field-'+safe(field.key)+'" name="'+safe(field.key)+'">'+safe(value(row,field.key))+'</textarea>':'<input id="field-'+safe(field.key)+'" name="'+safe(field.key)+'" type="'+safe(field.type)+'" value="'+safe(value(row,field.key))+'" '+(field.key===config.labelField?'required':'')+'/>')+'</div>').join('');byId('drawer-backdrop').classList.add('open');setTimeout(()=>byId('field-'+config.labelField)?.focus(),0)}
function closeDrawer(){byId('drawer-backdrop').classList.remove('open');editingId=null}
function saveRecord(event){event.preventDefault();const config=entity(),form=new FormData(event.currentTarget),payload=Object.fromEntries(form.entries()),wasEditing=Boolean(editingId);if(!String(payload[config.labelField]??'').trim()){toast(config.singular+' name is required');return}if(editingId){const index=rows().findIndex(row=>row.id===editingId);rows()[index]={...rows()[index],...payload}}else{rows().unshift({id:crypto.randomUUID(),...payload,created_at:new Date().toISOString()})}persist();closeDrawer();render();toast(wasEditing?'Record updated':'Record created')}
function removeRecord(id){const row=rows().find(item=>item.id===id);if(!row||!confirm('Delete '+(value(row,entity().labelField)||'this record')+'?'))return;state[activeKey]=rows().filter(item=>item.id!==id);persist();render();toast('Record deleted')}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=storageKey+'.json';link.click();URL.revokeObjectURL(url);toast('Workspace exported')}
byId('record-form').addEventListener('submit',saveRecord);byId('create').addEventListener('click',()=>openDrawer());byId('cancel').addEventListener('click',closeDrawer);byId('drawer-backdrop').addEventListener('click',event=>{if(event.target===event.currentTarget)closeDrawer()});byId('search').addEventListener('input',renderTable);byId('status-filter').addEventListener('change',renderTable);byId('export').addEventListener('click',exportData);byId('reset').addEventListener('click',()=>{if(!confirm('Reset all preview records?'))return;state=structuredClone(initialData);persist();render();toast('Preview reset')});document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer()});render();
</script>
</body>
</html>`;
}

/** Stable signals shared by preflight selection and the final QA gate. */
export function previewFunctionalityIssues(html: string): string[] {
  const issues: string[] = [];
  if (html.length < 3_000) issues.push("preview is too small to cover a workflow");
  if (!/<script[\s>]/i.test(html)) issues.push("preview has no executable behavior");
  if (!/<(?:form|input|select|textarea)[\s>]/i.test(html)) {
    issues.push("preview has no data-entry controls");
  }
  if (!/(?:addEventListener|on(?:click|submit|change)\s*=)/i.test(html)) {
    issues.push("preview controls have no event handlers");
  }
  if (
    !/(?:localStorage\.setItem|fetch\s*\(|\.push\s*\(|\.splice\s*\(|\.classList\.(?:add|remove)\s*\()/i.test(
      html
    )
  ) {
    issues.push("preview does not mutate or persist records");
  }
  if (
    /full functionality\s+(?:requires|is\s+required)|(?:backend integration|authentication)\s+(?:is\s+)?required|preview\s+(?:only|demo)|coming soon|placeholder\s+(?:page|content|screen|implementation)/i.test(
      html
    )
  ) {
    issues.push("preview contains a non-functional disclaimer");
  }
  return issues;
}
