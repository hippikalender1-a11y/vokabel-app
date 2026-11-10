import { useState, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { zeigeInfo, schliesseInfo, schalteInfoModus, setzeFarbeImMenue } from "./infoEreignisse.js";

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
  letzteSicherung: "vokabel_letzte_sicherung",   // Zeitpunkt der letzten Gesamtsicherung
  sicherungBasis:  "vokabel_sicherung_basis",    // noch nie gesichert: ab hier zählt die Erinnerung
  sicherungSpaeter: "vokabel_sicherung_spaeter", // Erinnerung „Später“ gedrückt (für einen Tag still)
  liste: (id)  => `vokabel_liste_${id}`,
};
// Beispielsätze: Schlüssel „listeId__vokId“ → [{ s: Satz mit *Wort*, u: Übersetzung }]
const SATZ_DB = "vokabel_saetze", SATZ_STORE = "saetze";
const SATZ_ANZAHLEN = [1, 3, 6, 10];
const SATZ_PORTION = { 1: 120, 3: 50, 6: 25, 10: 15 };   // Vokabeln je KI-Antwort
let satzDbPromise = null;
function satzDb() {
  if (!satzDbPromise) satzDbPromise = new Promise((res, rej) => {
    const r = indexedDB.open(SATZ_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(SATZ_STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return satzDbPromise;
}
async function saetzeLaden(listeId) {
  try {
    const db = await satzDb(), praefix = `${listeId}__`;
    return await new Promise(res => {
      const erg = {}, req = db.transaction(SATZ_STORE).objectStore(SATZ_STORE).openCursor(IDBKeyRange.bound(praefix, praefix + "\uffff"));
      req.onsuccess = () => { const c = req.result; if (c) { erg[c.key] = c.value; c.continue(); } else res(erg); };
      req.onerror = () => res(erg);
    });
  } catch { return {}; }
}
async function saetzeSpeichern(eintraege) {
  try {
    const db = await satzDb();
    return await new Promise(res => {
      const tx = db.transaction(SATZ_STORE, "readwrite"), st = tx.objectStore(SATZ_STORE);
      Object.entries(eintraege).forEach(([k, v]) => st.put(v, k));
      tx.oncomplete = () => res(true); tx.onerror = () => res(false);
    });
  } catch { return false; }
}
// Prompt: je Vokabel n Beispielsätze, Vokabelwort mit *Sternchen* markiert, Zeilen „ID // Satz // Übersetzung“
function satzPrompt(sprachName, zeilen, n, alsDatei = false) {
  return [
    ...(alsDatei ? [`Erstelle eine Textdatei (.txt, UTF-8) zum Herunterladen. Schreibe den Inhalt NICHT in den Chat, sondern nur in die Datei.`, ``] : []),
    `Erstelle für jede der folgenden ${sprachName}-Vokabeln genau ${n} kurze, natürliche Beispielsätze auf ${sprachName} (Schulniveau, abwechslungsreich: verschiedene Situationen und – wo möglich – verschiedene Formen des Wortes) und zu jedem Satz die deutsche Übersetzung.`,
    `Markiere in jedem ${sprachName}-Satz das Vokabelwort bzw. seine gebeugte Form mit Sternchen, z. B.: Je vais à la *maison*.`,
    `${alsDatei ? "Die Datei enthält NUR Zeilen" : "Antworte NUR mit Zeilen"} in genau diesem Format – eine Zeile pro Satz, ohne Nummerierung, ohne Überschriften, ohne Leerzeilen:`,
    `ID // Satz // Übersetzung`,
    ``,
    `Vokabeln (ID // ${sprachName} // Deutsch):`,
    ...zeilen,
  ].join("\n");
}
// Kurzer Begleitsatz zur Prompt-Datei (die KI braucht eine Nachricht zur angehängten Datei)
const SATZ_BEGLEITSATZ = "Bitte führe die Anweisungen in der angehängten Datei aus.";
// KI-Antwort lesen: „ID // Satz // Übersetzung“ (auch mit | als Trenner)
function saetzeAusAntwort(text) {
  const erg = {};
  (text || "").split(/\r?\n/).forEach(z => {
    const m = z.match(/^\s*(\d+)\s*(?:\/\/|\|)\s*(.+?)\s*(?:\/\/|\|)\s*(.+?)\s*$/);
    if (m && m[2].includes("*")) (erg[m[1]] ||= []).push({ s: m[2], u: m[3] });
  });
  return erg;
}
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
const BLITZ_MS = 700;   // ms: Aufleuchten nach Auswahl / Zuklappen
const SLOT_ZU_VERZOEGERUNG = 400;   // ms: gewählte Kachel kurz sichtbar, dann klappt die Auswahl zu
function defaultSlots() { return { verlauf: [], gespeichert: [] }; }
function neuerSlotId(typ) { return `${typ}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
// ── Raster der gespeicherten Konfigurationen und der Listen: jeder Eintrag hat einen Platz {z, s} ──
// Zeilen gibt es nicht als Einstellung: das Raster ist nach unten offen; beim Verschieben stehen unter dem
// untersten Eintrag immer RASTER_FREI_ZEILEN freie Zeilen bereit (wachsen mit, verschwinden danach wieder)
const RASTER_MAX_SPALTEN = 4, RASTER_ZEILEN_OFFEN = 100000, RASTER_FREI_ZEILEN = 2;
function rasterGroesse(einst, schluessel = "slotRaster") {
  const r = einst?.[schluessel] || {};
  const spalten = r.spalten ?? (schluessel === "listenRaster" ? 1 : 2);
  return { zeilen: RASTER_ZEILEN_OFFEN, spalten: Math.min(RASTER_MAX_SPALTEN, Math.max(1, spalten)) };
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
// Neue Einträge (ohne Platz) kommen untereinander in die erste Spalte, ab der Zeile unter dem untersten
// belegten Platz. Gültige, freie Plätze bleiben; ungültige (z. B. nach Verkleinern) kommen auf den ersten
// freien Platz (zeilenweise). Reicht das Raster nicht, wächst es um Zeilen (zeilen im Ergebnis).
function ordneRaster(gespeichert, { zeilen, spalten }) {
  const belegt = new Set();
  const key = p => `${p.z}|${p.s}`;
  const imRaster = p => p && p.z < zeilen && p.s < spalten;
  let ab = gespeichert.reduce((m, e) => imRaster(e.platz) ? Math.max(m, e.platz.z + 1) : m, 0);
  const ohnePlatz = gespeichert.some(e => !e.platz);
  gespeichert = gespeichert.map(e => e.platz ? e : { ...e, platz: { z: ab++, s: 0 } });
  let z = Math.max(zeilen, ab);
  const gueltig = p => p && Number.isInteger(p.z) && Number.isInteger(p.s) && p.z >= 0 && p.s >= 0 && p.s < spalten && p.z < z;
  const behalten = gespeichert.map(e => {
    if (gueltig(e.platz) && !belegt.has(key(e.platz))) { belegt.add(key(e.platz)); return true; }
    return false;
  });
  let geaendert = ohnePlatz;
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
// Gruppe (ids in Reihenfolge) untereinander ab Platz ziel setzen; Einträge im Weg rücken auf die
// frei gewordenen Plätze der Gruppe (ein einzelner Eintrag: die beiden tauschen)
function platziereGruppe(eintraege, ids, ziel) {
  const gruppe = ids.map(id => eintraege.find(e => e.id === id)).filter(Boolean);
  if (gruppe.length === 0) return eintraege;
  const key = p => `${p.z}|${p.s}`;
  const ziele = gruppe.map((_, i) => ({ z: ziel.z + i, s: ziel.s }));
  const zielKeys = new Set(ziele.map(key));
  const gruppenIds = new Set(gruppe.map(e => e.id));
  const frei = gruppe.map(e => e.platz).filter(p => p && !zielKeys.has(key(p)));
  const neu = new Map(gruppe.map((e, i) => [e.id, ziele[i]]));
  eintraege.forEach(e => { if (!gruppenIds.has(e.id) && e.platz && zielKeys.has(key(e.platz))) neu.set(e.id, frei.shift() || null); });
  return eintraege.map(e => {
    if (!neu.has(e.id)) return e;
    const p = neu.get(e.id);
    if (p) return { ...e, platz: p };
    const { platz: _p, ...ohne } = e;   // eslint-disable-line no-unused-vars
    return ohne;
  });
}
// Session-Gruppen (Ordner): slots.ordner = [{ id, name, platz }]; Sessions darin tragen ordner: id und einen Platz
// im Raster der Gruppe. Oberste Ebene = Gruppen + Sessions ohne Gruppe (beide mit Platz im Haupt-Raster).
function ebeneVon(data, ordnerId) {
  const ordner = data.ordner || [];
  const gibt = new Set(ordner.map(o => o.id));
  return ordnerId
    ? data.gespeichert.filter(x => x.ordner === ordnerId)
    : [...ordner.map(o => ({ ...o, istOrdner: true })), ...data.gespeichert.filter(x => !x.ordner || !gibt.has(x.ordner))];
}
function setzeEbene(data, eintraege) {
  const map = new Map(eintraege.map(e => [e.id, e]));
  const ohneMarke = ({ istOrdner: _i, ...o }) => o;   // eslint-disable-line no-unused-vars
  return { ...data,
    ordner: (data.ordner || []).map(o => map.has(o.id) ? ohneMarke(map.get(o.id)) : o),
    gespeichert: data.gespeichert.map(x => map.has(x.id) ? map.get(x.id) : x) };
}
// Name einer neuen Gruppe: gemeinsamer Namensanfang der Sessions (ohne angeschnittene Zahl), sonst „Gruppe n“
function gruppenName(namen, vorhandene = []) {
  let p = namen.reduce((a, n) => { let i = 0; while (i < a.length && i < n.length && a[i] === n[i]) i++; return a.slice(0, i); });
  while (/\d$/.test(p) && namen.some(n => /\d/.test(n[p.length] || ""))) p = p.slice(0, -1);
  p = p.replace(/[^\p{L}\p{N})\]]+$/u, "").trim();
  if (p.length >= 2) return p;
  let i = 1;
  while (vorhandene.includes(`Gruppe ${i}`)) i++;
  return `Gruppe ${i}`;
}
// Ziel unter dem Finger beim Ziehen im Raster: Platz „z|s“ oder „raus“ (auf „← Alle Sessions“: aus der Gruppe)
function zielUnter(x, y) {
  const el = document.elementFromPoint(x, y);
  return el?.closest("[data-ordner-zurueck]") ? "raus" : el?.closest("[data-raster-zelle]")?.dataset.rasterZelle || null;
}
const GRUPPE_VERWEILEN_MS = 1200;
// Kachel-Gesten (Touch): sofort wischen scrollt; so lange halten hebt die Kachel an (ziehen verschiebt) …
const KACHEL_ANHEBEN_MS = 250;
// … und so lange halten wählt sie aus (weiterfahren sammelt weitere ein, loslassen öffnet die Auswahl-Tafel);
// ist sie schon ausgewählt, bleibt sie angehoben – ziehen verschiebt dann die ganze Auswahl
const KACHEL_AUSWAEHLEN_MS = 900;   // so lange über einer Kachel halten, bis Loslassen eine Gruppe bildet
// Vokabel-Suche: nur Fremdsprache (E1–E3) und Deutsch (D1–D2), „enthält“, Groß/klein und Akzente egal;
// Treffer am Wortanfang zuerst, sonst in Listen-Reihenfolge. Ergebnis: [{ id, i (Position in voks), rang }]
const SUCH_SPALTEN = ["E1", "E2", "E3", "D1", "D2"];
function suchNorm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function sucheVokabeln(voks, text) {
  const q = suchNorm(text).trim();
  if (!q) return [];
  const treffer = [];
  voks.forEach((v, i) => {
    let rang = 2;
    for (const t of SUCH_SPALTEN) {
      const w = suchNorm(v[t]?.wert);
      for (let p = w.indexOf(q); p >= 0 && rang > 0; p = w.indexOf(q, p + 1)) rang = p === 0 || !/[\p{L}\p{N}]/u.test(w[p - 1]) ? 0 : Math.min(rang, 1);
    }
    if (rang < 2) treffer.push({ id: v.id, i, rang });
  });
  return treffer.sort((a, b) => a.rang - b.rang || a.i - b.i);
}
const SUCHE_LEER = { text: "", nr: 0, nurTreffer: false };
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
// Multiple Choice: immer 4 Antworten (2×2-Raster) – alle richtigen Teile, mit falschen aufgefüllt
const MC_ANZAHL = 4;
function generiereButtons(vokabeln, aktVok, antwortTyp, modus) {
  if (modus === "artikel") {
    const info = artikelInfo(aktVok[antwortTyp]?.wert, vokSprache(aktVok));
    if (info) return { buttons: info.kategorien.map(k => ({ text: k, korrekt: k === info.kat, status: "neutral" })), richtig: [info.kat] };
  }
  const richtigTeile = (aktVok[antwortTyp]?.wert || "").split('/').map(s => s.trim()).filter(Boolean);
  const richtigLower = richtigTeile.map(r => r.toLowerCase());
  const nFalsch = Math.max(0, MC_ANZAHL - richtigTeile.length);
  const eigenesFalsch = (aktVok[antwortTyp]?.falsch || []).filter(f => !richtigLower.includes(f.toLowerCase()));
  const gewaehltesFalsch = [...eigenesFalsch].sort(() => Math.random() - 0.5).slice(0, nFalsch);
  if (gewaehltesFalsch.length < nFalsch) {
    const andere = vokabeln
      .filter(v => v.id !== aktVok.id && v[antwortTyp])
      .flatMap(v => (v[antwortTyp].wert || "").split('/').map(s => s.trim()))
      .filter(a => !richtigTeile.includes(a) && !gewaehltesFalsch.includes(a));
    const unique = [...new Set(andere)].sort(() => Math.random() - 0.5);
    gewaehltesFalsch.push(...unique.slice(0, nFalsch - gewaehltesFalsch.length));
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
// Stimme ausdrücklich zur Sprache wählen: Manche Systeme (Chrome/Android) ignorieren sonst lang und
// lesen mit der zuletzt benutzten Stimme – dann klingt ein deutsches Wort französisch
let STIMMEN = [];
const ladeStimmen = () => { try { STIMMEN = window.speechSynthesis?.getVoices() || []; } catch { STIMMEN = []; } };
if (typeof window !== "undefined" && window.speechSynthesis) {
  ladeStimmen();
  window.speechSynthesis.addEventListener?.("voiceschanged", ladeStimmen);
}
// Vorlesen je Gerät: { sprachen: { de: voiceURI }, variante: { en: "en-GB" }, aus: { en: [voiceURI…] },
// tempoSprache: { de: 1.2 }, tempo: Gesamt-Multiplikator } – fehlt etwas: automatisch
const STIMMEN_KEY = "geraet_stimmen";
let STIMMEN_WAHL = (() => { try { return JSON.parse(localStorage.getItem(STIMMEN_KEY)) || {}; } catch { return {}; } })();
function setzeStimmenWahl(neu) { STIMMEN_WAHL = neu; try { localStorage.setItem(STIMMEN_KEY, JSON.stringify(neu)); } catch { /* egal */ } }
// Spaß-/Effekt-Stimmen (iOS/macOS) nicht anbieten
const STIMMEN_NOVELTY = /bad news|boing|bubbles|cellos|good news|jester|organ|trinoids|whisper|zarvox|albert|deranged|fred|hysterical|junior|kathy|princess|ralph|wobble|superstar|bells/i;
const stimmenFuerSprache = basis => { if (!STIMMEN.length) ladeStimmen(); return STIMMEN.filter(v => (v.lang || "").toLowerCase().replace("_", "-").split("-")[0] === basis && !STIMMEN_NOVELTY.test(v.name)); };
const normLang = x => (x || "").toLowerCase().replace("_", "-");
// Varianten einer Sprache (en-GB, en-US …), die das Gerät hat
const stimmenVarianten = basis => [...new Set(stimmenFuerSprache(basis).map(v => normLang(v.lang)))].sort();
// Stimmen der gewählten Variante ohne die abgeschalteten
const aktiveStimmen = basis => {
  const vr = STIMMEN_WAHL.variante?.[basis], aus = STIMMEN_WAHL.aus?.[basis] || [];
  return stimmenFuerSprache(basis).filter(v => (!vr || normLang(v.lang) === vr) && !aus.includes(v.voiceURI));
};
const gewaehlteStimme = basis => { const uri = STIMMEN_WAHL.sprachen?.[basis]; return uri ? aktiveStimmen(basis).find(v => v.voiceURI === uri) || null : null; };
// Sprechtempo: Tempo der Sprache × Gesamt-Tempo
const sprechTempo = basis => (STIMMEN_WAHL.tempoSprache?.[basis] || 1) * (STIMMEN_WAHL.tempo || 1);
// nächste aktive Stimme der Sprache wird die eingestellte (für „🔁 Stimme“)
function naechsteStimme(basis) {
  const aktiv = aktiveStimmen(basis);
  if (aktiv.length < 2) return aktiv[0] || null;
  const jetzt = gewaehlteStimme(basis) || stimmeFuer(basis);
  const neu = aktiv[(aktiv.indexOf(jetzt) + 1) % aktiv.length];
  setzeStimmenWahl({ ...STIMMEN_WAHL, sprachen: { ...(STIMMEN_WAHL.sprachen || {}), [basis]: neu.voiceURI } });
  return neu;
}
// Geschlecht bekannter Stimmnamen (iOS/macOS, Windows, einige Android) – unbekannt: nichts anzeigen
const STIMMEN_W = new Set("anna helena petra marlene vicki katja hedda katharina sabina kate samantha karen moira tessa fiona veena serena allison ava susan victoria zoe nicky joelle amélie amelie audrey aurélie aurelie marie virginie julie hortense monica mónica paulina marisol alice federica paola elsa ellen claire joana luciana catarina milena katya yelda zosia ewa agata laura isabela francesca sara lekha grandma flo sandy shelley martha kathy princess hazel zira linda heather".split(" "));
const STIMMEN_M = new Set("markus martin viktor yannick stefan daniel alex fred aaron arthur oliver gordon lee rishi tom evan nathan thomas jacques nicolas jorge diego juan carlos luca paolo xander felipe yuri maged cem krzysztof guy george david mark ryan eddy reed rocko grandpa ralph albert junior jamie aidan malcolm".split(" "));
const stimmeGeschlecht = v => { const w = (v?.name || "").toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean);
  return w.some(x => STIMMEN_W.has(x)) ? "♀" : w.some(x => STIMMEN_M.has(x)) ? "♂" : ""; };
// Variante als Text mit Flagge: en-GB → 🇬🇧 Britisch
const VARIANTE_NAMEN = { GB: "Britisch", US: "Amerikanisch", AU: "Australisch", IE: "Irisch", IN: "Indisch", ZA: "Südafrikanisch", NZ: "Neuseeland", CA: "Kanada",
  FR: "Frankreich", BE: "Belgien", CH: "Schweiz", DE: "Deutschland", AT: "Österreich", ES: "Spanien", MX: "Mexiko", AR: "Argentinien", CO: "Kolumbien",
  PT: "Portugal", BR: "Brasilien", IT: "Italien", NL: "Niederlande", RU: "Russland", TR: "Türkei", PL: "Polen", SG: "Singapur" };
const varianteText = vr => { const r = (vr.split("-")[1] || "").toUpperCase(); const flagge = r.length === 2 ? String.fromCodePoint(...[...r].map(c => 127397 + c.charCodeAt(0))) : "";
  return `${flagge} ${VARIANTE_NAMEN[r] || r || vr}`.trim(); };
const STIMMEN_PROBE = { de: "Hallo! So klingt diese Stimme.", en: "Hello! This is how this voice sounds.", fr: "Bonjour ! Voici comment sonne cette voix.",
  es: "¡Hola! Así suena esta voz.", it: "Ciao! Ecco come suona questa voce.", nl: "Hallo! Zo klinkt deze stem.", pt: "Olá! É assim que esta voz soa.",
  ru: "Привет! Так звучит этот голос.", tr: "Merhaba! Bu ses böyle duyuluyor.", pl: "Cześć! Tak brzmi ten głos." };
function stimmeFuer(lang) {
  if (!STIMMEN.length) ladeStimmen();
  const norm = x => (x || "").toLowerCase().replace("_", "-");
  const l = norm(lang), basis = l.split("-")[0];
  const gewaehlt = gewaehlteStimme(basis);
  if (gewaehlt) return gewaehlt;
  const wahl = liste => liste.find(v => v.default) || liste.find(v => v.localService) || liste[0];
  const aktiv = aktiveStimmen(basis);
  if (aktiv.length) return wahl(aktiv.filter(v => norm(v.lang) === l)) || wahl(aktiv);
  const exakt = STIMMEN.filter(v => norm(v.lang) === l);
  const gleich = STIMMEN.filter(v => norm(v.lang).split("-")[0] === basis);
  return wahl(exakt) || wahl(gleich) || null;
}
function aeusserung(text, lang, stimme = null) {
  const u = new SpeechSynthesisUtterance(ohneHinweis(text) || text);
  u.lang = lang || "de-DE";
  const basis = normLang(u.lang).split("-")[0];
  if (STIMMEN_WAHL.variante?.[basis]) u.lang = STIMMEN_WAHL.variante[basis];
  const v = stimme || stimmeFuer(u.lang);
  if (v) { u.voice = v; u.lang = v.lang || u.lang; }
  const rate = sprechTempo(basis);
  if (rate !== 1) u.rate = rate;
  return u;
}
// Reihenfolge der Abfrage (Quiz, Diktat, Lernen): Schlechteste / Zufällig / Listen-Nr., ggf. unbeantwortete zuerst
function ordneVokabeln(voks, scoreFeld, reihenfolge, unbeantwortet) {
  const zufall = a => [...a].sort(() => Math.random() - 0.5);
  if (reihenfolge === "schlechteste") {
    if (unbeantwortet.schlechteste) {
      const unb = voks.filter(v => !v[scoreFeld]);
      const bea = [...voks.filter(v => v[scoreFeld])].sort((a, b) => (a[scoreFeld].score ?? 0) - (b[scoreFeld].score ?? 0));
      return [...unb, ...bea];
    }
    return [...voks].sort((a, b) => (a[scoreFeld]?.score ?? 0) - (b[scoreFeld]?.score ?? 0));
  }
  if (unbeantwortet[reihenfolge]) {
    const unb = voks.filter(v => !v[scoreFeld]);
    const bea = voks.filter(v => v[scoreFeld]);
    return reihenfolge === "listennr" ? [...unb, ...bea] : [...zufall(unb), ...zufall(bea)];
  }
  return reihenfolge === "listennr" ? voks : zufall(voks);
}

// Lernen: Standard-Einstellungen (Zuerst-Seite, Pausen in Sekunden nach Wort / Übersetzung / Info, Zusatzinfo,
// Vorlesen je Seite, Einstellungen auf dem Lernbildschirm aufgeklappt)
const LERNEN_STANDARD = { aktiv: false, zuerst: "fremd", pauseWort: 1, pauseUeb: 1, pauseInfo: 3, info: true,
  vorlesen1: true, vorlesen2: false, vorlesen3: false, infoSprache: "fremd", quizStufe: "ohne", einstOffen: false };
const LERNEN_TIPPEN = 10;   // Regler ganz rechts: nicht weiterlaufen, sondern auf Antippen warten
// geschätzte Lesezeit (ohne Vorlesen), etwa Sprechtempo: ~14 Zeichen je Sekunde
const lernLesezeit = text => Math.max(600, 400 + (text || "").length / 14 * 1000);

// Gelernt-Effekt: Sternenregen von der Antwort-Karte nach außen (8 Sterne, leicht versetzt)
function GelerntSterne() {
  return (
    <span className="gelernt-sterne" data-gelernt-sterne aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="stern" style={{ "--w": `${i * 45 + (i % 2 ? 12 : -8)}deg`, "--r": `${i % 2 ? 150 : 120}px`, "--v": `${(i % 3) * 40}ms` }}>{i % 2 ? "✦" : "★"}</span>
      ))}
    </span>
  );
}

const BLITZ_SEKUNDEN = 60;
const REKORDE_KEY = "vokabel_rekorde";   // Rekorde Blitzrunde / Serie je Session bzw. Liste
// Antwortarten einer Spalte: eine (Text) oder mehrere (Liste – je Frage wird zufällig eine gewählt)
// Start-Knopf im Quiz-Tab: nennt die gewählte Abfrageart
const START_TEXT = { uebersetzung: "Übersetzung starten", diktat: "Diktat starten", akzente: "Akzente starten" };
const MODI_REIHENFOLGE = ["karte", "mc", "hoeren", "tippen", "puzzle", "luecke", "artikel", "satzfinden", "lueckensatz", "satzbauen", "akzent", "zuordnung", "memory"];
// Satz-Arten brauchen Beispielsätze (SATZ_CACHE, aus IndexedDB geladen); ohne Sätze wird eine andere Art gezogen
const SATZ_ARTEN = ["satzfinden", "lueckensatz", "satzbauen"];
let SATZ_CACHE = {};
const hatSaetze = vok => (SATZ_CACHE[vok?.id] || []).length > 0;
// Satz für eine Frage (gleicher Satz beim Neuzeichnen): Wörter mit Satzzeichen, markiertes Wort, Übersetzung
function satzFuer(vok, seed) {
  const liste = SATZ_CACHE[vok?.id] || [];
  if (!liste.length) return null;
  const x = liste[Math.floor(zufallMitSeed(seed)() * liste.length)];
  const woerter = x.s.replace(/\*([^*]+)\*/g, (m, w) => `*${w.replace(/\s+/g, "\u00a0")}*`).split(/\s+/).filter(Boolean)
    .map(w => ({ text: w.replace(/\*/g, "").replace(/\u00a0/g, " "), ziel: w.includes("*"), kern: (w.match(/\*([^*]+)\*/) || [])[1]?.replace(/\u00a0/g, " ") || null }));
  const form = (x.s.match(/\*([^*]+)\*/) || [])[1] || "";
  return { satz: x.s.replace(/\*/g, ""), woerter, form, ueb: x.u };
}
// Runden-Arten: eine Ziehung startet eine Runde mit mehreren Vokabeln
const RUNDEN_ARTEN = ["zuordnung", "memory"];
const istRunde = m => RUNDEN_ARTEN.includes(m);
const istMC = m => m === "mc" || m === "hoeren" || m === "artikel";   // „Hören“ = MC mit verdeckter Frage, „Artikel“ = MC mit den Artikeln
// Artikel je Sprache: Kategorien (Knöpfe) und welche Artikel dazu gehören; „l'“ u. Ä. verraten das Geschlecht nicht
const ARTIKEL_KAT = {
  fr: { kat: ["le", "la"], map: { le: "le", un: "le", la: "la", une: "la" } },
  es: { kat: ["el", "la"], map: { el: "el", un: "el", la: "la", una: "la" } },
  it: { kat: ["il / lo", "la"], map: { il: "il / lo", lo: "il / lo", un: "il / lo", uno: "il / lo", la: "la", una: "la" } },
  pt: { kat: ["o", "a"], map: { o: "o", um: "o", a: "a", uma: "a" } },
  nl: { kat: ["de", "het"], map: { de: "de", het: "het" } },
  de: { kat: ["der", "die", "das"], map: { der: "der", die: "die", das: "das" } },
};
function artikelInfo(wert, sprache) {
  const def = ARTIKEL_KAT[sprache];
  if (!def) return null;
  const m = ohneHinweis((wert || "").split("/")[0]).trim().match(/^(\S+)\s+(.+)$/);
  const kat = m && def.map[m[1].toLowerCase()];
  return kat ? { kat, rest: m[2], kategorien: def.kat } : null;
}
// Sprache einer Vokabel aus ihrer Liste (Index im Speicher)
function vokSprache(vok) {
  const id = vok?._listeId;
  if (!id) return null;
  try { return (JSON.parse(localStorage.getItem("vokabel_listen_index")) || []).find(l => l.id === id)?.sprache || "en"; } catch { return null; }
}
const modiVon = m => Array.isArray(m) ? m : [m || STANDARD_ANTWORT_MODUS];
// je Frage und Spalte: aus mehreren angehakten Antwortarten gleich verteilt eine wählen;
// Akzente nur bei Wörtern mit Akzent (und eingeschalteten Akzenten der Sprache)
// Gewichtung der Antwortarten beim Mischen (Prozent, werden auf die angehakten Arten umgerechnet);
// Zuordnung: Anteil je Ziehung (eine Ziehung startet eine Runde mit mehreren Vokabeln)
const STANDARD_ANTWORT_GEWICHTE = { karte: 50, mc: 30, hoeren: 15, akzent: 30, tippen: 15, puzzle: 15, luecke: 15, artikel: 15, satzfinden: 10, lueckensatz: 15, satzbauen: 10, zuordnung: 5, memory: 5 };

// ── Puzzle / Lücken: gleiche Zufallsfolge je Frage (Seed), damit sich beim Neuzeichnen nichts verschiebt ──
function zufallMitSeed(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FESTES_ZEICHEN = /[\s'’\-.,!?;:()]/;   // bleibt stehen (keine Kachel, keine Lücke)
// Lücken: typische Stolperstellen werden bevorzugt (Akzente, Buchstabengruppen, Doppelkonsonanten, stumme Endungen);
// Anzahl wächst mit dem Score (Schwer: eine Stufe mehr); der erste Buchstabe bleibt stehen
const LUECKEN_GRUPPEN = ["eau", "aux", "eux", "ou", "ai", "ei", "oi", "au", "eu", "ie", "ea", "ee", "oo", "ph", "th", "ch", "sh", "gh", "gn", "qu", "ck", "tion"];
function lueckenPositionen(wort, score, schwer, seed) {
  const zufall = zufallMitSeed(seed);
  const w = wort.toLowerCase();
  const kand = [...wort].map((c, i) => i).filter(i => !FESTES_ZEICHEN.test(wort[i]) && (i > 0 || wort.length <= 2));
  if (!kand.length) return [];
  const gewicht = i => {
    let g = 1;
    if (/[àâäéèêëîïôöûùüÿçœæñßáíóú]/i.test(wort[i])) g += 5;
    if (LUECKEN_GRUPPEN.some(gr => { for (let a = Math.max(0, i - gr.length + 1); a <= i; a++) if (w.startsWith(gr, a)) return true; return false; })) g += 2;
    if (w[i] === w[i - 1] || w[i] === w[i + 1]) g += 2;
    if (i >= w.length - 3 && /(e|es|s|t|x|d|ent)$/.test(w)) g += 1;
    return g;
  };
  const anteil = (score <= 0 ? 0.2 : score <= 2 ? 0.35 : 0.5) + (schwer ? 0.1 : 0);
  const n = Math.max(1, Math.min(kand.length, Math.round(kand.length * anteil)));
  const pool = kand.map(i => [i, gewicht(i)]), gewaehlt = [];
  while (gewaehlt.length < n && pool.length) {
    let r = zufall() * pool.reduce((x, [, g]) => x + g, 0), k = 0;
    while (k < pool.length - 1 && (r -= pool[k][1]) >= 0) k++;
    gewaehlt.push(pool[k][0]); pool.splice(k, 1);
  }
  return gewaehlt.sort((a, b) => a - b);
}
function puzzleKacheln(wort, seed) {
  const zufall = zufallMitSeed(seed);
  const k = [...wort].map((z, i) => ({ z, i })).filter(x => !FESTES_ZEICHEN.test(x.z));
  for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [k[i], k[j]] = [k[j], k[i]]; }
  return k;
}
let ANTWORT_GEWICHTE = { ...STANDARD_ANTWORT_GEWICHTE };
const gewichtVon = m => Math.max(0, ANTWORT_GEWICHTE[m] ?? STANDARD_ANTWORT_GEWICHTE[m] ?? 0);
function gewichtetWaehlen(kand) {
  const summe = kand.reduce((s, m) => s + gewichtVon(m), 0);
  if (summe <= 0) return kand[Math.floor(Math.random() * kand.length)];
  let r = Math.random() * summe;
  for (const m of kand) { r -= gewichtVon(m); if (r < 0) return m; }
  return kand[kand.length - 1];
}
// Richtung je Antwortart: Hören nur mit fremdsprachiger Frage, Lücken nur mit fremdsprachiger Antwort,
// Memory nur, wenn die Fremdsprache unter den Karten liegt (übrige Arten: beide Richtungen)
function passtRichtung(m, antwortTyp, frageTyp) {
  const fremd = t => !!t && t.startsWith("E");
  if (m === "hoeren") return fremd(frageTyp);
  if (m === "luecke") return fremd(antwortTyp);
  if (m === "memory") return fremd(antwortTyp) || fremd(frageTyp);
  return true;
}
// Antwortarten, die nur mit einer Antwort in der Fremdsprache (E-Spalte) bzw. auf Deutsch Sinn ergeben
const NUR_FREMD = ["tippen", "akzent", "puzzle", "luecke", "artikel", "satzfinden", "satzbauen", "lueckensatz"];
const NUR_DEUTSCH = ["hoeren"];
const modusErlaubt = (antwortTyp, m) => antwortTyp.startsWith("E") ? !NUR_DEUTSCH.includes(m) : !NUR_FREMD.includes(m);
function loeseSpaltenModusAuf(basis, vok, frageTyp) {
  const r = {};
  const artikelOk = t => !!artikelInfo(vok?.[t]?.wert, vokSprache(vok));
  const kandidaten = (t, m) => {
    const moeglich = m.filter(x => (x !== "akzent" || (t.startsWith("E") && hatAkzente(vok?.[t]?.wert) && AKZENTE_FUER_LISTE(vok?._listeId))) && (x !== "artikel" || artikelOk(t)) && (!SATZ_ARTEN.includes(x) || hatSaetze(vok)));
    let kand = frageTyp ? moeglich.filter(x => passtRichtung(x, t, frageTyp)) : moeglich;
    if (!kand.length) kand = moeglich;
    if (!kand.length) kand = m.filter(x => x !== "akzent");
    return kand;
  };
  // Runden-Arten (Zuordnung, Memory): eine Ziehung je Frage – gilt dann für alle Spalten mit dieser Art
  const mitZ = Object.entries(basis || {}).find(([, m]) => Array.isArray(m) && m.some(istRunde));
  const gezogen = mitZ ? gewichtetWaehlen(kandidaten(mitZ[0], mitZ[1])) : null;
  const zuo = istRunde(gezogen) ? gezogen : null;
  Object.entries(basis || {}).forEach(([t, m]) => {
    if (!Array.isArray(m)) { r[t] = (m === "artikel" && !artikelOk(t)) || (SATZ_ARTEN.includes(m) && !hatSaetze(vok)) ? STANDARD_ANTWORT_MODUS : m; return; }
    if (zuo && m.includes(zuo)) { r[t] = zuo; return; }
    let kand = kandidaten(t, m).filter(x => !istRunde(x));
    if (!kand.length) kand = [STANDARD_ANTWORT_MODUS];
    r[t] = gewichtetWaehlen(kand);
  });
  // Absicherung (auch für Quiz aus Statistik, Multiquiz, nach dem Lernen): nie Deutsch eintippen, nie Hören bei fremder Antwort
  Object.keys(r).forEach(t => { if (!modusErlaubt(t, r[t])) r[t] = ["tippen", "puzzle", "luecke", "hoeren"].includes(r[t]) ? "mc" : STANDARD_ANTWORT_MODUS; });
  return r;
}

function antwortStatus(klasse) {
  const st = /gelernt-blitz| richtig/.test(klasse) ? "richtig" : / falsch/.test(klasse) ? "falsch" : / aufgedeckt/.test(klasse) ? "aufgedeckt" : null;
  return st ? <span className={`antwort-status ${st}`} data-antwort-status={st} aria-label={st}>{st === "richtig" ? "✓" : st === "falsch" ? "✗" : "👁"}</span> : null;
}
function sprich(text, lang) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(aeusserung(text.split('/')[0].trim(), lang));
}
// Auto-Vorlesen in der Abfrage: läuft gerade etwas (z. B. die Antwort beim Weiterblättern), wird angehängt statt abgebrochen
function sprichAuto(text, lang) {
  const s = window.speechSynthesis;
  if (!text || !s) return;
  if (!s.speaking || s.pending) s.cancel();
  s.speak(aeusserung(text.split('/')[0].trim(), lang));
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
    `- In die Wort-Spalten NUR das Wort bzw. die Phrase schreiben – keine Klammerzusätze wie „(= Punkt)“, „(bei Zahlenangaben)“ oder Übersetzungen in Klammern. Solche Hinweise, falls wichtig, in eine zusätzliche letzte Spalte „Hinweis“ schreiben`,
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
// Gesamtsicherung: alle Daten der App (Listen mit Lernstand, Einstellungen mit Farben, gespeicherte Quiz …)
const SICHERUNG_OHNE = [SK.letzteSicherung, SK.sicherungBasis, SK.sicherungSpaeter];
const SICHERUNG_TAGE = [0, 3, 7, 14, 30];   // Erinnerung: 0 = aus
const SICHERUNG_TAG_MS = 24 * 3600 * 1000;
function erstelleSicherung() {
  const daten = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("vokabel_") || SICHERUNG_OHNE.includes(k)) continue;
    try { daten[k] = JSON.parse(localStorage.getItem(k)); } catch { daten[k] = localStorage.getItem(k); }
  }
  return { vokabelAppSicherung: 1, erstellt: Date.now(), daten };
}
const istSicherung = o => !!o && typeof o === "object" && o.vokabelAppSicherung && o.daten && typeof o.daten === "object";
function listenAusSicherung(sich) {
  const idx = Array.isArray(sich.daten[SK.listenIndex]) ? sich.daten[SK.listenIndex] : [];
  const listen = Object.entries(sich.daten).filter(([k]) => k.startsWith("vokabel_liste_")).map(([, l]) => l).filter(l => l && l.name && l.vokabeln);
  const pos = l => { const i = idx.findIndex(x => x.id === l.id); return i < 0 ? Infinity : i; };
  return listen.sort((a, b) => pos(a) - pos(b));
}
// Ersetzt den ganzen Stand durch die Sicherung (danach neu laden)
function stelleSicherungWiederHer(sich) {
  const alt = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith("vokabel_") && !SICHERUNG_OHNE.includes(k)) alt.push(k); }
  alt.forEach(k => localStorage.removeItem(k));
  Object.entries(sich.daten).forEach(([k, v]) => { if (k.startsWith("vokabel_") && !SICHERUNG_OHNE.includes(k)) localStorage.setItem(k, JSON.stringify(v)); });
  localStorage.setItem(SK.letzteSicherung, JSON.stringify(sich.erstellt || Date.now()));
}
const formatTag = ts => new Date(ts).toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'});

// JSON-Backup im Text finden (auch wenn davor/danach etwas steht). null = kein JSON; wirft bei kaputtem JSON.
// Gesamtsicherung → ihre Listen, die Sicherung selbst hängt als .sicherung am Ergebnis
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
  if (istSicherung(parsed)) return Object.assign(listenAusSicherung(parsed), { sicherung: parsed });
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
// Klammerhinweise: Klammern ( ) oder [ ], die frei stehen (Leerzeichen bzw. Anfang/Ende davor und danach),
// z. B. „point (= Punkt)“ oder „Komma (bei Zahlen)“ – werden nicht vorgelesen, nicht verlangt und dezent gezeigt.
// Angehängte Klammern wie „(un)lucky“ gehören zum Wort.
const HINWEIS_RE = /(^|\s)(\([^()]*\)|\[[^\[\]]*\])(?=\s|$|[,;.!?])/g;
function ohneHinweis(t) { return (t || "").replace(HINWEIS_RE, "$1").replace(/\s{2,}/g, " ").replace(/\s+([,;.!?])/g, "$1").trim(); }
function hinweiseAus(t) { return [...(t || "").matchAll(HINWEIS_RE)].map(m => m[2].slice(1, -1).trim()).filter(Boolean); }
// Text mit dezent dargestellten Klammerhinweisen (für die Anzeige)
function mitHinweis(t) {
  const teile = []; let last = 0;
  for (const m of (t || "").matchAll(HINWEIS_RE)) {
    const start = m.index + m[1].length;
    teile.push(t.slice(last, start), <span key={start} className="klammer-hinweis">{m[2]}</span>);
    last = start + m[2].length;
  }
  if (!teile.length) return t;
  teile.push(t.slice(last));
  return teile;
}
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
    return [wert, `${base} ${suffix}`, base, ohneHinweis(wert)].map(v => v.toLowerCase().trim());
  }
  return [...new Set([wert, ohneHinweis(wert)].map(v => v.toLowerCase().trim()))];
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
const ANTWORT_MODUS_NAMEN = { karte: "Karte", mc: "MC", hoeren: "Hören", tippen: "Tastatur", puzzle: "Puzzle", luecke: "Lücken", artikel: "Artikel", satzfinden: "Satz finden", lueckensatz: "Lückensatz", satzbauen: "Satz bauen", akzent: "Akzente", zuordnung: "Zuordnung", memory: "Memory" };
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
function slotKonfigArt(eintrag) { return artVonKonfig(eintrag?.konfiguration); }
// Jede Konfiguration hat für Übersetzung, Diktat und Akzente eigene Einstellungen (konfiguration.arten);
// die oberste Ebene enthält die zuletzt gewählte Art (konfiguration.art). Alte Einträge: Art aus den Einstellungen.
const QUIZ_ARTEN = ["uebersetzung", "diktat", "akzente"];
const ART_KURZ = { uebersetzung: "Ü", diktat: "D", akzente: "A" };
const ART_FELDER = ["quizAusgewaehlt", "quizFrageTyp", "quizAntwortTypenGeordnet", "quizInfoTypenSession", "quizSpalteModus", "quizZeigeInfo",
  "quizModus", "quizReihenfolge", "quizSchlechtesteMaxScore", "quizUnbeantwortetZuerst", "quizDiktatSpalte", "quizDiktatUebersetzung"];
const artFelderAus = k => Object.fromEntries(ART_FELDER.filter(f => k?.[f] !== undefined).map(f => [f, k[f]]));
function artVonKonfig(k) {
  return k?.art || abfrageArtVon(k?.quizModus || "sequenziell", k?.quizAntwortTypenGeordnet, k?.quizSpalteModus);
}
// Standard-Einstellungen einer Art für die Spalten der gewählten Listen
function standardArtEinstellungen(art, spalten) {
  const aktiv = t => spalten ? !!spalten[t]?.aktiv : ["E1", "D1"].includes(t);
  const abfragbar = TYPEN.filter(t => !t.startsWith('i') && aktiv(t));
  const e = abfragbar.find(t => t.startsWith('E')) || abfragbar[0] || "E1";
  const d = abfragbar.find(t => t.startsWith('D')) || abfragbar.find(t => t !== e) || "";
  const basis = { quizInfoTypenSession: [], quizZeigeInfo: { i1: true, i2: true }, quizReihenfolge: STANDARD_REIHENFOLGE,
    quizSchlechtesteMaxScore: STANDARD_MAX_SCORE, quizUnbeantwortetZuerst: STANDARD_UNBEANTWORTET_ZUERST,
    quizDiktatSpalte: e, quizDiktatUebersetzung: d, quizAusgewaehlt: [e, d].filter(Boolean), quizFrageTyp: d, quizAntwortTypenGeordnet: [e] };
  if (art === "diktat") return { ...basis, quizModus: "diktat", quizSpalteModus: { [e]: "karte" } };
  return { ...basis, quizModus: "sequenziell", quizSpalteModus: { [e]: art === "akzente" ? "akzent" : "karte" } };
}
// Einstellungen passend zur Art: Akzente nur als eigene Art (kein Mischen mit Karte/Tastatur/MC)
function artBereinigt(art, k, spalten) {
  if (art === "diktat") return { ...k, quizModus: "diktat" };
  const sm = { ...(k.quizSpalteModus || {}) };
  if (art === "akzente") {
    const antw = (k.quizAntwortTypenGeordnet || []).filter(t => t.startsWith('E'));
    if (antw.length === 0) return standardArtEinstellungen("akzente", spalten);
    antw.forEach(t => { sm[t] = "akzent"; });
    return { ...k, quizModus: "sequenziell", quizAntwortTypenGeordnet: antw, quizSpalteModus: sm };
  }
  Object.keys(sm).forEach(t => {
    if (sm[t] === "akzent") sm[t] = STANDARD_ANTWORT_MODUS;
    else if (Array.isArray(sm[t]) && !sm[t].some(x => x !== "akzent")) sm[t] = STANDARD_ANTWORT_MODUS;
  });
  return { ...k, quizModus: k.quizModus === "diktat" || !k.quizModus ? "sequenziell" : k.quizModus, quizSpalteModus: sm };
}
// Statistik-Gruppen in Anzeige-Reihenfolge mit Farbe (Kreis, Gruppen-Balken)
const GRUPPE_BALKEN = [["gelernt", "var(--gelernt)"], ["arbeit", "var(--arbeit)"], ["nie", "var(--nie)"], ["negativ", "var(--negativ)"]];
// Fortschrittsbalken im Statistik-Kopf: eigene Rollen, unabhängig vom Kreisdiagramm
const FORTSCHRITT_BALKEN = [["gelernt", "var(--fortschritt-gelernt)"], ["arbeit", "var(--fortschritt-arbeit)"], ["nie", "var(--fortschritt-nie)"], ["negativ", "var(--fortschritt-negativ)"]];
// Session-Standard: in Paketen abfragen
const STANDARD_SESSION_MODUS = "pakete";
// Standard-Reihenfolge: schlechteste zuerst, nur Score ≤ 3, unbeantwortete zuerst
const STANDARD_REIHENFOLGE = "schlechteste";
const STANDARD_MAX_SCORE = "3";
const STANDARD_UNBEANTWORTET_ZUERST = { zufall: true, schlechteste: true, listennr: true };
// „Alle“: ein Paket mit allen Vokabeln der Session (Fortschritt, Fortsetzen und Auswertung bleiben) – Standard
const PAKET_ALLE = 10000;
const STANDARD_PAKET_GROESSE = PAKET_ALLE;
// Abfrage-Ziel-Standard: jede Vokabel wird wiederholt, bis sie 1× richtig war
const STANDARD_ABFRAGE_ZIEL = "wiederholung";
const AKZENT_HINWEIS = "Richtig – achte auf die Akzente.";

// Schwierigkeitsgrad: welche Regel in "Einfach" bzw. "Schwer" gilt (in den Einstellungen per Haken änderbar)
const STUFEN_REGELN = [
  { key: "akzenteTolerant", label: "Fehlende Akzente beim Tippen gelten als richtig", sub: "z. B. ete statt été", einfach: true, schwer: false },
  { key: "aufdeckenAbzug", label: "„Lösung anzeigen“ zieht 1 Punkt ab", sub: "sonst ohne Score-Einfluss", einfach: true, schwer: true },
  { key: "falschAbzug", label: "Nicht gewusst zieht 1 Punkt ab", sub: "sonst bleibt der Score gleich – die Vokabel wird trotzdem wiederholt", einfach: false, schwer: true },
  { key: "akzentOhneMischen", label: "Akzent-Modus: auch Wörter ohne Akzent abfragen", sub: "dann muss man erkennen, dass nichts zu ändern ist", einfach: false, schwer: false },
  { key: "akzentHervorheben", label: "Akzent-Modus: Buchstaben mit Akzent hervorheben", sub: "zeigt, wo ein Akzent hingehört; Tippen auf andere Buchstaben zählt dann nicht als Fehler", einfach: true, schwer: true },
  { key: "akzentZaehler", label: "Akzent-Modus: anzeigen, wie viele Akzente noch fehlen", sub: "z. B. „Akzente 2 / 3“", einfach: true, schwer: true },
  { key: "akzentAutoUebernahme", label: "Akzent-Modus: alle Akzente richtig → automatisch übernehmen", sub: "sonst muss man „Prüfen“ antippen", einfach: true, schwer: true },
  { key: "zuordnungAbzug", label: "Zuordnung: Fehlgriff zieht 1 Punkt ab", sub: "bewertet wird die Vokabel der zuerst angetippten Karte", einfach: false, schwer: true },
  { key: "zuordnungAmEnde", label: "Zuordnung: erst am Ende prüfen", sub: "Gruppen werden farbig markiert und mit „Prüfen“ ausgewertet; sonst wird jede Karte sofort geprüft", einfach: false, schwer: true },
];
// Akzent-Modus mit Wörtern ohne Akzent: höchstens so viele (Faktor × Wörter mit Akzent) – je Stufe; "alle" = unbegrenzt
const AKZENT_OHNE_ANTEILE = [[0.25, "¼×"], [0.5, "½×"], [1, "1×"], [2, "2×"], ["alle", "∞"]];
function akzentOhneAnteil(einst) {
  const stufe = einst?.modus === "einfach" ? "einfach" : "schwer";
  const w = einst?.stufen?.[stufe]?.akzentOhneAnteil ?? 1;
  return w === "alle" ? null : w;
}
// Regeln der aktuell gewählten Stufe (gespeicherte Haken, sonst Standard)
// Zuordnung je Stufe: Vokabeln je Runde, Zeitmodus (aus | runde | vokabel), Sekunden je Vokabel
const ZUORDNUNG_ZEITEN = [["aus", "aus"], ["an", "an"]];
const ZUORDNUNG_SEKUNDEN = [3, 5, 8, 10, 15];
// Gruppenfarben ohne Rot/Grün (die stehen für falsch/richtig)
const ZUORDNUNG_FARBEN = ["#4363d8", "#f58231", "#911eb4", "#16a5c4", "#f032e6", "#9a6324", "#000075", "#808000", "#e377c2", "#469990", "#b8860b", "#7f7f7f"];
const ZUORDNUNG_ZEITFAKTOR = { 2: 1, 3: 1.6, 4: 2 };
function zuordnungEinst(einst) {
  const stufe = einst?.modus === "einfach" ? "einfach" : "schwer";
  const st = einst?.stufen?.[stufe] || {};
  const zeit = st.zuordnungZeit ?? (stufe === "einfach" ? "aus" : "an");
  return { paare: st.zuordnungPaare ?? (stufe === "einfach" ? 5 : 7), zeit: zeit === "aus" ? "aus" : "an", sek: st.zuordnungSek ?? 8 };
}
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
// Mini-Kreis im Raster: Lernfortschritt einer Abfrageart (Ü/D/A); aus = keine passenden Vokabeln
// groesse: Pixel; aufGruen: Farben für die grüne Kopfzeile
function MiniKreis({ pct, buchstabe, aktiv, aus, groesse = 24, aufGruen = false }) {
  const r = 9, u = 2 * Math.PI * r;
  const f = aufGruen
    ? { fill: aktiv ? "var(--karte)" : "transparent", grund: "rgba(255,255,255,0.3)", ring: aktiv ? "var(--haupt-hell)" : "var(--haupt-zart)", text: aktiv ? "var(--haupt)" : "var(--auf-haupt)" }
    : { fill: aktiv ? "var(--haupt)" : "var(--karte)", grund: "var(--rahmen)", ring: aktiv ? "var(--haupt-zart)" : "var(--haupt-hell)", text: aktiv ? "var(--auf-haupt)" : "var(--haupt)" };
  // 100 % gelernt: Kreis komplett grün gefüllt (gewählte Art zusätzlich mit äußerem Ring)
  if (!aus && pct >= 99.999) return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" style={{display:"block"}}>
      <circle cx="12" cy="12" r="10.5" fill={fv("var(--haupt-hell)")} stroke={fv(aktiv ? (aufGruen ? "var(--auf-haupt)" : "var(--haupt)") : "var(--haupt-hell)")} strokeWidth={aktiv ? 2.5 : 0}/>
      <text x="12" y="12.5" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill={fv("var(--karte)")}>{buchstabe}</text>
    </svg>
  );
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" style={{display:"block", opacity: aus ? 0.35 : 1}}>
      <circle cx="12" cy="12" r={r} fill={fv(f.fill)} stroke={fv(f.grund)} strokeWidth="3"/>
      {!aus && pct > 0 && <circle cx="12" cy="12" r={r} fill="none" stroke={fv(f.ring)} strokeWidth="3"
        strokeDasharray={`${u * Math.min(100, pct) / 100} ${u}`} transform="rotate(-90 12 12)" strokeLinecap={pct >= 100 ? "butt" : "round"}/>}
      <text x="12" y="12.5" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill={fv(f.text)}>{buchstabe}</text>
    </svg>
  );
}
// Score für den Gelernt-Status: Diktat hat einen eigenen Fortschritt
function gelerntScore(v, diktat) { return (diktat ? v.diktatFortschritt?.score : v.fortschritt?.score) ?? -Infinity; }

// ── Scoring ────────────────────────────────────────────────────────────────
// falschAbzug (Regel je Stufe): falsche Antwort −1, sonst bleibt der Score gleich
function berechneNeuenScore(fortschritt, ereignis, modus, falschAbzug = true) {
  const f = fortschritt || { score:0, streak:0, aufgedecktStreak:0, letzteAbfrage:null };
  const neu = { ...f, letzteAbfrage: new Date().toISOString() };
  if (ereignis === "richtig") {
    neu.score += 1; neu.streak += 1; neu.aufgedecktStreak = 0;
    if (neu.streak >= 3) neu.score = Math.max(neu.score, 2);
  } else if (ereignis === "falsch") {
    neu.streak = 0; neu.aufgedecktStreak = 0;
    if (falschAbzug) neu.score -= 1;
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
function berechneDiktatScore(fortschritt, ereignis, falschAbzug = true) {
  const f = fortschritt || { score:0, letzteAbfrage:null };
  const neu = { ...f, letzteAbfrage: new Date().toISOString() };
  if (ereignis === "richtig") neu.score += 1;
  else if (ereignis === "aufgedeckt" && falschAbzug) neu.score -= 1;
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
// Akzente: es zählen nur Wörter mit Akzent (100 % = alle Wörter mit Akzent); dazugenommene Wörter
// ohne Akzent sind reine Übung und fließen nicht in Statistik, Lernfortschritt und Auswertung ein
// Akzente je Sprache (Einstellungen): beim Rendern gesetzt; Vokabel ohne Listen-Bezug → an
let AKZENTE_FUER_LISTE = () => true;
const hatAkzentWort = (v, listeId = null) => AKZENTE_FUER_LISTE(v?._listeId ?? listeId) && TYPEN.some(t => t.startsWith('E') && hatAkzente(v?.[t]?.wert));
function statistikSicht(voks, art, listeId = null) {
  if (art === "diktat") return voks.map(v => ({ ...v, fortschritt: v.diktatFortschritt }));
  if (art === "akzente") return voks.filter(v => hatAkzentWort(v, listeId)).map(v => ({ ...v, fortschritt: v.akzentFortschritt }));
  return voks;
}

// ── Styling ────────────────────────────────────────────────────────────────
const C = {
  bg:"var(--hintergrund)", surface:"var(--karte)", border:"var(--rahmen)",
  accent:"var(--haupt)", accentHi:"var(--haupt)", danger:"var(--falsch)",
  text:"var(--text-stark)", muted:"var(--text2)", tag:"var(--haupt-flaeche)", tagText:"var(--haupt)",
};

/* FARBSCHEMATA-START */
// ── Farbschemata: Grundfarben je Rolle; Abstufungen (zart, Fläche, dunkel) werden daraus gemischt ──
const FARB_ROLLEN = [
  ["leiste", "App-Leiste (System)", "Leiste ganz oben (Uhrzeit, Akku) und unten"],
  ["haupt", "Hauptfarbe", "Knöpfe, Kopfzeilen, aktive Auswahl"], ["haupt-hell", "Hauptfarbe hell", "Fortschrittsringe, Balken"],
  ["auf-haupt", "Schrift auf Hauptfarbe", "Text auf Knöpfen"],
  ["hintergrund", "Hintergrund", "nur die Seite selbst"],
  ["app-kopf", "App-Kopf", "Titelleiste und Tab-Leiste"],
  ["kopfzeile", "Bereichs-Kopfzeilen", "Kopf der Listenauswahl, Statistik, Konfiguration, Info, Einstellungs-Bereiche"],
  ["karte", "Karten", "Listen-Kacheln, Quiz-Bereiche, Einstellungs-Karten"],
  ["abfrage-karte", "Abfrage-Karten", "Frage-, Antwort- und Lernkarte"],
  ["dialog", "Dialoge", "Fenster zum Bearbeiten, Exportieren, Rückfragen"],
  ["knopf", "Knöpfe & Felder", "Eingabefelder, Umschalt-Knöpfe, Chips, Häkchen"],
  ["info-kasten", "Info-Kästen", "Info-Übersicht, Anleitung, Hinweise, Rückmeldung nach der Runde"],
  ["haupt-flaeche", "Ausgewählt / hervorgehoben", "aktive Kacheln und Kopfzeilen, richtige Antwort"],
  ["start", "Liste & Start", "aktuelle Liste oben im Quiz-Tab und Start-Knopf"],
  ["auf-start", "Schrift auf Liste & Start", "Text auf dem Start-Knopf und der aktuellen Liste"],
  ["auf-falsch", "Schrift auf Falsch", "Text auf roten Knöpfen und Markierungen (Nicht gewusst, geänderte Session)"],
  ["auf-gelb", "Schrift auf Hervorhebung", "Text auf gelben Markierungen (Auswahl-Nummern, Info-Spalte)"],
  ["auf-haupt-hell", "Schrift auf Hauptfarbe hell", "Text auf hellen Haupt-Knöpfen (Antwortart der Spalte)"],
  ["auf-gelernt", "Schrift auf Statistik: Gelernt", "Häkchen auf 100 %-Kacheln"],
  ["bestaetigen", "Bestätigen", "Knopf „✓ Bestätigen“ in aufgeklappten Zeilen und Auswahlen"], ["auf-bestaetigen", "Schrift auf Bestätigen", "Text auf dem Bestätigen-Knopf"],
  ["tab-aktiv", "Aktiver Tab", "Schrift und Unterstrich des gewählten Tabs"], ["app-kopf-schrift", "Schrift im App-Kopf", "Titel „Vokabel-Trainer“"], ["app-kopf-schrift-leise", "Schrift im App-Kopf leise", "nicht gewählte Tabs"],
  ["kopf-schrift", "Schrift auf Kopfzeilen", "Überschriften der Einstellungs-Köpfe, Session-, Listen- und Statistik-Kopf"],
  ["kopf-schrift-leise", "Schrift auf Kopfzeilen leise", "Unterzeilen und Pfeile der Kopfzeilen, Info-Zeile im Session-Kopf"],
  ["kopf-offen", "Geöffneter Kopf", "Hintergrund eines aufgeklappten Einstellungs-Kopfs"], ["kopf-offen-schrift", "Schrift auf geöffnetem Kopf", "Überschrift und Pfeil eines aufgeklappten Einstellungs-Kopfs"],
  ["dialog-schrift", "Schrift in Dialogen", "Titel und Text der Fenster"],
  ["abfrage-schrift", "Schrift auf Abfrage-Karten", "Frage und Antwort"], ["abfrage-schrift-leise", "Schrift auf Abfrage-Karten leise", "Spaltenname über Frage und Antwort"],
  ["flaeche", "Fläche grau", "leichte Hinterlegungen"],
  ["text-stark", "Text kräftig", "Überschriften, Eingaben"], ["text", "Text", "normaler Text"], ["text2", "Text leise", "Untertitel, Hinweise"], ["text3", "Text sehr leise", "Zahlen in Klammern"],
  ["rahmen", "Rahmen", "Linien und Ränder"],
  ["richtig", "Richtig", "gewusst / richtig beantwortet"], ["falsch", "Falsch", "nicht gewusst, Löschen"],
  ["gelb", "Hervorhebung", "Markierung, Sterne"], ["gelernt-effekt", "Gelernt-Effekt", "Aufleuchten, wenn eine Vokabel gelernt ist"],
  ["orange", "Warnung", "Hinweise"], ["info", "Info", "weitere Antwort, Info-Spalten"],
  ["fortschritt-balken", "Fortschrittsbalken: Hintergrund", "leerer Teil des Balkens im Statistik-Kopf"],
  ["fortschritt-gelernt", "Fortschrittsbalken: Gelernt", "Balken im Statistik-Kopf"], ["fortschritt-arbeit", "Fortschrittsbalken: In Arbeit", "Balken im Statistik-Kopf"],
  ["fortschritt-nie", "Fortschrittsbalken: Nie abgefragt", "Balken im Statistik-Kopf"], ["fortschritt-negativ", "Fortschrittsbalken: Negativ", "Balken im Statistik-Kopf"],
  ["gelernt", "Statistik: Gelernt", ""], ["arbeit", "Statistik: In Arbeit", ""], ["nie", "Statistik: Nie abgefragt", ""], ["negativ", "Statistik: Negativ", ""],
];
const FARB_VORLAGEN = [
  { id: "natur", name: "Natur", farben: { "haupt": "#2d6a4f", "haupt-hell": "#52b788", "auf-haupt": "#fff", "hintergrund": "#f7f5f0", "karte": "#fff", "flaeche": "#f0ede8",
    "text-stark": "#1a1a1a", "text": "#3b3832", "text2": "#6b6560", "text3": "#9b9590", "rahmen": "#e0dbd2", "richtig": "#2d6a4f", "falsch": "#c0392b",
    "gelb": "#f9a825", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a1b9a", "gelernt": "#2d6a4f", "arbeit": "#e9c46a", "nie": "#d6d2cb", "negativ": "#e57373" } },
  { id: "freudig", name: "Freudig", farben: { "haupt": "#e8590c", "haupt-hell": "#ff922b", "auf-haupt": "#fff", "hintergrund": "#fff8f0", "karte": "#fff", "flaeche": "#fff0e0",
    "text-stark": "#2a1a10", "text": "#3d2c22", "text2": "#7a6152", "text3": "#a8917f", "rahmen": "#f3dcc8", "richtig": "#2b9348", "falsch": "#d62828",
    "gelb": "#fcbf49", "gelernt-effekt": "#fff176", "orange": "#f77f00", "info": "#7b2cbf", "gelernt": "#2b9348", "arbeit": "#fcbf49", "nie": "#e9dccf", "negativ": "#ef476f" } },
  { id: "pastelle", name: "Pastelle", farben: { "haupt": "#7d9d8c", "haupt-hell": "#a8c5b5", "auf-haupt": "#fff", "auf-start": "#24382d", "hintergrund": "#faf7fb", "karte": "#fff", "flaeche": "#f2eef6",
    "text-stark": "#2f2a3a", "text": "#4a4458", "text2": "#7d768a", "text3": "#a8a2b3", "rahmen": "#e6e0ec", "richtig": "#6fae8e", "falsch": "#d97a7a",
    "gelb": "#f4c97a", "gelernt-effekt": "#fff176", "orange": "#f2a679", "info": "#a48cc8", "gelernt": "#8fc1a5", "arbeit": "#f6d79a", "nie": "#e3dde8", "negativ": "#eea2a2" } },
  { id: "maedchen", name: "Mädchen", farben: { "haupt": "#c2185b", "haupt-hell": "#f06292", "auf-haupt": "#fff", "hintergrund": "#fff5f9", "karte": "#fff", "flaeche": "#fce4ec",
    "text-stark": "#2e1422", "text": "#4a2639", "text2": "#8a5a72", "text3": "#b48ea0", "rahmen": "#f6d3e1", "richtig": "#2e9e6b", "falsch": "#d32f2f",
    "gelb": "#ffb300", "gelernt-effekt": "#fff176", "orange": "#ff7043", "info": "#8e24aa", "gelernt": "#ab47bc", "arbeit": "#ffca6b", "nie": "#ead7e0", "negativ": "#ef5350" } },
  { id: "jungs", name: "Jungs", farben: { "haupt": "#1d5f8a", "haupt-hell": "#3a9bd5", "auf-haupt": "#fff", "hintergrund": "#f3f7fa", "karte": "#fff", "flaeche": "#e6eef4",
    "text-stark": "#111c26", "text": "#22313f", "text2": "#566778", "text3": "#8a9aa8", "rahmen": "#d5e0e9", "richtig": "#2e8b57", "falsch": "#c62828",
    "gelb": "#ff9f1c", "gelernt-effekt": "#fff176", "orange": "#f3722c", "info": "#5e35b1", "gelernt": "#2e8b57", "arbeit": "#ffbf47", "nie": "#d5dee6", "negativ": "#e5604d" } },
  { id: "dunkel", name: "Dunkel", farben: { "leiste": "#161816", "haupt": "#52b788", "haupt-hell": "#74c69d", "auf-haupt": "#10241a", "hintergrund": "#161816", "karte": "#222522", "flaeche": "#2c302c",
    "text-stark": "#f2f0eb", "text": "#e3e0da", "text2": "#b4b0a8", "text3": "#8a867f", "rahmen": "#3a3e3a", "richtig": "#52b788", "falsch": "#ef6f61",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#52b788", "arbeit": "#d9b44a", "nie": "#4a4f4a", "negativ": "#e06c6c" }, dunkel: true },
  { id: "ozean", name: "Ozean", farben: { "haupt": "#0f6e7a", "haupt-hell": "#2bb3c0", "auf-haupt": "#fff", "hintergrund": "#f2f8f9", "karte": "#fff", "flaeche": "#e3eff1", "text-stark": "#0e1e22",
    "text": "#23363b", "text2": "#5a7076", "text3": "#8ea2a7", "rahmen": "#d3e3e6", "richtig": "#2a9d6f", "falsch": "#d1495b", "gelb": "#f4b942",
    "gelernt-effekt": "#fff176", "orange": "#f08a4b", "info": "#6c4ab6", "gelernt": "#2a9d8f", "arbeit": "#f2cc6b", "nie": "#d6e2e4", "negativ": "#e76f7a" } },
  { id: "lavendel", name: "Lavendel", farben: { "haupt": "#6a4c93", "haupt-hell": "#a68bd1", "auf-haupt": "#fff", "hintergrund": "#f8f6fc", "karte": "#fff", "flaeche": "#efeaf7", "text-stark": "#221a30",
    "text": "#3a3048", "text2": "#706582", "text3": "#a198b0", "rahmen": "#e2dbee", "richtig": "#3e9b74", "falsch": "#c94f6d", "gelb": "#f2b84b",
    "gelernt-effekt": "#fff176", "orange": "#ec8a5a", "info": "#3f6fb5", "gelernt": "#8b6cc4", "arbeit": "#f3d08a", "nie": "#e2dde9", "negativ": "#e88a9e" } },
  { id: "minze", name: "Minze", farben: { "haupt": "#1a7a63", "haupt-hell": "#5fd3b0", "auf-haupt": "#fff", "hintergrund": "#f3fbf8", "karte": "#fff", "flaeche": "#e2f4ee", "text-stark": "#102620",
    "text": "#22403a", "text2": "#5a7a72", "text3": "#8fada5", "rahmen": "#cfe9e0", "richtig": "#1f8a70", "falsch": "#e05263", "gelb": "#f7c548",
    "gelernt-effekt": "#fff176", "orange": "#f39a5b", "info": "#6b5bd2", "gelernt": "#2fb38a", "arbeit": "#f7d774", "nie": "#d5e7e1", "negativ": "#ef8a96" } },
  { id: "sand", name: "Sand", farben: { "haupt": "#a0522d", "haupt-hell": "#d4935f", "auf-haupt": "#fff", "hintergrund": "#fbf6ee", "karte": "#fffdf9", "flaeche": "#f2e9da", "text-stark": "#2b1d12",
    "text": "#45352a", "text2": "#7d6a5a", "text3": "#ab9a8a", "rahmen": "#e8dcc8", "richtig": "#5a8f3c", "falsch": "#b83a3a", "gelb": "#e0a526",
    "gelernt-effekt": "#fff176", "orange": "#d9772b", "info": "#7a4f9a", "gelernt": "#6b9a45", "arbeit": "#e8c071", "nie": "#e3d8c6", "negativ": "#d77a6a" } },
  { id: "beere", name: "Beere", farben: { "haupt": "#8e2c5a", "haupt-hell": "#d0679a", "auf-haupt": "#fff", "hintergrund": "#fcf5f8", "karte": "#fff", "flaeche": "#f6e6ee", "text-stark": "#2a1220",
    "text": "#452636", "text2": "#80596c", "text3": "#b08ea0", "rahmen": "#efd6e2", "richtig": "#2f9a6a", "falsch": "#d33f3f", "gelb": "#f5b031",
    "gelernt-effekt": "#fff176", "orange": "#f07b3f", "info": "#5a4fcf", "gelernt": "#b04d84", "arbeit": "#f5c86e", "nie": "#ebdce3", "negativ": "#e86a6a" } },
  { id: "olive", name: "Olive", farben: { "haupt": "#5f6f1f", "haupt-hell": "#9fb34a", "auf-haupt": "#fff", "hintergrund": "#f8f8f0", "karte": "#fff", "flaeche": "#eeefe0", "text-stark": "#1d200f",
    "text": "#33371f", "text2": "#6a6e54", "text3": "#9a9d85", "rahmen": "#e0e2cc", "richtig": "#3d8b3d", "falsch": "#c0392b", "gelb": "#e8b923",
    "gelernt-effekt": "#fff176", "orange": "#e07a2e", "info": "#7a4a9a", "gelernt": "#7f9a2e", "arbeit": "#e8cf6a", "nie": "#dfe0d0", "negativ": "#e07a6a" } },
  { id: "graphit", name: "Graphit", farben: { "haupt": "#3d4451", "haupt-hell": "#7a8494", "auf-haupt": "#fff", "hintergrund": "#f6f7f8", "karte": "#fff", "flaeche": "#eceef1", "text-stark": "#15181c",
    "text": "#2b3038", "text2": "#636a75", "text3": "#969ca6", "rahmen": "#dde0e5", "richtig": "#2e8b57", "falsch": "#c62828", "gelb": "#f2a900",
    "gelernt-effekt": "#fff176", "orange": "#ef6c00", "info": "#5c6bc0", "gelernt": "#3f8f63", "arbeit": "#e5c15a", "nie": "#dcdfe3", "negativ": "#e06060" } },
  { id: "kontrast", name: "Kontrast", farben: { "haupt": "#0033a0", "haupt-hell": "#1f5fe0", "auf-haupt": "#fff", "hintergrund": "#fff", "karte": "#fff", "flaeche": "#f0f0f0", "text-stark": "#000",
    "text": "#000", "text2": "#333", "text3": "#555", "rahmen": "#8a8a8a", "richtig": "#006b2d", "falsch": "#b00000", "gelb": "#ffc400",
    "gelernt-effekt": "#fff176", "orange": "#c55a00", "info": "#5b00b5", "gelernt": "#006b2d", "arbeit": "#e0a800", "nie": "#c8c8c8", "negativ": "#d00000" } },
  { id: "mitternacht", name: "Mitternacht", farben: { "leiste": "#0f1624", "haupt": "#5b8def", "haupt-hell": "#82a8f5", "auf-haupt": "#0b1220", "hintergrund": "#0f1624", "karte": "#182133", "flaeche": "#212c42",
    "text-stark": "#eef2fa", "text": "#dbe2ee", "text2": "#a8b3c7", "text3": "#7c889e", "rahmen": "#2c3850", "richtig": "#4cc38a", "falsch": "#ef6f6f",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b48ef0", "gelernt": "#4cc38a", "arbeit": "#d9b44a", "nie": "#3a4560", "negativ": "#e06c6c" }, dunkel: true },
  { id: "espresso", name: "Espresso", farben: { "leiste": "#1a1411", "haupt": "#d19a66", "haupt-hell": "#e3b98a", "auf-haupt": "#2a1a0e", "hintergrund": "#1a1411", "karte": "#251d18", "flaeche": "#30261f",
    "text-stark": "#f5ede4", "text": "#e6dccf", "text2": "#bba995", "text3": "#8f7e6c", "rahmen": "#3d3128", "richtig": "#7fbf6a", "falsch": "#e57060",
    "gelb": "#f0c050", "gelernt-effekt": "#fff176", "orange": "#e8924a", "info": "#c09ae0", "gelernt": "#7fbf6a", "arbeit": "#d9b44a", "nie": "#4a3d33", "negativ": "#d9675a" }, dunkel: true },
  // bunte Pastell-Vorlagen: Kopf, Kopfzeilen, Abfrage-Karten, Dialoge, Knöpfe, Info-Kästen und Start je eigener Ton
  { id: "sorbet", name: "Sorbet", farben: { "haupt": "#d9756c", "haupt-hell": "#f6c1b8", "auf-haupt": "#3a1f1c", "hintergrund": "#fff6f0", "karte": "#ffffff", "flaeche": "#fdeee6", "rahmen": "#f0d9cf", "app-kopf": "#cdeee2",
    "kopfzeile": "#e6dcf7", "abfrage-karte": "#fffbe8", "dialog": "#fdf4ff", "knopf": "#fff0e8", "info-kasten": "#e3f4ee", "haupt-flaeche": "#fbe1dc", "start": "#9fd8c4", "auf-start": "#1d3a31",
    "kopf-offen": "#d5c6f2", "kopf-offen-schrift": "#3d2a63", "text-stark": "#2e2420", "text": "#4a3c36", "text2": "#85736b", "text3": "#b3a39b", "richtig": "#5fae8c", "falsch": "#e0707a",
    "gelb": "#f7cf6b", "gelernt-effekt": "#fff176", "orange": "#f2a46b", "info": "#9b84d6", "gelernt": "#7cc4a4", "arbeit": "#f7d98c", "nie": "#ebe0da", "negativ": "#f09aa0" } },
  { id: "lagune", name: "Lagune", farben: { "haupt": "#3fa3a9", "haupt-hell": "#a6dfe2", "auf-haupt": "#0d2e31", "hintergrund": "#f1fafb", "karte": "#ffffff", "flaeche": "#e2f2f4", "rahmen": "#cfe6ea", "app-kopf": "#bfe6f5",
    "kopfzeile": "#ffe0d6", "abfrage-karte": "#ffffff", "dialog": "#f4fbff", "knopf": "#eef8fa", "info-kasten": "#fff1e8", "haupt-flaeche": "#d8f0f2", "start": "#f4a48e", "auf-start": "#4a1d12",
    "kopf-offen": "#ffcdbd", "kopf-offen-schrift": "#6a2a18", "text-stark": "#12272b", "text": "#2b4146", "text2": "#5f7a80", "text3": "#93aab0", "richtig": "#4bb08a", "falsch": "#e66b6b",
    "gelb": "#f6c85f", "gelernt-effekt": "#fff176", "orange": "#f39a6b", "info": "#7a8be0", "gelernt": "#4fb3a2", "arbeit": "#f6d27f", "nie": "#d9e7ea", "negativ": "#ef8f8f" } },
  { id: "blumenwiese", name: "Blumenwiese", farben: { "haupt": "#de7aa2", "haupt-hell": "#f8cadb", "auf-haupt": "#4a1830", "hintergrund": "#fbfdf2", "karte": "#ffffff", "flaeche": "#f2f6e4", "rahmen": "#e3e8cf", "app-kopf": "#fff2b8",
    "kopfzeile": "#d9f0c9", "abfrage-karte": "#fffdf6", "dialog": "#fff7fb", "knopf": "#f8fbec", "info-kasten": "#fff6d6", "haupt-flaeche": "#fde3ec", "start": "#b8e09a", "auf-start": "#213a12",
    "kopf-offen": "#f8cadb", "kopf-offen-schrift": "#5a1d3a", "text-stark": "#2a2a1c", "text": "#3f3f2c", "text2": "#75765c", "text3": "#a5a68c", "richtig": "#6cb36a", "falsch": "#e46f86",
    "gelb": "#f5c842", "gelernt-effekt": "#fff176", "orange": "#f4a259", "info": "#a17ad6", "gelernt": "#8acb6e", "arbeit": "#f6d56a", "nie": "#e8ead9", "negativ": "#ef8fa4" } },
  { id: "nordlicht", name: "Nordlicht", farben: { "haupt": "#8a78d6", "haupt-hell": "#cbc2f2", "auf-haupt": "#1b1440", "hintergrund": "#f6f5fd", "karte": "#ffffff", "flaeche": "#ecebf8", "rahmen": "#dddbf0", "app-kopf": "#c8ecdf",
    "kopfzeile": "#d6e6fb", "abfrage-karte": "#ffffff", "dialog": "#f9f8ff", "knopf": "#f2f1fb", "info-kasten": "#e5f5ef", "haupt-flaeche": "#e6e1fa", "start": "#8fd3b9", "auf-start": "#133a2c",
    "kopf-offen": "#c4d9f7", "kopf-offen-schrift": "#1f3c66", "text-stark": "#1f1d33", "text": "#36344d", "text2": "#6c6a86", "text3": "#9e9cb6", "richtig": "#4fae8a", "falsch": "#e07085",
    "gelb": "#f3c75d", "gelernt-effekt": "#fff176", "orange": "#f0a070", "info": "#6f8de0", "gelernt": "#7fc8ac", "arbeit": "#f1d488", "nie": "#e2e1ef", "negativ": "#ee8fa0" } },
  { id: "sommerfest", name: "Sommerfest", farben: { "haupt": "#d98330", "haupt-hell": "#fad3a6", "auf-haupt": "#3a2005", "hintergrund": "#fffaf2", "karte": "#ffffff", "flaeche": "#fdf0dd", "rahmen": "#f2dfc2", "app-kopf": "#ffd0dc",
    "kopfzeile": "#c9eef0", "abfrage-karte": "#fffdf8", "dialog": "#fff8fa", "knopf": "#fff4e6", "info-kasten": "#e6f6f7", "haupt-flaeche": "#fde6c9", "start": "#f28fab", "auf-start": "#4d1225",
    "kopf-offen": "#a9e2e6", "kopf-offen-schrift": "#134447", "text-stark": "#2d2116", "text": "#47372a", "text2": "#85705c", "text3": "#b5a28f", "richtig": "#56b07e", "falsch": "#e2606f",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#ee8a4b", "info": "#8f79d4", "gelernt": "#6cc196", "arbeit": "#f6cf72", "nie": "#efe4d6", "negativ": "#ec8a95" } },
  // ── zehn weitere Vorlagen ──
  { id: "kirschbluete", name: "Kirschblüte", farben: { "haupt": "#c45b7c", "haupt-hell": "#f2b5c8", "auf-haupt": "#fff", "hintergrund": "#fdf8f9", "karte": "#ffffff", "flaeche": "#f8ecf0", "rahmen": "#eedbe2",
    "app-kopf": "#fbe4ec", "kopfzeile": "#f6e9ee", "haupt-flaeche": "#fbe1ea", "start": "#c45b7c", "auf-start": "#fff", "kopf-offen": "#f2b5c8", "kopf-offen-schrift": "#5a1c30",
    "text-stark": "#2b1d22", "text": "#46333a", "text2": "#7f6870", "text3": "#ad9aa1", "richtig": "#5a9e7a", "falsch": "#d0465f",
    "gelb": "#e9b949", "gelernt-effekt": "#ffe3ee", "orange": "#e8875c", "info": "#8c6bc2", "gelernt": "#7cb69a", "arbeit": "#f1cf7f", "nie": "#ece3e6", "negativ": "#e98a9d" } },
  { id: "tiefsee", name: "Tiefsee", farben: { "leiste": "#06141c", "haupt": "#22c1c3", "haupt-hell": "#6fe0e1", "auf-haupt": "#04232a", "hintergrund": "#06141c", "karte": "#0d2330", "flaeche": "#123040",
    "app-kopf": "#081c27", "kopfzeile": "#0f2a38", "abfrage-karte": "#0f2b3a", "dialog": "#0d2330", "knopf": "#123040", "info-kasten": "#103446", "haupt-flaeche": "#0f3b45",
    "start": "#22c1c3", "auf-start": "#04232a", "text-stark": "#e8f8fb", "text": "#cfe9ef", "text2": "#93b9c3", "text3": "#6a909a", "rahmen": "#1d4152",
    "richtig": "#3fd19a", "falsch": "#ff6b81", "gelb": "#ffd166", "gelernt-effekt": "#9ff3ff", "orange": "#ff9f5a", "info": "#a99bff",
    "gelernt": "#3fd19a", "arbeit": "#e6c15a", "nie": "#25495a", "negativ": "#ff7a8c" }, dunkel: true },
  { id: "herbstlaub", name: "Herbstlaub", farben: { "haupt": "#a8431f", "haupt-hell": "#e08a4f", "auf-haupt": "#fff", "hintergrund": "#fbf6ef", "karte": "#ffffff", "flaeche": "#f4eadc", "rahmen": "#e7d6c0",
    "app-kopf": "#f3dcc0", "kopfzeile": "#f1e2cc", "haupt-flaeche": "#f8dfcc", "start": "#7b5b2a", "auf-start": "#fff6e8", "kopf-offen": "#e9c18f", "kopf-offen-schrift": "#4a2a0c",
    "text-stark": "#2b1d12", "text": "#47331f", "text2": "#806a52", "text3": "#ae9b85", "richtig": "#6b8f3a", "falsch": "#b83a2b",
    "gelb": "#e0a526", "gelernt-effekt": "#ffe08a", "orange": "#d9772b", "info": "#7d5aa8", "gelernt": "#8aa84a", "arbeit": "#e7b75a", "nie": "#e6dccd", "negativ": "#d4735f" } },
  { id: "gletscher", name: "Gletscher", farben: { "haupt": "#3c6e91", "haupt-hell": "#9cc7e4", "auf-haupt": "#fff", "hintergrund": "#f5f9fc", "karte": "#ffffff", "flaeche": "#e8f1f7", "rahmen": "#d4e3ee",
    "app-kopf": "#e2eff8", "kopfzeile": "#e9f3fa", "abfrage-karte": "#fbfdff", "haupt-flaeche": "#dcecf7", "start": "#3c6e91", "auf-start": "#fff", "kopf-offen": "#bcd9ee", "kopf-offen-schrift": "#14334a",
    "text-stark": "#12202b", "text": "#26394a", "text2": "#5d7386", "text3": "#93a6b5", "richtig": "#2f9c8f", "falsch": "#cc4b5c",
    "gelb": "#f0b93a", "gelernt-effekt": "#d8f3ff", "orange": "#e88a4a", "info": "#6a6fd0", "gelernt": "#5fb3a8", "arbeit": "#f1cd73", "nie": "#dde7ef", "negativ": "#e48795" } },
  { id: "terrakotta", name: "Terrakotta", farben: { "haupt": "#b5563a", "haupt-hell": "#e6a080", "auf-haupt": "#fff", "hintergrund": "#fbf4ee", "karte": "#fffaf6", "flaeche": "#f3e4d8", "rahmen": "#e8d2c2",
    "app-kopf": "#e9c9b3", "kopfzeile": "#efdccd", "haupt-flaeche": "#f5d8c9", "start": "#5f7d5a", "auf-start": "#fff", "kopf-offen": "#d99a7c", "kopf-offen-schrift": "#3d1a0d",
    "text-stark": "#2e1c14", "text": "#4a3227", "text2": "#82685b", "text3": "#b19c90", "richtig": "#5f7d5a", "falsch": "#b23a3a",
    "gelb": "#e3a93b", "gelernt-effekt": "#ffe2b8", "orange": "#d97b43", "info": "#8a5f9e", "gelernt": "#7e9c74", "arbeit": "#e8bf74", "nie": "#eadfd5", "negativ": "#d77a6e" } },
  { id: "retro", name: "Retro 70er", farben: { "haupt": "#c8641e", "haupt-hell": "#e8a54b", "auf-haupt": "#fff8e8", "hintergrund": "#f8f0dc", "karte": "#fffaf0", "flaeche": "#efe2c2", "rahmen": "#e0cc9f",
    "app-kopf": "#e0b23a", "app-kopf-schrift": "#3a2408", "app-kopf-schrift-leise": "#6b4d1c", "kopfzeile": "#9aa64a", "kopf-schrift": "#fffbe8", "kopf-schrift-leise": "#eef0c8",
    "haupt-flaeche": "#f6dcb0", "start": "#7a4a2a", "auf-start": "#fff3dc", "kopf-offen": "#c8641e", "kopf-offen-schrift": "#fff8e8",
    "text-stark": "#2e2210", "text": "#4a3a1e", "text2": "#7e6b48", "text3": "#ab9b78", "richtig": "#6f8a2a", "falsch": "#b5402a",
    "gelb": "#e0b23a", "gelernt-effekt": "#fff0a0", "orange": "#d9772b", "info": "#8a5a8a", "gelernt": "#8fa33f", "arbeit": "#e8c25a", "nie": "#e8dcc0", "negativ": "#d36a52" } },
  { id: "neon", name: "Neon", farben: { "leiste": "#0b0b14", "haupt": "#ff3fb4", "haupt-hell": "#ff8ad6", "auf-haupt": "#1a0012", "hintergrund": "#0b0b14", "karte": "#15152a", "flaeche": "#1e1e38", "rahmen": "#2c2c52",
    "app-kopf": "#0f0f22", "app-kopf-schrift": "#39f3ff", "kopfzeile": "#17172e", "kopf-schrift": "#39f3ff", "abfrage-karte": "#18183a", "dialog": "#15152a", "knopf": "#1e1e38",
    "info-kasten": "#1b1b40", "haupt-flaeche": "#2a1438", "start": "#39f3ff", "auf-start": "#001a1d",
    "text-stark": "#f4f2ff", "text": "#dcd8f5", "text2": "#a29ec8", "text3": "#76739c", "richtig": "#4dff9a", "falsch": "#ff4d6d",
    "gelb": "#fff04d", "gelernt-effekt": "#39f3ff", "orange": "#ffa24d", "info": "#b48cff", "gelernt": "#4dff9a", "arbeit": "#ffd84d", "nie": "#33335a", "negativ": "#ff4d6d" }, dunkel: true },
  { id: "matcha", name: "Matcha", farben: { "haupt": "#5b7f3a", "haupt-hell": "#a9c47f", "auf-haupt": "#fff", "hintergrund": "#f8f6ec", "karte": "#fffdf5", "flaeche": "#eef0dc", "rahmen": "#dfe2c4",
    "app-kopf": "#dfe8c6", "kopfzeile": "#e8eed4", "abfrage-karte": "#fffef8", "haupt-flaeche": "#e3edcf", "start": "#5b7f3a", "auf-start": "#fff", "kopf-offen": "#c3d69e", "kopf-offen-schrift": "#25330f",
    "text-stark": "#1f2414", "text": "#363d26", "text2": "#6b7356", "text3": "#9da58a", "richtig": "#5b7f3a", "falsch": "#c0504d",
    "gelb": "#e3b43c", "gelernt-effekt": "#eaffb0", "orange": "#e08a3c", "info": "#7a6aa8", "gelernt": "#87a85a", "arbeit": "#e6cb6e", "nie": "#e6e6d4", "negativ": "#dc8a80" } },
  { id: "tinte", name: "Tinte & Papier", farben: { "haupt": "#1f3a8a", "haupt-hell": "#6d85c9", "auf-haupt": "#fff", "hintergrund": "#f6f1e4", "karte": "#fffcf3", "flaeche": "#ede5d0", "rahmen": "#dccfae",
    "app-kopf": "#fffcf3", "kopfzeile": "#f1ead6", "abfrage-karte": "#fffdf6", "haupt-flaeche": "#e3e8f6", "start": "#1f3a8a", "auf-start": "#fff", "kopf-offen": "#d7def2", "kopf-offen-schrift": "#14275e",
    "text-stark": "#141a2e", "text": "#2a3048", "text2": "#5f6378", "text3": "#949096", "richtig": "#2d7a4e", "falsch": "#b3261e",
    "gelb": "#e7b02c", "gelernt-effekt": "#fff3a8", "orange": "#d4762c", "info": "#6a3f9e", "gelernt": "#4f8d68", "arbeit": "#e3c06a", "nie": "#e5dcc6", "negativ": "#d0645c" } },
  { id: "sonnenuntergang", name: "Sonnenuntergang", farben: { "haupt": "#6a3d9a", "haupt-hell": "#c39be3", "auf-haupt": "#fff", "hintergrund": "#fff6f1", "karte": "#ffffff", "flaeche": "#fbe8e2", "rahmen": "#f2d6d0",
    "app-kopf": "#ff9e7a", "app-kopf-schrift": "#3a1030", "app-kopf-schrift-leise": "#6e2f4a", "kopfzeile": "#ffd6b8", "kopf-schrift": "#4a1a3c", "kopf-schrift-leise": "#7a4a5c",
    "abfrage-karte": "#fffaf6", "haupt-flaeche": "#efe0fa", "start": "#e8567a", "auf-start": "#fff", "kopf-offen": "#c39be3", "kopf-offen-schrift": "#2e1048",
    "text-stark": "#2a1426", "text": "#45283e", "text2": "#7d5e72", "text3": "#ad93a3", "richtig": "#3f9e7a", "falsch": "#d33c5a",
    "gelb": "#ffb547", "gelernt-effekt": "#ffd9a8", "orange": "#ff8a4c", "info": "#6a3d9a", "gelernt": "#6cbc96", "arbeit": "#ffc977", "nie": "#f1e1e0", "negativ": "#ee7f95" } },
  // ── 19 experimentelle Vorlagen: kräftig farbige bzw. farbig-dunkle Hintergründe ──
  { id: "senf", name: "Senf", farben: { "haupt": "#2f4858", "haupt-hell": "#6e8fa3", "auf-haupt": "#fff", "hintergrund": "#e3b23c", "karte": "#fff8e6", "flaeche": "#f7ecd0", "rahmen": "#e6cf9a",
    "app-kopf": "#fff8e6", "kopfzeile": "#f7ecd0", "haupt-flaeche": "#f7ecd0", "start": "#2f4858", "auf-start": "#fff",
    "text-stark": "#1f1a0e", "text": "#3a3020", "text2": "#4f4428", "text3": "#6b5d3a", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#e6cf9a", "negativ": "#e06c6c" } },
  { id: "flamingo", name: "Flamingo", farben: { "haupt": "#1b7f5f", "haupt-hell": "#62b89a", "auf-haupt": "#fff", "hintergrund": "#f4a3b1", "karte": "#fff5f7", "flaeche": "#fde5ea", "rahmen": "#f1c4cd",
    "app-kopf": "#fff5f7", "kopfzeile": "#fde5ea", "haupt-flaeche": "#fde5ea", "start": "#1b7f5f", "auf-start": "#fff",
    "text-stark": "#2a1018", "text": "#45222c", "text2": "#5c3440", "text3": "#7a5260", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f1c4cd", "negativ": "#e06c6c" } },
  { id: "pistazie", name: "Pistazie", farben: { "haupt": "#6b2d5c", "haupt-hell": "#b07aa3", "auf-haupt": "#fff", "hintergrund": "#b5d99c", "karte": "#fbfff5", "flaeche": "#edf6e2", "rahmen": "#d3e6c0",
    "app-kopf": "#fbfff5", "kopfzeile": "#edf6e2", "haupt-flaeche": "#edf6e2", "start": "#6b2d5c", "auf-start": "#fff",
    "text-stark": "#18220f", "text": "#2e3b22", "text2": "#3f4f31", "text3": "#5a6b4b", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d3e6c0", "negativ": "#e06c6c" } },
  { id: "himmel", name: "Himmelblau", farben: { "haupt": "#d9481f", "haupt-hell": "#f08b66", "auf-haupt": "#fff", "hintergrund": "#9ecff0", "karte": "#f7fcff", "flaeche": "#e4f2fc", "rahmen": "#c3e0f4",
    "app-kopf": "#f7fcff", "kopfzeile": "#e4f2fc", "haupt-flaeche": "#e4f2fc", "start": "#d9481f", "auf-start": "#fff",
    "text-stark": "#0e1d2a", "text": "#20384c", "text2": "#2f4d66", "text3": "#4d6b85", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#c3e0f4", "negativ": "#e06c6c" } },
  { id: "lachs", name: "Lachs", farben: { "haupt": "#2b4162", "haupt-hell": "#6c84a8", "auf-haupt": "#fff", "hintergrund": "#f4a582", "karte": "#fff6f0", "flaeche": "#fde6da", "rahmen": "#f2c7b1",
    "app-kopf": "#fff6f0", "kopfzeile": "#fde6da", "haupt-flaeche": "#fde6da", "start": "#2b4162", "auf-start": "#fff",
    "text-stark": "#2a140a", "text": "#46281a", "text2": "#5c3828", "text3": "#7a5544", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f2c7b1", "negativ": "#e06c6c" } },
  { id: "lavendelfeld", name: "Lavendelfeld", farben: { "haupt": "#b86e00", "haupt-hell": "#e0a54d", "auf-haupt": "#fff", "hintergrund": "#b8a9e3", "karte": "#faf8ff", "flaeche": "#ece7fa", "rahmen": "#d6ccf0",
    "app-kopf": "#faf8ff", "kopfzeile": "#ece7fa", "haupt-flaeche": "#ece7fa", "start": "#b86e00", "auf-start": "#fff",
    "text-stark": "#1c1530", "text": "#30284a", "text2": "#41385e", "text3": "#5d5478", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d6ccf0", "negativ": "#e06c6c" } },
  { id: "zitrone", name: "Zitrone", farben: { "haupt": "#5a189a", "haupt-hell": "#9b6ad0", "auf-haupt": "#fff", "hintergrund": "#f5e65a", "karte": "#fffde8", "flaeche": "#fbf5c4", "rahmen": "#ece08c",
    "app-kopf": "#fffde8", "kopfzeile": "#fbf5c4", "haupt-flaeche": "#fbf5c4", "start": "#5a189a", "auf-start": "#fff",
    "text-stark": "#211d05", "text": "#3b3610", "text2": "#514a1c", "text3": "#6d6533", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#ece08c", "negativ": "#e06c6c" } },
  { id: "koralle", name: "Koralle", farben: { "haupt": "#134e6f", "haupt-hell": "#4f8fb3", "auf-haupt": "#fff", "hintergrund": "#ff7f6b", "karte": "#fff3f0", "flaeche": "#ffe1da", "rahmen": "#f6b9ad",
    "app-kopf": "#fff3f0", "kopfzeile": "#ffe1da", "haupt-flaeche": "#ffe1da", "start": "#134e6f", "auf-start": "#fff",
    "text-stark": "#2b0d08", "text": "#45180f", "text2": "#55211a", "text3": "#6e3a31", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f6b9ad", "negativ": "#e06c6c" } },
  { id: "tuerkis", name: "Türkis", farben: { "haupt": "#8e2c48", "haupt-hell": "#c46d88", "auf-haupt": "#fff", "hintergrund": "#48c9b0", "karte": "#f0fffb", "flaeche": "#d9f6ef", "rahmen": "#a9e4d6",
    "app-kopf": "#f0fffb", "kopfzeile": "#d9f6ef", "haupt-flaeche": "#d9f6ef", "start": "#8e2c48", "auf-start": "#fff",
    "text-stark": "#06231d", "text": "#103a31", "text2": "#164a3f", "text3": "#2a6357", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#a9e4d6", "negativ": "#e06c6c" } },
  { id: "pfirsich", name: "Pfirsich & Petrol", farben: { "haupt": "#00606f", "haupt-hell": "#4aa3b0", "auf-haupt": "#fff", "hintergrund": "#ffd3b5", "karte": "#fffaf6", "flaeche": "#ffeadb", "rahmen": "#f3cdb2",
    "app-kopf": "#fffaf6", "kopfzeile": "#ffeadb", "haupt-flaeche": "#ffeadb", "start": "#00606f", "auf-start": "#fff",
    "text-stark": "#2b1608", "text": "#47301e", "text2": "#5e4430", "text3": "#7e634d", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f3cdb2", "negativ": "#e06c6c" } },
  { id: "kaugummi", name: "Kaugummi", farben: { "haupt": "#3a0ca3", "haupt-hell": "#7b5ce0", "auf-haupt": "#fff", "hintergrund": "#ff9ecd", "karte": "#fff4fa", "flaeche": "#ffe0ef", "rahmen": "#f7bcd8",
    "app-kopf": "#fff4fa", "kopfzeile": "#ffe0ef", "haupt-flaeche": "#ffe0ef", "start": "#3a0ca3", "auf-start": "#fff",
    "text-stark": "#2c0718", "text": "#47142c", "text2": "#5c2340", "text3": "#7a3f5c", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f7bcd8", "negativ": "#e06c6c" } },
  { id: "mintschoko", name: "Mint & Schoko", farben: { "haupt": "#5d3a1a", "haupt-hell": "#9a6e48", "auf-haupt": "#fff", "hintergrund": "#a8e6cf", "karte": "#f6fffb", "flaeche": "#e2f7ee", "rahmen": "#bfe8d6",
    "app-kopf": "#f6fffb", "kopfzeile": "#e2f7ee", "haupt-flaeche": "#e2f7ee", "start": "#5d3a1a", "auf-start": "#fff",
    "text-stark": "#0d2219", "text": "#1d3a2d", "text2": "#2b4c3d", "text3": "#476b5a", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#bfe8d6", "negativ": "#e06c6c" } },
  { id: "aubergine", name: "Aubergine", farben: { "leiste": "#2d1b33", "haupt": "#f2a541", "haupt-hell": "#f7c47f", "auf-haupt": "#2d1b33", "hintergrund": "#2d1b33", "karte": "#3d2645", "flaeche": "#4a3054", "rahmen": "#5a3d66",
    "start": "#f2a541", "auf-start": "#2d1b33",
    "text-stark": "#f7eefa", "text": "#eadff0", "text2": "#c4b0cf", "text3": "#9b86a8", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#5a4566", "negativ": "#e06c6c" }, dunkel: true },
  { id: "tanne", name: "Tannengrün", farben: { "leiste": "#13291f", "haupt": "#e9c46a", "haupt-hell": "#f2d996", "auf-haupt": "#13291f", "hintergrund": "#13291f", "karte": "#1c3a2c", "flaeche": "#244634", "rahmen": "#2f5643",
    "start": "#e9c46a", "auf-start": "#13291f",
    "text-stark": "#eef6f0", "text": "#dcebe0", "text2": "#a9c4b2", "text3": "#7f9c89", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#35584a", "negativ": "#e06c6c" }, dunkel: true },
  { id: "petrol", name: "Petrol", farben: { "leiste": "#0b3c49", "haupt": "#ffb4a2", "haupt-hell": "#ffd0c4", "auf-haupt": "#3a120a", "hintergrund": "#0b3c49", "karte": "#12505f", "flaeche": "#185e6f", "rahmen": "#22707f",
    "start": "#ffb4a2", "auf-start": "#3a120a",
    "text-stark": "#eefafc", "text": "#d9eef2", "text2": "#a6cbd3", "text3": "#7aa6b0", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#2b6c7a", "negativ": "#e06c6c" }, dunkel: true },
  { id: "pflaume", name: "Pflaume", farben: { "leiste": "#4a1942", "haupt": "#9be3c4", "haupt-hell": "#c2f0dc", "auf-haupt": "#14382a", "hintergrund": "#4a1942", "karte": "#5e2453", "flaeche": "#6b2d60", "rahmen": "#7c3a70",
    "start": "#9be3c4", "auf-start": "#14382a",
    "text-stark": "#fbeef8", "text": "#f0dcec", "text2": "#d1b0ca", "text3": "#aa86a3", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#7a4a72", "negativ": "#e06c6c" }, dunkel: true },
  { id: "ochsenblut", name: "Ochsenblut", farben: { "leiste": "#3b0d11", "haupt": "#f4d58d", "haupt-hell": "#f8e5b6", "auf-haupt": "#3b0d11", "hintergrund": "#3b0d11", "karte": "#521419", "flaeche": "#5e1a20", "rahmen": "#702229",
    "start": "#f4d58d", "auf-start": "#3b0d11",
    "text-stark": "#fbeeee", "text": "#f0dcdc", "text2": "#d2aeb0", "text3": "#ad8487", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#6e3036", "negativ": "#e06c6c" }, dunkel: true },
  { id: "indigo", name: "Indigo", farben: { "leiste": "#1e1b4b", "haupt": "#ffd166", "haupt-hell": "#ffe29e", "auf-haupt": "#1e1b4b", "hintergrund": "#1e1b4b", "karte": "#2a2766", "flaeche": "#332f75", "rahmen": "#3f3a88",
    "start": "#ffd166", "auf-start": "#1e1b4b",
    "text-stark": "#f0efff", "text": "#dedcf7", "text2": "#aeabd8", "text3": "#8582b5", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#45428a", "negativ": "#e06c6c" }, dunkel: true },
  { id: "vulkan", name: "Vulkan", farben: { "leiste": "#1c1a1a", "haupt": "#ff5a36", "haupt-hell": "#ff8c70", "auf-haupt": "#1c0a05", "hintergrund": "#1c1a1a", "karte": "#2a2626", "flaeche": "#332e2d", "rahmen": "#433b39",
    "start": "#ff5a36", "auf-start": "#1c0a05",
    "text-stark": "#f6f1ef", "text": "#e6dfdc", "text2": "#b5aaa6", "text3": "#8c817d", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#4a413f", "negativ": "#e06c6c" }, dunkel: true },
  // ── Länder-Vorlagen (Farben der Flagge) – Standard für „Farben je Sprache“ ──
  { id: "sprache_en", name: "Englisch 🇬🇧", sprache: "en", farben: { "haupt": "#1d3c78", "haupt-hell": "#7b97cf", "auf-haupt": "#fff", "hintergrund": "#eff6ef", "karte": "#ffffff", "flaeche": "#e9eef7", "rahmen": "#d3dcec",
    "app-kopf": "#1d3c78", "app-kopf-schrift": "#ffffff", "tab-aktiv": "#ffffff", "app-kopf-schrift-leise": "#c9d6f0", "kopfzeile": "#e4eaf5", "haupt-flaeche": "#e1e8f5", "start": "#c8102e", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d3dcec", "negativ": "#e06c6c" } },
  { id: "sprache_fr", name: "Französisch 🇫🇷", sprache: "fr", farben: { "haupt": "#0055a4", "haupt-hell": "#6f9fd6", "auf-haupt": "#fff", "hintergrund": "#fcf0f3", "karte": "#ffffff", "flaeche": "#eaf0f8", "rahmen": "#d6e0ef",
    "app-kopf": "#ffffff", "app-kopf-schrift": "#0055a4", "app-kopf-schrift-leise": "#6f8fb3", "kopfzeile": "#eaf0f8", "haupt-flaeche": "#e3ecf8", "start": "#ef4135", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d6e0ef", "negativ": "#e06c6c" } },
  { id: "sprache_es", name: "Spanisch 🇪🇸", sprache: "es", farben: { "haupt": "#c60b1e", "haupt-hell": "#e8707b", "auf-haupt": "#fff", "hintergrund": "#fdf3e8", "karte": "#ffffff", "flaeche": "#fdf0d6", "rahmen": "#f1dcb0",
    "app-kopf": "#c60b1e", "app-kopf-schrift": "#ffffff", "tab-aktiv": "#ffffff", "app-kopf-schrift-leise": "#ffd2d6", "kopfzeile": "#fff1cc", "haupt-flaeche": "#fde3e5", "start": "#ffc400", "auf-start": "#3a2200",
    "text-stark": "#2a1508", "text": "#432a18", "text2": "#76604f", "text3": "#a69381", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f1dcb0", "negativ": "#e06c6c" } },
  { id: "sprache_it", name: "Italienisch 🇮🇹", sprache: "it", farben: { "haupt": "#008c45", "haupt-hell": "#5fbf8a", "auf-haupt": "#fff", "hintergrund": "#eef4fb", "karte": "#ffffff", "flaeche": "#eef4ee", "rahmen": "#d8e5d9",
    "app-kopf": "#ffffff", "app-kopf-schrift": "#008c45", "app-kopf-schrift-leise": "#6aa585", "kopfzeile": "#e9f4ec", "haupt-flaeche": "#e0f1e6", "start": "#cd212a", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d8e5d9", "negativ": "#e06c6c" } },
  { id: "sprache_la", name: "Latein 🏛️", sprache: "la", farben: { "haupt": "#6b1f5c", "haupt-hell": "#b07aa3", "auf-haupt": "#fff", "hintergrund": "#f4effa", "karte": "#fffdf8", "flaeche": "#efe8da", "rahmen": "#e0d5c0",
    "app-kopf": "#6b1f5c", "app-kopf-schrift": "#f6e7b0", "tab-aktiv": "#f6e7b0", "app-kopf-schrift-leise": "#d9b9cf", "kopfzeile": "#f1e6d0", "haupt-flaeche": "#f1e1ec", "start": "#c9a227", "auf-start": "#2a1d00",
    "text-stark": "#24171f", "text": "#3d2c36", "text2": "#6f5d66", "text3": "#a08e97", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#e0d5c0", "negativ": "#e06c6c" } },
  { id: "sprache_nl", name: "Niederländisch 🇳🇱", sprache: "nl", farben: { "haupt": "#e86a10", "haupt-hell": "#f4a76e", "auf-haupt": "#fff", "hintergrund": "#f6f0e9", "karte": "#ffffff", "flaeche": "#fdeee2", "rahmen": "#f2d8c4",
    "app-kopf": "#e86a10", "app-kopf-schrift": "#ffffff", "tab-aktiv": "#ffffff", "app-kopf-schrift-leise": "#ffe0c9", "kopfzeile": "#fde9da", "haupt-flaeche": "#fde5d3", "start": "#21468b", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f2d8c4", "negativ": "#e06c6c" } },
  { id: "sprache_pt", name: "Portugiesisch 🇵🇹", sprache: "pt", farben: { "haupt": "#046a38", "haupt-hell": "#58ab7f", "auf-haupt": "#fff", "hintergrund": "#ecf7f6", "karte": "#ffffff", "flaeche": "#e9f2ea", "rahmen": "#d2e3d5",
    "app-kopf": "#046a38", "app-kopf-schrift": "#ffe08a", "tab-aktiv": "#ffe08a", "app-kopf-schrift-leise": "#b8dcc5", "kopfzeile": "#e7f1e8", "haupt-flaeche": "#dfeee3", "start": "#da291c", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d2e3d5", "negativ": "#e06c6c" } },
  { id: "sprache_ru", name: "Russisch 🇷🇺", sprache: "ru", farben: { "haupt": "#0039a6", "haupt-hell": "#6f8fd4", "auf-haupt": "#fff", "hintergrund": "#eff2f6", "karte": "#ffffff", "flaeche": "#e9eef8", "rahmen": "#d4dcee",
    "app-kopf": "#ffffff", "app-kopf-schrift": "#0039a6", "app-kopf-schrift-leise": "#7d8fb8", "kopfzeile": "#e8edf8", "haupt-flaeche": "#e1e8f7", "start": "#d52b1e", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d4dcee", "negativ": "#e06c6c" } },
  { id: "sprache_tr", name: "Türkisch 🇹🇷", sprache: "tr", farben: { "haupt": "#e30a17", "haupt-hell": "#f07a82", "auf-haupt": "#fff", "hintergrund": "#f3eff5", "karte": "#ffffff", "flaeche": "#fde7e8", "rahmen": "#f4cfd1",
    "app-kopf": "#e30a17", "app-kopf-schrift": "#ffffff", "tab-aktiv": "#ffffff", "app-kopf-schrift-leise": "#ffd0d3", "kopfzeile": "#fde8e9", "haupt-flaeche": "#fde0e2", "start": "#a3000b", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f4cfd1", "negativ": "#e06c6c" } },
  { id: "sprache_pl", name: "Polnisch 🇵🇱", sprache: "pl", farben: { "haupt": "#dc143c", "haupt-hell": "#ec8197", "auf-haupt": "#fff", "hintergrund": "#f7eeee", "karte": "#ffffff", "flaeche": "#f8e9ec", "rahmen": "#efd3d9",
    "app-kopf": "#ffffff", "app-kopf-schrift": "#dc143c", "app-kopf-schrift-leise": "#c98894", "kopfzeile": "#f9e8ec", "haupt-flaeche": "#fbe1e7", "start": "#dc143c", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#efd3d9", "negativ": "#e06c6c" } },
];
function hexZuRgb(h) {
  h = (h || "#000").replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0);
}
// a nach b mischen: t = Anteil von b (0 … 1)
function mische(a, b, t) {
  const x = hexZuRgb(a), y = hexZuRgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
// relative Helligkeit 0…1 (für lesbare Schrift auf einer Farbe)
function helligkeit(hex) {
  const [r, g, b] = hexZuRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Liste & Start: etwas heller und kräftiger als die Hauptfarbe
function hervorgehoben(hex) {
  const { h, s, v } = hexZuHsv(hex);
  return hsvZuHex(h, Math.min(1, s * 1.12 + 0.06), Math.min(1, v * 1.12 + 0.07));
}
function farbenAus(f) {
  const k = f.karte;
  const start = f.start || hervorgehoben(f.haupt);
  // Bestätigen: die Richtig-Farbe – liegt sie zu nah an der Hauptfarbe, ein kräftiges Orange, damit der Knopf heraussticht
  const farbAbstand = (x, y) => { const a = hexZuHsv(x), b = hexZuHsv(y); const d = Math.abs(a.h - b.h) % 360; return Math.min(d, 360 - d) + (Math.abs(a.s - b.s) + Math.abs(a.v - b.v)) * 60; };
  const bestaetigen = f.bestaetigen || (farbAbstand(f.richtig, f.haupt) >= 45 ? f.richtig : "#e07a10");
  // Schrift auf Liste & Start: gewählte Farbe, sonst wie auf der Hauptfarbe (keine automatische Umstellung)
  return { ...f, "start": start, "auf-start": f["auf-start"] || f["auf-haupt"],
    "auf-falsch": f["auf-falsch"] || f["auf-haupt"], "auf-gelb": f["auf-gelb"] || f["auf-haupt"],
    "auf-haupt-hell": f["auf-haupt-hell"] || f["auf-haupt"], "auf-gelernt": f["auf-gelernt"] || f["auf-haupt"],
    "app-kopf-schrift": f["app-kopf-schrift"] || f["text-stark"], "app-kopf-schrift-leise": f["app-kopf-schrift-leise"] || f.text2,
    "kopf-schrift": f["kopf-schrift"] || f["text-stark"], "kopf-schrift-leise": f["kopf-schrift-leise"] || f.text2,
    "kopf-offen-schrift": f["kopf-offen-schrift"] || f.haupt, "tab-aktiv": f["tab-aktiv"] || f.haupt,
    "bestaetigen": bestaetigen, "auf-bestaetigen": f["auf-bestaetigen"] || (helligkeit(bestaetigen) > 0.45 ? "#1a1a1a" : "#ffffff"),
    "fortschritt-balken": f["fortschritt-balken"] || f.flaeche, "fortschritt-gelernt": f["fortschritt-gelernt"] || f.gelernt,
    "fortschritt-arbeit": f["fortschritt-arbeit"] || f.arbeit, "fortschritt-nie": f["fortschritt-nie"] || f.nie, "fortschritt-negativ": f["fortschritt-negativ"] || f.negativ,
    "dialog-schrift": f["dialog-schrift"] || f["text-stark"],
    "abfrage-schrift": f["abfrage-schrift"] || f["text-stark"], "abfrage-schrift-leise": f["abfrage-schrift-leise"] || f.text2, "leiste": f.leiste || f.haupt, "gelernt-effekt": f["gelernt-effekt"] || "#fff176",
    // eigene Rollen für Flächen; ohne eigenen Wert wie bisher bzw. mit einem Hauch der Hauptfarbe
    "app-kopf": f["app-kopf"] || k, "kopfzeile": f.kopfzeile || mische(f["haupt-hell"], k, 0.93),
    "abfrage-karte": f["abfrage-karte"] || k, "dialog": f.dialog || k,
    "knopf": f.knopf || f.hintergrund, "info-kasten": f["info-kasten"] || mische(f["haupt-hell"], k, 0.9),
    "haupt-zart": mische(f["haupt-hell"], k, 0.5), "haupt-flaeche": f["haupt-flaeche"] || mische(f["haupt-hell"], k, 0.88), "kopf-offen": f["kopf-offen"] || f["haupt-flaeche"] || mische(f["haupt-hell"], k, 0.88),
    "richtig-dunkel": mische(f.richtig, f["text-stark"], 0.35), "richtig-flaeche": mische(f.richtig, k, 0.9),
    "text4": mische(f.text3, k, 0.35), "flaeche-hell": mische(f.flaeche, k, 0.7),
    "falsch-dunkel": mische(f.falsch, f["text-stark"], 0.2), "falsch-zart": mische(f.falsch, k, 0.55), "falsch-flaeche": mische(f.falsch, k, 0.92),
    "gelb-dunkel": mische(f.gelb, f["text-stark"], 0.45), "gelb-zart": mische(f.gelb, k, 0.5), "gelb-flaeche": mische(f.gelb, k, 0.9),
    "info-flaeche": mische(f.info, k, 0.9),
  };
}
// Schriften und Flächen, die (noch ohne eigenen Wert) von einer anderen Rolle übernommen werden – eine Schrift gilt nur
// auf ihrem Hintergrund: Ändert man eine Rolle, werden die davon abhängigen vorher mit ihrem bisherigen Wert festgeschrieben
const FESTE_ROLLEN = ["auf-start", "auf-bestaetigen", "auf-falsch", "auf-gelb", "auf-haupt-hell", "auf-gelernt", "app-kopf-schrift", "app-kopf-schrift-leise",
  "kopf-schrift", "kopf-schrift-leise", "kopf-offen", "kopf-offen-schrift", "dialog-schrift", "abfrage-schrift", "abfrage-schrift-leise",
  "fortschritt-balken", "fortschritt-gelernt", "fortschritt-arbeit", "fortschritt-nie", "fortschritt-negativ"];
function mitFestenSchriften(basis, rolle, hex) {
  const alt = farbenAus(basis), danach = farbenAus({ ...basis, [rolle]: hex }), neu = { ...basis };
  FESTE_ROLLEN.forEach(r => { if (r !== rolle && !basis[r] && alt[r] !== danach[r]) neu[r] = alt[r]; });
  neu[rolle] = hex;
  return neu;
}
// abgestufte Rollen werden über ihre Grundfarbe geändert
const FARB_BASIS = { "haupt-zart": "haupt-hell", "richtig-dunkel": "richtig", "richtig-flaeche": "richtig",
  "text4": "text3", "flaeche-hell": "flaeche", "falsch-dunkel": "falsch", "falsch-zart": "falsch", "falsch-flaeche": "falsch",
  "gelb-dunkel": "gelb", "gelb-zart": "gelb", "gelb-flaeche": "gelb", "info-flaeche": "info" };
// Zufällige Pastell-Farben: zufälliger Grundton, Begleittöne nach einer zufälligen Harmonie
// (benachbart, Gegenfarbe, Dreiklang); Schrift jeweils dunkel im Ton der Fläche
function hslZuHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
function zufallsFarben(zufall = Math.random) {
  const z = (a, b) => a + zufall() * (b - a);
  const h0 = z(0, 360);
  const harmonie = [[30, -30], [180, 150], [120, 240], [60, 200]][Math.floor(zufall() * 4)];
  const h1 = h0 + harmonie[0], h2 = h0 + harmonie[1];
  const satt = z(55, 75);
  const c = (h, s, l) => hslZuHex(h, s, l);
  return {
    "haupt": c(h0, satt, z(56, 61)), "haupt-hell": c(h0, satt, 82), "auf-haupt": c(h0, 50, 13),
    "hintergrund": c(h0, 60, 97), "karte": "#ffffff", "flaeche": c(h0, 40, 93), "rahmen": c(h0, 30, 86),
    "app-kopf": c(h1, 60, 88), "kopfzeile": c(h2, 60, 90), "abfrage-karte": c(h1, 70, 98), "dialog": c(h2, 60, 98),
    "knopf": c(h0, 60, 95), "info-kasten": c(h1, 50, 93), "haupt-flaeche": c(h0, 60, 91),
    "start": c(h2, satt, z(68, 74)), "auf-start": c(h2, 45, 17), "kopf-offen": c(h1, 55, 82), "kopf-offen-schrift": c(h1, 45, 20),
    "text-stark": c(h0, 20, 14), "text": c(h0, 15, 25), "text2": c(h0, 10, 45), "text3": c(h0, 8, 64),
    "richtig": c(150, 38, 52), "falsch": c(355, 65, 64), "gelb": c(43, 88, 64), "gelernt-effekt": "#fff176",
    "orange": c(25, 82, 66), "info": c(255, 55, 66), "gelernt": c(150, 40, 60), "arbeit": c(45, 80, 76), "nie": c(h0, 15, 89), "negativ": c(355, 75, 76),
  };
}
/* FARBSCHEMATA-ENDE */
// aktuelle Farben (beim Rendern gesetzt); SVG-Attribute kennen kein var() → fv() setzt die Farbe ein
let F = farbenAus(FARB_VORLAGEN[0].farben);
const fv = v => typeof v === "string" && v.includes("var(--") ? v.replace(/var\(--([\w-]+)\)/g, (_, k) => F[k] ?? "#000") : v;
function setzeSystemLeiste(farbe) {
  if (typeof document === "undefined") return;
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
  if (m.getAttribute("content") !== farbe) m.setAttribute("content", farbe);
}
// Element-Farben: eigene Farbe je Element-Art, unabhängig von den Rollen – { selektor: { "background-color": "#…", color, … } }
const TEIL_EIGENSCHAFT = { Hintergrund: "background-color", Schrift: "color", Rahmen: "border-color", Füllung: "fill", "Ring/Linie": "stroke", Linie: "stroke" };
const elementCSS = el => Object.entries(el || {}).map(([sel, p]) => `${sel}{${Object.entries(p).map(([k, v]) => `${k}:${v} !important;`).join("")}}`).join("");
const farbeZuHex = c => { const m = c && c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); if (!m || (m[4] !== undefined && +m[4] < 0.05)) return null;
  return "#" + [m[1], m[2], m[3]].map(v => Math.round(+v).toString(16).padStart(2, "0")).join(""); };
// Farbfeld: verständlicher Name eines Elements (erste passende Art, vom Element nach außen gesucht); Seite zuletzt
const ELEMENT_NAMEN = [
  ["[data-start-knopf]", "Start-Knopf"], ["[data-slot-kopf-name]", "Aktuelle Session"], ["[data-naechstes-paket]", "Knopf „Nächstes Paket“"],
  ["[data-liste-id]", "Listen-Kachel"], [".raster-chip", "Session-Kachel"], [".slot-chip", "Session-Chip"], [".einst-kopf", "Einstellungs-Kopf"],
  ["[data-quiz-art]", "Fortschritts-Kreis"], [".mini-kreise", "Mini-Kreis"], [".tab", "Tab"], [".tabs", "Tab-Leiste"], [".topbar", "Titelleiste"],
  [".quiz-frage-box", "Frage-Karte"], [".quiz-antwort-box", "Antwort-Karte"], [".quiz-vorig", "Beantwortete Spalte"], ["[data-mc-knopf]", "Auswahl-Antwort"],
  [".karte-btn", "Bewertungs-Knopf"], [".akzent-kachel", "Akzent-Buchstabe"], [".lernen-karte", "Lernkarte"],
  [".neue-session-knopf", "Knopf „Neue Session“"], [".neue-session-wahl", "Auswahl im Dialog"],
  [".btn-primary", "Haupt-Knopf"], [".btn-ghost-filled", "Knopf (gefüllt)"], [".btn-ghost", "Knopf (umrandet)"], [".btn-icon", "Symbol-Knopf"],
  [".typ-btn", "Auswahl-Knopf"], [".toggle-opt", "Umschalt-Knopf"], [".checkbox", "Häkchen"], [".inp", "Eingabefeld"],
  [".meldung-info", "Hinweis-Kasten"], [".modal", "Dialog"], [".slot-kopf", "Kopfzeile Quiz-Tab"], [".liste-detail-header", "Kopfzeile"],
  [".start-bereich", "Start-Bereich"], [".karte-zeile", "Zeile"], [".karte", "Karte"], [".sektion", "Bereich"],
];
const TEIL_NAMEN = { Schrift: "Text", Hintergrund: "Hintergrund", Rahmen: "Rahmen", Füllung: "Füllung", "Ring/Linie": "Ring/Linie", Linie: "Linie" };
function elementName(el) {
  if (!el || el === document.body) return "Seite";
  for (const [sel, name] of ELEMENT_NAMEN) { try { if (el.closest(sel)) return name; } catch { /* */ } }
  if (el instanceof SVGElement) return "Grafik";
  if (el.querySelector?.(":scope > .topbar")) return "App-Kopf";
  const info = el.closest("[data-info]")?.getAttribute("data-info");
  return info ? info.split(/[–:]/)[0].trim().slice(0, 30) : "Element";
}
// Teil-Name im Farbfeld; Start-Knopf: großer und kleiner Text getrennt
function teilName(el, teil) {
  if (teil === "Schrift" && el?.closest?.("[data-start-knopf]") && !el.matches("[data-start-knopf]")) return el.tagName.toLowerCase() === "b" ? "Text groß" : "Text klein";
  return TEIL_NAMEN[teil] || teil;
}

// Schlüssel einer Element-Art: kennzeichnendes data-Attribut, sonst die Klassen (ohne Zustände), sonst Eltern-Schlüssel > Tag
const SCHLUESSEL_OHNE = new Set(["data-info", "data-liste-id", "data-slot-id", "data-raster-zelle", "data-multi-nr", "data-wahl-nr", "data-auswahl-nr",
  "data-statistik-vok", "data-offen", "data-anzahl", "data-pct", "data-kachel-balken", "data-sichtbar", "data-lernen-phase"]);
const ZUSTAND_KLASSEN = new Set(["aktiv", "offen", "checked", "richtig", "falsch", "aufgedeckt", "weitere", "gelernt-blitz", "aktiv-kachel", "voll", "spalte-ok", "sichtbar", "lernen-ein", "leuchten"]);
function elementSchluessel(el, tiefe = 0) {
  if (!el || el === document.body || el === document.documentElement) return "body";
  const attr = [...el.attributes].map(a => a.name).find(n => n.startsWith("data-") && !SCHLUESSEL_OHNE.has(n));
  if (attr) return `[${attr}]`;
  const klassen = [...el.classList].filter(k => !ZUSTAND_KLASSEN.has(k) && /^[\w-]+$/.test(k));
  if (klassen.length) return "." + klassen.join(".");
  if (tiefe >= 3) return el.tagName.toLowerCase();
  return `${elementSchluessel(el.parentElement, tiefe + 1)} > ${el.tagName.toLowerCase()}`;
}
const farbVariablen = (f, dunkel) => `:root{${Object.entries(f).map(([k, v]) => `--${k}:${v};`).join("")}color-scheme:${dunkel ? "dark" : "light"};}`;
// gewähltes Schema: Vorlage oder eigenes (einstellungen.eigeneSchemata)
function schemaVon(einst) {
  const id = einst?.farbschema || "natur";
  return (einst?.eigeneSchemata || []).find(x => x.id === id) || FARB_VORLAGEN.find(x => x.id === id) || FARB_VORLAGEN[0];
}
// ── Farbwähler: großer Farbkreis (außen kräftig, zur Mitte weniger gesättigt), Helligkeitsregler,
// Vorher/Neu, Hex-Eingabe, Verlauf der letzten Farben; beiLive(hex) beim Ziehen, Anwenden/Abbrechen ──
function hexZuHsv(hex) {
  const [r, g, b] = hexZuRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
function hsvZuHex(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return "#" + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
// oben: Leiste am oberen Rand (Element liegt unten), sonst am unteren Rand – das Element bleibt sichtbar
function FarbRad({ titel, start, verlauf, schema = [], beiLive, beiAnwenden, beiAbbrechen, oben = false }) {
  const [hsv, setHsv] = useState(() => hexZuHsv(start));
  const [hexText, setHexText] = useState(start);
  const canvasRef = useRef(null);
  const groesse = Math.max(130, Math.min(170, ((typeof window !== "undefined" ? window.innerWidth : 360) - 40) * 0.46));
  const hex = hsvZuHex(hsv.h, hsv.s, hsv.v);
  // Kreis einmal zeichnen (volle Helligkeit; Helligkeit regelt der Schieber)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, n = Math.round(groesse * dpr);
    c.width = n; c.height = n;
    const ctx = c.getContext("2d"), bild = ctx.createImageData(n, n), r = n / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x - r, dy = y - r, dist = Math.hypot(dx, dy), i = (y * n + x) * 4;
      if (dist > r) { bild.data[i + 3] = 0; continue; }
      const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const [rr, gg, bb] = hexZuRgb(hsvZuHex(h, dist / r, 1));
      bild.data[i] = rr; bild.data[i + 1] = gg; bild.data[i + 2] = bb; bild.data[i + 3] = 255;
    }
    ctx.putImageData(bild, 0, 0);
  }, [groesse]);
  const setze = (neu, live = true) => { setHsv(neu); const h = hsvZuHex(neu.h, neu.s, neu.v); setHexText(h); if (live) beiLive(h); };
  const greife = e => {
    const rect = canvasRef.current.getBoundingClientRect(), r = rect.width / 2;
    const dx = e.clientX - rect.left - r, dy = e.clientY - rect.top - r;
    setze({ ...hsv, h: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s: Math.min(1, Math.hypot(dx, dy) / r) });
  };
  const winkel = hsv.h * Math.PI / 180, mx = groesse / 2 + Math.cos(winkel) * hsv.s * groesse / 2, my = groesse / 2 + Math.sin(winkel) * hsv.s * groesse / 2;
  const regler = (name, attr, wert, aendern, verlaufCss) => (
    <div style={{marginBottom:6}}>
      <div style={{fontSize:"0.68rem", color:"var(--text2)", marginBottom:2}}>{name}</div>
      <input type="range" min={0} max={100} value={Math.round(wert * 100)} {...{ [attr]: true }}
        onChange={e => aendern(e.target.value / 100)}
        style={{width:"100%", height:22, accentColor:hex, background:verlaufCss, borderRadius:11, WebkitAppearance:"none", appearance:"none", display:"block"}}/>
    </div>
  );
  return (
    <div className={`farbrad-rahmen${oben ? " oben" : ""}`} data-farbmodus-ui>
      <div className="farbrad" data-farbrad data-farbrad-seite={oben ? "oben" : "unten"} onClick={e => e.stopPropagation()}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
          <span style={{flex:1, minWidth:0, fontWeight:800, color:"var(--text)", fontSize:"0.85rem", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{titel}</span>
          <span title="vorher" style={{width:28, height:22, borderRadius:6, background:start, border:"1px solid var(--rahmen)", flexShrink:0}}/>
          <span style={{color:"var(--text3)", fontSize:"0.8rem"}}>→</span>
          <span title="neu" data-farbrad-neu style={{width:28, height:22, borderRadius:6, background:hex, border:"1px solid var(--rahmen)", flexShrink:0}}/>
        </div>
        <div style={{display:"flex", gap:12, alignItems:"flex-start"}}>
          <div style={{position:"relative", width:groesse, height:groesse, flexShrink:0, touchAction:"none"}}>
            <canvas ref={canvasRef} data-farbrad-kreis style={{width:groesse, height:groesse, display:"block", borderRadius:"50%", filter:`brightness(${Math.max(0.15, hsv.v)})`, cursor:"crosshair"}}
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); greife(e); }}
              onPointerMove={e => { if (e.buttons || e.pointerType === "touch") greife(e); }}/>
            <span style={{position:"absolute", left:mx - 10, top:my - 10, width:20, height:20, borderRadius:"50%", border:"3px solid #fff", boxShadow:"0 0 0 1.5px rgba(0,0,0,0.6)", background:hex, pointerEvents:"none"}}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            {regler("Helligkeit", "data-farbrad-hell", hsv.v, v => setze({ ...hsv, v }), `linear-gradient(to right, #000, ${hsvZuHex(hsv.h, hsv.s, 1)})`)}
            {regler("Sättigung", "data-farbrad-saett", hsv.s, v => setze({ ...hsv, s: v }), `linear-gradient(to right, ${hsvZuHex(hsv.h, 0, hsv.v)}, ${hsvZuHex(hsv.h, 1, hsv.v)})`)}
            <input className="inp" data-farbrad-hex value={hexText} style={{width:"100%", padding:"4px 8px", fontFamily:"monospace", fontSize:"0.85rem", marginBottom:6}}
              onChange={e => { const t = e.target.value.trim(); setHexText(t); if (/^#?[0-9a-f]{6}$/i.test(t)) { const h = (t.startsWith("#") ? t : "#" + t).toLowerCase(); setHsv(hexZuHsv(h)); beiLive(h); } }}/>
            {[["Zuletzt verwendet", verlauf, "data-farbrad-verlauf"], ["In diesem Schema", schema, "data-farbrad-schema"]].map(([name, farben, attr]) => farben.length > 0 && (
              <div key={attr} style={{marginTop:4}}>
                <div style={{fontSize:"0.68rem", color:"var(--text2)", marginBottom:2}}>{name}</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:4}} {...{ [attr]: true }}>
                  {farben.map(f => <button key={f} title={f} onClick={() => { setHsv(hexZuHsv(f)); setHexText(f); beiLive(f); }}
                    style={{width:22, height:22, borderRadius:6, background:f, border: f === hex ? "2.5px solid var(--text)" : "1px solid var(--rahmen)", cursor:"pointer", padding:0}}/>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex", gap:8, marginTop:10}}>
          <button className="btn btn-ghost" style={{flex:1, padding:"8px"}} data-farbrad-abbrechen onClick={beiAbbrechen}>Abbrechen</button>
          <button className="btn btn-primary" style={{flex:1, padding:"8px"}} data-farbrad-anwenden onClick={() => beiAnwenden(hex)}>Anwenden</button>
        </div>
      </div>
    </div>
  );
}

let CSS = "";
const CSS_BASIS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--hintergrund);font-family:system-ui,sans-serif;color:var(--text-stark);}
  /* Kein Text-Markieren per Lang-Druck (kollidiert mit den Info-Texten); Eingabefelder bleiben markierbar */
  body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
  input,textarea,[contenteditable="true"]{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default;}
  .app{max-width:600px;margin:0 auto;padding:0 0 80px;}
  .topbar{background:var(--app-kopf);color:var(--app-kopf-schrift);border-bottom:1px solid var(--rahmen);padding:14px 16px;display:flex;align-items:center;gap:12px;}
  .topbar-title{font-size:1.05rem;font-weight:700;flex:1;text-align:center;}
  .klammer-hinweis{font-size:0.7em;font-weight:500;color:var(--text3);}
  .mc-raster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;}
  .mc-raster > button{min-height:72px;width:100%;overflow-wrap:anywhere;line-height:1.25;}
  .kopf-balken{display:block;height:5px;margin:5px auto 0;width:min(150px,80%);background:var(--flaeche);border-radius:3px;overflow:hidden;}
  .kopf-balken > span{display:block;height:100%;background:var(--haupt-hell);border-radius:3px;transition:width .3s;}
  .info-schalter{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;border:1.5px solid var(--haupt);background:var(--app-kopf);color:var(--haupt);font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-family:inherit;}
  body.info-modus .info-schalter{background:var(--haupt);color:var(--auf-haupt);}
  body.info-modus [data-info]{outline:1.5px dashed var(--haupt-hell) !important;outline-offset:2px;}
  @media (max-width:480px){.sprach-chip-name{display:none;}}
  .topbar-back{background:var(--haupt);color:var(--auf-haupt);font-size:0.88rem;font-weight:600;cursor:pointer;border:none;padding:8px 12px;border-radius:10px;font-family:inherit;transition:opacity .15s;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;}
  .topbar-back:active{opacity:.8;}
  .tabs{display:flex;background:var(--app-kopf);border-bottom:1px solid var(--rahmen);}
  .statistik-listen-header{background:var(--kopfzeile);color:var(--kopf-schrift);border-bottom:1px solid var(--rahmen);padding:10px 16px;display:flex;align-items:center;gap:8px;position:sticky;z-index:8;}
  .liste-detail-header{background:var(--kopfzeile);color:var(--kopf-schrift);border-bottom:1px solid var(--rahmen);padding:12px 16px;display:flex;align-items:center;gap:10px;position:sticky;z-index:9;}
  .tab{flex:1;padding:12px 4px;font-size:0.82rem;font-weight:600;color:var(--app-kopf-schrift-leise);background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;}
  .tab.aktiv{color:var(--tab-aktiv);border-bottom-color:var(--tab-aktiv);}
  .sektion{padding:20px 16px 0;}
  .sektion-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .sektion-label{font-size:0.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text2);}
  .karte{background:var(--karte);border:1px solid var(--rahmen);border-radius:12px;overflow:hidden;margin-bottom:16px;}
  .karte-zeile{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--rahmen);gap:12px;}
  .karte-zeile:last-child{border-bottom:none;}
  .karte-zeile-info{flex:1;min-width:0;}
  .karte-zeile-name{font-weight:600;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .karte-zeile-sub{font-size:0.78rem;color:var(--text2);margin-top:2px;}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 18px;border-radius:10px;font-size:0.88rem;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s;}
  .btn:active{opacity:.8;}
  .btn-primary{background:var(--haupt);color:var(--auf-haupt);border:1.5px solid transparent;}
  .btn-primary.start-knopf{background:var(--start);color:var(--auf-start);}
  .btn-ghost{background:transparent;color:var(--haupt);border:1.5px solid var(--haupt);}
  .btn-ghost-filled{background:var(--knopf);color:var(--haupt);border:1.5px solid var(--haupt);}
  .btn-sm{padding:6px 12px;font-size:0.8rem;min-height:30px;}
  .btn-danger{background:transparent;color:var(--falsch);border:1.5px solid var(--falsch);}
  .btn-icon{background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;color:var(--text2);font-size:0.82rem;font-weight:600;}
  .btn-icon:hover{background:var(--flaeche);}
  .inp{width:100%;background:var(--knopf);border:1.5px solid var(--rahmen);border-radius:10px;padding:11px 14px;font-size:0.95rem;color:var(--text-stark);outline:none;font-family:inherit;}
  .inp:focus{border-color:var(--haupt);background:var(--karte);}
  .inp::placeholder{color:var(--text4);}
  @media (pointer:coarse){input,textarea,select{font-size:16px !important;}}
  textarea.inp{resize:vertical;font-family:monospace;font-size:0.82rem;line-height:1.5;}
  select.inp{cursor:pointer;}
  .inp-label{font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;display:block;}
  /* Fenster oben anzeigen, damit die Bildschirmtastatur sie nicht verdeckt */
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;z-index:100;padding:max(16px, env(safe-area-inset-top)) 16px 16px;overflow-y:auto;}
  .modal{background:var(--dialog);color:var(--dialog-schrift);border-radius:16px;width:100%;max-width:500px;padding:24px;margin-top:4vh;box-sizing:border-box;}
  .modal-titel{font-size:1.1rem;font-weight:700;margin-bottom:16px;}
  .modal-actions{display:flex;gap:10px;margin-top:20px;justify-content:flex-end;}
  .leer{text-align:center;padding:48px 24px;color:var(--text2);}
  .leer-text{font-size:0.9rem;line-height:1.5;margin-top:8px;}
  .jubel{text-align:center;padding:4px 0 18px;}
  .jubel-titel{font-size:2rem;font-weight:800;color:var(--haupt);line-height:1.2;animation:jubelPop .55s cubic-bezier(.2,1.6,.4,1) both;}
  .jubel-emoji{font-size:2.2rem;display:block;animation:jubelPop .55s .1s cubic-bezier(.2,1.6,.4,1) both;}
  .jubel-sub{font-size:0.9rem;color:var(--text2);margin-top:4px;}
  @keyframes jubelPop{0%{transform:scale(.3);opacity:0;}100%{transform:scale(1);opacity:1;}}
  .spalten-badge{font-size:0.68rem;font-weight:700;padding:1px 6px;border-radius:4px;background:var(--flaeche);color:var(--text3);margin-right:3px;}
  .spalten-badge.aktiv{background:var(--haupt-flaeche);color:var(--haupt);}
  .typ-btn{font-size:0.78rem;font-weight:600;padding:5px 10px;border-radius:6px;border:1.5px solid var(--rahmen);background:var(--knopf);color:var(--text2);cursor:pointer;font-family:inherit;}
  .typ-btn.aktiv{background:var(--haupt);color:var(--auf-haupt);border-color:var(--haupt);}
  .typ-btn:disabled{opacity:0.3;cursor:not-allowed;}
  .toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;}
  .toggle-row > :first-child:not(.toggle-btn){flex:1 1 auto;min-width:0;}
  .toggle-row > .toggle-btn{flex-shrink:0;}
  .toggle-row > .toggle-btn .toggle-opt{min-height:40px;padding:8px 16px;font-size:0.9rem;}
  .toggle-label{font-weight:600;font-size:0.9rem;}
  .toggle-sub{font-size:0.78rem;color:var(--text2);margin-top:2px;}
  .toggle-btn{display:flex;border-radius:8px;overflow:hidden;border:1.5px solid var(--rahmen);}
  .toggle-opt{padding:6px 14px;font-size:0.82rem;font-weight:600;background:none;border:none;cursor:pointer;color:var(--text2);font-family:inherit;}
  .toggle-opt.aktiv{background:var(--haupt);color:var(--auf-haupt);}
  /* Rechte Spalte der Kopfzeilen (Quiz/Statistik): alle Knöpfe so breit und hoch wie der Alle/Bereich-Schalter */
  .zeile-rechts{width:124px;height:31px;box-sizing:border-box;flex-shrink:0;}
  button.zeile-rechts{display:inline-block;padding:0 8px;line-height:31px;font-size:0.82rem;border-radius:8px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .toggle-btn.zeile-rechts .toggle-opt{flex:1 1 0;padding:0 4px;min-width:0;}
  .meldung-info{background:var(--info-flaeche);color:var(--info);border:1px solid var(--info-flaeche);padding:12px 16px;border-radius:10px;font-size:0.85rem;margin-bottom:16px;line-height:1.6;}
  .fehler{color:var(--falsch);font-size:0.82rem;margin-top:8px;margin-bottom:8px;}
  .fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:28px;background:var(--haupt);color:var(--auf-haupt);font-size:1.6rem;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:20;}
  .spalten-zuweisung{padding:14px 16px;border-bottom:1px solid var(--rahmen);}
  .spalten-zuweisung:last-child{border-bottom:none;}
  .typ-buttons{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}
  .import-kompakt{display:flex;align-items:center;gap:8px;margin-top:6px;}
  .import-beispiel{font-size:0.78rem;color:var(--text2);margin-top:3px;}
  .import-zaehler{font-size:0.82rem;color:var(--text2);margin-bottom:12px;}
  .import-zaehler strong{color:var(--haupt);}
  .slot-chip{padding:7px 13px;border-radius:8px;border:1.5px solid var(--rahmen);background:var(--knopf);font-size:0.78rem;font-weight:600;color:var(--text2);cursor:pointer;font-family:inherit;white-space:nowrap;}
  .slot-chip.belegt{background:var(--haupt-flaeche);border-color:var(--haupt);color:var(--haupt);}
  .slot-chip.verlauf{background:var(--karte);border-style:dashed;border-color:var(--text4);color:var(--text2);font-weight:500;}
  .slot-chip.zuletzt{background:var(--gelb-flaeche);border-color:var(--gelb);color:var(--orange);}
  .slot-chip.leer{opacity:0.35;cursor:default;}
  .slot-raster{display:grid;gap:6px;}
  .quiz-zeile{position:sticky;z-index:7;display:flex;gap:8px;background:var(--karte);border-bottom:1px solid var(--rahmen);padding:10px 16px;margin:0 -16px;}
  .quiz-zeile-zelle{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
  .quiz-zeile-zelle.schmal{flex:0 0 auto;}
  .quiz-zeile-label{font-size:0.66rem;font-weight:600;color:var(--text3);padding-left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.2px;}
  .quiz-zeile-knopf{flex:1 1 auto;min-height:40px;width:100%;min-width:0;padding:9px 6px;border-radius:10px;border:1.5px solid var(--haupt);background:var(--haupt);color:var(--auf-haupt);font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .quiz-zeile-knopf.zweizeilig{padding:4px 6px;line-height:1.2;}
  .quiz-zeile-knopf.umbruch{white-space:normal;line-height:1.2;padding:4px 6px;}
  .quiz-zeile-knopf .zeile1,.quiz-zeile-knopf .zeile2{display:block;overflow:hidden;text-overflow:ellipsis;}
  .quiz-zeile-knopf .zeile2{font-size:0.72rem;font-weight:600;opacity:0.85;}
  .quiz-zeile-knopf.offen{}
  .quiz-zeile.hat-offen > :not(.offen){display:none;}
  .bestaetigen-knopf,.toggle-opt.bestaetigen-knopf,.quiz-zeile-knopf.bestaetigen-knopf{background:var(--bestaetigen);color:var(--auf-bestaetigen);border-color:var(--bestaetigen);font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.22);}
  .bestaetigen-knopf::before{content:"✓ ";}
  .leuchten,.toggle-opt.leuchten,.quiz-zeile-knopf.leuchten,.slot-chip.leuchten{background:var(--bestaetigen) !important;color:var(--auf-bestaetigen) !important;border-color:var(--bestaetigen) !important;}
  .leuchten .raster-name,.quiz-setup-check.leuchten > div > div{color:inherit !important;}
  .quiz-zeile-knopf[data-gelernte]{background:var(--haupt-flaeche);color:var(--haupt);border-color:var(--haupt);flex:0 0 auto;padding-left:12px;padding-right:12px;}
  .quiz-zeile-knopf[data-gelernte].an{background:var(--haupt);color:var(--auf-haupt);}
  .quiz-zeile-hinweis{font-size:0.75rem;color:var(--text3);text-align:center;padding:6px 0 0;}
  .umfang-raster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px;}
  .umfang-raster .typ-btn{min-height:48px;font-size:1.1rem;font-weight:800;}
  .start-arten{display:flex;justify-content:center;align-items:flex-start;gap:20px;margin:0 0 12px;}
  .start-art{background:none;border:none;padding:0;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-family:inherit;border-radius:50%;}
  .start-art:not(.aktiv){margin-top:19px;}
  .start-art.aktiv{cursor:default;border-radius:12px;}
  .start-art-name{font-size:0.75rem;font-weight:600;color:var(--text2);white-space:nowrap;}
  .start-titel{font-size:1.25rem;font-weight:800;color:var(--text-stark);text-align:center;margin:0 0 10px;}
  .start-bereich{background:var(--karte);padding:14px 16px;margin:0 -16px 8px;border-bottom:1px solid var(--rahmen);}
  .start-fortschritt{flex:0 0 auto;min-width:86px;border-radius:12px;border:1.5px solid var(--haupt-zart);background:var(--haupt-flaeche);color:var(--haupt);font-family:inherit;font-weight:800;font-size:1rem;cursor:pointer;}
  .start-fortschritt:disabled{cursor:default;opacity:0.7;}
  .start-knopf{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:10px 12px;min-height:58px;}
  .start-knopf b{font-size:1.1rem;font-weight:800;}
  .start-knopf span{font-size:0.85rem;font-weight:400;opacity:0.95;}
  .slot-kopf{position:sticky;z-index:9;background:var(--kopfzeile);color:var(--kopf-schrift);border-bottom:1px solid var(--rahmen);padding:10px 16px;}
  .slot-kopf.gruen{background:var(--haupt);border-bottom-color:var(--haupt);}
  .slot-kopf-name{flex:1;min-width:0;padding:7px 12px;font-size:0.95rem;border-radius:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;}
  .slot-kopf-name.toggle-opt.aktiv{background:var(--start);color:var(--auf-start);}
  .slot-kopf.gruen .slot-kopf-name{border:1.5px solid rgba(255,255,255,0.45);}
  .slot-kopf-info{font-size:0.75rem;color:var(--kopf-schrift-leise);text-align:center;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .slot-kopf.gruen .slot-kopf-info{color:var(--auf-haupt);opacity:0.85;}
  .farbmodus-leiste{position:fixed;right:12px;bottom:12px;z-index:10002;display:flex;gap:6px;padding:6px 8px;background:var(--karte);border:1.5px solid var(--rahmen);border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:system-ui,sans-serif;}
  .farbfeld-hintergrund{position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,0.15);display:flex;align-items:flex-end;justify-content:center;}
  .farbfeld-hintergrund.oben{align-items:flex-start;}
  .farbfeld-hintergrund.oben .farbfeld{border-radius:0 0 16px 16px;padding:14px 16px 16px;box-shadow:0 6px 24px rgba(0,0,0,0.25);}
  .farbfeld{width:100%;max-width:520px;max-height:48vh;overflow-y:auto;background:var(--karte);border-radius:16px 16px 0 0;padding:14px 16px 70px;box-shadow:0 -6px 24px rgba(0,0,0,0.25);font-family:system-ui,sans-serif;box-sizing:border-box;}
  .farb-raster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
  .einst-kopf{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;margin:0 0 8px;background:var(--kopfzeile);border:1px solid var(--rahmen);border-radius:12px;font-family:inherit;font-size:0.95rem;font-weight:700;color:var(--kopf-schrift);cursor:pointer;text-align:left;}
  .einst-kopf.offen{background:var(--kopf-offen);border-color:var(--haupt-zart);color:var(--kopf-offen-schrift);}
  .einst-kopf-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
  .einst-kopf-sub{font-size:0.75rem;font-weight:400;color:var(--kopf-schrift-leise);}
  .einst-kopf-pfeil{font-size:0.9rem;color:var(--kopf-schrift-leise);flex:0 0 auto;}
  .einst-kopf.offen .einst-kopf-pfeil{color:var(--kopf-offen-schrift);}
  .einst-kopf.offen .einst-kopf-sub{color:var(--kopf-offen-schrift);opacity:0.8;}
  .einst-inhalt{margin-bottom:14px;}
  .ordner-kachel{border-width:2px;border-style:solid;margin:0 8px 8px 0;box-shadow:4px 4px 0 -2px var(--haupt-flaeche), 4px 4px 0 0 var(--haupt), 8px 8px 0 -2px var(--haupt-flaeche), 8px 8px 0 0 color-mix(in srgb, var(--haupt) 55%, transparent);}
  /* Ring über der Kachel (nicht unter dem Finger) */
  .gruppen-ring{position:absolute;left:50%;bottom:calc(100% + 4px);transform:translateX(-50%);width:46px;height:46px;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3));}
  [data-angehoben]{transform:scale(1.05);box-shadow:0 6px 16px rgba(0,0,0,0.25);z-index:4;transition:transform 0.12s, box-shadow 0.12s;}
  .gruppen-ring svg{width:46px;height:46px;transform:rotate(-90deg);}
  .gruppen-ring circle{fill:var(--karte);stroke:var(--haupt);stroke-width:3;stroke-dasharray:94.25;stroke-dashoffset:94.25;animation:gruppenRing 1.2s linear forwards;}
  .gruppen-ring.fertig circle{animation:none;stroke-dashoffset:0;fill:var(--haupt-flaeche);}
  .gruppen-ring span{position:absolute;font-size:1.05rem;opacity:0.35;}
  .gruppen-ring.fertig span{opacity:1;}
  @keyframes gruppenRing{to{stroke-dashoffset:0;}}
  .ordner-kachel.ordner-aktiv{outline:2px solid var(--haupt);outline-offset:1px;}
  .ordner-anzahl{font-weight:500;opacity:0.7;}
  .neue-session-knopf{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:12px;}
  .neue-session-wahl{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;border:1.5px solid var(--rahmen);border-radius:12px;background:var(--knopf);color:var(--text-stark);font-family:inherit;cursor:pointer;}
  .neue-session-wahl b{font-size:0.98rem;}
  .neue-session-wahl span{font-size:0.78rem;color:var(--text2);}
  .neue-session-wahl:hover{border-color:var(--haupt);}
  .einst-unterkopf{margin:18px 0 8px;}
  .einst-inhalt > .einst-unterkopf:first-child{margin-top:4px;}
  .einst-titel-knopf{background:none;border:none;padding:0;font-family:inherit;font-weight:700;font-size:0.88rem;color:var(--haupt);cursor:pointer;}
  .farb-kachel{display:flex;flex-direction:column;gap:6px;padding:6px;border:1.5px solid var(--rahmen);border-radius:10px;background:var(--karte);cursor:pointer;font-family:inherit;min-width:0;}
  .farb-kachel.aktiv{border-color:var(--haupt);box-shadow:0 0 0 2px var(--haupt);}
  .farb-streifen{display:flex;gap:3px;padding:5px;border-radius:7px;height:30px;box-sizing:border-box;}
  .farb-streifen > span{flex:1;border-radius:4px;border:1px solid rgba(0,0,0,0.08);}
  .farb-name{font-size:0.78rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .farb-zeile{display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--flaeche);cursor:pointer;}
  .farb-tupfer{width:42px;height:32px;border:1px solid var(--rahmen);border-radius:8px;flex-shrink:0;box-shadow:inset 0 0 0 2px var(--karte);}
  /* Farb-Werkzeuge (Farbmodus-Leiste, Farbfeld, Farbwähler, Namensfenster): feste Farben, unabhängig vom Schema – immer lesbar */
  [data-farbmodus-ui]{--karte:#ffffff;--dialog:#ffffff;--hintergrund:#f6f6f4;--flaeche:#eeeeec;--flaeche-hell:#f6f6f4;--knopf:#f4f4f2;--rahmen:#d2d2cc;--text-stark:#1a1a1a;--text:#2b2b2b;--text2:#5c5c58;--text3:#8a8a85;--text4:#b0b0aa;--dialog-schrift:#1a1a1a;--kopf-schrift:#1a1a1a;--haupt:#2d6a4f;--haupt-hell:#52b788;--auf-haupt:#ffffff;--haupt-flaeche:#e6f2ec;--haupt-zart:#a9d6c0;--falsch:#c0392b;--auf-falsch:#ffffff;--gelb:#f9a825;--gelb-flaeche:#fdf3d8;--info:#6a1b9a;color:#1a1a1a;}
  [data-farbmodus-ui] .btn.btn-primary{background:#2d6a4f !important;color:#fff !important;border-color:transparent !important;}
  [data-farbmodus-ui] .btn.btn-ghost{background:#fff !important;color:#2d6a4f !important;border-color:#2d6a4f !important;}
  [data-farbmodus-ui] .btn.btn-ghost-filled{background:#f4f4f2 !important;color:#2d6a4f !important;border-color:#2d6a4f !important;}
  [data-farbmodus-ui] .farbmodus-leiste,[data-farbmodus-ui] .farbfeld,[data-farbmodus-ui] .farbrad{background:#fff !important;color:#1a1a1a !important;}
  .farbrad-rahmen{position:fixed;left:0;right:0;bottom:0;z-index:10006;display:flex;justify-content:center;pointer-events:none;}
  .farbrad-rahmen.oben{bottom:auto;top:0;}
  .farbrad{pointer-events:auto;width:100%;max-width:520px;background:var(--karte);border-radius:16px 16px 0 0;padding:10px 14px 12px;box-shadow:0 -4px 22px rgba(0,0,0,0.28);font-family:system-ui,sans-serif;box-sizing:border-box;}
  .farbrad-rahmen.oben .farbrad{border-radius:0 0 16px 16px;box-shadow:0 4px 22px rgba(0,0,0,0.28);}
  .farbrad input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid rgba(0,0,0,0.5);box-shadow:0 1px 4px rgba(0,0,0,0.3);}
  .farb-zeile input[type=color]{width:42px;height:32px;border:1px solid var(--rahmen);border-radius:8px;padding:2px;background:var(--karte);flex-shrink:0;}
  .gelernt-blitz{animation:gelerntBlitz .4s ease-out;position:relative;}
  @keyframes gelerntBlitz{0%,40%{background:var(--gelernt-effekt);border-color:var(--gelernt-effekt);box-shadow:0 0 0 4px var(--gelernt-effekt),0 0 22px var(--gelernt-effekt);}100%{box-shadow:0 0 0 0 transparent;}}
  .gelernt-sterne{position:absolute;inset:0;pointer-events:none;z-index:3;}
  .gelernt-sterne .stern{position:absolute;left:50%;top:50%;color:var(--gelb);font-size:1.2rem;line-height:1;opacity:0;text-shadow:0 0 6px var(--gelernt-effekt);animation:sternFlug .75s ease-out forwards;animation-delay:var(--v);}
  @keyframes sternFlug{0%{opacity:1;transform:translate(-50%,-50%) rotate(var(--w)) translateX(40px) rotate(calc(-1 * var(--w))) scale(.5);}65%{opacity:1;}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--w)) translateX(var(--r)) rotate(calc(-1 * var(--w))) scale(1.15);}}
  .lernen-karte{position:relative;display:flex;flex-direction:column;justify-content:center;min-height:280px;padding:24px 16px;cursor:pointer;}
  .lernen-inhalt{display:flex;flex-direction:column;gap:8px;}
  .lernen-teil{opacity:0;transition:opacity .5s ease-out;}
  .lernen-teil.sichtbar{opacity:1;}
  .lernen-ein{animation:lernEin .5s ease-out;}
  @keyframes lernEin{from{opacity:0;}to{opacity:1;}}
  .lernen-pausiert{position:absolute;top:10px;right:14px;color:var(--text3);font-size:1.1rem;}
  .lernen-nochmal{position:absolute;top:10px;right:10px;width:38px;height:38px;border-radius:9px;border:1.5px solid var(--rahmen);background:var(--karte);font-size:1.15rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}
  .lernen-tippen{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:0.72rem;color:var(--text3);}
  .lernen-einst-knopf{display:block;margin:12px auto 0;padding:6px 14px;border:none;background:none;font-family:inherit;font-size:0.82rem;font-weight:700;color:var(--text2);cursor:pointer;}
  .lernen-vorlesen{display:flex;gap:6px;flex-wrap:wrap;}
  .lernen-vorlesen .typ-btn{padding:5px 10px;font-size:0.8rem;}
  .lernen-label{display:block;font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;text-align:center;}
  .lernen-wort{font-size:1.9rem;font-weight:800;color:var(--text);text-align:center;line-height:1.25;overflow-wrap:anywhere;}
  .lernen-uebersetzung .lernen-wort{color:var(--haupt);}
  .lernen-info{font-size:0.95rem;color:var(--text2);text-align:center;line-height:1.4;}
  .lernen-info .lernen-label{margin-bottom:2px;}
  .lernen-trenner{height:1px;background:var(--rahmen);margin:8px 0;}
  .lernen-trenner.duenn{margin:8px 32px;opacity:.7;}
  .lernen-warte{text-align:center;color:var(--text3);font-size:1.6rem;letter-spacing:0.2em;min-height:2.4rem;}
  .lernen-steuerung{display:flex;gap:10px;margin-top:14px;}
  .lernen-steuerung .btn{flex:1;min-height:56px;font-size:1.4rem;}
  .lernen-regler{margin-top:14px;display:flex;flex-direction:column;gap:10px;}
  .lernen-regler-zeile{display:flex;align-items:center;gap:10px;font-size:0.85rem;font-weight:600;color:var(--text2);}
  .lernen-regler-zeile > span{min-width:96px;}
  .lernen-regler-zeile input[type=range]{flex:1;accent-color:var(--haupt);}
  .lernen-regler-zeile b{min-width:52px;text-align:right;color:var(--haupt);}
  .auswahl-nr{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;border-radius:10px;background:var(--gelb);color:var(--auf-gelb);font-size:0.72rem;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;box-sizing:border-box;z-index:2;}
  .listen-raster{display:grid;gap:6px;margin-bottom:16px;}
  .listen-raster .karte-zeile{background:var(--karte);border:1px solid var(--rahmen);border-radius:12px;min-width:0;}
  .listen-raster .karte-zeile:last-child{border-bottom:1px solid var(--rahmen);}
  .listen-raster.eng .karte-zeile{padding:10px 12px;gap:8px;}
  .listen-raster .raster-leer{min-height:56px;}
  .listen-raster.auswahl .quiz-setup-check{background:var(--karte);border:1px solid var(--rahmen);border-radius:12px;min-width:0;}
  .listen-raster.auswahl .quiz-setup-check:last-child{border-bottom:1px solid var(--rahmen);}
  .listen-raster.auswahl.eng .quiz-setup-check{padding:8px 10px !important;gap:8px;}
  .listen-raster.auswahl .quiz-setup-check > div:last-child{min-width:0;}
  .listen-raster.auswahl .raster-leer{min-height:0;}
  .raster-chip{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;min-height:44px;min-width:0;text-align:left;padding:6px 10px;}
  .raster-name{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .raster-fortschritt{font-size:0.68rem;font-weight:600;opacity:0.8;}
  .raster-fuss{display:flex;align-items:center;gap:6px;width:100%;margin-top:6px;min-height:14px;}
  .kachel-balken{flex:1;height:6px;border-radius:3px;background:var(--rahmen);overflow:hidden;}
  .kachel-balken > span{display:block;height:100%;background:var(--haupt-hell);border-radius:3px;}
  .kachel-balken.voll > span{background:var(--gelernt);}
  .kachel-voll{font-size:0.7rem;font-weight:900;color:var(--auf-gelernt);background:var(--gelernt);border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .raster-chip.aktiv-kachel{background:var(--haupt) !important;border-color:var(--haupt) !important;color:var(--auf-haupt) !important;}
  .raster-chip.aktiv-kachel.leuchten{background:var(--bestaetigen) !important;border-color:var(--bestaetigen) !important;color:var(--auf-bestaetigen) !important;}
  .raster-chip.aktiv-kachel .kachel-balken{background:rgba(255,255,255,0.35);}
  .raster-chip.aktiv-kachel .kachel-balken > span{background:var(--auf-haupt);}
  .mini-kreise{display:flex;gap:3px;}
  .mini-kreise > span{border-radius:50%;}
  .kopf-kreise{position:absolute;right:12px;gap:4px;}
  .raster-leer{min-height:44px;border:1.5px solid var(--rahmen);border-radius:8px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
  .slot-kopf-knoepfe .slot-chip{padding:2px 9px;font-size:0.7rem;}
  .score-badge{font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:10px;}
  .score-pos{background:var(--haupt-flaeche);color:var(--haupt);}
  .score-neg{background:var(--falsch-flaeche);color:var(--falsch);}
  .score-null{background:var(--rahmen);color:var(--text2);}
  .quiz-frage-box{background:var(--abfrage-karte);color:var(--abfrage-schrift);border:1px solid var(--rahmen);border-radius:14px;padding:20px;margin-bottom:14px;}
  .akzent-rahmen{container-type:inline-size;}
  .akzent-wort{--k:min(48px, calc((100cqw - (var(--n) - 1) * 4px) / var(--n)));display:flex;flex-wrap:wrap;justify-content:center;column-gap:calc(var(--k) * 0.6);row-gap:8px;margin-top:8px;}
  .akzent-wortgruppe{display:flex;gap:4px;}
  .akzent-kachel{box-sizing:border-box;width:var(--k);height:calc(var(--k) * 1.3);padding:0;border-radius:calc(var(--k) * 0.2);border:1.5px solid var(--text4);background:var(--karte);font-family:inherit;font-size:calc(var(--k) * 0.68);font-weight:700;color:var(--text-stark);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,border-color .15s;}
  .akzent-zaehler{text-align:center;font-size:0.85rem;font-weight:700;color:var(--text2);margin-top:2px;}
  .akzent-kachel.markiert{background:var(--gelb-flaeche);border-color:var(--gelb);}
  .akzent-kachel.aktiv{border:2.5px solid var(--text);background:var(--flaeche);}
  .akzent-kachel.ok{background:var(--haupt-zart);border-color:var(--haupt);color:var(--richtig-dunkel);}
  .akzent-kachel.falsch{background:var(--falsch-flaeche);border-color:var(--falsch);color:var(--falsch);}
  .akzent-kachel.loesung{background:var(--gelb-flaeche);border-color:var(--gelb);color:var(--haupt);}
  .akzent-kachel.blink{background:var(--falsch);border-color:var(--falsch);color:var(--auf-falsch);}
  .akzent-aktionen{width:100%;display:flex;flex-direction:column;align-items:center;gap:10px;}
  .akzent-pruefen{min-width:60%;padding:14px 28px;font-size:1.15rem;}
  .akzent-leiste{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:12px;padding:10px 6px;background:var(--haupt-flaeche);border-radius:12px;}
  .akzent-variante{min-width:48px;height:58px;border-radius:10px;border:1.5px solid var(--haupt);background:var(--karte);font-family:inherit;font-size:1.9rem;font-weight:700;color:var(--text-stark);cursor:pointer;}
  .wiederholung-karte{background:var(--gelb-flaeche);border:2px dashed var(--orange);text-align:center;}
  .wiederholung-marke{color:var(--orange);font-size:0.85rem;font-weight:700;}
  .quiz-label{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--abfrage-schrift-leise);margin-bottom:6px;}
  .quiz-frage-text{font-size:1.5rem;font-weight:700;line-height:1.3;}
  .quiz-info-text{font-size:0.85rem;color:var(--text2);margin-top:6px;}
  .quiz-antwort-box{background:var(--abfrage-karte);color:var(--abfrage-schrift);border:1.5px solid var(--rahmen);border-radius:14px;padding:18px;margin-bottom:14px;transition:border-color .2s,background .2s;min-height:120px;}
  .quiz-antwort-box.richtig{border-color:var(--haupt);background:var(--haupt-flaeche);}
  .quiz-antwort-box.falsch{border-color:var(--falsch);background:var(--falsch-flaeche);}
  .quiz-antwort-box.aufgedeckt{background:var(--gelb-flaeche);border-color:var(--gelb);}
  .quiz-antwort-box.weitere{border-color:var(--info);background:var(--info-flaeche);}
  .quiz-antwort-box.spalte-ok{border-color:var(--haupt);background:var(--haupt-flaeche);}
  .quiz-loesung-text{font-size:1.15rem;font-weight:600;margin-top:8px;}
  .quiz-feedback{font-size:0.88rem;font-weight:600;margin-top:6px;}
  .quiz-feedback.ok{color:var(--richtig-dunkel);}
  .quiz-feedback.nein{color:var(--falsch-dunkel);}
  .quiz-feedback.info{color:var(--info);}
  .quiz-fortschritt{font-size:0.82rem;color:var(--text2);}
  .quiz-aktionen{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;}
  .quiz-action-bar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:600px;background:var(--karte);border-top:1px solid var(--rahmen);padding:12px 16px 20px;display:flex;gap:10px;flex-wrap:wrap;z-index:20;}
  .quiz-liste-sticky{position:sticky;top:57px;background:var(--kopfzeile);color:var(--kopf-schrift);border-bottom:1px solid var(--rahmen);padding:8px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;z-index:9;}
  .vok-zeile{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--flaeche);cursor:pointer;}
  .vok-zeile:last-child{border-bottom:none;}
  .vok-zeile:active{background:var(--knopf);}
  .vok-nr{font-size:0.72rem;color:var(--text2);min-width:28px;text-align:right;flex-shrink:0;}
  .spalten-rolle-btn{font-size:0.72rem;font-weight:700;padding:4px 8px;border-radius:6px;border:1.5px solid var(--rahmen);background:var(--knopf);color:var(--text2);cursor:pointer;font-family:inherit;}
  .spalten-rolle-btn.frage{background:var(--haupt);color:var(--auf-haupt);border-color:var(--haupt);}
  .spalten-rolle-btn.antwort{background:var(--haupt);color:var(--auf-haupt);border-color:var(--haupt);}
  .spalten-rolle-btn.info{background:var(--gelb);color:var(--auf-gelb);border-color:var(--gelb);}
  .spalten-modus-btn{font-size:0.72rem;font-weight:700;padding:4px 8px;border-radius:6px;border:1.5px solid var(--rahmen);background:var(--knopf);color:var(--text2);cursor:pointer;font-family:inherit;}
  .spalten-modus-btn.aktiv{background:var(--haupt-hell);color:var(--auf-haupt-hell);border-color:var(--haupt-hell);}
  .quiz-vorig{background:var(--haupt-flaeche);border:1px solid var(--haupt-zart);border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:0.88rem;color:var(--haupt);}
  .quiz-vorig-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--haupt);margin-bottom:3px;}
  .quiz-vorig.nicht{background:var(--falsch-flaeche);border-color:var(--falsch-zart);color:var(--falsch-dunkel);}
  .quiz-vorig.nicht .quiz-vorig-label{color:var(--falsch);}
  .quiz-setup-check{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--rahmen);cursor:pointer;}
  .quiz-setup-check:last-child{border-bottom:none;}
  .checkbox{width:20px;height:20px;border-radius:5px;border:2px solid var(--rahmen);display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--knopf);}
  .checkbox.checked{background:var(--haupt);border-color:var(--haupt);color:var(--auf-haupt);}
  .liste-detail-header-name{flex:1;font-size:0.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .btn-toggle{background:var(--haupt);color:var(--auf-haupt);border:none;cursor:pointer;padding:6px 9px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
  .btn-toggle:active{opacity:.8;}
  .btn-toggle-ghost{background:var(--knopf);color:var(--haupt);border:1.5px solid var(--haupt);cursor:pointer;padding:5px 8px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
  .btn-toggle-ghost:active{opacity:.8;}
  .diktat-hint{font-size:1.8rem;font-weight:700;letter-spacing:0.2em;color:var(--haupt);margin:10px 0 6px;font-family:monospace;}
  .diktat-uebersetzung{font-size:0.85rem;color:var(--text2);margin-top:4px;}
  .diktat-play-btn{background:none;border:none;font-size:3rem;cursor:pointer;display:block;margin:8px auto;line-height:1;}
  .diktat-summary-zeile{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--flaeche);}
  .karte-bewertung{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;}
  .karte-btn{padding:22px 16px;border-radius:14px;font-size:1.05rem;font-weight:700;border:none;cursor:pointer;font-family:inherit;transition:opacity .15s;width:100%;}
  .karte-btn:active{opacity:.8;}
  .karte-btn-ja{background:var(--haupt);color:var(--auf-haupt);}
  .karte-btn-nein{background:var(--falsch);color:var(--auf-falsch);}
  .karte-aufdecken{text-align:center;padding:20px 0;color:var(--text3);font-size:0.9rem;font-style:italic;}
  .stimme-wechsel{position:absolute;top:6px;right:6px;z-index:2;border:1.5px solid var(--rahmen);background:var(--karte);border-radius:16px;padding:2px 8px;font-size:0.9rem;cursor:pointer;line-height:1.4;}
  .stimme-zeile{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.88rem;}
  .antwort-status{display:inline-flex;align-items:center;justify-content:center;width:1.6em;height:1.6em;border-radius:50%;margin-right:8px;font-size:0.95rem;font-weight:900;letter-spacing:0;line-height:1;}
  .antwort-status.richtig{background:var(--richtig);color:#fff;}
  .antwort-status.falsch{background:var(--falsch);color:#fff;}
  .antwort-status.aufgedeckt{background:var(--flaeche);font-size:0.85rem;}
  .satz-band{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;border-radius:12px;background:var(--flaeche);padding:10px;margin:4px 0 8px;max-width:100%;box-sizing:border-box;}
  .satz-wort{min-width:2.6em;max-width:100%;overflow-wrap:anywhere;border:1.5px solid var(--rahmen);background:var(--karte);border-radius:10px;padding:8px 10px;font-family:inherit;font-size:1.05rem;font-weight:700;color:var(--text-stark);cursor:pointer;}
  .satz-text{font-size:1.1rem;line-height:1.6;text-align:center;color:var(--abfrage-schrift, var(--text-stark));}
  .satz-gebaut{min-height:2.2em;border-bottom:2px solid var(--rahmen);margin-bottom:10px;}
  .satz-luecke{color:var(--haupt);font-weight:800;letter-spacing:1px;}
  .satz-ueb{text-align:center;font-size:0.85rem;color:var(--text2);margin-top:4px;}
  .satz-kachel{font-size:0.95rem;padding:0 10px;}
  .artikel-wort{text-align:center;font-size:1.5rem;font-weight:800;margin:4px 0 12px;color:var(--abfrage-schrift, var(--text-stark));}
  .hoer-symbol{font-size:2.6rem;line-height:1;display:inline-block;padding:6px 0;}
  .puzzle-zeile{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin:4px 0 10px;}
  .puzzle-feld{min-width:24px;height:34px;border-bottom:2.5px solid var(--haupt);display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:700;color:var(--abfrage-schrift, var(--text-stark));}
  .puzzle-feld.frei{border-bottom-color:var(--rahmen);}
  .puzzle-feld.fest{border-bottom-color:transparent;}
  .puzzle-feld.luecke-leer{min-width:12px;border-bottom-color:transparent;}
  .puzzle-kacheln{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;}
  .puzzle-kachel{min-width:40px;height:44px;border-radius:10px;border:1.5px solid var(--haupt);background:var(--knopf);color:var(--text-stark);font-family:inherit;font-size:1.15rem;font-weight:700;cursor:pointer;}
  .puzzle-kachel:disabled{opacity:0.25;cursor:default;}
  .zuo-zeit{height:8px;border-radius:4px;background:var(--flaeche);overflow:hidden;margin:4px 0 12px;}
  .zuo-zeit[data-zuo-zeit="aus"]{visibility:hidden;}
  .zuo-zeit-balken{height:100%;width:100%;transform-origin:left;animation-name:zuoZeit;animation-timing-function:linear;animation-fill-mode:forwards;}
  @keyframes zuoZeit{0%{transform:scaleX(1);background:var(--richtig);}60%{background:var(--richtig);}80%{background:var(--orange);}100%{transform:scaleX(0);background:var(--falsch);}}
  .zuo-raster{display:grid;gap:8px;}
  .memory-raster{display:grid;gap:8px;}
  .memory-karte{position:relative;min-height:64px;padding:6px;border-radius:12px;border:2px solid var(--haupt);background:var(--haupt);color:var(--auf-haupt);font-family:inherit;font-weight:700;line-height:1.2;overflow-wrap:anywhere;cursor:pointer;transition:background .2s,color .2s;}
  .memory-karte.auf{background:var(--abfrage-karte, var(--karte));color:var(--abfrage-schrift, var(--text-stark));border-color:var(--rahmen);}
  .memory-karte.falsch{border-color:var(--falsch);}
  .memory-rueck{font-size:1.4rem;opacity:0.7;}
  .zuo-ergebnis{display:flex;flex-direction:column;gap:8px;}
  .zuo-reihe{position:relative;border:2px solid var(--rahmen);border-radius:12px;padding:6px;animation:zuoEin .35s ease-out;}
  .zuo-reihe.richtig{border-color:var(--richtig);}
  .zuo-reihe.falsch{border-color:var(--falsch);background:var(--falsch-flaeche, transparent);}
  .zuo-reihe.offen{border-style:dashed;}
  .zuo-reihe .zuo-karte{min-height:40px;}
  .zuo-wahl{font-size:0.75rem;color:var(--falsch-dunkel, var(--falsch));margin:4px 4px 0;font-weight:600;}
  @keyframes zuoEin{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}
  .zuo-kopf{font-size:0.72rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .zuo-karte{position:relative;min-height:46px;padding:6px 6px;border-radius:10px;border:2px solid var(--rahmen);background:var(--abfrage-karte, var(--karte));color:var(--abfrage-schrift, var(--text));
    font-family:inherit;font-weight:600;line-height:1.2;overflow-wrap:anywhere;cursor:pointer;transition:background .15s,border-color .15s,opacity .3s;}
  .zuo-karte.wahl{border-color:var(--haupt);background:var(--haupt-flaeche);}
  .zuo-karte.ok,.zuo-karte.falsch-erl{cursor:default;}
  .zuo-karte.offen-geblieben{opacity:0.5;border-style:dashed;}
  .zuo-karte.blink{animation:zuoBlink .6s;}
  @keyframes zuoBlink{0%,100%{border-color:var(--rahmen);}30%,70%{border-color:var(--falsch);background:var(--falsch-zart, #fde2e2);}}
  .zuo-nr{position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;border-radius:9px;color:#fff;font-size:0.68rem;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;}
  .score-slider{-webkit-appearance:none;appearance:none;width:100%;height:30px;background:transparent;outline:none;cursor:pointer;}
  .score-slider::-webkit-slider-runnable-track{height:4px;background:var(--rahmen);border-radius:2px;}
  .score-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;background:var(--haupt);border-radius:6px;cursor:pointer;margin-top:-12px;}
  .score-slider::-moz-range-track{height:4px;background:var(--rahmen);border-radius:2px;}
  .score-slider::-moz-range-thumb{width:28px;height:28px;background:var(--haupt);border-radius:6px;cursor:pointer;border:none;}
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
const IcoCopy    = ({s=15}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><rect x="5" y="1" width="10" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="1" y="4" width="10" height="11" rx="2" fill={fv("var(--karte)")} stroke="currentColor" strokeWidth="2"/></svg>;
const IcoExpand  = ({s=16}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><polyline points="1,6 1,1 6,1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="6.5" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="10,1 15,1 15,6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="15" y1="1" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="1,10 1,15 6,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="15" x2="6.5" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15,10 15,15 10,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="15" y1="15" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const IcoCollapse= ({s=16}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><polyline points="1,6 6,6 6,1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="6" x2="0.5" y2="0.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15,6 10,6 10,1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="6" x2="15.5" y2="0.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="1,10 6,10 6,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="10" x2="0.5" y2="15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15,10 10,10 10,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="10" x2="15.5" y2="15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;

export default function VokabelApp() {
  const [tab, setTab] = useState("quiz");
  const [listenIndex, setListenIndex] = useState([]);
  const [einstellungen, setEinstellungen] = useState(defaultEinstellungen());
  const [schemaBearbeiten, setSchemaBearbeiten] = useState(null);   // id des eigenen Schemas im Editor
  // Farbmodus: Farben direkt am Element ändern (Vorschau bis „Farben übernehmen“)
  const [farbModus, setFarbModus] = useState(false);
  const [farbVorschau, setFarbVorschau] = useState(null);           // Grundfarben während des Farbmodus
  const [elementVorschau, setElementVorschau] = useState(null);     // Element-Farben während des Farbmodus
  const [farbFeld, setFarbFeld] = useState(null);                   // {gruppen, zeit} nach langem Druck
  const [farbMarke, setFarbMarke] = useState(null);                 // Rechteck des hervorgehobenen Elements
  const [farbName, setFarbName] = useState(null);                   // Name beim Übernehmen einer Vorlage
  const farbModusRef = useRef(false);
  const [farbRad, setFarbRad] = useState(null);
  const [klammerZiel, setKlammerZiel] = useState("i1");                // Aufräum-Werkzeug: Ziel-Info-Spalte                     // {rolle, titel, start, basis, ziel: "vorschau"|schemaId}
  farbModusRef.current = farbModus;
  const [schemaMenueId, setSchemaMenueId] = useState(null);         // Schema für Umbenennen / Löschen
  // Farbschema: Farben je Rolle (CSS-Variablen + F für SVG); vor dem Laden der Einstellungen aus dem Speicher
  const farbSchema = schemaVon(einstellungen.farbschema || einstellungen.eigeneSchemata ? einstellungen : lsGet(SK.einstellungen, {}));
  F = farbenAus(farbModus && farbVorschau ? farbVorschau : farbSchema.farben);
  CSS = farbVariablen(F, farbSchema.dunkel) + CSS_BASIS + elementCSS(farbModus && elementVorschau ? elementVorschau : farbSchema.elemente);
  setzeFarbeImMenue(einstellungen.farbeImMenue !== false && !farbModus);
  ANTWORT_GEWICHTE = { ...STANDARD_ANTWORT_GEWICHTE, ...(einstellungen.antwortGewichte || {}) };
  useEffect(() => { setzeSystemLeiste(F.leiste); });
  const [infoModus, setInfoModus] = useState("uebersicht");
  const [ansicht, setAnsicht] = useState("uebersicht");
  const [aktiveListeId, setAktiveListeId] = useState(null);
  const [aktiveListe, setAktiveListe] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalInput, setModalInput] = useState("");
  const [modalMitVokabeln, setModalMitVokabeln] = useState(false);
  const [modalFehler, setModalFehler] = useState("");
  const [jsonExportIds, setJsonExportIds] = useState(null);
  const [exportName, setExportName] = useState("");        // Dateiname im Export-Fenster (ohne .txt)
  const [dateiExport, setDateiExport] = useState(null);    // TXT oder Gesamtsicherung: { art: "txt", ids } | { art: "sicherung" }
  const [jsonExportOptionen, setJsonExportOptionen] = useState({ fortschritt: true, diktatFortschritt: true, akzentFortschritt: true, falsch: true });
  const [editSpalteTyp, setEditSpalteTyp] = useState(null);

  const [bearbeiteVokabel, setBearbeiteVokabel] = useState(null);
  const [bearbeiteEingaben, setBearbeiteEingaben] = useState({});
  const [bearbeiteListe, setBearbeiteListe] = useState(null);   // Liste der bearbeiteten Vokabel (Listen, Statistik, Abfrage)
  const [bearbeiteNur, setBearbeiteNur] = useState(null);       // Abfrage: nur diese Spalte (richtige Antwort), ohne falsche Antworten
  const [bearbeiteFalsch, setBearbeiteFalsch] = useState(null);
  const [neueSessionSchritt, setNeueSessionSchritt] = useState("art");
  const [slotOrdner, setSlotOrdner] = useState(null);            // geöffnete Session-Gruppe (Quiz- und Statistik-Tab)
  const slotOrdnerRef = useRef(null); slotOrdnerRef.current = slotOrdner;
  const [inGruppe, setInGruppe] = useState(null);                // Dialog „In Gruppe…“: { ids, name }
  const [ordnerUmbenennen, setOrdnerUmbenennen] = useState(null); // { id, name }   // Dialog „Neue Session aus Listen“: art | liste // Abfrage (MC): diese falsche Antwort der Spalte bearbeiteNur
  const [mergeQuelleId, setMergeQuelleId] = useState("");

  const [importText, setImportText] = useState("");
  const [importDateiname, setImportDateiname] = useState("");
  const [importParsed, setImportParsed] = useState(null);
  const [importMehrfachListen, setImportMehrfachListen] = useState(null);
  const [importJsonData, setImportJsonData] = useState(null);
  const [speicherDauerhaft, setSpeicherDauerhaft] = useState(null);   // navigator.storage.persisted(): null = unbekannt
  const [letzteSicherung, setLetzteSicherung] = useState(() => lsGet(SK.letzteSicherung));
  const [sicherungLaden, setSicherungLaden] = useState(null);         // geladene Gesamtsicherung, wartet auf Bestätigung
  const [sicherungFehler, setSicherungFehler] = useState("");
  const [sicherungSpaeter, setSicherungSpaeter] = useState(() => lsGet(SK.sicherungSpaeter, 0));
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
  const [quizArt, setQuizArt] = useState("uebersetzung");      // Abfrageart: uebersetzung / diktat / akzente (Ü|D|A)
  const [quizArtStash, setQuizArtStash] = useState({});        // Einstellungen der gerade nicht gewählten Arten
  const [quizModusInfoAufgeklappt, setQuizModusInfoAufgeklappt] = useState(false);
  const [quizAbfrageModusAufgeklappt, setQuizAbfrageModusAufgeklappt] = useState(false);
  const [quizReihenfolgeAufgeklappt, setQuizReihenfolgeAufgeklappt] = useState(false);
  const [quizStufeAufgeklappt, setQuizStufeAufgeklappt] = useState(false);   // Stufe: Lernen | Leicht | Schwer + Regeln
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
  const [kopierExportIds, setKopierExportIds] = useState(null);   // Export-Fenster „Kopieren“
  const [satzFenster, setSatzFenster] = useState(null);   // { listeId, antwort, meldung }
  const [listenSaetze, setListenSaetze] = useState({ listeId: null, saetze: {} });   // Beispielsätze der geöffneten Liste
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
  // Lang-Druck auf eine Vokabel startet Von–Bis (sie ist der Anfang); die Tafel unten bleibt offen, bis das Ende angetippt ist
  const vonBisTafelRef = useRef(null);   // "quiz" | "statistik" | null
  useEffect(() => {
    const art = vonBisTafelRef.current;
    if ((art === "quiz" && !quizVonBisModus) || (art === "statistik" && !statistikVonBisModus)) { vonBisTafelRef.current = null; schliesseInfo(); }
  }, [quizVonBisModus, statistikVonBisModus]);
  useEffect(() => {
    if (quizVonBisErster == null || !sucheQuiz.text) return;
    setSucheQuiz(x => ({ ...x, text: "", nr: 0 }));
  }, [quizVonBisErster]);
  useEffect(() => {
    if (statistikVonBisErster == null || !sucheStatistik.text) return;
    setSucheStatistik(x => ({ ...x, text: "", nr: 0 }));
  }, [statistikVonBisErster]);
  const [statistikVokauswahlH, setStatistikVokauswahlH] = useState(0);
  const [slots, setSlots] = useState(defaultSlots());          // {verlauf:[], gespeichert:[]}
  const [aktiverSlot, setAktiverSlot] = useState(null);        // {typ:"verlauf"|"gespeichert", id:string} | null
  const [slotGeaendert, setSlotGeaendert] = useState(false);   // ob Einstellungen seit Laden geändert
  const [statistikAktiverSlot, setStatistikAktiverSlot] = useState(null); // separater Slot-Zustand für Statistik-Tab
  const [statistikSlotGeleert, setStatistikSlotGeleert] = useState(false);  // true wenn Slot durch Listen-Wechsel geleert
  const [quizSessionModus, setQuizSessionModus] = useState(STANDARD_SESSION_MODUS);
  const [quizPaketGroesse, setQuizPaketGroesse] = useState(STANDARD_PAKET_GROESSE);
  const [quizSessionAufgeklappt, setQuizSessionAufgeklappt] = useState(false);
  // Gespeicherte Konfiguration geladen: Listen-/Vokabel-Auswahl ausgeblendet – außer nach „Listen/Vokabeln ändern“
  const [listenAendern, setListenAendern] = useState(false);
  const [multiAuswahl, setMultiAuswahl] = useState(null);   // Multiquiz: gewählte Kacheln (Reihenfolge = Nummern), null = aus
  const [multiStart, setMultiStart] = useState(null);
  const slotZuTimerRef = useRef(null);   // Auswahl klappt nach dem Laden kurz verzögert zu (neue Kachel sichtbar markiert)       // Verlauf-Id des eben gebildeten Multiquiz – startet nach dem Laden
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
  const [slotAuswahl, setSlotAuswahl] = useState([]);         // im Verschieben-Modus markiert (Reihenfolge = Nummern)
  const [slotDragZiel, setSlotDragZiel] = useState(null);     // "z|s" unter dem Finger
  const slotZiehenRef = useRef(null);                         // {id, x, y, aktiv, art: "liste" für das Listen-Raster}
  const [listenSortModus, setListenSortModus] = useState(false);   // "Verschieben"-Modus des Listen-Rasters
  const [listenAuswahl, setListenAuswahl] = useState([]);          // im Verschieben-Modus markiert
  // Auswahl-Modus (Lang-Druck → „☑ Auswählen“): antippen wählt, Lang-Druck zeigt die Aktionen für die Auswahl.
  // Listen: listenWahl; Konfigurationen: multiAuswahl (Reihenfolge = Nummern); null = aus
  const [listenWahl, setListenWahl] = useState(null);
  const [auswahlLoeschen, setAuswahlLoeschen] = useState(null);     // { art: "slot" | "liste", ids } wartet auf Bestätigung
  const rasterAuswahlRef = useRef({ slot: [], liste: [] });          // für die Zieh-Logik (Effekte ohne Abhängigkeiten)
  rasterAuswahlRef.current = { slot: slotAuswahl, liste: listenAuswahl, slotWahl: multiAuswahl, listeWahl: listenWahl };
  const [listeMenueId, setListeMenueId] = useState(null);          // Liste aus dem Lang-Druck-Menü (Umbenennen, Duplizieren, Zurücksetzen, Löschen)
  const [zuruecksetzenArten, setZuruecksetzenArten] = useState(new Set(Object.keys(SCORE_FELD)));
  // Liste in Sessions aufteilen (Quiz-Tab): { listeId, name, groesse, von, bis, restAnhaengen }
  const [aufteilen, setAufteilen] = useState(null);
  // Vokabel-Suche je Stelle: { text, nr (aktueller Treffer), nurTreffer }; Aufteilen: { feld: "von"|"bis", text } oder null
  const [sucheQuiz, setSucheQuiz] = useState(SUCHE_LEER);
  const [sucheStatistik, setSucheStatistik] = useState(SUCHE_LEER);
  const [sucheListe, setSucheListe] = useState(SUCHE_LEER);
  const [aufteilenSuche, setAufteilenSuche] = useState(null);
  const listeDetailKopfRef = useRef(null);
  const [listeDetailKopfH, setListeDetailKopfH] = useState(48);
  const slotGezogenRef = useRef(false);                       // Klick nach dem Ziehen schlucken
  // Auswahl-Tafel (Lang-Druck auf eine Kachel): bleibt unten offen, weitere Kacheln antippen wählt mit aus
  const auswahlTafelRef = useRef(null);                       // "slot" | "liste" solange offen
  const auswahlTafelDaten = useRef({});                       // je Art: () => { text, aktionen } aus dem letzten Render
  const [gruppenZiel, setGruppenZiel] = useState(null);       // "z|s": lange genug darüber gehalten – Loslassen bildet eine Gruppe
  const gruppenZielRef = useRef(null);
  const lassoRef = useRef(null);                              // Lang-Druck auf freie Stelle + ziehen: Kacheln einsammeln
  const [lasso, setLasso] = useState(null);
  const kachelGesteRef = useRef(null);                        // Haltestufen auf einer Kachel (Touch)
  const [angehoben, setAngehoben] = useState(null);           // Id der angehobenen Kachel (bereit zum Ziehen)
  const auswahlTafelStelle = useRef(null);                    // { x, y } für „🎨 Farbe ändern“, wenn die Tafel nach dem Einsammeln aufgeht                   // { art, ids } während des Einsammelns (erst beim Loslassen übernommen – Raster springt nicht)
  // Rückfrage "Abgefragt-Stand löschen?" in der Fortschrittszeile; ohne Antwort nach 6 s wieder weg
  const [sessionResetFrage, setSessionResetFrage] = useState(false);
  const [lernResetFrage, setLernResetFrage] = useState(false);
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
  const [lernen, setLernen] = useState(null);
  const quizStufeRef = useRef(null);   // Stufe der laufenden Runde, falls abweichend ("lernen": Quiz nach dem Lernen)   // Lernen-Film: { voks, index, phase 0|1, pausiert, fertig, lauf, zuerst, danach, info, liste }
  const [diktatListeAufgeklappt, setDiktatListeAufgeklappt] = useState(false);
  const [vokabelAufgeklappt, setVokabelAufgeklappt] = useState(false);
  const [ansichtSpaltenAn, setAnsichtSpaltenAn] = useState(() => lsGet(SK.ansichtSpalten, {}));
  const [statistikListeZu, setStatistikListeZu] = useState(() => lsGet(SK.statistikListeZu, true) !== false);
  const [diktatManualPlays, setDiktatManualPlays] = useState(0);
  const [quizTabListen, setQuizTabListen] = useState([]);
  const [listenAuswahlAufgeklappt, setListenAuswahlAufgeklappt] = useState(false);   // ohne gewählte Liste öffnet sie der Effekt unten
  const eingabeRef = useRef(null);
  const flashTimerRef = useRef(null);
  const flashWeiterRef = useRef(null);   // was nach der Verzögerung passiert (Antippen beendet sie sofort)
  const akzentBlinkRef = useRef(null);
  const diktatPlayCountRef = useRef(0);
  const fileInputRef = useRef(null);
  const sicherungInputRef = useRef(null);
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
  const [einstBereich, setEinstBereich] = useState(null);
  const [farbTab, setFarbTab] = useState(null);   // Einstellungen › Farben: vorlagen | eigene | werkzeuge
  const [stimmenWahl, setStimmenWahlState] = useState(STIMMEN_WAHL);   // Einstellungen › Stimmen
  const [, setStimmenGeladen] = useState(0);
  useEffect(() => {
    const s = window.speechSynthesis; if (!s?.addEventListener) return;
    const neu = () => setStimmenGeladen(n => n + 1);
    s.addEventListener("voiceschanged", neu);
    return () => s.removeEventListener("voiceschanged", neu);
  }, []);
  const aendereStimmen = neu => { setzeStimmenWahl(neu); setStimmenWahlState(neu); };
  function wechsleStimme(text, lang) {
    const v = naechsteStimme(normLang(lang).split("-")[0]);
    setStimmenWahlState(STIMMEN_WAHL);
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(aeusserung(text.split('/')[0].trim(), lang, v));
  }   // Einstellungen: aufgeklappter Bereich (immer nur einer)
  const infoKontextContainerRef = useRef(null);
  const tooltipTimer = useRef(null);
  const tooltipShown = useRef(false);
  const tooltipStart = useRef(null);   // Fingerposition beim Aufsetzen: kleine Bewegungen brechen den langen Druck nicht ab
  // Erklärtext: Maus = title; Touch = lange drücken → Info-Tafel (bleibt bis Antippen, InfoTafel.jsx);
  // data-info macht das Element im Info-Modus erklärbar
  // aktionen (optional): Lang-Druck bzw. Rechtsklick zeigt die Erklärung mit Menü-Knöpfen darunter
  // opts.langText: anderer Text für den Lang-Druck (z. B. nur der volle Name); opts.beimZeigen(x, y): Rückruf;
  // opts.auswahl: als Auswahl-Tafel zeigen (siehe infoEreignisse.js); opts.eigeneGeste: Touch-Lang-Druck übernimmt die Kachel-Geste
  function tt(text, aktionen, opts = {}) {
    if (!text) return {};
    const langText = opts.langText || text;
    return {
      // Rechtsklick = langer Druck: Menü bzw. Erklärung (mit „🎨 Farbe ändern“)
      // verschachtelt: ein inneres Element mit eigenem Menü hat Vorrang vor dem äußeren (sonst gewinnt wie bisher das äußere)
      onContextMenu(e) { e.preventDefault(); if (e.nativeEvent._ttMenue) return; if (aktionen) e.nativeEvent._ttMenue = true;
        if (aktionen) opts.beimMenue?.(); zeigeInfo(langText, e.clientX, e.clientY, aktionen, { ...(opts.auswahl ? { auswahl: opts.auswahl } : {}), ...(opts.regler ? { regler: opts.regler() } : {}) }); },
      title: text,
      "data-info": text,
      onTouchStart(e) {
        if (e.nativeEvent._ttMenue) return;
        if (aktionen) e.nativeEvent._ttMenue = true;
        if (opts.eigeneGeste) return;   // Kacheln: Haltestufen (Verschieben / Auswählen) statt Erklärung
        const t = e.touches[0];
        tooltipStart.current = { x: t.clientX, y: t.clientY };
        clearTimeout(tooltipTimer.current);
        tooltipShown.current = false;
        tooltipTimer.current = setTimeout(() => {
          if (slotZiehenRef.current?.aktiv) return;   // beim Verschieben im Raster keine Erklärung einblenden
          if (farbModusRef.current) return;            // Farbmodus: langer Druck öffnet das Farbfeld
          tooltipShown.current = true; zeigeInfo(langText, t.clientX, t.clientY, aktionen, { ...(opts.auswahl ? { auswahl: opts.auswahl } : {}), ...(opts.regler ? { regler: opts.regler() } : {}) });
          if (aktionen) opts.beimMenue?.();
          opts.beimZeigen?.(t.clientX, t.clientY);
        }, 500);
      },
      onTouchEnd(e)   { clearTimeout(tooltipTimer.current); if (tooltipShown.current) { e.preventDefault(); tooltipShown.current = false; } },
      onTouchMove(e)  {   // erst ab 10 px Bewegung abbrechen (Finger zittert); Finger zittert nach dem Aufgehen: Tafel bleibt
        const t = e.touches[0], st = tooltipStart.current;
        if (!t || !st || Math.hypot(t.clientX - st.x, t.clientY - st.y) > 10) clearTimeout(tooltipTimer.current);
      },
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
  // Bereich-Modus mit offener Vokabelliste: nur Kopfzeile, „Alle | Bereich“ und die Liste – der Rest der Session ist ausgeblendet
  // (früh berechnet: Closures wie kontexteRef lesen es auch nach Renders, die vorzeitig zurückkehren)
  const quizVokMax = tab === "quiz" && quizTabListen.length > 0 && quizListeAufgeklappt && quizBereichTyp === "bereich"
    && !aufteilen && !slotSektionAufgeklappt;
  // sichtbarer Ausschnitt (iOS: mit Tastatur kleiner und ggf. verschoben) – die maximierte Liste liegt fest darin
  const [sichtFenster, setSichtFenster] = useState(null);
  useEffect(() => {
    if (!quizVokMax) { setSichtFenster(null); return; }
    const vv = window.visualViewport;
    const neu = () => setSichtFenster({ top: vv ? vv.offsetTop : 0, h: vv ? vv.height : window.innerHeight });
    window.scrollTo(0, 0);
    neu();
    vv?.addEventListener("resize", neu); vv?.addEventListener("scroll", neu); window.addEventListener("resize", neu);
    return () => { vv?.removeEventListener("resize", neu); vv?.removeEventListener("scroll", neu); window.removeEventListener("resize", neu); };
  }, [quizVokMax]);
  const maxFenster = quizVokMax && sichtFenster;
  const maxSpalte = { left: "max(0px, calc(50% - 300px))", width: "min(100%, 600px)", margin: 0, boxSizing: "border-box" };   // wie .app (max. 600 px, mittig)
  // Listen-Auswahl: ohne gewählte Liste immer offen (rechts nur ein Hinweis statt Knopf)
  const listenOffen = listenAuswahlAufgeklappt || quizTabListen.length === 0;
  // Quiz-Fokus: ein offener Bereich zeigt nur seine Überschrift (klebt unter der Session-Leiste) und seinen Inhalt;
  // zu nur über die Überschrift (kein Zuklappen beim Weiterscrollen). Ohne offenen Bereich scrollt alles unter der Session-Leiste.
  const quizListenSichtbar = !(aktiverSlot?.typ === "gespeichert" && !listenAendern);
  const quizFokus = tab !== "quiz" || slotSektionAufgeklappt || quizTabListen.length === 0 || aufteilen ? null
    : quizListenSichtbar && listenOffen ? "listen"
    : quizVokMax ? "einzel"
    : quizAbfrageModusAufgeklappt || quizReihenfolgeAufgeklappt || quizStufeAufgeklappt ? "zeile1"
    : quizSessionAufgeklappt ? "zeile2" : null;
  const fokusZeigt = k => !quizFokus || quizFokus === k;
  // Zuklappen (Wahl übernommen bzw. „Bestätigen“): der Knopf leuchtet kurz in der Bestätigen-Farbe – nicht, wenn ein anderer Bereich aufgeht
  const offenerKnopf = quizStufeAufgeklappt ? "stufe" : quizAbfrageModusAufgeklappt ? "modus" : quizReihenfolgeAufgeklappt ? "reihenfolge"
    : quizSessionAufgeklappt === "umfang" ? "umfang" : quizSessionAufgeklappt === "ziel" ? "ziel" : null;
  const vorigerKnopfRef = useRef(null);
  // Kurzes Aufleuchten in der Bestätigen-Farbe – schaltet sofort an und aus (keine Überblendung)
  const [blitz, setBlitz] = useState({});
  const blitzTimer = useRef({});
  const leuchte = k => {
    clearTimeout(blitzTimer.current[k]);
    setBlitz(b => ({ ...b, [k]: true }));
    blitzTimer.current[k] = setTimeout(() => setBlitz(b => { const n = { ...b }; delete n[k]; return n; }), BLITZ_MS);
  };
  const blitzt = k => blitz[k] ? " leuchten" : "";
  useEffect(() => {
    const vorher = vorigerKnopfRef.current;
    vorigerKnopfRef.current = offenerKnopf;
    if (!vorher || offenerKnopf) return;
    leuchte(vorher);
  }, [offenerKnopf]);   // eslint-disable-line react-hooks/exhaustive-deps
  const leuchtet = k => blitz[k] && !offenerKnopf ? " leuchten" : "";
  useEffect(() => { if (tab === "quiz") window.scrollTo(0, 0); }, [quizFokus]);   // Bereich auf/zu: von oben
  kontexteRef.current = () => {
    const q = headerH + slotH + listenauswahlHeaderH;
    return [
      ["slot",      slotContainerRef,            headerH + slotH,                         () => setSlotSektionAufgeklappt(false)],
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
  }, [quizTabListen.length, aktiverSlot, listenAendern, tab, quizFokus]);   // Fokus: Zeile wird neu eingehängt
  // Lernen: aktuelle Seite (Wort bzw. Übersetzung) ggf. vorlesen, danach die eingestellte Pause, dann weiter
  useEffect(() => {
    if (!lernen || lernen.pausiert || lernen.fertig) return;
    const v = lernen.voks[lernen.index];
    if (!v) return;
    const le = lernEinstellungen();
    // Abschnitte: 0 Wort, 1 Übersetzung, 2 Zusatzinfo – danach jeweils Lese-/Vorlesezeit plus Pause
    const spalten = lernen.phase === 0 ? lernen.zuerst : lernen.phase === 1 ? lernen.danach : lernen.info;
    const infoLang = le.infoSprache === "deutsch" ? "de-DE" : vokLang(v, "E1");
    const texte = spalten.filter(t => v[t]?.wert).map(t => [lernen.phase === 2 ? v[t].wert : v[t].wert.split('/')[0].trim(), lernen.phase === 2 ? infoLang : vokLang(v, t)]);
    const pauseS = lernPause(lernen, v);
    const pause = pauseS * 1000;
    const vorlesen = lernen.phase === 0 ? le.vorlesen1 : lernen.phase === 1 ? le.vorlesen2 : le.vorlesen3;
    let timer = null, aus = false;
    const warte = ms => { if (pauseS < LERNEN_TIPPEN) timer = setTimeout(() => { if (!aus) lernenWeiter(); }, ms); };
    if (!(vorlesen && texte.length && window.speechSynthesis)) {
      warte((texte.length ? lernLesezeit(texte.map(x => x[0]).join(" ")) : 0) + pause);
    } else {
      window.speechSynthesis.cancel();
      texte.forEach(([t, l]) => window.speechSynthesis.speak(aeusserung(t, l)));
      // Pause erst nach dem Vorlesen (Sicherung: höchstens 15 s warten)
      const start = Date.now();
      const pruefe = () => { if (aus) return; if (window.speechSynthesis.speaking && Date.now() - start < 15000) timer = setTimeout(pruefe, 150); else warte(pause); };
      timer = setTimeout(pruefe, 300);
    }
    return () => { aus = true; clearTimeout(timer); window.speechSynthesis?.cancel(); };
  }, [lernen?.lauf, lernen?.index, lernen?.phase, lernen?.pausiert, lernen?.fertig]);

  // Statistik auf Akzente, aber die Akzente sind für keine Sprache der Auswahl eingeschaltet → Übersetzung
  useEffect(() => {
    if (statistikArt === "akzente" && !statistikGefilterteVoks.some(v => AKZENTE_FUER_LISTE(v._listeId))) setStatistikArt("uebersetzung");
  }, [statistikArt, statistikListenIds, statistikCheckboxAuswahl, einstellungen.akzenteSprachen]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Akzente für die gewählten Listen ausgeschaltet (oder keine Wörter mit Akzent) → Abfrageart A gibt es nicht
  useEffect(() => {
    if (quizArt !== "akzente" || !quizKombiListe) return;
    if (!quizKombiListe.vokabeln.some(v => hatAkzentWort(v))) wechsleQuizArt("uebersetzung");
  }, [quizArt, quizTabListen, einstellungen.akzenteSprachen]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Lernstand mitschreiben (Lernen schließen = pausieren; „Weiter lernen“ macht an derselben Stelle weiter)
  useEffect(() => {
    if (!lernen?.slot) return;
    const ende = lernen.fertig && lernen.start + lernen.voks.length >= lernen.alle.length;
    setzeLernStand(lernen.slot, lernen.art, ende ? null : { ids: lernen.alle.map(v => v.id), groesse: lernen.groesse, start: lernen.start,
      index: lernen.index, fertig: !!lernen.fertig, quizGemacht: !!lernen.quizGemacht, zeit: Date.now() });
  }, [lernen?.start, lernen?.index, lernen?.fertig, lernen?.quizGemacht]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Multiquiz: erst laden (Einstellungen stehen dann im State), dann ggf. starten
  useEffect(() => {
    if (!multiStart || aktiverSlot?.id !== multiStart.id) return;
    const { id, starten } = multiStart;
    setMultiStart(null);
    // Konfiguration so ablegen, wie der Quiz-Tab sie bildet – sonst legt die Runde einen weiteren Verlauf-Eintrag an
    const data = getSlotsData();
    setSlotsData({ ...data, verlauf: data.verlauf.map(v => v.id === id ? { ...v, konfiguration: aktuelleKonfiguration() } : v) });
    if (starten) starteQuiz(false, { typ: 'verlauf', id });
  }, [multiStart, aktiverSlot]);

  // App-Start: zuletzt gewählte gespeicherte Konfiguration wieder laden (sobald die Listen bekannt sind)
  const letzterSlotGeladenRef = useRef(false);
  useEffect(() => {
    if (letzterSlotGeladenRef.current || listenIndex.length === 0) return;
    letzterSlotGeladenRef.current = true;
    const id = lsGet(SK.letzterSlot);
    if (id && getSlotEintrag('gespeichert', id)) ladeSlot('gespeichert', id);
  }, [listenIndex]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Wechsel der Abfrageart (Übersetzung / Diktat / Akzente) → Session-Fortschritt dieser Art laden
  const quizAbfrageArt = quizArt;
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
  }, [quizTabListen.length, quizFokus]);

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
  }, [quizTabListen.length, quizFokus]);

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
  }, [tab, quizTabListen.length, aktiverSlot, listenAendern]);


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
    const el = listeDetailKopfRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setListeDetailKopfH(el.offsetHeight));
    obs.observe(el);
    setListeDetailKopfH(el.offsetHeight);
    return () => obs.disconnect();
  }, [tab, ansicht]);
  useEffect(() => { setSucheListe(x => ({ ...SUCHE_LEER, nurTreffer: x.nurTreffer })); }, [aktiveListeId]);
  useEffect(() => { if (!aufteilen) setAufteilenSuche(null); }, [aufteilen]);

  useEffect(() => {
    const el = statistikVokauswahlRef.current;
    if (!el) { setStatistikVokauswahlH(0); return; }
    const obs = new ResizeObserver(() => setStatistikVokauswahlH(el.offsetHeight));
    obs.observe(el);
    setStatistikVokauswahlH(el.offsetHeight);
    return () => obs.disconnect();
  }, [tab, statistikVollbild]);


  // Browser bitten, den Speicher nicht aufzuräumen (Chrome: bei installierter App meist gewährt)
  useEffect(() => {
    const st = navigator.storage;
    if (!st?.persisted) return;
    st.persisted().then(ja => ja || !st.persist ? ja : st.persist()).then(setSpeicherDauerhaft).catch(() => {});
    if (!lsGet(SK.letzteSicherung) && !lsGet(SK.sicherungBasis)) lsSet(SK.sicherungBasis, Date.now());
  }, []);

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
    const zelleUnter = t => zielUnter(t.clientX, t.clientY);
    const bewegen = e => {
      const d = slotZiehenRef.current;
      if (!d?.langdruck) return;
      const t = e.touches[0];
      if (!d.aktiv && Math.hypot(t.clientX - d.x, t.clientY - d.y) > 8) {
        d.aktiv = true;
        clearTimeout(tooltipTimer.current); tooltipShown.current = false; schliesseInfo();
        const r = rasterAuswahlRef.current;
        if (d.art === "liste") {
          setListenSortModus(true);
          if (r.listeWahl) { setListenAuswahl(r.listeWahl.includes(d.id) ? r.listeWahl : [...r.listeWahl, d.id]); setListenWahl(null); }
          else if (!r.liste.includes(d.id)) setListenAuswahl([]);
        } else {
          setSlotSortModus(true);
          if (r.slotWahl) { setSlotAuswahl(r.slotWahl.includes(d.id) ? r.slotWahl : [...r.slotWahl, d.id]); setMultiAuswahl(null); }
          else if (!r.slot.includes(d.id)) setSlotAuswahl([]);
        }
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
      if (ziel) legeGezogenAb(d, ziel);
      // per Geste verschoben: Verschieben-Modus wieder aus (über das Menü „⇄ Verschieben“ bleibt er bis „Fertig“)
      if (d.art === "liste") { setListenSortModus(false); setListenAuswahl([]); } else { setSlotSortModus(false); setSlotAuswahl([]); }
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
    const zelleUnter = e => zielUnter(e.clientX, e.clientY);
    const bewegen = e => {
      const d = slotZiehenRef.current;
      if (!d || d.langdruck) return;   // Lang-Druck-Zug läuft über die Touch-Verfolgung
      if (!d.aktiv && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
        d.aktiv = true; setSlotDragId(d.id);
        const ausw = rasterAuswahlRef.current[d.art === "liste" ? "liste" : "slot"];
        if (!ausw.includes(d.id)) { setSlotAuswahl([]); setListenAuswahl([]); }
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
      if (ziel) legeGezogenAb(d, ziel);
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

  // Beim Ziehen über einer anderen Session oder Gruppe verweilen: nach 1,2 s bildet Loslassen eine Gruppe
  // (nur auf der obersten Ebene; Gruppen selbst lassen sich nicht in Gruppen legen)
  useEffect(() => {
    gruppenZielRef.current = null; setGruppenZiel(null);
    if (!slotDragId || !slotDragZiel || slotDragZiel === "raus" || slotZiehenRef.current?.art === "liste" || slotOrdnerRef.current) return;
    const el = document.querySelector(`[data-raster-zelle="${slotDragZiel}"][data-slot-id]`);
    const ordnerIds = new Set((getSlotsData().ordner || []).map(o => o.id));
    const ausw = rasterAuswahlRef.current.slot;
    const ids = ausw.includes(slotDragId) ? ausw : [slotDragId];
    if (!el || ids.includes(el.dataset.slotId) || ids.some(id => ordnerIds.has(id))) return;
    const ziel = slotDragZiel;
    const t = setTimeout(() => { gruppenZielRef.current = ziel; setGruppenZiel(ziel); navigator.vibrate?.(30); }, GRUPPE_VERWEILEN_MS);
    return () => clearTimeout(t);
  }, [slotDragZiel, slotDragId]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Auswahl-Tafel aktuell halten (Inhalt hängt an der Auswahl); Auswahl beendet → Tafel zu
  useEffect(() => {
    const art = auswahlTafelRef.current;
    if (!art) return;
    if (!(art === "liste" ? listenWahl : multiAuswahl)) { auswahlTafelRef.current = null; auswahlTafelStelle.current = null; schliesseInfo(); return; }
    zeigeAuswahlTafel(art);
  }, [multiAuswahl, listenWahl]);   // eslint-disable-line react-hooks/exhaustive-deps

  // geöffnete Gruppe gibt es nicht mehr (aufgelöst) → zurück auf die oberste Ebene
  useEffect(() => {
    if (slotOrdner && !(slots.ordner || []).some(o => o.id === slotOrdner)) setSlotOrdner(null);
  }, [slots, slotOrdner]);
  // Geladene gespeicherte Session im Raster zeigen: beim Öffnen der Auswahl, Laden, Tabwechsel und App-Start
  // öffnet sich ihre Gruppe (bzw. die oberste Ebene) und die Kachel kommt in den Blick; beim Blättern springt nichts
  const rasterSlot = tab === "statistik" ? statistikAktiverSlot : aktiverSlot;
  useEffect(() => {
    if (!slotSektionAufgeklappt || (tab !== "quiz" && tab !== "statistik") || multiAuswahl || slotSortModus) return;
    if (rasterSlot?.typ !== "gespeichert") return;
    const data = getSlotsData();
    const e = data.gespeichert.find(x => x.id === rasterSlot.id);
    if (!e) return;
    setSlotOrdner(e.ordner && (data.ordner || []).some(o => o.id === e.ordner) ? e.ordner : null);
    const id = rasterSlot.id;
    [60, 350].forEach(ms => setTimeout(() => document.querySelector(`[data-slot-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), ms));
  }, [slotSektionAufgeklappt, tab, rasterSlot?.typ, rasterSlot?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Kachel-Gesten (Touch): sofort wischen scrollt; KACHEL_ANHEBEN_MS halten hebt die Kachel an – ziehen verschiebt
  // (über die Lang-Druck-Verfolgung oben); KACHEL_AUSWAEHLEN_MS halten wählt sie aus – weiterfahren sammelt weitere
  // ein (Lasso), loslassen öffnet die Auswahl-Tafel. Gruppen-Kacheln: nur anheben (ihr Menü kommt über tt).
  useEffect(() => {
    const aus = () => {
      const g = kachelGesteRef.current;
      if (g) { clearTimeout(g.t1); clearTimeout(g.t2); }
      kachelGesteRef.current = null; setAngehoben(null);
    };
    const start = e => {
      aus();
      if (e.touches.length !== 1 || farbModusRef.current) return;
      const el = e.target.closest?.("[data-kachel-geste]");
      if (!el) return;
      const t = e.touches[0];
      const art = el.dataset.kachelGeste;   // "slot" | "liste" | "ordner"
      const id = art === "liste" ? el.dataset.listeId : el.dataset.slotId;
      const g = { art, id, x: t.clientX, y: t.clientY, stufe: 0, t0: Date.now() };
      g.heben = () => {
        if (g.stufe >= 1) return;
        g.stufe = 1;
        if (el.dataset.kachelZieh === undefined) return;
        slotZiehenRef.current = { ...(art === "liste" ? { art: "liste" } : {}), id, x: g.x, y: g.y, aktiv: false, langdruck: true };
        setAngehoben(id);
      };
      g.waehlen = () => {
        if (g.stufe >= 2 || slotZiehenRef.current?.aktiv) return;
        g.heben();   // falls der Anheben-Timer noch nicht lief
        const lassoArt = art === "liste" ? "liste" : "slot";
        const r = rasterAuswahlRef.current;
        // schon ausgewählt: angehoben lassen (Stufe 3) – ziehen verschiebt die ganze Auswahl
        if (slotZiehenRef.current && ((lassoArt === "liste" ? r.listeWahl : r.slotWahl) || []).includes(id)) { g.stufe = 3; navigator.vibrate?.(20); return; }
        g.stufe = 2; slotZiehenRef.current = null; setAngehoben(null); navigator.vibrate?.(20);
        const ids = [...((lassoArt === "liste" ? r.listeWahl : r.slotWahl) || [])];
        if (!ids.includes(id)) ids.push(id);
        lassoRef.current = { art: lassoArt, feld: el.closest("[data-lasso]") || el.parentElement, x: g.x, y: g.y, aktiv: true, ids };
        setLasso({ art: lassoArt, ids });
      };
      g.t1 = setTimeout(g.heben, KACHEL_ANHEBEN_MS);
      if (art !== "ordner") g.t2 = setTimeout(g.waehlen, KACHEL_AUSWAEHLEN_MS);
      kachelGesteRef.current = g;
    };
    const bewegen = e => {
      const g = kachelGesteRef.current;
      if (!g) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - g.x, t.clientY - g.y) <= 8) return;
      // Timer können sich verspäten (Browser beschäftigt): maßgeblich ist die gehaltene Zeit
      const gehalten = Date.now() - g.t0;
      if (g.art !== "ordner" && gehalten >= KACHEL_AUSWAEHLEN_MS) g.waehlen();
      else if (gehalten >= KACHEL_ANHEBEN_MS) g.heben();
      if (g.stufe === 2) { clearTimeout(g.t1); clearTimeout(g.t2); kachelGesteRef.current = g; return; }   // Einsammeln läuft (Lasso)
      if (g.stufe === 0) { aus(); return; }   // sofort gewischt: Seite scrollt
      aus();                                   // angehoben und gezogen: das Verschieben läuft
    };
    const loslassen = e => {
      const g = kachelGesteRef.current;
      if (!g) return;
      if (g.stufe >= 2 && e.cancelable) e.preventDefault();   // kein Klick hinterher (würde die Kachel wieder abwählen)
      if (g.stufe !== 2 && slotZiehenRef.current && !slotZiehenRef.current.aktiv) slotZiehenRef.current = null;   // nur angehoben
      aus();
    };
    document.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", bewegen, { passive: true });
    window.addEventListener("touchend", loslassen, { passive: false });
    window.addEventListener("touchcancel", aus);
    return () => {
      document.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", bewegen);
      window.removeEventListener("touchend", loslassen);
      window.removeEventListener("touchcancel", aus);
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Lang-Druck auf eine freie Stelle im Raster und dann ziehen: jede überstrichene Kachel kommt in die Auswahl
  useEffect(() => {
    const setze = (art, ids) => (art === "liste" ? setListenWahl : setMultiAuswahl)(ids);
    const start = e => {
      if (e.touches.length !== 1) { if (lassoRef.current) clearTimeout(lassoRef.current.timer); lassoRef.current = null; return; }
      const feld = e.target.closest?.("[data-lasso]");
      if (!feld || e.target.closest("[data-slot-id], [data-liste-id]")) return;
      const t = e.touches[0];
      const l = { art: feld.dataset.lasso, feld, x: t.clientX, y: t.clientY, aktiv: false, ids: [] };
      l.timer = setTimeout(() => {
        l.aktiv = true; navigator.vibrate?.(15);
        const r = rasterAuswahlRef.current;
        l.ids = [...((l.art === "liste" ? r.listeWahl : r.slotWahl) || [])];
        setLasso({ art: l.art, ids: l.ids });
      }, 500);
      lassoRef.current = l;
    };
    const bewegen = e => {
      const l = lassoRef.current;
      if (!l) return;
      const t = e.touches[0];
      if (!l.aktiv) { if (Math.hypot(t.clientX - l.x, t.clientY - l.y) > 8) { clearTimeout(l.timer); lassoRef.current = null; } return; }
      if (e.cancelable) e.preventDefault();   // Seite nicht scrollen, solange eingesammelt wird
      const el = document.elementFromPoint(t.clientX, t.clientY)?.closest(l.art === "liste" ? "[data-liste-id]" : "[data-slot-id]:not([data-ordner-id])");
      const id = el && l.feld.contains(el) ? (l.art === "liste" ? el.dataset.listeId : el.dataset.slotId) : null;
      if (id && !l.ids.includes(id)) { l.ids = [...l.ids, id]; setLasso({ art: l.art, ids: l.ids }); }
      if (t.clientY < 90) window.scrollBy(0, -12); else if (t.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    };
    const ende = () => {
      const l = lassoRef.current;
      if (!l) return;
      lassoRef.current = null; clearTimeout(l.timer);
      if (!l.aktiv) return;
      setLasso(null);
      if (!l.ids.length) return;
      auswahlTafelRef.current = l.art;   // die Tafel geht mit der übernommenen Auswahl auf (Effekt)
      auswahlTafelStelle.current = { x: l.x, y: l.y };
      setze(l.art, l.ids);
    };
    document.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", bewegen, { passive: false });
    window.addEventListener("touchend", ende);
    window.addEventListener("touchcancel", ende);
    return () => {
      document.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", bewegen);
      window.removeEventListener("touchend", ende);
      window.removeEventListener("touchcancel", ende);
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

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
      setQuizSpalteModus(Object.fromEntries(neuAntw.map(t => [t, quizArt === "akzente" ? 'akzent' : 'karte'])));
    }
  }, [quizListenKey, listenIndex]);

  useEffect(() => {
    let geaendert = false;
    const neu = {};
    Object.entries(quizSpalteModus || {}).forEach(([t, m]) => {
      const alt = modiVon(m);
      let ok = alt.filter(x => modusErlaubt(t, x));
      if (ok.length === alt.length) return void (neu[t] = m);   // alles passt – unverändert (auch „nur Akzente“)
      if (!ok.some(x => x !== "akzent")) ok = [STANDARD_ANTWORT_MODUS, ...ok];
      if (ok.length !== alt.length || ok.some((x, i) => x !== alt[i])) geaendert = true;
      neu[t] = ok.length === 1 ? ok[0] : ok;
    });
    if (geaendert) setQuizSpalteModus(neu);
  }, [quizSpalteModus]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Nach der Zwischenkarte "Wiederholung" die erste Frage erneut vorlesen
  const quizWiederholungHinweis = quiz?.phase === "wiederholungHinweis";
  const vorgelesenRef = useRef(null);
  useEffect(() => {
    vorgelesenRef.current = null;
    if (ansicht !== "quiz" || !quiz || quiz.phase !== "eingabe" || quiz.flash) return;
    if (quiz.modus === "diktat") {
      const text = quiz.vokabeln?.[quiz.index]?.[quiz.diktatSpalte]?.wert;
      if (text) sprich(text, vokLang(quiz.vokabeln?.[quiz.index], quiz.diktatSpalte));
      return;
    }
    if (!einstellungen.autoplay) return;
    if (quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] === "hoeren") return;   // „Hören“ liest die Frage selbst vor
    if (!(einstellungen.vorlesen || ["E1"]).includes(quiz.frageTyp)) return;
    const text = quiz.vokabeln?.[quiz.index]?.[quiz.frageTyp]?.wert;
    if (text) sprichAuto(text, vokLang(quiz.vokabeln?.[quiz.index], quiz.frageTyp));
  }, [quiz?.index, quizWiederholungHinweis, ansicht, einstellungen.autoplay]);

  // Listen-Übersicht gibt es nur noch unter Einstellungen › Listen (z. B. nach Import, Löschen, Abbrechen)
  useEffect(() => {
    if (tab === "listen" && ansicht === "uebersicht") { setTab("einstellungen"); setEinstBereich("listen"); }
  }, [tab, ansicht]);

  // Auto-Vorlesen: Antwort beim Aufdecken bzw. im Richtig-Blitz vorlesen (je Spalte nur einmal)
  const antwortGezeigt = !!quiz && quiz.modus !== "diktat" && (quiz.phase === "aufgedeckt" || !!quiz.flash);
  useEffect(() => {
    if (ansicht !== "quiz" || !antwortGezeigt || !einstellungen.autoplay) return;
    const typ = quiz.antwortTypen?.[quiz.antwortTypIndex];
    if (!typ || !(einstellungen.vorlesen || ["E1"]).includes(typ)) return;
    const schluessel = `${quiz.index}|${quiz.antwortTypIndex}`;
    if (vorgelesenRef.current === schluessel) return;
    vorgelesenRef.current = schluessel;
    sprichAuto(quiz.antwortTeile?.[0], vokLang(quiz.vokabeln?.[quiz.index], typ));
  }, [antwortGezeigt, quiz?.index, quiz?.antwortTypIndex, ansicht, einstellungen.autoplay]);

  useEffect(() => {
    if (ansicht !== "quiz" || !quiz) return;
    if (quiz.phase === "wiederholungHinweis") {
      const weiter = (e) => { if (e.target.closest?.(".modal")) return; if (e.key === "Enter" || e.key === "w" || e.key === "W") { e.preventDefault(); starteWiederholung(); } };
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
      if (!active || e.target.closest?.(".modal")) return;
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
  // Listen (ids) untereinander ab Platz ziel; Raster wächst bei Bedarf
  function setzeListenPlaetze(ids, ziel) {
    const einst = lsGet(SK.einstellungen, defaultEinstellungen());
    const g = rasterGroesse(einst, "listenRaster");
    const einstNeu = ziel.z + ids.length > g.zeilen ? { ...einst, listenRaster: { ...g, zeilen: ziel.z + ids.length } } : einst;
    if (einstNeu !== einst) speichereEinst(einstNeu);
    speichereIndex(platziereGruppe(lsGet(SK.listenIndex, []), ids, ziel), einstNeu);
    setListenAuswahl([]);
  }
  // Gezogener Eintrag: ist er markiert, wandert die ganze markierte Gruppe mit.
  // Ziel „raus“: aus der geöffneten Gruppe; lange genug über einer Kachel gehalten: Gruppe bilden
  function legeGezogenAb(d, ziel) {
    const gruppe = gruppenZielRef.current === ziel;
    gruppenZielRef.current = null;
    const ausw = rasterAuswahlRef.current[d.art === "liste" ? "liste" : "slot"];
    const ids = ausw.includes(d.id) ? ausw : [d.id];
    if (ziel === "raus") { if (d.art !== "liste" && slotOrdnerRef.current) verschiebeInOrdner(ids, null); return; }
    const [z, sp] = ziel.split("|").map(Number);
    if (gruppe && d.art !== "liste") { gruppiere(ids, { z, s: sp }); return; }
    (d.art === "liste" ? setzeListenPlaetze : setzeSlotPlaetze)(ids, { z, s: sp });
  }
  // Auswahl-Tafel zeigen bzw. aktualisieren (Inhalt aus dem letzten Render)
  function zeigeAuswahlTafel(art) {
    const d = auswahlTafelDaten.current[art]?.();
    if (!d) return;
    auswahlTafelRef.current = art;
    const st = auswahlTafelStelle.current;   // sonst bleibt die Stelle des Lang-Drucks (für „🎨 Farbe ändern“)
    zeigeInfo(d.text, st?.x ?? null, st?.y ?? null, d.aktionen, { auswahl: auswahlTafel(art) });
  }
  function auswahlTafel(art) {
    return { zu: behalten => { auswahlTafelRef.current = null; auswahlTafelStelle.current = null; if (!behalten) (art === "liste" ? setListenWahl : setMultiAuswahl)(null); } };
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
  // Akzente je Sprache (Einstellungen → Akzente); Standard: nur Französisch
  const akzenteAn = code => einstellungen.akzenteSprachen?.[code] ?? code === "fr";
  AKZENTE_FUER_LISTE = id => !id || id === "combined" || akzenteAn(spracheVonListe(id));
  // Gewählte Sprache nur wirksam, solange es Listen dieser Sprache gibt
  const sprachFilter = vorhandeneSprachen.some(s => s.code === einstellungen.sprache) ? einstellungen.sprache : "alle";
  const sichtbareListen = sprachFilter === "alle" ? listenIndex : listenIndex.filter(l => listeSprache(l) === sprachFilter);
  // Farben je Sprache: in der Abfrage die Sprache ihrer Listen (nur eine), sonst der Sprachfilter; „standard“ = normales Schema
  const sprachFarbKontext = (() => {
    if (!einstellungen.sprachFarben?.an || farbModus) return null;
    const q = (ansicht === "quiz" && quiz) || (lernen ? { vokabeln: lernen.voks || [] } : null);
    if (q) {
      const ids = new Set((q.vokabeln || []).map(v => v._listeId || q.liste?.id).filter(Boolean));
      const sp = new Set([...ids].map(id => listeSprache(listenIndex.find(l => l.id === id))));
      return sp.size === 1 ? [...sp][0] : null;
    }
    return sprachFilter !== "alle" ? sprachFilter : null;
  })();
  const sprachSchemaId = sprachFarbKontext ? (einstellungen.sprachFarben.zuordnung?.[sprachFarbKontext] ?? `sprache_${sprachFarbKontext}`) : null;
  const sprachSchema = sprachSchemaId && sprachSchemaId !== "standard"
    ? ((einstellungen.eigeneSchemata || []).find(x => x.id === sprachSchemaId) || FARB_VORLAGEN.find(x => x.id === sprachSchemaId)) : null;
  if (sprachSchema) {
    F = farbenAus(sprachSchema.farben);
    CSS = farbVariablen(F, sprachSchema.dunkel) + CSS_BASIS + elementCSS(sprachSchema.elemente);
  }
  // Zufallsfarben je Abschnitt: neues Zufalls-Schema bei jedem Quiz (bzw. Paket), am Ende und zurück in der Übersicht
  const farbWechselAn = !!einstellungen.farbWechsel && !einstellungen.sprachFarben?.an && !farbModus;
  const abschnitt = ansicht === "quiz" && quiz ? `${quiz.phase === "fertig" || quiz.phase === "spielEnde" ? "ende" : "quiz"}:${quiz.rundeStartZeit || ""}`
    : lernen ? `lernen:${lernen.start ?? ""}:${lernen.groesse ?? ""}` : "uebersicht";
  const [wechselFarben, setWechselFarben] = useState(null);
  useEffect(() => { if (farbWechselAn) setWechselFarben(zufallsFarben()); }, [abschnitt, farbWechselAn]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (farbWechselAn && wechselFarben) {
    F = farbenAus(wechselFarben);
    CSS = farbVariablen(F, false) + CSS_BASIS;
  }
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
  // „Hören“: die Frage beim Erscheinen vorlesen (sie ist verdeckt)
  const hoerFrage = quiz && quiz.phase === "eingabe" && !quiz.flash && quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] === "hoeren"
    ? `${quiz.index}|${quiz.antwortTypIndex}` : null;
  useEffect(() => {
    if (!hoerFrage || !quiz) return;
    const v = quiz.vokabeln[quiz.index];
    const t = setTimeout(() => sprichAuto(v?.[quiz.frageTyp]?.wert || "", vokLang(v, quiz.frageTyp)), 250);
    return () => clearTimeout(t);
  }, [hoerFrage]);   // eslint-disable-line react-hooks/exhaustive-deps

  function wechsleSprache(code) {
    setSprachMenuOffen(false);
    speichereEinst({ ...einstellungen, sprache: code });
    if (code === "alle") return;
    const passt = id => spracheVonListe(id) === code;
    // Quiz: Auswahl/Konfiguration mit Listen anderer Sprache zurücksetzen
    if (quizTabListen.some(id => !passt(id))) {
      setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotGeaendert(false); zurUebersetzung();
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
    setListenWahl(null);
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
  // Vokabel bearbeiten (vok = null: neue Vokabel) in beliebiger Liste – aus Listen, Statistik oder Abfrage.
  // nur = Spalte: nur deren richtige Antwort (Abfrage), falsche Antworten bleiben unverändert
  function oeffneVokabelBearbeiten(vok, listeId = aktiveListeId, nur = null, falsch = null) {
    const liste = listeId === aktiveListeId && aktiveListe ? aktiveListe : lsGet(SK.liste(listeId));
    if (!liste) return;
    const orig = vok ? liste.vokabeln.find(v => v.id === (vok._origId ?? vok.id)) : null;
    if (vok && !orig) return;
    const eingaben = {};
    if (nur) eingaben[nur] = falsch ?? (orig?.[nur]?.wert || '');
    else TYPEN.filter(t => liste.spalten[t].aktiv).forEach(typ => {
      const z = orig?.[typ];
      eingaben[typ] = z ? z.wert + (z.falsch?.length > 0 ? ' || ' + z.falsch.join(' | ') : '') : '';
    });
    setBearbeiteVokabel(orig || { neu: true });
    setBearbeiteListe(liste);
    setBearbeiteNur(nur);
    setBearbeiteFalsch(falsch);
    setBearbeiteEingaben(eingaben);
    setModalFehler("");
    setModal('vokabel-bearbeiten');
  }
  function schliesseVokabelBearbeiten() { setModal(null); setBearbeiteVokabel(null); setBearbeiteEingaben({}); setBearbeiteNur(null); setBearbeiteFalsch(null); setBearbeiteListe(null); }

  function speichereVokabelBearbeitung() {
    if (!bearbeiteVokabel || !bearbeiteListe) return;
    const liste = lsGet(SK.liste(bearbeiteListe.id)) || bearbeiteListe;
    const nur = bearbeiteNur, falschAlt = bearbeiteFalsch;
    const neuEintrag = !!bearbeiteVokabel.neu;
    const orig = neuEintrag ? null : liste.vokabeln.find(v => v.id === bearbeiteVokabel.id);
    if (!neuEintrag && !orig) { schliesseVokabelBearbeiten(); return; }
    let neu;
    const wert = nur ? (bearbeiteEingaben[nur] || '').trim() : '';
    if (nur) {
      if (falschAlt != null) {
        // falsche Antwort ändern; leer = entfernen
        const alt = orig[nur]?.falsch || [];
        neu = { ...orig, [nur]: { ...orig[nur], falsch: wert ? alt.map(f => f === falschAlt ? wert : f) : alt.filter(f => f !== falschAlt) } };
      } else if (nur.startsWith('i')) {
        // Info darf leer werden (Spalte entfällt)
        neu = { ...orig };
        if (wert) neu[nur] = { ...(orig[nur] || { falsch: [] }), wert }; else delete neu[nur];
      } else {
        if (!wert) { setModalFehler("Das Feld darf nicht leer sein."); return; }
        neu = { ...orig, [nur]: { ...(orig[nur] || { falsch: [] }), wert } };
      }
    } else {
      // Lernstand und nicht angezeigte Spalten bleiben erhalten
      neu = neuEintrag ? { id: liste.naechste_id } : { ...orig };
      TYPEN.filter(t => liste.spalten[t].aktiv).forEach(typ => {
        const raw = (bearbeiteEingaben[typ] || '').trim();
        if (raw) neu[typ] = parseKolumne(raw); else delete neu[typ];
      });
      if (TYPEN.filter(t => !t.startsWith('i') && neu[t]?.wert).length < 2) { setModalFehler("Mindestens zwei Spalten (außer Info) ausfüllen."); return; }
    }
    const neueListe = neuEintrag
      ? { ...liste, naechste_id: liste.naechste_id + 1, vokabeln: [...liste.vokabeln, neu] }
      : { ...liste, vokabeln: liste.vokabeln.map(v => v.id === neu.id ? neu : v) };
    lsSet(SK.liste(liste.id), neueListe);
    if (liste.id === aktiveListeId) setAktiveListe(neueListe);
    // laufende Abfrage: Vokabel dort ebenfalls ändern (auch MC-Knöpfe mit der alten Antwort)
    if (!neuEintrag) setQuiz(q => {
      if (!q) return q;
      const passt = v => (v._listeId ?? q.liste.id) === liste.id && (v._origId ?? v.id) === neu.id;
      const spalten = nur ? { [nur]: neu[nur] } : Object.fromEntries(TYPEN.map(t => [t, neu[t]]));
      const auf = v => passt(v) ? { ...v, ...spalten } : v;
      const vokabeln = q.vokabeln.map(auf);
      const neuQ = { ...q, vokabeln, liste: { ...q.liste, vokabeln: q.liste.vokabeln.map(auf) } };
      // gerade gefragte Vokabel und Spalte: Lösung (und MC-Knöpfe) sofort neu
      const typ = q.modus === "diktat" ? q.diktatSpalte : q.antwortTypen?.[q.antwortTypIndex];
      const akt = vokabeln[q.index];
      if (!passt(akt)) return neuQ;
      // schon beantwortete Spalten dieser Vokabel zeigen den neuen Wert
      if (falschAlt == null && q.vorigeAntworten?.length) neuQ.vorigeAntworten = q.vorigeAntworten.map(v =>
        spalten[v.typ]?.wert ? { ...v, wert: spalten[v.typ].wert.split('/').map(x => x.trim()).join(" / ") } : v);
      if (!typ || !(typ in spalten) || q.modus === "diktat") return neuQ;
      if (falschAlt != null) {
        if (q.mcButtons?.length) neuQ.mcButtons = q.mcButtons.flatMap(b => b.korrekt || b.text !== falschAlt ? [b] : wert ? [{ ...b, text: wert }] : []);
        return neuQ;
      }
      neuQ.antwortTeile = (akt[typ]?.wert || "").split('/').map(x => x.trim());
      if (q.mcButtons?.length && q.phase === "eingabe") { const mc = generiereButtons(vokabeln, akt, typ); neuQ.mcButtons = mc.buttons; neuQ.mcRichtig = mc.richtig; }
      return neuQ;
    });
    speichereIndex(listenIndex);   // neu zeichnen (Anzahl, Lernstand in Listen und Statistik)
    schliesseVokabelBearbeiten();
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
  function generiereKombiniertenExport(ids) {
    return ids.map(id => { const l = lsGet(SK.liste(id)); return l ? generiereExportText(l) : null; })
      .filter(Boolean).join('\n\n');
  }
  async function kopiereListen(ids) {
    if (!ids.length) return;
    const text = generiereKombiniertenExport(ids);
    try {
      await navigator.clipboard.writeText(text);
      setExportKopiert(true);
      setTimeout(() => setExportKopiert(false), 2000);
    } catch {}
  }

  // Exportieren: ein Fenster mit Art-Wahl JSON | TXT | Kopieren (zuletzt gewählte Art ist vorausgewählt)
  function oeffneExport(ids, art = einstellungen.exportArt || "json") {
    if (!ids.length) return;
    if (art !== einstellungen.exportArt) speichereEinst({ ...einstellungen, exportArt: art });
    setExportKopiert(false);
    if (art === "txt") oeffneDateiExport({ art: "txt", ids }, exportStandardName(ids, "TXT"));
    else if (art === "kopieren") { setKopierExportIds(ids); setModal("kopier-export"); }
    else exportiereAlsJson(ids);
  }
  const exportWas = ids => ids.length === 1 ? (listenIndex.find(l => l.id === ids[0])?.name || "1 Liste")
    : `${ids.length} Listen: ${ids.map(id => listenIndex.find(l => l.id === id)?.name).filter(Boolean).join(", ")}`;
  function renderExportArtWahl(ids, aktuell) {
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

  // Export-Dateien: Endung immer .txt (nimmt jedes Ziel an), Inhalt steht im Namen: "Name - JSON.txt" / "Name - TXT.txt"
  function exportStandardName(ids, art) {
    const basis = ids.length === 1 ? (listenIndex.find(l => l.id === ids[0])?.name || 'Vokabeln') : `${ids.length} Listen`;
    return `${basis} - ${art}`;
  }
  // eingegebener Name → Dateiname: Zeichen, die Dateisysteme nicht erlauben, raus; leer → Vorschlag
  const dateiName = (name, standard) => (name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\.(txt|json)$/i, "").trim() || standard) + ".txt";
  const sicherungStandardName = () => `Vokabel-App Sicherung ${new Date().toISOString().slice(0, 10)}`;
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
  // TXT-Export und Gesamtsicherung: erst Fenster mit Dateinamen, dann teileAlsDatei
  function oeffneDateiExport(ziel, standard) { setDateiExport(ziel); setExportName(standard); setModal("datei-export"); }
  function bestaetigeDateiExport() {
    const z = dateiExport;
    if (!z) return;
    setModal(null); setDateiExport(null);
    if (z.art === "sicherung") { speichereSicherung(dateiName(exportName, sicherungStandardName())); return; }
    const text = z.ids.length === 1 ? generiereExportText(lsGet(SK.liste(z.ids[0]))) : generiereKombiniertenExport(z.ids);
    teileAlsDatei(text, dateiName(exportName, exportStandardName(z.ids, "TXT")));
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
        if (!(aktiverSlot?.typ === s.typ && aktiverSlot?.id === s.id)) { ladeSlot(s.typ, s.id); if (getSlotEintrag(s.typ, s.id)?.multi) setMultiStart({ id: s.id, starten: false }); }
      } else {
        // keine Konfiguration mehr ("Neu" oder Liste geändert) → im Quiz lösen, Session ebenfalls
        // (ihr Fortschritt bleibt im gespeicherten Eintrag); Listen-/Vokabelauswahl übernehmen
        if (aktiverSlot) { setAktiverSlot(null); setGespeicherteVokabelgruppe(null); lsDel(SK.letzterSlot); lsDel(SK.sessionAktiv); setSessionSlotAktiv(null); zurUebersetzung(); }
        setQuizTabListen(statistikListenIds === null ? sichtbareListen.map(l => l.id) : [...statistikListenIds]);
        setQuizBereichTyp(statistikBereichTyp);
        setQuizCheckboxAuswahl(new Set(statistikBereichTyp === "bereich" ? statistikCheckboxAuswahl : []));
      }
    }
    setTab(neuerTab);
    setListenWahl(null);
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
    wechsleQuizArt(g.art, getKombinierteListe(g.listenIds)?.spalten);
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

  // Einstellungen: Bereiche mit Kopfzeile, immer nur einer offen; der geöffnete rückt unter die Kopfleiste, falls er oben verschwunden ist
  function schalteEinstBereich(key) {
    const neu = einstBereich === key ? null : key;
    setEinstBereich(neu);
    if (neu === "info") setInfoModus("uebersicht");
    if (neu) requestAnimationFrame(() => {
      const el = document.querySelector(`[data-einst-kopf="${neu}"]`);
      if (el && el.getBoundingClientRect().top < headerH) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerH - 8 });
    });
  }
  const einstKopf = (key, titel, sub) => (
    <button className={`einst-kopf${einstBereich === key ? " offen" : ""}`} data-einst-kopf={key} data-offen={einstBereich === key ? "ja" : "nein"}
      onClick={() => schalteEinstBereich(key)} {...tt(einstBereich === key ? `${titel} zuklappen` : `${titel} aufklappen`)}>
      <span className="einst-kopf-text">{titel}{sub && <span className="einst-kopf-sub">{sub}</span>}</span>
      <span className="einst-kopf-pfeil">{einstBereich === key ? "▾" : "▸"}</span>
    </button>
  );

  // Dialog „Vokabel bearbeiten / Neue Vokabel / Richtige Antwort bearbeiten“ – im Haupt-Bildschirm und über der Abfrage
  function renderVokabelEditor() {
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

  const renderExportNamensFeld = beiEnter => (
    <div style={{marginBottom:14}}>
      <label className="inp-label">Dateiname</label>
      <div style={{display:"flex", alignItems:"center", gap:6}}>
        <input className="inp" data-export-name value={exportName} onChange={e => setExportName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") beiEnter(); }} onFocus={e => e.target.select()}
          {...ttFeld("Name der Datei – leer lassen für den Vorschlag")} style={{flex:1, minWidth:0}} />
        <span style={{fontSize:"0.85rem", color:"var(--text3)"}}>.txt</span>
      </div>
    </div>
  );

  // Gesamtsicherung als Datei (Vorschlag „Vokabel-App Sicherung JJJJ-MM-TT“, Name änderbar)
  function sichereAlles() { oeffneDateiExport({ art: "sicherung" }, sicherungStandardName()); }
  function speichereSicherung(dateiname) {
    const sich = erstelleSicherung();
    teileAlsDatei(JSON.stringify(sich), dateiname);
    lsSet(SK.letzteSicherung, sich.erstellt); setLetzteSicherung(sich.erstellt);
  }
  async function ladeSicherungsDatei(file) {
    setSicherungFehler(""); setSicherungLaden(null);
    let obj = null;
    try { const t = (await leseDateiAlsText(file)).replace(/^[\uFEFF\u200B\s]+/, ""); obj = JSON.parse(t); } catch { /* unten */ }
    if (istSicherung(obj)) { setSicherungLaden(obj); return; }
    setSicherungFehler(`„${file.name}“ ist keine Gesamtsicherung. Einzelne Listen bitte über Listen → Import laden.`);
  }
  function bestaetigeWiederherstellen(sich) {
    stelleSicherungWiederHer(sich);
    window.location.reload();
  }
  const sicherungTage = einstellungen.sicherungErinnerung ?? 7;
  const sicherungAlt = (() => {
    if (!sicherungTage || !listenIndex.length || Date.now() - sicherungSpaeter < SICHERUNG_TAG_MS) return null;
    const seit = letzteSicherung || lsGet(SK.sicherungBasis);
    if (!seit || Date.now() - seit < sicherungTage * SICHERUNG_TAG_MS) return null;
    return { tage: Math.floor((Date.now() - seit) / SICHERUNG_TAG_MS), nie: !letzteSicherung };
  })();

  function exportiereAlsJson(ids) {
    setJsonExportIds(ids);
    setExportName(exportStandardName(ids, "JSON"));
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
    const name = dateiName(exportName, exportStandardName(jsonExportIds, "JSON"));
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
        setQuizSpalteModus(p => ({...p, [typ]: quizArt === "akzente" ? "akzent" : (p[typ] && p[typ] !== "akzent" ? p[typ] : STANDARD_ANTWORT_MODUS)}));
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
    let neu = { ...data, ordner: data.ordner || [] };
    // Verweise auf nicht mehr vorhandene Gruppen lösen
    const gibt = new Set(neu.ordner.map(o => o.id));
    neu.gespeichert = neu.gespeichert.map(x => x.ordner && !gibt.has(x.ordner) ? (({ ordner: _o, platz: _p, ...r }) => r)(x) : x);   // eslint-disable-line no-unused-vars
    let zeilen = groesse.zeilen;
    for (const oid of [null, ...neu.ordner.map(o => o.id)]) {
      const r = ordneRaster(ebeneVon(neu, oid), groesse);
      zeilen = Math.max(zeilen, r.zeilen);
      neu = setzeEbene(neu, r.gespeichert);
    }
    if (zeilen !== groesse.zeilen) speichereEinst({ ...einst, slotRaster: { ...groesse, zeilen } });
    return neu;
  }
  // Rastergröße ändern: Einträge außerhalb rücken auf freie Plätze; reicht der Platz nicht,
  // bleiben so viele Zeilen wie nötig (kleiner geht dann nicht)
  function setzeRasterGroesse(zeilen, spalten) {
    const einst = { ...einstellungen, slotRaster: { zeilen, spalten } };
    speichereEinst(einst);
    setSlotsData(rasterEinordnen(getSlotsData(), einst));
  }
  function setzeSlotPlaetze(ids, ziel) {
    const einst = lsGet(SK.einstellungen, defaultEinstellungen());
    const g = rasterGroesse(einst);
    const einstNeu = ziel.z + ids.length > g.zeilen ? { ...einst, slotRaster: { ...g, zeilen: ziel.z + ids.length } } : einst;
    if (einstNeu !== einst) speichereEinst(einstNeu);
    const data = rasterEinordnen(getSlotsData(), einstNeu);
    const ordnerId = slotOrdnerRef.current;
    const ebene = ebeneVon(data, ordnerId);
    setSlotsData(rasterEinordnen(setzeEbene(data, platziereGruppe(ebene, ids, ziel)), einstNeu));
    setSlotAuswahl([]);
  }
  // Sessions in eine Gruppe (oder mit null heraus auf die oberste Ebene); sie kommen dort ans Ende
  function verschiebeInOrdner(ids, ordnerId) {
    const data = getSlotsData(), set = new Set(ids);
    const gespeichert = data.gespeichert.map(x => {
      if (!set.has(x.id)) return x;
      const { platz: _p, ordner: _o, ...r } = x;   // eslint-disable-line no-unused-vars
      return ordnerId ? { ...r, ordner: ordnerId } : r;
    });
    setSlotsData(rasterEinordnen({ ...data, gespeichert }));   // Gruppen bleiben bestehen, auch mit einer oder keiner Session
    setMultiAuswahl(null); setSlotSortModus(false); setSlotAuswahl([]); setInGruppe(null);
  }
  // neue Gruppe aus Sessions: die Gruppe nimmt den Platz der ersten Session ein
  function legeOrdnerAn(name, ids) {
    const data = rasterEinordnen(getSlotsData()), set = new Set(ids), id = neuerSlotId("ordner");
    const erste = data.gespeichert.find(x => x.id === ids[0] && !x.ordner);
    const gespeichert = data.gespeichert.map(x => {
      if (!set.has(x.id)) return x;
      const { platz: _p, ordner: _o, ...r } = x;   // eslint-disable-line no-unused-vars
      return { ...r, ordner: id };
    });
    const ordner = [...(data.ordner || []), { id, name: name.trim() || "Gruppe", ...(erste?.platz ? { platz: erste.platz } : {}) }];
    setSlotsData(rasterEinordnen({ ...data, ordner, gespeichert }));
    setMultiAuswahl(null); setSlotSortModus(false); setSlotAuswahl([]); setInGruppe(null);
    return id;
  }
  // Gezogene Sessions auf eine Session (neue Gruppe aus allen, an deren Platz) bzw. in eine Gruppe
  function gruppiere(ids, ziel) {
    const data = rasterEinordnen(getSlotsData());
    const ebene = ebeneVon(data, null);
    const imZiel = ebene.find(e => e.platz && e.platz.z === ziel.z && e.platz.s === ziel.s);
    const sessions = ids.filter(id => data.gespeichert.some(x => x.id === id));
    if (!imZiel || !sessions.length || sessions.includes(imZiel.id)) { setzeSlotPlaetze(ids, ziel); return; }
    if (imZiel.istOrdner) { verschiebeInOrdner(sessions, imZiel.id); return; }
    const alle = [imZiel.id, ...sessions];
    legeOrdnerAn(gruppenName(alle.map(id => data.gespeichert.find(x => x.id === id)?.name || ""), (data.ordner || []).map(o => o.name)), alle);
  }
  // Gruppe auflösen: Sessions zurück auf die oberste Ebene (die erste auf den Platz der Gruppe)
  function loeseOrdnerAuf(id) {
    const data = rasterEinordnen(getSlotsData());
    const o = (data.ordner || []).find(x => x.id === id);
    let erste = true;
    const gespeichert = data.gespeichert.map(x => {
      if (x.ordner !== id) return x;
      const { platz: _p, ordner: _o, ...r } = x;   // eslint-disable-line no-unused-vars
      if (erste && o?.platz) { erste = false; return { ...r, platz: o.platz }; }
      return r;
    });
    setSlotsData(rasterEinordnen({ ...data, ordner: data.ordner.filter(x => x.id !== id), gespeichert }));
    if (slotOrdner === id) setSlotOrdner(null);
  }
  function benenneOrdnerUm(id, name) {
    const data = getSlotsData();
    setSlotsData({ ...data, ordner: (data.ordner || []).map(o => o.id === id ? { ...o, name: name.trim() || o.name } : o) });
    setOrdnerUmbenennen(null);
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
      art: quizArt, arten: { ...quizArtStash, [quizArt]: artEinstellungenJetzt() },
    };
  }
  function artEinstellungenJetzt() {
    return { quizAusgewaehlt, quizFrageTyp, quizAntwortTypenGeordnet, quizInfoTypenSession, quizSpalteModus, quizZeigeInfo,
      quizModus, quizReihenfolge, quizSchlechtesteMaxScore, quizUnbeantwortetZuerst, quizDiktatSpalte, quizDiktatUebersetzung };
  }
  function wendeArtEinstellungenAn(k) {
    setQuizAusgewaehlt(k.quizAusgewaehlt || []);
    setQuizFrageTyp(k.quizFrageTyp || "");
    setQuizAntwortTypenGeordnet(k.quizAntwortTypenGeordnet || []);
    setQuizInfoTypenSession(k.quizInfoTypenSession || []);
    setQuizSpalteModus(k.quizSpalteModus || {});
    setQuizZeigeInfo(k.quizZeigeInfo || {});
    setQuizModus(k.quizModus || "sequenziell");
    setQuizReihenfolge(k.quizReihenfolge || "zufall");
    setQuizSchlechtesteMaxScore(k.quizSchlechtesteMaxScore ?? "");
    const ubz = k.quizUnbeantwortetZuerst;
    setQuizUnbeantwortetZuerst(ubz != null && typeof ubz === "object" ? ubz : { zufall: !!ubz, schlechteste: false, listennr: !!ubz });
    setQuizDiktatSpalte(k.quizDiktatSpalte || "E1");
    setQuizDiktatUebersetzung(k.quizDiktatUebersetzung !== undefined ? k.quizDiktatUebersetzung : "D1");
  }
  // Ü|D|A: Einstellungen der bisherigen Art merken, die der neuen Art laden (oder Standard)
  // neues Quiz (ohne geladene Konfiguration) beginnt immer in Übersetzung
  function zurUebersetzung() { if (quizArt !== "uebersetzung") wechsleQuizArt("uebersetzung"); }
  function wechsleQuizArt(neu, spalten = quizKombiListe?.spalten) {
    if (neu === quizArt) return;
    const stash = { ...quizArtStash, [quizArt]: artEinstellungenJetzt() };
    wendeArtEinstellungenAn(artBereinigt(neu, stash[neu] || standardArtEinstellungen(neu, spalten), spalten));
    setQuizArtStash(stash);
    setQuizArt(neu);
  }

  // art (optional): Konfiguration direkt in dieser Abfrageart laden
  function applyKonfiguration(k, art = null) {
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
    setQuizBereichTyp(k.quizBereichTyp || "alle");
    const artK = artVonKonfig(k);
    const ziel = art || artK;
    const arten = { ...(k.arten || {}), [artK]: artFelderAus(k) };
    const spalten = k.listenIds?.length ? getKombinierteListe(k.listenIds)?.spalten : null;
    wendeArtEinstellungenAn(artBereinigt(ziel, arten[ziel] || standardArtEinstellungen(ziel, spalten), spalten));
    setQuizArtStash(arten);
    setQuizArt(ziel);
  }

  // Nach dem Antippen einer Kachel bleibt die Auswahl einen Moment offen, damit man die neu markierte Kachel sieht
  function schliesseSlotsVerzoegert() {
    clearTimeout(slotZuTimerRef.current);
    slotZuTimerRef.current = setTimeout(() => { setSlotSektionAufgeklappt(false); leuchte("slotkopf"); }, SLOT_ZU_VERZOEGERUNG);
  }

  function ladeSlot(typ, id, art = null) {
    const eintrag = getSlotEintrag(typ, id);
    if (!eintrag || !eintrag.konfiguration) return;
    setListenAendern(false);
    applyKonfiguration(eintrag.konfiguration, art);
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
    schliesseSlotsVerzoegert();   // nach der Auswahl nur noch die Kopfzeile zeigen
    aktiviereSlotFortschritt(eintrag, typ, id, art || slotKonfigArt(eintrag));
  }

  // Session-Fortschritt der Abfrageart aus dem Slot-Eintrag aktivieren (oder keine Session, wenn es keinen gibt)
  function aktiviereSlotFortschritt(eintrag, typ, id, art) {
    const sf = slotSFAlle(eintrag)[art];
    if (sf) {
      const k = eintrag.konfiguration || {};
      const sessionObj = { slotTyp: typ, slotId: id, art, listenIds: k.listenIds || [], vokabelAuswahl: k.vokabelAuswahl || [], bereichTyp: k.bereichTyp || "alle", abgefragt: sf.abgefragt || [], gesamt: sf.gesamt || 0, paketGroesse: sf.paketGroesse || STANDARD_PAKET_GROESSE, startScores: sf.startScores || {},
        startZeit: sf.startZeit, erst: sf.erst, pakete: sf.pakete };
      lsSet(SK.sessionAktiv, sessionObj);
      setSessionSlotAktiv(sessionObj);
      setQuizSessionModus("pakete");
      setQuizPaketGroesse(sf.paketGroesse || STANDARD_PAKET_GROESSE);
    } else {
      lsDel(SK.sessionAktiv);
      setSessionSlotAktiv(null);
    }
  }

  function ladeSlotStatistik(typ, id, art = null) {
    const eintrag = getSlotEintrag(typ, id);
    if (!eintrag || !eintrag.konfiguration) return;
    setListenAendern(false);
    const k = eintrag.konfiguration;
    if (art) setStatistikArt(art);
    setStatistikListenIds(k.listenIds?.length > 0 ? new Set(k.listenIds) : null);
    setStatistikBereichTyp(k.bereichTyp || "alle");
    setStatistikCheckboxAuswahl(new Set(k.vokabelAuswahl || []));
    setStatistikListenAufgeklappt(false);
    setStatistikEinzelauswahlAufgeklappt(false);
    setStatistikAktiverSlot({ typ, id });
    setStatistikSlotGeleert(false);
    schliesseSlotsVerzoegert();   // nach der Auswahl nur noch die Kopfzeile zeigen (wie im Quiz)
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

  // ── Lernen: Wort zeigen (ggf. vorlesen), nach einer Pause die Übersetzung, dann die nächste Vokabel ──
  function lernEinstellungen() {
    const e = einstellungen.lernen || {};
    // frühere einzige Pause ("halte") gilt als Pause nach der Info
    return { ...LERNEN_STANDARD, ...(e.halte != null ? { pauseInfo: e.halte } : {}), ...e };
  }
  // Pause nach dem aktuellen Abschnitt (s); ohne Zusatzinfo gilt nach der Übersetzung die längere von Übersetzung/Info
  function lernPause(l, v) {
    const le = lernEinstellungen();
    if (l.phase === 0) return le.pauseWort;
    if (l.phase === 1) return lernInfoZeigen(l, v) ? le.pauseUeb : Math.max(le.pauseUeb, le.pauseInfo);
    return le.pauseInfo;
  }
  function setzeLernEinst(felder) { speichereEinst({ ...einstellungen, lernen: { ...lernEinstellungen(), ...felder } }); }
  // Lernstand je gespeicherter Konfiguration / Verlaufseintrag und Abfrageart (lernStaende), getrennt vom Abfrage-Fortschritt:
  // { ids (ganze Lern-Reihenfolge), groesse, start, index, fertig, quizGemacht, zeit }
  function lernStandVon(slot, art) {
    if (!slot) return null;
    return slots[slot.typ]?.find(x => x.id === slot.id)?.lernStaende?.[art] || null;
  }
  function setzeLernStand(slot, art, stand) {
    const data = getSlotsData();
    if (!slot || !data[slot.typ]?.some(x => x.id === slot.id)) return;
    setSlotsData({ ...data, [slot.typ]: data[slot.typ].map(x => {
      if (x.id !== slot.id) return x;
      const alle = { ...(x.lernStaende || {}) };
      if (stand) alle[art] = stand; else delete alle[art];
      return { ...x, lernStaende: alle };
    }) });
  }
  // alle: ganze Session in Abfrage-Reihenfolge; groesse: Paketgröße (null = alle auf einmal);
  // stand: gespeicherter Lernstand → Reihenfolge und Stelle von damals (fehlende Vokabeln fallen weg)
  function starteLernen(alle, groesse, spalten, info, stand = null) {
    if (!alle.length || !spalten.length) return;
    let start = 0, index = 0, fertig = false, quizGemacht = false;
    if (stand) {
      const nachId = new Map((quizKombiListe?.vokabeln || []).map(v => [v.id, v]));
      const damals = stand.ids.map(id => nachId.get(id)).filter(Boolean);
      if (damals.length) {
        alle = damals; groesse = stand.groesse;
        start = Math.min(stand.start, Math.max(0, alle.length - 1));
        ({ index, fertig, quizGemacht } = stand);
      }
    }
    const g = groesse || alle.length;
    const voks = alle.slice(start, start + g);
    index = Math.min(index || 0, voks.length - 1);
    const le = lernEinstellungen();
    const fremd = spalten.filter(t => t.startsWith("E")), deutsch = spalten.filter(t => !t.startsWith("E"));
    let zuerst = le.zuerst === "deutsch" ? deutsch : fremd, danach = le.zuerst === "deutsch" ? fremd : deutsch;
    if (!zuerst.length || !danach.length) { zuerst = spalten.slice(0, 1); danach = spalten.slice(1); }
    // ohne gewählte Konfiguration: Verlaufseintrag anlegen, damit der Lernstand einen Platz hat
    const slot = aktiverSlot || { typ: "verlauf", id: erstelleVerlaufEintrag() };
    setLernResetFrage(false);
    setLernen({ alle, groesse: g, start, voks, index, phase: 0, pausiert: false, fertig: !!fertig, quizGemacht: !!quizGemacht, lauf: 0, zuerst, danach, info,
      liste: quizKombiListe, slot, art: quizAbfrageArt });
    window.scrollTo(0, 0);
  }
  // Zusatzinfo dieser Vokabel zeigen? (Schalter auf dem Lernbildschirm, nur wenn es Info-Text gibt)
  function lernInfoZeigen(l, v) { return lernEinstellungen().info && l.info.some(t => v?.[t]?.wert); }
  function lernenWeiter() {
    setLernen(l => {
      if (!l || l.fertig) return l;
      if (l.phase === 0 && l.danach.length) return { ...l, phase: 1 };
      if (l.phase === 1 && lernInfoZeigen(l, l.voks[l.index])) return { ...l, phase: 2 };
      if (l.index + 1 >= l.voks.length) return { ...l, fertig: true };
      return { ...l, index: l.index + 1, phase: 0 };
    });
  }
  function lernenVor() { setLernen(l => l && (l.index + 1 >= l.voks.length ? { ...l, fertig: true } : { ...l, index: l.index + 1, phase: 0, lauf: l.lauf + 1 })); }
  function lernenZurueck() { setLernen(l => l && { ...l, index: Math.max(0, l.index - 1), phase: 0, fertig: false, lauf: l.lauf + 1 }); }
  function beendeLernen() { window.speechSynthesis?.cancel(); setLernen(null); klappeUebersichtEin(); }
  // nächstes Paket der Session (nach dem letzten: Endbildschirm bleibt)
  function naechstesLernPaket(l) {
    const start = l.start + l.groesse;
    if (start >= l.alle.length) return { ...l, imQuiz: false };
    return { ...l, imQuiz: false, quizGemacht: false, start, voks: l.alle.slice(start, start + l.groesse), index: 0, phase: 0, fertig: false, pausiert: false, lauf: l.lauf + 1 };
  }
  // Quiz mit genau den eben gezeigten Vokabeln – einmal je Paket, ohne Punktabzug; danach das nächste Paket
  function starteLernQuiz() {
    window.speechSynthesis?.cancel();
    const ids = new Set(lernen.voks.map(v => v.id));
    setLernen(l => ({ ...l, imQuiz: true, quizGemacht: true }));
    starteQuiz(true, null, ids, "lernen");
    setQuiz(q => q && { ...q, ausStatistik: false, ausLernen: true });
  }

  // Multiquiz: Vokabeln mehrerer gespeicherter Konfigurationen zusammen, Einstellungen von der ersten
  function multiZusammenstellung(ids) {
    const data = getSlotsData();
    const teile = ids.map(id => data.gespeichert.find(x => x.id === id)).filter(Boolean);
    if (!teile.length) return null;
    const listenIds = [], keys = new Set(), vorhanden = new Set();
    for (const t of teile) {
      const k = t.konfiguration || {};
      const ids2 = (k.listenIds || []).filter(id => listenIndex.some(l => l.id === id));
      for (const id of ids2) {
        if (!listenIds.includes(id)) { listenIds.push(id); (lsGet(SK.liste(id))?.vokabeln || []).forEach(v => vorhanden.add(`${id}__${v.id}`)); }
      }
      if (k.bereichTyp === "bereich" && k.vokabelAuswahl?.length) k.vokabelAuswahl.forEach(v => keys.add(v));
      else ids2.forEach(id => (lsGet(SK.liste(id))?.vokabeln || []).forEach(v => keys.add(`${id}__${v.id}`)));
    }
    const vokabelAuswahl = [...keys].filter(k => vorhanden.has(k));
    return { konfiguration: { ...teile[0].konfiguration, listenIds, vokabelAuswahl, bereichTyp: "bereich", quizBereichTyp: "bereich" },
      anzahl: vokabelAuswahl.length, teile: teile.map(t => ({ id: t.id, name: t.name })) };
  }
  // Multiquiz aus gespeicherten Sessions (Einstellungen von Nr. 1 = zuerst gewählt): als Verlauf-Eintrag laden,
  // im Quiz-Tab auf Wunsch gleich starten; im Statistik-Tab zeigt die Statistik alle Vokabeln zusammen
  function stelleMultiquizEin(ids = multiAuswahl || [], starten = false) {
    const m = multiZusammenstellung(ids);
    setMultiAuswahl(null);
    if (!m || !m.anzahl) return;
    const id = neuerSlotId('v');
    const data = getSlotsData();
    setSlotsData({ ...data, verlauf: [{ id, name: formatSlotDatum(), timestamp: Date.now(), konfiguration: m.konfiguration, sessionFortschritt: null, multi: m.teile }, ...data.verlauf].slice(0, 5) });
    if (tab === "statistik") { ladeSlotStatistik('verlauf', id); return; }
    ladeSlot('verlauf', id);
    setMultiStart({ id, starten });
  }
  const starteMultiquiz = ids => stelleMultiquizEin(ids, true);
  const multiVonSlot = slot => (slot ? getSlotEintrag(slot.typ, slot.id)?.multi : null) || null;

  function speichereAlsGespeichert(id, name) {
    const data = getSlotsData();
    const konfiguration = aktuelleKonfiguration();
    const multi = multiVonSlot(aktiverSlot);
    let updated;
    if (id) {
      updated = { ...data, gespeichert: data.gespeichert.map(s => s.id === id ? (({ multi: _m, ...rest }) => ({ ...rest, name, konfiguration, ...(multi ? { multi } : {}) }))(s) : s) };
    } else {
      const newId = neuerSlotId('g');
      const neuerEintrag = { id: newId, name, timestamp: Date.now(), konfiguration, sessionFortschritt: null, ...(multi ? { multi } : {}) };
      // bestehende Plätze festhalten, der neue Eintrag kommt auf den ersten freien Platz (Raster wächst automatisch)
      updated = rasterEinordnen({ ...data, gespeichert: [...rasterEinordnen(data).gespeichert, neuerEintrag] });
      id = newId;
    }
    setSlotsData(updated);
    setAktiverSlot({ typ: 'gespeichert', id });
    setListenAendern(false);
    lsSet(SK.letzterSlot, id);
    setSlotGeaendert(false);
    setGespeicherteVokabelgruppe({ listenIds: [...quizTabListen], vokabelAuswahl: Array.from(quizCheckboxAuswahl), bereichTyp: quizBereichTyp });
  }

  // Geänderte Vokabelauswahl in die geladene gespeicherte Session übernehmen. Ihr Session-Fortschritt (je Abfrageart)
  // passt sich an: „abgefragt“ behält nur Vokabeln im neuen Bereich, neue zählen als noch nicht abgefragt
  function ueberspeichereSession() {
    if (aktiverSlot?.typ !== 'gespeichert') return;
    const id = aktiverSlot.id;
    const name = getSlotEintrag('gespeichert', id)?.name || id;
    let ids = (quizTabListen.length ? getKombinierteListe(quizTabListen)?.vokabeln || [] : []).map(v => v.id);
    if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size) ids = ids.filter(x => quizCheckboxAuswahl.has(x));
    const imBereich = new Set(ids);
    const anpassen = sf => ({ ...sf, abgefragt: (sf.abgefragt || []).filter(x => imBereich.has(x)), gesamt: ids.length });
    speichereAlsGespeichert(id, name);
    const data = getSlotsData();
    setSlotsData({ ...data, gespeichert: data.gespeichert.map(x => {
      if (x.id !== id) return x;
      const { sessionFortschritt: _alt, ...rest } = x;   // eslint-disable-line no-unused-vars
      return { ...rest, sessionFortschritte: Object.fromEntries(Object.entries(slotSFAlle(x)).map(([a, sf]) => [a, anpassen(sf)])) };
    }) });
    const sa = lsGet(SK.sessionAktiv);
    if (sa && sa.slotTyp === 'gespeichert' && sa.slotId === id) {
      const neu = { ...anpassen(sa), slotTyp: sa.slotTyp, slotId: sa.slotId, art: sa.art, listenIds: [...quizTabListen], vokabelAuswahl: [...quizCheckboxAuswahl], bereichTyp: quizBereichTyp };
      lsSet(SK.sessionAktiv, neu); setSessionSlotAktiv(neu);
    }
  }

  // ── Liste in Sessions aufteilen: Quiz-Tab mit dieser Liste, alle Einstellungen wie gewohnt,
  // dann je Gruppe eine gespeicherte Konfiguration „Name (21 - 40)“ ──
  function starteAufteilen(listeId) {
    const liste = lsGet(SK.liste(listeId));
    if (!liste) return;
    setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotGeaendert(false); lsDel(SK.letzterSlot); zurUebersetzung();
    setQuizTabListen([listeId]);
    setQuizBereichTyp("alle"); setQuizCheckboxAuswahl(new Set()); setQuizListeAufgeklappt(false);
    setQuizVonBisModus(false); setQuizVonBisErster(null);
    setSlotSektionAufgeklappt(false); setListenAuswahlAufgeklappt(false);
    setAufteilen({ listeId, name: liste.name, groesse: 20, von: 1, bis: liste.vokabeln.length, restAnhaengen: false, gruppe: true });
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
    const data = rasterEinordnen(getSlotsData());
    const basisKonfig = aktuelleKonfiguration(false);
    const eintraege = neu.map((g, i) => ({
      id: neuerSlotId('g'), name: g.name, timestamp: Date.now() + i, sessionFortschritt: null,   // Platz: untereinander (Raster)
      konfiguration: { ...basisKonfig, listenIds: [aufteilen.listeId], bereichTyp: "bereich", quizBereichTyp: "bereich",
        vokabelAuswahl: stand.liste.vokabeln.slice(g.von - 1, g.bis).map(v => `${aufteilen.listeId}__${v.id}`) },
    }));
    // „In Gruppe zusammenfassen“: Gruppe mit dem Namen (vorhandene gleichen Namens wird ergänzt)
    let ordnerId = null, ordner = data.ordner || [];
    if (aufteilen.gruppe !== false && eintraege.length > 0) {
      const name = (aufteilen.name || "").trim() || stand.liste.name;
      ordnerId = ordner.find(o => o.name === name)?.id || neuerSlotId("ordner");
      if (!ordner.some(o => o.id === ordnerId)) ordner = [...ordner, { id: ordnerId, name }];
      eintraege.forEach(e => { e.ordner = ordnerId; });
    }
    setSlotsData(rasterEinordnen({ ...data, ordner, gespeichert: [...data.gespeichert, ...eintraege] }));
    setAufteilen(null);
    if (ordnerId) setSlotOrdner(ordnerId);
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

  // Auswahl löschen (nach Rückfrage): Konfigurationen bzw. Listen mit Vokabeln
  function loescheAuswahl() {
    const z = auswahlLoeschen;
    setAuswahlLoeschen(null);
    if (!z) return;
    if (z.art === "slot") { z.ids.forEach(id => loescheSlotEintrag("gespeichert", id)); setMultiAuswahl(null); return; }
    z.ids.forEach(id => lsDel(SK.liste(id)));
    speichereIndex(listenIndex.filter(l => !z.ids.includes(l.id)));
    if (z.ids.includes(aktiveListeId)) { setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null); }
    setListenWahl(null);
  }

  function loescheSlotEintrag(typ, id) {
    const data = getSlotsData();
    const updated = { ...data, [typ]: data[typ].filter(s => s.id !== id) };   // die Gruppe bleibt, auch leer
    setSlotsData(updated);
    if (lsGet(SK.letzterSlot) === id) lsDel(SK.letzterSlot);
    if (aktiverSlot?.typ === typ && aktiverSlot?.id === id) {
      setAktiverSlot(null); zurUebersetzung();
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
    const sessionObj = { slotTyp, slotId, art, listenIds: [...quizTabListen], vokabelAuswahl: Array.from(quizCheckboxAuswahl), bereichTyp: quizBereichTyp, abgefragt: [], gesamt: gesamtVoks, paketGroesse, startScores,
      startZeit: Date.now(), erst: {}, pakete: 0 };
    lsSet(SK.sessionAktiv, sessionObj);
    setSessionSlotAktiv(sessionObj);
    if (slotTyp && slotId) updateSlotSF(slotTyp, slotId, sessionSF(sessionObj), art);
    return sessionObj;
  }
  // Teil des Session-Objekts, der im Slot-Eintrag je Abfrageart gespeichert wird
  const sessionSF = x => ({ abgefragt: x.abgefragt, gesamt: x.gesamt, paketGroesse: x.paketGroesse, startScores: x.startScores, startZeit: x.startZeit, erst: x.erst, pakete: x.pakete });
  // Neuer Durchlauf einer bestehenden Session (nach „Nochmal“ / Durchlauf-Ende): Start-Scores, Startzeit,
  // erste Bewertungen und Paketzahl neu beginnen – für die Session-Auswertung am Ende
  function sessionDurchlaufStarten(slot, voks, feld) {
    if (slot.startScores && Object.keys(slot.startScores).length > 0) { setSessionSlotAktiv(slot); return; }
    const neu = { ...slot, startScores: Object.fromEntries(voks.map(v => [v.id, v[feld]?.score ?? null])), startZeit: Date.now(), erst: {}, pakete: 0 };
    lsSet(SK.sessionAktiv, neu);
    setSessionSlotAktiv(neu);
    if (neu.slotTyp && neu.slotId) updateSlotSF(neu.slotTyp, neu.slotId, sessionSF(neu), neu.art || "uebersetzung");
  }
  // Erste Bewertung je Vokabel in dieser Runde: "richtig" | "falsch" | "aufgedeckt"
  function erstAusQuiz(q) {
    if (!q) return {};
    if (q.modus !== "diktat") return q.gewertet || {};
    const erst = {};
    (q.diktatErgebnisse || []).forEach(e => { if (!(e.vokId in erst)) erst[e.vokId] = e.richtig ? "richtig" : "falsch"; });
    return erst;
  }

  function updateSessionSlotFortschritt(neueIds, isDurchlaufEnde) {
    const slot = lsGet(SK.sessionAktiv);
    if (!slot) return;
    const neuAbgefragt = isDurchlaufEnde ? [] : [...new Set([...(slot.abgefragt || []), ...neueIds])];
    // Durchlauf-Ende: Auswertungsdaten zurücksetzen (der nächste Durchlauf beginnt mit neuen Start-Scores)
    const updated = isDurchlaufEnde
      ? { ...slot, abgefragt: [], startScores: {}, startZeit: null, erst: {}, pakete: 0 }
      : { ...slot, abgefragt: neuAbgefragt,
          ...(slot.erst ? { erst: { ...slot.erst, ...erstAusQuiz(quiz) } } : {}),
          ...(slot.pakete != null ? { pakete: slot.pakete + 1 } : {}) };
    lsSet(SK.sessionAktiv, updated);
    setSessionSlotAktiv(updated);
    const { slotTyp, slotId } = slot;
    if (slotTyp && slotId) updateSlotSF(slotTyp, slotId, sessionSF(updated), slot.art || "uebersetzung");
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
    setListenAendern(false);
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
    setQuizArt("uebersetzung"); setQuizArtStash({});
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
    if (!quizTabListen.includes(id)) leuchte(`liste:${id}`);
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

  // Quiz-Tab: immer nur ein Bereich offen – wer einen öffnet, schließt alle anderen
  // aufgeklappter Zeilen-Knopf: oben der Wert (kurz), darunter „Bestätigen“ (antippen klappt zu)
  const offenText = (offen, kurz) => offen ? <span data-bestaetigen>Bestätigen</span> : kurz;
  function schliesseQuizBereiche(ausser) {
    if (ausser !== "slots") { setSlotSektionAufgeklappt(false); setMultiAuswahl(null); }
    if (ausser !== "listen") setListenAuswahlAufgeklappt(false);
    if (ausser !== "einzel") setQuizListeAufgeklappt(false);
    if (ausser !== "modus") setQuizAbfrageModusAufgeklappt(false);
    if (ausser !== "reihenfolge") setQuizReihenfolgeAufgeklappt(false);
    if (ausser !== "stufe") setQuizStufeAufgeklappt(false);
    if (ausser !== "einstellungen") setQuizEinstellungenAufgeklappt(false);
    if (ausser !== "session") setQuizSessionAufgeklappt(false);
  }
  function toggleSessionBereich(art) {
    if (quizSessionAufgeklappt !== art) schliesseQuizBereiche("session");
    setQuizSessionAufgeklappt(v => v === art ? false : art);
  }

  function toggleListenAuswahl() {
    const opening = !listenAuswahlAufgeklappt;
    if (opening) schliesseQuizBereiche("listen");
    else leuchte("listenkopf");
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
    if (opening) schliesseQuizBereiche("reihenfolge");
    setQuizReihenfolgeAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = reihenfolgeContainerRef.current;
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

  function toggleEinstellungen() {
    const opening = !quizEinstellungenAufgeklappt;
    if (opening) schliesseQuizBereiche("einstellungen");
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
    if (opening) schliesseQuizBereiche("modus");
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
    if (opening) schliesseQuizBereiche("einzel");
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
    clearTimeout(slotZuTimerRef.current);
    if (opening && tab === "quiz") schliesseQuizBereiche("slots");
    if (!opening) leuchte("slotkopf");
    setSlotSektionAufgeklappt(v => !v);
    setSlotSortModus(false); setSlotAuswahl([]); setMultiAuswahl(null);
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

  // zurück zur Übersicht – eingeklappt (alle Bereiche zu, nach oben); nur „Pause“ lässt die Bereiche, wie sie waren
  function beendeQuiz(einklappen = true) {
    setQuiz(null);
    setTab("quiz");
    setAnsicht("uebersicht");
    if (einklappen) klappeUebersichtEin();
  }
  function klappeUebersichtEin() {
    schliesseQuizBereiche();
    setQuizModusInfoAufgeklappt(false);
    requestAnimationFrame(() => window.scrollTo(0, 0));
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
          ? <span style={{fontWeight:800, fontSize:"1.1rem", color:"var(--haupt)", lineHeight:1}}>{Math.round(lernProzent(voks.map(v => v.fortschritt?.score), schwelle))} %</span>
          : <span style={{fontWeight:800, fontSize:"1.1rem", color:"var(--haupt)", lineHeight:1}}>Ø {avg === null ? "–" : `${avg > 0 ? "+" : ""}${avg.toFixed(1)}`}</span>}
        <div style={{display:"flex", width:"min(200px, 100%)", height:6, borderRadius:3, overflow:"hidden", background:"var(--flaeche)"}}>
          {voks.length > 0 && FORTSCHRITT_BALKEN.map(([g, farbe]) => anzahl[g] > 0 && (
            <div key={g} style={{width:`${anzahl[g] / voks.length * 100}%`, background:farbe}}/>
          ))}
        </div>
        <span style={{fontSize:"0.68rem", fontWeight:500, color:"var(--text2)", lineHeight:1}}>
          {schwelle > 0 ? `${anzahl.gelernt} / ${voks.length} gelernt` : `${voks.length} Vokabeln`}
        </span>
      </div>
    );
  }

  // Rundenergebnis im Kasten: Kreisdiagramm richtig/falsch, Zahlen daneben, Lern-Bilanz darunter
  function renderRundenErgebnis(q, r, f, titel) {
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

  // Fortschritt der ganzen Session während der Abfrage (Kopfzeile): frühere Pakete + Position im aktuellen
  // Paket; in der Wiederholung gilt das Paket als durch. Ohne Pakete: diese Runde.
  function sessionStandImQuiz(q) {
    const imPaket = q.wiederholungDurchgang ? (q.sessionVokIds || q.vokabeln).length : q.index;
    if (q.istSessionModus) {
      const slot = lsGet(SK.sessionAktiv);
      const vorher = (slot?.abgefragt || []).filter(id => !(q.sessionVokIds || []).includes(id)).length;
      // Gesamtzahl vom Session-Start (später gelernte Vokabeln fallen sonst aus der Zählung)
      const startAnzahl = Object.keys(slot?.startScores || {}).length;
      return { erledigt: vorher + imPaket, gesamt: Math.max(startAnzahl, q.sessionGesamt || 0) };
    }
    const gesamt = Object.keys(q.rundeStartScores || {}).length || q.vokabeln.length;
    return { erledigt: q.wiederholungDurchgang ? gesamt : q.index, gesamt };
  }
  function renderKopfFortschritt(q) {
    const { erledigt, gesamt } = sessionStandImQuiz(q);
    const pct = gesamt ? Math.min(100, erledigt / gesamt * 100) : 0;
    return (
      <span className="kopf-balken" data-kopf-fortschritt={`${erledigt}/${gesamt}`} {...tt(`Fortschritt der Session: ${erledigt} von ${gesamt} Vokabeln abgefragt`)}>
        <span style={{width:`${pct}%`}}/>
      </span>
    );
  }

  // ── Session-Auswertung (zweiter Bildschirm nach „Weiter →“) ──
  // Session mit Paketen: alle Vokabeln der Session seit Durchlauf-Start; sonst: diese Runde
  function sessionAuswertungDaten(q) {
    const slot = q.istSessionModus ? lsGet(SK.sessionAktiv) : null;
    const feld = q.scoreFeld || (q.modus === "diktat" ? "diktatFortschritt" : "fortschritt");
    const mitSession = !!(slot?.startScores && Object.keys(slot.startScores).length > 0);
    const start = mitSession ? slot.startScores : (q.rundeStartScores || {});
    const vokMap = new Map(q.liste.vokabeln.map(v => [v.id, v]));
    const ids = Object.keys(start).filter(id => feld !== "akzentFortschritt" || hatAkzentWort(vokMap.get(id)));
    const jetztMap = new Map(q.liste.vokabeln.map(v => [v.id, v[feld]?.score ?? null]));
    const jetzt = Object.fromEntries(ids.map(id => [id, jetztMap.has(id) ? jetztMap.get(id) : start[id]]));
    const erstRunde = erstAusQuiz(q);
    const erst = mitSession ? (slot.erst ? { ...slot.erst, ...erstRunde } : null) : erstRunde;
    const ohneAkzent = feld === "akzentFortschritt" ? Object.keys(start).length - ids.length : null;
    return { ids, start, jetzt, erst, ohneAkzent, startZeit: mitSession ? slot.startZeit : q.rundeStartZeit,
      pakete: mitSession ? (slot.pakete != null ? slot.pakete + 1 : null) : 1, mitSession };
  }
  function renderSessionAuswertung(d) {
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
            {d.mitSession ? "Ganze Session" : "Diese Runde"} · {d.ohneAkzent != null ? `${n} ${n === 1 ? "Wort" : "Wörter"} mit Akzent` : `${n} Vokabel${n !== 1 ? "n" : ""}`}
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
  // ganze Seite der Session-Auswertung mit den gewohnten Knöpfen darunter
  function sessionAuswertungSeite(q, knoepfe, schliessen) {
    return (
      <>
        <style>{CSS}</style>{farbModusUI}{farbRadUI}
        <div className="app">
          <div className="topbar">
            <button {...tt("Schließen – zurück zur Übersicht")} className="topbar-back" onClick={schliessen}>Schließen</button>
            <span className="topbar-title">Session-Auswertung</span>
            <span className="quiz-fortschritt"/>
          </div>
          <div className="sektion">
            {renderSessionAuswertung(sessionAuswertungDaten(q))}
            {knoepfe}
          </div>
        </div>
      </>
    );
  }
  // Paket-Ende: nächstes Paket wählen; Größen nur unterhalb des Session-Rests, beim Rest „Letzte N Vokabeln“
  const naechstesPaketUI = (rest, doWeiter, doBeende) => {
    const groessen = [5,10,15,20,25,30,40,50].filter(n => n < rest);
    const letzte = quizPaketGroesse >= rest;
    const n = Math.min(quizPaketGroesse, rest);
    return (
      <>
        {groessen.length > 0 && (
          <div style={{marginBottom:10}} data-paket-groessen>
            <div style={{fontSize:"0.78rem", color:"var(--text2)", marginBottom:6}}>Nächstes Paket:</div>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {groessen.map(g => (
                <button {...tt(`Nächstes Paket mit ${g} Vokabeln`)} key={g} className={`typ-btn${quizPaketGroesse===g?" aktiv":""}`}
                  onClick={() => setQuizPaketGroesse(g)}>{g}</button>
              ))}
            </div>
          </div>
        )}
        <button data-naechstes-paket={n} {...tt(letzte ? `Die letzten ${rest} Vokabeln dieser Session abfragen` : "Nächstes Paket starten – bereits abgefragte Vokabeln werden übersprungen")}
          className="btn btn-primary" style={{width:"100%", marginBottom:8}} onClick={() => doWeiter(quizPaketGroesse)}>
          {letzte ? `Letzte ${rest} Vokabel${rest !== 1 ? "n" : ""}` : `Nächste ${n} Vokabeln`}
        </button>
        <button {...tt("Pause – Fortschritt bleibt gespeichert, später über die Session weitermachen")} className="btn btn-ghost" style={{width:"100%"}} onClick={() => doBeende(false, true)} data-pause>Pause</button>
      </>
    );
  };
  // Sicherungs-Erinnerung (oben in der Session-Auswahl)
  const sicherungErinnerungUI = () => sicherungAlt && (
    <div className="meldung-info sicherung-erinnerung" data-sicherung-erinnerung>
      <div>💾 {sicherungAlt.nie ? "Noch keine Sicherung." : `Letzte Sicherung vor ${sicherungAlt.tage} Tagen.`} Der Browser kann gespeicherte Daten löschen – eine Sicherungsdatei schützt Listen, Scores und Farben.</div>
      <div style={{display:"flex", gap:8, marginTop:8}}>
        <button className="btn btn-primary btn-sm" data-sicherung-jetzt onClick={sichereAlles}
          {...tt("Alles in einer Datei sichern: Listen mit Scores, Einstellungen, Farben, gespeicherte Quiz")}>Jetzt sichern</button>
        <button className="btn btn-ghost btn-sm" data-sicherung-spaeter onClick={() => { const t = Date.now(); lsSet(SK.sicherungSpaeter, t); setSicherungSpaeter(t); }}
          {...tt("Erinnerung für einen Tag ausblenden")}>Später</button>
      </div>
    </div>
  );
  // zurück aus Liste/Import zu Einstellungen › Listen
  function zuEinstListen() { setTab("einstellungen"); setEinstBereich("listen"); setAnsicht("uebersicht"); setListenWahl(null); requestAnimationFrame(() => window.scrollTo(0, 0)); }
  const weiterZurAuswertung = (
    <button data-zur-auswertung {...tt("Weiter zur Auswertung der ganzen Session: Start und Ende im Vergleich")} className="btn btn-primary" style={{width:"100%", fontSize:"1.05rem"}}
      onClick={() => { setQuiz(q => q && { ...q, sessionAuswertung: true }); window.scrollTo(0, 0); }}>Weiter →</button>
  );

  // Lern-Bilanz am Rundenende: neu gelernte Vokabeln (Gelernt-Schwelle erreicht) bzw. Gratulation
  function renderLernBilanz(q) {
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

  // Namensvorschlag für gespeicherte Konfigurationen: Sprache(n) + Datum, eindeutig
  function slotNamenVorschlag() {
    const sprachen = [...new Set(quizTabListen.map(spracheVonListe))].map(c => sprachInfo(c).name);
    const multi = multiVonSlot(aktiverSlot);
    const basis = multi ? `Multiquiz: ${multi.map(t => t.name).join(" + ")}`
      : `${sprachen.length ? sprachen.join(" + ") : "Abfrage"} ${new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
    const namen = new Set(slots.gespeichert.map(x => x.name));
    let name = basis, n = 2;
    while (namen.has(name)) name = `${basis} (${n++})`;
    return name;
  }

  // Suchleiste über einer Vokabelliste (Einzelauswahl Quiz/Statistik, Listenansicht): Treffer anspringen (‹ ›, Enter)
  // oder mit „nur Treffer“ filtern. Zeilen tragen data-such-ziel={art} data-such-id={vok.id}.
  function suchInfo(voks, such) {
    const treffer = sucheVokabeln(voks, such.text);
    const nr = Math.min(such.nr, Math.max(0, treffer.length - 1));
    return { treffer, nr, ids: new Set(treffer.map(t => t.id)), aktuell: treffer[nr]?.id, filter: such.nurTreffer && !!such.text.trim() };
  }
  // Hervorhebung einer Zeile: aktueller Treffer kräftig, weitere Treffer zart (linker Rand)
  function suchMarke(info, id) {
    return id === info.aktuell ? { boxShadow:"inset 5px 0 0 var(--gelb)", outline:"2px solid var(--gelb)", outlineOffset:-2 }
      : info.ids.has(id) ? { boxShadow:"inset 5px 0 0 var(--gelb-zart)" } : {};
  }
  function springeZuTreffer(art, id) {
    requestAnimationFrame(() => document.querySelector(`[data-such-ziel="${art}"][data-such-id="${window.CSS.escape(String(id))}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }
  // Nach einer Aktion in der Vokabelliste (Häkchen, Von–Bis): Tastatur der Suche schließen und die Zeile im Blick halten –
  // verschoben wird nur, wenn sie danach verdeckt oder außerhalb liegt (Tastatur zu, Tafel unten, Liste länger), dann in die Mitte
  function sichtbarHalten(art, id) {
    const el = document.querySelector(`[data-such-ziel="${art}"][data-such-id="${window.CSS.escape(String(id))}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const vOben = vv ? vv.offsetTop : 0, vUnten = vOben + (vv ? vv.height : window.innerHeight);
    const scroller = el.closest("[data-vok-scroller]");
    const sr = scroller?.getBoundingClientRect();
    const leiste = document.querySelector(`[data-suchleiste="${art}"]`)?.getBoundingClientRect();
    const tafel = document.querySelector("[data-auswahl-tafel]")?.getBoundingClientRect();
    const oben = Math.max(vOben, sr ? sr.top : vOben, leiste ? leiste.bottom : vOben);
    const unten = Math.min(vUnten, sr ? sr.bottom : vUnten, tafel ? tafel.top : vUnten);
    if (r.top >= oben - 1 && r.bottom <= unten + 1) return;
    const dy = (r.top + r.height / 2) - (oben + unten) / 2;
    (scroller || window).scrollBy({ top: dy, behavior: "smooth" });
  }
  function zeileImBlick(art, id) {
    const f = document.activeElement;
    if (f?.matches?.("[data-such-feld]")) f.blur();
    [0, 150, 400, 800].forEach(ms => setTimeout(() => requestAnimationFrame(() => sichtbarHalten(art, id)), ms));
  }
  // Lang-Druck auf eine Vokabelzeile: Von–Bis mit dieser Vokabel als Anfang
  function vonBisLangDruck(art, vok, nr, w1, w2) {
    const [setModus, setErster] = art === "quiz" ? [setQuizVonBisModus, setQuizVonBisErster] : [setStatistikVonBisModus, setStatistikVonBisErster];
    const abbrechen = () => { vonBisTafelRef.current = null; setModus(false); setErster(null); };
    return tt("Vokabel aus- oder abwählen (bei Von–Bis: Anfang bzw. Ende des Bereichs) – lang drücken: Von–Bis ab hier",
      [{ label: "✕ Von–Bis abbrechen", fn: abbrechen }],
      { auswahl: { zu: () => abbrechen(), ohneText: true },
        beimMenue: () => { vonBisTafelRef.current = art; setModus(true); setErster(vok.id); zeileImBlick(art, vok.id); } });
  }
  function renderSuchleiste(art, voks, such, setSuch, top) {
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
    const label = {fontSize:"0.78rem", color:"var(--text2)", minWidth:84};
    return (
      <div data-aufteilen style={{background:"var(--gelb-flaeche)", border:"1.5px solid var(--gelb-zart)", borderRadius:12, padding:"12px 14px", margin:"12px 0 4px"}}>
        <div style={{fontWeight:700, color:"var(--gelb-dunkel)", marginBottom:12}} {...tt("Unten wie gewohnt Spalten, Abfrage-Modus, Reihenfolge und Einstellungen wählen – sie gelten für alle Sessions")}>„{stand.liste.name}“ in Sessions aufteilen</div>
        <div style={zeile}>
          <span style={label}>Name</span>
          <input {...ttFeld("Name der Sessions – die Nummern „(von - bis)“ werden angehängt")} data-aufteilen-name className="inp"
            style={{flex:1, minWidth:140, padding:"6px 10px"}} value={aufteilen.name} onChange={e => upd({ name: e.target.value })}/>
        </div>
        <div style={zeile}>
          <span style={label}>Gruppengröße</span>
          {AUFTEILEN_GROESSEN.map(n => (
            <button key={n} data-aufteilen-groesse={n} className={`toggle-opt${aufteilen.groesse === n ? " aktiv" : ""}`}
              style={{padding:"4px 9px", border:"1.5px solid var(--rahmen)", borderRadius:8}}
              onClick={() => upd({ groesse: n })} {...tt(`Je ${n} Vokabeln pro Session`)}>{n}</button>
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
                {...tt("Übrige Vokabeln als eigene, kleinere Session")}>eigene Gruppe</button>
              <button data-aufteilen-rest="anhaengen" className={`toggle-opt${aufteilen.restAnhaengen ? " aktiv" : ""}`} onClick={() => upd({ restAnhaengen: true })}
                {...tt("Übrige Vokabeln an die letzte Session anhängen")}>an letzte anhängen</button>
            </div>
          </div>
        )}
        <label style={{display:"flex", alignItems:"center", gap:8, fontSize:"0.82rem", color:"var(--text)", margin:"2px 0 10px", cursor:"pointer"}}
          {...ttFeld("Die neuen Sessions in einer Gruppe (Ordner) mit diesem Namen ablegen")}>
          <input type="checkbox" data-aufteilen-gruppe checked={aufteilen.gruppe !== false} onChange={e => upd({ gruppe: e.target.checked })} style={{width:18, height:18}}/>
          📁 In Gruppe „{(aufteilen.name || "").trim() || stand.liste.name}“ zusammenfassen
        </label>
        <div style={{fontSize:"0.78rem", color:"var(--text2)", marginBottom:4}}>Vorschau: {gruppen.length} Session{gruppen.length !== 1 ? "s" : ""}</div>
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

  // ── Farbschemata: 6 Vorlagen (nur duplizierbar) + eigene (bearbeiten, umbenennen, löschen) ──
  const eigeneSchemata = einstellungen.eigeneSchemata || [];
  const schemaName = (name) => {
    const namen = new Set([...FARB_VORLAGEN, ...eigeneSchemata].map(x => x.name.toLowerCase()));
    let n = `${name} (Kopie)`, i = 2;
    while (namen.has(n.toLowerCase())) n = `${name} (Kopie ${i++})`;
    return n;
  };
  function dupliziereSchema(sch) {
    const neu = { id: "eigen_" + Date.now(), name: schemaName(sch.name), basis: sch.basis || sch.id, dunkel: !!sch.dunkel, farben: { ...sch.farben }, elemente: { ...(sch.elemente || {}) } };
    speichereEinst({ ...einstellungen, eigeneSchemata: [...eigeneSchemata, neu], farbschema: neu.id });
    setSchemaBearbeiten(neu.id);
  }
  // 🎲 Zufällige Farben: ersetzt das Schema „Zufall“ (umbenannte oder duplizierte bleiben erhalten)
  function zufallsSchema() {
    const farben = zufallsFarben();
    const alt = eigeneSchemata.find(x => x.zufall && x.name === "Zufall");
    const sch = alt ? { ...alt, farben, elemente: {} } : { id: "zufall_" + Date.now(), name: "Zufall", basis: "natur", dunkel: false, zufall: true, farben, elemente: {} };
    speichereEinst({ ...einstellungen, farbschema: sch.id,
      eigeneSchemata: alt ? eigeneSchemata.map(x => x.id === alt.id ? sch : x) : [...eigeneSchemata, sch] });
    if (schemaBearbeiten && schemaBearbeiten !== sch.id) setSchemaBearbeiten(null);
  }
  function aendereEigenesSchema(id, aenderung) {
    speichereEinst({ ...einstellungen, eigeneSchemata: eigeneSchemata.map(x => x.id === id ? { ...x, ...aenderung(x) } : x) });
  }
  function loescheSchema(id) {
    speichereEinst({ ...einstellungen, eigeneSchemata: eigeneSchemata.filter(x => x.id !== id), farbschema: einstellungen.farbschema === id ? "natur" : einstellungen.farbschema });
    if (schemaBearbeiten === id) setSchemaBearbeiten(null);
    setModal(null); setSchemaMenueId(null);
  }
  const vollHex = h => /^#[0-9a-f]{3}$/i.test(h) ? "#" + h.slice(1).split("").map(c => c + c).join("") : h;
  function renderFarbschemata() {
    const aktivId = schemaVon(einstellungen).id;
    const bearb = eigeneSchemata.find(x => x.id === schemaBearbeiten);
    const vorlageVon = sch => FARB_VORLAGEN.find(v => v.id === sch.basis) || FARB_VORLAGEN[0];
    // Tab: zuletzt gewählter, sonst der des aktiven Schemas; beim Bearbeiten „Eigene“
    const ftab = bearb ? "eigene" : farbTab || (FARB_VORLAGEN.includes(schemaVon(einstellungen)) ? "vorlagen" : "eigene");
    const zufall = eigeneSchemata.find(x => x.zufall && x.name === "Zufall");
    const alle = ftab === "vorlagen" ? FARB_VORLAGEN : ftab === "eigene" ? eigeneSchemata.filter(x => x !== zufall) : [];
    return (<>
      <div className="toggle-btn" data-farb-tabs style={{display:"flex", marginBottom:10}}>
        {[["vorlagen", "Vorlagen", `Fertige Farbschemata (${FARB_VORLAGEN.length}) – antippen verwendet sie; zum Anpassen duplizieren`],
          ["eigene", "Eigene", `Deine eigenen Schemata (${eigeneSchemata.length}) – bearbeiten, umbenennen, löschen`],
          ["sprachen", "Sprachen", "Farben je Sprache: eigenes Schema, sobald der Sprachfilter auf einer Sprache steht bzw. eine Liste dieser Sprache abgefragt wird"],
          ["werkzeuge", "Werkzeuge", "Farben bearbeiten, Farbmodus"]].map(([k, label, info]) => (
          <button key={k} data-farb-tab={k} className={`toggle-opt${ftab === k ? " aktiv" : ""}`} style={{flex:1}}
            onClick={() => { setFarbTab(k); if (bearb && k !== "eigene") setSchemaBearbeiten(null); }} {...tt(info)}>{label}</button>
        ))}
      </div>
      <div className="karte" style={{padding:"12px 14px"}}>
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
              {...ttFeld("Ein: steht der Sprachfilter (🌐) auf einer Sprache oder wird eine Liste dieser Sprache abgefragt, gilt ihr Farbschema")}>
              <input type="checkbox" data-sprachfarben-an checked={!!sf.an} onChange={e => setze({ an: e.target.checked })} style={{width:18, height:18}}/>
              Farben je Sprache
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
      </div>
    </>);
  }

  // ── Aufräum-Werkzeug: Klammerhinweise der Wort-Spalten in eine Info-Spalte verschieben ──
  function klammerAenderungen(liste, ziel) {
    const quellen = TYPEN.filter(t => !t.startsWith("i") && liste.spalten[t]?.aktiv);
    return liste.vokabeln.map(v => {
      const hinweise = quellen.flatMap(t => hinweiseAus(v[t]?.wert));
      if (!hinweise.length) return null;
      const neu = { ...v };
      quellen.forEach(t => { if (v[t]?.wert && hinweiseAus(v[t].wert).length) neu[t] = { ...v[t], wert: ohneHinweis(v[t].wert) }; });
      const alt = v[ziel]?.wert?.trim();
      neu[ziel] = { wert: [alt, ...hinweise].filter(Boolean).join("; "), falsch: v[ziel]?.falsch || [] };
      return { vorher: v, nachher: neu, hinweise };
    }).filter(Boolean);
  }
  function verschiebeKlammern() {
    const aenderungen = klammerAenderungen(aktiveListe, klammerZiel);
    const neuMap = new Map(aenderungen.map(a => [a.vorher.id, a.nachher]));
    const sp = aktiveListe.spalten[klammerZiel];
    const neu = { ...aktiveListe, vokabeln: aktiveListe.vokabeln.map(v => neuMap.get(v.id) || v),
      spalten: { ...aktiveListe.spalten, [klammerZiel]: { ...sp, aktiv: true, name: sp?.name || "Hinweis" } } };
    lsSet(SK.liste(aktiveListe.id), neu); setAktiveListe(neu); speichereIndex(listenIndex);
    setModal(null);
  }

  // ── Farbwähler (Farbkreis): live über CSS-Variablen, ohne die App neu aufzubauen ──
  function oeffneFarbRad(rolle, titel, basis, ziel, el = null) {
    const r = el?.getBoundingClientRect();
    setFarbRad({ rolle, titel, start: vollHex(basis[rolle] || farbenAus(basis)[rolle] || "#000000").toLowerCase(), basis, ziel,
      rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
      oben: !!r && r.top + r.height / 2 > window.innerHeight / 2 });
  }
  // nur diese Element-Art: eigene Regel statt der Rolle
  function oeffneElementFarbRad(schluessel, eigenschaft, titel, el) {
    const r = el?.getBoundingClientRect();
    const cs = el ? getComputedStyle(el) : null;
    const jetzt = elementVorschau?.[schluessel]?.[eigenschaft] || (cs && farbeZuHex(cs.getPropertyValue(eigenschaft))) || "#000000";
    setFarbRad({ rolle: `${schluessel}|${eigenschaft}`, titel, start: vollHex(jetzt).toLowerCase(), element: { schluessel, eigenschaft },
      rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null, oben: !!r && r.top + r.height / 2 > window.innerHeight / 2 });
  }
  const liveElement = text => {
    let st = document.getElementById("farb-element-live");
    if (!st) { st = document.createElement("style"); st.id = "farb-element-live"; document.head.appendChild(st); }
    st.textContent = text;
  };
  const liveFarbe = hex => {
    if (!farbRad) return;
    if (farbRad.element) { liveElement(`${farbRad.element.schluessel}{${farbRad.element.eigenschaft}:${hex} !important}`); return; }
    const f = farbenAus(mitFestenSchriften(farbRad.basis, farbRad.rolle, hex));
    const root = document.documentElement.style;
    Object.entries(f).forEach(([k, v]) => root.setProperty("--" + k, v));
    setzeSystemLeiste(f.leiste);
  };
  const liveEntfernen = () => { const root = document.documentElement.style; Object.keys(F).forEach(k => root.removeProperty("--" + k)); setzeSystemLeiste(F.leiste); liveElement(""); };
  function farbRadAnwenden(hex) {
    const { rolle, ziel } = farbRad;
    const verlauf = [hex, ...(einstellungen.farbVerlauf || []).filter(x => x !== hex)].slice(0, 10);
    if (farbRad.element) {
      const { schluessel, eigenschaft } = farbRad.element;
      setElementVorschau(e => ({ ...(e || {}), [schluessel]: { ...(e?.[schluessel] || {}), [eigenschaft]: hex } }));
      speichereEinst({ ...einstellungen, farbVerlauf: verlauf });
      liveEntfernen(); setFarbRad(null); return;
    }
    if (ziel === "vorschau") { setFarbVorschau(f => mitFestenSchriften(f || farbRad.basis, rolle, hex)); speichereEinst({ ...einstellungen, farbVerlauf: verlauf }); }
    else speichereEinst({ ...einstellungen, farbVerlauf: verlauf,
      eigeneSchemata: eigeneSchemata.map(x => x.id === ziel ? { ...x, farben: mitFestenSchriften(x.farben, rolle, hex) } : x) });
    liveEntfernen(); setFarbRad(null);
  }
  function farbRadAbbrechen() { liveEntfernen(); setFarbRad(null); }
  // Farben des gerade bearbeiteten Schemas (Grundrollen + eigene Element-Farben), ohne Doppelte
  const farbenImSchema = () => {
    const sch = farbRad?.ziel && farbRad.ziel !== "vorschau" ? eigeneSchemata.find(x => x.id === farbRad.ziel) : null;
    const farben = sch ? sch.farben : (farbVorschau || schemaVon(einstellungen).farben);
    const elemente = sch ? sch.elemente : (elementVorschau || schemaVon(einstellungen).elemente);
    const alle = [...Object.values(farben || {}), ...Object.values(elemente || {}).flatMap(p => Object.values(p || {}))];
    return [...new Set(alle.filter(v => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)).map(v => vollHex(v).toLowerCase()))];
  };
  const farbRadUI = farbRad ? createPortal(
    <>
      {farbRad.rect && <div data-farbmodus-ui style={{position:"fixed", left: farbRad.rect.x - 3, top: farbRad.rect.y - 3, width: Math.max(farbRad.rect.w, 6) + 6, height: Math.max(farbRad.rect.h, 6) + 6,
        border:"2.5px dashed var(--falsch)", borderRadius:6, zIndex:10005, pointerEvents:"none", boxShadow:"0 0 0 2px var(--karte)"}}/>}
      <FarbRad key={farbRad.rolle + farbRad.start} titel={farbRad.titel} start={farbRad.start} verlauf={einstellungen.farbVerlauf || []} schema={farbenImSchema()} oben={farbRad.oben}
        beiLive={liveFarbe} beiAnwenden={farbRadAnwenden} beiAbbrechen={farbRadAbbrechen}/>
    </>, document.body) : null;

  // ── Farbmodus ──
  function starteFarbModus() {
    setFarbVorschau({ ...schemaVon(einstellungen).farben });
    setElementVorschau({ ...(schemaVon(einstellungen).elemente || {}) });
    setFarbModus(true); setSchemaBearbeiten(null);
  }
  function beendeFarbModus() { setFarbModus(false); setFarbVorschau(null); setElementVorschau(null); setFarbFeld(null); setFarbMarke(null); setFarbName(null); }
  // eigene Farbe einer Element-Art entfernen → wieder die Rolle
  function entferneElementFarbe(schluessel, eigenschaft) {
    setElementVorschau(e => {
      const p = { ...(e?.[schluessel] || {}) }; delete p[eigenschaft];
      const n = { ...(e || {}) }; if (Object.keys(p).length) n[schluessel] = p; else delete n[schluessel];
      return n;
    });
  }
  // „🎨 Farbe ändern“ aus einem Lang-Druck-Menü: Farbmodus an und gleich das Farbfeld dieser Stelle
  useEffect(() => {
    const hier = e => {
      const { x, y } = e.detail;
      if (!farbModusRef.current) starteFarbModus();
      setTimeout(() => setFarbFeld({ gruppen: farbRollenBei(x, y), zeit: Date.now(), y }), 80);
    };
    window.addEventListener("vokabel-farbe-hier", hier);
    return () => window.removeEventListener("vokabel-farbe-hier", hier);
  });
  function uebernehmeFarben(name = null) {
    const sch = schemaVon(einstellungen);
    if (FARB_VORLAGEN.includes(sch)) {
      if (name === null) { setFarbName(schemaName(sch.name)); setFarbFeld(null); return; }   // Vorlage: erst Namen für die Kopie
      const neu = { id: "eigen_" + Date.now(), name: name.trim() || schemaName(sch.name), basis: sch.id, dunkel: !!sch.dunkel, farben: { ...farbVorschau }, elemente: { ...(elementVorschau || {}) } };
      speichereEinst({ ...einstellungen, eigeneSchemata: [...eigeneSchemata, neu], farbschema: neu.id });
    } else {
      aendereEigenesSchema(sch.id, () => ({ farben: { ...farbVorschau }, elemente: { ...(elementVorschau || {}) } }));
    }
    beendeFarbModus();
  }
  // Farbrollen der Elemente im Umkreis von (x, y): je Element Hintergrund, Schrift, Rahmen bzw. bei Grafik Füllung, Linie
  function farbRollenBei(x, y) {
    const zuHex = farbeZuHex;
    // gleiche Farbe in mehreren Rollen (z. B. Weiß = Karten und Schrift auf Hauptfarbe): je nach Teil die naheliegende Rolle
    const VORZUG = { Schrift: ["auf-haupt", "auf-start", "text-stark", "text", "text2", "text3", "haupt", "falsch", "richtig"],
      Hintergrund: ["karte", "hintergrund", "flaeche", "haupt", "falsch", "gelb"], Füllung: ["karte", "haupt", "haupt-hell", "gelernt", "arbeit", "nie", "negativ"],
      "Ring/Linie": ["haupt-hell", "rahmen", "haupt"], Linie: ["rahmen", "text3", "haupt"], Rahmen: ["rahmen", "haupt", "falsch"] };
    const nachWert = (h, teil) => { if (!h) return null; const alle = Object.keys(F).filter(k => vollHex(F[k]).toLowerCase() === h);
      return (VORZUG[teil] || []).find(k => alle.includes(k)) || alle[0]; };
    const regeln = [];
    for (const sh of document.styleSheets) { try { regeln.push(...[...sh.cssRules].filter(r => r.selectorText)); } catch { /* fremdes Stylesheet */ } }
    const deklariert = (el, props) => {
      const st = el.getAttribute?.("style") || "";
      for (const p of props) { const m = st.match(new RegExp(`(?:^|;)\\s*${p}\\s*:[^;]*var\\(--([\\w-]+)\\)`)); if (m) return m[1]; }
      let gef = null;
      regeln.forEach(r => { let passt = false; try { passt = el.matches(r.selectorText); } catch { /* */ }
        if (passt) props.forEach(p => { const m = r.style.getPropertyValue(p).match(/var\(--([\w-]+)\)/); if (m) gef = m[1]; }); });
      return gef;
    };
    const elemente = new Set();
    for (const [dx, dy] of [[0, 0], [-14, 0], [14, 0], [0, -14], [0, 14], [-10, -10], [10, 10], [-10, 10], [10, -10]])
      document.elementsFromPoint(x + dx, y + dy).forEach(el => { if (!el.closest("[data-farbmodus-ui]") && el !== document.documentElement) elemente.add(el); });
    // kleine Grafiken (Mini-Kreise …): alle Teile mitnehmen – dünne Ringe trifft der Finger sonst kaum
    [...elemente].forEach(el => { const svg = el instanceof SVGElement ? el.ownerSVGElement || el : null;
      if (svg && svg.getBoundingClientRect().width <= 60) svg.querySelectorAll("circle, path, rect, line, polyline, text").forEach(t => elemente.add(t)); });
    const name = el => {
      const eigenerText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(" ").trim();
      const t = el.tagName.toLowerCase();
      const info = el.closest("[data-info]")?.getAttribute("data-info");
      if (t === "body") return "Seite";
      if (["circle", "path", "rect", "line", "polyline", "text"].includes(t)) return `Grafik${info ? " · " + info.split(/[–:]/)[0].trim() : ""}`;
      return (eigenerText || info || el.textContent.trim() || t).slice(0, 34);
    };
    const gruppen = [];
    [...elemente].map(el => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height).forEach(({ el, r }) => {
      const cs = getComputedStyle(el), teile = [];
      const svg = el instanceof SVGElement && el.tagName.toLowerCase() !== "svg";
      // Schrift ohne eigene Regel: von außen geerbte Rolle (z. B. Text im Start-Knopf), wenn die Farbe passt
      const geerbt = h => { for (let pe = el.parentElement, i = 0; pe && i < 4; pe = pe.parentElement, i++) { const r = deklariert(pe, ["color"]); if (r) return F[r] !== undefined && vollHex(F[r]).toLowerCase() === h ? r : null; } return null; };
      const dazu = (teil, wert, props) => { const h = zuHex(wert); if (!h) return; const rolle = (props && deklariert(el, props)) || (teil === "Schrift" && geerbt(h)) || nachWert(h, teil); if (rolle && F[rolle] !== undefined && !teile.some(t => t.rolle === rolle && t.teil === teil)) teile.push({ teil, rolle }); };
      if (svg) {
        if (cs.fill && cs.fill !== "none") dazu(el.tagName.toLowerCase() === "text" ? "Schrift" : "Füllung", cs.fill);
        if (cs.stroke && cs.stroke !== "none") dazu(el.tagName.toLowerCase() === "line" || el.tagName.toLowerCase() === "path" && cs.fill === "none" ? "Linie" : "Ring/Linie", cs.stroke);
      } else {
        dazu("Hintergrund", cs.backgroundColor, ["background", "background-color"]);
        if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) dazu("Schrift", cs.color, ["color"]);
        const seite = ["Top", "Right", "Bottom", "Left"].find(sd => parseFloat(cs[`border${sd}Width`]) > 0 && cs[`border${sd}Style`] !== "none");
        if (seite) dazu("Rahmen", cs[`border${seite}Color`], ["border", "border-color", `border-${seite.toLowerCase()}`, `border-${seite.toLowerCase()}-color`]);
      }
      if (teile.length && gruppen.length < 7) gruppen.push({ name: name(el), titel: elementName(el), el, teile, schluessel: elementSchluessel(el) });
    });
    return gruppen;
  }
  // langer Druck / Rechtsklick im Farbmodus → Farbfeld; Klicks direkt danach (Loslassen) werden verschluckt
  useEffect(() => {
    if (!farbModus) return;
    let timer = null, start = null, offenZeit = 0;
    const oeffne = (x, y) => { offenZeit = Date.now(); setFarbFeld({ gruppen: farbRollenBei(x, y), zeit: offenZeit, y }); setFarbMarke(null); };
    const ui = e => e.target.closest?.("[data-farbmodus-ui]");
    const runter = e => { if (ui(e)) return; const t = e.touches[0]; start = { x: t.clientX, y: t.clientY }; clearTimeout(timer); timer = setTimeout(() => oeffne(start.x, start.y), 500); };
    const bewegt = e => { const t = e.touches[0]; if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) clearTimeout(timer); };
    const hoch = e => { clearTimeout(timer); if (Date.now() - offenZeit < 600 && !ui(e)) e.preventDefault(); };
    const klick = e => { if (!ui(e) && Date.now() - offenZeit < 600) { e.preventDefault(); e.stopPropagation(); } };
    const kontext = e => { if (ui(e)) return; e.preventDefault(); e.stopPropagation(); oeffne(e.clientX, e.clientY); };
    document.addEventListener("touchstart", runter, true);
    document.addEventListener("touchmove", bewegt, true);
    document.addEventListener("touchend", hoch, { capture: true, passive: false });
    document.addEventListener("click", klick, true);
    document.addEventListener("contextmenu", kontext, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("touchstart", runter, true);
      document.removeEventListener("touchmove", bewegt, true);
      document.removeEventListener("touchend", hoch, { capture: true, passive: false });
      document.removeEventListener("click", klick, true);
      document.removeEventListener("contextmenu", kontext, true);
    };
  }, [farbModus]);   // eslint-disable-line react-hooks/exhaustive-deps
  const markiere = el => {
    const r = el.getBoundingClientRect();
    setFarbMarke({ x: r.left, y: r.top, w: Math.max(r.width, 6), h: Math.max(r.height, 6), zeit: Date.now() });
  };
  useEffect(() => {
    if (!farbMarke) return;
    const t = setTimeout(() => setFarbMarke(null), 1400);
    return () => clearTimeout(t);
  }, [farbMarke]);
  const rollenName = rolle => {
    const basis = FARB_BASIS[rolle] || rolle;
    const n = FARB_ROLLEN.find(([k]) => k === basis)?.[1] || basis;
    return FARB_BASIS[rolle] ? `${n} (abgestuft)` : n;
  };
  const farbModusUI = farbModus ? createPortal(
    <div data-farbmodus-ui>
      {farbMarke && !farbRad && <div style={{position:"fixed", left: farbMarke.x - 3, top: farbMarke.y - 3, width: farbMarke.w + 6, height: farbMarke.h + 6,
        border:"2.5px dashed var(--falsch)", borderRadius:6, zIndex:10004, pointerEvents:"none", boxShadow:"0 0 0 2px var(--karte)"}}/>}
      {farbFeld && !farbRad && (() => {
        // gegenüber der angetippten Stelle öffnen, damit das Element sichtbar bleibt; das kleinste Element bleibt markiert
        const oben = (farbFeld.y ?? 0) > window.innerHeight / 2;
        const ziel = farbFeld.gruppen[0]?.el?.getBoundingClientRect();
        return (
        <div className={`farbfeld-hintergrund${oben ? " oben" : ""}`} onClick={() => { if (Date.now() - farbFeld.zeit > 600) setFarbFeld(null); }}>
          {ziel && !farbMarke && <div data-farbfeld-ziel style={{position:"fixed", left: ziel.left - 3, top: ziel.top - 3, width: Math.max(ziel.width, 6) + 6, height: Math.max(ziel.height, 6) + 6,
            border:"2.5px dashed var(--falsch)", borderRadius:6, pointerEvents:"none", boxShadow:"0 0 0 2px var(--karte)"}}/>}
          <div className="farbfeld" data-farbfeld data-farbfeld-seite={oben ? "oben" : "unten"} onClick={e => e.stopPropagation()}>
            <div style={{display:"flex", alignItems:"center", marginBottom:6}}>
              <span style={{flex:1, fontWeight:800, color:"var(--text)"}}>🎨 Farben hier</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setFarbFeld(null)} {...ttFeld("Farbfeld schließen")}>Schließen</button>
            </div>
            {farbFeld.gruppen.length === 0 && <div style={{fontSize:"0.85rem", color:"var(--text2)"}}>Hier wurden keine Farben gefunden.</div>}
            {farbFeld.gruppen.map((g, gi) => (
              <div key={gi} style={{marginBottom:8}}>
                {g.teile.map(t => {
                  const basis = FARB_BASIS[t.rolle] || t.rolle;
                  const eig = TEIL_EIGENSCHAFT[t.teil];
                  const eigen = eig && elementVorschau?.[g.schluessel]?.[eig];
                  const titel = `${g.titel} · ${teilName(g.el, t.teil)}`;
                  const rolleAendern = () => { setFarbMarke(null); oeffneFarbRad(basis, `${rollenName(t.rolle)} – alle Stellen`, farbVorschau || schemaVon(einstellungen).farben, "vorschau", g.el); };
                  return (
                    <div key={t.teil + t.rolle}>
                      <div className="farb-zeile" data-farbfeld-zeile={basis} data-farbfeld-titel={titel} onPointerEnter={() => markiere(g.el)} onClick={rolleAendern}
                        {...ttFeld(`${titel}: ${eigen ? "eigene Farbe dieses Elements" : rollenName(t.rolle)} – antippen ändert die Rolle (alle Stellen)`)}>
                        <span className="farb-tupfer" style={{background: eigen || F[t.rolle]}}/>
                        <span style={{flex:1, minWidth:0, color:"var(--text)"}}>
                          <span style={{display:"block", fontSize:"0.88rem", fontWeight:700}}>{titel}</span>
                          <span className="farb-rolle" style={{display:"block", fontSize:"0.75rem", color:"var(--text2)"}}>{eigen ? <>eigene Farbe <span style={{color:"var(--text3)"}}>– sonst wie: {rollenName(t.rolle)}</span></> : <>gilt auch für: {rollenName(t.rolle)}</>}</span>
                        </span>
                      </div>
                      {eig && (
                        <div style={{display:"flex", gap:6, flexWrap:"wrap", margin:"2px 0 6px 30px"}}>
                          <button className="typ-btn" data-farbfeld-rolle={basis} onClick={rolleAendern}
                            {...ttFeld(`Rolle „${rollenName(t.rolle)}“ ändern – gilt für alle Stellen mit dieser Rolle`)}>Alle Stellen</button>
                          <button className="typ-btn" data-farbfeld-element={`${g.schluessel}|${eig}`}
                            onClick={() => { setFarbMarke(null); oeffneElementFarbRad(g.schluessel, eig, `${titel} – nur dieses Element`, g.el); }}
                            {...ttFeld("Nur diese Element-Art umfärben (alle gleichartigen Stellen), die Rolle bleibt")}>Nur dieses Element</button>
                          {eigen && <button className="typ-btn" data-farbfeld-zurueck={`${g.schluessel}|${eig}`} onClick={() => entferneElementFarbe(g.schluessel, eig)}
                            {...ttFeld(`Eigene Farbe entfernen – wieder „${rollenName(t.rolle)}“`)}>↺ Rolle</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{fontSize:"0.75rem", fontWeight:700, color:"var(--text2)", margin:"4px 0 2px"}}>System</div>
            <div className="farb-zeile" data-farbfeld-zeile="leiste" onClick={() => oeffneFarbRad("leiste", "App-Leiste (System)", farbVorschau || schemaVon(einstellungen).farben, "vorschau")}
              {...ttFeld("Leiste ganz oben (Uhrzeit, Akku) und unten – antippen, um die Farbe zu ändern")}>
              <span className="farb-tupfer" style={{background:"var(--leiste)"}}/>
              <span style={{flex:1, fontSize:"0.85rem", color:"var(--text)"}}><b>App-Leiste</b> · oben und unten (System)</span>
            </div>
          </div>
        </div>
        );
      })()}
      {farbName !== null && (
        <div className="farbfeld-hintergrund">
          <div className="farbfeld" data-farb-name onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:800, color:"var(--text)", marginBottom:6}}>Als eigenes Farbschema speichern</div>
            <div style={{fontSize:"0.8rem", color:"var(--text2)", marginBottom:8}}>Vorlagen bleiben unverändert – deine Farben kommen in eine Kopie.</div>
            <input {...ttFeld("Name des neuen Farbschemas")} className="inp" value={farbName} autoFocus onChange={e => setFarbName(e.target.value)}/>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFarbName(null)} {...tt("Zurück zum Farbmodus")}>Abbrechen</button>
              <button className="btn btn-primary" data-farb-name-speichern onClick={() => uebernehmeFarben(farbName)} {...tt("Farben als neues Schema speichern und den Farbmodus beenden")}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      <div className="farbmodus-leiste">
        <span style={{fontSize:"1rem", alignSelf:"center"}} {...ttFeld("Farbmodus: langer Druck auf ein Element ändert seine Farben")}>🎨</span>
        <button className="btn btn-ghost btn-sm" data-farbmodus-zuruecksetzen onClick={beendeFarbModus} {...ttFeld("Alle Änderungen verwerfen und den Farbmodus beenden")}>Zurücksetzen</button>
        <button className="btn btn-primary btn-sm" data-farbmodus-uebernehmen onClick={() => uebernehmeFarben()} {...ttFeld("Farben speichern und den Farbmodus beenden")}>Farben übernehmen</button>
      </div>
    </div>, document.body) : null;

  // Einstellung der Rastergröße (gespeicherte Konfigurationen bzw. Listen)
  function rasterEinstellung(g, setze, sub, hinweis, art) {
    const attr = (name, wert) => ({ [`data-${art ? art + "-" : ""}raster-${name}`]: wert });
    return (
      <div className="karte">
        <div className="karte-zeile" style={{flexDirection:"column", alignItems:"flex-start", gap:8}}>
          <div>
            <div className="karte-zeile-name" {...tt(hinweis)}>Raster</div>
            <div className="karte-zeile-sub">{g.spalten} Spalte{g.spalten > 1 ? "n" : ""} – {sub}</div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
            <span style={{fontSize:"0.8rem", color:"var(--text2)", minWidth:56}}>Spalten</span>
            {[1, 2, 3, 4].map(n => (
              <button key={n} {...attr("spalten", n)} className={`toggle-opt${g.spalten === n ? " aktiv" : ""}`}
                onClick={() => setze(g.zeilen, n)}
                {...tt(`${n} Spalte${n > 1 ? "n" : ""} nebeneinander (höchstens 4)`)}>{n}</button>
            ))}
          </div>
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

  // ── Beispielsätze ergänzen: Prompt für die nächste Portion, KI-Antwort einfügen, übernehmen ──
  async function oeffneSatzFenster(listeId) {
    setListenSaetze({ listeId, saetze: await saetzeLaden(listeId) });
    setSatzFenster({ listeId, antwort: "", meldung: "" });
    setModal("saetze");
  }
  function satzPortion(listeId, saetze, n) {
    const liste = lsGet(SK.liste(listeId));
    if (!liste) return null;
    const fremd = TYPEN.find(t => t.startsWith("E") && liste.spalten[t]?.aktiv), deutsch = TYPEN.find(t => t.startsWith("D") && liste.spalten[t]?.aktiv);
    const offen = liste.vokabeln.filter(v => v[fremd]?.wert && (saetze[`${listeId}__${v.id}`] || []).length < n);
    const alsDatei = einstellungen.satzWeg === "datei";
    const teil = offen.slice(0, alsDatei ? 2000 : SATZ_PORTION[n] || 30);
    const sprachName = sprachInfo(listeSprache(liste)).name;
    return { liste, offen: offen.length, gesamt: liste.vokabeln.length, teil, alsDatei,
      prompt: satzPrompt(sprachName, teil.map(v => `${v.id} // ${ohneHinweis(v[fremd].wert)} // ${ohneHinweis(v[deutsch]?.wert || "")}`), n, alsDatei) };
  }
  async function uebernehmeSaetze(text) {
    const f = satzFenster;
    if (!f) return;
    const neu = saetzeAusAntwort(typeof text === "string" ? text : f.antwort), liste = lsGet(SK.liste(f.listeId));
    const eintraege = {};
    let anzSaetze = 0;
    Object.entries(neu).forEach(([id, liste2]) => {
      if (!liste?.vokabeln.some(v => String(v.id) === id)) return;
      const key = `${f.listeId}__${id}`, alt = listenSaetze.saetze[key] || [];
      const zusammen = [...alt, ...liste2.filter(x => !alt.some(a => a.s === x.s))].slice(0, 10);
      anzSaetze += zusammen.length - alt.length;
      eintraege[key] = zusammen;
    });
    await saetzeSpeichern(eintraege);
    const saetze = await saetzeLaden(f.listeId);
    setListenSaetze({ listeId: f.listeId, saetze });
    setSatzFenster({ ...f, antwort: "", meldung: Object.keys(eintraege).length ? `${anzSaetze} Sätze für ${Object.keys(eintraege).length} Vokabeln übernommen.` : "Keine passenden Zeilen gefunden – Format „ID // Satz // Übersetzung“ mit *Wort*." });
  }
  // Sätze der Listen im Quiz-Tab für die Satz-Antwortarten bereithalten
  useEffect(() => {
    const ids = [...new Set([...quizTabListen, ...(aktiveListeId ? [aktiveListeId] : [])])];
    Promise.all(ids.map(id => saetzeLaden(id))).then(alle => { alle.forEach(x => Object.assign(SATZ_CACHE, x)); });
  }, [quizTabListen.join(), aktiveListeId, listenSaetze]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Sätze der geöffneten Liste laden
  useEffect(() => {
    if (ansicht !== "liste-detail" || !aktiveListeId || listenSaetze.listeId === aktiveListeId) return;
    saetzeLaden(aktiveListeId).then(saetze => setListenSaetze({ listeId: aktiveListeId, saetze }));
  }, [ansicht, aktiveListeId]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Menü einer Liste (lang drücken auf die Kachel bzw. auf den Namen im Listenkopf); imKopf: ohne Verschieben/Auswählen
  function oeffneListeDetail(id) {
    setAktiveListeId(id); setTab("listen"); setAnsicht("liste-detail"); window.scrollTo(0, 0); setVokabelAufgeklappt(false);
  }
  function listenMenue(l, imKopf = false) {
    const gefiltert = sprachFilter !== "alle";
    return [
      { label: "✎ Umbenennen", fn: () => { setListeMenueId(l.id); setModalInput(l.name); setModalFehler(""); setModal("umbenennen"); } },
      { label: "⧉ Duplizieren", fn: () => { setListeMenueId(l.id); setModalInput(listenKopieName(l.name)); setModalFehler(""); setModal("liste-duplizieren"); } },
      { label: "📤 Exportieren", fn: () => oeffneExport([l.id]) },
      { label: "✨ Beispielsätze ergänzen", fn: () => oeffneSatzFenster(l.id) },
      { label: "＋ Vokabeln importieren", fn: () => { resetImport(); setImportZielTyp("bestehend"); setImportBestehendId(l.id); setTab("listen"); setAnsicht("import"); } },
      { label: "( ) → Info", fn: () => {
        const ll = lsGet(SK.liste(l.id));
        if (!imKopf) oeffneListeDetail(l.id);
        setKlammerZiel(ll?.spalten.i1?.aktiv && ll?.spalten.i2?.aktiv ? "i2" : "i1"); setModal("klammern");
      } },
      ...(gefiltert || imKopf ? [] : [{ label: "⇄ Verschieben", fn: () => { setListenSortModus(true); setListenAuswahl([l.id]); } }]),
      ...(imKopf ? [] : [{ label: "☑ Auswählen", behalten: true, fn: () => { setListenSortModus(false); setListenWahl([l.id]); } }]),
      { label: "▦ In Sessions aufteilen", fn: () => starteAufteilen(l.id) },
      { label: "↺ Lernstand zurücksetzen", fn: () => { setListeMenueId(l.id); setZuruecksetzenArten(new Set(Object.keys(SCORE_FELD))); setModal("liste-zuruecksetzen"); } },
      { label: "🗑 Löschen", gefahr: true, fn: () => { setListeMenueId(l.id); setModal("loeschen"); } },
    ];
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
      if (l) { setListenAuswahl(a => a.includes(l.id) ? a.filter(x => x !== l.id) : [...a, l.id]); return; }
      if (listenAuswahl.length) setzeListenPlaetze(listenAuswahl, platz);
    };
    const oeffne = l => {
      if (listenWahl) {
        setListenWahl(a => a.includes(l.id) ? a.filter(x => x !== l.id) : [...a, l.id]);
      } else {
        oeffneListeDetail(l.id);
      }
    };
    const menue = l => listenMenue(l);
    // Auswahl-Modus: Aktionen für die Auswahl (Lang-Druck auf eine nicht gewählte Liste nimmt sie dazu)
    const wahlMit = l => listenWahl.includes(l.id) ? listenWahl : [...listenWahl, l.id];
    const wahlMenue = ids => [
      { label: `📤 Exportieren (${ids.length})`, behalten: true, fn: () => oeffneExport(ids) },
      ...(gefiltert ? [] : [{ label: "⇄ Verschieben", fn: () => { setListenWahl(null); setListenSortModus(true); setListenAuswahl(ids); } }]),
      { label: `🗑 Löschen (${ids.length})`, gefahr: true, fn: () => setAuswahlLoeschen({ art: "liste", ids }) },
      { label: "✕ Auswahl beenden", fn: () => setListenWahl(null) },
    ];
    const wahlNamen = ids => ids.map(id => listenIndex.find(x => x.id === id)?.name).filter(Boolean).join(", ");
    // Auswahl-Tafel: eine Liste → ihr Menü, mehrere → Aktionen für die Auswahl
    const tafelInhalt = ids => {
      const l = ids.length === 1 && listenIndex.find(x => x.id === ids[0]);
      if (l) return { text: l.name, aktionen: menue(l) };
      return ids.length ? { text: `${ids.length} ausgewählt: ${wahlNamen(ids)}`, aktionen: wahlMenue(ids) } : { text: "Nichts ausgewählt – Listen antippen", aktionen: [] };
    };
    auswahlTafelDaten.current.liste = () => listenWahl && tafelInhalt(listenWahl);
    const zelle = (l, key) => {
      const anzahl = vokabelAnzahl(l.id);
      const liste = lsGet(SK.liste(l.id));
      const aktSpalten = liste ? TYPEN.filter(t => liste.spalten[t].aktiv) : [];
      const ziel = slotDragZiel === key && slotDragId && slotDragId !== l.id;
      // Lang-Druck (Maus: Rechtsklick): Liste kommt in die Auswahl, die Tafel bleibt unten offen (weitere antippen wählt mit aus);
      // Touch: Haltestufen (kurz halten + ziehen verschiebt, lang halten + fahren wählt aus)
      const tafel = tafelInhalt(listenWahl ? wahlMit(l) : [l.id]);
      const erklaerung = sortModus && !listenWahl ? tt(`${l.name} – antippen markiert (mehrere möglich), dann freien Platz antippen; oder direkt ziehen – markierte wandern zusammen`)
        : tt(listenWahl ? `${l.name} – antippen: auswählen oder abwählen; lang drücken: Aktionen für die Auswahl (Export, Verschieben, Löschen)` : "Liste öffnen: Vokabeln, Spalten, Sprache, Export",
          tafel.aktionen, { langText: tafel.text, auswahl: auswahlTafel("liste"), eigeneGeste: true,
            beimMenue: () => { auswahlTafelRef.current = "liste"; setListenSortModus(false); setListenWahl(a => a ? (a.includes(l.id) ? a : [...a, l.id]) : [l.id]); } });
      return (
        <div {...erklaerung} key={key} data-raster-zelle={gefiltert ? undefined : key} data-liste-id={l.id} data-auswahl-durchlass className="karte-zeile"
          data-kachel-geste={sortModus ? undefined : "liste"} data-kachel-zieh={sortModus || gefiltert ? undefined : ""} data-angehoben={angehoben === l.id ? "" : undefined}
          style={{cursor: sortModus ? "grab" : "pointer", ...(sortModus ? {touchAction:"none"} : {}),
            ...((listenAuswahl.includes(l.id) && sortModus) || listenWahl?.includes(l.id) || (lasso?.art === "liste" && lasso.ids.includes(l.id)) ? {outline:"3px solid var(--gelb)", outlineOffset:1} : {}),
            ...(slotDragId && (slotDragId === l.id || (listenAuswahl.includes(slotDragId) && listenAuswahl.includes(l.id))) ? {opacity:0.4, borderStyle:"dashed"} : {}),
            ...(ziel ? {outline:"3px solid var(--haupt-hell)", outlineOffset:1} : {}), position:"relative"}}
          onPointerDown={sortModus ? (e => { slotZiehenRef.current = { art: "liste", id: l.id, x: e.clientX, y: e.clientY, aktiv: false }; }) : undefined}
          onClick={() => sortModus ? tippeImRaster(l, l.platz) : (slotGezogenRef.current ? (slotGezogenRef.current = false) : oeffne(l))}>
          {sortModus && listenAuswahl.includes(l.id) && <span className="auswahl-nr" data-auswahl-nr>{listenAuswahl.indexOf(l.id) + 1}</span>}
          {listenWahl?.includes(l.id) && <span className="auswahl-nr" data-wahl-nr={listenWahl.indexOf(l.id) + 1}>{listenWahl.indexOf(l.id) + 1}</span>}
          {eng ? (
            <div className="karte-zeile-info">
              <div className="karte-zeile-name">{listenFlagge(l)}{l.name}</div>
              <div className="karte-zeile-sub">{anzahl} Vokabel{anzahl !== 1 ? "n" : ""}</div>
              {(einstellungen.gelerntSchwelle ?? 0) > 0 && liste?.vokabeln.length > 0 && (
                <span className="mini-kreise" data-listen-kreise style={{marginTop:4}}>{renderMiniKreise(lernstandJeArt(liste.vokabeln, liste.id), { groesse: 22 })}</span>
              )}
            </div>
          ) : (<>
                  <div className="karte-zeile-info">
                    <div className="karte-zeile-name">{listenFlagge(l)}{l.name}</div>
                    <div className="karte-zeile-sub">
                      {anzahl} Vokabel{anzahl !== 1 ? "n" : ""}{" "}
                      {aktSpalten.map(t => <span key={t} className="spalten-badge aktiv">{liste.spalten[t].name || t}</span>)}
                    </div>
                  </div>
                  {(einstellungen.gelerntSchwelle ?? 0) > 0 && liste?.vokabeln.length > 0 && (
                    <span className="mini-kreise" data-listen-kreise style={{flexShrink:0}}>{renderMiniKreise(lernstandJeArt(liste.vokabeln, liste.id), { groesse: 26 })}</span>
                  )}
            {!listenWahl && !sortModus && <span style={{color:"var(--text2)"}}>{">"}</span>}
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
      const zeilenAnzeige = sortModus ? belegtBis + RASTER_FREI_ZEILEN : belegtBis;
      for (let z = 0; z < zeilenAnzeige; z++) for (let sp = 0; sp < groesse.spalten; sp++) {
        const key = `${z}|${sp}`;
        const l = platzMap.get(key);
        const ziel = slotDragZiel === key && slotDragId && !l;
        if (l) zellen.push(zelle(l, key));
        else if (sortModus) zellen.push(<div key={key} data-raster-zelle={key} className="raster-leer"
          style={{borderStyle:"dashed", cursor: listenAuswahl.length ? "pointer" : "default",
            ...(ziel ? {borderColor:"var(--haupt-hell)", background:"var(--haupt-flaeche)"} : {})}}
          onClick={() => tippeImRaster(null, { z, s: sp })}
          {...tt("Freier Platz – markierte Listen hier untereinander einsetzen (oder Listen hierher ziehen)")}/>);
        else zellen.push(<div key={key} className="raster-leer" style={{border:"none"}}/>);
      }
    }
    return (<>
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6, minHeight:22}}>
        <span style={{fontSize:"0.72rem", color:"var(--text2)"}} {...(listenWahl ? { "data-wahl-hinweis": true } : {})}
          {...(listenWahl ? tt(`Auswahl: antippen wählt aus oder ab, lang drücken: Exportieren${gefiltert ? "" : ", Verschieben"}, Löschen`)
            : sortModus ? tt("Verschieben: Listen antippen markiert (mehrere möglich), dann freien Platz antippen – oder direkt ziehen; auf einem belegten Platz rücken die Einträge auf die frei gewordenen Plätze")
            : {})}>
          {listenWahl
            ? (exportKopiert ? "✓ In die Zwischenablage kopiert" : <b data-wahl-anzahl={listenWahl.length}>☑ {listenWahl.length} ausgewählt</b>)
            : sortModus && listenAuswahl.length ? `${listenAuswahl.length} markiert` : ""}
        </span>
        {listenWahl && (<span style={{marginLeft:"auto", display:"flex", gap:6, flexShrink:0}}>
          <button className="typ-btn" data-wahl-alle data-auswahl-durchlass style={{fontSize:"0.7rem", padding:"2px 8px"}}
            onClick={() => setListenWahl(a => [...a, ...sichtbareListen.map(x => x.id).filter(id => !a.includes(id))])}
            {...tt("Alle sichtbaren Listen auswählen")}>Alle</button>
          <button className="typ-btn aktiv" data-wahl-fertig data-auswahl-durchlass style={{fontSize:"0.7rem", padding:"2px 8px"}} onClick={() => setListenWahl(null)}
            {...tt("Auswahl beenden")}>Fertig</button>
        </span>)}
        {sortModus && (
          <button data-listen-fertig className="typ-btn aktiv" style={{fontSize:"0.7rem", padding:"2px 8px", marginLeft:"auto"}}
            onClick={() => { setListenSortModus(false); setSlotDragId(null); setListenAuswahl([]); setSlotDragZiel(null); }}
            {...tt("Verschieben beenden")}>
            Fertig
          </button>
        )}
      </div>
      <div className={`listen-raster${eng ? " eng" : ""}`} data-lasso={sortModus ? undefined : "liste"} style={{gridTemplateColumns:`repeat(${groesse.spalten}, minmax(0, 1fr))`}}>
        {zellen}
      </div>
    </>);
  }

  // Chips "Gespeichert" (sortierbar) und "Verlauf" (automatisch, letzte 5) – Quiz- und Statistik-Tab
  // Kopfzeile Verlauf & Gespeichert (Quiz- und Statistik-Tab): zu und auf gleich aufgebaut – Name + Ü/D/A;
  // aufgeklappt zusätzlich eine Info-Zeile (Listen · Nr. · Anzahl). Langer Druck (Quiz): Speichern.
  // Speichern-Menü der Session (lang drücken auf den Session-Namen bzw. den Start-Knopf)
  function sessionSpeicherAktionen() {
    if (!quizKombiListe) return null;
    if (vokabelgruppeGeaendert && aktiverSlot?.typ === "gespeichert") {
      const name = getSlotEintrag("gespeichert", aktiverSlot.id)?.name || "";
      return [
        { label: `💾 Überspeichern „${name}“`, fn: ueberspeichereSession },
        { label: "💾 Als neue Session speichern", fn: () => { setModalInput(slotNamenVorschlag()); setModal("slot-speichern"); } },
        { label: "↺ Verwerfen", fn: () => ladeSlot(aktiverSlot.typ, aktiverSlot.id) },
      ];
    }
    return [{ label: "💾 Speichern", fn: () => oeffneModal("slot-speichern") }];
  }
  function renderSlotKopf(statistik) {
    const zu = !slotSektionAufgeklappt;
    const slot = statistik ? statistikAktiverSlot : aktiverSlot;
    const gespeichert = slot?.typ === "gespeichert";
    const geaendert = !statistik && vokabelgruppeGeaendert;
    const gruen = gespeichert && !geaendert;
    const multi = multiVonSlot(slot);
    const name = gespeichert ? (getSlotEintrag("gespeichert", slot.id)?.name || slot.id) : multi ? "Multiquiz" : statistik && statistikSlotGeleert ? "Leer" : statistik ? "Neue Auswahl" : "Neues Quiz";
    const ungespeichert = !statistik && !gespeichert && !multi;
    // Vokabeln der Auswahl (für die Kreise) und Info-Zeile
    let voks = [], listenIds = [];
    if (statistik) {
      voks = statistikBasisVoks || [];
      if (statistikBereichTyp === "bereich" && statistikCheckboxAuswahl.size > 0) voks = voks.filter(v => statistikCheckboxAuswahl.has(v.id));
      listenIds = statistikListenIds ? [...statistikListenIds] : sichtbareListen.map(l => l.id);
    } else if (quizKombiListe) {
      voks = quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0 ? quizKombiListe.vokabeln.filter(v => quizCheckboxAuswahl.has(v.id)) : quizKombiListe.vokabeln;
      listenIds = quizTabListen;
    }
    const ls = lernstandJeArt(voks);
    const listenText = listenIds.map(id => listenIndex.find(l => l.id === id)?.name).filter(Boolean).join(" + ") || "keine Liste";
    let bereichText = "";
    const bereichAktiv = statistik ? statistikBereichTyp === "bereich" && statistikCheckboxAuswahl.size > 0 : quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0;
    if (bereichAktiv && listenIds.length === 1) {
      const alle = lsGet(SK.liste(listenIds[0]))?.vokabeln || [];
      const auswahl = statistik ? statistikCheckboxAuswahl : quizCheckboxAuswahl;
      const nr = alle.map((v, i) => auswahl.has(`${listenIds[0]}__${v.id}`) ? i + 1 : null).filter(Boolean);
      bereichText = nr.length && nr[nr.length - 1] - nr[0] + 1 === nr.length ? `Nr. ${nr[0]}–${nr[nr.length - 1]}` : "Auswahl";
    } else if (bereichAktiv) bereichText = "Auswahl";
    const info = [multi ? `🧩 ${multi.map(t => t.name).join(" + ")}` : listenText, multi ? "" : bereichText, `${voks.length} Vokabel${voks.length !== 1 ? "n" : ""}`].filter(Boolean).join(" · ");
    const aktionen = !statistik ? sessionSpeicherAktionen() : null;
    return (
      <div ref={slotSektionRef} data-slot-kopf={zu ? (gruen ? "gruen" : "zu") : "offen"} className={`slot-kopf${gruen ? " gruen" : ""}`}
        style={{top:headerH, ...(statistik ? {} : {marginLeft:"-16px", marginRight:"-16px"}), ...(!statistik && quizVokMax ? {display:"none"} : {})}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <button onClick={toggleSlotSektion} className={`toggle-opt aktiv slot-kopf-name${zu ? blitzt("slotkopf") : ""}`} data-slot-kopf-name data-geaendert={geaendert ? "" : undefined}
            style={geaendert ? {background:"var(--falsch)", color:"var(--auf-falsch)"} : undefined}
            {...tt(geaendert ? `${name} – Vokabelauswahl geändert, noch nicht gespeichert; lang drücken: überspeichern, als neue Session speichern oder verwerfen`
              : gespeichert ? `${name} – antippen: gespeicherte Konfigurationen anzeigen${aktionen ? "; lang drücken: speichern" : ""}` : `Verlauf und Gespeichert anzeigen${aktionen ? "; lang drücken: speichern" : ""}`, aktionen, { langText: name })}>
            {name}{ungespeichert && <span data-nicht-gespeichert style={{fontSize:"0.72em", fontWeight:500, opacity:0.8, marginLeft:8}}>nicht gespeichert</span>}
          </button>
          {voks.length > 0 && !zu && (
            <span className="mini-kreise" {...(statistik ? { "data-statistik-arten": true } : { "data-quiz-arten": true })} style={{gap:4, flexShrink:0}}>
              {renderMiniKreise(ls, { aktiv: statistik ? statistikArt : quizArt, beiKlick: a => statistik ? setStatistikArt(a) : wechsleQuizArt(a),
                groesse: 30, aufGruen: gruen, attr: statistik ? "data-statistik-art" : "data-quiz-art", nurVerfuegbar: true })}
            </span>
          )}
        </div>
        {!zu && <div data-kopf-info className="slot-kopf-info">{info}</div>}
      </div>
    );
  }

  // Lernfortschritt je Art (Mini-Kreise) für eine Vokabelmenge; aus = keine passenden Vokabeln
  function lernstandJeArt(voks, listeId = null) {
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    return Object.fromEntries(QUIZ_ARTEN.map(a => {
      const sicht = statistikSicht(voks, a, listeId);
      return [a, { pct: lernProzent(sicht.map(v => v.fortschritt?.score), schwelle), aus: sicht.length === 0 }];
    }));
  }
  // Antwortarten einer Spalte als Mehrfach-Schalter: mehrere angehakt → je Frage zufällig eine.
  // Akzente nur bei Fremdsprachen-Spalten und eingeschalteten Akzenten; mindestens eine Art außer Akzente bleibt an
  function renderModusKnoepfe(typ) {
    const aktiv = modiVon(quizSpalteModus[typ]);
    const akzentMoeglich = typ.startsWith("E") && quizTabListen.some(id => AKZENTE_FUER_LISTE(id));
    const umschalten = m => setQuizSpalteModus(p => {
      const spalten = quizModus === "rotierend" ? (quizAusgewaehlt.length ? quizAusgewaehlt : [typ]) : quizAntwortTypenGeordnet.length ? quizAntwortTypenGeordnet : [typ];
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
      <button key={m} {...tt(istRunde(m) ? text : `${text} – mehrere angehakt: je Frage eine davon nach der Gewichtung (Einstellungen › Lernen)`)} data-modus-knopf={`${typ}:${m}`}
        className={`spalten-modus-btn${aktiv.includes(m) ? " aktiv" : ""}`} onClick={() => umschalten(m)}>{label}</button>
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
      { key: "grund", knoepfe: gruppe(["karte", "mc", "tippen", "akzent"]) },
      { key: "wort", knoepfe: gruppe(["hoeren", "puzzle", "luecke", "artikel"]) },
      { key: "satz", knoepfe: gruppe(["satzfinden", "satzbauen", "lueckensatz"]), extra: ueb },
      { key: "runde", knoepfe: gruppe(["zuordnung", "memory"]) },
    ].filter(z => z.knoepfe.length);
    return (
      <div data-modus-gruppen>
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
  function renderMiniKreise(ls, { aktiv = null, beiKlick = null, groesse = 24, aufGruen = false, attr = "data-mini-kreis", nurVerfuegbar = false } = {}) {
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

  function renderSlotBereiche(neuChip, onLaden, slotRef, abstand = 0) {
    // Lernfortschritt je Art für die Mini-Kreise (jede Liste nur einmal lesen)
    const listenCache = new Map();
    const listeVon = id => { if (!listenCache.has(id)) listenCache.set(id, lsGet(SK.liste(id))); return listenCache.get(id); };
    const aktArt = tab === "statistik" ? statistikArt : quizArt;
    const lernstand = x => {
      const k = x.konfiguration || {};
      let voks = (k.listenIds || []).flatMap(id => (listeVon(id)?.vokabeln || []).map(v => ({ ...v, _key: `${id}__${v.id}`, _listeId: id })));
      if (k.bereichTyp === "bereich" && k.vokabelAuswahl?.length) { const a = new Set(k.vokabelAuswahl); voks = voks.filter(v => a.has(v._key)); }
      return lernstandJeArt(voks);
    };
    const verlauf = slots.verlauf.filter(slotSichtbar);
    const label = {fontSize:"0.72rem", color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"};
    // Raster: alle Einträge (auch andere Sprache) belegen ihren Platz; sichtbar nur die der gewählten Sprache
    const groesse = rasterGroesse(einstellungen);
    // Ebene: oberste (Gruppen + Sessions ohne Gruppe) oder die geöffnete Gruppe
    const ordnerOffen = (slots.ordner || []).find(o => o.id === slotOrdner) || null;
    const raster = ordneRaster(ebeneVon(slots, ordnerOffen?.id || null), groesse);
    const kinderVon = id => slots.gespeichert.filter(s => s.ordner === id);
    const sichtbarE = x => x.istOrdner ? (sprachFilter === "alle" || kinderVon(x.id).length === 0 || kinderVon(x.id).some(slotSichtbar)) : slotSichtbar(x);
    const platzMap = new Map(raster.gespeichert.map(x => [`${x.platz.z}|${x.platz.s}`, x]));
    const sichtbar = raster.gespeichert.filter(x => sichtbarE(x) && !x.istOrdner);
    const zeilenAnzeige = slotSortModus ? raster.gespeichert.reduce((m, x) => Math.max(m, x.platz.z + 1), 0) + RASTER_FREI_ZEILEN
      : raster.gespeichert.filter(sichtbarE).reduce((m, x) => Math.max(m, x.platz.z + 1), 0);
    const sfVon = x => slotSFAlle(x)[aktiverSlot?.id === x.id ? quizAbfrageArt : slotKonfigArt(x)];
    // Auswahl-Modus: Aktionen für die Auswahl (Lang-Druck auf eine nicht gewählte Kachel nimmt sie dazu)
    const wahlMit = x => multiAuswahl.includes(x.id) ? multiAuswahl : [...multiAuswahl, x.id];
    const wahlMenue = ids => [
      ...(ids.length >= 2 ? [tab === "quiz" ? { label: `🧩 Multiquiz starten (${ids.length})`, fn: () => starteMultiquiz(ids) } : { label: `🧩 Multiquiz (${ids.length})`, fn: () => stelleMultiquizEin(ids) }] : []),
      { label: `📁 In Gruppe… (${ids.length})`, fn: () => setInGruppe({ ids, name: "" }) },
      ...(ordnerOffen ? [{ label: `↑ Aus der Gruppe (${ids.length})`, fn: () => verschiebeInOrdner(ids, null) }] : []),
      { label: "⇄ Verschieben", fn: () => { setMultiAuswahl(null); setSlotSortModus(true); setSlotAuswahl(ids); } },
      { label: `🗑 Löschen (${ids.length})`, gefahr: true, fn: () => setAuswahlLoeschen({ art: "slot", ids }) },
      { label: "✕ Auswahl beenden", fn: () => setMultiAuswahl(null) },
    ];
    const wahlNamen = ids => ids.map(id => slots.gespeichert.find(g => g.id === id)?.name).filter(Boolean).join(", ");
    const einzelMenue = x => [
      { label: "✎ Umbenennen", fn: () => setSlotUmbenennen({ id: x.id, name: x.name }) },
      { label: "⧉ Duplizieren", fn: () => setSlotUmbenennen({ id: x.id, name: kopieName(x.name), kopie: true }) },
      { label: "⇄ Verschieben", fn: () => { setMultiAuswahl(null); setSlotSortModus(true); setSlotAuswahl([x.id]); } },
      { label: "☑ Auswählen", behalten: true, fn: () => { setSlotSortModus(false); setMultiAuswahl([x.id]); } },
      { label: "📁 In Gruppe…", fn: () => setInGruppe({ ids: [x.id], name: "" }) },
      ...(ordnerOffen ? [{ label: "↑ Aus der Gruppe", fn: () => verschiebeInOrdner([x.id], null) }] : []),
      { label: "📝 Listen/Vokabeln ändern", fn: () => { if (slotRef?.id !== x.id) onLaden('gespeichert', x.id); setListenAendern(true); setSlotSektionAufgeklappt(false); } },
      { label: "🗑 Löschen", gefahr: true, fn: () => setLoescheSlotNr({ typ: 'gespeichert', id: x.id }) },
    ];
    // Auswahl-Tafel: eine Session → ihr Menü, mehrere → Aktionen für die Auswahl
    const tafelInhalt = ids => {
      const x = ids.length === 1 && slots.gespeichert.find(g => g.id === ids[0]);
      if (x) return { text: x.name, aktionen: einzelMenue(x) };
      return ids.length ? { text: `${ids.length} ausgewählt: ${wahlNamen(ids)}`, aktionen: wahlMenue(ids) } : { text: "Nichts ausgewählt – Sessions antippen", aktionen: [] };
    };
    auswahlTafelDaten.current.slot = () => multiAuswahl && tafelInhalt(multiAuswahl);
    // Ziehen: diese Kacheln wandern mit; über einer anderen verweilen bildet eine Gruppe (nur oberste Ebene, keine Gruppen in Gruppen)
    const ziehIds = slotDragId ? (slotAuswahl.includes(slotDragId) ? slotAuswahl : [slotDragId]) : [];
    const gruppierbar = !!slotDragId && !ordnerOffen && ziehIds.every(id => !(slots.ordner || []).some(o => o.id === id));
    const tippeImRaster = (x, platz) => {
      if (slotGezogenRef.current) { slotGezogenRef.current = false; return; }
      if (x) { setSlotAuswahl(a => a.includes(x.id) ? a.filter(v => v !== x.id) : [...a, x.id]); return; }
      if (slotAuswahl.length) setzeSlotPlaetze(slotAuswahl, platz);
    };
    const zellen = [];
    for (let z = 0; z < zeilenAnzeige; z++) for (let sp = 0; sp < groesse.spalten; sp++) {
      const key = `${z}|${sp}`;
      const x = platzMap.get(key);
      const ziel = slotDragZiel === key && slotDragId && slotDragId !== x?.id;
      if (x && sichtbarE(x)) {
        const kinder = x.istOrdner ? kinderVon(x.id) : null;
        const pct = x.istOrdner
          ? (kinder.length ? Math.round(kinder.reduce((a, k) => a + lernstand(k).uebersetzung.pct, 0) / kinder.length) : 0)
          : Math.round(lernstand(x).uebersetzung.pct);
        const multiNr = multiAuswahl ? multiAuswahl.indexOf(x.id) + 1 : 0;
        const verweilen = ziel && gruppierbar && !ziehIds.includes(x.id);
        const inhalt = (<>
          <span className="raster-name">{x.istOrdner && <span aria-hidden="true">📁 </span>}{x.multi && <span aria-hidden="true">🧩 </span>}{x.name}{x.istOrdner && <span className="ordner-anzahl" data-ordner-anzahl={kinder.length}> · {kinder.length}</span>}</span>
          <span className="raster-fuss" data-kachel-balken={pct} {...ttFeld(`Lernfortschritt Übersetzung: ${pct} %`)}>
            <span className={`kachel-balken${pct >= 100 ? " voll" : ""}`}><span style={{width:`${pct}%`}}/></span>
            {pct >= 100 && <span className="kachel-voll" title="100 % gelernt">✓</span>}
          </span>
        </>);
        zellen.push(slotSortModus ? (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} data-ordner-id={x.istOrdner ? x.id : undefined} className={`slot-chip belegt raster-chip${x.istOrdner ? " ordner-kachel" : ""}`}
            style={{touchAction:"none", cursor:"grab",
              ...(slotAuswahl.includes(x.id) ? {outline:"3px solid var(--gelb)", outlineOffset:1} : {}),
              ...(slotDragId && (slotDragId === x.id || (slotAuswahl.includes(slotDragId) && slotAuswahl.includes(x.id))) ? {opacity:0.4, borderStyle:"dashed"} : {}),
              position:"relative",
              ...(ziel ? {outline:"3px solid var(--haupt-hell)", outlineOffset:1} : {})}}
            onPointerDown={e => { slotZiehenRef.current = { id: x.id, x: e.clientX, y: e.clientY, aktiv: false }; }}
            onClick={() => tippeImRaster(x, x.platz)}
            {...tt(`${x.name} – antippen markiert (mehrere möglich), dann freien Platz antippen; oder direkt ziehen – markierte wandern zusammen`)}>
            {inhalt}
            {slotAuswahl.includes(x.id) && <span className="auswahl-nr" data-auswahl-nr>{slotAuswahl.indexOf(x.id) + 1}</span>}
            {verweilen ? (
              <span className={`gruppen-ring${gruppenZiel === key ? " fertig" : ""}`} data-gruppen-ring={gruppenZiel === key ? "fertig" : "laeuft"}>
                <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/></svg><span>📁</span>
              </span>
            ) : null}
          </button>
        ) : x.istOrdner ? (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} data-ordner-id={x.id} data-kachel-geste="ordner" data-kachel-zieh="" data-angehoben={angehoben === x.id ? "" : undefined}
            className={`slot-chip belegt raster-chip ordner-kachel${slotRef?.typ === "gespeichert" && kinder.some(k => k.id === slotRef.id) ? " ordner-aktiv" : ""}`}
            style={{position:"relative"}}
            onClick={() => { if (slotGezogenRef.current) { slotGezogenRef.current = false; return; } if (!multiAuswahl) setSlotOrdner(x.id); }}
            {...tt(`Gruppe „${x.name}“ mit ${kinder.length} Session${kinder.length !== 1 ? "s" : ""} – antippen öffnet sie`, multiAuswahl ? [] : [
              { label: "📂 Öffnen", fn: () => setSlotOrdner(x.id) },
              ...(kinder.length >= 2 ? [{ label: `🧩 Multiquiz der Gruppe (${kinder.length})`, fn: () => tab === "quiz" ? starteMultiquiz(kinder.map(k => k.id)) : stelleMultiquizEin(kinder.map(k => k.id)) }] : []),
              { label: "✎ Umbenennen", fn: () => setOrdnerUmbenennen({ id: x.id, name: x.name }) },
              { label: "⇄ Verschieben", fn: () => { setMultiAuswahl(null); setSlotSortModus(true); setSlotAuswahl([x.id]); } },
              kinder.length ? { label: "📤 Gruppe auflösen", fn: () => loeseOrdnerAuf(x.id) } : { label: "🗑 Gruppe löschen", gefahr: true, fn: () => loeseOrdnerAuf(x.id) },
            ], { langText: `📁 ${x.name}`,
                 beimZeigen: (px, py) => { slotZiehenRef.current = { id: x.id, x: px, y: py, aktiv: false, langdruck: true }; } })}>
            {inhalt}
            {null}
          </button>
        ) : (
          <button key={key} data-raster-zelle={key} data-slot-id={x.id} data-multi-nr={multiNr || undefined} data-auswahl-durchlass
            data-kachel-geste="slot" data-kachel-zieh="" data-angehoben={angehoben === x.id ? "" : undefined}
            className={`slot-chip belegt raster-chip${!multiAuswahl && slotRef?.typ === "gespeichert" && slotRef?.id === x.id ? " aktiv-kachel" : ""}${blitzt(`slot:${x.id}`)}`}
            style={{...chipStil('gespeichert', x.id, slotRef), position:"relative", ...(multiNr || (lasso?.art === "slot" && lasso.ids.includes(x.id)) ? {outline:"3px solid var(--gelb)", outlineOffset:1} : {})}}
            onClick={() => multiAuswahl
              ? setMultiAuswahl(a => a.includes(x.id) ? a.filter(v => v !== x.id) : [...a, x.id])
              : (leuchte(`slot:${x.id}`), onLaden('gespeichert', x.id))}
            {...(() => {
              // Lang-Druck (Maus: Rechtsklick): Session kommt in die Auswahl, die Tafel bleibt unten offen (weitere antippen wählt mit aus);
              // Touch: Haltestufen (kurz halten + ziehen verschiebt, lang halten + fahren wählt aus)
              const tafel = tafelInhalt(multiAuswahl ? wahlMit(x) : [x.id]);
              return tt(multiAuswahl
              ? `${x.name} – antippen: auswählen oder abwählen; lang drücken: Aktionen für die Auswahl (Multiquiz, Verschieben, Löschen)`
              : `${x.name} – antippen: Konfiguration laden (Liste, Vokabelauswahl, Einstellungen, Fortschritt)`, tafel.aktionen,
               { langText: tafel.text, auswahl: auswahlTafel("slot"),
                 beimMenue: () => { auswahlTafelRef.current = "slot"; setSlotSortModus(false); setMultiAuswahl(a => a ? (a.includes(x.id) ? a : [...a, x.id]) : [x.id]); },
                 eigeneGeste: true });
            })()}>
            {inhalt}
            {multiNr ? <span className="auswahl-nr">{multiNr}</span> : null /* gleiche Kind-Struktur wie im Verschieben-Modus (Markierungsnummer) – sonst baut React den Inhalt neu auf und ein laufendes Ziehen verliert den Finger */}
          </button>
        ));
      } else if (x) {
        // Eintrag einer anderen Sprache: Platz belegt, aber hier nicht bedienbar
        zellen.push(<div key={key} className="raster-leer" style={{opacity: slotSortModus ? 0.6 : 0, fontSize:"0.65rem", color:"var(--text3)"}}>andere Sprache</div>);
      } else if (slotSortModus) {
        zellen.push(<div key={key} data-raster-zelle={key} className="raster-leer"
          style={{borderStyle:"dashed", cursor: slotAuswahl.length ? "pointer" : "default",
            ...(ziel ? {borderColor:"var(--haupt-hell)", background:"var(--haupt-flaeche)"} : {})}}
          onClick={() => tippeImRaster(null, { z, s: sp })}
          {...tt("Freier Platz – markierte Pakete hier untereinander einsetzen (oder Pakete hierher ziehen)")}/>);
      } else {
        zellen.push(<div key={key} className="raster-leer" style={{border:"none"}}/>);
      }
    }
    return (<>
      <div style={{margin:`0 ${abstand}px 12px`}}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6, minHeight:22}}>
          {ordnerOffen ? (
            <span data-ordner-pfad style={{display:"flex", alignItems:"center", gap:6, minWidth:0}}>
              <button className="typ-btn" data-ordner-zurueck data-raus-ziel={slotDragZiel === "raus" ? "" : undefined}
                style={{fontSize:"0.75rem", padding:"3px 9px", ...(slotDragZiel === "raus" && slotDragId ? {outline:"3px solid var(--haupt-hell)", outlineOffset:1} : {})}}
                onClick={() => { setSlotOrdner(null); setSlotSortModus(false); setSlotAuswahl([]); }}
                {...tt("Zurück zu allen Sessions – Sessions hierher ziehen nimmt sie aus der Gruppe")}>← Alle Sessions</button>
              <span style={{...label, color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>› 📁 {ordnerOffen.name}</span>
            </span>
          ) : <span style={label}>📌 Gespeichert</span>}
          <span className="slot-kopf-knoepfe" style={{marginLeft:"auto", display:"flex", gap:6, alignItems:"center"}}>
            {!slotSortModus && !multiAuswahl && neuChip}
            {multiAuswahl && (<>
              <button className="typ-btn" data-wahl-alle data-auswahl-durchlass style={{fontSize:"0.7rem", padding:"2px 8px"}}
                onClick={() => setMultiAuswahl(a => [...a, ...sichtbar.map(x => x.id).filter(id => !a.includes(id))])}
                {...tt("Alle sichtbaren Konfigurationen auswählen")}>Alle</button>
              <button className="typ-btn aktiv" data-wahl-fertig data-auswahl-durchlass style={{fontSize:"0.7rem", padding:"2px 8px"}}
                onClick={() => { const ids = multiAuswahl; if (ids.length >= 2) stelleMultiquizEin(ids); else { setMultiAuswahl(null); if (ids.length === 1) onLaden('gespeichert', ids[0]); } }}
                {...tt("Auswahl übernehmen: mehrere → Multiquiz einstellen (Einstellungen von Nr. 1), eine → diese Session laden, keine → Auswahl beenden")}>Fertig</button>
            </>)}
            {slotSortModus && (
              <button className="typ-btn aktiv" style={{fontSize:"0.7rem", padding:"2px 8px"}}
                onClick={() => { setSlotSortModus(false); setSlotDragId(null); setSlotAuswahl([]); setSlotDragZiel(null); }}
                {...tt("Verschieben beenden")}>
                Fertig
              </button>
            )}
          </span>
        </div>
        {multiAuswahl && <div data-wahl-hinweis style={{fontSize:"0.72rem", color:"var(--text2)", marginBottom:6}}
          {...tt("Auswahl: antippen wählt aus oder ab, lang drücken: Multiquiz, Verschieben, Löschen. „Fertig“: mehrere → Multiquiz (Einstellungen von Nr. 1), eine → laden")}>
          <b data-wahl-anzahl={multiAuswahl.length}>☑ {multiAuswahl.length} ausgewählt</b>
          {multiAuswahl.length >= 2 ? ` · ${multiZusammenstellung(multiAuswahl)?.anzahl || 0} Vokabeln` : ""}
        </div>}
        {slotSortModus && slotAuswahl.length > 0 && <div style={{fontSize:"0.72rem", color:"var(--text2)", marginBottom:6}}
          {...tt(`Verschieben: freien Platz antippen (dort untereinander) oder ziehen; belegter Platz: Einträge rücken auf die frei gewordenen Plätze. ${ordnerOffen ? "Auf „← Alle Sessions“ ziehen: aus der Gruppe." : "Beim Ziehen 1,2 s über einer Session oder Gruppe halten: Gruppe."}`)}>
          {slotAuswahl.length} markiert
        </div>}
        {zellen.length > 0 && (
          <div className="slot-raster" data-lasso={slotSortModus ? undefined : "slot"} style={{gridTemplateColumns:`repeat(${groesse.spalten}, minmax(0, 1fr))`}}>
            {zellen}
          </div>
        )}
      </div>
      {verlauf.length > 0 && !slotSortModus && !ordnerOffen && (
        <div style={{margin:`0 ${abstand}px 14px`, paddingTop:10, borderTop:"1px dashed var(--rahmen)"}}>
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

  // Runde verlassen: zurück ins Lernen, in die Statistik (Gruppen-Runde) oder zur Übersicht
  function verlasseRunde() { if (quiz?.ausLernen) zurueckZumLernen(); else if (quiz?.ausStatistik) zurueckZurStatistik(); else beendeQuiz(); }
  function zurueckZumLernen() {
    quizStufeRef.current = null;
    setQuiz(null);
    setAnsicht("uebersicht");
    setLernen(l => l && naechstesLernPaket(l));
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
      const answeredIds = quiz.zuordnung ? [...new Set(quiz.zuordnung.beantwortet || [])] : quiz.wiederholungDurchgang ? (quiz.sessionVokIds || []) : [...new Set(
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
          sessionDurchlaufStarten(existingSlot, voks, "diktatFortschritt");
        }
      } else {
        if (!existingSlot || konflikt || !effSlot || overrideSlot !== null) {
          const verlaufId = overrideSlot?.typ === 'verlauf' ? overrideSlot.id : erstelleVerlaufEintrag();
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v.diktatFortschritt?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, 'verlauf', verlaufId);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          sessionDurchlaufStarten(existingSlot, voks, "diktatFortschritt");
        }
      }
    }
    if (reihenfolgeQ === "schlechteste" && maxScoreQ !== "" && !isNaN(parseFloat(maxScoreQ))) {
      const threshold = parseFloat(maxScoreQ);
      const gelerntDabei = v => !gruppe && quizGelerntEinschliessen && schwelleDiktat > 0 && gelerntScore(v, true) >= schwelleDiktat;
      voks = voks.filter(v => gelerntDabei(v) || (v.diktatFortschritt?.score ?? 0) < threshold);
    }
    voks = ordneVokabeln(voks, "diktatFortschritt", reihenfolgeQ, unbeantwortetQ);
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
      sessionGesamt, scoreFeld: "diktatFortschritt", rundeStartZeit: Date.now(),
      rundeStartScores: Object.fromEntries(voks.map(v => [v.id, v.diktatFortschritt?.score ?? null])),
    });
    setAnsicht("quiz");
  }

  // Regeln der laufenden Runde: Stufe der Einstellungen; Quiz nach dem Lernen ("lernen"): Regeln wie Leicht,
  // wie Schwer oder ohne Hilfen (Standard; „Lernen einstellen“), aber nie ein Punktabzug –
  // eine einmalige Gelegenheit, den Score zu verbessern
  function quizRegeln() {
    if (quizStufeRef.current !== "lernen") return stufenRegeln(einstellungen);
    const qs = lernEinstellungen().quizStufe;
    const r = { ...stufenRegeln({ ...einstellungen, modus: qs === "einfach" ? "einfach" : "schwer" }), falschAbzug: false, aufdeckenAbzug: false };
    return qs === "ohne" ? { ...r, akzentHervorheben: false, akzentZaehler: false, akzenteTolerant: false } : r;
  }

  // stufe (optional): "lernen" = Quiz nach dem Lernen (nur Verbesserung möglich)
  function starteQuiz(force = false, overrideSlot = null, gruppe = null, stufe = null) {
    quizStufeRef.current = stufe;
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
    const akzentOhneAuslassen = !quizRegeln().akzentOhneMischen;
    voks = voks.filter(v => antwortSpaltenFuer(v, quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet,
      quizSpalteModus, akzentOhneAuslassen).length > 0);
    const scoreFeld = quizModus !== "rotierend" && quizAntwortTypenGeordnet.length > 0
      && quizAntwortTypenGeordnet.every(t => quizSpalteModus[t] === "akzent") ? "akzentFortschritt" : "fortschritt";
    const gruppeVokIds = voks.map(v => v.id);   // ganze Vokabelgruppe inkl. Gelernter (für Lern-Bilanz)
    const schwelleQ = einstellungen.gelerntSchwelle ?? 0;
    if (!gruppe && !quizGelerntEinschliessen && schwelleQ > 0)
      voks = voks.filter(v => (v[scoreFeld]?.score ?? -Infinity) < schwelleQ);
    // Score-Grenze (Reihenfolge "schlechteste") gehört zur Session-Menge – wie die Anzeige im Quiz-Tab
    // eingeschaltete Gelernte gehören zur Session – die Score-Grenzen gelten für sie nicht
    const gelerntDabei = v => !gruppe && quizGelerntEinschliessen && schwelleQ > 0 && (v[scoreFeld]?.score ?? -Infinity) >= schwelleQ;
    if (reihenfolgeQ === "schlechteste" && maxScoreQ !== "" && !isNaN(parseFloat(maxScoreQ))) {
      const threshold = parseFloat(maxScoreQ);
      voks = voks.filter(v => gelerntDabei(v) || (v[scoreFeld]?.score ?? 0) < threshold);
    }
    // Abfrage-Ziel Score (global): nur Vokabeln unter dem Ziel kommen in die Session
    if (!gruppe && abfrageZielModus === "score" && abfrageZielScoreTyp !== "session")
      voks = voks.filter(v => gelerntDabei(v) || (v[scoreFeld]?.score ?? 0) < abfrageZielScore);
    const nurAkzentQ = scoreFeld === "akzentFortschritt";
    if (nurAkzentQ && !gruppe) {
      const laufend = isPakete ? lsGet(SK.sessionAktiv) : null;
      const festeIds = laufend && !sessionSlotKonflikt() && Object.keys(laufend.startScores || {}).length > 0 ? new Set(Object.keys(laufend.startScores)) : null;
      voks = begrenzeOhneAkzent(voks, quizAntwortTypenGeordnet, festeIds);
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
          sessionDurchlaufStarten(existingSlot, voks, scoreFeld);
        }
      } else {
        if (!existingSlot || konflikt || !effSlot || overrideSlot !== null) {
          const verlaufId = overrideSlot?.typ === 'verlauf' ? overrideSlot.id : erstelleVerlaufEintrag();
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v[scoreFeld]?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, 'verlauf', verlaufId);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          sessionDurchlaufStarten(existingSlot, voks, scoreFeld);
        }
      }
    }

    voks = ordneVokabeln(voks, scoreFeld, reihenfolgeQ, unbeantwortetQ);

    if (nurAkzentQ && quizRegeln().akzentOhneMischen) voks = verteileOhneAkzent(voks, quizAntwortTypenGeordnet);
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
    const spalteModus0 = loeseSpaltenModusAuf(quizSpalteModus, voks[0], frageTyp);
    const ersterModusTyp0 = spalteModus0[antwortTypen[0]] || STANDARD_ANTWORT_MODUS;
    const erstesMC = istMC(ersterModusTyp0)
      ? generiereButtons(voks, voks[0], antwortTypen[0], ersterModusTyp0) : null;

    const startScoresZiel = abfrageZielModus === "score" && abfrageZielScoreTyp === "session"
      ? Object.fromEntries(voks.map(v => [v.id, Math.min(10, Math.max(-10, v[scoreFeld]?.score ?? 0))]))
      : null;
    const abfrageZiel = abfrageZielModus !== "anzahl" || abfrageZielAnzahl > 1
      ? { modus: abfrageZielModus, anzahl: abfrageZielAnzahl, wiederholung: abfrageZielWiederholung,
          score: abfrageZielScore, scoreTyp: abfrageZielScoreTyp, runde: 0, startScoresZiel,
          ...(abfrageZielModus === "blitz" ? { sek: BLITZ_SEKUNDEN, ende: Date.now() + BLITZ_SEKUNDEN * 1000 } : {}) }
      : null;

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const neuQuiz = {
      sitzungsInfoTypen, modus: quizModus, spalteModus: spalteModus0, spalteModusBasis: quizSpalteModus,
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
      rundeStartScores: Object.fromEntries(voks.map(v => [v.id, v[scoreFeld]?.score ?? null])), rundeStartZeit: Date.now(),
      gruppeVokIds, scoreFeld,
      ...(abfrageZiel?.modus === "blitz" || abfrageZiel?.modus === "serie" ? { spielZaehler: 0, spielBeantwortet: [], spielBasis: voks } : {}),
    };
    // Zuordnung: Runden zu mehreren Vokabeln (Frage-Spalte + Antwort-Spalten, höchstens 4)
    const wechselnd = quizModus === "rotierend";
    const zuoTypen = wechselnd ? alleAbfragbar : quizAntwortTypenGeordnet;
    const mitZuo = !gruppe ? zuoTypen.filter(t => modiVon(quizSpalteModus[t]).some(istRunde)) : [];
    const nurZuordnung = mitZuo.length > 0 && zuoTypen.every(t => modiVon(quizSpalteModus[t]).every(istRunde));
    const rundenArten = mitZuo.length ? modiVon(quizSpalteModus[mitZuo[0]]).filter(istRunde) : [];
    if (mitZuo.length) {
      const ze = zuordnungEinst(einstellungen), r = quizRegeln();
      const grenze = Math.max(3, Math.min(window.innerWidth > 700 ? 12 : 10, Math.floor((window.innerHeight - 250) / 52)));
      const basis = { spalten: (wechselnd ? alleAbfragbar : [quizFrageTyp, ...quizAntwortTypenGeordnet]).slice(0, 4), wechselnd, paare: Math.max(3, Math.min(ze.paare, grenze)), zeit: ze.zeit, sek: ze.sek,
        amEnde: !!r.zuordnungAmEnde, abzug: !!r.zuordnungAbzug, runde: 0, arten: rundenArten };
      if (nurZuordnung) {
        neuQuiz.abfrageZiel = null;
        neuQuiz.zuordnung = { ...basis, queue: voks.map(v => v.id), beantwortet: [] };
        setQuiz(zuordnungRunde(neuQuiz));
      } else setQuiz(mitZuordnungMix({ ...neuQuiz, zuordnungMix: basis }));
    } else setQuiz(neuQuiz);
    setAnsicht("quiz");
  }

  // ── Zuordnung: nächste Runde aus der Warteschlange (nicht beantwortete kommen vorne wieder hinein) ──
  function zuordnungRunde(q) {
    const z = q.zuordnung;
    if (!z.queue.length) return { ...q, phase: "fertig" };
    const art = gewichtetWaehlen(z.arten?.length ? z.arten : ["zuordnung"]);
    const k = Math.min(art === "memory" ? Math.min(z.paare, 8) : z.paare, z.queue.length);
    return zuordnungRundeAus({ ...q, zuordnung: { ...z, queue: z.queue.slice(k) } }, z.queue.slice(0, k), art);
  }
  function zuordnungRundeAus(q, ids, art = "zuordnung") {
    const z = q.zuordnung, k = ids.length;
    const alleSpalten = z.alleSpalten || z.spalten;
    const fremdSp = alleSpalten.find(t => t.startsWith("E"));
    const spalten = art !== "memory" ? alleSpalten : !fremdSp || alleSpalten.slice(0, 2).includes(fremdSp) ? alleSpalten.slice(0, 2) : [alleSpalten[0], fremdSp];
    const vok = id => q.vokabeln.find(v => v.id === id);
    const mische = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    // „wechselnd“: je Zeile zufällig, welche Spalte links steht (bei zwei Spalten: Seiten getauscht oder nicht)
    const n = spalten.length, dreh = Object.fromEntries(ids.map(id => [id, z.wechselnd ? Math.floor(Math.random() * n) : 0]));
    const karten = spalten.map((_, sp) => mische(ids.map(id => { const t = spalten[(sp + dreh[id]) % n]; return { id, typ: t, text: vok(id)?.[t]?.wert || "" }; })));
    // Memory: je Vokabel zwei verdeckte Karten (Frage und Antwort), gemischt
    const mKarten = art === "memory" ? mische(ids.flatMap(id => spalten.map((t, seite) => ({ id, seite, text: vok(id)?.[t]?.wert || "" })))) : null;
    return { ...q, phase: "zuordnung", zuordnung: { ...z, art, alleSpalten, spalten, ids, karten, mKarten, mOffen: [], mZuege: 0, runde: z.runde + 1,
      erledigt: {}, fehler: {}, offen: null, gruppen: [], offeneGruppe: null, blink: null, anzeige: null, zeitBis: art === "memory" ? null : zuordnungZeitBis({ ...z, spalten }, k) } };
  }
  // Memory: zwei Karten aufdecken; Frage + Antwort derselben Vokabel → Paar gefunden (+1), sonst nach kurzer Zeit wieder zu
  function memoryTippe(i) {
    const q = quiz, z = q?.zuordnung;
    if (!z || z.art !== "memory" || z.anzeige || z.mOffen.length >= 2) return;
    const k = z.mKarten[i];
    if (k.id in z.erledigt || z.mOffen.includes(i)) return;
    if (einstellungen.autoplay && z.spalten[k.seite].startsWith("E")) { const v = q.vokabeln.find(x => x.id === k.id); sprich(k.text, vokLang(v, z.spalten[k.seite])); }
    const offen = [...z.mOffen, i];
    if (offen.length < 2) { setQuiz({ ...q, zuordnung: { ...z, mOffen: offen } }); return; }
    const [a, b] = offen.map(x => z.mKarten[x]);
    if (a.id === b.id && a.seite !== b.seite) {
      let neu = zuordnungWerte({ ...q, zuordnung: { ...z, mOffen: [], mZuege: z.mZuege + 1, paarFarbe: { ...(z.paarFarbe || {}), [a.id]: Object.keys(z.paarFarbe || {}).length % ZUORDNUNG_FARBEN.length } } }, a.id, "richtig");
      if (neu.zuordnung.ids.every(id => id in neu.zuordnung.erledigt)) neu = zuordnungRundeEnde(neu);
      setQuiz(neu);
      return;
    }
    setQuiz({ ...q, zuordnung: { ...z, mOffen: offen, mZuege: z.mZuege + 1 } });
    setTimeout(() => setQuiz(prev => prev?.zuordnung?.mOffen?.length === 2 && prev.zuordnung.mOffen[1] === i ? { ...prev, zuordnung: { ...prev.zuordnung, mOffen: [] } } : prev), 1100);
  }
  function mitZuordnungMix(q) {
    if (!q?.zuordnungMix || q.phase !== "eingabe") return q;
    const typen = q.antwortTypen || [];
    const art = typen.map(t => q.spalteModus?.[t]).find(istRunde);
    if (!art) return q;
    const rest = q.vokabeln.length - q.index;
    if (rest < 3) {   // zu wenige für eine Runde: eine andere angehakte Art ziehen
      const sp = { ...q.spalteModus };
      typen.forEach(t => { if (!istRunde(sp[t])) return; const andere = modiVon(q.spalteModusBasis?.[t]).filter(x => !istRunde(x) && x !== "akzent"); sp[t] = andere.length ? gewichtetWaehlen(andere) : STANDARD_ANTWORT_MODUS; });
      const mc = istMC(sp[typen[0]]) ? generiereButtons(q.vokabeln, q.vokabeln[q.index], typen[0], sp[typen[0]]) : null;
      return { ...q, spalteModus: sp, ...(mc ? { mcButtons: mc.buttons, mcRichtig: mc.richtig } : {}) };
    }
    const k = Math.min(art === "memory" ? Math.min(q.zuordnungMix.paare, 8) : q.zuordnungMix.paare, rest);
    const ids = q.vokabeln.slice(q.index, q.index + k).map(v => v.id);
    const spalten = q.zuordnungMix.wechselnd ? q.zuordnungMix.spalten : [q.frageTyp, ...typen].slice(0, 4);
    return zuordnungRundeAus({ ...q, zuordnung: { ...q.zuordnungMix, spalten, alleSpalten: spalten, mix: { start: q.index, ende: q.index + k }, queue: [],
      beantwortet: q.vokabeln.slice(0, q.index).map(v => v.id) } }, ids, art);
  }
  // gemischt, Runde zu Ende: Beantwortete bleiben an ihrer Stelle, offen Gebliebene kommen ans Ende; weiter mit der nächsten Frage
  function zuordnungMixWeiter(q) {
    const z = q.zuordnung, { start, ende } = z.mix;
    const runde = q.vokabeln.slice(start, ende);
    const fertig = runde.filter(v => v.id in z.erledigt), offen = runde.filter(v => !(v.id in z.erledigt));
    const vokabeln = [...q.vokabeln.slice(0, start), ...fertig, ...q.vokabeln.slice(ende), ...offen];
    return naechsteVokabelState({ ...q, vokabeln, index: start + fertig.length - 1, zuordnung: null, phase: "eingabe", vokErgebnis: null, erstbewertung: false });
  }
  function zuordnungZeitBis(z, k) {
    if (z.zeit === "aus") return null;
    const proVok = z.sek * (ZUORDNUNG_ZEITFAKTOR[z.spalten.length] || 1) * 1000;
    return Date.now() + (z.amEnde ? proVok * k : proVok);
  }
  // Ergebnis einer Vokabel speichern (nur vollständig Beantwortetes): richtig +1, falsch nach Regel −1
  function zuordnungWerte(q, id, ergebnis) {
    const lv = q.liste.vokabeln.find(v => v.id === id) || q.vokabeln.find(v => v.id === id);
    const r = quizRegeln();
    const neu = berechneNeuenScore(lv?.fortschritt, ergebnis, r.aufdeckenAbzug ? "schwer" : "einfach", q.zuordnung.abzug);
    const erst = !(id in (q.gewertet || {}));
    return { ...q, liste: speichereScore(q.liste, id, neu),
      gewertet: erst ? { ...(q.gewertet || {}), [id]: ergebnis } : q.gewertet,
      ...(ergebnis === "richtig" ? { richtigMap: { ...(q.richtigMap || {}), [id]: ((q.richtigMap || {})[id] || 0) + 1 } } : {}),
      ...(q.spielZaehler != null && ergebnis === "richtig" ? { spielZaehler: q.spielZaehler + 1 } : {}),
      quizRichtigAnzahl: (q.quizRichtigAnzahl || 0) + (erst && ergebnis === "richtig" ? 1 : 0),
      quizFalschAnzahl: (q.quizFalschAnzahl || 0) + (erst && ergebnis !== "richtig" ? 1 : 0),
      zuordnung: { ...q.zuordnung, erledigt: { ...q.zuordnung.erledigt, [id]: ergebnis }, beantwortet: [...q.zuordnung.beantwortet, id] } };
  }
  // Rundenende: das Ergebnis bleibt stehen (✓ / ✗ je Paar), weiter mit „Weiter →“; „Lösung zeigen“ färbt die richtigen Paare.
  // Nicht Beantwortete kommen in der nächsten Runde wieder
  function zuordnungRundeEnde(q) {
    const z = q.zuordnung;
    const offen = z.ids.filter(id => !(id in z.erledigt));
    return { ...q, zuordnung: { ...z, queue: [...offen, ...z.queue], zeitBis: null, offen: null, offeneGruppe: null, anzeige: "ergebnis" } };
  }
  function zuordnungTippe(s, i) {
    const q = quiz, z = q?.zuordnung;
    if (!z || q.phase !== "zuordnung" || z.anzeige) return;
    const karte = z.karten[s][i];
    if (karte.id in z.erledigt) return;
    const kt = karte.typ || z.spalten[s];
    if (einstellungen.autoplay && kt.startsWith("E")) { const v = q.vokabeln.find(x => x.id === karte.id); sprich(karte.text, vokLang(v, kt)); }
    if (z.amEnde) {
      const nz = zuordnungGruppeTippe(z, s, i);
      const alles = nz.gruppen.length === nz.ids.length && nz.gruppen.every(g => Object.keys(g.wahl).length === nz.spalten.length);
      setQuiz(alles ? zuordnungPruefe({ ...q, zuordnung: nz }) : { ...q, zuordnung: nz });
      return;
    }
    const o = z.offen;
    if (!o) { setQuiz({ ...q, zuordnung: { ...z, offen: { id: karte.id, wahl: { [s]: i }, erst: s } } }); return; }
    if (o.wahl[s] === i) {   // dieselbe Karte nochmal: erste → Gruppe aufheben, sonst nur diese abwählen
      if (s === o.erst) { setQuiz({ ...q, zuordnung: { ...z, offen: null } }); return; }
      const wahl = { ...o.wahl }; delete wahl[s];
      setQuiz({ ...q, zuordnung: { ...z, offen: { ...o, wahl } } }); return;
    }
    if (s === o.erst && Object.keys(o.wahl).length === 1) {   // andere Karte in der Spalte der ersten: neu anfangen, kein Fehlgriff
      setQuiz({ ...q, zuordnung: { ...z, offen: { id: karte.id, wahl: { [s]: i }, erst: s } } }); return;
    }
    if (karte.id !== o.id) {   // Fehlgriff: zählt für die Vokabel der zuerst angetippten Karte
      setQuiz({ ...q, zuordnung: { ...z, fehler: { ...z.fehler, [o.id]: true }, blink: { s, i, t: Date.now() } } });
      setTimeout(() => setQuiz(prev => prev?.zuordnung?.blink?.s === s && prev.zuordnung.blink.i === i ? { ...prev, zuordnung: { ...prev.zuordnung, blink: null } } : prev), 650);
      return;
    }
    const wahl = { ...o.wahl, [s]: i };
    if (Object.keys(wahl).length < z.spalten.length) { setQuiz({ ...q, zuordnung: { ...z, offen: { ...o, wahl } } }); return; }
    // Gruppe vollständig
    let neu = zuordnungWerte({ ...q, zuordnung: { ...z, offen: null, paarFarbe: { ...(z.paarFarbe || {}), [o.id]: Object.keys(z.paarFarbe || {}).length % ZUORDNUNG_FARBEN.length } } },
      o.id, z.fehler[o.id] ? "falsch" : "richtig");
    if (z.zeit !== "aus") neu = { ...neu, zuordnung: { ...neu.zuordnung, zeitBis: zuordnungZeitBis(z, 1) } };
    if (neu.zuordnung.ids.every(id => id in neu.zuordnung.erledigt)) neu = zuordnungRundeEnde(neu);
    setQuiz(neu);
  }
  // „am Ende“: Karten bilden farbige Gruppen in Tipp-Reihenfolge; eingefärbte Karte antippen nimmt sie heraus
  function zuordnungGruppeTippe(z, s, i) {
    let gruppen = z.gruppen.map(g => ({ ...g, wahl: { ...g.wahl } }));
    let offen = z.offeneGruppe;
    const gi = gruppen.findIndex(g => g.wahl[s] === i);
    if (gi >= 0) {
      delete gruppen[gi].wahl[s];
      if (!Object.keys(gruppen[gi].wahl).length) { gruppen.splice(gi, 1); offen = offen === gi ? null : offen != null && offen > gi ? offen - 1 : offen; }
      else { if (gruppen[gi].erst === s) gruppen[gi].erst = Number(Object.keys(gruppen[gi].wahl)[0]); offen = gi; }
      return { ...z, gruppen, offeneGruppe: offen };
    }
    if (offen != null && gruppen[offen]) {
      gruppen[offen].wahl[s] = i;
      const voll = Object.keys(gruppen[offen].wahl).length === z.spalten.length;
      return { ...z, gruppen, offeneGruppe: voll ? null : offen };
    }
    const belegt = new Set(gruppen.map(g => g.farbe));
    const farbe = ZUORDNUNG_FARBEN.findIndex((_, k) => !belegt.has(k));
    gruppen.push({ wahl: { [s]: i }, erst: s, farbe: farbe < 0 ? gruppen.length % ZUORDNUNG_FARBEN.length : farbe });
    return { ...z, gruppen, offeneGruppe: gruppen.length - 1 };
  }
  // „Prüfen“ (oder Zeit abgelaufen bei „am Ende“): nur vollständige Gruppen zählen
  function zuordnungPruefe(q) {
    const z = q.zuordnung;
    let neu = q;
    const ergebnis = {};
    z.gruppen.forEach((g, gi) => {
      if (Object.keys(g.wahl).length !== z.spalten.length) return;
      const ids = Object.entries(g.wahl).map(([sp, k]) => z.karten[sp][k].id);
      const erstId = z.karten[g.erst][g.wahl[g.erst]].id;
      const richtig = ids.every(id => id === ids[0]);
      ergebnis[gi] = richtig;
      if (!(erstId in neu.zuordnung.erledigt)) neu = zuordnungWerte(neu, erstId, richtig ? "richtig" : "falsch");
    });
    neu = { ...neu, zuordnung: { ...neu.zuordnung, geprueft: ergebnis } };
    return zuordnungRundeEnde(neu);
  }
  // Zeit abgelaufen
  useEffect(() => {
    const z = quiz?.zuordnung;
    if (quiz?.phase !== "zuordnung" || !z?.zeitBis || z.anzeige) return;
    const t = setTimeout(() => setQuiz(prev => {
      if (prev?.phase !== "zuordnung" || prev.zuordnung.anzeige || !prev.zuordnung.zeitBis || Date.now() < prev.zuordnung.zeitBis - 30) return prev;
      return prev.zuordnung.amEnde ? zuordnungPruefe(prev) : zuordnungRundeEnde(prev);
    }), Math.max(0, z.zeitBis - Date.now()));
    return () => clearTimeout(t);
  }, [quiz?.phase, quiz?.zuordnung?.zeitBis, quiz?.zuordnung?.anzeige]);   // eslint-disable-line react-hooks/exhaustive-deps


  function getAktVok() {
    if (!quiz) return null;
    const vokId = quiz.vokabeln[quiz.index].id;
    return quiz.liste.vokabeln.find(v => v.id === vokId) || quiz.vokabeln[quiz.index];
  }

  // Berechnet den nächsten Vokabel-State als reines Objekt (kein setQuiz)
  function naechsteVokabelState(prev) {
    const sp = prev?.abfrageZiel?.modus, spiel = sp === "blitz" || sp === "serie";
    if (spiel && prev.vokErgebnis) {
      const richtig = prev.vokErgebnis === "richtig", id = prev.vokabeln[prev.index]?.id;
      prev = { ...prev, spielZaehler: (prev.spielZaehler || 0) + (richtig ? 1 : 0), spielBeantwortet: [...new Set([...(prev.spielBeantwortet || []), id])] };
      if (sp === "serie" && !richtig) return spielBeenden(prev);
    }
    if (spiel && prev.index + 1 >= prev.vokabeln.length) {
      const basis = prev.spielBasis || prev.vokabeln, b = [...basis];
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      prev = { ...prev, vokabeln: [...prev.vokabeln, ...b] };
    }
    return mitZuordnungMix(naechsteVokabelState0(prev));
  }
  // Blitzrunde / Serie zu Ende: Rekord je Art und Session (bzw. Liste) festhalten
  function spielBeenden(q) {
    const art = q.abfrageZiel?.modus, n = q.spielZaehler || 0;
    const key = `${art}|${aktiverSlot?.typ === "gespeichert" ? aktiverSlot.id : (q.liste?.id || "liste")}`;
    let rekorde = {};
    try { rekorde = JSON.parse(localStorage.getItem(REKORDE_KEY)) || {}; } catch { /* leer */ }
    const alt = rekorde[key] || 0;
    if (n > alt) { rekorde[key] = n; try { localStorage.setItem(REKORDE_KEY, JSON.stringify(rekorde)); } catch { /* egal */ } }
    return { ...q, phase: "spielEnde", spielRekord: { alt, neu: n > alt },
      ...(q.istSessionModus ? { sessionVokIds: q.spielBeantwortet || [] } : {}) };
  }
  // Blitzrunde: Zeit abgelaufen
  useEffect(() => {
    const ende = quiz?.abfrageZiel?.modus === "blitz" ? quiz.abfrageZiel.ende : null;
    if (!ende || quiz.phase === "spielEnde" || quiz.phase === "fertig") return;
    const t = setTimeout(() => setQuiz(prev => prev && prev.abfrageZiel?.modus === "blitz" && prev.phase !== "spielEnde" && prev.phase !== "fertig" ? spielBeenden(prev) : prev),
      Math.max(0, ende - Date.now()));
    return () => clearTimeout(t);
  }, [quiz?.abfrageZiel?.ende, quiz?.phase === "spielEnde"]);   // eslint-disable-line react-hooks/exhaustive-deps
  function naechsteVokabelState0(prev) {
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
      return { frageTyp: fa.frageTyp, antwortTypen: antwortSpaltenFuer(voks[idx], fa.antwortTypen, prev.spalteModusBasis || prev.spalteModus, prev.akzentOhneAuslassen, true) };
    }

    // Baut den State für vokabeln[idx] innerhalb von voks auf
    function starteVokabel(voks, idx, extra = {}) {
      const { frageTyp, antwortTypen } = getFA(voks, idx);
      const vok = voks[idx];
      const teile = vok[antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
      const sp = prev.spalteModusBasis ? loeseSpaltenModusAuf(prev.spalteModusBasis, vok, frageTyp) : prev.spalteModus;
      const mc = istMC(sp[antwortTypen[0]] || STANDARD_ANTWORT_MODUS) ? generiereButtons(voks, vok, antwortTypen[0], sp[antwortTypen[0]]) : null;
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
        if (ziel.modus === "score" && ziel.scoreTyp === "session") {
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
    // je Vokabel neu auflösen (setzt auch einen MC-Wechsel der vorigen Frage zurück)
    const spalteModus = prev.spalteModusBasis ? loeseSpaltenModusAuf(prev.spalteModusBasis, naechsteVok, frageTyp)
      : prev.mcWechsel ? {...prev.spalteModus, [antwortTypen[0]]: "tippen"} : prev.spalteModus;
    const modusTyp0 = spalteModus[antwortTypen[0]] || STANDARD_ANTWORT_MODUS;
    const mc = istMC(modusTyp0) ? generiereButtons(prev.vokabeln, naechsteVok, antwortTypen[0], modusTyp0) : null;
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
    const mc = istMC(ntModus) ? generiereButtons(prev.vokabeln, prev.vokabeln[prev.index], nt, ntModus) : null;
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
    // Akzent-Spalten zählen nur für den eigenen Akzent-Score – gemischt gezogene Akzente zählen für die Übersetzung
    const istAkzent = i => { const t = quiz.antwortTypen[i]; return quiz.spalteModus?.[t] === "akzent" && !Array.isArray(quiz.spalteModusBasis?.[t]); };
    const normal = alle.filter((_, i) => !istAkzent(i));
    const akzent = alle.filter((_, i) => istAkzent(i));
    const aktVok = getAktVok();
    // Pro Vokabel und Runde zählt nur die erste Bewertung (Wiederholungen sind reines Üben).
    // Ausnahme Abfrage-Ziel "Score": dort muss jede Antwort zählen, sonst endet die Runde nie.
    const erstbewertung = !(aktVok.id in (quiz.gewertet || {}));
    const gewertet = erstbewertung ? { ...(quiz.gewertet || {}), [aktVok.id]: vokErgebnis } : quiz.gewertet;
    if (!erstbewertung && quiz.abfrageZiel?.modus !== "score") return { spaltenErgebnisse, vokErgebnis, erstbewertung, gewertet };
    let liste = quiz.liste, sessionFalsch = quiz.sessionFalsch, gelerntBlitz = null;
    // Vokabel erreicht mit dieser Antwort die Gelernt-Schwelle → Karte leuchtet kurz auf (Farbe „Gelernt-Effekt“) + Sternenregen
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    const erreicht = (vorher, nachher) => schwelle > 0 && (vorher?.score ?? -Infinity) < schwelle && (nachher?.score ?? -Infinity) >= schwelle;
    if (normal.length > 0) {
      const erg = gesamt(normal);
      const neuerCount = erg === "falsch" ? (quiz.sessionFalsch[aktVok.id] || 0) + 1 : 0;
      const neu = berechneNeuenScore(aktVok.fortschritt, erg, quizRegeln().aufdeckenAbzug ? "schwer" : "einfach", quizRegeln().falschAbzug);
      liste = speichereScore(liste, aktVok.id, neu);
      if (erreicht(aktVok.fortschritt, neu)) gelerntBlitz = blitzKey(quiz);
      if (erg === "falsch") sessionFalsch = { ...quiz.sessionFalsch, [aktVok.id]: neuerCount };
    }
    if (akzent.length > 0) {
      const neu = berechneDiktatScore(aktVok.akzentFortschritt, gesamt(akzent) === "richtig" ? "richtig" : "aufgedeckt", quizRegeln().falschAbzug);
      liste = speichereAkzentScore(liste, aktVok.id, neu);
      if (erreicht(aktVok.akzentFortschritt, neu)) gelerntBlitz = blitzKey(quiz);
    }
    return { spaltenErgebnisse, vokErgebnis, erstbewertung, gewertet, liste, sessionFalsch, ...(gelerntBlitz ? { gelerntBlitz } : {}) };
  }

  // Akzent-Abfrage mit Wörtern ohne Akzent: nur so viele ohne Akzent wie eingestellt (Faktor × mit Akzent);
  // bevorzugt die mit schwächstem bzw. noch keinem Akzent-Score, bei Gleichstand zufällig.
  // festeIds: laufende Session – dann bleiben genau die Wörter ohne Akzent vom Session-Start
  function begrenzeOhneAkzent(voks, antwortTypen, festeIds = null) {
    const anteil = akzentOhneAnteil(einstellungen);
    if (!quizRegeln().akzentOhneMischen || anteil == null) return voks;
    const mitAkz = v => antwortTypen.some(t => hatAkzente(v[t]?.wert));
    const mit = voks.filter(mitAkz);
    const ohne = voks.filter(v => !mitAkz(v));
    const max = Math.round(mit.length * anteil);
    const kandidaten = festeIds ? ohne.filter(v => festeIds.has(v.id))
      : ohne.map(v => [v, Math.random()]).sort((a, b) => ((a[0].akzentFortschritt?.score ?? -Infinity) - (b[0].akzentFortschritt?.score ?? -Infinity)) || a[1] - b[1]).map(x => x[0]);
    const behalten = new Set(kandidaten.slice(0, max).map(v => v.id));
    return voks.filter(v => mitAkz(v) || behalten.has(v.id));
  }
  // Wörter ohne Akzent gleichmäßig zwischen die mit Akzent verteilen (Reihenfolge innerhalb bleibt)
  function verteileOhneAkzent(voks, antwortTypen) {
    const mitAkz = v => antwortTypen.some(t => hatAkzente(v[t]?.wert));
    const mit = voks.filter(mitAkz), ohne = voks.filter(v => !mitAkz(v));
    if (!mit.length || !ohne.length) return voks;
    const n = voks.length, erg = [];
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      if (b < ohne.length && (a >= mit.length || b < Math.round((i + 1) * ohne.length / n))) erg.push(ohne[b++]);
      else erg.push(mit[a++]);
    }
    return erg;
  }

  // Kennung der aktuellen Frage für das Gelernt-Aufleuchten (gilt nur für diese Karte)
  const blitzKey = q => `${q.wiederholungDurchgang || 0}|${q.index}|${q.vokabeln[q.index]?.id}`;

  function pruefeAntwort(eingabeArg) {
    const eingabe = (typeof eingabeArg === "string" ? eingabeArg : quiz?.eingabe || "").trim();
    if (!quiz || !eingabe) return;

    // Modus "Einfach": fehlende/falsche Akzente zählen als richtig (mit Hinweis); ebenso, wenn die Akzente der Sprache aus sind
    const vokJetzt = quiz.vokabeln[quiz.index], spalteJetzt = quiz.antwortTypen[quiz.antwortTypIndex];
    const tolerant = quizRegeln().akzenteTolerant || (spalteJetzt?.startsWith("E") && !AKZENTE_FUER_LISTE(vokJetzt?._listeId ?? aktiveListeId));
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
    const mcUpd = istMC(aktModus)
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
    setQuiz(prev => prev?.phase === "wiederholungHinweis" ? mitZuordnungMix({...prev, phase: "eingabe"}) : prev);
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
    const kacheln = akzentKacheln(ohneHinweis(vok?.[typ]?.wert || ""));
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
    if (!kachelMitAkzent(k)) { akzentFehlgriff(s, i, quizRegeln().akzentHervorheben ? { fehler: s.fehler } : {}); return; }
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
    if (quizRegeln().akzentAutoUebernahme && s.kacheln.every((k, j) => wahl[j] === k.richtig)) { schliesseAkzenteAb({ ...s, wahl }); return; }
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
    const treffer = istRichtigeAntwort(quiz.eingabe.trim(), wort, quizRegeln().akzenteTolerant || (quiz.diktatSpalte?.startsWith("E") && !AKZENTE_FUER_LISTE(aktVok._listeId ?? aktiveListeId)));
    if (treffer) {
      const neuFortschritt = berechneDiktatScore(aktVok.diktatFortschritt, "richtig");
      const neueListe = speichereDiktatScore(quiz.liste, aktVok.id, neuFortschritt);
      const schwelle = einstellungen.gelerntSchwelle ?? 0;
      const gelerntBlitz = schwelle > 0 && (aktVok.diktatFortschritt?.score ?? -Infinity) < schwelle && neuFortschritt.score >= schwelle ? blitzKey(quiz) : null;
      const ergebnis = { vokId: aktVok.id, wort, uebersetzung: aktVok[quiz.diktatUeberspalte]?.wert, richtig: true };
      setQuiz(prev => ({
        ...prev, liste: neueListe, eingabe: "", phase: "richtig", flash: false, ...(gelerntBlitz ? { gelerntBlitz } : {}),
        diktatErgebnisse: [...prev.diktatErgebnisse, ergebnis], feedback: treffer === "akzent" ? AKZENT_HINWEIS : "",
      }));
    } else {
      setQuiz(prev => ({
        ...prev, eingabe: "",
        diktatAufgedeckt: Math.min((prev.diktatAufgedeckt || 0) + 1, ohneHinweis(wort).length),
        feedback: "Nicht richtig – ein Buchstabe mehr aufgedeckt.",
      }));
    }
  }

  function zeigeDiktatLoesung() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const aktVok = quiz.vokabeln[quiz.index];
    const neuFortschritt = berechneDiktatScore(aktVok.diktatFortschritt, "aufgedeckt", quizRegeln().falschAbzug);
    const neueListe = speichereDiktatScore(quiz.liste, aktVok.id, neuFortschritt);
    const wort = aktVok[quiz.diktatSpalte]?.wert || "";
    const ergebnis = { vokId: aktVok.id, wort, uebersetzung: aktVok[quiz.diktatUeberspalte]?.wert, richtig: false };
    setQuiz(prev => ({
      ...prev, liste: neueListe, eingabe: "", phase: "aufgedeckt", flash: false,
      diktatAufgedeckt: ohneHinweis(wort).length,
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
    // Novelty/effects Stimmen aussortieren (iOS/macOS); die gewählte Stimme kommt zuerst
    const alle = aktiveStimmen(langCode).length ? aktiveStimmen(langCode) : stimmenFuerSprache(langCode), gew = gewaehlteStimme(langCode);
    const voices = gew ? [gew, ...alle.filter(v => v !== gew)] : alle;
    diktatPlayCountRef.current += 1;
    setDiktatManualPlays(p => p + 1);
    window.speechSynthesis.cancel();
    // Stimme wechselt alle 2 Plays: 0,0,1,1,2,2,… – immer eine Stimme der richtigen Sprache
    const stimme = voices.length > 1 ? voices[Math.floor(diktatPlayCountRef.current / 2) % voices.length] : null;
    window.speechSynthesis.speak(aeusserung(text.split('/')[0].trim(), lang, stimme));
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
  if (lernen && !lernen.imQuiz) {
    const n = lernen.voks.length;
    const gesamt = lernen.alle.length;
    const rest = gesamt - (lernen.start + n);
    const paketNr = Math.floor(lernen.start / lernen.groesse) + 1, paketeGesamt = Math.ceil(gesamt / lernen.groesse);
    const v = lernen.voks[lernen.index];
    const name = t => lernen.liste?.spalten?.[t]?.name || t;
    const pct = Math.round((lernen.start + (lernen.fertig ? n : lernen.index + lernen.phase / 3)) / gesamt * 100);
    const seite = (spalten, art) => spalten.filter(t => v[t]?.wert).map(t => (
      <div key={t} className={`lernen-zeile${art === "danach" ? " lernen-uebersetzung" : ""}`} {...(art === "danach" ? { "data-lernen-uebersetzung": true } : { "data-lernen-wort": true })}>
        <div className="lernen-label">{name(t)}</div>
        <div className="lernen-wort">{mitHinweis(v[t].wert)}</div>
      </div>
    ));
    const le = lernEinstellungen();
    const infoTeile = le.info ? lernen.info.filter(t => v?.[t]?.wert) : [];
    return (
      <>
        <style>{CSS}</style>{farbModusUI}{farbRadUI}
        <div className="app">
          <div className="topbar">
            <button className="topbar-back" data-lernen-beenden onClick={beendeLernen} {...tt("Lernen schließen – der Lernstand bleibt gespeichert; „Weiter lernen“ im Quiz-Tab macht hier weiter (Scores bleiben unverändert)")}>Schließen</button>
            <span className="topbar-title">🎬 Lernen<span className="kopf-balken"><span style={{width:`${pct}%`}}/></span></span>
            <span className="quiz-fortschritt" data-lernen-stand>{lernen.start + (lernen.fertig ? n : lernen.index + 1)} / {gesamt}</span>
          </div>
          <div className="sektion">
            {lernen.fertig ? (<>
              <div className="quiz-frage-box" data-lernen-fertig style={{padding:"30px 16px", textAlign:"center", position:"relative"}}>
                <button className="lernen-nochmal" data-lernen-nochmal aria-label="Paket nochmals ansehen"
                  onClick={() => setLernen(l => ({ ...l, index: 0, phase: 0, fertig: false, pausiert: false, lauf: l.lauf + 1 }))}
                  {...tt("Dieses Paket nochmals ansehen (das Quiz gibt es je Paket nur einmal)")}>🔄</button>
                <div style={{fontSize:"2.2rem", lineHeight:1}}>🎬</div>
                <div className="quiz-frage-text" style={{textAlign:"center", marginTop:10}}>
                  {rest > 0 ? `${n} Vokabel${n !== 1 ? "n" : ""} angesehen` : `Alle ${gesamt} Vokabeln angesehen`}
                </div>
                {paketeGesamt > 1 && <div style={{fontSize:"0.85rem", color:"var(--text2)", marginTop:6}} data-lernen-paket>Paket {paketNr} von {paketeGesamt}</div>}
              </div>
              {!lernen.quizGemacht && (
                <button className="btn btn-primary" style={{width:"100%", marginTop:14, background:"var(--karte)", color:"var(--haupt)", border:"1.5px solid var(--haupt-zart)"}} data-lernen-quiz onClick={starteLernQuiz}
                  {...tt("Genau diese Vokabeln einmal abfragen – gewusste verbessern den Score, falsche kosten keinen Punkt; danach geht es mit dem nächsten Paket weiter")}>
                  Quiz mit diesen {n} Vokabel{n !== 1 ? "n" : ""}
                </button>
              )}
              {rest > 0 && (
                <button className="btn btn-primary" style={{width:"100%", marginTop:8}} data-lernen-weiter
                  onClick={() => setLernen(l => naechstesLernPaket(l))} {...tt("Ohne Quiz mit den nächsten Vokabeln weiterlernen")}>
                  Weiter lernen: nächste {Math.min(lernen.groesse, rest)}
                </button>
              )}
              <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={beendeLernen} {...tt("Zurück zum Quiz-Tab – der Lernstand bleibt gespeichert, solange noch Vokabeln übrig sind")}>Zur Übersicht</button>
            </>) : (<>
              <div className="quiz-frage-box lernen-karte" data-lernen-karte data-lernen-phase={lernen.phase} onClick={lernenWeiter}
                {...tt(lernen.phase === 0 ? "Antippen: Übersetzung sofort zeigen" : "Antippen: sofort weiter (Zusatzinfo bzw. nächste Vokabel)")}>
                {(() => {   // Stimme wechseln (Fremdsprache dieser Vokabel), wie auf der Abfrage-Karte
                  const t = [...lernen.zuerst, ...lernen.danach].find(x => x.startsWith("E") && v?.[x]?.wert);
                  if (!t) return null;
                  const lang = vokLang(v, t), basis = normLang(lang).split("-")[0], aktiv = aktiveStimmen(basis);
                  if (aktiv.length < 2) return null;
                  const nr = Math.max(0, aktiv.indexOf(gewaehlteStimme(basis) || stimmeFuer(lang))) + 1;
                  return <button className="stimme-wechsel" data-stimme-wechsel="lernen" style={{left:6, right:"auto"}} onClick={e => { e.stopPropagation(); wechsleStimme(v[t].wert, lang); }}
                    {...tt(`Stimme ${nr} von ${aktiv.length} – antippen: mit der nächsten aktivierten Stimme vorlesen (bleibt dann für diese Sprache eingestellt)`)}>{nr}/{aktiv.length}</button>;
                })()}
                {lernen.pausiert && <div className="lernen-pausiert" aria-hidden="true">⏸</div>}
                {!lernen.pausiert && lernPause(lernen, v) >= LERNEN_TIPPEN && <div className="lernen-tippen" data-lernen-tippen>▸</div>}
                {/* je Vokabel neu aufgebaut: das Wort blendet ein; Übersetzung und Zusatzinfo belegen ihren Platz schon vorher */}
                <div key={`${lernen.start + lernen.index}-${lernen.lauf}`} className="lernen-inhalt">
                  <div className="lernen-teil sichtbar lernen-ein">{seite(lernen.zuerst, "zuerst")}</div>
                  <div className="lernen-trenner"/>
                  <div className={`lernen-teil${lernen.phase >= 1 ? " sichtbar" : ""}`} data-lernen-teil="uebersetzung" data-sichtbar={lernen.phase >= 1 || undefined}>
                    {seite(lernen.danach, "danach")}
                  </div>
                  {infoTeile.length > 0 && (
                    <div className={`lernen-teil${lernen.phase === 2 ? " sichtbar" : ""}`} data-lernen-teil="info" data-sichtbar={lernen.phase === 2 || undefined}>
                      {infoTeile.map(t => (
                        <div key={t} className="lernen-info" data-lernen-info>
                          <div className="lernen-trenner duenn"/>
                          <div className="lernen-label">{name(t)}</div>
                          <div>{mitHinweis(v[t].wert)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="lernen-steuerung">
                <button className="btn btn-ghost" data-lernen-zurueck onClick={lernenZurueck} disabled={lernen.index === 0}
                  {...tt("Zurück zur vorigen Vokabel")}>⏮</button>
                <button className="btn btn-primary" data-lernen-pause={lernen.pausiert ? "an" : "aus"} onClick={() => setLernen(l => ({ ...l, pausiert: !l.pausiert }))}
                  {...tt(lernen.pausiert ? "Weiterlaufen lassen" : "Anhalten – antippen der Karte geht trotzdem weiter")}>{lernen.pausiert ? "▶" : "⏸"}</button>
                <button className="btn btn-ghost" data-lernen-vor onClick={lernenVor}
                  {...tt("Weiter zur nächsten Vokabel")}>⏭</button>
              </div>
              <button className="lernen-einst-knopf" data-lernen-einst-knopf={le.einstOffen ? "offen" : "zu"} onClick={() => setzeLernEinst({ einstOffen: !le.einstOffen })}
                {...tt(le.einstOffen ? "Vorlesen, Zusatzinfo und Pausen einklappen" : "Vorlesen, Zusatzinfo und Pausen einstellen")}>
                ⚙ Vorlesen &amp; Pausen {le.einstOffen ? "▴" : "▾"}
              </button>
              {le.einstOffen && (
              <div className="lernen-regler">
                <div className="lernen-regler-zeile">
                  <span>Vorlesen</span>
                  <div className="lernen-vorlesen">
                    {[["vorlesen1", "Wort"], ["vorlesen2", "Übersetzung"], ["vorlesen3", "Info"]].filter(([k]) => k !== "vorlesen3" || lernen.info.length > 0).map(([k, label]) => (
                      <button key={k} className={`typ-btn${le[k] ? " aktiv" : ""}`} data-lernen-vorlesen-schalter={k} onClick={() => setzeLernEinst({ [k]: !le[k] })}
                        {...tt(`${label} vorlesen – antippen schaltet ${le[k] ? "aus" : "ein"}`)}>{label}</button>
                    ))}
                  </div>
                </div>
                {lernen.info.length > 0 && (
                  <div className="lernen-regler-zeile">
                    <span>Zusatzinfo</span>
                    <div className="toggle-btn">
                      <button className={`toggle-opt${le.info ? " aktiv" : ""}`} data-lernen-info-schalter="an" onClick={() => setzeLernEinst({ info: true })}
                        {...tt("Zusatzinfo (Info-Spalten) nach der Übersetzung einblenden")}>An</button>
                      <button className={`toggle-opt${!le.info ? " aktiv" : ""}`} data-lernen-info-schalter="aus" onClick={() => setzeLernEinst({ info: false })}
                        {...tt("Ohne Zusatzinfo – nur Wort und Übersetzung")}>Aus</button>
                    </div>
                  </div>
                )}
                {[["pauseWort", "Pause Wort", "nach dem Wort"], ["pauseUeb", "Pause Übers.", "nach der Übersetzung"],
                  ["pauseInfo", lernen.info.length > 0 && le.info ? "Pause Info" : "Pause Ende", lernen.info.length > 0 && le.info ? "nach der Zusatzinfo" : "vor der nächsten Vokabel"]].map(([k, label, wann]) => (
                  <div key={k} className="lernen-regler-zeile">
                    <span>{label}</span>
                    <input type="range" min="0" max={LERNEN_TIPPEN} step="0.5" value={le[k]} data-lernen-pause-regler={k}
                      onChange={e => setzeLernEinst({ [k]: parseFloat(e.target.value) })}
                      {...ttFeld(`Pause ${wann} – zusätzlich zur Lese- bzw. Vorlesezeit; ganz rechts: warten, bis du antippst`)}/>
                    <b data-lernen-pause-wert={k}>{le[k] >= LERNEN_TIPPEN ? "Tippen" : `${String(le[k]).replace(".", ",")} s`}</b>
                  </div>
                ))}
              </div>
              )}
            </>)}
          </div>
        </div>
      </>
    );
  }

  if (ansicht === "quiz" && quiz && quiz.modus === "diktat") {
    if (quiz.phase === "fertig") {
      const richtig = quiz.diktatErgebnisse.filter(e => e.richtig).length;
      if (quiz.istSessionModus) {
        const aktSlot = lsGet(SK.sessionAktiv);
        const schonAbgefragt = new Set([...((aktSlot?.abgefragt) || []), ...(quiz.sessionVokIds || [])]);
        const istLetzteBatch = schonAbgefragt.size >= (quiz.sessionGesamt || 0);
        const doBeende = (letzteRunde, pause = false) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], letzteRunde); beendeQuiz(!pause); };
        const doWeiter = (n) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], false); setQuizPaketGroesse(n); starteDiktat(); };
        if (istLetzteBatch && quiz.sessionAuswertung) return sessionAuswertungSeite(quiz, (<>
          <button data-nochmal {...tt("Session gleich noch einmal von vorn durchlaufen – Scores bleiben, der Abgefragt-Stand beginnt neu")} className="btn btn-primary" style={{width:"100%", marginBottom:8, fontSize:"1.05rem"}}
            onClick={() => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], true); starteDiktat(true); }}>🔁 Nochmal!</button>
          <button {...tt("Durchlauf beenden und zur Übersicht")} className="btn btn-ghost-filled" style={{width:"100%"}} onClick={() => doBeende(true)}>Zur Übersicht</button>
          <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(() => doBeende(true))} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button>
        </>), () => doBeende(true));
        return (
          <>
            <style>{CSS}</style>{farbModusUI}{farbRadUI}
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
                  <div style={{fontSize:"0.85rem", color:"var(--text2)", marginTop:4}}>
                    {schonAbgefragt.size} / {quiz.sessionGesamt} ({Math.round(schonAbgefragt.size / Math.max(1, quiz.sessionGesamt) * 100)}%)
                  </div>
                </div>
                )}
                {istLetzteBatch ? weiterZurAuswertung : (
                  naechstesPaketUI(Math.max(0, (quiz.sessionGesamt || 0) - schonAbgefragt.size), doWeiter, doBeende)
                )}
              </div>
            </div>
          </>
        );
      }
      const diktatKnoepfe = quiz.ausLernen ? (
        <button data-weiter-lernen {...tt("Zurück ins Lernen – weiter mit dem nächsten Paket")} className="btn btn-primary" style={{width:"100%", marginBottom:16}} onClick={zurueckZumLernen}>🎬 Weiter lernen</button>
      ) : (<>
        <button {...tt("Diktat beenden und zur Übersicht")} className="btn btn-primary" style={{width:"100%"}}
          onClick={() => { beendeQuiz(); }}>
          Zurück zur Liste
        </button>
        <div style={{marginBottom:16}}><button data-zurueck-statistik={quiz.ausStatistik ? "" : undefined} className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(beendeQuiz)} {...tt(quiz.ausStatistik ? "Zurück zur Statistik, aus der diese Runde gestartet wurde" : "Statistik zu dieser Abfragerunde öffnen")}>📊 {quiz.ausStatistik ? "Zurück zur Statistik" : "Zur Statistik"}</button></div>
      </>);
      if (quiz.sessionAuswertung) return sessionAuswertungSeite(quiz, diktatKnoepfe, () => { verlasseRunde(); });
      return (
        <>
          <style>{CSS}</style>{farbModusUI}{farbRadUI}
          <div className="app">
            <div className="topbar">
              <button {...tt(quiz.ausLernen ? "Schließen und weiter lernen" : quiz.ausStatistik ? "Diktat schließen und zurück zur Statistik" : "Diktat schließen und zur Übersicht")} className="topbar-back" onClick={() => { verlasseRunde(); }}>Schließen</button>
              <span className="topbar-title">Diktat abgeschlossen</span>
              <span className="quiz-fortschritt">{richtig} / {quiz.diktatErgebnisse.length} ✓</span>
            </div>
            <div className="sektion">
              <div style={{marginBottom:16}}>{weiterZurAuswertung}</div>
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
                    <span style={{fontSize:"1.1rem", fontWeight:700, color: e.richtig ? "var(--haupt)" : "var(--falsch)", minWidth:22}}>
                      {e.richtig ? "✓" : "✗"}
                    </span>
                    <div>
                      <div style={{fontWeight:600, fontSize:"0.95rem"}}>{e.wort}</div>
                      {e.uebersetzung && <div style={{fontSize:"0.82rem", color:"var(--text2)"}}>{e.uebersetzung}</div>}
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
    const hint = diktatHint(ohneHinweis(diktatWort), quiz.diktatAufgedeckt);
    const diktatScore = aktVok.diktatFortschritt?.score ?? 0;

    const diktatWeiter = quiz.phase === "richtig" || quiz.phase === "aufgedeckt";
    let antwortBoxKlasse = "quiz-antwort-box";
    if (quiz.phase === "richtig") antwortBoxKlasse += " richtig";
    if (quiz.gelerntBlitz && quiz.gelerntBlitz === blitzKey(quiz)) antwortBoxKlasse += " gelernt-blitz";
    else if (quiz.phase === "aufgedeckt") antwortBoxKlasse += " aufgedeckt";
    else if (quiz.feedback) antwortBoxKlasse += " falsch";

    return (
      <>
        <style>{CSS}</style>{farbModusUI}{farbRadUI}{renderVokabelEditor()}
        <div className="app">
          <div className="topbar">
            <button {...tt("Diktat abbrechen – bisherige Ergebnisse werden ausgewertet")} className="topbar-back" onClick={() => { beendeQuiz(); }}>Beenden</button>
            <span className="topbar-title"><span>{quiz.index + 1} / {quiz.vokabeln.length}</span>{renderKopfFortschritt(quiz)}</span>
            <span className="quiz-fortschritt">Score: {diktatScore > 0 ? "+" : ""}{diktatScore}</span>
          </div>
          <div className="sektion" style={{display:"flex", flexDirection:"column", paddingBottom:0}}>
            {/* Lautsprecher-Box – nicht Teil der Weiter-Zone */}
            <div className="quiz-frage-box" style={{textAlign:"center", marginBottom:14, flexShrink:0}} data-karte-diktat
              {...tt("Lang drücken: richtige Antwort bearbeiten", [
                { label: "✎ Richtige Antwort bearbeiten", fn: () => oeffneVokabelBearbeiten(quiz.vokabeln[quiz.index], quiz.vokabeln[quiz.index]._listeId ?? quiz.liste.id, quiz.diktatSpalte) },
              ], { langText: `${quiz.liste.spalten[quiz.diktatSpalte]?.name || quiz.diktatSpalte}: richtige Antwort bearbeiten` })}>
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
                {antwortBoxKlasse.includes("gelernt-blitz") && <GelerntSterne/>}
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
                    <strong>{mitHinweis(diktatWort)}</strong>
                    {uebersetzung ? <span style={{color:"var(--richtig-dunkel)"}}> – {uebersetzung}</span> : null}
                    <span style={{color:"var(--richtig-dunkel)"}}> ✓</span>
                    {quiz.feedback && <div className="quiz-feedback ok" style={{marginTop:6}}>{quiz.feedback}</div>}
                  </div>
                )}
                {quiz.phase === "aufgedeckt" && (
                  <div style={{textAlign:"center", padding:"12px 0", fontSize:"1.15rem"}}>
                    <strong>{mitHinweis(diktatWort)}</strong>
                    {uebersetzung ? <span style={{color:"var(--text2)"}}> – {uebersetzung}</span> : null}
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
        const doBeende = (letzteRunde, pause = false) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], letzteRunde); beendeQuiz(!pause); };
        const doWeiter = (n) => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], false); setQuizPaketGroesse(n); starteQuiz(); };
        const r = quiz.quizRichtigAnzahl || 0;
        const f = quiz.quizFalschAnzahl || 0;
        const ges = r + f;
        const feedback = getQuizFeedback(r, ges);
        const sessionPct = Math.round(schonAbgefragt.size / Math.max(1, quiz.sessionGesamt) * 100);
        if (istLetzteBatch && !quiz.abgebrochen && quiz.sessionAuswertung) return sessionAuswertungSeite(quiz, (<>
          <button data-nochmal {...tt("Session gleich noch einmal von vorn durchlaufen – Scores bleiben, der Abgefragt-Stand beginnt neu")} className="btn btn-primary" style={{width:"100%", marginBottom:8, fontSize:"1.05rem"}}
            onClick={() => { updateSessionSlotFortschritt(quiz.sessionVokIds || [], true); starteQuiz(true); }}>🔁 Nochmal!</button>
          <button {...tt("Durchlauf beenden und zur Quiz-Übersicht")} className="btn btn-ghost-filled" style={{width:"100%"}} onClick={() => doBeende(true)}>Zur Übersicht</button>
          <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(() => doBeende(true))} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button>
        </>), () => doBeende(true));
        return (
          <>
            <style>{CSS}</style>{farbModusUI}{farbRadUI}
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
                    <span style={{fontWeight:700, fontSize:"1.05rem", color:"var(--text)"}}>{schonAbgefragt.size} von {quiz.sessionGesamt} Vokabeln abgefragt</span>
                    <span style={{fontSize:"0.85rem", color:"var(--text2)"}}>{sessionPct} %</span>
                  </div>
                  <div style={{background:"var(--flaeche)", borderRadius:8, height:10, overflow:"hidden"}}>
                    <div style={{width:`${sessionPct}%`, height:"100%", background:"var(--haupt)", borderRadius:8}}/>
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
                    <div style={{background:"var(--info-kasten)", borderRadius:12, padding:"14px 16px", margin:"0 0 16px", fontSize:"1rem", lineHeight:1.6, color:"var(--text)", fontStyle:"italic", textAlign:"center"}}>
                      „{feedback}"
                    </div>
                  )}
                </>)}
                {quiz.abgebrochen ? (
                  <><button {...tt("Zur Quiz-Übersicht")} className="btn btn-primary" style={{width:"100%"}} onClick={() => beendeQuiz()}>Zur Übersicht</button>
                  <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(beendeQuiz)} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button></>
                ) : istLetzteBatch ? weiterZurAuswertung : (
                  naechstesPaketUI(Math.max(0, (quiz.sessionGesamt || 0) - schonAbgefragt.size), doWeiter, doBeende)
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
        const rundenKnoepfe = quiz.ausLernen ? (
          <button data-weiter-lernen {...tt("Zurück ins Lernen – weiter mit dem nächsten Paket")} className="btn btn-primary" style={{width:"100%"}} onClick={zurueckZumLernen}>🎬 Weiter lernen</button>
        ) : quiz.ausStatistik ? (<>
          <button data-zurueck-statistik {...tt("Zurück zur Statistik, aus der diese Runde gestartet wurde")} className="btn btn-primary" style={{width:"100%"}} onClick={zurueckZurStatistik}>📊 Zurück zur Statistik</button>
          <button {...tt("Zur Quiz-Übersicht")} className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => { beendeQuiz(); }}>Zur Übersicht</button>
        </>) : (<>
          <button {...tt("Zur Quiz-Übersicht")} className="btn btn-primary" style={{width:"100%"}} onClick={() => { beendeQuiz(); }}>
            Zur Übersicht
          </button>
          <button className="btn btn-ghost" style={{width:"100%", marginTop:8}} onClick={() => zurRundenStatistik(beendeQuiz)} {...tt("Statistik zu dieser Abfragerunde öffnen")}>📊 Zur Statistik</button>
        </>);
        if (quiz.sessionAuswertung && !quiz.abgebrochen) return sessionAuswertungSeite(quiz, rundenKnoepfe, () => { verlasseRunde(); });
        return (
          <>
            <style>{CSS}</style>{farbModusUI}{farbRadUI}
            <div className="app">
              <div className="topbar">
                <button {...tt(quiz.ausLernen ? "Schließen und weiter lernen" : quiz.ausStatistik ? "Auswertung schließen und zurück zur Statistik" : "Auswertung schließen und zur Quiz-Übersicht")} className="topbar-back" onClick={() => { verlasseRunde(); }}>Schließen</button>
                <span className="topbar-title">{quiz.abgebrochen ? "Abgebrochen" : "Auswertung"}</span>
                <span className="quiz-fortschritt">{r}/{ges}</span>
              </div>
              <div className="sektion">
                <div style={{height:8}}/>
                {renderRundenErgebnis(quiz, r, f, quiz.abgebrochen ? "Bis zum Abbruch" : "Diese Runde")}
                {feedback && (
                  <div style={{background:"var(--info-kasten)", borderRadius:12, padding:"14px 16px", margin:"0 0 16px", fontSize:"1rem", lineHeight:1.6, color:"var(--text)", fontStyle:"italic", textAlign:"center"}}>
                    „{feedback}"
                  </div>
                )}
                {quiz.abgebrochen ? rundenKnoepfe : weiterZurAuswertung}
              </div>
            </div>
          </>
        );
      }
    }

    if (quiz.phase === "spielEnde") {
      const blitz = quiz.abfrageZiel?.modus === "blitz", n = quiz.spielZaehler || 0, rek = quiz.spielRekord || {};
      return (
        <>
          <style>{CSS}</style>{farbModusUI}{farbRadUI}
          <div className="app">
            <div className="topbar">
              <span className="topbar-back" style={{visibility:"hidden"}}>·</span>
              <span className="topbar-title">{blitz ? "⚡ Blitzrunde" : "🔥 Serie"}</span>
              <span className="quiz-fortschritt"/>
            </div>
            <div className="sektion">
              <div className="quiz-frage-box" data-spiel-ende style={{padding:"34px 16px", textAlign:"center"}}>
                <div style={{fontSize:"2.4rem", lineHeight:1}}>{rek.neu && n > 0 ? "🏆" : blitz ? "⚡" : "🔥"}</div>
                <div data-spiel-ergebnis style={{fontSize:"3rem", fontWeight:800, color:"var(--haupt)", marginTop:8}}>{n}</div>
                <div style={{fontSize:"1rem", color:"var(--text2)"}}>{blitz ? `richtig in ${quiz.abfrageZiel.sek || BLITZ_SEKUNDEN} Sekunden` : "am Stück richtig"}</div>
                <div data-spiel-rekord style={{marginTop:14, fontWeight:700, color: rek.neu && n > 0 ? "var(--richtig)" : "var(--text2)"}}>
                  {rek.neu && n > 0 ? (rek.alt ? `Neuer Rekord! (bisher ${rek.alt})` : "Erster Rekord!") : `Rekord: ${rek.alt || 0}`}
                </div>
              </div>
              <button className="btn btn-primary" data-spiel-weiter style={{width:"100%", marginTop:14}} onClick={() => setQuiz(prev => ({ ...prev, phase: "fertig" }))}
                {...tt("Weiter zur Auswertung")}>Weiter →</button>
            </div>
          </div>
        </>
      );
    }

    if (quiz.phase === "wiederholungHinweis") {
      const n = quiz.vokabeln.length;
      const grund = quiz.abfrageZiel?.modus === "score"
        ? "haben das Score-Ziel noch nicht erreicht"
        : quiz.abfrageZiel?.wiederholung > 1 ? `wurden noch nicht ${quiz.abfrageZiel.wiederholung}× richtig beantwortet` : "wurden falsch beantwortet";
      return (
        <>
          <style>{CSS}</style>{farbModusUI}{farbRadUI}
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
                <div style={{textAlign:"center", fontSize:"0.9rem", color:"var(--text2)", marginTop:10, lineHeight:1.5}}>
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

    if (quiz.phase === "zuordnung" && quiz.zuordnung) {
      const z = quiz.zuordnung;
      const n = z.spalten.length;
      const gesamt = z.mix ? z.ids.length : (z.beantwortet || []).length + z.ids.filter(id => !(id in z.erledigt)).length + z.queue.length;
      const fertigAnz = z.mix ? z.ids.filter(id => id in z.erledigt).length : (z.beantwortet || []).length;
      const vokNr = Object.fromEntries(z.ids.map((id, k) => [id, k]));
      const loesung = z.anzeige === "loesung";
      const zeilenAnsicht = z.anzeige === "ergebnis";
      const vokVon = id => quiz.vokabeln.find(v => v.id === id);
      const statusVon = id => z.erledigt[id] === "richtig" ? "richtig" : z.erledigt[id] === "falsch" ? "falsch" : "offen";
      const rang = { falsch: 0, offen: 1, richtig: 2 };
      // „deine Wahl“ (am Ende): die übrigen Karten der Gruppe, die mit der Karte dieser Vokabel begann
      const deineWahl = id => {
        if (!z.amEnde) return null;
        const g = z.gruppen.find(gr => z.karten[gr.erst][gr.wahl[gr.erst]].id === id);
        if (!g) return null;
        const andere = Object.entries(g.wahl).filter(([sp]) => Number(sp) !== g.erst).map(([sp, k]) => z.karten[sp][k]).filter(k => k.id !== id);
        return andere.length ? andere.map(k => k.text).join(" · ") : null;
      };
      const dauer = z.zeitBis ? Math.max(0, z.zeitBis - Date.now()) : 0;
      const schrift = n === 2 ? "0.95rem" : n === 3 ? "0.85rem" : "0.78rem";
      return (
        <>
          <style>{CSS}</style>{farbModusUI}{farbRadUI}
          <div className="app">
            <div className="topbar">
              <button {...tt("Abfrage beenden – Beantwortetes bleibt gewertet")} className="topbar-back" onClick={brecheQuizAb}>Beenden</button>
              <span className="topbar-title">{z.art === "memory" ? "Memory" : "Zuordnung"}</span>
              <span className="quiz-fortschritt" data-zuo-fortschritt>{fertigAnz} / {gesamt}</span>
            </div>
            <div className="sektion" data-zuordnung={z.amEnde ? "am-ende" : "sofort"}>
              <div className="zuo-zeit" data-zuo-zeit={z.zeitBis ? "an" : "aus"}>
                {z.zeitBis && !z.anzeige && <div key={z.zeitBis} className="zuo-zeit-balken" style={{animationDuration:`${dauer}ms`}}/>}
              </div>
              {z.art === "memory" && !z.anzeige ? (
                <div className="memory-raster" data-memory style={{gridTemplateColumns:`repeat(${z.mKarten.length > 12 ? 4 : 3}, minmax(0, 1fr))`}}>
                  {z.mKarten.map((k, i) => {
                    const gefunden = k.id in z.erledigt, auf = gefunden || z.mOffen.includes(i);
                    const farbe = gefunden && z.paarFarbe?.[k.id] != null ? ZUORDNUNG_FARBEN[z.paarFarbe[k.id]] : null;
                    const falsch = z.mOffen.length === 2 && z.mOffen.includes(i) && z.mKarten[z.mOffen[0]].id !== z.mKarten[z.mOffen[1]].id;
                    return (
                      <button key={i} className={`memory-karte${auf ? " auf" : ""}${falsch ? " falsch" : ""}`} data-memory-karte={i} data-memory-id={k.id} data-memory-seite={k.seite}
                        style={{fontSize: schrift, ...(farbe ? { borderColor: farbe, background: `${farbe}26` } : {})}} onClick={() => memoryTippe(i)}
                        {...tt("Antippen: Karte aufdecken – zwei zusammengehörige (Frage und Antwort) bilden ein Paar")}>
                        {gefunden && <span className="zuo-nr" style={{background:"var(--richtig)"}}>✓</span>}
                        {auf ? mitHinweis(k.text) : <span className="memory-rueck">?</span>}
                      </button>
                    );
                  })}
                </div>
              ) : zeilenAnsicht ? (
                <div className="zuo-ergebnis" data-zuo-ergebnis>
                  <div className="zuo-raster" style={{gridTemplateColumns:`repeat(${n}, minmax(0, 1fr))`, marginBottom:6}}>
                    {z.spalten.map(t => <div key={t} className="zuo-kopf">{quiz.liste.spalten[t]?.name || t}</div>)}
                  </div>
                  {[...z.ids].sort((a, b) => rang[statusVon(a)] - rang[statusVon(b)]).map(id => {
                    const v = vokVon(id), st = statusVon(id), wahl = st === "falsch" ? deineWahl(id) : null;
                    return (
                      <div key={id} className={`zuo-reihe ${st}`} data-zuo-reihe={id} data-zuo-status={st}>
                        <span className="zuo-nr" style={{background: st === "richtig" ? "var(--richtig)" : st === "falsch" ? "var(--falsch)" : "var(--text3)"}}>{st === "richtig" ? "✓" : st === "falsch" ? "✗" : "–"}</span>
                        <div className="zuo-raster" style={{gridTemplateColumns:`repeat(${n}, minmax(0, 1fr))`}}>
                          {z.spalten.map(t => (
                            <button key={t} className="zuo-karte" style={{fontSize: schrift}} onClick={() => sprich(v?.[t]?.wert || "", vokLang(v, t))}
                              {...tt("Antippen: vorlesen")}>{mitHinweis(v?.[t]?.wert || "")}</button>
                          ))}
                        </div>
                        {wahl && <div className="zuo-wahl" data-zuo-wahl>deine Wahl: {wahl}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="zuo-raster" style={{gridTemplateColumns:`repeat(${n}, minmax(0, 1fr))`}}>
                {!z.wechselnd && z.spalten.map(t => <div key={t} className="zuo-kopf">{quiz.liste.spalten[t]?.name || t}</div>)}
                {z.ids.map((_, zeile) => z.spalten.map((t, sp) => {
                  const k = z.karten[sp][zeile];
                  const erl = z.erledigt[k.id];
                  const gi = z.gruppen.findIndex(g => g.wahl[sp] === zeile);
                  const g = gi >= 0 ? z.gruppen[gi] : null;
                  const geprueft = g && z.geprueft ? z.geprueft[gi] : undefined;
                  // Farbe: Lösung = je Vokabel; „am Ende“ = Farbe der Gruppe; „sofort“ = Farbe des gefundenen Paars
                  const farbe = loesung ? ZUORDNUNG_FARBEN[vokNr[k.id] % ZUORDNUNG_FARBEN.length]
                    : g ? ZUORDNUNG_FARBEN[g.farbe] : erl && z.paarFarbe?.[k.id] != null ? ZUORDNUNG_FARBEN[z.paarFarbe[k.id]] : null;
                  const wahl = !z.amEnde && z.offen?.wahl[sp] === zeile;
                  const blink = z.blink?.s === sp && z.blink?.i === zeile;
                  // ✓ / ✗: „sofort“ je gefundenem Paar, „am Ende“ nach dem Prüfen je Gruppe
                  const marke = loesung ? null : z.amEnde ? (geprueft === true ? "✓" : geprueft === false ? "✗" : null) : erl === "richtig" ? "✓" : erl === "falsch" ? "✗" : null;
                  const cls = ["zuo-karte", marke === "✓" ? "ok" : "", marke === "✗" ? "falsch-erl" : "", wahl ? "wahl" : "", blink ? "blink" : "",
                    z.anzeige && !marke && !loesung ? "offen-geblieben" : ""].filter(Boolean).join(" ");
                  return (
                    <button key={`${sp}-${zeile}`} className={cls} data-zuo-karte={`${sp}:${zeile}`} data-zuo-id={k.id}
                      style={{fontSize: schrift, ...(farbe ? { borderColor: farbe, background: `${farbe}26` } : {})}}
                      onClick={() => zuordnungTippe(sp, zeile)}
                      {...tt(z.amEnde ? "Antippen: in die farbige Gruppe aufnehmen – eingefärbte Karte antippen nimmt sie wieder heraus" : "Antippen: Karte wählen – die erste bestimmt die Vokabel, weitere werden sofort geprüft")}>
                      {marke ? <span className="zuo-nr" data-zuo-marke={marke === "✓" ? "richtig" : "falsch"} style={{background: marke === "✓" ? "var(--richtig)" : "var(--falsch)"}}>{marke}</span>
                        : g && !loesung ? <span className="zuo-nr" style={{background: farbe}}>{gi + 1}</span> : null}
                      {mitHinweis(k.text)}
                    </button>
                  );
                }))}
              </div>
              )}
              {z.anzeige && (
                <div style={{display:"flex", gap:8, marginTop:12}}>
                  {z.amEnde && z.art !== "memory" && (
                    <button className="btn btn-ghost" data-zuo-eigene style={{flex:1}}
                      onClick={() => setQuiz({ ...quiz, zuordnung: { ...z, anzeige: zeilenAnsicht ? "eigene" : "ergebnis" } })}
                      {...tt(zeilenAnsicht ? "Meine Zuordnung: die eigenen Gruppen mit ✓ / ✗" : "Zurück zur Lösung (ein richtiges Paar je Zeile)")}>{zeilenAnsicht ? "Meine Zuordnung" : "Lösung"}</button>
                  )}
                  <button className="btn btn-primary" data-zuo-weiter style={{flex:1}} onClick={() => setQuiz(z.mix ? zuordnungMixWeiter(quiz) : zuordnungRunde(quiz))}
                    {...tt(z.mix ? "Weiter mit der nächsten Frage – nicht Beantwortete kommen später wieder" : z.queue.length ? "Nächste Runde – nicht Beantwortete kommen wieder" : "Zur Auswertung")}>Weiter →</button>
                </div>
              )}
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

    // Lang-Druck: Frage, richtige Antwort, Info, beantwortete Spalten und eigene falsche MC-Antworten einzeln bearbeiten
    const vokListeId = aktVokRaw._listeId ?? quiz.liste.id;
    const bearbeite = (typ, falsch = null) => oeffneVokabelBearbeiten(aktVokRaw, vokListeId, typ, falsch);
    const spaltenName = t => quiz.liste.spalten[t]?.name || t;
    const vorlesenKlick = (text, typ) => ({ "data-vorlesen": typ, style: { cursor: "pointer" },
      onClick: e => { e.stopPropagation(); sprich(text, vokLang(aktVok, typ)); } });
    // Gesamt-Tempo als Regler in der Tafel (lang drücken auf eine Karte); beim Loslassen mit neuem Tempo vorlesen
    const tempoRegler = (text, typ) => () => ({ label: "Tempo (alle Sprachen)", min: 0.6, max: 1.4, step: 0.1, wert: STIMMEN_WAHL.tempo || 1,
      format: v => `${v.toFixed(1).replace(".", ",")}×`,
      aendern: v => aendereStimmen({ ...STIMMEN_WAHL, tempo: v === 1 ? undefined : v }), fertig: () => sprich(text, vokLang(aktVok, typ)) });
    const basisVon = typ => normLang(vokLang(aktVok, typ)).split("-")[0];
    const stimmeKnopf = (text, typ, wo) => {
      const aktiv = aktiveStimmen(basisVon(typ));
      if (aktiv.length < 2) return null;
      const nr = Math.max(0, aktiv.indexOf(gewaehlteStimme(basisVon(typ)) || stimmeFuer(vokLang(aktVok, typ)))) + 1;
      return (
        <button className="stimme-wechsel" data-stimme-wechsel={wo} data-stimme-nr={`${nr}/${aktiv.length}`} onClick={e => { e.stopPropagation(); wechsleStimme(text, vokLang(aktVok, typ)); }}
          {...tt(`Stimme ${nr} von ${aktiv.length} – antippen: mit der nächsten aktivierten Stimme vorlesen (bleibt dann für diese Sprache eingestellt)`)}>{nr}/{aktiv.length}</button>);
    };
    const antwortSichtbar = quiz.phase !== "eingabe" && !quiz.flash;
    const antwortBearbeiten = tt(antwortSichtbar ? "Antippen: Antwort vorlesen – lang drücken: Tempo, richtige Antwort bearbeiten" : "Lang drücken: Tempo, richtige Antwort bearbeiten", [
      { label: "✎ Richtige Antwort bearbeiten", fn: () => bearbeite(aktAntwortTyp) },
    ], { langText: `${antwortLabel}: richtige Antwort bearbeiten`, regler: tempoRegler(quiz.antwortTeile?.[0] || "", aktAntwortTyp) });
    const frageBearbeiten = tt("Antippen: Frage vorlesen – lang drücken: Tempo, Frage bearbeiten", [
      { label: "✎ Frage bearbeiten", fn: () => bearbeite(quiz.frageTyp) },
    ], { langText: `${frageLabel}: Frage bearbeiten`, regler: tempoRegler(frageWert, quiz.frageTyp) });
    const infoAktionen = typen => typen.map(t => ({ label: `✎ ${spaltenName(t)} bearbeiten`, fn: () => bearbeite(t) }));
    const eigeneFalsche = aktVokRaw[aktAntwortTyp]?.falsch || [];

    let antwortBoxKlasse = "quiz-antwort-box";
    if (quiz.flash) antwortBoxKlasse += " richtig";
    if (quiz.gelerntBlitz && quiz.gelerntBlitz === blitzKey(quiz)) antwortBoxKlasse += " gelernt-blitz";
    else if (richtigAufgedeckt) antwortBoxKlasse += " richtig";
    else if (quiz.karteNeinFlash) antwortBoxKlasse += " falsch";
    else if (quiz.falschFlash) antwortBoxKlasse += " falsch";
    else if (quiz.phase === "aufgedeckt") antwortBoxKlasse += " aufgedeckt";
    else if (isWeitere) antwortBoxKlasse += " weitere";

    return (
      <>
        <style>{CSS}</style>{farbModusUI}{farbRadUI}{renderVokabelEditor()}
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
                  ...(karteInfoAn ? {} : {background:"var(--karte)", color:"var(--haupt)", border:"1.5px solid var(--haupt)"})}}
                onClick={() => speichereEinst({...einstellungen, karteInfo: !karteInfoAn})}
                {...tt(karteInfoAn ? "Info-Kasten ausblenden (gilt dauerhaft)" : "Info-Kasten einblenden (gilt dauerhaft)")}>i</button>
            )}
            {(() => {
              const an = !!einstellungen.autoplay;
              const vorlesen = einstellungen.vorlesen || ["E1"];
              const spalten = [...new Set([quiz.frageTyp, ...quiz.antwortTypen])].filter(Boolean);
              const keineDabei = an && !spalten.some(t => vorlesen.includes(t));
              return (
                <button data-autoplay-schalter={an ? "an" : "aus"} className="topbar-back"
                  style={{width:36, height:36, padding:0, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                    ...(an ? {} : {background:"var(--karte)", color:"var(--haupt)", border:"1.5px solid var(--haupt)", opacity:.75})}}
                  onClick={() => { if (an) window.speechSynthesis?.cancel(); speichereEinst({...einstellungen, autoplay: !an}); }}
                  {...tt(an ? (keineDabei ? "Automatisches Vorlesen ist an, aber keine Spalte dieser Abfrage ist zum Vorlesen gewählt – lang drücken" : "Automatisches Vorlesen ausschalten")
                      : "Vokabeln automatisch vorlesen: Frage beim Erscheinen, Antwort beim Aufdecken", [
                    ...spalten.map(t => ({ label: `${vorlesen.includes(t) ? "✓ " : "○ "}${quiz.liste.spalten[t]?.name || t} vorlesen`,
                      fn: () => speichereEinst({...einstellungen, vorlesen: vorlesen.includes(t) ? vorlesen.filter(x => x !== t) : [...vorlesen, t]}) })),
                  ], { langText: "Lang drücken: wählen, welche Spalten automatisch vorgelesen werden" })}>
                  {an ? <IcoSpkOn s={20}/> : <IcoSpk s={16}/>}
                </button>
              );
            })()}
            <span className="topbar-title">
              {quiz.wiederholungDurchgang ? <span className="wiederholung-marke" {...tt("Diese Vokabeln werden wiederholt, weil sie noch nicht sicher sitzen")}>🔁 Wiederholung </span> : null}
              {quiz.spielZaehler != null ? <span data-spiel-zaehler>{quiz.abfrageZiel?.modus === "blitz" ? "⚡" : "🔥"} {quiz.spielZaehler}</span>
                : <span>{quiz.index + 1} / {quiz.vokabeln.length}</span>}
              {quiz.spielZaehler == null && renderKopfFortschritt(quiz)}
            </span>
            <span className="quiz-fortschritt" {...tt(akz ? "Eigener Akzent-Score dieser Vokabel" : "Score dieser Vokabel")}>{akz ? "Akzente" : "Score"}: {score > 0 ? "+" : ""}{score}</span>
          </div>
          {quiz.abfrageZiel?.modus === "blitz" && quiz.abfrageZiel.ende && (
            <div className="zuo-zeit" data-blitz-zeit style={{margin:"8px 16px 0"}}>
              <div key={quiz.abfrageZiel.ende} className="zuo-zeit-balken" style={{animationDuration:`${Math.max(0, quiz.abfrageZiel.ende - Date.now())}ms`}}/>
            </div>
          )}
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
                  name, typ,
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
                    <div className="quiz-frage-box" style={{marginBottom:0, cursor:"pointer", position:"relative"}} data-karte-frage data-vorlesen={quiz.frageTyp} {...frageBearbeiten}
                      onClick={e => { e.stopPropagation(); sprich(frageWert, vokLang(aktVok, quiz.frageTyp)); }}>
                      {stimmeKnopf(frageWert, quiz.frageTyp, "frage")}
                      <div className="quiz-label">{frageLabel}</div>
                      <div style={{display:"flex", alignItems:"baseline", gap:8, justifyContent:"center"}}>
                        <div className="quiz-frage-text" style={{textAlign:"center"}}>
                          {aktSpaltModus === "hoeren" && quiz.phase === "eingabe" && !quiz.flash
                            ? <span className="hoer-symbol" data-hoer-verdeckt>🔊</span> : mitHinweis(frageWert)}
                        </div>
                      </div>
                    </div>

                    {quiz.vorigeAntworten.map((v, i) => (
                      <div key={i} className={`quiz-vorig${v.richtig ? "" : " nicht"}`} data-vorig={v.richtig ? "richtig" : "falsch"}
                        {...tt(`${v.label}: schon beantwortet – lang drücken zum Bearbeiten`, [{ label: "✎ Antwort bearbeiten", fn: () => bearbeite(v.typ) }], { langText: `${v.label}: Antwort bearbeiten` })}>
                        <div className="quiz-vorig-label">{v.richtig ? "✓" : "✗"} {v.label}</div>
                        <div style={{textAlign:"center", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", gap:6}}>
                          <strong {...vorlesenKlick(v.wert, v.typ)}>{mitHinweis(v.wert)}</strong>
                        </div>
                      </div>
                    ))}

                    <div className={antwortBoxKlasse} style={{marginBottom:0, position:"relative", ...(antwortSichtbar ? { cursor:"pointer" } : {})}} data-karte-antwort data-karte-verdeckt={isKarteEingabe ? "" : undefined} {...antwortBearbeiten}
                      {...(antwortSichtbar ? { onClick: e => { e.stopPropagation(); sprich(quiz.antwortTeile?.[0] || "", vokLang(aktVok, aktAntwortTyp)); } } : {})}>
                      {antwortSichtbar && stimmeKnopf(quiz.antwortTeile?.[0] || "", aktAntwortTyp, "antwort")}
                      {antwortBoxKlasse.includes("gelernt-blitz") && <GelerntSterne/>}
                      <div className="quiz-label" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                        <span style={{display:"inline-flex", alignItems:"center"}}>{antwortStatus(antwortBoxKlasse)}{antwortLabel}{isWeitere && <span style={{color:"var(--info)", marginLeft:8}}>— weitere Antwort</span>}</span>
                        {(isKarteEingabe || isKarteAufgedeckt || quiz.karteNeinFlash) && (
                          <span className={`score-badge ${score > 0 ? "score-pos" : score < 0 ? "score-neg" : "score-null"}`} style={{fontSize:"0.88rem", padding:"2px 9px"}}>
                            {score > 0 ? "+" : ""}{score}
                          </span>
                        )}
                      </div>
                      {/* Karte-Modus: Platzhalter in Höhe der Antwort (ohne Text), damit beim Aufdecken nichts springt */}
                      {isKarteEingabe && <div className="karte-aufdecken" aria-hidden="true" style={{visibility:"hidden"}}>&nbsp;</div>}
                      {/* MC */}
                      {aktSpaltModus === "artikel" && !quiz.flash && quiz.phase === "eingabe" && (() => {
                        const info = artikelInfo(aktVokRaw?.[aktAntwortTyp]?.wert, vokSprache(aktVokRaw));
                        return info ? <div className="artikel-wort" data-artikel-wort>{info.rest}</div> : null;
                      })()}
                      {istMC(aktSpaltModus) && !quiz.flash && quiz.phase === "eingabe" && (
                        <div className="mc-raster" data-mc-raster>
                          {(quiz.mcButtons || []).map((btn, idx) => (
                            <button {...tt("Diese Antwort wählen – nur ein Treffer ohne Fehlklick zählt als gewusst",
                                btn.korrekt ? [{ label: "✎ Richtige Antwort bearbeiten", fn: () => bearbeite(aktAntwortTyp) }]
                                  : eigeneFalsche.includes(btn.text) ? [{ label: "✎ Falsche Antwort bearbeiten", fn: () => bearbeite(aktAntwortTyp, btn.text) }] : [],
                                { langText: btn.korrekt || eigeneFalsche.includes(btn.text) ? "Lang drücken: diese Antwort bearbeiten"
                                  : "Diese falsche Antwort stammt aus einer anderen Vokabel – bearbeiten in deren Liste" })} key={idx} data-mc-knopf
                              onClick={e => { e.stopPropagation(); quiz.phase === "eingabe" && klickeButton(idx); }}
                              style={{
                                padding:"12px 10px", borderRadius:12, border:"none",
                                fontFamily:"inherit", fontSize:"1.05rem", fontWeight:700,
                                cursor: btn.status === "richtig" || quiz.phase === "aufgedeckt" ? "default" : "pointer",
                                background:
                                  btn.status === "richtig" ? "var(--haupt)" :
                                  btn.status === "falsch"  ? "var(--falsch)" : "var(--rahmen)",
                                color: btn.status === "neutral" ? "var(--text-stark)" : btn.status === "falsch" ? "var(--auf-falsch)" : "var(--auf-haupt)",
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
                      {SATZ_ARTEN.includes(aktSpaltModus) && !quiz.flash && quiz.phase === "eingabe" && (() => {
                        const key = `${quiz.index}|${quiz.antwortTypIndex}|${quiz.aktuelleFehlversuche || 0}`;
                        const satz = satzFuer(aktVokRaw, `${quiz.index}|${quiz.antwortTypIndex}`);
                        if (!satz) return null;
                        const antworte = richtig => { setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: [], lueckeText: "" })); pruefeAntwort(richtig ? quiz.antwortTeile[0] : "\u0000"); };
                        const wahl = quiz.puzzleKey === key ? (quiz.puzzleWahl || []) : [];
                        if (aktSpaltModus === "satzfinden") return (
                          <div data-satzfinden onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                            <div className="satz-band">
                              {satz.woerter.map((w, i) => <button key={i} className="satz-wort" data-satz-wort={i} data-satz-ziel={w.ziel ? "" : undefined}
                                onClick={() => antworte(w.ziel)} {...tt("Antippen, wenn das das gesuchte Wort ist")}>{w.text}</button>)}
                            </div>
                            {(einstellungen.satzUebFinden ?? false) && <div className="satz-ueb">{satz.ueb}</div>}
                          </div>
                        );
                        if (aktSpaltModus === "lueckensatz") {
                          const txt = quiz.puzzleKey === key ? (quiz.lueckeText || "") : "";
                          const pruefe = () => { const t = txt.trim(); if (!t) return; antworte(!!istRichtigeAntwort(t, satz.form, quizRegeln().akzenteTolerant)); };
                          return (
                            <div data-lueckensatz onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                              <div className="satz-text" data-lueckensatz-text>{satz.woerter.map((w, i) => <span key={i}>{w.ziel ? <>{w.text.split(w.kern)[0]}<span className="satz-luecke">{"_".repeat(Math.max(4, w.kern.length))}</span>{w.text.split(w.kern).slice(1).join(w.kern)}</> : w.text}{" "}</span>)}</div>
                              {(einstellungen.satzUebLuecke ?? true) && <div className="satz-ueb">{satz.ueb}</div>}
                              <input ref={eingabeRef} className="inp" data-lueckensatz-eingabe value={txt} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                                placeholder="fehlendes Wort eintippen…" onChange={e => setQuiz(prev => ({ ...prev, puzzleKey: key, lueckeText: e.target.value }))}
                                onKeyDown={e => { if (e.key === "Enter") pruefe(); }} {...ttFeld("Das fehlende Wort in der passenden Form eintippen, Enter prüft")}/>
                              <button className="btn btn-primary btn-sm" data-lueckensatz-pruefen style={{marginTop:6}} onClick={pruefe} {...tt("Prüfen")}>Prüfen</button>
                            </div>
                          );
                        }
                        // Satz bauen: Wörter gemischt, der Reihe nach antippen
                        const kacheln = satz.woerter.map((w, i) => ({ ...w, i }));
                        const z = zufallMitSeed(key + satz.satz);
                        for (let i = kacheln.length - 1; i > 0; i--) { const j = Math.floor(z() * (i + 1)); [kacheln[i], kacheln[j]] = [kacheln[j], kacheln[i]]; }
                        const tippe = k => {
                          const neu = [...wahl, k];
                          if (neu.length < kacheln.length) { setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: neu })); return; }
                          antworte(neu.map(x => kacheln[x].text).join(" ") === satz.woerter.map(w => w.text).join(" "));
                        };
                        return (
                          <div data-satzbauen onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                            <div className="satz-ueb" style={{marginBottom:8}}>{satz.ueb}</div>
                            <div className="satz-text satz-gebaut" data-satzbauen-text>{wahl.map(x => kacheln[x].text).join(" ") || " "}</div>
                            <div className="puzzle-kacheln">
                              {kacheln.map((w, i) => <button key={i} className="puzzle-kachel satz-kachel" data-satz-kachel={i} disabled={wahl.includes(i)} onClick={() => tippe(i)} {...tt("Wort als nächstes einsetzen")}>{w.text}</button>)}
                            </div>
                            {wahl.length > 0 && <button className="btn btn-ghost btn-sm" style={{marginTop:6}} onClick={() => setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: wahl.slice(0, -1) }))} {...tt("Letztes Wort zurücknehmen")}>⌫ zurück</button>}
                          </div>
                        );
                      })()}
                      {SATZ_ARTEN.includes(aktSpaltModus) && quiz.phase !== "eingabe" && !quiz.flash && (() => {
                        const satz = satzFuer(aktVokRaw, `${quiz.index}|${quiz.antwortTypIndex}`);
                        return satz ? <div className="satz-text" data-satz-loesung style={{marginTop:8}}>{satz.woerter.map((w, i) => <span key={i}>{w.ziel ? <>{w.text.split(w.kern)[0]}<b>{w.kern}</b>{w.text.split(w.kern).slice(1).join(w.kern)}</> : w.text}{" "}</span>)}<div className="satz-ueb">{satz.ueb}</div></div> : null;
                      })()}
                      {(aktSpaltModus === "puzzle" || aktSpaltModus === "luecke") && !quiz.flash && (quiz.phase === "eingabe" || isWeitere) && (() => {
                        const ziel = ohneHinweis(isWeitere ? quiz.antwortTeile[quiz.weitereIndices[quiz.weiterePos]] : quiz.antwortTeile[0]) || "";
                        const key = `${quiz.index}|${quiz.antwortTypIndex}|${quiz.weiterePos || 0}|${quiz.aktuelleFehlversuche || 0}`;
                        const wahl = quiz.puzzleKey === key ? (quiz.puzzleWahl || []) : [];
                        if (aktSpaltModus === "puzzle") {
                          const kacheln = puzzleKacheln(ziel, key + ziel);
                          const n = kacheln.length;
                          const gelegt = wahl.map(k => kacheln[k].z);
                          let p = 0;
                          const anzeige = [...ziel].map(c => FESTES_ZEICHEN.test(c) ? c : (gelegt[p++] ?? "_"));
                          const tippe = k => {
                            const neu = [...wahl, k];
                            if (neu.length < n) { setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: neu })); return; }
                            let q = 0; const wort = [...ziel].map(c => FESTES_ZEICHEN.test(c) ? c : kacheln[neu[q++]].z).join("");
                            setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: [] }));
                            pruefeAntwort(wort);
                          };
                          return (
                            <div data-puzzle onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                              <div className="puzzle-zeile" data-puzzle-wort>{anzeige.map((c, i) => <span key={i} className={`puzzle-feld${c === "_" ? " frei" : ""}${c === " " ? " luecke-leer" : ""}`}>{c === "_" ? "" : c}</span>)}</div>
                              <div className="puzzle-kacheln">
                                {kacheln.map((k, i) => (
                                  <button key={i} className="puzzle-kachel" data-puzzle-kachel={i} disabled={wahl.includes(i)} onClick={() => tippe(i)} {...tt("Buchstabe als nächsten einsetzen")}>{k.z}</button>
                                ))}
                              </div>
                              {wahl.length > 0 && <button className="btn btn-ghost btn-sm" data-puzzle-zurueck style={{marginTop:6}}
                                onClick={() => setQuiz(prev => ({ ...prev, puzzleKey: key, puzzleWahl: wahl.slice(0, -1) }))} {...tt("Letzten Buchstaben zurücknehmen")}>⌫ zurück</button>}
                            </div>
                          );
                        }
                        // Lücken
                        const vokJetzt = quiz.vokabeln[quiz.index];
                        const pos = lueckenPositionen(ziel, vokJetzt?.fortschritt?.score ?? 0, einstellungen.modus !== "einfach", key + ziel);
                        const eingabe = quiz.puzzleKey === key ? (quiz.lueckeText || "") : "";
                        const buchst = [...eingabe.replace(/\s/g, "")];
                        const zusammen = () => { let q = 0; return [...ziel].map((c, i) => pos.includes(i) ? (buchst[q++] || "") : c).join(""); };
                        const pruefe = text => { const b = [...text.replace(/\s/g, "")]; let q = 0; const wort = [...ziel].map((c, i) => pos.includes(i) ? (b[q++] || "") : c).join("");
                          setQuiz(prev => ({ ...prev, puzzleKey: key, lueckeText: "" })); pruefeAntwort(wort); };
                        let q = 0;
                        return (
                          <div data-luecke onClick={e => e.stopPropagation()} style={{marginTop:6}}>
                            <div className="puzzle-zeile" data-luecke-wort>{[...ziel].map((c, i) => {
                              if (!pos.includes(i)) return <span key={i} className={`puzzle-feld fest${c === " " ? " luecke-leer" : ""}`}>{c}</span>;
                              const b = buchst[q++];
                              return <span key={i} className={`puzzle-feld${b ? "" : " frei"}`} data-luecke-feld>{b || ""}</span>;
                            })}</div>
                            <input ref={eingabeRef} className="inp" data-luecke-eingabe value={eingabe} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                              placeholder={pos.length === 1 ? "1 fehlenden Buchstaben eintippen…" : `${pos.length} fehlende Buchstaben eintippen…`}
                              onChange={e => { const t = e.target.value; if ([...t.replace(/\s/g, "")].length >= pos.length) pruefe(t); else setQuiz(prev => ({ ...prev, puzzleKey: key, lueckeText: t })); }}
                              onKeyDown={e => { if (e.key === "Enter") pruefe(zusammen() ? eingabe : eingabe); }}
                              {...ttFeld("Die fehlenden Buchstaben der Reihe nach eintippen – ist die letzte Lücke gefüllt, wird geprüft")}/>
                          </div>
                        );
                      })()}
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
                        const regeln = quizRegeln();
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
                        </div>
                        );
                      })()}
                      {/* Lösung: Flash (richtig) */}
                      {quiz.flash && (
                        <div className="quiz-frage-text" style={{textAlign:"center", color:"var(--richtig-dunkel)", minHeight:"44px", display:"flex", alignItems:"center", justifyContent:"center"}}>
                          {mitHinweis(quiz.antwortTeile.join(" / "))}{" ✓"}
                        </div>
                      )}
                      {/* Lösung: Aufgedeckt */}
                      {!quiz.flash && quiz.phase === "aufgedeckt" && !akzLoesung && (
                        istMC(aktSpaltModus)
                          ? <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:8, minHeight:60}}>
                              <div className="quiz-frage-text" {...vorlesenKlick(quiz.antwortTeile[0], aktAntwortTyp)} style={{textAlign:"center", cursor:"pointer"}}>{mitHinweis(quiz.antwortTeile.join(" / "))}</div>
                            </div>
                          : <div className="quiz-frage-text" style={{textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:6, minHeight:"44px"}}>
                              <span {...vorlesenKlick(quiz.antwortTeile[0], aktAntwortTyp)}>{mitHinweis(quiz.antwortTeile.join(" / "))}</span>
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
                    <div {...tt("Nächste Info-Seite anzeigen", infoAktionen([aktInfoSeite.typ]), { langText: `${aktInfoSeite.name}: lang drücken zum Bearbeiten` })} data-info-box
                      onClick={() => setQuiz(prev => ({...prev, infoSeite: ((prev.infoSeite || 0) + 1) % infoSeitenAnzahl}))}
                      style={{
                        width:150, flexShrink:0, background:"var(--gelb-flaeche)",
                        border:"1px solid var(--gelb-zart)", borderRadius:12, padding:"12px",
                        cursor: infoSeitenAnzahl > 1 ? "pointer" : "default",
                        display:"flex", flexDirection:"column", gap:6,
                      }}>
                      <div style={{fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase",
                        letterSpacing:".05em", color:"var(--orange)"}}>
                        {aktInfoSeite.name}
                      </div>
                      <div style={{fontSize:"0.85rem", lineHeight:1.45, flex:1}}>
                        {aktInfoSeite.text}
                      </div>
                      {infoSeitenAnzahl > 1 && (
                        <div style={{fontSize:"0.7rem", color:"var(--gelb)", textAlign:"right", marginTop:"auto"}}>
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
                {...tt(karteInfoPin ? "Info-Text (angeheftet)" : karteInfoOffen ? "Info einklappen" : "Info aufklappen",
                  infoAktionen(quiz.sitzungsInfoTypen || []), { langText: "Info: lang drücken zum Bearbeiten" })}
                style={{background:"var(--gelb-flaeche)", border:"1px solid var(--gelb-zart)", borderRadius:12, padding: karteInfoOffen ? "10px 12px" : "7px 12px", marginBottom:14, cursor: karteInfoPin ? "default" : "pointer"}}>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{flex:1, fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", color:"var(--orange)"}}>Info</span>
                  {karteInfoOffen ? (
                    <button data-karte-info-pin={karteInfoPin ? "an" : "aus"}
                      onClick={e => { e.stopPropagation(); speichereEinst({...einstellungen, karteInfoPin: !karteInfoPin}); if (karteInfoPin) setQuiz(prev => ({...prev, infoSichtbar: true})); }}
                      {...tt(karteInfoPin ? "Lösen – der Info-Kasten kommt wieder eingeklappt" : "Anheften – der Info-Kasten bleibt dauerhaft aufgeklappt")}
                      style={{background: karteInfoPin ? "var(--gelb-zart)" : "none", border:"none", borderRadius:6, padding:"2px 6px", cursor:"pointer", fontSize:"0.95rem", lineHeight:1,
                        opacity: karteInfoPin ? 1 : 0.45, transform: karteInfoPin ? "none" : "rotate(45deg)"}}>📌</button>
                  ) : (
                    <span style={{fontSize:"0.75rem", color:"var(--gelb)"}}>▼</span>
                  )}
                </div>
                {karteInfoOffen && infoSpalten.length === 0 && (
                  <div style={{marginTop:6, fontSize:"0.85rem", color:"var(--text3)", fontStyle:"italic"}}>Keine Zusatzinfo vorhanden</div>
                )}
                {karteInfoOffen && infoSpalten.map(typ => (
                  <div key={typ} style={{marginTop:6}}>
                    {infoSpalten.length > 1 && <div style={{fontSize:"0.68rem", fontWeight:700, color:"var(--gelb)"}}>{quiz.liste.spalten[typ]?.name || typ}</div>}
                    <div style={{fontSize:"0.88rem", lineHeight:1.45, whiteSpace:"pre-wrap"}}>{aktVokRaw[typ].wert}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Noch kommende Spalten */}
            {!quiz.flash && quiz.antwortTypen.length > 1 && (quiz.phase === "eingabe" || quiz.phase === "falsch" || isWeitere) && (
              <div style={{fontSize:"0.78rem", color:"var(--text2)", marginBottom:10}}>
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
      ? {background:"var(--haupt-flaeche)", borderColor:"var(--haupt)", color:"var(--haupt)"}
      : sf ? {background:"var(--haupt-flaeche)", borderColor:"var(--haupt-zart)", color:"var(--haupt)"} : {};
  };
  // Fortschritt der Abfrageart: beim aktiven Eintrag die gerade eingestellte, sonst die gespeicherte
  const slotChipLabel = (eintrag) => {
    const sf = slotSFAlle(eintrag)[aktiverSlot?.id === eintrag.id ? quizAbfrageArt : slotKonfigArt(eintrag)];
    const name = eintrag.multi ? `🧩 ${eintrag.name}` : eintrag.name;
    return sf ? `▶ ${name} · ${(sf.abgefragt||[]).length}/${sf.gesamt||0}` : name;
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
      <style>{CSS}</style>{farbModusUI}{farbRadUI}
      <div className="app">
        <div ref={headerRef} style={{position:"sticky", top:0, zIndex:10, background:"var(--app-kopf)", ...(quizVokMax ? {display:"none"} : {})}}>
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
                    <div {...tt(s.code === "alle" ? "Listen aller Sprachen anzeigen" : `Nur Listen auf ${s.name} anzeigen`)} key={s.code} className="karte-zeile" style={{cursor:"pointer", background: sprachFilter === s.code ? "var(--haupt-flaeche)" : undefined}}
                      onClick={() => wechsleSprache(s.code)}>
                      <span style={{fontWeight: sprachFilter === s.code ? 700 : 500}}>{s.flagge} {s.name}</span>
                      <span style={{marginLeft:"auto", color:"var(--text2)", fontSize:"0.8rem"}}>{s.anzahl} Liste{s.anzahl !== 1 ? "n" : ""}</span>
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
                cursor:"pointer", color:"var(--haupt)", padding:"6px 8px"}}
              {...tt("Vollbild verlassen")}>
              <IcoCollapse s={18}/>
            </button>
          )}
        </div>
        {!statistikVollbild && <div className="tabs">
          <button {...tt("Abfrage einstellen und starten")} className={`tab${tab==="quiz"?" aktiv":""}`}
            onClick={() => handleTabWechsel("quiz")}>Quiz</button>
          <button {...tt("Lernfortschritt und Scores ansehen")} className={`tab${tab==="statistik"?" aktiv":""}`}
            onClick={() => handleTabWechsel("statistik")}>Statistik</button>
          <button {...tt("Listen, Sicherung, Einstellungen, Info und Anleitung")} className={`tab${tab==="einstellungen" || tab==="listen"?" aktiv":""}`}
            onClick={() => handleTabWechsel("einstellungen")}>Einstellungen</button>
        </div>}
        </div>{/* end sticky header wrapper */}

        {/* ── Listen-Header (persistent) ── */}
        {tab === "listen" && ansicht !== "import" && ansicht !== "ki-prompt" && (
          <div ref={listeDetailKopfRef} className="liste-detail-header" style={{top: headerH}}>
            {ansicht === "liste-detail" && aktiveListe ? (
              <>
                <button className="btn-icon" data-zurueck-listen onClick={zuEinstListen} {...tt("Zurück zu Einstellungen › Listen")} style={{padding:"4px 6px", marginRight:2, color:"var(--haupt)"}}><IcoBack s={18}/></button>
                <span className="liste-detail-header-name" data-liste-kopf-name
                  {...tt(aktiveListe.name, listenMenue(listenIndex.find(l => l.id === aktiveListeId) || aktiveListe, true), { langText: aktiveListe.name })}>{aktiveListe.name}</span>
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
            {ansicht === "import" && <button className="btn-icon" data-zurueck-listen onClick={e => { e.stopPropagation(); zuEinstListen(); }} {...tt("Zurück zu Einstellungen › Listen")} style={{padding:"4px 6px", marginRight:2, color:"var(--haupt)"}}><IcoBack s={18}/></button>}
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
          // Score-Filter (nur schlechteste-Modus) → Basis für Reihenfolge-Header; eingeschaltete Gelernte bleiben dabei
          const gelerntDabei = v => quizGelerntEinschliessen && (einstellungen.gelerntSchwelle ?? 0) > 0
            && (nurAkzent ? (v.akzentFortschritt?.score ?? -Infinity) : gelerntScore(v, quizModus === "diktat")) >= einstellungen.gelerntSchwelle;
          let reihenfolgeVoks = akzentVoks;
          if (quizReihenfolge === "schlechteste" && quizSchlechtesteMaxScore !== "" && !isNaN(parseFloat(quizSchlechtesteMaxScore))) {
            const thr = parseFloat(quizSchlechtesteMaxScore);
            reihenfolgeVoks = akzentVoks.filter(v => gelerntDabei(v) || ((nurAkzent ? v.akzentFortschritt : quizModus === "diktat" ? v.diktatFortschritt : v.fortschritt)?.score ?? 0) < thr);
          }
          const schwelle = einstellungen.gelerntSchwelle ?? 0;
          const istDiktat = quizModus === "diktat";
          const startScore = v => nurAkzent ? (v.akzentFortschritt?.score ?? -Infinity) : gelerntScore(v, istDiktat);
          const gelernteAnzahl = schwelle > 0
            ? akzentVoks.filter(v => startScore(v) >= schwelle).length : 0;
          if (!quizGelerntEinschliessen && schwelle > 0)
            reihenfolgeVoks = reihenfolgeVoks.filter(v => startScore(v) < schwelle);
          if (!istDiktat && abfrageZielModus === "score" && abfrageZielScoreTyp !== "session")
            reihenfolgeVoks = reihenfolgeVoks.filter(v => gelerntDabei(v) || ((nurAkzent ? v.akzentFortschritt : v.fortschritt)?.score ?? 0) < abfrageZielScore);
          if (nurAkzent) {
            const laufend = isPakete && sessionSlotAktiv && !sessionSlotKonflikt() ? sessionSlotAktiv : null;
            reihenfolgeVoks = begrenzeOhneAkzent(reihenfolgeVoks, quizAntwortTypenGeordnet,
              laufend && Object.keys(laufend.startScores || {}).length > 0 ? new Set(Object.keys(laufend.startScores)) : null);
          }
          const ohneAkzentAnzahl = nurAkzent && stufenRegeln(einstellungen).akzentOhneMischen
            ? reihenfolgeVoks.filter(v => !quizAntwortTypenGeordnet.some(t => hatAkzente(v[t]?.wert))).length : null;
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
          const modusSpalten = quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet;
          const antwortArten = MODI_REIHENFOLGE.filter(m => modusSpalten.some(t => modiVon(quizSpalteModus[t]).includes(m))).map(m => ANTWORT_MODUS_NAMEN[m]);
          const gemischt = !istDiktat && modusSpalten.some(t => modiVon(quizSpalteModus[t]).length > 1);
          const abfrageModusName = istDiktat ? "Diktat"
            : [quizModus === "rotierend" && "wechselnd", antwortArten.join(" + ") || (quizModus !== "rotierend" && "Frage – Antwort")].filter(Boolean).join(" · ");
          const alleAbgefragt = sessionHatFortschritt && sessionAbgefragtAnzahl >= sessionAnzahl;
          // Lernen: die noch offenen Vokabeln der Session, paketweise (ohne Score, ohne Session-Fortschritt)
          const lernAktiv = !!einstellungen.lernen?.aktiv;
          const lernVokabeln = () => {
            const ab = sessionHatFortschritt ? new Set(sessionSlotAktiv.abgefragt || []) : null;
            let v = reihenfolgeVoks.filter(x => !ab?.has(x.id));
            if (!v.length) v = reihenfolgeVoks;
            return ordneVokabeln(v, istDiktat ? "diktatFortschritt" : nurAkzent ? "akzentFortschritt" : "fortschritt", quizReihenfolge, quizUnbeantwortetZuerst);
          };
          const lernSpalten = (istDiktat ? [quizDiktatSpalte, quizDiktatUebersetzung] : quizModus === "rotierend" ? quizAusgewaehlt : [quizFrageTyp, ...quizAntwortTypenGeordnet]).filter(Boolean);
          const lernInfo = kombiListe ? [...quizInfoTypenSession, ...TYPEN.filter(t => t.startsWith('i') && kombiListe.spalten[t].aktiv && quizZeigeInfo[t])] : [];
          const lernAnzahl = lernAktiv ? lernVokabeln().length : 0;
          const lernStand = lernAktiv ? lernStandVon(aktiverSlot, quizAbfrageArt) : null;
          const lernGesamt = lernStand ? lernStand.ids.length : 0;
          const lernAngesehen = lernStand ? Math.min(lernGesamt, lernStand.start + (lernStand.fertig ? Math.min(lernStand.groesse, lernGesamt - lernStand.start) : lernStand.index)) : 0;
          // Start-Knopf: was in der laufenden Session noch übrig ist (die Paketgröße steht auf dem Umfang-Knopf)
          const startRest = isPakete ? Math.max(0, sessionAnzahl - sessionAbgefragtAnzahl) : verfuegbar;
          const sessionPct = sessionAnzahl > 0 ? Math.round(sessionAbgefragtAnzahl / sessionAnzahl * 100) : 0;
          const sliderActive = quizSchlechtesteMaxScore !== "";
          const sliderVal = sliderActive ? parseInt(quizSchlechtesteMaxScore) : 0;
          const sliderPct = (sliderVal + 10) / 20;

          return (
            <>
              <div className="sektion" data-quiz-ansicht={slotSektionAufgeklappt ? "auswahl" : "einstellungen"} style={{paddingTop:0, paddingBottom:0}}
                data-quiz-fokus={quizFokus || ""} data-quiz-offen={quizFokus === "zeile1" ? (quizStufeAufgeklappt ? "stufe" : quizAbfrageModusAufgeklappt ? "modus" : "reihenfolge") : quizFokus === "zeile2" ? String(quizSessionAufgeklappt) : quizFokus || ""}>
                {/* VERLAUF + GESPEICHERT – Kopfzeile (zu/auf gleich) + aufklappbares Raster */}
                {(() => {
                  return (
                    <>
                      {renderSlotKopf(false)}
                      {/* Aufklappbarer Chips-Bereich */}
                      {listenIndex.length === 0 && (
                        <div className="meldung-info" data-keine-listen style={{marginTop:12}}>
                          <div>Noch keine Listen.</div>
                          <button className="btn btn-primary btn-sm" style={{marginTop:8}} data-liste-importieren onClick={() => { resetImport(); setTab("listen"); setAnsicht("import"); }}
                            {...tt("Zu Einstellungen › Listen: Liste importieren oder neu anlegen")}>Liste importieren</button>
                        </div>
                      )}
                      <div ref={slotContainerRef} style={{overflow:'hidden', paddingTop: slotSektionAufgeklappt ? 12 : 0, paddingBottom: slotSektionAufgeklappt ? 4 : 0}}>
                        {slotSektionAufgeklappt && sicherungErinnerungUI()}
                        {slotSektionAufgeklappt && listenIndex.length > 0 && !slotSortModus && !multiAuswahl && (
                          <button className="btn btn-ghost neue-session-knopf" data-neue-session onClick={() => { setNeueSessionSchritt("art"); setModal("neue-session"); }}
                            {...tt("Neue Session aus Listen zusammenstellen – eine Session oder mehrere (eine Liste in Pakete aufteilen)")}>
                            <IcoPlus s={13}/> Neue Session aus Listen
                          </button>
                        )}
                        {slotSektionAufgeklappt && renderSlotBereiche(null, ladeSlot, aktiverSlot)}
                      </div>
                    </>
                  );
                })()}

                {!slotSektionAufgeklappt && (<>
                {/* LISTEN-AUSWAHL – sticky Header (ausgeblendet bei geladener gespeicherter Konfiguration) */}
                {!(aktiverSlot?.typ === "gespeichert" && !listenAendern) && (<>
                {(() => {
                  const n = quizTabListen.length;
                  const chipText = n === 0
                    ? "auswählen"
                    : n === 1
                    ? (listenIndex.find(l => l.id === quizTabListen[0])?.name || "Liste")
                    : `${n} Listen`;
                  return (
                    <div ref={listenauswahlHeaderRef} className="liste-detail-header" style={{position: quizFokus === "listen" ? "sticky" : "relative", top: quizFokus === "listen" ? headerH + slotH : 0, zIndex:8, marginLeft:"-16px", marginRight:"-16px", ...(fokusZeigt("listen") ? {} : {display:"none"})}}>
                      {/* LINKS */}
                      <span style={{flex:1, display:"flex", alignItems:"center", gap:6}}>
                        {listenOffen ? (
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
                          <span style={{fontWeight:600, fontSize:"0.85rem", color:"var(--text)"}}>Listen-Auswahl</span>
                        )}
                      </span>
                      {/* MITTE */}
                      {n > 0 && (
                        <span style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"var(--text3)", cursor:"help"}}
                          {...tt("Anzahl aller Vokabeln in den gewählten Listen")}>
                          ({quizBasisVoks.length} V.)
                        </span>
                      )}
                      {/* RECHTS */}
                      <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                        {n === 0 ? (
                          <span data-listen-hinweis style={{fontSize:"0.85rem", fontWeight:600, color:"var(--text3)", padding:"6px 4px"}}
                            {...tt("Liste(n) unten antippen – danach steht hier „Bestätigen“")}>Bitte Liste auswählen</span>
                        ) : listenAuswahlAufgeklappt ? (
                          <button data-listen-bestaetigen
                            className="toggle-opt aktiv zeile-rechts bestaetigen-knopf"
                            onClick={toggleListenAuswahl}
                            {...tt("Auswahl bestätigen – klappt die Listen-Auswahl zu; danach steht hier der Name der Auswahl")}>
                            Bestätigen
                          </button>
                        ) : (
                          <button data-listen-kopf
                            className={`toggle-opt aktiv zeile-rechts${blitzt("listenkopf")}`}
                            onClick={toggleListenAuswahl}
                            {...tt("Gewählte Listen – antippen öffnet die Listen-Auswahl")}>
                            {chipText}
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })()}
                {/* LISTEN-AUSWAHL Inhalt */}
                <div ref={listenContainerRef} style={{overflow:'hidden', paddingTop: listenOffen ? 16 : 0}}>
                  {listenOffen && (<>
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
                            <div {...tt("Liste für das Quiz aus- oder abwählen")} key={l.id} className={`quiz-setup-check${blitzt(`liste:${l.id}`)}`} style={{padding:"10px 16px"}}
                              data-quiz-liste={l.id} onClick={() => toggleQuizTabListe(l.id)}>
                              <div className={`checkbox${gewaehlt?" checked":""}`}>{gewaehlt?"✓":""}</div>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:600, fontSize:"0.9rem"}}>{listenFlagge(l)}{l.name}</div>
                                <div style={{fontSize:"0.78rem", color:"var(--text2)", marginTop:2}}>
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


                </>)}

                {/* Alle/Bereich – sticky direkt unter Haupt-Header */}
                {kombiListe && fokusZeigt("einzel") && (
                  <div ref={alleBereichRef} style={{position:"relative", top:0, zIndex:8, background:"var(--kopfzeile)", borderBottom:"1px solid var(--rahmen)", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginLeft:"-16px", marginRight:"-16px",
                    ...(maxFenster ? { position:"fixed", top:maxFenster.top, ...maxSpalte } : {})}}>
                    {aufteilen ? (<>
                      <span style={{flex:1, fontWeight:700, fontSize:"0.85rem", color:"var(--gelb-dunkel)"}}>▦ Aufteilen</span>
                      <span data-anzahl="auswahl" style={{fontSize:"0.8rem", color:"var(--text3)"}}>({quizGefilterteVoks.length} V.)</span>
                      <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                        <button data-aufteilen-abbrechen className="btn btn-ghost btn-sm" onClick={() => setAufteilen(null)}
                          {...tt("Aufteilen beenden, ohne Sessions anzulegen")}>Abbrechen</button>
                      </span>
                    </>) : (<>
                    {/* LINKS */}
                    <span style={{flex:1, display:"flex", alignItems:"center", gap:6}}>
                      {quizBereichTyp === "bereich" && quizListeAufgeklappt ? (
                        <>
                          <button data-auswahl-durchlass className={`btn btn-sm${quizVonBisModus ? " btn-primary" : " btn-ghost"}`}
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
                        <span style={{fontWeight:600, fontSize:"0.85rem", color:"var(--text)"}}>Vokabel-Auswahl</span>
                      )}
                    </span>
                    {/* MITTE */}
                    <span data-anzahl="auswahl" style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"var(--text3)", cursor:"help"}}
                      {...tt(quizBereichTyp === "bereich" ? "Anzahl der im Bereich ausgewählten Vokabeln" : "Anzahl der Vokabeln, die zur Auswahl stehen (alle Vokabeln der Listen mit den gewählten Spalten)")}>({quizGefilterteVoks.length} V.)</span>
                    {/* RECHTS */}
                    <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                      {quizBereichTyp === "bereich" && quizListeAufgeklappt ? (
                        <button data-vok-bestaetigen className="toggle-opt aktiv zeile-rechts bestaetigen-knopf"
                          onClick={() => { if (quizCheckboxAuswahl.size === 0) setQuizBereichTyp("alle"); setQuizListeAufgeklappt(false); leuchte("vokwahl"); }}
                          {...tt("Auswahl bestätigen – schließt die Vokabelliste (nichts angehakt: wieder alle Vokabeln)")}>
                          Bestätigen
                        </button>
                      ) : (
                      <div className="toggle-btn zeile-rechts">
                        <button className={`toggle-opt${quizBereichTyp==="alle"?" aktiv" + blitzt("vokwahl"):""}`} data-vokwahl="alle"
                          onClick={() => { setQuizBereichTyp("alle"); setQuizListeAufgeklappt(false); setQuizVonBisModus(false); setQuizVonBisErster(null); }}
                          {...tt("Alle Vokabeln der gewählten Listen abfragen")}>
                          Alle
                        </button>
                        <button className={`toggle-opt${quizBereichTyp==="bereich"?" aktiv" + blitzt("vokwahl"):""}`} data-vokwahl="bereich"
                          onClick={() => {
                            if (quizBereichTyp !== "bereich") { setQuizBereichTyp("bereich"); if (quizCheckboxAuswahl.size === 0) { schliesseQuizBereiche("einzel"); setQuizListeAufgeklappt(true); } }
                            else { toggleEinzelauswahl(); }
                          }}
                          {...tt("Einzelne Vokabeln per Checkbox oder Von–Bis-Bereich auswählen – antippen öffnet die Vokabelliste")}>
                          Bereich
                        </button>
                      </div>
                      )}
                    </span>
                    </>)}
                  </div>
                )}

                {aufteilen && kombiListe && renderAufteilenKasten()}

                {/* Einzelauswahl (Bereich-Modus) */}
                {quizListeAufgeklappt && quizBereichTyp === "bereich" && kombiListe && (() => {
                  const such = suchInfo(basisVoks, sucheQuiz);
                  return (
                  <div ref={einzelauswahlRef} className="karte" data-vok-scroller={maxFenster ? "" : undefined}
                    style={maxFenster
                      ? { position:"fixed", top:maxFenster.top + alleBereichH, height:Math.max(120, maxFenster.h - alleBereichH), ...maxSpalte, zIndex:7,
                          overflowY:"auto", overscrollBehavior:"contain", WebkitOverflowScrolling:"touch", borderRadius:0, borderLeft:"none", borderRight:"none", borderTop:"none",
                          paddingBottom:"var(--tafel-platz, 0px)" }
                      : {marginBottom:8, marginTop:8, overflow:"visible"}}>
                    {basisVoks.length > 0 && renderSuchleiste("quiz", basisVoks, sucheQuiz, setSucheQuiz, maxFenster ? 0 : headerH + slotH + listenauswahlHeaderH + alleBereichH)}
                    {basisVoks.length === 0
                      ? <div style={{padding:"16px", color:"var(--text2)", fontSize:"0.85rem"}}>Keine Vokabeln verfügbar.</div>
                      : basisVoks.map((vok, idx) => {
                        if (such.filter && !such.ids.has(vok.id)) return null;   // „nur Treffer“ (Von–Bis zählt trotzdem über die ganze Liste)
                        const inChk = quizCheckboxAuswahl.has(vok.id);
                        const isVon = quizVonBisModus && vok.id === quizVonBisErster;
                        const sp1 = abfragbar[0]; const sp2 = abfragbar[1];
                        return (
                          <div {...vonBisLangDruck("quiz", vok, idx + 1, sp1 && vok[sp1]?.wert, sp2 && vok[sp2]?.wert)} key={vok.id} className="vok-zeile"
                            data-such-ziel="quiz" data-such-id={vok.id} data-auswahl-durchlass
                            style={{background: isVon ? "var(--gelb-flaeche)" : inChk ? "var(--haupt-flaeche)" : "transparent", ...suchMarke(such, vok.id)}}
                            onClick={() => {
                              zeileImBlick("quiz", vok.id);
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
                            <div className={`checkbox${isVon ? " checked" : inChk?" checked":""}`} style={{flexShrink:0, ...(isVon ? {background:"var(--gelb)", borderColor:"var(--gelb)"} : {})}}>{isVon?"→":inChk?"✓":""}</div>
                            <span className="vok-nr">{idx+1}</span>
                            <span style={{fontSize:"0.88rem", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{sp1?vok[sp1]?.wert||'':''}</span>
                            <span style={{fontSize:"0.82rem", color:"var(--text2)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"right"}}>{sp2?vok[sp2]?.wert||'':''}</span>
                          </div>
                        );
                      })
                    }
                  </div>
                  ); })()}

                {!quizVokMax && (<>
                {/* ZEILE 1: Stufe (Lernen/Leicht/Schwer) | Abfrage-Modus | Reihenfolge – je ein Bereich klappt darunter auf */}
                {kombiListe && fokusZeigt("zeile1") && (
                  <div ref={abfrageModusRef} className={`quiz-zeile${quizStufeAufgeklappt || quizAbfrageModusAufgeklappt || quizReihenfolgeAufgeklappt ? " hat-offen" : ""}`} style={{position: quizFokus === "zeile1" ? "sticky" : "relative", top: quizFokus === "zeile1" ? headerH + slotH : 0}}>
                    <div className={`quiz-zeile-zelle${quizStufeAufgeklappt ? " offen" : ""}`}><span className="quiz-zeile-label">Lern-Modus</span>
                    <button className={`quiz-zeile-knopf stufe${quizStufeAufgeklappt ? " offen bestaetigen-knopf" : ""}${leuchtet("stufe")}`} data-stufe={lernAktiv ? "lernen" : einstellungen.modus === "einfach" ? "einfach" : "schwer"}
                      onClick={() => { const auf = !quizStufeAufgeklappt; if (auf) schliesseQuizBereiche("stufe"); setQuizStufeAufgeklappt(auf); }}
                      {...tt(quizStufeAufgeklappt ? "Bestätigen – klappt die Stufe zu" : "Stufe: Lernen, Leicht oder Schwer – antippen zum Einstellen (dort auch Regeln, Lernen und Vorlesen)")}>
                      {offenText(quizStufeAufgeklappt, lernAktiv ? "Lernen" : einstellungen.modus === "einfach" ? "Leicht" : "Schwer")}
                    </button></div>
                    <div className={`quiz-zeile-zelle${quizAbfrageModusAufgeklappt ? " offen" : ""}`}><span className="quiz-zeile-label">Art der Antwort</span>
                    <button className={`quiz-zeile-knopf${quizAbfrageModusAufgeklappt ? " offen bestaetigen-knopf" : ""}${leuchtet("modus")}${!quizAbfrageModusAufgeklappt && !istDiktat && (quizModus === "rotierend" || gemischt) ? " zweizeilig" : ""}`} data-abfragemodus onClick={toggleAbfrageModus}
                      {...tt(quizAbfrageModusAufgeklappt ? "Bestätigen – klappt den Abfrage-Modus zu" : "Abfrage-Modus: Spalten, Karte/MC/Tastatur, Frage–Antwort oder wechselnd – antippen zum Einstellen")}>
                      {/* wechselnd: zweizeilig, damit die Antwort-Arten Platz haben */}
                      {quizAbfrageModusAufgeklappt ? offenText(true, !istDiktat && (quizModus === "rotierend" || gemischt) ? (quizModus === "rotierend" ? "wechselnd" : "Gemischt") : abfrageModusName)
                        : !istDiktat && (quizModus === "rotierend" || gemischt)
                        ? <><span className="zeile1">{quizModus === "rotierend" ? (gemischt ? "wechselnd · gemischt" : "wechselnd") : "Gemischt"}</span><span className="zeile2">{antwortArten.join(" – ") || "keine Spalte"}</span></>
                        : abfrageModusName}
                    </button></div>
                    <div className={`quiz-zeile-zelle${quizReihenfolgeAufgeklappt ? " offen" : ""}`}><span className="quiz-zeile-label">Reihenfolge</span>
                    <button className={`quiz-zeile-knopf umbruch${quizReihenfolgeAufgeklappt ? " offen bestaetigen-knopf" : ""}${leuchtet("reihenfolge")}`} data-reihenfolge onClick={toggleReihenfolge}
                      {...tt(quizReihenfolgeAufgeklappt ? "Bestätigen – klappt die Reihenfolge zu" : "Reihenfolge: zufällig, schlechteste zuerst oder nach Listen-Platz – antippen zum Einstellen")}>
                      {quizReihenfolgeAufgeklappt ? offenText(true, quizReihenfolge === "zufall" ? "Zufällig" : quizReihenfolge === "schlechteste" ? "Schlechteste" : "Listen-Platz")
                        : quizReihenfolge === "zufall" ? "Zufällig" : quizReihenfolge === "schlechteste" ? "Schlechteste zuerst" : "Nach Listen-Platz"}
                    </button></div>
                  </div>
                )}
                {kombiListe && quizStufeAufgeklappt && (
                  <div className="karte" data-stufe-auswahl style={{marginTop:16, marginBottom:16}}>
                    <div className="toggle-row">
                      <div className="toggle-btn" style={{display:"flex", width:"100%"}}>
                        {[["lernen", "Lernen", "Lernen: Wort, Übersetzung und Zusatzinfo nacheinander zeigen – ohne Score"],
                          ["einfach", "Leicht", "Leicht: Regeln der Stufe „Leicht“ (siehe Regeln)"], ["schwer", "Schwer", "Schwer: Regeln der Stufe „Schwer“ (siehe Regeln)"]].map(([k, label, info]) => {
                          const aktiv = k === "lernen" ? lernAktiv : !lernAktiv && (einstellungen.modus === "einfach" ? "einfach" : "schwer") === k;
                          return (
                            <button key={k} data-stufe-wahl={k} className={`toggle-opt${aktiv ? " aktiv" : ""}`} style={{flex:1}}
                              onClick={() => { if (aktiv) return; speichereEinst(k === "lernen" ? { ...einstellungen, lernen: { ...lernEinstellungen(), aktiv: true } }
                                : { ...einstellungen, modus: k, lernen: { ...lernEinstellungen(), aktiv: false } }); setQuizStufeAufgeklappt(false); }}
                              {...tt(info)}>{label}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{display:"flex", gap:6, flexWrap:"wrap", padding:"0 16px 12px"}}>
                      <button className="typ-btn" data-stufe-regeln onClick={() => setModal("stufen-regeln")} {...tt("Was in den Stufen Leicht und Schwer gilt (Punkte, Hilfen, Zuordnung …)")}>⚙ Regeln Leicht / Schwer</button>
                      {lernAktiv && <button className="typ-btn" data-stufe-lernen onClick={() => setModal("lernen-einst")} {...tt("Lernen einstellen: Reihenfolge, Pausen, Vorlesen, Quiz danach")}>🎬 Lernen einstellen</button>}
                      <button className="typ-btn" data-stufe-vorlesen onClick={() => setModal("vorlesen")} {...tt("Vorlesen einstellen")}>🔊 Vorlesen</button>
                    </div>
                  </div>
                )}
                {kombiListe && !quizFokus && mitAkzentAnzahl != null && (
                  <div className="quiz-zeile-hinweis" data-anzahl="akzent"
                    {...tt(ohneAkzentAnzahl != null ? "Vokabeln mit Akzent und dazu genommene Wörter ohne Akzent (Anzahl begrenzt, siehe Regeln)" : "Davon Vokabeln mit Akzent in der Akzente-Spalte")}>
                    ({mitAkzentAnzahl} mit Akzent{ohneAkzentAnzahl != null ? ` + ${ohneAkzentAnzahl} ohne` : ""})
                  </div>
                )}
                {kombiListe && (
                  <div ref={abfrageModusContainerRef} style={{overflow:'hidden', paddingTop: quizAbfrageModusAufgeklappt ? 16 : 0}}>
                    {quizAbfrageModusAufgeklappt && (<>
                      {/* ABFRAGE-MODUS */}
                      {quizArt === "uebersetzung" && (
                      <div className="karte" style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div className="toggle-btn">
                            <button className={`toggle-opt${quizModus==="sequenziell"?" aktiv":""}`} onClick={() => setQuizModus("sequenziell")} {...tt("Karte aufdecken und mit Richtig/Falsch selbst bewerten")}>Frage – Antwort</button>
                            <button className={`toggle-opt${quizModus==="rotierend"?" aktiv":""}`} onClick={() => setQuizModus("rotierend")} {...tt("Frage- und Antwortspalte wechseln sich zwischen Vokabeln ab")}>wechselnd</button>
                          </div>
                          <button className="btn-toggle-ghost" onClick={() => setQuizModusInfoAufgeklappt(v => !v)}
                            {...tt("Spalten und Anzeigeoptionen konfigurieren")}>
                            {quizModusInfoAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                          </button>
                        </div>
                        {quizModusInfoAufgeklappt && (
                          <div style={{padding:"0 16px 14px", fontSize:"0.82rem", color:"var(--text2)"}}>
                            {quizModus === "sequenziell"
                              ? "Feste Frage-Spalte, Antwort-Spalten der Reihe nach. Kartenmodus pro Spalte wählbar."
                              : quizModus === "rotierend"
                              ? "Frage-Spalte wechselt mit jeder Vokabel. Kartenmodus pro Spalte wählbar."
                              : "Wort wird vorgelesen – du tippst was du hörst. Falsch → ein Buchstabe mehr aufgedeckt."}
                          </div>
                        )}
                      </div>
                      )}

                      {/* DIKTAT-KONFIGURATION */}
                      {quizModus === "diktat" && (
                        <>
                          <div className="sektion-label" style={{marginBottom:8}}>Diktat-Konfiguration</div>
                          <div className="karte" style={{marginBottom:16}}>
                            <div style={{padding:"12px 16px", borderBottom:"1px solid var(--rahmen)"}}>
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
                                    style={quizDiktatUebersetzung===typ ? {background:"var(--gelb)",color:"var(--auf-gelb)",borderColor:"var(--gelb)"} : undefined}
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
                              <div key={typ} style={{padding:"10px 16px", borderBottom:"1px solid var(--rahmen)"}}>
                                <div {...tt("Spalte für die Abfrage aus- oder abwählen")} style={{display:"flex", alignItems:"center", gap:10, cursor:"pointer"}}
                                  onClick={() => toggleQuizSpalte(typ)}>
                                  <div className={`checkbox${checked?" checked":""}`}>{checked?"✓":""}</div>
                                  <div style={{flex:1}}>
                                    <div style={{fontWeight:600, fontSize:"0.9rem"}}>{kombiListe.spalten[typ].name||typ}</div>
                                    <div style={{fontSize:"0.75rem", color:"var(--text2)"}}>{typ}</div>
                                  </div>
                                </div>
                                {checked && quizModus === "sequenziell" && (
                                  <div style={{display:"flex", gap:5, marginTop:8, marginLeft:30, flexWrap:"wrap", alignItems:"center"}}>
                                    {(!hatFrage || isFrage) && (
                                      <button {...tt("Diese Spalte wird als Frage gezeigt")} className={`spalten-rolle-btn${isFrage?" frage":""}`}
                                        onClick={() => toggleSpalteRolle(typ,"frage")}>Frage</button>
                                    )}
                                    {!isFrage && !isInfo && (quizArt !== "akzente" || typ.startsWith('E')) && (
                                      <button {...tt("Diese Spalte muss beantwortet werden (mehrere Antworten möglich, in dieser Reihenfolge)")} className={`spalten-rolle-btn${isAntwort?" antwort":""}`}
                                        onClick={() => toggleSpalteRolle(typ,"antwort")}>
                                        {isAntwort ? `Antwort ${antwortNr+1}` : "Antwort"}
                                      </button>
                                    )}
                                    {!isFrage && !isAntwort && anzGesamt >= 3 && (
                                      <button {...tt("Diese Spalte nur als Hinweis zeigen, nicht abfragen")} className={`spalten-rolle-btn${isInfo?" info":""}`}
                                        onClick={() => toggleSpalteRolle(typ,"info")}>Info</button>
                                    )}
                                    {isAntwort && quizArt === "akzente" && (
                                      <span className="spalten-modus-btn aktiv" style={{marginLeft:4, cursor:"default"}}
                                        {...tt("Akzente üben: für jeden Buchstaben den richtigen Akzent wählen – eigener Akzent-Score")}>Akzente</span>
                                    )}
                                  </div>
                                )}
                                {checked && quizModus === "sequenziell" && isAntwort && quizArt !== "akzente" && (
                                  <div style={{marginTop:12, marginLeft:30}}>{renderModusKnoepfe(typ)}</div>
                                )}
                                {checked && quizModus === "rotierend" && (
                                  <div style={{marginTop:10, marginLeft:30}}>{renderModusKnoepfe(typ)}</div>
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
                                    <div style={{fontSize:"0.75rem", color:"var(--text2)"}}>{typ} — immer nur angezeigt</div>
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
                {kombiListe && (
                  <div ref={reihenfolgeContainerRef} style={{overflow:'hidden', paddingTop: quizReihenfolgeAufgeklappt ? 16 : 0}}>
                    {quizReihenfolgeAufgeklappt && (
                      <div className="karte" style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div className="toggle-btn">
                            <button className={`toggle-opt${quizReihenfolge==="zufall"?" aktiv":""}`} data-reihenfolge-wahl="zufall" onClick={() => { if (quizReihenfolge === "zufall") return; setQuizReihenfolge("zufall"); setQuizReihenfolgeAufgeklappt(false); }} {...tt("Vokabeln zufällig mischen")}>Zufällig</button>
                            <button className={`toggle-opt${quizReihenfolge==="schlechteste"?" aktiv":""}`} data-reihenfolge-wahl="schlechteste" onClick={() => { if (quizReihenfolge === "schlechteste") return; setQuizReihenfolge("schlechteste"); setQuizReihenfolgeAufgeklappt(false); }} {...tt("Vokabeln mit niedrigstem Score zuerst abfragen")}>Schlechteste</button>
                            <button className={`toggle-opt${quizReihenfolge==="listennr"?" aktiv":""}`} data-reihenfolge-wahl="listennr" onClick={() => { if (quizReihenfolge === "listennr") return; setQuizReihenfolge("listennr"); setQuizReihenfolgeAufgeklappt(false); }} {...tt("Vokabeln in der Reihenfolge der Liste abfragen")}>Listen-Nr.</button>
                          </div>
                        </div>
                        {quizReihenfolge === "schlechteste" && (
                          <div style={{padding:"0 16px 16px"}}>
                            {sliderActive ? (
                              <>
                                <div style={{fontSize:"0.78rem", color:"var(--text2)", marginBottom:8, textAlign:"center"}}>
                                  {`Nur Vokabeln mit Score ≤ ${sliderVal} (${verfuegbarReihenfolge} V.)`}
                                </div>
                                <div style={{position:"relative", paddingTop:28}}>
                                  <div style={{
                                    position:"absolute", top:0,
                                    left:`calc(${sliderPct} * (100% - 28px) + 14px)`,
                                    transform:"translateX(-50%)",
                                    background:"var(--haupt)", color:"var(--auf-haupt)",
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
                                <div style={{fontSize:"0.78rem", color:"var(--text2)", marginBottom:8, textAlign:"center"}}>
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
                        <div className="toggle-row" style={{cursor:"pointer", padding:"12px 16px", borderTop:"1px solid var(--rahmen)"}}
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

                {/* ZEILE 2: Umfang | Abfrage-Ziel | Gelernte */}
                {kombiListe && fokusZeigt("zeile2") && (
                  <div ref={sessionRef} className={`quiz-zeile${quizSessionAufgeklappt === "umfang" || quizSessionAufgeklappt === "ziel" ? " hat-offen" : ""}`} style={{position: quizFokus === "zeile2" ? "sticky" : "relative", top: quizFokus === "zeile2" ? headerH + slotH : 0, zIndex:6}}>
                    <div className={`quiz-zeile-zelle${quizSessionAufgeklappt === "umfang" ? " offen" : ""}`}><span className="quiz-zeile-label">Anzahl je Runde</span>
                    <button className={`quiz-zeile-knopf${quizSessionAufgeklappt === "umfang" ? " offen bestaetigen-knopf" : ""}${leuchtet("umfang")}`} data-umfang
                      onClick={() => toggleSessionBereich("umfang")}
                      {...tt(quizSessionAufgeklappt === "umfang" ? "Bestätigen – klappt den Umfang zu" : "Umfang: alle Vokabeln auf einmal oder in Paketen – antippen zum Einstellen")}>
                      {quizSessionAufgeklappt === "umfang" ? offenText(true, isPakete && quizPaketGroesse != null && quizPaketGroesse < PAKET_ALLE ? `Je ${quizPaketGroesse}` : "Alle")
                        : isPakete && quizPaketGroesse != null && quizPaketGroesse < PAKET_ALLE ? `Je ${quizPaketGroesse} Vokabeln` : "Alle Vokabeln"}
                    </button></div>
                    <div className={`quiz-zeile-zelle${quizSessionAufgeklappt === "ziel" ? " offen" : ""}`}><span className="quiz-zeile-label">Wie oft</span>
                    <button className={`quiz-zeile-knopf${quizSessionAufgeklappt === "ziel" ? " offen bestaetigen-knopf" : ""}${leuchtet("ziel")}`} data-abfrageziel
                      onClick={() => toggleSessionBereich("ziel")}
                      {...tt(quizSessionAufgeklappt === "ziel" ? "Bestätigen – klappt das Abfrage-Ziel zu" : "Abfrage-Ziel: wie oft bzw. bis wann jede Vokabel abgefragt wird – antippen zum Einstellen")}>
                      {offenText(quizSessionAufgeklappt === "ziel", abfrageZielModus === "blitz" ? "⚡ Blitz 60 s" : abfrageZielModus === "serie" ? "🔥 Serie" : abfrageZielModus === "wiederholung" ? `${abfrageZielWiederholung}× richtig`
                        : abfrageZielModus === "score" ? (abfrageZielScoreTyp === "session" ? `Session ${abfrageZielScore > 0 ? "+" : ""}${abfrageZielScore}` : `Score < ${abfrageZielScore > 0 ? "+" : ""}${abfrageZielScore}`) : `${abfrageZielAnzahl}×`)}
                    </button></div>
                    {schwelle > 0 && gelernteAnzahl > 0 && (
                      <div className="quiz-zeile-zelle schmal"><span className="quiz-zeile-label">Gelernte</span>
                      <button className={`quiz-zeile-knopf${quizGelerntEinschliessen ? " an" : ""}`} data-gelernte={quizGelerntEinschliessen ? "an" : "aus"}
                        onClick={() => { schliesseQuizBereiche(null); setQuizGelerntEinschliessen(v => !v); }}
                        {...tt(quizGelerntEinschliessen ? `${gelernteAnzahl} gelernte Vokabeln werden mit abgefragt – antippen zum Ausblenden` : `${gelernteAnzahl} gelernte Vokabeln sind ausgeblendet – antippen zum Einschließen`)}>
                        {quizGelerntEinschliessen ? `+ ${gelernteAnzahl} gelernte` : `${gelernteAnzahl} gelernte`}
                      </button></div>
                    )}
                  </div>
                )}
                {quizSessionAufgeklappt && kombiListe && (
                  <div ref={sessionContainerRef} className="karte" style={{marginBottom:8, marginTop:8}}>
                    {quizSessionAufgeklappt === "umfang" ? (
                      <div className="umfang-raster" data-umfang-auswahl>
                        <button className={`typ-btn${!isPakete || quizPaketGroesse >= PAKET_ALLE ? " aktiv" : ""}`} data-umfang-wahl="alle"
                          onClick={() => { setQuizSessionModus("pakete"); setQuizPaketGroesse(PAKET_ALLE); setQuizSessionAufgeklappt(false); }}
                          {...tt("Alle Vokabeln der Session in einem Paket – der Fortschritt bleibt gespeichert")}>Alle</button>
                        {[5,10,15,20,25,30,40,50].map(n => (
                          <button key={n} className={`typ-btn${isPakete && quizPaketGroesse === n ? " aktiv" : ""}`} data-umfang-wahl={n}
                            onClick={() => { setQuizSessionModus("pakete"); setQuizPaketGroesse(n); setQuizSessionAufgeklappt(false); }}
                            {...tt(`Je ${n} Vokabeln pro Paket – der Fortschritt bleibt zwischen den Paketen erhalten`)}>{n}</button>
                        ))}
                      </div>
                    ) : (<>
                    <div style={{padding:"12px 16px 8px", fontWeight:600, fontSize:"0.82rem", color:"var(--text2)"}}>Abfrage-Ziel</div>
                    <div style={{display:"flex", gap:6, flexWrap:"wrap", padding:"0 16px 8px"}}>
                      {[["anzahl","Anzahl","Jede Vokabel 1–3× pro Runde abfragen"],["wiederholung","Mit Wiederholung","Vokabeln wiederholen bis jede N-mal in Folge richtig beantwortet wurde"],["score","Score","Vokabeln wiederholen bis ihr Score das Ziel erreicht"],
                        ["blitz","⚡ Blitzrunde","Möglichst viele richtig in 60 Sekunden – die Vokabeln kommen immer wieder, mit Rekord"],
                        ["serie","🔥 Serie","So viele wie möglich am Stück richtig – der erste Fehler beendet die Serie, mit Rekord"]].map(([m, label, tip]) => (
                        <button key={m} className={`typ-btn${abfrageZielModus===m?" aktiv":""}`}
                          onClick={() => setAbfrageZielModus(m)} {...tt(tip)}>{label}</button>
                      ))}
                    </div>
                    {abfrageZielModus === "anzahl" && (
                      <div style={{display:"flex", gap:6, padding:"0 16px 12px", alignItems:"center"}}>
                        <span style={{fontSize:"0.78rem", color:"var(--text3)", marginRight:4}}>Jede Vokabel</span>
                        {[1,2,3].map(n => (
                          <button key={n} className={`typ-btn${abfrageZielAnzahl===n?" aktiv":""}`}
                            onClick={() => setAbfrageZielAnzahl(n)} {...tt(`Jede Vokabel ${n}× pro Runde abfragen`)}>{n}×</button>
                        ))}
                        <span style={{fontSize:"0.78rem", color:"var(--text3)", marginLeft:4}}>abfragen</span>
                      </div>
                    )}
                    {abfrageZielModus === "wiederholung" && (
                      <div style={{display:"flex", gap:6, padding:"0 16px 12px", alignItems:"center"}}>
                        <span style={{fontSize:"0.78rem", color:"var(--text3)", marginRight:4}}>Bis</span>
                        {[1,2,3].map(n => (
                          <button key={n} className={`typ-btn${abfrageZielWiederholung===n?" aktiv":""}`}
                            onClick={() => setAbfrageZielWiederholung(n)} {...tt(`Jede Vokabel ${n}× in Folge richtig beantworten`)}>{n}×</button>
                        ))}
                        <span style={{fontSize:"0.78rem", color:"var(--text3)", marginLeft:4}}>richtig</span>
                      </div>
                    )}
                    {abfrageZielModus === "score" && (() => {
                      const zielSliderPct = (abfrageZielScore + 10) / 20;
                      return (
                        <div style={{padding:"0 16px 12px"}}>
                          <div style={{display:"flex", gap:6, marginBottom:10}}>
                            {[["global","Globaler Score","Nur Vokabeln mit Score unter dem Ziel abfragen, ein Durchgang (Ziel 0: nur negative)"],["session","Session-Score","Vokabeln abfragen bis der Fortschritt dieser Session das Ziel erreicht"]].map(([t, label, tip]) => (
                              <button key={t} className={`typ-btn${abfrageZielScoreTyp===t?" aktiv":""}`}
                                onClick={() => setAbfrageZielScoreTyp(t)} {...tt(tip)}>{label}</button>
                            ))}
                          </div>
                          <div style={{fontSize:"0.75rem", color:"var(--text3)", marginBottom:6}}>
                            {abfrageZielScoreTyp === "session" ? "Session-Score-Ziel" : "Globaler Score-Ziel"}
                          </div>
                          <div style={{position:"relative", paddingTop:28}}>
                            <div style={{
                              position:"absolute", top:0,
                              left:`calc(${zielSliderPct} * (100% - 28px) + 14px)`,
                              transform:"translateX(-50%)",
                              background:"var(--haupt)", color:"var(--auf-haupt)",
                              borderRadius:6, padding:"3px 9px",
                              fontSize:"0.82rem", fontWeight:600, pointerEvents:"none",
                            }}>{abfrageZielScore > 0 ? "+" : ""}{abfrageZielScore}</div>
                            {/* Nullpunkt-Markierung */}
                            <div style={{
                              position:"absolute", top:32,
                              left:`calc(0.5 * (100% - 28px) + 14px)`,
                              transform:"translateX(-50%)",
                              width:2, height:8, background:"var(--text4)", borderRadius:1, pointerEvents:"none",
                            }}/>
                            <input {...ttFeld("Ziel-Score: Vokabeln werden wiederholt, bis sie ihn erreichen")} type="range" min={-10} max={10} step={1}
                              value={abfrageZielScore}
                              onChange={e => setAbfrageZielScore(Number(e.target.value))}
                              className="score-slider" style={{width:"100%", display:"block"}}/>
                          </div>
                        </div>
                      );
                    })()}
                    </>)}
                  </div>
                )}

                {/* START-BEREICH: Session-Fortschritt + großer Start-Knopf */}
                {kombiListe && !quizFokus && (
                  <div className="start-bereich">
                    {(() => {
                      // Abfrageart wählen: gewählte Art groß (mit Name und Lernfortschritt), die anderen kleiner
                      const ls = lernstandJeArt(quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0 ? kombiListe.vokabeln.filter(v => quizCheckboxAuswahl.has(v.id)) : kombiListe.vokabeln);
                      return (
                        <><div data-start-fortschritt style={{fontWeight:600, fontSize:"0.85rem", color:"var(--text)", marginBottom:4}}>Fortschritt</div>
                        <div className="start-arten" data-start-arten>
                          {QUIZ_ARTEN.filter(a => !ls[a].aus).map(a => {
                            const akt = a === quizArt, pct = Math.round(ls[a].pct);
                            return (
                              <button key={a} className={`start-art${akt ? " aktiv" : ""}`} data-quiz-art={a} data-pct={pct} onClick={() => { if (!akt) wechsleQuizArt(a); }}
                                {...tt(akt ? `${ABFRAGE_ART_NAMEN[a]}: ${pct} % gelernt` : `${ABFRAGE_ART_NAMEN[a]} (${pct} % gelernt) – antippen: zu ${ABFRAGE_ART_NAMEN[a]} wechseln`)}>
                                <MiniKreis pct={ls[a].pct} buchstabe={ART_KURZ[a]} aktiv={akt} groesse={akt ? 95 : 57}/>
                                {akt && <span className="start-art-name" data-start-art-name>{ABFRAGE_ART_NAMEN[a]} · {pct} %</span>}
                              </button>
                            );
                          })}
                        </div></>
                      );
                    })()}
                    <div className="start-titel" data-start-titel>{lernAktiv ? "Lernen" : "Quiz"} mit {sessionAnzahl} Vokabel{sessionAnzahl !== 1 ? "n" : ""}</div>
                    {isPakete && (
                      <div style={{height:6, background:"var(--rahmen)", borderRadius:3, marginBottom:10}} data-start-balken={sessionPct}>
                        <div style={{width:`${sessionPct}%`, height:"100%", background:"var(--haupt)", borderRadius:3, transition:"width 0.3s"}}/>
                      </div>
                    )}
                    {lernStand && lernResetFrage ? (
                      <div data-lern-reset-frage style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", minHeight:31, fontSize:"0.82rem", marginBottom:10}}>
                        <span style={{color:"var(--text)", fontWeight:600}}>Lernstand löschen?</span>
                        <button data-lern-reset-ja className="toggle-opt aktiv" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8}}
                          onClick={() => { setLernResetFrage(false); setzeLernStand(aktiverSlot, quizAbfrageArt, null); }}
                          {...tt("Ja: das Lernen beginnt beim nächsten Start von vorn. Scores und Abfrage-Fortschritt bleiben.")}>
                          Ja, von vorn
                        </button>
                        <button className="toggle-opt" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8, border:"1.5px solid var(--rahmen)"}}
                          onClick={() => setLernResetFrage(false)} {...tt("Nein: nichts ändern")}>Nein</button>
                      </div>
                    ) : null}
                    {sessionResetFrage && sessionHatFortschritt ? (
                      <div data-reset-frage style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", minHeight:31, fontSize:"0.82rem", marginBottom:10}}>
                        <span style={{color:"var(--text)", fontWeight:600}}>Abgefragt-Stand löschen?</span>
                        <button data-reset-ja className="toggle-opt aktiv" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8}}
                          onClick={() => { setSessionResetFrage(false); loescheSessionSlot(); }}
                          {...tt("Ja: die Session beginnt von vorn – alle Vokabeln kommen wieder in die Pakete. Scores und Lernfortschritt bleiben erhalten.")}>
                          Ja, neu beginnen
                        </button>
                        <button className="toggle-opt" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8, border:"1.5px solid var(--rahmen)"}}
                          onClick={() => setSessionResetFrage(false)}
                          {...tt("Nein: nichts ändern")}>
                          Nein
                        </button>
                        <span style={{color:"var(--text3)", fontSize:"0.7rem"}}>(Scores bleiben)</span>
                      </div>
                    ) : null}
                    <div style={{display:"flex", gap:10, alignItems:"stretch"}}>
                      {lernStand && !aufteilen && (
                        <button data-lernstand className="start-fortschritt" onClick={() => setLernResetFrage(f => !f)}
                          {...tt("Lernstand: so viele Vokabeln schon angesehen – antippen, um das Lernen von vorn zu beginnen (Scores bleiben)")}>
                          <span data-anzahl="lernstand">{lernAngesehen}/{lernGesamt}</span>
                        </button>
                      )}
                      {isPakete && !(lernStand && !aufteilen) && (
                        <button data-session-zuruecksetzen={sessionHatFortschritt ? "" : undefined} className="start-fortschritt" disabled={!sessionHatFortschritt}
                          onClick={() => setSessionResetFrage(true)}
                          {...tt(sessionHatFortschritt ? "So viele Vokabeln dieser Session wurden schon abgefragt – antippen, um den Abgefragt-Stand zurückzusetzen (Scores und Lernfortschritt bleiben)" : "Fortschritt der Session – noch nichts abgefragt")}>
                          {sessionHatFortschritt ? <span data-anzahl="fortschritt">{sessionAbgefragtAnzahl}/{sessionAnzahl}</span> : <span>0/{sessionAnzahl}</span>}
                        </button>
                      )}
                      {lernAktiv && !aufteilen ? (
                        <button className="btn btn-primary start-knopf" data-start-knopf data-lernen-start={lernStand ? "weiter" : "neu"} data-start-anzahl={lernAnzahl}
                          onClick={() => starteLernen(lernVokabeln(), isPakete ? quizPaketGroesse : null, lernSpalten, lernInfo, lernStand)} disabled={!kannStarten || (lernAnzahl === 0 && !lernStand)}
                          {...tt(lernStand ? `Weiter lernen an der Stelle, an der du aufgehört hast (${lernAngesehen} von ${lernGesamt} angesehen)` : "Lernen starten: Wort zeigen, nach einer Pause die Übersetzung – ohne Score, der Session-Fortschritt bleibt", sessionSpeicherAktionen())}>
                          {lernStand ? <><b>Weiter lernen</b><span>{lernAngesehen} von {lernGesamt} angesehen</span></>
                            : <><b>Lernen starten</b><span>{lernAnzahl} Vokabel{lernAnzahl !== 1 ? "n" : ""}</span></>}
                        </button>
                      ) : aufteilen ? (() => {
                        const neu = (aufteilenStand()?.gruppen || []).filter(g => !g.vorhanden).length;
                        return (
                          <button data-aufteilen-anlegen className="btn btn-primary" style={{flex:1, background:"var(--gelb-dunkel)", borderColor:"var(--gelb-dunkel)"}}
                            disabled={!kannStarten || neu === 0} onClick={legeAufteilenAn}
                            {...tt("Je Gruppe eine gespeicherte Konfiguration mit diesen Einstellungen anlegen")}>
                            ▦ {neu} Session{neu !== 1 ? "s" : ""} anlegen
                          </button>
                        );
                      })() : alleAbgefragt ? (
                        <button className="btn btn-primary start-knopf" data-start-knopf data-start-anzahl={sessionAnzahl}
                          onClick={() => { loescheSessionSlot(); }}
                          {...tt("Session-Fortschritt löschen und alle Vokabeln erneut abfragen", sessionSpeicherAktionen())}>
                          <b>Neuer Durchlauf</b><span>alle {sessionAnzahl} abgefragt</span>
                        </button>
                      ) : (
                        <button className="btn btn-primary start-knopf" data-start-knopf data-start-anzahl={verfuegbar} data-start-rest={startRest}
                          onClick={() => starteQuiz()} disabled={!kannStarten || verfuegbar === 0}
                          {...tt(isPakete ? `${START_TEXT[quizArt] || "Quiz starten"} – in dieser Session sind noch ${startRest} Vokabeln übrig; abgefragt wird ${quizPaketGroesse >= PAKET_ALLE ? "alles in einem Paket" : `in Paketen zu ${quizPaketGroesse}`}; lang drücken: speichern` : `${START_TEXT[quizArt] || "Quiz starten"} – die Zahl nennt die Vokabeln dieser Fragerunde; lang drücken: speichern`, sessionSpeicherAktionen())}>
                          <b>{START_TEXT[quizArt] || "Quiz starten"}</b><span>{startRest} Vokabel{startRest !== 1 ? "n" : ""}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                </>)}

                </>)}
              </div>
            </>
          );
        })()}

        {/* ── Listen-Übersicht: Raster (Größe unter Einstellungen → Listen) ── */}
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
          const listenSuche = suchInfo(anzeigeVoks, sucheListe);
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
              </div>

              {(() => {
                const saetze = listenSaetze.listeId === aktiveListeId ? listenSaetze.saetze : {};
                const mit = aktiveListe.vokabeln.filter(v => (saetze[`${aktiveListeId}__${v.id}`] || []).length > 0);
                const fremd = TYPEN.find(t => t.startsWith("E") && aktiveListe.spalten[t]?.aktiv);
                return (<>
                  <div className="sektion-label" style={{marginBottom:10}}>Beispielsätze</div>
                  <div className="karte" data-liste-saetze style={{padding:"12px 16px"}}>
                    <div style={{display:"flex", alignItems:"center", gap:8}}>
                      <span style={{flex:1, fontSize:"0.88rem"}} data-liste-saetze-anzahl>💬 {mit.length} von {aktiveListe.vokabeln.length} Vokabeln</span>
                      <button className="btn btn-ghost btn-sm" data-saetze-ergaenzen onClick={() => oeffneSatzFenster(aktiveListeId)} {...tt("Beispielsätze per KI ergänzen (Prompt kopieren, Antwort einfügen)")}>✨ Ergänzen</button>
                    </div>
                    {mit.length > 0 && (
                      <details style={{marginTop:8}}>
                        <summary style={{cursor:"pointer", fontSize:"0.85rem", color:"var(--text2)"}}>Sätze ansehen</summary>
                        {mit.slice(0, 60).map(v => (
                          <div key={v.id} style={{marginTop:8}} data-satz-vok={v.id}>
                            <div style={{fontWeight:700, fontSize:"0.88rem"}}>{ohneHinweis(v[fremd]?.wert || "")}</div>
                            {(saetze[`${aktiveListeId}__${v.id}`] || []).map((x, i) => (
                              <div key={i} style={{fontSize:"0.82rem", margin:"2px 0 0 8px"}}>
                                {x.s.split(/\*([^*]+)\*/).map((t, k) => k % 2 ? <b key={k}>{t}</b> : t)} <span style={{color:"var(--text3)"}}>– {x.u}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </details>
                    )}
                  </div>
                </>);
              })()}

              <div className="sektion-label" style={{marginBottom:10}}>Spalten</div>
              <div className="karte">
                {TYPEN.map(typ => {
                  const s = aktiveListe.spalten[typ];
                  return (
                    <div key={typ} className="karte-zeile">
                      <span className={`spalten-badge${s.aktiv ? " aktiv" : ""}`}>{typ}</span>
                      <div className="karte-zeile-info">
                        <div className="karte-zeile-name" style={{color: s.aktiv ? "var(--text-stark)" : "var(--text2)"}}>
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
                    <button className="btn btn-ghost btn-sm" style={{background:"var(--karte)"}}
                      onClick={() => { setMergeQuelleId(''); setModal('liste-zusammenfuehren'); }}
                      {...tt("Vokabeln aus einer anderen Liste in diese Liste einfügen")}>
                      Zusammenführen
                    </button>
                  )}
                  {vokabelAufgeklappt && schwelleL > 0 && gelernteInListe > 0 && (
                    <button className={`btn btn-ghost btn-sm${listenGelerntAusblenden?" aktiv":""}`}
                      style={{background:"var(--karte)", fontSize:"0.75rem"}}
                      onClick={() => setListenGelerntAusblenden(v => !v)}
                      {...tt(listenGelerntAusblenden ? "Gelernte Vokabeln wieder einblenden" : "Gelernte Vokabeln ausblenden")}>
                      {listenGelerntAusblenden ? `${gelernteInListe} ausgeblendet` : "Gelernte ausblenden"}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{padding:"6px 10px", background:"var(--karte)"}} onClick={() => {
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
                      <span style={{fontSize:"0.75rem", color:"var(--text2)"}}>Anzeigen:</span>
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
                  <div className="karte" style={{overflow:"visible"}}>
                    {renderSuchleiste("liste", anzeigeVoks, sucheListe, setSucheListe, headerH + listeDetailKopfH)}
                    {anzeigeVoks.map(vok => {
                      if (listenSuche.filter && !listenSuche.ids.has(vok.id)) return null;   // „nur Treffer“
                      const score = vok.fortschritt != null ? clampScore(vok.fortschritt.score) : null;
                      const istGelernt = schwelleL > 0 && (vok.fortschritt?.score ?? -Infinity) >= schwelleL;
                      return (
                        <div key={vok.id} className="karte-zeile" data-such-ziel="liste" data-such-id={vok.id} style={{flexDirection:"column", alignItems:"flex-start", gap:4, ...suchMarke(listenSuche, vok.id)}}>
                          <div style={{display:"flex", width:"100%", justifyContent:"space-between", alignItems:"flex-start"}}>
                            <div style={{display:"flex", flexDirection:"column", gap:3, flex:1}}>
                              {anzeigeSpalten.map(typ => vok[typ] ? (
                                <div key={typ} style={{display:"flex", alignItems:"baseline", gap:6}}>
                                  <span className="spalten-badge aktiv">{aktiveListe.spalten[typ].name || typ}</span>
                                  <span style={{fontSize:"0.88rem"}}>{vok[typ].wert}</span>
                                  {vok[typ].falsch?.length > 0 && <span style={{fontSize:"0.75rem", color:"var(--text2)"}}>(+{vok[typ].falsch.length})</span>}
                                </div>
                              ) : null)}
                            </div>
                            <div style={{display:"flex", alignItems:"center", gap:2, flexShrink:0, marginLeft:8}}>
                              {istGelernt && (
                                <span style={{background:"var(--haupt-flaeche)", color:"var(--haupt)", borderRadius:4,
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
                                    window.speechSynthesis.speak(aeusserung(vok[typ].wert.split('/')[0].trim(), spalteLang(typ, listeSprache(aktiveListe))));
                                  });
                                }}><IcoSpk s={16}/></button>
                              )}
                              <button {...tt("Vokabel bearbeiten")} className="btn-icon" title="Bearbeiten" onClick={() => oeffneVokabelBearbeiten(vok)}><IcoPencil s={14}/></button>
                              <button {...tt("Vokabel löschen")} className="btn-icon" title="Löschen" style={{color:"var(--falsch)"}}
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
          return (
            <>
              {renderSlotKopf(true)}
              <div ref={slotContainerRef} style={{overflow:'hidden', paddingTop: slotSektionAufgeklappt ? 12 : 0, paddingBottom: slotSektionAufgeklappt ? 4 : 0}}>
                {slotSektionAufgeklappt && (<>
                  {renderSlotBereiche(
                    <button className="slot-chip belegt"
                      style={!statistikAktiverSlot && !statistikSlotGeleert
                        ? {background:"var(--haupt-flaeche)", borderColor:"var(--haupt)", color:"var(--haupt)"}
                        : {color:"var(--text3)"}}
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

        {/* ── Statistik: Listen-Auswahl Header (ausgeblendet bei geladener gespeicherter Konfiguration) ── */}
        {tab === "statistik" && (() => {
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
                <div className={`listen-raster auswahl${listenRasterPlaetze().spalten > 1 ? " eng" : ""}`} style={{marginBottom:0, gridTemplateColumns:`repeat(${listenRasterPlaetze().spalten}, minmax(0, 1fr))`}}>
                  {sichtbareListen.length === 0
                    ? <div className="karte-zeile" style={{color:"var(--text2)", fontSize:"0.85rem"}}>Keine Listen vorhanden.</div>
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
        })()}

        {/* ── Statistik: Vokabel-Auswahl Header ── */}
        {tab === "statistik" && (() => {
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
                        <div className={`checkbox${isVon ? " checked" : gewaehlt ? " checked" : ""}`} style={{flexShrink:0, ...(isVon ? {background:"var(--gelb)", borderColor:"var(--gelb)"} : {})}}>{isVon ? "→" : gewaehlt ? "✓" : ""}</div>
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
        })()}

        {/* ── Statistik: Inhalte ── */}
        {tab === "statistik" && (() => {
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
          else if (sKey === "streak") voks.sort((a, b) => { const d = (a.fortschritt?.streak ?? 0) - (b.fortschritt?.streak ?? 0); return sDir === "asc" ? d : -d; });
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
                  <div data-statistik-kopf-balken style={{display:"flex", width:"min(180px, 100%)", height:6, borderRadius:3, overflow:"hidden", background:"var(--fortschritt-balken)", margin:"3px 0 2px"}}
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
              <button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={() => window.scrollTo({top:0, behavior:"smooth"})} {...tt("Zum Seitenanfang scrollen")}>nach oben</button>
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
                          <text data-keine-akzente x={cx} y={cy - 58} textAnchor="middle" fontSize="15" fontWeight="600" fill={fv("var(--text)")}>Für diese Session sind keine Akzente vorhanden.</text>
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
                  <div className="karte-zeile" style={{color:"var(--text2)", fontSize:"0.85rem"}}>Keine Vokabeln in diesem Filter.</div>
                ) : voks.map((vok, idx) => {
                  const rawScore = vok.fortschritt?.score ?? null;
                  const score = rawScore !== null ? Math.min(10, Math.max(-10, rawScore)) : null;
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
        })()}
        {tab === "einstellungen" && (<>
          {einstBereich === "info" && (<>
          {/* Info sticky Header */}
          <div ref={infoHeaderRef} style={{position:"sticky", top:headerH, zIndex:9, background:"var(--kopfzeile)", borderBottom:"1px solid var(--rahmen)", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <button className="einst-titel-knopf" data-einst-kopf="info" data-offen="ja" onClick={() => schalteEinstBereich("app")} {...tt("Info schließen – zurück zu App")}>‹ Info</button>
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
              <div style={{background:"var(--info-kasten)", borderRadius:12, padding:"14px 16px", fontSize:"0.85rem", lineHeight:1.65, color:"var(--text)"}}>
                <div style={{fontWeight:700, marginBottom:6, fontSize:"0.95rem"}}>Vokabel-Trainer</div>
                <p style={{margin:0}}>
                  Lerne Vokabeln aus eigenen Listen – flexibel, ohne Anmeldung, direkt im Browser.
                  Alle Daten bleiben auf diesem Gerät.
                </p>
                <div style={{marginTop:10, display:"flex", flexDirection:"column", gap:4}}>
                                    <div><span style={{fontWeight:600}}>Quiz</span> – Abfragen mit Karte, Tippen oder Diktat</div>
                  <div><span style={{fontWeight:600}}>Statistik</span> – Lernfortschritt auf einen Blick</div>
                  <div><span style={{fontWeight:600}}>Einstellungen</span> – Listen verwalten, importieren und sichern; Lernen, Raster, Farben, Info</div>
                </div>
              </div>
            </div>
          )}

          {/* Aufklappbarer Kontext: Konzept / Anleitung */}
          {infoModus !== "uebersicht" && (
            <div ref={infoKontextContainerRef}>
              {infoModus === "konzept" ? (
                <div className="sektion" style={{fontSize:"0.85rem", lineHeight:1.75, color:"var(--text)"}}>
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
                  <div style={{background:"var(--info-kasten)", borderRadius:10, padding:"12px 14px", whiteSpace:"pre-line"}}>
                    {abschnitt.text}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sektion" style={{fontSize:"0.85rem", lineHeight:1.7, color:"var(--text)"}}>
              <div style={{background:"var(--haupt-flaeche)", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:"0.8rem", color:"var(--haupt)", lineHeight:1.55}}>
                💡 <strong>Tipp:</strong> Tippe oben links auf ⓘ: Im Info-Modus sind erklärbare Elemente gestrichelt markiert – antippen zeigt die Erklärung, statt die Aktion auszuführen. Alternativ einen Knopf gedrückt halten. Die Erklärung bleibt stehen, bis du irgendwo hintippst. Am PC erscheint sie auch beim Darüberfahren.
              </div>
              {[
                {titel:"Listen (Einstellungen › Listen)", inhalt:[
                  {k:"Übersicht", v:"Einstellungen › Listen zeigt alle Vokabellisten in einem Raster (Spalten unter Einstellungen → Raster, bis 4; Zeilen wachsen von selbst, beim Verschieben stehen unten immer zwei freie Zeilen bereit). Tippe eine Liste an, um sie bildschirmfüllend zu öffnen; der Pfeil oben links führt zurück. „+ Neu“ öffnet den Import. Lang drücken zeigt den vollen Namen und darunter „Umbenennen“, „Duplizieren“ (Kopie mit allen Vokabeln, Lernstände beginnen neu), „Verschieben“, „☑ Auswählen“, „In Sessions aufteilen“, „Lernstand zurücksetzen“ (Scores für Übersetzung, Diktat und/oder Akzente löschen, mit Rückfrage) und „Löschen“. „In Sessions aufteilen“ öffnet den Quiz-Tab mit dieser Liste und einem gelben Kasten: Name (vorgegeben: Listenname), Gruppengröße (10, 20, 25, 50, 75, 100 oder eigene), Bereich von–bis (Vokabel-Nummern) und bei Rest „eigene Gruppe“ oder „an letzte anhängen“; die Vorschau zeigt die Namen, z. B. „Verbes (21 - 40)“. Darunter alle Einstellungen wie gewohnt wählen, dann „Sessions anlegen“: je Gruppe eine gespeicherte Konfiguration, untereinander in der ersten Spalte unter dem untersten Eintrag. Namen, die es schon gibt, werden übersprungen. Lang drücken und ziehen verschiebt die Liste direkt; auf einem belegten Platz tauschen die beiden. Im Verschieben-Modus lassen sich mehrere Listen markieren und gemeinsam verschieben. „☑ Auswählen“ startet den Auswahl-Modus: weitere Listen antippen (nummeriert, nochmal antippen nimmt heraus, „Alle“ wählt alle sichtbaren, „Fertig“ beendet); lang drücken zeigt dann die Aktionen für die ganze Auswahl – „JSON exportieren“, „TXT exportieren“ (Dateiname änderbar), „📋 Kopieren“, „⇄ Verschieben“, „🗑 Löschen“ (Rückfrage mit allen Namen, „Vorher sichern“) und „Auswahl beenden“. Lang drücken auf eine nicht gewählte Liste nimmt sie dazu. Neue Listen (auch per Import) kommen untereinander in die erste Spalte. Die Reihenfolge gilt auch in Quiz- und Statistik-Tab. Mit Sprachfilter rücken die sichtbaren Listen zusammen – verschoben wird unter „Alle“."},
                  {k:"[+] Neue Liste", v:"Legt eine leere Liste mit eigenem Namen an."},
                  {k:"💾 Alles sichern", v:"Einstellungen → Listen → Sicherung: eine Datei (Vorschlag „Vokabel-App Sicherung Datum.txt“, Name änderbar) mit allem – Listen mit Scores, Einstellungen, Farben, gespeicherte Quiz. Der Browser kann gespeicherte Daten löschen (Speicher aufräumen, Browserdaten löschen); mit der Datei holst du alles zurück: „Laden“ in den Einstellungen oder als Datei im Import („Alles wiederherstellen“). Oben in der Session-Auswahl (Quiz-Tab) erinnert die App, wenn die letzte Sicherung älter ist als eingestellt (Standard 7 Tage)."},
                  {k:"▲/▼ Aktionszeile", v:"Öffnet Aktionen zur Liste: Kopieren, JSON, TXT, Löschen. JSON = vollständige Sicherung mit Lernstand (Vorschlag „Name - JSON.txt“), TXT = nur die Vokabeln als Text ohne Scores (Vorschlag „Name - TXT.txt“); den Dateinamen kannst du vor dem Speichern ändern. Auf iPad/iPhone öffnet sich dafür das Teilen-Menü („In Dateien sichern“, Mail, AirDrop), sonst wird die Datei heruntergeladen. Beim Import ist die Endung egal – die App erkennt den Inhalt."},
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
                  {k:"Kopfzeile (Session-Auswahl)", v:"Oben im Tab steht der Name der geladenen Session („Neu“, wenn keine geladen ist). Die App startet in der Auswahl: gespeicherte Sessions und Verlauf – die Einstellungen darunter sind dann ausgeblendet. Antippen des Namens schaltet um zwischen Auswahl und Einstellungen (kein Aufklappen); eine Session antippen lädt sie und zeigt ihre Einstellungen. In der Auswahl stehen rechts die Kreise Ü, D und A und darunter eine Info-Zeile (z. B. „Englisch 6 · Nr. 1–25 · 25 Vokabeln“); eine gespeicherte Konfiguration erscheint dann in einer grünen Kopfzeile. Lang drücken auf den Namen: „Speichern“. Jede Konfiguration führt für Übersetzung, Diktat und Akzente einen eigenen Paket-Fortschritt. Gespeicherte Konfigurationen liegen in einem Raster (Spalten unter Einstellungen → Raster, bis 4; Zeilen wachsen von selbst, beim Verschieben stehen unten immer zwei freie Zeilen bereit); jede Kachel zeigt unten einen Balken mit dem Lernfortschritt Übersetzung (✓ bei 100 %), die geladene Kachel ist in der Hauptfarbe gefüllt. Lang drücken auf eine Kachel zeigt den vollständigen Namen und darunter „Umbenennen“, „Duplizieren“ (Kopie unter neuem Namen, mit eigenem Fortschritt), „Verschieben“, „Listen/Vokabeln ändern“ und „Löschen“. „Verschieben“: Einträge antippen markiert sie (nummeriert, mehrere möglich), ein freier Platz setzt die markierten dort untereinander ein; oder direkt ziehen – ein markierter Eintrag nimmt alle markierten mit, auf einem belegten Platz rücken die Einträge auf die frei gewordenen Plätze (einzeln: die beiden tauschen); „Fertig“ beendet das Verschieben. Neu Gespeichertes kommt untereinander in die erste Spalte unter den untersten Eintrag; das Raster wächst bei Bedarf."},
                  {k:"📁 Gruppen", v:"Sessions lassen sich in Gruppen (Ordner) zusammenfassen: lang drücken → „📁 In Gruppe…“ (vorhandene Gruppe oder neue mit Namen), im Auswahl-Modus für mehrere auf einmal, oder eine Session auf eine Gruppen-Kachel ziehen. Eine Gruppen-Kachel zeigt 📁, Namen, Anzahl und den mittleren Lernfortschritt; antippen öffnet sie, oben führt „← Alle Sessions“ zurück. In der Gruppe: lang drücken → „↑ Aus der Gruppe“. Lang drücken auf die Gruppe: Öffnen, „🧩 Multiquiz der Gruppe“, Umbenennen, Verschieben, „Gruppe auflösen“ (die Sessions kommen zurück). „Mehrere Sessions“ (Aufteilen) legt die neuen Sessions auf Wunsch gleich in eine Gruppe. Gilt auch im Statistik-Tab."},
                  {k:"＋ Neue Session aus Listen", v:"Oben in der Auswahl. „Eine Session“: Listen und Vokabeln wählen, dann wie gewohnt einstellen und starten (lang auf den Namen drücken → Speichern). „Mehrere Sessions“: eine Liste wählen und in Pakete aufteilen (Name, Gruppengröße, Bereich von–bis, Rest) – je Paket eine gespeicherte Session."},
                  {k:"Slot laden", v:"Tippe auf einen Chip, um eine gespeicherte Konfiguration (Listen, Vokabelauswahl, Einstellungen) zu laden."},
                  {k:"Listen-Auswahl", v:"Wähle eine oder mehrere Listen für das Quiz. [Alle] wählt alle Listen, [X] leert die Auswahl. Ohne Liste steht oben rechts „Bitte Liste auswählen“; ist eine gewählt, schließt „Bestätigen“ die Auswahl – danach steht dort ihr Name (bzw. „n Listen“), antippen öffnet sie wieder. Ist eine gespeicherte Konfiguration geladen, sind Listen- und Vokabel-Auswahl festgelegt und ausgeblendet – zum Ändern lang auf die Kachel drücken und „Listen/Vokabeln ändern“ wählen."},
                  {k:"Vokabel-Auswahl [Alle]", v:"Alle Vokabeln der gewählten Listen werden abgefragt."},
                  {k:"Vokabel-Auswahl [Bereich]", v:"Öffnet eine Checkbox-Liste. Einzelne Vokabeln an-/abwählen. [Von–Bis] ermöglicht Bereichsauswahl per 2 Klicks – oder lang auf die erste Vokabel drücken und die letzte antippen. Solange die Liste offen ist, ist der Rest der Session ausgeblendet; „Bestätigen“ oben rechts schließt die Liste (ist nichts angehakt, gilt wieder „Alle“), „Bereich“ öffnet sie wieder."},
                  {k:"Ü | D | A", v:"Abfrageart: Übersetzung, Diktat oder Akzente. Die Kreise unten über „Quiz mit … Vokabeln“ zeigen den Lernfortschritt der Auswahl je Art – die gewählte Art groß mit Name und Prozent, die anderen kleiner; antippen schaltet die Art um (auch über die Kreise der aufgeklappten Kopfzeile). In der Statistik wechselt man die Art über die Mitte des großen Kreisdiagramms. Eine Art ohne passende Vokabeln wird nicht angezeigt. Auch die Listen unter Einstellungen › Listen zeigen die drei Kreise. Jede Art hat eigene Einstellungen (Spalten, Modus, Reihenfolge …), einen eigenen Session-Fortschritt und eigene Scores; beim Umschalten bleiben die Einstellungen der anderen Arten erhalten und werden mit der Konfiguration gespeichert. Übersetzung: Frage–Antwort (feste Frage-Spalte) oder wechselnd, je Antwortspalte Karte, MC, Tastatur und (bei Sprachen mit Akzenten) Akzente – mehrere angehakt heißt „Gemischt“: je Frage und Spalte wird zufällig eine der Arten gewählt, Akzente nur bei Wörtern mit Akzent; sie zählen dann für den Übersetzungs-Score. Diktat: Wort wird vorgelesen, du tippst die Lösung. Akzente: nur Fremdsprachen-Spalten als Antwort, immer im Akzente-Modus."},
                  {k:"Akzente", v:"Eigene Abfrageart (A): Das Wort steht ohne Akzente in großen Buchstaben da. Buchstaben antippen und darunter den richtigen Akzent wählen (é è ê ë, ç, à, œ …). Richtige Akzente werden sofort grün, ein Buchstabe ohne Akzent oder eine falsche Variante leuchtet kurz rot. Sind alle Akzente richtig, wird die Antwort automatisch übernommen oder mit „Prüfen“ bestätigt (je nach Schwierigkeitsgrad). Nach einem Fehlgriff zählt die Vokabel als nicht gewusst. Eigener Akzent-Score (+1 richtig, −1 falsch). Ob auch Wörter ohne Akzent abgefragt werden, legst du beim Schwierigkeitsgrad fest."},
                  {k:"Zeile 1: Stufe · Modus · Reihenfolge", v:"Erster Knopf: Stufe Lernen, Leicht oder Schwer – antippen wechselt der Reihe nach. Zweiter Knopf: Abfrage-Modus der gewählten Art (z. B. „Karte“) – antippen öffnet die Spalten- und Modus-Einstellungen. Dritter Knopf: Reihenfolge – „Zufällige Reihenfolge“, „Schlechteste zuerst“ (nach Score sortiert) oder „Nach Listen-Platz“ (Originalreihenfolge), dazu Score-Filter und „Unbeantwortete zuerst“. Es ist immer nur ein Bereich offen. Ein neues Quiz (ohne geladene Konfiguration) beginnt immer in Übersetzung. Lang drücken: „Regeln Leicht / Schwer“, bei Lernen „Lernen einstellen“ und „Vorlesen“."},
                  {k:"Lernen", v:"Stufe „Lernen“ (dritter Knopf in Zeile 1): Der Start-Knopf heißt dann „Lernen starten“. Wie ein Film: erst das Wort (auf Wunsch vorgelesen), nach einer Pause die Übersetzung mit den eingeschalteten Info-Spalten, dann die nächste Vokabel. Antippen der Karte überspringt die Pause; unten ⏮ zurück, ⏸ anhalten, ⏭ vor, oben „Schließen“. Schließen pausiert: Der Lernstand bleibt je Konfiguration gespeichert (getrennt vom Abfrage-Fortschritt), auch wenn du zwischendurch eine andere Liste lernst oder abfragst – der Start-Knopf heißt dann „Weiter lernen“ und macht an derselben Stelle weiter; links daneben steht der Lernstand (z. B. 12/40), antippen fragt „Lernstand löschen?“. Sind alle Vokabeln angesehen, beginnt das nächste Lernen von vorn. Gelernt werden die noch offenen Vokabeln der Session in Quiz-Reihenfolge, paketweise (Umfang „Je 5“ → 5 pro Paket). Nach jedem Paket: „Quiz mit diesen 5 Vokabeln“ – einmal je Paket: gewusste verbessern den Score, falsche oder aufgedeckte kosten keinen Punkt (Hilfen unter „Lernen einstellen“: Standard „Ohne Hilfen“ – Akzente nicht hervorgehoben, kein Zähler; oder wie Leicht bzw. Schwer); danach geht es mit dem nächsten Paket weiter –, „Weiter lernen: nächste 5“ oder „Zur Übersicht“; 🔄 oben rechts zeigt das Paket nochmals (das Quiz bleibt einmalig). Lernen selbst ändert keine Scores, und auch das Quiz danach nicht den Session-Fortschritt. Ablauf: Wort, Übersetzung, Zusatzinfo – nach jedem Teil die Vorlese- bzw. Lesezeit (ohne Vorlesen aus der Textlänge geschätzt) plus eine Pause. Unter „⚙ Vorlesen & Pausen“ (aufklappbar unter den Knöpfen): Vorlesen Wort | Übersetzung | Info, Zusatzinfo An | Aus und drei Regler „Pause Wort / Übersetzung / Info“ (0–10 s, Standard 1 / 1 / 3 s; ganz rechts „Tippen“: dort wartet die App, bis du die Karte antippst). Ohne Zusatzinfo gilt nach der Übersetzung die längere der Pausen Übersetzung und Info. Übersetzung und Zusatzinfo haben ihren Platz schon vorher und blenden kurz ein. Lang drücken auf den Knopf → „Lernen einstellen“: was zuerst kommt (Fremdsprache oder Deutsch), was vorgelesen wird und in welcher Sprache die Zusatzinfo vorgelesen wird. "},
                  {k:"Regeln Leicht / Schwer", v:"Lang drücken auf den Stufen-Knopf. Per Haken legst du fest, was in welcher Stufe gilt: fehlende Akzente beim Tippen als richtig werten, Punktabzug bei „Lösung anzeigen“, „Nicht gewusst“ zieht 1 Punkt ab, im Akzent-Modus auch Wörter ohne Akzent abfragen (mit Höchstanteil), Buchstaben mit Akzent hervorheben, die Zahl der noch fehlenden Akzente anzeigen (z. B. 2 / 3) und richtige Antworten automatisch übernehmen (sonst „Prüfen“). „Vorlesen“ (ebenfalls per Lang-Druck): Auto-Play und welche Spalten vorgelesen werden."},
                  {k:"Zeile 2: Umfang · Abfrage-Ziel · Gelernte", v:"Umfang: „Alle Vokabeln“ in einem Durchgang oder „Je N Vokabeln“ – antippen zeigt große Zahlenknöpfe (Alle, 5–50). Bei Paketen kannst du nach jedem Paket pausieren oder weitermachen; abgefragte Vokabeln werden beim nächsten Paket übersprungen. Gelernte (nur wenn es welche gibt): „13 gelernte“ = ausgeblendet, „+ 13 gelernte“ = werden mit abgefragt."},
                  {k:"Abfrage-Ziel", v:"Anzahl: jede Vokabel 1×/2×/3× pro Durchgang abfragen. Mit Wiederholung: Vokabeln so lange einreihen, bis jede 1×/2×/3× richtig beantwortet wurde. Score (global, Knopf z. B. „Score < +3“): nur Vokabeln mit Score unter dem Ziel kommen in die Session, jede einmal (ohne Wiederholung) – Ziel 0 fragt nur negative ab (nie abgefragte zählen als 0). Session-Score: alle Vokabeln, jede so lange, bis sie in dieser Session um das Ziel gestiegen ist."},
                  {k:"Konfiguration speichern", v:"Lang drücken auf den Namen in der Kopfzeile → „Speichern“. Speichert die aktuelle Auswahl und Einstellungen unter einem Namen; beim nächsten Mal per Kachel laden."},
                  {k:"Quiz starten", v:"Unterste Sektion: Fortschrittsbalken der Session, darunter links der Stand (z. B. „15/50“) – antippen beginnt nach kurzer Rückfrage für die aktuelle Art eine neue Session (gelöscht wird nur, welche Vokabeln schon abgefragt wurden; Scores bleiben) – und rechts der Start-Knopf mit der Zahl der Vokabeln, die in der Session noch übrig sind (z. B. 10 von 25 abgefragt → „15 Vokabeln“; die Paketgröße steht auf dem Umfang-Knopf)."},
                  {k:"Multiquiz", v:"Mehrere gespeicherte Konfigurationen zusammen abfragen: lang auf eine Kachel drücken → „☑ Auswählen“, dann weitere Kacheln antippen (nummeriert; nochmal antippen nimmt sie heraus; über dem Raster steht „2 ausgewählt · 50 Vokabeln“). Lang drücken auf eine Kachel zeigt die Aktionen für die Auswahl: „🧩 Multiquiz starten“ (ab 2, startet sofort), „⇄ Verschieben“, „🗑 Löschen“ (mehrere auf einmal, Rückfrage mit allen Namen) und „Auswahl beenden“; „Fertig“ oben beendet die Auswahl ebenfalls. Abgefragt werden alle Vokabeln der gewählten Konfigurationen (auch verschiedene Sprachen – vorgelesen wird jede in ihrer Sprache), die Einstellungen kommen von Nr. 1. Das Multiquiz erscheint im Verlauf (🧩) mit eigenem Fortschritt, die Kopfzeile zeigt „Multiquiz“ und in der Info-Zeile die Teile. Lang drücken auf die Kopfzeile → „Speichern“ legt es als eigene Kachel ab (Name-Vorschlag „Multiquiz: A + B“). In der Statistik zeigt es die gemeinsame Statistik; die Scores gelten wie immer je Vokabel."},
                ]},
                {titel:"Im Quiz", inhalt:[
                  {k:"Karte (Frage–Antwort)", v:"Tippe auf die Karte, um die Antwort aufzudecken. Dann: Richtig oder Falsch selbst einschätzen. Lang drücken auf Frage- oder Antwortkarte (auch beim Diktat) → „✎ Richtige Antwort bearbeiten“: ändert nur die richtige Antwort der gerade gefragten Spalte – falsche Antworten und Lernstand bleiben, die Änderung gilt sofort (auch für die laufende Frage)."},
                  {k:"Tippen", v:"Antwort eintippen und bestätigen. Nach 3 Fehlversuchen wird die Lösung gezeigt. Ob fehlende Akzente als richtig gelten, hängt vom Schwierigkeitsgrad ab (Einstellungen)."},
                  {k:"Diktat", v:"Großer Lautsprecher: Wort nochmals vorlesen. Kleiner Lautsprecher: langsamer/erneut. Antwort eintippen."},
                  {k:"Scoring", v:"Richtig: +1 Punkt, Streak +1. Ab Streak 3: mindestens +2 Punkte. Falsch: Streak auf 0 und −1 Punkt – oder kein Abzug, wenn die Regel „Nicht gewusst zieht 1 Punkt ab“ in der Stufe aus ist (Standard: Einfach ohne Abzug, Schwer −1). Die Vokabel wird in jedem Fall wiederholt. Aufgedeckt: kein Punkt, kein Streak. Mehrere Antwort-Spalten zählen zusammen als eine Bewertung: alle gewusst = richtig, sonst falsch. Multiple Choice: nur ein Treffer ohne Fehlklick gilt als gewusst – nach einem Fehlklick darf man weitersuchen, die Spalte zählt aber als nicht gewusst."},
                  {k:"Aufdecken", v:"Zeigt die Antwort ohne Wertung."},
                  {k:"Gelernt!", v:"Erreicht eine Vokabel mit deiner Antwort die Gelernt-Schwelle (Einstellungen), leuchtet die Antwort-Karte kurz auf und ein kleiner Sternenregen fliegt heraus. Die Farbe lässt sich im Farbmodus als „Gelernt-Effekt“ ändern (Standard: kräftiges Hellgelb)."},
                  {k:"Session-Auswertung", v:"Am Ende eines Durchlaufs (bzw. einer Runde ohne Pakete) zeigt der erste Bildschirm das letzte Paket, „Weiter →“ führt zur Auswertung der ganzen Session: zwei Balken Start und Ende (Gelernt, In Arbeit, Nie abgefragt, Negativ), Lernfortschritt vorher → nachher, neu gelernte Vokabeln und darunter Zusatzdaten (Vokabeln und Pakete, Ø Score, verbessert/gleich/verschlechtert, auf Anhieb gewusst, Dauer). Darunter: Nochmal!, Zur Übersicht, Zur Statistik."},
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
                  {k:"Vokabelliste", v:"Alle gefilterten Vokabeln mit Score-Balken (grün = positiv, rot = negativ) und letztem Abfragedatum. Lang drücken auf eine Zeile: „✎ Bearbeiten“ (alle Spalten, mit falschen Antworten nach ||) oder „➕ Neue Vokabel“ in der Liste dieser Zeile (mindestens zwei Spalten außer Info). Lernstände bleiben beim Bearbeiten erhalten."},
                ]},
                {titel:"Einstellungen-Tab", inhalt:[
                  {k:"Aufbau", v:"Vier Bereiche, immer nur einer offen: Listen (alle Listen öffnen, „+ Neu“ zum Importieren, darunter die Sicherung), Lernen (Gelernt-Schwelle, Akzente je Sprache), Raster (Plätze für Sessions und Listen) und App (Aktualisieren, Farbschema, Info mit Übersicht, Konzept und Anleitung)."},
                  {k:"Akzente", v:"Je Sprache An oder Aus (Standard: nur Französisch an). Aus: keine Abfrageart „A“ und keine Akzent-Statistik für Listen dieser Sprache, und fehlende Akzente beim Tippen und im Diktat gelten als richtig. An: „A“ steht zur Verfügung, beim Tippen gilt die Regel der Stufe."},
                  {k:"Farbschema", v:"21 Vorlagen: Natur (Standard), Freudig, Pastelle, Mädchen, Jungs, Dunkel, Ozean, Lavendel, Minze, Sand, Beere, Olive, Graphit, Kontrast, Mitternacht, Espresso und die bunten Pastell-Vorlagen Sorbet, Lagune, Blumenwiese, Nordlicht und Sommerfest (mit eigenen Tönen für Kopf, Kopfzeilen, Karten, Knöpfe und Start). „🎲 Zufällige Farben“ erzeugt bei jedem Tipp ein neues stimmiges Pastell-Schema „Zufall“ (zufälliger Grundton, Begleittöne benachbart, als Gegenfarbe oder Dreiklang) – zum Behalten umbenennen oder duplizieren, sonst ersetzt der nächste Tipp es – antippen wählt das Schema, die App färbt sich sofort um. Vorlagen lassen sich nicht ändern, aber duplizieren (lang drücken). Liste & Start (aktuelle Liste oben im Quiz-Tab und Start-Knopf) und ihre Schrift sind eigene Rollen – gewählte Farben gelten immer genau so, es wird nichts automatisch umgestellt. Flächen haben je Funktion eine eigene Rolle: Hintergrund (nur die Seite), App-Kopf (Titel- und Tab-Leiste), Bereichs-Kopfzeilen (z. B. Kopf der Listenauswahl), Karten (Listen, Quiz-Bereiche), Abfrage-Karten, Dialoge, Knöpfe & Felder, Info-Kästen und Ausgewählt – ohne eigenen Wert übernehmen sie die bisherige Farbe, Kopfzeilen und Info-Kästen mit einem Hauch der Hauptfarbe. „🎨 Farbe ändern“ unter jedem Lang-Druck-Menü (abschaltbar unter Farbschema) startet den Farbmodus direkt für diese Stelle. Das Farbfeld öffnet sich auf der Seite gegenüber der angetippten Stelle, das Element bleibt sichtbar und markiert. Jede Zeile nennt zuerst Element und Teil (z. B. „Start-Knopf · Text groß“, „Start-Knopf · Text klein“, „Start-Knopf · Hintergrund“), darunter klein die Rolle („gilt auch für: …“). Jeder Teil hat zwei Wege: „Alle Stellen“ ändert die Rolle (überall, wo sie vorkommt), „Nur dieses Element“ gibt nur dieser Element-Art eine eigene Farbe (z. B. nur dem Start-Knopf – alle gleichartigen Stellen, die Rolle bleibt); „↺ Rolle“ nimmt die eigene Farbe zurück. Eigene Element-Farben gehören zum Schema und stehen in dessen Bearbeiten-Ansicht (✕ entfernt sie). Farbmodus: „🎨 Farbmodus starten“, dann normal durch die App gehen und lang auf ein Element drücken – das Farbfeld zeigt die Farben dieser Stelle (auch kleiner Teile im Umkreis, z. B. Ring und Buchstabe der Mini-Kreise); antippen hebt das Element hervor und öffnet den Farbwähler: großer Farbkreis (außen kräftig, zur Mitte weniger gesättigt), Regler für Helligkeit und Sättigung, Hex-Feld, „Zuletzt verwendet“ (10 Farben) und „In diesem Schema“ (alle Farben des gerade bearbeiteten Schemas, ohne Doppelte – antippen übernimmt sie); die App färbt sich beim Ziehen sofort um, „Anwenden“ übernimmt, „Abbrechen“ stellt die alte Farbe wieder her. Unten rechts: „Zurücksetzen“ verwirft alles und beendet, „Farben übernehmen“ speichert (bei einer Vorlage als neues eigenes Schema) und beendet. Eigene Schemata: lang drücken → Bearbeiten (Farbwähler je Rolle: Hauptfarbe, Hintergrund, Text, Richtig/Falsch, Statistik-Farben …, Änderungen sofort sichtbar und gespeichert; „Zurücksetzen“ holt die Farben der Vorlage zurück), Duplizieren, Umbenennen, Löschen."},
                  {k:"App aktualisieren", v:"„Prüfen“ sucht nach einer neuen App-Version. Wird eine gefunden, erscheint unten der Hinweis „Neue Version verfügbar“ – mit „Aktualisieren“ wird sie aktiv. Die App funktioniert auch offline."},
                  {k:"Gespeicherte Listen", v:"Zeigt, wie viele Listen aktuell auf diesem Gerät gespeichert sind."},
                ]},
              ].map(abschnitt => (
                <div key={abschnitt.titel} style={{marginBottom:20}}>
                  <div className="sektion-label" style={{marginBottom:8}}>{abschnitt.titel}</div>
                  <div className="karte">
                    {abschnitt.inhalt.map((zeile, i) => (
                      <div key={i} style={{padding:"9px 14px", borderBottom: i < abschnitt.inhalt.length-1 ? "1px solid var(--rahmen)" : "none"}}>
                        <div style={{fontWeight:600, fontSize:"0.8rem", color:"var(--haupt)", marginBottom:2}}>{zeile.k}</div>
                        <div style={{fontSize:"0.82rem", color:"var(--text)"}}>{zeile.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
          )}

          </>)}

          {/* Bereiche mit Kopfzeile: immer nur einer offen */}
          <div className="sektion" data-einst-bereiche style={einstBereich === "info" && infoModus !== "uebersicht" ? {paddingBottom:'100dvh'} : {}}>
            {einstKopf("listen", "Listen", "Listen öffnen, importieren, sichern")}
            {einstBereich === "listen" && (<div className="einst-inhalt" data-einst-listen>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
              <div className="sektion-label" style={{margin:0}}>Meine Listen</div>
              <button className="btn btn-ghost btn-sm" data-liste-neu style={{display:"inline-flex",alignItems:"center",gap:5}} onClick={() => { resetImport(); setTab("listen"); setAnsicht("import"); }}
                {...tt("Neue Vokabelliste importieren oder anlegen")}><IcoPlus s={13}/>Neu</button>
            </div>
            {sichtbareListen.length === 0 ? (
              <div className="leer"><div className="leer-text">Noch keine Listen vorhanden.</div></div>
            ) : renderListenRaster()}
            <div className="sektion-label einst-unterkopf">Sicherung</div>
            <div className="karte" data-sicherung>
              <div className="karte-zeile">
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name">Gespeicherte Listen</div>
                  <div className="karte-zeile-sub" data-speicher-dauerhaft={String(speicherDauerhaft)}>{listenIndex.length} Liste{listenIndex.length!==1?"n":""} · {
                    speicherDauerhaft === true ? "Speicher dauerhaft geschützt" : speicherDauerhaft === false ? "Speicher nicht geschützt – der Browser darf ihn aufräumen" : "Schutz des Speichers unbekannt"}</div>
                </div>
                {speicherDauerhaft === false && (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigator.storage?.persist?.().then(setSpeicherDauerhaft).catch(() => {})}
                    {...tt("Den Browser erneut bitten, den Speicher dauerhaft zu behalten (Chrome gewährt das meist, wenn die App installiert ist)")}>Schützen</button>
                )}
              </div>
              <div className="karte-zeile" style={{borderTop:"1px solid var(--rahmen)"}}>
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name">Alles sichern</div>
                  <div className="karte-zeile-sub" data-letzte-sicherung>Listen mit Scores, Einstellungen, Farben, gespeicherte Quiz · {letzteSicherung ? `zuletzt am ${formatTag(letzteSicherung)}` : "noch nie gesichert"}</div>
                </div>
                <button className="btn btn-primary btn-sm" data-alles-sichern onClick={sichereAlles}
                  {...tt("Alles in einer Datei sichern (Vorschlag „Vokabel-App Sicherung Datum“, Name änderbar; landet in Downloads bzw. im Teilen-Menü)")}>💾 Sichern</button>
              </div>
              <div className="karte-zeile" style={{borderTop:"1px solid var(--rahmen)"}}>
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name">Wiederherstellen</div>
                  <div className="karte-zeile-sub">Sicherungsdatei laden – ersetzt den aktuellen Stand</div>
                </div>
                {/* bewusst ohne accept: Android-Dateiauswahlen blenden sonst passende Dateien aus */}
                <input type="file" ref={sicherungInputRef} data-sicherung-datei style={{display:"none"}}
                  onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) ladeSicherungsDatei(f); }} />
                <button className="btn btn-ghost btn-sm" onClick={() => sicherungInputRef.current?.click()}
                  {...tt("Eine Sicherungsdatei wählen; vor dem Wiederherstellen wird nachgefragt")}>Laden</button>
              </div>
              {sicherungFehler && <div className="fehler" style={{margin:"0 16px 12px"}}>{sicherungFehler}</div>}
              {sicherungLaden && (
                <div className="karte-zeile" data-sicherung-bestaetigen style={{borderTop:"1px solid var(--rahmen)", flexDirection:"column", alignItems:"stretch", gap:8}}>
                  <div className="karte-zeile-sub">Sicherung vom {formatTag(sicherungLaden.erstellt)}: {listenAusSicherung(sicherungLaden).length} Liste{listenAusSicherung(sicherungLaden).length !== 1 ? "n" : ""}. Wiederherstellen ersetzt alle aktuellen Listen, Scores und Einstellungen.</div>
                  <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSicherungLaden(null)} {...tt("Nicht wiederherstellen")}>Abbrechen</button>
                    <button className="btn btn-primary btn-sm" data-wiederherstellen-ok onClick={() => bestaetigeWiederherstellen(sicherungLaden)}
                      {...tt("Den Stand aus der Sicherung übernehmen; die App lädt danach neu")}>Wiederherstellen</button>
                  </div>
                </div>
              )}
              <div className="toggle-row" style={{borderTop:"1px solid var(--rahmen)"}}>
                <div className="toggle-label">Erinnerung</div>
                <div className="toggle-btn" data-sicherung-tage>
                  {SICHERUNG_TAGE.map(t => (
                    <button key={t} className={`toggle-opt${sicherungTage === t ? " aktiv" : ""}`} data-sicherung-tage-wahl={t}
                      onClick={() => speichereEinst({ ...einstellungen, sicherungErinnerung: t })}
                      {...tt(t ? `In der Session-Auswahl erinnern, wenn die letzte Sicherung älter als ${t} Tage ist` : "Nicht an Sicherungen erinnern")}>{t ? `${t} T` : "Aus"}</button>
                  ))}
                </div>
              </div>
            </div>
            </div>)}
            {einstKopf("lernen", "Lernen", "Gelernt-Schwelle, Akzente")}
            {einstBereich === "lernen" && (<div className="einst-inhalt">
            {(() => {
              const g = { ...STANDARD_ANTWORT_GEWICHTE, ...(einstellungen.antwortGewichte || {}) };
              const arten = [["karte", "Karte"], ["mc", "MC"], ["hoeren", "Hören"], ["akzent", "Akzente"], ["tippen", "Tastatur"], ["puzzle", "Puzzle"], ["luecke", "Lücken"], ["artikel", "Artikel"], ["satzfinden", "Satz finden"], ["lueckensatz", "Lückensatz"], ["satzbauen", "Satz bauen"], ["zuordnung", "Zuordnung"], ["memory", "Memory"]];
              const summe = arten.reduce((x, [k]) => x + (g[k] || 0), 0);
              const setze = (k, v) => speichereEinst({ ...einstellungen, antwortGewichte: { ...(einstellungen.antwortGewichte || {}), [k]: Math.max(0, Math.min(100, v)) } });
              return (
                <div className="karte" data-antwort-gewichte>
                  <div className="karte-zeile" style={{flexDirection:"column", alignItems:"stretch", gap:8}}>
                    <div className="karte-zeile-name" {...tt("Sind bei einer Spalte mehrere Antwortarten angehakt, wird je Frage eine davon gezogen – mit diesen Anteilen, umgerechnet auf die angehakten Arten. Zuordnung: Anteil je Ziehung, eine Ziehung startet eine Runde mit mehreren Vokabeln.")}>Antwortarten mischen</div>
                    {arten.map(([k, label]) => (
                      <div key={k} style={{display:"flex", alignItems:"center", gap:8}}>
                        <span style={{minWidth:84, fontSize:"0.88rem"}}>{label}</span>
                        <input type="range" min="0" max="100" step="5" value={g[k] || 0} data-gewicht={k} style={{flex:1}}
                          onChange={e => setze(k, Number(e.target.value))} {...ttFeld(`Anteil für „${label}“, wenn mehrere Arten angehakt sind`)}/>
                        <span data-gewicht-wert={k} style={{minWidth:64, textAlign:"right", fontSize:"0.85rem", fontWeight:700}}>{g[k] || 0} %
                          <span style={{fontWeight:400, color:"var(--text3)"}}> ({summe ? Math.round((g[k] || 0) / summe * 100) : 0})</span></span>
                      </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" data-gewichte-standard style={{alignSelf:"flex-start"}}
                      onClick={() => speichereEinst({ ...einstellungen, antwortGewichte: undefined })} {...tt("Zurück auf Karte 50, MC 30, Akzente 30, Tastatur 15, Zuordnung 5")}>Standard</button>
                  </div>
                </div>
              );
            })()}
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
            <div className="sektion-label einst-unterkopf" {...tt("Ausgeschaltet: keine Abfrageart „A“ und keine Akzent-Statistik für diese Sprache; fehlende Akzente beim Tippen gelten als richtig")}>Akzente je Sprache</div>
            <div className="karte" data-akzent-sprachen>
              <div className="karte-zeile" style={{flexDirection:"column", alignItems:"flex-start", gap:4}}>
              </div>
              {(vorhandeneSprachen.length ? vorhandeneSprachen : SPRACHEN.filter(x => x.code === "fr")).map(sp => (
                <div key={sp.code} className="toggle-row" style={{borderTop:"1px solid var(--rahmen)"}}>
                  <div className="toggle-label">{sp.flagge} {sp.name}</div>
                  <div className="toggle-btn">
                    <button className={`toggle-opt${akzenteAn(sp.code) ? " aktiv" : ""}`} data-akzent-sprache={`${sp.code}:an`}
                      onClick={() => speichereEinst({ ...einstellungen, akzenteSprachen: { ...(einstellungen.akzenteSprachen || {}), [sp.code]: true } })}
                      {...tt(`Akzente für ${sp.name} einschalten: Abfrageart „A“, Akzent-Statistik, Akzente müssen beim Tippen stimmen`)}>An</button>
                    <button className={`toggle-opt${!akzenteAn(sp.code) ? " aktiv" : ""}`} data-akzent-sprache={`${sp.code}:aus`}
                      onClick={() => speichereEinst({ ...einstellungen, akzenteSprachen: { ...(einstellungen.akzenteSprachen || {}), [sp.code]: false } })}
                      {...tt(`Akzente für ${sp.name} ausschalten: keine Abfrageart „A“, fehlende Akzente beim Tippen gelten als richtig`)}>Aus</button>
                  </div>
                </div>
              ))}
            </div>
            </div>)}
            {einstKopf("stimmen", "Stimmen", "Vorlesen: Stimme je Sprache, Tempo")}
            {einstBereich === "stimmen" && (<div className="einst-inhalt" data-stimmen-einst>
            {(() => {
              const codes = ["de", ...new Set(listenIndex.map(l => listeSprache(lsGet(SK.liste(l.id)))))];
              const basisVon = c => c === "de" ? "de" : sprachInfo(c).tts.split("-")[0];
              const ttsVon = c => c === "de" ? "de-DE" : sprachInfo(c).tts;
              const gesehen = new Set();
              const zeilen = codes.filter(c => { const b = basisVon(c); if (gesehen.has(b)) return false; gesehen.add(b); return true; });
              const w = stimmenWahl;
              const setze = (feld, b, wert) => aendereStimmen({ ...w, [feld]: { ...(w[feld] || {}), [b]: wert } });
              const regler = { width:"100%" };
              const hilfeKnopf = (b, klein) => (
                <button className={klein ? "btn btn-ghost btn-sm" : "btn btn-ghost"} data-stimmen-hilfe={b || ""} style={klein ? { alignSelf:"flex-start" } : { width:"100%", marginBottom:10 }}
                  onClick={() => setModal("stimmen-hilfe")} {...tt("Anleitung: weitere Stimmen auf dem Gerät laden (z. B. männliche und weibliche, „Erweitert“/„Premium“)")}>＋ Weitere Stimmen laden</button>);
              return (<>
              {hilfeKnopf(null, false)}
              {zeilen.map(c => {
                const b = basisVon(c), alle = stimmenFuerSprache(b), varianten = stimmenVarianten(b);
                const name = c === "de" ? "Deutsch" : sprachInfo(c).name;
                const vr = w.variante?.[b] && varianten.includes(w.variante[b]) ? w.variante[b] : null;
                const liste = alle.filter(v => !vr || normLang(v.lang) === vr);
                const aus = w.aus?.[b] || [];
                const aktuell = gewaehlteStimme(b) || stimmeFuer(ttsVon(c));
                const probe = STIMMEN_PROBE[b] || STIMMEN_PROBE[c] || "Test";
                const sprichMit = v => { if (!window.speechSynthesis) return; window.speechSynthesis.cancel(); window.speechSynthesis.speak(aeusserung(probe, v ? v.lang : ttsVon(c), v)); };
                const tempo = w.tempoSprache?.[b] || 1;
                return (
                  <div key={b} className="karte" data-stimme-sprache={b}>
                    <div className="karte-zeile" style={{flexDirection:"column", alignItems:"stretch", gap:8}}>
                      <div className="karte-zeile-name">{c === "de" ? "🇩🇪" : sprachInfo(c).flagge} {name}</div>
                      {alle.length <= 1 && hilfeKnopf(b, true)}
                      {alle.length === 0 ? <div className="karte-zeile-sub">Keine Stimme auf diesem Gerät</div> : (<>
                        {varianten.length > 1 && (
                          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                            <button className={`typ-btn${!vr ? " aktiv" : ""}`} data-stimme-variante={`${b}:alle`} onClick={() => setze("variante", b, undefined)}
                              {...tt(`${name}: Stimmen aller Varianten verwenden`)}>Alle</button>
                            {varianten.map(x => (
                              <button key={x} className={`typ-btn${vr === x ? " aktiv" : ""}`} data-stimme-variante={`${b}:${x}`} onClick={() => setze("variante", b, x)}
                                {...tt(`${name}: Variante ${varianteText(x)} – Aussprache und Stimmen dieser Variante`)}>{varianteText(x)}</button>
                            ))}
                          </div>
                        )}
                        <div data-stimmen-liste={b} style={{display:"flex", flexDirection:"column", gap:2}}>
                          {liste.map(v => {
                            const an = !aus.includes(v.voiceURI), ist = aktuell === v;
                            return (
                              <div key={v.voiceURI} className="stimme-zeile" data-stimme={v.voiceURI}>
                                <input type="checkbox" checked={an} data-stimme-an={v.voiceURI} style={{width:18, height:18}}
                                  onChange={() => setze("aus", b, an ? [...aus, v.voiceURI] : aus.filter(x => x !== v.voiceURI))}
                                  {...ttFeld(an ? "Stimme abschalten – wird nicht mehr verwendet" : "Stimme einschalten – wird beim „🔁 Stimme“ durchgewechselt")}/>
                                <span style={{flex:1, opacity: an ? 1 : 0.45, fontWeight: ist ? 700 : 400, cursor: an ? "pointer" : "default"}} data-stimme-wahl={v.voiceURI}
                                  onClick={() => { if (!an) return; setze("sprachen", b, v.voiceURI); sprichMit(v); }}
                                  {...tt(an ? "Antippen: diese Stimme verwenden" : "abgeschaltet")}>
                                  {v.name}{stimmeGeschlecht(v) && <span data-stimme-geschlecht style={{marginLeft:4}}>{stimmeGeschlecht(v)}</span>} <span style={{fontSize:"0.72rem", color:"var(--text3)"}}>{v.lang}</span>{ist && an ? " ✓" : ""}
                                </span>
                                <button className="btn btn-ghost btn-sm" data-stimme-probe={v.voiceURI} onClick={() => sprichMit(v)} {...tt(`Probe: ${v.name}`)}>▶</button>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{display:"flex", alignItems:"center", gap:8}}>
                          <span style={{fontSize:"0.8rem", color:"var(--text2)", minWidth:92}}>Tempo <b data-stimme-tempo-wert={b}>{tempo.toFixed(1).replace(".", ",")}×</b></span>
                          <input type="range" min="0.6" max="1.6" step="0.1" value={tempo} data-stimme-tempo={b} style={regler}
                            onChange={e => setze("tempoSprache", b, Number(e.target.value) === 1 ? undefined : Number(e.target.value))}
                            onPointerUp={() => sprichMit(aktuell)} {...ttFeld(`Tempo für ${name} – zum Ausgleich zwischen den Sprachen; wird mit dem Gesamt-Tempo multipliziert`)}/>
                        </div>
                      </>)}
                    </div>
                  </div>
                );
              })}
              <div className="karte">
                <div className="karte-zeile" style={{flexDirection:"column", alignItems:"stretch", gap:6}}>
                  <div className="karte-zeile-name">Gesamt-Tempo <span data-stimmen-tempo style={{fontWeight:400, color:"var(--text2)"}}>{(w.tempo || 1).toFixed(1).replace(".", ",")}×</span></div>
                  <input type="range" min="0.6" max="1.4" step="0.1" value={w.tempo || 1} data-stimmen-tempo-regler style={regler}
                    onChange={e => aendereStimmen({ ...w, tempo: Number(e.target.value) === 1 ? undefined : Number(e.target.value) })}
                    {...ttFeld("Gesamt-Tempo für alle Sprachen (multipliziert mit dem Tempo der Sprache) – auch über lang drücken auf eine Abfrage-Karte")}/>
                </div>
              </div>
              </>);
            })()}
            </div>)}
            {einstKopf("raster", "Raster", "Plätze für Sessions und Listen")}
            {einstBereich === "raster" && (<div className="einst-inhalt">
            <div className="sektion-label einst-unterkopf">Sessions (gespeicherte Konfigurationen)</div>
            {rasterEinstellung(rasterGroesse(einstellungen), setzeRasterGroesse,
              "Plätze für gespeicherte Konfigurationen im Quiz- und Statistik-Tab", "Zeilen wachsen von selbst: beim Verschieben stehen unten immer zwei freie Zeilen bereit.", "")}
            <div className="sektion-label einst-unterkopf">Listen</div>
            {rasterEinstellung(rasterGroesse(einstellungen, "listenRaster"), setzeListenRasterGroesse,
              "Plätze der Listen unter Einstellungen › Listen – die Reihenfolge gilt in der ganzen App", "Zeilen wachsen von selbst: beim Verschieben stehen unten immer zwei freie Zeilen bereit.", "listen")}
            </div>)}
            {einstKopf("farben", "Farben", "Vorlagen, eigene Schemata, Farbmodus")}
            {einstBereich === "farben" && (<div className="einst-inhalt" data-farben-einst>
            {renderFarbschemata()}
            </div>)}
            {einstKopf("app", "App", "Aktualisieren, Info")}
            {einstBereich === "app" && (<div className="einst-inhalt">
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
            <div className="sektion-label einst-unterkopf">Info</div>
            <div className="karte">
              <div className="karte-zeile">
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name">Info</div>
                  <div className="karte-zeile-sub">Übersicht, Konzept, Anleitung</div>
                </div>
                <button className="btn btn-ghost btn-sm" data-info-oeffnen onClick={() => schalteEinstBereich("info")} {...tt("Übersicht, Konzept und Anleitung der App öffnen")}>Öffnen</button>
              </div>
            </div>
            </div>)}
          </div>
        </>)}
      </div>

      {/* ── Modals (global) ── */}
      {inGruppe && (
        <div className="overlay" onClick={() => setInGruppe(null)}>
          <div className="modal" data-in-gruppe-dialog onClick={e => e.stopPropagation()}>
            <div className="modal-titel">In Gruppe ({inGruppe.ids.length} Session{inGruppe.ids.length !== 1 ? "s" : ""})</div>
            {(slots.ordner || []).length > 0 && (<>
              <div style={{fontSize:"0.8rem", color:"var(--text2)", marginBottom:8}}>In eine vorhandene Gruppe:</div>
              <div style={{display:"flex", flexDirection:"column", gap:6, marginBottom:14}}>
                {slots.ordner.map(o => (
                  <button key={o.id} className="neue-session-wahl" data-in-gruppe={o.id} onClick={() => verschiebeInOrdner(inGruppe.ids, o.id)}
                    {...tt(`In die Gruppe „${o.name}“ verschieben`)}>
                    <b>📁 {o.name}</b><span>{slots.gespeichert.filter(x => x.ordner === o.id).length} Sessions</span>
                  </button>
                ))}
              </div>
            </>)}
            <label className="inp-label">Neue Gruppe</label>
            <input className="inp" data-ordner-name-feld value={inGruppe.name} placeholder="Name der Gruppe" autoFocus
              onChange={e => setInGruppe(g => ({ ...g, name: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter" && inGruppe.name.trim()) legeOrdnerAn(inGruppe.name, inGruppe.ids); }}
              {...ttFeld("Name der neuen Gruppe")} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setInGruppe(null)} {...tt("Schließen, ohne etwas zu ändern")}>Abbrechen</button>
              <button className="btn btn-primary" data-ordner-neu disabled={!inGruppe.name.trim()} onClick={() => legeOrdnerAn(inGruppe.name, inGruppe.ids)}
                {...tt("Neue Gruppe mit diesen Sessions anlegen")}>Neue Gruppe</button>
            </div>
          </div>
        </div>
      )}
      {ordnerUmbenennen && (
        <div className="overlay" onClick={() => setOrdnerUmbenennen(null)}>
          <div className="modal" data-ordner-umbenennen onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Gruppe umbenennen</div>
            <input className="inp" data-ordner-name-feld value={ordnerUmbenennen.name} autoFocus
              onChange={e => setOrdnerUmbenennen(o => ({ ...o, name: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") benenneOrdnerUm(ordnerUmbenennen.id, ordnerUmbenennen.name); }}
              {...ttFeld("Neuer Name der Gruppe")} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setOrdnerUmbenennen(null)} {...tt("Schließen, ohne etwas zu ändern")}>Abbrechen</button>
              <button className="btn btn-primary" data-ordner-umbenennen-ok onClick={() => benenneOrdnerUm(ordnerUmbenennen.id, ordnerUmbenennen.name)} {...tt("Neuen Namen speichern")}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {modal === "neue-session" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" data-neue-session-dialog={neueSessionSchritt} onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Neue Session aus Listen</div>
            {neueSessionSchritt === "art" ? (<>
              <button className="neue-session-wahl" data-neue-session-art="eine" onClick={() => { setModal(null); neueQuizKonfiguration(); window.scrollTo(0, 0); }}
                {...tt("Listen und Vokabeln wählen, dann wie gewohnt einstellen; lang auf den Namen drücken speichert die Session")}>
                <b>Eine Session</b>
              </button>
              <button className="neue-session-wahl" data-neue-session-art="mehrere" onClick={() => setNeueSessionSchritt("liste")}
                {...tt("Eine Liste in Pakete aufteilen (Bereich von–bis, Größe) – je Paket eine gespeicherte Session")}>
                <b>Mehrere Sessions</b>
              </button>
            </>) : (<>
              <div style={{fontSize:"0.82rem", color:"var(--text2)", marginBottom:10}}>Welche Liste soll aufgeteilt werden?</div>
              <div style={{display:"flex", flexDirection:"column", gap:6, maxHeight:"50vh", overflowY:"auto"}}>
                {sichtbareListen.map(l => (
                  <button key={l.id} className="neue-session-wahl" data-aufteilen-liste={l.id} onClick={() => { setModal(null); starteAufteilen(l.id); }}
                    {...tt(`„${l.name}“ in Sessions aufteilen`)}>
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
      )}
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
      })()}
      {modal === "liste-duplizieren" && listeMenueId && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Liste duplizieren</div>
            <label className="inp-label">Name der Kopie</label>
            <input {...ttFeld("Name der neuen Liste")} className="inp" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }}
              onKeyDown={e => e.key === "Enter" && dupliziereListe()} />
            <div style={{fontSize:"0.78rem", color:"var(--text2)", marginTop:6}}>Die Kopie enthält alle Vokabeln und Spalten – die Lernstände beginnen neu.</div>
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
            <div style={{fontSize:"0.82rem", color:"var(--text2)", marginBottom:12}}>Typ: {editSpalteTyp}</div>
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
      {renderVokabelEditor()}
      {gruppenQuiz && (
        <div className="overlay" onClick={() => setGruppenQuiz(null)}>
          <div className="modal" data-gruppen-quiz onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Quiz starten?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
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
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
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
              </>)}

              <label className="inp-label" style={istGespeichert ? {marginTop:14} : undefined}>{istGespeichert ? "Als neue Session" : "Name"}</label>
              <input {...ttFeld("Name für die neue Session – Eingabetaste speichert")} className="inp" value={modalInput} autoFocus data-slot-name-feld
                onChange={e => setModalInput(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); doSpeichernNeu(); } }}
                enterKeyHint="done"
                placeholder="z.B. Irregular Verbs" />
              <div className="modal-actions" style={{marginTop:12}}>
                <button {...tt("Schließen, ohne etwas zu speichern")} className="btn btn-ghost" onClick={schliesseModal}>Abbrechen</button>
                <button {...tt("Als neue Session speichern")} className="btn btn-primary" data-slot-speichern-neu onClick={doSpeichernNeu}>
                  {istGespeichert ? "Neu speichern" : "Speichern"}
                </button>
              </div>

              {andereSlots.length > 0 && (
                <div style={{marginTop:16}}>
                  <div className="inp-label">{istGespeichert ? "Andere Session ersetzen" : "Vorhandene Session ersetzen"}</div>
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
      })()}
      {auswahlLoeschen && (() => {
        const { art, ids } = auswahlLoeschen;
        const namen = ids.map(id => art === "slot" ? getSlotEintrag("gespeichert", id)?.name : listenIndex.find(l => l.id === id)?.name).filter(Boolean);
        const was = art === "slot" ? (ids.length === 1 ? "Konfiguration" : "Konfigurationen") : (ids.length === 1 ? "Liste" : "Listen");
        return (
          <div className="overlay" onClick={() => setAuswahlLoeschen(null)}>
            <div className="modal" data-auswahl-loeschen={art} onClick={e => e.stopPropagation()}>
              <div className="modal-titel">{ids.length} {was} löschen?</div>
              <p style={{fontSize:"0.9rem", color:"var(--text)", lineHeight:1.5, margin:"0 0 8px"}} data-auswahl-namen>{namen.map(n => `„${n}“`).join(", ")}</p>
              <p style={{fontSize:"0.85rem", color:"var(--text2)", lineHeight:1.5}}>
                {art === "slot" ? "Gespeicherte Einstellungen, Session- und Lernfortschritt dieser Einträge gehen verloren. Die Listen und Scores bleiben."
                  : "Alle Vokabeln und Scores dieser Listen werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden."}
              </p>
              {art === "liste" && (
                <button className="btn btn-ghost btn-sm" style={{marginBottom:10}} onClick={() => { setAuswahlLoeschen(null); sichereAlles(); }}
                  {...tt("Erst alles in einer Datei sichern; danach kannst du die Auswahl wieder lang drücken und löschen")}>💾 Vorher sichern</button>
              )}
              <div className="modal-actions">
                <button {...tt("Schließen, ohne etwas zu löschen")} className="btn btn-ghost" onClick={() => setAuswahlLoeschen(null)}>Abbrechen</button>
                <button {...tt(`${ids.length} ${was} endgültig löschen`)} className="btn btn-danger" data-auswahl-loeschen-ok onClick={loescheAuswahl}>Löschen</button>
              </div>
            </div>
          </div>
        );
      })()}
      {loescheSlotNr !== null && (
        <div className="overlay" onClick={() => setLoescheSlotNr(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Slot löschen?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
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
      })()}
      {sessionUeberschreibenModal && (
        <div className="overlay" onClick={() => setSessionUeberschreibenModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Session überschreiben?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
              Es gibt bereits eine aktive Session mit einer anderen Konfiguration. Soll diese überschrieben werden?
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne zu starten")} className="btn btn-ghost" onClick={() => setSessionUeberschreibenModal(false)}>Abbrechen</button>
              <button {...tt("Bisherige Session verwerfen und neu beginnen")} className="btn btn-primary" onClick={() => { setSessionUeberschreibenModal(false); starteQuiz(true); }}>Neu starten</button>
            </div>
          </div>
        </div>
      )}
      {modal === "lernen-einst" && (() => {
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
      })()}
      {modal === "stufen-regeln" && (
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
      )}
      {modal === "vorlesen" && (
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
      )}
      {modal === "klammern" && aktiveListe && (() => {
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
      })()}
      {modal === "schema-umbenennen" && schemaMenueId && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Farbschema umbenennen</div>
            <input {...ttFeld("Neuer Name des Farbschemas")} className="inp" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }} />
            {modalFehler && <div className="fehler">{modalFehler}</div>}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Neuen Namen speichern")} className="btn btn-primary" onClick={() => {
                const name = modalInput.trim();
                if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
                if ([...FARB_VORLAGEN, ...eigeneSchemata].some(x => x.id !== schemaMenueId && x.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
                aendereEigenesSchema(schemaMenueId, () => ({ name })); setModal(null); setSchemaMenueId(null);
              }}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {modal === "schema-loeschen" && schemaMenueId && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Farbschema löschen?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>„{eigeneSchemata.find(x => x.id === schemaMenueId)?.name}“ wird gelöscht. Ist es gerade gewählt, gilt danach wieder „Natur“.</p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu löschen")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Farbschema endgültig löschen")} className="btn btn-danger" onClick={() => loescheSchema(schemaMenueId)}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "loeschen" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Liste löschen?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
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
      )}

      {modal === "saetze" && satzFenster && (() => {
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
      })()}
      {modal === "stimmen-hilfe" && (() => {
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
      })()}
      {modal === "kopier-export" && kopierExportIds && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" data-kopier-export onClick={e => e.stopPropagation()}>
            <div className="modal-titel">📤 Exportieren</div>
            {renderExportArtWahl(kopierExportIds, "kopieren")}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne zu kopieren")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Vokabeln als Text in die Zwischenablage kopieren")} className="btn btn-primary" data-kopier-export-ok
                onClick={async () => { await kopiereListen(kopierExportIds); setTimeout(() => setModal(m => m === "kopier-export" ? null : m), 800); }}>
                {exportKopiert ? "✓ Kopiert" : "📋 Kopieren"}</button>
            </div>
          </div>
        </div>
      )}
      {modal === "datei-export" && dateiExport && (
        <div className="overlay" onClick={() => { setModal(null); setDateiExport(null); }}>
          <div className="modal" data-datei-export={dateiExport.art} onClick={e => e.stopPropagation()}>
            <div className="modal-titel">{dateiExport.art === "sicherung" ? "Alles sichern" : "📤 Exportieren"}</div>
            {dateiExport.art === "sicherung"
              ? <p style={{fontSize:"0.85rem", color:"var(--text2)", marginBottom:14}}>Listen mit Scores, Einstellungen, Farben und gespeicherte Quiz in einer Datei.</p>
              : renderExportArtWahl(dateiExport.ids, "txt")}
            {renderExportNamensFeld(bestaetigeDateiExport)}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne zu speichern")} className="btn btn-ghost" onClick={() => { setModal(null); setDateiExport(null); }}>Abbrechen</button>
              <button {...tt(dateiExport.art === "sicherung" ? "Sicherungsdatei mit diesem Namen erstellen" : "TXT-Datei mit diesem Namen erstellen")} className="btn btn-primary" data-datei-export-ok
                onClick={bestaetigeDateiExport}>{dateiExport.art === "sicherung" ? "Sichern" : "Exportieren"}</button>
            </div>
          </div>
        </div>
      )}

      {zuklappHinweis && !quiz && (
        <button {...tt("Bereich zuklappen")} onClick={klappeFreieZu}
          style={{position:"fixed", left:"50%", bottom:16, transform:"translateX(-50%)", zIndex:50,
            background:"var(--haupt)", color:"var(--auf-haupt)", border:"none", borderRadius:20, padding:"7px 14px",
            fontSize:"0.75rem", fontWeight:600, fontFamily:"inherit", boxShadow:"0 2px 10px rgba(0,0,0,0.2)", cursor:"pointer", whiteSpace:"nowrap"}}>
          ▲ Weiter ziehen oder hier tippen zum Zuklappen
        </button>
      )}
    </>
  );
}
