import { useState, useEffect } from "react";

const SK = {
  einstellungen: "vokabel_einstellungen",
  listenIndex:   "vokabel_listen_index",
  sessionSlots:  "vokabel_session_slots",
  liste: (id)  => `vokabel_liste_${id}`,
};

function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function defaultEinstellungen() { return { modus: "einfach" }; }
function defaultSessionSlots() {
  return [1,2,3,4,5].map(n => ({ slot: n, name: "", konfiguration: null }))
    .concat([{ slot: 6, name: "Zuletzt verwendet", konfiguration: null }]);
}
function neueListeObjekt(id, name) {
  return {
    id, name,
    spalten: {
      E1:{name:"",aktiv:false}, E2:{name:"",aktiv:false},
      D1:{name:"",aktiv:false}, D2:{name:"",aktiv:false},
      i1:{name:"",aktiv:false}, i2:{name:"",aktiv:false},
    },
    naechste_id: 1,
    vokabeln: [],
  };
}

const C = {
  bg:"#f7f5f0", surface:"#ffffff", border:"#e0dbd2",
  accent:"#2d6a4f", accentHi:"#40916c", danger:"#c0392b",
  text:"#1a1a1a", muted:"#6b6560", tag:"#e8f5e9", tagText:"#2d6a4f",
};

const CSS = `
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:${C.bg}; font-family:system-ui,sans-serif; color:${C.text}; }
  .app { max-width:600px; margin:0 auto; padding:0 0 80px; }
  .topbar { background:${C.surface}; border-bottom:1px solid ${C.border}; padding:14px 16px; display:flex; align-items:center; gap:12px; position:sticky; top:0; z-index:10; }
  .topbar-title { font-size:1.05rem; font-weight:700; flex:1; }
  .topbar-back { background:none; border:none; color:${C.accent}; font-size:0.9rem; font-weight:600; cursor:pointer; }
  .tabs { display:flex; background:${C.surface}; border-bottom:1px solid ${C.border}; }
  .tab { flex:1; padding:12px 4px; font-size:0.82rem; font-weight:600; color:${C.muted}; background:none; border:none; cursor:pointer; border-bottom:2px solid transparent; }
  .tab.aktiv { color:${C.accent}; border-bottom-color:${C.accent}; }
  .sektion { padding:20px 16px 0; }
  .sektion-label { font-size:0.72rem; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:${C.muted}; margin-bottom:10px; }
  .karte { background:${C.surface}; border:1px solid ${C.border}; border-radius:12px; overflow:hidden; margin-bottom:16px; }
  .karte-zeile { display:flex; align-items:center; padding:14px 16px; border-bottom:1px solid ${C.border}; gap:12px; }
  .karte-zeile:last-child { border-bottom:none; }
  .karte-zeile-info { flex:1; min-width:0; }
  .karte-zeile-name { font-weight:600; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .karte-zeile-sub { font-size:0.78rem; color:${C.muted}; margin-top:2px; }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:10px 18px; border-radius:10px; font-size:0.88rem; font-weight:600; cursor:pointer; border:none; font-family:inherit; }
  .btn-primary { background:${C.accent}; color:#fff; }
  .btn-ghost { background:transparent; color:${C.accent}; border:1.5px solid ${C.accent}; }
  .btn-danger { background:transparent; color:${C.danger}; border:1.5px solid ${C.danger}; }
  .btn-icon { background:none; border:none; cursor:pointer; padding:6px 10px; border-radius:8px; color:${C.muted}; font-size:0.85rem; font-weight:600; }
  .inp { width:100%; background:${C.bg}; border:1.5px solid ${C.border}; border-radius:10px; padding:11px 14px; font-size:0.95rem; color:${C.text}; outline:none; font-family:inherit; }
  .inp:focus { border-color:${C.accent}; background:#fff; }
  .inp::placeholder { color:${C.muted}; }
  .inp-label { font-size:0.8rem; font-weight:600; color:${C.muted}; margin-bottom:6px; display:block; }
  .overlay { position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:flex-end; justify-content:center; z-index:100; padding:16px; }
  .modal { background:${C.surface}; border-radius:16px; width:100%; max-width:500px; padding:24px; }
  .modal-titel { font-size:1.1rem; font-weight:700; margin-bottom:16px; }
  .modal-actions { display:flex; gap:10px; margin-top:20px; justify-content:flex-end; }
  .leer { text-align:center; padding:48px 24px; color:${C.muted}; }
  .leer-text { font-size:0.9rem; line-height:1.5; margin-top:8px; }
  .spalten-badge { font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:4px; background:${C.border}; color:${C.muted}; margin-right:3px; }
  .spalten-badge.aktiv { background:${C.tag}; color:${C.tagText}; }
  .toggle-row { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; }
  .toggle-label { font-weight:600; font-size:0.9rem; }
  .toggle-sub { font-size:0.78rem; color:${C.muted}; margin-top:2px; }
  .toggle-btn { display:flex; border-radius:8px; overflow:hidden; border:1.5px solid ${C.border}; }
  .toggle-opt { padding:6px 14px; font-size:0.82rem; font-weight:600; background:none; border:none; cursor:pointer; color:${C.muted}; font-family:inherit; }
  .toggle-opt.aktiv { background:${C.accent}; color:#fff; }
  .meldung-info { background:#e8f4fd; color:#1565c0; border:1px solid #bbdefb; padding:12px 16px; border-radius:10px; font-size:0.85rem; margin-bottom:16px; }
  .fab { position:fixed; bottom:24px; right:24px; width:56px; height:56px; border-radius:28px; background:${C.accent}; color:#fff; font-size:1.6rem; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 16px rgba(0,0,0,.2); z-index:20; }
`;

export default function VokabelApp() {
  const [tab, setTab] = useState("listen");
  const [listenIndex, setListenIndex] = useState([]);
  const [einstellungen, setEinstellungen] = useState(defaultEinstellungen());
  const [ansicht, setAnsicht] = useState("uebersicht");
  const [aktiveListeId, setAktiveListeId] = useState(null);
  const [aktiveListe, setAktiveListe] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalInput, setModalInput] = useState("");
  const [modalFehler, setModalFehler] = useState("");

  useEffect(() => {
    setListenIndex(lsGet(SK.listenIndex, []));
    setEinstellungen(lsGet(SK.einstellungen, defaultEinstellungen()));
    if (!lsGet(SK.sessionSlots)) lsSet(SK.sessionSlots, defaultSessionSlots());
  }, []);

  useEffect(() => {
    if (aktiveListeId) setAktiveListe(lsGet(SK.liste(aktiveListeId)));
  }, [aktiveListeId]);

  function speichereIndex(idx) { setListenIndex(idx); lsSet(SK.listenIndex, idx); }
  function speichereEinst(e) { setEinstellungen(e); lsSet(SK.einstellungen, e); }

  function erstelleListe() {
    const name = modalInput.trim();
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) {
      setModalFehler("Name bereits vorhanden."); return;
    }
    const id = "liste_" + Date.now();
    lsSet(SK.liste(id), neueListeObjekt(id, name));
    speichereIndex([...listenIndex, { id, name }]);
    setModal(null); setModalInput(""); setModalFehler("");
  }

  function umbenennen() {
    const name = modalInput.trim();
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.id !== aktiveListeId && l.name.toLowerCase() === name.toLowerCase())) {
      setModalFehler("Name bereits vorhanden."); return;
    }
    speichereIndex(listenIndex.map(l => l.id === aktiveListeId ? { ...l, name } : l));
    const aktuell = lsGet(SK.liste(aktiveListeId));
    if (aktuell) { const u = { ...aktuell, name }; lsSet(SK.liste(aktiveListeId), u); setAktiveListe(u); }
    setModal(null); setModalInput(""); setModalFehler("");
  }

  function loeschen() {
    localStorage.removeItem(SK.liste(aktiveListeId));
    speichereIndex(listenIndex.filter(l => l.id !== aktiveListeId));
    setModal(null); setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null);
  }

  function oeffneModal(typ) {
    setModalInput(typ === "umbenennen" && aktiveListe ? aktiveListe.name : "");
    setModalFehler(""); setModal(typ);
  }

  const vokabelAnzahl = id => { const l = lsGet(SK.liste(id)); return l ? l.vokabeln.length : 0; };

  if (ansicht === "liste-detail" && aktiveListe) {
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" onClick={() => setAnsicht("uebersicht")}>Zurueck</button>
            <span className="topbar-title">{aktiveListe.name}</span>
            <button className="btn-icon" onClick={() => oeffneModal("umbenennen")}>Umbenn.</button>
            <button className="btn-icon" onClick={() => oeffneModal("loeschen")}>Loeschen</button>
          </div>
          <div className="sektion">
            <div className="meldung-info">Import und Quiz folgen in Stufe 2 und 3.</div>
            <div className="sektion-label">Spalten</div>
            <div className="karte">
              {["E1","E2","D1","D2","i1","i2"].map(typ => {
                const s = aktiveListe.spalten[typ];
                return (
                  <div key={typ} className="karte-zeile">
                    <span className={`spalten-badge${s.aktiv ? " aktiv" : ""}`}>{typ}</span>
                    <div className="karte-zeile-info">
                      <div className="karte-zeile-name" style={{color: s.aktiv ? C.text : C.muted}}>
                        {s.aktiv ? (s.name || `Spalte ${typ}`) : "nicht belegt"}
                      </div>
                      {s.aktiv && <div className="karte-zeile-sub">{typ.startsWith("i") ? "Info (nicht abfragbar)" : "Abfragbar"}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sektion-label">Vokabeln</div>
            <div className="leer"><div className="leer-text">Noch keine Vokabeln – folgt in Stufe 2.</div></div>
          </div>
        </div>
        {modal === "umbenennen" && (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-titel">Liste umbenennen</div>
              <label className="inp-label">Neuer Name</label>
              <input className="inp" value={modalInput} autoFocus
                onChange={e => { setModalInput(e.target.value); setModalFehler(""); }}
                onKeyDown={e => e.key === "Enter" && umbenennen()} />
              {modalFehler && <div style={{color:C.danger,fontSize:"0.82rem",marginTop:8}}>{modalFehler}</div>}
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
                <button className="btn btn-primary" onClick={umbenennen}>Speichern</button>
              </div>
            </div>
          </div>
        )}
        {modal === "loeschen" && (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-titel">Liste loeschen?</div>
              <p style={{fontSize:"0.9rem",color:C.muted,lineHeight:1.5}}>
                Diese Liste wird dauerhaft geloescht. Das kann nicht rueckgaengig gemacht werden.
              </p>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
                <button className="btn btn-danger" onClick={loeschen}>Loeschen</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="topbar"><span className="topbar-title">Vokabel-Trainer</span></div>
        <div className="tabs">
          <button className={`tab${tab==="listen"?" aktiv":""}`} onClick={() => setTab("listen")}>Listen</button>
          <button className={`tab${tab==="einstellungen"?" aktiv":""}`} onClick={() => setTab("einstellungen")}>Einstellungen</button>
        </div>
        {tab === "listen" && (
          <div className="sektion">
            {listenIndex.length === 0 ? (
              <div className="leer"><div className="leer-text">Noch keine Listen vorhanden.<br/>Tippe auf <strong>+</strong> um eine neue Liste anzulegen.</div></div>
            ) : (
              <div className="karte">
                {listenIndex.map(l => {
                  const anzahl = vokabelAnzahl(l.id);
                  const liste = lsGet(SK.liste(l.id));
                  const aktSpalten = liste ? Object.entries(liste.spalten).filter(([,s]) => s.aktiv) : [];
                  return (
                    <div key={l.id} className="karte-zeile" style={{cursor:"pointer"}} onClick={() => { setAktiveListeId(l.id); setAnsicht("liste-detail"); }}>
                      <div className="karte-zeile-info">
                        <div className="karte-zeile-name">{l.name}</div>
                        <div className="karte-zeile-sub">
                          {anzahl} Vokabel{anzahl !== 1 ? "n" : ""}
                          {aktSpalten.map(([typ,s]) => <span key={typ} className="spalten-badge aktiv">{s.name||typ}</span>)}
                        </div>
                      </div>
                      <span style={{color:C.muted}}>{">"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {tab === "einstellungen" && (
          <div className="sektion">
            <div className="sektion-label">Schwierigkeits-Modus</div>
            <div className="karte">
              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Modus</div>
                  <div className="toggle-sub">{einstellungen.modus === "einfach" ? "Loesung anzeigen ohne Score-Einfluss." : "Loesung anzeigen zieht 1 Punkt ab."}</div>
                </div>
                <div className="toggle-btn">
                  <button className={`toggle-opt${einstellungen.modus==="einfach"?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen,modus:"einfach"})}>Einfach</button>
                  <button className={`toggle-opt${einstellungen.modus==="schwer"?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen,modus:"schwer"})}>Schwer</button>
                </div>
              </div>
            </div>
            <div className="sektion-label" style={{marginTop:8}}>Daten</div>
            <div className="karte">
              <div className="karte-zeile">
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name">Gespeicherte Listen</div>
                  <div className="karte-zeile-sub">{listenIndex.length} Liste{listenIndex.length!==1?"n":""}</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === "listen" && <button className="fab" onClick={() => oeffneModal("neue-liste")}>+</button>}
      </div>
      {modal === "neue-liste" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Neue Liste anlegen</div>
            <label className="inp-label">Name der Liste</label>
            <input className="inp" placeholder="z.B. Irregular Verbs, Unit 5" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }}
              onKeyDown={e => e.key === "Enter" && erstelleListe()} />
            {modalFehler && <div style={{color:C.danger,fontSize:"0.82rem",marginTop:8}}>{modalFehler}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={erstelleListe}>Erstellen</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
