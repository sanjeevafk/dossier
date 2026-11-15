/**
 * Builds eval cases from the Y Combinator company directory (github.com/yc-oss/api, MIT-licensed
 * community mirror of YC's public Algolia index).
 *
 *   tsx scripts/build_cases_from_yc.ts [--n 30] [--seed 11]
 *
 * Why this source: it is the only one we have where BOTH outcomes come from the same directory
 * with the company's own pitch text: status "Inactive" (dead, 2005-2016 batches) is a real
 * failure; "Active"/"Public"/"Acquired" after 9+ years is a real non-failure. Loot Drop supplies
 * failures only.
 *
 * Method mirrors build_cases_from_lootdrop.ts: an LLM that does NOT see the outcome rewrites the
 * description into a neutral founder pitch "as at the start of the batch", with an invented
 * codename title. Banned words cover hindsight in both directions (failure words AND
 * success puffery like "leading"/"trusted"). Real-name tokens are excluded from the output.
 * Known residual risks: a famous company may still be recognizable from its description, and
 * "Acquired" includes acqui-hires that are ambiguous outcomes. Recorded in docs/EVALUATION.md.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argVal = (f: string, d: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const N = Number(argVal("--n", "30"));
let seed = Number(argVal("--seed", "11"));
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const { generateAgentTurn } = await import("../src/services/llm.ts");
const { LOOTDROP_CASES } = await import("../src/evaluation/cases_lootdrop.ts");

const ALL = (await (await fetch("https://yc-oss.github.io/api/companies/all.json")).json()) as Array<{
  id: number; name: string; slug: string; one_liner?: string; long_description?: string;
  batch: string; status: string; industry: string; regions: string[]; nonprofit: boolean; url: string;
}>;

const OLD_BATCH = /(?:Winter|Summer) (?:200[5-9]|201[0-6])$/;
const pool = ALL.filter(
  (c) =>
    OLD_BATCH.test(c.batch) &&
    !c.nonprofit &&
    (c.one_liner ?? "").length >= 15 &&
    (c.long_description ?? "").length >= 150 &&
    ["Active", "Public", "Acquired", "Inactive"].includes(c.status)
);
console.log(`pool: ${pool.length} YC companies, batches 2005-2016 (Inactive ${pool.filter((c) => c.status === "Inactive").length}, survived ${pool.filter((c) => c.status !== "Inactive").length})`);

// Skip companies that already appear as Loot Drop cases (by source slug or name overlap).
const lootSlugs = new Set(
  LOOTDROP_CASES.flatMap((c) =>
    (c.source?.url ?? "").split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !/^\d+$/.test(t))
  )
);
const eligible = pool.filter((c) => !lootSlugs.has(c.slug) && !lootSlugs.has(c.name.toLowerCase()));

function seededTake<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// Both outcomes may hit the same archetype; keep the sample small but balanced by label only.
const dead = seededTake(eligible.filter((c) => c.status === "Inactive"), N);
const alive = seededTake(
  eligible.filter((c) => c.status !== "Inactive"),
  N
);
console.log(`sampled ${dead.length} dead + ${alive.length} survived`);

const BANNED = /\b(failed|failure|shut ?down|bankrupt|collapsed|went under|defunct|ceased|liquidat|post-?mortem|pioneered|disrupt(ed|ing)? the|leading|largest|fastest[- ]growing|market leader|the go[- ]to|best[- ]selling|#1|number one|trusted by|millions of|thousands of|acquired|ipo|public company)\b/i;

interface Raw { id: number; name: string; slug: string; description: string; batch: string; status: string; industry: string; region: string; url: string }
const raws: Raw[] = [...dead, ...alive].map((c) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  description: `${c.one_liner}\n${c.long_description}`,
  batch: c.batch,
  status: c.status,
  industry: c.industry,
  region: (c.regions?.[0] ?? "").split("/")[0].trim(),
  url: c.url
}));

const out: unknown[] = [];
let i = 0;
async function rewrite(raw: Raw) {
  const year = raw.batch.match(/\d{4}/)?.[0] ?? "2012";
  const sys = `You rewrite a company description into a neutral founder pitch as it would have been written at the START of YC batch ${raw.batch} (year ${year}). Rules: invent a short codename title that does NOT contain any word of the real name; never mention the real company, its investors or any outcome; no hindsight in either direction — no growth claims, user counts, revenue figures or "leading/best" language, and no failure, decline or lessons; do not invent facts or figures: only restate what the idea was and the pricing or revenue model if the text states one, otherwise say how it plausibly earns; 2 to 3 plain sentences. Return only JSON: {"title": string, "summary": string, "targetAudience": string, "monetization": string}.`;
  const raw1 = await generateAgentTurn(sys, `Real name (never use it): ${raw.name}\nIndustry: ${raw.industry}\nRegion: ${raw.region}\nDescription:\n${raw.description.slice(0, 1800)}`, { temperature: 0.3, maxTokens: 900, jsonMode: true });
  const m = raw1.match(/\{[\s\S]*\}/);
  const j = JSON.parse(m ? m[0] : "{}");
  const text = `${j.title} ${j.summary} ${j.targetAudience} ${j.monetization}`;
  const nameTokens = raw.name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
  if (!j.title || !j.summary || BANNED.test(text) || nameTokens.some((t) => text.toLowerCase().includes(t))) return null;
  const isDead = raw.status === "Inactive";
  return {
    id: `Y-${String(++i).padStart(2, "0")}-${raw.id}`,
    outcome: isDead ? "failure" : "success",
    // A dead YC company was not necessarily a bad idea at inception, so REFINE is accepted (same rule as Loot Drop).
    expected: isDead ? ["KILL", "REFINE"] : ["BUILD", "BUILD_IF_VALIDATED", "REFINE"],
    idea: { title: j.title, summary: j.summary, targetAudience: j.targetAudience || "General consumers", monetization: j.monetization || "Not stated" },
    note: `Real YC company (${raw.batch}, status ${raw.status}, ${raw.industry}). Name anonymized; pitch rewritten neutrally.`,
    source: { name: "Y Combinator directory (yc-oss/api)", url: raw.url, sector: raw.industry, years: raw.batch }
  };
}
const queue = [...raws];
async function worker() {
  while (queue.length) {
    const r = queue.shift()!;
    try {
      const c = await rewrite(r);
      if (c) out.push(c);
      process.stdout.write(`\rrewritten ${out.length}/${raws.length}   `);
    } catch { /* skip */ }
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log();

// Ids must be unique even if the script is re-run with different seeds into the same tree.
const seen = new Set<string>();
const deduped = out.filter((c: any) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
const file = path.resolve("src/evaluation/cases_yc.ts");
fs.writeFileSync(
  file,
  `import type { EvalCase } from "./cases.js";\n\n/** Generated by scripts/build_cases_from_yc.ts: real YC companies (2005-2016 batches) from github.com/yc-oss/api.\n *  Dead (Inactive) and survived (Active/Public/Acquired) come from the same directory; pitches rewritten neutrally with invented codenames. */\nexport const YC_CASES: EvalCase[] = ${JSON.stringify(deduped, null, 2)};\n`
);
console.log(`wrote ${file} (${deduped.length} cases)`);
