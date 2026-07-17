import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  isNvidiaConfigured,
  nvidiaChatModel,
  streamChatCompletion,
  type NvidiaMessage,
} from "@/lib/ai/nvidia";
import { APP_BUILDER_SYSTEM_PROMPT, CHAT_MODEL } from "@/lib/ai/prompts";
import { recordAiUsage } from "@/lib/ai/usage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { chatMessageSchema } from "@/lib/validations/chat";

export const maxDuration = 300;

/** Demo response streamed when no ANTHROPIC_API_KEY is configured. */
const MOCK_RESPONSE = `I'd love to help you build that! Here's how I'd approach it:

1. **Layout** — a clean page shell with a header and content area
2. **Data model** — we'll define the core entities and wire them to Supabase
3. **Components** — reusable UI pieces styled with Tailwind

Here's a starting point:

\`\`\`tsx
export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-semibold">Your app starts here</h1>
    </main>
  );
}
\`\`\`

*(This is a demo response — add your \`ANTHROPIC_API_KEY\` to .env.local for real AI generation.)*

What should we build first?`;

function mockStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  for (let i = 0; i < MOCK_RESPONSE.length; i += 12) {
    chunks.push(MOCK_RESPONSE.slice(i, i + 12));
  }
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
      await new Promise((resolve) => setTimeout(resolve, 15));
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { projectId, content } = parsed.data;

  // Demo mode: no Supabase → no persistence. Stream a real NVIDIA
  // response when a key is configured, otherwise the canned demo reply.
  if (!isSupabaseConfigured()) {
    if (isNvidiaConfigured()) {
      try {
        const { stream, model } = await streamChatCompletion(
          [
            { role: "system", content: APP_BUILDER_SYSTEM_PROMPT },
            { role: "user", content },
          ],
          { model: nvidiaChatModel(), maxTokens: 4096 }
        );
        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Model": model,
          },
        });
      } catch {
        // fall through to the demo response
      }
    }
    return new Response(mockStream(), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Persistence requires a real project id.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { checkAiRequestLimit } = await import("@/lib/billing/limits");
  const limitError = await checkAiRequestLimit(user.id);
  if (limitError) {
    return NextResponse.json({ error: limitError }, { status: 402 });
  }

  // RLS also enforces this, but a explicit check gives a clean 404.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Persist the user's message.
  const { error: insertError } = await supabase.from("chat_messages").insert({
    project_id: projectId,
    user_id: user.id,
    role: "user",
    content,
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Load conversation history (including the message just inserted).
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(50);

  const messages: Anthropic.MessageParam[] = (history ?? [])
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  async function persistAssistantMessage(
    text: string,
    generation: {
      promptTokens: number;
      completionTokens: number;
      durationMs: number;
      status: "completed" | "failed";
      error?: string;
      model?: string;
    }
  ) {
    const supabase = await createClient();
    const { data: message } = await supabase
      .from("chat_messages")
      .insert({
        project_id: projectId,
        role: "assistant",
        content: text,
      })
      .select("id")
      .single();

    await recordAiUsage({
      userId: user!.id,
      projectId,
      messageId: message?.id ?? null,
      model: generation.model ?? CHAT_MODEL,
      status: generation.status,
      promptTokens: generation.promptTokens,
      completionTokens: generation.completionTokens,
      durationMs: generation.durationMs,
      error: generation.error,
      action: "ai_message",
    });
  }

  // No Anthropic key → fall back to the NVIDIA endpoint (with the full
  // conversation history), still persisting both sides of the chat.
  if (!process.env.ANTHROPIC_API_KEY && isNvidiaConfigured()) {
    const startedAt = Date.now();
    try {
      const nvidiaMessages: NvidiaMessage[] = [
        { role: "system", content: APP_BUILDER_SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content:
            typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
      ];
      const { stream, completion, model } = await streamChatCompletion(
        nvidiaMessages,
        { model: nvidiaChatModel(), maxTokens: 4096 }
      );
      void completion
        .then((result) =>
          persistAssistantMessage(result.text, {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            durationMs: Date.now() - startedAt,
            status: "completed",
            model: result.model,
          })
        )
        .catch(() => undefined);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Model": model,
        },
      });
    } catch {
      // fall through to the mock stream below
    }
  }

  // No API key at all → mock stream, but still persist both sides.
  if (!process.env.ANTHROPIC_API_KEY) {
    const upstream = mockStream();
    const [toClient, toPersist] = upstream.tee();
    void (async () => {
      const text = await new Response(toPersist).text();
      await persistAssistantMessage(text, {
        promptTokens: 0,
        completionTokens: 0,
        durationMs: 0,
        status: "completed",
      });
    })();
    return new Response(toClient, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const anthropic = new Anthropic();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullText = "";
      try {
        const messageStream = anthropic.messages.stream({
          model: CHAT_MODEL,
          max_tokens: 32000,
          thinking: { type: "adaptive" },
          system: APP_BUILDER_SYSTEM_PROMPT,
          messages,
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const final = await messageStream.finalMessage();
        await persistAssistantMessage(fullText, {
          promptTokens: final.usage.input_tokens,
          completionTokens: final.usage.output_tokens,
          durationMs: Date.now() - startedAt,
          status: "completed",
        });
        controller.close();
      } catch (error) {
        const message =
          error instanceof Anthropic.APIError
            ? `AI request failed (${error.status}): ${error.message}`
            : "AI request failed. Please try again.";
        if (fullText.length === 0) {
          controller.enqueue(encoder.encode(message));
        }
        await persistAssistantMessage(fullText || message, {
          promptTokens: 0,
          completionTokens: 0,
          durationMs: Date.now() - startedAt,
          status: "failed",
          error: message,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
