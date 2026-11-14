import { TYPEN, formatTag, leseDateiAlsText } from "../speicher.js";
import { dateiVorschau, findeJsonListen, istBinaer } from "../importexport.js";
import { listeSprache, sprachInfo } from "../sprache.js";

// Phase 2 (Aufteilung): Bereich aus dem Haupt-return von App.jsx (tab === "listen" && ansicht === "import")
// app = Zustände, Setter und Funktionen der Komponente (siehe „const app“ in App.jsx)
export function ImportAnsicht(app) {
  const { bestaetigeWiederherstellen, fileInputRef, fuehreImportDurch, getBestehendZielOptionen, getBestehendeListe, importBestehendId, importDateiname, importFehler, importJsonData, importMapping, importMehrfachListen, importNeuName, importOrdnerWahl, importParsed, importSprache, importText, importZielTyp, importiereAlleListen, importiereAusJsonDaten, renderSprachAuswahl, setImportBestehendId, setImportDateiname, setImportFehler, setImportJsonData, setImportMapping, setImportMehrfachListen, setImportNeuName, setImportParsed, setImportSprache, setImportText, setImportZielTyp, setzeMapping, sichtbareListen, tt, ttFeld } = app;
  return (
(() => {
          const bl = getBestehendeListe();
          const zielOptionen = importZielTyp === "bestehend" && bl ? getBestehendZielOptionen(bl) : null;
          const anzahlZugewiesen = Object.values(importMapping).filter(t => t !== null).length;
          const anzahlGesamt = importParsed ? importParsed.header.length : 0;
          return (
            <div className="sektion">
              {importJsonData ? (
                <>
                  <div className="meldung-info" style={{background:"var(--haupt-flaeche)", borderColor:"var(--haupt-zart)"}}>
                    <strong>{importJsonData.sicherung ? `Gesamtsicherung vom ${formatTag(importJsonData.sicherung.erstellt)} erkannt:` : "JSON-Backup erkannt:"}</strong> {importJsonData.length} Liste{importJsonData.length !== 1 ? "n" : ""} gefunden.
                    {importJsonData.sicherung && <> „Alles wiederherstellen“ ersetzt den aktuellen Stand (Listen, Scores, Farben, Einstellungen, gespeicherte Quiz); „Alle importieren“ legt nur die Listen zusätzlich an.</>}
                  </div>
                  <div className="karte">
                    {importJsonData.map((l, i) => (
                      <div key={i} className="karte-zeile">
                        <span style={{fontWeight:600}}>{sprachInfo(listeSprache(l)).flagge} {l.name}</span>
                        <span style={{color:"var(--text2)", fontSize:"0.85rem", marginLeft:"auto"}}>{l.vokabeln?.length || 0} Vokabeln</span>
                      </div>
                    ))}
                  </div>
                  {importFehler && <div className="fehler">{importFehler}</div>}
                  {importOrdnerWahl()}
                  <div style={{display:"flex", gap:10, marginBottom:24}}>
                    <button {...tt("Zurück zur Eingabe")} className="btn btn-ghost" onClick={() => { setImportJsonData(null); setImportDateiname(""); }}>Zurück</button>
                    <button {...tt("Alle Listen aus dem Backup als neue Listen anlegen")} className={`btn ${importJsonData.sicherung ? "btn-ghost" : "btn-primary"}`} onClick={importiereAusJsonDaten}>
                      Alle importieren ({importJsonData.length})
                    </button>
                    {importJsonData.sicherung && (
                      <button {...tt("Den ganzen Stand aus der Sicherung wiederherstellen – ersetzt alle aktuellen Listen und Einstellungen")} className="btn btn-primary" data-alles-wiederherstellen
                        onClick={() => bestaetigeWiederherstellen(importJsonData.sicherung)}>Alles wiederherstellen</button>
                    )}
                  </div>
                </>
              ) : importMehrfachListen ? (
                <>
                  <div className="meldung-info">
                    <strong>{importMehrfachListen.length} Listen erkannt.</strong> Spalten werden automatisch zugewiesen.
                  </div>
                  <div className="karte">
                    {importMehrfachListen.map((s, i) => (
                      <div key={i} className="karte-zeile">
                        <span style={{fontWeight:600}}>{sprachInfo(s.sprache || importSprache).flagge} {s.name}</span>
                        <span style={{color:"var(--text2)", fontSize:"0.85rem", marginLeft:"auto"}}>{s.daten.length} Vokabeln</span>
                      </div>
                    ))}
                  </div>
                  {importMehrfachListen.some(s => !s.sprache) && (
                    <div style={{marginBottom:16}}>
                      <label className="inp-label">Fremdsprache für Listen ohne erkannte Sprache</label>
                      {renderSprachAuswahl(importSprache, setImportSprache)}
                    </div>
                  )}
                  {importFehler && <div className="fehler">{importFehler}</div>}
                  {importOrdnerWahl()}
                  <div style={{display:"flex", gap:10, marginBottom:24}}>
                    <button {...tt("Zurück zur Eingabe")} className="btn btn-ghost" onClick={() => { setImportMehrfachListen(null); }}>Zurück</button>
                    <button {...tt("Alle erkannten Listen als neue Listen anlegen")} className="btn btn-primary" onClick={importiereAlleListen}>
                      Alle importieren ({importMehrfachListen.length})
                    </button>
                  </div>
                </>
              ) : !importParsed ? (
                <>
                  <div className="meldung-info">
                    <strong>Format:</strong> Spalten mit <code>//</code> trennen, falsche Antworten mit <code>||</code> einleiten und mit <code>|</code> trennen.<br/>
                    Erste Zeile = Spaltennamen.
                  </div>
                  {/* bewusst ohne accept: Android-Dateiauswahlen blenden sonst passende Dateien aus */}
                  <input type="file" ref={fileInputRef} style={{display:"none"}}
                    onChange={async e => {
                      const file = e.target.files[0];
                      e.target.value = "";
                      if (!file) return;
                      setImportDateiname(file.name);
                      const info = `Datei „${file.name}“ (${file.size} Bytes)`;
                      const fehler = text => { setImportDateiname(""); setImportFehler(text); };
                      let raw;
                      try { raw = await leseDateiAlsText(file); }
                      catch { fehler(`${info} konnte nicht gelesen werden – evtl. noch nicht vollständig heruntergeladen.`); return; }
                      const bereinigt = raw.replace(/^[\uFEFF\u200B]+/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                      if (!bereinigt.trim()) { fehler(`${info} ist leer – evtl. noch nicht vollständig heruntergeladen.`); return; }
                      let listen;
                      try { listen = findeJsonListen(bereinigt); }
                      catch { fehler(`${info}: JSON-Backup ist beschädigt. Anfang: ${dateiVorschau(bereinigt)}`); return; }
                      if (listen) {
                        if (!listen.length) { fehler(`${info}: keine Vokabellisten im JSON gefunden.`); return; }
                        setImportJsonData(listen);
                        setImportText(""); setImportFehler("");
                        return;
                      }
                      if (istBinaer(bereinigt)) { fehler(`${info} ist keine Textdatei (z. B. Bild, PDF oder Office-Dokument). Bitte die exportierte .txt- oder .json-Datei wählen.`); return; }
                      if (bereinigt.split('\n').filter(z => z.trim()).length < 2 || (bereinigt.match(/\uFFFD/g) || []).length > 3) {
                        fehler(`${info} ist keine lesbare Vokabelliste. Anfang: ${dateiVorschau(bereinigt)}`);
                        return;
                      }
                      setImportText(bereinigt);
                      setImportFehler("");
                    }}
                  />
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6}}>
                    <div style={{display:"flex", alignItems:"baseline", gap:8}}>
                      <label className="inp-label" style={{marginBottom:0}}>Vokabeln einfügen</label>
                      {importText && (
                        <button {...tt("Eingefügten Text löschen")} className="btn-icon" style={{color:"var(--falsch)", fontSize:"0.82rem", fontWeight:700}}
                          onClick={() => { setImportText(""); setImportDateiname(""); setImportFehler(""); }}>✕</button>
                      )}
                    </div>
                    <div style={{display:"flex", gap:6}}>
                      <button {...tt("Datei (.txt oder .json) vom Gerät laden")} className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>📄 Datei</button>
                      <button {...tt("Kopierten Text aus der Zwischenablage einfügen")} className="btn btn-ghost btn-sm" onClick={() =>
                        navigator.clipboard.readText().then(t => {
                          if (!t || !t.trim()) { setImportFehler("Die Zwischenablage enthält keinen Text (evtl. eine Datei). Dateien bitte über „📄 Datei“ laden."); return; }
                          setImportText(t); setImportDateiname(""); setImportFehler("");
                        }).catch(() => setImportFehler("Kein Zugriff auf die Zwischenablage – Text bitte ins Feld einfügen (lange tippen → Einfügen)."))
                      }>Aus Zwischenablage</button>
                    </div>
                  </div>
                  {importDateiname && !importText && (
                    <div style={{fontSize:"0.82rem", color:"var(--text3)", marginBottom:6}}>Lese Datei…</div>
                  )}
                  {importDateiname && importText && (
                    <div style={{fontSize:"0.82rem", color:"var(--haupt)", marginBottom:6, display:"flex", alignItems:"center", gap:6}}>
                      <span>✓</span>
                      <span style={{fontWeight:600}}>{importDateiname}</span>
                      <span style={{color:"var(--text3)"}}>— {importText.split('\n').filter(z => z.trim()).length} Zeilen erkannt</span>
                    </div>
                  )}
                  <textarea {...ttFeld("Vokabeln hier einfügen oder tippen: erste Zeile = Spaltennamen, Spalten mit // trennen")} className="inp" rows={8}
                    placeholder={"Infinitiv // Simple Past // Deutsch\nbe || bee | bi // was/were || wos // sein || ist"}
                    value={importText}
                    onChange={e => { setImportText(e.target.value); setImportFehler(""); }}
                  />
                  {importFehler && <div className="fehler">{importFehler}</div>}
                </>
              ) : (
                <>
                  <div className="sektion-header"><div className="sektion-label">Ziel</div></div>
                  <div className="karte">
                    <div className="toggle-row">
                      <div className="toggle-btn">
                        <button {...tt("Als neue Liste importieren")} className={`toggle-opt${importZielTyp==="neu"?" aktiv":""}`} onClick={() => setImportZielTyp("neu")}>Neue Liste</button>
                        <button {...tt("Vokabeln an eine vorhandene Liste anhängen")} className={`toggle-opt${importZielTyp==="bestehend"?" aktiv":""}`} onClick={() => setImportZielTyp("bestehend")}>Bestehende</button>
                      </div>
                    </div>
                    {importZielTyp === "neu" && (
                      <div style={{padding:"0 16px 16px"}}>
                        <label className="inp-label">Name der neuen Liste</label>
                        <input {...ttFeld("Name der neuen Liste")} className="inp" value={importNeuName}
                          onChange={e => { setImportNeuName(e.target.value); setImportFehler(""); }}
                          placeholder="z.B. Irregular Verbs" />
                        <label className="inp-label" style={{marginTop:12}}>Fremdsprache (Spalten E1–E3)</label>
                        {renderSprachAuswahl(importSprache, setImportSprache)}
                      </div>
                    )}
                    {importZielTyp === "bestehend" && (
                      <div style={{padding:"0 16px 16px"}}>
                        {sichtbareListen.length === 0 ? (
                          <div style={{color:"var(--text2)", fontSize:"0.85rem"}}>Noch keine Listen vorhanden.</div>
                        ) : (
                          <select {...ttFeld("Liste wählen, an die die Vokabeln angehängt werden")} className="inp" value={importBestehendId}
                            onChange={e => { setImportBestehendId(e.target.value); setImportFehler(""); }}>
                            <option value="">– Liste wählen –</option>
                            {sichtbareListen.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="sektion-header">
                    <div className="sektion-label">Spalten zuweisen</div>
                    <span className="import-zaehler"><strong>{anzahlZugewiesen}</strong> / {anzahlGesamt}</span>
                  </div>
                  <div style={{background:"var(--info-kasten)", border:"1px solid var(--rahmen)", borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:"0.82rem", color:"var(--text2)"}}>
                    <strong>Analysiert:</strong> {importParsed.header.map(h => h.wert || "–").join(", ")}
                  </div>
                  <div className="karte">
                    {importParsed.header.map((h, i) => {
                      const zugewiesen = importMapping[i];
                      const beispiel = importParsed.daten[0]?.[i]?.wert;
                      if (zugewiesen) {
                        const label = zielOptionen
                          ? (zielOptionen.find(o => o.typ === zugewiesen)?.label || zugewiesen)
                          : zugewiesen;
                        return (
                          <div key={i} className="spalten-zuweisung">
                            <div className="import-kompakt">
                              <span className="spalten-badge aktiv" style={{padding:"3px 8px", fontSize:"0.78rem"}}>{label}</span>
                              <span style={{fontSize:"0.85rem", color:"var(--text2)"}}>← {h.wert || `Spalte ${i+1}`}</span>
                              <button {...tt("Zuordnung dieser Spalte aufheben")} className="btn-icon" style={{marginLeft:"auto", color:"var(--falsch)", fontSize:"0.75rem"}}
                                onClick={() => setImportMapping(prev => ({...prev, [i]: null}))}>✕</button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="spalten-zuweisung">
                          <div style={{fontWeight:600, fontSize:"0.9rem"}}>{h.wert || `Spalte ${i+1}`}</div>
                          {beispiel && <div className="import-beispiel">z.B. „{beispiel}"</div>}
                          <div className="typ-buttons">
                            {zielOptionen ? (
                              zielOptionen.map(opt => {
                                const belegt = Object.entries(importMapping).some(([k, t]) => t === opt.typ && Number(k) !== i);
                                return (
                                  <button {...tt(opt.neu ? `Neue Spalte ${opt.typ} anlegen` : `In die Spalte „${opt.label}“ importieren`)} key={opt.typ}
                                    className={`typ-btn${importMapping[i] === opt.typ ? " aktiv" : ""}`}
                                    disabled={belegt}
                                    onClick={() => setzeMapping(i, opt.typ)}
                                    style={{fontSize:"0.75rem"}}>
                                    {opt.neu ? `Neu: ${opt.typ}` : opt.label}
                                  </button>
                                );
                              })
                            ) : (
                              TYPEN.map(typ => {
                                const belegt = Object.entries(importMapping).some(([k, t]) => t === typ && Number(k) !== i);
                                return (
                                  <button {...tt(`Als Spalte ${typ} importieren (E = Fremdsprache, D = Deutsch, i = Info)`)} key={typ}
                                    className={`typ-btn${importMapping[i] === typ ? " aktiv" : ""}`}
                                    disabled={belegt}
                                    onClick={() => setzeMapping(i, typ)}
                                  >{typ}</button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="sektion-header">
                    <div className="sektion-label">Vorschau ({importParsed.daten.length} Vokabeln)</div>
                  </div>
                  <div className="karte">
                    {importParsed.daten.slice(0, 3).map((zeile, zi) => (
                      <div key={zi} className="karte-zeile" style={{flexDirection:"column", alignItems:"flex-start", gap:4}}>
                        {zeile.map((zelle, ki) => {
                          const typ = importMapping[ki];
                          if (!typ) return null;
                          const label = zielOptionen
                            ? (zielOptionen.find(o => o.typ === typ)?.label || typ)
                            : typ;
                          return (
                            <div key={ki} style={{display:"flex", alignItems:"baseline", gap:6}}>
                              <span className="spalten-badge aktiv">{label}</span>
                              <span style={{fontSize:"0.88rem"}}>{zelle.wert}</span>
                              {zelle.falsch.length > 0 && <span style={{fontSize:"0.75rem", color:"var(--text2)"}}>(+{zelle.falsch.length} falsch)</span>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {importParsed.daten.length > 3 && (
                      <div className="karte-zeile" style={{color:"var(--text2)", fontSize:"0.82rem"}}>… und {importParsed.daten.length - 3} weitere</div>
                    )}
                  </div>
                  {importFehler && <div className="fehler">{importFehler}</div>}
                  <div style={{display:"flex", gap:10, marginBottom:24}}>
                    <button {...tt("Zurück zur Eingabe")} className="btn btn-ghost" onClick={() => setImportParsed(null)}>Zurück</button>
                    <button {...tt("Vokabeln mit dieser Zuordnung importieren")} className="btn btn-primary" onClick={fuehreImportDurch}>
                      Importieren ({importParsed.daten.length})
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()
  );
}
