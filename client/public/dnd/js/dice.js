/**
 * dice.js — v2: Würfeln mit Modifiern, Skill-Checks, Aufschlüsselung
 */

const DiceUI = (() => {
  const MAX_HISTORY = 50;
  let _history = [];

  const SKILL_LIST = [
    { key:'acrobatics',      label:'Akrobatik',          ability:'dex' },
    { key:'animal_handling', label:'Mit Tieren umgehen', ability:'wis' },
    { key:'arcana',          label:'Arkanes Wissen',      ability:'int' },
    { key:'athletics',       label:'Athletik',            ability:'str' },
    { key:'deception',       label:'Täuschung',           ability:'cha' },
    { key:'history',         label:'Geschichte',          ability:'int' },
    { key:'insight',         label:'Einsicht',            ability:'wis' },
    { key:'intimidation',    label:'Einschüchterung',     ability:'cha' },
    { key:'investigation',   label:'Nachforschung',       ability:'int' },
    { key:'medicine',        label:'Medizin',             ability:'wis' },
    { key:'nature',          label:'Naturkunde',          ability:'int' },
    { key:'perception',      label:'Wahrnehmung',         ability:'wis' },
    { key:'performance',     label:'Aufführung',          ability:'cha' },
    { key:'persuasion',      label:'Überzeugung',         ability:'cha' },
    { key:'religion',        label:'Religionskunde',      ability:'int' },
    { key:'sleight_of_hand', label:'Taschenspielerei',    ability:'dex' },
    { key:'stealth',         label:'Heimlichkeit',        ability:'dex' },
    { key:'survival',        label:'Überleben',           ability:'wis' },
  ];

  const SAVE_LIST = [
    { key:'str', label:'Stärke' }, { key:'dex', label:'Geschicklichkeit' },
    { key:'con', label:'Konstitution' }, { key:'int', label:'Intelligenz' },
    { key:'wis', label:'Weisheit' }, { key:'cha', label:'Charisma' },
  ];

  function roll(sides) { return Math.floor(Math.random() * sides) + 1; }
  function rollMultiple(count, sides) { return Array.from({ length: count }, () => roll(sides)); }
  function fmt(n) { return (n >= 0 ? '+' : '') + n; }

  // ── Skill-Check-Ergebnis aufschlüsseln ────────────────────────────────────
  function buildSkillResult(d20Roll, skillKey) {
    const char   = Character.data;
    const skill  = SKILL_LIST.find(s => s.key === skillKey);
    if (!skill) return null;

    const abilityScore = char.abilities[skill.ability] || 10;
    const abilityMod   = Character.getMod(abilityScore);
    const profBonus    = Character.getProficiencyBonus();
    const isProficient = (char.proficiencies?.skills || []).includes(skillKey);
    const profAdd      = isProficient ? profBonus : 0;
    const total        = d20Roll + abilityMod + profAdd;

    return {
      roll: d20Roll, abilityMod, profAdd, total,
      isCrit: d20Roll === 20, isFumble: d20Roll === 1,
      label: skill.label,
      breakdown: `W20: ${d20Roll}  +  ${skill.ability.toUpperCase()}-Mod: ${fmt(abilityMod)}${profAdd ? `  +  Prof: ${fmt(profAdd)}` : ''}  =  ${total}`,
    };
  }

  function buildSaveResult(d20Roll, abilityKey) {
    const char       = Character.data;
    const save       = SAVE_LIST.find(s => s.key === abilityKey);
    const abilityMod = Character.getMod(char.abilities[abilityKey] || 10);
    const profBonus  = Character.getProficiencyBonus();
    const isProficient = (char.proficiencies?.saving_throws || []).includes(abilityKey);
    const profAdd    = isProficient ? profBonus : 0;
    const total      = d20Roll + abilityMod + profAdd;

    return {
      roll: d20Roll, abilityMod, profAdd, total,
      isCrit: d20Roll === 20, isFumble: d20Roll === 1,
      label: (save?.label || abilityKey.toUpperCase()) + ' Rettungswurf',
      breakdown: `W20: ${d20Roll}  +  ${abilityKey.toUpperCase()}-Mod: ${fmt(abilityMod)}${profAdd ? `  +  Prof: ${fmt(profAdd)}` : ''}  =  ${total}`,
    };
  }

  function buildAbilityResult(d20Roll, abilityKey) {
    const abilityMod = Character.getMod(Character.data.abilities[abilityKey] || 10);
    const total      = d20Roll + abilityMod;
    return {
      roll: d20Roll, abilityMod, profAdd: 0, total,
      isCrit: d20Roll === 20, isFumble: d20Roll === 1,
      label: abilityKey.toUpperCase() + '-Probe',
      breakdown: `W20: ${d20Roll}  +  ${abilityKey.toUpperCase()}-Mod: ${fmt(abilityMod)}  =  ${total}`,
    };
  }

  // ── Ergebnis-Anzeige ──────────────────────────────────────────────────────
  function showDetailResult(result) {
    const panel = document.getElementById('dice-detail-result');
    if (!panel) return;

    const colorClass = result.isCrit ? 'crit' : result.isFumble ? 'fumble' : '';
    panel.className  = 'dice-detail-panel ' + colorClass;
    panel.innerHTML  = `
      <div class="dice-detail-label">${result.label}</div>
      <div class="dice-detail-total ${colorClass}">${result.total}</div>
      <div class="dice-detail-breakdown">
        <div class="breakdown-row">
          <span class="breakdown-item ${result.isCrit?'crit':result.isFumble?'fumble':''}">
            <span class="breakdown-label">🎲 Würfelergebnis</span>
            <span class="breakdown-value">${result.roll}</span>
          </span>
          ${result.abilityMod !== 0 ? `
          <span class="breakdown-sep">+</span>
          <span class="breakdown-item">
            <span class="breakdown-label">Attribut-Mod</span>
            <span class="breakdown-value">${fmt(result.abilityMod)}</span>
          </span>` : ''}
          ${result.profAdd ? `
          <span class="breakdown-sep">+</span>
          <span class="breakdown-item">
            <span class="breakdown-label">Proficiency</span>
            <span class="breakdown-value">${fmt(result.profAdd)}</span>
          </span>` : ''}
          <span class="breakdown-sep">=</span>
          <span class="breakdown-item total">
            <span class="breakdown-label">Gesamt</span>
            <span class="breakdown-value">${result.total}</span>
          </span>
        </div>
      </div>
      ${result.isCrit ? '<div class="dice-crit-banner">⚡ KRITISCHER TREFFER!</div>' : ''}
      ${result.isFumble ? '<div class="dice-fumble-banner">💀 PATZER!</div>' : ''}
    `;

    addToHistory(result.label, result.total, result.breakdown);
  }

  function animateResult(el, value, isCrit, isFumble) {
    el.textContent = value;
    el.style.color = isCrit ? 'var(--gold)' : isFumble ? 'var(--blood-light)' : 'var(--blood)';
    el.classList.remove('rolling');
    void el.offsetWidth;
    el.classList.add('rolling');
  }

  function addToHistory(label, value, breakdown) {
    _history.unshift({ label, value, breakdown, time: new Date().toLocaleTimeString() });
    if (_history.length > MAX_HISTORY) _history.pop();
    renderHistory();
  }

  function renderHistory() {
    const container = document.getElementById('dice-history');
    if (!container) return;
    container.innerHTML = _history.map(h => `
      <div class="history-item" title="${h.breakdown || ''}">
        <span class="history-dice">${h.label}</span>
        <div style="text-align:right;">
          <span class="history-value">${h.value}</span>
          ${h.breakdown ? `<div style="font-size:10px;color:#8a7060;margin-top:1px;">${h.breakdown}</div>` : ''}
        </div>
      </div>
    `).join('') || '<div style="color:#8a7060;font-style:italic;font-size:13px;">Noch keine Würfe</div>';
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    renderDiceTab();
  }

  function renderDiceTab() {
    const tab = document.getElementById('tab-dice');
    if (!tab) return;

    // Skill-Dropdowns befüllen
    const skillOpts = SKILL_LIST.map(s => `<option value="skill:${s.key}">${s.label} (${s.ability.toUpperCase()})</option>`).join('');
    const saveOpts  = SAVE_LIST.map(s  => `<option value="save:${s.key}">${s.label} Rettungswurf</option>`).join('');
    const abilOpts  = ['str','dex','con','int','wis','cha'].map(a => `<option value="ability:${a}">${a.toUpperCase()}-Probe</option>`).join('');

    tab.innerHTML = `
      <div class="section-header"><h2>Würfelturm</h2></div>

      <!-- Schnell-Aktionen -->
      <div class="card" style="margin-bottom:16px;">
        <h3>⚡ Schnell-Würfe</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <button class="btn-quick" data-quick="initiative">🎯 Initiative</button>
          <button class="btn-quick" data-quick="perception">👁 Wahrnehmung</button>
          <button class="btn-quick" data-quick="stealth">🌑 Heimlichkeit</button>
          <button class="btn-quick" data-quick="insight">💡 Einsicht</button>
          <button class="btn-quick" data-quick="persuasion">🗣 Überzeugung</button>
          <button class="btn-quick" data-quick="athletics">💪 Athletik</button>
          <button class="btn-quick" data-quick="arcana">✨ Arkanes</button>
          <button class="btn-quick" data-quick="investigation">🔍 Nachforschung</button>
          <button class="btn-quick" data-quick="deception">🎭 Täuschung</button>
          <button class="btn-quick" data-quick="concentration">🧠 Konz.-Rettung</button>
        </div>
        <div id="quick-result" class="dice-detail-panel hidden" style="margin-top:10px;"></div>
      </div>

      <div class="dice-layout">

        <!-- Standard-Würfel -->
        <div class="card dice-standard-card">
          <h3>Standard Würfel</h3>
          <div class="dice-buttons">
            ${[4,6,8,10,12,20,100].map(d => `<button class="dice-btn" data-dice="${d}">d${d}</button>`).join('')}
          </div>
          <div id="dice-result" class="dice-result">
            <span class="dice-result-num">–</span>
            <span class="dice-result-label">Würfel</span>
          </div>
        </div>

        <!-- Skill-Check -->
        <div class="card">
          <h3>⚔ Probe / Check</h3>
          <p class="hint">Würfelt d20 + alle passenden Boni deines Charakters</p>
          <div class="form-group">
            <label>Art des Wurfs</label>
            <select id="skill-check-select">
              <optgroup label="Fertigkeiten">${skillOpts}</optgroup>
              <optgroup label="Rettungswürfe">${saveOpts}</optgroup>
              <optgroup label="Attributsproben">${abilOpts}</optgroup>
            </select>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <div class="form-group" style="flex:1;margin-bottom:0;">
              <label>Situationsbonus</label>
              <input type="number" id="skill-situational" value="0" style="text-align:center;" />
            </div>
            <div class="form-group" style="flex:1;margin-bottom:0;">
              <label>Vorteil / Nachteil</label>
              <select id="skill-advantage">
                <option value="normal">Normal</option>
                <option value="advantage">Vorteil</option>
                <option value="disadvantage">Nachteil</option>
              </select>
            </div>
          </div>
          <button class="btn-primary" id="btn-roll-skill" style="width:100%;">🎲 Würfeln!</button>

          <!-- Detail-Ergebnis -->
          <div id="dice-detail-result" class="dice-detail-panel hidden" style="margin-top:14px;"></div>
        </div>

        <!-- Custom -->
        <div class="card dice-custom-card">
          <h3>Eigene Formel</h3>
          <div class="dice-formula-row">
            <input type="number" id="dice-count" min="1" max="20" value="1" />
            <span>d</span>
            <input type="number" id="dice-sides" min="2" max="100" value="20" />
            <span>+</span>
            <input type="number" id="dice-modifier" min="-20" max="20" value="0" />
          </div>
          <button class="btn-primary" id="btn-roll-custom">Würfeln!</button>
          <div id="dice-custom-result" class="dice-result" style="margin-top:10px;">
            <span class="dice-result-num">–</span>
            <span class="dice-result-label">Custom</span>
          </div>
        </div>

        <!-- Attributswurf -->
        <div class="card dice-ability-card">
          <h3>Attributswurf</h3>
          <p class="hint">4d6, niedrigste streichen × 6</p>
          <button class="btn-primary" id="btn-roll-stats">Stats würfeln!</button>
          <div id="rolled-stats" class="rolled-stats-grid"></div>
        </div>

        <!-- Verlauf -->
        <div class="card dice-history-card" style="grid-column:1/-1;">
          <h3>Verlauf</h3>
          <div id="dice-history" class="dice-history-list"></div>
          <button class="btn-secondary" id="btn-clear-history" style="margin-top:8px;">Verlauf löschen</button>
        </div>

      </div>
    `;

    // Schnell-Würfe
    tab.querySelectorAll('.btn-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.quick;
        const d20  = roll(20);
        let result;

        if (type === 'initiative') {
          // DEX-Mod + evtl. Alert feat (+5)
          const dexMod  = Character.getMod(Character.data.abilities?.dex || 10);
          const hasAlert = (Character.data.featIds || []).some(id => id === 'alert');
          const bonus    = dexMod + (hasAlert ? 5 : 0);
          const total    = d20 + bonus;
          result = {
            roll: d20, abilityMod: dexMod,
            profAdd: hasAlert ? 5 : 0,
            total, label: hasAlert ? 'Initiative (Alert!)' : 'Initiative',
            isCrit: d20 === 20, isFumble: d20 === 1,
            breakdown: 'W20: ' + d20 + '  +  DEX-Mod: ' + (dexMod>=0?'+':'') + dexMod + (hasAlert?' + Alert: +5':'') + '  =  ' + total,
          };
        } else if (type === 'concentration') {
          // CON-Rettungswurf
          const conMod = Character.getMod(Character.data.abilities?.con || 10);
          const prof   = (Character.data.proficiencies?.saving_throws||[]).includes('con') ? Character.getProficiencyBonus() : 0;
          const warcaster = (Character.data.featIds||[]).some(id=>id==='warcaster');
          const bonus  = conMod + prof;
          const total  = d20 + bonus;
          result = {
            roll: d20, abilityMod: conMod, profAdd: prof,
            total, label: 'Konzentrations-Rettungswurf' + (warcaster?' (War Caster: Vorteil)':''),
            isCrit: d20 === 20, isFumble: d20 === 1,
            breakdown: 'W20: ' + d20 + '  +  CON: ' + (conMod>=0?'+':'') + conMod + (prof?' + Prof: +' + prof:'') + '  =  ' + total,
          };
        } else {
          // Skill-Check
          const SKILL_MAP_Q = {
            perception:'wis', stealth:'dex', insight:'wis', persuasion:'cha',
            athletics:'str', arcana:'int', investigation:'int', deception:'cha',
          };
          const SKILL_LABELS = {
            perception:'Wahrnehmung', stealth:'Heimlichkeit', insight:'Einsicht',
            persuasion:'Überzeugung', athletics:'Athletik', arcana:'Arkanes Wissen',
            investigation:'Nachforschung', deception:'Täuschung',
          };
          const ability  = SKILL_MAP_Q[type] || 'dex';
          const abilMod  = Character.getMod(Character.data.abilities?.[ability] || 10);
          const isPro    = (Character.data.proficiencies?.skills||[]).includes(type);
          const prof     = isPro ? Character.getProficiencyBonus() : 0;
          const total    = d20 + abilMod + prof;
          result = {
            roll: d20, abilityMod: abilMod, profAdd: prof,
            total, label: SKILL_LABELS[type] || type,
            isCrit: d20 === 20, isFumble: d20 === 1,
            breakdown: 'W20: ' + d20 + '  +  ' + ability.toUpperCase() + '-Mod: ' + (abilMod>=0?'+':'') + abilMod + (prof?' + Prof: +'+prof:'') + '  =  ' + total,
          };
        }

        // Quick-Result Panel anzeigen
        const panel = tab.querySelector('#quick-result');
        if (panel) {
          panel.classList.remove('hidden');
          panel.className = 'dice-detail-panel ' + (result.isCrit?'crit':result.isFumble?'fumble':'');
          panel.innerHTML = `
            <div class="dice-detail-label">${result.label}</div>
            <div class="dice-detail-total ${result.isCrit?'crit':result.isFumble?'fumble':''}">${result.total}</div>
            <div style="font-size:12px;color:#8a7060;margin-top:4px;">${result.breakdown}</div>
            ${result.isCrit ? '<div class="dice-crit-banner">⚡ KRITISCH!</div>' : ''}
            ${result.isFumble ? '<div class="dice-fumble-banner">💀 PATZER!</div>' : ''}
          `;
        }
        addToHistory(result.label, result.total, result.breakdown);
      });
    });

    // Standard-Würfel
    tab.querySelectorAll('.dice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sides  = parseInt(btn.dataset.dice);
        const result = roll(sides);
        const numEl  = tab.querySelector('#dice-result .dice-result-num');
        const lblEl  = tab.querySelector('#dice-result .dice-result-label');
        animateResult(numEl, result, result === sides, result === 1);
        if (lblEl) lblEl.textContent = `d${sides}`;
        addToHistory(`d${sides}`, result, '');
      });
    });

    // Skill-Check
    tab.querySelector('#btn-roll-skill')?.addEventListener('click', () => {
      const val  = tab.querySelector('#skill-check-select')?.value;
      const sit  = parseInt(tab.querySelector('#skill-situational')?.value) || 0;
      const adv  = tab.querySelector('#skill-advantage')?.value;
      if (!val) return;

      const [type, key] = val.split(':');
      let d20a = roll(20);
      let d20b = adv !== 'normal' ? roll(20) : null;
      let d20;
      if      (adv === 'advantage')    d20 = Math.max(d20a, d20b);
      else if (adv === 'disadvantage') d20 = Math.min(d20a, d20b);
      else                             d20 = d20a;

      let result;
      if      (type === 'skill')   result = buildSkillResult(d20, key);
      else if (type === 'save')    result = buildSaveResult(d20, key);
      else                         result = buildAbilityResult(d20, key);

      if (!result) return;

      // Situationsbonus drauf
      result.total += sit;
      if (sit !== 0) result.breakdown += `  +  Situation: ${fmt(sit)}  =  ${result.total}`;

      // Vorteil/Nachteil anzeigen
      if (adv !== 'normal') {
        result.breakdown = `(${d20a}, ${d20b}) → ${d20}  |  ` + result.breakdown;
      }

      const panel = tab.querySelector('#dice-detail-result');
      if (panel) panel.classList.remove('hidden');
      showDetailResult(result);
    });

    // Custom
    tab.querySelector('#btn-roll-custom')?.addEventListener('click', () => {
      const count    = parseInt(tab.querySelector('#dice-count')?.value) || 1;
      const sides    = parseInt(tab.querySelector('#dice-sides')?.value) || 20;
      const modifier = parseInt(tab.querySelector('#dice-modifier')?.value) || 0;
      const rolls    = rollMultiple(count, sides);
      const sum      = rolls.reduce((a,b)=>a+b,0);
      const total    = sum + modifier;
      const label    = `${count}d${sides}${fmt(modifier)}`;
      const breakdown = `Würfe: [${rolls.join(', ')}]${modifier !== 0 ? ` ${fmt(modifier)}` : ''} = ${total}`;
      const numEl    = tab.querySelector('#dice-custom-result .dice-result-num');
      const lblEl    = tab.querySelector('#dice-custom-result .dice-result-label');
      animateResult(numEl, total, false, false);
      if (lblEl) lblEl.textContent = breakdown;
      addToHistory(label, total, breakdown);
    });

    // Attribute
    tab.querySelector('#btn-roll-stats')?.addEventListener('click', () => {
      const results = Array.from({length:6}, () => {
        const rolls  = rollMultiple(4, 6).sort((a,b)=>a-b);
        const kept   = rolls.slice(1);
        const total  = kept.reduce((a,b)=>a+b,0);
        return { total, kept, dropped: rolls[0] };
      });
      const container = tab.querySelector('#rolled-stats');
      if (container) {
        container.innerHTML = results.map(r => `
          <div class="rolled-stat">
            <div class="rolled-stat-val">${r.total}</div>
            <div class="rolled-stat-rolls">[${r.kept.join(',')}] <s style="opacity:0.4">${r.dropped}</s></div>
          </div>
        `).join('');
      }
      addToHistory('4d6 drop lowest', results.map(r=>r.total).join(', '), '');
    });

    // Verlauf löschen
    tab.querySelector('#btn-clear-history')?.addEventListener('click', () => { _history = []; renderHistory(); });

    renderHistory();
  }

  return { init };
})();
window.DiceUI = DiceUI;
