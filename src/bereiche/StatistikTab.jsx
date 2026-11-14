import { AKZENTE_FUER_LISTE, FORTSCHRITT_BALKEN, GRUPPE_BALKEN, STATISTIK_ARTEN, statistikSicht } from "../quiz.jsx";
import { IcoDown, IcoExpand, IcoUp } from "../komponenten.jsx";
import { SK, TYPEN, formatDatum, lsSet } from "../speicher.js";
import { fv } from "../farben.js";

// Phase 2 (Aufteilung): Bereich aus dem Haupt-return von App.jsx (tab === "statistik")
// app = Zustände, Setter und Funktionen der Komponente (siehe „const app“ in App.jsx)
export function StatistikTab(app) {
  const { einstellungen, headerH, oeffneVokabelBearbeiten, setGruppenQuiz, setStatistikArt, setStatistikFilter, setStatistikListeZu, setStatistikSort, setStatistikVollbild, slotH, statistikArt, statistikBereichTyp, statistikCheckboxAuswahl, statistikEinzelauswahlAufgeklappt, statistikFilter, statistikGefilterteVoks, statistikGewaehlteListenObjekte, statistikListeZu, statistikListenAufgeklappt, statistikListenHeaderH, statistikListenIds, statistikSort, statistikVokauswahlH, statistikVollbild, tt } = app;
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

          // Kopfzeile (Lernfortschritt, Gruppen-Balken, Ø) zählt nur die eingeblendeten Gruppen
          const kopfVoks = alleVoks.filter(v => statistikFilter.has(gruppeVon(v)));
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


          // Filter-Logik (wird für Graph + Vokabelliste verwendet)
          const alleFilterAktiv = ['negativ', 'nie', 'arbeit', 'gelernt'].every(g => statistikFilter.has(g));
          const filterVok = v => statistikFilter.has(gruppeVon(v));
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
            <div style={{position:"sticky", top:headerH+slotH+statistikListenHeaderH+statistikVokauswahlH, zIndex:6, background:"var(--kopfzeile)", borderBottom:"1px solid var(--rahmen)", padding:"8px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
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
                    {...tt(`Gelernt ${kopfAnzahl.gelernt} · In Arbeit ${kopfAnzahl.arbeit} · Nie abgefragt ${kopfAnzahl.nie} · Negativ ${kopfAnzahl.negativ}`)}>
                    {kopfVoks.length > 0 && FORTSCHRITT_BALKEN.map(([g, farbe]) => kopfAnzahl[g] > 0 && (
                      <div key={g} style={{width:`${kopfAnzahl[g] / kopfVoks.length * 100}%`, background:farbe}}/>
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
            <div className="sektion" style={{paddingTop:12, paddingBottom:(statistikListenAufgeklappt||statistikEinzelauswahlAufgeklappt)?'100dvh':0}}>
              {/* Kreisdiagramm */}
              {(() => {
                // Kreisdiagramm der Gruppen: leere Gruppen fehlen, Segment antippen = Gruppe ein-/ausblenden
                const renderKreis = () => {
                  const NAME = { gelernt:"✓ Gelernt", arbeit:"In Arbeit", nie:"Nie abgefragt", negativ:"Negativ" };
                  const TEXTFARBE = { gelernt:"var(--haupt)", arbeit:"var(--gelb-dunkel)", nie:"var(--text2)", negativ:"var(--falsch)" };
                  // Nur eingeblendete Gruppen teilen sich den Kreis; ausgeblendete stehen in der Legende
                  const vorhanden = GRUPPE_BALKEN.filter(([g]) => gruppenAnzahl[g] > 0);
                  const sichtbar = vorhanden.filter(([g]) => statistikFilter.has(g));
                  const gesamt = sichtbar.reduce((sum, [g]) => sum + gruppenAnzahl[g], 0);
                  const W = 400, H = 230, cx = 200, cy = 115, r = 80;
                  const punkt = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
                  let winkel = -Math.PI / 2;
                  const teile = sichtbar.map(([g, farbe]) => {
                    const a0 = winkel, a1 = winkel + gruppenAnzahl[g] / gesamt * 2 * Math.PI;
                    winkel = a1;
                    const mitte = (a0 + a1) / 2;
                    return { g, farbe, n: gruppenAnzahl[g], a0, a1, mitte, rechts: Math.cos(mitte) >= 0, y: punkt(mitte, r + 24)[1] };
                  });
                  // Beschriftungen je Seite von oben nach unten entzerren
                  for (const seite of [true, false]) {
                    const l = teile.filter(t => t.rechts === seite).sort((a, b) => a.y - b.y);
                    for (let i = 1; i < l.length; i++) if (l[i].y - l[i - 1].y < 32) l[i].y = l[i - 1].y + 32;
                    if (l.length && l[l.length - 1].y > H - 20) { const d = l[l.length - 1].y - (H - 20); l.forEach(t => { t.y -= d; }); }
                    l.forEach(t => { if (t.y < 16) t.y = 16; });
                  }
                  const pfad = t => {
                    const [x0, y0] = punkt(t.a0, r), [x1, y1] = punkt(t.a1, r);
                    return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${t.a1 - t.a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`;
                  };
                  const umschalten = g => setStatistikFilter(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });
                  // Lang-Druck: Menü "Quiz mit dieser Gruppe" (mit Rückfrage)
                  const quizMenue = g => {
                    const gv = alleVoks.filter(v => gruppeVon(v) === g);
                    return [{ label: `▶ Quiz mit ${gv.length} Vokabel${gv.length !== 1 ? "n" : ""}`, fn: () => setGruppenQuiz({
                      name: NAME[g], art: statistikArt, ids: gv.map(v => v.id), listenIds: [...new Set(gv.map(v => v._listeId))] }) }];
                  };
                  return (
                    <div style={{background:"var(--flaeche-hell)", padding:"8px 6px 10px"}}>
                      {teile.length === 0 && !keineAkzente ? (
                        <div style={{textAlign:"center", color:"var(--text3)", fontSize:"0.85rem", padding:"40px 0"}}>Alle Gruppen ausgeblendet
                          <div><button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={naechsteArt} {...tt("Zwischen Übersetzung, Diktat und Akzenten wechseln")}>{artName} ⇄</button></div></div>
                      ) : (
                      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%", maxHeight:260, display:"block", userSelect:"none"}}>
                        {keineAkzente && (
                          <text data-keine-akzente x={cx} y={cy - 58} textAnchor="middle" fontSize="15" fontWeight="600" fill={fv("var(--text)")}>Für dieses Quiz sind keine Akzente vorhanden.</text>
                        )}
                        {teile.map(t => {
                          const [ax, ay] = punkt(t.mitte, r + 2), [bx, by] = punkt(t.mitte, r + 14);
                          const tx = t.rechts ? cx + r + 34 : cx - r - 34;
                          return (
                            <g {...tt(`${NAME[t.g]}: antippen blendet die Gruppe aus – lange drücken: Quiz mit diesen Vokabeln`, quizMenue(t.g))} key={t.g} data-kreis-gruppe={t.g} style={{cursor:"pointer"}} onClick={() => umschalten(t.g)}>
                              {teile.length === 1
                                ? <circle cx={cx} cy={cy} r={r} fill={fv(t.farbe)}/>
                                : <path d={pfad(t)} fill={fv(t.farbe)} stroke={fv("var(--flaeche-hell)")} strokeWidth="2"/>}
                              <polyline points={`${ax},${ay} ${bx},${by} ${t.rechts ? tx - 4 : tx + 4},${t.y}`}
                                fill="none" stroke={fv("var(--text3)")} strokeWidth="1"/>
                              <text x={tx} y={t.y - 2} textAnchor={t.rechts ? "start" : "end"} fontSize="13" fontWeight="700"
                                fill={fv(TEXTFARBE[t.g])}>{NAME[t.g]}</text>
                              <text x={tx} y={t.y + 13} textAnchor={t.rechts ? "start" : "end"} fontSize="12"
                                fill={fv("var(--text2)")}>{t.n} · {Math.round(t.n / gesamt * 100)} %</text>
                            </g>
                          );
                        })}
                        {/* Kreismitte: Tap wechselt Übersetzung → Diktat → Akzente */}
                        <g {...tt("Antippen: zwischen Übersetzung, Diktat und Akzenten wechseln")} style={{cursor:"pointer"}} onClick={naechsteArt} data-kreismitte="1">
                          <circle cx={cx} cy={cy} r={36} fill={fv("var(--karte)")} stroke={fv("var(--rahmen)")} strokeWidth="1.5"/>
                          <text x={cx} y={cy + 1} textAnchor="middle" fontSize={artName.length > 8 ? 11 : 13} fontWeight="800" fill={fv("var(--text)")}>{artName}</text>
                          <text x={cx} y={cy + 16} textAnchor="middle" fontSize="13" fill={fv("var(--text3)")}>⇄</text>
                        </g>
                      </svg>
                      )}
                      {/* Legende: alle vorhandenen Gruppen; ausgeblendete blass – antippen blendet ein/aus */}
                      <div style={{display:"flex", justifyContent:"center", flexWrap:"wrap", gap:6, marginTop:4}}>
                        {vorhanden.map(([g, farbe]) => {
                          const an = statistikFilter.has(g);
                          return (
                            <button key={g} onClick={() => umschalten(g)} data-legende={g}
                              {...tt(`${an ? `${NAME[g]} ausblenden` : `${NAME[g]} wieder einblenden`} – lange drücken: Quiz mit diesen Vokabeln`, quizMenue(g))}
                              style={{display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:12, cursor:"pointer",
                                fontFamily:"inherit", fontSize:"0.72rem", fontWeight:600, background:"var(--karte)",
                                border:`1.5px solid ${an ? farbe : "var(--rahmen)"}`, color: an ? TEXTFARBE[g] : "var(--text3)",
                                textDecoration: an ? "none" : "line-through", opacity: an ? 1 : 0.8}}>
                              <span style={{width:8, height:8, borderRadius:"50%", background: an ? farbe : "var(--rahmen)"}}/>
                              {NAME[g]} {gruppenAnzahl[g]}
                            </button>
                          );
                        })}
                      </div>
                      {!keineAkzente && <div style={{display:"flex", justifyContent:"center", alignItems:"center", gap:10, marginTop:6}}>
                        <button className={`typ-btn${alleFilterAktiv ? " aktiv" : ""}`} style={{fontSize:"0.72rem", padding:"3px 12px"}}
                          onClick={() => setStatistikFilter(new Set(['negativ', 'nie', 'arbeit', 'gelernt']))}
                          {...tt("Alle Gruppen einblenden")}>Gesamt {alleVoks.length}</button>
                      </div>}
                    </div>
                  );
                };
                return (
                <div style={{marginBottom:16, borderRadius:12, overflow:"hidden", border:"1px solid var(--rahmen)", position:"relative"}}>
                  {!statistikVollbild && (
                    <button onClick={() => setStatistikVollbild(true)}
                      style={{position:"absolute", top:6, right:8, zIndex:1, background:"none", border:"none", padding:"4px 6px", cursor:"pointer", color:"var(--text2)", display:"flex", alignItems:"center"}}
                      {...tt("Statistik im Vollbild anzeigen")}>
                      <IcoExpand s={18}/>
                    </button>
                  )}
                  {renderKreis()}
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
