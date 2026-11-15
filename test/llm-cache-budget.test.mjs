import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateAgentTurnDetailed, resetProviderHealth, runWithUsageTracking, currentLlmUsage } from "../src/services/llm.ts";

/** Point the provider chain at one fake OpenAI-compatible host; each test stubs fetch itself. */
function setupProvider() {
  for (const k of ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "ORCAROUTER_API_KEY", "LLM_CLI_CMD", "MODEL_API_KEY"]) delete process.env[k];
  process.env.DOSSIER_LLM_BACKEND = "api";
  process.env.LLM_BASE_URL = "https://cache-test.test/v1";
  process.env.LLM_API_KEY = "k";
  resetProviderHealth();
  return () => resetProviderHealth();
}

function stubFetch(hits, tokens = { in: 3, out: 4 }) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    hits.n++;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: tokens.in, completion_tokens: tokens.out } }),
      { status: 200 }
    );
  };
  return () => {
    globalThis.fetch = realFetch;
  };
}

test("response cache serves the second identical call from disk with zero token burn", async () => {
  const hits = { n: 0 };
  const cleanup = setupProvider();
  const restoreFetch = stubFetch(hits);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dossier-cache-"));
  process.env.DOSSIER_RESPONSE_CACHE = "1";
  process.env.DOSSIER_CACHE_DIR = dir;
  try {
    let u1, u2;
    const first = await runWithUsageTracking(async () => {
      const r = await generateAgentTurnDetailed("sys", "user", { temperature: 0.2, jsonMode: true });
      u1 = currentLlmUsage();
      return r;
    });
    const second = await runWithUsageTracking(async () => {
      const r = await generateAgentTurnDetailed("sys", "user", { temperature: 0.2, jsonMode: true });
      u2 = currentLlmUsage();
      return r;
    });
    assert.equal(first.text, "ok");
    assert.equal(second.text, "ok", "cached text must match");
    assert.equal(hits.n, 1, `provider should be called once, was ${hits.n}`);
    assert.equal(u1.cacheHits, 0);
    assert.equal(u2.cacheHits, 1, "second call must count as a cache hit");
    assert.equal(u2.inputTokens + u2.outputTokens, 0, "cache hits must not add token burn");
    assert.ok(fs.readdirSync(dir).length === 1, "one cache entry file");
  } finally {
    delete process.env.DOSSIER_RESPONSE_CACHE;
    delete process.env.DOSSIER_CACHE_DIR;
    restoreFetch();
    cleanup();
  }
});

test("cache is off by default: identical calls both reach the provider", async () => {
  const hits = { n: 0 };
  const cleanup = setupProvider();
  const restoreFetch = stubFetch(hits);
  delete process.env.DOSSIER_RESPONSE_CACHE;
  try {
    await runWithUsageTracking(() => generateAgentTurnDetailed("sys", "user", {}));
    await runWithUsageTracking(() => generateAgentTurnDetailed("sys", "user", {}));
    assert.equal(hits.n, 2);
  } finally {
    restoreFetch();
    cleanup();
  }
});

test("per-evaluation token budget degrades remaining roles instead of burning more API", async () => {
  const hits = { n: 0 };
  const cleanup = setupProvider();
  const restoreFetch = stubFetch(hits);
  process.env.DOSSIER_MAX_EVAL_TOKENS = "5"; // first call burns 7 tokens >= 5
  try {
    await runWithUsageTracking(async () => {
      await generateAgentTurnDetailed("sys", "one", {});
      await assert.rejects(
        () => generateAgentTurnDetailed("sys", "two", {}),
        /budget exceeded.*heuristics/s,
        "second call inside the tracker must be refused"
      );
    });
    assert.equal(hits.n, 1);
  } finally {
    delete process.env.DOSSIER_MAX_EVAL_TOKENS;
    restoreFetch();
    cleanup();
  }
});

test("budget does not apply outside a usage tracker (chat/CLI paths unaffected)", async () => {
  const hits = { n: 0 };
  const cleanup = setupProvider();
  const restoreFetch = stubFetch(hits, { in: 5000, out: 5000 });
  process.env.DOSSIER_MAX_EVAL_TOKENS = "5";
  try {
    await generateAgentTurnDetailed("sys", "user", {});
    await generateAgentTurnDetailed("sys", "user", {});
    assert.equal(hits.n, 2, "no tracker: budget must not fire");
  } finally {
    delete process.env.DOSSIER_MAX_EVAL_TOKENS;
    restoreFetch();
    cleanup();
  }
});

test("per-evaluation wall-clock deadline fires inside a tracker", async () => {
  const hits = { n: 0 };
  const cleanup = setupProvider();
  const restoreFetch = stubFetch(hits, { in: 1, out: 1 });
  process.env.DOSSIER_EVAL_TIMEOUT_MS = "20";
  try {
    await runWithUsageTracking(async () => {
      await generateAgentTurnDetailed("sys", "one", {});
      await new Promise((r) => setTimeout(r, 50));
      await assert.rejects(() => generateAgentTurnDetailed("sys", "two", {}), /deadline exceeded/);
    });
    assert.equal(hits.n, 1);
  } finally {
    delete process.env.DOSSIER_EVAL_TIMEOUT_MS;
    restoreFetch();
    cleanup();
  }
});
