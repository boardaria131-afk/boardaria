'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Room Manager  —  server/matchmaking/room-manager.js
//  Tracks all active GameRoom instances.
//  Phase 2: reconnect support + graceful disconnect timer.
// ═══════════════════════════════════════════════════════════

const { GameRoom }   = require('../rooms/game-room');
const { S2C }        = require('../../shared/protocol');

// How long (ms) a player can be disconnected before opponent wins
const RECONNECT_GRACE_MS = 60_000;

class RoomManager {
  constructor(io, onMatchOver) {
    this.io          = io;
    this.onMatchOver = onMatchOver;
    this.rooms       = new Map();  // matchId → GameRoom
    this.codes       = new Map();  // 6-char code → pending
    this.socketToRoom= new Map();  // socketId → matchId
    this.disconnected= new Map();  // userId → { matchId, player, timer }
  }

  createMatch(playerA, playerB) {
    const room = new GameRoom({
      playerA, playerB,
      io: this.io,
      onGameOver: (result) => this._onGameOver(room, result),
    });
    this.rooms.set(room.id, room);
    this.socketToRoom.set(playerA.socketId, room.id);
    this.socketToRoom.set(playerB.socketId, room.id);
    room.start();
    console.log(`[Room] Match ${room.id}: ${playerA.username} vs ${playerB.username}`);
    return room;
  }

  createPrivateRoom(hostPlayer) {
    const code = this._genCode();
    this.codes.set(code, { host: hostPlayer, code, createdAt: Date.now() });
    setTimeout(() => this.codes.delete(code), 10 * 60 * 1000);
    console.log(`[Room] Private room code=${code} host=${hostPlayer.username}`);
    return code;
  }

  joinPrivateRoom(joinerPlayer, code) {
    const pending = this.codes.get(code.toUpperCase());
    if (!pending) return { ok: false, reason: 'Room code not found' };
    if (pending.host.socketId === joinerPlayer.socketId) return { ok: false, reason: 'Cannot join your own room' };
    this.codes.delete(code.toUpperCase());
    const room = this.createMatch(pending.host, joinerPlayer);
    return { ok: true, matchId: room.id };
  }

  handleAction(socketId, action) {
    const matchId = this.socketToRoom.get(socketId);
    if (!matchId) return;
    const room = this.rooms.get(matchId);
    if (room) room.handleAction(socketId, action);
  }

  addSpectator(socketId, matchId) {
    const room = this.rooms.get(matchId);
    if (!room) return { ok: false, reason: 'Match not found' };
    room.addSpectator(socketId);
    return { ok: true };
  }

  removeSpectator(socketId, matchId) {
    const room = this.rooms.get(matchId);
    if (room) room.removeSpectator(socketId);
  }

  // ── Reconnect: player returning with a new socket ────────
  handleReconnect(newSocketId, userId) {
    const pending = this.disconnected.get(userId);
    if (!pending) return { ok: false, reason: 'No active match to rejoin' };

    const room = this.rooms.get(pending.matchId);
    if (!room || room.finishedAt) {
      this.disconnected.delete(userId);
      return { ok: false, reason: 'Match has ended' };
    }

    clearTimeout(pending.timer);
    this.disconnected.delete(userId);

    const player = pending.player;
    const oldSocketId = room.playerInfo[player].socketId;
    delete room.socketToPlayer[oldSocketId];
    room.socketToPlayer[newSocketId] = player;
    room.playerInfo[player].socketId = newSocketId;
    this.socketToRoom.delete(oldSocketId);
    this.socketToRoom.set(newSocketId, room.id);

    const sock = this.io.sockets.sockets.get(newSocketId);
    if (sock) sock.join(room.roomName);

    room.disconnected = room.disconnected || {};
    room.disconnected[player] = false;

    // Notify opponent
    const opp = player === 'A' ? 'B' : 'A';
    this.io.to(room.playerInfo[opp].socketId).emit(S2C.OPPONENT_RECONNECTED, {
      username: room.playerInfo[player].username,
    });

    // Send full state to rejoined player
    room.sendState(newSocketId, player);

    console.log(`[Room] ${room.playerInfo[player].username} reconnected to ${room.id}`);
    return { ok: true, matchId: room.id };
  }

  // ── Cleanup on disconnect ─────────────────────────────────
  handleDisconnect(socketId) {
    const matchId = this.socketToRoom.get(socketId);
    if (matchId) {
      const room = this.rooms.get(matchId);
      if (room) {
        const player = room.socketToPlayer[socketId];
        if (player && !room.S.winner) {
          const userId   = room.playerInfo[player].userId;
          const username = room.playerInfo[player].username;
          room.disconnected = room.disconnected || {};
          room.disconnected[player] = true;

          const opp = player === 'A' ? 'B' : 'A';
          this.io.to(room.playerInfo[opp]?.socketId).emit(S2C.OPPONENT_DISCONNECTED, {
            username,
            graceSecs: RECONNECT_GRACE_MS / 1000,
          });

          if (userId) {
            const timer = setTimeout(() => {
              this.disconnected.delete(userId);
              if (!room.S.winner) {
                room.S.winner = player === 'A' ? 'B' : 'A';
                room._endGame(room.S.winner, 'opponent_disconnected');
              }
            }, RECONNECT_GRACE_MS);
            this.disconnected.set(userId, { matchId, player, timer });
          } else {
            // Guest — forfeit immediately
            room.S.winner = player === 'A' ? 'B' : 'A';
            room._endGame(room.S.winner, 'opponent_disconnected');
          }
        }
      }
    }
    this.socketToRoom.delete(socketId);
  }

  getRoom(matchId)         { return this.rooms.get(matchId) || null; }
  getRoomBySocket(sockId)  { const id = this.socketToRoom.get(sockId); return id ? this.rooms.get(id) : null; }
  listActive()             { return [...this.rooms.values()].filter(r => !r.finishedAt); }
  hasPendingReconnect(uid) { return this.disconnected.has(uid); }

  _onGameOver(room, result) {
    console.log(`[Room] Match ${room.id} over. Winner: ${result.winner}`);
    if (this.onMatchOver) this.onMatchOver(result);
    for (const [uid, info] of this.disconnected.entries()) {
      if (info.matchId === room.id) { clearTimeout(info.timer); this.disconnected.delete(uid); }
    }
    for (const sockId of Object.keys(room.socketToPlayer)) {
      this.socketToRoom.delete(sockId);
    }
    setTimeout(() => this.rooms.delete(room.id), 5 * 60 * 1000);
  }

  _genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.codes.has(code));
    return code;
  }
}

module.exports = { RoomManager };
