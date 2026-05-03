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
      `;
      div.addEventListener('click', () => {
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
