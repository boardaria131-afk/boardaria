<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HexForge</title>

  <!-- 1️⃣ CSS einbinden -->
  <link rel="stylesheet" href="css/style.css">
  <!-- Optional: favicon (kann weggelassen werden) -->
  <!-- <link rel="icon" href="favicon.ico"> -->
</head>
<body>

<div id="hdr">
  <h1>HEX<span style="color:#5a6a7a">FORGE</span></h1>
  <div id="phdis"><div class="ap" id="ph-name">DRAW</div><div id="ph-dots"></div></div>
  <div id="turdis">Runde <span id="rnd">1</span> &nbsp;<span class="pn A" id="apn">SPIELER A</span></div>
</div>

<div id="main">
  <!-- ---------- PLAYER A ---------- -->
  <div class="sp">
    <div class="pt">Spieler A</div>
    <div class="ps A">
      <div class="nm">⚔ SPIELER A</div>
      <div class="hbw"><div class="hb A" id="hpbar-A" style="width:100%"></div></div>
      <div class="sr"><span class="sl">Basis HP</span><span class="sv hp" id="hp-A">20</span></div>
      <div class="sr"><span class="sl">Mana</span><span class="sv mn" id="mana-A">3</span></div>
      <div class="sr"><span class="sl">Hand/Deck</span><span class="sv cd" id="cards-A">5/25</span></div>
      <div class="sr"><span class="sl">Wells</span><span class="sv" id="wells-A" style="color:var(--well)">0</span></div>
    </div>
    <div class="pt">Hand</div>
    <div id="hand-area"></div>
  </div>

  <!-- ---------- BOARD ---------- -->
  <div id="bw">
    <svg id="board"></svg>
    <div id="abar">
      <button class="ab" id="btn-land" onclick="G.openLandMenu()">⬡ Land/Aktion</button>
      <button class="ab pr" id="btn-next" onclick="G.nextPhase()">Phase ▶</button>
      <button class="ab dn" id="btn-cancel" onclick="G.cancelSel()">✕ Abbruch</button>
    </div>
  </div>

  <!-- ---------- PLAYER B ---------- -->
  <div class="sp">
    <div class="pt">Spieler B</div>
    <div class="ps B">
      <div class="nm">⚔ SPIELER B</div>
      <div class="hbw"><div class="hb B" id="hpbar-B" style="width:100%"></div></div>
      <div class="sr"><span class="sl">Basis HP</span><span class="sv hp" id="hp-B">20</span></div>
      <div class="sr"><span class="sl">Mana</span><span class="sv mn" id="mana-B">3</span></div>
      <div class="sr"><span class="sl">Hand/Deck</span><span class="sv cd" id="cards-B">5/25</span></div>
      <div class="sr"><span class="sl">Wells</span><span class="sv" id="wells-B" style="color:var(--well)">0</span></div>
    </div>
    <div class="pt">Einheit</div>
    <div id="ud"><span style="color:var(--dim);font-size:.68rem">Einheit auswählen…</span></div>
    <div class="pt">Log</div>
    <div id="lp"></div>
  </div>
</div>

<!-- ---------- RADIAL MENU ---------- -->
<div id="rmenu">
  <div id="rmenu-bg" onclick="G.closeLandMenu()"></div>
  <div id="rmenu-wrap">
    <svg id="rmenu-svg" width="340" height="340" viewBox="0 0 340 340"></svg>
    <button class="rm-cancel" onclick="G.closeLandMenu()">✕ Abbrechen</button>
  </div>
</div>

<!-- ---------- PLAYER‑SWITCH OVERLAY ---------- -->
<div id="sw-ov">
  <div id="sw-card">
    <div class="sc-sub">Jetzt am Zug</div>
    <div class="sc-nm A" id="sc-nm">SPIELER A</div>
    <div class="sc-yt">Your Turn!</div>
    <button onclick="G.dismissSwitch()">Bereit ▶</button>
  </div>
</div>

<!-- ---------- WIN OVERLAY ---------- -->
<div id="win-ov">
  <div id="win-card">
    <h2 id="win-title">Spieler A gewinnt!</h2>
    <p>Die gegnerische Basis wurde zerstört.</p>
    <button onclick="location.reload()">Neues Spiel</button>
  </div>
</div>

<!-- ---------- SCRIPTS (klassisch) ---------- -->
<script src="js/data.js"></script>               <!-- 1️⃣ zuerst -->
<script src="js/engine.js" defer></script>        <!-- 2️⃣ danach -->
</body>
</html>
