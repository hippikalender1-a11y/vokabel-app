import { useState, useEffect, useRef } from "react";

// ── Storage ────────────────────────────────────────────────────────────────
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

// ── Defaults ───────────────────────────────────────────────────────────────
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

// ── Import-Parser ──────────────────────────────────────────────────────────
function parseKolumne(teil) {
  const idx = teil.indexOf('||');
  if (idx === -1) return { wert: teil.trim(), falsch: [] };
  const wert = teil.slice(0, idx).trim();
  const falschStr = teil.slice(idx + 2).trim();
  return { wert, falsch: falschStr.split('|').map(f => f.trim()).filter(Boolean) };
}
function parseZeile(zeile) {
  return zeile.split('//').map(t => parseKolumne(t));
}

// ── Antwort-Varianten (Klammer-Logik) ─────────────────────────────────────
function generiereVarianten(wert) {
  const match = wert.match(/^\(([^)]*?)-?\)(.*)$/);
  if (!match) return [wert.toLowerCase().trim()];
  const prefix = match[1].replace(/-$/, "");
  const rest = match[2].trim();
  return [
    wert, rest,
    prefix + rest,
    prefix + "-" + rest,
    `(${prefix})${rest}`,
    `(${prefix}-)${rest}`,
    `(${prefix}-) ${rest}`,
  ].map(v => v.toLowerCase().trim());
}
function istRichtigeAntwort(eingabe, wert) {
  return generiereVarianten(wert).includes(eingabe.toLowerCase().trim());
}

// ── Scoring ────────────────────────────────────────────────────────────────
function berechneNeuenScore(fortschritt, ereignis, sessionFalschAnzahl, modus) {
  const f = fortschritt || { score: 0, streak: 0, aufgedecktStreak: 0, letzteAbfrage: null };
  const neu = { ...f, letzteAbfrage: new Date().toISOString() };
  if (ereignis === "richtig") {
    neu.score += 1;
    neu.streak += 1;
    neu.aufgedecktStreak = 0;
    if (neu.streak >= 3) neu.score = Math.max(neu.score, 2);
  } else if (ereignis === "falsch") {
    neu.streak = 0;
    neu.aufgedecktStreak = 0;
    if (sessionFalschAnzahl <= 2) neu.score -= 1;
    else if (sessionFalschAnzahl <= 5) neu.score -= 2;
    else neu.score -= 3;
  } else if (ereignis === "aufgedeckt") {
    neu.streak = 0;
    neu.aufgedecktStreak += 1;
    if (modus === "schwer") neu.score -= 1;
    if (neu.aufgedecktStreak >= 3 && neu.score > -100) neu.score = -100;
  }
  return neu;
}
function speichereScore(liste, vokId, neuFortschritt) {
  const updated = {
    ...liste,
    vokabeln: liste.vokabeln.map(v =>
      v.id === vokId ? { ...v, fortschritt: neuFortschritt } : v
    )
  };
  lsSet(SK.liste(liste.id), updated);
  return updated;
}

// ── Styling ────────────────────────────────────────────────────────────────
const C = {
  bg:"#f7f5f0", surface:"#ffffff", border:"#e0dbd2",
  accent:"#2d6a4f", accentHi:"#40916c", danger:"#c0392b",
  text:"#1a1a1a", muted:"#6b6560", tag:"#e8f5e9", tagText:"#2d6a4f",
  richtig:"#1b5e20", richtigBg:"#e8f5e9", falsch:"#b71c1c", falschBg:"#ffebee",
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
  .sektion-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .sektion-label { font-size:0.72rem; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:${C.muted}; }
  .karte { background:${C.surface}; border:1px solid ${C.border}; border-radius:12px; overflow:hidden; margin-bottom:16px; }
  .karte-zeile { display:flex; align-items:center; padding:14px 16px; border-bottom:1px solid ${C.border}; gap:12px; }
  .karte-zeile:last-child { border-bottom:none; }
  .karte-zeile-info { flex:1; min-width:0; }
  .karte-zeile-name { font-weight:600; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .karte-zeile-sub { font-size:0.78rem; color:${C.muted}; margin-top:2px; }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:10px 18px; border-radius:10px; font-size:0.88rem; font-weight:600; cursor:pointer; border:none; font-family:inherit; transition: opacity .15s; }
  .btn:active { opacity:.8; }
  .btn-primary { background:${C.accent}; color:#fff; }
  .btn-ghost { background:transparent; color:${C.accent}; border:1.5px solid ${C.accent}; }
  .btn-sm { padding:6px 12px; font-size:0.8rem; }
  .btn-danger { background:transparent; color:${C.danger}; border:1.5px solid ${C.danger}; }
  .btn-icon { background:none; border:none; cursor:pointer; padding:6px 10px; border-radius:8px; color:${C.muted}; font-size:0.85rem; font-weight:600; }
  .inp { width:100%; background:${C.bg}; border:1.5px solid ${C.border}; border-radius:10px; padding:11px 14px; font-size:0.95rem; color:${C.text}; outline:none; font-family:inherit; }
  .inp:focus { border-color:${C.accent}; background:#fff; }
  .inp::placeholder { color:${C.muted}; }
  textarea.inp { resize:vertical; font-family:monospace; font-size:0.82rem; line-height:1.5; }
  select.inp { cursor:pointer; }
  .inp-label { font-size:0.8rem; font-weight:600; color:${C.muted}; margin-bottom:6px; display:block; }
  .overlay { position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:flex-end; justify-content:center; z-index:100; padding:16px; }
  .modal { background:${C.surface}; border-radius:16px; width:100%; max-width:500px; padding:24px; }
  .modal-titel { font-size:1.1rem; font-weight:700; margin-bottom:16px; }
  .modal-actions { display:flex; gap:10px; margin-top:20px; justify-content:flex-end; }
  .leer { text-align:center; padding:48px 24px; color:${C.muted}; }
  .leer-text { font-size:0.9rem; line-height:1.5; margin-top:8px; }
  .spalten-badge { font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:4px; background:${C.border}; color:${C.muted}; margin-right:3px; }
  .spalten-badge.aktiv { background:${C.tag}; color:${C.tagText}; }
  .typ-btn { font-size:0.78rem; font-weight:700; padding:4px 10px; border-radius:6px; border:1.5px solid ${C.border}; background:${C.bg}; color:${C.muted}; cursor:pointer; font-family:inherit; }
  .typ-btn.aktiv { background:${C.accent}; color:#fff; border-color:${C.accent}; }
  .typ-btn.x.aktiv { background:${C.danger}; border-color:${C.danger}; color:#fff; }
  .typ-btn:disabled { opacity:0.3; cursor:not-allowed; }
  .toggle-row { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; }
  .toggle-label { font-weight:600; font-size:0.9rem; }
  .toggle-sub { font-size:0.78rem; color:${C.muted}; margin-top:2px; }
  .toggle-btn { display:flex; border-radius:8px; overflow:hidden; border:1.5px solid ${C.border}; }
  .toggle-opt { padding:6px 14px; font-size:0.82rem; font-weight:600; background:none; border:none; cursor:pointer; color:${C.muted}; font-family:inherit; }
  .toggle-opt.aktiv { background:${C.accent}; color:#fff; }
  .meldung-info { background:#e8f4fd; color:#1565c0; border:1px solid #bbdefb; padding:12px 16px; border-radius:10px; font-size:0.85rem; margin-bottom:16px; line-height:1.6; }
  .fehler { color:${C.danger}; font-size:0.82rem; margin-top:8px; margin-bottom:8px; }
  .fab { position:fixed; bottom:24px; right:24px; width:56px; height:56px; border-radius:28px; background:${C.accent}; color:#fff; font-size:1.6rem; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 16px rgba(0,0,0,.2); z-index:20; }
  .spalten-zuweisung { padding:14px 16px; border-bottom:1px solid ${C.border}; }
  .spalten-zuweisung:last-child { border-bottom:none; }
  .typ-buttons { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .vok-wert { font-size:0.88rem; }
  .vok-falsch { font-size:0.75rem; color:${C.muted}; }
  .score-badge { font-size:0.7rem; font-weight:700; padding:2px 7px; border-radius:10px; }
  .score-pos { background:#e8f5e9; color:#2d6a4f; }
  .score-neg { background:#ffebee; color:#c0392b; }
  .score-null { background:${C.border}; color:${C.muted}; }
  /* Quiz */
  .quiz-frage-box { background:${C.surface}; border:1px solid ${C.border}; border-radius:14px; padding:20px; margin-bottom:14px; }
  .quiz-label { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:${C.muted}; margin-bottom:8px; }
  .quiz-frage-text { font-size:1.5rem; font-weight:700; line-height:1.3; }
  .quiz-info-text { font-size:0.85rem; color:${C.muted}; margin-top:8px; }
  .quiz-antwort-box { background:${C.surface}; border:1.5px solid ${C.border}; border-radius:14px; padding:18px; margin-bottom:14px; transition: border-color .2s, background .2s; }
  .quiz-antwort-box.richtig { border-color:${C.accentHi}; background:${C.richtigBg}; }
  .quiz-antwort-box.falsch { border-color:${C.danger}; background:${C.falschBg}; }
  .quiz-antwort-box.aufgedeckt { border-color:${C.border}; background:#fffde7; }
  .quiz-antwort-box.weitere { border-color:#7b1fa2; background:#f3e5f5; }
  .quiz-loesung-text { font-size:1.2rem; font-weight:600; margin-top:8px; }
  .quiz-feedback { font-size:0.88rem; font-weight:600; margin-top:6px; }
  .quiz-feedback.ok { color:${C.richtig}; }
  .quiz-feedback.nein { color:${C.falsch}; }
  .quiz-feedback.info { color:#6a1b9a; }
  .quiz-fortschritt { font-size:0.82rem; color:${C.muted}; }
  .quiz-aktionen { display:flex; gap:10px; flex-wrap:wrap; margin-top:4px; }
`;

const TYPEN = ["E1","E2","D1","D2","i1","i2"];

export default function VokabelApp() {
  // ── Haupt-State ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState("listen");
  const [listenIndex, setListenIndex] = useState([]);
  const [einstellungen, setEinstellungen] = useState(defaultEinstellungen());
  const [ansicht, setAnsicht] = useState("uebersicht");
  const [aktiveListeId, setAktiveListeId] = useState(null);
  const [aktiveListe, setAktiveListe] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalInput, setModalInput] = useState("");
  const [modalFehler, setModalFehler] = useState("");

  // ── Import-State ─────────────────────────────────────────────────────────
  const [importText, setImportText] = useState("");
  const [importParsed, setImportParsed] = useState(null);
  const [importMapping, setImportMapping] = useState({});
  const [importZielTyp, setImportZielTyp] = useState("neu");
  const [importNeuName, setImportNeuName] = useState("");
  const [importBestehendId, setImportBestehendId] = useState("");
  const [importFehler, setImportFehler] = useState("");

  // ── Quiz-State ────────────────────────────────────────────────────────────
  const [quizFrageTyp, setQuizFrageTyp] = useState("");
  const [quizAntwortTyp, setQuizAntwortTyp] = useState("");
  const [quiz, setQuiz] = useState(null);
  const eingabeRef = useRef(null);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setListenIndex(lsGet(SK.listenIndex, []));
    setEinstellungen(lsGet(SK.einstellungen, defaultEinstellungen()));
    if (!lsGet(SK.sessionSlots)) lsSet(SK.sessionSlots, defaultSessionSlots());
  }, []);

  useEffect(() => {
    if (aktiveListeId) setAktiveListe(lsGet(SK.liste(aktiveListeId)));
  }, [aktiveListeId]);

  useEffect(() => {
    if (ansicht === "quiz" && eingabeRef.current) eingabeRef.current.focus();
  }, [ansicht, quiz?.index, quiz?.phase]);

  useEffect(() => {
    if (ansicht !== "quiz" || !quiz) return;
    if (quiz.phase !== "richtig" && quiz.phase !== "aufgedeckt") return;
    const handler = (e) => {
      if (e.key === "Enter" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        naechsteVokabel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [quiz, ansicht]);

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────
  function speichereIndex(idx) { setListenIndex(idx); lsSet(SK.listenIndex, idx); }
  function speichereEinst(e) { setEinstellungen(e); lsSet(SK.einstellungen, e); }
  const vokabelAnzahl = id => { const l = lsGet(SK.liste(id)); return l ? l.vokabeln.length : 0; };

  // ── Listen-Aktionen ───────────────────────────────────────────────────────
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

  // ── Import-Aktionen ───────────────────────────────────────────────────────
  function resetImport() {
    setImportText(""); setImportParsed(null); setImportMapping({});
    setImportZielTyp("neu"); setImportNeuName(""); setImportBestehendId(""); setImportFehler("");
  }

  function analysiereImport() {
    const zeilen = importText.trim().split('\n').filter(z => z.trim());
    if (zeilen.length < 2) { setImportFehler("Mindestens 2 Zeilen erforderlich."); return; }
    const header = parseZeile(zeilen[0]);
    const daten = zeilen.slice(1).map(parseZeile);
    const mapping = {};
    header.forEach((_, i) => { mapping[i] = null; });
    setImportParsed({ header, daten });
    setImportMapping(mapping);
    setImportFehler("");
  }

  function setzeMapping(colIndex, typ) {
    setImportMapping(prev => {
      const war = prev[colIndex];
      const neu = { ...prev };
      Object.keys(neu).forEach(k => { if (neu[k] === typ) neu[k] = null; });
      neu[colIndex] = war === typ ? null : typ;
      return neu;
    });
  }

  function fuehreImportDurch() {
    const abfragbar = Object.values(importMapping).filter(t => t && !t.startsWith('i'));
    if (abfragbar.length < 2) {
      setImportFehler("Mindestens 2 abfragbare Spalten (E1/E2/D1/D2) müssen zugewiesen sein.");
      return;
    }
    function aktualisiereSpaltennamen(liste) {
      Object.entries(importMapping).forEach(([idx, typ]) => {
        if (typ) liste.spalten[typ] = { name: importParsed.header[Number(idx)].wert, aktiv: true };
      });
    }
    function bauVokabeln(liste) {
      importParsed.daten.forEach(zeile => {
        const vok = { id: liste.naechste_id++ };
        Object.entries(importMapping).forEach(([idx, typ]) => {
          if (typ && zeile[Number(idx)]) {
            vok[typ] = { wert: zeile[Number(idx)].wert, falsch: zeile[Number(idx)].falsch };
          }
        });
        liste.vokabeln.push(vok);
      });
    }
    if (importZielTyp === "neu") {
      const name = importNeuName.trim();
      if (!name) { setImportFehler("Bitte einen Namen eingeben."); return; }
      if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) {
        setImportFehler("Name bereits vorhanden."); return;
      }
      const id = "liste_" + Date.now();
      const liste = neueListeObjekt(id, name);
      aktualisiereSpaltennamen(liste);
      bauVokabeln(liste);
      lsSet(SK.liste(id), liste);
      speichereIndex([...listenIndex, { id, name }]);
    } else {
      if (!importBestehendId) { setImportFehler("Bitte eine Liste auswählen."); return; }
      const liste = lsGet(SK.liste(importBestehendId));
      if (!liste) { setImportFehler("Liste nicht gefunden."); return; }
      aktualisiereSpaltennamen(liste);
      bauVokabeln(liste);
      lsSet(SK.liste(importBestehendId), liste);
    }
    resetImport();
    setAnsicht("uebersicht");
  }

  // ── Quiz-Aktionen ─────────────────────────────────────────────────────────
  function starteQuiz() {
    const voks = aktiveListe.vokabeln
      .filter(v => v[quizFrageTyp] && v[quizAntwortTyp])
      .sort(() => Math.random() - 0.5);
    if (voks.length === 0) return;
    const teile = voks[0][quizAntwortTyp].wert.split('/').map(s => s.trim());
    setQuiz({
      liste: aktiveListe,
      frageTyp: quizFrageTyp,
      antwortTyp: quizAntwortTyp,
      vokabeln: voks,
      index: 0,
      phase: "eingabe",
      eingabe: "",
      antwortTeile: teile,
      weitereIndices: [],
      weiterePos: 0,
      sessionFalsch: {},
      feedback: "",
    });
    setAnsicht("quiz");
  }

  function getAktVok() {
    if (!quiz) return null;
    const vokId = quiz.vokabeln[quiz.index].id;
    return quiz.liste.vokabeln.find(v => v.id === vokId) || quiz.vokabeln[quiz.index];
  }

  function pruefeAntwort() {
    if (!quiz || !quiz.eingabe.trim()) return;
    const eingabe = quiz.eingabe.trim();

    if (quiz.phase === "weitere") {
      const erwIdx = quiz.weitereIndices[quiz.weiterePos];
      const erwartet = quiz.antwortTeile[erwIdx];
      if (istRichtigeAntwort(eingabe, erwartet)) {
        const naechstePos = quiz.weiterePos + 1;
        if (naechstePos >= quiz.weitereIndices.length) {
          setQuiz(prev => ({...prev, eingabe: "", phase: "richtig", feedback: ""}));
        } else {
          setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: ""}));
        }
      } else {
        setQuiz(prev => ({...prev, eingabe: "", feedback: "Nicht ganz – versuch nochmal."}));
      }
      return;
    }

    // Scoring-Phase
    const aktVok = getAktVok();
    const matchIdx = quiz.antwortTeile.findIndex(t => istRichtigeAntwort(eingabe, t));

    if (matchIdx !== -1) {
      const neuFortschritt = berechneNeuenScore(aktVok.fortschritt, "richtig", 0, einstellungen.modus);
      const neueListe = speichereScore(quiz.liste, aktVok.id, neuFortschritt);
      const restIndices = quiz.antwortTeile.map((_, i) => i).filter(i => i !== matchIdx);
      if (restIndices.length > 0) {
        setQuiz(prev => ({...prev, liste: neueListe, eingabe: "", phase: "weitere",
          weitereIndices: restIndices, weiterePos: 0, feedback: "Richtig!"}));
      } else {
        setQuiz(prev => ({...prev, liste: neueListe, eingabe: "", phase: "richtig", feedback: "Richtig!"}));
      }
    } else {
      const vokId = aktVok.id;
      const neuerCount = (quiz.sessionFalsch[vokId] || 0) + 1;
      const neuFortschritt = berechneNeuenScore(aktVok.fortschritt, "falsch", neuerCount, einstellungen.modus);
      const neueListe = speichereScore(quiz.liste, vokId, neuFortschritt);
      setQuiz(prev => ({...prev, liste: neueListe, eingabe: "", phase: "falsch",
        sessionFalsch: {...prev.sessionFalsch, [vokId]: neuerCount}, feedback: "Nicht richtig."}));
    }
  }

  function zeigeLosung() {
    if (!quiz) return;
    const aktVok = getAktVok();
    const neuFortschritt = berechneNeuenScore(aktVok.fortschritt, "aufgedeckt", 0, einstellungen.modus);
    const neueListe = speichereScore(quiz.liste, aktVok.id, neuFortschritt);
    setQuiz(prev => ({...prev, liste: neueListe, eingabe: "", phase: "aufgedeckt", feedback: ""}));
  }

  function ueberspringeWeitere() {
    const naechstePos = quiz.weiterePos + 1;
    if (naechstePos >= quiz.weitereIndices.length) {
      setQuiz(prev => ({...prev, eingabe: "", phase: "richtig", feedback: ""}));
    } else {
      setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: ""}));
    }
  }

  function naechsteVokabel() {
    if (!quiz) return;
    const naechsterIdx = quiz.index + 1;
    if (naechsterIdx >= quiz.vokabeln.length) {
      setQuiz(prev => ({...prev, phase: "fertig"}));
      return;
    }
    const naechsteVok = quiz.vokabeln[naechsterIdx];
    const teile = naechsteVok[quiz.antwortTyp].wert.split('/').map(s => s.trim());
    setQuiz(prev => ({...prev, index: naechsterIdx, phase: "eingabe", eingabe: "",
      antwortTeile: teile, weitereIndices: [], weiterePos: 0, feedback: ""}));
  }

  // ── Render: Quiz-Setup ────────────────────────────────────────────────────
  if (ansicht === "quiz-setup" && aktiveListe) {
    const abfragbar = TYPEN.filter(t => !t.startsWith('i') && aktiveListe.spalten[t].aktiv);
    const verfuegbar = aktiveListe.vokabeln.filter(v => v[quizFrageTyp] && v[quizAntwortTyp]).length;
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" onClick={() => setAnsicht("liste-detail")}>Zurück</button>
            <span className="topbar-title">Quiz starten</span>
          </div>
          <div className="sektion">
            <div className="sektion-label" style={{marginBottom:10}}>Abfragerichtung</div>
            <div className="karte">
              <div style={{padding:"16px 16px 8px"}}>
                <label className="inp-label">Frage (wird gezeigt)</label>
                <select className="inp" value={quizFrageTyp}
                  onChange={e => { setQuizFrageTyp(e.target.value); setQuizAntwortTyp(""); }}>
                  <option value="">– wählen –</option>
                  {abfragbar.map(t => (
                    <option key={t} value={t}>{aktiveListe.spalten[t].name || t} ({t})</option>
                  ))}
                </select>
              </div>
              <div style={{padding:"0 16px 16px"}}>
                <label className="inp-label">Antwort (wird abgefragt)</label>
                <select className="inp" value={quizAntwortTyp}
                  onChange={e => setQuizAntwortTyp(e.target.value)}
                  disabled={!quizFrageTyp}>
                  <option value="">– wählen –</option>
                  {abfragbar.filter(t => t !== quizFrageTyp).map(t => (
                    <option key={t} value={t}>{aktiveListe.spalten[t].name || t} ({t})</option>
                  ))}
                </select>
              </div>
            </div>
            {quizFrageTyp && quizAntwortTyp && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:"0.82rem", color:C.muted, marginBottom:12}}>
                  {verfuegbar} Vokabeln verfügbar
                </div>
                <button className="btn btn-primary" style={{width:"100%"}}
                  onClick={starteQuiz} disabled={verfuegbar === 0}>
                  Quiz starten
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Render: Quiz-Aktiv ────────────────────────────────────────────────────
  if (ansicht === "quiz" && quiz) {
    if (quiz.phase === "fertig") {
      return (
        <>
          <style>{CSS}</style>
          <div className="app">
            <div className="topbar">
              <button className="topbar-back" onClick={() => { setQuiz(null); setAnsicht("liste-detail"); }}>Schließen</button>
              <span className="topbar-title">Quiz abgeschlossen</span>
            </div>
            <div className="sektion">
              <div className="leer">
                <div style={{fontSize:"2.5rem"}}>✓</div>
                <div className="leer-text">
                  Alle {quiz.vokabeln.length} Vokabeln abgefragt!
                </div>
              </div>
              <button className="btn btn-primary" style={{width:"100%"}}
                onClick={() => { setQuiz(null); setAnsicht("liste-detail"); }}>
                Zurück zur Liste
              </button>
            </div>
          </div>
        </>
      );
    }

    const aktVokRaw = quiz.vokabeln[quiz.index];
    const aktVok = getAktVok();
    const frageLabel = quiz.liste.spalten[quiz.frageTyp]?.name || quiz.frageTyp;
    const antwortLabel = quiz.liste.spalten[quiz.antwortTyp]?.name || quiz.antwortTyp;
    const infoSpalten = TYPEN.filter(t => t.startsWith('i') && quiz.liste.spalten[t]?.aktiv && aktVokRaw[t]);
    const score = aktVok?.fortschritt?.score ?? 0;

    const istWeitere = quiz.phase === "weitere";
    const weitereAntwort = istWeitere ? quiz.antwortTeile[quiz.weitereIndices[quiz.weiterePos]] : null;

    let antwortBoxKlasse = "quiz-antwort-box";
    if (quiz.phase === "richtig") antwortBoxKlasse += " richtig";
    else if (quiz.phase === "falsch") antwortBoxKlasse += " falsch";
    else if (quiz.phase === "aufgedeckt") antwortBoxKlasse += " aufgedeckt";
    else if (istWeitere) antwortBoxKlasse += " weitere";

    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" onClick={() => { setQuiz(null); setAnsicht("liste-detail"); }}>Beenden</button>
            <span className="topbar-title">{quiz.index + 1} / {quiz.vokabeln.length}</span>
            <span className="quiz-fortschritt">Score: {score > 0 ? "+" : ""}{score}</span>
          </div>

          <div className="sektion">
            {/* Frage */}
            <div className="quiz-frage-box">
              <div className="quiz-label">{frageLabel}</div>
              <div className="quiz-frage-text">{aktVokRaw[quiz.frageTyp]?.wert}</div>
              {infoSpalten.map(t => (
                <div key={t} className="quiz-info-text">
                  <strong>{quiz.liste.spalten[t]?.name || t}:</strong> {aktVokRaw[t]?.wert}
                </div>
              ))}
            </div>

            {/* Antwort */}
            <div className={antwortBoxKlasse}>
              <div className="quiz-label">
                {antwortLabel}
                {istWeitere && <span style={{color:"#6a1b9a", marginLeft:8}}>— weitere Antwort</span>}
              </div>

              {(quiz.phase === "eingabe" || quiz.phase === "falsch" || istWeitere) && (
                <input
                  ref={eingabeRef}
                  className="inp"
                  value={quiz.eingabe}
                  onChange={e => setQuiz(prev => ({...prev, eingabe: e.target.value}))}
                  onKeyDown={e => e.key === "Enter" && pruefeAntwort()}
                  placeholder={istWeitere ? `"${weitereAntwort}" eingeben…` : "Antwort eingeben…"}
                  style={{marginTop:4}}
                />
              )}

              {(quiz.phase === "richtig" || quiz.phase === "aufgedeckt") && (
                <div className="quiz-loesung-text">
                  {quiz.antwortTeile.join(" / ")}
                </div>
              )}

              {quiz.feedback && (
                <div className={`quiz-feedback ${
                  quiz.phase === "richtig" || istWeitere && quiz.feedback === "Richtig!" ? "ok" :
                  quiz.phase === "falsch" ? "nein" : "info"
                }`}>
                  {quiz.feedback}
                </div>
              )}
            </div>

            {/* Aktionen */}
            <div className="quiz-aktionen">
              {(quiz.phase === "eingabe" || quiz.phase === "falsch") && (
                <>
                  <button className="btn btn-primary" onClick={pruefeAntwort}>Prüfen</button>
                  <button className="btn btn-ghost" onClick={zeigeLosung}>Lösung anzeigen</button>
                </>
              )}
              {istWeitere && (
                <>
                  <button className="btn btn-primary" onClick={pruefeAntwort}>Prüfen</button>
                  <button className="btn btn-ghost" onClick={ueberspringeWeitere}>Überspringen</button>
                </>
              )}
              {(quiz.phase === "richtig" || quiz.phase === "aufgedeckt") && (
                <button className="btn btn-primary" onClick={naechsteVokabel}>Weiter →</button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Render: Import ────────────────────────────────────────────────────────
  if (ansicht === "import") {
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" onClick={() => { resetImport(); setAnsicht("uebersicht"); }}>Zurück</button>
            <span className="topbar-title">Importieren</span>
          </div>
          <div className="sektion">
            {!importParsed ? (
              <>
                <div className="meldung-info">
                  <strong>Format:</strong> Spalten mit <code>//</code> trennen, falsche Antworten mit <code>||</code> einleiten und mit <code>|</code> trennen.<br/>
                  Erste Zeile = Spaltennamen.
                </div>
                <label className="inp-label">Vokabeln einfügen</label>
                <textarea className="inp" rows={8}
                  placeholder={"Infinitiv // Simple Past // Deutsch\nbe || bee | bi // was/were || wos // sein || ist"}
                  value={importText}
                  onChange={e => { setImportText(e.target.value); setImportFehler(""); }}
                />
                {importFehler && <div className="fehler">{importFehler}</div>}
                <div style={{marginTop:12}}>
                  <button className="btn btn-primary" onClick={analysiereImport}>Analysieren</button>
                </div>
              </>
            ) : (
              <>
                <div className="sektion-header"><div className="sektion-label">Spalten zuweisen</div></div>
                <div className="karte">
                  {importParsed.header.map((h, i) => (
                    <div key={i} className="spalten-zuweisung">
                      <div style={{fontWeight:600, fontSize:"0.9rem"}}>{h.wert || `Spalte ${i+1}`}</div>
                      <div className="typ-buttons">
                        {TYPEN.map(typ => {
                          const belegt = Object.entries(importMapping).some(([k, t]) => t === typ && Number(k) !== i);
                          return (
                            <button key={typ}
                              className={`typ-btn${importMapping[i] === typ ? " aktiv" : ""}`}
                              disabled={belegt}
                              onClick={() => setzeMapping(i, typ)}
                            >{typ}</button>
                          );
                        })}
                        <button
                          className={`typ-btn x${importMapping[i] === null ? " aktiv" : ""}`}
                          onClick={() => setImportMapping(prev => ({...prev, [i]: null}))}
                        >✕</button>
                      </div>
                    </div>
                  ))}
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
                        return (
                          <div key={ki} style={{display:"flex", alignItems:"baseline", gap:6}}>
                            <span className="spalten-badge aktiv">{typ}</span>
                            <span className="vok-wert">{zelle.wert}</span>
                            {zelle.falsch.length > 0 && <span className="vok-falsch">(+{zelle.falsch.length} falsch)</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {importParsed.daten.length > 3 && (
                    <div className="karte-zeile" style={{color:C.muted, fontSize:"0.82rem"}}>
                      … und {importParsed.daten.length - 3} weitere
                    </div>
                  )}
                </div>

                <div className="sektion-header"><div className="sektion-label">Ziel</div></div>
                <div className="karte">
                  <div className="toggle-row">
                    <div className="toggle-btn">
                      <button className={`toggle-opt${importZielTyp==="neu"?" aktiv":""}`} onClick={() => setImportZielTyp("neu")}>Neue Liste</button>
                      <button className={`toggle-opt${importZielTyp==="bestehend"?" aktiv":""}`} onClick={() => setImportZielTyp("bestehend")}>Bestehende</button>
                    </div>
                  </div>
                  {importZielTyp === "neu" && (
                    <div style={{padding:"0 16px 16px"}}>
                      <label className="inp-label">Name der neuen Liste</label>
                      <input className="inp" value={importNeuName}
                        onChange={e => { setImportNeuName(e.target.value); setImportFehler(""); }}
                        placeholder="z.B. Irregular Verbs" />
                    </div>
                  )}
                  {importZielTyp === "bestehend" && (
                    <div style={{padding:"0 16px 16px"}}>
                      {listenIndex.length === 0 ? (
                        <div style={{color:C.muted, fontSize:"0.85rem"}}>Noch keine Listen vorhanden.</div>
                      ) : (
                        <select className="inp" value={importBestehendId}
                          onChange={e => { setImportBestehendId(e.target.value); setImportFehler(""); }}>
                          <option value="">– Liste wählen –</option>
                          {listenIndex.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                {importFehler && <div className="fehler">{importFehler}</div>}
                <div style={{display:"flex", gap:10, marginBottom:24}}>
                  <button className="btn btn-ghost" onClick={() => setImportParsed(null)}>Zurück</button>
                  <button className="btn btn-primary" onClick={fuehreImportDurch}>
                    Importieren ({importParsed.daten.length})
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Render: Listen-Detail ─────────────────────────────────────────────────
  if (ansicht === "liste-detail" && aktiveListe) {
    const aktiveSpalten = TYPEN.filter(t => aktiveListe.spalten[t].aktiv);
    const abfragbareSpalten = aktiveSpalten.filter(t => !t.startsWith('i'));
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" onClick={() => setAnsicht("uebersicht")}>Zurück</button>
            <span className="topbar-title">{aktiveListe.name}</span>
            <button className="btn-icon" onClick={() => oeffneModal("umbenennen")}>Umbenn.</button>
            <button className="btn-icon" onClick={() => oeffneModal("loeschen")}>Löschen</button>
          </div>
          <div className="sektion">
            {abfragbareSpalten.length >= 2 && aktiveListe.vokabeln.length > 0 && (
              <button className="btn btn-primary" style={{width:"100%", marginBottom:16}}
                onClick={() => setAnsicht("quiz-setup")}>
                Quiz starten
              </button>
            )}

            <div className="sektion-label" style={{marginBottom:10}}>Spalten</div>
            <div className="karte">
              {TYPEN.map(typ => {
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

            <div className="sektion-header">
              <div className="sektion-label">Vokabeln ({aktiveListe.vokabeln.length})</div>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                resetImport(); setImportZielTyp("bestehend"); setImportBestehendId(aktiveListeId); setAnsicht("import");
              }}>+ Importieren</button>
            </div>

            {aktiveListe.vokabeln.length === 0 ? (
              <div className="leer">
                <div className="leer-text">Noch keine Vokabeln.<br/>Klicke auf "+ Importieren".</div>
              </div>
            ) : (
              <div className="karte">
                {aktiveListe.vokabeln.map(vok => {
                  const score = vok.fortschritt?.score ?? null;
                  return (
                    <div key={vok.id} className="karte-zeile" style={{flexDirection:"column", alignItems:"flex-start", gap:4}}>
                      <div style={{display:"flex", width:"100%", justifyContent:"space-between", alignItems:"center"}}>
                        <div style={{display:"flex", flexDirection:"column", gap:4, flex:1}}>
                          {aktiveSpalten.map(typ => vok[typ] ? (
                            <div key={typ} style={{display:"flex", alignItems:"baseline", gap:6}}>
                              <span className="spalten-badge aktiv">{aktiveListe.spalten[typ].name || typ}</span>
                              <span className="vok-wert">{vok[typ].wert}</span>
                              {vok[typ].falsch?.length > 0 &&
                                <span className="vok-falsch">(+{vok[typ].falsch.length} falsch)</span>}
                            </div>
                          ) : null)}
                        </div>
                        {score !== null && (
                          <span className={`score-badge ${score > 0 ? "score-pos" : score < 0 ? "score-neg" : "score-null"}`}>
                            {score > 0 ? "+" : ""}{score}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              {modalFehler && <div className="fehler">{modalFehler}</div>}
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
              <div className="modal-titel">Liste löschen?</div>
              <p style={{fontSize:"0.9rem",color:C.muted,lineHeight:1.5}}>
                Diese Liste wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.
              </p>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
                <button className="btn btn-danger" onClick={loeschen}>Löschen</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Render: Übersicht ─────────────────────────────────────────────────────
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
            <div className="sektion-header">
              <div className="sektion-label">Meine Listen</div>
              <button className="btn btn-ghost btn-sm" onClick={() => { resetImport(); setAnsicht("import"); }}>
                Importieren
              </button>
            </div>
            {listenIndex.length === 0 ? (
              <div className="leer">
                <div className="leer-text">Noch keine Listen vorhanden.<br/>Tippe auf <strong>+</strong> um eine neue Liste anzulegen.</div>
              </div>
            ) : (
              <div className="karte">
                {listenIndex.map(l => {
                  const anzahl = vokabelAnzahl(l.id);
                  const liste = lsGet(SK.liste(l.id));
                  const aktSpalten = liste ? TYPEN.filter(t => liste.spalten[t].aktiv) : [];
                  return (
                    <div key={l.id} className="karte-zeile" style={{cursor:"pointer"}}
                      onClick={() => { setAktiveListeId(l.id); setAnsicht("liste-detail"); }}>
                      <div className="karte-zeile-info">
                        <div className="karte-zeile-name">{l.name}</div>
                        <div className="karte-zeile-sub">
                          {anzahl} Vokabel{anzahl !== 1 ? "n" : ""}{" "}
                          {aktSpalten.map(t => (
                            <span key={t} className="spalten-badge aktiv">{liste.spalten[t].name || t}</span>
                          ))}
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
            <div className="sektion-label" style={{marginBottom:10}}>Schwierigkeits-Modus</div>
            <div className="karte">
              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Modus</div>
                  <div className="toggle-sub">{einstellungen.modus === "einfach" ? "Lösung anzeigen ohne Score-Einfluss." : "Lösung anzeigen zieht 1 Punkt ab."}</div>
                </div>
                <div className="toggle-btn">
                  <button className={`toggle-opt${einstellungen.modus==="einfach"?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen,modus:"einfach"})}>Einfach</button>
                  <button className={`toggle-opt${einstellungen.modus==="schwer"?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen,modus:"schwer"})}>Schwer</button>
                </div>
              </div>
            </div>
            <div className="sektion-label" style={{marginBottom:10, marginTop:8}}>Daten</div>
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
            {modalFehler && <div className="fehler">{modalFehler}</div>}
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
