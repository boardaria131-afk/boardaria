// ╔══════════════════════════════════════════════════════════╗
//  HEXFORGE UI  v2
//  Uses Engine v2: cardData(), mkUnit(), doCleanup(), keywords
// ╚══════════════════════════════════════════════════════════╝

// ── Keyword display config ─────────────────────────────────
const KW_STYLE = {
  'flying':      { label:'✦ Flying',      bg:'#0d2040', border:'#3a8acc', col:'#60aaee' },
  'jump':        { label:'↟ Jump',         bg:'#0d2040', border:'#3a8acc', col:'#60aaee' },
  'aquatic':     { label:'⚓ Aquatic',     bg:'#0d1e3a', border:'#2a6aaa', col:'#4a9acc' },
  'ranged':      { label:'⊕ Ranged',      bg:'#2a1408', border:'#8a4a20', col:'#c07040' },
  'deathtouch':  { label:'☠ Deathtouch',  bg:'#1a0a1a', border:'#882288', col:'#cc44cc' },
  'taunt':       { label:'⛊ Taunt',       bg:'#2a1a08', border:'#aa7020', col:'#e0a040' },
  'haste':       { label:'⚡ Haste',       bg:'#1a2008', border:'#6a9020', col:'#a0c040' },
  'protection':  { label:'⊕ Protection',  bg:'#082018', border:'#208848', col:'#40cc80' },
  'divine':      { label:'✶ Divine',      bg:'#201808', border:'#c8a84b', col:'#e8c870' },
};

function kwBadge(kwKey) {
  const k = kwKey.replace(/:\d+$/, ''); // strip :N suffix
  const base = KW_STYLE[k];
  if (!base) {
    // Parameterised ones: dash, charge
    if (kwKey.startsWith('dash:'))   return `<span class="kw-badge" style="background:#1a0a20;border-color:#9940cc;color:#cc70ff">⤵ Dash ${kwKey.split(':')[1]}</span>`;
    if (kwKey.startsWith('charge:')) return `<span class="kw-badge" style="background:#200808;border-color:#cc4444;color:#ee7070">◎ Charge ${kwKey.split(':')[1]}</span>`;
    return '';
  }
  return `<span class="kw-badge" style="background:${base.bg};border-color:${base.border};color:${base.col}">${base.label}</span>`;
}

// ── Radial Menu Options ────────────────────────────────────
const MENU_OPTS = [
  { id:'land_F',  label:'Wald',       sub:'🌲',  fill:'#1c4a14', stroke:'#4a9e40', textCol:'#7dd870' },
  { id:'land_D',  label:'Wüste',      sub:'🏜',  fill:'#5a2e08', stroke:'#d4982a', textCol:'#f0b84a' },
  { id:'land_M',  label:'Berg',       sub:'⛰',   fill:'#282838', stroke:'#8a8aaa', textCol:'#aaaacc' },
  { id:'land_W',  label:'Wasser',     sub:'🌊',  fill:'#083050', stroke:'#3a8acc', textCol:'#60aaee' },
  { id:'land_N',  label:'2×Neutral',  sub:'··',  fill:'#1a2236', stroke:'#4a5a70', textCol:'#7a9ab0' },
  { id:'_draw',   label:'Karte +1',   sub:'🃏',  fill:'#2a1c08', stroke:'#c8a84b', textCol:'#e8c870' },
  { id:'_boost',  label:'+1 Mana',    sub:'◆',   fill:'#081828', stroke:'#4488cc', textCol:'#68aaee' },
];

// Cards that target own units
const TARGET_OWN  = new Set(['veil','battlecry','ironbark','campfire','elderwood_embrace','gabrian_enchantment','tiki_chieftain']);
// Cards that target enemy units
const TARGET_ENEMY = new Set(['gust','firebomb','flame_burst','soul_drain','last_nightmare','falcon_dive']);
// Cards that target any unit
const TARGET_ANY   = new Set(['gabrian_enchantment','falcon_dive']);
// Cards with no board target (self-effect)
const TARGET_SELF  = new Set(['healing_song','wisdom','wild_growth','shifting_tide','tidal_force']);

// ── Engine ─────────────────────────────────────────────────
class Engine {
  constructor() {
    this.S       = mkState();
    this.selCard = null;
    this.selUnit = null;
    this.pact    = null;  // 'land'|'unit'|'inst'|'move'|'atk'
    this.vt      = [];    // valid target [q,r,s] triples

    this._render();
    this._showSwitch(this.S.ap);
  }

  get ap() { return this.S.ap; }

  // ── Hotseat Switch ─────────────────────────────────────
  dismissSwitch() {
    document.getElementById('sw-ov').classList.remove('on');
    this._runPhase();
  }

  _showSwitch(p) {
    const name = this.S.playerNames?.[p] || `Spieler ${p}`;
    const el = document.getElementById('sc-nm');
    el.textContent = name.toUpperCase();
    el.className   = `sc-nm ${p}`;
    document.getElementById('sw-ov').classList.add('on');
  }

  // ── Phase Loop ──────────────────────────────────────────
  _runPhase() {
    const S = this.S;
    if (S.winner) { this._win(); return; }

    this.selCard = null; this.selUnit = null; this.pact = null; this.vt = [];

    switch (S.phase) {

      case 'DRAW':
        deal(S, this.ap, 1);
        lg(S, this.ap, 'Karte gezogen');
        this._auto(350);
        break;

      case 'MANA': {
        const inc = manaInc(S, this.ap);
        S.players[this.ap].mana += inc;
        if (S.players[this.ap].boostUsed) S.players[this.ap].mana += 1;
        lg(S, this.ap, `+${inc} Mana → ${S.players[this.ap].mana}`);
        // Run Production hooks (onTurnStart)
        runProduction(S, this.ap);
        this._auto(350);
        break;
      }

      case 'CLEANUP':
        doCleanup(S);
        S.players[this.ap].boostUsed = false;
        S.lobDone = false;
        lg(S, this.ap, '— Runde Ende —');
        if (this.ap === 'B') S.turn++;
        S.ap    = this.ap === 'A' ? 'B' : 'A';
        S.phase = 'DRAW';
        S.phaseStep = 0;
        this._render();
        setTimeout(() => this._showSwitch(S.ap), 200);
        return;

      default:
        break;
    }
    this._render();
  }

  _auto(ms)  { setTimeout(() => this._adv(), ms); }

  _adv() {
    const S = this.S;
    const i = PHASES.indexOf(S.phase);
    S.phase     = PHASES[i + 1] || 'CLEANUP';
    S.phaseStep = i + 1;
    this._runPhase();
  }

  nextPhase() { this._adv(); }

  // ── Radial Land Menu ────────────────────────────────────
  openLandMenu() {
    const S = this.S;
    if (S.phase !== 'LAND_OR_BOOST' || S.lobDone) return;
    this._buildSVGMenu();
    document.getElementById('rmenu').classList.add('on');
  }

  closeLandMenu() {
    document.getElementById('rmenu').classList.remove('on');
  }

  _buildSVGMenu() {
    const svg = document.getElementById('rmenu-svg');
    svg.innerHTML = '';
    const W = 340, H = 340, cx = W/2, cy = H/2;
    const R = 38, RR = 88;

    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = `
      <filter id="mhover">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
        <stop offset="60%"  stop-color="rgba(160,30,30,0)"/>
        <stop offset="100%" stop-color="rgba(200,50,50,0.45)"/>
      </radialGradient>`;
    svg.appendChild(defs);

    const addCircle = (r, fill, stroke, sw) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx',cx); c.setAttribute('cy',cy); c.setAttribute('r',r);
      c.setAttribute('fill',fill); c.setAttribute('stroke',stroke); c.setAttribute('stroke-width',sw);
      svg.appendChild(c);
    };
    addCircle(H/2-8,  'url(#ringGrad)','#aa2525','4');
    addCircle(H/2-20, 'none','rgba(180,50,50,0.3)','1.5');

    const sin60 = Math.sin(Math.PI/3), cos60 = Math.cos(Math.PI/3);
    const positions = [
      [cx,            cy           ],
      [cx,            cy - RR      ],
      [cx + RR*sin60, cy - RR*cos60],
      [cx + RR*sin60, cy + RR*cos60],
      [cx,            cy + RR      ],
      [cx - RR*sin60, cy + RR*cos60],
      [cx - RR*sin60, cy - RR*cos60],
    ];
    const assign = [4, 0, 1, 2, 3, 5, 6];
    assign.forEach((optIdx, posIdx) => {
      const [px, py] = positions[posIdx];
      this._addMenuHex(svg, px, py, R, MENU_OPTS[optIdx]);
    });
  }

  _addMenuHex(svg, px, py, R, opt) {
    const ns  = 'http://www.w3.org/2000/svg';
    const pts = Array.from({length:6}, (_,i) => {
      const a = (Math.PI/180)*(60*i);
      return `${(px+R*Math.cos(a)).toFixed(1)},${(py+R*Math.sin(a)).toFixed(1)}`;
    }).join(' ');

    const g = document.createElementNS(ns,'g');
    g.setAttribute('class','mhex');

    const poly = document.createElementNS(ns,'polygon');
    poly.setAttribute('points',pts); poly.setAttribute('fill',opt.fill);
    poly.setAttribute('stroke',opt.stroke); poly.setAttribute('stroke-width','2.5');
    g.appendChild(poly);

    const glow = document.createElementNS(ns,'polygon');
    glow.setAttribute('points',pts); glow.setAttribute('fill','none');
    glow.setAttribute('stroke',opt.stroke); glow.setAttribute('stroke-width','5');
    glow.setAttribute('opacity','0'); glow.setAttribute('filter','url(#mhover)');
    glow.setAttribute('pointer-events','none');
    g.appendChild(glow);

    const sym = document.createElementNS(ns,'text');
    sym.setAttribute('x',px); sym.setAttribute('y',py-2);
    sym.setAttribute('text-anchor','middle'); sym.setAttribute('dominant-baseline','middle');
    sym.setAttribute('font-size',R*0.75); sym.setAttribute('pointer-events','none');
    sym.textContent = opt.sub;
    g.appendChild(sym);

    const lbl = document.createElementNS(ns,'text');
    lbl.setAttribute('x',px); lbl.setAttribute('y',py+R*0.58);
    lbl.setAttribute('text-anchor','middle'); lbl.setAttribute('dominant-baseline','middle');
    lbl.setAttribute('font-family','Cinzel,serif'); lbl.setAttribute('font-size',R*0.25);
    lbl.setAttribute('fill',opt.textCol); lbl.setAttribute('font-weight','bold');
    lbl.setAttribute('pointer-events','none');
    lbl.textContent = opt.label;
    g.appendChild(lbl);

    if (opt.id === 'land_N' || opt.id === '_draw' || opt.id === '_boost') {
      const text = opt.id === 'land_N' ? '×2' : '+1';
      g.appendChild(this._badge(px+R*0.65, py-R*0.55, text, opt.stroke,'#fff'));
    }

    g.onmouseenter = () => { glow.setAttribute('opacity','0.8'); poly.setAttribute('filter','url(#mhover)'); };
    g.onmouseleave = () => { glow.setAttribute('opacity','0');   poly.removeAttribute('filter'); };
    g.onclick      = () => this._selectMenuOpt(opt.id);
    svg.appendChild(g);
  }

  _badge(x, y, text, bg, fg) {
    const ns = 'http://www.w3.org/2000/svg';
    const g  = document.createElementNS(ns,'g');
    g.setAttribute('pointer-events','none');
    const c = document.createElementNS(ns,'circle');
    c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r','11');
    c.setAttribute('fill',bg); c.setAttribute('stroke',fg); c.setAttribute('stroke-width','1.5');
    g.appendChild(c);
    const t = document.createElementNS(ns,'text');
    t.setAttribute('x',x); t.setAttribute('y',y);
    t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
    t.setAttribute('font-family','Cinzel,serif'); t.setAttribute('font-size','9');
    t.setAttribute('fill',fg); t.setAttribute('font-weight','bold');
    t.textContent = text;
    g.appendChild(t);
    return g;
  }

  _selectMenuOpt(id) {
    const S = this.S;
    this.closeLandMenu();

    if (id === '_draw') {
      deal(S, this.ap, 1);
      S.lobDone = true;
      lg(S, this.ap, 'Karte gezogen (Aktion)');
      this._render(); this._auto(300);
      return;
    }
    if (id === '_boost') {
      S.players[this.ap].boostUsed = true;
      S.lobDone = true;
      lg(S, this.ap, '+1 Mana Boost');
      this._render(); this._auto(300);
      return;
    }
    if (id === 'land_N') {
      const spots = adjPlace(S, this.ap);
      let placed = 0;
      for (const [qq,rr,ss] of spots) {
        if (placed >= 2) break;
        if (!unitAt(S,qq,rr,ss)) {
          S.cells[cK(qq,rr)] = { type:'LAND', owner:this.ap, landType:'N' };
          placed++;
        }
      }
      S.lobDone = true;
      lg(S, this.ap, '2× Grasland platziert');
      this._render(); this._auto(300);
      return;
    }

    // Other land types: player picks target cell
    this.selCard = id;
    this.pact    = 'land';
    this.vt      = adjPlace(S, this.ap);
    this._render();
  }

  // ── Card & Unit Selection ───────────────────────────────
  selCardFn(id) {
    const S  = this.S;
    const cd = cardData(id);
    if (!cd) return;

    // Land cards → radial menu
    if (cd.type === 'LAND') { this.openLandMenu(); return; }

    if (S.phase !== 'PLAY' && S.phase !== 'ATTACK') return;
    if (!canPlay(S, this.ap, id)) return;

    this.selCard = id;

    if (cd.type === 'UNIT') {
      this.pact = 'unit';
      // Valid spawns: own land/base cells that are free
      this.vt = Object.entries(S.cells)
        .filter(([k,c]) => c.owner===this.ap && (c.type==='LAND'||c.type==='BASE'))
        .map(([k]) => pK(k))
        .filter(([q,r,s]) => !unitAt(S,q,r,s));
      this._render();
      return;
    }

    // Instant / Event
    if (cd.type === 'INSTANT' || cd.type === 'event') {
      this.pact = 'inst';

      if (TARGET_SELF.has(id)) {
        // No target needed → play immediately
        doPlay(S, this.ap, id, 0, 0, 0);
        this._clr();
        this._render();
        if (S.winner) this._win();
        return;
      }

      if (TARGET_ANY.has(id)) {
        this.vt = Object.values(S.units).map(u => [u.q,u.r,u.s]);
      } else if (TARGET_ENEMY.has(id)) {
        this.vt = Object.values(S.units).filter(u => u.own!==this.ap).map(u => [u.q,u.r,u.s]);
      } else {
        // Default: target own units
        this.vt = Object.values(S.units).filter(u => u.own===this.ap).map(u => [u.q,u.r,u.s]);
      }
      this._render();
    }
  }

  selUnitFn(uid) {
    const S = this.S;
    const u = S.units[uid];
    if (!u || u.own !== this.ap) return;
    this.selCard = null;
    this.selUnit = uid;

    if (S.phase === 'MOVE') {
      this.pact = 'move';
      this.vt   = validMoves(S, uid);
    } else if (S.phase === 'ATTACK') {
      this.pact = 'atk';
      this.vt   = validAtks(S, uid).map(t => [t.q,t.r,t.s]);
    }
    this._showUD(u);
    this._render();
  }

  // ── Board Click Dispatcher ──────────────────────────────
  clickCell(q, r, s) {
    const S   = this.S;
    const isV = this.vt.some(([a,b,c]) => a===q&&b===r&&c===s);

    if (this.pact && isV) {

      if (this.pact === 'land') {
        const cd = cardData(this.selCard);
        if (cd) {
          S.cells[cK(q,r)] = { type:'LAND', owner:this.ap, landType:cd.landType };
          S.lobDone = true;
          lg(S, this.ap, `Platziert ${cd.name}`);
        }
        this._clr(); this._render(); this._auto(300);
        return;
      }

      if (this.pact === 'unit') {
        doPlay(S, this.ap, this.selCard, q, r, s);
        this._clr();
      }

      if (this.pact === 'inst') {
        doPlay(S, this.ap, this.selCard, q, r, s);
        this._clr();
      }

      if (this.pact === 'move' && this.selUnit) {
        const u = S.units[this.selUnit];
        if (u) {
          u.q = q; u.r = r; u.s = s;
          u.moved = true;
          updWells(S);
          lg(S, this.ap, `${cardData(u.cid)?.name || u.id} bewegt`);
        }
        this._clr();
      }

      if (this.pact === 'atk' && this.selUnit) {
        const tu = unitAt(S, q, r, s);
        const [bq,br,bs] = this.ap==='A' ? BASE_B : BASE_A;
        if (tu && tu.own !== this.ap) {
          doAtk(S, this.selUnit, 'unit', tu.id);
        } else if (q===bq && r===br && s===bs) {
          doAtk(S, this.selUnit, 'base', this.ap==='A'?'B':'A');
        }
        this._clr();
      }

      this._render();
      if (S.winner) this._win();
      return;
    }

    // Fall-through: select unit
    const u = unitAt(S, q, r, s);
    if (u) this.selUnitFn(u.id);
  }

  _clr() { this.selCard=null; this.selUnit=null; this.pact=null; this.vt=[]; }
  cancelSel() { this._clr(); this._render(); }

  // ── Unit Detail Panel ───────────────────────────────────
  _showUD(u) {
    const cd = cardData(u.cid);
    const kwBadges = [...u.kw].map(kwBadge).join('');
    const sick  = u.summonSick ? '<span style="color:#cc8833;font-size:.55rem">⏳ Erschöpft</span>' : '';
    const moved = u.moved  ? '<span style="color:#883030;font-size:.55rem">✓ Bew</span>' : '';
    const atked = u.atked  ? '<span style="color:#883030;font-size:.55rem">✓ Atk</span>' : '';
    const prot  = u.protHit ? '<span style="color:#607030;font-size:.55rem">⊕ Schutz verbraucht</span>' : '';
    const tmpAtk = u.atkBuff > 0 ? `<span style="color:#aacc44;font-size:.55rem">+${u.atkBuff} ATK</span>` : '';

    document.getElementById('ud').innerHTML = `
      <div class="udn">${cd?.name || u.cid}</div>
      <div style="display:flex;gap:8px;font-size:.75rem;margin-bottom:4px;flex-wrap:wrap">
        <span style="color:var(--atk)">⚔ ${effAtk(u)}</span>
        <span style="color:var(--hp)">♥ ${u.hp}/${u.maxHp}</span>
        <span style="color:var(--dim)">➤ ${u.bew}</span>
        <span style="color:var(--W)">◎ ${u.rei}</span>
        ${tmpAtk}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px">${kwBadges}</div>
      <div style="font-size:.6rem;color:var(--dim);font-style:italic;margin-bottom:3px">${cd?.text || ''}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">${sick}${moved}${atked}${prot}</div>`;
  }

  _win() {
    const name = this.S.playerNames?.[this.S.winner] || `Spieler ${this.S.winner}`;
    document.getElementById('win-title').textContent = `${name} gewinnt!`;
    document.getElementById('win-ov').classList.add('on');
  }

  // ── Master Render ───────────────────────────────────────
  _render() {
    this._rStats();
    this._rHand();
    this._rPhase();
    this._rBtns();
    this._rLog();
    this._rBoard();
  }

  _rStats() {
    const S = this.S;
    ['A','B'].forEach(p => {
      document.getElementById(`hp-${p}`).textContent    = S.players[p].hp;
      document.getElementById(`mana-${p}`).textContent  = S.players[p].mana;
      document.getElementById(`cards-${p}`).textContent = `${S.players[p].hand.length}/${S.players[p].deck.length}`;
      document.getElementById(`wells-${p}`).textContent = ctrlWells(S, p);
      document.getElementById(`hpbar-${p}`).style.width = `${S.players[p].hp/BASE_HP*100}%`;
    });
    document.getElementById('rnd').textContent = S.turn;
    const n = document.getElementById('apn');
    const nm = S.playerNames?.[S.ap] || `Spieler ${S.ap}`;
    n.textContent = nm.toUpperCase();
    n.className   = `pn ${S.ap}`;
  }

  _rPhase() {
    const S = this.S;
    document.getElementById('ph-name').textContent = PN[S.phase] || S.phase;
    document.getElementById('ph-dots').innerHTML   = PHASES.map((ph,i) =>
      `<span class="pdot ${i<S.phaseStep?'done':i===S.phaseStep?'cur':''}" title="${PN[ph]}"></span>`
    ).join('');
  }

  _rBtns() {
    const S = this.S;
    document.getElementById('btn-land').disabled   = S.phase!=='LAND_OR_BOOST'||S.lobDone;
    document.getElementById('btn-cancel').disabled = !this.pact&&!this.selUnit;
    const auto = ['DRAW','MANA','CLEANUP'];
    const nb   = document.getElementById('btn-next');
    nb.disabled    = auto.includes(S.phase);
    nb.textContent = auto.includes(S.phase) ? '⟳ Auto' : 'Phase ▶';
  }

  _rHand() {
    const S  = this.S;
    const el = document.getElementById('hand-area');
    el.innerHTML = '';
    S.players[this.ap].hand.forEach(id => {
      const cd = cardData(id);
      if (!cd) return;

      const ok    = this._canP(id);
      const isSel = this.selCard === id;

      // Color accent based on card color (Faeria) or type (legacy)
      const colorMap = { blue:'#1a3a5a', green:'#1a3a1a', red:'#3a1a1a', yellow:'#3a2a0a', neutral:'#1a2030' };
      const accent = colorMap[cd.color] || (cd.type==='UNIT'?'#1a2030':'#0d1018');

      // Stats row
      const atk = cd.atk ?? cd.power;
      const hp  = cd.hp  ?? cd.life;
      const kw  = parseKeywords(cd);
      const kwHtml = [...kw].slice(0,3).map(kwBadge).join('');

      // Land requirements
      const reqEntries = Object.entries(cd.req||{}).filter(([,v])=>v>0);
      const landNames  = { lake:'See', forest:'Wald', mountain:'Berg', desert:'Wüste', F:'Wald', M:'Berg', D:'Wüste', W:'See', N:'Neutral' };
      const reqStr     = reqEntries.map(([lt,n])=>`${n}× ${landNames[lt]||lt}`).join(', ');

      const d = document.createElement('div');
      d.className = `hc ${ok?'':'np'} ${isSel?'sel':''}`;
      d.style.cssText = `background:${accent};border-color:${isSel?'#c8a84b':'#252d40'}`;

      d.innerHTML = `
        <div class="ch">
          <span class="cn">${cd.name}</span>
          <span class="cc">${cd.cost>0?cd.cost+'◆':''}</span>
        </div>
        <div class="cb" style="color:${cd.color?{blue:'#3a8acc',green:'#4a9e40',red:'#cc4444',yellow:'#d4982a',neutral:'#8a9ab0'}[cd.color]||'#4a5a72':'#4a5a72'}">
          ${cd.color||cd.type==='LAND'?'':cd.type}
          ${cd.color?cd.color.charAt(0).toUpperCase()+cd.color.slice(1):''}
          ${cd.type==='LAND'?' Land':''}
          ${cd.rarity?'· '+cd.rarity:''}
        </div>
        ${atk!=null?`<div class="cs"><span class="cra">⚔${atk}</span><span class="crh">♥${hp}</span></div>`:''}
        ${kwHtml?`<div style="display:flex;flex-wrap:wrap;gap:2px;margin:2px 0">${kwHtml}</div>`:''}
        ${reqStr?`<div class="creq">Req: ${reqStr}</div>`:''}
        <div class="ctx">${cd.text||''}</div>`;

      if (ok) d.onclick = () => this.selCardFn(id);
      el.appendChild(d);
    });
  }

  _canP(id) {
    const S  = this.S;
    const cd = cardData(id);
    if (!cd) return false;
    if (cd.type === 'LAND')
      return S.phase==='LAND_OR_BOOST' && !S.lobDone;
    if (cd.type === 'UNIT')
      return S.phase==='PLAY' && canPlay(S, this.ap, id);
    if (cd.type === 'INSTANT' || cd.type === 'event')
      return (S.phase==='PLAY'||S.phase==='ATTACK') && canPlay(S, this.ap, id);
    return false;
  }

  _rLog() {
    document.getElementById('lp').innerHTML = this.S.log.slice(0,30).map(e =>
      `<div class="le"><span class="l${e.p==='sys'?'S':e.p}">[${e.p==='sys'?'⚙':e.p}]</span> ${e.m}</div>`
    ).join('');
  }

  // ── SVG Board Renderer ──────────────────────────────────
  _rBoard() {
    const S   = this.S;
    const svg = document.getElementById('board');

    function pts(cx, cy) {
      return Array.from({length:6}, (_,i) => {
        const a = (Math.PI/180)*(60*i);
        return `${(cx+HS*Math.cos(a)).toFixed(1)},${(cy+HS*Math.sin(a)).toFixed(1)}`;
      }).join(' ');
    }

    const cells = allCells();
    let mnX=1e9, mxX=-1e9, mnY=1e9, mxY=-1e9;
    cells.forEach(([q,r]) => {
      const [px,py] = c2p(q,r);
      mnX=Math.min(mnX,px); mxX=Math.max(mxX,px);
      mnY=Math.min(mnY,py); mxY=Math.max(mxY,py);
    });
    const PAD = HS*1.5;
    const W   = mxX-mnX+HS*2+PAD*2;
    const H   = mxY-mnY+HS*2+PAD*2;
    const ox  = -mnX+HS+PAD;
    const oy  = -mnY+HS+PAD;

    svg.setAttribute('width',W);
    svg.setAttribute('height',H);
    svg.innerHTML = '';

    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = `
      <filter id="gw">
        <feGaussianBlur stdDeviation="2.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="wg">
        <feGaussianBlur stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="ss">
        <feColorMatrix type="saturate" values="0.25"/>
      </filter>`;
    svg.appendChild(defs);

    const vs = new Set(this.vt.map(([q,r]) => cK(q,r)));

    // ── Draw cells ──────────────────────────────────────
    cells.forEach(([q,r,s]) => {
      const k  = cK(q,r);
      const cd = S.cells[k];
      const [px,py] = c2p(q,r);
      const cx = px+ox, cy = py+oy;
      const P  = pts(cx,cy);
      const isV = vs.has(k);

      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      g.style.cursor = 'pointer';
      g.onclick = () => this.clickCell(q,r,s);

      let fill='#0a0d12', stroke='#151c26', sw='1';
      if (cd) {
        if      (cd.type==='WELL') { fill='#100818'; stroke='#4a1a88'; sw='1.5'; }
        else if (cd.type==='BASE') { fill=cd.owner==='A'?'#1e0808':'#08081e'; stroke=cd.owner==='A'?'#882222':'#224488'; sw='2'; }
        else if (cd.type==='LAND') { fill=LF[cd.landType]||'#1e2530'; stroke=LS[cd.landType]||'#3a4a60'; }
        else                        { fill='#0e1520'; stroke='#1a2535'; }
      }

      const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
      poly.setAttribute('points',P); poly.setAttribute('fill',fill);
      poly.setAttribute('stroke',stroke); poly.setAttribute('stroke-width',sw);
      g.appendChild(poly);

      // Well orb
      if (cd?.type==='WELL') {
        const glw = document.createElementNS('http://www.w3.org/2000/svg','circle');
        glw.setAttribute('cx',cx); glw.setAttribute('cy',cy); glw.setAttribute('r',HS*.78);
        glw.setAttribute('fill',cd.ctrl==='A'?'rgba(160,40,255,0.22)':cd.ctrl==='B'?'rgba(40,100,255,0.22)':'rgba(80,15,140,0.15)');
        glw.setAttribute('pointer-events','none'); g.appendChild(glw);
        const orb = document.createElementNS('http://www.w3.org/2000/svg','circle');
        orb.setAttribute('cx',cx); orb.setAttribute('cy',cy); orb.setAttribute('r',HS*.35);
        orb.setAttribute('fill',cd.ctrl==='A'?'#bb33ee':cd.ctrl==='B'?'#3366ee':'#6611bb');
        orb.setAttribute('filter','url(#wg)'); orb.setAttribute('pointer-events','none'); g.appendChild(orb);
        const sym = document.createElementNS('http://www.w3.org/2000/svg','text');
        sym.setAttribute('x',cx); sym.setAttribute('y',cy+5); sym.setAttribute('text-anchor','middle');
        sym.setAttribute('fill','#fff'); sym.setAttribute('font-size','14'); sym.setAttribute('pointer-events','none');
        sym.textContent='◎'; g.appendChild(sym);
        if (cd.ctrl) {
          const ol = document.createElementNS('http://www.w3.org/2000/svg','text');
          ol.setAttribute('x',cx); ol.setAttribute('y',cy+HS*.85); ol.setAttribute('text-anchor','middle');
          ol.setAttribute('fill',cd.ctrl==='A'?'#cc44ff':'#4488ff'); ol.setAttribute('font-size','8');
          ol.setAttribute('font-weight','bold'); ol.setAttribute('pointer-events','none');
          ol.textContent=cd.ctrl; g.appendChild(ol);
        }
      }

      // Base decoration
      if (cd?.type==='BASE') {
        const col = cd.owner==='A'?'#ff6060':'#6090ff';
        const t = document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x',cx); t.setAttribute('y',cy+5); t.setAttribute('text-anchor','middle');
        t.setAttribute('fill',col); t.setAttribute('font-size','15'); t.setAttribute('font-family','Cinzel,serif');
        t.setAttribute('font-weight','bold'); t.setAttribute('pointer-events','none');
        t.textContent=cd.owner; g.appendChild(t);
        const hp = document.createElementNS('http://www.w3.org/2000/svg','text');
        hp.setAttribute('x',cx); hp.setAttribute('y',cy+HS*.82); hp.setAttribute('text-anchor','middle');
        hp.setAttribute('fill',cd.owner==='A'?'#cc5050':'#5070cc'); hp.setAttribute('font-size','8');
        hp.setAttribute('pointer-events','none');
        hp.textContent=`${S.players[cd.owner].hp}HP`; g.appendChild(hp);
      }

      // Land emoji + owner dot
      if (cd?.type==='LAND') {
        const em = {F:'🌲',D:'🏜',M:'⛰',W:'🌊',N:'·'}[cd.landType]||'';
        const t = document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x',cx); t.setAttribute('y',cy+6); t.setAttribute('text-anchor','middle');
        t.setAttribute('font-size','14'); t.setAttribute('pointer-events','none'); t.textContent=em; g.appendChild(t);
        const od = document.createElementNS('http://www.w3.org/2000/svg','circle');
        od.setAttribute('cx',cx+HS*.56); od.setAttribute('cy',cy-HS*.56); od.setAttribute('r','4');
        od.setAttribute('fill',cd.owner==='A'?'rgba(200,60,60,.65)':'rgba(60,100,200,.65)');
        od.setAttribute('pointer-events','none'); g.appendChild(od);
      }

      // Valid-target highlight
      if (isV) {
        const hl = document.createElementNS('http://www.w3.org/2000/svg','polygon');
        hl.setAttribute('points',P); hl.setAttribute('fill','rgba(200,168,75,0.15)');
        hl.setAttribute('stroke','#c8a84b'); hl.setAttribute('stroke-width','2');
        hl.setAttribute('pointer-events','none'); g.appendChild(hl);
      }

      svg.appendChild(g);
    });

    // ── Draw units ──────────────────────────────────────
    Object.values(S.units).forEach(u => {
      const [px,py] = c2p(u.q,u.r);
      const cx = px+ox, cy = py+oy;
      const cd    = cardData(u.cid);
      const isSel = this.selUnit === u.id;
      const isVT  = vs.has(cK(u.q,u.r));
      const sick  = u.summonSick;
      const exhausted = u.moved || u.atked;

      // Unit circle
      const circ = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circ.setAttribute('cx',cx); circ.setAttribute('cy',cy); circ.setAttribute('r','13');
      circ.setAttribute('fill', u.own==='A'?'#2a0808':'#08082a');
      circ.setAttribute('stroke', u.own==='A'?'#cc3333':'#3355cc');
      circ.setAttribute('stroke-width', isSel?'3':'1.8');
      if (isSel) circ.setAttribute('filter','url(#gw)');
      if (sick)  circ.setAttribute('opacity','0.55');
      circ.style.cursor='pointer';
      circ.onclick = e => { e.stopPropagation(); this.selUnitFn(u.id); };
      svg.appendChild(circ);

      // Unit name abbreviation (2 chars)
      const label = (cd?.name||u.cid).substring(0,2).toUpperCase();
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x',cx); t.setAttribute('y',cy+4); t.setAttribute('text-anchor','middle');
      t.setAttribute('fill', u.own==='A'?'#ff9090':'#9090ff');
      t.setAttribute('font-size','9'); t.setAttribute('font-weight','bold');
      t.setAttribute('pointer-events','none');
      if (sick) t.setAttribute('opacity','0.55');
      t.textContent=label; svg.appendChild(t);

      // HP bar
      const bW=22, bX=cx-bW/2, bY=cy+15;
      const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
      bg.setAttribute('x',bX); bg.setAttribute('y',bY); bg.setAttribute('width',bW); bg.setAttribute('height','3');
      bg.setAttribute('fill','#111'); bg.setAttribute('rx','1.5'); bg.setAttribute('pointer-events','none');
      svg.appendChild(bg);
      const bar = document.createElementNS('http://www.w3.org/2000/svg','rect');
      bar.setAttribute('x',bX); bar.setAttribute('y',bY);
      bar.setAttribute('width',(u.hp/u.maxHp*bW).toFixed(1)); bar.setAttribute('height','3');
      bar.setAttribute('fill', u.own==='A'?'#aa2222':'#2244aa');
      bar.setAttribute('rx','1.5'); bar.setAttribute('pointer-events','none');
      svg.appendChild(bar);

      // ATK buff indicator (yellow dot)
      if (u.atkBuff > 0) {
        const ab = document.createElementNS('http://www.w3.org/2000/svg','circle');
        ab.setAttribute('cx',cx-11); ab.setAttribute('cy',cy-11); ab.setAttribute('r','4');
        ab.setAttribute('fill','#aacc22'); ab.setAttribute('stroke','#ccee44'); ab.setAttribute('stroke-width','1');
        ab.setAttribute('pointer-events','none'); svg.appendChild(ab);
      }

      // Keyword icons on unit (tiny)
      const kwIcons = [];
      if (u.kw.has('flying'))     kwIcons.push(['✦','#3a8acc']);
      if (u.kw.has('taunt'))      kwIcons.push(['⛊','#d4982a']);
      if (u.kw.has('deathtouch')) kwIcons.push(['☠','#aa44aa']);
      if (u.kw.has('ranged'))     kwIcons.push(['⊕','#c07040']);
      if (u.kw.has('haste')&&!sick) kwIcons.push(['⚡','#a0c040']);
      kwIcons.forEach(([icon, col], i) => {
        const kt = document.createElementNS('http://www.w3.org/2000/svg','text');
        kt.setAttribute('x',cx-10+i*8); kt.setAttribute('y',cy-16);
        kt.setAttribute('text-anchor','middle'); kt.setAttribute('fill',col);
        kt.setAttribute('font-size','7'); kt.setAttribute('pointer-events','none');
        kt.textContent=icon; svg.appendChild(kt);
      });

      // Summon-sickness hourglass
      if (sick) {
        const st = document.createElementNS('http://www.w3.org/2000/svg','text');
        st.setAttribute('x',cx+9); st.setAttribute('y',cy-12);
        st.setAttribute('text-anchor','middle'); st.setAttribute('fill','#cc8833');
        st.setAttribute('font-size','9'); st.setAttribute('pointer-events','none');
        st.textContent='⏳'; svg.appendChild(st);
      }

      // Exhaustion marker (red dot)
      if (exhausted && !sick) {
        const ex = document.createElementNS('http://www.w3.org/2000/svg','circle');
        ex.setAttribute('cx',cx+11); ex.setAttribute('cy',cy-11); ex.setAttribute('r','4');
        ex.setAttribute('fill','#882222'); ex.setAttribute('stroke','#cc4444'); ex.setAttribute('stroke-width','1');
        ex.setAttribute('pointer-events','none'); svg.appendChild(ex);
      }

      // Attack-target ring
      if (isVT && this.pact==='atk') {
        const r2 = document.createElementNS('http://www.w3.org/2000/svg','circle');
        r2.setAttribute('cx',cx); r2.setAttribute('cy',cy); r2.setAttribute('r','17');
        r2.setAttribute('fill','none'); r2.setAttribute('stroke','#cc3333'); r2.setAttribute('stroke-width','2.5');
        r2.setAttribute('pointer-events','none'); svg.appendChild(r2);
      }

      // Selected unit ring
      if (isSel) {
        const sr = document.createElementNS('http://www.w3.org/2000/svg','circle');
        sr.setAttribute('cx',cx); sr.setAttribute('cy',cy); sr.setAttribute('r','17');
        sr.setAttribute('fill','none'); sr.setAttribute('stroke','#c8a84b'); sr.setAttribute('stroke-width','1.5');
        sr.setAttribute('stroke-dasharray','3,2'); sr.setAttribute('pointer-events','none'); svg.appendChild(sr);
      }
    });

    // Enemy base attack highlight
    if (this.pact==='atk') {
      const [bq,br,bs] = this.ap==='A'?BASE_B:BASE_A;
      if (vs.has(cK(bq,br))) {
        const [px,py] = c2p(bq,br);
        const cx=px+ox, cy=py+oy;
        const r2 = document.createElementNS('http://www.w3.org/2000/svg','circle');
        r2.setAttribute('cx',cx); r2.setAttribute('cy',cy); r2.setAttribute('r','20');
        r2.setAttribute('fill','none'); r2.setAttribute('stroke','#cc3333'); r2.setAttribute('stroke-width','3');
        r2.setAttribute('pointer-events','none'); svg.appendChild(r2);
      }
    }
  }
}

// ── CSS for keyword badges (injected once) ─────────────────
const kwStyle = document.createElement('style');
kwStyle.textContent = `.kw-badge {
  display:inline-block; font-size:.48rem; padding:1px 5px;
  border:1px solid; border-radius:2px;
  font-family:'Cinzel',serif; letter-spacing:1px;
  white-space:nowrap;
}`;
document.head.appendChild(kwStyle);

// ── Boot ───────────────────────────────────────────────────
const G = new Engine();
