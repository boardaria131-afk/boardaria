'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge — Action Validator
//  validateAction(S, action, player) → { ok, reason }
//
//  This is the anti-cheat layer. Every action from a client
//  is checked here before being applied.
// ═══════════════════════════════════════════════════════════

const {
  cardData, canPlay, unitAt, validMoves, validAtks,
  adjPlace, cK, inB, isWell, isBaseA, isBaseB,
  isUnitCard, isStructureCard, isInstantCard, isLandCard,
  isDivine, PHASES, BASE_A, BASE_B, HAND_MAX,
} = require('./game-engine');

const { ACTION } = require('../../shared/protocol');

/**
 * Master validator — routes to per-action checks.
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateAction(S, action, player) {
  if (!action || typeof action.type !== 'string') {
    return fail('invalid action format');
  }

  // Only the active player may act (except mulligan which has its own phase)
  if (action.type !== ACTION.MULLIGAN_CONFIRM) {
    if (S.winner) return fail('game already over');
    if (player !== S.ap) return fail('not your turn');
  }

  switch (action.type) {
    case ACTION.MULLIGAN_CONFIRM:    return validateMulligan(S, action, player);
    case ACTION.PLACE_LAND:          return validatePlaceLand(S, action, player);
    case ACTION.PLACE_LAND_N:        return validatePlaceLandN(S, action, player);
    case ACTION.SHIFTING_TIDE:       return validateShiftingTide(S, action, player);
    case ACTION.WHEEL_DRAW:          return validateWheelDraw(S, action, player);
    case ACTION.WHEEL_BOOST:         return validateWheelBoost(S, action, player);
    case ACTION.WHEEL_LAND:          return validateWheelLand(S, action, player);
    case ACTION.PLAY_UNIT:           return validatePlayCard(S, action, player);
    case ACTION.PLAY_STRUCTURE:      return validatePlayCard(S, action, player);
    case ACTION.PLAY_INSTANT:        return validatePlayInstant(S, action, player);
    case ACTION.PLAY_INSTANT_NOTARGET: return validatePlayInstantNoTarget(S, action, player);
    case ACTION.MOVE_UNIT:           return validateMove(S, action, player);
    case ACTION.ATTACK_UNIT:         return validateAttackUnit(S, action, player);
    case ACTION.ATTACK_BASE:         return validateAttackBase(S, action, player);
    case ACTION.USE_GIFT:            return validateGift(S, action, player);
    case ACTION.DASH:                return validateDash(S, action, player);
    case ACTION.DISCOVER_PICK:       return validateDiscoverPick(S, action, player);
    case ACTION.CHOOSE_ONE:          return validateChooseOne(S, action, player);
    case ACTION.OCTOPUS_PICK:        return validateOctopusPick(S, action, player);
    case ACTION.WHEEL_OF_CHAOS_TARGET: return validateWocTarget(S, action, player);
    case ACTION.FLAME_BURST_TARGET:  return validateFlameBurstTarget(S, action, player);
    case ACTION.SPIRIT_SPICE_TARGET: return validateSpiritSpiceTarget(S, action, player);
    case ACTION.END_TURN:            return validateEndTurn(S, action, player);
    default: return fail(`unknown action type: ${action.type}`);
  }
}

// ── Helpers ───────────────────────────────────────────────

function ok()         { return { ok: true }; }
function fail(reason) { return { ok: false, reason }; }

function requireFreePhase(S) {
  if (S.phase !== 'FREE') return fail('not in FREE phase');
  return null;
}

function requireCard(S, player, cardId) {
  const hand = S.players[player].hand;
  if (!hand.some(e => e.id === cardId)) return fail('card not in hand');
  const cd = cardData(cardId);
  if (!cd) return fail('unknown card');
  return null;
}

function validCoord(q, r, s) {
  return typeof q === 'number' && typeof r === 'number' && typeof s === 'number';
}

// ── Per-action validators ─────────────────────────────────

function validateMulligan(S, action, player) {
  // _mulliganPhase is 'BOTH' when both players can mulligan simultaneously
  if (!S._mulliganPhase) {
    return fail('not in mulligan phase');
  }
  const { replaceIds = [] } = action.payload || {};
  if (!Array.isArray(replaceIds)) return fail('replaceIds must be an array');
  const hand = S.players[player].hand;
  if (replaceIds.some(id => typeof id !== 'string')) {
    return fail('replaceIds must be card id strings');
  }
  return ok();
}

function validatePlaceLand(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  if (S.lobDone) return fail('land already placed this turn');
  const { cardId, q, r, s } = action.payload || {};
  if (!validCoord(q, r, s)) return fail('invalid coordinates');
  const err2 = requireCard(S, player, cardId); if (err2) return err2;
  const cd = cardData(cardId);
  if (!isLandCard(cd)) return fail('not a land card');
  if (!inB(q, r, s)) return fail('out of bounds');
  const cell = S.cells[cK(q, r)];
  if (!cell || cell.type !== 'EMPTY') return fail('cell not empty');
  // Must be adjacent to own land or base
  const valid = adjPlace(S, player);
  if (!valid.some(([vq, vr]) => vq === q && vr === r)) return fail('not adjacent to own territory');
  return ok();
}

function validatePlaceLandN(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  if (S.lobDone) return fail('land already placed this turn');
  const { positions } = action.payload || {};
  if (!Array.isArray(positions) || positions.length !== 2) return fail('need exactly 2 positions');
  for (const { q, r, s } of positions) {
    if (!validCoord(q, r, s) || !inB(q, r, s)) return fail('invalid coordinates');
    const cell = S.cells[cK(q, r)];
    if (!cell || cell.type !== 'EMPTY') return fail('cell not empty');
  }
  const valid = adjPlace(S, player).map(([vq, vr]) => cK(vq, vr));
  for (const { q, r } of positions) {
    if (!valid.includes(cK(q, r))) return fail('not adjacent to own territory');
  }
  return ok();
}

function validateShiftingTide(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  const err2 = requireCard(S, player, 'shifting_tide'); if (err2) return err2;
  const { srcQ, srcR, srcS, dstQ, dstR, dstS } = action.payload || {};
  if (!validCoord(srcQ, srcR, srcS) || !validCoord(dstQ, dstR, dstS)) return fail('invalid coords');
  const srcCell = S.cells[cK(srcQ, srcR)];
  if (!srcCell || srcCell.type !== 'LAND') return fail('source must be a land');
  const dstCell = S.cells[cK(dstQ, dstR)];
  if (!dstCell || dstCell.type !== 'EMPTY') return fail('destination must be empty');
  // Must be adjacent
  const dist = Math.max(Math.abs(srcQ-dstQ), Math.abs(srcR-dstR), Math.abs(srcS-dstS));
  if (dist !== 1) return fail('destination must be adjacent to source');
  return ok();
}

function validateWheelDraw(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  if (S.lobDone) return fail('lobDone already used');
  if (S.players[player].hand.length >= HAND_MAX) return fail('hand full');
  return ok();
}

function validateWheelBoost(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  if (S.lobDone) return fail('lobDone already used');
  if (S.players[player].boostUsed) return fail('boost already used this turn');
  return ok();
}

function validateWheelLand(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  if (S.lobDone) return fail('lobDone already used');
  const { landType, q, r, s } = action.payload || {};
  const validTypes = ['W', 'F', 'M', 'D', 'N'];
  if (!validTypes.includes(landType)) return fail('invalid land type');
  if (!validCoord(q, r, s) || !inB(q, r, s)) return fail('invalid coords');
  const cell = S.cells[cK(q, r)];
  if (!cell || cell.type !== 'EMPTY') return fail('cell not empty');
  const valid = adjPlace(S, player);
  if (!valid.some(([vq, vr]) => vq === q && vr === r)) return fail('not adjacent to own territory');
  return ok();
}

function validatePlayCard(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  const { cardId, q, r, s } = action.payload || {};
  if (!validCoord(q, r, s)) return fail('invalid coordinates');
  const err2 = requireCard(S, player, cardId); if (err2) return err2;
  if (!canPlay(S, player, cardId)) return fail('cannot play card (cost or land req)');
  if (!inB(q, r, s)) return fail('out of bounds');
  // Placement cell must be valid
  const cell = S.cells[cK(q, r)];
  if (!cell) return fail('no cell');
  return ok();
}

function validatePlayInstant(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  const { cardId, q, r, s } = action.payload || {};
  const err2 = requireCard(S, player, cardId); if (err2) return err2;
  if (!canPlay(S, player, cardId)) return fail('cannot play card');
  if (!validCoord(q, r, s) || !inB(q, r, s)) return fail('invalid target');
  return ok();
}

function validatePlayInstantNoTarget(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  const { cardId } = action.payload || {};
  const err2 = requireCard(S, player, cardId); if (err2) return err2;
  if (!canPlay(S, player, cardId)) return fail('cannot play card');
  return ok();
}

function validateMove(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  const { unitId, q, r, s } = action.payload || {};
  const u = S.units[unitId];
  if (!u) return fail('unit not found');
  if (u.own !== player) return fail('not your unit');
  if (u.q === null) return fail('unit not on board');
  if (u.moved) return fail('unit already moved');
  if (u.summonSick) return fail('unit has summoning sickness');
  if (!validCoord(q, r, s)) return fail('invalid coords');
  const moves = validMoves(S, unitId);
  if (!moves.some(([mq, mr]) => mq === q && mr === r)) return fail('invalid move target');
  return ok();
}

function validateAttackUnit(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  const { unitId, targetId } = action.payload || {};
  const u = S.units[unitId];
  if (!u) return fail('attacker not found');
  if (u.own !== player) return fail('not your unit');
  if (u.q === null) return fail('unit not on board');
  if (u.atked) return fail('unit already attacked');
  if (u.summonSick && !u.kw.has('haste')) return fail('summoning sickness');
  const target = S.units[targetId];
  if (!target) return fail('target not found');
  if (target.own === player) return fail('cannot attack own unit');
  if (target.q === null) return fail('target not on board');
  const atks = validAtks(S, unitId);
  if (!atks.some(t => t.id === targetId)) return fail('target out of range');
  return ok();
}

function validateAttackBase(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  const { unitId } = action.payload || {};
  const u = S.units[unitId];
  if (!u) return fail('unit not found');
  if (u.own !== player) return fail('not your unit');
  if (u.q === null) return fail('unit not on board');
  if (u.atked) return fail('unit already attacked');
  if (u.summonSick && !u.kw.has('haste')) return fail('summoning sickness');
  // Must be in range of enemy base
  const atks = validAtks(S, unitId);
  const opp = player === 'A' ? 'B' : 'A';
  const [bq, br, bs] = opp === 'A' ? BASE_A : BASE_B;
  if (!atks.some(t => t.q === bq && t.r === br)) return fail('base out of range');
  return ok();
}

function validateGift(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  const { unitId, q, r, s } = action.payload || {};
  const u = S.units[unitId];
  if (!u) return fail('unit not found');
  if (u.own !== player) return fail('not your unit');
  if (u.q === null) return fail('unit not on board');
  if (u.summonSick) return fail('summoning sickness');
  if (!u.pendingGift) return fail('no pending gift');
  if (q !== undefined && !validCoord(q, r, s)) return fail('invalid target coords');
  return ok();
}

function validateDash(S, action, player) {
  const err = requireFreePhase(S); if (err) return err;
  const { unitId, q, r, s } = action.payload || {};
  const u = S.units[unitId];
  if (!u) return fail('unit not found');
  if (u.own !== player) return fail('not your unit');
  if (!u.pendingDash || u.pendingDash <= 0) return fail('no pending dash');
  if (!validCoord(q, r, s)) return fail('invalid coords');
  return ok();
}

function validateDiscoverPick(S, action, player) {
  if (!S._discoverQueue || S._discoverQueue.length === 0) return fail('no discover pending');
  const top = S._discoverQueue[0];
  if (top.p !== player) return fail('not your discover');
  const { chosenId } = action.payload || {};
  if (!top.pool.includes(chosenId)) return fail('chosen card not in pool');
  return ok();
}

function validateChooseOne(S, action, player) {
  if (!S._pendingChooseOne || S._pendingChooseOne.p !== player) return fail('no choose-one pending');
  const { choiceIndex } = action.payload || {};
  if (typeof choiceIndex !== 'number' || choiceIndex < 0) return fail('invalid choice index');
  if (choiceIndex >= (S._pendingChooseOne.options?.length || 0)) return fail('choice out of range');
  return ok();
}

function validateOctopusPick(S, action, player) {
  if (!S._pendingOctopus || S._pendingOctopus.p !== player) return fail('no octopus pending');
  const { unitId1, unitId2 } = action.payload || {};
  const u1 = S.units[unitId1], u2 = S.units[unitId2];
  if (!u1 || !u2) return fail('invalid units');
  if (unitId1 === unitId2) return fail('must pick two different units');
  return ok();
}

function validateWocTarget(S, action, player) {
  if (!S._pendingWoc || S._pendingWoc !== player) return fail('no WoC pending');
  const { unitId } = action.payload || {};
  const u = S.units[unitId];
  if (!u) return fail('unit not found');
  if (u.own === player) return fail('cannot target own unit');
  if (u.q === null) return fail('unit not on board');
  if ((u.atk || 0) > 5) return fail('unit attack too high (>5)');
  return ok();
}

function validateFlameBurstTarget(S, action, player) {
  if (!S._pendingFlameBurst || S._pendingFlameBurst !== player) return fail('no flame burst pending');
  const { q, r, s } = action.payload || {};
  if (!validCoord(q, r, s)) return fail('invalid coords');
  return ok();
}

function validateSpiritSpiceTarget(S, action, player) {
  if (S._pendingSpiritSpice !== player) return fail('no spirit spice pending');
  const { unitId } = action.payload || {};
  const u = S.units[unitId];
  if (!u) return fail('unit not found');
  if (u.own !== player) return fail('not your unit');
  if (u.q === null) return fail('unit not on board');
  if (isDivine(u)) return fail('cannot target divine unit');
  return ok();
}

function validateEndTurn(S, action, player) {
  if (S.phase !== 'FREE') return fail('not in FREE phase');
  if (S._discoverQueue && S._discoverQueue.length > 0) return fail('discover pending');
  if (S._pendingChooseOne) return fail('choose-one pending');
  if (S._pendingOctopus) return fail('octopus pending');
  if (S._pendingWoc) return fail('wheel-of-chaos pending');
  if (S._pendingFlameBurst) return fail('flame burst pending');
  return ok();
}

module.exports = { validateAction };
