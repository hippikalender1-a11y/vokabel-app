import { generierePrompt } from "../importexport.js";
import { sprachInfo } from "../sprache.js";
import { IcoX } from "../komponenten.jsx";
import { SK, TYPEN, formatSlotDatum, lsGet } from "../speicher.js";
import { ORDNER_TIEFE_MAX, eintraegeImOrdner, nameVergleich, ordnerPasst, ordnerPfad } from "../raster.js";
import { AKZENT_OHNE_ANTEILE, SCORE_FELD, STATISTIK_ARTEN, STUFEN_REGELN, ZUORDNUNG_SEKUNDEN, ZUORDNUNG_ZEITEN, hinweiseAus } from "../quiz.jsx";
import { Fragment } from "react";
import { SATZ_ANZAHLEN, SATZ_BEGLEITSATZ } from "../saetze.js";

// Phase 2 (Aufteilung): Dialoge und kleinere Bereiche aus dem Haupt-return von App.jsx. app = Namen der Komponente.

// aus App.jsx: {tab === "listen" && ansicht === "ki-prompt" && …}
export function KiPromptAnsicht(app) {
  const { promptAnzahl, promptBeispiele, promptFalsch, promptModus, promptSprache, promptSynonyme, promptThema, renderSprachAuswahl, setPromptAnzahl, setPromptBeispiele, setPromptFalsch, setPromptModus, setPromptSprache, setPromptSynonyme, setPromptThema, tt, ttFeld } = app;
  return (
<div className="sektion">
            <div style={{display:"flex", justifyContent:"center", gap:8, marginBottom:12}}>
              <button {...tt("Prompt für eine neue Vokabelliste zu einem Thema")} className={`typ-btn${promptModus==="generieren"?" aktiv":""}`}
                onClick={() => setPromptModus("generieren")}>Generieren</button>
              <button {...tt("Prompt, um ein Foto einer Vokabelseite umwandeln zu lassen")} className={`typ-btn${promptModus==="foto"?" aktiv":""}`}
                onClick={() => setPromptModus("foto")}>Foto umwandeln</button>
            </div>
            <div style={{fontSize:"0.82rem", color:"var(--text2)", marginBottom:12, textAlign:"center"}}>
              {promptModus === "generieren"
                ? "KI erstellt neue Vokabeln zum angegebenen Thema."
                : "KI liest Vokabeln aus einem beigefügten Foto und formatiert sie ins Import-Format."}
            </div>
            <div className="sektion-label" style={{marginBottom:8}}>Fremdsprache</div>
            <div style={{marginBottom:16}}>{renderSprachAuswahl(promptSprache, setPromptSprache)}</div>
            {promptModus === "generieren" && (
              <>
                <div className="sektion-label" style={{marginBottom:8}}>Thema</div>
                <input {...ttFeld("Thema der Vokabelliste, z. B. Schule, Tiere, Unit 5")} className="inp" value={promptThema}
                  onChange={e => setPromptThema(e.target.value)}
                  placeholder="z.B. Irregular Verbs, Adjektive Unit 5" />
                <div style={{display:"flex", gap:12, marginTop:12}}>
                  <div style={{flex:1}}>
                    <label className="inp-label">Anzahl Vokabeln</label>
                    <input {...ttFeld("Wie viele Vokabeln die KI erzeugen soll")} className="inp" type="number" min={1} max={200} value={promptAnzahl}
                      onChange={e => setPromptAnzahl(e.target.value)} />
                  </div>
                  <div style={{flex:1}}>
                    <label className="inp-label">Falsche Antworten (0–20)</label>
                    <input {...ttFeld("Anzahl falscher Antworten je Wort für Multiple Choice")} className="inp" type="number" min={0} max={20} value={promptFalsch}
                      onChange={e => setPromptFalsch(Math.min(20, Math.max(0, parseInt(e.target.value)||0)))} />
                  </div>
                </div>
              </>
            )}
            {promptModus === "foto" && (
              <div style={{marginBottom:4}}>
                <label className="inp-label">Falsche Antworten (0–20)</label>
                <input {...ttFeld("Anzahl falscher Antworten je Wort für Multiple Choice")} className="inp" type="number" min={0} max={20} value={promptFalsch}
                  onChange={e => setPromptFalsch(Math.min(20, Math.max(0, parseInt(e.target.value)||0)))} />
              </div>
            )}
            <div className="karte" style={{marginTop:16}}>
              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Beispielsätze</div>
                  <div className="toggle-sub">Info-Spalte mit Beispielsätzen auf {sprachInfo(promptSprache).name}</div>
                </div>
                <div className="toggle-btn">
                  <button {...tt("Ohne Beispielsätze")} className={`toggle-opt${!promptBeispiele?" aktiv":""}`} onClick={() => setPromptBeispiele(false)}>Nein</button>
                  <button {...tt("Mit Beispielsätzen in einer Info-Spalte")} className={`toggle-opt${promptBeispiele?" aktiv":""}`} onClick={() => setPromptBeispiele(true)}>Ja</button>
                </div>
              </div>
              <div className="toggle-row" style={{borderTop:"1px solid var(--rahmen)"}}>
                <div>
                  <div className="toggle-label">Synonyme</div>
                  <div className="toggle-sub">Info-Spalte mit 2–4 Synonymen auf {sprachInfo(promptSprache).name}</div>
                </div>
                <div className="toggle-btn">
                  <button {...tt("Ohne Synonyme")} className={`toggle-opt${!promptSynonyme?" aktiv":""}`} onClick={() => setPromptSynonyme(false)}>Nein</button>
                  <button {...tt("Mit Synonymen in einer Info-Spalte")} className={`toggle-opt${promptSynonyme?" aktiv":""}`} onClick={() => setPromptSynonyme(true)}>Ja</button>
                </div>
              </div>
            </div>
            <div className="sektion-label" style={{marginBottom:8, marginTop:16}}>Generierter Prompt</div>
            <textarea className="inp" rows={12} readOnly
              value={generierePrompt(promptThema, promptAnzahl, promptFalsch, promptBeispiele, promptSynonyme, promptModus, promptSprache)}
              style={{fontFamily:"monospace", fontSize:"0.78rem", lineHeight:1.6}} />
          </div>
  );
}

// aus App.jsx: {tab === "statistik" && …}
export function StatistikKopf1(app) {
  const { auswahlOrdnerZelle, headerH, listenAendern, listenAuswahlPfad, listenFlagge, listenIndex, listenRasterPlaetze, setStatistikAktiverSlot, setStatistikListenIds, setStatistikSlotGeleert, sichtbareListen, slotH, statistikAktiverSlot, statistikAlleListenObjekte, statistikBasisVoks, statistikGewaehlteListenObjekte, statistikListenAufgeklappt, statistikListenContainerRef, statistikListenHeaderRef, statistikListenIds, statistikVollbild, toggleStatistikListe, toggleStatistikListenAuswahl, tt } = app;
  return (
(() => {
          if (statistikVollbild || (statistikAktiverSlot?.typ === "gespeichert" && !listenAendern)) return null;
          const n = statistikGewaehlteListenObjekte.length;
          const chipAktiv = statistikListenIds !== null;
          const chipText = statistikListenIds === null
            ? "Alle"
            : statistikListenIds.size === 0
            ? "auswählen"
            : statistikListenIds.size === 1
            ? (listenIndex.find(l => statistikListenIds.has(l.id))?.name || "Liste")
            : `${statistikListenIds.size} Listen`;
          return (<>
            <div ref={statistikListenHeaderRef} className="statistik-listen-header" style={{top:headerH + slotH, zIndex:8, position:"sticky"}}>
              {/* LINKS */}
              <span style={{flex:1, display:"flex", alignItems:"center", gap:6}}>
                {statistikListenAufgeklappt ? (
                  <>
                    {statistikListenIds !== null && (
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => { setStatistikListenIds(null); if (statistikAktiverSlot) { setStatistikAktiverSlot(null); setStatistikSlotGeleert(true); } }}
                        {...tt("Alle Listen anzeigen")}>
                        Alle
                      </button>
                    )}
                    {(statistikListenIds === null || statistikListenIds.size > 0) && (
                      <button className="btn btn-ghost btn-sm" style={{padding:"6px 8px"}}
                        onClick={() => { setStatistikListenIds(new Set()); if (statistikAktiverSlot) { setStatistikAktiverSlot(null); setStatistikSlotGeleert(true); } }}
                        {...tt("Listenauswahl leeren")}>
                        <IcoX s={12}/>
                      </button>
                    )}
                  </>
                ) : (
                  <span style={{fontWeight:600, fontSize:"0.85rem", color:"var(--text)"}}>Listen-Auswahl</span>
                )}
              </span>
              {/* MITTE */}
              {statistikBasisVoks.length > 0 && (
                <span style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"var(--text3)", pointerEvents:"none", whiteSpace:"nowrap"}}>
                  ({statistikBasisVoks.length} V.)
                </span>
              )}
              {/* RECHTS */}
              <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                <button
                  className="toggle-opt aktiv zeile-rechts"
                  onClick={toggleStatistikListenAuswahl}
                  {...tt("Listen für die Statistik auswählen")}>
                  {chipText}
                </button>
              </span>
            </div>
            {statistikListenAufgeklappt && (
              <div ref={statistikListenContainerRef} style={{background:"var(--hintergrund)", borderBottom:"1px solid var(--rahmen)", padding:"8px 16px"}}>
                {listenAuswahlPfad()}
                <div className={`listen-raster auswahl${listenRasterPlaetze().spalten > 1 ? " eng" : ""}`} style={{marginBottom:0, gridTemplateColumns:`repeat(${listenRasterPlaetze().spalten}, minmax(0, 1fr))`}}>
                  {sichtbareListen.length === 0
                    ? <div className="karte-zeile" style={{color:"var(--text2)", fontSize:"0.85rem"}}>Keine Listen vorhanden.</div>
                    : listenRasterPlaetze().plaetze.map(({ key: pk, l }) => {
                        if (!l) return <div key={pk} className="raster-leer" style={{border:"none"}}/>;
                        if (l.istOrdner) return auswahlOrdnerZelle(l, pk, id => statistikListenIds === null || statistikListenIds.has(id), listenRasterPlaetze().spalten > 1);
                        const ll = statistikAlleListenObjekte.find(x => x.id === l.id);
                        const anzahl = ll ? ll.vokabeln.length : 0;
                        const gewaehlt = statistikListenIds === null || statistikListenIds.has(l.id);
                        return (
                          <div {...tt("Liste in der Statistik ein- oder ausblenden")} key={l.id} className="quiz-setup-check" style={{padding:"10px 16px"}}
                            onClick={() => toggleStatistikListe(l.id)}>
                            <div className={`checkbox${gewaehlt?" checked":""}`}>{gewaehlt?"✓":""}</div>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:600, fontSize:"0.9rem"}}>{listenFlagge(l)}{l.name}</div>
                              <div style={{fontSize:"0.78rem", color:"var(--text2)", marginTop:2}}>{anzahl} Vokabel{anzahl!==1?"n":""}</div>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            )}
          </>);
        })()
  );
}

// aus App.jsx: {tab === "statistik" && …}
export function StatistikKopf2(app) {
  const { headerH, listenAendern, renderSuchleiste, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikEinzelauswahlAufgeklappt, setStatistikVonBisErster, setStatistikVonBisModus, setSucheStatistik, slotH, sprungKnopf, statistikAktiverSlot, statistikBasisVoks, statistikBereichTyp, statistikCheckboxAuswahl, statistikEinzelauswahlAufgeklappt, statistikEinzelauswahlRef, statistikGefilterteVoks, statistikGewaehlteListenObjekte, statistikListenHeaderH, statistikVokauswahlH, statistikVokauswahlRef, statistikVollbild, statistikVonBisErster, statistikVonBisModus, suchInfo, suchMarke, sucheStatistik, toggleStatistikEinzelauswahl, tt, vonBisLangDruck, zeileImBlick } = app;
  return (
(() => {
          if (statistikVollbild || (statistikAktiverSlot?.typ === "gespeichert" && !listenAendern)) return null;
          const hatVoks = statistikBasisVoks.length > 0;
          const istBereich = statistikBereichTyp === "bereich";
          const auswahlAnzahl = statistikGefilterteVoks.length;
          const statSuche = suchInfo(statistikBasisVoks, sucheStatistik);
          return (<>
            <div ref={statistikVokauswahlRef} style={{position:"sticky", top:headerH+slotH+statistikListenHeaderH, zIndex:7, background:"var(--kopfzeile)", borderBottom:"1px solid var(--rahmen)", padding:"10px 16px", display:"flex", alignItems:"center", gap:8}}>
              {/* LINKS */}
              <span style={{flex:1, display:"flex", alignItems:"center", gap:6}}>
                {istBereich && statistikEinzelauswahlAufgeklappt ? (
                  <>
                    <button data-auswahl-durchlass className={`btn btn-sm${statistikVonBisModus ? " btn-primary" : " btn-ghost"}`}
                      onClick={() => { if (statistikVonBisModus) { setStatistikVonBisModus(false); setStatistikVonBisErster(null); } else { setStatistikVonBisModus(true); } }}
                      {...tt("Bereichsauswahl: erste Vokabel antippen, dann letzte")}>
                      {!statistikVonBisModus ? "Von–Bis" : statistikVonBisErster === null ? "Von…" : "…Bis"}
                    </button>
                    {statistikCheckboxAuswahl.size > 0 && (
                      <button className="btn btn-ghost btn-sm" style={{padding:"6px 8px"}}
                        onClick={() => { setStatistikCheckboxAuswahl(new Set()); setStatistikVonBisModus(false); setStatistikVonBisErster(null); }}
                        {...tt("Checkbox-Auswahl aufheben")}>
                        <IcoX s={12}/>
                      </button>
                    )}
                    {statistikCheckboxAuswahl.size > 0 && sprungKnopf("statistik", statistikBasisVoks || [], statistikCheckboxAuswahl)}
                  </>
                ) : (
                  <span style={{fontWeight:600, fontSize:"0.85rem", color:"var(--text)"}}>Vokabel-Auswahl</span>
                )}
              </span>
              {/* MITTE */}
              {istBereich && (
                <span style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"var(--text3)", pointerEvents:"none", whiteSpace:"nowrap"}}>({auswahlAnzahl} V.)</span>
              )}
              {/* RECHTS */}
              <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                <div className="toggle-btn zeile-rechts">
                  <button className={`toggle-opt${!istBereich?" aktiv":""}`}
                    onClick={() => { setStatistikBereichTyp("alle"); setStatistikEinzelauswahlAufgeklappt(false); setStatistikVonBisModus(false); setStatistikVonBisErster(null); }}
                    {...tt("Alle Vokabeln der gewählten Listen anzeigen")}>
                    Alle
                  </button>
                  <button className={`toggle-opt${istBereich?" aktiv":""}`}
                    onClick={() => {
                      if (!istBereich) {
                        setStatistikBereichTyp("bereich");
                        if (statistikCheckboxAuswahl.size === 0 && hatVoks) toggleStatistikEinzelauswahl();
                      } else {
                        toggleStatistikEinzelauswahl();
                      }
                    }}
                    {...tt("Einzelne Vokabeln per Checkbox oder Von–Bis-Bereich auswählen")}>
                    Bereich
                  </button>
                </div>
              </span>
            </div>
            {statistikEinzelauswahlAufgeklappt && istBereich && (
              <div ref={statistikEinzelauswahlRef} style={{background:"var(--hintergrund)", borderBottom:"1px solid var(--rahmen)", paddingBottom:8}}>
                <div className="karte" style={{margin:"8px 16px 0 16px", overflow:"visible"}}>
                  {statistikBasisVoks.length > 0 && renderSuchleiste("statistik", statistikBasisVoks, sucheStatistik, setSucheStatistik, headerH + slotH + statistikListenHeaderH + statistikVokauswahlH)}
                  {statistikBasisVoks.map((vok, idx) => {
                    if (statSuche.filter && !statSuche.ids.has(vok.id)) return null;   // „nur Treffer“
                    const gewaehlt = statistikCheckboxAuswahl.has(vok.id);
                    const isVon = statistikVonBisModus && vok.id === statistikVonBisErster;
                    const sp1 = TYPEN.find(t => vok._spalten[t]?.aktiv);
                    const sp2 = TYPEN.filter(t => vok._spalten[t]?.aktiv)[1];
                    return (
                      <div {...vonBisLangDruck("statistik", vok, idx + 1, sp1 && vok[sp1]?.wert, sp2 && vok[sp2]?.wert)} key={vok.id} className="vok-zeile"
                        data-such-ziel="statistik" data-such-id={vok.id} data-auswahl-durchlass
                        style={{background: isVon ? "var(--gelb-flaeche)" : gewaehlt ? "var(--haupt-flaeche)" : "transparent", ...suchMarke(statSuche, vok.id)}}
                        onClick={() => {
                          zeileImBlick("statistik", vok.id);
                          if (!statistikVonBisModus) {
                            setStatistikCheckboxAuswahl(prev => { const n = new Set(prev); if (n.has(vok.id)) n.delete(vok.id); else n.add(vok.id); return n; });
                            return;
                          }
                          if (statistikVonBisErster === null) {
                            setStatistikVonBisErster(vok.id);
                          } else {
                            const vonIdx = statistikBasisVoks.findIndex(v => v.id === statistikVonBisErster);
                            const [lo, hi] = vonIdx <= idx ? [vonIdx, idx] : [idx, vonIdx];
                            setStatistikCheckboxAuswahl(prev => { const neu = new Set(prev); statistikBasisVoks.slice(lo, hi + 1).forEach(v => neu.add(v.id)); return neu; });
                            setStatistikVonBisModus(false);
                            setStatistikVonBisErster(null);
                          }
                        }}>
                        <div className={`checkbox${isVon ? " checked" : gewaehlt ? " checked" : ""}`} style={{flexShrink:0, ...(isVon ? {background:"var(--bestaetigen)", borderColor:"var(--bestaetigen)"} : {})}}>{isVon ? "→" : gewaehlt ? "✓" : ""}</div>
                        <span className="vok-nr">{idx+1}</span>
                        <div style={{flex:1, minWidth:0}}>
                          {sp1 && vok[sp1] && <div style={{fontWeight:600, fontSize:"0.88rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{vok[sp1].wert}</div>}
                          {sp2 && vok[sp2] && <div style={{fontSize:"0.75rem", color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{vok[sp2].wert}</div>}
                        </div>
                        {statistikGewaehlteListenObjekte.length > 1 && <div style={{fontSize:"0.68rem", color:"var(--text3)", flexShrink:0}}>{vok._listeName}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>);
        })()
  );
}

// aus App.jsx: {inGruppe && …}
export function DialogInGruppe(app) {
  const { inGruppe, legeListenOrdnerAn, legeOrdnerAn, listenIndex, listenOrdner, listenOrdnerOffen, setInGruppe, slotOrdner, slots, tt, ttFeld, verschiebeInOrdner, verschiebeListenInOrdner } = app;
  return (
(() => {
        // 193/194: In Ordner (Quiz bzw. Listen, auch Ordner) – vorhandener Ordner (mit Pfad) oder neuer in der
        // geöffneten Ebene; ohne ids: leeren Ordner anlegen (an platz, sonst ans Ende)
        const liste = inGruppe.art === "liste";
        const daten = liste ? { ordner: listenOrdner, gespeichert: listenIndex } : { ordner: slots.ordner || [], gespeichert: slots.gespeichert };
        const eltern = inGruppe.eltern !== undefined ? inGruppe.eltern : liste ? listenOrdnerOffen : slotOrdner;
        const ordnerIds = new Set(daten.ordner.map(o => o.id));
        const ziele = inGruppe.ids.length ? daten.ordner.filter(o => !inGruppe.ids.includes(o.id)
          && inGruppe.ids.filter(id => ordnerIds.has(id)).every(id => ordnerPasst(daten.ordner, id, o.id))) : [];
        const neuGeht = ordnerPfad(daten.ordner, eltern).length < ORDNER_TIEFE_MAX;
        const leer = !inGruppe.ids.length;
        const einheit = liste ? (n => `${n} Liste${n !== 1 ? "n" : ""}`) : (n => `${n} Quiz`);
        const anlegen = () => { if (!inGruppe.name.trim() || !neuGeht) return;
          (liste ? legeListenOrdnerAn : legeOrdnerAn)(inGruppe.name, inGruppe.ids, inGruppe.platz || null, eltern); setInGruppe(null); };
        return (
        <div className="overlay" onClick={() => setInGruppe(null)}>
          <div className="modal" data-in-gruppe-dialog={leer ? "neu" : ""} onClick={e => e.stopPropagation()}>
            <div className="modal-titel">{leer ? "Neuer Ordner" : `In Ordner (${inGruppe.ids.length} ausgewählt)`}</div>
            {ziele.length > 0 && (<>
              <div style={{fontSize:"0.8rem", color:"var(--text2)", marginBottom:8}}>In einen vorhandenen Ordner:</div>
              <div style={{display:"flex", flexDirection:"column", gap:6, marginBottom:14, maxHeight:"40vh", overflowY:"auto"}}>
                {ziele.map(o => (
                  <button key={o.id} className="neue-session-wahl" data-in-gruppe={o.id} onClick={() => (liste ? verschiebeListenInOrdner : verschiebeInOrdner)(inGruppe.ids, o.id)}
                    {...tt(`In den Ordner „${o.name}“ verschieben`)}>
                    <b>📁 {ordnerPfad(daten.ordner, o.id).map(p => p.name).join(" › ")}</b><span>{einheit(eintraegeImOrdner(daten, o.id).length)}</span>
                  </button>
                ))}
              </div>
            </>)}
            {neuGeht ? (<>
              <label className="inp-label">Neuer Ordner{eltern ? ` in „${ordnerPfad(daten.ordner, eltern).map(p => p.name).join(" › ")}“` : ""}</label>
              <input className="inp" data-ordner-name-feld value={inGruppe.name} placeholder="Name des Ordners" autoFocus
                onChange={e => setInGruppe(g => ({ ...g, name: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") anlegen(); }}
                {...ttFeld("Name des neuen Ordners")} />
            </>) : <div data-ordner-zu-tief style={{fontSize:"0.8rem", color:"var(--text2)"}}>Hier passt kein weiterer Ordner hinein (höchstens {ORDNER_TIEFE_MAX} Ebenen).</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setInGruppe(null)} {...tt("Schließen, ohne etwas zu ändern")}>Abbrechen</button>
              {neuGeht && <button className="btn btn-primary" data-ordner-neu disabled={!inGruppe.name.trim()} onClick={anlegen}
                {...tt(leer ? "Leeren Ordner anlegen" : "Neuen Ordner mit der Auswahl anlegen")}>Neuer Ordner</button>}
            </div>
          </div>
        </div>
        );
      })()
  );
}

// aus App.jsx: {erstellenFenster && …}
export function DialogErstellenFenster(app) {
  const { erstelleQuiz, erstellenFenster, legeOrdnerAn, quizErstellen, setErstellenFenster, setQuizErstellen, slots, starteAufteilen, tt, ttFeld } = app;
  return (
(() => {
        // 217: „Quiz erstellen“ – Name (vorbelegt) und Ordner (Baum der Quiz-Ordner, zuletzt geöffneter vorbelegt)
        const ordner = slots.ordner || [];
        const baum = [];
        const ebene = (eltern, tiefe) => ordner.filter(o => (o.ordner || null) === eltern).sort(nameVergleich).forEach(o => { baum.push({ o, tiefe }); ebene(o.id, tiefe + 1); });
        ebene(null, 0);
        const f = erstellenFenster;
        return (
          <div className="overlay" onClick={() => setErstellenFenster(null)}>
            <div className="modal" data-erstellen-dialog onClick={e => e.stopPropagation()}>
              <div className="modal-titel">Quiz erstellen</div>
              <label className="inp-label">Name</label>
              <input className="inp" data-erstellen-name value={f.name} autoFocus onChange={e => setErstellenFenster(x => ({ ...x, name: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") erstelleQuiz(); }} {...ttFeld("Name des neuen Quiz")}/>
              <label className="inp-label">Ordner</label>
              <div data-erstellen-ordner style={{display:"flex", flexDirection:"column", gap:4, maxHeight:"36vh", overflowY:"auto", marginBottom:8}}>
                {[{ o: null, tiefe: 0 }, ...baum.map(b => ({ ...b, tiefe: b.tiefe + 1 }))].map(({ o, tiefe }) => (
                  <button key={o?.id || "_oben"} className={`typ-btn${(f.ordner || null) === (o?.id || null) ? " aktiv" : ""}`} data-erstellen-ordner-wahl={o?.id || ""}
                    style={{textAlign:"left", paddingLeft: 10 + tiefe * 16, fontSize:"0.85rem"}}
                    onClick={() => setErstellenFenster(x => ({ ...x, ordner: o?.id || null }))}>{o ? `📁 ${o.name}` : "Alle Quiz (oben)"}</button>
                ))}
                {ordnerPfad(ordner, f.ordner).length < ORDNER_TIEFE_MAX && (
                  <button className="typ-btn" data-erstellen-neuer-ordner style={{textAlign:"left", fontSize:"0.85rem"}}
                    onClick={() => { const n = window.prompt("Name des neuen Ordners"); if (n && n.trim()) { const id = legeOrdnerAn(n.trim(), [], null, f.ordner || null); if (id) setErstellenFenster(x => ({ ...x, ordner: id })); } }}
                    {...tt("Neuen Ordner im gewählten Ordner anlegen")}>＋ Neuer Ordner</button>
                )}
              </div>
              <div className="modal-actions" style={{flexWrap:"wrap"}}>
                <button className="btn btn-ghost" onClick={() => setErstellenFenster(null)} {...tt("Zurück zu den Einstellungen")}>Abbrechen</button>
                <button className="btn btn-ghost" data-erstellen-aufteilen onClick={() => { const id = quizErstellen?.listeId; setErstellenFenster(null); setQuizErstellen(null); if (id) starteAufteilen(id); }}
                  {...tt("Stattdessen die Liste in mehrere Quiz aufteilen")}>In mehrere aufteilen</button>
                <button className="btn btn-primary" data-erstellen-ok disabled={!f.name.trim()} onClick={erstelleQuiz} {...tt("Quiz anlegen und laden")}>Erstellen</button>
              </div>
            </div>
          </div>
        );
      })()
  );
}

// aus App.jsx: {modal === "neue-session" && …}
export function DialogNeueSession(app) {
  const { neueQuizKonfiguration, neueSessionSchritt, setModal, setNeueSessionSchritt, sichtbareListen, starteAufteilen, tt } = app;
  return (
<div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" data-neue-session-dialog={neueSessionSchritt} onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Neues Quiz aus Listen</div>
            {neueSessionSchritt === "art" ? (<>
              <button className="neue-session-wahl" data-neue-session-art="eine" onClick={() => { setModal(null); neueQuizKonfiguration(); window.scrollTo(0, 0); }}
                {...tt("Listen und Vokabeln wählen, dann wie gewohnt einstellen; lang auf den Namen drücken speichert die Quiz")}>
                <b>Ein Quiz</b>
              </button>
              <button className="neue-session-wahl" data-neue-session-art="mehrere" onClick={() => setNeueSessionSchritt("liste")}
                {...tt("Eine Liste in Pakete aufteilen (Bereich von–bis, Größe) – je Paket ein gespeichertes Quiz")}>
                <b>Mehrere Quiz</b>
              </button>
            </>) : (<>
              <div style={{fontSize:"0.82rem", color:"var(--text2)", marginBottom:10}}>Welche Liste soll aufgeteilt werden?</div>
              <div style={{display:"flex", flexDirection:"column", gap:6, maxHeight:"50vh", overflowY:"auto"}}>
                {sichtbareListen.map(l => (
                  <button key={l.id} className="neue-session-wahl" data-aufteilen-liste={l.id} onClick={() => { setModal(null); starteAufteilen(l.id); }}
                    {...tt(`„${l.name}“ in mehrere Quiz aufteilen`)}>
                    <b>{l.name}</b><span>{lsGet(SK.liste(l.id))?.vokabeln.length || 0} Vokabeln</span>
                  </button>
                ))}
              </div>
            </>)}
            <div className="modal-actions">
              {neueSessionSchritt === "liste" && <button className="btn btn-ghost" onClick={() => setNeueSessionSchritt("art")} {...tt("Zurück zur Auswahl Eine / Mehrere")}>Zurück</button>}
              <button className="btn btn-ghost" onClick={() => setModal(null)} {...tt("Schließen, ohne etwas anzulegen")}>Abbrechen</button>
            </div>
          </div>
        </div>
  );
}

// aus App.jsx: {modal === "liste-zuruecksetzen" && listeMenueId && …}
export function DialogListeZuruecksetzen(app) {
  const { listeMenueId, setModal, setZuruecksetzenArten, setzeListeZurueck, tt, zuruecksetzenArten } = app;
  return (
(() => {
        const liste = lsGet(SK.liste(listeMenueId));
        const mitScore = art => (liste?.vokabeln || []).filter(v => v[SCORE_FELD[art]]).length;
        return (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} data-zuruecksetzen>
            <div className="modal-titel">Lernstand zurücksetzen?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5, marginTop:0}}>
              Die Scores von „{liste?.name}“ werden gelöscht – alle Vokabeln gelten danach als nie abgefragt. Die Vokabeln selbst bleiben.
            </p>
            <div className="karte" style={{marginBottom:12}}>
              {STATISTIK_ARTEN.map(([art, name]) => {
                const an = zuruecksetzenArten.has(art);
                return (
                  <div key={art} data-zuruecksetzen-art={art} className="karte-zeile" style={{cursor:"pointer", padding:"10px 14px"}}
                    onClick={() => setZuruecksetzenArten(prev => { const n = new Set(prev); if (n.has(art)) n.delete(art); else n.add(art); return n; })}
                    {...tt(`${name}-Scores ${an ? "nicht " : ""}zurücksetzen`)}>
                    <div className={`checkbox${an ? " checked" : ""}`}>{an ? "✓" : ""}</div>
                    <div className="karte-zeile-info">
                      <div className="karte-zeile-name">{name}</div>
                      <div className="karte-zeile-sub">{mitScore(art)} Vokabel{mitScore(art) !== 1 ? "n" : ""} mit Score</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Gewählte Scores dieser Liste löschen")} className="btn btn-danger" disabled={zuruecksetzenArten.size === 0}
                onClick={setzeListeZurueck}>Zurücksetzen</button>
            </div>
          </div>
        </div>
        );
      })()
  );
}

// aus App.jsx: {modal === "liste-zusammenfuehren" && aktiveListe && …}
export function DialogListeZusammenfuehren(app) {
  const { aktiveListe, aktiveListeId, fuehreListenZusammen, mergeQuelleId, setMergeQuelleId, setModal, sichtbareListen, tt, ttFeld } = app;
  return (
(() => {
        const andereListn = sichtbareListen.filter(l => l.id !== aktiveListeId);
        const mergeQuelle = mergeQuelleId ? lsGet(SK.liste(mergeQuelleId)) : null;
        const neueSpalten = mergeQuelle ? TYPEN.filter(t => !aktiveListe.spalten[t].aktiv && mergeQuelle.spalten[t].aktiv) : [];
        return (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-titel">Liste zusammenführen</div>
              <label className="inp-label">Quelle (wird in „{aktiveListe.name}" eingefügt)</label>
              <select {...ttFeld("Liste, deren Vokabeln übernommen werden")} className="inp" value={mergeQuelleId} onChange={e => setMergeQuelleId(e.target.value)}>
                <option value="">– Liste wählen –</option>
                {andereListn.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {mergeQuelle && (
                <div className="meldung-info" style={{marginTop:12}}>
                  <strong>{mergeQuelle.vokabeln.length} Vokabeln</strong> werden hinzugefügt.
                  {neueSpalten.length > 0 && (
                    <> Neue Spalten: {neueSpalten.map(t => `${t} (${mergeQuelle.spalten[t].name || t})`).join(', ')}.</>
                  )}
                </div>
              )}
              <div className="modal-actions">
                <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
                <button {...tt("Vokabeln der gewählten Liste in diese Liste übernehmen")} className="btn btn-primary" onClick={fuehreListenZusammen} disabled={!mergeQuelleId}>Zusammenführen</button>
              </div>
            </div>
          </div>
        );
      })()
  );
}

// aus App.jsx: {modal === "slot-speichern" && …}
export function DialogSlotSpeichern(app) {
  const { aktiverSlot, getSlotEintrag, modalInput, setModal, setModalInput, slots, speichereAlsGespeichert, tt, ttFeld } = app;
  return (
(() => {
        const istGespeichert = aktiverSlot?.typ === 'gespeichert';
        const aktuellerSlot = istGespeichert ? getSlotEintrag('gespeichert', aktiverSlot.id) : null;
        const schliesseModal = () => { setModal(null); setModalInput(""); };
        const doAktualisieren = () => {
          speichereAlsGespeichert(aktiverSlot.id, aktuellerSlot?.name || formatSlotDatum());
          schliesseModal();
        };
        const doSpeichernNeu = () => {
          const name = modalInput.trim() || formatSlotDatum();
          speichereAlsGespeichert(null, name);
          schliesseModal();
        };
        const doUeberschreiben = (s) => {
          speichereAlsGespeichert(s.id, s.name);
          schliesseModal();
        };
        const andereSlots = slots.gespeichert.filter(s => !istGespeichert || s.id !== aktiverSlot.id);
        return (
          <div className="overlay" onClick={schliesseModal}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-titel">{istGespeichert ? "Speichern" : "Neu speichern"}</div>

              {istGespeichert && (<>
                <button {...tt("Gespeicherten Eintrag mit der aktuellen Einstellung überschreiben")} className="btn btn-primary" style={{width:"100%", marginBottom:4, textAlign:"left"}}
                  onClick={doAktualisieren}>
                  Aktualisieren · „{aktuellerSlot?.name}"
                </button>
              </>)}

              <label className="inp-label" style={istGespeichert ? {marginTop:14} : undefined}>{istGespeichert ? "Als neues Quiz" : "Name"}</label>
              <input {...ttFeld("Name für die neues Quiz – Eingabetaste speichert")} className="inp" value={modalInput} autoFocus data-slot-name-feld
                onChange={e => setModalInput(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); doSpeichernNeu(); } }}
                enterKeyHint="done"
                placeholder="z.B. Irregular Verbs" />
              <div className="modal-actions" style={{marginTop:12}}>
                <button {...tt("Schließen, ohne etwas zu speichern")} className="btn btn-ghost" onClick={schliesseModal}>Abbrechen</button>
                <button {...tt("Als neues Quiz speichern")} className="btn btn-primary" data-slot-speichern-neu onClick={doSpeichernNeu}>
                  {istGespeichert ? "Neu speichern" : "Speichern"}
                </button>
              </div>

              {andereSlots.length > 0 && (
                <div style={{marginTop:16}}>
                  <div className="inp-label">{istGespeichert ? "Andere Quiz ersetzen" : "Vorhandenes Quiz ersetzen"}</div>
                  <div data-ersetzen-liste style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:8, maxHeight:"30vh", overflowY:"auto", overscrollBehavior:"contain", padding:"2px 0"}}>
                    {andereSlots.map(s => (
                      <button {...tt(`Eintrag „${s.name}“ mit der aktuellen Einstellung überschreiben`)} key={s.id} className="slot-chip belegt"
                        onClick={() => doUeberschreiben(s)}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()
  );
}

// aus App.jsx: {slotUmbenennen && …}
export function DialogSlotUmbenennen(app) {
  const { benenneSlotUm, dupliziereSlot, setSlotUmbenennen, slotUmbenennen, slots, tt, ttFeld } = app;
  return (
(() => {
        const schliessen = () => setSlotUmbenennen(null);
        const name = slotUmbenennen.name.trim();
        const kopie = !!slotUmbenennen.kopie;
        const doppelt = name && slots.gespeichert.some(x => (kopie || x.id !== slotUmbenennen.id) && x.name === name);
        const speichern = () => {
          if (!name || doppelt) return;
          if (kopie) dupliziereSlot(slotUmbenennen.id, name); else benenneSlotUm(slotUmbenennen.id, name);
          schliessen();
        };
        return (
          <div className="overlay" onClick={schliessen}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-titel">{kopie ? "Duplizieren" : "Umbenennen"}</div>
              <label className="inp-label">{kopie ? "Name der Kopie" : "Name"}</label>
              <input {...ttFeld(kopie ? "Name für die Kopie" : "Neuer Name für den gespeicherten Eintrag")} data-umbenennen-feld className="inp" value={slotUmbenennen.name} autoFocus
                onChange={e => setSlotUmbenennen(u => ({ ...u, name: e.target.value }))}
                onFocus={e => e.target.select()}
                onKeyDown={e => e.key === "Enter" && speichern()} />
              {doppelt && <div style={{fontSize:"0.78rem", color:"var(--falsch)", marginTop:6}}>Diesen Namen gibt es schon.</div>}
              <div style={{fontSize:"0.75rem", color:"var(--text3)", marginTop:8}}>{kopie
                ? "Die Kopie übernimmt alle Einstellungen, beginnt aber mit einem eigenen Paket-Fortschritt. Sie kommt in die erste Spalte unter den untersten Eintrag im Raster."
                : "Platz im Raster, Einstellungen und Fortschritt bleiben erhalten."}</div>
              <div className="modal-actions">
                <button {...tt(kopie ? "Schließen, ohne zu duplizieren" : "Schließen, ohne umzubenennen")} className="btn btn-ghost" onClick={schliessen}>Abbrechen</button>
                <button {...tt(kopie ? "Kopie unter diesem Namen anlegen" : "Neuen Namen speichern")} data-umbenennen-speichern className="btn btn-primary" disabled={!name || doppelt} onClick={speichern}>Speichern</button>
              </div>
            </div>
          </div>
        );
      })()
  );
}

// aus App.jsx: {gruppenAenderungsDialog && aktiverSlot?.typ === 'gespeichert' && …}
export function DialogGruppenAenderungsDialog(app) {
  const { aktiverSlot, erstelleVerlaufEintrag, getSlotEintrag, ladeSlot, setGruppenAenderungsDialog, setModal, setModalInput, slotNamenVorschlag, starteQuiz, tt, ueberspeichereSession } = app;
  return (
(() => {
        const slotName = getSlotEintrag('gespeichert', aktiverSlot.id)?.name || '';
        return (
          <div className="overlay" onClick={() => setGruppenAenderungsDialog(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-titel">Vokabelgruppe geändert</div>
              <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
                Die Vokabelgruppe wurde seit dem Laden von „{slotName}" geändert.
              </p>
              <div className="modal-actions" style={{flexDirection:"column", gap:8}}>
                <button {...tt("Gespeicherten Eintrag mit der geänderten Auswahl überschreiben")} className="btn btn-primary" onClick={() => {
                  ueberspeichereSession();
                  setGruppenAenderungsDialog(false);
                  starteQuiz(true);
                }}>Überspeichern</button>
                <button {...tt("Geänderte Auswahl als neuen Eintrag speichern")} className="btn btn-ghost" onClick={() => {
                  setGruppenAenderungsDialog(false);
                  setModalInput(slotNamenVorschlag());
                  setModal("slot-speichern");
                }}>Neu speichern</button>
                <button {...tt("Quiz mit der geänderten Auswahl starten, ohne zu speichern")} className="btn btn-ghost" style={{fontSize:"0.82rem", color:"var(--text2)"}} onClick={() => {
                  const newId = erstelleVerlaufEintrag();
                  setGruppenAenderungsDialog(false);
                  starteQuiz(true, {typ:'verlauf', id:newId});
                }}>Fortfahren ohne Speichern</button>
                <button {...tt("Auswahl auf den gespeicherten Stand zurücksetzen")} className="btn btn-ghost" style={{fontSize:"0.82rem", color:"var(--text2)"}} onClick={() => {
                  ladeSlot(aktiverSlot.typ, aktiverSlot.id);
                  setGruppenAenderungsDialog(false);
                }}>Zurücksetzen</button>
                <button {...tt("Schließen, ohne zu starten")} className="btn btn-ghost" style={{fontSize:"0.82rem", color:"var(--text3)"}} onClick={() => setGruppenAenderungsDialog(false)}>Abbrechen</button>
              </div>
            </div>
          </div>
        );
      })()
  );
}

// aus App.jsx: {modal === "lernen-einst" && …}
export function DialogLernenEinst(app) {
  const { lernEinstellungen, setModal, setzeLernEinst, tt } = app;
  return (
(() => {
        const le = lernEinstellungen();
        const wahl = (feld, werte, text) => (
          <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:6}}>
            {werte.map(([w, label]) => (
              <button key={String(w)} className={`typ-btn${le[feld] === w ? " aktiv" : ""}`} {...{ [`data-lernen-${feld}`]: String(w) }}
                onClick={() => setzeLernEinst({ [feld]: w })} {...tt(`${text}: ${label}`)}>{label}</button>
            ))}
          </div>
        );
        return (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} data-lernen-einst style={{maxHeight:"88vh", overflowY:"auto"}}>
              <div className="modal-titel" {...tt("Erst das Wort, dann die Übersetzung, auf Wunsch die Zusatzinfo, dann die nächste Vokabel. Pause und Zusatzinfo stellst du direkt auf dem Lernbildschirm ein. Antippen der Karte geht sofort weiter. Ohne Score.")}>🎬 Lernen einstellen</div>
              <div className="inp-label">Zuerst zeigen</div>
              {wahl("zuerst", [["fremd", "Fremdsprache"], ["deutsch", "Deutsch"]], "Zuerst zeigen")}
              <div className="inp-label" style={{marginTop:14}}>Wort vorlesen</div>
              {wahl("vorlesen1", [[true, "Ja"], [false, "Nein"]], "Wort vorlesen")}
              <div className="inp-label" style={{marginTop:14}}>Übersetzung vorlesen</div>
              {wahl("vorlesen2", [[true, "Ja"], [false, "Nein"]], "Übersetzung vorlesen")}
              <div className="inp-label" style={{marginTop:14}} {...tt("Ohne Hilfen: Akzente nicht hervorgehoben, kein Zähler, Akzente müssen stimmen. „Wie Leicht/Schwer“ übernimmt die Haken aus „Regeln Leicht / Schwer“. Falsche Antworten kosten in diesem Quiz nie einen Punkt.")}>Quiz nach dem Lernen</div>
              {wahl("quizStufe", [["ohne", "Ohne Hilfen"], ["einfach", "Wie Leicht"], ["schwer", "Wie Schwer"]], "Quiz nach dem Lernen")}
              <div className="inp-label" style={{marginTop:14}}>Zusatzinfo vorlesen</div>
              {wahl("vorlesen3", [[true, "Ja"], [false, "Nein"]], "Zusatzinfo vorlesen")}
              <div className="inp-label" style={{marginTop:14}}>Zusatzinfo vorlesen in</div>
              {wahl("infoSprache", [["fremd", "Fremdsprache"], ["deutsch", "Deutsch"]], "Sprache der Zusatzinfo")}
              <button className="btn btn-primary" style={{width:"100%", marginTop:18}} onClick={() => setModal(null)} {...tt("Fenster schließen")}>Fertig</button>
            </div>
          </div>
        );
      })()
  );
}

// aus App.jsx: {modal === "stufen-regeln" && …}
export function DialogStufenRegeln(app) {
  const { einstellungen, lernEinstellungen, setModal, speichereEinst, tt, ttFeld } = app;
  return (
<div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} data-stufen-regeln style={{maxHeight:"88vh", overflowY:"auto"}}>
            <div className="modal-titel">Regeln Leicht / Schwer</div>
                      <div className="karte" style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div>
                            <div className="toggle-label" {...tt("Was jeweils gilt, legst du unten per Haken fest")}>Modus</div>
                          </div>
                          <div className="toggle-btn">
                            <button className={`toggle-opt${einstellungen.modus==="einfach"?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen,modus:"einfach",lernen:{...lernEinstellungen(),aktiv:false}})} {...tt("Stufe „Leicht“ verwenden – es gelten die Haken in der Spalte „Leicht“")}>Leicht</button>
                            <button className={`toggle-opt${einstellungen.modus==="schwer"?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen,modus:"schwer",lernen:{...lernEinstellungen(),aktiv:false}})} {...tt("Stufe „Schwer“ verwenden – es gelten die Haken in der Spalte „Schwer“")}>Schwer</button>
                          </div>
                        </div>
                        {/* Was gilt als einfach / schwer: je Regel ein Haken pro Stufe */}
                        <div style={{borderTop:"1px solid var(--rahmen)", padding:"10px 16px 12px"}}>
                          <div style={{display:"grid", gridTemplateColumns:"1fr 58px 58px", alignItems:"center", rowGap:10, columnGap:6}}>
                            <div className="inp-label" style={{margin:0}}>Was gilt als leicht / schwer?</div>
                            {["einfach", "schwer"].map(st => (
                              <div key={st} style={{textAlign:"center", fontSize:"0.75rem", fontWeight:700, color: einstellungen.modus === st ? "var(--haupt)" : "var(--text3)"}}>{st === "einfach" ? "Leicht" : "Schwer"}</div>
                            ))}
                            {STUFEN_REGELN.map(r => (<Fragment key={r.key}>
                              <div {...tt(`${r.label} – ${r.sub}`)}>
                                <div style={{fontSize:"0.85rem", fontWeight:600, color:"var(--text)"}}>{r.label}</div>
                              </div>
                              {["einfach", "schwer"].map(st => {
                                const an = einstellungen.stufen?.[st]?.[r.key] ?? r[st];
                                return (
                                  <div key={st} style={{display:"flex", justifyContent:"center", cursor:"pointer"}}
                                    onClick={() => speichereEinst({...einstellungen, stufen: {...(einstellungen.stufen || {}), [st]: {...(einstellungen.stufen?.[st] || {}), [r.key]: !an}}})}
                                    {...tt(`${r.label} – in der Stufe „${st === "einfach" ? "Einfach" : "Schwer"}“ ${an ? "ausschalten" : "einschalten"}`)}>
                                    <div className={`checkbox${an ? " checked" : ""}`}>{an ? "✓" : ""}</div>
                                  </div>
                                );
                              })}
                              {r.key === "akzentOhneMischen" && (<>
                                <div style={{paddingLeft:12}}>
                                  <div style={{fontSize:"0.8rem", fontWeight:600, color:"var(--text)"}} {...tt("Wörter ohne Akzent im Verhältnis zu den Wörtern mit Akzent (1× = noch einmal so viele)")}>… davon höchstens</div>
                                </div>
                                {["einfach", "schwer"].map(st => {
                                  const regelAn = einstellungen.stufen?.[st]?.akzentOhneMischen ?? r[st];
                                  const wert = einstellungen.stufen?.[st]?.akzentOhneAnteil ?? 1;
                                  return (
                                    <div key={st} style={{display:"flex", justifyContent:"center"}}>
                                      <select data-akzent-ohne-anteil={st} value={String(wert)} disabled={!regelAn}
                                        style={{fontFamily:"inherit", fontSize:"0.8rem", padding:"3px 2px", borderRadius:6, border:"1.5px solid var(--rahmen)", background:"var(--karte)", opacity: regelAn ? 1 : 0.4, width:52}}
                                        onChange={e => { const v = e.target.value === "alle" ? "alle" : parseFloat(e.target.value);
                                          speichereEinst({...einstellungen, stufen: {...(einstellungen.stufen || {}), [st]: {...(einstellungen.stufen?.[st] || {}), akzentOhneAnteil: v}}}); }}
                                        {...ttFeld(`Stufe „${st === "einfach" ? "Einfach" : "Schwer"}“: höchstens so viele Wörter ohne Akzent (∞ = alle)`)}>
                                        {AKZENT_OHNE_ANTEILE.map(([w, t]) => <option key={t} value={String(w)}>{t}</option>)}
                                      </select>
                                    </div>
                                  );
                                })}
                              </>)}
                              {r.key === "zuordnungAmEnde" && [
                                ["zuordnungPaare", "… Vokabeln je Runde", "Wie viele Vokabeln eine Zuordnungs-Runde hat (passt nicht alles auf den Bildschirm, werden es automatisch weniger)",
                                  [3, 4, 5, 6, 7, 8, 9, 10, 12].map(x => [x, String(x)]), st => st === "einfach" ? 5 : 7],
                                ["zuordnungZeit", "… Zeit", "Prüfen sofort: Zeit je Paar (beginnt nach jedem gefundenen Paar neu) · am Ende: Zeit für die ganze Runde (Sekunden × Vokabeln)",
                                  ZUORDNUNG_ZEITEN, st => st === "einfach" ? "aus" : "an"],
                                ["zuordnungSek", "… Sekunden je Vokabel", "Zeit je Vokabel; bei 3 Spalten ×1,6, bei 4 Spalten ×2",
                                  ZUORDNUNG_SEKUNDEN.map(x => [x, `${x} s`]), () => 8],
                              ].map(([key, label, info, werte, std]) => (<Fragment key={key}>
                                <div style={{paddingLeft:12}}>
                                  <div style={{fontSize:"0.8rem", fontWeight:600, color:"var(--text)"}} {...tt(info)}>{label}</div>
                                </div>
                                {["einfach", "schwer"].map(st => {
                                  const wert = einstellungen.stufen?.[st]?.[key] ?? std(st);
                                  return (
                                    <div key={st} style={{display:"flex", justifyContent:"center"}}>
                                      <select data-zuordnung-einst={`${key}:${st}`} value={String(wert)}
                                        style={{fontFamily:"inherit", fontSize:"0.8rem", padding:"3px 2px", borderRadius:6, border:"1.5px solid var(--rahmen)", background:"var(--karte)", width:56}}
                                        onChange={e => { const v = typeof werte[0][0] === "number" ? Number(e.target.value) : e.target.value;
                                          speichereEinst({...einstellungen, stufen: {...(einstellungen.stufen || {}), [st]: {...(einstellungen.stufen?.[st] || {}), [key]: v}}}); }}
                                        {...ttFeld(`${label.replace("… ", "")} – Stufe „${st === "einfach" ? "Leicht" : "Schwer"}“`)}>
                                        {werte.map(([w, t]) => <option key={String(w)} value={String(w)}>{t}</option>)}
                                      </select>
                                    </div>
                                  );
                                })}
                              </Fragment>))}
                            </Fragment>))}
                          </div>
                        </div>
                      </div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={() => setModal(null)} {...tt("Fenster schließen – die Einstellungen sind gespeichert")}>Fertig</button></div>
          </div>
        </div>
  );
}

// aus App.jsx: {modal === "vorlesen" && …}
export function DialogVorlesen(app) {
  const { einstellungen, setModal, speichereEinst, tt } = app;
  return (
<div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} data-vorlesen-einstellungen>
            <div className="modal-titel">Vorlesen</div>
                      <div className="karte" style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div {...tt("Frage beim Erscheinen und Antwort beim Aufdecken automatisch vorlesen")}>
                            <div className="toggle-label">Auto-Play</div>
                          </div>
                          <div className="toggle-btn">
                            <button className={`toggle-opt${!einstellungen.autoplay?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen, autoplay:false})} {...tt("Kein automatisches Vorlesen")}>Aus</button>
                            <button className={`toggle-opt${einstellungen.autoplay?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen, autoplay:true})} {...tt("Vokabeln nach dem Aufdecken automatisch vorlesen")}>An</button>
                          </div>
                        </div>
                        {einstellungen.autoplay && (
                          <div style={{padding:"12px 16px 16px", borderTop:"1px solid var(--rahmen)"}}>
                            <div className="inp-label" style={{marginBottom:8}} {...tt("Vorgelesen werden nur Frage und Antworten aus diesen Spalten")}>Spalten automatisch vorlesen</div>
                            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                              {TYPEN.map(typ => {
                                const vorlesen = einstellungen.vorlesen || ["E1"];
                                const aktiv = vorlesen.includes(typ);
                                return (
                                  <button {...tt(`Spalte ${typ} beim Abfragen automatisch vorlesen`)} key={typ} className={`typ-btn${aktiv?" aktiv":""}`}
                                    onClick={() => speichereEinst({...einstellungen, vorlesen: aktiv ? vorlesen.filter(t=>t!==typ) : [...vorlesen,typ]})}>
                                    {typ}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

            <div className="modal-actions"><button className="btn btn-primary" onClick={() => setModal(null)} {...tt("Fenster schließen – die Einstellungen sind gespeichert")}>Fertig</button></div>
          </div>
        </div>
  );
}

// aus App.jsx: {modal === "klammern" && aktiveListe && …}
export function DialogKlammern(app) {
  const { aktiveListe, klammerAenderungen, klammerZiel, setKlammerZiel, setModal, tt, verschiebeKlammern } = app;
  return (
(() => {
        const aenderungen = klammerAenderungen(aktiveListe, klammerZiel);
        return (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} data-klammern-modal>
            <div className="modal-titel">Klammerhinweise verschieben</div>
            <p style={{fontSize:"0.85rem", color:"var(--text2)", lineHeight:1.5, marginBottom:10}}>
              Frei stehende Klammern wie „(= Punkt)“ werden aus den Wort-Spalten entfernt und in eine Info-Spalte geschrieben.
              Angehängte Klammern wie „(un)lucky“ bleiben.
            </p>
            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
              <span style={{fontSize:"0.85rem", color:"var(--text2)"}}>Ziel:</span>
              {["i1", "i2"].map(t => (
                <button key={t} data-klammer-ziel={t} className={`typ-btn${klammerZiel === t ? " aktiv" : ""}`} onClick={() => setKlammerZiel(t)}
                  {...tt(`Hinweise in die Info-Spalte ${t} schreiben${aktiveListe.spalten[t]?.aktiv ? "" : " (wird eingeschaltet)"}`)}>
                  {aktiveListe.spalten[t]?.aktiv ? (aktiveListe.spalten[t].name || t) : `${t} (neu)`}
                </button>
              ))}
            </div>
            <div style={{fontSize:"0.85rem", fontWeight:700, color:"var(--text)", marginBottom:6}} data-klammer-anzahl={aenderungen.length}>
              {aenderungen.length === 0 ? "Keine Klammerhinweise gefunden." : `${aenderungen.length} Vokabel${aenderungen.length !== 1 ? "n" : ""} betroffen – Vorschau:`}
            </div>
            <div style={{maxHeight:"34vh", overflowY:"auto", marginBottom:8}}>
              {aenderungen.slice(0, 8).map(a => {
                const quelle = TYPEN.find(t => !t.startsWith("i") && hinweiseAus(a.vorher[t]?.wert).length);
                return (
                  <div key={a.vorher.id} style={{fontSize:"0.8rem", padding:"5px 0", borderBottom:"1px solid var(--flaeche)"}}>
                    <span style={{color:"var(--text3)", textDecoration:"line-through"}}>{a.vorher[quelle]?.wert}</span>
                    {" → "}<b>{a.nachher[quelle]?.wert}</b>
                    <span style={{color:"var(--text2)"}}> · Info: {a.nachher[klammerZiel]?.wert}</span>
                  </div>
                );
              })}
              {aenderungen.length > 8 && <div style={{fontSize:"0.75rem", color:"var(--text3)", paddingTop:4}}>… und {aenderungen.length - 8} weitere</div>}
            </div>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Klammerhinweise jetzt verschieben")} className="btn btn-primary" data-klammer-verschieben disabled={aenderungen.length === 0} onClick={verschiebeKlammern}>Verschieben</button>
            </div>
          </div>
        </div>
        );
      })()
  );
}

// aus App.jsx: {modal === "json-export" && jsonExportIds && …}
export function DialogJsonExport(app) {
  const { exportiereAlsJsonBestaetigt, jsonExportIds, jsonExportOptionen, renderExportArtWahl, renderExportNamensFeld, setJsonExportIds, setJsonExportOptionen, setModal, tt, ttFeld } = app;
  return (
<div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">📤 Exportieren</div>
            {renderExportArtWahl(jsonExportIds, "json")}
            {renderExportNamensFeld(exportiereAlsJsonBestaetigt)}
            {[
              { key: "vokabeln", label: "Vokabeln", pflicht: true },
              { key: "falsch",   label: "Falsche Antworten (MC)" },
              { key: "fortschritt", label: "Quiz-Fortschritt (Score, Streak)" },
              { key: "diktatFortschritt", label: "Diktat-Fortschritt" },
              { key: "akzentFortschritt", label: "Akzent-Fortschritt" },
            ].map(({ key, label, pflicht }) => (
              <label key={key} style={{display:"flex", alignItems:"center", gap:10, marginBottom:10, fontSize:"0.9rem", cursor: pflicht ? "default" : "pointer"}}>
                <input {...ttFeld("Diesen Teil in den Export aufnehmen")} type="checkbox" checked={pflicht || !!jsonExportOptionen[key]}
                  disabled={pflicht}
                  onChange={e => !pflicht && setJsonExportOptionen(prev => ({...prev, [key]: e.target.checked}))}
                  style={{width:18, height:18}} />
                {label}{pflicht && <span style={{fontSize:"0.75rem", color:"var(--text3)"}}> (immer)</span>}
              </label>
            ))}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne zu exportieren")} className="btn btn-ghost" onClick={() => { setModal(null); setJsonExportIds(null); }}>Abbrechen</button>
              <button {...tt("Export mit diesen Optionen erstellen")} className="btn btn-primary" onClick={exportiereAlsJsonBestaetigt}>Exportieren</button>
            </div>
          </div>
        </div>
  );
}

// aus App.jsx: {modal === "saetze" && satzFenster && …}
export function DialogSaetze(app) {
  const { dateiName, einstellungen, listenSaetze, satzFenster, satzPortion, setModal, setSatzFenster, speichereEinst, teileAlsDatei, tt, uebernehmeSaetze } = app;
  return (
(() => {
        const n = einstellungen.satzAnzahl || 3;
        const portion = satzPortion(satzFenster.listeId, listenSaetze.listeId === satzFenster.listeId ? listenSaetze.saetze : {}, n);
        if (!portion) return null;
        const mitSaetzen = portion.gesamt - portion.offen;
        return (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" data-saetze-fenster onClick={e => e.stopPropagation()} style={{maxHeight:"90vh", overflowY:"auto"}}>
              <div className="modal-titel">✨ Beispielsätze ergänzen</div>
              <p style={{fontSize:"0.85rem", color:"var(--text2)", margin:"0 0 10px"}} data-saetze-stand>{portion.liste.name}: {mitSaetzen} von {portion.gesamt} Vokabeln haben {n} Sätze</p>
              <div className="inp-label">Sätze je Vokabel</div>
              <div style={{display:"flex", gap:6, marginBottom:12}}>
                {SATZ_ANZAHLEN.map(a => <button key={a} className={`typ-btn${a === n ? " aktiv" : ""}`} data-satz-anzahl={a}
                  onClick={() => speichereEinst({ ...einstellungen, satzAnzahl: a })} {...tt(`${a} Beispielsätze je Vokabel`)}>{a}</button>)}
              </div>
              {portion.offen === 0 ? <div style={{fontWeight:700, color:"var(--richtig)", marginBottom:12}} data-saetze-fertig>✓ Alle Vokabeln haben {n} Sätze.</div> : (<>
                <div className="toggle-btn" data-satz-weg style={{display:"flex", marginBottom:10}}>
                  {[["chat", "Antwort im Chat", "Die KI antwortet im Chat – Antwort kopieren und unten einfügen (in Portionen)"],
                    ["datei", "Als Datei", "Die KI liefert eine Textdatei für die ganze Liste – unten mit „📄 Datei laden“ einlesen"]].map(([w, label, info]) => (
                    <button key={w} data-satz-weg-wahl={w} className={`toggle-opt${(einstellungen.satzWeg || "chat") === w ? " aktiv" : ""}`} style={{flex:1}}
                      onClick={() => speichereEinst({ ...einstellungen, satzWeg: w })} {...tt(info)}>{label}</button>
                  ))}
                </div>
                <div className="inp-label">1. Prompt {portion.alsDatei ? "als Datei" : "kopieren"} – {portion.teil.length} Vokabeln{portion.offen > portion.teil.length ? ` (noch ${portion.offen} offen, in Portionen)` : ""}</div>
                <textarea className="inp" readOnly value={portion.prompt} data-satz-prompt rows={4} style={{fontSize:"0.75rem", marginBottom:6}}/>
                <div style={{display:"flex", gap:6, marginBottom:12, flexWrap:"wrap"}}>
                  <button className={`btn btn-sm ${portion.alsDatei ? "btn-ghost" : "btn-primary"}`} data-satz-prompt-kopieren
                    onClick={async () => { try { await navigator.clipboard.writeText(portion.prompt); setSatzFenster(f => ({ ...f, meldung: "Prompt kopiert – jetzt in die KI einfügen." })); } catch { /* manuell kopieren */ } }}
                    {...tt("Prompt in die Zwischenablage kopieren und in ChatGPT, Claude o. Ä. einfügen")}>📋 Prompt kopieren</button>
                  <button className={`btn btn-sm ${portion.alsDatei ? "btn-primary" : "btn-ghost"}`} data-satz-prompt-datei
                    onClick={() => {
                      // Begleitsatz (kurz – passt sicher in die Zwischenablage) und Datei im selben Antippen anstoßen
                      navigator.clipboard?.writeText(SATZ_BEGLEITSATZ).catch(() => {});
                      teileAlsDatei(portion.prompt, dateiName(`Beispielsätze – ${portion.liste.name}`, "Beispielsätze"));
                      setSatzFenster(f => ({ ...f, meldung: "Prompt-Datei erstellt – in der KI anhängen und den kurzen Begleitsatz aus der Zwischenablage einfügen." }));
                    }}
                    {...tt("Prompt als Textdatei – sicher auch bei langen Listen; auf dem iPhone direkt an ChatGPT, Claude o. Ä. teilen oder in „Dateien“ sichern. Der Begleitsatz für die KI liegt danach in der Zwischenablage")}>📄 Prompt als Datei</button>
                </div>
                <div className="inp-label">2. Antwort der KI übernehmen</div>
                <div style={{display:"flex", gap:6, marginBottom:6, flexWrap:"wrap"}}>
                  <button className="btn btn-ghost btn-sm" data-satz-einfuegen
                    onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) await uebernehmeSaetze(t); else setSatzFenster(f => ({ ...f, meldung: "Die Zwischenablage ist leer." })); }
                      catch { setSatzFenster(f => ({ ...f, meldung: "Kein Zugriff auf die Zwischenablage – bitte ins Textfeld einfügen." })); } }}
                    {...tt("Antwort direkt aus der Zwischenablage übernehmen")}>📋 Einfügen</button>
                  <label className="btn btn-ghost btn-sm" style={{cursor:"pointer"}} {...tt("Eine oder mehrere Textdateien der KI einlesen (Format „ID // Satz // Übersetzung“)")}>
                    📄 Datei laden
                    <input type="file" data-satz-datei accept=".txt,.csv,text/plain" multiple style={{display:"none"}}
                      onChange={async e => { const dateien = [...(e.target.files || [])]; e.target.value = "";
                        const texte = await Promise.all(dateien.map(d => d.text())); await uebernehmeSaetze(texte.join("\n")); }}/>
                  </label>
                </div>
                <textarea className="inp" data-satz-antwort rows={3} value={satzFenster.antwort} placeholder="… oder hier einfügen: 12 // Je vais à la *maison*. // Ich gehe nach Hause."
                  onChange={e => setSatzFenster(f => ({ ...f, antwort: e.target.value }))} style={{fontSize:"0.8rem", marginBottom:6}}/>
                <button className="btn btn-primary" data-satz-uebernehmen disabled={!satzFenster.antwort.trim()} style={{width:"100%"}} onClick={() => uebernehmeSaetze()}
                  {...tt("Sätze übernehmen – danach steht hier die nächste Portion")}>Übernehmen</button>
              </>)}
              {satzFenster.meldung && <div data-satz-meldung style={{marginTop:10, fontSize:"0.85rem", fontWeight:600, color:"var(--text)"}}>{satzFenster.meldung}</div>}
              <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setModal(null)} {...tt("Fenster schließen")}>Schließen</button></div>
            </div>
          </div>
        );
      })()
  );
}

// aus App.jsx: {modal === "synonyme" && synFenster && …}
export function DialogSynonyme(app) {
  const { dateiName, einstellungen, setModal, setSynFenster, speichereEinst, synFenster, synPortion, teileAlsDatei, tt, uebernehmeSynonyme } = app;
  return (
(() => {
        const portion = synPortion(synFenster.listeId);
        if (!portion) return null;
        return (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" data-syn-fenster onClick={e => e.stopPropagation()} style={{maxHeight:"90vh", overflowY:"auto"}}>
              <div className="modal-titel">≈ Synonyme ergänzen</div>
              <p style={{fontSize:"0.85rem", color:"var(--text2)", margin:"0 0 10px"}} data-syn-stand>
                {portion.liste.name}: {portion.gesamt - portion.offen} von {portion.gesamt} Vokabeln haben Synonyme{portion.ziel ? ` · Spalte ${portion.ziel.neu ? `${portion.ziel.typ} (wird „Synonyme“)` : (portion.liste.spalten[portion.ziel.typ]?.name || portion.ziel.typ)}` : ""}</p>
              {!portion.ziel ? <div style={{fontWeight:700, color:"var(--falsch)", marginBottom:12}} data-syn-kein-platz>Beide Info-Spalten sind belegt – eine leeren oder als „Synonyme“ einstellen.</div>
              : portion.offen === 0 ? <div style={{fontWeight:700, color:"var(--richtig)", marginBottom:12}} data-syn-fertig>✓ Alle Vokabeln haben Synonyme.</div> : (<>
                <div className="toggle-btn" style={{display:"flex", marginBottom:10}}>
                  {[["chat", "Antwort im Chat", "Die KI antwortet im Chat – Antwort kopieren und unten einfügen (in Portionen)"],
                    ["datei", "Als Datei", "Die KI liefert eine Textdatei für die ganze Liste – unten mit „📄 Datei laden“ einlesen"]].map(([w, label, info]) => (
                    <button key={w} data-syn-weg-wahl={w} className={`toggle-opt${(einstellungen.satzWeg || "chat") === w ? " aktiv" : ""}`} style={{flex:1}}
                      onClick={() => speichereEinst({ ...einstellungen, satzWeg: w })} {...tt(info)}>{label}</button>
                  ))}
                </div>
                <div className="inp-label">1. Prompt {portion.alsDatei ? "als Datei" : "kopieren"} – {portion.teil.length} Vokabeln{portion.offen > portion.teil.length ? ` (noch ${portion.offen} offen, in Portionen)` : ""}</div>
                <textarea className="inp" readOnly value={portion.prompt} data-syn-prompt rows={4} style={{fontSize:"0.75rem", marginBottom:6}}/>
                <div style={{display:"flex", gap:6, marginBottom:12, flexWrap:"wrap"}}>
                  <button className={`btn btn-sm ${portion.alsDatei ? "btn-ghost" : "btn-primary"}`} data-syn-prompt-kopieren
                    onClick={async () => { try { await navigator.clipboard.writeText(portion.prompt); setSynFenster(f => ({ ...f, meldung: "Prompt kopiert – jetzt in die KI einfügen." })); } catch { /* manuell kopieren */ } }}
                    {...tt("Prompt in die Zwischenablage kopieren und in ChatGPT, Claude o. Ä. einfügen")}>📋 Prompt kopieren</button>
                  <button className={`btn btn-sm ${portion.alsDatei ? "btn-primary" : "btn-ghost"}`} data-syn-prompt-datei
                    onClick={() => {
                      navigator.clipboard?.writeText(SATZ_BEGLEITSATZ).catch(() => {});
                      teileAlsDatei(portion.prompt, dateiName(`Synonyme – ${portion.liste.name}`, "Synonyme"));
                      setSynFenster(f => ({ ...f, meldung: "Prompt-Datei erstellt – in der KI anhängen und den kurzen Begleitsatz aus der Zwischenablage einfügen." }));
                    }}
                    {...tt("Prompt als Textdatei – sicher auch bei langen Listen. Der Begleitsatz für die KI liegt danach in der Zwischenablage")}>📄 Prompt als Datei</button>
                </div>
                <div className="inp-label">2. Antwort der KI übernehmen</div>
                <div style={{display:"flex", gap:6, marginBottom:6, flexWrap:"wrap"}}>
                  <button className="btn btn-ghost btn-sm" data-syn-einfuegen
                    onClick={async () => { try { const x = await navigator.clipboard.readText(); if (x) uebernehmeSynonyme(x); else setSynFenster(f => ({ ...f, meldung: "Die Zwischenablage ist leer." })); }
                      catch { setSynFenster(f => ({ ...f, meldung: "Kein Zugriff auf die Zwischenablage – bitte ins Textfeld einfügen." })); } }}
                    {...tt("Antwort direkt aus der Zwischenablage übernehmen")}>📋 Einfügen</button>
                  <label className="btn btn-ghost btn-sm" style={{cursor:"pointer"}} {...tt("Eine oder mehrere Textdateien der KI einlesen (Format „ID // Synonym1, Synonym2“)")}>
                    📄 Datei laden
                    <input type="file" data-syn-datei accept=".txt,.csv,text/plain" multiple style={{display:"none"}}
                      onChange={async e => { const dateien = [...(e.target.files || [])]; e.target.value = "";
                        const texte = await Promise.all(dateien.map(d => d.text())); uebernehmeSynonyme(texte.join("\n")); }}/>
                  </label>
                </div>
                <textarea className="inp" data-syn-antwort rows={3} value={synFenster.antwort} placeholder="… oder hier einfügen: 12 // start, begin, head"
                  onChange={e => setSynFenster(f => ({ ...f, antwort: e.target.value }))} style={{fontSize:"0.8rem", marginBottom:6}}/>
                <button className="btn btn-primary" data-syn-uebernehmen disabled={!synFenster.antwort.trim()} style={{width:"100%"}} onClick={() => uebernehmeSynonyme()}
                  {...tt("Synonyme übernehmen – danach steht hier die nächste Portion")}>Übernehmen</button>
              </>)}
              {synFenster.meldung && <div data-syn-meldung style={{marginTop:10, fontSize:"0.85rem", fontWeight:600, color:"var(--text)"}}>{synFenster.meldung}</div>}
              <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setModal(null)} {...tt("Fenster schließen")}>Schließen</button></div>
            </div>
          </div>
        );
      })()
  );
}

// aus App.jsx: {modal === "stimmen-hilfe" && …}
export function DialogStimmenHilfe(app) {
  const { setModal, tt } = app;
  return (
(() => {
        const ua = navigator.userAgent;
        const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const geraet = ios ? "ios" : /Android/.test(ua) ? "android" : /Mac/.test(ua) ? "mac" : /Windows/.test(ua) ? "windows" : "ios";
        const wege = [
          ["ios", "iPhone / iPad", ["Einstellungen öffnen", "Bedienungshilfen", "Gesprochene Inhalte", "Stimmen", "Sprache wählen (z. B. Deutsch, Englisch)", "Stimme antippen und laden – „Erweitert“ oder „Premium“ klingen am natürlichsten"]],
          ["android", "Android", ["Einstellungen öffnen", "System › Sprachen (bzw. Bedienungshilfen)", "Sprachausgabe (Text-in-Sprache)", "Bevorzugtes Modul › Einstellungen", "Sprachdaten installieren", "Sprache wählen und Stimmen laden"]],
          ["mac", "Mac", ["Systemeinstellungen", "Bedienungshilfen", "Gesprochene Inhalte", "Systemstimme › Stimmen verwalten", "Stimmen auswählen und laden"]],
          ["windows", "Windows", ["Einstellungen", "Zeit und Sprache › Sprache und Region", "Sprache hinzufügen bzw. Sprachoptionen", "Sprachausgabe (Text-to-Speech) installieren"]],
        ].sort((a, b) => (a[0] === geraet ? -1 : 0) - (b[0] === geraet ? -1 : 0));
        return (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" data-stimmen-hilfe-fenster={geraet} onClick={e => e.stopPropagation()} style={{maxHeight:"88vh", overflowY:"auto"}}>
              <div className="modal-titel">＋ Weitere Stimmen laden</div>
              {wege.map(([k, name, schritte], i) => (
                <details key={k} open={i === 0} data-stimmen-weg={k} style={{marginBottom:10}}>
                  <summary style={{fontWeight:700, cursor:"pointer", marginBottom:6}}>{name}{k === geraet ? " (dieses Gerät)" : ""}</summary>
                  <ol style={{margin:"4px 0 0 18px", padding:0, fontSize:"0.88rem", lineHeight:1.6, color:"var(--text)"}}>
                    {schritte.map(x => <li key={x}>{x}</li>)}
                  </ol>
                </details>
              ))}
              <div style={{fontSize:"0.85rem", color:"var(--text2)", margin:"6px 0 12px"}}>Danach die App einmal ganz schließen und neu öffnen – die neuen Stimmen stehen dann hier mit Haken.</div>
              <div className="modal-actions"><button className="btn btn-primary" onClick={() => setModal(null)} {...tt("Fenster schließen")}>OK</button></div>
            </div>
          </div>
        );
      })()
  );
}
