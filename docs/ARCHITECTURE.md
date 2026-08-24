# Dossier System Architecture & Engineering Blueprint

> **"Make AI try to kill your idea before the market does."**  
> Built for the **WeMakeDevs TrueForge Agent Harness Hackathon (August 2026)**.

---

## 1. System Overview

**Dossier** is an autonomous adversarial multi-agent idea intelligence platform built on the **TrueForge Agent Harness**. Rather than providing superficial, sycophantic praise, Dossier deploys **six specialized subagents** to stress-test startup concepts, hackathon projects, research proposals, and SIH problem statements. 

Dossier grounds every evaluation in real-world evidence by combining:
1. **Live Multi-Agent LLM Routing** via **OrcaRouter** (`orcarouter/auto`).
2. **Polymarket Live Prediction Market Oracle** for real-time macro sentiment and probability odds.
3. **Agent Reach & MCP Tool Integration** for live community sentiment across Reddit, Twitter/X, and Hacker News.
4. **Sandboxed Unit Economics Simulation** executing Python unit economics scripts inside isolated subprocess boundaries.
5. **TrueForge Dual-Key Human Approval Checkpoints** that halt irreversible real-world transmissions until explicit operator authorization.

```mermaid
flowchart TD
    User([User / Developer / Founder]) -->|Idea Input / Repo Scan| Intake[Dossier Intake Engine]
    
    subgraph ReconPhase [Recon & External Tooling Layer]
        Intake --> WebRecon[Market Intelligence Tool]
        Intake --> Polymarket[Polymarket Live Oracle]
        Intake --> AgentReach[Agent Reach Community Intel]
        Intake --> MCPClient[Native MCP Client Manager]
    end

    subgraph SwarmEngine [TrueForge Adversarial Multi-Agent Swarm]
        ReconPhase --> Agent1["01 // Market Analyst"]
        ReconPhase --> Agent2["02 // Customer Advocate"]
        ReconPhase --> Agent3["03 // Technical Architect"]
        ReconPhase --> Agent4["04 // Investor"]
        ReconPhase --> Agent5["05 // Red Team (Chief Adversary)"]
        ReconPhase --> Agent6["06 // Domain Expert"]
    end

    subgraph DebateLayer [Adversarial Cross-Examination]
        Agent1 & Agent2 & Agent3 & Agent4 & Agent5 & Agent6 --> CrossDebate[Debate & Contradiction Resolution Engine]
    end

    subgraph SandboxLayer [TrueForge Isolated Sandbox]
        CrossDebate --> PythonSandbox[Python3 Unit Economics Subprocess]
    end

    subgraph SynthesisLayer [Executive Dossier & Safety Gates]
        PythonSandbox --> Synthesizer[Executive Synthesizer]
        Synthesizer --> DossierReport[Compiled Intelligence Dossier]
        Synthesizer --> ApprovalGates[Dual-Key Human Approval Checkpoints]
    end

    ApprovalGates -->|Operator Authorize / Veto| Outbound[External Action Execution]
```

---

## 2. The 6 Specialized Subagent Personas

Dossier avoids single-prompt hallucinations by decomposing the problem into six distinct, competing perspectives:

| Role ID | Role Name | Primary Mandate | Key Metrics Audited |
| :--- | :--- | :--- | :--- |
| **01** | **Market Analyst** | Competition mapping, market size, whitespace, search signals. | TAM/SAM, competitor density, market timing. |
| **02** | **Customer Advocate** | User pain, adoption friction, switching costs, habit inertia. | Workflow disruption, willingness-to-pay (WTP). |
| **03** | **Technical Architect** | Engineering feasibility, compute/API unit economics, sandbox safety. | Monthly inference token burn, latency, edge vs cloud. |
| **04** | **Investor** | Business model viability, defensibility, pricing power, venture margins. | Gross margin, CAC payback period, LTV/CAC ratio. |
| **05** | **Red Team** | **Chief Adversary.** Uncovers fatal flaws, churn traps, regulatory risks. | Churn probability, platform risk, distribution death traps. |
| **06** | **Domain Expert** | Dynamic vertical specialist tuned to the specific industry/PS. | Sector-specific compliance, regulatory standards (e.g. WHO IMCI, DGCA). |

---

## 3. Adversarial Debate & Contradiction Engine

A core innovation in Dossier is the **Contradiction Surface**. In typical AI architectures, models output averaged responses. Dossier explicitly forces subagents to cross-examine and challenge each other's assumptions:

```text
[RED TEAM]           "Freemium conversion in this category is historically <2%, making CAC payback unsustainable."
        vs
[CUSTOMER ADVOCATE]  "High-intent users express immediate willingness to pay $49/mo to save 5+ hours weekly."
        ➔
[CONTRADICTION]      UNRESOLVED CONFLICT // REQUIRES VALIDATION
[GUIDANCE]           Deploy an unbranded smoke-test landing page to measure credit card intent before building.
```

---

## 4. Live Tooling, Oracles & MCP Integration

### A. Polymarket Prediction Market Oracle (`src/tools/polymarket.ts`)
Queries Polymarket's open Gamma API (`https://gamma-api.polymarket.com/events`) with zero API key dependencies to pull real-time trading volumes, betting odds, and crowd-sourced probability for macro tech trends.

### B. Agent Reach Social Intelligence (`src/tools/search.ts`)
Integrates the `agent-reach` engine to inspect community discussions across Reddit (`r/startups`, `r/SaaS`), Hacker News, Twitter/X, and Jina Reader to detect real user sentiment and competitor churn complaints.

### C. Model Context Protocol Client (`src/tools/mcp.ts` & `dossier.mcp.json`)
Implements `@modelcontextprotocol/sdk` to spawn and manage external MCP servers via STDIO transports:
- `@modelcontextprotocol/server-filesystem` (Isolated dossier export storage)
- `@modelcontextprotocol/server-github` (Repo inspection and code verification)
- `@modelcontextprotocol/server-brave-search` (Live web research)

### D. Isolated Subprocess Sandbox Runner (`src/tools/sandbox.ts`)
Compiles financial simulations into standalone Python scripts and executes them inside isolated temporary directories (`/tmp/trueforge-sandbox-*`) with strict execution timeouts:
- Calculates Customer Lifetime Value ($\text{LTV} = \frac{\text{Monthly Price}}{\text{Monthly Churn}}$).
- Calculates CAC Payback Period ($\text{Payback} = \frac{\text{CAC}}{\text{Monthly Price}}$).
- Simulates Monthly Token / Compute Infrastructure Burn under concurrent user load.

---

## 5. Human-in-the-Loop Dual-Key Safety Checkpoints

Dossier enforces TrueForge safety standards by halting all irreversible actions at human verification gates:
- **`COLD_OUTREACH_EMAIL`**: Pre-drafts 20 personalized pilot letters to prospective design partners, but halts execution until the operator clicks `AUTHORIZE`.
- **`SMOKE_TEST_LANDING_PAGE`**: Generates intent-capture landing page specs and ad campaigns, requiring explicit human sign-off before spending any ad budget.

---

## 6. Project Structure

```
dossier/
├── dossier.mcp.json          # Native MCP Server Configuration
├── public/
│   └── index.html            # Classified Intelligence Terminal Web UI
├── src/
│   ├── cli.ts                # Commander CLI runner (`pnpm cli evaluate`)
│   ├── config/
│   │   └── prompts.ts        # 6 Specialized Subagent System Prompts
│   ├── core/
│   │   └── swarm.ts          # IdeaSwarmOrchestrator Multi-Agent Pipeline
│   ├── index.ts              # Core SDK entrypoint
│   ├── server.ts             # Express REST API Server (`/api/evaluate`, `/api/approval`)
│   ├── services/
│   │   └── llm.ts            # OrcaRouter Live Inference Service
│   ├── tools/
│   │   ├── mcp.ts            # DossierMCPManager (@modelcontextprotocol/sdk)
│   │   ├── polymarket.ts     # Polymarket Live Prediction Market Oracle
│   │   ├── sandbox.ts        # TrueForge Python Subprocess Sandbox
│   │   └── search.ts         # Market Recon & Agent Reach Social Intel
│   └── types/
│       └── index.ts          # TypeScript Definitions
├── test/
│   ├── mcp.test.mjs          # MCP Client Manager Unit Tests
│   ├── polymarket.test.mjs   # Polymarket Prediction Oracle Tests
│   └── swarm.test.mjs        # Sandbox & Swarm Orchestrator Tests
└── docs/
    ├── ARCHITECTURE.md       # Full System Architecture Blueprint
    ├── INVESTIGATION_RUNS.md # Real-World Project Stress-Test Reports
    └── HACKATHON_SUBMISSION.md # WeMakeDevs Submission Write-up
```
