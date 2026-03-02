// ╔══════════════════════════════════════════════════════════╗
//  HEXFORGE ENGINE  v2
//  Board geometry · Keyword system · State · Combat · Rules
//
//  Keywords supported on units (stored in unit.kw Set):
//    dash:N      — spawns N steps closer to enemy base
//    charge:N    — attack range N (default 1 = melee)
//    taunt       — enemies must target this unit first
//    flying      — can move through empty cells
//    ranged      — no counter-attack when attacking
//    deathtouch  — any damage dealt by this unit kills instantly
//    haste       — can move+attack the turn it is summoned
//    jump        — movement can jump over occupied cells
//    protection  — absorbs first hit, immune to targeted spells
//    divine      — ignores all damage from non-divine sources
//    aquatic     — can move through WELL cells
//
//  Trigger hooks (stored on unit object, defined per card):
//    onDeath(S, unit)          — Last Words
//    onCombat(S, atk, def)     — Combat ability
//    onTurnStart(S, unit)      — Production
// ╚══════════════════════════════════════════════════════════╝

// ── Constants ─────────────────────────────────────────────
const BOARD_R   = 3;
const HS        = 34;
const BASE_HP   = 20;
const BASE_MANA = 3;
const WELL_MANA = 2;
const HAND_MAX  = 7;

// ── Cube Coordinate Helpers ────────────────────────────────
const CDIRS = [[1,-1,0],[-1,1,0],[1,0,-1],[-1,0,1],[0,1,-1],[0,-1,1]];

function cK(q, r)      { return `${q},${r},${-q-r}`; }
function pK(k)          { return k.split(',').map(Number); }
function cDist(a, b)    { return Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2])); }
function cNbr(q, r, s)  { return CDIRS.map(([a,b,c]) => [q+a,r+b,s+c]); }
function inB(q, r, s)   { return Math.abs(q)<=BOARD_R && Math.abs(r)<=BOARD_R && Math.abs(s)<=BOARD_R; }
function c2p(q, r)      { return [HS*1.5*q, HS*(Math.sqrt(3)/2*q + Math.sqrt(3)*r)]; }

// ── Board Special Cells ────────────────────────────────────
const BASE_A = [0, -BOARD_R,  BOARD_R];
const BASE_B = [0,  BOARD_R, -BOARD_R];
const WELLS  = [
  [-BOARD_R,  0,  BOARD_R],
  [ BOARD_R,  0, -BOARD_R],
  [-BOARD_R,  BOARD_R,  0],
  [ BOARD_R, -BOARD_R,  0],
];

function isWell(q,r,s)  { return WELLS.some(([a,b,c]) => a===q&&b===r&&c===s); }
function isBaseA(q,r,s) { return q===BASE_A[0]&&r===BASE_A[1]&&s===BASE_A[2]; }
function isBaseB(q,r,s) { return q===BASE_B[0]&&r===BASE_B[1]&&s===BASE_B[2]; }

function allCells() {
  const out = [];
  for (let q=-BOARD_R; q<=BOARD_R; q++)
    for (let r=-BOARD_R; r<=BOARD_R; r++) {
      const s = -q-r;
      if (Math.abs(s)<=BOARD_R) out.push([q,r,s]);
    }
  return out;
}

// ── Land visuals ───────────────────────────────────────────
const LF = { N:'#1e2530', F:'#1a3a18', D:'#3a2810', M:'#22222e', W:'#0d1e3a' };
const LS = { N:'#3a4a60', F:'#2d5a27', D:'#6a4a18', M:'#4a4a60', W:'#1a4a7a' };

// ── Phase sequence ─────────────────────────────────────────
const PHASES = ['DRAW','LAND_OR_BOOST','MANA','PLAY','MOVE','ATTACK','CLEANUP'];
const PN = {
  DRAW:'Ziehen', LAND_OR_BOOST:'Land/Boost', MANA:'Mana',
  PLAY:'Spielen', MOVE:'Bewegen', ATTACK:'Angriff', CLEANUP:'Aufräumen'
};

// ══════════════════════════════════════════════════════════
//  KEYWORD PARSER
// ══════════════════════════════════════════════════════════
function parseKeywords(card) {
  const kw = new Set();
  if (!card) return kw;

  // Explicit kw array wins (used by legacy DB)
  if (Array.isArray(card.kw)) {
    card.kw.forEach(k => kw.add(k.toLowerCase()));
    return kw;
  }

  // Auto-detect from text field (Faeria CARD_DB)
  const text = (card.text || '').toLowerCase();

  const dashM = text.match(/\bdash\s+(\d)/);
  const chrgM = text.match(/\bcharge\s+(\d)/);
  if (dashM) kw.add(`dash:${dashM[1]}`);
  if (chrgM) kw.add(`charge:${chrgM[1]}`);

  ['jump','flying','ranged','taunt','haste',
   'deathtouch','protection','divine','aquatic'].forEach(b => {
    if (text.includes(b)) kw.add(b);
  });

  return kw;
}

function kwDash(kw)   { for (const k of kw) { const m=k.match(/^dash:(\d)$/);   if(m) return +m[1]; } return 0; }
function kwCharge(kw) { for (const k of kw) { const m=k.match(/^charge:(\d)$/); if(m) return +m[1]; } return 1; }

// ══════════════════════════════════════════════════════════
//  LEGACY CARD DATABASE
// ══════════════════════════════════════════════════════════
const DB = {
  // Lands
  land_F: { id:'land_F', name:'Waldlichtung', type:'LAND', landType:'F', cost:0, req:{}, text:'Platziert ein Waldfeld.' },
  land_D: { id:'land_D', name:'Wüstenoase',   type:'LAND', landType:'D', cost:0, req:{}, text:'Platziert ein Wüstenfeld.' },
  land_M: { id:'land_M', name:'Bergpass',     type:'LAND', landType:'M', cost:0, req:{}, text:'Platziert ein Bergfeld.' },
  land_W: { id:'land_W', name:'Flachufer',    type:'LAND', landType:'W', cost:0, req:{}, text:'Platziert ein Seefeld.' },
  land_N: { id:'land_N', name:'Grasland',     type:'LAND', landType:'N', cost:0, req:{}, text:'Platziert 2 neutrale Felder.' },

  // Units
  scout_F:    { id:'scout_F',    name:'Waldläufer',    type:'UNIT', cost:2, req:{F:1}, atk:2, hp:4,  kw:['dash:1'],            text:'Dash 1.' },
  guardian_M: { id:'guardian_M', name:'Steinwächter',  type:'UNIT', cost:4, req:{M:2}, atk:3, hp:6,  kw:['taunt'],             text:'Taunt.' },
  rider_D:    { id:'rider_D',    name:'Wüstenreiter',  type:'UNIT', cost:3, req:{D:1}, atk:3, hp:3,  kw:['dash:2','haste'],    text:'Dash 2, Haste.' },
  sprite_W:   { id:'sprite_W',   name:'Seenixe',       type:'UNIT', cost:3, req:{W:1}, atk:2, hp:2,  kw:['aquatic','charge:2'],text:'Aquatic, Charge 2.' },
  archer_M:   { id:'archer_M',   name:'Bergschütze',   type:'UNIT', cost:3, req:{M:1}, atk:2, hp:3,  kw:['ranged','charge:2'], text:'Ranged, Charge 2.' },
  brawler_N:  { id:'brawler_N',  name:'Söldner',       type:'UNIT', cost:2, req:{},    atk:2, hp:3,  kw:[],                   text:'Keine Landrequirements.' },
  emissary:   { id:'emissary',   name:'Dualist',       type:'UNIT', cost:5, req:{F:1,D:1}, atk:4, hp:4, kw:['jump'],          text:'Jump.' },
  wellkeeper: { id:'wellkeeper', name:'Brunnenwächter', type:'UNIT', cost:3, req:{},   atk:1, hp:5,  kw:['taunt'],             text:'Taunt. Adj. Well: +1 Mana.' },
  sky_knight: { id:'sky_knight', name:'Himmelsritter',  type:'UNIT', cost:4, req:{},   atk:3, hp:3,  kw:['flying','charge:2'],text:'Flying, Charge 2.' },
  death_monk: { id:'death_monk', name:'Todesmonch',     type:'UNIT', cost:3, req:{},   atk:1, hp:4,  kw:['deathtouch'],       text:'Deathtouch.' },

  // Instants
  veil:      { id:'veil',      name:'Tarnschleier', type:'INSTANT', cost:1, req:{F:1}, text:'-2 Schaden an eigener Einheit.' },
  gust:      { id:'gust',      name:'Sandschwall',  type:'INSTANT', cost:2, req:{D:2}, text:'Schiebe Gegner 1 Feld, 1 Schaden.' },
  battlecry: { id:'battlecry', name:'Schlachtruf',  type:'INSTANT', cost:2, req:{},    text:'Gib einer eigenen Einheit +2/+0 bis Rundenende.' },
  ironbark:  { id:'ironbark',  name:'Eisenrinde',   type:'INSTANT', cost:2, req:{F:1}, text:'Gib einer eigenen Einheit +0/+3 und Taunt.' },
};

// ── Unified card lookup ────────────────────────────────────
function cardData(id) {
  return DB[id] || (typeof CARD_DB !== 'undefined' && CARD_DB[id]) || null;
}

// ══════════════════════════════════════════════════════════
//  UNIT FACTORY
// ══════════════════════════════════════════════════════════
function mkUnit(S, p, cardId, q, r, s) {
  const cd = cardData(cardId);
  if (!cd || cd.type !== 'UNIT') return null;

  const kw      = parseKeywords(cd);
  const uid     = `u${S.uid++}`;
  const baseAtk = cd.atk ?? cd.power ?? 0;
  const baseHp  = cd.hp  ?? cd.life  ?? 1;

  let bew = cd.bew ?? 2;
  if (kw.has('flying') && !cd.bew) bew = 3;

  const rei = kwCharge(kw);

  // ── Dash: walk toward enemy base at spawn time ──────────
  const dashN  = kwDash(kw);
  let spawnQ = q, spawnR = r, spawnS = s;
  if (dashN > 0) {
    const target = p === 'A' ? BASE_B : BASE_A;
    let cur = [q, r, s];
    for (let i = 0; i < dashN; i++) {
      const candidates = cNbr(...cur).filter(([nq,nr,ns]) => {
        if (!inB(nq,nr,ns)) return false;
        const k = cK(nq,nr);
        const c = S.cells[k];
        if (!c || c.type === 'EMPTY') return false;
        if (c.type === 'BASE' && c.owner !== p) return false;
        if (c.type === 'LAND' && c.owner !== p) return false;
        if (unitAt(S,nq,nr,ns)) return false;
        return true;
      });
      if (!candidates.length) break;
      candidates.sort((a,b) => cDist(a, target) - cDist(b, target));
      cur = candidates[0];
    }
    [spawnQ, spawnR, spawnS] = cur;
  }

  const unit = {
    id: uid, own: p, cid: cardId,
    q: spawnQ, r: spawnR, s: spawnS,
    hp: baseHp, maxHp: baseHp, atk: baseAtk,
    bew, rei, kw,
    moved: false, atked: false,
    summonSick: !kw.has('haste'),
    atkBuff: 0, hpBuff: 0,
    protHit: false,
  };

  if (cd.onDeath)     unit.onDeath     = cd.onDeath;
  if (cd.onCombat)    unit.onCombat    = cd.onCombat;
  if (cd.onTurnStart) unit.onTurnStart = cd.onTurnStart;

  return unit;
}

// ══════════════════════════════════════════════════════════
//  BUFF HELPERS
// ══════════════════════════════════════════════════════════
function buffUnit(unit, dAtk, dHp) {
  unit.atk    = Math.max(0, unit.atk + dAtk);
  unit.hp     = Math.max(1, unit.hp  + dHp);
  unit.maxHp += dHp;
}

function tempBuff(unit, dAtk, dHp) {
  unit.atkBuff = (unit.atkBuff || 0) + dAtk;
  unit.hpBuff  = (unit.hpBuff  || 0) + dHp;
}

function effAtk(unit) {
  return (unit.atk || 0) + (unit.atkBuff || 0);
}

function clearTempBuffs(S) {
  Object.values(S.units).forEach(u => { u.atkBuff = 0; u.hpBuff = 0; });
}

// ══════════════════════════════════════════════════════════
//  TAUNT
// ══════════════════════════════════════════════════════════
function tauntTargets(S, attackerOwn) {
  const enemy = attackerOwn === 'A' ? 'B' : 'A';
  return Object.values(S.units).filter(u => u.own === enemy && u.kw.has('taunt'));
}

// ══════════════════════════════════════════════════════════
//  DAMAGE  (Protection, Divine, Deathtouch)
// ══════════════════════════════════════════════════════════
function applyDmg(S, target, amount, source) {
  if (!target || amount <= 0) return 0;

  // Divine: immune unless source is also divine
  if (target.kw && target.kw.has('divine') && !(source?.kw?.has('divine'))) {
    lg(S, target.own, `${cardData(target.cid)?.name} — göttliche Immunität!`);
    return 0;
  }

  // Protection: absorb first hit
  if (target.kw && target.kw.has('protection') && !target.protHit) {
    target.protHit = true;
    lg(S, target.own, `${cardData(target.cid)?.name} — Schutz absorbiert!`);
    return 0;
  }

  // Deathtouch
  if (source?.kw?.has('deathtouch')) {
    target.hp = 0;
    return amount;
  }

  target.hp -= amount;
  return amount;
}

// ══════════════════════════════════════════════════════════
//  DEATH  (Last Words hook + removal)
// ══════════════════════════════════════════════════════════
function resolveDeath(S, uid) {
  const u = S.units[uid];
  if (!u) return;
  lg(S, 'sys', `${cardData(u.cid)?.name || uid} stirbt`);
  if (typeof u.onDeath === 'function') {
    try { u.onDeath(S, u); } catch(e) { console.warn('onDeath', e); }
  }
  S.players[u.own].grave.push(u.cid);
  delete S.units[uid];
}

// ══════════════════════════════════════════════════════════
//  FALLBACK DECKS
// ══════════════════════════════════════════════════════════
function mkDefaultDeck(player) {
  const d = [];
  const add = (id, n) => { for(let i=0;i<n;i++) d.push(id); };
  if (player === 'A') {
    add('land_F',3); add('land_M',3); add('land_N',1);
    add('scout_F',3); add('guardian_M',2); add('archer_M',2);
    add('brawler_N',3); add('emissary',1); add('wellkeeper',3);
    add('veil',2); add('battlecry',2); add('ironbark',2);
    add('sky_knight',2); add('death_monk',1);
  } else {
    add('land_D',3); add('land_W',3); add('land_N',1);
    add('rider_D',3); add('sprite_W',3); add('brawler_N',3);
    add('wellkeeper',3); add('gust',3);
    add('archer_M',2); add('sky_knight',2); add('death_monk',1);
    add('battlecry',2); add('ironbark',1);
  }
  for (let i=d.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [d[i],d[j]]=[d[j],d[i]];
  }
  return d;
}

function loadGameParams() {
  try { const r=sessionStorage.getItem('hf_game_params'); if(r) return JSON.parse(r); } catch(e) {}
  return null;
}

// ══════════════════════════════════════════════════════════
//  STATE FACTORY
// ══════════════════════════════════════════════════════════
function mkState() {
  const params = loadGameParams();
  const rawA   = params?.deckA || mkDefaultDeck('A');
  const rawB   = params?.deckB || mkDefaultDeck('B');
  const filter = arr => (Array.isArray(arr)?arr:[]).filter(id => cardData(id));

  const S = {
    turn:1, ap:'A', phase:'DRAW', phaseStep:0, lobDone:false,
    playerNames:{ A:params?.nameA||'Spieler A', B:params?.nameB||'Spieler B' },
    players:{
      A:{ hp:BASE_HP, mana:BASE_MANA, deck:filter(rawA), hand:[], grave:[], boostUsed:false },
      B:{ hp:BASE_HP, mana:BASE_MANA, deck:filter(rawB), hand:[], grave:[], boostUsed:false },
    },
    cells:{}, units:{}, uid:1, log:[], winner:null,
  };

  allCells().forEach(([q,r,s]) => {
    const k = cK(q,r);
    if      (isBaseA(q,r,s)) S.cells[k] = { type:'BASE', owner:'A' };
    else if (isBaseB(q,r,s)) S.cells[k] = { type:'BASE', owner:'B' };
    else if (isWell(q,r,s))  S.cells[k] = { type:'WELL', ctrl:null };
    else                     S.cells[k] = { type:'EMPTY' };
  });

  deal(S,'A',5); deal(S,'B',5);
  return S;
}

// ── Helpers ────────────────────────────────────────────────
function deal(S, p, n) {
  const pl = S.players[p];
  for (let i=0;i<n;i++) {
    if (!pl.deck.length || pl.hand.length>=HAND_MAX) break;
    pl.hand.push(pl.deck.shift());
  }
}

function landCnt(S, p, lt) {
  return Object.values(S.cells).filter(c=>c.owner===p&&c.type==='LAND'&&c.landType===lt).length;
}

function ctrlWells(S, p) {
  return WELLS.filter(([q,r,s]) => { const c=S.cells[cK(q,r)]; return c&&c.ctrl===p; }).length;
}

function canPlay(S, p, id) {
  const cd = cardData(id);
  if (!cd) return false;
  if (S.players[p].mana < cd.cost) return false;
  for (const [lt, n] of Object.entries(cd.req || {})) {
    const key = { lake:'W', forest:'F', mountain:'M', desert:'D' }[lt] || lt;
    if (landCnt(S,p,key) < n) return false;
  }
  return true;
}

function unitAt(S, q, r, s) {
  return Object.values(S.units).find(u=>u.q===q&&u.r===r&&u.s===s) || null;
}

function lg(S, p, m) {
  S.log.unshift({ p, m, t:S.turn });
  if (S.log.length>60) S.log.pop();
}

function updWells(S) {
  WELLS.forEach(([wq,wr,ws]) => {
    const k=cK(wq,wr); let a=0, b=0;
    cNbr(wq,wr,ws).forEach(([q,r,s]) => {
      const u=unitAt(S,q,r,s); if(u) { if(u.own==='A') a++; else b++; }
    });
    S.cells[k].ctrl=(a>0&&b===0)?'A':(b>0&&a===0)?'B':null;
  });
}

function manaInc(S, p) {
  updWells(S);
  const w=ctrlWells(S,p); let bonus=0;
  Object.values(S.units).forEach(u => {
    if (u.own===p&&u.cid==='wellkeeper') {
      if (WELLS.some(([wq,wr,ws]) => { const c=S.cells[cK(wq,wr)]; return cDist([u.q,u.r,u.s],[wq,wr,ws])===1&&c&&c.ctrl===p; }))
        bonus++;
    }
  });
  return BASE_MANA + w*WELL_MANA + bonus;
}

function adjPlace(S, p) {
  const v=new Set();
  for (const [k,c] of Object.entries(S.cells)) {
    if (c.owner===p&&(c.type==='LAND'||c.type==='BASE')) {
      const [q,r,s]=pK(k);
      cNbr(q,r,s).forEach(([nq,nr,ns]) => {
        if (!inB(nq,nr,ns)) return;
        const nk=cK(nq,nr); const nc=S.cells[nk];
        if (nc&&nc.type==='EMPTY') v.add(nk);
      });
    }
  }
  return [...v].map(pK);
}

// ══════════════════════════════════════════════════════════
//  MOVEMENT BFS  (Flying / Jump / Aquatic)
// ══════════════════════════════════════════════════════════
function validMoves(S, uid) {
  const u=S.units[uid];
  if (!u||u.summonSick||u.moved||u.atked) return [];

  const flying  = u.kw.has('flying');
  const jump    = u.kw.has('jump');
  const aquatic = u.kw.has('aquatic');

  const visited  = new Set([cK(u.q,u.r)]);
  const frontier = [[u.q,u.r,u.s,0]];
  const result   = [];

  while (frontier.length) {
    const [q,r,s,d] = frontier.shift();
    if (d >= u.bew) continue;
    cNbr(q,r,s).forEach(([nq,nr,ns]) => {
      if (!inB(nq,nr,ns)) return;
      const k=cK(nq,nr);
      if (visited.has(k)) return;
      visited.add(k);
      const c=S.cells[k];
      if (!c) return;

      if (flying) {
        // Flying: pass over empty, land anywhere passable
        if (c.type==='EMPTY') { frontier.push([nq,nr,ns,d+1]); return; }
        if (c.type==='BASE'&&c.owner!==u.own) return;
        if (unitAt(S,nq,nr,ns)) return;
        result.push([nq,nr,ns]);
        frontier.push([nq,nr,ns,d+1]);
        return;
      }

      if (c.type==='EMPTY') return;
      if (c.type==='WELL') {
        if (!aquatic) return;
        if (unitAt(S,nq,nr,ns)) return;
        result.push([nq,nr,ns]);
        frontier.push([nq,nr,ns,d+1]);
        return;
      }
      if (c.type==='BASE'&&c.owner!==u.own) return;
      if (c.type==='LAND'&&c.owner!==u.own) return;

      if (unitAt(S,nq,nr,ns)) {
        if (jump) frontier.push([nq,nr,ns,d+1]);
        return;
      }
      result.push([nq,nr,ns]);
      frontier.push([nq,nr,ns,d+1]);
    });
  }
  return result;
}

// ══════════════════════════════════════════════════════════
//  ATTACK TARGETS  (Taunt, Charge, summon sickness)
// ══════════════════════════════════════════════════════════
function validAtks(S, uid) {
  const u=S.units[uid];
  if (!u||u.atked||u.summonSick) return [];

  const enemy    = u.own==='A'?'B':'A';
  const taunters = tauntTargets(S, u.own);

  const inRange = Object.values(S.units).filter(t =>
    t.own===enemy && cDist([u.q,u.r,u.s],[t.q,t.r,t.s])<=u.rei
  );

  const filtered = taunters.length > 0
    ? inRange.filter(t => t.kw.has('taunt'))
    : inRange;

  const result = filtered.map(t => ({ type:'unit', id:t.id, q:t.q, r:t.r, s:t.s }));

  const canHitBase = taunters.length===0 ||
    taunters.every(t => cDist([u.q,u.r,u.s],[t.q,t.r,t.s])>u.rei);

  if (canHitBase) {
    const [bq,br,bs] = u.own==='A'?BASE_B:BASE_A;
    if (cDist([u.q,u.r,u.s],[bq,br,bs])<=u.rei)
      result.push({ type:'base', own:enemy, q:bq, r:br, s:bs });
  }
  return result;
}

// ══════════════════════════════════════════════════════════
//  COMBAT
// ══════════════════════════════════════════════════════════
function doAtk(S, attackerId, targetType, targetId) {
  const a=S.units[attackerId];
  if (!a||a.atked||a.summonSick) return;

  const aName = cardData(a.cid)?.name || attackerId;

  if (targetType==='unit') {
    const d=S.units[targetId];
    if (!d) return;
    const dName = cardData(d.cid)?.name || targetId;
    lg(S, a.own, `${aName} ⚔ ${dName}`);

    applyDmg(S, d, effAtk(a), a);
    lg(S, a.own, `→ ${dName}: ${Math.max(0,d.hp)} HP verbleibend`);

    if (!a.kw.has('ranged') && S.units[targetId] && d.hp>0) {
      applyDmg(S, a, effAtk(d), d);
      lg(S, d.own, `↩ Gegenschlag: ${aName}: ${Math.max(0,a.hp)} HP verbleibend`);
    }

    if (S.units[targetId]  && d.hp<=0) resolveDeath(S, targetId);
    if (S.units[attackerId]&& a.hp<=0) { resolveDeath(S, attackerId); return; }

    if (S.units[attackerId] && typeof a.onCombat==='function') {
      try { a.onCombat(S,a,d); } catch(e) { console.warn('onCombat',e); }
    }
  } else {
    const dmg=effAtk(a);
    S.players[targetId].hp -= dmg;
    lg(S, a.own, `⚔ Basis ${targetId}: -${dmg}HP → ${S.players[targetId].hp} verbleibend`);
    if (S.players[targetId].hp<=0) S.winner=a.own;
    if (S.units[attackerId]&&typeof a.onCombat==='function') {
      try { a.onCombat(S,a,null); } catch(e) {}
    }
  }

  if (S.units[attackerId]) S.units[attackerId].atked=true;
}

// ══════════════════════════════════════════════════════════
//  CARD PLAY
// ══════════════════════════════════════════════════════════
function doPlay(S, p, id, q, r, s) {
  const cd=cardData(id);
  const pl=S.players[p];
  if (!canPlay(S,p,id)) return false;

  pl.mana -= cd.cost;
  pl.hand.splice(pl.hand.indexOf(id),1);

  // ── LAND ──────────────────────────────────────────────
  if (cd.type==='LAND') {
    if (id==='land_N') {
      const spots=adjPlace(S,p);
      const first=spots.find(([qq,rr,ss])=>!unitAt(S,qq,rr,ss));
      if (first) S.cells[cK(first[0],first[1])]={ type:'LAND', owner:p, landType:'N' };
      const spots2=adjPlace(S,p);
      const second=spots2.find(([qq,rr])=>first&&cK(qq,rr)!==cK(first[0],first[1]));
      if (second) S.cells[cK(second[0],second[1])]={ type:'LAND', owner:p, landType:'N' };
    } else {
      S.cells[cK(q,r)]={ type:'LAND', owner:p, landType:cd.landType };
    }
    lg(S,p,`Platziert ${cd.name}`);
    S.lobDone=true;
    return true;
  }

  // ── UNIT ──────────────────────────────────────────────
  if (cd.type==='UNIT') {
    const unit=mkUnit(S,p,id,q,r,s);
    if (!unit) return false;
    S.units[unit.id]=unit;
    const kwList=[...unit.kw].filter(k=>k!=='').join(', ');
    lg(S,p,`Beschwört ${cd.name}${kwList?' ['+kwList+']':''}`);
    return true;
  }

  // ── INSTANT / EVENT ───────────────────────────────────
  if (cd.type==='INSTANT'||cd.type==='event') {
    if (typeof cd.onPlay==='function') {
      cd.onPlay(S,p,q,r,s);
      pl.grave.push(id);
      return true;
    }

    const u = unitAt(S,q,r,s);

    switch(id) {
      case 'veil':
        if (u&&u.own===p) { u._sh=(u._sh||0)+2; lg(S,p,'Tarnschleier: +2 Schadenspuffer'); } break;

      case 'gust': {
        if (u&&u.own!==p) {
          const nb=cNbr(q,r,s).filter(([nq,nr,ns])=>inB(nq,nr,ns)&&!unitAt(S,nq,nr,ns));
          if (nb.length) { const[nq,nr,ns]=nb[0]; u.q=nq;u.r=nr;u.s=ns; }
          u.hp--; if(u.hp<=0) resolveDeath(S,u.id);
          lg(S,p,'Sandschwall!');
        } break;
      }

      case 'battlecry':
        if (u&&u.own===p) { tempBuff(u,2,0); lg(S,p,`Schlachtruf: ${cardData(u.cid)?.name} +2 ATK`); } break;

      case 'ironbark':
        if (u&&u.own===p) { buffUnit(u,0,3); u.kw.add('taunt'); lg(S,p,`Eisenrinde: ${cardData(u.cid)?.name} +3 HP + Taunt`); } break;

      case 'campfire':
        if (u&&u.own===p) { buffUnit(u,1,1); lg(S,p,`Lagerfeuer: ${cardData(u.cid)?.name} +1/+1`); } break;

      case 'healing_song':
        deal(S,p,1); S.players[p].hp=Math.min(BASE_HP,S.players[p].hp+5);
        lg(S,p,'Heilungslied: +5 LP, 1 Karte'); break;

      case 'wisdom': case 'tidal_force': case 'shifting_tide':
        deal(S,p,2); lg(S,p,`${cd.name}: 2 Karten gezogen`); break;

      case 'falcon_dive':
        if (u) { applyDmg(S,u,1,null); if(u.hp<=0)resolveDeath(S,u.id); lg(S,p,'Falkensturz: 1 Schaden'); } break;

      case 'elderwood_embrace':
        if (u&&u.own===p) { buffUnit(u,2,4); lg(S,p,`Umarmung: ${cardData(u.cid)?.name} +2/+4`); } break;

      case 'firebomb':
        if (u) { applyDmg(S,u,4,null); if(u.hp<=0)resolveDeath(S,u.id); lg(S,p,'Feuerbombe: 4 Schaden'); } break;

      case 'flame_burst':
        if (u) { applyDmg(S,u,3,null); if(u.hp<=0)resolveDeath(S,u.id); lg(S,p,'Feuerstrahl: 3 Schaden'); } break;

      case 'soul_drain':
        if (u&&u.own!==p) {
          applyDmg(S,u,2,null);
          S.players[p].hp=Math.min(BASE_HP,S.players[p].hp+2);
          if(u.hp<=0)resolveDeath(S,u.id);
          lg(S,p,'Seelenraub: 2 Schaden, +2 LP');
        } break;

      case 'gabrian_enchantment':
        if (u) { u.atk=u.hp; deal(S,p,1); lg(S,p,`Gabrischer Zauber: ATK=${u.hp}, +1 Karte`); } break;

      case 'wild_growth': {
        const spots=adjPlace(S,p);
        if (spots.length) {
          const[tq,tr]=spots[Math.floor(Math.random()*spots.length)];
          S.cells[cK(tq,tr)]={ type:'LAND', owner:p, landType:'F' };
          lg(S,p,'Wildes Wachstum: Wald erzeugt');
        } break;
      }

      default:
        lg(S,p,`${cd.name} gespielt`);
    }

    pl.grave.push(id);
    return true;
  }

  return false;
}

// ══════════════════════════════════════════════════════════
//  PRODUCTION  (onTurnStart hooks)
// ══════════════════════════════════════════════════════════
function runProduction(S, p) {
  Object.values(S.units).forEach(u => {
    if (u.own!==p) return;
    if (typeof u.onTurnStart==='function') {
      try { u.onTurnStart(S,u); } catch(e) { console.warn('onTurnStart',e); }
    }
  });
}

// ══════════════════════════════════════════════════════════
//  CLEANUP
// ══════════════════════════════════════════════════════════
function doCleanup(S) {
  clearTempBuffs(S);
  Object.values(S.units).forEach(u => {
    u.moved=false; u.atked=false; u.summonSick=false;
  });
}
