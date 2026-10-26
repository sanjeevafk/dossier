# Dossier Domain-Aware Adversarial Benchmark Report

**Execution Date:** 2026-10-26T08:41:19.917Z  
**Agent Harness:** TrueForge Multi-Agent Runtime (File TF-007)  
**De-Noising:** 1 full runs per concept; Quality Gate 3 evaluates σ of per-concept mean scores  
**Overall Benchmark Runtime:** 596.63 seconds  
**Average Latency:** 149155 ms per full 6-agent adversarial evaluation  
**Verdict Expectation Fit:** 25% inside the plan's expected verdict range  
**Score Range:** 30–49 (mean 43.3)  
**Per-Run Dispersion σ:** 7.7  
**De-Noised Dispersion (σ):** 7.7 — ⚠ QUALITY GATE 3 FAILED (< 18)  

---

## 1. Summary Benchmark Matrix (With Dimensional Breakdown)

| ID | Project / Concept | Domain Archetype | Resilience Score | Swarm Verdict | Feasibility (20%) | Demand (25%) | Economics (20%) | Adversarial (20%) | Rounds | Latency | Fatal Risk Flagged |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **BM-01** | AutoSOC2: Continuous AI Security Compliance Auditor | B2B Enterprise & Vertical SaaS | **48/100** | `KILL` | 67% | 28% | 73% | 34% | 2 | 192255ms | INCUMBENT COMMODITIZATION IMMINENT: Vanta, Drata, Sprinto, and Secureframe already occupy this exact space with 3–7 year head starts, deep auditor relationships, pre-negotiated evidence templates, and native AWS/GitHub/Okta connectors. AutoSOC2 enters a market where the category leaders have already commoditized the 'continuous evidence collection' motion. 'AI-generated' is not a differentiator — Drata launched AI features in Q1 2024 and Vanta followed within 90 days. |
| **BM-02** | SwaraSetu: Offline Indic Clinical Triage (SIH26133) | Healthcare & Clinical Systems | **49/100** | `KILL` | 50% | 50% | 71% | 31% | 2 | 194454ms | MISDIAGNOSIS LIABILITY IS UNRESOLVED AND UNINSURABLE AT THIS PRICE POINT: At $1,200/yr/district, there is zero budget for clinical indemnity insurance. ASHA workers operating on AI-generated IMCI triage outputs carry no medical license — the moment a child dies following a 'refer' vs 'manage at home' decision influenced by SwaraSetu, liability cascades upward to the State Health Mission that procured it. No state NHM legal officer will sign this procurement without a liability shield that cannot exist at DPG grant pricing. |
| **BM-03** | VanRakshak: Autonomous Drone Forest Patrolling | Hardware, Robotics & Autonomous Systems | **46/100** | `KILL` | 47% | 40% | 68% | 39% | 2 | 151803ms | THERMAL BATTERY COLLAPSE IN OPERATIONAL ENVELOPE: LiPo/LiIon cells degrade catastrophically above 45°C ambient — exactly the conditions during active forest fires. Battery capacity drops 20–35% at 50°C; thermal runaway risk spikes. A drone dispatched to detect a fire is flying into the fire's thermal plume. No evidence of active battery cooling, solid-state cell alternatives, or operational ceiling constraints is provided. This is not a theoretical edge case — it is the primary use-case scenario. |
| **BM-04** | ChatNotes: AI Chrome Extension for Meeting Summaries | Consumer & Social Applications | **30/100** | `KILL` | 61% | 41% | 24% | 24% | 2 | 58107ms | Commoditization Hazard: Low defensibility thin wrapper over base foundation models. Hyperscalers or open-source extensions can replicate this within 48 hours with zero infrastructure cost. |

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
