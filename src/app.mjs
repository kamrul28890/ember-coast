import { RES, COST, PIPS, createGame, actor, sum, legalActions, applyAction, publicPoints, points, observe, validateState, seedHash, bankRate, log, canPay } from './engine.mjs';
import { opening, decide, quickAction, sampleHidden, noteOffer, POLICY } from './ai.mjs';
import { boardSVG, resourceIcon, buildIcon, avatar, die, escape, RESOURCE_COLORS } from './art.mjs';
const $ = id => document.getElementById(id), modal = $('modal'), storageKey = 'ember-coast-save-v1';
let game, selected = null, tab = 'activity', busy = false, generation = 0, botLoopRunning = false, negotiation = null, shownWinner = false, toastTimer, highlights = [], speed = 260;
let attemptedTrades = new Set();
try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved) { validateState(saved); game = saved; } } catch { /* corrupt local save never prevents a new game */ }
if (!game) game = opening(createGame('saffron-bay'));
const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }), requests = new Map(); let requestID = 0;
worker.onmessage = ({ data }) => { const pending = requests.get(data.id); if (!pending) return; clearTimeout(pending.timeout); requests.delete(data.id); data.error ? pending.reject(new Error(data.error)) : pending.resolve(data.result); };
worker.onerror = event => { for (const pending of requests.values()) { clearTimeout(pending.timeout); pending.reject(new Error(event.message || 'The planning worker is unavailable.')); } requests.clear(); };
function rpc(operation, view, extra = {}) { return new Promise((resolve, reject) => { const id = ++requestID, timeout = setTimeout(() => { requests.delete(id); reject(new Error('Planning timed out; using the legal heuristic fallback.')); }, 30000); requests.set(id, { resolve, reject, timeout }); worker.postMessage({ id, operation, view, ...extra }); }); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4000); }
function save() { try { localStorage.setItem(storageKey, JSON.stringify(game)); } catch { toast('Local storage is full or unavailable. Export your match to keep it.'); } }
function commit(action, decision = null) {
  const player = actor(game), phase = game.phase;
  try {
    applyAction(game, action);
    if (decision && !['end', 'roll'].includes(action.type)) game.decisions[player] = { goal: decision.goal, reason: decision.reason, simulations: decision.simulations, elapsedMs: decision.elapsedMs, action: decision.action, turn: game.turn, model: decision.model };
    game.timeline ??= []; game.timeline.push({ player, turn: game.turn, phase, action: structuredClone(action), ...(action.type === 'roll' ? { dice: game.dice.slice() } : {}) });
    validateState(game); selected = null; highlights = []; save(); render();
    if (game.winner !== null && !shownWinner) { shownWinner = true; setTimeout(showVictory, 450); }
    return true;
  } catch (error) { toast(error.message); return false; }
}
const humanActive = () => game.players[actor(game)]?.human && game.winner === null;
function phaseMode() { if (game.phase === 'setup-settlement') return 'settlement'; if (['setup-road', 'free-road'].includes(game.phase)) return 'road'; return selected; }
function render() {
  const p = actor(game), active = game.players[p], human = humanActive(), cards = sum(game.hands[0]);
  $('round-label').textContent = `ROUND ${Math.max(1, Math.ceil(game.turn / 4))}`;
  $('seed-label').textContent = `ISLAND ${String(game.seed).toUpperCase().slice(0, 24)}`;
  $('players').innerHTML = game.players.map(player => {
    const score = game.winner !== null || player.id === 0 && player.human ? points(game, player.id) : publicPoints(game, player.id);
    return `<div class="player ${p === player.id && game.winner === null ? 'current' : ''}" style="--player-color:${player.color}" aria-label="${escape(player.name)}, ${score} points"><div class="avatar">${avatar(player)}</div><div><div class="player-name">${escape(player.name)}${player.human ? '<span>YOU</span>' : ''}</div><div class="player-role">${escape(player.title)}</div><div class="player-info"><span title="Resource cards">▤ ${sum(game.hands[player.id])}</span><span title="Development cards">✧ ${game.dev[player.id].length}</span>${game.longest === player.id ? '<span title="Longest road">⌁ +2</span>' : ''}${game.army === player.id ? '<span title="Largest army">⚑ +2</span>' : ''}</div></div><div class="player-points">${score}<small>POINTS</small></div></div>`;
  }).join('');
  $('board').innerHTML = boardSVG(game, human ? phaseMode() : null, highlights);
  $('dice').innerHTML = game.dice.every(Boolean) ? game.dice.map(die).join('') : '<span>·</span><span>·</span>';
  $('hand-summary').textContent = `${cards} cards · ${game.dev[0].length} developments`;
  $('hand').innerHTML = RES.map((name, r) => `<div class="resource-card ${human && game.phase === 'discard' && game.hands[0][r] ? 'discardable' : ''}" style="--resource-color:${RESOURCE_COLORS[r]}" ${human && game.phase === 'discard' ? `data-discard="${r}" role="button" tabindex="0" aria-label="Discard one ${name}"` : ''}>${resourceIcon(r, 'resource-icon')}<span class="resource-count">${game.players[0].human ? game.hands[0][r] : '—'}</span><span class="resource-name">${name}</span><small class="bank-count" title="Public resource supply">bank ${game.bank[r]}</small></div>`).join('');
  const names = { knight: 'Knight', point: 'Quiet victory · +1', roads: 'Two roads', plenty: 'Harvest', monopoly: 'Monopoly' };
  $('dev-hand').innerHTML = game.players[0].human ? game.dev[0].map((card, index) => `<button class="dev-card" data-dev="${index}" ${!human || game.playedDev || card.bought >= game.turn || card.type === 'point' || !['roll', 'build'].includes(game.phase) ? 'disabled' : ''}>✧ ${names[card.type]}${card.type !== 'point' && card.bought >= game.turn ? '<small>next turn</small>' : ''}</button>`).join('') : '';
  const actions = human ? legalActions(game) : [];
  $('build-actions').innerHTML = ['road', 'settlement', 'city', 'develop'].map(type => `<button class="build-card ${selected === type ? 'selected' : ''}" data-build="${type}" ${!actions.some(a => a.type === type) || game.phase !== 'build' ? 'disabled' : ''} title="${COST[type].map((n, r) => n ? `${n} ${RES[r]}` : '').filter(Boolean).join(', ')}"><span class="build-title">${buildIcon(type)}${{ road: 'Road', settlement: 'Outpost', city: 'City', develop: 'Develop' }[type]}</span><span class="cost-icons">${COST[type].flatMap((n, r) => Array.from({ length: n }, () => `<span class="cost-icon">${resourceIcon(r)}</span>`)).join('')}</span></button>`).join('');
  $('trade-button').disabled = !human || game.phase !== 'build';
  $('advisor-button').disabled = !human || busy;
  $('turn-label').textContent = game.winner !== null ? 'ISLAND COMPLETE' : human ? 'YOUR TURN' : `${active?.name.toUpperCase() ?? 'RIVALS'}'S TURN`;
  $('turn-title').classList.toggle('thinking', busy && !human);
  const stage = game.phase, primary = $('primary-action'), secondary = $('secondary-action');
  primary.disabled = !human && game.winner === null;
  secondary.hidden = !selected || !human;
  const instructions = {
    roll: ['A little possibility.', 'Roll for production, then trade and build your next advantage.', 'Roll the dice', 'ROLL & GATHER'],
    build: ['Find your next move.', selected ? `Choose a highlighted ${selected === 'road' ? 'edge for your road' : 'intersection for your ' + (selected === 'city' ? 'city' : 'outpost')} on the island.` : 'Build something lasting, strike a good trade, or keep your resources for next turn.', 'Finish turn', 'TRADE & BUILD'],
    robber: ['Change the tide.', 'Choose a terrain tile for the raider. Its production stops until the raider moves.', 'Choose for me', 'MOVE THE RAIDER'],
    discard: ['Travel a little lighter.', `Click resources to discard ${game.discardRemaining[p] ?? 0} more cards. Everyone with more than seven must give up half.`, 'Discard for me', 'DISCARD'],
    'setup-settlement': ['Choose your foothold.', 'Place an outpost at a highlighted intersection. Mix productive dice numbers and resources.', 'Suggest & place', 'OPENING PLACEMENT'],
    'setup-road': ['Make a connection.', 'Choose a highlighted edge beside your new outpost.', 'Suggest & place', 'OPENING ROAD'],
    'free-road': ['A path forward.', `Place up to ${game.freeRoads} free roads, or skip what you do not need.`, 'Skip remaining roads', 'FREE ROADS'],
    finished: ['A story well played.', 'The island has a winner. Explore the journal or start a new adventure.', 'Another island', '10 POINTS TO WIN'],
  }[stage];
  $('phase-pill').textContent = instructions?.[3] ?? 'ON THE ISLAND';
  $('turn-title').textContent = human || game.winner !== null ? instructions?.[0] ?? 'On the island.' : `${active.name} is planning`;
  $('turn-description').textContent = human || game.winner !== null ? instructions?.[1] ?? '' : `${active.title}. Weighing production, expansion routes, and the players around the table.`;
  primary.innerHTML = `${human || game.winner !== null ? instructions?.[2] ?? 'Continue' : busy ? 'Thinking through the possibilities' : 'Rivals are playing'} <span>${busy && !human ? '✧' : '↗'}</span>`;
  $('board-tip').innerHTML = `<i></i> ${escape(human ? selected ? 'Your possibilities are highlighted on the map.' : stage === 'roll' ? 'Your turn. Let the island decide.' : stage === 'discard' ? 'Click your hand to discard resources.' : stage === 'robber' ? 'Where should the raider go next?' : 'Make a move. Make it yours.' : game.winner !== null ? `${game.players[game.winner].name} wins the island.` : `${active?.name ?? 'A rival'} is considering the next move.`)}`;
  renderJournal();
}
function renderJournal() {
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  if (tab === 'activity') $('journal').innerHTML = game.events.slice().reverse().map(e => `<div class="journal-event" style="--event-color:${e.player !== null ? game.players[e.player].color : '#a7b49c'}">${escape(e.text)}<small>${e.turn ? `ROUND ${Math.ceil(e.turn / 4)}` : 'OPENING PLACEMENTS'}</small></div>`).join('');
  if (tab === 'minds') $('journal').innerHTML = game.players.filter(p => !p.human).map(p => { const d = game.decisions[p.id]; return `<div class="thought"><div class="thought-name"><span style="color:${p.color}">${escape(p.name)}</span><span class="thought-tag">${escape(p.style.toUpperCase())}</span></div><p><strong>${escape(d?.goal ?? 'Build a resilient opening')}</strong><br>${escape(d?.reason ?? 'Looks for resource balance, good dice odds, and an expansion route.')}</p><small>${d?.simulations ? `${d.simulations} simulated futures · ${d.elapsedMs} ms` : 'Strategic heuristic · fair information'}</small></div>`; }).join('') + '<p class="journal-caption">Plans are disclosed in this learning mode. Private hands and development cards stay hidden.</p>';
  if (tab === 'stats') {
    const max = Math.max(1, ...game.rolls), total = sum(game.rolls);
    $('journal').innerHTML = `<div class="stat-chart">${Array.from({ length: 11 }, (_, i) => i + 2).map(n => `<div class="stat-bar"><span>${game.rolls[n]}</span><i style="height:${game.rolls[n] / max * 93}px;${n === 7 ? 'background:#c49a76' : ''}"></i><span>${n}</span></div>`).join('')}</div><p class="journal-caption">${total} rolls this match. Two independent six-sided dice; no adjustments for any player. Small samples naturally vary.</p>`;
  }
}
async function bots() {
  if (botLoopRunning || humanActive() || game.winner !== null || negotiation) return;
  botLoopRunning = true; const epoch = generation;
  try {
    while (epoch === generation && !humanActive() && game.winner === null && !negotiation) {
      const p = actor(game); busy = true; render(); await wait(speed);
      if (epoch !== generation) break;
      if (game.phase === 'build' && !attemptedTrades.has(`${game.turn}:${p}`)) {
        attemptedTrades.add(`${game.turn}:${p}`);
        const offer = await rpc('propose', observe(game, p));
        if (epoch !== generation) break;
        if (offer) {
          if (game.players[offer.other].human) { negotiation = offer; busy = false; showIncomingTrade(); render(); break; }
          const reply = await rpc('assess', observe(game, offer.other), { offer });
          if (epoch !== generation) break;
          noteOffer(game, offer, reply.accept);
          if (reply.accept) commit({ type: 'trade', other: offer.other, give: offer.give, get: offer.get });
        }
      }
      let decision;
      try { decision = await rpc('decide', observe(game, p), { options: { strength: game.difficulty } }); }
      catch (error) { toast(error.message); decision = decide(observe(game, p), { strength: 'casual' }); decision.reason += ' Worker fallback used.'; }
      if (epoch !== generation) break;
      if (!commit(decision.action, decision)) break;
    }
  } catch (error) { toast(`The table paused: ${error.message}`); }
  finally { busy = false; botLoopRunning = false; render(); if (epoch !== generation) setTimeout(bots, 0); }
}
function move(action) { if (!humanActive() || busy) return; if (commit(action)) bots(); }
$('primary-action').onclick = () => {
  if (game.winner !== null) return showNewGame();
  if (!humanActive()) return;
  if (game.phase === 'roll') move({ type: 'roll' });
  else if (game.phase === 'build') move({ type: 'end' });
  else if (game.phase === 'free-road') move({ type: 'skip-road' });
  else { const result = decide(observe(game, 0), { strength: 'casual' }); move(result.action); }
};
$('secondary-action').onclick = () => { selected = null; highlights = []; render(); };
$('build-actions').onclick = event => { const button = event.target.closest('[data-build]'); if (!button || button.disabled) return; const type = button.dataset.build; if (type === 'develop') move({ type: 'develop' }); else { selected = selected === type ? null : type; render(); } };
function boardClick(event) {
  if (!humanActive() || busy) return;
  const node = event.target.closest('[data-node]'), edge = event.target.closest('[data-edge]'), raider = event.target.closest('[data-robber]');
  if (node) return move({ type: phaseMode(), node: Number(node.dataset.node) });
  if (edge) return move({ type: 'road', edge: Number(edge.dataset.edge) });
  if (raider) {
    const actions = legalActions(game).filter(a => a.type === 'robber' && a.tile === Number(raider.dataset.robber));
    if (actions.length === 1) return move(actions[0]);
    return showVictims(actions);
  }
  const tile = event.target.closest('[data-tile]');
  if (tile) { const t = game.board.tiles[Number(tile.dataset.tile)]; toast(t.resource < 0 ? 'Dunes produce no resources. The raider begins here.' : `${RES[t.resource]} · ${t.number} · ${(PIPS[t.number] / 36 * 100).toFixed(1)}% chance each roll${t.id === game.robber ? ' · blocked by the raider' : ''}`); }
}
$('board').onclick = boardClick;
$('board').onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); boardClick(event); } };
$('hand').onclick = event => { const card = event.target.closest('[data-discard]'); if (card && game.phase === 'discard') move({ type: 'discard', resource: Number(card.dataset.discard) }); };
$('hand').onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.target.click(); } };
$('dev-hand').onclick = event => {
  const button = event.target.closest('[data-dev]'); if (!button || button.disabled) return;
  const type = game.dev[0][Number(button.dataset.dev)].type;
  if (['knight', 'roads'].includes(type)) move({ type });
  else showCardChoice(type);
};
$('advisor-button').onclick = async () => {
  if (!humanActive() || busy) return; busy = true; const epoch = generation; render();
  try {
    const result = await rpc('decide', observe(game, 0), { options: { strength: game.difficulty } });
    if (epoch !== generation) return;
    highlights = result.alternatives.map(v => v.action);
    if (['settlement', 'city', 'road'].includes(result.action.type)) selected = result.action.type;
    toast(`${result.goal}. ${result.reason}`);
    showModal('A second pair of eyes', `<div class="modal-text"><p><strong>${escape(result.goal)}</strong></p><p>${escape(result.reason)}</p><p>Suggested move: <strong>${escape(actionLabel(result.action))}</strong></p><p>${result.simulations ? `${result.simulations} sampled futures compared. ` : ''}This is a recommendation, not a promise. The advisor sees only your own cards and public information.</p></div><div class="modal-actions"><button class="outline-button" data-close>I'll decide</button><button class="primary-button" id="apply-advice">Play this move ↗</button></div>`);
    $('apply-advice').onclick = () => { modal.close(); busy = false; move(result.action); };
  } catch (error) { toast(error.message); } finally { busy = false; render(); }
};
function actionLabel(a) { return { end: 'finish turn', roll: 'roll the dice', settlement: 'establish an outpost', road: 'build a road', city: 'upgrade to a city', develop: 'draw a development card', bank: `trade ${RES[a.give]} for ${RES[a.get]}`, robber: 'move the raider', discard: `discard ${RES[a.resource]}`, knight: 'play a knight', roads: 'play two roads', monopoly: `monopolize ${RES[a.resource]}`, plenty: 'play a harvest', 'skip-road': 'skip the free roads' }[a.type] ?? a.type; }
function showModal(title, html) { $('modal-content').innerHTML = `<div class="modal-header"><h2>${escape(title)}</h2><button class="modal-close" data-close aria-label="Close dialog">×</button></div>${html}`; if (!modal.open) modal.showModal(); }
$('modal-content').onclick = event => { if (event.target.closest('[data-close]')) { if (negotiation) respondToBot(false); else modal.close(); } };
modal.addEventListener('cancel', event => { if (negotiation) { event.preventDefault(); respondToBot(false); } });
function showVictims(actions) {
  showModal('Choose your rival', `<div class="modal-text">Take one random, hidden resource from a rival beside this tile.</div>${actions.map((a, index) => `<button class="victim-button" data-victim="${index}"><span class="avatar" style="--player-color:${game.players[a.victim].color}">${avatar(game.players[a.victim])}</span>${escape(game.players[a.victim].name)}<span style="margin-left:auto">${sum(game.hands[a.victim])} cards</span></button>`).join('')}`);
  document.querySelectorAll('[data-victim]').forEach(b => b.onclick = () => { modal.close(); move(actions[Number(b.dataset.victim)]); });
}
function showCardChoice(type) {
  showModal(type === 'monopoly' ? 'Choose a resource' : 'A generous harvest', `<p class="modal-text">${type === 'monopoly' ? 'Collect this resource from every rival. Their exact holdings are hidden.' : 'Choose two resources from the supply. The same resource can be chosen twice.'}</p><label class="form-label">RESOURCE</label><select id="card-one" class="form-input">${RES.map((r, i) => `<option value="${i}">${r}</option>`).join('')}</select>${type === 'plenty' ? `<label class="form-label">SECOND RESOURCE</label><select id="card-two" class="form-input">${RES.map((r, i) => `<option value="${i}">${r}</option>`).join('')}</select>` : ''}<div class="modal-actions"><button class="primary-button" id="play-card">Play card ↗</button></div>`);
  $('play-card').onclick = () => { const a = type === 'monopoly' ? { type, resource: Number($('card-one').value) } : { type, resources: [Number($('card-one').value), Number($('card-two').value)].sort((a, b) => a - b) }; if (!legalActions(game).some(v => JSON.stringify(v) === JSON.stringify(a))) return toast('The supply cannot provide that choice.'); modal.close(); move(a); };
}
function bundleText(bundle) { return bundle.map((n, r) => n ? `${n} ${RES[r]}` : '').filter(Boolean).join(' + ') || 'nothing'; }
function showTrade(other = 1) {
  if (!humanActive() || game.phase !== 'build') return;
  const bank = legalActions(game).filter(a => a.type === 'bank');
  showModal('A good deal goes both ways.', `<p class="modal-text">Make an offer to a rival, or trade at the bank using your harbor rate.</p><label class="form-label">TRADE WITH</label><select id="trade-other" class="form-input">${game.players.slice(1).map(p => `<option value="${p.id}" ${other === p.id ? 'selected' : ''}>${escape(p.name)} · ${escape(p.title)}</option>`).join('')}</select><div class="trade-columns"><div><h3>YOU GIVE</h3>${RES.map((r, i) => `<label class="trade-resource">${resourceIcon(i)}<span>${r}</span><input type="number" id="give-${i}" min="0" max="${game.hands[0][i]}" value="0" aria-label="Give ${r}"></label>`).join('')}</div><div><h3>YOU RECEIVE</h3>${RES.map((r, i) => `<label class="trade-resource">${resourceIcon(i)}<span>${r}</span><input type="number" id="get-${i}" min="0" max="3" value="0" aria-label="Request ${r}"></label>`).join('')}</div></div><div id="trade-response"></div><div class="modal-actions"><button class="primary-button" id="offer-trade">Make an offer ⇄</button></div><details style="margin-top:20px"><summary class="form-label" style="cursor:pointer">BANK & HARBOR TRADES (${bank.length} available)</summary><div style="max-height:170px;overflow:auto">${bank.length ? bank.map((a, i) => `<button class="victim-button" data-bank="${i}">${resourceIcon(a.give)}${bankRate(game, 0, a.give)} ${RES[a.give]} <span>→</span> ${resourceIcon(a.get)}1 ${RES[a.get]}</button>`).join('') : '<p class="modal-text">Collect four of one resource, or use a 3:1 / 2:1 coastal harbor.</p>'}</div></details>`);
  document.querySelectorAll('[data-bank]').forEach(button => button.onclick = () => { modal.close(); move(bank[Number(button.dataset.bank)]); });
  $('offer-trade').onclick = async () => {
    const give = RES.map((_, i) => Number($(`give-${i}`).value)), get = RES.map((_, i) => Number($(`get-${i}`).value)), other = Number($('trade-other').value);
    if ([...give, ...get].some(n => !Number.isInteger(n) || n < 0 || n > 19) || !sum(give) || !sum(get) || give.some((n, r) => n && get[r]) || !canPay(game.hands[0], give)) return toast('Offer resources you own, request a different resource, and give both sides a nonempty bundle.');
    const button = $('offer-trade'), epoch = generation; button.disabled = true; button.textContent = `${game.players[other].name} is considering…`;
    try {
      const reply = await rpc('assess', observe(game, other), { offer: { from: 0, other, give, get } });
      if (epoch !== generation || !$('trade-response')) return;
      noteOffer(game, { from: 0, other, give, get }, reply.accept);
      if (reply.accept) { commit({ type: 'trade', other, give, get }); $('trade-response').innerHTML = `<div class="trade-reply"><strong>${escape(game.players[other].name)}:</strong> ${escape(reply.reason)}</div>`; button.textContent = 'Trade completed'; }
      else {
        const counter = reply.counter;
        $('trade-response').innerHTML = `<div class="trade-reply"><strong>${escape(game.players[other].name)}:</strong> ${escape(reply.reason)}${counter ? `<p>Counteroffer: you give <strong>${bundleText(counter.give)}</strong> for <strong>${bundleText(counter.get)}</strong>.</p><button id="accept-counter" class="outline-button" ${!canPay(game.hands[0], counter.give) ? 'disabled' : ''}>Accept counteroffer</button>` : ''}</div>`;
        button.disabled = false; button.textContent = 'Revise your offer';
        if (counter) $('accept-counter').onclick = () => { modal.close(); move({ type: 'trade', other, give: counter.give, get: counter.get }); };
      }
      save();
    } catch (error) { toast(error.message); button.disabled = false; button.textContent = 'Try again'; }
  };
}
$('trade-button').onclick = () => showTrade();
function showIncomingTrade() {
  const o = negotiation, player = game.players[o.from];
  showModal(`${player.name} has an offer.`, `<div class="modal-text"><p><strong>They give you</strong><br>${bundleText(o.give)}</p><p><strong>They ask for</strong><br>${bundleText(o.get)}</p><p>Does this advance your plan? Consider how much it helps your rival, too.</p></div><div class="modal-actions"><button class="outline-button" id="decline-bot">Not this time</button><button class="primary-button" id="accept-bot" ${!canPay(game.hands[0], o.get) ? 'disabled' : ''}>Accept the deal ⇄</button></div><p class="modal-text" style="font-size:10px">${!canPay(game.hands[0], o.get) ? 'You do not hold the requested resources. The bot does not know your exact hand.' : 'Both bundles exchange immediately. No resources are gifted.'}</p>`);
  $('decline-bot').onclick = () => respondToBot(false); $('accept-bot').onclick = () => respondToBot(true);
}
function respondToBot(accept) {
  const offer = negotiation; if (!offer) return; negotiation = null; modal.close();
  noteOffer(game, offer, accept);
  if (accept) commit({ type: 'trade', other: 0, give: offer.give, get: offer.get });
  else { log(game, `You decline ${game.players[offer.from].name}'s offer.`, 0, 'trade'); save(); render(); }
  bots();
}
function showNewGame() {
  showModal('Every island, a new story.', `<p class="modal-text">One keeper, three thoughtful rivals. First to ten points wins. Start from an intelligent shared opening, or place your own outposts.</p><label class="form-label" for="island-seed">ISLAND SEED</label><input id="island-seed" class="form-input" value="${escape('coast-' + Math.floor(Math.random() * 100000))}" maxlength="40"><label class="form-label" for="difficulty">RIVAL PLANNING</label><select id="difficulty" class="form-input"><option value="expert" ${game.difficulty === 'expert' ? 'selected' : ''}>Deep thinker · sampled-future search</option><option value="balanced" ${game.difficulty === 'balanced' ? 'selected' : ''}>Clever · lighter search</option><option value="casual">Casual · strategic heuristics</option></select><label class="setting-option"><input id="guided-opening" type="checkbox"> Let me place my opening outposts</label><label class="setting-option"><input id="spectator" type="checkbox"> Watch a four-bot demonstration</label><div class="modal-actions"><button class="primary-button" id="start-island">Set sail ↗</button></div><p class="modal-text" style="font-size:10px">This replaces the current local save. You can export it first from the table footer.</p>`);
  $('start-island').onclick = () => {
    generation++; negotiation = null; busy = false; selected = null; highlights = []; attemptedTrades = new Set(); shownWinner = false;
    const guided = $('guided-opening').checked, human = !$('spectator').checked;
    game = createGame($('island-seed').value.trim() || 'a-new-coast', { difficulty: $('difficulty').value, human });
    if (!guided) opening(game);
    speed = human ? 260 : 55; modal.close(); save(); render(); bots();
  };
}
$('new-button').onclick = showNewGame;
function showVictory() {
  if (game.winner === null) return;
  const winner = game.players[game.winner];
  showModal(`${winner.name === 'You' ? 'Your' : winner.name + '’s'} island, well earned.`, `<div class="modal-text"><p><strong>${escape(winner.name)} wins with ${points(game, winner.id)} points.</strong></p><p>${Math.ceil(game.turn / 4)} rounds · ${sum(game.rolls)} dice rolls · ${game.trades.length} player trades.</p><p>Building, bargaining, and a little good fortune. Look through the journal and bot plans to see how the match unfolded.</p></div><div class="modal-actions"><button class="outline-button" data-close>Explore the table</button><button class="primary-button" id="play-again">A new adventure ↗</button></div>`);
  $('play-again').onclick = showNewGame;
}
function showRules() {
  showModal('A small island. Ten big points.', `<div class="modal-text"><p>Gather resources, grow your network, and trade your way to <strong>10 points on your turn</strong>. Ember Coast is an independent island-settlement game with familiar economic mechanics and original art.</p><div class="rule-grid"><div class="rule-card"><strong>1 · Roll & gather</strong>Tiles matching the two dice produce one resource per adjacent outpost; cities collect two. The raider blocks its tile.</div><div class="rule-card"><strong>2 · Trade & build</strong>Trade with rivals or the bank. Coastal ports improve the usual 4:1 rate to 3:1 or 2:1.</div><div class="rule-card"><strong>3 · Grow thoughtfully</strong>Roads must connect. Outposts need an empty neighboring intersection on every side. Upgrade an outpost into a city.</div><div class="rule-card"><strong>4 · Reach ten</strong>Outposts: 1 point. Cities: 2. Longest road (5+) and largest army (3+ knights): 2 each. Quiet-victory cards add 1.</div></div><h3>When seven arrives</h3><p>Everyone holding more than seven resources discards half, rounded down. The roller moves the raider and may take one random resource from an adjacent rival. Discards and stolen card identities stay hidden from opponents.</p><h3>Development cards</h3><p>Buy for wool, grain, and ore. Play at most one per turn, never on the turn you buy it. Knights move the raider; two roads gives free connections; harvest grants two resources; monopoly collects one resource type from rivals. Victory cards count automatically.</p><h3>A fair supply</h3><p>There are 19 cards of each resource. Supply counts are public and shown below your resource cards. If a resource cannot cover an entire production payout, none of that resource is produced. Roads, outposts, and cities have piece limits of 15, 5, and 4. Ties retain an existing road/army award; without an incumbent, nobody receives it.</p><h3>Read the map</h3><p>More dots mean more likely dice numbers. Six and eight are especially productive. Green markers show legal building choices. Click a terrain to see its odds.</p></div>`);
}
$('how-button').onclick = showRules; $('legend-button').onclick = showRules;
$('ai-button').onclick = () => showModal('Thoughtful, not all-knowing.', `<div class="modal-text"><p>Each rival combines a strategic goal, resource scarcity estimates, connected-route planning, and trade valuation. Rivals remember declined offers and avoid immediately repeating them. Deep thinkers compare sampled futures in a background worker.</p><p><strong>Fair information:</strong> bots receive their own cards, public buildings and card counts. Opponent resources and development cards are sampled as possibilities; the actual hidden hands, future deck, and dice-generator state are removed.</p><p><strong>Different priorities:</strong> Mira favors production and expansion, Theo values flexible trading, and Jun pressures leaders and military bonuses.</p><p><strong>Learning:</strong> this build uses strategic priors and locally generated self-play tuning. No historical human-game dataset has been used. Search strength is not a validated human skill rating.</p><p>Open Bot minds for explanations. Export a local match to contribute authorized replay data to future evaluations.</p><label class="form-label">BOT PLAYBACK SPEED</label><select id="bot-speed" class="form-input"><option value="550">Unhurried</option><option value="260" ${speed === 260 ? 'selected' : ''}>At the table</option><option value="40" ${speed < 100 ? 'selected' : ''}>Fast demonstration</option></select></div>`);
$('ai-button').addEventListener('click', () => { if ($('bot-speed')) $('bot-speed').onchange = () => { speed = Number($('bot-speed').value); }; });
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { tab = button.dataset.tab; renderJournal(); });
$('export-button').onclick = () => {
  showModal('Keep this island’s story.', `<div class="modal-text"><p>Download the full local match, including its seed, state, action history, and bot explanations.</p><p><strong>This export includes hidden hands and the remaining development deck.</strong> It is intended for personal replay/debugging, not for sharing during a competitive match. Nothing is uploaded.</p></div><div class="modal-actions"><button class="primary-button" id="download-save">Download match JSON ↗</button></div>`);
  $('download-save').onclick = () => { const blob = new Blob([JSON.stringify({ format: 'ember-coast-local-save', version: 1, includesHiddenState: true, exportedAt: new Date().toISOString(), policy: POLICY, game }, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `ember-coast-${String(game.seed).replace(/[^a-z0-9-]/gi, '_')}-turn-${game.turn}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); modal.close(); };
};
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.open) { selected = null; highlights = []; render(); } });
render(); save(); bots();
