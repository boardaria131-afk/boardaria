/**
 * combat.js — Combat Strip + Rast-System
 * Sticky HP-Tracker, Temp HP, AC, Speed, Kurze/Lange Rast
 */

const CombatUI = (() => {

  // ── Update Strip ──────────────────────────────────────────────────────────
  function update() {
    const char = Character.data;
    const hpCur  = parseInt(char.hp_current) || 0;
    const hpMax  = parseInt(char.hp_max)     || 1;
    const hpTemp = parseInt(char.hp_temp)    || 0;
    const ratio  = hpCur / hpMax;

    const elCur  = document.getElementById('cs-hp-current');
    const elMax  = document.getElementById('cs-hp-max');
    const elTemp = document.getElementById('cs-temp-val');
    const elAC   = document.getElementById('cs-ac-val');
    const elSpd  = document.getElementById('cs-speed-val');
    const block  = document.querySelector('.cs-hp');

    if (elCur)  elCur.textContent  = hpCur;
    if (elMax)  elMax.textContent  = hpMax;
    if (elTemp) elTemp.textContent = hpTemp;
    if (elAC)   elAC.textContent   = char.ac   || 10;
    if (elSpd)  elSpd.textContent  = (char.speed || 30) + ' ft';

    if (block) {
      block.classList.remove('danger','warning');
      if (ratio <= 0.25) block.classList.add('danger');
      else if (ratio <= 0.5) block.classList.add('warning');
    }
  }

  // ── HP ändern ─────────────────────────────────────────────────────────────
  function changeHP(delta) {
    const char   = Character.data;
    const hpTemp = parseInt(char.hp_temp) || 0;
    let   hpCur  = parseInt(char.hp_current) || 0;
    const hpMax  = parseInt(char.hp_max) || 1;

    if (delta < 0) {
      // Schaden: erst Temp HP abziehen
      const dmg = Math.abs(delta);
      if (hpTemp > 0) {
        const absorbed = Math.min(hpTemp, dmg);
        const remaining = dmg - absorbed;
        Character.update({
          hp_temp:    hpTemp - absorbed,
          hp_current: Math.max(0, hpCur - remaining),
        });
      } else {
        Character.update({ hp_current: Math.max(0, hpCur + delta) });
      }
    } else {
      // Heilung: max = hp_max
      Character.update({ hp_current: Math.min(hpMax, hpCur + delta) });
    }
    update();
    // HP-Feld im Charakter-Tab mitaktualisieren
    const inp = document.getElementById('char-hp-current');
    if (inp) inp.value = Character.data.hp_current;
  }

  function changeTempHP(delta) {
    const cur = parseInt(Character.data.hp_temp) || 0;
    Character.update({ hp_temp: Math.max(0, cur + delta) });
    update();
  }

  // ── HP-Popup (Direkteingabe) ──────────────────────────────────────────────
  function showHPPopup(type, anchorEl) {
    document.getElementById('hp-popup-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'hp-popup-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:299;';
    overlay.addEventListener('click', () => overlay.remove());

    const rect = anchorEl.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'hp-popup';
    popup.style.cssText = `top:${rect.bottom + 8}px;left:${Math.max(8, rect.left - 60)}px;`;
    popup.addEventListener('click', e => e.stopPropagation());

    const isDmg = type === 'damage';
    popup.innerHTML = `
      <div style="font-family:var(--font-title);font-size:10px;color:${isDmg?'#f87171':'#4ade80'};
        text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;text-align:center;">
        ${isDmg ? '⚔ Schaden' : '💚 Heilung'}
      </div>
      <input type="number" id="hp-popup-val" min="0" max="999" placeholder="${isDmg?'Schaden':'HP'}"
        style="background:rgba(255,255,255,0.08);border:1px solid ${isDmg?'rgba(248,113,113,0.5)':'rgba(74,222,128,0.5)'};
        border-radius:4px;color:${isDmg?'#f87171':'#4ade80'};" />
      <div class="hp-popup-btns">
        <button class="btn-secondary" id="hp-popup-cancel" style="font-size:11px;">✕</button>
        <button class="${isDmg?'btn-damage':'btn-primary'}" id="hp-popup-ok"
          style="font-size:11px;background:${isDmg?'rgba(139,26,26,0.3)':''};">
          ${isDmg ? '⚔ Schaden' : '💚 Heilen'}
        </button>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    const input = document.getElementById('hp-popup-val');
    setTimeout(() => input?.focus(), 50);

    const apply = () => {
      const val = parseInt(input?.value) || 0;
      if (val > 0) changeHP(isDmg ? -val : val);
      overlay.remove();
      showToast(isDmg
        ? `⚔ ${val} Schaden — HP: ${Character.data.hp_current}/${Character.data.hp_max}`
        : `💚 ${val} geheilt — HP: ${Character.data.hp_current}/${Character.data.hp_max}`);
    };

    document.getElementById('hp-popup-ok')?.addEventListener('click', apply);
    document.getElementById('hp-popup-cancel')?.addEventListener('click', () => overlay.remove());
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });
  }

  // ── Kurze Rast ────────────────────────────────────────────────────────────
  function shortRest() {
    const char  = Character.data;
    const level = parseInt(char.level) || 1;
    const cls   = DnDData.getClassById(char.classId);
    const hitDie = cls?.hit_die || 8;
    const conMod = Math.floor(((char.abilities?.con || 10) - 10) / 2);

    // Hit Die würfeln
    const rolled = Math.floor(Math.random() * hitDie) + 1;
    const healed = Math.max(1, rolled + conMod);
    const newHP  = Math.min(char.hp_max, (char.hp_current || 0) + healed);

    // Warlock Pact Slots zurücksetzen
    const updates = {
      hp_current:    newHP,
      pactSlotsUsed: 0,
    };

    Character.update(updates);
    update();
    SpellSlotUI.renderSpellSlots();

    showToast(`☕ Kurze Rast — Trefferwürfel 1d${hitDie}: ${rolled} + CON ${conMod >= 0 ? '+' : ''}${conMod} = +${healed} HP`);
  }

  // ── Lange Rast ────────────────────────────────────────────────────────────
  function longRest() {
    const char = Character.data;
    const updates = {
      hp_current:      char.hp_max,
      hp_temp:         0,
      spellSlotsUsed:  [0,0,0,0,0,0,0,0,0],
      pactSlotsUsed:   0,
      conditions:      (char.conditions || []).filter(c =>
        // Diese Conditions bleiben nach langer Rast
        ['exhaustion_1','exhaustion_2','exhaustion_3','exhaustion_4','exhaustion_5'].includes(c)
      ).map(c => {
        // Erschöpfung um 1 Stufe reduzieren
        const map = {
          exhaustion_5: 'exhaustion_4',
          exhaustion_4: 'exhaustion_3',
          exhaustion_3: 'exhaustion_2',
          exhaustion_2: 'exhaustion_1',
          exhaustion_1: null,
        };
        return map[c];
      }).filter(Boolean),
    };

    Character.update(updates);
    update();
    SpellSlotUI.renderSpellSlots();
    ConditionsUI.render();

    // HP-Feld aktualisieren
    const inp = document.getElementById('char-hp-current');
    if (inp) inp.value = Character.data.hp_current;

    showToast('🌙 Lange Rast — alle HP und Spell Slots wiederhergestellt!');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    update();

    // HP +/-
    document.getElementById('cs-hp-minus')?.addEventListener('click', () =>
      showHPPopup('damage', document.getElementById('cs-hp-minus')));
    document.getElementById('cs-hp-plus')?.addEventListener('click', () =>
      showHPPopup('heal', document.getElementById('cs-hp-plus')));

    // Temp HP +/-
    document.getElementById('cs-temp-minus')?.addEventListener('click', () => changeTempHP(-1));
    document.getElementById('cs-temp-plus')?.addEventListener('click', () => changeTempHP(1));

    // Rasten
    document.getElementById('cs-short-rest')?.addEventListener('click', () => {
      if (confirm('Kurze Rast einlegen? (Trefferwürfel würfeln, Warlock-Slots zurück)')) shortRest();
    });
    document.getElementById('cs-long-rest')?.addEventListener('click', () => {
      if (confirm('Lange Rast einlegen? (Alle HP, alle Spell Slots, Conditions zurückgesetzt)')) longRest();
    });
  }

  return { init, update };
})();

window.CombatUI = CombatUI;
