'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge ELO Ladder  —  server/ladder/elo.js
// ═══════════════════════════════════════════════════════════

const K = 32; // ELO K-factor

/**
 * Calculate expected score for player A.
 */
function expected(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new ratings after a match.
 * @returns {{ deltaA: number, deltaB: number, newA: number, newB: number }}
 */
function calcElo(ratingA, ratingB, winner /* 'A' | 'B' */) {
  const expA   = expected(ratingA, ratingB);
  const scoreA = winner === 'A' ? 1 : 0;
  const deltaA = Math.round(K * (scoreA - expA));
  const deltaB = -deltaA;
  return {
    deltaA,
    deltaB,
    newA: Math.max(0, ratingA + deltaA),
    newB: Math.max(0, ratingB + deltaB),
  };
}

// ── Match store (in-memory; swap for PostgreSQL) ──────────
class MatchStore {
  constructor() {
    this.matches = new Map(); // matchId → match record
  }

  save(record) {
    this.matches.set(record.matchId, { ...record, savedAt: new Date() });
  }

  get(matchId) {
    return this.matches.get(matchId) || null;
  }

  /** Recent N matches (newest first) */
  recent(limit = 20) {
    return [...this.matches.values()]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, limit);
  }

  /** Matches for a specific user (by userId) */
  forUser(userId, limit = 50) {
    return [...this.matches.values()]
      .filter(m => m.playerA.userId === userId || m.playerB.userId === userId)
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, limit);
  }
}

const matchStore = new MatchStore();

/**
 * Called when a ranked match ends.
 * Updates ratings in the UserStore and records the match.
 *
 * @param {object} result — from GameRoom.onGameOver callback
 * @param {object} userStore — the auth UserStore instance
 * @returns {{ deltaA, deltaB, newA, newB }}
 */
function processMatchResult(result, userStore, externalMatchStore) {
  const pA = result.playerA;
  const pB = result.playerB;

  // Guests don't have persistent ratings
  const aIsGuest = pA.isGuest;
  const bIsGuest = pB.isGuest;

  let eloResult = { deltaA: 0, deltaB: 0, newA: pA.rating, newB: pB.rating };

  if (!aIsGuest && !bIsGuest) {
    eloResult = calcElo(pA.rating || 1000, pB.rating || 1000, result.winner);
    userStore.updateRating(pA.userId, eloResult.deltaA);
    userStore.updateRating(pB.userId, eloResult.deltaB);
  }

  // Record match for replay (use external store if provided, else internal)
  const store = externalMatchStore || matchStore;
  store.save({
    matchId:      result.matchId,
    playerA:      { userId: pA.userId, username: pA.username, ratingBefore: pA.rating || 1000 },
    playerB:      { userId: pB.userId, username: pB.username, ratingBefore: pB.rating || 1000 },
    winner:       result.winner,
    eloA:         eloResult.deltaA,
    eloB:         eloResult.deltaB,
    actions:      result.actions || [],
    duration:     result.duration || 0,
    createdAt:    new Date(result.createdAt || Date.now()).toISOString(),
    ranked:       !aIsGuest && !bIsGuest,
  });

  return eloResult;
}

module.exports = { calcElo, processMatchResult, matchStore };
