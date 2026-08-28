# Crothersville Prediction Engine

## Purpose

A transparent civic forecasting layer for Crothersville municipal operations. The first implementation forecasts aggregate public-works demand and infrastructure maintenance risk.

## Architecture

```text
Public records / municipal datasets
              |
              v
        Normalization layer
              |
              v
       Feature calculation
              |
        +-----+------+
        |            |
        v            v
 Demand model   Asset-risk model
        |            |
        +-----+------+
              |
              v
      Explainable JSON output
              |
              v
     Dashboard / API / agents
```

## Model v1

Demand score is a weighted combination of:

- recent aggregate service demand
- seasonal baseline
- weather impact
- infrastructure age
- maintenance backlog
- service-demand trend

Infrastructure risk uses asset age, maintenance backlog, and condition score.

These are deliberately simple, deterministic baselines. A future ML model should only replace them after backtesting against historical municipal outcomes and documenting calibration/error metrics.

## Guardrails

This repository does **not** implement person-level predictive policing, target ranking, social-sentiment scoring of named residents, or automated enforcement decisions.

The engine is designed for municipal planning: roads, drainage, facilities, service demand, maintenance scheduling, and other aggregate civic operations.

## Next implementation stages

1. Replace synthetic inputs with documented public municipal datasets.
2. Add a versioned ingestion/normalization pipeline.
3. Store observations and forecasts with timestamps for backtesting.
4. Add baseline metrics: MAE, RMSE, calibration, precision/recall where applicable.
5. Add uncertainty intervals instead of a single opaque score.
6. Expose `/forecast/demand` and `/forecast/assets` through an API.
7. Connect the existing dashboard to forecast JSON rather than hard-coded values.
8. Add a model card and data provenance for every production model.
