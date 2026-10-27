// Verbindung App ↔ InfoTafel: Erklärung anzeigen bzw. Info-Modus umschalten
// aktionen (optional): [{ label, fn, gefahr }] – Knöpfe unter der Erklärung (Lang-Druck-Menü)
export function zeigeInfo(text, x, y, aktionen) {
  window.dispatchEvent(new CustomEvent("vokabel-info", { detail: { text, x, y, aktionen } }));
}
// offene Erklärung sofort schließen (z. B. sobald ein Lang-Druck in ein Ziehen übergeht)
export function schliesseInfo() {
  window.dispatchEvent(new CustomEvent("vokabel-info-schliessen"));
}
export function schalteInfoModus() {
  window.dispatchEvent(new CustomEvent("vokabel-infomodus"));
}
