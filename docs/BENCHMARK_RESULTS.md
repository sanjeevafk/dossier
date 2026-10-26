# Dossier Domain-Aware Adversarial Benchmark Report

**Execution Date:** 2026-10-26T09:16:00.357Z  
**Agent Harness:** TrueForge Multi-Agent Runtime (File TF-007)  
**De-Noising:** 1 full runs per concept; Quality Gate 3 evaluates σ of per-concept mean scores  
**Overall Benchmark Runtime:** 240.90 seconds  
**Average Latency:** 60225 ms per full 6-agent adversarial evaluation  
**Verdict Expectation Fit:** 75% inside the plan's expected verdict range  
**Score Range:** 30–76 (mean 56.0)  
**Per-Run Dispersion σ:** 19.6  
**De-Noised Dispersion (σ):** 19.6 — QUALITY GATE 3 PASSED (≥ 18)  

---

## 1. Summary Benchmark Matrix (With Dimensional Breakdown)

| ID | Project / Concept | Domain Archetype | Resilience Score | Swarm Verdict | Feasibility (20%) | Demand (25%) | Economics (20%) | Adversarial (20%) | Rounds | Latency | Fatal Risk Flagged |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **BM-01** | AutoSOC2: Continuous AI Security Compliance Auditor | B2B Enterprise & Vertical SaaS | **76/100** | `BUILD_IF_VALIDATED` | 78% | 70% | 83% | 52% | 2 | 64645ms | Enterprise Procurement Deadlock: CTOs, Security Directors, VP Operations & Enterprise Buyers praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free. |
| **BM-02** | SwaraSetu: Offline Indic Clinical Triage (SIH26133) | Healthcare & Clinical Systems | **44/100** | `KILL` | 75% | 60% | 80% | 32% | 2 | 58949ms | EHR Gatekeeping & Malpractice Liability: Electronic Health Record vendors (Epic, Cerner) impose closed API walled gardens; diagnostic claims trigger intense medical liability. |
| **BM-03** | VanRakshak: Autonomous Drone Forest Patrolling | Hardware, Robotics & Autonomous Systems | **74/100** | `REFINE` | 80% | 70% | 92% | 34% | 2 | 59172ms | Bill-of-Materials (BoM) Margin Compression: Sensor payloads and battery thermal degradation compress hardware margins below 30% without recurring software attach rates. |
| **BM-04** | ChatNotes: AI Chrome Extension for Meeting Summaries | Consumer & Social Applications | **30/100** | `KILL` | 61% | 41% | 24% | 24% | 2 | 58135ms | Commoditization Hazard: Low defensibility thin wrapper over base foundation models. Hyperscalers or open-source extensions can replicate this within 48 hours with zero infrastructure cost. |

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
