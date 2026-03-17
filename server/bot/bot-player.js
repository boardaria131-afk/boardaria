'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Bot Player  v2  —  server/bot/bot-player.js
//
//  Strategie:
//    1. Mulligan: behalte günstige Karten + passende Land-Req
//    2. Wheel: Draw bei kleiner Hand; Land mit Pfad-Bewusstsein
//    3. Karten: Priorität Units > Strukturen > Zauber
//    4. Einheiten platzieren: nahe am Feind, auf eigenen Ländern
//    5. Bewegung: Harvesting + Angriffspositionen
//    6. Angriff: Basis wenn erreichbar, sonst schwächste Einheit
// ═══════════════════════════════════════════════════════════

const { ACTION } = require('../../shared/protocol');
const {
  cardData, adjPlace, validMoves, validAtks, canPlay,
  cK, cDist, isUnitCard, isInstantCard, isLandCard, isStructureCard,
  BASE_A, BASE_B, WELLS,
} = require('../engine/game-engine');

const BOT_THINK_MS          = 600;
const BOT_THINK_JITTER_MS   = 400;
const BOT_END_TURN_GUARD_MS = 9000;

class BotPlayer {
  constructor(player, room, socketId) {
    this.player    = player;
    this.room      = room;
    this.socketId  = socketId;
    this._thinking = false;
    this._endTurnGuard   = null;
    this._lastActionKey  = null;
    this._invalidCount   = 0;
  }

  // ── Lifecycle ──────────────────────────────────────────────
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
      try { fn(); } catch(e) {
        console.error('[Bot] Error:', e.message);
        this._act(ACTION.END_TURN);
      }
    }, BOT_THINK_MS + Math.random() * BOT_THINK_JITTER_MS);
  }
  _act(type, payload = {}) {
    const key = type + JSON.stringify(payload);
    if (key === this._lastActionKey) {
      if (++this._invalidCount >= 2) {
        console.warn('[Bot] Loop detected, forcing END_TURN');
        this._lastActionKey = null; this._invalidCount = 0;
        this.room.handleAction(this.socketId, { type: ACTION.END_TURN, payload: {} });
        return;
      }
    } else { this._lastActionKey = key; this._invalidCount = 0; }
    this.room.handleAction(this.socketId, { type, payload });
  }

  // ── Helper ─────────────────────────────────────────────────
  _myBase()  { return this.player === 'A' ? BASE_A : BASE_B; }
  _oppBase() { return this.player === 'A' ? BASE_B : BASE_A; }

  // Hex-Distanz zwischen zwei [q,r,s]-Arrays
  _dist(a, b) { return cDist(a, b); }

  // Alle eigenen Länder als [{q,r,s}]
  _myLands(S) {
    return Object.entries(S.cells)
      .filter(([, c]) => c.type === 'LAND' && c.owner === this.player)
      .map(([k]) => { const [q,r] = k.split(',').map(Number); return [q,r,-q-r]; });
  }

  // Anzahl eigener Länder eines Typs (F/W/M/D)
  _landCount(S, type) {
    return Object.values(S.cells)
      .filter(c => c.type === 'LAND' && c.owner === this.player && c.landType === type)
      .length;
  }

  // Welcher Land-Typ wird am dringendsten für Karten in der Hand gebraucht?
  _chooseLandType(S) {
    const need = { F:0, W:0, M:0, D:0 };
    const hand = S.players[this.player].hand;
    for (const c of hand) {
      const cd = cardData(c.id);
      if (!cd?.req) continue;
      for (const [lt, cnt] of Object.entries(cd.req)) {
        if (need[lt] !== undefined) {
          const have = this._landCount(S, lt);
          const still_needed = Math.max(0, cnt - have);
          need[lt] += still_needed * (cd.cost || 1);
        }
      }
    }
    // Wähle meistbenötigte; bei Gleichstand: F
    const sorted = Object.entries(need).sort((a,b) => b[1]-a[1]);
    return sorted[0][1] > 0 ? sorted[0][0] : 'F';
  }

  // Score für Land-Platzierung: Pfad Richtung Feind, Wells, Zentrum
  _scoreLandSpot(S, q, r, s) {
    const opp    = this._oppBase();
    const own    = this._myBase();
    const myLands = this._myLands(S);

    // Distanz zur feindlichen Basis (kleiner = besser)
    const distToEnemy = this._dist([q,r,s], opp);

    // Distanz zum nächsten eigenen Land (bevorzuge Erweiterung des Pfades)
    const distToOwn = myLands.length
      ? Math.min(...myLands.map(l => this._dist([q,r,s], l)))
      : 0;

    // Distanz zum nächsten Well
    const distToWell = Math.min(...WELLS.map(w => this._dist([q,r,s], w)));

    // Distanz zur Mitte
    const distToCenter = this._dist([q,r,s], [0,0,0]);

    // Score: Feind-Nähe zählt am meisten, dann Wells, dann Zusammenhalt
    return (
      - distToEnemy * 3          // Richtung Feind
      - distToWell  * 1          // Wells sind gut
      - distToCenter * 0.5       // Zentrum ok
      - distToOwn   * 1.5        // Nicht zu weit von eigenen Ländern entfernen
    );
  }

  // Bestes freies Spielfeld für eine neue Einheit (eigene Länder, frei)
  _bestUnitSpot(S) {
    const opp = this._oppBase();
    const occupied = new Set(
      Object.values(S.units).filter(u => u.q !== null).map(u => cK(u.q, u.r))
    );
    const candidates = this._myLands(S)
      .filter(([q,r]) => !occupied.has(cK(q,r)));

    if (!candidates.length) return null;

    // Sortiere: Feind-Nähe > Zentrum
    candidates.sort((a, b) => {
      const da = this._dist(a, opp);
      const db = this._dist(b, opp);
      return da - db;
    });
    return candidates[0];
  }

  // ── Mulligan ───────────────────────────────────────────────
  _doMulligan(state) {
    const hand = state.players[this.player].hand;
    // Behalte: günstige Karten (cost ≤ 3), oder Karten ohne extreme Req
    const replaceIds = hand
      .filter(c => {
        const cd = cardData(c.id);
        if (!cd) return true;
        if (isLandCard(cd)) return true; // Länderkarten direkt ersetzen
        if ((cd.cost||0) > 5) return true; // zu teuer fürs Mulligan
        return false;
      })
      .map(c => c.id);
    this._act(ACTION.MULLIGAN_CONFIRM, { replaceIds });
  }

  // ── Hauptzug ───────────────────────────────────────────────
  _doTurn(state) {
    const S = state;

    // 1. Power-Wheel (Pflicht, einmal pro Zug)
    if (!S.lobDone) {
      this._doWheel(S);
      return;
    }

    // 2. Karte spielen (mit Priorität)
    if (this._tryPlayCard(S)) return;

    // 3. Bewegen
    if (this._tryMove(S)) return;

    // 4. Angreifen
    if (this._tryAttack(S)) return;

    // 5. Zug beenden
    this._clearGuard();
    this._act(ACTION.END_TURN);
  }

  // ── Power-Wheel ────────────────────────────────────────────
  _doWheel(S) {
    const hand  = S.players[this.player].hand;
    const mana  = S.players[this.player].mana;

    // 1. Karte ziehen wenn Hand leer oder < 3 Karten
    if (hand.length <= 2) {
      this._act(ACTION.WHEEL_DRAW);
      return;
    }

    // 2. Land legen wenn möglich — MIT intelligentem Spot-Scoring
    const spots = adjPlace(S, this.player).filter(([q, r]) => {
      const cell = S.cells[cK(q, r)];
      return cell?.type === 'EMPTY';
    });

    if (spots.length > 0) {
      const landType = this._chooseLandType(S);

      // Bewerte jeden Spot und wähle den besten
      const scored = spots.map(([q,r,s]) => ({
        q, r, s: s ?? -q-r,
        score: this._scoreLandSpot(S, q, r, s ?? -q-r),
      })).sort((a,b) => b.score - a.score);

      const { q, r, s } = scored[0];
      this._act(ACTION.WHEEL_LAND, { landType, q, r, s });
      return;
    }

    // 3. Kein freier Spot → Mana-Boost (wenn viele spielbare Karten) oder Draw
    const playable = hand.filter(c => cardData(c.id) && canPlay(S, this.player, c.id));
    if (playable.length >= 2 || mana < 3) {
      this._act(ACTION.WHEEL_BOOST);
    } else {
      this._act(ACTION.WHEEL_DRAW);
    }
  }

  // ── Karte spielen ─────────────────────────────────────────
  _tryPlayCard(S) {
    const hand = S.players[this.player].hand;
    const playable = hand
      .map(c => ({ ...c, cd: cardData(c.id) }))
      .filter(c => c.cd && !isLandCard(c.cd) && canPlay(S, this.player, c.id));

    if (!playable.length) return false;

    // Prioritäts-Reihenfolge:
    // 1. Units mit guten Stats (atk >= 3) und niedrigem Cost
    // 2. Strukturen
    // 3. Instants / Events
    // Sekundär: höchster (atk+hp)/cost Wert

    const score = (c) => {
      const cd = c.cd;
      const isUnit = isUnitCard(cd) || isStructureCard(cd);
      const isInst = isInstantCard(cd);
      const value  = ((cd.atk||0) + (cd.hp||0)) / Math.max(1, cd.cost||1);
      const unitBonus = isUnit ? 5 : 0;
      const instPenalty = isInst ? -2 : 0;
      return value + unitBonus + instPenalty - (cd.cost||0) * 0.3;
    };

    playable.sort((a,b) => score(b) - score(a));

    for (const { id, cd } of playable) {
      if (isUnitCard(cd) || isStructureCard(cd)) {
        const spot = this._bestUnitSpot(S);
        if (!spot) continue;
        const [q,r,s] = spot;
        this._act(isStructureCard(cd) ? ACTION.PLAY_STRUCTURE : ACTION.PLAY_UNIT,
          { cardId: id, q, r, s });
        return true;
      }

      if (isInstantCard(cd)) {
        // Für gezielte Zauber: versuche gültige Ziel-Position
        const opp = this.player === 'A' ? 'B' : 'A';
        const targets = Object.values(S.units)
          .filter(u => u.q !== null && u.own === opp)
          .sort((a,b) => (a.hp||99) - (b.hp||99));
        if (targets.length) {
          this._act(ACTION.PLAY_INSTANT, { cardId: id, q: targets[0].q, r: targets[0].r, s: targets[0].s ?? -targets[0].q-targets[0].r });
          return true;
        }
        // Kein Ziel → ohne Ziel spielen
        this._act(ACTION.PLAY_INSTANT_NOTARGET, { cardId: id });
        return true;
      }
    }
    return false;
  }

  // ── Bewegen ────────────────────────────────────────────────
  _tryMove(S) {
    const opp  = this._oppBase();
    const oppWells = WELLS; // Alle Wells sind potenzielle Harvesting-Ziele

    const myUnits = Object.values(S.units)
      .filter(u => u.own === this.player && u.q !== null && !u.moved && !u.summonSick);

    for (const u of myUnits) {
      const moves = validMoves(S, u.id);
      if (!moves.length) continue;

      // Ziel-Scoring: Basis > Wells > Fortschritt
      const scored = moves.map(([q,r,s]) => {
        const s3 = s ?? -q-r;
        const distBase  = this._dist([q, r, s3], opp);
        const distWell  = Math.min(...oppWells.map(w => this._dist([q, r, s3], w)));
        const onOppLand = S.cells[cK(q,r)]?.owner && S.cells[cK(q,r)]?.owner !== this.player;
        return {
          q, r, s: s3,
          score: -distBase * 2 - distWell * 1 + (onOppLand ? 3 : 0),
        };
      }).sort((a,b) => b.score - a.score);

      const best = scored[0];
      // Nur bewegen wenn wirklich Fortschritt (näher an Ziel als jetzt)
      const currDist = this._dist([u.q, u.r, -u.q-u.r], opp);
      const newDist  = this._dist([best.q, best.r, best.s], opp);
      if (newDist < currDist || best.score > scored[scored.length-1].score + 1) {
        this._act(ACTION.MOVE_UNIT, { unitId: u.id, q: best.q, r: best.r, s: best.s });
        return true;
      }
    }
    return false;
  }

  // ── Angreifen ─────────────────────────────────────────────
  _tryAttack(S) {
    const myUnits = Object.values(S.units)
      .filter(u => u.own === this.player && u.q !== null && !u.atked && !u.summonSick);

    for (const u of myUnits) {
      const atks = validAtks(S, u.id);
      if (!atks.length) continue;

      // Basis-Angriff bevorzugen
      const base = atks.find(t => t.type === 'base');
      if (base) {
        this._act(ACTION.ATTACK_BASE, { unitId: u.id });
        return true;
      }

      // Sonst: schwächste Einheit angreifen (die wir auch besiegen können)
      const enemies = atks.filter(t => t.type !== 'base');
      if (enemies.length) {
        // Priorisiere: Einheiten die wir töten können (hp <= atk), dann schwächste
        const cd = cardData(u.cid);
        const myAtk = u.atk ?? cd?.atk ?? 0;
        const killable = enemies.filter(e => (e.hp||99) <= myAtk);
        const targets = (killable.length ? killable : enemies)
          .sort((a,b) => (a.hp||99) - (b.hp||99));
        this._act(ACTION.ATTACK_UNIT, { unitId: u.id, targetId: targets[0].id });
        return true;
      }
    }
    return false;
  }

  // ── Pending Inputs ─────────────────────────────────────────
  _handlePending(state, pi) {
    switch (pi.type) {
      case 'mulligan':
        this._doMulligan(state);
        break;
      case 'mulligan_waiting':
        break; // Warte auf Gegner
      case 'discover':
        if (pi.pool?.length) {
          // Wähle Karte mit bestem (atk+hp)/cost Verhältnis
          const best = pi.pool.reduce((b, id) => {
            const cd = cardData(id);
            const v = cd ? ((cd.atk||0)+(cd.hp||0)) / Math.max(1, cd.cost||1) : 0;
            const bcd = cardData(b);
            const bv = bcd ? ((bcd.atk||0)+(bcd.hp||0)) / Math.max(1, bcd.cost||1) : 0;
            return v > bv ? id : b;
          }, pi.pool[0]);
          this._act(ACTION.DISCOVER_PICK, { chosenId: best });
        }
        break;
      case 'choose_one':
        this._act(ACTION.CHOOSE_ONE, { choiceIndex: 0 });
        break;
      case 'gift': {
        // Ziele für Gift: versuche Feind-Einheit, sonst (0,0,0)
        const opp = this.player === 'A' ? 'B' : 'A';
        const target = Object.values(state.units||{})
          .filter(u => u.q !== null && u.own === opp)
          .sort((a,b) => (a.hp||99)-(b.hp||99))[0];
        this._act(ACTION.USE_GIFT, {
          unitId: pi.unitId,
          q: target?.q ?? 0, r: target?.r ?? 0, s: target ? (-target.q-target.r) : 0,
        });
        break;
      }
      case 'dash': {
        const moves = validMoves(state, pi.unitId);
        if (moves.length) {
          const opp = this._oppBase();
          moves.sort((a,b) =>
            this._dist(a, opp) - this._dist(b, opp)
          );
          const [q,r,s] = moves[0];
          this._act(ACTION.DASH, { unitId: pi.unitId, q, r, s: s ?? -q-r });
        } else this._act(ACTION.END_TURN);
        break;
      }
      case 'woc': {
        const targets = Object.values(state.units||{})
          .filter(u => u.q !== null && (u.atk||0) <= 5)
          .sort((a,b) => (a.hp||99)-(b.hp||99));
        if (targets.length)
          this._act(ACTION.WHEEL_OF_CHAOS_TARGET, { unitId: targets[0].id });
        else this._act(ACTION.END_TURN);
        break;
      }
      case 'flame_burst': {
        const opp = this.player === 'A' ? 'B' : 'A';
        const [bq, br] = opp === 'A' ? BASE_A : BASE_B;
        this._act(ACTION.FLAME_BURST_TARGET, { q: bq, r: br, s: -bq-br });
        break;
      }
      case 'spirit_spice': {
        const best = Object.values(state.units||{})
          .filter(u => u.q !== null && u.own === this.player)
          .sort((a,b) => (b.atk||0)-(a.atk||0))[0];
        if (best) this._act(ACTION.SPIRIT_SPICE_TARGET, { unitId: best.id });
        else this._act(ACTION.END_TURN);
        break;
      }
      case 'octopus': {
        const units = Object.values(state.units||{}).filter(u => u.q !== null);
        if (units.length >= 2)
          this._act(ACTION.OCTOPUS_PICK, { unitId1: units[0].id, unitId2: units[1].id });
        else this._act(ACTION.END_TURN);
        break;
      }
      default:
        this._doTurn(state);
    }
  }
}

module.exports = { BotPlayer };
