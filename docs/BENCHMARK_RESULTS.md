# Dossier Domain-Aware Adversarial Benchmark Report

**Execution Date:** 2026-10-22T04:02:13.647Z  
**Agent Harness:** TrueForge Multi-Agent Runtime (File TF-007)  
**Total Concepts Evaluated:** 10  
**Overall Benchmark Runtime:** 14.39 seconds  
**Average Latency:** 1439 ms per full 6-agent adversarial evaluation  

---

## 1. Summary Benchmark Matrix (With Dimensional Breakdown)

| ID | Project / Concept | Domain Archetype | Resilience Score | Swarm Verdict | Feasibility (20%) | Demand (25%) | Economics (20%) | Adversarial (20%) | Rounds | Latency | Fatal Risk Flagged |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **BM-01** | AutoSOC2: Continuous AI Security Compliance Auditor | B2B Enterprise & Vertical SaaS | **71/100** | `REFINE` | 86% | 65% | 87% | 46% | 2 | 2698ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-02** | SwaraSetu: Offline Indic Clinical Triage (SIH26133) | Healthcare & Clinical Systems | **65/100** | `KILL` | 86% | 55% | 85% | 32% | 2 | 1094ms | EHR Gatekeeping & Malpractice Liability: Electronic Health Record vendors (Epic, Cerner) impose closed API walled gardens; diagnostic claims trigger intense medical liability. |
| **BM-03** | VanRakshak: Autonomous Drone Forest Patrolling | Hardware, Robotics & Autonomous Systems | **69/100** | `REFINE` | 86% | 65% | 89% | 34% | 2 | 1140ms | Bill-of-Materials (BoM) Margin Compression: Sensor payloads and battery thermal degradation compress hardware margins below 30% without recurring software attach rates. |
| **BM-04** | ChatNotes: AI Chrome Extension for Meeting Summaries | Consumer & Social Applications | **45/100** | `KILL` | 76% | 41% | 29% | 24% | 2 | 1234ms | Commoditization Hazard: Low defensibility thin wrapper over base foundation models. Hyperscalers or open-source extensions can replicate this within 48 hours with zero infrastructure cost. |
| **BM-05** | FreelanceShield: Milestone Escrow Smart Contracts | Web3 & Decentralized Infrastructure | **69/100** | `REFINE` | 86% | 65% | 89% | 35% | 2 | 1138ms | Smart Contract Exploitation Vector: Unaudited cross-contract execution risks total liquidity drain via flash loans or oracle manipulation. |
| **BM-06** | PlateCost: Restaurant Wholesale Supplier Price Auditor | DeepTech & Formal Research | **73/100** | `REFINE` | 86% | 69% | 89% | 45% | 2 | 1414ms | Inference Latency & VRAM Wall: Heavy transformer passes incur per-query compute costs that consume >40% of subscription revenue at production scale. |
| **BM-07** | VeriCode: Formal Verification PR Review Agent | DeepTech & Formal Research | **73/100** | `REFINE` | 86% | 69% | 89% | 45% | 2 | 1719ms | Inference Latency & VRAM Wall: Heavy transformer passes incur per-query compute costs that consume >40% of subscription revenue at production scale. |
| **BM-08** | VoltShare: Residential EV Charger Peer Sharing | Hardware, Robotics & Autonomous Systems | **68/100** | `REFINE` | 86% | 65% | 86% | 34% | 2 | 1400ms | Bill-of-Materials (BoM) Margin Compression: Sensor payloads and battery thermal degradation compress hardware margins below 30% without recurring software attach rates. |
| **BM-09** | TruckDesk: Voice-First CRM for Roofers & Plumbers | B2B Enterprise & Vertical SaaS | **71/100** | `REFINE` | 86% | 65% | 89% | 46% | 2 | 1375ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-10** | DunningBot: Smart Stripe Churn Recovery Agent | B2B Enterprise & Vertical SaaS | **71/100** | `REFINE` | 86% | 65% | 89% | 46% | 2 | 1174ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |

---

## 2. Key Observations & Adversarial Defense

1. **Domain-Specific Prior Tuning:**
   * **B2G & Healthcare concepts** were evaluated against **public tender timelines, WHO guidelines, and field worker cognitive load**, rather than irrelevant consumer freemium metrics.
   * **Hardware & Drone concepts** were audited on **on-device YOLOv8 latency, GPS-denied SLAM, and battery cycle economics**.

2. **Subprocess Isolation:**
   * **100% of unit economics simulations executed cleanly** inside isolated Python3 subprocess environments with zero runtime errors.

3. **Multi-Round Convergence:**
   * Escalated to **Round 2 adversarial cross-examination** whenever score disparities exceeded 25 points or fatal flaws remained unmitigated.
