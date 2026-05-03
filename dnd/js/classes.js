/**
 * classes.js — Klassen & Subklassen UI
 */

const ClassesUI = (() => {

  function init() {
    renderClassList();
  }

  function renderClassList() {
    const container = document.getElementById('class-list');
    if (!container) return;
    container.innerHTML = '';

    DnDData.classes.forEach(cls => {
      const btn = document.createElement('button');
      btn.className = 'class-btn' + (Character.data.classId === cls.id ? ' selected' : '');
      btn.dataset.id = cls.id;
      btn.innerHTML = `
        <span class="class-btn-icon">${cls.icon}</span>
        <span class="class-btn-info">
          <span class="class-btn-name">${cls.name}</span>
          <span class="class-btn-hit">Hit Dice: ${cls.hit_dice}</span>
        </span>
      `;
      btn.addEventListener('click', () => selectClass(cls.id));
      container.appendChild(btn);
    });
  }

  function selectClass(classId) {
    // Markierung aktualisieren
    document.querySelectorAll('.class-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.id === classId);
    });

    const cls = DnDData.getClassById(classId);
    if (!cls) return;

    // Charakter aktualisieren
    Character.update({ classId, subclassId: null });
    updateClassBadge(cls);
    renderClassDetail(cls);
  }

  function updateClassBadge(cls) {
    const badge = document.getElementById('char-class-display');
    if (badge) badge.textContent = `${cls.icon} ${cls.name}`;
  }

  function renderClassDetail(cls) {
    const detail = document.getElementById('class-detail');
    if (!detail) return;

    const currentSubclass = Character.data.subclassId;

    detail.innerHTML = `
      <div class="class-detail-content">
        <h2>${cls.icon} ${cls.name}</h2>
        <div class="class-meta">
          <span class="class-meta-item">Hit Dice: ${cls.hit_dice}</span>
          <span class="class-meta-item">Primär: ${cls.primary_abilities.join(', ')}</span>
          <span class="class-meta-item">Rettungswürfe: ${cls.saving_throws.join(', ').toUpperCase()}</span>
        </div>
        <p class="class-desc">${cls.description}</p>

        <div style="margin-bottom:12px;">
          <h3 style="font-family:var(--font-title);font-size:13px;color:var(--blood);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid rgba(139,26,26,0.2);">Klassenmerkmale</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${cls.features.map(f => `<span class="detail-tag">${f}</span>`).join('')}
          </div>
        </div>

        <div class="subclass-section">
          <h3>Subklassen</h3>
          <div class="subclass-grid">
            ${cls.subclasses.map(sc => `
              <div class="subclass-card ${currentSubclass === sc.id ? 'selected' : ''}"
                   data-subclass="${sc.id}" data-class="${cls.id}">
                <div class="subclass-name">${sc.name}</div>
                <div class="subclass-desc">${sc.description}</div>
                ${sc.features ? `
                  <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">
                    ${sc.features.map(f => `<span style="background:rgba(201,150,42,0.15);border:1px solid rgba(201,150,42,0.3);border-radius:3px;padding:2px 7px;font-family:var(--font-title);font-size:10px;color:var(--ink-light);">${f}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <button class="btn-primary" id="btn-apply-class" style="margin-top:16px;width:100%;">
          Klasse übernehmen
        </button>
      </div>
    `;

    // Subklassen Events
    detail.querySelectorAll('.subclass-card').forEach(card => {
      card.addEventListener('click', () => {
        detail.querySelectorAll('.subclass-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        Character.update({ subclassId: card.dataset.subclass });
      });
    });

    // Klasse übernehmen
    detail.querySelector('#btn-apply-class').addEventListener('click', () => {
      showToast(`✅ ${cls.name} als Klasse gesetzt!`);
      // Proficiency-Boni aus Klasse setzen
      Character.update({
        classId: cls.id,
        proficiencies: {
          saving_throws: cls.saving_throws,
          skills: Character.data.proficiencies.skills,
        }
      });
      // Skills-Panel neu rendern, falls sichtbar
      if (typeof CharUI !== 'undefined') CharUI.renderSkills();
    });
  }

  // Beim Starten: gespeicherte Klasse wiederherstellen
  function restoreFromSave() {
    const { classId } = Character.data;
    if (!classId) return;
    const cls = DnDData.getClassById(classId);
    if (cls) {
      updateClassBadge(cls);
      renderClassDetail(cls);
    }
  }

  return { init, restoreFromSave };
})();

window.ClassesUI = ClassesUI;
