/**
 * Builds failure cases from real post-mortems on loot-drop.io (a directory of shut-down startups).
 *
 *   tsx scripts/build_cases_from_lootdrop.ts [--n 60] [--seed 7]
 *
 * Etiquette and scope: robots.txt allows /startup/ pages; we fetch a small seeded sample sequentially with a delay
 * and an identifying User-Agent. We store only the URL and a few facts (sector, years, cash burned) as provenance,
 * and the idea is re-written by an LLM into a neutral founder pitch with an invented title, so no page text is copied.
 * The site is failures only: it can supply "known failure" cases with a verifiable source, never successes.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argVal = (f: string, d: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const N = Number(argVal("--n", "60"));
let seed = Number(argVal("--seed", "7"));
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const UA = "dossier-eval-builder (research; small sample; contact via repo owner)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { generateAgentTurn } = await import("../src/services/llm.ts");

const sitemap = await (await fetch("https://www.loot-drop.io/sitemap.xml", { headers: { "User-Agent": UA } })).text();
const urls = [...sitemap.matchAll(/<loc>(https:\/\/www\.loot-drop\.io\/startup\/[^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`sitemap: ${urls.length} startup pages`);
// seeded shuffle
for (let i = urls.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [urls[i], urls[j]] = [urls[j], urls[i]];
}

function textLines(html: string): string[] {
  const t = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return t.split("\n").map((l) => l.trim()).filter(Boolean);
}
const after = (lines: string[], label: string) => {
  const i = lines.indexOf(label);
  return i >= 0 ? lines[i + 1] : undefined;
};

interface Raw { url: string; name: string; description: string; sector?: string; productType?: string; burned?: string; founded?: number; ended?: number }
const raws: Raw[] = [];
for (const url of urls) {
  if (raws.length >= N) break;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) { await sleep(1200); continue; }
    const lines = textLines(await res.text());
    const name = lines[0]?.split("|")[0]?.trim() ?? "";
    const di = lines.indexOf("Disclaimer");
    const description = lines.slice(di + 1).find((l) => l.length > 300) ?? "";
    const founded = Number(after(lines, "FOUNDING YEAR"));
    const ended = Number(after(lines, "END YEAR"));
    if (description.length < 400 || !(founded >= 1995)) { await sleep(1200); continue; }
    raws.push({ url, name, description, sector: after(lines, "SECTOR"), productType: after(lines, "PRODUCT TYPE"), burned: after(lines, "TOTAL CASH BURNED"), founded, ended });
    process.stdout.write(`\rfetched ${raws.length}/${N}`);
  } catch { /* skip */ }
  await sleep(1200);
}
console.log();

const BANNED = /\b(failed|failure|shut ?down|bankrupt|collapsed|went under|defunct|ceased|liquidat|post-?mortem|pioneered|disrupt(ed|ing)? the)\b/i;
const out: unknown[] = [];
let i = 0;
async function rewrite(raw: Raw) {
  const sys = `You rewrite a company description into a neutral founder pitch as it would have been written at the START, in ${raw.founded}. Rules: invent a short codename title that does NOT contain any word of the real name; never mention the real company, its investors or any outcome (no shutdown, failure, decline, lessons, "pioneered", results after launch); no hindsight; do not invent facts or figures: only restate what the idea was and the pricing or revenue model if the text states one, otherwise say how it plausibly earns; 2 to 3 plain sentences. Return only JSON: {"title": string, "summary": string, "targetAudience": string, "monetization": string}.`;
  const raw1 = await generateAgentTurn(sys, `Real name (never use it): ${raw.name}\nSector: ${raw.sector}\nDescription:\n${raw.description.slice(0, 1800)}`, { temperature: 0.3, maxTokens: 900, jsonMode: true });
  const m = raw1.match(/\{[\s\S]*\}/);
  const j = JSON.parse(m ? m[0] : "{}");
  const text = `${j.title} ${j.summary} ${j.targetAudience} ${j.monetization}`;
  const nameTokens = raw.name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
  if (!j.title || !j.summary || BANNED.test(text) || nameTokens.some((t) => text.toLowerCase().includes(t))) return null;
  return {
    id: `L-${String(++i).padStart(2, "0")}-${raw.url.split("/").pop()!.split("-")[0]}`,
    outcome: "failure",
    expected: ["KILL"],
    idea: { title: j.title, summary: j.summary, targetAudience: j.targetAudience || "General consumers", monetization: j.monetization || "Not stated" },
    note: `Real shut-down startup (${raw.sector ?? "n/a"}, ${raw.founded}-${raw.ended}).`,
    source: { name: "Loot Drop startup graveyard", url: raw.url, sector: raw.sector, burned: raw.burned, years: `${raw.founded}-${raw.ended}` }
  };
}
const queue = [...raws];
async function worker() {
  while (queue.length) {
    const r = queue.shift()!;
    try { const c = await rewrite(r); if (c) out.push(c); } catch { /* skip */ }
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(`rewritten ok: ${out.length}/${raws.length}`);

const file = path.resolve("src/evaluation/cases_lootdrop.ts");
fs.writeFileSync(
  file,
  `import type { EvalCase } from "./cases.js";\n\n/** Generated by scripts/build_cases_from_lootdrop.ts: real shut-down startups, pitches re-written neutrally. Failures only. */\nexport const LOOTDROP_CASES: EvalCase[] = ${JSON.stringify(out, null, 2)};\n`
);
console.log(`wrote ${file}`);
