// 270: eigene Zeichen statt bunter Emojis – sie übernehmen Farbe und Größe der Schrift daneben.
// Stilregeln für alle Zeichen hier: Raster 24×24, nur Linien (keine Flächen), Strichstärke 2.2, runde Enden/Ecken,
// Farbe currentColor, Größe 1em. Neue Zeichen bitte nach denselben Regeln anlegen (Entwürfe: Ordner symbole-entwuerfe/).
import { Fragment } from "react";

const PFADE = {
  // Wiederholung (Langzeit/Fällige, „Nochmal“) – Schleife: oben nach rechts, unten nach links
  wiederholung: ["M3 11V9a3 3 0 0 1 3-3h14", "M17 2.5 20.5 6 17 9.5", "M21 13v2a3 3 0 0 1-3 3H4", "M7 21.5 3.5 18 7 14.5"],
};
const NAMEN = { wiederholung: "Wiederholung" };
// Emoji im Text → eigenes Zeichen (für Texte, die als Zeichenkette kommen: Menüs, Info-Tafel)
const ERSATZ = { "🔁": "wiederholung" };
const ERSATZ_RE = new RegExp(`(${Object.keys(ERSATZ).join("|")})`, "u");

export function Sym({ name, groesse = "1em", style, ...rest }) {
  const d = PFADE[name];
  if (!d) return null;
  return (
    <svg className="sym" data-sym={name} role="img" aria-label={NAMEN[name] || name} width={groesse} height={groesse} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={style} {...rest}>
      {d.map((p, i) => <path key={i} d={p}/>)}
    </svg>
  );
}

export const SymWdh = props => <Sym name="wiederholung" {...props}/>;

// Zeichenkette mit Emojis aus ERSATZ → Teile mit eigenen Zeichen; alles andere bleibt unverändert
export function mitSymbolen(text) {
  if (typeof text !== "string" || !ERSATZ_RE.test(text)) return text;
  return text.split(ERSATZ_RE).map((t, i) => ERSATZ[t] ? <Sym key={i} name={ERSATZ[t]}/> : <Fragment key={i}>{t}</Fragment>);
}
