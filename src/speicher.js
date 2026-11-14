
// ── Storage ────────────────────────────────────────────────────────────────
export const SK = {
  einstellungen: "vokabel_einstellungen",
  listenIndex:   "vokabel_listen_index",
  listenOrdner:  "vokabel_listen_ordner",   // 193: [{ id, name, platz, ordner? }] – Listen tragen ordner: id im Index
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
export function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    const daten = JSON.parse(v);
    return key.startsWith("vokabel_liste_") ? ergaenzeSpalten(daten) : daten;
  }
  catch { return fallback; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export function lsDel(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ── Defaults ───────────────────────────────────────────────────────────────
export function defaultEinstellungen() { return { modus: "schwer", autoplay: false, vorlesen: ["E1"], gelerntSchwelle: 3, sprache: "alle" }; }
export function defaultSessionSlots() {
  return [{ slot: 6, name: "Zuletzt verwendet", konfiguration: null, fortschritt: null }];
}
export const BLITZ_MS = 700;
export const WAHL_ZU_MS = 300;   // Auswahl in einem aufgeklappten Bereich: so lange sieht man die neue Wahl (grün), dann klappt er zu   // ms: Aufleuchten nach Auswahl / Zuklappen
export const SLOT_ZU_VERZOEGERUNG = 400;   // ms: gewählte Kachel kurz sichtbar, dann klappt die Auswahl zu
export function defaultSlots() { return { verlauf: [], gespeichert: [] }; }
export function neuerSlotId(typ) { return `${typ}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
export function formatSlotDatum() {
  const n = new Date();
  return n.toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'2-digit'})   // 213
    + ', ' + n.toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'});
}
export function neueListeObjekt(id, name) {
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
export function ergaenzeSpalten(liste) {
  if (!liste?.spalten) return liste;
  const fehlt = TYPEN.filter(t => !liste.spalten[t]);
  if (!fehlt.length) return liste;
  const spalten = { ...liste.spalten };
  fehlt.forEach(t => { spalten[t] = { name: "", aktiv: false }; });
  return { ...liste, spalten };
}

// ── Info-Seitenumbruch ─────────────────────────────────────────────────────
export function splitInSeiten(text, maxChars = 120) {
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

// ── Datum-Formatierung ─────────────────────────────────────────────────────
export function formatDatum(isoString) {
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
export async function leseDateiAlsText(file) {
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
export const SICHERUNG_OHNE = [SK.letzteSicherung, SK.sicherungBasis, SK.sicherungSpaeter];
export const SICHERUNG_TAGE = [0, 3, 7, 14, 30];   // Erinnerung: 0 = aus
export const SICHERUNG_TAG_MS = 24 * 3600 * 1000;
export function erstelleSicherung() {
  const daten = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("vokabel_") || SICHERUNG_OHNE.includes(k)) continue;
    try { daten[k] = JSON.parse(localStorage.getItem(k)); } catch { daten[k] = localStorage.getItem(k); }
  }
  return { vokabelAppSicherung: 1, erstellt: Date.now(), daten };
}
export const istSicherung = o => !!o && typeof o === "object" && o.vokabelAppSicherung && o.daten && typeof o.daten === "object";
export function listenAusSicherung(sich) {
  const idx = Array.isArray(sich.daten[SK.listenIndex]) ? sich.daten[SK.listenIndex] : [];
  const listen = Object.entries(sich.daten).filter(([k]) => k.startsWith("vokabel_liste_")).map(([, l]) => l).filter(l => l && l.name && l.vokabeln);
  const pos = l => { const i = idx.findIndex(x => x.id === l.id); return i < 0 ? Infinity : i; };
  return listen.sort((a, b) => pos(a) - pos(b));
}
// Ersetzt den ganzen Stand durch die Sicherung (danach neu laden)
export function stelleSicherungWiederHer(sich) {
  const alt = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith("vokabel_") && !SICHERUNG_OHNE.includes(k)) alt.push(k); }
  alt.forEach(k => localStorage.removeItem(k));
  Object.entries(sich.daten).forEach(([k, v]) => { if (k.startsWith("vokabel_") && !SICHERUNG_OHNE.includes(k)) localStorage.setItem(k, JSON.stringify(v)); });
  localStorage.setItem(SK.letzteSicherung, JSON.stringify(sich.erstellt || Date.now()));
}
export const formatTag = ts => new Date(ts).toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'});

export const TYPEN = ["E1","E2","E3","D1","D2","i1","i2"];
export const APP_VERSION = (() => {
  const d = new Date(__BUILD_TIME__);
  return d.toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'})
    + ' ' + d.toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'});
})();
