/**
 * summary.js — Charakter-Zusammenfassung "At a Glance"
 * Kompakte Übersicht aller wichtigen Werte
 */

const SummaryUI = (() => {

  function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }
  function getMod(score) { return Math.floor(((score || 10) - 10) / 2); }

  function render() {
    const container = document.getElementById('tab-summary');
    if (!container) return;

    const char  = Character.data;
    const ab    = char.abilities || {};
    const prof  = Character.getProficiencyBonus();
    const cls   = DnDData.getClassById(char.classId);
    const race  = DnDData.getRaceById?.(char.raceId) || null;
    const rs    = DnDData.getRulesetById(char.rulesetId || '5e');
    const skills = char.proficiencies?.skills || [];
    const saves  = char.proficiencies?.saving_throws || [];

    const ATTRS = ['str','dex','con','int','wis','cha'];
    const ATTR_LABELS = {str:'Stärke',dex:'Geschick',con:'Konstitution',int:'Intelligenz',wis:'Weisheit',cha:'Charisma'};

    const SKILL_MAP = {
      acrobatics:'dex', animal_handling:'wis', arcana:'int', athletics:'str',
      deception:'cha', history:'int', insight:'wis', intimidation:'cha',
      investigation:'int', medicine:'wis', nature:'int', perception:'wis',
      performance:'cha', persuasion:'cha', religion:'int', sleight_of_hand:'dex',
      stealth:'dex', survival:'wis',
    };
    const SKILL_LABELS = {
      acrobatics:'Akrobatik', animal_handling:'Mit Tieren umg.', arcana:'Arkanes',
      athletics:'Athletik', deception:'Täuschung', history:'Geschichte',
      insight:'Einsicht', intimidation:'Einschüchtern', investigation:'Nachforschung',
      medicine:'Medizin', nature:'Naturkunde', perception:'Wahrnehmung',
      performance:'Aufführung', persuasion:'Überzeugung', religion:'Religion',
      sleight_of_hand:'Taschenspielerei', stealth:'Heimlichkeit', survival:'Überleben',
    };

    // Passive Werte
    const passPerc    = 10 + getMod(ab.wis) + (skills.includes('perception')    ? prof : 0);
    const passInsight = 10 + getMod(ab.wis) + (skills.includes('insight')       ? prof : 0);
    const passInvest  = 10 + getMod(ab.int) + (skills.includes('investigation') ? prof : 0);

    // Spells
    const spellIds = char.spellIds || [];
    const prepared = char.preparedSpellIds || [];
    const knownSpells = spellIds.map(id => DnDData.getSpellById(id)).filter(Boolean);

    container.innerHTML = `
      <div class="section-header">
        <h2>📋 Zusammenfassung</h2>
        <button class="btn-secondary" id="btn-print-summary" style="font-size:11px;">🖨️ Drucken</button>
      </div>

      <div class="summary-grid">

        <!-- Kopf -->
        <div class="card summary-header-card" style="grid-column:1/-1;">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <div style="font-size:40px;">${cls?.icon || '⚔'}</div>
            <div style="flex:1;">
              <div style="font-family:var(--font-title);font-size:22px;font-weight:800;color:var(--blood);">
                ${char.name || 'Unbenannter Charakter'}
              </div>
              <div style="font-size:14px;color:var(--ink-light);margin-top:2px;">
                ${cls?.name || '–'} ${char.level || 1} · ${char.race || '–'} · ${char.background || '–'}
              </div>
              <div style="font-size:12px;color:#8a7060;margin-top:2px;">
                ${rs?.name || '5e'} · Kompetenzbonus: +${prof}
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <div class="party-stat"><span class="party-stat-label">HP</span><span class="party-stat-val" style="color:${char.hp_current/char.hp_max<=0.25?'#f87171':char.hp_current/char.hp_max<=0.5?'#fbbf24':'#4ade80'}">${char.hp_current}/${char.hp_max}</span></div>
              <div class="party-stat"><span class="party-stat-label">AC</span><span class="party-stat-val">${char.ac || 10}</span></div>
              <div class="party-stat"><span class="party-stat-label">Speed</span><span class="party-stat-val">${char.speed || 30}ft</span></div>
              <div class="party-stat"><span class="party-stat-label">Initiative</span><span class="party-stat-val">${fmtMod(getMod(ab.dex))}</span></div>
            </div>
          </div>
        </div>

        <!-- Attribute -->
        <div class="card">
          <h3>Attribute</h3>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            ${ATTRS.map(a => `
              <div class="ability-block" style="text-align:center;">
                <div class="ability-name">${ATTR_LABELS[a]}</div>
                <div class="ability-score">${ab[a] || 10}</div>
                <div class="ability-mod" style="font-size:16px;font-weight:700;color:var(--blood);">${fmtMod(getMod(ab[a] || 10))}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Rettungswürfe + Passive -->
        <div class="card">
          <h3>Rettungswürfe</h3>
          <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">
            ${ATTRS.map(a => {
              const mod = getMod(ab[a] || 10);
              const isPro = saves.includes(a);
              const total = mod + (isPro ? prof : 0);
              return `<div style="display:flex;align-items:center;gap:6px;font-size:13px;">
                <span style="color:${isPro?'#4ade80':'#8a7060'};font-size:14px;">${isPro?'◆':'◇'}</span>
                <span style="flex:1;color:var(--ink-light);">${ATTR_LABELS[a]}</span>
                <span style="font-family:var(--font-title);font-weight:700;color:${isPro?'var(--blood)':'var(--ink-light)'};">${fmtMod(total)}</span>
              </div>`;
            }).join('')}
          </div>
          <div style="border-top:1px solid rgba(200,165,90,0.3);padding-top:10px;">
            <h4 style="font-family:var(--font-title);font-size:11px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Passive Werte</h4>
            <div style="font-size:13px;display:flex;flex-direction:column;gap:3px;">
              <div style="display:flex;justify-content:space-between;"><span>👁 Wahrnehmung</span><strong>${passPerc}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>💡 Einsicht</span><strong>${passInsight}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>🔍 Nachforschung</span><strong>${passInvest}</strong></div>
            </div>
          </div>
        </div>

        <!-- Fertigkeiten -->
        <div class="card">
          <h3>Fertigkeiten <span class="badge">${skills.length} Profizienzen</span></h3>
          <div style="display:flex;flex-direction:column;gap:3px;max-height:300px;overflow-y:auto;">
            ${Object.keys(SKILL_MAP).map(sk => {
              const a = SKILL_MAP[sk];
              const mod = getMod(ab[a] || 10);
              const isPro = skills.includes(sk);
              const total = mod + (isPro ? prof : 0);
              return `<div style="display:flex;align-items:center;gap:6px;font-size:12px;
                ${isPro?'':'opacity:0.6'}">
                <span style="color:${isPro?'#4ade80':'#8a7060'};">${isPro?'◆':'◇'}</span>
                <span style="flex:1;">${SKILL_LABELS[sk]}</span>
                <span style="font-size:10px;color:#8a7060;">${a.toUpperCase()}</span>
                <span style="font-family:var(--font-title);font-weight:${isPro?'700':'400'};
                  color:${isPro?'var(--blood)':'var(--ink-light)'};">${fmtMod(total)}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Aktive Conditions -->
        ${(char.conditions || []).length > 0 ? `
        <div class="card">
          <h3>⚡ Aktive Zustände</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${(char.conditions || []).map(c => {
              const name = c.replace(/_\d+$/, '').replace(/_/g, ' ');
              return `<span class="detail-tag" style="background:rgba(139,26,26,0.15);border-color:var(--blood);color:var(--blood);">
                ${name.charAt(0).toUpperCase()+name.slice(1)}
              </span>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- Klassenmerkmale -->
        ${char.class_features?.length ? `
        <div class="card">
          <h3>Klassenmerkmale</h3>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${char.class_features.map(f => {
              const tip = window.FeatureDesc?.[f] || '';
              return `<span class="detail-tag" ${tip?`data-tooltip="${tip.replace(/"/g,"'").slice(0,200)}"`:''}>${f}</span>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- Bekannte Zauber -->
        ${knownSpells.length ? `
        <div class="card" style="grid-column:span 2;">
          <h3>Bekannte Zauber <span class="badge">${knownSpells.length}</span>
            ${prepared.length ? `<span class="badge" style="background:rgba(34,197,94,0.15);border-color:#22c55e;color:#15803d;">${prepared.length} vorbereitet</span>` : ''}
          </h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px;">
            ${[0,1,2,3,4,5,6,7,8,9].map(lvl => {
              const lvlSpells = knownSpells.filter(s => s.level === lvl);
              if (!lvlSpells.length) return '';
              return `<div>
                <div style="font-family:var(--font-title);font-size:9px;color:var(--blood);
                  text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">
                  ${lvl === 0 ? 'Cantips' : 'Grad ' + lvl}
                </div>
                ${lvlSpells.map(s => {
                  const isPrep = prepared.includes(s.id);
                  return `<div style="font-size:12px;padding:2px 0;color:${isPrep?'var(--ink)':'var(--ink-light)'};
                    display:flex;align-items:center;gap:4px;">
                    ${isPrep?'✅':'  '} ${s.name}
                    <span style="font-size:10px;color:#8a7060;">${s.school.slice(0,3)}</span>
                  </div>`;
                }).join('')}
              </div>`;
            }).filter(Boolean).join('')}
          </div>
        </div>` : ''}

        <!-- Items -->
        ${char.itemIds?.length ? `
        <div class="card">
          <h3>Inventar <span class="badge">${char.itemIds.length}</span></h3>
          <div style="display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto;">
            ${(() => {
              const counts = {};
              (char.itemIds||[]).forEach(id => counts[id] = (counts[id]||0)+1);
              return Object.entries(counts).map(([id,n]) => {
                const item = DnDData.getItemById(id);
                if (!item) return '';
                return `<div style="display:flex;gap:6px;font-size:12px;align-items:center;">
                  <span style="color:#8a7060;">${n>1?n+'×':' '}</span>
                  <span style="flex:1;">${item.name}</span>
                  <span class="detail-tag" style="font-size:10px;">${item.rarity}</span>
                </div>`;
              }).join('');
            })()}
          </div>
        </div>` : ''}

        <!-- Notizen -->
        ${char.notes ? `
        <div class="card" style="grid-column:1/-1;">
          <h3>Notizen</h3>
          <p style="font-size:13px;color:var(--ink-light);line-height:1.6;white-space:pre-wrap;">${char.notes}</p>
        </div>` : ''}

      </div>
    `;

    document.getElementById('btn-print-summary')?.addEventListener('click', () => window.print());
  }

  function init() { render(); }

  return { init, render };
})();

window.SummaryUI = SummaryUI;
