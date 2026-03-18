'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge — Matchmaking Queue
//  ELO-based pairing with expanding search window
// ═══════════════════════════════════════════════════════════

const ELO_WINDOW_START  = 100;   // Initial ±100 ELO window
const ELO_WINDOW_EXPAND = 50;    // Expand by 50 every EXPAND_INTERVAL ms
const EXPAND_INTERVAL   = 5000;  // 5 seconds
const MAX_WINDOW        = 800;   // Never exceed ±800 (eventually matches anyone)
const TICK_INTERVAL     = 1000;  // Check for matches every 1s

class MatchmakingQueue {
  /**
   * @param {function} onMatchFound  callback({ playerA, playerB })
   */
  constructor(onMatchFound, onQueueStatus) {
    this.onMatchFound  = onMatchFound;
    this.onQueueStatus = onQueueStatus || null;
    this.queue         = [];  // { entry }[]
    this._timer        = null;
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Add a player to the queue.
   * @param {object} entry { socketId, userId, username, rating, deck }
   */
  enqueue(entry) {
    // Remove if already in queue
    this.dequeue(entry.socketId);
    this.queue.push({
      ...entry,
      joinedAt:    Date.now(),
      windowStart: ELO_WINDOW_START,
    });
    console.log(`[MM] ${entry.username} (${entry.rating}) joined queue. Size: ${this.queue.length}`);
  }

  /**
   * Remove a player from the queue by socketId.
   */
  dequeue(socketId) {
    const before = this.queue.length;
    this.queue = this.queue.filter(e => e.socketId !== socketId);
    if (this.queue.length < before) {
      console.log(`[MM] Socket ${socketId} left queue. Size: ${this.queue.length}`);
    }
  }

  /**
   * Start the matchmaking ticker.
   */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._tick(), TICK_INTERVAL);
    console.log('[MM] Matchmaking started');
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  get size() { return this.queue.length; }

  // ── Internal ──────────────────────────────────────────────

  _tick() {
    const now = Date.now();

    // Expand ELO windows for waiting players
    for (const entry of this.queue) {
      const waited = now - entry.joinedAt;
      const expansions = Math.floor(waited / EXPAND_INTERVAL);
      entry.windowStart = Math.min(
        ELO_WINDOW_START + expansions * ELO_WINDOW_EXPAND,
        MAX_WINDOW,
      );
    }

    // Notify waiting players of queue status (every other tick to reduce noise)
    if (this.queue.length > 0 && this.onQueueStatus) {
      for (const entry of this.queue) {
        const waited = now - entry.joinedAt;
        this.onQueueStatus(entry.socketId, {
          position:  this.queue.indexOf(entry) + 1,
          queueSize: this.queue.length,
          waitedMs:  waited,
        });
      }
    }

    if (this.queue.length < 2) return;

    // Sort by rating for efficient matching
    this.queue.sort((a, b) => a.rating - b.rating);

    const matched = new Set();

    for (let i = 0; i < this.queue.length; i++) {
      if (matched.has(i)) continue;
      const a = this.queue[i];

      for (let j = i + 1; j < this.queue.length; j++) {
        if (matched.has(j)) continue;
        const b = this.queue[j];

        // Don't match same user (multi-tab)
        if (a.userId && a.userId === b.userId) continue;

        const window = Math.min(a.windowStart, b.windowStart);
        if (Math.abs(a.rating - b.rating) <= window) {
          matched.add(i);
          matched.add(j);

          // Randomly assign who is player A/B
          const [pA, pB] = Math.random() < 0.5 ? [a, b] : [b, a];
          console.log(`[MM] Match found: ${pA.username}(${pA.rating}) vs ${pB.username}(${pB.rating})`);
          this.onMatchFound({ playerA: pA, playerB: pB });
          break;
        }
      }
    }

    // Remove matched players
    if (matched.size > 0) {
      this.queue = this.queue.filter((_, i) => !matched.has(i));
    }
  }

  // Status for a specific socket
  getStatus(socketId) {
    const entry = this.queue.find(e => e.socketId === socketId);
    if (!entry) return null;
    const position = this.queue.indexOf(entry) + 1;
    const waited   = Date.now() - entry.joinedAt;
    return {
      position,
      queueSize: this.queue.length,
      waitedMs:  waited,
      window:    entry.windowStart,
    };
  }
}

module.exports = { MatchmakingQueue };
