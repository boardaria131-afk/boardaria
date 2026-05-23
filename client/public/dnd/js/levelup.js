/**
 * levelup.js — Geführter Level-Up Assistent
 * Spieler wählt selbst: HP würfeln, neue Features, Spells, ASI/Feat
 */

const LevelUpUI = (() => {

  function getProfBonus(level) { return Math.ceil(level / 4) + 1; }
  function getProficiencyBonus() { return getProfBonus(parseInt(Character.data.level)||1); }

  function getMod(score) { return Math.floor(((score||10)-10)/2); }

  function getHitDie(classId) {
    const cls = DnDData.getClassById(classId);
    return cls?.hit_die || 8;
  }

  function show() {
    const char   = Character.data;
    const oldLvl = parseInt(char.level) || 1;
    const newLvl = oldLvl + 1;

    if (newLvl > 20) { showToast('⚠ Level 20 ist das Maximum!'); return; }

    const cls    = DnDData.getClassById(char.classId);
    const hitDie = getHitDie(char.classId);
    const conMod = getMod(char.abilities?.con);
    const isASI  = [4,8,12,16,19].includes(newLvl);
    const newPB  = getProfBonus(newLvl);
    const oldPB  = getProfBonus(oldLvl);

    // HP-Option
    const avgHP  = Math.floor(hitDie / 2) + 1 + conMod;

    showModal(`⬆ Level Up: ${oldLvl} → ${newLvl}`, `
      <div style="font-size:14px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
          <span class="detail-tag" style="background:rgba(201,150,42,0.15);border-color:var(--gold);">
            ${cls?.name || 'Klasse'} Level ${newLvl}
          </span>
          ${newPB > oldPB ? `<span class="detail-tag" style="background:rgba(34,197,94,0.15);border-color:#22c55e;color:#15803d;">
            Kompetenzbonus: +${oldPB} → +${newPB}
          </span>` : ''}
          ${isASI ? `<span class="detail-tag" style="background:rgba(139,26,26,0.15);border-color:var(--blood);">
            ASI oder Feat verfügbar!
          </span>` : ''}
        </div>

        <!-- Schritt 1: HP -->
        <div class="lu-section" id="lu-hp-section">
          <div class="lu-step">1</div>
          <div style="flex:1;">
            <div class="lu-title">Trefferpunkte</div>
            <div style="font-size:13px;color:#8a7060;margin-bottom:8px;">
              Würfle 1d${hitDie} + CON-Mod (${conMod>=0?'+':''}${conMod}) oder nimm den Durchschnitt
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn-primary" id="lu-roll-hp">
                🎲 1d${hitDie} würfeln
              </button>
              <button class="btn-secondary" id="lu-avg-hp">
                📊 Durchschnitt (+${avgHP} HP)
              </button>
            </div>
            <div id="lu-hp-result" style="margin-top:8px;font-family:var(--font-title);font-size:14px;color:var(--blood);"></div>
          </div>
        </div>

        <!-- Schritt 2: ASI / Feat -->
        ${isASI ? `
        <div class="lu-section" id="lu-asi-section">
          <div class="lu-step">2</div>
          <div style="flex:1;">
            <div class="lu-title">Attributssteigerung oder Feat</div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
              <button class="btn-primary" id="lu-asi-btn">📈 Attribut steigern</button>
              <button class="btn-secondary" id="lu-feat-btn">⭐ Feat wählen</button>
            </div>
            <div id="lu-asi-content"></div>
          </div>
        </div>` : ''}

        <!-- Schritt 3: Neue Features -->
        <div class="lu-section">
          <div class="lu-step">${isASI ? 3 : 2}</div>
          <div style="flex:1;">
            <div class="lu-title">Neue Klassenmerkmale</div>
            <div style="font-size:13px;color:#8a7060;margin-bottom:8px;">
              Prüfe deine Klassen-Tabelle für neue Features auf Level ${newLvl}.
              Füge sie manuell im Charakter-Tab hinzu.
            </div>
            ${cls?.subclasses?.length && newLvl === 3 ? `
            <div style="background:rgba(201,150,42,0.1);border:1px solid var(--gold);border-radius:4px;padding:8px;margin-bottom:8px;">
              <strong style="color:var(--gold);">🎓 Subklasse wählen!</strong>
              <p style="font-size:12px;color:#8a7060;margin-top:4px;">
                Auf Level 3 wählst du deine Subklasse. Gehe zum Tab "Klasse/Rasse" und wähle dort deine Subklasse aus.
              </p>
            </div>` : ''}
            <div style="display:flex;gap:6px;flex-wrap:wrap;" id="lu-features-display">
              ${(cls?.class_features?.filter(f => f.level === newLvl) || []).map(f => `
                <span class="detail-tag">${f.name}</span>
              `).join('') || '<span style="color:#8a7060;font-size:13px;font-style:italic;">Keine automatischen Features — prüfe dein Regelwerk</span>'}
            </div>
          </div>
        </div>

        <!-- Schritt 4: Spell Slots -->
        <div class="lu-section">
          <div class="lu-step">${isASI ? 4 : 3}</div>
          <div style="flex:1;">
            <div class="lu-title">Spell Slots & Zauber</div>
            <div id="lu-spell-info" style="font-size:13px;color:#8a7060;"></div>
          </div>
        </div>

        <!-- Fertig-Button -->
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="btn-primary" id="lu-confirm" style="flex:1;">
            ✅ Level Up abschließen (→ Level ${newLvl})
          </button>
          <button class="btn-secondary" id="lu-cancel">Abbrechen</button>
        </div>
        <div id="lu-error" style="color:var(--blood);font-size:12px;margin-top:6px;"></div>
      </div>
    `);

    let hpGain = 0;
    let asiDone = !isASI; // wenn kein ASI, ist es "erledigt"

    // HP würfeln
    document.getElementById('lu-roll-hp')?.addEventListener('click', () => {
      const rolled = Math.floor(Math.random() * hitDie) + 1;
      hpGain = Math.max(1, rolled + conMod);
      document.getElementById('lu-hp-result').innerHTML =
        `🎲 Gewürfelt: ${rolled} + CON ${conMod>=0?'+':''}${conMod} = <strong>+${hpGain} HP</strong>`;
    });

    document.getElementById('lu-avg-hp')?.addEventListener('click', () => {
      hpGain = avgHP;
      document.getElementById('lu-hp-result').innerHTML =
        `📊 Durchschnitt: +<strong>${hpGain} HP</strong>`;
    });

    // ASI
    document.getElementById('lu-asi-btn')?.addEventListener('click', () => {
      document.getElementById('lu-asi-content').innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
          ${['str','dex','con','int','wis','cha'].map(ab => {
            const cur = char.abilities?.[ab] || 10;
            const labels = {str:'Stärke',dex:'Geschick',con:'Konstitution',int:'Intelligenz',wis:'Weisheit',cha:'Charisma'};
            return `
              <div style="background:rgba(255,255,255,0.5);border:1px solid rgba(200,165,90,0.3);border-radius:4px;padding:8px;text-align:center;">
                <div style="font-family:var(--font-title);font-size:9px;color:var(--blood);margin-bottom:3px;">${labels[ab]}</div>
                <div style="font-family:var(--font-title);font-size:16px;font-weight:700;">${cur}</div>
                <div style="display:flex;justify-content:center;gap:4px;margin-top:4px;">
                  <button class="cs-btn cs-plus lu-asi-plus" data-ab="${ab}" data-cur="${cur}"
                    ${cur >= 20 ? 'disabled style="opacity:0.3;"' : ''}>+</button>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div style="font-size:12px;color:#8a7060;margin-top:6px;" id="lu-asi-note">
          Du kannst 2 verschiedene Attribute um je +1 oder ein Attribut um +2 steigern (max 20).
        </div>
      `;

      let points = 2;
      const pending = {};

      document.querySelectorAll('.lu-asi-plus').forEach(btn => {
        btn.addEventListener('click', () => {
          if (points <= 0) { showToast('⚠ Keine Punkte mehr übrig'); return; }
          const ab  = btn.dataset.ab;
          const cur = parseInt(btn.dataset.cur) + (pending[ab] || 0);
          if (cur >= 20) { showToast('⚠ Maximum ist 20'); return; }
          pending[ab] = (pending[ab] || 0) + 1;
          points--;
          btn.dataset.cur = String(parseInt(btn.dataset.cur) + 1);
          btn.closest('div').querySelector('div:nth-child(2)').textContent =
            char.abilities?.[ab] + (pending[ab] || 0);
          document.getElementById('lu-asi-note').textContent =
            `${points} Punkt${points!==1?'e':''} verbleibend`;
          if (points === 0) {
            asiDone = true;
            // Pending in pendingASI speichern
            document.getElementById('lu-asi-btn').dataset.pending = JSON.stringify(pending);
          }
        });
      });
    });

    // Feat wählen
    document.getElementById('lu-feat-btn')?.addEventListener('click', () => {
      const feats = DnDData.feats || [];
      document.getElementById('lu-asi-content').innerHTML = `
        <div style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
          ${feats.map(f => `
            <div class="lu-feat-option" data-feat="${f.id}"
              style="padding:6px 10px;background:rgba(255,255,255,0.5);border:1px solid rgba(200,165,90,0.3);
                border-radius:4px;cursor:pointer;transition:all 0.15s;">
              <div style="font-family:var(--font-title);font-size:12px;color:var(--blood);">${f.name}</div>
              <div style="font-size:11px;color:#8a7060;">${(f.description||'').slice(0,80)}…</div>
            </div>
          `).join('')}
        </div>
        <div id="lu-feat-selected" style="font-size:12px;color:#8a7060;margin-top:6px;font-style:italic;">
          Klicke auf einen Feat um ihn auszuwählen
        </div>
      `;

      document.querySelectorAll('.lu-feat-option').forEach(el => {
        el.addEventListener('click', () => {
          document.querySelectorAll('.lu-feat-option').forEach(e => e.style.borderColor = 'rgba(200,165,90,0.3)');
          el.style.borderColor = 'var(--gold)';
          el.style.background  = 'rgba(201,150,42,0.1)';
          document.getElementById('lu-feat-selected').textContent = '✅ Gewählt: ' + el.querySelector('div').textContent;
          document.getElementById('lu-feat-btn').dataset.featId = el.dataset.feat;
          asiDone = true;
        });
      });
    });

    // Spell-Info
    const spellInfo = document.getElementById('lu-spell-info');
    if (spellInfo) {
      const slots = DnDData.spellSlots;
      const CASTER = {bard:'full_caster',cleric:'full_caster',druid:'full_caster',
        sorcerer:'full_caster',wizard:'full_caster',paladin:'half_caster',ranger:'half_caster',
        artificer:'artificer',warlock:'warlock'};
      const cType = CASTER[char.classId];
      if (cType && slots[cType]) {
        const newSlots = slots[cType][String(newLvl)];
        const oldSlots = slots[cType][String(oldLvl)];
        if (newSlots && oldSlots) {
          const added = Array.isArray(newSlots)
            ? newSlots.map((n,i) => n - (oldSlots[i]||0)).filter(d=>d>0)
            : null;
          spellInfo.innerHTML = added?.length
            ? `Neue Slots hinzugekommen: ${added.map((d,i)=>d>0?`+${d} (Grad ${i+1})`:'').filter(Boolean).join(', ')}`
            : 'Keine neuen Spell Slots auf diesem Level.';
        } else {
          spellInfo.textContent = 'Prüfe deine Klassen-Tabelle für neue Spell Slots.';
        }
      } else {
        spellInfo.textContent = 'Diese Klasse hat keine Spell Slots.';
      }
    }

    // Level Up bestätigen
    document.getElementById('lu-confirm')?.addEventListener('click', () => {
      const errEl = document.getElementById('lu-error');
      if (hpGain <= 0) { errEl.textContent = '❌ Bitte zuerst HP würfeln oder Durchschnitt wählen'; return; }

      const updates = {
        level:   newLvl,
        hp_max:  (parseInt(char.hp_max) || 0) + hpGain,
        hp_current: (parseInt(char.hp_current) || 0) + hpGain,
      };

      // ASI anwenden
      const asiBtn = document.getElementById('lu-asi-btn');
      if (asiBtn?.dataset.pending) {
        try {
          const pending = JSON.parse(asiBtn.dataset.pending);
          const newAbilities = { ...(char.abilities || {}) };
          Object.entries(pending).forEach(([ab, add]) => {
            newAbilities[ab] = Math.min(20, (newAbilities[ab] || 10) + add);
          });
          updates.abilities = newAbilities;
        } catch {}
      }

      // Feat anwenden
      const featBtn = document.getElementById('lu-feat-btn');
      if (featBtn?.dataset.featId) {
        const featIds = [...(char.featIds || [])];
        if (!featIds.includes(featBtn.dataset.featId)) featIds.push(featBtn.dataset.featId);
        updates.featIds = featIds;
      }

      Character.update(updates);
      Character.save();

      // UI aktualisieren
      document.getElementById('char-level')?.dispatchEvent(new Event('change'));
      SpellSlotUI.renderSpellSlots();
      CombatUI.update();

      closeModal();
      showToast(`🎉 Herzlichen Glückwunsch! ${cls?.name || 'Charakter'} ist jetzt Level ${newLvl}!`);
    });

    document.getElementById('lu-cancel')?.addEventListener('click', closeModal);
  }

  function init() {
    // Level-Up Button neben Level-Feld
    const levelInput = document.getElementById('char-level');
    if (!levelInput) return;

    let btn = document.getElementById('btn-levelup');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-levelup';
      btn.className = 'btn-secondary';
      btn.style.cssText = 'font-size:11px;padding:4px 10px;margin-left:6px;';
      btn.title = 'Level Up Assistent';
      btn.textContent = '⬆ Level Up';
      levelInput.parentNode.appendChild(btn);
    }
    btn.addEventListener('click', show);
  }

  return { init, show };
})();

window.LevelUpUI = LevelUpUI;
