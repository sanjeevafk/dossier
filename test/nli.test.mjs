import { test } from "node:test";
import assert from "node:assert/strict";
import { contradictionScore, getNli } from "../dist/tools/nli.js";
import { extractCompetitors } from "../dist/tools/search.js";
import { EpistemicRobustVerifier } from "../dist/core/verifier.js";

test("NLI returns null offline so tiers stay unchanged", async () => {
  const nli = await getNli();
  assert.equal(nli, null, "test env forces null NLI pipeline");
  const result = await contradictionScore("Markets are growing fast", "Markets are shrinking fast");
  assert.equal(result, null);
});

test("NLI demote pass is a no-op without cited external evidence", async () => {
  const verifier = new EpistemicRobustVerifier();
  const feed = [
    { id: "EV-01", claim: "math holds", tier: "VERIFIED_COMPUTATION", claimType: "VERIFIED_COMPUTATION", provenance: "sandbox", indicator: "SUPPORTING", confidencePercent: 99 }
  ];
  const { demotions, auditItems } = await verifier.verifyWithNli(feed, {});
  assert.equal(demotions, 0);
  assert.equal(auditItems.length, 0);
});

test("Competitor extraction dedupes and caps at five", () => {
  const results = [
    { title: "Acme Corp launches invoice AI", url: "https://a.example", snippet: "s" },
    { title: "ACME CORP raises Series A", url: "https://b.example", snippet: "s" },
    { title: "a quiet tuesday with no companies mentioned at all", url: "https://c.example", snippet: "s" }
  ];
  const competitors = extractCompetitors(results);
  assert.ok(competitors.length <= 5);
  const names = competitors.map((c) => c.name.toLowerCase());
  assert.equal(new Set(names).size, names.length, "no duplicate names");
  assert.ok(competitors.every((c) => c.url.startsWith("http")));
  assert.ok(competitors.every((c) => /unverified/i.test(c.vulnerability)));
});
