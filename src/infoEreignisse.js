// Verbindung App ↔ InfoTafel: Erklärung anzeigen bzw. Info-Modus umschalten
export function zeigeInfo(text, x, y) {
  window.dispatchEvent(new CustomEvent("vokabel-info", { detail: { text, x, y } }));
}
export function schalteInfoModus() {
  window.dispatchEvent(new CustomEvent("vokabel-infomodus"));
}
