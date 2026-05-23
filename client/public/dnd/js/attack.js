/**
 * attack.js — Angriffs-Rechner
 * Automatische ATK-Bonus und Schadens-Berechnung aus Waffe + Charakter-Stats
 */

const AttackUI = (() => {

  // Waffen-Datenbank (aus items.json gefiltert + häufige Extras)
  const WEAPON_TYPES = [
    // id, name, dmgDie, dmgType, ability, finesse, ranged, versatile
    { id:'longsword',    name:'Longsword',       die:'1d8',  type:'slashing',    ab:'str', versatile:'1d10' },
    { id:'shortsword',   name:'Shortsword',      die:'1d6',  type:'piercing',    ab:'dex', finesse:true },
    { id:'greatsword',   name:'Greatsword',      die:'2d6',  type:'slashing',    ab:'str' },
    { id:'greataxe',     name:'Greataxe',        die:'1d12', type:'slashing',    ab:'str' },
    { id:'handaxe',      name:'Handaxe',         die:'1d6',  type:'slashing',    ab:'str', thrown:true },
    { id:'battleaxe',    name:'Battleaxe',       die:'1d8',  type:'slashing',    ab:'str', versatile:'1d10' },
    { id:'dagger',       name:'Dagger',          die:'1d4',  type:'piercing',    ab:'str', finesse:true, thrown:true },
    { id:'rapier',       name:'Rapier',          die:'1d8',  type:'piercing',    ab:'dex', finesse:true },
    { id:'scimitar',     name:'Scimitar',        die:'1d6',  type:'slashing',    ab:'dex', finesse:true },
    { id:'warhammer',    name:'Warhammer',       die:'1d8',  type:'bludgeoning', ab:'str', versatile:'1d10' },
    { id:'maul',         name:'Maul',            die:'2d6',  type:'bludgeoning', ab:'str' },
    { id:'quarterstaff', name:'Quarterstaff',    die:'1d6',  type:'bludgeoning', ab:'str', versatile:'1d8' },
    { id:'spear',        name:'Spear',           die:'1d6',  type:'piercing',    ab:'str', thrown:true, versatile:'1d8' },
    { id:'glaive',       name:'Glaive',          die:'1d10', type:'slashing',    ab:'str' },
    { id:'halberd',      name:'Halberd',         die:'1d10', type:'slashing',    ab:'str' },
    { id:'longbow',      name:'Longbow',         die:'1d8',  type:'piercing',    ab:'dex', ranged:true },
    { id:'shortbow',     name:'Shortbow',        die:'1d6',  type:'piercing',    ab:'dex', ranged:true },
    { id:'hand_crossbow',name:'Hand Crossbow',   die:'1d6',  type:'piercing',    ab:'dex', ranged:true },
    { id:'heavy_crossbow',name:'Heavy Crossbow', die:'1d10', type:'piercing',    ab:'dex', ranged:true },
    { id:'unarmed',      name:'Unarmed Strike',  die:'1',    type:'bludgeoning', ab:'str' },
  ];

  let _selected = null;

  function getMod(score) {
    return Math.floor(((score || 10) - 10) / 2);
  }

  function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }

  function rollDie(dieStr) {
    // "2d6" → Summe
    const match = dieStr.match(/^(\d+)d(\d+)$/);
    if (!match) return parseInt(dieStr) || 1;
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
  }

  function calcAttack(weapon, magicBonus, twoHanded) {
    const char   = Character.data;
    const ab     = char.abilities || {};
    const prof   = Character.getProficiencyBonus ? Character.getProficiencyBonus() : Math.ceil((char.level||1)/4)+1;

    // Ability-Mod bestimmen
    let abilityMod;
    if (weapon.finesse) {
      abilityMod = Math.max(getMod(ab.str), getMod(ab.dex));
    } else {
      abilityMod = getMod(ab[weapon.ab] || 10);
    }

    const atkBonus  = abilityMod + prof + magicBonus;
    const dmgBonus  = abilityMod + magicBonus;
    const dmgDie    = (twoHanded && weapon.versatile) ? weapon.versatile : weapon.die;

    return { atkBonus, dmgBonus, dmgDie, abilityMod, prof };
  }

  function init() {
    const container = document.getElementById('tab-character');
    if (!container) return;

    // Attack Panel in Charakter-Tab einfügen (nach combat strip, vor features)
    let panel = document.getElementById('attack-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'attack-panel';
      panel.className = 'card';
      panel.style.cssText = 'grid-column:1/-1;';

      // Nach dem Spell-Slots Card einfügen
      const slotCard = document.getElementById('spell-slots-card');
      if (slotCard) slotCard.after(panel);
      else container.appendChild(panel);
    }

    render(panel);
  }

  function render(panel) {
    if (!panel) return;

    panel.innerHTML = `
      <h3>⚔ Angriffs-Rechner</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px;">
        <div class="form-group" style="margin:0;flex:2;min-width:140px;">
          <label>Waffe</label>
          <select id="atk-weapon">
            ${WEAPON_TYPES.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;min-width:90px;">
          <label>Magischer Bonus</label>
          <select id="atk-magic">
            <option value="0">+0</option>
            <option value="1">+1</option>
            <option value="2">+2</option>
            <option value="3">+3</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;min-width:80px;" id="atk-versatile-wrap">
          <label style="white-space:nowrap;">Zweihändig?</label>
          <label style="display:flex;align-items:center;gap:6px;padding:7px 0;">
            <input type="checkbox" id="atk-twohanded" />
            <span style="font-size:13px;">Ja</span>
          </label>
        </div>
        <button class="btn-primary" id="atk-roll" style="padding:8px 16px;white-space:nowrap;">
          🎲 Würfeln
        </button>
      </div>

      <!-- Stat-Anzeige -->
      <div id="atk-stats" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;"></div>

      <!-- Roll-Log -->
      <div id="atk-log" style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;"></div>
    `;

    const updateStats = () => {
      const wId       = document.getElementById('atk-weapon')?.value;
      const magic     = parseInt(document.getElementById('atk-magic')?.value) || 0;
      const twoHanded = document.getElementById('atk-twohanded')?.checked || false;
      const weapon    = WEAPON_TYPES.find(w => w.id === wId);
      if (!weapon) return;

      // Versatile-Checkbox nur anzeigen wenn relevant
      const vWrap = document.getElementById('atk-versatile-wrap');
      if (vWrap) vWrap.style.display = weapon.versatile ? 'block' : 'none';

      const { atkBonus, dmgBonus, dmgDie, abilityMod, prof } = calcAttack(weapon, magic, twoHanded);
      const statsEl = document.getElementById('atk-stats');
      if (!statsEl) return;

      statsEl.innerHTML = `
        <div class="party-stat">
          <span class="party-stat-label">ATK-Bonus</span>
          <span class="party-stat-val" style="color:#4ade80;">${fmtMod(atkBonus)}</span>
        </div>
        <div class="party-stat">
          <span class="party-stat-label">Schaden</span>
          <span class="party-stat-val">${dmgDie}${fmtMod(dmgBonus)}</span>
        </div>
        <div class="party-stat">
          <span class="party-stat-label">Typ</span>
          <span class="party-stat-val" style="font-size:11px;">${weapon.type}</span>
        </div>
        <div class="party-stat" style="font-size:10px;">
          <span class="party-stat-label">Aufschlüsselung</span>
          <span style="font-family:var(--font-body);font-size:11px;color:#8a7060;">
            Prof ${fmtMod(prof)} + ${weapon.finesse?'STR/DEX':'Stat'} ${fmtMod(abilityMod)}${magic?` + Magic +${magic}`:''}
          </span>
        </div>
      `;
    };

    document.getElementById('atk-weapon')?.addEventListener('change', updateStats);
    document.getElementById('atk-magic')?.addEventListener('change', updateStats);
    document.getElementById('atk-twohanded')?.addEventListener('change', updateStats);

    document.getElementById('atk-roll')?.addEventListener('click', () => {
      const wId       = document.getElementById('atk-weapon')?.value;
      const magic     = parseInt(document.getElementById('atk-magic')?.value) || 0;
      const twoHanded = document.getElementById('atk-twohanded')?.checked || false;
      const weapon    = WEAPON_TYPES.find(w => w.id === wId);
      if (!weapon) return;

      const { atkBonus, dmgBonus, dmgDie } = calcAttack(weapon, magic, twoHanded);

      // Angriffswurf
      const d20     = Math.floor(Math.random() * 20) + 1;
      const atkTotal= d20 + atkBonus;
      const isCrit  = d20 === 20;
      const isFail  = d20 === 1;

      // Schadenswurf (bei Krit: doppelte Würfel)
      let dmgRolled = rollDie(dmgDie);
      if (isCrit) dmgRolled += rollDie(dmgDie);
      const dmgTotal = dmgRolled + dmgBonus;

      const log = document.getElementById('atk-log');
      if (!log) return;

      const entry = document.createElement('div');
      entry.style.cssText = `
        display:flex;align-items:center;gap:10px;padding:8px 12px;
        background:${isCrit?'rgba(201,150,42,0.15)':isFail?'rgba(139,26,26,0.1)':'rgba(255,255,255,0.5)'};
        border:1px solid ${isCrit?'var(--gold)':isFail?'var(--blood)':'rgba(200,165,90,0.25)'};
        border-radius:4px;font-family:var(--font-title);
      `;
      entry.innerHTML = `
        <span style="font-size:11px;color:#8a7060;flex-shrink:0;">
          ${weapon.name}${magic>0?' +'+magic:''}
        </span>
        <span style="flex:1;"></span>
        ${isCrit ? '<span style="color:var(--gold);font-size:12px;">⚡ KRIT!</span>' : ''}
        ${isFail ? '<span style="color:var(--blood);font-size:12px;">💀 PATZER</span>' : ''}
        <span style="font-size:12px;color:var(--ink-light);">
          ATK: <strong style="color:${isCrit?'var(--gold)':isFail?'var(--blood)':'var(--ink)'};">
            ${isFail?'MISS':fmtMod(atkTotal)}
          </strong>
          (W20: ${d20})
        </span>
        <span style="font-size:12px;color:var(--ink-light);">
          DMG: <strong style="color:var(--blood);">${isFail?'–':dmgTotal}</strong>
          ${isCrit?'(Krit: 2×'+dmgDie+')':'('+dmgDie+')'}
          ${dmgBonus!==0?fmtMod(dmgBonus):''}
        </span>
      `;
      log.insertBefore(entry, log.firstChild);

      // Max 8 Einträge
      while (log.children.length > 8) log.removeChild(log.lastChild);
    });

    updateStats();
  }

  return { init };
})();

window.AttackUI = AttackUI;
