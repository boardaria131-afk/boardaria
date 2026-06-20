/**
 * conditions.js — Conditions mit Beschreibungen + Regelschnellreferenz
 */

const ConditionsUI = (() => {

  const CONDITIONS = [
    {
      id: 'blinded', name: 'Blind', icon: '👁️', color: '#6b7280',
      summary: 'Kann nicht sehen. Angriffe mit Nachteil, Angriffe gegen Creature mit Vorteil.',
      rules: [
        'Kann die Umgebung nicht sehen und besteht automatisch Checks die Sehen erfordern.',
        'Angriffswürfe gegen das blinde Creature haben Vorteil.',
        'Angriffswürfe des blinden Creatures haben Nachteil.',
      ],
    },
    {
      id: 'charmed', name: 'Bezaubert', icon: '💕', color: '#ec4899',
      summary: 'Kann den Bezauberer nicht angreifen. Bezauberer hat Vorteil auf CHA-Checks gegen das Creature.',
      rules: [
        'Das Creature kann den Bezauberer nicht angreifen oder direkt mit schädlichen Fähigkeiten oder Zaubern ins Visier nehmen.',
        'Der Bezauberer hat Vorteil auf jeden Fähigkeitswurf, um sozial mit dem Creature zu interagieren.',
      ],
    },
    {
      id: 'deafened', name: 'Taub', icon: '🔇', color: '#6b7280',
      summary: 'Kann nicht hören. Besteht automatisch Checks die Hören erfordern.',
      rules: [
        'Das Creature kann nicht hören und besteht automatisch jeden Fähigkeitswurf der das Hören erfordert.',
      ],
    },
    {
      id: 'exhaustion', name: 'Erschöpfung', icon: '😓', color: '#f59e0b',
      summary: '6 Level, jedes macht es schlimmer. Level 6 = Tod.',
      rules: [
        'Level 1: Nachteil auf Fähigkeitswürfe.',
        'Level 2: Geschwindigkeit halbiert.',
        'Level 3: Nachteil auf Angriffswürfe und Rettungswürfe.',
        'Level 4: Maximale HP halbiert.',
        'Level 5: Geschwindigkeit = 0.',
        'Level 6: Tod.',
        'Eine lange Rast reduziert Erschöpfungslevel um 1 (bei ausreichend Essen und Trinken).',
      ],
    },
    {
      id: 'frightened', name: 'Verängstigt', icon: '😱', color: '#ef4444',
      summary: 'Nachteil auf Würfe wenn Furchtquelle sichtbar. Kann sich nicht auf Quelle zubewegen.',
      rules: [
        'Nachteil auf Fähigkeitswürfe und Angriffswürfe, solange die Furchtquelle in Sichtlinie ist.',
        'Das Creature kann sich nicht freiwillig in Richtung der Furchtquelle bewegen.',
      ],
    },
    {
      id: 'grappled', name: 'Gegriffen', icon: '🤼', color: '#8b5cf6',
      summary: 'Geschwindigkeit = 0. Endet wenn Grappler bewegt wird oder Effekt endet.',
      rules: [
        'Geschwindigkeit des Creatures wird 0, und es kann keine Boni auf seine Geschwindigkeit erhalten.',
        'Der Zustand endet, wenn der Grappler kampfunfähig wird.',
        'Der Zustand endet auch, wenn ein Effekt das gegriffene Creature aus der Reichweite des Grapplers oder Greifeffekts entfernt.',
        'Um zu entkommen: Athletics-Check (STR) gegen Grapplers Athletics oder Acrobatics.',
      ],
    },
    {
      id: 'incapacitated', name: 'Kampfunfähig', icon: '💫', color: '#f59e0b',
      summary: 'Kann keine Aktionen oder Reaktionen durchführen.',
      rules: [
        'Das Creature kann keine Aktionen oder Reaktionen durchführen.',
      ],
    },
    {
      id: 'invisible', name: 'Unsichtbar', icon: '👻', color: '#06b6d4',
      summary: 'Kann nicht gesehen werden. Angriffe mit Vorteil, Angriffe gegen Creature mit Nachteil.',
      rules: [
        'Unmöglich zu sehen ohne Magie oder besonderen Sinn. Im Verstecken gilt die Creature als stark verdeckt.',
        'Angriffswürfe des unsichtbaren Creatures haben Vorteil.',
        'Angriffswürfe gegen das unsichtbare Creature haben Nachteil.',
      ],
    },
    {
      id: 'paralyzed', name: 'Gelähmt', icon: '⚡', color: '#ef4444',
      summary: 'Kann sich nicht bewegen oder sprechen. Automatisch kritische Treffer aus 5 ft.',
      rules: [
        'Das Creature ist kampfunfähig (keine Aktionen/Reaktionen) und kann sich nicht bewegen oder sprechen.',
        'Das Creature besteht STR- und DEX-Rettungswürfe automatisch nicht.',
        'Angriffswürfe gegen das Creature haben Vorteil.',
        'Jeder Treffer innerhalb von 5 Fuß ist ein kritischer Treffer.',
      ],
    },
    {
      id: 'petrified', name: 'Versteinert', icon: '🗿', color: '#9ca3af',
      summary: 'In Stein verwandelt. Kampfunfähig, Resistenz gegen allen Schaden, immun gegen Gift/Krankheit.',
      rules: [
        'Das Creature wird mitsamt allem, was es trägt oder hält, in eine inerte Substanz verwandelt (meist Stein).',
        'Das Creature ist kampfunfähig, kann sich nicht bewegen oder sprechen und ist sich seiner Umgebung nicht bewusst.',
        'Angriffswürfe gegen das Creature haben Vorteil.',
        'Das Creature besteht STR- und DEX-Rettungswürfe automatisch nicht.',
        'Das Creature hat Resistenz gegen alle Schadensarten.',
        'Das Creature ist immun gegen Gift und Krankheit.',
      ],
    },
    {
      id: 'poisoned', name: 'Vergiftet', icon: '🤢', color: '#84cc16',
      summary: 'Nachteil auf Angriffswürfe und Fähigkeitswürfe.',
      rules: [
        'Das Creature hat Nachteil auf Angriffswürfe und Fähigkeitswürfe.',
      ],
    },
    {
      id: 'prone', name: 'Liegend', icon: '⬇️', color: '#f59e0b',
      summary: 'Angriffe mit Nachteil (außer 5 ft = Vorteil). Aufstehen kostet halbe Bewegung.',
      rules: [
        'Einzige Bewegungsoption des Creatures ist zu kriechen, es sei denn, es steht auf.',
        'Das Creature hat Nachteil auf Angriffswürfe.',
        'Angriffswürfe gegen das Creature haben Vorteil, wenn der Angreifer innerhalb von 5 Fuß ist, sonst Nachteil.',
        'Aufstehen kostet Bewegung in Höhe der halben Geschwindigkeit.',
      ],
    },
    {
      id: 'restrained', name: 'Festgehalten', icon: '🔒', color: '#ef4444',
      summary: 'Geschwindigkeit = 0. Nachteil auf Angriffe und DEX-Saves. Angriffe gegen Creature mit Vorteil.',
      rules: [
        'Geschwindigkeit des Creatures wird 0, es kann keine Boni auf seine Geschwindigkeit erhalten.',
        'Angriffswürfe gegen das Creature haben Vorteil.',
        'Angriffswürfe des Creatures haben Nachteil.',
        'Das Creature hat Nachteil auf DEX-Rettungswürfe.',
      ],
    },
    {
      id: 'stunned', name: 'Betäubt', icon: '💥', color: '#f59e0b',
      summary: 'Kampfunfähig, kann sich nicht bewegen. Angriffe dagegen mit Vorteil.',
      rules: [
        'Das Creature ist kampfunfähig (keine Aktionen/Reaktionen), kann sich nicht bewegen.',
        'Kann nur sehr stockend sprechen.',
        'Das Creature besteht STR- und DEX-Rettungswürfe automatisch nicht.',
        'Angriffswürfe gegen das Creature haben Vorteil.',
      ],
    },
    {
      id: 'unconscious', name: 'Bewusstlos', icon: '💤', color: '#6b7280',
      summary: 'Kampfunfähig, liegt am Boden. Automatisch kritische Treffer aus 5 ft.',
      rules: [
        'Das Creature ist kampfunfähig, kann sich nicht bewegen oder sprechen und ist sich der Umgebung nicht bewusst.',
        'Das Creature lässt Gegenstände fallen, die es hält, fällt zu Boden und wird liegend.',
        'Das Creature besteht STR- und DEX-Rettungswürfe automatisch nicht.',
        'Angriffswürfe gegen das Creature haben Vorteil.',
        'Jeder Treffer innerhalb von 5 Fuß ist ein kritischer Treffer.',
      ],
    },
    {
      id: 'concentration', name: 'Konzentration', icon: '🧠', color: '#3b82f6',
      summary: 'Beim Schaden: CON-Save DC 10 oder halber Schaden. Scheitern = Zauber endet.',
      rules: [
        'Beim Erleiden von Schaden: CON-Rettungswurf DC 10 oder halber erlittener Schaden (je nachdem, was höher ist).',
        'Scheitern = Konzentration verloren, Zauber endet sofort.',
        'Incapacitated sein oder sterben bricht ebenfalls Konzentration.',
        'Nur ein Konzentrationszauber gleichzeitig möglich.',
      ],
    },
  ];

  const QUICK_RULES = [
    {
      id: 'advantage',
      title: 'Vorteil & Nachteil',
      icon: '🎲',
      color: '#22c55e',
      summary: 'Zwei W20 würfeln, höheres (Vorteil) oder niedrigeres (Nachteil) nehmen.',
      sections: [
        {
          title: 'Vorteil',
          text: 'Wirf zwei d20 und nimm das höhere Ergebnis. Quellen: Prone Angreifer in 5 ft, Unsichtbar, Hilfe-Aktion, bestimmte Zauber und Fähigkeiten.',
        },
        {
          title: 'Nachteil',
          text: 'Wirf zwei d20 und nimm das niedrigere Ergebnis. Quellen: Prone Ziel in mehr als 5 ft, Blind, Vergiftet, Liegendes Creature angreifen aus der Ferne.',
        },
        {
          title: 'Stacking-Regel',
          text: 'Vorteil und Nachteil heben sich auf — unabhängig von der Anzahl der Quellen. Keine doppelten Vorteile oder Nachteile.',
        },
      ],
    },
    {
      id: 'grapple',
      title: 'Greifen (Grapple)',
      icon: '🤼',
      color: '#8b5cf6',
      summary: 'Angriffs-Aktion: STR (Athletics) gegen Ziel STR (Athletics) oder DEX (Acrobatics).',
      sections: [
        {
          title: 'Greifangriff',
          text: 'Nutze eine der Attacks deiner Angriffsaktion. Ziel muss Große oder kleinere Größe haben und in Reichweite sein. STR (Athletics)-Check gegen Ziel STR (Athletics) oder DEX (Acrobatics) — Ziel wählt.',
        },
        {
          title: 'Zustand',
          text: 'Bei Erfolg: Ziel erhält Zustand "Gegriffen" (Geschwindigkeit 0). Du kannst das Creature mitschleppen (halbe Geschwindigkeit).',
        },
        {
          title: 'Entkommen',
          text: 'Ziel nutzt eine Aktion: STR (Athletics) oder DEX (Acrobatics) gegen deinen STR (Athletics). Bei Erfolg: befreit.',
        },
        {
          title: 'Endet wenn...',
          text: 'Du incapacitated wirst, oder ein Effekt das Ziel außer Reichweite bewegt.',
        },
      ],
    },
    {
      id: 'opportunity_attack',
      title: 'Gelegenheitsangriff',
      icon: '⚡',
      color: '#f59e0b',
      summary: 'Wenn ein Creature deinen Nahkampfbereich verlässt, kannst du einmal angreifen (Reaktion).',
      sections: [
        {
          title: 'Auslöser',
          text: 'Ein feindliches Creature verlässt deine Reichweite (normalerweise 5 ft) ohne sich Zurückzuziehen.',
        },
        {
          title: 'Durchführen',
          text: 'Nutze deine Reaktion für einen Nahkampfangriff gegen das Creature — sofort wenn es deine Reichweite verlässt.',
        },
        {
          title: 'Kein Gelegenheitsangriff wenn...',
          text: 'Das Creature nutzt die "Zurückziehen"-Aktion (Dash), wird teleportiert, oder bewegt sich unfreiwillig (z.B. durch Thunderwave).',
        },
      ],
    },
    {
      id: 'cover',
      title: 'Deckung (Cover)',
      icon: '🛡️',
      color: '#64748b',
      summary: 'Halb: +2 AC/DEX-Saves. Drei-Viertel: +5. Volle: kann nicht direkt angegriffen werden.',
      sections: [
        {
          title: 'Halbe Deckung',
          text: '+2 Bonus auf AC und DEX-Rettungswürfe. Mindestens die Hälfte des Körpers durch ein Hindernis verdeckt (Mauer, großes Tier, Truhe).',
        },
        {
          title: 'Drei-Viertel-Deckung',
          text: '+5 Bonus auf AC und DEX-Rettungswürfe. Etwa drei Viertel des Körpers verdeckt (Schießscharte, Türrahmen, Baumstamm).',
        },
        {
          title: 'Volle Deckung',
          text: 'Kann nicht direkt mit Zauber oder Angriffen ins Visier genommen werden. Kann dennoch durch Flächeneffekte (z.B. Fireball) getroffen werden.',
        },
      ],
    },
    {
      id: 'two_weapon',
      title: 'Zweiwaffen-Kampf',
      icon: '⚔️',
      color: '#ef4444',
      summary: 'Bonus-Aktion: zweiter Angriff mit Light-Waffe. Kein Modifier zum Schaden (außer negativ).',
      sections: [
        {
          title: 'Voraussetzungen',
          text: 'Beide Waffen müssen die "Light"-Eigenschaft haben (z.B. Shortsword, Dagger). Haupthand-Angriff muss zuerst durchgeführt werden.',
        },
        {
          title: 'Bonus-Aktion',
          text: 'Führe einen Angriff mit der Nebenhand als Bonus-Aktion durch. Der Schaden-Modifier (STR/DEX) wird NICHT zum Schaden hinzugefügt (außer er ist negativ).',
        },
        {
          title: 'Two-Weapon Fighting Style',
          text: 'Mit diesem Fighting Style kannst du den Schaden-Modifier auch zum Nebenhand-Angriff hinzufügen.',
        },
      ],
    },
    {
      id: 'hiding',
      title: 'Verstecken',
      icon: '🫥',
      color: '#06b6d4',
      summary: 'Aktion: DEX (Stealth) gegen passive Perception der Feinde.',
      sections: [
        {
          title: 'Verstecken',
          text: 'Nutze die Hide-Aktion: DEX (Stealth)-Check. Bei Erfolg: "Versteckt"-Zustand. Feinde kennen deinen Standort nicht (können aber raten).',
        },
        {
          title: 'Angriff aus dem Versteck',
          text: 'Angriff hat Vorteil. Du wirst nach dem Angriff sichtbar, egal ob du getroffen hast oder nicht.',
        },
        {
          title: 'Versteckt bleiben',
          text: 'Du bleibst versteckt, solange du dich nicht bewegst (Geräusch), angreifst oder eine andere erkennbare Aktion durchführst.',
        },
        {
          title: 'Standort erraten',
          text: 'Feinde können deinen Standort erraten (z.B. Geräusch gehört). Angriff auf vermuteten Standort mit Nachteil — Treffer nur wenn Schätzung korrekt.',
        },
      ],
    },
    {
      id: 'death_saves',
      title: 'Todessave',
      icon: '💀',
      color: '#ef4444',
      summary: 'Bei 0 HP: W20 DC 10. 3× Erfolg = stabil. 3× Fehlschlag = Tod.',
      sections: [
        {
          title: 'Ablauf',
          text: 'Zu Beginn deines Zuges bei 0 HP: W20 würfeln. 10+ = Erfolg, 9 oder weniger = Fehlschlag. Drei Erfolge = stabil, drei Fehlschläge = Tod.',
        },
        {
          title: 'Kritischer Wurf',
          text: 'Naturwert 20 = sofort 1 HP zurück (stabil + aufgewacht). Naturwert 1 = zählt als zwei Fehlschläge.',
        },
        {
          title: 'Schaden bei 0 HP',
          text: 'Weiterer Schaden bei 0 HP = ein Fehlschlag. Kritischer Treffer = zwei Fehlschläge. Schaden ≥ dein HP-Maximum = sofortiger Tod.',
        },
        {
          title: 'Stabilisieren',
          text: 'Heilspruch, Heiltrank (Bonus-Aktion), oder Medicine-Check DC 10 (Aktion) stabilisiert das Creature. Stabile Creatures würfeln keine Todessaves mehr.',
        },
      ],
    },
    {
      id: 'actions',
      title: 'Aktionen im Kampf',
      icon: '🎯',
      color: '#3b82f6',
      summary: 'Übersicht aller Aktionstypen: Aktion, Bonus-Aktion, Reaktion, freie Aktion.',
      sections: [
        {
          title: 'Aktion',
          text: 'Angriff, Zaubern, Dash (doppelte Bewegung), Zurückziehen, Ausweichen (Angriffe gegen dich mit Nachteil, DEX-Saves mit Vorteil), Helfen, Schubsen, Greifen, Suchen, Benutzen, Verstecken, Bereit machen.',
        },
        {
          title: 'Bonus-Aktion',
          text: 'Nur wenn eine Fähigkeit, Zauber oder Spielregel sie gewährt. Zweiwaffen-Kampf, bestimmte Klassenfähigkeiten (z.B. Cunning Action des Rogues), Bonus-Aktions-Zauber.',
        },
        {
          title: 'Reaktion',
          text: 'Einmal pro Runde, kann auch außerhalb des eigenen Zuges ausgelöst werden. Gelegenheitsangriff, Zauberer-Reaktionen (Counterspell, Shield), Held­haftes Inspirieren annehmen.',
        },
        {
          title: 'Freie Aktionen',
          text: 'Kommunikation (kurze Sätze), Gegenstände fallen lassen, Türen öffnen (wenn in Bewegung inkludiert).',
        },
      ],
    },
    {
      id: 'spellcasting',
      title: 'Zaubern — Grundregeln',
      icon: '✨',
      color: '#a855f7',
      summary: 'Angriffswurf vs. AC, oder Rettungswurf (DC = 8 + Prof + Mod). Konzentration beachten.',
      sections: [
        {
          title: 'Zauber-Rettungswurf DC',
          text: '8 + Proficiency Bonus + Spellcasting-Modifier (INT, WIS oder CHA je nach Klasse).',
        },
        {
          title: 'Zauber-Angriffswurf',
          text: 'Proficiency Bonus + Spellcasting-Modifier. Gegen AC des Ziels.',
        },
        {
          title: 'Slots höherer Grade',
          text: 'Viele Zauber werden stärker wenn mit höherem Slot-Grad gecastet. Details in der Zauberbeschreibung.',
        },
        {
          title: 'Reaktionszauber',
          text: 'Werden als Reaktion gesprochen (z.B. Shield, Counterspell). Die Casting Time gibt an wann sie gesprochen werden.',
        },
        {
          title: 'Rituale',
          text: 'Bestimmte Zauber können als Ritual (10 min länger) ohne Slot-Verbrauch gesprochen werden, wenn du das Ritual-Tag und die Fähigkeit hast.',
        },
      ],
    },
    {
      id: 'difficult_terrain',
      title: 'Erschwertes Gelände',
      icon: '🪨',
      color: '#78716c',
      summary: 'Jeder Fuß Bewegung kostet 2 Fuß. Halbiert effektiv die Bewegungsgeschwindigkeit.',
      sections: [
        {
          title: 'Bewegungskosten',
          text: 'Sich 1 Fuß durch erschwertes Gelände bewegen kostet 2 Fuß Bewegung. Kombiniert mit anderen Kosten (z.B. Klettern) multiplizieren sich die Kosten.',
        },
        {
          title: 'Beispiele',
          text: 'Tiefer Schnee, Sumpf, steile Treppen, Trümmer, Unterholz, dichter Nebel, magische Effekte (z.B. Entangle, Web).',
        },
      ],
    },
  ];

  // ── Conditions-Popup ───────────────────────────────────────────────────────
  function showConditionDetail(id) {
    const cond = CONDITIONS.find(c => c.id === id);
    if (!cond) return;
    showModal(`${cond.icon} ${cond.name}`, `
      <div style="margin-bottom:10px;padding:8px 12px;background:rgba(${hexToRgb(cond.color)},0.1);
        border:1px solid ${cond.color}44;border-radius:6px;">
        <p style="font-size:14px;color:var(--ink);line-height:1.5;">${cond.summary}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${cond.rules.map(r => `
          <div style="display:flex;gap:8px;padding:6px 0;
            border-bottom:1px solid rgba(200,165,90,0.1);">
            <span style="color:var(--gold);flex-shrink:0;">•</span>
            <span style="font-size:13px;color:var(--ink);line-height:1.5;">${r}</span>
          </div>
        `).join('')}
      </div>
    `);
  }

  // ── Regelschnellreferenz ───────────────────────────────────────────────────
  function showQuickRule(id) {
    const rule = QUICK_RULES.find(r => r.id === id);
    if (!rule) return;
    showModal(`${rule.icon} ${rule.title}`, `
      <div style="margin-bottom:12px;padding:8px 12px;
        background:rgba(${hexToRgb(rule.color)},0.1);
        border:1px solid ${rule.color}44;border-radius:6px;">
        <p style="font-size:14px;color:var(--ink);line-height:1.5;">${rule.summary}</p>
      </div>
      ${rule.sections.map(s => `
        <div style="margin-bottom:10px;">
          <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);
            text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
            ${s.title}
          </div>
          <p style="font-size:13px;color:var(--ink);line-height:1.6;">${s.text}</p>
        </div>
      `).join('')}
    `);
  }

  // ── Conditions Tab-Inhalt ──────────────────────────────────────────────────
  function renderConditionsPanel() {
    const container = document.getElementById('conditions-panel');
    if (!container) return;

    const active = Character.data.conditions || [];

    container.innerHTML = `
      <!-- Aktive Conditions -->
      <div class="card" style="margin-bottom:12px;">
        <div class="card-title">⚡ Aktive Zustände</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          ${CONDITIONS.filter(c=>c.id!=='concentration').map(c => {
            const isActive = active.includes(c.id);
            return `
              <div class="cond-toggle" data-id="${c.id}"
                style="display:flex;align-items:center;gap:5px;padding:5px 10px;
                border-radius:20px;border:1px solid ${isActive ? c.color : 'rgba(200,165,90,0.25)'};
                background:${isActive ? hexToRgbA(c.color, 0.15) : 'transparent'};
                color:${isActive ? c.color : 'var(--ink-light)'};
                cursor:pointer;font-family:var(--font-title);font-size:10px;
                letter-spacing:0.5px;user-select:none;transition:all 0.15s;">
                ${c.icon} ${c.name}
                <span class="cond-info-btn" data-id="${c.id}"
                  style="margin-left:2px;opacity:0.6;font-size:11px;cursor:pointer;"
                  title="Details">ⓘ</span>
              </div>`;
          }).join('')}
        </div>
        <div style="font-size:11px;color:#8a7060;">Tippe auf einen Zustand zum An-/Abschalten · ⓘ für Beschreibung</div>
      </div>

      <!-- Regelschnellreferenz -->
      <div class="card">
        <div class="card-title">📖 Regelschnellreferenz</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${QUICK_RULES.map(r => `
            <div class="rule-btn" data-id="${r.id}"
              style="display:flex;align-items:center;gap:10px;padding:10px 12px;
              background:rgba(255,255,255,0.5);border:1px solid rgba(200,165,90,0.25);
              border-radius:6px;cursor:pointer;transition:all 0.15s;">
              <span style="font-size:20px;flex-shrink:0;">${r.icon}</span>
              <div style="flex:1;">
                <div style="font-family:var(--font-title);font-size:12px;font-weight:700;
                  color:var(--ink);">${r.title}</div>
                <div style="font-size:11px;color:#8a7060;margin-top:2px;">${r.summary}</div>
              </div>
              <span style="color:rgba(200,165,90,0.5);font-size:16px;">›</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Condition Toggle Events
    container.querySelectorAll('.cond-toggle').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.classList.contains('cond-info-btn')) return;
        const id = el.dataset.id;
        const active = [...(Character.data.conditions || [])];
        const idx = active.indexOf(id);
        if (idx >= 0) active.splice(idx, 1); else active.push(id);
        Character.data.conditions = active;
        Character.save();
        renderConditionsPanel();
      });
    });

    // Info Buttons
    container.querySelectorAll('.cond-info-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        showConditionDetail(btn.dataset.id);
      });
    });

    // Regel-Buttons
    container.querySelectorAll('.rule-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(139,26,26,0.08)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.5)');
      btn.addEventListener('click', () => showQuickRule(btn.dataset.id));
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  }
  function hexToRgbA(hex, a) {
    return `rgba(${hexToRgb(hex)},${a})`;
  }

  function toggleCondition(id) {
    const active = [...(Character.data.conditions || [])];
    const idx = active.indexOf(id);
    if (idx >= 0) active.splice(idx, 1); else active.push(id);
    Character.data.conditions = active;
    Character.save();
    renderConditionsPanel();
  }

  function init() {
    renderConditionsPanel();
  }

  return {
    init, renderConditionsPanel, toggleCondition,
    showConditionDetail, showQuickRule,
    CONDITIONS, QUICK_RULES,
  };
})();

window.ConditionsUI = ConditionsUI;
