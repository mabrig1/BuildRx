import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const source=readFileSync(join(root,"public/swarm-lab/index.html"),"utf8");
const dialog=readFileSync(join(root,"src/components/projects/create-project-dialog.tsx"),"utf8");
const route=readFileSync(join(root,"src/app/swarm-lab/page.tsx"),"utf8");

describe("connected SwarmLab demonstration",()=>{
 it("preserves a 20–50 agent local demo without activating paid API calls",()=>{
  expect(source).toContain('min="20" max="50"');
  expect(source).toContain('value="live" disabled');
  expect(source).toContain('Guided simulation');
  expect(source).toContain('sessionStorage.setItem(\'buildrx-swarmlab-brief\'');
 });
 it("requires explicit review in BuildRx before a new project is created",()=>{
  expect(route).toContain('redirect("/swarm-lab/index.html")');
  expect(dialog).toContain('buildrx-swarmlab-brief');
  expect(dialog).toContain('setOpen(true)');
  expect(dialog).toContain('createProject(values)');
 });
});
