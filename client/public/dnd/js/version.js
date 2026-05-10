/**
 * version.js — Versions-Tracker
 * Zeigt aktuelle Version + Changelog, erkennt ob Update verfügbar ist.
 */

const AppVersion = (() => {
  const CURRENT = {
    version:   '1.20.0',
    date:      '2025-05-10',
    codename:  'Arcane Forge',
    features: [
      '📄 PDF-Export (vollständiger Charakterbogen)',
      '✨ Spell Slots Tracker (mit Langer/Kurzer Rast)',
      '📖 12 SRD-Hintergründe wählbar',
      '📜 Regelwerk-Auswahl (5e / 5.5e / Hausregeln)',
      '⚠ 5e↔5.5e Konflikte automatisch markiert',
      '☁ Cross-Device Character-Sync (Server)',
      '⚔ Kampagnen-Tab mit Gruppen-Übersicht',
      '🌐 Teilen-Funktion für Mitspieler',
      '💾 User-gebundene Charakterspeicherung',
      '🔐 Login / Logout (HexForge-Auth)',
    ],
    changelog: [
      { v:'1.20.0', date:'2025-05-10', note:'Schnell-Würfe, Unterrassen-Tooltips, DB-Sync, Hintergrund-Fix, PDF-Fix' },
      { v:'1.19.0', date:'2025-05-09', note:'Cross-Device Sync mit eigenem pg Pool, Sync-UI im Roster' },
      { v:'1.18.0', date:'2025-05-09', note:'44 Rassen, Background-Fix, uid-Timing-Fix' },
      { v:'1.15.0', date:'2025-05-08', note:'PDF-Export, Spell Slots, Regelwerke, Cross-Device' },
      { v:'1.14.0', date:'2025-05-07', note:'Kampagne, Teilen-Funktion, User-Binding' },
      { v:'1.13.0', date:'2025-05-07', note:'Auth-Fix: REST-Login, Logout-Button' },
      { v:'1.12.0', date:'2025-05-06', note:'118 Subklassen, Feats, Wiki-Paste-Import' },
      { v:'1.10.0', date:'2025-05-05', note:'Journal, Würfeln mit Modifiern, Tooltips' },
      { v:'1.0.0',  date:'2025-05-01', note:'Erste Version: Klassen, Spells, Items, Würfeln' },
    ],
  };

  const STORE_KEY = 'dnd_version_seen';

  function init() {
    // Nur kleine unsichtbare Meta-Info — Badge auf /dnd/version.html
    console.log(`[App] v${CURRENT.version} · ${CURRENT.codename}`);
  }

  function showChangelog(isNew = false) {
    showModal(
      isNew
        ? `🆕 Neu in v${CURRENT.version} · ${CURRENT.codename}`
        : `📋 Changelog · v${CURRENT.version}`,
      `
      ${isNew ? `
        <p style="font-size:13px;color:var(--ink-light);margin-bottom:12px;">
          Folgendes wurde in dieser Version hinzugefügt oder verbessert:
        </p>
        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
          ${CURRENT.features.map(f => `
            <div style="display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--ink);">
              <span>${f}</span>
            </div>`).join('')}
        </div>
        <hr style="border:none;border-top:1px solid rgba(200,165,90,0.3);margin:12px 0;" />
      ` : ''}

      <h4 style="font-family:var(--font-title);font-size:12px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
        Version-Historie
      </h4>
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${CURRENT.changelog.map(c => `
          <div style="display:flex;gap:10px;padding:6px 8px;background:rgba(255,255,255,0.4);border-radius:3px;font-size:12px;">
            <span style="font-family:var(--font-title);color:var(--blood);font-weight:600;flex-shrink:0;">v${c.v}</span>
            <span style="color:#8a7060;flex-shrink:0;">${c.date}</span>
            <span style="color:var(--ink);">${c.note}</span>
          </div>`).join('')}
      </div>

      <div style="margin-top:12px;font-size:11px;color:#a09080;text-align:center;">
        D&D 5e Charakterbogen · SRD 5.1 (CC BY 4.0) · HexForge-Integration
      </div>
      `
    );
  }

  return { init, showChangelog, version: CURRENT.version };
})();

window.AppVersion = AppVersion;
