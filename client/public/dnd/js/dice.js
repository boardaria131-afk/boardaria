/**
 * dice.js — Würfelsystem
 */

const DiceUI = (() => {
  const MAX_HISTORY = 30;
  let _history = [];

  function roll(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  function rollMultiple(count, sides) {
    const rolls = [];
    for (let i = 0; i < count; i++) rolls.push(roll(sides));
    return rolls;
  }

  function animateResult(el, value) {
    el.textContent = value;
    el.classList.remove('rolling');
    void el.offsetWidth; // reflow
    el.classList.add('rolling');
  }

  function addToHistory(label, value) {
    _history.unshift({ label, value, time: new Date().toLocaleTimeString() });
    if (_history.length > MAX_HISTORY) _history.pop();
    renderHistory();
  }

  function renderHistory() {
    const container = document.getElementById('dice-history');
    if (!container) return;
    container.innerHTML = _history.map(h => `
      <div class="history-item">
        <span class="history-dice">${h.label}</span>
        <span class="history-value">${h.value}</span>
      </div>
    `).join('') || '<div style="color:#8a7060;font-style:italic;font-size:13px;">Noch keine Würfe</div>';
  }

  function init() {
    // Standard-Würfel
    document.querySelectorAll('.dice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sides = parseInt(btn.dataset.dice);
        const result = roll(sides);
        const label = `d${sides}`;
        const numEl = document.querySelector('#dice-result .dice-result-num');
        const lblEl = document.querySelector('#dice-result .dice-result-label');
        animateResult(numEl, result);
        if (lblEl) lblEl.textContent = label;
        addToHistory(label, result);
        // Kritisch-Effekte
        numEl.style.color = result === sides ? 'var(--gold)' : result === 1 ? 'var(--blood-light)' : 'var(--blood)';
      });
    });

    // Custom-Würfel
    document.getElementById('btn-roll-custom')?.addEventListener('click', () => {
      const count    = parseInt(document.getElementById('dice-count')?.value) || 1;
      const sides    = parseInt(document.getElementById('dice-sides')?.value) || 20;
      const modifier = parseInt(document.getElementById('dice-modifier')?.value) || 0;
      const rolls    = rollMultiple(count, sides);
      const total    = rolls.reduce((a, b) => a + b, 0) + modifier;
      const label    = `${count}d${sides}${modifier >= 0 ? '+' : ''}${modifier}`;
      const numEl    = document.querySelector('#dice-custom-result .dice-result-num');
      const lblEl    = document.querySelector('#dice-custom-result .dice-result-label');
      animateResult(numEl, total);
      if (lblEl) lblEl.textContent = `${label} = ${rolls.join('+')}${modifier !== 0 ? (modifier > 0 ? '+' : '')+modifier : ''}`;
      addToHistory(label, total);
    });

    // Attribute würfeln (4d6 drop lowest)
    document.getElementById('btn-roll-stats')?.addEventListener('click', () => {
      const results = [];
      for (let i = 0; i < 6; i++) {
        const rolls = rollMultiple(4, 6).sort((a,b) => a - b);
        const dropped = rolls[0];
        const kept = rolls.slice(1);
        const total = kept.reduce((a,b) => a+b, 0);
        results.push({ total, kept, dropped });
      }
      const container = document.getElementById('rolled-stats');
      if (container) {
        container.innerHTML = results.map(r => `
          <div class="rolled-stat">
            <div class="rolled-stat-val">${r.total}</div>
            <div class="rolled-stat-rolls">[${r.kept.join(',')}] <s>${r.dropped}</s></div>
          </div>
        `).join('');
      }
      addToHistory('4d6 drop lowest', results.map(r => r.total).join(', '));
    });

    // Verlauf löschen
    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      _history = [];
      renderHistory();
    });

    renderHistory();
  }

  return { init };
})();

window.DiceUI = DiceUI;
