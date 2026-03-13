'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Auth  —  server/auth/auth.js
//
//  Handles: register, login, guest, JWT verify
//  Storage: in-memory Map (swap out for PostgreSQL later)
// ═══════════════════════════════════════════════════════════

const crypto  = require('crypto');
const uuidv4  = () => crypto.randomUUID();

// ── Simple bcrypt-like hash using Node's built-in crypto ──
// (avoids native module dependency for portability)
function hashPassword(password) {
  const salt   = crypto.randomBytes(16).toString('hex');
  const hash   = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return check === hash;
}

// ── JWT (manual, no dependency) ───────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'hexforge-dev-secret-CHANGE-IN-PROD';
const JWT_EXPIRY = 7 * 24 * 3600; // 7 days in seconds

function b64url(str) {
  return Buffer.from(str).toString('base64url');
}
function fromB64url(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function signJWT(payload) {
  const header   = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body     = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + JWT_EXPIRY }));
  const sig      = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(fromB64url(body));
    if (payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── In-memory user store ──────────────────────────────────
// Replace this with PostgreSQL queries for production
class UserStore {
  constructor() {
    this.users    = new Map(); // id → user
    this.byName   = new Map(); // username → id
    this.nextId   = 1;
  }

  create({ username, passwordHash, isGuest = false }) {
    const id = this.nextId++;
    const user = {
      id,
      username,
      passwordHash: passwordHash || null,
      isGuest,
      rating:    1000,
      wins:      0,
      losses:    0,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    this.byName.set(username.toLowerCase(), id);
    return user;
  }

  findById(id)       { return this.users.get(id) || null; }
  findByName(name)   { const id = this.byName.get(name.toLowerCase()); return id != null ? this.users.get(id) : null; }
  exists(name)       { return this.byName.has(name.toLowerCase()); }

  updateRating(id, delta) {
    const u = this.users.get(id);
    if (u) {
      u.rating = Math.max(0, u.rating + delta);
      if (delta > 0) u.wins++;
      else if (delta < 0) u.losses++;
    }
  }

  leaderboard(limit = 100) {
    return [...this.users.values()]
      .filter(u => !u.isGuest)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
      .map(u => ({ id: u.id, username: u.username, rating: u.rating, wins: u.wins, losses: u.losses }));
  }
}

const store = new UserStore();

// ── Public sanitized user object ──────────────────────────
function publicUser(u) {
  return { id: u.id, username: u.username, rating: u.rating, wins: u.wins, losses: u.losses, isGuest: u.isGuest };
}

// ── Auth handlers (called from socket handlers) ───────────

function register(username, password) {
  if (!username || username.length < 3 || username.length > 24) {
    return { ok: false, reason: 'Username must be 3–24 characters' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { ok: false, reason: 'Username may only contain letters, digits, _ and -' };
  }
  if (!password || password.length < 6) {
    return { ok: false, reason: 'Password must be at least 6 characters' };
  }
  if (store.exists(username)) {
    return { ok: false, reason: 'Username already taken' };
  }
  const user  = store.create({ username, passwordHash: hashPassword(password) });
  const token = signJWT({ userId: user.id, username: user.username });
  return { ok: true, user: publicUser(user), token };
}

function login(username, password) {
  const user = store.findByName(username);
  if (!user)                             return { ok: false, reason: 'User not found' };
  if (user.isGuest)                      return { ok: false, reason: 'Cannot login to guest account' };
  if (!verifyPassword(password, user.passwordHash)) return { ok: false, reason: 'Wrong password' };
  const token = signJWT({ userId: user.id, username: user.username });
  return { ok: true, user: publicUser(user), token };
}

function guestLogin() {
  // Generate a unique guest name
  let username;
  do { username = `Guest${Math.floor(1000 + Math.random() * 9000)}`; }
  while (store.exists(username));
  const user  = store.create({ username, isGuest: true });
  const token = signJWT({ userId: user.id, username: user.username, guest: true });
  return { ok: true, user: publicUser(user), token };
}

function authFromToken(token) {
  const payload = verifyJWT(token);
  if (!payload) return null;
  const user = store.findById(payload.userId);
  if (!user) return null;
  return publicUser(user);
}

module.exports = {
  register, login, guestLogin, authFromToken,
  store,    // exposed for ladder updates
  signJWT, verifyJWT, publicUser,
};
