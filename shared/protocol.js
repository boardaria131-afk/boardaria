'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Multiplayer Protocol  — shared/protocol.js
//  Used by BOTH server and client (no Node-specific imports)
// ═══════════════════════════════════════════════════════════

// ── Client → Server ────────────────────────────────────────
const C2S = {
  // Auth
  REGISTER:       'register',       // { username, password }
  LOGIN:          'login',          // { username, password }
  GUEST_LOGIN:    'guest_login',    // {}
  AUTH_TOKEN:     'auth_token',     // { token }

  // Lobby
  QUEUE_JOIN:     'queue_join',     // { deck: string[] }
  QUEUE_LEAVE:    'queue_leave',    // {}
  ROOM_CREATE:    'room_create',    // { deck: string[] }
  ROOM_JOIN:      'room_join',      // { code, deck: string[] }
  SPECTATE:       'spectate',       // { matchId }

  // In-game
  PLAYER_ACTION:  'player_action',  // { type, payload }
  CHAT_MSG:       'chat_msg',       // { text }
  PLAY_VS_BOT:    'play_vs_bot',    // { deck?: string[] }

  // Misc
  PING:           'ping',
  RESIGN:         'resign',   // {} — forfeit current match
};

// ── Server → Client ────────────────────────────────────────
const S2C = {
  // Auth
  AUTH_OK:        'auth_ok',        // { user: { id, username, rating } }
  AUTH_ERR:       'auth_err',       // { reason }

  // Lobby
  QUEUE_STATUS:   'queue_status',   // { position, estimatedWait }
  MATCH_FOUND:    'match_found',    // { matchId, opponent: { username, rating } }

  // Game lifecycle
  GAME_START:     'game_start',     // { matchId, yourPlayer, opponentName, initialState }
  STATE_UPDATE:   'state_update',   // { state, lastAction, seq }
  ACTION_INVALID: 'action_invalid', // { reason, seq }
  GAME_OVER:      'game_over',      // { winner, reason, eloChange, matchId }
  MATCH_REJOINED: 'match_rejoined', // { matchId } — sent on successful reconnect
  OPPONENT_DISCONNECTED: 'opponent_disconnected', // { username, graceSecs }
  OPPONENT_RECONNECTED:  'opponent_reconnected',  // { username }

  // Spectator
  SPECTATE_START: 'spectate_start', // { matchId, state, players }
  SPECTATE_UPDATE:'spectate_update',// { state, lastAction }

  // Room
  ROOM_CREATED:   'room_created',   // { code }
  ROOM_JOINED:    'room_joined',    // { matchId, opponent }
  ROOM_ERROR:     'room_error',     // { reason }

  // Timer
  TIMER_UPDATE:   'timer_update',   // { ap, secsLeft, totalSecs }

  // Chat
  CHAT_MSG:       'chat_msg',       // { from, text, ts }

  // Misc
  PONG:           'pong',
  ERROR:          'error',          // { reason }
};

// ── Action types (player_action.type) ──────────────────────
const ACTION = {
  // Mulligan phase
  MULLIGAN_CONFIRM:   'mulligan_confirm',   // { keep: number[] }  (indices to keep)

  // Land placement (mandatory once per turn via the power wheel)
  PLACE_LAND:         'place_land',         // { cardId, q, r, s }
  PLACE_LAND_N:       'place_land_N',       // { positions: [{q,r,s},{q,r,s}] } (2× Prairie)
  SHIFTING_TIDE:      'shifting_tide',      // { srcQ,srcR,srcS, dstQ,dstR,dstS }

  // Power-wheel actions (lobDone → one per turn)
  WHEEL_DRAW:         'wheel_draw',         // {}  — draw 1 card
  WHEEL_BOOST:        'wheel_boost',        // {}  — +1 mana this turn (boostUsed)
  WHEEL_LAND:         'wheel_land',         // { landType, q, r, s }  (coloured land from wheel)

  // Playing cards
  PLAY_UNIT:          'play_unit',          // { cardId, q, r, s }
  PLAY_STRUCTURE:     'play_structure',     // { cardId, q, r, s }
  PLAY_INSTANT:       'play_instant',       // { cardId, q, r, s }
  PLAY_INSTANT_NOTARGET: 'play_instant_notarget', // { cardId }

  // Unit actions
  MOVE_UNIT:          'move_unit',          // { unitId, q, r, s }
  ATTACK_UNIT:        'attack_unit',        // { unitId, targetId }
  ATTACK_BASE:        'attack_base',        // { unitId }
  USE_GIFT:           'use_gift',           // { unitId, q, r, s }  (target cell or -1,-1,-1)
  DASH:               'dash',              // { unitId, q, r, s }

  // Multi-step interactions (server sends pending_input back)
  DISCOVER_PICK:      'discover_pick',      // { chosenId }
  CHOOSE_ONE:         'choose_one',         // { choiceIndex }
  OCTOPUS_PICK:       'octopus_pick',       // { unitId1, unitId2 }
  WHEEL_OF_CHAOS_TARGET: 'woc_target',     // { unitId }
  FLAME_BURST_TARGET: 'flame_burst_target',// { q, r, s }
  SPIRIT_SPICE_TARGET:'spirit_spice_target',// { unitId }

  // Turn control
  END_TURN:           'end_turn',           // {}
};

// ── Pending-input types (server → client: what to do next) ─
const PENDING = {
  GIFT:            'gift',          // { unitId }
  DASH:            'dash',          // { unitId }
  DISCOVER:        'discover',      // { cards: [id, id, id] }
  CHOOSE_ONE:      'choose_one',    // { options: [{icon,label}] }
  OCTOPUS:         'octopus',       // {}
  WHEEL_OF_CHAOS:  'woc',           // {}
  FLAME_BURST:     'flame_burst',   // {}
  SPIRIT_SPICE:    'spirit_spice',  // {}
};

if (typeof module !== 'undefined') {
  module.exports = { C2S, S2C, ACTION, PENDING };
}
