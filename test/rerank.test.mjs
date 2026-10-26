import { test } from "node:test";
import assert from "node:assert/strict";
import { rerank, getEmbedder } from "../dist/tools/rerank.js";

test("Rerank returns null offline so callers fall back to provider order", async () => {
  const passages = [
    { title: "Invoice copilot pricing", url: "https://a.example", snippet: "SaaS billing" },
    { title: "Unrelated recipe blog", url: "https://b.example", snippet: "pasta carbonara" }
  ];
  const embedder = await getEmbedder();
  assert.equal(embedder, null, "test env forces HF_OFFLINE-equivalent null embedder");
  const ranked = await rerank("invoice copilot SaaS billing", passages, 6);
  assert.equal(ranked, null);
});
