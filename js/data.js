/* ------------------------------------------------------------------
   Karten‑Datenbank & Konstanten
   ------------------------------------------------------------------ */
const DB = {
  land_F:{id:'land_F',name:'Waldlichtung',type:'LAND',landType:'F',cost:0,req:{},text:'Platziert ein Waldfeld.'},
  land_D:{id:'land_D',name:'Wüstenoase',  type:'LAND',landType:'D',cost:0,req:{},text:'Platziert ein Wüstenfeld.'},
  land_M:{id:'land_M',name:'Bergpass',    type:'LAND',landType:'M',cost:0,req:{},text:'Platziert ein Bergfeld.'},
  land_W:{id:'land_W',name:'Flachufer',   type:'LAND',landType:'W',cost:0,req:{},text:'Platziert ein Seefeld.'},
  land_N:{id:'land_N',name:'Grasland',    type:'LAND',landType:'N',cost:0,req:{},text:'Platziert 2 neutrale Felder.'},
  scout_F:   {id:'scout_F',   name:'Waldläufer',   type:'UNIT',cost:2,req:{F:1},native:'F',atk:2,hp:4,bew:2,rei:1,text:'Auf Wald: +1 BEW.'},
  guardian_M:{id:'guardian_M',name:'Steinwächter',type:'UNIT',cost:4,req:{M:2},native:'M',atk:3,hp:6,bew:1,rei:1,text:'Min. 1 Schaden pro Treffer.'},
  rider_D:   {id:'rider_D',   name:'Wüstenreiter', type:'UNIT',cost:3,req:{D:1},native:'D',atk:3,hp:3,bew:3,rei:1,text:'Nach Angriff: Rückzug.'},
  sprite_W:  {id:'sprite_W',  name:'Seenixe',      type:'UNIT',cost:3,req:{W:1},native:'W',atk:2,hp:2,bew:2,rei:2,text:'Auf See: REI+1.'},
  archer_M:  {id:'archer_M',  name:'Bergschütze',  type:'UNIT',cost:3,req:{M:1},native:'M',atk:2,hp:3,bew:1,rei:2,text:'Fernkampf, kein Gegenschlag.'},
  brawler_N:{id:'brawler_N',name:'Söldner',      type:'UNIT',cost:2,req:{},   native:null,atk:2,hp:3,bew:2,rei:1,text:'Keine Landrequirements.'},
  emissary:  {id:'emissary',  name:'Dualist',      type:'UNIT',cost:5,req:{F:1,D:1},native:null,atk:4,hp:4,bew:2,rei:1,text:'Terrain‑Bonus F+D.'},
  wellkeeper:{id:'wellkeeper',name:'Brunnenwächter',type:'UNIT',cost:3,req:{},  native:null,atk:1,hp:5,bew:2,rei:1,text:'Adj. Well: +1 Mana.'},
  veil:{id:'veil',name:'Tarnschleier',type:'INSTANT',cost:1,req:{F:1},text:'-2 Schaden (min 0).'},
  gust:{id:'gust',name:'Sandschwall', type:'INSTANT',cost:2,req:{D:2},text:'Schiebe Gegner 1 Feld, 1 Schaden.'}
};

const LF = {N:'#1e2530',F:'#1a3a18',D:'#3a2810',M:'#22222e',W:'#0d1e3a'};
const LS = {N:'#3a4a60',F:'#2d5a27',D:'#6a4a18',M:'#4a4a60',W:'#1a4a7a'};

const PHASES = ['DRAW','LAND_OR_BOOST','MANA','PLAY','MOVE','ATTACK','CLEANUP'];
const PN = {
  DRAW:'Ziehen', LAND_OR_BOOST:'Land/Boost', MANA:'Mana',
  PLAY:'Spielen', MOVE:'Bewegen', ATTACK:'Angriff', CLEANUP:'Aufräumen'
};

/* ---------  WICHTIG  ---------
   In einer klassischen (nicht‑modularen) HTML‑Umgebung dürfen
   `export`‑Anweisungen nicht vorkommen – sonst bricht das Skript.
   Deshalb ist die Zeile unten **auskommentiert**.  */
 // export { DB, LF, LS, PHASES, PN };
