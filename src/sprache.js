import { ohneHinweis } from "./quiz.jsx";


// Kürzel für Namensvorschläge (Quiz speichern)
export const SPRACH_KUERZEL = { en: "Engl", fr: "Frz", es: "Span", it: "Ital", la: "Lat", nl: "Ndl", pt: "Port", ru: "Russ", tr: "Türk", pl: "Poln", de: "Deu" };
// ── Text-to-Speech ─────────────────────────────────────────────────────────
// Sprache der Fremdsprach-Spalten (E1–E3) pro Liste; fehlt sie, gilt "en"
export const SPRACHEN = [
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
export function sprachInfo(code) { return SPRACHEN.find(s => s.code === code) || SPRACHEN[0]; }
export function listeSprache(l) { return l?.sprache || "en"; }
// Erste Sprache, deren Stichwort in einem Spaltennamen vorkommt (Import)
export function erkenneSprache(headerNamen) {
  const low = headerNamen.map(n => (n || "").toLowerCase());
  return SPRACHEN.find(s => s.keys.some(k => low.some(n => n.includes(k))))?.code || null;
}
export function spalteLang(typ, sprache) {
  if (typ.startsWith('E')) return sprachInfo(sprache).tts;
  if (typ.startsWith('D')) return 'de-DE';
  return 'de-DE';
}
// Stimme ausdrücklich zur Sprache wählen: Manche Systeme (Chrome/Android) ignorieren sonst lang und
// lesen mit der zuletzt benutzten Stimme – dann klingt ein deutsches Wort französisch
export let STIMMEN = [];
export const ladeStimmen = () => { try { STIMMEN = window.speechSynthesis?.getVoices() || []; } catch { STIMMEN = []; } };
if (typeof window !== "undefined" && window.speechSynthesis) {
  ladeStimmen();
  window.speechSynthesis.addEventListener?.("voiceschanged", ladeStimmen);
}
// Vorlesen je Gerät: { sprachen: { de: voiceURI }, variante: { en: "en-GB" }, aus: { en: [voiceURI…] },
// tempoSprache: { de: 1.2 }, tempo: Gesamt-Multiplikator } – fehlt etwas: automatisch
export const STIMMEN_KEY = "geraet_stimmen";
export let STIMMEN_WAHL = (() => { try { return JSON.parse(localStorage.getItem(STIMMEN_KEY)) || {}; } catch { return {}; } })();
export function setzeStimmenWahl(neu) { STIMMEN_WAHL = neu; try { localStorage.setItem(STIMMEN_KEY, JSON.stringify(neu)); } catch { /* egal */ } }
// Spaß-/Effekt-Stimmen (iOS/macOS) nicht anbieten
// Spaß- und Roboterstimmen (Apple) nie anbieten: am Namen und an der Kennung (voiceURI) erkannt –
// com.apple.speech.synthesis.voice.* = Spaß-/Altstimmen (Bahh, Bells, Zarvox …), com.apple.eloquence.* = Roboterstimmen (Eddy, Flo, Grandma …)
export const STIMMEN_NOVELTY = /bad news|boing|bubbles|cellos|good news|jester|organ|trinoids|whisper|zarvox|albert|deranged|fred|hysterical|junior|kathy|princess|ralph|wobble|superstar|bells|bahh/i;
export const STIMMEN_ROBOTER = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
export const STIMMEN_URI_AUS = /com\.apple\.speech\.synthesis\.voice\.|com\.apple\.eloquence\./i;
export const istSpassStimme = v => STIMMEN_NOVELTY.test(v.name || "") || STIMMEN_ROBOTER.test(v.name || "") || STIMMEN_URI_AUS.test(v.voiceURI || "");
export const stimmenFuerSprache = basis => { if (!STIMMEN.length) ladeStimmen(); return STIMMEN.filter(v => (v.lang || "").toLowerCase().replace("_", "-").split("-")[0] === basis && !istSpassStimme(v)); };
export const normLang = x => (x || "").toLowerCase().replace("_", "-");
// Varianten einer Sprache (en-GB, en-US …), die das Gerät hat
export const stimmenVarianten = basis => [...new Set(stimmenFuerSprache(basis).map(v => normLang(v.lang)))].sort();
// Stimmen der gewählten Variante ohne die abgeschalteten
export const aktiveStimmen = basis => {
  const vr = STIMMEN_WAHL.variante?.[basis], aus = STIMMEN_WAHL.aus?.[basis] || [];
  return stimmenFuerSprache(basis).filter(v => (!vr || normLang(v.lang) === vr) && !aus.includes(v.voiceURI));
};
export const gewaehlteStimme = basis => { const uri = STIMMEN_WAHL.sprachen?.[basis]; return uri ? aktiveStimmen(basis).find(v => v.voiceURI === uri) || null : null; };
// Sprechtempo: Tempo der Sprache × Gesamt-Tempo
export const sprechTempo = basis => (STIMMEN_WAHL.tempoSprache?.[basis] || 1) * (STIMMEN_WAHL.tempo || 1);
// nächste aktive Stimme der Sprache wird die eingestellte (für „🔁 Stimme“)
export function naechsteStimme(basis) {
  const aktiv = aktiveStimmen(basis);
  if (aktiv.length < 2) return aktiv[0] || null;
  const jetzt = gewaehlteStimme(basis) || stimmeFuer(basis);
  const neu = aktiv[(aktiv.indexOf(jetzt) + 1) % aktiv.length];
  setzeStimmenWahl({ ...STIMMEN_WAHL, sprachen: { ...(STIMMEN_WAHL.sprachen || {}), [basis]: neu.voiceURI } });
  return neu;
}
// Geschlecht bekannter Stimmnamen (iOS/macOS, Windows, einige Android) – unbekannt: nichts anzeigen
export const STIMMEN_W = new Set("anna helena petra marlene vicki katja hedda katharina sabina kate samantha karen moira tessa fiona veena serena allison ava susan victoria zoe nicky joelle amélie amelie audrey aurélie aurelie marie virginie julie hortense monica mónica paulina marisol alice federica paola elsa ellen claire joana luciana catarina milena katya yelda zosia ewa agata laura isabela francesca sara lekha grandma flo sandy shelley martha kathy princess hazel zira linda heather".split(" "));
export const STIMMEN_M = new Set("markus martin viktor yannick stefan daniel alex fred aaron arthur oliver gordon lee rishi tom evan nathan thomas jacques nicolas jorge diego juan carlos luca paolo xander felipe yuri maged cem krzysztof guy george david mark ryan eddy reed rocko grandpa ralph albert junior jamie aidan malcolm".split(" "));
export const stimmeGeschlecht = v => { const w = (v?.name || "").toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean);
  return w.some(x => STIMMEN_W.has(x)) ? "♀" : w.some(x => STIMMEN_M.has(x)) ? "♂" : ""; };
// Variante als Text mit Flagge: en-GB → 🇬🇧 Britisch
export const VARIANTE_NAMEN = { GB: "Britisch", US: "Amerikanisch", AU: "Australisch", IE: "Irisch", IN: "Indisch", ZA: "Südafrikanisch", NZ: "Neuseeland", CA: "Kanada",
  FR: "Frankreich", BE: "Belgien", CH: "Schweiz", DE: "Deutschland", AT: "Österreich", ES: "Spanien", MX: "Mexiko", AR: "Argentinien", CO: "Kolumbien",
  PT: "Portugal", BR: "Brasilien", IT: "Italien", NL: "Niederlande", RU: "Russland", TR: "Türkei", PL: "Polen", SG: "Singapur" };
export const varianteText = vr => { const r = (vr.split("-")[1] || "").toUpperCase(); const flagge = r.length === 2 ? String.fromCodePoint(...[...r].map(c => 127397 + c.charCodeAt(0))) : "";
  return `${flagge} ${VARIANTE_NAMEN[r] || r || vr}`.trim(); };
export const STIMMEN_PROBE = { de: "Hallo! So klingt diese Stimme.", en: "Hello! This is how this voice sounds.", fr: "Bonjour ! Voici comment sonne cette voix.",
  es: "¡Hola! Así suena esta voz.", it: "Ciao! Ecco come suona questa voce.", nl: "Hallo! Zo klinkt deze stem.", pt: "Olá! É assim que esta voz soa.",
  ru: "Привет! Так звучит этот голос.", tr: "Merhaba! Bu ses böyle duyuluyor.", pl: "Cześć! Tak brzmi ten głos." };
export function stimmeFuer(lang) {
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
export function aeusserung(text, lang, stimme = null) {
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
// Vorlesen: alle Teile („/“ = mehrere Antworten, „;“ = Alternativen) nacheinander – zwischen den Äußerungen entsteht eine kurze Pause
export function vorleseTeile(text) { return String(text || "").split(/\s*[/;]\s*/).map(s => s.trim()).filter(Boolean); }
export function sprich(text, lang) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  vorleseTeile(text).forEach(x => window.speechSynthesis.speak(aeusserung(x, lang)));
}
// Auto-Vorlesen in der Abfrage: läuft gerade etwas (z. B. die Antwort beim Weiterblättern), wird angehängt statt abgebrochen
export function sprichAuto(text, lang) {
  const s = window.speechSynthesis;
  if (!text || !s) return;
  if (!s.speaking || s.pending) s.cancel();
  vorleseTeile(text).forEach(x => s.speak(aeusserung(x, lang)));
}
