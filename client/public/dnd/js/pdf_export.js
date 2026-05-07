/**
 * pdf_export.js — D&D 5e Charakterbogen als PDF exportieren
 * Nutzt jsPDF (CDN) für einen sauberen, strukturierten Charakterbogen
 */

const PdfExport = (() => {

  // jsPDF dynamisch laden
  async function loadJsPDF() {
    if (window.jspdf) return window.jspdf.jsPDF;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload  = () => resolve(window.jspdf.jsPDF);
      s.onerror = () => reject(new Error('jsPDF konnte nicht geladen werden'));
      document.head.appendChild(s);
    });
  }

  const PARCHMENT = [245, 230, 200];
  const BLOOD     = [139, 26,  26 ];
  const INK       = [44,  24,  16 ];
  const GOLD      = [180, 130, 40 ];
  const LIGHT     = [255, 248, 235];

  function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }
  function abilMod(score) { return Math.floor((score - 10) / 2); }
  function profBonus(level) { return Math.ceil(level / 4) + 1; }

  async function generate() {
    showToast('📄 Erstelle PDF…');

    let JsPDF;
    try { JsPDF = await loadJsPDF(); }
    catch(e) { showToast('❌ Fehler: ' + e.message); return; }

    const char  = Character.data;
    const cls   = DnDData.getClassById(char.classId);
    const rs    = DnDData.getRulesetById(char.rulesetId || '5e');
    const prof  = profBonus(char.level || 1);
    const ab    = char.abilities || {};
    const skills = char.proficiencies?.skills || [];
    const saves  = char.proficiencies?.saving_throws || [];

    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, H = 297;
    const margin = 14;
    const col = (W - margin * 2) / 3;

    // ── Hintergrund ──────────────────────────────────────────
    doc.setFillColor(...PARCHMENT);
    doc.rect(0, 0, W, H, 'F');

    // Parchment-Textur (einfache Linien)
    doc.setDrawColor(200, 175, 130);
    doc.setLineWidth(0.1);
    for (let y = 5; y < H; y += 8) {
      doc.setGState(doc.GState({ opacity: 0.15 }));
      doc.line(0, y, W, y);
    }
    doc.setGState(doc.GState({ opacity: 1 }));

    // ── Header ────────────────────────────────────────────────
    doc.setFillColor(...BLOOD);
    doc.rect(0, 0, W, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(245, 230, 200);
    doc.text('D&D 5e Charakterbogen', W / 2, 13, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(200, 160, 120);
    doc.text(`System Reference Document 5.1 · ${rs?.name || '5e'}`, W / 2, 19, { align: 'center' });

    // ── Charakter-Info ────────────────────────────────────────
    let y = 28;

    const infoFields = [
      ['Charaktername', char.name || '–'],
      ['Klasse & Level', `${cls?.name || '–'} ${char.level || 1}`],
      ['Rasse',         char.race || '–'],
      ['Hintergrund',   char.background || '–'],
    ];

    // 2-spaltig
    infoFields.forEach((f, i) => {
      const x = margin + (i % 2) * ((W - margin * 2) / 2);
      if (i % 2 === 0 && i > 0) y += 10;
      drawField(doc, x, y, (W - margin * 2) / 2 - 4, f[0], f[1]);
    });
    y += 14;

    // Zweite Zeile
    const infoFields2 = [
      ['Erfahrungspunkte', String(char.xp || 0)],
      ['Gesinnung', '–'],
      ['Gottheit', '–'],
      ['Spieler', Auth?.getUser()?.username || '–'],
    ];
    infoFields2.forEach((f, i) => {
      const x = margin + (i % 4) * ((W - margin * 2) / 4);
      drawField(doc, x, y, (W - margin * 2) / 4 - 3, f[0], f[1]);
    });
    y += 12;

    // ── Trennlinie ────────────────────────────────────────────
    drawDivider(doc, margin, y, W - margin * 2);
    y += 4;

    // ── Kampfwerte ────────────────────────────────────────────
    const combatFields = [
      ['RK (AC)', String(char.ac || 10)],
      ['Initiative', fmtMod(abilMod(ab.dex || 10))],
      ['Tempo', `${char.speed || 30} ft`],
      ['TW max', String(char.hp_max || 10)],
      ['TW aktuell', String(char.hp_current || 10)],
      ['Kompetenz', '+' + prof],
    ];

    const combatW = (W - margin * 2) / combatFields.length;
    combatFields.forEach((f, i) => {
      drawStatBox(doc, margin + i * combatW, y, combatW - 2, f[0], f[1]);
    });
    y += 18;
    drawDivider(doc, margin, y, W - margin * 2);
    y += 4;

    // ── Attribute (Links) + Rettungswürfe (Mitte) + Fertigkeiten (Rechts) ──
    const colW = (W - margin * 2) / 3;
    const startY = y;

    // Attribute
    drawSectionHeader(doc, margin, y, 'ATTRIBUTE');
    y += 6;
    const ATTRS = ['str','dex','con','int','wis','cha'];
    const ATTR_NAMES = { str:'STÄRKE', dex:'GESCHICK', con:'KONSTITUTION', int:'INTELLIGENZ', wis:'WEISHEIT', cha:'CHARISMA' };
    ATTRS.forEach(ab_key => {
      const val = ab[ab_key] || 10;
      const mod = abilMod(val);
      drawAbilityBlock(doc, margin, y, colW - 4, ATTR_NAMES[ab_key], val, mod);
      y += 14;
    });

    // Rettungswürfe
    let y2 = startY;
    drawSectionHeader(doc, margin + colW, y2, 'RETTUNGSWÜRFE');
    y2 += 6;
    ATTRS.forEach(ab_key => {
      const mod   = abilMod(ab[ab_key] || 10);
      const isPro = saves.includes(ab_key);
      const bonus = mod + (isPro ? prof : 0);
      drawSkillRow(doc, margin + colW, y2, colW - 4, ATTR_NAMES[ab_key].slice(0,6), bonus, isPro);
      y2 += 7;
    });

    // Fertigkeiten
    y2 += 3;
    drawSectionHeader(doc, margin + colW, y2, 'FERTIGKEITEN');
    y2 += 6;
    const SKILL_DATA = [
      ['Akrobatik','dex'],['Mit Tieren','wis'],['Arkanes','int'],['Athletik','str'],
      ['Täuschung','cha'],['Geschichte','int'],['Einsicht','wis'],['Einschüchtern','cha'],
      ['Nachforschung','int'],['Medizin','wis'],['Naturkunde','int'],['Wahrnehmung','wis'],
      ['Aufführung','cha'],['Überzeugung','cha'],['Religion','int'],['Taschensp.','dex'],
      ['Heimlichkeit','dex'],['Überleben','wis'],
    ];
    const SKILL_KEYS = ['acrobatics','animal_handling','arcana','athletics','deception','history',
      'insight','intimidation','investigation','medicine','nature','perception',
      'performance','persuasion','religion','sleight_of_hand','stealth','survival'];
    SKILL_KEYS.forEach((sk, i) => {
      const mod   = abilMod(ab[SKILL_DATA[i][1]] || 10);
      const isPro = skills.includes(sk);
      const bonus = mod + (isPro ? prof : 0);
      drawSkillRow(doc, margin + colW, y2, colW - 4, SKILL_DATA[i][0], bonus, isPro);
      y2 += 5.5;
    });

    // Passive Wahrnehmung
    const passPerc = 10 + abilMod(ab.wis || 10) + (skills.includes('perception') ? prof : 0);
    y2 += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...INK);
    doc.text(`Passive Wahrnehmung: ${passPerc}`, margin + colW, y2);

    // ── Rechte Spalte: Spells + Items ────────────────────────
    const rightX = margin + colW * 2;
    let y3 = startY;

    // Spell Slots
    drawSectionHeader(doc, rightX, y3, 'ZAUBERSLOTS');
    y3 += 6;
    const spellSlotsData = getSpellSlotsForPDF(char);
    if (spellSlotsData) {
      if (spellSlotsData.type === 'pact') {
        doc.setFontSize(8);
        doc.setTextColor(...INK);
        doc.text(`Pakt Magic: ${spellSlotsData.slots}× Level ${spellSlotsData.level}`, rightX, y3);
        y3 += 6;
      } else {
        const active = spellSlotsData.slots.map((n,i) => ({l:i+1,n})).filter(s=>s.n>0);
        active.forEach(s => {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...BLOOD);
          doc.text(`Grad ${s.l}:`, rightX, y3);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...INK);
          // Slot-Bubbles
          for (let i = 0; i < s.n; i++) {
            doc.setDrawColor(...BLOOD);
            doc.setLineWidth(0.4);
            doc.circle(rightX + 14 + i * 5, y3 - 1.5, 1.8, 'S');
          }
          y3 += 5;
        });
      }
    } else {
      doc.setFontSize(7);
      doc.setTextColor(150, 120, 100);
      doc.text('Kein Zauberer', rightX, y3);
      y3 += 5;
    }
    y3 += 3;

    // Bekannte Spells
    drawSectionHeader(doc, rightX, y3, 'BEKANNTE ZAUBER');
    y3 += 5;
    const charSpells = (char.spellIds || []).slice(0, 12).map(id => DnDData.getSpellById(id)).filter(Boolean);
    if (charSpells.length) {
      charSpells.forEach(sp => {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...INK);
        const lvlStr = sp.level === 0 ? 'C' : String(sp.level);
        doc.text(`[${lvlStr}] ${sp.name}`, rightX, y3);
        y3 += 4.5;
      });
    } else {
      doc.setFontSize(7); doc.setTextColor(150,120,100);
      doc.text('–', rightX, y3); y3 += 5;
    }
    y3 += 3;

    // Inventar
    drawSectionHeader(doc, rightX, y3, 'INVENTAR');
    y3 += 5;
    const itemCounts = {};
    (char.itemIds || []).forEach(id => itemCounts[id] = (itemCounts[id]||0)+1);
    const charItems = Object.entries(itemCounts).slice(0,10).map(([id,n]) => ({item:DnDData.getItemById(id),n})).filter(x=>x.item);
    if (charItems.length) {
      charItems.forEach(({item,n}) => {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...INK);
        doc.text(`${n>1?n+'× ':''}${item.name}`, rightX, y3);
        y3 += 4.5;
      });
    } else {
      doc.setFontSize(7); doc.setTextColor(150,120,100);
      doc.text('–', rightX, y3); y3 += 5;
    }

    // ── Klassenmerkmale ───────────────────────────────────────
    const bottomY = Math.max(y, y2, y3) + 6;
    drawDivider(doc, margin, bottomY, W - margin * 2);

    let yb = bottomY + 5;
    drawSectionHeader(doc, margin, yb, 'KLASSENMERKMALE & RASSENMERKMALE');
    yb += 5;
    const features = [...(char.class_features || []), ...(char.race_traits || [])];
    if (features.length) {
      const chunks = chunkArray(features, 3);
      chunks.forEach(row => {
        const fw = (W - margin * 2) / row.length;
        row.forEach((f, i) => {
          const tipText = window.getFeatureTooltip ? (getFeatureTooltip(f) || '') : '';
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...BLOOD);
          doc.text(f, margin + i * fw, yb);
          if (tipText) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(100, 80, 60);
            const lines = doc.splitTextToSize(tipText.slice(0, 120), fw - 2);
            doc.text(lines.slice(0, 2), margin + i * fw, yb + 3);
          }
        });
        yb += (tipText => tipText ? 10 : 6)(true);
      });
    }

    // ── Notizen ───────────────────────────────────────────────
    if (yb < H - 30 && char.notes) {
      yb += 4;
      drawDivider(doc, margin, yb, W - margin * 2);
      yb += 5;
      drawSectionHeader(doc, margin, yb, 'NOTIZEN');
      yb += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...INK);
      const noteLines = doc.splitTextToSize(char.notes, W - margin * 2);
      doc.text(noteLines.slice(0, 8), margin, yb);
    }

    // ── Footer ────────────────────────────────────────────────
    doc.setFillColor(...BLOOD);
    doc.rect(0, H - 8, W, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(200, 160, 120);
    doc.text('D&D 5e SRD · System Reference Document 5.1 (CC BY 4.0) · Nur SRD-Inhalte', W / 2, H - 3, { align: 'center' });

    // ── Speichern ─────────────────────────────────────────────
    const filename = `${(char.name || 'Charakter').replace(/\s+/g, '_')}_${char.rulesetId || '5e'}.pdf`;
    doc.save(filename);
    showToast('✅ PDF gespeichert: ' + filename);
  }

  // ── Hilfs-Zeichenfunktionen ───────────────────────────────────────────────

  function drawField(doc, x, y, w, label, value) {
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 4, w, 8, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...BLOOD);
    doc.text(label.toUpperCase(), x + 2, y - 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(String(value).slice(0, 30), x + 2, y + 3);
  }

  function drawStatBox(doc, x, y, w, label, value) {
    doc.setFillColor(...BLOOD);
    doc.roundedRect(x, y, w, 14, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(245, 230, 200);
    doc.text(String(value), x + w / 2, y + 8, { align: 'center' });
    doc.setFontSize(5);
    doc.setTextColor(200, 160, 120);
    doc.text(label.toUpperCase(), x + w / 2, y + 12.5, { align: 'center' });
  }

  function drawAbilityBlock(doc, x, y, w, label, score, mod) {
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...BLOOD);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...BLOOD);
    doc.text(label, x + w / 2, y + 3.5, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(String(score), x + w / 2 - 5, y + 9, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(...BLOOD);
    doc.text(fmtMod(mod), x + w / 2 + 5, y + 9, { align: 'center' });
  }

  function drawSkillRow(doc, x, y, w, label, bonus, proficient) {
    doc.setFillColor(proficient ? 139 : 245, proficient ? 26 : 248, proficient ? 26 : 235, proficient ? 0.05 : 1);
    doc.setFont('helvetica', proficient ? 'bold' : 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...(proficient ? BLOOD : INK));
    doc.text((proficient ? '◆ ' : '◇ ') + label, x + 1, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLOOD);
    doc.text(fmtMod(bonus), x + w - 1, y, { align: 'right' });
  }

  function drawSectionHeader(doc, x, y, title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...BLOOD);
    doc.text(title, x, y);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(x, y + 1, x + 55, y + 1);
  }

  function drawDivider(doc, x, y, w) {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(x, y, x + w, y);
  }

  function getSpellSlotsForPDF(char) {
    const CASTER_TYPE = {
      bard:'full_caster', cleric:'full_caster', druid:'full_caster',
      sorcerer:'full_caster', wizard:'full_caster',
      paladin:'half_caster', ranger:'half_caster',
      artificer:'artificer', warlock:'warlock',
    };
    const slots  = DnDData.spellSlots;
    const cType  = CASTER_TYPE[char.classId];
    if (!cType || !slots[cType]) return null;
    const row = slots[cType][String(char.level || 1)];
    if (!row) return null;
    if (cType === 'warlock') return { type:'pact', slots:row.slots, level:row.level };
    return { type:'standard', slots:row };
  }

  function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }

  return { generate };
})();

window.PdfExport = PdfExport;
