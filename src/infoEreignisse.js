// Verbindung App ↔ InfoTafel: Erklärung anzeigen bzw. Info-Modus umschalten
export function zeigeInfo(text, y) {
  window.dispatchEvent(new CustomEvent("vokabel-info", { detail: { text, y } }));
}
export function schalteInfoModus() {
  window.dispatchEvent(new CustomEvent("vokabel-infomodus"));
}
