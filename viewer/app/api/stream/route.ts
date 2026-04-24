import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { prompt, model = "sonnet" } = body as { prompt?: string; model?: string };

  if (typeof prompt !== "string" || !prompt.trim()) {
    return new Response("invalid prompt", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      const args = [
        "--output-format=stream-json",
        "--verbose",
        "--print",
        prompt,
        "--model",
        model,
      ];
      const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });

      let buffer = "";
      let fullThinking = "";
      let fullText = "";

      child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("{")) continue;
          try {
            const ev = JSON.parse(t);
            if (ev.type === "assistant" && ev.message?.content) {
              for (const block of ev.message.content) {
                if (block.type === "thinking" && block.thinking) {
                  const delta = block.thinking.slice(fullThinking.length);
                  if (delta) {
                    fullThinking += delta;
                    send({ type: "thinking_delta", text: delta });
                  }
                }
                if (block.type === "text" && block.text) {
                  const delta = block.text.slice(fullText.length);
                  if (delta) {
                    fullText += delta;
                    send({ type: "text_delta", text: delta });
                  }
                }
              }
            }
          } catch { /* skip malformed lines */ }
        }
      });

      child.on("close", () => {
        send({ type: "done", thinking: fullThinking, finalText: fullText });
        controller.close();
      });

      child.on("error", (err) => {
        send({ type: "error", message: err.message });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
