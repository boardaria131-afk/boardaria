/**
 * map.js — Battlemap mit Grid + Spielfiguren
 * DM lädt Bild hoch, alle sehen Grid + Figuren in Echtzeit
 */

const BattleMap = (() => {

  let _canvas   = null;
  let _ctx      = null;
  let _img      = null;
  let _gridW    = 20;
  let _gridH    = 15;
  let _tokens   = [];    // [{id, name, icon, x, y, color, userId, isMonster}]
  let _fog      = null;  // Set von "x,y" Strings = verborgen; null = kein Fog
  let _fogMode  = false; // DM-Modus: Felder aufdecken
  let _dragging = null;
  let _isDM     = false;
  let _mapData  = null;
  let _pollInterval = null;
  let _lastHash = '';

  const CAMP_KEY = () => {
    const c = JSON.parse(localStorage.getItem('dnd_campaign') || 'null');
    return c ? c.code : null;
  };

  const TOKEN = () => localStorage.getItem('dnd_token');

  // ── API ───────────────────────────────────────────────────────────────────
  async function fetchMap() {
    const code = CAMP_KEY();
    if (!code || !TOKEN()) return null;
    try {
      const r = await fetch('/api/dnd/map?code=' + encodeURIComponent(code), {
        headers: { 'Authorization': 'Bearer ' + TOKEN() },
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  async function pushMap(payload) {
    const code = CAMP_KEY();
    if (!code || !TOKEN()) return false;
    try {
      const r = await fetch('/api/dnd/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN() },
        body: JSON.stringify({ campaignCode: code, ...payload }),
      });
      return r.ok;
    } catch { return false; }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function draw() {
    if (!_canvas || !_ctx) return;
    const W = _canvas.width;
    const H = _canvas.height;
    const cellW = W / _gridW;
    const cellH = H / _gridH;

    // Hintergrund
    _ctx.fillStyle = '#1a1208';
    _ctx.fillRect(0, 0, W, H);

    // Karte
    if (_img) {
      _ctx.drawImage(_img, 0, 0, W, H);
    } else {
      // Platzhalter
      _ctx.fillStyle = '#2a1f10';
      _ctx.fillRect(0, 0, W, H);
      _ctx.fillStyle = 'rgba(201,150,42,0.3)';
      _ctx.font = 'bold 16px Cinzel, serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(_isDM ? 'Karte hochladen →' : 'Warte auf DM...', W/2, H/2);
    }

    // Grid
    _ctx.strokeStyle = 'rgba(201,150,42,0.25)';
    _ctx.lineWidth = 0.5;
    for (let x = 0; x <= _gridW; x++) {
      _ctx.beginPath();
      _ctx.moveTo(x * cellW, 0);
      _ctx.lineTo(x * cellW, H);
      _ctx.stroke();
    }
    for (let y = 0; y <= _gridH; y++) {
      _ctx.beginPath();
      _ctx.moveTo(0, y * cellH);
      _ctx.lineTo(W, y * cellH);
      _ctx.stroke();
    }

    // Grid-Koordinaten (A1, B2...)
    _ctx.fillStyle = 'rgba(201,150,42,0.4)';
    _ctx.font = `${Math.min(cellW, cellH) * 0.25}px Cinzel, serif`;
    _ctx.textAlign = 'left';
    for (let x = 0; x < _gridW; x++) {
      for (let y = 0; y < _gridH; y++) {
        _ctx.fillText(
          String.fromCharCode(65 + x) + (y + 1),
          x * cellW + 2, y * cellH + 10
        );
      }
    }

    // Fog of War (nur für Spieler sichtbar, DM sieht alles)
    if (_fog && !_isDM) {
      for (let x = 0; x < _gridW; x++) {
        for (let y = 0; y < _gridH; y++) {
          if (_fog.has(x + ',' + y)) {
            _ctx.fillStyle = 'rgba(0,0,0,0.85)';
            _ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
          }
        }
      }
    } else if (_fog && _isDM) {
      // DM: verdeckte Felder leicht abdunkeln
      for (let x = 0; x < _gridW; x++) {
        for (let y = 0; y < _gridH; y++) {
          if (_fog.has(x + ',' + y)) {
            _ctx.fillStyle = 'rgba(0,0,0,0.45)';
            _ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
            // Schraffur-Pattern
            _ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            _ctx.lineWidth = 0.5;
            _ctx.beginPath();
            _ctx.moveTo(x * cellW, y * cellH);
            _ctx.lineTo((x+1) * cellW, (y+1) * cellH);
            _ctx.stroke();
          }
        }
      }
    }

    // Tokens
    _tokens.forEach(token => {
      const px = (token.x + 0.5) * cellW;
      const py = (token.y + 0.5) * cellH;
      const r  = Math.min(cellW, cellH) * 0.42;

      // Schatten
      _ctx.shadowColor = token.color || '#c9962a';
      _ctx.shadowBlur = 8;

      // Monster: rautenförmig, Spieler: kreisförmig
      _ctx.beginPath();
      if (token.isMonster) {
        // Raute für Monster
        _ctx.moveTo(px,     py - r);
        _ctx.lineTo(px + r, py    );
        _ctx.lineTo(px,     py + r);
        _ctx.lineTo(px - r, py    );
        _ctx.closePath();
      } else {
        _ctx.arc(px, py, r, 0, Math.PI * 2);
      }
      _ctx.fillStyle = token.color || (token.isMonster ? 'rgba(60,10,10,0.85)' : 'rgba(139,26,26,0.85)');
      _ctx.fill();
      _ctx.strokeStyle = token.isMonster ? '#f87171' : '#fff';
      _ctx.lineWidth = token.isMonster ? 1.5 : 2;
      _ctx.stroke();

      _ctx.shadowBlur = 0;

      // Icon (Emoji)
      _ctx.font = `${r * 1.1}px serif`;
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(token.icon || '⚔', px, py);

      // Name
      _ctx.font = `bold ${Math.max(9, r * 0.45)}px Cinzel, serif`;
      _ctx.fillStyle = '#fff';
      _ctx.textBaseline = 'alphabetic';
      _ctx.shadowColor = '#000';
      _ctx.shadowBlur = 3;
      _ctx.fillText(
        token.name.length > 8 ? token.name.slice(0, 7) + '…' : token.name,
        px, py + r + 10
      );
      _ctx.shadowBlur = 0;
    });
  }

  // ── Canvas Events ─────────────────────────────────────────────────────────
  function canvasToGrid(clientX, clientY) {
    const rect  = _canvas.getBoundingClientRect();
    const scaleX = _canvas.width  / rect.width;
    const scaleY = _canvas.height / rect.height;
    const x = Math.floor(((clientX - rect.left) * scaleX) / (_canvas.width  / _gridW));
    const y = Math.floor(((clientY - rect.top)  * scaleY) / (_canvas.height / _gridH));
    return { x: Math.max(0, Math.min(_gridW - 1, x)), y: Math.max(0, Math.min(_gridH - 1, y)) };
  }

  function getTokenAt(gx, gy) {
    return _tokens.find(t => t.x === gx && t.y === gy);
  }

  let _hoverCell = null;

  function onMouseMove(e) {
    const { x, y } = canvasToGrid(e.clientX, e.clientY);
    if (_hoverCell?.x === x && _hoverCell?.y === y) return;
    _hoverCell = { x, y };

    // Eigene Figur finden
    const user = window.Auth ? window.Auth.getUser() : null;
    const myToken = _tokens.find(t => t.userId === user?.id);
    if (!myToken) return;

    // Nur neu rendern wenn Hover sich ändert
    draw();

    // Reichweite zeichnen
    const W = _canvas.width;
    const H = _canvas.height;
    const cellW = W / _gridW;
    const cellH = H / _gridH;

    // Distanz in Feldern (1 Feld = 5 ft)
    const dx = Math.abs(x - myToken.x);
    const dy = Math.abs(y - myToken.y);
    const dist = Math.max(dx, dy); // Chebyshev-Distanz (D&D 5e)
    const distFt = dist * 5;

    // Linie von Figur zu Hover
    _ctx.setLineDash([4, 4]);
    _ctx.strokeStyle = 'rgba(201,150,42,0.7)';
    _ctx.lineWidth = 1.5;
    _ctx.beginPath();
    _ctx.moveTo((myToken.x + 0.5) * cellW, (myToken.y + 0.5) * cellH);
    _ctx.lineTo((x + 0.5) * cellW, (y + 0.5) * cellH);
    _ctx.stroke();
    _ctx.setLineDash([]);

    // Distanz-Label
    _ctx.fillStyle = 'rgba(26,18,8,0.85)';
    _ctx.fillRect((x + 0.5) * cellW - 28, (y + 0.5) * cellH - 22, 56, 18);
    _ctx.fillStyle = '#c9962a';
    _ctx.font = 'bold 11px Cinzel, serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(distFt + ' ft', (x + 0.5) * cellW, (y + 0.5) * cellH - 13);
  }

  function onPointerDown(e) {
    const touch = e.touches ? e.touches[0] : e;
    const { x, y } = canvasToGrid(touch.clientX, touch.clientY);

    // DM im Fog-Modus: Felder aufdecken/verdecken
    if (_isDM && _fogMode) {
      toggleFog(x, y);
      return;
    }

    const token = getTokenAt(x, y);
    const user = window.Auth ? window.Auth.getUser() : null;
    if (!token) return;
    if (!_isDM && token.userId !== user?.id) return;
    _dragging = { token, startX: x, startY: y };
  }

  function onPointerUp(e) {
    if (!_dragging) return;
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const { x, y } = canvasToGrid(touch.clientX, touch.clientY);

    if (x !== _dragging.startX || y !== _dragging.startY) {
      // Kollisionsprüfung
      const occupied = getTokenAt(x, y);
      if (!occupied || occupied === _dragging.token) {
        _dragging.token.x = x;
        _dragging.token.y = y;
        draw();
        pushMap({ tokens: _tokens }).then(() => {});
      }
    }
    _dragging = null;
  }

  function toggleFog(x, y) {
    if (!_fog) _fog = new Set();
    const key = x + ',' + y;
    if (_fog.has(key)) _fog.delete(key);
    else _fog.add(key);
    draw();
    pushMap({ fog: [..._fog] });
  }

  function setAllFog(covered) {
    if (covered) {
      _fog = new Set();
      for (let x = 0; x < _gridW; x++)
        for (let y = 0; y < _gridH; y++)
          _fog.add(x + ',' + y);
    } else {
      _fog = null;
    }
    draw();
    pushMap({ fog: _fog ? [..._fog] : null });
  }

  function revealAround(x, y, radius = 2) {
    if (!_fog) return;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx*dx + dy*dy <= radius*radius) {
          _fog.delete((x+dx) + ',' + (y+dy));
        }
      }
    }
    draw();
    pushMap({ fog: [..._fog] });
  }

  // ── Init UI ───────────────────────────────────────────────────────────────
  function renderUI() {
    const container = document.getElementById('battlemap-container');
    if (!container) return;

    const user = window.Auth ? window.Auth.getUser() : null;
    _isDM = container.dataset.dm === 'true';

    container.innerHTML = `
      <div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <div style="font-family:var(--font-title);font-size:14px;font-weight:700;color:var(--blood);">
          🗺 Battlemap
        </div>
        <div style="flex:1;"></div>

        ${_isDM ? `
          <label class="btn-secondary" style="font-size:11px;cursor:pointer;padding:5px 12px;">
            📁 Karte laden
            <input type="file" id="map-upload" accept="image/*" style="display:none;" />
          </label>
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:11px;color:#8a7060;">Grid:</span>
            <select id="map-grid-w" style="font-size:11px;padding:3px;">
              ${[10,15,20,25,30].map(n => `<option ${n===_gridW?'selected':''}>${n}</option>`).join('')}
            </select>
            <span style="font-size:11px;color:#8a7060;">×</span>
            <select id="map-grid-h" style="font-size:11px;padding:3px;">
              ${[8,10,12,15,20].map(n => `<option ${n===_gridH?'selected':''}>${n}</option>`).join('')}
            </select>
          </div>
          <!-- Fog of War Controls -->
          <button class="btn-secondary" id="btn-fog-all" style="font-size:11px;" title="Alles verdecken">🌑 FoW</button>
          <button class="btn-secondary" id="btn-fog-clear" style="font-size:11px;" title="Alles aufdecken">☀️ Aufdecken</button>
          <button id="btn-fog-mode" style="font-size:11px;padding:5px 10px;border-radius:4px;cursor:pointer;
            border:1px solid rgba(200,165,90,0.4);background:rgba(200,165,90,0.08);
            color:var(--gold);font-family:var(--font-title);letter-spacing:0.5px;"
            title="Fog of War Pinsel — Klick auf Felder zum Aufdecken/Verdecken">
            🖊 Pinsel: AUS
          </button>
          <!-- Monster-Token -->
          <button class="btn-secondary" id="btn-map-add-monster" style="font-size:11px;">👹 Monster</button>
          <button class="btn-secondary" id="btn-map-clear-tokens" style="font-size:11px;">🗑 Figuren</button>
        ` : ''}

        <button class="btn-secondary" id="btn-map-add-me" style="font-size:11px;">
          ⚔ Meine Figur
        </button>
        <button class="btn-secondary" id="btn-map-refresh" style="font-size:11px;">📡</button>
      </div>

      <!-- Canvas -->
      <div style="position:relative;border:1px solid rgba(200,165,90,0.3);border-radius:6px;overflow:hidden;
        background:#1a1208;touch-action:none;">
        <canvas id="battlemap-canvas"
          style="display:block;width:100%;cursor:crosshair;max-height:500px;"></canvas>
      </div>

      <!-- Token-Liste -->
      <div id="map-token-list" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;"></div>
      <div style="font-size:11px;color:#8a7060;margin-top:6px;">
        💡 Ziehe deine Figur auf das gewünschte Feld
      </div>
    `;

    // Canvas einrichten
    _canvas = document.getElementById('battlemap-canvas');
    const containerW = _canvas.parentElement.clientWidth;
    _canvas.width  = containerW;
    _canvas.height = Math.round(containerW * (_gridH / _gridW));
    _ctx = _canvas.getContext('2d');

    // Events
    _canvas.addEventListener('mousemove', onMouseMove);
    _canvas.addEventListener('mousedown',  onPointerDown);
    _canvas.addEventListener('mouseup',    onPointerUp);
    _canvas.addEventListener('touchstart', e => { e.preventDefault(); onPointerDown(e); }, {passive:false});
    _canvas.addEventListener('touchend',   e => { e.preventDefault(); onPointerUp(e); },   {passive:false});

    // DM-Events
    if (_isDM) {
      document.getElementById('map-upload')?.addEventListener('change', onImageUpload);
      document.getElementById('map-grid-w')?.addEventListener('change', e => {
        _gridW = parseInt(e.target.value);
        resizeCanvas();
        draw();
        pushMap({ gridW: _gridW, gridH: _gridH });
      });
      document.getElementById('map-grid-h')?.addEventListener('change', e => {
        _gridH = parseInt(e.target.value);
        resizeCanvas();
        draw();
        pushMap({ gridW: _gridW, gridH: _gridH });
      });
      document.getElementById('btn-map-clear-tokens')?.addEventListener('click', () => {
        if (confirm('Alle Figuren entfernen?')) {
          _tokens = [];
          draw();
          pushMap({ tokens: [] });
          renderTokenList();
        }
      });
    }

    // Fog of War Events (nur DM)
    if (_isDM) {
      document.getElementById('btn-fog-all')?.addEventListener('click', () => setAllFog(true));
      document.getElementById('btn-fog-clear')?.addEventListener('click', () => setAllFog(false));
      document.getElementById('btn-fog-mode')?.addEventListener('click', () => {
        _fogMode = !_fogMode;
        const btn = document.getElementById('btn-fog-mode');
        if (btn) {
          btn.textContent = _fogMode ? '🖊 Pinsel: AN' : '🖊 Pinsel: AUS';
          btn.style.background = _fogMode ? 'rgba(139,26,26,0.3)' : 'rgba(200,165,90,0.08)';
          btn.style.color = _fogMode ? '#f0a0a0' : 'var(--gold)';
          btn.style.borderColor = _fogMode ? 'var(--blood)' : 'rgba(200,165,90,0.4)';
        }
        _canvas.style.cursor = _fogMode ? 'cell' : 'crosshair';
      });
      document.getElementById('btn-map-add-monster')?.addEventListener('click', showMapMonsterPicker);
    }

    document.getElementById('btn-map-add-me')?.addEventListener('click', addMyToken);
    document.getElementById('btn-map-refresh')?.addEventListener('click', async () => {
      await pullAndUpdate();
      showToast('📡 Karte aktualisiert');
    });

    draw();
    renderTokenList();
  }

  function resizeCanvas() {
    if (!_canvas) return;
    const W = _canvas.parentElement.clientWidth;
    _canvas.width  = W;
    _canvas.height = Math.round(W * (_gridH / _gridW));
  }

  function renderTokenList() {
    const el = document.getElementById('map-token-list');
    if (!el) return;
    const user = window.Auth ? window.Auth.getUser() : null;
    el.innerHTML = _tokens.map(t => `
      <div style="display:flex;align-items:center;gap:4px;padding:4px 8px;
        background:${t.userId===user?.id?'rgba(139,26,26,0.15)':'rgba(255,255,255,0.05)'};
        border:1px solid ${t.userId===user?.id?'var(--blood)':'rgba(200,165,90,0.2)'};
        border-radius:20px;font-size:12px;">
        <span>${t.icon}</span>
        <span style="font-family:var(--font-title);font-size:10px;color:${t.userId===user?.id?'var(--blood)':'#8a7060'};">
          ${t.name}
        </span>
        <span style="font-size:10px;color:#8a7060;">
          ${String.fromCharCode(65+t.x)}${t.y+1}
        </span>
        ${(_isDM || t.userId===user?.id) ? `
        <button onclick="BattleMap.removeToken('${t.id}')"
          style="background:none;border:none;color:rgba(139,26,26,0.5);cursor:pointer;font-size:12px;padding:0;">✕</button>` : ''}
      </div>
    `).join('') || '<span style="font-size:12px;color:#8a7060;font-style:italic;">Noch keine Figuren auf der Karte</span>';
  }

  // ── Monster auf Karte platzieren ─────────────────────────────────────────
  const MAP_MONSTERS = [
    {name:'Goblin',icon:'👺',cr:'1/4'},{name:'Skeleton',icon:'💀',cr:'1/4'},
    {name:'Zombie',icon:'🧟',cr:'1/4'},{name:'Wolf',icon:'🐺',cr:'1/4'},
    {name:'Orc',icon:'💪',cr:'1/2'},{name:'Hobgoblin',icon:'⚔️',cr:'1/2'},
    {name:'Bugbear',icon:'👹',cr:'1'},{name:'Ghoul',icon:'😱',cr:'1'},
    {name:'Ogre',icon:'🏔️',cr:'2'},{name:'Troll',icon:'🌿',cr:'5'},
    {name:'Vampire',icon:'🧛',cr:'5'},{name:'Dragon',icon:'🐉',cr:'7+'},
    {name:'Beholder',icon:'👁',cr:'13'},{name:'Lich',icon:'☠️',cr:'21'},
    {name:'Demon',icon:'😈',cr:'4'},{name:'Wraith',icon:'👻',cr:'5'},
    {name:'Giant',icon:'🗿',cr:'5'},{name:'Werewolf',icon:'🐺',cr:'3'},
    {name:'NPC',icon:'🧙',cr:'–'},{name:'Trap',icon:'⚠️',cr:'–'},
  ];

  function showMapMonsterPicker() {
    showModal('👹 Monster auf Karte platzieren', `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:350px;overflow-y:auto;">
        ${MAP_MONSTERS.map(m => `
          <div class="map-monster-btn" data-name="${m.name}" data-icon="${m.icon}"
            style="display:flex;flex-direction:column;align-items:center;gap:3px;
              padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(200,165,90,0.2);
              border-radius:6px;cursor:pointer;transition:all 0.15s;text-align:center;">
            <span style="font-size:24px;">${m.icon}</span>
            <span style="font-family:var(--font-title);font-size:10px;color:var(--ink);">${m.name}</span>
            <span style="font-size:10px;color:#8a7060;">CR ${m.cr}</span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
        <span style="font-size:12px;color:#8a7060;">Anzahl:</span>
        <input type="number" id="map-monster-count" value="1" min="1" max="10"
          style="width:60px;padding:4px;text-align:center;" />
      </div>
    `);

    document.querySelectorAll('.map-monster-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(139,26,26,0.15)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.05)');
      btn.addEventListener('click', () => {
        const count = parseInt(document.getElementById('map-monster-count')?.value) || 1;
        for (let i = 0; i < count; i++) {
          // Freies Feld finden
          let sx = Math.floor(_gridW / 2), sy = Math.floor(_gridH / 2);
          let attempts = 0;
          while (_tokens.find(t => t.x === sx && t.y === sy) && attempts < 50) {
            sx = (sx + 1) % _gridW;
            if (sx === 0) sy = (sy + 1) % _gridH;
            attempts++;
          }
          _tokens.push({
            id:        'monster_' + Date.now() + '_' + i,
            name:      count > 1 ? btn.dataset.name + ' ' + (i+1) : btn.dataset.name,
            icon:      btn.dataset.icon,
            x:         sx,
            y:         sy,
            color:     'rgba(60,10,10,0.85)',
            isMonster: true,
            userId:    null,
          });
        }
        draw();
        renderTokenList();
        pushMap({ tokens: _tokens });
        closeModal();
        showToast(`👹 ${count}× ${btn.dataset.name} auf Karte`);
      });
    });
  }

  // ── Bild hochladen ────────────────────────────────────────────────────────
  function onImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('⚠ Bild zu groß (max 2MB) — bitte komprimieren');
      return;
    }

    showToast('⏳ Lade Bild...');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      // Bild komprimieren
      const imgEl = new Image();
      imgEl.onload = async () => {
        const tempCanvas = document.createElement('canvas');
        const maxW = 1200;
        const ratio = Math.min(1, maxW / imgEl.width);
        tempCanvas.width  = imgEl.width  * ratio;
        tempCanvas.height = imgEl.height * ratio;
        tempCanvas.getContext('2d').drawImage(imgEl, 0, 0, tempCanvas.width, tempCanvas.height);
        const compressed = tempCanvas.toDataURL('image/jpeg', 0.75);

        _mapData = compressed;
        loadImageFromBase64(compressed);
        const ok = await pushMap({ image: compressed, gridW: _gridW, gridH: _gridH, tokens: _tokens });
        showToast(ok ? '✅ Karte hochgeladen!' : '⚠ Upload fehlgeschlagen (Bild zu groß?)');
      };
      imgEl.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function loadImageFromBase64(b64) {
    if (!b64) return;
    const img = new Image();
    img.onload = () => { _img = img; draw(); };
    img.src = b64;
  }

  // ── Meine Figur hinzufügen ────────────────────────────────────────────────
  function addMyToken() {
    const char = Character.data;
    const user = window.Auth ? window.Auth.getUser() : null;
    const cls  = DnDData.getClassById(char.classId);

    if (!char.name) { showToast('⚠ Kein Charakter geladen'); return; }

    // Existierenden Token dieses Users ersetzen
    _tokens = _tokens.filter(t => t.userId !== user?.id);

    // Freies Startfeld finden
    let startX = 0, startY = 0;
    while (_tokens.find(t => t.x === startX && t.y === startY)) {
      startX = (startX + 1) % _gridW;
      if (startX === 0) startY = Math.min(startY + 1, _gridH - 1);
    }

    const colors = ['rgba(139,26,26,0.85)','rgba(26,70,139,0.85)','rgba(26,139,70,0.85)',
                    'rgba(139,100,26,0.85)','rgba(100,26,139,0.85)','rgba(26,139,139,0.85)'];
    const colorIdx = _tokens.length % colors.length;

    _tokens.push({
      id:     'player_' + (user?.id || Date.now()),
      name:   char.name,
      icon:   cls?.icon || '⚔',
      x:      startX,
      y:      startY,
      color:  colors[colorIdx],
      userId: user?.id,
    });

    draw();
    renderTokenList();
    pushMap({ tokens: _tokens });
    showToast(`⚔ ${char.name} auf ${String.fromCharCode(65+startX)}${startY+1} platziert`);
  }

  function removeToken(id) {
    _tokens = _tokens.filter(t => t.id !== id);
    draw();
    renderTokenList();
    pushMap({ tokens: _tokens });
  }

  // ── Polling ───────────────────────────────────────────────────────────────
  async function pullAndUpdate() {
    const data = await fetchMap();
    if (!data) return;

    // Hash-Check: nur neu rendern wenn sich etwas geändert hat
    const hash = JSON.stringify(data);
    if (hash === _lastHash) return;
    _lastHash = hash;

    if (data.image && data.image !== _mapData) {
      _mapData = data.image;
      loadImageFromBase64(data.image);
    }
    if (data.gridW) _gridW = data.gridW;
    if (data.gridH) _gridH = data.gridH;
    if (data.tokens) _tokens = data.tokens;
    if (data.fog !== undefined) {
      _fog = data.fog ? new Set(data.fog) : null;
    }

    resizeCanvas();
    draw();
    renderTokenList();
  }

  function startPolling() {
    stopPolling();
    _pollInterval = setInterval(pullAndUpdate, 4000);
  }

  function stopPolling() {
    if (_pollInterval) clearInterval(_pollInterval);
    _pollInterval = null;
  }

  function init(isDM = false) {
    _isDM = isDM;
    renderUI();
    pullAndUpdate().then(() => {
      draw();
      renderTokenList();
    });
    startPolling();
  }

  return { init, renderUI, removeToken, draw, stopPolling };
})();

window.BattleMap = BattleMap;
