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
- **Global Sensitivity & VOI:** Calculates first-order Sobol indices and Expected Value of Perfect Information (EVPI) to rank which uncertain metrics carry the highest financial risk.
- **Epistemic Claim Verification:** Classifies factual assertions into seven discrete evidence tiers (`VERIFIED_FACT`, `VERIFIED_COMPUTATION`, `EXTERNAL_EVIDENCE`, `MODELLED_ASSUMPTION`, `INFERENCE`, `UNKNOWN`, `CONTRADICTED`).
- **Empirical Grounding & Graveyard Precedents:** Cross-references queries against curated failure case studies (Startup Graveyard) and real market evidence (Exa AI, Hacker News, Google News, prediction markets, SEC EDGAR filings, and US Census base rates).
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

# Install dependencies
pnpm install
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Build TypeScript
pnpm run build

# Start the native HTTP server
pnpm start
```

Open `http://localhost:3000` in your browser.

### Docker

```bash
docker build -t dossier .
docker run -p 3000:3000 --env-file .env dossier
```

### Terminal CLI Evaluation

Evaluate a concept directly from the command line:

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
| `LLM_BASE_URL` | Base URL for any OpenAI-compatible inference endpoint (vLLM, Ollama, LiteLLM, LM Studio) | None |
| `LLM_API_KEY` | API key corresponding to `LLM_BASE_URL` | None |
| `LLM_MODEL` | Target model name for custom endpoint or CLI runner | `default` |
| `LLM_CLI_CMD` | External CLI execution command for pluggable runner (e.g. `ollama run llama3`) | None |
| `DOSSIER_LLM_BACKEND` | Runtime selection: `api` (HTTP endpoints) or `cli` (external subprocess) | `auto` |
| `GROQ_API_KEY` | Groq LPU API key | Optional |
| `OPENROUTER_API_KEY` | OpenRouter gateway API key | Optional |
| `OPENAI_API_KEY` | OpenAI direct API key | Optional |
| `GEMINI_API_KEY` | Google Gemini API key | Optional |
| `EXA_API_KEY` | Exa AI neural search key for competitor reconnaissance | Optional |
| `DOSSIER_API_KEY` | Authentication bearer token required in production for non-GET endpoints | Optional |
| `PORT` | HTTP server port | `3000` |
| `DOSSIER_DATA_DIR` | SQLite database and generated PDF export storage directory | `./data` |

---

## REST & Streaming API Reference

The server runs on native Node.js HTTP (`node:http`) with zero Express dependencies.

- `GET /health` - Health check and LLM provider status.
- `GET /metrics` - Prometheus metrics (request counters, latencies, memory usage).
- `POST /api/evaluate` - Synchronous complete dossier evaluation.
- `POST /api/evaluate/stream` - Server-Sent Events (SSE) streaming evaluation with per-agent deltas.
- `POST /api/chat/stream` - Interactive adversary chat turn streaming.
- `GET /api/dossiers` - List persisted evaluation dossiers.
- `GET /api/dossiers/:id` - Fetch dossier record by ID.
- `GET /api/dossiers/:id/export/markdown` - Export evaluation report as GitHub-flavored markdown.
- `GET /api/dossiers/:id/export/pdf` - Export evaluation report as formatted PDF.

---

## Model Context Protocol (MCP) Integration

Dossier includes a certified Model Context Protocol (MCP) server for integration with Cursor, Claude Desktop, and autonomous coding agents.

### Configuration (`claude_desktop_config.json`)

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
- `run_sandbox_economics`: Executes an isolated Python Monte Carlo run for LTV, CAC, runway, and Sobol EVPI.
- `verify_claims_epistemics`: Audits assertions across the 7-tier epistemic evidence ledger.
- `stress_test_concept`: Evaluates adversarial resilience, prompt injection resistance, and domain boundaries.

---

## Verification & Benchmarks

The codebase maintains rigorous automated test suites covering decision model invariants, statistical bounds, and empirical startup outcomes:

```bash
# Run unit and decision model test suite (86 tests)
npm test

# Run adversarial exploit harness (stress-testing 5 core invariants)
npm run test:stress

# Run historical startup backtest against 9 known successes and failures
npx tsx scripts/backtest_real_startups.ts

# Run domain resilience benchmark suite
pnpm run benchmark
```

### Historical Backtest Results
When benchmarked against 9 documented startup launches (Stripe, Figma, Vanta, Airbnb, Quibi, Fast, Juicero, Theranos, Zume Pizza):
- **Overall Accuracy:** 89% (8/9 correct)
- **Failure Flagging Rate:** 100% Specificity (5/5 failed ventures flagged as fatal `KILL`)
- **Success Identification:** 75% Sensitivity (3/4 successes recommended for `REFINE` or `BUILD`)

---

## License

Licensed under the Apache License, Version 2.0.
