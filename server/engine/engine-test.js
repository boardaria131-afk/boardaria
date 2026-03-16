'use strict';
console.warn = () => {};

const { mkState, doMulligan, mkUnit, adjPlace, validMoves, cK, BASE_B, BASE_A, cardData }
      = require('/home/claude/hexforge-fixed/server/engine/game-engine');
const { applyAction, runDrawPhase, runManaPhase }
      = require('/home/claude/hexforge-fixed/server/engine/action-handler');
const { validateAction }  = require('/home/claude/hexforge-fixed/server/engine/action-validator');
const { GameRoom }        = require('/home/claude/hexforge-fixed/server/rooms/game-room');
const { ACTION }          = require('/home/claude/hexforge-fixed/shared/protocol');

let passed = 0, failed = 0;
const _asyncTests = [];

function test(name, fn) {
  if (fn.length > 0) {
    // Async test: fn takes a done callback
    _asyncTests.push({ name, fn });
    return;
  }
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch(e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

async function runAsyncTests() {
  for (const { name, fn } of _asyncTests) {
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.log(`  ✗ ${name}: TIMEOUT`);
        failed++;
        resolve();
      }, 5000);
      try {
        fn(() => {
          clearTimeout(timer);
          console.log(`  ✓ ${name}`);
          passed++;
          resolve();
        });
      } catch(e) {
        clearTimeout(timer);
        console.log(`  ✗ ${name}: ${e.message}`);
        failed++;
        resolve();
      }
    });
  }
}

// ─── helpers ─────────────────────────────────────────────────
function makeGameReady(deckCards) {
  const cards = deckCards || Array(20).fill('campfire');
  const S = mkState({ deckA: cards, deckB: cards, nameA:'Alice', nameB:'Bob' });
  delete S._mulliganPhase;
  runDrawPhase(S);
  runManaPhase(S);
  return S;
}

function makeFakeIO(logs) {
  return {
    sockets: { sockets: new Map([
      ['sockA', { join(){}, emit(){} }],
      ['sockB', { join(){}, emit(){} }],
    ])},
    to: (id) => ({ emit: (event, data) => { if (logs) logs.push({ to:id, event, data }); } }),
  };
}

function makeStartedRoom() {
  const events = [];
  const io = makeFakeIO(events);
  io.sockets.sockets.get('sockA').join = () => {};
  io.sockets.sockets.get('sockB').join = () => {};
  const room = new GameRoom({
    playerA: { socketId:'sockA', userId:1, username:'Alice', rating:1000, deck:null },
    playerB: { socketId:'sockB', userId:2, username:'Bob',   rating:1000, deck:null },
    io, onGameOver: () => {},
  });
  room.start();
  room.handleAction('sockA', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  room.handleAction('sockB', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  events.length = 0;
  return { room, events };
}

// ─── 1. State ────────────────────────────────────────────────
console.log('\n── 1. State Creation ──');

test('Wells on board (4 wells, mana=1)', () => {
  const S = mkState({});
  const wells = Object.values(S.cells).filter(c => c.type === 'WELL');
  assert(wells.length === 4, `Expected 4 wells, got ${wells.length}`);
  wells.forEach(w => assert(w.mana === 1, 'well mana=1'));
});

test('Bases on board (2 bases, A+B)', () => {
  const S = mkState({});
  const bases = Object.values(S.cells).filter(c => c.type === 'BASE');
  assert(bases.length === 2, `Expected 2 bases, got ${bases.length}`);
  assert(bases.some(b => b.owner === 'A'), 'Base A');
  assert(bases.some(b => b.owner === 'B'), 'Base B');
});

test('mkState gives A=3 cards, B=4 cards', () => {
  const S = mkState({ deckA: Array(10).fill('campfire'), deckB: Array(10).fill('campfire') });
  // GameRoom sets _mulliganPhase after mkState; mkState itself doesn't
  assert(S.players.A.hand.length === 3, `A hand=${S.players.A.hand.length}`);
  assert(S.players.B.hand.length === 4, `B hand=${S.players.B.hand.length}`);
  assert(S.players.A.mana === 3, `A mana=${S.players.A.mana}`);
});

// ─── 2. Mulligan ─────────────────────────────────────────────
console.log('\n── 2. Mulligan ──');

test('Mulligan replaces cards: hand stays at same size', () => {
  // Use a varied deck so cards aren't all the same id
  const deck = ['campfire','explore','imperial_guard','aurora_spirit','campfire',
                'explore','imperial_guard','aurora_spirit','campfire','explore'];
  const S = mkState({ deckA: deck, deckB: deck });
  const before = S.players.A.hand.length;
  const firstCard = S.players.A.hand[0].id;
  doMulligan(S, 'A', [firstCard]);
  assert(S.players.A.hand.length === before,
    `hand should be ${before}, got ${S.players.A.hand.length}`);
});

test('Mulligan validate accepts replaceIds', () => {
  const S = mkState({});
  S._mulliganPhase = 'BOTH';
  const r = validateAction(S, { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } }, 'A');
  assert(r.ok, `Expected ok, got: ${r.reason}`);
});

test('Mulligan validate rejects without phase', () => {
  const S = mkState({});
  delete S._mulliganPhase;
  const r = validateAction(S, { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } }, 'A');
  assert(!r.ok, 'Should fail without mulligan phase');
});

// ─── 3. Turn lifecycle ───────────────────────────────────────
console.log('\n── 3. Turn Lifecycle ──');

test('After draw+mana: FREE phase, cards+mana', () => {
  const S = makeGameReady();
  assert(S.phase === 'FREE', `phase=${S.phase}`);
  assert(S.ap === 'A', `ap=${S.ap}`);
  assert(S.players.A.hand.length > 0, 'A has cards');
  assert(S.players.A.mana > 0, 'A has mana');
});

test('END_TURN advances to B', () => {
  const S = makeGameReady();
  applyAction(S, { type: ACTION.END_TURN, payload:{} }, 'A');
  assert(S.ap === 'B', `ap=${S.ap}`);
  assert(S.phase === 'FREE', `phase=${S.phase}`);
});

test('B END_TURN advances turn to 2', () => {
  const S = makeGameReady();
  applyAction(S, { type: ACTION.END_TURN, payload:{} }, 'A');
  applyAction(S, { type: ACTION.END_TURN, payload:{} }, 'B');
  assert(S.turn === 2, `turn=${S.turn}`);
  assert(S.ap === 'A', `ap=${S.ap}`);
});

test('Wrong player rejected', () => {
  const S = makeGameReady();
  const v = validateAction(S, { type: ACTION.END_TURN, payload:{} }, 'B');
  assert(!v.ok, 'B cannot act on A turn');
});

// ─── 4. Power Wheel ──────────────────────────────────────────
console.log('\n── 4. Power Wheel ──');

test('WHEEL_DRAW draws a card', () => {
  const S = makeGameReady();
  const before = S.players.A.hand.length;
  applyAction(S, { type: ACTION.WHEEL_DRAW, payload:{} }, 'A');
  assert(S.players.A.hand.length === before + 1, 'hand grew');
  assert(S.lobDone, 'lobDone');
});

test('WHEEL_BOOST gives +1 mana', () => {
  const S = makeGameReady();
  const before = S.players.A.mana;
  applyAction(S, { type: ACTION.WHEEL_BOOST, payload:{} }, 'A');
  assert(S.players.A.mana === before + 1, `${before}→${S.players.A.mana}`);
});

test('Cannot WHEEL_BOOST twice', () => {
  const S = makeGameReady();
  applyAction(S, { type: ACTION.WHEEL_BOOST, payload:{} }, 'A');
  const v = validateAction(S, { type: ACTION.WHEEL_BOOST, payload:{} }, 'A');
  assert(!v.ok, 'second boost rejected');
});

test('WHEEL_LAND places a land', () => {
  const S = makeGameReady();
  const spots = adjPlace(S, 'A');
  const [q,r,s] = spots[0];
  applyAction(S, { type: ACTION.WHEEL_LAND, payload:{ landType:'F', q, r, s } }, 'A');
  const cell = S.cells[cK(q,r)];
  assert(cell?.type === 'LAND' && cell.landType === 'F', `cell=${JSON.stringify(cell)}`);
});

// ─── 5. Cards ────────────────────────────────────────────────
console.log('\n── 5. Playing Cards ──');

test('PLAY_INSTANT_NOTARGET: explore', () => {
  const S = makeGameReady();
  S.players.A.mana = 10;
  S.players.A.hand.push({ id:'explore', buff:{atk:0,hp:0} });
  const v = validateAction(S, { type: ACTION.PLAY_INSTANT_NOTARGET, payload:{ cardId:'explore' } }, 'A');
  assert(v.ok, `validate: ${v.reason}`);
  applyAction(S, { type: ACTION.PLAY_INSTANT_NOTARGET, payload:{ cardId:'explore' } }, 'A');
});

test('PLAY_UNIT: imperial_guard on own land', () => {
  const S = makeGameReady();
  const spots = adjPlace(S, 'A');
  const [q,r,s] = spots[0];
  S.cells[cK(q,r)] = { type:'LAND', owner:'A', landType:'N' };
  S.lobDone = true;
  S.players.A.mana = 10;
  S.players.A.hand.push({ id:'imperial_guard', buff:{atk:0,hp:0} });
  const v = validateAction(S, { type: ACTION.PLAY_UNIT, payload:{ cardId:'imperial_guard', q, r, s } }, 'A');
  assert(v.ok, `validate: ${v.reason}`);
  applyAction(S, { type: ACTION.PLAY_UNIT, payload:{ cardId:'imperial_guard', q, r, s } }, 'A');
  const placed = Object.values(S.units).find(u => u.q === q && u.r === r);
  assert(placed?.cid === 'imperial_guard', 'unit on board');
});

// ─── 6. Movement ─────────────────────────────────────────────
console.log('\n── 6. Unit Movement ──');

test('MOVE_UNIT: unit moves to adjacent land', () => {
  const S = makeGameReady();
  // Place TWO connected land tiles so unit has somewhere to go
  const spots = adjPlace(S, 'A');
  const [q1,r1,s1] = spots[0];
  S.cells[cK(q1,r1)] = { type:'LAND', owner:'A', landType:'N' };
  // Now get spots adjacent to the first new land
  const spots2 = adjPlace(S, 'A').filter(([q,r]) => !(q===q1 && r===r1));
  assert(spots2.length > 0, 'second spot exists');
  const [q2,r2,s2] = spots2[0];
  S.cells[cK(q2,r2)] = { type:'LAND', owner:'A', landType:'N' };

  const u = mkUnit(S, 'A', 'imperial_guard', q1, r1, s1);
  u.summonSick = false;
  S.units[u.id] = u;

  const moves = validMoves(S, u.id);
  assert(moves.length > 0, `no valid moves from (${q1},${r1})`);
  const [mq,mr,ms] = moves[0];
  const v = validateAction(S, { type: ACTION.MOVE_UNIT, payload:{ unitId:u.id, q:mq, r:mr, s:ms } }, 'A');
  assert(v.ok, `validate: ${v.reason}`);
  applyAction(S, { type: ACTION.MOVE_UNIT, payload:{ unitId:u.id, q:mq, r:mr, s:ms } }, 'A');
  assert(S.units[u.id].q === mq, 'unit moved');
  assert(S.units[u.id].moved === true, 'moved flag');
});

// ─── 7. Combat ───────────────────────────────────────────────
console.log('\n── 7. Combat ──');

test('ATTACK_UNIT: both keldran_soldiers die', () => {
  const S = makeGameReady();
  S.cells[cK(-2,-1)] = { type:'LAND', owner:'A', landType:'N' };
  S.cells[cK(-1,-1)] = { type:'LAND', owner:'B', landType:'N' };
  const uA = mkUnit(S, 'A', 'keldran_soldier', -2, -1, 3);
  const uB = mkUnit(S, 'B', 'keldran_soldier', -1, -1, 2);
  uA.summonSick = false; uB.summonSick = false;
  S.units[uA.id] = uA; S.units[uB.id] = uB;
  const v = validateAction(S, { type: ACTION.ATTACK_UNIT, payload:{ unitId:uA.id, targetId:uB.id } }, 'A');
  assert(v.ok, `validate: ${v.reason}`);
  applyAction(S, { type: ACTION.ATTACK_UNIT, payload:{ unitId:uA.id, targetId:uB.id } }, 'A');
  assert(!S.units[uA.id] && !S.units[uB.id], 'both dead');
});

test('ATTACK_BASE: unit damages enemy base', () => {
  // Need a full game-ready state (FREE phase) + unit adjacent to base
  const S = makeGameReady();
  const [bq,br,bs] = BASE_B; // [0,3,-3]
  // Place land adjacent to base B
  S.cells[cK(0,2)] = { type:'LAND', owner:'A', landType:'N' };
  const u = mkUnit(S, 'A', 'keldran_soldier', 0, 2, -2);
  u.summonSick = false;
  S.units[u.id] = u;
  const before = S.players.B.hp;
  const v = validateAction(S, { type: ACTION.ATTACK_BASE, payload:{ unitId:u.id } }, 'A');
  assert(v.ok, `validate: ${v.reason}`);
  applyAction(S, { type: ACTION.ATTACK_BASE, payload:{ unitId:u.id } }, 'A');
  assert(S.players.B.hp < before, `B hp: ${before}→${S.players.B.hp}`);
});

// ─── 8. GameRoom integration ─────────────────────────────────
console.log('\n── 8. GameRoom Integration ──');

test('GAME_START sent to both players', () => {
  const events = [];
  const io = makeFakeIO(events);
  io.sockets.sockets.get('sockA').join = () => {};
  io.sockets.sockets.get('sockB').join = () => {};
  const room = new GameRoom({
    playerA: { socketId:'sockA', userId:1, username:'Alice', rating:1000, deck:null },
    playerB: { socketId:'sockB', userId:2, username:'Bob',   rating:1000, deck:null },
    io, onGameOver: () => {},
  });
  room.start();
  const starts = events.filter(e => e.event === 'game_start');
  assert(starts.length === 2, `expected 2, got ${starts.length}`);
  assert(starts.find(e=>e.to==='sockA')?.data.yourPlayer === 'A', 'A gets player A');
  assert(starts.find(e=>e.to==='sockB')?.data.yourPlayer === 'B', 'B gets player B');
});

test('Mulligan both confirm → game starts, FREE phase', () => {
  const { room, events } = makeStartedRoom();
  assert(!room.S._mulliganPhase, '_mulliganPhase cleared');
  assert(room.S.phase === 'FREE', `phase=${room.S.phase}`);
  assert(room.S.ap === 'A', `ap=${room.S.ap}`);
});

test('Wrong player action rejected with action_invalid', () => {
  const { room, events } = makeStartedRoom();
  room.handleAction('sockB', { type: ACTION.END_TURN, payload:{} });
  const invalids = events.filter(e => e.event === 'action_invalid');
  assert(invalids.length > 0, 'action_invalid sent');
});

test('Full turn cycle A→B→A, turn=2', () => {
  const { room } = makeStartedRoom();
  assert(room.S.ap === 'A', 'A first');
  room.handleAction('sockA', { type: ACTION.END_TURN, payload:{} });
  assert(room.S.ap === 'B', 'B after A ends');
  room.handleAction('sockB', { type: ACTION.END_TURN, payload:{} });
  assert(room.S.ap === 'A', 'A after B ends');
  assert(room.S.turn === 2, `turn=${room.S.turn}`);
});

test('Opponent hand hidden (all ??)', () => {
  const { room } = makeStartedRoom();
  const stateForA = room._stateForPlayer('A');
  assert(stateForA.players.B.hand.every(c => c.id === '??'), 'B hand hidden');
  assert(stateForA.players.A.hand.some(c => c.id !== '??'), 'A sees own hand');
  assert(typeof stateForA.players.B.handSize === 'number', 'handSize present');
});

test('unit.kw serialized as Array', () => {
  const { room } = makeStartedRoom();
  const spots = adjPlace(room.S, 'A');
  if (spots.length > 0) {
    const [q,r,s] = spots[0];
    room.S.cells[cK(q,r)] = { type:'LAND', owner:'A', landType:'N' };
    const u = mkUnit(room.S, 'A', 'hilltop_archer', q, r, s);
    room.S.units[u.id] = u;
  }
  const state = room._stateForPlayer('A');
  for (const u of Object.values(state.units)) {
    assert(Array.isArray(u.kw), `kw is ${typeof u.kw}`);
  }
});

test('Reconnect: sendState re-sends current state', () => {
  const { room, events } = makeStartedRoom();
  room.sendState('sockA', 'A');
  const reconnect = events.find(e => e.event === 'state_update' && e.data?.reconnected);
  assert(reconnect, 'reconnect state_update sent');
});

test('Wheel actions go through correctly: DRAW+BOOST+LAND', () => {
  const { room, events } = makeStartedRoom();
  const before = room.S.players.A.mana;
  room.handleAction('sockA', { type: ACTION.WHEEL_BOOST, payload:{} });
  assert(room.S.players.A.mana === before + 1, 'boost worked');
  assert(room.S.lobDone, 'lobDone after boost');
  const invalids = events.filter(e => e.event === 'action_invalid');
  assert(invalids.length === 0, `unexpected invalids: ${invalids.map(e=>e.data?.reason).join(',')}`);
});

test('State serialized with cells, units, players', () => {
  const { room } = makeStartedRoom();
  const s = room._stateForPlayer('A');
  assert(s.cells && typeof s.cells === 'object', 'cells present');
  assert(s.units && typeof s.units === 'object', 'units present');
  assert(s.players.A && s.players.B, 'both players present');
  assert(typeof s.turn === 'number', 'turn present');
  assert(typeof s.ap === 'string', 'ap present');
});


// ─── 9. Timer ──────────────────────────────────────────────
console.log('\n── 9. Timer ──');

test('GameRoom starts timer after mulligan', () => {
  const { room } = makeStartedRoom();
  assert(room._timerInterval !== null, 'timer interval running');
  assert(room._timerSecsLeft === 90, `secsLeft=${room._timerSecsLeft}`);
  assert(room._timerAp === 'A', `timerAp=${room._timerAp}`);
  room._stopTimer();
});

test('Timer restarts for B after A ends turn', () => {
  const { room } = makeStartedRoom();
  room._stopTimer(); // stop to avoid async issues
  room.handleAction('sockA', { type: ACTION.END_TURN, payload: {} });
  assert(room._timerAp === 'B', `timerAp=${room._timerAp}`);
  assert(room._timerSecsLeft === 90, `secsLeft reset`);
  room._stopTimer();
});

test('Timer emits timer_update to room', () => {
  const events = [];
  const io = makeFakeIO(events);
  io.sockets.sockets.get('sockA').join = () => {};
  io.sockets.sockets.get('sockB').join = () => {};
  const room = new GameRoom({
    playerA: { socketId:'sockA', userId:1, username:'Alice', rating:1000, deck:null },
    playerB: { socketId:'sockB', userId:2, username:'Bob',   rating:1000, deck:null },
    io, onGameOver: () => {},
  });
  room.start();
  room.handleAction('sockA', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  room.handleAction('sockB', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  room._stopTimer();
  events.length = 0;
  room._emitTimer();
  const timerEvents = events.filter(e => e.event === 'timer_update');
  assert(timerEvents.length > 0, 'timer_update emitted');
  assert(timerEvents[0].data.ap === 'A', 'ap=A');
  assert(typeof timerEvents[0].data.secsLeft === 'number', 'secsLeft is number');
  assert(timerEvents[0].data.totalSecs === 90, 'totalSecs=90');
});

// ─── 10. Chat ──────────────────────────────────────────────
console.log('\n── 10. Chat ──');

test('Chat message broadcast to room', () => {
  const events = [];
  const io = makeFakeIO(events);
  io.sockets.sockets.get('sockA').join = () => {};
  io.sockets.sockets.get('sockB').join = () => {};
  const room = new GameRoom({
    playerA: { socketId:'sockA', userId:1, username:'Alice', rating:1000, deck:null },
    playerB: { socketId:'sockB', userId:2, username:'Bob',   rating:1000, deck:null },
    io, onGameOver: () => {},
  });
  room.start();
  room.handleAction('sockA', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  room.handleAction('sockB', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  room._stopTimer();
  events.length = 0;
  room.handleChat('sockA', 'Good game!');
  const chatEvents = events.filter(e => e.event === 'chat_msg');
  assert(chatEvents.length > 0, 'chat_msg emitted');
  const msg = chatEvents[0].data;
  assert(msg.from === 'Alice', `from=${msg.from}`);
  assert(msg.text === 'Good game!', `text=${msg.text}`);
  assert(msg.player === 'A', `player=${msg.player}`);
});

test('Chat ignores empty messages', () => {
  const events = [];
  const io = makeFakeIO(events);
  io.sockets.sockets.get('sockA').join = () => {};
  const room = new GameRoom({
    playerA: { socketId:'sockA', userId:1, username:'Alice', rating:1000, deck:null },
    playerB: { socketId:'sockB', userId:2, username:'Bob',   rating:1000, deck:null },
    io, onGameOver: () => {},
  });
  room.start();
  room.handleAction('sockA', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  room.handleAction('sockB', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  room._stopTimer();
  events.length = 0;
  room.handleChat('sockA', '   ');
  room.handleChat('sockA', '');
  const chatEvents = events.filter(e => e.event === 'chat_msg');
  assert(chatEvents.length === 0, 'no chat for empty messages');
});

test('Chat truncates messages >200 chars', () => {
  const events = [];
  const io = makeFakeIO(events);
  io.sockets.sockets.get('sockA').join = () => {};
  const room = new GameRoom({
    playerA: { socketId:'sockA', userId:1, username:'Alice', rating:1000, deck:null },
    playerB: { socketId:'sockB', userId:2, username:'Bob',   rating:1000, deck:null },
    io, onGameOver: () => {},
  });
  room.start();
  room.handleAction('sockA', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  room.handleAction('sockB', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });
  room._stopTimer();
  events.length = 0;
  const longMsg = 'A'.repeat(300);
  room.handleChat('sockA', longMsg);
  const chatEvents = events.filter(e => e.event === 'chat_msg');
  assert(chatEvents.length === 1, 'message sent');
  assert(chatEvents[0].data.text.length <= 200, `truncated to ${chatEvents[0].data.text.length}`);
});


// ─── 11. Bot Player ────────────────────────────────────────
console.log('\n── 11. Bot Player ──');

const { BotPlayer } = require('/home/claude/hexforge-fixed/server/bot/bot-player');

test('Bot instance creation', () => {
  const { room } = makeStartedRoom();
  const bot = new BotPlayer('A', room, 'sockA');
  assert(bot.player === 'A', 'player');
  assert(!bot._thinking, 'not thinking');
});

test('Bot _handlePending: mulligan triggers _doMulligan', () => {
  const { room } = makeStartedRoom();
  const bot = new BotPlayer('B', room, 'sockB');
  // Re-open mulligan phase to test
  room.S._mulliganPhase = 'BOTH';
  room.mulliganDone.B = false;
  const actions = [];
  const orig = room.handleAction.bind(room);
  room.handleAction = (sid, action) => { actions.push(action); try { orig(sid, action); } catch(e){} };
  bot._handlePending(room.S, { type: 'mulligan' });
  assert(actions.some(a => a.type === ACTION.MULLIGAN_CONFIRM), 'mulligan_confirm sent');
});

test('Bot _handlePending: discover picks first card', () => {
  const { room } = makeStartedRoom();
  const bot = new BotPlayer('A', room, 'sockA');
  const actions = [];
  const orig = room.handleAction.bind(room);
  room.handleAction = (sid, action) => { actions.push(action); try { orig(sid, action); } catch(e){} };
  bot._handlePending(room.S, { type: 'discover', pool: ['campfire', 'explore'] });
  assert(actions.some(a => a.type === ACTION.DISCOVER_PICK), 'discover_pick sent');
  assert(actions[0].payload.chosenId === 'campfire', 'first card picked');
});

test('Bot _doMulligan keeps cheap cards', () => {
  const { room } = makeStartedRoom();
  room.S._mulliganPhase = 'BOTH';
  room.mulliganDone.A = false;
  room.S.players.A.hand = [
    { id: 'campfire', buff:{atk:0,hp:0} },
    { id: 'imperial_guard', buff:{atk:0,hp:0} },
  ];
  const actions = [];
  const orig = room.handleAction.bind(room);
  room.handleAction = (sid, action) => { actions.push(action); try { orig(sid, action); } catch(e){} };
  const bot = new BotPlayer('A', room, 'sockA');
  bot._doMulligan(room.S);
  const mull = actions.find(a => a.type === ACTION.MULLIGAN_CONFIRM);
  assert(mull, 'mulligan sent');
  assert(mull.payload.replaceIds.length === 0, 'cheap cards kept');
});

test('Bot _doWheel draws when hand empty', () => {
  const { room } = makeStartedRoom();
  room.S.lobDone = false;
  room.S.players.A.hand = [];
  const actions = [];
  const orig = room.handleAction.bind(room);
  room.handleAction = (sid, action) => { actions.push(action); try { orig(sid, action); } catch(e){} };
  const bot = new BotPlayer('A', room, 'sockA');
  bot._doWheel(room.S);
  assert(actions.some(a => a.type === ACTION.WHEEL_DRAW), 'draws card');
});

test('Bot _doWheel places land or boosts with full hand', () => {
  const { room } = makeStartedRoom();
  room.S.lobDone = false;
  for (let i = 0; i < 6; i++) room.S.players.A.hand.push({ id:'campfire', buff:{atk:0,hp:0} });
  const actions = [];
  const orig = room.handleAction.bind(room);
  room.handleAction = (sid, action) => { actions.push(action); try { orig(sid, action); } catch(e){} };
  const bot = new BotPlayer('A', room, 'sockA');
  bot._doWheel(room.S);
  assert(
    actions.some(a => a.type === ACTION.WHEEL_LAND || a.type === ACTION.WHEEL_BOOST),
    'lands or boosts'
  );
});

test('Bot full game: mulligan → game starts within 1.5s', (done) => {
  const events = [];
  const fakeIO = {
    sockets: { sockets: new Map([
      ['hSock', { join(){}, emit(){} }],
      ['bSock', { join(){}, emit(){} }],
    ])},
    to: (id) => ({ emit: (ev, data) => events.push({ id, ev, data }) }),
  };
  const room2 = new GameRoom({
    playerA: { socketId:'hSock', userId:1, username:'Human', rating:1000, deck:null },
    playerB: { socketId:'bSock', userId:null, username:'HexBot', rating:1200, deck:null },
    io: fakeIO, onGameOver: () => {},
  });
  room2.start();
  const bot2 = new BotPlayer('B', room2, 'bSock');
  room2._bot = bot2;
  bot2.onStateUpdate(room2.S, { type: 'mulligan' });
  room2.handleAction('hSock', { type: ACTION.MULLIGAN_CONFIRM, payload: { replaceIds: [] } });

  setTimeout(() => {
    room2._stopTimer();
    assert(!room2.S._mulliganPhase, 'mulligan cleared');
    assert(room2.S.phase === 'FREE', `phase=${room2.S.phase}`);
    done();
  }, 1500);
});

// ─── 12. Bot pending inputs (Woc/FlameBurst/SpiritSpice) ──
console.log('\n── 12. Bot special pending inputs ──');

test('Bot handles woc pending: destroys weakest unit', () => {
  const { room } = makeStartedRoom();
  const { mkUnit, cK } = require('/home/claude/hexforge-fixed/server/engine/game-engine');
  // Place a weak enemy unit  
  room.S.cells[cK(-1,-1)] = { type:'LAND', owner:'B', landType:'N' };
  const weak = mkUnit(room.S, 'B', 'keldran_soldier', -1, -1, 2);
  weak.atk = 2; weak.hp = 3;
  room.S.units[weak.id] = weak;

  const bot = new BotPlayer('A', room, 'sockA');
  const actions = [];
  const orig = room.handleAction.bind(room);
  room.handleAction = (sid, action) => { actions.push(action); try { orig(sid, action); } catch(e){} };

  bot._handlePending(room.S, { type: 'woc' });
  assert(actions.some(a => a.type === ACTION.WHEEL_OF_CHAOS_TARGET), 'woc_target sent');
  assert(actions[0].payload.unitId === weak.id, 'weakest unit targeted');
});

test('Bot handles flame_burst pending: targets enemy base', () => {
  const { room } = makeStartedRoom();
  const bot = new BotPlayer('A', room, 'sockA');
  const actions = [];
  const orig = room.handleAction.bind(room);
  room.handleAction = (sid, action) => { actions.push(action); try { orig(sid, action); } catch(e){} };

  bot._handlePending(room.S, { type: 'flame_burst' });
  assert(actions.some(a => a.type === ACTION.FLAME_BURST_TARGET), 'flame_burst_target sent');
  // Should target enemy base (B's base for player A)
  const { BASE_B } = require('/home/claude/hexforge-fixed/server/engine/game-engine');
  const [bq, br] = BASE_B;
  assert(actions[0].payload.q === bq && actions[0].payload.r === br, 'targets enemy base');
});

test('Bot handles spirit_spice pending: buffs strongest unit', () => {
  const { room } = makeStartedRoom();
  const { mkUnit, cK } = require('/home/claude/hexforge-fixed/server/engine/game-engine');
  room.S.cells[cK(-1,-2)] = { type:'LAND', owner:'A', landType:'N' };
  const strong = mkUnit(room.S, 'A', 'imperial_guard', -1, -2, 3);
  strong.atk = 5;
  room.S.units[strong.id] = strong;

  const bot = new BotPlayer('A', room, 'sockA');
  const actions = [];
  const orig = room.handleAction.bind(room);
  room.handleAction = (sid, action) => { actions.push(action); try { orig(sid, action); } catch(e){} };

  bot._handlePending(room.S, { type: 'spirit_spice' });
  assert(actions.some(a => a.type === ACTION.SPIRIT_SPICE_TARGET), 'spirit_spice_target sent');
  assert(actions[0].payload.unitId === strong.id, 'strongest unit targeted');
});

test('Bot handles octopus pending: swaps two units', () => {
  const { room } = makeStartedRoom();
  const { mkUnit, cK } = require('/home/claude/hexforge-fixed/server/engine/game-engine');
  room.S.cells[cK(-1,-2)] = { type:'LAND', owner:'A', landType:'N' };
  room.S.cells[cK(-2,-1)] = { type:'LAND', owner:'B', landType:'N' };
  const u1 = mkUnit(room.S, 'A', 'imperial_guard', -1, -2, 3);
  const u2 = mkUnit(room.S, 'B', 'keldran_soldier', -2, -1, 3);
  room.S.units[u1.id] = u1;
  room.S.units[u2.id] = u2;

  const bot = new BotPlayer('A', room, 'sockA');
  const actions = [];
  const orig = room.handleAction.bind(room);
  room.handleAction = (sid, action) => { actions.push(action); try { orig(sid, action); } catch(e){} };

  bot._handlePending(room.S, { type: 'octopus' });
  assert(actions.some(a => a.type === ACTION.OCTOPUS_PICK), 'octopus_pick sent');
  assert(actions[0].payload.unitId1 && actions[0].payload.unitId2, 'two units selected');
});

// ─── 13. Server validates special actions ─────────────────
console.log('\n── 13. Server validates special actions ──');

test('validateAction: octopus_pick rejected outside FREE phase', () => {
  const S = makeGameReady();
  S.phase = 'DRAW';
  const v = validateAction(S, { type: ACTION.OCTOPUS_PICK, payload: { unitId1:'u1', unitId2:'u2' } }, 'A');
  assert(!v.ok, 'rejected in DRAW phase');
});

test('validateAction: woc_target rejected without pending woc', () => {
  const S = makeGameReady();
  const v = validateAction(S, { type: ACTION.WHEEL_OF_CHAOS_TARGET, payload: { unitId:'u1' } }, 'A');
  assert(!v.ok, 'rejected without pending woc');
});

test('validateAction: flame_burst_target rejected without pending', () => {
  const S = makeGameReady();
  const v = validateAction(S, { type: ACTION.FLAME_BURST_TARGET, payload: { q:0, r:3, s:-3 } }, 'A');
  assert(!v.ok, 'rejected without pending flame burst');
});

// ─── 14. Spectator ────────────────────────────────────────
console.log('\n── 14. Spectator ──');

test('addSpectator sends SPECTATE_START', () => {
  const { room, events } = makeStartedRoom();
  room._stopTimer();
  room.io.sockets.sockets.set('spec1', { join(){}, emit(){} });
  room.addSpectator('spec1');
  const start = events.find(e => e.event === 'spectate_start');
  assert(start, 'spectate_start sent');
  assert(start.data.state, 'state included');
  assert(start.data.players?.A && start.data.players?.B, 'both players');
});

test('SPECTATE_UPDATE sent after action', () => {
  const { room, events } = makeStartedRoom();
  room._stopTimer();
  room.io.sockets.sockets.set('spec1', { join(){}, emit(){} });
  room.addSpectator('spec1');
  events.length = 0;
  room.handleAction('sockA', { type: ACTION.END_TURN, payload: {} });
  room._stopTimer();
  const updates = events.filter(e => e.event === 'spectate_update');
  assert(updates.length > 0, 'spectate_update emitted');
});

test('Spectator sees both hands unredacted', () => {
  const { room } = makeStartedRoom();
  room._stopTimer();
  const spec = room._stateForSpectator();
  assert(spec.players.A.hand.some(c => c.id !== '??'), 'A hand visible');
  assert(spec.players.B.hand.some(c => c.id !== '??'), 'B hand visible');
});

// ─── 15. Deck API (in-memory) ─────────────────────────────
console.log('\n── 15. Deck API (in-memory) ──');

test('InMemoryDeckStore: save, update, delete', () => {
  const store = (() => {
    let nextId = 1;
    const data = new Map();
    return {
      getForUser(uid) { return data.get(uid) || []; },
      save({ userId, deckId, name, cards, archetype }) {
        const decks = [...(data.get(userId)||[])];
        if (deckId) {
          const idx = decks.findIndex(d => d.id === deckId);
          if (idx < 0) return null;
          decks[idx] = { ...decks[idx], name, cards, archetype };
          data.set(userId, decks); return decks[idx];
        }
        const d = { id: nextId++, userId, name, cards: cards||[], archetype: archetype||null };
        decks.push(d); data.set(userId, decks); return d;
      },
      delete(deckId, userId) { data.set(userId, (data.get(userId)||[]).filter(d => d.id !== deckId)); }
    };
  })();
  const d1 = store.save({ userId: 1, name: 'Test', cards: ['campfire'] });
  assert(d1.id === 1 && d1.name === 'Test', 'deck saved');
  const d2 = store.save({ userId: 1, name: 'Test2', cards: [] });
  assert(store.getForUser(1).length === 2, 'two decks');
  const upd = store.save({ userId: 1, deckId: 1, name: 'Updated', cards: [] });
  assert(upd.name === 'Updated', 'updated');
  store.delete(1, 1);
  assert(store.getForUser(1).length === 1, 'deleted');
  assert(store.getForUser(1)[0].id === 2, 'correct deck remains');
});

test('InMemoryDeckStore: users isolated', () => {
  const data = new Map(); let nextId = 1;
  const save = ({ userId, name }) => {
    const d = { id: nextId++, userId, name };
    data.set(userId, [...(data.get(userId)||[]), d]); return d;
  };
  const get = uid => data.get(uid) || [];
  save({ userId: 1, name: 'Alice' });
  save({ userId: 2, name: 'Bob' });
  assert(get(1).length === 1 && get(2).length === 1, 'isolated');
  assert(get(99).length === 0, 'empty for stranger');
});


runAsyncTests().then(() => {
  console.log(`\n${'─'.repeat(52)}`);
  console.log(`  ${passed} passed, ${failed} failed  (${passed+failed} total)`);
  console.log(failed === 0 ? '  🎉 ALL TESTS PASSED' : `  ❌ ${failed} FAILING`);
  process.exit(failed > 0 ? 1 : 0);
});
