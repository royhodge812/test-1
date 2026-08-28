import {
  buildMunicipalSnapshot,
  forecastInfrastructureAsset,
  predictMunicipalDemand,
} from './crothersville-prediction-engine.js';

test('produces an explainable municipal demand forecast', () => {
  const result = predictMunicipalDemand({
    recentDemand: 0.8,
    seasonalBaseline: 0.6,
    weatherImpact: 0.5,
    assetAge: 0.4,
    maintenanceBacklog: 0.7,
    serviceTrend: 0.6,
    observationCount: 100,
  });

  expect(result.model).toBe('crothersville-civic-demand-v1');
  expect(result.level).toBe('HIGH');
  expect(result.drivers.length).toBe(6);
  expect(result.score).toBeGreaterThan(0.6);
});

test('scores infrastructure risk without using person-level data', () => {
  const result = forecastInfrastructureAsset({
    assetId: 'ROAD-001',
    assetType: 'road-segment',
    ageYears: 50,
    conditionScore: 0.3,
    maintenanceBacklog: 0.8,
  });

  expect(result.priority).toBe('HIGH');
  expect(result.drivers.conditionRisk).toBeGreaterThan(0.6);
});

test('snapshot includes explicit safety guardrails', () => {
  const snapshot = buildMunicipalSnapshot({
    demand: {
      recentDemand: 0.5,
      seasonalBaseline: 0.5,
      weatherImpact: 0.5,
      assetAge: 0.5,
      maintenanceBacklog: 0.5,
      serviceTrend: 0.5,
      observationCount: 10,
    },
    assets: [],
  });

  expect(snapshot.guardrails).toContain('No person-level risk scores');
  expect(snapshot.guardrails).toContain('No automated enforcement or eligibility decisions');
});
