import { CSS } from "../stil.js";
import { GelerntSterne, IcoDown, IcoSpkOn, IcoUp } from "../komponenten.jsx";
import { SK, lsGet } from "../speicher.js";
import { diktatHint, jubelText, mitHinweis, ohneHinweis } from "../quiz.jsx";
import { sprich } from "../sprache.js";

// Phase 2 (Aufteilung): Ansicht aus App.jsx – if (ansicht === "quiz" && quiz && quiz.modus === "diktat") { … }
// app = die Zustände, Setter und Funktionen der Komponente, die diese Ansicht braucht
export function DiktatAnsicht(app) {
  const { beendeQuiz, blitzKey, diktatListeAufgeklappt, diktatManualPlays, eingabeRef, farbModusUI, farbRadUI, heuteGesperrtOffen, naechsteDiktatVokabel, naechstesPaketUI, nimmVokabelHeraus, oeffneVokabelBearbeiten, pruefeDiktatAntwort, quiz, renderKopfFortschritt, renderVokabelEditor, sessionAuswertungSeite, setDiktatListeAufgeklappt, setDiktatManualPlays, setQuiz, setQuizPaketGroesse, sprichDiktatNochmal, starteDiktat, tt, ttFeld, updateSessionSlotFortschritt, verlasseRunde, vokLang, weiterZurAuswertung, zeigeDiktatLoesung, zurRundenStatistik, zurueckZumLernen } = app;

    if (quiz.phase === "fertig") {
      const richtig = quiz.diktatErgebnisse.filter(e => e.richtig).length;
      if (quiz.istSessionModus) {
        const aktSlot = lsGet(SK.sessionAktiv);
        const schonAbgefragt = new Set([...((aktSlot?.abgefragt) || []), ...(quiz.sessionVokIds || [])]);
        const istLetzteBatch = schonAbgefragt.size >= (quiz.sessionGesamt || 0);
        const doBeende = (letzteRunde, pause = false) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], letzteRunde); beendeQuiz(!pause); };
        const doWeiter = (n) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], false); setQuizPaketGroesse(n); starteDiktat(); };
        if (istLetzteBatch && quiz.sessionAuswertung) return sessionAuswertungSeite(quiz, (<>
          <button data-nochmal {...tt("Quiz gleich noch einmal von vorn durchlaufen – Scores bleiben, der Abgefragt-Stand beginnt neu")} className="btn btn-primary" style={{width:"100%", marginBottom:8, fontSize:"1.05rem"}}
            onClick={() => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], true); starteDiktat(true); }}>🔁 Nochmal!</button>
          <button {...tt("Durchlauf beenden und zur Übersicht")} className="btn btn-ghost-filled" style={{width:"100%"}} onClick={() => doBeende(true)}>Zur Übersicht</button>
          <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(() => doBeende(true))} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button>
        </>), () => doBeende(true));
        return (
          <>
            <style>{CSS}</style>{farbModusUI}{farbRadUI}
            <div className="app">
              <div className="topbar">
                <button {...tt("Schließen – Fortschritt wird gespeichert, zurück zur Übersicht")} className="topbar-back" onClick={() => doBeende(istLetzteBatch)}>Schließen</button>
                <span className="topbar-title">{istLetzteBatch ? "Durchlauf abgeschlossen" : "Paket fertig"}</span>
                <span className="quiz-fortschritt">{richtig}/{quiz.diktatErgebnisse.length} ✓</span>
              </div>
              <div className="sektion">
                {istLetzteBatch ? (
                  <div className="jubel" data-jubel style={{paddingTop:24}}>
                    <span className="jubel-emoji">🎉</span>
                    <div className="jubel-titel">{jubelText((quiz.sessionVokIds || []).join())}</div>
                    <div className="jubel-sub">Alle {quiz.sessionGesamt} Vokabeln dieses Quiz abgefragt</div>
                  </div>
                ) : (
                <div className="leer">
                  <div style={{fontSize:"2.5rem"}}>✓</div>
                  <div className="leer-text">Paket abgeschlossen!</div>
                  <div style={{fontSize:"0.85rem", color:"var(--text2)", marginTop:4}}>
                    {schonAbgefragt.size} / {quiz.sessionGesamt} ({Math.round(schonAbgefragt.size / Math.max(1, quiz.sessionGesamt) * 100)}%)
                  </div>
                </div>
                )}
                {istLetzteBatch ? weiterZurAuswertung : (() => {
                  const gesperrt = heuteGesperrtOffen(quiz, schonAbgefragt);
                  return naechstesPaketUI(Math.max(0, (quiz.sessionGesamt || 0) - schonAbgefragt.size - gesperrt), doWeiter, doBeende, gesperrt);
                })()}
              </div>
            </div>
          </>
        );
      }
      const diktatKnoepfe = quiz.ausLernen ? (
        <button data-weiter-lernen {...tt("Zurück ins Lernen – weiter mit dem nächsten Paket")} className="btn btn-primary" style={{width:"100%", marginBottom:16}} onClick={zurueckZumLernen}>🎬 Weiter lernen</button>
      ) : (<>
        <button {...tt("Diktat beenden und zur Übersicht")} className="btn btn-primary" style={{width:"100%"}}
          onClick={() => { beendeQuiz(); }}>
          Zurück zur Liste
        </button>
        <div style={{marginBottom:16}}><button data-zurueck-statistik={quiz.ausStatistik ? "" : undefined} className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(beendeQuiz)} {...tt(quiz.ausStatistik ? "Zurück zur Statistik, aus der diese Runde gestartet wurde" : "Statistik zu dieser Abfragerunde öffnen")}>📊 {quiz.ausStatistik ? "Zurück zur Statistik" : "Zur Statistik"}</button></div>
      </>);
      if (quiz.sessionAuswertung) return sessionAuswertungSeite(quiz, diktatKnoepfe, () => { verlasseRunde(); });
      return (
        <>
          <style>{CSS}</style>{farbModusUI}{farbRadUI}
          <div className="app">
            <div className="topbar">
              <button {...tt(quiz.ausLernen ? "Schließen und weiter lernen" : quiz.ausStatistik ? "Diktat schließen und zurück zur Statistik" : "Diktat schließen und zur Übersicht")} className="topbar-back" onClick={() => { verlasseRunde(); }}>Schließen</button>
              <span className="topbar-title">Diktat abgeschlossen</span>
              <span className="quiz-fortschritt">{richtig} / {quiz.diktatErgebnisse.length} ✓</span>
            </div>
            <div className="sektion">
              <div style={{marginBottom:16}}>{weiterZurAuswertung}</div>
              <div className="karte">
                <div {...tt("Liste der Diktat-Ergebnisse auf- oder zuklappen")} style={{padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer"}}
                  onClick={() => setDiktatListeAufgeklappt(v => !v)}>
                  <span style={{fontWeight:600}}>{richtig} / {quiz.diktatErgebnisse.length} richtig</span>
                  <button {...tt("Liste der Diktat-Ergebnisse auf- oder zuklappen")} className="btn-toggle" style={{padding:"3px 6px"}} onClick={e => { e.stopPropagation(); setDiktatListeAufgeklappt(v => !v); }}>
                    {diktatListeAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                  </button>
                </div>
                {diktatListeAufgeklappt && quiz.diktatErgebnisse.map((e, i) => (
                  <div key={i} className="diktat-summary-zeile" style={{padding:"10px 16px"}}>
                    <span style={{fontSize:"1.1rem", fontWeight:700, color: e.richtig ? "var(--haupt)" : "var(--falsch)", minWidth:22}}>
                      {e.richtig ? "✓" : "✗"}
                    </span>
                    <div>
                      <div style={{fontWeight:600, fontSize:"0.95rem"}}>{e.wort}</div>
                      {e.uebersetzung && <div style={{fontSize:"0.82rem", color:"var(--text2)"}}>{e.uebersetzung}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    }

    const aktVok = quiz.vokabeln[quiz.index];
    const diktatWort = aktVok[quiz.diktatSpalte]?.wert || "";
    const uebersetzung = quiz.diktatUeberspalte ? aktVok[quiz.diktatUeberspalte]?.wert : null;
    const hint = diktatHint(ohneHinweis(diktatWort), quiz.diktatAufgedeckt);
    const diktatScore = aktVok.diktatFortschritt?.score ?? 0;

    const diktatWeiter = quiz.phase === "richtig" || quiz.phase === "aufgedeckt";
    let antwortBoxKlasse = "quiz-antwort-box";
    if (quiz.phase === "richtig") antwortBoxKlasse += " richtig";
    if (quiz.gelerntBlitz && quiz.gelerntBlitz === blitzKey(quiz)) antwortBoxKlasse += " gelernt-blitz";
    else if (quiz.phase === "aufgedeckt") antwortBoxKlasse += " aufgedeckt";
    else if (quiz.feedback) antwortBoxKlasse += " falsch";

    return (
      <>
        <style>{CSS}</style>{farbModusUI}{farbRadUI}{renderVokabelEditor()}
        <div className="app">
          <div className="topbar">
            <button {...tt("Diktat abbrechen – bisherige Ergebnisse werden ausgewertet")} className="topbar-back" onClick={() => { beendeQuiz(); }}>Beenden</button>
            <span className="topbar-title"><span>{quiz.index + 1} / {quiz.vokabeln.length}</span>{renderKopfFortschritt(quiz)}</span>
            <span className="quiz-fortschritt">Score: {diktatScore > 0 ? "+" : ""}{diktatScore}</span>
          </div>
          <div className="sektion" style={{display:"flex", flexDirection:"column", paddingBottom:0}}>
            {/* Lautsprecher-Box – nicht Teil der Weiter-Zone */}
            <div className="quiz-frage-box" style={{textAlign:"center", marginBottom:14, flexShrink:0}} data-karte-diktat
              {...tt("Lang drücken: richtige Antwort bearbeiten", [
                { label: "✎ Richtige Antwort bearbeiten", fn: () => oeffneVokabelBearbeiten(quiz.vokabeln[quiz.index], quiz.vokabeln[quiz.index]._listeId ?? quiz.liste.id, quiz.diktatSpalte) },
                { label: "🚫 Nicht mehr abfragen", fn: nimmVokabelHeraus },
              ], { langText: `${quiz.liste.spalten[quiz.diktatSpalte]?.name || quiz.diktatSpalte}: richtige Antwort bearbeiten` })}>
              <div className="quiz-label">{quiz.liste.spalten[quiz.diktatSpalte]?.name || quiz.diktatSpalte} — hör genau hin!</div>
              {quiz.diktatSpalte.startsWith('E') && (
                <button {...tt("Wort vorlesen")} className="diktat-play-btn"
                  onClick={() => { setDiktatManualPlays(p => p + 1); sprich(diktatWort, vokLang(aktVok, quiz.diktatSpalte)); }}>
                  <IcoSpkOn s={52}/>
                </button>
              )}
              {uebersetzung && (
                <div className="diktat-uebersetzung" style={{visibility: diktatManualPlays >= 2 ? "visible" : "hidden"}}>
                  {quiz.liste.spalten[quiz.diktatUeberspalte]?.name || quiz.diktatUeberspalte}: {uebersetzung}
                </div>
              )}
            </div>

            {/* Weiter-Zone: gesamter Bereich unterhalb der Lautsprecher-Box */}
            <div
              onClick={() => diktatWeiter && naechsteDiktatVokabel()}
              style={{
                cursor: diktatWeiter ? "pointer" : "default",
                flex: 1,
                minHeight: "60vh",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}>
              <div className={antwortBoxKlasse}>
                {antwortBoxKlasse.includes("gelernt-blitz") && <GelerntSterne/>}
                {quiz.phase === "eingabe" && <div className="quiz-label">Deine Eingabe</div>}
                {quiz.phase === "eingabe" && hint && <div className="diktat-hint">{hint}</div>}
                {quiz.phase === "eingabe" && (
                  <input {...ttFeld("Das vorgelesene Wort hier eintippen, dann „Prüfen“")} ref={eingabeRef} className="inp"
                    value={quiz.eingabe}
                    onChange={e => setQuiz(prev => ({...prev, eingabe: e.target.value}))}
                    onKeyDown={e => e.key === "Enter" && pruefeDiktatAntwort()}
                    onClick={e => e.stopPropagation()}
                    placeholder="Was wurde vorgelesen?"
                    style={{marginTop:4}}
                  />
                )}
                {quiz.phase === "richtig" && (
                  <div style={{textAlign:"center", padding:"12px 0", fontSize:"1.15rem"}}>
                    <strong>{mitHinweis(diktatWort)}</strong>
                    {uebersetzung ? <span style={{color:"var(--richtig-dunkel)"}}> – {uebersetzung}</span> : null}
                    <span style={{color:"var(--richtig-dunkel)"}}> ✓</span>
                    {quiz.feedback && <div className="quiz-feedback ok" style={{marginTop:6}}>{quiz.feedback}</div>}
                  </div>
                )}
                {quiz.phase === "aufgedeckt" && (
                  <div style={{textAlign:"center", padding:"12px 0", fontSize:"1.15rem"}}>
                    <strong>{mitHinweis(diktatWort)}</strong>
                    {uebersetzung ? <span style={{color:"var(--text2)"}}> – {uebersetzung}</span> : null}
                  </div>
                )}
                {quiz.feedback && quiz.phase === "eingabe" && (
                  <div className="quiz-feedback nein">{quiz.feedback}</div>
                )}
              </div>

              <div className="quiz-aktionen" onClick={e => e.stopPropagation()}>
                {quiz.phase === "eingabe" && (
                  <>
                    <button className="btn btn-primary" onClick={pruefeDiktatAntwort} {...tt("Eingegebene Lösung prüfen")}>Prüfen</button>
                    {quiz.diktatSpalte.startsWith('E') && (
                      <button className="btn btn-ghost" onClick={() => sprichDiktatNochmal(diktatWort, vokLang(aktVok, quiz.diktatSpalte))} {...tt("Diktat-Wort nochmals mit anderer Stimme vorlesen")}><IcoSpkOn s={18}/> Andere Stimme</button>
                    )}
                    <button className="btn btn-ghost" onClick={zeigeDiktatLoesung} {...tt("Lösung anzeigen – zählt als nicht gewusst")}>Lösung anzeigen</button>
                  </>
                )}
                {diktatWeiter && (
                  <button className="btn btn-primary" onClick={e => { e.stopPropagation(); naechsteDiktatVokabel(); }} {...tt("Nächste Vokabel")}>Weiter →</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  
}
