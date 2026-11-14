import { FARB_ROLLEN, FARB_VORLAGEN, TEIL_EIGENSCHAFT, farbenAus, schemaVon } from "../farben.js";

// Phase 2 (Aufteilung): Zeichen-Funktionen aus App.jsx. app = die Namen der Komponente, die sie brauchen.

export function renderFarbschemata(app) {
  const { aendereEigenesSchema, beendeFarbModus, dupliziereSchema, eigeneSchemata, einstZeile, einstellungen, farbModus, farbTab, oeffneFarbRad, schemaBearbeiten, setFarbTab, setModal, setModalFehler, setModalInput, setSchemaBearbeiten, setSchemaMenueId, speichereEinst, starteFarbModus, tt, ttFeld, vorhandeneSprachen, zufallsSchema } = app;
    const aktivId = schemaVon(einstellungen).id;
    const bearb = eigeneSchemata.find(x => x.id === schemaBearbeiten);
    const vorlageVon = sch => FARB_VORLAGEN.find(v => v.id === sch.basis) || FARB_VORLAGEN[0];
    // Tab: zuletzt gewählter, sonst der des aktiven Schemas; beim Bearbeiten „Eigene“
    const ftab = bearb ? "eigene" : farbTab;
    const aktSchema = schemaVon(einstellungen), istVorlage = FARB_VORLAGEN.includes(aktSchema);
    const zufall = eigeneSchemata.find(x => x.zufall && x.name === "Zufall");
    const alle = ftab === "vorlagen" ? FARB_VORLAGEN : ftab === "eigene" ? eigeneSchemata.filter(x => x !== zufall) : [];
    return (<>
      {einstZeile([
        { k: "vorlagen", label: "Vorlagen", text: istVorlage ? aktSchema.name : `${FARB_VORLAGEN.length}`, attrs: { "data-farb-tab": "vorlagen" },
          hilfe: `Fertige Farbschemata (${FARB_VORLAGEN.length}) – antippen verwendet sie; zum Anpassen duplizieren` },
        { k: "eigene", label: "Eigene", text: !istVorlage ? aktSchema.name : `${eigeneSchemata.length}`, attrs: { "data-farb-tab": "eigene" },
          hilfe: `Deine eigenen Schemata (${eigeneSchemata.length}) – bearbeiten, umbenennen, löschen` },
        { k: "sprachen", label: "Sprachen", text: `${Object.keys(einstellungen.sprachFarben || {}).length}`, attrs: { "data-farb-tab": "sprachen" },
          hilfe: "Farben je Sprache: eigenes Schema, sobald der Sprachfilter auf einer Sprache steht bzw. eine Liste dieser Sprache abgefragt wird" },
        { k: "werkzeuge", label: "Werkzeuge", text: "🛠", attrs: { "data-farb-tab": "werkzeuge" }, hilfe: "Farben bearbeiten, Farbmodus" },
      ], ftab, k => { setFarbTab(k); if (bearb && k !== "eigene") setSchemaBearbeiten(null); }, { "data-farb-tabs": true })}
      {ftab && <div className="karte" style={{padding:"12px 14px"}}>
        {ftab === "sprachen" && (() => {
          const sf = einstellungen.sprachFarben || {};
          const setze = neu => speichereEinst({ ...einstellungen, sprachFarben: { ...sf, ...neu }, ...(neu.an ? { farbWechsel: false } : {}) });
          const optionen = [...FARB_VORLAGEN, ...eigeneSchemata];
          return (<div data-sprachfarben>
            <label style={{display:"flex", alignItems:"center", gap:10, fontSize:"0.9rem", fontWeight:600, color:"var(--text)", cursor:"pointer", marginBottom:12}}
              {...ttFeld("Ein: bei jedem Quiz bzw. Paket, am Ende und zurück in der Übersicht ein neues Zufalls-Farbschema – schaltet „Farben je Sprache“ aus")}>
              <input type="checkbox" data-farbwechsel-an checked={!!einstellungen.farbWechsel && !sf.an}
                onChange={e => speichereEinst({ ...einstellungen, farbWechsel: e.target.checked, ...(e.target.checked ? { sprachFarben: { ...sf, an: false } } : {}) })} style={{width:18, height:18}}/>
              Zufallsfarben je Abschnitt
            </label>
            <label style={{display:"flex", alignItems:"center", gap:10, fontSize:"0.9rem", fontWeight:600, color:"var(--text)", cursor:"pointer", marginBottom:12}}
              {...ttFeld("Ein: steht der Sprachfilter (🌐) auf einer Sprache, ist ein Quiz dieser Sprache gewählt oder wird sie abgefragt, gilt ihr Farbschema")}>
              <input type="checkbox" data-sprachfarben-an checked={!!sf.an} onChange={e => setze({ an: e.target.checked })} style={{width:18, height:18}}/>
              Farben je Sprache
            </label>
            <label style={{display:"flex", alignItems:"center", gap:10, fontSize:"0.9rem", fontWeight:600, color:"var(--text)", cursor:"pointer", marginBottom:12, marginLeft:28, opacity: sf.an ? 1 : 0.5}}
              {...ttFeld("Ein: die App behält ihre eigene Farbe, bis die Abfrage läuft – die Auswahl eines Quiz färbt noch nicht um (der Sprachfilter schon)")}>
              <input type="checkbox" data-sprachfarben-quiz checked={!!sf.erstImQuiz} disabled={!sf.an} onChange={e => setze({ erstImQuiz: e.target.checked })} style={{width:18, height:18}}/>
              Erst im Quiz wechseln
            </label>
            {vorhandeneSprachen.length === 0 && <div className="karte-zeile-sub">Noch keine Listen.</div>}
            {vorhandeneSprachen.map(sp => {
              const wert = sf.zuordnung?.[sp.code] ?? `sprache_${sp.code}`;
              const sch = optionen.find(x => x.id === wert);
              return (
                <div key={sp.code} style={{display:"flex", alignItems:"center", gap:8, marginBottom:8, opacity: sf.an ? 1 : 0.5}}>
                  <span style={{minWidth:120, fontSize:"0.88rem"}}>{sp.flagge} {sp.name}</span>
                  <span className="farb-streifen" style={{width:44, height:22, borderRadius:6, flexShrink:0, background: sch ? sch.farben.hintergrund : "var(--flaeche)"}}>
                    {sch ? ["haupt", "start", "karte"].map(r => <span key={r} style={{background: sch.farben[r] || sch.farben.haupt}}/>) : null}
                  </span>
                  <select className="inp" data-sprachfarbe={sp.code} value={sch ? wert : "standard"} style={{flex:1, minWidth:0, padding:"6px 8px"}}
                    onChange={e => setze({ zuordnung: { ...(sf.zuordnung || {}), [sp.code]: e.target.value } })}
                    {...ttFeld(`Farbschema für ${sp.name}`)}>
                    <option value="standard">wie Standard</option>
                    {[["Meine Farben", eigeneSchemata], ["Länder", FARB_VORLAGEN.filter(x => x.id.startsWith("sprache_"))], ["Vorlagen", FARB_VORLAGEN.filter(x => !x.id.startsWith("sprache_"))]]
                      .filter(([, l]) => l.length).map(([titel, l]) => (
                        <optgroup key={titel} label={titel}>{l.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>))}
                  </select>
                </div>
              );
            })}
          </div>);
        })()}
        {(alle.length > 0 || ftab === "eigene") && <div className="farb-raster">
          {ftab === "eigene" && (
            <button data-farbschema-zufall className={`farb-kachel${zufall && aktivId === zufall.id ? " aktiv" : ""}`} onClick={zufallsSchema}
              {...tt("Zufall – antippen: neue zufällige Farben erzeugen und verwenden; zum Behalten lang drücken und duplizieren",
                zufall ? [{ label: "🎨 Bearbeiten", fn: () => { speichereEinst({ ...einstellungen, farbschema: zufall.id }); setSchemaBearbeiten(zufall.id); } },
                          { label: "⧉ Duplizieren", fn: () => dupliziereSchema(zufall) }] : [], { langText: "🎲 Zufall" })}>
              <span className="farb-streifen" style={{background: zufall ? zufall.farben.hintergrund : "var(--flaeche)"}}>
                {zufall ? ["haupt", "haupt-hell", "gelb", "falsch", "karte"].map(r => <span key={r} style={{background: zufall.farben[r]}}/>) : null}
              </span>
              <span className="farb-name">{zufall && aktivId === zufall.id ? "✓ " : ""}🎲 Zufall</span>
            </button>
          )}
          {alle.map(sch => {
            const eigen = !FARB_VORLAGEN.includes(sch);
            const menue = [
              ...(eigen ? [{ label: "🎨 Bearbeiten", fn: () => { speichereEinst({ ...einstellungen, farbschema: sch.id }); setSchemaBearbeiten(sch.id); } }] : []),
              { label: "⧉ Duplizieren", fn: () => dupliziereSchema(sch) },
              ...(eigen ? [
                { label: "✎ Umbenennen", fn: () => { setSchemaMenueId(sch.id); setModalInput(sch.name); setModalFehler(""); setModal("schema-umbenennen"); } },
                { label: "🗑 Löschen", gefahr: true, fn: () => { setSchemaMenueId(sch.id); setModal("schema-loeschen"); } },
              ] : []),
            ];
            return (
              <button key={sch.id} data-farbschema={sch.id} className={`farb-kachel${aktivId === sch.id ? " aktiv" : ""}`}
                onClick={() => { speichereEinst({ ...einstellungen, farbschema: sch.id }); if (schemaBearbeiten && schemaBearbeiten !== sch.id) setSchemaBearbeiten(null); }}
                {...tt(`${sch.name} – antippen: dieses Farbschema verwenden${eigen ? "" : " (Vorlage: zum Anpassen duplizieren)"}`, menue, { langText: sch.name })}>
                <span className="farb-streifen" style={{background: sch.farben.hintergrund}}>
                  {["haupt", "haupt-hell", "gelb", "falsch", "karte"].map(r => <span key={r} style={{background: sch.farben[r]}}/>)}
                </span>
                <span className="farb-name">{aktivId === sch.id ? "✓ " : ""}{sch.name}</span>
              </button>
            );
          })}
        </div>}
        {ftab === "werkzeuge" && (<>
        {!bearb && (
          <button data-farben-bearbeiten className="btn btn-ghost" style={{width:"100%", marginTop:10}}
            onClick={() => { const sch = schemaVon(einstellungen); if (FARB_VORLAGEN.includes(sch)) dupliziereSchema(sch); else setSchemaBearbeiten(sch.id); }}
            {...tt("Alle Farben des gewählten Schemas einzeln einstellen – bei einer Vorlage wird vorher eine Kopie angelegt")}>
            🎨 Farben bearbeiten{FARB_VORLAGEN.includes(schemaVon(einstellungen)) ? " (als Kopie)" : ""}
          </button>
        )}
        <label style={{display:"flex", alignItems:"center", gap:10, marginTop:12, fontSize:"0.85rem", color:"var(--text)", cursor:"pointer"}} {...ttFeld("Jedes Lang-Druck-Menü und jede Erklärung bekommt „🎨 Farbe ändern“ – startet den Farbmodus für genau diese Stelle")}>
          <input type="checkbox" data-farbe-im-menue checked={einstellungen.farbeImMenue !== false} onChange={e => speichereEinst({ ...einstellungen, farbeImMenue: e.target.checked })} style={{width:18, height:18}}/>
          „🎨 Farbe ändern“ im Lang-Druck-Menü
        </label>
        <button data-farbmodus-start className={`btn ${farbModus ? "btn-ghost-filled" : "btn-ghost"}`} style={{width:"100%", marginTop:10}}
          onClick={() => farbModus ? beendeFarbModus() : starteFarbModus()}
          {...tt("Farbmodus: durch die App gehen und per langem Druck auf ein Element dessen Farben ändern – unten rechts übernehmen oder zurücksetzen")}>
          {farbModus ? "🎨 Farbmodus aktiv – beenden" : "🎨 Farbmodus starten"}
        </button>
        </>)}
        {bearb && (
          <div data-schema-editor style={{marginTop:14, borderTop:"1px solid var(--rahmen)", paddingTop:12}}>
            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
              <span style={{flex:1, fontWeight:700, color:"var(--text)"}}>🎨 {bearb.name}</span>
              <button className="btn btn-ghost btn-sm" data-schema-zuruecksetzen onClick={() => aendereEigenesSchema(bearb.id, () => ({ farben: { ...vorlageVon(bearb).farben }, dunkel: !!vorlageVon(bearb).dunkel, elemente: {} }))}
                {...tt(`Alle Farben auf die Vorlage „${vorlageVon(bearb).name}“ zurücksetzen`)}>Zurücksetzen</button>
              <button className="btn btn-primary btn-sm" data-schema-fertig onClick={() => setSchemaBearbeiten(null)} {...tt("Bearbeiten beenden – die Farben sind schon gespeichert")}>Fertig</button>
            </div>
            {FARB_ROLLEN.map(([rolle, name, sub]) => (
              <div key={rolle} className="farb-zeile" data-farbrolle={rolle} onClick={() => oeffneFarbRad(rolle, name, bearb.farben, bearb.id)}
                {...ttFeld(`${name}${sub ? " – " + sub : ""}: antippen, um die Farbe im Farbkreis zu wählen`)}>
                <span className="farb-tupfer" style={{background: bearb.farben[rolle] || farbenAus(bearb.farben)[rolle]}}/>
                <span style={{flex:1}}>
                  <span style={{display:"block", fontSize:"0.85rem", fontWeight:600, color:"var(--text)"}}>{name}</span>
                  {sub && <span style={{display:"block", fontSize:"0.7rem", color:"var(--text3)"}}>{sub}</span>}
                </span>
              </div>
            ))}
            {Object.keys(bearb.elemente || {}).length > 0 && (
              <div data-element-farben style={{margin:"8px 0"}}>
                <div style={{fontSize:"0.75rem", fontWeight:700, color:"var(--text2)", margin:"4px 0"}}>Eigene Element-Farben</div>
                {Object.entries(bearb.elemente).flatMap(([sel, p]) => Object.entries(p).map(([eig, hex]) => (
                  <div key={sel + eig} className="farb-zeile" data-element-farbe={`${sel}|${eig}`}>
                    <span className="farb-tupfer" style={{background: hex}}/>
                    <span style={{flex:1, fontSize:"0.75rem", color:"var(--text)", overflowWrap:"anywhere"}}>{sel} · {Object.keys(TEIL_EIGENSCHAFT).find(k => TEIL_EIGENSCHAFT[k] === eig)}</span>
                    <button className="btn-icon" onClick={() => aendereEigenesSchema(bearb.id, x => { const n = { ...(x.elemente || {}) }; const q = { ...n[sel] }; delete q[eig];
                      if (Object.keys(q).length) n[sel] = q; else delete n[sel]; return { elemente: n }; })}
                      {...tt("Eigene Farbe entfernen – das Element nimmt wieder die Farbe seiner Rolle")}>✕</button>
                  </div>
                )))}
              </div>
            )}
            <label className="farb-zeile" {...ttFeld("Dunkles Schema: Bedienelemente des Systems (Listen, Scrollbalken) dunkel darstellen")}>
              <input type="checkbox" data-schema-dunkel checked={!!bearb.dunkel} onChange={e => aendereEigenesSchema(bearb.id, () => ({ dunkel: e.target.checked }))} style={{width:20, height:20}}/>
              <span style={{fontSize:"0.85rem", fontWeight:600, color:"var(--text)"}}>Dunkles Schema</span>
            </label>
          </div>
        )}
      </div>}
    </>);
  }
