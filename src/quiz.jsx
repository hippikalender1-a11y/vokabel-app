import { SK, TYPEN, lsGet, lsSet } from "./speicher.js";


// ── Quiz-Feedback ───────────────────────────────────────────────────────────
// Quiz-Durchlauf geschafft: große Überschrift (zufällig, bleibt für denselben Durchlauf gleich)
export const JUBEL = ["Geschafft!", "Super gemacht!", "Quiz gemeistert!", "Stark!", "Ziel erreicht!", "Bravo!", "Klasse!", "Alles durch!"];
export const jubelGemerkt = { key: null, text: "" };
export function jubelText(key) {
  if (jubelGemerkt.key !== key) { jubelGemerkt.key = key; jubelGemerkt.text = JUBEL[Math.floor(Math.random() * JUBEL.length)]; }
  return jubelGemerkt.text;
}

export function getQuizFeedback(richtig, gesamt) {
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

// ── MC-Buttons generieren ─────────────────────────────────────────────────
// Multiple Choice: immer 4 Antworten (2×2-Raster) – alle richtigen Teile, mit falschen aufgefüllt
export const MC_ANZAHL = 4;
export function generiereButtons(vokabeln, aktVok, antwortTyp, modus) {
  if (modus === "artikel") {
    const info = artikelInfo(aktVok[antwortTyp]?.wert, vokSprache(aktVok));
    if (info) return { buttons: info.kategorien.map(k => ({ text: k, korrekt: k === info.kat, status: "neutral" })), richtig: [info.kat] };
  }
  const eineAlt = x => { const a = alternativen(x); return a.length ? a[Math.floor(Math.random() * a.length)] : x; };
  const rohTeile = (aktVok[antwortTyp]?.wert || "").split('/').map(s => s.trim()).filter(Boolean);
  const richtigTeile = rohTeile.map(eineAlt);
  const richtigLower = rohTeile.flatMap(alternativen).map(r => r.toLowerCase());
  const nFalsch = Math.max(0, MC_ANZAHL - richtigTeile.length);
  const eigenesFalsch = (aktVok[antwortTyp]?.falsch || []).filter(f => !richtigLower.includes(f.toLowerCase()));
  const gewaehltesFalsch = [...eigenesFalsch].sort(() => Math.random() - 0.5).slice(0, nFalsch);
  if (gewaehltesFalsch.length < nFalsch) {
    const andere = vokabeln
      .filter(v => v.id !== aktVok.id && v[antwortTyp])
      .flatMap(v => (v[antwortTyp].wert || "").split('/').map(s => s.trim()).filter(Boolean).map(eineAlt))
      .filter(a => !richtigLower.includes(a.toLowerCase()) && !gewaehltesFalsch.includes(a));
    const unique = [...new Set(andere)].sort(() => Math.random() - 0.5);
    gewaehltesFalsch.push(...unique.slice(0, nFalsch - gewaehltesFalsch.length));
  }
  const alle = [
    ...richtigTeile.map(t => ({ text: t, korrekt: true, status: "neutral" })),
    ...gewaehltesFalsch.map(t => ({ text: t, korrekt: false, status: "neutral" })),
  ].sort(() => Math.random() - 0.5);
  return { buttons: alle, richtig: richtigTeile };
}
// Reihenfolge der Abfrage (Quiz, Diktat, Lernen): Schlechteste / Zufällig / Listen-Nr., ggf. unbeantwortete zuerst
export function ordneVokabeln(voks, scoreFeld, reihenfolge, unbeantwortet) {
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
export const LERNEN_STANDARD = { aktiv: false, zuerst: "fremd", pauseWort: 1, pauseUeb: 1, pauseInfo: 3, info: true,
  vorlesen1: true, vorlesen2: false, vorlesen3: false, infoSprache: "fremd", quizStufe: "ohne", einstOffen: false };
export const LERNEN_TIPPEN = 10;   // Regler ganz rechts: nicht weiterlaufen, sondern auf Antippen warten
// geschätzte Lesezeit (ohne Vorlesen), etwa Sprechtempo: ~14 Zeichen je Sekunde
export const lernLesezeit = text => Math.max(600, 400 + (text || "").length / 14 * 1000);

export const BLITZ_SEKUNDEN = 60;
export const REKORDE_KEY = "vokabel_rekorde";   // Rekorde Blitzrunde / Serie je Quiz bzw. Liste
// Antwortarten einer Spalte: eine (Text) oder mehrere (Liste – je Frage wird zufällig eine gewählt)
// Start-Knopf im Quiz-Tab: nennt die gewählte Abfrageart
export const START_TEXT = { uebersetzung: "Übersetzung starten", diktat: "Diktat starten", akzente: "Akzente starten" };
export const MODI_REIHENFOLGE = ["karte", "mc", "hoeren", "tippen", "puzzle", "luecke", "artikel", "satzfinden", "lueckensatz", "satzbauen", "akzent", "zuordnung", "memory"];
// Satz-Arten brauchen Beispielsätze (SATZ_CACHE, aus IndexedDB geladen); ohne Sätze wird eine andere Art gezogen
export const SATZ_ARTEN = ["satzfinden", "lueckensatz", "satzbauen"];
export let SATZ_CACHE = {};
export const hatSaetze = vok => (SATZ_CACHE[vok?.id] || []).length > 0;
// Satz für eine Frage (gleicher Satz beim Neuzeichnen): Wörter mit Satzzeichen, markiertes Wort, Übersetzung
export function satzFuer(vok, seed) {
  const liste = SATZ_CACHE[vok?.id] || [];
  if (!liste.length) return null;
  const x = liste[Math.floor(zufallMitSeed(seed)() * liste.length)];
  const woerter = x.s.replace(/\*([^*]+)\*/g, (m, w) => `*${w.replace(/\s+/g, "\u00a0")}*`).split(/\s+/).filter(Boolean)
    .map(w => ({ text: w.replace(/\*/g, "").replace(/\u00a0/g, " "), ziel: w.includes("*"), kern: (w.match(/\*([^*]+)\*/) || [])[1]?.replace(/\u00a0/g, " ") || null }));
  const form = (x.s.match(/\*([^*]+)\*/) || [])[1] || "";
  return { satz: x.s.replace(/\*/g, ""), woerter, form, ueb: x.u };
}
// Runden-Arten: eine Ziehung startet eine Runde mit mehreren Vokabeln
export const RUNDEN_ARTEN = ["zuordnung", "memory"];
export const istRunde = m => RUNDEN_ARTEN.includes(m);
export const istMC = m => m === "mc" || m === "hoeren" || m === "artikel";   // „Hören“ = MC mit verdeckter Frage, „Artikel“ = MC mit den Artikeln
// Artikel je Sprache: Kategorien (Knöpfe) und welche Artikel dazu gehören; „l'“ u. Ä. verraten das Geschlecht nicht
export const ARTIKEL_KAT = {
  fr: { kat: ["le", "la"], map: { le: "le", un: "le", la: "la", une: "la" } },
  es: { kat: ["el", "la"], map: { el: "el", un: "el", la: "la", una: "la" } },
  it: { kat: ["il / lo", "la"], map: { il: "il / lo", lo: "il / lo", un: "il / lo", uno: "il / lo", la: "la", una: "la" } },
  pt: { kat: ["o", "a"], map: { o: "o", um: "o", a: "a", uma: "a" } },
  nl: { kat: ["de", "het"], map: { de: "de", het: "het" } },
  de: { kat: ["der", "die", "das"], map: { der: "der", die: "die", das: "das" } },
};
export function artikelInfo(wert, sprache) {
  const def = ARTIKEL_KAT[sprache];
  if (!def) return null;
  const m = ohneHinweis((wert || "").split("/")[0]).trim().match(/^(\S+)\s+(.+)$/);
  const kat = m && def.map[m[1].toLowerCase()];
  return kat ? { kat, rest: m[2], kategorien: def.kat } : null;
}
// Sprache einer Vokabel aus ihrer Liste (Index im Speicher)
export function vokSprache(vok) {
  const id = vok?._listeId;
  if (!id) return null;
  try { return (JSON.parse(localStorage.getItem("vokabel_listen_index")) || []).find(l => l.id === id)?.sprache || "en"; } catch { return null; }
}
export const modiVon = m => Array.isArray(m) ? m : [m || STANDARD_ANTWORT_MODUS];
// je Frage und Spalte: aus mehreren angehakten Antwortarten gleich verteilt eine wählen;
// Akzente nur bei Wörtern mit Akzent (und eingeschalteten Akzenten der Sprache)
// Gewichtung der Antwortarten beim Mischen (Prozent, werden auf die angehakten Arten umgerechnet);
// Zuordnung: Anteil je Ziehung (eine Ziehung startet eine Runde mit mehreren Vokabeln)
export const STANDARD_ANTWORT_GEWICHTE = { karte: 50, mc: 30, hoeren: 15, akzent: 30, tippen: 15, puzzle: 15, luecke: 15, artikel: 15, satzfinden: 10, lueckensatz: 15, satzbauen: 10, zuordnung: 5, memory: 5 };

// ── Puzzle / Lücken: gleiche Zufallsfolge je Frage (Seed), damit sich beim Neuzeichnen nichts verschiebt ──
export function zufallMitSeed(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const FESTES_ZEICHEN = /[\s'’\-.,!?;:()]/;   // bleibt stehen (keine Kachel, keine Lücke)
// Lücken: typische Stolperstellen werden bevorzugt (Akzente, Buchstabengruppen, Doppelkonsonanten, stumme Endungen);
// Anzahl wächst mit dem Score (Schwer: eine Stufe mehr); der erste Buchstabe bleibt stehen
export const LUECKEN_GRUPPEN = ["eau", "aux", "eux", "ou", "ai", "ei", "oi", "au", "eu", "ie", "ea", "ee", "oo", "ph", "th", "ch", "sh", "gh", "gn", "qu", "ck", "tion"];
export function lueckenPositionen(wort, score, schwer, seed) {
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
export function puzzleKacheln(wort, seed) {
  const zufall = zufallMitSeed(seed);
  const k = [...wort].map((z, i) => ({ z, i })).filter(x => !FESTES_ZEICHEN.test(x.z));
  for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [k[i], k[j]] = [k[j], k[i]]; }
  return k;
}
export let ANTWORT_GEWICHTE = { ...STANDARD_ANTWORT_GEWICHTE };
export function setzeANTWORT_GEWICHTE(wert) { ANTWORT_GEWICHTE = wert; }   // die Komponente setzt den Wert neu
export const gewichtVon = m => Math.max(0, ANTWORT_GEWICHTE[m] ?? STANDARD_ANTWORT_GEWICHTE[m] ?? 0);
export function gewichtetWaehlen(kand) {
  const summe = kand.reduce((s, m) => s + gewichtVon(m), 0);
  if (summe <= 0) return kand[Math.floor(Math.random() * kand.length)];
  let r = Math.random() * summe;
  for (const m of kand) { r -= gewichtVon(m); if (r < 0) return m; }
  return kand[kand.length - 1];
}
// Richtung je Antwortart: Hören nur mit fremdsprachiger Frage, Lücken nur mit fremdsprachiger Antwort,
// Memory nur, wenn die Fremdsprache unter den Karten liegt (übrige Arten: beide Richtungen)
export function passtRichtung(m, antwortTyp, frageTyp) {
  const fremd = t => !!t && t.startsWith("E");
  if (m === "hoeren") return fremd(frageTyp);
  if (m === "luecke") return fremd(antwortTyp);
  if (m === "memory") return fremd(antwortTyp) || fremd(frageTyp);
  return true;
}
// Antwortarten, die nur mit einer Antwort in der Fremdsprache (E-Spalte) bzw. auf Deutsch Sinn ergeben
export const NUR_FREMD = ["tippen", "akzent", "puzzle", "luecke", "artikel", "satzfinden", "satzbauen", "lueckensatz"];
export const NUR_DEUTSCH = ["hoeren"];
export const modusErlaubt = (antwortTyp, m) => antwortTyp.startsWith("E") ? !NUR_DEUTSCH.includes(m) : !NUR_FREMD.includes(m);
export function loeseSpaltenModusAuf(basis, vok, frageTyp) {
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

export function antwortStatus(klasse) {
  const st = /gelernt-blitz| richtig/.test(klasse) ? "richtig" : / falsch/.test(klasse) ? "falsch" : / aufgedeckt/.test(klasse) ? "aufgedeckt" : null;
  return st ? <span className={`antwort-status ${st}`} data-antwort-status={st} aria-label={st}>{st === "richtig" ? "✓" : st === "falsch" ? "✗" : "👁"}</span> : null;
}

// ── Antwort-Varianten ──────────────────────────────────────────────────────
// Klammerhinweise: Klammern ( ) oder [ ], die frei stehen (Leerzeichen bzw. Anfang/Ende davor und danach),
// z. B. „point (= Punkt)“ oder „Komma (bei Zahlen)“ – werden nicht vorgelesen, nicht verlangt und dezent gezeigt.
// Angehängte Klammern wie „(un)lucky“ gehören zum Wort.
export const HINWEIS_RE = /(^|\s)(\([^()]*\)|\[[^\[\]]*\])(?=\s|$|[,;.!?])/g;
export function ohneHinweis(t) { return (t || "").replace(HINWEIS_RE, "$1").replace(/\s{2,}/g, " ").replace(/\s+([,;.!?])/g, "$1").trim(); }
export function hinweiseAus(t) { return [...(t || "").matchAll(HINWEIS_RE)].map(m => m[2].slice(1, -1).trim()).filter(Boolean); }
// Text mit dezent dargestellten Klammerhinweisen (für die Anzeige)
// 177: nach „/“ ohne Leerzeichen darf umgebrochen werden (unsichtbarer Trennpunkt)
export function umbruch(t) { return (t || "").replace(/\/(?=\S)/g, "/\u200B"); }
export function mitHinweis(t) {
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
export function generiereVarianten(wert) {
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
export function normApostroph(s) { return s.replace(/[’‘ʼ`´]/g, "'"); }
export function ohneAkzente(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
}
// „;“ trennt gleichwertige Alternativen (eine genügt), „/“ trennt Teile, die alle verlangt werden
export function alternativen(t) { return String(t || "").split(";").map(s => s.trim()).filter(Boolean); }
export function ersteAlt(t) { return alternativen(t)[0] || String(t || "").trim(); }
// true = exakt richtig, "akzent" = nur ohne Akzente richtig (nur wenn tolerant), false = falsch; bei Alternativen genügt eine
export function istRichtigeAntwort(eingabe, wert, akzentTolerant = false) {
  const alts = alternativen(wert);
  if (alts.length < 2) return istRichtigeEinzeln(eingabe, wert, akzentTolerant);
  let ergebnis = false;
  for (const w of [wert, ...alts]) { const r = istRichtigeEinzeln(eingabe, w, akzentTolerant); if (r === true) return true; if (r) ergebnis = r; }
  return ergebnis;
}
export function istRichtigeEinzeln(eingabe, wert, akzentTolerant = false) {
  const varianten = generiereVarianten(normApostroph(wert));
  const e = normApostroph(eingabe.toLowerCase().trim());
  if (varianten.includes(e)) return true;
  if (akzentTolerant && varianten.map(ohneAkzente).includes(ohneAkzente(e))) return "akzent";
  return false;
}
// Antwort-Modus, wenn für eine Spalte nichts festgelegt ist (Karte aufdecken)
export const STANDARD_ANTWORT_MODUS = "karte";
export const ANTWORT_MODUS_NAMEN = { karte: "Karte", mc: "MC", hoeren: "Hören", tippen: "Tastatur", puzzle: "Puzzle", luecke: "Lücken", artikel: "Artikel", satzfinden: "Satz finden", lueckensatz: "Lückensatz", satzbauen: "Satz bauen", akzent: "Akzente", zuordnung: "Zuordnung", memory: "Memory" };
// Abfrageart einer Quiz-Konfiguration: eigener Quiz-Fortschritt je Art
export function abfrageArtVon(modus, antwortTypen, spalteModus) {
  if (modus === "diktat") return "diktat";
  return modus === "sequenziell" && antwortTypen?.length > 0 && antwortTypen.every(t => spalteModus?.[t] === "akzent")
    ? "akzente" : "uebersetzung";
}
export const ABFRAGE_ART_NAMEN = { uebersetzung: "Übersetzung", diktat: "Diktat", akzente: "Akzente" };
// Fortschritte eines Slot-Eintrags je Art (altes Format: ein Fortschritt = Übersetzung)
export function slotSFAlle(eintrag) {
  return eintrag?.sessionFortschritte || (eintrag?.sessionFortschritt ? { uebersetzung: eintrag.sessionFortschritt } : {});
}
export function slotKonfigArt(eintrag) { return artVonKonfig(eintrag?.konfiguration); }
// Jede Konfiguration hat für Übersetzung, Diktat und Akzente eigene Einstellungen (konfiguration.arten);
// die oberste Ebene enthält die zuletzt gewählte Art (konfiguration.art). Alte Einträge: Art aus den Einstellungen.
export const QUIZ_ARTEN = ["uebersetzung", "diktat", "akzente"];
export const ART_KURZ = { uebersetzung: "Ü", diktat: "D", akzente: "A" };
export const ART_FELDER = ["quizAusgewaehlt", "quizFrageTyp", "quizAntwortTypenGeordnet", "quizInfoTypenSession", "quizSpalteModus", "quizZeigeInfo",
  "quizModus", "quizReihenfolge", "quizSchlechtesteMaxScore", "quizUnbeantwortetZuerst", "quizDiktatSpalte", "quizDiktatUebersetzung"];
export const artFelderAus = k => Object.fromEntries(ART_FELDER.filter(f => k?.[f] !== undefined).map(f => [f, k[f]]));
export function artVonKonfig(k) {
  return k?.art || abfrageArtVon(k?.quizModus || "sequenziell", k?.quizAntwortTypenGeordnet, k?.quizSpalteModus);
}
// Standard-Einstellungen einer Art für die Spalten der gewählten Listen
export function standardArtEinstellungen(art, spalten) {
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
export function artBereinigt(art, k, spalten) {
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
// Listen-Nummern zu zusammenhängenden Stücken: [1,2,3,7] → [[1,3],[7,7]]; Text „1–3, 7“
export function nrStuecke(nrs) { const r = []; nrs.forEach(n => { const l = r[r.length - 1]; if (l && n === l[1] + 1) l[1] = n; else r.push([n, n]); }); return r; }
export function nrText(nrs) { return nrStuecke(nrs).map(([a, b]) => a === b ? `${a}` : `${a}–${b}`).join(", "); }
// Statistik-Gruppen in Anzeige-Reihenfolge mit Farbe (Kreis, Gruppen-Balken)
export const GRUPPE_BALKEN = [["gelernt", "var(--gelernt)"], ["arbeit", "var(--arbeit)"], ["nie", "var(--nie)"], ["negativ", "var(--negativ)"]];
// Fortschrittsbalken im Statistik-Kopf: eigene Rollen, unabhängig vom Kreisdiagramm
export const FORTSCHRITT_BALKEN = [["gelernt", "var(--fortschritt-gelernt)"], ["arbeit", "var(--fortschritt-arbeit)"], ["nie", "var(--fortschritt-nie)"], ["negativ", "var(--fortschritt-negativ)"]];
// Quiz-Standard: in Paketen abfragen
export const STANDARD_SESSION_MODUS = "pakete";
// Standard-Reihenfolge: schlechteste zuerst, nur Score ≤ 3, unbeantwortete zuerst
export const STANDARD_REIHENFOLGE = "schlechteste";
export const STANDARD_MAX_SCORE = "3";
export const STANDARD_UNBEANTWORTET_ZUERST = { zufall: true, schlechteste: true, listennr: true };
// „Alle“: ein Paket mit allen Vokabeln des Quiz (Fortschritt, Fortsetzen und Auswertung bleiben) – Standard
export const PAKET_ALLE = 10000;
export const STANDARD_PAKET_GROESSE = PAKET_ALLE;
// Abfrage-Ziel-Standard: jede Vokabel wird wiederholt, bis sie 1× richtig war
export const STANDARD_ABFRAGE_ZIEL = "wiederholung";
export const AKZENT_HINWEIS = "Richtig – achte auf die Akzente.";

// Schwierigkeitsgrad: welche Regel in "Einfach" bzw. "Schwer" gilt (in den Einstellungen per Haken änderbar)
export const STUFEN_REGELN = [
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
export const AKZENT_OHNE_ANTEILE = [[0.25, "¼×"], [0.5, "½×"], [1, "1×"], [2, "2×"], ["alle", "∞"]];
export function akzentOhneAnteil(einst) {
  const stufe = einst?.modus === "einfach" ? "einfach" : "schwer";
  const w = einst?.stufen?.[stufe]?.akzentOhneAnteil ?? 1;
  return w === "alle" ? null : w;
}
// Regeln der aktuell gewählten Stufe (gespeicherte Haken, sonst Standard)
// Zuordnung je Stufe: Vokabeln je Runde, Zeitmodus (aus | runde | vokabel), Sekunden je Vokabel
export const ZUORDNUNG_ZEITEN = [["aus", "aus"], ["an", "an"]];
export const ZUORDNUNG_SEKUNDEN = [3, 5, 8, 10, 15];
// Gruppenfarben ohne Rot/Grün (die stehen für falsch/richtig)
export const ZUORDNUNG_FARBEN = ["#4363d8", "#f58231", "#911eb4", "#16a5c4", "#f032e6", "#9a6324", "#000075", "#808000", "#e377c2", "#469990", "#b8860b", "#7f7f7f"];
export const ZUORDNUNG_ZEITFAKTOR = { 2: 1, 3: 1.6, 4: 2 };
export function zuordnungEinst(einst) {
  const stufe = einst?.modus === "einfach" ? "einfach" : "schwer";
  const st = einst?.stufen?.[stufe] || {};
  const zeit = st.zuordnungZeit ?? (stufe === "einfach" ? "aus" : "an");
  return { paare: st.zuordnungPaare ?? (stufe === "einfach" ? 5 : 7), zeit: zeit === "aus" ? "aus" : "an", sek: st.zuordnungSek ?? 8 };
}
export function stufenRegeln(einst) {
  const stufe = einst?.modus === "einfach" ? "einfach" : "schwer";
  return Object.fromEntries(STUFEN_REGELN.map(r => [r.key, einst?.stufen?.[stufe]?.[r.key] ?? r[stufe]]));
}
export const MC_FEHLKLICK_HINWEIS = "Nicht auf Anhieb gefunden – zählt als nicht gewusst.";

// ── Score-Clamp (Anzeige: −10 bis +10) ────────────────────────────────────
export function clampScore(s) { return s ?? 0; }   // 179: Grenzen stecken in der Berechnung (−6 … +6)
// Lernfortschritt in %: jede Vokabel anteilig bis zur Gelernt-Schwelle (negativ/nie = 0)
export function lernProzent(scores, schwelle) {
  if (!scores.length || schwelle <= 0) return 0;
  return scores.reduce((s, sc) => s + Math.min(1, Math.max(0, (sc ?? 0) / schwelle)), 0) / scores.length * 100;
}
// Score für den Gelernt-Status: Diktat hat einen eigenen Fortschritt
export function gelerntScore(v, diktat) { return (diktat ? v.diktatFortschritt?.score : v.fortschritt?.score) ?? -Infinity; }

// ── Gelernt-Stufen (157) ───────────────────────────────────────────────────
// Score 3 = gelernt (Stufe 1, Schwelle fest). Normales Üben hebt nicht darüber. Ist eine gelernte Vokabel nach dem Abstand ihrer Stufe
// fällig und wird gewusst → +1 = nächste Stufe (bis Stufe 4 = Score 6). Nicht gewusst → −1 (ggf. Stufe zurück, unter 3 nicht mehr gelernt).
// Gewusst, aber nicht fällig: Score bleibt, Zähler „zusätzlich gewusst“ (extraGewusst) +1.
export const GELERNT_SCHWELLE = 3, MAX_STUFE = 4;
export const STANDARD_WIEDERHOL_TAGE = [3, 10, 30, 60];   // Stufe 1→2, 2→3, 3→4, Stufe 4 prüfen
export const WIEDERHOL_TAGE_WAHL = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90];
export function wiederholTage() { const a = lsGet(SK.einstellungen, {})?.wiederholTage; return Array.isArray(a) && a.length === 4 ? a : STANDARD_WIEDERHOL_TAGE; }
export function stufeVon(score) { return (score ?? -Infinity) >= GELERNT_SCHWELLE ? Math.min(MAX_STUFE, score - GELERNT_SCHWELLE + 1) : 0; }
export function istFaellig(f, jetzt = Date.now()) {
  const st = stufeVon(f?.score);
  if (!st) return false;
  const seit = Date.parse(f.stufeSeit || f.letzteAbfrage || "");
  if (!seit) return false;   // ohne Datum (z. B. importiert) nicht fällig
  return jetzt - seit >= wiederholTage()[st - 1] * 86400000;
}
export function stufenRegel(alt, neu, ereignis) {
  const vorher = alt?.score ?? 0, jetzt = new Date().toISOString();
  if (ereignis === "richtig") {
    if (vorher >= GELERNT_SCHWELLE) {
      if (istFaellig(alt)) { neu.score = Math.min(GELERNT_SCHWELLE + MAX_STUFE - 1, vorher + 1); neu.stufeSeit = jetzt; }
      else { neu.score = vorher; neu.extraGewusst = (alt?.extraGewusst || 0) + 1; }
    } else if (neu.score >= GELERNT_SCHWELLE) { neu.score = GELERNT_SCHWELLE; neu.stufeSeit = jetzt; }
  } else if (neu.score !== vorher) {
    if (neu.score >= GELERNT_SCHWELLE) neu.stufeSeit = jetzt; else delete neu.stufeSeit;
  }
  return neu;
}
// Score als Symbole: 3 Kreise (bis gelernt, je richtiger Antwort) + 3 Rauten (Wiederholungs-Stufen 2–4); negativ: alle leer, erster Kreis rot umrandet
// 180/181: heute (seit Mitternacht) im Quiz abgefragt – letzteAbfrage setzt nur eine Antwort (nicht das Ansehen im Lernen)
export function heuteAbgefragt(f) {
  if (!f?.letzteAbfrage) return false;
  const a = new Date(f.letzteAbfrage), h = new Date();
  return a.getFullYear() === h.getFullYear() && a.getMonth() === h.getMonth() && a.getDate() === h.getDate();
}
// 180: Tagessperre – nur die automatischen Tests (ältere Abläufe mit mehrfachen Runden) schalten sie über einen unsichtbaren Schlüssel ab
// 189: Tagesstand – Anteil der heute abgefragten an dem, was heute ansteht: Gelernte (nicht fällig, heute nicht abgefragt) zählen nicht mit,
// voll also, wenn alles außer den Gelernten heute dran war
export function heuteAnteil(voks, feld, schwelle) {
  const gelerntRuht = v => schwelle > 0 && (v[feld]?.score ?? -Infinity) >= schwelle && !istFaellig(v[feld]);
  const ansteh = voks.filter(v => heuteAbgefragt(v[feld]) || !gelerntRuht(v));
  return ansteh.length ? Math.round(ansteh.filter(v => heuteAbgefragt(v[feld])).length / ansteh.length * 100) : 0;
}
export function tagesSperre() { try { return !localStorage.getItem("vokabel_test_ohne_tagessperre"); } catch { return true; } }
// 172: fällige Vokabeln zwischen die übrigen einstreuen – je Karte mit faelligAnteil() % eine fällige (Reihenfolge je Teil bleibt)
export const STANDARD_FAELLIG_ANTEIL = 30;
export const FAELLIG_ANTEIL_WAHL = [0, 10, 20, 30, 50, 70, 100];
export function faelligAnteil() { const a = lsGet(SK.einstellungen, {})?.faelligAnteil; return typeof a === "number" ? a : STANDARD_FAELLIG_ANTEIL; }
export function mischeFaellige(voks, feld) {
  const f = voks.filter(v => istFaellig(v[feld])), n = voks.filter(v => !istFaellig(v[feld]));
  if (!f.length || !n.length) return voks;
  const p = Math.max(0, Math.min(100, faelligAnteil())) / 100, erg = [];
  let i = 0, j = 0;
  while (i < f.length && j < n.length) erg.push(Math.random() < p ? f[i++] : n[j++]);
  return [...erg, ...f.slice(i), ...n.slice(j)];
}
export function scoreSymbole(score, klein = false) {
  const s = score ?? 0;
  const st = stufeVon(s);
  const titel = s < 0 ? `${-s} × nicht gewusst` : st ? `Gelernt, Stufe ${st} von ${MAX_STUFE}` : `${Math.max(0, s)} von ${GELERNT_SCHWELLE} bis gelernt`;
  return (
    <span className={`score-symbole${klein ? " klein" : ""}`} data-score-symbole={s} title={titel}>
      {s < 0
        ? [0, 1, 2].map(i => { const tief = s <= -4, n = tief ? -s - 3 : -s;   // 178: rote Umrisse, darunter rot gefüllt
            return <span key={"k" + i} className={`sym kreis${tief || i < n ? " negativ" : ""}${tief && i < n ? " voll" : ""}`}/>; })
        : s <= GELERNT_SCHWELLE
        ? [0, 1, 2].map(i => <span key={"k" + i} className={`sym kreis${s >= i + 1 ? " voll" : ""}`}/>)
        : [0, 1, 2].map(i => <span key={"r" + i} className={`sym raute${s >= GELERNT_SCHWELLE + i + 1 ? " voll" : ""}`}/>)}
    </span>
  );
}
// Stufen als Punkte (●●○○) neben dem Score
export function stufenPunkte(score) {
  const st = stufeVon(score);
  return st ? <span className="stufen-punkte" data-stufe={st} title={`Gelernt-Stufe ${st} von ${MAX_STUFE}`}>{"●".repeat(st)}{"○".repeat(MAX_STUFE - st)}</span> : null;
}
// einmalig: Scores über 3 → 3 (Stufe 1); die höheren Stufen verdient man sich über die Wiederholungen
export function negativUmstellen() {   // 179: alte Scores unter −6 (z. B. −100) einmalig auf −6
  try { if (localStorage.getItem("vokabel_negativ_v1")) return; } catch { return; }
  (lsGet(SK.listenIndex, []) || []).forEach(({ id }) => {
    const l = lsGet(SK.liste(id));
    if (!l) return;
    let geaendert = false;
    const vokabeln = l.vokabeln.map(v => {
      const n = { ...v };
      ["fortschritt", "diktatFortschritt", "akzentFortschritt"].forEach(k => {
        if ((v[k]?.score ?? 0) < NEGATIV_MIN) { n[k] = { ...v[k], score: NEGATIV_MIN }; geaendert = true; }
      });
      return n;
    });
    if (geaendert) lsSet(SK.liste(id), { ...l, vokabeln });
  });
  try { localStorage.setItem("vokabel_negativ_v1", "1"); } catch { /* egal */ }
}
export function stufenUmstellen() {
  try { if (localStorage.getItem("vokabel_stufen_v1")) return; } catch { return; }
  (lsGet(SK.listenIndex, []) || []).forEach(({ id }) => {
    const l = lsGet(SK.liste(id));
    if (!l) return;
    let geaendert = false;
    const vokabeln = l.vokabeln.map(v => {
      const n = { ...v };
      ["fortschritt", "diktatFortschritt", "akzentFortschritt"].forEach(k => {
        if ((v[k]?.score ?? 0) > GELERNT_SCHWELLE) { n[k] = { ...v[k], score: GELERNT_SCHWELLE, stufeSeit: v[k].letzteAbfrage || new Date().toISOString() }; geaendert = true; }
      });
      return n;
    });
    if (geaendert) lsSet(SK.liste(id), { ...l, vokabeln });
  });
  try { localStorage.setItem("vokabel_stufen_v1", "1"); } catch { /* egal */ }
}

// ── Scoring ────────────────────────────────────────────────────────────────
// falschAbzug (Regel je Stufe): falsche Antwort −1, sonst bleibt der Score gleich
// 178: Nichtwissen in zwei Stufen – −1…−3 rote Umrisse, −4…−6 rot gefüllt; tiefer nicht. Richtig bei negativem Score:
// eine ganze Stufe hoch (−4…−6 → −3, −1…−3 → 0). 179: kein Streak-Sprung, kein −100 mehr
export const NEGATIV_MIN = -6;
export function negativRegel(alt, neu, ereignis) {
  const vorher = alt?.score ?? 0;
  if (ereignis === "richtig" && vorher < 0) neu.score = vorher <= -4 ? -3 : 0;
  neu.score = Math.max(NEGATIV_MIN, neu.score);
  delete neu.streak; delete neu.aufgedecktStreak;
  return neu;
}
export function berechneNeuenScore(fortschritt, ereignis, modus, falschAbzug = true) {
  const f = fortschritt || { score:0, letzteAbfrage:null };
  const neu = { ...f, letzteAbfrage: new Date().toISOString() };
  if (ereignis === "richtig") neu.score += 1;
  else if (ereignis === "falsch") { if (falschAbzug) neu.score -= 1; }
  else if (ereignis === "aufgedeckt") { if (modus === "schwer") neu.score -= 1; }
  return stufenRegel(fortschritt, negativRegel(fortschritt, neu, ereignis), ereignis);
}
export function speichereScore(liste, vokId, neuFortschritt) {
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
export function diktatHint(wort, aufgedeckt) {
  if (!aufgedeckt) return null;
  return wort.split('').map((ch, i) => i < aufgedeckt ? ch : '·').join(' ');
}
export function berechneDiktatScore(fortschritt, ereignis, falschAbzug = true) {
  const f = fortschritt || { score:0, letzteAbfrage:null };
  const neu = { ...f, letzteAbfrage: new Date().toISOString() };
  if (ereignis === "richtig") neu.score += 1;
  else if (ereignis === "aufgedeckt" && falschAbzug) neu.score -= 1;
  return stufenRegel(fortschritt, negativRegel(fortschritt, neu, ereignis), ereignis);
}
export function speichereDiktatScore(liste, vokId, neuFortschritt) {
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
export function speichereAkzentScore(liste, vokId, neuFortschritt) {
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
export const AKZENT_TABELLE = {
  fr: { a:"aàâ", e:"eéèêë", i:"iîï", o:"oô", u:"uùûü", c:"cç", y:"yÿ" },
  es: { a:"aá", e:"eé", i:"ií", o:"oó", u:"uúü", n:"nñ" },
  de: { a:"aä", o:"oö", u:"uü" },
  it: { a:"aà", e:"eèé", i:"iì", o:"oòó", u:"uù" },
  pt: { a:"aáàâã", e:"eéê", i:"ií", o:"oóôõ", u:"uú", c:"cç" },
};
export const AKZENT_LIGATUREN = { fr: { oe:"œ", ae:"æ" }, de: { ss:"ß" } };
export const LIGATUR_TEILE = { "œ":"oe", "Œ":"OE", "æ":"ae", "Æ":"AE", "ß":"ss" };
export function ohneAkzent(ch) { return ch.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
// Wort → Kacheln { basis, richtig }; eine Ligatur belegt zwei Kacheln (zweite: richtig "")
export function akzentKacheln(wert) {
  const kacheln = [];
  for (const ch of wert || "") {
    const teile = LIGATUR_TEILE[ch];
    if (teile) { kacheln.push({ basis: teile[0], richtig: ch }, { basis: teile[1], richtig: "" }); }
    else kacheln.push({ basis: ohneAkzent(ch) || ch, richtig: ch });
  }
  return kacheln;
}
export function hatAkzente(wert) { return akzentKacheln(wert).some(k => k.richtig !== k.basis); }
// Antwortspalten einer Vokabel: Akzent-Spalten ohne Akzent ggf. auslassen (nieLeer: lieber ungefiltert als gar nichts)
// Mehrere Antworten einer Frage-Runde immer in Spalten-Reihenfolge abfragen: E1, E2, E3, D1, …
export function nachSpaltenReihenfolge(typen) {
  return [...typen].sort((a, b) => TYPEN.indexOf(a) - TYPEN.indexOf(b));
}
export function antwortSpaltenFuer(vok, typen, spalteModus, ohneAkzentAuslassen, nieLeer = false) {
  typen = nachSpaltenReihenfolge(typen);
  if (!ohneAkzentAuslassen || !vok) return typen;
  const r = typen.filter(t => spalteModus?.[t] !== "akzent" || hatAkzente(vok[t]?.wert));
  return nieLeer && r.length === 0 ? typen : r;
}
// Auswahl-Tasten für Kachel i (leer = nicht antippbar)
export function akzentVarianten(kacheln, i, lang) {
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
export const STATISTIK_ARTEN = [["uebersetzung", "Übersetzung"], ["diktat", "Diktat"], ["akzente", "Akzente"]];
// Feld des Scores je Art (an der Vokabel)
export const SCORE_FELD = { uebersetzung: "fortschritt", diktat: "diktatFortschritt", akzente: "akzentFortschritt" };
// Sicht für die Statistik: "fortschritt" ist der Score der gewählten Art; Akzente nur Vokabeln mit Akzent
// Akzente: es zählen nur Wörter mit Akzent (100 % = alle Wörter mit Akzent); dazugenommene Wörter
// ohne Akzent sind reine Übung und fließen nicht in Statistik, Lernfortschritt und Auswertung ein
// Akzente je Sprache (Einstellungen): beim Rendern gesetzt; Vokabel ohne Listen-Bezug → an
export let AKZENTE_FUER_LISTE = () => true;
export function setzeAKZENTE_FUER_LISTE(wert) { AKZENTE_FUER_LISTE = wert; }   // die Komponente setzt den Wert neu
export const hatAkzentWort = (v, listeId = null) => AKZENTE_FUER_LISTE(v?._listeId ?? listeId) && TYPEN.some(t => t.startsWith('E') && hatAkzente(v?.[t]?.wert));
export function statistikSicht(voks, art, listeId = null) {
  if (art === "diktat") return voks.map(v => ({ ...v, fortschritt: v.diktatFortschritt }));
  if (art === "akzente") return voks.filter(v => hatAkzentWort(v, listeId)).map(v => ({ ...v, fortschritt: v.akzentFortschritt }));
  return voks;
}
