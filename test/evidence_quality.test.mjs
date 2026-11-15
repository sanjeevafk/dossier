import test from "node:test";
import assert from "node:assert/strict";
import { buildConceptTerms, buildResearchQueries, filterEntityRelevant, performMarketResearch } from "../src/tools/search.ts";

const ASHA_IDEA = {
  title: "Asha Health",
  summary: "An AI health coach app for chronic disease patients with daily check-ins, medication nudges and clinician oversight.",
  targetAudience: "Chronic care patients and their clinics"
};

test("concept terms come from what the idea does, not the invented brand name", () => {
  const terms = buildConceptTerms(ASHA_IDEA);
  assert.ok(!terms.includes("asha"), "brand token must not be a concept term");
  assert.ok(terms.includes("coach") || terms.includes("chronic"), `expected content terms, got ${terms}`);
});

test("brand-led query keeps the name, concept-led query does not", () => {
  const q = buildResearchQueries(ASHA_IDEA);
  assert.ok(q.brandQuery.startsWith("Asha Health"));
  assert.ok(!q.conceptQuery.toLowerCase().includes("asha"), `concept query must not contain the brand: ${q.conceptQuery}`);
  assert.ok(q.conceptQuery.includes("coach") || q.conceptQuery.includes("chronic"));
  assert.ok(q.conceptQuery.includes("customer complaints churn reviews"));
});

test("entity-relevance filter drops the Asha Health clinic collision", () => {
  const results = [
    // Real unrelated entity with the same name: brand match, zero content overlap → drop
    { title: "Asha Health Clinic — Primary Care in Bangalore", url: "https://ashaclinics.in", snippet: "Walk-in clinic with general physicians and laboratory services" },
    // Same name, same concept → keep
    { title: "Asha Health raises $12M for its AI health coaching app", url: "https://tech.example/asha", snippet: "The app guides chronic care patients through daily check-ins" },
    // Concept match without the brand → keep
    { title: "Best health coaching apps of 2026", url: "https://reviews.example/coach", snippet: "AI coach apps for chronic conditions compared" },
    // Neither brand nor concept → keep (missing overlap alone is not proof of irrelevance)
    { title: "Funding roundup: eleven seed rounds", url: "https://news.example/roundup", snippet: "Venture deals from the week" }
  ];

  const { kept, dropped } = filterEntityRelevant(results, ASHA_IDEA);
  assert.equal(dropped.length, 1, `exactly the clinic collision should be dropped, got ${dropped.map((d) => d.item.title)}`);
  assert.match(dropped[0].reason, /unrelated entity/);
  const keptTitles = kept.map((r) => r.title);
  assert.ok(keptTitles.includes("Asha Health raises $12M for its AI health coaching app"));
  assert.ok(keptTitles.includes("Best health coaching apps of 2026"));
  assert.ok(keptTitles.includes("Funding roundup: eleven seed rounds"));
});

test("filter never fires without enough concept signal", () => {
  const results = [{ title: "Asha Health Clinic — Primary Care in Bangalore", url: "https://ashaclinics.in" }];
  const { kept, dropped } = filterEntityRelevant(results, { title: "Asha Health" }); // no summary/audience
  assert.equal(dropped.length, 0);
  assert.equal(kept.length, 1);
});

test("single-token brands filter too", () => {
  const idea = {
    title: "WashLoop",
    summary: "Laundry pickup and delivery with a company-run facility in Chicago, flat price per bag.",
    targetAudience: "Urban professionals"
  };
  const results = [
    { title: "WashLoop Milano — lavanderia a domicilio", url: "https://washloop.it", snippet: "Servizio di lavanderia" },
    { title: "WashLoop expands laundry pickup to 3 cities", url: "https://news.example/washloop", snippet: "The Chicago laundry startup opens pickup routes" }
  ];
  const { kept, dropped } = filterEntityRelevant(results, idea);
  assert.equal(dropped.length, 1, "the Milan namesake should be dropped");
  assert.equal(kept[0].title, "WashLoop expands laundry pickup to 3 cities");
});

test("performMarketResearch applies the filter to live recon results and reports what it removed", async () => {
  const savedFetch = globalThis.fetch;
  const savedExa = process.env.EXA_API_KEY;
  process.env.EXA_API_KEY = "test-key";
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      results: [
        { title: "Asha Health Clinic — Primary Care in Bangalore", url: "https://ashaclinics.in", text: "Walk-in clinic with general physicians" },
        { title: "Asha Health raises $12M for its AI health coaching app", url: "https://tech.example/asha", text: "Chronic care coaching app" }
      ]
    })
  });

  try {
    const findings = await performMarketResearch(ASHA_IDEA, { exaKey: "test-key" });
    assert.equal(findings.dataSource, "live-web-recon");
    assert.ok(!findings.rawResults.some((r) => r.url === "https://ashaclinics.in"), "collision must not reach agents");
    assert.equal(findings.filteredOut.length, 1);
    assert.match(findings.filteredOut[0].reason, /unrelated entity/);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedExa) process.env.EXA_API_KEY = savedExa;
    else delete process.env.EXA_API_KEY;
  }
});
