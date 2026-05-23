/**
 * spells.js — Spells UI (Liste, Suche, Detail, Charakter-Integration)
 */

const SpellsUI = (() => {
  let _selected = null;

  function init() {
    populateClassFilter();
    populateSchoolFilter();
    renderList();
    bindSearch();
  }

  // Klassen die Spells vorbereiten müssen (nicht einfach "kennen")
  const PREPARE_CLASSES = ['cleric','druid','paladin','wizard','artificer'];

  function needsPrepare() {
    return PREPARE_CLASSES.includes(Character.data.classId);
  }

  function maxPrepared() {
    const char  = Character.data;
    const level = parseInt(char.level) || 1;
    const cls   = char.classId;
    const mod   = Character.getMod
      ? Character.getMod(char.abilities?.[cls === 'wizard' ? 'int' : cls === 'druid' || cls === 'cleric' ? 'wis' : 'wis'] || 10)
      : Math.floor(((char.abilities?.wis || 10) - 10) / 2);

    if (cls === 'paladin') return Math.max(1, Math.floor(level / 2) + mod);
    if (cls === 'wizard')  return Math.max(1, level + mod);
    return Math.max(1, level + mod); // cleric, druid, artificer
  }

  function isPrepared(spellId) {
    if (!needsPrepare()) return (Character.data.spellIds || []).includes(spellId);
    return (Character.data.preparedSpellIds || []).includes(spellId);
  }

  function togglePrepared(spellId) {
    const prepared = [...(Character.data.preparedSpellIds || [])];
    const idx = prepared.indexOf(spellId);
    if (idx >= 0) {
      prepared.splice(idx, 1);
    } else {
      if (prepared.length >= maxPrepared()) {
        showToast(`⚠ Maximum ${maxPrepared()} Spells vorbereitet!`);
        return;
      }
      prepared.push(spellId);
    }
    Character.update({ preparedSpellIds: prepared });
    renderList();
    renderPrepareBanner();
  }

  function renderPrepareBanner() {
    const banner = document.getElementById('spell-prepare-banner');
    if (!banner) return;
    if (!needsPrepare()) { banner.style.display = 'none'; return; }
    const prepared = (Character.data.preparedSpellIds || []).length;
    const max      = maxPrepared();
    const pct      = Math.min(1, prepared / max);
    banner.style.display = 'flex';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;width:100%;">
        <span style="font-family:var(--font-title);font-size:11px;color:var(--blood);white-space:nowrap;">
          📖 Vorbereitet
        </span>
        <div style="flex:1;height:6px;background:rgba(139,26,26,0.15);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(pct*100)}%;background:${pct>=1?'#22c55e':'var(--blood)'};border-radius:3px;transition:width 0.3s;"></div>
        </div>
        <span style="font-family:var(--font-title);font-size:13px;font-weight:700;color:${prepared>=max?'#22c55e':'var(--blood)'};">
          ${prepared}/${max}
        </span>
        <button id="btn-clear-prepared" style="font-size:10px;padding:2px 8px;font-family:var(--font-title);"
          class="btn-secondary">Alle abwählen</button>
      </div>
    `;
    document.getElementById('btn-clear-prepared')?.addEventListener('click', () => {
      Character.update({ preparedSpellIds: [] });
      renderList();
      renderPrepareBanner();
    });
  }

  function populateClassFilter() {
    const sel = document.getElementById('spell-filter-class');
    if (!sel) return;
    sel.innerHTML = '<option value="">Alle Klassen</option>';
    const charClass = DnDData.getClassById(Character.data.classId);
    if (charClass) {
      const opt = document.createElement('option');
      opt.value = charClass.id;
      opt.textContent = '⚔ ' + charClass.name + ' (meine)';
      opt.selected = true;
      sel.appendChild(opt);
    }
    ['bard','cleric','druid','paladin','ranger','sorcerer','warlock','wizard','artificer']
      .filter(c => c !== charClass?.id)
      .forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
        sel.appendChild(opt);
      });
  }

  function populateSchoolFilter() {
    const sel = document.getElementById('spell-filter-school');
    if (!sel) return;
    const schools = [...new Set(DnDData.spells.map(s => s.school))].sort();
    schools.forEach(sc => {
      const opt = document.createElement('option');
      opt.value = sc;
      opt.textContent = sc;
      sel.appendChild(opt);
    });
  }

  function bindSearch() {
    document.getElementById('spell-search')?.addEventListener('input', renderList);
    renderPrepareBanner();
    document.getElementById('spell-filter-class')?.addEventListener('change', renderList);
    document.getElementById('spell-filter-level')?.addEventListener('change', renderList);
    document.getElementById('spell-filter-known')?.addEventListener('change', renderList);
    document.getElementById('spell-filter-school')?.addEventListener('change', renderList);
  }

  function filteredSpells() {
    const query  = (document.getElementById('spell-search')?.value || '').toLowerCase();
    const level  = document.getElementById('spell-filter-level')?.value;
    const school = document.getElementById('spell-filter-school')?.value;

    return DnDData.spells.filter(s => {
      if (query  && !s.name.toLowerCase().includes(query)) return false;
      if (level  !== '' && level !== undefined && String(s.level) !== level) return false;
      if (school && s.school !== school) return false;
      return true;
    });
  }

  function renderList() {
    const container = document.getElementById('spell-list');
    if (!container) return;
    const spells = filteredSpells();
    container.innerHTML = '';

    if (spells.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#8a7060;font-style:italic;">Keine Spells gefunden</div>';
      return;
    }

    spells.forEach(spell => {
      const owned = Character.data.spellIds.includes(spell.id);
      const div = document.createElement('div');
      div.className = 'list-item' + (spell.id === _selected ? ' selected' : '');
      div.innerHTML = `
        <span class="list-item-level">${spell.level === 0 ? 'C' : spell.level}</span>
        <span class="list-item-name">${spell.name}</span>
        <span class="list-item-tag">${spell.school}</span>
        ${owned ? '<span style="color:#2c5a2c;font-size:12px;">✓</span>' : ''}
        ${spell._custom ? `<span class="list-delete-btn" title="Löschen">✕</span>` : ''}
      `;
      div.addEventListener('click', e => {
        if (e.target.classList.contains('spell-prep-dot') || e.target.dataset.prep) {
          e.stopPropagation();
          const spellId = e.target.dataset.prep || e.target.closest('[data-prep]')?.dataset.prep;
          if (spellId) togglePrepared(spellId);
          return;
        }
        if (e.target.classList.contains('list-delete-btn')) {
          e.stopPropagation();
          if (confirm(`"${spell.name}" wirklich löschen?`)) {
            DnDData.deleteEntry('spell', spell.id);
            Character.removeSpell(spell.id);
            _selected = null;
            renderList();
            document.getElementById('spell-detail').innerHTML = '<div class="empty-state"><div class="empty-icon">✨</div><p>Wähle einen Spell aus</p></div>';
            updateCharSummary();
            showToast(`🗑 ${spell.name} gelöscht`);
          }
          return;
        }
        _selected = spell.id;
        renderList();
        renderDetail(spell);
      });
      container.appendChild(div);
    });
  }

  function renderDetail(spell) {
    const container = document.getElementById('spell-detail');
    if (!container) return;
    const owned = Character.data.spellIds.includes(spell.id);

    container.innerHTML = `
      <div class="detail-content">
        <h2>${spell.name}</h2>
        <div class="detail-tags">
          <span class="detail-tag">${spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}</span>
          <span class="detail-tag">${spell.school}</span>
          ${spell.components.map(c => `<span class="detail-tag">${c}</span>`).join('')}
        </div>
        <div class="detail-stats">
          <div class="detail-stat">
            <div class="detail-stat-label">Wirkzeit</div>
            <div class="detail-stat-value">${spell.casting_time}</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Reichweite</div>
            <div class="detail-stat-value">${spell.range}</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Dauer</div>
            <div class="detail-stat-value">${spell.duration}</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Klassen</div>
            <div class="detail-stat-value">${(spell.classes || []).join(', ')}</div>
          </div>
        </div>
        <p class="detail-desc">${spell.description}</p>
        <button class="btn-add" id="btn-add-spell" ${owned ? 'disabled' : ''}>
          ${owned ? '✓ Bereits bekannt' : '+ Zum Charakter hinzufügen'}
        </button>
        ${owned ? `<button class="btn-secondary" id="btn-remove-spell" style="width:100%;margin-top:6px;">Entfernen</button>` : ''}
      </div>
    `;

    container.querySelector('#btn-add-spell')?.addEventListener('click', () => {
      if (Character.addSpell(spell.id)) {
        showToast(`✨ ${spell.name} hinzugefügt!`);
        renderDetail(spell);
        renderList();
        updateCharSummary();
      }
    });

    container.querySelector('#btn-remove-spell')?.addEventListener('click', () => {
      Character.removeSpell(spell.id);
      showToast(`${spell.name} entfernt`);
      renderDetail(spell);
      renderList();
      updateCharSummary();
    });
  }

  function updateCharSummary() {
    const spells = Character.data.spellIds.map(id => DnDData.getSpellById(id)).filter(Boolean);
    const count = document.getElementById('char-spell-count');
    const list  = document.getElementById('char-spells-summary');
    if (count) count.textContent = spells.length;
    if (list) {
      list.innerHTML = spells.slice(0, 8).map(s => `
        <div class="summary-item">
          <span>${s.name}</span>
          <button class="btn-remove" data-id="${s.id}" title="Entfernen">✕</button>
        </div>
      `).join('');
      if (spells.length > 8) {
        list.innerHTML += `<div style="font-size:12px;color:#8a7060;text-align:center;">+${spells.length - 8} weitere</div>`;
      }
      list.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          Character.removeSpell(btn.dataset.id);
          updateCharSummary();
          renderList();
        });
      });
    }
  }

  return { init, updateCharSummary };
})();

window.SpellsUI = SpellsUI;
