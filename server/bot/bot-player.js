'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Bot Player  —  server/bot/bot-player.js
//
//  Regelbasierter KI-Gegner. Wird wie ein normaler Spieler
//  in eine GameRoom eingebunden, hat aber keine echte Socket-
//  Verbindung — Aktionen werden direkt ausgeführt.
//
//  Strategie (greedy):
//    1. Mulligan: behalte günstige Karten (cost ≤ 4)
//    2. Wheel: Draw bei kleiner Hand, sonst farbiges Land (nie N/Prairie)
//    3. Karten: günstigste spielbare zuerst
//    4. Bewegung: Richtung feindliche Basis
//    5. Angriff: Basis > schwache Einheiten
// ═══════════════════════════════════════════════════════════

const { ACTION, PENDING } = require('../../shared/protocol');
const {
  cardData, adjPlace, validMoves, validAtks, canPlay,
  cK, isUnitCard, isInstantCard, isLandCard, isStructureCard,
  BASE_A, BASE_B,
} = require('../engine/game-engine');

const BOT_THINK_MS  = 700;   // ms vor jeder Aktion
const BOT_END_TURN_GUARD_MS = 8000; // Fallback: Zug erzwingen falls Bot hängt

class BotPlayer {
  constructor(player, room, socketId) {
    this.player    = player;
    this.room      = room;
    this.socketId  = socketId;
    this._thinking = false;
    this._endTurnGuard = null;
    this._lastInvalidAction = null; // Track repeated invalid actions to break loops
    this._invalidCount = 0;
  }

  onStateUpdate(state, pendingInput) {
    if (this._thinking) return;
    if (state.winner) { this._clearGuard(); return; }

    if (pendingInput) {
      this._resetGuard(state);
      this._schedule(() => this._handlePending(state, pendingInput));
      return;
    }
    if (state._mulliganPhase) {
      this._schedule(() => this._doMulligan(state));
      return;
    }
    if (state.ap === this.player && state.phase === 'FREE') {
      this._resetGuard(state);
      this._schedule(() => this._doTurn(state));
    }
  }

  // Fallback: if bot is stuck, force end turn
  _resetGuard(state) {
    this._clearGuard();
    this._endTurnGuard = setTimeout(() => {
      if (!state.winner && state.ap === this.player) {
        console.warn('[Bot] Guard triggered — forcing END_TURN');
        this._thinking = false;
        this._act(ACTION.END_TURN);
      }
    }, BOT_END_TURN_GUARD_MS);
  }

  _clearGuard() {
    if (this._endTurnGuard) { clearTimeout(this._endTurnGuard); this._endTurnGuard = null; }
  }

  _schedule(fn) {
    this._thinking = true;
    setTimeout(() => {
      this._thinking = false;
      try { fn(); } catch(e) { console.error('[Bot] Error in action:', e.message); this._act(ACTION.END_TURN); }
    }, BOT_THINK_MS + Math.random() * 300);
  }

  _act(type, payload = {}) {
    // Detect repeated identical invalid actions to avoid infinite loops
    const key = type + JSON.stringify(payload);
    if (key === this._lastInvalidAction) {
      this._invalidCount++;
      if (this._invalidCount >= 2) {
        console.warn('[Bot] Repeated invalid action detected, forcing END_TURN');
        this._lastInvalidAction = null;
        this._invalidCount = 0;
        this.room.handleAction(this.socketId, { type: ACTION.END_TURN, payload: {} });
        return;
      }
    } else {
      this._lastInvalidAction = key;
      this._invalidCount = 0;
    }
    this.room.handleAction(this.socketId, { type, payload });
  }

  // ── Mulligan ───────────────────────────────────────────────
  _doMulligan(state) {
    const hand = state.players[this.player].hand;
    const replaceIds = hand
      .filter(c => { const cd = cardData(c.id); return !cd || (cd.cost||0) > 4; })
      .map(c => c.id);
    this._act(ACTION.MULLIGAN_CONFIRM, { replaceIds });
  }

  // ── Vollständiger Zug ──────────────────────────────────────
  _doTurn(state) {
    const S = state;

    // 1. Power-Wheel (mandatory once per turn)
    if (!S.lobDone) {
      this._doWheel(S);
      return; // next action triggered by STATE_UPDATE
    }

    // 2. Karte spielen
    if (this._tryPlayCard(S)) return;

    // 3. Einheiten bewegen
    if (this._tryMove(S)) return;

    // 4. Angreifen
    if (this._tryAttack(S)) return;

    // 5. Nichts mehr möglich — Zug beenden
    this._clearGuard();
    this._act(ACTION.END_TURN);
  }

  // ── Power-Wheel ────────────────────────────────────────────
  _doWheel(S) {
    const hand  = S.players[this.player].hand;
    const spots = adjPlace(S, this.player).filter(([q, r]) => {
      const cell = S.cells[cK(q, r)];
      return cell && cell.type === 'EMPTY';
    });

    // Draw wenn Hand klein
    if (hand.length <= 2) {
      this._act(ACTION.WHEEL_DRAW);
      return;
    }

    // Land platzieren: wähle Farbe basierend auf Handbedarf
    // Wichtig: NIEMALS 'N' (Prairie) via Wheel — das ist eine Karten-Aktion (2 Felder)
    // Wheel-Land platziert immer genau 1 farbiges Feld (F/W/M/D)
    if (spots.length > 0) {
      const landType = this._chooseLandType(S);
      const idx = Math.floor(Math.random() * Math.min(spots.length, 3));
      const [q, r, s] = spots[idx];
      this._act(ACTION.WHEEL_LAND, { landType, q, r, s });
      return;
    }

    // Keine freien Felder → Mana-Boost
    this._act(ACTION.WHEEL_BOOST);
  }

  // Wählt den sinnvollsten Landtyp basierend auf Karten in der Hand
  _chooseLandType(S) {
    const colorPriority = { F: 0, W: 0, M: 0, D: 0 };
    const hand = S.players[this.player].hand;
    for (const c of hand) {
      const cd = cardData(c.id);
      if (!cd || !cd.req) continue;
      for (const [lt, cnt] of Object.entries(cd.req)) {
        if (colorPriority[lt] !== undefined) colorPriority[lt] += cnt;
      }
    }
    // Nimm die meistbenötigte Farbe; bei Gleichstand: F (Forest, häufig neutral)
    const best = Object.entries(colorPriority).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : 'F';
  }

  _tryPlayCard(S) {
    const hand = S.players[this.player].hand;
    const playable = hand
      .map(c => ({ ...c, cd: cardData(c.id) }))
      .filter(c => c.cd && canPlay(S, this.player, c.id))
      .sort((a, b) => (a.cd.cost||0) - (b.cd.cost||0));

    if (!playable.length) return false;
    const { id, cd } = playable[0];
    const [bq, br]   = this.player === 'A' ? BASE_B : BASE_A;

    if (isLandCard(cd)) {
      const spots = adjPlace(S, this.player).filter(([q, r]) => {
        const cell = S.cells[cK(q, r)];
        return cell && cell.type === 'EMPTY';
      });
      if (!spots.length) return false;
      // For Prairie (land_N) we need 2 spots; use PLACE_LAND_N action
      if (cd.landType === 'N' || id === 'land_N') {
        if (spots.length < 1) return false;
        const pos1 = spots[0];
        const pos2 = spots.length > 1 ? spots[1] : spots[0];
        // Only send PLACE_LAND_N if we have 2 distinct spots
        if (spots.length >= 2) {
          this._act(ACTION.PLACE_LAND_N, {
            positions: [
              { q: pos1[0], r: pos1[1], s: pos1[2] ?? -pos1[0]-pos1[1] },
              { q: pos2[0], r: pos2[1], s: pos2[2] ?? -pos2[0]-pos2[1] },
            ]
          });
        } else {
          // Only 1 spot available — fall back to PLACE_LAND for single tile
          this._act(ACTION.PLACE_LAND, { cardId: id, q: pos1[0], r: pos1[1], s: pos1[2] ?? -pos1[0]-pos1[1] });
        }
        return true;
      }
      const [q, r, s] = spots[0];
      this._act(ACTION.PLACE_LAND, { cardId: id, q, r, s: s ?? -q-r });
      return true;
    }

    if (isUnitCard(cd) || isStructureCard(cd)) {
      const freeLands = Object.entries(S.cells)
        .filter(([, c]) => c.type === 'LAND' && c.owner === this.player)
        .map(([k]) => { const [q,r] = k.split(',').map(Number); return {q,r,s:-q-r}; })
        .filter(({q,r}) => !Object.values(S.units).some(u=>u.q===q&&u.r===r));
      if (!freeLands.length) return false;
      freeLands.sort((a,b) => Math.abs(a.q-bq)+Math.abs(a.r-br) - (Math.abs(b.q-bq)+Math.abs(b.r-br)));
      const {q,r,s} = freeLands[0];
      this._act(isStructureCard(cd) ? ACTION.PLAY_STRUCTURE : ACTION.PLAY_UNIT, { cardId:id, q, r, s });
      return true;
    }

    if (isInstantCard(cd)) {
      this._act(ACTION.PLAY_INSTANT_NOTARGET, { cardId: id });
      return true;
    }

    return false;
  }

  _tryMove(S) {
    const [bq,br] = this.player==='A' ? BASE_B : BASE_A;
    const myUnits = Object.values(S.units)
      .filter(u => u.own===this.player && u.q!==null && !u.moved && !u.summonSick);

    for (const u of myUnits) {
      const moves = validMoves(S, u.id);
      if (!moves.length) continue;
      moves.sort((a,b) => Math.abs(a[0]-bq)+Math.abs(a[1]-br) - (Math.abs(b[0]-bq)+Math.abs(b[1]-br)));
      const [q,r,s] = moves[0];
      this._act(ACTION.MOVE_UNIT, { unitId: u.id, q, r, s: s ?? -q-r });
      return true;
    }
    return false;
  }

  _tryAttack(S) {
    const myUnits = Object.values(S.units)
      .filter(u => u.own===this.player && u.q!==null && !u.atked && !u.summonSick);

    for (const u of myUnits) {
      const atks = validAtks(S, u.id);
      if (!atks.length) continue;
      const base = atks.find(t => t.type==='base');
      if (base) { this._act(ACTION.ATTACK_BASE, { unitId: u.id }); return true; }
      const enemies = atks.filter(t => t.type!=='base');
      if (enemies.length) {
        enemies.sort((a,b) => (a.hp||99)-(b.hp||99));
        this._act(ACTION.ATTACK_UNIT, { unitId: u.id, targetId: enemies[0].id });
        return true;
      }
    }
    return false;
  }

  _handlePending(state, pi) {
    if (pi.type === 'mulligan') {
      this._doMulligan(state);
    } else if (pi.type === 'mulligan_waiting') {
      // Nothing to do — waiting for human to confirm mulligan
    } else if (pi.type === 'discover' && pi.pool?.length) {
      this._act(ACTION.DISCOVER_PICK, { chosenId: pi.pool[0] });
    } else if (pi.type === 'choose_one') {
      this._act(ACTION.CHOOSE_ONE, { choiceIndex: 0 });
    } else if (pi.type === 'gift') {
      this._act(ACTION.USE_GIFT, { unitId: pi.unitId, q: 0, r: 0, s: 0 });
    } else if (pi.type === 'dash') {
      const moves = typeof validMoves === 'function' ? validMoves(state, pi.unitId) : [];
      if (moves.length > 0) {
        const [bq, br] = this.player === 'A' ? BASE_B : BASE_A;
        moves.sort((a,b) => Math.abs(a[0]-bq)+Math.abs(a[1]-br) - (Math.abs(b[0]-bq)+Math.abs(b[1]-br)));
        const [q,r,s] = moves[0];
        this._act(ACTION.DASH, { unitId: pi.unitId, q, r, s: s ?? -q-r });
      }
    } else if (pi.type === 'woc') {
      const targets = Object.values(state.units || {})
        .filter(u => u.q !== null && (u.atk||0) <= 5)
        .sort((a,b) => (a.hp||99)-(b.hp||99));
      if (targets.length) {
        this._act(ACTION.WHEEL_OF_CHAOS_TARGET, { unitId: targets[0].id });
      }
    } else if (pi.type === 'flame_burst') {
      const opp = this.player === 'A' ? 'B' : 'A';
      const [bq, br, bs] = opp === 'A' ? BASE_A : BASE_B;
      this._act(ACTION.FLAME_BURST_TARGET, { q: bq, r: br, s: bs ?? -bq-br });
    } else if (pi.type === 'spirit_spice') {
      const myUnits = Object.values(state.units || {})
        .filter(u => u.q !== null && u.own === this.player)
        .sort((a,b) => (b.atk||0)-(a.atk||0));
      if (myUnits.length) {
        this._act(ACTION.SPIRIT_SPICE_TARGET, { unitId: myUnits[0].id });
      }
    } else if (pi.type === 'octopus') {
      const units = Object.values(state.units || {}).filter(u => u.q !== null);
      if (units.length >= 2) {
        this._act(ACTION.OCTOPUS_PICK, { unitId1: units[0].id, unitId2: units[1].id });
      }
    } else {
      // Unknown pending input — try to continue turn
      this._doTurn(state);
    }
  }
}

module.exports = { BotPlayer };
