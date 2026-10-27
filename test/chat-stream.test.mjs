import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// Force the no-LLM path so the stream serves the honest heuristic reply.
delete process.env.ORCAROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.LOCAL_LLM_URL;
delete process.env.OLLAMA_URL;
// Force API-only so the keyless agy-CLI fallback (installed on some hosts)
// doesn't turn this into a live-LLM test.
process.env.DOSSIER_LLM_BACKEND = "api";

process.env.NODE_ENV = "test";

test("Chat stream serves SSE chunks + done with honest heuristic fallback", async () => {
  const { default: app } = await import("../dist/server.js");
  // Force the no-LLM path so the stream serves the honest heuristic reply.
  // Note: llm.ts loads dotenv on import, so env vars must be cleared after import too.
  delete process.env.ORCAROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.LOCAL_LLM_URL;
  delete process.env.OLLAMA_URL;
  process.env.DOSSIER_LLM_BACKEND = "api";

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Roast my SaaS idea",
        role: "skeptic",
        ideaContext: { title: "TestApp", summary: "A SaaS tool" }
      })
    });

    assert.equal(res.status, 200, "stream must open");
    assert.ok(res.headers.get("content-type")?.includes("text/event-stream"), "must be SSE");

    const body = await res.text();
    const events = body.split("\n\n").filter((b) => b.trim()).map((block) => {
      let evt = "message", data = null;
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) evt = line.slice(7).trim();
        if (line.startsWith("data: ")) data = JSON.parse(line.slice(6).trim());
      }
      return { evt, data };
    });

    const chunks = events.filter((e) => e.evt === "chunk");
    const done = events.find((e) => e.evt === "done");
    assert.ok(chunks.length >= 1, "at least one chunk must arrive");
    assert.ok(done, "a done event must terminate the stream");
    assert.equal(done.data.degraded, true, "heuristic reply must be labeled degraded");
    assert.ok(done.data.agentName.includes("Skeptic"), "skeptic role must resolve");
    const fullText = chunks.map((c) => c.data.text).join("");
    assert.ok(fullText.includes("Core Vulnerability"), "heuristic skeptic reply must stream intact");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Chat stream rejects missing message with 400", async () => {
  const { default: app } = await import("../dist/server.js");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
