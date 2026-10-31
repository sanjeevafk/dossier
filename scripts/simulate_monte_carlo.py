#!/usr/bin/env python3
"""
Dossier stochastic economics sandbox — vectorized Monte Carlo.

The model uses one consistent 24-month cohort contribution-margin model for LTV,
LTV/CAC and payback. Input assumptions remain assumptions; successful execution
is not evidence that those assumptions are correct.
"""
import hashlib
import json
import sys

import numpy as np


def clamp(value, low, high):
    return max(low, min(high, value))


def load_input():
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            return json.load(f)
    return json.loads(sys.stdin.read())


def run_simulation(data):
    pricing = clamp(float(data.get("pricing_monthly", 49.0)), 0.0, 1e7)
    churn_mean = clamp(float(data.get("churn_mean", 0.05)), 0.005, 0.5)
    churn_std = clamp(float(data.get("churn_std", churn_mean * 0.25)), 0.002, 0.35)
    cac_mean = clamp(float(data.get("cac", 150.0)), 1.0, 1e6)
    cac_std = clamp(float(data.get("cac_std", cac_mean * 0.30)), 1.0, 1e6)
    users = int(clamp(data.get("users_m12", 1000), 1, 10_000_000))
    tokens_per_req = int(clamp(data.get("tokens_per_req", 500), 0, 10_000))
    reqs_monthly = int(clamp(data.get("reqs_monthly", 30), 0, 10_000))
    gross_margin_target = clamp(float(data.get("gross_margin_target", 0.80)), 0.1, 0.98)
    churn_decay = clamp(float(data.get("churn_decay", 1.0)), 0.90, 1.0)
    runway_months = clamp(float(data.get("runway_months", 18.0)), 1.0, 60.0)
    iterations = int(clamp(data.get("iterations", 10_000), 1000, 50_000))
    seed = data.get("seed")
    if seed is None:
        seed = int(hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:8], 16)

    derived_token_cost = (tokens_per_req * reqs_monthly / 1_000_000.0) * 2.50
    token_cost_per_user = clamp(float(data.get("token_cost_per_user", derived_token_cost)), 0.0, 1e4)

    if "starting_cash_usd" in data:
        starting_cash = clamp(float(data["starting_cash_usd"]), 0.0, 1e12)
    else:
        worst_monthly_burn = max(
            users * pricing * gross_margin_target,
            150.0 + users * 0.05 + users * token_cost_per_user + users * churn_mean * cac_mean,
        )
        starting_cash = 3.0 * worst_monthly_burn

    rng = np.random.default_rng(int(seed) % (2 ** 32))
    churn = np.clip(rng.normal(churn_mean, churn_std, iterations), 0.004, 0.5)
    cac = np.clip(rng.normal(cac_mean, cac_std, iterations), 1.0, 1e6)
    token_multiplier = rng.uniform(0.7, 1.3, iterations)

    # One coherent 24-month cohort model. Each month's contribution margin is
    # discounted by the cohort survival probability. This same LTV drives LTV/CAC.
    months = np.arange(1, 25)
    decay_matrix = np.power(churn_decay, months - 1)
    cohort_survival = np.cumprod(
        np.clip(1.0 - churn[:, None] * decay_matrix[None, :], 0.0, 1.0),
        axis=1,
    )
    cohort_margin = pricing * gross_margin_target - token_cost_per_user * token_multiplier[:, None]
    cohort_ltv = np.sum(np.maximum(cohort_margin, 0.0) * cohort_survival, axis=1)
    ltv_cac = np.minimum(np.divide(cohort_ltv, cac), 999.0)

    # Payback is based on first-month contribution margin, so it is consistent
    # with the same contribution-margin definition used by cohort LTV.
    first_month_margin = np.maximum(cohort_margin[:, 0], 0.01)
    payback = np.minimum(cac / first_month_margin, 999.0)

    revenue_monthly = users * pricing * gross_margin_target
    infra_monthly = 150.0 + users * 0.05 + users * token_cost_per_user
    acquisition_monthly = users * churn * cac
    net_monthly = revenue_monthly - infra_monthly - acquisition_monthly

    cash_month_12 = starting_cash + net_monthly * 12.0
    cash_month_24 = starting_cash + net_monthly * 24.0
    survival_12 = float(np.mean(cash_month_12 > 0))
    survival_24 = float(np.mean(cash_month_24 > 0))

    horizon = np.arange(1, 25)
    balances = starting_cash + np.outer(net_monthly, horizon)
    insolvency_curve = np.mean(balances <= 0.0, axis=0)

    token_share = np.divide(
        token_cost_per_user * token_multiplier,
        np.maximum(pricing * gross_margin_target, 0.01),
    )

    # EVPI remains a decision-model diagnostic. It uses the same cohort LTV as
    # the displayed LTV/CAC so the decision model cannot silently use another LTV.
    payoff = cohort_ltv - cac
    baseline_proceed_value = float(np.mean(payoff))
    baseline_best = max(baseline_proceed_value, 0.0)
    perfect_info_value = float(np.mean(np.maximum(payoff, 0.0)))
    evpi = max(perfect_info_value - baseline_best, 0.0)

    partial_evpi = {}
    for name, draws in (
        ("churn_mean", churn),
        ("cac_mean", cac),
        ("token_cost", token_cost_per_user * token_multiplier),
    ):
        order = np.argsort(draws)
        sorted_payoff = payoff[order]
        bin_edges = np.array_split(np.arange(len(sorted_payoff)), 10)
        informed_value = 0.0
        for idx in bin_edges:
            if idx.size:
                informed_value += (idx.size / len(sorted_payoff)) * max(float(np.mean(sorted_payoff[idx])), 0.0)
        partial_evpi[name] = max(min(informed_value - baseline_best, evpi), 0.0)

    evpi_ranking = sorted(partial_evpi.items(), key=lambda kv: kv[1], reverse=True)

    def percentiles(values):
        p10, p50, p90 = np.percentile(values, [10, 50, 90])
        return {"p10": round(float(p10), 2), "p50": round(float(p50), 2), "p90": round(float(p90), 2)}

    def p50_ratio_with_param(name, shift):
        probe = {"pricing_monthly": pricing, "churn_mean": churn_mean, "cac_mean": cac_mean, "token_cost": token_cost_per_user}
        probe[name] *= shift
        probe_churn = clamp(probe["churn_mean"], 0.005, 0.5)
        probe_cac = clamp(probe["cac_mean"], 1.0, 1e6)
        probe_token = clamp(probe["token_cost"], 0.0, 1e4)
        churn_p = np.clip(rng.normal(probe_churn, churn_std, iterations), 0.004, 0.5)
        cac_p = cac if name != "cac_mean" else np.clip(rng.normal(probe_cac, cac_std, iterations), 1.0, 1e6)
        margin_p = max(probe["pricing_monthly"] * gross_margin_target - probe_token, 0.01)
        cohort_survival_p = np.cumprod(
            np.clip(1.0 - churn_p[:, None] * decay_matrix[None, :], 0.0, 1.0), axis=1
        )
        ltv_p = np.sum(margin_p * cohort_survival_p, axis=1)
        ratio_p = np.minimum(np.divide(ltv_p, cac_p), 999.0)
        return float(np.percentile(ratio_p, 50))

    base_p50 = float(np.percentile(ltv_cac, 50))
    tornado = []
    for name, shift in (("churn_mean", 1.10), ("cac_mean", 1.10), ("pricing_monthly", 0.90), ("token_cost", 1.10)):
        delta = p50_ratio_with_param(name, shift) - base_p50
        tornado.append({"param": name, "absoluteDelta": round(abs(delta), 3)})
    tornado.sort(key=lambda item: item["absoluteDelta"], reverse=True)

    stress_pricing = pricing * 0.85
    stress_churn_mean = min(1.0, churn_mean * 1.6)
    stress_cac_mean = cac_mean * 1.6
    stress_churn = np.clip(rng.normal(stress_churn_mean, stress_churn_mean * 0.25, iterations), 0.004, 1.0)
    stress_cac = np.clip(rng.normal(stress_cac_mean, stress_cac_mean * 0.30, iterations), 1.0, 1e6)
    stress_margin = stress_pricing * gross_margin_target
    stress_ltv = np.where(stress_churn > 0, stress_margin / stress_churn, 1e9)
    stress_ltv_cac = np.minimum(np.divide(stress_ltv, stress_cac), 999.0)
    stress_payback = np.where(stress_margin > 0, np.minimum(stress_cac / stress_margin, 999.0), 999.0)
    stress_net_monthly = (users * stress_margin) - infra_monthly - (users * stress_churn * stress_cac)
    stress_cash_24 = starting_cash + stress_net_monthly * 24.0

    result = {
        "iterations": iterations,
        "survivalProbability12Mo": round(survival_12, 4),
        "survivalProbability24Mo": round(survival_24, 4),
        "insolvencyCurveByMonth": [round(float(v), 4) for v in insolvency_curve[::2]],
        "ltvCacPercentiles": percentiles(ltv_cac),
        "paybackPercentiles": percentiles(payback),
        "tokenCostBurdenPercent": percentiles(token_share),
        "stressMetrics": {
            "churnStressed": True,
            "cacStressed": True,
            "stressLtvCacRatio": round(float(np.percentile(stress_ltv_cac, 50)), 2),
            "stressSurvival24Mo": round(float(np.mean(stress_cash_24 > 0)), 4),
            "stressPayback50": round(float(np.percentile(stress_payback, 50)), 1),
        },
        "sensitivity": tornado,
        "valueOfInformation": {
            "decisionModel": "per-customer gross NPV (24-month cohort LTV - CAC); proceed iff expected payoff > 0",
            "expectedPayoffIfProceeding": round(baseline_proceed_value, 2),
            "expectedPayoffWithPerfectInfo": round(perfect_info_value, 2),
            "evpiPerCustomer": round(evpi, 2),
            "partialEvpi": [
                {"param": name, "evpiPerCustomer": round(value, 2), "shareOfEvpi": round(value / evpi, 3) if evpi > 0 else 0.0}
                for name, value in evpi_ranking
            ],
        },
        "medianInferredUsers": users,
        "cacEstimateUsd": round(float(np.percentile(cac, 50)), 2),
        "ltvEstimateUsd": round(float(np.percentile(cohort_ltv, 50)), 2),
        "ltvCacRatio": round(base_p50, 2),
        "estimatedPaybackMonths": round(float(np.percentile(payback, 50)), 1),
        "monthlyInfraCostUsd": round(float(infra_monthly), 2),
        "tamEstimateUsd": "UNKNOWN — no citable TAM source for this archetype",
        "simulationNotes": (
            "24-month cohort Monte Carlo: %d runs, seed %d, churn ~ N(%.3f, %.3f) decay %.2f, "
            "CAC ~ N(%.0f, %.0f), gross margin %.0f%%, token cost $%.4f/user/mo, runway %.0fmo."
            % (iterations, int(seed) % (2 ** 32), churn_mean, churn_std, churn_decay, cac_mean, cac_std, gross_margin_target * 100, token_cost_per_user, runway_months)
        ),
    }
    print(json.dumps(result))


if __name__ == "__main__":
    run_simulation(load_input())
