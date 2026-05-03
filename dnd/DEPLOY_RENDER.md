# D&D App → boardaria-1.onrender.com integrieren
Stack: Express 4 + Socket.IO + JWT + pg

## Was du tust: 1 Ordner kopieren + 1 Zeile einfügen.

══════════════════════════════════════════════════════════════
 SCHRITT 1 — dnd/-Ordner in dein Repo kopieren
══════════════════════════════════════════════════════════════

Entpacke das ZIP. Kopiere den dnd/-Ordner direkt neben deine server.js:

  dein-repo/
  ├── server.js        ← unverändert (außer 1 Zeile)
  ├── package.json
  └── dnd/             ← NEU, direkt hier rein


══════════════════════════════════════════════════════════════
 SCHRITT 2 — 1 Zeile in server.js einfügen
══════════════════════════════════════════════════════════════

Öffne deine server.js. Füge diese Zeile ein, NACHDEM du app erstellt hast
und BEVOR deine /api/* Routes kommen:

─── server.js (Ausschnitt) ────────────────────────────────────

  const express = require('express');
  const http    = require('http');
  const { Server } = require('socket.io');
  const cors    = require('cors');
  const path    = require('path');    // ← falls noch nicht da: hinzufügen

  const app    = express();
  const server = http.createServer(app);
  const io     = new Server(server, { ... });

  app.use(cors({ ... }));
  app.use(express.json());

  // ↓↓↓ DIESE ZEILE EINFÜGEN ↓↓↓
  app.use('/dnd', express.static(path.join(__dirname, 'dnd')));
  // ↑↑↑ FERTIG ↑↑↑

  app.use('/api/auth',    authRoutes);
  app.use('/api/decks',   deckRoutes);
  app.use('/api/matches', matchRoutes);
  // ... rest bleibt unverändert

───────────────────────────────────────────────────────────────


══════════════════════════════════════════════════════════════
 SCHRITT 3 — Pushen
══════════════════════════════════════════════════════════════

  git add dnd/
  git add server.js
  git commit -m "feat: D&D 5e Charakterbogen unter /dnd"
  git push

Render deployt automatisch (~30 Sekunden).

→ Erreichbar unter: https://boardaria-1.onrender.com/dnd/


══════════════════════════════════════════════════════════════
 Warum das sicher ist (kein Konflikt mit deinem Stack)
══════════════════════════════════════════════════════════════

• express.static('/dnd') greift NUR auf Anfragen unter /dnd/* zu
• /api/auth, /api/decks, /api/matches → vollständig unberührt
• Socket.IO auf /socket.io/* → vollständig unberührt
• D&D App macht KEINE Anfragen an deine API oder Datenbank
• Eigener LocalStorage-Namespace (kein Konflikt mit Boardaria)
• Eigener Service Worker Scope: /dnd/ (isoliert)


══════════════════════════════════════════════════════════════
 Troubleshooting
══════════════════════════════════════════════════════════════

404 auf /dnd/
  → dnd/-Ordner liegt nicht neben server.js? Pfad prüfen:
     console.log(path.join(__dirname, 'dnd'))  // in server.js temporär

Schriftarten fehlen beim ersten Aufruf offline
  → Einmal online aufrufen, dann werden sie gecacht

Service Worker Warnung in Console
  → Einmal Hard-Reload: Ctrl+Shift+R / Cmd+Shift+R

