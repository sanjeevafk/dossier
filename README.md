# Dossier

Adversarial multi-agent idea intelligence platform built on the [TrueForge](https://github.com/truefoundry/trueforge) agent harness.

> **Live Web Application:** [https://dossier-ai.onrender.com](https://dossier-ai.onrender.com)  
> **Repository:** [https://github.com/sanjeevafk/dossier](https://github.com/sanjeevafk/dossier)  
> **Built for:** [WeMakeDevs Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge) (August 2026).

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
                      | TrueForge Harness Runtime     |
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

- **Harness Runtime:** Built on the TrueForge agent loop for session persistence and subagent delegation.
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

### Run Tests
```bash
pnpm test
```

---

## License

MIT (c) [sanjeevafk](https://github.com/sanjeevafk)
