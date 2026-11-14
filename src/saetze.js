import { ohneHinweis } from "./quiz.jsx";
import { TYPEN } from "./speicher.js";

// Beispielsätze: Schlüssel „listeId__vokId“ → [{ s: Satz mit *Wort*, u: Übersetzung }]
export const SATZ_DB = "vokabel_saetze", SATZ_STORE = "saetze";
export const SATZ_ANZAHLEN = [1, 3, 6, 10];
export const SATZ_PORTION = { 1: 120, 3: 50, 6: 25, 10: 15 };   // Vokabeln je KI-Antwort
export let satzDbPromise = null;
export function satzDb() {
  if (!satzDbPromise) satzDbPromise = new Promise((res, rej) => {
    const r = indexedDB.open(SATZ_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(SATZ_STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return satzDbPromise;
}
export async function saetzeLaden(listeId) {
  try {
    const db = await satzDb(), praefix = `${listeId}__`;
    return await new Promise(res => {
      const erg = {}, req = db.transaction(SATZ_STORE).objectStore(SATZ_STORE).openCursor(IDBKeyRange.bound(praefix, praefix + "\uffff"));
      req.onsuccess = () => { const c = req.result; if (c) { erg[c.key] = c.value; c.continue(); } else res(erg); };
      req.onerror = () => res(erg);
    });
  } catch { return {}; }
}
// 202: Anzahl der Sätze je Vokabel über alle Listen: { listeId: { vokId: n } }
export async function satzStandAlle() {
  try {
    const db = await satzDb();
    return await new Promise(res => {
      const erg = {}, req = db.transaction(SATZ_STORE).objectStore(SATZ_STORE).openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { const [l, v] = String(c.key).split("__"); (erg[l] = erg[l] || {})[v] = Array.isArray(c.value) ? c.value.length : 0; c.continue(); } else res(erg); };
      req.onerror = () => res(erg);
    });
  } catch { return {}; }
}
// 202: Sätze (gesamt) und Synonyme (gesamt) einer Liste – nur vorhandene Vokabeln zählen
export function listenInhalt(liste, satzStand) {
  if (!liste) return { saetze: 0, synonyme: 0 };
  const st = satzStand?.[liste.id] || {};
  const synSp = TYPEN.filter(t => t.startsWith("i") && liste.spalten[t]?.aktiv && istSynonymSpalte(liste.spalten[t]));
  let saetze = 0, synonyme = 0;
  liste.vokabeln.forEach(v => { saetze += st[v.id] || 0; synSp.forEach(t => { synonyme += synonymeAus(v[t]?.wert).length; }); });
  return { saetze, synonyme };
}
export async function saetzeSpeichern(eintraege) {
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
export function satzPrompt(sprachName, zeilen, n, alsDatei = false) {
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
// Synonyme ergänzen: je Vokabel eine Zeile „ID // Synonym1, Synonym2“
export function synPrompt(sprachName, zeilen, alsDatei = false) {
  return [
    ...(alsDatei ? [`Erstelle eine Textdatei (.txt, UTF-8) zum Herunterladen. Schreibe den Inhalt NICHT in den Chat, sondern nur in die Datei.`, ``] : []),
    `Nenne für jede der folgenden ${sprachName}-Vokabeln 2–4 gebräuchliche Synonyme auf ${sprachName} (Schulniveau; Wörter bzw. kurze Wendungen mit gleicher Bedeutung, keine Übersetzungen). Gibt es kein passendes Synonym, lass die Zeile weg.`,
    `${alsDatei ? "Die Datei enthält NUR Zeilen" : "Antworte NUR mit Zeilen"} in genau diesem Format – eine Zeile pro Vokabel, Synonyme mit Komma getrennt, ohne Nummerierung, ohne Überschriften, ohne Leerzeilen:`,
    `ID // Synonym1, Synonym2`,
    ``,
    `Vokabeln (ID // ${sprachName} // Deutsch):`,
    ...zeilen,
  ].join("\n");
}
export function synonymeAusAntwort(text) {
  const erg = {};
  (text || "").split(/\r?\n/).forEach(z => {
    const m = z.match(/^\s*(\d+)\s*(?:\/\/|\|)\s*(.+?)\s*$/);
    if (m) erg[m[1]] = m[2].replace(/\s*(?:\/\/|\|)\s*/g, ", ");
  });
  return erg;
}
// Info-Spalte mit Synonymen: ausdrücklich eingestellt (art) oder – ohne Angabe – am Namen erkannt (KI-Prompt „Synonyme“)
export function istSynonymSpalte(s) { return !!s && (s.art ? s.art === "synonyme" : /synonym/i.test(s.name || "")); }
export function synonymeAus(text) { return String(text || "").split(/\s*[,;/]\s*/).map(x => ohneHinweis(x).trim()).filter(Boolean); }
// Kurzer Begleitsatz zur Prompt-Datei (die KI braucht eine Nachricht zur angehängten Datei)
export const SATZ_BEGLEITSATZ = "Bitte führe die Anweisungen in der angehängten Datei aus.";
// KI-Antwort lesen: „ID // Satz // Übersetzung“ (auch mit | als Trenner)
export function saetzeAusAntwort(text) {
  const erg = {};
  (text || "").split(/\r?\n/).forEach(z => {
    const m = z.match(/^\s*(\d+)\s*(?:\/\/|\|)\s*(.+?)\s*(?:\/\/|\|)\s*(.+?)\s*$/);
    if (m && m[2].includes("*")) (erg[m[1]] ||= []).push({ s: m[2], u: m[3] });
  });
  return erg;
}
