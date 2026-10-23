# Dossier Domain-Aware Adversarial Benchmark Report

**Execution Date:** 2026-10-23T06:42:37.045Z  
**Agent Harness:** TrueForge Multi-Agent Runtime (File TF-007)  
**De-Noising:** 3 full runs per concept; Quality Gate 3 evaluates σ of per-concept mean scores  
**Overall Benchmark Runtime:** 38.79 seconds  
**Average Latency:** 923 ms per full 6-agent adversarial evaluation  
**Verdict Expectation Fit:** 86% inside the plan's expected verdict range  
**Score Range:** 22–75 (mean 60.1)  
**Per-Run Dispersion σ:** 18.8 / 18.8 / 18.8  
**De-Noised Dispersion (σ):** 18.8 — QUALITY GATE 3 PASSED (≥ 18)  

---

## 1. Summary Benchmark Matrix (With Dimensional Breakdown)

| ID | Project / Concept | Domain Archetype | Resilience Score | Swarm Verdict | Feasibility (20%) | Demand (25%) | Economics (20%) | Adversarial (20%) | Rounds | Latency | Fatal Risk Flagged |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **BM-01** | AutoSOC2: Continuous AI Security Compliance Auditor | B2B Enterprise & Vertical SaaS | **72/100** | `REFINE` | 78% | 65% | 83% | 52% | 2 | 1068ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-02** | SwaraSetu: Offline Indic Clinical Triage (SIH26133) | Healthcare & Clinical Systems | **44/100** | `KILL` | 75% | 55% | 80% | 32% | 2 | 797ms | EHR Gatekeeping & Malpractice Liability: Electronic Health Record vendors (Epic, Cerner) impose closed API walled gardens; diagnostic claims trigger intense medical liability. |
| **BM-03** | VanRakshak: Autonomous Drone Forest Patrolling | Hardware, Robotics & Autonomous Systems | **70/100** | `REFINE` | 80% | 65% | 92% | 34% | 2 | 806ms | Bill-of-Materials (BoM) Margin Compression: Sensor payloads and battery thermal degradation compress hardware margins below 30% without recurring software attach rates. |
| **BM-04** | ChatNotes: AI Chrome Extension for Meeting Summaries | Consumer & Social Applications | **30/100** | `KILL` | 61% | 41% | 24% | 24% | 2 | 803ms | Commoditization Hazard: Low defensibility thin wrapper over base foundation models. Hyperscalers or open-source extensions can replicate this within 48 hours with zero infrastructure cost. |
| **BM-05** | FreelanceShield: Milestone Escrow Smart Contracts | Web3 & Decentralized Infrastructure | **67/100** | `REFINE` | 80% | 65% | 87% | 35% | 2 | 929ms | Smart Contract Exploitation Vector: Unaudited cross-contract execution risks total liquidity drain via flash loans or oracle manipulation. |
| **BM-06** | PlateCost: Restaurant Wholesale Supplier Price Auditor | B2B Enterprise & Vertical SaaS | **74/100** | `REFINE` | 86% | 65% | 85% | 52% | 2 | 1113ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-07** | VeriCode: Formal Verification PR Review Agent | DeepTech & Formal Research | **74/100** | `REFINE` | 78% | 69% | 87% | 45% | 2 | 891ms | Inference Latency & VRAM Wall: Heavy transformer passes incur per-query compute costs that consume >40% of subscription revenue at production scale. |
| **BM-08** | VoltShare: Residential EV Charger Peer Sharing | Hardware, Robotics & Autonomous Systems | **66/100** | `REFINE` | 72% | 65% | 82% | 34% | 2 | 1311ms | Bill-of-Materials (BoM) Margin Compression: Sensor payloads and battery thermal degradation compress hardware margins below 30% without recurring software attach rates. |
| **BM-09** | TruckDesk: Voice-First CRM for Roofers & Plumbers | B2B Enterprise & Vertical SaaS | **74/100** | `REFINE` | 86% | 65% | 89% | 52% | 2 | 1088ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-10** | DunningBot: Smart Stripe Churn Recovery Agent | B2B Enterprise & Vertical SaaS | **75/100** | `BUILD_IF_VALIDATED` | 86% | 65% | 90% | 52% | 2 | 845ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-11** | CommuniAid: City-Wide Volunteer Relief Coordination | General Commercial Product | **22/100** | `KILL` | 76% | 65% | 10% | 22% | 2 | 885ms | Terminal unit economics insolvency: Acquiring users at $60 produces only $0 LTV. |
| **BM-12** | ViralThreads: AI Tweet Composer Chrome Extension | Consumer & Social Applications | **30/100** | `KILL` | 61% | 41% | 25% | 24% | 2 | 869ms | Commoditization Hazard: Low defensibility thin wrapper over base foundation models. Hyperscalers or open-source extensions can replicate this within 48 hours with zero infrastructure cost. |
| **BM-13** | LedgerIQ: Revenue Leak Anomaly Copilot | General Commercial Product | **72/100** | `REFINE` | 86% | 65% | 92% | 41% | 2 | 822ms | Distribution Desert: Lack of an asymmetric, proprietary top-of-funnel acquisition channel leads to zero-traction stagnation. |
| **BM-14** | ClaimPilot: AI Claim Pre-Fill for P&C Adjusters | General Commercial Product | **72/100** | `REFINE` | 86% | 65% | 92% | 41% | 2 | 700ms | Distribution Desert: Lack of an asymmetric, proprietary top-of-funnel acquisition channel leads to zero-traction stagnation. |

---

## 2. Key Observations & Adversarial Defense

1. **Domain-Specific Prior Tuning:**
   * **B2G & Healthcare concepts** were evaluated against **public tender timelines, WHO guidelines, and field worker cognitive load**, rather than irrelevant consumer freemium metrics.
   * **Hardware & Drone concepts** were audited on **on-device YOLOv8 latency, GPS-denied SLAM, and battery cycle economics**.

2. **Stochastic Sandbox & Crossfire:**
   * **Monte Carlo percentiles (survival, P10 insolvency tail, payback spread) differentiate concept economics beyond point estimates.**
   * **Round 2 crossfire cites stressed sandbox replays and competitor recon as tool evidence; defeated defenders concede confidence points.**

3. **Multi-Round Convergence:**
   * Escalated to **Round 2 adversarial cross-examination** whenever score disparities exceeded 25 points or fatal flaws remained unmitigated.
