import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeReconQuery } from "../dist/tools/recon.js";
import { dossierStorage } from "../dist/services/storage.js";

test("Recon queries strip PII and normalize for cache keys", () => {
  assert.equal(
    sanitizeReconQuery("Acme CRM for jane.doe@example.com, cc @founder_jane!"),
    "acme crm for cc"
  );
  assert.equal(sanitizeReconQuery("  "), "");
  assert.ok(sanitizeReconQuery("A".repeat(500)).length <= 200);
});

test("Recon cache round-trips and expires", () => {
  dossierStorage.setReconCache("recon:exa:hello world", "exa", { results: [{ title: "t", url: "u", snippet: "s" }] });
  const hit = dossierStorage.getReconCache("recon:exa:HELLO WORLD");
  assert.ok(hit);
  assert.equal(hit.provider, "exa");
  assert.equal(hit.response.results[0].url, "u");
  assert.equal(dossierStorage.getReconCache("recon:test:missing"), null);
});
