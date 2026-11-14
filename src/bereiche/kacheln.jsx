import { ORDNER_KNOPF, ORDNER_TIEFE_MAX, RASTER_FREI_ZEILEN, ebeneVon, ebenenSpalten, eintraegeImOrdner, ordneRaster, ordnerPfad, rasterGroesse, zahlDe } from "../raster.js";
import { Fragment } from "react";
import { BLITZ_MS, SK, TYPEN, lsGet } from "../speicher.js";
import { listenInhalt } from "../saetze.js";
import { schliesseInfo } from "../infoEreignisse.js";
import { heuteAnteil, slotKonfigArt, slotSFAlle } from "../quiz.jsx";

// Phase 2 (Aufteilung): Zeichen-Funktionen aus App.jsx. app = die Namen der Komponente, die sie brauchen.

// Plätze des Listen-Rasters für die Listenauswahl in Quiz und Statistik: gleiche Spalten und Plätze
// wie im Listen-Tab (leere Plätze bleiben frei); mit Sprachfilter zusammengerückt
// 193: die geöffnete Ebene (Listen-Ordner) – Ordner kommen als { istOrdner } mit
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
  const { headerH, listenKopfH, listenOrdner, listenOrdnerOffen, pfadTeile, resetImport, setAnordnen, setAnsicht, setInGruppe, setListeVorschau, setListenAuswahl, setListenOrdnerOffen, setListenSortModus, setListenWahl, setTab } = app;
    const neuerOrdner = eltern => ordnerPfad(listenOrdner, eltern).length < ORDNER_TIEFE_MAX
      ? [{ label: "📁 Neuer Ordner", fn: () => setInGruppe({ art: "liste", ids: [], name: "", eltern }) }] : [];
    const neueListe = eltern => ({ label: "＋ Neue Liste", fn: () => { setListenOrdnerOffen(eltern); resetImport(); setTab("listen"); setAnsicht("import"); } });
    const geheZu = id => { setListenOrdnerOffen(id); setListenSortModus(false); setListenAuswahl([]); setListeVorschau(null); setListenWahl(null); };
    const anordnenL = ordnerId => ({ label: "⇅ Anordnen…", fn: () => setAnordnen({ art: "liste", ordner: ordnerId }) });   // 208
    return (
      <div data-ordner-navi="liste" style={{display:"flex", alignItems:"center", gap:8, marginBottom:8, minHeight:30, position:"sticky", top: headerH + listenKopfH, zIndex: 7, background:"var(--hintergrund)", padding:"6px 0"}}>
        {pfadTeile({ alleText: "Alle Listen", alleAttr: "data-alle-listen", pfad: ordnerPfad(listenOrdner, listenOrdnerOffen), geheZu,
          alleTt: listenOrdnerOffen ? "Zurück zu allen Listen – Listen hierher ziehen legt sie auf die oberste Ebene; lang drücken: neue Liste, neuer Ordner"
            : "Alle Listen – lang drücken: neue Liste, neuer Ordner",
          alleAktionen: [neueListe(null), ...neuerOrdner(null), anordnenL(null)], ordnerAktionen: o => [neueListe(o.id), ...neuerOrdner(o.id), anordnenL(o.id)], einheit: "Listen" })}
      </div>
    );
  }

export function renderListenRaster(app) {
  const { angehoben, auswahlTafel, auswahlTafelDaten, auswahlTafelRef, blaettern, blitzt, einstellungen, gruppenZiel, lasso, lernstandJeArt, leuchte, listeVorschau, listenAuswahl, listenFlagge, listenIndex, listenMenue, listenOrdner, listenOrdnerOffen, listenSortModus, listenWahl, listenWahlMenue, loeseListenOrdnerAuf, minSpalten, neuListePlatzRef, oeffneListeDetail, plaetzeRef, renderMiniKreise, resetImport, satzStand, setAnsicht, setBlaettern, setInGruppe, setListeVorschau, setListenAuswahl, setListenOrdnerOffen, setListenSortModus, setListenWahl, setOrdnerUmbenennen, setTab, setVonBis, setzeListenPlaetze, sichtbareListen, slotDragId, slotDragZiel, slotGezogenRef, slotZiehenRef, sprachFilter, tt, verschiebeListenInOrdner, verweilGeht, vokabelAnzahl, wahlUmschaltenRef } = app;
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
    const anzSpalten = gefiltert ? 1 : ebenenSpalten(ebene, sortModus, minS);   // 196
    // Kachel-Aufbau nur nach den belegten Spalten: die freie Spalte beim Verschieben darf ihn nicht ändern
    // (sonst baut React den Inhalt unter dem Finger neu auf und das Ziehen verliert den Finger)
    const eng = (gefiltert ? 1 : ebenenSpalten(ebene, false, minS)) > 1;
    const tippeImRaster = (l, platz) => {
      if (slotGezogenRef.current) { slotGezogenRef.current = false; return; }
      if (l) { setListenAuswahl(a => a.includes(l.id) ? a.filter(x => x !== l.id) : [...a, l.id]); return; }
      if (listenAuswahl.length) setzeListenPlaetze(listenAuswahl, platz);
    };
    const oeffne = l => {
      if (listenWahl) {   // Antippen wählt wieder einzeln (ersetzt die Auswahl)
        schliesseInfo(); auswahlTafelRef.current = null; setListenWahl(null); setBlaettern(true);
        leuchte(`lw:${l.id}`, BLITZ_MS / 2);
        setTimeout(() => setListeVorschau(l.id), 0);
      } else if (blaettern) {
        leuchte(`lw:${l.id}`, BLITZ_MS / 2);
        setListeVorschau(l.id);
      } else { setListeVorschau(null); oeffneListeDetail(l.id); }   // 192: antippen öffnet sofort (außer im Blätter-Modus)
    };
    const menue = l => listenMenue(l);
    // Auswahl-Modus: Aktionen für die Auswahl (Lang-Druck auf eine nicht gewählte Liste nimmt sie dazu)
    const wahlMit = l => listenWahl.includes(l.id) ? listenWahl : [...listenWahl, l.id];
    const wahlMenue = listenWahlMenue;
    const wahlNamen = ids => ids.map(id => listenIndex.find(x => x.id === id)?.name).filter(Boolean).join(", ");
    // Auswahl-Tafel: eine Liste → ihr Menü, mehrere → Aktionen für die Auswahl
    const tafelInhalt = ids => {
      const l = ids.length === 1 && listenIndex.find(x => x.id === ids[0]);
      if (l) return { text: l.name, aktionen: [...menue(l).filter(a => a.label !== "☑ Auswählen"), { label: "↔ Von–Bis", behalten: true, fn: () => setVonBis({ art: "liste", id: l.id }) }, { label: "✕ Auswahl beenden", fn: () => setListenWahl(null) }] };
      return ids.length ? { text: `${ids.length} ausgewählt: ${wahlNamen(ids)}`, aktionen: wahlMenue(ids) } : { text: "Nichts ausgewählt – Listen antippen", aktionen: [] };
    };
    auswahlTafelDaten.current.liste = () => listenWahl && tafelInhalt(listenWahl);
    const zelle = (l, key, ziehIdsL = []) => {
      const anzahl = vokabelAnzahl(l.id);
      const liste = lsGet(SK.liste(l.id));
      // 202: Inhalt kurz – Beispielsätze (gesamt) und Synonyme, nur was vorhanden ist
      const inh = listenInhalt(liste, satzStand);
      const inhaltKurz = <span data-listen-inhalt={`${inh.saetze}|${inh.synonyme}`}>{inh.saetze ? ` · 💬 ${inh.saetze}` : ""}{inh.synonyme ? ` · ≈ ${inh.synonyme}` : ""}</span>;
      const aktSpalten = liste ? TYPEN.filter(t => liste.spalten[t].aktiv) : [];
      const ziel = slotDragZiel === key && slotDragId && slotDragId !== l.id;
      // Lang-Druck (Maus: Rechtsklick): Liste kommt in die Auswahl, die Tafel bleibt unten offen (weitere antippen wählt mit aus);
      // Touch: Haltestufen (kurz halten + ziehen verschiebt, lang halten + fahren wählt aus)
      const tafel = tafelInhalt(listenWahl ? wahlMit(l) : [l.id]);
      const erklaerung = sortModus && !listenWahl ? tt(`${l.name} – antippen markiert (mehrere möglich), dann freien Platz antippen; oder direkt ziehen – markierte wandern zusammen`)
        : tt(`${l.name} – antippen: öffnen (nach einem Lang-Druck: nur auswählen, öffnen mit dem grünen Knopf); kurz halten: auswählen; lang halten: Mehrfach-Auswahl (Export, Verschieben, Löschen)`,
          tafel.aktionen, { langText: tafel.text, auswahl: auswahlTafel("liste"), eigeneGeste: true,
            beimMenue: () => wahlUmschaltenRef.current("liste", l.id) });
      return (
        <div {...erklaerung} key={key} data-raster-zelle={gefiltert ? undefined : key} data-liste-id={l.id} data-auswahl-durchlass
          className={`karte-zeile${(listenAuswahl.includes(l.id) && sortModus) || listenWahl?.includes(l.id) || (lasso?.art === "liste" && lasso.ids.includes(l.id)) || (!listenWahl && listeVorschau === l.id) ? " kachel-gewaehlt" : ""}${blitzt(`lw:${l.id}`)}`}
          data-kachel-geste={sortModus ? undefined : "liste"} data-kachel-zieh={sortModus || gefiltert ? undefined : ""} data-angehoben={angehoben === l.id ? "" : undefined}
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
    // 193: Ordner-Kachel (Listen): antippen öffnet, kurz halten + ziehen verschiebt, lang drücken: Menü
    const ziehIds = slotDragId ? (listenAuswahl.includes(slotDragId) ? listenAuswahl : [slotDragId]) : [];
    const ring = key => (<span className={`gruppen-ring${gruppenZiel === key ? " fertig" : ""}`} data-gruppen-ring={gruppenZiel === key ? "fertig" : "laeuft"}>
      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/></svg><span data-ring-symbol={gruppenZiel === key ? "ordner" : "tauschen"}>{gruppenZiel === key ? "📁" : "⇄"}</span></span>);
    const kurzL = (gefiltert ? 1 : ebenenSpalten(ebene, false, minS)) > 1;   // 210: ab 2 Spalten „L.“ / „V.“
    const ordnerZelle = (o, key) => {
      const drin = ordnerListen(o.id);
      const vokDrin = drin.reduce((m, l) => m + vokabelAnzahl(l.id), 0);
      const unter = listenOrdner.filter(u => u.ordner === o.id).length;
      const ziel = slotDragZiel === key && slotDragId && slotDragId !== o.id;
      const menue = [
        { label: "📂 Öffnen", fn: () => { setListenOrdnerOffen(o.id); setListeVorschau(null); } },
        { label: "✎ Umbenennen", fn: () => setOrdnerUmbenennen({ art: "liste", id: o.id, name: o.name }) },
        { label: "⇄ Verschieben", fn: () => { setListenWahl(null); setListenSortModus(true); setListenAuswahl([o.id]); } },
        { label: "📁 In Ordner…", fn: () => setInGruppe({ art: "liste", ids: [o.id], name: "" }) },
        ...(offen ? [{ label: "↑ Aus dem Ordner", fn: () => verschiebeListenInOrdner([o.id], hoch) }] : []),
        ...(ordnerPfad(listenOrdner, o.id).length < ORDNER_TIEFE_MAX ? [{ label: "📁 Neuer Ordner darin", fn: () => setInGruppe({ art: "liste", ids: [], name: "", eltern: o.id }) }] : []),
        (drin.length || unter) ? { label: "📤 Ordner auflösen", fn: () => loeseListenOrdnerAuf(o.id) } : { label: "🗑 Ordner löschen", gefahr: true, fn: () => loeseListenOrdnerAuf(o.id) },
      ];
      return (
        <div key={key} data-raster-zelle={gefiltert ? undefined : key} data-lordner-id={o.id}
          className={`karte-zeile ordner-kachel${sortModus && listenAuswahl.includes(o.id) ? " kachel-gewaehlt" : ""}`}
          data-kachel-geste={sortModus ? undefined : "lordner"} data-kachel-zieh={sortModus || gefiltert ? undefined : ""} data-angehoben={angehoben === o.id ? "" : undefined}
          style={{cursor: sortModus ? "grab" : "pointer", ...(sortModus ? {touchAction:"none"} : {}), position:"relative",
            ...(slotDragId && (slotDragId === o.id || (listenAuswahl.includes(slotDragId) && listenAuswahl.includes(o.id))) ? {opacity:0.4, borderStyle:"dashed"} : {}),
            ...(ziel ? {outline:"3px dashed var(--bestaetigen)", outlineOffset:-3} : {})}}
          onPointerDown={sortModus ? (e => { slotZiehenRef.current = { art: "liste", id: o.id, x: e.clientX, y: e.clientY, aktiv: false }; }) : undefined}
          onClick={() => sortModus ? tippeImRaster(o, o.platz) : (slotGezogenRef.current ? (slotGezogenRef.current = false) : (listenWahl ? null : (setListenOrdnerOffen(o.id), setListeVorschau(null))))}
          {...(sortModus ? tt(`Ordner „${o.name}“ – antippen markiert, dann freien Platz antippen; oder direkt ziehen`)
            : tt(`Ordner „${o.name}“ mit ${drin.length} Liste${drin.length !== 1 ? "n" : ""} – antippen öffnet ihn`, listenWahl ? [] : menue,
              { langText: `📁 ${o.name}`, beimZeigen: (px, py) => { slotZiehenRef.current = { art: "liste", id: o.id, x: px, y: py, aktiv: false, langdruck: true }; } }))}>
          {sortModus && listenAuswahl.includes(o.id) && <span className="auswahl-nr" data-auswahl-nr>{listenAuswahl.indexOf(o.id) + 1}</span>}
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
      const platzMap = new Map(ebene.filter(l => l.platz).map(l => [`${l.platz.z}|${l.platz.s}`, l]));
      const belegtBis = ebene.reduce((m, l) => Math.max(m, (l.platz?.z ?? 0) + 1), 0);
      const alleBelegtL = belegtBis > 0 && ebene.filter(l => l.platz && l.platz.z < belegtBis && l.platz.s < anzSpalten).length >= belegtBis * anzSpalten;   // 214
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
          {...tt("Freier Platz – lang drücken: neue Liste oder neuer Ordner genau hier", [
            { label: "＋ Neue Liste", fn: () => { resetImport(); neuListePlatzRef.current = { ordner: offen, platz: { z, s: sp } }; setTab("listen"); setAnsicht("import"); } },
            ...(ordnerHierGeht ? [{ label: "📁 Neuer Ordner", fn: () => setInGruppe({ art: "liste", ids: [], name: "", platz: { z, s: sp } }) }] : [])])}/>);
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
  const { slotDragId, slotDragZiel, tt } = app;
    const offen = pfad.length > 0;
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
          onClick={() => { if (offen) geheZu(null); }}
          {...tt(alleTt, alleAktionen)}>{offen ? `← ${alleText}` : alleText}</button>
        {pfad.map((o, i) => {
          const letzter = i === pfad.length - 1;
          return (<Fragment key={o.id}>
            {trenner}
            <button className={letzter ? undefined : "typ-btn"} {...(letzter ? { "data-ordner-name": true, "data-pfad-hier": true } : { "data-ordner-ziel": o.id, "data-ordner-pfad-teil": o.id })}
              data-raus-ziel={slotDragZiel === `raus:${o.id}` ? "" : undefined}
              style={{...(letzter ? schlicht : knopf), maxWidth: letzter ? "100%" : "45%", ...zielStil(slotDragZiel === `raus:${o.id}`)}}
              onClick={() => { if (!letzter) geheZu(o.id); }}
              {...tt(`Ordner „${o.name}“ – ${letzter ? "" : `antippen öffnet ihn, ${einheit} hierher ziehen legt sie hinein; `}lang drücken: Menü des Ordners`, ordnerAktionen(o))}>📁 {o.name}</button>
          </Fragment>);
        })}
      </span>
    );
  }

// 217/222: EIN Umschalt-Knopf in der Pfad-Zeile – zeigt, was im Raster steht („Listen“ bzw. „Quiz“), antippen wechselt;
// so hoch wie der Pfad (zweizeiliger Pfad → zweizeilig hoher Knopf)
export function quizListenUmschalter(app) {
  const { auswahlListen, setAuswahlListen, setBlaettern, setMultiAuswahl, setSlotVorschau, tt } = app;
    return (
      <button className={`typ-btn aktiv${auswahlListen ? " eckig" : ""}`} data-auswahl-umschalter={auswahlListen ? "listen" : "quiz"}
        style={{fontSize:"0.75rem", padding:"4px 12px", alignSelf:"stretch", flexShrink:0, minWidth:64}}
        onClick={() => { setAuswahlListen(!auswahlListen); setSlotVorschau(null); setMultiAuswahl(null); setBlaettern(false); }}
        {...tt(auswahlListen ? "Hier stehen die Listen – antippen zeigt die gespeicherten Quiz" : "Hier stehen die gespeicherten Quiz – antippen zeigt die Listen")}>
        {auswahlListen ? "📋 Listen" : "Quiz"}
      </button>
    );
  }

// 217: Pfad über den Listen in der Quiz-Auswahl
export function quizListenNavi(app) {
  const { headerH, listenOrdner, listenOrdnerOffen, pfadTeile, quizListenUmschalter, setBlaettern, setListenOrdnerOffen, setSlotVorschau, slotH, slotInfoH } = app;
    const geheZu = id => { setListenOrdnerOffen(id); setSlotVorschau(null); setBlaettern(false); };
    return (
      <div data-ordner-navi="quiz-listen" style={{display:"flex", alignItems:"center", gap:8, marginBottom:8, minHeight:30, position:"sticky", top: headerH + slotH + slotInfoH, zIndex: 7, background:"var(--hintergrund)", padding:"6px 0", }}>
        {pfadTeile({ alleText: "Alle Listen", alleAttr: "data-alle-listen-quiz", pfad: ordnerPfad(listenOrdner, listenOrdnerOffen), geheZu,
          alleTt: listenOrdnerOffen ? "Zurück zu allen Listen" : "Alle Listen", alleAktionen: null, ordnerAktionen: () => null, einheit: "Listen" })}
        {quizListenUmschalter()}
      </div>
    );
  }

export function renderQuizListenRaster(app) {
  const { FORTSCHRITT_FELD, aktiverSlot, auswahlOrdnerZelle, blaettern, blitzt, einstellungen, lernstandJeArt, leuchte, listenFlagge, listenRasterPlaetze, quizArt, setSlotVorschau, setSlotVorschauListe, slotVorschau, tt, uebernimmListe } = app;
    const { spalten, plaetze } = listenRasterPlaetze();
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    const heuteFeld = FORTSCHRITT_FELD[quizArt] || "fortschritt";
    const kurz = spalten > 1;
    const zellen = plaetze.map(({ key, l }) => {
      if (!l) return <div key={key} className="raster-leer" style={{border:"none"}}/>;
      if (l.istOrdner) return auswahlOrdnerZelle(l, key, id => aktiverSlot?.typ === "listen" && aktiverSlot.id === id, kurz);
      const liste = lsGet(SK.liste(l.id));
      const voks = (liste?.vokabeln || []).filter(v => !v.herausgenommen);
      const pct = Math.round(lernstandJeArt(voks, l.id).uebersetzung.pct || 0);
      const heuteP = heuteAnteil(voks, heuteFeld, schwelle);
      const gewaehlt = slotVorschau ? slotVorschau.typ === "listen" && slotVorschau.id === l.id : aktiverSlot?.typ === "listen" && aktiverSlot.id === l.id;
      return (
        <button key={key} className={`slot-chip belegt raster-chip eckig${gewaehlt ? " kachel-gewaehlt" : ""}${blitzt(`ql:${l.id}`)}`} data-qliste-id={l.id}
          data-kachel-geste="qliste" data-heute={heuteP} data-vorschau={slotVorschau?.typ === "listen" && slotVorschau.id === l.id ? "" : undefined}
          style={{position:"relative", ...(heuteP > 0 ? { backgroundImage: `linear-gradient(to right, var(--heute-farbe) ${heuteP}%, transparent ${heuteP}%)` } : {})}}
          onClick={() => blaettern ? (leuchte(`ql:${l.id}`, BLITZ_MS / 2), setSlotVorschauListe(false), setSlotVorschau({ typ: "listen", id: l.id })) : uebernimmListe(l.id)}
          {...tt(`${l.name} – antippen: abfragen (nach kurzem Halten: nur auswählen, laden mit dem grünen Knopf)`, null, { eigeneGeste: true })}>
          <span className="raster-kopf">
            <span className="raster-name">{listenFlagge(l)}{l.name}</span>
            <span className="raster-anz" data-vok-anzahl={voks.length}>{zahlDe(voks.length)} {kurz ? "V." : "Vokabeln"}</span>
          </span>
          <span className="raster-fuss" data-kachel-balken={pct}>
            <span className={`kachel-balken${pct >= 100 ? " voll" : ""}`}><span style={{width:`${pct}%`}}/></span>
            {pct >= 100 && <span className="kachel-voll" title="100 % gelernt">✓</span>}
          </span>
        </button>
      );
    });
    return (
      <div style={{margin:"0 0 12px"}}>
        <div className={`slot-raster${spalten >= 4 ? " schmal" : ""}`} data-quiz-listen-raster data-raster-spalten-anz={spalten} style={{gridTemplateColumns:`repeat(${spalten}, minmax(0, 1fr))`}}>
          {zellen}
        </div>
      </div>
    );
  }

export function ordnerNavi(app, stil, statistik = false) {
  const { einstellungen, faelligAktion, faelligAlle, faelligVonSlots, headerH, minSpalten, multiAuswahl, neuImOrdnerRef, pfadTeile, quizListenUmschalter, setAnordnen, setInGruppe, setModal, setMultiAuswahl, setNeueSessionSchritt, setSlotAuswahl, setSlotDragId, setSlotDragZiel, setSlotOrdner, setSlotSektionAufgeklappt, setSlotSortModus, setSpaltenWahl, setStatistikAktiverSlot, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikFilter, setStatistikListenIds, setStatistikSlotGeleert, slotAuswahl, slotH, slotInfoH, slotOrdner, slotSichtbarRef, slotSortModus, slots, speichereEinst, tt } = app;
    const ordnerOffen = (slots.ordner || []).find(o => o.id === slotOrdner) || null;
    const neueSession = imOrdner => ({ label: "＋ Neues Quiz aus Listen", fn: () => { neuImOrdnerRef.current = imOrdner; setNeueSessionSchritt("art"); setModal("neue-session"); } });
    const faellige = faelligAktion;
    const gelerntUmschalter = { label: einstellungen.gelernteAusblenden ? "👁 Gelernte einblenden" : "🙈 Gelernte ausblenden",
      fn: () => speichereEinst({ ...einstellungen, gelernteAusblenden: !einstellungen.gelernteAusblenden }) };   // 181
    const alleListen = { label: "▦ Alle Listen", fn: () => {
      setStatistikAktiverSlot(null); setStatistikSlotGeleert(false); setSlotSektionAufgeklappt(false);
      setStatistikListenIds(null); setStatistikBereichTyp("alle"); setStatistikCheckboxAuswahl(new Set());
      setStatistikFilter(new Set(['negativ', 'nie', 'arbeit', 'gelernt'])); } };
    // 194: leeren Ordner anlegen (in der Ebene des Pfad-Teils), solange dort noch einer hineinpasst
    const neuerOrdner = eltern => ordnerPfad(slots.ordner, eltern).length < ORDNER_TIEFE_MAX
      ? [{ label: "📁 Neuer Ordner", fn: () => setInGruppe({ ids: [], name: "", eltern }) }] : [];
    const spaltenAktion = ordnerId => ({ label: `▥ Spalten (${minSpalten("slot", ordnerId)})`, fn: () => setSpaltenWahl({ art: "slot", ordner: ordnerId }) });   // 203
    const anordnenAktion = ordnerId => ({ label: "⇅ Anordnen…", fn: () => setAnordnen({ art: "slot", ordner: ordnerId }) });   // 208
    const alleAktionen = [...(statistik ? [alleListen] : [neueSession(null)]), ...faellige(faelligAlle), ...neuerOrdner(null), spaltenAktion(null), anordnenAktion(null), gelerntUmschalter];
    const ordnerAktionen = o => [...(statistik ? [] : [neueSession(o.id)]),
      ...faellige(faelligVonSlots(eintraegeImOrdner(slots, o.id).map(g => g.id))), ...neuerOrdner(o.id), spaltenAktion(o.id), anordnenAktion(o.id), gelerntUmschalter];
    const markiert = slotAuswahl.length;
    const geheZu = id => { setSlotOrdner(id); setSlotSortModus(false); setSlotAuswahl([]); };
    return (
      <div data-ordner-navi style={{display:"flex", alignItems:"center", gap:8, marginBottom:8, minHeight:30, position:"sticky", top: headerH + slotH + slotInfoH, zIndex: 7, background:"var(--hintergrund)", padding:"6px 0", ...stil}}>
        {pfadTeile({ alleText: "Alle Quiz", alleAttr: "data-alle-sessions", pfad: ordnerPfad(slots.ordner, slotOrdner), geheZu,
          alleTt: ordnerOffen ? "Zurück zu allen Quiz – Quiz hierher ziehen legt sie auf die oberste Ebene; lang drücken: neues Quiz, fällige wiederholen, neuer Ordner"
            : `Alle Quiz – lang drücken: ${statistik ? "alle Listen anzeigen" : "neues Quiz aus Listen"}, fällige wiederholen, neuer Ordner`,
          alleAktionen, ordnerAktionen, einheit: "Quiz" })}
        {!statistik && !multiAuswahl && !slotSortModus && quizListenUmschalter()}
        {multiAuswahl && (<span style={{display:"flex", gap:6, flexShrink:0}}>
          <button className="typ-btn" data-wahl-alle data-auswahl-durchlass style={{fontSize:"0.75rem", padding:"4px 10px"}}
            onClick={() => setMultiAuswahl(a => [...a, ...slotSichtbarRef.current.filter(id => !a.includes(id))])} {...tt("Alle sichtbaren Quiz auswählen")}>Alle</button>
          <button className="typ-btn" data-wahl-keine data-auswahl-durchlass style={{fontSize:"0.75rem", padding:"4px 10px"}} onClick={() => setMultiAuswahl([])} {...tt("Alle abwählen")}>Keine</button>
        </span>)}
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
        {wahl ? (<>
          <button className="btn btn-ghost" data-wahl-alle data-auswahl-durchlass
            onClick={() => liste ? setListenWahl(a => [...a, ...sichtbareListen.map(x => x.id).filter(id => !a.includes(id))]) : setMultiAuswahl(a => [...a, ...slotSichtbarRef.current.filter(id => !a.includes(id))])}
            {...tt(liste ? "Alle sichtbaren Listen auswählen" : "Alle sichtbaren Quiz auswählen")}>Alle</button>
          <button className="btn btn-ghost" data-wahl-keine data-auswahl-durchlass onClick={() => liste ? setListenWahl([]) : setMultiAuswahl([])} {...tt("Alle abwählen")}>Keine</button>
        </>) : sort ? (
          <button className="btn btn-primary" {...(liste ? { "data-listen-fertig": true } : { "data-slot-fertig": true })}
            onClick={() => { if (liste) { setListenSortModus(false); setListenAuswahl([]); } else { setSlotSortModus(false); setSlotAuswahl([]); } setSlotDragId(null); setSlotDragZiel(null); }}
            {...tt("Verschieben beenden – Kacheln antippen markiert (mehrere möglich), dann freien Platz antippen; oder direkt ziehen")}>Fertig{markiert ? ` · ${markiert} markiert` : ""}</button>
        ) : null}
      </div>
    );
  }

export function renderSlotBereiche(app, neuChip, onLaden, slotRef, abstand = 0) {
  const { FORTSCHRITT_FELD, aktiverSlot, angehoben, auswahlTafel, auswahlTafelDaten, auswahlTafelRef, blaettern, blitzt, chipStil, einstellungen, faelligAktion, faelligVonSlots, gruppenZiel, kopieName, lasso, lernstandJeArt, leuchte, loeseOrdnerAuf, minSpalten, multiAuswahl, multiVonSlot, neuImOrdnerRef, neuPlatzRef, plaetzeRef, quizAbfrageArt, quizArt, renderSlotChip, setAuswahlLoeschen, setBlaettern, setInGruppe, setListenAendern, setLoescheSlotNr, setModal, setMultiAuswahl, setNeueSessionSchritt, setOrdnerUmbenennen, setSlotAuswahl, setSlotOrdner, setSlotSektionAufgeklappt, setSlotSortModus, setSlotUmbenennen, setSlotVorschau, setSlotVorschauListe, setVerlaufOffen, setVonBis, setzeSlotPlaetze, slotAuswahl, slotChipLabel, slotDragId, slotDragZiel, slotGezogenRef, slotOrdner, slotSichtbar, slotSichtbarRef, slotSortModus, slotVorschau, slotZiehenRef, slots, sprachFilter, starteMultiquiz, statistikArt, stelleMultiquizEin, tab, tt, ttFeld, uebernimmSlots, verlaufOffen, verschiebeInOrdner, verweilGeht, wahlUmschaltenRef } = app;
    // Lernfortschritt je Art für die Mini-Kreise (jede Liste nur einmal lesen)
    const listenCache = new Map();
    const listeVon = id => { if (!listenCache.has(id)) listenCache.set(id, lsGet(SK.liste(id))); return listenCache.get(id); };
    const aktArt = tab === "statistik" ? statistikArt : quizArt;
    const kachelVoks = x => {
      const k = x.konfiguration || {};
      let voks = (k.listenIds || []).flatMap(id => (listeVon(id)?.vokabeln || []).map(v => ({ ...v, _key: `${id}__${v.id}`, _listeId: id })));
      if (k.bereichTyp === "bereich" && k.vokabelAuswahl?.length) { const a = new Set(k.vokabelAuswahl); voks = voks.filter(v => a.has(v._key)); }
      return voks;
    };
    const lernstandCache = new Map();
    const lernstand = x => { if (!lernstandCache.has(x.id)) lernstandCache.set(x.id, lernstandJeArt(kachelVoks(x))); return lernstandCache.get(x.id); };
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
    const platzMap = new Map(raster.gespeichert.map(x => [`${x.platz.z}|${x.platz.s}`, x]));
    const sichtbar = raster.gespeichert.filter(x => sichtbarE(x) && !x.istOrdner);
    slotSichtbarRef.current = sichtbar.map(x => x.id);
    plaetzeRef.current.slot = sichtbar.map(x => ({ id: x.id, z: x.platz.z, s: x.platz.s }));
    const ebeneLeer = raster.gespeichert.length === 0;   // 194: leerer Ordner – eine Zeile freier Plätze zeigen
    const anzSpalten = ebenenSpalten(raster.gespeichert, slotSortModus, minSpalten("slot", ordnerOffen?.id || null));   // 196/203: belegt bzw. gewählt (+1 beim Verschieben)
    const kurzText = ebenenSpalten(raster.gespeichert, false, minSpalten("slot", ordnerOffen?.id || null)) > 1;   // 210: ab 2 Spalten abgekürzt
    const ordnerHierGeht = ordnerPfad(slots.ordner, ordnerOffen?.id || null).length < ORDNER_TIEFE_MAX;
    const zeilenSichtbar = Math.max(ebeneLeer && ordnerOffen ? 1 : 0, raster.gespeichert.filter(sichtbarE).reduce((m, x) => Math.max(m, x.platz.z + 1), 0));
    // 214: sind alle angezeigten Plätze belegt, eine Zeile mehr – damit es immer einen freien Platz (Lang-Druck) gibt
    const alleBelegt = zeilenSichtbar > 0 && raster.gespeichert.filter(x => x.platz.z < zeilenSichtbar && x.platz.s < anzSpalten).length >= zeilenSichtbar * anzSpalten;
    const zeilenAnzeige = slotSortModus ? raster.gespeichert.reduce((m, x) => Math.max(m, x.platz.z + 1), 0) + RASTER_FREI_ZEILEN
      : zeilenSichtbar + (alleBelegt ? 1 : 0);
    const sfVon = x => slotSFAlle(x)[aktiverSlot?.id === x.id ? quizAbfrageArt : slotKonfigArt(x)];
    // Auswahl-Modus: Aktionen für die Auswahl (Lang-Druck auf eine nicht gewählte Kachel nimmt sie dazu)
    const wahlMit = x => multiAuswahl.includes(x.id) ? multiAuswahl : [...multiAuswahl, x.id];
    const wahlMenue = ids => [
      ...(ids.length >= 2 ? [tab === "quiz" ? { label: `🧩 Multiquiz starten (${ids.length})`, fn: () => starteMultiquiz(ids) } : { label: `🧩 Multiquiz (${ids.length})`, fn: () => stelleMultiquizEin(ids) }] : []),
      ...(() => { const f = faelligVonSlots(ids); return faelligAktion(f); })(),
      { label: `📁 In Ordner… (${ids.length})`, fn: () => setInGruppe({ ids, name: "" }) },
      ...(ordnerOffen ? [{ label: `↑ Aus dem Ordner (${ids.length})`, fn: () => verschiebeInOrdner(ids, hoch) }] : []),
      { label: "⇄ Verschieben", fn: () => { setMultiAuswahl(null); setSlotSortModus(true); setSlotAuswahl(ids); } },
      { label: `🗑 Löschen (${ids.length})`, gefahr: true, fn: () => setAuswahlLoeschen({ art: "slot", ids }) },
      { label: "↔ Von–Bis", behalten: true, fn: () => setVonBis({ art: "slot", id: ids[ids.length - 1] }) },
      { label: "✕ Auswahl beenden", fn: () => setMultiAuswahl(null) },
    ];
    const wahlNamen = ids => ids.map(id => slots.gespeichert.find(g => g.id === id)?.name).filter(Boolean).join(", ");
    const einzelMenue = x => [
      { label: "✎ Umbenennen", fn: () => setSlotUmbenennen({ id: x.id, name: x.name }) },
      { label: "⧉ Duplizieren", fn: () => setSlotUmbenennen({ id: x.id, name: kopieName(x.name), kopie: true }) },
      { label: "⇄ Verschieben", fn: () => { setMultiAuswahl(null); setSlotSortModus(true); setSlotAuswahl([x.id]); } },
      { label: "☑ Auswählen", behalten: true, fn: () => { setSlotSortModus(false); setMultiAuswahl([x.id]); } },
      { label: "📁 In Ordner…", fn: () => setInGruppe({ ids: [x.id], name: "" }) },
      ...(ordnerOffen ? [{ label: "↑ Aus dem Ordner", fn: () => verschiebeInOrdner([x.id], hoch) }] : []),
      { label: "📝 Listen/Vokabeln ändern", fn: () => { if (slotRef?.id !== x.id) onLaden('gespeichert', x.id); setListenAendern(true); setSlotSektionAufgeklappt(false); } },
      ...(() => { const f = faelligVonSlots([x.id]); return faelligAktion(f); })(),
      { label: "🗑 Löschen", gefahr: true, fn: () => setLoescheSlotNr({ typ: 'gespeichert', id: x.id }) },
    ];
    // Auswahl-Tafel: ein Quiz → ihr Menü, mehrere → Aktionen für die Auswahl
    const tafelInhalt = ids => {
      const x = ids.length === 1 && slots.gespeichert.find(g => g.id === ids[0]);
      if (x) return { text: x.name, aktionen: [...einzelMenue(x).filter(a => a.label !== "☑ Auswählen"), { label: "↔ Von–Bis", behalten: true, fn: () => setVonBis({ art: "slot", id: x.id }) }, { label: "✕ Auswahl beenden", fn: () => setMultiAuswahl(null) }] };
      return ids.length ? { text: `${ids.length} ausgewählt: ${wahlNamen(ids)}`, aktionen: wahlMenue(ids) } : { text: "Nichts ausgewählt – Quiz antippen", aktionen: [] };
    };
    auswahlTafelDaten.current.slot = () => multiAuswahl && tafelInhalt(multiAuswahl);
    // Ziehen: diese Kacheln wandern mit; über einer anderen verweilen bildet eine Gruppe (nur oberste Ebene, keine Gruppen in Gruppen)
    const ziehIds = slotDragId ? (slotAuswahl.includes(slotDragId) ? slotAuswahl : [slotDragId]) : [];
    const gruppierbar = !!slotDragId;   // 193: Ring nur, wenn der Verweil-Effekt ein Ziel setzt (prüft Tiefe und Ordner)
    const tippeImRaster = (x, platz) => {
      if (slotGezogenRef.current) { slotGezogenRef.current = false; return; }
      if (x) { setSlotAuswahl(a => a.includes(x.id) ? a.filter(v => v !== x.id) : [...a, x.id]); return; }
      if (slotAuswahl.length) setzeSlotPlaetze(slotAuswahl, platz);
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
        const inhalt = (<>
          <span className="raster-kopf">
            <span className="raster-name">{x.istOrdner && <span aria-hidden="true">📁 </span>}{x.multi && <span aria-hidden="true">🧩 </span>}{x.name}{x.istOrdner && <span className="ordner-anzahl" data-ordner-anzahl={kinder.length}> · {kinder.length} {kurzText ? "Q." : "Quiz"}</span>}</span>
            <span className="raster-anz" data-vok-anzahl={vokAnz}>{zahlDe(vokAnz)} {kurzText ? "V." : "Vokabeln"}</span>
          </span>
          <span className="raster-fuss" data-kachel-balken={pct} {...ttFeld(`Lernfortschritt Übersetzung: ${pct} %`)}>
            <span className={`kachel-balken${pct >= 100 ? " voll" : ""}`}><span style={{width:`${pct}%`}}/></span>
            {pct >= 100 && <span className="kachel-voll" title="100 % gelernt">✓</span>}
          </span>
        </>);
        zellen.push(slotSortModus ? (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} data-ordner-id={x.istOrdner ? x.id : undefined} className={`slot-chip belegt raster-chip${x.istOrdner ? " ordner-kachel" : ""}`}
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
                <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/></svg><span data-ring-symbol={gruppenZiel === key ? "ordner" : "tauschen"}>{gruppenZiel === key ? "📁" : "⇄"}</span>
              </span>
            ) : null}
          </button>
        ) : x.istOrdner ? (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} data-ordner-id={x.id} data-kachel-geste="ordner" data-kachel-zieh="" data-angehoben={angehoben === x.id ? "" : undefined}
            className={`slot-chip belegt raster-chip ordner-kachel${slotRef?.typ === "gespeichert" && kinder.some(k => k.id === slotRef.id) ? " ordner-aktiv" : ""}`}
            data-heute={heuteP}
            style={{position:"relative", ...(heuteP > 0 ? { backgroundImage: `linear-gradient(to right, var(--heute-farbe) ${heuteP}%, transparent ${heuteP}%)` } : {})}}
            onClick={() => { if (slotGezogenRef.current) { slotGezogenRef.current = false; return; } if (!multiAuswahl) setSlotOrdner(x.id); }}
            {...tt(`Ordner „${x.name}“ mit ${kinder.length} Quiz – antippen öffnet ihn`, multiAuswahl ? [] : [
              { label: "📂 Öffnen", fn: () => setSlotOrdner(x.id) },
              ...(kinder.length >= 2 ? [{ label: `🧩 Multiquiz des Ordners (${kinder.length})`, fn: () => tab === "quiz" ? starteMultiquiz(kinder.map(k => k.id)) : stelleMultiquizEin(kinder.map(k => k.id)) }] : []),
              { label: "✎ Umbenennen", fn: () => setOrdnerUmbenennen({ id: x.id, name: x.name }) },
              { label: "⇄ Verschieben", fn: () => { setMultiAuswahl(null); setSlotSortModus(true); setSlotAuswahl([x.id]); } },
              { label: "📁 In Ordner…", fn: () => setInGruppe({ ids: [x.id], name: "" }) },
              ...(ordnerOffen ? [{ label: "↑ Aus dem Ordner", fn: () => verschiebeInOrdner([x.id], hoch) }] : []),
              ...(ordnerPfad(slots.ordner, x.id).length < ORDNER_TIEFE_MAX ? [{ label: "📁 Neuer Ordner darin", fn: () => setInGruppe({ ids: [], name: "", eltern: x.id }) }] : []),
              (kinder.length || (slots.ordner || []).some(o => o.ordner === x.id)) ? { label: "📤 Ordner auflösen", fn: () => loeseOrdnerAuf(x.id) } : { label: "🗑 Ordner löschen", gefahr: true, fn: () => loeseOrdnerAuf(x.id) },
            ], { langText: `📁 ${x.name}`,
                 beimZeigen: (px, py) => { slotZiehenRef.current = { id: x.id, x: px, y: py, aktiv: false, langdruck: true }; } })}>
            {inhalt}
            {null}
          </button>
        ) : (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} data-multi-nr={multiNr || undefined} data-auswahl-durchlass
            data-kachel-geste="slot" data-kachel-zieh="" data-angehoben={angehoben === x.id ? "" : undefined}
            data-heute={heuteP}
            className={`slot-chip belegt raster-chip${
              multiNr || teilNr || (lasso?.art === "slot" && lasso.ids.includes(x.id)) || (!multiAuswahl && (slotVorschau ? slotVorschau.typ === "gespeichert" && slotVorschau.id === x.id : slotRef?.typ === "gespeichert" && slotRef?.id === x.id)) ? " kachel-gewaehlt" : ""}${blitzt(`slot:${x.id}`)}`}
            data-vorschau={slotVorschau?.typ === "gespeichert" && slotVorschau.id === x.id ? "" : undefined}
            style={{...chipStil('gespeichert', x.id, slotRef), position:"relative",
              ...(heuteP > 0 ? { backgroundImage: `linear-gradient(to right, var(--heute-farbe) ${heuteP}%, transparent ${heuteP}%)` } : {})}}
            onClick={() => multiAuswahl
              ? (schliesseInfo(), auswahlTafelRef.current = null, setMultiAuswahl(null), setBlaettern(true), leuchte(`slot:${x.id}`, BLITZ_MS / 2), setSlotVorschauListe(false), setTimeout(() => setSlotVorschau({ typ: "gespeichert", id: x.id }), 0))
              : blaettern ? (leuchte(`slot:${x.id}`, BLITZ_MS / 2), setSlotVorschauListe(false), setSlotVorschau({ typ: "gespeichert", id: x.id }))
              : uebernimmSlots([x.id])}   // 192: antippen übernimmt sofort – außer im Blätter-Modus (nach einem Lang-Druck)
            {...(() => {
              // Lang-Druck (Maus: Rechtsklick): Quiz kommt in die Auswahl, die Tafel bleibt unten offen (weitere antippen wählt mit aus);
              // Touch: Haltestufen (kurz halten + ziehen verschiebt, lang halten + fahren wählt aus)
              const tafel = tafelInhalt(multiAuswahl ? wahlMit(x) : [x.id]);
              return tt(`${x.name} – antippen: laden (nach einem Lang-Druck: nur auswählen, laden mit dem grünen Knopf); kurz halten: auswählen; lang halten: Mehrfach-Auswahl (darin kurz halten: dazu/heraus, lang halten: übernehmen)`, tafel.aktionen,
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
          {...tt("Freier Platz – lang drücken: neues Quiz oder neuer Ordner genau hier", [
            ...(tab === "statistik" ? [] : [{ label: "＋ Neues Quiz aus Listen", fn: () => { neuImOrdnerRef.current = ordnerOffen?.id || null; neuPlatzRef.current = { ordner: ordnerOffen?.id || null, platz: { z, s: sp } }; setNeueSessionSchritt("art"); setModal("neue-session"); } }]),
            ...(ordnerHierGeht ? [{ label: "📁 Neuer Ordner", fn: () => setInGruppe({ ids: [], name: "", platz: { z, s: sp } }) }] : [])])}/>);
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
