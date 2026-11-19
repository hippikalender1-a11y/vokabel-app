import { ORDNER_KNOPF, ORDNER_TIEFE_MAX, RASTER_FREI_ZEILEN, ebeneVon, ebenenSpalten, eintraegeImOrdner, ordneRaster, ordnerPfad, rasterGroesse, rueckendeIds, zahlDe } from "../raster.js";
import { Fragment } from "react";
import { BLITZ_MS, SK, TYPEN, lsGet, lsLesen } from "../speicher.js";
import { listenInhalt } from "../saetze.js";
import { GRUPPE, gruppe, inGruppe, schliesseInfo, zeigeInfo } from "../infoEreignisse.js";
import { heuteAnteil, istFaellig, slotKonfigArt, slotSFAlle, tagesSperre } from "../quiz.jsx";
import { sprachKuerzelFuer } from "../sprache.js";

// 276: Fortschrittsbalken der Kacheln – die fälligen (Übersetzung) liegen am Anfang der Füllung „hohl“: eine dünne Linie
// in der Farbe der Kachel (Maske schneidet sie aus Balken und Füllung heraus). n = Anzahl fällige, ges = alle Vokabeln.
function faelligZahl(voks) { const jetzt = Date.now(); return voks.filter(v => !v.herausgenommen && istFaellig(v.fortschritt, jetzt)).length; }
function kachelBalken(pct, n, ges) {
  const f = ges > 0 && n > 0 ? Math.min(pct, n / ges * 100) : 0;
  const maske = f > 0 ? `linear-gradient(to right, #000 1.5px, transparent 1.5px, transparent ${f}%, #000 ${f}%), linear-gradient(to bottom, #000 2px, transparent 2px, transparent calc(100% - 2px), #000 calc(100% - 2px))` : undefined;
  return (
    <span className={`kachel-balken${pct >= 100 ? " voll" : ""}`} data-kachel-faellig={n || undefined}
      style={maske ? { WebkitMaskImage: maske, maskImage: maske } : undefined}><span style={{width:`${pct}%`}}/></span>
  );
}

// Phase 2 (Aufteilung): Zeichen-Funktionen aus App.jsx. app = die Namen der Komponente, die sie brauchen.

// Plätze des Listen-Rasters für die Listenauswahl in Quiz und Statistik: gleiche Spalten und Plätze
// wie im Listen-Tab (leere Plätze bleiben frei); mit Sprachfilter zusammengerückt
// 193: die geöffnete Ebene (Listen-Ordner) – Ordner kommen als { istOrdner } mit
// 256: Lesereihenfolge der gespeicherten Plätze (Zeile, dann Spalte) – für die lückenlose Anzeige
// 256/292: automatische Anordnung – spaltenweise (wie „Anordnen…“ und Von–Bis): Spalte für Spalte von oben nach unten
const lueckenlosReihe = eintraege => [...eintraege].filter(e => e.platz).sort((a, b) => a.platz.s - b.platz.s || a.platz.z - b.platz.z);
const autoPlatz = (i, n, spalten) => { const zeilen = Math.max(1, Math.ceil(n / spalten)); return `${i % zeilen}|${Math.floor(i / zeilen)}`; };

export function listenRasterPlaetze(app) {
  const { listenIndex, listenOrdner, listenOrdnerOffen, minSpalten, sichtbareListen, sprachFilter } = app;
    const daten = { ordner: listenOrdner, gespeichert: listenIndex };
    const ebene = ebeneVon(daten, listenOrdnerOffen);
    const sichtbarIds = new Set(sichtbareListen.map(l => l.id));
    const sichtbar = x => x.istOrdner ? (sprachFilter === "alle" || eintraegeImOrdner(daten, x.id).length === 0 || eintraegeImOrdner(daten, x.id).some(l => sichtbarIds.has(l.id))) : sichtbarIds.has(x.id);
    if (sprachFilter !== "alle") return { spalten: 1, plaetze: [...ebene].filter(sichtbar)
      .sort((a, b) => (a.platz?.z ?? 0) - (b.platz?.z ?? 0) || (a.platz?.s ?? 0) - (b.platz?.s ?? 0)).map(l => ({ key: l.id, l })) };
    const platzMap = new Map(ebene.filter(l => l.platz).map(l => [`${l.platz.z}|${l.platz.s}`, l]));
    const zeilen = ebene.reduce((m, l) => Math.max(m, (l.platz?.z ?? 0) + 1), 0);
    const anz = ebenenSpalten(ebene, false, minSpalten("liste", listenOrdnerOffen));   // 196/203
    const plaetze = [];
    for (let z = 0; z < zeilen; z++) for (let sp = 0; sp < anz; sp++) plaetze.push({ key: `${z}|${sp}`, l: platzMap.get(`${z}|${sp}`) || null });
    return { spalten: anz, plaetze };
  }

// 193: Listenauswahl (Quiz/Statistik) – Pfad über dem Raster (nur, wenn es Listen-Ordner gibt) und Ordner-Kacheln
export function listenAuswahlPfad(app) {
  const { listenOrdner, listenOrdnerOffen, setListenOrdnerOffen, tt } = app;
    if (!listenOrdner.length) return null;
    const pfad = ordnerPfad(listenOrdner, listenOrdnerOffen);
    // 197: nur die aktuelle Ebene schlicht, darüber gelbe Knöpfe
    const schlicht = {fontSize:"0.72rem", color:"var(--text2)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em", cursor:"default",
      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0, background:"none", border:"none", padding:"4px 0", fontFamily:"inherit"};
    const knopf = {fontSize:"0.75rem", padding:"4px 10px", ...ORDNER_KNOPF, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0};
    return (
      <div data-listen-auswahl-pfad style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:8}}>
        <button className={pfad.length ? "typ-btn" : undefined} data-alle-listen-auswahl style={pfad.length ? knopf : schlicht}
          onClick={() => setListenOrdnerOffen(null)} {...tt("Alle Listen (oberste Ebene)")}>{pfad.length ? "← Alle Listen" : "Alle Listen"}</button>
        {pfad.map((o, i) => (<Fragment key={o.id}>
          <span aria-hidden="true" style={{fontSize:"0.72rem", color:"var(--text3)"}}>›</span>
          <button className={i === pfad.length - 1 ? undefined : "typ-btn"} data-listen-auswahl-ordner={o.id} onClick={() => setListenOrdnerOffen(o.id)}
            style={i === pfad.length - 1 ? schlicht : { ...knopf, maxWidth: "45%" }} {...tt(`Ordner „${o.name}“`)}>📁 {o.name}</button>
        </Fragment>))}
      </div>
    );
  }

export function auswahlOrdnerZelle(app, o, key, gewaehlt, kurz = false) {
  const { listenIndex, listenOrdner, setListenOrdnerOffen, tt, vokabelAnzahl } = app;
    const drin = eintraegeImOrdner({ ordner: listenOrdner, gespeichert: listenIndex }, o.id);
    const n = drin.filter(l => gewaehlt(l.id)).length;
    const vok = drin.reduce((m, l) => m + vokabelAnzahl(l.id), 0);   // 210
    return (
      <div key={key} className="quiz-setup-check ordner-kachel eckig" data-auswahl-lordner={o.id} style={{padding:"10px 16px"}}
        onClick={() => setListenOrdnerOffen(o.id)} {...tt(`Ordner „${o.name}“ öffnen`)}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontWeight:600, fontSize:"0.9rem"}}>📁 {o.name}</div>
          <div style={{fontSize:"0.78rem", color:"var(--text2)", marginTop:2}} data-vok-anzahl={vok}>{zahlDe(drin.length)} {kurz ? "L." : `Liste${drin.length !== 1 ? "n" : ""}`} · {zahlDe(vok)} {kurz ? "V." : "Vokabeln"}{n ? ` · ${n} gewählt` : ""}</div>
        </div>
      </div>
    );
  }

// 193: Pfad über den Listen – „Alle Listen › 📁 A › 📁 B“ (gelb), lang drücken: neue Liste / neuer Ordner hier
export function listenNavi(app) {
  const { slotEbenenMenue, listenEbenenMenue, headerH, listenKopfH, listenOrdner, listenOrdnerOffen, listenSortModus, listenWahl, minSpalten, pfadTeile, quizListenUmschalter, resetImport, setAnordnen, setAnsicht, setInGruppe, setListeVorschau, setListenAuswahl, setListenOrdnerOffen, setListenSortModus, setListenWahl, setSpaltenWahl, setTab, slotH, slotInfoH } = app;
    const neuerOrdner = eltern => ordnerPfad(listenOrdner, eltern).length < ORDNER_TIEFE_MAX
      ? [{ label: "📁 Neuer Ordner", fn: () => setInGruppe({ art: "liste", ids: [], name: "", eltern }) }] : [];
    const neueListe = eltern => ({ label: "＋ Neue Liste", fn: () => { setListenOrdnerOffen(eltern); resetImport(); setTab("listen"); setAnsicht("import"); } });
    const geheZu = id => { setListenOrdnerOffen(id); setListenSortModus(false); setListenAuswahl([]); setListeVorschau(null); setListenWahl(null); };
    const anordnenL = ordnerId => ({ label: "⇅ Anordnen…", fn: () => setAnordnen({ art: "liste", ordner: ordnerId }) });   // 208
    const spaltenL = ordnerId => ({ label: `▥ Spalten (${minSpalten("liste", ordnerId)})`, fn: () => setSpaltenWahl({ art: "liste", ordner: ordnerId }) });   // 203/225
    return (
      <div data-ordner-navi="liste" style={{display:"flex", alignItems:"center", gap:8, marginBottom:8, minHeight:30, position:"sticky", top: headerH + slotH + slotInfoH, zIndex: 7, background:"var(--hintergrund)", padding:"6px 0"}}>
        {pfadTeile({ alleText: "Alle Listen", alleAttr: "data-alle-listen", pfad: ordnerPfad(listenOrdner, listenOrdnerOffen), geheZu,
          alleTt: listenOrdnerOffen ? "Zurück zu allen Listen – Listen hierher ziehen legt sie auf die oberste Ebene; lang drücken: neue Liste, neuer Ordner"
            : "Alle Listen – lang drücken: neue Liste, neuer Ordner",
          alleAktionen: listenEbenenMenue(null, { voll: !listenOrdnerOffen }), ordnerAktionen: o => listenEbenenMenue(o.id, { voll: o.id === listenOrdnerOffen }), einheit: "Listen" })}   {/* 248 */}
        {!listenSortModus && quizListenUmschalter()}
      </div>
    );
  }

// 274/277–283, 288: Auswahl-Tafel im Quiz-Tab – oben das Schalter-Raster (wie die Schalter im Quiz-Tab: Vokabeln breit,
// darunter Negative · Gelernt / Heute · Fällige); Multiquiz, Fällige wiederholen und Negative abfragen entfallen dort
// (der Kopf lädt die Auswahl); unten nur eine kleine Zeile (🎨 · Ablage › · Von–Bis). art: "slot" (ids = Quiz) | "liste" (ids = Listen)
export function mitSchalterRaster(app, d, art, ids) {
  const { waehleListenBereich, alsQuizSpeichern, setListenWahl, schalterZaehlung, quizGrund, setQuizGrund, quizNegativ, setQuizNegativ, quizGelerntEinschliessen, setQuizGelerntEinschliessen, quizHeuteEinschliessen, setQuizHeuteEinschliessen, quizFaellig, setQuizFaellig, zeigeAuswahlTafel, slots, tab } = app;
  if (!d || tab !== "quiz" || !ids.length) return d;
  const z = schalterZaehlung(ids, art);
  const sk = sprachKuerzelFuer(art === "liste" ? ids : [...new Set(ids.flatMap(id => slots.gespeichert.find(g => g.id === id)?.konfiguration?.listenIds || []))]);
  const nur = art === "liste" ? (ids.length >= 2 ? "diese Listen" : "diese Liste") : ids.length >= 2 ? "diese Quiz" : "dieses Quiz";
  // 277: zusätzliche (Gelernt, Heute, Fällige) eingeschaltet mit „+“
  const s = (k, label, n, an, set, frei, extra = {}) => ({ label: `${an && n > 0 && ["gelernt", "heute", "faellig"].includes(k) ? "+ " : ""}${label} (${n})`, raster: true, schalter: k, an,
    aus: !frei || (n === 0 && k !== "faellig"), fn: () => set(v => !v), ...extra });
  const zurueck = () => setTimeout(() => zeigeAuswahlTafel(art), 0);
  const raster = [
    s("grund", "Neue", z.grund, quizGrund, setQuizGrund, true, { breit: true }),   // 282; 301: „Neue“ – den Bereich wählt die Anzahl im Kopf
    s("negativ", "✗ Negative", z.negativ, quizNegativ, setQuizNegativ, true),
    s("gelernt", "✓ Gelernt", z.gelernt, quizGelerntEinschliessen, setQuizGelerntEinschliessen, z.faelligMoeglich),
    s("heute", "Heute", z.heute, quizHeuteEinschliessen, setQuizHeuteEinschliessen, tagesSperre()),
    s("faellig", "🔁 Fällige", z.faellig, quizFaellig.an, null, z.faelligMoeglich && z.pool > 0, {
      fn: () => setQuizFaellig(f => ({ ...f, an: !f.an })),
      // lang drücken: dieselben Einstellungen wie im Quiz-Tab (Herkunft, Anteil); danach zurück zur Tafel
      lang: (x, y) => zeigeInfo(`🔁 Fällige: ${quizFaellig.anteil} % zusätzlich zu den anderen, aus ${quizFaellig.modus === "sprache" ? `allen Listen (${sk})` : nur} – jetzt ${z.pool} fällig`, x, y, [
        { label: `${quizFaellig.modus === "sprache" ? "◉" : "○"} Alle ${sk || "der Sprache"}`, fn: () => { setQuizFaellig(f => ({ ...f, modus: "sprache" })); zurueck(); } },
        { label: `${quizFaellig.modus === "quiz" ? "◉" : "○"} Nur ${nur}`, fn: () => { setQuizFaellig(f => ({ ...f, modus: "quiz" })); zurueck(); } },
        { label: "‹ zurück", zurueckTafel: true, fn: zurueck }],
        { regler: { label: "Anteil (zusätzlich zu den anderen)", min: 5, max: 100, step: 5, wert: quizFaellig.anteil, format: v => `${v} %`, aendern: v => setQuizFaellig(f => ({ ...f, anteil: v })) } }),
    }),
  ];
  const LERNEN_ALT = /^(🧩 Multiquiz|🔁 |✗ Negative abfragen)/;
  const ohneLernen = akt => akt.map(a => a?.gruppe ? { ...a, gruppe: a.gruppe.filter(u => !LERNEN_ALT.test(u.label)) } : a)
    .filter(a => a && !LERNEN_ALT.test(a.label) && !(a.gruppe && !a.gruppe.length));
  // 281: einzelne Aktionen in die Ablage (vorne) – unten bleibt eine kleine Zeile; 288: bei Listen alle außer Von–Bis
  const AB = `${GRUPPE.ablage} ›`, istL = a => a.label === "📝 Vokabeln ändern";
  const nachAblage = a => !a.gruppe && !a.farbe && (art === "liste" ? a.label !== "↔ Von–Bis" && !a.label.startsWith("📂") && !a.label.startsWith("💾") : istL(a));   // Öffnen bleibt (wie beim Quiz-Ordner)
  const inAblage = akt => {
    const ausGruppen = art === "slot" ? akt.flatMap(a => a.gruppe && a.label !== AB ? a.gruppe.filter(istL) : []) : [];   // z. B. aus „Inhalt ›“
    const weg = [...akt.filter(nachAblage), ...ausGruppen];
    if (!weg.length) return akt;
    const ohne = akt.filter(a => !nachAblage(a)).map(a => a.gruppe && a.label !== AB ? { ...a, gruppe: a.gruppe.filter(u => !istL(u)) } : a).filter(a => !(a.gruppe && !a.gruppe.length));
    if (!ohne.some(a => a.gruppe && a.label === AB)) return [{ label: AB, gruppe: weg }, ...ohne];
    return ohne.map(a => a.gruppe && a.label === AB ? { ...a, gruppe: [...weg, ...a.gruppe] } : a);
  };
  const speichern = art === "liste" ? [{ label: "💾 Als Quiz speichern", fn: () => alsQuizSpeichern() }] : [];   // 298
  return { ...d, aktionen: [...raster, ...inAblage(ohneLernen([...d.aktionen, ...speichern]))] };
}

export function renderListenRaster(app) {
  const { tab, ladeSlotStatistik, statistikAktiverSlot, wahlListenIds, slotEbenenMenue, listenEbenenMenue, vonBis, merkeVerschieben, zugRand, aktiverSlot, angehoben, auswahlTafel, auswahlTafelDaten, auswahlTafelRef, blaettern, blitzt, einstellungen, gruppenZiel, lasso, lernstandJeArt, leuchte, listeVorschau, listenAuswahl, listenFlagge, listenIndex, listenMenue, listenOrdner, listenOrdnerOffen, listenSortModus, listenWahl, listenWahlMenue, loeseListenOrdnerAuf, minSpalten, neuListePlatzRef, oeffneListeDetail, plaetzeRef, renderMiniKreise, resetImport, satzStand, setAnsicht, setBlaettern, setInGruppe, setListeVorschau, setListenAuswahl, setListenOrdnerOffen, setListenSortModus, setListenWahl, setOrdnerUmbenennen, setSlotVorschau, setTab, setVonBis, setzeListenPlaetze, sichtbareListen, slotDragId, slotDragZiel, slotGezogenRef, slotVorschau, slotZiehenRef, sprachFilter, tt, uebernimmListe, verschiebeListenInOrdner, verweilGeht, vokabelAnzahl, wahlUmschaltenRef } = app;
    const groesse = rasterGroesse(einstellungen, "listenRaster");
    // 193: die geöffnete Ebene (oberste oder ein Ordner) – Ordner-Kacheln und Listen
    const ordnerDaten = { ordner: listenOrdner, gespeichert: listenIndex };
    const offen = listenOrdnerOffen;
    const ebene = ebeneVon(ordnerDaten, offen);
    const sichtbarIds = new Set(sichtbareListen.map(l => l.id));
    const ordnerListen = id => eintraegeImOrdner(ordnerDaten, id);
    const sichtbarE = x => x.istOrdner ? (sprachFilter === "alle" || ordnerListen(x.id).length === 0 || ordnerListen(x.id).some(l => sichtbarIds.has(l.id))) : sichtbarIds.has(x.id);
    const hoch = offen ? listenOrdner.find(o => o.id === offen)?.ordner || null : null;
    const ordnerHierGeht = ordnerPfad(listenOrdner, offen).length < ORDNER_TIEFE_MAX;
    plaetzeRef.current.liste = ebene.filter(x => !x.istOrdner && sichtbarE(x)).map((l, i) => ({ id: l.id, z: l.platz?.z ?? i, s: l.platz?.s ?? 0 }));
    const gefiltert = sprachFilter !== "alle";
    const sortModus = listenSortModus && !gefiltert;
    const minS = minSpalten("liste", offen);   // 203
    // 291: automatische Anordnung – genau die gewählte Spaltenzahl (gespeicherte Plätze weiter rechts zählen nicht)
    const anzSpalten = gefiltert ? 1 : einstellungen.lueckenlos && !sortModus ? Math.max(1, minS || 1) : ebenenSpalten(ebene, sortModus && zugRand !== false, minS);   // 196; 231: beim Finger-Zug erst am Rand
    // Kachel-Aufbau nur nach den belegten Spalten: die freie Spalte beim Verschieben darf ihn nicht ändern
    // (sonst baut React den Inhalt unter dem Finger neu auf und das Ziehen verliert den Finger)
    const eng = (gefiltert ? 1 : ebenenSpalten(ebene, false, minS)) > 1;
    const tippeImRaster = (l, platz) => {
      if (slotGezogenRef.current) { slotGezogenRef.current = false; return; }
      if (l) { setListenAuswahl(a => a.includes(l.id) ? a.filter(x => x !== l.id) : [...a, l.id]); return; }
      if (listenAuswahl.length) { merkeVerschieben(); setzeListenPlaetze(listenAuswahl, platz); }   // 239
    };
    // 225: Listen im Quiz-Tab – antippen fragt die Liste ab (Blätter-Modus: nur wählen, Kopf „📋 … laden“)
    const oeffne = l => {
      if (vonBis?.art === "liste") { wahlUmschaltenRef.current("liste", l.id); return; }   // 243: Von–Bis – antippen wählt das Ende
      if (listenWahl) {   // 234: Antippen in der Auswahl – sie beginnt neu mit dieser Liste
        auswahlTafelRef.current = "liste"; setListenWahl([l.id]);
        leuchte(`lw:${l.id}`, BLITZ_MS / 2);
      } else if (blaettern) {
        leuchte(`lw:${l.id}`, BLITZ_MS / 2);
        setSlotVorschau({ typ: "listen", id: l.id });
      } else if (tab === "statistik") ladeSlotStatistik("listen", l.id);   // 294: Statistik der Liste
      else uebernimmListe(l.id);
    };
    const geladenL = tab === "statistik" ? statistikAktiverSlot : aktiverSlot;
    const gewaehltL = l => slotVorschau ? slotVorschau.typ === "listen" && slotVorschau.id === l.id : geladenL?.typ === "listen" && geladenL.id === l.id;
    const menue = l => listenMenue(l);
    // Auswahl-Modus: Aktionen für die Auswahl (Lang-Druck auf eine nicht gewählte Liste nimmt sie dazu)
    const wahlMit = l => listenWahl.includes(l.id) ? listenWahl : [...listenWahl, l.id];
    const wahlMenue = listenWahlMenue;
    const wahlNamen = ids => ids.map(id => { const o = listenOrdner.find(x => x.id === id); return o ? `📁 ${o.name}` : listenIndex.find(x => x.id === id)?.name; }).filter(Boolean).join(", ");
    // Menü eines Listen-Ordners (Auswahl-Tafel bzw. Rechtsklick)
    const lordnerMenue = o => {
      const drin = ordnerListen(o.id), unter = listenOrdner.filter(u => u.ordner === o.id).length;
      return [   // 235: direkt Öffnen; Ablage gruppiert
        { label: "📂 Öffnen", fn: () => { setListenOrdnerOffen(o.id); setListeVorschau(null); } },
        ...gruppe(GRUPPE.ablage, [
          { label: "✎ Umbenennen", fn: () => setOrdnerUmbenennen({ art: "liste", id: o.id, name: o.name }) },
          !gefiltert && { label: "⇄ Verschieben", fn: () => { setListenWahl(null); setListenSortModus(true); setListenAuswahl([o.id]); } },
          { label: "📁 In Ordner…", fn: () => setInGruppe({ art: "liste", ids: [o.id], name: "" }) },
          offen && { label: "↑ Aus dem Ordner", fn: () => verschiebeListenInOrdner([o.id], hoch) },
          ordnerPfad(listenOrdner, o.id).length < ORDNER_TIEFE_MAX && { label: "📁 Neuer Ordner darin", fn: () => setInGruppe({ art: "liste", ids: [], name: "", eltern: o.id }) },
          (drin.length || unter) ? { label: "📤 Ordner auflösen", fn: () => loeseListenOrdnerAuf(o.id) } : { label: "🗑 Ordner löschen", gefahr: true, fn: () => loeseListenOrdnerAuf(o.id) },
        ]),
      ];
    };
    // Auswahl-Tafel: eine Liste → ihr Menü, mehrere → Aktionen für die Auswahl
    // 241: „☑ Alle auswählen“ (sichtbare Listen dieser Ebene) unter Ablage; „Auswahl beenden“ entfällt (Quiz/Listen-Knopf beendet sie)
    const alleWahl = { label: "☑ Alle auswählen", behalten: true, fn: () => (auswahlTafelRef.current = "liste", setListenWahl(a => [...(a || []), ...plaetzeRef.current.liste.map(x => x.id).filter(id => !(a || []).includes(id))])) };   // Tafel geht mit der neuen Auswahl wieder auf
    const tafelInhalt = ids => {
      const o = ids.length === 1 && listenOrdner.find(x => x.id === ids[0]);   // 234: ein Ordner → sein Menü
      if (o) return { text: `📁 ${o.name}`, aktionen: inGruppe(lordnerMenue(o), GRUPPE.ablage, alleWahl) };
      const l = ids.length === 1 && listenIndex.find(x => x.id === ids[0]);
      if (l) return { text: l.name, aktionen: [...inGruppe(menue(l).filter(a => a.label !== "☑ Auswählen"), GRUPPE.ablage, alleWahl), { label: "↔ Von–Bis", behalten: true, fn: () => setVonBis({ art: "liste", id: l.id }) }] };
      return ids.length ? { text: `${ids.length} ausgewählt: ${wahlNamen(ids)}`, aktionen: inGruppe(wahlMenue(ids), GRUPPE.ablage, alleWahl) } : { text: "Nichts ausgewählt – Listen antippen", aktionen: [] };
    };
    auswahlTafelDaten.current.liste = () => listenWahl && mitSchalterRaster(app, tafelInhalt(listenWahl), "liste", wahlListenIds(listenWahl));   // 288: wie die Quiz-Auswahl
    // 246: Vorschau – wer beim Ablegen hier nach unten rücken würde (nicht, wenn gleich ein Ordner entsteht)
    const rueckL = slotDragId && gruppenZiel !== slotDragZiel
      ? rueckendeIds(ebene, listenAuswahl.includes(slotDragId) ? listenAuswahl : [slotDragId], slotDragZiel) : new Set();
    const zelle = (l, key, ziehIdsL = []) => {
      const anzahl = vokabelAnzahl(l.id);
      const liste = lsLesen(SK.liste(l.id));
      // 202: Inhalt kurz – Beispielsätze (gesamt) und Synonyme, nur was vorhanden ist
      const inh = listenInhalt(liste, satzStand);
      const inhaltKurz = <span data-listen-inhalt={`${inh.saetze}|${inh.synonyme}`}>{inh.saetze ? ` · 💬 ${inh.saetze}` : ""}{inh.synonyme ? ` · ≈ ${inh.synonyme}` : ""}</span>;
      const aktSpalten = liste ? TYPEN.filter(t => liste.spalten[t].aktiv) : [];
      const ziel = slotDragZiel === key && slotDragId && slotDragId !== l.id;
      // Lang-Druck (Maus: Rechtsklick): Liste kommt in die Auswahl, die Tafel bleibt unten offen (weitere antippen wählt mit aus);
      // Touch (234): kurz halten wählt aus (weiterfahren sammelt ein), lang halten verschiebt
      const tafel = tafelInhalt(listenWahl ? wahlMit(l) : [l.id]);
      const erklaerung = sortModus && !listenWahl ? tt(`${l.name} – antippen markiert (mehrere möglich), dann freien Platz antippen; oder direkt ziehen – markierte wandern zusammen`)
        : tt(`${l.name} – antippen: abfragen; kurz halten: auswählen (weitere kurz halten: dazu/heraus, weiterfahren: einsammeln; übernehmen mit dem grünen Kopf); lang halten: verschieben (Maus: Rechtsklick wählt aus)`,
          tafel.aktionen, { langText: tafel.text, auswahl: auswahlTafel("liste"), eigeneGeste: true,
            beimMenue: () => wahlUmschaltenRef.current("liste", l.id) });
      return (
        <div {...erklaerung} key={key} data-raster-zelle={gefiltert ? undefined : key} data-liste-id={l.id} data-auswahl-durchlass
          className={`karte-zeile${(listenAuswahl.includes(l.id) && sortModus) || listenWahl?.includes(l.id) || (lasso?.art === "liste" && lasso.ids.includes(l.id)) || (!listenWahl && gewaehltL(l)) ? " kachel-gewaehlt" : ""}${blitzt(`lw:${l.id}`)}`}
          data-kachel-geste={sortModus ? undefined : "liste"} data-kachel-zieh={sortModus || gefiltert ? undefined : ""} data-angehoben={angehoben === l.id ? "" : undefined} data-rueckt={rueckL.has(l.id) ? "" : undefined}
          style={{cursor: sortModus ? "grab" : "pointer", ...(sortModus ? {touchAction:"none"} : {}),
            ...(slotDragId && (slotDragId === l.id || (listenAuswahl.includes(slotDragId) && listenAuswahl.includes(l.id))) ? {opacity:0.4, borderStyle:"dashed"} : {}),
            ...(ziel ? {outline:"3px dashed var(--bestaetigen)", outlineOffset:-3} : {}), position:"relative"}}
          onPointerDown={sortModus ? (e => { slotZiehenRef.current = { art: "liste", id: l.id, x: e.clientX, y: e.clientY, aktiv: false }; }) : undefined}
          onClick={() => sortModus ? tippeImRaster(l, l.platz) : (slotGezogenRef.current ? (slotGezogenRef.current = false) : oeffne(l))}>
          {sortModus && listenAuswahl.includes(l.id) && <span className="auswahl-nr" data-auswahl-nr>{listenAuswahl.indexOf(l.id) + 1}</span>}
          {listenWahl?.includes(l.id) && <span className="auswahl-nr" data-wahl-nr={listenWahl.indexOf(l.id) + 1}>{listenWahl.indexOf(l.id) + 1}</span>}
          {ziel && ziehIdsL.length > 0 && verweilGeht(true, l.id, ziehIdsL) ? ring(key) : null}
          {eng ? (
            <div className="karte-zeile-info">
              <div className="karte-zeile-name">{listenFlagge(l)}{l.name}</div>
              <div className="karte-zeile-sub">{anzahl} Vokabel{anzahl !== 1 ? "n" : ""}{inhaltKurz}</div>
              {(einstellungen.gelerntSchwelle ?? 0) > 0 && liste?.vokabeln.length > 0 && (
                <span className="mini-kreise" data-listen-kreise style={{marginTop:4}}>{renderMiniKreise(lernstandJeArt(liste.vokabeln, liste.id), { groesse: anzSpalten >= 4 ? 16 : 22 })}</span>
              )}
            </div>
          ) : (<>
                  <div className="karte-zeile-info">
                    <div className="karte-zeile-name">{listenFlagge(l)}{l.name}</div>
                    <div className="karte-zeile-sub">
                      {anzahl} Vokabel{anzahl !== 1 ? "n" : ""}{inhaltKurz}{" "}
                      {aktSpalten.map(t => <span key={t} className="spalten-badge aktiv">{liste.spalten[t].name || t}</span>)}
                    </div>
                  </div>
                  {(einstellungen.gelerntSchwelle ?? 0) > 0 && liste?.vokabeln.length > 0 && (
                    <span className="mini-kreise" data-listen-kreise style={{flexShrink:0}}>{renderMiniKreise(lernstandJeArt(liste.vokabeln, liste.id), { groesse: 26 })}</span>
                  )}

          </>)}
        </div>
      );
    };
    // 193/234: Ordner-Kachel (Listen): antippen öffnet (Auswahl endet), kurz halten wählt aus (Menü), lang halten verschiebt
    const ziehIds = slotDragId ? (listenAuswahl.includes(slotDragId) ? listenAuswahl : [slotDragId]) : [];
    const ring = key => (<span className={`gruppen-ring${gruppenZiel === key ? " fertig" : ""}`} data-gruppen-ring={gruppenZiel === key ? "fertig" : "laeuft"}>
      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/></svg><span data-ring-symbol={gruppenZiel === key ? "ordner" : "einfuegen"}>{gruppenZiel === key ? "📁" : "↓"}</span></span>);
    const kurzL = (gefiltert ? 1 : einstellungen.lueckenlos && !sortModus ? Math.max(1, minS || 1) : ebenenSpalten(ebene, false, minS)) > 1;   // 291   // 210: ab 2 Spalten „L.“ / „V.“
    const ordnerZelle = (o, key) => {
      const drin = ordnerListen(o.id);
      const vokDrin = drin.reduce((m, l) => m + vokabelAnzahl(l.id), 0);
      const unter = listenOrdner.filter(u => u.ordner === o.id).length;
      const ziel = slotDragZiel === key && slotDragId && slotDragId !== o.id;
      const wahlNr = listenWahl ? listenWahl.indexOf(o.id) + 1 : 0;
      const tafel = tafelInhalt(listenWahl ? wahlMit(o) : [o.id]);   // 234: wie Listen auswählbar
      return (
        <div key={key} data-raster-zelle={gefiltert ? undefined : key} data-lordner-id={o.id} data-auswahl-durchlass
          className={`karte-zeile ordner-kachel${(sortModus && listenAuswahl.includes(o.id)) || wahlNr || (lasso?.art === "liste" && lasso.ids.includes(o.id)) ? " kachel-gewaehlt" : ""}`}
          data-kachel-geste={sortModus ? undefined : "lordner"} data-kachel-zieh={sortModus || gefiltert ? undefined : ""} data-angehoben={angehoben === o.id ? "" : undefined} data-rueckt={rueckL.has(o.id) ? "" : undefined}
          style={{cursor: sortModus ? "grab" : "pointer", ...(sortModus ? {touchAction:"none"} : {}), position:"relative",
            ...(slotDragId && (slotDragId === o.id || (listenAuswahl.includes(slotDragId) && listenAuswahl.includes(o.id))) ? {opacity:0.4, borderStyle:"dashed"} : {}),
            ...(ziel ? {outline:"3px dashed var(--bestaetigen)", outlineOffset:-3} : {})}}
          onPointerDown={sortModus ? (e => { slotZiehenRef.current = { art: "liste", id: o.id, x: e.clientX, y: e.clientY, aktiv: false }; }) : undefined}
          onClick={() => sortModus ? tippeImRaster(o, o.platz) : (slotGezogenRef.current ? (slotGezogenRef.current = false) : (setListenOrdnerOffen(o.id), setListeVorschau(null)))}   // 234: öffnen – die Auswahl endet
          {...(sortModus ? tt(`Ordner „${o.name}“ – antippen markiert, dann freien Platz antippen; oder direkt ziehen`)
            : tt(`Ordner „${o.name}“ mit ${drin.length} Liste${drin.length !== 1 ? "n" : ""} – antippen öffnet ihn; kurz halten: auswählen (zählt mit seinem ganzen Inhalt); lang halten: verschieben`, tafel.aktionen,
              { langText: tafel.text, auswahl: auswahlTafel("liste"), eigeneGeste: true, beimMenue: () => wahlUmschaltenRef.current("liste", o.id) }))}>
          {sortModus && listenAuswahl.includes(o.id) && <span className="auswahl-nr" data-auswahl-nr>{listenAuswahl.indexOf(o.id) + 1}</span>}
          {wahlNr ? <span className="auswahl-nr" data-wahl-nr={wahlNr}>{wahlNr}</span> : null}
          <div className="karte-zeile-info">
            <div className="karte-zeile-name"><span aria-hidden="true">📁 </span>{o.name}</div>
            <div className="karte-zeile-sub" data-ordner-anzahl={drin.length} data-vok-anzahl={vokDrin}>{zahlDe(drin.length)} {kurzL ? "L." : `Liste${drin.length !== 1 ? "n" : ""}`} · {zahlDe(vokDrin)} {kurzL ? "V." : "Vokabeln"}</div>
          </div>
          {ziel && verweilGeht(true, o.id, ziehIds) ? ring(key) : null}
        </div>
      );
    };
    const zellen = [];
    const ebeneLeer = ebene.length === 0;
    if (gefiltert) {
      [...ebene].sort((a, b) => (a.platz?.z ?? 0) - (b.platz?.z ?? 0) || (a.platz?.s ?? 0) - (b.platz?.s ?? 0)).filter(sichtbarE)
        .forEach(x => zellen.push(x.istOrdner ? ordnerZelle(x, x.id) : zelle(x, x.id)));
    } else {
      // 256: „Lückenlos anzeigen“ – Kacheln in Lesereihenfolge ihrer Plätze ohne Lücken (nur Anzeige; beim Verschieben die echten Plätze)
      const lueckenlos = !!einstellungen.lueckenlos && !sortModus;
      const reihe = lueckenlos ? lueckenlosReihe(ebene) : null;
      const platzMap = lueckenlos ? new Map(reihe.map((l, i) => [autoPlatz(i, reihe.length, anzSpalten), l]))
        : new Map(ebene.filter(l => l.platz).map(l => [`${l.platz.z}|${l.platz.s}`, l]));
      const belegtBis = lueckenlos ? Math.ceil(reihe.length / anzSpalten) : ebene.reduce((m, l) => Math.max(m, (l.platz?.z ?? 0) + 1), 0);
      const alleBelegtL = belegtBis > 0 && (lueckenlos ? reihe.length % anzSpalten === 0
        : ebene.filter(l => l.platz && l.platz.z < belegtBis && l.platz.s < anzSpalten).length >= belegtBis * anzSpalten);   // 214
      const zeilenAnzeige = sortModus ? belegtBis + RASTER_FREI_ZEILEN : Math.max(ebeneLeer && offen ? 1 : 0, belegtBis) + (alleBelegtL ? 1 : 0);
      for (let z = 0; z < zeilenAnzeige; z++) for (let sp = 0; sp < anzSpalten; sp++) {
        const key = `${z}|${sp}`;
        const l = platzMap.get(key);
        const ziel = slotDragZiel === key && slotDragId && !l;
        if (l) zellen.push(l.istOrdner ? ordnerZelle(l, key) : zelle(l, key, ziehIds));
        else if (sortModus) zellen.push(<div key={key} data-raster-zelle={key} className="raster-leer"
          style={{borderStyle:"dashed", cursor: listenAuswahl.length ? "pointer" : "default",
            ...(ziel ? {borderColor:"var(--bestaetigen)", background:"var(--haupt-flaeche)"} : {})}}
          onClick={() => tippeImRaster(null, { z, s: sp })}
          {...tt("Freier Platz – markierte Listen hier untereinander einsetzen (oder Listen hierher ziehen)")}/>);
        else zellen.push(<div key={key} className="raster-leer" data-freier-platz={key} style={ebeneLeer ? {borderStyle:"dashed", opacity:0.5} : {border:"none"}}
          {...tt("Freier Platz – lang drücken: Menü dieser Ebene (Neues landet genau hier)",
            listenEbenenMenue(offen || null, { platz: lueckenlos ? null : { z, s: sp } }))}/>);   // 247; 256: lückenlos ohne festen Platz
      }
    }
    return (<>
      <div className={`listen-raster${eng ? " eng" : ""}${anzSpalten >= 4 ? " schmal" : ""}`} data-lasso={sortModus ? undefined : "liste"} data-raster-spalten-anz={anzSpalten} style={{gridTemplateColumns:`repeat(${anzSpalten}, minmax(0, 1fr))`}}>
        {zellen}
      </div>
    </>);
  }

// Mehrfach-Auswahl bzw. Verschieben: Knöpfe an der Stelle von „＋ Neues Quiz“ / „Alle Listen“ / „＋ Neue Liste“ (gleiche Höhe – die Kacheln bleiben, wo sie sind)
// geöffnete Gruppe: „← Alle Quiz › 📁 Name“ über dem „Neu“-Knopf
// Pfad-Zeile über den Kacheln (immer): „Alle Quiz“ bzw. „← Alle Quiz › 📁 Name“; lang drücken: Neues Quiz, Fällige wiederholen;
// rechts in der Mehrfach-Auswahl „Alle | Keine“, beim Verschieben „Fertig“ – die Zeile bleibt gleich hoch, nichts verrutscht
// 193: Pfad „← Alle … › 📁 A › 📁 B“ (Quiz und Listen): antippen geht in die Ebene, lang drücken zeigt ihr Menü;
// Kacheln auf einen Pfad-Teil ziehen legt sie dorthin (zielUnter: data-ordner-zurueck = oben, data-ordner-ziel = Ordner)
export function pfadTeile(app, { alleText, alleAttr, pfad, geheZu, alleTt, alleAktionen, ordnerAktionen, einheit }) {
  const { listenWahl, multiAuswahl, setListenWahl, setMultiAuswahl, slotDragId, slotDragZiel, tt } = app;
    const offen = pfad.length > 0;
    // 266: während einer Mehrfach-Auswahl: Antippen beendet die Auswahl (und öffnet ggf. den Ordner); lang drücken: Menü wie sonst
    const wahlEnde = () => { if (multiAuswahl) setMultiAuswahl(null); if (listenWahl) setListenWahl(null); };
    const zielStil = an => an && slotDragId ? {outline:"3px dashed var(--bestaetigen)", outlineOffset:-3} : {};
    // 197: nur das letzte Element (die Ebene, in der man ist) schlicht; alles darüber gelbe Knöpfe
    const schlicht = {fontSize:"0.72rem", color:"var(--text2)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em",
      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0, cursor:"pointer", background:"none", border:"none", padding:"4px 0", fontFamily:"inherit"};
    const knopf = {fontSize:"0.75rem", padding:"4px 10px", ...ORDNER_KNOPF, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0};
    const trenner = <span aria-hidden="true" style={{fontSize:"0.72rem", color:"var(--text3)", flexShrink:0}}>›</span>;
    return (
      <span data-ordner-pfad style={{display:"flex", alignItems:"center", gap:6, minWidth:0, flex:1, flexWrap:"wrap", rowGap:4}}>
        <button className={offen ? "typ-btn" : undefined} {...{ [alleAttr]: true }} {...(offen ? { "data-ordner-zurueck": true } : { "data-pfad-hier": true })} data-raus-ziel={slotDragZiel === "raus" ? "" : undefined}
          style={{flexShrink:0, ...(offen ? knopf : schlicht), ...zielStil(slotDragZiel === "raus")}}
          data-auswahl-durchlass onClick={() => { wahlEnde(); if (offen) geheZu(null); }}
          {...tt(alleTt, alleAktionen)}>{offen ? `← ${alleText}` : alleText}</button>
        {pfad.map((o, i) => {
          const letzter = i === pfad.length - 1;
          return (<Fragment key={o.id}>
            {trenner}
            <button className={letzter ? undefined : "typ-btn"} {...(letzter ? { "data-ordner-name": true, "data-pfad-hier": true } : { "data-ordner-ziel": o.id, "data-ordner-pfad-teil": o.id })}
              data-raus-ziel={slotDragZiel === `raus:${o.id}` ? "" : undefined}
              style={{...(letzter ? schlicht : knopf), maxWidth: letzter ? "100%" : "45%", ...zielStil(slotDragZiel === `raus:${o.id}`)}}
              data-auswahl-durchlass onClick={() => { wahlEnde(); if (!letzter) geheZu(o.id); }}
              {...tt(`Ordner „${o.name}“ – ${letzter ? "" : `antippen öffnet ihn, ${einheit} hierher ziehen legt sie hinein; `}lang drücken: Menü des Ordners`, ordnerAktionen(o))}>📁 {o.name}</button>
          </Fragment>);
        })}
      </span>
    );
  }

// 217/222: EIN Umschalt-Knopf in der Pfad-Zeile – zeigt, was im Raster steht („Listen“ bzw. „Quiz“), antippen wechselt;
// so hoch wie der Pfad (zweizeiliger Pfad → zweizeilig hoher Knopf)
export function quizListenUmschalter(app) {
  const { auswahlListen, setAuswahlListen, setBlaettern, setListenSortModus, setListenWahl, setMultiAuswahl, setSlotSortModus, setSlotVorschau, tt } = app;
    return (
      <button className={`typ-btn aktiv${auswahlListen ? " eckig" : ""}`} data-auswahl-umschalter={auswahlListen ? "listen" : "quiz"} data-auswahl-durchlass
        style={{fontSize:"0.75rem", padding:"4px 12px", alignSelf:"stretch", flexShrink:0, minWidth:64}}
        onClick={() => { setAuswahlListen(!auswahlListen); setSlotVorschau(null); setMultiAuswahl(null); setListenWahl(null); setListenSortModus(false); setSlotSortModus(false); setBlaettern(false); }}
        {...tt(auswahlListen ? "Hier stehen die Listen – antippen zeigt die gespeicherten Quiz" : "Hier stehen die gespeicherten Quiz – antippen zeigt die Listen")}>
        {auswahlListen ? "📋 Listen" : "Quiz"}
      </button>
    );
  }

export function ordnerNavi(app, stil, statistik = false) {
  const { slotEbenenMenue, listenEbenenMenue, einstellungen, faelligAlle, faelligVonSlots, headerH, minSpalten, multiAuswahl, neuImOrdnerRef, pfadTeile, quizListenUmschalter, setAnordnen, setInGruppe, setModal, setMultiAuswahl, setNeueSessionSchritt, setSlotAuswahl, setSlotDragId, setSlotDragZiel, setSlotOrdner, setSlotSektionAufgeklappt, setSlotSortModus, setSpaltenWahl, setStatistikGesamt, setStatistikFilter, slotAuswahl, slotH, slotInfoH, slotOrdner, slotSichtbarRef, slotSortModus, slots, speichereEinst, tt } = app;
    const ordnerOffen = (slots.ordner || []).find(o => o.id === slotOrdner) || null;
    const neueSession = imOrdner => ({ label: "＋ Neues Quiz aus Listen", fn: () => { neuImOrdnerRef.current = imOrdner; setNeueSessionSchritt("art"); setModal("neue-session"); } });
    const gelerntUmschalter = { label: einstellungen.gelernteAusblenden ? "👁 Gelernte einblenden" : "🙈 Gelernte ausblenden",
      fn: () => speichereEinst({ ...einstellungen, gelernteAusblenden: !einstellungen.gelernteAusblenden }) };   // 181
    const alleListen = { label: "▦ Alle Listen", fn: () => {
      setStatistikGesamt(true); setSlotSektionAufgeklappt(false);   // Statistik über alle Listen (bis wieder etwas geladen wird)
      setStatistikFilter(new Set(['negativ', 'nie', 'arbeit', 'gelernt'])); } };
    // 194: leeren Ordner anlegen (in der Ebene des Pfad-Teils), solange dort noch einer hineinpasst
    const neuerOrdner = eltern => ordnerPfad(slots.ordner, eltern).length < ORDNER_TIEFE_MAX
      ? [{ label: "📁 Neuer Ordner", fn: () => setInGruppe({ ids: [], name: "", eltern }) }] : [];
    const spaltenAktion = ordnerId => ({ label: `▥ Spalten (${minSpalten("slot", ordnerId)})`, fn: () => setSpaltenWahl({ art: "slot", ordner: ordnerId }) });   // 203
    const anordnenAktion = ordnerId => ({ label: "⇅ Anordnen…", fn: () => setAnordnen({ art: "slot", ordner: ordnerId }) });   // 208
    // 248: volles Menü nur für die sichtbare Ebene; Ordner darüber: Fällige + Gelernte
    const alleAktionen = [...(statistik ? [alleListen] : []), ...slotEbenenMenue(null, { voll: !slotOrdner, ohneNeu: statistik })];
    const ordnerAktionen = o => slotEbenenMenue(o.id, { voll: o.id === slotOrdner, ohneNeu: statistik });
    const markiert = slotAuswahl.length;
    const geheZu = id => { setSlotOrdner(id); setSlotSortModus(false); setSlotAuswahl([]); };
    return (
      <div data-ordner-navi style={{display:"flex", alignItems:"center", gap:8, marginBottom:8, minHeight:30, position:"sticky", top: headerH + slotH + slotInfoH, zIndex: 7, background:"var(--hintergrund)", padding:"6px 0", ...stil}}>
        {pfadTeile({ alleText: "Alle Quiz", alleAttr: "data-alle-sessions", pfad: ordnerPfad(slots.ordner, slotOrdner), geheZu,
          alleTt: ordnerOffen ? "Zurück zu allen Quiz – Quiz hierher ziehen legt sie auf die oberste Ebene; lang drücken: neues Quiz, fällige wiederholen, neuer Ordner"
            : `Alle Quiz – lang drücken: ${statistik ? "alle Listen anzeigen" : "neues Quiz aus Listen"}, fällige wiederholen, neuer Ordner`,
          alleAktionen, ordnerAktionen, einheit: "Quiz" })}
        {!slotSortModus && quizListenUmschalter()}   {/* 294: auch in der Statistik */}   {/* 241: auch in der Auswahl – wechseln beendet sie */}
        {slotSortModus && (
          <button className="typ-btn aktiv" data-slot-fertig style={{fontSize:"0.75rem", padding:"4px 10px", flexShrink:0}}
            onClick={() => { setSlotSortModus(false); setSlotAuswahl([]); setSlotDragId(null); setSlotDragZiel(null); }}
            {...tt("Verschieben beenden")}>Fertig{markiert ? ` · ${markiert}` : ""}</button>
        )}
      </div>
    );
  }

export function wahlLeiste(app, art, stil) {
  const { listenAuswahl, listenSortModus, listenWahl, multiAuswahl, setListenAuswahl, setListenSortModus, setListenWahl, setMultiAuswahl, setSlotAuswahl, setSlotDragId, setSlotDragZiel, setSlotSortModus, sichtbareListen, slotAuswahl, slotSichtbarRef, slotSortModus, tt } = app;
    const liste = art === "liste";
    const wahl = liste ? listenWahl : multiAuswahl, sort = liste ? listenSortModus : slotSortModus;
    const markiert = (liste ? listenAuswahl : slotAuswahl).length;
    return (
      <div className="wahl-leiste" data-wahl-leiste={art} style={stil}>
        {sort && !wahl ? (   // 241: „Alle“ steht im Menü (Ablage), „Keine“ entfällt
          <button className="btn btn-primary" {...(liste ? { "data-listen-fertig": true } : { "data-slot-fertig": true })}
            onClick={() => { if (liste) { setListenSortModus(false); setListenAuswahl([]); } else { setSlotSortModus(false); setSlotAuswahl([]); } setSlotDragId(null); setSlotDragZiel(null); }}
            {...tt("Verschieben beenden – Kacheln antippen markiert (mehrere möglich), dann freien Platz antippen; oder direkt ziehen")}>Fertig{markiert ? ` · ${markiert} markiert` : ""}</button>
        ) : null}
      </div>
    );
  }

// 238: Vokabeln und Lernstand je Quiz-Kachel über das Neuzeichnen hinweg (Ziehen/Einsammeln zeichnet oft neu) –
// neu berechnet nur, wenn sich die Konfiguration oder eine ihrer Listen (lsLesen: dasselbe Objekt, solange unverändert) ändert
const kachelPuffer = new Map();
export function renderSlotBereiche(app, neuChip, onLaden, slotRef, abstand = 0) {
  const { schalterZaehlung, schalterStand, setzeSchalter, quizGrund, setQuizGrund, quizNegativ, setQuizNegativ, quizGelerntEinschliessen, setQuizGelerntEinschliessen, quizHeuteEinschliessen, setQuizHeuteEinschliessen, quizFaellig, setQuizFaellig, zeigeAuswahlTafel, slotEbenenMenue, listenEbenenMenue, vonBis, merkeVerschieben, zugRand, FORTSCHRITT_FELD, aktiverSlot, angehoben, auswahlTafel, auswahlTafelDaten, auswahlTafelRef, blaettern, blitzt, chipStil, einstellungen, faelligVonSlots, gruppenZiel, kopieName, lasso, lernstandJeArt, leuchte, loeseOrdnerAuf, minSpalten, multiAuswahl, multiVonSlot, neuImOrdnerRef, neuPlatzRef, plaetzeRef, quizAbfrageArt, quizArt, renderSlotChip, setAuswahlLoeschen, setBlaettern, setInGruppe, setLoescheSlotNr, setModal, setMultiAuswahl, setNeueSessionSchritt, setOrdnerUmbenennen, setSlotAuswahl, setSlotOrdner, setSlotSektionAufgeklappt, setSlotSortModus, setSlotUmbenennen, setSlotVorschau, setSlotVorschauListe, setVerlaufOffen, setVonBis, setzeSlotPlaetze, slotAuswahl, slotChipLabel, slotDragId, slotDragZiel, slotGezogenRef, slotOrdner, slotSichtbar, slotSichtbarRef, slotSortModus, slotVorschau, slotZiehenRef, slots, sprachFilter, starteMultiquiz, statistikArt, stelleMultiquizEin, tab, tt, ttFeld, uebernimmSlots, verlaufOffen, verschiebeInOrdner, verweilGeht, wahlUmschaltenRef } = app;
    // Lernfortschritt je Art für die Mini-Kreise (jede Liste nur einmal lesen)
    const listenCache = new Map();
    const listeVon = id => { if (!listenCache.has(id)) listenCache.set(id, lsLesen(SK.liste(id))); return listenCache.get(id); };
    const aktArt = tab === "statistik" ? statistikArt : quizArt;
    const kachelEintrag = x => {
      const k = x.konfiguration || {};
      const ids = k.listenIds || [], listen = ids.map(listeVon);
      const sig = `${ids.join(",")}|${k.bereichTyp}|${(k.vokabelAuswahl || []).join(",")}`;
      const alt = kachelPuffer.get(x.id);
      if (alt && alt.sig === sig && alt.listen.length === listen.length && alt.listen.every((l, i) => l === listen[i])) return alt;
      let voks = ids.flatMap((id, i) => (listen[i]?.vokabeln || []).map(v => ({ ...v, _key: `${id}__${v.id}`, _listeId: id })));
      if (k.bereichTyp === "bereich" && k.vokabelAuswahl?.length) { const a = new Set(k.vokabelAuswahl); voks = voks.filter(v => a.has(v._key)); }
      const neu = { sig, listen, voks };
      kachelPuffer.set(x.id, neu);
      return neu;
    };
    const kachelVoks = x => kachelEintrag(x).voks;   // nicht verändern (gepuffert)
    const schwelleLS = einstellungen.gelerntSchwelle ?? 0;
    const lernstand = x => { const e = kachelEintrag(x); if (!e.ls || e.lsSchwelle !== schwelleLS) { e.ls = lernstandJeArt(e.voks); e.lsSchwelle = schwelleLS; } return e.ls; };
    // 181: Anteil der heute (in der gewählten Abfrageart) abgefragten Vokabeln eines Quiz
    const heuteFeld = FORTSCHRITT_FELD[aktArt] || "fortschritt";
    const heuteProzent = x => heuteAnteil(kachelVoks(x).filter(y => !y.herausgenommen), heuteFeld, einstellungen.gelerntSchwelle ?? 0);
    const verlauf = slots.verlauf.filter(slotSichtbar);
    const label = {fontSize:"0.72rem", color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"};
    // Raster: alle Einträge (auch andere Sprache) belegen ihren Platz; sichtbar nur die der gewählten Sprache
    const groesse = rasterGroesse(einstellungen);
    // Ebene: oberste (Gruppen + Quiz ohne Gruppe) oder die geöffnete Gruppe
    const ordnerOffen = (slots.ordner || []).find(o => o.id === slotOrdner) || null;
    const raster = ordneRaster(ebeneVon(slots, ordnerOffen?.id || null), groesse);
    const kinderVon = id => eintraegeImOrdner(slots, id);   // 193: Quiz samt Unterordnern
    const hoch = ordnerOffen ? ordnerOffen.ordner || null : null;   // eine Ebene hinauf
    // 181: komplett gelernte Kacheln ausblenden (Ordner: wenn alles darin gelernt ist); gewählte bleiben sichtbar
    const gelerntVoll = x => x.istOrdner ? (kinderVon(x.id).length > 0 && kinderVon(x.id).every(k => lernstand(k).uebersetzung.pct >= 100)) : lernstand(x).uebersetzung.pct >= 100;
    const gewaehltE = x => multiAuswahl?.includes(x.id) || (slotVorschau?.typ === "gespeichert" && slotVorschau.id === x.id) || (slotRef?.typ === "gespeichert" && slotRef.id === x.id);
    const sichtbarE = x => (x.istOrdner ? (sprachFilter === "alle" || kinderVon(x.id).length === 0 || kinderVon(x.id).some(slotSichtbar)) : slotSichtbar(x))
      && !(einstellungen.gelernteAusblenden && !slotSortModus && !gewaehltE(x) && gelerntVoll(x));
    const sichtbar = raster.gespeichert.filter(x => sichtbarE(x) && !x.istOrdner);
    slotSichtbarRef.current = sichtbar.map(x => x.id);
    plaetzeRef.current.slot = sichtbar.map(x => ({ id: x.id, z: x.platz.z, s: x.platz.s }));
    const ebeneLeer = raster.gespeichert.length === 0;   // 194: leerer Ordner – eine Zeile freier Plätze zeigen
    const minSS = minSpalten("slot", ordnerOffen?.id || null), autoAnordnung = !!einstellungen.lueckenlos && !slotSortModus;   // 291: automatisch – gewählte Spaltenzahl
    const anzSpalten = autoAnordnung ? Math.max(1, minSS || 1) : ebenenSpalten(raster.gespeichert, slotSortModus && zugRand !== false, minSS);   // 231: beim Finger-Zug erst am Rand   // 196/203: belegt bzw. gewählt (+1 beim Verschieben)
    const kurzText = (autoAnordnung ? Math.max(1, minSS || 1) : ebenenSpalten(raster.gespeichert, false, minSS)) > 1;   // 210: ab 2 Spalten abgekürzt
    const ordnerHierGeht = ordnerPfad(slots.ordner, ordnerOffen?.id || null).length < ORDNER_TIEFE_MAX;
    const zeilenSichtbar = Math.max(ebeneLeer && ordnerOffen ? 1 : 0, raster.gespeichert.filter(sichtbarE).reduce((m, x) => Math.max(m, x.platz.z + 1), 0));
    // 214: sind alle angezeigten Plätze belegt, eine Zeile mehr – damit es immer einen freien Platz (Lang-Druck) gibt
    const alleBelegt = zeilenSichtbar > 0 && raster.gespeichert.filter(x => x.platz.z < zeilenSichtbar && x.platz.s < anzSpalten).length >= zeilenSichtbar * anzSpalten;
    // 256: „Lückenlos anzeigen“ – sichtbare Kacheln in Lesereihenfolge ihrer Plätze ohne Lücken (nur Anzeige; beim
    // Verschieben – auch beim Finger-Zug – die echten Plätze, wie bei „Gelernte ausblenden“)
    const lueckenlos = !!einstellungen.lueckenlos && !slotSortModus;
    const reihe = lueckenlos ? lueckenlosReihe(raster.gespeichert.filter(sichtbarE)) : null;
    const platzMap = lueckenlos ? new Map(reihe.map((x, i) => [autoPlatz(i, reihe.length, anzSpalten), x]))
      : new Map(raster.gespeichert.map(x => [`${x.platz.z}|${x.platz.s}`, x]));
    const zeilenAnzeige = slotSortModus ? raster.gespeichert.reduce((m, x) => Math.max(m, x.platz.z + 1), 0) + RASTER_FREI_ZEILEN
      : lueckenlos ? Math.max(ebeneLeer && ordnerOffen ? 1 : 0, Math.ceil(reihe.length / anzSpalten) + (reihe.length && reihe.length % anzSpalten === 0 ? 1 : 0))
      : zeilenSichtbar + (alleBelegt ? 1 : 0);
    const sfVon = x => slotSFAlle(x)[aktiverSlot?.id === x.id ? quizAbfrageArt : slotKonfigArt(x)];
    // Auswahl-Modus: Aktionen für die Auswahl (Rechtsklick auf eine nicht gewählte Kachel nimmt sie dazu)
    // 234: Ordner können mit in der Auswahl sein – sie zählen mit ihrem ganzen Inhalt; Löschen löst sie nur auf
    const wahlMit = x => multiAuswahl.includes(x.id) ? multiAuswahl : [...multiAuswahl, x.id];
    const istOrdnerId = id => (slots.ordner || []).some(o => o.id === id);
    const wahlQuiz = ids => [...new Set(ids.flatMap(id => istOrdnerId(id) ? kinderVon(id).map(k => k.id) : [id]))];
    const ordnerMenue = (x, kinder) => [   // 235: direkt Öffnen, Multiquiz; Ablage gruppiert
      { label: "📂 Öffnen", fn: () => setSlotOrdner(x.id) },
      ...(kinder.length >= 2 ? [{ label: `🧩 Multiquiz des Ordners (${kinder.length})`, fn: () => tab === "quiz" ? starteMultiquiz(kinder.map(k => k.id)) : stelleMultiquizEin(kinder.map(k => k.id)) }] : []),
      ...gruppe(GRUPPE.ablage, [
        { label: "✎ Umbenennen", fn: () => setOrdnerUmbenennen({ id: x.id, name: x.name }) },
        { label: "⇄ Verschieben", fn: () => { setMultiAuswahl(null); setSlotSortModus(true); setSlotAuswahl([x.id]); } },
        { label: "📁 In Ordner…", fn: () => setInGruppe({ ids: [x.id], name: "" }) },
        ordnerOffen && { label: "↑ Aus dem Ordner", fn: () => verschiebeInOrdner([x.id], hoch) },
        ordnerPfad(slots.ordner, x.id).length < ORDNER_TIEFE_MAX && { label: "📁 Neuer Ordner darin", fn: () => setInGruppe({ ids: [], name: "", eltern: x.id }) },
        (kinder.length || (slots.ordner || []).some(o => o.ordner === x.id)) ? { label: "📤 Ordner auflösen", fn: () => loeseOrdnerAuf(x.id) } : { label: "🗑 Ordner löschen", gefahr: true, fn: () => loeseOrdnerAuf(x.id) },
      ]),
    ];
    const wahlMenue = ids => {
      const quiz = wahlQuiz(ids), ordner = ids.filter(istOrdnerId), eintraege = ids.filter(id => !istOrdnerId(id));
      return [
      ...(quiz.length >= 2 ? [tab === "quiz" ? { label: `🧩 Multiquiz starten (${quiz.length})`, fn: () => starteMultiquiz(quiz) } : { label: `🧩 Multiquiz (${quiz.length})`, fn: () => stelleMultiquizEin(quiz) }] : []),
      ...gruppe(GRUPPE.ablage, [   // 235
        { label: "⇄ Verschieben", fn: () => { setMultiAuswahl(null); setSlotSortModus(true); setSlotAuswahl(ids); } },
        { label: `📁 In Ordner… (${ids.length})`, fn: () => setInGruppe({ ids, name: "" }) },
        ordnerOffen && { label: `↑ Aus dem Ordner (${ids.length})`, fn: () => verschiebeInOrdner(ids, hoch) },
        eintraege.length ? { label: `🗑 Löschen (${eintraege.length})${ordner.length ? ` · ${ordner.length} Ordner auflösen` : ""}`, gefahr: true, fn: () => setAuswahlLoeschen({ art: "slot", ids: eintraege, ordner }) }
          : { label: `📤 Ordner auflösen (${ordner.length})`, fn: () => { setMultiAuswahl(null); ordner.forEach(o => loeseOrdnerAuf(o)); } },
      ]),
      { label: "↔ Von–Bis", behalten: true, fn: () => setVonBis({ art: "slot", id: ids[ids.length - 1] }) },
    ]; };
    const wahlNamen = ids => ids.map(id => { const o = (slots.ordner || []).find(y => y.id === id); return o ? `📁 ${o.name}` : slots.gespeichert.find(g => g.id === id)?.name; }).filter(Boolean).join(", ");
    const einzelMenue = x => [   // 235: Lernen (Fällige) und Inhalt (Listen/Vokabeln ändern) haben je einen Punkt → direkt; Ablage gruppiert
      ...gruppe(GRUPPE.inhalt, [{ label: "📝 Vokabeln ändern", fn: () => aendereQuizVokabeln(x.id) }]),
      ...gruppe(GRUPPE.ablage, [
        { label: "✎ Umbenennen", fn: () => setSlotUmbenennen({ id: x.id, name: x.name }) },
        { label: "⧉ Duplizieren", fn: () => setSlotUmbenennen({ id: x.id, name: kopieName(x.name), kopie: true }) },
        { label: "⇄ Verschieben", fn: () => { setMultiAuswahl(null); setSlotSortModus(true); setSlotAuswahl([x.id]); } },
        { label: "📁 In Ordner…", fn: () => setInGruppe({ ids: [x.id], name: "" }) },
        ordnerOffen && { label: "↑ Aus dem Ordner", fn: () => verschiebeInOrdner([x.id], hoch) },
        { label: "🗑 Löschen", gefahr: true, fn: () => setLoescheSlotNr({ typ: 'gespeichert', id: x.id }) },
      ]),
      { label: "☑ Auswählen", behalten: true, fn: () => { setSlotSortModus(false); setMultiAuswahl([x.id]); } },
    ];
    // Auswahl-Tafel: ein Quiz → ihr Menü, mehrere → Aktionen für die Auswahl
    // 241: „☑ Alle auswählen“ (sichtbare Quiz dieser Ebene) unter Ablage; „Auswahl beenden“ entfällt (Quiz/Listen-Knopf beendet sie)
    const alleWahl = { label: "☑ Alle auswählen", behalten: true, fn: () => (auswahlTafelRef.current = "slot", setMultiAuswahl(a => [...(a || []), ...slotSichtbarRef.current.filter(id => !(a || []).includes(id))])) };   // Tafel geht mit der neuen Auswahl wieder auf
    const tafelInhalt = ids => {
      const o = ids.length === 1 && (slots.ordner || []).find(y => y.id === ids[0]);
      if (o) return { text: `📁 ${o.name}`, aktionen: inGruppe(ordnerMenue(o, kinderVon(o.id)), GRUPPE.ablage, alleWahl) };
      const x = ids.length === 1 && slots.gespeichert.find(g => g.id === ids[0]);
      if (x) return { text: x.name, aktionen: [...inGruppe(einzelMenue(x).filter(a => a.label !== "☑ Auswählen"), GRUPPE.ablage, alleWahl), { label: "↔ Von–Bis", behalten: true, fn: () => setVonBis({ art: "slot", id: x.id }) }] };
      return ids.length ? { text: `${ids.length} ausgewählt: ${wahlNamen(ids)}`, aktionen: inGruppe(wahlMenue(ids), GRUPPE.ablage, alleWahl) } : { text: "Nichts ausgewählt – Quiz antippen", aktionen: [] };
    };
    auswahlTafelDaten.current.slot = () => multiAuswahl && mitSchalterRaster(app, tafelInhalt(multiAuswahl), "slot", wahlQuiz(multiAuswahl));
    // Ziehen: diese Kacheln wandern mit; über einer anderen verweilen bildet eine Gruppe (nur oberste Ebene, keine Gruppen in Gruppen)
    const ziehIds = slotDragId ? (slotAuswahl.includes(slotDragId) ? slotAuswahl : [slotDragId]) : [];
    const rueckS = slotDragId && gruppenZiel !== slotDragZiel ? rueckendeIds(raster.gespeichert, ziehIds, slotDragZiel) : new Set();   // 246: Vorschau
    const gruppierbar = !!slotDragId;   // 193: Ring nur, wenn der Verweil-Effekt ein Ziel setzt (prüft Tiefe und Ordner)
    const tippeImRaster = (x, platz) => {
      if (slotGezogenRef.current) { slotGezogenRef.current = false; return; }
      if (x) { setSlotAuswahl(a => a.includes(x.id) ? a.filter(v => v !== x.id) : [...a, x.id]); return; }
      if (slotAuswahl.length) { merkeVerschieben(); setzeSlotPlaetze(slotAuswahl, platz); }   // 239
    };
    const zellen = [];
    for (let z = 0; z < zeilenAnzeige; z++) for (let sp = 0; sp < anzSpalten; sp++) {
      const key = `${z}|${sp}`;
      const x = platzMap.get(key);
      const ziel = slotDragZiel === key && slotDragId && slotDragId !== x?.id;
      if (x && sichtbarE(x)) {
        const kinder = x.istOrdner ? kinderVon(x.id) : null;
        const pct = x.istOrdner
          ? (kinder.length ? Math.round(kinder.reduce((a, k) => a + lernstand(k).uebersetzung.pct, 0) / kinder.length) : 0)
          : Math.round(lernstand(x).uebersetzung.pct);
        // 200: Ordner – Anteil über alle Vokabeln darin (samt Unterordnern), jede Vokabel einmal
        const heuteP = x.istOrdner
          ? heuteAnteil([...new Map(kinder.flatMap(kachelVoks).filter(y => !y.herausgenommen).map(y => [y._key, y])).values()], heuteFeld, einstellungen.gelerntSchwelle ?? 0)
          : heuteProzent(x);
        const multiNr = multiAuswahl ? multiAuswahl.indexOf(x.id) + 1 : 0;
        // geladenes Multiquiz (nichts angetippt): seine Quiz angewählt, mit Nummer
        const multiTeile = !multiAuswahl && !slotVorschau ? (multiVonSlot(slotRef) || []).map(m => m.id) : [];
        const teilNr = multiTeile.indexOf(x.id) + 1;
        const verweilen = ziel && gruppierbar && verweilGeht(false, x.id, ziehIds);
        // 210: Vokabelzahl rechtsbündig in der Namenszeile (Ordner: jede Vokabel einmal); eng (ab 2 Spalten): „Q.“ / „V.“
        const vokAnz = x.istOrdner ? new Set(kinder.flatMap(kachelVoks).map(y => y._key)).size : kachelVoks(x).length;
        // 276: fällige – Ordner: jede Vokabel einmal
        const fVoks = (x.istOrdner ? [...new Map(kinder.flatMap(kachelVoks).map(y => [y._key, y])).values()] : kachelVoks(x)).filter(y => !y.herausgenommen);
        const fN = faelligZahl(fVoks);
        const inhalt = (<>
          <span className="raster-kopf">
            <span className="raster-name">{x.istOrdner && <span aria-hidden="true">📁 </span>}{x.multi && <span aria-hidden="true">🧩 </span>}{x.name}{x.istOrdner && <span className="ordner-anzahl" data-ordner-anzahl={kinder.length}> · {kinder.length} {kurzText ? "Q." : "Quiz"}</span>}</span>
            <span className="raster-anz" data-vok-anzahl={vokAnz}>{zahlDe(vokAnz)} {kurzText ? "V." : "Vokabeln"}</span>
          </span>
          <span className="raster-fuss" data-kachel-balken={pct} {...ttFeld(`Lernfortschritt Übersetzung: ${pct} %${fN ? ` · davon ${fN} fällig (hohler Anfang des Balkens)` : ""}`)}>
            {kachelBalken(pct, fN, fVoks.length)}
            {pct >= 100 && <span className="kachel-voll" title="100 % gelernt">✓</span>}
          </span>
        </>);
        zellen.push(slotSortModus ? (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} data-ordner-id={x.istOrdner ? x.id : undefined} data-rueckt={rueckS.has(x.id) ? "" : undefined} className={`slot-chip belegt raster-chip${x.istOrdner ? " ordner-kachel" : ""}`}
            style={{touchAction:"none", cursor:"grab",
              ...(slotAuswahl.includes(x.id) ? {boxShadow:"0 0 0 2px var(--karte), 0 0 0 5px var(--bestaetigen)"} : {}),
              ...(slotDragId && (slotDragId === x.id || (slotAuswahl.includes(slotDragId) && slotAuswahl.includes(x.id))) ? {opacity:0.4, borderStyle:"dashed"} : {}),
              position:"relative",
              ...(ziel ? {outline:"3px dashed var(--bestaetigen)", outlineOffset:-3} : {})}}
            onPointerDown={e => { slotZiehenRef.current = { id: x.id, x: e.clientX, y: e.clientY, aktiv: false }; }}
            onClick={() => tippeImRaster(x, x.platz)}
            {...tt(`${x.name} – antippen markiert (mehrere möglich), dann freien Platz antippen; oder direkt ziehen – markierte wandern zusammen`)}>
            {inhalt}
            {slotAuswahl.includes(x.id) && <span className="auswahl-nr" data-auswahl-nr>{slotAuswahl.indexOf(x.id) + 1}</span>}
            {verweilen ? (
              <span className={`gruppen-ring${gruppenZiel === key ? " fertig" : ""}`} data-gruppen-ring={gruppenZiel === key ? "fertig" : "laeuft"}>
                <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/></svg><span data-ring-symbol={gruppenZiel === key ? "ordner" : "einfuegen"}>{gruppenZiel === key ? "📁" : "↓"}</span>
              </span>
            ) : null}
          </button>
        ) : x.istOrdner ? (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} data-ordner-id={x.id} data-kachel-geste="ordner" data-kachel-zieh="" data-angehoben={angehoben === x.id ? "" : undefined} data-rueckt={rueckS.has(x.id) ? "" : undefined}
            data-multi-nr={multiNr || undefined} data-auswahl-durchlass
            className={`slot-chip belegt raster-chip ordner-kachel${slotRef?.typ === "gespeichert" && kinder.some(k => k.id === slotRef.id) ? " ordner-aktiv" : ""}${multiNr || (lasso?.art === "slot" && lasso.ids.includes(x.id)) ? " kachel-gewaehlt" : ""}`}
            data-heute={heuteP}
            style={{position:"relative", ...(heuteP > 0 ? { backgroundImage: `linear-gradient(to right, var(--heute-farbe) ${heuteP}%, transparent ${heuteP}%)` } : {})}}
            onClick={() => { if (slotGezogenRef.current) { slotGezogenRef.current = false; return; } setSlotOrdner(x.id); }}   // 234: öffnen – die Auswahl endet (Ebene wechselt)
            {...(() => {
              const tafel = tafelInhalt(multiAuswahl ? wahlMit(x) : [x.id]);
              return tt(`Ordner „${x.name}“ mit ${kinder.length} Quiz – antippen öffnet ihn; kurz halten: auswählen (zählt mit seinem ganzen Inhalt); lang halten: verschieben`, tafel.aktionen,
                { langText: tafel.text, auswahl: auswahlTafel("slot"), beimMenue: () => wahlUmschaltenRef.current("slot", x.id), eigeneGeste: true });
            })()}>
            {inhalt}
            {multiNr ? <span className="auswahl-nr">{multiNr}</span> : null}
          </button>
        ) : (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} data-multi-nr={multiNr || undefined} data-auswahl-durchlass
            data-kachel-geste="slot" data-kachel-zieh="" data-angehoben={angehoben === x.id ? "" : undefined} data-rueckt={rueckS.has(x.id) ? "" : undefined}
            data-heute={heuteP}
            className={`slot-chip belegt raster-chip${
              multiNr || teilNr || (lasso?.art === "slot" && lasso.ids.includes(x.id)) || (!multiAuswahl && (slotVorschau ? slotVorschau.typ === "gespeichert" && slotVorschau.id === x.id : slotRef?.typ === "gespeichert" && slotRef?.id === x.id)) ? " kachel-gewaehlt" : ""}${blitzt(`slot:${x.id}`)}`}
            data-vorschau={(slotVorschau?.typ === "gespeichert" && slotVorschau.id === x.id) || (multiAuswahl?.length === 1 && multiAuswahl[0] === x.id) ? "" : undefined}
            style={{...chipStil('gespeichert', x.id, slotRef), position:"relative",
              ...(heuteP > 0 ? { backgroundImage: `linear-gradient(to right, var(--heute-farbe) ${heuteP}%, transparent ${heuteP}%)` } : {})}}
            onClick={() => vonBis?.art === "slot" ? wahlUmschaltenRef.current("slot", x.id)   // 243: Von–Bis – antippen wählt das Ende
              : multiAuswahl
              ? (auswahlTafelRef.current = "slot", setSlotVorschauListe(false), setMultiAuswahl([x.id]), leuchte(`slot:${x.id}`, BLITZ_MS / 2))   // 234: Auswahl beginnt neu mit dieser Kachel
              : blaettern ? (leuchte(`slot:${x.id}`, BLITZ_MS / 2), setSlotVorschauListe(false), setSlotVorschau({ typ: "gespeichert", id: x.id }))
              : uebernimmSlots([x.id])}   // 192: antippen übernimmt sofort – außer im Blätter-Modus (nach einem Lang-Druck)
            {...(() => {
              // Rechtsklick: Quiz kommt in die Auswahl (bzw. heraus), die Tafel bleibt unten offen;
              // Touch (234): kurz halten wählt aus (weiterfahren sammelt ein), lang halten verschiebt
              const tafel = tafelInhalt(multiAuswahl ? wahlMit(x) : [x.id]);
              return tt(`${x.name} – antippen: laden; kurz halten: auswählen (weitere kurz halten: dazu/heraus, weiterfahren: einsammeln; übernehmen mit dem grünen Kopf); lang halten: verschieben`, tafel.aktionen,
               { langText: tafel.text, auswahl: auswahlTafel("slot"),
                 beimMenue: () => wahlUmschaltenRef.current("slot", x.id),
                 eigeneGeste: true });
            })()}>
            {inhalt}
            {multiNr || teilNr ? <span className="auswahl-nr" data-teil-nr={teilNr || undefined}>{multiNr || teilNr}</span> : null /* gleiche Kind-Struktur wie im Verschieben-Modus (Markierungsnummer) – sonst baut React den Inhalt neu auf und ein laufendes Ziehen verliert den Finger */}
          </button>
        ));
      } else if (x) {
        // Eintrag einer anderen Sprache: Platz belegt, aber hier nicht bedienbar
        zellen.push(<div key={key} className="raster-leer" style={{opacity: slotSortModus ? 0.6 : 0, fontSize:"0.65rem", color:"var(--text3)"}}>andere Sprache</div>);
      } else if (slotSortModus) {
        zellen.push(<div key={key} data-raster-zelle={key} className="raster-leer"
          style={{borderStyle:"dashed", cursor: slotAuswahl.length ? "pointer" : "default",
            ...(ziel ? {borderColor:"var(--bestaetigen)", background:"var(--haupt-flaeche)"} : {})}}
          onClick={() => tippeImRaster(null, { z, s: sp })}
          {...tt("Freier Platz – markierte Pakete hier untereinander einsetzen (oder Pakete hierher ziehen)")}/>);
      } else {
        // 194: freier Platz – lang drücken: neuer (leerer) Ordner genau hier; im leeren Ordner gestrichelt sichtbar
        zellen.push(<div key={key} className="raster-leer" data-freier-platz={key} style={ebeneLeer ? {borderStyle:"dashed", opacity:0.5} : {border:"none"}}
          {...tt("Freier Platz – lang drücken: Menü dieser Ebene (Neues landet genau hier)",
            slotEbenenMenue(ordnerOffen?.id || null, { platz: lueckenlos ? null : { z, s: sp }, ohneNeu: tab === "statistik" }))}/>);   // 247; 256
      }
    }
    return (<>
      <div style={{margin:`0 ${abstand}px 12px`}}>
        {zellen.length > 0 && (
          <div className={`slot-raster${anzSpalten >= 4 ? " schmal" : ""}`} data-lasso={slotSortModus ? undefined : "slot"} data-raster-spalten-anz={anzSpalten} style={{gridTemplateColumns:`repeat(${anzSpalten}, minmax(0, 1fr))`}}>
            {zellen}
          </div>
        )}
      </div>
      {verlauf.length > 0 && !slotSortModus && !ordnerOffen && (
        <div style={{margin:`0 ${abstand}px 14px`, paddingTop:10, borderTop:"1px dashed var(--rahmen)"}}>
          <button data-verlauf-kopf={verlaufOffen ? "offen" : "zu"} onClick={() => setVerlaufOffen(v => !v)}
            style={{...label, marginBottom: verlaufOffen ? 6 : 0, background:"none", border:"none", padding:"4px 0", cursor:"pointer", display:"flex", alignItems:"center", gap:6, width:"100%", fontFamily:"inherit"}}
            {...tt(verlaufOffen ? "Verlauf einklappen" : `Verlauf: die letzten ${verlauf.length} Abfragen ohne gespeichertes Quiz`)}>🕘 Verlauf · letzte Abfragen ({verlauf.length}) <span style={{marginLeft:"auto"}}>{verlaufOffen ? "▲" : "▼"}</span></button>
          {verlaufOffen && <div data-verlauf-raster style={{display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:6}}>
            {verlauf.map(x => renderSlotChip(x.id, slotChipLabel(x),
              () => { leuchte(`verlauf:${x.id}`, BLITZ_MS / 2); setSlotVorschauListe(false); setSlotVorschau({ typ: "verlauf", id: x.id }); },
              { ...chipStil('verlauf', x.id, slotRef), ...(slotVorschau?.typ === "verlauf" && slotVorschau.id === x.id ? {boxShadow:"0 0 0 2px var(--karte), 0 0 0 5px var(--bestaetigen)", background:"color-mix(in srgb, var(--bestaetigen) 22%, var(--karte))"} : {}) }, "verlauf"))}
          </div>}
        </div>
      )}
    </>);
  }
