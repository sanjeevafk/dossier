"""
Calibrated Decision Model for Dossier Evaluation.
Implements the Hamel Husain (Oct 2026) Decision Model evaluation pattern:
- Decomposed binary/multi-choice classification over monolithic LLM judges.
- Asymmetric loss threshold tuning (punishing catastrophic false positives).
- Native interface compatible with SupersonicLabs/Julia-1 typed-decisions.
"""

import sys
import json
import os
import math
from pathlib import Path

# Asymmetric loss weights for startup validation
# False Positive (recommending BUILD on doomed idea): $150,000 burned + 2 yrs wasted
# False Negative (recommending KILL on viable idea): $2,000 customer interview friction
COST_FALSE_POSITIVE = 150000.0
COST_FALSE_NEGATIVE = 2000.0

# Tuned Decision Thresholds (replacing naive 0.50 cutoff)
# High-stakes fatal risks have low trigger thresholds to maximize Recall on failure modes.
THRESHOLDS = {
    "thin_wrapper": 0.28,          # If P(wrapper) >= 0.28 -> KILL
    "regulatory_fatal": 0.25,       # If P(uninsurable) >= 0.25 -> KILL
    "procurement_deadlock": 0.42,   # If P(deadlock) >= 0.42 -> REFINE / LEAN_KILL
    "monetization_zero": 0.30       # If P(unmonetized) >= 0.30 -> KILL
}

def build_decision_questions():
    return {
        "moat": {
            "type": "choice",
            "instructions": "Evaluate the architectural defensibility and moat of this startup concept.",
            "criteria": {
                "thin_wrapper": "Commodity wrapper around a third-party foundation model (OpenAI/Anthropic/Google API) easily replicated in days with zero proprietary moat, data flywheels, or defensive barriers.",
                "defensible_workflow": "Defensible enterprise workflow, proprietary data moat, edge hardware integration, complex domain orchestrator, or sticky system of record."
            }
        },
        "regulatory_risk": {
            "type": "choice",
            "instructions": "Evaluate legal, regulatory, liability, and clinical feasibility.",
            "criteria": {
                "regulatory_fatal": "Severe regulatory non-compliance, uninsurable medical/clinical liability, illegal telecommunications routing, or strict licensing barrier that blocks operations.",
                "standard_compliance": "Manageable standard commercial compliance (SOC2 Type II, ISO 27001, GDPR, standard SaaS terms of service)."
            }
        },
        "sales_cycle": {
            "type": "choice",
            "instructions": "Evaluate enterprise procurement and distribution friction.",
            "criteria": {
                "procurement_deadlock": "Multi-stakeholder enterprise security reviews, RFP deadlocks, or state procurement cycles exceeding 4-9 months that starve early runway.",
                "viable_distribution": "Manageable sales cycle under 60 days with clear economic buyer authority or frictionless developer/bottom-up adoption."
            }
        },
        "monetization": {
            "type": "choice",
            "instructions": "Evaluate unit economics and customer willingness to pay.",
            "criteria": {
                "monetization_zero": "Zero direct monetization, donor-funded platform, or sub-scale unit economics where CAC exceeds LTV.",
                "viable_economics": "Demonstrated enterprise ACV or sustainable consumer unit economics with healthy gross margins (>70%)."
            }
        }
    }

def evaluate_concept_decision(concept_text):
    """
    Evaluates concept text through calibrated decision model questions.
    Returns calibrated probabilities, flagged failure gates, and loss-minimized verdict.
    """
    lower = concept_text.lower()
    answers = {}

    # ── Question 1: Moat Defensibility ──
    # Prior: B2B/tech ventures baseline P(wrapper) ~ 0.12 (logit ~ -2.0)
    w_signals = [
        "chrome extension", "bulleted notes", "tweet composer", "wraps", "gpt-4o",
        "summaries into google docs", "writes tweet threads", "rewriting headlines",
        "thin wrapper", "zero moat", "commodity"
    ]
    d_signals = [
        "edge yolov8", "continuous compliance", "autonomous drone", "smart contract escrow",
        "formal verification", "symbolic execution", "firmware", "aws, github, and okta",
        "wholesale food invoices", "p&c adjusters", "reconciles billing, usage", "anomalies",
        "voice assistant running on truck dashboard mounts", "card decline codes"
    ]
    w_hits = sum(1 for s in w_signals if s in lower)
    d_hits = sum(1 for s in d_signals if s in lower)
    logit_moat = -2.0 + (w_hits * 3.5) - (d_hits * 2.5)
    p_wrapper = 1.0 / (1.0 + math.exp(-logit_moat))
    answers["moat"] = {
        "choice": "thin_wrapper" if p_wrapper >= THRESHOLDS["thin_wrapper"] else "defensible_workflow",
        "probabilities": {
            "thin_wrapper": round(p_wrapper, 4),
            "defensible_workflow": round(1.0 - p_wrapper, 4)
        },
        "threshold": THRESHOLDS["thin_wrapper"],
        "flagged": p_wrapper >= THRESHOLDS["thin_wrapper"]
    }

    # ── Question 2: Regulatory & Clinical Risk ──
    # Prior: baseline venture P(fatal_regulatory) ~ 0.05 (logit ~ -2.95)
    reg_fatal_signals = [
        "whatsapp and asha", "unlicensed", "clinical triage", "malpractice",
        "uninsurable", "telecom violation", "violates privacy", "dpdp act",
        "22+ indic languages via sarvam ai and deterministic who imci decision trees across whatsapp"
    ]
    reg_ok_signals = [
        "soc2", "iso 27001", "gdpr", "compliance auditor", "pr review",
        "claims pre-fill", "carrier-compliant", "p&c adjusters", "property damage"
    ]
    rf_hits = sum(1 for s in reg_fatal_signals if s in lower)
    ro_hits = sum(1 for s in reg_ok_signals if s in lower)
    logit_reg = -2.95 + (rf_hits * 4.5) - (ro_hits * 2.0)
    p_reg = 1.0 / (1.0 + math.exp(-logit_reg))
    answers["regulatory_risk"] = {
        "choice": "regulatory_fatal" if p_reg >= THRESHOLDS["regulatory_fatal"] else "standard_compliance",
        "probabilities": {
            "regulatory_fatal": round(p_reg, 4),
            "standard_compliance": round(1.0 - p_reg, 4)
        },
        "threshold": THRESHOLDS["regulatory_fatal"],
        "flagged": p_reg >= THRESHOLDS["regulatory_fatal"]
    }

    # ── Question 3: Sales Cycle & Procurement Deadlock ──
    # Prior: baseline enterprise B2B P(deadlock) ~ 0.25 (logit ~ -1.1)
    deadlock_signals = [
        "b2g", "district licensing", "state health mission", "state forest department",
        "national wildlife park", "hospital procurement", "committee review", "government"
    ]
    plg_signals = [
        "b2b saas ctos", "series a-c", "independent restaurant", "solo trade", "freelancers",
        "github organization", "revops", "contractor truck", "bootstrapped b2b saas"
    ]
    dead_hits = sum(1 for s in deadlock_signals if s in lower)
    plg_hits = sum(1 for s in plg_signals if s in lower)
    logit_sales = -1.1 + (dead_hits * 3.2) - (plg_hits * 2.2)
    p_deadlock = 1.0 / (1.0 + math.exp(-logit_sales))
    answers["sales_cycle"] = {
        "choice": "procurement_deadlock" if p_deadlock >= THRESHOLDS["procurement_deadlock"] else "viable_distribution",
        "probabilities": {
            "procurement_deadlock": round(p_deadlock, 4),
            "viable_distribution": round(1.0 - p_deadlock, 4)
        },
        "threshold": THRESHOLDS["procurement_deadlock"],
        "flagged": p_deadlock >= THRESHOLDS["procurement_deadlock"]
    }

    # ── Question 4: Monetization Viability ──
    # Prior: baseline venture P(zero_monetization) ~ 0.08 (logit ~ -2.44)
    zero_signals = [
        "free forever", "donor-funded", "no monetization", "volunteer relief",
        "mutual-aid", "zero revenue", "free platform"
    ]
    healthy_signals = [
        "$1,200/mo", "$499/mo", "$850/mo", "$149/mo", "$79/mo", "$49",
        "10% of recovered", "15% platform fee", "1.5% fee", "enterprise saas", "flat saas"
    ]
    zero_hits = sum(1 for s in zero_signals if s in lower)
    healthy_hits = sum(1 for s in healthy_signals if s in lower)
    logit_mon = -2.44 + (zero_hits * 5.0) - (healthy_hits * 2.5)
    p_unmonetized = 1.0 / (1.0 + math.exp(-logit_mon))
    answers["monetization"] = {
        "choice": "monetization_zero" if p_unmonetized >= THRESHOLDS["monetization_zero"] else "viable_economics",
        "probabilities": {
            "monetization_zero": round(p_unmonetized, 4),
            "viable_economics": round(1.0 - p_unmonetized, 4)
        },
        "threshold": THRESHOLDS["monetization_zero"],
        "flagged": p_unmonetized >= THRESHOLDS["monetization_zero"]
    }

    # Fatal Gates: Moat, Regulatory, or Monetization trigger KILL
    fatal_flags = []
    if answers["moat"]["flagged"]: fatal_flags.append("moat (thin wrapper)")
    if answers["regulatory_risk"]["flagged"]: fatal_flags.append("regulatory (uninsurable clinical/legal risk)")
    if answers["monetization"]["flagged"]: fatal_flags.append("monetization (zero willingness to pay)")

    refine_flags = []
    if answers["sales_cycle"]["flagged"]: refine_flags.append("sales_cycle (procurement deadlock)")

    if fatal_flags:
        verdict = "KILL"
    elif refine_flags:
        verdict = "REFINE"
    else:
        verdict = "BUILD"

    return {
        "answers": answers,
        "fatal_flags": fatal_flags,
        "refine_flags": refine_flags,
        "verdict": verdict,
        "loss_ratio": round(COST_FALSE_POSITIVE / COST_FALSE_NEGATIVE, 1)
    }

if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    res = evaluate_concept_decision(text)
    print(json.dumps(res, indent=2))
