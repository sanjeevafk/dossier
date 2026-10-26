# Dossier — Path to an Exceptional, Defensible Product
**Date:** 2026-10-25 | **Context:** indie / small team, low budget | **Premise:** sharpen current wedge, no pivot
**Codebase snapshot:** `feat/streaming-and-score-hardening` — `src/core/swarm.ts:IdeaSwarmOrchestrator.evaluateIdea()`, 6 roles + R1/R2 crossfire + `StanfordRobustVerifier` + Numpy Monte Carlo + SSE/MCP/CLI

---

## 1. What exists today — truth table

### 1.1 What Dossier actually is
Tagline says “Make AI try to kill your idea before the market does” (`README.md:7`, `ARCHITECTURE.md:3`). Implementation truth: **adversarial idea-intelligence dossier generator** for pre-build founders. Input `title+summary+audience+monetization+pricing/cac` (`src/types/index.ts:271-326`) → output `killScore 0-100 + BUILD|BUILD_IF_VALIDATED|REFINE|KILL + 5-dim breakdown (feasibility 20% / demand 25% / economics 20% / moat 15% / adversarial 20%) + 7-tier epistemic feed + killConditions + cheapest $0/4-day experiment + approvalGates + mutations if <55`.

Target user inferred from code, not marketing: **solo founder / indie hacker / hackathon team deciding BUILD/KILL in <10 min** (`src/cli.ts:16`, `README.md:109`, `docs/INVESTIGATION_RUNS.md:86-103` SwaraSetu `SIH26133`). Secondary: B2G/HealthTech/Hardware proposal reviewers who need procurement/regulatory priors (`src/core/classifier.ts:7-243` — 8 archetypes with tailored `primaryCustomer/procurementCycle/regulatoryEnvironment/unitEconomicsModel`).

### 1.2 Architecture (verified)
```
CLI(src/cli.ts) ─┐
Web(public/index.html 1947 lines) → Express+SSE(src/server.ts) ─→ IdeaSwarmOrchestrator(src/core/swarm.ts:729 evaluateIdea)
MCP-stdio(src/mcp-server.ts) ──────┘  ├ classifyIdeaDomain(classifier.ts) → 8 archetypes
                                       ├ 6× generateAgentTurn(llm.ts failover gemini→openai→orcarouter→local→agy-cli) + Zod schema
                                       ├ parallel recon: search.ts(Exa/Tavily) + community.ts(HN Algolia, Reddit/RDT + X/CLI bridges) + polymarket.ts(Gamma)
                                       ├ 2× runEconomicsSimulation(sandbox.ts → scripts/simulate_monte_carlo.py 10k Numpy runs)
                                       ├ debate.ts R1 + swarm.ts:258 R2 crossfire + verifier.ts + claim DAG
                                       └ composite + kill-ceilings + mutator.ts if <55 → storage.ts(reports/dossier_*.json 464 files) + Markdown export
```
APIs: `GET /health`, `POST /api/evaluate|/stream(SSE)`, `GET /api/dossiers[/:id/export]`, `POST /api/approval/:actionId` (only authed route), `POST /api/chat` (`src/server.ts:49-356`). MCP: 8 tools `evaluate_idea|stress_test|run_sandbox|verify_claims|list|get|export|update_approval` (`src/mcp-server.ts:60-208`). Dockerfile `node:22-slim+python3`, `render.yaml: free/oregon/docker`, canonical live `https://dossier-ai.azurewebsites.net Azure B1` (`README.md:13-15`).

### 1.3 Working vs prototype vs placeholder vs broken

**Working (tested: 7 `test/*.mjs`, `docs/BENCHMARK_RESULTS.md 93% fit σ20.5`, `docs/STRESS_TEST_RESULTS.md 5/5 PASS`, 464 `reports/`):**
- Full evaluate loop offline+live. Honest `evaluationMode: LIVE_LLM|HEURISTIC_ENGINE` (`src/types/index.ts:279`).
- Verifier+DAG real: `verifier.ts:54-282` math-invariance (`investor>85 & p50<3.0 → 62`), anti-sycophancy (`≥90 → 84`), prior-leakage fix, RedTeam non-empty, epistemic relabel, `DAG_DEPENDENCIES EV-06→[EV-01,EV-07], EV-08→[EV-05,EV-07]` with fixpoint cascade. Branding “Stanford CS329A” is label only — no Stanford code.
- Sandbox real: `sandbox.ts:40-154` sanitizes, `mkdtemp(/tmp/trueforge-sandbox-*)`, `exec python3 script inputs.json timeout 20s`, fallback `fallback-embedded-sandbox`. `simulate_monte_carlo.py:42-180` vectorized Numpy percentiles/survival/insolvency/sensitivity.
- Debate real but minimal: `debate.ts` R1 always 3 clashes (`redteam→investor, customer→architect, redteam→customer`) quoting actual `flawOf()+claimOf()`, `statusFromGap>20→REBUTTED else OPEN`; LLM director tried first if `hasLiveLLM`. R2 `swarm.ts:258-381` top-vs-bottom if `spread>25||redteam<45||OPEN`, with `crossfireToolTraces` as formatted strings of the two pre-computed sims + recon list. No autonomous ReAct tool calls.
- Mutator real deterministic: `mutator.ts:31-85` always 3 `WEDGE|INVERSION|TROJAN` with `pricing*1.4 / *12*0.9 / *1.2` interpolations if `<55`. No LLM, no re-eval loop.
- Polymarket real honest: `polymarket.ts:30-106` Gamma API, 4s abort, token-overlap filter (`len≥4`), skip unparseable odds (no fake 50%), usually `marketsFound:[]`.
- Recon real if keyed: `recon.ts:94-144` Exa/Tavily, 8s timeout, else `provider:none`. `community.ts:159-183` HN Algolia zero-key working; Reddit via `opencli rdt`, X via `twitter-cli` login-walled → usually `none`. Never synthetic — correct.
- Storage/list/get/export/CLI/SSE/MCP evaluate paths all work.

**Prototype (heuristic/canned):**
- Heuristic opinions when no LLM (`swarm.ts:387-723`) — deterministic, intentionally non-intelligent but testable.
- `/api/chat` offline fallback canned per-role (`server.ts:292-355`); TAM `$xB` formula (`simulate_monte_carlo.py:158-166`); sensitivity tornado (broken probe — see below).

**Placeholder / not done (`docs/IMPROVEMENT_PLAN.md:184-188` Phase 4 unchecked):**
- Validation-kit (landing+emails), Synthetic Buyer Lab, real outbound actions — drafts only. Approval gates persist `APPROVED|REJECTED` (`server.ts:202-224`, `mcp-server.ts:455-480`, `storage.ts:158-173`) but side-effects stubbed (`PILOT_LOI_DRAFT+SMOKE_TEST` always `PENDING_HUMAN_APPROVAL` `swarm.ts:1402-1428`).
- `src/tools/mcp.ts:DossierMCPManager` connects to `dossier.mcp.json` but **never called by swarm**. `dossier.mcp.json:29-33 curl polymarket-oracle` is not MCP. TrueForge SDK dep present, zero imports — branding/bloat.
- README lists “Skeptic/Investor/Architect/Market/Customer/Founder” (`README.md:64-70`); code is Analyst/Customer/Architect/Investor/RedTeam/Expert+Synthesizer (`src/config/prompts.ts:12-84`).

**Broken — fix first (reproducible):**
1. `Dockerfile` omits `scripts/` + `pip numpy` → prod always `fallback-embedded-sandbox`. `COPY src/ public/ dossier.mcp.json` but no `COPY scripts/`. `apt python3` without `pip install numpy`. `render.yaml` only wires `ORCAROUTER_API_KEY`; `GEMINI/OPENAI/EXA/TAVILY/LOCAL_LLM/DOSSIER_API_KEY/ALLOWED_ORIGINS` from `.env.example` not wired.
2. `reports/` ephemeral on Render free / single instance, no disk. `storage.ts:21 Map + reports/*.json`, `list()` re-reads dir + sorts. No TTL/LRU/Redis, no locking/atomic write. Lost on restart/sleep.
3. Auth broken: only `POST /api/approval/:actionId` checks `Bearer DOSSIER_API_KEY` (`server.ts:33-44` with loopback bypass); `evaluate/chat/list/get/export` open. UI `handleApprovalAction() (public/index.html:1849 fetch without Authorization)` → 401 in prod if key set.
4. No queue/rate-limit/helmet. `evaluateIdea` blocks event loop (2×10k MC + 6×LLM + debate). SSE helps UX but no job-id/cancel/concurrency limit → burst `test/stress-test.ts:BURST_CONCURRENCY` can starve `free` instance. No `express-rate-limit`, no `helmet`, no `pino`, no req-id/metrics/Sentry.
5. `BUILD` verdict unreachable. `swarm.ts:1279-1294`: `≥75` requires `!hasUnvalidatedFatalAssumptions && !hasUnresolvedUnknownsOrContradictions`, but `hasUnvalidatedFatalAssumptions = modelledAssumptions>0 || redteam<50` and `modelledAssumptions>0` by construction (EV-05 always present) → always `BUILD_IF_VALIDATED` at best. Benchmark normalizes `BUILD_IF_VALIDATED→BUILD` (`benchmark.ts:298`) to claim 93% fit — circular.
6. Classifier fragile: `classifier.ts` pure `text.includes()` order-dependent; `chat|consumer|extension` hits `consumer_social` before `b2b_saas`; `research+saas` forced to `b2b_saas`; duplicate `consumer_social` branch dead code (second `if` unreachable).
7. Tornado `token_cost` probe broken: `simulate_monte_carlo.py:p50_ratio_with_param` re-samples `churn_std` with `data.get(name)` where `name==token_cost` misses, and `probe[token_cost]` never affects `margin_p` (margin uses `pricing_monthly` only). Ranking is noise.
8. TAM unvalidated: `(pricing*12*500k|5M)/1e9` heuristic, no source.
9. `public/index.html` 1947-line single file, Tailwind-CDN + vanilla JS, `prompt()` for custom concept (`:949`), global `window.*Id`, no router/offline. Chat unsaved/unstreamed.
10. `confidenceScore = clamp(composite+10,65,95)` (`swarm.ts:1296`) — not calibration, just offset.

Strengths to keep: kill-ceilings + Zod + fatal anchoring (`swarm.ts:50-58 invariants, :72-75 WRAPPER_KILL_CEILINGS, :1172 anchor`), honest `dataSource:none`, numeric clamp + file-only exec + `tmp rm`, 7-tier epistemics, SSE HUD + canvas, 7 test files.

---

## 2. Killer-product thesis (sharpen, don’t pivot)

**Primary user:** pre-build founder / indie hacker / hackathon team with <10 min to decide BUILD/KILL and < $50 to test. They don’t need another “AI business plan generator.” They need **permission to kill** with evidence they can show a co-founder.

**Painful problem:** sycophantic LLM validation (“great idea! here’s your GTM”) + generic reports with no falsifiable next step. Existing validators score vibes; founders still build the wrong thing for 3 months.

**Why choose Dossier:** only tool that (a) is adversarial by construction (RedTeam can force KILL, `STRONG_KILL` veto `swarm.ts:1273-1277`), (b) separates computation from assumption (Exit 0 ≠ validated CAC), (c) ends every dossier with a $0/4-day commitment test + 3 kill-conditions, not a todo list.

**Strongest wedge (keep):** zero-sycophancy dossier in one click — paste idea → 6-agent crossfire → Monte Carlo survival curve → “if 10 buyers all decline LOI in 14 days, KILL.” Time-to-value <90s heuristic, <4 min live. CLI+MCP distribution (agent skill `skills/dossier/SKILL.md`) amplifies this: any agent can call `evaluate_idea`.

**Long-term moat (build now, cheap):** **calibration ledger** — predicted `killScore` vs actual outcome (built/killed/pivot + 90-day revenue/pilot). Nobody in this category publishes Brier/ECE. Second moat: **evidence provenance graph** (every claim → URL + tier + DAG parent). Third: **cost moat** — heuristic-first <$0.10/run vs competitors’ GPT-4-everything.

**“Can’t go back” moment:** founder runs 3 ideas in 20 min, kills 2 with cited competitor threads + insolvent P10 tail, and ships the third’s LOI test same afternoon. The dossier becomes the pre-mortem they attach to every pitch.

**What NOT to build:** B2B diligence SaaS pivot (Harmonic/CB Insights territory — needs sales team + proprietary data), outbound email/landing auto-deploy, Telegram bot, full PDF suite, TrueForge SDK until needed. API/MCP is distribution, not a new product.

**Positioning fix:** change README hero from “Adversarial multi-agent platform” to “Kill bad ideas in 10 minutes — with cited evidence and a $0 test.” Rename `killScore` in UI to `Resilience Score` (killScore frustrates; resilience invites action) while keeping KILL verdict blunt.

---

## 3. Competitive landscape — where Dossier wins

### 3.1 AI idea validators (direct)
**ValidatorAI** — freemium single-model feedback + scores + trend tools. FAQ documents scoring/numbers/data sources. Strength: instant, free, familiar. Weakness: single-pass LLM, no sandbox math, no provenance, no kill-conditions. Users praise speed; complain generic “AI slop” advice. Pricing freemium, custom enterprise quotas on official site. Dossier wins on adversarial veto + Monte Carlo + citations. [ValidatorAI FAQ](https://validatorai.com/faq) · [ValidatorAI review](https://aitoolranks.com/app/validator-ai/) · [Pricing & alternatives](https://www.stork.ai/en/validatorai)

**IdeasAI / Validly / Checkmyidea / ValidateStrategy / IdeaProof / Preuve AI / WorthBuild** — 2026 roundups compare 8 tools on accuracy/speed/pricing with published test protocol; consensus: most validators “agree with you” instead of scoring against live evidence (complaints, revenue, demand signal). Multi-agent validation (ValidateStrategy) marketed as deeper than single-model. Dossier’s R1/R2 crossfire + verifier directly answers this gap — but must prove it with calibration, not claims. [8 Best AI Validation Tools 2026](https://ideaproof.io/best-ai-validation-tools-2026) · [Multi-agent validation](https://validatestrategy.com/validate/ai-idea-validation-tool) · [Best validators](https://validatestrategy.com/validate/startup-idea-validator) · [Live-web scoring](https://aiideavalidator.com/) · [Real signal vs noise (8-tool test)](https://bigideasdb.com/blog/ai-idea-validator-tools-2026)

**BigIdeasDB vs GummySearch vs IdeaBuddy vs Buildpad** — critical opening: **GummySearch shut down commercial ops Nov 2025, deletes all user data Dec 1 2026** (lost Reddit data access). It was the Reddit pain-point leader. BigIdeasDB now pitches as replacement (Reddit+G2+Capterra+app stores+Upwork, 1M+ complaints severity-scored, free to browse). IdeaBuddy = planning canvas; Buildpad = builder. Users want severity-ranked complaints + revenue-adjacent signal, not keyword counts. Dossier already has HN Algolia zero-key + token-relevance filter — extend to severity-ranked Reddit via public datasets + BigIdeasDB-style complaint mining, don’t rebuild GummySearch. [IdeaBuddy vs GummySearch](https://ideahunter.today/compare/ideabuddy-vs-gummysearch-for-startup-research) · [BigIdeasDB vs GummySearch](https://bigideasdb.com/help/bigideasdb-vs-gummysearch) · [GummySearch shutdown alternatives](https://dev.to/appierun/gummysearch-alternatives-in-2026-tools-for-finding-reddit-leads-after-the-shutdown-582c) · [Shutdown notice](https://www.subredditsignals.com/blog/subreddit-signals-vs-gummy-search-real-demand-in-2026) · [GummySearch alternative](https://bigideasdb.com/gummysearch-alternative)

### 3.2 Market-research AI (infrastructure Dossier uses)
**Exa vs Tavily vs Perplexity Sonar vs Linkup/You.com** — 2026 dev comparisons normalize pricing/latency/ownership with Full/Fast/Index picking framework. Tavily Extract + Exa neural search are agent-RAG standards; Perplexity Sonar is cited-answer API. All charge per-query (see per-1k/10k/100k tables). Implication for Dossier: keep Exa+Tavily (already wired `recon.ts:94-144`), add 7-day SQLite cache + rerank to cut cost 5-10×, never call live per-agent-turn. [Exa vs Tavily vs Perplexity vs Linkup](https://serp.fast/guides/ai-search-apis-compared) · [Tavily vs Exa vs Perplexity (dev benchmarks)](https://www.humai.blog/ai-search-apis-compared-tavily-vs-exa-vs-perplexity/) · [Tavily vs Exa vs Perplexity vs You.com](https://www.humai.blog/tavily-vs-exa-vs-perplexity-vs-you-com-the-complete-ai-search-api-comparison-2025/) · [4-way shape/citation/latency](https://pixserp.com/blog/ai-search-api-comparison-2026) · [Per-query pricing at scale](https://awesomeagents.ai/pricing/search-api-pricing/)

### 3.3 Prediction signal (Dossier’s differentiator, keep honest)
**Polymarket (Gamma API) / Metaculus / Manifold** — Gamma provides markets/events/series + search; Dossier’s token-overlap filter + empty-means-no-evidence is correct (most ideas have no market). Don’t oversell “oracle.” Use for macro sentiment only when `marketsFound>0`, else explicit `UNKNOWN`. Competitors ignore prediction markets entirely — keep as cheap edge + kill-condition monitor (e.g., “AI agent regulation market >60% → compliance drag”). [Gamma markets/events/search](https://ocaml.org/p/polymarket/0.2.0) · [CLOB integration docs](https://nautilustrader.io/docs/latest/integrations/polymarket/)

### 3.4 VC-diligence automation (adjacent, do NOT chase)
**Harmonic.ai / CB Insights / PitchBook** — Harmonic finds companies at earliest formation, fresh/deep coverage, warehouse delivery, VC workflow (sourcing, alerts, tracking, people intelligence). CB Insights = enterprise strategy + analyst reports for board conversations. PitchBook = transactions/fund/LP/credit. All enterprise-priced (Harmonic custom; CB Insights $$$$). Users praise freshness (Harmonic) but complain coverage bias + price. They deliberately don’t do pre-idea kill-tests or $0 experiments. Dossier must not pivot here — no proprietary company graph, no sales team. [Harmonic vs CB Insights](https://harmonic.ai/blog/cb-insights-vs-harmonic) · [Harmonic vs PitchBook](https://harmonic.ai/blog/harmonic-vs-pitchbook) · [Harmonic pricing](https://harmonic.ai/pricing) · [Harmonic platform](https://harmonic.ai/) · [Harmonic review 2026](https://www.rings.ai/blog/harmonic-ai-review)

### 3.5 Red-team / multi-agent open-source
CrewAI / AutoGen idea-critics exist as templates, no evals, no economics, no ledger. Dossier’s packaging (CLI+MCP+skill+SSE HUD) + deterministic gates is already ahead; moat is calibration + provenance, not agent count.

**Gaps table — where Dossier can realistically outperform:**

| Competitor gap | Dossier move (indie-cheap) |
|---|---|
| Single-pass sycophancy, no veto | Keep RedTeam `STRONG_KILL` veto + anti-sycophancy cap; publish veto rate |
| No math, point LTV/CAC | Keep Numpy MC + P10/P50/P90 + survival curve; fix tornado/TAM, add cohort churn |
| No citations / fake sources | Keep `EXTERNAL_EVIDENCE` only when retrieved + URL list; add MiniLM rerank + NLI contradiction |
| No falsifiable next step | Keep $0/4-day LOI test + 3 kill-conditions; add experiment-kit export |
| No tracking / no learning | Add SQLite calibration ledger (score vs outcome) + kill-monitors — nobody does this |
| GummySearch shutdown leaves Reddit gap | Severity-ranked complaint mining via cached HN + public Reddit datasets, not live scrape |
| Enterprise diligence $$$$, slow | Stay pre-build, <10 min, heuristic free / pro $12 — don’t chase Harmonic |

---

## 4. Scientific foundations — only what earns its place

Prioritize strong evidence + cheap implementation + fits constraints. Mark speculative as Experimental.

### 4.1 Reference-class forecasting (MUST-HAVE — base rates beat vibes)
**What:** predict new project from outcomes of similar past projects, not fresh guess. Corrects optimism bias with empirical uplift. Developed by Kahneman & Tversky (prospect/decision under uncertainty), operationalized by Flyvbjerg for megaprojects, adopted by UK Treasury Green Book.
**Evidence:** strong across transport/cost-overrun literature; 2025 review agenda confirms principle while noting boundary conditions. Startup analogue: CB Insights failure reasons + SaaS churn/CAC benchmarks as reference classes per archetype.
**Limits:** needs honest reference class (don’t compare consumer social to B2G tender). Small N per archetype initially.
**Complexity S.** Data: public postmortems + benchmark suite + ledger. **Fit:** prepend domain base-rate to every dossier (e.g., “consumer AI wrappers: P50 LTV/CAC 0.8x, 30-day churn 12%”) and shrink heuristic scores toward it. Fixes TAM hand-wave + `BUILD`-unreachable arbitrariness.
[Reference-class forecasting method](https://pmstudycircle.com/reference-class-forecasting/) · [Wikipedia: comparison-class forecasting (Kahneman/Tversky)](https://en.wikipedia.org/wiki/Reference_class_forecasting) · [2025 promises/problems research agenda](https://www.tandfonline.com/doi/pdf/10.1080/09537287.2025.2578708) · [Flyvbjerg calculator (uplift method)](https://budgetoverrun.com/reference-class-forecasting)

### 4.2 Superforecasting + Brier / ECE calibration (MUST-HAVE — measure if scores mean anything)
**What:** Tetlock & Gardner: explicit probabilities + Fermi decomposition + Bayesian update + Brier-score tracking beats experts. Brier = mean squared error of probabilistic forecasts; ECE = binned |confidence − accuracy|; both standard in ML calibration literature (ICLR 2025 calibration guide: use Brier/LogLoss alongside ECE).
**Evidence:** IARPA tournaments; replication pool shows persistent individual skill. Calibration is designable (pre-commit probs, track over time).
**Limits:** needs outcomes; scores 0-100 must map to P(success) explicitly.
**Complexity S.** **Fit:** define `P(build-worthy) = killScore/100`, log every dossier + 90-day outcome in ledger, report Brier/ECE per archetype in `/metrics`. This single change makes Dossier scientifically defensible vs all validators above. Current `confidenceScore=composite+10` and `σ≥18` gate are not calibration — replace.
[Superforecasting reality check (small expert pool)](https://www.sciencedirect.com/science/article/pii/S0377221720306007) · [Superforecasting → Brier/Fermi/Bayes ledger](https://cuicaihao.github.io/posts/2026-05-05-superforecasting-naming-uncertainty-scoring-judgments/) · [Probability calibration drills + Brier](https://expectedvalue.co.uk/blog/probability-calibration-training/) · [Tetlock practices: pre-commit + track calibration](https://www.ideasthesia.org/superforecasting-tetlock/) · [Brier score (verification measure)](https://www.researchgate.net/publication/304924623_Superforecasting_The_Art_and_Science_of_Prediction_By_Philip_Tetlock_and_Dan_Gardner) · [ECE visual guide, ICLR 2025](https://iclr-blogposts.github.io/2025/blog/calibration/) · [ECE formula/MCE guide](https://www.analyticsvidhya.com/blog/2025/08/custom-loss-functions/)

### 4.3 Structured judgment / Delphi + aggregation (HIGH-LEVERAGE)
Cooke classical model / Delphi: independent estimates → reveal → revise → aggregate (median/trimmed mean) beats unstructured debate. Dossier’s 6 parallel opinions + R2 crossfire already approximates this; add **independent-first** (no shared recon summary before opinions — currently shared) + trimmed-mean composite check alongside weighted composite. Complexity S.

### 4.4 Cohort churn + survival economics (MUST-HAVE — fix MC realism)
**What:** SaaS churn via cohort retention tables + survival analysis (Kaplan-Meier / parametric), not flat `margin/churn`. LTV = Σ cohort margin; survival = P(cash>0) with growth + replacement dynamics.
**Evidence:** SaaS playbooks standard; Oct 2026 churn-modeling guide: survival vs GBDT vs transformers with cost/explainability tradeoffs — survival wins for small N/explainability (Dossier’s case).
**Limits:** needs churn-by-month assumption; keep 2-param (mean + decay) to stay explainable.
**Complexity M (1-2 days).** **Fit:** extend `simulate_monte_carlo.py` with `churn_decay` + cohort array; keep Numpy; add P10-tail kill rule. Fixes steady-state linearity + `starting_cash=3×worst-burn` arbitrariness — replace with explicit runway input.
[SaaS LTV/CAC golden ratio + churn cliff](https://www.revoptima.io/guides/ltv-cac-analysis) · [2026 CAC/churn/NRR medians](https://stealthagents.com/research/saas-startup-metrics-statistics-2026) · [Cohort churn tables + survival](https://www.glencoyne.com/guides/saas-churn-cohort-analysis) · [Survival vs GBDT vs transformers (Oct 2026)](https://saas-review-hub.contentwave.net/article/churn-modeling-for-saas-oct-2026-survival-gbdt-transformers) · [Cohort LTV beyond average](https://www.glencoyne.com/guides/ltv-saas-cohort-approach)

### 4.5 Monte Carlo + global sensitivity (KEEP, FIX)
Saltelli-style tornado currently broken (see §1.3.7). Fix probe to vary `token_cost_per_user` in margin (not dead `probe[token_cost]`), use Saltelli/Sobol indices via `SALib` later; for now correct one-at-a-time ±10% with fixed RNG seed. Complexity S.

### 4.6 Claim verification / NLI + provenance (HIGH-LEVERAGE)
FEVER (Supported/Refuted/NotEnoughInfo vs Wikipedia) + FEVER 2024 / AVeriTeC real-world fact-check pipeline: retrieve → sentence-select → NLI entailment. Use `bart-large-mnli`-class NLI to score `CONTRADICTED` (agent claim vs retrieved evidence) instead of hand rules. Never auto-mark `VERIFIED_FACT` from NLI — only demote to `CONTRADICTED`/`DISPUTED` + cite URL. Complexity M (ONNX/transformers.js or HF API, cached).
[FEVER task (3-stage method)](https://www.emergentmind.com/topics/fever-fact-verification-task) · [FEVER 2024 + AVeriTeC shared task](https://aclanthology.org/2024.fever-1.0.pdf) · [3-stage retrieval-augmented pipeline](https://github.com/minko186/fact-verification-pipeline) · [FEVER dataset benchmark](https://www.emergentmind.com/topics/fever-dataset) · [FEVER 2024 proceedings](https://aclanthology.org/events/ws-2026/)

### 4.7 What NOT to import (speculative for indie)
Full causal DAG/Bayesian network over claims (2-edge DAG is fine; general causal discovery needs data you don’t have → Experimental). LLM-as-judge without human labels (circular; current self-authored expected verdicts already circular). Giant FM per problem (cost/latency kill the <$0.10 heuristic edge).

---

## 5. Scoped models you can actually integrate

Prefer small, composable, CPU-friendly. Keep current LLM-failover + heuristic-first (cost control).

| Model / API | Capability | Acc/latency | Inputs→outputs | Size/compute/cost | License/privacy | Integration | Verdict |
|---|---|---|---|---|---|---|---|
| `sentence-transformers/all-MiniLM-L6-v2` | idea→evidence bi-encoder matching | STS ~0.86, 5-15ms CPU, 22M params | query+passage → cosine | 80MB, CPU, $0 self-host | Apache-2.0, local (private) | Rank Exa/HN hits before LLM; cache embeddings in SQLite | **USE** — rerank recon, kill token-relevance hand filter |
| `cross-encoder/ms-marco-MiniLM-L6-v2` | rerank top-20 → top-6 | MRR@10 ~0.37 MS-MARCO, 20-40ms/pair CPU | (query,passage) → relevance | 80MB, CPU-batched | Apache-2.0, local | Second-stage rerank in `search.ts:38-70` | **USE** — biggest evidence-quality win for <$0 |
| `facebook/bart-large-mnli` (or `nli-deberta-v3-small` if VRAM-tight) | claim↔evidence entailment → contradiction score | MNLI ~0.90, 100-200ms CPU | (premise, hypothesis) → entail/neutral/contradict | 400MB (BART) / 100MB (DeBERTa-small), CPU ok | MIT/Apache, local | Score `EV-08 CONTRADICTED` in `verifier.ts`; threshold ≥0.75 + URL cite | **USE** (small variant) — replaces hand string checks |
| `spaCy en_core_web_sm` / `distilbert-NER` | competitor/entity extraction from recon | F1 ~0.85 CoNLL, <50ms | text → ORG/PRODUCT spans | 12MB, CPU | MIT/Apache, local | Populate `competitiveRisks[]` + kill-condition monitors | **USE spaCy-sm** — trivial, no GPU |
| Polymarket Gamma (keep) | macro sentiment when market exists | n/a (market data) | keyword → markets + pYes | $0, 4s timeout already | Public, no PII | Keep `polymarket.ts` filter; add monitor (poll weekly) | **KEEP** |
| Exa + Tavily (keep, cache) | live competitor/pricing evidence | Cited answers, $$ per query | query → passages + URLs | Per-query $ (see pricing tables) → cache 7-day | External (don’t send PII) | Wrap with SQLite cache keyed by normalized query | **KEEP + CACHE** — cuts recon cost 5-10× |
| Plausible self-host | funnel analytics (eval→export→LOI click) | n/a | events | $0, 1 container | AGPL/self-host, privacy-friendly | Replace UptimeRobot-only observability | **USE** when >100 runs/mo |

Latency budget: MiniLM+cross-encoder+NLI-small ≈ 300-500ms CPU added to 1.4s heuristic run — acceptable. No GPU spend. All local models keep idea text private (vs sending to rerank APIs).
[MS-MARCO MiniLM cross-encoder](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2) · [Cross-encoders repo](https://huggingface.co/cross-encoder) · [SBERT MS-MARCO docs](https://www.sbert.net/docs/pretrained-models/ce-msmarco.html) · [Pretrained models index](https://www.sbert.net/docs/sentence_transformer/pretrained_models.html)

---

## 6. Ideal product — tiers

### Must-have (genuinely useful, indie-feasible)
1. **Fix prod + trust:** `Dockerfile COPY scripts/ + pip install numpy`, Render persistent disk (or SQLite `dossiers.db` + `reports/` volume), wire all `GEMINI/OPENAI/EXA/TAVILY/DOSSIER_API_KEY/ALLOWED_ORIGINS`, remove `@truefoundry/trueforge-sdk` import-or-drop, `helmet+express-rate-limit`, auth all mutating reads + send `Authorization` from UI.
2. **Make BUILD reachable + calibrated:** replace `hasUnvalidatedFatalAssumptions` (always true) with `fatalAssumptions = modelledAssumptions tagged FATAL && untested`; map `P(success)=killScore/100`; show base-rate per archetype (reference-class) next to score.
3. **Cohort-aware MC:** add `churn_decay + cohort` + runway input; fix tornado probe + TAM (cite source or label `UNKNOWN`); seed RNG for repro.
4. **Cited evidence:** every `EXTERNAL_EVIDENCE` shows URL + retrieved snippet; empty → explicit `UNKNOWN absence record` (already done — keep).
5. **Experiment-kit export:** Markdown + copy-paste LOI email + 10-interview script + kill-threshold tracker (file export, no auto-send).

### High-leverage (major value / differentiation per eng-day)
- **Calibration ledger** (`better-sqlite3`: `dossiers + outcomes`): log score/dims/archetype/mode → 30/90-day outcome (killed/built/pivot + revenue/pilots). Publish Brier/ECE per archetype on `/metrics`. This is the moat.
- **Rerank + NLI contradiction** (§5): replaces token-overlap + hand `includes("freemium")` checks.
- **Cached recon** (SQLite 7-day TTL, normalized query key): 5-10× cost cut, enables free heuristic tier.
- **Job queue** (`p-queue` single-process + job-id/cancel/progress): fixes burst starvation without Redis/BullMQ.

### Differentiators (hard to copy quickly)
- **Kill-condition monitors:** weekly poll Polymarket/HN for tracked dossiers (“competitor launched”, “regulation market >60%”) → email/webhook. Cron + SQLite, no infra.
- **Falsifiability score:** % of claims with disproof threshold + URL. Display next to killScore.
- **Heuristic-first <$0.10/run:** advertise cost; competitors can’t match without rewrite.

### Experimental (prototype, don’t promise)
Buyer-lab (synthetic interviews), auto-landing deploy, full causal DAG, LLM-judge evals.

### Do not build
Outbound email/landing auto-send (liability + spam), Telegram bot, full PDF suite, TrueForge SDK integration, Postgres/Redis/S3 until >1k runs/mo, B2B diligence pivot.

---

## 7. Architecture — realistic, indie-first

**Keep now:** Express + `better-sqlite3` (replaces `reports/*.json` scan; keep JSON export) + single-process `p-queue` + `pino` logging + `/metrics` (Brier/ECE/veto rate/latency/cost). Static `public/` split from 1×1947 lines → `index.html + app.js + styles.css` (no framework needed yet).

**Add now (≤2 days each):** `helmet`, `express-rate-limit` (10 evals/IP/hr free), `Authorization` on all non-GET, job-id SSE (`POST /api/evaluate → {jobId}`, `GET /api/jobs/:id/stream`), SQLite recon cache, MiniLM rerank + NLI-small local (lazy-load, fallback to token filter if missing), `Dockerfile` fix + disk, Plausible/self-host or `console→pino`.

**Defer until scale:** Postgres (need >1k dossiers/mo + concurrent writes), Redis/BullMQ (need multi-instance), S3 (need >10GB reports), Sentry (need >500 users), K8s (never for indie).

**Science→arch map (ASCII):**
```
[idea] → [classifier+base-rates] → [parallel: Exa/Tavily(cache+MiniLM-rerank) | HN/Reddit | Polymarket | 2×Numpy-cohort-MC]
  → [6× opinions independent-first (LLM failover | heuristic)] → [R1/R2 crossfire] 
  → [NLI contradiction + verifier invariants + 2-edge DAG] → [trimmed-mean check + weighted composite + kill-ceilings + Brier-log]
  → [ledger SQLite + monitors cron + SSE dossier + experiment-kit]
```

**Security/privacy/cost:** sanitize→`execFile` (replace `exec` string interp `sandbox.ts`), clamp already good; never send idea PII to recon (strip names); local models = private; per-run cost meter in dossier footer (tokens + recon queries). Failure modes: LLM timeout → heuristic with `evaluationMode` label (already honest — keep); recon empty → `UNKNOWN` not fake; MC fail → `fallback-embedded` labeled (never silent).

---

## 8. Validate the science — skeptic’s checklist

| Capability | Measurable? | Success | Baseline | Benchmark/dataset | Experiment | Failure modes | Misleading/unsafe risks |
|---|---|---|---|---|---|---|---|
| killScore predicts build-worthiness | Yes — Brier/ECE | Brier <0.20, ECE <0.08 per archetype (N≥40) | ValidatorAI score / gut | Expand suite 14→40, blind-label expected verdicts (2 raters, no code access), track 90-day outcomes | A/B heuristic vs LIVE_LLM; veto-rate audit | Circular self-labels (current 93% fit), small N, σ≥18 arbitrary | High score ≠ guarantee — always show P + base-rate + kill-conditions |
| MC survival/LTV | Partial — backtest | P50 within 2× of postmortem CAC/churn | Flat `margin/churn` | 20 public postmortems with disclosed CAC/churn (Baremetrics/OpenStartups) | Cohort vs steady-state; tornado ablation (fixed seed) | `starting_cash` guess dominates survival; TAM formula | Insolvency curve ≠ bankruptcy advice — label assumption |
| Rerank+NLI evidence | Yes — precision | P@6 ≥0.70, contradiction F1 ≥0.75 | Token-overlap | 100 recon pairs human-labeled; FEVER-small + AVeriTeC-style startup sample | Ablate rerank on/off; threshold sweep 0.6-0.9 | NLI over-flags negations; slow CPU | NLI never promotes to VERIFIED_FACT |
| Crossfire adds value | Yes — spread/Δ | R2 reduces spread ≥30% or flips 1 verdict with cited tool trace | R1-only | 40-suite with/without R2 | Concede-rate vs score-drop correlation | Theatrical clashes (templated R1) — require quote + URL | Don’t show CONCEDED as truth, show as hypothesis |
| Classifier | Yes — accuracy | ≥0.85 on 100 labeled ideas | Current `includes()` | Hand-label 100 past dossiers | Confusion matrix; fix order → MiniLM classifier later | `chat` misroutes B2B → consumer (known) | Wrong archetype → wrong priors — show archetype + “change” button |

Immediate eval fixes: (1) stop normalizing `BUILD_IF_VALIDATED→BUILD` in fit calc; (2) replace `σ≥18` gate with Brier/ECE + veto-rate; (3) blind-label expected verdicts; (4) publish `BENCHMARK_RESULTS.md` with seed + mode (`LIVE_LLM` vs heuristic — current σ 20.5/20.5/20.5 identical implies heuristic, disclose it).

---

## 9. Roadmap — ruthless (Impact×Feasibility×Differentiation×Evidence)

**Immediate fixes (Days 1-14) — all S complexity, unblocks trust:**
- Dockerfile+env+disk+helmet+rate-limit+auth-UI fix. *I:9 F:9 D:5 E:10 → P0.* Deps: none. Payoff: prod runs real MC, no data loss.
- Make BUILD reachable (fatal-assumption tag fix) + show base-rate + P(success). *I:9 F:9 D:8 E:9 → P0.*
- Fix tornado probe + TAM label + seed RNG + `exec→execFile`. *I:7 F:9 D:6 E:9 → P0.*
- SQLite ledger schema + `/metrics` stub (log only). *I:10 F:8 D:10 E:9 → P0.* Enables moat.

**Next major (Days 15-45) — evidence quality:**
- Cached recon + MiniLM bi-encoder + MS-MARCO cross-encoder rerank. *I:9 F:7 D:9 E:8 → P1.* Deps: `better-sqlite3`. Payoff: citations founders trust.
- NLI-small contradiction + spaCy competitor extraction. *I:8 F:6 D:9 E:8 → P1.*
- Cohort MC + runway input + P10-tail kill rule. *I:8 F:6 D:8 E:9 → P1.*
- Job queue + SSE job-id + split `public/` + experiment-kit export. *I:8 F:7 D:7 E:7 → P1.*

**Research/prototypes (Days 30-90, time-boxed):**
- 40-concept blind benchmark + Brier/ECE report. *I:10 F:5 D:10 E:10 → P1.* Deps: 2 raters (founder + friend, 4h).
- Kill-monitors cron (Polymarket/HN poll). *I:7 F:6 D:9 E:6 → P2.*
- Buyer-lab prototype (5 synthetic interviews, labeled synthetic). *I:5 F:5 D:6 E:4 → P3 — do not ship as core.*

**Longer bets (post-90):** outcome ingestion (Stripe/revenue webhook), MiniLM archetype classifier, `SALib` Sobol indices, Postgres only if >1k/mo.

**Explicitly avoid:** outbound send, Telegram, PDF suite, TrueForge SDK, Redis/K8s, B2B pivot.

---

## 10. Final verdict + 90-day execution plan

**What this is today:** genuinely working adversarial validator with real sandbox math, honest empty-evidence handling, and deterministic kill-gates — wrapped in hackathon branding, broken prod deploy, and uncalibrated scores. Better than a demo, not yet a serious product.

**What it could become:** the cheapest trusted pre-mortem for indie founders — “paste idea, get kill-verdict + cited survival curve + $0 test in 10 min” — with the only published calibration ledger in the category. That’s defensible: data (ledger) + method (adversarial + provenance) + cost (heuristic-first).

**Biggest strengths:** (1) RedTeam veto + fatal anchoring (can’t average away kills), (2) Exit-0 vs assumption separation + 7-tier epistemics, (3) Numpy MC with percentiles (competitors do point math), (4) honest `none`/empty handling, (5) CLI+MCP+SSE distribution.

**Biggest weaknesses:** (1) scores uncalibrated (`BUILD` unreachable, `+10` confidence, σ-gate theater), (2) prod broken (Dockerfile/numpy, ephemeral disk, auth gaps), (3) evidence thin (no rerank/NLI, TAM/tornado wrong, classifier brittle), (4) no learning loop (no ledger/outcomes), (5) 2k-line frontend + docs/code drift (role names, TrueForge claims).

**Biggest technical risks:** free-tier starvation (no queue/limits) → add `p-queue`+limits now; `exec` interp + open evaluate → abuse → `execFile`+auth+limits now; disk loss → SQLite volume now. All cheap.

**Biggest product risks:** (a) founders don’t return after KILL (no retention) → fix with monitors + ledger + experiment-kit (reason to come back); (b) live-LLM cost kills free tier → keep heuristic default, live as Pro; (c) “AI validator” fatigue (everyone claims multi-agent) → differentiate with published Brier/ECE + cited URLs, not agent count.

**Strongest competitive advantage (today):** only tool combining adversarial veto + isolated stochastic economics + explicit unknown-handling in one dossier. **Durable advantage (build):** calibration ledger + provenance graph.

**3-5 changes most likely to transform it:**
1. SQLite ledger + Brier/ECE on `/metrics` (trust moat, 1 day).
2. Cached recon + MiniLM rerank + URL citations (evidence founders believe, 3-5 days).
3. Cohort MC fix + base-rates + reachable BUILD (scores mean something, 2-3 days).
4. Prod fix (Dockerfile/numpy/disk/auth/limits) + cost meter + $0 free / $12 pro (ship it, 1 week).
5. Kill-monitors + experiment-kit export (retention, 1-2 weeks).

**What makes it exceptional:** every dossier ends with “here’s the $0 test that would kill this, and I’ll watch the market for you.” Nobody does the second half.

**What prevents serious-product status:** uncalibrated scores presented as truth + lost data + generic evidence. Fix those three and it’s serious.

### 90-day plan (indie, ≤2 engineers, $0 GPU)

**Phase 1 — Trust & ship (Days 1-14).** Eng: Dockerfile (`COPY scripts/`, `pip install numpy`), Render disk + `better-sqlite3`, `helmet+rate-limit`, auth all + UI `Authorization`, `execFile`, job-id SSE via `p-queue`, split `public/`. Research: define `P(success)`, base-rates per archetype from postmortems; fix tornado/TAM/seed; tag FATAL assumptions so BUILD reachable. Experiment: re-run 14-suite in heuristic mode with seed, publish Brier (even if bad — honesty is the brand). Milestone: prod runs real MC, no data loss, `/metrics` live.

**Phase 2 — Evidence quality (Days 15-45).** Eng: SQLite recon cache (7-day), MiniLM + cross-encoder rerank, NLI-small contradiction (threshold 0.75, demote-only), spaCy competitors, cohort MC + runway, experiment-kit export. Research: label 100 recon pairs + 100 ideas for classifier; blind-label 40-suite expected verdicts. Experiment: ablate rerank/NLI/R2 crossfire; report P@6 + F1 + spread reduction. Milestone: cited dossiers with P10-tail kills; classifier ≥0.85.

**Phase 3 — Learning loop & monetize (Days 46-90).** Eng: ledger outcome ingestion (manual 30/90-day form + optional webhook), kill-monitors cron + email, pricing (`$0 heuristic / $12 pro live-recon`, cost meter), Plausible funnel, docs drift cleanup (roles, remove TrueForge SDK or wire it). Research: first Brier/ECE report per archetype; publish `docs/CALIBRATION.md`. Experiment: heuristic vs LIVE-LLM A/B on 40-suite; monitor precision (alerts that mattered). Milestone: 100 tracked dossiers, 1 calibration report, paying pro users covering recon costs.

**Kill criteria for the plan itself:** if Brier doesn’t beat ValidatorAIThumbnail-score baseline by Day 60, cut buyer-lab/monitors and double down on evidence quality. If recon costs >$0.30/run after cache, gate live-recon to Pro only.

---

## Sources
- [ValidatorAI FAQ](https://validatorai.com/faq)
- [ValidatorAI review](https://aitoolranks.com/app/validator-ai/)
- [ValidatorAI pricing & alternatives](https://www.stork.ai/en/validatorai)
- [8 Best AI Validation Tools 2026](https://ideaproof.io/best-ai-validation-tools-2026)
- [Multi-agent validation](https://validatestrategy.com/validate/ai-idea-validation-tool)
- [Best startup idea validators](https://validatestrategy.com/validate/startup-idea-validator)
- [Live-web scoring validator](https://aiideavalidator.com/)
- [Real signal vs noise (8-tool test)](https://bigideasdb.com/blog/ai-idea-validator-tools-2026)
- [IdeaBuddy vs GummySearch](https://ideahunter.today/compare/ideabuddy-vs-gummysearch-for-startup-research)
- [BigIdeasDB vs GummySearch](https://bigideasdb.com/help/bigideasdb-vs-gummysearch)
- [GummySearch shutdown alternatives](https://dev.to/appierun/gummysearch-alternatives-in-2026-tools-for-finding-reddit-leads-after-the-shutdown-582c)
- [GummySearch shutdown notice](https://www.subredditsignals.com/blog/subreddit-signals-vs-gummy-search-real-demand-in-2026)
- [GummySearch alternative](https://bigideasdb.com/gummysearch-alternative)
- [Exa vs Tavily vs Perplexity vs Linkup](https://serp.fast/guides/ai-search-apis-compared)
- [Tavily vs Exa vs Perplexity (dev benchmarks)](https://www.humai.blog/ai-search-apis-compared-tavily-vs-exa-vs-perplexity/)
- [Tavily vs Exa vs Perplexity vs You.com](https://www.humai.blog/tavily-vs-exa-vs-perplexity-vs-you-com-the-complete-ai-search-api-comparison-2025/)
- [4-way shape/citation/latency comparison](https://pixserp.com/blog/ai-search-api-comparison-2026)
- [Per-query pricing at scale](https://awesomeagents.ai/pricing/search-api-pricing/)
- [Polymarket Gamma markets/events/search](https://ocaml.org/p/polymarket/0.2.0)
- [Polymarket CLOB docs](https://nautilustrader.io/docs/latest/integrations/polymarket/)
- [Harmonic vs CB Insights](https://harmonic.ai/blog/cb-insights-vs-harmonic)
- [Harmonic vs PitchBook](https://harmonic.ai/blog/harmonic-vs-pitchbook)
- [Harmonic pricing](https://harmonic.ai/pricing)
- [Harmonic platform](https://harmonic.ai/)
- [Harmonic review 2026](https://www.rings.ai/blog/harmonic-ai-review)
- [Reference-class forecasting method](https://pmstudycircle.com/reference-class-forecasting/)
- [Wikipedia: comparison-class forecasting](https://en.wikipedia.org/wiki/Reference_class_forecasting)
- [2025 RCF promises/problems agenda](https://www.tandfonline.com/doi/pdf/10.1080/09537287.2025.2578708)
- [Flyvbjerg uplift calculator](https://budgetoverrun.com/reference-class-forecasting)
- [Superforecasting reality check](https://www.sciencedirect.com/science/article/pii/S0377221720306007)
- [Superforecasting → Brier ledger](https://cuicaihao.github.io/posts/2026-05-05-superforecasting-naming-uncertainty-scoring-judgments/)
- [Probability calibration drills](https://expectedvalue.co.uk/blog/probability-calibration-training/)
- [Tetlock practices](https://www.ideasthesia.org/superforecasting-tetlock/)
- [Brier score verification](https://www.researchgate.net/publication/304924623_Superforecasting_The_Art_and_Science_of_Prediction_By_Philip_Tetlock_and_Dan_Gardner)
- [ECE visual guide (ICLR 2025)](https://iclr-blogposts.github.io/2025/blog/calibration/)
- [ECE formula/MCE guide](https://www.analyticsvidhya.com/blog/2025/08/custom-loss-functions/)
- [SaaS LTV/CAC golden ratio](https://www.revoptima.io/guides/ltv-cac-analysis)
- [2026 CAC/churn/NRR medians](https://stealthagents.com/research/saas-startup-metrics-statistics-2026)
- [Cohort churn + survival](https://www.glencoyne.com/guides/saas-churn-cohort-analysis)
- [Churn modeling survival vs GBDT (Oct 2026)](https://saas-review-hub.contentwave.net/article/churn-modeling-for-saas-oct-2026-survival-gbdt-transformers)
- [Cohort LTV](https://www.glencoyne.com/guides/ltv-saas-cohort-approach)
- [FEVER task](https://www.emergentmind.com/topics/fever-fact-verification-task)
- [FEVER 2024 + AVeriTeC](https://aclanthology.org/2024.fever-1.0.pdf)
- [Fact-verification pipeline](https://github.com/minko186/fact-verification-pipeline)
- [FEVER dataset](https://www.emergentmind.com/topics/fever-dataset)
- [Cross-encoder ms-marco-MiniLM-L6-v2](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2)
- [Cross-encoders repo](https://huggingface.co/cross-encoder)
- [SBERT MS-MARCO docs](https://www.sbert.net/docs/pretrained-models/ce-msmarco.html)
