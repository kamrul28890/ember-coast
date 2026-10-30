import fs from 'node:fs';
import { play } from './arena.mjs';
import { PRIOR } from '../src/prior.mjs';
import { POLICY } from '../src/policy.mjs';
const games = Number(process.argv[2] ?? 48), started = performance.now(), results = [];
for (let game = 0; game < games; game++) {
  const seat = game % 4, configs = Array(4).fill(PRIOR); configs[seat] = POLICY;
  const result = play(`heldout-v3-${Math.floor(game / 4)}`, { configs }); result.candidateSeat = seat; results.push(result);
  if ((game + 1) % 8 === 0) console.log(`${game + 1}/${games} held-out games complete`);
}
const wins = results.filter(r => r.winner === r.candidateSeat).length, rate = wins / games, z = 1.96, den = 1 + z * z / games;
const center = (rate + z * z / (2 * games)) / den, half = z * Math.sqrt(rate * (1 - rate) / games + z * z / (4 * games * games)) / den;
const report = { generatedAt: new Date().toISOString(), kind: 'held-out-self-play', games, comparator: 'Three fixed hand-written strategic-prior policies; no search, not humans', candidate: 'Self-play selected heuristic weights; no search', seedPrefix: 'heldout-v3 (not used in tuning)', seatRotated: true, wins, draws: results.filter(r => r.winner === null).length, winRate: rate, wilson95: [center - half, center + half], elapsedSeconds: (performance.now() - started) / 1000, policy: POLICY, results };
fs.writeFileSync(new URL('../training/benchmark.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ games, wins, draws: report.draws, seconds: Math.round(report.elapsedSeconds), interval95: report.wilson95 }));
