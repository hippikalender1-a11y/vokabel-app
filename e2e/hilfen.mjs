// Gemeinsame Test-Hilfen
// Listen liegen unter Einstellungen › Listen (kein eigener Tab mehr)
export async function zuListen(page) {
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const k = document.querySelector('[data-einst-kopf="listen"]'); if (k && k.dataset.offen !== "ja") k.click(); });
  await new Promise(r => setTimeout(r, 300));
}
// Quiz-Tab: Ist die Session-Auswahl offen, Kopf antippen → Einstellungen (Listen-Auswahl usw.) sichtbar
export async function quizEinstellungen(page) {
  await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); });
  await new Promise(r => setTimeout(r, 300));
}
// „＋ Neue Session aus Listen“ → „Eine Session“ (ersetzt den früheren „Neu“-Chip)
export async function neueEineSession(page) {
  await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="einstellungen"]')) document.querySelector("[data-slot-kopf-name]")?.click(); });
  await new Promise(r => setTimeout(r, 300));
  await page.click("[data-neue-session]"); await new Promise(r => setTimeout(r, 300));
  await page.click('[data-neue-session-art="eine"]'); await new Promise(r => setTimeout(r, 400));
}
