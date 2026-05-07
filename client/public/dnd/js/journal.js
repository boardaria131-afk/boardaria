/**
 * journal.js — Abenteuer-Journal
 * Mehrere Abenteuer, Notizen, offene Hooks, Hintergrund/Motivation
 */

const JournalUI = (() => {
  const STORE_KEY = () => {
    const u = window.Auth ? window.Auth.getUser() : null;
    const uid = u ? (u.isGuest ? 'guest_' + u.id : 'u_' + u.id) : 'local';
    return 'dnd_journal_' + uid + '_' + (Character.data.id || 'default');
  };

  // Datenmodell
  function defaultJournal() {
    return {
      background:  '',   // Hintergrundgeschichte
      motivation:  '',   // Was treibt den Charakter an?
      personality: '',   // Persönlichkeit, Macken
      bonds:       '',   // Bindungen (Personen, Orte)
      ideals:      '',   // Ideale / Überzeugungen
      flaws:       '',   // Schwächen / Fehler
      adventures:  [],   // Array von Abenteuern
    };
  }

  function defaultAdventure(name) {
    return {
      id:        Date.now().toString(36),
      name:      name || 'Neues Abenteuer',
      date:      new Date().toLocaleDateString('de-DE'),
      active:    true,
      summary:   '',   // Kurzzusammenfassung
      sessions:  [],   // Einzelne Sitzungsnotizen
      hooks:     [],   // Offene Hooks / Fäden
      npcs:      [],   // Wichtige NSCs
      loot:      '',   // Beute / Belohnungen
    };
  }

  function defaultSession() {
    return {
      id:    Date.now().toString(36),
      date:  new Date().toLocaleDateString('de-DE'),
      title: 'Sitzung ' + new Date().toLocaleDateString('de-DE'),
      notes: '',
    };
  }

  function defaultHook() {
    return { id: Date.now().toString(36), text: '', done: false, priority: 'medium' };
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  let _journal = defaultJournal();
  let _activeAdventureId = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY());
      if (raw) _journal = { ...defaultJournal(), ...JSON.parse(raw) };
      // Aktives Abenteuer = letztes aktives
      const active = _journal.adventures.find(a => a.active) || _journal.adventures[0];
      _activeAdventureId = active?.id || null;
    } catch(e) { console.error('[Journal] Laden:', e); }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY(), JSON.stringify(_journal)); }
    catch(e) { console.error('[Journal] Speichern:', e); }
  }

  function getActiveAdventure() {
    return _journal.adventures.find(a => a.id === _activeAdventureId) || null;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    load();
    renderJournal();
  }

  // ── Haupt-Render ──────────────────────────────────────────────────────────
  function renderJournal() {
    const container = document.getElementById('tab-journal');
    if (!container) return;

    container.innerHTML = `
      <div class="journal-layout">

        <!-- Linke Spalte: Charakter-Hintergrund -->
        <div class="journal-left">
          <div class="card">
            <h3>Charakter-Hintergrund</h3>
            <div class="form-group">
              <label>Hintergrundgeschichte</label>
              <textarea id="j-background" placeholder="Woher kommt dein Charakter? Welche Erfahrungen haben ihn geprägt?" style="min-height:90px;">${_journal.background}</textarea>
            </div>
            <div class="form-group">
              <label>Motivation & Ziele</label>
              <textarea id="j-motivation" placeholder="Was treibt deinen Charakter an? Welche Ziele verfolgt er?" style="min-height:70px;">${_journal.motivation}</textarea>
            </div>
            <div class="form-group">
              <label>Persönlichkeit & Macken</label>
              <textarea id="j-personality" placeholder="Wie verhält sich dein Charakter? Eigenheiten, Ticks..." style="min-height:60px;">${_journal.personality}</textarea>
            </div>
          </div>
          <div class="card" style="margin-top:0;">
            <h3>Werte & Bindungen</h3>
            <div class="form-group">
              <label>Ideale</label>
              <textarea id="j-ideals" placeholder="Woran glaubt dein Charakter fest?" style="min-height:50px;">${_journal.ideals}</textarea>
            </div>
            <div class="form-group">
              <label>Bindungen</label>
              <textarea id="j-bonds" placeholder="Wichtige Personen, Orte, Gegenstände..." style="min-height:50px;">${_journal.bonds}</textarea>
            </div>
            <div class="form-group">
              <label>Schwächen</label>
              <textarea id="j-flaws" placeholder="Was ist die Achillesferse deines Charakters?" style="min-height:50px;">${_journal.flaws}</textarea>
            </div>
          </div>
        </div>

        <!-- Rechte Spalte: Abenteuer -->
        <div class="journal-right">
          <!-- Abenteuer-Tabs -->
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <h3 style="margin-bottom:0;">Abenteuer</h3>
              <button class="btn-primary" id="btn-new-adventure" style="padding:5px 12px;font-size:11px;">+ Neu</button>
            </div>
            <div id="adventure-tabs" class="adventure-tab-list"></div>
          </div>

          <!-- Aktives Abenteuer -->
          <div class="card" id="adventure-content">
            <div class="empty-state">
              <div class="empty-icon">📜</div>
              <p>Erstelle dein erstes Abenteuer</p>
            </div>
          </div>
        </div>

      </div>
    `;

    // Background-Felder binden
    ['background','motivation','personality','ideals','bonds','flaws'].forEach(key => {
      const el = document.getElementById(`j-${key}`);
      if (el) el.addEventListener('input', () => { _journal[key] = el.value; save(); });
    });

    document.getElementById('btn-new-adventure')?.addEventListener('click', () => {
      const name = prompt('Name des Abenteuers:');
      if (!name) return;
      const adv = defaultAdventure(name);
      _journal.adventures.push(adv);
      _activeAdventureId = adv.id;
      save();
      renderAdventureTabs();
      renderActiveAdventure();
    });

    renderAdventureTabs();
    if (_activeAdventureId) renderActiveAdventure();
  }

  // ── Abenteuer-Tabs ────────────────────────────────────────────────────────
  function renderAdventureTabs() {
    const container = document.getElementById('adventure-tabs');
    if (!container) return;
    container.innerHTML = '';
    if (_journal.adventures.length === 0) {
      container.innerHTML = '<span style="font-style:italic;color:#8a7060;font-size:13px;">Noch keine Abenteuer</span>';
      return;
    }
    _journal.adventures.forEach(adv => {
      const btn = document.createElement('button');
      btn.className = 'adventure-tab-btn' + (adv.id === _activeAdventureId ? ' active' : '');
      btn.innerHTML = `
        <span class="adv-status ${adv.active ? 'active' : 'done'}">${adv.active ? '▶' : '✓'}</span>
        <span class="adv-name">${adv.name}</span>
        <span class="adv-delete" data-id="${adv.id}" title="Löschen">✕</span>
      `;
      btn.addEventListener('click', e => {
        if (e.target.classList.contains('adv-delete')) {
          if (confirm(`"${adv.name}" wirklich löschen?`)) {
            _journal.adventures = _journal.adventures.filter(a => a.id !== adv.id);
            if (_activeAdventureId === adv.id) {
              _activeAdventureId = _journal.adventures[0]?.id || null;
            }
            save(); renderAdventureTabs(); renderActiveAdventure();
          }
          return;
        }
        _activeAdventureId = adv.id;
        save();
        renderAdventureTabs();
        renderActiveAdventure();
      });
      container.appendChild(btn);
    });
  }

  // ── Aktives Abenteuer ────────────────────────────────────────────────────
  function renderActiveAdventure() {
    const container = document.getElementById('adventure-content');
    if (!container) return;
    const adv = getActiveAdventure();
    if (!adv) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📜</div><p>Kein Abenteuer ausgewählt</p></div>';
      return;
    }

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <input id="adv-name-input" type="text" value="${adv.name}"
          style="flex:1;font-family:var(--font-title);font-size:16px;font-weight:600;background:transparent;border:none;border-bottom:1px solid rgba(200,165,90,0.4);border-radius:0;padding:4px 0;color:var(--ink);" />
        <label style="display:flex;align-items:center;gap:6px;font-family:var(--font-title);font-size:11px;color:var(--blood);cursor:pointer;">
          <input type="checkbox" id="adv-active-cb" ${adv.active?'checked':''} style="accent-color:var(--blood);" />
          Laufend
        </label>
        <span style="font-size:12px;color:#8a7060;">${adv.date}</span>
      </div>

      <!-- Zusammenfassung -->
      <div class="form-group" style="margin-bottom:14px;">
        <label>Zusammenfassung</label>
        <textarea id="adv-summary" placeholder="Worum geht es in diesem Abenteuer? Kurze Zusammenfassung..." style="min-height:60px;">${adv.summary}</textarea>
      </div>

      <!-- Offene Hooks -->
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h3 style="margin-bottom:0;">🎣 Offene Hooks</h3>
          <button class="btn-secondary" id="btn-add-hook" style="padding:4px 10px;font-size:11px;">+ Hook</button>
        </div>
        <div id="hooks-list"></div>
      </div>

      <!-- NSCs -->
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h3 style="margin-bottom:0;">👥 Wichtige NSCs</h3>
          <button class="btn-secondary" id="btn-add-npc" style="padding:4px 10px;font-size:11px;">+ NSC</button>
        </div>
        <div id="npcs-list"></div>
      </div>

      <!-- Sitzungsnotizen -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h3 style="margin-bottom:0;">📝 Sitzungsnotizen</h3>
          <button class="btn-secondary" id="btn-add-session" style="padding:4px 10px;font-size:11px;">+ Sitzung</button>
        </div>
        <div id="sessions-list"></div>
      </div>

      <!-- Beute -->
      <div class="form-group" style="margin-top:14px;">
        <label>Beute & Belohnungen</label>
        <textarea id="adv-loot" placeholder="Was hat die Gruppe erbeutet?" style="min-height:50px;">${adv.loot}</textarea>
      </div>
    `;

    // Events
    document.getElementById('adv-name-input')?.addEventListener('input', e => { adv.name = e.target.value; save(); renderAdventureTabs(); });
    document.getElementById('adv-active-cb')?.addEventListener('change', e => { adv.active = e.target.checked; save(); renderAdventureTabs(); });
    document.getElementById('adv-summary')?.addEventListener('input',   e => { adv.summary = e.target.value; save(); });
    document.getElementById('adv-loot')?.addEventListener('input',      e => { adv.loot    = e.target.value; save(); });

    document.getElementById('btn-add-hook')?.addEventListener('click', () => {
      adv.hooks.push(defaultHook());
      save(); renderHooks(adv);
    });

    document.getElementById('btn-add-npc')?.addEventListener('click', () => {
      const name = prompt('NSC Name:');
      if (!name) return;
      adv.npcs.push({ id: Date.now().toString(36), name, notes: '' });
      save(); renderNPCs(adv);
    });

    document.getElementById('btn-add-session')?.addEventListener('click', () => {
      adv.sessions.unshift(defaultSession());
      save(); renderSessions(adv);
    });

    renderHooks(adv);
    renderNPCs(adv);
    renderSessions(adv);
  }

  // ── Hooks ────────────────────────────────────────────────────────────────
  function renderHooks(adv) {
    const container = document.getElementById('hooks-list');
    if (!container) return;
    if (!adv.hooks.length) {
      container.innerHTML = '<span style="font-style:italic;color:#8a7060;font-size:13px;">Keine offenen Hooks</span>';
      return;
    }
    const PRIO = { high:'🔴', medium:'🟡', low:'🟢' };
    container.innerHTML = adv.hooks.map((hook, i) => `
      <div class="hook-row ${hook.done ? 'done' : ''}" data-i="${i}">
        <select class="hook-prio" data-i="${i}" style="background:transparent;border:none;font-size:14px;cursor:pointer;padding:0;width:28px;">
          ${['high','medium','low'].map(p => `<option value="${p}" ${hook.priority===p?'selected':''}>${PRIO[p]}</option>`).join('')}
        </select>
        <input type="checkbox" class="hook-done" data-i="${i}" ${hook.done?'checked':''} style="accent-color:var(--blood);" />
        <input type="text" class="hook-text" data-i="${i}"
          value="${hook.text}" placeholder="Offener Handlungsfaden..."
          style="flex:1;background:transparent;border:none;border-bottom:1px solid rgba(200,165,90,0.3);border-radius:0;font-size:14px;${hook.done?'text-decoration:line-through;opacity:0.5;':''}" />
        <button class="btn-remove hook-del" data-i="${i}" title="Löschen">✕</button>
      </div>
    `).join('');

    container.querySelectorAll('.hook-text').forEach(el => {
      el.addEventListener('input', e => { adv.hooks[+e.target.dataset.i].text = e.target.value; save(); });
    });
    container.querySelectorAll('.hook-done').forEach(el => {
      el.addEventListener('change', e => { adv.hooks[+e.target.dataset.i].done = e.target.checked; save(); renderHooks(adv); });
    });
    container.querySelectorAll('.hook-prio').forEach(el => {
      el.addEventListener('change', e => { adv.hooks[+e.target.dataset.i].priority = e.target.value; save(); });
    });
    container.querySelectorAll('.hook-del').forEach(el => {
      el.addEventListener('click', e => { adv.hooks.splice(+e.target.dataset.i, 1); save(); renderHooks(adv); });
    });
  }

  // ── NSCs ─────────────────────────────────────────────────────────────────
  function renderNPCs(adv) {
    const container = document.getElementById('npcs-list');
    if (!container) return;
    if (!adv.npcs.length) {
      container.innerHTML = '<span style="font-style:italic;color:#8a7060;font-size:13px;">Keine NSCs eingetragen</span>';
      return;
    }
    container.innerHTML = adv.npcs.map((npc, i) => `
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;padding:8px;background:rgba(255,255,255,0.4);border-radius:4px;border:1px solid rgba(200,165,90,0.25);">
        <div style="flex:1;">
          <input type="text" class="npc-name" data-i="${i}" value="${npc.name}"
            style="font-family:var(--font-title);font-size:13px;font-weight:600;background:transparent;border:none;border-bottom:1px solid rgba(200,165,90,0.3);border-radius:0;width:100%;margin-bottom:4px;color:var(--blood);" />
          <input type="text" class="npc-notes" data-i="${i}" value="${npc.notes||''}"
            placeholder="Beschreibung, Beziehung, Standort..."
            style="font-size:13px;background:transparent;border:none;width:100%;color:var(--ink-light);" />
        </div>
        <button class="btn-remove npc-del" data-i="${i}">✕</button>
      </div>
    `).join('');

    container.querySelectorAll('.npc-name').forEach(el => {
      el.addEventListener('input', e => { adv.npcs[+e.target.dataset.i].name = e.target.value; save(); });
    });
    container.querySelectorAll('.npc-notes').forEach(el => {
      el.addEventListener('input', e => { adv.npcs[+e.target.dataset.i].notes = e.target.value; save(); });
    });
    container.querySelectorAll('.npc-del').forEach(el => {
      el.addEventListener('click', e => { adv.npcs.splice(+e.target.dataset.i, 1); save(); renderNPCs(adv); });
    });
  }

  // ── Sitzungen ─────────────────────────────────────────────────────────────
  function renderSessions(adv) {
    const container = document.getElementById('sessions-list');
    if (!container) return;
    if (!adv.sessions.length) {
      container.innerHTML = '<span style="font-style:italic;color:#8a7060;font-size:13px;">Noch keine Sitzungsnotizen</span>';
      return;
    }
    container.innerHTML = adv.sessions.map((sess, i) => `
      <div style="margin-bottom:8px;border:1px solid rgba(200,165,90,0.25);border-radius:4px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.4);cursor:pointer;" class="session-header" data-i="${i}">
          <span style="font-family:var(--font-title);font-size:11px;color:var(--blood);">${sess.date}</span>
          <input type="text" class="sess-title" data-i="${i}" value="${sess.title}"
            onclick="event.stopPropagation()"
            style="flex:1;font-family:var(--font-title);font-size:12px;font-weight:600;background:transparent;border:none;color:var(--ink);" />
          <button class="btn-remove sess-del" data-i="${i}" title="Löschen" onclick="event.stopPropagation()">✕</button>
        </div>
        <div class="session-body" id="sess-body-${i}" style="display:none;padding:8px 10px;">
          <textarea class="sess-notes" data-i="${i}"
            placeholder="Was ist in dieser Sitzung passiert?"
            style="width:100%;min-height:80px;">${sess.notes}</textarea>
        </div>
      </div>
    `).join('');

    // Toggle
    container.querySelectorAll('.session-header').forEach(el => {
      el.addEventListener('click', () => {
        const body = document.getElementById(`sess-body-${el.dataset.i}`);
        if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
      });
    });
    container.querySelectorAll('.sess-title').forEach(el => {
      el.addEventListener('input', e => { adv.sessions[+e.target.dataset.i].title = e.target.value; save(); });
    });
    container.querySelectorAll('.sess-notes').forEach(el => {
      el.addEventListener('input', e => { adv.sessions[+e.target.dataset.i].notes = e.target.value; save(); });
    });
    container.querySelectorAll('.sess-del').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('Sitzung löschen?')) { adv.sessions.splice(+e.target.dataset.i, 1); save(); renderSessions(adv); }
      });
    });
  }

  return { init };
})();
window.JournalUI = JournalUI;
