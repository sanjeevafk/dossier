---
name: dossier
description: Adversarial multi-agent idea intelligence and stress testing for startup concepts, product features, and technical proposals. Uses a 6-agent swarm, Stanford CS329A epistemic verification, isolated Python unit economics sandbox, and dual-key human approval checkpoints.
---

# Dossier: Adversarial Idea Intelligence Agent Skill

Use this skill whenever you need to rigorously stress-test, validate, or cross-examine a new startup idea, feature proposal, business model, or architecture design.

Instead of flattering you with generic praise, Dossier deploys a 6-agent domain-aware swarm to actively seek fatal flaws before engineering capital is spent.

---

## When to Use This Skill

- **Idea Discovery & Validation:** When evaluating whether a new product, startup, or feature is worth building.
- **Epistemic Evidence Audit:** When separating verified facts and deterministic computations from ungrounded assumptions.
- **Unit Economics Stress Testing:** When calculating LTV, CAC, payback period, and gross margin in an isolated sandbox.
- **Red Team Cross-Examination:** When probing fatal regulatory, technical, or customer adoption risks.
- **Human Safety Checkpoints:** When preparing high-risk validation experiments (e.g. pilot LOIs, smoke tests) requiring dual-key operator authorization.

---

## Invocation Modes

### Mode 1: CLI Execution (Fast Local Execution)

Run Dossier directly in your terminal:

```bash
# Evaluate any concept
pnpm cli evaluate \
  --title "Your Idea Title" \
  --summary "Detailed problem, solution, and workflow summary" \
  --audience "Target Customer Vertical" \
  --monetization "$49/mo subscription or contract model" \
  --pricing 49 \
  --cac 150
```

### Mode 2: MCP Server (Model Context Protocol)

Add Dossier to your agent harness or Claude Desktop configuration (`claude_desktop_config.json` or `.mcp.json`):

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

Or run directly via `tsx`:
```json
{
  "mcpServers": {
    "dossier": {
      "command": "npx",
      "args": ["tsx", "/path/to/dossier/src/mcp-server.ts"]
    }
  }
}
```

---

## Available MCP Tools

### 1. `evaluate_idea`
Runs the complete 6-agent domain adversarial swarm and compiles a structured intelligence dossier.
- **Arguments:**
  - `title` *(string, required)*: Concept name.
  - `summary` *(string, required)*: Problem and solution description.
  - `targetAudience` *(string, required)*: Customer segment.
  - `monetization` *(string, required)*: Revenue model.
  - `pricing` *(number, optional)*: Monthly price in USD.
  - `cac` *(number, optional)*: Estimated CAC in USD.

### 2. `stress_test_concept`
Runs the 5-invariant adversarial stress suite evaluating prompt injection defense, impossible physics detection, sandbox isolation, and burst concurrency.

### 3. `run_sandbox_economics`
Executes an isolated Python 3 subprocess in a sandboxed runtime to deterministically calculate LTV, CAC, and payback bounds.

### 4. `verify_claims_epistemics`
Audits an array of claims against the 7 Stanford CS329A epistemic states (`VERIFIED_FACT`, `VERIFIED_COMPUTATION`, `EXTERNAL_EVIDENCE`, `MODELLED_ASSUMPTION`, `INFERENCE`, `UNKNOWN`, `CONTRADICTED`).

---

## 7-Tier Epistemic Standard (Stanford CS329A)

Dossier enforces a strict epistemic taxonomy:
1. `VERIFIED_FACT`: Backed by reputable, verified external primary records.
2. `VERIFIED_COMPUTATION`: Deterministic math computed in an isolated sandbox (Exit Code 0).
3. `EXTERNAL_EVIDENCE`: Sourced third-party signal (e.g. Polymarket odds, Reddit data) not yet verified.
4. `MODELLED_ASSUMPTION`: Founder or agent hypothesis without empirical proof.
5. `INFERENCE`: Deductive logical reasoning derived from domain patterns.
6. `UNKNOWN`: Unquantified black-box parameter.
7. `CONTRADICTED`: Two opposing claims clashing without resolution.

> **Zero-Sycophancy Rule:** Unvalidated assumptions, LLM agreements, and inferences can **never** be marked as `VERIFIED`. Unresolved fatal assumptions constrain the verdict to `BUILD_IF_VALIDATED` or `KILL`.
