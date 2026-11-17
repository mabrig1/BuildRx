import { afterEach, describe, expect, it, vi } from "vitest";
const spy=vi.hoisted(()=>({completion:vi.fn()}));
vi.mock("@/lib/ai/openrouter",()=>({
  isOpenRouterConfigured:()=>true,openrouterStrongModel:()=>"paid/large",
  openrouterModel:()=>"paid/fast",streamChatCompletion:spy.completion,
}));
vi.mock("@/lib/ai/nvidia",()=>({
  isNvidiaConfigured:()=>true,nvidiaGlmModel:()=>"nvidia/large",
  nvidiaChatModel:()=>"nvidia/fast",nvidiaLlamaModel:()=>"nvidia/lite",
  streamChatCompletion:vi.fn(),
}));
import { completeText } from "@/lib/ai/provider";
import { freeOnlyBuildMode } from "@/lib/agents/llm";
afterEach(()=>{vi.unstubAllEnvs();spy.completion.mockReset();});
describe("free-only BuildRx agent inference",()=>{
 it("defaults to zero-paid-mode and only opts into paid if explicit",()=>{
  vi.stubEnv("BUILDRX_ALLOW_PAID_AI","");
  expect(freeOnlyBuildMode()).toBe(true);
  vi.stubEnv("BUILDRX_ALLOW_PAID_AI","true");
  expect(freeOnlyBuildMode()).toBe(false);
 });
 it("never calls paid/NVIDIA tiers when freeOnly is requested",async()=>{
  spy.completion.mockImplementation(async (_m:unknown,opts:{model:string})=>({
   model:opts.model,
   stream:new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode("free answer"));c.close();}}),
   completion:Promise.resolve({text:"free answer",reasoning:"",usage:{promptTokens:1,completionTokens:2},model:opts.model}),
  }));
  const answer=await completeText([{role:"user",content:"Build app"}],{
   freeOnly:true,maxTokens:500,timeoutMs:60_000,openrouterModel:"paid/sneaky",
  });
  expect(answer.provider).toBe("openrouter-free");
  expect(spy.completion.mock.calls.map(x=>x[1].model)).toEqual(["openrouter/free"]);
 });
});
