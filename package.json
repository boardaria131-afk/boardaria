'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Engine Smoke Tests  —  run: node server/engine/engine-test.js
// ═══════════════════════════════════════════════════════════

const E = require('./game-engine');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ── Helper ────────────────────────────────────────────────
function freshState() {
  return E.mkState({
    deckA:  E.mkDefaultDeck('A'),
    deckB:  E.mkDefaultDeck('B'),
    nameA: 'Alice',
    nameB: 'Bob',
  });
}

console.log('\n── State & Init ─────────────────────────────────────');

test('mkState creates valid state', () => {
  const S = freshState();
  assert(S.turn === 1, 'turn=1');
  assert(S.ap === 'A', 'ap=A');
  assert(S.phase === 'DRAW', 'phase=DRAW');
  assert(S.players.A.hp === E.BASE_HP, 'A hp');
  assert(S.players.B.hp === E.BASE_HP, 'B hp');
  assert(Array.isArray(S.players.A.hand), 'A hand array');
  assert(typeof S.cells === 'object', 'cells object');
  assert(typeof S.units === 'object', 'units object');
});

test('mkDefaultDeck returns valid deck', () => {
  const d = E.mkDefaultDeck('A');
  assert(Array.isArray(d) && d.length > 0, 'deck not empty');
  for (const id of d) {
    const cd = E.cardData(id);
    assert(cd, `card ${id} not found`);
  }
});

test('cardData returns known card', () => {
  // Find any card id
  const ids = Object.values(E.CARDS).map(c => c.id).filter(Boolean);
  assert(ids.length > 0, 'CARDS not empty');
  const cd = E.cardData(ids[0]);
  assert(cd && cd.id === ids[0], 'cardData ok');
});

test('allCells returns board cells', () => {
  const cells = E.allCells();
  assert(cells.length > 0, 'cells not empty');
  for (const [q,r,s] of cells) {
    assert(typeof q === 'number', 'q is number');
  }
});

test('cK is deterministic', () => {
  assert(E.cK(1,2) === E.cK(1,2), 'same key for same coords');
  assert(E.cK(1,2) !== E.cK(2,1), 'different keys for different coords');
});

test('cDist hex distance', () => {
  assert(E.cDist([0,0,0],[1,0,-1]) === 1, 'adjacent distance = 1');
  assert(E.cDist([0,0,0],[2,0,-2]) === 2, 'distance = 2');
  assert(E.cDist([0,0,0],[0,0,0]) === 0, 'same cell = 0');
});

test('inB rejects out-of-bounds', () => {
  assert(E.inB(0,0,0) === true, '0,0,0 in bounds');
  assert(E.inB(99,0,-99) === false, 'far cell out of bounds');
});

console.log('\n── Mulligan ─────────────────────────────────────────');

test('doMulligan replaces specified card IDs', () => {
  const S = freshState();
  // S already has hand from mkState (3 cards dealt)
  const before = S.players.A.hand.length;
  assert(before > 0, 'hand not empty');
  const replaceId = S.players.A.hand[0].id;
  E.doMulligan(S, 'A', [replaceId]);
  assert(S.players.A.hand.length === before, 'hand size preserved after mulligan');
});

console.log('\n── Land & Cells ─────────────────────────────────────');

test('adjPlace returns valid cells', () => {
  const S = freshState();
  const adj = E.adjPlace(S, 'A');
  assert(Array.isArray(adj), 'returns array');
});

console.log('\n── Production ───────────────────────────────────────');

test('runProduction does not throw on empty board', () => {
  const S = freshState();
  E.runProduction(S, 'A');
});

test('hurtGod reduces hp', () => {
  const S = freshState();
  const before = S.players.B.hp;
  E.hurtGod(S, 'B', 3);
  assert(S.players.B.hp === before - 3, 'hp reduced by 3');
});

test('hurtGod ignores 0 damage', () => {
  const S = freshState();
  const before = S.players.B.hp;
  E.hurtGod(S, 'B', 0);
  assert(S.players.B.hp === before, 'hp unchanged on 0 dmg');
});

test('hurtGod sets winner when hp <= 0', () => {
  const S = freshState();
  E.hurtGod(S, 'B', 999);
  assert(S.winner === 'A', 'winner set after lethal');
});

console.log('\n── Game Log ─────────────────────────────────────────');

test('lg appends to log', () => {
  const S = freshState();
  const before = S.log.length;
  E.lg(S, 'A', 'test message');
  assert(S.log.length === before + 1, 'log grew');
});

console.log('\n── doCleanup ────────────────────────────────────────');

test('doCleanup runs without error', () => {
  const S = freshState();
  E.doCleanup(S);
});

// ── Summary ───────────────────────────────────────────────
console.log(`\n${'─'.repeat(52)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
