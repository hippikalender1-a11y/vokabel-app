import { BLITZ_SEKUNDEN, FESTES_ZEICHEN, SATZ_ARTEN, STANDARD_ANTWORT_MODUS, ZUORDNUNG_FARBEN, akzentVarianten, alternativen, antwortStatus, artikelInfo, clampScore, ersteAlt, getQuizFeedback, istMC, istRichtigeAntwort, istRichtigeEinzeln, jubelText, lueckenPositionen, mitHinweis, ohneHinweis, puzzleKacheln, satzFuer, scoreSymbole, umbruch, vokSprache, zufallMitSeed } from "../quiz.jsx";
import { CSS } from "../stil.js";
import { Fragment } from "react";
import { GelerntSterne, IcoSpk, IcoSpkOn } from "../komponenten.jsx";
import { SK, lsGet, splitInSeiten } from "../speicher.js";
import { STIMMEN_WAHL, aktiveStimmen, gewaehlteStimme, normLang, sprich, stimmeFuer } from "../sprache.js";
import { istSynonymSpalte, synonymeAus } from "../saetze.js";

// Phase 2 (Aufteilung): Ansicht aus App.jsx – if (ansicht === "quiz" && quiz) { … }
// app = die Zustände, Setter und Funktionen der Komponente, die diese Ansicht braucht
export function AbfrageAnsicht(app) {
  const { aendereStimmen, akzentStand, beendeQuiz, beendeVerzoegerung, bewerteKarte, blitzKey, brecheQuizAb, brecheWiederholungAb, deckeKarteAuf, eingabeRef, einstellungen, farbModusUI, farbRadUI, geheZurueck, getAktVok, heuteGesperrtOffen, kachelMitAkzent, karteWeiter, klickeButton, memoryTippe, naechsteVokabel, naechstesPaketUI, nimmVokabelHeraus, oeffneVokabelBearbeiten, pruefeAkzente, pruefeAntwort, quiz, quizRegeln, renderKopfFortschritt, renderRundenErgebnis, renderVokabelEditor, sessionAuswertungSeite, setQuiz, setQuizPaketGroesse, setzeAkzentVariante, speichereEinst, starteQuiz, starteWiederholung, tt, ttFeld, ueberspringeWeitere, updateSessionSlotFortschritt, verlasseRunde, vokLang, waehleAkzentKachel, wechsleStimme, weiterZurAuswertung, zeigeLosung, zuordnungMixWeiter, zuordnungRunde, zuordnungTippe, zurRundenStatistik, zurueckZumLernen, zurueckZurStatistik } = app;

    if (quiz.phase === "fertig") {
      if (quiz.istSessionModus) {
        const aktSlot = lsGet(SK.sessionAktiv);
        // nur Vokabeln der aktuellen Quiz-Menge zählen (Slot kann aus anderer Einstellung stammen)
        const sessionMenge = quiz.sessionIds ? new Set(quiz.sessionIds) : null;
        const schonAbgefragt = new Set([...((aktSlot?.abgefragt) || []), ...(quiz.sessionVokIds || [])].filter(id => !sessionMenge || sessionMenge.has(id)));
        const istLetzteBatch = schonAbgefragt.size >= (quiz.sessionGesamt || 0);
        const doBeende = (letzteRunde, pause = false) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], letzteRunde); beendeQuiz(!pause); };
        const doWeiter = (n) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], false); setQuizPaketGroesse(n); starteQuiz(); };
        const r = quiz.quizRichtigAnzahl || 0;
        const f = quiz.quizFalschAnzahl || 0;
        const ges = r + f;
        const feedback = getQuizFeedback(r, ges);
        const sessionPct = Math.round(schonAbgefragt.size / Math.max(1, quiz.sessionGesamt) * 100);
        const heuteGesperrt = istLetzteBatch ? 0 : heuteGesperrtOffen(quiz, schonAbgefragt);
        const heuteFertig = heuteGesperrt > 0 && schonAbgefragt.size + heuteGesperrt >= (quiz.sessionGesamt || 0);
        if (istLetzteBatch && !quiz.abgebrochen && quiz.sessionAuswertung) return sessionAuswertungSeite(quiz, (<>
          <button data-nochmal {...tt("Quiz gleich noch einmal von vorn durchlaufen – Scores bleiben, der Abgefragt-Stand beginnt neu")} className="btn btn-primary" style={{width:"100%", marginBottom:8, fontSize:"1.05rem"}}
            onClick={() => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], true); starteQuiz(true); }}>🔁 Nochmal!</button>
          <button {...tt("Durchlauf beenden und zur Quiz-Übersicht")} className="btn btn-ghost-filled" style={{width:"100%"}} onClick={() => doBeende(true)}>Zur Übersicht</button>
          <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(() => doBeende(true))} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button>
        </>), () => doBeende(true));
        return (
          <>
            <style>{CSS}</style>{farbModusUI}{farbRadUI}
            <div className="app">
              <div className="topbar">
                <button {...tt("Schließen – Fortschritt wird gespeichert, zurück zur Übersicht")} className="topbar-back" onClick={() => doBeende(istLetzteBatch)}>Schließen</button>
                <span className="topbar-title">{quiz.abgebrochen ? "Abgebrochen" : istLetzteBatch ? "Durchlauf abgeschlossen" : heuteFertig ? "Für heute fertig" : "Paket fertig"}</span>
                <span className="quiz-fortschritt">{schonAbgefragt.size}/{quiz.sessionGesamt}</span>
              </div>
              <div className="sektion">
                {/* Quiz-Fortschritt: wie viele Vokabeln der Vokabelgruppe schon abgefragt */}
                <div style={{padding:"8px 0 16px"}} {...tt("So viele Vokabeln dieser Vokabelgruppe wurden in diesem Durchlauf schon abgefragt")}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6}}>
                    <span style={{fontWeight:700, fontSize:"1.05rem", color:"var(--text)"}}>{schonAbgefragt.size} von {quiz.sessionGesamt} Vokabeln abgefragt</span>
                    <span style={{fontSize:"0.85rem", color:"var(--text2)"}}>{sessionPct} %</span>
                  </div>
                  <div style={{background:"var(--flaeche)", borderRadius:8, height:10, overflow:"hidden"}}>
                    <div style={{width:`${sessionPct}%`, height:"100%", background:"var(--haupt)", borderRadius:8}}/>
                  </div>
                </div>
                {istLetzteBatch && !quiz.abgebrochen && (
                  <div className="jubel" data-jubel>
                    <span className="jubel-emoji">🎉</span>
                    <div className="jubel-titel">{jubelText((quiz.sessionVokIds || []).join())}</div>
                    <div className="jubel-sub">Alle {quiz.sessionGesamt} Vokabeln dieses Quiz abgefragt</div>
                  </div>
                )}
                {/* Paket-Auswertung */}
                {ges > 0 && (<>
                  {renderRundenErgebnis(quiz, r, f, quiz.abgebrochen ? "Bis zum Abbruch" : istLetzteBatch ? "Letztes Paket" : "Dieses Paket")}
                  {feedback && (
                    <div style={{background:"var(--info-kasten)", borderRadius:12, padding:"14px 16px", margin:"0 0 16px", fontSize:"1rem", lineHeight:1.6, color:"var(--text)", fontStyle:"italic", textAlign:"center"}}>
                      „{feedback}"
                    </div>
                  )}
                </>)}
                {quiz.abgebrochen ? (
                  <><button {...tt("Zur Quiz-Übersicht")} className="btn btn-primary" style={{width:"100%"}} onClick={() => beendeQuiz()}>Zur Übersicht</button>
                  <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(beendeQuiz)} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button></>
                ) : istLetzteBatch ? weiterZurAuswertung : (
                  naechstesPaketUI(Math.max(0, (quiz.sessionGesamt || 0) - schonAbgefragt.size - heuteGesperrt), doWeiter, doBeende, heuteGesperrt)
                )}
              </div>
            </div>
          </>
        );
      }
      {
        const r = quiz.quizRichtigAnzahl || 0;
        const f = quiz.quizFalschAnzahl || 0;
        const ges = r + f;
        const feedback = getQuizFeedback(r, ges);
        const rundenKnoepfe = quiz.ausLernen ? (
          <button data-weiter-lernen {...tt("Zurück ins Lernen – weiter mit dem nächsten Paket")} className="btn btn-primary" style={{width:"100%"}} onClick={zurueckZumLernen}>🎬 Weiter lernen</button>
        ) : quiz.ausStatistik ? (<>
          <button data-zurueck-statistik {...tt("Zurück zur Statistik, aus der diese Runde gestartet wurde")} className="btn btn-primary" style={{width:"100%"}} onClick={zurueckZurStatistik}>📊 Zurück zur Statistik</button>
          <button {...tt("Zur Quiz-Übersicht")} className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => { beendeQuiz(); }}>Zur Übersicht</button>
        </>) : (<>
          <button {...tt("Zur Quiz-Übersicht")} className="btn btn-primary" style={{width:"100%"}} onClick={() => { beendeQuiz(); }}>
            Zur Übersicht
          </button>
          <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(beendeQuiz)} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button>
        </>);
        if (quiz.sessionAuswertung && !quiz.abgebrochen) return sessionAuswertungSeite(quiz, rundenKnoepfe, () => { verlasseRunde(); });
        return (
          <>
            <style>{CSS}</style>{farbModusUI}{farbRadUI}
            <div className="app">
              <div className="topbar">
                <button {...tt(quiz.ausLernen ? "Schließen und weiter lernen" : quiz.ausStatistik ? "Auswertung schließen und zurück zur Statistik" : "Auswertung schließen und zur Quiz-Übersicht")} className="topbar-back" onClick={() => { verlasseRunde(); }}>Schließen</button>
                <span className="topbar-title">{quiz.abgebrochen ? "Abgebrochen" : "Auswertung"}</span>
                <span className="quiz-fortschritt">{r}/{ges}</span>
              </div>
              <div className="sektion">
                <div style={{height:8}}/>
                {renderRundenErgebnis(quiz, r, f, quiz.abgebrochen ? "Bis zum Abbruch" : "Diese Runde")}
                {feedback && (
                  <div style={{background:"var(--info-kasten)", borderRadius:12, padding:"14px 16px", margin:"0 0 16px", fontSize:"1rem", lineHeight:1.6, color:"var(--text)", fontStyle:"italic", textAlign:"center"}}>
                    „{feedback}"
                  </div>
                )}
                {quiz.abgebrochen ? rundenKnoepfe : weiterZurAuswertung}
              </div>
            </div>
          </>
        );
      }
    }

    if (quiz.phase === "spielEnde") {
      const blitz = quiz.abfrageZiel?.modus === "blitz", n = quiz.spielZaehler || 0, rek = quiz.spielRekord || {};
      return (
        <>
          <style>{CSS}</style>{farbModusUI}{farbRadUI}
          <div className="app">
            <div className="topbar">
              <span className="topbar-back" style={{visibility:"hidden"}}>·</span>
              <span className="topbar-title">{blitz ? "⚡ Blitzrunde" : "🔥 Serie"}</span>
              <span className="quiz-fortschritt"/>
            </div>
            <div className="sektion">
              <div className="quiz-frage-box" data-spiel-ende style={{padding:"34px 16px", textAlign:"center"}}>
                <div style={{fontSize:"2.4rem", lineHeight:1}}>{rek.neu && n > 0 ? "🏆" : blitz ? "⚡" : "🔥"}</div>
                <div data-spiel-ergebnis style={{fontSize:"3rem", fontWeight:800, color:"var(--haupt)", marginTop:8}}>{n}</div>
                <div style={{fontSize:"1rem", color:"var(--text2)"}}>{blitz ? `richtig in ${quiz.abfrageZiel.sek || BLITZ_SEKUNDEN} Sekunden` : "am Stück richtig"}</div>
                <div data-spiel-rekord style={{marginTop:14, fontWeight:700, color: rek.neu && n > 0 ? "var(--richtig)" : "var(--text2)"}}>
                  {rek.neu && n > 0 ? (rek.alt ? `Neuer Rekord! (bisher ${rek.alt})` : "Erster Rekord!") : `Rekord: ${rek.alt || 0}`}
                </div>
              </div>
              <button className="btn btn-primary" data-spiel-weiter style={{width:"100%", marginTop:14}} onClick={() => setQuiz(prev => ({ ...prev, phase: "fertig" }))}
                {...tt("Weiter zur Auswertung")}>Weiter →</button>
            </div>
          </div>
        </>
      );
    }

    if (quiz.phase === "wiederholungHinweis") {
      const n = quiz.vokabeln.length;
      const grund = quiz.abfrageZiel?.modus === "score"
        ? "haben das Score-Ziel noch nicht erreicht"
        : quiz.abfrageZiel?.wiederholung > 1 ? `wurden noch nicht ${quiz.abfrageZiel.wiederholung}× richtig beantwortet` : "wurden falsch beantwortet";
      return (
        <>
          <style>{CSS}</style>{farbModusUI}{farbRadUI}
          <div className="app">
            <div className="topbar">
              <button {...tt("Wiederholung abbrechen und zur Auswertung")} className="topbar-back" onClick={brecheWiederholungAb}>Beenden</button>
              <span className="topbar-title">Wiederholung</span>
              <span className="quiz-fortschritt">{n} Vok.</span>
            </div>
            <div className="sektion">
              <div className="quiz-frage-box wiederholung-karte" onClick={starteWiederholung} style={{cursor:"pointer", padding:"34px 16px"}}
                {...tt("Antippen: weiter zu den Vokabeln, die wiederholt werden")}>
                <div style={{fontSize:"2.2rem", lineHeight:1}}>🔁</div>
                <div className="quiz-frage-text" style={{textAlign:"center", marginTop:10}}>
                  Wiederholung{quiz.wiederholungDurchgang > 1 ? ` ${quiz.wiederholungDurchgang}` : ""}
                </div>
                <div style={{textAlign:"center", fontSize:"0.9rem", color:"var(--text2)", marginTop:10, lineHeight:1.5}}>
                  {quiz.wiederholungDurchgang > 1 ? "Weiter geht's" : "Alle Vokabeln wurden abgefragt"}.<br/>
                  {n === 1 ? "1 Vokabel" : `${n} Vokabeln`} {n === 1 ? grund.replace(/^haben/, "hat").replace(/^wurden/, "wurde") : grund} und {n === 1 ? "kommt" : "kommen"} jetzt noch einmal.
                </div>
              </div>
              <button className="btn btn-primary" style={{width:"100%", marginTop:14}} onClick={starteWiederholung}
                {...tt("Weiter zu den Vokabeln, die wiederholt werden")}>Weiter zur Wiederholung</button>
              <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={brecheWiederholungAb}
                {...tt("Wiederholung auslassen und direkt zur Auswertung – die Wertung der Runde bleibt gleich")}>Wiederholung abbrechen</button>
            </div>
          </div>
        </>
      );
    }

    if (quiz.phase === "zuordnung" && quiz.zuordnung) {
      const z = quiz.zuordnung;
      const n = z.spalten.length;
      const gesamt = z.mix ? z.ids.length : (z.beantwortet || []).length + z.ids.filter(id => !(id in z.erledigt)).length + z.queue.length;
      const fertigAnz = z.mix ? z.ids.filter(id => id in z.erledigt).length : (z.beantwortet || []).length;
      const vokNr = Object.fromEntries(z.ids.map((id, k) => [id, k]));
      const loesung = z.anzeige === "loesung";
      const zeilenAnsicht = z.anzeige === "ergebnis";
      const vokVon = id => quiz.vokabeln.find(v => v.id === id);
      const statusVon = id => z.erledigt[id] === "richtig" ? "richtig" : z.erledigt[id] === "falsch" ? "falsch" : "offen";
      const rang = { falsch: 0, offen: 1, richtig: 2 };
      // „deine Wahl“ (am Ende): die übrigen Karten der Gruppe, die mit der Karte dieser Vokabel begann
      const deineWahl = id => {
        if (!z.amEnde) return null;
        const g = z.gruppen.find(gr => z.karten[gr.erst][gr.wahl[gr.erst]].id === id);
        if (!g) return null;
        const andere = Object.entries(g.wahl).filter(([sp]) => Number(sp) !== g.erst).map(([sp, k]) => z.karten[sp][k]).filter(k => k.id !== id);
        return andere.length ? andere.map(k => k.text).join(" · ") : null;
      };
      const dauer = z.zeitBis ? Math.max(0, z.zeitBis - Date.now()) : 0;
      const schrift = n === 2 ? "0.95rem" : n === 3 ? "0.85rem" : "0.78rem";
      return (
        <>
          <style>{CSS}</style>{farbModusUI}{farbRadUI}
          <div className="app">
            <div className="topbar">
              <button {...tt("Abfrage beenden – Beantwortetes bleibt gewertet")} className="topbar-back" onClick={brecheQuizAb}>Beenden</button>
              <span className="topbar-title">{z.art === "memory" ? "Memory" : "Zuordnung"}</span>
              <span className="quiz-fortschritt" data-zuo-fortschritt>{fertigAnz} / {gesamt}</span>
            </div>
            <div className="sektion" data-zuordnung={z.amEnde ? "am-ende" : "sofort"}>
              <div className="zuo-zeit" data-zuo-zeit={z.zeitBis ? "an" : "aus"}>
                {z.zeitBis && !z.anzeige && <div key={z.zeitBis} className="zuo-zeit-balken" style={{animationDuration:`${dauer}ms`}}/>}
              </div>
              {z.art === "memory" && !z.anzeige ? (
                <div className="memory-raster" data-memory style={{gridTemplateColumns:`repeat(${z.mKarten.length > 12 ? 4 : 3}, minmax(0, 1fr))`}}>
                  {z.mKarten.map((k, i) => {
                    const gefunden = k.id in z.erledigt, auf = gefunden || z.mOffen.includes(i);
                    const farbe = gefunden && z.paarFarbe?.[k.id] != null ? ZUORDNUNG_FARBEN[z.paarFarbe[k.id]] : null;
                    const falsch = z.mOffen.length === 2 && z.mOffen.includes(i) && z.mKarten[z.mOffen[0]].id !== z.mKarten[z.mOffen[1]].id;
                    return (
                      <button key={i} className={`memory-karte${auf ? " auf" : ""}${falsch ? " falsch" : ""}`} data-memory-karte={i} data-memory-id={k.id} data-memory-seite={k.seite}
                        style={{fontSize: schrift, ...(farbe ? { borderColor: farbe, background: `${farbe}26` } : {})}} onClick={() => memoryTippe(i)}
                        {...tt("Antippen: Karte aufdecken – zwei zusammengehörige (Frage und Antwort) bilden ein Paar")}>
                        {gefunden && <span className="zuo-nr" style={{background:"var(--richtig)"}}>✓</span>}
                        {auf ? mitHinweis(k.text) : <span className="memory-rueck">?</span>}
                      </button>
                    );
                  })}
                </div>
              ) : zeilenAnsicht ? (
                <div className="zuo-ergebnis" data-zuo-ergebnis>
                  <div className="zuo-raster" style={{gridTemplateColumns:`repeat(${n}, minmax(0, 1fr))`, marginBottom:6}}>
                    {z.spalten.map(t => <div key={t} className="zuo-kopf">{quiz.liste.spalten[t]?.name || t}</div>)}
                  </div>
                  {[...z.ids].sort((a, b) => rang[statusVon(a)] - rang[statusVon(b)]).map(id => {
                    const v = vokVon(id), st = statusVon(id), wahl = st === "falsch" ? deineWahl(id) : null;
                    return (
                      <div key={id} className={`zuo-reihe ${st}`} data-zuo-reihe={id} data-zuo-status={st}>
                        <span className="zuo-nr" style={{background: st === "richtig" ? "var(--richtig)" : st === "falsch" ? "var(--falsch)" : "var(--text3)"}}>{st === "richtig" ? "✓" : st === "falsch" ? "✗" : "–"}</span>
                        <div className="zuo-raster" style={{gridTemplateColumns:`repeat(${n}, minmax(0, 1fr))`}}>
                          {z.spalten.map(t => (
                            <button key={t} className="zuo-karte" style={{fontSize: schrift}} onClick={() => sprich(v?.[t]?.wert || "", vokLang(v, t))}
                              {...tt("Antippen: vorlesen")}>{mitHinweis(v?.[t]?.wert || "")}</button>
                          ))}
                        </div>
                        {wahl && <div className="zuo-wahl" data-zuo-wahl>deine Wahl: {wahl}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="zuo-raster" style={{gridTemplateColumns:`repeat(${n}, minmax(0, 1fr))`}}>
                {!z.wechselnd && z.spalten.map(t => <div key={t} className="zuo-kopf">{quiz.liste.spalten[t]?.name || t}</div>)}
                {z.ids.map((_, zeile) => z.spalten.map((t, sp) => {
                  const k = z.karten[sp][zeile];
                  const erl = z.erledigt[k.id];
                  const gi = z.gruppen.findIndex(g => g.wahl[sp] === zeile);
                  const g = gi >= 0 ? z.gruppen[gi] : null;
                  const geprueft = g && z.geprueft ? z.geprueft[gi] : undefined;
                  // Farbe: Lösung = je Vokabel; „am Ende“ = Farbe der Gruppe; „sofort“ = Farbe des gefundenen Paars
                  const farbe = loesung ? ZUORDNUNG_FARBEN[vokNr[k.id] % ZUORDNUNG_FARBEN.length]
                    : g ? ZUORDNUNG_FARBEN[g.farbe] : erl && z.paarFarbe?.[k.id] != null ? ZUORDNUNG_FARBEN[z.paarFarbe[k.id]] : null;
                  const wahl = !z.amEnde && z.offen?.wahl[sp] === zeile;
                  const blink = z.blink?.s === sp && z.blink?.i === zeile;
                  // ✓ / ✗: „sofort“ je gefundenem Paar, „am Ende“ nach dem Prüfen je Gruppe
                  const marke = loesung ? null : z.amEnde ? (geprueft === true ? "✓" : geprueft === false ? "✗" : null) : erl === "richtig" ? "✓" : erl === "falsch" ? "✗" : null;
                  const cls = ["zuo-karte", marke === "✓" ? "ok" : "", marke === "✗" ? "falsch-erl" : "", wahl ? "wahl" : "", blink ? "blink" : "",
                    z.anzeige && !marke && !loesung ? "offen-geblieben" : ""].filter(Boolean).join(" ");
                  return (
                    <button key={`${sp}-${zeile}`} className={cls} data-zuo-karte={`${sp}:${zeile}`} data-zuo-id={k.id}
                      style={{fontSize: schrift, ...(farbe ? { borderColor: farbe, background: `${farbe}26` } : {})}}
                      onClick={() => zuordnungTippe(sp, zeile)}
                      {...tt(z.amEnde ? "Antippen: in die farbige Gruppe aufnehmen – eingefärbte Karte antippen nimmt sie wieder heraus" : "Antippen: Karte wählen – die erste bestimmt die Vokabel, weitere werden sofort geprüft")}>
                      {marke ? <span className="zuo-nr" data-zuo-marke={marke === "✓" ? "richtig" : "falsch"} style={{background: marke === "✓" ? "var(--richtig)" : "var(--falsch)"}}>{marke}</span>
                        : g && !loesung ? <span className="zuo-nr" style={{background: farbe}}>{gi + 1}</span> : null}
                      {mitHinweis(k.text)}
                    </button>
                  );
                }))}
              </div>
              )}
              {z.anzeige && (
                <div style={{display:"flex", gap:8, marginTop:12}}>
                  {z.amEnde && z.art !== "memory" && (
                    <button className="btn btn-ghost" data-zuo-eigene style={{flex:1}}
                      onClick={() => setQuiz({ ...quiz, zuordnung: { ...z, anzeige: zeilenAnsicht ? "eigene" : "ergebnis" } })}
                      {...tt(zeilenAnsicht ? "Meine Zuordnung: die eigenen Gruppen mit ✓ / ✗" : "Zurück zur Lösung (ein richtiges Paar je Zeile)")}>{zeilenAnsicht ? "Meine Zuordnung" : "Lösung"}</button>
                  )}
                  <button className="btn btn-primary" data-zuo-weiter style={{flex:1}} onClick={() => setQuiz(z.mix ? zuordnungMixWeiter(quiz) : zuordnungRunde(quiz))}
                    {...tt(z.mix ? "Weiter mit der nächsten Frage – nicht Beantwortete kommen später wieder" : z.queue.length ? "Nächste Runde – nicht Beantwortete kommen wieder" : "Zur Auswertung")}>Weiter →</button>
                </div>
              )}
            </div>
          </div>
        </>
      );
    }

    const aktVokRaw = quiz.vokabeln[quiz.index];
    const aktVok = getAktVok();
    const frageLabel = quiz.liste.spalten[quiz.frageTyp]?.name || quiz.frageTyp;
    const aktAntwortTyp = quiz.antwortTypen[quiz.antwortTypIndex];
    const antwortLabel = quiz.liste.spalten[aktAntwortTyp]?.name || aktAntwortTyp;
    const aktSpaltModus = quiz.spalteModus?.[aktAntwortTyp] || STANDARD_ANTWORT_MODUS;
    const isKarteEingabe = aktSpaltModus === "karte" && quiz.phase === "eingabe";
    const isKarteAufgedeckt = aktSpaltModus === "karte" && quiz.phase === "aufgedeckt" && !quiz.karteNeinFlash;
    const richtigAufgedeckt = !!quiz.richtigAufgedeckt && quiz.phase === "aufgedeckt";
    const infoSpalten = (quiz.sitzungsInfoTypen || []).filter(t => aktVokRaw[t]?.wert);
    const karteInfoSpalten = infoSpalten.filter(x => !istSynonymSpalte(quiz.liste.spalten[x]));
    // Karten-Modus: Info-Kasten unter der Antwort ("i" in der Kopfzeile schaltet ihn dauerhaft, Pinnadel hält ihn offen)
    // Kasten und "i" gibt es, sobald das Quiz eine Info-Spalte hat – auch für Vokabeln ohne Info-Text
    // Synonym-Spalten: eigener Kasten „Synonyme“ (nur, wenn die Vokabel welche hat), sonst wie Info-Spalten
    const sitzungsInfo = [...new Set(quiz.sitzungsInfoTypen || [])];
    const synTypen = sitzungsInfo.filter(x => istSynonymSpalte(quiz.liste.spalten[x]));
    const karteInfoTypen = sitzungsInfo.filter(x => !synTypen.includes(x));
    const synSpalten = synTypen.filter(x => aktVokRaw[x]?.wert);
    const karteMitInfo = aktSpaltModus === "karte" && karteInfoTypen.length > 0;
    const karteMitSyn = aktSpaltModus === "karte" && synTypen.length > 0;
    const karteSynAn = einstellungen.karteSyn !== false;
    const karteSynPin = !!einstellungen.karteSynPin;
    const karteSynOffen = karteSynPin || quiz.synSichtbar;
    const karteInfoAn = einstellungen.karteInfo !== false;
    const karteInfoPin = !!einstellungen.karteInfoPin;
    const karteInfoOffen = karteInfoPin || quiz.infoSichtbar;
    const akz = aktSpaltModus === "akzent" ? akzentStand(quiz) : null;
    const akzLang = vokLang(aktVok, aktAntwortTyp);
    const akzLoesung = !!akz && quiz.phase === "aufgedeckt" && !akz.geprueft && !quiz.flash;
    const score = clampScore(akz ? aktVok?.akzentFortschritt?.score : aktVok?.fortschritt?.score);
    const isWeitere = quiz.phase === "weitere";
    const frageWert = aktVokRaw[quiz.frageTyp]?.wert || "";
    const karteLetzte = quiz.antwortTypIndex >= quiz.antwortTypen.length - 1;
    const karteUrteilOffen = !!quiz.karteBewertungOffen && quiz.phase === "aufgedeckt";
    // Tipp ins Freie: verdeckte Karte umdrehen, sonst weiter – solange keine Auswahl (Gewusst / Nicht gewusst) ansteht
    const freiKlick = (quiz.flash || quiz.karteNeinFlash) ? beendeVerzoegerung
      : isKarteEingabe ? deckeKarteAuf
      : isKarteAufgedeckt ? (karteLetzte ? undefined : karteWeiter)
      : quiz.phase === "aufgedeckt" && !karteUrteilOffen && !quiz.flash ? naechsteVokabel : undefined;

    // Lang-Druck: Frage, richtige Antwort, Info, beantwortete Spalten und eigene falsche MC-Antworten einzeln bearbeiten
    const vokListeId = aktVokRaw._listeId ?? quiz.liste.id;
    const bearbeite = (typ, falsch = null) => oeffneVokabelBearbeiten(aktVokRaw, vokListeId, typ, falsch);
    const spaltenName = t => quiz.liste.spalten[t]?.name || t;
    const vorlesenKlick = (text, typ) => ({ "data-vorlesen": typ, style: { cursor: "pointer" },
      onClick: e => { e.stopPropagation(); sprich(text, vokLang(aktVok, typ)); } });
    // Gesamt-Tempo als Regler in der Tafel (lang drücken auf eine Karte); beim Loslassen mit neuem Tempo vorlesen
    const tempoRegler = (text, typ) => () => ({ label: "Tempo (alle Sprachen)", min: 0.6, max: 1.4, step: 0.1, wert: STIMMEN_WAHL.tempo || 1,
      format: v => `${v.toFixed(1).replace(".", ",")}×`,
      aendern: v => aendereStimmen({ ...STIMMEN_WAHL, tempo: v === 1 ? undefined : v }), fertig: () => sprich(text, vokLang(aktVok, typ)) });
    const basisVon = typ => normLang(vokLang(aktVok, typ)).split("-")[0];
    const stimmeKnopf = (text, typ, wo) => {
      const aktiv = aktiveStimmen(basisVon(typ));
      if (aktiv.length < 2) return null;
      const nr = Math.max(0, aktiv.indexOf(gewaehlteStimme(basisVon(typ)) || stimmeFuer(vokLang(aktVok, typ)))) + 1;
      return (
        <button className="karten-knopf stimme" data-stimme-wechsel={wo} data-stimme-nr={`${nr}/${aktiv.length}`} onClick={e => { e.stopPropagation(); wechsleStimme(text, vokLang(aktVok, typ)); }}
          {...tt(`Stimme ${nr} von ${aktiv.length} – antippen: mit der nächsten aktivierten Stimme vorlesen (bleibt dann für diese Sprache eingestellt)`)}>{nr}/{aktiv.length}</button>);
    };
    // Automatisches Vorlesen je Spalte (oben der Hauptschalter): gilt für alle weiteren Karten
    const vorleseSpalten = einstellungen.vorlesen || ["E1"];
    const lautKnopf = typ => {
      const an = vorleseSpalten.includes(typ), haupt = !!einstellungen.autoplay;
      return (
        <button className={`karten-knopf laut${an ? " an" : ""}${haupt ? "" : " gedimmt"}`} data-spalte-vorlesen={typ} data-an={an ? "ja" : "nein"}
          onClick={e => { e.stopPropagation(); speichereEinst({...einstellungen, vorlesen: an ? vorleseSpalten.filter(x => x !== typ) : [...vorleseSpalten, typ]}); }}
          {...tt(`${spaltenName(typ)} automatisch vorlesen: ${an ? "an" : "aus"} – antippen schaltet um (gilt für alle weiteren Karten)${haupt ? "" : ". Das automatische Vorlesen ist oben gerade ausgeschaltet."}`)}>
          {an ? <IcoSpkOn s={20}/> : <IcoSpk s={16}/>}</button>);
    };
    // Rechte Seite der Kopfzeile: (Score) · Stimme · Vorlesen
    const kartenKnoepfe = (typ, text, wo, stimme = true, vorne = null) => (
      <span className="karten-knoepfe" onClick={e => e.stopPropagation()}>{vorne}{stimme && stimmeKnopf(text, typ, wo)}{lautKnopf(typ)}</span>);
    // Antwort-Text: Teile mit „/“, Alternativen („;“) als „auch: …“ (die getippte zuerst)
    const antwortText = (teile, treffer) => (teile || []).map((teil, i) => {
      const alts = alternativen(teil);
      const haupt = alts.length > 1 && treffer ? (alts.find(a => istRichtigeEinzeln(treffer, a, true)) || alts[0]) : (alts[0] || teil);
      const rest = alts.filter(a => a !== haupt);
      return <Fragment key={i}>{i > 0 && " / "}{mitHinweis(umbruch(haupt))}{rest.length > 0 && <span className="auch-hinweis" data-auch> (auch: {rest.join(", ")})</span>}</Fragment>;
    });
    const trefferJetzt = quiz.treffer?.k === `${quiz.index}|${quiz.antwortTypIndex}` ? quiz.treffer.e : null;
    const antwortGanz = (quiz.antwortTeile || []).join(" / ");
    const antwortSichtbar = quiz.phase !== "eingabe" && !quiz.flash;
    const antwortBearbeiten = tt(antwortSichtbar ? "Antippen: Antwort vorlesen – lang drücken: Tempo, richtige Antwort bearbeiten" : "Lang drücken: Tempo, richtige Antwort bearbeiten", [
      { label: "✎ Richtige Antwort bearbeiten", fn: () => bearbeite(aktAntwortTyp) },
      { label: "🚫 Nicht mehr abfragen", fn: nimmVokabelHeraus },
    ], { langText: `${antwortLabel}: richtige Antwort bearbeiten`, regler: tempoRegler(antwortGanz, aktAntwortTyp) });
    const frageBearbeiten = tt("Antippen: Frage vorlesen – lang drücken: Tempo, Frage bearbeiten", [
      { label: "✎ Frage bearbeiten", fn: () => bearbeite(quiz.frageTyp) },
      { label: "🚫 Nicht mehr abfragen", fn: nimmVokabelHeraus },
    ], { langText: `${frageLabel}: Frage bearbeiten`, regler: tempoRegler(frageWert, quiz.frageTyp) });
    const infoAktionen = typen => typen.map(t => ({ label: `✎ ${spaltenName(t)} bearbeiten`, fn: () => bearbeite(t) }));
    const eigeneFalsche = aktVokRaw[aktAntwortTyp]?.falsch || [];

    let antwortBoxKlasse = "quiz-antwort-box";
    if (quiz.flash) antwortBoxKlasse += " richtig";
    if (quiz.gelerntBlitz && quiz.gelerntBlitz === blitzKey(quiz)) antwortBoxKlasse += " gelernt-blitz";
    else if (richtigAufgedeckt) antwortBoxKlasse += " richtig";
    else if (quiz.karteNeinFlash) antwortBoxKlasse += " falsch";
    else if (quiz.falschFlash) antwortBoxKlasse += " falsch";
    else if (quiz.phase === "aufgedeckt") antwortBoxKlasse += " aufgedeckt";
    else if (isWeitere) antwortBoxKlasse += " weitere";

    return (
      <>
        <style>{CSS}</style>{farbModusUI}{farbRadUI}{renderVokabelEditor()}
        <div className="app">
          <div className="topbar">
            {quiz.wiederholungDurchgang ? (
              <button {...tt("Wiederholung abbrechen und zur Auswertung")} className="topbar-back" onClick={brecheWiederholungAb}>Beenden</button>
            ) : (
              <button {...tt("Quiz abbrechen – bisher beantwortete Vokabeln werden ausgewertet")} className="topbar-back" onClick={() => { brecheQuizAb(); }}>Beenden</button>
            )}
            {karteMitInfo && (
              <button data-karte-info-schalter={karteInfoAn ? "an" : "aus"} className="topbar-back"
                style={{width:36, height:36, padding:0, borderRadius:"50%", fontWeight:800, fontFamily:"Georgia, serif", fontSize:"1.05rem",
                  ...(karteInfoAn ? {} : {background:"var(--karte)", color:"var(--haupt)", border:"1.5px solid var(--haupt)"})}}
                onClick={() => speichereEinst({...einstellungen, karteInfo: !karteInfoAn})}
                {...tt(karteInfoAn ? "Info-Kasten ausblenden (gilt dauerhaft)" : "Info-Kasten einblenden (gilt dauerhaft)")}>i</button>
            )}
            {karteMitSyn && (
              <button data-karte-syn-schalter={karteSynAn ? "an" : "aus"} className="topbar-back"
                style={{width:36, height:36, padding:0, borderRadius:"50%", fontWeight:800, fontSize:"1.1rem",
                  ...(karteSynAn ? {} : {background:"var(--karte)", color:"var(--haupt)", border:"1.5px solid var(--haupt)"})}}
                onClick={() => speichereEinst({...einstellungen, karteSyn: !karteSynAn})}
                {...tt(karteSynAn ? "Synonyme ausblenden (gilt dauerhaft)" : "Synonyme einblenden (gilt dauerhaft)")}>≈</button>
            )}
            {(() => {
              const an = !!einstellungen.autoplay;
              const vorlesen = einstellungen.vorlesen || ["E1"];
              const spalten = [...new Set([quiz.frageTyp, ...quiz.antwortTypen])].filter(Boolean);
              const keineDabei = an && !spalten.some(t => vorlesen.includes(t));
              return (
                <button data-autoplay-schalter={an ? "an" : "aus"} className="topbar-back"
                  style={{width:36, height:36, padding:0, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                    ...(an ? {} : {background:"var(--karte)", color:"var(--haupt)", border:"1.5px solid var(--haupt)", opacity:.75})}}
                  onClick={() => { if (an) window.speechSynthesis?.cancel(); speichereEinst({...einstellungen, autoplay: !an}); }}
                  {...tt(an ? (keineDabei ? "Automatisches Vorlesen ist an, aber keine Spalte dieser Abfrage ist zum Vorlesen gewählt – lang drücken" : "Automatisches Vorlesen ausschalten")
                      : "Vokabeln automatisch vorlesen: Frage beim Erscheinen, Antwort beim Aufdecken", [
                    ...spalten.map(t => ({ label: `${vorlesen.includes(t) ? "✓ " : "○ "}${quiz.liste.spalten[t]?.name || t} vorlesen`,
                      fn: () => speichereEinst({...einstellungen, vorlesen: vorlesen.includes(t) ? vorlesen.filter(x => x !== t) : [...vorlesen, t]}) })),
                  ], { langText: "Lang drücken: wählen, welche Spalten automatisch vorgelesen werden" })}>
                  {an ? <IcoSpkOn s={20}/> : <IcoSpk s={16}/>}
                </button>
              );
            })()}
            <span className="topbar-title">
              {quiz.wiederholungDurchgang ? <span className="wiederholung-marke" {...tt("Diese Vokabeln werden wiederholt, weil sie noch nicht sicher sitzen")}>🔁 Wiederholung </span> : null}
              {quiz.spielZaehler != null ? <span data-spiel-zaehler>{quiz.abfrageZiel?.modus === "blitz" ? "⚡" : "🔥"} {quiz.spielZaehler}</span>
                : <span>{quiz.index + 1} / {quiz.vokabeln.length}</span>}
              {quiz.spielZaehler == null && renderKopfFortschritt(quiz)}
            </span>
            <span className="quiz-fortschritt" {...tt(akz ? "Eigener Akzent-Score dieser Vokabel" : "Score dieser Vokabel")}>{akz ? "Akzente" : "Score"}: {score > 0 ? "+" : ""}{score}</span>
          </div>
          {quiz.abfrageZiel?.modus === "blitz" && quiz.abfrageZiel.ende && (
            <div className="zuo-zeit" data-blitz-zeit style={{margin:"8px 16px 0"}}>
              <div key={quiz.abfrageZiel.ende} className="zuo-zeit-balken" style={{animationDuration:`${Math.max(0, quiz.abfrageZiel.ende - Date.now())}ms`}}/>
            </div>
          )}
          <div className="sektion"
            onClick={freiKlick} data-frei-klick={freiKlick ? "" : undefined}
            style={freiKlick ? {cursor:"pointer", minHeight:"70vh"} : undefined}>

            {/* Haupt-Layout: linke Spalte (Frage + Antwort) | rechte Spalte (Info) */}
            {(() => {
              // Info-Seiten berechnen
              const alleInfoSeiten = infoSpalten.flatMap(typ => {
                const text = aktVokRaw[typ]?.wert || "";
                const name = quiz.liste.spalten[typ]?.name || typ;
                const pages = splitInSeiten(text);
                return pages.map((page, i) => ({
                  name, typ,
                  text: (i > 0 ? "…" : "") + page + (i < pages.length - 1 ? "…" : ""),
                  page: i, total: pages.length,
                }));
              });
              const aktInfoSeite = alleInfoSeiten.length > 0
                ? alleInfoSeiten[(quiz.infoSeite || 0) % alleInfoSeiten.length]
                : null;
              const infoSeitenAnzahl = alleInfoSeiten.length;

              return (
                <div style={{display:"flex", gap:10, alignItems:"stretch", marginBottom:14}}>
                  {/* Linke Spalte */}
                  <div style={{flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:10}}>
                    <div className="quiz-frage-box" style={{marginBottom:0, cursor:"pointer", position:"relative"}} data-karte-frage data-vorlesen={quiz.frageTyp} {...frageBearbeiten}
                      onClick={e => { e.stopPropagation(); sprich(frageWert, vokLang(aktVok, quiz.frageTyp)); }}>
                      <div className="karten-kopf"><div className="quiz-label">{frageLabel}</div>{kartenKnoepfe(quiz.frageTyp, frageWert, "frage", !(aktSpaltModus === "hoeren" && quiz.phase === "eingabe" && !quiz.flash))}</div>
                      <div style={{display:"flex", alignItems:"baseline", gap:8, justifyContent:"center"}}>
                        <div className="quiz-frage-text" style={{textAlign:"center"}}>
                          {aktSpaltModus === "hoeren" && quiz.phase === "eingabe" && !quiz.flash
                            ? <span className="hoer-symbol" data-hoer-verdeckt>🔊</span> : mitHinweis(umbruch(frageWert))}
                        </div>
                      </div>
                    </div>

                    {quiz.vorigeAntworten.map((v, i) => (
                      <div key={i} className={`quiz-vorig${v.richtig == null ? " offen" : v.richtig ? "" : " nicht"}`} data-vorig={v.richtig == null ? "offen" : v.richtig ? "richtig" : "falsch"}
                        {...vorlesenKlick(v.wert, v.typ)}
                        {...tt(`${v.label}: antippen liest vor – lang drücken zum Bearbeiten`, [{ label: "✎ Antwort bearbeiten", fn: () => bearbeite(v.typ) }], { langText: `${v.label}: Antwort bearbeiten` })}>
                        <div className="karten-kopf"><div className="quiz-vorig-label">{v.richtig == null ? "" : v.richtig ? "✓ " : "✗ "}{v.label}</div>{kartenKnoepfe(v.typ, v.wert, "vorig")}</div>
                        <div style={{textAlign:"center", fontSize:"1rem"}}>
                          <strong>{antwortText(v.wert.split("/").map(x => x.trim()))}</strong>
                        </div>
                      </div>
                    ))}

                    <div className={antwortBoxKlasse} style={{marginBottom:0, position:"relative", ...(antwortSichtbar ? { cursor:"pointer" } : {})}} data-karte-antwort data-karte-verdeckt={isKarteEingabe ? "" : undefined} {...antwortBearbeiten}
                      {...(antwortSichtbar ? { onClick: e => { e.stopPropagation(); sprich(antwortGanz, vokLang(aktVok, aktAntwortTyp)); } } : {})}>
                      {antwortBoxKlasse.includes("gelernt-blitz") && <GelerntSterne/>}
                      <div className="karten-kopf">
                        <span className="quiz-label" style={{display:"inline-flex", alignItems:"center"}}>{antwortStatus(antwortBoxKlasse)}{antwortLabel}{isWeitere && <span style={{color:"var(--info)", marginLeft:8}}>— weitere Antwort</span>}</span>
                        {kartenKnoepfe(aktAntwortTyp, antwortGanz, "antwort", antwortSichtbar, (isKarteEingabe || isKarteAufgedeckt || quiz.karteNeinFlash) && scoreSymbole(akz ? aktVok?.akzentFortschritt?.score : aktVok?.fortschritt?.score))}
                      </div>
                      {/* Karte-Modus: Platzhalter in Höhe der Antwort (ohne Text), damit beim Aufdecken nichts springt */}
                      {isKarteEingabe && <div className="karte-aufdecken" aria-hidden="true" style={{visibility:"hidden"}}>&nbsp;</div>}
                      {/* MC */}
                      {aktSpaltModus === "artikel" && !quiz.flash && quiz.phase === "eingabe" && (() => {
                        const info = artikelInfo(aktVokRaw?.[aktAntwortTyp]?.wert, vokSprache(aktVokRaw));
                        return info ? <div className="artikel-wort" data-artikel-wort>{info.rest}</div> : null;
                      })()}
                      {istMC(aktSpaltModus) && !quiz.flash && quiz.phase === "eingabe" && (
                        <div className="mc-raster" data-mc-raster>
                          {(quiz.mcButtons || []).map((btn, idx) => (
                            <button {...tt("Diese Antwort wählen – nur ein Treffer ohne Fehlklick zählt als gewusst",
                                btn.korrekt ? [{ label: "✎ Richtige Antwort bearbeiten", fn: () => bearbeite(aktAntwortTyp) }]
                                  : eigeneFalsche.includes(btn.text) ? [{ label: "✎ Falsche Antwort bearbeiten", fn: () => bearbeite(aktAntwortTyp, btn.text) }] : [],
                                { langText: btn.korrekt || eigeneFalsche.includes(btn.text) ? "Lang drücken: diese Antwort bearbeiten"
                                  : "Diese falsche Antwort stammt aus einer anderen Vokabel – bearbeiten in deren Liste" })} key={idx} data-mc-knopf
                              onClick={e => { e.stopPropagation(); quiz.phase === "eingabe" && klickeButton(idx); }}
                              style={{
                                padding:"12px 10px", borderRadius:12, border:"none",
                                fontFamily:"inherit", fontSize:"1.05rem", fontWeight:700,
                                cursor: btn.status === "richtig" || quiz.phase === "aufgedeckt" ? "default" : "pointer",
                                background:
                                  btn.status === "richtig" ? "var(--haupt)" :
                                  btn.status === "falsch"  ? "var(--falsch)" : "var(--rahmen)",
                                color: btn.status === "neutral" ? "var(--text-stark)" : btn.status === "falsch" ? "var(--auf-falsch)" : "var(--auf-haupt)",
                                transition: "background .15s",
                              }}
                            >{btn.text}</button>
                          ))}
                        </div>
                      )}
                      {/* Tippen */}
                      {aktSpaltModus === "tippen" && !quiz.flash && quiz.phase === "eingabe" && (
                        <input {...ttFeld("Antwort eintippen und mit Enter oder „Prüfen“ bestätigen")} ref={eingabeRef} className="inp"
                          value={quiz.eingabe}
                          onChange={e => setQuiz(prev => ({...prev, eingabe: e.target.value}))}
                          onKeyDown={e => e.key === "Enter" && pruefeAntwort()}
                          onClick={e => e.stopPropagation()}
                          placeholder="Antwort eingeben…"
                          style={{marginTop:4}}
                        />
                      )}
                      {SATZ_ARTEN.includes(aktSpaltModus) && !quiz.flash && quiz.phase === "eingabe" && (() => {
                        const key = `${quiz.index}|${quiz.antwortTypIndex}|${quiz.aktuelleFehlversuche || 0}`;
                        const satz = satzFuer(aktVokRaw, `${quiz.index}|${quiz.antwortTypIndex}`);
                        if (!satz) return null;
                        const antworte = richtig => { setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: [], lueckeText: "" })); pruefeAntwort(richtig ? quiz.antwortTeile[0] : "\u0000"); };
                        const wahl = quiz.puzzleKey === key ? (quiz.puzzleWahl || []) : [];
                        if (aktSpaltModus === "satzfinden") return (
                          <div data-satzfinden onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                            <div className="satz-band">
                              {satz.woerter.map((w, i) => <button key={i} className="satz-wort" data-satz-wort={i} data-satz-ziel={w.ziel ? "" : undefined}
                                onClick={() => antworte(w.ziel)} {...tt("Antippen, wenn das das gesuchte Wort ist")}>{w.text}</button>)}
                            </div>
                            {(einstellungen.satzUebFinden ?? false) && <div className="satz-ueb">{satz.ueb}</div>}
                          </div>
                        );
                        if (aktSpaltModus === "lueckensatz") {
                          const txt = quiz.puzzleKey === key ? (quiz.lueckeText || "") : "";
                          const pruefe = () => { const t = txt.trim(); if (!t) return; antworte(!!istRichtigeAntwort(t, satz.form, quizRegeln().akzenteTolerant)); };
                          return (
                            <div data-lueckensatz onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                              <div className="satz-text" data-lueckensatz-text>{satz.woerter.map((w, i) => <span key={i}>{w.ziel ? <>{w.text.split(w.kern)[0]}<span className="satz-luecke">{"_".repeat(Math.max(4, w.kern.length))}</span>{w.text.split(w.kern).slice(1).join(w.kern)}</> : w.text}{" "}</span>)}</div>
                              {(einstellungen.satzUebLuecke ?? true) && <div className="satz-ueb">{satz.ueb}</div>}
                              <input ref={eingabeRef} className="inp" data-lueckensatz-eingabe value={txt} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                                placeholder="fehlendes Wort eintippen…" onChange={e => setQuiz(prev => ({ ...prev, puzzleKey: key, lueckeText: e.target.value }))}
                                onKeyDown={e => { if (e.key === "Enter") pruefe(); }} {...ttFeld("Das fehlende Wort in der passenden Form eintippen, Enter prüft")}/>
                              <button className="btn btn-primary btn-sm" data-lueckensatz-pruefen style={{marginTop:6}} onClick={pruefe} {...tt("Prüfen")}>Prüfen</button>
                            </div>
                          );
                        }
                        // Satz bauen: Wörter gemischt, der Reihe nach antippen
                        const kacheln = satz.woerter.map((w, i) => ({ ...w, i }));
                        const z = zufallMitSeed(key + satz.satz);
                        for (let i = kacheln.length - 1; i > 0; i--) { const j = Math.floor(z() * (i + 1)); [kacheln[i], kacheln[j]] = [kacheln[j], kacheln[i]]; }
                        const tippe = k => {
                          const neu = [...wahl, k];
                          if (neu.length < kacheln.length) { setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: neu })); return; }
                          antworte(neu.map(x => kacheln[x].text).join(" ") === satz.woerter.map(w => w.text).join(" "));
                        };
                        return (
                          <div data-satzbauen onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                            <div className="satz-ueb" style={{marginBottom:8}}>{satz.ueb}</div>
                            <div className="satz-text satz-gebaut" data-satzbauen-text>{wahl.map(x => kacheln[x].text).join(" ") || " "}</div>
                            <div className="puzzle-kacheln">
                              {kacheln.map((w, i) => <button key={i} className="puzzle-kachel satz-kachel" data-satz-kachel={i} disabled={wahl.includes(i)} onClick={() => tippe(i)} {...tt("Wort als nächstes einsetzen")}>{w.text}</button>)}
                            </div>
                            {wahl.length > 0 && <button className="btn btn-ghost btn-sm" style={{marginTop:6}} onClick={() => setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: wahl.slice(0, -1) }))} {...tt("Letztes Wort zurücknehmen")}>⌫ zurück</button>}
                          </div>
                        );
                      })()}
                      {SATZ_ARTEN.includes(aktSpaltModus) && quiz.phase !== "eingabe" && !quiz.flash && (() => {
                        const satz = satzFuer(aktVokRaw, `${quiz.index}|${quiz.antwortTypIndex}`);
                        return satz ? <div className="satz-text" data-satz-loesung style={{marginTop:8}}>{satz.woerter.map((w, i) => <span key={i}>{w.ziel ? <>{w.text.split(w.kern)[0]}<b>{w.kern}</b>{w.text.split(w.kern).slice(1).join(w.kern)}</> : w.text}{" "}</span>)}<div className="satz-ueb">{satz.ueb}</div></div> : null;
                      })()}
                      {(aktSpaltModus === "puzzle" || aktSpaltModus === "luecke") && !quiz.flash && (quiz.phase === "eingabe" || isWeitere) && (() => {
                        const ziel = ersteAlt(ohneHinweis(isWeitere ? quiz.antwortTeile[quiz.weitereIndices[quiz.weiterePos]] : quiz.antwortTeile[0])) || "";
                        const key = `${quiz.index}|${quiz.antwortTypIndex}|${quiz.weiterePos || 0}|${quiz.aktuelleFehlversuche || 0}`;
                        const wahl = quiz.puzzleKey === key ? (quiz.puzzleWahl || []) : [];
                        if (aktSpaltModus === "puzzle") {
                          const kacheln = puzzleKacheln(ziel, key + ziel);
                          const n = kacheln.length;
                          const gelegt = wahl.map(k => kacheln[k].z);
                          let p = 0;
                          const anzeige = [...ziel].map(c => FESTES_ZEICHEN.test(c) ? c : (gelegt[p++] ?? "_"));
                          const tippe = k => {
                            const neu = [...wahl, k];
                            if (neu.length < n) { setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: neu })); return; }
                            let q = 0; const wort = [...ziel].map(c => FESTES_ZEICHEN.test(c) ? c : kacheln[neu[q++]].z).join("");
                            setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: [] }));
                            pruefeAntwort(wort);
                          };
                          return (
                            <div data-puzzle onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                              <div className="puzzle-zeile" data-puzzle-wort>{anzeige.map((c, i) => <span key={i} className={`puzzle-feld${c === "_" ? " frei" : ""}${c === " " ? " luecke-leer" : ""}`}>{c === "_" ? "" : c}</span>)}</div>
                              <div className="puzzle-kacheln">
                                {kacheln.map((k, i) => (
                                  <button key={i} className="puzzle-kachel" data-puzzle-kachel={i} disabled={wahl.includes(i)} onClick={() => tippe(i)} {...tt("Buchstabe als nächsten einsetzen")}>{k.z}</button>
                                ))}
                              </div>
                              {wahl.length > 0 && <button className="btn btn-ghost btn-sm" data-puzzle-zurueck style={{marginTop:6}}
                                onClick={() => setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: wahl.slice(0, -1) }))} {...tt("Letzten Buchstaben zurücknehmen")}>⌫ zurück</button>}
                            </div>
                          );
                        }
                        // Lücken
                        const vokJetzt = quiz.vokabeln[quiz.index];
                        const pos = lueckenPositionen(ziel, vokJetzt?.fortschritt?.score ?? 0, einstellungen.modus !== "einfach", key + ziel);
                        const eingabe = quiz.puzzleKey === key ? (quiz.lueckeText || "") : "";
                        const buchst = [...eingabe.replace(/\s/g, "")];
                        const zusammen = () => { let q = 0; return [...ziel].map((c, i) => pos.includes(i) ? (buchst[q++] || "") : c).join(""); };
                        const pruefe = text => { const b = [...text.replace(/\s/g, "")]; let q = 0; const wort = [...ziel].map((c, i) => pos.includes(i) ? (b[q++] || "") : c).join("");
                          setQuiz(prev => ({ ...prev, puzzleKey: key, lueckeText: "" })); pruefeAntwort(wort); };
                        let q = 0;
                        return (
                          <div data-luecke onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                            <div className="puzzle-zeile" data-luecke-wort>{[...ziel].map((c, i) => {
                              if (!pos.includes(i)) return <span key={i} className={`puzzle-feld fest${c === " " ? " luecke-leer" : ""}`}>{c}</span>;
                              const b = buchst[q++];
                              return <span key={i} className={`puzzle-feld${b ? "" : " frei"}`} data-luecke-feld>{b || ""}</span>;
                            })}</div>
                            <input ref={eingabeRef} className="inp" data-luecke-eingabe value={eingabe} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                              placeholder={pos.length === 1 ? "1 fehlenden Buchstaben eintippen…" : `${pos.length} fehlende Buchstaben eintippen…`}
                              onChange={e => { const t = e.target.value; if ([...t.replace(/\s/g, "")].length >= pos.length) pruefe(t); else setQuiz(prev => ({ ...prev, puzzleKey: key, lueckeText: t })); }}
                              onKeyDown={e => { if (e.key === "Enter") pruefe(zusammen() ? eingabe : eingabe); }}
                              {...ttFeld("Die fehlenden Buchstaben der Reihe nach eintippen – ist die letzte Lücke gefüllt, wird geprüft")}/>
                          </div>
                        );
                      })()}
                      {aktSpaltModus === "tippen" && !quiz.flash && isWeitere && (
                        <input {...ttFeld("Weitere richtige Antwort eintippen (z. B. bei was/were)")} ref={eingabeRef} className="inp"
                          value={quiz.eingabe}
                          onChange={e => setQuiz(prev => ({...prev, eingabe: e.target.value}))}
                          onKeyDown={e => e.key === "Enter" && pruefeAntwort()}
                          onClick={e => e.stopPropagation()}
                          placeholder="Weitere Antwort eingeben…"
                          style={{marginTop:4}}
                        />
                      )}
                      {/* Akzente: Buchstaben-Kacheln (Umbruch nur zwischen Wörtern), Varianten darunter */}
                      {akz && !quiz.flash && (quiz.phase === "eingabe" || akz.geprueft || akzLoesung) && (() => {
                        // Wörter = Kachel-Indizes zwischen Leerzeichen; Kachelbreite so, dass ≥ 12 Zeichen nebeneinander passen
                        const woerter = [[]];
                        akz.kacheln.forEach((k, i) => { if (k.basis === " ") woerter.push([]); else woerter[woerter.length - 1].push(i); });
                        // „Lösung anzeigen“: Kacheln bleiben stehen und zeigen die richtigen Buchstaben
                        const zeichen = i => akzLoesung ? akz.kacheln[i].richtig : akz.wahl[i];
                        const sichtbar = w => w.filter(i => zeichen(i) !== "").length;
                        const n = Math.max(12, ...woerter.map(sichtbar));
                        const regeln = quizRegeln();
                        const hervorheben = regeln.akzentHervorheben;
                        const mitAkzent = akz.kacheln.map((k, i) => i).filter(i => kachelMitAkzent(akz.kacheln[i]));
                        const gefunden = mitAkzent.filter(i => akz.wahl[i] === akz.kacheln[i].richtig).length;
                        return (
                        <div className="akzent-rahmen" onClick={e => e.stopPropagation()}>
                          {regeln.akzentZaehler && quiz.phase === "eingabe" && (
                            <div className="akzent-zaehler" {...tt("Richtig gesetzte Akzente / Akzente im Wort")}>
                              Akzente {gefunden} / {mitAkzent.length}
                            </div>
                          )}
                          <div className="akzent-wort" style={{"--n": n}}>
                            {woerter.filter(w => w.length > 0).map((w, wi) => (
                              <span key={wi} className="akzent-wortgruppe">
                                {w.map(i => {
                                  const k = akz.kacheln[i];
                                  const z = zeichen(i);
                                  if (z === "") return null;   // von einer Ligatur (œ, æ, ß) belegt
                                  const status = akz.blink === i ? " blink"
                                    : akz.wahl[i] === k.richtig && kachelMitAkzent(k) ? " ok"
                                    : akzLoesung ? (kachelMitAkzent(k) ? " loesung" : "")
                                    : akz.geprueft ? (z === k.richtig ? (richtigAufgedeckt ? " ok" : "") : " falsch")
                                    : akz.pruefFehler && kachelMitAkzent(k) ? " falsch"
                                    : hervorheben && kachelMitAkzent(k) ? " markiert" : "";
                                  return (
                                    <button key={i} className={`akzent-kachel${akz.aktiv === i ? " aktiv" : ""}${status}`}
                                      onClick={() => waehleAkzentKachel(i)}
                                      {...tt("Buchstaben antippen und darunter den passenden Akzent wählen – ohne Akzent leuchtet er kurz rot")}>{z}</button>
                                  );
                                })}
                              </span>
                            ))}
                          </div>
                          {akz.aktiv != null && quiz.phase === "eingabe" && (
                            <div className="akzent-leiste">
                              {akzentVarianten(akz.kacheln, akz.aktiv, akzLang).map(v => (
                                <button key={v} className="akzent-variante"
                                  onClick={() => setzeAkzentVariante(v)} {...tt(`„${v}“ einsetzen`)}>{v}</button>
                              ))}
                            </div>
                          )}
                          {akzLoesung && (
                            <div style={{display:"flex", justifyContent:"center", marginTop:6}}>
                              <button {...tt("Antwort vorlesen")} className="btn-icon" style={{fontSize:"1rem", padding:"2px 4px"}}
                                onClick={() => sprich(antwortGanz, akzLang)}><IcoSpk s={16}/></button>
                            </div>
                          )}
                        </div>
                        );
                      })()}
                      {/* Lösung: Flash (richtig) */}
                      {quiz.flash && (
                        <div className="quiz-frage-text" style={{textAlign:"center", color:"var(--richtig-dunkel)", minHeight:"44px", display:"flex", alignItems:"center", justifyContent:"center"}}>
                          {antwortText(quiz.antwortTeile, trefferJetzt)}{" ✓"}
                        </div>
                      )}
                      {/* Lösung: Aufgedeckt */}
                      {!quiz.flash && quiz.phase === "aufgedeckt" && !akzLoesung && (
                        istMC(aktSpaltModus)
                          ? <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:8, minHeight:60}}>
                              <div className="quiz-frage-text" {...vorlesenKlick(antwortGanz, aktAntwortTyp)} style={{textAlign:"center", cursor:"pointer"}}>{antwortText(quiz.antwortTeile, trefferJetzt)}</div>
                            </div>
                          : <div className="quiz-frage-text" style={{textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:6, minHeight:"44px"}}>
                              <span {...vorlesenKlick(antwortGanz, aktAntwortTyp)}>{antwortText(quiz.antwortTeile, trefferJetzt)}</span>
                            </div>
                      )}
                      {quiz.feedback && !quiz.flash && (
                        <div className={`quiz-feedback ${(quiz.falschFlash || quiz.feedback.startsWith("Nicht")) ? "nein" : "ok"}`}
                          style={{textAlign:"center"}}>
                          {quiz.feedback}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rechte Spalte: Info-Box */}
                  {quiz.infoSichtbar && aktInfoSeite && aktSpaltModus !== "karte" && (
                    <div {...tt("Nächste Info-Seite anzeigen", infoAktionen([aktInfoSeite.typ]), { langText: `${aktInfoSeite.name}: lang drücken zum Bearbeiten` })} data-info-box
                      onClick={() => setQuiz(prev => ({...prev, infoSeite: ((prev.infoSeite || 0) + 1) % infoSeitenAnzahl}))}
                      style={{
                        width:150, flexShrink:0, background:"var(--gelb-flaeche)",
                        border:"1px solid var(--gelb-zart)", borderRadius:12, padding:"12px",
                        cursor: infoSeitenAnzahl > 1 ? "pointer" : "default",
                        display:"flex", flexDirection:"column", gap:6,
                      }}>
                      <div style={{fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase",
                        letterSpacing:".05em", color:"var(--orange)"}}>
                        {aktInfoSeite.name}
                      </div>
                      <div style={{fontSize:"0.85rem", lineHeight:1.45, flex:1}}>
                        {aktInfoSeite.text}
                      </div>
                      {infoSeitenAnzahl > 1 && (
                        <div style={{fontSize:"0.7rem", color:"var(--gelb)", textAlign:"right", marginTop:"auto"}}>
                          {(quiz.infoSeite || 0) % infoSeitenAnzahl + 1} / {infoSeitenAnzahl}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Karten-Modus: Info-Kasten (eingeklappt eine Zeile „Info“) – nur vor dem Aufdecken, danach stehen hier die Bewertungs-Knöpfe */}
            {karteMitInfo && karteInfoAn && !quiz.flash && quiz.phase === "eingabe" && (
              <div data-karte-info={karteInfoOffen ? "offen" : "zu"} onClick={e => { e.stopPropagation(); if (!karteInfoPin) setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar})); }}
                {...tt(karteInfoPin ? "Info-Text (angeheftet)" : karteInfoOffen ? "Info einklappen" : "Info aufklappen",
                  infoAktionen(karteInfoTypen), { langText: "Info: lang drücken zum Bearbeiten" })}
                style={{background:"var(--gelb-flaeche)", border:"1px solid var(--gelb-zart)", borderRadius:12, padding: karteInfoOffen ? "10px 12px" : "7px 12px", marginBottom:14, cursor: karteInfoPin ? "default" : "pointer"}}>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{flex:1, fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", color:"var(--orange)"}}>Info</span>
                  {karteInfoOffen ? (
                    <button data-karte-info-pin={karteInfoPin ? "an" : "aus"}
                      onClick={e => { e.stopPropagation(); speichereEinst({...einstellungen, karteInfoPin: !karteInfoPin}); if (karteInfoPin) setQuiz(prev => ({...prev, infoSichtbar: true})); }}
                      {...tt(karteInfoPin ? "Lösen – der Info-Kasten kommt wieder eingeklappt" : "Anheften – der Info-Kasten bleibt dauerhaft aufgeklappt")}
                      style={{background: karteInfoPin ? "var(--gelb-zart)" : "none", border:"none", borderRadius:6, padding:"2px 6px", cursor:"pointer", fontSize:"0.95rem", lineHeight:1,
                        opacity: karteInfoPin ? 1 : 0.45, transform: karteInfoPin ? "none" : "rotate(45deg)"}}>📌</button>
                  ) : (
                    <span style={{fontSize:"0.75rem", color:"var(--gelb)"}}>▼</span>
                  )}
                </div>
                {karteInfoOffen && karteInfoSpalten.length === 0 && (
                  <div style={{marginTop:6, fontSize:"0.85rem", color:"var(--text3)", fontStyle:"italic"}}>Keine Zusatzinfo vorhanden</div>
                )}
                {karteInfoOffen && karteInfoSpalten.map(typ => (
                  <div key={typ} style={{marginTop:6}}>
                    {karteInfoSpalten.length > 1 && <div style={{fontSize:"0.68rem", fontWeight:700, color:"var(--gelb)"}}>{quiz.liste.spalten[typ]?.name || typ}</div>}
                    <div style={{fontSize:"0.88rem", lineHeight:1.45, whiteSpace:"pre-wrap"}}>{aktVokRaw[typ].wert}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Karten-Modus: Synonyme (eigener Kasten, nur wenn die Vokabel welche hat) */}
            {karteMitSyn && karteSynAn && synSpalten.length > 0 && !quiz.flash && quiz.phase === "eingabe" && (
              <div data-karte-syn={karteSynOffen ? "offen" : "zu"} onClick={e => { e.stopPropagation(); if (!karteSynPin) setQuiz(prev => ({...prev, synSichtbar: !prev.synSichtbar})); }}
                {...tt(karteSynPin ? "Synonyme (angeheftet)" : karteSynOffen ? "Synonyme einklappen" : "Synonyme aufklappen",
                  infoAktionen(synTypen), { langText: "Synonyme: lang drücken zum Bearbeiten" })}
                style={{background:"var(--haupt-flaeche)", border:"1px solid var(--haupt-zart)", borderRadius:12, padding: karteSynOffen ? "10px 12px" : "7px 12px", marginBottom:14, cursor: karteSynPin ? "default" : "pointer"}}>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{flex:1, fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", color:"var(--haupt)"}}>≈ Synonyme</span>
                  {karteSynOffen ? (
                    <button data-karte-syn-pin={karteSynPin ? "an" : "aus"}
                      onClick={e => { e.stopPropagation(); speichereEinst({...einstellungen, karteSynPin: !karteSynPin}); if (karteSynPin) setQuiz(prev => ({...prev, synSichtbar: true})); }}
                      {...tt(karteSynPin ? "Lösen – der Synonym-Kasten kommt wieder eingeklappt" : "Anheften – der Synonym-Kasten bleibt dauerhaft aufgeklappt")}
                      style={{background: karteSynPin ? "var(--haupt-zart)" : "none", border:"none", borderRadius:6, padding:"2px 6px", cursor:"pointer", fontSize:"0.95rem", lineHeight:1,
                        opacity: karteSynPin ? 1 : 0.45, transform: karteSynPin ? "none" : "rotate(45deg)"}}>📌</button>
                  ) : (
                    <span style={{fontSize:"0.75rem", color:"var(--haupt)"}}>▼</span>
                  )}
                </div>
                {karteSynOffen && (
                  <div style={{display:"flex", flexWrap:"wrap", gap:6, marginTop:8}} data-syn-liste>
                    {synSpalten.flatMap(x => synonymeAus(aktVokRaw[x].wert)).map((w, i) => (
                      <span key={i} className="syn-chip" data-syn-chip>{w}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Noch kommende Spalten */}
            {!quiz.flash && quiz.antwortTypen.length > 1 && (quiz.phase === "eingabe" || quiz.phase === "falsch" || isWeitere) && (
              <div style={{fontSize:"0.78rem", color:"var(--text2)", marginBottom:10}}>
                Noch: {quiz.antwortTypen.slice(quiz.antwortTypIndex + 1)
                  .map(t => quiz.liste.spalten[t]?.name || t).join(" → ")}
              </div>
            )}

            <div className="quiz-aktionen" onClick={e => e.stopPropagation()}>
              {/* Akzente: Prüfen groß und mittig, übrige Knöpfe klein darunter */}
              {!quiz.flash && quiz.phase === "eingabe" && akz && (
                <div className="akzent-aktionen">
                  <button className="btn btn-primary akzent-pruefen" onClick={pruefeAkzente}
                    {...tt("Antwort übernehmen und prüfen (alle Akzente richtig gesetzt → wird automatisch übernommen)")}>Prüfen</button>
                  <div style={{display:"flex", gap:8, justifyContent:"center"}}>
                    <button className="btn btn-ghost btn-sm" onClick={zeigeLosung} {...tt("Lösung anzeigen – zählt als nicht gewusst")}>Lösung anzeigen</button>
                    {infoSpalten.length > 0 && (
                      <button {...tt("Info-Spalten (z. B. Beispielsatz) ein- oder ausblenden")} className="btn btn-ghost btn-sm"
                        onClick={() => setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar}))}>
                        {quiz.infoSichtbar ? "Info ▲" : "Info"}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!quiz.flash && quiz.phase === "eingabe" && !isKarteEingabe && !akz && (
                <>
                  {aktSpaltModus === "tippen" && (
                    <button className="btn btn-primary" onClick={pruefeAntwort} {...tt("Eingegebene Antwort prüfen")}>Prüfen</button>
                  )}
                  <button className="btn btn-ghost" onClick={zeigeLosung} {...tt("Lösung anzeigen – zählt als nicht gewusst")}>Lösung anzeigen</button>
                  {infoSpalten.length > 0 && (
                    <button {...tt("Info-Spalten (z. B. Beispielsatz) ein- oder ausblenden")} className="btn btn-ghost"
                      onClick={() => setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar}))}>
                      {quiz.infoSichtbar ? "Info ▲" : "Info"}
                    </button>
                  )}
                </>
              )}
              {!quiz.flash && isWeitere && (
                <>
                  <button className="btn btn-primary" onClick={pruefeAntwort} {...tt("Eingegebene Antwort prüfen")}>Prüfen</button>
                  <button className="btn btn-ghost" onClick={ueberspringeWeitere} {...tt("Vokabel ohne Wertung überspringen")}>Überspringen</button>
                  {infoSpalten.length > 0 && (
                    <button {...tt("Info-Spalten (z. B. Beispielsatz) ein- oder ausblenden")} className="btn btn-ghost"
                      onClick={() => setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar}))}>
                      {quiz.infoSichtbar ? "Info ▲" : "Info"}
                    </button>
                  )}
                </>
              )}
              {/* Karte (mehrere Spalten, nicht die letzte): Weiter ohne Bewertung */}
              {!quiz.flash && isKarteAufgedeckt && !karteLetzte && (
                <button className="btn btn-primary" data-karte-weiter style={{width:"100%"}} onClick={karteWeiter}
                  {...tt("Nächste Spalte aufdecken – bewertet wird am Ende die ganze Vokabel (auch: ins Freie tippen)")}>Weiter →</button>
              )}
              {/* Karte: Gewusst / Nicht gewusst (letzte Spalte bzw. nach der letzten Spalte für die Karten-Spalten) */}
              {!quiz.flash && ((isKarteAufgedeckt && karteLetzte) || karteUrteilOffen) && (
                <div className="karte-bewertung" style={{width:"100%"}}>
                  <button className="karte-btn karte-btn-nein" onClick={() => bewerteKarte(false)} {...tt("Antwort war falsch – Score sinkt")}>✗ Nicht gewusst</button>
                  <button className="karte-btn karte-btn-ja" onClick={() => bewerteKarte(true)} {...tt("Antwort war richtig – Score steigt")}>✓ Gewusst</button>
                </div>
              )}
              {!quiz.flash && quiz.phase === "aufgedeckt" && !isKarteAufgedeckt && !karteUrteilOffen && (
                <>
                  {quiz.antwortTypIndex > 0 && !richtigAufgedeckt && (
                    <button className="btn btn-primary" onClick={geheZurueck} {...tt("Zur vorherigen Vokabel zurück")}>← Zurück</button>
                  )}
                  <button className="btn btn-primary" onClick={e => { e.stopPropagation(); naechsteVokabel(); }} {...tt("Nächste Vokabel")}>Weiter →</button>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  
}
