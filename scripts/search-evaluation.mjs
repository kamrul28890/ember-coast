import fs from 'node:fs';
import { play } from './arena.mjs';
const started = performance.now(), results = [], games = Number(process.argv[2] ?? 16), rollouts = Number(process.argv[3] ?? 54), horizon = Number(process.argv[4] ?? 5);
for (let i = 0; i < games; i++) {
  const seat = i % 4, modes = Array(4).fill('greedy'); modes[seat] = 'expert';
  const result = play(`search-final-v2-${Math.floor(i / 4)}`, { modes, searchRollouts: rollouts, searchHorizon: horizon }); result.searchSeat = seat; results.push(result);
  console.log(`Search game ${i + 1}/${games}: winner ${result.winner}, ${result.turns} turns`);
}
const report = { generatedAt: new Date().toISOString(), kind: 'full-match search smoke evaluation', games, searchBudget: { rollouts, horizonTurns: horizon }, comparator: 'Three tuned strategic heuristics without search', wins: results.filter(r => r.winner === r.searchSeat).length, draws: results.filter(r => r.winner === null).length, elapsedSeconds: (performance.now() - started) / 1000, caveat: 'Seed-balanced bot-only evaluation, not a human skill rating. Browser expert budget is 54 rollouts / 5 turns.', results };
fs.writeFileSync(new URL('../training/search-evaluation.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ games, wins: report.wins, seconds: Math.round(report.elapsedSeconds) }));
