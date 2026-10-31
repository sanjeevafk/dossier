# Decision Model Evaluations

This document records the current decision-model benchmark and its limitations. It is an **internal development benchmark**, not a claim of production-level predictive accuracy.

## 1. Evaluation protocol

Dossier decomposes evaluation into typed risk questions rather than asking one generative model for a single score:

| Gate | Failure mode | Threshold |
| :--- | :--- | :---: |
| Moat defensibility | `thin_wrapper` | 0.28 |
| Regulatory & clinical | `regulatory_fatal` | 0.25 |
| Enterprise sales friction | `procurement_deadlock` | 0.42 |
| Monetization viability | `monetization_zero` | 0.30 |

These thresholds are decision-policy parameters. They are not universal probabilities of startup failure.

## 2. Current 14-concept benchmark

The repository contains a fixed 14-concept suite used to regression-test the decision model. It contains four concepts labelled fatal in the benchmark (`BM-02`, `BM-04`, `BM-11`, `BM-12`) plus viable/refine cases.

The benchmark is useful for detecting regressions such as:

- a known fatal case no longer triggering its intended gate;
- a viable B2B case being rejected by a thin-wrapper gate;
- thresholds or calibration changing unexpectedly.

It is **not** large enough to establish general recall, precision, or calibration in the wild.

### Current reported results

The historical runs in this file show all four benchmark fatal concepts being caught by the final gate. That demonstrates benchmark coverage, not a statistically reliable 100% population recall estimate.

The LiquidAI run also contains false-positive/near-threshold examples such as `KissanAI` and `BhaiyaFix`. Those disagreements are valuable regression cases and should not be hidden.

## 3. Required statistical validation before stronger claims

Future evaluation should report, on a held-out set:

- confusion matrix;
- precision, recall, specificity and F1 where labels are binary/compatible;
- Brier score for probabilistic outputs;
- reliability/calibration curves;
- confidence intervals around headline metrics;
- out-of-distribution cases;
- predefined labels and decision thresholds established before evaluation;
- sample size and class balance.

A larger benchmark should contain both successful and failed historical companies selected by a reproducible rule, rather than a hand-picked set of famous examples.

## 4. Interpretation rule

Do not write:

> “Dossier has 100% recall.”

Write:

> “Dossier caught all four fatal examples in the current 14-case development benchmark.”

The second statement is supported by the evidence. The first one pretends fourteen examples constitute the entire universe of startups, which would be a neat trick but not statistics.

## 5. Running the current gates

```bash
pnpm test:decision
pnpm test
```

CI should be treated as the source of truth for pass/fail status. If no CI result is available for a commit, do not claim the suite is green.
