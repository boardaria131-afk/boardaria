# D&D Server-Integration — vollständiges Snippet

Füge alles in `server/index.js` ein — nach `app.use(express.json())`,
vor den Socket.IO-Block.

```js
// ════════════════════════════════════════════════════════════
// D&D Charakterbogen — Auth + Character Storage + Sharing
// ════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hexforge-dev-secret-CHANGE-IN-PROD';

// ── Auth-Middleware ──────────────────────────────────────────
function requireDndAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId   = decoded.userId || decoded.id;
    req.username = decoded.username;
    next();
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

// ── In-Memory Character Store (Fallback ohne DB) ─────────────
const dndCharStore = new Map(); // userId → [characters]
const dndSharedChars = new Map(); // charId → character

// ── Auth-Endpunkte ────────────────────────────────────────────
app.get('/api/dnd/verify', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Kein Token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ user: { id: decoded.userId, username: decoded.username, isGuest: false } });
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
});

app.post('/api/dnd/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  if (!rateLimiter(`${req.ip}:dnd_login`, 10, 60_000))
    return res.status(429).json({ error: 'Zu viele Versuche' });
  const result = await login(username, password);
  if (!result.ok) return res.status(401).json({ error: result.reason || 'Falsche Anmeldedaten' });
  res.json({ user: { id: result.user.id, username: result.user.username, isGuest: false }, token: result.token });
});

app.post('/api/dnd/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Passwort mind. 6 Zeichen' });
  if (!rateLimiter(`${req.ip}:dnd_register`, 5, 60_000))
    return res.status(429).json({ error: 'Zu viele Versuche' });
  const result = await register(username, password);
  if (!result.ok) return res.status(400).json({ error: result.reason || 'Registrierung fehlgeschlagen' });
  res.json({ user: { id: result.user.id, username: result.user.username, isGuest: false }, token: result.token });
});

// ── Character CRUD (Cross-Device) ────────────────────────────
// GET  /api/dnd/characters       → alle eigenen Charaktere
// POST /api/dnd/characters       → Charakter speichern/updaten
// DELETE /api/dnd/characters/:id → Charakter löschen

app.get('/api/dnd/characters', requireDndAuth, async (req, res) => {
  try {
    if (isUsingDB) {
      const result = await db.query(
        'SELECT data FROM dnd_characters WHERE user_id = $1 ORDER BY updated_at DESC',
        [req.userId]
      );
      return res.json({ characters: result.rows.map(r => r.data) });
    }
  } catch {}
  // Fallback In-Memory
  res.json({ characters: dndCharStore.get(req.userId) || [] });
});

app.post('/api/dnd/characters', requireDndAuth, async (req, res) => {
  const char = req.body;
  if (!char || !char.id) return res.status(400).json({ error: 'Ungültige Daten' });
  char._userId = req.userId;
  char._updatedAt = new Date().toISOString();
  try {
    if (isUsingDB) {
      await db.query(`
        INSERT INTO dnd_characters (id, user_id, data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id, user_id) DO UPDATE SET data = $3, updated_at = NOW()
      `, [char.id, req.userId, JSON.stringify(char)]);
      return res.json({ ok: true });
    }
  } catch {}
  // Fallback In-Memory
  const roster = (dndCharStore.get(req.userId) || []).filter(c => c.id !== char.id);
  roster.unshift(char);
  dndCharStore.set(req.userId, roster.slice(0, 20));
  res.json({ ok: true });
});

app.delete('/api/dnd/characters/:id', requireDndAuth, async (req, res) => {
  try {
    if (isUsingDB) {
      await db.query('DELETE FROM dnd_characters WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]);
      return res.json({ ok: true });
    }
  } catch {}
  const roster = (dndCharStore.get(req.userId) || []).filter(c => c.id !== req.params.id);
  dndCharStore.set(req.userId, roster);
  res.json({ ok: true });
});

// ── Shared Characters (Kampagne) ─────────────────────────────
// GET  /api/dnd/shared           → alle geteilten Charaktere
// POST /api/dnd/shared           → Charakter teilen
// DELETE /api/dnd/shared/:id     → Teilen aufheben

app.get('/api/dnd/shared', requireDndAuth, async (req, res) => {
  try {
    if (isUsingDB) {
      const result = await db.query(
        'SELECT data FROM dnd_characters WHERE is_shared = true ORDER BY shared_at DESC LIMIT 50'
      );
      return res.json({ characters: result.rows.map(r => r.data) });
    }
  } catch {}
  res.json({ characters: [...dndSharedChars.values()] });
});

app.post('/api/dnd/shared', requireDndAuth, async (req, res) => {
  const char = req.body;
  if (!char || !char.id) return res.status(400).json({ error: 'Ungültige Daten' });
  char._ownerId   = req.userId;
  char._ownerName = req.username;
  char._sharedAt  = new Date().toISOString();
  try {
    if (isUsingDB) {
      await db.query(`
        INSERT INTO dnd_characters (id, user_id, data, is_shared, shared_at, updated_at)
        VALUES ($1, $2, $3, true, NOW(), NOW())
        ON CONFLICT (id, user_id) DO UPDATE SET data = $3, is_shared = true, shared_at = NOW()
      `, [char.id, req.userId, JSON.stringify(char)]);
      return res.json({ ok: true });
    }
  } catch {}
  dndSharedChars.set(char.id, char);
  res.json({ ok: true });
});

app.delete('/api/dnd/shared/:id', requireDndAuth, async (req, res) => {
  try {
    if (isUsingDB) {
      await db.query('UPDATE dnd_characters SET is_shared = false WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]);
      return res.json({ ok: true });
    }
  } catch {}
  dndSharedChars.delete(req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════
// Ende D&D Integration
// ════════════════════════════════════════════════════════════
```

## PostgreSQL Tabelle (optional)

Falls USE_DB=true:

```sql
CREATE TABLE IF NOT EXISTS dnd_characters (
  id          TEXT NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        JSONB NOT NULL,
  is_shared   BOOLEAN DEFAULT false,
  shared_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);
CREATE INDEX ON dnd_characters (user_id);
CREATE INDEX ON dnd_characters (is_shared) WHERE is_shared = true;
```

Führe das einmalig in psql aus:
```bash
psql $DATABASE_URL -c "CREATE TABLE IF NOT EXISTS dnd_characters ..."
```
