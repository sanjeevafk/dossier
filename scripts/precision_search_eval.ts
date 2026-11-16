/**
 * Retrieval precision for the entity-relevance work: runs the dev-split ideas through
 * live web recon with the OLD query style (brand-led, monetization keywords) and the NEW
 * style (brand + concept query), then scores precision@5.
 *
 * Relevance label (mechanical proxy for a human label): a result is relevant when at least 2
 * distinct mechanism terms of the idea appear in its title+snippet. This is a proxy, not a
 * human grade — it measures whether retrieval surfaces same-concept content, and it is
 * computed identically for both arms, so the comparison is fair.
 *
 *   tsx scripts/precision_search_eval.ts            # first 10 labelled dev cases
 *   tsx scripts/precision_search_eval.ts --ids=A,B  # specific cases
 *   tsx scripts/precision_search_eval.ts --k 5
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DOSSIER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "dossier-precision-"));

const { casesFor } = await import("../src/evaluation/index.ts");
const { performLiveWebRecon } = await import("../src/tools/recon.ts");
const { buildResearchQueries, buildConceptTerms, filterEntityRelevant } = await import("../src/tools/search.ts");

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--ids="))?.slice(6)?.split(",");
const k = Math.max(1, Number(args.find((a) => a.startsWith("--k="))?.slice(4) ?? 5));

const cases = casesFor("dev")
  .filter((c) => c.outcome !== "ambiguous" && !["F6-free-energy", "F7-prompt-injection"].includes(c.id))
  .filter((c) => !only || only.includes(c.id))
  .slice(0, only ? undefined : 10);

if (!process.env.EXA_API_KEY && !process.env.TAVILY_API_KEY) {
  console.error("This script measures live retrieval: set EXA_API_KEY or TAVILY_API_KEY.");
  process.exit(2);
}

function oldQueries(idea: { title: string; targetAudience: string; monetization: string }): string[] {
  const t = idea.title.trim().slice(0, 120);
  return [
    `${t} competitors alternatives pricing`,
    `${t} ${idea.targetAudience} ${idea.monetization} customer complaints churn reviews`
  ];
}

/** Mechanical relevance: >=2 distinct mechanism terms in title+snippet. */
function relevantCount(results: Array<{ title: string; snippet?: string }>, idea: { title: string; summary: string }): number {
  const brandTokens = new Set((idea.title.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 3));
  const terms = buildConceptTerms({ summary: idea.summary }).filter((t) => !brandTokens.has(t));
  let rel = 0;
  for (const r of results.slice(0, k)) {
    const toks = new Set((`${r.title} ${r.snippet ?? ""}`.toLowerCase().match(/[a-z0-9]+/g) ?? []));
    const hits = terms.filter((t) => toks.has(t)).length;
    if (hits >= Math.min(2, terms.length)) rel++;
  }
  return rel;
}

function filteredResults(
  results: Array<{ title: string; snippet?: string }>,
  idea: { title: string; summary: string; targetAudience: string }
) {
  const { kept, dropped } = filterEntityRelevant(results as Parameters<typeof filterEntityRelevant>[0], idea);
  return { kept: kept as Array<{ title: string; snippet?: string }>, droppedCount: dropped.length };
}

const perCase: Array<{ id: string; old: { rel: number; n: number }; neu: { rel: number; n: number } }> = [];

for (const c of cases) {
  const q = buildResearchQueries({ title: c.idea.title, summary: c.idea.summary, targetAudience: c.idea.targetAudience });
  const [oldRes, newRes] = await Promise.all([
    performLiveWebRecon(oldQueries(c.idea), {}),
    performLiveWebRecon([q.brandQuery, q.conceptQuery], {})
  ]);
  const oldFiltered = filteredResults(oldRes.results, c.idea);
  const newFiltered = filteredResults(newRes.results, c.idea);
  const oldRel = relevantCount(oldFiltered.kept, { title: c.idea.title, summary: c.idea.summary });
  const newRel = relevantCount(newFiltered.kept, { title: c.idea.title, summary: c.idea.summary });
  perCase.push({ id: c.id, old: { rel: oldRel, n: oldFiltered.kept.length }, neu: { rel: newRel, n: newFiltered.kept.length } });
  console.log(
    `${c.id.padEnd(30)} old ${oldRel}/${Math.min(k, oldFiltered.kept.length)} (dropped ${oldFiltered.droppedCount})  new ${newRel}/${Math.min(k, newFiltered.kept.length)} (dropped ${newFiltered.droppedCount})`
  );
}

const usable = perCase.filter((r) => r.old.n > 0 && r.neu.n > 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
console.log(`\nprecision@${k} (mechanical relevance proxy), cases usable ${usable.length}/${perCase.length}`);
console.log(`old-style: ${(mean(usable.map((r) => r.old.rel / Math.min(k, r.old.n))) * 100).toFixed(0)}%`);
console.log(`new-style: ${(mean(usable.map((r) => r.neu.rel / Math.min(k, r.neu.n))) * 100).toFixed(0)}%`);
