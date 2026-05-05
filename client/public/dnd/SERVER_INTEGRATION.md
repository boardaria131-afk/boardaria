# Server-Integration: D&D Auth-Endpunkte

Füge diese ~30 Zeilen in `server/index.js` ein —
direkt nach `app.use(express.json())`, vor deinen bestehenden Routes.

```js
// ─── D&D Charakterbogen Auth ─────────────────────────────────────────────
const jwt = require('jsonwebtoken');   // bereits installiert
const bcrypt = require('bcryptjs');   // bereits installiert
const JWT_SECRET = process.env.JWT_SECRET || 'hexforge-dev-secret-CHANGE-IN-PROD';

// Hilfsfunktion: DB-User suchen (passe Pool-Import an dein Projekt an)
// const { pool } = require('./db');  // oder wie du pg nutzt

// Token prüfen
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

// Login
app.post('/api/dnd/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1', [username]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Falsches Passwort' });
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({ user: { id: user.id, username: user.username, isGuest: false }, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Registrierung
app.post('/api/dnd/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Passwort mind. 6 Zeichen' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
    if (exists.rows.length) return res.status(409).json({ error: 'Username bereits vergeben' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, hash]
    );
    const token = jwt.sign(
      { userId: result.rows[0].id, username },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.status(201).json({ user: { id: result.rows[0].id, username, isGuest: false }, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// ─── Ende D&D Auth ────────────────────────────────────────────────────────
```

## SSO: Automatisch eingeloggt wenn HexForge-Session aktiv

Der `/api/dnd/verify`-Endpunkt akzeptiert **sowohl** den D&D-Token
als auch den HexForge-Token (`hf_token`) — weil beide mit demselben
`JWT_SECRET` signiert sind. Der Browser schaut beim Öffnen von `/dnd/`
zuerst nach dem eigenen Token, dann nach `hf_token`.

**Ergebnis:** Wer bei HexForge eingeloggt ist, ist automatisch auch
in der D&D-App eingeloggt — ohne extra Login.

## Wichtig: Tabellennamen anpassen

Schau kurz wie deine Users-Tabelle heißt:
- `users` → passt direkt
- `dnd_users` → ersetze alle `users` durch `dnd_users`
- Passwort-Feld heißt `password_hash`? → prüfen mit: `\d users` in psql

## Pool-Import

Ersetze `pool` mit deinem tatsächlichen DB-Client, z.B.:
```js
const { pool } = require('./db/pool');
// oder wie du pg in deinem Projekt importierst
```

## Testen (lokal)

```bash
# Login testen
curl -X POST http://localhost:3000/api/dnd/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# Verify testen
curl http://localhost:3000/api/dnd/verify \
  -H "Authorization: Bearer <token-von-oben>"
```
