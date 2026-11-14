import { FORTSCHRITT_BALKEN, GRUPPE_BALKEN, clampScore, heuteAbgefragt, heuteAnteil, istFaellig, lernProzent, nrText, ohneHinweis, scoreSymbole, slotKonfigArt, slotSFAlle, statistikSicht } from "../quiz.jsx";
import { SK, TYPEN, formatDatum, lsGet } from "../speicher.js";
import { listeSprache, sprachInfo } from "../sprache.js";
import { listenInhalt } from "../saetze.js";

// Phase 2 (Aufteilung): Zeichen-Funktionen aus App.jsx. app = die Namen der Komponente, die sie brauchen.

// Statistik-Vollbild: Kopfzeile zeigt den Lernfortschritt der EINGEBLENDETEN Gruppen
export function renderVollbildKopf(app) {
  const { einstellungen, statistikArt, statistikFilter, statistikGefilterteVoks, tt } = app;
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    const gruppe = v => !v.fortschritt ? "nie" : v.fortschritt.score < 0 ? "negativ"
      : (schwelle > 0 && v.fortschritt.score >= schwelle) ? "gelernt" : "arbeit";
    const voks = statistikSicht(statistikGefilterteVoks, statistikArt).filter(v => statistikFilter.has(gruppe(v)));
    const anzahl = { gelernt: 0, arbeit: 0, nie: 0, negativ: 0 };
    voks.forEach(v => { anzahl[gruppe(v)]++; });
    const abgefragt = voks.filter(v => v.fortschritt);
    const avg = abgefragt.length ? abgefragt.reduce((sum, v) => sum + v.fortschritt.score, 0) / abgefragt.length : null;
    return (
      <div className="topbar-title" style={{display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"0 44px"}}
        {...tt("Lernfortschritt der eingeblendeten Gruppen")}>
        {schwelle > 0
          ? <span style={{fontWeight:800, fontSize:"1.1rem", color:"var(--haupt)", lineHeight:1}}>{Math.round(lernProzent(voks.map(v => v.fortschritt?.score), schwelle))} %</span>
          : <span style={{fontWeight:800, fontSize:"1.1rem", color:"var(--haupt)", lineHeight:1}}>Ø {avg === null ? "–" : `${avg > 0 ? "+" : ""}${avg.toFixed(1)}`}</span>}
        <div style={{display:"flex", width:"min(200px, 100%)", height:6, borderRadius:3, overflow:"hidden", background:"var(--flaeche)"}}>
          {voks.length > 0 && FORTSCHRITT_BALKEN.map(([g, farbe]) => anzahl[g] > 0 && (
            <div key={g} style={{width:`${anzahl[g] / voks.length * 100}%`, background:farbe}}/>
          ))}
        </div>
        <span style={{fontSize:"0.68rem", fontWeight:500, color:"var(--text2)", lineHeight:1}}>
          {schwelle > 0 ? `${anzahl.gelernt} / ${voks.length} gelernt` : `${voks.length} Vokabeln`}
        </span>
      </div>
    );
  }

// Listen-Auswahl: die Knopfzeile oben wird zum grünen Bestätigen-Knopf („☑ n ausgewählt / ✓ Bestätigen“) – antippen beendet die Auswahl
export function listenWahlKopf(app) {
  const { blitzt, exportKopiert, headerH, listenWahl, listenWahlMenue, setListenWahl, tt } = app;
    const n = listenWahl.length;
    return (
      <div className="quiz-zeile" data-einst-zeile="listen-wahl" style={{top: headerH, marginBottom:0}}>
        <div className="quiz-zeile-zelle offen"><span className="quiz-zeile-label">Auswahl</span>
          <button className={`quiz-zeile-knopf offen bestaetigen-knopf zweizeilig${blitzt("wahl")}`} data-wahl-fertig data-wahl-hinweis data-auswahl-durchlass
            onClick={() => setListenWahl(null)}
            {...tt(n ? "Auswahl beenden; lang drücken: Exportieren, Verschieben, Löschen" : "Auswahl beenden", n ? listenWahlMenue(listenWahl) : null, { langText: `${n} ausgewählt` })}>
            <span className="zeile1" data-wahl-anzahl={n}>{exportKopiert ? "✓ In die Zwischenablage kopiert" : n ? `☑ ${n} ausgewählt` : "Nichts ausgewählt"}</span>
            <span className="zeile2" data-bestaetigen>✓ Bestätigen</span>
          </button>
        </div>
      </div>
    );
  }

// Einstellungen › Listen: angetippte Liste – Knopfzeile wird grün „‹Name› öffnen“, darunter die Info (wie bei den Quiz)
export function listeOeffnenKopf(app, l) {
  const { blitzt, headerH, listenMenue, oeffneListeDetail, setListeVorschau, tt } = app;
    return (
      <div className="quiz-zeile" data-einst-zeile="liste-oeffnen" style={{top: headerH, marginBottom:0}}>
        <div className="quiz-zeile-zelle offen"><span className="quiz-zeile-label">Liste</span>
          <button className={`quiz-zeile-knopf offen bestaetigen-knopf${blitzt("lw")}`} data-liste-oeffnen={l.id}
            onClick={() => { setListeVorschau(null); oeffneListeDetail(l.id); }}
            {...tt(`„${l.name}“ öffnen: Vokabeln, Spalten, Sprache, Beispielsätze`, listenMenue(l), { langText: l.name })}>
            <span data-bestaetigen>{l.name} öffnen</span>
          </button>
        </div>
      </div>
    );
  }

export function renderListeInfo(app, l, mehrere = null) {
  const { einstellungen, gruppenKurz, infoKlapp, infoZu, lernstandJeArt, renderMiniKreise, satzStand, tt } = app;
    const gruppeL = (mehrere || [l]).map(x => ({ x, liste: lsGet(SK.liste(x.id)) })).filter(y => y.liste);
    if (!gruppeL.length) return null;
    const liste = gruppeL[0].liste;
    const ausAnz = gruppeL.reduce((a, y) => a + y.liste.vokabeln.filter(v => v.herausgenommen).length, 0);   // 176
    const voks = gruppeL.flatMap(y => y.liste.vokabeln.filter(v => !v.herausgenommen).map(v => ({ ...v, _listeId: y.x.id })));
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    const gruppe = v => !v.fortschritt ? "nie" : v.fortschritt.score < 0 ? "negativ" : schwelle > 0 && v.fortschritt.score >= schwelle ? "gelernt" : "arbeit";
    const anz = { gelernt: 0, arbeit: 0, nie: 0, negativ: 0 };
    voks.forEach(v => { anz[gruppe(v)]++; });
    const zuletzt = voks.flatMap(v => [v.fortschritt, v.diktatFortschritt, v.akzentFortschritt].map(f => f?.letzteAbfrage).filter(Boolean)).sort().pop() || null;
    const pct = Math.round(lernProzent(voks.map(v => v.fortschritt?.score), schwelle));
    const spalten = mehrere ? gruppeL.map(y => y.x.name) : TYPEN.filter(x => liste.spalten[x]?.aktiv).map(x => liste.spalten[x].name || x);
    const gruppenText = gruppenKurz(anz, null, ausAnz ? `🚫 ${ausAnz}` : null);
    const zu = infoZu;
    return (
      <div className="slot-info" data-liste-info={mehrere ? "_wahl" : l.id} data-auswahl-durchlass data-slot-info-zu={zu ? "" : undefined} onClick={infoKlapp} style={{position:"static", marginLeft:-16, marginRight:-16}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <div style={{flex:1, minWidth:0}}>
            <div data-slot-info-name style={{fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{mehrere ? `${mehrere.length} Listen ausgewählt` : `${sprachInfo(listeSprache(l)).flagge} ${l.name}`}
              {zu && schwelle > 0 && voks.length > 0 && <span style={{fontWeight:500, color:"var(--text2)"}}> · <span data-gelernt-haken style={{color:"var(--gelernt)", fontWeight:800}}>✓</span> {pct} % gelernt</span>}</div>
            {!zu && <div data-liste-info-spalten style={{fontSize:"0.8rem", color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>({spalten.join(" · ")})</div>}
          </div>
          {!zu && voks.length > 0 && schwelle > 0 && <span className="mini-kreise" style={{gap:4, flexShrink:0}}>{renderMiniKreise(lernstandJeArt(voks, mehrere ? null : l.id), { groesse: 26, nurVerfuegbar: true })}</span>}
          <span className="slot-info-pfeil" data-slot-info-pfeil={zu ? "zu" : "auf"}
            {...tt(zu ? "Info aufklappen – auch Antippen der Fläche (bleibt so)" : "Info auf eine Zeile einklappen – auch Antippen der Fläche (bleibt so)")}>{zu ? "▼" : "▲"}</span>
        </div>
        {!zu && (<>
          <div data-liste-info-zahlen={voks.length} style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8, marginTop:8, fontSize:"0.85rem"}}>
            <b>{voks.length} Vokabel{voks.length !== 1 ? "n" : ""}</b>{schwelle > 0 && voks.length > 0 && <span><span data-gelernt-haken style={{color:"var(--gelernt)", fontWeight:800}}>✓</span> {pct} % gelernt</span>}
          </div>
          <div className="vorschau-balken" style={{display:"flex", height:8, borderRadius:4, overflow:"hidden", margin:"6px 0 4px", background:"var(--rahmen)"}}>
            {GRUPPE_BALKEN.filter(([g]) => anz[g]).map(([g, farbe]) => <span key={g} data-gruppe={g} style={{width:`${anz[g] / Math.max(1, voks.length) * 100}%`, background:farbe}}/>)}
          </div>
          <div className="info-zeile-klein">
            <span style={{flexShrink:0}}>Zuletzt abgefragt: {zuletzt ? formatDatum(zuletzt) : "noch nie"}</span>
            <span className="info-gruppen">{gruppenText}</span>
          </div>
          {(() => {   // 202: Inhalt ausführlich – Beispielsätze und Synonyme
            const inh = gruppeL.reduce((x, y) => { const i = listenInhalt(y.liste, satzStand); return { saetze: x.saetze + i.saetze, synonyme: x.synonyme + i.synonyme }; }, { saetze: 0, synonyme: 0 });
            return (
              <div className="info-zeile-klein" data-liste-info-inhalt={`${inh.saetze}|${inh.synonyme}`}>
                <span>💬 {inh.saetze ? `${inh.saetze} Beispielsätze` : "keine Beispielsätze"}</span>
                <span>≈ {inh.synonyme ? `${inh.synonyme} Synonyme` : "keine Synonyme"}</span>
              </div>
            );
          })()}
        </>)}
      </div>
    );
  }

export function renderSlotKopf(app, statistik) {
  const { aktiverSlot, auswahlTafelDaten, beendeMultiAuswahl, blitzt, einListenName, getSlotEintrag, headerH, kopieName, ladeSlot, ladeSlotStatistik, lernstandJeArt, leuchte, listenAendern, listenFlagge, listenIndex, multiAuswahl, multiVonSlot, multiZusammenstellung, oeffneListeDetail, quizArt, quizBereichTyp, quizCheckboxAuswahl, quizErstellen, quizKombiListe, quizTabListen, quizVokMax, renderMiniKreise, sessionSpeicherAktionen, setErstellenFenster, setListenAendern, setListenAuswahlAufgeklappt, setLoescheSlotNr, setQuizListeAufgeklappt, setSlotSektionAufgeklappt, setSlotUmbenennen, setSlotVorschau, setSlotVorschauListe, setStatistikArt, sichtbareListen, slotOrdner, slotSektionAufgeklappt, slotSektionRef, slotVorschau, starteQuizErstellen, statistikAktiverSlot, statistikArt, statistikBasisVoks, statistikBereichTyp, statistikCheckboxAuswahl, statistikListenIds, statistikSlotGeleert, toggleSlotSektion, tt, vokabelgruppeGeaendert, vonBis, wechsleQuizArt } = app;
    const zu = !slotSektionAufgeklappt;
    const slot = statistik ? statistikAktiverSlot : aktiverSlot;
    const gespeichert = slot?.typ === "gespeichert";
    const alsListe = !statistik && slot?.typ === "listen";   // 217: Kopf zeigt eine Liste
    const listeE = alsListe ? listenIndex.find(l => l.id === slot.id) : null;
    const geaendert = !statistik && vokabelgruppeGeaendert;
    const gruen = (gespeichert || alsListe) && !geaendert;
    const multi = multiVonSlot(slot);
    const name = gespeichert ? (getSlotEintrag("gespeichert", slot.id)?.name || slot.id) : alsListe ? (listeE?.name || "Liste") : multi ? "Multiquiz" : statistik && statistikSlotGeleert ? "Leer" : statistik ? "Neue Auswahl" : (einListenName() || "Neues Quiz");   // 216/217
    const ungespeichert = !statistik && !gespeichert && !multi && !alsListe && !quizErstellen;
    // Vokabeln der Auswahl (für die Kreise) und Info-Zeile
    let voks = [], listenIds = [];
    if (statistik) {
      voks = statistikBasisVoks || [];
      if (statistikBereichTyp === "bereich" && statistikCheckboxAuswahl.size > 0) voks = voks.filter(v => statistikCheckboxAuswahl.has(v.id));
      listenIds = statistikListenIds ? [...statistikListenIds] : sichtbareListen.map(l => l.id);
    } else if (quizKombiListe) {
      voks = quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0 ? quizKombiListe.vokabeln.filter(v => quizCheckboxAuswahl.has(v.id)) : quizKombiListe.vokabeln;
      listenIds = quizTabListen;
    }
    const ls = lernstandJeArt(voks);
    const listenText = listenIds.map(id => listenIndex.find(l => l.id === id)?.name).filter(Boolean).join(" + ") || "keine Liste";
    let bereichText = "";
    const bereichAktiv = statistik ? statistikBereichTyp === "bereich" && statistikCheckboxAuswahl.size > 0 : quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0;
    if (bereichAktiv && listenIds.length === 1) {
      const alle = lsGet(SK.liste(listenIds[0]))?.vokabeln || [];
      const auswahl = statistik ? statistikCheckboxAuswahl : quizCheckboxAuswahl;
      const nr = alle.map((v, i) => auswahl.has(`${listenIds[0]}__${v.id}`) ? i + 1 : null).filter(Boolean);
      bereichText = nr.length && nr[nr.length - 1] - nr[0] + 1 === nr.length ? `Nr. ${nr[0]}–${nr[nr.length - 1]}` : "Auswahl";
    } else if (bereichAktiv) bereichText = "Auswahl";
    const info = [multi ? `🧩 ${multi.map(t => t.name).join(" + ")}` : listenText, multi ? "" : bereichText, `${voks.length} Vokabel${voks.length !== 1 ? "n" : ""}`].filter(Boolean).join(" · ");
    // Lang-Druck (Quiz): Speichern und – bei einer gespeicherten Quiz – dieselbe Verwaltung wie auf ihrer Kachel
    const eintrag = !statistik && gespeichert ? getSlotEintrag("gespeichert", slot.id) : null;
    const verwaltung = eintrag ? [
      { label: "✎ Umbenennen", fn: () => setSlotUmbenennen({ id: eintrag.id, name: eintrag.name }) },
      { label: "⧉ Duplizieren", fn: () => setSlotUmbenennen({ id: eintrag.id, name: kopieName(eintrag.name), kopie: true }) },
      { label: "📝 Listen/Vokabeln ändern", fn: () => { setListenAendern(true); setSlotSektionAufgeklappt(false); } },
      { label: "🗑 Löschen", gefahr: true, fn: () => setLoescheSlotNr({ typ: "gespeichert", id: eintrag.id }) },
    ] : [];
    // 217: Liste – öffnen bzw. daraus ein Quiz erstellen (kein Speichern)
    const listenAktionen = alsListe ? [{ label: "📂 Liste öffnen", fn: () => oeffneListeDetail(slot.id) }, { label: "＋ Quiz erstellen", fn: () => starteQuizErstellen(slot.id) }] : [];
    const alleAktionen = alsListe ? listenAktionen : [...(!statistik ? sessionSpeicherAktionen() || [] : []), ...verwaltung];
    const aktionen = alleAktionen.length ? alleAktionen : null;
    // „Listen/Vokabeln ändern“: der Name wird zum grünen „Bestätigen“ (beendet das Ändern)
    const aendern = !statistik && gespeichert && listenAendern;
    const erstellen = !statistik && !!quizErstellen && !gespeichert && !alsListe;   // 217: grüner Kopf „＋ Quiz erstellen“
    // Mehrfach-Auswahl: der Name zeigt die Auswahl als grünen Bestätigen-Knopf (mehrere → Multiquiz, eine → laden, keine → beenden)
    const wahl = multiAuswahl && !zu;
    // Angetippte Quiz: der Name wird zum grünen „✓ ‹Name› laden“
    const vorschauE = !zu && !wahl && slotVorschau ? getSlotEintrag(slotVorschau.typ, slotVorschau.id) : null;
    const vorschauName = vorschauE ? (vorschauE.multi ? `🧩 ${vorschauE.name}` : vorschauE.istListe ? `📋 ${vorschauE.name}` : vorschauE.name || "Abfrage") : "";
    const wahlText = wahl ? (vonBis?.art === "slot" ? "Von–Bis: Ziel lang drücken" : multiAuswahl.length ? `${multiAuswahl.length} ausgewählt${multiAuswahl.length >= 2 ? ` · ${multiZusammenstellung(multiAuswahl)?.anzahl || 0} Vokabeln` : ""}` : "Nichts ausgewählt") : "";
    // 169: Fortschrittsbalken immer – bei offener Auswahl für das, was der Kopf zeigt (Vorschau bzw. Mehrfachauswahl)
    const kopfVoks = e => { const k = e?.konfiguration || {};
      let v = (k.listenIds || []).flatMap(id => (lsGet(SK.liste(id))?.vokabeln || []).map(x => ({ ...x, _key: `${id}__${x.id}`, _listeId: id })));
      if (k.bereichTyp === "bereich" && k.vokabelAuswahl?.length) { const a = new Set(k.vokabelAuswahl); v = v.filter(x => a.has(x._key)); }
      return v; };
    const balkenVoks = wahl && multiAuswahl.length ? [...new Map(multiAuswahl.flatMap(id => kopfVoks(getSlotEintrag("gespeichert", id))).map(v => [v._key, v])).values()]
      : vorschauE ? kopfVoks(vorschauE) : voks;
    const balkenPct = balkenVoks.length ? Math.round(lernstandJeArt(balkenVoks)[statistik ? statistikArt : quizArt]?.pct || 0) : null;
    const kopfKlick = wahl ? () => beendeMultiAuswahl(multiAuswahl, statistik ? ladeSlotStatistik : ladeSlot)
      : vorschauE ? () => { const s = slotVorschau; setSlotVorschau(null); setSlotVorschauListe(false); (statistik ? ladeSlotStatistik : ladeSlot)(s.typ, s.id); leuchte("slotkopf"); }
      : aendern ? () => { setListenAendern(false); setListenAuswahlAufgeklappt(false); setQuizListeAufgeklappt(false); leuchte("slotkopf"); }
      : erstellen && zu ? () => setErstellenFenster({ name: einListenName() || "Quiz", ordner: slotOrdner || null })
      : toggleSlotSektion;
    return (
      <div ref={slotSektionRef} data-slot-kopf={zu ? (gruen ? "gruen" : "zu") : "offen"} className={`slot-kopf${gruen ? " gruen" : ""}`}
        style={{top:headerH, ...(statistik ? {} : {marginLeft:"-16px", marginRight:"-16px"}), ...(!statistik && quizVokMax ? {display:"none"} : {})}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <button onClick={kopfKlick} className={`toggle-opt aktiv slot-kopf-name${wahl || aendern || vorschauE || !zu || (erstellen && zu) ? " bestaetigen-knopf" : ""}${(alsListe && !wahl && !vorschauE) || vorschauE?.istListe ? " eckig" : ""}${blitzt("slotkopf")}`} data-slot-kopf-name data-geaendert={geaendert ? "" : undefined}
            data-kopf-art={alsListe ? "liste" : erstellen ? "erstellen" : gespeichert ? "quiz" : undefined}
            {...(wahl ? { "data-wahl-fertig": true, "data-wahl-hinweis": true, "data-auswahl-durchlass": true } : {})} {...(aendern ? { "data-aendern-bestaetigen": true } : {})}
            {...(vorschauE ? { "data-slot-laden": `${slotVorschau.typ}:${slotVorschau.id}` } : {})}
            style={geaendert && zu && !aendern ? {background:"var(--falsch)", color:"var(--auf-falsch)"} : undefined}
            {...tt(wahl ? "Auswahl übernehmen: mehrere → Multiquiz (Einstellungen von Nr. 1), eine → dieses Quiz laden, keine → Auswahl beenden"
              : vorschauE ? `„${vorschauName}“ laden (Listen, Vokabelauswahl, Einstellungen, Fortschritt)`
              : aendern ? "Ändern beenden – Listen und Vokabeln übernehmen"
              : geaendert ? `${name} – Vokabelauswahl geändert, noch nicht gespeichert; lang drücken: überspeichern, als neues Quiz speichern, verwerfen, umbenennen, duplizieren, Vokabeln ändern oder löschen`
              : gespeichert ? `${name} – antippen: gespeicherte Konfigurationen anzeigen${aktionen ? "; lang drücken: speichern, umbenennen, duplizieren, Vokabeln ändern, löschen" : ""}` : `Verlauf und Gespeichert anzeigen${aktionen ? "; lang drücken: speichern" : ""}`, (wahl ? (auswahlTafelDaten.current.slot?.()?.aktionen || null) : aktionen), { langText: name })}>
            {balkenPct !== null && <span className="kopf-balken" data-kopf-balken={balkenPct}><span style={{width:`${balkenPct}%`}}/></span>}
            {wahl ? <span data-wahl-anzahl={multiAuswahl.length}>{wahlText}</span> : vorschauE ? <span data-bestaetigen>{vorschauName} laden</span> : aendern ? <span data-bestaetigen>Bestätigen</span>
              : erstellen && zu ? <span data-bestaetigen>＋ Quiz erstellen</span>
              : <>{alsListe && <span aria-hidden="true" data-kopf-liste>📋 {listeE ? listenFlagge(listeE) : ""}</span>}{name}{ungespeichert && <span data-nicht-gespeichert style={{fontSize:"0.72em", fontWeight:500, opacity:0.8, marginLeft:8}}>nicht gespeichert</span>}</>}
          </button>
          {voks.length > 0 && !zu && statistik && (
            <span className="mini-kreise" {...(statistik ? { "data-statistik-arten": true } : { "data-quiz-arten": true })} style={{gap:4, flexShrink:0}}>
              {renderMiniKreise(ls, { aktiv: statistik ? statistikArt : quizArt, beiKlick: a => statistik ? setStatistikArt(a) : wechsleQuizArt(a),
                groesse: 30, aufGruen: gruen, attr: statistik ? "data-statistik-art" : "data-quiz-art", nurVerfuegbar: true })}
            </span>
          )}
        </div>
      </div>
    );
  }

// feststehend unter dem Kopf (Quiz und Vokabel-Liste scrollen darunter hindurch), mit dem Pfeil auf eine Zeile einklappbar (gespeichert);
// „📋 Vokabeln ansehen“ hängt die enthaltenen Vokabeln mit Listen-Nr. darunter an (Lücken als Trennzeile)
// Gruppen kurz und einzeilig: „● 112 ✓ · ● 98 in Arbeit · ● 2850 nie · ● 11 ✗“ – der Punkt in der Farbe des Balken-Abschnitts (185)
export function gruppenKurz(app, anz, vorn = null, hinten = null) {
  const {  } = app;
    const farbe = Object.fromEntries(GRUPPE_BALKEN);
    const teile = [["gelernt", "✓"], ["arbeit", "in Arbeit"], ["nie", "nie"], ["negativ", "✗"]].filter(([g]) => anz[g])
      .map(([g, l]) => <span key={g} data-gruppe-text={g}><span className="gruppen-punkt" style={{background:farbe[g]}}/>{anz[g]} {l}</span>);
    return [vorn, ...teile, hinten].filter(Boolean).flatMap((x, i) => i ? [" · ", x] : [x]);
  }

// 219: zuklappen schließt auch die Vokabel-Liste
export function renderSlotInfo(app, statistik) {
  const { FORTSCHRITT_FELD, einstellungen, getSlotEintrag, gruppenKurz, headerH, infoEintrag, infoKlapp, infoZu, lernstandJeArt, listenIndex, quizArt, renderMiniKreise, setSlotVorschauListe, slotH, slotInfoRefCb, slotVorschauListe, slots, statistikArt, tt } = app;
    const eintrag = infoEintrag(statistik);
    if (!eintrag) return null;
    const multi = eintrag.multi;
    const k = eintrag.konfiguration || {};
    const ks = multi ? multi.map(m => getSlotEintrag("gespeichert", m.id)?.konfiguration).filter(Boolean) : [k];
    const listenIds = [...new Set(ks.flatMap(x => x.listenIds || []))];
    const auswahl = new Set(ks.flatMap(x => x.bereichTyp === "bereich" && (x.vokabelAuswahl || []).length ? x.vokabelAuswahl : (x.listenIds || []).map(id => `${id}__*`)));
    const teile = listenIds.map(id => {
      const liste = lsGet(SK.liste(id));
      if (!liste) return null;
      const voks = [];
      liste.vokabeln.forEach((v, i) => { if (!v.herausgenommen && (auswahl.has(`${id}__*`) || auswahl.has(`${id}__${v.id}`))) voks.push({ ...v, _nr: i + 1, _listeId: id }); });
      return { id, liste, idx: listenIndex.find(l => l.id === id) || liste, voks, ganz: voks.length === liste.vokabeln.filter(v => !v.herausgenommen).length };
    }).filter(Boolean);
    const alle = teile.flatMap(x => x.voks);
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    const gruppe = v => !v.fortschritt ? "nie" : v.fortschritt.score < 0 ? "negativ" : schwelle > 0 && v.fortschritt.score >= schwelle ? "gelernt" : "arbeit";
    const anz = { gelernt: 0, arbeit: 0, nie: 0, negativ: 0 };
    alle.forEach(v => { anz[gruppe(v)]++; });
    const zuletzt = alle.flatMap(v => [v.fortschritt, v.diktatFortschritt, v.akzentFortschritt].map(f => f?.letzteAbfrage).filter(Boolean)).sort().pop() || null;
    const ls = lernstandJeArt(alle);
    const pct = Math.round(lernProzent(alle.map(v => v.fortschritt?.score), schwelle));
    const sf = eintrag.konfiguration ? slotSFAlle(eintrag)[slotKonfigArt(eintrag)] : null;
    const faelligN = alle.filter(v => istFaellig(v[FORTSCHRITT_FELD[quizArt] || "fortschritt"])).length;
    const gruppenText = gruppenKurz(anz, faelligN ? `🔁 ${faelligN} fällig` : null);
    // 184: Anteil der heute (in der gewählten Abfrageart) abgefragten – wie die Füllung der Kachel
    const heuteFeld = FORTSCHRITT_FELD[statistik ? statistikArt : quizArt] || "fortschritt";
    const heuteP = heuteAnteil(alle, heuteFeld, schwelle);
    const zu = infoZu;
    // Name wie im Kopf: gespeichertes Quiz → ihr Name; Multiquiz aus dem Verlauf → seine Teile; Verlauf → Datum
    const gespeichert = slots.gespeichert.some(g => g.id === eintrag.id);
    const name = eintrag.id === "_wahl" ? eintrag.name : `${multi ? "🧩 " : ""}${gespeichert ? eintrag.name : multi ? multi.map(m => m.name).join(" + ") : eintrag.id === "_auswahl" ? eintrag.name : eintrag.istListe ? `📋 ${eintrag.name}` : `🕘 ${eintrag.name || "Abfrage"}`}`;   // 217: Liste mit 📋
    const listenText = teile.map(x => `${sprachInfo(listeSprache(x.idx)).flagge} ${x.liste.name} · ${x.ganz ? `alle ${x.voks.length}` : `Nr. ${nrText(x.voks.map(v => v._nr))}`}`).join(" + ");
    return (<>
      <div ref={slotInfoRefCb} className="slot-info" data-slot-info={eintrag.id} data-slot-vorschau={eintrag.id} data-slot-info-zu={zu ? "" : undefined} data-auswahl-durchlass onClick={infoKlapp}
        style={{top: headerH + slotH, ...(statistik ? {} : {marginLeft:-16, marginRight:-16})}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <div style={{flex:1, minWidth:0}}>
            <div data-slot-info-name style={{fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
              {name}{zu && schwelle > 0 && alle.length > 0 && <span style={{fontWeight:500, color:"var(--text2)"}}> · <span data-gelernt-haken style={{color:"var(--gelernt)", fontWeight:800}}>✓</span> {pct} % gelernt</span>}</div>
          </div>
          {!zu && statistik && alle.length > 0 && <span className="mini-kreise" style={{gap:4, flexShrink:0}}>{renderMiniKreise(ls, { groesse: 26, nurVerfuegbar: true })}</span>}
          <span className="slot-info-pfeil" data-slot-info-pfeil={zu ? "zu" : "auf"}
            {...tt(zu ? "Info aufklappen – auch Antippen der Fläche (bleibt so)" : "Info auf eine Zeile einklappen – auch Antippen der Fläche (bleibt so)")}>{zu ? "▼" : "▲"}</span>
        </div>
        {!zu && (<>
          <div data-vorschau-zahlen={alle.length} style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8, marginTop:8, fontSize:"0.85rem"}}>
            <span style={{minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}><b>{alle.length} Vokabel{alle.length !== 1 ? "n" : ""}</b>
              {sf && <span data-vorschau-runde style={{fontWeight:600}}> · ▶ {(sf.abgefragt || []).length}/{sf.gesamt || 0} abgefragt</span>}</span>
            <span style={{flexShrink:0}}>{schwelle > 0 && alle.length > 0 ? <><span data-gelernt-haken style={{color:"var(--gelernt)", fontWeight:800}}>✓</span> {pct} % gelernt</> : ""}</span>
          </div>
          <div className="vorschau-balken" data-vorschau-balken style={{display:"flex", height:8, borderRadius:4, overflow:"hidden", margin:"6px 0 4px", background:"var(--rahmen)"}}>
            {GRUPPE_BALKEN.filter(([g]) => anz[g]).map(([g, farbe]) => <span key={g} data-gruppe={g} style={{width:`${anz[g] / Math.max(1, alle.length) * 100}%`, background:farbe}}/>)}
          </div>
          <div className="info-zeile-klein">
            <span data-vorschau-zuletzt style={{flexShrink:0}}>Zuletzt abgefragt: {zuletzt ? formatDatum(zuletzt) : "noch nie"}{zuletzt && heuteAbgefragt({ letzteAbfrage: zuletzt }) ? <span data-vorschau-heute={heuteP}> ({heuteP} %)</span> : null}</span>
            <span data-vorschau-gruppen className="info-gruppen">{gruppenText}</span>
          </div>
          {(
            <div className="info-klapp-zeile" data-vorschau-vokabeln={slotVorschauListe ? "auf" : "zu"} style={alle.length ? undefined : {opacity:0.4, pointerEvents:"none"}}
              onClick={e => { e.stopPropagation(); setSlotVorschauListe(v => !v); }}
              {...tt(slotVorschauListe ? "Vokabel-Liste schließen" : "Die Vokabeln dieses Quiz mit ihrem Listenplatz anzeigen")}>
              <span data-vorschau-listen style={{minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{teile.length ? listenText : "\u00a0"}</span>
              <span className="slot-info-pfeil">{slotVorschauListe ? "▲" : "▼"}</span>
            </div>
          )}
        </>)}
      </div>
      {slotVorschauListe && alle.length > 0 && (
        <div data-vorschau-vokliste data-auswahl-durchlass style={{padding:"4px 0 10px", ...(statistik ? {margin:"0 16px"} : {})}}>
          {teile.map(x => {
            const fremd = TYPEN.find(y => y.startsWith("E") && x.liste.spalten[y]?.aktiv), deutsch = TYPEN.find(y => y.startsWith("D") && x.liste.spalten[y]?.aktiv);
            const zeilen = [];
            let vorher = 0;
            const luecke = (a, b) => zeilen.push(<div key={`l${a}`} className="vorschau-luecke" data-vorschau-luecke={`${a}-${b}`}>⋯ Nr. {a === b ? a : `${a}–${b}`} nicht enthalten ⋯</div>);
            x.voks.forEach(v => {
              if (v._nr > vorher + 1) luecke(vorher + 1, v._nr - 1);
              const sc = v.fortschritt ? clampScore(v.fortschritt.score) : null;
              zeilen.push(
                <div key={v.id} className="vorschau-zeile" data-vorschau-nr={v._nr}>
                  <span className="vorschau-nr">{v._nr}</span>
                  <span className="vorschau-wort">{ohneHinweis(v[fremd]?.wert || "")}</span>
                  <span className="vorschau-de">{ohneHinweis(v[deutsch]?.wert || "")}</span>
                  {scoreSymbole(v.fortschritt?.score, true)}
                  {sc !== null && <span className={`score-badge ${sc > 0 ? "score-pos" : sc < 0 ? "score-neg" : "score-null"}`}>{sc > 0 ? "+" : ""}{sc}</span>}
                </div>);
              vorher = v._nr;
            });
            if (!x.ganz && vorher < x.liste.vokabeln.length) luecke(vorher + 1, x.liste.vokabeln.length);
            return (
              <div key={x.id} style={{marginTop:6}}>
                {teile.length > 1 && <div style={{fontWeight:700, fontSize:"0.8rem", margin:"4px 0"}}>{sprachInfo(listeSprache(x.idx)).flagge} {x.liste.name}</div>}
                {zeilen}
              </div>
            );
          })}
          <button className="btn btn-ghost btn-sm" data-vorschau-ausblenden style={{width:"100%", marginTop:8}} onClick={() => setSlotVorschauListe(false)}
            {...tt("Vokabel-Liste schließen")}>▲ Vokabeln ausblenden</button>
        </div>
      )}
    </>);
  }
