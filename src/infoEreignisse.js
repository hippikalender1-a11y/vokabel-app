// Verbindung App ↔ InfoTafel: Erklärung anzeigen bzw. Info-Modus umschalten
export function zeigeInfo(text, x, y) {
  window.dispatchEvent(new CustomEvent("vokabel-info", { detail: { text, x, y } }));
}
// offene Erklärung sofort schließen (z. B. sobald ein Lang-Druck in ein Ziehen übergeht)
export function schliesseInfo() {
  window.dispatchEvent(new CustomEvent("vokabel-info-schliessen"));
}
export function schalteInfoModus() {
  window.dispatchEvent(new CustomEvent("vokabel-infomodus"));
}
