import { CSS } from "../stil.js";
import { LERNEN_TIPPEN, mitHinweis } from "../quiz.jsx";
import { aktiveStimmen, gewaehlteStimme, normLang, stimmeFuer } from "../sprache.js";

// Phase 2 (Aufteilung): Ansicht aus App.jsx – if (lernen && !lernen.imQuiz) { … }
// app = die Zustände, Setter und Funktionen der Komponente, die diese Ansicht braucht
export function LernenAnsicht(app) {
  const { beendeLernen, farbModusUI, farbRadUI, lernEinstellungen, lernPause, lernen, lernenVor, lernenWeiter, lernenZurueck, naechstesLernPaket, setLernen, setzeLernEinst, starteLernQuiz, tt, ttFeld, vokLang, wechsleStimme } = app;

    const n = lernen.voks.length;
    const gesamt = lernen.alle.length;
    const rest = gesamt - (lernen.start + n);
    const paketNr = Math.floor(lernen.start / lernen.groesse) + 1, paketeGesamt = Math.ceil(gesamt / lernen.groesse);
    const v = lernen.voks[lernen.index];
    const name = t => lernen.liste?.spalten?.[t]?.name || t;
    const pct = Math.round((lernen.start + (lernen.fertig ? n : lernen.index + lernen.phase / 3)) / gesamt * 100);
    const seite = (spalten, art) => spalten.filter(t => v[t]?.wert).map(t => (
      <div key={t} className={`lernen-zeile${art === "danach" ? " lernen-uebersetzung" : ""}`} {...(art === "danach" ? { "data-lernen-uebersetzung": true } : { "data-lernen-wort": true })}>
        <div className="lernen-label">{name(t)}</div>
        <div className="lernen-wort">{mitHinweis(v[t].wert)}</div>
      </div>
    ));
    const le = lernEinstellungen();
    const infoTeile = le.info ? lernen.info.filter(t => v?.[t]?.wert) : [];
    return (
      <>
        <style>{CSS}</style>{farbModusUI}{farbRadUI}
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" data-lernen-beenden onClick={beendeLernen} {...tt("Lernen schließen – der Lernstand bleibt gespeichert; „Weiter lernen“ im Quiz-Tab macht hier weiter (Scores bleiben unverändert)")}>Schließen</button>
            <span className="topbar-title">🎬 Lernen<span className="kopf-balken"><span style={{width:`${pct}%`}}/></span></span>
            <span className="quiz-fortschritt" data-lernen-stand>{lernen.start + (lernen.fertig ? n : lernen.index + 1)} / {gesamt}</span>
          </div>
          <div className="sektion">
            {lernen.fertig ? (<>
              <div className="quiz-frage-box" data-lernen-fertig style={{padding:"30px 16px", textAlign:"center", position:"relative"}}>
                <button className="lernen-nochmal" data-lernen-nochmal aria-label="Paket nochmals ansehen"
                  onClick={() => setLernen(l => ({ ...l, index: 0, phase: 0, fertig: false, pausiert: false, lauf: l.lauf + 1 }))}
                  {...tt("Dieses Paket nochmals ansehen (das Quiz gibt es je Paket nur einmal)")}>🔄</button>
                <div style={{fontSize:"2.2rem", lineHeight:1}}>🎬</div>
                <div className="quiz-frage-text" style={{textAlign:"center", marginTop:10}}>
                  {rest > 0 ? `${n} Vokabel${n !== 1 ? "n" : ""} angesehen` : `Alle ${gesamt} Vokabeln angesehen`}
                </div>
                {paketeGesamt > 1 && <div style={{fontSize:"0.85rem", color:"var(--text2)", marginTop:6}} data-lernen-paket>Paket {paketNr} von {paketeGesamt}</div>}
              </div>
              {!lernen.quizGemacht && (
                <button className="btn btn-primary" style={{width:"100%", marginTop:14, background:"var(--karte)", color:"var(--haupt)", border:"1.5px solid var(--haupt-zart)"}} data-lernen-quiz onClick={starteLernQuiz}
                  {...tt("Genau diese Vokabeln einmal abfragen – gewusste verbessern den Score, falsche kosten keinen Punkt; danach geht es mit dem nächsten Paket weiter")}>
                  Quiz mit diesen {n} Vokabel{n !== 1 ? "n" : ""}
                </button>
              )}
              {rest > 0 && (
                <button className="btn btn-primary" style={{width:"100%", marginTop:8}} data-lernen-weiter
                  onClick={() => setLernen(l => naechstesLernPaket(l))} {...tt("Ohne Quiz mit den nächsten Vokabeln weiterlernen")}>
                  Weiter lernen: nächste {Math.min(lernen.groesse, rest)}
                </button>
              )}
              <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={beendeLernen} {...tt("Zurück zum Quiz-Tab – der Lernstand bleibt gespeichert, solange noch Vokabeln übrig sind")}>Zur Übersicht</button>
            </>) : (<>
              <div className="quiz-frage-box lernen-karte" data-lernen-karte data-lernen-phase={lernen.phase} onClick={lernenWeiter}
                {...tt(lernen.phase === 0 ? "Antippen: Übersetzung sofort zeigen" : "Antippen: sofort weiter (Zusatzinfo bzw. nächste Vokabel)")}>
                {(() => {   // Stimme wechseln (Fremdsprache dieser Vokabel), wie auf der Abfrage-Karte
                  const t = [...lernen.zuerst, ...lernen.danach].find(x => x.startsWith("E") && v?.[x]?.wert);
                  if (!t) return null;
                  const lang = vokLang(v, t), basis = normLang(lang).split("-")[0], aktiv = aktiveStimmen(basis);
                  if (aktiv.length < 2) return null;
                  const nr = Math.max(0, aktiv.indexOf(gewaehlteStimme(basis) || stimmeFuer(lang))) + 1;
                  return <button className="stimme-wechsel" data-stimme-wechsel="lernen" style={{left:6, right:"auto"}} onClick={e => { e.stopPropagation(); wechsleStimme(v[t].wert, lang); }}
                    {...tt(`Stimme ${nr} von ${aktiv.length} – antippen: mit der nächsten aktivierten Stimme vorlesen (bleibt dann für diese Sprache eingestellt)`)}>{nr}/{aktiv.length}</button>;
                })()}
                {lernen.pausiert && <div className="lernen-pausiert" aria-hidden="true">⏸</div>}
                {!lernen.pausiert && lernPause(lernen, v) >= LERNEN_TIPPEN && <div className="lernen-tippen" data-lernen-tippen>▸</div>}
                {/* je Vokabel neu aufgebaut: das Wort blendet ein; Übersetzung und Zusatzinfo belegen ihren Platz schon vorher */}
                <div key={`${lernen.start + lernen.index}-${lernen.lauf}`} className="lernen-inhalt">
                  <div className="lernen-teil sichtbar lernen-ein">{seite(lernen.zuerst, "zuerst")}</div>
                  <div className="lernen-trenner"/>
                  <div className={`lernen-teil${lernen.phase >= 1 ? " sichtbar" : ""}`} data-lernen-teil="uebersetzung" data-sichtbar={lernen.phase >= 1 || undefined}>
                    {seite(lernen.danach, "danach")}
                  </div>
                  {infoTeile.length > 0 && (
                    <div className={`lernen-teil${lernen.phase === 2 ? " sichtbar" : ""}`} data-lernen-teil="info" data-sichtbar={lernen.phase === 2 || undefined}>
                      {infoTeile.map(t => (
                        <div key={t} className="lernen-info" data-lernen-info>
                          <div className="lernen-trenner duenn"/>
                          <div className="lernen-label">{name(t)}</div>
                          <div>{mitHinweis(v[t].wert)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="lernen-steuerung">
                <button className="btn btn-ghost" data-lernen-zurueck onClick={lernenZurueck} disabled={lernen.index === 0}
                  {...tt("Zurück zur vorigen Vokabel")}>⏮</button>
                <button className="btn btn-primary" data-lernen-pause={lernen.pausiert ? "an" : "aus"} onClick={() => setLernen(l => ({ ...l, pausiert: !l.pausiert }))}
                  {...tt(lernen.pausiert ? "Weiterlaufen lassen" : "Anhalten – antippen der Karte geht trotzdem weiter")}>{lernen.pausiert ? "▶" : "⏸"}</button>
                <button className="btn btn-ghost" data-lernen-vor onClick={lernenVor}
                  {...tt("Weiter zur nächsten Vokabel")}>⏭</button>
              </div>
              <button className="lernen-einst-knopf" data-lernen-einst-knopf={le.einstOffen ? "offen" : "zu"} onClick={() => setzeLernEinst({ einstOffen: !le.einstOffen })}
                {...tt(le.einstOffen ? "Vorlesen, Zusatzinfo und Pausen einklappen" : "Vorlesen, Zusatzinfo und Pausen einstellen")}>
                ⚙ Vorlesen &amp; Pausen {le.einstOffen ? "▴" : "▾"}
              </button>
              {le.einstOffen && (
              <div className="lernen-regler">
                <div className="lernen-regler-zeile">
                  <span>Vorlesen</span>
                  <div className="lernen-vorlesen">
                    {[["vorlesen1", "Wort"], ["vorlesen2", "Übersetzung"], ["vorlesen3", "Info"]].filter(([k]) => k !== "vorlesen3" || lernen.info.length > 0).map(([k, label]) => (
                      <button key={k} className={`typ-btn${le[k] ? " aktiv" : ""}`} data-lernen-vorlesen-schalter={k} onClick={() => setzeLernEinst({ [k]: !le[k] })}
                        {...tt(`${label} vorlesen – antippen schaltet ${le[k] ? "aus" : "ein"}`)}>{label}</button>
                    ))}
                  </div>
                </div>
                {lernen.info.length > 0 && (
                  <div className="lernen-regler-zeile">
                    <span>Zusatzinfo</span>
                    <div className="toggle-btn">
                      <button className={`toggle-opt${le.info ? " aktiv" : ""}`} data-lernen-info-schalter="an" onClick={() => setzeLernEinst({ info: true })}
                        {...tt("Zusatzinfo (Info-Spalten) nach der Übersetzung einblenden")}>An</button>
                      <button className={`toggle-opt${!le.info ? " aktiv" : ""}`} data-lernen-info-schalter="aus" onClick={() => setzeLernEinst({ info: false })}
                        {...tt("Ohne Zusatzinfo – nur Wort und Übersetzung")}>Aus</button>
                    </div>
                  </div>
                )}
                {[["pauseWort", "Pause Wort", "nach dem Wort"], ["pauseUeb", "Pause Übers.", "nach der Übersetzung"],
                  ["pauseInfo", lernen.info.length > 0 && le.info ? "Pause Info" : "Pause Ende", lernen.info.length > 0 && le.info ? "nach der Zusatzinfo" : "vor der nächsten Vokabel"]].map(([k, label, wann]) => (
                  <div key={k} className="lernen-regler-zeile">
                    <span>{label}</span>
                    <input type="range" min="0" max={LERNEN_TIPPEN} step="0.5" value={le[k]} data-lernen-pause-regler={k}
                      onChange={e => setzeLernEinst({ [k]: parseFloat(e.target.value) })}
                      {...ttFeld(`Pause ${wann} – zusätzlich zur Lese- bzw. Vorlesezeit; ganz rechts: warten, bis du antippst`)}/>
                    <b data-lernen-pause-wert={k}>{le[k] >= LERNEN_TIPPEN ? "Tippen" : `${String(le[k]).replace(".", ",")} s`}</b>
                  </div>
                ))}
              </div>
              )}
            </>)}
          </div>
        </div>
      </>
    );
  
}
