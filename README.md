# Dossier

Dossier is an adversarial multi-agent evaluation platform that stress-tests startup concepts, product features, and technical proposals before engineering effort or capital is committed.

The platform deploys seven specialized analytical perspectives to challenge assumptions, runs quantitative unit economics simulations in an isolated Python sandbox, verifies factual claims against empirical sources, and outputs a concrete 7-day falsification roadmap.

Live Deployment: https://dossier.sanjeevkumar.me

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
                      |  Final Idea Resilience Dossier |
                      |   Score (0-100), Kill Flags,   |
                      |  7-Day Falsification Roadmap   |
                      +--------------------------------+
```

---

## Swarm Perspectives

- **Synthesizer (Agent 00):** Resolves perspective contradictions, computes the composite Resilience Score (0–100), and structures the 7-day falsification plan.
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
| `DOSSIER_API_KEY` | Authentication bearer token required in production for non-GET endpoints | Optional |
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

### Historical Backtest Results

The repository contains a **9-case retrospective development benchmark** covering Stripe, Figma, Vanta, Airbnb, Quibi, Fast, Juicero, Theranos, and Zume Pizza.

The current recorded results are:

- **Overall classification:** 8/9 correct (88.9%).
- **Failure cases flagged:** 5/5 in this retrospective set.
- **Success cases identified:** 3/4 in this retrospective set.

These numbers are **not production accuracy, specificity, or sensitivity estimates**. The sample is small, retrospective, and deliberately composed of well-known historical cases. It is used primarily as a regression and sanity-check suite.

In particular, the benchmark should not claim that Dossier identified the exact historical cause of a company's failure unless the recorded evidence actually supports that causal claim.

Before making stronger performance claims, Dossier needs a larger reproducible dataset with predefined labels, held-out cases, confidence intervals, and calibration metrics such as Brier score and reliability curves.

---

## License

Licensed under the Apache License, Version 2.0.
