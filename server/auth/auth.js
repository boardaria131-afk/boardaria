'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Auth  —  server/auth/auth.js
//
//  Handles: register, login, guest, JWT verify
//  Storage: injected store (in-memory OR PostgreSQL)
// ═══════════════════════════════════════════════════════════

const crypto  = require('crypto');

// ── Password hashing (HMAC-SHA256 with random salt) ───────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return check === hash;
}

// ── JWT (manual, no dependency) ───────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'hexforge-dev-secret-CHANGE-IN-PROD';
const JWT_EXPIRY = 30 * 24 * 3600; // 30 days

function b64url(str)     { return Buffer.from(str).toString('base64url'); }
function fromB64url(str) { return Buffer.from(str, 'base64url').toString('utf8'); }

function signJWT(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = b64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY,
  }));
  const sig = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(fromB64url(body));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── In-memory user store (fallback when USE_DB=false) ─────
class InMemoryUserStore {
  constructor() {
    this.users  = new Map();
    this.byName = new Map();
    this.nextId = 1;
  }

  async create({ username, passwordHash, isGuest = false }) {
    const id = this.nextId++;
    const user = {
      id, username,
      passwordHash: passwordHash || null,
      isGuest,
      rating: 1000, wins: 0, losses: 0,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    this.byName.set(username.toLowerCase(), id);
    return user;
  }

  async findById(id)     { return this.users.get(id) || null; }
  async findByName(name) {
    const id = this.byName.get(name.toLowerCase());
    return id != null ? this.users.get(id) : null;
  }
  async exists(name)     { return this.byName.has(name.toLowerCase()); }

  async updateRating(id, newRating, outcome = null) {
    const u = this.users.get(id);
    if (!u) return null;
    u.rating = Math.max(0, newRating);
    if (outcome === 'win')  u.wins++;
    if (outcome === 'loss') u.losses++;
    return u;
  }

  async leaderboard(limit = 100) {
    return [...this.users.values()]
      .filter(u => !u.isGuest)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
      .map(u => ({ id: u.id, username: u.username, rating: u.rating, wins: u.wins, losses: u.losses }));
  }
}

const memStore = new InMemoryUserStore();

// ── Sanitized public user object ──────────────────────────
function publicUser(u) {
  return {
    id:       u.id,
    username: u.username,
    rating:   u.rating,
    wins:     u.wins,
    losses:   u.losses,
    isGuest:  u.isGuest,
  };
}

// ── Auth functions — all async, use injected store ────────
// store is set via setStore() once the DB adapter is ready.
let _store = memStore;

function setStore(store) {
  _store = store;
  console.log('[Auth] Store set:', store === memStore ? 'in-memory' : 'PostgreSQL');
}

async function register(username, password) {
  if (!username || username.length < 3 || username.length > 24)
    return { ok: false, reason: 'Username must be 3–24 characters' };
  if (!/^[a-zA-Z0-9_-]+$/.test(username))
    return { ok: false, reason: 'Username may only contain letters, digits, _ and -' };
  if (!password || password.length < 6)
    return { ok: false, reason: 'Password must be at least 6 characters' };

  const existing = await _store.findByName(username);
  if (existing) return { ok: false, reason: 'Username already taken' };

  const user  = await _store.create({ username, passwordHash: hashPassword(password) });
  const token = signJWT({ userId: user.id, username: user.username });
  return { ok: true, user: publicUser(user), token };
}

async function login(username, password) {
  const user = await _store.findByName(username);
  if (!user)           return { ok: false, reason: 'User not found' };
  if (user.isGuest)    return { ok: false, reason: 'Cannot login to guest account' };
  if (!verifyPassword(password, user.passwordHash))
    return { ok: false, reason: 'Wrong password' };
  const token = signJWT({ userId: user.id, username: user.username });
  return { ok: true, user: publicUser(user), token };
}

async function guestLogin() {
  let username;
  do { username = `Guest${Math.floor(1000 + Math.random() * 9000)}`; }
  while (await _store.findByName(username));
  const user  = await _store.create({ username, isGuest: true });
  const token = signJWT({ userId: user.id, username: user.username, guest: true });
  return { ok: true, user: publicUser(user), token };
}

async function authFromToken(token) {
  const payload = verifyJWT(token);
  if (!payload) return null;
  const user = await _store.findById(payload.userId);
  if (!user) return null;
  return publicUser(user);
}

module.exports = {
  register, login, guestLogin, authFromToken,
  setStore,
  store: memStore,   // exposed for backward compat (ladder/elo.js uses memStore directly)
  signJWT, verifyJWT, publicUser,
  hashPassword, verifyPassword,
};
