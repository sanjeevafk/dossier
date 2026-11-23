import test from "node:test";
import assert from "node:assert/strict";
import { IdeaSwarmOrchestrator } from "../src/core/swarm.ts";
import { enforceEvaluationBudget, runWithUsageTracking } from "../src/services/llm.ts";

test("an aborted evaluation stops before spending more LLM calls", async () => {
  const ac = new AbortController();
  await runWithUsageTracking(async () => {
    enforceEvaluationBudget(); // fine while live
    ac.abort();
    assert.throws(() => enforceEvaluationBudget(), { name: "AbortError" });
  }, ac.signal);
});

test("evaluateIdea rejects with AbortError when the signal aborts mid-run, and does not complete", async () => {
  const ac = new AbortController();
  const stages = [];
  const p = new IdeaSwarmOrchestrator().evaluateIdea(
    { title: "Abort probe", summary: "Probe idea for cancellation.", targetAudience: "Devs", monetization: "$10/month" },
    {
      useLiveLLM: false,
      signal: ac.signal,
      onProgress: (stage) => {
        stages.push(stage);
        if (stage.startsWith("02")) ac.abort();
      }
    }
  );
  await assert.rejects(p, { name: "AbortError" });
  assert.ok(!stages.some((s) => s.startsWith("04")), "must not reach the attack stage after abort");
});
