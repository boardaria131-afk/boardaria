'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge — Action Handler
//  applyAction(S, action, player) → { S, pendingInput? }
//
//  Called AFTER validateAction passes.
//  Returns the mutated state S and optionally a pendingInput
//  descriptor telling the client what input is needed next.
// ═══════════════════════════════════════════════════════════

const {
  cardData, doPlay, doAtk, doGift, doMulligan, doCleanup,
  resolvePendingGift, deal, harvestMana, adjPlace, lg,
  canHarvest, cK, mkUnit, buffUnit, runProduction,
  PHASES, BASE_A, BASE_B, HAND_MAX,
} = require('./game-engine');

const { ACTION, PENDING } = require('../../shared/protocol');

/**
 * Apply a pre-validated action to the game state.
 * Mutates S in place (same pattern as the original engine).
 *
 * @param {object} S      — game state
 * @param {object} action — { type, payload }
 * @param {string} player — 'A' | 'B'
 * @returns {{ pendingInput?: object, phaseAdvance?: string }}
 *   pendingInput: if set, the server must wait for a follow-up action
 *   phaseAdvance: if set, move to this phase after broadcasting
 */
function applyAction(S, action, player) {
  switch (action.type) {
    case ACTION.MULLIGAN_CONFIRM:       return doMulliganAction(S, action, player);
    case ACTION.PLACE_LAND:             return doPlaceLand(S, action, player);
    case ACTION.PLACE_LAND_N:           return doPlaceLandN(S, action, player);
    case ACTION.SHIFTING_TIDE:          return doShiftingTide(S, action, player);
    case ACTION.WHEEL_DRAW:             return doWheelDraw(S, action, player);
    case ACTION.WHEEL_BOOST:            return doWheelBoost(S, action, player);
    case ACTION.WHEEL_LAND:             return doWheelLand(S, action, player);
    case ACTION.PLAY_UNIT:
    case ACTION.PLAY_STRUCTURE:         return doPlayUnit(S, action, player);
    case ACTION.PLAY_INSTANT:
    case ACTION.PLAY_INSTANT_NOTARGET:  return doPlayInstant(S, action, player);
    case ACTION.MOVE_UNIT:              return doMoveUnit(S, action, player);
    case ACTION.ATTACK_UNIT:            return doAttackUnit(S, action, player);
    case ACTION.ATTACK_BASE:            return doAttackBase(S, action, player);
    case ACTION.USE_GIFT:               return doUseGift(S, action, player);
    case ACTION.DASH:                   return doDash(S, action, player);
    case ACTION.DISCOVER_PICK:          return doDiscoverPick(S, action, player);
    case ACTION.CHOOSE_ONE:             return doChooseOne(S, action, player);
    case ACTION.OCTOPUS_PICK:           return doOctopusPick(S, action, player);
    case ACTION.WHEEL_OF_CHAOS_TARGET:  return doWocTarget(S, action, player);
    case ACTION.FLAME_BURST_TARGET:     return doFlameBurstTarget(S, action, player);
    case ACTION.SPIRIT_SPICE_TARGET:    return doSpiritSpiceTarget(S, action, player);
    case ACTION.END_TURN:               return doEndTurn(S, action, player);
    default: return {};
  }
}

// ── Mulligan ──────────────────────────────────────────────

function doMulliganAction(S, action, player) {
  const { replaceIds = [] } = action.payload || {};
  doMulligan(S, player, replaceIds);
  // Don't delete _mulliganPhase here — game-room handles that when both players confirm
  return {};
}

// ── Land placement ────────────────────────────────────────

function doPlaceLand(S, action, player) {
  const { cardId, q, r, s } = action.payload;
  const cd = cardData(cardId);
  S.cells[cK(q, r)] = { type: 'LAND', owner: player, landType: cd.landType };
  S.lobDone = true;
  // Remove card from hand
  const idx = S.players[player].hand.findIndex(e => e.id === cardId);
  if (idx !== -1) S.players[player].hand.splice(idx, 1);
  S.players[player].grave.push(cardId);
  lg(S, player, `${cd.name} placed`);
  return {};
}

function doPlaceLandN(S, action, player) {
  const { positions } = action.payload;
  for (const { q, r, s } of positions) {
    S.cells[cK(q, r)] = { type: 'LAND', owner: player, landType: 'N' };
  }
  S.lobDone = true;
  // Remove one 'land_N' card (or prairie) from hand
  const idx = S.players[player].hand.findIndex(e => {
    const cd = cardData(e.id);
    return cd && cd.landType === 'N';
  });
  if (idx !== -1) {
    const id = S.players[player].hand[idx].id;
    S.players[player].hand.splice(idx, 1);
    S.players[player].grave.push(id);
  }
  lg(S, player, '2× Prairie placed');
  return {};
}

function doShiftingTide(S, action, player) {
  const { srcQ, srcR, srcS, dstQ, dstR, dstS } = action.payload;
  const src = S.cells[cK(srcQ, srcR)];
  S.cells[cK(srcQ, srcR)] = { type: 'EMPTY' };
  S.cells[cK(dstQ, dstR)] = { type: 'LAND', owner: src.owner || player, landType: src.landType };
  S.players[player].mana -= cardData('shifting_tide').cost;
  const idx = S.players[player].hand.findIndex(e => e.id === 'shifting_tide');
  if (idx !== -1) S.players[player].hand.splice(idx, 1);
  S.players[player].grave.push('shifting_tide');
  lg(S, player, 'Shifting Tide: Land moved 1 step');
  return {};
}

// ── Power-wheel actions ───────────────────────────────────

function doWheelDraw(S, action, player) {
  deal(S, player, 1);
  S.lobDone = true;
  lg(S, player, 'Card drawn (wheel action)');
  return {};
}

function doWheelBoost(S, action, player) {
  S.players[player].mana += 1;
  S.players[player].boostUsed = true;
  S.lobDone = true;
  lg(S, player, `+1 Mana Boost → ${S.players[player].mana}`);
  return {};
}

function doWheelLand(S, action, player) {
  const { landType, q, r, s } = action.payload;
  S.cells[cK(q, r)] = { type: 'LAND', owner: player, landType };
  S.lobDone = true;
  lg(S, player, `${landType} land placed (wheel)`);
  return {};
}

// ── Playing cards ────────────────────────────────────────

function doPlayUnit(S, action, player) {
  const { cardId, q, r, s } = action.payload;
  const uid = doPlay(S, player, cardId, q, r, s);
  const result = {};
  // Check for pendingDash
  if (typeof uid === 'string' && S.units[uid]?.pendingDash > 0) {
    result.pendingInput = { type: PENDING.DASH, unitId: uid };
  }
  // Check for pendingGift
  if (typeof uid === 'string' && S.units[uid]?.pendingGift) {
    result.pendingInput = { type: PENDING.GIFT, unitId: uid };
  }
  // Check discover queue
  const disc = checkDiscover(S, player);
  if (disc) result.pendingInput = disc;
  return result;
}

function doPlayInstant(S, action, player) {
  const { cardId, q, r, s } = action.payload;
  // Special-case cards that need interactive follow-up
  if (cardId === 'wheel_of_chaos') {
    doPlay(S, player, cardId, 0, 0, 0);
    if (S._pendingWoc) {
      return { pendingInput: { type: PENDING.WHEEL_OF_CHAOS } };
    }
  } else if (cardId === 'flame_burst_ruby') {
    // Flame burst needs target pick (handled as separate action)
    S._pendingFlameBurst = player;
    return { pendingInput: { type: PENDING.FLAME_BURST } };
  } else {
    doPlay(S, player, cardId, q ?? 0, r ?? 0, s ?? 0);
  }
  const disc = checkDiscover(S, player);
  if (disc) return { pendingInput: disc };
  return {};
}

// ── Unit actions ─────────────────────────────────────────

function doMoveUnit(S, action, player) {
  const { unitId, q, r, s } = action.payload;
  const u = S.units[unitId];
  u.q = q; u.r = r; u.s = s;
  u.moved = true;
  if (u.kw.has('ranged')) u.atked = true; // ranged can't also shoot after moving
  harvestMana(S, player);
  lg(S, player, `${cardData(u.cid)?.name || u.id} moved`);
  if (typeof u.onMove === 'function') {
    try { u.onMove(S, u, q, r, s); } catch (e) { /* swallow */ }
  }
  // Corrupt keyword
  if (u.kw.has('corrupt') && !u._corrupted) {
    const destCell = S.cells[cK(q, r)];
    if (destCell?.type === 'LAND' && destCell.owner && destCell.owner !== player) {
      u._corrupted = true;
      if (typeof u.onCombat === 'function') {
        try { u.onCombat(S, u, null); } catch (e) { /* swallow */ }
      }
    }
  }
  return {};
}

function doAttackUnit(S, action, player) {
  const { unitId, targetId } = action.payload;
  doAtk(S, unitId, 'unit', targetId);
  return {};
}

function doAttackBase(S, action, player) {
  const { unitId } = action.payload;
  const opp = player === 'A' ? 'B' : 'A';
  doAtk(S, unitId, 'base', opp);
  return {};
}

function doUseGift(S, action, player) {
  const { unitId, q, r, s } = action.payload;
  const u = S.units[unitId];
  if (!u) return {};

  // If no pendingGift yet: this is an Activate trigger (structure clicked)
  if (!u.pendingGift) {
    const cd = cardData(u.cid);
    if (cd && typeof cd.onGift === 'function') {
      u.atked = true; // mark as activated this turn
      cd.onGift(S, player, u);
      // If onGift set a pendingGift, send it back to the player
      if (u.pendingGift) {
        return { pendingInput: { type: PENDING.GIFT, unitId } };
      }
      // onGift resolved immediately (e.g. Triton Sanctuary)
      const disc = checkDiscover(S, player);
      if (disc) return { pendingInput: disc };
      return {};
    }
    return {};
  }

  // Normal path: resolve existing pendingGift
  const resolved = resolvePendingGift(S, player, u, q ?? 0, r ?? 0, s ?? 0);
  const disc = checkDiscover(S, player);
  if (disc) return { pendingInput: disc };
  if (u.pendingGift) {
    return { pendingInput: { type: PENDING.GIFT, unitId } };
  }
  return {};
}

function doDash(S, action, player) {
  const { unitId, q, r, s } = action.payload;
  const u = S.units[unitId];
  if (!u) return {};
  u.q = q; u.r = r; u.s = s;
  u.pendingDash = 0;
  u.moved = true;
  harvestMana(S, player);
  lg(S, player, `${cardData(u.cid)?.name || u.id} Dash`);
  // After dash, check for pendingGift
  if (u.pendingGift) {
    return { pendingInput: { type: PENDING.GIFT, unitId } };
  }
  return {};
}

// ── Interactive follow-ups ────────────────────────────────

function doDiscoverPick(S, action, player) {
  const { chosenId } = action.payload;
  const top = S._discoverQueue[0];
  S._discoverQueue.shift();

  const cd = cardData(chosenId);
  if (top.onPick === 'add_to_hand') {
    if (S.players[player].hand.length < HAND_MAX) {
      S.players[player].hand.push({ id: chosenId, buff: { atk: 0, hp: 0 } });
    }
  }
  // Fugoro: buff on discover
  const fuguBuff = cd?.treasure ? 3 : 1;
  Object.values(S.units)
    .filter(u => u.own === player && u.cid === 'fugoro' && u.q !== null)
    .forEach(u => { buffUnit(u, fuguBuff, fuguBuff); });

  // Amai Merchant: other cards go to opponent
  if (top.onPick === 'amai_split') {
    const opp = player === 'A' ? 'B' : 'A';
    top.pool.filter(id => id !== chosenId).forEach(id => {
      if (S.players[opp].hand.length < HAND_MAX) {
        S.players[opp].hand.push({ id, buff: { atk: 0, hp: 0 } });
      }
    });
  }

  lg(S, player, `Discover: "${cd?.name}" added to hand`);

  // More discovers pending?
  if (S._discoverQueue.length > 0 && S._discoverQueue[0].p === player) {
    const next = S._discoverQueue[0];
    return { pendingInput: { type: PENDING.DISCOVER, pool: next.pool, label: next.label } };
  }
  return {};
}

function doChooseOne(S, action, player) {
  const { choiceIndex } = action.payload;
  const pending = S._pendingChooseOne;
  S._pendingChooseOne = null;
  if (pending?.options?.[choiceIndex]?.fn) {
    try { pending.options[choiceIndex].fn(); } catch (e) { /* swallow */ }
  }
  return {};
}

function doOctopusPick(S, action, player) {
  const { unitId1, unitId2 } = action.payload;
  const u1 = S.units[unitId1], u2 = S.units[unitId2];
  if (u1 && u2) {
    // Swap their positions
    const [q1, r1, s1] = [u1.q, u1.r, u1.s];
    u1.q = u2.q; u1.r = u2.r; u1.s = u2.s;
    u2.q = q1;   u2.r = r1;   u2.s = s1;
    lg(S, player, `Octopus: swapped ${cardData(u1.cid)?.name} and ${cardData(u2.cid)?.name}`);
  }
  delete S._pendingOctopus;
  return {};
}

function doWocTarget(S, action, player) {
  const { unitId } = action.payload;
  const u = S.units[unitId];
  if (u && (u.atk || 0) <= 5) {
    const { resolveDeath } = require('./game-engine');
    resolveDeath(S, unitId);
    lg(S, player, `Wheel of Chaos: destroyed ${cardData(u.cid)?.name}`);
  }
  delete S._pendingWoc;
  return {};
}

function doFlameBurstTarget(S, action, player) {
  const { q, r, s } = action.payload;
  const { unitAt, applyDmg, resolveDeath, hurtGod } = require('./game-engine');
  const opp = player === 'A' ? 'B' : 'A';
  const tu = unitAt(S, q, r, s);
  if (tu && !isDivine(tu)) {
    applyDmg(S, tu, 3, null);
    if (tu.hp <= 0) resolveDeath(S, tu.id);
    lg(S, player, `Flame Burst Ruby: 3 to ${cardData(tu.cid)?.name}`);
  } else {
    const [bq, br, bs] = opp === 'A' ? BASE_A : BASE_B;
    if (q === bq && r === br) {
      const { hurtGod: _hurtGod } = require('./game-engine');
      _hurtGod(S, opp, 3);
      lg(S, player, 'Flame Burst Ruby: 3 to base');
    }
  }
  delete S._pendingFlameBurst;
  return {};
}

function doSpiritSpiceTarget(S, action, player) {
  const { unitId } = action.payload;
  const u = S.units[unitId];
  if (u) {
    buffUnit(u, 4, 4);
    u.kw.add('flying');
    if (!u.kw.has('charge:2') && !u.kw.has('charge:3')) u.kw.add('charge:2');
    lg(S, player, `Spirit Spice: ${cardData(u.cid)?.name} +4/+4, Flying, Charge 2`);
  }
  delete S._pendingSpiritSpice;
  return {};
}

// ── End turn ─────────────────────────────────────────────

function doEndTurn(S, action, player) {
  // Auto-grant the lobDone +1 mana if not used
  if (!S.lobDone) {
    S.players[player].mana += 1;
    S.lobDone = true;
    lg(S, player, '+1 Mana (default action)');
  }
  // Run cleanup
  doCleanup(S);
  lg(S, player, '— Round End —');
  // Advance turn
  if (player === 'B') S.turn++;
  S.ap    = player === 'A' ? 'B' : 'A';
  S.phase = 'DRAW';
  S.phaseStep = 0;
  S.lobDone   = false;

  // Auto-run DRAW + MANA phases immediately (server-side)
  runDrawPhase(S);
  runManaPhase(S);

  return { phaseAdvance: 'FREE' };
}

// ── Auto phases (DRAW → MANA → FREE) ─────────────────────

function runDrawPhase(S) {
  if (S.turn > 1) {
    runProduction(S, S.ap);
  }
  if (S.turn === 1) {
    lg(S, S.ap, 'Round 1 — no card draw');
  } else {
    deal(S, S.ap, 1);
    lg(S, S.ap, 'Card drawn');
  }
  S.phase = 'MANA';
}

function runManaPhase(S) {
  const { updWells, harvestMana } = require('./game-engine');
  updWells(S);
  const boost = S.players[S.ap].boostUsed ? 1 : 0;
  S.players[S.ap].boostUsed = false;
  if (S.turn > 1) {
    const { BASE_MANA } = require('./game-engine');
    const inc = BASE_MANA + boost;
    S.players[S.ap].mana += inc;
    harvestMana(S, S.ap);
    lg(S, S.ap, `+${inc} Mana income`);
  } else {
    if (boost) S.players[S.ap].mana += boost;
    lg(S, S.ap, `Starting with ${S.players[S.ap].mana} Mana`);
  }
  S.phase = 'FREE';
  S.lobDone = false;
}

// ── Helpers ───────────────────────────────────────────────

function checkDiscover(S, player) {
  if (S._discoverQueue && S._discoverQueue.length > 0) {
    const top = S._discoverQueue[0];
    if (top.p === player) {
      return { type: PENDING.DISCOVER, pool: top.pool, label: top.label };
    }
  }
  return null;
}

module.exports = { applyAction, runDrawPhase, runManaPhase };
