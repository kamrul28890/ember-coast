// Hand-written strategic prior; fixed independently of generated policy weights.
export const PRIOR = {
  version: 1, provenance: 'strategic-prior', humanDataUsed: false,
  weights: { points: 9, production: 8, diversity: 1.5, expansion: 4.2, hand: 0.26, progress: 1.8, army: 0.7, threat: 1.5 },
  resource: [1, 1.05, 0.85, 1.3, 1.4],
};
