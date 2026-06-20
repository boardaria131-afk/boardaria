/**
 * levelup.js — Level-Up mit vollständigem Multiclassing-Support
 * Unterstützt PHB Multiclassing-Regeln inkl. Voraussetzungen,
 * Multiclass-Spell-Slots und Caster-Level-Berechnung
 */

const LevelUpUI = (() => {

  // ── Caster-Level Berechnung ───────────────────────────────────────────────
  const CASTER_WEIGHTS = {
    full: 1.0, half: 0.5, third: 0.333, pact: 0, none: 0,
  };

  function getCasterLevel(classesArr, classesData) {
    let total = 0;
    let hasPact = false;
    for (const c of classesArr) {
      const cls = classesData[c.classId];
      const type = cls?.caster_type || 'none';
      if (type === 'pact') { hasPact = true; continue; }
      if (type === 'full')  total += c.level;
      if (type === 'half')  total += Math.floor(c.level / 2);
      if (type === 'third') total += Math.floor(c.level / 3);
    }
    return { casterLevel: Math.floor(total), hasPact };
  }

  function getMulticlassSlots(casterLevel, slotConfig) {
    return slotConfig?.multiclass_caster?.[String(casterLevel)] || null;
  }

  // ── Voraussetzungen prüfen ────────────────────────────────────────────────
  function checkMCRequirements(classId, abilities, classesData) {
    const cls = classesData[classId];
    const req = cls?.multiclass_req || {};
    const msgs = [];

    const AB_LABEL = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' };
    const hasOr = req.or;

    for (const [stat, minVal] of Object.entries(req)) {
      if (stat === 'or') continue;
      const val = abilities?.[stat] || 10;
      if (val < minVal) {
        if (hasOr && (abilities?.[hasOr] || 10) >= minVal) continue;
        msgs.push(`${AB_LABEL[stat]} ${minVal}+ (aktuell: ${val})`);
      }
    }
    return msgs;
  }

  // ── Multiclass-Slot-Anzeige ───────────────────────────────────────────────
  function renderMulticlassSlotInfo(classesArr, classesData, slotConfig) {
    const { casterLevel, hasPact } = getCasterLevel(classesArr, classesData);
    if (casterLevel === 0 && !hasPact) return '';

    const slots = getMulticlassSlots(casterLevel, slotConfig);
    if (!slots) return '';

    const slotStr = slots.map((n,i) => n ? `${i+1}.Gr: ${n}` : '').filter(Boolean).join(' · ');
    return `
      <div style="background:rgba(139,26,26,0.08);border:1px solid rgba(139,26,26,0.2);
        border-radius:6px;padding:8px 12px;margin-top:8px;">
        <div style="font-family:var(--font-title);font-size:10px;color:var(--blood);
          text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
          ✨ Multiclass Spell Slots (Caster-Level ${casterLevel})
        </div>
        <div style="font-size:12px;color:var(--ink-light);">${slotStr}</div>
        ${hasPact ? '<div style="font-size:11px;color:#8a7060;margin-top:3px;">+ Pakt-Slots (separat)</div>' : ''}
      </div>
    `;
  }

  // ── Hauptansicht ──────────────────────────────────────────────────────────
  function renderLevelUpPanel() {
    const container = document.getElementById('levelup-panel');
    if (!container) return;

    const char = Character.data;
    const classes = char.classes || [];
    const abilities = char.abilities || {};

    // DnDData laden
    const classesData = {};
    DnDData.classes.forEach(c => classesData[c.id] = c);

    const totalLevel = Character.getTotalLevel();
    const profBonus  = Character.getProficiencyBonus();

    container.innerHTML = `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-title">⚔ Klassen & Level</div>

        <!-- Aktuelle Klassen -->
        <div id="mc-class-list" style="margin-bottom:12px;">
          ${classes.length === 0
            ? '<div style="color:#8a7060;font-style:italic;font-size:13px;">Noch keine Klasse gewählt</div>'
            : classes.map((c, i) => renderClassRow(c, i, classesData, abilities, totalLevel)).join('')}
        </div>

        <!-- Gesamt-Stats -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <div style="text-align:center;padding:8px 16px;background:rgba(255,255,255,0.5);
            border:1px solid rgba(200,165,90,0.3);border-radius:6px;">
            <div style="font-family:var(--font-title);font-size:9px;color:#8a7060;text-transform:uppercase;">Gesamtlevel</div>
            <div style="font-family:var(--font-title);font-size:24px;font-weight:700;color:var(--ink);">${totalLevel}</div>
          </div>
          <div style="text-align:center;padding:8px 16px;background:rgba(255,255,255,0.5);
            border:1px solid rgba(200,165,90,0.3);border-radius:6px;">
            <div style="font-family:var(--font-title);font-size:9px;color:#8a7060;text-transform:uppercase;">Prof. Bonus</div>
            <div style="font-family:var(--font-title);font-size:24px;font-weight:700;color:var(--gold);">+${profBonus}</div>
          </div>
          <div style="text-align:center;padding:8px 16px;background:rgba(255,255,255,0.5);
            border:1px solid rgba(200,165,90,0.3);border-radius:6px;">
            <div style="font-family:var(--font-title);font-size:9px;color:#8a7060;text-transform:uppercase;">HP Maximum</div>
            <div style="font-family:var(--font-title);font-size:24px;font-weight:700;color:var(--blood-light);">${char.hp_max || '–'}</div>
          </div>
        </div>

        ${renderMulticlassSlotInfo(classes, classesData, DnDData.slotConfig)}

        <!-- Buttons -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button class="btn-primary" id="btn-levelup-existing" ${classes.length === 0 ? 'disabled' : ''}>
            ⬆ Level aufsteigen
          </button>
          <button class="btn-secondary" id="btn-multiclass-add" ${totalLevel >= 20 ? 'disabled' : ''}>
            ➕ Neue Klasse hinzufügen
          </button>
          ${classes.length > 1 ? `
          <button class="btn-secondary" id="btn-multiclass-remove">
            ➖ Klasse entfernen
          </button>` : ''}
        </div>
      </div>

      <!-- Subklassen -->
      <div class="card" id="mc-subclass-section">
        <div class="card-title">🎓 Subklassen</div>
        ${classes.length === 0
          ? '<div style="color:#8a7060;font-style:italic;font-size:13px;">Erst eine Klasse wählen</div>'
          : classes.map(c => renderSubclassSelector(c, classesData)).join('')}
      </div>
    `;

    // Events
    document.getElementById('btn-levelup-existing')?.addEventListener('click', showLevelUpExisting);
    document.getElementById('btn-multiclass-add')?.addEventListener('click', showAddClass);
    document.getElementById('btn-multiclass-remove')?.addEventListener('click', showRemoveClass);
  }

  function renderClassRow(c, idx, classesData, abilities, totalLevel) {
    const cls = classesData[c.classId];
    const hitDie = cls?.hit_die || 8;
    const casterType = cls?.caster_type || 'none';
    const casterLabel = {full:'Voller Zauberer',half:'Halber Zauberer',
      third:'1/3 Zauberer',pact:'Pakt-Magie',none:'Nicht-Zauberer'}[casterType] || '';

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;
        background:rgba(255,255,255,0.5);border:1px solid rgba(200,165,90,0.3);
        border-radius:6px;margin-bottom:6px;">
        <div style="font-size:24px;">${cls?.icon || '⚔'}</div>
        <div style="flex:1;">
          <div style="font-family:var(--font-title);font-size:14px;font-weight:700;color:var(--ink);">
            ${cls?.name || c.classId}
          </div>
          <div style="font-size:12px;color:#8a7060;">
            Level ${c.level} · d${hitDie} · ${casterLabel}
          </div>
        </div>
        <div style="font-family:var(--font-title);font-size:28px;font-weight:800;color:var(--gold);">
          ${c.level}
        </div>
      </div>
    `;
  }

  function renderSubclassSelector(c, classesData) {
    const cls = classesData[c.classId];
    if (!cls) return '';
    const subclasses = cls.subclasses || [];
    const scLevel = cls.subclass_level || 3;
    const unlocked = c.level >= scLevel;

    return `
      <div style="margin-bottom:12px;">
        <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);
          text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
          ${cls.icon || '⚔'} ${cls.name} — Subklasse
          ${!unlocked ? `<span style="color:#8a7060;">(ab Level ${scLevel})</span>` : ''}
        </div>
        <select id="sc-select-${c.classId}" ${!unlocked ? 'disabled' : ''}
          onchange="LevelUpUI.setSubclass('${c.classId}', this.value)"
          style="width:100%;padding:8px;background:rgba(255,255,255,0.8);
          border:1px solid rgba(200,165,90,0.4);border-radius:4px;
          font-family:var(--font-title);font-size:12px;">
          <option value="">– Keine Subklasse –</option>
          ${subclasses.map(sc => `
            <option value="${sc.id}" ${c.subclassId === sc.id ? 'selected' : ''}>
              ${sc.name}
            </option>`).join('')}
        </select>
      </div>
    `;
  }

  // ── Level aufsteigen ──────────────────────────────────────────────────────
  function showLevelUpExisting() {
    const char = Character.data;
    const classes = char.classes || [];
    if (!classes.length) return;

    const classesData = {};
    DnDData.classes.forEach(c => classesData[c.id] = c);

    const totalLevel = Character.getTotalLevel();
    if (totalLevel >= 20) { showToast('⚠ Maximallevel 20 erreicht'); return; }

    showModal('⬆ Level aufsteigen', `
      <div style="font-size:13px;color:#8a7060;margin-bottom:12px;">
        Gesamtlevel: ${totalLevel} → ${totalLevel + 1}
      </div>

      <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);
        text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
        In welcher Klasse aufsteigen?
      </div>

      <div id="lu-class-options" style="display:flex;flex-direction:column;gap:6px;">
        ${classes.map(c => {
          const cls = classesData[c.classId];
          const hitDie = cls?.hit_die || 8;
          const conMod = Math.floor(((char.abilities?.con || 10) - 10) / 2);
          const hpGain = `+1d${hitDie}+${conMod} HP`;
          return `
            <div class="lu-class-btn" data-classid="${c.classId}"
              style="display:flex;align-items:center;gap:10px;padding:10px 12px;
              background:rgba(255,255,255,0.5);border:1px solid rgba(200,165,90,0.3);
              border-radius:6px;cursor:pointer;transition:all 0.15s;">
              <span style="font-size:22px;">${cls?.icon || '⚔'}</span>
              <div style="flex:1;">
                <div style="font-family:var(--font-title);font-size:13px;font-weight:700;">
                  ${cls?.name} → Level ${c.level + 1}
                </div>
                <div style="font-size:11px;color:#8a7060;">${hpGain}</div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div id="lu-features" style="margin-top:10px;"></div>
    `);

    document.querySelectorAll('.lu-class-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(139,26,26,0.1)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.5)');
      btn.addEventListener('click', () => performLevelUp(btn.dataset.classid, classesData));
    });
  }

  function performLevelUp(classId, classesData) {
    const char = Character.data;
    const classes = char.classes || [];
    const cIdx = classes.findIndex(c => c.classId === classId);
    if (cIdx < 0) return;

    const cls = classesData[classId];
    const oldLevel = classes[cIdx].level;
    const newLevel = oldLevel + 1;
    classes[cIdx].level = newLevel;

    // HP würfeln
    const hitDie = cls?.hit_die || 8;
    const conMod = Math.floor(((char.abilities?.con || 10) - 10) / 2);
    const hpRoll = Math.floor(Math.random() * hitDie) + 1;
    const hpGain = Math.max(1, hpRoll + conMod);
    char.hp_max = (char.hp_max || 0) + hpGain;
    char.hp_current = Math.min(char.hp_current || 0, char.hp_max);

    // Kompatibilitäts-Felder aktualisieren
    const primary = classes[0];
    char.classId    = primary.classId;
    char.level      = Character.getTotalLevel();
    char.subclassId = primary.subclassId;
    char.classes    = classes;

    // Features für neues Level sammeln
    const features = (cls?.features_detail || [])
      .filter(f => f.level === newLevel)
      .map(f => `${f.name}: ${f.description}`)
      .slice(0, 3);

    Character.save();
    renderLevelUpPanel();
    closeModal();

    const rollInfo = `(W${hitDie}: ${hpRoll} + CON: ${conMod >= 0 ? '+' : ''}${conMod} = +${hpGain} HP)`;
    showToast(`⬆ ${cls?.name} Level ${newLevel}! ${rollInfo}`);

    if (features.length) {
      setTimeout(() => showModal(`✨ Neue Features — ${cls?.name} ${newLevel}`, `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${features.map(f => `
            <div style="padding:8px 10px;background:rgba(201,150,42,0.05);
              border:1px solid rgba(201,150,42,0.2);border-radius:4px;font-size:13px;
              color:var(--ink);line-height:1.5;">${f}</div>
          `).join('')}
        </div>
        <button class="btn-primary" onclick="closeModal()" style="width:100%;margin-top:10px;">Super!</button>
      `), 300);
    }
  }

  // ── Neue Klasse hinzufügen ────────────────────────────────────────────────
  function showAddClass() {
    const char = Character.data;
    const abilities = char.abilities || {};
    const existingClassIds = (char.classes || []).map(c => c.classId);
    const classesData = {};
    DnDData.classes.forEach(c => classesData[c.id] = c);

    const available = DnDData.classes.filter(cls => !existingClassIds.includes(cls.id));

    showModal('➕ Neue Klasse (Multiclassing)', `
      <div style="font-size:12px;color:#8a7060;margin-bottom:12px;">
        Wähle eine Klasse. Die Voraussetzungen müssen erfüllt sein.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto;">
        ${available.map(cls => {
          const errors = checkMCRequirements(cls.id, abilities, classesData);
          const ok = errors.length === 0;
          return `
            <div class="mc-add-btn" data-classid="${cls.id}" data-ok="${ok}"
              style="display:flex;align-items:center;gap:10px;padding:10px 12px;
              background:${ok?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.1)'};
              border:1px solid ${ok?'rgba(200,165,90,0.3)':'rgba(0,0,0,0.1)'};
              border-radius:6px;cursor:${ok?'pointer':'default'};opacity:${ok?1:0.5};">
              <span style="font-size:22px;">${cls.icon || '⚔'}</span>
              <div style="flex:1;">
                <div style="font-family:var(--font-title);font-size:13px;font-weight:700;
                  color:${ok?'var(--ink)':'#8a7060'};">${cls.name}</div>
                <div style="font-size:11px;color:#8a7060;">
                  ${ok ? `d${cls.hit_die} · ${cls.role || ''}` : `⚠ Voraussetzung: ${errors.join(', ')}`}
                </div>
              </div>
              ${ok ? '<span style="color:var(--gold);font-size:16px;">›</span>' : ''}
            </div>`;
        }).join('')}
      </div>
    `);

    document.querySelectorAll('.mc-add-btn[data-ok="true"]').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(139,26,26,0.1)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.5)');
      btn.addEventListener('click', () => {
        const classId = btn.dataset.classid;
        const cls = classesData[classId];
        const char = Character.data;
        const conMod = Math.floor(((char.abilities?.con || 10) - 10) / 2);
        const hp1 = Math.floor(Math.random() * (cls?.hit_die || 8)) + 1;
        const hpGain = Math.max(1, hp1 + conMod);

        char.classes = [...(char.classes || []), {
          classId:    classId,
          level:      1,
          subclassId: null,
        }];
        char.hp_max     = (char.hp_max || 0) + hpGain;
        char.level      = Character.getTotalLevel();

        Character.save();
        renderLevelUpPanel();
        closeModal();
        showToast(`✅ ${cls?.name} Level 1 hinzugefügt! (+${hpGain} HP)`);
      });
    });
  }

  // ── Klasse entfernen ──────────────────────────────────────────────────────
  function showRemoveClass() {
    const char = Character.data;
    const classes = char.classes || [];
    if (classes.length <= 1) { showToast('⚠ Mindestens eine Klasse erforderlich'); return; }
    const classesData = {};
    DnDData.classes.forEach(c => classesData[c.id] = c);

    // Nur nicht-primäre Klassen entfernbar
    const removable = classes.slice(1);

    showModal('➖ Klasse entfernen', `
      <div style="font-size:12px;color:#8a7060;margin-bottom:12px;">
        ⚠ Die primäre Klasse (${classesData[classes[0].classId]?.name}) kann nicht entfernt werden.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${removable.map(c => {
          const cls = classesData[c.classId];
          return `
            <div class="mc-remove-btn" data-classid="${c.classId}"
              style="display:flex;align-items:center;gap:10px;padding:10px;
              background:rgba(139,26,26,0.05);border:1px solid rgba(139,26,26,0.2);
              border-radius:6px;cursor:pointer;">
              <span style="font-size:22px;">${cls?.icon || '⚔'}</span>
              <div style="flex:1;">
                <div style="font-family:var(--font-title);font-size:13px;">${cls?.name} Level ${c.level}</div>
              </div>
              <span style="color:var(--blood);font-size:18px;">✕</span>
            </div>`;
        }).join('')}
      </div>
    `);

    document.querySelectorAll('.mc-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Klasse wirklich entfernen?')) return;
        const classId = btn.dataset.classid;
        const cls = classesData[classId];
        const removed = char.classes.find(c => c.classId === classId);
        const hitDie = cls?.hit_die || 8;
        const conMod = Math.floor(((char.abilities?.con || 10) - 10) / 2);
        const avgHP = Math.ceil(hitDie/2) * (removed?.level || 1);

        char.classes = char.classes.filter(c => c.classId !== classId);
        char.hp_max  = Math.max(1, (char.hp_max || 10) - avgHP);
        char.level   = Character.getTotalLevel();
        char.classId = char.classes[0]?.classId;

        Character.save();
        renderLevelUpPanel();
        closeModal();
        showToast(`✅ ${cls?.name} entfernt`);
      });
    });
  }

  // ── Subklasse setzen ──────────────────────────────────────────────────────
  function setSubclass(classId, subclassId) {
    const char = Character.data;
    const c = (char.classes || []).find(c => c.classId === classId);
    if (c) {
      c.subclassId = subclassId || null;
      // Kompatibilität: primäre Klasse
      if (char.classes[0]?.classId === classId) char.subclassId = subclassId || null;
      Character.save();
      showToast(`✅ Subklasse gesetzt`);
    }
  }

  function init() {
    // Beim ersten Render: bestehende Charaktere migrieren
    if (Character.data && !Character.data.classes) {
      Character.migrateToMulticlass(Character.data);
    }
    renderLevelUpPanel();
  }

  return { init, renderLevelUpPanel, setSubclass };
})();

window.LevelUpUI = LevelUpUI;
