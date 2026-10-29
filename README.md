# Dossier

Live Deployment: https://dossier.sanjeevkumar.me

Dossier is an adversarial multi-agent evaluation platform that stress-tests startup concepts, product features, and technical proposals before engineering effort or capital is committed.

Instead of surface-level encouragement, Dossier deploys specialized adversarial agents to challenge assumptions, run quantitative unit economics simulations in an isolated Python sandbox, verify factual claims against empirical sources, and generate concrete validation roadmaps guarded by human approval checkpoints.

---

## Overview & Architecture

```
                           +----------------------+
                           |   Idea Submission    |
                           +----------+-----------+
                                      |
                                      v
                       +-------------------------------+
                       |     Agent Harness Runtime     |
                       +---------------+---------------+
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
        +----------+---------+                   +---------+----------+
                   |                                       |
                   +-------------------+-------------------+
                                       |
                                       v
                       +-------------------------------+
                       | Human Approval Gate (Safety)  |
                       |   [Approve / Reject Action]   |
                       +---------------+---------------+
                                       |
                                       v
                       +-------------------------------+
                       | Final Idea Resilience Dossier |
                       | (Score 0-100, Verdict, Plan)  |
                       +-------------------------------+
```

---

## Swarm Perspectives

- **Synthesizer (00):** Resolves contradictions across perspectives, computes the Resilience Score (0–100), and structures the 7-day validation plan.
- **Analyst (01):** Competitor landscape mapping, addressable market sizing, search intent signals, and whitespace identification.
- **Customer Advocate (02):** User friction, switching costs, habit inertia, and willingness-to-pay realities.
- **Technical Architect (03):** Feasibility, compute/token operational economics, infrastructure bottlenecks, and sandbox safety.
- **Investor (04):** Business model viability, gross margins, defensibility, and capital efficiency.
- **Red Team (05, Chief Adversary):** Identifies fatal flaws, churn traps, regulatory exposure, and distribution failure points. Holds veto authority (`STRONG_KILL`) over affirmative verdicts.
- **Domain Expert (06):** Sector-specific compliance, standards, and operational benchmarks.

---

## Core Capabilities

- **Sandboxed Unit Economics:** Runs isolated Python subprocesses with vectorized NumPy Monte Carlo simulations (10,000 iterations) to model cash runway, LTV/CAC ratios, and payback percentiles under parameter uncertainty.
- **Epistemic Verification (Stanford CS329A):** Classifies assertions into 7 discrete evidence states (`VERIFIED_FACT`, `VERIFIED_COMPUTATION`, `EXTERNAL_EVIDENCE`, `MODELLED_ASSUMPTION`, `INFERENCE`, `UNKNOWN`, `CONTRADICTED`) to separate empirical evidence from assumptions.
- **Real-World Intelligence Sources:**
  - *Hacker News (Algolia API):* Developer discussions, Show HN launches, and negative sentiment threads.
  - *Exa AI:* Web search, competitor discovery, and indexed technical updates.
  - *Polymarket (Gamma API):* Public prediction market probabilities and macro sentiment trends.
  - *Historical Reference Classes:* 16 empirical distributions (Census BFS, PitchBook, Stanford AI Index, CB Insights) for baseline survival and failure distributions.
- **Human Approval Gates:** Actions with real-world impact (such as outbound email dispatch or landing page deployment) require explicit operator sign-off before execution.
- **Zero-Fabrication Contract:** If an external intelligence source is unavailable or unconfigured, Dossier reports zero results and marks the provider as unconfigured rather than generating synthetic citations.

---

## Self-Hosting & Quickstart

### Prerequisites
- Node.js >= 22.0.0
- Python 3.10+ (with `numpy` for sandbox simulations)
- pnpm (recommended) or npm
- (Optional) Docker

### 1. One-Command Setup (Makefile)

The Makefile handles dependency checks, environment setup, build steps, and startup:

```bash
git clone https://github.com/sanjeevafk/dossier.git
cd dossier
make
```

The default `make` (or `make run`) target checks `.env`, installs Node and Python dependencies, builds the TypeScript project, and starts the server on `http://localhost:3000`.

To start in development mode with auto-reload:
```bash
make dev
```

Additional targets:
- `make test`: Run unit tests and decision model test suite (92 tests).
- `make benchmark`: Run the 10-concept domain resilience benchmark.
- `make clean`: Remove build artifacts and temporary cache files.

### 2. Manual Setup

```bash
git clone https://github.com/sanjeevafk/dossier.git
cd dossier

# Install dependencies
pnpm install
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Build and start
pnpm run build
pnpm start
```

Open `http://localhost:3000` in your browser.

### 3. Docker Setup

```bash
docker build -t dossier .
docker run -p 3000:3000 --env-file .env dossier
```

### 4. CLI Evaluation

Evaluate an idea directly from the terminal:

```bash
pnpm cli evaluate \
  --title "Autonomous Micro-SaaS Agent" \
  --summary "AI agent that handles customer support and initiates database backups automatically." \
  --audience "Shopify Merchants" \
  --monetization "$99/month" \
  --pricing 99 \
  --cac 200
```

---

## Configuration

Copy `.env.example` to `.env` to configure optional and required settings:

| Variable | Description | Default |
|:---|:---|:---|
| `OPENAI_API_KEY` | OpenAI API key for LLM evaluations | Optional |
| `ANTHROPIC_API_KEY` | Anthropic API key | Optional |
| `GEMINI_API_KEY` | Google Gemini API key | Optional |
| `DOSSIER_LLM_BACKEND` | LLM runtime selection: `api` (direct keys) or `agy` (CLI harness) | `auto` |
| `EXA_API_KEY` | Exa AI neural search key for competitor reconnaissance | Optional |
| `DOSSIER_API_KEY` | Authentication key required for production non-GET endpoints | Optional |
| `PORT` | HTTP server port | `3000` |
| `DOSSIER_DATA_DIR` | SQLite database and generated PDF export storage directory | `./data` |

---

## Model Context Protocol (MCP) & Agent Skill

Dossier can be operated as a standalone MCP server, invoked via `npx`, installed globally, or installed as an agent skill.

### 1. Installation via GitHub Packages

```bash
# Install globally
npm install -g @sanjeevafk/dossier --registry=https://npm.pkg.github.com

# Or run directly via npx without local install
npx --registry=https://npm.pkg.github.com @sanjeevafk/dossier evaluate --title "My Idea"
```

### 2. Connecting via MCP (`dossier.mcp.json`)

Add Dossier to your Claude Desktop (`claude_desktop_config.json`) or agent harness configuration:

**Option A: Direct via `npx` (Recommended)**
```json
{
  "mcpServers": {
    "dossier": {
      "command": "npx",
      "args": ["-y", "--registry=https://npm.pkg.github.com", "@sanjeevafk/dossier", "mcp"],
      "env": {
        "OPENAI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Option B: Global binary (`dossier-mcp`)**
```json
{
  "mcpServers": {
    "dossier": {
      "command": "dossier-mcp",
      "env": {
        "OPENAI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Option C: Local source**
```json
{
  "mcpServers": {
    "dossier": {
      "command": "node",
      "args": ["/path/to/dossier/dist/mcp-server.js"],
      "env": {
        "OPENAI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Exposed MCP Tools:
- `evaluate_idea`: Deploys the 6-agent swarm, epistemic verification, Python unit economics, and returns a structured dossier.
- `stress_test_concept`: Evaluates prompt injection defense and sandbox constraints.
- `run_sandbox_economics`: Executes isolated Python subprocess simulations for LTV, CAC, and payback bounds.
- `verify_claims_epistemics`: Classifies claims across the 7 epistemic tiers.

### 3. Installing the Agent Skill

To install Dossier into an agent environment:

```bash
cp -r skills/dossier ~/.agents/skills/
```

---

## Testing

```bash
make test            # Full unit and decision model test suite (92 tests)
pnpm run test:stress # 5-invariant adversarial harness exploit suite
pnpm run benchmark   # 10-concept domain resilience benchmark
```

---

## License

Licensed under the Apache License, Version 2.0 (the "License"). 
