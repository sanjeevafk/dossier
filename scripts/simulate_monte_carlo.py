#!/usr/bin/env python3
"""
Dossier stochastic economics sandbox — vectorized Monte Carlo (10,000 runs).

Input JSON (argv[1] or stdin):
{
  "pricing_monthly": float,
  "churn_mean": float (0..1),
  "churn_std":  float (optional, default 25% of mean),
  "cac_mean":   float,
  "cac_std":    float (optional, default 30% of mean),
  "users_m12":  int,
  "tokens_per_req": int,
  "reqs_monthly":   int,
  "token_cost_per_user": float (optional; overrides tokens/reqs derived cost, USD/user/month),
  "gross_margin_target": float (optional, default 0.80),
  "iterations": int (optional, default 10000, clamped 1000..50000),
  "starting_cash_usd": float (optional; default 3x worst-case monthly burn)
}

Output JSON: survival probabilities (cash > 0 at month 12/24), monthly insolvency curve,
LTV/CAC + payback percentiles (P10/P50/P90), token-cost burden percentiles, and a
tornado sensitivity ranking of which parameter moves the P50 LTV/CAC most.
"""
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
    iterations = int(clamp(data.get("iterations", 10_000), 1000, 50_000))

    derived_token_cost = (tokens_per_req * reqs_monthly / 1_000_000.0) * 2.50
    token_cost_per_user = float(
        data.get("token_cost_per_user", derived_token_cost)
    )
    token_cost_per_user = clamp(token_cost_per_user, 0.0, 1e4)

    if "starting_cash_usd" in data:
        starting_cash = clamp(float(data["starting_cash_usd"]), 0.0, 1e12)
    else:
        worst_monthly_burn = max(
            users * pricing * gross_margin_target,
            150.0 + users * 0.05 + users * token_cost_per_user + users * churn_mean * cac_mean,
        )
        starting_cash = 3.0 * worst_monthly_burn

    rng = np.random.default_rng()

    churn = np.clip(rng.normal(churn_mean, churn_std, iterations), 0.004, 0.5)
    cac = np.clip(rng.normal(cac_mean, cac_std, iterations), 1.0, 1e6)
    token_multiplier = rng.uniform(0.7, 1.3, iterations)

    margin_per_user = pricing * gross_margin_target
    ltv = np.where(churn > 0, margin_per_user / churn, 1e9)
    ltv_cac = np.minimum(np.divide(ltv, cac), 999.0)
    payback = np.where(margin_per_user > 0, np.minimum(cac / margin_per_user, 999.0), 999.0)

    revenue_monthly = users * margin_per_user
    infra_monthly = 150.0 + users * 0.05 + users * token_cost_per_user
    acquisition_monthly = users * churn * cac
    net_monthly = revenue_monthly - infra_monthly - acquisition_monthly

    # Insolvency model: flat net margin against a banked starting runway (steady-state
    # replacement model); cash trajectory is linear, so survival is the share of runs
    # whose cash balance stays above zero through the horizon.
    cash_month_12 = starting_cash + net_monthly * 12.0
    cash_month_24 = starting_cash + net_monthly * 24.0
    survival_12 = float(np.mean(cash_month_12 > 0))
    survival_24 = float(np.mean(cash_month_24 > 0))

    horizon = np.arange(1, 25)
    balances = starting_cash + np.outer(net_monthly, horizon)  # (iterations, 24)
    insolvency_curve = np.mean(balances <= 0.0, axis=0)  # share insolvent by month m

    token_share = np.divide(
        token_cost_per_user * token_multiplier,
        np.maximum(margin_per_user, 0.01),
    )

    def percentiles(values):
        p10, p50, p90 = np.percentile(values, [10, 50, 90])
        return {
            "p10": round(float(p10), 2),
            "p50": round(float(p50), 2),
            "p90": round(float(p90), 2),
        }

    def p50_ratio_with_param(name, shift):
        probe = {
            "pricing_monthly": pricing,
            "churn_mean": churn_mean,
            "cac_mean": cac_mean,
            "token_cost": token_cost_per_user,
        }
        probe[name] = probe[name] * shift
        churn_p = np.clip(
            rng.normal(
                clamp(float(data.get(name, churn_mean)) if name == "churn_mean" else churn_mean, 0.005, 0.5),
                churn_std,
                iterations,
            ),
            0.004,
            0.5,
        )
        cac_p = cac if name != "cac_mean" else np.clip(
            rng.normal(clamp(probe[name], 1.0, 1e6), cac_std, iterations), 1.0, 1e6
        )
        margin_p = probe["pricing_monthly"] * gross_margin_target
        ltv_p = np.where(churn_p > 0, margin_p / churn_p, 1e9)
        ratio_p = np.minimum(np.divide(ltv_p, cac_p), 999.0)
        return float(np.percentile(ratio_p, 50))

    base_p50 = float(np.percentile(ltv_cac, 50))
    tornado = []
    for name, shift in (("churn_mean", 1.10), ("cac_mean", 1.10), ("pricing_monthly", 0.90), ("token_cost", 1.10)):
        delta = p50_ratio_with_param(name, shift) - base_p50
        label = "pricing_monthly" if name == "pricing_monthly" else name
        tornado.append({"param": label, "absoluteDelta": round(abs(delta), 3)})
    tornado.sort(key=lambda item: item["absoluteDelta"], reverse=True)

    result = {
        "iterations": iterations,
        "survivalProbability12Mo": round(survival_12, 4),
        "survivalProbability24Mo": round(survival_24, 4),
        "insolvencyCurveByMonth": [round(float(v), 4) for v in insolvency_curve[::2]],
        "ltvCacPercentiles": percentiles(ltv_cac),
        "paybackPercentiles": percentiles(payback),
        "tokenCostBurdenPercent": percentiles(token_share),
        "sensitivity": tornado,
        "medianInferredUsers": users,
        "cacEstimateUsd": round(float(np.percentile(cac, 50)), 2),
        "ltvEstimateUsd": round(float(np.percentile(ltv, 50)), 2),
        "ltvCacRatio": round(base_p50, 2),
        "estimatedPaybackMonths": round(float(np.percentile(payback, 50)), 1),
        "monthlyInfraCostUsd": round(float(infra_monthly), 2),
        "tamEstimateUsd": "$%sB" % (
            round(
                max(
                    (pricing * 12 * (500_000 if pricing * 12 > 200 else 5_000_000)) / 1_000_000_000,
                    0.1,
                ),
                1,
            )
        ),
        "simulationNotes": (
            "Steady-state replacement Monte Carlo: %d runs, churn ~ N(%.3f, %.3f), "
            "CAC ~ N(%.0f, %.0f), gross margin %.0f%%, token cost $%.4f/user/mo."
            % (
                iterations,
                churn_mean,
                churn_std,
                cac_mean,
                cac_std,
                gross_margin_target * 100,
                token_cost_per_user,
            )
        ),
    }
    print(json.dumps(result))


if __name__ == "__main__":
    run_simulation(load_input())
