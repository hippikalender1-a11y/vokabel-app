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
function defaultEinstellungen() { return { modus: "schwer", autoplay: false, vorlesen: ["E1"] }; }
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

// ── Info-Seitenumbruch ─────────────────────────────────────────────────────
function splitInSeiten(text, maxChars = 120) {
  if (!text || text.length <= maxChars) return [text || ""];
  const seiten = [];
  let rest = text.trim();
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(' ', maxChars);
    if (cut <= 0) cut = maxChars;
    seiten.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) seiten.push(rest);
  return seiten;
}

// ── MC-Buttons generieren ─────────────────────────────────────────────────
function generiereButtons(vokabeln, aktVok, antwortTyp) {
  const richtigTeile = (aktVok[antwortTyp]?.wert || "").split('/').map(s => s.trim()).filter(Boolean);
  const richtigLower = richtigTeile.map(r => r.toLowerCase());
  const eigenesFalsch = (aktVok[antwortTyp]?.falsch || []).filter(f => !richtigLower.includes(f.toLowerCase()));
  const gewaehltesFalsch = [...eigenesFalsch].sort(() => Math.random() - 0.5).slice(0, 3);
  if (gewaehltesFalsch.length < 3) {
    const andere = vokabeln
      .filter(v => v.id !== aktVok.id && v[antwortTyp])
      .flatMap(v => (v[antwortTyp].wert || "").split('/').map(s => s.trim()))
      .filter(a => !richtigTeile.includes(a) && !gewaehltesFalsch.includes(a));
    const unique = [...new Set(andere)].sort(() => Math.random() - 0.5);
    gewaehltesFalsch.push(...unique.slice(0, 3 - gewaehltesFalsch.length));
  }
  const alle = [
    ...richtigTeile.map(t => ({ text: t, korrekt: true, status: "neutral" })),
    ...gewaehltesFalsch.map(t => ({ text: t, korrekt: false, status: "neutral" })),
  ].sort(() => Math.random() - 0.5);
  return { buttons: alle, richtig: richtigTeile };
}

// ── Text-to-Speech ─────────────────────────────────────────────────────────
function spalteLang(typ) {
  if (typ.startsWith('E')) return 'en-US';
  if (typ.startsWith('D')) return 'de-DE';
  return 'de-DE';
}
function sprich(text, lang) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.split('/')[0].trim());
  u.lang = lang || 'de-DE';
  window.speechSynthesis.speak(u);
}

// ── KI-Prompt-Generator ────────────────────────────────────────────────────
function generierePrompt(thema, anzahl, falsch, beispiele, synonyme, modus) {
  const f = Math.min(20, Math.max(0, parseInt(falsch) || 0));
  const n = Math.max(1, parseInt(anzahl) || 20);
  const t = thema.trim() || "(Thema eingeben)";

  const falschBspEn = f > 0
    ? ["gone || went | goes | go | going", "came || come | comes | comed | coming"].slice(0, 1).map(s => s.split(" || ")[1]?.split(" | ").slice(0, f).join(" | ")).join("")
    : null;
  const falschBspDe = f > 0
    ? ["gegangen | gefahren | gelaufen | geflogen"].slice(0, 1).map(s => s.split(" | ").slice(0, f).join(" | ")).join("")
    : null;
  const falschteilEn = falschBspEn ? ` || ${falschBspEn}` : "";
  const falschteilDe = falschBspDe ? ` || ${falschBspDe}` : "";

  const infoKopf = [beispiele ? "Beispielsatz" : null, synonyme ? "Synonyme" : null].filter(Boolean);
  const infoDaten = [beispiele ? "He goes to school every day." : null, synonyme ? "start, begin, head" : null].filter(Boolean);

  const kopfzeile = `Englisch // Deutsch${infoKopf.length ? " // " + infoKopf.join(" // ") : ""}`;
  const datenzeile = `go${falschteilEn} // gehen${falschteilDe}${infoDaten.length ? " // " + infoDaten.join(" // ") : ""}`;

  const regeln = [
    `- Spalten durch " // " trennen`,
    f > 0 ? `- Direkt nach jedem Wort " || " schreiben, dann genau ${f} falsche Antworten für Multiple Choice, mit " | " getrennt` : null,
    f > 0 ? `- WICHTIG: Eine falsche Antwort darf NIEMALS identisch mit der richtigen Antwort sein (auch nicht bei Groß-/Kleinschreibung)` : null,
    f > 0 ? `- Englische falsche Antworten: Mische typische Verwechslungen/Schreibfehler des Wortes (z.B. "were"→"where","wehre","where") mit gleichartigen Wörtern gleicher Wortart (Verb→andere Verben, Adjektiv→andere Adjektive). Recherchiere typische Fehlerquellen von Deutschsprachigen beim Englischlernen` : null,
    f > 0 ? `- Deutsche falsche Antworten: Verwende bedeutungsverwandte Wörter gleicher Wortart (kein Schreibfehler-Varianten, sondern echte verwandte Wörter wie bei "gehen"→"laufen, fahren, rennen")` : null,
    beispiele ? `- Die Spalte „Beispielsatz" enthält je einen natürlichen Beispielsatz auf Englisch (keine falschen Antworten)` : null,
    synonyme ? `- Die Spalte „Synonyme" enthält 2–4 englische Synonyme, kommagetrennt (keine falschen Antworten)` : null,
    `- Keine Nummerierung, keine Erklärungen — nur den rohen Text ausgeben`,
  ].filter(Boolean).join("\n");

  const einleitung = modus === "foto"
    ? `Erstelle eine Vokabelliste aus dem beigefügten Bild.`
    : `Erstelle eine Vokabelliste zum Thema „${t}" mit genau ${n} Einträgen.`;

  if (modus === "foto") {
    const fotoKopf = `Spalte1 // Spalte2 // Spalte3${infoKopf.length ? " // " + infoKopf.join(" // ") : ""}`;
    const fotoDaten = `Eintrag1${falschteilEn} // Übersetzung1${falschteilDe} // Zusatz1${infoDaten.length ? " // " + infoDaten.join(" // ") : ""}`;
    return `${einleitung}

SCHRITT 1 — LAYOUT ANALYSIEREN:
Zähle zunächst alle Textspalten im Bild. Spalten können erkennbar sein durch:
- seitliche Abstände oder Einrückungen
- unterschiedliche Schriftart (normal, kursiv, fett)
- verschiedene Textfarben
- Spalten am rechten Rand (häufig Beispielsätze oder Hinweise)
Übertrage ALLE Spalten — auch wenn sie klein, kursiv oder randständig wirken.

SCHRITT 2 — PHONETIK ENTFERNEN:
Phonetische Umschriften in eckigen Klammern [fəˈnɛtɪk], Schrägstrichen /fəˈnɛtɪk/ oder runden Klammern (fəˈnɛtɪk) werden vollständig entfernt. Nur das tatsächliche Wort oder den Satz übernehmen.

SCHRITT 3 — AUSGABE:
Erste Zeile: Spaltennamen, die den tatsächlichen Inhalt beschreiben (z.B. Englisch, Deutsch, Beispiel).
Ab Zeile 2: je eine Vokabel oder Phrase pro Zeile, Spalten mit " // " getrennt.

Beispielformat (Anzahl der Spalten an das Bild anpassen):
${fotoKopf}
${fotoDaten}

Regeln:
${regeln}`;
  }

  return `${einleitung}

Format — erste Zeile = Spaltennamen, ab Zeile 2 je eine Vokabel:
${kopfzeile}
${datenzeile}

Regeln:
${regeln}`;
}

// ── Export-Generator ──────────────────────────────────────────────────────
function generiereExportText(liste) {
  const aktiveSpalten = TYPEN.filter(t => liste.spalten[t].aktiv);
  const namenszeile = `# ${liste.name}`;
  const header = aktiveSpalten.map(t => `${liste.spalten[t].name || t} [${t}]`).join(' // ');
  const zeilen = liste.vokabeln.map(vok =>
    aktiveSpalten.map(typ => {
      if (!vok[typ]?.wert) return '';
      const { wert, falsch } = vok[typ];
      return falsch?.length > 0 ? `${wert} || ${falsch.join(' | ')}` : wert;
    }).join(' // ')
  );
  return [namenszeile, header, ...zeilen].join('\n');
}

// ── Datum-Formatierung ─────────────────────────────────────────────────────
function formatDatum(isoString) {
  if (!isoString) return "Nie";
  const d = new Date(isoString);
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Gestern";
  if (diff < 7) return `vor ${diff} Tagen`;
  return d.toLocaleDateString('de-DE', {day:'numeric', month:'numeric', year:'2-digit'});
}

// ── Import-Parser ──────────────────────────────────────────────────────────
function entferneLautsprache(text) {
  // Entfernt phonetische Umschriften in eckigen Klammern, z.B. [ˈwɜːrd] oder [bɪˈɡɪn]
  return text.replace(/\s*\[[^\]]*\]/g, '').trim();
}
function parseKolumne(teil) {
  const idx = teil.indexOf('||');
  if (idx === -1) return { wert: entferneLautsprache(teil.trim()), falsch: [] };
  const wert = entferneLautsprache(teil.slice(0, idx).trim());
  return { wert, falsch: teil.slice(idx + 2).split('|').map(f => entferneLautsprache(f.trim())).filter(Boolean) };
}
function parseZeile(zeile) { return zeile.split('//').map(t => parseKolumne(t)); }

// ── Antwort-Varianten ──────────────────────────────────────────────────────
function generiereVarianten(wert) {
  // (prefix)rest am Anfang, z.B. "(un)lucky"
  const matchLeading = wert.match(/^\(([^)]*?)-?\)(.*)$/);
  if (matchLeading) {
    const prefix = matchLeading[1].replace(/-$/, "");
    const rest = matchLeading[2].trim();
    return [wert, rest, prefix+rest, prefix+"-"+rest,
      `(${prefix})${rest}`, `(${prefix}-)${rest}`, `(${prefix}-) ${rest}`
    ].map(v => v.toLowerCase().trim());
  }
  // base (suffix) am Ende, z.B. "blow (out)"
  const matchTrailing = wert.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (matchTrailing) {
    const base = matchTrailing[1].trim();
    const suffix = matchTrailing[2].trim();
    return [wert, `${base} ${suffix}`, base].map(v => v.toLowerCase().trim());
  }
  return [wert.toLowerCase().trim()];
}
function istRichtigeAntwort(eingabe, wert) {
  return generiereVarianten(wert).includes(eingabe.toLowerCase().trim());
}

// ── Scoring ────────────────────────────────────────────────────────────────
function berechneNeuenScore(fortschritt, ereignis, sessionFalschAnzahl, modus) {
  const f = fortschritt || { score:0, streak:0, aufgedecktStreak:0, letzteAbfrage:null };
  const neu = { ...f, letzteAbfrage: new Date().toISOString() };
  if (ereignis === "richtig") {
    neu.score += 1; neu.streak += 1; neu.aufgedecktStreak = 0;
    if (neu.streak >= 3) neu.score = Math.max(neu.score, 2);
  } else if (ereignis === "falsch") {
    neu.streak = 0; neu.aufgedecktStreak = 0;
    if (sessionFalschAnzahl <= 2) neu.score -= 1;
    else if (sessionFalschAnzahl <= 5) neu.score -= 2;
    else neu.score -= 3;
  } else if (ereignis === "aufgedeckt") {
    neu.streak = 0; neu.aufgedecktStreak += 1;
    if (modus === "schwer") neu.score -= 1;
    if (neu.aufgedecktStreak >= 3 && neu.score > -100) neu.score = -100;
  }
  return neu;
}
function speichereScore(liste, vokId, neuFortschritt) {
  const vok = liste.vokabeln.find(v => v.id === vokId);
  const listeId = vok?._listeId || liste.id;
  const origId = vok?._origId ?? vokId;
  if (listeId && listeId !== 'combined') {
    const origListe = listeId === liste.id ? liste : lsGet(SK.liste(listeId));
    if (origListe) lsSet(SK.liste(listeId), { ...origListe, vokabeln: origListe.vokabeln.map(v => v.id === origId ? {...v, fortschritt: neuFortschritt} : v) });
  }
  return { ...liste, vokabeln: liste.vokabeln.map(v => v.id === vokId ? {...v, fortschritt: neuFortschritt} : v) };
}

// ── Diktat-Hilfsfunktionen ─────────────────────────────────────────────────
function diktatHint(wort, aufgedeckt) {
  if (!aufgedeckt) return null;
  return wort.split('').map((ch, i) => i < aufgedeckt ? ch : '·').join(' ');
}
function berechneDiktatScore(fortschritt, ereignis) {
  const f = fortschritt || { score:0, letzteAbfrage:null };
  const neu = { ...f, letzteAbfrage: new Date().toISOString() };
  if (ereignis === "richtig") neu.score += 1;
  else if (ereignis === "aufgedeckt") neu.score -= 1;
  return neu;
}
function speichereDiktatScore(liste, vokId, neuFortschritt) {
  const vok = liste.vokabeln.find(v => v.id === vokId);
  const listeId = vok?._listeId || liste.id;
  const origId = vok?._origId ?? vokId;
  if (listeId && listeId !== 'combined') {
    const origListe = listeId === liste.id ? liste : lsGet(SK.liste(listeId));
    if (origListe) lsSet(SK.liste(listeId), { ...origListe, vokabeln: origListe.vokabeln.map(v => v.id === origId ? {...v, diktatFortschritt: neuFortschritt} : v) });
  }
  return { ...liste, vokabeln: liste.vokabeln.map(v => v.id === vokId ? {...v, diktatFortschritt: neuFortschritt} : v) };
}

// ── Styling ────────────────────────────────────────────────────────────────
const C = {
  bg:"#f7f5f0", surface:"#ffffff", border:"#e0dbd2",
  accent:"#2d6a4f", accentHi:"#40916c", danger:"#c0392b",
  text:"#1a1a1a", muted:"#6b6560", tag:"#e8f5e9", tagText:"#2d6a4f",
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:#f7f5f0;font-family:system-ui,sans-serif;color:#1a1a1a;}
  .app{max-width:600px;margin:0 auto;padding:0 0 80px;}
  .topbar{background:#fff;border-bottom:1px solid #e0dbd2;padding:14px 16px;display:flex;align-items:center;gap:12px;}
  .topbar-title{font-size:1.05rem;font-weight:700;flex:1;text-align:center;}
  .topbar-back{background:#2d6a4f;color:#fff;font-size:0.88rem;font-weight:600;cursor:pointer;border:none;padding:8px 12px;border-radius:10px;font-family:inherit;transition:opacity .15s;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;}
  .topbar-back:active{opacity:.8;}
  .tabs{display:flex;background:#fff;border-bottom:1px solid #e0dbd2;}
  .statistik-listen-header{background:#fff;border-bottom:1px solid #e0dbd2;padding:10px 16px;display:flex;align-items:center;gap:8px;position:sticky;z-index:8;}
  .liste-detail-header{background:#fff;border-bottom:1px solid #e0dbd2;padding:12px 16px;display:flex;align-items:center;gap:10px;position:sticky;z-index:9;}
  .tab{flex:1;padding:12px 4px;font-size:0.82rem;font-weight:600;color:#6b6560;background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;}
  .tab.aktiv{color:#2d6a4f;border-bottom-color:#2d6a4f;}
  .sektion{padding:20px 16px 0;}
  .sektion-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .sektion-label{font-size:0.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#6b6560;}
  .karte{background:#fff;border:1px solid #e0dbd2;border-radius:12px;overflow:hidden;margin-bottom:16px;}
  .karte-zeile{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid #e0dbd2;gap:12px;}
  .karte-zeile:last-child{border-bottom:none;}
  .karte-zeile-info{flex:1;min-width:0;}
  .karte-zeile-name{font-weight:600;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .karte-zeile-sub{font-size:0.78rem;color:#6b6560;margin-top:2px;}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 18px;border-radius:10px;font-size:0.88rem;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s;}
  .btn:active{opacity:.8;}
  .btn-primary{background:#2d6a4f;color:#fff;border:1.5px solid transparent;}
  .btn-ghost{background:transparent;color:#2d6a4f;border:1.5px solid #2d6a4f;}
  .btn-ghost-filled{background:#f7f5f0;color:#2d6a4f;border:1.5px solid #2d6a4f;}
  .btn-sm{padding:6px 12px;font-size:0.8rem;min-height:30px;}
  .btn-danger{background:transparent;color:#c0392b;border:1.5px solid #c0392b;}
  .btn-icon{background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;color:#6b6560;font-size:0.82rem;font-weight:600;}
  .btn-icon:hover{background:#f0ede8;}
  .inp{width:100%;background:#f7f5f0;border:1.5px solid #e0dbd2;border-radius:10px;padding:11px 14px;font-size:0.95rem;color:#1a1a1a;outline:none;font-family:inherit;}
  .inp:focus{border-color:#2d6a4f;background:#fff;}
  .inp::placeholder{color:#c0bcb7;}
  textarea.inp{resize:vertical;font-family:monospace;font-size:0.82rem;line-height:1.5;}
  select.inp{cursor:pointer;}
  .inp-label{font-size:0.8rem;font-weight:600;color:#6b6560;margin-bottom:6px;display:block;}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;z-index:100;padding:16px;}
  .modal{background:#fff;border-radius:16px;width:100%;max-width:500px;padding:24px;}
  .modal-titel{font-size:1.1rem;font-weight:700;margin-bottom:16px;}
  .modal-actions{display:flex;gap:10px;margin-top:20px;justify-content:flex-end;}
  .leer{text-align:center;padding:48px 24px;color:#6b6560;}
  .leer-text{font-size:0.9rem;line-height:1.5;margin-top:8px;}
  .spalten-badge{font-size:0.68rem;font-weight:700;padding:1px 6px;border-radius:4px;background:#ece9e4;color:#b0aba5;margin-right:3px;}
  .spalten-badge.aktiv{background:#e8f5e9;color:#2d6a4f;}
  .typ-btn{font-size:0.78rem;font-weight:600;padding:5px 10px;border-radius:6px;border:1.5px solid #e0dbd2;background:#f7f5f0;color:#6b6560;cursor:pointer;font-family:inherit;}
  .typ-btn.aktiv{background:#2d6a4f;color:#fff;border-color:#2d6a4f;}
  .typ-btn:disabled{opacity:0.3;cursor:not-allowed;}
  .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;}
  .toggle-label{font-weight:600;font-size:0.9rem;}
  .toggle-sub{font-size:0.78rem;color:#6b6560;margin-top:2px;}
  .toggle-btn{display:flex;border-radius:8px;overflow:hidden;border:1.5px solid #e0dbd2;}
  .toggle-opt{padding:6px 14px;font-size:0.82rem;font-weight:600;background:none;border:none;cursor:pointer;color:#6b6560;font-family:inherit;}
  .toggle-opt.aktiv{background:#2d6a4f;color:#fff;}
  .meldung-info{background:#e8f4fd;color:#1565c0;border:1px solid #bbdefb;padding:12px 16px;border-radius:10px;font-size:0.85rem;margin-bottom:16px;line-height:1.6;}
  .fehler{color:#c0392b;font-size:0.82rem;margin-top:8px;margin-bottom:8px;}
  .fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:28px;background:#2d6a4f;color:#fff;font-size:1.6rem;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:20;}
  .spalten-zuweisung{padding:14px 16px;border-bottom:1px solid #e0dbd2;}
  .spalten-zuweisung:last-child{border-bottom:none;}
  .typ-buttons{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}
  .import-kompakt{display:flex;align-items:center;gap:8px;margin-top:6px;}
  .import-beispiel{font-size:0.78rem;color:#6b6560;margin-top:3px;}
  .import-zaehler{font-size:0.82rem;color:#6b6560;margin-bottom:12px;}
  .import-zaehler strong{color:#2d6a4f;}
  .slot-chip{padding:7px 13px;border-radius:8px;border:1.5px solid #e0dbd2;background:#f7f5f0;font-size:0.78rem;font-weight:600;color:#6b6560;cursor:pointer;font-family:inherit;white-space:nowrap;}
  .slot-chip.belegt{background:#e8f5e9;border-color:#2d6a4f;color:#2d6a4f;}
  .slot-chip.zuletzt{background:#fffde7;border-color:#f9a825;color:#e65100;}
  .slot-chip.leer{opacity:0.35;cursor:default;}
  .score-badge{font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:10px;}
  .score-pos{background:#e8f5e9;color:#2d6a4f;}
  .score-neg{background:#ffebee;color:#c0392b;}
  .score-null{background:#e0dbd2;color:#6b6560;}
  .quiz-frage-box{background:#fff;border:1px solid #e0dbd2;border-radius:14px;padding:20px;margin-bottom:14px;}
  .quiz-label{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6b6560;margin-bottom:6px;}
  .quiz-frage-text{font-size:1.5rem;font-weight:700;line-height:1.3;}
  .quiz-info-text{font-size:0.85rem;color:#6b6560;margin-top:6px;}
  .quiz-antwort-box{background:#fff;border:1.5px solid #e0dbd2;border-radius:14px;padding:18px;margin-bottom:14px;transition:border-color .2s,background .2s;min-height:120px;}
  .quiz-antwort-box.richtig{border-color:#40916c;background:#e8f5e9;}
  .quiz-antwort-box.falsch{border-color:#c0392b;background:#ffebee;}
  .quiz-antwort-box.aufgedeckt{background:#fffde7;border-color:#f9a825;}
  .quiz-antwort-box.weitere{border-color:#7b1fa2;background:#f3e5f5;}
  .quiz-antwort-box.spalte-ok{border-color:#40916c;background:#e8f5e9;}
  .quiz-loesung-text{font-size:1.15rem;font-weight:600;margin-top:8px;}
  .quiz-feedback{font-size:0.88rem;font-weight:600;margin-top:6px;}
  .quiz-feedback.ok{color:#1b5e20;}
  .quiz-feedback.nein{color:#b71c1c;}
  .quiz-feedback.info{color:#6a1b9a;}
  .quiz-fortschritt{font-size:0.82rem;color:#6b6560;}
  .quiz-aktionen{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;}
  .quiz-action-bar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:600px;background:#fff;border-top:1px solid #e0dbd2;padding:12px 16px 20px;display:flex;gap:10px;flex-wrap:wrap;z-index:20;}
  .quiz-liste-sticky{position:sticky;top:57px;background:#fff;border-bottom:1px solid #e0dbd2;padding:8px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;z-index:9;}
  .vok-zeile{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid #f0ede8;cursor:pointer;}
  .vok-zeile:last-child{border-bottom:none;}
  .vok-zeile:active{background:#f7f5f0;}
  .vok-nr{font-size:0.72rem;color:#6b6560;min-width:28px;text-align:right;flex-shrink:0;}
  .spalten-rolle-btn{font-size:0.72rem;font-weight:700;padding:4px 8px;border-radius:6px;border:1.5px solid #e0dbd2;background:#f7f5f0;color:#6b6560;cursor:pointer;font-family:inherit;}
  .spalten-rolle-btn.frage{background:#2d6a4f;color:#fff;border-color:#2d6a4f;}
  .spalten-rolle-btn.antwort{background:#2d6a4f;color:#fff;border-color:#2d6a4f;}
  .spalten-rolle-btn.info{background:#f9a825;color:#fff;border-color:#f9a825;}
  .spalten-modus-btn{font-size:0.72rem;font-weight:700;padding:4px 8px;border-radius:6px;border:1.5px solid #e0dbd2;background:#f7f5f0;color:#6b6560;cursor:pointer;font-family:inherit;}
  .spalten-modus-btn.aktiv{background:#52b788;color:#fff;border-color:#52b788;}
  .quiz-vorig{background:#f0f7f0;border:1px solid #c8e6c9;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:0.88rem;color:#2d6a4f;}
  .quiz-vorig-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#40916c;margin-bottom:3px;}
  .quiz-setup-check{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #e0dbd2;cursor:pointer;}
  .quiz-setup-check:last-child{border-bottom:none;}
  .checkbox{width:20px;height:20px;border-radius:5px;border:2px solid #e0dbd2;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#f7f5f0;}
  .checkbox.checked{background:#2d6a4f;border-color:#2d6a4f;color:#fff;}
  .liste-detail-header-name{flex:1;font-size:0.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .btn-toggle{background:#2d6a4f;color:#fff;border:none;cursor:pointer;padding:6px 9px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
  .btn-toggle:active{opacity:.8;}
  .btn-toggle-ghost{background:#f7f5f0;color:#2d6a4f;border:1.5px solid #2d6a4f;cursor:pointer;padding:5px 8px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
  .btn-toggle-ghost:active{opacity:.8;}
  .diktat-hint{font-size:1.8rem;font-weight:700;letter-spacing:0.2em;color:#2d6a4f;margin:10px 0 6px;font-family:monospace;}
  .diktat-uebersetzung{font-size:0.85rem;color:#6b6560;margin-top:4px;}
  .diktat-play-btn{background:none;border:none;font-size:3rem;cursor:pointer;display:block;margin:8px auto;line-height:1;}
  .diktat-summary-zeile{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0ede8;}
  .karte-bewertung{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;}
  .karte-btn{padding:22px 16px;border-radius:14px;font-size:1.05rem;font-weight:700;border:none;cursor:pointer;font-family:inherit;transition:opacity .15s;width:100%;}
  .karte-btn:active{opacity:.8;}
  .karte-btn-ja{background:#2d6a4f;color:#fff;}
  .karte-btn-nein{background:#c0392b;color:#fff;}
  .karte-aufdecken{text-align:center;padding:20px 0;color:#b0aba5;font-size:0.9rem;font-style:italic;}
`;

const TYPEN = ["E1","E2","D1","D2","i1","i2"];
const APP_VERSION = (() => {
  const d = new Date(__BUILD_TIME__);
  return d.toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'})
    + ' ' + d.toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'});
})();

const IcoUp    = ({s=12}) => <svg viewBox="0 0 12 8" width={s} height={s*.67} style={{display:"block"}}><polygon points="6,0 12,8 0,8" fill="currentColor"/></svg>;
const IcoDown  = ({s=12}) => <svg viewBox="0 0 12 8" width={s} height={s*.67} style={{display:"block"}}><polygon points="0,0 12,0 6,8" fill="currentColor"/></svg>;
const IcoBack  = ({s=20}) => <svg viewBox="0 0 20 20" width={s} height={s} style={{display:"block"}}><path d="M13,2 L3,10 L13,18 L13,13 L17,13 L17,7 L13,7 Z" fill="currentColor"/></svg>;
const IcoX     = ({s=14}) => <svg viewBox="0 0 14 14" width={s} height={s} style={{display:"block"}}><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>;
const IcoPencil= ({s=15}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><polygon points="13,0 16,3 5,14 2,11" fill="currentColor"/><polygon points="2,11 5,14 0,16" fill="currentColor"/></svg>;
const IcoSpk   = ({s=18}) => <svg viewBox="0 0 20 20" width={s} height={s} style={{display:"block"}}><polygon points="2,7 2,13 6,13 12,18 12,2 6,7" fill="currentColor"/></svg>;
const IcoSpkOn = ({s=20}) => <svg viewBox="0 0 26 20" width={s} height={s*.77} style={{display:"block"}}><polygon points="2,7 2,13 6,13 12,18 12,2 6,7" fill="currentColor"/><path d="M15,7 Q17,10 15,13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M18,4 Q22,10 18,16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const IcoPlus  = ({s=15}) => <svg viewBox="0 0 14 14" width={s} height={s} style={{display:"block"}}><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>;
const IcoShare = ({s=15}) => <svg viewBox="0 0 16 18" width={s} height={s*1.1} style={{display:"block"}}><path d="M8,1 L8,12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M4,5 L8,1 L12,5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3,9 L3,16 L13,16 L13,9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IcoCopy  = ({s=15}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><rect x="5" y="1" width="10" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="1" y="4" width="10" height="11" rx="2" fill="#fff" stroke="currentColor" strokeWidth="2"/></svg>;

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
  const [jsonExportIds, setJsonExportIds] = useState(null);
  const [jsonExportOptionen, setJsonExportOptionen] = useState({ fortschritt: true, diktatFortschritt: true, falsch: true });
  const [editSpalteTyp, setEditSpalteTyp] = useState(null);

  const [bearbeiteVokabel, setBearbeiteVokabel] = useState(null);
  const [bearbeiteEingaben, setBearbeiteEingaben] = useState({});
  const [mergeQuelleId, setMergeQuelleId] = useState("");

  const [importText, setImportText] = useState("");
  const [importDateiname, setImportDateiname] = useState("");
  const [importParsed, setImportParsed] = useState(null);
  const [importMehrfachListen, setImportMehrfachListen] = useState(null);
  const [importJsonData, setImportJsonData] = useState(null);
  const [importMapping, setImportMapping] = useState({});
  const [importZielTyp, setImportZielTyp] = useState("neu");
  const [importNeuName, setImportNeuName] = useState("");
  const [importBestehendId, setImportBestehendId] = useState("");
  const [importFehler, setImportFehler] = useState("");

  const [quizAusgewaehlt, setQuizAusgewaehlt] = useState(["D1", "E1"]);
  const [quizFrageTyp, setQuizFrageTyp] = useState("D1");
  const [quizAntwortTypenGeordnet, setQuizAntwortTypenGeordnet] = useState(["E1"]);
  const [quizInfoTypenSession, setQuizInfoTypenSession] = useState([]);
  const [quizSpalteModus, setQuizSpalteModus] = useState({ E1: "karte" });
  const [quizZeigeInfo, setQuizZeigeInfo] = useState({ i1: true, i2: true });
  const [quizModus, setQuizModus] = useState("sequenziell");
  const [quizModusInfoAufgeklappt, setQuizModusInfoAufgeklappt] = useState(false);
  const [quizDiktatSpalte, setQuizDiktatSpalte] = useState("E1");
  const [quizDiktatUebersetzung, setQuizDiktatUebersetzung] = useState("D1");
  const [quizListeAufgeklappt, setQuizListeAufgeklappt] = useState(false);
  const [quizCheckboxAuswahl, setQuizCheckboxAuswahl] = useState(new Set());
  const [quizVonBisModus, setQuizVonBisModus] = useState(false);
  const [quizVonBisErster, setQuizVonBisErster] = useState(null);
  const [promptThema, setPromptThema] = useState("");
  const [promptAnzahl, setPromptAnzahl] = useState(20);
  const [promptBeispiele, setPromptBeispiele] = useState(false);
  const [promptFalsch, setPromptFalsch] = useState(3);
  const [promptModus, setPromptModus] = useState("generieren");
  const [promptSynonyme, setPromptSynonyme] = useState(false);
  const [promptKopiert, setPromptKopiert] = useState(false);
  const [letzterPrompt, setLetzterPrompt] = useState("");
  const [exportKopiert, setExportKopiert] = useState(false);
  const [exportAuswahlModus, setExportAuswahlModus] = useState(false);
  const [exportAusgewaehlt, setExportAusgewaehlt] = useState(new Set());
  const [statistikSort, setStatistikSort] = useState("score-asc");
  const [statistikFilter, setStatistikFilter] = useState("alle");
  const [statistikListenIds, setStatistikListenIds] = useState(null); // null = alle
  const [statistikListenAufgeklappt, setStatistikListenAufgeklappt] = useState(false);
  const [statistikGraphOhneUnbeantwortet, setStatistikGraphOhneUnbeantwortet] = useState(false);
  const [sessionSlots, setSessionSlots] = useState([]);
  const [quizBereichTyp, setQuizBereichTyp] = useState("alle");
  const [quizReihenfolge, setQuizReihenfolge] = useState("zufall");
  const [quizSchlechtesteAnzahl, setQuizSchlechtesteAnzahl] = useState(20);
  const [quizSchlechtesteMaxScore, setQuizSchlechtesteMaxScore] = useState("");
  const [quizUnbeantwortetZuerst, setQuizUnbeantwortetZuerst] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [diktatListeAufgeklappt, setDiktatListeAufgeklappt] = useState(false);
  const [vokabelAufgeklappt, setVokabelAufgeklappt] = useState(false);
  const [aktionszeileAufgeklappt, setAktionszeileAufgeklappt] = useState(false);
  const [diktatManualPlays, setDiktatManualPlays] = useState(0);
  const [quizTabListen, setQuizTabListen] = useState([]);
  const [listenAuswahlAufgeklappt, setListenAuswahlAufgeklappt] = useState(true);
  const eingabeRef = useRef(null);
  const flashTimerRef = useRef(null);
  const diktatPlayCountRef = useRef(0);
  const fileInputRef = useRef(null);
  const headerRef = useRef(null);
  const listenContainerRef = useRef(null);
  const statistikListenHeaderRef = useRef(null);
  const alleBereichRef = useRef(null);
  const einzelauswahlRef = useRef(null);
  const [headerH, setHeaderH] = useState(104);
  const [alleBereichH, setAlleBereichH] = useState(0);
  const [statistikListenHeaderH, setStatistikListenHeaderH] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderH(el.offsetHeight);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Listenauswahl: schließt wenn Inhalt-Unterkante die Header-Unterkante passiert
  useEffect(() => {
    const onScroll = () => {
      const el = listenContainerRef.current;
      if (!el || el.offsetHeight === 0) return;
      if (el.getBoundingClientRect().bottom <= headerH) {
        setListenAuswahlAufgeklappt(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [headerH]);

  // Einzelauswahl: schließt wenn Inhalt-Unterkante die Quiz-Button-Oberkante passiert
  useEffect(() => {
    const onScroll = () => {
      const el = einzelauswahlRef.current;
      if (!el || el.offsetHeight === 0) return;
      if (el.getBoundingClientRect().bottom <= headerH + alleBereichH) {
        setQuizListeAufgeklappt(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [headerH, alleBereichH]);

  // Alle/Bereich-Zeile Höhe messen
  useEffect(() => {
    const el = alleBereichRef.current;
    if (!el) { setAlleBereichH(0); return; }
    const obs = new ResizeObserver(() => setAlleBereichH(el.offsetHeight));
    obs.observe(el);
    setAlleBereichH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length]);

  // Von-Bis-Modus beenden wenn Einzelauswahl schließt (manuell oder auto)
  useEffect(() => {
    if (!quizListeAufgeklappt) {
      setQuizVonBisModus(false);
      setQuizVonBisErster(null);
    }
  }, [quizListeAufgeklappt]);

  useEffect(() => {
    const el = statistikListenHeaderRef.current;
    if (!el) return;
    const update = () => setStatistikListenHeaderH(el.offsetHeight);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab]);

  useEffect(() => {
    setListenIndex(lsGet(SK.listenIndex, []));
    setEinstellungen(lsGet(SK.einstellungen, defaultEinstellungen()));
    let slots = lsGet(SK.sessionSlots);
    if (!slots) { slots = defaultSessionSlots(); lsSet(SK.sessionSlots, slots); }
    setSessionSlots(slots);
  }, []);

  useEffect(() => {
    if (aktiveListeId) setAktiveListe(lsGet(SK.liste(aktiveListeId)));
  }, [aktiveListeId, ansicht]);

  useEffect(() => {
    if (ansicht === "quiz" && eingabeRef.current) eingabeRef.current.focus();
  }, [ansicht, quiz?.index, quiz?.phase, quiz?.antwortTypIndex]);

  useEffect(() => {
    if (quizTabListen.length === 0) setListenAuswahlAufgeklappt(true);
  }, [quizTabListen.length]);

  useEffect(() => {
    if (ansicht !== "quiz" || !quiz || quiz.phase !== "eingabe" || quiz.flash) return;
    if (quiz.modus === "diktat") {
      const text = quiz.vokabeln?.[quiz.index]?.[quiz.diktatSpalte]?.wert;
      if (text) sprich(text, spalteLang(quiz.diktatSpalte));
      return;
    }
    if (!einstellungen.autoplay) return;
    if (!(einstellungen.vorlesen || ["E1"]).includes(quiz.frageTyp)) return;
    const text = quiz.vokabeln?.[quiz.index]?.[quiz.frageTyp]?.wert;
    if (text) sprich(text, spalteLang(quiz.frageTyp));
  }, [quiz?.index, ansicht, einstellungen.autoplay]);

  useEffect(() => {
    if (ansicht !== "quiz" || !quiz) return;
    const isDiktatWeiter = quiz.modus === "diktat" && (quiz.phase === "richtig" || quiz.phase === "aufgedeckt");
    const isKarteAufgedeckt = quiz.modus !== "diktat" && quiz.phase === "aufgedeckt" &&
      (quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] || "tippen") === "karte";
    if (quiz.phase !== "aufgedeckt" && !isDiktatWeiter) return;
    if (isKarteAufgedeckt) return;
    let active = false;
    const tid = setTimeout(() => { active = true; }, 250);
    const handler = (e) => {
      if (!active) return;
      if (e.key === "Enter" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        if (quiz.modus === "diktat") naechsteDiktatVokabel();
        else naechsteVokabel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => { clearTimeout(tid); document.removeEventListener("keydown", handler); };
  }, [quiz, ansicht]);

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────
  function speichereIndex(idx) { setListenIndex(idx); lsSet(SK.listenIndex, idx); }
  function speichereEinst(e) { setEinstellungen(e); lsSet(SK.einstellungen, e); }
  const vokabelAnzahl = id => { const l = lsGet(SK.liste(id)); return l ? l.vokabeln.length : 0; };

  // ── Listen-Aktionen ───────────────────────────────────────────────────────
  function erstelleListe() {
    const name = modalInput.trim();
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
    const id = "liste_" + Date.now();
    lsSet(SK.liste(id), neueListeObjekt(id, name));
    speichereIndex([...listenIndex, { id, name }]);
    setModal(null); setModalInput(""); setModalFehler("");
  }

  function umbenennen() {
    const name = modalInput.trim();
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.id !== aktiveListeId && l.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
    speichereIndex(listenIndex.map(l => l.id === aktiveListeId ? {...l, name} : l));
    const aktuell = lsGet(SK.liste(aktiveListeId));
    if (aktuell) { const u = {...aktuell, name}; lsSet(SK.liste(aktiveListeId), u); setAktiveListe(u); }
    setModal(null); setModalInput(""); setModalFehler("");
  }

  function loeschen() {
    localStorage.removeItem(SK.liste(aktiveListeId));
    speichereIndex(listenIndex.filter(l => l.id !== aktiveListeId));
    setModal(null); setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null);
  }

  function speichereSpaltenname() {
    if (!editSpalteTyp || !aktiveListe) return;
    const updated = { ...aktiveListe, spalten: { ...aktiveListe.spalten, [editSpalteTyp]: { ...aktiveListe.spalten[editSpalteTyp], name: modalInput.trim() } } };
    lsSet(SK.liste(aktiveListeId), updated);
    setAktiveListe(updated);
    speichereIndex(listenIndex); // trigger re-render
    setModal(null); setModalInput(""); setEditSpalteTyp(null);
  }

  function oeffneModal(typ, extra) {
    if (typ === "umbenennen") setModalInput(aktiveListe?.name || "");
    else if (typ === "spalte-umbenennen" && extra) {
      setEditSpalteTyp(extra);
      setModalInput(aktiveListe?.spalten[extra]?.name || "");
    } else setModalInput("");
    setModalFehler(""); setModal(typ);
  }

  // ── Vokabel-Verwaltung ────────────────────────────────────────────────────
  function oeffneVokabelBearbeiten(vok) {
    const aktiveSpalten = TYPEN.filter(t => aktiveListe.spalten[t].aktiv);
    const eingaben = {};
    aktiveSpalten.forEach(typ => {
      if (vok[typ]) {
        const falschStr = vok[typ].falsch?.length > 0 ? ' || ' + vok[typ].falsch.join(' | ') : '';
        eingaben[typ] = vok[typ].wert + falschStr;
      } else {
        eingaben[typ] = '';
      }
    });
    setBearbeiteVokabel(vok);
    setBearbeiteEingaben(eingaben);
    setModal('vokabel-bearbeiten');
  }

  function speichereVokabelBearbeitung() {
    if (!bearbeiteVokabel || !aktiveListe) return;
    const aktiveSpalten = TYPEN.filter(t => aktiveListe.spalten[t].aktiv);
    const updated = { id: bearbeiteVokabel.id, fortschritt: bearbeiteVokabel.fortschritt };
    aktiveSpalten.forEach(typ => {
      const raw = (bearbeiteEingaben[typ] || '').trim();
      if (raw) updated[typ] = parseKolumne(raw);
    });
    const neueListe = { ...aktiveListe, vokabeln: aktiveListe.vokabeln.map(v => v.id === updated.id ? updated : v) };
    lsSet(SK.liste(aktiveListeId), neueListe);
    setAktiveListe(neueListe);
    setModal(null); setBearbeiteVokabel(null); setBearbeiteEingaben({});
  }

  function loescheVokabel(vokId) {
    const neueListe = { ...aktiveListe, vokabeln: aktiveListe.vokabeln.filter(v => v.id !== vokId) };
    lsSet(SK.liste(aktiveListeId), neueListe);
    setAktiveListe(neueListe);
    setModal(null); setBearbeiteVokabel(null);
  }

  function fuehreListenZusammen() {
    if (!mergeQuelleId || mergeQuelleId === aktiveListeId) return;
    const quelle = lsGet(SK.liste(mergeQuelleId));
    if (!quelle) return;
    const ziel = { ...aktiveListe, spalten: {...aktiveListe.spalten}, vokabeln: [...aktiveListe.vokabeln], naechste_id: aktiveListe.naechste_id };
    TYPEN.forEach(typ => {
      if (!ziel.spalten[typ].aktiv && quelle.spalten[typ].aktiv)
        ziel.spalten[typ] = { name: quelle.spalten[typ].name, aktiv: true };
    });
    quelle.vokabeln.forEach(v => ziel.vokabeln.push({ ...v, id: ziel.naechste_id++ }));
    lsSet(SK.liste(aktiveListeId), ziel);
    setAktiveListe(ziel);
    setModal(null); setMergeQuelleId('');
  }

  // ── Export-Aktionen ───────────────────────────────────────────────────────
  async function teileListeHandler() {
    if (!aktiveListe || !navigator.share) return;
    const text = generiereExportText(aktiveListe);
    try { await navigator.share({ title: aktiveListe.name, text }); } catch {}
  }
  async function kopiereListeHandler() {
    if (!aktiveListe) return;
    const text = generiereExportText(aktiveListe);
    try {
      await navigator.clipboard.writeText(text);
      setExportKopiert(true);
      setTimeout(() => setExportKopiert(false), 2000);
    } catch {}
  }
  function generiereKombiniertenExport(ids) {
    return ids.map(id => { const l = lsGet(SK.liste(id)); return l ? generiereExportText(l) : null; })
      .filter(Boolean).join('\n\n');
  }
  async function exportiereAusgewaehlteTeilenHandler() {
    if (exportAusgewaehlt.size === 0 || !navigator.share) return;
    const text = generiereKombiniertenExport([...exportAusgewaehlt]);
    const title = exportAusgewaehlt.size === 1
      ? listenIndex.find(l => l.id === [...exportAusgewaehlt][0])?.name || 'Vokabeln'
      : `${exportAusgewaehlt.size} Vokabellisten`;
    try { await navigator.share({ title, text }); } catch {}
  }
  async function exportiereAusgewaehlteKopierenHandler() {
    if (exportAusgewaehlt.size === 0) return;
    const text = generiereKombiniertenExport([...exportAusgewaehlt]);
    try {
      await navigator.clipboard.writeText(text);
      setExportKopiert(true);
      setTimeout(() => setExportKopiert(false), 2000);
    } catch {}
  }

  function teileAlsDatei(text, dateiname) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function teileListeAlsDateiHandler() {
    if (!aktiveListe) return;
    await teileAlsDatei(generiereExportText(aktiveListe), `${aktiveListe.name}.txt`);
  }
  async function teileListeAlsJsonHandler() {
    if (!aktiveListe) return;
    const liste = lsGet(SK.liste(aktiveListeId));
    if (!liste) return;
    const text = JSON.stringify([liste], null, 2);
    const dateiname = `${aktiveListe.name}.json`;
    if (navigator.canShare) {
      const file = new File([text], dateiname, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: aktiveListe.name }); return; } catch {}
      }
    }
    teileAlsDatei(text, dateiname);
  }
  async function exportiereAusgewaehlteAlsDateiHandler() {
    if (exportAusgewaehlt.size === 0) return;
    const ids = [...exportAusgewaehlt];
    const text = generiereKombiniertenExport(ids);
    const name = ids.length === 1
      ? listenIndex.find(l => l.id === ids[0])?.name || 'Vokabeln'
      : `${ids.length}_Listen`;
    await teileAlsDatei(text, `${name}.txt`);
  }

  function toggleStatistikListe(id) {
    setStatistikListenIds(prev => {
      const currentSet = prev === null
        ? new Set(listenIndex.map(l => l.id))
        : new Set(prev);
      if (currentSet.has(id)) {
        currentSet.delete(id);
      } else {
        currentSet.add(id);
        if (currentSet.size === listenIndex.length) return null;
      }
      return currentSet;
    });
  }

  // ── Import-Aktionen ───────────────────────────────────────────────────────
  function resetImport() {
    setImportText(""); setImportDateiname(""); setImportParsed(null);
    setImportMehrfachListen(null); setImportJsonData(null); setImportMapping({});
    setImportZielTyp("neu"); setImportNeuName(""); setImportBestehendId(""); setImportFehler("");
  }

  function autoMappeKolumnen(headerNamen) {
    const VALID = new Set(['E1','E2','D1','D2','i1','i2']);
    const mapping = {};
    const used = new Set();
    // Pass 1: extract [TYPE] tags from header names (reliable, from our own export)
    headerNamen.forEach((name, idx) => {
      const m = name.match(/\[([EDi][12])\]\s*$/);
      if (m && VALID.has(m[1]) && !used.has(m[1])) {
        mapping[idx] = m[1];
        used.add(m[1]);
      } else {
        mapping[idx] = null;
      }
    });
    // Pass 2 (fallback for files without tags): keyword detection
    if (used.size === 0) {
      const eKeys = ['english', 'englisch'];
      const dKeys = ['deutsch', 'german'];
      let eCount = 0, dCount = 0, iCount = 0;
      headerNamen.forEach((name, idx) => {
        const low = name.toLowerCase().trim();
        if (eKeys.some(k => low.includes(k)) && eCount < 2) mapping[idx] = ['E1','E2'][eCount++];
        else if (dKeys.some(k => low.includes(k)) && dCount < 2) mapping[idx] = ['D1','D2'][dCount++];
        else if (iCount < 2) mapping[idx] = ['i1','i2'][iCount++];
      });
      if (eCount === 0 && dCount === 0) {
        const pos = ['E1','D1','i1','E2','D2','i2'];
        headerNamen.forEach((_, idx) => { mapping[idx] = pos[idx] ?? null; });
      }
    }
    return mapping;
  }

  function analysiereImport() {
    const normiert = importText.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const alleZeilen = normiert.trim().split('\n').filter(z => z.trim());
    if (alleZeilen.length < 2) { setImportFehler("Mindestens 2 Zeilen erforderlich."); return; }

    const hashIdx = alleZeilen.reduce((acc, z, i) => z.startsWith('# ') ? [...acc, i] : acc, []);
    if (hashIdx.length > 1) {
      const sektionen = hashIdx.map((startIdx, si) => {
        const endIdx = hashIdx[si + 1] ?? alleZeilen.length;
        const sz = alleZeilen.slice(startIdx, endIdx);
        const name = sz[0].slice(2).trim();
        const rest = sz.slice(1);
        if (rest.length < 2) return null;
        const header = parseZeile(rest[0]);
        const daten = rest.slice(1).map(parseZeile);
        const mapping = autoMappeKolumnen(header.map(h => h.wert));
        return { name, header, daten, mapping };
      }).filter(Boolean);
      if (!sektionen.length) { setImportFehler("Keine gültigen Listen gefunden."); return; }
      setImportMehrfachListen(sektionen);
      setImportParsed(null);
      setImportFehler("");
      return;
    }

    setImportMehrfachListen(null);
    let zeilen = alleZeilen;
    let erkannterName = '';
    if (zeilen[0].startsWith('# ')) {
      erkannterName = zeilen[0].slice(2).trim();
      zeilen = zeilen.slice(1);
      if (zeilen.length < 2) { setImportFehler("Mindestens 2 Zeilen erforderlich."); return; }
    }
    const header = parseZeile(zeilen[0]);
    const daten = zeilen.slice(1).map(parseZeile);
    const mapping = {};
    header.forEach((_, i) => { mapping[i] = null; });
    setImportParsed({ header, daten });
    setImportMapping(mapping);
    if (erkannterName && !importNeuName) setImportNeuName(erkannterName);
    setImportFehler("");
  }

  function importiereAlleListen() {
    if (!importMehrfachListen?.length) return;
    const neuerIndex = [...listenIndex];
    let n = 0;
    for (const s of importMehrfachListen) {
      const abfragbar = Object.values(s.mapping).filter(t => t && !t.startsWith('i'));
      if (abfragbar.length < 2) continue;
      const id = "liste_" + Date.now() + "_" + n;
      const liste = neueListeObjekt(id, s.name || `Import ${n + 1}`);
      s.header.forEach((h, i) => {
        const typ = s.mapping[i];
        if (typ) liste.spalten[typ] = { name: h.wert.replace(/\s*\[[EDi][12]\]\s*$/, '').trim(), aktiv: true };
      });
      s.daten.forEach(zeile => {
        const vok = { id: liste.naechste_id++ };
        Object.entries(s.mapping).forEach(([idx, typ]) => {
          if (typ && zeile[Number(idx)]) vok[typ] = { wert: zeile[Number(idx)].wert, falsch: zeile[Number(idx)].falsch };
        });
        liste.vokabeln.push(vok);
      });
      lsSet(SK.liste(id), liste);
      neuerIndex.push({ id, name: liste.name });
      n++;
    }
    speichereIndex(neuerIndex);
    resetImport();
    setAnsicht("uebersicht");
  }

  function importiereAusJsonDaten() {
    if (!importJsonData?.length) return;
    const neuerIndex = [...listenIndex];
    importJsonData.forEach((l, i) => {
      const id = "liste_" + Date.now() + "_j" + i;
      const liste = { ...l, id };
      lsSet(SK.liste(id), liste);
      neuerIndex.push({ id, name: liste.name });
    });
    speichereIndex(neuerIndex);
    resetImport();
    setAnsicht("uebersicht");
  }

  function exportiereAlsJson(ids) {
    setJsonExportIds(ids);
    setModal("json-export");
  }

  function exportiereAlsJsonBestaetigt() {
    const listen = jsonExportIds.map(id => lsGet(SK.liste(id))).filter(Boolean);
    const gefiltert = listen.map(liste => {
      const l = { ...liste };
      l.vokabeln = liste.vokabeln.map(vok => {
        const v = { ...vok };
        TYPEN.forEach(typ => {
          if (v[typ]) v[typ] = { wert: v[typ].wert, falsch: jsonExportOptionen.falsch ? (v[typ].falsch || []) : [] };
        });
        if (!jsonExportOptionen.fortschritt) delete v.fortschritt;
        if (!jsonExportOptionen.diktatFortschritt) delete v.diktatFortschritt;
        return v;
      });
      return l;
    });
    const text = JSON.stringify(gefiltert, null, 2);
    const name = jsonExportIds.length === 1
      ? (gefiltert[0]?.name || 'Liste') + '.json'
      : jsonExportIds.length + '_Listen_Backup.json';
    teileAlsDatei(text, name);
    setModal(null); setJsonExportIds(null);
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

  function getBestehendeListe() {
    if (!importBestehendId) return null;
    return lsGet(SK.liste(importBestehendId));
  }

  // Gibt die Ziel-Optionen für bestehende Liste zurück:
  // aktive Spalten (by name) + freie Slots (als "Neu: typ")
  function getBestehendZielOptionen(bl) {
    if (!bl) return [];
    return TYPEN.map(typ => ({
      typ,
      label: bl.spalten[typ].aktiv ? bl.spalten[typ].name || typ : null,
      neu: !bl.spalten[typ].aktiv,
    }));
  }

  function fuehreImportDurch() {
    const abfragbar = Object.values(importMapping).filter(t => t && !t.startsWith('i'));
    if (abfragbar.length < 2) { setImportFehler("Mindestens 2 abfragbare Spalten müssen zugewiesen sein."); return; }

    const istBestehend = importZielTyp === "bestehend";
    const bl = istBestehend ? getBestehendeListe() : null;

    function bauVokabeln(liste) {
      importParsed.daten.forEach(zeile => {
        const vok = { id: liste.naechste_id++ };
        Object.entries(importMapping).forEach(([idx, typ]) => {
          if (typ && zeile[Number(idx)]) vok[typ] = { wert: zeile[Number(idx)].wert, falsch: zeile[Number(idx)].falsch };
        });
        liste.vokabeln.push(vok);
      });
    }

    function aktualisiereSpaltennamen(liste) {
      Object.entries(importMapping).forEach(([idx, typ]) => {
        if (!typ) return;
        if (istBestehend && bl && bl.spalten[typ].aktiv) {
          // Bestehende Spalte: Name bleibt
          if (!liste.spalten[typ].aktiv) liste.spalten[typ] = { name: bl.spalten[typ].name, aktiv: true };
        } else {
          // Neue Spalte: Import-Header-Name
          liste.spalten[typ] = { name: importParsed.header[Number(idx)].wert.replace(/\s*\[[EDi][12]\]\s*$/, '').trim(), aktiv: true };
        }
      });
    }

    if (istBestehend) {
      if (!importBestehendId) { setImportFehler("Bitte eine Liste auswählen."); return; }
      const liste = lsGet(SK.liste(importBestehendId));
      if (!liste) { setImportFehler("Liste nicht gefunden."); return; }
      aktualisiereSpaltennamen(liste);
      bauVokabeln(liste);
      lsSet(SK.liste(importBestehendId), liste);
    } else {
      const name = importNeuName.trim();
      if (!name) { setImportFehler("Bitte einen Namen eingeben."); return; }
      if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) { setImportFehler("Name bereits vorhanden."); return; }
      const id = "liste_" + Date.now();
      const liste = neueListeObjekt(id, name);
      aktualisiereSpaltennamen(liste);
      bauVokabeln(liste);
      lsSet(SK.liste(id), liste);
      speichereIndex([...listenIndex, { id, name }]);
    }
    resetImport();
    setAnsicht("uebersicht");
  }

  // ── Quiz-Aktionen ─────────────────────────────────────────────────────────
  function toggleQuizSpalte(typ) {
    setQuizAusgewaehlt(prev => {
      if (prev.includes(typ)) {
        if (quizFrageTyp === typ) setQuizFrageTyp("");
        setQuizAntwortTypenGeordnet(p => p.filter(t => t !== typ));
        setQuizInfoTypenSession(p => p.filter(t => t !== typ));
        setQuizSpalteModus(p => { const n = {...p}; delete n[typ]; return n; });
        return prev.filter(t => t !== typ);
      }
      return [...prev, typ];
    });
  }

  function toggleSpalteRolle(typ, rolle) {
    if (rolle === "frage") {
      if (quizFrageTyp === typ) { setQuizFrageTyp(""); }
      else {
        setQuizFrageTyp(typ);
        setQuizAntwortTypenGeordnet(p => p.filter(t => t !== typ));
        setQuizInfoTypenSession(p => p.filter(t => t !== typ));
      }
    } else if (rolle === "antwort") {
      if (quizAntwortTypenGeordnet.includes(typ)) {
        setQuizAntwortTypenGeordnet(p => p.filter(t => t !== typ));
      } else {
        if (quizFrageTyp === typ) setQuizFrageTyp("");
        setQuizInfoTypenSession(p => p.filter(t => t !== typ));
        setQuizAntwortTypenGeordnet(p => [...p, typ]);
        setQuizSpalteModus(p => ({...p, [typ]: p[typ] || "tippen"}));
      }
    } else if (rolle === "info") {
      if (quizInfoTypenSession.includes(typ)) {
        setQuizInfoTypenSession(p => p.filter(t => t !== typ));
      } else {
        if (quizFrageTyp === typ) setQuizFrageTyp("");
        setQuizAntwortTypenGeordnet(p => p.filter(t => t !== typ));
        setQuizInfoTypenSession(p => [...p, typ]);
      }
    }
  }

  function toggleInfoSpalte(typ) {
    setQuizZeigeInfo(prev => ({...prev, [typ]: !prev[typ]}));
  }

  function toggleVokCheckbox(vokId) {
    setQuizCheckboxAuswahl(prev => {
      const neu = new Set(prev);
      if (neu.has(vokId)) neu.delete(vokId); else neu.add(vokId);
      return neu;
    });
  }

  function speichereKonfigInSlot(nummer, name) {
    const konfiguration = {
      quizAusgewaehlt, quizFrageTyp, quizAntwortTypenGeordnet,
      quizInfoTypenSession, quizSpalteModus, quizZeigeInfo,
      quizModus, quizBereichTyp,
      quizReihenfolge, quizSchlechtesteAnzahl, quizSchlechtesteMaxScore, quizUnbeantwortetZuerst,
      quizDiktatSpalte, quizDiktatUebersetzung,
    };
    const aktuell = lsGet(SK.sessionSlots, defaultSessionSlots());
    const updated = aktuell.map(s => s.slot === nummer ? {...s, name, konfiguration} : s);
    lsSet(SK.sessionSlots, updated);
    setSessionSlots(updated);
  }

  function ladeKonfigAusSlot(slot) {
    const k = slot.konfiguration;
    if (!k) return;
    setQuizAusgewaehlt(k.quizAusgewaehlt || []);
    setQuizFrageTyp(k.quizFrageTyp || "");
    setQuizAntwortTypenGeordnet(k.quizAntwortTypenGeordnet || []);
    setQuizInfoTypenSession(k.quizInfoTypenSession || []);
    setQuizSpalteModus(k.quizSpalteModus || {});
    setQuizZeigeInfo(k.quizZeigeInfo || {});
    setQuizModus(k.quizModus || "sequenziell");
    setQuizBereichTyp(k.quizBereichTyp || "alle");
    setQuizReihenfolge(k.quizReihenfolge || "zufall");
    setQuizSchlechtesteAnzahl(k.quizSchlechtesteAnzahl || 20);
    setQuizSchlechtesteMaxScore(k.quizSchlechtesteMaxScore ?? "");
    setQuizUnbeantwortetZuerst(k.quizUnbeantwortetZuerst !== undefined ? k.quizUnbeantwortetZuerst : true);
    setQuizDiktatSpalte(k.quizDiktatSpalte || "E1");
    setQuizDiktatUebersetzung(k.quizDiktatUebersetzung !== undefined ? k.quizDiktatUebersetzung : "D1");
    setQuizCheckboxAuswahl(new Set());
  }

  function initQuizDefaults(kombiListe) {
    const liste = kombiListe || aktiveListe;
    if (!liste) return;
    const abfragbar = TYPEN.filter(t => !t.startsWith('i') && liste.spalten[t].aktiv);
    const infoVerfuegbar = TYPEN.filter(t => t.startsWith('i') && liste.spalten[t].aktiv);
    const ausgewaehlt = (abfragbar.includes('E1') && abfragbar.includes('D1'))
      ? ['E1', 'D1'] : abfragbar.slice(0, 2);
    const frageTyp = ausgewaehlt.find(t => t.startsWith('D')) || ausgewaehlt[0] || '';
    const antwortTypen = ausgewaehlt.filter(t => t !== frageTyp);
    const spalteModus = {};
    antwortTypen.forEach(t => { spalteModus[t] = 'karte'; });
    const zeigeInfo = {};
    infoVerfuegbar.forEach(t => { zeigeInfo[t] = true; });
    setQuizAusgewaehlt(ausgewaehlt);
    setQuizFrageTyp(frageTyp);
    setQuizAntwortTypenGeordnet(antwortTypen);
    setQuizInfoTypenSession([]);
    setQuizSpalteModus(spalteModus);
    setQuizZeigeInfo(zeigeInfo);
    setQuizModus('sequenziell');
    setQuizBereichTyp('alle');
    setQuizBereichVon(1);
    setQuizBereichBis('');
    setQuizBereichEingabeAufgeklappt(false);
    setQuizReihenfolge('zufall');
    setQuizSchlechtesteAnzahl(20);
    setQuizSchlechtesteMaxScore('');
    setQuizUnbeantwortetZuerst(true);
    setQuizCheckboxAuswahl(new Set());
    setQuizListeAufgeklappt(false);
    setQuizVonBisModus(false);
    setQuizVonBisErster(null);
  }

  function getKombinierteListe(listenIds) {
    const listen = listenIds.map(id => lsGet(SK.liste(id))).filter(Boolean);
    if (listen.length === 0) return null;
    const spalten = {};
    TYPEN.forEach(typ => {
      const aktiv = listen.filter(l => l.spalten[typ].aktiv);
      if (aktiv.length > 0) {
        const namen = [...new Set(aktiv.map(l => l.spalten[typ].name).filter(Boolean))];
        spalten[typ] = { aktiv: true, name: namen.join(' / ') };
      } else {
        spalten[typ] = { aktiv: false, name: '' };
      }
    });
    const vokabeln = listen.flatMap(l =>
      l.vokabeln.map(v => ({ ...v, id: `${l.id}__${v.id}`, _listeId: l.id, _origId: v.id }))
    );
    return { id: 'combined', name: listen.map(l => l.name).join(' + '), spalten, naechste_id: 0, vokabeln };
  }

  function toggleQuizTabListe(id) {
    setQuizTabListen(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleListenAuswahl() {
    const opening = !listenAuswahlAufgeklappt;
    setListenAuswahlAufgeklappt(v => !v);
    if (opening) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = listenContainerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < headerH) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - headerH), behavior: 'instant' });
        }
      }));
    }
  }

  function toggleEinzelauswahl() {
    const opening = !quizListeAufgeklappt;
    setQuizListeAufgeklappt(v => !v);
    if (opening) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = einzelauswahlRef.current;
        if (!el) return;
        const target = headerH + alleBereichH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
      }));
    }
  }

  function beendeQuiz() {
    setQuiz(null);
    setTab("quiz");
    setAnsicht("uebersicht");
  }

  function starteDiktat() {
    const kombiListe = quizTabListen.length > 0 ? getKombinierteListe(quizTabListen) : aktiveListe;
    if (!kombiListe) return;
    speichereKonfigInSlot(6, "Zuletzt verwendet");
    let voks = kombiListe.vokabeln.filter(v => v[quizDiktatSpalte]);
    if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0) {
      voks = voks.filter(v => quizCheckboxAuswahl.has(v.id));
    }
    if (quizReihenfolge === "schlechteste") {
      let schlecht = voks;
      if (quizSchlechtesteMaxScore !== "" && !isNaN(parseFloat(quizSchlechtesteMaxScore))) {
        const threshold = parseFloat(quizSchlechtesteMaxScore);
        schlecht = voks.filter(v => (v.diktatFortschritt?.score ?? 0) < threshold);
      }
      const n = Math.min(Math.max(1, parseInt(quizSchlechtesteAnzahl) || 1), schlecht.length);
      voks = [...schlecht].sort((a, b) => (a.diktatFortschritt?.score ?? 0) - (b.diktatFortschritt?.score ?? 0)).slice(0, n);
    } else if (quizUnbeantwortetZuerst) {
      const unb = voks.filter(v => !v.diktatFortschritt);
      const bea = voks.filter(v => v.diktatFortschritt);
      if (quizReihenfolge === "listennr") {
        voks = [...unb, ...bea];
      } else {
        voks = [...[...unb].sort(() => Math.random() - 0.5), ...[...bea].sort(() => Math.random() - 0.5)];
      }
    } else if (quizReihenfolge !== "listennr") {
      voks = [...voks].sort(() => Math.random() - 0.5);
    }
    if (voks.length === 0) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setDiktatListeAufgeklappt(false);
    setDiktatManualPlays(0);
    diktatPlayCountRef.current = 0;
    setQuiz({
      modus: "diktat",
      diktatSpalte: quizDiktatSpalte,
      diktatUeberspalte: quizDiktatUebersetzung,
      liste: kombiListe, vokabeln: voks, index: 0,
      phase: "eingabe", eingabe: "", flash: false,
      diktatAufgedeckt: 0, diktatErgebnisse: [], feedback: "",
    });
    setAnsicht("quiz");
  }

  function starteQuiz() {
    if (quizModus === "diktat") { starteDiktat(); return; }
    const kombiListe = quizTabListen.length > 0 ? getKombinierteListe(quizTabListen) : aktiveListe;
    if (!kombiListe) return;
    speichereKonfigInSlot(6, "Zuletzt verwendet");
    const alleAbfragbar = quizModus === "rotierend"
      ? quizAusgewaehlt
      : [quizFrageTyp, ...quizAntwortTypenGeordnet].filter(Boolean);
    const sitzungsInfoTypen = [
      ...quizInfoTypenSession,
      ...TYPEN.filter(t => t.startsWith('i') && kombiListe.spalten[t].aktiv && quizZeigeInfo[t]),
    ];

    let voks = kombiListe.vokabeln.filter(v => alleAbfragbar.every(t => v[t]));

    if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0) {
      voks = voks.filter(v => quizCheckboxAuswahl.has(v.id));
    }

    if (quizReihenfolge === "schlechteste") {
      let schlecht = voks;
      if (quizSchlechtesteMaxScore !== "" && !isNaN(parseFloat(quizSchlechtesteMaxScore))) {
        const threshold = parseFloat(quizSchlechtesteMaxScore);
        schlecht = voks.filter(v => (v.fortschritt?.score ?? 0) < threshold);
      }
      const n = Math.min(Math.max(1, parseInt(quizSchlechtesteAnzahl) || 1), schlecht.length);
      voks = [...schlecht].sort((a, b) => (a.fortschritt?.score ?? 0) - (b.fortschritt?.score ?? 0)).slice(0, n);
    } else if (quizUnbeantwortetZuerst) {
      const unb = voks.filter(v => !v.fortschritt);
      const bea = voks.filter(v => v.fortschritt);
      if (quizReihenfolge === "listennr") {
        voks = [...unb, ...bea];
      } else {
        voks = [...[...unb].sort(() => Math.random() - 0.5), ...[...bea].sort(() => Math.random() - 0.5)];
      }
    } else if (quizReihenfolge !== "listennr") {
      voks = [...voks].sort(() => Math.random() - 0.5);
    }
    if (voks.length === 0) return;

    function getFA(idx) {
      if (quizModus === "rotierend") {
        const ft = alleAbfragbar[idx % alleAbfragbar.length];
        return { frageTyp: ft, antwortTypen: alleAbfragbar.filter(t => t !== ft) };
      }
      return { frageTyp: quizFrageTyp, antwortTypen: quizAntwortTypenGeordnet };
    }

    const { frageTyp, antwortTypen } = getFA(0);
    const erstesTeile = voks[0][antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
    const ersterModusTyp0 = quizSpalteModus[antwortTypen[0]] || "tippen";
    const erstesMC = ersterModusTyp0 === "mc"
      ? generiereButtons(voks, voks[0], antwortTypen[0]) : null;

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz({
      sitzungsInfoTypen, modus: quizModus, spalteModus: quizSpalteModus,
      liste: kombiListe, vokabeln: voks, index: 0,
      frageTyp, antwortTypen, antwortTypIndex: 0,
      phase: "eingabe", eingabe: "", flash: false, infoSichtbar: false, infoSeite: 0,
      antwortTeile: erstesTeile, weitereIndices: [], weiterePos: 0,
      mcButtons: erstesMC?.buttons || [], mcRichtig: erstesMC?.richtig || [],
      vorigeRichtig: [], sessionFalsch: {}, feedback: "", mcWechsel: false,
      aktuelleFehlversuche: 0, falschFlash: false,
    });
    setAnsicht("quiz");
  }

  function getAktVok() {
    if (!quiz) return null;
    const vokId = quiz.vokabeln[quiz.index].id;
    return quiz.liste.vokabeln.find(v => v.id === vokId) || quiz.vokabeln[quiz.index];
  }

  // Berechnet den nächsten Vokabel-State als reines Objekt (kein setQuiz)
  function naechsteVokabelState(prev) {
    const naechsterIdx = prev.index + 1;
    if (naechsterIdx >= prev.vokabeln.length) return {...prev, flash: false, phase: "fertig"};
    function getFA(idx) {
      if (prev.modus === "rotierend") {
        const alle = [...prev.antwortTypen, prev.frageTyp];
        const ft = alle[idx % alle.length];
        return { frageTyp: ft, antwortTypen: alle.filter(t => t !== ft) };
      }
      return { frageTyp: prev.frageTyp, antwortTypen: prev.antwortTypen };
    }
    const { frageTyp, antwortTypen } = getFA(naechsterIdx);
    const naechsteVok = prev.vokabeln[naechsterIdx];
    const teile = naechsteVok[antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
    const spalteModus = prev.mcWechsel
      ? {...prev.spalteModus, [antwortTypen[0]]: "tippen"}
      : prev.spalteModus;
    const modusTyp0 = spalteModus[antwortTypen[0]] || "tippen";
    const mc = modusTyp0 === "mc" ? generiereButtons(prev.vokabeln, naechsteVok, antwortTypen[0]) : null;
    return {...prev, flash: false, index: naechsterIdx, frageTyp, antwortTypen, antwortTypIndex: 0,
      phase: "eingabe", eingabe: "", antwortTeile: teile, weitereIndices: [], weiterePos: 0,
      mcButtons: mc?.buttons || prev.mcButtons, mcRichtig: mc?.richtig || prev.mcRichtig,
      vorigeRichtig: [], infoSichtbar: false, infoSeite: 0, feedback: "",
      spalteModus, mcWechsel: false, aktuelleFehlversuche: 0, falschFlash: false};
  }

  // Setzt flash, wartet 500ms, führt dann advanceFn aus
  function mitFlash(quizUpdates, advanceFn) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => ({...prev, ...quizUpdates, flash: true, eingabe: ""}));
    flashTimerRef.current = setTimeout(() => {
      setQuiz(prev => { if (!prev.flash) return prev; return advanceFn(prev); });
    }, 1000);
  }

  function pruefeAntwort() {
    if (!quiz || !quiz.eingabe.trim()) return;
    const eingabe = quiz.eingabe.trim();

    function setzeRichtigAufgedeckt(updates) {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setQuiz(prev => ({...prev, ...updates, eingabe: "", phase: "aufgedeckt", flash: false,
        richtigAufgedeckt: true, feedback: "", falschFlash: false, aktuelleFehlversuche: 0}));
    }

    if (quiz.phase === "weitere") {
      const erwartet = quiz.antwortTeile[quiz.weitereIndices[quiz.weiterePos]];
      if (istRichtigeAntwort(eingabe, erwartet)) {
        const naechstePos = quiz.weiterePos + 1;
        if (naechstePos >= quiz.weitereIndices.length) {
          // Alle "weitere" erledigt → Lösung zeigen, warten
          setzeRichtigAufgedeckt({});
        } else {
          // Nächstes "weitere" ohne Flash
          setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: ""}));
        }
      } else {
        setQuiz(prev => ({...prev, eingabe: "", phase: "weitere", feedback: "Nicht ganz – versuch nochmal."}));
      }
      return;
    }

    const aktVok = getAktVok();
    const matchIdx = quiz.antwortTeile.findIndex(t => istRichtigeAntwort(eingabe, t));

    if (matchIdx !== -1) {
      const neuFortschritt = berechneNeuenScore(aktVok.fortschritt, "richtig", 0, einstellungen.modus);
      const neueListe = speichereScore(quiz.liste, aktVok.id, neuFortschritt);
      const restIndices = quiz.antwortTeile.map((_, i) => i).filter(i => i !== matchIdx);

      if (restIndices.length > 0) {
        // Mehrere Teile (was/were): direkt zu "weitere", Score bereits gezählt
        setQuiz(prev => ({...prev, liste: neueListe, eingabe: "", phase: "weitere", weitereIndices: restIndices, weiterePos: 0, feedback: ""}));
      } else {
        // Spalte fertig → Lösung zeigen, warten
        setzeRichtigAufgedeckt({liste: neueListe});
      }
    } else {
      const vokId = aktVok.id;
      const neueFehlversuche = (quiz.aktuelleFehlversuche || 0) + 1;
      if (neueFehlversuche >= 3) {
        // 3. Fehlversuch: Score abziehen, Lösung automatisch anzeigen
        const neuerCount = (quiz.sessionFalsch[vokId] || 0) + 1;
        const neuFortschritt = berechneNeuenScore(aktVok.fortschritt, "falsch", neuerCount, einstellungen.modus);
        const neueListe = speichereScore(quiz.liste, vokId, neuFortschritt);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setQuiz(prev => ({...prev, liste: neueListe, eingabe: "", phase: "aufgedeckt", flash: false,
          feedback: "", falschFlash: false, aktuelleFehlversuche: 0,
          sessionFalsch: {...prev.sessionFalsch, [vokId]: neuerCount}}));
      } else {
        // 1. oder 2. Fehlversuch: kurz rot aufleuchten, dann zurück
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setQuiz(prev => ({...prev, eingabe: "", falschFlash: true,
          feedback: "Nicht richtig.", aktuelleFehlversuche: neueFehlversuche}));
        flashTimerRef.current = setTimeout(() => {
          setQuiz(prev => ({...prev, falschFlash: false, feedback: ""}));
        }, 1500);
      }
    }
  }

  function klickeButton(idx) {
    if (!quiz || quiz.flash) return;
    const btn = quiz.mcButtons[idx];
    if (!btn || btn.status === "richtig") return;

    if (btn.korrekt) {
      const neueButtons = quiz.mcButtons.map((b, i) => i === idx ? {...b, status: "richtig"} : b);
      const alleGefunden = neueButtons.filter(b => b.korrekt).every(b => b.status === "richtig");

      if (alleGefunden) {
        const aktVok = getAktVok();
        const neuFortschritt = berechneNeuenScore(aktVok.fortschritt, "richtig", 0, einstellungen.modus);
        const neueListe = speichereScore(quiz.liste, aktVok.id, neuFortschritt);
        setQuiz(prev => ({
          ...prev, liste: neueListe, mcButtons: neueButtons,
          phase: "aufgedeckt", flash: false, richtigAufgedeckt: true,
        }));
      } else {
        setQuiz(prev => ({...prev, mcButtons: neueButtons}));
      }
    } else {
      setQuiz(prev => ({...prev, mcButtons: prev.mcButtons.map((b, i) => i === idx ? {...b, status: "falsch"} : b)}));
      setTimeout(() => {
        setQuiz(prev => ({...prev, mcButtons: prev.mcButtons.map((b, i) => i === idx ? {...b, status: "neutral"} : b)}));
      }, 500);
    }
  }

  function zeigeLosung() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const aktVok = getAktVok();
    const neuFortschritt = berechneNeuenScore(aktVok.fortschritt, "aufgedeckt", 0, einstellungen.modus);
    const neueListe = speichereScore(quiz.liste, aktVok.id, neuFortschritt);
    const aktModus = quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] || "tippen";
    const mcUpd = aktModus === "mc"
      ? { mcButtons: quiz.mcButtons.map(b => b.korrekt ? {...b, status: "richtig"} : b) }
      : {};
    setQuiz(prev => ({...prev, liste: neueListe, eingabe: "", flash: false, phase: "aufgedeckt",
      feedback: "", falschFlash: false, aktuelleFehlversuche: 0, ...mcUpd}));
  }

  function ueberspringeWeitere() {
    const naechstePos = quiz.weiterePos + 1;
    if (naechstePos >= quiz.weitereIndices.length) {
      mitFlash({}, prev => {
        const vorigeRichtig = [...prev.vorigeRichtig, {
          typ: prev.antwortTypen[prev.antwortTypIndex],
          wert: prev.antwortTeile.join(" / "),
          label: prev.liste.spalten[prev.antwortTypen[prev.antwortTypIndex]]?.name || prev.antwortTypen[prev.antwortTypIndex],
        }];
        const naechsterIdx = prev.antwortTypIndex + 1;
        if (naechsterIdx >= prev.antwortTypen.length) return naechsteVokabelState({...prev, vorigeRichtig});
        const nt = prev.antwortTypen[naechsterIdx];
        const teile = prev.vokabeln[prev.index][nt]?.wert.split('/').map(s => s.trim()) || [];
        return {...prev, flash: false, phase: "eingabe", antwortTypIndex: naechsterIdx,
          antwortTeile: teile, weitereIndices: [], weiterePos: 0, vorigeRichtig, infoSichtbar: false};
      });
    } else {
      setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: ""}));
    }
  }

  function wechsleZuMC() {
    const typ = quiz?.antwortTypen?.[quiz.antwortTypIndex];
    const aktuellerModus = quiz?.spalteModus?.[typ] || "tippen";
    if (!quiz || !typ || aktuellerModus !== "tippen") return;
    const mc = generiereButtons(quiz.liste.vokabeln, quiz.vokabeln[quiz.index], typ);
    setQuiz(prev => ({
      ...prev, antwortModus: "mc", mcWechsel: true,
      spalteModus: {...prev.spalteModus, [typ]: "mc"},
      mcButtons: mc.buttons, mcRichtig: mc.richtig,
      phase: "eingabe", eingabe: "", feedback: "",
    }));
  }

  function naechsteVokabel() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (quiz.richtigAufgedeckt) {
      setQuiz(prev => {
        const naechsterIdx = prev.antwortTypIndex + 1;
        if (naechsterIdx >= prev.antwortTypen.length) return naechsteVokabelState({...prev, richtigAufgedeckt: false});
        const currentTyp = prev.antwortTypen[prev.antwortTypIndex];
        const currentVorig = {
          typ: currentTyp, wert: prev.antwortTeile.join(" / "),
          label: prev.liste.spalten[currentTyp]?.name || currentTyp,
        };
        const nt = prev.antwortTypen[naechsterIdx];
        const teile = prev.vokabeln[prev.index][nt]?.wert.split('/').map(s => s.trim()) || [];
        const ntModus = prev.mcWechsel ? "mc" : (prev.spalteModus?.[nt] || "tippen");
        const mc = ntModus === "mc" ? generiereButtons(prev.vokabeln, prev.vokabeln[prev.index], nt) : null;
        return {...prev, flash: false, phase: "eingabe", antwortTypIndex: naechsterIdx,
          antwortTeile: teile, mcButtons: mc?.buttons || prev.mcButtons, mcRichtig: mc?.richtig || prev.mcRichtig,
          weitereIndices: [], weiterePos: 0, infoSichtbar: false, richtigAufgedeckt: false,
          aktuelleFehlversuche: 0, falschFlash: false,
          vorigeRichtig: [...prev.vorigeRichtig, currentVorig]};
      });
    } else {
      setQuiz(prev => naechsteVokabelState(prev));
    }
  }

  function deckeKarteAuf() {
    if (!quiz || quiz.phase !== "eingabe") return;
    const typ = quiz.antwortTypen?.[quiz.antwortTypIndex];
    if ((quiz.spalteModus?.[typ] || "tippen") !== "karte") return;
    setQuiz(prev => ({...prev, phase: "aufgedeckt", eingabe: "", flash: false, feedback: ""}));
  }

  function bewerteKarte(gewusst) {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const aktVok = getAktVok();
    const neuerCount = gewusst ? 0 : (quiz.sessionFalsch[aktVok.id] || 0) + 1;
    const neuFortschritt = berechneNeuenScore(aktVok.fortschritt, gewusst ? "richtig" : "falsch", neuerCount, einstellungen.modus);
    const neueListe = speichereScore(quiz.liste, aktVok.id, neuFortschritt);
    const sessionFalschNeu = gewusst ? quiz.sessionFalsch : {...quiz.sessionFalsch, [aktVok.id]: neuerCount};

    function naechsteSpalteOderVokabel(prev, vorigeRichtig) {
      const naechsterIdx = prev.antwortTypIndex + 1;
      if (naechsterIdx >= prev.antwortTypen.length) return naechsteVokabelState({...prev, vorigeRichtig});
      const nt = prev.antwortTypen[naechsterIdx];
      const teile = prev.vokabeln[prev.index][nt]?.wert.split('/').map(s => s.trim()) || [];
      const ntModus = prev.spalteModus?.[nt] || "tippen";
      const mc = ntModus === "mc" ? generiereButtons(prev.vokabeln, prev.vokabeln[prev.index], nt) : null;
      return {...prev, flash: false, phase: "eingabe", antwortTypIndex: naechsterIdx,
        antwortTeile: teile, weitereIndices: [], weiterePos: 0, vorigeRichtig, infoSichtbar: false,
        mcButtons: mc?.buttons || prev.mcButtons, mcRichtig: mc?.richtig || prev.mcRichtig};
    }

    if (gewusst) {
      mitFlash({liste: neueListe, sessionFalsch: sessionFalschNeu}, prev => {
        const vorigeRichtig = [...prev.vorigeRichtig, {
          typ: prev.antwortTypen[prev.antwortTypIndex],
          wert: prev.antwortTeile.join(" / "),
          label: prev.liste.spalten[prev.antwortTypen[prev.antwortTypIndex]]?.name || prev.antwortTypen[prev.antwortTypIndex],
        }];
        return naechsteSpalteOderVokabel(prev, vorigeRichtig);
      });
    } else {
      setQuiz(prev => ({...prev, liste: neueListe, sessionFalsch: sessionFalschNeu, karteNeinFlash: true}));
      flashTimerRef.current = setTimeout(() => {
        setQuiz(prev => {
          if (!prev.karteNeinFlash) return prev;
          return naechsteSpalteOderVokabel({...prev, karteNeinFlash: false}, prev.vorigeRichtig);
        });
      }, 800);
    }
  }

  function pruefeDiktatAntwort() {
    if (!quiz || !quiz.eingabe.trim()) return;
    const aktVok = quiz.vokabeln[quiz.index];
    const wort = aktVok[quiz.diktatSpalte]?.wert || "";
    if (istRichtigeAntwort(quiz.eingabe.trim(), wort)) {
      const neuFortschritt = berechneDiktatScore(aktVok.diktatFortschritt, "richtig");
      const neueListe = speichereDiktatScore(quiz.liste, aktVok.id, neuFortschritt);
      const ergebnis = { vokId: aktVok.id, wort, uebersetzung: aktVok[quiz.diktatUeberspalte]?.wert, richtig: true };
      setQuiz(prev => ({
        ...prev, liste: neueListe, eingabe: "", phase: "richtig", flash: false,
        diktatErgebnisse: [...prev.diktatErgebnisse, ergebnis], feedback: "",
      }));
    } else {
      setQuiz(prev => ({
        ...prev, eingabe: "",
        diktatAufgedeckt: Math.min((prev.diktatAufgedeckt || 0) + 1, wort.length),
        feedback: "Nicht richtig – ein Buchstabe mehr aufgedeckt.",
      }));
    }
  }

  function zeigeDiktatLoesung() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const aktVok = quiz.vokabeln[quiz.index];
    const neuFortschritt = berechneDiktatScore(aktVok.diktatFortschritt, "aufgedeckt");
    const neueListe = speichereDiktatScore(quiz.liste, aktVok.id, neuFortschritt);
    const wort = aktVok[quiz.diktatSpalte]?.wert || "";
    const ergebnis = { vokId: aktVok.id, wort, uebersetzung: aktVok[quiz.diktatUeberspalte]?.wert, richtig: false };
    setQuiz(prev => ({
      ...prev, liste: neueListe, eingabe: "", phase: "aufgedeckt", flash: false,
      diktatAufgedeckt: wort.length,
      diktatErgebnisse: [...prev.diktatErgebnisse, ergebnis],
      feedback: "",
    }));
  }

  function naechsteDiktatVokabel() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    diktatPlayCountRef.current = 0;
    setDiktatManualPlays(0);
    setQuiz(prev => {
      const naechsterIdx = prev.index + 1;
      if (naechsterIdx >= prev.vokabeln.length) return { ...prev, phase: "fertig" };
      return { ...prev, index: naechsterIdx, eingabe: "", diktatAufgedeckt: 0, phase: "eingabe", feedback: "" };
    });
  }

  function sprichDiktatNochmal(text, lang) {
    if (!window.speechSynthesis) return;
    const langCode = lang.split('-')[0].toLowerCase();
    // Novelty/effects Stimmen aussortieren (iOS/macOS), Android-Stimmen bleiben alle drin
    const NOVELTY = /bad news|boing|bubbles|cellos|good news|jester|organ|trinoids|whisper|zarvox|albert|deranged|fred|hysterical|junior|kathy|princess|ralph|wobble|superstar|bells/i;
    const voices = window.speechSynthesis.getVoices()
      .filter(v => v.lang.toLowerCase().startsWith(langCode) && !NOVELTY.test(v.name));
    diktatPlayCountRef.current += 1;
    setDiktatManualPlays(p => p + 1);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.split('/')[0].trim());
    u.lang = lang;
    if (voices.length > 1) {
      // Stimme wechselt alle 2 Plays: 0,0,1,1,2,2,...
      const voiceIdx = Math.floor(diktatPlayCountRef.current / 2) % voices.length;
      u.voice = voices[voiceIdx];
    }
    window.speechSynthesis.speak(u);
  }

  function geheZurueck() {
    if (!quiz || quiz.antwortTypIndex <= 0) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => {
      const naechsterIdx = prev.antwortTypIndex - 1;
      const nt = prev.antwortTypen[naechsterIdx];
      const teile = prev.vokabeln[prev.index][nt]?.wert.split('/').map(s => s.trim()) || [];
      const mc = prev.antwortModus === "mc"
        ? generiereButtons(prev.vokabeln, prev.vokabeln[prev.index], nt) : null;
      return {
        ...prev, flash: false, phase: "eingabe", eingabe: "",
        antwortTypIndex: naechsterIdx, antwortTeile: teile,
        weitereIndices: [], weiterePos: 0,
        vorigeRichtig: prev.vorigeRichtig.slice(0, -1),
        mcButtons: mc?.buttons || prev.mcButtons,
        mcRichtig: mc?.richtig || prev.mcRichtig,
        feedback: "",
      };
    });
  }

  // ── Render: Diktat ───────────────────────────────────────────────────────
  if (ansicht === "quiz" && quiz && quiz.modus === "diktat") {
    if (quiz.phase === "fertig") {
      const richtig = quiz.diktatErgebnisse.filter(e => e.richtig).length;
      return (
        <>
          <style>{CSS}</style>
          <div className="app">
            <div className="topbar">
              <button className="topbar-back" onClick={() => { beendeQuiz(); }}>Schließen</button>
              <span className="topbar-title">Diktat abgeschlossen</span>
              <span className="quiz-fortschritt">{richtig} / {quiz.diktatErgebnisse.length} ✓</span>
            </div>
            <div className="sektion">
              <button className="btn btn-primary" style={{width:"100%", marginBottom:16}}
                onClick={() => { beendeQuiz(); }}>
                Zurück zur Liste
              </button>
              <div className="karte">
                <div style={{padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer"}}
                  onClick={() => setDiktatListeAufgeklappt(v => !v)}>
                  <span style={{fontWeight:600}}>{richtig} / {quiz.diktatErgebnisse.length} richtig</span>
                  <button className="btn-toggle" style={{padding:"3px 6px"}} onClick={e => { e.stopPropagation(); setDiktatListeAufgeklappt(v => !v); }}>
                    {diktatListeAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                  </button>
                </div>
                {diktatListeAufgeklappt && quiz.diktatErgebnisse.map((e, i) => (
                  <div key={i} className="diktat-summary-zeile" style={{padding:"10px 16px"}}>
                    <span style={{fontSize:"1.1rem", fontWeight:700, color: e.richtig ? "#2d6a4f" : "#c0392b", minWidth:22}}>
                      {e.richtig ? "✓" : "✗"}
                    </span>
                    <div>
                      <div style={{fontWeight:600, fontSize:"0.95rem"}}>{e.wort}</div>
                      {e.uebersetzung && <div style={{fontSize:"0.82rem", color:"#6b6560"}}>{e.uebersetzung}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    }

    const aktVok = quiz.vokabeln[quiz.index];
    const diktatWort = aktVok[quiz.diktatSpalte]?.wert || "";
    const uebersetzung = quiz.diktatUeberspalte ? aktVok[quiz.diktatUeberspalte]?.wert : null;
    const hint = diktatHint(diktatWort, quiz.diktatAufgedeckt);
    const diktatScore = aktVok.diktatFortschritt?.score ?? 0;

    const diktatWeiter = quiz.phase === "richtig" || quiz.phase === "aufgedeckt";
    let antwortBoxKlasse = "quiz-antwort-box";
    if (quiz.phase === "richtig") antwortBoxKlasse += " richtig";
    else if (quiz.phase === "aufgedeckt") antwortBoxKlasse += " aufgedeckt";
    else if (quiz.feedback) antwortBoxKlasse += " falsch";

    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" onClick={() => { beendeQuiz(); }}>Beenden</button>
            <span className="topbar-title">{quiz.index + 1} / {quiz.vokabeln.length}</span>
            <span className="quiz-fortschritt">Score: {diktatScore > 0 ? "+" : ""}{diktatScore}</span>
          </div>
          <div className="sektion" style={{display:"flex", flexDirection:"column", paddingBottom:0}}>
            {/* Lautsprecher-Box – nicht Teil der Weiter-Zone */}
            <div className="quiz-frage-box" style={{textAlign:"center", marginBottom:14, flexShrink:0}}>
              <div className="quiz-label">{quiz.liste.spalten[quiz.diktatSpalte]?.name || quiz.diktatSpalte} — hör genau hin!</div>
              {quiz.diktatSpalte.startsWith('E') && (
                <button className="diktat-play-btn"
                  onClick={() => { setDiktatManualPlays(p => p + 1); sprich(diktatWort, spalteLang(quiz.diktatSpalte)); }}>
                  <IcoSpkOn s={52}/>
                </button>
              )}
              {uebersetzung && (
                <div className="diktat-uebersetzung" style={{visibility: diktatManualPlays >= 2 ? "visible" : "hidden"}}>
                  {quiz.liste.spalten[quiz.diktatUeberspalte]?.name || quiz.diktatUeberspalte}: {uebersetzung}
                </div>
              )}
            </div>

            {/* Weiter-Zone: gesamter Bereich unterhalb der Lautsprecher-Box */}
            <div
              onClick={() => diktatWeiter && naechsteDiktatVokabel()}
              style={{
                cursor: diktatWeiter ? "pointer" : "default",
                flex: 1,
                minHeight: "60vh",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}>
              <div className={antwortBoxKlasse}>
                {quiz.phase === "eingabe" && <div className="quiz-label">Deine Eingabe</div>}
                {quiz.phase === "eingabe" && hint && <div className="diktat-hint">{hint}</div>}
                {quiz.phase === "eingabe" && (
                  <input ref={eingabeRef} className="inp"
                    value={quiz.eingabe}
                    onChange={e => setQuiz(prev => ({...prev, eingabe: e.target.value}))}
                    onKeyDown={e => e.key === "Enter" && pruefeDiktatAntwort()}
                    onClick={e => e.stopPropagation()}
                    placeholder="Was wurde vorgelesen?"
                    style={{marginTop:4}}
                  />
                )}
                {quiz.phase === "richtig" && (
                  <div style={{textAlign:"center", padding:"12px 0", fontSize:"1.15rem"}}>
                    <strong>{diktatWort}</strong>
                    {uebersetzung ? <span style={{color:"#1b5e20"}}> – {uebersetzung}</span> : null}
                    <span style={{color:"#1b5e20"}}> ✓</span>
                  </div>
                )}
                {quiz.phase === "aufgedeckt" && (
                  <div style={{textAlign:"center", padding:"12px 0", fontSize:"1.15rem"}}>
                    <strong>{diktatWort}</strong>
                    {uebersetzung ? <span style={{color:"#6b6560"}}> – {uebersetzung}</span> : null}
                  </div>
                )}
                {quiz.feedback && quiz.phase === "eingabe" && (
                  <div className="quiz-feedback nein">{quiz.feedback}</div>
                )}
              </div>

              <div className="quiz-aktionen" onClick={e => e.stopPropagation()}>
                {quiz.phase === "eingabe" && (
                  <>
                    <button className="btn btn-primary" onClick={pruefeDiktatAntwort}>Prüfen</button>
                    {quiz.diktatSpalte.startsWith('E') && (
                      <button className="btn btn-ghost" onClick={() => sprichDiktatNochmal(diktatWort, spalteLang(quiz.diktatSpalte))}><IcoSpkOn s={18}/> Andere Stimme</button>
                    )}
                    <button className="btn btn-ghost" onClick={zeigeDiktatLoesung}>Lösung anzeigen</button>
                  </>
                )}
                {diktatWeiter && (
                  <button className="btn btn-primary" onClick={e => { e.stopPropagation(); naechsteDiktatVokabel(); }}>Weiter →</button>
                )}
              </div>
            </div>
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
              <button className="topbar-back" onClick={() => { beendeQuiz(); }}>Schließen</button>
              <span className="topbar-title">Quiz abgeschlossen</span>
            </div>
            <div className="sektion">
              <div className="leer">
                <div style={{fontSize:"2.5rem"}}>✓</div>
                <div className="leer-text">Alle {quiz.vokabeln.length} Vokabeln abgefragt!</div>
              </div>
              <button className="btn btn-primary" style={{width:"100%"}}
                onClick={() => { beendeQuiz(); }}>
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
    const aktAntwortTyp = quiz.antwortTypen[quiz.antwortTypIndex];
    const antwortLabel = quiz.liste.spalten[aktAntwortTyp]?.name || aktAntwortTyp;
    const aktSpaltModus = quiz.spalteModus?.[aktAntwortTyp] || "tippen";
    const isKarteEingabe = aktSpaltModus === "karte" && quiz.phase === "eingabe";
    const isKarteAufgedeckt = aktSpaltModus === "karte" && quiz.phase === "aufgedeckt" && !quiz.karteNeinFlash;
    const richtigAufgedeckt = !!quiz.richtigAufgedeckt && quiz.phase === "aufgedeckt";
    const infoSpalten = (quiz.sitzungsInfoTypen || []).filter(t => aktVokRaw[t]?.wert);
    const score = aktVok?.fortschritt?.score ?? 0;
    const isWeitere = quiz.phase === "weitere";
    const frageWert = aktVokRaw[quiz.frageTyp]?.wert || "";

    let antwortBoxKlasse = "quiz-antwort-box";
    if (quiz.flash) antwortBoxKlasse += " richtig";
    else if (richtigAufgedeckt) antwortBoxKlasse += " richtig";
    else if (quiz.karteNeinFlash) antwortBoxKlasse += " falsch";
    else if (quiz.falschFlash) antwortBoxKlasse += " falsch";
    else if (quiz.phase === "aufgedeckt") antwortBoxKlasse += " aufgedeckt";
    else if (isWeitere) antwortBoxKlasse += " weitere";

    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" onClick={() => { beendeQuiz(); }}>Beenden</button>
            <span className="topbar-title">{quiz.index + 1} / {quiz.vokabeln.length}</span>
            <span className="quiz-fortschritt">Score: {score > 0 ? "+" : ""}{score}</span>
          </div>
          <div className="sektion"
            onClick={isKarteEingabe ? deckeKarteAuf : richtigAufgedeckt ? naechsteVokabel : undefined}
            style={(isKarteEingabe || richtigAufgedeckt) ? {cursor:"pointer", minHeight: isKarteEingabe ? "70vh" : undefined} : undefined}>

            {/* Haupt-Layout: linke Spalte (Frage + Antwort) | rechte Spalte (Info) */}
            {(() => {
              // Info-Seiten berechnen
              const alleInfoSeiten = infoSpalten.flatMap(typ => {
                const text = aktVokRaw[typ]?.wert || "";
                const name = quiz.liste.spalten[typ]?.name || typ;
                const pages = splitInSeiten(text);
                return pages.map((page, i) => ({
                  name,
                  text: (i > 0 ? "…" : "") + page + (i < pages.length - 1 ? "…" : ""),
                  page: i, total: pages.length,
                }));
              });
              const aktInfoSeite = alleInfoSeiten.length > 0
                ? alleInfoSeiten[(quiz.infoSeite || 0) % alleInfoSeiten.length]
                : null;
              const infoSeitenAnzahl = alleInfoSeiten.length;

              return (
                <div style={{display:"flex", gap:10, alignItems:"stretch", marginBottom:14}}>
                  {/* Linke Spalte */}
                  <div style={{flex:1, display:"flex", flexDirection:"column", gap:10}}>
                    <div className="quiz-frage-box" style={{marginBottom:0}}>
                      <div className="quiz-label">{frageLabel}</div>
                      <div style={{display:"flex", alignItems:"baseline", gap:8, justifyContent:"center"}}>
                        <div className="quiz-frage-text" style={{textAlign:"center"}}>{frageWert}</div>
                        {quiz.frageTyp.startsWith('E') && (
                          <button className="btn-icon" style={{fontSize:"1.1rem", padding:"2px 4px"}}
                            onClick={e => { e.stopPropagation(); sprich(frageWert, spalteLang(quiz.frageTyp)); }}><IcoSpk s={16}/></button>
                        )}
                      </div>
                    </div>

                    {quiz.vorigeRichtig.map((v, i) => (
                      <div key={i} className="quiz-vorig">
                        <div className="quiz-vorig-label">✓ {v.label}</div>
                        <div style={{textAlign:"center", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", gap:6}}>
                          <strong>{v.wert}</strong>
                          {v.typ.startsWith('E') && (
                            <button className="btn-icon" style={{fontSize:"0.95rem", padding:"2px 4px"}}
                              onClick={e => { e.stopPropagation(); sprich(v.wert, spalteLang(v.typ)); }}><IcoSpk s={16}/></button>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className={antwortBoxKlasse} style={{marginBottom:0}}>
                      <div className="quiz-label" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                        <span>{antwortLabel}{isWeitere && <span style={{color:"#6a1b9a", marginLeft:8}}>— weitere Antwort</span>}</span>
                        {(isKarteEingabe || isKarteAufgedeckt || quiz.karteNeinFlash) && (
                          <span className={`score-badge ${score > 0 ? "score-pos" : score < 0 ? "score-neg" : "score-null"}`} style={{fontSize:"0.88rem", padding:"2px 9px"}}>
                            {score > 0 ? "+" : ""}{score}
                          </span>
                        )}
                      </div>
                      {/* Karte-Modus: Aufdecken-Hinweis */}
                      {isKarteEingabe && (
                        <div className="karte-aufdecken">Tippe zum Aufdecken</div>
                      )}
                      {/* MC */}
                      {aktSpaltModus === "mc" && !quiz.flash && quiz.phase === "eingabe" && (
                        <div style={{display:"flex", flexWrap:"wrap", gap:8, marginTop:8, justifyContent:"center"}}>
                          {(quiz.mcButtons || []).map((btn, idx) => (
                            <button key={idx}
                              onClick={e => { e.stopPropagation(); quiz.phase === "eingabe" && klickeButton(idx); }}
                              style={{
                                padding:"9px 16px", borderRadius:10, border:"none",
                                fontFamily:"inherit", fontSize:"0.9rem", fontWeight:600,
                                cursor: btn.status === "richtig" || quiz.phase === "aufgedeckt" ? "default" : "pointer",
                                background:
                                  btn.status === "richtig" ? "#2d6a4f" :
                                  btn.status === "falsch"  ? "#c0392b" : "#e0dbd2",
                                color: btn.status === "neutral" ? "#1a1a1a" : "#fff",
                                transition: "background .15s",
                              }}
                            >{btn.text}</button>
                          ))}
                        </div>
                      )}
                      {/* Tippen */}
                      {aktSpaltModus === "tippen" && !quiz.flash && quiz.phase === "eingabe" && (
                        <input ref={eingabeRef} className="inp"
                          value={quiz.eingabe}
                          onChange={e => setQuiz(prev => ({...prev, eingabe: e.target.value}))}
                          onKeyDown={e => e.key === "Enter" && pruefeAntwort()}
                          onClick={e => e.stopPropagation()}
                          placeholder="Antwort eingeben…"
                          style={{marginTop:4}}
                        />
                      )}
                      {aktSpaltModus === "tippen" && !quiz.flash && isWeitere && (
                        <input ref={eingabeRef} className="inp"
                          value={quiz.eingabe}
                          onChange={e => setQuiz(prev => ({...prev, eingabe: e.target.value}))}
                          onKeyDown={e => e.key === "Enter" && pruefeAntwort()}
                          onClick={e => e.stopPropagation()}
                          placeholder="Weitere Antwort eingeben…"
                          style={{marginTop:4}}
                        />
                      )}
                      {/* Lösung: Flash (richtig) */}
                      {quiz.flash && (
                        <div className="quiz-frage-text" style={{textAlign:"center", color:"#1b5e20", minHeight:"44px", display:"flex", alignItems:"center", justifyContent:"center"}}>
                          {quiz.antwortTeile.join(" / ")}{" ✓"}
                        </div>
                      )}
                      {/* Lösung: Aufgedeckt */}
                      {!quiz.flash && quiz.phase === "aufgedeckt" && (
                        aktSpaltModus === "mc"
                          ? <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:8, minHeight:60}}>
                              <div className="quiz-frage-text" style={{textAlign:"center"}}>{quiz.antwortTeile.join(" / ")}</div>
                              {aktAntwortTyp.startsWith('E') && (
                                <button className="btn-icon" style={{fontSize:"1rem", padding:"2px 4px"}}
                                  onClick={e => { e.stopPropagation(); sprich(quiz.antwortTeile[0], spalteLang(aktAntwortTyp)); }}><IcoSpk s={16}/></button>
                              )}
                            </div>
                          : <div className="quiz-frage-text" style={{textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:6, minHeight:"44px"}}>
                              {quiz.antwortTeile.join(" / ")}
                              {!isKarteAufgedeckt && aktAntwortTyp.startsWith('E') && (
                                <button className="btn-icon" style={{fontSize:"1rem", padding:"2px 4px"}}
                                  onClick={e => { e.stopPropagation(); sprich(quiz.antwortTeile[0], spalteLang(aktAntwortTyp)); }}><IcoSpk s={16}/></button>
                              )}
                            </div>
                      )}
                      {quiz.feedback && !quiz.flash && (
                        <div className={`quiz-feedback ${(quiz.falschFlash || (isWeitere && quiz.feedback.startsWith("Nicht"))) ? "nein" : "ok"}`}
                          style={{textAlign:"center"}}>
                          {quiz.feedback}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rechte Spalte: Info-Box */}
                  {quiz.infoSichtbar && aktInfoSeite && (
                    <div onClick={() => setQuiz(prev => ({...prev, infoSeite: ((prev.infoSeite || 0) + 1) % infoSeitenAnzahl}))}
                      style={{
                        width:150, flexShrink:0, background:"#fffde7",
                        border:"1px solid #ffe082", borderRadius:12, padding:"12px",
                        cursor: infoSeitenAnzahl > 1 ? "pointer" : "default",
                        display:"flex", flexDirection:"column", gap:6,
                      }}>
                      <div style={{fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase",
                        letterSpacing:".05em", color:"#f57f17"}}>
                        {aktInfoSeite.name}
                      </div>
                      <div style={{fontSize:"0.85rem", lineHeight:1.45, flex:1}}>
                        {aktInfoSeite.text}
                      </div>
                      {infoSeitenAnzahl > 1 && (
                        <div style={{fontSize:"0.7rem", color:"#f9a825", textAlign:"right", marginTop:"auto"}}>
                          {(quiz.infoSeite || 0) % infoSeitenAnzahl + 1} / {infoSeitenAnzahl}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Noch kommende Spalten */}
            {!quiz.flash && quiz.antwortTypen.length > 1 && (quiz.phase === "eingabe" || quiz.phase === "falsch" || isWeitere) && (
              <div style={{fontSize:"0.78rem", color:"#6b6560", marginBottom:10}}>
                Noch: {quiz.antwortTypen.slice(quiz.antwortTypIndex + 1)
                  .map(t => quiz.liste.spalten[t]?.name || t).join(" → ")}
              </div>
            )}

            <div className="quiz-aktionen" onClick={e => e.stopPropagation()}>
              {!quiz.flash && quiz.phase === "eingabe" && !isKarteEingabe && (
                <>
                  {aktSpaltModus === "tippen" && (
                    <button className="btn btn-primary" onClick={pruefeAntwort}>Prüfen</button>
                  )}
                  <button className="btn btn-ghost" onClick={zeigeLosung}>Lösung anzeigen</button>
                  {infoSpalten.length > 0 && (
                    <button className="btn btn-ghost"
                      onClick={() => setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar}))}>
                      {quiz.infoSichtbar ? "Info ▲" : "Info"}
                    </button>
                  )}
                </>
              )}
              {!quiz.flash && isWeitere && (
                <>
                  <button className="btn btn-primary" onClick={pruefeAntwort}>Prüfen</button>
                  <button className="btn btn-ghost" onClick={ueberspringeWeitere}>Überspringen</button>
                  {infoSpalten.length > 0 && (
                    <button className="btn btn-ghost"
                      onClick={() => setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar}))}>
                      {quiz.infoSichtbar ? "Info ▲" : "Info"}
                    </button>
                  )}
                </>
              )}
              {/* Karte: Gewusst / Nicht gewusst */}
              {!quiz.flash && isKarteAufgedeckt && (
                <div className="karte-bewertung" style={{width:"100%"}}>
                  <button className="karte-btn karte-btn-nein" onClick={() => bewerteKarte(false)}>✗ Nicht gewusst</button>
                  <button className="karte-btn karte-btn-ja" onClick={() => bewerteKarte(true)}>✓ Gewusst</button>
                </div>
              )}
              {!quiz.flash && quiz.phase === "aufgedeckt" && !isKarteAufgedeckt && (
                <>
                  {quiz.antwortTypIndex > 0 && !richtigAufgedeckt && (
                    <button className="btn btn-primary" onClick={geheZurueck}>← Zurück</button>
                  )}
                  <button className="btn btn-primary" onClick={e => { e.stopPropagation(); naechsteVokabel(); }}>Weiter →</button>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Render: Statistik ────────────────────────────────────────────────────
  if (ansicht === "statistik" && aktiveListe) {
    const abgefragt = aktiveListe.vokabeln.filter(v => v.fortschritt);
    const nieAnzahl = aktiveListe.vokabeln.length - abgefragt.length;
    const positivAnzahl = abgefragt.filter(v => v.fortschritt.score > 0).length;
    const negativAnzahl = abgefragt.filter(v => v.fortschritt.score < 0).length;
    const nullAnzahl = abgefragt.filter(v => v.fortschritt.score === 0).length;
    const scores = abgefragt.map(v => v.fortschritt.score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    let voks = [...aktiveListe.vokabeln];
    if (statistikFilter === "nie") voks = voks.filter(v => !v.fortschritt);
    else if (statistikFilter === "negativ") voks = voks.filter(v => (v.fortschritt?.score ?? 0) < 0);
    else if (statistikFilter === "positiv") voks = voks.filter(v => (v.fortschritt?.score ?? 0) > 0);
    else if (statistikFilter === "null") voks = voks.filter(v => v.fortschritt && v.fortschritt.score === 0);

    const [sKey, sDir] = statistikSort.split("-");
    if (sKey === "score") voks.sort((a, b) => { const d = (a.fortschritt?.score ?? 0) - (b.fortschritt?.score ?? 0); return sDir === "asc" ? d : -d; });
    else if (sKey === "streak") voks.sort((a, b) => { const d = (a.fortschritt?.streak ?? 0) - (b.fortschritt?.streak ?? 0); return sDir === "asc" ? d : -d; });
    else if (sKey === "datum") voks.sort((a, b) => { const da = a.fortschritt?.letzteAbfrage ? new Date(a.fortschritt.letzteAbfrage) : new Date(0); const db = b.fortschritt?.letzteAbfrage ? new Date(b.fortschritt.letzteAbfrage) : new Date(0); return sDir === "asc" ? da - db : db - da; });
    else if (sKey === "alpha") { const sp = TYPEN.find(t => aktiveListe.spalten[t].aktiv); if (sp) voks.sort((a, b) => { const r = (a[sp]?.wert || '').localeCompare(b[sp]?.wert || ''); return sDir === "asc" ? r : -r; }); }

    const sp1 = TYPEN.find(t => aktiveListe.spalten[t].aktiv);
    const sp2 = TYPEN.filter(t => aktiveListe.spalten[t].aktiv)[1];

    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" onClick={() => setAnsicht("liste-detail")}><IcoBack/></button>
            <span className="topbar-title">Statistik – {aktiveListe.name}</span>
          </div>
          <div className="sektion">
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12}}>
              {[
                {label:"Gesamt", wert:aktiveListe.vokabeln.length, farbe:null},
                {label:"Nie abgefragt", wert:nieAnzahl, farbe:nieAnzahl>0?"#6b6560":"#2d6a4f"},
                {label:"Score positiv", wert:positivAnzahl, bg:"#e8f5e9", rand:"#c8e6c9", farbe:"#2d6a4f"},
                {label:"Score negativ", wert:negativAnzahl, bg:"#ffebee", rand:"#ffcdd2", farbe:"#c0392b"},
              ].map(k => (
                <div key={k.label} style={{background:k.bg||"#fff", border:`1px solid ${k.rand||"#e0dbd2"}`, borderRadius:10, padding:"12px 14px"}}>
                  <div style={{fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".07em", color:k.farbe||"#6b6560"}}>{k.label}</div>
                  <div style={{fontSize:"1.6rem", fontWeight:700, marginTop:4, color:k.farbe||"#1a1a1a"}}>{k.wert}</div>
                </div>
              ))}
            </div>
            {avgScore !== null && (
              <div style={{background:"#fff", border:"1px solid #e0dbd2", borderRadius:10, padding:"11px 14px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <span style={{fontSize:"0.82rem", color:"#6b6560", fontWeight:600}}>Ø Score (abgefragte Vokabeln)</span>
                <span style={{fontWeight:700, color: avgScore > 0 ? "#2d6a4f" : avgScore < 0 ? "#c0392b" : "#6b6560"}}>
                  {avgScore > 0 ? "+" : ""}{avgScore.toFixed(1)}
                </span>
              </div>
            )}

            <div className="sektion-label" style={{marginBottom:8}}>Filter</div>
            <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:12}}>
              {[
                {key:"alle", label:`Alle (${aktiveListe.vokabeln.length})`},
                {key:"nie", label:`Nie (${nieAnzahl})`},
                {key:"negativ", label:`Neg (${negativAnzahl})`},
                {key:"null", label:`Null (${nullAnzahl})`},
                {key:"positiv", label:`Pos (${positivAnzahl})`},
              ].map(f => (
                <button key={f.key} className={`typ-btn${statistikFilter===f.key?" aktiv":""}`}
                  onClick={() => setStatistikFilter(f.key)}>{f.label}</button>
              ))}
            </div>

            <div className="sektion-label" style={{marginBottom:8}}>Sortierung</div>
            <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:16}}>
              {[
                {key:"score", label:"Score", def:"asc"},
                {key:"streak", label:"Streak", def:"desc"},
                {key:"datum", label:"Datum", def:"desc"},
                {key:"alpha", label:"A→Z", def:"asc"},
              ].map(s => {
                const [aKey, aDir] = statistikSort.split("-");
                const isActive = aKey === s.key;
                return (
                  <button key={s.key} className={`typ-btn${isActive?" aktiv":""}`}
                    onClick={() => isActive
                      ? setStatistikSort(`${s.key}-${aDir === "asc" ? "desc" : "asc"}`)
                      : setStatistikSort(`${s.key}-${s.def}`)}>
                    {s.label}{isActive ? (aDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                );
              })}
            </div>

            <div className="sektion-label" style={{marginBottom:8}}>{voks.length} Vokabel{voks.length!==1?"n":""}</div>
            <div className="karte">
              {voks.length === 0 ? (
                <div className="karte-zeile" style={{color:"#6b6560", fontSize:"0.85rem"}}>Keine Vokabeln in diesem Filter.</div>
              ) : voks.map(vok => {
                const score = vok.fortschritt?.score ?? null;
                const streak = vok.fortschritt?.streak ?? 0;
                return (
                  <div key={vok.id} className="karte-zeile">
                    <div style={{flex:1, minWidth:0}}>
                      {sp1 && vok[sp1] && <div style={{fontWeight:600, fontSize:"0.9rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{vok[sp1].wert}</div>}
                      {sp2 && vok[sp2] && <div style={{fontSize:"0.78rem", color:"#6b6560", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{vok[sp2].wert}</div>}
                    </div>
                    <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3, flexShrink:0}}>
                      <span className={`score-badge ${score !== null ? (score > 0 ? "score-pos" : score < 0 ? "score-neg" : "score-null") : "score-null"}`}>
                        {score !== null ? (score > 0 ? "+" : "") + score : "–"}
                      </span>
                      <div style={{fontSize:"0.68rem", color:"#6b6560", textAlign:"right"}}>
                        {streak > 0 && <span style={{marginRight:4}}>🔥{streak}</span>}
                        {formatDatum(vok.fortschritt?.letzteAbfrage)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Quiz: Berechnungen (auch im Header gebraucht) ────────────────────────
  const quizKombiListe = quizTabListen.length > 0 ? getKombinierteListe(quizTabListen) : null;
  const quizRelevanteTypen = quizModus === "sequenziell"
    ? [quizFrageTyp, ...quizAntwortTypenGeordnet].filter(Boolean)
    : quizAusgewaehlt;
  const quizBasisVoks = quizKombiListe
    ? quizModus === "diktat"
      ? quizKombiListe.vokabeln.filter(v => v[quizDiktatSpalte])
      : quizRelevanteTypen.length >= 2
      ? quizKombiListe.vokabeln.filter(v => quizRelevanteTypen.every(t => v[t]))
      : quizKombiListe.vokabeln
    : [];
  const quizGefilterteVoks = (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0)
    ? quizBasisVoks.filter(v => quizCheckboxAuswahl.has(v.id))
    : quizBasisVoks;

  // ── Render: Haupt (Tabs immer sichtbar) ──────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div ref={headerRef} style={{position:"sticky", top:0, zIndex:10, background:"#fff"}}>
        <div className="topbar"><span className="topbar-title">Vokabel-Trainer</span></div>
        <div className="tabs">
          <button className={`tab${tab==="listen"?" aktiv":""}`}
            onClick={() => { setTab("listen"); setAnsicht("uebersicht"); }}>Listen</button>
          <button className={`tab${tab==="quiz"?" aktiv":""}`}
            onClick={() => { setTab("quiz"); setExportAuswahlModus(false); setExportAusgewaehlt(new Set()); }}>Quiz</button>
          <button className={`tab${tab==="statistik"?" aktiv":""}`}
            onClick={() => { setTab("statistik"); setExportAuswahlModus(false); setExportAusgewaehlt(new Set()); }}>Statistik</button>
          <button className={`tab${tab==="einstellungen"?" aktiv":""}`} onClick={() => { setTab("einstellungen"); setExportAuswahlModus(false); setExportAusgewaehlt(new Set()); }}>Einstellungen</button>
        </div>
        {tab === "quiz" && (() => {
          const n = quizTabListen.length;
          const headerText = n === 0
            ? "Listen auswählen"
            : n === 1
            ? (listenIndex.find(l => l.id === quizTabListen[0])?.name || "Liste")
            : `${n} Listen ausgewählt`;
          return (
            <div className="liste-detail-header" style={{position:"relative"}}>
              <span className="liste-detail-header-name" style={{color: n === 0 ? "#aaa" : undefined}}>
                {headerText}
              </span>
              {n > 0 && (
                <span style={{fontSize:"0.8rem", color:"#aaa", flexShrink:0}}>({quizBasisVoks.length} V.)</span>
              )}
              <button className="btn-toggle" onClick={toggleListenAuswahl}>
                {listenAuswahlAufgeklappt ? <IcoDown/> : <IcoUp/>}
              </button>
            </div>
          );
        })()}

        </div>{/* end sticky header wrapper */}

        {/* ── Listen-Header (persistent) ── */}
        {tab === "listen" && ansicht !== "import" && ansicht !== "ki-prompt" && (
          <div className="liste-detail-header" style={{top: headerH}}>
            {ansicht === "uebersicht" ? (
              exportAuswahlModus ? (
                <>
                  <span className="liste-detail-header-name">
                    {exportAusgewaehlt.size === 0 ? "Liste auswählen" : `${exportAusgewaehlt.size} ausgewählt`}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setExportAuswahlModus(false); setExportAusgewaehlt(new Set());
                  }}>Abbrechen</button>
                </>
              ) : (
                <>
                  <span className="liste-detail-header-name">Meine Listen</span>
                  <button className="btn btn-ghost btn-sm" style={{display:"inline-flex",alignItems:"center",gap:5}} onClick={() => { resetImport(); setAnsicht("import"); }}><IcoPlus s={13}/>Neu</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setExportAuswahlModus(true)}>Exportieren</button>
                </>
              )
            ) : ansicht === "liste-detail" && aktiveListe ? (
              <>
                <span className="liste-detail-header-name">{aktiveListe.name}</span>
                <button className="btn-toggle" style={{padding:"4px 8px"}} onClick={() => setAktionszeileAufgeklappt(v => !v)}>
                  {aktionszeileAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                </button>
                <button className="btn btn-ghost-filled btn-sm" style={{padding:"6px 10px"}} onClick={() => oeffneModal("umbenennen")}><IcoPencil/></button>
              </>
            ) : null}
          </div>
        )}

        {/* ── Import Sub-Header ── */}
        {tab === "listen" && (ansicht === "import" || ansicht === "ki-prompt") && (
          <div className="liste-detail-header"
            style={ansicht === "ki-prompt" ? {cursor:"pointer", top: headerH} : {top: headerH}}
            onClick={ansicht === "ki-prompt" ? () => setAnsicht("import") : undefined}>
            <span className="liste-detail-header-name">Importieren</span>
            {ansicht === "import" && !importParsed && !importMehrfachListen && !importJsonData && (
              <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); analysiereImport(); }}>Analysieren</button>
            )}
            {ansicht === "import" && letzterPrompt && (
              <button className="btn btn-ghost btn-sm" onClick={e => {
                e.stopPropagation();
                navigator.clipboard.writeText(letzterPrompt)
                  .then(() => { setPromptKopiert(true); setTimeout(() => setPromptKopiert(false), 2000); });
              }}>{promptKopiert ? "✓" : "📋 Prompt"}</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setAnsicht("ki-prompt"); }}>Prompt generieren</button>
          </div>
        )}

        {/* ── KI-Prompt Sub-Header ── */}
        {tab === "listen" && ansicht === "ki-prompt" && (
          <div className="liste-detail-header" style={{top: headerH}}>
            <span className="liste-detail-header-name">KI-Prompt generieren</span>
            <button className="btn btn-primary btn-sm"
              onClick={() => {
                const text = generierePrompt(promptThema, promptAnzahl, promptFalsch, promptBeispiele, promptSynonyme, promptModus);
                navigator.clipboard.writeText(text)
                  .then(() => {
                    setLetzterPrompt(text);
                    setPromptKopiert(true);
                    setTimeout(() => { setPromptKopiert(false); setAnsicht("import"); }, 1500);
                  });
              }}>
              {promptKopiert ? "✓ Kopiert!" : "Kopieren"}
            </button>
          </div>
        )}

        {/* ── Import Inhalt ── */}
        {tab === "listen" && ansicht === "import" && (() => {
          const bl = getBestehendeListe();
          const zielOptionen = importZielTyp === "bestehend" && bl ? getBestehendZielOptionen(bl) : null;
          const anzahlZugewiesen = Object.values(importMapping).filter(t => t !== null).length;
          const anzahlGesamt = importParsed ? importParsed.header.length : 0;
          return (
            <div className="sektion">
              {importJsonData ? (
                <>
                  <div className="meldung-info" style={{background:"#e8f5e9", borderColor:"#a5d6a7"}}>
                    <strong>JSON-Backup erkannt:</strong> {importJsonData.length} Liste{importJsonData.length !== 1 ? "n" : ""} gefunden.
                  </div>
                  <div className="karte">
                    {importJsonData.map((l, i) => (
                      <div key={i} className="karte-zeile">
                        <span style={{fontWeight:600}}>{l.name}</span>
                        <span style={{color:"#6b6560", fontSize:"0.85rem", marginLeft:"auto"}}>{l.vokabeln?.length || 0} Vokabeln</span>
                      </div>
                    ))}
                  </div>
                  {importFehler && <div className="fehler">{importFehler}</div>}
                  <div style={{display:"flex", gap:10, marginBottom:24}}>
                    <button className="btn btn-ghost" onClick={() => { setImportJsonData(null); setImportDateiname(""); }}>Zurück</button>
                    <button className="btn btn-primary" onClick={importiereAusJsonDaten}>
                      Alle importieren ({importJsonData.length})
                    </button>
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
                        <span style={{fontWeight:600}}>{s.name}</span>
                        <span style={{color:"#6b6560", fontSize:"0.85rem", marginLeft:"auto"}}>{s.daten.length} Vokabeln</span>
                      </div>
                    ))}
                  </div>
                  {importFehler && <div className="fehler">{importFehler}</div>}
                  <div style={{display:"flex", gap:10, marginBottom:24}}>
                    <button className="btn btn-ghost" onClick={() => { setImportMehrfachListen(null); }}>Zurück</button>
                    <button className="btn btn-primary" onClick={importiereAlleListen}>
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
                  <input type="file" accept=".txt,.text,.json" ref={fileInputRef} style={{display:"none"}}
                    onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setImportDateiname(file.name);
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const raw = ev.target.result || "";
                        const bereinigt = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                        const trimmed = bereinigt.trim();
                        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                          try {
                            let parsed = JSON.parse(trimmed);
                            if (!Array.isArray(parsed)) parsed = [parsed];
                            const listen = parsed.filter(l => l && l.name && l.vokabeln);
                            if (!listen.length) { setImportFehler("Keine gültigen Listen im JSON."); return; }
                            setImportJsonData(listen);
                            setImportText(""); setImportFehler("");
                          } catch { setImportFehler("JSON konnte nicht gelesen werden."); }
                        } else {
                          setImportText(bereinigt);
                          setImportFehler("");
                        }
                      };
                      reader.readAsText(file, "UTF-8");
                      e.target.value = "";
                    }}
                  />
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6}}>
                    <div style={{display:"flex", alignItems:"baseline", gap:8}}>
                      <label className="inp-label" style={{marginBottom:0}}>Vokabeln einfügen</label>
                      {importText && (
                        <button className="btn-icon" style={{color:"#c0392b", fontSize:"0.82rem", fontWeight:700}}
                          onClick={() => { setImportText(""); setImportDateiname(""); setImportFehler(""); }}>✕</button>
                      )}
                    </div>
                    <div style={{display:"flex", gap:6}}>
                      <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>📄 Datei</button>
                      <button className="btn btn-ghost btn-sm" onClick={() =>
                        navigator.clipboard.readText().then(t => { setImportText(t); setImportDateiname(""); setImportFehler(""); }).catch(() => {})
                      }>Aus Zwischenablage</button>
                    </div>
                  </div>
                  {importDateiname && !importText && (
                    <div style={{fontSize:"0.82rem", color:"#888", marginBottom:6}}>Lese Datei…</div>
                  )}
                  {importDateiname && importText && (
                    <div style={{fontSize:"0.82rem", color:"#4a7c59", marginBottom:6, display:"flex", alignItems:"center", gap:6}}>
                      <span>✓</span>
                      <span style={{fontWeight:600}}>{importDateiname}</span>
                      <span style={{color:"#888"}}>— {importText.split('\n').filter(z => z.trim()).length} Zeilen erkannt</span>
                    </div>
                  )}
                  <textarea className="inp" rows={8}
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
                          <div style={{color:"#6b6560", fontSize:"0.85rem"}}>Noch keine Listen vorhanden.</div>
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
                  <div className="sektion-header">
                    <div className="sektion-label">Spalten zuweisen</div>
                    <span className="import-zaehler"><strong>{anzahlZugewiesen}</strong> / {anzahlGesamt}</span>
                  </div>
                  <div style={{background:"#f7f5f0", border:"1px solid #e0dbd2", borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:"0.82rem", color:"#6b6560"}}>
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
                              <span style={{fontSize:"0.85rem", color:"#6b6560"}}>← {h.wert || `Spalte ${i+1}`}</span>
                              <button className="btn-icon" style={{marginLeft:"auto", color:"#c0392b", fontSize:"0.75rem"}}
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
                                  <button key={opt.typ}
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
                                  <button key={typ}
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
                              {zelle.falsch.length > 0 && <span style={{fontSize:"0.75rem", color:"#6b6560"}}>(+{zelle.falsch.length} falsch)</span>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {importParsed.daten.length > 3 && (
                      <div className="karte-zeile" style={{color:"#6b6560", fontSize:"0.82rem"}}>… und {importParsed.daten.length - 3} weitere</div>
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
          );
        })()}

        {/* ── KI-Prompt Inhalt ── */}
        {tab === "listen" && ansicht === "ki-prompt" && (
          <div className="sektion">
            <div style={{display:"flex", justifyContent:"center", gap:8, marginBottom:12}}>
              <button className={`typ-btn${promptModus==="generieren"?" aktiv":""}`}
                onClick={() => setPromptModus("generieren")}>Generieren</button>
              <button className={`typ-btn${promptModus==="foto"?" aktiv":""}`}
                onClick={() => setPromptModus("foto")}>Foto umwandeln</button>
            </div>
            <div style={{fontSize:"0.82rem", color:"#6b6560", marginBottom:12, textAlign:"center"}}>
              {promptModus === "generieren"
                ? "KI erstellt neue Vokabeln zum angegebenen Thema."
                : "KI liest Vokabeln aus einem beigefügten Foto und formatiert sie ins Import-Format."}
            </div>
            {promptModus === "generieren" && (
              <>
                <div className="sektion-label" style={{marginBottom:8}}>Thema</div>
                <input className="inp" value={promptThema}
                  onChange={e => setPromptThema(e.target.value)}
                  placeholder="z.B. Irregular Verbs, Adjektive Unit 5" />
                <div style={{display:"flex", gap:12, marginTop:12}}>
                  <div style={{flex:1}}>
                    <label className="inp-label">Anzahl Vokabeln</label>
                    <input className="inp" type="number" min={1} max={200} value={promptAnzahl}
                      onChange={e => setPromptAnzahl(e.target.value)} />
                  </div>
                  <div style={{flex:1}}>
                    <label className="inp-label">Falsche Antworten (0–20)</label>
                    <input className="inp" type="number" min={0} max={20} value={promptFalsch}
                      onChange={e => setPromptFalsch(Math.min(20, Math.max(0, parseInt(e.target.value)||0)))} />
                  </div>
                </div>
              </>
            )}
            {promptModus === "foto" && (
              <div style={{marginBottom:4}}>
                <label className="inp-label">Falsche Antworten (0–20)</label>
                <input className="inp" type="number" min={0} max={20} value={promptFalsch}
                  onChange={e => setPromptFalsch(Math.min(20, Math.max(0, parseInt(e.target.value)||0)))} />
              </div>
            )}
            <div className="karte" style={{marginTop:16}}>
              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Beispielsätze</div>
                  <div className="toggle-sub">Info-Spalte mit englischen Beispielsätzen</div>
                </div>
                <div className="toggle-btn">
                  <button className={`toggle-opt${!promptBeispiele?" aktiv":""}`} onClick={() => setPromptBeispiele(false)}>Nein</button>
                  <button className={`toggle-opt${promptBeispiele?" aktiv":""}`} onClick={() => setPromptBeispiele(true)}>Ja</button>
                </div>
              </div>
              <div className="toggle-row" style={{borderTop:"1px solid #e0dbd2"}}>
                <div>
                  <div className="toggle-label">Synonyme</div>
                  <div className="toggle-sub">Info-Spalte mit 2–4 englischen Synonymen</div>
                </div>
                <div className="toggle-btn">
                  <button className={`toggle-opt${!promptSynonyme?" aktiv":""}`} onClick={() => setPromptSynonyme(false)}>Nein</button>
                  <button className={`toggle-opt${promptSynonyme?" aktiv":""}`} onClick={() => setPromptSynonyme(true)}>Ja</button>
                </div>
              </div>
            </div>
            <div className="sektion-label" style={{marginBottom:8, marginTop:16}}>Generierter Prompt</div>
            <textarea className="inp" rows={12} readOnly
              value={generierePrompt(promptThema, promptAnzahl, promptFalsch, promptBeispiele, promptSynonyme, promptModus)}
              style={{fontFamily:"monospace", fontSize:"0.78rem", lineHeight:1.6}} />
          </div>
        )}

        {/* ── Quiz-Tab ── */}
        {tab === "quiz" && (() => {
          const kombiListe = quizKombiListe;
          const basisVoks = quizBasisVoks;
          const gefilterteVoks = quizGefilterteVoks;
          const abfragbar = kombiListe ? TYPEN.filter(t => !t.startsWith('i') && kombiListe.spalten[t].aktiv) : [];
          const infoSpalten = kombiListe ? TYPEN.filter(t => t.startsWith('i') && kombiListe.spalten[t].aktiv) : [];
          const kannStarten = kombiListe && (quizModus === "rotierend"
            ? quizAusgewaehlt.length >= 2
            : quizModus === "diktat"
            ? !!kombiListe.spalten[quizDiktatSpalte]?.aktiv
            : quizFrageTyp && quizAntwortTypenGeordnet.length >= 1);
          let verfuegbar;
          if (quizReihenfolge === "schlechteste") {
            let scVoks = gefilterteVoks;
            if (quizSchlechtesteMaxScore !== "" && !isNaN(parseFloat(quizSchlechtesteMaxScore))) {
              const thr = parseFloat(quizSchlechtesteMaxScore);
              scVoks = gefilterteVoks.filter(v => (v.fortschritt?.score ?? 0) < thr);
            }
            verfuegbar = Math.min(Math.max(1, parseInt(quizSchlechtesteAnzahl)||1), scVoks.length);
          } else {
            verfuegbar = gefilterteVoks.length;
          }

          return (
            <>
              <div className="sektion" style={{paddingTop:0}}>
                {/* LISTEN-AUSWAHL */}
                <div ref={listenContainerRef} style={{overflow:'hidden', paddingTop: listenAuswahlAufgeklappt ? 16 : 0}}>
                  {listenAuswahlAufgeklappt && (
                    listenIndex.length === 0
                      ? <div className="leer"><div className="leer-text">Noch keine Listen vorhanden.</div></div>
                      : <div className="karte" style={{marginBottom:16}}>
                        {listenIndex.map(l => {
                          const ll = lsGet(SK.liste(l.id));
                          const lAbfragbar = ll ? TYPEN.filter(t => !t.startsWith('i') && ll.spalten[t].aktiv) : [];
                          const lInfo = ll ? TYPEN.filter(t => t.startsWith('i') && ll.spalten[t].aktiv) : [];
                          const anzahl = ll ? ll.vokabeln.length : 0;
                          const gewaehlt = quizTabListen.includes(l.id);
                          return (
                            <div key={l.id} className="quiz-setup-check" style={{padding:"10px 16px"}}
                              onClick={() => toggleQuizTabListe(l.id)}>
                              <div className={`checkbox${gewaehlt?" checked":""}`}>{gewaehlt?"✓":""}</div>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:600, fontSize:"0.9rem"}}>{l.name}</div>
                                <div style={{fontSize:"0.78rem", color:"#6b6560", marginTop:2}}>
                                  {anzahl} Vokabel{anzahl!==1?"n":""}
                                  {ll && lAbfragbar.map(t => <span key={t} className="spalten-badge aktiv" style={{marginLeft:4}}>{ll.spalten[t].name||t}</span>)}
                                  {ll && lInfo.map(t => <span key={t} className="spalten-badge" style={{marginLeft:4}}>{ll.spalten[t].name||t}</span>)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  )}
                </div>

                {/* Platzhalter wenn keine Liste gewählt und Liste eingeklappt */}
                {!listenAuswahlAufgeklappt && quizTabListen.length === 0 && (
                  <div style={{padding:"48px 16px", textAlign:"center"}}>
                    <span style={{fontSize:"1.3rem", color:"#c0bcb7", fontWeight:600}}>Bitte Liste auswählen</span>
                  </div>
                )}

                {/* Alle/Bereich – sticky direkt unter Haupt-Header */}
                {kombiListe && (
                  <div ref={alleBereichRef} style={{position:"sticky", top:headerH, zIndex:8, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginLeft:"-16px", marginRight:"-16px"}}>
                    <div className="toggle-btn">
                      <button className={`toggle-opt${quizBereichTyp==="alle"?" aktiv":""}`}
                        onClick={() => { setQuizBereichTyp("alle"); setQuizCheckboxAuswahl(new Set()); setQuizListeAufgeklappt(false); setQuizVonBisModus(false); setQuizVonBisErster(null); }}>
                        Alle
                      </button>
                      <button className={`toggle-opt${quizBereichTyp==="bereich"?" aktiv":""}`}
                        onClick={() => { if (quizBereichTyp !== "bereich") { setQuizBereichTyp("bereich"); setQuizListeAufgeklappt(true); } }}>
                        Bereich
                      </button>
                    </div>
                    {quizBereichTyp === "bereich" && (
                      <>
                        {quizCheckboxAuswahl.size > 0 && (
                          <button className="btn btn-ghost btn-sm"
                            style={{padding:"6px 8px"}}
                            onClick={() => { setQuizCheckboxAuswahl(new Set()); setQuizVonBisModus(false); setQuizVonBisErster(null); }}>
                            <IcoX s={12}/>
                          </button>
                        )}
                        {quizListeAufgeklappt && (
                          <button
                            className={`btn btn-sm${quizVonBisModus ? " btn-primary" : " btn-ghost"}`}
                            onClick={() => {
                              if (quizVonBisModus) { setQuizVonBisModus(false); setQuizVonBisErster(null); }
                              else { setQuizVonBisModus(true); }
                            }}>
                            {!quizVonBisModus ? "Von–Bis" : quizVonBisErster === null ? "Von…" : "…Bis"}
                          </button>
                        )}
                        <span style={{flex:1, textAlign:"right", fontSize:"0.8rem", color:"#aaa"}}>
                          ({quizGefilterteVoks.length} V.)
                        </span>
                        <button className="btn-toggle-ghost" onClick={toggleEinzelauswahl}>
                          {quizListeAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Einzelauswahl (Bereich-Modus) */}
                {quizListeAufgeklappt && quizBereichTyp === "bereich" && kombiListe && (
                  <div ref={einzelauswahlRef} className="karte" style={{marginBottom:8, marginTop:8}}>
                    {basisVoks.length === 0
                      ? <div style={{padding:"16px", color:"#6b6560", fontSize:"0.85rem"}}>Keine Vokabeln verfügbar.</div>
                      : basisVoks.map((vok, idx) => {
                        const inChk = quizCheckboxAuswahl.has(vok.id);
                        const isVon = quizVonBisModus && vok.id === quizVonBisErster;
                        const sp1 = abfragbar[0]; const sp2 = abfragbar[1];
                        return (
                          <div key={vok.id} className="vok-zeile"
                            style={{background: isVon ? "#fff3cd" : inChk ? "#f0f7f0" : "transparent"}}
                            onClick={() => {
                              if (!quizVonBisModus) { toggleVokCheckbox(vok.id); return; }
                              if (quizVonBisErster === null) {
                                setQuizVonBisErster(vok.id);
                              } else {
                                const vonIdx = basisVoks.findIndex(v => v.id === quizVonBisErster);
                                const [lo, hi] = vonIdx <= idx ? [vonIdx, idx] : [idx, vonIdx];
                                setQuizCheckboxAuswahl(prev => {
                                  const neu = new Set(prev);
                                  basisVoks.slice(lo, hi + 1).forEach(v => neu.add(v.id));
                                  return neu;
                                });
                                setQuizVonBisModus(false);
                                setQuizVonBisErster(null);
                              }
                            }}>
                            <div className={`checkbox${isVon ? " checked" : inChk?" checked":""}`} style={{flexShrink:0, ...(isVon ? {background:"#f0a500", borderColor:"#f0a500"} : {})}}>{isVon?"→":inChk?"✓":""}</div>
                            <span className="vok-nr">{idx+1}</span>
                            <span style={{fontSize:"0.88rem", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{sp1?vok[sp1]?.wert||'':''}</span>
                            <span style={{fontSize:"0.82rem", color:"#6b6560", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"right"}}>{sp2?vok[sp2]?.wert||'':''}</span>
                          </div>
                        );
                      })
                    }
                  </div>
                )}

                {/* Quiz starten Button - sticky unter Alle/Bereich-Zeile */}
                {kombiListe && (
                  <div style={{position:"sticky", top:headerH + alleBereichH, zIndex:7, background:"#fff", padding:"8px 16px", marginLeft:"-16px", marginRight:"-16px", marginBottom:8, borderBottom:"1px solid #e0dbd2"}}>
                    <button className="btn btn-primary" style={{width:"100%"}}
                      onClick={starteQuiz} disabled={!kannStarten || verfuegbar === 0}>
                      Quiz starten ({verfuegbar} Vokabeln)
                    </button>
                  </div>
                )}

                {/* CONFIG (nur wenn Listen gewählt) */}
                {kombiListe && (<>
                  {/* GESPEICHERTE KONFIGURATIONEN */}
                  {sessionSlots.length > 0 && (
                    <>
                      <div className="sektion-label" style={{marginBottom:8}}>Gespeicherte Konfigurationen</div>
                      <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:16}}>
                        {sessionSlots.filter(s => s.slot <= 5).map(s => (
                          <button key={s.slot}
                            className={`slot-chip${s.konfiguration ? " belegt" : " leer"}`}
                            onClick={() => s.konfiguration && ladeKonfigAusSlot(s)}>
                            {s.konfiguration ? (s.name || `Slot ${s.slot}`) : `${s.slot} —`}
                          </button>
                        ))}
                        {sessionSlots.find(s => s.slot === 6)?.konfiguration && (
                          <button className="slot-chip zuletzt"
                            onClick={() => ladeKonfigAusSlot(sessionSlots.find(s => s.slot === 6))}>
                            Zuletzt
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {/* ABFRAGE-MODUS */}
                  <div className="sektion-label" style={{marginBottom:8}}>Abfrage-Modus</div>
                  <div className="karte" style={{marginBottom:16}}>
                    <div className="toggle-row">
                      <div className="toggle-btn">
                        <button className={`toggle-opt${quizModus==="sequenziell"?" aktiv":""}`} onClick={() => setQuizModus("sequenziell")}>Sequenziell</button>
                        <button className={`toggle-opt${quizModus==="rotierend"?" aktiv":""}`} onClick={() => setQuizModus("rotierend")}>Rotierend</button>
                        <button className={`toggle-opt${quizModus==="diktat"?" aktiv":""}`} onClick={() => setQuizModus("diktat")}>Diktat</button>
                      </div>
                      <button className="btn-toggle-ghost" onClick={() => setQuizModusInfoAufgeklappt(v => !v)}>
                        {quizModusInfoAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                      </button>
                    </div>
                    {quizModusInfoAufgeklappt && (
                      <div style={{padding:"0 16px 14px", fontSize:"0.82rem", color:"#6b6560"}}>
                        {quizModus === "sequenziell"
                          ? "Feste Frage-Spalte, Antwort-Spalten der Reihe nach. Modus pro Spalte wählbar."
                          : quizModus === "rotierend"
                          ? "Frage-Spalte wechselt mit jeder Vokabel. Modus pro Spalte wählbar."
                          : "Wort wird vorgelesen – du tippst was du hörst. Falsch → ein Buchstabe mehr aufgedeckt."}
                      </div>
                    )}
                  </div>

                  {/* DIKTAT-KONFIGURATION */}
                  {quizModus === "diktat" && (
                    <>
                      <div className="sektion-label" style={{marginBottom:8}}>Diktat-Konfiguration</div>
                      <div className="karte" style={{marginBottom:16}}>
                        <div style={{padding:"12px 16px", borderBottom:"1px solid #e0dbd2"}}>
                          <div className="inp-label">Diktat-Spalte (wird vorgelesen)</div>
                          <div style={{display:"flex", gap:6, marginTop:8, flexWrap:"wrap"}}>
                            {abfragbar.map(typ => (
                              <button key={typ} className={`typ-btn${quizDiktatSpalte===typ?" aktiv":""}`}
                                onClick={() => setQuizDiktatSpalte(typ)}>
                                {kombiListe.spalten[typ].name || typ}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{padding:"12px 16px"}}>
                          <div className="inp-label">Übersetzungs-Spalte (als Hinweis, optional)</div>
                          <div style={{display:"flex", gap:6, marginTop:8, flexWrap:"wrap"}}>
                            <button className={`typ-btn${quizDiktatUebersetzung===""?" aktiv":""}`}
                              onClick={() => setQuizDiktatUebersetzung("")}>Keine</button>
                            {abfragbar.filter(t => t !== quizDiktatSpalte).map(typ => (
                              <button key={typ} className="typ-btn"
                                style={quizDiktatUebersetzung===typ ? {background:"#f9a825",color:"#fff",borderColor:"#f9a825"} : undefined}
                                onClick={() => setQuizDiktatUebersetzung(typ)}>
                                {kombiListe.spalten[typ].name || typ}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* SPALTEN */}
                  {quizModus !== "diktat" && (<>
                    <div className="sektion-label" style={{marginBottom:8}}>Spalten auswählen</div>
                    <div className="karte" style={{marginBottom:16}}>
                      {abfragbar.map(typ => {
                        const checked = quizAusgewaehlt.includes(typ);
                        const isFrage = quizFrageTyp === typ;
                        const antwortNr = quizAntwortTypenGeordnet.indexOf(typ);
                        const isAntwort = antwortNr >= 0;
                        const isInfo = quizInfoTypenSession.includes(typ);
                        const hatFrage = quizFrageTyp !== "";
                        const anzGesamt = quizAusgewaehlt.length;
                        return (
                          <div key={typ} style={{padding:"10px 16px", borderBottom:"1px solid #e0dbd2"}}>
                            <div style={{display:"flex", alignItems:"center", gap:10, cursor:"pointer"}}
                              onClick={() => toggleQuizSpalte(typ)}>
                              <div className={`checkbox${checked?" checked":""}`}>{checked?"✓":""}</div>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:600, fontSize:"0.9rem"}}>{kombiListe.spalten[typ].name||typ}</div>
                                <div style={{fontSize:"0.75rem", color:"#6b6560"}}>{typ}</div>
                              </div>
                            </div>
                            {checked && quizModus === "sequenziell" && (
                              <div style={{display:"flex", gap:5, marginTop:8, marginLeft:30, flexWrap:"wrap", alignItems:"center"}}>
                                {(!hatFrage || isFrage) && (
                                  <button className={`spalten-rolle-btn${isFrage?" frage":""}`}
                                    onClick={() => toggleSpalteRolle(typ,"frage")}>Frage</button>
                                )}
                                {!isFrage && !isInfo && (
                                  <button className={`spalten-rolle-btn${isAntwort?" antwort":""}`}
                                    onClick={() => toggleSpalteRolle(typ,"antwort")}>
                                    {isAntwort ? `Antwort ${antwortNr+1}` : "Antwort"}
                                  </button>
                                )}
                                {!isFrage && !isAntwort && anzGesamt >= 3 && (
                                  <button className={`spalten-rolle-btn${isInfo?" info":""}`}
                                    onClick={() => toggleSpalteRolle(typ,"info")}>Info</button>
                                )}
                                {isAntwort && (
                                  <div style={{display:"flex", gap:4, marginLeft:4}}>
                                    <button className={`spalten-modus-btn${(quizSpalteModus[typ]||"tippen")==="tippen"?" aktiv":""}`}
                                      onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"tippen"}))}>Tastatur</button>
                                    <button className={`spalten-modus-btn${quizSpalteModus[typ]==="mc"?" aktiv":""}`}
                                      onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"mc"}))}>MC</button>
                                    <button className={`spalten-modus-btn${quizSpalteModus[typ]==="karte"?" aktiv":""}`}
                                      onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"karte"}))}>Karte</button>
                                  </div>
                                )}
                              </div>
                            )}
                            {checked && quizModus === "rotierend" && (
                              <div style={{display:"flex", gap:5, marginTop:8, marginLeft:30}}>
                                <button className={`spalten-modus-btn${(quizSpalteModus[typ]||"tippen")==="tippen"?" aktiv":""}`}
                                  onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"tippen"}))}>Tastatur</button>
                                <button className={`spalten-modus-btn${quizSpalteModus[typ]==="mc"?" aktiv":""}`}
                                  onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"mc"}))}>MC</button>
                                <button className={`spalten-modus-btn${quizSpalteModus[typ]==="karte"?" aktiv":""}`}
                                  onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"karte"}))}>Karte</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* INFO-SPALTEN */}
                    {infoSpalten.length > 0 && (
                      <>
                        <div className="sektion-label" style={{marginBottom:8}}>Info-Spalten anzeigen</div>
                        <div className="karte" style={{marginBottom:16}}>
                          {infoSpalten.map(typ => (
                            <div key={typ} className="quiz-setup-check" style={{padding:"10px 16px"}}
                              onClick={() => toggleInfoSpalte(typ)}>
                              <div className={`checkbox${quizZeigeInfo[typ]?" checked":""}`}>{quizZeigeInfo[typ]?"✓":""}</div>
                              <div>
                                <div style={{fontWeight:600, fontSize:"0.9rem"}}>{kombiListe.spalten[typ].name||typ}</div>
                                <div style={{fontSize:"0.75rem", color:"#6b6560"}}>{typ} — immer nur angezeigt</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>)}

                  {/* REIHENFOLGE */}
                  <div className="sektion-label" style={{marginBottom:8}}>Reihenfolge</div>
                  <div className="karte" style={{marginBottom:16}}>
                    <div className="toggle-row">
                      <div className="toggle-btn">
                        <button className={`toggle-opt${quizReihenfolge==="zufall"?" aktiv":""}`} onClick={() => setQuizReihenfolge("zufall")}>Zufällig</button>
                        <button className={`toggle-opt${quizReihenfolge==="schlechteste"?" aktiv":""}`} onClick={() => setQuizReihenfolge("schlechteste")}>Schlechteste</button>
                        <button className={`toggle-opt${quizReihenfolge==="listennr"?" aktiv":""}`} onClick={() => setQuizReihenfolge("listennr")}>Listen-Nr.</button>
                      </div>
                    </div>
                    {quizReihenfolge === "schlechteste" && (
                      <div style={{padding:"0 16px 16px"}}>
                        <label className="inp-label">Anzahl</label>
                        <input className="inp" type="number" min={1} value={quizSchlechtesteAnzahl}
                          onChange={e => setQuizSchlechtesteAnzahl(e.target.value)} />
                        <label className="inp-label" style={{marginTop:12}}>Score kleiner als (optional)</label>
                        <input className="inp" type="number" value={quizSchlechtesteMaxScore}
                          onChange={e => setQuizSchlechtesteMaxScore(e.target.value)}
                          placeholder="z.B. -5" />
                        <div style={{fontSize:"0.78rem", color:"#6b6560", marginTop:6}}>
                          {verfuegbar} Vokabeln mit dem niedrigsten Score werden abgefragt.
                        </div>
                      </div>
                    )}
                    {quizReihenfolge !== "schlechteste" && (
                      <div className="toggle-row" style={{cursor:"pointer", padding:"12px 16px", borderTop:"1px solid #e0dbd2"}}
                        onClick={() => setQuizUnbeantwortetZuerst(v => !v)}>
                        <div>
                          <div className="toggle-label">Unbeantwortete zuerst</div>
                          <div className="toggle-sub">Vokabeln ohne Score werden zuerst abgefragt</div>
                        </div>
                        <div className={`checkbox${quizUnbeantwortetZuerst?" checked":""}`}>{quizUnbeantwortetZuerst?"✓":""}</div>
                      </div>
                    )}
                  </div>

                  {/* LAUTSPRACHE */}
                  <div className="sektion-label" style={{marginBottom:8}}>Lautsprache</div>
                  <div className="karte" style={{marginBottom:16}}>
                    <div className="toggle-row">
                      <div>
                        <div className="toggle-label">Auto-Play</div>
                        <div className="toggle-sub">Frage automatisch vorlesen wenn neue Vokabel erscheint</div>
                      </div>
                      <div className="toggle-btn">
                        <button className={`toggle-opt${!einstellungen.autoplay?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen, autoplay:false})}>Aus</button>
                        <button className={`toggle-opt${einstellungen.autoplay?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen, autoplay:true})}>An</button>
                      </div>
                    </div>
                    {einstellungen.autoplay && (
                      <div style={{padding:"12px 16px 16px", borderTop:"1px solid #e0dbd2"}}>
                        <div className="inp-label" style={{marginBottom:8}}>Spalten automatisch vorlesen</div>
                        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                          {["E1","E2","D1","D2","i1","i2"].map(typ => {
                            const vorlesen = einstellungen.vorlesen || ["E1"];
                            const aktiv = vorlesen.includes(typ);
                            return (
                              <button key={typ} className={`typ-btn${aktiv?" aktiv":""}`}
                                onClick={() => speichereEinst({...einstellungen, vorlesen: aktiv ? vorlesen.filter(t=>t!==typ) : [...vorlesen,typ]})}>
                                {typ}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{fontSize:"0.75rem", color:"#6b6560", marginTop:8}}>
                          Nur wenn Frage-Spalte ausgewählt ist, wird Auto-Play ausgelöst
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SCHWIERIGKEITS-MODUS */}
                  <div className="sektion-label" style={{marginBottom:8}}>Schwierigkeits-Modus</div>
                  <div className="karte" style={{marginBottom:16}}>
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

                  {kannStarten && (
                    <button className="btn btn-ghost" style={{width:"100%", marginBottom:16}}
                      onClick={() => oeffneModal("slot-speichern")}>
                      Konfiguration speichern …
                    </button>
                  )}
                </>)}
              </div>
            </>
          );
        })()}

        {/* ── Listen-Übersicht ── */}
        {tab === "listen" && ansicht === "uebersicht" && (
          <div className="sektion">
            {listenIndex.length === 0 ? (
              <div className="leer"><div className="leer-text">Noch keine Listen vorhanden.<br/>Tippe auf <strong>+</strong> um eine neue Liste anzulegen.</div></div>
            ) : (
              <div className="karte">
                {listenIndex.map(l => {
                  const anzahl = vokabelAnzahl(l.id);
                  const liste = lsGet(SK.liste(l.id));
                  const aktSpalten = liste ? TYPEN.filter(t => liste.spalten[t].aktiv) : [];
                  return (
                    <div key={l.id} className="karte-zeile" style={{cursor:"pointer"}}
                      onClick={() => {
                        if (exportAuswahlModus) {
                          setExportAusgewaehlt(prev => {
                            const neu = new Set(prev);
                            if (neu.has(l.id)) neu.delete(l.id); else neu.add(l.id);
                            return neu;
                          });
                        } else {
                          setAktiveListeId(l.id); setAnsicht("liste-detail"); setVokabelAufgeklappt(false); setAktionszeileAufgeklappt(false);
                        }
                      }}>
                      {exportAuswahlModus && (
                        <div className={`checkbox${exportAusgewaehlt.has(l.id) ? " checked" : ""}`}>
                          {exportAusgewaehlt.has(l.id) && "✓"}
                        </div>
                      )}
                      <div className="karte-zeile-info">
                        <div className="karte-zeile-name">{l.name}</div>
                        <div className="karte-zeile-sub">
                          {anzahl} Vokabel{anzahl !== 1 ? "n" : ""}{" "}
                          {aktSpalten.map(t => <span key={t} className="spalten-badge aktiv">{liste.spalten[t].name || t}</span>)}
                        </div>
                      </div>
                      {!exportAuswahlModus && <span style={{color:"#6b6560"}}>{">"}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Listen-Detail ── */}
        {tab === "listen" && ansicht === "liste-detail" && aktiveListe && (() => {
          const aktiveSpalten = TYPEN.filter(t => aktiveListe.spalten[t].aktiv);
          const abfragbareSpalten = aktiveSpalten.filter(t => !t.startsWith('i'));
          return (
            <>
            {/* Aktionszeile */}
            {aktionszeileAufgeklappt && (
              <div style={{background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"8px 16px", display:"flex", gap:6, flexWrap:"wrap"}}>
                <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px"}} onClick={() => { resetImport(); setImportZielTyp("bestehend"); setImportBestehendId(aktiveListeId); setAnsicht("import"); }}><IcoPlus/></button>
                <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px"}} onClick={kopiereListeHandler}>{exportKopiert ? "✓" : <IcoCopy/>}</button>
                <button className="btn btn-ghost btn-sm" onClick={teileListeAlsDateiHandler}>TXT</button>
                <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px"}} onClick={teileListeAlsJsonHandler}><IcoShare/></button>
                <button className="btn btn-ghost btn-sm" onClick={() => exportiereAlsJson([aktiveListeId])}>JSON</button>
                <button className="btn btn-danger btn-sm" style={{padding:"6px 10px", marginLeft:"auto"}} onClick={() => oeffneModal("loeschen")}><IcoX/></button>
              </div>
            )}
            <div className="sektion">

              {abfragbareSpalten.length >= 2 && aktiveListe.vokabeln.length > 0 && (
                <button className="btn btn-primary" style={{width:"100%", marginBottom:8}}
                  onClick={() => {
                    setQuizTabListen([aktiveListeId]);
                    initQuizDefaults(lsGet(SK.liste(aktiveListeId)));
                    setTab("quiz");
                  }}>
                  Quiz starten
                </button>
              )}
              {aktiveListe.vokabeln.length > 0 && (
                <button className="btn btn-ghost" style={{width:"100%", marginBottom:8}}
                  onClick={() => {
                    setStatistikListenIds(new Set([aktiveListeId]));
                    setStatistikListenAufgeklappt(false);
                    setTab("statistik");
                  }}>
                  Statistik
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
                        <div className="karte-zeile-name" style={{color: s.aktiv ? "#1a1a1a" : "#6b6560"}}>
                          {s.aktiv ? (s.name || `Spalte ${typ}`) : "nicht belegt"}
                        </div>
                        {s.aktiv && <div className="karte-zeile-sub">{typ.startsWith("i") ? "Info (nicht abfragbar)" : "Abfragbar"}</div>}
                      </div>
                      {s.aktiv && (
                        <button className="btn btn-ghost-filled btn-sm" style={{padding:"6px 10px"}} onClick={() => oeffneModal("spalte-umbenennen", typ)}><IcoPencil s={14}/></button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vokabeln – ein-/ausklappbar */}
              <div className="sektion-header" style={{marginTop:8}}>
                <div style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer"}}
                  onClick={() => setVokabelAufgeklappt(v => !v)}>
                  <div className="sektion-label">Vokabeln ({aktiveListe.vokabeln.length})</div>
                  <button className="btn-toggle" style={{padding:"3px 6px"}} onClick={e => { e.stopPropagation(); setVokabelAufgeklappt(v => !v); }}>
                    {vokabelAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                  </button>
                </div>
                <div style={{display:"flex", gap:6}}>
                  {listenIndex.filter(l => l.id !== aktiveListeId).length > 0 && (
                    <button className="btn btn-ghost btn-sm" style={{background:"#fff"}}
                      onClick={() => { setMergeQuelleId(''); setModal('liste-zusammenfuehren'); }}>
                      Zusammenführen
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px", background:"#fff"}} onClick={() => {
                    resetImport(); setImportZielTyp("bestehend"); setImportBestehendId(aktiveListeId); setAnsicht("import");
                  }}><IcoPlus s={13}/></button>
                </div>
              </div>

              {vokabelAufgeklappt && (
                aktiveListe.vokabeln.length === 0 ? (
                  <div className="leer"><div className="leer-text">Noch keine Vokabeln.<br/>Klicke auf + um zu importieren.</div></div>
                ) : (
                  <div className="karte">
                    {aktiveListe.vokabeln.map(vok => {
                      const score = vok.fortschritt?.score ?? null;
                      return (
                        <div key={vok.id} className="karte-zeile" style={{flexDirection:"column", alignItems:"flex-start", gap:4}}>
                          <div style={{display:"flex", width:"100%", justifyContent:"space-between", alignItems:"flex-start"}}>
                            <div style={{display:"flex", flexDirection:"column", gap:3, flex:1}}>
                              {aktiveSpalten.map(typ => vok[typ] ? (
                                <div key={typ} style={{display:"flex", alignItems:"baseline", gap:6}}>
                                  <span className="spalten-badge aktiv">{aktiveListe.spalten[typ].name || typ}</span>
                                  <span style={{fontSize:"0.88rem"}}>{vok[typ].wert}</span>
                                  {vok[typ].falsch?.length > 0 && <span style={{fontSize:"0.75rem", color:"#6b6560"}}>(+{vok[typ].falsch.length})</span>}
                                </div>
                              ) : null)}
                            </div>
                            <div style={{display:"flex", alignItems:"center", gap:2, flexShrink:0, marginLeft:8}}>
                              {score !== null && (
                                <span className={`score-badge ${score > 0 ? "score-pos" : score < 0 ? "score-neg" : "score-null"}`} style={{marginRight:4}}>
                                  {score > 0 ? "+" : ""}{score}
                                </span>
                              )}
                              {aktiveSpalten.some(typ => typ.startsWith('E') && vok[typ]?.wert) && (
                                <button className="btn-icon" title="Vorlesen" onClick={() => {
                                  if (!window.speechSynthesis) return;
                                  window.speechSynthesis.cancel();
                                  aktiveSpalten.filter(typ => typ.startsWith('E')).forEach(typ => {
                                    if (!vok[typ]?.wert) return;
                                    const u = new SpeechSynthesisUtterance(vok[typ].wert.split('/')[0].trim());
                                    u.lang = spalteLang(typ);
                                    window.speechSynthesis.speak(u);
                                  });
                                }}><IcoSpk s={16}/></button>
                              )}
                              <button className="btn-icon" title="Bearbeiten" onClick={() => oeffneVokabelBearbeiten(vok)}><IcoPencil s={14}/></button>
                              <button className="btn-icon" title="Löschen" style={{color:"#c0392b"}}
                                onClick={() => { setBearbeiteVokabel(vok); setModal('vokabel-loeschen'); }}>✕</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
            </>
          );
        })()}
        {/* ── Statistik: Sticky Listen-Header ── */}
        {tab === "statistik" && (() => {
          const isGewaehlt = (id) => statistikListenIds === null || statistikListenIds.has(id);
          const statistikListen = listenIndex.map(l => lsGet(SK.liste(l.id))).filter(Boolean);
          const gewaehlteListenObjekte = statistikListenIds === null
            ? statistikListen
            : statistikListen.filter(l => statistikListenIds.has(l.id));
          const gewaehlteAnzahl = gewaehlteListenObjekte.length;
          const gesamtVoks = gewaehlteListenObjekte.reduce((s, l) => s + l.vokabeln.length, 0);
          const keineGewaehlt = statistikListenIds !== null && statistikListenIds.size === 0;
          return (<>
            <div ref={statistikListenHeaderRef} className="statistik-listen-header" style={{top: headerH}}>
              <div style={{flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:600, fontSize:"0.82rem"}}>
                {keineGewaehlt
                  ? <span style={{color:"#aaa", fontWeight:600}}>Listen auswählen</span>
                  : statistikListenIds === null
                    ? `Alle Listen · ${gesamtVoks} Vokabeln`
                    : `${gewaehlteAnzahl} ${gewaehlteAnzahl===1?"Liste":"Listen"} · ${gesamtVoks} Vokabeln`
                }
              </div>
              <div style={{display:"flex", gap:5, flexShrink:0}}>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setStatistikListenIds(new Set())}>Zurücksetzen</button>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setStatistikListenIds(null)}>Alle</button>
                <button className="btn-toggle"
                  onClick={() => setStatistikListenAufgeklappt(v => !v)}>
                  {statistikListenAufgeklappt ? <IcoDown/> : <IcoUp/>}
                </button>
              </div>
            </div>
            {/* Listenliste (ausgeklappt) */}
            {statistikListenAufgeklappt && (
              <div style={{background:"#f7f5f0", borderBottom:"1px solid #e0dbd2", padding:"8px 16px"}}>
                <div className="karte" style={{marginBottom:0}}>
                  {listenIndex.length === 0
                    ? <div className="karte-zeile" style={{color:"#6b6560", fontSize:"0.85rem"}}>Keine Listen vorhanden.</div>
                    : listenIndex.map(l => {
                        const ll = statistikListen.find(x => x.id === l.id);
                        const anzahl = ll ? ll.vokabeln.length : 0;
                        const gewaehlt = isGewaehlt(l.id);
                        return (
                          <div key={l.id} className="quiz-setup-check" style={{padding:"10px 16px"}}
                            onClick={() => toggleStatistikListe(l.id)}>
                            <div className={`checkbox${gewaehlt?" checked":""}`}>{gewaehlt?"✓":""}</div>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:600, fontSize:"0.9rem"}}>{l.name}</div>
                              <div style={{fontSize:"0.78rem", color:"#6b6560", marginTop:2}}>{anzahl} Vokabel{anzahl!==1?"n":""}</div>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            )}
          </>);
        })()}

        {/* ── Statistik: Inhalte ── */}
        {tab === "statistik" && (() => {
          const statistikListen = listenIndex.map(l => lsGet(SK.liste(l.id))).filter(Boolean);
          const gewaehlteListenObjekte = statistikListenIds === null
            ? statistikListen
            : statistikListen.filter(l => statistikListenIds.has(l.id));

          const alleVoks = gewaehlteListenObjekte.flatMap(l =>
            l.vokabeln.map(v => ({...v, _listeName: l.name, _spalten: l.spalten}))
          );

          if (alleVoks.length === 0) return (
            <div className="sektion">
              <div className="leer"><div className="leer-text">
                {(statistikListenIds !== null && statistikListenIds.size === 0)
                  ? "Keine Liste ausgewählt."
                  : "Keine Vokabeln vorhanden."}
              </div></div>
            </div>
          );

          const abgefragt = alleVoks.filter(v => v.fortschritt);
          const nieAnzahl = alleVoks.length - abgefragt.length;
          const positivAnzahl = abgefragt.filter(v => v.fortschritt.score > 0).length;
          const negativAnzahl = abgefragt.filter(v => v.fortschritt.score < 0).length;
          const nullAnzahl = abgefragt.filter(v => v.fortschritt.score === 0).length;
          const avgScore = abgefragt.length > 0
            ? abgefragt.reduce((s, v) => s + v.fortschritt.score, 0) / abgefragt.length
            : null;

          // Graph-Daten
          const quizGraphVoks = statistikGraphOhneUnbeantwortet
            ? alleVoks.filter(v => v.fortschritt)
            : alleVoks;
          const diktatGraphVoks = statistikGraphOhneUnbeantwortet
            ? alleVoks.filter(v => v.diktatFortschritt)
            : alleVoks;
          const quizS = quizGraphVoks.map(v => v.fortschritt?.score ?? 0).sort((a, b) => a - b);
          const diktatS = diktatGraphVoks.map(v => v.diktatFortschritt?.score ?? 0).sort((a, b) => a - b);
          const allScores = [...quizS, ...diktatS];
          const minS = allScores.length > 0 ? Math.min(...allScores, -1) : -1;
          const maxS = allScores.length > 0 ? Math.max(...allScores, 1) : 1;
          const range = maxS - minS;
          const GW = 400, GH = 120, pX = 4, pY = 10;
          const gW = GW - 2 * pX, gH = GH - 2 * pY;
          const zeroY = pY + (maxS / range) * gH;
          function toPath(scores) {
            if (scores.length === 0) return '';
            const m = scores.length;
            return scores.map((s, i) => {
              const x = pX + (m > 1 ? i / (m - 1) : 0.5) * gW;
              const y = pY + ((maxS - s) / range) * gH;
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
          }

          // Vokabelliste (gefiltert + sortiert)
          let voks = [...alleVoks];
          if (statistikFilter === "nie") voks = voks.filter(v => !v.fortschritt);
          else if (statistikFilter === "negativ") voks = voks.filter(v => (v.fortschritt?.score ?? 0) < 0);
          else if (statistikFilter === "positiv") voks = voks.filter(v => (v.fortschritt?.score ?? 0) > 0);
          else if (statistikFilter === "null") voks = voks.filter(v => v.fortschritt && v.fortschritt.score === 0);
          const [sKey, sDir] = statistikSort.split("-");
          if (sKey === "score") voks.sort((a, b) => { const d = (a.fortschritt?.score ?? 0) - (b.fortschritt?.score ?? 0); return sDir === "asc" ? d : -d; });
          else if (sKey === "streak") voks.sort((a, b) => { const d = (a.fortschritt?.streak ?? 0) - (b.fortschritt?.streak ?? 0); return sDir === "asc" ? d : -d; });
          else if (sKey === "datum") voks.sort((a, b) => { const da = a.fortschritt?.letzteAbfrage ? new Date(a.fortschritt.letzteAbfrage) : new Date(0); const db = b.fortschritt?.letzteAbfrage ? new Date(b.fortschritt.letzteAbfrage) : new Date(0); return sDir === "asc" ? da - db : db - da; });
          else if (sKey === "alpha") { voks.sort((a, b) => { const spa = TYPEN.find(t => a._spalten[t]?.aktiv); const spb = TYPEN.find(t => b._spalten[t]?.aktiv); const r = (a[spa]?.wert || '').localeCompare(b[spb]?.wert || ''); return sDir === "asc" ? r : -r; }); }
          const mehrereListenGewaehlt = gewaehlteListenObjekte.length > 1;

          return (
            <div className="sektion">
              {/* Graph */}
              <div style={{marginBottom:16, borderRadius:12, overflow:"hidden", border:"1px solid #e0dbd2"}}>
                <svg viewBox={`0 0 ${GW} ${GH}`} preserveAspectRatio="none"
                  style={{width:"100%", height:130, display:"block"}}>
                  <rect width={GW} height={GH} fill="#fafaf8"/>
                  {zeroY > pY && (
                    <rect x={pX} y={pY} width={gW} height={Math.max(0, zeroY - pY)} fill="#e8f5e9" opacity="0.6"/>
                  )}
                  {zeroY < GH - pY && (
                    <rect x={pX} y={zeroY} width={gW} height={Math.max(0, GH - pY - zeroY)} fill="#ffebee" opacity="0.6"/>
                  )}
                  <line x1={pX} y1={zeroY} x2={GW - pX} y2={zeroY} stroke="#ccc" strokeWidth="1"/>
                  <path d={toPath(quizS)} fill="none" stroke="#2d6a4f" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
                  <path d={toPath(diktatS)} fill="none" stroke="#e67e22" strokeWidth="2.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/>
                </svg>
                <div style={{display:"flex", alignItems:"center", gap:12, padding:"6px 14px", background:"#f7f5f0", borderTop:"1px solid #e0dbd2", fontSize:"0.72rem", fontWeight:600, color:"#6b6560", flexWrap:"wrap"}}>
                  <span style={{display:"flex", alignItems:"center", gap:6}}>
                    <svg width="20" height="4" viewBox="0 0 20 4" style={{flexShrink:0}}>
                      <line x1="0" y1="2" x2="20" y2="2" stroke="#2d6a4f" strokeWidth="2.5"/>
                    </svg>
                    Abfrage-Score
                  </span>
                  <span style={{display:"flex", alignItems:"center", gap:6}}>
                    <svg width="20" height="4" viewBox="0 0 20 4" style={{flexShrink:0}}>
                      <line x1="0" y1="2" x2="20" y2="2" stroke="#e67e22" strokeWidth="2.5" strokeDasharray="5 3"/>
                    </svg>
                    Diktat-Score
                  </span>
                  <span style={{marginLeft:"auto"}}>
                    <button
                      className={`typ-btn${statistikGraphOhneUnbeantwortet ? " aktiv" : ""}`}
                      style={{fontSize:"0.68rem", padding:"3px 8px"}}
                      onClick={() => setStatistikGraphOhneUnbeantwortet(v => !v)}>
                      {statistikGraphOhneUnbeantwortet ? "Nur beantwortete" : "Inkl. unbeantwortete"}
                    </button>
                  </span>
                </div>
              </div>

              {/* 4 Kennzahlen-Boxen */}
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12}}>
                {[
                  {label:"Gesamt", wert:alleVoks.length, farbe:null},
                  {label:"Nie abgefragt", wert:nieAnzahl, farbe:nieAnzahl>0?"#6b6560":"#2d6a4f"},
                  {label:"Score positiv", wert:positivAnzahl, bg:"#e8f5e9", rand:"#c8e6c9", farbe:"#2d6a4f"},
                  {label:"Score negativ", wert:negativAnzahl, bg:"#ffebee", rand:"#ffcdd2", farbe:"#c0392b"},
                ].map(k => (
                  <div key={k.label} style={{background:k.bg||"#fff", border:`1px solid ${k.rand||"#e0dbd2"}`, borderRadius:10, padding:"12px 14px"}}>
                    <div style={{fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".07em", color:k.farbe||"#6b6560"}}>{k.label}</div>
                    <div style={{fontSize:"1.6rem", fontWeight:700, marginTop:4, color:k.farbe||"#1a1a1a"}}>{k.wert}</div>
                  </div>
                ))}
              </div>
              {avgScore !== null && (
                <div style={{position:"sticky", top:headerH + statistikListenHeaderH, zIndex:8, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"10px 16px", marginLeft:"-16px", marginRight:"-16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <span style={{fontSize:"0.82rem", color:"#6b6560", fontWeight:600}}>Ø Score (abgefragte Vokabeln)</span>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <span style={{fontWeight:700, color: avgScore > 0 ? "#2d6a4f" : avgScore < 0 ? "#c0392b" : "#6b6560"}}>
                      {avgScore > 0 ? "+" : ""}{avgScore.toFixed(1)}
                    </span>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => window.scrollTo({top:0, behavior:"smooth"})}>
                      ↑ Nach oben
                    </button>
                  </div>
                </div>
              )}

              {/* Filter */}
              <div className="sektion-label" style={{marginBottom:8}}>Filter</div>
              <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:12}}>
                {[
                  {key:"alle", label:`Alle (${alleVoks.length})`},
                  {key:"nie", label:`Nie (${nieAnzahl})`},
                  {key:"negativ", label:`Neg (${negativAnzahl})`},
                  {key:"null", label:`Null (${nullAnzahl})`},
                  {key:"positiv", label:`Pos (${positivAnzahl})`},
                ].map(f => (
                  <button key={f.key} className={`typ-btn${statistikFilter===f.key?" aktiv":""}`}
                    onClick={() => setStatistikFilter(f.key)}>{f.label}</button>
                ))}
              </div>

              {/* Sortierung */}
              <div className="sektion-label" style={{marginBottom:8}}>Sortierung</div>
              <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:16}}>
                {[
                  {key:"score", label:"Score", def:"asc"},
                  {key:"streak", label:"Streak", def:"desc"},
                  {key:"datum", label:"Datum", def:"desc"},
                  {key:"alpha", label:"A→Z", def:"asc"},
                ].map(s => {
                  const [aKey, aDir] = statistikSort.split("-");
                  const isActive = aKey === s.key;
                  return (
                    <button key={s.key} className={`typ-btn${isActive?" aktiv":""}`}
                      onClick={() => isActive
                        ? setStatistikSort(`${s.key}-${aDir === "asc" ? "desc" : "asc"}`)
                        : setStatistikSort(`${s.key}-${s.def}`)}>
                      {s.label}{isActive ? (aDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  );
                })}
              </div>

              {/* Vokabelliste */}
              <div className="sektion-label" style={{marginBottom:8}}>{voks.length} Vokabel{voks.length!==1?"n":""}</div>
              <div className="karte">
                {voks.length === 0 ? (
                  <div className="karte-zeile" style={{color:"#6b6560", fontSize:"0.85rem"}}>Keine Vokabeln in diesem Filter.</div>
                ) : voks.map((vok, idx) => {
                  const score = vok.fortschritt?.score ?? null;
                  const streak = vok.fortschritt?.streak ?? 0;
                  const sp1 = TYPEN.find(t => vok._spalten[t]?.aktiv);
                  const sp2 = TYPEN.filter(t => vok._spalten[t]?.aktiv)[1];
                  return (
                    <div key={`${vok._listeName}_${vok.id}_${idx}`} className="karte-zeile">
                      <div style={{flex:1, minWidth:0}}>
                        {sp1 && vok[sp1] && <div style={{fontWeight:600, fontSize:"0.9rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{vok[sp1].wert}</div>}
                        {sp2 && vok[sp2] && <div style={{fontSize:"0.78rem", color:"#6b6560", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{vok[sp2].wert}</div>}
                        {mehrereListenGewaehlt && <div style={{fontSize:"0.68rem", color:"#aaa", marginTop:2}}>{vok._listeName}</div>}
                      </div>
                      <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3, flexShrink:0}}>
                        <span className={`score-badge ${score !== null ? (score > 0 ? "score-pos" : score < 0 ? "score-neg" : "score-null") : "score-null"}`}>
                          {score !== null ? (score > 0 ? "+" : "") + score : "–"}
                        </span>
                        <div style={{fontSize:"0.68rem", color:"#6b6560", textAlign:"right"}}>
                          {streak > 0 && <span style={{marginRight:4}}>🔥{streak}</span>}
                          {formatDatum(vok.fortschritt?.letzteAbfrage)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {tab === "einstellungen" && (
          <div className="sektion">
            <div className="sektion-label" style={{marginBottom:10}}>App</div>
            <div className="karte">
              <div className="karte-zeile">
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name">App aktualisieren</div>
                  <div className="karte-zeile-sub">Version {APP_VERSION} · Neueste Version laden</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const url = window.location.href.split('?')[0] + '?t=' + Date.now();
                  window.location.replace(url);
                }}>Neu laden</button>
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
        {tab === "listen" && ansicht === "uebersicht" && exportAuswahlModus && exportAusgewaehlt.size > 0 && (
          <div className="quiz-action-bar">
            {navigator.share && (
              <button className="btn btn-primary" onClick={exportiereAusgewaehlteTeilenHandler}>📤 Teilen</button>
            )}
            <button className="btn btn-ghost" onClick={exportiereAusgewaehlteKopierenHandler}>
              {exportKopiert ? "✓ Kopiert!" : "📋 Kopieren"}
            </button>
            <button className="btn btn-ghost" onClick={exportiereAusgewaehlteAlsDateiHandler}>📄 Datei</button>
            <button className="btn btn-ghost" onClick={() => exportiereAlsJson([...exportAusgewaehlt])}>💾 JSON</button>
          </div>
        )}
      </div>

      {/* ── Modals (global) ── */}
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
      {modal === "umbenennen" && aktiveListe && (
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
      {modal === "spalte-umbenennen" && aktiveListe && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Spalte umbenennen</div>
            <div style={{fontSize:"0.82rem", color:"#6b6560", marginBottom:12}}>Typ: {editSpalteTyp}</div>
            <label className="inp-label">Name</label>
            <input className="inp" value={modalInput} autoFocus
              onChange={e => setModalInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && speichereSpaltenname()} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={speichereSpaltenname}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {modal === "vokabel-bearbeiten" && bearbeiteVokabel && aktiveListe && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Vokabel bearbeiten</div>
            {TYPEN.filter(t => aktiveListe.spalten[t].aktiv).map(typ => (
              <div key={typ} style={{marginBottom:12}}>
                <label className="inp-label">
                  {aktiveListe.spalten[typ].name || typ}
                  {!typ.startsWith('i') && <span style={{fontWeight:400}}> (|| falsche Antworten)</span>}
                </label>
                <input className="inp" value={bearbeiteEingaben[typ] || ''}
                  onChange={e => setBearbeiteEingaben(prev => ({...prev, [typ]: e.target.value}))}
                  onKeyDown={e => e.key === 'Enter' && speichereVokabelBearbeitung()}
                />
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setModal(null); setBearbeiteVokabel(null); }}>Abbrechen</button>
              <button className="btn btn-primary" onClick={speichereVokabelBearbeitung}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {modal === "vokabel-loeschen" && bearbeiteVokabel && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Vokabel löschen?</div>
            <p style={{fontSize:"0.9rem", color:"#6b6560", lineHeight:1.5}}>
              Diese Vokabel wird dauerhaft gelöscht. Der Lernfortschritt geht dabei verloren.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="btn btn-danger" onClick={() => loescheVokabel(bearbeiteVokabel.id)}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "liste-zusammenfuehren" && aktiveListe && (() => {
        const andereListn = listenIndex.filter(l => l.id !== aktiveListeId);
        const mergeQuelle = mergeQuelleId ? lsGet(SK.liste(mergeQuelleId)) : null;
        const neueSpalten = mergeQuelle ? TYPEN.filter(t => !aktiveListe.spalten[t].aktiv && mergeQuelle.spalten[t].aktiv) : [];
        return (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-titel">Liste zusammenführen</div>
              <label className="inp-label">Quelle (wird in „{aktiveListe.name}" eingefügt)</label>
              <select className="inp" value={mergeQuelleId} onChange={e => setMergeQuelleId(e.target.value)}>
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
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
                <button className="btn btn-primary" onClick={fuehreListenZusammen} disabled={!mergeQuelleId}>Zusammenführen</button>
              </div>
            </div>
          </div>
        );
      })()}
      {modal === "slot-speichern" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Konfiguration speichern</div>
            <label className="inp-label">Name</label>
            <input className="inp" value={modalInput} autoFocus
              onChange={e => setModalInput(e.target.value)}
              placeholder="z.B. Irregular Verbs" />
            <div style={{marginTop:14}}>
              <div className="inp-label">Slot wählen</div>
              <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:8}}>
                {[1,2,3,4,5].map(n => {
                  const s = sessionSlots.find(sl => sl.slot === n);
                  return (
                    <button key={n}
                      className={`slot-chip${s?.konfiguration ? " belegt" : ""}`}
                      onClick={() => { speichereKonfigInSlot(n, modalInput.trim() || `Slot ${n}`); setModal(null); setModalInput(""); }}>
                      {s?.konfiguration ? (s.name || `Slot ${n}`) : `Slot ${n}`}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setModal(null); setModalInput(""); }}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "loeschen" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Liste löschen?</div>
            <p style={{fontSize:"0.9rem", color:"#6b6560", lineHeight:1.5}}>
              Diese Liste wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="btn btn-danger" onClick={loeschen}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "json-export" && jsonExportIds && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">JSON exportieren</div>
            <p style={{fontSize:"0.85rem", color:"#6b6560", marginBottom:14}}>
              {jsonExportIds.length === 1 ? "1 Liste" : `${jsonExportIds.length} Listen`} — was soll enthalten sein?
            </p>
            {[
              { key: "vokabeln", label: "Vokabeln", pflicht: true },
              { key: "falsch",   label: "Falsche Antworten (MC)" },
              { key: "fortschritt", label: "Quiz-Fortschritt (Score, Streak)" },
              { key: "diktatFortschritt", label: "Diktat-Fortschritt" },
            ].map(({ key, label, pflicht }) => (
              <label key={key} style={{display:"flex", alignItems:"center", gap:10, marginBottom:10, fontSize:"0.9rem", cursor: pflicht ? "default" : "pointer"}}>
                <input type="checkbox" checked={pflicht || !!jsonExportOptionen[key]}
                  disabled={pflicht}
                  onChange={e => !pflicht && setJsonExportOptionen(prev => ({...prev, [key]: e.target.checked}))}
                  style={{width:18, height:18}} />
                {label}{pflicht && <span style={{fontSize:"0.75rem", color:"#aaa"}}> (immer)</span>}
              </label>
            ))}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setModal(null); setJsonExportIds(null); }}>Abbrechen</button>
              <button className="btn btn-primary" onClick={exportiereAlsJsonBestaetigt}>Exportieren</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
