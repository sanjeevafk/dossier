# Dossier Domain-Aware Adversarial Benchmark Report

**Execution Date:** 2026-10-25T21:38:03.473Z  
**Agent Harness:** TrueForge Multi-Agent Runtime (File TF-007)  
**De-Noising:** 1 full runs per concept; Quality Gate 3 evaluates σ of per-concept mean scores  
**Overall Benchmark Runtime:** 1259.89 seconds  
**Average Latency:** 89992 ms per full 6-agent adversarial evaluation  
**Verdict Expectation Fit:** 29% inside the plan's expected verdict range  
**Score Range:** 12–51 (mean 26.7)  
**Per-Run Dispersion σ:** 9.1  
**De-Noised Dispersion (σ):** 9.1 — ⚠ QUALITY GATE 3 FAILED (< 18)  

---

## 1. Summary Benchmark Matrix (With Dimensional Breakdown)

| ID | Project / Concept | Domain Archetype | Resilience Score | Swarm Verdict | Feasibility (20%) | Demand (25%) | Economics (20%) | Adversarial (20%) | Rounds | Latency | Fatal Risk Flagged |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **BM-01** | AutoSOC2: Continuous AI Security Compliance Auditor | B2B Enterprise & Vertical SaaS | **26/100** | `KILL` | 39% | 33% | 47% | 22% | 2 | 88637ms | Incumbent Commoditization & Native Moat Deficit: Vanta, Drata, Secureframe, and Sprinto already own the system of record, customer relationships, auditor network, and native read-only integrations into AWS, GitHub, and Okta. Adding an LLM script to draft remediation PRs or synthesize compliance docs is an obvious single-quarter roadmap feature for incumbents, not a standalone venture. |
| **BM-02** | SwaraSetu: Offline Indic Clinical Triage (SIH26133) | Healthcare & Clinical Systems | **27/100** | `KILL` | 27% | 30% | 57% | 22% | 2 | 94785ms | Architectural & Thermodynamic Contradiction: Claims 'offline-first' local voice triage across 22+ Indic languages on low-spec frontline ASHA Android hardware while simultaneously depending on Sarvam AI cloud-hosted APIs and WhatsApp (which strictly requires active internet connectivity and cannot run offline on-device speech-to-text models). |
| **BM-03** | VanRakshak: Autonomous Drone Forest Patrolling | Hardware, Robotics & Autonomous Systems | **29/100** | `KILL` | 27% | 28% | 47% | 28% | 2 | 88984ms | Severe thermodynamic and battery degradation under ambient canopy microclimates: Indian tiger reserves and dry deciduous forests consistently operate at 42°C–48°C ambient in fire season. High C-rate discharge powering edge inference compute (e.g., Jetson running YOLOv8) alongside swarm propulsion triggers thermal runaway protection or collapses standard LiPo/Li-ion cycle life to under 40 cycles, rendering the $1,500/month DaaS hardware lease economically insolvent. |
| **BM-04** | ChatNotes: AI Chrome Extension for Meeting Summaries | Consumer & Social Applications | **17/100** | `KILL` | 39% | 18% | 17% | 14% | 2 | 85208ms | Zero structural defensibility: thin wrapper over frontier models is trivially replicable as a native platform feature. |
| **BM-05** | FreelanceShield: Milestone Escrow Smart Contracts | Web3 & Decentralized Infrastructure | **28/100** | `KILL` | 44% | 32% | 48% | 22% | 2 | 87891ms | Subjective Milestone Oracle Problem: Decentralized oracles (e.g., UMA, Kleros) cannot deterministically verify non-deterministic off-chain software deliverable quality, leading to rampant 51% juror bribery, Sybil collusion, and subjective arbitration capture. |
| **BM-06** | PlateCost: Restaurant Wholesale Supplier Price Auditor | B2B Enterprise & Vertical SaaS | **29/100** | `KILL` | 53% | 38% | 54% | 22% | 2 | 96450ms | Incumbent Feature Commoditization & Zero Moat: Ingesting paper invoices via OCR/SMS and tracking wholesale food price variance is an inevitable, trivial feature addition for dominant restaurant back-of-house ERPs, inventory platforms, and procurement systems (Toast, Restaurant365, MarginEdge, MarketMan, xtraCHEF by Toast). xtraCHEF already ingests paper invoices via OCR to monitor line-item food costs, instantly rendering a standalone $149/mo point solution redundant. |
| **BM-07** | VeriCode: Formal Verification PR Review Agent | DeepTech & Formal Research | **35/100** | `KILL` | 28% | 30% | 48% | 39% | 2 | 86885ms | Inference Latency & VRAM Wall: Heavy transformer passes incur per-query compute costs that consume >40% of subscription revenue at production scale. |
| **BM-08** | VoltShare: Residential EV Charger Peer Sharing | Hardware, Robotics & Autonomous Systems | **18/100** | `KILL` | 27% | 14% | 43% | 18% | 2 | 91475ms | Severe mechanical and electrical fire liability: Level-2 EV charging draws high sustained amperage (32A-48A @ 240V, 7.7kW-11.5kW) over 6-8 continuous hours; a third-party intermediary plug-in dongle introduces contact resistance, thermal runaway, and arc fault risks in residential driveways without industrial thermal management or utility-grade metering. |
| **BM-09** | TruckDesk: Voice-First CRM for Roofers & Plumbers | B2B Enterprise & Vertical SaaS | **28/100** | `KILL` | 47% | 36% | 47% | 22% | 2 | 92656ms | Incumbent feature commoditization: Massive vertical ERP incumbents (ServiceTitan, Jobber, Housecall Pro, FieldEdge) already own the systems of record, dispatch boards, customer records, and payment processing rails. Adding a voice dictation/transcription input interface (via standard mobile speech APIs or Whisper-based SDKs) is a quarterly sprint feature for them, completely evaporating any standalone CRM wedge. |
| **BM-10** | DunningBot: Smart Stripe Churn Recovery Agent | B2B Enterprise & Vertical SaaS | **27/100** | `KILL` | 47% | 32% | 47% | 22% | 2 | 94467ms | Native Incumbent Commoditization: Stripe Billing natively offers Smart Retries (machine-learning retry schedule based on billions of cross-network data points), automatic card updater (tokenized network sync with Visa/Mastercard/Amex), customer portal links, and automated email dunning workflows out-of-the-box at zero additional engineering overhead. |
| **BM-11** | CommuniAid: City-Wide Volunteer Relief Coordination | General Commercial Product | **12/100** | `KILL` | 27% | 12% | 10% | 10% | 2 | 86516ms | Terminal Unit Economics ($0 Revenue vs Non-Zero CAC & Variable Costs): Under the General Commercial Product archetype with subscription/transaction pricing, a $0/mo pricing model with a $60 CAC, recurring SMS costs, and continuous server/token overhead yields an infinite payback period (999+ months), an LTV/CAC ratio of 0x, and a 24-month survival probability of 0%. |
| **BM-12** | ViralThreads: AI Tweet Composer Chrome Extension | Consumer & Social Applications | **17/100** | `KILL` | 30% | 23% | 18% | 14% | 2 | 87724ms | Zero structural defensibility: thin wrapper over frontier models is trivially replicable as a native platform feature. |
| **BM-13** | LedgerIQ: Revenue Leak Anomaly Copilot | General Commercial Product | **51/100** | `REFINE` | 78% | 38% | 64% | 39% | 2 | 91171ms | Reconciliation Paradox & Churn Trap: Revenue reconciliation is an episodic cleanup problem, not a continuous workflow. Once an organization runs LedgerIQ and captures historical unbilled overages, misapplied discounts, and dunning gaps, the ongoing perceived value plummets drastically, triggering immediate cancellation or pause. |
| **BM-14** | ClaimPilot: AI Claim Pre-Fill for P&C Adjusters | General Commercial Product | **30/100** | `KILL` | 53% | 36% | 57% | 22% | 2 | 87032ms | Carrier-Compliant Line-Item Moat Deficit: Carrier-compliant property estimates are dictated by proprietary estimating taxonomy databases (predominantly Verisk/Xactware's Xactimate price lists and CoreLogic's Symbility). Standard LLM vision/text ingestion cannot lawfully output or bind official Xactimate/Symbility line items and unit pricing without direct OEM licensing agreements, which are notoriously cost-prohibitive or outright refused to hostile disintermediation layers. |

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
