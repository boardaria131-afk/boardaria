/**
 * spellslots.js — Spell Slot Tracker im Charakter-Tab
 */

const SpellSlotUI = (() => {

  // Klassen → Caster-Typ Mapping
  const CASTER_TYPE = {
    bard:             'full_caster',
    cleric:           'full_caster',
    druid:            'full_caster',
    sorcerer:         'full_caster',
    wizard:           'full_caster',
    paladin:          'half_caster',
    ranger:           'half_caster',
    artificer:        'artificer',
    warlock:          'warlock',
    eldritch_knight:  'third_caster',
    arcane_trickster: 'third_caster',
  };

  function getSlots(classId, subclassId, level) {
    const slots  = DnDData.spellSlots;
    let   cType  = CASTER_TYPE[classId];

    // Subklassen-Override
    if (!cType && subclassId) cType = CASTER_TYPE[subclassId];
    if (!cType) return null;  // Non-caster

    const table = slots[cType];
    if (!table) return null;

    const levelKey = String(level);

    // Warlock: eigene Struktur
    if (cType === 'warlock') {
      const w = table[levelKey];
      if (!w) return null;
      return { type: 'pact', slots: w.slots, level: w.level };
    }

    const row = table[levelKey];
    if (!row) return null;
    return { type: 'standard', slots: row };
  }

  function renderSpellSlots() {
    const container = document.getElementById('char-spell-slots');
    if (!container) return;

    const char      = Character.data;
    const classId   = char.classId;
    const subclassId = char.subclassId;
    const level     = char.level || 1;

    const slotData = getSlots(classId, subclassId, level);

    if (!slotData) {
      container.innerHTML = '<span style="font-style:italic;color:#8a7060;font-size:13px;">Diese Klasse hat keine Spell Slots</span>';
      return;
    }

    if (slotData.type === 'pact') {
      // Warlock Pact Magic
      const used = char.pactSlotsUsed || 0;
      container.innerHTML = `
        <div style="margin-bottom:8px;">
          <span style="font-family:var(--font-title);font-size:11px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;">
            Pact Magic (Kurze Rast)
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;gap:6px;">
            ${Array.from({length: slotData.slots}, (_, i) => `
              <div class="slot-bubble ${i < used ? 'used' : ''}"
                data-slot-type="pact" data-slot-i="${i}"
                title="Klick zum Ein/Ausblenden">
                ${i < used ? '○' : '●'}
              </div>`).join('')}
          </div>
          <span style="font-family:var(--font-title);font-size:12px;color:#8a7060;">
            Level ${slotData.level} · ${slotData.slots - used}/${slotData.slots} verfügbar
          </span>
          <button class="btn-secondary" id="btn-reset-pact"
            style="font-size:10px;padding:3px 8px;">Kurze Rast 🔄</button>
        </div>
      `;
    } else {
      // Standard Spell Slots
      const usedSlots = char.spellSlotsUsed || [0,0,0,0,0,0,0,0,0];
      const levelNames = ['1.','2.','3.','4.','5.','6.','7.','8.','9.'];

      const activeSlots = slotData.slots
        .map((count, i) => ({ level: i+1, count, used: usedSlots[i] || 0 }))
        .filter(s => s.count > 0);

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;">
          ${activeSlots.map(s => `
            <div style="background:rgba(255,255,255,0.5);border:1px solid rgba(200,165,90,0.3);border-radius:4px;padding:8px;text-align:center;">
              <div style="font-family:var(--font-title);font-size:10px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
                ${levelNames[s.level-1]} Level
              </div>
              <div style="display:flex;justify-content:center;gap:4px;flex-wrap:wrap;margin-bottom:6px;">
                ${Array.from({length: s.count}, (_, i) => `
                  <span class="slot-bubble ${i < s.used ? 'used' : ''}"
                    data-slot-level="${s.level}" data-slot-i="${i}"
                    title="Klick: Slot nutzen/wiederherstellen">
                    ${i < s.used ? '○' : '●'}
                  </span>`).join('')}
              </div>
              <div style="font-family:var(--font-title);font-size:11px;color:#8a7060;">
                ${s.count - s.used}/${s.count}
              </div>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn-secondary" id="btn-reset-slots" style="font-size:10px;padding:4px 10px;">Lange Rast 🌙</button>
          <span style="font-size:12px;color:#8a7060;align-self:center;font-style:italic;">Klick auf ● nutzt einen Slot</span>
        </div>
      `;

      // Slot-Click
      container.querySelectorAll('.slot-bubble[data-slot-level]').forEach(bubble => {
        bubble.addEventListener('click', () => {
          const lvl  = parseInt(bubble.dataset.slotLevel) - 1;
          const used = [...(Character.data.spellSlotsUsed || [0,0,0,0,0,0,0,0,0])];
          const max  = slotData.slots[lvl];
          used[lvl]  = used[lvl] >= max ? 0 : (used[lvl] || 0) + 1;
          Character.update({ spellSlotsUsed: used });
          renderSpellSlots();
        });
      });

      // Lange Rast
      container.querySelector('#btn-reset-slots')?.addEventListener('click', () => {
        Character.update({ spellSlotsUsed: [0,0,0,0,0,0,0,0,0] });
        renderSpellSlots();
        showToast('🌙 Lange Rast — alle Spell Slots wiederhergestellt!');
      });
    }

    // Pact Magic Events
    container.querySelectorAll('.slot-bubble[data-slot-type="pact"]').forEach(bubble => {
      bubble.addEventListener('click', () => {
        const max  = slotData.slots;
        const used = (Character.data.pactSlotsUsed || 0);
        Character.update({ pactSlotsUsed: used >= max ? 0 : used + 1 });
        renderSpellSlots();
      });
    });

    container.querySelector('#btn-reset-pact')?.addEventListener('click', () => {
      Character.update({ pactSlotsUsed: 0 });
      renderSpellSlots();
      showToast('⚡ Kurze Rast — Pact Magic wiederhergestellt!');
    });
  }

  function init() { renderSpellSlots(); }

  return { init, renderSpellSlots };
})();

window.SpellSlotUI = SpellSlotUI;
