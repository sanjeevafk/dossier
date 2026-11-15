import test from "node:test";
import assert from "node:assert/strict";
import { generateAgentTurnDetailed, resetProviderHealth, runWithUsageTracking } from "../src/services/llm.ts";

function setupProviders() {
  for (const k of ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "ORCAROUTER_API_KEY", "LLM_CLI_CMD", "MODEL_API_KEY"]) delete process.env[k];
  process.env.DOSSIER_LLM_BACKEND = "api";
  process.env.LLM_BASE_URL = "https://dead.test/v1"; // first in configured order
  process.env.LLM_API_KEY = "bad";
  process.env.GROQ_API_KEY = "good";
  process.env.GROQ_BASE_URL = "https://good.test/v1";
  resetProviderHealth();
}

test("a provider with a bad key is benched after one failure and stops costing a request per call", async () => {
  setupProviders();
  const hits = { dead: 0, good: 0 };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("dead.test")) {
      hits.dead++;
      return new Response(JSON.stringify({ error: { message: "Invalid API Key" } }), { status: 401 });
    }
    hits.good++;
    return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 3, completion_tokens: 4 } }), { status: 200 });
  };
  try {
    await runWithUsageTracking(async () => {
      for (let i = 0; i < 6; i++) {
        const r = await generateAgentTurnDetailed("s", "u", { jsonMode: true });
        assert.equal(r.provider, "groq");
      }
    });
    assert.equal(hits.dead, 1, `dead provider should be tried once, was tried ${hits.dead} times`);
    assert.equal(hits.good, 6);
  } finally {
    globalThis.fetch = realFetch;
    resetProviderHealth();
  }
});

test("when every provider fails the error names each one", async () => {
  setupProviders();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("nope", { status: 500 });
  try {
    await assert.rejects(() => generateAgentTurnDetailed("s", "u"), /All LLM providers failed.*custom-api.*groq/s);
  } finally {
    globalThis.fetch = realFetch;
    resetProviderHealth();
  }
});
