/**
 * tooltip.js — Globales Hover-Tooltip System
 * Aktiviert durch data-tooltip="..." Attribute
 */

const Tooltip = (() => {
  let _el = null;
  let _timer = null;

  function init() {
    _el = document.createElement('div');
    _el.id = 'dnd-tooltip';
    _el.className = 'dnd-tooltip hidden';
    document.body.appendChild(_el);

    document.addEventListener('mouseover', onHover);
    document.addEventListener('mouseout',  onOut);
    document.addEventListener('scroll',    hide, true);
  }

  function onHover(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    clearTimeout(_timer);
    _timer = setTimeout(() => show(target, target.dataset.tooltip), 380);
  }

  function onOut(e) {
    clearTimeout(_timer);
    if (!e.target.closest('[data-tooltip]')) hide();
  }

  function show(anchor, text) {
    if (!text || !_el) return;
    _el.innerHTML = text;
    _el.classList.remove('hidden');

    const rect = anchor.getBoundingClientRect();
    const tw   = _el.offsetWidth;
    const th   = _el.offsetHeight;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;

    let left = rect.left + rect.width / 2 - tw / 2;
    let top  = rect.top - th - 10 + window.scrollY;

    // Horizontale Grenzen
    if (left < 8) left = 8;
    if (left + tw > vw - 8) left = vw - tw - 8;

    // Unten wenn oben kein Platz
    if (rect.top - th - 10 < 0) {
      top = rect.bottom + 10 + window.scrollY;
      _el.classList.add('below');
    } else {
      _el.classList.remove('below');
    }

    _el.style.left = left + 'px';
    _el.style.top  = top  + 'px';
  }

  function hide() {
    if (_el) _el.classList.add('hidden');
  }

  // Hilfsfunktion: data-tooltip auf einem Element setzen
  function attach(el, text) {
    if (el && text) el.dataset.tooltip = text;
  }

  return { init, show, hide, attach };
})();
window.Tooltip = Tooltip;
