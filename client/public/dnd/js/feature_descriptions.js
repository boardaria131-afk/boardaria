/**
 * feature_descriptions.js
 * Offizielle SRD-Kurzbeschreibungen für Klassen-Features und Subklassen-Fähigkeiten.
 * Quelle: SRD 5.1 (CC BY 4.0)
 */

const FeatureDesc = {

  // ── Barbarian ─────────────────────────────────────────────────────────────
  "Rage": "Bonus-Aktion. Für 1 Minute: Vorteil auf STR-Proben & Rettungswürfe, +2/+3/+4 Schadensbonus mit STR-Waffen, Resistenz gegen Hieb-/Stich-/Wuchtschaden. Endet bei Bewusstlosigkeit, keinem Angriff/Schaden mehr oder Wahl. 2–6× pro langer Rast (Level-abhängig).",
  "Unarmored Defense": "Ohne Rüstung: AC = 10 + DEX-Mod + CON-Mod. Schild nutzbar.",
  "Reckless Attack": "Erste Attacke jedes Zugs mit Vorteil. Bis zum nächsten Zug haben alle Angriffe gegen dich Vorteil.",
  "Danger Sense": "Vorteil auf DEX-Rettungswürfe gegen sichtbare Effekte (z.B. Fallen, Zauber). Nicht wenn blind, taub oder bewusstlos.",
  "Extra Attack": "Zweimal angreifen (statt einmal) wenn Angriffsaction genutzt. Stack nicht mit anderen Extra-Attack-Quellen.",
  "Fast Movement": "+10 Fuß Bewegung ohne Rüstung.",
  "Feral Instinct": "Vorteil auf Initiative. Wenn überrascht, kannst du trotzdem in der ersten Runde wüten.",
  "Brutal Critical": "1 zusätzlicher Schadenswürfel bei kritischen Treffern. Steigt auf 2 bei Level 17.",
  "Relentless Rage": "Wenn Rage aktiv und auf 0 HP reduziert: CON-Rettungswurf (SG 10, +5 je Nutzung bis langer Rast). Erfolg: bleib auf 1 HP.",
  "Persistent Rage": "Rage endet nicht mehr unfreiwillig außer durch Bewusstlosigkeit.",
  "Primal Champion": "+4 STR, +4 CON (kann 20 überschreiten).",

  // ── Bard ──────────────────────────────────────────────────────────────────
  "Bardic Inspiration": "Bonus-Aktion: Verbündeter in 60 Fuß erhält 1 Inspirationswürfel (d6→d12). Kann innerhalb 10 Min. zu Angriff/Probe/Rettungswurf addiert werden. CHA-Mod-mal pro kurzer Rast (ab Level 5).",
  "Jack of All Trades": "Halber Kompetenzbonus (abgerundet) auf alle Fertigkeitsproben ohne Kompetenz.",
  "Song of Rest": "Verbündete die kurze Rast mit dir verbringen heilen extra (1d6→1d12) wenn sie mindestens 1 TW ausgeben.",
  "Expertise": "Doppelter Kompetenzbonus auf zwei gewählte Fertigkeiten (oder eine + Diebeswerkzeug). Nochmals bei Level 10.",
  "Countercharm": "Aktion: Verbündete in 30 Fuß haben Vorteil auf Rettungswürfe gegen Bezaubert/Verängstigt bis Ende deines nächsten Zugs.",
  "Magical Secrets": "Lerne 2 Zauber beliebiger Klasse. Wiederholung bei Level 14 und 18.",
  "Superior Inspiration": "Bei Initiative: mindestens 1 Bardic Inspiration.",

  // ── Cleric ────────────────────────────────────────────────────────────────
  "Spellcasting": "Bereite WIS-Mod + Level Zauber vor. Wirke mit Zauberschlitzen. Fokus: heiliges Symbol.",
  "Divine Domain": "Wähle eine Domäne bei Level 1. Gewährt Domänenzauber und besondere Fähigkeiten.",
  "Channel Divinity": "Nutze göttliche Energie für besondere Effekte. 1× (Level 1-5), 2× (Level 6-17), 3× (Level 18+) pro kurzer Rast.",
  "Turn Undead": "Channel Divinity: Untote in 30 Fuß die deinen WIS-Zauber-SG nicht schaffen fliehen 1 Minute lang.",
  "Destroy Undead": "Untote bis CR ½ (steigt auf CR 4) werden sofort vernichtet statt geflohen.",
  "Divine Intervention": "Ruf deinen Gott um Hilfe. WIS%-Chance auf Erfolg. Bei Level 20 immer erfolgreich. 7 Tage Wartezeit nach Erfolg.",

  // ── Druid ─────────────────────────────────────────────────────────────────
  "Druidic": "Geheimsprache der Druiden. Nur Druiden verstehen sie.",
  "Wild Shape": "Aktion: Verwandle dich in ein Tier (CR ≤ ¼ bei Level 2, CR ≤ ½ bei Level 4, CR ≤ 1 bei Level 8, steigt weiter). 2× pro kurzer Rast. HP werden zu Tierhp – überschüssiger Schaden geht auf eigene HP.",
  "Timeless Body": "Alterst 10× langsamer.",
  "Beast Spells": "Kannst Zauber auch in Wild Shape wirken (nur verbale/gestische Komponenten).",

  // ── Fighter ───────────────────────────────────────────────────────────────
  "Fighting Style": "Wähle einen Kampfstil (Defense +1 AC, Dueling +2 Schaden, Great Weapon Fighting Reroll 1-2, Protection Reaktions-Nachteil, etc.).",
  "Second Wind": "Bonus-Aktion: Heile 1d10 + Fighter-Level HP. 1× pro kurzer Rast.",
  "Action Surge": "Erhalte einmalig pro kurzer Rast eine zusätzliche vollständige Action.",
  "Indomitable": "Einen misslungenen Rettungswurf wiederholen. 1× (Level 9), 2× (Level 13), 3× (Level 17) pro langer Rast.",

  // ── Monk ──────────────────────────────────────────────────────────────────
  "Martial Arts": "Ohne Rüstung: DEX für Angriff+Schaden unbewaffnet und Mönchswaffen. Unbewaffnet: 1d4→1d10 Schaden (Level). Bonus-Aktion: unbewaffneter Schlag nach Angriff.",
  "Ki": "Ki-Punkte = Monk-Level. Für: Flurry of Blows (2 Bonus-Schläge, 1 Ki), Patient Defense (Dodge als Bonus, 1 Ki), Step of the Wind (Dash/Disengage als Bonus+doppelter Sprung, 1 Ki). Regenerieren bei kurzer Rast.",
  "Unarmored Movement": "+10→+30 Fuß Bewegung ohne Rüstung/Schild. Ab Level 9: Klettern/Rennen über Wände/Wasser möglich.",
  "Deflect Missiles": "Reaktion bei Fernkampfwaffentreffer: reduziere Schaden um 1d10+DEX-Mod+Monk-Level. Bei 0 Schaden: fange das Projektil und wirf es zurück (1 Ki, Angriff).",
  "Slow Fall": "Reaktion: reduziere Fallschaden um Monk-Level × 5.",
  "Stunning Strike": "Nach Treffer mit Monk-Waffe/unbewaffnet: 1 Ki ausgeben. Ziel CON-Rettungswurf oder bis Ende deines nächsten Zugs betäubt (kein Reaktion, Angriffe mit Vorteil).",
  "Ki-Empowered Strikes": "Unbewaffnete Schläge gelten als magisch.",
  "Evasion": "Bei DEX-Rettungswurf für halben Schaden: bei Erfolg 0 Schaden, bei Misserfolg nur halb.",
  "Stillness of Mind": "Aktion: beende Bezaubert- oder Verängstigt-Zustand selbst.",
  "Purity of Body": "Immun gegen Gift und Krankheit.",
  "Diamond Soul": "Kompetenz in allen Rettungswürfen. Misslungener Rettungswurf: 1 Ki für Wiederholung.",
  "Empty Body": "4 Ki: Unsichtbarkeit für 1 Minute + Resistenz gegen alle außer Kraft-Schaden. 8 Ki: Astral Projection.",
  "Perfect Self": "Bei Initiative wenn keine Ki-Punkte: erhalte 4 zurück.",

  // ── Paladin ───────────────────────────────────────────────────────────────
  "Divine Sense": "Aktion: Spüre Celestials/Fiends/Untote in 60 Fuß + geweihte/entheiligte Orte. (1 + CHA-Mod)× pro langer Rast.",
  "Lay on Hands": "Heilungsvorrat = Paladin-Level × 5. Berühre: heile beliebig viele HP. Oder 5 HP: heile eine Krankheit/ein Gift. Wirkt nicht auf Untote/Konstrukte.",
  "Divine Smite": "Nach Treffer mit Nahkampfwaffe: Zauberschlitz ausgeben für 2d8 (+1d8 pro Schlitzniveau über 1.) Strahlen-Schaden. +1d8 gegen Untote/Fiends. Max 5d8 (6d8 Untote).",
  "Divine Health": "Immun gegen Krankheiten (Level 3).",
  "Sacred Oath": "Schwöre deinen Eid bei Level 3. Bestimmt Eidszauber und Channel Divinity Optionen.",
  "Aura of Protection": "Du + Verbündete in 10 Fuß (Level 18: 30 Fuß): +CHA-Mod (min +1) auf alle Rettungswürfe. Muss bewusst sein.",
  "Aura of Courage": "Du + Verbündete in 10 Fuß (Level 18: 30 Fuß): können nicht verängstigt werden. Muss bewusst sein.",
  "Improved Divine Smite": "Alle Nahkampftreffer: zusätzlich 1d8 Strahlen-Schaden (ohne Schlitz).",
  "Cleansing Touch": "Aktion: beende einen Zauber auf dir oder einem willigen Berührten. CHA-Mod× (min 1) pro langer Rast.",

  // ── Ranger ────────────────────────────────────────────────────────────────
  "Favored Enemy": "Vorteil auf Überlebens-Proben zum Verfolgen + Intelligenz-Proben über einen Feindtyp. Lerne Sprache des Feindes.",
  "Natural Explorer": "Bevorzugtes Gelände: doppelter Kompetenzbonus auf Geländeproben, nie Navigationsprobleme, doppelte Reisegeschwindigkeit, etc.",
  "Primeval Awareness": "Minuten = Zauberschlitzniveau: spüre Feindtypen in 1 Meile (6 Meilen Wildnis).",
  "Vanish": "Bonus-Aktion: Verstecken. Kannst nicht durch nicht-magische Mittel verfolgt werden.",
  "Feral Senses": "Keine Nachteil durch Unsichtbarkeit wenn Feind hörbar. Spüre Unsichtbare in 30 Fuß.",
  "Foe Slayer": "Einmal pro Zug: +WIS-Mod auf Angriff oder Schaden gegen Lieblingsfeindes.",

  // ── Rogue ─────────────────────────────────────────────────────────────────
  "Sneak Attack": "Einmal pro Zug extra Schaden wenn Vorteil ODER Verbündeter am Ziel und kein Nachteil. 1d6 (Level 1) bis 10d6 (Level 19).",
  "Cunning Action": "Bonus-Aktion: Dash, Disengage oder Verstecken.",
  "Uncanny Dodge": "Reaktion wenn Angreifer sichtbar: halbiere den Schaden eines Angriffs.",
  "Reliable Talent": "Bei Fertigkeitsprobe mit Kompetenz: Würfelwurf unter 10 zählt als 10.",
  "Blindsense": "Spüre Unsichtbare in 10 Fuß wenn hören möglich.",
  "Slippery Mind": "Kompetenz in WIS-Rettungswürfen.",
  "Elusive": "Angreifer haben nie Vorteil gegen dich solange du nicht kampfunfähig bist.",
  "Stroke of Luck": "Misslungener Angriff: treffe stattdessen. Misslungene Probe: zähle als 20. 1× pro kurzer Rast.",

  // ── Sorcerer ──────────────────────────────────────────────────────────────
  "Sorcerous Origin": "Wähle deinen magischen Ursprung (Draconic, Wild Magic, etc.).",
  "Font of Magic": "Sorcery Points = Level. Konvertiere: 2 SP → 1. Schlitz, oder Schlitz → SP. Kurze Rast regeneriert nicht.",
  "Metamagic": "Nutze SP um Zauber zu modifizieren: Careful (schütze Verbündete), Distant (verdopple Reichweite), Empowered (reroll Schadenswürfel), Extended (doppelte Dauer), Heightened (+1 SP: Nachteil auf Rettung), Quickened (Bonus-Aktion cast), Subtle (ohne V/S), Twinned (zweites Ziel).",
  "Sorcerous Restoration": "Kurze Rast: erhalte 4 Sorcery Points zurück.",

  // ── Warlock ───────────────────────────────────────────────────────────────
  "Otherworldly Patron": "Schließe einen Pakt mit einer mächtigen Wesenheit.",
  "Pact Magic": "Pakt-Zauberschlitze: alle auf höchstem Level, regenerieren bei kurzer Rast. Nur 1-2 Schlitze, aber hohe Flexibilität.",
  "Eldritch Invocations": "Lerne übernatürliche Fähigkeiten. Beginnend Level 2: 2 Invokationen, steigt bis 8.",
  "Pact Boon": "Level 3: Paktgabe – Blade (Waffe), Chain (Vertrauter), Tome (Zauberbuch mit Cantrips).",
  "Mystic Arcanum": "Lerne je einen Zauber Level 6/7/8/9 – wirke 1× pro langer Rast ohne Schlitz.",
  "Eldritch Master": "1 Minute Ritual: erhalte alle Pakt-Schlitze zurück. 1× pro langer Rast.",

  // ── Wizard ────────────────────────────────────────────────────────────────
  "Arcane Recovery": "Kurze Rast: erhalte Zauberschlitze zurück (Summe ≤ Level/2 aufgerundet, max Level 5 Schlitze). 1× pro langer Rast.",
  "Spell Mastery": "Level 18: Wähle Level-1 und Level-2 Zauber – wirke ohne Schlitz (normale Wirkzeit).",
  "Signature Spell": "Level 20: Wähle zwei Level-3 Zauber – 1× pro kurzer Rast ohne Schlitz.",

  // ── Artificer ─────────────────────────────────────────────────────────────
  "Magical Tinkering": "Kleinen Gegenstand mit Licht, Aufzeichnung, Geruch, Bild oder Ton verzaubern.",
  "Infuse Item": "Imbue items with magical infusions — choose from a list each long rest. Infusions last until you prepare new ones.",
  "The Right Tool for the Job": "1 Stunde Arbeit: erschaffe Diebstahlwerkzeug oder Handwerkerszeug aus Komponenten.",
  "Tool Expertise": "Doppelter Kompetenzbonus auf Werkzeugproben.",
  "Flash of Genius": "Reaktion wenn Verbündeter in 30 Fuß eine Probe oder Rettungswurf sieht: +INT-Mod addieren. INT-Mod× pro langer Rast.",
  "Magic Item Adept": "Attune up to 4 magic items simultaneously. Craft common/uncommon items in half the time.",
  "Spell-Storing Item": "Speichere einen Zauber (Level 1-2) in einem Objekt. Träger kann ihn beliebig oft wirken bis der Vorrat leer ist.",
  "Magic Item Savant": "Attune up to 5 magic items. Ignore class/race/spell/level requirements for attuning.",
  "Magic Item Master": "Attune up to 6 magic items simultaneously.",
  "Soul of Artifice": "+1 auf alle Rettungswürfe pro attuned magic item. Reaktion bei 0 HP: auf 1 HP bleiben (1 Attunement beenden).",
};

window.FeatureDesc = FeatureDesc;

// Tooltip-Text für ein Feature abrufen
window.getFeatureTooltip = function(featureName) {
  return FeatureDesc[featureName] || null;
};
