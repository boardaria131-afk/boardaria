# HexForge MP — So bringst du das Spiel online

Drei Wege zum Testen. Wähle den einfachsten für deinen Fall.

---

## Option A: Lokal (2 Browser-Tabs, sofort)

Kein Server nötig. Nur für dich selbst.

```bash
# 1. Entpacken & installieren
unzip hexforge-mp-phase3.zip
cd hexforge-mp
npm install

# 2. Starten
npm start
# → http://localhost:3000

# 3. Zwei Tabs öffnen:
#    Tab 1: http://localhost:3000  → als Gast einloggen
#    Tab 2: http://localhost:3000  → als Gast einloggen
#    Beide auf "Find Match" drücken → Spiel startet
```

**Voraussetzungen:** Node.js 18+ installiert (`node --version`)

---

## Option B: fly.io — Kostenlos, öffentlich, 5 Minuten

Die schnellste Methode für öffentliche Beta-Tests. Gratis-Tier reicht für ~50 gleichzeitige Spieler.

### 1. fly.io Konto erstellen
→ https://fly.io  (GitHub-Login möglich, keine Kreditkarte nötig)

### 2. flyctl installieren
```bash
# macOS/Linux:
curl -L https://fly.io/install.sh | sh

# Windows:
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### 3. Einloggen
```bash
flyctl auth login
```

### 4. App deployen
```bash
cd hexforge-mp

# App erstellen (einmalig)
flyctl apps create hexforge-mp
# Falls der Name vergeben ist: flyctl apps create hexforge-mp-DEINNAME

# JWT Secret setzen (wichtig!)
flyctl secrets set JWT_SECRET="$(openssl rand -hex 32)"
# Auf Windows: flyctl secrets set JWT_SECRET="irgendein-geheimes-langes-wort"

# Deployen
flyctl deploy
```

### 5. Fertig!
```
→ https://hexforge-mp.fly.dev
```

Link an Freunde schicken, fertig. Alle können als Gast spielen ohne Account.

### Updates deployen
```bash
flyctl deploy
```

### Logs anschauen (bei Bugs)
```bash
flyctl logs
```

---

## Option C: Render.com — Noch einfacher (Git-Push = Auto-Deploy)

Gut wenn du das Repo auf GitHub hast.

### 1. GitHub Repo anlegen
```bash
cd hexforge-mp
git init
git add .
git commit -m "Initial HexForge MP"
# → Auf github.com neues Repo anlegen, dann:
git remote add origin https://github.com/DEIN-NAME/hexforge-mp.git
git push -u origin main
```

### 2. render.com
1. Geh zu https://render.com → neues Konto (GitHub-Login)
2. "New Web Service" → GitHub Repo auswählen
3. Einstellungen:
   - **Build Command:** `npm install`
   - **Start Command:** `node server/index.js`
   - **Environment:** `Node`
4. Environment Variables hinzufügen:
   - `JWT_SECRET` = `irgendein-geheimes-wort-min-32-zeichen`
   - `NODE_ENV` = `production`
5. Deploy!

→ Kostenlos, schläft nach 15min Inaktivität (erster Request dauert ~30s)

---

## Option D: Docker (VPS / Hetzner / DigitalOcean)

Für mehr Kontrolle und dauerhaften Betrieb.

```bash
# Auf deinem Server:
git clone <dein-repo> hexforge-mp
cd hexforge-mp

# .env Datei erstellen
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

# Starten
docker-compose up -d

# Logs
docker-compose logs -f server
```

→ Läuft auf Port 3000. Nginx als Reverse-Proxy empfohlen für HTTPS.

---

## Wichtige URLs nach dem Deployment

| URL | Beschreibung |
|-----|-------------|
| `/` | Hauptspiel + Lobby |
| `/deckbuilder.html` | Deck Builder (alle 484 Karten) |
| `/api/health` | Server-Status check |
| `/api/leaderboard` | Top-Spieler JSON |
| `/api/matches` | Laufende Spiele |

---

## Für Tester: Was ihr testen sollt

**Grundfunktionen:**
- [ ] Gast-Login funktioniert
- [ ] Account erstellen + Login
- [ ] Matchmaking findet Gegner (2 Tabs)
- [ ] Spiel startet, Mulligans funktionieren
- [ ] Züge ausführen (Karte spielen, bewegen, angreifen)
- [ ] Spiel endet wenn jemand 0 HP hat
- [ ] ELO ändert sich nach dem Spiel

**Deck Builder:**
- [ ] `/deckbuilder.html` öffnen
- [ ] Karten filtern/suchen
- [ ] Deck erstellen (30 Karten)
- [ ] Deck speichern
- [ ] Gespeichertes Deck wird beim Match benutzt

**Robustheit:**
- [ ] Tab schließen während Spiel → Gegner gewinnt nach 30s
- [ ] Tab schließen + wieder öffnen → Reconnect funktioniert
- [ ] Privater Raum (Code teilen)
- [ ] Zuschauer-Modus

**Bugs melden mit:**
1. Was hast du gemacht?
2. Was ist passiert?
3. Was sollte passieren?
4. Browser + OS

---

## Bekannte Einschränkungen (noch nicht implementiert)

- Die Spielfeld-Grafik ist ein einfaches SVG (nicht das polierte Original-Board)
- Replay-Viewer ist Grundversion
- Kein Chat im Spiel
- Kein Redis (nur 1 Server-Instance möglich)

---

## Schnell-Diagnose wenn etwas nicht geht

```bash
# Server läuft?
curl https://deine-app.fly.dev/api/health

# Logs live
flyctl logs --app hexforge-mp

# Lokal: Port bereits belegt?
lsof -i :3000   # macOS/Linux
netstat -ano | findstr :3000  # Windows
```
