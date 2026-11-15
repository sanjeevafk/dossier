# Evaluation: what Dossier can and cannot claim

This page records how the verdicts were measured and what the numbers say. It is meant to be read before trusting a score.

## Method

- **Cases:** `src/evaluation/` holds 197 ideas written as neutral founder pitches (no outcome, no cause of death). They come from four sources:
  - 16 early cases written by the maintainer. These contain hindsight cues in the text and are kept out of the frozen test split.
  - 68 cases written by the maintainer from well-known analogues (30 failures, 30 successes, 8 ambiguous). Titles are invented.
  - 55 real shut-down startups sampled from loot-drop.io (a directory of failures), re-written as neutral pitches. Failures only.
  - 58 real Y Combinator companies (2005-2016 batches) from github.com/yc-oss/api: 28 dead ("Inactive") and 30 survived ("Active"/"Public"/"Acquired") from the same directory, pitches re-written neutrally with invented codenames by an LLM that never sees the outcome (`scripts/build_cases_from_yc.ts`). The only source with both outcomes from one provenance chain.
- **Split:** deterministic by case id: ~40% dev, 30% validation, 30% frozen test. Tune on dev, set thresholds on validation, run test once at release (`--final`).
- **Runner:** `pnpm eval -- --split dev` (full pipeline) and `--baseline` (one plain prompt, no swarm). It reports 95% confidence intervals.
- **Model:** Meta `muse-ember-1.0`, temperature 0.2 for agents.

## Results (dev split, one run of the current 89-case dev set: 28 successes, 55 failures, 6 ambiguous)

| | One-prompt baseline (27-case set) | Full pipeline |
|---|---|---|
| Score AUROC, success vs failure | 0.40 (CI 0.19 to 0.62) | **0.63 (CI 0.50 to 0.75)** |
| Successes wrongly killed | 100% | 36% (CI 21 to 54%) |
| Failures not killed | 13% | 64% (CI 50 to 75%) |
| Verdict mix | 25 KILL / 7 REFINE / 1 BUILD_IF_VALIDATED | 30 KILL / 59 REFINE |

Per source, same run (AUROC needs both classes, so Loot Drop has no AUROC):

| Source | n | AUROC | Successes killed | Dead not killed |
|---|---|---|---|---|
| YC directory | 16 S / 15 F | 0.80 (CI 0.63 to 0.94) | 3/16 | 8/15 |
| Hand-written analogues | 12 S / 15 F | 0.63 (CI 0.41 to 0.82) | 7/12 | 7/15 |
| Loot Drop (failures only) | 25 F | — | — | 20/25 |

No individual role or dimension separates the groups reliably (best single lane earlier: 0.68).

### What to make of the YC number

- **The dev reading did not survive its out-of-sample check.** Pre-registered before running: the dev AUROC only counts if the YC val split (12 cases, 3 S / 9 F) confirms AUROC ≥ 0.60. Measured: **0.11 (CI 0 to 0.39) — the direction inverted** (dead companies scored higher, 53.3 vs 46.7). Pooled YC dev+val: 0.64 (CI 0.47 to 0.80), which still includes chance.
- So the dev 0.80 was small-sample noise, not signal: random 30-case subsamples of a noiseless process can read 0.8 one way and 0.11 the other. The verdict remains a rough screen on real YC pitches too. The val split is now spent for this question; the frozen test split (15 YC cases) stays untouched for release.
- Run-to-run variance compounds this: the same pipeline killed 33% of hand-written successes in one run and 58% in another. Single-run numbers with n < 50 should not be quoted as findings, including the ones above.
- Why it might still be *closer* to signal than the hand-written set is an open question, not a finding: real pitches describe the actual mechanism, and many dead 2005-2016 YC companies were small ideas whose pitches read weak.
- Label caveats: "Inactive" is usually but not always death; "Acquired" includes acqui-hires; some directory descriptions were updated after growth, which the rewrite prompt strips ("leading/trusted" are banned words), and a famous company may still be recognizable from its description despite the invented codename.
- The YC survivors that were killed were killed for being textually weak ("no budget buyer as stated", "bypasses the frontline workers") — the same text-vs-execution gap as before, now visible on real successes.

## Earlier result, kept for the record

The first 16 cases measured AUROC 0.83, but their failure text carried its own cause of death; that number is leakage and should not be quoted. The one-prompt baseline on the early dev set killed almost everything (0.40 AUROC).

## Known limits of this evaluation

- Small n: the dev split has 83 labelled cases; intervals are wide. The frozen test split is smaller still.
- Labels are judgments about outcomes of historical companies. They carry survivorship bias, and several "successes" now face strong incumbents, so a modern KILL can be defensible.
- Pitches were written or re-written by an LLM that did not know the outcome (Loot Drop, YC) or by the maintainer who did (early + analogue cases). Subtle hints may remain in both.
- Loot Drop has failures only; YC is the only source where both outcomes share one provenance chain.
- A dead startup is not always a bad idea at inception, so Loot Drop cases accept REFINE as well as KILL.

## Specificity experiment: does founder detail improve the verdict? (dev split, paired, n = 50)

Same 50 labelled dev cases (12 successes, 38 failures) run twice: once as written (generic) and once with founder-stated specifics appended (geography, wedge, channel, stated CAC/retention/cost numbers). Variants follow pre-registered symmetric rules and were written by the maintainer, who knows the labels — treat as directional. `scripts/run_specificity_eval.ts`, `scripts/analyze_specificity.ts`.

| | Generic | Detailed |
|---|---|---|
| Score AUROC | 0.41 | 0.64 (Δ 0.23, paired CI 0.03 to 0.44) |
| Successes killed | 33% | **0%** |
| Failures not killed | 71% | 82% |
| Loot Drop failures not killed | 72% | 84% |
| Findings grounded in stated inputs (STATED_INPUT+COMPUTATION) | 46% | 62% |

What this shows:

- **Specificity stops false kills but waves through more real failures.** All 12 successes survived with stated wedges and numbers (4 had been killed); real failures passed more often (82% vs 71%). The verdict partly tracks how articulate and confident the pitch is, not the idea's fate — a doomed-but-confident founder produces exactly the detail that defuses the kill rules.
- **Findings do get more concrete**: findings citing the founder's own numbers rose from 46% to 62%, and reasoning-only/precedent findings fell. Stated numbers make the cheapest tests specific.
- The verdict remains a rough screen (AUROC 0.64 with a wide interval, still below any useful bar). The actionable claim is about findings, not the verdict.

## Evidence search: name collisions and concept queries

Recon used to search the idea's (often invented) brand name. That surfaced unrelated real entities with the same name — in a dev run an invented "WashLoop" surfaced a real Milan laundry, which an agent nearly cited as an identical-name competitor. Two changes (`src/tools/search.ts`): a second, brand-free concept query built from what the idea does and for whom, and an entity-relevance filter that drops results matching the idea's name but none of its mechanism words (dropped items are reported in the dossier).

Measured on 10 labelled dev cases, live Exa, precision@5 under a mechanical relevance proxy (≥2 summary terms in the result; a lower bound, since paraphrases score 0): old-style 17%, new style 21%, with every name-collision result in the sample removed. Fixture suite incl. the "Asha Health" clinic collision: `test/evidence_quality.test.mjs`; measurement: `scripts/precision_search_eval.ts`.

## What would make this trustworthy

1. Blind rewrites of the pitches by someone who does not know the outcomes, and a second person checking the labels.
2. A source of verifiable successes with their original pitch.
3. Human grading of findings quality (are the cited facts real, is the cheapest test sensible).
4. A real outcome ledger: record what founders actually did and what happened, then calibrate.
