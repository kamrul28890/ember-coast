// Original deterministic rules engine. Rendering, policy, and hidden-state observations are separate.
export const RES = ['timber', 'brick', 'wool', 'grain', 'ore'];
export const COST = { road: [1, 1, 0, 0, 0], settlement: [1, 1, 1, 1, 0], city: [0, 0, 0, 2, 3], develop: [0, 0, 1, 1, 1] };
export const COLORS = ['#df7955', '#648b70', '#c8a044', '#8b7cb5'];
export const PIPS = [0, 0, 1, 2, 3, 4, 5, 0, 5, 4, 3, 2, 1];
const OPENING = [0, 1, 2, 3, 3, 2, 1, 0];
export const sum = a => a.reduce((v, n) => v + n, 0);
export function seedHash(value) { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 || 1; }
export function random(s) { let t = s.rng += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); s.rng >>>= 0; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
export function shuffle(items, s) { const a = items.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function makeBoard(seed) {
  const rng = { rng: seedHash(seed) }, tiles = [], nodes = [], edges = [], nodeMap = new Map(), edgeMap = new Map();
  let terrains = shuffle([0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, -1], rng);
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) {
    const t = { id: tiles.length, q, r, x: Math.sqrt(3) * (q + r / 2), y: 1.5 * r, resource: terrains[tiles.length], number: 0, nodes: [], edges: [] };
    for (let k = 0; k < 6; k++) {
      const a = (60 * k - 30) * Math.PI / 180, x = t.x + Math.cos(a), y = t.y + Math.sin(a), key = `${Math.round(x * 10000)},${Math.round(y * 10000)}`;
      if (!nodeMap.has(key)) { nodeMap.set(key, nodes.length); nodes.push({ id: nodes.length, x, y, tiles: [], edges: [], neighbors: [], harbor: null }); }
      const n = nodeMap.get(key); t.nodes.push(n); nodes[n].tiles.push(t.id);
    }
    for (let k = 0; k < 6; k++) {
      const pair = [t.nodes[k], t.nodes[(k + 1) % 6]].sort((a, b) => a - b), key = pair.join('-');
      if (!edgeMap.has(key)) {
        const id = edges.length; edgeMap.set(key, id); edges.push({ id, nodes: pair, tiles: [] });
        for (const n of pair) { nodes[n].edges.push(id); nodes[n].neighbors.push(pair.find(i => i !== n)); }
      }
      const e = edgeMap.get(key); edges[e].tiles.push(t.id); t.edges.push(e);
    }
    tiles.push(t);
  }
  const numbers = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  for (let attempt = 0; attempt < 500; attempt++) {
    const ns = shuffle(numbers, rng); let i = 0;
    for (const t of tiles) t.number = t.resource < 0 ? 0 : ns[i++];
    if (!edges.some(e => e.tiles.length === 2 && e.tiles.every(id => [6, 8].includes(tiles[id].number)))) break;
  }
  const shore = edges.filter(e => e.tiles.length === 1).sort((a, b) => {
    const midpoint = e => e.nodes.map(n => nodes[n]).reduce((p, n) => [p[0] + n.x / 2, p[1] + n.y / 2], [0, 0]);
    const pa = midpoint(a), pb = midpoint(b); return Math.atan2(pa[1], pa[0]) - Math.atan2(pb[1], pb[0]);
  });
  const portTypes = shuffle([-1, -1, -1, -1, 0, 1, 2, 3, 4], rng), ports = [];
  for (let i = 0; i < 9; i++) {
    const edge = shore[Math.floor(i * shore.length / 9)], type = portTypes[i];
    for (const n of edge.nodes) nodes[n].harbor = type;
    ports.push({ edge: edge.id, type });
  }
  return { tiles, nodes, edges, ports };
}
export function createGame(seed = 'ember-1', { difficulty = 'expert', human = true } = {}) {
  const board = makeBoard(seed), s = {
    version: 1, seed: String(seed), rng: seedHash(`${seed}:chance`), board, difficulty,
    players: [{ name: human ? 'You' : 'Ari', title: 'Island keeper', style: 'balanced' }, { name: 'Mira', title: 'The architect', style: 'builder' }, { name: 'Theo', title: 'The merchant', style: 'merchant' }, { name: 'Jun', title: 'The tactician', style: 'tactician' }].map((p, id) => ({ ...p, id, color: COLORS[id], human: human && id === 0 })),
    nodeOwner: Array(board.nodes.length).fill(-1), levels: Array(board.nodes.length).fill(0), edgeOwner: Array(board.edges.length).fill(-1),
    hands: Array.from({ length: 4 }, () => Array(5).fill(0)), dev: Array.from({ length: 4 }, () => []),
    bank: Array(5).fill(19), deck: [], playedCards: { knight: 0, plenty: 0, monopoly: 0, roads: 0, point: 0 }, knights: [0, 0, 0, 0],
    roadsLength: [0, 0, 0, 0], longest: -1, army: -1, phase: 'setup-settlement', current: 0, setupIndex: 0, setupNode: null,
    turn: 0, rolled: false, dice: [0, 0], robber: board.tiles.find(t => t.resource < 0).id, playedDev: false, freeRoads: 0, returnPhase: 'build',
    discardQueue: [], discardRemaining: [0, 0, 0, 0], winner: null, events: [], rolls: Array(13).fill(0), actions: 0,
    knowledge: Array.from({ length: 4 }, () => Array(5).fill(1)), decisions: [null, null, null, null], trades: [],
  };
  s.deck = shuffle([...Array(14).fill('knight'), ...Array(5).fill('point'), ...Array(2).fill('roads'), ...Array(2).fill('plenty'), ...Array(2).fill('monopoly')], s);
  log(s, 'A new island awaits. Two outposts and two roads for every explorer.');
  return s;
}
export function clone(s) {
  return { ...s, hands: s.hands.map(a => a?.slice() ?? null), dev: s.dev.map(a => a?.map(c => ({ ...c })) ?? null), bank: s.bank.slice(), deck: s.deck?.slice() ?? null, playedCards: { ...s.playedCards }, nodeOwner: s.nodeOwner.slice(), levels: s.levels.slice(), edgeOwner: s.edgeOwner.slice(), knights: s.knights.slice(), roadsLength: s.roadsLength.slice(), discardQueue: s.discardQueue.slice(), discardRemaining: s.discardRemaining.slice(), dice: s.dice.slice(), rolls: s.rolls.slice(), knowledge: s.knowledge.map(a => a.slice()), events: s.events, trades: s.trades, decisions: s.decisions.slice() };
}
export function actor(s) { return s.phase === 'discard' ? s.discardQueue[0] : s.current; }
export function log(s, text, player = null, kind = 'action') { if (!s.simulation) s.events = [...s.events.slice(-119), { text, player, kind, turn: s.turn, id: s.actions }]; }
export function publicPoints(s, p) { return s.nodeOwner.reduce((v, owner, n) => v + (owner === p ? s.levels[n] : 0), 0) + (s.longest === p ? 2 : 0) + (s.army === p ? 2 : 0); }
export function points(s, p) { return publicPoints(s, p) + (s.dev[p]?.filter(c => c.type === 'point').length ?? 0); }
export const canPay = (hand, cost) => hand && cost.every((n, r) => hand[r] >= n);
export function vacant(s, n) { return s.nodeOwner[n] < 0 && s.board.nodes[n].neighbors.every(v => s.nodeOwner[v] < 0); }
export function pieces(s, p) { return { roads: s.edgeOwner.filter(v => v === p).length, settlements: s.nodeOwner.filter((v, i) => v === p && s.levels[i] === 1).length, cities: s.nodeOwner.filter((v, i) => v === p && s.levels[i] === 2).length }; }
export function roadConnected(s, edge, p) {
  return s.board.edges[edge].nodes.some(n => s.nodeOwner[n] === p || (s.nodeOwner[n] < 0 && s.board.nodes[n].edges.some(e => s.edgeOwner[e] === p)));
}
export function bankRate(s, p, resource) {
  let rate = 4;
  s.board.nodes.forEach(n => { if (s.nodeOwner[n.id] === p) { if (n.harbor === resource) rate = 2; else if (n.harbor === -1) rate = Math.min(rate, 3); } });
  return rate;
}
export function eligibleVictims(s, p, tile) {
  return [...new Set(s.board.tiles[tile].nodes.map(n => s.nodeOwner[n]))].filter(v => v >= 0 && v !== p && (s.hands[v] ? sum(s.hands[v]) : s.handCounts?.[v] ?? 0) > 0);
}
export function legalActions(s, p = actor(s)) {
  if (s.winner !== null || p !== actor(s)) return [];
  const result = [], stock = pieces(s, p), hand = s.hands[p];
  if (s.phase === 'setup-settlement') return s.board.nodes.filter(n => vacant(s, n.id)).map(n => ({ type: 'settlement', node: n.id }));
  if (s.phase === 'setup-road') return s.board.nodes[s.setupNode].edges.filter(e => s.edgeOwner[e] < 0).map(edge => ({ type: 'road', edge }));
  if (s.phase === 'discard') return RES.flatMap((_, resource) => hand[resource] > 0 ? [{ type: 'discard', resource }] : []);
  if (s.phase === 'robber') {
    for (const tile of s.board.tiles) if (tile.id !== s.robber) { const victims = eligibleVictims(s, p, tile.id); for (const victim of victims.length ? victims : [-1]) result.push({ type: 'robber', tile: tile.id, victim }); }
    return result;
  }
  const roadActions = () => stock.roads < 15 ? s.board.edges.filter(e => s.edgeOwner[e.id] < 0 && roadConnected(s, e.id, p)).map(e => ({ type: 'road', edge: e.id })) : [];
  if (s.phase === 'free-road') return [...roadActions(), { type: 'skip-road' }];
  if (s.phase === 'roll') result.push({ type: 'roll' });
  if (s.phase === 'build') {
    if (canPay(hand, COST.road)) result.push(...roadActions());
    if (stock.settlements < 5 && canPay(hand, COST.settlement)) for (const n of s.board.nodes) if (vacant(s, n.id) && n.edges.some(e => s.edgeOwner[e] === p)) result.push({ type: 'settlement', node: n.id });
    if (stock.cities < 4 && canPay(hand, COST.city)) s.nodeOwner.forEach((v, node) => { if (v === p && s.levels[node] === 1) result.push({ type: 'city', node }); });
    if ((s.deck?.length ?? s.deckCount ?? 0) > 0 && canPay(hand, COST.develop)) result.push({ type: 'develop' });
    for (let give = 0; give < 5; give++) if (hand[give] >= bankRate(s, p, give)) for (let get = 0; get < 5; get++) if (get !== give && s.bank[get] > 0) result.push({ type: 'bank', give, get });
    result.push({ type: 'end' });
  }
  if (['roll', 'build'].includes(s.phase) && !s.playedDev) {
    const ready = new Set(hand ? s.dev[p]?.filter(c => c.bought < s.turn).map(c => c.type) : []);
    if (ready.has('knight')) result.push({ type: 'knight' });
    if (ready.has('roads') && roadActions().length) result.push({ type: 'roads' });
    if (ready.has('monopoly')) for (let resource = 0; resource < 5; resource++) result.push({ type: 'monopoly', resource });
    if (ready.has('plenty')) for (let a = 0; a < 5; a++) for (let b = a; b < 5; b++) if (s.bank[a] >= (a === b ? 2 : 1) && s.bank[b] >= 1) result.push({ type: 'plenty', resources: [a, b] });
  }
  return result;
}
const equalAction = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function pay(s, p, cost, visible = true) {
  const previousCount = sum(s.hands[p]);
  cost.forEach((n, r) => { s.hands[p][r] -= n; s.bank[r] += n; if (visible) s.knowledge[p][r] = Math.max(0.1, s.knowledge[p][r] - n); });
  if (!visible) s.knowledge[p] = s.knowledge[p].map(v => Math.max(0.1, v * sum(s.hands[p]) / Math.max(1, previousCount)));
}
function give(s, p, r, n = 1) { s.hands[p][r] += n; s.bank[r] -= n; s.knowledge[p][r] += n; }
export function production(s, roll) {
  const demand = Array.from({ length: 4 }, () => Array(5).fill(0));
  for (const tile of s.board.tiles) if (tile.number === roll && tile.id !== s.robber && tile.resource >= 0) for (const n of tile.nodes) if (s.nodeOwner[n] >= 0) demand[s.nodeOwner[n]][tile.resource] += s.levels[n];
  const gained = Array(4).fill(0);
  for (let r = 0; r < 5; r++) if (demand.reduce((v, hand) => v + hand[r], 0) <= s.bank[r]) for (let p = 0; p < 4; p++) if (demand[p][r]) { give(s, p, r, demand[p][r]); gained[p] += demand[p][r]; }
  return gained;
}
export function longestRoad(s, p) {
  let best = 0;
  function walk(n, used) {
    best = Math.max(best, used.size);
    if (used.size && s.nodeOwner[n] >= 0 && s.nodeOwner[n] !== p) return;
    for (const e of s.board.nodes[n].edges) if (s.edgeOwner[e] === p && !used.has(e)) { used.add(e); walk(s.board.edges[e].nodes.find(v => v !== n), used); used.delete(e); }
  }
  for (const n of s.board.nodes) if (n.edges.some(e => s.edgeOwner[e] === p)) walk(n.id, new Set());
  return best;
}
export function awards(s) {
  s.roadsLength = s.players.map((_, p) => longestRoad(s, p));
  for (const [field, values, minimum] of [['longest', s.roadsLength, 5], ['army', s.knights, 3]]) {
    const maximum = Math.max(...values), leaders = values.map((n, p) => n === maximum ? p : -1).filter(p => p >= 0);
    if (maximum < minimum) s[field] = -1;
    else if (leaders.length === 1) s[field] = leaders[0];
    else if (!leaders.includes(s[field])) s[field] = -1;
  }
}
function checkWin(s) { if (points(s, s.current) >= 10) { s.winner = s.current; s.phase = 'finished'; log(s, `${s.players[s.current].name} ${s.players[s.current].human ? 'reach' : 'reaches'} ${points(s, s.current)} points and ${s.players[s.current].human ? 'win' : 'wins'} the island.`, s.current, 'win'); } }
export function applyAction(s, action, { validate = true } = {}) {
  const p = actor(s), a = action, name = s.players[p].name;
  const verb = (singular, base) => s.players[p].human ? base : singular;
  if (a.type === 'trade') { applyTrade(s, a); s.actions++; checkWin(s); return s; }
  if (validate && !legalActions(s, p).some(v => equalAction(v, a))) throw new Error(`Illegal ${a.type} in ${s.phase} for player ${p}`);
  s.actions++;
  if (a.type === 'settlement') {
    s.nodeOwner[a.node] = p; s.levels[a.node] = 1;
    if (s.phase === 'setup-settlement') {
      s.setupNode = a.node; s.phase = 'setup-road';
      if (s.setupIndex >= 4) for (const t of s.board.nodes[a.node].tiles) { const r = s.board.tiles[t].resource; if (r >= 0 && s.bank[r]) give(s, p, r); }
    } else { pay(s, p, COST.settlement); awards(s); }
    log(s, `${name} ${verb('establishes', 'establish')} an outpost.`, p, 'build');
  } else if (a.type === 'road') {
    s.edgeOwner[a.edge] = p;
    if (s.phase === 'setup-road') {
      s.setupIndex++;
      if (s.setupIndex === 8) { s.current = 0; s.phase = 'roll'; s.turn = 1; }
      else { s.current = OPENING[s.setupIndex]; s.phase = 'setup-settlement'; }
    } else if (s.phase === 'free-road') { if (--s.freeRoads <= 0) s.phase = s.returnPhase; }
    else pay(s, p, COST.road);
    if (s.turn) awards(s);
    log(s, `${name} ${verb('builds', 'build')} a road.`, p, 'build');
  } else if (a.type === 'city') { pay(s, p, COST.city); s.levels[a.node] = 2; log(s, `${name} ${verb('upgrades', 'upgrade')} an outpost to a city.`, p, 'build'); }
  else if (a.type === 'roll') {
    s.dice = [1 + Math.floor(random(s) * 6), 1 + Math.floor(random(s) * 6)]; const value = sum(s.dice); s.rolls[value]++; s.rolled = true;
    log(s, `${name} ${verb('rolls', 'roll')} ${s.dice.join(' + ')} = ${value}.`, p, 'dice');
    if (value === 7) {
      s.discardQueue = s.players.map((_, i) => i).filter(i => sum(s.hands[i]) > 7);
      for (const i of s.discardQueue) s.discardRemaining[i] = Math.floor(sum(s.hands[i]) / 2);
      s.returnPhase = 'build'; s.phase = s.discardQueue.length ? 'discard' : 'robber';
    } else { const gain = production(s, value); s.phase = 'build'; if (sum(gain)) log(s, gain.map((n, i) => n ? `${s.players[i].name} +${n}` : '').filter(Boolean).join(' · ') + ' resources.', null, 'income'); }
  } else if (a.type === 'discard') {
    pay(s, p, RES.map((_, r) => r === a.resource ? 1 : 0), false);
    if (--s.discardRemaining[p] === 0) { s.discardQueue.shift(); log(s, `${name} ${verb('resolves', 'resolve')} their discard.`, p); if (!s.discardQueue.length) s.phase = 'robber'; }
  } else if (a.type === 'robber') {
    s.robber = a.tile;
    if (a.victim >= 0) {
      const cards = s.hands[a.victim].flatMap((n, r) => Array(n).fill(r));
      if (cards.length) { const r = cards[Math.floor(random(s) * cards.length)]; s.hands[a.victim][r]--; s.hands[p][r]++; }
    }
    log(s, `${name} ${verb('moves', 'move')} the raider${a.victim >= 0 ? ` and takes one hidden resource from ${s.players[a.victim].name}` : ''}.`, p, 'raider');
    s.phase = s.returnPhase;
  } else if (a.type === 'bank') {
    pay(s, p, RES.map((_, r) => r === a.give ? bankRate(s, p, r) : 0)); give(s, p, a.get);
    log(s, `${name} ${verb('trades', 'trade')} ${bankRate(s, p, a.give)} ${RES[a.give]} for 1 ${RES[a.get]} at the harbor.`, p, 'trade');
  } else if (a.type === 'develop') {
    pay(s, p, COST.develop); const type = s.deck.pop(); s.dev[p].push({ type, bought: s.turn }); log(s, `${name} ${verb('draws', 'draw')} a hidden development card.`, p, 'card');
  } else if (['knight', 'roads', 'monopoly', 'plenty'].includes(a.type)) {
    const index = s.dev[p].findIndex(c => c.type === a.type && c.bought < s.turn); s.dev[p].splice(index, 1); s.playedDev = true; s.playedCards[a.type]++;
    if (a.type === 'knight') { s.knights[p]++; awards(s); s.returnPhase = s.phase; s.phase = 'robber'; }
    if (a.type === 'roads') { s.returnPhase = s.phase; s.phase = 'free-road'; s.freeRoads = 2; }
    if (a.type === 'plenty') for (const r of a.resources) give(s, p, r);
    if (a.type === 'monopoly') for (let i = 0; i < 4; i++) if (i !== p) { s.hands[p][a.resource] += s.hands[i][a.resource]; s.hands[i][a.resource] = 0; }
    log(s, `${name} ${verb('plays', 'play')} ${a.type === 'knight' ? 'a knight' : a.type === 'roads' ? 'two roads' : a.type === 'plenty' ? 'a harvest' : `a monopoly on ${RES[a.resource]}`}.`, p, 'card');
  } else if (a.type === 'skip-road') { s.freeRoads = 0; s.phase = s.returnPhase; }
  else if (a.type === 'end') { checkWin(s); if (s.winner === null) { s.current = (s.current + 1) % 4; s.turn++; s.phase = 'roll'; s.playedDev = false; s.rolled = false; } }
  if (s.turn && s.winner === null) checkWin(s);
  return s;
}
export function applyTrade(s, a) {
  const p = s.current, other = a.other;
  if (s.phase !== 'build' || !Number.isInteger(other) || other < 0 || other > 3 || other === p || !Array.isArray(a.give) || !Array.isArray(a.get) || a.give.length !== 5 || a.get.length !== 5 || [...a.give, ...a.get].some(n => !Number.isInteger(n) || n < 0 || n > 19) || !sum(a.give) || !sum(a.get) || !canPay(s.hands[p], a.give) || !canPay(s.hands[other], a.get) || a.give.some((n, r) => n && a.get[r])) throw new Error('This trade is not available.');
  for (let r = 0; r < 5; r++) { s.hands[p][r] += a.get[r] - a.give[r]; s.hands[other][r] += a.give[r] - a.get[r]; s.knowledge[p][r] = Math.max(0.1, s.knowledge[p][r] + a.get[r] - a.give[r]); s.knowledge[other][r] = Math.max(0.1, s.knowledge[other][r] + a.give[r] - a.get[r]); }
  const summary = bundle => bundle.map((n, r) => n ? `${n} ${RES[r]}` : '').filter(Boolean).join(', ');
  log(s, `${s.players[p].name} ${s.players[p].human ? 'give' : 'gives'} ${summary(a.give)} to ${s.players[other].name} for ${summary(a.get)}.`, p, 'trade');
  if (!s.simulation) s.trades = [...s.trades, { turn: s.turn, player: p, ...a }];
}
export function observe(s, p) {
  // Whitelist public fields: future private fields cannot accidentally reach a bot.
  return {
    version: s.version, viewer: p, board: s.board, players: s.players, difficulty: s.difficulty,
    nodeOwner: s.nodeOwner.slice(), levels: s.levels.slice(), edgeOwner: s.edgeOwner.slice(),
    hands: s.hands.map((hand, i) => i === p ? hand.slice() : null),
    dev: s.dev.map((cards, i) => i === p ? cards.map(c => ({ ...c })) : null),
    handCounts: s.hands.map(sum), devCounts: s.dev.map(a => a.length), deck: null, deckCount: s.deck.length,
    bank: s.bank.slice(), playedCards: { ...s.playedCards }, knights: s.knights.slice(),
    roadsLength: s.roadsLength.slice(), longest: s.longest, army: s.army,
    phase: s.phase, current: s.current, setupIndex: s.setupIndex, setupNode: s.setupNode,
    turn: s.turn, rolled: s.rolled, dice: s.dice.slice(), robber: s.robber, playedDev: s.playedDev,
    freeRoads: s.freeRoads, returnPhase: s.returnPhase, discardQueue: s.discardQueue.slice(), discardRemaining: s.discardRemaining.slice(),
    winner: s.winner, actions: s.actions, rolls: s.rolls.slice(), knowledge: s.knowledge.map(a => a.slice()),
    offerHistory: (s.offerHistory ?? []).map(o => ({ ...o, give: o.give.slice(), get: o.get.slice() })),
    events: [], trades: [], decisions: [null, null, null, null],
  };
}

export function validateState(s) {
  if (s.version !== 1 || s.board.tiles.length !== 19 || s.board.nodes.length !== 54 || s.board.edges.length !== 72 || s.players.length !== 4) throw new Error('Unsupported island save.');
  for (let r = 0; r < 5; r++) if (s.bank[r] < 0 || s.hands.some(a => a[r] < 0) || s.bank[r] + s.hands.reduce((n, a) => n + a[r], 0) !== 19) throw new Error(`Resource conservation failed: ${RES[r]}`);
  if (s.nodeOwner.length !== 54 || s.edgeOwner.length !== 72 || s.hands.some(h => h.length !== 5)) throw new Error('Invalid board shape.');
  return true;
}
