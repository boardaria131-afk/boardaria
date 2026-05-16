/**
 * conditions.js — Zustands-Tracker für Spieler-Charaktere
 * Alle D&D 5e Conditions mit Kurzbeschreibung
 */

const ConditionsUI = (() => {

  const CONDITIONS = [
    { id:'blinded',       name:'Blind',         icon:'👁️‍🗨️', color:'#6b7280',
      desc:'• Angriffe gegen dich: Vorteil\n• Deine Angriffe: Nachteil\n• Kann keine Sicht-abhängigen Proben machen' },
    { id:'charmed',       name:'Bezaubert',      icon:'💕', color:'#ec4899',
      desc:'• Kannst die bezaubernde Kreatur nicht angreifen oder gezielt schädigen\n• Bezauberer hat Vorteil auf soziale Proben gegen dich' },
    { id:'deafened',      name:'Taub',           icon:'🔇', color:'#78716c',
      desc:'• Kann keine Geräusche hören\n• Automatisch fehlschlagen bei Proben die Hören erfordern' },
    { id:'exhaustion_1',  name:'Erschöpfung 1',  icon:'😓', color:'#f59e0b',
      desc:'• Nachteil auf Fertigkeitsproben' },
    { id:'exhaustion_2',  name:'Erschöpfung 2',  icon:'😫', color:'#f97316',
      desc:'• Nachteil auf Fertigkeitsproben\n• Bewegungsgeschwindigkeit halbiert' },
    { id:'exhaustion_3',  name:'Erschöpfung 3',  icon:'🥵', color:'#ef4444',
      desc:'• Nachteil auf Fertigkeitsproben\n• Geschwindigkeit halbiert\n• Nachteil auf Angriffswürfe und Rettungswürfe' },
    { id:'exhaustion_4',  name:'Erschöpfung 4',  icon:'💀', color:'#dc2626',
      desc:'• Alle vorherigen +\n• Maximale TP halbiert' },
    { id:'exhaustion_5',  name:'Erschöpfung 5',  icon:'☠️', color:'#991b1b',
      desc:'• Alle vorherigen +\n• Geschwindigkeit = 0' },
    { id:'frightened',    name:'Verängstigt',    icon:'😱', color:'#7c3aed',
      desc:'• Nachteil auf Proben/Angriffe wenn Furchtquelle sichtbar\n• Kann sich nicht freiwillig auf Furchtquelle zubewegen' },
    { id:'grappled',      name:'Gegriffen',      icon:'🤼', color:'#0891b2',
      desc:'• Bewegungsgeschwindigkeit = 0\n• Endet wenn Greifer kampfunfähig oder außer Reichweite' },
    { id:'incapacitated', name:'Kampfunfähig',   icon:'💫', color:'#64748b',
      desc:'• Kann keine Aktionen oder Reaktionen nutzen' },
    { id:'invisible',     name:'Unsichtbar',     icon:'👻', color:'#a78bfa',
      desc:'• Nur durch spezielle Sinne lokalisierbar\n• Angriffe gegen dich: Nachteil\n• Deine Angriffe: Vorteil' },
    { id:'paralyzed',     name:'Gelähmt',        icon:'⚡', color:'#fbbf24',
      desc:'• Kampfunfähig, kann sich nicht bewegen oder sprechen\n• Automatisch fehlschlagen STR/DEX Rettungswürfe\n• Angriffe gegen dich: Vorteil, Treffer in 5 ft = Kritisch' },
    { id:'petrified',     name:'Versteint',      icon:'🗿', color:'#92400e',
      desc:'• Verwandelt in feste Substanz (Stein)\n• Kampfunfähig, kann sich nicht bewegen\n• Resistenz gegen alle Schadenstypen\n• Immun gegen Gift und Krankheit' },
    { id:'poisoned',      name:'Vergiftet',      icon:'🤢', color:'#16a34a',
      desc:'• Nachteil auf Angriffswürfe\n• Nachteil auf Fertigkeitsproben' },
    { id:'prone',         name:'Liegend',        icon:'⬇️', color:'#b45309',
      desc:'• Kann nur kriechen (kostet doppelte Bewegung)\n• Nachteil auf Angriffswürfe\n• Nahkampf gegen dich: Vorteil, Fernkampf: Nachteil' },
    { id:'restrained',    name:'Festgehalten',   icon:'🔒', color:'#1d4ed8',
      desc:'• Bewegungsgeschwindigkeit = 0\n• Nachteil auf Angriffswürfe\n• Angriffe gegen dich: Vorteil\n• Nachteil auf DEX Rettungswürfe' },
    { id:'stunned',       name:'Betäubt',        icon:'💥', color:'#be185d',
      desc:'• Kampfunfähig, kann sich nicht bewegen\n• Kann nur stotternd sprechen\n• Automatisch fehlschlagen STR/DEX Rettungswürfe\n• Angriffe gegen dich: Vorteil' },
    { id:'unconscious',   name:'Bewusstlos',     icon:'💤', color:'#374151',
      desc:'• Kampfunfähig, kann sich nicht bewegen oder sprechen\n• Fallen lassen was gehalten wird\n• Automatisch fehlschlagen STR/DEX Rettungswürfe\n• Angriffe Vorteil, Nahkampftreffer = Kritisch' },
    { id:'concentration', name:'Konzentration',  icon:'🧠', color:'#0e7490',
      desc:'• Du hältst Konzentration auf einen Zauber\n• Schaden → CON-Rettungswurf (SG 10 oder halber Schaden)\n• Nur ein Konzentrationszauber gleichzeitig möglich' },
    { id:'raging',        name:'Wütend (Rage)',  icon:'🔥', color:'#dc2626',
      desc:'• Vorteil auf STR-Proben und Rettungswürfe\n• +2/+3/+4 Schadensbonus (Level-abhängig)\n• Resistenz gegen Hieb/Stich/Wuchtschaden' },
    { id:'hidden',        name:'Versteckt',      icon:'🫥', color:'#4b5563',
      desc:'• Angreifer wissen nicht wo du bist\n• Angriffe gegen dich: Nachteil\n• Deine Angriffe aus Versteck: Vorteil' },
    { id:'inspiration',   name:'Inspiration',    icon:'⭐', color:'#d97706',
      desc:'• Kannst einmalig Vorteil auf einen Angriff, Probe oder Rettungswurf nutzen\n• Wird verbraucht wenn genutzt' },
    { id:'death_save_1',  name:'Todessave 1✓',  icon:'💔', color:'#dc2626',
      desc:'• 1 erfolgreicher Todessave\n• Benötigst 3 Erfolge um zu stabilisieren' },
    { id:'death_save_2',  name:'Todessave 2✓',  icon:'💔', color:'#dc2626',
      desc:'• 2 erfolgreiche Todessaves\n• Noch 1 Erfolg zum Stabilisieren' },
  ];

  function getActive() {
    return Character.data.conditions || [];
  }

  function toggleCondition(id) {
    const active = [...getActive()];
    const idx = active.indexOf(id);
    if (idx >= 0) active.splice(idx, 1);
    else active.push(id);
    Character.update({ conditions: active });
    render();
  }

  function render() {
    const container = document.getElementById('conditions-panel');
    if (!container) return;
    const active = getActive();

    container.innerHTML = CONDITIONS.map(c => {
      const isActive = active.includes(c.id);
      return `
        <div class="condition-btn ${isActive ? 'active' : ''}"
             data-condition="${c.id}"
             data-tooltip="${c.desc.replace(/"/g,"'")}"
             style="--ccolor:${c.color};"
             title="${c.name}">
          <span class="condition-icon">${c.icon}</span>
          <span class="condition-name">${c.name}</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.condition-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleCondition(btn.dataset.condition));
    });
  }

  function init() {
    render();
  }

  return { init, render };
})();

window.ConditionsUI = ConditionsUI;
