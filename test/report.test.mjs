import test from "node:test";
import assert from "node:assert/strict";
import { buildFindingsTable, buildValidationChecklist, rankFinding } from "../src/core/swarm/report.ts";

const f = (over = {}) => ({
  claim: "c",
  severity: "MAJOR",
  kind: "VALIDATABLE",
  evidence: { type: "REASONING", ref: "r" },
  ...over
});

test("findings table ranks fatal structural evidence first and merges near-duplicates across lanes", () => {
  const rows = buildFindingsTable([
    { ...f({ claim: "CAC of $40 against $12 LTV makes the model insolvent", severity: "FATAL", kind: "STRUCTURAL", evidence: { type: "COMPUTATION", ref: "math" }, cheapestTest: "Pre-sell 10 plans" }), lane: "investor" },
    { ...f({ claim: "the CAC of $40 versus $12 LTV is insolvent for this model", severity: "MAJOR", kind: "STRUCTURAL", evidence: { type: "STATED_INPUT", ref: "$40 CAC" } }), lane: "redteam" },
    { ...f({ claim: "No recurring habit trigger exists between episodic uses", severity: "MAJOR", kind: "VALIDATABLE" }), lane: "customer" },
    { ...f({ claim: "Minor ops risk", severity: "MINOR", kind: "EXECUTION" }), lane: "architect" }
  ]);

  assert.equal(rows.length, 3, "near-duplicate claims merge into one row; distinct claims stay separate");
  const [first] = rows;
  assert.equal(first.severity, "FATAL");
  assert.deepEqual(first.lanes.sort(), ["investor", "redteam"], "merged row must list both lanes");
  assert.equal(first.cheapestTest, "Pre-sell 10 plans");
  assert.equal(rows[rows.length - 1].severity, "MINOR", "MINOR ranks last");
});

test("findings table caps at 12 rows", () => {
  const words = ["pricing", "churn", "retention", "compliance", "onboarding", "distribution", "margin", "support", "hardware", "licensing", "data", "integration", "trust", "supply", "demand", "branding", "regulation", "fraud", "latency", "inventory", "hiring", "tax", "insurance", "scale", "seo", "privacy", "offline", "b2b", "consumer", "enterprise"];
  const many = words.map((w) => ({ ...f({ claim: `risk around ${w}` }), lane: "analyst" }));
  assert.equal(buildFindingsTable(many).length, 12);
});

test("validation checklist puts the value-of-information experiment first and dedupes similar tests", () => {
  const items = buildValidationChecklist(
    [
      { ...f({ claim: "a", cheapestTest: "Interview 5 ops managers about current workflow" }), lane: "customer" },
      { ...f({ claim: "b", cheapestTest: "interview 5 operations managers on their workflow", severity: "FATAL", kind: "STRUCTURAL", killCriterion: "0 of 5 pre-commit" }), lane: "redteam" },
      { ...f({ claim: "c", cheapestTest: "Landing page with 500 targeted ads, track conversion" }), lane: "investor" },
      { ...f({ claim: "d", severity: "MINOR", cheapestTest: "should not appear" }), lane: "analyst" }
    ],
    { title: "Resolve CAC uncertainty", description: "Run 10 interviews", successMetric: "3 signed LOIs" }
  );

  assert.ok(items[0].test.includes("Resolve CAC uncertainty"), "VOI experiment is item 1");
  assert.equal(items[0].lane, "value-of-information");
  assert.equal(items.length, 3, "similar interview tests merge; MINOR excluded");
  assert.ok(!items.some((i) => i.test.includes("should not appear")));
  const interviews = items.filter((i) => i.lane !== "value-of-information" && i.test.toLowerCase().includes("interview"));
  assert.equal(interviews.length, 1, "near-duplicate interview tests collapse to one");
  assert.ok(interviews[0].killCriterion, "kill criterion survives the merge");
});
