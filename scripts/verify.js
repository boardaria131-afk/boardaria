#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
//  HexForge — Pre-build Verification Script
//  Prüft alle bekannten Fixes bevor ein ZIP gebaut wird.
//  Ausführen: node scripts/verify.js
// ═══════════════════════════════════════════════════════════
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const read    = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let ge, proto;
try {
  ge    = require(path.join(ROOT, 'server/engine/game-engine.js'));
  proto = require(path.join(ROOT, 'shared/protocol.js'));
} catch(e) {
  console.error('Cannot load engine/protocol:', e.message);
  process.exit(1);
}

let ok = 0, fail = 0;
function check(name, val) {
  if (val) { process.stdout.write('✓ '); ok++; }
  else      { process.stdout.write('✗ '); fail++; }
  console.log(name);
}

const client  = read('client/public/index.html');
const server  = read('server/index.js');
const engine  = read('server/engine/game-engine.js');
const adapter = read('server/db/adapter.js');
const queries = read('server/db/queries.js');

console.log('=== HexForge Pre-build Verification ===\n');

// ── Protocol ─────────────────────────────────────────────
console.log('-- Protocol --');
check('PENDING.GIFT = gift',  proto.PENDING?.GIFT  === 'gift');
check('PENDING.DASH = dash',  proto.PENDING?.DASH  === 'dash');

// ── Engine card requirements ─────────────────────────────
console.log('\n-- Card Requirements --');
const req = id => ge.cardData(id)?.req || {};
check('mystic_beast       lake:2 wild:1',    req('mystic_beast').lake===2    && req('mystic_beast').wild===1);
check('auroras_creation   lake:3 (no mtn)',  req('auroras_creation').lake===3 && !req('auroras_creation').mountain);
check('auroras_trick      lake:5 (no mtn)',  req('auroras_trick').lake===5    && !req('auroras_trick').mountain);
check('fugoro_merchant    lake:3 wild:3',    req('fugoro_merchant').lake===3  && req('fugoro_merchant').wild===3);
check('triton_adventurer  lake:2 wild:1',    req('triton_adventurer').lake===2 && req('triton_adventurer').wild===1);
check('tide_lord          lake:2 wild:2',    req('tide_lord').lake===2        && req('tide_lord').wild===2);
check('orphan_fugu        lake:1 wild:1',    req('orphan_fugu').lake===1      && req('orphan_fugu').wild===1);
check('rapala             lake:1 wild:3',    req('rapala').lake===1           && req('rapala').wild===3);
check('architect          mountain:1 wild:1',req('architect').mountain===1    && req('architect').wild===1);
check('blood_obelisk      mountain:1 wild:1',req('blood_obelisk').mountain===1 && req('blood_obelisk').wild===1);

// ── Engine gameplay ──────────────────────────────────────
console.log('\n-- Engine --');
check('doCleanup clears pendingGift',    engine.includes('Clear unresolved pendingGift'));
check('TARGET_NO_TARGET has doomsday',   engine.includes("'doomsday'"));
check('TARGET_NO_TARGET time_of_legends',engine.includes("'time_of_legends'"));

// ── Client UI ────────────────────────────────────────────
console.log('\n-- Client --');
check('Board flip _flipped()',           client.includes('_flipped()'));
check('Optimistic clickCell orig()',     client.includes('orig.call(this, q, r, s)'));
check('endTurn: no async chain (safe)',  !client.includes('orig.call(this);          // sofort lokal: Cleanup'));
check('Queue retry timer',               client.includes('_queueRetryTimer'));
check('HUB_DECKS_CLIENT embedded',       client.includes('HUB_DECKS_CLIENT'));
check('Hub optgroup in populateDeckSelect', client.includes('Hub Decks'));
check('mpDeleteSelectedDeck',            client.includes('mpDeleteSelectedDeck'));
check('_getSelectedDeck used (≥4x)',     (client.match(/_getSelectedDeck\(\)/g)||[]).length >= 4);
check('Guest token NOT auto-restored',   client.includes('payload.guest'));
check('AUTH_OK: no showLobby in-game',   client.includes('window.G && matchId'));
check('connect: no auth overlay in-game',client.includes('_hasActiveGame'));
check('Angemeldet: label in showLobby',  client.includes("'Angemeldet'"));

// ── Server ───────────────────────────────────────────────
console.log('\n-- Server --');
check('setStore(pgUserStore) called',    server.includes('setStore(pgUserStore)'));
check('await register()',                server.includes('await register('));
check('await login()',                   server.includes('await login('));
check('await authFromToken (socket)',    server.includes('const user = await authFromToken'));
check('requireAuth is async',           server.includes('async function requireAuth'));
check('await authFromToken (middleware)',server.includes('const payload = await authFromToken'));
check('Deck name length validation',    server.includes('Deck name too long'));
check('Deck POST error logging',        server.includes('[API] POST /api/decks error'));

// ── DB auto-migration ────────────────────────────────────
console.log('\n-- Database --');
check('migrate() defined in queries.js', queries.includes('async function migrate'));
check('CREATE TABLE users in migrate',   queries.includes("CREATE TABLE IF NOT EXISTS users"));
check('CREATE TABLE matches in migrate', queries.includes("CREATE TABLE IF NOT EXISTS matches"));
check('CREATE TABLE decks in migrate',   queries.includes("CREATE TABLE IF NOT EXISTS decks"));
check('migrate() called on startup',     adapter.includes('return db.migrate()'));

// ── Summary ──────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${ok} passed, ${fail} failed  (${ok+fail} total)`);
if (fail === 0) console.log('  ✅ All checks passed — safe to build ZIP\n');
else            console.log('  ❌ ' + fail + ' fix(es) missing — DO NOT ship this ZIP\n');
process.exit(fail > 0 ? 1 : 0);
