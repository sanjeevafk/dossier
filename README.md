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
   |   Analyst    | |   Investor   |  ...  |  Architect   | |   RedTeam    |
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

## Swarm Perspectives (code: `src/config/prompts.ts:SWARM_ROLES`, `src/types/index.ts:SwarmRole`)

- **Analyst (01):** Competition mapping, market size, whitespace, search signals.
- **Customer Advocate (02):** User pain, adoption friction, switching costs, habit inertia.
- **Technical Architect (03):** Engineering feasibility, compute/token unit economics, sandbox safety.
- **Investor (04):** Business model viability, defensibility, pricing power, venture margins.
- **Red Team (05, Chief Adversary):** Fatal flaws, churn traps, regulatory risks, distribution death traps. `STRONG_KILL` vetoes BUILD.
- **Domain Expert (06):** Industry-specific compliance, standards, operational benchmarks.
- **Synthesizer (00):** Resolves contradictions, computes the Resilience Score (0–100), formulates the 7-day validation plan.

---

## Architecture & Safety Guarantees

- **Harness Runtime:** Provides session persistence and subagent delegation.
- **Tool Protocol:** Leverages Model Context Protocol (MCP) for market intelligence and competitor discovery.
- **Sandboxed Execution:** Executes financial modeling and compute cost calculations inside an isolated Python subprocess.
- **Human Approval Checkpoints:** Pauses turn execution before external outreach (cold validation emails, landing page deployment) until approved by an operator.

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
- **`evaluate_idea`**: Deploys the 6-agent domain swarm, runs epistemic robustness verification, isolated Python unit economics simulation, and compiles full intelligence dossiers.
- **`stress_test_concept`**: Evaluates prompt injection defense, impossible physics detection, and sandbox isolation.
- **`run_sandbox_economics`**: Executes isolated Python 3 subprocesses to deterministically compute LTV, CAC, and payback bounds.
- **`verify_claims_epistemics`**: Classifies claims into the 7 epistemic states (`VERIFIED_FACT`, `VERIFIED_COMPUTATION`, `EXTERNAL_EVIDENCE`, `MODELLED_ASSUMPTION`, `INFERENCE`, `UNKNOWN`, `CONTRADICTED`).

### 2. Installing the Agent Skill

To install Dossier as a native skill in your agent environment:
```bash
cp -r skills/dossier ~/.agents/skills/
```

---

## License

MIT

