import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, legalActions, applyAction, validateState, PIPS, RES, COST, clone, observe, publicPoints, longestRoad, awards, production, bankRate, actor, points } from '../src/engine.mjs';
import { opening, decide, sampleHidden, assessTrade, quickAction } from '../src/ai.mjs';
import { play } from '../scripts/arena.mjs';
function funded(s, p, amounts) { for (let r = 0; r < 5; r++) { s.bank[r] += s.hands[p][r] - amounts[r]; s.hands[p][r] = amounts[r]; } }
test('hex topology, deterministic seeds, nonadjacent red numbers, distance rule', () => {
  for (let seed = 0; seed < 30; seed++) {
    const s = createGame(seed);
    assert.equal(s.board.tiles.length, 19); assert.equal(s.board.nodes.length, 54); assert.equal(s.board.edges.length, 72);
    assert.equal(s.board.ports.length, 9);
    assert.equal(s.board.tiles.filter(t => t.resource >= 0).length, 18);
    for (const e of s.board.edges) assert.ok(!(e.tiles.length === 2 && e.tiles.every(t => [6, 8].includes(s.board.tiles[t].number))));
    const a = legalActions(s)[0]; applyAction(s, a); applyAction(s, legalActions(s)[0]);
    const next = legalActions(s).map(a => a.node);
    assert.ok(!next.includes(a.node)); for (const n of s.board.nodes[a.node].neighbors) assert.ok(!next.includes(n));
  }
  assert.deepEqual(createGame('same'), createGame('same'));
});
test('opening snake order, second settlement resources, and own-network legality', () => {
  const s = createGame('opening'); const seats = [];
  while (s.phase.startsWith('setup')) { if (s.phase === 'setup-settlement') seats.push(s.current); applyAction(s, quickAction(s)); validateState(s); }
  assert.deepEqual(seats, [0, 1, 2, 3, 3, 2, 1, 0]); assert.equal(s.turn, 1); assert.equal(s.phase, 'roll');
  assert.ok(s.hands.every(h => h.reduce((a, b) => a + b, 0) >= 1));
  assert.ok(s.players.every((_, p) => publicPoints(s, p) === 2));
  const before = structuredClone(s); assert.throws(() => applyAction(s, { type: 'city', node: 0 })); assert.deepEqual(s, before);
});
test('income, city double payout, raider blocking, resource shortage', () => {
  const s = createGame('production'); const tile = s.board.tiles.find(t => t.resource >= 0 && t.id !== s.robber), n = tile.nodes[0];
  s.nodeOwner[n] = 0; s.levels[n] = 2;
  production(s, tile.number); assert.ok(s.hands[0][tile.resource] >= 2); validateState(s);
  const blocked = clone(s); blocked.robber = tile.id; const previous = blocked.hands[0][tile.resource]; production(blocked, tile.number);
  const otherMatches = s.board.nodes[n].tiles.filter(id => id !== tile.id && s.board.tiles[id].number === tile.number && s.board.tiles[id].resource === tile.resource).length;
  assert.equal(blocked.hands[0][tile.resource] - previous, otherMatches * 2);
  const short = createGame('shortage'), t = short.board.tiles.find(t => t.resource >= 0); short.nodeOwner[t.nodes[0]] = 0; short.levels[t.nodes[0]] = 2; short.bank[t.resource] = 1; const prior = short.hands[0][t.resource]; production(short, t.number); assert.equal(short.hands[0][t.resource], prior);
});
test('bank rates and bank conservation; illegal trades do not mutate', () => {
  const s = opening(createGame('market')); s.phase = 'build'; funded(s, 0, [5, 2, 2, 2, 2]);
  const action = legalActions(s).find(a => a.type === 'bank' && a.give === 0); assert.ok(action); const rate = bankRate(s, 0, 0), before = s.hands[0][0]; applyAction(s, action); assert.equal(s.hands[0][0], before - rate); validateState(s);
  const copy = structuredClone(s); assert.throws(() => applyAction(s, { type: 'trade', other: 1, give: [99, 0, 0, 0, 0], get: [0, 1, 0, 0, 0] })); assert.deepEqual(s, copy);
  funded(s, 1, [0, 3, 0, 0, 0]); applyAction(s, { type: 'trade', other: 1, give: [1, 0, 0, 0, 0], get: [0, 1, 0, 0, 0] }); validateState(s);
  const harbor = s.board.ports.find(p => p.type === -1); s.nodeOwner[s.board.edges[harbor.edge].nodes[0]] = 0; assert.ok(bankRate(s, 0, 4) <= 3);
});
test('development timing, one-per-turn restriction, monopoly conservation', () => {
  const s = opening(createGame('development')); s.phase = 'build'; funded(s, 0, COST.develop); applyAction(s, { type: 'develop' });
  const bought = s.dev[0][0]; assert.equal(bought.bought, s.turn);
  assert.ok(!legalActions(s).some(a => a.type === bought.type));
  s.dev[0] = [{ type: 'monopoly', bought: 0 }, { type: 'plenty', bought: 0 }];
  applyAction(s, { type: 'monopoly', resource: 2 }); validateState(s); assert.ok(!legalActions(s).some(a => a.type === 'plenty')); assert.ok(s.hands.slice(1).every(h => h[2] === 0));
});
test('raider victims and discards cannot use unavailable resources', () => {
  const s = opening(createGame('raider')); s.phase = 'robber'; s.returnPhase = 'build';
  const a = legalActions(s)[0]; const original = clone(s); applyAction(s, a); assert.equal(s.robber, a.tile); validateState(s);
  assert.ok(!legalActions(original).some(v => v.tile === original.robber));
  s.phase = 'discard'; s.discardQueue = [0]; s.discardRemaining[0] = 1; funded(s, 0, [1, 0, 0, 0, 0]);
  assert.deepEqual(legalActions(s), [{ type: 'discard', resource: 0 }]); applyAction(s, { type: 'discard', resource: 0 }); assert.equal(s.phase, 'robber'); validateState(s);
});
test('longest road blocks at enemy settlement and award ties retain incumbent', () => {
  const s = createGame('road');
  // A simple six-edge path, with all vertices distinct.
  function path(n, used = [], seen = new Set([n])) {
    if (used.length === 6) return used;
    for (const e of s.board.nodes[n].edges) { const next = s.board.edges[e].nodes.find(v => v !== n); if (!seen.has(next)) { const found = path(next, [...used, e], new Set([...seen, next])); if (found) return found; } }
    return null;
  }
  const route = path(0); route.forEach(e => s.edgeOwner[e] = 0); assert.equal(longestRoad(s, 0), 6); awards(s); assert.equal(s.longest, 0);
  const middle = s.board.edges[route[2]].nodes.find(n => s.board.edges[route[3]].nodes.includes(n)); s.nodeOwner[middle] = 1; s.levels[middle] = 1; awards(s); assert.equal(s.roadsLength[0], 3); assert.equal(s.longest, -1);
  s.knights = [3, 3, 0, 0]; s.army = 0; awards(s); assert.equal(s.army, 0); s.army = -1; awards(s); assert.equal(s.army, -1);
});
test('bot observations redact actual opponent holdings, deck, and dice RNG', () => {
  const s = opening(createGame('fair')); s.phase = 'build'; s.timeline = [{ privateDiscard: 'ore' }]; s.futureSecret = 'not-public'; const original = observe(s, 0); assert.equal(original.timeline, undefined); assert.equal(original.futureSecret, undefined); assert.equal(original.rng, undefined); assert.equal(original.deck, null); assert.equal(original.hands[1], null); assert.equal(original.dev[1], null);
  const altered = clone(s); [altered.hands[1], altered.hands[2]] = [altered.hands[2], altered.hands[1]];
  // Swap equal-size hidden bundles to leave public card counts fixed.
  funded(altered, 1, [1, 0, 0, 0, 0]); funded(altered, 2, [0, 1, 0, 0, 0]);
  const changed = clone(altered); changed.hands[1] = [0, 1, 0, 0, 0]; changed.hands[2] = [1, 0, 0, 0, 0]; changed.rng = 999; changed.deck.reverse();
  assert.deepEqual(observe(altered, 0), observe(changed, 0));
  assert.deepEqual(decide(observe(altered, 0), { strength: 'casual', seed: 77 }).action, decide(observe(changed, 0), { strength: 'casual', seed: 77 }).action);
  const sampled = sampleHidden(original, 123); validateState(sampled); assert.deepEqual(sampled.hands[0], s.hands[0]);
});
test('sampled-future planner returns legal moves and refuses to fund a near-winner', () => {
  const s = opening(createGame('search')); s.phase = 'build'; funded(s, 0, [3, 3, 3, 3, 3]); const before = structuredClone(s);
  const result = decide(observe(s, 0), { rollouts: 8, horizon: 3 });
  assert.equal(result.simulations, 8); assert.ok(legalActions(s).some(a => JSON.stringify(a) === JSON.stringify(result.action))); assert.deepEqual(s, before);
  s.nodeOwner.fill(0); s.levels.fill(1); s.hands[1] = [0, 1, 0, 0, 0];
  assert.equal(assessTrade(observe(s, 1), { from: 0, other: 1, give: [10, 0, 0, 0, 0], get: [0, 1, 0, 0, 0] }).accept, false);
});
test('seeded full matches finish, obey legal moves, and conserve every resource', () => {
  for (let i = 0; i < 8; i++) { const result = play(`regression-${i}`); assert.notEqual(result.winner, null, `unfinished ${i}`); assert.ok(result.scores[result.winner] >= 10); assert.ok(result.actions < 4500); }
});
test('unknown development purchases have order-independent expected value', async () => {
  const { rankActions } = await import('../src/ai.mjs');
  const s = opening(createGame('unknown-card')); s.phase = 'build'; funded(s, 0, COST.develop);
  const ownNode = s.nodeOwner.findIndex(v => v === 0); s.levels[ownNode] = 2;
  s.longest = 0; s.dev[0] = Array.from({ length: 4 }, () => ({ type: 'point', bought: 0 }));
  s.playedCards = { knight: 14, roads: 2, plenty: 2, monopoly: 1, point: 0 }; s.deck = ['monopoly', 'point'];
  assert.equal(points(s, 0), 9);
  const reversed = clone(s); reversed.deck.reverse();
  const value = v => rankActions(v).find(a => a.action.type === 'develop').value;
  assert.equal(value(s), value(reversed)); assert.ok(value(s) < 1000);
});
test('negotiators remember recently declined identical bundles', async () => {
  const { noteOffer } = await import('../src/ai.mjs');
  const s = opening(createGame('memory')); funded(s, 1, [0, 1, 0, 0, 0]);
  const offer = { from: 0, other: 1, give: [1, 0, 0, 0, 0], get: [0, 1, 0, 0, 0] };
  noteOffer(s, offer, false);
  const reply = assessTrade(observe(s, 1), offer); assert.equal(reply.accept, false); assert.match(reply.reason, /remember/i);
});
test('private discard identities do not enter public production beliefs', () => {
  const s = opening(createGame('discard-privacy')); funded(s, 1, [1, 1, 1, 0, 0]); s.current = 0; s.phase = 'discard'; s.discardQueue = [1]; s.discardRemaining[1] = 1;
  const other = clone(s); applyAction(s, { type: 'discard', resource: 0 }); applyAction(other, { type: 'discard', resource: 1 });
  assert.deepEqual(s.knowledge, other.knowledge);
});
