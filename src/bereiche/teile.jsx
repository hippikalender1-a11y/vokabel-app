import { BLITZ_MS, TYPEN } from "../speicher.js";
import { fv } from "../farben.js";
import { ABFRAGE_ART_NAMEN, AKZENTE_FUER_LISTE, ART_KURZ, GRUPPE_BALKEN, MODI_REIHENFOLGE, QUIZ_ARTEN, STANDARD_ANTWORT_MODUS, hatAkzentWort, istRunde, lernProzent, mitHinweis, modiVon, modusErlaubt, scoreSymbole, umbruch } from "../quiz.jsx";
import { AUFTEILEN_GROESSEN, SUCH_SPALTEN, sucheVokabeln } from "../raster.js";
import { MiniKreis } from "../komponenten.jsx";
import { CSS } from "../stil.js";

// Phase 2 (Aufteilung): Zeichen-Funktionen aus App.jsx. app = die Namen der Komponente, die sie brauchen.

export function renderExportArtWahl(app, ids, aktuell) {
  const { exportWas, oeffneExport, tt } = app;
    return (<>
      <p data-export-was style={{fontSize:"0.85rem", color:"var(--text2)", marginBottom:10}}>{exportWas(ids)}</p>
      <div className="toggle-btn" data-export-art-wahl style={{display:"flex", marginBottom:14}}>
        {[["json", "JSON", "Komplette Sicherung mit Lernstand (Scores) – zum Wiederherstellen oder für ein anderes Gerät"],
          ["txt", "TXT", "Nur die Vokabeln als Text, ohne Scores – zum Weitergeben oder Bearbeiten"],
          ["kopieren", "Kopieren", "Vokabeln als Text in die Zwischenablage, ohne Datei"]].map(([a, label, info]) => (
          <button key={a} data-export-art={a} className={`toggle-opt${aktuell === a ? " aktiv" : ""}`} style={{flex:1}}
            onClick={() => { if (a !== aktuell) oeffneExport(ids, a); }} {...tt(info)}>{label}</button>
        ))}
      </div>
    </>);
  }

// Dialog „Vokabel bearbeiten / Neue Vokabel / Richtige Antwort bearbeiten“ – im Haupt-Bildschirm und über der Abfrage
export function renderVokabelEditor(app) {
  const { aktiveListeId, bearbeiteEingaben, bearbeiteFalsch, bearbeiteListe, bearbeiteNur, bearbeiteVokabel, modal, modalFehler, quiz, schliesseVokabelBearbeiten, setBearbeiteEingaben, setModalFehler, speichereVokabelBearbeitung, tt, ttFeld } = app;
    if (modal !== "vokabel-bearbeiten" || !bearbeiteVokabel || !bearbeiteListe) return null;
    const l = bearbeiteListe, nur = bearbeiteNur, falsch = bearbeiteFalsch;
    const spalten = nur ? [nur] : TYPEN.filter(t => l.spalten[t].aktiv);
    const name = t => l.spalten[t]?.name || t;
    // Abfrage: was wird bearbeitet (Frage, richtige Antwort, Info oder eine falsche Antwort)
    const art = !nur ? null : falsch != null ? "falsch" : nur.startsWith('i') ? "info"
      : quiz && quiz.modus !== "diktat" && nur === quiz.frageTyp ? "frage" : "antwort";
    const titel = { frage: "Frage bearbeiten", antwort: "Richtige Antwort bearbeiten", falsch: "Falsche Antwort bearbeiten", info: `${nur && name(nur)} bearbeiten` };
    const zusatz = { frage: " – Frage", antwort: " – richtige Antwort", falsch: " – falsche Antwort", info: "" };
    // Abfrage: zur Orientierung die anderen Spalten der Vokabel (nur lesen); bei falscher Antwort auch die richtige
    const kontext = nur ? TYPEN.filter(t => (t !== nur || art === "falsch") && !t.startsWith('i') && l.spalten[t].aktiv && bearbeiteVokabel[t]?.wert) : [];
    return (
      <div className="overlay" onClick={schliesseVokabelBearbeiten}>
        <div className="modal" data-vokabel-editor={nur ? art : bearbeiteVokabel.neu ? "neu" : "voll"} onClick={e => e.stopPropagation()}>
          <div className="modal-titel">{nur ? titel[art] : bearbeiteVokabel.neu ? "Neue Vokabel" : "Vokabel bearbeiten"}</div>
          {(l.id !== aktiveListeId || nur) && <div style={{fontSize:"0.8rem", color:"var(--text2)", margin:"-6px 0 12px"}}>in „{l.name}“</div>}
          {kontext.map(t => (
            <div key={t} style={{fontSize:"0.85rem", color:"var(--text2)", marginBottom:6}}>{name(t)}: <b style={{color:"var(--text-stark)"}}>{bearbeiteVokabel[t].wert}</b></div>
          ))}
          {spalten.map((typ, i) => (
            <div key={typ} style={{marginBottom:12}}>
              <label className="inp-label">
                {name(typ)}
                {nur ? <span style={{fontWeight:400}}>{zusatz[art]}</span> : !typ.startsWith('i') && <span style={{fontWeight:400}}> (|| falsche Antworten)</span>}
              </label>
              {art === "info" ? (
                <textarea {...ttFeld("Zusatzinfo ändern – leer lassen entfernt sie")} className="inp" data-vokabel-feld={typ} rows={4}
                  value={bearbeiteEingaben[typ] || ''} autoFocus style={{resize:"vertical", fontFamily:"inherit"}}
                  onChange={e => { setBearbeiteEingaben(prev => ({...prev, [typ]: e.target.value})); setModalFehler(""); }} />
              ) : (
              <input {...ttFeld(art === "falsch" ? "Falsche Antwort ändern – leer lassen entfernt sie" : nur ? "Nur diesen Wert ändern – falsche Antworten bleiben unverändert" : "Inhalt dieser Spalte bearbeiten")} className="inp" data-vokabel-feld={typ}
                value={bearbeiteEingaben[typ] || ''} autoFocus={i === 0}
                onChange={e => { setBearbeiteEingaben(prev => ({...prev, [typ]: e.target.value})); setModalFehler(""); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); speichereVokabelBearbeitung(); } }}
              />
              )}
            </div>
          ))}
          {modalFehler && <div className="fehler">{modalFehler}</div>}
          <div className="modal-actions">
            <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={schliesseVokabelBearbeiten}>Abbrechen</button>
            <button {...tt(bearbeiteVokabel.neu ? "Neue Vokabel am Ende der Liste anlegen" : "Änderungen an der Vokabel speichern")} className="btn btn-primary" data-vokabel-speichern
              onClick={speichereVokabelBearbeitung}>{bearbeiteVokabel.neu ? "Anlegen" : "Speichern"}</button>
          </div>
        </div>
      </div>
    );
  }

// Rundenergebnis im Kasten: Kreisdiagramm richtig/falsch, Zahlen daneben, Lern-Bilanz darunter
export function renderRundenErgebnis(app, q, r, f, titel) {
  const { renderLernBilanz, tt } = app;
    const ges = r + f;
    const pct = ges > 0 ? Math.round(r / ges * 100) : 0;
    const farbe = pct >= 70 ? "var(--haupt)" : pct >= 40 ? "var(--orange)" : "var(--falsch)";
    const R = 40, U = 2 * Math.PI * R;
    return (
      <div className="karte" style={{padding:"14px 16px", margin:"0 0 14px"}}>
        <div style={{fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", color:"var(--text2)", marginBottom:10}}>{titel}</div>
        <div style={{display:"flex", alignItems:"center", gap:18, justifyContent:"center"}}>
          <svg width="112" height="112" viewBox="0 0 112 112" data-ergebniskreis {...tt(`${r} richtig, ${f} falsch`)}>
            <circle cx="56" cy="56" r={R} fill="none" stroke={fv(f > 0 ? "var(--falsch-zart)" : "var(--flaeche)")} strokeWidth="16"/>
            {r > 0 && <circle cx="56" cy="56" r={R} fill="none" stroke={fv("var(--haupt)")} strokeWidth="16"
              strokeDasharray={`${U * r / ges} ${U}`} transform="rotate(-90 56 56)"/>}
            <text x="56" y="62" textAnchor="middle" fontSize="20" fontWeight="800" fill={fv(farbe)}>{pct}%</text>
          </svg>
          <div style={{lineHeight:1.6}}>
            <div style={{fontWeight:700, fontSize:"1rem", color:"var(--text)"}}>{r} von {ges} richtig</div>
            <div style={{fontSize:"0.85rem", color:"var(--haupt)"}}>✓ {r} gewusst</div>
            <div style={{fontSize:"0.85rem", color:"var(--falsch)"}}>✗ {f} nicht gewusst</div>
          </div>
        </div>
        {renderLernBilanz(q)}
      </div>
    );
  }

export function renderKopfFortschritt(app, q) {
  const { sessionStandImQuiz, tt } = app;
    const { erledigt, gesamt } = sessionStandImQuiz(q);
    const pct = gesamt ? Math.min(100, erledigt / gesamt * 100) : 0;
    return (
      <span className="kopf-balken" data-kopf-fortschritt={`${erledigt}/${gesamt}`} {...tt(`Fortschritt des Quiz: ${erledigt} von ${gesamt} Vokabeln abgefragt`)}>
        <span style={{width:`${pct}%`}}/>
      </span>
    );
  }

export function renderSessionAuswertung(app, d) {
  const { einstellungen, ttFeld } = app;
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    const gruppe = sc => sc == null ? "nie" : sc < 0 ? "negativ" : schwelle > 0 && sc >= schwelle ? "gelernt" : "arbeit";
    const zaehle = werte => { const z = { gelernt: 0, arbeit: 0, nie: 0, negativ: 0 }; werte.forEach(sc => z[gruppe(sc)]++); return z; };
    const vorher = d.ids.map(id => d.start[id]), nachher = d.ids.map(id => d.jetzt[id]);
    const zv = zaehle(vorher), zn = zaehle(nachher), n = d.ids.length;
    const pV = lernProzent(vorher, schwelle), pN = lernProzent(nachher, schwelle);
    const neuGelernt = schwelle > 0 ? d.ids.filter(id => (d.start[id] ?? -Infinity) < schwelle && (d.jetzt[id] ?? -Infinity) >= schwelle).length : 0;
    const schnitt = w => { const x = w.filter(sc => sc != null); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null; };
    const sV = schnitt(vorher), sN = schnitt(nachher);
    const fmt = x => x == null ? "–" : `${x > 0 ? "+" : ""}${x.toFixed(1)}`;
    let besser = 0, gleich = 0, schlechter = 0;
    d.ids.forEach(id => { const a = d.start[id] ?? 0, b = d.jetzt[id] ?? 0; if (b > a) besser++; else if (b < a) schlechter++; else gleich++; });
    const erstIds = d.erst ? d.ids.filter(id => id in d.erst) : [];
    const anhieb = erstIds.filter(id => d.erst[id] === "richtig").length;
    const dauer = d.startZeit ? Date.now() - d.startZeit : null;
    const dauerText = dauer == null ? null : dauer < 60000 ? "unter 1 Minute" : dauer < 3600000 ? `${Math.round(dauer / 60000)} Minuten`
      : dauer < 86400000 ? `${Math.floor(dauer / 3600000)} Std. ${Math.round((dauer % 3600000) / 60000)} Min.` : `${Math.round(dauer / 86400000)} Tage`;
    const NAMEN = { gelernt: "Gelernt", arbeit: "In Arbeit", nie: "Nie abgefragt", negativ: "Negativ" };
    const balken = (titel, z) => (
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:8}} data-balken={titel}>
        <span style={{width:40, fontSize:"0.78rem", fontWeight:700, color:"var(--text2)"}}>{titel}</span>
        <div style={{flex:1, display:"flex", height:26, borderRadius:8, overflow:"hidden", background:"var(--flaeche)"}}>
          {GRUPPE_BALKEN.map(([g, farbe]) => z[g] > 0 && (
            <div key={g} data-segment={g} style={{width:`${z[g] / Math.max(1, n) * 100}%`, background:farbe, display:"flex", alignItems:"center", justifyContent:"center",
              color: g === "gelernt" || g === "negativ" ? "var(--auf-haupt)" : "var(--text)", fontSize:"0.75rem", fontWeight:700, overflow:"hidden"}}
              {...ttFeld(`${titel}: ${NAMEN[g]} ${z[g]}`)}>{z[g] / Math.max(1, n) >= 0.08 ? z[g] : ""}</div>
          ))}
        </div>
      </div>
    );
    const zeile = (k, v) => (
      <div style={{display:"flex", justifyContent:"space-between", gap:10, padding:"5px 0", borderBottom:"1px solid var(--flaeche)"}}>
        <span>{k}</span><span style={{fontWeight:600, color:"var(--text)"}}>{v}</span>
      </div>
    );
    return (
      <div data-session-auswertung>
        <div className="karte" style={{padding:"14px 16px", margin:"8px 0 14px"}}>
          <div style={{fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", color:"var(--text2)", marginBottom:12}}>
            {d.mitSession ? "Ganzes Quiz" : "Diese Runde"} · {d.ohneAkzent != null ? `${n} ${n === 1 ? "Wort" : "Wörter"} mit Akzent` : `${n} Vokabel${n !== 1 ? "n" : ""}`}
          </div>
          {balken("Start", zv)}
          {balken("Ende", zn)}
          <div style={{display:"flex", flexWrap:"wrap", gap:"4px 12px", marginTop:6, fontSize:"0.72rem", color:"var(--text2)"}}>
            {GRUPPE_BALKEN.map(([g, farbe]) => (
              <span key={g} style={{display:"inline-flex", alignItems:"center", gap:4}}>
                <span style={{width:10, height:10, borderRadius:3, background:farbe, display:"inline-block"}}/>{NAMEN[g]} {zv[g]} → {zn[g]}
              </span>
            ))}
          </div>
        </div>
        <div style={{display:"flex", gap:10, marginBottom:14}}>
          <div className="karte" style={{flex:1, padding:"12px 14px", margin:0, textAlign:"center"}} data-kennzahl="lernfortschritt">
            <div style={{fontSize:"0.72rem", color:"var(--text2)", fontWeight:600}}>Lernfortschritt</div>
            <div style={{fontSize:"1.25rem", fontWeight:800, color:"var(--haupt)", marginTop:2}}>{Math.round(pV)} % → {Math.round(pN)} %</div>
            <div style={{fontSize:"0.78rem", color: pN - pV >= 0 ? "var(--haupt)" : "var(--falsch)", fontWeight:700}}>{pN - pV >= 0 ? "+" : ""}{Math.round(pN - pV)} %</div>
          </div>
          <div className="karte" style={{flex:1, padding:"12px 14px", margin:0, textAlign:"center"}} data-kennzahl="neu-gelernt">
            <div style={{fontSize:"0.72rem", color:"var(--text2)", fontWeight:600}}>Neu gelernt</div>
            <div style={{fontSize:"1.25rem", fontWeight:800, color:"var(--haupt)", marginTop:2}}>{neuGelernt}</div>
            <div style={{fontSize:"0.72rem", color:"var(--text3)"}}>Score +{schwelle} erreicht</div>
          </div>
        </div>
        <div data-zusatzdaten style={{fontSize:"0.8rem", color:"var(--text3)", margin:"0 2px 18px"}}>
          {zeile(d.ohneAkzent != null ? "Wörter mit Akzent" : "Vokabeln", d.pakete ? `${n} in ${d.pakete} Paket${d.pakete !== 1 ? "en" : ""}` : n)}
          {d.ohneAkzent > 0 && zeile("Dazu geübt ohne Akzent", `${d.ohneAkzent} (zählen nicht mit)`)}
          {zeile("Ø Score", `${fmt(sV)} → ${fmt(sN)}`)}
          {zeile("Verbessert · gleich · verschlechtert", `${besser} · ${gleich} · ${schlechter}`)}
          {erstIds.length > 0 && zeile("Auf Anhieb gewusst", `${anhieb} von ${erstIds.length} (${Math.round(anhieb / erstIds.length * 100)} %)`)}
          {dauerText && zeile("Dauer", dauerText)}
        </div>
      </div>
    );
  }

// Lern-Bilanz am Rundenende: neu gelernte Vokabeln (Gelernt-Schwelle erreicht) bzw. Gratulation
export function renderLernBilanz(app, q) {
  const { einstellungen, tt } = app;
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    if (schwelle <= 0 || !q?.rundeStartScores || !q.gruppeVokIds?.length) return null;
    const start = q.rundeStartScores;
    const jetztMap = new Map(q.liste.vokabeln.map(v => [v.id, v[q.scoreFeld || "fortschritt"]?.score ?? null]));
    const vokMap = new Map(q.liste.vokabeln.map(v => [v.id, v]));
    const ids = q.scoreFeld === "akzentFortschritt" ? q.gruppeVokIds.filter(id => hatAkzentWort(vokMap.get(id))) : q.gruppeVokIds;
    const vorher = ids.map(id => id in start ? start[id] : jetztMap.get(id));
    const nachher = ids.map(id => jetztMap.get(id));
    const vorherP = lernProzent(vorher, schwelle), nachherP = lernProzent(nachher, schwelle);
    const neuGelernt = ids.filter(id => id in start && (start[id] ?? -Infinity) < schwelle && (jetztMap.get(id) ?? -Infinity) >= schwelle).length;
    const komplett = nachherP >= 99.999 && vorherP < 99.999;
    if (!komplett && neuGelernt === 0) return null;
    return (
      <div style={{border:"1.5px solid var(--haupt-zart)", background: komplett ? "var(--haupt-flaeche)" : "var(--haupt-flaeche)", borderRadius:12, padding:"10px 14px", marginTop:12, textAlign:"center"}}>
        {komplett && (<>
          <div style={{fontSize:"2rem", lineHeight:1.2}}>🏆</div>
          <div style={{fontWeight:800, color:"var(--haupt)", fontSize:"1rem", marginBottom:4}}>Geschafft! Alle {ids.length} Vokabeln gelernt.</div>
        </>)}
        {neuGelernt > 0 && (
          <div style={{fontWeight:700, color:"var(--haupt)", fontSize:"0.95rem"}}
            {...tt(`Diese Vokabeln haben in dieser Runde den Score +${schwelle} erreicht und gelten jetzt als gelernt`)}>
            ✓ +{neuGelernt} neu gelernt <span style={{fontWeight:400, fontSize:"0.8rem", color:"var(--text2)"}}>(Score +{schwelle} erreicht)</span>
          </div>
        )}
      </div>
    );
  }

export function renderSuchleiste(app, art, voks, such, setSuch, top) {
  const { springeZuTreffer, suchInfo, tt, ttFeld } = app;
    const { treffer, nr } = suchInfo(voks, such);
    const n = treffer.length;
    const springe = k => { if (!n) return; const z = (k + n) % n; setSuch(x => ({ ...x, nr: z })); springeZuTreffer(art, treffer[z].id); };
    const knopf = {fontSize:"0.8rem", padding:"4px 9px", flexShrink:0};
    return (
      <div data-suchleiste={art} data-auswahl-durchlass style={{position:"sticky", top, zIndex:6, display:"flex", alignItems:"center", gap:5, padding:"8px 10px",
        background:"var(--karte)", borderBottom:"1px solid var(--rahmen)", borderRadius:"inherit"}}>
        <input data-such-feld className="inp" type="text" enterKeyHint="search" placeholder="🔍 Vokabel suchen…" value={such.text}
          style={{flex:1, minWidth:0, padding:"6px 10px"}}
          onChange={e => {
            const text = e.target.value;
            setSuch(x => ({ ...x, text, nr: 0 }));
            const erster = sucheVokabeln(voks, text)[0];
            if (erster) springeZuTreffer(art, erster.id);
          }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); springe(nr + 1); } }}
          {...ttFeld("Suche in Fremdsprache und Deutsch: enthält den Text, Groß/klein und Akzente egal – Treffer am Wortanfang zuerst")}/>
        {such.text && (<>
          <span data-such-anzahl={n} style={{fontSize:"0.75rem", color: n ? "var(--text2)" : "var(--falsch)", whiteSpace:"nowrap", flexShrink:0}}>{n ? `${nr + 1}/${n}` : "0"}</span>
          <button className="typ-btn" data-such-zurueck style={knopf} disabled={!n} onClick={() => springe(nr - 1)} {...tt("Voriger Treffer")}>‹</button>
          <button className="typ-btn" data-such-weiter style={knopf} disabled={!n} onClick={() => springe(nr + 1)} {...tt("Nächster Treffer")}>›</button>
          <button className="typ-btn" data-such-leeren style={knopf} onClick={() => setSuch(x => ({ ...x, text: "", nr: 0 }))} {...tt("Suche leeren")}>✕</button>
        </>)}
        <button className={`typ-btn${such.nurTreffer ? " aktiv" : ""}`} data-nur-treffer style={{...knopf, fontSize:"0.72rem"}}
          onClick={() => setSuch(x => ({ ...x, nurTreffer: !x.nurTreffer }))}
          {...tt(such.nurTreffer ? "Wieder alle Vokabeln zeigen" : "Nur die Treffer zeigen (Von–Bis wählt trotzdem den ganzen Bereich dazwischen)")}>nur Treffer</button>
      </div>
    );
  }

// Kasten „In mehrere Quiz aufteilen“ im Quiz-Tab: Name, Gruppengröße, Bereich, Rest, Vorschau
export function renderAufteilenKasten(app) {
  const { aufteilen, aufteilenStand, aufteilenSuche, setAufteilen, setAufteilenSuche, tt, ttFeld } = app;
    const stand = aufteilenStand();
    if (!stand) return null;
    const upd = patch => setAufteilen(a => ({ ...a, ...patch }));
    const zahl = (v, min, max) => { const n = parseInt(v, 10); return isNaN(n) ? "" : Math.max(min, Math.min(max, n)); };
    const { gruppen, anzahl } = stand;
    const rest = (aufteilen.bis || anzahl) - (aufteilen.von || 1) + 1;
    const hatRest = rest > aufteilen.groesse && rest % aufteilen.groesse !== 0;
    const vorschau = gruppen.length > 6 ? [...gruppen.slice(0, 3), null, ...gruppen.slice(-2)] : gruppen;
    const zeile = {display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:10};
    const label = {fontSize:"0.78rem", color:"var(--text2)", minWidth:84};
    return (
      <div data-aufteilen style={{background:"var(--gelb-flaeche)", border:"1.5px solid var(--gelb-zart)", borderRadius:12, padding:"12px 14px", margin:"12px 0 4px"}}>
        <div style={{fontWeight:700, color:"var(--gelb-dunkel)", marginBottom:12}} {...tt("Unten wie gewohnt Spalten, Abfrage-Modus, Reihenfolge und Einstellungen wählen – sie gelten für alle Quiz")}>„{stand.liste.name}“ in mehrere Quiz aufteilen</div>
        <div style={zeile}>
          <span style={label}>Name</span>
          <input {...ttFeld("Name der Quiz – die Nummern „(von - bis)“ werden angehängt")} data-aufteilen-name className="inp"
            style={{flex:1, minWidth:140, padding:"6px 10px"}} value={aufteilen.name} onChange={e => upd({ name: e.target.value })}/>
        </div>
        <div style={zeile}>
          <span style={label}>Gruppengröße</span>
          {AUFTEILEN_GROESSEN.map(n => (
            <button key={n} data-aufteilen-groesse={n} className={`toggle-opt${aufteilen.groesse === n ? " aktiv" : ""}`}
              style={{padding:"4px 9px", border:"1.5px solid var(--rahmen)", borderRadius:8}}
              onClick={() => upd({ groesse: n })} {...tt(`Je ${n} Vokabeln pro Quiz`)}>{n}</button>
          ))}
          <input {...ttFeld("Eigene Gruppengröße")} data-aufteilen-eigene className="inp" type="number" min={1} max={anzahl}
            style={{width:70, padding:"5px 8px"}} placeholder="eigene"
            value={AUFTEILEN_GROESSEN.includes(aufteilen.groesse) ? "" : aufteilen.groesse}
            onChange={e => { const n = zahl(e.target.value, 1, anzahl); if (n !== "") upd({ groesse: n }); }}/>
        </div>
        <div style={{...zeile, marginBottom:4}}>
          <span style={label}>Bereich (Nr.)</span>
          <input {...ttFeld("Erste Vokabel-Nummer der Liste, ab der aufgeteilt wird")} data-aufteilen-von className="inp" type="number" min={1} max={anzahl}
            style={{width:60, padding:"5px 6px"}} value={aufteilen.von} onChange={e => upd({ von: zahl(e.target.value, 1, anzahl) })}/>
          <button className={`typ-btn${aufteilenSuche?.feld === "von" ? " aktiv" : ""}`} data-aufteilen-suche="von" style={{padding:"4px 6px"}}
            onClick={() => setAufteilenSuche(x => x?.feld === "von" ? null : { feld: "von", text: "" })} {...tt("Anfang suchen: Vokabel suchen und antippen")}>🔍</button>
          <span style={{fontSize:"0.8rem", color:"var(--text2)"}}>bis</span>
          <input {...ttFeld("Letzte Vokabel-Nummer, bis zu der aufgeteilt wird")} data-aufteilen-bis className="inp" type="number" min={1} max={anzahl}
            style={{width:60, padding:"5px 6px"}} value={aufteilen.bis} onChange={e => upd({ bis: zahl(e.target.value, 1, anzahl) })}/>
          <button className={`typ-btn${aufteilenSuche?.feld === "bis" ? " aktiv" : ""}`} data-aufteilen-suche="bis" style={{padding:"4px 6px"}}
            onClick={() => setAufteilenSuche(x => x?.feld === "bis" ? null : { feld: "bis", text: "" })} {...tt("Ende suchen: Vokabel suchen und antippen")}>🔍</button>
          <span style={{fontSize:"0.75rem", color:"var(--text3)"}}>von {anzahl}</span>
        </div>
        {(() => {
          // Anfang und Ende als Wort (Fremdsprache · Deutsch)
          const wort = nr => { const v = stand.liste.vokabeln[nr - 1]; if (!v) return "–";
            const e = SUCH_SPALTEN.filter(t => t.startsWith("E")).map(t => v[t]?.wert).find(Boolean); const d = SUCH_SPALTEN.filter(t => t.startsWith("D")).map(t => v[t]?.wert).find(Boolean);
            return [e, d].filter(Boolean).join(" – "); };
          const von = aufteilen.von || 1, bis = aufteilen.bis || anzahl;
          return (
            <div data-aufteilen-woerter style={{fontSize:"0.75rem", color:"var(--text2)", margin:"0 0 10px 90px", lineHeight:1.5}}>
              <div data-aufteilen-wort="von">Anfang: Nr. {von} · {wort(von)}</div>
              <div data-aufteilen-wort="bis">Ende: Nr. {bis} · {wort(bis)}</div>
            </div>
          );
        })()}
        {aufteilenSuche && (() => {
          const voks = stand.liste.vokabeln;
          const treffer = sucheVokabeln(voks, aufteilenSuche.text);
          const anzeige = treffer.slice(0, 40);
          const e1 = SUCH_SPALTEN.filter(t => t.startsWith("E")), d1 = SUCH_SPALTEN.filter(t => t.startsWith("D"));
          return (
            <div data-aufteilen-suchfeld={aufteilenSuche.feld} style={{background:"var(--karte)", border:"1px solid var(--rahmen)", borderRadius:10, padding:8, marginBottom:10}}>
              <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:6}}>
                <input data-such-feld className="inp" type="text" enterKeyHint="search" autoFocus placeholder={aufteilenSuche.feld === "von" ? "🔍 Anfang suchen…" : "🔍 Ende suchen…"}
                  style={{flex:1, minWidth:0, padding:"6px 10px"}} value={aufteilenSuche.text}
                  onChange={e => setAufteilenSuche(x => ({ ...x, text: e.target.value }))}
                  {...ttFeld("Suche in Fremdsprache und Deutsch: enthält den Text, Groß/klein und Akzente egal")}/>
                <button className="typ-btn" style={{padding:"4px 9px"}} onClick={() => setAufteilenSuche(null)} {...tt("Suche schließen")}>✕</button>
              </div>
              {aufteilenSuche.text.trim() && (
                <div style={{maxHeight:240, overflowY:"auto"}}>
                  {anzeige.length === 0 && <div style={{fontSize:"0.8rem", color:"var(--text3)", padding:"4px 6px"}}>Keine Treffer</div>}
                  {anzeige.map(t => {
                    const v = voks[t.i];
                    return (
                      <div key={t.id} data-aufteilen-treffer={t.i + 1} className="vok-zeile" style={{cursor:"pointer"}}
                        onClick={() => { upd({ [aufteilenSuche.feld]: t.i + 1 }); setAufteilenSuche(null); }}
                        {...tt(`Nr. ${t.i + 1} als ${aufteilenSuche.feld === "von" ? "Anfang" : "Ende"} übernehmen`)}>
                        <span className="vok-nr">{t.i + 1}</span>
                        <span style={{fontSize:"0.86rem", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{e1.map(x => v[x]?.wert).find(Boolean) || ""}</span>
                        <span style={{fontSize:"0.8rem", color:"var(--text2)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"right"}}>{d1.map(x => v[x]?.wert).find(Boolean) || ""}</span>
                      </div>
                    );
                  })}
                  {treffer.length > anzeige.length && <div style={{fontSize:"0.72rem", color:"var(--text3)", padding:"4px 6px"}}>… {treffer.length - anzeige.length} weitere – Suchtext genauer fassen</div>}
                </div>
              )}
            </div>
          );
        })()}
        {hatRest && (
          <div style={zeile}>
            <span style={label}>Rest</span>
            <div className="toggle-btn">
              <button data-aufteilen-rest="eigen" className={`toggle-opt${!aufteilen.restAnhaengen ? " aktiv" : ""}`} onClick={() => upd({ restAnhaengen: false })}
                {...tt("Übrige Vokabeln als eigenes, kleineres Quiz")}>eigene Gruppe</button>
              <button data-aufteilen-rest="anhaengen" className={`toggle-opt${aufteilen.restAnhaengen ? " aktiv" : ""}`} onClick={() => upd({ restAnhaengen: true })}
                {...tt("Übrige Vokabeln an das letzte Quiz anhängen")}>an letzte anhängen</button>
            </div>
          </div>
        )}
        <label style={{display:"flex", alignItems:"center", gap:8, fontSize:"0.82rem", color:"var(--text)", margin:"2px 0 10px", cursor:"pointer"}}
          {...ttFeld("Die neuen Quiz in einer Gruppe (Ordner) mit diesem Namen ablegen")}>
          <input type="checkbox" data-aufteilen-gruppe checked={aufteilen.gruppe !== false} onChange={e => upd({ gruppe: e.target.checked })} style={{width:18, height:18}}/>
          📁 In Gruppe „{(aufteilen.name || "").trim() || stand.liste.name}“ zusammenfassen
        </label>
        <div style={{fontSize:"0.78rem", color:"var(--text2)", marginBottom:4}}>Vorschau: {gruppen.length} Quiz</div>
        <div data-aufteilen-vorschau style={{display:"flex", flexWrap:"wrap", gap:5}}>
          {vorschau.map((g, i) => g ? (
            <span key={i} className="slot-chip belegt" style={{fontSize:"0.72rem", padding:"3px 9px", cursor:"default", ...(g.vorhanden ? {opacity:0.5, textDecoration:"line-through"} : {})}}
              {...tt(g.vorhanden ? "Gibt es schon – wird übersprungen" : `Vokabeln Nr. ${g.von} bis ${g.bis}`)}>{g.name}</span>
          ) : <span key={i} style={{fontSize:"0.8rem", color:"var(--text3)", alignSelf:"center"}}>…</span>)}
        </div>
        {gruppen.some(g => g.vorhanden) && (
          <div style={{fontSize:"0.72rem", color:"var(--text3)", marginTop:6}}>Durchgestrichen: gibt es schon, wird nicht doppelt angelegt.</div>
        )}
      </div>
    );
  }

// Antwortarten einer Spalte: antippen wechselt sofort (die angetippte Art ersetzt die bisherigen); lang drücken › „☑ Mehrere wählen“:
// dann schaltet antippen dazu/weg, mehrere → je Frage eine nach der Gewichtung; „Bestätigen“ im Zeilen-Knopf beendet die Mehrfach-Auswahl.
// Akzente: Zusatz, der dazu- bzw. weggeschaltet wird; nur bei Fremdsprachen-Spalten und eingeschalteten Akzenten; mindestens eine Art außer Akzente bleibt an
export function renderModusKnoepfe(app, typ) {
  const { artenMehrfach, blitzt, einstellungen, leuchte, quizAntwortTypenGeordnet, quizAusgewaehlt, quizModus, quizSpalteModus, quizTabListen, setAntwortMehrfach, setArtenMehrfach, setQuizDiktatSpalte, setQuizSpalteModus, speichereEinst, tt, wechsleQuizArt } = app;
    const aktiv = modiVon(quizSpalteModus[typ]);
    const mehrfach = !!artenMehrfach;
    const akzentMoeglich = typ.startsWith("E") && quizTabListen.some(id => AKZENTE_FUER_LISTE(id));
    const spalten = quizModus === "rotierend" ? (quizAusgewaehlt.length ? quizAusgewaehlt : [typ]) : quizAntwortTypenGeordnet.length ? quizAntwortTypenGeordnet : [typ];
    const waehle = m => {
      if (m === "akzent") { umschalten(m); return; }
      const ohneAkz = aktiv.filter(x => x !== "akzent");
      if (ohneAkz.length === 1 && ohneAkz[0] === m) return;
      leuchte(`art:${typ}:${m}`, BLITZ_MS / 2);
      setQuizSpalteModus(p => {
        const neu = { ...p };
        // Runden (Zuordnung, Memory) gelten für alle Spalten
        if (istRunde(m)) { spalten.forEach(t => { neu[t] = m; }); return neu; }
        spalten.forEach(t => {
          if (t === typ) return;
          const alt = modiVon(p[t]), r = alt.filter(x => !istRunde(x));
          if (r.length !== alt.length) neu[t] = !r.some(x => x !== "akzent") ? STANDARD_ANTWORT_MODUS : r.length === 1 ? r[0] : r;
        });
        const liste = MODI_REIHENFOLGE.filter(x => x === m || (x === "akzent" && modiVon(p[typ]).includes("akzent")));
        neu[typ] = liste.length === 1 ? liste[0] : liste;
        return neu;
      });
    };
    // lang drücken: sofort Mehrfach-Auswahl (alle Spalten) mit dieser Art – jedes weitere Antippen nimmt eine Art dazu bzw. weg
    const mehrfachMit = m => {
      setAntwortMehrfach(false); setArtenMehrfach(true);
      leuchte(`art:${typ}:${m}`, BLITZ_MS / 2);
      setQuizSpalteModus(p => {
        const neu = { ...p };
        const dazu = t2 => { const alt = modiVon(neu[t2]); if (alt.includes(m)) return; const l = MODI_REIHENFOLGE.filter(y => alt.includes(y) || y === m); neu[t2] = l.length === 1 ? l[0] : l; };
        if (istRunde(m)) spalten.forEach(dazu); else dazu(typ);   // Runden (Zuordnung, Memory) gelten für alle Spalten
        return neu;
      });
    };
    const umschalten = m => setQuizSpalteModus(p => {
      if (istRunde(m)) {
        const an = !modiVon(p[typ]).includes(m); const neu = { ...p };
        spalten.forEach(t => { const alt = modiVon(p[t]).filter(x => x !== m);
          const liste = MODI_REIHENFOLGE.filter(x => (an && x === m) || alt.includes(x));
          neu[t] = !liste.length ? STANDARD_ANTWORT_MODUS : liste.length === 1 ? liste[0] : liste; });
        return neu;
      }
      const alt = modiVon(p[typ]);
      const neu = MODI_REIHENFOLGE.filter(x => alt.includes(x) !== (x === m));
      if (!neu.some(x => x !== "akzent")) return p;
      return { ...p, [typ]: neu.length === 1 ? neu[0] : neu };
    });
    const knopf = ([m, label, text]) => (
      <button key={m} {...tt(istRunde(m) || m === "akzent" ? text : `${text} – antippen: nur diese Art; lang drücken: Art dazu bzw. weg (mehrere); je Frage eine davon nach der Gewichtung (Einstellungen › Lernen)`,
          null, { beimLang: () => { if (m === "akzent") return; umschalten(m); leuchte(`art:${typ}:${m}`, BLITZ_MS / 2); } })}
        data-modus-knopf={`${typ}:${m}`}
        className={`spalten-modus-btn${aktiv.includes(m) ? " aktiv" : ""}${blitzt(`art:${typ}:${m}`)}`} onClick={() => waehle(m)}>{label}</button>
    );
    const ARTEN = {
      karte: ["Karte", "Karte aufdecken und selbst bewerten: gewusst / nicht gewusst"],
      mc: ["MC", "Antwort aus mehreren Vorschlägen wählen (Multiple Choice)"],
      tippen: ["Tastatur", "Antwort eintippen"],
      akzent: ["Akzente", "Akzente setzen – nur bei Wörtern mit Akzent, zählt hier für die Übersetzung"],
      hoeren: ["Hören", "Hören und wählen: die fremdsprachige Frage wird nur vorgelesen (antippen: nochmal), die deutsche Antwort aus Vorschlägen wählen"],
      puzzle: ["Puzzle", "Buchstaben-Puzzle: die Antwort aus gemischten Buchstaben in der richtigen Reihenfolge antippen"],
      luecke: ["Lücken", "Lückenwort: fehlende Buchstaben ergänzen – Lücken bevorzugt an typischen Stolperstellen, mehr bei höherem Score"],
      artikel: ["Artikel", "Artikel: das Wort ohne Artikel – le oder la (der/die/das, el/la …) antippen; nur Wörter mit erkennbarem Artikel, sonst eine andere Art"],
      satzfinden: ["Satz finden", "Satz finden: im Beispielsatz das gesuchte Wort antippen (braucht Beispielsätze)"],
      satzbauen: ["Satz bauen", "Satz bauen: die Wörter des Beispielsatzes in die richtige Reihenfolge bringen (braucht Beispielsätze)"],
      lueckensatz: ["Lückensatz", "Lückensatz: das Wort in der passenden Form in den Beispielsatz eintippen (braucht Beispielsätze)"],
      zuordnung: ["Zuordnung", "Zuordnen: Kacheln der Spalten einander zuordnen, mehrere Vokabeln je Runde – gilt für alle Spalten; bei „wechselnd“ steht die Fremdsprache je Zeile zufällig links oder rechts; mit anderen Arten gemischt startet je Ziehung eine Runde"],
      memory: ["Memory", "Memory: verdeckte Karten (Frage und Antwort) aufdecken und Paare finden – mehrere Vokabeln je Runde; gefundene Paare +1, Fehlversuche kosten nichts"],
    };
    const gruppe = ms => ms.filter(m => modusErlaubt(typ, m) && (m !== "akzent" || akzentMoeglich)).map(m => knopf([m, ...ARTEN[m]]));
    // Übersetzung des Beispielsatzes während der Frage (Satz finden / Lückensatz) – einstellbar
    const uebArten = [["satzfinden", "Satz finden", "satzUebFinden", false], ["lueckensatz", "Lückensatz", "satzUebLuecke", true]].filter(([m]) => aktiv.includes(m));
    const ueb = uebArten.length ? (
      <div style={{display:"flex", gap:4, flexWrap:"wrap", alignItems:"center", marginTop:6}} data-satz-ueb-schalter>
        <span style={{fontSize:"0.72rem", color:"var(--text2)", marginRight:2}}>Übersetzung zeigen:</span>
        {uebArten.map(([m, label, k, std]) => { const an = einstellungen[k] ?? std; return (
          <button key={m} data-satz-ueb={m} className={`spalten-modus-btn${an ? " aktiv" : ""}`} onClick={() => speichereEinst({ ...einstellungen, [k]: !an })}
            {...tt(`${label}: deutsche Übersetzung des Satzes während der Frage ${an ? "ausblenden" : "zeigen"}`)}>{an ? "✓ " : ""}{label}</button>); })}
      </div>) : null;
    // Gruppen: Grundarten · Wort-Übungen · Satz-Arten · Runden (leere Gruppen entfallen)
    const zeilen = [
      { key: "grund", knoepfe: [...gruppe(["karte", "mc", "tippen"]),
        ...(typ.startsWith("E") ? [<button key="diktat" data-modus-knopf={`${typ}:diktat`} className="spalten-modus-btn"
          onClick={() => { leuchte(`art:${typ}:diktat`, BLITZ_MS / 2); wechsleQuizArt("diktat"); setQuizDiktatSpalte(typ); }}
          {...tt("Diktat: das Wort wird vorgelesen, du schreibst, was du hörst – eigener Diktat-Score (Statistik)")}>Diktat</button>] : []),
        ...gruppe(["akzent"])] },
      { key: "wort", knoepfe: gruppe(["hoeren", "puzzle", "luecke", "artikel"]) },
      { key: "satz", knoepfe: gruppe(["satzfinden", "satzbauen", "lueckensatz"]), extra: ueb },
      { key: "runde", knoepfe: gruppe(["zuordnung", "memory"]) },
    ].filter(z => z.knoepfe.length);
    return (
      <div data-modus-gruppen className={mehrfach ? "mehrfach" : undefined} data-mehrfach={mehrfach ? "" : undefined}>
        {zeilen.map((z, i) => (
          <div key={z.key} data-modus-gruppe={z.key} style={{marginTop: i ? 14 : 0}}>
            <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>{z.knoepfe}</div>
            {z.extra}
          </div>
        ))}
      </div>
    );
  }

// Mini-Kreise Ü D A (zum Anzeigen; mit beiKlick zum Umschalten)
export function renderMiniKreise(app, ls, { aktiv = null, beiKlick = null, groesse = 24, aufGruen = false, attr = "data-mini-kreis", nurVerfuegbar = false } = {}) {
  const { ttFeld } = app;
    return QUIZ_ARTEN.filter(a => !nurVerfuegbar || !ls[a].aus).map(a => {
      const klickbar = beiKlick && !ls[a].aus;
      const text = `${ABFRAGE_ART_NAMEN[a]}: ${ls[a].aus ? "keine passenden Vokabeln" : `${Math.round(ls[a].pct)} % gelernt`}${klickbar ? ` – antippen: ${ABFRAGE_ART_NAMEN[a]}` : ""}`;
      return (
        <span key={a} {...{ [attr]: a }} data-pct={Math.round(ls[a].pct)} className={aktiv === a ? "aktiv" : undefined} {...ttFeld(text)}
          style={{cursor: klickbar ? "pointer" : "default", borderRadius:"50%"}}
          onClick={klickbar ? e => { e.stopPropagation(); beiKlick(a); } : undefined}>
          <MiniKreis pct={ls[a].pct} buchstabe={ART_KURZ[a]} aus={ls[a].aus} aktiv={aktiv === a} groesse={groesse} aufGruen={aufGruen}/>
        </span>
      );
    });
  }

export function renderRueckblick(app) {
  const { farbModusUI, farbRadUI, quiz, tt, umwerten } = app;
    const rb = quiz.rueckblick, i = quiz.rueckIdx, e = rb[i];
    const ja = e.ergebnis === "richtig";
    const vok = quiz.liste.vokabeln.find(v => v.id === e.vokId) || quiz.vokabeln.find(v => v.id === e.vokId);
    const feld = e.art === "diktat" ? "diktatFortschritt" : e.wertung?.normal == null && e.wertung?.akzent != null ? "akzentFortschritt" : "fortschritt";
    const knopf = gewusst => {
      const gewaehlt = gewusst === ja;
      return (
        <button className={`karte-btn ${gewusst ? "karte-btn-ja" : "karte-btn-nein"} rueck-wahl${gewaehlt ? " gewaehlt" : " andere"}`}
          data-rueck-bewertung={gewusst ? "richtig" : "falsch"} data-gewaehlt={gewaehlt ? "ja" : "nein"}
          {...tt(gewaehlt ? "So wurde gewertet" : "Lang drücken: Bewertung nachträglich ändern",
            gewaehlt ? null : [{ label: gewusst ? "✓ Doch gewusst – umwerten" : "✗ Doch nicht gewusst – umwerten", fn: () => umwerten(i) }],
            { langText: `Bewertung nachträglich ändern: ${gewusst ? "gewusst" : "nicht gewusst"}?` })}>
          {gewusst ? "✓ Gewusst" : "✗ Nicht gewusst"}</button>);
    };
    return (
      <>
        <style>{CSS}</style>{farbModusUI}{farbRadUI}
        <div className="app">
          <div className="topbar">
            <span className="topbar-title" data-rueckblick-titel>↩ {i + 1} / {rb.length}</span>
            <span className="quiz-fortschritt">{scoreSymbole(vok?.[feld]?.score)}</span>
          </div>
          <div className="sektion" data-rueckblick={i} style={{minHeight:"70vh"}}>
            <div className="quiz-frage-box rueck-karte" style={{marginBottom:10}}>
              <div className="quiz-label">{e.frage.label}</div>
              <div className="quiz-frage-text" style={{textAlign:"center"}}>{mitHinweis(umbruch(e.frage.wert))}</div>
            </div>
            {e.antworten.map((a, k) => (
              <div key={k} className={`quiz-vorig rueck-karte${a.richtig === false ? " nicht" : ""}`} data-rueck-antwort={a.richtig === false ? "falsch" : "richtig"}>
                <div className="quiz-vorig-label">{a.richtig === false ? "✗ " : "✓ "}{a.label}</div>
                <div style={{textAlign:"center", fontSize:"1rem"}}><strong>{mitHinweis(umbruch(a.wert))}</strong></div>
                {a.eingaben?.length > 0 && <div className="rueck-eingabe" data-rueck-eingabe>Deine Antwort: {a.eingaben.join(" · ")}</div>}
              </div>
            ))}
            <div className="karte-bewertung" style={{marginTop:14}}>{knopf(false)}{knopf(true)}</div>
            {e.umgewertet && <div className="rueck-geaendert" data-rueck-geaendert>↺ nachträglich geändert</div>}
          </div>
        </div>
      </>
    );
  }
