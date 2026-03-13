'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge — Game Room
//  One instance per active match.
//  Owns the authoritative game state S.
// ═══════════════════════════════════════════════════════════

const { mkState, mkDefaultDeck } = require('../engine/game-engine');
const { validateAction }         = require('../engine/action-validator');
const { applyAction }            = require('../engine/action-handler');
const { S2C, ACTION, PENDING }   = require('../../shared/protocol');
const uuidv4 = () => require('crypto').randomUUID();

class GameRoom {
  /**
   * @param {object} opts
   * @param {object} opts.playerA  { socketId, userId, username, rating, deck }
   * @param {object} opts.playerB  { socketId, userId, username, rating, deck }
   * @param {object} opts.io       Socket.IO server instance
   * @param {function} opts.onGameOver  callback(result)
   */
  constructor({ playerA, playerB, io, onGameOver }) {
    this.id         = uuidv4();
    this.io         = io;
    this.onGameOver = onGameOver;

    // Map: socket.id → 'A' | 'B'
    this.socketToPlayer = {
      [playerA.socketId]: 'A',
      [playerB.socketId]: 'B',
    };
    this.playerInfo = {
      A: playerA,
      B: playerB,
    };

    // Spectators: Set of socket IDs
    this.spectators = new Set();

    // Action log for replays
    this.actionLog  = [];
    this.seq        = 0;

    // Initialize game state
    this.S = mkState({
      deckA:   playerA.deck || mkDefaultDeck('A'),
      deckB:   playerB.deck || mkDefaultDeck('B'),
      nameA:   playerA.username,
      nameB:   playerB.username,
    });

    // Mulligan tracking
    this.mulliganDone = { A: false, B: false };

    this.createdAt  = Date.now();
    this.finishedAt = null;
  }

  // ── Socket room name ──────────────────────────────────────
  get roomName() { return `match:${this.id}`; }

  // ── Start the match (send game_start to both players) ─────
  start() {
    // Both players join the socket.io room
    for (const [sockId, player] of Object.entries(this.socketToPlayer)) {
      const sock = this.io.sockets.sockets.get(sockId);
      if (sock) sock.join(this.roomName);
    }

    // Send personalised game_start to each player
    for (const [sockId, player] of Object.entries(this.socketToPlayer)) {
      const info = this.playerInfo[player];
      const opp  = player === 'A' ? 'B' : 'A';
      this.io.to(sockId).emit(S2C.GAME_START, {
        matchId:      this.id,
        yourPlayer:   player,
        opponentName: this.playerInfo[opp].username,
        opponentRating: this.playerInfo[opp].rating,
        // Send state filtered for this player (hide opponent hand)
        state: this._stateForPlayer(player),
      });
    }

    // Begin mulligan phase — both players simultaneously
    this.S._mulliganPhase = 'BOTH';
    this.mulliganDone = { A: false, B: false };
    this._broadcastMulliganPrompt('A');
    this._broadcastMulliganPrompt('B');
  }

  // ── Handle incoming action from a player ──────────────────
  handleAction(socketId, action) {
    const player = this.socketToPlayer[socketId];
    if (!player) return this._sendError(socketId, 'not in this match');

    // Rate-limit: ignore if game already over
    if (this.S.winner) return;

    // Mulligan is a special phase handled separately
    if (this.S._mulliganPhase) {
      return this._handleMulligan(socketId, player, action);
    }

    // Validate
    const validation = validateAction(this.S, action, player);
    if (!validation.ok) {
      this.seq++;
      return this.io.to(socketId).emit(S2C.ACTION_INVALID, {
        reason: validation.reason,
        seq:    this.seq,
      });
    }

    // Log the action
    this.actionLog.push({
      seq:       ++this.seq,
      player,
      action,
      timestamp: Date.now(),
    });

    // Apply
    const result = applyAction(this.S, action, player);

    // Check win condition
    if (this.S.winner) {
      this._broadcastState(action);
      return this._endGame(this.S.winner);
    }

    // Broadcast updated state
    this._broadcastState(action);

    // If there's a pending input requirement, notify the acting player
    if (result.pendingInput) {
      this._sendPendingInput(socketId, player, result.pendingInput);
    }
  }

  // ── Mulligan handling ─────────────────────────────────────
  _handleMulligan(socketId, player, action) {
    if (action.type !== ACTION.MULLIGAN_CONFIRM) {
      return this._sendError(socketId, 'mulligan phase: only mulligan_confirm allowed');
    }
    if (this.mulliganDone[player]) {
      return; // already confirmed, ignore duplicate
    }

    const { replaceIds = [] } = action.payload || {};
    const { doMulligan } = require('../engine/game-engine');
    doMulligan(this.S, player, replaceIds);
    this.mulliganDone[player] = true;

    // Send updated hand to this player immediately
    const sock = this._socketFor(player);
    if (sock) {
      this.io.to(sock).emit(S2C.STATE_UPDATE, {
        state: this._stateForPlayer(player),
        lastAction: action,
        seq: ++this.seq,
        pendingInput: this.mulliganDone[player === 'A' ? 'B' : 'A']
          ? null
          : { type: 'mulligan_waiting' },
      });
    }

    // Both done — start the game
    if (this.mulliganDone.A && this.mulliganDone.B) {
      delete this.S._mulliganPhase;
      this._startFreePhase();
    }
  }

  _broadcastMulliganPrompt(player) {
    const sockId = this._socketFor(player);
    if (sockId) {
      this.io.to(sockId).emit(S2C.STATE_UPDATE, {
        state: this._stateForPlayer(player),
        pendingInput: { type: 'mulligan', handSize: this.S.players[player].hand.length },
        seq: ++this.seq,
      });
    }
  }

  _startFreePhase() {
    // Run initial DRAW and MANA phases for player A
    const { runDrawPhase, runManaPhase } = require('../engine/action-handler');
    runDrawPhase(this.S);
    runManaPhase(this.S);
    this._broadcastState({ type: 'game_started' });
  }

  // ── Add/remove spectator ──────────────────────────────────
  addSpectator(socketId) {
    this.spectators.add(socketId);
    const sock = this.io.sockets.sockets.get(socketId);
    if (sock) sock.join(this.roomName);
    this.io.to(socketId).emit(S2C.SPECTATE_START, {
      matchId:  this.id,
      state:    this._stateForSpectator(),
      players:  {
        A: { username: this.playerInfo.A.username, rating: this.playerInfo.A.rating },
        B: { username: this.playerInfo.B.username, rating: this.playerInfo.B.rating },
      },
    });
  }

  removeSpectator(socketId) {
    this.spectators.delete(socketId);
    const sock = this.io.sockets.sockets.get(socketId);
    if (sock) sock.leave(this.roomName);
  }

  // ── Public: resend full state (used on reconnect) ────────
  sendState(socketId, player) {
    this.io.to(socketId).emit(S2C.STATE_UPDATE, {
      state:       this._stateForPlayer(player),
      lastAction:  { type: 'reconnect' },
      seq:         this.seq,
      reconnected: true,
    });
  }

  // ── State broadcasting ────────────────────────────────────
  _broadcastState(lastAction) {
    this.seq++;
    // Each player gets a personalised state (opponent hand hidden)
    for (const [sockId, player] of Object.entries(this.socketToPlayer)) {
      this.io.to(sockId).emit(S2C.STATE_UPDATE, {
        state:      this._stateForPlayer(player),
        lastAction,
        seq:        this.seq,
      });
    }
    // Spectators get full state (both hands visible)
    if (this.spectators.size > 0) {
      this.io.to(this.roomName).emit(S2C.SPECTATE_UPDATE, {
        state:      this._stateForSpectator(),
        lastAction,
        seq:        this.seq,
      });
    }
  }

  _sendPendingInput(socketId, player, pending) {
    this.io.to(socketId).emit(S2C.STATE_UPDATE, {
      pendingInput: pending,
      seq:          this.seq,
    });
  }

  // ── State projection (hide opponent's hand) ───────────────
  _serializeUnits(units) {
    // Convert Set-based kw fields to Arrays for JSON transport
    const out = {};
    for (const [id, u] of Object.entries(units)) {
      out[id] = {
        ...u,
        kw: u.kw instanceof Set ? [...u.kw] : (Array.isArray(u.kw) ? u.kw : []),
        // Strip non-serializable callbacks (functions)
        onDeath: null, onCombat: null, onTurnStart: null, onAttack: null,
        onAttackGod: null, onGift: null, onProd: null, onFriendlyAttacksGod: null,
        onFriendlyYakDeath: null, onEnemyDies: null, onFriendlyDies: null,
        onAdjDies: null, onDraw: null, onEventPlayed: null, onManaSelect: null,
        onSummon: null, onHarvestOppWell: null, onSelfHarvest: null,
        onDamageReceived: null, onGodDamaged: null, onMove: null,
      };
    }
    return out;
  }

  _stateForPlayer(player) {
    const opp = player === 'A' ? 'B' : 'A';
    return {
      ...this.S,
      units: this._serializeUnits(this.S.units),
      players: {
        ...this.S.players,
        // Replace opponent hand with count-only
        [opp]: {
          ...this.S.players[opp],
          hand:     this.S.players[opp].hand.map(() => ({ id: '??', buff: {} })),
          handSize: this.S.players[opp].hand.length,
          // Hide deck contents
          deck: [],
          deckSize: this.S.players[opp].deck.length,
        },
        // Own deck also hidden (count only)
        [player]: {
          ...this.S.players[player],
          deck: [],
          deckSize: this.S.players[player].deck.length,
        },
      },
    };
  }

  _stateForSpectator() {
    // Spectators see everything except deck contents
    return {
      ...this.S,
      units: this._serializeUnits(this.S.units),
      players: {
        A: { ...this.S.players.A, deck: [], deckSize: this.S.players.A.deck.length },
        B: { ...this.S.players.B, deck: [], deckSize: this.S.players.B.deck.length },
      },
    };
  }

  // ── Game over ─────────────────────────────────────────────
  _endGame(winner) {
    this.finishedAt = Date.now();
    const duration  = Math.floor((this.finishedAt - this.createdAt) / 1000);

    const result = {
      matchId:   this.id,
      winner,
      loser:     winner === 'A' ? 'B' : 'A',
      playerA:   this.playerInfo.A,
      playerB:   this.playerInfo.B,
      actions:   this.actionLog,
      duration,
      createdAt: this.createdAt,
    };

    // Broadcast to players
    for (const [sockId, player] of Object.entries(this.socketToPlayer)) {
      const won = player === winner;
      this.io.to(sockId).emit(S2C.GAME_OVER, {
        winner,
        reason:    'hp_depleted',
        youWon:    won,
        matchId:   this.id,
        eloChange: null, // filled in by ladder after ELO calc
      });
    }

    // Notify spectators
    this.io.to(this.roomName).emit(S2C.GAME_OVER, {
      winner,
      matchId: this.id,
    });

    if (this.onGameOver) this.onGameOver(result);
  }

  // ── Helpers ───────────────────────────────────────────────
  _socketFor(player) {
    return Object.keys(this.socketToPlayer).find(k => this.socketToPlayer[k] === player);
  }

  _sendError(socketId, reason) {
    this.io.to(socketId).emit(S2C.ERROR, { reason });
  }

  // Replay data
  getReplayData() {
    return {
      matchId:      this.id,
      playerA:      { username: this.playerInfo.A.username, rating: this.playerInfo.A.rating },
      playerB:      { username: this.playerInfo.B.username, rating: this.playerInfo.B.rating },
      actions:      this.actionLog,
      initialState: null, // set at room creation if you want full replay support
      duration:     this.finishedAt ? Math.floor((this.finishedAt - this.createdAt) / 1000) : null,
      createdAt:    new Date(this.createdAt).toISOString(),
    };
  }
}

module.exports = { GameRoom };
