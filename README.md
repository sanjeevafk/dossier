# Dossier

Adversarial multi-agent platform that stress-tests startup ideas, product features, and technical proposals before capital or engineering effort is spent.

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
Open [http://localhost:3000](http://localhost:3000) in your browser.

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

