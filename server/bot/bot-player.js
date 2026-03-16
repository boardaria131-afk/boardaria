'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Bot Player  —  server/bot/bot-player.js
//
//  Regelbasierter KI-Gegner. Wird wie ein normaler Spieler
//  in eine GameRoom eingebunden, hat aber keine echte Socket-
//  Verbindung — Aktionen werden direkt ausgeführt.
//
//  Strategie (greedy):
//    1. Mulligan: behalte günstige Karten (cost ≤ 4), ersetze teure
//    2. Wheel: Draw bei kleiner Hand, sonst Land
//    3. Karten: günstigste spielbare zuerst
//    4. Bewegung: richtung feindliche Basis
//    5. Angriff: Basis > schwache Einheiten
// ═══════════════════════════════════════════════════════════

const { ACTION, PENDING } = require('../../shared/protocol');
const {
  cardData, adjPlace, validMoves, validAtks, canPlay,
  cK, isUnitCard, isInstantCard, isLandCard, isStructureCard,
  BASE_A, BASE_B,
} = require('../engine/game-engine');

const BOT_THINK_MS = 700;   // ms vor jeder Aktion

class BotPlayer {
  /**
   * @param {string}   player    'A' | 'B'
   * @param {GameRoom} room      GameRoom-Instanz
   * @param {string}   socketId  fake socketId in room.socketToPlayer
   */
  constructor(player, room, socketId) {
    this.player    = player;
    this.room      = room;
    this.socketId  = socketId;
    this._thinking = false;
  }

  // Wird von BotGameRoom aufgerufen wenn STATE_UPDATE an diesen Bot ginge
  onStateUpdate(state, pendingInput) {
    if (this._thinking) return;
    if (state.winner)   return;

    if (pendingInput) {
      this._schedule(() => this._handlePending(state, pendingInput));
      return;
    }
    if (state._mulliganPhase) {
      this._schedule(() => this._doMulligan(state));
      return;
    }
    if (state.ap === this.player && state.phase === 'FREE') {
      this._schedule(() => this._doTurn(state));
    }
  }

  _schedule(fn) {
    this._thinking = true;
    setTimeout(() => {
      this._thinking = false;
      try { fn(); } catch(e) { console.error('[Bot] Error in action:', e.message); }
    }, BOT_THINK_MS + Math.random() * 300);
  }

  _act(type, payload = {}) {
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

    // 1. Power-Wheel
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
    this._act(ACTION.END_TURN);
  }

  _doWheel(S) {
    const hand   = S.players[this.player].hand;
    const spots  = adjPlace(S, this.player);
    if (hand.length <= 2) {
      this._act(ACTION.WHEEL_DRAW);
    } else if (spots.length > 0) {
      const [q, r, s] = spots[Math.floor(Math.random() * Math.min(spots.length, 3))];
      this._act(ACTION.WHEEL_LAND, { landType: 'N', q, r, s });
    } else {
      this._act(ACTION.WHEEL_BOOST);
    }
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
      const spots = adjPlace(S, this.player);
      if (!spots.length) return false;
      const [q, r, s] = spots[0];
      this._act(ACTION.PLACE_LAND, { cardId: id, q, r, s });
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
    const myUnits = Object.values(S.units)
      .filter(u => u.own===this.player && u.q!==null && !u.moved && !u.summonSick);
    const [bq,br] = this.player==='A' ? BASE_B : BASE_A;

    for (const u of myUnits) {
      const moves = validMoves(S, u.id);
      if (!moves.length) continue;
      moves.sort((a,b) => Math.abs(a[0]-bq)+Math.abs(a[1]-br) - (Math.abs(b[0]-bq)+Math.abs(b[1]-br)));
      const [q,r,s] = moves[0];
      this._act(ACTION.MOVE_UNIT, { unitId: u.id, q, r, s });
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
    } else if (pi.type === 'discover' && pi.pool?.length) {
      this._act(ACTION.DISCOVER_PICK, { chosenId: pi.pool[0] });
    } else if (pi.type === 'choose_one') {
      this._act(ACTION.CHOOSE_ONE, { choiceIndex: 0 });
    } else if (pi.type === 'gift') {
      // Auto-resolve gift: use null target (many gifts work without target)
      this._act(ACTION.USE_GIFT, { unitId: pi.unitId, q: 0, r: 0, s: 0 });
    } else if (pi.type === 'dash') {
      // Dash: move toward enemy base if possible
      const moves = typeof validMoves === 'function' ? validMoves(state, pi.unitId) : [];
      if (moves.length > 0) {
        const [bq, br] = this.player === 'A'
          ? (typeof BASE_B !== 'undefined' ? BASE_B : [0,3,-3])
          : (typeof BASE_A !== 'undefined' ? BASE_A : [0,-3,3]);
        moves.sort((a,b) => Math.abs(a[0]-bq)+Math.abs(a[1]-br) - (Math.abs(b[0]-bq)+Math.abs(b[1]-br)));
        const [q,r,s] = moves[0];
        this._act(ACTION.DASH, { unitId: pi.unitId, q, r, s });
      }
    } else if (pi.type === 'woc') {
      // Wheel of Chaos: destroy weakest creature
      const targets = Object.values(state.units || {})
        .filter(u => u.q !== null && (u.atk||0) <= 5)
        .sort((a,b) => (a.hp||99)-(b.hp||99));
      if (targets.length) {
        this._act(ACTION.WHEEL_OF_CHAOS_TARGET, { unitId: targets[0].id });
      }
    } else if (pi.type === 'flame_burst') {
      // Flame Burst: target enemy base
      const opp = this.player === 'A' ? 'B' : 'A';
      const [bq, br, bs] = opp === 'A'
        ? (typeof BASE_A !== 'undefined' ? BASE_A : [0,-3,3])
        : (typeof BASE_B !== 'undefined' ? BASE_B : [0,3,-3]);
      this._act(ACTION.FLAME_BURST_TARGET, { q: bq, r: br, s: bs });
    } else if (pi.type === 'spirit_spice') {
      // Spirit Spice: buff our strongest unit
      const myUnits = Object.values(state.units || {})
        .filter(u => u.q !== null && u.own === this.player)
        .sort((a,b) => (b.atk||0)-(a.atk||0));
      if (myUnits.length) {
        this._act(ACTION.SPIRIT_SPICE_TARGET, { unitId: myUnits[0].id });
      }
    } else if (pi.type === 'octopus') {
      // Octopus: swap two random units
      const units = Object.values(state.units || {}).filter(u => u.q !== null);
      if (units.length >= 2) {
        this._act(ACTION.OCTOPUS_PICK, { unitId1: units[0].id, unitId2: units[1].id });
      }
    }
  }
}

module.exports = { BotPlayer };
