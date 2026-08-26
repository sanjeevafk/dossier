# Killing Bad Startup Ideas Before They Burn Capital: How We Built Dossier on TrueForge

Most AI systems suffer from a fatal flaw when evaluating new product ideas: sycophancy. Ask almost any standard language model about your new startup concept, and it will politely validate your assumptions, cheer on your projections, and tell you why it could be a billion-dollar company. 

The real world is not polite. Ideas fail on brutal distribution bottlenecks, unsustainable unit economics, unexamined technical hurdles, and fundamental lack of customer willingness to pay.

For the **WeMakeDevs Agent Harness Hackathon**, we built **Dossier**: an adversarial multi-agent idea intelligence platform powered by **TrueForge**, **Model Context Protocol (MCP)**, and **Qodo**.

Here is how we built it, why we treated an agent harness as a safety and execution layer, and what we learned along the way.

---

## 1. The Core Problem: Why Chatbots Fail at Validation

Evaluating an idea is not a summarization task. It is a multi-disciplinary stress test requiring:
1. **Adversarial Cross-Examination:** You need opposing viewpoints debating each other, not a single model trying to be balanced.
2. **Deterministic Computations:** You cannot trust an LLM to reliably compute compound churn, CAC-to-LTV ratios, or cloud infrastructure scaling bounds.
3. **Epistemic Discipline:** You must distinguish between verified facts, computed projections, and unvalidated founder assumptions.
4. **Execution Boundaries:** You must never allow an autonomous agent to execute real-world actions without human oversight.

A single chat window cannot do this reliably. We needed an agent harness that provides subagent orchestration, sandboxed execution, and human approval checkpoints.

---

## 2. System Architecture: The TrueForge Multi-Agent Swarm

Dossier orchestrates a 6-persona adversarial swarm where each agent is engineered with conflicting incentives:

- **The Skeptic (Devil's Advocate):** Specifically tasked with identifying fatal structural flaws, churn traps, regulatory landmines, and distribution friction.
- **The Investor (Venture Partner):** Evaluates total addressable market (TAM), pricing power, defensibility moats, and venture fundability.
- **The Technical Architect (Principal Engineer):** Stress-tests compute feasibility, token unit economics, backend architecture, and technical debt.
- **The Market Analyst (Intelligence Lead):** Maps competitors, positioning weaknesses, and industry dynamics.
- **The Customer Persona (Target Buyer):** Evaluates psychological inertia, switching costs, and actual willingness to pay.
- **The Founder Synthesizer:** Resolves inter-agent debate conflicts, computes the consensus Resilience Score (0–100), and formulates a 7-day de-risking roadmap.

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
    | Adversarial Debate |                   | Python Unit Econ   |
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

## 3. Sandboxed Economics & Epistemic Verification

Two major subsystems enforce precision inside Dossier:

### Stanford CS329A Epistemic Verifier
Language models frequently hallucinate certainty. Dossier implements an epistemic classifier that tags every claim in an evaluation into one of seven distinct states:
- `VERIFIED_FACT`
- `VERIFIED_COMPUTATION`
- `EXTERNAL_EVIDENCE`
- `MODELLED_ASSUMPTION`
- `INFERENCE`
- `UNKNOWN`
- `CONTRADICTED`

If an agent claims "the market will grow by 80%", the system tags it as `MODELLED_ASSUMPTION` or `INFERENCE` rather than presenting it as grounded fact.

### Isolated Subprocess Financial Sandbox
Instead of asking an LLM to guess financial survivability, Dossier isolates quantitative metrics into a deterministic Python 3 environment. The sandbox executes parametric calculations for:
- LTV / CAC boundaries
- Payback period horizons
- Month-over-month compound churn decay
- Compute and inference cost scaling

---

## 4. Human-in-the-Loop Safety Gates

An agent should not trigger real-world actions on an unvalidated idea. 

When Dossier compiles its 7-day validation plan (such as drafting cold outreach emails to prospective B2B buyers or generating landing page assets), it encounters a **Dual-Key Human Approval Gate**. Execution halts and returns control to the operator. Only upon explicit human sign-off can external integrations proceed.

---

## 5. What Broke & What We Learned Building with TrueForge and Qodo

### 1. Subprocess Isolation and Timeout Handling
During initial stress testing, long-running mathematical scripts risked blocking the orchestrator event loop. We implemented explicit timeout guards (10,000ms ceiling) and signal traps to ensure zero zombie processes or memory leaks.

### 2. Schema Rigidity Across Multi-Agent Debates
Free-form text debates between subagents quickly deteriorated into unstructured conversation. Enforcing strict Zod schemas on every turn allowed the Founder Synthesizer to reliably extract consensus metrics, disagreements, and risk scores.

### 3. Repository-Wide Code Review with Qodo
Using Qodo throughout the development workflow helped maintain strict standards across our TypeScript and Python bridge. Qodo flagged potential boundary exceptions in economic fuzzing inputs and enforced comprehensive type safety across our epistemic state machines before merging.

---

## 6. Project Links & Evidence

- **Live Application:** [https://dossier-ai.onrender.com](https://dossier-ai.onrender.com)
- **GitHub Repository:** [https://github.com/sanjeevafk/dossier](https://github.com/sanjeevafk/dossier)
- **Demo Video Walkthrough:** [Watch on Google Drive](https://drive.google.com/file/d/1y_5fLjF2D_S4T37TJLz4dXLyKNiB7Zxb/view?usp=sharing)
- **Agent Skill:** Packaged natively in `skills/dossier/SKILL.md`
- **MCP Server:** Available via `dossier.mcp.json`
