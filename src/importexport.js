import { TYPEN, istSicherung, listenAusSicherung } from "./speicher.js";
import { listeSprache, sprachInfo } from "./sprache.js";


// ── KI-Prompt-Generator ────────────────────────────────────────────────────
// Beispielzeile im Prompt je Sprache (Wort, falsche Antworten, Beispielsatz, Synonyme)
export const PROMPT_BEISPIELE = {
  en: { wort:"go",     falsch:["went","goes","go","going"],        satz:"He goes to school every day.",       syn:"start, begin, head" },
  fr: { wort:"aller",  falsch:["allé","va","venir","partir"],      satz:"Je vais à l'école tous les jours.",  syn:"se rendre, partir" },
  es: { wort:"ir",     falsch:["fue","va","venir","salir"],        satz:"Voy a la escuela todos los días.",   syn:"marchar, andar" },
  it: { wort:"andare", falsch:["andato","va","venire","partire"],  satz:"Vado a scuola ogni giorno.",         syn:"recarsi, partire" },
  la: { wort:"ire",    falsch:["it","ivi","venire","currere"],     satz:"Marcus in forum it.",                syn:"vadere, proficisci" },
};
export function generierePrompt(thema, anzahl, falsch, beispiele, synonyme, modus, sprache = "en") {
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
    `- Gibt es mehrere gleichwertige Übersetzungen oder Möglichkeiten, trenne sie mit "; " (z. B. "Hallo!; Servus!") – beim Abfragen genügt eine davon. " / " nur für Formen, die alle zusammen verlangt werden (z. B. "was / were")`,
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
export function generiereExportText(liste) {
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

// JSON-Backup im Text finden (auch wenn davor/danach etwas steht). null = kein JSON; wirft bei kaputtem JSON.
// Gesamtsicherung → ihre Listen, die Sicherung selbst hängt als .sicherung am Ergebnis
export function findeJsonListen(text) {
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
export function istBinaer(text) {
  let steuer = 0;
  for (let i = 0; i < Math.min(text.length, 2000); i++) {
    const c = text.charCodeAt(i);
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 127) steuer++;
  }
  return steuer > 5;
}
export function dateiVorschau(text) {
  const anfang = text.slice(0, 60).replace(/\s+/g, " ").trim();
  return anfang ? `„${anfang}${text.length > 60 ? "…" : ""}“` : "(leer)";
}

// ── Import-Parser ──────────────────────────────────────────────────────────
export function entferneLautsprache(text) {
  // Entfernt phonetische Umschriften in eckigen Klammern, z.B. [ˈwɜːrd] oder [bɪˈɡɪn]
  return text.replace(/\s*\[[^\]]*\]/g, '').trim();
}
export function parseKolumne(teil) {
  const idx = teil.indexOf('||');
  if (idx === -1) return { wert: entferneLautsprache(teil.trim()), falsch: [] };
  const wert = entferneLautsprache(teil.slice(0, idx).trim());
  return { wert, falsch: teil.slice(idx + 2).split('|').map(f => entferneLautsprache(f.trim())).filter(Boolean) };
}
export function parseZeile(zeile) { return zeile.split('//').map(t => parseKolumne(t)); }
// Kopfzeile: Spalten-Kennung wie [E1] (eigener Export) vor dem Entfernen der Lautschrift retten
export const SPALTEN_TAG = /\s*(\[[EDi][123]\])\s*$/;
export function parseKopfZeile(zeile) {
  return zeile.split('//').map(t => {
    const m = t.match(SPALTEN_TAG);
    if (!m) return parseKolumne(t);
    const k = parseKolumne(t.slice(0, m.index));
    return { ...k, wert: `${k.wert} ${m[1]}` };
  });
}
