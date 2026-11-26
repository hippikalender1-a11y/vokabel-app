import { AKZENTE_FUER_LISTE, FORTSCHRITT_BALKEN, LERNSTAND_TEILE, STATISTIK_ARTEN, istFaellig, statistikSicht } from "../quiz.jsx";
import { IcoDown, IcoExpand, IcoUp } from "../komponenten.jsx";
import { SK, TYPEN, formatDatum, lsSet } from "../speicher.js";
import { fv } from "../farben.js";
import { SymWdh } from "../symbole.jsx";

// Phase 2 (Aufteilung): Bereich aus dem Haupt-return von App.jsx (tab === "statistik")
// app = Zustände, Setter und Funktionen der Komponente (siehe „const app“ in App.jsx)
export function StatistikTab(app) {
  const { einstellungen, headerH, oeffneVokabelBearbeiten, setGruppenQuiz, setStatistikArt, setStatistikFilter, setStatistikListeZu, setStatistikSort, setStatistikVollbild, slotH, statistikArt, statistikBereichTyp, statistikCheckboxAuswahl, statistikFilter, statistikGefilterteVoks, statistikGewaehlteListenObjekte, statistikListeZu, statistikListenIds, statistikSort, statistikVollbild, tt } = app;
  return (
(() => {
          const schwelleS = einstellungen.gelerntSchwelle ?? 0;
          // Kennzahlen immer über alle Vokabeln; der Gelernt-Knopf blendet nur Graph + Liste aus
          const alleVoks = statistikSicht(statistikGefilterteVoks, statistikArt);
          const artName = STATISTIK_ARTEN.find(([a]) => a === statistikArt)[1];
          // Akzente nur, wenn sie für eine Sprache der Auswahl eingeschaltet sind (Einstellungen → Akzente)
          const artenVerfuegbar = STATISTIK_ARTEN.map(([x]) => x).filter(x => x !== "akzente" || statistikGefilterteVoks.some(v => AKZENTE_FUER_LISTE(v._listeId)));
          const naechsteArt = () => setStatistikArt(a => artenVerfuegbar[(artenVerfuegbar.indexOf(a) + 1) % artenVerfuegbar.length]);
          const istGelerntS = v => schwelleS > 0 && (v.fortschritt?.score ?? -Infinity) >= schwelleS;
          // Drei Bewertungsgruppen + nie abgefragt; Score 0 zählt als "in Arbeit"
          const gruppeVon = v => !v.fortschritt ? "nie" : v.fortschritt.score < 0 ? "negativ" : istGelerntS(v) ? "gelernt" : "arbeit";
          const gruppenAnzahl = { negativ: 0, nie: 0, arbeit: 0, gelernt: 0 };
          alleVoks.forEach(v => { gruppenAnzahl[gruppeVon(v)]++; });

          // Akzente-Sicht ohne Wörter mit Akzent: gleiches Layout (Kopfzeile, Kreis-Mitte an derselben Stelle), Hinweis statt Segmenten
          const keineAkzente = alleVoks.length === 0 && statistikArt === "akzente" && statistikGefilterteVoks.length > 0;
          if (alleVoks.length === 0 && !keineAkzente) return (
            <div className="sektion">
              <div className="leer"><div className="leer-text">
                {(statistikListenIds !== null && statistikListenIds.size === 0)
                  ? "Keine Liste ausgewählt."
                  : statistikBereichTyp === "bereich" && statistikCheckboxAuswahl.size === 0
                  ? "Keine Vokabeln ausgewählt."
                  : statistikArt === "akzente" ? "Keine Vokabeln mit Akzent vorhanden."
                  : "Keine Vokabeln vorhanden."}
              </div></div>
              {statistikArt !== "uebersetzung" && (
                <div style={{textAlign:"center"}}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setStatistikArt("uebersetzung")}
                    {...tt("Statistik wieder für die Übersetzung anzeigen")}>Zur Übersetzungs-Statistik</button>
                </div>
              )}
            </div>
          );

          // 302: Filter – Gruppen (negativ/nie/arbeit/gelernt) und Langzeit-Stufen der gelernten („ohne3“…„ohne6“ = ausgeblendet)
          const langzeitS = statistikArt === "uebersetzung" && schwelleS > 0;
          const stufeVon = v => Math.min(6, Math.max(3, v.fortschritt?.score ?? 0));
          const filterVok = v => { const g = gruppeVon(v); return statistikFilter.has(g) && !(g === "gelernt" && langzeitS && statistikFilter.has(`ohne${stufeVon(v)}`)); };
          const alleFilterAktiv = ['negativ', 'nie', 'arbeit', 'gelernt'].every(g => statistikFilter.has(g)) && ![3, 4, 5, 6].some(x => statistikFilter.has(`ohne${x}`));
          // Kopfzeile (Lernfortschritt, Ø) und „Lernstand · n Vokabeln“ zählen die eingeblendeten Vokabeln (302)
          const kopfVoks = alleFilterAktiv ? alleVoks : alleVoks.filter(filterVok);
          const kopfAnzahl = { negativ: 0, nie: 0, arbeit: 0, gelernt: 0 };
          kopfVoks.forEach(v => { kopfAnzahl[gruppeVon(v)]++; });
          const abgefragt = kopfVoks.filter(v => v.fortschritt);
          const avgScore = abgefragt.length > 0
            ? abgefragt.reduce((s, v) => s + v.fortschritt.score, 0) / abgefragt.length
            : null;

          // Lernfortschritt: jede Vokabel zählt anteilig bis zur Gelernt-Schwelle (0…100 %),
          // 100 % = alle Vokabeln gelernt. Negativ/nie abgefragt = 0 %.
          const anteil = score => schwelleS > 0 ? Math.min(1, Math.max(0, (score ?? 0) / schwelleS)) : 0;
          const prozent = (voks, scoreVon) => voks.length > 0 ? voks.reduce((s, v) => s + anteil(scoreVon(v)), 0) / voks.length * 100 : 0;
          const lernFortschritt = prozent(kopfVoks, v => v.fortschritt?.score);
          const gelerntAnzahl = kopfVoks.filter(istGelerntS).length;


          // Filter-Logik (Graph + Vokabelliste): siehe oben (302)
          const anzeigeVoks = alleVoks;

          // Vokabelliste (gefiltert + sortiert)
          let voks = alleFilterAktiv ? [...anzeigeVoks] : anzeigeVoks.filter(filterVok);
          const [sKey, sDir] = statistikSort.split("-");
          if (sKey === "score") voks.sort((a, b) => { const d = (a.fortschritt?.score ?? 0) - (b.fortschritt?.score ?? 0); return sDir === "asc" ? d : -d; });
          else if (sKey === "datum") voks.sort((a, b) => { const da = a.fortschritt?.letzteAbfrage ? new Date(a.fortschritt.letzteAbfrage) : new Date(0); const db = b.fortschritt?.letzteAbfrage ? new Date(b.fortschritt.letzteAbfrage) : new Date(0); return sDir === "asc" ? da - db : db - da; });
          else if (sKey === "alpha") { voks.sort((a, b) => { const spa = TYPEN.find(t => a._spalten[t]?.aktiv); const spb = TYPEN.find(t => b._spalten[t]?.aktiv); const r = (a[spa]?.wert || '').localeCompare(b[spb]?.wert || ''); return sDir === "asc" ? r : -r; }); }
          else if (sKey === "listennr") voks.sort((a, b) => { const dr = a._listenIndexRank - b._listenIndexRank; if (dr !== 0) return sDir === "asc" ? dr : -dr; const di = a._listIndex - b._listIndex; return sDir === "asc" ? di : -di; });
          const mehrereListenGewaehlt = statistikGewaehlteListenObjekte.length > 1;

          // Filter-Boxen (Multi-Select: alle standardmäßig aktiv)
          // Farben der Gruppen (Zeilen, Gruppen-Balken)
          const GRUPPE_BG = { negativ:"var(--falsch-flaeche)", gelernt:"var(--haupt-flaeche)" };

          return (<>
            {/* Ø-Score sticky Header */}
            {!statistikVollbild && (
            <div style={{position:"sticky", top:headerH+slotH, zIndex:6, background:"var(--kopfzeile)", borderBottom:"1px solid var(--rahmen)", padding:"8px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
              <div style={{display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2, flexShrink:0}}>
                <span data-statistik-kopf-titel style={{fontWeight:600, fontSize:"0.85rem", color:"var(--kopf-schrift)"}}>{schwelleS > 0 ? "Lernfortschritt" : "Ø Score"}</span>
                <span style={{fontSize:"0.72rem", fontWeight:700, color:"var(--kopf-schrift-leise)"}} {...tt("Ausgewertet wird dieser Score – Tap in die Kreismitte wechselt")}>{artName}</span>
              </div>
              {schwelleS > 0 && (
                <div style={{display:"flex", flexDirection:"column", alignItems:"center", flex:1, minWidth:0}}>
                  <div style={{display:"flex", alignItems:"baseline", gap:6}}>
                    <span data-statistik-kopf-prozent style={{fontWeight:800, fontSize:"1.25rem", color: keineAkzente ? "var(--kopf-schrift-leise)" : "var(--kopf-schrift)"}}>{keineAkzente ? "–" : `${Math.round(lernFortschritt)} %`}</span>
                  </div>
                  <div data-statistik-kopf-balken style={{display:"flex", width:"min(260px, 100%)", height:6, borderRadius:3, overflow:"hidden", background:"var(--fortschritt-balken)", margin:"3px 0 2px"}}
                    {...tt(`Negativ ${kopfAnzahl.negativ} · In Arbeit ${kopfAnzahl.arbeit} · Gelernt ${kopfAnzahl.gelernt} · Nie abgefragt ${kopfAnzahl.nie}`)}>
                    {kopfVoks.length > 0 && FORTSCHRITT_BALKEN.map(([g, farbe]) => kopfAnzahl[g] > 0 && (
                      <div key={g} data-gruppe={g} style={{width:`${kopfAnzahl[g] / kopfVoks.length * 100}%`, background:farbe}}/>
                    ))}
                  </div>
                  <div data-statistik-kopf-zahl style={{fontSize:"0.7rem", color:"var(--kopf-schrift-leise)", whiteSpace:"nowrap"}}>
                    {keineAkzente ? "keine Akzente" : <>{gelerntAnzahl} / {kopfVoks.length} gelernt</>}
                    {avgScore !== null && <> · Ø {avgScore > 0 ? "+" : ""}{avgScore.toFixed(1)}</>}
                  </div>
                </div>
              )}
              {schwelleS <= 0 && (
              <div style={{display:"flex", alignItems:"center", gap:12, flex:1, justifyContent:"center"}}>
                <div style={{display:"flex", alignItems:"center", gap:4}}>
                  <svg width="14" height="3" viewBox="0 0 14 3" style={{flexShrink:0}}><line x1="0" y1="1.5" x2="14" y2="1.5" stroke={fv("var(--haupt)")} strokeWidth="2.5"/></svg>
                  {avgScore !== null ? (
                    <span style={{fontWeight:700, fontSize:"0.88rem", color: avgScore > 0 ? "var(--haupt)" : avgScore < 0 ? "var(--falsch)" : "var(--text2)"}}>
                      {avgScore > 0 ? "+" : ""}{avgScore.toFixed(1)}
                    </span>
                  ) : <span style={{color:"var(--text3)", fontSize:"0.8rem"}}>–</span>}
                </div>
              </div>
              )}
            </div>
            )}
            <div className="sektion" style={{paddingTop:12, paddingBottom:0}}>
              {/* 269: Balken statt Kreisdiagramm – Lernstand (Negativ · Kurzzeit · Gelernt), Langzeit (je Raute), Gesamtübersicht */}
              {(() => {
                const NAME = { gelernt:"Gelernt", arbeit:"Auf einem guten Weg", nie:"Nie abgefragt", negativ:"Negativ" };
                const TEXTFARBE = { gelernt:"var(--haupt)", arbeit:"var(--gelb-dunkel)", nie:"var(--text2)", negativ:"var(--falsch)" };
                const nieAus = !statistikFilter.has("nie");
                const basis = nieAus ? alleVoks.filter(v => v.fortschritt) : alleVoks;   // 100 % der Balken
                const n = basis.length;
                const sc = v => v.fortschritt?.score ?? 0;
                const zaehle = f => basis.filter(f).length;
                const umschalten = g => setStatistikFilter(prev => { const s = new Set(prev); s.has(g) ? s.delete(g) : s.add(g); return s; });
                const quizMenue = g => {
                  const gv = alleVoks.filter(v => gruppeVon(v) === g);
                  return [{ label: `▶ Quiz mit ${gv.length} Vokabel${gv.length !== 1 ? "n" : ""}`, fn: () => setGruppenQuiz({
                    name: NAME[g], art: statistikArt, ids: gv.map(v => v.id), listenIds: [...new Set(gv.map(v => v._listeId))] }) }];
                };
                const pct = (x, von = n) => von > 0 ? Math.round(x / von * 100) : 0;
                // Balken: Rahmen = 100 %, Teile füllen von unten (erster Teil ganz unten)
                const balken = ({ key, teile, von, attrs = {}, aus = false, titel, unter, tipp, menue, onClick }) => (
                  <div key={key} className="st-spalte" style={{opacity: aus ? 0.45 : 1}}>
                    <button className="st-balken" {...attrs} onClick={onClick} {...tt(tipp, menue)}>
                      {(() => { let unten = 0; return teile.filter(t => t.n > 0).map(t => { const h = von > 0 ? t.n / von * 100 : 0; const el = (
                        <span key={t.k} className={`st-teil${t.hohl ? " st-hohl" : ""}`} data-st-teil={t.k} style={{bottom:`${unten}%`, height:`${h}%`, background:t.farbe}} title={`${t.name}: ${t.n}`}/>); unten += h; return el; }); })()}
                    </button>
                    <div className="st-name" {...(attrs["data-kreis-gruppe"] ? { "data-legende": attrs["data-kreis-gruppe"] } : {})} onClick={onClick}
                      style={{color: titel.farbe, textDecoration: aus ? "line-through" : "none"}} {...tt(tipp, menue)}>{titel.text}</div>
                    <div className="st-zahl">{unter}</div>
                  </div>
                );
                // 284: Teile und Farben wie in der Quiz-Auswertung (unten → oben)
                const teileVon = g => LERNSTAND_TEILE[g].map(([k, f, farbe]) => ({ k, n: zaehle(v => v.fortschritt && f(sc(v))), farbe }));
                const tNeg = teileVon("negativ"), tArb = teileVon("arbeit");
                const neg2 = tNeg[0].n, neg1 = tNeg[1].n;
                const k = tArb.map(t => t.n);
                const gel = zaehle(v => v.fortschritt && sc(v) >= 3);
                const langzeit = langzeitS;
                const gelernte = alleVoks.filter(v => v.fortschritt && sc(v) >= 3);
                const faelligAnz = gelernte.filter(v => istFaellig(v.fortschritt)).length;   // = Summe der hohlen Teile
                const nieAnz = alleVoks.filter(v => !v.fortschritt).length, abgefragt = alleVoks.length - nieAnz;
                return (
                  <div data-statistik-balken style={{marginBottom:16, borderRadius:12, border:"1px solid var(--rahmen)", background:"var(--flaeche-hell)", padding:"8px 10px 12px", position:"relative"}}>
                    <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
                      <button className="typ-btn aktiv" data-kreismitte="1" onClick={naechsteArt} style={{fontSize:"0.75rem", padding:"3px 10px"}}
                        {...tt("Antippen: zwischen Übersetzung, Diktat und Akzenten wechseln")}><span data-st-art-name>{artName} ⇄</span></button>
                      <span style={{flex:1}}/>
                      {!statistikVollbild && <button onClick={() => setStatistikVollbild(true)} style={{background:"none", border:"none", padding:"4px 6px", cursor:"pointer", color:"var(--text2)", display:"flex"}}
                        {...tt("Statistik im Vollbild anzeigen")}><IcoExpand s={18}/></button>}
                    </div>
                    {keineAkzente ? <div data-keine-akzente style={{textAlign:"center", color:"var(--text)", fontWeight:600, padding:"30px 0"}}>Für dieses Quiz sind keine Akzente vorhanden.</div> : (<>
                    {/* 286: Gesamtzahl in der Überschrift (antippen: alles wieder einblenden) */}
                    <div className="st-titel">Lernstand <span style={{fontWeight:500, color:"var(--text3)"}}>· <button className="st-titel-knopf" data-st-kachel="gesamt" onClick={() => setStatistikFilter(new Set(['negativ', 'nie', 'arbeit', 'gelernt']))}
                      style={{color:"inherit", fontWeight:"inherit"}}
                      {...tt(`Eingeblendete Vokabeln: ${kopfVoks.length} von ${alleVoks.length} – antippen blendet alles wieder ein`)}><b data-st-anzahl>{kopfVoks.length}</b> Vokabeln</button></span></div>
                    <div className="st-reihe" data-st-lernstand>
                      {balken({ key:"nie", von: alleVoks.length, aus: nieAus, attrs: { "data-kreis-gruppe": "nie", "data-st-balken": "nie", "data-nie-aus": nieAus ? "an" : "aus" }, onClick: () => umschalten("nie"), menue: quizMenue("nie"),
                        tipp: `Nie abgefragt: ${nieAnz} – antippen blendet sie aus (Balken und Liste nur mit schon abgefragten Vokabeln, z. B. erst ein Teil des Buches behandelt; der Kopf zählt weiter alle), lange drücken: Quiz mit diesen Vokabeln`,
                        teile: [{ k:"nie", n:nieAnz, farbe:"var(--nie)", name:NAME.nie }],
                        titel: { text: NAME.nie, farbe: TEXTFARBE.nie }, unter: `${nieAnz} · ${pct(nieAnz, alleVoks.length)} %` })}
                      <div className="st-abgefragt" data-st-abgefragt={abgefragt}>
                      <div className="st-reihe">
                      {balken({ key:"negativ", von:n, aus: !statistikFilter.has("negativ"), attrs: { "data-kreis-gruppe": "negativ", "data-st-balken": "negativ" }, onClick: () => umschalten("negativ"), menue: quizMenue("negativ"),
                        tipp: `Negativ: dunkel „Kann ich mir überhaupt nicht merken“ (${neg2}), hell „Muss ich mir noch mal ansehen“ (${neg1}) – antippen blendet sie in der Liste aus, lange drücken: Quiz mit diesen Vokabeln`,
                        teile: [{ ...tNeg[0], name:"Kann ich mir überhaupt nicht merken" }, { ...tNeg[1], name:"Muss ich mir noch mal ansehen" }],
                        titel: { text: NAME.negativ, farbe: TEXTFARBE.negativ }, unter: `${neg1 + neg2} · ${pct(neg1 + neg2)} %` })}
                      {balken({ key:"arbeit", von:n, aus: !statistikFilter.has("arbeit"), attrs: { "data-kreis-gruppe": "arbeit", "data-st-balken": "arbeit" }, onClick: () => umschalten("arbeit"), menue: quizMenue("arbeit"),
                        tipp: `Auf einem guten Weg (Kurzzeit): ●●○ ${k[2]} (oben), ●○○ ${k[1]}, ○○○ ${k[0]} (unten) – antippen blendet sie in der Liste aus, lange drücken: Quiz mit diesen Vokabeln`,
                        teile: [{ ...tArb[0], name:"○○○" }, { ...tArb[1], name:"●○○" }, { ...tArb[2], name:"●●○" }],
                        titel: { text: NAME.arbeit, farbe: TEXTFARBE.arbeit }, unter: `${k[0] + k[1] + k[2]} · ${pct(k[0] + k[1] + k[2])} %` })}
                      {balken({ key:"gelernt", von:n, aus: !statistikFilter.has("gelernt"), attrs: { "data-kreis-gruppe": "gelernt", "data-st-balken": "gelernt" }, onClick: () => setStatistikFilter(prev => { const x = new Set(prev); if (x.has("gelernt")) x.delete("gelernt"); else { x.add("gelernt"); [3, 4, 5, 6].forEach(t => x.delete(`ohne${t}`)); } return x; }), menue: quizMenue("gelernt"),
                        tipp: `Gelernt (ab Score 3): ${gel} – das Ziel: alle Vokabeln hier. Antippen blendet sie in der Liste aus, lange drücken: Quiz mit diesen Vokabeln`,
                        teile: [{ k:"3", n:gel, farbe:"var(--gelernt)", name:"Gelernt" }],
                        titel: { text: "✓ " + NAME.gelernt, farbe: TEXTFARBE.gelernt }, unter: `${gel} · ${pct(gel)} %` })}
                      </div>
                      <div className="st-klammer" {...tt(`Schon abgefragt: ${abgefragt} von ${alleVoks.length}${nieAus ? " – nie abgefragte ausgeblendet, die drei Balken beziehen sich nur auf diese" : ""}`)}>
                        <span>{abgefragt} abgefragt{nieAus ? " = 100 %" : ""}</span></div>
                      </div>
                    </div>
                    {langzeit && (<>
                      {/* 286: gelernt = alle Langzeit-Balken, fällig = die hohlen Teile */}
                      <div className="st-titel" style={{marginTop:14}}>Langzeitgedächtnis <span style={{fontWeight:500, color:"var(--text3)"}}>· <span data-st-kachel="gelernt"><b>{gelernte.length}</b> gelernte</span> · <span data-st-kachel="faellig"><SymWdh/> <b>{faelligAnz}</b> fällig</span></span></div>
                      <div className="st-reihe" data-st-langzeit>
                        {[[3, "◇◇◇"], [4, "◆◇◇"], [5, "◆◆◇"], [6, "◆◆◆"]].map(([s, sym]) => {
                          const hier = gelernte.filter(v => (s === 6 ? sc(v) >= 6 : sc(v) === s));
                          const f = hier.filter(v => istFaellig(v.fortschritt)).length;
                          const lzAus = !statistikFilter.has("gelernt") || statistikFilter.has(`ohne${s}`);   // 302: Filter wie die Lernstand-Balken
                          const lzUmschalten = () => setStatistikFilter(prev => { const x = new Set(prev);
                            if (!x.has("gelernt")) { x.add("gelernt"); [3, 4, 5, 6].forEach(t => { if (t !== s) x.add(`ohne${t}`); }); x.delete(`ohne${s}`); }
                            else x.has(`ohne${s}`) ? x.delete(`ohne${s}`) : x.add(`ohne${s}`);
                            return x; });
                          return balken({ key:`l${s}`, von: gelernte.length, aus: lzAus, attrs: { "data-st-raute": s, "data-st-raute-aus": lzAus ? "an" : "aus" }, onClick: lzUmschalten,
                            tipp: `${sym}: ${hier.length} gelernte${f ? `, davon ${f} jetzt zur Prüfung fällig (hohl)` : ""} – 100 % = alle gelernten; antippen blendet sie in der Liste aus bzw. ein`,
                            teile: [{ k:"f", n:f, farbe:"var(--karte)", hohl:true, name:"fällig" }, { k:"r", n:hier.length - f, farbe:"var(--gelernt)", name:sym }],   // 285: fällige hohl
                            titel: { text: sym, farbe: "var(--haupt)" }, unter: <>{hier.length}{f ? <span data-st-faellig={f}> · <SymWdh/> {f}</span> : null}</> });
                        })}
                      </div>
                    </>)}
                    </>)}
                  </div>
                );
              })()}

              {!keineAkzente && (<>
              {/* Sortierung */}
              <div className="sektion-label" style={{marginBottom:8}}>Sortierung</div>
              <div style={{display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:16}}>
                {[
                  {key:"score", label:"Score", def:"asc"},
                  {key:"datum", label:"Datum", def:"desc"},
                  {key:"alpha", label:"A→Z", def:"asc"},
                  {key:"listennr", label:"Listenplatz", def:"asc"},
                ].map(s => {
                  const [aKey, aDir] = statistikSort.split("-");
                  const isActive = aKey === s.key;
                  return (
                    <button key={s.key} className={`typ-btn${isActive?" aktiv":""}`}
                      onClick={() => isActive
                        ? setStatistikSort(`${s.key}-${aDir === "asc" ? "desc" : "asc"}`)
                        : setStatistikSort(`${s.key}-${s.def}`)}
                      {...tt(isActive ? `${s.label} – Richtung umkehren` : `Nach ${s.label} sortieren`)}>
                      {s.label}{isActive ? (aDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  );
                })}
              </div>

              {/* Vokabelliste – ein-/ausklappbar */}
              <div data-statistik-liste-kopf={statistikListeZu ? "zu" : "offen"} {...tt(statistikListeZu ? "Vokabelliste ausklappen" : "Vokabelliste einklappen")}
                style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:8}}
                onClick={() => { const zu = !statistikListeZu; setStatistikListeZu(zu); lsSet(SK.statistikListeZu, zu ? 1 : false); }}>
                <div className="sektion-label" style={{marginBottom:0}}>{voks.length} Vokabel{voks.length!==1?"n":""}</div>
                <span className="btn-toggle" style={{padding:"3px 6px"}}>
                  {statistikListeZu ? <IcoUp s={10}/> : <IcoDown s={10}/>}
                </span>
              </div>
              {!statistikListeZu && (
              <div className="karte">
                {voks.length === 0 ? (
                  <div className="karte-zeile" style={{color:"var(--text2)", fontSize:"0.85rem"}}>Keine Vokabeln in diesem Filter.</div>
                ) : voks.map((vok, idx) => {
                  const rawScore = vok.fortschritt?.score ?? null;
                  const score = rawScore;
                  const isPos = score !== null && score > 0;
                  const isNeg = score !== null && score < 0;
                  const gruppe = gruppeVon(vok);
                  const istGel = gruppe === "gelernt";
                  const scoreColor = istGel || isPos ? "var(--haupt)" : isNeg ? "var(--falsch)" : "var(--text3)";
                  // Balken: links bis −5, rechts bis zur Gelernt-Schwelle (ohne Schwelle ±10); Null in allen Zeilen gleich
                  const links = schwelleS > 0 ? 5 : 10, rechts = schwelleS > 0 ? schwelleS : 10;
                  const nullPct = links / (links + rechts) * 100;
                  const barPct = score === null ? 0 : isPos
                    ? Math.min(score, rechts) / (links + rechts) * 100
                    : Math.min(-score, links) / (links + rechts) * 100;
                  const t1 = vok.E1?.wert || "";
                  const t2 = vok.D1?.wert || "";
                  const displayText = [t1, t2].filter(Boolean).join(" – ");
                  return (
                    <div key={`${vok._listeName}_${vok.id}_${idx}`} data-statistik-vok={vok.id}
                      {...tt(`${displayText || "Vokabel"} – lang drücken: bearbeiten oder neue Vokabel`, [
                        { label: "✎ Bearbeiten", fn: () => oeffneVokabelBearbeiten(vok, vok._listeId) },
                        { label: `➕ Neue Vokabel in „${vok._listeName}“`, fn: () => oeffneVokabelBearbeiten(null, vok._listeId) },
                      ], { langText: `${displayText || "Vokabel"} · ${vok._listeName}` })}
                      style={{display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background: GRUPPE_BG[gruppe],
                        borderBottom: idx < voks.length-1 ? "1px solid var(--rahmen)" : "none"}}>
                      {/* Text */}
                      <div style={{width:"33%", minWidth:0, overflow:"hidden", textOverflow:"ellipsis",
                        whiteSpace:"nowrap", fontSize:"0.8rem", color:"var(--text-stark)", flexShrink:0}}>
                        {displayText || <span style={{color:"var(--text4)"}}>–</span>}
                      </div>
                      {/* Score-Balken */}
                      <div style={{flex:1, position:"relative", height:8, background:"var(--flaeche)", borderRadius:4, minWidth:0}}>
                        {istGel ? (
                          // Gelernt: ganzer Balken grün (auch der negative Bereich)
                          <div style={{position:"absolute", top:0, bottom:0, left:0, right:0, borderRadius:4, background:"var(--haupt)"}}/>
                        ) : score !== null && score !== 0 && (
                          <div style={{position:"absolute", top:0, bottom:0, borderRadius:4,
                            background: isPos ? "var(--haupt-hell)" : "var(--falsch)",
                            ...(isPos ? {left:`${nullPct}%`, width:`${barPct}%`} : {right:`${100 - nullPct}%`, width:`${barPct}%`})}}/>
                        )}
                        <div style={{position:"absolute", top:0, bottom:0, left:`${nullPct}%`,
                          transform:"translateX(-50%)", width:1, background: istGel ? "var(--haupt-flaeche)" : "var(--text4)"}}/>
                      </div>
                      {/* Score + Datum */}
                      <div style={{width:"22%", display:"flex", flexDirection:"column",
                        alignItems:"flex-end", flexShrink:0, gap:1}}>
                        <span style={{fontSize:"0.78rem", fontWeight:700, color:scoreColor}}
                          {...(istGel ? tt(`Gelernt (Schwelle +${schwelleS})`) : {})}>
                          {istGel ? "✓ " : ""}{score !== null ? (score > 0 ? "+" : "") + score : "–"}
                        </span>
                        <span style={{fontSize:"0.62rem", color:"var(--text3)"}}>
                          {formatDatum(vok.fortschritt?.letzteAbfrage)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
              </>)}
            </div>
          </>);
        })()
  );
}
