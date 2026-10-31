import { RES, PIPS, actor, legalActions } from './engine.mjs';
export const RESOURCE_COLORS = ['#6e9275', '#ba8466', '#a8b47e', '#cfb05e', '#939b99'];
export const TILE_COLORS = ['#a9c6ad', '#d1aa8c', '#cad5a6', '#e5ce91', '#bfc4ba', '#e0cba4'];
export const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function symbol(resource) {
  return [
    '<path d="M12 2L4 13h4l-5 7h7v3h4v-3h7l-5-7h4z" fill="currentColor"/>',
    '<path d="M3 9l8-4 10 5-8 4zM3 12l10 5v5L3 17zM15 16l6-3v5l-6 4z" fill="currentColor"/>',
    '<path d="M7 17a5 5 0 01-4-5 4 4 0 014-4 5 5 0 019-1 5 5 0 012 10z" fill="currentColor"/><path d="M8 16v6m8-6v6" stroke="currentColor" stroke-width="2.2"/><path d="M16 9c4-5 8-1 6 4l-4 3" fill="currentColor"/>',
    '<path d="M12 23V3M12 10C3 9 4 3 5 3c5 0 7 4 7 7zm0 6c-9-1-8-7-7-7 5 0 7 4 7 7zm0-6c9-1 8-7 7-7-5 0-7 4-7 7zm0 6c9-1 8-7 7-7-5 0-7 4-7 7z" stroke="currentColor" stroke-width="1.5" fill="currentColor"/>',
    '<path d="M3 20L8 8l5 3 3-7 6 16z" fill="currentColor"/><path d="M9 11l-3 8m10-11l-3 10" stroke="#fff" stroke-opacity=".35" stroke-width="1.3"/>',
  ][resource] ?? '<path d="M3 18l7-9 5 5 4-3 3 7z" fill="currentColor"/>';
}
export function resourceIcon(resource, cls = '') { return `<svg class="${cls}" viewBox="0 0 24 25" aria-hidden="true" style="color:${RESOURCE_COLORS[resource]}">${symbol(resource)}</svg>`; }
export function buildIcon(type) {
  const shapes = { road: '<path d="M2 20L22 4" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M4 16l3 4m4-11l3 4m4-11l3 4" stroke="currentColor" stroke-width="2"/>', settlement: '<path d="M3 11L12 3l9 8v11H3z" fill="currentColor"/><path d="M10 15h5v7h-5" fill="#f4f3e8"/>', city: '<path d="M2 9l6-5 6 5v13H2zm12 3l4-5 4 5v10h-8z" fill="currentColor"/><path d="M7 14h3v3H7m10-2h3v3h-3" fill="#f4f3e8"/>', develop: '<path d="M6 2h13l3 3v17H6z" fill="currentColor"/><path d="M3 5v18h14" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 7l1.4 3 3.2.4-2.3 2.3.5 3.2-2.8-1.5-2.8 1.5.5-3.2-2.3-2.3 3.2-.4z" fill="#f7f4e7"/>' };
  return `<svg class="build-icon" viewBox="0 0 24 26" aria-hidden="true">${shapes[type]}</svg>`;
}
export function avatar(player) {
  const hair = ['#594a37', '#725449', '#8d6841', '#3d4548'][player.id];
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 41c0-15 28-15 28 0" fill="${player.color}"/><ellipse cx="20" cy="19" rx="9" ry="10" fill="#e9c4a1"/><path d="M10 19C7 4 27 2 30 15l-4-2-3-5c-2 5-8 4-10 7l-1 7z" fill="${hair}"/><path d="M17 20h.2m6 0h.2" stroke="#524a3d" stroke-width="1.7" stroke-linecap="round"/><path d="M18 25q3 2 5-1" stroke="#b4886e" stroke-width="1" fill="none"/></svg>`;
}
export function die(value) {
  const positions = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[value] ?? [];
  return `<span class="die" aria-label="Die ${value}">${Array.from({ length: 9 }, (_, i) => `<i style="opacity:${positions.includes(i) ? 1 : 0}"></i>`).join('')}</span>`;
}
const SCALE = 62;
const xy = n => [n.x * SCALE, n.y * SCALE];
const pointString = (s, tile, inset = 1) => tile.nodes.map(n => { const node = s.board.nodes[n]; return `${(tile.x + (node.x - tile.x) * inset) * SCALE},${(tile.y + (node.y - tile.y) * inset) * SCALE}`; }).join(' ');
function terrain(resource, tile) {
  if (resource === 0) return `<g fill="#5b8064" opacity=".7"><path d="M-28-6l9-17 9 17h-5l8 11h-24l8-11z"/><path d="M-9-9L2-31 13-9H8l9 13h-29L-3-9z"/><path d="M18-5l7-14 8 14h-4l6 9H15l6-9z"/></g><path d="M-22 5v4M2 5v4M26 4v3" stroke="#6d8866" stroke-width="2"/>`;
  if (resource === 1) return `<path d="M-39 2l15-21 14 12 13-20 14 17 8-6L41 6" fill="#bd8c6f"/><path d="M-26-11l7 5m21-12l7 8m10 5l6 3M-38 11q22-7 38 0t38 0" stroke="#e0bd9c" stroke-width="1.6" fill="none"/>`;
  if (resource === 2) return `<path d="M-39 4q20-27 37-9T40-2v15h-79z" fill="#b5c18f"/><path d="M-32-6q15-9 29-3m19-9q13 1 19 9" stroke="#e2e8c7" stroke-width="1.5" fill="none"/><g transform="translate(-6,-13) scale(.65)" fill="#f2f0d8"><ellipse cx="0" cy="0" rx="15" ry="9"/><ellipse cx="14" cy="1" rx="5" ry="6" fill="#929e7c"/><path d="M-8 6v6M8 6v6" stroke="#7d8b6d" stroke-width="2"/></g>`;
  if (resource === 3) return `<path d="M-39-7L0-27 39-7 0 14z" fill="#d8bd76"/><path d="M-25-3L8-21m-23 24L18-15M-4 9L29-9" stroke="#ecdcaa" stroke-width="3"/><g transform="translate(-4,-22) scale(.6)" style="color:#b69b55">${symbol(3)}</g>`;
  if (resource === 4) return `<path d="M-42 7l20-32L-8-5 7-33 30 6z" fill="#949f98"/><path d="M-28-14l6-11 6 10-5-2-3 3zM-2-15l9-18 10 17-7-3-4 5z" fill="#e6e9d9"/><path d="M-36 10L-13-7 5 10" fill="#a6afa4"/>`;
  return `<path d="M-38 2q20-20 38-6t37-3v20h-75" fill="#d2b88d"/><path d="M-32 0q18-10 32 0m7 6q14-9 28-5" stroke="#ebd8b4" stroke-width="1.5" fill="none"/><circle cx="25" cy="-23" r="6" fill="#eed4a0"/>`;
}
export function boardSVG(s, mode = null, highlights = [], { roadStart = null, enabled = true } = {}) {
  const legal = enabled && actor(s) === 0 && s.players[0].human ? legalActions(s) : [];
  const nodeActions = legal.filter(a => a.node !== undefined && (a.type === mode || mode === null && s.phase === 'build'));
  const roads = legal.filter(a => a.type === 'road' && (mode === 'road' || mode === null && s.phase === 'build'));
  const edgeActions = roads.filter(a => roadStart !== null && s.board.edges[a.edge].nodes.includes(roadStart));
  const starts = s.board.nodes.filter(n => roads.some(a => n.edges.includes(a.edge)) && (s.phase === 'setup-road' ? n.id === s.setupNode : s.nodeOwner[n.id] === actor(s) || s.nodeOwner[n.id] < 0 && n.edges.some(e => s.edgeOwner[e] === actor(s))));
  const tileActions = s.phase === 'robber' ? legal : [];
  let svg = `<defs><filter id="tileShadow" x="-20%" y="-20%" width="140%" height="145%"><feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#a6b59b" flood-opacity=".18"/></filter><filter id="pieceShadow"><feDropShadow dx="0" dy="2" stdDeviation="1.4" flood-color="#45533e" flood-opacity=".25"/></filter><pattern id="waterDots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".45" fill="#b7c7af" opacity=".4"/></pattern></defs><ellipse cx="0" cy="0" rx="312" ry="277" fill="url(#waterDots)"/>`;
  svg += `<g fill="none" stroke="#c9d5c2" stroke-width=".65" opacity=".5"><path d="M-285-80q15-6 30 0t30 0M220 95q15-6 30 0t30 0M-252 153q15-6 30 0t30 0M190-183q15-6 30 0t30 0"/></g>`;
  for (const port of s.board.ports) {
    const e = s.board.edges[port.edge], [a, b] = e.nodes.map(n => s.board.nodes[n]), x = (a.x + b.x) / 2 * SCALE, y = (a.y + b.y) / 2 * SCALE, d = Math.hypot(x, y), px = x + x / d * 27, py = y + y / d * 27;
    svg += `<g><path class="port-line" d="M${a.x * SCALE} ${a.y * SCALE}L${px} ${py}L${b.x * SCALE} ${b.y * SCALE}"/><circle cx="${px}" cy="${py}" r="12" fill="#eef1e6" stroke="#d6dfca" stroke-width=".8"/>${port.type >= 0 ? `<g transform="translate(${px - 5},${py - 8}) scale(.42)" style="color:${RESOURCE_COLORS[port.type]}">${symbol(port.type)}</g>` : `<path d="M${px - 5} ${py - 4}h10m-7-3l-3 3 3 3m4 1h-10m7-3l3 3-3 3" stroke="#899d7c" stroke-width="1.2" fill="none"/>`}<text x="${px}" y="${py + 19}" class="port-label" text-anchor="middle">${port.type < 0 ? '3:1' : '2:1'}</text></g>`;
  }
  for (const t of s.board.tiles) {
    const x = t.x * SCALE, y = t.y * SCALE, red = [6, 8].includes(t.number), resource = t.resource >= 0 ? t.resource : 5;
    svg += `<g data-tile="${t.id}"><polygon class="hex" points="${pointString(s, t, .97)}" fill="${TILE_COLORS[resource]}"/><g transform="translate(${x},${y - 9})">${terrain(t.resource, t)}</g>`;
    if (t.number) svg += `<circle class="number-token" cx="${x}" cy="${y + 15}" r="16"/><text class="tile-number ${red ? 'red-number' : ''}" x="${x}" y="${y + 13}">${t.number}</text>${Array.from({ length: PIPS[t.number] }, (_, i) => `<circle class="token-pip ${red ? 'red-pip' : ''}" cx="${x + (i - (PIPS[t.number] - 1) / 2) * 3}" cy="${y + 26}" r=".8"/>`).join('')}`;
    svg += `<text class="tile-label" x="${x}" y="${y + 40}">${t.resource < 0 ? 'DUNES' : RES[t.resource].toUpperCase()}</text>`;
    if (s.robber === t.id) svg += `<g transform="translate(${x + 28},${y - 2})"><path class="raider" d="M-7 14l2-12q-8-12 5-12T5 2l3 12z"/><path d="M-2-1h4" stroke="#f5edd6" stroke-width="1.3"/></g>`;
    if (tileActions.some(a => a.tile === t.id)) svg += `<polygon class="tile-select" data-robber="${t.id}" points="${pointString(s, t, .93)}" tabindex="0" role="button" aria-label="Move raider to ${t.resource < 0 ? 'dunes' : RES[t.resource]} ${t.number || ''}"/>`;
    svg += '</g>';
  }
  for (const e of s.board.edges) if (s.edgeOwner[e.id] >= 0) {
    const [a, b] = e.nodes.map(n => xy(s.board.nodes[n]));
    svg += `<path class="placed-road-shadow" d="M${a.join(' ')}L${b.join(' ')}"/><path class="placed-road" stroke="${s.players[s.edgeOwner[e.id]].color}" d="M${a.join(' ')}L${b.join(' ')}"/>`;
  }
  for (const a of edgeActions) {
    const [n, m] = s.board.edges[a.edge].nodes.map(i => xy(s.board.nodes[i]));
    svg += `<g data-edge="${a.edge}" tabindex="0" role="button" aria-label="Build road ${a.edge}"><path class="edge-hit" d="M${n.join(' ')}L${m.join(' ')}"/><path class="edge-option" d="M${n.join(' ')}L${m.join(' ')}"/></g>`;
  }
  for (const n of s.board.nodes) {
    const [x, y] = xy(n), owner = s.nodeOwner[n.id], city = s.levels[n.id] === 2, active = false, hint = highlights.some(a => a.node === n.id);
    if (hint) svg += `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#a67942" stroke-width="2" stroke-dasharray="3 3"/>`;
    if (owner >= 0) svg += `<g transform="translate(${x},${y})" ${active ? `data-node="${n.id}" tabindex="0" role="button" aria-label="Upgrade outpost ${n.id}"` : ''}>${active ? '<circle r="14" fill="#f8e9b2" opacity=".7"/>' : ''}<path class="site" fill="${s.players[owner].color}" d="${city ? 'M-10 7v-13l6-5 6 5v4l5-5 6 5v9z' : 'M-8 7V-3L0-10 8-3V7z'}"/><path d="M-2 6v-5h4v5" fill="#fff4dc"/>${city ? '<circle class="city-marker" cx="-4" cy="-4" r="1.5"/>' : ''}${active ? '<circle class="vertex-hit" r="16"/>' : ''}</g>`;
    else if (active) svg += `<g data-node="${n.id}" tabindex="0" role="button" aria-label="Build outpost at intersection ${n.id}"><circle class="vertex-option" cx="${x}" cy="${y}" r="7"/><circle class="vertex-hit" cx="${x}" cy="${y}" r="14"/></g>`;
    else svg += `<circle cx="${x}" cy="${y}" r="1.5" fill="#7f937a" opacity=".28"/>`;
  }
  const marker = (x, y, attributes, label, path, selected = false) => `<g transform="translate(${x},${y})" ${attributes} tabindex="0" role="button" aria-label="${label}" class="map-marker ${selected ? 'chosen' : ''}"><g class="marker-bob"><path d="M0 8v8" stroke="#6b8061" stroke-width="1.5"/><circle r="11" fill="#fffdf2" stroke="#738d65" stroke-width="1.3"/><path d="${path}" fill="none" stroke="#4d6c43" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle r="14" fill="transparent"/></g></g>`;
  for (const a of nodeActions) {
    const [x, y] = xy(s.board.nodes[a.node]);
    svg += marker(x, y - 18, `data-node="${a.node}" data-kind="${a.type}"`, `${a.type === 'city' ? 'Upgrade to city' : 'Build outpost'} at intersection ${a.node}`, a.type === 'city' ? 'M-6 5v-9l3-3 3 3v3l3-3 3 3v6z' : 'M-6 5v-6l6-5 6 5v6zM-1 5V1h2v4');
  }
  for (const n of starts) {
    const [x, y] = xy(n);
    svg += marker(x + 14, y + 10, `data-road-start="${n.id}"`, `Start road from intersection ${n.id}`, 'M-6 5L4-5M-3 7L7-3M-3 2l2 2M1-2l2 2', roadStart === n.id);
  }
  return svg;
}
