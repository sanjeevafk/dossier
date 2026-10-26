import test from "node:test";
import assert from "node:assert/strict";
import { performLiveWebRecon } from "../dist/tools/recon.js";
import { composeDebateTrailDeterministic } from "../dist/core/debate.js";
import { performMarketResearch } from "../dist/tools/search.js";
import { queryCommunitySentiment } from "../dist/tools/community.js";

function opinion(overrides) {
  return {
    role: "redteam",
    roleNumber: "05",
    roleTitle: "RED TEAM",
    verdict: "LEAN_KILL",
    score: 40,
    status: "COMPLETE",
    fatalFlaws: ["Enterprise Procurement Deadlock stalls contracts for months"],
    keyAssumptions: ["Buyers have budget authority"],
    competitiveRisks: [],
    mustTestBeforeBuilding: ["Secure 2 paid pilots"],
    rationale: "High pilot abandonment risk.",
    ...overrides
  };
}

function fakeOpinions() {
  return {
    analyst: opinion({ role: "analyst", roleTitle: "ANALYST", score: 72, fatalFlaws: ["Unclear differentiation"], keyAssumptions: ["Demand is active"], mustTestBeforeBuilding: ["10 buyer interviews"] }),
    customer: opinion({ role: "customer", roleTitle: "CUSTOMER", score: 68, fatalFlaws: ["Adoption inertia with high switching drag"], keyAssumptions: ["Users will switch fast"], mustTestBeforeBuilding: ["Observe 5 operators"] }),
    architect: opinion({ role: "architect", roleTitle: "ARCHITECT", score: 84, fatalFlaws: ["API token inflation"], keyAssumptions: ["Infra holds latency budgets"], mustTestBeforeBuilding: ["Benchmark latency"] }),
    investor: opinion({ role: "investor", roleTitle: "INVESTOR", score: 88, fatalFlaws: ["Sales cycle strain"], keyAssumptions: ["Unit economics support margins"], mustTestBeforeBuilding: ["Pre-secure LOIs"] }),
    redteam: opinion({ role: "redteam", roleTitle: "RED TEAM", score: 40, fatalFlaws: ["Distribution Desert kills traction"], keyAssumptions: ["Budget authority exists"], mustTestBeforeBuilding: ["Binding pre-order"] }),
    expert: opinion({ role: "expert", roleTitle: "EXPERT", score: 74, fatalFlaws: ["Compliance halt risk"], keyAssumptions: ["Meets compliance"], mustTestBeforeBuilding: ["Audit architecture"] })
  };
}

test("Recon without a provider is explicitly 'none' — never fabricated", async () => {
  const savedExa = process.env.EXA_API_KEY;
  const savedTavily = process.env.TAVILY_API_KEY;
  delete process.env.EXA_API_KEY;
  delete process.env.TAVILY_API_KEY;

  const outcome = await performLiveWebRecon(["test query competitors"]);
  assert.equal(outcome.provider, "none");
  assert.equal(outcome.results.length, 0);
  assert.ok(outcome.error, "Must state why no recon happened");

  if (savedExa) process.env.EXA_API_KEY = savedExa;
  if (savedTavily) process.env.TAVILY_API_KEY = savedTavily;
});

test("Recon with Exa key parses real search results via injected fetch", async () => {
  const savedFetch = globalThis.fetch;
  const savedExa = process.env.EXA_API_KEY;
  process.env.EXA_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).includes("api.exa.ai"), "Exa endpoint must be called");
    assert.equal(init.headers["x-api-key"], "test-key");
    return {
      ok: true,
      json: async () => ({
        results: [
          { title: "Best competitors 2026", url: "https://example.com/a", text: "Real snippet about rivals " },
          { title: "Pricing comparison", url: "https://example.com/b", text: "Real pricing intel" }
        ]
      })
    };
  };

  try {
    const outcome = await performLiveWebRecon(["my idea competitors pricing"]);
    assert.equal(outcome.provider, "exa");
    assert.equal(outcome.results.length, 2);
    assert.equal(outcome.results[0].url, "https://example.com/a");
    assert.ok(outcome.results[0].snippet.length > 0);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedExa) process.env.EXA_API_KEY = savedExa; else delete process.env.EXA_API_KEY;
  }
});

test("Market research degrades honestly when no recon provider exists", async () => {
  const savedExa = process.env.EXA_API_KEY;
  const savedTavily = process.env.TAVILY_API_KEY;
  delete process.env.EXA_API_KEY;
  delete process.env.TAVILY_API_KEY;

  const findings = await performMarketResearch("PawSitter", ["urban professionals"]);
  assert.equal(findings.dataSource, "none");
  assert.equal(findings.identifiedCompetitors.length, 0, "No fake competitor lists");
  assert.equal(findings.marketSignals.length, 0, "No fake market signals");

  if (savedExa) process.env.EXA_API_KEY = savedExa;
  if (savedTavily) process.env.TAVILY_API_KEY = savedTavily;
});

test("Deterministic debate trail cites actual agent claims, not canned narratives", () => {
  const opinions = fakeOpinions();
  const trail = composeDebateTrailDeterministic({
    opinions,
    procurementCycle: "Enterprise PoC (1–3 Months)",
    primaryCustomer: "CTOs and Security Directors",
    sandboxMetrics: { ltvCacRatio: 4.2, estimatedPaybackMonths: 8 }
  });

  assert.equal(trail.length, 3);
  for (const clash of trail) {
    assert.notEqual(clash.challenger, clash.target, "Challenger and target must differ");
    assert.ok(clash.challengePoint.length > 20, "Challenge must be substantive");
  }
  // Red team's ACTUAL fatal flaw text must appear in its challenge.
  const rtClash = trail.find((c) => c.challenger === "redteam" && c.target === "investor");
  assert.ok(rtClash, "Red team vs investor clash must exist");
  assert.ok(
    rtClash.challengePoint.includes("Distribution Desert"),
    "Challenge must quote the red team's actual fatal flaw"
  );
  // Investor's actual assumption must be attacked.
  assert.ok(rtClash.challengePoint.includes("Unit economics support margins"));
});

test("Debate trail statuses derive from real score gaps", () => {
  const opinions = fakeOpinions();
  const trail = composeDebateTrailDeterministic({
    opinions,
    procurementCycle: "PoC",
    primaryCustomer: "Buyers",
    sandboxMetrics: { ltvCacRatio: 4, estimatedPaybackMonths: 8 }
  });
  // redteam(40) vs investor(88): gap 48 > 20 -> REBUTTED (target's dominant position held)
  const rtInvestor = trail.find((c) => c.challenger === "redteam" && c.target === "investor");
  assert.equal(rtInvestor.status, "REBUTTED");
  // customer(68) vs architect(84): gap 16 <= 20 -> OPEN (challenge stands, needs validation)
  const custArch = trail.find((c) => c.challenger === "customer" && c.target === "architect");
  assert.equal(custArch.status, "OPEN");
});

const HN_HITS = {
  hits: [
    { objectID: "1", title: "Show HN: compliance automation tooling", url: "https://example.com/hn-a", points: 142, num_comments: 87 },
    { objectID: "2", title: "Completely unrelated recipe post", url: "https://example.com/hn-b", points: 3, num_comments: 1 },
    { objectID: "3", title: "Ask HN: auditor recommendations?", url: null, points: 10, num_comments: 4 }
  ]
};

test("Hacker News community search keeps only title-relevant hits, with real URLs", async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).includes("hn.algolia.com"), "HN Algolia endpoint must be used");
    return { ok: true, json: async () => HN_HITS };
  };
  try {
    const result = await queryCommunitySentiment("Compliance Auditor for cloud infra");
    const hn = result.discussions.filter((d) => d.platform === "hackernews");
    assert.equal(hn.length, 2, "Irrelevant hit must be filtered, relevant kept");
    assert.equal(hn[0].url, "https://example.com/hn-a");
    assert.equal(hn[0].score, 142);
    assert.equal(hn[0].comments, 87);
    // Null external URL must fall back to the real HN item link, never be invented.
    const itemLinked = hn.find((d) => d.url.includes("news.ycombinator.com/item?id=3"));
    assert.ok(itemLinked, "Null-URL hit must link to its HN item page");
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("Community sentiment degrades to explicit 'none' when every backend fails", async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network unreachable");
  };
  try {
    const result = await queryCommunitySentiment("Some Concept With No Backends");
    assert.equal(result.provider, "none");
    assert.equal(result.discussions.length, 0, "No fabricated discussions on total failure");
    assert.ok(result.errors.some((e) => e.startsWith("hackernews:")), "HN failure must be recorded");
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("Role-scoped context engineering routes grounded competitor intelligence to Red Team and complaints to Customer", async () => {
  const { buildRoleEvidenceSlices } = await import("../dist/tools/analyst-tools.js");

  const competitors = [
    {
      name: "Vanta",
      url: "https://vanta.com",
      category: "incumbent",
      strengths: "100+ integrations and auditor partner network",
      vulnerability: "High entry pricing ($15k/yr)",
      pricingEstimate: "$15,000/yr"
    }
  ];

  const frictions = [
    "Customers express extreme fatigue over screenshot evidence collection on HN"
  ];

  const results = [
    {
      title: "SOC 2 Software Pricing 2026",
      url: "https://example.com/pricing",
      snippet: "Compare Vanta vs Drata pricing",
      queryLabel: "competitive"
    }
  ];

  const discussions = [
    {
      platform: "hackernews",
      title: "Ask HN: Why is SOC 2 compliance so expensive?",
      url: "https://news.ycombinator.com/item?id=12345",
      score: 180
    }
  ];

  const slices = buildRoleEvidenceSlices(competitors, frictions, results, discussions, "duckduckgo");

  // Red Team must receive competitor names, URLs, and failure modes
  assert.ok(slices.redteam.includes("Vanta"), "Red Team must receive discovered competitor name");
  assert.ok(slices.redteam.includes("https://vanta.com"), "Red Team must receive competitor URL");
  assert.ok(slices.redteam.includes("100+ integrations"), "Red Team must receive competitor strengths");

  // Customer Advocate must receive friction and pricing benchmarks
  assert.ok(slices.customer.includes("screenshot evidence collection"), "Customer must receive buyer friction");
  assert.ok(slices.customer.includes("$15,000/yr"), "Customer must receive pricing benchmarks");

  // Technical Architect must be shielded from commercial fluff
  assert.ok(!slices.architect.includes("Vanta"), "Architect must NOT receive competitor brand names");
  assert.ok(slices.architect.includes("compute burden"), "Architect must focus on deterministic compute and latency");
});
