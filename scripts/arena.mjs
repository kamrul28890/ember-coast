import { createGame, applyAction, actor, points, validateState, observe, seedHash } from '../src/engine.mjs';
import { opening, quickAction, decide, botTrade, sampleHidden, personality, POLICY } from '../src/ai.mjs';
export function play(seed, { configs = [POLICY, POLICY, POLICY, POLICY], modes = ['greedy', 'greedy', 'greedy', 'greedy'], maxTurns = 320, keepReplay = false, searchRollouts = 18, searchHorizon = 4 } = {}) {
  const s = createGame(seed, { human: false }), replay = [], traded = new Set(); let count = 0;
  while (s.phase.startsWith('setup')) applyAction(s, quickAction(s, personality(s, actor(s), configs[actor(s)])));
  s.simulation = true;
  while (s.winner === null && s.turn < maxTurns && count++ < 4500) {
    const p = actor(s), config = configs[p], key = `${s.turn}:${p}`;
    if (s.phase === 'build' && !traded.has(key)) { traded.add(key); botTrade(s, p, config); }
    let action;
    if (modes[p] === 'expert') action = decide(observe(s, p), { config, strength: 'expert', rollouts: searchRollouts, horizon: searchHorizon }).action;
    else { const belief = sampleHidden(observe(s, p), seedHash(`${seed}:decision:${s.actions}:${p}`)); action = quickAction(belief, personality(s, p, config), modes[p] === 'random' ? 0.85 : modes[p] === 'baseline' ? 0.18 : 0); }
    if (keepReplay) replay.push({ turn: s.turn, player: p, action, phase: s.phase });
    applyAction(s, action); validateState(s);
  }
  return { seed, winner: s.winner, turns: s.turn, actions: count, scores: s.players.map((_, p) => points(s, p)), ...(keepReplay ? { replay } : {}) };
}
