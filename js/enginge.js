/* ------------------------------------------------------------------
   HexForge Engine – komplett aus dem originalen <script>-Block
   (nur leicht umstrukturiert, um Import‑Statements und Kommentare
   zu unterstützen)
   ------------------------------------------------------------------ */

/* ---------- Imports (falls du ES‑Modules nutzt) ----------
   Falls du das Projekt ohne `<script type="module">` laufen lässt,
   kannst du die Zeile unten auskommentieren und die DB‑Daten aus
   data.js einfach vorher in das globale Fenster legen (z.B. über
   ein weiteres <script>-Tag). */
import { DB, LF, LS, PHASES, PN } from './data.js';

/* ---------- Konstanten & Hilfsfunktionen ---------- */
const BOARD_R = 3;                     // radius‑3‑Board
const HS = 34;                         // Hex‑Größe (Pixel‑Halb‑Durchmesser)
const BASE_HP = 20, BASE_MANA = 3, WELL_MANA = 2, HAND_MAX = 7;
const CDIRS = [[1,-1,0],[-1,1,0],[1,0,-1],[-1,0,1],[0,1,-1],[0,-1,1]];

/* Cube‑Koordinaten‑Hilfs */
function cK(q,r){return `${q},${r},${-q-r}`;}
function pK(k){return k.split(',').map(Number);}
function cDist(a,b){return Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2]));}
function cNbr(q,r,s){return CDIRS.map(([a,b,c])=>[q+a,r+b,s+c]);}
function inB(q,r,s){return Math.abs(q)<=BOARD_R && Math.abs(r)<=BOARD_R && Math.abs(s)<=BOARD_R;}
function c2p(q,r){return [HS*(1.5*q), HS*(Math.sqrt(3)/2*q+Math.sqrt(3)*r)];}

/* Board‑Layout */
const BASE_A = [0,-BOARD_R, BOARD_R];
const BASE_B = [0, BOARD_R,-BOARD_R];
const WELLS  = [[-1,-1,2],[1,-1,2],[-1,1,-2],[1,1,-2]];
function isWell(q,r,s){return WELLS.some(([a,b,c])=>a===q&&b===r&&c===s);}
function isBaseA(q,r,s){return q===BASE_A[0]&&r===BASE_A[1]&&s===BASE_A[2];}
function isBaseB(q,r,s){return q===BASE_B[0]&&r===BASE_B[1]&&s===BASE_B[2];}

/* Alle Zellen (einmalig erzeugen) */
function allCells(){
  const out=[];
  for(let q=-BOARD_R;q<=BOARD_R;q++)
    for(let r=-BOARD_R;r<=BOARD_R;r++){
      const s=-q-r;
      if(Math.abs(s)<=BOARD_R) out.push([q,r,s]);
    }
  return out;
}

/* ---------- Deck & Anfangszustand ---------- */
function mkDeck(p){
  const d=[]; const add=(id,n)=>{for(let i=0;i<n;i++) d.push(id);};
  if(p==='A'){
    add('land_F',3); add('land_M',3); add('land_N',1);
    add('scout_F',3); add('guardian_M',2); add('archer_M',2);
    add('brawler_N',3); add('emissary',1); add('wellkeeper',3);
    add('veil',3); add('land_F',1); add('land_M',1);
    add('brawler_N',1); add('scout_F',1);
  }else{
    add('land_D',3); add('land_W',3); add('land_N',1);
    add('rider_D',3); add('sprite_W',3); add('brawler_N',3);
    add('wellkeeper',3); add('gust',3);
    add('land_D',1); add('land_W',1); add('archer_M',2);
    add('scout_F',1); add('brawler_N',1);
  }
  /* Shuffle */
  for(let i=d.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [d[i],d[j]]=[d[j],d[i]];
  }
  return d;
}

/* Neuen Spielzustand erzeugen */
function mkState(){
  const S={turn:1,ap:'A',phase:'DRAW',phaseStep:0,lobDone:false,
    players:{
      A:{hp:BASE_HP,mana:BASE_MANA,deck:mkDeck('A'),hand:[],grave:[],boostUsed:false},
      B:{hp:BASE_HP,mana:BASE_MANA,deck:mkDeck('B'),hand:[],grave:[],boostUsed:false},
    },
    cells:{},units:{},uid:1,log:[],winner:null};

  allCells().forEach(([q,r,s])=>{
    const k=cK(q,r);
    if(isBaseA(q,r,s))       S.cells[k]={type:'BASE',owner:'A'};
    else if(isBaseB(q,r,s))  S.cells[k]={type:'BASE',owner:'B'};
    else if(isWell(q,r,s))   S.cells[k]={type:'WELL',ctrl:null};
    else                     S.cells[k]={type:'EMPTY'};
  });

  deal(S,'A',5); deal(S,'B',5);
  return S;
}

/* Hand‑Ziehen */
function deal(S,p,n){
  const pl=S.players[p];
  for(let i=0;i<n;i++){
    if(!pl.deck.length||pl.hand.length>=HAND_MAX) break;
    pl.hand.push(pl.deck.shift());
  }
}

/* Noch ein paar Hilfs‑/Utility‑Funktionen – unverändert */
function landCnt(S,p,lt){return Object.values(S.cells).filter(c=>c.owner===p&&c.type==='LAND'&&c.landType===lt).length;}
function ctrlWells(S,p){return WELLS.filter(([q,r,s])=>{const c=S.cells[cK(q,r)];return c&&c.ctrl===p;}).length;}
function canPlay(S,p,id){
  const cd=DB[id];
  if(!cd) return false;
  if(S.players[p].mana<cd.cost) return false;
  for(const [lt,n] of Object.entries(cd.req||{}))
    if(landCnt(S,p,lt)<n) return false;
  return true;
}
function unitAt(S,q,r,s){return Object.values(S.units).find(u=>u.q===q&&u.r===r&&u.s===s)||null;}
function lg(S,p,m){S.log.unshift({p,m,t:S.turn}); if(S.log.length>60) S.log.pop();}
function updWells(S){
  WELLS.forEach(([wq,wr,ws])=>{
    const k=cK(wq,wr); let a=0,b=0;
    cNbr(wq,wr,ws).forEach(([q,r,s])=>{
      const u=unitAt(S,q,r,s);
      if(u){ if(u.own==='A') a++; else b++; }
    });
    S.cells[k].ctrl = a>0 && b===0 ? 'A' : b>0 && a===0 ? 'B' : null;
  });
}
function manaInc(S,p){
  updWells(S);
  const w = ctrlWells(S,p);
  let bonus = 0;
  Object.values(S.units).forEach(u=>{
    if(u.own===p && u.cid==='wellkeeper'){
      const adj = WELLS.some(([wq,wr,ws])=>{
        const c=S.cells[cK(wq,wr)];
        return cDist([u.q,u.r,u.s],[wq,wr,ws])===1 && c && c.ctrl===p;
      });
      if(adj) bonus++;
    }
  });
  return BASE_MANA + w*WELL_MANA + bonus;
}

/* Adjacent‑Placement (Land‑Platzierung) */
function adjPlace(S,p){
  const ps = new Set();
  for(const [k,c] of Object.entries(S.cells)){
    if(c.owner===p && (c.type==='LAND' || c.type==='BASE')){
      const [q,r,s]=pK(k);
      cNbr(q,r,s).forEach(([nq,nr,ns])=>{
        if(!inB(nq,nr,ns)) return;
        const nk=cK(nq,nr);
        const nc=S.cells[nk];
        if(nc && nc.type==='EMPTY') ps.add(nk);
      });
    }
  }
  return [...ps].map(pK);
}

/* Valid Moves & Attacks – unverändert */
function validMoves(S,uid){
  const u=S.units[uid];
  if(!u||u.moved||u.atked) return [];
  const visited = new Set([cK(u.q,u.r)]), queue=[[u.q,u.r,u.s,0]], res=[];
  while(queue.length){
    const [q,r,s,d]=queue.shift();
    if(d>=u.bew) continue;
    cNbr(q,r,s).forEach(([nq,nr,ns])=>{
      if(!inB(nq,nr,ns)) return;
      const k=cK(nq,nr);
      if(visited.has(k)) return;
      visited.add(k);
      const cell=S.cells[k];
      if(!cell || cell.type==='EMPTY' || cell.type==='WELL'){
        if(cell.type==='BASE' && cell.owner!==u.own) return;
        if(unitAt(S,nq,nr,ns)) return;
        res.push([nq,nr,ns]);
        queue.push([nq,nr,ns,d+1]);
      }
    });
  }
  return res;
}
function validAtks(S,uid){
  const u=S.units[uid];
  if(!u||u.atked) return [];
  const out=[];
  // Units
  Object.values(S.units).forEach(t=>{
    if(t.own===u.own) return;
    if(cDist([u.q,u.r,u.s],[t.q,t.r,t.s])<=u.rei)
      out.push({type:'unit',id:t.id,q:t.q,r:t.r,s:t.s});
  });
  // Base
  const [bq,br,bs]= u.own==='A' ? BASE_B : BASE_A;
  if(cDist([u.q,u.r,u.s],[bq,br,bs])<=u.rei)
    out.push({type:'base',own:u.own==='A'?'B':'A',q:bq,r:br,s:bs});
  return out;
}

/* Attack‑Logik – unverändert */
function doAtk(S,aid,tt,tid){
  const a=S.units[aid];
  if(!a||a.atked) return;
  lg(S,a.own,`${DB[a.cid].name} greift an`);

  if(tt==='unit'){
    const d=S.units[tid];
    if(!d) return;
    d.hp-=a.atk;
    lg(S,a.own,`→${DB[d.cid].name}:-${a.atk}HP`);
    if(a.rei===1){
      a.hp-=d.atk;
      lg(S,d.own,`↩Gegenschlag-${d.atk}HP`);
    }
    if(d.hp<=0){
      lg(S,'sys',`${DB[d.cid].name} stirbt`);
      S.players[d.own].grave.push(d.cid);
      delete S.units[tid];
    }
    if(a.hp<=0){
      lg(S,'sys',`${DB[a.cid].name} stirbt`);
      S.players[a.own].grave.push(a.cid);
      delete S.units[aid];
      return;
    }
  }else{
    // Base‑Attack
    S.players[tid].hp -= a.atk;
    lg(S,a.own,`⚔Basis ${tid}:-${a.atk}HP(${S.players[tid].hp})`);
    if(S.players[tid].hp<=0) S.winner = a.own;
  }
  if(S.units[aid]) S.units[aid].atked = true;
}

/* Play‑Funktion – unverändert (einzige Stelle, wo wir
   zwischen Land‑Karten und anderen unterscheiden) */
function doPlay(S,p,id,q,r,s){
  const cd=DB[id];
  const pl=S.players[p];
  if(!canPlay(S,p,id)) return false;

  pl.mana -= cd.cost;
  pl.hand.splice(pl.hand.indexOf(id),1);

  if(cd.type==='LAND'){
    // Doppelte Neutral‑Land‑Karte (2×)
    if(id==='land_N'){
      const spots=adjPlace(S,p);
      let placed=0;
      for(const [qq,rr,ss] of spots){
        if(placed>=2) break;
        if(!unitAt(S,qq,rr,ss)){
          S.cells[cK(qq,rr)]={type:'LAND',owner:p,landType:'N'};
          placed++;
        }
      }
      lg(S,p,'2× Grasland platziert');
      S.lobDone=true;
      return true;
    }
    // normales Land
    S.cells[cK(q,r)]={type:'LAND',owner:p,landType:cd.landType};
    lg(S,p,`Platziert ${cd.name}`);
    S.lobDone=true;
    return true;
  }

  if(cd.type==='UNIT'){
    const uid=`u${S.uid++}`;
    S.units[uid]={
      id:uid,own:p,cid:id,q,r,s,
      hp:cd.hp,maxHp:cd.hp,atk:cd.atk,bew:cd.bew,rei:cd.rei,
      moved:false,atked:false
    };
    lg(S,p,`Beschwört ${cd.name}`);
    return true;
  }

  if(cd.type==='INSTANT'){
    // Veil
    if(id==='veil'){
      const u=unitAt(S,q,r,s);
      if(u && u.own===p) u._sh = (u._sh||0)+2;
      lg(S,p,'Tarnschleier!');
    }
    // Gust
    if(id==='gust'){
      const u=unitAt(S,q,r,s);
      if(u && u.own!==p){
        const nb=cNbr(q,r,s).filter(([nq,nr,ns])=>inB(nq,nr,ns) && !unitAt(S,nq,nr,ns));
        if(nb.length){
          const [nq,nr,ns]=nb[0];
          u.q=nq; u.r=nr; u.s=ns;
          const c=S.cells[cK(nq,nr)];
          if(!c || c.landType!=='D') u.hp--;
        }
        lg(S,p,'Sandschwall!');
      }
    }
    pl.grave.push(id);
    return true;
  }

  return false;
}

/* --------- Radial‑Menu‑Optionen (Konstanten) ---------- */
const MENU_OPTS=[
  {id:'land_F', label:'Wald',      sub:'🌲', fill:'#1c4a14',stroke:'#4a9e40', textCol:'#7dd870'},
  {id:'land_D', label:'Wüste',     sub:'🏜', fill:'#5a2e08',stroke:'#d4982a', textCol:'#f0b84a'},
  {id:'land_M', label:'Berg',      sub:'⛰',  fill:'#282838',stroke:'#8a8aaa', textCol:'#aaaacc'},
  {id:'land_W', label:'Wasser',    sub:'🌊', fill:'#083050',stroke:'#3a8acc', textCol:'#60aaee'},
  {id:'land_N', label:'2×Neutral', sub:'··', fill:'#1a2236',stroke:'#4a5a70', textCol:'#7a9ab0'},
  {id:'_draw',  label:'Karte+1',   sub:'🃏', fill:'#2a1c08',stroke:'#c8a84b', textCol:'#e8c870'},
  {id:'_boost', label:'+1 Mana',   sub:'◆',  fill:'#081828',stroke:'#4488cc', textCol:'#68aaee'},
];

/* ------------------------------------------------------------------
   Engine‑Klasse – exakt wie im Original‑Script, nur mit
   kleineren Aufräum‑ und Kommentierungs‑Verbesserungen.
   ------------------------------------------------------------------ */
class Engine{
  constructor(){
    this.S = mkState();
    this.selCard = null; this.selUnit = null; this.pact = null; this.vt = [];
    this._render();
    this._showSwitch(this.S.ap);
  }
  get ap(){return this.S.ap;}

  /* ---------- UI‑Overlays ---------- */
  dismissSwitch(){ document.getElementById('sw-ov').classList.remove('on'); this._runPhase(); }
  _showSwitch(p){
    const el = document.getElementById('sc-nm');
    el.textContent = `SPIELER ${p}`;
    el.className = `sc-nm ${p}`;
    document.getElementById('sw-ov').classList.add('on');
  }

  /* ---------- Phasen‑Manager ---------- */
  _runPhase(){
    const S=this.S;
    if(S.winner){ this._win(); return; }

    this.selCard=null; this.selUnit=null; this.pact=null; this.vt=[];
    switch(S.phase){
      case 'DRAW':
        deal(S,this.ap,1);
        lg(S,this.ap,'Karte gezogen');
        this._auto(350); break;
      case 'MANA':
        const inc = manaInc(S,this.ap);
        S.players[this.ap].mana += inc;
        if(S.players[this.ap].boostUsed) S.players[this.ap].mana += 1;
        lg(S,this.ap,`+${inc}Mana→${S.players[this.ap].mana}`);
        this._auto(350); break;
      case 'CLEANUP':
        Object.values(S.units).filter(u=>u.own===this.ap).forEach(u=>{u.moved=false; u.atked=false;});
        S.players[this.ap].boostUsed = false;
        S.lobDone = false;
        lg(S,this.ap,'— Runde Ende —');
        if(this.ap==='B') S.turn++;
        S.ap = this.ap==='A' ? 'B' : 'A';
        S.phase='DRAW'; S.phaseStep=0;
        this._render();
        setTimeout(()=>this._showSwitch(S.ap),200);
        return;
      default: break;
    }
    this._render();
  }
  _auto(ms){ setTimeout(()=>this._adv(),ms); }
  _adv(){
    const i = PHASES.indexOf(this.S.phase);
    this.S.phase = PHASES[i+1] || 'CLEANUP';
    this.S.phaseStep = i+1;
    this._runPhase();
  }
  nextPhase(){ this._adv(); }

  /* ---------- Radial‑Menu ---------- */
  openLandMenu(){
    if(this.S.phase!=='LAND_OR_BOOST' || this.S.lobDone) return;
    this._buildSVGMenu();
    document.getElementById('rmenu').classList.add('on');
  }
  closeLandMenu(){ document.getElementById('rmenu').classList.remove('on'); }

  _buildSVGMenu(){
    const svg = document.getElementById('rmenu-svg');
    svg.innerHTML = '';
    const W=340, H=340, cx=W/2, cy=H/2;
    const R=38, RR=88;                 // Hex‑Radius & Ring‑Abstand

    /* Defs – Filter & Gradient */
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = `
      <filter id="mhover"><feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
        <stop offset="60%" stop-color="rgba(160,30,30,0)"/>
        <stop offset="100%" stop-color="rgba(200,50,50,0.45)"/>
      </radialGradient>`;
    svg.appendChild(defs);

    /* Decorative Ring */
    const ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
    ring.setAttribute('cx',cx); ring.setAttribute('cy',cy);
    ring.setAttribute('r',H/2-8);
    ring.setAttribute('fill','url(#ringGrad)');
    ring.setAttribute('stroke','#aa2525'); ring.setAttribute('stroke-width','4');
    svg.appendChild(ring);
    const ring2 = document.createElementNS('http://www.w3.org/2000/svg','circle');
    ring2.setAttribute('cx',cx); ring2.setAttribute('cy',cy);
    ring2.setAttribute('r',H/2-20);
    ring2.setAttribute('fill','none');
    ring2.setAttribute('stroke','rgba(180,50,50,0.3)'); ring2.setAttribute('stroke-width','1.5');
    svg.appendChild(ring2);

    /* Positionen: Zentrum + 6 umliegende Felder (flat‑top) */
    const positions = [
      [cx, cy],                                   // 0 = Mitte (2×Neutral)
      [cx, cy-RR],                                 // 1 = oben
      [cx+RR*Math.sin(Math.PI/3), cy-RR*Math.cos(Math.PI/3)], // 2 rechts‑oben
      [cx+RR*Math.sin(Math.PI/3), cy+RR*Math.cos(Math.PI/3)], // 3 rechts‑unten
      [cx, cy+RR],                                 // 4 = unten
      [cx-RR*Math.sin(Math.PI/3), cy+RR*Math.cos(Math.PI/3)], // 5 links‑unten
      [cx-RR*Math.sin(Math.PI/3), cy-RR*Math.cos(Math.PI/3)]  // 6 links‑oben
    ];

    /* Reihenfolge: Mitte (2×Neutral) + Ring im Uhrzeigersinn */
    const assign = [4,0,1,2,3,5,6];   // Index in MENU_OPTS → Position

    assign.forEach((optIdx,posIdx)=>{
      const [px,py] = positions[posIdx];
      const opt    = MENU_OPTS[optIdx];

      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      g.setAttribute('class','mhex');
      g.style.cursor='pointer';
      g.onmouseenter = ()=>{ glowPoly.setAttribute('opacity','0.7'); poly.setAttribute('filter','url(#mhover)'); };
      g.onmouseleave = ()=>{ glowPoly.setAttribute('opacity','0'); poly.removeAttribute('filter'); };
      g.onclick = ()=>this._selectMenuOpt(opt.id);

      /* Hex‑Polygon (flat‑top) */
      const hexPts = Array.from({length:6},(_,i)=>{
        const a = Math.PI/180 * (60*i);
        return `${(px+R*Math.cos(a)).toFixed(1)},${(py+R*Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
      poly.setAttribute('points',hexPts);
      poly.setAttribute('fill',opt.fill);
      poly.setAttribute('stroke',opt.stroke);
      poly.setAttribute('stroke-width','2.5');
      g.appendChild(poly);

      /* Hover‑Glow (unsichtbar, wird per JS eingeblendet) */
      const glowPoly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
      glowPoly.setAttribute('class','mhex-ring');
      glowPoly.setAttribute('points',hexPts);
      glowPoly.setAttribute('fill','none');
      glowPoly.setAttribute('stroke',opt.stroke);
      glowPoly.setAttribute('stroke-width','4');
      glowPoly.setAttribute('opacity','0');
      glowPoly.setAttribute('filter','url(#mhover)');
      glowPoly.setAttribute('pointer-events','none');
      g.appendChild(glowPoly);

      /* Symbol (Emoji) */
      const sym = document.createElementNS('http://www.w3.org/2000/svg','text');
      sym.setAttribute('x',px); sym.setAttribute('y',py-2);
      sym.setAttribute('text-anchor','middle');
      sym.setAttribute('dominant-baseline','middle');
      sym.setAttribute('font-size',R*0.75);
      sym.setAttribute('pointer-events','none');
      sym.textContent = opt.sub;
      g.appendChild(sym);

      /* Beschriftung */
      const lbl = document.createElementNS('http://www.w3.org/2000/svg','text');
      lbl.setAttribute('x',px); lbl.setAttribute('y',py+R*0.58);
      lbl.setAttribute('text-anchor','middle');
      lbl.setAttribute('dominant-baseline','middle');
      lbl.setAttribute('font-family','Cinzel,serif');
      lbl.setAttribute('font-size',R*0.25);
      lbl.setAttribute('fill',opt.textCol);
      lbl.setAttribute('font-weight','bold');
      lbl.setAttribute('pointer-events','none');
      lbl.textContent = opt.label;
      g.appendChild(lbl);

      /* Spezial‑Badges (×2 für Neutral, +1 für Draw/Boost) */
      if(opt.id==='land_N'){
        const badge = this._makeBadge(px+R*0.65, py-R*0.55, '×2', '#4a5a70', '#c8d4e0');
        g.appendChild(badge);
      }
      if(opt.id==='_draw' || opt.id==='_boost'){
        const badge = this._makeBadge(px+R*0.65, py-R*0.55, '+1', opt.stroke, '#fff');
        g.appendChild(badge);
      }

      svg.appendChild(g);
    });
  }

  _makeBadge(x,y,text,bg,fg){
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('pointer-events','none');

    const circ = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circ.setAttribute('cx',x); circ.setAttribute('cy',y); circ.setAttribute('r','11');
    circ.setAttribute('fill',bg); circ.setAttribute('stroke',fg); circ.setAttribute('stroke-width','1.5');
    g.appendChild(circ);

    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',x); t.setAttribute('y',y);
    t.setAttribute('text-anchor','middle');
    t.setAttribute('dominant-baseline','middle');
    t.setAttribute('font-family','Cinzel,serif');
    t.setAttribute('font-size','9');
    t.setAttribute('fill',fg);
    t.setAttribute('font-weight','bold');
    t.textContent = text;
    g.appendChild(t);
    return g;
  }

  _selectMenuOpt(id){
    const S=this.S;
    this.closeLandMenu();

    if(id==='_draw'){
      deal(S,this.ap,1);
      S.lobDone=true;
      lg(S,this.ap,'Karte gezogen (Aktion)');
      this._render(); this._auto(300);
      return;
    }
    if(id==='_boost'){
      S.players[this.ap].boostUsed=true;
      S.lobDone=true;
      lg(S,this.ap,'+1 Mana Boost');
      this._render(); this._auto(300);
      return;
    }
    if(id==='land_N'){
      /*** Doppelte Neutral‑Land‑Platzierung ***/
      const spots = adjPlace(S,this.ap);
      let placed=0;
      for(const [qq,rr,ss] of spots){
        if(placed>=2) break;
        if(!unitAt(S,qq,rr,ss)){
          S.cells[cK(qq,rr)]={type:'LAND',owner:this.ap,landType:'N'};
          placed++;
        }
      }
      S.lobDone=true;
      lg(S,this.ap,'2× Grasland platziert');
      this._render(); this._auto(300);
      return;
    }

    /* alle anderen Land‑Typen → Zielzelle wählen */
    this.selCard = id;
    this.pact = 'land';
    this.vt = adjPlace(S,this.ap);
    this._render();
  }

  /* ---------- Card‑Auswahl (Hand) ---------- */
  selCardFn(id){
    const S=this.S;
    const cd = DB[id];
    if(!cd) return;
    if(cd.type==='LAND'){ this.openLandMenu(); return; }
    if(S.phase!=='PLAY') return;
    if(!canPlay(S,this.ap,id)) return;

    this.selCard = id;
    if(cd.type==='UNIT'){
      this.pact='unit';
      this.vt = Object.entries(S.cells)
                 .filter(([k,c])=>c.owner===this.ap && c.type==='LAND')
                 .map(([k])=>pK(k))
                 .filter(([q,r,s])=>!unitAt(S,q,r,s));
    }else if(cd.type==='INSTANT'){
      this.pact='inst';
      if(id==='veil'){
        this.vt = Object.values(S.units).filter(u=>u.own===this.ap).map(u=>[u.q,u.r,u.s]);
      }else if(id==='gust'){
        this.vt = Object.values(S.units).filter(u=>u.own!==this.ap).map(u=>[u.q,u.r,u.s]);
      }
    }
    this._render();
  }

  /* ---------- Unit‑Auswahl (Board) ---------- */
  selUnitFn(uid){
    const S=this.S;
    const u=S.units[uid];
    if(!u||u.own!==this.ap) return;
    this.selCard=null; this.selUnit=uid;
    if(S.phase==='MOVE'){ this.pact='move'; this.vt = validMoves(S,uid); }
    else if(S.phase==='ATTACK'){ this.pact='atk'; this.vt = validAtks(S,uid).map(t=>[t.q,t.r,t.s]); }
    this._showUD(u);
    this._render();
  }

  /* ---------- Click‑Handler für das Board ---------- */
  clickCell(q,r,s){
    const S=this.S;
    const isV = this.vt.some(([a,b,c])=>a===q && b===r && c===s);

    if(this.pact && isV){
      // → Aktion ausführen
      if(this.pact==='land'){
        const cd = DB[this.selCard];
        const pl = S.players[this.ap];
        pl.hand = pl.hand.filter(x=>x!==this.selCard);   // Land‑Karten kommen nicht aus der Hand
        S.cells[cK(q,r)] = {type:'LAND',owner:this.ap,landType:cd.landType};
        S.lobDone = true;
        lg(S,this.ap,`Platziert ${cd.name}`);
        this._clr(); this._render(); this._auto(300); return;
      }
      if(this.pact==='unit' || this.pact==='inst'){
        doPlay(S,this.ap,this.selCard,q,r,s);
        this._clr();
      }
      if(this.pact==='move' && this.selUnit){
        const u=S.units[this.selUnit];
        if(u){
          u.q=q; u.r=r; u.s=s; u.moved=true;
          updWells(S);
          lg(S,this.ap,`${DB[u.cid].name} bewegt`);
        }
        this._clr();
      }
      if(this.pact==='atk' && this.selUnit){
        const targetUnit = unitAt(S,q,r,s);
        const [bq,br,bs] = this.ap==='A'?BASE_B:BASE_A;
        if(targetUnit && targetUnit.own!==this.ap)
          doAtk(S,this.selUnit,'unit',targetUnit.id);
        else if(q===bq && r===br && s===bs)
          doAtk(S,this.selUnit,'base',this.ap==='A'?'B':'A');
        this._clr();
      }
      this._render();
      if(S.winner) this._win();
      return;
    }

    // → Klick auf eine Einheit ohne zuvor ausgewählte Aktion
    const unit = unitAt(S,q,r,s);
    if(unit) this.selUnitFn(unit.id);
  }

  _clr(){ this.selCard=null; this.selUnit=null; this.pact=null; this.vt=[]; }

  cancelSel(){ this._clr(); this._render(); }

  /* ---------- Unit‑Detail‑Box ---------- */
  _showUD(u){
    const cd=DB[u.cid];
    document.getElementById('ud').innerHTML=
      `<div class="udn">${cd.name}</div>`+
      `<div style="display:flex;gap:8px;font-size:.7rem;margin-bottom:2px">
        <span style="color:var(--atk)">⚔${u.atk}</span>
        <span style="color:var(--hp)">♥${u.hp}/${u.maxHp}</span>
        <span style="color:var(--dim)">➤${u.bew}</span>
        <span style="color:var(--W)">◎${u.rei}</span>
      </div>`+
      `<div style="font-size:.6rem;color:var(--dim);font-style:italic">${cd.text}</div>`+
      `<div style="font-size:.58rem;margin-top:2px">
        ${u.moved?'<span style="color:#883030">✓Bew</span> ':''}
        ${u.atked?'<span style="color:#883030">✓Atk</span>':''}
      </div>`;
  }

  /* ---------- Win‑Overlay ---------- */
  _win(){
    document.getElementById('win-title').textContent = `Spieler ${this.S.winner} gewinnt!`;
    document.getElementById('win-ov').classList.add('on');
  }

  /* --------------------------------------------------------------
     Rendering: 5 Teil‑Routinen → alles wird aus dem Zustand S erzeugt
     -------------------------------------------------------------- */
  _render(){
    this._rStats(); this._rHand(); this._rPhase(); this._rBtns();
    this._rLog(); this._rBoard();
  }

  /* ----- Statistiken (Oben) ----- */
  _rStats(){
    const S=this.S;
    ['A','B'].forEach(p=>{
      document.getElementById(`hp-${p}`).textContent    = S.players[p].hp;
      document.getElementById(`mana-${p}`).textContent  = S.players[p].mana;
      document.getElementById(`cards-${p}`).textContent = `${S.players[p].hand.length}/${S.players[p].deck.length}`;
      document.getElementById(`wells-${p}`).textContent = ctrlWells(S,p);
      document.getElementById(`hpbar-${p}`).style.width = `${S.players[p].hp/BASE_HP*100}%`;
    });
    document.getElementById('rnd').textContent = S.turn;
    const pn = document.getElementById('apn');
    pn.textContent = `SPIELER ${S.ap}`;
    pn.className = `pn ${S.ap}`;
  }

  /* ----- Phase‑Anzeige ----- */
  _rPhase(){
    const S=this.S;
    document.getElementById('ph-name').textContent = PN[S.phase] || S.phase;
    document.getElementById('ph-dots').innerHTML =
      PHASES.map((ph,i)=>`<span class="pdot ${i<S.phaseStep?'done':i===S.phaseStep?'cur':''}" title="${PN[ph]}"></span>`).join('');
  }

  /* ----- Buttons ----- */
  _rBtns(){
    const S=this.S;
    document.getElementById('btn-land').disabled = !(S.phase==='LAND_OR_BOOST' && !S.lobDone);
    document.getElementById('btn-cancel').disabled = !(this.pact || this.selUnit);
    const auto = ['DRAW','MANA','CLEANUP'];
    const nb   = document.getElementById('btn-next');
    nb.disabled = auto.includes(S.phase);
    nb.textContent = auto.includes(S.phase) ? '⟳ Auto' : 'Phase ▶';
  }

  /* ----- Hand ----- */
  _rHand(){
    const S=this.S;
    const el = document.getElementById('hand-area');
    el.innerHTML = '';

    S.players[this.ap].hand.forEach(id=>{
      const cd = DB[id];
      if(!cd) return;
      const ok   = this._canPlay(id);
      const sel  = this.selCard===id;
      const type = cd.type==='LAND' ? `l${cd.landType}` : cd.type==='UNIT' ? 'lU' : 'lI';
      const req  = Object.entries(cd.req||{}).map(([lt,n])=>`${n}${lt}`).join(' ');
      let stats = '';
      if(cd.type==='UNIT'){
        stats = `<div class="cs">
                  <span class="cra">⚔${cd.atk}</span>
                  <span class="crh">♥${cd.hp}</span>
                  <span style="color:var(--dim)">➤${cd.bew}</span>
                  <span style="color:var(--W)">◎${cd.rei}</span>
                </div>`;
      }

      const div = document.createElement('div');
      div.className = `hc ${type} ${ok?'':'np'} ${sel?'sel':''}`;
      div.innerHTML = `
        <div class="ch"><span class="cn">${cd.name}</span><span class="cc">${cd.cost>0?cd.cost+'◆':''}</span></div>
        <div class="cb">${cd.type==='LAND'?cd.landType+' Land':cd.type}</div>
        ${stats}
        ${req?`<div class="creq">Req:${req}</div>`:''}
        <div class="ctx">${cd.text}</div>`;
      if(ok) div.onclick = ()=>this.selCardFn(id);
      el.appendChild(div);
    });
  }

  _canPlay(id){
    const S=this.S, cd=DB[id];
    if(cd.type==='LAND')  return S.phase==='LAND_OR_BOOST' && !S.lobDone;
    if(cd.type==='UNIT')  return S.phase==='PLAY' && canPlay(S,this.ap,id);
    if(cd.type==='INSTANT') return (S.phase==='PLAY' || S.phase==='ATTACK') && canPlay(S,this.ap,id);
    return false;
  }

  /* ----- Log ----- */
  _rLog(){
    document.getElementById('lp').innerHTML =
      this.S.log.slice(0,30).map(e=>
        `<div class="le"><span class="l${e.p==='sys'?'S':e.p}">[${e.p}]</span>${e.m}</div>`
      ).join('');
  }

  /* ----- Board (SVG) ----- */
  _rBoard(){
    const S=this.S;
    const svg=document.getElementById('board');

    /* Hilfs‑Funktionen für ein Hex */
    function corners(cx,cy){
      return Array.from({length:6},(_,i)=>{
        const a = Math.PI/180 * (60*i);
        return [cx+HS*Math.cos(a), cy+HS*Math.sin(a)];
      });
    }
    function pts(cx,cy){
      return corners(cx,cy).map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ');
    }

    /* Berechne Gesamtabmessungen und Offsets */
    const cells = allCells();
    let mnX=1e9,mxX=-1e9,mnY=1e9,mxY=-1e9;
    cells.forEach(([q,r])=>{
      const [px,py]=c2p(q,r);
      mnX=Math.min(mnX,px); mxX=Math.max(mxX,px);
      mnY=Math.min(mnY,py); mxY=Math.max(mxY,py);
    });
    const PAD = HS*1.5;
    const W = mxX-mnX + HS*2 + PAD*2;
    const H = mxY-mnY + HS*2 + PAD*2;
    const ox = -mnX + HS + PAD;
    const oy = -mnY + HS + PAD;

    svg.setAttribute('width',W);
    svg.setAttribute('height',H);
    svg.innerHTML='';

    const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = `
      <filter id="gw"><feGaussianBlur stdDeviation="2.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="wg"><feGaussianBlur stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    svg.appendChild(defs);

    const vtSet = new Set(this.vt.map(v=>cK(v[0],v[1])));   // Felder, die aktuell hervorgehoben sind

    /* ---- Zellen ---- */
    cells.forEach(([q,r,s])=>{
      const k = cK(q,r);
      const cell = S.cells[k];
      const [px,py] = c2p(q,r);
      const cx = px+ox, cy = py+oy;
      const points = pts(cx,cy);
      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      g.style.cursor='pointer';
      g.onclick = ()=>this.clickCell(q,r,s);

      let fill='#0a0d12', stroke='#151c26', sw='1';
      if(cell){
        if(cell.type==='WELL'){
          fill='#100818'; stroke='#4a1a88'; sw='1.5';
        }else if(cell.type==='BASE'){
          fill = cell.owner==='A' ? '#1e0808' : '#08081e';
          stroke = cell.owner==='A' ? '#882222' : '#224488';
          sw='2';
        }else if(cell.type==='LAND'){
          fill = LF[cell.landType]  || '#1e2530';
          stroke = LS[cell.landType]|| '#3a4a60';
        }else{
          fill='#0e1520'; stroke='#1a2535';
        }
      }

      const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
      poly.setAttribute('points',points);
      poly.setAttribute('fill',fill);
      poly.setAttribute('stroke',stroke);
      poly.setAttribute('stroke-width',sw);
      g.appendChild(poly);

      /* Well‑Overlay (Kontrolle) */
      if(cell && cell.type==='WELL'){
        const ctrl = cell.ctrl;
        const wellGlow = document.createElementNS('http://www.w3.org/2000/svg','circle');
        wellGlow.setAttribute('cx',cx); wellGlow.setAttribute('cy',cy);
        wellGlow.setAttribute('r',HS*.78);
        const glowCol = ctrl==='A' ? 'rgba(160,40,255,0.22)' :
                         ctrl==='B' ? 'rgba(40,100,255,0.22)' : 'rgba(80,15,140,0.15)';
        wellGlow.setAttribute('fill',glowCol);
        wellGlow.setAttribute('pointer-events','none');
        g.appendChild(wellGlow);

        const orb = document.createElementNS('http://www.w3.org/2000/svg','circle');
        orb.setAttribute('cx',cx); orb.setAttribute('cy',cy);
        orb.setAttribute('r',HS*.35);
        orb.setAttribute('fill', ctrl==='A' ? '#bb33ee' : ctrl==='B' ? '#3366ee' : '#6611bb');
        orb.setAttribute('filter','url(#wg)');
        orb.setAttribute('pointer-events','none');
        g.appendChild(orb);

        const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
        txt.setAttribute('x',cx); txt.setAttribute('y',cy+5);
        txt.setAttribute('text-anchor','middle');
        txt.setAttribute('fill','#fff'); txt.setAttribute('font-size','14');
        txt.setAttribute('pointer-events','none');
        txt.textContent='◎';
        g.appendChild(txt);

        if(ctrl){
          const lbl = document.createElementNS('http://www.w3.org/2000/svg','text');
          lbl.setAttribute('x',cx); lbl.setAttribute('y',cy+HS*.85);
          lbl.setAttribute('text-anchor','middle');
          lbl.setAttribute('fill', ctrl==='A' ? '#cc44ff' : '#4488ff');
          lbl.setAttribute('font-size','8'); lbl.setAttribute('font-weight','bold');
          lbl.setAttribute('pointer-events','none');
          lbl.textContent=ctrl;
          g.appendChild(lbl);
        }
      }

      /* Base‑Overlay */
      if(cell && cell.type==='BASE'){
        const col = cell.owner==='A' ? '#ff6060' : '#6090ff';
        const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
        txt.setAttribute('x',cx); txt.setAttribute('y',cy+5);
        txt.setAttribute('text-anchor','middle');
        txt.setAttribute('fill',col);
        txt.setAttribute('font-size','15');
        txt.setAttribute('font-family','Cinzel,serif');
        txt.setAttribute('font-weight','bold');
        txt.setAttribute('pointer-events','none');
        txt.textContent=cell.owner;
        g.appendChild(txt);

        const hp = document.createElementNS('http://www.w3.org/2000/svg','text');
        hp.setAttribute('x',cx); hp.setAttribute('y',cy+HS*.82);
        hp.setAttribute('text-anchor','middle');
        hp.setAttribute('fill',cell.owner==='A'?'#cc5050':'#5070cc');
        hp.setAttribute('font-size','8');
        hp.setAttribute('pointer-events','none');
        hp.textContent=`${S.players[cell.owner].hp}HP`;
        g.appendChild(hp);
      }

      /* Land‑Typ‑Emoji + Owner‑Markierung */
      if(cell && cell.type==='LAND'){
        const em = {'F':'🌲','D':'🏜','M':'⛰','W':'🌊','N':'·'}[cell.landType]||'';
        const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
        txt.setAttribute('x',cx); txt.setAttribute('y',cy+6);
        txt.setAttribute('text-anchor','middle');
        txt.setAttribute('font-size','14');
        txt.setAttribute('pointer-events','none');
        txt.textContent = em;
        g.appendChild(txt);

        const ownerDot = document.createElementNS('http://www.w3.org/2000/svg','circle');
        ownerDot.setAttribute('cx',cx+HS*.56);
        ownerDot.setAttribute('cy',cy-HS*.56);
        ownerDot.setAttribute('r','4');
        ownerDot.setAttribute('fill',cell.owner==='A'?'rgba(200,60,60,.65)':'rgba(60,100,200,.65)');
        ownerDot.setAttribute('pointer-events','none');
        g.appendChild(ownerDot);
      }

      /* Highlight‑Overlay für mögliche Aktionen */
      if(vtSet.has(k)){
        const hl = document.createElementNS('http://www.w3.org/2000/svg','polygon');
        hl.setAttribute('points',points);
        hl.setAttribute('fill','rgba(200,168,75,0.15)');
        hl.setAttribute('stroke','#c8a84b');
        hl.setAttribute('stroke-width','2');
        hl.setAttribute('pointer-events','none');
        g.appendChild(hl);
      }

      svg.appendChild(g);
    });

    /* ---- Units ---- */
    Object.values(S.units).forEach(u=>{
      const [px,py] = c2p(u.q,u.r);
      const cx = px+ox, cy = py+oy;
      const cd = DB[u.cid];
      const sel = this.selUnit===u.id;
      const vt  = vtSet.has(cK(u.q,u.r));

      /* Unit‑Kreis */
      const circ = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circ.setAttribute('cx',cx); circ.setAttribute('cy',cy);
      circ.setAttribute('r','13');
      circ.setAttribute('fill', u.own==='A' ? '#2a0808' : '#08082a');
      circ.setAttribute('stroke', u.own==='A' ? '#cc3333' : '#3355cc');
      circ.setAttribute('stroke-width', sel?'3':'1.8');
      if(sel) circ.setAttribute('filter','url(#gw)');
      circ.style.cursor='pointer';
      circ.onclick = (e)=>{ e.stopPropagation(); this.selUnitFn(u.id); };
      svg.appendChild(circ);

      /* Unit‑Initialen */
      const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
      txt.setAttribute('x',cx); txt.setAttribute('y',cy+4);
      txt.setAttribute('text-anchor','middle');
      txt.setAttribute('fill', u.own==='A' ? '#ff9090' : '#9090ff');
      txt.setAttribute('font-size','9');
      txt.setAttribute('font-weight','bold');
      txt.setAttribute('pointer-events','none');
      txt.textContent = cd.name.substring(0,2).toUpperCase();
      svg.appendChild(txt);

      /* HP‑Bar */
      const barW = 22, barX = cx-barW/2, barY = cy+15;
      const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
      bg.setAttribute('x',barX); bg.setAttribute('y',barY);
      bg.setAttribute('width',barW); bg.setAttribute('height','3');
      bg.setAttribute('fill','#111'); bg.setAttribute('rx','1.5');
      bg.setAttribute('pointer-events','none'); svg.appendChild(bg);
      const hpBar = document.createElementNS('http://www.w3.org/2000/svg','rect');
      hpBar.setAttribute('x',barX); hpBar.setAttribute('y',barY);
      hpBar.setAttribute('width',(u.hp/u.maxHp*barW).toFixed(1));
      hpBar.setAttribute('height','3');
      hpBar.setAttribute('fill', u.own==='A' ? '#aa2222' : '#2244aa');
      hpBar.setAttribute('rx','1.5');
      hpBar.setAttribute('pointer-events','none'); svg.appendChild(hpBar);

      /* Bewegungs‑ / Angriffs‑Marker */
      if(u.moved || u.atked){
        const ex = document.createElementNS('http://www.w3.org/2000/svg','circle');
        ex.setAttribute('cx',cx+11); ex.setAttribute('cy',cy-11);
        ex.setAttribute('r','4');
        ex.setAttribute('fill','#882222'); ex.setAttribute('stroke','#cc4444');
        ex.setAttribute('stroke-width','1'); ex.setAttribute('pointer-events','none');
        svg.appendChild(ex);
      }
      if(vt && this.pact==='atk'){
        const ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
        ring.setAttribute('cx',cx); ring.setAttribute('cy',cy);
        ring.setAttribute('r','17');
        ring.setAttribute('fill','none');
        ring.setAttribute('stroke','#cc3333');
        ring.setAttribute('stroke-width','2.5');
        ring.setAttribute('pointer-events','none');
        svg.appendChild(ring);
      }
    });

    /* Base‑Highlight, wenn im Angriffs‑Modus */
    if(this.pact==='atk'){
      const [bq,br,bs] = this.ap==='A'?BASE_B:BASE_A;
      if(vtSet.has(cK(bq,br))){
        const [px,py]=c2p(bq,br);
        const cx=px+ox, cy=py+oy;
        const ring=document.createElementNS('http://www.w3.org/2000/svg','circle');
        ring.setAttribute('cx',cx); ring.setAttribute('cy',cy);
        ring.setAttribute('r','20');
        ring.setAttribute('fill','none');
        ring.setAttribute('stroke','#cc3333');
        ring.setAttribute('stroke-width','3');
        ring.setAttribute('pointer-events','none');
        svg.appendChild(ring);
      }
    }
  }
}

/* ---------- Engine‑Instanz starten ---------- */
const G = new Engine();
