---
name: dossier
description: Adversarial multi-agent idea intelligence and stress testing for startup concepts, product features, and technical proposals. Uses a 7-agent swarm, epistemic robustness verification, isolated Python unit economics sandbox, and evidence-driven validation checkpoints.
---

# Dossier: Adversarial Idea Intelligence Agent Skill

Use this skill whenever you need to rigorously stress-test, validate, or cross-examine a new startup idea, feature proposal, business model, or architecture design.

Instead of flattering you with generic praise, Dossier deploys a 7-agent domain-aware swarm to actively seek fatal flaws before engineering capital is spent.

---

## When to Use This Skill

- **Idea Discovery & Validation:** When evaluating whether a new product, startup, or feature is worth building.
- **Epistemic Evidence Audit:** When separating verified facts and deterministic computations from ungrounded assumptions.
- **Unit Economics Stress Testing:** When calculating LTV, CAC, payback period, and gross margin in an isolated sandbox.
- **Red Team Cross-Examination:** When probing fatal regulatory, technical, or customer adoption risks.
- **Validation Planning:** When converting high-value uncertainty into the cheapest falsifiable experiment.

---

## Invocation Modes

### Mode 1: CLI Execution

```bash
pnpm cli evaluate \
  --title "Your Idea Title" \
  --summary "Detailed problem, solution, and workflow summary" \
  --audience "Target Customer Vertical" \
  --monetization "$49/mo subscription or contract model" \
  --pricing 49 \
  --cac 150
```

### Mode 2: MCP Server

Add Dossier to your agent harness or Claude Desktop configuration (`claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "dossier": {
      "command": "node",
      "args": ["/path/to/dossier/dist/mcp-server.js"],
      "env": {
        "ORCAROUTER_API_KEY": "your_api_key_here",
        "ORCAROUTER_MODEL": "orcarouter/free"
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
Runs the complete 7-agent domain adversarial swarm and compiles a structured intelligence dossier.

### 2. `stress_test_concept`
Runs the adversarial stress suite evaluating prompt injection defense, impossible physics detection, sandbox isolation, and burst concurrency.

### 3. `run_sandbox_economics`
Executes an isolated Python 3 subprocess to deterministically calculate LTV, CAC, payback bounds, Monte Carlo outcomes, and sensitivity. Failed simulation is explicitly marked unavailable/degraded and must not be treated as economic evidence.

### 4. `verify_claims_epistemics`
Audits claims against the 7 epistemic states.

---

## 7-Tier Epistemic Standard

1. `VERIFIED_FACT`: Backed by reputable, citable external primary records.
2. `VERIFIED_COMPUTATION`: Deterministic math computed in an isolated sandbox (Exit Code 0); this validates execution, not the assumptions.
3. `EXTERNAL_EVIDENCE`: Sourced third-party signal not yet independently verified.
4. `MODELLED_ASSUMPTION`: Founder or agent hypothesis without empirical proof.
5. `INFERENCE`: Deductive logical reasoning derived from domain patterns.
6. `UNKNOWN`: Unquantified black-box risk or missing evidence.
7. `CONTRADICTED`: Conflicting or disproved claims with unresolved counter-evidence.

> **Zero-Sycophancy Rule:** Unvalidated assumptions, LLM agreement, and inference can never be upgraded to `VERIFIED_FACT`. Regulatory applicability also remains `UNKNOWN` unless supported by citable primary evidence.
