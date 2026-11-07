import type { GithubImportedFile, GithubImportedProject } from "./import-github-template";
import { validateImportedGithubFiles } from "./import-github-template";

/**
 * Small original BuildRx source templates for absolute beginners.
 * These are real editable Next.js source files, not prompts or third-party code.
 * No code is installed, compiled or executed during cloning.
 */
export interface BeginnerCodeTemplate {
  id: string;
  name: string;
  description: string;
  category: "Website" | "Productivity" | "Retail";
  difficulty: "Beginner";
  storage: "None" | "Browser only";
  nextStep: string;
}

export const BEGINNER_CODE_TEMPLATES: readonly BeginnerCodeTemplate[] = [
  {
    id: "beginner-business-website",
    name: "Business Website",
    description: "A responsive services website with working email contact links, designed for local shops.",
    category: "Website",
    difficulty: "Beginner",
    storage: "None",
    nextStep: "Replace the sample business name, services, prices and contact details.",
  },
  {
    id: "beginner-personal-portfolio",
    name: "Personal Portfolio",
    description: "A clean portfolio for creators, students and freelancers with project showcase cards.",
    category: "Website",
    difficulty: "Beginner",
    storage: "None",
    nextStep: "Update your biography, skills, sample project descriptions and email address.",
  },
  {
    id: "beginner-task-planner",
    name: "My Task Planner",
    description: "Add, finish and remove daily tasks. Saves demo tasks in this browser without an API key.",
    category: "Productivity",
    difficulty: "Beginner",
    storage: "Browser only",
    nextStep: "Try tasks, then add sign-in and a proper database before sharing across devices.",
  },
  {
    id: "beginner-stock-list",
    name: "Small Shop Stock List",
    description: "Add products and adjust stock counts in a local demo inventory, with low-stock notices.",
    category: "Retail",
    difficulty: "Beginner",
    storage: "Browser only",
    nextStep: "Replace demo data storage with authenticated inventory records before real sales.",
  },
] as const;

export function findBeginnerCodeTemplate(id: string): BeginnerCodeTemplate | undefined {
  return BEGINNER_CODE_TEMPLATES.find(template => template.id === id);
}

const packageFile = JSON.stringify({
  name: "buildrx-beginner-app",
  version: "1.0.0",
  private: true,
  scripts: { dev: "next dev", build: "next build", start: "next start" },
  dependencies: { next: "15.5.20", react: "19.1.0", "react-dom": "19.1.0" },
  devDependencies: {
    typescript: "^5.0.0", "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0", "@types/node": "^20.0.0",
  },
}, null, 2) + "\n";

const stylesheet = [
  ":root { font-family: system-ui, sans-serif; color: #15253b; background: #f7f9fc; }",
  "* { box-sizing: border-box; }",
  "body { margin: 0; }",
  "a { color: #1152a0; }",
  "button, input { font: inherit; }",
  ".wrap { width: min(100% - 2rem, 960px); margin: 0 auto; }",
  "header { padding: 2rem 0 1rem; }",
  "main { padding: 1.5rem 0 4rem; }",
  "h1 { font-size: clamp(2.1rem, 5vw, 3.3rem); line-height: 1.15; }",
  "p { line-height: 1.65; }",
  ".muted { color: #4c5c73; }",
  ".grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-top: 2rem; }",
  ".card { padding: 1.3rem; border: 1px solid #c8d3e2; background: white; border-radius: 12px; }",
  ".button { display: inline-block; padding: .8rem 1.1rem; margin-top: 1rem; background: #1152a0; color: #fff; text-decoration: none; border: 0; border-radius: 8px; cursor: pointer; }",
  ".button.secondary { background: #40536a; }",
  ".row { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }",
  "input { padding: .75rem; border: 1px solid #9baec6; border-radius: 7px; min-width: 0; flex: 1; }",
  "ul { padding-left: 1.3rem; } li { margin-block: .7rem; }",
  "footer { border-top: 1px solid #dde4ef; padding: 1rem 0 2rem; font-size: .9rem; }",
  "button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid #2364c4; outline-offset: 3px; }",
].join("\n") + "\n";

const pages: Record<string, string> = {
  "beginner-business-website": [
    "const services = [",
    "  { name: 'Repairs', detail: 'Describe the repair service you provide.' },",
    "  { name: 'Delivery', detail: 'Explain where and when you deliver.' },",
    "  { name: 'Consultations', detail: 'Explain how a new customer gets started.' },",
    "];",
    "export default function Page() {",
    "  return <main className='wrap'>",
    "    <p className='muted'>YOUR BUSINESS NAME · NSUKKA / ONLINE</p>",
    "    <h1>Make your business easy to find.</h1>",
    "    <p>Replace this example with your real business story, services, opening hours and contact information.</p>",
    "    <a className='button' href='mailto:hello@example.com?subject=Service%20enquiry'>Email us</a>",
    "    <h2>What we do</h2>",
    "    <div className='grid'>{services.map(service => <article key={service.name} className='card'>",
    "      <h3>{service.name}</h3><p>{service.detail}</p>",
    "    </article>)}</div>",
    "    <h2>Visit or contact us</h2>",
    "    <p>Set your real address, hours and phone number here. No bookings or payments are connected.</p>",
    "  </main>;",
    "}",
  ].join("\n") + "\n",
  "beginner-personal-portfolio": [
    "const projects = [",
    " { name: 'My first website', description: 'Explain what you designed and why.' },",
    " { name: 'Community project', description: 'Describe a useful problem you helped solve.' },",
    " { name: 'Creative portfolio', description: 'Share a sample of your work.' },",
    "];",
    "export default function Page() {",
    "  return <main className='wrap'>",
    "    <p className='muted'>PORTFOLIO · YOUR NAME</p>",
    "    <h1>Hello, I build useful things.</h1>",
    "    <p>Write a short introduction. Tell visitors what you do and whom you help.</p>",
    "    <a className='button' href='mailto:me@example.com?subject=Portfolio%20enquiry'>Contact me</a>",
    "    <h2>Selected projects</h2><div className='grid'>",
    "      {projects.map(project => <article key={project.name} className='card'>",
    "        <h3>{project.name}</h3><p>{project.description}</p>",
    "      </article>)}",
    "    </div><p className='muted'>All projects shown here are example placeholders.</p>",
    "  </main>;",
    "}",
  ].join("\n") + "\n",
  "beginner-task-planner": [
    "'use client';",
    "import { useEffect, useState, type FormEvent } from 'react';",
    "type Task = { id: string; text: string; done: boolean };",
    "const KEY = 'buildrx-beginner-tasks-v1';",
    "export default function Page() {",
    "  const [tasks, setTasks] = useState<Task[]>([]);",
    "  const [text, setText] = useState('');",
    "  const [ready, setReady] = useState(false);",
    "  useEffect(() => {",
    "    try { const raw = localStorage.getItem(KEY); if (raw) {",
    "      const parsed: unknown = JSON.parse(raw);",
    "      if (Array.isArray(parsed)) setTasks(parsed.filter((x): x is Task =>",
    "        !!x && typeof x.id === 'string' && typeof x.text === 'string' && typeof x.done === 'boolean').slice(0, 200));",
    "    } } catch {}",
    "    setReady(true);",
    "  }, []);",
    "  useEffect(() => { if (ready) { try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch {} } }, [tasks, ready]);",
    "  function add(event: FormEvent) { event.preventDefault();",
    "    const value = text.trim(); if (!value || value.length > 120 || tasks.length >= 200) return;",
    "    setTasks(old => [...old, { id: crypto.randomUUID(), text: value, done: false }]); setText('');",
    "  }",
    "  return <main className='wrap'><p className='muted'>LOCAL DEMO · TASK PLANNER</p>",
    "    <h1>Plan your next step.</h1>",
    "    <p>This starter saves tasks only in this browser. It does not synchronize across devices or accounts.</p>",
    "    <form className='row' onSubmit={add}><input aria-label='New task' required maxLength={120}",
    "      placeholder='Write a small task' value={text} onChange={e => setText(e.target.value)} />",
    "      <button className='button' type='submit'>Add task</button></form>",
    "    <p role='status'>{tasks.filter(t => !t.done).length} remaining · {tasks.length} total</p>",
    "    <ul>{tasks.map(task => <li key={task.id} className='card row'>",
    "      <label className='row' style={{ flex: 1 }}><input style={{ flex: 'none' }} type='checkbox'",
    "        checked={task.done} onChange={() => setTasks(old => old.map(t =>",
    "          t.id === task.id ? { ...t, done: !t.done } : t))} />",
    "        <span style={{ textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</span></label>",
    "      <button className='button secondary' type='button'",
    "        onClick={() => setTasks(old => old.filter(t => t.id !== task.id))}>Remove</button>",
    "    </li>)}</ul>",
    "    {ready && tasks.length === 0 && <p className='muted'>Nothing here yet. Add your first task.</p>}",
    "  </main>;",
    "}",
  ].join("\n") + "\n",
  "beginner-stock-list": [
    "'use client';",
    "import { useEffect, useState, type FormEvent } from 'react';",
    "type Item = { id: string; name: string; quantity: number };",
    "const KEY = 'buildrx-beginner-stock-v1';",
    "export default function Page() {",
    "  const [items, setItems] = useState<Item[]>([]);",
    "  const [name, setName] = useState('');",
    "  const [ready, setReady] = useState(false);",
    "  useEffect(() => {",
    "    try { const raw = localStorage.getItem(KEY); if (raw) { const value: unknown = JSON.parse(raw);",
    "      if (Array.isArray(value)) setItems(value.filter((x): x is Item => !!x && typeof x.id === 'string' &&",
    "        typeof x.name === 'string' && Number.isSafeInteger(x.quantity) && x.quantity >= 0 && x.quantity <= 100000).slice(0, 100));",
    "    } } catch {} setReady(true);",
    "  }, []);",
    "  useEffect(() => { if (ready) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} } }, [items, ready]);",
    "  function add(event: FormEvent) { event.preventDefault();",
    "    const value = name.trim(); if (!value || value.length > 80 || items.length >= 100) return;",
    "    setItems(old => [...old, { id: crypto.randomUUID(), name: value, quantity: 0 }]); setName('');",
    "  }",
    "  function adjust(id: string, amount: number) { setItems(old => old.map(item => {",
    "    if (item.id !== id) return item;",
    "    return { ...item, quantity: Math.max(0, Math.min(100000, item.quantity + amount)) };",
    "  })); }",
    "  return <main className='wrap'><p className='muted'>LOCAL DEMO · SMALL SHOP STOCK</p>",
    "    <h1>Your stock, at a glance.</h1>",
    "    <p>For learning only. Counts live in this browser, not a shared database or real point-of-sale system.</p>",
    "    <form className='row' onSubmit={add}><input aria-label='New product' required maxLength={80}",
    "      value={name} onChange={e => setName(e.target.value)} placeholder='Product name' />",
    "      <button type='submit' className='button'>Add product</button></form>",
    "    <p role='status'>{items.length} products · {items.filter(i => i.quantity < 3).length} low-stock items</p>",
    "    <ul>{items.map(item => <li className='card' key={item.id}>",
    "      <strong>{item.name}</strong> · {item.quantity} units",
    "      {item.quantity < 3 && <span className='muted'> · Low stock</span>}",
    "      <div className='row'><button type='button' className='button secondary'",
    "        aria-label={'Remove one ' + item.name} disabled={item.quantity === 0}",
    "        onClick={() => adjust(item.id, -1)}>−1</button>",
    "      <button type='button' className='button' aria-label={'Add one ' + item.name}",
    "        disabled={item.quantity >= 100000} onClick={() => adjust(item.id, 1)}>+1</button>",
    "      <button type='button' className='button secondary'",
    "        onClick={() => setItems(old => old.filter(i => i.id !== item.id))}>Delete</button></div>",
    "    </li>)}</ul>",
    "    {ready && items.length === 0 && <p className='muted'>Add a product to get started.</p>}",
    "  </main>;",
    "}",
  ].join("\n") + "\n",
};

const mitLicense = [
  "MIT License", "",
  "Copyright (c) 2026 BuildRx Contributors", "",
  "Permission is hereby granted, free of charge, to any person obtaining a copy",
  "of this software and associated documentation files (the \"Software\"), to deal",
  "in the Software without restriction, including without limitation the rights",
  "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
  "copies of the Software, and to permit persons to whom the Software is",
  "furnished to do so, subject to the following conditions:", "",
  "The above copyright notice and this permission notice shall be included in all",
  "copies or substantial portions of the Software.", "",
  "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR",
  "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,",
  "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE",
  "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER",
  "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,",
  "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE",
  "SOFTWARE.", "",
].join("\n");

export function createBeginnerCodeSource(id: string): GithubImportedProject {
  const template = findBeginnerCodeTemplate(id);
  const page = pages[id];
  if (!template || !page) throw new Error("Unknown BuildRx starter template.");

  const files: GithubImportedFile[] = [
    { path: "package.json", content: packageFile },
    { path: "app/layout.tsx", content: [
      "import './globals.css';",
      "import type { ReactNode } from 'react';",
      "export const metadata = { title: " + JSON.stringify(template.name) +
        ", description: " + JSON.stringify(template.description) + " };",
      "export default function Layout({ children }: { children: ReactNode }) {",
      "  return <html lang='en'><body><header className='wrap'><strong>" +
        template.name.replace(/'/g, "") + "</strong></header>{children}",
      "    <footer><div className='wrap'>Built with a BuildRx beginner starter · Review before publishing.</div></footer>",
      "  </body></html>;",
      "}",
    ].join("\n") + "\n" },
    { path: "app/page.tsx", content: page },
    { path: "app/globals.css", content: stylesheet },
    { path: "README.md", content: [
      "# " + template.name,
      "",
      "Beginner-owned original source template from BuildRx. This is editable Next.js code, not an AI-generated or externally verified finished application.",
      "",
      "## Get started",
      "",
      "1. Edit app/page.tsx to change labels, content, actions and styles.",
      "2. Edit app/globals.css for colors, spacing and layout.",
      "3. Run npm install and npm run dev **only inside your own trusted local development environment**.",
      "4. Review dependencies and run npm run build and security checks before publishing.",
      "5. Configure real authentication and databases separately where required.",
      "",
      "## Important limitations",
      "",
      template.storage === "Browser only"
        ? "This demo uses localStorage on the current device only. It has no accounts, shared database, synchronization or reliable financial records."
        : "This starter is informational. No payments, forms submission or backend integration is connected.",
      "Never store customer secrets or sensitive personal data in browser storage.",
      template.nextStep,
      "",
      "## Attribution",
      "Original MIT-licensed BuildRx source; see LICENSE. No third-party GitHub repository was cloned.",
      "",
    ].join("\n") },
    { path: "LICENSE", content: mitLicense },
    { path: "BUILD-RX-SOURCE.md", content: [
      "# BuildRx curated beginner source",
      "",
      "Catalog ID: " + template.id,
      "Origin: Original BuildRx starter code (not an external GitHub clone).",
      "License: MIT (see LICENSE).",
      "Project state: Draft. No deployment or external service has been connected.",
      "Runtime: Next.js App Router, React, local files.",
      "Storage: " + template.storage,
      "Before going live, inspect code, update dependencies, test workflows and configure real services.",
      "",
    ].join("\n") },
  ];
  const securityPreflight = validateImportedGithubFiles(files);
  return {
    files,
    sourceUrl: "buildrx:starter/" + template.id,
    skippedBinary: 0,
    securityPreflight,
  };
}
