# ⚡ Idea Swarm — Adversarial Multi-Agent Idea Validation Platform

> **"Don't just ask AI whether your idea is good. Make AI try to kill it first."**

Built on **[TrueForge](https://github.com/truefoundry/trueforge)** for the **WeMakeDevs Agent Harness Hackathon (August 24–30, 2026)**.

---

## 🎯 What is Idea Swarm?

Most founders and developers ask LLMs for feedback and receive polite, sycophantic praise. **Idea Swarm flips this dynamic entirely.**

When you submit an idea, TrueForge orchestrates **6 specialized adversarial subagents** that independently research, cross-examine, and stress-test every assumption before producing a quantitative **Kill/Resilience Score**, a **Sandboxed Financial Simulation**, and a **7-Day Validation Roadmap** with **Human Approval Checkpoints**.

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

## 👥 The 6 Swarm Agents

1. **😈 The Skeptic (Chief Devil's Advocate):** Relentlessly exposes fatal flaws, regulatory hurdles, hidden CAC distribution traps, and churn risks.
2. **💰 The Investor (VC Partner):** Evaluates TAM/SAM, competitive defensibility, pricing power, and venture scalability.
3. **⚙️ The Technical Architect (Principal Systems Engineer):** Assesses technical feasibility, token/compute costs, latency, and sandbox security.
4. **📊 The Market Analyst (Competitive Intelligence Lead):** Maps direct/indirect competitors, market signals, and positioning whitespace.
5. **🎯 The Customer Persona (Target Buyer):** Tests psychological inertia, switching friction, and true willingness to pay.
6. **👑 The Founder Synthesizer:** Resolves contradictions, computes the consensus Resilience Score (0–100), and formulates the 7-day validation plan.

---

## 🛡️ TrueForge Harness Superpowers

- **Model Context Protocol (MCP):** Connects subagents to market intelligence, competitor lookups, and developer ecosystem indexes.
- **Sandboxed Code Execution:** Executes Python financial and unit economics simulations (CAC, LTV, churn, compute cost) inside isolated sub-processes.
- **Human-in-the-Loop Approval Checkpoints:** Pauses turn execution before external outreach (cold validation emails, live smoke test deployment) until approved by a human operator.
- **Full Context & Session State:** Multi-agent debate history and cross-rebuttals are preserved across reconnections.

---

## 🚀 Quickstart

### Prerequisites
- Node.js `>= 22.0.0`
- Python `3.x` (for sandbox simulations)
- pnpm or npm

### 1. Installation
```bash
git clone https://github.com/sanjeevafk/trueforge-agent.git
cd trueforge-agent
pnpm install
```

### 2. Run the Interactive Web UI
```bash
pnpm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to launch the Idea Swarm Dashboard.

### 3. Run via CLI
```bash
pnpm cli evaluate \
  --title "Autonomous Micro-SaaS Agent" \
  --summary "AI agent that handles customer support and initiates database backups automatically." \
  --audience "Shopify Merchants" \
  --monetization "$99/month" \
  --pricing 99 \
  --cac 200
```

### 4. Run Automated Test Suite
```bash
pnpm test
```

---

## 🏆 Hackathon Track Alignment

- **Double-O Track ($5,000 NVIDIA DGX Spark - Best Use of TrueForge):**
  Uses TrueForge for subagent delegation, sandboxed Python economics execution, and human approval checkpoints.
- **Q Branch Track ($1,000 Mac Mini - Best Code Quality):**
  Automated code reviews via Qodo across all development pull requests with 100% clean test passes and strict type safety.
- **Savile Row Track (Apple iPad - Best UI):**
  Responsive glassmorphic web dashboard with live debate transcript, sandboxed metrics terminal, and interactive approval gates.

---

## 📄 License
MIT © [sanjeevafk](https://github.com/sanjeevafk)
