import { IcoPencil, IcoSpk } from "../komponenten.jsx";
import { SK, TYPEN, lsSet } from "../speicher.js";
import { aeusserung, listeSprache, spalteLang, sprachInfo } from "../sprache.js";
import { clampScore, ohneHinweis, scoreSymbole } from "../quiz.jsx";
import { istSynonymSpalte } from "../saetze.js";

// Phase 2 (Aufteilung): Bereich aus dem Haupt-return von App.jsx (tab === "listen" && ansicht === "liste-detail" && aktiveListe)
// app = Zustände, Setter und Funktionen der Komponente (siehe „const app“ in App.jsx)
export function ListeDetail(app) {
  const { aktiveListe, aktiveListeId, ansichtSpaltenAn, ausListeRef, blitzt, einstellungen, handleTabWechsel, headerH, ladeSlot, listeDetailKopfH, listeNurAus, listenBereich, listenGelerntAusblenden, listenSaetze, listenZeileH, listenZeileRef, oeffneModal, oeffneSatzFenster, oeffneSynFenster, oeffneVokabelBearbeiten, renderSprachAuswahl, renderSuchleiste, resetImport, setAnsicht, setAnsichtSpaltenAn, setBearbeiteVokabel, setImportBestehendId, setImportZielTyp, setListeNurAus, setListenBereich, setListenGelerntAusblenden, setModal, setQuiz, setQuizSessionAufgeklappt, setSlotSektionAufgeklappt, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikEinzelauswahlAufgeklappt, setStatistikListenAufgeklappt, setStatistikListenIds, setSucheListe, setTab, setzeHerausgenommen, setzeListenSprache, setzeSpaltenArt, starteQuizErstellen, suchInfo, suchMarke, sucheListe, tt, vokabelAufgeklappt } = app;
  return (
(() => {
          const aktiveSpalten = TYPEN.filter(t => aktiveListe.spalten[t].aktiv);
          const abfragbareSpalten = aktiveSpalten.filter(t => !t.startsWith('i'));
          const schwelleL = einstellungen.gelerntSchwelle ?? 0;
          const gelernteInListe = schwelleL > 0
            ? aktiveListe.vokabeln.filter(v => (v.fortschritt?.score ?? -Infinity) >= schwelleL).length : 0;
          const ausInListe = aktiveListe.vokabeln.filter(v => v.herausgenommen).length;
          const nurAus = listeNurAus && ausInListe > 0;
          const anzeigeVoks = nurAus ? aktiveListe.vokabeln.filter(v => v.herausgenommen)
            : listenGelerntAusblenden && schwelleL > 0
            ? aktiveListe.vokabeln.filter(v => (v.fortschritt?.score ?? -Infinity) < schwelleL)
            : aktiveListe.vokabeln;
          const listenSuche = suchInfo(anzeigeVoks, sucheListe);
          // In der Vokabelliste angezeigte Spalten (je Liste gemerkt, Standard: nur die erste); mindestens eine bleibt sichtbar
          const gemerkt = aktiveSpalten.filter(t => (ansichtSpaltenAn[aktiveListeId] || []).includes(t));
          const anzeigeSpalten = gemerkt.length > 0 ? gemerkt : aktiveSpalten.slice(0, 1);
          const schalteSpalte = typ => {
            const an = anzeigeSpalten.includes(typ)
              ? anzeigeSpalten.filter(t => t !== typ)
              : aktiveSpalten.filter(t => t === typ || anzeigeSpalten.includes(t));
            if (an.length === 0) return;
            const neu = { ...ansichtSpaltenAn, [aktiveListeId]: an };
            setAnsichtSpaltenAn(neu);
            lsSet(SK.ansichtSpalten, neu);
          };
          const saetze = listenSaetze.listeId === aktiveListeId ? listenSaetze.saetze : {};
          const mitSaetzen = aktiveListe.vokabeln.filter(v => (saetze[`${aktiveListeId}__${v.id}`] || []).length > 0);
          const fremdTyp = TYPEN.find(t => t.startsWith("E") && aktiveListe.spalten[t]?.aktiv);
          const spr = sprachInfo(listeSprache(aktiveListe));
          const lb = listenBereich;
          const pfeil = <span aria-hidden="true" style={{marginLeft:6, fontSize:"0.7em"}}>▲</span>;
          // Zelle der Knopfzeile: zu = aktueller Stand; offen = „Bestätigen“ (Auswahl) bzw. Name mit Pfeil (nur ansehen)
          const zelle = (k, label, zuText, offenText2, hilfe, bestaetigen = false) => (
            <div key={k} className={`quiz-zeile-zelle${lb === k ? " offen" : ""}`} style={k === "sprache" ? {flex:1.5} : undefined}><span className="quiz-zeile-label">{label}</span>
              <button data-liste-bereich={k} className={`quiz-zeile-knopf${lb === k ? (bestaetigen ? " offen bestaetigen-knopf" : " offen") : ""}${lb ? "" : blitzt(`lb:${k}`)}`}
                onClick={() => setListenBereich(b => b === k ? null : k)} {...tt(hilfe)}>{lb === k ? offenText2 : zuText}</button>
            </div>
          );
          return (
            <>
            <div className="sektion" style={{paddingTop:0}}>
              <div ref={listenZeileRef} data-listen-zeile className="quiz-zeile" style={{top: headerH + listeDetailKopfH, marginBottom:12}}>
                {zelle("vokabeln", "Vokabeln", `${aktiveListe.vokabeln.length}`, <>{aktiveListe.vokabeln.length}{pfeil}</>, lb === "vokabeln" ? "Vokabeln zuklappen" : "Vokabeln der Liste ansehen, bearbeiten und ergänzen")}
                {zelle("saetze", "Beispielsätze", `💬 ${mitSaetzen.length}/${aktiveListe.vokabeln.length}`, <>💬 {mitSaetzen.length}/{aktiveListe.vokabeln.length}{pfeil}</>, lb === "saetze" ? "Beispielsätze zuklappen" : "Beispielsätze ansehen und per KI ergänzen")}
                {zelle("spalten", "Spalten", `${aktiveSpalten.length}`, <>{aktiveSpalten.length}{pfeil}</>, lb === "spalten" ? "Spalten zuklappen" : "Spalten ansehen und umbenennen")}
                {zelle("sprache", "Fremdsprache", `${spr.flagge} ${spr.name}`, <span data-bestaetigen>Bestätigen</span>, lb === "sprache" ? "Auswahl übernehmen und zuklappen" : "Fremdsprache der Liste – bestimmt Vorlese-Stimme und Sprachfilter", true)}
              </div>

              {!lb && abfragbareSpalten.length >= 2 && aktiveListe.vokabeln.length > 0 && (
                <div style={{display:"flex", gap:8, marginBottom:8}}>
                <button className="btn btn-primary" data-liste-quiz-starten style={{flex:1}}
                  onClick={() => {
                    // 217: die Liste selbst ist das Quiz (Fortschritt und Einstellungen merkt sie sich, nichts zu speichern)
                    setSlotSektionAufgeklappt(false); setQuizSessionAufgeklappt(false);
                    handleTabWechsel("quiz"); setQuiz(null); setAnsicht("uebersicht");
                    ladeSlot("listen", aktiveListeId);
                    ausListeRef.current = { listeId: aktiveListeId, ziel: "liste" };   // 204
                  }}
                  {...tt("Diese Liste abfragen – sie merkt sich Fortschritt und Einstellungen")}>
                  Quiz starten
                </button>
                <button className="btn btn-ghost" data-liste-quiz-erstellen style={{flex:1}}
                  onClick={() => starteQuizErstellen(aktiveListeId)}
                  {...tt("Aus dieser Liste ein Quiz erstellen: Bereich und Einstellungen wählen, dann mit Namen in einem Ordner ablegen")}>
                  Quiz erstellen
                </button>
                </div>
              )}
              {!lb && aktiveListe.vokabeln.length > 0 && (
                <button className="btn btn-ghost" style={{width:"100%", marginBottom:8}}
                  onClick={() => {
                    setStatistikListenIds(new Set([aktiveListeId]));
                    setStatistikBereichTyp("alle");
                    setStatistikCheckboxAuswahl(new Set());
                    setStatistikListenAufgeklappt(false);
                    setStatistikEinzelauswahlAufgeklappt(false);
                    setTab("statistik");
                  }}
                  {...tt("Statistik für diese Liste öffnen")}>
                  Statistik
                </button>
              )}

              {lb === "sprache" && (
                <div className="karte" data-liste-sprache-wahl style={{padding:"12px 16px"}}>
                  {renderSprachAuswahl(listeSprache(aktiveListe), code => { setzeListenSprache(code); setListenBereich(null); })}
                </div>
              )}

              {lb === "saetze" && (
                <div className="karte" data-liste-saetze style={{padding:"12px 16px"}}>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <span style={{flex:1, fontSize:"0.88rem"}} data-liste-saetze-anzahl>💬 {mitSaetzen.length} von {aktiveListe.vokabeln.length} Vokabeln</span>
                    <button className="btn btn-ghost btn-sm" data-saetze-ergaenzen onClick={() => oeffneSatzFenster(aktiveListeId)} {...tt("Beispielsätze per KI ergänzen (Prompt kopieren oder als Datei, Antwort einfügen)")}>✨ Ergänzen</button>
                  </div>
                  {mitSaetzen.map(v => (
                    <div key={v.id} style={{marginTop:10}} data-satz-vok={v.id}>
                      <div style={{fontWeight:700, fontSize:"0.88rem"}}>{ohneHinweis(v[fremdTyp]?.wert || "")}</div>
                      {(saetze[`${aktiveListeId}__${v.id}`] || []).map((x, i) => (
                        <div key={i} style={{fontSize:"0.82rem", margin:"2px 0 0 8px"}}>
                          {x.s.split(/\*([^*]+)\*/).map((t, k) => k % 2 ? <b key={k}>{t}</b> : t)} <span style={{color:"var(--text3)"}}>– {x.u}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {lb === "spalten" && (
              <div className="karte" data-liste-spalten>
                {TYPEN.map(typ => {
                  const s = aktiveListe.spalten[typ];
                  return (
                    <div key={typ} className="karte-zeile">
                      <span className={`spalten-badge${s.aktiv ? " aktiv" : ""}`}>{typ}</span>
                      <div className="karte-zeile-info">
                        <div className="karte-zeile-name" style={{color: s.aktiv ? "var(--text-stark)" : "var(--text2)"}}>
                          {s.aktiv ? (s.name || `Spalte ${typ}`) : "nicht belegt"}
                        </div>
                        {s.aktiv && <div className="karte-zeile-sub">{typ.startsWith("i") ? (istSynonymSpalte(s) ? "Synonyme (nicht abfragbar)" : "Info (nicht abfragbar)") : "Abfragbar"}</div>}
                      </div>
                      {s.aktiv && typ.startsWith("i") && (
                        <div className="toggle-btn" data-spalten-art={typ} style={{display:"flex", flexShrink:0}}>
                          {[["info", "Info", "Info-Spalte: erscheint im Info-Kasten der Abfrage"], ["synonyme", "Synonyme", "Synonyme: eigener Kasten „Synonyme“ in der Abfrage; ein getipptes Synonym zählt nicht als Fehler"]].map(([a, l, info]) => (
                            <button key={a} data-spalten-art-wahl={a} className={`toggle-opt${(istSynonymSpalte(s) ? "synonyme" : "info") === a ? " aktiv" : ""}`} style={{fontSize:"0.75rem", padding:"4px 8px"}}
                              onClick={() => setzeSpaltenArt(typ, a)} {...tt(info)}>{l}</button>
                          ))}
                        </div>
                      )}
                      {s.aktiv && (
                        <button className="btn btn-ghost-filled btn-sm" style={{padding:"6px 10px"}} onClick={() => oeffneModal("spalte-umbenennen", typ)} {...tt("Spaltenname bearbeiten")}><IcoPencil s={14}/></button>
                      )}
                    </div>
                  );
                })}
                <div className="karte-zeile" style={{justifyContent:"flex-end"}}>
                  <button className="btn btn-ghost btn-sm" data-synonyme-ergaenzen onClick={() => oeffneSynFenster(aktiveListeId)}
                    {...tt("Synonyme per KI ergänzen (Prompt kopieren oder als Datei, Antwort einfügen) – sie kommen in die Synonym-Spalte bzw. eine freie Info-Spalte")}>≈ Synonyme ergänzen</button>
                </div>
              </div>
              )}

              {vokabelAufgeklappt && (
                aktiveListe.vokabeln.length === 0 ? (
                  <div className="leer"><div className="leer-text">Noch keine Vokabeln.</div>
                    <button data-vokabel-neu className="btn btn-primary btn-sm" style={{marginTop:10}} onClick={() => {
                      resetImport(); setImportZielTyp("bestehend"); setImportBestehendId(aktiveListeId); setAnsicht("import");
                    }} {...tt("Neue Vokabel hinzufügen oder aus Datei importieren")}>＋ Vokabeln hinzufügen</button></div>
                ) : (<>
                  <div data-ansicht-spalten style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:8}}>
                    {aktiveSpalten.length > 1 && (<>
                      <span style={{fontSize:"0.75rem", color:"var(--text2)"}}>Anzeigen:</span>
                      {aktiveSpalten.map(typ => {
                        const an = anzeigeSpalten.includes(typ);
                        return (
                          <button key={typ} data-ansicht-spalte={typ} className={`typ-btn${an ? " aktiv" : ""}`} style={{fontSize:"0.72rem", padding:"3px 10px"}}
                            onClick={() => schalteSpalte(typ)}
                            {...tt(an ? `Spalte „${aktiveListe.spalten[typ].name || typ}“ in der Vokabelliste ausblenden` : `Spalte „${aktiveListe.spalten[typ].name || typ}“ wieder anzeigen`)}>
                            {aktiveListe.spalten[typ].name || typ}
                          </button>
                        );
                      })}
                    </>)}
                    <span style={{marginLeft:"auto", display:"flex", gap:6, flexShrink:0}}>
                      {ausInListe > 0 && (
                        <button data-nur-aus={nurAus ? "an" : "aus"} className={`typ-btn${nurAus ? " aktiv" : ""}`} style={{fontSize:"0.72rem", padding:"3px 10px"}}
                          onClick={() => setListeNurAus(v => !v)}
                          {...tt(nurAus ? "Wieder alle Vokabeln zeigen" : `Nur die ${ausInListe} herausgenommenen Vokabeln zeigen (werden nicht abgefragt)`)}>🚫 {ausInListe}</button>
                      )}
                      {schwelleL > 0 && gelernteInListe > 0 && (
                        <button data-gelernte-ausblenden className={`typ-btn${listenGelerntAusblenden ? " aktiv" : ""}`} style={{fontSize:"0.72rem", padding:"3px 10px"}}
                          onClick={() => setListenGelerntAusblenden(v => !v)}
                          {...tt(listenGelerntAusblenden ? `${gelernteInListe} gelernte Vokabeln ausgeblendet – antippen: wieder zeigen` : `Gelernte Vokabeln (${gelernteInListe}) ausblenden`)}>
                          {listenGelerntAusblenden ? `✓ −${gelernteInListe}` : "✓ ausblenden"}
                        </button>
                      )}
                      <button data-vokabel-neu className="typ-btn aktiv" style={{fontSize:"0.8rem", padding:"3px 12px"}} onClick={() => {
                        resetImport(); setImportZielTyp("bestehend"); setImportBestehendId(aktiveListeId); setAnsicht("import");
                      }} {...tt("Neue Vokabel hinzufügen oder aus Datei importieren")}>＋</button>
                    </span>
                  </div>
                  <div className="karte" style={{overflow:"visible"}}>
                    {renderSuchleiste("liste", anzeigeVoks, sucheListe, setSucheListe, headerH + listeDetailKopfH + listenZeileH)}
                    {anzeigeVoks.map(vok => {
                      if (listenSuche.filter && !listenSuche.ids.has(vok.id)) return null;   // „nur Treffer“
                      const score = vok.fortschritt != null ? clampScore(vok.fortschritt.score) : null;
                      const istGelernt = schwelleL > 0 && (vok.fortschritt?.score ?? -Infinity) >= schwelleL;
                      return (
                        <div key={vok.id} className="karte-zeile" data-such-ziel="liste" data-such-id={vok.id} data-herausgenommen={vok.herausgenommen ? "" : undefined}
                          style={{flexDirection:"column", alignItems:"flex-start", gap:4, ...(vok.herausgenommen ? { opacity: 0.5 } : {}), ...suchMarke(listenSuche, vok.id)}}
                          {...tt(vok.herausgenommen ? "Herausgenommen – wird nicht abgefragt" : "Lang drücken: Vokabel herausnehmen (nicht mehr abfragen)",
                            [vok.herausgenommen ? { label: "↩ Wieder abfragen", fn: () => setzeHerausgenommen(aktiveListeId, vok.id, false) }
                              : { label: "🚫 Nicht mehr abfragen", fn: () => setzeHerausgenommen(aktiveListeId, vok.id, true) }])}>
                          <div style={{display:"flex", width:"100%", justifyContent:"space-between", alignItems:"flex-start"}}>
                            <div style={{display:"flex", flexDirection:"column", gap:3, flex:1}}>
                              {anzeigeSpalten.map(typ => vok[typ] ? (
                                <div key={typ} style={{display:"flex", alignItems:"baseline", gap:6}}>
                                  <span className="spalten-badge aktiv">{aktiveListe.spalten[typ].name || typ}</span>
                                  <span style={{fontSize:"0.88rem"}}>{vok[typ].wert}</span>
                                  {vok[typ].falsch?.length > 0 && <span style={{fontSize:"0.75rem", color:"var(--text2)"}}>(+{vok[typ].falsch.length})</span>}
                                </div>
                              ) : null)}
                            </div>
                            <div style={{display:"flex", alignItems:"center", gap:2, flexShrink:0, marginLeft:8}}>
                              {vok.herausgenommen && <span data-aus-marke style={{marginRight:4}}>🚫</span>}
                              {istGelernt && (
                                <span style={{background:"var(--haupt-flaeche)", color:"var(--haupt)", borderRadius:4,
                                  fontSize:"0.65rem", padding:"1px 5px", fontWeight:700, marginRight:2}}>✓</span>
                              )}
                              {scoreSymbole(vok.fortschritt?.score, true)}
                              {score !== null && (
                                <span className={`score-badge ${score > 0 ? "score-pos" : score < 0 ? "score-neg" : "score-null"}`} style={{marginRight:4}}>
                                  {score > 0 ? "+" : ""}{score}
                                </span>
                              )}
                              {aktiveSpalten.some(typ => typ.startsWith('E') && vok[typ]?.wert) && (
                                <button {...tt("Fremdsprachige Spalten vorlesen")} className="btn-icon" title="Vorlesen" onClick={() => {
                                  if (!window.speechSynthesis) return;
                                  window.speechSynthesis.cancel();
                                  aktiveSpalten.filter(typ => typ.startsWith('E')).forEach(typ => {
                                    if (!vok[typ]?.wert) return;
                                    window.speechSynthesis.speak(aeusserung(vok[typ].wert.split('/')[0].trim(), spalteLang(typ, listeSprache(aktiveListe))));
                                  });
                                }}><IcoSpk s={16}/></button>
                              )}
                              <button {...tt("Vokabel bearbeiten")} className="btn-icon" title="Bearbeiten" onClick={() => oeffneVokabelBearbeiten(vok)}><IcoPencil s={14}/></button>
                              <button {...tt("Vokabel löschen")} className="btn-icon" title="Löschen" style={{color:"var(--falsch)"}}
                                onClick={() => { setBearbeiteVokabel(vok); setModal('vokabel-loeschen'); }}>✕</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>)
              )}
            </div>
            </>
          );
        })()
  );
}
