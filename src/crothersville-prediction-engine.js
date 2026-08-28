/**
 * Crothersville Civic Prediction Engine
 *
 * Forecasts aggregate municipal service demand and infrastructure risk.
 * Deliberately excludes person-level risk scoring, target profiling,
 * protected-class features, and automated enforcement recommendations.
 */

const DEFAULT_WEIGHTS = Object.freeze({
  recentDemand: 0.35,
  seasonalBaseline: 0.2,
  weatherImpact: 0.15,
  assetAge: 0.1,
  maintenanceBacklog: 0.15,
  serviceTrend: 0.05,
});

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function weightedScore(features, weights = DEFAULT_WEIGHTS) {
  return Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + clamp(features[key]) * weight,
    0,
  );
}

export function predictMunicipalDemand(input, weights = DEFAULT_WEIGHTS) {
  const score = weightedScore(input, weights);
  const confidence = clamp(
    0.45 + Math.min(0.45, (input.observationCount || 0) / 200),
  );

  let level = 'LOW';
  if (score >= 0.7) level = 'HIGH';
  else if (score >= 0.45) level = 'MEDIUM';

  return {
    model: 'crothersville-civic-demand-v1',
    forecastType: input.forecastType || 'municipal-service-demand',
    geography: input.geography || 'Crothersville, Indiana',
    score: Number(score.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    level,
    horizonDays: input.horizonDays || 7,
    drivers: rankDrivers(input, weights),
    generatedAt: new Date().toISOString(),
  };
}

function rankDrivers(features, weights) {
  return Object.entries(weights)
    .map(([key, weight]) => ({
      feature: key,
      contribution: Number((clamp(features[key]) * weight).toFixed(4)),
    }))
    .sort((a, b) => b.contribution - a.contribution);
}

export function forecastInfrastructureAsset(asset, horizonDays = 30) {
  const ageRisk = clamp((asset.ageYears || 0) / 80);
  const backlogRisk = clamp(asset.maintenanceBacklog);
  const conditionRisk = 1 - clamp(asset.conditionScore ?? 1);
  const failureRisk = clamp(
    ageRisk * 0.25 + backlogRisk * 0.35 + conditionRisk * 0.4,
  );

  return {
    model: 'crothersville-infrastructure-risk-v1',
    assetId: asset.assetId,
    assetType: asset.assetType,
    geography: asset.geography || 'Crothersville, Indiana',
    horizonDays,
    riskScore: Number(failureRisk.toFixed(4)),
    priority:
      failureRisk >= 0.7 ? 'HIGH' : failureRisk >= 0.4 ? 'MEDIUM' : 'LOW',
    drivers: {
      ageRisk: Number(ageRisk.toFixed(4)),
      maintenanceBacklog: Number(backlogRisk.toFixed(4)),
      conditionRisk: Number(conditionRisk.toFixed(4)),
    },
    generatedAt: new Date().toISOString(),
  };
}

export function buildMunicipalSnapshot({ demand, assets, metadata = {} }) {
  const assetForecasts = assets.map((asset) => forecastInfrastructureAsset(asset));
  return {
    schemaVersion: '1.0',
    municipality: 'Crothersville',
    state: 'IN',
    metadata,
    demandForecast: predictMunicipalDemand(demand),
    infrastructureForecasts: assetForecasts,
    guardrails: [
      'Aggregate civic forecasting only',
      'No person-level risk scores',
      'No protected-class or proxy features',
      'No automated enforcement or eligibility decisions',
      'Every forecast exposes contributing features and confidence',
    ],
    generatedAt: new Date().toISOString(),
  };
}
