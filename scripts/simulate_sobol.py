#!/usr/bin/env python3
"""
Dossier Sobol global sensitivity analysis — variance-based first/total-order
indices over the unit-economics model, using the canonical Saltelli scheme
(Saltelli 2002) implemented directly in numpy (no external sensitivity lib).

Model (deterministic given x), consistent with simulate_monte_carlo.py:
  ltv_cac       = (pricing * gross_margin / churn) / cac
  payback       = cac / (pricing * gross_margin)
  token_share   = token_cost / (pricing * gross_margin)

Uncertain inputs (d=4):
  pricing_monthly  ~ founder estimate ±25%      U(0.75, 1.25) * pricing
  churn_mean       ~ N(churn_mean, churn_std)   clipped [0.004, 0.5]
  cac              ~ N(cac, cac_std)            clipped [1, 1e6]
  token_cost       ~ U(0.7, 1.3) * derived token cost/user/mo

Input JSON (argv[1] or stdin): same base fields as simulate_monte_carlo.py,
plus optional "sobol_samples" (base sample size N, default 128, clamped 32..1024).

Output JSON: per-output {variance, first_order, total_order} per parameter,
plus the total-order ranking for LTV/CAC.
"""
import hashlib
import json
import sys

import numpy as np

TOKEN_USD_PER_1M = 2.50


def clamp(value, low, high):
    return max(low, min(high, value))


def load_input():
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            return json.load(f)
    return json.loads(sys.stdin.read())


PARAM_NAMES = ["pricing_monthly", "churn_mean", "cac", "token_cost"]


def sample_inputs(data, N):
    """Return Saltelli matrix of shape (N * (2d), d), d=4."""
    pricing = clamp(float(data.get("pricing_monthly", 49.0)), 0.0, 1e7)
    churn_mean = clamp(float(data.get("churn_mean", 0.05)), 0.005, 0.5)
    churn_std = clamp(float(data.get("churn_std", churn_mean * 0.25)), 0.002, 0.35)
    cac_mean = clamp(float(data.get("cac", 150.0)), 1.0, 1e6)
    cac_std = clamp(float(data.get("cac_std", cac_mean * 0.30)), 1.0, 1e6)
    tokens_per_req = int(clamp(data.get("tokens_per_req", 500), 0, 10_000))
    reqs_monthly = int(clamp(data.get("reqs_monthly", 30), 0, 10_000))
    gm = clamp(float(data.get("gross_margin_target", 0.80)), 0.1, 0.98)

    base_token_cost = (tokens_per_req * reqs_monthly / 1_000_000.0) * TOKEN_USD_PER_1M
    base_token_cost = float(data.get("token_cost_per_user", base_token_cost))

    seed = data.get("seed")
    if seed is None:
        seed = int(hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(int(seed) % (2 ** 32))

    def draw(n):
        return np.column_stack([
            pricing * rng.uniform(0.75, 1.25, n),
            np.clip(rng.normal(churn_mean, churn_std, n), 0.004, 0.5),
            np.clip(rng.normal(cac_mean, cac_std, n), 1.0, 1e6),
            base_token_cost * rng.uniform(0.7, 1.3, n),
        ])

    A = draw(N)
    B = draw(N)
    d = len(PARAM_NAMES)
    saltelli = np.vstack([A, B])
    for i in range(d):
        # AB_i = B with column i taken from A. A and AB_i share ONLY column i
        # (first-order pair); AB_i and B differ ONLY in column i (total-order pair).
        AB = B.copy()
        AB[:, i] = A[:, i]
        saltelli = np.vstack([saltelli, AB])
    return saltelli, gm, A, B


def evaluate(x, gm):
    pricing, churn, cac, token_cost = x[:, 0], x[:, 1], x[:, 2], x[:, 3]
    margin_per_user = pricing * gm
    ltv = np.where(churn > 0, margin_per_user / churn, 1e9)
    ltv_cac = np.minimum(np.divide(ltv, cac), 999.0)
    payback = np.where(margin_per_user > 0, np.minimum(cac / margin_per_user, 999.0), 999.0)
    token_share = np.divide(token_cost, np.maximum(margin_per_user, 0.01))
    return {"ltv_cac": ltv_cac, "payback_months": payback, "token_share": token_share}


def sobol_indices(A_y, B_y, AB_ys):
    """Canonical Saltelli estimators on centered outputs. Returns (first_order, total_order, variance).

    Outputs are centered by the pooled mean so f0 = 0 exactly — without this, the
    f0² estimation error (SE ≈ 2·f0·sqrt(V/2N)/V) dominates the indices at small N.
    """
    N = A_y.shape[0]
    pooled = np.concatenate([A_y, B_y])
    mu = float(np.mean(pooled))
    total_var = float(np.var(pooled, ddof=1))
    if total_var <= 0:
        return ({p: 0.0 for p in PARAM_NAMES}, {p: 0.0 for p in PARAM_NAMES}, 0.0)

    A_c = A_y - mu
    first_order, total_order = {}, {}
    for i, ab_y in enumerate(AB_ys):
        ab_c = ab_y - mu
        # AB_i shares column i with A and differs from B only in column i.
        # S_i = mean(A_c * AB_c) / V          [Saltelli 2002, centered]
        first_order[PARAM_NAMES[i]] = float(max(0.0, np.mean(A_c * ab_c) / total_var))
        # S_Ti = ( (1/2N) * sum (AB_i_y - B_y)^2 ) / V
        total_order[PARAM_NAMES[i]] = float(
            max(0.0, np.mean((ab_y - B_y) ** 2) / 2.0 / total_var)
        )
    return first_order, total_order, total_var


def run(data):
    N = int(clamp(data.get("sobol_samples", 512), 64, 4096))
    saltelli_x, gm, A_x, B_x = sample_inputs(data, N)
    y_raw = evaluate(saltelli_x, gm)

    # Variance stabilization: LTV/CAC, payback and token-share are heavy-tailed
    # (ratio distributions), which noise-dominates the Saltelli estimators on raw
    # outputs. All three are pure products of independent factors, so log-space
    # is exactly additive and the indices read as multiplicative contribution shares.
    y = {
        "ltv_cac": np.log(y_raw["ltv_cac"]),
        "payback_months": np.log(y_raw["payback_months"]),
        "token_share": np.log1p(y_raw["token_share"]),
    }

    d = len(PARAM_NAMES)
    A_y_all = y  # full model outputs on the stacked matrix
    n_blocks = 2 + d
    A_block = slice(0, N)
    B_block = slice(N, 2 * N)
    ab_blocks = [slice((2 + i) * N, (3 + i) * N) for i in range(d)]

    outputs = {}
    for name in y:
        A_y = A_y_all[name][A_block]
        B_y = A_y_all[name][B_block]
        AB_ys = [A_y_all[name][blk] for blk in ab_blocks]
        first_order, total_order, variance = sobol_indices(A_y, B_y, AB_ys)
        outputs[name] = {
            "variance": round(variance, 6),
            "first_order": {k: round(v, 4) for k, v in first_order.items()},
            "total_order": {k: round(v, 4) for k, v in total_order.items()},
        }

    ltv_rank = sorted(
        outputs["ltv_cac"]["total_order"].items(), key=lambda kv: kv[1], reverse=True
    )

    result = {
        "method": "saltelli-sobol-numpy",
        "baseSamples": N,
        "modelEvaluations": int(N * (2 + d)),
        "params": PARAM_NAMES,
        "outputs": outputs,
        "ltvCacSensitivityRanking": [
            {"param": p, "totalOrderIndex": v} for p, v in ltv_rank
        ],
        "simulationNotes": (
            "Saltelli scheme with N=%d base samples (%d model evals), d=%d uncertain inputs: "
            "pricing ±25%% uniform, churn ~ N(%.3f, %.3f), CAC ~ N(%.0f, %.0f), token cost ±30%%. "
            "Indices computed on log-transformed outputs (variance-stabilizing; the model is "
            "multiplicative in independent factors, so first-order shares are directly "
            "interpretable and total-order ≈ first-order up to clipping effects)."
            % (
                N,
                N * (2 + d),
                d,
                clamp(float(data.get("churn_mean", 0.05)), 0.005, 0.5),
                clamp(float(data.get("churn_std", 0.0125)), 0.002, 0.35),
                clamp(float(data.get("cac", 150.0)), 1.0, 1e6),
                clamp(float(data.get("cac_std", 45.0)), 1.0, 1e6),
            )
        ),
    }
    print(json.dumps(result))


if __name__ == "__main__":
    run(load_input())
