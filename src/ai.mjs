import { RES, COST, PIPS, sum, random, shuffle, seedHash, clone, legalActions, applyAction, publicPoints, points, vacant, bankRate, pieces, actor, observe } from './engine.mjs';
import { POLICY } from './policy.mjs';
export { POLICY };

export function personality(s, p, config = POLICY) {
  const w = { ...config.weights }, resource = config.resource.slice(), style = s.players[p].style;
  if (style === 'builder') { w.production *= 1.12; w.expansion *= 1.08; resource[3] *= 1.08; resource[4] *= 1.08; }
  if (style === 'merchant') { w.diversity *= 1.15; w.hand *= 1.12; resource[2] *= 1.12; }
  if (style === 'tactician') { w.army *= 1.3; w.threat *= 1.12; resource[4] *= 1.08; }
  return { ...config, weights: w, resource };
}

const DECK = { knight: 14, point: 5, roads: 2, plenty: 2, monopoly: 2 };
export function rates(s, p, blocked = false) {
  const result = Array(5).fill(0);
  s.nodeOwner.forEach((owner, n) => { if (owner === p) for (const t of s.board.nodes[n].tiles) { const tile = s.board.tiles[t]; if (tile.resource >= 0 && (!blocked || t !== s.robber)) result[tile.resource] += PIPS[tile.number] / 36 * s.levels[n]; } });
  return result;
}
export function placementValue(s, node, p, config = POLICY) {
  const own = rates(s, p), tiles = s.board.nodes[node].tiles.map(t => s.board.tiles[t]).filter(t => t.resource >= 0);
  const resources = new Set(tiles.map(t => t.resource));
  let value = tiles.reduce((v, t) => v + PIPS[t.number] * config.resource[t.resource] * (1 + 0.18 / (0.15 + own[t.resource] * 3)), 0);
  value += [...resources].reduce((v, r) => v + (own[r] < 0.01 ? 2.8 : 0.3), 0);
  const nums = new Set(s.board.nodes.filter(n => s.nodeOwner[n.id] === p).flatMap(n => n.tiles.map(t => s.board.tiles[t].number)));
  value += tiles.filter(t => !nums.has(t.number)).length * 0.7;
  const harbor = s.board.nodes[node].harbor;
  if (harbor !== null) value += harbor === -1 ? 1.5 : own[harbor] * 8;
  return value;
}
export function expansionOptions(s, p, config = POLICY) {
  const nodes = s.board.nodes, distance = Array(nodes.length).fill(Infinity), paths = Array.from({ length: nodes.length }, () => []), queue = [];
  for (const n of nodes) if (s.nodeOwner[n.id] === p || (s.nodeOwner[n.id] < 0 && n.edges.some(e => s.edgeOwner[e] === p))) { distance[n.id] = 0; queue.push(n.id); }
  while (queue.length) {
    const n = queue.shift();
    if (s.nodeOwner[n] >= 0 && s.nodeOwner[n] !== p) continue;
    for (const e of nodes[n].edges) if (s.edgeOwner[e] < 0 || s.edgeOwner[e] === p) {
      const other = s.board.edges[e].nodes.find(v => v !== n), cost = s.edgeOwner[e] < 0 ? 1 : 0, d = distance[n] + cost;
      if (d < distance[other] && d <= 4) { distance[other] = d; paths[other] = [...paths[n], ...(cost ? [e] : [])]; queue.push(other); }
    }
  }
  return nodes.filter(n => vacant(s, n.id) && distance[n.id] < Infinity).map(n => ({ node: n.id, distance: distance[n.id], path: paths[n.id], quality: placementValue(s, n.id, p, config) })).sort((a, b) => b.quality / (1 + b.distance * 1.5) - a.quality / (1 + a.distance * 1.5));
}
export function strategicGoal(s, p, config = POLICY) {
  const ownRates = rates(s, p), hand = s.hands[p], stock = pieces(s, p), options = [];
  const add = (type, quality, cost = COST[type]) => {
    const missing = cost.map((n, r) => Math.max(0, n - hand[r]));
    const eta = Math.max(...missing.map((n, r) => n / (ownRates[r] + 0.055)));
    options.push({ type, cost, missing, eta, value: quality / (1 + eta / 15), progress: 1 / (1 + sum(missing) * 0.65) });
  };
  if (stock.cities < 4 && s.nodeOwner.some((owner, n) => owner === p && s.levels[n] === 1)) add('city', 1.9 + ownRates[3] + ownRates[4]);
  const sites = expansionOptions(s, p, config);
  if (stock.settlements < 5 && sites.length) {
    const site = sites[0]; if (site.distance === 0) add('settlement', 1.5 + site.quality / 25);
    else if (stock.roads < 15) add('road', 0.9 + site.quality / (30 * site.distance));
  }
  if ((s.deck?.length ?? s.deckCount ?? 0) > 0) add('develop', 0.85 + (s.knights[p] === 2 ? 0.6 : 0) + (points(s, p) >= 8 ? 0.5 : 0));
  options.sort((a, b) => b.value - a.value);
  return options[0] ?? { type: 'develop', cost: COST.develop, missing: COST.develop.map((n, r) => Math.max(0, n - hand[r])), eta: 30, progress: 0, value: 0 };
}
export function resourcePrices(s, p, config = POLICY) {
  const goal = strategicGoal(s, p, config), production = rates(s, p), hand = s.hands[p];
  return RES.map((_, r) => config.resource[r] * (0.9 + (goal.missing[r] > 0 ? 1.4 : 0) + 0.18 / (0.1 + production[r])) / (1 + Math.max(0, hand[r] - goal.cost[r]) * 0.24));
}
export function evaluate(s, p, config = POLICY) {
  if (s.winner !== null) return s.winner === p ? 10000 : -10000;
  const production = rates(s, p), hand = s.hands[p], own = points(s, p), bestOpponent = Math.max(...s.players.filter(v => v.id !== p).map(v => publicPoints(s, v.id))), goal = strategicGoal(s, p, config), expansion = expansionOptions(s, p, config)[0];
  const w = config.weights;
  let handValue = 0;
  for (let r = 0; r < 5; r++) handValue += Math.sqrt(hand[r]) * config.resource[r] + Math.min(hand[r], goal.cost[r]) * 0.3;
  const frontier = expansion ? expansion.quality / ((1 + expansion.distance * 1.6) * 18) : 0;
  return own * w.points + sum(production) * w.production + sum(production.map(v => Math.sqrt(v))) * w.diversity + frontier * w.expansion + handValue * w.hand + goal.progress * w.progress + Math.min(2.9, s.knights[p]) * w.army - bestOpponent * w.threat - Math.max(0, sum(hand) - 7) * 0.11;
}
export function sampleHidden(view, seed) {
  const s = clone(view); s.rng = seed >>> 0 || 1; s.simulation = true; s.events = []; s.trades = []; const p = view.viewer;
  const pool = RES.map((_, r) => Math.max(0, 19 - s.bank[r] - s.hands[p][r]));
  for (let other = 0; other < 4; other++) if (other !== p) {
    s.hands[other] = Array(5).fill(0);
    for (let n = 0; n < view.handCounts[other]; n++) {
      const weights = pool.map((count, r) => count * (0.5 + Math.sqrt(view.knowledge[other][r] ?? 1))), total = sum(weights);
      if (!total) break;
      let dart = random(s) * total, chosen = 4;
      for (let r = 0; r < 5; r++) { dart -= weights[r]; if (dart <= 0 && pool[r]) { chosen = r; break; } }
      if (!pool[chosen]) chosen = pool.findIndex(v => v > 0);
      pool[chosen]--; s.hands[other][chosen]++;
    }
  }
  let cards = Object.entries(DECK).flatMap(([type, n]) => Array(Math.max(0, n - (view.playedCards[type] ?? 0) - view.dev[p].filter(c => c.type === type).length)).fill(type));
  cards = shuffle(cards, s);
  for (let other = 0; other < 4; other++) if (other !== p) s.dev[other] = Array.from({ length: view.devCounts[other] }, () => ({ type: cards.pop() ?? 'knight', bought: Math.max(0, s.turn - 4) }));
  s.deck = cards;
  return s;
}
function robberValue(s, action, p) {
  const tile = s.board.tiles[action.tile]; let value = 0;
  for (const n of tile.nodes) {
    const owner = s.nodeOwner[n]; if (owner < 0) continue;
    value += PIPS[tile.number] * s.levels[n] * (owner === p ? -2.3 : 0.7 + publicPoints(s, owner) / 5);
  }
  return value + (action.victim >= 0 ? 3 + publicPoints(s, action.victim) / 3 : 0);
}
export function rankActions(s, p = actor(s), config = POLICY) {
  const actions = legalActions(s, p);
  if (actions.length === 1) return [{ action: actions[0], value: 0 }];
  if (s.phase === 'setup-settlement') return actions.map(action => ({ action, value: placementValue(s, action.node, p, config) })).sort((a, b) => b.value - a.value);
  const expansion = ['setup-road', 'build', 'free-road'].includes(s.phase) ? expansionOptions(s, p, config) : [];
  if (s.phase === 'setup-road') return actions.map(action => ({ action, value: Math.max(0, ...expansion.filter(o => o.path[0] === action.edge).map(o => o.quality / Math.max(1, o.distance))) })).sort((a, b) => b.value - a.value);
  if (s.phase === 'robber') return actions.map(action => ({ action, value: robberValue(s, action, p) })).sort((a, b) => b.value - a.value);
  if (s.phase === 'discard') { const prices = resourcePrices(s, p, config); return actions.map(action => ({ action, value: -prices[action.resource] })).sort((a, b) => b.value - a.value); }
  const before = evaluate(s, p, config);
  return actions.map(action => {
    if (action.type === 'end') return { action, value: before - 0.03 };
    if (action.type === 'roll') return { action, value: before + 0.1 };
    const next = clone(s); next.simulation = true; applyAction(next, action, { validate: false });
    let cardExpectation = 0;
    if (action.type === 'develop') {
      // Buying an unknown card must not be valued using this sample's particular next card.
      const pointCount = Math.max(0, DECK.point - (s.playedCards.point ?? 0) - s.dev[p].filter(c => c.type === 'point').length);
      const unseen = Math.max(1, 25 - sum(Object.values(s.playedCards)) - s.dev[p].length);
      next.dev[p][next.dev[p].length - 1].type = 'knight';
      next.winner = null; next.phase = s.phase;
      cardExpectation = pointCount / unseen * config.weights.points + 0.65;
    }
    let value = evaluate(next, p, config) + cardExpectation;
    if (action.type === 'knight') value += s.board.tiles[s.robber].nodes.some(n => s.nodeOwner[n] === p) ? 1.2 : -0.7;
    if (action.type === 'road') value += Math.max(0, ...expansion.filter(o => o.path[0] === action.edge).map(o => o.quality / (o.distance * 80 + 40)));
    if (action.type === 'roads') value += 1.1;
    if (action.type === 'monopoly') value += Math.min(3, next.hands[p][action.resource] - s.hands[p][action.resource]) * 0.1;
    return { action, value };
  }).sort((a, b) => b.value - a.value);
}
export function quickAction(s, config = POLICY, randomChance = 0) {
  const ranked = rankActions(s, actor(s), config);
  if (!ranked.length) throw new Error(`No legal moves in ${s.phase}`);
  return randomChance && random(s) < randomChance ? ranked[Math.floor(random(s) * ranked.length)].action : ranked[0].action;
}
export function opening(s, config = POLICY) {
  while (s.phase.startsWith('setup')) applyAction(s, quickAction(s, personality(s, actor(s), config)));
  return s;
}
export function describe(action, s, p) {
  const goal = strategicGoal(s, p);
  const targets = { city: 'Upgrade a high-yield outpost', settlement: 'Secure a new production hub', road: 'Connect the next expansion site', develop: 'Invest in flexible development' };
  const phrase = {
    settlement: 'Balances dice yield, resource scarcity, and room to expand.',
    city: 'Doubles production at an established hub and adds a point.',
    road: 'Advances a connected route toward a valuable legal outpost.',
    bank: `Exchanges surplus ${RES[action.give]} for scarce ${RES[action.get]}.`,
    develop: 'Adds a hidden tactical option without committing to a route.',
    robber: 'Weighs blocked income, opponent threat, and the cost to our own economy.',
    knight: 'Improves military pressure and opens a raider move.',
    plenty: 'Fills the most useful gaps in the build plan.', monopoly: 'Uses public resource evidence to estimate the most valuable resource.',
    roads: 'Converts a development card into connected expansion.',
    discard: 'Protects resources that are harder to replace or needed for the next build.',
    end: 'Keeps a useful reserve instead of spending on a weak move.', roll: 'Collects production before committing to a build.', 'skip-road': 'Avoids spending a free road where it cannot help.'
  };
  return { goal: targets[goal.type] ?? 'Build a resilient economy', reason: phrase[action.type] ?? 'Chooses a legal move consistent with the current plan.' };
}
export function decide(view, { strength = 'expert', seed = seedHash(`decision:${view.turn}:${view.actions}:${view.viewer}`), config = POLICY, rollouts, horizon = 5 } = {}) {
  const started = performance.now(), p = view.viewer;
  if (actor(view) !== p) throw new Error('Decision requested for inactive player');
  const baseConfig = config; config = personality(view, p, config);
  const root = sampleHidden(view, seed), ranked = rankActions(root, p, config);
  if (!ranked.length) throw new Error('No available decision');
  const direct = view.phase !== 'build' || ranked.length === 1 || strength === 'casual';
  let chosen = ranked[0].action, simulations = 0, alternatives = ranked.slice(0, 4).map(v => ({ action: v.action, estimate: v.value }));
  if (!direct) {
    const candidates = ranked.slice(0, strength === 'expert' ? 6 : 4), count = rollouts ?? (strength === 'expert' ? 54 : 20);
    const stats = candidates.map(() => ({ n: 0, total: 0, squared: 0 }));
    let world = 0;
    while (simulations < count) {
      let baseline = null;
      for (let index = 0; index < candidates.length && simulations < count; index++) {
        const s = sampleHidden(view, seedHash(`${seed}:world:${world}`));
        // Separate scenario chance from the sampler; deterministic rollout policies avoid
        // consuming dice randomness just to decide whether to explore a policy action.
        s.rng = seedHash(`${seed}:dice:${world}`);
        applyAction(s, candidates[index].action, { validate: false });
        const stopTurn = view.turn + horizon; let steps = 0;
        while (s.winner === null && s.turn < stopTurn && steps++ < 64) {
          applyAction(s, quickAction(s, personality(s, actor(s), baseConfig)), { validate: false });
        }
        const value = s.winner === p ? 250 : s.winner !== null ? -250 : evaluate(s, p, config);
        if (index === 0) baseline = value;
        const delta = Math.max(-60, Math.min(60, value - baseline));
        stats[index].total += delta; stats[index].squared += delta * delta; stats[index].n++; simulations++;
      }
      world++;
    }
    alternatives = candidates.map((candidate, i) => {
      const stat = stats[i], mean = stat.n ? stat.total / stat.n : 0;
      const variance = stat.n > 1 ? Math.max(0, stat.squared / stat.n - mean * mean) : 0;
      const uncertainty = Math.sqrt(variance / Math.max(1, stat.n));
      const priorGap = ranked[0].value - candidate.value;
      // Search can challenge a prior, but a few lucky futures cannot freely overrule it.
      const estimate = i === 0 ? 0 : 0.35 * (mean - 0.8 * uncertainty) - 0.65 * priorGap - 0.12;
      return { action: candidate.action, estimate, visits: stat.n, pairedMean: mean, uncertainty };
    }).sort((a, b) => b.estimate - a.estimate);
    const win = candidates.find(c => {
      if (c.action.type === 'develop') return false; // the next development card is unknown
      const next = clone(root); applyAction(next, c.action, { validate: false }); return next.winner === p;
    });
    chosen = win?.action ?? alternatives[0].action;
  }
  const explanation = describe(chosen, root, p);
  return { action: chosen, ...explanation, simulations, elapsedMs: Math.round(performance.now() - started), alternatives, model: config.provenance, difficulty: strength };
}
export function noteOffer(s, offer, accepted) {
  s.offerHistory = [...(s.offerHistory ?? []).slice(-119), { ...offer, give: offer.give.slice(), get: offer.get.slice(), accepted, turn: s.turn }];
}

export function assessTrade(view, offer, config = POLICY) {
  const p = view.viewer, initiator = offer.from, hand = view.hands[p];
  config = personality(view, p, config);
  const repeats = (view.offerHistory ?? []).filter(o => o.from === initiator && o.other === p && !o.accepted && view.turn - o.turn <= 8 && JSON.stringify(o.give) === JSON.stringify(offer.give) && JSON.stringify(o.get) === JSON.stringify(offer.get));
  if (repeats.length) return { accept: false, reason: 'I remember that offer. My price has not changed; try a different bundle.' };
  if (!offer.get.every((n, r) => hand[r] >= n)) return { accept: false, reason: 'I cannot supply that bundle.' };
  if (publicPoints(view, initiator) >= 9) return { accept: false, reason: 'That trade gives the leader too much room to finish.' };
  const prices = resourcePrices(view, p, config), incoming = sum(offer.give.map((n, r) => n * prices[r])), outgoing = sum(offer.get.map((n, r) => n * prices[r]));
  const net = incoming - outgoing, next = clone(view); next.hands[p] = hand.map((n, r) => n + offer.give[r] - offer.get[r]);
  const before = strategicGoal(view, p, config), after = strategicGoal(next, p, config), helpsBuild = after.progress > before.progress + 0.1;
  const risk = (publicPoints(view, initiator) >= 7 ? 0.8 : 0) + (view.players[p].style === 'tactician' ? 0.12 : view.players[p].style === 'merchant' ? -0.15 : 0);
  const accept = net >= risk + (helpsBuild ? -0.6 : 0.05);
  let counter = null;
  if (!accept && net > -3 && publicPoints(view, initiator) < 9) {
    const give = offer.give.slice(), get = offer.get.slice();
    const preferred = prices.map((price, r) => ({ price, r })).filter(v => !get[v.r]).sort((a, b) => b.price - a.price)[0];
    if (preferred) { give[preferred.r]++; counter = { ...offer, give, get }; }
  }
  return { accept, counter, reason: accept ? (helpsBuild ? 'That gets my next build closer. Deal.' : 'The exchange is useful at these prices. Deal.') : risk ? 'I need a better price to strengthen a leading player.' : 'I value what you want more than what you offered.', utility: net };
}
export function proposeTrade(view, config = POLICY) {
  const p = view.viewer; config = personality(view, p, config);
  const prices = resourcePrices(view, p, config), goal = strategicGoal(view, p, config), hand = view.hands[p];
  const need = prices.map((price, r) => ({ price, r })).filter(v => goal.missing[v.r] > 0).sort((a, b) => b.price - a.price)[0];
  const excess = prices.map((price, r) => ({ price, r })).filter(v => hand[v.r] > goal.cost[v.r]).sort((a, b) => a.price - b.price)[0];
  if (!need || !excess || need.r === excess.r) return null;
  const choices = view.players.filter(v => v.id !== p && view.handCounts[v.id] > 0 && publicPoints(view, v.id) < 9).map(v => ({ id: v.id, likelihood: view.knowledge[v.id][need.r] / (1 + publicPoints(view, v.id) * 0.15) })).sort((a, b) => b.likelihood - a.likelihood);
  if (!choices.length) return null;
  const amount = Math.min(2, Math.max(1, hand[excess.r] - goal.cost[excess.r]), Math.max(1, Math.ceil(prices[need.r] / prices[excess.r] * 0.7)));
  const give = Array(5).fill(0), get = Array(5).fill(0); give[excess.r] = amount; get[need.r] = 1;
  const partner = choices.find(c => !(view.offerHistory ?? []).some(o => o.from === p && o.other === c.id && !o.accepted && view.turn - o.turn <= 8 && JSON.stringify(o.give) === JSON.stringify(give) && JSON.stringify(o.get) === JSON.stringify(get)));
  return partner ? { from: p, other: partner.id, give, get } : null;
}
export function botTrade(s, p, config = POLICY) {
  const offer = proposeTrade(observe(s, p), config);
  if (!offer) return false;
  const accepted = assessTrade(observe(s, offer.other), offer, config).accept;
  noteOffer(s, offer, accepted);
  if (accepted) { try { applyAction(s, { type: 'trade', other: offer.other, give: offer.give, get: offer.get }); return true; } catch { return false; } }
  return false;
}
