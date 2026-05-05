# Server-Integration: D&D Auth

Die D&D-App nutzt **REST** für Login/Register/Verify.
Folgende Endpunkte müssen in `server/index.js` ergänzt werden:

## Was hinzufügen

```js
// ── D&D App Auth-Endpunkte ────────────────────────────────────────────────
// Direkt nach deinen bestehenden app.use(cors(...)) / app.use(express.json()) Zeilen

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hexforge-dev-secret-CHANGE-IN-PROD';

// Token prüfen (GET /api/auth/verify)
app.get('/api/auth/verify', (req, res) => {
  const auth  = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Kein Token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ id: decoded.userId, username: decoded.username, isGuest: false });
  } catch {
    res.status(401).json({ error: 'Ungültiger Token' });
  }
});

// Login (POST /api/auth/login)  — nutzt dein bestehendes Auth-System
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  try {
    // authLogin kommt aus deinem auth/auth.js — passe den Pfad an
    const { authLogin } = require('./auth/auth');
    const result = await authLogin(username, password);
    if (!result) return res.status(401).json({ error: 'Falsche Anmeldedaten' });
    res.json({ user: { id: result.userId, username, isGuest: false }, token: result.token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Registrierung (POST /api/auth/register)
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  try {
    const { authRegister } = require('./auth/auth');
    const result = await authRegister(username, password);
    res.status(201).json({ user: { id: result.userId, username, isGuest: false }, token: result.token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
```

## Falls auth/auth.js andere Funktionsnamen hat

Passe `authLogin` / `authRegister` an deine tatsächlichen Exports an.
Die D&D-App erwartet als Antwort:
```json
{ "user": { "id": 42, "username": "Alice", "isGuest": false }, "token": "eyJ..." }
```

## Kein Server nötig für Gast-Modus
Ohne Login funktioniert die App vollständig als Gast (localStorage only).
