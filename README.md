# Dossier

Dossier is an adversarial risk reviewer for startup concepts, product features, and technical proposals. It finds the specific, evidenced ways an idea could fail, separates fatal problems from ones a cheap test can settle, and names that cheapest test for each, before engineering effort or capital is committed.

Six specialist lenses each report evidenced findings from their own lane. An isolated Python sandbox runs unit-economics simulations when you supply real price and CAC, and the output is a falsification roadmap you can run in a week.

**What it is not:** a predictor of success. On held-out, neutrally written cases the verdict does not separate eventual successes from eventual failures better than chance (see [docs/EVALUATION.md](docs/EVALUATION.md)). Read the findings and the tests; treat the verdict as a rough screen. Confidence is uncalibrated and no probability of success is shown.

Live Deployment: https://dossier.worksforme.tech

---

## Architecture

```
                           +----------------------+
                           |   Idea Submission    |
                           +----------+-----------+
                                      |
                                      v
                       +------------------------------+
                       |    Orchestration Harness     |
                       +--------------+---------------+
                                      |
          +---------------------------+---------------------------+
          |               |                       |               |
          v               v                       v               v
   +--------------+ +--------------+       +--------------+ +--------------+
   |   Analyst    | |   Customer   |  ...  |  Architect   | |   Red Team   |
   +------+-------+ +------+-------+       +------+-------+ +------+-------+
          \               /                       \               /
           \             /                         \             /
            v           v                           v           v
       +--------------------+                   +--------------------+
       | Cross-Examination  |                   | Isolated Sandbox   |
       | Adversarial Debate |                   | Python Sim (CAC/LTV|
       +----------+---------+                   | Sobol EVPI Matrix) |
                  |                             +---------+----------+
                  +-------------------+-------------------+
                                      |
                                      v
                      +--------------------------------+
                      |     Epistemic Verification     |
                      |   7-Tier Claim Classification  |
                      +---------------+----------------+
                                      |
                                      v
                      +--------------------------------+
                      |     Risk Dossier: Findings,    |
                      |  Screening Verdict, Cheapest   |
                      |  7-Day Falsification Roadmap   |
                      +--------------------------------+
```

---

## Swarm Perspectives

- **Synthesizer (Agent 00):** Resolves perspective contradictions, computes the composite screening score (0–100, uncalibrated), and structures the 7-day falsification plan.
- **Analyst (Agent 01):** Maps competitor landscapes, addressable market sizing, organic search intent, and whitespace opportunities.
- **Customer Advocate (Agent 02):** Evaluates user friction, switching costs, workflow disruption, and empirical willingness to pay.
- **Technical Architect (Agent 03):** Audits engineering feasibility, compute and token unit economics, and architectural bottlenecks.
- **Investor (Agent 04):** Models gross margins, capital efficiency, defensibility, and market timing.
- **Red Team (Agent 05, Chief Adversary):** Identifies fatal flaws, churn traps, regulatory exposure, and distribution failure points. Holds affirmative veto authority (`STRONG_KILL`).
- **Domain Expert (Agent 06):** Verifies vertical-specific regulatory compliance, standard contracts, and sector benchmarks.

---

## Core Systems

- **Sandboxed Unit Economics:** Executes isolated Python subprocesses with vectorized NumPy Monte Carlo simulations (10,000 runs) to model cash runway, LTV/CAC ratios, and payback percentiles under parameter uncertainty.
- **Global Sensitivity & VOI:** Calculates sensitivity and Expected Value of Perfect Information (EVPI) to rank which uncertain metrics carry the highest financial risk.
- **Epistemic Claim Verification:** Classifies factual assertions into seven discrete evidence tiers (`VERIFIED_FACT`, `VERIFIED_COMPUTATION`, `EXTERNAL_EVIDENCE`, `MODELLED_ASSUMPTION`, `INFERENCE`, `UNKNOWN`, `CONTRADICTED`).
- **Empirical Grounding & Graveyard Precedents:** Cross-references queries against curated failure case studies and real market evidence.
- **7-Day Falsification Roadmaps:** Replaces arbitrary approval gates with verifiable, low-cost empirical experiments designed to invalidate core assumptions before capital expenditure.
- **Zero-Fabrication Contract:** When external providers are unconfigured or unavailable, Dossier records explicit empty signals rather than generating synthetic citations.

---

## Quickstart

### System Requirements
- Node.js >= 22.0.0
- Python 3.10+ (with `numpy` for sandbox simulations)
- pnpm (recommended) or npm

### Installation

```bash
git clone https://github.com/sanjeevafk/dossier.git
cd dossier
pnpm install
pip install -r requirements.txt
cp .env.example .env
pnpm run build
pnpm start
```

Open `http://localhost:3000` in your browser.

### Docker

```bash
docker build -t dossier .
docker run -p 3000:3000 --env-file .env dossier
```

### Terminal CLI Evaluation

```bash
pnpm cli evaluate \
  --title "Autonomous Micro-SaaS Agent" \
  --summary "AI agent that handles customer support and triggers database migrations automatically." \
  --audience "Shopify Merchants" \
  --monetization "$99/month" \
  --pricing 99 \
  --cac 200
```

---

## Configuration

Dossier is fully pluggable and model-agnostic. It can connect to any OpenAI-compatible API endpoint, local inference server, or generic CLI harness. If no live LLM is configured, Dossier automatically falls back to an offline heuristic engine.

| Variable | Description | Default |
|:---|:---|:---|
| `LLM_BASE_URL` | Base URL for any OpenAI-compatible inference endpoint | None |
| `LLM_API_KEY` | API key corresponding to `LLM_BASE_URL` | None |
| `LLM_MODEL` | Target model name for custom endpoint | `default` |
| `LLM_CLI_CMD` | External CLI execution command | None |
| `DOSSIER_LLM_BACKEND` | Runtime selection: `api` or `cli` | `auto` |
| `GROQ_API_KEY` | Groq API key | Optional |
| `OPENROUTER_API_KEY` | OpenRouter API key | Optional |
| `OPENAI_API_KEY` | OpenAI API key | Optional |
| `GEMINI_API_KEY` | Google Gemini API key | Optional |
| `ORCAROUTER_API_KEY` | OrcaRouter API key | Optional |
| `EXA_API_KEY` | Exa AI neural search key | Optional |
| `DOSSIER_API_KEY` | Optional bearer token; set it (or REQUIRE_AUTH=true) to protect the API for non-GET endpoints | Optional |
| `PORT` | HTTP server port | `3000` |
| `DOSSIER_DATA_DIR` | SQLite database and generated PDF export storage directory | `./data` |

---

## REST & Streaming API Reference

The server runs on native Node.js HTTP (`node:http`) with zero Express dependencies.

- `GET /health` - Health check and LLM provider status.
- `GET /metrics` - Prometheus metrics.
- `POST /api/evaluate` - Synchronous complete dossier evaluation.
- `POST /api/evaluate/stream` - Server-Sent Events streaming evaluation.
- `POST /api/chat/stream` - Interactive adversary chat turn streaming.
- `GET /api/dossiers` - List persisted evaluation dossiers.
- `GET /api/dossiers/:id` - Fetch dossier record by ID.
- `GET /api/dossiers/:id/export/markdown` - Export evaluation report.
- `GET /api/dossiers/:id/export/pdf` - Export evaluation report as PDF.

---

## Model Context Protocol (MCP) Integration

Dossier includes a Model Context Protocol (MCP) server for integration with Cursor, Claude Desktop, and autonomous coding agents.

### Configuration

```json
{
  "mcpServers": {
    "dossier": {
      "command": "node",
      "args": ["/path/to/dossier/dist/mcp-server.js"],
      "env": {
        "LLM_BASE_URL": "http://localhost:11434/v1",
        "LLM_MODEL": "llama3"
      }
    }
  }
}
```

### Available MCP Tools
- `evaluate_idea`: Deploys the full 7-agent swarm, epistemic verification, and unit economics simulation.
- `run_sandbox_economics`: Executes an isolated Python Monte Carlo run for LTV, CAC, runway, and sensitivity/EVPI.
- `verify_claims_epistemics`: Audits assertions across the 7-tier epistemic evidence ledger.
- `stress_test_concept`: Evaluates adversarial resilience and prompt injection resistance.

---

## Verification & Benchmarks

The codebase maintains automated test suites covering decision model invariants, statistical bounds, and empirical startup outcomes:

```bash
npm test
npm run test:stress
npx tsx scripts/backtest_real_startups.ts
pnpm run benchmark
```

### What the evaluation shows

`src/evaluation/` holds 139 ideas written as neutral founder pitches (no outcome, no cause of death), with a deterministic dev / validation / frozen-test split. Run it with `pnpm eval -- --split dev`, and compare against a one-prompt baseline with `--baseline`.

On the dev split (12 eventual successes, 15 eventual failures) the full pipeline's score gives **AUROC 0.50 (95% CI 0.27 to 0.74)**, which is no better than chance, and the one-prompt baseline gives 0.40. The pipeline does keep most successes alive (33% wrongly killed against 100% for the baseline), but it also passes 60% of the failures. The full table, method and limits are in [docs/EVALUATION.md](docs/EVALUATION.md).

Earlier versions of this README quoted 8/9 accuracy on a hand-picked set of famous companies (Stripe, Quibi, Juicero and others). That set uses names a language model may recall and its descriptions carried hints of the outcome, so it is **not evidence of accuracy**. It remains in `scripts/backtest_real_startups.ts` only as a regression check.

Before any stronger claim: blind rewrites of the pitches, verifiable sources for successes, human grading of the findings, and a real outcome ledger so confidence can be calibrated (Brier score, reliability curves).

---

## License

Licensed under the Apache License, Version 2.0.
