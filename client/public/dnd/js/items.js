/**
 * items.js — Items UI (Liste, Suche, Detail, Charakter-Integration)
 */

const ItemsUI = (() => {
  let _selected = null;

  const RARITY_COLOR = {
    'Common':    '#6b7280',
    'Uncommon':  '#22c55e',
    'Rare':      '#3b82f6',
    'Very Rare': '#a855f7',
    'Legendary': '#f59e0b',
  };

  function init() {
    populateTypeFilter();
    renderList();
    bindSearch();
  }

  function populateTypeFilter() {
    const sel = document.getElementById('item-filter-type');
    if (!sel) return;
    const types = [...new Set(DnDData.items.map(i => i.type))].sort();
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });
  }

  function bindSearch() {
    document.getElementById('item-search')?.addEventListener('input', renderList);
    document.getElementById('item-filter-type')?.addEventListener('change', renderList);
  }

  function filteredItems() {
    const query = (document.getElementById('item-search')?.value || '').toLowerCase();
    const type  = document.getElementById('item-filter-type')?.value;

    return DnDData.items.filter(i => {
      if (query && !i.name.toLowerCase().includes(query)) return false;
      if (type  && i.type !== type) return false;
      return true;
    });
  }

  function rarityDot(rarity) {
    const color = RARITY_COLOR[rarity] || '#6b7280';
    return `<span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>`;
  }

  function renderList() {
    const container = document.getElementById('item-list');
    if (!container) return;
    const items = filteredItems();
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#8a7060;font-style:italic;">Keine Items gefunden</div>';
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'list-item' + (item.id === _selected ? ' selected' : '');
      div.innerHTML = `
        ${rarityDot(item.rarity)}
        <span class="list-item-name">${item.name}</span>
        <span class="list-item-tag">${item.type}</span>
        ${item._custom ? `<span class="list-delete-btn" title="Löschen">✕</span>` : ''}
      `;
      div.addEventListener('click', e => {
        if (e.target.classList.contains('list-delete-btn')) {
          e.stopPropagation();
          if (confirm(`"${item.name}" wirklich löschen?`)) {
            DnDData.deleteEntry('item', item.id);
            // Alle Instanzen aus Inventar entfernen
            while (Character.data.itemIds.includes(item.id)) Character.removeItem(item.id);
            _selected = null;
            renderList();
            document.getElementById('item-detail').innerHTML = '<div class="empty-state"><div class="empty-icon">🎒</div><p>Wähle ein Item aus</p></div>';
            updateCharSummary();
            showToast(`🗑 ${item.name} gelöscht`);
          }
          return;
        }
        _selected = item.id;
        renderList();
        renderDetail(item);
      });
      container.appendChild(div);
    });
  }

  function renderDetail(item) {
    const container = document.getElementById('item-detail');
    if (!container) return;
    const rarityColor = RARITY_COLOR[item.rarity] || '#6b7280';

    const stats = [];
    if (item.damage)  stats.push(['Schaden', item.damage]);
    if (item.ac)      stats.push(['Rüstungsklasse', item.ac]);
    if (item.effect)  stats.push(['Effekt', item.effect]);
    if (item.weight)  stats.push(['Gewicht', item.weight]);
    if (item.cost)    stats.push(['Kosten', item.cost]);

    container.innerHTML = `
      <div class="detail-content">
        <h2>${item.name}</h2>
        <div class="detail-tags">
          <span class="detail-tag">${item.type}</span>
          <span class="detail-tag" style="border-color:${rarityColor};color:${rarityColor};">${item.rarity}</span>
        </div>
        ${stats.length > 0 ? `
          <div class="detail-stats">
            ${stats.map(([label, val]) => `
              <div class="detail-stat">
                <div class="detail-stat-label">${label}</div>
                <div class="detail-stat-value">${val}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${item.properties?.length ? `
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
            ${item.properties.map(p => `<span class="detail-tag">${p}</span>`).join('')}
          </div>
        ` : ''}
        <p class="detail-desc">${item.description}</p>
        <button class="btn-add" id="btn-add-item">+ Zum Inventar hinzufügen</button>
      </div>
    `;

    container.querySelector('#btn-add-item')?.addEventListener('click', () => {
      Character.addItem(item.id);
      showToast(`🎒 ${item.name} hinzugefügt!`);
      updateCharSummary();
    });
  }

  function updateCharSummary() {
    // Zähle Items (mit Mehrfach-Mengen)
    const ids = Character.data.itemIds;
    const counts = {};
    ids.forEach(id => counts[id] = (counts[id] || 0) + 1);

    const count = document.getElementById('char-item-count');
    const list  = document.getElementById('char-items-summary');
    if (count) count.textContent = ids.length;

    if (list) {
      const unique = Object.keys(counts);
      list.innerHTML = unique.slice(0, 8).map(id => {
        const item = DnDData.getItemById(id);
        if (!item) return '';
        const qty = counts[id];
        return `
          <div class="summary-item">
            <span>${item.name}${qty > 1 ? ` ×${qty}` : ''}</span>
            <button class="btn-remove" data-id="${id}" title="Entfernen">✕</button>
          </div>
        `;
      }).join('');
      if (unique.length > 8) {
        list.innerHTML += `<div style="font-size:12px;color:#8a7060;text-align:center;">+${unique.length - 8} weitere</div>`;
      }
      list.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          Character.removeItem(btn.dataset.id);
          updateCharSummary();
        });
      });
    }
  }

  return { init, updateCharSummary };
})();

window.ItemsUI = ItemsUI;

// ── Custom Item Creator ───────────────────────────────────────────────────────
function showCustomItemCreator() {
  showModal('✨ Eigenes Item erstellen', `
    <div class="form-group">
      <label>Name *</label>
      <input type="text" id="ci-name" placeholder="z.B. Schwert der Ahnen" />
    </div>
    <div style="display:flex;gap:8px;">
      <div class="form-group" style="flex:1;">
        <label>Typ</label>
        <select id="ci-type">
          <option>Weapon</option><option>Armor</option><option>Wondrous Item</option>
          <option>Potion</option><option>Ring</option><option>Rod</option>
          <option>Staff</option><option>Wand</option><option>Adventuring Gear</option>
          <option>Tool</option><option>Homebrew</option>
        </select>
      </div>
      <div class="form-group" style="flex:1;">
        <label>Seltenheit</label>
        <select id="ci-rarity">
          <option>Common</option><option>Uncommon</option><option>Rare</option>
          <option>Very Rare</option><option>Legendary</option><option>Artifact</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <div class="form-group" style="flex:1;">
        <label>Schaden / AC / Effekt</label>
        <input type="text" id="ci-effect" placeholder="z.B. 1d8+2 slashing" />
      </div>
      <div class="form-group" style="flex:1;">
        <label>Gewicht / Kosten</label>
        <input type="text" id="ci-weight" placeholder="z.B. 3 lb." />
      </div>
    </div>
    <div class="form-group">
      <label>Eigenschaften</label>
      <input type="text" id="ci-props" placeholder="z.B. Requires Attunement, Magical" />
    </div>
    <div class="form-group">
      <label>Beschreibung *</label>
      <textarea id="ci-desc" placeholder="Was macht dieses Item besonders?" style="min-height:80px;"></textarea>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="btn-primary" id="ci-save" style="flex:1;">✅ Erstellen & hinzufügen</button>
      <button class="btn-secondary" id="ci-cancel" style="flex:1;">Abbrechen</button>
    </div>
    <div id="ci-error" style="color:var(--blood);font-size:13px;margin-top:8px;"></div>
  `);

  document.getElementById('ci-save')?.addEventListener('click', () => {
    const name = document.getElementById('ci-name')?.value.trim();
    const desc = document.getElementById('ci-desc')?.value.trim();
    const errEl = document.getElementById('ci-error');

    if (!name || !desc) { errEl.textContent = '❌ Name und Beschreibung sind Pflichtfelder'; return; }

    const props = document.getElementById('ci-props')?.value
      .split(',').map(p => p.trim()).filter(Boolean);

    const customItem = {
      id:          'custom_' + Date.now().toString(36),
      name,
      type:        document.getElementById('ci-type')?.value || 'Homebrew',
      rarity:      document.getElementById('ci-rarity')?.value || 'Common',
      weight:      document.getElementById('ci-weight')?.value || '—',
      cost:        '—',
      effect:      document.getElementById('ci-effect')?.value || '',
      damage:      document.getElementById('ci-effect')?.value || '',
      properties:  props,
      description: desc,
      _custom:     true,
    };

    DnDData.importExternal({ items: [customItem] });
    Character.addItem(customItem.id);
    renderList();
    updateCharSummary();
    closeModal();
    showToast('✨ "' + name + '" erstellt und hinzugefügt!');
  });

  document.getElementById('ci-cancel')?.addEventListener('click', closeModal);
  setTimeout(() => document.getElementById('ci-name')?.focus(), 100);
}

// Custom Item Button im Items-Tab verdrahten
// Wird von app.js nach init() aufgerufen
ItemsUI.showCustomItemCreator = showCustomItemCreator;
