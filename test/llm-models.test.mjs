import test from "node:test";
import assert from "node:assert/strict";
import { listProviderModels, resetProviderHealth } from "../src/services/llm.ts";

function clearKeys() {
  for (const k of ["MODEL_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "ORCAROUTER_API_KEY", "LLM_CLI_CMD", "GROQ_API_KEY", "LLM_BASE_URL"]) delete process.env[k];
}

test("model listing reports which configured model the key can actually use, never the key", async () => {
  clearKeys();
  process.env.DOSSIER_LLM_BACKEND = "api";
  process.env.LLM_BASE_URL = "https://models-test.test/v1";
  process.env.LLM_API_KEY = "secret-key-should-not-leak";
  resetProviderHealth();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).endsWith("/models"), `must call /models, got ${url}`);
    return new Response(JSON.stringify({ data: [{ id: "some-model" }, { id: "other-model" }] }), { status: 200 });
  };
  try {
    const list = await listProviderModels();
    const custom = list.find((p) => p.provider === "custom-api");
    assert.ok(custom, "configured provider must be listed");
    assert.equal(custom.configuredModelListed, false, "configured model is absent from the key's list");
    assert.deepEqual(custom.models, ["some-model", "other-model"]);
    const serialized = JSON.stringify(list);
    assert.ok(!serialized.includes("secret-key-should-not-leak"), "API key must never appear in the response");
  } finally {
    globalThis.fetch = realFetch;
    clearKeys();
    resetProviderHealth();
  }
});

test("model listing reports provider errors instead of throwing", async () => {
  clearKeys();
  process.env.DOSSIER_LLM_BACKEND = "api";
  process.env.LLM_BASE_URL = "https://models-fail.test/v1";
  process.env.LLM_API_KEY = "k";
  resetProviderHealth();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("nope", { status: 401 });
  try {
    const list = await listProviderModels();
    const custom = list.find((p) => p.provider === "custom-api");
    assert.equal(custom.error, "HTTP 401");
    assert.equal(custom.configuredModelListed, null);
  } finally {
    globalThis.fetch = realFetch;
    clearKeys();
    resetProviderHealth();
  }
});
