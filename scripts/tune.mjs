import fs from 'node:fs';
import { play } from './arena.mjs';
import { PRIOR as POLICY } from '../src/prior.mjs';
import { random } from '../src/engine.mjs';
const started = performance.now(), rng = { rng: 734517 }, candidates = [structuredClone(POLICY)], seeds = Number(process.argv[2] ?? 4);
for (let i = 1; i < 6; i++) {
  const candidate = structuredClone(POLICY);
  for (const key of ['production', 'diversity', 'expansion', 'hand', 'progress', 'army', 'threat']) candidate.weights[key] *= 0.75 + random(rng) * 0.55;
  candidate.resource = candidate.resource.map(v => v * (0.9 + random(rng) * 0.2));
  candidates.push(candidate);
}
const reports = [];
for (let c = 0; c < candidates.length; c++) {
  const results = [];
  for (let seed = 0; seed < seeds; seed++) for (let seat = 0; seat < 4; seat++) {
    const configs = Array(4).fill(POLICY); configs[seat] = candidates[c];
    const result = play(`training-v1-${seed}`, { configs }); result.candidateSeat = seat; results.push(result);
  }
  const wins = results.filter(v => v.winner === v.candidateSeat).length, margin = results.reduce((v, r) => v + r.scores[r.candidateSeat] - r.scores.filter((_, p) => p !== r.candidateSeat).reduce((a, b) => a + b, 0) / 3, 0) / results.length;
  reports.push({ candidate: c, wins, margin, config: candidates[c], results });
  console.log(`Candidate ${c}: ${wins}/${results.length} wins; mean score margin ${margin.toFixed(2)}`);
}
reports.sort((a, b) => b.wins - a.wins || b.margin - a.margin);
const selected = { ...reports[0].config, version: 1, provenance: 'self-play parameter search', humanDataUsed: false, training: { seedPrefix: 'training-v1', candidates: candidates.length, games: seeds * 4 * candidates.length, selectedCandidate: reports[0].candidate, completedAt: new Date().toISOString() } };
fs.writeFileSync(new URL('../src/policy.mjs', import.meta.url), '// Selected using local, seed-balanced self-play. No human-game data used.\nexport const POLICY = ' + JSON.stringify(selected, null, 2) + ';\n');
fs.writeFileSync(new URL('../training/tuning.json', import.meta.url), JSON.stringify({ method: 'Deterministic bounded random search over heuristic weights, seat-rotated self-play. Not neural-network training.', elapsedSeconds: (performance.now() - started) / 1000, baseline: POLICY, selected, reports }, null, 2));
console.log(`Selected candidate ${reports[0].candidate}. Run benchmark on held-out seeds next.`);
