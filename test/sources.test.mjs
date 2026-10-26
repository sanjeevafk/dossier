import test from "node:test";
import assert from "node:assert/strict";
import { queryManifoldMarkets } from "../dist/tools/manifold.js";
import { queryOpenAlex } from "../dist/tools/openalex.js";
import { queryEdgarFormD } from "../dist/tools/edgar.js";
import { queryHuggingFace } from "../dist/tools/huggingface.js";
import { queryClinicalEvidence } from "../dist/tools/clinical.js";
import { queryMacroData } from "../dist/tools/macro.js";

function fetchMock(payload, ok = true) {
  return async () => ({
    ok,
    json: async () => payload
  });
}

test("Manifold returns BINARY markets, skips resolved and non-binary", async () => {
  const payload = [
    { question: "AI regulation passes in 2026", outcomeType: "BINARY", isResolved: false, probability: 0.22, volume: 5000, uniqueBettorCount: 40, url: "https://manifold.markets/x/y", slug: "y" },
    { question: "AI model releases", outcomeType: "MULTIPLE_CHOICE", isResolved: false, probability: 0.5, volume: 1, uniqueBettorCount: 1, url: "u" },
    { question: "Old resolved AI bet", outcomeType: "BINARY", isResolved: true, probability: 1, volume: 1, uniqueBettorCount: 1, url: "u" }
  ];
  const r = await queryManifoldMarkets("AI regulation", fetchMock(payload));
  assert.equal(r.marketsFound.length, 1);
  assert.equal(r.marketsFound[0].probabilityPercent, 22);
  assert.ok(r.marketsFound[0].marketUrl.startsWith("https://"));
});

test("Manifold honest empty on network failure", async () => {
  const r = await queryManifoldMarkets("x", async () => { throw new Error("down"); });
  assert.equal(r.marketsFound.length, 0);
});

test("OpenAlex parses papers with authors and citations", async () => {
  const payload = {
    meta: { count: 1200 },
    results: [{
      id: "https://openalex.org/W1",
      title: "Test Paper on Agents",
      publication_year: 2024,
      cited_by_count: 42,
      authorships: [{ author: { display_name: "Jane Doe" } }],
      primary_location: { source: { display_name: "NeurIPS" } },
      open_access: { oa_url: "https://example.org/paper" },
      concepts: [{ display_name: "AI" }]
    }]
  };
  const r = await queryOpenAlex("agents", fetchMock(payload));
  assert.equal(r.totalWorks, 1200);
  assert.equal(r.papers[0].citations, 42);
  assert.deepEqual(r.papers[0].authors, ["Jane Doe"]);
  assert.equal(r.papers[0].openAccessUrl, "https://example.org/paper");
});

test("OpenAlex honest empty on HTTP error", async () => {
  const r = await queryOpenAlex("x", fetchMock({}, false));
  assert.equal(r.papers.length, 0);
});

test("EDGAR parses Form D filings with SEC URLs", async () => {
  const payload = {
    hits: {
      total: { value: 2 },
      hits: [{
        _id: "doc1", _source: { ciks: ["0001234567"], file_date: "2024-10-10", adsh: "0001234567-24-000001", file_description: "Form D TestCo" }
      }]
    }
  };
  const r = await queryEdgarFormD("TestCo", fetchMock(payload));
  assert.equal(r.totalFilings, 2);
  assert.equal(r.filings[0].cik, "1234567");
  assert.ok(r.filings[0].filingUrl.includes("sec.gov"));
});

test("EDGAR honest empty when no hits", async () => {
  const r = await queryEdgarFormD("zzz-no-such-company", fetchMock({ hits: { total: { value: 0 }, hits: [] } }));
  assert.equal(r.filings.length, 0);
});

test("HuggingFace correlates by token, reports likes and downloads", async () => {
  const payload = [
    { id: "acme/invoice-ocr", likes: 10, downloads: 154, trendingScore: 0 },
    { id: "someone/pasta-recipes", likes: 99, downloads: 9999, trendingScore: 5 }
  ];
  const r = await queryHuggingFace("invoice ocr", fetchMock(payload));
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0].id, "acme/invoice-ocr");
  assert.ok(r.models[0].modelUrl.includes("huggingface.co"));
});

test("Clinical skips non-healthcare, parses trials for healthcare", async () => {
  const skip = await queryClinicalEvidence("SaaS billing", false, fetchMock({}));
  assert.equal(skip.studies.length, 0);
  assert.ok(skip.keyTakeaway.includes("Non-healthcare"));
  const ctPayload = {
    totalCount: 5,
    studies: [{
      protocolSection: {
        identificationModule: { nctId: "NCT123", briefTitle: "AI Triage Test" },
        statusModule: { overallStatus: "RECRUITING" },
        sponsorCollaboratorsModule: { leadSponsor: { name: "Test Hospital" } },
        designModule: { phases: ["PHASE2"] }
      }
    }]
  };
  let calls = 0;
  const dual = async (url) => {
    calls++;
    if (url.includes("clinicaltrials")) return { ok: true, json: async () => ctPayload };
    return { ok: false, json: async () => ({}) };
  };
  const r = await queryClinicalEvidence("AI triage", true, dual);
  assert.equal(r.studies[0].nctId, "NCT123");
  assert.ok(r.studies[0].studyUrl.includes("clinicaltrials.gov"));
  assert.equal(calls, 2);
});

test("Macro grounds audience country with World Bank data", async () => {
  const wb = async () => ({
    ok: true,
    json: async () => ([{}, [{ indicator: { id: "IT.NET.USER.ZS" }, country: { id: "IN" }, date: "2023", value: 60.25 }]])
  });
  const r = await queryMacroData("ASHA workers in India", wb);
  assert.equal(r.indicators[0].country, "IN");
  assert.equal(r.indicators[0].value, 60.25);
  assert.ok(r.keyTakeaway.includes("60.25"));
});
