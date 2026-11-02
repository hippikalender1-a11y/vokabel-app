// Gemeinsame Test-Hilfen
// Listen liegen unter Einstellungen › Listen (kein eigener Tab mehr)
export async function zuListen(page) {
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const k = document.querySelector('[data-einst-kopf="listen"]'); if (k && k.dataset.offen !== "ja") k.click(); });
  await new Promise(r => setTimeout(r, 300));
}
