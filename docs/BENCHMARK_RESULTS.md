# Dossier Domain-Aware Adversarial Benchmark Report

**Execution Date:** 2026-10-23T04:10:22.980Z  
**Agent Harness:** TrueForge Multi-Agent Runtime (File TF-007)  
**De-Noising:** 3 full runs per concept; Quality Gate 3 evaluates σ of per-concept mean scores  
**Overall Benchmark Runtime:** 747.80 seconds  
**Average Latency:** 24927 ms per full 6-agent adversarial evaluation  
**Verdict Expectation Fit:** 70% inside the plan's expected verdict range  
**Score Range:** 30–67 (mean 55.5)  
**Per-Run Dispersion σ:** 14.2 / 10.8 / 12.5  
**De-Noised Dispersion (σ):** 11.5 — ⚠ QUALITY GATE 3 FAILED (< 18)  

---

## 1. Summary Benchmark Matrix (With Dimensional Breakdown)

| ID | Project / Concept | Domain Archetype | Resilience Score | Swarm Verdict | Feasibility (20%) | Demand (25%) | Economics (20%) | Adversarial (20%) | Rounds | Latency | Fatal Risk Flagged |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **BM-01** | AutoSOC2: Continuous AI Security Compliance Auditor | B2B Enterprise & Vertical SaaS | **51/100** | `REFINE` | 54% | 61% | 72% | 41% | 2 | 27080ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-02** | SwaraSetu: Offline Indic Clinical Triage (SIH26133) | Healthcare & Clinical Systems | **39/100** | `KILL` | 51% | 47% | 70% | 32% | 2 | 27446ms | EHR Gatekeeping & Malpractice Liability: Electronic Health Record vendors (Epic, Cerner) impose closed API walled gardens; diagnostic claims trigger intense medical liability. |
| **BM-03** | VanRakshak: Autonomous Drone Forest Patrolling | Hardware, Robotics & Autonomous Systems | **60/100** | `REFINE` | 80% | 51% | 81% | 34% | 2 | 29803ms | Bill-of-Materials (BoM) Margin Compression: Sensor payloads and battery thermal degradation compress hardware margins below 30% without recurring software attach rates. |
| **BM-04** | ChatNotes: AI Chrome Extension for Meeting Summaries | Consumer & Social Applications | **30/100** | `KILL` | 74% | 36% | 24% | 24% | 2 | 25676ms | Commoditization Hazard: Low defensibility thin wrapper over base foundation models. Hyperscalers or open-source extensions can replicate this within 48 hours with zero infrastructure cost. |
| **BM-05** | FreelanceShield: Milestone Escrow Smart Contracts | Web3 & Decentralized Infrastructure | **60/100** | `REFINE` | 80% | 56% | 73% | 35% | 2 | 25542ms | Smart Contract Exploitation Vector: Unaudited cross-contract execution risks total liquidity drain via flash loans or oracle manipulation. |
| **BM-06** | PlateCost: Restaurant Wholesale Supplier Price Auditor | B2B Enterprise & Vertical SaaS | **63/100** | `REFINE` | 52% | 58% | 85% | 52% | 2 | 23131ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-07** | VeriCode: Formal Verification PR Review Agent | DeepTech & Formal Research | **63/100** | `REFINE` | 78% | 53% | 83% | 45% | 2 | 30519ms | Inference Latency & VRAM Wall: Heavy transformer passes incur per-query compute costs that consume >40% of subscription revenue at production scale. |
| **BM-08** | VoltShare: Residential EV Charger Peer Sharing | Hardware, Robotics & Autonomous Systems | **57/100** | `REFINE` | 54% | 61% | 82% | 34% | 2 | 22411ms | Bill-of-Materials (BoM) Margin Compression: Sensor payloads and battery thermal degradation compress hardware margins below 30% without recurring software attach rates. |
| **BM-09** | TruckDesk: Voice-First CRM for Roofers & Plumbers | B2B Enterprise & Vertical SaaS | **65/100** | `REFINE` | 58% | 61% | 88% | 52% | 2 | 18184ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-10** | DunningBot: Smart Stripe Churn Recovery Agent | B2B Enterprise & Vertical SaaS | **67/100** | `REFINE` | 70% | 57% | 84% | 52% | 2 | 19475ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |

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
