/**
 * Paired analysis for the specificity experiment.
 *   tsx scripts/analyze_specificity.ts
 *
 * Pairs each labelled dev case's generic-row and detailed-row, reusing the pre-lootdrop
 * plain dev run for the generic arm where available.
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("reports", "eval");
const latest = (prefix: string, exclude: RegExp = /x/) => {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json") && !exclude.test(f))
    .sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
};

const detailedFile = latest("specificity_detailed");
const genericLFile = latest("specificity_generic");
const oldGenericFile = latest("eval_dev", /baseline|specificity/);
if (!detailedFile || !oldGenericFile) {
  console.error("Missing reports: need specificity_detailed_*.json and eval_dev_*.json");
  process.exit(2);
}

interface Row {
  id: string;
  outcome: string;
  expected: string[];
  arm?: string;
  verdict?: string;
  score?: number;
  llmRoles?: number;
  hit?: boolean;
  roles?: Record<string, { rating?: number; findings?: string[] }>;
  error?: string;
}

const loadRows = (file: string): Row[] => JSON.parse(fs.readFileSync(file, "utf8")).rows;

const oldGeneric = new Map<string, Row>();
for (const r of loadRows(oldGenericFile)) if (!r.error && !["F6-free-energy", "F7-prompt-injection"].includes(r.id)) oldGeneric.set(r.id, { ...r, arm: "generic" });

if (genericLFile) {
  for (const r of loadRows(genericLFile)) if (!r.error) oldGeneric.set(r.id, { ...r, arm: "generic" });
}

const detailed = new Map<string, Row>();
for (const r of loadRows(detailedFile)) if (!r.error) detailed.set(r.id, { ...r, arm: "detailed" });

const ids = [...oldGeneric.keys()].filter((id) => detailed.has(id)).sort();
const paired = ids.map((id) => ({ id, g: oldGeneric.get(id)!, d: detailed.get(id)! }));
const missingDetailed = [...oldGeneric.keys()].filter((id) => !detailed.has(id));

const auroc = (pos: number[], neg: number[]): number => {
  if (!pos.length || !neg.length) return NaN;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
};

// Case-level paired bootstrap for the AUROC difference.
function deltaAurocCI(g: typeof paired, iters = 2000): [number, number] {
  const succ = g.filter((r) => r.g.outcome === "success");
  const fail = g.filter((r) => r.g.outcome === "failure");
  let seed = 987654321;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const draws: number[] = [];
  for (let i = 0; i < iters; i++) {
    const s = Array.from({ length: succ.length }, () => succ[Math.floor(rnd() * succ.length)]);
    const f = Array.from({ length: fail.length }, () => fail[Math.floor(rnd() * fail.length)]);
    draws.push(
      auroc(s.map((r) => r.d.score!), f.map((r) => r.d.score!)) - auroc(s.map((r) => r.g.score!), f.map((r) => r.g.score!))
    );
  }
  draws.sort((a, b) => a - b);
  return [draws[Math.floor(iters * 0.025)], draws[Math.floor(iters * 0.975)]];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (xs: number[]) => (xs.length ? `${(mean(xs) * 100).toFixed(0)}%` : "n/a");

const armStats = (rows: Row[]) => {
  const succ = rows.filter((r) => r.outcome === "success");
  const fail = rows.filter((r) => r.outcome === "failure");
  const findings = rows.flatMap((r) => Object.values(r.roles ?? {}).flatMap((o) => o.findings ?? []));
  const parseType = (s: string) => s.match(/^[^/]+\/[^/]+\/([A-Z_]+):/)?.[1] ?? "?";
  const parseSev = (s: string) => s.match(/^([A-Z]+)\//)?.[1] ?? "?";
  const byType: Record<string, number> = {};
  for (const f of findings) byType[parseType(f)] = (byType[parseType(f)] ?? 0) + 1;
  const grounded = ((byType["STATED_INPUT"] ?? 0) + (byType["COMPUTATION"] ?? 0)) / (findings.length || 1);
  const fatalMajor = findings.filter((f) => parseSev(f) !== "MINOR");
  return {
    n: rows.length,
    meanScore: mean(rows.map((r) => r.score!)),
    auroc: auroc(succ.map((r) => r.score!), fail.map((r) => r.score!)),
    falseKillOnSuccess: pct(succ.map((r) => (r.verdict === "KILL" ? 1 : 0))),
    nonKillOnFailure: pct(fail.map((r) => (r.verdict !== "KILL" ? 1 : 0))),
    buildStarOnFailure: pct(fail.map((r) => (r.verdict === "BUILD" || r.verdict === "BUILD_IF_VALIDATED" ? 1 : 0))),
    hitRate: mean(rows.map((r) => (r.expected.includes(r.verdict as never) ? 1 : 0))),
    verdictMix: rows.reduce((m, r) => ({ ...m, [r.verdict!]: (m[r.verdict!] ?? 0) + 1 }), {} as Record<string, number>),
    findingsPerRun: findings.length / (rows.length || 1),
    groundedEvidenceShare: grounded,
    findingTypes: byType,
    nonMinorShare: fatalMajor.length / (findings.length || 1),
    meanRating: mean(rows.flatMap((r) => Object.values(r.roles ?? {}).map((o) => o.rating ?? NaN)).filter((x) => !isNaN(x)))
  };
};

const g = armStats(paired.map((p) => p.g));
const d = armStats(paired.map((p) => p.d));
const [dLo, dHi] = deltaAurocCI(paired);

const mcNemar = paired.reduce(
  (m, p) => {
    const gh = p.g.expected.includes(p.g.verdict as never);
    const dh = p.d.expected.includes(p.d.verdict as never);
    if (!gh && dh) m.improved++;
    if (gh && !dh) m.worsened++;
    return m;
  },
  { improved: 0, worsened: 0 }
);

const dscores = paired.map((p) => ({ id: p.id, outcome: p.g.outcome, delta: p.d.score! - p.g.score!, gv: p.g.verdict, dv: p.d.verdict }));
const flipped = dscores.filter((r) => r.gv !== r.dv);

console.log(`Paired cases: ${paired.length} (${paired.filter((p) => p.g.outcome === "success").length} success, ${paired.filter((p) => p.g.outcome === "failure").length} failure)`);
if (missingDetailed.length) console.log(`WARNING: no detailed row for ${missingDetailed.join(", ")}`);
const staleRoles = paired.filter((p) => p.d.llmRoles !== 6);
if (staleRoles.length) console.log(`WARNING: detailed rows without 6 live LLM lanes: ${staleRoles.map((p) => p.id).join(", ")}`);

const w = (label: string, a: unknown, b: unknown) => console.log(`${label.padEnd(28)} generic=${String(a).padEnd(12)} detailed=${b}`);
w("AUROC (score)", g.auroc.toFixed(2), `${d.auroc.toFixed(2)}  (Δ ${(d.auroc - g.auroc).toFixed(2)}, CI ${dLo.toFixed(2)} to ${dHi.toFixed(2)})`);
w("Mean score", g.meanScore.toFixed(1), d.meanScore.toFixed(1));
w("Successes killed", g.falseKillOnSuccess, d.falseKillOnSuccess);
w("Failures not killed", g.nonKillOnFailure, d.nonKillOnFailure);
w("Failures BUILD/BIV", g.buildStarOnFailure, d.buildStarOnFailure);
w("Verdict hit rate", `${(g.hitRate * 100).toFixed(0)}%`, `${(d.hitRate * 100).toFixed(0)}%`);
console.log("Verdict mix      generic=", g.verdictMix, " detailed=", d.verdictMix);
console.log(`McNemar on verdict hits: improved ${mcNemar.improved}, worsened ${mcNemar.worsened}`);
w("Findings per run", g.findingsPerRun.toFixed(1), d.findingsPerRun.toFixed(1));
w("Grounded evidence share", `${(g.groundedEvidenceShare * 100).toFixed(0)}%`, `${(d.groundedEvidenceShare * 100).toFixed(0)}%  (STATED_INPUT+COMPUTATION)`);
w("Non-MINOR finding share", `${(g.nonMinorShare * 100).toFixed(0)}%`, `${(d.nonMinorShare * 100).toFixed(0)}%`);
w("Mean lane rating", g.meanRating.toFixed(2), d.meanRating.toFixed(2));
console.log("\nFinding evidence types  generic:", g.findingTypes, "\n                       detailed:", d.findingTypes);

console.log("\nVerdict flips (generic -> detailed):");
for (const f of flipped.sort((a, b) => a.outcome.localeCompare(b.outcome))) {
  console.log(`  ${f.outcome.padEnd(8)} ${f.id.padEnd(30)} ${f.gv} -> ${f.dv} (score ${f.delta > 0 ? "+" : ""}${f.delta})`);
}

console.log("\nLoot Drop (real failures) only:");
const lRows = paired.filter((p) => p.id.startsWith("L-"));
w("  not killed", pct(lRows.map((p) => (p.g.verdict !== "KILL" ? 1 : 0))), pct(lRows.map((p) => (p.d.verdict !== "KILL" ? 1 : 0))));
w("  mean score", mean(lRows.map((p) => p.g.score!)).toFixed(1), mean(lRows.map((p) => p.d.score!)).toFixed(1));
