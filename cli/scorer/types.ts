// No external imports needed — pure type definitions

export type HygieneDimension =
  | 'quality' | 'testing' | 'security' | 'efficiency' | 'accessibility'
  | 'dependencies' | 'documentation' | 'gitHygiene' | 'ciPipeline' | 'featureFlags'
  | 'performance' | 'reliability' | 'supplyChain';

// Default dimension weights are normalized to sum to 20, matching the
// documented domain weights of 20/20/20/10/10/10/10:
//   Code Quality  → quality + efficiency              = 4  (20%)
//   Testing       → testing                           = 4  (20%)
//   Security      → security + accessibility          = 4  (20%)
//   Performance   → performance                       = 2  (10%)
//   Reliability   → reliability                       = 2  (10%)
//   Supply Chain  → dependencies + supplyChain        = 2  (10%)
//   Documentation → documentation + git + ci + flags  = 2  (10%)
// Because every domain is a plain average of its dimensions, these dimension
// weights make the weighted dimension average equal the weighted domain
// average — one source of truth for the overall score.
export const DEFAULT_WEIGHTS: Record<HygieneDimension, number> = {
  quality: 2,
  testing: 4,
  security: 2,
  efficiency: 2,
  accessibility: 2,
  dependencies: 1,
  documentation: 0.5,
  gitHygiene: 0.5,
  ciPipeline: 0.5,
  featureFlags: 0.5,
  performance: 2,
  reliability: 2,
  supplyChain: 1,
};

export const WEIGHTS_FILE = '.soloknuckle/score-weights.json';

export interface DimensionScore {
  score: number;
  rawOutput: string;
}

export interface ScoreMetrics {
  quality: DimensionScore;
  testing: DimensionScore;
  security: DimensionScore;
  efficiency: DimensionScore;
  accessibility: DimensionScore;
  dependencies: DimensionScore;
  documentation: DimensionScore;
  gitHygiene: DimensionScore;
  ciPipeline: DimensionScore;
  featureFlags: DimensionScore;
  performance: DimensionScore;
  reliability: DimensionScore;
  supplyChain: DimensionScore;
  overall: number;
  weights: Record<HygieneDimension, number>;
}

export type DomainName =
  | 'codeQuality' | 'testing' | 'securityCompliance'
  | 'performance' | 'reliability' | 'dependenciesSupplyChain'
  | 'documentationVisibility';

export interface DomainScorecard {
  name: string;
  score: number;
  dimensions: { name: string; score: number }[];
  status: 'production-ready' | 'almost-there' | 'needs-work' | 'not-ready';
}

export interface SevenDomainScorecard {
  domains: DomainScorecard[];
  overallScore: number;
  overallStatus: 'production-ready' | 'almost-there' | 'needs-work' | 'not-ready';
}
