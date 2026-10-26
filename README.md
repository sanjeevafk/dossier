# Dossier

[![Live Service](https://img.shields.io/badge/Azure%20App%20Service-dossier--ai-0078D4?logo=microsoftazure&logoColor=white)](https://dossier-ai.azurewebsites.net)
[![Health Check](https://img.shields.io/badge/Health-200%20OK-brightgreen)](https://dossier-ai.azurewebsites.net/health)
[![UptimeRobot](https://img.shields.io/badge/UptimeRobot-Monitored-blue)](https://dossier-ai.azurewebsites.net/health)

Adversarial multi-agent platform that stress-tests startup ideas, product features, and technical proposals before capital or engineering effort is spent.

---

## 🚀 Live Deployment
- **Web Dashboard:** [https://dossier-ai.azurewebsites.net](https://dossier-ai.azurewebsites.net)
- **Health Check:** [https://dossier-ai.azurewebsites.net/health](https://dossier-ai.azurewebsites.net/health)
- **Hosting Tier:** Azure App Service (`B1` Basic, Central India — co-hosted with SwaraSetu at zero marginal cost)
- **Keep-Alive:** Continuous 300s synthetic health polling via UptimeRobot

---

## Overview

Dossier stress-tests startup concepts, product features, and technical proposals before capital or engineering effort is spent. Instead of offering generic feedback, the platform deploys specialized adversarial subagents to challenge core assumptions, run quantitative unit economics simulations in an isolated sandbox, and propose validation steps guarded by human approval checkpoints.

```
                           +----------------------+
                           |   Idea Submission    |
                           +----------+-----------+
                                      |
                                      v
                      +-------------------------------+
                      | Agent Harness Runtime       |
                      +---------------+---------------+
                                      |
          +---------------------------+---------------------------+
          |               |                       |               |
          v               v                       v               v
   +--------------+ +--------------+       +--------------+ +--------------+
   | The Skeptic  | | The Investor |  ...  |  Architect   | | Market Lead  |
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
                      |  Final Idea Resilience Dossier|
                      +-------------------------------+
```

---

## Swarm Perspectives

- **The Skeptic (Chief Devil's Advocate):** Identifies fatal flaws, churn traps, regulatory risks, and distribution bottlenecks.
- **The Investor (VC Partner):** Evaluates TAM/SAM, defensibility, pricing power, and venture scalability.
- **The Technical Architect (Principal Systems Engineer):** Evaluates technical feasibility, compute and token unit economics, latency, and sandbox isolation.
- **The Market Analyst (Competitive Intelligence Lead):** Analyzes direct and indirect competitors, industry trends, and market positioning.
- **The Customer Persona (Target Buyer):** Tests psychological inertia, switching friction, and true willingness to pay.
- **The Founder Synthesizer:** Resolves contradictions, computes the consensus Resilience Score (0–100), and formulates the 7-day validation plan.

---

## Architecture & Safety Guarantees

- **Harness Runtime:** Provides session persistence and subagent delegation.
- **Tool Protocol:** Leverages Model Context Protocol (MCP) for market intelligence and competitor discovery.
- **Sandboxed Execution:** Executes financial modeling and compute cost calculations inside an isolated Python subprocess.
- **Human Approval Checkpoints:** Pauses turn execution before external outreach (cold validation emails, landing page deployment) until approved by an operator.

---

## 🔍 Intelligence Sources & Capabilities

Dossier grounds every evaluation in empirical data and live market telemetry across three distinct layers:

| Layer | Source / Provider | Scope & Role | Setup Required |
|:---|:---|:---|:---|
| **Community Sentiment** | **Hacker News (Algolia API)** | Real developer discussions, Show HN launches, negative sentiment threads | Zero-config (Open API) |
| **Neural Web Recon** | **Exa AI (`api.exa.ai`)** | Real-time web search, competitor analysis, indexed Twitter/X tech updates | `EXA_API_KEY` in `.env` |
| **Prediction Odds** | **Polymarket (Gamma API)** | Live real-money betting odds and macro sentiment trends | Zero-config (Public API) |
| **Web Fallback** | **DuckDuckGo HTML Recon** | Free-form competitor search and live URL discovery | Zero-config |
| **Social Updates** | **Twitter / X Bridge** | Curated tech handle timelines (`@sama`, `@ycombinator`, etc.) and feeds | Local `twitter` CLI or X API Bearer Token |
| **Outside View Priors** | **Census BFS, PitchBook, Stanford AI Index, HBS, CB Insights** | 16 empirical reference classes with 24-month survival ranges and root failure causes | Built-in (Deterministic data table) |
| **Unit Economics** | **NumPy Vectorized Sandbox** | 10,000-run Monte Carlo simulation for cash runway, LTV/CAC, and payback percentiles | Python 3 + `numpy` (built-in) |

---

## ⚠️ Limitations & Honesty Contract

Dossier enforces a strict zero-hallucination contract across all subagents:

1. **Zero-Fabrication Fallback**:
   - If an external intelligence source (Exa, Polymarket, Twitter) is unconfigured, unreachable, or rate-limited, Dossier **never fabricates plausible-sounding discussions or URLs**.
   - It explicitly returns `discussions: []`, marks `provider: "none"`, and surfaces the absence to the reviewer rather than inventing synthetic citations.
2. **Twitter/X Platform Constraints**:
   - Cookie-based Twitter scraping is fragile due to frequent upstream GraphQL endpoint rotations.
   - For real-time Twitter/X sentiment, Dossier relies on **Exa neural search** (which indexes X posts cleanly over HTTP without cookie overhead). Self-hosters can optionally connect official X API access via `TWITTER_BEARER_TOKEN`.
3. **Prediction Market Specificity**:
   - Polymarket odds only exist for broad macro or public-market events. Specific niche B2B tools or early-stage ideas will have zero liquid prediction markets; Dossier explicitly reports zero markets rather than forcing loose fuzzy matches.
4. **Reference-Class Guidance**:
   - Outside-view base rates (e.g. 21% 24-month survival for B2B Enterprise SaaS) represent industry-wide historical distributions, not individual company verdicts. They counteract subjective founder optimism, but do not replace user interviews.
5. **Human Approval Gates**:
   - Dossier will never auto-dispatch external outreach, landing pages, or cold emails without explicit operator sign-off via its Dual-Key Approval Gates.

---

## Getting Started

### Prerequisites
- Node.js `>= 22.0.0`
- Python `3.x` (for sandbox simulations)
- pnpm or npm

### Installation
```bash
git clone https://github.com/sanjeevafk/dossier.git
cd dossier
pnpm install
```

### Run the Web Dashboard
```bash
pnpm start
```
Open [http://localhost:3000](http://localhost:3000) (or access the live production instance at [https://dossier-ai.azurewebsites.net](https://dossier-ai.azurewebsites.net)) in your browser.

### Run via CLI
```bash
pnpm cli evaluate \
  --title "Autonomous Micro-SaaS Agent" \
  --summary "AI agent that handles customer support and initiates database backups automatically." \
  --audience "Shopify Merchants" \
  --monetization "$99/month" \
  --pricing 99 \
  --cac 200
```

### Run Tests & Adversarial Stress Suite
```bash
pnpm test          # Node.js standard test suite
pnpm run test:stress # 5-invariant adversarial harness exploit suite
pnpm run benchmark   # 10-concept domain resilience benchmark
```

---

## Model Context Protocol (MCP) & Agent Skill

Dossier is packaged as both a **standalone MCP server** and an **Agent Skill** (`skills/dossier/SKILL.md`) that any agent framework can plug into.

### 1. Connecting via MCP (`dossier.mcp.json`)

Add Dossier to your Claude Desktop config (`claude_desktop_config.json`) or harness MCP settings:

```json
{
  "mcpServers": {
    "dossier": {
      "command": "node",
      "args": ["/path/to/dossier/dist/mcp-server.js"],
      "env": {
        "ORCAROUTER_API_KEY": "your_api_key_here",
        "MODEL_NAME": "openai/gpt-4o-mini"
      }
    }
  }
}
```

#### Exposed MCP Tools:
- **`evaluate_idea`**: Deploys the 6-agent domain swarm, runs Stanford CS329A epistemic verification, isolated Python unit economics simulation, and compiles full intelligence dossiers.
- **`stress_test_concept`**: Evaluates prompt injection defense, impossible physics detection, and sandbox isolation.
- **`run_sandbox_economics`**: Executes isolated Python 3 subprocesses to deterministically compute LTV, CAC, and payback bounds.
- **`verify_claims_epistemics`**: Classifies claims into the 7 Stanford epistemic states (`VERIFIED_FACT`, `VERIFIED_COMPUTATION`, `EXTERNAL_EVIDENCE`, `MODELLED_ASSUMPTION`, `INFERENCE`, `UNKNOWN`, `CONTRADICTED`).

### 2. Installing the Agent Skill

To install Dossier as a native skill in your agent environment:
```bash
cp -r skills/dossier ~/.agents/skills/
```

---

## License

MIT

