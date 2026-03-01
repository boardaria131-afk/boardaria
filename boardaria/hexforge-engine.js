// ╔══════════════════════════════════════════════════════════╗
//  HEXFORGE ENGINE
//  Board geometry · Card DB · State · Combat · Rules
// ╚══════════════════════════════════════════════════════════╝

// ── Constants ─────────────────────────────────────────────
const BOARD_R  = 3;   // hex radius → 37 playable cells
const HS       = 34;  // pixel size of one hex (flat-top)
const BASE_HP  = 20;
const BASE_MANA = 3;
const WELL_MANA = 2;
const HAND_MAX  = 7;

// ── Cube Coordinate Helpers ────────────────────────────────
// Flat-top hex grid: q+r+s = 0
const CDIRS = [[1,-1,0],[-1,1,0],[1,0,-1],[-1,0,1],[0,1,-1],[0,-1,1]];

/** Canonical key string for a cube coord */
function cK(q, r)       { return `${q},${r},${-q-r}`; }

/** Parse a key back to [q,r,s] */
function pK(k)           { return k.split(',').map(Number); }

/** Chebyshev distance between two cube coords (arrays of 3) */
function cDist(a, b) {
  return Math.max(Math.abs(a[0]-b[0]), Math.abs(a[1]-b[1]), Math.abs(a[2]-b[2]));
}

/** All 6 neighbours of (q,r,s) */
function cNbr(q, r, s)  { return CDIRS.map(([a,b,c]) => [q+a, r+b, s+c]); }

/** Is this cube coord inside the board diamond? */
function inB(q, r, s)   { return Math.abs(q)<=BOARD_R && Math.abs(r)<=BOARD_R && Math.abs(s)<=BOARD_R; }

/** Flat-top pixel centre from cube coord */
function c2p(q, r)      { return [HS * 1.5 * q,  HS * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)]; }

// ── Board Special Cells ────────────────────────────────────
// Radius-3 diamond, flat-top orientation:
//   Bases at the top and bottom poles.
//   Wells at the 4 side corners (equidistant from both bases).
//
//          [0,-3, 3]  ← BASE A
//        /            \
//  [-3,0,3]    …    [3,0,-3]   ← WELLS (left/right corners)
//        \            /
//  [-3,3,0]    …    [3,-3,0]   ← WELLS (left/right corners)
//        \            /
//          [0, 3,-3]  ← BASE B
//
// dist(BASE_A, any WELL) = 3  — gives players one turn to expand before
// the contest for wells begins (intentional pacing decision).
// dist(WELL, WELL adjacent pair) = 3 as well.

const BASE_A = [0, -BOARD_R,  BOARD_R];  // top pole
const BASE_B = [0,  BOARD_R, -BOARD_R];  // bottom pole

const WELLS = [
  [-BOARD_R,  0,  BOARD_R],  // left
  [ BOARD_R,  0, -BOARD_R],  // right
  [-BOARD_R,  BOARD_R,  0],  // bottom-left
  [ BOARD_R, -BOARD_R,  0],  // top-right
];

function isWell(q,r,s)  { return WELLS.some(([a,b,c]) => a===q && b===r && c===s); }
function isBaseA(q,r,s) { return q===BASE_A[0] && r===BASE_A[1] && s===BASE_A[2]; }
function isBaseB(q,r,s) { return q===BASE_B[0] && r===BASE_B[1] && s===BASE_B[2]; }

/** Return all [q,r,s] triples that are inside the board */
function allCells() {
  const out = [];
  for (let q = -BOARD_R; q <= BOARD_R; q++)
    for (let r = -BOARD_R; r <= BOARD_R; r++) {
      const s = -q - r;
      if (Math.abs(s) <= BOARD_R) out.push([q, r, s]);
    }
  return out;
}

// ── Card Database ──────────────────────────────────────────
// type:  'LAND' | 'UNIT' | 'INSTANT'
// req:   { landType: count } — land requirements to play
// native: land type that gives terrain bonus
// atk/hp/bew/rei: combat stats (UNIT only)
const DB = {
  // --- Land cards (cost 0, always playable in LAND_OR_BOOST phase) ---
  land_F: { id:'land_F', name:'Waldlichtung', type:'LAND', landType:'F', cost:0, req:{}, text:'Platziert ein Waldfeld.' },
  land_D: { id:'land_D', name:'Wüstenoase',   type:'LAND', landType:'D', cost:0, req:{}, text:'Platziert ein Wüstenfeld.' },
  land_M: { id:'land_M', name:'Bergpass',     type:'LAND', landType:'M', cost:0, req:{}, text:'Platziert ein Bergfeld.' },
  land_W: { id:'land_W', name:'Flachufer',    type:'LAND', landType:'W', cost:0, req:{}, text:'Platziert ein Seefeld.' },
  land_N: { id:'land_N', name:'Grasland',     type:'LAND', landType:'N', cost:0, req:{}, text:'Platziert 2 neutrale Felder.' },

  // --- Unit cards ---
  scout_F:    { id:'scout_F',    name:'Waldläufer',    type:'UNIT', cost:2, req:{F:1}, native:'F', atk:2, hp:4, bew:2, rei:1, text:'Auf Wald: +1 BEW.' },
  guardian_M: { id:'guardian_M', name:'Steinwächter',  type:'UNIT', cost:4, req:{M:2}, native:'M', atk:3, hp:6, bew:1, rei:1, text:'Min. 1 Schaden pro Treffer.' },
  rider_D:    { id:'rider_D',    name:'Wüstenreiter',  type:'UNIT', cost:3, req:{D:1}, native:'D', atk:3, hp:3, bew:3, rei:1, text:'Nach Angriff: Rückzug.' },
  sprite_W:   { id:'sprite_W',   name:'Seenixe',       type:'UNIT', cost:3, req:{W:1}, native:'W', atk:2, hp:2, bew:2, rei:2, text:'Auf See: REI+1.' },
  archer_M:   { id:'archer_M',   name:'Bergschütze',   type:'UNIT', cost:3, req:{M:1}, native:'M', atk:2, hp:3, bew:1, rei:2, text:'Fernkampf, kein Gegenschlag.' },
  brawler_N:  { id:'brawler_N',  name:'Söldner',       type:'UNIT', cost:2, req:{},    native:null, atk:2, hp:3, bew:2, rei:1, text:'Keine Landrequirements.' },
  emissary:   { id:'emissary',   name:'Dualist',       type:'UNIT', cost:5, req:{F:1,D:1}, native:null, atk:4, hp:4, bew:2, rei:1, text:'Terrain-Bonus F+D.' },
  wellkeeper: { id:'wellkeeper', name:'Brunnenwächter', type:'UNIT', cost:3, req:{},   native:null, atk:1, hp:5, bew:2, rei:1, text:'Adj. Well: +1 Mana.' },

  // --- Instant cards ---
  veil: { id:'veil', name:'Tarnschleier', type:'INSTANT', cost:1, req:{F:1}, text:'-2 Schaden an eigener Einheit (min 0).' },
  gust: { id:'gust', name:'Sandschwall',  type:'INSTANT', cost:2, req:{D:2}, text:'Schiebe Gegner 1 Feld, 1 Schaden.' },
};

// Land fill & stroke colours (used by the SVG renderer)
const LF = { N:'#1e2530', F:'#1a3a18', D:'#3a2810', M:'#22222e', W:'#0d1e3a' };
const LS = { N:'#3a4a60', F:'#2d5a27', D:'#6a4a18', M:'#4a4a60', W:'#1a4a7a' };

// Phase sequence
const PHASES = ['DRAW','LAND_OR_BOOST','MANA','PLAY','MOVE','ATTACK','CLEANUP'];
const PN = {
  DRAW:'Ziehen', LAND_OR_BOOST:'Land/Boost', MANA:'Mana',
  PLAY:'Spielen', MOVE:'Bewegen', ATTACK:'Angriff', CLEANUP:'Aufräumen'
};

// ── Deck Builder ───────────────────────────────────────────
function mkDeck(player) {
  const d = [];
  const add = (id, n) => { for (let i = 0; i < n; i++) d.push(id); };

  if (player === 'A') {
    add('land_F',3); add('land_M',3); add('land_N',1);
    add('scout_F',3); add('guardian_M',2); add('archer_M',2);
    add('brawler_N',3); add('emissary',1); add('wellkeeper',3);
    add('veil',3); add('land_F',1); add('land_M',1);
    add('brawler_N',1); add('scout_F',1);
  } else {
    add('land_D',3); add('land_W',3); add('land_N',1);
    add('rider_D',3); add('sprite_W',3); add('brawler_N',3);
    add('wellkeeper',3); add('gust',3);
    add('land_D',1); add('land_W',1); add('archer_M',2);
    add('scout_F',1); add('brawler_N',1);
  }
  // Fisher-Yates shuffle
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── State Factory ──────────────────────────────────────────
function mkState() {
  const S = {
    turn: 1,
    ap: 'A',           // active player
    phase: 'DRAW',
    phaseStep: 0,
    lobDone: false,    // land-or-boost action taken this turn?
    players: {
      A: { hp: BASE_HP, mana: BASE_MANA, deck: mkDeck('A'), hand: [], grave: [], boostUsed: false },
      B: { hp: BASE_HP, mana: BASE_MANA, deck: mkDeck('B'), hand: [], grave: [], boostUsed: false },
    },
    cells: {},   // cK(q,r) → { type, owner?, landType?, ctrl? }
    units: {},   // uid    → { id, own, cid, q,r,s, hp, maxHp, atk, bew, rei, moved, atked }
    uid: 1,
    log: [],
    winner: null,
  };

  allCells().forEach(([q, r, s]) => {
    const k = cK(q, r);
    if      (isBaseA(q,r,s)) S.cells[k] = { type:'BASE', owner:'A' };
    else if (isBaseB(q,r,s)) S.cells[k] = { type:'BASE', owner:'B' };
    else if (isWell(q,r,s))  S.cells[k] = { type:'WELL', ctrl: null };
    else                     S.cells[k] = { type:'EMPTY' };
  });

  deal(S, 'A', 5);
  deal(S, 'B', 5);
  return S;
}

// ── State Helpers ──────────────────────────────────────────
function deal(S, p, n) {
  const pl = S.players[p];
  for (let i = 0; i < n; i++) {
    if (!pl.deck.length || pl.hand.length >= HAND_MAX) break;
    pl.hand.push(pl.deck.shift());
  }
}

function landCnt(S, p, lt) {
  return Object.values(S.cells).filter(c => c.owner===p && c.type==='LAND' && c.landType===lt).length;
}

function ctrlWells(S, p) {
  return WELLS.filter(([q,r,s]) => {
    const c = S.cells[cK(q,r)];
    return c && c.ctrl === p;
  }).length;
}

function canPlay(S, p, id) {
  const cd = DB[id];
  if (!cd) return false;
  if (S.players[p].mana < cd.cost) return false;
  for (const [lt, n] of Object.entries(cd.req || {}))
    if (landCnt(S, p, lt) < n) return false;
  return true;
}

function unitAt(S, q, r, s) {
  return Object.values(S.units).find(u => u.q===q && u.r===r && u.s===s) || null;
}

function lg(S, p, m) {
  S.log.unshift({ p, m, t: S.turn });
  if (S.log.length > 60) S.log.pop();
}

// ── Well Control (called after any unit movement) ──────────
function updWells(S) {
  WELLS.forEach(([wq, wr, ws]) => {
    const k = cK(wq, wr);
    let a = 0, b = 0;
    cNbr(wq, wr, ws).forEach(([q,r,s]) => {
      const u = unitAt(S, q, r, s);
      if (u) { if (u.own === 'A') a++; else b++; }
    });
    S.cells[k].ctrl = (a > 0 && b === 0) ? 'A'
                    : (b > 0 && a === 0) ? 'B'
                    : null;
  });
}

// ── Mana Income Calculation ────────────────────────────────
function manaInc(S, p) {
  updWells(S);
  const w = ctrlWells(S, p);
  let bonus = 0;
  Object.values(S.units).forEach(u => {
    if (u.own === p && u.cid === 'wellkeeper') {
      const adjCtrl = WELLS.some(([wq,wr,ws]) => {
        const c = S.cells[cK(wq,wr)];
        return cDist([u.q,u.r,u.s], [wq,wr,ws]) === 1 && c && c.ctrl === p;
      });
      if (adjCtrl) bonus++;
    }
  });
  return BASE_MANA + w * WELL_MANA + bonus;
}

// ── Valid Placement Targets ────────────────────────────────
function adjPlace(S, p) {
  const v = new Set();
  for (const [k, c] of Object.entries(S.cells)) {
    if (c.owner === p && (c.type === 'LAND' || c.type === 'BASE')) {
      const [q,r,s] = pK(k);
      cNbr(q, r, s).forEach(([nq,nr,ns]) => {
        if (!inB(nq,nr,ns)) return;
        const nk = cK(nq, nr);
        const nc = S.cells[nk];
        if (nc && nc.type === 'EMPTY') v.add(nk);
      });
    }
  }
  return [...v].map(pK);
}

// ── Movement BFS ───────────────────────────────────────────
function validMoves(S, uid) {
  const u = S.units[uid];
  if (!u || u.moved || u.atked) return [];
  const visited = new Set([cK(u.q, u.r)]);
  const frontier = [[u.q, u.r, u.s, 0]];
  const result = [];
  while (frontier.length) {
    const [q, r, s, d] = frontier.shift();
    if (d >= u.bew) continue;
    cNbr(q, r, s).forEach(([nq,nr,ns]) => {
      if (!inB(nq,nr,ns)) return;
      const k = cK(nq, nr);
      if (visited.has(k)) return;
      visited.add(k);
      const c = S.cells[k];
      if (!c || c.type === 'EMPTY' || c.type === 'WELL') return;
      if (c.type === 'BASE' && c.owner !== u.own) return;
      if (unitAt(S, nq, nr, ns)) return;
      result.push([nq, nr, ns]);
      frontier.push([nq, nr, ns, d + 1]);
    });
  }
  return result;
}

// ── Attack Target Resolution ───────────────────────────────
function validAtks(S, uid) {
  const u = S.units[uid];
  if (!u || u.atked) return [];
  const result = [];
  // Enemy units within reach
  Object.values(S.units).forEach(t => {
    if (t.own === u.own) return;
    if (cDist([u.q,u.r,u.s], [t.q,t.r,t.s]) <= u.rei)
      result.push({ type:'unit', id:t.id, q:t.q, r:t.r, s:t.s });
  });
  // Enemy base
  const [bq,br,bs] = u.own === 'A' ? BASE_B : BASE_A;
  if (cDist([u.q,u.r,u.s], [bq,br,bs]) <= u.rei)
    result.push({ type:'base', own: u.own === 'A' ? 'B' : 'A', q:bq, r:br, s:bs });
  return result;
}

// ── Combat Resolution ──────────────────────────────────────
function doAtk(S, attackerId, targetType, targetId) {
  const a = S.units[attackerId];
  if (!a || a.atked) return;
  lg(S, a.own, `${DB[a.cid].name} greift an`);

  if (targetType === 'unit') {
    const d = S.units[targetId];
    if (!d) return;
    d.hp -= a.atk;
    lg(S, a.own, `→${DB[d.cid].name}: -${a.atk}HP`);
    // Melee counter-attack (rei===1 means melee)
    if (a.rei === 1) {
      a.hp -= d.atk;
      lg(S, d.own, `↩Gegenschlag -${d.atk}HP`);
    }
    if (d.hp <= 0) { lg(S,'sys',`${DB[d.cid].name} stirbt`); S.players[d.own].grave.push(d.cid); delete S.units[targetId]; }
    if (a.hp <= 0) { lg(S,'sys',`${DB[a.cid].name} stirbt`); S.players[a.own].grave.push(a.cid); delete S.units[attackerId]; return; }
  } else {
    // Attack enemy base
    S.players[targetId].hp -= a.atk;
    lg(S, a.own, `⚔ Basis ${targetId}: -${a.atk}HP (${S.players[targetId].hp} verbleibend)`);
    if (S.players[targetId].hp <= 0) S.winner = a.own;
  }
  if (S.units[attackerId]) S.units[attackerId].atked = true;
}

// ── Card Play Execution ────────────────────────────────────
function doPlay(S, p, id, q, r, s) {
  const cd = DB[id];
  const pl = S.players[p];
  if (!canPlay(S, p, id)) return false;

  pl.mana -= cd.cost;
  pl.hand.splice(pl.hand.indexOf(id), 1);

  if (cd.type === 'LAND') {
    if (id === 'land_N') {
      // Double neutral: auto-place 2 adjacent tiles
      const spots = adjPlace(S, p);
      const first = spots.find(([qq,rr,ss]) => !unitAt(S,qq,rr,ss));
      if (first) {
        const [fq,fr] = first;
        S.cells[cK(fq,fr)] = { type:'LAND', owner:p, landType:'N' };
      }
      const spots2 = adjPlace(S, p);
      const second = spots2.find(([qq,rr]) => cK(qq,rr) !== cK(first[0],first[1]));
      if (second) {
        const [sq,sr] = second;
        S.cells[cK(sq,sr)] = { type:'LAND', owner:p, landType:'N' };
      }
    } else {
      S.cells[cK(q,r)] = { type:'LAND', owner:p, landType:cd.landType };
    }
    lg(S, p, `Platziert ${cd.name}`);
    S.lobDone = true;
    return true;
  }

  if (cd.type === 'UNIT') {
    const uid = `u${S.uid++}`;
    S.units[uid] = { id:uid, own:p, cid:id, q, r, s,
      hp:cd.hp, maxHp:cd.hp, atk:cd.atk, bew:cd.bew, rei:cd.rei,
      moved:false, atked:false };
    lg(S, p, `Beschwört ${cd.name}`);
    return true;
  }

  if (cd.type === 'INSTANT') {
    if (id === 'veil') {
      const u = unitAt(S, q, r, s);
      if (u && u.own === p) u._sh = (u._sh || 0) + 2;
      lg(S, p, 'Tarnschleier!');
    }
    if (id === 'gust') {
      const u = unitAt(S, q, r, s);
      if (u && u.own !== p) {
        const nb = cNbr(q,r,s).filter(([nq,nr,ns]) => inB(nq,nr,ns) && !unitAt(S,nq,nr,ns));
        if (nb.length) {
          const [nq,nr,ns] = nb[0];
          u.q = nq; u.r = nr; u.s = ns;
          const c = S.cells[cK(nq,nr)];
          if (!c || c.landType !== 'D') u.hp--;
        }
        lg(S, p, 'Sandschwall!');
      }
    }
    pl.grave.push(id);
    return true;
  }

  return false;
}
