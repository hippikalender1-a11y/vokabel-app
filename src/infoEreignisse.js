// Verbindung App ↔ InfoTafel: Erklärung anzeigen bzw. Info-Modus umschalten
// aktionen (optional): [{ label, fn, gefahr, behalten }] – Knöpfe unter der Erklärung (Lang-Druck-Menü)
// extra.auswahl ({ zu(behalten) }): Auswahl-Tafel – bleibt unten offen, Kacheln ([data-auswahl-durchlass]) bleiben
// antippbar, alles andere ist gesperrt; schließen nur über die Tafel selbst bzw. einen Menü-Knopf
// 235: Menü-Gruppe – „Name ›“ ersetzt das Menü durch die Unterpunkte (oben „‹ zurück“);
// leere Gruppe entfällt, eine Gruppe mit nur einem Punkt wird zum direkten Knopf. Ergebnis zum Einspreizen (...gruppe()).
export const GRUPPE = { lernen: "📊 Lernen", ablage: "🗂 Ablage", inhalt: "📚 Inhalt", ansicht: "🖼 Ansicht" };
export function gruppe(name, unter) {
  const u = unter.filter(Boolean);
  return u.length > 1 ? [{ label: `${name} ›`, gruppe: u }] : u;
}
// 241: einen Punkt in die Gruppe `name` eines fertigen Menüs hängen (fehlt sie, ans Ende)
export function inGruppe(aktionen, name, punkt) {
  const label = `${name} ›`;
  let drin = false;
  const neu = aktionen.map(a => a.gruppe && a.label === label ? (drin = true, { ...a, gruppe: [...a.gruppe, punkt] }) : a);
  return drin ? neu : [...neu, punkt];
}
export function zeigeInfo(text, x, y, aktionen, extra) {
  window.dispatchEvent(new CustomEvent("vokabel-info", { detail: { text, x, y, aktionen, ...extra } }));
}
// offene Erklärung sofort schließen (z. B. sobald ein Lang-Druck in ein Ziehen übergeht)
export function schliesseInfo() {
  window.dispatchEvent(new CustomEvent("vokabel-info-schliessen"));
}
export function schalteInfoModus() {
  window.dispatchEvent(new CustomEvent("vokabel-infomodus"));
}
// „🎨 Farbe ändern“ unter jeder Erklärung (Einstellung; im Farbmodus aus)
let farbeImMenue = true;
export function setzeFarbeImMenue(an) { farbeImMenue = an; }
export function farbeImMenueAn() { return farbeImMenue; }
export function farbeHier(x, y) {
  window.dispatchEvent(new CustomEvent("vokabel-farbe-hier", { detail: { x, y } }));
}
