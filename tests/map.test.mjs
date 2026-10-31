import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, production } from '../src/engine.mjs';
import { opening } from '../src/ai.mjs';
import { boardSVG } from '../src/art.mjs';
const ids = (svg, attr) => [...svg.matchAll(new RegExp(`${attr}="(\\d+)"`, 'g'))].map(m => Number(m[1]));
test('opening house prompts and road origins match legal placement, then expose only incident edges', () => {
  const s = createGame('map-opening');
  assert.deepEqual(ids(boardSVG(s, 'settlement'), 'data-node'), legalActions(s).map(a => a.node));
  applyAction(s, legalActions(s)[0]);
  assert.deepEqual(ids(boardSVG(s, 'road'), 'data-road-start'), [s.setupNode]);
  assert.deepEqual(ids(boardSVG(s, 'road'), 'data-edge'), []);
  assert.deepEqual(ids(boardSVG(s, 'road', [], {roadStart:s.setupNode}), 'data-edge'), legalActions(s).map(a => a.edge));
  assert.deepEqual(ids(boardSVG(s, 'road', [], {enabled:false}), 'data-road-start'), []);
});
test('post-roll city prompts only upgrade owned outposts, roads respect blocked endpoints', () => {
  const s = opening(createGame('map-build')); s.phase = 'build';
  for (let r=0;r<5;r++) { s.bank[r] += s.hands[0][r]-5; s.hands[0][r]=5; }
  const actions = legalActions(s), svg = boardSVG(s);
  assert.deepEqual(ids(svg, 'data-node'), actions.filter(a => ['settlement','city'].includes(a.type)).map(a => a.node));
  for (const start of ids(svg,'data-road-start')) {
    assert.ok(s.nodeOwner[start]===0 || s.nodeOwner[start]<0 && s.board.nodes[start].edges.some(e=>s.edgeOwner[e]===0));
    const shown = ids(boardSVG(s,'road',[],{roadStart:start}),'data-edge');
    assert.deepEqual(shown,actions.filter(a=>a.type==='road'&&s.board.edges[a.edge].nodes.includes(start)).map(a=>a.edge));
  }
  s.phase='roll'; assert.deepEqual(ids(boardSVG(s), 'data-node'), []);
  s.current=1; s.phase='build'; assert.deepEqual(ids(boardSVG(s),'data-road-start'), []);
});
test('resource shortage does not allocate a scarce resource to multiple players', () => {
  const s=createGame('multi-shortage'), tile=s.board.tiles.find(t=>t.resource>=0);
  s.nodeOwner[tile.nodes[0]]=0; s.levels[tile.nodes[0]]=2;
  s.nodeOwner[tile.nodes[2]]=1; s.levels[tile.nodes[2]]=1;
  s.bank[tile.resource]=1;
  production(s,tile.number);
  assert.equal(s.hands[0][tile.resource],0); assert.equal(s.hands[1][tile.resource],0); assert.equal(s.bank[tile.resource],1);
});
test('Road Building places both available roads and returns when stock is exhausted', () => {
  const s=opening(createGame('road-card')); s.phase='build'; s.dev[0]=[{type:'roads',bought:0}];
  applyAction(s,{type:'roads'});
  assert.ok(!legalActions(s).some(a=>a.type==='skip-road'));
  applyAction(s,legalActions(s)[0]); assert.equal(s.freeRoads,1);
  applyAction(s,legalActions(s)[0]); assert.equal(s.phase,'build');
  s.phase='free-road'; s.returnPhase='roll'; s.freeRoads=1;
  for (const edge of s.board.edges) s.edgeOwner[edge.id]=0;
  assert.deepEqual(legalActions(s),[{type:'skip-road'}]); applyAction(s,{type:'skip-road'}); assert.equal(s.phase,'roll');
});
test('Year of Plenty offers the last card when only one remains in supply', () => {
  const s=opening(createGame('last-harvest')); s.phase='build'; s.dev[0]=[{type:'plenty',bought:0}]; s.bank=[0,0,0,1,0];
  const choices=legalActions(s).filter(a=>a.type==='plenty'); assert.deepEqual(choices,[{type:'plenty',resources:[3]}]);
  const before=s.hands[0][3]; applyAction(s,choices[0]); assert.equal(s.hands[0][3],before+1); assert.equal(s.bank[3],0);
});
