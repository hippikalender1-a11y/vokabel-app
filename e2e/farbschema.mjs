import puppeteer from "puppeteer-core";

// Farbschemata: 6 Vorlagen (Natur, Freudig, Pastelle, Mädchen, Jungs, Dunkel) wählen; Vorlagen nur duplizieren;
// eigene bearbeiten (Farbwähler, live), zurücksetzen, umbenennen, löschen
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, text, exact = false) => {
  const done = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text, exact);
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const variable = n => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim(), n);
const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const menue = async id => {
  await page.evaluate(id => { const el = document.querySelector(`[data-farbschema="${id}"]`); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, id);
  await sleep(250);
};
const aktionen = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.textContent.trim()));
const aktion = async l => { await page.evaluate(l => document.querySelector(`[data-info-aktion="${l}"]`).click(), l); await sleep(300); };
const eigene = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}").eigeneSchemata || []);

// Farbe im Farbkreis-Dialog per Hex-Feld setzen (live) und anwenden
const farbradHex = async (wert, anwenden = true) => {
  await page.evaluate(w => { const i = document.querySelector("[data-farbrad-hex]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, w); i.dispatchEvent(new Event("input", { bubbles: true })); }, wert);
  await new Promise(r => setTimeout(r, 200));
  if (anwenden) { await page.click("[data-farbrad-anwenden]"); await new Promise(r => setTimeout(r, 300)); }
};
await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload(); await sleep(500);
await clickText(".tab", "Einstellungen");

const namen = await page.evaluate(() => [...document.querySelectorAll("[data-farbschema]")].map(b => b.querySelector(".farb-name").textContent.replace("✓ ", "").trim()));
console.log("     Schemata:", namen.join(" | "));
ok(namen.join("|") === "Natur|Freudig|Pastelle|Mädchen|Jungs|Dunkel", "6 Vorlagen: Natur, Freudig, Pastelle, Mädchen, Jungs, Dunkel");
ok(await variable("haupt") === "#2d6a4f" && await page.evaluate(() => document.querySelector('[data-farbschema="natur"]').classList.contains("aktiv")), "Standard: Natur (Hauptfarbe #2d6a4f)");

for (const id of ["freudig", "pastelle", "maedchen", "jungs", "dunkel"]) {
  await page.click(`[data-farbschema="${id}"]`); await sleep(250);
  if (process.env.SHOT) await page.screenshot({ path: `schema_${id}.png` });
}
ok(await bodyBg() === "rgb(22, 24, 22)" && await variable("text") === "#e3e0da", "Dunkel: dunkler Hintergrund, heller Text");
await page.reload(); await sleep(500);
ok(await bodyBg() === "rgb(22, 24, 22)", "Auswahl bleibt nach Neuladen erhalten");

const leiste = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content"));
ok(await leiste() === "#161816", `Systemleiste folgt dem Schema (Dunkel: ${await leiste()})`);
// „Farben bearbeiten“: bei einer Vorlage erst Kopie, dann Liste aller Farbrollen inkl. App-Leiste
await clickText(".tab", "Einstellungen");
await page.click('[data-farbschema="jungs"]'); await sleep(200);
ok(await leiste() === "#1d5f8a", "Jungs: Systemleiste = Hauptfarbe");
await page.click("[data-farben-bearbeiten]"); await sleep(300);
let eigNeu = await eigene();
ok(eigNeu.length === 1 && eigNeu[0].name === "Jungs (Kopie)" && await page.$('[data-schema-editor] [data-farbrolle="leiste"]'), "„Farben bearbeiten“: Kopie „Jungs (Kopie)“, Editor mit „App-Leiste (System)“");
await page.click('[data-farbrolle="leiste"]'); await sleep(300);
await farbradHex("#ff00aa");
ok(await leiste() === "#ff00aa" && (await eigene())[0].farben.leiste === "#ff00aa", "App-Leiste eingestellt: Systemleiste #ff00aa");
await page.click("[data-schema-fertig]"); await sleep(200);
await menue(eigNeu[0].id); await aktion("🗑 Löschen"); await clickText(".modal .btn-danger", "Löschen", true);
await page.click('[data-farbschema="dunkel"]'); await sleep(200);

// Vorlage: nur Duplizieren
await clickText(".tab", "Einstellungen");
await menue("natur");
ok((await aktionen()).join("|") === "⧉ Duplizieren", "Vorlage: Lang-Druck nur „Duplizieren“");
await aktion("⧉ Duplizieren");
let eig = await eigene();
ok(eig.length === 1 && eig[0].name === "Natur (Kopie)" && await page.$("[data-schema-editor]"), "Duplikat „Natur (Kopie)“ gewählt, Editor offen");
ok(await variable("haupt") === "#2d6a4f" && await bodyBg() === "rgb(247, 245, 240)", "Duplikat aktiv: Farben von Natur");

// Farbe ändern: live
await page.click('[data-farbrolle="haupt"]'); await sleep(300);
await farbradHex("#1d5f8a", false);
ok(await variable("haupt") === "#1d5f8a" && (await eigene())[0].farben.haupt === "#2d6a4f", "Farbkreis: Vorschau live, noch nicht gespeichert");
await page.click("[data-farbrad-anwenden]"); await sleep(300);
ok(await variable("haupt") === "#1d5f8a" && (await eigene())[0].farben.haupt === "#1d5f8a", "Hauptfarbe geändert: sofort sichtbar und gespeichert");
await page.click("[data-schema-zuruecksetzen]"); await sleep(300);
ok(await variable("haupt") === "#2d6a4f", "Zurücksetzen: wieder Farben der Vorlage");
await page.click("[data-schema-fertig]"); await sleep(200);
ok(!(await page.$("[data-schema-editor]")), "Fertig: Editor zu");

// eigenes: Menü mit Bearbeiten / Duplizieren / Umbenennen / Löschen
const eigId = (await eigene())[0].id;
await menue(eigId);
ok((await aktionen()).join("|") === "🎨 Bearbeiten|⧉ Duplizieren|✎ Umbenennen|🗑 Löschen", "eigenes Schema: Bearbeiten, Duplizieren, Umbenennen, Löschen");
await aktion("✎ Umbenennen");
await page.evaluate(() => { const i = document.querySelector(".modal input"); i.select(); });
await page.keyboard.type("Mein Grün");
await clickText(".modal button", "Speichern", true);
ok((await eigene())[0].name === "Mein Grün", "umbenannt: „Mein Grün“");
await page.click('[data-farbschema="dunkel"]'); await sleep(200);
await menue(eigId); await aktion("🗑 Löschen");
await clickText(".modal .btn-danger", "Löschen", true);
ok((await eigene()).length === 0 && await bodyBg() === "rgb(22, 24, 22)", "gelöscht; gewähltes Schema (Dunkel) bleibt");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
