# WeMakeDevs TrueForge Agent Harness Hackathon Submission

* **Project Name:** **DOSSIER (File TF-007)**
* **Tagline:** Make AI try to kill your idea before the market does.
* **Live Web Application:** [`https://dossier-ai.onrender.com`](https://dossier-ai.onrender.com)
* **Repository:** [`https://github.com/sanjeevafk/dossier`](https://github.com/sanjeevafk/dossier)
* **Team:** Sanjeev & Team Dossier
* **Submission Date:** August 2026

---

## 1. Executive Summary & Problem

Most AI tools for founders and developers are sycophantic: they praise every idea, hallucinate positive market demand, and encourage builders to spend weeks building features nobody wants.

**Dossier** is the opposite: an **autonomous adversarial idea intelligence platform** built on the **TrueForge Agent Harness**. It deploys **6 specialized domain-aware subagents** to aggressively stress-test concepts, cross-examine assumptions, verify live prediction market consensus via Polymarket, execute sandboxed Python unit economics simulations, enforce the **7-tier Stanford CS329A epistemic evidence hierarchy**, and halt at **Dual-Key Human Approval Checkpoints** before executing real-world validation actions.

---

## 2. Prize Track Qualifications

### 🏆 Grand Prize ($1,500)
* Full end-to-end multi-agent platform combining live LLM routing, live prediction market oracle, community recon, isolated sandbox execution, 7-tier epistemic verification, and an editorial intelligence web & CLI UI.

### 🛠 Best Tool / MCP Integration ($1,000)
* Implements `@modelcontextprotocol/sdk` in `src/tools/mcp.ts` with `dossier.mcp.json`.
* Integrates **Polymarket Live Prediction Market Oracle** (`src/tools/polymarket.ts`) via open Gamma APIs for live macro betting odds.
* Integrates **Agent Reach** (`agent-reach`) for Reddit, Twitter/X, and Hacker News community sentiment.

### 🧠 Best Agent Architecture ($1,000)
* **6 Specialized Subagent Personas:** Market Analyst (01), Customer Advocate (02), Technical Architect (03), Investor (04), Red Team (05), Domain Expert (06) + Executive Synthesizer.
* **Domain-Aware Dynamic Classification:** Automatically adapts priors across 8 archetypes (B2G Procurement, Healthcare, Deep Tech, Hardware, B2B SaaS, FinTech, EdTech, Consumer Social).
* **Stanford CS329A Epistemic Verification:** Strict separation of verified facts, sandbox computations, modelled hypotheses, inferences, unknowns, and contradictions.
* **Adversarial Cross-Examination:** Subagents directly challenge and debate conflicting hypotheses with multi-round convergence loops.

### 💎 Best Code Quality Track ($1,000 Mac Mini via Qodo AI)
* **100% Pull Request Driven Development:** All 20 features merged via Pull Requests with continuous automated **Qodo AI** code reviews on GitHub (`PR #1` through `PR #20`).
* **Strict TypeScript & Node 22 ESM:** NodeNext module resolution, zero build errors, numeric exit codes, and comprehensive automated test suites (`test/*.test.mjs`, `pnpm run benchmark`, `pnpm run test:stress`).

---

## 3. Key Technical Innovations

1. **OrcaRouter Live Multi-Agent Engine:**
   * Uses `@openai/openai` SDK targeting `https://api.orcarouter.ai/v1` with model `orcarouter/auto`.
   * Parallel subagent dispatch via `Promise.all` reducing full adversarial critique rounds from ~30s to ~4s.

2. **Isolated Subprocess Sandbox Runner:**
   * Financial simulation code is compiled into standalone Python scripts and executed in isolated `/tmp/trueforge-sandbox-*` directories with strict timeouts and resource bounds.

3. **Dual-Key Human-in-the-Loop Safety:**
   * Critical external actions (`COLD_OUTREACH_EMAIL`, `SMOKE_TEST_LANDING_PAGE`) halt automatically until the human operator authorizes or vetoes them.

4. **Classified Intelligence Terminal UI:**
   * Restrained, distinctive design with obsidian black (`#07080a`), signal amber (`#f59e0b`), bone typography, and 3D folder visualization.

---

## 4. Quickstart & Verification

```bash
# 1. Clone & Install
git clone https://github.com/sanjeevafk/dossier.git
cd dossier
pnpm install

# 2. Run Automated Test Suite
pnpm test

# 3. Launch Web Application
pnpm start
# Visit http://localhost:3000

# 4. Or Run via CLI
pnpm cli evaluate \
  --title "Your Startup Concept" \
  --summary "What it does and key workflow..." \
  --audience "Target Buyers" \
  --pricing 49 \
  --cac 120
```
