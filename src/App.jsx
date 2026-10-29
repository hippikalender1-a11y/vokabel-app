import { useState, useEffect, useRef, Fragment } from "react";
import { zeigeInfo, schliesseInfo, schalteInfoModus } from "./infoEreignisse.js";

// ── Storage ────────────────────────────────────────────────────────────────
const SK = {
  einstellungen: "vokabel_einstellungen",
  listenIndex:   "vokabel_listen_index",
  sessionSlots:  "vokabel_session_slots",  // legacy, nur für Migration
  sessionAktiv:  "vokabel_session_aktiv",
  slots:         "vokabel_slots",
  letzterSlot:   "vokabel_letzter_slot",   // zuletzt gewählte gespeicherte Konfiguration → beim Start wieder laden
  ansichtSpalten: "vokabel_ansicht_spalten_an", // Listenansicht: angezeigte Spalten je Liste {listeId: ["E1", …]}; ohne Eintrag nur die erste
  statistikListeZu: "vokabel_statistik_liste_zu", // Statistik: Vokabelliste eingeklappt
  liste: (id)  => `vokabel_liste_${id}`,
};
function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    const daten = JSON.parse(v);
    return key.startsWith("vokabel_liste_") ? ergaenzeSpalten(daten) : daten;
  }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function lsDel(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ── Quiz-Feedback ───────────────────────────────────────────────────────────
// Session-Durchlauf geschafft: große Überschrift (zufällig, bleibt für denselben Durchlauf gleich)
const JUBEL = ["Geschafft!", "Super gemacht!", "Session gemeistert!", "Stark!", "Ziel erreicht!", "Bravo!", "Klasse!", "Alles durch!"];
const jubelGemerkt = { key: null, text: "" };
function jubelText(key) {
  if (jubelGemerkt.key !== key) { jubelGemerkt.key = key; jubelGemerkt.text = JUBEL[Math.floor(Math.random() * JUBEL.length)]; }
  return jubelGemerkt.text;
}

function getQuizFeedback(richtig, gesamt) {
  if (gesamt === 0) return "";
  const pct = richtig / gesamt;
  const t = pct >= 0.9 ? [
    "Hervorragend! Du hast das wirklich drauf.",
    "Ausgezeichnet – fast fehlerfrei!",
    "Brilliant! So macht Lernen Spaß.",
    "Beeindruckend. Weiter so!",
    "Wow – kaum Fehler. Du bist gut!",
  ] : pct >= 0.7 ? [
    "Gut gemacht! Ein solides Ergebnis.",
    "Sehr schön – die meisten Vokabeln sitzen.",
    "Gut! Noch ein bisschen Feinschliff.",
    "Starke Leistung! Die Lücken werden kleiner.",
    "Das war gut. Beim nächsten Mal noch besser.",
  ] : pct >= 0.5 ? [
    "Nicht schlecht! Du lernst Schritt für Schritt.",
    "Okay – noch etwas Übung, dann sitzen die Vokabeln.",
    "Guter Ansatz. Regelmäßiges Wiederholen hilft.",
    "Solide – noch ein paar Runden, dann klappt das.",
    "Du bist auf dem richtigen Weg.",
  ] : pct >= 0.3 ? [
    "Noch nicht ganz drin – aber das ist normal am Anfang.",
    "Nicht aufgeben! Wiederholen ist der Schlüssel.",
    "Manches braucht Zeit. Morgen schon besser.",
    "Die kniffligen Vokabeln – bleib dran!",
    "Kein Meister fällt vom Himmel. Nächster Anlauf!",
  ] : [
    "Da ist noch Luft nach oben – aber du hast angefangen!",
    "Das war ein harter Brocken. Öfter üben hilft wirklich.",
    "Die Vokabeln kennen dich noch nicht. Noch nicht.",
    "Heute schwer – morgen leichter. Wirklich.",
    "Ausbaufähig – aber immerhin gemacht!",
  ];
  return t[(richtig * 7 + gesamt) % t.length];
}

// ── Defaults ───────────────────────────────────────────────────────────────
function defaultEinstellungen() { return { modus: "schwer", autoplay: false, vorlesen: ["E1"], gelerntSchwelle: 3, sprache: "alle" }; }
function defaultSessionSlots() {
  return [{ slot: 6, name: "Zuletzt verwendet", konfiguration: null, fortschritt: null }];
}
function defaultSlots() { return { verlauf: [], gespeichert: [] }; }
function neuerSlotId(typ) { return `${typ}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
// ── Raster der gespeicherten Konfigurationen und der Listen: jeder Eintrag hat einen Platz {z, s} ──
const RASTER_MAX_SPALTEN = 4, RASTER_MAX_ZEILEN = 100;
function rasterGroesse(einst, schluessel = "slotRaster") {
  const r = einst?.[schluessel] || {};
  const spalten = r.spalten ?? (schluessel === "listenRaster" ? 1 : 2);
  return { zeilen: Math.min(RASTER_MAX_ZEILEN, Math.max(1, r.zeilen ?? 10)), spalten: Math.min(RASTER_MAX_SPALTEN, Math.max(1, spalten)) };
}
const nachPlatz = (a, b) => a.platz.z - b.platz.z || a.platz.s - b.platz.s;
// Liste in Session-Gruppen aufteilen: Nummern von..bis (1-basiert) in Gruppen zu je groesse;
// restAnhaengen: eine kleinere letzte Gruppe wird an die vorletzte angehängt
const AUFTEILEN_GROESSEN = [10, 20, 25, 50, 75, 100];
function aufteilenGruppen(anzahl, von, bis, groesse, restAnhaengen) {
  von = Math.max(1, Math.min(anzahl, von)); bis = Math.max(von, Math.min(anzahl, bis));
  if (!anzahl || !(groesse >= 1)) return [];
  const g = [];
  for (let a = von; a <= bis; a += groesse) g.push([a, Math.min(a + groesse - 1, bis)]);
  if (restAnhaengen && g.length > 1 && g[g.length - 1][1] - g[g.length - 1][0] + 1 < groesse) {
    const rest = g.pop(); g[g.length - 1][1] = rest[1];
  }
  return g;
}
// Gültige, freie Plätze bleiben; alle anderen Einträge kommen auf den ersten freien Platz (zeilenweise).
// Reicht das Raster nicht, wächst es um Zeilen (zeilen im Ergebnis).
function ordneRaster(gespeichert, { zeilen, spalten }) {
  const belegt = new Set();
  const key = p => `${p.z}|${p.s}`;
  let z = zeilen;
  const gueltig = p => p && Number.isInteger(p.z) && Number.isInteger(p.s) && p.z >= 0 && p.s >= 0 && p.s < spalten && p.z < z;
  const behalten = gespeichert.map(e => {
    if (gueltig(e.platz) && !belegt.has(key(e.platz))) { belegt.add(key(e.platz)); return true; }
    return false;
  });
  let geaendert = false;
  const neu = gespeichert.map((e, i) => {
    if (behalten[i]) return e;
    geaendert = true;
    let p = null;
    for (let zz = 0; !p; zz++) {
      if (zz >= z) z = zz + 1;
      for (let s = 0; s < spalten && !p; s++) if (!belegt.has(`${zz}|${s}`)) p = { z: zz, s };
    }
    belegt.add(key(p));
    return { ...e, platz: p };
  });
  return { gespeichert: neu, zeilen: z, geaendert };
}
// Eintrag auf Platz ziel setzen; ist der Platz belegt, tauschen die beiden
function platziereSlot(gespeichert, id, ziel) {
  const quelle = gespeichert.find(e => e.id === id);
  if (!quelle) return gespeichert;
  const besetzer = gespeichert.find(e => e.id !== id && e.platz?.z === ziel.z && e.platz?.s === ziel.s);
  return gespeichert.map(e => e.id === id ? { ...e, platz: ziel }
    : besetzer && e.id === besetzer.id ? { ...e, platz: quelle.platz } : e);
}
function formatSlotDatum() {
  const n = new Date();
  return n.toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'})
    + ', ' + n.toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'});
}
function neueListeObjekt(id, name) {
  return {
    id, name,
    spalten: {
      E1:{name:"",aktiv:false}, E2:{name:"",aktiv:false}, E3:{name:"",aktiv:false},
      D1:{name:"",aktiv:false}, D2:{name:"",aktiv:false},
      i1:{name:"",aktiv:false}, i2:{name:"",aktiv:false},
    },
    naechste_id: 1,
    vokabeln: [],
  };
}
// Ältere Listen/Backups kennen nicht alle Spalten (z. B. E3) → fehlende leer ergänzen
function ergaenzeSpalten(liste) {
  if (!liste?.spalten) return liste;
  const fehlt = TYPEN.filter(t => !liste.spalten[t]);
  if (!fehlt.length) return liste;
  const spalten = { ...liste.spalten };
  fehlt.forEach(t => { spalten[t] = { name: "", aktiv: false }; });
  return { ...liste, spalten };
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
// Sprache der Fremdsprach-Spalten (E1–E3) pro Liste; fehlt sie, gilt "en"
const SPRACHEN = [
  { code:"en", name:"Englisch",       flagge:"🇬🇧", tts:"en-US", keys:["englisch","english"] },
  { code:"fr", name:"Französisch",    flagge:"🇫🇷", tts:"fr-FR", keys:["französisch","franzoesisch","french","français","francais"] },
  { code:"es", name:"Spanisch",       flagge:"🇪🇸", tts:"es-ES", keys:["spanisch","spanish","español","espanol"] },
  { code:"it", name:"Italienisch",    flagge:"🇮🇹", tts:"it-IT", keys:["italienisch","italian","italiano"] },
  { code:"la", name:"Latein",         flagge:"🏛️", tts:"it-IT", keys:["latein","latin"] },
  { code:"nl", name:"Niederländisch", flagge:"🇳🇱", tts:"nl-NL", keys:["niederländisch","niederlaendisch","dutch","nederlands"] },
  { code:"pt", name:"Portugiesisch",  flagge:"🇵🇹", tts:"pt-PT", keys:["portugiesisch","portuguese","português","portugues"] },
  { code:"ru", name:"Russisch",       flagge:"🇷🇺", tts:"ru-RU", keys:["russisch","russian","русский"] },
  { code:"tr", name:"Türkisch",       flagge:"🇹🇷", tts:"tr-TR", keys:["türkisch","tuerkisch","turkish","türkçe"] },
  { code:"pl", name:"Polnisch",       flagge:"🇵🇱", tts:"pl-PL", keys:["polnisch","polish","polski"] },
];
function sprachInfo(code) { return SPRACHEN.find(s => s.code === code) || SPRACHEN[0]; }
function listeSprache(l) { return l?.sprache || "en"; }
// Erste Sprache, deren Stichwort in einem Spaltennamen vorkommt (Import)
function erkenneSprache(headerNamen) {
  const low = headerNamen.map(n => (n || "").toLowerCase());
  return SPRACHEN.find(s => s.keys.some(k => low.some(n => n.includes(k))))?.code || null;
}
function spalteLang(typ, sprache) {
  if (typ.startsWith('E')) return sprachInfo(sprache).tts;
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
// Beispielzeile im Prompt je Sprache (Wort, falsche Antworten, Beispielsatz, Synonyme)
const PROMPT_BEISPIELE = {
  en: { wort:"go",     falsch:["went","goes","go","going"],        satz:"He goes to school every day.",       syn:"start, begin, head" },
  fr: { wort:"aller",  falsch:["allé","va","venir","partir"],      satz:"Je vais à l'école tous les jours.",  syn:"se rendre, partir" },
  es: { wort:"ir",     falsch:["fue","va","venir","salir"],        satz:"Voy a la escuela todos los días.",   syn:"marchar, andar" },
  it: { wort:"andare", falsch:["andato","va","venire","partire"],  satz:"Vado a scuola ogni giorno.",         syn:"recarsi, partire" },
  la: { wort:"ire",    falsch:["it","ivi","venire","currere"],     satz:"Marcus in forum it.",                syn:"vadere, proficisci" },
};
function generierePrompt(thema, anzahl, falsch, beispiele, synonyme, modus, sprache = "en") {
  const f = Math.min(20, Math.max(0, parseInt(falsch) || 0));
  const n = Math.max(1, parseInt(anzahl) || 20);
  const t = thema.trim() || "(Thema eingeben)";
  const sprName = sprachInfo(sprache).name;
  const bsp = PROMPT_BEISPIELE[sprache] || { wort:"Wort", falsch:["Fehler1","Fehler2","Fehler3","Fehler4"], satz:"Beispielsatz.", syn:"Synonym1, Synonym2" };

  const falschBspEn = f > 0 ? bsp.falsch.slice(0, f).join(" | ") : null;
  const falschBspDe = f > 0
    ? ["gegangen | gefahren | gelaufen | geflogen"].slice(0, 1).map(s => s.split(" | ").slice(0, f).join(" | ")).join("")
    : null;
  const falschteilEn = falschBspEn ? ` || ${falschBspEn}` : "";
  const falschteilDe = falschBspDe ? ` || ${falschBspDe}` : "";

  const infoKopf = [beispiele ? "Beispielsatz" : null, synonyme ? "Synonyme" : null].filter(Boolean);
  const infoDaten = [beispiele ? bsp.satz : null, synonyme ? bsp.syn : null].filter(Boolean);

  const kopfzeile = `${sprName} // Deutsch${infoKopf.length ? " // " + infoKopf.join(" // ") : ""}`;
  const datenzeile = `${bsp.wort}${falschteilEn} // gehen${falschteilDe}${infoDaten.length ? " // " + infoDaten.join(" // ") : ""}`;

  const regeln = [
    `- Spalten durch " // " trennen`,
    f > 0 ? `- Direkt nach jedem Wort " || " schreiben, dann genau ${f} falsche Antworten für Multiple Choice, mit " | " getrennt` : null,
    f > 0 ? `- WICHTIG: Eine falsche Antwort darf NIEMALS identisch mit der richtigen Antwort sein (auch nicht bei Groß-/Kleinschreibung)` : null,
    f > 0 && sprache === "en" ? `- Englische falsche Antworten: Mische typische Verwechslungen/Schreibfehler des Wortes (z.B. "were"→"where","wehre","where") mit gleichartigen Wörtern gleicher Wortart (Verb→andere Verben, Adjektiv→andere Adjektive). Recherchiere typische Fehlerquellen von Deutschsprachigen beim Englischlernen` : null,
    f > 0 && sprache !== "en" ? `- Falsche Antworten auf ${sprName}: Mische typische Verwechslungen/Schreibfehler des Wortes (z.B. fehlende oder falsche Akzente, falsche Endungen, ähnlich klingende Wörter) mit gleichartigen Wörtern gleicher Wortart (Verb→andere Verben, Adjektiv→andere Adjektive). Recherchiere typische Fehlerquellen von Deutschsprachigen beim Lernen von ${sprName}` : null,
    sprache !== "en" ? `- Wörter auf ${sprName} immer mit korrekten Akzenten/Sonderzeichen schreiben; bei Nomen den Artikel mit angeben, wenn im Lehrbuch üblich` : null,
    f > 0 ? `- Deutsche falsche Antworten: Verwende bedeutungsverwandte Wörter gleicher Wortart (kein Schreibfehler-Varianten, sondern echte verwandte Wörter wie bei "gehen"→"laufen, fahren, rennen")` : null,
    beispiele ? `- Die Spalte „Beispielsatz" enthält je einen natürlichen Beispielsatz auf ${sprName} (keine falschen Antworten)` : null,
    synonyme ? `- Die Spalte „Synonyme" enthält 2–4 Synonyme auf ${sprName}, kommagetrennt (keine falschen Antworten)` : null,
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
Erste Zeile: Spaltennamen, die den tatsächlichen Inhalt beschreiben (z.B. ${sprName}, Deutsch, Beispiel). Die Spalte(n) der Fremdsprache heißen „${sprName}“ (bei mehreren z.B. „${sprName} Infinitiv“, „${sprName} Präteritum“).
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
  const namenszeile = `# ${liste.name}${listeSprache(liste) !== "en" ? ` {${liste.sprache}}` : ""}`;
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

// ── Datei-Import ───────────────────────────────────────────────────────────
// Datei robust als Text lesen: UTF-8 (mit/ohne BOM), UTF-16 (mit/ohne BOM), sonst Windows-1252.
// Dateien, die unterwegs (Mail, Editor, Cloud) umgespeichert wurden, kommen oft anders kodiert an.
async function leseDateiAlsText(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0xFF && buf[1] === 0xFE) return new TextDecoder("utf-16le").decode(buf.subarray(2));
  if (buf[0] === 0xFE && buf[1] === 0xFF) return new TextDecoder("utf-16be").decode(buf.subarray(2));
  const probe = buf.subarray(0, 400);
  if (probe.length > 8 && probe.filter(b => b === 0).length > probe.length / 4)
    return new TextDecoder(buf[0] === 0 ? "utf-16be" : "utf-16le").decode(buf);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1252").decode(buf); }
}
// JSON-Backup im Text finden (auch wenn davor/danach etwas steht). null = kein JSON; wirft bei kaputtem JSON.
function findeJsonListen(text) {
  const t = text.replace(/^[\uFEFF\u200B\s]+/, "");
  let kandidat = null;
  if (t.startsWith("[") || t.startsWith("{")) kandidat = t;
  else if (/"vokabeln"\s*:/.test(t)) {
    const a = t.search(/[[{]/), b = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
    if (a >= 0 && b > a) kandidat = t.slice(a, b + 1);
  }
  if (!kandidat) return null;
  let parsed = JSON.parse(kandidat.trim());
  if (!Array.isArray(parsed)) parsed = [parsed];
  return parsed.filter(l => l && l.name && l.vokabeln);
}
// Keine Textdatei (Bild, PDF, Office-Datei …): mehrere Steuerzeichen am Anfang
function istBinaer(text) {
  let steuer = 0;
  for (let i = 0; i < Math.min(text.length, 2000); i++) {
    const c = text.charCodeAt(i);
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 127) steuer++;
  }
  return steuer > 5;
}
function dateiVorschau(text) {
  const anfang = text.slice(0, 60).replace(/\s+/g, " ").trim();
  return anfang ? `„${anfang}${text.length > 60 ? "…" : ""}“` : "(leer)";
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
// Kopfzeile: Spalten-Kennung wie [E1] (eigener Export) vor dem Entfernen der Lautschrift retten
const SPALTEN_TAG = /\s*(\[[EDi][123]\])\s*$/;
function parseKopfZeile(zeile) {
  return zeile.split('//').map(t => {
    const m = t.match(SPALTEN_TAG);
    if (!m) return parseKolumne(t);
    const k = parseKolumne(t.slice(0, m.index));
    return { ...k, wert: `${k.wert} ${m[1]}` };
  });
}

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
// iPad-Tastatur setzt typografische Apostrophe (l’école) → immer vereinheitlichen
function normApostroph(s) { return s.replace(/[’‘ʼ`´]/g, "'"); }
function ohneAkzente(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
}
// true = exakt richtig, "akzent" = nur ohne Akzente richtig (nur wenn tolerant), false = falsch
function istRichtigeAntwort(eingabe, wert, akzentTolerant = false) {
  const varianten = generiereVarianten(normApostroph(wert));
  const e = normApostroph(eingabe.toLowerCase().trim());
  if (varianten.includes(e)) return true;
  if (akzentTolerant && varianten.map(ohneAkzente).includes(ohneAkzente(e))) return "akzent";
  return false;
}
// Antwort-Modus, wenn für eine Spalte nichts festgelegt ist (Karte aufdecken)
const STANDARD_ANTWORT_MODUS = "karte";
const ANTWORT_MODUS_NAMEN = { karte: "Karte", mc: "MC", tippen: "Tastatur", akzent: "Akzente" };
// Abfrageart einer Quiz-Konfiguration: eigener Session-Fortschritt je Art
function abfrageArtVon(modus, antwortTypen, spalteModus) {
  if (modus === "diktat") return "diktat";
  return modus === "sequenziell" && antwortTypen?.length > 0 && antwortTypen.every(t => spalteModus?.[t] === "akzent")
    ? "akzente" : "uebersetzung";
}
const ABFRAGE_ART_NAMEN = { uebersetzung: "Übersetzung", diktat: "Diktat", akzente: "Akzente" };
// Fortschritte eines Slot-Eintrags je Art (altes Format: ein Fortschritt = Übersetzung)
function slotSFAlle(eintrag) {
  return eintrag?.sessionFortschritte || (eintrag?.sessionFortschritt ? { uebersetzung: eintrag.sessionFortschritt } : {});
}
function slotKonfigArt(eintrag) {
  const k = eintrag?.konfiguration || {};
  return abfrageArtVon(k.quizModus || "sequenziell", k.quizAntwortTypenGeordnet, k.quizSpalteModus);
}
// Statistik-Gruppen in Anzeige-Reihenfolge mit Farbe (Kreis, Gruppen-Balken)
const GRUPPE_BALKEN = [["gelernt", "#2d6a4f"], ["arbeit", "#e9c46a"], ["nie", "#d6d2cb"], ["negativ", "#e57373"]];
// Session-Standard: in Paketen abfragen
const STANDARD_SESSION_MODUS = "pakete";
// Standard-Reihenfolge: schlechteste zuerst, nur Score ≤ 3, unbeantwortete zuerst
const STANDARD_REIHENFOLGE = "schlechteste";
const STANDARD_MAX_SCORE = "3";
const STANDARD_UNBEANTWORTET_ZUERST = { zufall: true, schlechteste: true, listennr: true };
const STANDARD_PAKET_GROESSE = 10;
// Abfrage-Ziel-Standard: jede Vokabel wird wiederholt, bis sie 1× richtig war
const STANDARD_ABFRAGE_ZIEL = "wiederholung";
const AKZENT_HINWEIS = "Richtig – achte auf die Akzente.";

// Schwierigkeitsgrad: welche Regel in "Einfach" bzw. "Schwer" gilt (in den Einstellungen per Haken änderbar)
const STUFEN_REGELN = [
  { key: "akzenteTolerant", label: "Fehlende Akzente beim Tippen gelten als richtig", sub: "z. B. ete statt été", einfach: true, schwer: false },
  { key: "aufdeckenAbzug", label: "„Lösung anzeigen“ zieht 1 Punkt ab", sub: "sonst ohne Score-Einfluss", einfach: true, schwer: true },
  { key: "akzentOhneMischen", label: "Akzent-Modus: auch Wörter ohne Akzent abfragen", sub: "dann muss man erkennen, dass nichts zu ändern ist", einfach: false, schwer: false },
  { key: "akzentHervorheben", label: "Akzent-Modus: Buchstaben mit Akzent hervorheben", sub: "zeigt, wo ein Akzent hingehört; Tippen auf andere Buchstaben zählt dann nicht als Fehler", einfach: true, schwer: true },
  { key: "akzentZaehler", label: "Akzent-Modus: anzeigen, wie viele Akzente noch fehlen", sub: "z. B. „Akzente 2 / 3“", einfach: true, schwer: true },
  { key: "akzentAutoUebernahme", label: "Akzent-Modus: alle Akzente richtig → automatisch übernehmen", sub: "sonst muss man „Prüfen“ antippen", einfach: true, schwer: true },
];
// Regeln der aktuell gewählten Stufe (gespeicherte Haken, sonst Standard)
function stufenRegeln(einst) {
  const stufe = einst?.modus === "einfach" ? "einfach" : "schwer";
  return Object.fromEntries(STUFEN_REGELN.map(r => [r.key, einst?.stufen?.[stufe]?.[r.key] ?? r[stufe]]));
}
const MC_FEHLKLICK_HINWEIS = "Nicht auf Anhieb gefunden – zählt als nicht gewusst.";

// ── Score-Clamp (Anzeige: −10 bis +10) ────────────────────────────────────
function clampScore(s) { return Math.max(-10, Math.min(10, s ?? 0)); }
// Lernfortschritt in %: jede Vokabel anteilig bis zur Gelernt-Schwelle (negativ/nie = 0)
function lernProzent(scores, schwelle) {
  if (!scores.length || schwelle <= 0) return 0;
  return scores.reduce((s, sc) => s + Math.min(1, Math.max(0, (sc ?? 0) / schwelle)), 0) / scores.length * 100;
}
// Score für den Gelernt-Status: Diktat hat einen eigenen Fortschritt
function gelerntScore(v, diktat) { return (diktat ? v.diktatFortschritt?.score : v.fortschritt?.score) ?? -Infinity; }

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
// Akzent-Modus: eigener Score (+1 richtig, −1 falsch/aufgedeckt) wie beim Diktat
function speichereAkzentScore(liste, vokId, neuFortschritt) {
  const vok = liste.vokabeln.find(v => v.id === vokId);
  const listeId = vok?._listeId || liste.id;
  const origId = vok?._origId ?? vokId;
  if (listeId && listeId !== 'combined') {
    const origListe = listeId === liste.id ? liste : lsGet(SK.liste(listeId));
    if (origListe) lsSet(SK.liste(listeId), { ...origListe, vokabeln: origListe.vokabeln.map(v => v.id === origId ? {...v, akzentFortschritt: neuFortschritt} : v) });
  }
  return { ...liste, vokabeln: liste.vokabeln.map(v => v.id === vokId ? {...v, akzentFortschritt: neuFortschritt} : v) };
}

// ── Akzent-Modus ───────────────────────────────────────────────────────────
// Varianten je Grundbuchstabe und Sprache; Ligaturen ersetzen zwei Buchstaben (o+e → œ)
const AKZENT_TABELLE = {
  fr: { a:"aàâ", e:"eéèêë", i:"iîï", o:"oô", u:"uùûü", c:"cç", y:"yÿ" },
  es: { a:"aá", e:"eé", i:"ií", o:"oó", u:"uúü", n:"nñ" },
  de: { a:"aä", o:"oö", u:"uü" },
  it: { a:"aà", e:"eèé", i:"iì", o:"oòó", u:"uù" },
  pt: { a:"aáàâã", e:"eéê", i:"ií", o:"oóôõ", u:"uú", c:"cç" },
};
const AKZENT_LIGATUREN = { fr: { oe:"œ", ae:"æ" }, de: { ss:"ß" } };
const LIGATUR_TEILE = { "œ":"oe", "Œ":"OE", "æ":"ae", "Æ":"AE", "ß":"ss" };
function ohneAkzent(ch) { return ch.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
// Wort → Kacheln { basis, richtig }; eine Ligatur belegt zwei Kacheln (zweite: richtig "")
function akzentKacheln(wert) {
  const kacheln = [];
  for (const ch of wert || "") {
    const teile = LIGATUR_TEILE[ch];
    if (teile) { kacheln.push({ basis: teile[0], richtig: ch }, { basis: teile[1], richtig: "" }); }
    else kacheln.push({ basis: ohneAkzent(ch) || ch, richtig: ch });
  }
  return kacheln;
}
function hatAkzente(wert) { return akzentKacheln(wert).some(k => k.richtig !== k.basis); }
// Antwortspalten einer Vokabel: Akzent-Spalten ohne Akzent ggf. auslassen (nieLeer: lieber ungefiltert als gar nichts)
// Mehrere Antworten einer Frage-Runde immer in Spalten-Reihenfolge abfragen: E1, E2, E3, D1, …
function nachSpaltenReihenfolge(typen) {
  return [...typen].sort((a, b) => TYPEN.indexOf(a) - TYPEN.indexOf(b));
}
function antwortSpaltenFuer(vok, typen, spalteModus, ohneAkzentAuslassen, nieLeer = false) {
  typen = nachSpaltenReihenfolge(typen);
  if (!ohneAkzentAuslassen || !vok) return typen;
  const r = typen.filter(t => spalteModus?.[t] !== "akzent" || hatAkzente(vok[t]?.wert));
  return nieLeer && r.length === 0 ? typen : r;
}
// Auswahl-Tasten für Kachel i (leer = nicht antippbar)
function akzentVarianten(kacheln, i, lang) {
  const sp = (lang || "fr").split("-")[0].toLowerCase();
  const tabelle = AKZENT_TABELLE[sp] || AKZENT_TABELLE.fr;
  const k = kacheln[i];
  const klein = k.basis.toLowerCase();
  const gross = k.basis !== klein;
  const anpassen = v => gross ? v.toUpperCase() : v;
  let liste = [...(tabelle[klein] || "")].map(anpassen);
  const naechste = kacheln[i + 1]?.basis.toLowerCase();
  Object.entries(AKZENT_LIGATUREN[sp] || AKZENT_LIGATUREN.fr).forEach(([paar, lig]) => {
    if (paar[0] === klein && paar[1] === naechste) liste.push(anpassen(lig));
  });
  liste = liste.filter(v => v.length === 1);
  // Zeichen außerhalb der Tabelle (z. B. Liste mit falscher Sprache) trotzdem erreichbar machen
  if (k.richtig && k.richtig !== k.basis && !liste.includes(k.richtig)) liste.push(k.richtig);
  if (liste.length > 0 && !liste.includes(k.basis)) liste.unshift(k.basis);
  return liste.length > 1 ? liste : [];
}

// ── Statistik-Art: welcher Score ausgewertet wird (Tap in die Kreismitte wechselt) ──
const STATISTIK_ARTEN = [["uebersetzung", "Übersetzung"], ["diktat", "Diktat"], ["akzente", "Akzente"]];
// Feld des Scores je Art (an der Vokabel)
const SCORE_FELD = { uebersetzung: "fortschritt", diktat: "diktatFortschritt", akzente: "akzentFortschritt" };
// Sicht für die Statistik: "fortschritt" ist der Score der gewählten Art; Akzente nur Vokabeln mit Akzent
function statistikSicht(voks, art) {
  if (art === "diktat") return voks.map(v => ({ ...v, fortschritt: v.diktatFortschritt }));
  if (art === "akzente") return voks
    .filter(v => v.akzentFortschritt || TYPEN.some(t => t.startsWith('E') && hatAkzente(v[t]?.wert)))
    .map(v => ({ ...v, fortschritt: v.akzentFortschritt }));
  return voks;
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
  /* Kein Text-Markieren per Lang-Druck (kollidiert mit den Info-Texten); Eingabefelder bleiben markierbar */
  body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
  input,textarea,[contenteditable="true"]{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default;}
  .app{max-width:600px;margin:0 auto;padding:0 0 80px;}
  .topbar{background:#fff;border-bottom:1px solid #e0dbd2;padding:14px 16px;display:flex;align-items:center;gap:12px;}
  .topbar-title{font-size:1.05rem;font-weight:700;flex:1;text-align:center;}
  .info-schalter{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;border:1.5px solid #2d6a4f;background:#fff;color:#2d6a4f;font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-family:inherit;}
  body.info-modus .info-schalter{background:#2d6a4f;color:#fff;}
  body.info-modus [data-info]{outline:1.5px dashed #52b788 !important;outline-offset:2px;}
  @media (max-width:480px){.sprach-chip-name{display:none;}}
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
  /* Fenster oben anzeigen, damit die Bildschirmtastatur sie nicht verdeckt */
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;z-index:100;padding:max(16px, env(safe-area-inset-top)) 16px 16px;overflow-y:auto;}
  .modal{background:#fff;border-radius:16px;width:100%;max-width:500px;padding:24px;margin-top:4vh;box-sizing:border-box;}
  .modal-titel{font-size:1.1rem;font-weight:700;margin-bottom:16px;}
  .modal-actions{display:flex;gap:10px;margin-top:20px;justify-content:flex-end;}
  .leer{text-align:center;padding:48px 24px;color:#6b6560;}
  .leer-text{font-size:0.9rem;line-height:1.5;margin-top:8px;}
  .jubel{text-align:center;padding:4px 0 18px;}
  .jubel-titel{font-size:2rem;font-weight:800;color:#2d6a4f;line-height:1.2;animation:jubelPop .55s cubic-bezier(.2,1.6,.4,1) both;}
  .jubel-emoji{font-size:2.2rem;display:block;animation:jubelPop .55s .1s cubic-bezier(.2,1.6,.4,1) both;}
  .jubel-sub{font-size:0.9rem;color:#6b6560;margin-top:4px;}
  @keyframes jubelPop{0%{transform:scale(.3);opacity:0;}100%{transform:scale(1);opacity:1;}}
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
  /* Rechte Spalte der Kopfzeilen (Quiz/Statistik): alle Knöpfe so breit und hoch wie der Alle/Bereich-Schalter */
  .zeile-rechts{width:124px;height:31px;box-sizing:border-box;flex-shrink:0;}
  button.zeile-rechts{display:inline-block;padding:0 8px;line-height:31px;font-size:0.82rem;border-radius:8px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .toggle-btn.zeile-rechts .toggle-opt{flex:1 1 0;padding:0 4px;min-width:0;}
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
  .slot-chip.verlauf{background:#fff;border-style:dashed;border-color:#c0bcb7;color:#6b6560;font-weight:500;}
  .slot-chip.zuletzt{background:#fffde7;border-color:#f9a825;color:#e65100;}
  .slot-chip.leer{opacity:0.35;cursor:default;}
  .slot-raster{display:grid;gap:6px;}
  .listen-raster{display:grid;gap:6px;margin-bottom:16px;}
  .listen-raster .karte-zeile{background:#fff;border:1px solid #e0dbd2;border-radius:12px;min-width:0;}
  .listen-raster .karte-zeile:last-child{border-bottom:1px solid #e0dbd2;}
  .listen-raster.eng .karte-zeile{padding:10px 12px;gap:8px;}
  .listen-raster .raster-leer{min-height:56px;}
  .listen-raster.auswahl .quiz-setup-check{background:#fff;border:1px solid #e0dbd2;border-radius:12px;min-width:0;}
  .listen-raster.auswahl .quiz-setup-check:last-child{border-bottom:1px solid #e0dbd2;}
  .listen-raster.auswahl.eng .quiz-setup-check{padding:8px 10px !important;gap:8px;}
  .listen-raster.auswahl .quiz-setup-check > div:last-child{min-width:0;}
  .listen-raster.auswahl .raster-leer{min-height:0;}
  .raster-chip{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;min-height:44px;min-width:0;text-align:left;padding:6px 10px;}
  .raster-name{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .raster-fortschritt{font-size:0.68rem;font-weight:600;opacity:0.8;}
  .raster-leer{min-height:44px;border:1.5px solid #e0dbd2;border-radius:8px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
  .slot-kopf-knoepfe .slot-chip{padding:2px 9px;font-size:0.7rem;}
  .score-badge{font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:10px;}
  .score-pos{background:#e8f5e9;color:#2d6a4f;}
  .score-neg{background:#ffebee;color:#c0392b;}
  .score-null{background:#e0dbd2;color:#6b6560;}
  .quiz-frage-box{background:#fff;border:1px solid #e0dbd2;border-radius:14px;padding:20px;margin-bottom:14px;}
  .akzent-rahmen{container-type:inline-size;}
  .akzent-wort{--k:min(48px, calc((100cqw - (var(--n) - 1) * 4px) / var(--n)));display:flex;flex-wrap:wrap;justify-content:center;column-gap:calc(var(--k) * 0.6);row-gap:8px;margin-top:8px;}
  .akzent-wortgruppe{display:flex;gap:4px;}
  .akzent-kachel{box-sizing:border-box;width:var(--k);height:calc(var(--k) * 1.3);padding:0;border-radius:calc(var(--k) * 0.2);border:1.5px solid #c9c2b6;background:#fff;font-family:inherit;font-size:calc(var(--k) * 0.68);font-weight:700;color:#1a1a1a;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,border-color .15s;}
  .akzent-zaehler{text-align:center;font-size:0.85rem;font-weight:700;color:#6b6560;margin-top:2px;}
  .akzent-kachel.markiert{background:#fff4d6;border-color:#e0a800;}
  .akzent-kachel.aktiv{border:2.5px solid #3b3832;background:#f0ede8;}
  .akzent-kachel.ok{background:#c8e6c9;border-color:#2d6a4f;color:#1b5e20;}
  .akzent-kachel.falsch{background:#fdecea;border-color:#c0392b;color:#c0392b;}
  .akzent-kachel.loesung{background:#fff4d6;border-color:#e0a800;color:#2d6a4f;}
  .akzent-kachel.blink{background:#e74c3c;border-color:#c0392b;color:#fff;}
  .akzent-aktionen{width:100%;display:flex;flex-direction:column;align-items:center;gap:10px;}
  .akzent-pruefen{min-width:60%;padding:14px 28px;font-size:1.15rem;}
  .akzent-leiste{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:12px;padding:10px 6px;background:#f0f9f4;border-radius:12px;}
  .akzent-variante{min-width:48px;height:58px;border-radius:10px;border:1.5px solid #2d6a4f;background:#fff;font-family:inherit;font-size:1.9rem;font-weight:700;color:#1a1a1a;cursor:pointer;}
  .wiederholung-karte{background:#fdf3e7;border:2px dashed #e67e22;text-align:center;}
  .wiederholung-marke{color:#c0640f;font-size:0.85rem;font-weight:700;}
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
  .quiz-vorig.nicht{background:#fdf0ef;border-color:#f3c7c3;color:#9b2c22;}
  .quiz-vorig.nicht .quiz-vorig-label{color:#c0392b;}
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
  .score-slider{-webkit-appearance:none;appearance:none;width:100%;height:30px;background:transparent;outline:none;cursor:pointer;}
  .score-slider::-webkit-slider-runnable-track{height:4px;background:#e0dbd2;border-radius:2px;}
  .score-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;background:#2d6a4f;border-radius:6px;cursor:pointer;margin-top:-12px;}
  .score-slider::-moz-range-track{height:4px;background:#e0dbd2;border-radius:2px;}
  .score-slider::-moz-range-thumb{width:28px;height:28px;background:#2d6a4f;border-radius:6px;cursor:pointer;border:none;}
`;

const TYPEN = ["E1","E2","E3","D1","D2","i1","i2"];
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
const IcoCopy    = ({s=15}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><rect x="5" y="1" width="10" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="1" y="4" width="10" height="11" rx="2" fill="#fff" stroke="currentColor" strokeWidth="2"/></svg>;
const IcoExpand  = ({s=16}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><polyline points="1,6 1,1 6,1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="6.5" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="10,1 15,1 15,6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="15" y1="1" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="1,10 1,15 6,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="15" x2="6.5" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15,10 15,15 10,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="15" y1="15" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const IcoCollapse= ({s=16}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><polyline points="1,6 6,6 6,1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="6" x2="0.5" y2="0.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15,6 10,6 10,1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="6" x2="15.5" y2="0.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="1,10 6,10 6,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="10" x2="0.5" y2="15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15,10 10,10 10,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="10" x2="15.5" y2="15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;

export default function VokabelApp() {
  const [tab, setTab] = useState("quiz");
  const [listenIndex, setListenIndex] = useState([]);
  const [einstellungen, setEinstellungen] = useState(defaultEinstellungen());
  const [infoModus, setInfoModus] = useState("uebersicht");
  const [ansicht, setAnsicht] = useState("uebersicht");
  const [aktiveListeId, setAktiveListeId] = useState(null);
  const [aktiveListe, setAktiveListe] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalInput, setModalInput] = useState("");
  const [modalMitVokabeln, setModalMitVokabeln] = useState(false);
  const [modalFehler, setModalFehler] = useState("");
  const [jsonExportIds, setJsonExportIds] = useState(null);
  const [jsonExportOptionen, setJsonExportOptionen] = useState({ fortschritt: true, diktatFortschritt: true, akzentFortschritt: true, falsch: true });
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
  const [quizAbfrageModusAufgeklappt, setQuizAbfrageModusAufgeklappt] = useState(false);
  const [quizReihenfolgeAufgeklappt, setQuizReihenfolgeAufgeklappt] = useState(false);
  const [quizEinstellungenAufgeklappt, setQuizEinstellungenAufgeklappt] = useState(false);
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
  const [promptSprache, setPromptSprache] = useState("en");
  const [letzterPrompt, setLetzterPrompt] = useState("");
  const [exportKopiert, setExportKopiert] = useState(false);
  const [exportAuswahlModus, setExportAuswahlModus] = useState(false);
  const [exportAusgewaehlt, setExportAusgewaehlt] = useState(new Set());
  const [statistikSort, setStatistikSort] = useState("score-asc");
  const [statistikArt, setStatistikArt] = useState("uebersetzung");   // uebersetzung / diktat / akzente
  const [statistikFilter, setStatistikFilter] = useState(new Set(['negativ', 'nie', 'arbeit', 'gelernt'])); // Gruppen: negativ / nie / arbeit / gelernt
  const [statistikListenIds, setStatistikListenIds] = useState(null); // null = alle
  const [statistikListenAufgeklappt, setStatistikListenAufgeklappt] = useState(false);
  const [statistikVollbild, setStatistikVollbild] = useState(false);
  const [statistikBereichTyp, setStatistikBereichTyp] = useState("alle");
  const [statistikCheckboxAuswahl, setStatistikCheckboxAuswahl] = useState(new Set());
  const [statistikEinzelauswahlAufgeklappt, setStatistikEinzelauswahlAufgeklappt] = useState(false);
  const [statistikVonBisModus, setStatistikVonBisModus] = useState(false);
  const [statistikVonBisErster, setStatistikVonBisErster] = useState(null);
  const [statistikVokauswahlH, setStatistikVokauswahlH] = useState(0);
  const [slots, setSlots] = useState(defaultSlots());          // {verlauf:[], gespeichert:[]}
  const [aktiverSlot, setAktiverSlot] = useState(null);        // {typ:"verlauf"|"gespeichert", id:string} | null
  const [slotGeaendert, setSlotGeaendert] = useState(false);   // ob Einstellungen seit Laden geändert
  const [statistikAktiverSlot, setStatistikAktiverSlot] = useState(null); // separater Slot-Zustand für Statistik-Tab
  const [statistikSlotGeleert, setStatistikSlotGeleert] = useState(false);  // true wenn Slot durch Listen-Wechsel geleert
  const [quizSessionModus, setQuizSessionModus] = useState(STANDARD_SESSION_MODUS);
  const [quizPaketGroesse, setQuizPaketGroesse] = useState(STANDARD_PAKET_GROESSE);
  const [quizSessionAufgeklappt, setQuizSessionAufgeklappt] = useState(false);
  const [abfrageZielModus, setAbfrageZielModus] = useState(STANDARD_ABFRAGE_ZIEL);
  const [abfrageZielAnzahl, setAbfrageZielAnzahl] = useState(1);
  const [abfrageZielWiederholung, setAbfrageZielWiederholung] = useState(1);
  const [abfrageZielScore, setAbfrageZielScore] = useState(0);
  const [abfrageZielScoreTyp, setAbfrageZielScoreTyp] = useState("global");
  const [sessionSlotAktiv, setSessionSlotAktiv] = useState(null);
  const [sessionH, setSessionH] = useState(0);
  const [slotH, setSlotH] = useState(0);
  const [listenauswahlHeaderH, setListenauswahlHeaderH] = useState(0);
  const [sessionUeberschreibenModal, setSessionUeberschreibenModal] = useState(false);
  const [loescheSlotNr, setLoescheSlotNr] = useState(null);
  const [slotSektionAufgeklappt, setSlotSektionAufgeklappt] = useState(true);
  const [slotUmbenennen, setSlotUmbenennen] = useState(null);   // {id, name, kopie} – Fenster "Umbenennen" bzw. "Duplizieren"
  const [quizGelerntEinschliessen, setQuizGelerntEinschliessen] = useState(false);
  const [gruppenQuiz, setGruppenQuiz] = useState(null);   // {name, art, ids, listenIds} – Rückfrage "Quiz mit dieser Gruppe starten?"
  const gruppenQuizStartRef = useRef(0);                 // >0: nach dem Tab-Wechsel automatisch starten
  const [listenGelerntAusblenden, setListenGelerntAusblenden] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [sprachMenuOffen, setSprachMenuOffen] = useState(false);
  const [slotSortModus, setSlotSortModus] = useState(false);   // "Verschieben"-Modus des Rasters
  const [slotDragId, setSlotDragId] = useState(null);         // wird gerade gezogen
  const [slotAuswahlId, setSlotAuswahlId] = useState(null);   // angetippt, wartet auf Zielplatz
  const [slotDragZiel, setSlotDragZiel] = useState(null);     // "z|s" unter dem Finger
  const slotZiehenRef = useRef(null);                         // {id, x, y, aktiv, art: "liste" für das Listen-Raster}
  const [listenSortModus, setListenSortModus] = useState(false);   // "Verschieben"-Modus des Listen-Rasters
  const [listenAuswahlId, setListenAuswahlId] = useState(null);    // angetippt, wartet auf Zielplatz
  const [listeMenueId, setListeMenueId] = useState(null);          // Liste aus dem Lang-Druck-Menü (Umbenennen, Duplizieren, Zurücksetzen, Löschen)
  const [zuruecksetzenArten, setZuruecksetzenArten] = useState(new Set(Object.keys(SCORE_FELD)));
  // Liste in Sessions aufteilen (Quiz-Tab): { listeId, name, groesse, von, bis, restAnhaengen }
  const [aufteilen, setAufteilen] = useState(null);
  const slotGezogenRef = useRef(false);                       // Klick nach dem Ziehen schlucken
  // Rückfrage "Abgefragt-Stand löschen?" in der Fortschrittszeile; ohne Antwort nach 6 s wieder weg
  const [sessionResetFrage, setSessionResetFrage] = useState(false);
  useEffect(() => {
    if (!sessionResetFrage) return;
    const t = setTimeout(() => setSessionResetFrage(false), 6000);
    return () => clearTimeout(t);
  }, [sessionResetFrage]);
  const [importSprache, setImportSprache] = useState("en");
  const [gespeicherteVokabelgruppe, setGespeicherteVokabelgruppe] = useState(null);
  const [gruppenAenderungsDialog, setGruppenAenderungsDialog] = useState(false);
  const [quizBereichTyp, setQuizBereichTyp] = useState("alle");
  const [quizReihenfolge, setQuizReihenfolge] = useState(STANDARD_REIHENFOLGE);
  const [quizSchlechtesteMaxScore, setQuizSchlechtesteMaxScore] = useState(STANDARD_MAX_SCORE);
  const [quizUnbeantwortetZuerst, setQuizUnbeantwortetZuerst] = useState(STANDARD_UNBEANTWORTET_ZUERST);
  const [quiz, setQuiz] = useState(null);
  const [diktatListeAufgeklappt, setDiktatListeAufgeklappt] = useState(false);
  const [vokabelAufgeklappt, setVokabelAufgeklappt] = useState(false);
  const [ansichtSpaltenAn, setAnsichtSpaltenAn] = useState(() => lsGet(SK.ansichtSpalten, {}));
  const [statistikListeZu, setStatistikListeZu] = useState(() => lsGet(SK.statistikListeZu, true) !== false);
  const [aktionszeileAufgeklappt, setAktionszeileAufgeklappt] = useState(false);
  const [diktatManualPlays, setDiktatManualPlays] = useState(0);
  const [quizTabListen, setQuizTabListen] = useState([]);
  const [listenAuswahlAufgeklappt, setListenAuswahlAufgeklappt] = useState(true);
  const eingabeRef = useRef(null);
  const flashTimerRef = useRef(null);
  const flashWeiterRef = useRef(null);   // was nach der Verzögerung passiert (Antippen beendet sie sofort)
  const akzentBlinkRef = useRef(null);
  const diktatPlayCountRef = useRef(0);
  const fileInputRef = useRef(null);
  const headerRef = useRef(null);
  const listenContainerRef = useRef(null);
  const dropdownImmuneRef = useRef(false);
  const statistikListenHeaderRef = useRef(null);
  const statistikVokauswahlRef = useRef(null);
  const statistikListenContainerRef = useRef(null);
  const statistikEinzelauswahlRef = useRef(null);
  const alleBereichRef = useRef(null);
  const einzelauswahlRef = useRef(null);
  const abfrageModusRef = useRef(null);
  const abfrageModusContainerRef = useRef(null);
  const einstellungenRef = useRef(null);
  const einstellungenContainerRef = useRef(null);
  const reihenfolgeRef = useRef(null);
  const reihenfolgeContainerRef = useRef(null);
  const sessionRef = useRef(null);
  const sessionContainerRef = useRef(null);
  const slotSektionRef = useRef(null);
  const slotContainerRef = useRef(null);
  const listenauswahlHeaderRef = useRef(null);
  const infoHeaderRef = useRef(null);
  const infoKontextContainerRef = useRef(null);
  const tooltipTimer = useRef(null);
  const tooltipShown = useRef(false);
  // Erklärtext: Maus = title; Touch = lange drücken → Info-Tafel (bleibt bis Antippen, InfoTafel.jsx);
  // data-info macht das Element im Info-Modus erklärbar
  // aktionen (optional): Lang-Druck bzw. Rechtsklick zeigt die Erklärung mit Menü-Knöpfen darunter
  // opts.langText: anderer Text für den Lang-Druck (z. B. nur der volle Name); opts.beimZeigen(x, y): Rückruf
  function tt(text, aktionen, opts = {}) {
    if (!text) return {};
    const langText = opts.langText || text;
    return {
      ...(aktionen ? { onContextMenu(e) { e.preventDefault(); zeigeInfo(langText, e.clientX, e.clientY, aktionen); } } : {}),
      title: text,
      "data-info": text,
      onTouchStart(e) {
        const t = e.touches[0];
        clearTimeout(tooltipTimer.current);
        tooltipShown.current = false;
        tooltipTimer.current = setTimeout(() => {
          if (slotZiehenRef.current?.aktiv) return;   // beim Verschieben im Raster keine Erklärung einblenden
          tooltipShown.current = true; zeigeInfo(langText, t.clientX, t.clientY, aktionen);
          opts.beimZeigen?.(t.clientX, t.clientY);
        }, 500);
      },
      onTouchEnd(e)   { clearTimeout(tooltipTimer.current); if (tooltipShown.current) { e.preventDefault(); tooltipShown.current = false; } },
      onTouchMove()   { clearTimeout(tooltipTimer.current); },   // Finger zittert nach dem Aufgehen: Tafel bleibt
      onTouchCancel() { clearTimeout(tooltipTimer.current); tooltipShown.current = false; },
    };
  }
  // Eingabefelder/Ziehen: nur Maus-Hinweis + Info-Modus (langes Drücken bleibt Einfügen/Markieren/Ziehen)
  function ttFeld(text) { return text ? { title: text, "data-info": text } : {}; }
  const [headerH, setHeaderH] = useState(104);
  const [alleBereichH, setAlleBereichH] = useState(0);
  const [abfrageModusH, setAbfrageModusH] = useState(0);
  const [reihenfolgeH, setReihenfolgeH] = useState(0);
  const [einstellungenH, setEinstellungenH] = useState(0);
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

  // ── Rolladen-Bereiche: Zuklappen beim Weiterscrollen, mit Bremse am Bereichsende ──
  // Ein offener Bereich klappt erst zu, wenn sein Ende sichtbar war und das Scrollen dort
  // angehalten hat ("freigegeben"). Schwung, der unfreigegeben übers Ende hinausläuft,
  // klappt nicht zu, sondern gleitet zurück, bis das Ende wieder unten sichtbar ist.
  const [zuklappHinweis, setZuklappHinweis] = useState(false);
  const zuklappFreiRef = useRef(new Set());
  const kontexteRef = useRef(() => []);
  kontexteRef.current = () => {
    const q = headerH + slotH + listenauswahlHeaderH;
    return [
      ["slot",      slotContainerRef,            headerH + slotH,                         () => setSlotSektionAufgeklappt(false)],
      ["listen",    listenContainerRef,          q,                                       () => setListenAuswahlAufgeklappt(false)],
      ["vokabeln",  einzelauswahlRef,            q + alleBereichH,                        () => setQuizListeAufgeklappt(false)],
      ["modus",     abfrageModusContainerRef,    q + alleBereichH + abfrageModusH,        () => setQuizAbfrageModusAufgeklappt(false)],
      ["reihe",     reihenfolgeContainerRef,     q + alleBereichH + abfrageModusH + reihenfolgeH, () => setQuizReihenfolgeAufgeklappt(false)],
      ["einst",     einstellungenContainerRef,   q + alleBereichH + abfrageModusH + reihenfolgeH + einstellungenH, () => setQuizEinstellungenAufgeklappt(false)],
      ["session",   sessionContainerRef,         q + alleBereichH + abfrageModusH + reihenfolgeH + einstellungenH + sessionH, () => setQuizSessionAufgeklappt(false), quizSessionAufgeklappt],
      ["statListen", statistikListenContainerRef, headerH + slotH,                        () => setStatistikListenAufgeklappt(false)],
      ["statVok",   statistikEinzelauswahlRef,   headerH + slotH + statistikListenHeaderH, () => setStatistikEinzelauswahlAufgeklappt(false)],
      ["info",      infoKontextContainerRef,     infoHeaderRef.current?.getBoundingClientRect().bottom ?? 0, () => setInfoModus("uebersicht"), infoModus !== "uebersicht"],
    ].filter(([, ref, , , offen = true]) => offen && ref.current && ref.current.offsetHeight > 0)
     .map(([key, ref, linie, schliessen]) => ({ key, el: ref.current, linie, schliessen }));
  };
  const haltPruefenRef = useRef(() => {});
  haltPruefenRef.current = () => {
    if (dropdownImmuneRef.current) return;
    const frei = new Set();
    let zurueck = null, hinweis = false;
    for (const k of kontexteRef.current()) {
      const r = k.el.getBoundingClientRect();
      if (r.bottom > window.innerHeight) continue;                 // Ende noch nicht sichtbar
      if (r.bottom > k.linie || zuklappFreiRef.current.has(k.key)) {
        frei.add(k.key);
        if (r.top < k.linie) hinweis = true;                       // langer, gescrollter Bereich
      } else if (zurueck === null) zurueck = r.bottom;             // Schwung zu weit, ohne Freigabe
    }
    if (zurueck !== null) window.scrollBy({ top: zurueck - (window.innerHeight - 96), behavior: "smooth" });
    zuklappFreiRef.current = frei;
    setZuklappHinweis(hinweis);
  };
  function klappeFreieZu() {
    kontexteRef.current().forEach(k => k.schliessen());
    zuklappFreiRef.current = new Set();
    setZuklappHinweis(false);
  }
  useEffect(() => {
    let timer = null;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => haltPruefenRef.current(), 200);
      if (dropdownImmuneRef.current) return;
      kontexteRef.current().forEach(k => {
        if (zuklappFreiRef.current.has(k.key) && k.el.getBoundingClientRect().bottom <= k.linie) k.schliessen();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(timer); window.removeEventListener('scroll', onScroll); };
  }, []);
  // Beim Auf-/Zuklappen neu prüfen (kurze Bereiche sind sofort freigegeben)
  useEffect(() => {
    const t = setTimeout(() => haltPruefenRef.current(), 350);
    return () => clearTimeout(t);
  }, [tab, slotSektionAufgeklappt, listenAuswahlAufgeklappt, quizListeAufgeklappt, quizAbfrageModusAufgeklappt, quizReihenfolgeAufgeklappt,
      quizEinstellungenAufgeklappt, quizSessionAufgeklappt, statistikListenAufgeklappt, statistikEinzelauswahlAufgeklappt, infoModus]);


  // Aufteilen endet, sobald andere Listen oder eine gespeicherte Konfiguration gewählt werden
  useEffect(() => {
    if (aufteilen && (aktiverSlot || quizTabListen.length !== 1 || quizTabListen[0] !== aufteilen.listeId)) setAufteilen(null);
  }, [aufteilen, aktiverSlot, quizTabListen]);

  // Alle/Bereich-Zeile Höhe messen
  useEffect(() => {
    const el = alleBereichRef.current;
    if (!el) { setAlleBereichH(0); return; }
    const obs = new ResizeObserver(() => setAlleBereichH(el.offsetHeight));
    obs.observe(el);
    setAlleBereichH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length]);

  // App-Start: zuletzt gewählte gespeicherte Konfiguration wieder laden (sobald die Listen bekannt sind)
  const letzterSlotGeladenRef = useRef(false);
  useEffect(() => {
    if (letzterSlotGeladenRef.current || listenIndex.length === 0) return;
    letzterSlotGeladenRef.current = true;
    const id = lsGet(SK.letzterSlot);
    if (id && getSlotEintrag('gespeichert', id)) ladeSlot('gespeichert', id);
  }, [listenIndex]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Wechsel der Abfrageart (Übersetzung / Diktat / Akzente) → Session-Fortschritt dieser Art laden
  const quizAbfrageArt = abfrageArtVon(quizModus, quizAntwortTypenGeordnet, quizSpalteModus);
  useEffect(() => {
    if (!aktiverSlot) return;
    const s = lsGet(SK.sessionAktiv);
    if (s && (s.art || "uebersetzung") === quizAbfrageArt && s.slotTyp === aktiverSlot.typ && s.slotId === aktiverSlot.id) return;
    const eintrag = getSlotEintrag(aktiverSlot.typ, aktiverSlot.id);
    if (eintrag) aktiviereSlotFortschritt(eintrag, aktiverSlot.typ, aktiverSlot.id, quizAbfrageArt);
  }, [quizAbfrageArt, aktiverSlot]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Abfrage-Modus-Zeile Höhe messen
  useEffect(() => {
    const el = abfrageModusRef.current;
    if (!el) { setAbfrageModusH(0); return; }
    const obs = new ResizeObserver(() => setAbfrageModusH(el.offsetHeight));
    obs.observe(el);
    setAbfrageModusH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length]);

  // Reihenfolge-Zeile Höhe messen
  useEffect(() => {
    const el = reihenfolgeRef.current;
    if (!el) { setReihenfolgeH(0); return; }
    const obs = new ResizeObserver(() => setReihenfolgeH(el.offsetHeight));
    obs.observe(el);
    setReihenfolgeH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length]);

  // Einstellungen-Zeile Höhe messen
  useEffect(() => {
    const el = einstellungenRef.current;
    if (!el) { setEinstellungenH(0); return; }
    const obs = new ResizeObserver(() => setEinstellungenH(el.offsetHeight));
    obs.observe(el);
    setEinstellungenH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length]);

  // Session-Zeile Höhe messen
  useEffect(() => {
    const el = sessionRef.current;
    if (!el) { setSessionH(0); return; }
    const obs = new ResizeObserver(() => setSessionH(el.offsetHeight));
    obs.observe(el);
    setSessionH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length]);

  // Slot-Sektion Header Höhe messen
  useEffect(() => {
    const el = slotSektionRef.current;
    if (!el) { setSlotH(0); return; }
    const obs = new ResizeObserver(() => setSlotH(el.offsetHeight));
    obs.observe(el);
    setSlotH(el.offsetHeight);
    return () => obs.disconnect();
  }, [slots.verlauf.length, slots.gespeichert.length, tab, statistikVollbild]);

  // Listenauswahl-Header Höhe messen
  useEffect(() => {
    const el = listenauswahlHeaderRef.current;
    if (!el) { setListenauswahlHeaderH(0); return; }
    const obs = new ResizeObserver(() => setListenauswahlHeaderH(el.offsetHeight));
    obs.observe(el);
    setListenauswahlHeaderH(el.offsetHeight);
    return () => obs.disconnect();
  }, [tab, quizTabListen.length]);


  // Von-Bis-Modus beenden wenn Einzelauswahl schließt (manuell oder auto)
  useEffect(() => {
    if (!quizListeAufgeklappt) {
      setQuizVonBisModus(false);
      setQuizVonBisErster(null);
    }
  }, [quizListeAufgeklappt]);

  useEffect(() => {
    if (!statistikEinzelauswahlAufgeklappt) {
      setStatistikVonBisModus(false);
      setStatistikVonBisErster(null);
    }
  }, [statistikEinzelauswahlAufgeklappt]);

  useEffect(() => {
    const el = statistikListenHeaderRef.current;
    if (!el) { setStatistikListenHeaderH(0); return; }
    const update = () => setStatistikListenHeaderH(el.offsetHeight);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, statistikVollbild]);

  useEffect(() => {
    const el = statistikVokauswahlRef.current;
    if (!el) { setStatistikVokauswahlH(0); return; }
    const obs = new ResizeObserver(() => setStatistikVokauswahlH(el.offsetHeight));
    obs.observe(el);
    setStatistikVokauswahlH(el.offsetHeight);
    return () => obs.disconnect();
  }, [tab, statistikVollbild]);


  useEffect(() => {
    // Index-Einträge ohne Sprache einmalig aus der Liste übernehmen
    const idx = lsGet(SK.listenIndex, []);
    if (idx.some(l => !l.sprache || !l.platz)) {
      speichereIndex(idx.map(l => l.sprache ? l : { ...l, sprache: listeSprache(lsGet(SK.liste(l.id))) }));
    } else {
      setListenIndex(idx);
    }
    setEinstellungen(lsGet(SK.einstellungen, defaultEinstellungen()));
    // Neues Slot-Format laden, ggf. vom alten Format migrieren
    let slotsData = lsGet(SK.slots);
    if (!slotsData) {
      const alt = lsGet(SK.sessionSlots) || [];
      const gespeichert = alt
        .filter(s => s.slot !== 6 && s.konfiguration)
        .map(s => ({
          id: neuerSlotId('g'), name: s.name || `Slot ${s.slot}`,
          timestamp: Date.now(), konfiguration: s.konfiguration,
          sessionFortschritt: s.sessionFortschritt || null,
        }));
      const zuletzt = alt.find(s => s.slot === 6 && s.konfiguration);
      const verlauf = zuletzt ? [{
        id: neuerSlotId('v'), name: formatSlotDatum(),
        timestamp: Date.now(), konfiguration: zuletzt.konfiguration,
        sessionFortschritt: null,
      }] : [];
      slotsData = { verlauf, gespeichert };
      lsSet(SK.slots, slotsData);
    }
    // Raster: Einträge ohne Platz einmalig in bisheriger Reihenfolge zeilenweise verteilen
    if (slotsData.gespeichert.some(x => !x.platz)) { slotsData = rasterEinordnen(slotsData); lsSet(SK.slots, slotsData); }
    setSlots(slotsData);
    const sSlot = lsGet(SK.sessionAktiv);
    if (sSlot) {
      setSessionSlotAktiv(sSlot);
      setQuizSessionModus("pakete");
      setQuizPaketGroesse(sSlot.paketGroesse || STANDARD_PAKET_GROESSE);
      if (sSlot.slotTyp && sSlot.slotId) setAktiverSlot({ typ: sSlot.slotTyp, id: sSlot.slotId });
    }
  }, []);

  useEffect(() => {
    if (aktiveListeId) setAktiveListe(lsGet(SK.liste(aktiveListeId)));
  }, [aktiveListeId, ansicht]);

  useEffect(() => {
    if (ansicht === "quiz" && eingabeRef.current) eingabeRef.current.focus();
  }, [ansicht, quiz?.index, quiz?.phase, quiz?.antwortTypIndex]);

  useEffect(() => {
    if (quizTabListen.length === 0) {
      setListenAuswahlAufgeklappt(true);
      setQuizAbfrageModusAufgeklappt(false);
      setQuizReihenfolgeAufgeklappt(false);
      setQuizEinstellungenAufgeklappt(false);
    }
  }, [quizTabListen.length]);

  // Lang-Druck auf einen Raster-Eintrag und dann ziehen (auch außerhalb des Verschieben-Modus):
  // sobald der Finger sich bewegt, Menü/Erklärung weg, Verschieben-Modus an, Eintrag folgt dem Finger
  useEffect(() => {
    const zelleUnter = t => document.elementFromPoint(t.clientX, t.clientY)?.closest("[data-raster-zelle]")?.dataset.rasterZelle || null;
    const bewegen = e => {
      const d = slotZiehenRef.current;
      if (!d?.langdruck) return;
      const t = e.touches[0];
      if (!d.aktiv && Math.hypot(t.clientX - d.x, t.clientY - d.y) > 8) {
        d.aktiv = true;
        clearTimeout(tooltipTimer.current); tooltipShown.current = false; schliesseInfo();
        if (d.art === "liste") { setListenSortModus(true); setListenAuswahlId(null); }
        else { setSlotSortModus(true); setSlotAuswahlId(null); }
        setSlotDragId(d.id);
      }
      if (!d.aktiv) return;
      if (e.cancelable) e.preventDefault();   // Seite nicht scrollen, solange gezogen wird
      setSlotDragZiel(zelleUnter(t));
      if (t.clientY < 90) window.scrollBy(0, -12); else if (t.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    };
    const loslassen = e => {
      const d = slotZiehenRef.current;
      if (!d?.langdruck) return;
      slotZiehenRef.current = null;
      if (!d.aktiv) return;   // nur Lang-Druck: Menü bleibt offen
      slotGezogenRef.current = true; setTimeout(() => { slotGezogenRef.current = false; }, 400);   // nur den Klick direkt danach schlucken
      const t = e.changedTouches[0];
      const ziel = e.type === "touchend" && t ? zelleUnter(t) : null;
      setSlotDragId(null); setSlotDragZiel(null);
      if (ziel) { const [z, sp] = ziel.split("|").map(Number); (d.art === "liste" ? setzeListenPlatz : setzeSlotPlatz)(d.id, { z, s: sp }); }
    };
    window.addEventListener("touchmove", bewegen, { passive: false });
    window.addEventListener("touchend", loslassen);
    window.addEventListener("touchcancel", loslassen);
    return () => {
      window.removeEventListener("touchmove", bewegen);
      window.removeEventListener("touchend", loslassen);
      window.removeEventListener("touchcancel", loslassen);
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Raster verschieben per Ziehen: ab 8 px Bewegung wird gezogen, beim Loslassen auf den Platz darunter
  // (belegt → tauschen). Ohne Bewegung bleibt es ein Antippen (Auswahl) bzw. Lang-Druck (Info).
  useEffect(() => {
    if (!slotSortModus && !listenSortModus) return;
    const zelleUnter = e => document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-raster-zelle]")?.dataset.rasterZelle || null;
    const bewegen = e => {
      const d = slotZiehenRef.current;
      if (!d || d.langdruck) return;   // Lang-Druck-Zug läuft über die Touch-Verfolgung
      if (!d.aktiv && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
        d.aktiv = true; setSlotDragId(d.id); setSlotAuswahlId(null); setListenAuswahlId(null);
        clearTimeout(tooltipTimer.current); schliesseInfo();   // Lang-Druck-Erklärung weg, sobald gezogen wird
      }
      if (!d.aktiv) return;
      setSlotDragZiel(zelleUnter(e));
      if (e.clientY < 90) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    };
    const loslassen = e => {
      const d = slotZiehenRef.current;
      if (d?.langdruck) return;
      slotZiehenRef.current = null;
      if (!d?.aktiv) return;
      slotGezogenRef.current = true; setTimeout(() => { slotGezogenRef.current = false; }, 400);   // nur den Klick direkt danach schlucken
      const ziel = e.type === "pointerup" ? zelleUnter(e) : null;
      setSlotDragId(null); setSlotDragZiel(null);
      if (ziel) { const [z, sp] = ziel.split("|").map(Number); (d.art === "liste" ? setzeListenPlatz : setzeSlotPlatz)(d.id, { z, s: sp }); }
    };
    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", loslassen);
    window.addEventListener("pointercancel", loslassen);
    return () => {
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", loslassen);
      window.removeEventListener("pointercancel", loslassen);
    };
  }, [slotSortModus, listenSortModus]);   // eslint-disable-line react-hooks/exhaustive-deps

  const quizListenKey = quizTabListen.join(",");
  // Spalten-Konfiguration an neu gewählte Listen anpassen: Spalten, die dort fehlen,
  // würden sonst alle Vokabeln ausfiltern (0 abfragbar) und sind im UI nicht abwählbar
  useEffect(() => {
    if (quizTabListen.length === 0) return;
    const kombi = getKombinierteListe(quizTabListen);
    if (!kombi) return;
    const aktiv = t => !!kombi.spalten[t]?.aktiv;
    const abfragbar = TYPEN.filter(t => !t.startsWith('i') && aktiv(t));
    if (quizModus === "diktat" && !aktiv(quizDiktatSpalte)) {
      setQuizDiktatSpalte(abfragbar.find(t => t.startsWith('E')) || abfragbar[0] || "E1");
    }
    const fehlt = [...quizAusgewaehlt, quizFrageTyp, ...quizAntwortTypenGeordnet, ...quizInfoTypenSession].some(t => t && !aktiv(t));
    if (!fehlt) return;
    const ausgewaehlt = quizAusgewaehlt.filter(aktiv);
    const frage = aktiv(quizFrageTyp) ? quizFrageTyp : "";
    const antworten = quizAntwortTypenGeordnet.filter(aktiv);
    const nochGueltig = quizModus === "rotierend" ? ausgewaehlt.length >= 2 : !!frage && antworten.length > 0;
    if (nochGueltig) {
      setQuizAusgewaehlt(ausgewaehlt);
      setQuizFrageTyp(frage);
      setQuizAntwortTypenGeordnet(antworten);
      setQuizInfoTypenSession(p => p.filter(aktiv));
      setQuizSpalteModus(p => Object.fromEntries(Object.entries(p).filter(([t]) => aktiv(t))));
    } else {
      // Standard wie initQuizDefaults (nur Spalten)
      const neuAus = abfragbar.includes('E1') && abfragbar.includes('D1') ? ['E1', 'D1'] : abfragbar.slice(0, 2);
      const neuFrage = neuAus.find(t => t.startsWith('D')) || neuAus[0] || '';
      const neuAntw = neuAus.filter(t => t !== neuFrage);
      setQuizAusgewaehlt(neuAus);
      setQuizFrageTyp(neuFrage);
      setQuizAntwortTypenGeordnet(neuAntw);
      setQuizInfoTypenSession([]);
      setQuizSpalteModus(Object.fromEntries(neuAntw.map(t => [t, 'karte'])));
    }
  }, [quizListenKey, listenIndex]);

  // Nach der Zwischenkarte "Wiederholung" die erste Frage erneut vorlesen
  const quizWiederholungHinweis = quiz?.phase === "wiederholungHinweis";
  useEffect(() => {
    if (ansicht !== "quiz" || !quiz || quiz.phase !== "eingabe" || quiz.flash) return;
    if (quiz.modus === "diktat") {
      const text = quiz.vokabeln?.[quiz.index]?.[quiz.diktatSpalte]?.wert;
      if (text) sprich(text, vokLang(quiz.vokabeln?.[quiz.index], quiz.diktatSpalte));
      return;
    }
    if (!einstellungen.autoplay) return;
    if (!(einstellungen.vorlesen || ["E1"]).includes(quiz.frageTyp)) return;
    const text = quiz.vokabeln?.[quiz.index]?.[quiz.frageTyp]?.wert;
    if (text) sprich(text, vokLang(quiz.vokabeln?.[quiz.index], quiz.frageTyp));
  }, [quiz?.index, quizWiederholungHinweis, ansicht, einstellungen.autoplay]);

  useEffect(() => {
    if (ansicht !== "quiz" || !quiz) return;
    if (quiz.phase === "wiederholungHinweis") {
      const weiter = (e) => { if (e.key === "Enter" || e.key === "w" || e.key === "W") { e.preventDefault(); starteWiederholung(); } };
      document.addEventListener("keydown", weiter);
      return () => document.removeEventListener("keydown", weiter);
    }
    const isDiktatWeiter = quiz.modus === "diktat" && (quiz.phase === "richtig" || quiz.phase === "aufgedeckt");
    const isKarteAufgedeckt = quiz.modus !== "diktat" && quiz.phase === "aufgedeckt" &&
      (quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] || STANDARD_ANTWORT_MODUS) === "karte";
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
  // Listen liegen in einem Raster: neue bekommen den ersten freien Platz (Raster wächst bei Bedarf);
  // die Reihenfolge des Index folgt dem Raster (zeilenweise) und gilt so in der ganzen App
  function speichereIndex(idx, einst = lsGet(SK.einstellungen, defaultEinstellungen())) {
    const groesse = rasterGroesse(einst, "listenRaster");
    const r = ordneRaster(idx, groesse);
    if (r.zeilen !== groesse.zeilen) speichereEinst({ ...einst, listenRaster: { ...groesse, zeilen: r.zeilen } });
    const sortiert = [...r.gespeichert].sort(nachPlatz);
    setListenIndex(sortiert); lsSet(SK.listenIndex, sortiert);
  }
  function setzeListenRasterGroesse(zeilen, spalten) {
    const einst = { ...einstellungen, listenRaster: { zeilen, spalten } };
    speichereEinst(einst);
    speichereIndex(lsGet(SK.listenIndex, []), einst);
  }
  function setzeListenPlatz(id, ziel) {
    speichereIndex(platziereSlot(lsGet(SK.listenIndex, []), id, ziel));
    setListenAuswahlId(null);
  }
  function listenKopieName(name) {
    const namen = new Set(listenIndex.map(l => l.name.toLowerCase()));
    let n = `${name} (Kopie)`, i = 2;
    while (namen.has(n.toLowerCase())) n = `${name} (Kopie ${i++})`;
    return n;
  }
  function speichereEinst(e) { setEinstellungen(e); lsSet(SK.einstellungen, e); }

  // Vor allen frühen Render-Rückgaben berechnen: starteQuiz() nutzt den Wert auch
  // vom Paket-Ende-Bildschirm aus (sonst ReferenceError → Button ohne Wirkung)
  const vokabelgruppeGeaendert = (() => {
    if (!aktiverSlot || aktiverSlot.typ !== 'gespeichert' || !gespeicherteVokabelgruppe) return false;
    const { listenIds, vokabelAuswahl, bereichTyp } = gespeicherteVokabelgruppe;
    if (listenIds.length !== quizTabListen.length) return true;
    if (!listenIds.every(id => quizTabListen.includes(id))) return true;
    if (bereichTyp !== quizBereichTyp) return true;
    const savedAuswahl = new Set(vokabelAuswahl || []);
    if (savedAuswahl.size !== quizCheckboxAuswahl.size) return true;
    for (const id of savedAuswahl) { if (!quizCheckboxAuswahl.has(id)) return true; }
    return false;
  })();

  // ── Sprachen-Filter (global) ──────────────────────────────────────────────
  const vorhandeneSprachen = SPRACHEN.filter(s => listenIndex.some(l => listeSprache(l) === s.code));
  // Gewählte Sprache nur wirksam, solange es Listen dieser Sprache gibt
  const sprachFilter = vorhandeneSprachen.some(s => s.code === einstellungen.sprache) ? einstellungen.sprache : "alle";
  const sichtbareListen = sprachFilter === "alle" ? listenIndex : listenIndex.filter(l => listeSprache(l) === sprachFilter);
  const sichtbareIds = new Set(sichtbareListen.map(l => l.id));
  // Slot ist sichtbar, wenn alle seine (noch vorhandenen) Listen zur gewählten Sprache gehören
  const slotSichtbar = s => {
    if (sprachFilter === "alle") return true;
    const ids = (s.konfiguration?.listenIds || []).filter(id => listenIndex.some(l => l.id === id));
    return ids.length > 0 && ids.every(id => sichtbareIds.has(id));
  };
  // Flagge vor Listennamen nur, wenn "Alle Sprachen" gewählt und mehrere vorhanden
  const listenFlagge = l => sprachFilter === "alle" && vorhandeneSprachen.length > 1 ? sprachInfo(listeSprache(l)).flagge + " " : "";
  const spracheVonListe = id => listeSprache(listenIndex.find(l => l.id === id));
  // Vorlese-Sprache einer Vokabel (Quiz-Vokabeln tragen _listeId)
  const vokLang = (vok, typ) => spalteLang(typ, vok?._listeId ? spracheVonListe(vok._listeId) : listeSprache(aktiveListe));

  function wechsleSprache(code) {
    setSprachMenuOffen(false);
    speichereEinst({ ...einstellungen, sprache: code });
    if (code === "alle") return;
    const passt = id => spracheVonListe(id) === code;
    // Quiz: Auswahl/Konfiguration mit Listen anderer Sprache zurücksetzen
    if (quizTabListen.some(id => !passt(id))) {
      setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotGeaendert(false);
      lsDel(SK.sessionAktiv); setSessionSlotAktiv(null); setQuizSessionModus(STANDARD_SESSION_MODUS); setQuizPaketGroesse(STANDARD_PAKET_GROESSE);
      setQuizTabListen(quizTabListen.filter(passt));
      setQuizBereichTyp("alle"); setQuizCheckboxAuswahl(new Set());
    }
    // Statistik
    if (statistikListenIds && [...statistikListenIds].some(id => !passt(id))) {
      setStatistikAktiverSlot(null);      const rest = [...statistikListenIds].filter(passt);
      setStatistikListenIds(rest.length ? new Set(rest) : null);
      setStatistikBereichTyp("alle"); setStatistikCheckboxAuswahl(new Set());
    } else if (statistikAktiverSlot) {
      setStatistikAktiverSlot(null);    }
    // Listen-Tab: geöffnete Liste anderer Sprache schließen
    if (aktiveListeId && ansicht === "liste-detail" && !passt(aktiveListeId)) {
      setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null);
    }
    setExportAuswahlModus(false); setExportAusgewaehlt(new Set());
  }

  function setzeListenSprache(code) {
    if (!aktiveListe) return;
    const updated = { ...aktiveListe, sprache: code };
    lsSet(SK.liste(aktiveListeId), updated);
    setAktiveListe(updated);
    speichereIndex(listenIndex.map(l => l.id === aktiveListeId ? { ...l, sprache: code } : l));
    // Gefilterte Ansicht folgt der Liste, damit sie nicht verschwindet
    if (sprachFilter !== "alle" && sprachFilter !== code) speichereEinst({ ...einstellungen, sprache: code });
  }
  const vokabelAnzahl = id => { const l = lsGet(SK.liste(id)); return l ? l.vokabeln.length : 0; };

  // ── Listen-Aktionen ───────────────────────────────────────────────────────
  function erstelleListe() {
    const name = modalInput.trim();
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
    const id = "liste_" + Date.now();
    const sprache = sprachFilter === "alle" ? "en" : sprachFilter;
    lsSet(SK.liste(id), { ...neueListeObjekt(id, name), sprache });
    speichereIndex([...listenIndex, { id, name, sprache }]);
    setModal(null); setModalInput(""); setModalFehler("");
  }

  // Umbenennen/Löschen gelten der Liste aus dem Lang-Druck-Menü, sonst der geöffneten Liste
  function umbenennen() {
    const id = listeMenueId || aktiveListeId;
    const name = modalInput.trim();
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
    speichereIndex(listenIndex.map(l => l.id === id ? {...l, name} : l));
    const aktuell = lsGet(SK.liste(id));
    if (aktuell) { const u = {...aktuell, name}; lsSet(SK.liste(id), u); if (id === aktiveListeId) setAktiveListe(u); }
    setModal(null); setModalInput(""); setModalFehler(""); setListeMenueId(null);
  }

  function loeschen() {
    const id = listeMenueId || aktiveListeId;
    localStorage.removeItem(SK.liste(id));
    speichereIndex(listenIndex.filter(l => l.id !== id));
    setModal(null); setListeMenueId(null);
    if (id === aktiveListeId) { setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null); }
  }

  // Lernstand einer Liste zurücksetzen (gewählte Arten): Vokabeln gelten danach als nie abgefragt
  function setzeListeZurueck() {
    const liste = lsGet(SK.liste(listeMenueId));
    if (liste && zuruecksetzenArten.size > 0) {
      const felder = [...zuruecksetzenArten].map(a => SCORE_FELD[a]);
      const neu = { ...liste, vokabeln: liste.vokabeln.map(v => { const w = { ...v }; felder.forEach(f => delete w[f]); return w; }) };
      lsSet(SK.liste(listeMenueId), neu);
      if (listeMenueId === aktiveListeId) setAktiveListe(neu);
      speichereIndex(listenIndex);   // neu zeichnen (Lernfortschritt in der Übersicht)
    }
    setModal(null); setListeMenueId(null);
  }

  // Kopie mit allen Vokabeln und Spalten unter neuem Namen (erster freier Platz im Raster);
  // Lernstände starten neu – die Kopie ist eine eigene Liste mit eigenen Vokabeln
  function dupliziereListe() {
    const quelle = lsGet(SK.liste(listeMenueId));
    const name = modalInput.trim();
    if (!quelle) { setModal(null); return; }
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
    const id = "liste_" + Date.now();
    const sprache = listeSprache(quelle);
    const vokabeln = quelle.vokabeln.map(({ fortschritt, diktatFortschritt, akzentFortschritt, ...v }) => v);   // eslint-disable-line no-unused-vars
    lsSet(SK.liste(id), { ...quelle, id, name, sprache, vokabeln });
    speichereIndex([...listenIndex, { id, name, sprache }]);
    setModal(null); setModalInput(""); setModalFehler(""); setListeMenueId(null);
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
    setListeMenueId(null);
    if (typ === "umbenennen") setModalInput(aktiveListe?.name || "");
    else if (typ === "spalte-umbenennen" && extra) {
      setEditSpalteTyp(extra);
      setModalInput(aktiveListe?.spalten[extra]?.name || "");
    } else if (typ === "slot-speichern") setModalInput(slotNamenVorschlag());
    else setModalInput("");
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
  async function exportiereAusgewaehlteKopierenHandler() {
    if (exportAusgewaehlt.size === 0) return;
    const text = generiereKombiniertenExport([...exportAusgewaehlt]);
    try {
      await navigator.clipboard.writeText(text);
      setExportKopiert(true);
      setTimeout(() => setExportKopiert(false), 2000);
    } catch {}
  }

  // Export-Dateien: Endung immer .txt (nimmt jedes Ziel an), Inhalt steht im Namen: "Name - JSON.txt" / "Name - TXT.txt"
  function exportDateiname(ids, art) {
    const basis = ids.length === 1 ? (listenIndex.find(l => l.id === ids[0])?.name || 'Vokabeln') : `${ids.length} Listen`;
    return `${basis} - ${art}.txt`;
  }
  function teileAlsDatei(text, dateiname) {
    // iPad/iPhone: Downloads aus der Home-Bildschirm-App kommen oft leer an → Teilen-Menü
    // ("In Dateien sichern", Mail, AirDrop). Als .txt/text/plain, damit alle Ziele die Datei annehmen.
    const istIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (istIOS && navigator.share) {
      const file = new File([text], dateiname.replace(/\.json$/, '.txt'), { type: 'text/plain' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        try { navigator.share({ files: [file], title: dateiname.replace(/\.(json|txt)$/, '') }).catch(() => {}); return; }
        catch { /* weiter mit Download */ }
      }
    }
    // Passender Typ, sonst hängen Browser ".txt" an (".json.txt")
    const typ = dateiname.endsWith('.json') ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
    const url = URL.createObjectURL(new Blob([text], { type: typ }));
    const a = document.createElement('a');
    a.href = url; a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Großzügig warten: manche Browser holen den Inhalt erst nach dem Download-Dialog
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function teileListeAlsDateiHandler() {
    if (!aktiveListe) return;
    await teileAlsDatei(generiereExportText(aktiveListe), exportDateiname([aktiveListeId], "TXT"));
  }
  async function exportiereAusgewaehlteAlsDateiHandler() {
    if (exportAusgewaehlt.size === 0) return;
    const ids = [...exportAusgewaehlt];
    await teileAlsDatei(generiereKombiniertenExport(ids), exportDateiname(ids, "TXT"));
  }

  const tabReihenfolge = ["listen", "quiz", "statistik", "einstellungen"];

  // Stand der Statistik-Auswahl beim Betreten (aus dem Quiz übernommen) – zum Erkennen eigener Änderungen
  const statistikStartRef = useRef(null);
  const statistikStandKey = (listenIds, bereich, auswahl, slot) =>
    JSON.stringify([listenIds === null ? null : [...listenIds].sort(), bereich, bereich === "bereich" ? [...auswahl].sort() : [], slot ? `${slot.typ}|${slot.id}` : null]);

  function handleTabWechsel(neuerTab) {
    if (neuerTab === "statistik" && tab !== "statistik") {
      const listenIds = quizTabListen.length > 0 ? new Set(quizTabListen) : null;
      statistikStartRef.current = statistikStandKey(listenIds, quizBereichTyp, quizCheckboxAuswahl, aktiverSlot);
    }
    if (neuerTab === "statistik") {
      setStatistikListenIds(quizTabListen.length > 0 ? new Set(quizTabListen) : null);
      setStatistikBereichTyp(quizBereichTyp);
      setStatistikCheckboxAuswahl(new Set(quizCheckboxAuswahl));
      setStatistikListenAufgeklappt(false);
      setStatistikEinzelauswahlAufgeklappt(false);
      setStatistikAktiverSlot(aktiverSlot);
      setStatistikSlotGeleert(false);
    }
    // Statistik → Quiz: nur was in der Statistik geändert wurde, ins Quiz übernehmen
    if (neuerTab === "quiz" && tab === "statistik"
        && statistikStandKey(statistikListenIds, statistikBereichTyp, statistikCheckboxAuswahl, statistikAktiverSlot) !== statistikStartRef.current) {
      const s = statistikAktiverSlot;
      if (s && getSlotEintrag(s.typ, s.id)) {
        if (!(aktiverSlot?.typ === s.typ && aktiverSlot?.id === s.id)) ladeSlot(s.typ, s.id);
      } else {
        // keine Konfiguration mehr ("Neu" oder Liste geändert) → im Quiz lösen, Session ebenfalls
        // (ihr Fortschritt bleibt im gespeicherten Eintrag); Listen-/Vokabelauswahl übernehmen
        if (aktiverSlot) { setAktiverSlot(null); setGespeicherteVokabelgruppe(null); lsDel(SK.letzterSlot); lsDel(SK.sessionAktiv); setSessionSlotAktiv(null); }
        setQuizTabListen(statistikListenIds === null ? sichtbareListen.map(l => l.id) : [...statistikListenIds]);
        setQuizBereichTyp(statistikBereichTyp);
        setQuizCheckboxAuswahl(new Set(statistikBereichTyp === "bereich" ? statistikCheckboxAuswahl : []));
      }
    }
    if (neuerTab === "listen") setAnsicht("uebersicht");
    setTab(neuerTab);
    setExportAuswahlModus(false);
    setExportAusgewaehlt(new Set());
    setStatistikVollbild(false);
  }

  // Statistik: Quiz direkt mit den Vokabeln einer Gruppe (z. B. Negativ) starten.
  // Quiz-Tab wird darauf eingestellt (Bereich = diese Vokabeln, ohne Score-Grenze, Gelernte erlaubt,
  // ohne Session-Pakete, gespeicherte Konfiguration gelöst); Spalten/Abfrage-Modus bleiben wie im Quiz-Tab.
  // Passt die Gruppe zur Quiz-Auswahl (gleiche Abfrageart, Listen enthalten), läuft eine einmalige Runde,
  // die Auswahl, Konfiguration und Session unberührt lässt – sonst wird der Quiz-Tab umgestellt.
  function gruppenQuizPasst(g) {
    const listen = quizTabListen.length > 0 ? quizTabListen : (aktiveListeId ? [aktiveListeId] : []);
    return g.art === quizAbfrageArt && g.listenIds.every(id => listen.includes(id));
  }
  function starteGruppenQuiz(g) {
    setGruppenQuiz(null);
    if (gruppenQuizPasst(g)) {
      setStatistikVollbild(false);
      setTab("quiz");
      starteQuiz(true, null, new Set(g.ids));
      return;
    }
    setSessionUeberschreibenModal(false);
    setGruppenAenderungsDialog(false);
    setAktiverSlot(null);
    setSlotGeaendert(false);
    setGespeicherteVokabelgruppe(null);
    lsDel(SK.letzterSlot);
    lsDel(SK.sessionAktiv);
    setSessionSlotAktiv(null);
    setQuizSessionModus("alle");
    setQuizTabListen(g.listenIds);
    setQuizBereichTyp("bereich");
    setQuizCheckboxAuswahl(new Set(g.ids));
    setQuizReihenfolge("schlechteste");
    setQuizSchlechtesteMaxScore("");
    setQuizGelerntEinschliessen(true);
    if (g.art === "diktat") setQuizModus("diktat");
    else if (quizModus === "diktat") setQuizModus("sequenziell");
    setSlotSektionAufgeklappt(false);
    setQuiz(null);
    setStatistikVollbild(false);
    setTab("quiz");
    gruppenQuizStartRef.current = 2;   // erst nach dem Angleichen der Spalten an die Listen starten
    setGruppenQuizTick(t => t + 1);
  }
  const [gruppenQuizTick, setGruppenQuizTick] = useState(0);
  useEffect(() => {
    if (gruppenQuizStartRef.current === 0 || tab !== "quiz") return;
    if (--gruppenQuizStartRef.current > 0) { setGruppenQuizTick(t => t + 1); return; }
    starteQuiz(true);
    setQuiz(q => q && { ...q, ausStatistik: true });
  }, [gruppenQuizTick]);

  function toggleStatistikListe(id) {
    if (statistikAktiverSlot) { setStatistikAktiverSlot(null); setStatistikSlotGeleert(true); }
    setStatistikListenIds(prev => {
      const currentSet = prev === null
        ? new Set(sichtbareListen.map(l => l.id))
        : new Set(prev);
      if (currentSet.has(id)) {
        currentSet.delete(id);
        // Bereinige Vokabelauswahl wenn Liste abgewählt
        if (statistikBereichTyp === "bereich" && statistikCheckboxAuswahl.size > 0) {
          const neueListen = [...currentSet];
          const bereinigte = new Set([...statistikCheckboxAuswahl].filter(vokId =>
            neueListen.some(lId => vokId.startsWith(`${lId}__`))
          ));
          if (bereinigte.size === 0) {
            setStatistikBereichTyp("alle");
            setStatistikCheckboxAuswahl(new Set());
          } else {
            setStatistikCheckboxAuswahl(bereinigte);
          }
        }
      } else {
        currentSet.add(id);
        if (currentSet.size === sichtbareListen.length) return null;
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
    const VALID = new Set(TYPEN);
    const mapping = {};
    const used = new Set();
    // Pass 1: extract [TYPE] tags from header names (reliable, from our own export)
    headerNamen.forEach((name, idx) => {
      const m = name.match(/\[([EDi][123])\]\s*$/);
      if (m && VALID.has(m[1]) && !used.has(m[1])) {
        mapping[idx] = m[1];
        used.add(m[1]);
      } else {
        mapping[idx] = null;
      }
    });
    // Pass 2 (fallback for files without tags): keyword detection
    if (used.size === 0) {
      const eKeys = SPRACHEN.flatMap(s => s.keys);
      const dKeys = ['deutsch', 'german'];
      let eCount = 0, dCount = 0, iCount = 0;
      headerNamen.forEach((name, idx) => {
        const low = name.toLowerCase().trim();
        if (eKeys.some(k => low.includes(k)) && eCount < 3) mapping[idx] = ['E1','E2','E3'][eCount++];
        else if (dKeys.some(k => low.includes(k)) && dCount < 2) mapping[idx] = ['D1','D2'][dCount++];
        else if (iCount < 2) mapping[idx] = ['i1','i2'][iCount++];
      });
      if (eCount === 0 && dCount === 0) {
        const pos = ['E1','D1','i1','E2','D2','i2','E3'];
        headerNamen.forEach((_, idx) => { mapping[idx] = pos[idx] ?? null; });
      }
    }
    return mapping;
  }

  function analysiereImport() {
    const normiert = importText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Eingefügtes JSON-Backup (z. B. aus der Zwischenablage) direkt als Backup übernehmen
    try {
      const listen = findeJsonListen(normiert);
      if (listen) {
        if (!listen.length) { setImportFehler("Keine Vokabellisten im JSON gefunden."); return; }
        setImportJsonData(listen); setImportText(""); setImportFehler(""); return;
      }
    } catch { setImportFehler(`JSON-Backup ist beschädigt. Anfang: ${dateiVorschau(normiert)}`); return; }
    const alleZeilen = normiert.trim().split('\n').filter(z => z.trim());
    if (alleZeilen.length < 2) {
      setImportFehler(`Nur ${alleZeilen.length} Zeile${alleZeilen.length === 1 ? "" : "n"} erkannt – nötig sind eine Kopfzeile und mindestens eine Vokabel. Anfang: ${dateiVorschau(normiert)}. Dateien bitte über „📄 Datei“ laden.`);
      return;
    }

    // Namenszeile "# Name {fr}" (eigener TXT-Export) → Sprache
    const parseNamensZeile = z => {
      const m = z.slice(2).trim().match(/^(.*?)\s*\{([a-z]{2})\}$/);
      return m && SPRACHEN.some(s => s.code === m[2]) ? { name: m[1], sprache: m[2] } : { name: z.slice(2).trim(), sprache: null };
    };
    const standardSprache = sprachFilter === "alle" ? "en" : sprachFilter;

    const hashIdx = alleZeilen.reduce((acc, z, i) => z.startsWith('# ') ? [...acc, i] : acc, []);
    if (hashIdx.length > 1) {
      const sektionen = hashIdx.map((startIdx, si) => {
        const endIdx = hashIdx[si + 1] ?? alleZeilen.length;
        const sz = alleZeilen.slice(startIdx, endIdx);
        const { name, sprache } = parseNamensZeile(sz[0]);
        const rest = sz.slice(1);
        if (rest.length < 2) return null;
        const header = parseKopfZeile(rest[0]);
        const daten = rest.slice(1).map(parseZeile);
        const mapping = autoMappeKolumnen(header.map(h => h.wert));
        return { name, header, daten, mapping, sprache: sprache || erkenneSprache(header.map(h => h.wert)) };
      }).filter(Boolean);
      if (!sektionen.length) { setImportFehler("Keine gültigen Listen gefunden."); return; }
      setImportSprache(standardSprache);
      setImportMehrfachListen(sektionen);
      setImportParsed(null);
      setImportFehler("");
      return;
    }

    setImportMehrfachListen(null);
    let zeilen = alleZeilen;
    let erkannterName = '';
    let erkannteSprache = null;
    if (zeilen[0].startsWith('# ')) {
      ({ name: erkannterName, sprache: erkannteSprache } = parseNamensZeile(zeilen[0]));
      zeilen = zeilen.slice(1);
      if (zeilen.length < 2) { setImportFehler("Mindestens 2 Zeilen erforderlich."); return; }
    }
    const header = parseKopfZeile(zeilen[0]);
    setImportSprache(erkannteSprache || erkenneSprache(header.map(h => h.wert)) || standardSprache);
    const daten = zeilen.slice(1).map(parseZeile);
    // Mit Spalten-Kennungen (eigener Export) direkt zuordnen, sonst manuell
    const hatTags = header.some(h => SPALTEN_TAG.test(h.wert));
    const mapping = hatTags ? autoMappeKolumnen(header.map(h => h.wert)) : {};
    if (!hatTags) header.forEach((_, i) => { mapping[i] = null; });
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
      liste.sprache = s.sprache || importSprache;
      s.header.forEach((h, i) => {
        const typ = s.mapping[i];
        if (typ) liste.spalten[typ] = { name: h.wert.replace(/\s*\[[EDi][123]\]\s*$/, '').trim(), aktiv: true };
      });
      s.daten.forEach(zeile => {
        const vok = { id: liste.naechste_id++ };
        Object.entries(s.mapping).forEach(([idx, typ]) => {
          if (typ && zeile[Number(idx)]) vok[typ] = { wert: zeile[Number(idx)].wert, falsch: zeile[Number(idx)].falsch };
        });
        liste.vokabeln.push(vok);
      });
      lsSet(SK.liste(id), liste);
      neuerIndex.push({ id, name: liste.name, sprache: liste.sprache });
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
      const liste = ergaenzeSpalten({ ...l, id, sprache: listeSprache(l) });
      lsSet(SK.liste(id), liste);
      neuerIndex.push({ id, name: liste.name, sprache: liste.sprache });
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
        if (!jsonExportOptionen.akzentFortschritt) delete v.akzentFortschritt;
        return v;
      });
      return l;
    });
    const text = JSON.stringify(gefiltert, null, 2);
    const name = exportDateiname(jsonExportIds, "JSON");
    setModal(null); setJsonExportIds(null);
    teileAlsDatei(text, name);
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
          liste.spalten[typ] = { name: importParsed.header[Number(idx)].wert.replace(/\s*\[[EDi][123]\]\s*$/, '').trim(), aktiv: true };
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
      const liste = { ...neueListeObjekt(id, name), sprache: importSprache };
      aktualisiereSpaltennamen(liste);
      bauVokabeln(liste);
      lsSet(SK.liste(id), liste);
      speichereIndex([...listenIndex, { id, name, sprache: importSprache }]);
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
        setQuizAntwortTypenGeordnet(p => nachSpaltenReihenfolge([...p, typ]));
        setQuizSpalteModus(p => ({...p, [typ]: p[typ] || STANDARD_ANTWORT_MODUS}));
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

  // ── Slot-Hilfsfunktionen ──────────────────────────────────────────────────

  function getSlotsData() { return lsGet(SK.slots, defaultSlots()); }

  function setSlotsData(data) { lsSet(SK.slots, data); setSlots(data); }

  // Raster: Plätze vergeben und bei Bedarf Zeilen anhängen (Einstellung wird mitgespeichert)
  function rasterEinordnen(data, einst = lsGet(SK.einstellungen, defaultEinstellungen())) {
    const groesse = rasterGroesse(einst);
    const r = ordneRaster(data.gespeichert, groesse);
    if (r.zeilen !== groesse.zeilen) speichereEinst({ ...einst, slotRaster: { ...groesse, zeilen: r.zeilen } });
    return { ...data, gespeichert: r.gespeichert };
  }
  // Rastergröße ändern: Einträge außerhalb rücken auf freie Plätze; reicht der Platz nicht,
  // bleiben so viele Zeilen wie nötig (kleiner geht dann nicht)
  function setzeRasterGroesse(zeilen, spalten) {
    const einst = { ...einstellungen, slotRaster: { zeilen, spalten } };
    speichereEinst(einst);
    setSlotsData(rasterEinordnen(getSlotsData(), einst));
  }
  function setzeSlotPlatz(id, ziel) {
    const data = rasterEinordnen(getSlotsData());
    setSlotsData({ ...data, gespeichert: platziereSlot(data.gespeichert, id, ziel) });
    setSlotAuswahlId(null);
  }

  function getSlotEintrag(typ, id) {
    const data = getSlotsData();
    return data[typ]?.find(s => s.id === id) || null;
  }

  function aktuelleKonfiguration(mitVokabeln = true) {
    return {
      ...(mitVokabeln ? {
        listenIds: [...quizTabListen],
        vokabelAuswahl: Array.from(quizCheckboxAuswahl),
        bereichTyp: quizBereichTyp,
      } : {}),
      quizAusgewaehlt, quizFrageTyp, quizAntwortTypenGeordnet,
      quizInfoTypenSession, quizSpalteModus, quizZeigeInfo,
      quizModus, quizBereichTyp,
      quizReihenfolge, quizSchlechtesteMaxScore, quizUnbeantwortetZuerst,
      quizDiktatSpalte, quizDiktatUebersetzung,
    };
  }

  function applyKonfiguration(k) {
    if (!k) return;
    if (k.listenIds && k.listenIds.length > 0) {
      const alleVorhanden = k.listenIds.every(id => listenIndex.some(l => l.id === id));
      if (alleVorhanden) {
        setQuizTabListen(k.listenIds);
        setQuizCheckboxAuswahl(k.vokabelAuswahl && k.vokabelAuswahl.length > 0 ? new Set(k.vokabelAuswahl) : new Set());
      } else {
        setQuizBereichTyp("alle");
        setQuizCheckboxAuswahl(new Set());
      }
    }
    setQuizAusgewaehlt(k.quizAusgewaehlt || []);
    setQuizFrageTyp(k.quizFrageTyp || "");
    setQuizAntwortTypenGeordnet(k.quizAntwortTypenGeordnet || []);
    setQuizInfoTypenSession(k.quizInfoTypenSession || []);
    setQuizSpalteModus(k.quizSpalteModus || {});
    setQuizZeigeInfo(k.quizZeigeInfo || {});
    setQuizModus(k.quizModus || "sequenziell");
    setQuizBereichTyp(k.quizBereichTyp || "alle");
    setQuizReihenfolge(k.quizReihenfolge || "zufall");
    setQuizSchlechtesteMaxScore(k.quizSchlechtesteMaxScore ?? "");
    const ubz = k.quizUnbeantwortetZuerst;
    setQuizUnbeantwortetZuerst(ubz != null && typeof ubz === "object" ? ubz : { zufall: !!ubz, schlechteste: false, listennr: !!ubz });
    setQuizDiktatSpalte(k.quizDiktatSpalte || "E1");
    setQuizDiktatUebersetzung(k.quizDiktatUebersetzung !== undefined ? k.quizDiktatUebersetzung : "D1");
  }

  function ladeSlot(typ, id) {
    const eintrag = getSlotEintrag(typ, id);
    if (!eintrag || !eintrag.konfiguration) return;
    applyKonfiguration(eintrag.konfiguration);
    if (typ === 'gespeichert') {
      setGespeicherteVokabelgruppe({ listenIds: eintrag.konfiguration.listenIds || [], vokabelAuswahl: eintrag.konfiguration.vokabelAuswahl || [], bereichTyp: eintrag.konfiguration.bereichTyp || "alle" });
    } else {
      setGespeicherteVokabelgruppe(null);
    }
    setListenAuswahlAufgeklappt(false);
    setQuizListeAufgeklappt(false);
    setQuizAbfrageModusAufgeklappt(false);
    setQuizReihenfolgeAufgeklappt(false);
    setQuizEinstellungenAufgeklappt(false);
    setQuizSessionAufgeklappt(false);
    setAktiverSlot({ typ, id });
    setSlotGeaendert(false);
    if (typ === 'gespeichert') lsSet(SK.letzterSlot, id); else lsDel(SK.letzterSlot);
    setSlotSektionAufgeklappt(false);   // nach der Auswahl nur noch die Kopfzeile zeigen
    aktiviereSlotFortschritt(eintrag, typ, id, slotKonfigArt(eintrag));
  }

  // Session-Fortschritt der Abfrageart aus dem Slot-Eintrag aktivieren (oder keine Session, wenn es keinen gibt)
  function aktiviereSlotFortschritt(eintrag, typ, id, art) {
    const sf = slotSFAlle(eintrag)[art];
    if (sf) {
      const k = eintrag.konfiguration || {};
      const sessionObj = { slotTyp: typ, slotId: id, art, listenIds: k.listenIds || [], vokabelAuswahl: k.vokabelAuswahl || [], bereichTyp: k.bereichTyp || "alle", abgefragt: sf.abgefragt || [], gesamt: sf.gesamt || 0, paketGroesse: sf.paketGroesse || STANDARD_PAKET_GROESSE, startScores: sf.startScores || {} };
      lsSet(SK.sessionAktiv, sessionObj);
      setSessionSlotAktiv(sessionObj);
      setQuizSessionModus("pakete");
      setQuizPaketGroesse(sf.paketGroesse || STANDARD_PAKET_GROESSE);
    } else {
      lsDel(SK.sessionAktiv);
      setSessionSlotAktiv(null);
    }
  }

  function ladeSlotStatistik(typ, id) {
    const eintrag = getSlotEintrag(typ, id);
    if (!eintrag || !eintrag.konfiguration) return;
    const k = eintrag.konfiguration;
    setStatistikListenIds(k.listenIds?.length > 0 ? new Set(k.listenIds) : null);
    setStatistikBereichTyp(k.bereichTyp || "alle");
    setStatistikCheckboxAuswahl(new Set(k.vokabelAuswahl || []));
    setStatistikListenAufgeklappt(false);
    setStatistikEinzelauswahlAufgeklappt(false);
    setStatistikAktiverSlot({ typ, id });
    setStatistikSlotGeleert(false);
    setSlotSektionAufgeklappt(false);   // nach der Auswahl nur noch die Kopfzeile zeigen (wie im Quiz)
  }

  // Abfrage ohne Pakete im Verlauf festhalten (mit Start-Scores für die Statistik).
  // Gespeicherte Konfiguration oder unveränderter Verlauf-Eintrag → kein neuer Eintrag.
  function merkeRundeImVerlauf(effSlot, startScores) {
    if (effSlot?.typ === 'gespeichert') return;
    if (effSlot?.typ === 'verlauf') {
      const e = getSlotEintrag('verlauf', effSlot.id);
      if (e && JSON.stringify(e.konfiguration) === JSON.stringify(aktuelleKonfiguration())) {
        const data = getSlotsData();
        setSlotsData({ ...data, verlauf: [{ ...e, timestamp: Date.now(), startScores }, ...data.verlauf.filter(v => v.id !== e.id)] });
        return;
      }
    }
    erstelleVerlaufEintrag({ startScores });
  }

  function erstelleVerlaufEintrag(extra = {}) {
    const id = neuerSlotId('v');
    const neuerEintrag = { id, name: formatSlotDatum(), timestamp: Date.now(), konfiguration: aktuelleKonfiguration(), sessionFortschritt: null, ...extra };
    const data = getSlotsData();
    const neuerVerlauf = [neuerEintrag, ...data.verlauf].slice(0, 5);
    const updated = { ...data, verlauf: neuerVerlauf };
    setSlotsData(updated);
    setAktiverSlot({ typ: 'verlauf', id });
    setSlotGeaendert(false);
    return id;
  }

  function speichereAlsGespeichert(id, name) {
    const data = getSlotsData();
    const konfiguration = aktuelleKonfiguration();
    let updated;
    if (id) {
      updated = { ...data, gespeichert: data.gespeichert.map(s => s.id === id ? { ...s, name, konfiguration } : s) };
    } else {
      const newId = neuerSlotId('g');
      const neuerEintrag = { id: newId, name, timestamp: Date.now(), konfiguration, sessionFortschritt: null };
      // bestehende Plätze festhalten, der neue Eintrag kommt auf den ersten freien Platz (Raster wächst automatisch)
      updated = rasterEinordnen({ ...data, gespeichert: [...rasterEinordnen(data).gespeichert, neuerEintrag] });
      id = newId;
    }
    setSlotsData(updated);
    setAktiverSlot({ typ: 'gespeichert', id });
    lsSet(SK.letzterSlot, id);
    setSlotGeaendert(false);
    setGespeicherteVokabelgruppe({ listenIds: [...quizTabListen], vokabelAuswahl: Array.from(quizCheckboxAuswahl), bereichTyp: quizBereichTyp });
  }

  // ── Liste in Sessions aufteilen: Quiz-Tab mit dieser Liste, alle Einstellungen wie gewohnt,
  // dann je Gruppe eine gespeicherte Konfiguration „Name (21 - 40)“ ──
  function starteAufteilen(listeId) {
    const liste = lsGet(SK.liste(listeId));
    if (!liste) return;
    setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotGeaendert(false); lsDel(SK.letzterSlot);
    setQuizTabListen([listeId]);
    setQuizBereichTyp("alle"); setQuizCheckboxAuswahl(new Set()); setQuizListeAufgeklappt(false);
    setQuizVonBisModus(false); setQuizVonBisErster(null);
    setSlotSektionAufgeklappt(false); setListenAuswahlAufgeklappt(false);
    setAufteilen({ listeId, name: liste.name, groesse: 20, von: 1, bis: liste.vokabeln.length, restAnhaengen: false });
    setTab("quiz");
    window.scrollTo(0, 0);
  }
  function aufteilenStand(a = aufteilen) {
    const liste = a && lsGet(SK.liste(a.listeId));
    if (!liste) return null;
    const anzahl = liste.vokabeln.length;
    const gruppen = aufteilenGruppen(anzahl, a.von || 1, a.bis || anzahl, a.groesse, a.restAnhaengen);
    const vorhanden = new Set(slots.gespeichert.map(x => x.name));
    const basis = (a.name || "").trim() || liste.name;
    return { liste, anzahl, gruppen: gruppen.map(([v, b]) => {
      const name = `${basis} (${v} - ${b})`;
      return { von: v, bis: b, name, vorhanden: vorhanden.has(name) };
    }) };
  }
  function legeAufteilenAn() {
    const stand = aufteilenStand();
    if (!stand) return;
    const neu = stand.gruppen.filter(g => !g.vorhanden);
    const einst = lsGet(SK.einstellungen, defaultEinstellungen());
    const groesse = rasterGroesse(einst);
    const data = rasterEinordnen(getSlotsData(), einst);
    // zusammenhängend ab der nächsten freien Zeile, Raster wächst bei Bedarf
    const ab = data.gespeichert.reduce((m, x) => Math.max(m, x.platz.z + 1), 0);
    const zeilen = Math.max(groesse.zeilen, ab + Math.ceil(neu.length / groesse.spalten));
    const einstNeu = zeilen !== groesse.zeilen ? { ...einst, slotRaster: { ...groesse, zeilen } } : einst;
    if (einstNeu !== einst) speichereEinst(einstNeu);
    const basisKonfig = aktuelleKonfiguration(false);
    const eintraege = neu.map((g, i) => ({
      id: neuerSlotId('g'), name: g.name, timestamp: Date.now() + i, sessionFortschritt: null,
      platz: { z: ab + Math.floor(i / groesse.spalten), s: i % groesse.spalten },
      konfiguration: { ...basisKonfig, listenIds: [aufteilen.listeId], bereichTyp: "bereich", quizBereichTyp: "bereich",
        vokabelAuswahl: stand.liste.vokabeln.slice(g.von - 1, g.bis).map(v => `${aufteilen.listeId}__${v.id}`) },
    }));
    setSlotsData(rasterEinordnen({ ...data, gespeichert: [...data.gespeichert, ...eintraege] }, einstNeu));
    setAufteilen(null);
    setSlotSektionAufgeklappt(true);
    window.scrollTo(0, 0);
  }

  // Kopie einer gespeicherten Konfiguration unter neuem Namen: gleiche Einstellungen,
  // eigener (leerer) Session-Fortschritt, erster freier Platz im Raster
  function dupliziereSlot(id, name) {
    const data = getSlotsData();
    const quelle = data.gespeichert.find(x => x.id === id);
    if (!quelle) return;
    const kopie = { id: neuerSlotId('g'), name, timestamp: Date.now(), konfiguration: JSON.parse(JSON.stringify(quelle.konfiguration)), sessionFortschritt: null };
    setSlotsData(rasterEinordnen({ ...data, gespeichert: [...rasterEinordnen(data).gespeichert, kopie] }));
  }
  // freier Name "Name (Kopie)", "Name (Kopie 2)" …
  function kopieName(name) {
    const namen = new Set(slots.gespeichert.map(x => x.name));
    let n = `${name} (Kopie)`, i = 2;
    while (namen.has(n)) n = `${name} (Kopie ${i++})`;
    return n;
  }

  function benenneSlotUm(id, name) {
    const data = getSlotsData();
    setSlotsData({ ...data, gespeichert: data.gespeichert.map(x => x.id === id ? { ...x, name } : x) });
  }

  function loescheSlotEintrag(typ, id) {
    const data = getSlotsData();
    const updated = { ...data, [typ]: data[typ].filter(s => s.id !== id) };
    setSlotsData(updated);
    if (lsGet(SK.letzterSlot) === id) lsDel(SK.letzterSlot);
    if (aktiverSlot?.typ === typ && aktiverSlot?.id === id) {
      setAktiverSlot(null);
      setSlotGeaendert(false);
      lsDel(SK.sessionAktiv);
      setSessionSlotAktiv(null);
    }
    setLoescheSlotNr(null);
  }

  // Session-Fortschritt je Abfrageart (Übersetzung / Diktat / Akzente) getrennt im Slot-Eintrag
  function updateSlotSF(typ, id, sf, art) {
    const data = getSlotsData();
    const updated = { ...data, [typ]: data[typ].map(s => {
      if (s.id !== id) return s;
      const alle = { ...slotSFAlle(s) };
      if (sf) alle[art] = sf; else delete alle[art];
      const { sessionFortschritt: _alt, ...rest } = s;   // altes Einzel-Format ablösen
      return { ...rest, sessionFortschritte: alle };
    }) };
    setSlotsData(updated);
  }

  function sessionSlotKonflikt() {
    const slot = lsGet(SK.sessionAktiv);
    if (!slot) return false;
    if ((slot.art || "uebersetzung") !== quizAbfrageArt) return true;
    const isSameSlot = aktiverSlot && slot.slotTyp === aktiverSlot.typ && slot.slotId === aktiverSlot.id;
    if (!isSameSlot) return false;
    const slotListenIds = slot.listenIds || [];
    const slotVokAuswahl = new Set(slot.vokabelAuswahl || []);
    if (slotListenIds.length !== quizTabListen.length) return true;
    if (!slotListenIds.every(id => quizTabListen.includes(id))) return true;
    if (slotVokAuswahl.size !== quizCheckboxAuswahl.size) return true;
    for (const id of slotVokAuswahl) { if (!quizCheckboxAuswahl.has(id)) return true; }
    return false;
  }

  function speichereSessionSlotNeu(paketGroesse, gesamtVoks, startScores = {}, forceTyp, forceId) {
    const slotTyp = forceTyp ?? aktiverSlot?.typ ?? null;
    const slotId = forceId ?? aktiverSlot?.id ?? null;
    const art = quizAbfrageArt;
    const sessionObj = { slotTyp, slotId, art, listenIds: [...quizTabListen], vokabelAuswahl: Array.from(quizCheckboxAuswahl), bereichTyp: quizBereichTyp, abgefragt: [], gesamt: gesamtVoks, paketGroesse, startScores };
    lsSet(SK.sessionAktiv, sessionObj);
    setSessionSlotAktiv(sessionObj);
    if (slotTyp && slotId) {
      updateSlotSF(slotTyp, slotId, { abgefragt: [], gesamt: gesamtVoks, paketGroesse, startScores }, art);
    }
    return sessionObj;
  }

  function updateSessionSlotFortschritt(neueIds, isDurchlaufEnde) {
    const slot = lsGet(SK.sessionAktiv);
    if (!slot) return;
    const neuAbgefragt = isDurchlaufEnde ? [] : [...new Set([...(slot.abgefragt || []), ...neueIds])];
    const updated = { ...slot, abgefragt: neuAbgefragt };
    lsSet(SK.sessionAktiv, updated);
    setSessionSlotAktiv(updated);
    const { slotTyp, slotId } = slot;
    if (slotTyp && slotId) {
      updateSlotSF(slotTyp, slotId, { abgefragt: neuAbgefragt, gesamt: updated.gesamt, paketGroesse: updated.paketGroesse, startScores: updated.startScores }, slot.art || "uebersetzung");
    }
  }

  // Löscht nur den Fortschritt der aktuellen Abfrageart; die anderen Arten bleiben im Slot erhalten
  function loescheSessionSlot() {
    const sSlot = lsGet(SK.sessionAktiv);
    const { slotTyp, slotId } = sSlot || {};
    lsDel(SK.sessionAktiv);
    setSessionSlotAktiv(null);
    if (slotTyp && slotId) updateSlotSF(slotTyp, slotId, null, sSlot.art || "uebersetzung");
  }

  // "Neu": komplett neu beginnen – Session, Listen-/Vokabelauswahl und alle Abfrage-Einstellungen
  function neueQuizKonfiguration() {
    setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotGeaendert(false);
    lsDel(SK.letzterSlot);
    lsDel(SK.sessionAktiv); setSessionSlotAktiv(null); setQuizSessionModus(STANDARD_SESSION_MODUS); setQuizPaketGroesse(STANDARD_PAKET_GROESSE);
    setQuizTabListen([]);
    // Spalten wie beim App-Start; passen sich bei der Listenauswahl automatisch an
    setQuizAusgewaehlt(["D1", "E1"]); setQuizFrageTyp("D1"); setQuizAntwortTypenGeordnet(["E1"]);
    setQuizInfoTypenSession([]); setQuizSpalteModus({ E1: "karte" }); setQuizZeigeInfo({ i1: true, i2: true });
    setQuizDiktatSpalte("E1");
    setzeQuizEinstellungenZurueck();
    setSlotSektionAufgeklappt(false);
    setListenAuswahlAufgeklappt(true);
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
    setzeQuizEinstellungenZurueck();
  }

  // Abfrage-Einstellungen ohne Spalten auf Standard (Quiz-Start aus Liste, "Neu")
  function setzeQuizEinstellungenZurueck() {
    setQuizModus('sequenziell');
    setQuizBereichTyp('alle');
    setQuizReihenfolge(STANDARD_REIHENFOLGE);
    setQuizSchlechtesteMaxScore(STANDARD_MAX_SCORE);
    setQuizUnbeantwortetZuerst(STANDARD_UNBEANTWORTET_ZUERST);
    setQuizCheckboxAuswahl(new Set());
    setQuizListeAufgeklappt(false);
    setQuizVonBisModus(false);
    setQuizVonBisErster(null);
    setAbfrageZielModus(STANDARD_ABFRAGE_ZIEL);
    setAbfrageZielAnzahl(1);
    setAbfrageZielWiederholung(1);
    setAbfrageZielScore(0);
    setAbfrageZielScoreTyp("global");
    setQuizGelerntEinschliessen(false);
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
    setQuizTabListen(prev => {
      const neueListen = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0) {
        const bereinigte = new Set([...quizCheckboxAuswahl].filter(vokId =>
          neueListen.some(lId => vokId.startsWith(`${lId}__`))
        ));
        if (bereinigte.size === 0) {
          setQuizBereichTyp("alle");
          setQuizCheckboxAuswahl(new Set());
        } else {
          setQuizCheckboxAuswahl(bereinigte);
        }
      }
      return neueListen;
    });
  }

  function toggleListenAuswahl() {
    const opening = !listenAuswahlAufgeklappt;
    setListenAuswahlAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = listenContainerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < headerH + slotH + listenauswahlHeaderH) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - headerH - slotH - listenauswahlHeaderH), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

  function toggleReihenfolge() {
    const opening = !quizReihenfolgeAufgeklappt;
    setQuizReihenfolgeAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = reihenfolgeContainerRef.current;
        if (!el) return;
        const target = headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH + reihenfolgeH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

  function toggleEinstellungen() {
    const opening = !quizEinstellungenAufgeklappt;
    setQuizEinstellungenAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = einstellungenContainerRef.current;
        if (!el) return;
        const target = headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH + reihenfolgeH + einstellungenH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

  function toggleAbfrageModus() {
    const opening = !quizAbfrageModusAufgeklappt;
    setQuizAbfrageModusAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = abfrageModusContainerRef.current;
        if (!el) return;
        const target = headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

  function toggleEinzelauswahl() {
    const opening = !quizListeAufgeklappt;
    setQuizListeAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = einzelauswahlRef.current;
        if (!el) return;
        const target = headerH + slotH + listenauswahlHeaderH + alleBereichH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

  function toggleSlotSektion() {
    const opening = !slotSektionAufgeklappt;
    setSlotSektionAufgeklappt(v => !v);
    setSlotSortModus(false); setSlotAuswahlId(null);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = slotContainerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < headerH + slotH) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - headerH - slotH), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

  function toggleStatistikListenAuswahl() {
    const opening = !statistikListenAufgeklappt;
    setStatistikListenAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = statistikListenContainerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < headerH + slotH) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - headerH - slotH), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

  function toggleStatistikEinzelauswahl() {
    const opening = !statistikEinzelauswahlAufgeklappt;
    setStatistikEinzelauswahlAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = statistikEinzelauswahlRef.current;
        if (!el) return;
        const target = headerH + slotH + statistikListenHeaderH + statistikVokauswahlH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

  function beendeQuiz() {
    setQuiz(null);
    setTab("quiz");
    setAnsicht("uebersicht");
  }

  // Statistik-Vollbild: Kopfzeile zeigt den Lernfortschritt der EINGEBLENDETEN Gruppen
  function renderVollbildKopf() {
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    const gruppe = v => !v.fortschritt ? "nie" : v.fortschritt.score < 0 ? "negativ"
      : (schwelle > 0 && v.fortschritt.score >= schwelle) ? "gelernt" : "arbeit";
    const voks = statistikSicht(statistikGefilterteVoks, statistikArt).filter(v => statistikFilter.has(gruppe(v)));
    const anzahl = { gelernt: 0, arbeit: 0, nie: 0, negativ: 0 };
    voks.forEach(v => { anzahl[gruppe(v)]++; });
    const abgefragt = voks.filter(v => v.fortschritt);
    const avg = abgefragt.length ? abgefragt.reduce((sum, v) => sum + v.fortschritt.score, 0) / abgefragt.length : null;
    return (
      <div className="topbar-title" style={{display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"0 44px"}}
        {...tt("Lernfortschritt der eingeblendeten Gruppen")}>
        {schwelle > 0
          ? <span style={{fontWeight:800, fontSize:"1.1rem", color:"#2d6a4f", lineHeight:1}}>{Math.round(lernProzent(voks.map(v => v.fortschritt?.score), schwelle))} %</span>
          : <span style={{fontWeight:800, fontSize:"1.1rem", color:"#2d6a4f", lineHeight:1}}>Ø {avg === null ? "–" : `${avg > 0 ? "+" : ""}${avg.toFixed(1)}`}</span>}
        <div style={{display:"flex", width:"min(200px, 100%)", height:6, borderRadius:3, overflow:"hidden", background:"#f0ede8"}}>
          {voks.length > 0 && GRUPPE_BALKEN.map(([g, farbe]) => anzahl[g] > 0 && (
            <div key={g} style={{width:`${anzahl[g] / voks.length * 100}%`, background:farbe}}/>
          ))}
        </div>
        <span style={{fontSize:"0.68rem", fontWeight:500, color:"#6b6560", lineHeight:1}}>
          {schwelle > 0 ? `${anzahl.gelernt} / ${voks.length} gelernt` : `${voks.length} Vokabeln`}
        </span>
      </div>
    );
  }

  // Rundenergebnis im Kasten: Kreisdiagramm richtig/falsch, Zahlen daneben, Lern-Bilanz darunter
  function renderRundenErgebnis(q, r, f, titel) {
    const ges = r + f;
    const pct = ges > 0 ? Math.round(r / ges * 100) : 0;
    const farbe = pct >= 70 ? "#2d6a4f" : pct >= 40 ? "#e67e22" : "#c0392b";
    const R = 40, U = 2 * Math.PI * R;
    return (
      <div className="karte" style={{padding:"14px 16px", margin:"0 0 14px"}}>
        <div style={{fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", color:"#6b6560", marginBottom:10}}>{titel}</div>
        <div style={{display:"flex", alignItems:"center", gap:18, justifyContent:"center"}}>
          <svg width="112" height="112" viewBox="0 0 112 112" data-ergebniskreis {...tt(`${r} richtig, ${f} falsch`)}>
            <circle cx="56" cy="56" r={R} fill="none" stroke={f > 0 ? "#e8a39b" : "#f0ede8"} strokeWidth="16"/>
            {r > 0 && <circle cx="56" cy="56" r={R} fill="none" stroke="#2d6a4f" strokeWidth="16"
              strokeDasharray={`${U * r / ges} ${U}`} transform="rotate(-90 56 56)"/>}
            <text x="56" y="62" textAnchor="middle" fontSize="20" fontWeight="800" fill={farbe}>{pct}%</text>
          </svg>
          <div style={{lineHeight:1.6}}>
            <div style={{fontWeight:700, fontSize:"1rem", color:"#3b3832"}}>{r} von {ges} richtig</div>
            <div style={{fontSize:"0.85rem", color:"#2d6a4f"}}>✓ {r} gewusst</div>
            <div style={{fontSize:"0.85rem", color:"#c0392b"}}>✗ {f} nicht gewusst</div>
          </div>
        </div>
        {renderLernBilanz(q)}
      </div>
    );
  }

  // Lern-Bilanz am Rundenende: neu gelernte Vokabeln (Gelernt-Schwelle erreicht) bzw. Gratulation
  function renderLernBilanz(q) {
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    if (schwelle <= 0 || !q?.rundeStartScores || !q.gruppeVokIds?.length) return null;
    const start = q.rundeStartScores;
    const jetztMap = new Map(q.liste.vokabeln.map(v => [v.id, v[q.scoreFeld || "fortschritt"]?.score ?? null]));
    const ids = q.gruppeVokIds;
    const vorher = ids.map(id => id in start ? start[id] : jetztMap.get(id));
    const nachher = ids.map(id => jetztMap.get(id));
    const vorherP = lernProzent(vorher, schwelle), nachherP = lernProzent(nachher, schwelle);
    const neuGelernt = ids.filter(id => id in start && (start[id] ?? -Infinity) < schwelle && (jetztMap.get(id) ?? -Infinity) >= schwelle).length;
    const komplett = nachherP >= 99.999 && vorherP < 99.999;
    if (!komplett && neuGelernt === 0) return null;
    return (
      <div style={{border:"1.5px solid #a8d5be", background: komplett ? "#e8f5e9" : "#f0f9f4", borderRadius:12, padding:"10px 14px", marginTop:12, textAlign:"center"}}>
        {komplett && (<>
          <div style={{fontSize:"2rem", lineHeight:1.2}}>🏆</div>
          <div style={{fontWeight:800, color:"#2d6a4f", fontSize:"1rem", marginBottom:4}}>Geschafft! Alle {ids.length} Vokabeln gelernt.</div>
        </>)}
        {neuGelernt > 0 && (
          <div style={{fontWeight:700, color:"#2d6a4f", fontSize:"0.95rem"}}
            {...tt(`Diese Vokabeln haben in dieser Runde den Score +${schwelle} erreicht und gelten jetzt als gelernt`)}>
            ✓ +{neuGelernt} neu gelernt <span style={{fontWeight:400, fontSize:"0.8rem", color:"#6b6560"}}>(Score +{schwelle} erreicht)</span>
          </div>
        )}
      </div>
    );
  }

  // Namensvorschlag für gespeicherte Konfigurationen: Sprache(n) + Datum, eindeutig
  function slotNamenVorschlag() {
    const sprachen = [...new Set(quizTabListen.map(spracheVonListe))].map(c => sprachInfo(c).name);
    const basis = `${sprachen.length ? sprachen.join(" + ") : "Abfrage"} ${new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
    const namen = new Set(slots.gespeichert.map(x => x.name));
    let name = basis, n = 2;
    while (namen.has(name)) name = `${basis} (${n++})`;
    return name;
  }

  // Kasten „In Sessions aufteilen“ im Quiz-Tab: Name, Gruppengröße, Bereich, Rest, Vorschau
  function renderAufteilenKasten() {
    const stand = aufteilenStand();
    if (!stand) return null;
    const upd = patch => setAufteilen(a => ({ ...a, ...patch }));
    const zahl = (v, min, max) => { const n = parseInt(v, 10); return isNaN(n) ? "" : Math.max(min, Math.min(max, n)); };
    const { gruppen, anzahl } = stand;
    const rest = (aufteilen.bis || anzahl) - (aufteilen.von || 1) + 1;
    const hatRest = rest > aufteilen.groesse && rest % aufteilen.groesse !== 0;
    const vorschau = gruppen.length > 6 ? [...gruppen.slice(0, 3), null, ...gruppen.slice(-2)] : gruppen;
    const zeile = {display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:10};
    const label = {fontSize:"0.78rem", color:"#6b6560", minWidth:84};
    return (
      <div data-aufteilen style={{background:"#fff8e1", border:"1.5px solid #f0c94a", borderRadius:12, padding:"12px 14px", margin:"12px 0 4px"}}>
        <div style={{fontWeight:700, color:"#8a6d00", marginBottom:4}}>„{stand.liste.name}“ in Sessions aufteilen</div>
        <div style={{fontSize:"0.75rem", color:"#8a7a50", marginBottom:12}}>Unten wie gewohnt Spalten, Abfrage-Modus, Reihenfolge und Einstellungen wählen – sie gelten für alle Sessions.</div>
        <div style={zeile}>
          <span style={label}>Name</span>
          <input {...ttFeld("Name der Sessions – die Nummern „(von - bis)“ werden angehängt")} data-aufteilen-name className="inp"
            style={{flex:1, minWidth:140, padding:"6px 10px"}} value={aufteilen.name} onChange={e => upd({ name: e.target.value })}/>
        </div>
        <div style={zeile}>
          <span style={label}>Gruppengröße</span>
          {AUFTEILEN_GROESSEN.map(n => (
            <button key={n} data-aufteilen-groesse={n} className={`toggle-opt${aufteilen.groesse === n ? " aktiv" : ""}`}
              style={{padding:"4px 9px", border:"1.5px solid #e0dbd2", borderRadius:8}}
              onClick={() => upd({ groesse: n })} {...tt(`Je ${n} Vokabeln pro Session`)}>{n}</button>
          ))}
          <input {...ttFeld("Eigene Gruppengröße")} data-aufteilen-eigene className="inp" type="number" min={1} max={anzahl}
            style={{width:70, padding:"5px 8px"}} placeholder="eigene"
            value={AUFTEILEN_GROESSEN.includes(aufteilen.groesse) ? "" : aufteilen.groesse}
            onChange={e => { const n = zahl(e.target.value, 1, anzahl); if (n !== "") upd({ groesse: n }); }}/>
        </div>
        <div style={zeile}>
          <span style={label}>Bereich (Nr.)</span>
          <input {...ttFeld("Erste Vokabel-Nummer der Liste, ab der aufgeteilt wird")} data-aufteilen-von className="inp" type="number" min={1} max={anzahl}
            style={{width:74, padding:"5px 8px"}} value={aufteilen.von} onChange={e => upd({ von: zahl(e.target.value, 1, anzahl) })}/>
          <span style={{fontSize:"0.8rem", color:"#6b6560"}}>bis</span>
          <input {...ttFeld("Letzte Vokabel-Nummer, bis zu der aufgeteilt wird")} data-aufteilen-bis className="inp" type="number" min={1} max={anzahl}
            style={{width:74, padding:"5px 8px"}} value={aufteilen.bis} onChange={e => upd({ bis: zahl(e.target.value, 1, anzahl) })}/>
          <span style={{fontSize:"0.75rem", color:"#9b9590"}}>von {anzahl}</span>
        </div>
        {hatRest && (
          <div style={zeile}>
            <span style={label}>Rest</span>
            <div className="toggle-btn">
              <button data-aufteilen-rest="eigen" className={`toggle-opt${!aufteilen.restAnhaengen ? " aktiv" : ""}`} onClick={() => upd({ restAnhaengen: false })}
                {...tt("Übrige Vokabeln als eigene, kleinere Session")}>eigene Gruppe</button>
              <button data-aufteilen-rest="anhaengen" className={`toggle-opt${aufteilen.restAnhaengen ? " aktiv" : ""}`} onClick={() => upd({ restAnhaengen: true })}
                {...tt("Übrige Vokabeln an die letzte Session anhängen")}>an letzte anhängen</button>
            </div>
          </div>
        )}
        <div style={{fontSize:"0.78rem", color:"#6b6560", marginBottom:4}}>Vorschau: {gruppen.length} Session{gruppen.length !== 1 ? "s" : ""}</div>
        <div data-aufteilen-vorschau style={{display:"flex", flexWrap:"wrap", gap:5}}>
          {vorschau.map((g, i) => g ? (
            <span key={i} className="slot-chip belegt" style={{fontSize:"0.72rem", padding:"3px 9px", cursor:"default", ...(g.vorhanden ? {opacity:0.5, textDecoration:"line-through"} : {})}}
              {...tt(g.vorhanden ? "Gibt es schon – wird übersprungen" : `Vokabeln Nr. ${g.von} bis ${g.bis}`)}>{g.name}</span>
          ) : <span key={i} style={{fontSize:"0.8rem", color:"#9b9590", alignSelf:"center"}}>…</span>)}
        </div>
        {gruppen.some(g => g.vorhanden) && (
          <div style={{fontSize:"0.72rem", color:"#9b9590", marginTop:6}}>Durchgestrichen: gibt es schon, wird nicht doppelt angelegt.</div>
        )}
      </div>
    );
  }

  // Einstellung der Rastergröße (gespeicherte Konfigurationen bzw. Listen)
  function rasterEinstellung(g, anzahl, setze, sub, hinweis, art) {
    const minZeilen = Math.max(1, Math.ceil(anzahl / g.spalten));
    const attr = (name, wert) => ({ [`data-${art ? art + "-" : ""}raster-${name}`]: wert });
    return (
      <div className="karte">
        <div className="karte-zeile" style={{flexDirection:"column", alignItems:"flex-start", gap:8}}>
          <div>
            <div className="karte-zeile-name">Raster</div>
            <div className="karte-zeile-sub">{g.zeilen} Zeilen × {g.spalten} Spalten – {sub}</div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
            <span style={{fontSize:"0.8rem", color:"#6b6560", minWidth:56}}>Spalten</span>
            {[1, 2, 3, 4].map(n => (
              <button key={n} {...attr("spalten", n)} className={`toggle-opt${g.spalten === n ? " aktiv" : ""}`}
                onClick={() => setze(g.zeilen, n)}
                {...tt(`${n} Spalte${n > 1 ? "n" : ""} nebeneinander (höchstens 4)`)}>{n}</button>
            ))}
          </div>
          <div style={{display:"flex", alignItems:"center", gap:6}}>
            <span style={{fontSize:"0.8rem", color:"#6b6560", minWidth:56}}>Zeilen</span>
            <button className="toggle-opt" disabled={g.zeilen <= minZeilen} onClick={() => setze(g.zeilen - 1, g.spalten)}
              {...tt("Eine Zeile weniger – nur bis alle Einträge noch Platz haben")}>−</button>
            <span {...attr("zeilen", true)} style={{minWidth:32, textAlign:"center", fontWeight:700}}>{g.zeilen}</span>
            <button className="toggle-opt" disabled={g.zeilen >= RASTER_MAX_ZEILEN} onClick={() => setze(g.zeilen + 1, g.spalten)}
              {...tt("Eine Zeile mehr (höchstens 100)")}>+</button>
            <button className="toggle-opt" disabled={g.zeilen >= RASTER_MAX_ZEILEN} onClick={() => setze(Math.min(RASTER_MAX_ZEILEN, g.zeilen + 10), g.spalten)}
              {...tt("Zehn Zeilen mehr")}>+10</button>
          </div>
          <div style={{fontSize:"0.72rem", color:"#9b9590"}}>{hinweis}</div>
        </div>
      </div>
    );
  }

  // Plätze des Listen-Rasters für die Listenauswahl in Quiz und Statistik: gleiche Spalten und Plätze
  // wie im Listen-Tab (leere Plätze bleiben frei); mit Sprachfilter zusammengerückt
  function listenRasterPlaetze() {
    const { spalten } = rasterGroesse(einstellungen, "listenRaster");
    if (sprachFilter !== "alle") return { spalten, plaetze: sichtbareListen.map(l => ({ key: l.id, l })) };
    const platzMap = new Map(listenIndex.filter(l => l.platz).map(l => [`${l.platz.z}|${l.platz.s}`, l]));
    const zeilen = listenIndex.reduce((m, l) => Math.max(m, (l.platz?.z ?? 0) + 1), 0);
    const plaetze = [];
    for (let z = 0; z < zeilen; z++) for (let sp = 0; sp < spalten; sp++) plaetze.push({ key: `${z}|${sp}`, l: platzMap.get(`${z}|${sp}`) || null });
    return { spalten, plaetze };
  }

  // Listen-Übersicht als Raster wie bei den gespeicherten Konfigurationen: Lang-Druck → Menü
  // (Umbenennen, Duplizieren, Verschieben, Löschen), Lang-Druck und ziehen → verschieben; belegter Platz: tauschen.
  // Mit Sprachfilter rücken die sichtbaren Listen zusammen (Verschieben dann nur unter „Alle“).
  function renderListenRaster() {
    const groesse = rasterGroesse(einstellungen, "listenRaster");
    const gefiltert = sprachFilter !== "alle";
    const sortModus = listenSortModus && !gefiltert;
    const eng = groesse.spalten > 1;
    const tippeImRaster = (l, platz) => {
      if (slotGezogenRef.current) { slotGezogenRef.current = false; return; }
      if (l && listenAuswahlId === l.id) { setListenAuswahlId(null); return; }
      if (listenAuswahlId) { setzeListenPlatz(listenAuswahlId, platz); return; }
      if (l) setListenAuswahlId(l.id);
    };
    const oeffne = l => {
      if (exportAuswahlModus) {
        setExportAusgewaehlt(prev => {
          const neu = new Set(prev);
          if (neu.has(l.id)) neu.delete(l.id); else neu.add(l.id);
          return neu;
        });
      } else {
        setAktiveListeId(l.id); setAnsicht("liste-detail"); setVokabelAufgeklappt(false); setAktionszeileAufgeklappt(false);
      }
    };
    const menue = l => [
      { label: "✎ Umbenennen", fn: () => { setListeMenueId(l.id); setModalInput(l.name); setModalFehler(""); setModal("umbenennen"); } },
      { label: "⧉ Duplizieren", fn: () => { setListeMenueId(l.id); setModalInput(listenKopieName(l.name)); setModalFehler(""); setModal("liste-duplizieren"); } },
      ...(gefiltert ? [] : [{ label: "⇄ Verschieben", fn: () => { setListenSortModus(true); setListenAuswahlId(l.id); } }]),
      { label: "▦ In Sessions aufteilen", fn: () => starteAufteilen(l.id) },
      { label: "↺ Lernstand zurücksetzen", fn: () => { setListeMenueId(l.id); setZuruecksetzenArten(new Set(Object.keys(SCORE_FELD))); setModal("liste-zuruecksetzen"); } },
      { label: "🗑 Löschen", gefahr: true, fn: () => { setListeMenueId(l.id); setModal("loeschen"); } },
    ];
    const zelle = (l, key) => {
      const anzahl = vokabelAnzahl(l.id);
      const liste = lsGet(SK.liste(l.id));
      const aktSpalten = liste ? TYPEN.filter(t => liste.spalten[t].aktiv) : [];
      const ziel = slotDragZiel === key && slotDragId && slotDragId !== l.id;
      const erklaerung = exportAuswahlModus ? tt("Liste für den Export auswählen")
        : sortModus ? tt(`${l.name} – antippen und dann den Zielplatz antippen oder direkt ziehen; auf einem belegten Platz tauschen die beiden`)
        : tt("Liste öffnen: Vokabeln, Spalten, Sprache, Export", menue(l), { langText: l.name,
            // Lang-Druck und dann ziehen: Menü weg, Verschieben-Modus, Liste wandert mit
            beimZeigen: gefiltert ? undefined : (px, py) => { slotZiehenRef.current = { art: "liste", id: l.id, x: px, y: py, aktiv: false, langdruck: true }; } });
      return (
        <div {...erklaerung} key={key} data-raster-zelle={gefiltert ? undefined : key} data-liste-id={l.id} className="karte-zeile"
          style={{cursor: sortModus ? "grab" : "pointer", ...(sortModus ? {touchAction:"none"} : {}),
            ...(listenAuswahlId === l.id && sortModus ? {outline:"3px solid #e0a800", outlineOffset:1} : {}),
            ...(slotDragId === l.id ? {opacity:0.4, borderStyle:"dashed"} : {}),
            ...(ziel ? {outline:"3px solid #52b788", outlineOffset:1} : {})}}
          onPointerDown={sortModus ? (e => { slotZiehenRef.current = { art: "liste", id: l.id, x: e.clientX, y: e.clientY, aktiv: false }; }) : undefined}
          onClick={() => sortModus ? tippeImRaster(l, l.platz) : (slotGezogenRef.current ? (slotGezogenRef.current = false) : oeffne(l))}>
          {exportAuswahlModus && (
            <div className={`checkbox${exportAusgewaehlt.has(l.id) ? " checked" : ""}`}>
              {exportAusgewaehlt.has(l.id) && "✓"}
            </div>
          )}
          {eng ? (
            <div className="karte-zeile-info">
              <div className="karte-zeile-name">{listenFlagge(l)}{l.name}</div>
              <div className="karte-zeile-sub">{anzahl} Vokabel{anzahl !== 1 ? "n" : ""}</div>
            </div>
          ) : (<>
                  <div className="karte-zeile-info">
                    <div className="karte-zeile-name">{listenFlagge(l)}{l.name}</div>
                    <div className="karte-zeile-sub">
                      {anzahl} Vokabel{anzahl !== 1 ? "n" : ""}{" "}
                      {aktSpalten.map(t => <span key={t} className="spalten-badge aktiv">{liste.spalten[t].name || t}</span>)}
                    </div>
                  </div>
                  {(() => {
                    const schwelle = einstellungen.gelerntSchwelle ?? 0;
                    if (schwelle <= 0 || !liste?.vokabeln.length) return null;
                    const scores = liste.vokabeln.map(v => v.fortschritt?.score);
                    const pct = lernProzent(scores, schwelle);
                    const gelernt = scores.filter(sc => (sc ?? -Infinity) >= schwelle).length;
                    return (
                      <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3, flexShrink:0, width:64}}
                        {...tt(`Lernfortschritt ${Math.round(pct)} % · ${gelernt} / ${scores.length} gelernt`)}>
                        <span style={{fontSize:"0.78rem", fontWeight:700, color: pct >= 99.999 ? "#2d6a4f" : "#6b6560"}}>
                          {pct >= 99.999 ? "🏆 " : ""}{Math.round(pct)} %
                        </span>
                        <div style={{width:"100%", height:5, background:"#f0ede8", borderRadius:3, overflow:"hidden"}}>
                          <div style={{width:`${pct}%`, height:"100%", background:"#2d6a4f", borderRadius:3}}/>
                        </div>
                      </div>
                    );
                  })()}
            {!exportAuswahlModus && !sortModus && <span style={{color:"#6b6560"}}>{">"}</span>}
          </>)}
        </div>
      );
    };
    const zellen = [];
    if (gefiltert) {
      sichtbareListen.forEach(l => zellen.push(zelle(l, l.id)));
    } else {
      const platzMap = new Map(listenIndex.filter(l => l.platz).map(l => [`${l.platz.z}|${l.platz.s}`, l]));
      const belegtBis = listenIndex.reduce((m, l) => Math.max(m, (l.platz?.z ?? 0) + 1), 0);
      const zeilenAnzeige = sortModus ? Math.max(groesse.zeilen, belegtBis) : belegtBis;
      for (let z = 0; z < zeilenAnzeige; z++) for (let sp = 0; sp < groesse.spalten; sp++) {
        const key = `${z}|${sp}`;
        const l = platzMap.get(key);
        const ziel = slotDragZiel === key && slotDragId && !l;
        if (l) zellen.push(zelle(l, key));
        else if (sortModus) zellen.push(<div key={key} data-raster-zelle={key} className="raster-leer"
          style={{borderStyle:"dashed", cursor: listenAuswahlId ? "pointer" : "default",
            ...(ziel ? {borderColor:"#52b788", background:"#e8f5ee"} : {})}}
          onClick={() => tippeImRaster(null, { z, s: sp })}
          {...tt("Freier Platz – erst eine Liste antippen, dann hier tippen (oder eine Liste hierher ziehen)")}/>);
        else zellen.push(<div key={key} className="raster-leer" style={{border:"none"}}/>);
      }
    }
    return (<>
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6, minHeight:22}}>
        <span style={{fontSize:"0.68rem", color: sortModus ? "#6b6560" : "#9b9590"}}>
          {sortModus
            ? (listenAuswahlId ? "Jetzt den Zielplatz antippen – ist er belegt, tauschen die beiden." : "Liste antippen, dann Zielplatz antippen – oder direkt ziehen. Belegter Platz: die beiden tauschen.")
            : gefiltert ? "Lang drücken: umbenennen, duplizieren oder löschen · Verschieben unter „Alle“"
            : "Lang drücken: umbenennen, duplizieren, verschieben oder löschen"}
        </span>
        {sortModus && (
          <button data-listen-fertig className="typ-btn aktiv" style={{fontSize:"0.7rem", padding:"2px 8px", marginLeft:"auto"}}
            onClick={() => { setListenSortModus(false); setSlotDragId(null); setListenAuswahlId(null); setSlotDragZiel(null); }}
            {...tt("Verschieben beenden")}>
            Fertig
          </button>
        )}
      </div>
      <div className={`listen-raster${eng ? " eng" : ""}`} style={{gridTemplateColumns:`repeat(${groesse.spalten}, minmax(0, 1fr))`}}>
        {zellen}
      </div>
    </>);
  }

  // Chips "Gespeichert" (sortierbar) und "Verlauf" (automatisch, letzte 5) – Quiz- und Statistik-Tab
  function renderSlotBereiche(neuChip, onLaden, slotRef, abstand = 0) {
    const verlauf = slots.verlauf.filter(slotSichtbar);
    const label = {fontSize:"0.72rem", color:"#9b9590", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"};
    // Raster: alle Einträge (auch andere Sprache) belegen ihren Platz; sichtbar nur die der gewählten Sprache
    const groesse = rasterGroesse(einstellungen);
    const raster = ordneRaster(slots.gespeichert, groesse);
    const platzMap = new Map(raster.gespeichert.map(x => [`${x.platz.z}|${x.platz.s}`, x]));
    const sichtbar = raster.gespeichert.filter(slotSichtbar);
    const zeilenAnzeige = slotSortModus ? raster.zeilen : sichtbar.reduce((m, x) => Math.max(m, x.platz.z + 1), 0);
    const sfVon = x => slotSFAlle(x)[aktiverSlot?.id === x.id ? quizAbfrageArt : slotKonfigArt(x)];
    const tippeImRaster = (x, platz) => {
      if (slotGezogenRef.current) { slotGezogenRef.current = false; return; }
      if (x && slotAuswahlId === x.id) { setSlotAuswahlId(null); return; }
      if (slotAuswahlId) { setzeSlotPlatz(slotAuswahlId, platz); return; }
      if (x) setSlotAuswahlId(x.id);
    };
    const zellen = [];
    for (let z = 0; z < zeilenAnzeige; z++) for (let sp = 0; sp < groesse.spalten; sp++) {
      const key = `${z}|${sp}`;
      const x = platzMap.get(key);
      const ziel = slotDragZiel === key && slotDragId && slotDragId !== x?.id;
      if (x && slotSichtbar(x)) {
        const sf = sfVon(x);
        const inhalt = (<>
          <span className="raster-name">{x.name}</span>
          {sf && <span className="raster-fortschritt">▶ {(sf.abgefragt || []).length}/{sf.gesamt || 0}</span>}
        </>);
        zellen.push(slotSortModus ? (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} className="slot-chip belegt raster-chip"
            style={{touchAction:"none", cursor:"grab",
              ...(slotAuswahlId === x.id ? {outline:"3px solid #e0a800", outlineOffset:1} : {}),
              ...(slotDragId === x.id ? {opacity:0.4, borderStyle:"dashed"} : {}),
              ...(ziel ? {outline:"3px solid #52b788", outlineOffset:1} : {})}}
            onPointerDown={e => { slotZiehenRef.current = { id: x.id, x: e.clientX, y: e.clientY, aktiv: false }; }}
            onClick={() => tippeImRaster(x, x.platz)}
            {...tt(`${x.name} – antippen und dann den Zielplatz antippen oder direkt ziehen; auf einem belegten Platz tauschen die beiden`)}>
            {inhalt}
          </button>
        ) : (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} className="slot-chip belegt raster-chip"
            style={chipStil('gespeichert', x.id, slotRef)}
            onClick={() => onLaden('gespeichert', x.id)}
            {...tt(`${x.name} – antippen: Konfiguration laden (Liste, Vokabelauswahl, Einstellungen, Fortschritt)`, [
              { label: "✎ Umbenennen", fn: () => setSlotUmbenennen({ id: x.id, name: x.name }) },
              { label: "⧉ Duplizieren", fn: () => setSlotUmbenennen({ id: x.id, name: kopieName(x.name), kopie: true }) },
              { label: "⇄ Verschieben", fn: () => { setSlotSortModus(true); setSlotAuswahlId(x.id); } },
              { label: "🗑 Löschen", gefahr: true, fn: () => setLoescheSlotNr({ typ: 'gespeichert', id: x.id }) },
            ], { langText: x.name,
                 // Lang-Druck und dann ziehen: Menü weg, Verschieben-Modus, Eintrag wandert mit
                 beimZeigen: (px, py) => { slotZiehenRef.current = { id: x.id, x: px, y: py, aktiv: false, langdruck: true }; } })}>
            {inhalt}
          </button>
        ));
      } else if (x) {
        // Eintrag einer anderen Sprache: Platz belegt, aber hier nicht bedienbar
        zellen.push(<div key={key} className="raster-leer" style={{opacity: slotSortModus ? 0.6 : 0, fontSize:"0.65rem", color:"#9b9590"}}>andere Sprache</div>);
      } else if (slotSortModus) {
        zellen.push(<div key={key} data-raster-zelle={key} className="raster-leer"
          style={{borderStyle:"dashed", cursor: slotAuswahlId ? "pointer" : "default",
            ...(ziel ? {borderColor:"#52b788", background:"#e8f5ee"} : {})}}
          onClick={() => tippeImRaster(null, { z, s: sp })}
          {...tt("Freier Platz – erst ein Paket antippen, dann hier tippen (oder ein Paket hierher ziehen)")}/>);
      } else {
        zellen.push(<div key={key} className="raster-leer" style={{border:"none"}}/>);
      }
    }
    return (<>
      <div style={{margin:`0 ${abstand}px 12px`}}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6, minHeight:22}}>
          <span style={label}>📌 Gespeichert</span>
          <span className="slot-kopf-knoepfe" style={{marginLeft:"auto", display:"flex", gap:6, alignItems:"center"}}>
            {!slotSortModus && neuChip}
            {slotSortModus && (
              <button className="typ-btn aktiv" style={{fontSize:"0.7rem", padding:"2px 8px"}}
                onClick={() => { setSlotSortModus(false); setSlotDragId(null); setSlotAuswahlId(null); setSlotDragZiel(null); }}
                {...tt("Verschieben beenden")}>
                Fertig
              </button>
            )}
          </span>
        </div>
        {!slotSortModus && raster.gespeichert.length > 0 && (
          <div style={{fontSize:"0.68rem", color:"#9b9590", marginBottom:6}}>Lang drücken: umbenennen, verschieben oder löschen</div>
        )}
        {slotSortModus && <div style={{fontSize:"0.72rem", color:"#6b6560", marginBottom:6}}>
          {slotAuswahlId ? "Jetzt den Zielplatz antippen – ist er belegt, tauschen die beiden." : "Paket antippen, dann Zielplatz antippen – oder direkt ziehen. Belegter Platz: die beiden tauschen."}
        </div>}
        {zellen.length > 0 && (
          <div className="slot-raster" style={{gridTemplateColumns:`repeat(${groesse.spalten}, minmax(0, 1fr))`}}>
            {zellen}
          </div>
        )}
      </div>
      {verlauf.length > 0 && !slotSortModus && (
        <div style={{margin:`0 ${abstand}px 14px`, paddingTop:10, borderTop:"1px dashed #d6d2cb"}}>
          <div style={{...label, marginBottom:6}}>🕘 Verlauf · letzte Abfragen</div>
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            {verlauf.map(x => renderSlotChip(x.id, slotChipLabel(x),
              () => onLaden('verlauf', x.id),
              chipStil('verlauf', x.id, slotRef), "verlauf"))}
          </div>
        </div>
      )}
    </>);
  }

  // Nach dem Quiz direkt zur Statistik: mit Session → deren Eintrag (ganze Vokabelgruppe),
  // sonst genau die Vokabeln dieser Runde
  // Nach einer Gruppen-Runde aus der Statistik: zurück in genau diese Statistik (Auswahl, Art, Filter unverändert)
  function zurueckZurStatistik() {
    setQuiz(null);
    setAnsicht("uebersicht");
    setTab("statistik");
  }

  function zurRundenStatistik(abschluss) {
    const q = quiz;
    if (q?.ausStatistik) { zurueckZurStatistik(); return; }
    abschluss();
    setStatistikListenAufgeklappt(false);
    setStatistikEinzelauswahlAufgeklappt(false);
    setStatistikVollbild(false);
    setStatistikSlotGeleert(false);
    setStatistikFilter(new Set(['negativ', 'nie', 'arbeit', 'gelernt']));
    setStatistikArt(q?.modus === "diktat" ? "diktat" : q?.scoreFeld === "akzentFortschritt" ? "akzente" : "uebersetzung");
    if (q?.istSessionModus && aktiverSlot && getSlotEintrag(aktiverSlot.typ, aktiverSlot.id)) {
      ladeSlotStatistik(aktiverSlot.typ, aktiverSlot.id);
    } else {
      const ids = [...new Set((q?.vokabeln || []).map(v => String(v.id).includes("__") ? String(v.id) : `${aktiveListeId}__${v.id}`))];
      setStatistikAktiverSlot(null);
      setStatistikListenIds(new Set(ids.map(id => id.split("__")[0])));
      setStatistikBereichTyp("bereich");
      setStatistikCheckboxAuswahl(new Set(ids));
    }
    setTab("statistik");
  }

  function brecheQuizAb() {
    if (!quiz) { beendeQuiz(); return; }
    if (quiz.istSessionModus) {
      // In der Wiederholung wurde das ganze Paket bereits einmal abgefragt
      const answeredIds = quiz.wiederholungDurchgang ? (quiz.sessionVokIds || []) : [...new Set(
        (quiz.vokabeln || []).slice(0, quiz.index || 0).map(v => v.id)
      )];
      if (answeredIds.length > 0) updateSessionSlotFortschritt(answeredIds, false);
    }
    const ges = (quiz.quizRichtigAnzahl || 0) + (quiz.quizFalschAnzahl || 0);
    if (ges > 0) {
      setQuiz(prev => ({...prev, phase: "fertig", abgebrochen: true}));
    } else {
      beendeQuiz();
    }
  }

  function starteDiktat(force = false, overrideSlot = null, gruppe = null) {
    // gruppe (Set von Vokabel-IDs, Quiz aus der Statistik): einmalige Runde nur mit diesen Vokabeln –
    // Auswahl, Konfiguration und Session-Fortschritt bleiben unberührt; schlechteste zuerst, ohne Score-Grenze
    const reihenfolgeQ = gruppe ? "schlechteste" : quizReihenfolge;
    const maxScoreQ = gruppe ? "" : quizSchlechtesteMaxScore;
    const unbeantwortetQ = gruppe ? { schlechteste: true } : quizUnbeantwortetZuerst;
    const kombiListe = quizTabListen.length > 0 ? getKombinierteListe(quizTabListen) : aktiveListe;
    if (!kombiListe) return;
    const isPakete = !gruppe && quizSessionModus === "pakete";
    if (isPakete && quizPaketGroesse == null) return;
    const effSlot = overrideSlot !== null ? overrideSlot : aktiverSlot;
    if (!force && isPakete && sessionSlotAktiv && sessionSlotKonflikt() && effSlot?.typ !== 'gespeichert') {
      setSessionUeberschreibenModal(true); return;
    }
    let voks = kombiListe.vokabeln.filter(v => v[quizDiktatSpalte]);
    if (gruppe) voks = voks.filter(v => gruppe.has(v.id));
    else if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0) {
      voks = voks.filter(v => quizCheckboxAuswahl.has(v.id));
    }
    const schwelleDiktat = einstellungen.gelerntSchwelle ?? 0;
    if (!gruppe && !quizGelerntEinschliessen && schwelleDiktat > 0)
      voks = voks.filter(v => gelerntScore(v, true) < schwelleDiktat);
    const sessionGesamt = isPakete ? voks.length : 0;
    if (isPakete) {
      const existingSlot = lsGet(SK.sessionAktiv);
      const konflikt = existingSlot && sessionSlotKonflikt();
      if (effSlot?.typ === 'gespeichert') {
        if (!force && vokabelgruppeGeaendert) { setGruppenAenderungsDialog(true); return; }
        if (!existingSlot || konflikt) {
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v.diktatFortschritt?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, 'gespeichert', effSlot.id);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          setSessionSlotAktiv(existingSlot);
        }
      } else {
        if (!existingSlot || konflikt || !effSlot || overrideSlot !== null) {
          const verlaufId = overrideSlot?.typ === 'verlauf' ? overrideSlot.id : erstelleVerlaufEintrag();
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v.diktatFortschritt?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, 'verlauf', verlaufId);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          setSessionSlotAktiv(existingSlot);
        }
      }
    }
    if (reihenfolgeQ === "schlechteste") {
      if (maxScoreQ !== "" && !isNaN(parseFloat(maxScoreQ))) {
        const threshold = parseFloat(maxScoreQ);
        voks = voks.filter(v => (v.diktatFortschritt?.score ?? 0) < threshold);
      }
      if (unbeantwortetQ.schlechteste) {
        const unb = voks.filter(v => !v.diktatFortschritt);
        const bea = [...voks.filter(v => v.diktatFortschritt)].sort((a, b) => (a.diktatFortschritt.score ?? 0) - (b.diktatFortschritt.score ?? 0));
        voks = [...unb, ...bea];
      } else {
        voks = [...voks].sort((a, b) => (a.diktatFortschritt?.score ?? 0) - (b.diktatFortschritt?.score ?? 0));
      }
    } else if (unbeantwortetQ[reihenfolgeQ]) {
      const unb = voks.filter(v => !v.diktatFortschritt);
      const bea = voks.filter(v => v.diktatFortschritt);
      if (reihenfolgeQ === "listennr") {
        voks = [...unb, ...bea];
      } else {
        voks = [...[...unb].sort(() => Math.random() - 0.5), ...[...bea].sort(() => Math.random() - 0.5)];
      }
    } else if (reihenfolgeQ !== "listennr") {
      voks = [...voks].sort(() => Math.random() - 0.5);
    }
    if (isPakete) voks = voks.slice(0, quizPaketGroesse);
    if (voks.length === 0) return;
    if (!isPakete && !gruppe) merkeRundeImVerlauf(effSlot, Object.fromEntries(voks.map(v => [v.id, v.fortschritt?.score ?? null])));
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
      sessionVokIds: isPakete ? voks.map(v => v.id) : null,
      istSessionModus: isPakete,
      ausStatistik: !!gruppe,   // Gruppen-Runde aus der Statistik: danach dorthin zurück
      sessionGesamt,
    });
    setAnsicht("quiz");
  }

  function starteQuiz(force = false, overrideSlot = null, gruppe = null) {
    // gruppe (Set von Vokabel-IDs, Quiz aus der Statistik): einmalige Runde nur mit diesen Vokabeln –
    // Auswahl, Konfiguration und Session-Fortschritt bleiben unberührt; schlechteste zuerst, ohne Score-Grenze
    const reihenfolgeQ = gruppe ? "schlechteste" : quizReihenfolge;
    const maxScoreQ = gruppe ? "" : quizSchlechtesteMaxScore;
    const unbeantwortetQ = gruppe ? { schlechteste: true } : quizUnbeantwortetZuerst;
    if (quizModus === "diktat") { starteDiktat(force, overrideSlot, gruppe); return; }
    const kombiListe = quizTabListen.length > 0 ? getKombinierteListe(quizTabListen) : aktiveListe;
    if (!kombiListe) return;
    const isPakete = !gruppe && quizSessionModus === "pakete";
    if (isPakete && quizPaketGroesse == null) return;
    const effSlot = overrideSlot !== null ? overrideSlot : aktiverSlot;
    if (!force && isPakete && sessionSlotAktiv && sessionSlotKonflikt() && effSlot?.typ !== 'gespeichert') {
      setSessionUeberschreibenModal(true); return;
    }
    const alleAbfragbar = quizModus === "rotierend"
      ? quizAusgewaehlt
      : [quizFrageTyp, ...quizAntwortTypenGeordnet].filter(Boolean);
    const sitzungsInfoTypen = [
      ...quizInfoTypenSession,
      ...TYPEN.filter(t => t.startsWith('i') && kombiListe.spalten[t].aktiv && quizZeigeInfo[t]),
    ];

    let voks = kombiListe.vokabeln.filter(v => alleAbfragbar.every(t => v[t]));

    if (gruppe) voks = voks.filter(v => gruppe.has(v.id));
    else if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0) {
      voks = voks.filter(v => quizCheckboxAuswahl.has(v.id));
    }
    // Akzent-Spalten: Wörter ohne Akzent nur auf Wunsch – sonst wird für sie nur die Akzent-Spalte
    // übersprungen; ganz raus nur, wenn keine andere Antwortspalte bleibt. Reine Akzent-Abfrage nutzt den Akzent-Score
    const akzentOhneAuslassen = !stufenRegeln(einstellungen).akzentOhneMischen;
    voks = voks.filter(v => antwortSpaltenFuer(v, quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet,
      quizSpalteModus, akzentOhneAuslassen).length > 0);
    const scoreFeld = quizModus !== "rotierend" && quizAntwortTypenGeordnet.length > 0
      && quizAntwortTypenGeordnet.every(t => quizSpalteModus[t] === "akzent") ? "akzentFortschritt" : "fortschritt";
    const gruppeVokIds = voks.map(v => v.id);   // ganze Vokabelgruppe inkl. Gelernter (für Lern-Bilanz)
    const schwelleQ = einstellungen.gelerntSchwelle ?? 0;
    if (!gruppe && !quizGelerntEinschliessen && schwelleQ > 0)
      voks = voks.filter(v => (v[scoreFeld]?.score ?? -Infinity) < schwelleQ);
    // Score-Grenze (Reihenfolge "schlechteste") gehört zur Session-Menge – wie die Anzeige im Quiz-Tab
    if (reihenfolgeQ === "schlechteste" && maxScoreQ !== "" && !isNaN(parseFloat(maxScoreQ))) {
      const threshold = parseFloat(maxScoreQ);
      voks = voks.filter(v => (v[scoreFeld]?.score ?? 0) < threshold);
    }

    const sessionGesamt = isPakete ? voks.length : 0;
    const sessionIds = isPakete ? voks.map(v => v.id) : null;

    if (isPakete) {
      const existingSlot = lsGet(SK.sessionAktiv);
      const konflikt = existingSlot && sessionSlotKonflikt();
      if (effSlot?.typ === 'gespeichert') {
        if (!force && vokabelgruppeGeaendert) { setGruppenAenderungsDialog(true); return; }
        if (!existingSlot || konflikt) {
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v[scoreFeld]?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, 'gespeichert', effSlot.id);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          setSessionSlotAktiv(existingSlot);
        }
      } else {
        if (!existingSlot || konflikt || !effSlot || overrideSlot !== null) {
          const verlaufId = overrideSlot?.typ === 'verlauf' ? overrideSlot.id : erstelleVerlaufEintrag();
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v[scoreFeld]?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, 'verlauf', verlaufId);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          setSessionSlotAktiv(existingSlot);
        }
      }
    }

    if (reihenfolgeQ === "schlechteste") {
      if (unbeantwortetQ.schlechteste) {
        const unb = voks.filter(v => !v[scoreFeld]);
        const bea = [...voks.filter(v => v[scoreFeld])].sort((a, b) => (a[scoreFeld].score ?? 0) - (b[scoreFeld].score ?? 0));
        voks = [...unb, ...bea];
      } else {
        voks = [...voks].sort((a, b) => (a[scoreFeld]?.score ?? 0) - (b[scoreFeld]?.score ?? 0));
      }
    } else if (unbeantwortetQ[reihenfolgeQ]) {
      const unb = voks.filter(v => !v[scoreFeld]);
      const bea = voks.filter(v => v[scoreFeld]);
      if (reihenfolgeQ === "listennr") {
        voks = [...unb, ...bea];
      } else {
        voks = [...[...unb].sort(() => Math.random() - 0.5), ...[...bea].sort(() => Math.random() - 0.5)];
      }
    } else if (reihenfolgeQ !== "listennr") {
      voks = [...voks].sort(() => Math.random() - 0.5);
    }

    if (isPakete) voks = voks.slice(0, quizPaketGroesse);
    if (voks.length === 0) return;
    if (!isPakete && !gruppe) merkeRundeImVerlauf(effSlot, Object.fromEntries(voks.map(v => [v.id, v[scoreFeld]?.score ?? null])));

    function getFA(idx) {
      if (quizModus === "rotierend") {
        const ft = alleAbfragbar[idx % alleAbfragbar.length];
        return { frageTyp: ft, antwortTypen: alleAbfragbar.filter(t => t !== ft) };
      }
      return { frageTyp: quizFrageTyp, antwortTypen: quizAntwortTypenGeordnet };
    }

    const basisFA = getFA(0);   // ungefiltert; je Vokabel werden Akzent-Spalten ohne Akzent ggf. ausgelassen
    const frageTyp = basisFA.frageTyp;
    const antwortTypen = antwortSpaltenFuer(voks[0], basisFA.antwortTypen, quizSpalteModus, akzentOhneAuslassen, true);
    const erstesTeile = voks[0][antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
    const ersterModusTyp0 = quizSpalteModus[antwortTypen[0]] || STANDARD_ANTWORT_MODUS;
    const erstesMC = ersterModusTyp0 === "mc"
      ? generiereButtons(voks, voks[0], antwortTypen[0]) : null;

    const startScoresZiel = abfrageZielModus === "score" && abfrageZielScoreTyp === "session"
      ? Object.fromEntries(voks.map(v => [v.id, Math.min(10, Math.max(-10, v[scoreFeld]?.score ?? 0))]))
      : null;
    const abfrageZiel = abfrageZielModus !== "anzahl" || abfrageZielAnzahl > 1
      ? { modus: abfrageZielModus, anzahl: abfrageZielAnzahl, wiederholung: abfrageZielWiederholung,
          score: abfrageZielScore, scoreTyp: abfrageZielScoreTyp, runde: 0, startScoresZiel }
      : null;

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz({
      sitzungsInfoTypen, modus: quizModus, spalteModus: quizSpalteModus,
      liste: kombiListe, vokabeln: voks, index: 0,
      frageTyp, antwortTypen, antwortTypIndex: 0, basisFA, akzentOhneAuslassen,
      phase: "eingabe", eingabe: "", flash: false, infoSichtbar: false, infoSeite: 0,
      antwortTeile: erstesTeile, weitereIndices: [], weiterePos: 0,
      mcButtons: erstesMC?.buttons || [], mcRichtig: erstesMC?.richtig || [],
      vorigeAntworten: [], sessionFalsch: {}, feedback: "", mcWechsel: false,
      aktuelleFehlversuche: 0, falschFlash: false, richtigMap: {}, spaltenErgebnisse: {}, vokErgebnis: null, gewertet: {},
      quizRichtigAnzahl: 0, quizFalschAnzahl: 0,
      sessionVokIds: isPakete ? voks.map(v => v.id) : null,
      istSessionModus: isPakete,
      ausStatistik: !!gruppe,   // Gruppen-Runde aus der Statistik: danach dorthin zurück
      sessionGesamt, sessionIds, abfrageZiel,
      rundeStartScores: Object.fromEntries(voks.map(v => [v.id, v[scoreFeld]?.score ?? null])),
      gruppeVokIds, scoreFeld,
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
    const aktVokId = prev.vokabeln[prev.index]?.id;
    const warRichtig = prev.vokErgebnis === "richtig";
    const richtigMap = (prev.abfrageZiel?.modus === "wiederholung" && aktVokId && warRichtig)
      ? { ...(prev.richtigMap || {}), [aktVokId]: ((prev.richtigMap || {})[aktVokId] || 0) + 1 }
      : (prev.richtigMap || {});
    // Auswertung zählt jede Vokabel einmal (erste Bewertung der Runde); Wiederholungen nicht
    const zaehlt = prev.erstbewertung !== false;
    const quizRichtigAnzahl = (prev.quizRichtigAnzahl || 0) + (zaehlt && warRichtig ? 1 : 0);
    const quizFalschAnzahl = (prev.quizFalschAnzahl || 0) + (zaehlt && !warRichtig ? 1 : 0);

    function getFA(voks, idx) {
      const basis = prev.basisFA || { frageTyp: prev.frageTyp, antwortTypen: prev.antwortTypen };
      let fa = { frageTyp: basis.frageTyp, antwortTypen: basis.antwortTypen };
      if (prev.modus === "rotierend") {
        const alle = prev.basisFA ? [basis.frageTyp, ...basis.antwortTypen] : [...basis.antwortTypen, basis.frageTyp];   // = Reihenfolge wie beim Start
        const ft = alle[idx % alle.length];
        fa = { frageTyp: ft, antwortTypen: alle.filter(t => t !== ft) };
      }
      return { frageTyp: fa.frageTyp, antwortTypen: antwortSpaltenFuer(voks[idx], fa.antwortTypen, prev.spalteModus, prev.akzentOhneAuslassen, true) };
    }

    // Baut den State für vokabeln[idx] innerhalb von voks auf
    function starteVokabel(voks, idx, extra = {}) {
      const { frageTyp, antwortTypen } = getFA(voks, idx);
      const vok = voks[idx];
      const teile = vok[antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
      const sp = prev.spalteModus;
      const mc = (sp[antwortTypen[0]] || STANDARD_ANTWORT_MODUS) === "mc" ? generiereButtons(voks, vok, antwortTypen[0]) : null;
      return { ...prev, richtigMap, quizRichtigAnzahl, quizFalschAnzahl, spaltenErgebnisse: {}, vokErgebnis: null, erstbewertung: null, flash: false, index: idx,
        vokabeln: voks, frageTyp, antwortTypen, antwortTypIndex: 0,
        phase: "eingabe", eingabe: "", antwortTeile: teile, weitereIndices: [], weiterePos: 0,
        mcButtons: mc?.buttons || [], mcRichtig: mc?.richtig || [],
        vorigeAntworten: [], infoSichtbar: false, infoSeite: 0, feedback: "",
        spalteModus: sp, mcWechsel: false, aktuelleFehlversuche: 0, falschFlash: false,
        sessionFalsch: {}, ...extra };
    }

    if (naechsterIdx >= prev.vokabeln.length) {
      if (prev.abfrageZiel) {
        const ziel = prev.abfrageZiel;
        // Vor jedem Wiederholungs-Durchgang eine Zwischenkarte "Wiederholung" zeigen
        const wiederholungsStart = () => ({ phase: "wiederholungHinweis", wiederholungDurchgang: (prev.wiederholungDurchgang || 0) + 1 });
        if (ziel.modus === "anzahl" && ziel.runde < ziel.anzahl - 1) {
          const neuVoks = [...prev.vokabeln].sort(() => Math.random() - 0.5);
          return starteVokabel(neuVoks, 0, { abfrageZiel: { ...ziel, runde: ziel.runde + 1 } });
        }
        if (ziel.modus === "wiederholung") {
          const restVoks = prev.vokabeln.filter(v => (richtigMap[v.id] || 0) < ziel.wiederholung);
          if (restVoks.length > 0) {
            const neuVoks = [...restVoks].sort(() => Math.random() - 0.5);
            return starteVokabel(neuVoks, 0, wiederholungsStart());
          }
        }
        if (ziel.modus === "score") {
          const restVoks = prev.vokabeln.filter(v => {
            const liveVok = prev.liste.vokabeln.find(lv => lv.id === v.id);
            const score = Math.min(10, Math.max(-10, liveVok?.[prev.scoreFeld || "fortschritt"]?.score ?? 0));
            if (ziel.scoreTyp === "session") {
              const startScore = (ziel.startScoresZiel || {})[v.id] ?? 0;
              return (score - startScore) < ziel.score;
            }
            return score < ziel.score;
          });
          if (restVoks.length > 0) {
            const neuVoks = [...restVoks].sort(() => Math.random() - 0.5);
            return starteVokabel(neuVoks, 0, wiederholungsStart());
          }
        }
      }
      return {...prev, richtigMap, quizRichtigAnzahl, quizFalschAnzahl, spaltenErgebnisse: {}, vokErgebnis: null, erstbewertung: null, flash: false, phase: "fertig"};
    }

    const { frageTyp, antwortTypen } = getFA(prev.vokabeln, naechsterIdx);
    const naechsteVok = prev.vokabeln[naechsterIdx];
    const teile = naechsteVok[antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
    const spalteModus = prev.mcWechsel
      ? {...prev.spalteModus, [antwortTypen[0]]: "tippen"}
      : prev.spalteModus;
    const modusTyp0 = spalteModus[antwortTypen[0]] || STANDARD_ANTWORT_MODUS;
    const mc = modusTyp0 === "mc" ? generiereButtons(prev.vokabeln, naechsteVok, antwortTypen[0]) : null;
    return {...prev, richtigMap, quizRichtigAnzahl, quizFalschAnzahl, spaltenErgebnisse: {}, vokErgebnis: null, erstbewertung: null, flash: false, index: naechsterIdx, frageTyp, antwortTypen, antwortTypIndex: 0,
      phase: "eingabe", eingabe: "", antwortTeile: teile, weitereIndices: [], weiterePos: 0,
      mcButtons: mc?.buttons || prev.mcButtons, mcRichtig: mc?.richtig || prev.mcRichtig,
      vorigeAntworten: [], infoSichtbar: false, infoSeite: 0, feedback: "",
      spalteModus, mcWechsel: false, aktuelleFehlversuche: 0, falschFlash: false};
  }

  // Setzt flash, wartet 500ms, führt dann advanceFn aus
  // Kurze Verzögerung vor der nächsten Vokabel; zwischen mehreren Antworten derselben Frage geht es sofort weiter
  function mitVerzoegerung(quizUpdates, advanceFn, ms) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (sofortWeiter(quiz)) {
      flashWeiterRef.current = null;
      setQuiz(prev => advanceFn({...prev, ...quizUpdates, flash: false, karteNeinFlash: false}));
      return;
    }
    flashWeiterRef.current = advanceFn;
    setQuiz(prev => ({...prev, ...quizUpdates}));
    flashTimerRef.current = setTimeout(beendeVerzoegerung, ms);
  }
  function mitFlash(quizUpdates, advanceFn) {
    mitVerzoegerung({...quizUpdates, flash: true, eingabe: ""}, advanceFn, 1000);
  }
  // Antippen während der Verzögerung: sofort weiter
  function beendeVerzoegerung() {
    const fn = flashWeiterRef.current;
    if (!fn) return;
    flashWeiterRef.current = null;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => prev && (prev.flash || prev.karteNeinFlash) ? fn({...prev, flash: false, karteNeinFlash: false}) : prev);
  }
  // Weitere Antworten derselben Frage offen → ohne Verzögerung weiterfragen
  const sofortWeiter = q => q.antwortTypIndex < q.antwortTypen.length - 1;

  // Aktuelle Spalte abschließen: Antwort (gewusst oder nicht) bleibt oben stehen, dann nächste Spalte bzw. Vokabel
  function weiterNachSpalte(prev, richtig) {
    const typ = prev.antwortTypen[prev.antwortTypIndex];
    const vorigeAntworten = [...prev.vorigeAntworten, {
      typ, wert: prev.antwortTeile.join(" / "), label: prev.liste.spalten[typ]?.name || typ, richtig,
    }];
    const naechsterIdx = prev.antwortTypIndex + 1;
    if (naechsterIdx >= prev.antwortTypen.length) return naechsteVokabelState({...prev, vorigeAntworten, richtigAufgedeckt: false});
    const nt = prev.antwortTypen[naechsterIdx];
    const teile = prev.vokabeln[prev.index][nt]?.wert.split('/').map(s => s.trim()) || [];
    const ntModus = prev.mcWechsel ? "mc" : (prev.spalteModus?.[nt] || STANDARD_ANTWORT_MODUS);
    const mc = ntModus === "mc" ? generiereButtons(prev.vokabeln, prev.vokabeln[prev.index], nt) : null;
    return {...prev, flash: false, karteNeinFlash: false, phase: "eingabe", eingabe: "", antwortTypIndex: naechsterIdx,
      antwortTeile: teile, mcButtons: mc?.buttons || prev.mcButtons, mcRichtig: mc?.richtig || prev.mcRichtig,
      weitereIndices: [], weiterePos: 0, infoSichtbar: false, richtigAufgedeckt: false,
      aktuelleFehlversuche: 0, falschFlash: false, feedback: "", vorigeAntworten};
  }

  // Score einmal pro Vokabel: Ergebnis je Antwort-Spalte sammeln, nach der letzten
  // Spalte auswerten (alle richtig → richtig, sonst falsch bzw. aufgedeckt)
  function spaltenAbschluss(ergebnis) {
    const spaltenErgebnisse = { ...(quiz.spaltenErgebnisse || {}), [quiz.antwortTypIndex]: ergebnis };
    const letzte = quiz.antwortTypIndex >= quiz.antwortTypen.length - 1;
    if (!letzte || quiz.vokErgebnis) return { spaltenErgebnisse };
    const alle = quiz.antwortTypen.map((_, i) => spaltenErgebnisse[i] || "aufgedeckt");
    const gesamt = liste => liste.every(e => e === "richtig") ? "richtig" : liste.includes("falsch") ? "falsch" : "aufgedeckt";
    const vokErgebnis = gesamt(alle);
    // Akzent-Spalten zählen nur für den eigenen Akzent-Score
    const istAkzent = i => quiz.spalteModus?.[quiz.antwortTypen[i]] === "akzent";
    const normal = alle.filter((_, i) => !istAkzent(i));
    const akzent = alle.filter((_, i) => istAkzent(i));
    const aktVok = getAktVok();
    // Pro Vokabel und Runde zählt nur die erste Bewertung (Wiederholungen sind reines Üben).
    // Ausnahme Abfrage-Ziel "Score": dort muss jede Antwort zählen, sonst endet die Runde nie.
    const erstbewertung = !(aktVok.id in (quiz.gewertet || {}));
    const gewertet = erstbewertung ? { ...(quiz.gewertet || {}), [aktVok.id]: vokErgebnis } : quiz.gewertet;
    if (!erstbewertung && quiz.abfrageZiel?.modus !== "score") return { spaltenErgebnisse, vokErgebnis, erstbewertung, gewertet };
    let liste = quiz.liste, sessionFalsch = quiz.sessionFalsch;
    if (normal.length > 0) {
      const erg = gesamt(normal);
      const neuerCount = erg === "falsch" ? (quiz.sessionFalsch[aktVok.id] || 0) + 1 : 0;
      liste = speichereScore(liste, aktVok.id, berechneNeuenScore(aktVok.fortschritt, erg, neuerCount, stufenRegeln(einstellungen).aufdeckenAbzug ? "schwer" : "einfach"));
      if (erg === "falsch") sessionFalsch = { ...quiz.sessionFalsch, [aktVok.id]: neuerCount };
    }
    if (akzent.length > 0) {
      liste = speichereAkzentScore(liste, aktVok.id, berechneDiktatScore(aktVok.akzentFortschritt, gesamt(akzent) === "richtig" ? "richtig" : "aufgedeckt"));
    }
    return { spaltenErgebnisse, vokErgebnis, erstbewertung, gewertet, liste, sessionFalsch };
  }

  function pruefeAntwort() {
    if (!quiz || !quiz.eingabe.trim()) return;
    const eingabe = quiz.eingabe.trim();

    // Modus "Einfach": fehlende/falsche Akzente zählen als richtig (mit Hinweis)
    const tolerant = stufenRegeln(einstellungen).akzenteTolerant;
    let akzentHinweis = false;

    function setzeRichtigAufgedeckt(updates) {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (sofortWeiter(quiz) && !akzentHinweis) { setQuiz(prev => weiterNachSpalte({...prev, ...updates}, true)); return; }
      setQuiz(prev => ({...prev, eingabe: "", phase: "aufgedeckt", flash: false,
        richtigAufgedeckt: true, feedback: akzentHinweis ? AKZENT_HINWEIS : "", falschFlash: false, aktuelleFehlversuche: 0, ...updates}));
    }

    if (quiz.phase === "weitere") {
      const erwartet = quiz.antwortTeile[quiz.weitereIndices[quiz.weiterePos]];
      const treffer = istRichtigeAntwort(eingabe, erwartet, tolerant);
      if (treffer) {
        if (treffer === "akzent") akzentHinweis = true;
        const naechstePos = quiz.weiterePos + 1;
        if (naechstePos >= quiz.weitereIndices.length) {
          // Alle "weitere" erledigt → Lösung zeigen, warten
          setzeRichtigAufgedeckt({});
        } else {
          // Nächstes "weitere" ohne Flash
          setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: akzentHinweis ? AKZENT_HINWEIS : ""}));
        }
      } else {
        setQuiz(prev => ({...prev, eingabe: "", phase: "weitere", feedback: "Nicht ganz – versuch nochmal."}));
      }
      return;
    }

    let matchIdx = quiz.antwortTeile.findIndex(t => istRichtigeAntwort(eingabe, t) === true);
    if (matchIdx === -1 && tolerant) {
      matchIdx = quiz.antwortTeile.findIndex(t => istRichtigeAntwort(eingabe, t, true));
      if (matchIdx !== -1) akzentHinweis = true;
    }

    if (matchIdx !== -1) {
      const abschluss = spaltenAbschluss("richtig");
      const restIndices = quiz.antwortTeile.map((_, i) => i).filter(i => i !== matchIdx);

      if (restIndices.length > 0) {
        // Mehrere Teile (was/were): direkt zu "weitere", Spalte gilt bereits als richtig
        setQuiz(prev => ({...prev, ...abschluss, eingabe: "", phase: "weitere", weitereIndices: restIndices, weiterePos: 0, feedback: akzentHinweis ? AKZENT_HINWEIS : ""}));
      } else {
        // Spalte fertig → Lösung zeigen, warten
        setzeRichtigAufgedeckt(abschluss);
      }
    } else {
      const neueFehlversuche = (quiz.aktuelleFehlversuche || 0) + 1;
      if (neueFehlversuche >= 3) {
        // 3. Fehlversuch: Spalte falsch, Lösung automatisch anzeigen
        const abschluss = spaltenAbschluss("falsch");
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setQuiz(prev => ({...prev, ...abschluss, eingabe: "", phase: "aufgedeckt", flash: false,
          feedback: "", falschFlash: false, aktuelleFehlversuche: 0}));
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
        // Nach einem Fehlklick darf weitergesucht werden – die Spalte zählt aber als nicht gewusst
        const fehlklick = quiz.spaltenErgebnisse?.[quiz.antwortTypIndex] === "falsch";
        const abschluss = spaltenAbschluss(fehlklick ? "falsch" : "richtig");
        if (!fehlklick && sofortWeiter(quiz)) { setQuiz(prev => weiterNachSpalte({...prev, ...abschluss, mcButtons: neueButtons}, true)); return; }
        setQuiz(prev => ({
          ...prev, ...abschluss, mcButtons: neueButtons,
          phase: "aufgedeckt", flash: false, richtigAufgedeckt: !fehlklick,
          feedback: fehlklick ? MC_FEHLKLICK_HINWEIS : "",
        }));
      } else {
        setQuiz(prev => ({...prev, mcButtons: neueButtons}));
      }
    } else {
      setQuiz(prev => ({...prev,
        spaltenErgebnisse: { ...(prev.spaltenErgebnisse || {}), [prev.antwortTypIndex]: "falsch" },
        mcButtons: prev.mcButtons.map((b, i) => i === idx ? {...b, status: "falsch"} : b)}));
      setTimeout(() => {
        setQuiz(prev => ({...prev, mcButtons: prev.mcButtons.map((b, i) => i === idx ? {...b, status: "neutral"} : b)}));
      }, 500);
    }
  }

  function zeigeLosung() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // Fehlklick bei Multiple Choice bleibt "falsch", auch wenn danach die Lösung angezeigt wird
    const schonFalsch = quiz.spaltenErgebnisse?.[quiz.antwortTypIndex] === "falsch";
    const abschluss = spaltenAbschluss(schonFalsch ? "falsch" : "aufgedeckt");
    const aktModus = quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] || STANDARD_ANTWORT_MODUS;
    const mcUpd = aktModus === "mc"
      ? { mcButtons: quiz.mcButtons.map(b => b.korrekt ? {...b, status: "richtig"} : b) }
      : {};
    setQuiz(prev => ({...prev, ...abschluss, eingabe: "", flash: false, phase: "aufgedeckt",
      feedback: "", falschFlash: false, aktuelleFehlversuche: 0, ...mcUpd}));
  }

  function ueberspringeWeitere() {
    const naechstePos = quiz.weiterePos + 1;
    if (naechstePos >= quiz.weitereIndices.length) {
      mitFlash({}, prev => weiterNachSpalte(prev, true));
    } else {
      setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: ""}));
    }
  }

  function wechsleZuMC() {
    const typ = quiz?.antwortTypen?.[quiz.antwortTypIndex];
    const aktuellerModus = quiz?.spalteModus?.[typ] || STANDARD_ANTWORT_MODUS;
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
    // Auch nach falscher/aufgedeckter Spalte die restlichen Spalten abfragen
    flashWeiterRef.current = null;
    if (quiz.phase === "aufgedeckt") {
      setQuiz(prev => weiterNachSpalte(prev, !!prev.richtigAufgedeckt));
    } else {
      setQuiz(prev => naechsteVokabelState(prev));
    }
  }

  // Zwischenkarte "Wiederholung": weiter zu den zu wiederholenden Vokabeln oder direkt zur Auswertung
  function starteWiederholung() {
    setQuiz(prev => prev?.phase === "wiederholungHinweis" ? {...prev, phase: "eingabe"} : prev);
  }
  function brecheWiederholungAb() {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => prev?.phase === "wiederholungHinweis" || prev?.wiederholungDurchgang
      ? {...prev, phase: "fertig", flash: false} : prev);
  }

  // Akzent-Modus: Auswahl gehört zu genau einer Vokabel-Spalte (Schlüssel), sonst Neustart mit Grundbuchstaben
  function akzentStand(q) {
    const typ = q.antwortTypen[q.antwortTypIndex];
    const vok = q.vokabeln[q.index];
    const key = `${vok?.id}|${q.antwortTypIndex}|${q.abfrageZiel?.runde || 0}|${q.wiederholungDurchgang || 0}`;
    const kacheln = akzentKacheln(vok?.[typ]?.wert || "");
    const a = q.akzent?.key === key ? q.akzent : null;
    return { key, typ, kacheln, wahl: a ? a.wahl : kacheln.map(k => k.basis), aktiv: a ? a.aktiv : null,
      geprueft: !!a?.geprueft, fehler: !!a?.fehler, blink: a ? a.blink : null, pruefFehler: !!a?.pruefFehler };
  }
  // Kachel braucht einen Akzent bzw. eine Ligatur (die von der Ligatur verbrauchte Kachel nicht)
  const kachelMitAkzent = k => k.richtig !== "" && k.richtig !== k.basis;
  // Fehlgriff: Kachel kurz rot aufleuchten lassen; zählt wie ein Fehlklick bei MC (Vokabel gilt als nicht gewusst)
  function akzentFehlgriff(s, i, extra = {}) {
    if (akzentBlinkRef.current) clearTimeout(akzentBlinkRef.current);
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl: s.wahl, aktiv: null, fehler: true, blink: i, pruefFehler: s.pruefFehler, ...extra }}));
    akzentBlinkRef.current = setTimeout(() => {
      setQuiz(prev => prev?.akzent?.key === s.key ? {...prev, akzent: {...prev.akzent, blink: null}} : prev);
    }, 600);
  }
  function waehleAkzentKachel(i) {
    if (!quiz || quiz.phase !== "eingabe") return;
    const s = akzentStand(quiz);
    const k = s.kacheln[i];
    if (s.wahl[i] === k.richtig && kachelMitAkzent(k)) return;   // schon richtig gesetzt
    // Akzent-Buchstaben hervorgehoben → Fehlgriff nur anzeigen, nicht als Fehler werten
    if (!kachelMitAkzent(k)) { akzentFehlgriff(s, i, stufenRegeln(einstellungen).akzentHervorheben ? { fehler: s.fehler } : {}); return; }
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl: s.wahl, fehler: s.fehler, blink: null, pruefFehler: s.pruefFehler, aktiv: s.aktiv === i ? null : i }}));
  }
  function setzeAkzentVariante(v) {
    if (!quiz || quiz.phase !== "eingabe") return;
    const s = akzentStand(quiz);
    const i = s.aktiv;
    if (i == null) return;
    if (v !== s.kacheln[i].richtig) { akzentFehlgriff(s, i); return; }
    const wahl = [...s.wahl];
    wahl[i] = v;
    if (LIGATUR_TEILE[v]) wahl[i + 1] = "";
    // Alle Akzente gefunden → automatisch als Antwort übernehmen (falls in der Stufe eingestellt)
    if (stufenRegeln(einstellungen).akzentAutoUebernahme && s.kacheln.every((k, j) => wahl[j] === k.richtig)) { schliesseAkzenteAb({ ...s, wahl }); return; }
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl, aktiv: null, fehler: s.fehler, blink: null, pruefFehler: s.pruefFehler }}));
  }
  function schliesseAkzenteAb(s) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const komplett = s.kacheln.every((k, i) => s.wahl[i] === k.richtig);
    const richtig = komplett && !s.fehler;
    const abschluss = spaltenAbschluss(richtig ? "richtig" : "falsch");
    if (richtig && sofortWeiter(quiz)) { setQuiz(prev => weiterNachSpalte({...prev, ...abschluss}, true)); return; }
    setQuiz(prev => ({...prev, ...abschluss, akzent: { key: s.key, wahl: s.wahl, aktiv: null, geprueft: true, fehler: s.fehler, blink: null },
      // richtig gelöst → Karte grün, auch nach Fehlgriff (zählt dann trotzdem als nicht gewusst, Hinweis rot)
      eingabe: "", phase: "aufgedeckt", flash: false, richtigAufgedeckt: komplett,
      feedback: richtig ? "" : komplett ? "Nicht fehlerfrei – richtig gelöst, zählt aber als nicht gewusst."
        : "Nicht ganz – rot markierte Buchstaben fehlen noch.", falschFlash: false, aktuelleFehlversuche: 0}));
  }
  // Prüfen: vollständig → abschließen; sonst fehlende Akzente rot markieren, korrigieren oder Lösung anzeigen
  function pruefeAkzente() {
    if (!quiz || quiz.phase !== "eingabe") return;
    const s = akzentStand(quiz);
    if (s.kacheln.every((k, i) => s.wahl[i] === k.richtig)) { schliesseAkzenteAb(s); return; }
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl: s.wahl, aktiv: null, fehler: true, blink: null, pruefFehler: true },
      feedback: "Nicht ganz – rot markierte Buchstaben korrigieren oder „Lösung anzeigen“."}));
  }

  function deckeKarteAuf() {
    if (!quiz || quiz.phase !== "eingabe") return;
    const typ = quiz.antwortTypen?.[quiz.antwortTypIndex];
    if ((quiz.spalteModus?.[typ] || STANDARD_ANTWORT_MODUS) !== "karte") return;
    setQuiz(prev => ({...prev, phase: "aufgedeckt", eingabe: "", flash: false, feedback: ""}));
  }

  function bewerteKarte(gewusst) {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const abschluss = spaltenAbschluss(gewusst ? "richtig" : "falsch");

    if (gewusst) mitFlash(abschluss, prev => weiterNachSpalte(prev, true));
    else mitVerzoegerung({...abschluss, karteNeinFlash: true}, prev => weiterNachSpalte(prev, false), 800);
  }

  function pruefeDiktatAntwort() {
    if (!quiz || !quiz.eingabe.trim()) return;
    const aktVok = quiz.vokabeln[quiz.index];
    const wort = aktVok[quiz.diktatSpalte]?.wert || "";
    const treffer = istRichtigeAntwort(quiz.eingabe.trim(), wort, stufenRegeln(einstellungen).akzenteTolerant);
    if (treffer) {
      const neuFortschritt = berechneDiktatScore(aktVok.diktatFortschritt, "richtig");
      const neueListe = speichereDiktatScore(quiz.liste, aktVok.id, neuFortschritt);
      const ergebnis = { vokId: aktVok.id, wort, uebersetzung: aktVok[quiz.diktatUeberspalte]?.wert, richtig: true };
      setQuiz(prev => ({
        ...prev, liste: neueListe, eingabe: "", phase: "richtig", flash: false,
        diktatErgebnisse: [...prev.diktatErgebnisse, ergebnis], feedback: treffer === "akzent" ? AKZENT_HINWEIS : "",
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
        vorigeAntworten: prev.vorigeAntworten.slice(0, -1),
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
      if (quiz.istSessionModus) {
        const aktSlot = lsGet(SK.sessionAktiv);
        const schonAbgefragt = new Set([...((aktSlot?.abgefragt) || []), ...(quiz.sessionVokIds || [])]);
        const istLetzteBatch = schonAbgefragt.size >= (quiz.sessionGesamt || 0);
        const doBeende = (letzteRunde) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], letzteRunde); beendeQuiz(); };
        const doWeiter = (n) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], false); setQuizPaketGroesse(n); starteDiktat(); };
        return (
          <>
            <style>{CSS}</style>
            <div className="app">
              <div className="topbar">
                <button {...tt("Schließen – Fortschritt wird gespeichert, zurück zur Übersicht")} className="topbar-back" onClick={() => doBeende(istLetzteBatch)}>Schließen</button>
                <span className="topbar-title">{istLetzteBatch ? "Durchlauf abgeschlossen" : "Paket fertig"}</span>
                <span className="quiz-fortschritt">{richtig}/{quiz.diktatErgebnisse.length} ✓</span>
              </div>
              <div className="sektion">
                {istLetzteBatch ? (
                  <div className="jubel" data-jubel style={{paddingTop:24}}>
                    <span className="jubel-emoji">🎉</span>
                    <div className="jubel-titel">{jubelText((quiz.sessionVokIds || []).join())}</div>
                    <div className="jubel-sub">Alle {quiz.sessionGesamt} Vokabeln dieser Session abgefragt</div>
                  </div>
                ) : (
                <div className="leer">
                  <div style={{fontSize:"2.5rem"}}>✓</div>
                  <div className="leer-text">Paket abgeschlossen!</div>
                  <div style={{fontSize:"0.85rem", color:"#6b6560", marginTop:4}}>
                    {schonAbgefragt.size} / {quiz.sessionGesamt} ({Math.round(schonAbgefragt.size / Math.max(1, quiz.sessionGesamt) * 100)}%)
                  </div>
                </div>
                )}
                {istLetzteBatch ? (
                  <>
                  <button data-nochmal {...tt("Session gleich noch einmal von vorn durchlaufen – Scores bleiben, der Abgefragt-Stand beginnt neu")} className="btn btn-primary" style={{width:"100%", marginBottom:8, fontSize:"1.05rem"}}
                    onClick={() => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], true); starteDiktat(true); }}>🔁 Nochmal!</button>
                  <button {...tt("Durchlauf beenden und zur Übersicht")} className="btn btn-ghost-filled" style={{width:"100%"}} onClick={() => doBeende(true)}>Zur Übersicht</button>
                  <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(() => doBeende(true))} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button></>
                ) : (
                  <>
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:"0.78rem", color:"#6b6560", marginBottom:6}}>Nächstes Paket:</div>
                      <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                        {[5,10,15,20,25,30,40,50].map(n => (
                          <button {...tt(`Nächstes Paket mit ${n} Vokabeln`)} key={n} className={`typ-btn${quizPaketGroesse===n?" aktiv":""}`}
                            onClick={() => setQuizPaketGroesse(n)}>{n}</button>
                        ))}
                      </div>
                    </div>
                    <button {...tt("Nächstes Paket starten – bereits abgefragte Vokabeln werden übersprungen")} className="btn btn-primary" style={{width:"100%", marginBottom:8}} onClick={() => doWeiter(quizPaketGroesse)}>
                      Nächste {quizPaketGroesse} Vokabeln
                    </button>
                    <button {...tt("Pause – Fortschritt bleibt gespeichert, später über die Session weitermachen")} className="btn btn-ghost" style={{width:"100%"}} onClick={() => doBeende(false)}>Pause</button>
                  </>
                )}
              </div>
            </div>
          </>
        );
      }
      return (
        <>
          <style>{CSS}</style>
          <div className="app">
            <div className="topbar">
              <button {...tt(quiz.ausStatistik ? "Diktat schließen und zurück zur Statistik" : "Diktat schließen und zur Übersicht")} className="topbar-back" onClick={() => { quiz.ausStatistik ? zurueckZurStatistik() : beendeQuiz(); }}>Schließen</button>
              <span className="topbar-title">Diktat abgeschlossen</span>
              <span className="quiz-fortschritt">{richtig} / {quiz.diktatErgebnisse.length} ✓</span>
            </div>
            <div className="sektion">
              <button {...tt("Diktat beenden und zur Übersicht")} className="btn btn-primary" style={{width:"100%"}}
                onClick={() => { beendeQuiz(); }}>
                Zurück zur Liste
              </button>
              <div style={{marginBottom:16}}><button data-zurueck-statistik={quiz.ausStatistik ? "" : undefined} className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(beendeQuiz)} {...tt(quiz.ausStatistik ? "Zurück zur Statistik, aus der diese Runde gestartet wurde" : "Statistik zu dieser Abfragerunde öffnen")}>📊 {quiz.ausStatistik ? "Zurück zur Statistik" : "Zur Statistik"}</button></div>
              <div className="karte">
                <div {...tt("Liste der Diktat-Ergebnisse auf- oder zuklappen")} style={{padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer"}}
                  onClick={() => setDiktatListeAufgeklappt(v => !v)}>
                  <span style={{fontWeight:600}}>{richtig} / {quiz.diktatErgebnisse.length} richtig</span>
                  <button {...tt("Liste der Diktat-Ergebnisse auf- oder zuklappen")} className="btn-toggle" style={{padding:"3px 6px"}} onClick={e => { e.stopPropagation(); setDiktatListeAufgeklappt(v => !v); }}>
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
            <button {...tt("Diktat abbrechen – bisherige Ergebnisse werden ausgewertet")} className="topbar-back" onClick={() => { beendeQuiz(); }}>Beenden</button>
            <span className="topbar-title">{quiz.index + 1} / {quiz.vokabeln.length}</span>
            <span className="quiz-fortschritt">Score: {diktatScore > 0 ? "+" : ""}{diktatScore}</span>
          </div>
          <div className="sektion" style={{display:"flex", flexDirection:"column", paddingBottom:0}}>
            {/* Lautsprecher-Box – nicht Teil der Weiter-Zone */}
            <div className="quiz-frage-box" style={{textAlign:"center", marginBottom:14, flexShrink:0}}>
              <div className="quiz-label">{quiz.liste.spalten[quiz.diktatSpalte]?.name || quiz.diktatSpalte} — hör genau hin!</div>
              {quiz.diktatSpalte.startsWith('E') && (
                <button {...tt("Wort vorlesen")} className="diktat-play-btn"
                  onClick={() => { setDiktatManualPlays(p => p + 1); sprich(diktatWort, vokLang(aktVok, quiz.diktatSpalte)); }}>
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
                  <input {...ttFeld("Das vorgelesene Wort hier eintippen, dann „Prüfen“")} ref={eingabeRef} className="inp"
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
                    {quiz.feedback && <div className="quiz-feedback ok" style={{marginTop:6}}>{quiz.feedback}</div>}
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
                    <button className="btn btn-primary" onClick={pruefeDiktatAntwort} {...tt("Eingegebene Lösung prüfen")}>Prüfen</button>
                    {quiz.diktatSpalte.startsWith('E') && (
                      <button className="btn btn-ghost" onClick={() => sprichDiktatNochmal(diktatWort, vokLang(aktVok, quiz.diktatSpalte))} {...tt("Diktat-Wort nochmals mit anderer Stimme vorlesen")}><IcoSpkOn s={18}/> Andere Stimme</button>
                    )}
                    <button className="btn btn-ghost" onClick={zeigeDiktatLoesung} {...tt("Lösung anzeigen – kein Punkt, kein Streak")}>Lösung anzeigen</button>
                  </>
                )}
                {diktatWeiter && (
                  <button className="btn btn-primary" onClick={e => { e.stopPropagation(); naechsteDiktatVokabel(); }} {...tt("Nächste Vokabel")}>Weiter →</button>
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
      if (quiz.istSessionModus) {
        const aktSlot = lsGet(SK.sessionAktiv);
        // nur Vokabeln der aktuellen Session-Menge zählen (Slot kann aus anderer Einstellung stammen)
        const sessionMenge = quiz.sessionIds ? new Set(quiz.sessionIds) : null;
        const schonAbgefragt = new Set([...((aktSlot?.abgefragt) || []), ...(quiz.sessionVokIds || [])].filter(id => !sessionMenge || sessionMenge.has(id)));
        const istLetzteBatch = schonAbgefragt.size >= (quiz.sessionGesamt || 0);
        const doBeende = (letzteRunde) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], letzteRunde); beendeQuiz(); };
        const doWeiter = (n) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], false); setQuizPaketGroesse(n); starteQuiz(); };
        const r = quiz.quizRichtigAnzahl || 0;
        const f = quiz.quizFalschAnzahl || 0;
        const ges = r + f;
        const feedback = getQuizFeedback(r, ges);
        const sessionPct = Math.round(schonAbgefragt.size / Math.max(1, quiz.sessionGesamt) * 100);
        return (
          <>
            <style>{CSS}</style>
            <div className="app">
              <div className="topbar">
                <button {...tt("Schließen – Fortschritt wird gespeichert, zurück zur Übersicht")} className="topbar-back" onClick={() => doBeende(istLetzteBatch)}>Schließen</button>
                <span className="topbar-title">{quiz.abgebrochen ? "Abgebrochen" : istLetzteBatch ? "Durchlauf abgeschlossen" : "Paket fertig"}</span>
                <span className="quiz-fortschritt">{schonAbgefragt.size}/{quiz.sessionGesamt}</span>
              </div>
              <div className="sektion">
                {/* Session-Fortschritt: wie viele Vokabeln der Vokabelgruppe schon abgefragt */}
                <div style={{padding:"8px 0 16px"}} {...tt("So viele Vokabeln dieser Vokabelgruppe wurden in diesem Durchlauf schon abgefragt")}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6}}>
                    <span style={{fontWeight:700, fontSize:"1.05rem", color:"#3b3832"}}>{schonAbgefragt.size} von {quiz.sessionGesamt} Vokabeln abgefragt</span>
                    <span style={{fontSize:"0.85rem", color:"#6b6560"}}>{sessionPct} %</span>
                  </div>
                  <div style={{background:"#e8e4dc", borderRadius:8, height:10, overflow:"hidden"}}>
                    <div style={{width:`${sessionPct}%`, height:"100%", background:"#2d6a4f", borderRadius:8}}/>
                  </div>
                </div>
                {istLetzteBatch && !quiz.abgebrochen && (
                  <div className="jubel" data-jubel>
                    <span className="jubel-emoji">🎉</span>
                    <div className="jubel-titel">{jubelText((quiz.sessionVokIds || []).join())}</div>
                    <div className="jubel-sub">Alle {quiz.sessionGesamt} Vokabeln dieser Session abgefragt</div>
                  </div>
                )}
                {/* Paket-Auswertung */}
                {ges > 0 && (<>
                  {renderRundenErgebnis(quiz, r, f, quiz.abgebrochen ? "Bis zum Abbruch" : istLetzteBatch ? "Letztes Paket" : "Dieses Paket")}
                  {feedback && (
                    <div style={{background:"#f7f5f0", borderRadius:12, padding:"14px 16px", margin:"0 0 16px", fontSize:"1rem", lineHeight:1.6, color:"#3b3832", fontStyle:"italic", textAlign:"center"}}>
                      „{feedback}"
                    </div>
                  )}
                </>)}
                {quiz.abgebrochen ? (
                  <><button {...tt("Zur Quiz-Übersicht")} className="btn btn-primary" style={{width:"100%"}} onClick={() => beendeQuiz()}>Zur Übersicht</button>
                  <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(beendeQuiz)} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button></>
                ) : istLetzteBatch ? (
                  <>
                  <button data-nochmal {...tt("Session gleich noch einmal von vorn durchlaufen – Scores bleiben, der Abgefragt-Stand beginnt neu")} className="btn btn-primary" style={{width:"100%", marginBottom:8, fontSize:"1.05rem"}}
                    onClick={() => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], true); starteQuiz(true); }}>🔁 Nochmal!</button>
                  <button {...tt("Durchlauf beenden und zur Quiz-Übersicht")} className="btn btn-ghost-filled" style={{width:"100%"}} onClick={() => doBeende(true)}>Zur Übersicht</button>
                  <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(() => doBeende(true))} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button></>
                ) : (
                  <>
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:"0.78rem", color:"#6b6560", marginBottom:6}}>Nächstes Paket:</div>
                      <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                        {[5,10,15,20,25,30,40,50].map(n => (
                          <button {...tt(`Nächstes Paket mit ${n} Vokabeln`)} key={n} className={`typ-btn${quizPaketGroesse===n?" aktiv":""}`}
                            onClick={() => setQuizPaketGroesse(n)}>{n}</button>
                        ))}
                      </div>
                    </div>
                    <button {...tt("Nächstes Paket starten – bereits abgefragte Vokabeln werden übersprungen")} className="btn btn-primary" style={{width:"100%", marginBottom:8}} onClick={() => doWeiter(quizPaketGroesse)}>
                      Nächste {quizPaketGroesse} Vokabeln
                    </button>
                    <button {...tt("Pause – Fortschritt bleibt gespeichert, später über die Session weitermachen")} className="btn btn-ghost" style={{width:"100%"}} onClick={() => doBeende(false)}>Pause</button>
                  </>
                )}
              </div>
            </div>
          </>
        );
      }
      {
        const r = quiz.quizRichtigAnzahl || 0;
        const f = quiz.quizFalschAnzahl || 0;
        const ges = r + f;
        const feedback = getQuizFeedback(r, ges);
        return (
          <>
            <style>{CSS}</style>
            <div className="app">
              <div className="topbar">
                <button {...tt(quiz.ausStatistik ? "Auswertung schließen und zurück zur Statistik" : "Auswertung schließen und zur Quiz-Übersicht")} className="topbar-back" onClick={() => { quiz.ausStatistik ? zurueckZurStatistik() : beendeQuiz(); }}>Schließen</button>
                <span className="topbar-title">{quiz.abgebrochen ? "Abgebrochen" : "Auswertung"}</span>
                <span className="quiz-fortschritt">{r}/{ges}</span>
              </div>
              <div className="sektion">
                <div style={{height:8}}/>
                {renderRundenErgebnis(quiz, r, f, quiz.abgebrochen ? "Bis zum Abbruch" : "Diese Runde")}
                {feedback && (
                  <div style={{background:"#f7f5f0", borderRadius:12, padding:"14px 16px", margin:"0 0 16px", fontSize:"1rem", lineHeight:1.6, color:"#3b3832", fontStyle:"italic", textAlign:"center"}}>
                    „{feedback}"
                  </div>
                )}
                {quiz.ausStatistik ? (<>
                  <button data-zurueck-statistik {...tt("Zurück zur Statistik, aus der diese Runde gestartet wurde")} className="btn btn-primary" style={{width:"100%"}} onClick={zurueckZurStatistik}>📊 Zurück zur Statistik</button>
                  <button {...tt("Zur Quiz-Übersicht")} className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => { beendeQuiz(); }}>Zur Übersicht</button>
                </>) : (<>
                <button {...tt("Zur Quiz-Übersicht")} className="btn btn-primary" style={{width:"100%"}} onClick={() => { beendeQuiz(); }}>
                  Zur Übersicht
                </button>
                <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(beendeQuiz)} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button>
                </>)}
              </div>
            </div>
          </>
        );
      }
    }

    if (quiz.phase === "wiederholungHinweis") {
      const n = quiz.vokabeln.length;
      const grund = quiz.abfrageZiel?.modus === "score"
        ? "haben das Score-Ziel noch nicht erreicht"
        : quiz.abfrageZiel?.wiederholung > 1 ? `wurden noch nicht ${quiz.abfrageZiel.wiederholung}× richtig beantwortet` : "wurden falsch beantwortet";
      return (
        <>
          <style>{CSS}</style>
          <div className="app">
            <div className="topbar">
              <button {...tt("Wiederholung abbrechen und zur Auswertung")} className="topbar-back" onClick={brecheWiederholungAb}>Beenden</button>
              <span className="topbar-title">Wiederholung</span>
              <span className="quiz-fortschritt">{n} Vok.</span>
            </div>
            <div className="sektion">
              <div className="quiz-frage-box wiederholung-karte" onClick={starteWiederholung} style={{cursor:"pointer", padding:"34px 16px"}}
                {...tt("Antippen: weiter zu den Vokabeln, die wiederholt werden")}>
                <div style={{fontSize:"2.2rem", lineHeight:1}}>🔁</div>
                <div className="quiz-frage-text" style={{textAlign:"center", marginTop:10}}>
                  Wiederholung{quiz.wiederholungDurchgang > 1 ? ` ${quiz.wiederholungDurchgang}` : ""}
                </div>
                <div style={{textAlign:"center", fontSize:"0.9rem", color:"#6b6560", marginTop:10, lineHeight:1.5}}>
                  {quiz.wiederholungDurchgang > 1 ? "Weiter geht's" : "Alle Vokabeln wurden abgefragt"}.<br/>
                  {n === 1 ? "1 Vokabel" : `${n} Vokabeln`} {n === 1 ? grund.replace(/^haben/, "hat").replace(/^wurden/, "wurde") : grund} und {n === 1 ? "kommt" : "kommen"} jetzt noch einmal.
                </div>
              </div>
              <button className="btn btn-primary" style={{width:"100%", marginTop:14}} onClick={starteWiederholung}
                {...tt("Weiter zu den Vokabeln, die wiederholt werden")}>Weiter zur Wiederholung</button>
              <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={brecheWiederholungAb}
                {...tt("Wiederholung auslassen und direkt zur Auswertung – die Wertung der Runde bleibt gleich")}>Wiederholung abbrechen</button>
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
    const aktSpaltModus = quiz.spalteModus?.[aktAntwortTyp] || STANDARD_ANTWORT_MODUS;
    const isKarteEingabe = aktSpaltModus === "karte" && quiz.phase === "eingabe";
    const isKarteAufgedeckt = aktSpaltModus === "karte" && quiz.phase === "aufgedeckt" && !quiz.karteNeinFlash;
    const richtigAufgedeckt = !!quiz.richtigAufgedeckt && quiz.phase === "aufgedeckt";
    const infoSpalten = (quiz.sitzungsInfoTypen || []).filter(t => aktVokRaw[t]?.wert);
    // Karten-Modus: Info-Kasten unter der Antwort ("i" in der Kopfzeile schaltet ihn dauerhaft, Pinnadel hält ihn offen)
    // Kasten und "i" gibt es, sobald die Session eine Info-Spalte hat – auch für Vokabeln ohne Info-Text
    const karteMitInfo = aktSpaltModus === "karte" && (quiz.sitzungsInfoTypen || []).length > 0;
    const karteInfoAn = einstellungen.karteInfo !== false;
    const karteInfoPin = !!einstellungen.karteInfoPin;
    const karteInfoOffen = karteInfoPin || quiz.infoSichtbar;
    const akz = aktSpaltModus === "akzent" ? akzentStand(quiz) : null;
    const akzLang = vokLang(aktVok, aktAntwortTyp);
    const akzLoesung = !!akz && quiz.phase === "aufgedeckt" && !akz.geprueft && !quiz.flash;
    const score = clampScore(akz ? aktVok?.akzentFortschritt?.score : aktVok?.fortschritt?.score);
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
            {quiz.wiederholungDurchgang ? (
              <button {...tt("Wiederholung abbrechen und zur Auswertung")} className="topbar-back" onClick={brecheWiederholungAb}>Beenden</button>
            ) : (
              <button {...tt("Quiz abbrechen – bisher beantwortete Vokabeln werden ausgewertet")} className="topbar-back" onClick={() => { brecheQuizAb(); }}>Beenden</button>
            )}
            {karteMitInfo && (
              <button data-karte-info-schalter={karteInfoAn ? "an" : "aus"} className="topbar-back"
                style={{width:36, height:36, padding:0, borderRadius:"50%", fontWeight:800, fontFamily:"Georgia, serif", fontSize:"1.05rem",
                  ...(karteInfoAn ? {} : {background:"#fff", color:"#2d6a4f", border:"1.5px solid #2d6a4f"})}}
                onClick={() => speichereEinst({...einstellungen, karteInfo: !karteInfoAn})}
                {...tt(karteInfoAn ? "Info-Kasten ausblenden (gilt dauerhaft)" : "Info-Kasten einblenden (gilt dauerhaft)")}>i</button>
            )}
            <span className="topbar-title">
              {quiz.wiederholungDurchgang ? <span className="wiederholung-marke" {...tt("Diese Vokabeln werden wiederholt, weil sie noch nicht sicher sitzen")}>🔁 Wiederholung </span> : null}
              {quiz.index + 1} / {quiz.vokabeln.length}
            </span>
            <span className="quiz-fortschritt" {...tt(akz ? "Eigener Akzent-Score dieser Vokabel" : "Score dieser Vokabel")}>{akz ? "Akzente" : "Score"}: {score > 0 ? "+" : ""}{score}</span>
          </div>
          <div className="sektion"
            onClick={(quiz.flash || quiz.karteNeinFlash) ? beendeVerzoegerung : isKarteEingabe ? deckeKarteAuf : richtigAufgedeckt ? naechsteVokabel : undefined}
            style={(quiz.flash || quiz.karteNeinFlash) ? {cursor:"pointer", minHeight:"70vh"}
              : (isKarteEingabe || richtigAufgedeckt) ? {cursor:"pointer", minHeight: isKarteEingabe ? "70vh" : undefined} : undefined}>

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
                          <button {...tt("Frage vorlesen")} className="btn-icon" style={{fontSize:"1.1rem", padding:"2px 4px"}}
                            onClick={e => { e.stopPropagation(); sprich(frageWert, vokLang(aktVok, quiz.frageTyp)); }}><IcoSpk s={16}/></button>
                        )}
                      </div>
                    </div>

                    {quiz.vorigeAntworten.map((v, i) => (
                      <div key={i} className={`quiz-vorig${v.richtig ? "" : " nicht"}`} data-vorig={v.richtig ? "richtig" : "falsch"}>
                        <div className="quiz-vorig-label">{v.richtig ? "✓" : "✗"} {v.label}</div>
                        <div style={{textAlign:"center", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", gap:6}}>
                          <strong>{v.wert}</strong>
                          {v.typ.startsWith('E') && (
                            <button {...tt("Diese Antwort vorlesen")} className="btn-icon" style={{fontSize:"0.95rem", padding:"2px 4px"}}
                              onClick={e => { e.stopPropagation(); sprich(v.wert, vokLang(aktVok, v.typ)); }}><IcoSpk s={16}/></button>
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
                            <button {...tt("Diese Antwort wählen – nur ein Treffer ohne Fehlklick zählt als gewusst")} key={idx}
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
                        <input {...ttFeld("Antwort eintippen und mit Enter oder „Prüfen“ bestätigen")} ref={eingabeRef} className="inp"
                          value={quiz.eingabe}
                          onChange={e => setQuiz(prev => ({...prev, eingabe: e.target.value}))}
                          onKeyDown={e => e.key === "Enter" && pruefeAntwort()}
                          onClick={e => e.stopPropagation()}
                          placeholder="Antwort eingeben…"
                          style={{marginTop:4}}
                        />
                      )}
                      {aktSpaltModus === "tippen" && !quiz.flash && isWeitere && (
                        <input {...ttFeld("Weitere richtige Antwort eintippen (z. B. bei was/were)")} ref={eingabeRef} className="inp"
                          value={quiz.eingabe}
                          onChange={e => setQuiz(prev => ({...prev, eingabe: e.target.value}))}
                          onKeyDown={e => e.key === "Enter" && pruefeAntwort()}
                          onClick={e => e.stopPropagation()}
                          placeholder="Weitere Antwort eingeben…"
                          style={{marginTop:4}}
                        />
                      )}
                      {/* Akzente: Buchstaben-Kacheln (Umbruch nur zwischen Wörtern), Varianten darunter */}
                      {akz && !quiz.flash && (quiz.phase === "eingabe" || akz.geprueft || akzLoesung) && (() => {
                        // Wörter = Kachel-Indizes zwischen Leerzeichen; Kachelbreite so, dass ≥ 12 Zeichen nebeneinander passen
                        const woerter = [[]];
                        akz.kacheln.forEach((k, i) => { if (k.basis === " ") woerter.push([]); else woerter[woerter.length - 1].push(i); });
                        // „Lösung anzeigen“: Kacheln bleiben stehen und zeigen die richtigen Buchstaben
                        const zeichen = i => akzLoesung ? akz.kacheln[i].richtig : akz.wahl[i];
                        const sichtbar = w => w.filter(i => zeichen(i) !== "").length;
                        const n = Math.max(12, ...woerter.map(sichtbar));
                        const regeln = stufenRegeln(einstellungen);
                        const hervorheben = regeln.akzentHervorheben;
                        const mitAkzent = akz.kacheln.map((k, i) => i).filter(i => kachelMitAkzent(akz.kacheln[i]));
                        const gefunden = mitAkzent.filter(i => akz.wahl[i] === akz.kacheln[i].richtig).length;
                        return (
                        <div className="akzent-rahmen" onClick={e => e.stopPropagation()}>
                          {regeln.akzentZaehler && quiz.phase === "eingabe" && (
                            <div className="akzent-zaehler" {...tt("Richtig gesetzte Akzente / Akzente im Wort")}>
                              Akzente {gefunden} / {mitAkzent.length}
                            </div>
                          )}
                          <div className="akzent-wort" style={{"--n": n}}>
                            {woerter.filter(w => w.length > 0).map((w, wi) => (
                              <span key={wi} className="akzent-wortgruppe">
                                {w.map(i => {
                                  const k = akz.kacheln[i];
                                  const z = zeichen(i);
                                  if (z === "") return null;   // von einer Ligatur (œ, æ, ß) belegt
                                  const status = akz.blink === i ? " blink"
                                    : akz.wahl[i] === k.richtig && kachelMitAkzent(k) ? " ok"
                                    : akzLoesung ? (kachelMitAkzent(k) ? " loesung" : "")
                                    : akz.geprueft ? (z === k.richtig ? (richtigAufgedeckt ? " ok" : "") : " falsch")
                                    : akz.pruefFehler && kachelMitAkzent(k) ? " falsch"
                                    : hervorheben && kachelMitAkzent(k) ? " markiert" : "";
                                  return (
                                    <button key={i} className={`akzent-kachel${akz.aktiv === i ? " aktiv" : ""}${status}`}
                                      onClick={() => waehleAkzentKachel(i)}
                                      {...tt("Buchstaben antippen und darunter den passenden Akzent wählen – ohne Akzent leuchtet er kurz rot")}>{z}</button>
                                  );
                                })}
                              </span>
                            ))}
                          </div>
                          {akz.aktiv != null && quiz.phase === "eingabe" && (
                            <div className="akzent-leiste">
                              {akzentVarianten(akz.kacheln, akz.aktiv, akzLang).map(v => (
                                <button key={v} className="akzent-variante"
                                  onClick={() => setzeAkzentVariante(v)} {...tt(`„${v}“ einsetzen`)}>{v}</button>
                              ))}
                            </div>
                          )}
                          {akzLoesung && (
                            <div style={{display:"flex", justifyContent:"center", marginTop:6}}>
                              <button {...tt("Antwort vorlesen")} className="btn-icon" style={{fontSize:"1rem", padding:"2px 4px"}}
                                onClick={() => sprich(quiz.antwortTeile[0], akzLang)}><IcoSpk s={16}/></button>
                            </div>
                          )}
                          {quiz.phase === "eingabe" && akz.aktiv == null && (
                            <div style={{textAlign:"center", fontSize:"0.78rem", color:"#9b9590", marginTop:8}}>Buchstaben antippen und Akzent wählen</div>
                          )}
                        </div>
                        );
                      })()}
                      {/* Lösung: Flash (richtig) */}
                      {quiz.flash && (
                        <div className="quiz-frage-text" style={{textAlign:"center", color:"#1b5e20", minHeight:"44px", display:"flex", alignItems:"center", justifyContent:"center"}}>
                          {quiz.antwortTeile.join(" / ")}{" ✓"}
                        </div>
                      )}
                      {/* Lösung: Aufgedeckt */}
                      {!quiz.flash && quiz.phase === "aufgedeckt" && !akzLoesung && (
                        aktSpaltModus === "mc"
                          ? <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:8, minHeight:60}}>
                              <div className="quiz-frage-text" style={{textAlign:"center"}}>{quiz.antwortTeile.join(" / ")}</div>
                              {aktAntwortTyp.startsWith('E') && (
                                <button {...tt("Antwort vorlesen")} className="btn-icon" style={{fontSize:"1rem", padding:"2px 4px"}}
                                  onClick={e => { e.stopPropagation(); sprich(quiz.antwortTeile[0], vokLang(aktVok, aktAntwortTyp)); }}><IcoSpk s={16}/></button>
                              )}
                            </div>
                          : <div className="quiz-frage-text" style={{textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:6, minHeight:"44px"}}>
                              {quiz.antwortTeile.join(" / ")}
                              {!isKarteAufgedeckt && aktAntwortTyp.startsWith('E') && (
                                <button {...tt("Antwort vorlesen")} className="btn-icon" style={{fontSize:"1rem", padding:"2px 4px"}}
                                  onClick={e => { e.stopPropagation(); sprich(quiz.antwortTeile[0], vokLang(aktVok, aktAntwortTyp)); }}><IcoSpk s={16}/></button>
                              )}
                            </div>
                      )}
                      {quiz.feedback && !quiz.flash && (
                        <div className={`quiz-feedback ${(quiz.falschFlash || quiz.feedback.startsWith("Nicht")) ? "nein" : "ok"}`}
                          style={{textAlign:"center"}}>
                          {quiz.feedback}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rechte Spalte: Info-Box */}
                  {quiz.infoSichtbar && aktInfoSeite && aktSpaltModus !== "karte" && (
                    <div {...tt("Nächste Info-Seite anzeigen")} onClick={() => setQuiz(prev => ({...prev, infoSeite: ((prev.infoSeite || 0) + 1) % infoSeitenAnzahl}))}
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

            {/* Karten-Modus: Info-Kasten (eingeklappt eine Zeile „Info“) – nur vor dem Aufdecken, danach stehen hier die Bewertungs-Knöpfe */}
            {karteMitInfo && karteInfoAn && !quiz.flash && quiz.phase === "eingabe" && (
              <div data-karte-info={karteInfoOffen ? "offen" : "zu"} onClick={e => { e.stopPropagation(); if (!karteInfoPin) setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar})); }}
                {...tt(karteInfoPin ? "Info-Text (angeheftet)" : karteInfoOffen ? "Info einklappen" : "Info aufklappen")}
                style={{background:"#fffde7", border:"1px solid #ffe082", borderRadius:12, padding: karteInfoOffen ? "10px 12px" : "7px 12px", marginBottom:14, cursor: karteInfoPin ? "default" : "pointer"}}>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{flex:1, fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", color:"#f57f17"}}>Info</span>
                  {karteInfoOffen ? (
                    <button data-karte-info-pin={karteInfoPin ? "an" : "aus"}
                      onClick={e => { e.stopPropagation(); speichereEinst({...einstellungen, karteInfoPin: !karteInfoPin}); if (karteInfoPin) setQuiz(prev => ({...prev, infoSichtbar: true})); }}
                      {...tt(karteInfoPin ? "Lösen – der Info-Kasten kommt wieder eingeklappt" : "Anheften – der Info-Kasten bleibt dauerhaft aufgeklappt")}
                      style={{background: karteInfoPin ? "#ffe082" : "none", border:"none", borderRadius:6, padding:"2px 6px", cursor:"pointer", fontSize:"0.95rem", lineHeight:1,
                        opacity: karteInfoPin ? 1 : 0.45, transform: karteInfoPin ? "none" : "rotate(45deg)"}}>📌</button>
                  ) : (
                    <span style={{fontSize:"0.75rem", color:"#f9a825"}}>▼</span>
                  )}
                </div>
                {karteInfoOffen && infoSpalten.length === 0 && (
                  <div style={{marginTop:6, fontSize:"0.85rem", color:"#9b9590", fontStyle:"italic"}}>Keine Zusatzinfo vorhanden</div>
                )}
                {karteInfoOffen && infoSpalten.map(typ => (
                  <div key={typ} style={{marginTop:6}}>
                    {infoSpalten.length > 1 && <div style={{fontSize:"0.68rem", fontWeight:700, color:"#f9a825"}}>{quiz.liste.spalten[typ]?.name || typ}</div>}
                    <div style={{fontSize:"0.88rem", lineHeight:1.45, whiteSpace:"pre-wrap"}}>{aktVokRaw[typ].wert}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Noch kommende Spalten */}
            {!quiz.flash && quiz.antwortTypen.length > 1 && (quiz.phase === "eingabe" || quiz.phase === "falsch" || isWeitere) && (
              <div style={{fontSize:"0.78rem", color:"#6b6560", marginBottom:10}}>
                Noch: {quiz.antwortTypen.slice(quiz.antwortTypIndex + 1)
                  .map(t => quiz.liste.spalten[t]?.name || t).join(" → ")}
              </div>
            )}

            <div className="quiz-aktionen" onClick={e => e.stopPropagation()}>
              {/* Akzente: Prüfen groß und mittig, übrige Knöpfe klein darunter */}
              {!quiz.flash && quiz.phase === "eingabe" && akz && (
                <div className="akzent-aktionen">
                  <button className="btn btn-primary akzent-pruefen" onClick={pruefeAkzente}
                    {...tt("Antwort übernehmen und prüfen (alle Akzente richtig gesetzt → wird automatisch übernommen)")}>Prüfen</button>
                  <div style={{display:"flex", gap:8, justifyContent:"center"}}>
                    <button className="btn btn-ghost btn-sm" onClick={zeigeLosung} {...tt("Lösung anzeigen – zählt als nicht gewusst")}>Lösung anzeigen</button>
                    {infoSpalten.length > 0 && (
                      <button {...tt("Info-Spalten (z. B. Beispielsatz) ein- oder ausblenden")} className="btn btn-ghost btn-sm"
                        onClick={() => setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar}))}>
                        {quiz.infoSichtbar ? "Info ▲" : "Info"}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!quiz.flash && quiz.phase === "eingabe" && !isKarteEingabe && !akz && (
                <>
                  {aktSpaltModus === "tippen" && (
                    <button className="btn btn-primary" onClick={pruefeAntwort} {...tt("Eingegebene Antwort prüfen")}>Prüfen</button>
                  )}
                  <button className="btn btn-ghost" onClick={zeigeLosung} {...tt("Lösung anzeigen – kein Punkt, kein Streak")}>Lösung anzeigen</button>
                  {infoSpalten.length > 0 && (
                    <button {...tt("Info-Spalten (z. B. Beispielsatz) ein- oder ausblenden")} className="btn btn-ghost"
                      onClick={() => setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar}))}>
                      {quiz.infoSichtbar ? "Info ▲" : "Info"}
                    </button>
                  )}
                </>
              )}
              {!quiz.flash && isWeitere && (
                <>
                  <button className="btn btn-primary" onClick={pruefeAntwort} {...tt("Eingegebene Antwort prüfen")}>Prüfen</button>
                  <button className="btn btn-ghost" onClick={ueberspringeWeitere} {...tt("Vokabel ohne Wertung überspringen")}>Überspringen</button>
                  {infoSpalten.length > 0 && (
                    <button {...tt("Info-Spalten (z. B. Beispielsatz) ein- oder ausblenden")} className="btn btn-ghost"
                      onClick={() => setQuiz(prev => ({...prev, infoSichtbar: !prev.infoSichtbar}))}>
                      {quiz.infoSichtbar ? "Info ▲" : "Info"}
                    </button>
                  )}
                </>
              )}
              {/* Karte: Gewusst / Nicht gewusst */}
              {!quiz.flash && isKarteAufgedeckt && (
                <div className="karte-bewertung" style={{width:"100%"}}>
                  <button className="karte-btn karte-btn-nein" onClick={() => bewerteKarte(false)} {...tt("Antwort war falsch – Score sinkt, Streak auf 0")}>✗ Nicht gewusst</button>
                  <button className="karte-btn karte-btn-ja" onClick={() => bewerteKarte(true)} {...tt("Antwort war richtig – Score +1, Streak +1")}>✓ Gewusst</button>
                </div>
              )}
              {!quiz.flash && quiz.phase === "aufgedeckt" && !isKarteAufgedeckt && (
                <>
                  {quiz.antwortTypIndex > 0 && !richtigAufgedeckt && (
                    <button className="btn btn-primary" onClick={geheZurueck} {...tt("Zur vorherigen Vokabel zurück")}>← Zurück</button>
                  )}
                  <button className="btn btn-primary" onClick={e => { e.stopPropagation(); naechsteVokabel(); }} {...tt("Nächste Vokabel")}>Weiter →</button>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }


  // ── Sprach-Buttons (Import, Liste-Detail) ────────────────────────────────
  const renderSprachAuswahl = (wert, onWahl) => (
    <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
      {SPRACHEN.map(s => (
        <button {...tt(`Fremdsprache ${s.name} – bestimmt Vorlese-Stimme und Sprachfilter`)} key={s.code} className={`typ-btn${wert === s.code ? " aktiv" : ""}`}
          onClick={() => onWahl(s.code)}>{s.flagge} {s.name}</button>
      ))}
    </div>
  );

  // ── Slot-Chip Hilfsfunktionen (Quiz-Tab + Statistik-Tab) ─────────────────
  // Verlauf-Chip: Lang-Druck → Erklärung + "Löschen"
  const renderSlotChip = (id, label, onClick, extraStil = {}, typ = "gespeichert") => (
    <button key={id} className={`slot-chip ${typ === "verlauf" ? "verlauf" : "belegt"}`}
      style={extraStil}
      onClick={onClick}
      {...tt(`${label} – antippen: Konfiguration laden (Liste, Vokabelauswahl und Einstellungen)`,
        [{ label: "🗑 Löschen", gefahr: true, fn: () => setLoescheSlotNr({ typ, id }) }], { langText: label })}>
      {label}
    </button>
  );
  const chipStil = (typ, id, slotRef = aktiverSlot) => {
    const istAktiv = slotRef?.typ === typ && slotRef?.id === id;
    const sf = Object.keys(slotSFAlle(getSlotEintrag(typ, id))).length > 0;
    return istAktiv
      ? {background:"#e8f5ee", borderColor:"#2d6a4f", color:"#2d6a4f"}
      : sf ? {background:"#f0f9f4", borderColor:"#a8d5be", color:"#2d6a4f"} : {};
  };
  // Fortschritt der Abfrageart: beim aktiven Eintrag die gerade eingestellte, sonst die gespeicherte
  const slotChipLabel = (eintrag) => {
    const sf = slotSFAlle(eintrag)[aktiverSlot?.id === eintrag.id ? quizAbfrageArt : slotKonfigArt(eintrag)];
    return sf ? `▶ ${eintrag.name} · ${(sf.abgefragt||[]).length}/${sf.gesamt||0}` : eintrag.name;
  };

  // ── Statistik: Berechnungen ───────────────────────────────────────────────
  const statistikAlleListenObjekte = sichtbareListen.map(l => lsGet(SK.liste(l.id))).filter(Boolean);
  const statistikGewaehlteListenObjekte = statistikListenIds === null
    ? statistikAlleListenObjekte
    : statistikAlleListenObjekte.filter(l => statistikListenIds.has(l.id));
  const statistikBasisVoks = statistikGewaehlteListenObjekte.flatMap((l, lRank) =>
    l.vokabeln.map((v, vIdx) => ({...v, id: `${l.id}__${v.id}`, _origId: v.id, _listeId: l.id, _listeName: l.name, _spalten: l.spalten, _listenIndexRank: lRank, _listIndex: vIdx}))
  );
  const statistikGefilterteVoks = statistikBereichTyp === "bereich" && statistikCheckboxAuswahl.size > 0
    ? statistikBasisVoks.filter(v => statistikCheckboxAuswahl.has(v.id))
    : statistikBasisVoks;

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
        <div className="topbar" style={{position:"relative"}}>
          <button className="info-schalter" data-info-schalter onClick={schalteInfoModus} title="Info-Modus: Elemente antippen, um sie erklärt zu bekommen">ⓘ</button>
          {statistikVollbild && tab === "statistik" ? renderVollbildKopf() : <span className="topbar-title">Vokabel-Trainer</span>}
          {!statistikVollbild && vorhandeneSprachen.length > 1 && (
            <div style={{position:"absolute", right:12, top:"50%", transform:"translateY(-50%)"}}>
              <button className="toggle-opt aktiv" style={{padding:"4px 10px", fontSize:"0.78rem", borderRadius:14, cursor:"pointer"}}
                onClick={() => setSprachMenuOffen(o => !o)}
                {...tt("Sprache wählen – zeigt nur Listen dieser Sprache")}>
                {sprachFilter === "alle" ? "🌐" : sprachInfo(sprachFilter).flagge}
                <span className="sprach-chip-name"> {sprachFilter === "alle" ? "Alle" : sprachInfo(sprachFilter).name}</span> ▾
              </button>
              {sprachMenuOffen && (<>
                <div style={{position:"fixed", inset:0, zIndex:20}} onClick={() => setSprachMenuOffen(false)}/>
                <div className="karte" style={{position:"absolute", right:0, top:"calc(100% + 6px)", zIndex:21, minWidth:220, marginBottom:0, boxShadow:"0 4px 16px rgba(0,0,0,0.15)"}}>
                  {[{ code:"alle", flagge:"🌐", name:"Alle Sprachen", anzahl: listenIndex.length },
                    ...vorhandeneSprachen.map(s => ({ ...s, anzahl: listenIndex.filter(l => listeSprache(l) === s.code).length }))
                  ].map(s => (
                    <div {...tt(s.code === "alle" ? "Listen aller Sprachen anzeigen" : `Nur Listen auf ${s.name} anzeigen`)} key={s.code} className="karte-zeile" style={{cursor:"pointer", background: sprachFilter === s.code ? "#e8f5ee" : undefined}}
                      onClick={() => wechsleSprache(s.code)}>
                      <span style={{fontWeight: sprachFilter === s.code ? 700 : 500}}>{s.flagge} {s.name}</span>
                      <span style={{marginLeft:"auto", color:"#6b6560", fontSize:"0.8rem"}}>{s.anzahl} Liste{s.anzahl !== 1 ? "n" : ""}</span>
                    </div>
                  ))}
                </div>
              </>)}
            </div>
          )}
          {statistikVollbild && (
            <button onClick={() => setStatistikVollbild(false)}
              style={{position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
                display:"flex", alignItems:"center", background:"none", border:"none",
                cursor:"pointer", color:"#2d6a4f", padding:"6px 8px"}}
              {...tt("Vollbild verlassen")}>
              <IcoCollapse s={18}/>
            </button>
          )}
        </div>
        {!statistikVollbild && <div className="tabs">
          <button {...tt("Listen verwalten: anlegen, importieren, bearbeiten, exportieren")} className={`tab${tab==="listen"?" aktiv":""}`}
            onClick={() => handleTabWechsel("listen")}>Listen</button>
          <button {...tt("Abfrage einstellen und starten")} className={`tab${tab==="quiz"?" aktiv":""}`}
            onClick={() => handleTabWechsel("quiz")}>Quiz</button>
          <button {...tt("Lernfortschritt und Scores ansehen")} className={`tab${tab==="statistik"?" aktiv":""}`}
            onClick={() => handleTabWechsel("statistik")}>Statistik</button>
          <button {...tt("Einstellungen, Info und Anleitung")} className={`tab${tab==="einstellungen"?" aktiv":""}`}
            onClick={() => handleTabWechsel("einstellungen")}>Einstellungen</button>
        </div>}
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
                  <button {...tt("Export-Auswahl beenden")} className="btn btn-ghost btn-sm" onClick={() => {
                    setExportAuswahlModus(false); setExportAusgewaehlt(new Set());
                  }}>Abbrechen</button>
                </>
              ) : (
                <>
                  <span className="liste-detail-header-name">Meine Listen</span>
                  <button className="btn btn-ghost btn-sm" style={{display:"inline-flex",alignItems:"center",gap:5}} onClick={() => { resetImport(); setAnsicht("import"); }} {...tt("Neue Vokabelliste importieren oder anlegen")}><IcoPlus s={13}/>Neu</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setExportAuswahlModus(true)} {...tt("Listen zum Exportieren auswählen")}>Exportieren</button>
                </>
              )
            ) : ansicht === "liste-detail" && aktiveListe ? (
              <>
                <span className="liste-detail-header-name">{aktiveListe.name}</span>
                <button className="btn-toggle" style={{padding:"4px 8px"}} onClick={() => setAktionszeileAufgeklappt(v => !v)} {...tt("Aktionen zur Liste öffnen oder schließen")}>
                  {aktionszeileAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                </button>
                <button className="btn btn-ghost-filled btn-sm" style={{padding:"6px 10px"}} onClick={() => oeffneModal("umbenennen")} {...tt("Liste umbenennen")}><IcoPencil/></button>
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
              <button {...tt("Eingefügten Text auswerten und Spalten zuordnen")} className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); analysiereImport(); }}>Analysieren</button>
            )}
            {ansicht === "import" && letzterPrompt && (
              <button {...tt("Zuletzt erzeugten KI-Prompt erneut kopieren")} className="btn btn-ghost btn-sm" onClick={e => {
                e.stopPropagation();
                navigator.clipboard.writeText(letzterPrompt)
                  .then(() => { setPromptKopiert(true); setTimeout(() => setPromptKopiert(false), 2000); });
              }}>{promptKopiert ? "✓" : "📋 Prompt"}</button>
            )}
            <button {...tt("KI-Prompt erstellen, um von einer KI eine Vokabelliste erzeugen zu lassen")} className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setPromptSprache(sprachFilter === "alle" ? "en" : sprachFilter); setAnsicht("ki-prompt"); }}>Prompt generieren</button>
          </div>
        )}

        {/* ── KI-Prompt Sub-Header ── */}
        {tab === "listen" && ansicht === "ki-prompt" && (
          <div className="liste-detail-header" style={{top: headerH}}>
            <span className="liste-detail-header-name">KI-Prompt generieren</span>
            <button {...tt("Prompt kopieren – danach in einer KI-App einfügen und die Antwort hier importieren")} className="btn btn-primary btn-sm"
              onClick={() => {
                const text = generierePrompt(promptThema, promptAnzahl, promptFalsch, promptBeispiele, promptSynonyme, promptModus, promptSprache);
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
                        <span style={{fontWeight:600}}>{sprachInfo(listeSprache(l)).flagge} {l.name}</span>
                        <span style={{color:"#6b6560", fontSize:"0.85rem", marginLeft:"auto"}}>{l.vokabeln?.length || 0} Vokabeln</span>
                      </div>
                    ))}
                  </div>
                  {importFehler && <div className="fehler">{importFehler}</div>}
                  <div style={{display:"flex", gap:10, marginBottom:24}}>
                    <button {...tt("Zurück zur Eingabe")} className="btn btn-ghost" onClick={() => { setImportJsonData(null); setImportDateiname(""); }}>Zurück</button>
                    <button {...tt("Alle Listen aus dem Backup als neue Listen anlegen")} className="btn btn-primary" onClick={importiereAusJsonDaten}>
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
                        <span style={{fontWeight:600}}>{sprachInfo(s.sprache || importSprache).flagge} {s.name}</span>
                        <span style={{color:"#6b6560", fontSize:"0.85rem", marginLeft:"auto"}}>{s.daten.length} Vokabeln</span>
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
                        <button {...tt("Eingefügten Text löschen")} className="btn-icon" style={{color:"#c0392b", fontSize:"0.82rem", fontWeight:700}}
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
                    <div style={{fontSize:"0.82rem", color:"#888", marginBottom:6}}>Lese Datei…</div>
                  )}
                  {importDateiname && importText && (
                    <div style={{fontSize:"0.82rem", color:"#4a7c59", marginBottom:6, display:"flex", alignItems:"center", gap:6}}>
                      <span>✓</span>
                      <span style={{fontWeight:600}}>{importDateiname}</span>
                      <span style={{color:"#888"}}>— {importText.split('\n').filter(z => z.trim()).length} Zeilen erkannt</span>
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
                          <div style={{color:"#6b6560", fontSize:"0.85rem"}}>Noch keine Listen vorhanden.</div>
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
                              <button {...tt("Zuordnung dieser Spalte aufheben")} className="btn-icon" style={{marginLeft:"auto", color:"#c0392b", fontSize:"0.75rem"}}
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
                    <button {...tt("Zurück zur Eingabe")} className="btn btn-ghost" onClick={() => setImportParsed(null)}>Zurück</button>
                    <button {...tt("Vokabeln mit dieser Zuordnung importieren")} className="btn btn-primary" onClick={fuehreImportDurch}>
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
              <button {...tt("Prompt für eine neue Vokabelliste zu einem Thema")} className={`typ-btn${promptModus==="generieren"?" aktiv":""}`}
                onClick={() => setPromptModus("generieren")}>Generieren</button>
              <button {...tt("Prompt, um ein Foto einer Vokabelseite umwandeln zu lassen")} className={`typ-btn${promptModus==="foto"?" aktiv":""}`}
                onClick={() => setPromptModus("foto")}>Foto umwandeln</button>
            </div>
            <div style={{fontSize:"0.82rem", color:"#6b6560", marginBottom:12, textAlign:"center"}}>
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
              <div className="toggle-row" style={{borderTop:"1px solid #e0dbd2"}}>
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
          const isPakete = quizSessionModus === "pakete";
          const sessionHatFortschritt = isPakete && sessionSlotAktiv && !sessionSlotKonflikt();
          // Akzent-Modus (wie starteQuiz): nur Wörter mit Akzent, reine Akzent-Abfrage nutzt den Akzent-Score
          const akzentSpalten = quizModus === "diktat" ? [] : (quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet)
            .filter(t => t.startsWith('E') && quizSpalteModus[t] === "akzent");
          const nurAkzent = quizModus === "sequenziell" && quizAntwortTypenGeordnet.length > 0
            && quizAntwortTypenGeordnet.every(t => quizSpalteModus[t] === "akzent");
          // Zählt Vokabeln mit mindestens einer abzufragenden Spalte (= größte Anzahl je Antwortspalte)
          const akzentVoks = akzentSpalten.length > 0 && !stufenRegeln(einstellungen).akzentOhneMischen
            ? gefilterteVoks.filter(v => antwortSpaltenFuer(v, quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet,
              quizSpalteModus, true).length > 0) : gefilterteVoks;
          // Score-Filter (nur schlechteste-Modus) → Basis für Reihenfolge-Header
          let reihenfolgeVoks = akzentVoks;
          if (quizReihenfolge === "schlechteste" && quizSchlechtesteMaxScore !== "" && !isNaN(parseFloat(quizSchlechtesteMaxScore))) {
            const thr = parseFloat(quizSchlechtesteMaxScore);
            reihenfolgeVoks = akzentVoks.filter(v => ((nurAkzent ? v.akzentFortschritt : v.fortschritt)?.score ?? 0) < thr);
          }
          const schwelle = einstellungen.gelerntSchwelle ?? 0;
          const istDiktat = quizModus === "diktat";
          const startScore = v => nurAkzent ? (v.akzentFortschritt?.score ?? -Infinity) : gelerntScore(v, istDiktat);
          const gelernteAnzahl = schwelle > 0
            ? akzentVoks.filter(v => startScore(v) >= schwelle).length : 0;
          if (!quizGelerntEinschliessen && schwelle > 0)
            reihenfolgeVoks = reihenfolgeVoks.filter(v => startScore(v) < schwelle);
          const verfuegbarReihenfolge = reihenfolgeVoks.length;
          // Pakete/Session-Filter → nur für Quiz-Button
          let verfuegbar;
          // Anzahl-Kette: Vokabel-Auswahl → mit Akzent (Abfrage-Modus) → nach Schwierigkeits-Regel (Einstellungen)
          // → Session (ohne Gelernte / Score-Grenze) → Fortschritt (davon abgefragt) → Start-Knopf (nächstes Paket)
          const mitAkzentAnzahl = akzentSpalten.length > 0
            ? gefilterteVoks.filter(v => akzentSpalten.some(t => hatAkzente(v[t]?.wert))).length : null;
          const sessionAnzahl = verfuegbarReihenfolge;
          let sessionAbgefragtAnzahl = 0;
          if (sessionHatFortschritt) {
            const bereitsAbgefragt = new Set(sessionSlotAktiv.abgefragt || []);
            const restVoks = reihenfolgeVoks.filter(v => !bereitsAbgefragt.has(v.id));
            sessionAbgefragtAnzahl = sessionAnzahl - restVoks.length;
            verfuegbar = quizPaketGroesse != null ? Math.min(quizPaketGroesse, restVoks.length) : 0;
          } else if (isPakete) {
            verfuegbar = quizPaketGroesse != null ? Math.min(quizPaketGroesse, verfuegbarReihenfolge) : 0;
          } else {
            verfuegbar = verfuegbarReihenfolge;
          }
          // Zeile "Abfrage-Modus": Art der Abfrage (Karte, MC, Tastatur, Akzente bzw. Diktat)
          const antwortArten = [...new Set((quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet)
            .map(t => ANTWORT_MODUS_NAMEN[quizSpalteModus[t] || STANDARD_ANTWORT_MODUS]))];
          const abfrageModusName = istDiktat ? "Diktat"
            : [quizModus === "rotierend" && "wechselnd", antwortArten.join(" + ") || (quizModus !== "rotierend" && "Frage – Antwort")].filter(Boolean).join(" · ");
          const alleAbgefragt = sessionHatFortschritt && sessionAbgefragtAnzahl >= sessionAnzahl;
          const sessionPct = sessionAnzahl > 0 ? Math.round(sessionAbgefragtAnzahl / sessionAnzahl * 100) : 0;
          const sliderActive = quizSchlechtesteMaxScore !== "";
          const sliderVal = sliderActive ? parseInt(quizSchlechtesteMaxScore) : 0;
          const sliderPct = (sliderVal + 10) / 20;

          return (
            <>
              <div className="sektion" style={{paddingTop:0, paddingBottom: (slotSektionAufgeklappt || listenAuswahlAufgeklappt || quizListeAufgeklappt || quizAbfrageModusAufgeklappt || quizReihenfolgeAufgeklappt || quizEinstellungenAufgeklappt || quizSessionAufgeklappt) ? '100dvh' : 0}}>
                {/* VERLAUF + GESPEICHERT – sticky Header; zugeklappt nur der zentrierte Auswahl-Knopf,
                    bei gespeicherter Session ganze Zeile grün */}
                {(() => {
                  const zu = !slotSektionAufgeklappt;
                  const gruen = zu && aktiverSlot?.typ === 'gespeichert' && !vokabelgruppeGeaendert;
                  return (
                    <>
                      {/* Sticky Header-Zeile */}
                      <div ref={slotSektionRef} data-slot-kopf={gruen ? "gruen" : zu ? "zu" : "offen"} style={{position:"sticky", top:headerH, zIndex:9, background: gruen ? "#2d6a4f" : "#fff", borderBottom:`1px solid ${gruen ? "#2d6a4f" : "#e0dbd2"}`, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent: zu ? "center" : undefined, gap:8, marginLeft:"-16px", marginRight:"-16px"}}>
                        {zu && vokabelgruppeGeaendert && (
                          <button
                            onClick={() => ladeSlot(aktiverSlot.typ, aktiverSlot.id)}
                            className="toggle-opt"
                            style={{position:"absolute", left:16, padding:"3px 10px", fontSize:"0.75rem", cursor:"pointer"}}
                            {...tt("Auswahl auf den gespeicherten Stand zurücksetzen")}>
                            Zurücksetzen
                          </button>
                        )}
                        {!zu && (<>
                        <span style={{flex:1, fontWeight:600, fontSize:"0.85rem", color:"#3b3832", display:"flex", alignItems:"center", gap:8}}>
                          Verlauf &amp; Gespeichert
                        </span>
                        {vokabelgruppeGeaendert && (
                          <button
                            onClick={() => ladeSlot(aktiverSlot.typ, aktiverSlot.id)}
                            className="toggle-opt"
                            style={{padding:"3px 10px", fontSize:"0.75rem", cursor:"pointer", flexShrink:0}}
                            {...tt("Auswahl auf den gespeicherten Stand zurücksetzen")}>
                            Zurücksetzen
                          </button>
                        )}
                        </>)}
                        <button
                          onClick={toggleSlotSektion}
                          className={`toggle-opt aktiv${zu ? "" : " zeile-rechts"}`}
                          style={{cursor:"pointer", ...(zu ? {padding:"7px 22px", fontSize:"0.95rem", borderRadius:12, minWidth:160, maxWidth:"80%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"} : {}),
                            ...(gruen ? {border:"1.5px solid rgba(255,255,255,0.75)"} : {}),
                            ...(vokabelgruppeGeaendert ? {background:"#c0392b", color:"#fff"} : {})}}
                          {...tt(aktiverSlot?.typ === 'gespeichert' ? "Gespeicherte Konfiguration – Verlauf und Gespeichert anzeigen" : "Verlauf und Gespeichert anzeigen")}>
                          {aktiverSlot?.typ === 'gespeichert'
                            ? (getSlotEintrag('gespeichert', aktiverSlot.id)?.name || aktiverSlot.id)
                            : "Neu"}
                        </button>
                      </div>
                      {/* Aufklappbarer Chips-Bereich */}
                      <div ref={slotContainerRef} style={{overflow:'hidden', paddingTop: slotSektionAufgeklappt ? 12 : 0, paddingBottom: slotSektionAufgeklappt ? 4 : 0}}>
                        {slotSektionAufgeklappt && renderSlotBereiche(
                          <button className="slot-chip belegt"
                            style={!aktiverSlot
                              ? {background:"#e8f5ee", borderColor:"#2d6a4f", color:"#2d6a4f"}
                              : {color:"#9b9590"}}
                            onClick={neueQuizKonfiguration}
                            {...tt("Neu beginnen – Listen, Vokabelauswahl und alle Einstellungen zurücksetzen")}>
                            Neu
                          </button>,
                          ladeSlot, aktiverSlot)}
                      </div>
                    </>
                  );
                })()}

                {/* LISTEN-AUSWAHL – sticky Header */}
                {(() => {
                  const n = quizTabListen.length;
                  const chipText = n === 0
                    ? "auswählen"
                    : n === 1
                    ? (listenIndex.find(l => l.id === quizTabListen[0])?.name || "Liste")
                    : `${n} Listen`;
                  return (
                    <div ref={listenauswahlHeaderRef} className="liste-detail-header" style={{position:"sticky", top:headerH + slotH, zIndex:8, marginLeft:"-16px", marginRight:"-16px"}}>
                      {/* LINKS */}
                      <span style={{flex:1, display:"flex", alignItems:"center", gap:6}}>
                        {listenAuswahlAufgeklappt ? (
                          <>
                            {n < sichtbareListen.length && (
                              <button className="btn btn-ghost btn-sm"
                                onClick={() => setQuizTabListen(sichtbareListen.map(l => l.id))}
                                {...tt("Alle Listen auswählen")}>
                                Alle
                              </button>
                            )}
                            {n > 0 && (
                              <button className="btn btn-ghost btn-sm" style={{padding:"6px 8px"}}
                                onClick={() => { setQuizTabListen([]); if (quizBereichTyp === "bereich") { setQuizBereichTyp("alle"); setQuizCheckboxAuswahl(new Set()); } }}
                                {...tt("Listenauswahl leeren")}>
                                <IcoX s={12}/>
                              </button>
                            )}
                          </>
                        ) : (
                          <span style={{fontWeight:600, fontSize:"0.85rem", color:"#3b3832"}}>Listen-Auswahl</span>
                        )}
                      </span>
                      {/* MITTE */}
                      {n > 0 && (
                        <span style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"#aaa", cursor:"help"}}
                          {...tt("Anzahl aller Vokabeln in den gewählten Listen")}>
                          ({quizBasisVoks.length} V.)
                        </span>
                      )}
                      {/* RECHTS */}
                      <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                        <button
                          className="toggle-opt aktiv zeile-rechts"
                          onClick={toggleListenAuswahl}
                          {...tt("Listen für das Quiz auswählen")}>
                          {chipText}
                        </button>
                      </span>
                    </div>
                  );
                })()}
                {/* LISTEN-AUSWAHL Inhalt */}
                <div ref={listenContainerRef} style={{overflow:'hidden', paddingTop: listenAuswahlAufgeklappt ? 16 : 0}}>
                  {listenAuswahlAufgeklappt && (<>
                    {sichtbareListen.length === 0
                      ? <div className="leer"><div className="leer-text">Noch keine Listen vorhanden.</div></div>
                      : (() => { const { spalten, plaetze } = listenRasterPlaetze(); const eng = spalten > 1; return (
                      <div className={`listen-raster auswahl${eng ? " eng" : ""}`} style={{gridTemplateColumns:`repeat(${spalten}, minmax(0, 1fr))`}}>
                        {plaetze.map(({ key: pk, l }) => {
                          if (!l) return <div key={pk} className="raster-leer" style={{border:"none"}}/>;
                          const ll = lsGet(SK.liste(l.id));
                          const lAbfragbar = ll ? TYPEN.filter(t => !t.startsWith('i') && ll.spalten[t].aktiv) : [];
                          const lInfo = ll ? TYPEN.filter(t => t.startsWith('i') && ll.spalten[t].aktiv) : [];
                          const anzahl = ll ? ll.vokabeln.length : 0;
                          const gewaehlt = quizTabListen.includes(l.id);
                          return (
                            <div {...tt("Liste für das Quiz aus- oder abwählen")} key={l.id} className="quiz-setup-check" style={{padding:"10px 16px"}}
                              onClick={() => toggleQuizTabListe(l.id)}>
                              <div className={`checkbox${gewaehlt?" checked":""}`}>{gewaehlt?"✓":""}</div>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:600, fontSize:"0.9rem"}}>{listenFlagge(l)}{l.name}</div>
                                <div style={{fontSize:"0.78rem", color:"#6b6560", marginTop:2}}>
                                  {anzahl} Vokabel{anzahl!==1?"n":""}
                                  {ll && !eng && lAbfragbar.map(t => <span key={t} className="spalten-badge aktiv" style={{marginLeft:4}}>{ll.spalten[t].name||t}</span>)}
                                  {ll && !eng && lInfo.map(t => <span key={t} className="spalten-badge" style={{marginLeft:4}}>{ll.spalten[t].name||t}</span>)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      ); })()
                    }
                  </>)}
                </div>

                {/* Platzhalter wenn keine Liste gewählt und Liste eingeklappt */}
                {!listenAuswahlAufgeklappt && quizTabListen.length === 0 && (
                  <div style={{padding:"48px 16px", textAlign:"center"}}>
                    <span style={{fontSize:"1.3rem", color:"#c0bcb7", fontWeight:600}}>Bitte Liste auswählen</span>
                  </div>
                )}

                {/* Alle/Bereich – sticky direkt unter Haupt-Header */}
                {kombiListe && (
                  <div ref={alleBereichRef} style={{position:"sticky", top:headerH + slotH + listenauswahlHeaderH, zIndex:8, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginLeft:"-16px", marginRight:"-16px"}}>
                    {aufteilen ? (<>
                      <span style={{flex:1, fontWeight:700, fontSize:"0.85rem", color:"#8a6d00"}}>▦ Aufteilen</span>
                      <span data-anzahl="auswahl" style={{fontSize:"0.8rem", color:"#aaa"}}>({quizGefilterteVoks.length} V.)</span>
                      <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                        <button data-aufteilen-abbrechen className="btn btn-ghost btn-sm" onClick={() => setAufteilen(null)}
                          {...tt("Aufteilen beenden, ohne Sessions anzulegen")}>Abbrechen</button>
                      </span>
                    </>) : (<>
                    {/* LINKS */}
                    <span style={{flex:1, display:"flex", alignItems:"center", gap:6}}>
                      {quizBereichTyp === "bereich" && quizListeAufgeklappt ? (
                        <>
                          <button className={`btn btn-sm${quizVonBisModus ? " btn-primary" : " btn-ghost"}`}
                            onClick={() => { if (quizVonBisModus) { setQuizVonBisModus(false); setQuizVonBisErster(null); } else { setQuizVonBisModus(true); } }}
                            {...tt("Bereichsauswahl: erste Vokabel antippen, dann letzte")}>
                            {!quizVonBisModus ? "Von–Bis" : quizVonBisErster === null ? "Von…" : "…Bis"}
                          </button>
                          {quizCheckboxAuswahl.size > 0 && (
                            <button className="btn btn-ghost btn-sm" style={{padding:"6px 8px"}}
                              onClick={() => { setQuizCheckboxAuswahl(new Set()); setQuizVonBisModus(false); setQuizVonBisErster(null); }}
                              {...tt("Checkbox-Auswahl aufheben")}>
                              <IcoX s={12}/>
                            </button>
                          )}
                        </>
                      ) : (
                        <span style={{fontWeight:600, fontSize:"0.85rem", color:"#3b3832"}}>Vokabel-Auswahl</span>
                      )}
                    </span>
                    {/* MITTE */}
                    <span data-anzahl="auswahl" style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"#aaa", cursor:"help"}}
                      {...tt(quizBereichTyp === "bereich" ? "Anzahl der im Bereich ausgewählten Vokabeln" : "Anzahl der Vokabeln, die zur Auswahl stehen (alle Vokabeln der Listen mit den gewählten Spalten)")}>({quizGefilterteVoks.length} V.)</span>
                    {/* RECHTS */}
                    <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                      <div className="toggle-btn zeile-rechts">
                        <button className={`toggle-opt${quizBereichTyp==="alle"?" aktiv":""}`}
                          onClick={() => { setQuizBereichTyp("alle"); setQuizListeAufgeklappt(false); setQuizVonBisModus(false); setQuizVonBisErster(null); }}
                          {...tt("Alle Vokabeln der gewählten Listen abfragen")}>
                          Alle
                        </button>
                        <button className={`toggle-opt${quizBereichTyp==="bereich"?" aktiv":""}`}
                          onClick={() => {
                            if (quizBereichTyp !== "bereich") { setQuizBereichTyp("bereich"); if (quizCheckboxAuswahl.size === 0) setQuizListeAufgeklappt(true); }
                            else { toggleEinzelauswahl(); }
                          }}
                          {...tt("Einzelne Vokabeln per Checkbox oder Von–Bis-Bereich auswählen")}>
                          Bereich
                        </button>
                      </div>
                    </span>
                    </>)}
                  </div>
                )}

                {aufteilen && kombiListe && renderAufteilenKasten()}

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
                          <div {...tt("Vokabel aus- oder abwählen (bei Von–Bis: Anfang bzw. Ende des Bereichs)")} key={vok.id} className="vok-zeile"
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

                {/* Abfrage-Modus – sticky unter Alle/Bereich-Zeile */}
                {kombiListe && (
                  <div ref={abfrageModusRef} style={{position:"sticky", top:headerH + slotH + listenauswahlHeaderH + alleBereichH, zIndex:7, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginLeft:"-16px", marginRight:"-16px"}}>
                    <span style={{flex:1, fontWeight:600, fontSize:"0.85rem", color:"#3b3832"}}>Abfrage-Modus</span>
                    {mitAkzentAnzahl != null && (
                      <span data-anzahl="akzent" style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"#aaa", cursor:"help", whiteSpace:"nowrap"}}
                        {...tt("Davon Vokabeln mit Akzent in der Akzente-Spalte")}>({mitAkzentAnzahl} mit Akzent)</span>
                    )}
                    <button className="toggle-opt aktiv zeile-rechts" data-abfragemodus onClick={toggleAbfrageModus}
                      {...tt("Abfrage-Modus öffnen – zeigt die Art der Abfrage (Karte, MC, Tastatur, Akzente, Diktat)")}>
                      {abfrageModusName}
                    </button>
                  </div>
                )}

                {/* Abfrage-Modus Inhalt */}
                {kombiListe && (
                  <div ref={abfrageModusContainerRef} style={{overflow:'hidden', paddingTop: quizAbfrageModusAufgeklappt ? 16 : 0}}>
                    {quizAbfrageModusAufgeklappt && (<>
                      {/* ABFRAGE-MODUS */}
                      <div className="karte" style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div className="toggle-btn">
                            <button className={`toggle-opt${quizModus==="sequenziell"?" aktiv":""}`} onClick={() => setQuizModus("sequenziell")} {...tt("Karte aufdecken und mit Richtig/Falsch selbst bewerten")}>Frage – Antwort</button>
                            <button className={`toggle-opt${quizModus==="rotierend"?" aktiv":""}`} onClick={() => setQuizModus("rotierend")} {...tt("Frage- und Antwortspalte wechseln sich zwischen Vokabeln ab")}>wechselnd</button>
                            <button className={`toggle-opt${quizModus==="diktat"?" aktiv":""}`} onClick={() => setQuizModus("diktat")} {...tt("Antwort wird vorgelesen – du tippst die Lösung")}>Diktat</button>
                          </div>
                          <button className="btn-toggle-ghost" onClick={() => setQuizModusInfoAufgeklappt(v => !v)}
                            {...tt("Spalten und Anzeigeoptionen konfigurieren")}>
                            {quizModusInfoAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                          </button>
                        </div>
                        {quizModusInfoAufgeklappt && (
                          <div style={{padding:"0 16px 14px", fontSize:"0.82rem", color:"#6b6560"}}>
                            {quizModus === "sequenziell"
                              ? "Feste Frage-Spalte, Antwort-Spalten der Reihe nach. Kartenmodus pro Spalte wählbar."
                              : quizModus === "rotierend"
                              ? "Frage-Spalte wechselt mit jeder Vokabel. Kartenmodus pro Spalte wählbar."
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
                                  <button {...tt("Diese Spalte wird vorgelesen und muss geschrieben werden")} key={typ} className={`typ-btn${quizDiktatSpalte===typ?" aktiv":""}`}
                                    onClick={() => setQuizDiktatSpalte(typ)}>
                                    {kombiListe.spalten[typ].name || typ}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div style={{padding:"12px 16px"}}>
                              <div className="inp-label">Übersetzungs-Spalte (als Hinweis, optional)</div>
                              <div style={{display:"flex", gap:6, marginTop:8, flexWrap:"wrap"}}>
                                <button {...tt("Keine Übersetzung als Hinweis anzeigen")} className={`typ-btn${quizDiktatUebersetzung===""?" aktiv":""}`}
                                  onClick={() => setQuizDiktatUebersetzung("")}>Keine</button>
                                {abfragbar.filter(t => t !== quizDiktatSpalte).map(typ => (
                                  <button {...tt("Diese Spalte als Übersetzung/Hinweis anzeigen")} key={typ} className="typ-btn"
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

                      {/* SPALTEN + INFO-SPALTEN */}
                      {quizModus !== "diktat" && (<>
                        <div className="sektion-label" style={{marginBottom:8}}>Spalten auswählen</div>
                        <div className="karte" style={{marginBottom:16}}>
                          {abfragbar.map(typ => {
                            const checked = quizAusgewaehlt.includes(typ);
                            const isFrage = quizFrageTyp === typ;
                            const antwortNr = nachSpaltenReihenfolge(quizAntwortTypenGeordnet).indexOf(typ);
                            const isAntwort = antwortNr >= 0;
                            const isInfo = quizInfoTypenSession.includes(typ);
                            const hatFrage = quizFrageTyp !== "";
                            const anzGesamt = quizAusgewaehlt.length;
                            return (
                              <div key={typ} style={{padding:"10px 16px", borderBottom:"1px solid #e0dbd2"}}>
                                <div {...tt("Spalte für die Abfrage aus- oder abwählen")} style={{display:"flex", alignItems:"center", gap:10, cursor:"pointer"}}
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
                                      <button {...tt("Diese Spalte wird als Frage gezeigt")} className={`spalten-rolle-btn${isFrage?" frage":""}`}
                                        onClick={() => toggleSpalteRolle(typ,"frage")}>Frage</button>
                                    )}
                                    {!isFrage && !isInfo && (
                                      <button {...tt("Diese Spalte muss beantwortet werden (mehrere Antworten möglich, in dieser Reihenfolge)")} className={`spalten-rolle-btn${isAntwort?" antwort":""}`}
                                        onClick={() => toggleSpalteRolle(typ,"antwort")}>
                                        {isAntwort ? `Antwort ${antwortNr+1}` : "Antwort"}
                                      </button>
                                    )}
                                    {!isFrage && !isAntwort && anzGesamt >= 3 && (
                                      <button {...tt("Diese Spalte nur als Hinweis zeigen, nicht abfragen")} className={`spalten-rolle-btn${isInfo?" info":""}`}
                                        onClick={() => toggleSpalteRolle(typ,"info")}>Info</button>
                                    )}
                                    {isAntwort && (
                                      <div style={{display:"flex", gap:4, marginLeft:4}}>
                                        <button {...tt("Antwort eintippen")} className={`spalten-modus-btn${quizSpalteModus[typ]==="tippen"?" aktiv":""}`}
                                          onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"tippen"}))}>Tastatur</button>
                                        <button {...tt("Antwort aus mehreren Vorschlägen wählen (Multiple Choice)")} className={`spalten-modus-btn${quizSpalteModus[typ]==="mc"?" aktiv":""}`}
                                          onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"mc"}))}>MC</button>
                                        <button {...tt("Karte aufdecken und selbst bewerten: gewusst / nicht gewusst")} className={`spalten-modus-btn${(quizSpalteModus[typ]||STANDARD_ANTWORT_MODUS)==="karte"?" aktiv":""}`}
                                          onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"karte"}))}>Karte</button>
                                        {typ.startsWith('E') && (
                                          <button {...tt("Akzente üben: Wort antippen und für jeden Buchstaben den richtigen Akzent wählen – eigener Akzent-Score")} className={`spalten-modus-btn${quizSpalteModus[typ]==="akzent"?" aktiv":""}`}
                                            onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"akzent"}))}>Akzente</button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {checked && quizModus === "rotierend" && (
                                  <div style={{display:"flex", gap:5, marginTop:8, marginLeft:30}}>
                                    <button {...tt("Antwort eintippen")} className={`spalten-modus-btn${quizSpalteModus[typ]==="tippen"?" aktiv":""}`}
                                      onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"tippen"}))}>Tastatur</button>
                                    <button {...tt("Antwort aus mehreren Vorschlägen wählen (Multiple Choice)")} className={`spalten-modus-btn${quizSpalteModus[typ]==="mc"?" aktiv":""}`}
                                      onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"mc"}))}>MC</button>
                                    <button {...tt("Karte aufdecken und selbst bewerten: gewusst / nicht gewusst")} className={`spalten-modus-btn${(quizSpalteModus[typ]||STANDARD_ANTWORT_MODUS)==="karte"?" aktiv":""}`}
                                      onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"karte"}))}>Karte</button>
                                        {typ.startsWith('E') && (
                                          <button {...tt("Akzente üben: Wort antippen und für jeden Buchstaben den richtigen Akzent wählen – eigener Akzent-Score")} className={`spalten-modus-btn${quizSpalteModus[typ]==="akzent"?" aktiv":""}`}
                                            onClick={() => setQuizSpalteModus(p=>({...p,[typ]:"akzent"}))}>Akzente</button>
                                        )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {infoSpalten.length > 0 && (
                          <>
                            <div className="sektion-label" style={{marginBottom:8}}>Info-Spalten anzeigen</div>
                            <div className="karte" style={{marginBottom:16}}>
                              {infoSpalten.map(typ => (
                                <div {...tt("Diese Info-Spalte während der Abfrage anzeigen")} key={typ} className="quiz-setup-check" style={{padding:"10px 16px"}}
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

                    </>)}
                  </div>
                )}

                {/* Reihenfolge – sticky unter Abfrage-Modus-Zeile */}
                {kombiListe && (
                  <div ref={reihenfolgeRef} style={{position:"sticky", top:headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH, zIndex:6, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginLeft:"-16px", marginRight:"-16px"}}>
                    <span style={{flex:1, fontWeight:600, fontSize:"0.85rem", color:"#3b3832"}}>Reihenfolge</span>
                    {quizReihenfolge === "schlechteste" && (
                      <span style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"#aaa", pointerEvents:"none", whiteSpace:"nowrap"}}>
                        {sliderActive ? `Score ≤ ${sliderVal} · ${verfuegbarReihenfolge} V.` : `${verfuegbarReihenfolge} V.`}
                      </span>
                    )}
                    <span style={{display:"flex", justifyContent:"flex-end"}}>
                      <button className="toggle-opt aktiv zeile-rechts" onClick={toggleReihenfolge}
                      {...tt("Reihenfolge öffnen – Zufällig, Schlechteste oder Listen-Nr.")}>
                        {quizReihenfolge === "zufall" ? "Zufällig" : quizReihenfolge === "schlechteste" ? "Schlechteste" : "Listen-Nr."}
                      </button>
                    </span>
                  </div>
                )}

                {/* Reihenfolge Inhalt */}
                {kombiListe && (
                  <div ref={reihenfolgeContainerRef} style={{overflow:'hidden', paddingTop: quizReihenfolgeAufgeklappt ? 16 : 0}}>
                    {quizReihenfolgeAufgeklappt && (
                      <div className="karte" style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div className="toggle-btn">
                            <button className={`toggle-opt${quizReihenfolge==="zufall"?" aktiv":""}`} onClick={() => setQuizReihenfolge("zufall")} {...tt("Vokabeln zufällig mischen")}>Zufällig</button>
                            <button className={`toggle-opt${quizReihenfolge==="schlechteste"?" aktiv":""}`} onClick={() => setQuizReihenfolge("schlechteste")} {...tt("Vokabeln mit niedrigstem Score zuerst abfragen")}>Schlechteste</button>
                            <button className={`toggle-opt${quizReihenfolge==="listennr"?" aktiv":""}`} onClick={() => setQuizReihenfolge("listennr")} {...tt("Vokabeln in der Reihenfolge der Liste abfragen")}>Listen-Nr.</button>
                          </div>
                        </div>
                        {quizReihenfolge === "schlechteste" && (
                          <div style={{padding:"0 16px 16px"}}>
                            {sliderActive ? (
                              <>
                                <div style={{fontSize:"0.78rem", color:"#6b6560", marginBottom:8, textAlign:"center"}}>
                                  {`Nur Vokabeln mit Score ≤ ${sliderVal} (${verfuegbarReihenfolge} V.)`}
                                </div>
                                <div style={{position:"relative", paddingTop:28}}>
                                  <div style={{
                                    position:"absolute", top:0,
                                    left:`calc(${sliderPct} * (100% - 28px) + 14px)`,
                                    transform:"translateX(-50%)",
                                    background:"#2d6a4f", color:"#fff",
                                    borderRadius:6, padding:"3px 9px",
                                    fontSize:"0.82rem", fontWeight:600,
                                    pointerEvents:"none",
                                  }}>{sliderVal}</div>
                                  <input {...ttFeld("Höchster Score, der noch abgefragt wird")}
                                    type="range" min={-10} max={10} step={1}
                                    value={sliderVal}
                                    onChange={e => setQuizSchlechtesteMaxScore(String(e.target.value))}
                                    className="score-slider"
                                    style={{width:"100%", display:"block"}}
                                  />
                                </div>
                                <button {...tt("Score-Grenze entfernen – alle Vokabeln, schlechteste zuerst")}
                                  className="toggle-opt"
                                  style={{width:"100%", marginTop:8, padding:"5px 0", borderRadius:8, fontSize:"0.78rem"}}
                                  onClick={() => setQuizSchlechtesteMaxScore("")}>
                                  × Filter entfernen
                                </button>
                              </>
                            ) : (
                              <>
                                <div style={{fontSize:"0.78rem", color:"#6b6560", marginBottom:8, textAlign:"center"}}>
                                  Vokabeln mit dem niedrigsten Score werden abgefragt.
                                </div>
                                <button {...tt("Nur Vokabeln bis zu einem bestimmten Score abfragen")}
                                  className="toggle-opt"
                                  style={{width:"100%", padding:"7px 0", borderRadius:8}}
                                  onClick={() => setQuizSchlechtesteMaxScore("0")}>
                                  Filter aktivieren (optional)
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        <div className="toggle-row" style={{cursor:"pointer", padding:"12px 16px", borderTop:"1px solid #e0dbd2"}}
                          onClick={() => setQuizUnbeantwortetZuerst(prev => ({...prev, [quizReihenfolge]: !prev[quizReihenfolge]}))}
                          {...tt("Noch nie abgefragte Vokabeln werden vorgezogen")}>
                          <div>
                            <div className="toggle-label">Unbeantwortete zuerst</div>
                            <div className="toggle-sub">Vokabeln ohne Score werden zuerst abgefragt</div>
                          </div>
                          <div className={`checkbox${quizUnbeantwortetZuerst[quizReihenfolge]?" checked":""}`}>{quizUnbeantwortetZuerst[quizReihenfolge]?"✓":""}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Einstellungen – sticky unter Reihenfolge-Zeile */}
                {kombiListe && (
                  <div ref={einstellungenRef} style={{position:"sticky", top:headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH + reihenfolgeH, zIndex:5, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginLeft:"-16px", marginRight:"-16px"}}>
                    <span style={{flex:1, fontWeight:600, fontSize:"0.85rem", color:"#3b3832"}}>Einstellungen</span>
                    <span data-anzahl="einstellungen" style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"#aaa", cursor:"help", whiteSpace:"nowrap"}}
                      {...tt(mitAkzentAnzahl != null
                        ? "Vokabeln nach dem Schwierigkeitsgrad: mit oder ohne Wörter ohne Akzent (Regel „Akzent-Modus: auch Wörter ohne Akzent abfragen“)"
                        : "Vokabeln nach dem Schwierigkeitsgrad – hier gleich der Vokabel-Auswahl")}>({akzentVoks.length} V.)</span>
                    <button className="toggle-opt aktiv zeile-rechts" onClick={toggleEinstellungen}
                      {...tt("Einstellungen öffnen – Lautsprache und Schwierigkeitsgrad")}>
                      {einstellungen.modus === "einfach" ? "Einfach" : "Schwer"}
                    </button>
                  </div>
                )}

                {/* Einstellungen Inhalt */}
                {kombiListe && (
                  <div ref={einstellungenContainerRef} style={{overflow:'hidden', paddingTop: quizEinstellungenAufgeklappt ? 16 : 0}}>
                    {quizEinstellungenAufgeklappt && (<>
                      {/* LAUTSPRACHE */}
                      <div className="sektion-label" style={{marginBottom:8}}>Lautsprache</div>
                      <div className="karte" style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div>
                            <div className="toggle-label">Auto-Play</div>
                            <div className="toggle-sub">Frage automatisch vorlesen wenn neue Vokabel erscheint</div>
                          </div>
                          <div className="toggle-btn">
                            <button className={`toggle-opt${!einstellungen.autoplay?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen, autoplay:false})} {...tt("Kein automatisches Vorlesen")}>Aus</button>
                            <button className={`toggle-opt${einstellungen.autoplay?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen, autoplay:true})} {...tt("Vokabeln nach dem Aufdecken automatisch vorlesen")}>An</button>
                          </div>
                        </div>
                        {einstellungen.autoplay && (
                          <div style={{padding:"12px 16px 16px", borderTop:"1px solid #e0dbd2"}}>
                            <div className="inp-label" style={{marginBottom:8}}>Spalten automatisch vorlesen</div>
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
                            <div style={{fontSize:"0.75rem", color:"#6b6560", marginTop:8}}>
                              Nur wenn Frage-Spalte ausgewählt ist, wird Auto-Play ausgelöst
                            </div>
                          </div>
                        )}
                      </div>

                      {/* SCHWIERIGKEITSGRAD */}
                      <div className="sektion-label" style={{marginBottom:8}}>Schwierigkeitsgrad</div>
                      <div className="karte" style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div>
                            <div className="toggle-label">Modus</div>
                            <div className="toggle-sub">Was jeweils gilt, legst du unten per Haken fest.</div>
                          </div>
                          <div className="toggle-btn">
                            <button className={`toggle-opt${einstellungen.modus==="einfach"?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen,modus:"einfach"})} {...tt("Stufe „Einfach“ verwenden – es gelten die Haken in der Spalte „Einfach“")}>Einfach</button>
                            <button className={`toggle-opt${einstellungen.modus==="schwer"?" aktiv":""}`} onClick={() => speichereEinst({...einstellungen,modus:"schwer"})} {...tt("Stufe „Schwer“ verwenden – es gelten die Haken in der Spalte „Schwer“")}>Schwer</button>
                          </div>
                        </div>
                        {/* Was gilt als einfach / schwer: je Regel ein Haken pro Stufe */}
                        <div style={{borderTop:"1px solid #e0dbd2", padding:"10px 16px 12px"}}>
                          <div style={{display:"grid", gridTemplateColumns:"1fr 58px 58px", alignItems:"center", rowGap:10, columnGap:6}}>
                            <div className="inp-label" style={{margin:0}}>Was gilt als einfach / schwer?</div>
                            {["einfach", "schwer"].map(st => (
                              <div key={st} style={{textAlign:"center", fontSize:"0.75rem", fontWeight:700, color: einstellungen.modus === st ? "#2d6a4f" : "#9b9590"}}>{st === "einfach" ? "Einfach" : "Schwer"}</div>
                            ))}
                            {STUFEN_REGELN.map(r => (<Fragment key={r.key}>
                              <div>
                                <div style={{fontSize:"0.85rem", fontWeight:600, color:"#3b3832"}}>{r.label}</div>
                                <div style={{fontSize:"0.72rem", color:"#6b6560"}}>{r.sub}</div>
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
                            </Fragment>))}
                          </div>
                        </div>
                      </div>

                    </>)}
                  </div>
                )}

                {/* Session-Zeile – sticky unter Einstellungen */}
                {kombiListe && (
                  <div ref={sessionRef} style={{position:"sticky", top:headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH + reihenfolgeH + einstellungenH, zIndex:4, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginLeft:"-16px", marginRight:"-16px"}}>
                    <span style={{flex:1, fontWeight:600, fontSize:"0.85rem", color:"#3b3832"}}>Session</span>
                    <span data-sessionanzahl style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"#aaa", cursor:"help", whiteSpace:"nowrap"}}
                      {...tt("So viele Vokabeln werden in dieser Session insgesamt abgefragt – ohne gelernte (falls ausgeblendet) und ggf. nur unter der Score-Grenze der Reihenfolge")}>
                      ({sessionAnzahl} V.)
                    </span>
                    <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                      <div className="toggle-btn zeile-rechts">
                        <button className={`toggle-opt${quizSessionModus==="alle"?" aktiv":""}`}
                          onClick={() => { if (quizSessionModus === "alle") setQuizSessionAufgeklappt(v => !v); else { setQuizSessionModus("alle"); setQuizSessionAufgeklappt(true); } }}
                          {...tt("Alle verfügbaren Vokabeln in einem Durchgang abfragen")}>
                          Alle
                        </button>
                        <button className={`toggle-opt${quizSessionModus==="pakete"?" aktiv":""}`}
                          onClick={() => { if (quizSessionModus === "pakete") setQuizSessionAufgeklappt(v => !v); else { setQuizSessionModus("pakete"); setQuizPaketGroesse(g => g ?? STANDARD_PAKET_GROESSE); setQuizSessionAufgeklappt(true); } }}
                          {...tt("Vokabeln in kleinere Pakete aufteilen – Fortschritt bleibt zwischen Sitzungen erhalten")}>
                          {quizPaketGroesse != null ? `${quizPaketGroesse} V.` : "Pakete"}
                        </button>
                      </div>
                    </span>
                  </div>
                )}

                {/* Session-Kontext */}
                {quizSessionAufgeklappt && kombiListe && (
                  <div ref={sessionContainerRef} className="karte" style={{marginBottom:8, marginTop:8}}>
                    {/* Abfrage-Ziel */}
                    <div style={{padding:"12px 16px 8px", fontWeight:600, fontSize:"0.82rem", color:"#6b6560"}}>Abfrage-Ziel</div>
                    <div style={{display:"flex", gap:6, flexWrap:"wrap", padding:"0 16px 8px"}}>
                      {[["anzahl","Anzahl","Jede Vokabel 1–3× pro Runde abfragen"],["wiederholung","Mit Wiederholung","Vokabeln wiederholen bis jede N-mal in Folge richtig beantwortet wurde"],["score","Score","Vokabeln wiederholen bis ihr Score das Ziel erreicht"]].map(([m, label, tip]) => (
                        <button key={m} className={`typ-btn${abfrageZielModus===m?" aktiv":""}`}
                          onClick={() => setAbfrageZielModus(m)} {...tt(tip)}>{label}</button>
                      ))}
                    </div>
                    {abfrageZielModus === "anzahl" && (
                      <div style={{display:"flex", gap:6, padding:"0 16px 12px", alignItems:"center"}}>
                        <span style={{fontSize:"0.78rem", color:"#9b9590", marginRight:4}}>Jede Vokabel</span>
                        {[1,2,3].map(n => (
                          <button key={n} className={`typ-btn${abfrageZielAnzahl===n?" aktiv":""}`}
                            onClick={() => setAbfrageZielAnzahl(n)} {...tt(`Jede Vokabel ${n}× pro Runde abfragen`)}>{n}×</button>
                        ))}
                        <span style={{fontSize:"0.78rem", color:"#9b9590", marginLeft:4}}>abfragen</span>
                      </div>
                    )}
                    {abfrageZielModus === "wiederholung" && (
                      <div style={{display:"flex", gap:6, padding:"0 16px 12px", alignItems:"center"}}>
                        <span style={{fontSize:"0.78rem", color:"#9b9590", marginRight:4}}>Bis</span>
                        {[1,2,3].map(n => (
                          <button key={n} className={`typ-btn${abfrageZielWiederholung===n?" aktiv":""}`}
                            onClick={() => setAbfrageZielWiederholung(n)} {...tt(`Jede Vokabel ${n}× in Folge richtig beantworten`)}>{n}×</button>
                        ))}
                        <span style={{fontSize:"0.78rem", color:"#9b9590", marginLeft:4}}>richtig</span>
                      </div>
                    )}
                    {abfrageZielModus === "score" && (() => {
                      const zielSliderPct = (abfrageZielScore + 10) / 20;
                      return (
                        <div style={{padding:"0 16px 12px"}}>
                          <div style={{display:"flex", gap:6, marginBottom:10}}>
                            {[["global","Globaler Score","Vokabeln abfragen bis der Gesamt-Score das Ziel erreicht"],["session","Session-Score","Vokabeln abfragen bis der Fortschritt dieser Session das Ziel erreicht"]].map(([t, label, tip]) => (
                              <button key={t} className={`typ-btn${abfrageZielScoreTyp===t?" aktiv":""}`}
                                onClick={() => setAbfrageZielScoreTyp(t)} {...tt(tip)}>{label}</button>
                            ))}
                          </div>
                          <div style={{fontSize:"0.75rem", color:"#9b9590", marginBottom:6}}>
                            {abfrageZielScoreTyp === "session" ? "Session-Score-Ziel" : "Globaler Score-Ziel"}
                          </div>
                          <div style={{position:"relative", paddingTop:28}}>
                            <div style={{
                              position:"absolute", top:0,
                              left:`calc(${zielSliderPct} * (100% - 28px) + 14px)`,
                              transform:"translateX(-50%)",
                              background:"#2d6a4f", color:"#fff",
                              borderRadius:6, padding:"3px 9px",
                              fontSize:"0.82rem", fontWeight:600, pointerEvents:"none",
                            }}>{abfrageZielScore > 0 ? "+" : ""}{abfrageZielScore}</div>
                            {/* Nullpunkt-Markierung */}
                            <div style={{
                              position:"absolute", top:32,
                              left:`calc(0.5 * (100% - 28px) + 14px)`,
                              transform:"translateX(-50%)",
                              width:2, height:8, background:"#c0bcb7", borderRadius:1, pointerEvents:"none",
                            }}/>
                            <input {...ttFeld("Ziel-Score: Vokabeln werden wiederholt, bis sie ihn erreichen")} type="range" min={-10} max={10} step={1}
                              value={abfrageZielScore}
                              onChange={e => setAbfrageZielScore(Number(e.target.value))}
                              className="score-slider" style={{width:"100%", display:"block"}}/>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Pakete-spezifische Einstellungen */}
                    {quizSessionModus === "pakete" && (
                      <>
                        <div style={{padding:"8px 16px 8px", borderTop:"1px solid #e0dbd2", fontWeight:600, fontSize:"0.82rem", color:"#6b6560"}}>Vokabeln pro Paket</div>
                        <div style={{display:"flex", gap:6, flexWrap:"wrap", padding:"0 16px 12px"}}>
                          {[5,10,15,20,25,30,40,50].map(n => (
                            <button key={n}
                              className={`typ-btn${quizPaketGroesse === n ? " aktiv" : ""}`}
                              onClick={() => setQuizPaketGroesse(n)}
                              {...tt(`Paketgröße: ${n} Vokabeln pro Runde`)}>
                              {n}
                            </button>
                          ))}
                        </div>
                        {sessionHatFortschritt && (
                          <div style={{padding:"0 16px 12px", display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid #e0dbd2", paddingTop:10, marginTop:2}}>
                            <span style={{fontSize:"0.78rem", color:"#6b6560"}}>
                              {sessionAbgefragtAnzahl} / {sessionAnzahl} abgefragt
                            </span>
                            <button {...tt("Fortschritt dieser Abfrageart löschen – die nächste Abfrage beginnt eine neue Session")} style={{fontSize:"0.75rem", color:"#c0392b", background:"none", border:"none", cursor:"pointer", padding:0}}
                              onClick={loescheSessionSlot}>
                              Session löschen
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Quiz starten Button - sticky unter Session-Zeile */}
                {kombiListe && (
                  <div style={{position:"sticky", top:headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH + reihenfolgeH + einstellungenH + sessionH, zIndex:3, background:"#fff", padding:"14px 16px", marginLeft:"-16px", marginRight:"-16px", marginBottom:8, borderBottom:"1px solid #e0dbd2", boxSizing:"border-box"}}>
                    {isPakete && sessionHatFortschritt && (
                      <div style={{marginBottom:16}}>
                        {sessionResetFrage ? (
                          <div data-reset-frage style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", minHeight:31, fontSize:"0.82rem"}}>
                            <span style={{color:"#3b3832", fontWeight:600}}>Abgefragt-Stand löschen?</span>
                            <button data-reset-ja className="toggle-opt aktiv" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8}}
                              onClick={() => { setSessionResetFrage(false); loescheSessionSlot(); }}
                              {...tt("Ja: die Session beginnt von vorn – alle Vokabeln kommen wieder in die Pakete. Scores und Lernfortschritt bleiben erhalten.")}>
                              Ja, neu beginnen
                            </button>
                            <button className="toggle-opt" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8, border:"1.5px solid #e0dbd2"}}
                              onClick={() => setSessionResetFrage(false)}
                              {...tt("Nein: nichts ändern")}>
                              Nein
                            </button>
                            <span style={{color:"#9b9590", fontSize:"0.7rem"}}>(Scores bleiben)</span>
                          </div>
                        ) : (
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, fontSize:"0.82rem"}}>
                          <span style={{color:"#6b6560", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                            Fortschritt {ABFRAGE_ART_NAMEN[quizAbfrageArt]}
                          </span>
                          <button data-session-zuruecksetzen className="toggle-opt zeile-rechts"
                            style={{width:"auto", minWidth:124, padding:"0 12px", color:"#2d6a4f", border:"1.5px solid #a8d5be", background:"#f0f9f4"}}
                            onClick={() => setSessionResetFrage(true)}
                            {...tt("So viele Vokabeln dieser Session wurden schon abgefragt – antippen, um den Abgefragt-Stand zurückzusetzen (Scores, Lernfortschritt und die anderen Abfragearten bleiben erhalten)")}>
                            <span data-anzahl="fortschritt">{sessionAbgefragtAnzahl} / {sessionAnzahl}</span>
                            {sessionAnzahl > 0 && ` — ${sessionPct}%`}
                          </button>
                        </div>
                        )}
                        <div style={{height:6, background:"#e0dbd2", borderRadius:3, marginTop:12}}>
                          <div style={{
                            width:`${sessionPct}%`,
                            height:"100%", background:"#2d6a4f", borderRadius:3, transition:"width 0.3s"
                          }}/>
                        </div>
                      </div>
                    )}
                    {aufteilen ? (() => {
                      const neu = (aufteilenStand()?.gruppen || []).filter(g => !g.vorhanden).length;
                      return (
                        <button data-aufteilen-anlegen className="btn btn-primary" style={{width:"100%", background:"#b8860b", borderColor:"#b8860b"}}
                          disabled={!kannStarten || neu === 0} onClick={legeAufteilenAn}
                          {...tt("Je Gruppe eine gespeicherte Konfiguration mit diesen Einstellungen anlegen")}>
                          ▦ {neu} Session{neu !== 1 ? "s" : ""} anlegen
                        </button>
                      );
                    })() : (
                    <div style={{display:"flex", gap:8}}>
                      {kannStarten && (
                        <button className="btn btn-ghost" style={{flexShrink:0}}
                          onClick={() => oeffneModal("slot-speichern")}
                          {...tt("Aktuelle Konfiguration unter einem Namen speichern – wiederherstellbar per Chip")}>
                          Speichern
                        </button>
                      )}
                      {alleAbgefragt ? (
                        <button className="btn btn-primary" style={{flex:1}}
                          onClick={() => { loescheSessionSlot(); }}
                          {...tt("Session-Fortschritt löschen und alle Vokabeln erneut abfragen")}>
                          Neuer Durchlauf (alle {sessionAnzahl} abgefragt)
                        </button>
                      ) : (
                        <button className="btn btn-primary" style={{flex:1}}
                          onClick={() => starteQuiz()} disabled={!kannStarten || verfuegbar === 0}
                          {...tt("Quiz starten – die Zahl nennt die Vokabeln dieser Fragerunde (bei Paketen: das nächste Paket)")}>
                          Quiz starten ({verfuegbar} Vokabeln)
                        </button>
                      )}
                    </div>
                    )}
                    {schwelle > 0 && gelernteAnzahl > 0 && (
                      <div style={{marginTop:6, fontSize:"0.78rem", color:"#6b6560",
                          display:"flex", alignItems:"center", gap:8, justifyContent:"center"}}>
                        <span>{quizGelerntEinschliessen
                          ? `${gelernteAnzahl} gelernte eingeschlossen`
                          : `${gelernteAnzahl} gelernte ausgeblendet`}</span>
                        <button className="toggle-opt" style={{padding:"2px 8px", fontSize:"0.72rem"}}
                          onClick={() => setQuizGelerntEinschliessen(v => !v)}
                          {...tt("Gelernte Vokabeln (Score ≥ Schwelle) ein- oder ausschließen")}>
                          {quizGelerntEinschliessen ? "Ausblenden" : "Einschließen"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          );
        })()}

        {/* ── Listen-Übersicht: Raster (Größe unter Einstellungen → Listen) ── */}
        {tab === "listen" && ansicht === "uebersicht" && (
          <div className="sektion">
            {sichtbareListen.length === 0 ? (
              <div className="leer"><div className="leer-text">Noch keine Listen vorhanden.<br/>Tippe auf <strong>+</strong> um eine neue Liste anzulegen.</div></div>
            ) : renderListenRaster()}
          </div>
        )}

        {/* ── Listen-Detail ── */}
        {tab === "listen" && ansicht === "liste-detail" && aktiveListe && (() => {
          const aktiveSpalten = TYPEN.filter(t => aktiveListe.spalten[t].aktiv);
          const abfragbareSpalten = aktiveSpalten.filter(t => !t.startsWith('i'));
          const schwelleL = einstellungen.gelerntSchwelle ?? 0;
          const gelernteInListe = schwelleL > 0
            ? aktiveListe.vokabeln.filter(v => (v.fortschritt?.score ?? -Infinity) >= schwelleL).length : 0;
          const anzeigeVoks = listenGelerntAusblenden && schwelleL > 0
            ? aktiveListe.vokabeln.filter(v => (v.fortschritt?.score ?? -Infinity) < schwelleL)
            : aktiveListe.vokabeln;
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
          return (
            <>
            {/* Aktionszeile */}
            {aktionszeileAufgeklappt && (
              <div style={{background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"8px 16px", display:"flex", gap:6, flexWrap:"wrap"}}>
                <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px"}} onClick={() => { resetImport(); setImportZielTyp("bestehend"); setImportBestehendId(aktiveListeId); setAnsicht("import"); }} {...tt("Vokabeln in diese Liste importieren")}><IcoPlus/></button>
                <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px"}} onClick={kopiereListeHandler} {...tt("Liste als Text in die Zwischenablage kopieren")}>{exportKopiert ? "✓" : <IcoCopy/>}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => exportiereAlsJson([aktiveListeId])} {...tt("JSON: vollständige Sicherung mit Lernstand (Scores) – Datei „Name - JSON.txt“, zum Wiederherstellen oder für ein anderes Gerät")}>JSON</button>
                <button className="btn btn-ghost btn-sm" onClick={teileListeAlsDateiHandler} {...tt("TXT: nur die Vokabeln als Text, ohne Scores – Datei „Name - TXT.txt“, zum Weitergeben oder Bearbeiten")}>TXT</button>
                <button className="btn btn-danger btn-sm" style={{padding:"6px 10px", marginLeft:"auto"}} onClick={() => oeffneModal("loeschen")} {...tt("Liste löschen")}><IcoX/></button>
              </div>
            )}
            <div className="sektion">

              {abfragbareSpalten.length >= 2 && aktiveListe.vokabeln.length > 0 && (
                <button className="btn btn-primary" style={{width:"100%", marginBottom:8}}
                  onClick={() => {
                    setSessionUeberschreibenModal(false);
                    setGruppenAenderungsDialog(false);
                    setAktiverSlot(null);
                    setSlotGeaendert(false);
                    setGespeicherteVokabelgruppe(null);
                    lsDel(SK.sessionAktiv);
                    setSessionSlotAktiv(null);
                    setQuizSessionModus(STANDARD_SESSION_MODUS);
                    setQuizPaketGroesse(STANDARD_PAKET_GROESSE);
                    setSlotSektionAufgeklappt(false);
                    setQuizSessionAufgeklappt(false);
                    handleTabWechsel("quiz");
                    setQuiz(null);
                    setAnsicht("uebersicht");
                    setQuizTabListen([aktiveListeId]);
                    setListenAuswahlAufgeklappt(false);
                    initQuizDefaults(lsGet(SK.liste(aktiveListeId)));
                  }}
                  {...tt("Quiz mit dieser Liste starten")}>
                  Quiz starten
                </button>
              )}
              {aktiveListe.vokabeln.length > 0 && (
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

              <div className="sektion-label" style={{marginBottom:10}}>Fremdsprache</div>
              <div className="karte" style={{padding:"12px 16px"}}>
                {renderSprachAuswahl(listeSprache(aktiveListe), setzeListenSprache)}
                <div className="karte-zeile-sub" style={{marginTop:8}}>Gilt für die Spalten E1–E3 (Vorlesen, Diktat, Sprachfilter).</div>
              </div>

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
                        <button className="btn btn-ghost-filled btn-sm" style={{padding:"6px 10px"}} onClick={() => oeffneModal("spalte-umbenennen", typ)} {...tt("Spaltenname bearbeiten")}><IcoPencil s={14}/></button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vokabeln – ein-/ausklappbar */}
              <div className="sektion-header" style={{marginTop:8}}>
                <div {...tt("Vokabeln der Liste anzeigen oder ausblenden")} style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer"}}
                  onClick={() => setVokabelAufgeklappt(v => !v)}>
                  <div className="sektion-label">Vokabeln ({aktiveListe.vokabeln.length})</div>
                  <button className="btn-toggle" style={{padding:"3px 6px"}} onClick={e => { e.stopPropagation(); setVokabelAufgeklappt(v => !v); }} {...tt(vokabelAufgeklappt ? "Vokabeln einklappen" : "Vokabeln ausklappen")}>
                    {vokabelAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                  </button>
                </div>
                <div style={{display:"flex", gap:6}}>
                  {sichtbareListen.filter(l => l.id !== aktiveListeId).length > 0 && (
                    <button className="btn btn-ghost btn-sm" style={{background:"#fff"}}
                      onClick={() => { setMergeQuelleId(''); setModal('liste-zusammenfuehren'); }}
                      {...tt("Vokabeln aus einer anderen Liste in diese Liste einfügen")}>
                      Zusammenführen
                    </button>
                  )}
                  {vokabelAufgeklappt && schwelleL > 0 && gelernteInListe > 0 && (
                    <button className={`btn btn-ghost btn-sm${listenGelerntAusblenden?" aktiv":""}`}
                      style={{background:"#fff", fontSize:"0.75rem"}}
                      onClick={() => setListenGelerntAusblenden(v => !v)}
                      {...tt(listenGelerntAusblenden ? "Gelernte Vokabeln wieder einblenden" : "Gelernte Vokabeln ausblenden")}>
                      {listenGelerntAusblenden ? `${gelernteInListe} ausgeblendet` : "Gelernte ausblenden"}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px", background:"#fff"}} onClick={() => {
                    resetImport(); setImportZielTyp("bestehend"); setImportBestehendId(aktiveListeId); setAnsicht("import");
                  }} {...tt("Neue Vokabel hinzufügen oder aus Datei importieren")}><IcoPlus s={13}/></button>
                </div>
              </div>

              {vokabelAufgeklappt && (
                aktiveListe.vokabeln.length === 0 ? (
                  <div className="leer"><div className="leer-text">Noch keine Vokabeln.<br/>Klicke auf + um zu importieren.</div></div>
                ) : (<>
                  {aktiveSpalten.length > 1 && (
                    <div data-ansicht-spalten style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:8}}>
                      <span style={{fontSize:"0.75rem", color:"#6b6560"}}>Anzeigen:</span>
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
                    </div>
                  )}
                  <div className="karte">
                    {anzeigeVoks.map(vok => {
                      const score = vok.fortschritt != null ? clampScore(vok.fortschritt.score) : null;
                      const istGelernt = schwelleL > 0 && (vok.fortschritt?.score ?? -Infinity) >= schwelleL;
                      return (
                        <div key={vok.id} className="karte-zeile" style={{flexDirection:"column", alignItems:"flex-start", gap:4}}>
                          <div style={{display:"flex", width:"100%", justifyContent:"space-between", alignItems:"flex-start"}}>
                            <div style={{display:"flex", flexDirection:"column", gap:3, flex:1}}>
                              {anzeigeSpalten.map(typ => vok[typ] ? (
                                <div key={typ} style={{display:"flex", alignItems:"baseline", gap:6}}>
                                  <span className="spalten-badge aktiv">{aktiveListe.spalten[typ].name || typ}</span>
                                  <span style={{fontSize:"0.88rem"}}>{vok[typ].wert}</span>
                                  {vok[typ].falsch?.length > 0 && <span style={{fontSize:"0.75rem", color:"#6b6560"}}>(+{vok[typ].falsch.length})</span>}
                                </div>
                              ) : null)}
                            </div>
                            <div style={{display:"flex", alignItems:"center", gap:2, flexShrink:0, marginLeft:8}}>
                              {istGelernt && (
                                <span style={{background:"#e8f5e9", color:"#2d6a4f", borderRadius:4,
                                  fontSize:"0.65rem", padding:"1px 5px", fontWeight:700, marginRight:2}}>✓</span>
                              )}
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
                                    const u = new SpeechSynthesisUtterance(vok[typ].wert.split('/')[0].trim());
                                    u.lang = spalteLang(typ, listeSprache(aktiveListe));
                                    window.speechSynthesis.speak(u);
                                  });
                                }}><IcoSpk s={16}/></button>
                              )}
                              <button {...tt("Vokabel bearbeiten")} className="btn-icon" title="Bearbeiten" onClick={() => oeffneVokabelBearbeiten(vok)}><IcoPencil s={14}/></button>
                              <button {...tt("Vokabel löschen")} className="btn-icon" title="Löschen" style={{color:"#c0392b"}}
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
        })()}
        {/* ── Statistik: Verlauf & Gespeichert Header ── */}
        {tab === "statistik" && (() => {
          if (statistikVollbild) return null;
          // wie im Quiz: zugeklappt ohne Überschrift, Knopf mittig; gespeicherte Konfiguration → ganze Zeile grün
          const zu = !slotSektionAufgeklappt;
          const gruen = zu && statistikAktiverSlot?.typ === 'gespeichert';
          return (
            <>
              <div ref={slotSektionRef} data-slot-kopf={gruen ? "gruen" : zu ? "zu" : "offen"} style={{position:"sticky", top:headerH, zIndex:9, background: gruen ? "#2d6a4f" : "#fff", borderBottom:`1px solid ${gruen ? "#2d6a4f" : "#e0dbd2"}`, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent: zu ? "center" : undefined, gap:8}}>
                {!zu && (
                  <span style={{flex:1, fontWeight:600, fontSize:"0.85rem", color:"#3b3832", display:"flex", alignItems:"center", gap:8}}>
                    Verlauf &amp; Gespeichert
                  </span>
                )}
                <button {...tt("Verlauf und Gespeichert anzeigen")}
                  onClick={toggleSlotSektion}
                  className={`toggle-opt aktiv${zu ? "" : " zeile-rechts"}`}
                  style={zu ? {cursor:"pointer", padding:"7px 22px", fontSize:"0.95rem", borderRadius:12, minWidth:160, maxWidth:"80%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    ...(gruen ? {border:"1.5px solid rgba(255,255,255,0.75)"} : {})} : undefined}>
                  {statistikAktiverSlot?.typ === 'gespeichert'
                    ? (getSlotEintrag('gespeichert', statistikAktiverSlot.id)?.name || statistikAktiverSlot.id)
                    : statistikSlotGeleert ? "Leer" : "Neu"}
                </button>
              </div>
              <div ref={slotContainerRef} style={{overflow:'hidden', paddingTop: slotSektionAufgeklappt ? 12 : 0, paddingBottom: slotSektionAufgeklappt ? 4 : 0}}>
                {slotSektionAufgeklappt && (<>
                  {renderSlotBereiche(
                    <button className="slot-chip belegt"
                      style={!statistikAktiverSlot && !statistikSlotGeleert
                        ? {background:"#e8f5ee", borderColor:"#2d6a4f", color:"#2d6a4f"}
                        : {color:"#9b9590"}}
                      onClick={() => {
                        setStatistikAktiverSlot(null); setStatistikSlotGeleert(false); setSlotSektionAufgeklappt(false);
                        setStatistikListenIds(null); setStatistikBereichTyp("alle"); setStatistikCheckboxAuswahl(new Set());
                        setStatistikFilter(new Set(['negativ', 'nie', 'arbeit', 'gelernt']));
                      }}
                      {...tt("Neu – alle Listen und Vokabeln anzeigen")}>
                      Neu
                    </button>,
                    ladeSlotStatistik, statistikAktiverSlot, 16)}
                </>)}
              </div>
            </>
          );
        })()}

        {/* ── Statistik: Listen-Auswahl Header ── */}
        {tab === "statistik" && (() => {
          if (statistikVollbild) return null;
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
                  <span style={{fontWeight:600, fontSize:"0.85rem", color:"#3b3832"}}>Listen-Auswahl</span>
                )}
              </span>
              {/* MITTE */}
              {statistikBasisVoks.length > 0 && (
                <span style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"#aaa", pointerEvents:"none", whiteSpace:"nowrap"}}>
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
              <div ref={statistikListenContainerRef} style={{background:"#f7f5f0", borderBottom:"1px solid #e0dbd2", padding:"8px 16px"}}>
                <div className={`listen-raster auswahl${listenRasterPlaetze().spalten > 1 ? " eng" : ""}`} style={{marginBottom:0, gridTemplateColumns:`repeat(${listenRasterPlaetze().spalten}, minmax(0, 1fr))`}}>
                  {sichtbareListen.length === 0
                    ? <div className="karte-zeile" style={{color:"#6b6560", fontSize:"0.85rem"}}>Keine Listen vorhanden.</div>
                    : listenRasterPlaetze().plaetze.map(({ key: pk, l }) => {
                        if (!l) return <div key={pk} className="raster-leer" style={{border:"none"}}/>;
                        const ll = statistikAlleListenObjekte.find(x => x.id === l.id);
                        const anzahl = ll ? ll.vokabeln.length : 0;
                        const gewaehlt = statistikListenIds === null || statistikListenIds.has(l.id);
                        return (
                          <div {...tt("Liste in der Statistik ein- oder ausblenden")} key={l.id} className="quiz-setup-check" style={{padding:"10px 16px"}}
                            onClick={() => toggleStatistikListe(l.id)}>
                            <div className={`checkbox${gewaehlt?" checked":""}`}>{gewaehlt?"✓":""}</div>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:600, fontSize:"0.9rem"}}>{listenFlagge(l)}{l.name}</div>
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

        {/* ── Statistik: Vokabel-Auswahl Header ── */}
        {tab === "statistik" && (() => {
          if (statistikVollbild) return null;
          const hatVoks = statistikBasisVoks.length > 0;
          const istBereich = statistikBereichTyp === "bereich";
          const auswahlAnzahl = statistikGefilterteVoks.length;
          return (<>
            <div ref={statistikVokauswahlRef} style={{position:"sticky", top:headerH+slotH+statistikListenHeaderH, zIndex:7, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"10px 16px", display:"flex", alignItems:"center", gap:8}}>
              {/* LINKS */}
              <span style={{flex:1, display:"flex", alignItems:"center", gap:6}}>
                {istBereich && statistikEinzelauswahlAufgeklappt ? (
                  <>
                    <button className={`btn btn-sm${statistikVonBisModus ? " btn-primary" : " btn-ghost"}`}
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
                  </>
                ) : (
                  <span style={{fontWeight:600, fontSize:"0.85rem", color:"#3b3832"}}>Vokabel-Auswahl</span>
                )}
              </span>
              {/* MITTE */}
              {istBereich && (
                <span style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"#aaa", pointerEvents:"none", whiteSpace:"nowrap"}}>({auswahlAnzahl} V.)</span>
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
              <div ref={statistikEinzelauswahlRef} style={{background:"#f7f5f0", borderBottom:"1px solid #e0dbd2", paddingBottom:8}}>
                <div className="karte" style={{margin:"8px 16px 0 16px"}}>
                  {statistikBasisVoks.map((vok, idx) => {
                    const gewaehlt = statistikCheckboxAuswahl.has(vok.id);
                    const isVon = statistikVonBisModus && vok.id === statistikVonBisErster;
                    const sp1 = TYPEN.find(t => vok._spalten[t]?.aktiv);
                    const sp2 = TYPEN.filter(t => vok._spalten[t]?.aktiv)[1];
                    return (
                      <div {...tt("Vokabel aus- oder abwählen (bei Von–Bis: Anfang bzw. Ende des Bereichs)")} key={vok.id} className="vok-zeile"
                        style={{background: isVon ? "#fff3cd" : gewaehlt ? "#f0f7f0" : "transparent"}}
                        onClick={() => {
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
                        <div className={`checkbox${isVon ? " checked" : gewaehlt ? " checked" : ""}`} style={{flexShrink:0, ...(isVon ? {background:"#f0a500", borderColor:"#f0a500"} : {})}}>{isVon ? "→" : gewaehlt ? "✓" : ""}</div>
                        <span className="vok-nr">{idx+1}</span>
                        <div style={{flex:1, minWidth:0}}>
                          {sp1 && vok[sp1] && <div style={{fontWeight:600, fontSize:"0.88rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{vok[sp1].wert}</div>}
                          {sp2 && vok[sp2] && <div style={{fontSize:"0.75rem", color:"#6b6560", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{vok[sp2].wert}</div>}
                        </div>
                        {statistikGewaehlteListenObjekte.length > 1 && <div style={{fontSize:"0.68rem", color:"#aaa", flexShrink:0}}>{vok._listeName}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>);
        })()}

        {/* ── Statistik: Inhalte ── */}
        {tab === "statistik" && (() => {
          const schwelleS = einstellungen.gelerntSchwelle ?? 0;
          // Kennzahlen immer über alle Vokabeln; der Gelernt-Knopf blendet nur Graph + Liste aus
          const alleVoks = statistikSicht(statistikGefilterteVoks, statistikArt);
          const artName = STATISTIK_ARTEN.find(([a]) => a === statistikArt)[1];
          const naechsteArt = () => setStatistikArt(a => STATISTIK_ARTEN[(STATISTIK_ARTEN.findIndex(([x]) => x === a) + 1) % STATISTIK_ARTEN.length][0]);
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
          else if (sKey === "streak") voks.sort((a, b) => { const d = (a.fortschritt?.streak ?? 0) - (b.fortschritt?.streak ?? 0); return sDir === "asc" ? d : -d; });
          else if (sKey === "datum") voks.sort((a, b) => { const da = a.fortschritt?.letzteAbfrage ? new Date(a.fortschritt.letzteAbfrage) : new Date(0); const db = b.fortschritt?.letzteAbfrage ? new Date(b.fortschritt.letzteAbfrage) : new Date(0); return sDir === "asc" ? da - db : db - da; });
          else if (sKey === "alpha") { voks.sort((a, b) => { const spa = TYPEN.find(t => a._spalten[t]?.aktiv); const spb = TYPEN.find(t => b._spalten[t]?.aktiv); const r = (a[spa]?.wert || '').localeCompare(b[spb]?.wert || ''); return sDir === "asc" ? r : -r; }); }
          else if (sKey === "listennr") voks.sort((a, b) => { const dr = a._listenIndexRank - b._listenIndexRank; if (dr !== 0) return sDir === "asc" ? dr : -dr; const di = a._listIndex - b._listIndex; return sDir === "asc" ? di : -di; });
          const mehrereListenGewaehlt = statistikGewaehlteListenObjekte.length > 1;

          // Filter-Boxen (Multi-Select: alle standardmäßig aktiv)
          // Farben der Gruppen (Zeilen, Gruppen-Balken)
          const GRUPPE_BG = { negativ:"#fdecec", gelernt:"#e8f5e9" };

          return (<>
            {/* Ø-Score sticky Header */}
            {!statistikVollbild && (
            <div style={{position:"sticky", top:headerH+slotH+statistikListenHeaderH+statistikVokauswahlH, zIndex:6, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"8px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
              <div style={{display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2, flexShrink:0}}>
                <span style={{fontWeight:600, fontSize:"0.85rem", color:"#3b3832"}}>{schwelleS > 0 ? "Lernfortschritt" : "Ø Score"}</span>
                <span style={{fontSize:"0.72rem", fontWeight:700, color:"#6b6560"}} {...tt("Ausgewertet wird dieser Score – Tap in die Kreismitte wechselt")}>{artName}</span>
              </div>
              {schwelleS > 0 && (
                <div style={{display:"flex", flexDirection:"column", alignItems:"center", flex:1, minWidth:0}}>
                  <div style={{display:"flex", alignItems:"baseline", gap:6}}>
                    <span style={{fontWeight:800, fontSize:"1.25rem", color: keineAkzente ? "#b5b0aa" : "#2d6a4f"}}>{keineAkzente ? "–" : `${Math.round(lernFortschritt)} %`}</span>
                  </div>
                  <div style={{display:"flex", width:"min(180px, 100%)", height:6, borderRadius:3, overflow:"hidden", background:"#f0ede8", margin:"3px 0 2px"}}
                    {...tt(`Gelernt ${kopfAnzahl.gelernt} · In Arbeit ${kopfAnzahl.arbeit} · Nie abgefragt ${kopfAnzahl.nie} · Negativ ${kopfAnzahl.negativ}`)}>
                    {kopfVoks.length > 0 && GRUPPE_BALKEN.map(([g, farbe]) => kopfAnzahl[g] > 0 && (
                      <div key={g} style={{width:`${kopfAnzahl[g] / kopfVoks.length * 100}%`, background:farbe}}/>
                    ))}
                  </div>
                  <div style={{fontSize:"0.7rem", color:"#6b6560", whiteSpace:"nowrap"}}>
                    {keineAkzente ? "keine Akzente" : <>{gelerntAnzahl} / {kopfVoks.length} gelernt</>}
                    {avgScore !== null && <> · Ø {avgScore > 0 ? "+" : ""}{avgScore.toFixed(1)}</>}
                  </div>
                </div>
              )}
              {schwelleS <= 0 && (
              <div style={{display:"flex", alignItems:"center", gap:12, flex:1, justifyContent:"center"}}>
                <div style={{display:"flex", alignItems:"center", gap:4}}>
                  <svg width="14" height="3" viewBox="0 0 14 3" style={{flexShrink:0}}><line x1="0" y1="1.5" x2="14" y2="1.5" stroke="#2d6a4f" strokeWidth="2.5"/></svg>
                  {avgScore !== null ? (
                    <span style={{fontWeight:700, fontSize:"0.88rem", color: avgScore > 0 ? "#2d6a4f" : avgScore < 0 ? "#c0392b" : "#6b6560"}}>
                      {avgScore > 0 ? "+" : ""}{avgScore.toFixed(1)}
                    </span>
                  ) : <span style={{color:"#aaa", fontSize:"0.8rem"}}>–</span>}
                </div>
              </div>
              )}
              <button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={() => window.scrollTo({top:0, behavior:"smooth"})} {...tt("Zum Seitenanfang scrollen")}>nach oben</button>
            </div>
            )}
            <div className="sektion" style={{paddingTop:12, paddingBottom:(statistikListenAufgeklappt||statistikEinzelauswahlAufgeklappt)?'100dvh':0}}>
              {/* Kreisdiagramm */}
              {(() => {
                // Kreisdiagramm der Gruppen: leere Gruppen fehlen, Segment antippen = Gruppe ein-/ausblenden
                const renderKreis = () => {
                  const NAME = { gelernt:"✓ Gelernt", arbeit:"In Arbeit", nie:"Nie abgefragt", negativ:"Negativ" };
                  const TEXTFARBE = { gelernt:"#2d6a4f", arbeit:"#a67c00", nie:"#6b6560", negativ:"#c0392b" };
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
                    <div style={{background:"#fafaf8", padding:"8px 6px 10px"}}>
                      {teile.length === 0 && !keineAkzente ? (
                        <div style={{textAlign:"center", color:"#9b9590", fontSize:"0.85rem", padding:"40px 0"}}>Alle Gruppen ausgeblendet
                          <div><button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={naechsteArt} {...tt("Zwischen Übersetzung, Diktat und Akzenten wechseln")}>{artName} ⇄</button></div></div>
                      ) : (
                      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%", maxHeight:260, display:"block", userSelect:"none"}}>
                        {keineAkzente && (
                          <text data-keine-akzente x={cx} y={cy - 58} textAnchor="middle" fontSize="15" fontWeight="600" fill="#3b3832">Für diese Session sind keine Akzente vorhanden.</text>
                        )}
                        {teile.map(t => {
                          const [ax, ay] = punkt(t.mitte, r + 2), [bx, by] = punkt(t.mitte, r + 14);
                          const tx = t.rechts ? cx + r + 34 : cx - r - 34;
                          return (
                            <g {...tt(`${NAME[t.g]}: antippen blendet die Gruppe aus – lange drücken: Quiz mit diesen Vokabeln`, quizMenue(t.g))} key={t.g} data-kreis-gruppe={t.g} style={{cursor:"pointer"}} onClick={() => umschalten(t.g)}>
                              {teile.length === 1
                                ? <circle cx={cx} cy={cy} r={r} fill={t.farbe}/>
                                : <path d={pfad(t)} fill={t.farbe} stroke="#fafaf8" strokeWidth="2"/>}
                              <polyline points={`${ax},${ay} ${bx},${by} ${t.rechts ? tx - 4 : tx + 4},${t.y}`}
                                fill="none" stroke="#b5b0aa" strokeWidth="1"/>
                              <text x={tx} y={t.y - 2} textAnchor={t.rechts ? "start" : "end"} fontSize="13" fontWeight="700"
                                fill={TEXTFARBE[t.g]}>{NAME[t.g]}</text>
                              <text x={tx} y={t.y + 13} textAnchor={t.rechts ? "start" : "end"} fontSize="12"
                                fill="#6b6560">{t.n} · {Math.round(t.n / gesamt * 100)} %</text>
                            </g>
                          );
                        })}
                        {/* Kreismitte: Tap wechselt Übersetzung → Diktat → Akzente */}
                        <g {...tt("Antippen: zwischen Übersetzung, Diktat und Akzenten wechseln")} style={{cursor:"pointer"}} onClick={naechsteArt} data-kreismitte="1">
                          <circle cx={cx} cy={cy} r={36} fill="#fff" stroke="#e0dbd2" strokeWidth="1.5"/>
                          <text x={cx} y={cy + 1} textAnchor="middle" fontSize={artName.length > 8 ? 11 : 13} fontWeight="800" fill="#3b3832">{artName}</text>
                          <text x={cx} y={cy + 16} textAnchor="middle" fontSize="13" fill="#9b9590">⇄</text>
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
                                fontFamily:"inherit", fontSize:"0.72rem", fontWeight:600, background:"#fff",
                                border:`1.5px solid ${an ? farbe : "#e0dbd2"}`, color: an ? TEXTFARBE[g] : "#b5b0aa",
                                textDecoration: an ? "none" : "line-through", opacity: an ? 1 : 0.8}}>
                              <span style={{width:8, height:8, borderRadius:"50%", background: an ? farbe : "#e0dbd2"}}/>
                              {NAME[g]} {gruppenAnzahl[g]}
                            </button>
                          );
                        })}
                      </div>
                      {!keineAkzente && <div style={{display:"flex", justifyContent:"center", alignItems:"center", gap:10, marginTop:6}}>
                        <button className={`typ-btn${alleFilterAktiv ? " aktiv" : ""}`} style={{fontSize:"0.72rem", padding:"3px 12px"}}
                          onClick={() => setStatistikFilter(new Set(['negativ', 'nie', 'arbeit', 'gelernt']))}
                          {...tt("Alle Gruppen einblenden")}>Gesamt {alleVoks.length}</button>
                        <span style={{fontSize:"0.65rem", color:"#9b9590"}}>Segment oder Legende antippen: aus-/einblenden</span>
                      </div>}
                    </div>
                  );
                };
                return (
                <div style={{marginBottom:16, borderRadius:12, overflow:"hidden", border:"1px solid #e0dbd2", position:"relative"}}>
                  {!statistikVollbild && (
                    <button onClick={() => setStatistikVollbild(true)}
                      style={{position:"absolute", top:6, right:8, zIndex:1, background:"none", border:"none", padding:"4px 6px", cursor:"pointer", color:"#6b6560", display:"flex", alignItems:"center"}}
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
                  {key:"streak", label:"Streak", def:"desc"},
                  {key:"datum", label:"Datum", def:"desc"},
                  {key:"alpha", label:"A→Z", def:"asc"},
                  {key:"listennr", label:"Listen-Nr.", def:"asc"},
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
                  <div className="karte-zeile" style={{color:"#6b6560", fontSize:"0.85rem"}}>Keine Vokabeln in diesem Filter.</div>
                ) : voks.map((vok, idx) => {
                  const rawScore = vok.fortschritt?.score ?? null;
                  const score = rawScore !== null ? Math.min(10, Math.max(-10, rawScore)) : null;
                  const isPos = score !== null && score > 0;
                  const isNeg = score !== null && score < 0;
                  const gruppe = gruppeVon(vok);
                  const istGel = gruppe === "gelernt";
                  const scoreColor = istGel || isPos ? "#2d6a4f" : isNeg ? "#c0392b" : "#9b9590";
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
                    <div key={`${vok._listeName}_${vok.id}_${idx}`}
                      style={{display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background: GRUPPE_BG[gruppe],
                        borderBottom: idx < voks.length-1 ? "1px solid #e0dbd2" : "none"}}>
                      {/* Text */}
                      <div style={{width:"33%", minWidth:0, overflow:"hidden", textOverflow:"ellipsis",
                        whiteSpace:"nowrap", fontSize:"0.8rem", color:"#1a1a1a", flexShrink:0}}>
                        {displayText || <span style={{color:"#bbb"}}>–</span>}
                      </div>
                      {/* Score-Balken */}
                      <div style={{flex:1, position:"relative", height:8, background:"#f0ede8", borderRadius:4, minWidth:0}}>
                        {istGel ? (
                          // Gelernt: ganzer Balken grün (auch der negative Bereich)
                          <div style={{position:"absolute", top:0, bottom:0, left:0, right:0, borderRadius:4, background:"#2d6a4f"}}/>
                        ) : score !== null && score !== 0 && (
                          <div style={{position:"absolute", top:0, bottom:0, borderRadius:4,
                            background: isPos ? "#52b788" : "#c0392b",
                            ...(isPos ? {left:`${nullPct}%`, width:`${barPct}%`} : {right:`${100 - nullPct}%`, width:`${barPct}%`})}}/>
                        )}
                        <div style={{position:"absolute", top:0, bottom:0, left:`${nullPct}%`,
                          transform:"translateX(-50%)", width:1, background: istGel ? "#e8f5e9" : "#c0bcb7"}}/>
                      </div>
                      {/* Score + Datum */}
                      <div style={{width:"22%", display:"flex", flexDirection:"column",
                        alignItems:"flex-end", flexShrink:0, gap:1}}>
                        <span style={{fontSize:"0.78rem", fontWeight:700, color:scoreColor}}
                          {...(istGel ? tt(`Gelernt (Schwelle +${schwelleS})`) : {})}>
                          {istGel ? "✓ " : ""}{score !== null ? (score > 0 ? "+" : "") + score : "–"}
                        </span>
                        <span style={{fontSize:"0.62rem", color:"#9b9590"}}>
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
        })()}
        {tab === "einstellungen" && (<>
          {/* Info sticky Header */}
          <div ref={infoHeaderRef} style={{position:"sticky", top:headerH, zIndex:9, background:"#fff", borderBottom:"1px solid #e0dbd2", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <span style={{fontWeight:700, fontSize:"0.88rem", color:"#3b3832"}}>Info</span>
            <div style={{display:"flex", gap:6, alignItems:"center"}}>
              {infoModus !== "uebersicht" && (
                <button className="btn-icon" style={{marginRight:2}} onClick={() => setInfoModus("uebersicht")} {...tt("Zurück zur Übersicht")}><IcoX s={14}/></button>
              )}
              <button className={`typ-btn${infoModus==="uebersicht"?" aktiv":""}`}
                onClick={() => setInfoModus("uebersicht")} {...tt("App-Übersicht anzeigen")}>Übersicht</button>
              <button className={`typ-btn${infoModus==="konzept"?" aktiv":""}`}
                onClick={() => setInfoModus(m => m==="konzept"?"uebersicht":"konzept")} {...tt("Wie die App funktioniert – Konzepte erklärt")}>Konzept</button>
              <button className={`typ-btn${infoModus==="anleitung"?" aktiv":""}`}
                onClick={() => setInfoModus(m => m==="anleitung"?"uebersicht":"anleitung")} {...tt("Vollständige Button-Referenz für alle Tabs")}>Anleitung</button>
            </div>
          </div>

          {infoModus === "uebersicht" && (
            <div className="sektion">
              <div style={{background:"#f7f5f0", borderRadius:12, padding:"14px 16px", fontSize:"0.85rem", lineHeight:1.65, color:"#3b3832"}}>
                <div style={{fontWeight:700, marginBottom:6, fontSize:"0.95rem"}}>Vokabel-Trainer</div>
                <p style={{margin:0}}>
                  Lerne Vokabeln aus eigenen Listen – flexibel, ohne Anmeldung, direkt im Browser.
                  Alle Daten bleiben auf diesem Gerät.
                </p>
                <div style={{marginTop:10, display:"flex", flexDirection:"column", gap:4}}>
                  <div><span style={{fontWeight:600}}>Listen</span> – Vokabeln verwalten, importieren und exportieren</div>
                  <div><span style={{fontWeight:600}}>Quiz</span> – Abfragen mit Karte, Tippen oder Diktat</div>
                  <div><span style={{fontWeight:600}}>Statistik</span> – Lernfortschritt auf einen Blick</div>
                </div>
              </div>
            </div>
          )}

          {/* Aufklappbarer Kontext: Konzept / Anleitung */}
          {infoModus !== "uebersicht" && (
            <div ref={infoKontextContainerRef}>
              {infoModus === "konzept" ? (
                <div className="sektion" style={{fontSize:"0.85rem", lineHeight:1.75, color:"#3b3832"}}>
                  {[
                    {titel:"Listen", text:"Alles beginnt mit einer Liste. Eine Liste ist eine Sammlung von Vokabelpaaren – zum Beispiel Deutsch und Englisch, oder Begriff und Erklärung. Jede Liste kann bis zu sieben Spalten haben (drei Fremdsprache, zwei Deutsch, zwei Info), die du frei benennen kannst – z. B. für unregelmäßige Verben: Infinitiv, Simple Past, Past Participle. Jede Liste hat eine Fremdsprache; oben rechts kannst du zwischen den Sprachen wechseln. Du kannst so viele Listen anlegen wie du möchtest, sie importieren, exportieren und teilen."},
                    {titel:"Vokabelgruppen", text:"Für das Quiz wählst du aus, welche Vokabeln abgefragt werden sollen. Das ist deine Vokabelgruppe: entweder alle Vokabeln einer oder mehrerer Listen, oder eine gezielte Auswahl einzelner Einträge per Checkbox oder Von–Bis-Bereich. Die Vokabelgruppe ist das Material für eine Abfragerunde."},
                    {titel:"Abfragen", text:"Eine Abfrage geht durch alle Vokabeln der Gruppe einmal durch. Dabei bewertest du dich selbst: War die Antwort richtig oder falsch? Das Ergebnis fließt direkt in den Score ein. Jede Vokabel hat einen eigenen Score, der über Zeit steigt oder fällt. Unbeantwortete Vokabeln starten bei 0 und werden optionally zuerst gestellt."},
                    {titel:"Modi", text:"Du kannst zwischen drei Abfrage-Modi wählen:\n\nKarte (Frage–Antwort): Die Frage wird angezeigt, du denkst nach, tippst die Karte an um die Antwort zu sehen, und bewertest dich selbst mit Richtig oder Falsch.\n\nWechselnd: Frage- und Antwortspalte wechseln sich zwischen den Vokabeln ab – hält das Gehirn aktiver.\n\nDiktat: Die Antwort wird vorgelesen, du tippst sie ein. Ideal für Hörverstehen und Schreibübungen."},
                    {titel:"Scoring & Streak", text:"Jede Vokabel hat einen Score (von –10 bis +10). Richtige Antworten geben +1, falsche Antworten kosten Punkte je nach Schwierigkeitsgrad und Fehlerzahl. Wer mehrere Vokabeln hintereinander richtig beantwortet, bekommt ab dem dritten Mal in Folge einen Streak-Bonus – der Score steigt dann schneller. Hat eine Vokabel mehrere Antwort-Spalten (z. B. Infinitiv, Simple Past, Past Participle), werden alle abgefragt, aber der Score ändert sich nur einmal: richtig nur, wenn alle Spalten gewusst wurden."},
                    {titel:"Reihenfolge & Filter", text:"Du entscheidest, in welcher Reihenfolge die Vokabeln kommen: zufällig gemischt, nach schlechtestem Score (was du noch nicht gut kannst, kommt zuerst), oder in der Originalreihenfolge der Liste. Optional lässt sich ein Score-Filter setzen, sodass nur Vokabeln bis zu einem bestimmten Score angezeigt werden."},
                    {titel:"Sessions & Pakete", text:"Mit dem Session-Modus teilst du die Vokabelgruppe in kleinere Pakete auf – zum Beispiel 10 Vokabeln auf einmal. Nach jedem Paket kannst du pausieren, dann wird der Fortschritt gespeichert. Beim nächsten Mal werden bereits abgefragte Vokabeln übersprungen. So arbeitest du dich über mehrere Sitzungen durch die gesamte Gruppe."},
                    {titel:"Abfrage-Ziel", text:"Standardmäßig wird jede Vokabel einmal abgefragt. Mit dem Abfrage-Ziel kannst du das ändern:\n\nAnzahl: jede Vokabel 1×, 2× oder 3× pro Durchgang.\n\nMit Wiederholung: Vokabeln werden so lange neu eingereiht, bis du sie 1×, 2× oder 3× in Folge richtig beantwortet hast.\n\nScore-Ziel: Vokabeln werden wiederholt, bis ihr Score einen bestimmten Wert erreicht – global oder bezogen auf den Fortschritt der laufenden Session."},
                {titel:"Konfigurationen speichern", text:"Eine Kombination aus Vokabelgruppe, Abfrage-Modus, Reihenfolge und Session-Einstellung kann gespeichert und jederzeit wieder geladen werden. So richtest du zum Beispiel eine tägliche Übung mit den schlechtesten 20 Vokabeln einmal ein und startest sie beim nächsten Mal mit einem Tipp."},
                {titel:"Statistik", text:"Die Statistik zeigt dir für jede Vokabel den aktuellen Score als Balken und Zahl, das Datum der letzten Abfrage und einen sortierbaren Überblick. Das Kreisdiagramm oben zeigt auf einen Blick, wie viele Vokabeln gelernt, in Arbeit, nie abgefragt oder negativ sind. Der Lernfortschritt in der Kopfzeile zeigt, wie weit die gewählte Vokabelgruppe gelernt ist."},
              ].map(abschnitt => (
                <div key={abschnitt.titel} style={{marginBottom:20}}>
                  <div className="sektion-label" style={{marginBottom:6}}>{abschnitt.titel}</div>
                  <div style={{background:"#f7f5f0", borderRadius:10, padding:"12px 14px", whiteSpace:"pre-line"}}>
                    {abschnitt.text}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sektion" style={{fontSize:"0.85rem", lineHeight:1.7, color:"#3b3832"}}>
              <div style={{background:"#e8f5e9", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:"0.8rem", color:"#2d6a4f", lineHeight:1.55}}>
                💡 <strong>Tipp:</strong> Tippe oben links auf ⓘ: Im Info-Modus sind erklärbare Elemente gestrichelt markiert – antippen zeigt die Erklärung, statt die Aktion auszuführen. Alternativ einen Knopf gedrückt halten. Die Erklärung bleibt stehen, bis du irgendwo hintippst. Am PC erscheint sie auch beim Darüberfahren.
              </div>
              {[
                {titel:"Listen-Tab", inhalt:[
                  {k:"Übersicht", v:"Zeigt alle Vokabellisten in einem Raster (Größe unter Einstellungen → Listen, bis 100 Zeilen × 4 Spalten). Tippe eine Liste an, um sie zu öffnen. Lang drücken zeigt den vollen Namen und darunter „Umbenennen“, „Duplizieren“ (Kopie mit allen Vokabeln, Lernstände beginnen neu), „Verschieben“, „In Sessions aufteilen“, „Lernstand zurücksetzen“ (Scores für Übersetzung, Diktat und/oder Akzente löschen, mit Rückfrage) und „Löschen“. „In Sessions aufteilen“ öffnet den Quiz-Tab mit dieser Liste und einem gelben Kasten: Name (vorgegeben: Listenname), Gruppengröße (10, 20, 25, 50, 75, 100 oder eigene), Bereich von–bis (Vokabel-Nummern) und bei Rest „eigene Gruppe“ oder „an letzte anhängen“; die Vorschau zeigt die Namen, z. B. „Verbes (21 - 40)“. Darunter alle Einstellungen wie gewohnt wählen, dann „Sessions anlegen“: je Gruppe eine gespeicherte Konfiguration, zusammen ab der nächsten freien Zeile im Raster. Namen, die es schon gibt, werden übersprungen. Lang drücken und ziehen verschiebt die Liste direkt; auf einem belegten Platz tauschen die beiden. Die Reihenfolge gilt auch in Quiz- und Statistik-Tab. Mit Sprachfilter rücken die sichtbaren Listen zusammen – verschoben wird unter „Alle“."},
                  {k:"[+] Neue Liste", v:"Legt eine leere Liste mit eigenem Namen an."},
                  {k:"▲/▼ Aktionszeile", v:"Öffnet Aktionen zur Liste: Kopieren, JSON, TXT, Löschen. JSON = vollständige Sicherung mit Lernstand (Datei „Name - JSON.txt“), TXT = nur die Vokabeln als Text ohne Scores (Datei „Name - TXT.txt“). Auf iPad/iPhone öffnet sich dafür das Teilen-Menü („In Dateien sichern“, Mail, AirDrop), sonst wird die Datei heruntergeladen. Beim Import ist die Endung egal – die App erkennt den Inhalt."},
                  {k:"Stift-Button", v:"Listenname umbenennen."},
                  {k:"Vokabeln [+]", v:"Neue Vokabel am Ende der Liste hinzufügen."},
                  {k:"Stift an Vokabel", v:"Vokabel bearbeiten oder löschen."},
                  {k:"Spalten", v:"Jede Liste hat bis zu 7 Spalten: E1–E3 (Fremdsprache), D1–D2 (Deutsch), i1–i2 (Info). Spalten lassen sich benennen und aktivieren/deaktivieren. Der Stift-Button neben der Spalte öffnet den Namen-Editor."},
                  {k:"Fremdsprache", v:"Legt fest, welche Sprache in den Spalten E1–E3 steht (Englisch, Französisch, Spanisch …). Danach richten sich Vorlese-Stimme, Diktat und der Sprach-Filter."},
                  {k:"Sprach-Auswahl (oben rechts)", v:"Erscheint, sobald Listen in mehr als einer Sprache vorhanden sind. Zeigt in Listen, Quiz und Statistik nur Listen der gewählten Sprache – oder alle."},
                  {k:"Quiz starten", v:"Wechselt direkt zum Quiz-Tab mit dieser Liste vorausgewählt."},
                  {k:"Statistik", v:"Öffnet die Statistik für diese Liste."},
                  {k:"Zusammenführen", v:"Fügt die Vokabeln einer anderen Liste in diese Liste ein."},
                  {k:"Import", v:"Vokabeln aus einer TXT-Datei oder JSON-Datei importieren."},
                ]},
                {titel:"Quiz-Tab", inhalt:[
                  {k:"Verlauf & Gespeichert", v:"Oben im Tab. Zeigt gespeicherte Konfigurationen (benannt) und automatische Verlaufs-Einträge der letzten Quiz-Starts. Nach der Auswahl klappt der Bereich zu; eine gespeicherte Konfiguration erscheint dann mittig in einer grünen Kopfzeile – antippen öffnet die Auswahl wieder. Jede Konfiguration führt für Übersetzung, Diktat und Akzente einen eigenen Paket-Fortschritt: Beim Wechsel des Abfrage-Modus springt der Fortschritt auf den Stand dieser Art. Ein Tipp auf die Fortschrittszahl (z. B. „10 / 14 — 71%“) beginnt nach kurzer Rückfrage für die aktuelle Art eine neue Session – gelöscht wird nur, welche Vokabeln schon abgefragt wurden; Scores und Lernfortschritt bleiben. Gespeicherte Konfigurationen liegen in einem Raster (Größe unter Einstellungen → Gespeicherte Konfigurationen, bis 100 Zeilen × 4 Spalten). Lang drücken auf einen Eintrag zeigt den vollständigen Namen und darunter „Umbenennen“, „Duplizieren“ (Kopie unter neuem Namen, mit eigenem Fortschritt), „Verschieben“ und „Löschen“ (Verlauf-Einträge: „Löschen“). „Verschieben“: Zielplatz antippen oder direkt ziehen – auf einem belegten Platz tauschen die beiden; „Fertig“ beendet das Verschieben. Neu Gespeichertes kommt auf den ersten freien Platz; ist das Raster voll, kommt automatisch eine Zeile dazu."},
                  {k:"Neu-Chip", v:"Setzt die aktive Session zurück – Quiz startet ohne geladene Konfiguration."},
                  {k:"Slot laden", v:"Tippe auf einen Chip, um eine gespeicherte Konfiguration (Listen, Vokabelauswahl, Einstellungen) zu laden."},
                  {k:"Listen-Auswahl", v:"Wähle eine oder mehrere Listen für das Quiz. [Alle] wählt alle Listen, [X] leert die Auswahl."},
                  {k:"Vokabel-Auswahl [Alle]", v:"Alle Vokabeln der gewählten Listen werden abgefragt."},
                  {k:"Vokabel-Auswahl [Bereich]", v:"Öffnet eine Checkbox-Liste. Einzelne Vokabeln an-/abwählen. [Von–Bis] ermöglicht Bereichsauswahl per 2 Klicks."},
                  {k:"Abfrage-Modus", v:"Frage–Antwort: Karte aufdecken. Wechselnd: Frage- und Antwortspalten wechseln sich ab. Diktat: Antwort wird vorgelesen, du tippst die Lösung. Die Zeile zeigt die gewählte Art der Abfrage (Karte, MC, Tastatur, Akzente bzw. Diktat). Bei mehreren Antwortspalten mit Akzente-Spalte werden Wörter ohne Akzent – je nach Schwierigkeitsgrad – nur in der Akzente-Spalte ausgelassen; der Start-Knopf zählt alle Vokabeln, die in mindestens einer Spalte abgefragt werden."},
                  {k:"Akzente", v:"Antwort-Modus für Fremdsprachen-Spalten: Das Wort steht ohne Akzente in großen Buchstaben da. Buchstaben antippen und darunter den richtigen Akzent wählen (é è ê ë, ç, à, œ …). Richtige Akzente werden sofort grün, ein Buchstabe ohne Akzent oder eine falsche Variante leuchtet kurz rot. Sind alle Akzente richtig, wird die Antwort automatisch übernommen oder mit „Prüfen“ bestätigt (je nach Schwierigkeitsgrad). Nach einem Fehlgriff zählt die Vokabel als nicht gewusst. Eigener Akzent-Score (+1 richtig, −1 falsch). Ob auch Wörter ohne Akzent abgefragt werden, legst du beim Schwierigkeitsgrad fest."},
                  {k:"Reihenfolge", v:"Zufällig / Schlechteste (nach Score sortiert) / Listen-Nr. (Originalreihenfolge). Score-Filter: nur Vokabeln bis zu einem bestimmten Score zeigen. Unbeantwortete zuerst: noch nie abgefragte Vokabeln werden vorgezogen."},
                  {k:"Einstellungen", v:"Lautsprache: Auto-Play und welche Spalten vorgelesen werden. Schwierigkeitsgrad: Einfach oder Schwer. Darunter legst du per Haken fest, was in welcher Stufe gilt: fehlende Akzente beim Tippen als richtig werten, Punktabzug bei „Lösung anzeigen“, im Akzent-Modus auch Wörter ohne Akzent abfragen, Buchstaben mit Akzent hervorheben, die Zahl der noch fehlenden Akzente anzeigen (z. B. 2 / 3) und richtige Antworten automatisch übernehmen (sonst „Prüfen“)."},
                  {k:"Session [Alle]", v:"Alle verfügbaren Vokabeln in einem Durchgang abfragen."},
                  {k:"Session [Pakete]", v:"Vokabeln in kleinere Pakete aufteilen (5–50 Stück). Nach jedem Paket kannst du pausieren oder weitermachen. Abgefragte Vokabeln werden beim nächsten Paket übersprungen."},
                  {k:"Abfrage-Ziel", v:"Anzahl: jede Vokabel 1×/2×/3× pro Durchgang abfragen. Mit Wiederholung: Vokabeln so lange einreihen, bis jede 1×/2×/3× richtig beantwortet wurde. Score: Vokabeln so lange abfragen, bis ihr Score das Ziel erreicht."},
                  {k:"Konfiguration speichern", v:"Speichert die aktuelle Auswahl und Einstellungen unter einem Namen. Beim nächsten Mal per Chip laden."},
                  {k:"Quiz starten", v:"Startet das Quiz mit der aktuellen Konfiguration."},
                ]},
                {titel:"Im Quiz", inhalt:[
                  {k:"Karte (Frage–Antwort)", v:"Tippe auf die Karte, um die Antwort aufzudecken. Dann: Richtig oder Falsch selbst einschätzen."},
                  {k:"Tippen", v:"Antwort eintippen und bestätigen. Nach 3 Fehlversuchen wird die Lösung gezeigt. Ob fehlende Akzente als richtig gelten, hängt vom Schwierigkeitsgrad ab (Einstellungen)."},
                  {k:"Diktat", v:"Großer Lautsprecher: Wort nochmals vorlesen. Kleiner Lautsprecher: langsamer/erneut. Antwort eintippen."},
                  {k:"Scoring", v:"Richtig: +1 Punkt, Streak +1. Ab Streak 3: mindestens +2 Punkte. Falsch: Streak auf 0, Punktabzug je nach Fehlerzahl. Aufgedeckt: kein Punkt, kein Streak. Mehrere Antwort-Spalten zählen zusammen als eine Bewertung: alle gewusst = richtig, sonst falsch. Multiple Choice: nur ein Treffer ohne Fehlklick gilt als gewusst – nach einem Fehlklick darf man weitersuchen, die Spalte zählt aber als nicht gewusst."},
                  {k:"Aufdecken", v:"Zeigt die Antwort ohne Wertung."},
                  {k:"Schließen", v:"Pausiert das Quiz – beim nächsten Start über 'Pakete' weitermachen."},
                ]},
                {titel:"Statistik-Tab", inhalt:[
                  {k:"Listen-Auswahl", v:"Eine oder mehrere Listen für die Statistik wählen."},
                  {k:"Vokabel-Auswahl", v:"Alle Vokabeln oder einen bestimmten Bereich filtern."},
                  {k:"Filter-Boxen", v:"Gesamt / Nie abgefragt / Score positiv / Score negativ. Alle sind standardmäßig aktiv. Antippen deaktiviert eine Kategorie – sie erscheint dann weder in der Liste noch im Graphen. 'Gesamt' stellt alle wieder her."},
                  {k:"Kreisdiagramm", v:"Anteil der Gruppen Gelernt, In Arbeit, Nie abgefragt und Negativ mit Anzahl und Prozent. Segment antippen blendet die Gruppe in der Liste aus/ein, 'Gesamt' zeigt wieder alle. Symbol oben rechts: Vollbild."},
                  {k:"Übersetzung / Diktat / Akzente", v:"Tap in die Mitte des Kreisdiagramms wechselt, welcher Score ausgewertet wird: Übersetzung (normaler Quiz-Score), Diktat oder Akzente (nur Vokabeln mit Akzent). Kreis, Gruppen, Kopfzeile und Vokabelliste richten sich danach."},
                  {k:"Lernfortschritt", v:"Wie weit die Vokabelgruppe gelernt ist (0–100 %). Jede Vokabel zählt anteilig bis zur Gelernt-Schwelle – bei +3 z. B. Score +1 = 33 %, +2 = 67 %, ab +3 = 100 %. 100 % = alle Vokabeln gelernt. Darunter: Anzahl gelernter Vokabeln und Ø Score. Ohne Gelernt-Schwelle wird nur der Ø Score angezeigt."},
                  {k:"Gruppen", v:"Jede Vokabel gehört zu einer Gruppe: Negativ (Score unter 0, rot hinterlegt), Nie abgefragt, In Arbeit (Score 0 bis unter der Gelernt-Schwelle) und ✓ Gelernt (ab der Schwelle, grün hinterlegt). Das Kreisdiagramm (Standard-Ansicht) zeigt Anzahl und Anteil jeder Gruppe; ein Segment antippen blendet die Gruppe in Graph und Liste aus oder wieder ein, 'Gesamt' zeigt wieder alle. Lernfortschritt, Gruppen-Balken und Zähler beziehen sich auf die eingeblendeten Gruppen. Das Symbol oben rechts im Kreis öffnet die Statistik im Vollbild. Der farbige Balken unter dem Lernfortschritt zeigt die Verteilung."},
                  {k:"Score-Balken", v:"Null ist in allen Zeilen an derselben Stelle. Nach links bis −5 (tiefer = voller roter Balken), nach rechts bis zur Gelernt-Schwelle. Gelernte Vokabeln: ganzer Balken dunkelgrün."},
                  {k:"Sortierung", v:"Score / Streak / Datum / A→Z / Listen-Nr. Pfeil zeigt Richtung, nochmals tippen kehrt um."},
                  {k:"Vollbild", v:"Maximiert Graph und Vokabelliste ohne die oberen Header-Zeilen. 'Vollbild verlassen' oben rechts."},
                  {k:"Vokabelliste", v:"Alle gefilterten Vokabeln mit Score-Balken (grün = positiv, rot = negativ) und letztem Abfragedatum."},
                ]},
                {titel:"Einstellungen-Tab", inhalt:[
                  {k:"App aktualisieren", v:"„Prüfen“ sucht nach einer neuen App-Version. Wird eine gefunden, erscheint unten der Hinweis „Neue Version verfügbar“ – mit „Aktualisieren“ wird sie aktiv. Die App funktioniert auch offline."},
                  {k:"Gespeicherte Listen", v:"Zeigt, wie viele Listen aktuell auf diesem Gerät gespeichert sind."},
                ]},
              ].map(abschnitt => (
                <div key={abschnitt.titel} style={{marginBottom:20}}>
                  <div className="sektion-label" style={{marginBottom:8}}>{abschnitt.titel}</div>
                  <div className="karte">
                    {abschnitt.inhalt.map((zeile, i) => (
                      <div key={i} style={{padding:"9px 14px", borderBottom: i < abschnitt.inhalt.length-1 ? "1px solid #e0dbd2" : "none"}}>
                        <div style={{fontWeight:600, fontSize:"0.8rem", color:"#2d6a4f", marginBottom:2}}>{zeile.k}</div>
                        <div style={{fontSize:"0.82rem", color:"#3b3832"}}>{zeile.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
          )}

          {/* Immer sichtbar: Lernen / App / Daten */}
          <div className="sektion" style={infoModus !== "uebersicht" ? {paddingBottom:'100dvh'} : {}}>
            <div className="sektion-label" style={{marginBottom:10}}>Lernen</div>
            <div className="karte">
              <div className="karte-zeile" style={{flexDirection:"column", alignItems:"flex-start", gap:8}}>
                <div>
                  <div className="karte-zeile-name">Gelernt-Schwelle</div>
                  <div className="karte-zeile-sub">
                    {(einstellungen.gelerntSchwelle ?? 0) === 0
                      ? "Deaktiviert – alle Vokabeln werden abgefragt"
                      : `Score ≥ +${einstellungen.gelerntSchwelle} gilt als gelernt (Diktat: eigener Diktat-Score)`}
                  </div>
                </div>
                <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                    <button key={v} className={`toggle-opt${(einstellungen.gelerntSchwelle??0)===v?" aktiv":""}`}
                      onClick={() => speichereEinst({...einstellungen, gelerntSchwelle: v})}
                      {...tt(v === 0 ? "Deaktiviert – alle Vokabeln werden abgefragt" : `Vokabeln mit Score ≥ +${v} gelten als gelernt`)}>
                      {v === 0 ? "Aus" : `+${v}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="sektion-label" style={{marginBottom:10, marginTop:8}}>Gespeicherte Konfigurationen</div>
            {rasterEinstellung(rasterGroesse(einstellungen), slots.gespeichert.length, setzeRasterGroesse,
              "Plätze für gespeicherte Konfigurationen im Quiz- und Statistik-Tab", "Ist das Raster beim Speichern voll, kommt automatisch eine Zeile dazu.", "")}
            <div className="sektion-label" style={{marginBottom:10, marginTop:8}}>Listen</div>
            {rasterEinstellung(rasterGroesse(einstellungen, "listenRaster"), listenIndex.length, setzeListenRasterGroesse,
              "Plätze der Listen im Listen-Tab – die Reihenfolge gilt in der ganzen App", "Ist das Raster bei einer neuen Liste voll, kommt automatisch eine Zeile dazu.", "listen")}
            <div className="sektion-label" style={{marginBottom:10, marginTop:8}}>App</div>
            <div className="karte">
              <div className="karte-zeile">
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name">App aktualisieren</div>
                  <div className="karte-zeile-sub">Version {APP_VERSION} · {updateStatus || "Nach neuer Version suchen"}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  // Offline-App: Service Worker nach neuer Version fragen; UpdateHinweis zeigt dann den Banner
                  const reg = await navigator.serviceWorker?.getRegistration();
                  if (!reg) { window.location.reload(); return; }
                  if (!navigator.onLine) { setUpdateStatus("Keine Internetverbindung"); return; }
                  setUpdateStatus("Suche…");
                  try {
                    await reg.update();
                    setUpdateStatus(reg.installing || reg.waiting ? "Neue Version gefunden" : "App ist aktuell");
                  } catch {
                    setUpdateStatus("Prüfung fehlgeschlagen");
                  }
                }} {...tt("Nach neuer App-Version suchen")}>Prüfen</button>
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
        </>)}
        {tab === "listen" && ansicht === "uebersicht" && exportAuswahlModus && exportAusgewaehlt.size > 0 && (
          <div className="quiz-action-bar">
            <button {...tt("JSON: vollständige Sicherung mit Lernstand (Scores) – Datei „Name - JSON.txt“, zum Wiederherstellen oder für ein anderes Gerät")} className="btn btn-primary" onClick={() => exportiereAlsJson([...exportAusgewaehlt])}>JSON</button>
            <button {...tt("TXT: nur die Vokabeln als Text, ohne Scores – Datei „Name - TXT.txt“, zum Weitergeben oder Bearbeiten")} className="btn btn-primary" onClick={exportiereAusgewaehlteAlsDateiHandler}>TXT</button>
            <button {...tt("Ausgewählte Listen als Text in die Zwischenablage kopieren (ohne Scores)")} className="btn btn-ghost" onClick={exportiereAusgewaehlteKopierenHandler}>
              {exportKopiert ? "✓ Kopiert!" : "📋 Kopieren"}
            </button>
          </div>
        )}
      </div>

      {/* ── Modals (global) ── */}
      {modal === "neue-liste" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Neue Liste anlegen</div>
            <label className="inp-label">Name der Liste</label>
            <input {...ttFeld("Name der neuen Liste")} className="inp" placeholder="z.B. Irregular Verbs, Unit 5" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }}
              onKeyDown={e => e.key === "Enter" && erstelleListe()} />
            {modalFehler && <div className="fehler">{modalFehler}</div>}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Neue leere Liste anlegen")} className="btn btn-primary" onClick={erstelleListe}>Erstellen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "umbenennen" && (aktiveListe || listeMenueId) && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Liste umbenennen</div>
            <label className="inp-label">Neuer Name</label>
            <input {...ttFeld("Neuer Name der Liste")} className="inp" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }}
              onKeyDown={e => e.key === "Enter" && umbenennen()} />
            {modalFehler && <div className="fehler">{modalFehler}</div>}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Neuen Namen speichern")} className="btn btn-primary" onClick={umbenennen}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {modal === "liste-zuruecksetzen" && listeMenueId && (() => {
        const liste = lsGet(SK.liste(listeMenueId));
        const mitScore = art => (liste?.vokabeln || []).filter(v => v[SCORE_FELD[art]]).length;
        return (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} data-zuruecksetzen>
            <div className="modal-titel">Lernstand zurücksetzen?</div>
            <p style={{fontSize:"0.9rem", color:"#6b6560", lineHeight:1.5, marginTop:0}}>
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
      })()}
      {modal === "liste-duplizieren" && listeMenueId && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Liste duplizieren</div>
            <label className="inp-label">Name der Kopie</label>
            <input {...ttFeld("Name der neuen Liste")} className="inp" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }}
              onKeyDown={e => e.key === "Enter" && dupliziereListe()} />
            <div style={{fontSize:"0.78rem", color:"#6b6560", marginTop:6}}>Die Kopie enthält alle Vokabeln und Spalten – die Lernstände beginnen neu.</div>
            {modalFehler && <div className="fehler">{modalFehler}</div>}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Kopie der Liste anlegen")} className="btn btn-primary" onClick={dupliziereListe}>Duplizieren</button>
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
            <input {...ttFeld("Neuer Name der Spalte")} className="inp" value={modalInput} autoFocus
              onChange={e => setModalInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && speichereSpaltenname()} />
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Spaltennamen speichern")} className="btn btn-primary" onClick={speichereSpaltenname}>Speichern</button>
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
                <input {...ttFeld("Inhalt dieser Spalte bearbeiten")} className="inp" value={bearbeiteEingaben[typ] || ''}
                  onChange={e => setBearbeiteEingaben(prev => ({...prev, [typ]: e.target.value}))}
                  onKeyDown={e => e.key === 'Enter' && speichereVokabelBearbeitung()}
                />
              </div>
            ))}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => { setModal(null); setBearbeiteVokabel(null); }}>Abbrechen</button>
              <button {...tt("Änderungen an der Vokabel speichern")} className="btn btn-primary" onClick={speichereVokabelBearbeitung}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {gruppenQuiz && (
        <div className="overlay" onClick={() => setGruppenQuiz(null)}>
          <div className="modal" data-gruppen-quiz onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Quiz starten?</div>
            <p style={{fontSize:"0.9rem", color:"#6b6560", lineHeight:1.5}}>
              {gruppenQuiz.ids.length} Vokabel{gruppenQuiz.ids.length !== 1 ? "n" : ""} aus „{gruppenQuiz.name}“
              ({STATISTIK_ARTEN.find(([a]) => a === gruppenQuiz.art)?.[1]}), schlechteste zuerst.
              {gruppenQuizPasst(gruppenQuiz)
                ? <> Einmalige Runde: {aktiverSlot ? <>„{getSlotEintrag(aktiverSlot.typ, aktiverSlot.id)?.name || "Auswahl"}“</> : "deine Quiz-Auswahl"} und der Session-Fortschritt bleiben erhalten, die Scores verbessern sich.</>
                : <> Spalten und Abfrage-Modus wie im Quiz eingestellt; {quizAbfrageArt !== gruppenQuiz.art ? "Abfrageart und Quiz-Auswahl werden" : "die Quiz-Auswahl wird"} dafür umgestellt{aktiverSlot ? ", die gewählte Konfiguration wird gelöst" : ""}.</>}
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne ein Quiz zu starten")} className="btn btn-ghost" onClick={() => setGruppenQuiz(null)}>Abbrechen</button>
              <button {...tt("Quiz mit diesen Vokabeln starten")} className="btn btn-primary" onClick={() => starteGruppenQuiz(gruppenQuiz)}>Starten</button>
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
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Vokabel endgültig löschen")} className="btn btn-danger" onClick={() => loescheVokabel(bearbeiteVokabel.id)}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "liste-zusammenfuehren" && aktiveListe && (() => {
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
      })()}
      {modal === "slot-speichern" && (() => {
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
                <div style={{fontSize:"0.78rem", color:"#9b9590", textAlign:"center", margin:"10px 0 6px"}}>
                  oder als neue Konfiguration speichern:
                </div>
              </>)}

              <label className="inp-label">Name</label>
              <input {...ttFeld("Name für den gespeicherten Eintrag")} className="inp" value={modalInput} autoFocus
                onChange={e => setModalInput(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="z.B. Irregular Verbs" />

              {andereSlots.length > 0 && (
                <div style={{marginTop:14}}>
                  <div className="inp-label">{istGespeichert ? "Anderen Slot ersetzen" : "Vorhandenen Slot ersetzen"}</div>
                  <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:8}}>
                    {andereSlots.map(s => (
                      <button {...tt(`Eintrag „${s.name}“ mit der aktuellen Einstellung überschreiben`)} key={s.id} className="slot-chip belegt"
                        onClick={() => doUeberschreiben(s)}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button {...tt("Schließen, ohne etwas zu speichern")} className="btn btn-ghost" onClick={schliesseModal}>Abbrechen</button>
                <button {...tt("Als neuen Eintrag speichern")} className="btn btn-primary" onClick={doSpeichernNeu}>
                  {istGespeichert ? "Neu speichern" : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {slotUmbenennen && (() => {
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
              {doppelt && <div style={{fontSize:"0.78rem", color:"#c0392b", marginTop:6}}>Diesen Namen gibt es schon.</div>}
              <div style={{fontSize:"0.75rem", color:"#9b9590", marginTop:8}}>{kopie
                ? "Die Kopie übernimmt alle Einstellungen, beginnt aber mit einem eigenen Paket-Fortschritt. Sie kommt auf den ersten freien Platz im Raster."
                : "Platz im Raster, Einstellungen und Fortschritt bleiben erhalten."}</div>
              <div className="modal-actions">
                <button {...tt(kopie ? "Schließen, ohne zu duplizieren" : "Schließen, ohne umzubenennen")} className="btn btn-ghost" onClick={schliessen}>Abbrechen</button>
                <button {...tt(kopie ? "Kopie unter diesem Namen anlegen" : "Neuen Namen speichern")} data-umbenennen-speichern className="btn btn-primary" disabled={!name || doppelt} onClick={speichern}>Speichern</button>
              </div>
            </div>
          </div>
        );
      })()}
      {loescheSlotNr !== null && (
        <div className="overlay" onClick={() => setLoescheSlotNr(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Slot löschen?</div>
            <p style={{fontSize:"0.9rem", color:"#6b6560", lineHeight:1.5}}>
              {`"${getSlotEintrag(loescheSlotNr.typ, loescheSlotNr.id)?.name || 'Dieser Eintrag'}" wird dauerhaft gelöscht.`}
              {Object.keys(slotSFAlle(getSlotEintrag(loescheSlotNr.typ, loescheSlotNr.id))).length > 0 ? " Der Session-Fortschritt geht verloren." : ""}
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu löschen")} className="btn btn-ghost" onClick={() => setLoescheSlotNr(null)}>Abbrechen</button>
              <button {...tt("Eintrag endgültig löschen")} className="btn btn-danger" onClick={() => loescheSlotEintrag(loescheSlotNr.typ, loescheSlotNr.id)}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {gruppenAenderungsDialog && aktiverSlot?.typ === 'gespeichert' && (() => {
        const slotName = getSlotEintrag('gespeichert', aktiverSlot.id)?.name || '';
        return (
          <div className="overlay" onClick={() => setGruppenAenderungsDialog(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-titel">Vokabelgruppe geändert</div>
              <p style={{fontSize:"0.9rem", color:"#6b6560", lineHeight:1.5}}>
                Die Vokabelgruppe wurde seit dem Laden von „{slotName}" geändert.
              </p>
              <div className="modal-actions" style={{flexDirection:"column", gap:8}}>
                <button {...tt("Gespeicherten Eintrag mit der geänderten Auswahl überschreiben")} className="btn btn-primary" onClick={() => {
                  speichereAlsGespeichert(aktiverSlot.id, slotName);
                  setGruppenAenderungsDialog(false);
                  starteQuiz(true);
                }}>Überspeichern</button>
                <button {...tt("Geänderte Auswahl als neuen Eintrag speichern")} className="btn btn-ghost" onClick={() => {
                  setGruppenAenderungsDialog(false);
                  setModalInput(slotNamenVorschlag());
                  setModal("slot-speichern");
                }}>Neu speichern</button>
                <button {...tt("Quiz mit der geänderten Auswahl starten, ohne zu speichern")} className="btn btn-ghost" style={{fontSize:"0.82rem", color:"#6b6560"}} onClick={() => {
                  const newId = erstelleVerlaufEintrag();
                  setGruppenAenderungsDialog(false);
                  starteQuiz(true, {typ:'verlauf', id:newId});
                }}>Fortfahren ohne Speichern</button>
                <button {...tt("Auswahl auf den gespeicherten Stand zurücksetzen")} className="btn btn-ghost" style={{fontSize:"0.82rem", color:"#6b6560"}} onClick={() => {
                  ladeSlot(aktiverSlot.typ, aktiverSlot.id);
                  setGruppenAenderungsDialog(false);
                }}>Zurücksetzen</button>
                <button {...tt("Schließen, ohne zu starten")} className="btn btn-ghost" style={{fontSize:"0.82rem", color:"#9b9590"}} onClick={() => setGruppenAenderungsDialog(false)}>Abbrechen</button>
              </div>
            </div>
          </div>
        );
      })()}
      {sessionUeberschreibenModal && (
        <div className="overlay" onClick={() => setSessionUeberschreibenModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Session überschreiben?</div>
            <p style={{fontSize:"0.9rem", color:"#6b6560", lineHeight:1.5}}>
              Es gibt bereits eine aktive Session mit einer anderen Konfiguration. Soll diese überschrieben werden?
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne zu starten")} className="btn btn-ghost" onClick={() => setSessionUeberschreibenModal(false)}>Abbrechen</button>
              <button {...tt("Bisherige Session verwerfen und neu beginnen")} className="btn btn-primary" onClick={() => { setSessionUeberschreibenModal(false); starteQuiz(true); }}>Neu starten</button>
            </div>
          </div>
        </div>
      )}
      {modal === "loeschen" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Liste löschen?</div>
            <p style={{fontSize:"0.9rem", color:"#6b6560", lineHeight:1.5}}>
              {listeMenueId ? <>„{listenIndex.find(l => l.id === listeMenueId)?.name}“ wird</> : "Diese Liste wird"} dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu löschen")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Liste mit allen Vokabeln endgültig löschen")} className="btn btn-danger" onClick={loeschen}>Löschen</button>
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
              { key: "akzentFortschritt", label: "Akzent-Fortschritt" },
            ].map(({ key, label, pflicht }) => (
              <label key={key} style={{display:"flex", alignItems:"center", gap:10, marginBottom:10, fontSize:"0.9rem", cursor: pflicht ? "default" : "pointer"}}>
                <input {...ttFeld("Diesen Teil in den Export aufnehmen")} type="checkbox" checked={pflicht || !!jsonExportOptionen[key]}
                  disabled={pflicht}
                  onChange={e => !pflicht && setJsonExportOptionen(prev => ({...prev, [key]: e.target.checked}))}
                  style={{width:18, height:18}} />
                {label}{pflicht && <span style={{fontSize:"0.75rem", color:"#aaa"}}> (immer)</span>}
              </label>
            ))}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne zu exportieren")} className="btn btn-ghost" onClick={() => { setModal(null); setJsonExportIds(null); }}>Abbrechen</button>
              <button {...tt("Export mit diesen Optionen erstellen")} className="btn btn-primary" onClick={exportiereAlsJsonBestaetigt}>Exportieren</button>
            </div>
          </div>
        </div>
      )}

      {zuklappHinweis && !quiz && (
        <button {...tt("Bereich zuklappen")} onClick={klappeFreieZu}
          style={{position:"fixed", left:"50%", bottom:16, transform:"translateX(-50%)", zIndex:50,
            background:"rgba(45,106,79,0.92)", color:"#fff", border:"none", borderRadius:20, padding:"7px 14px",
            fontSize:"0.75rem", fontWeight:600, fontFamily:"inherit", boxShadow:"0 2px 10px rgba(0,0,0,0.2)", cursor:"pointer", whiteSpace:"nowrap"}}>
          ▲ Weiter ziehen oder hier tippen zum Zuklappen
        </button>
      )}
    </>
  );
}
