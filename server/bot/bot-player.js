'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Bot Player  v3  —  server/bot/bot-player.js
//  Drei Stufen: 'easy' | 'medium' | 'hard'
//
//  EASY:   Zufällig, macht Fehler, kein Pfad-Bewusstsein
//  MEDIUM: Heuristisch, bevorzugt Basis-Angriff, Wert-Scoring
//  HARD:   Lethal-Check, Trade-Bewertung, volle Board-Kontrolle
// ═══════════════════════════════════════════════════════════

const { ACTION } = require('../../shared/protocol');
const {
  cardData, adjPlace, validMoves, validAtks, canPlay,
  cK, cDist, isUnitCard, isInstantCard, isLandCard, isStructureCard,
  BASE_A, BASE_B, WELLS,
} = require('../engine/game-engine');

const BOT_END_TURN_GUARD_MS = 9000;
const THINK_MS   = { easy: 300,  medium: 600,  hard: 900  };
const JITTER_MS  = { easy: 800,  medium: 400,  hard: 200  };

class BotPlayer {
  constructor(player, room, socketId, difficulty = 'medium') {
    this.player     = player;
    this.room       = room;
    this.socketId   = socketId;
    this.difficulty = difficulty;
    this._thinking  = false;
    this._endTurnGuard  = null;
    this._lastActionKey = null;
    this._invalidCount  = 0;
  }

  // ── Lifecycle ──────────────────────────────────────────────
  onStateUpdate(state, pendingInput) {
    if (this._thinking) return;
    if (state.winner) { this._clearGuard(); return; }
    if (pendingInput) {
      this._resetGuard(state);
      this._schedule(() => this._handlePending(state, pendingInput));
      return;
    }
    if (state._mulliganPhase) { this._schedule(() => this._doMulligan(state)); return; }
    if (state.ap === this.player && state.phase === 'FREE') {
      this._resetGuard(state);
      this._schedule(() => this._doTurn(state));
    }
  }

  _resetGuard(state) {
    this._clearGuard();
    this._endTurnGuard = setTimeout(() => {
      if (!state.winner && state.ap === this.player) {
        console.warn('[Bot] Guard triggered — forcing END_TURN');
        this._thinking = false;
        this._act(ACTION.END_TURN);
      }
    }, BOT_END_TURN_GUARD_MS);
  }
  _clearGuard() {
    if (this._endTurnGuard) { clearTimeout(this._endTurnGuard); this._endTurnGuard = null; }
  }
  _schedule(fn) {
    this._thinking = true;
    const ms = (THINK_MS[this.difficulty]||600) + Math.random()*(JITTER_MS[this.difficulty]||400);
    setTimeout(() => {
      this._thinking = false;
      try { fn(); } catch(e) {
        console.error('[Bot] Error:', e.message);
        this._act(ACTION.END_TURN);
      }
    }, ms);
  }
  _act(type, payload = {}) {
    const key = type + JSON.stringify(payload);
    if (key === this._lastActionKey) {
      if (++this._invalidCount >= 2) {
        console.warn('[Bot] Loop detected, forcing END_TURN');
        this._lastActionKey = null; this._invalidCount = 0;
        this.room.handleAction(this.socketId, { type: ACTION.END_TURN, payload: {} });
        return;
      }
    } else { this._lastActionKey = key; this._invalidCount = 0; }
    this.room.handleAction(this.socketId, { type, payload });
  }

  // ── Shared helpers ─────────────────────────────────────────
  _myBase()  { return this.player === 'A' ? BASE_A : BASE_B; }
  _oppBase() { return this.player === 'A' ? BASE_B : BASE_A; }
  _opp()     { return this.player === 'A' ? 'B' : 'A'; }
  _dist(a, b) { return cDist(a, b); }

  _myLands(S) {
    return Object.entries(S.cells)
      .filter(([,c]) => c.type==='LAND' && c.owner===this.player)
      .map(([k]) => { const [q,r]=k.split(',').map(Number); return [q,r,-q-r]; });
  }
  _oppLands(S) {
    const opp = this._opp();
    return Object.entries(S.cells)
      .filter(([,c]) => c.type==='LAND' && c.owner===opp)
      .map(([k]) => { const [q,r]=k.split(',').map(Number); return [q,r,-q-r]; });
  }
  _landCount(S, type) {
    return Object.values(S.cells)
      .filter(c => c.type==='LAND' && c.owner===this.player && c.landType===type).length;
  }
  _chooseLandType(S) {
    const need = {F:0,W:0,M:0,D:0};
    for (const c of S.players[this.player].hand) {
      const cd = cardData(c.id);
      if (!cd?.req) continue;
      for (const [lt,cnt] of Object.entries(cd.req)) {
        if (need[lt]!==undefined) {
          need[lt] += Math.max(0,cnt-this._landCount(S,lt)) * (cd.cost||1);
        }
      }
    }
    const sorted = Object.entries(need).sort((a,b)=>b[1]-a[1]);
    return sorted[0][1]>0 ? sorted[0][0] : 'F';
  }
  _scoreLandSpot(S, q, r, s) {
    const opp=this._oppBase(), myLands=this._myLands(S);
    return -this._dist([q,r,s],opp)*3
           -Math.min(...WELLS.map(w=>this._dist([q,r,s],w)))*1
           -this._dist([q,r,s],[0,0,0])*0.5
           -(myLands.length?Math.min(...myLands.map(l=>this._dist([q,r,s],l))):0)*1.5;
  }

  // ═══════════════════════════════════════════════════════════
  //  EASY — random/naive
  // ═══════════════════════════════════════════════════════════
  _doMulliganEasy(S) {
    const replaceIds = S.players[this.player].hand
      .filter(() => Math.random()<0.45).map(c=>c.id);
    this._act(ACTION.MULLIGAN_CONFIRM, { replaceIds });
  }
  _doWheelEasy(S) {
    const spots = adjPlace(S,this.player).filter(([q,r])=>S.cells[cK(q,r)]?.type==='EMPTY');
    const roll = Math.random();
    if (roll<0.35) { this._act(ACTION.WHEEL_DRAW); return; }
    if (spots.length && roll<0.7) {
      const [q,r,s]=spots[Math.floor(Math.random()*spots.length)];
      const types=['F','W','M','D'];
      this._act(ACTION.WHEEL_LAND,{landType:types[Math.floor(Math.random()*4)],q,r,s:s??-q-r});
      return;
    }
    this._act(ACTION.WHEEL_BOOST);
  }
  _tryPlayEasy(S) {
    const hand = S.players[this.player].hand;
    const occ  = new Set(Object.values(S.units).filter(u=>u.q!==null).map(u=>cK(u.q,u.r)));
    const playable = hand.filter(c=>{const cd=cardData(c.id);return cd&&!isLandCard(cd)&&canPlay(S,this.player,c.id);});
    if (!playable.length) return false;
    const {id} = playable[0];
    const cd = cardData(id);
    if (isUnitCard(cd)||isStructureCard(cd)) {
      const free = this._myLands(S).filter(([q,r])=>!occ.has(cK(q,r)));
      if (!free.length) return false;
      const [q,r,s]=free[Math.floor(Math.random()*free.length)];
      this._act(isStructureCard(cd)?ACTION.PLAY_STRUCTURE:ACTION.PLAY_UNIT,{cardId:id,q,r,s:s??-q-r});
      return true;
    }
    if (isInstantCard(cd)) {
      const enemies=Object.values(S.units).filter(u=>u.own===this._opp()&&u.q!==null);
      if (enemies.length) {
        const t=enemies[Math.floor(Math.random()*enemies.length)];
        this._act(ACTION.PLAY_INSTANT,{cardId:id,q:t.q,r:t.r,s:t.s??-t.q-t.r});
        return true;
      }
      this._act(ACTION.PLAY_INSTANT_NOTARGET,{cardId:id}); return true;
    }
    return false;
  }
  _tryMoveEasy(S) {
    const units=Object.values(S.units).filter(u=>u.own===this.player&&u.q!==null&&!u.moved&&!u.summonSick);
    for(let i=units.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[units[i],units[j]]=[units[j],units[i]];}
    for (const u of units) {
      const moves=validMoves(S,u.id);
      if (!moves.length) continue;
      const [q,r,s]=moves[Math.floor(Math.random()*moves.length)];
      this._act(ACTION.MOVE_UNIT,{unitId:u.id,q,r,s:s??-q-r}); return true;
    }
    return false;
  }
  _tryAttackEasy(S) {
    const units=Object.values(S.units).filter(u=>u.own===this.player&&u.q!==null&&!u.atked&&!u.summonSick);
    for (const u of units) {
      const atks=validAtks(S,u.id);
      if (!atks.length) continue;
      const t=atks[Math.floor(Math.random()*atks.length)];
      if(t.type==='base') this._act(ACTION.ATTACK_BASE,{unitId:u.id});
      else this._act(ACTION.ATTACK_UNIT,{unitId:u.id,targetId:t.id});
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  //  MEDIUM — heuristic, basis-first
  // ═══════════════════════════════════════════════════════════
  _doMulliganMedium(S) {
    const replaceIds = S.players[this.player].hand
      .filter(c=>{const cd=cardData(c.id);return !cd||isLandCard(cd)||(cd.cost||0)>5;})
      .map(c=>c.id);
    this._act(ACTION.MULLIGAN_CONFIRM,{replaceIds});
  }
  _doWheelMedium(S) {
    const hand=S.players[this.player].hand, mana=S.players[this.player].mana;
    if (hand.length<=2) { this._act(ACTION.WHEEL_DRAW); return; }
    const spots=adjPlace(S,this.player).filter(([q,r])=>S.cells[cK(q,r)]?.type==='EMPTY');
    if (spots.length) {
      const lt=this._chooseLandType(S);
      const best=spots.map(([q,r,s])=>({q,r,s:s??-q-r,sc:this._scoreLandSpot(S,q,r,s??-q-r)}))
        .sort((a,b)=>b.sc-a.sc)[0];
      this._act(ACTION.WHEEL_LAND,{landType:lt,q:best.q,r:best.r,s:best.s}); return;
    }
    const playable=hand.filter(c=>canPlay(S,this.player,c.id));
    (playable.length>=2||mana<3)?this._act(ACTION.WHEEL_BOOST):this._act(ACTION.WHEEL_DRAW);
  }
  _cardScore(c) {
    const cd=c.cd||cardData(c.id);
    if (!cd) return 0;
    const v=((cd.atk||0)+(cd.hp||0))/Math.max(1,cd.cost||1);
    return v+((isUnitCard(cd)||isStructureCard(cd))?5:0)+(isInstantCard(cd)?-2:0)-(cd.cost||0)*0.3;
  }
  _tryPlayMedium(S) {
    const occ=new Set(Object.values(S.units).filter(u=>u.q!==null).map(u=>cK(u.q,u.r)));
    const playable=S.players[this.player].hand
      .map(c=>({...c,cd:cardData(c.id)}))
      .filter(c=>c.cd&&!isLandCard(c.cd)&&canPlay(S,this.player,c.id))
      .sort((a,b)=>this._cardScore(b)-this._cardScore(a));
    for (const {id,cd} of playable) {
      if (isUnitCard(cd)||isStructureCard(cd)) {
        const req=Object.entries(cd.req||{}).filter(([lt,v])=>v>0&&lt!=='wild')
          .map(([lt])=>({lake:'W',forest:'F',mountain:'M',desert:'D'}[lt]||lt));
        const spot=this._myLands(S).filter(([q,r])=>!occ.has(cK(q,r))&&(req.length===0||req.includes(S.cells[cK(q,r)]?.landType)))
          .sort((a,b)=>this._dist(a,this._oppBase())-this._dist(b,this._oppBase()))[0];
        if (!spot) continue;
        const [q,r,s]=spot;
        this._act(isStructureCard(cd)?ACTION.PLAY_STRUCTURE:ACTION.PLAY_UNIT,{cardId:id,q,r,s:s??-q-r});
        return true;
      }
      if (isInstantCard(cd)) {
        const t=Object.values(S.units).filter(u=>u.own===this._opp()&&u.q!==null)
          .sort((a,b)=>(a.hp||99)-(b.hp||99))[0];
        if (t){this._act(ACTION.PLAY_INSTANT,{cardId:id,q:t.q,r:t.r,s:t.s??-t.q-t.r});return true;}
        this._act(ACTION.PLAY_INSTANT_NOTARGET,{cardId:id}); return true;
      }
    }
    return false;
  }
  _tryMoveMedium(S) {
    const opp=this._oppBase();
    for (const u of Object.values(S.units).filter(u=>u.own===this.player&&u.q!==null&&!u.moved&&!u.summonSick)) {
      const moves=validMoves(S,u.id); if (!moves.length) continue;
      const scored=moves.map(([q,r,s])=>{
        const s3=s??-q-r;
        return {q,r,s:s3,sc:-this._dist([q,r,s3],opp)*2
          -Math.min(...WELLS.map(w=>this._dist([q,r,s3],w)))
          +(S.cells[cK(q,r)]?.owner&&S.cells[cK(q,r)]?.owner!==this.player?3:0)};
      }).sort((a,b)=>b.sc-a.sc);
      const b=scored[0];
      if(this._dist([b.q,b.r,b.s],opp)<this._dist([u.q,u.r,-u.q-u.r],opp)||b.sc>scored[scored.length-1].sc+1){
        this._act(ACTION.MOVE_UNIT,{unitId:u.id,q:b.q,r:b.r,s:b.s}); return true;
      }
    }
    return false;
  }
  _tryAttackMedium(S) {
    for (const u of Object.values(S.units).filter(u=>u.own===this.player&&u.q!==null&&!u.atked&&!u.summonSick)) {
      const atks=validAtks(S,u.id); if (!atks.length) continue;
      if (atks.find(t=>t.type==='base')){this._act(ACTION.ATTACK_BASE,{unitId:u.id});return true;}
      const enemies=atks.filter(t=>t.type!=='base');
      if (enemies.length){
        const killable=enemies.filter(e=>(e.hp||99)<=(u.atk||0));
        const t=(killable.length?killable:enemies).sort((a,b)=>(a.hp||99)-(b.hp||99))[0];
        this._act(ACTION.ATTACK_UNIT,{unitId:u.id,targetId:t.id}); return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  //  HARD — lethal-first, trade-scoring, full board control
  // ═══════════════════════════════════════════════════════════
  _doMulliganHard(S) {
    // Keep cheap units (≤3 cost) and key early plays; discard expensive/land cards
    const replaceIds = S.players[this.player].hand.filter(c=>{
      const cd=cardData(c.id);
      if (!cd||isLandCard(cd)) return true;
      if ((cd.cost||0)>5) return true;
      if ((cd.cost||0)<=3&&isUnitCard(cd)) return false; // always keep
      return false;
    }).map(c=>c.id);
    this._act(ACTION.MULLIGAN_CONFIRM,{replaceIds});
  }

  // Can we deal lethal to opponent's base this turn?
  _canLethal(S) {
    const opp=this._opp(), oppHp=S.players[opp].hp;
    return Object.values(S.units)
      .filter(u=>u.own===this.player&&u.q!==null&&!u.atked&&!u.summonSick)
      .reduce((dmg,u)=>{
        const atks=validAtks(S,u.id);
        return atks.some(t=>t.type==='base') ? dmg+(u.atk||0)+(cardData(u.cid)?.godBonus||0) : dmg;
      }, 0) >= oppHp;
  }

  // Score an attack target (higher = better to attack)
  _tradeScore(attacker, target) {
    const myAtk=attacker.atk||0, tHp=target.hp||1, tAtk=target.atk||0, myHp=attacker.hp||1;
    let sc=0;
    if (myAtk>=tHp) sc+=20;           // we kill them
    if (myHp>tAtk) sc+=8;             // we survive
    if (myAtk>=tHp&&myHp>tAtk) sc+=5; // clean trade bonus
    if (myAtk<tHp&&myHp<=tAtk) sc-=15;// we die and don't kill: terrible
    sc+=tAtk*2;                        // threatening units are worth attacking
    sc-=tHp*0.5;                       // prefer weaker targets
    return sc;
  }

  _doWheelHard(S) {
    const hand=S.players[this.player].hand, mana=S.players[this.player].mana;
    // If lethal available this turn, boost mana
    if (this._canLethal(S)) { this._act(ACTION.WHEEL_BOOST); return; }
    const spots=adjPlace(S,this.player).filter(([q,r])=>S.cells[cK(q,r)]?.type==='EMPTY');
    if (spots.length) {
      const lt=this._chooseLandType(S);
      const oppLands=this._oppLands(S), oppBase=this._oppBase();
      const best=spots.map(([q,r,s])=>{
        const s3=s??-q-r;
        let sc=this._scoreLandSpot(S,q,r,s3);
        // Bonus: block opponent path (cut off their advance)
        if (oppLands.length&&Math.min(...oppLands.map(l=>this._dist([q,r,s3],l)))<=2
            &&this._dist([q,r,s3],oppBase)<this._dist(this._myBase(),oppBase)) sc+=2;
        return {q,r,s:s3,sc};
      }).sort((a,b)=>b.sc-a.sc)[0];
      this._act(ACTION.WHEEL_LAND,{landType:lt,q:best.q,r:best.r,s:best.s}); return;
    }
    // Draw if hand is small; boost if we have playable cards
    const playable=hand.filter(c=>canPlay(S,this.player,c.id));
    if (hand.length<=3) { this._act(ACTION.WHEEL_DRAW); return; }
    (playable.length>=2||mana<4)?this._act(ACTION.WHEEL_BOOST):this._act(ACTION.WHEEL_DRAW);
  }

  _tryPlayHard(S) {
    const opp=this._opp(), oppHp=S.players[opp].hp, mana=S.players[this.player].mana;
    const occ=new Set(Object.values(S.units).filter(u=>u.q!==null).map(u=>cK(u.q,u.r)));
    const oppBase=this._oppBase();

    const playable=S.players[this.player].hand
      .map(c=>({...c,cd:cardData(c.id)}))
      .filter(c=>c.cd&&!isLandCard(c.cd)&&canPlay(S,this.player,c.id))
      .sort((a,b)=>{
        const acd=a.cd,bcd=b.cd;
        const av=((acd.atk||0)+(acd.hp||0))/Math.max(1,acd.cost||1);
        const bv=((bcd.atk||0)+(bcd.hp||0))/Math.max(1,bcd.cost||1);
        // Prefer units; prefer spending all mana (tempo); prefer finishers when opp low
        const aTempo=mana-(acd.cost||0)<=1?3:0, bTempo=mana-(bcd.cost||0)<=1?3:0;
        const aFinish=isInstantCard(acd)&&oppHp<=8?3:0, bFinish=isInstantCard(bcd)&&oppHp<=8?3:0;
        return (bv+((isUnitCard(bcd)||isStructureCard(bcd))?4:0)+bTempo+bFinish)
             - (av+((isUnitCard(acd)||isStructureCard(acd))?4:0)+aTempo+aFinish);
      });

    for (const {id,cd} of playable) {
      if (isUnitCard(cd)||isStructureCard(cd)) {
        const req=Object.entries(cd.req||{}).filter(([lt,v])=>v>0&&lt!=='wild')
          .map(([lt])=>({lake:'W',forest:'F',mountain:'M',desert:'D'}[lt]||lt));
        const wild=Object.keys(cd.req||{}).some(k=>k==='wild'&&(cd.req[k]||0)>0);
        const candidates=this._myLands(S)
          .filter(([q,r])=>!occ.has(cK(q,r))&&(req.length===0||wild||req.includes(S.cells[cK(q,r)]?.landType)))
          .sort((a,b)=>this._dist(a,oppBase)-this._dist(b,oppBase)); // closest to enemy first
        if (!candidates.length) continue;
        const [q,r,s]=candidates[0];
        this._act(isStructureCard(cd)?ACTION.PLAY_STRUCTURE:ACTION.PLAY_UNIT,{cardId:id,q,r,s:s??-q-r});
        return true;
      }
      if (isInstantCard(cd)) {
        const enemies=Object.values(S.units).filter(u=>u.own===opp&&u.q!==null)
          .sort((a,b)=>(a.hp||99)-(b.hp||99));
        if (enemies.length){
          this._act(ACTION.PLAY_INSTANT,{cardId:id,q:enemies[0].q,r:enemies[0].r,s:enemies[0].s??-enemies[0].q-enemies[0].r});
          return true;
        }
        this._act(ACTION.PLAY_INSTANT_NOTARGET,{cardId:id}); return true;
      }
    }
    return false;
  }

  _tryMoveHard(S) {
    const opp=this._opp(), oppBase=this._oppBase();
    const units=Object.values(S.units)
      .filter(u=>u.own===this.player&&u.q!==null&&!u.moved&&!u.summonSick)
      .sort((a,b)=>this._dist([a.q,a.r,a.s??-a.q-a.r],oppBase)-this._dist([b.q,b.r,b.s??-b.q-b.r],oppBase));

    for (const u of units) {
      const moves=validMoves(S,u.id); if (!moves.length) continue;
      const scored=moves.map(([q,r,s])=>{
        const s3=s??-q-r;
        let sc=-this._dist([q,r,s3],oppBase)*3;
        if (WELLS.some(w=>this._dist([q,r,s3],w)===1)) sc+=5;    // harvest
        if (S.cells[cK(q,r)]?.owner===opp) sc+=4;                // take opp land
        if (this._dist([q,r,s3],oppBase)<=1) sc+=8;              // attack range of base
        // Penalty: walking into death (multiple strong enemies adj)
        const dangerousEnemies=Object.values(S.units)
          .filter(e=>e.own===opp&&e.q!==null&&this._dist([q,r,s3],[e.q,e.r,e.s??-e.q-e.r])<=1&&(e.atk||0)>=(u.hp||1));
        sc-=dangerousEnemies.length*7;
        return {q,r,s:s3,sc};
      }).sort((a,b)=>b.sc-a.sc);
      const best=scored[0];
      const curr=this._dist([u.q,u.r,-u.q-u.r],oppBase);
      const nxt=this._dist([best.q,best.r,best.s],oppBase);
      if (nxt<curr||best.sc>-2) {
        this._act(ACTION.MOVE_UNIT,{unitId:u.id,q:best.q,r:best.r,s:best.s}); return true;
      }
    }
    return false;
  }

  _tryGiftHard(S) {
    const opp=this._opp();
    for (const u of Object.values(S.units).filter(u=>u.own===this.player&&u.q!==null&&!u.atked&&!u.summonSick)) {
      if (!cardData(u.cid)?.onGift) continue;
      const enemies=Object.values(S.units).filter(e=>e.own===opp&&e.q!==null).sort((a,b)=>(a.hp||99)-(b.hp||99));
      const allies =Object.values(S.units).filter(a=>a.own===this.player&&a.q!==null&&a.id!==u.id).sort((a,b)=>(b.atk||0)-(a.atk||0));
      const t=enemies[0]||allies[0];
      if (t){this._act(ACTION.USE_GIFT,{unitId:u.id,q:t.q,r:t.r,s:t.s??-t.q-t.r});return true;}
    }
    return false;
  }

  _tryAttackHard(S) {
    const opp=this._opp(), oppHp=S.players[opp].hp;
    const units=Object.values(S.units).filter(u=>u.own===this.player&&u.q!==null&&!u.atked&&!u.summonSick);

    // 1. Lethal first — attack base with all that can reach
    if (this._canLethal(S)) {
      for (const u of units) {
        if (validAtks(S,u.id).some(t=>t.type==='base')) {
          this._act(ACTION.ATTACK_BASE,{unitId:u.id}); return true;
        }
      }
    }

    // 2. Score every possible attack and pick the best
    let best=null, bestSc=-Infinity;
    for (const u of units) {
      for (const t of validAtks(S,u.id)) {
        let sc;
        if (t.type==='base') {
          const dmg=(u.atk||0)+(cardData(u.cid)?.godBonus||0);
          sc=(dmg/oppHp)*30+(oppHp-dmg<=5?15:0);
        } else {
          sc=this._tradeScore(u,t);
          // Bonus: target near our base is a threat
          const distToMyBase=this._dist([t.q,t.r,t.s??-t.q-t.r],this._myBase());
          sc+=(t.atk||0)*(3-Math.min(3,distToMyBase));
        }
        if (sc>bestSc) { bestSc=sc; best={u,t}; }
      }
    }
    if (!best||bestSc<-8) return false; // skip clearly bad attacks
    if (best.t.type==='base') this._act(ACTION.ATTACK_BASE,{unitId:best.u.id});
    else this._act(ACTION.ATTACK_UNIT,{unitId:best.u.id,targetId:best.t.id});
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  //  DISPATCH
  // ═══════════════════════════════════════════════════════════
  _doMulligan(state) {
    if (this.difficulty==='easy') return this._doMulliganEasy(state);
    if (this.difficulty==='hard') return this._doMulliganHard(state);
    return this._doMulliganMedium(state);
  }
  _doWheel(S) {
    if (this.difficulty==='easy') return this._doWheelEasy(S);
    if (this.difficulty==='hard') return this._doWheelHard(S);
    return this._doWheelMedium(S);
  }
  _doTurn(state) {
    const S=state;
    if (!S.lobDone) { this._doWheel(S); return; }
    if (this.difficulty==='easy') {
      if (this._tryPlayEasy(S))   return;
      if (this._tryMoveEasy(S))   return;
      if (this._tryAttackEasy(S)) return;
    } else if (this.difficulty==='hard') {
      // Hard: lethal check → gift → play → attack → move → attack again (post-move positions)
      if (this._canLethal(S)&&this._tryAttackHard(S)) return;
      if (this._tryGiftHard(S))   return;
      if (this._tryPlayHard(S))   return;
      if (this._tryAttackHard(S)) return;
      if (this._tryMoveHard(S))   return;
      if (this._tryAttackHard(S)) return; // after moving, new attack opportunities
    } else {
      if (this._tryPlayMedium(S))   return;
      if (this._tryMoveMedium(S))   return;
      if (this._tryAttackMedium(S)) return;
    }
    this._clearGuard();
    this._act(ACTION.END_TURN);
  }

  // ── Pending inputs (all difficulties) ─────────────────────
  _handlePending(state, pi) {
    const opp=this._opp();
    switch(pi.type) {
      case 'mulligan':         this._doMulligan(state); break;
      case 'mulligan_waiting': break;
      case 'discover': {
        if (!pi.pool?.length) break;
        if (this.difficulty==='easy') {
          this._act(ACTION.DISCOVER_PICK,{chosenId:pi.pool[Math.floor(Math.random()*pi.pool.length)]});
        } else {
          const best=pi.pool.reduce((b,id)=>{
            const cd=cardData(id),bcd=cardData(b);
            const v=cd?((cd.atk||0)+(cd.hp||0))/Math.max(1,cd.cost||1):0;
            const bv=bcd?((bcd.atk||0)+(bcd.hp||0))/Math.max(1,bcd.cost||1):0;
            return v>bv?id:b;
          },pi.pool[0]);
          this._act(ACTION.DISCOVER_PICK,{chosenId:best});
        }
        break;
      }
      case 'choose_one': this._act(ACTION.CHOOSE_ONE,{choiceIndex:0}); break;
      case 'gift': {
        const enemies=Object.values(state.units||{}).filter(u=>u.q!==null&&u.own===opp).sort((a,b)=>(a.hp||99)-(b.hp||99));
        const t=enemies[0];
        this._act(ACTION.USE_GIFT,{unitId:pi.unitId,q:t?.q??0,r:t?.r??0,s:t?(-t.q-t.r):0});
        break;
      }
      case 'dash': {
        const moves=validMoves(state,pi.unitId);
        if (moves.length) {
          const oppBase=this._oppBase();
          moves.sort((a,b)=>this._dist(a,oppBase)-this._dist(b,oppBase));
          const [q,r,s]=moves[0];
          this._act(ACTION.DASH,{unitId:pi.unitId,q,r,s:s??-q-r});
        } else this._act(ACTION.END_TURN);
        break;
      }
      case 'woc': {
        const t=Object.values(state.units||{}).filter(u=>u.q!==null&&(u.atk||0)<=5).sort((a,b)=>(a.hp||99)-(b.hp||99))[0];
        if(t) this._act(ACTION.WHEEL_OF_CHAOS_TARGET,{unitId:t.id});
        else   this._act(ACTION.END_TURN);
        break;
      }
      case 'flame_burst': {
        // Hard: target a killable enemy; others: always base
        if (this.difficulty==='hard') {
          const killable=Object.values(state.units||{})
            .filter(u=>u.q!==null&&u.own===opp&&(u.hp||0)<=3)
            .sort((a,b)=>(b.atk||0)-(a.atk||0))[0];
          if (killable){this._act(ACTION.FLAME_BURST_TARGET,{q:killable.q,r:killable.r,s:killable.s??-killable.q-killable.r});break;}
        }
        const [bq,br]=opp==='A'?BASE_A:BASE_B;
        this._act(ACTION.FLAME_BURST_TARGET,{q:bq,r:br,s:-bq-br});
        break;
      }
      case 'spirit_spice': {
        const b=Object.values(state.units||{}).filter(u=>u.q!==null&&u.own===this.player).sort((a,b)=>(b.atk||0)-(a.atk||0))[0];
        if(b) this._act(ACTION.SPIRIT_SPICE_TARGET,{unitId:b.id});
        else   this._act(ACTION.END_TURN);
        break;
      }
      case 'octopus': {
        const us=Object.values(state.units||{}).filter(u=>u.q!==null);
        if(us.length>=2) this._act(ACTION.OCTOPUS_PICK,{unitId1:us[0].id,unitId2:us[1].id});
        else this._act(ACTION.END_TURN);
        break;
      }
      default: this._doTurn(state);
    }
  }
}

module.exports = { BotPlayer };
