import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractStoreLaunchArchive, STORELAUNCH_EDITIONS } from "./storelaunch-import";

const fixture = {
 "src/worker.js": "import { apiBridge } from './api-bridge.js';",
 "src/core.js": "export const selected = true;",
 "src/api-bridge.js": "export async function apiBridge() { return null; }",
 "public/index.html": "<!doctype html><title>Store</title>",
 "public/admin.html": "<!doctype html><title>Owner</title>",
 "schema.sql": "CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY);",
 "wrangler.jsonc": '{"vars":{"DEFAULT_TEMPLATE": "restaurant"}}',
 "package.json": '{"name":"storelaunch","scripts":{"test":"node --test","deploy":"wrangler deploy"}}',
 "API_GUIDE.md": "# API guide",
 "README.md": "# StoreLaunch",
};
async function zipFiles(extra:Record<string,string>={},prefix="01_Restaurant/") {
 const z=new JSZip();
 for(const [path,content] of Object.entries({...fixture,...extra}))z.file(prefix+path,content);
 return z.generateAsync({type:"uint8array"});
}
describe("StoreLaunch independent source import",()=>{
 it("offers four Nigerian business editions",()=>{
  expect(STORELAUNCH_EDITIONS.map(x=>x.id)).toEqual(["restaurant","supermarket","gadgets","services"]);
 });
 it("extracts the selected edition into editable paths",async()=>{
  const files=await extractStoreLaunchArchive(await zipFiles(),"restaurant");
  expect(files.length).toBe(Object.keys(fixture).length);
  expect(files.find(x=>x.path==="src/api-bridge.js")).toBeDefined();
 });
 it("supports the complete-kit ZIP root",async()=>{
  const files=await extractStoreLaunchArchive(await zipFiles({},"MABRIG_StoreLaunch_Nigeria/01_Restaurant/"),"restaurant");
  expect(files.some(f=>f.path==="schema.sql")).toBe(true);
 });
 it("rejects wrong editions and unsanctioned files",async()=>{
  await expect(extractStoreLaunchArchive(await zipFiles(),"services")).rejects.toThrow("selected edition");
  await expect(extractStoreLaunchArchive(await zipFiles({"src/api-bridge.js":"broken"}),"restaurant")).rejects.toThrow("supported API-enabled");
  await expect(extractStoreLaunchArchive(await zipFiles({".dev.vars":"SECRET=not-allowed"}),"restaurant")).rejects.toThrow("Unsafe");
 });
 it("rejects unsupported source files",async()=>{
  await expect(extractStoreLaunchArchive(await zipFiles({"scripts/install.sh":"echo forbidden"}),"restaurant")).rejects.toThrow("Unsafe");
 });
});
