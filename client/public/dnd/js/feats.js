/**
 * feats.js — Feats UI (Liste, Suche, Detail, Charakter-Integration)
 */

const FeatsUI = (() => {
  let _selected = null;

  function init() {
    populateFilters();
    renderList();
    bindSearch();
  }

  function populateFilters() {
    const tagSel = document.getElementById('feat-filter-tag');
    if (!tagSel) return;
    const tags = [...new Set(DnDData.feats.flatMap(f => f.tags || []))].sort();
    tags.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      tagSel.appendChild(opt);
    });
  }

  function bindSearch() {
    document.getElementById('feat-search')?.addEventListener('input', renderList);
    document.getElementById('feat-filter-category')?.addEventListener('change', renderList);
    document.getElementById('feat-filter-tag')?.addEventListener('change', renderList);
  }

  function filtered() {
    const q    = (document.getElementById('feat-search')?.value || '').toLowerCase();
    const category = document.getElementById('feat-filter-category')?.value;
    const tag  = document.getElementById('feat-filter-tag')?.value;
    return DnDData.feats.filter(f => {
      if (q    && !f.name.toLowerCase().includes(q) && !f.description.toLowerCase().includes(q)) return false;
      if (category && f.category !== category) return false;
      if (tag  && !(f.tags||[]).includes(tag)) return false;
      return true;
    });
  }

  function renderList() {
    const container = document.getElementById('feat-list');
    if (!container) return;
    const feats = filtered();
    container.innerHTML = '';

    if (!feats.length) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#8a7060;font-style:italic;">Keine Feats gefunden</div>';
      return;
    }

    feats.forEach(feat => {
      const owned = (Character.data.featIds || []).includes(feat.id);
      const div = document.createElement('div');
      div.className = 'list-item' + (feat.id === _selected ? ' selected' : '');
      div.innerHTML = `
        ${feat.category ? `<span class="detail-tag" style="font-size:9px;flex-shrink:0;">${feat.category}</span>` : ''}
        <span class="list-item-name">${feat.name}</span>
        ${feat.prerequisite ? `<span class="list-item-tag" style="font-size:10px;" title="Voraussetzung: ${feat.prerequisite}">⚠</span>` : ''}
        ${owned ? '<span style="color:#2c5a2c;font-size:12px;flex-shrink:0;">✓</span>' : ''}
        ${feat._custom ? `<span class="list-delete-btn" title="Löschen">✕</span>` : ''}
      `;
      div.addEventListener('click', e => {
        if (e.target.classList.contains('list-delete-btn')) {
          e.stopPropagation();
          if (confirm(`"${feat.name}" wirklich löschen?`)) {
            DnDData.deleteEntry('feat', feat.id);
            _selected = null;
            renderList();
            document.getElementById('feat-detail').innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div><p>Wähle einen Feat aus</p></div>';
            updateCharSummary();
            showToast(`🗑 ${feat.name} gelöscht`);
          }
          return;
        }
        _selected = feat.id;
        renderList();
        renderDetail(feat);
      });
      container.appendChild(div);
    });
  }

  function renderDetail(feat) {
    const container = document.getElementById('feat-detail');
    if (!container) return;
    const owned = (Character.data.featIds || []).includes(feat.id);
    container.innerHTML = `
      <div class="detail-content">
        <h2>${feat.name}</h2>
        <div class="detail-tags">
${feat.category ? `<span class="detail-tag" style="background:rgba(201,150,42,0.1);">${feat.category}</span>` : ''}
          ${(feat.tags||[]).map(t=>`<span class="detail-tag">${t}</span>`).join('')}
          ${feat.prerequisite ? `<span class="detail-tag" style="border-color:orange;color:#a06010;">⚠ ${feat.prerequisite}</span>` : ''}
        </div>
        <p class="detail-desc">${feat.description}</p>
        ${feat.benefits?.length ? `
          <div style="margin-bottom:14px;">
            <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Vorteile</div>
            <ul style="list-style:none;display:flex;flex-direction:column;gap:4px;">
              ${feat.benefits.map(b=>`
                <li style="display:flex;align-items:flex-start;gap:6px;font-size:14px;color:var(--ink-light);">
                  <span style="color:var(--gold);flex-shrink:0;margin-top:1px;">◆</span>${b}
                </li>`).join('')}
            </ul>
          </div>` : ''}
        <button class="btn-add" id="btn-add-feat" ${owned?'disabled':''}>
          ${owned ? '✓ Bereits gewählt' : '+ Zum Charakter hinzufügen'}
        </button>
        ${owned ? `<button class="btn-secondary" id="btn-remove-feat" style="width:100%;margin-top:6px;">Entfernen</button>` : ''}
      </div>
    `;

    container.querySelector('#btn-add-feat')?.addEventListener('click', () => {
      if (!Character.data.featIds) Character.update({ featIds: [] });
      Character.data.featIds.push(feat.id);
      Character.save();
      showToast(`⭐ ${feat.name} hinzugefügt!`);
      renderDetail(feat);
      renderList();
      updateCharSummary();
    });
    container.querySelector('#btn-remove-feat')?.addEventListener('click', () => {
      Character.update({ featIds: (Character.data.featIds||[]).filter(id=>id!==feat.id) });
      showToast(`${feat.name} entfernt`);
      renderDetail(feat);
      renderList();
      updateCharSummary();
    });
  }

  function updateCharSummary() {
    const ids   = Character.data.featIds || [];
    const feats = ids.map(id => DnDData.getFeatById(id)).filter(Boolean);
    // Charakter-Tab Summary aktualisieren
    const countEl = document.getElementById('char-feat-count');
    const listEl  = document.getElementById('char-feats-summary');
    if (countEl) countEl.textContent = feats.length;
    if (listEl) {
      listEl.innerHTML = feats.map(f => `
        <div class="summary-item">
          <span>${f.name}</span>
          <button class="btn-remove" data-id="${f.id}" title="Entfernen">✕</button>
        </div>
      `).join('') || '<span style="font-style:italic;color:#8a7060;font-size:13px;">Noch keine Feats gewählt</span>';
      listEl.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          Character.update({ featIds: (Character.data.featIds||[]).filter(id=>id!==btn.dataset.id) });
          updateCharSummary();
          renderList();
        });
      });
    }
  }

  return { init, updateCharSummary };
})();
window.FeatsUI = FeatsUI;
