import puppeteer from "puppeteer-core";
import { quizEinstellungen, listenZu, bereichZu, auswahlZu } from "./hilfen.mjs";

// Paket-Ende: Knopf nennt die echte Restzahl („Letzte 2 Vokabeln“), Größen über dem Rest fehlen;
// „Zur Übersicht“/„Beenden“/„Schließen“ kehren eingeklappt zurück (Session-Auswahl offen, 190), „Pause“ nicht;
// Start-Knopf nennt die Abfrageart; aktuelle Liste und Start-Knopf in eigener, hellerer Farbe
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
  if (!done && await bereichZu(page)) return clickText(sel, text, exact);   // offener Bereich blendet den Rest aus
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const paket = async n => {
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(250);
    await clickText(".karte-btn", "Gewusst"); await sleep(1200);
  }
};
const startText = () => page.evaluate(() => document.querySelector("[data-start-knopf] b")?.textContent);
const listenSichtbar = () => page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].filter(e => e.offsetParent).length);
const bg = sel => page.evaluate(sel => getComputedStyle(document.querySelector(sel)).backgroundColor, sel);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear(); localStorage.setItem("vokabel_test_ohne_tagessperre", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Vocabulaire", sprache:"fr", spalten: sp, naechste_id: 8,
    vokabeln: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, E1: { wert: "mot" + i, falsch: [] }, D1: { wert: "Wort" + i, falsch: [] } })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Vocabulaire", sprache:"fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], gelerntSchwelle: 3, sprache: "alle", farbschema: "lavendel" }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz"); await quizEinstellungen(page);
await clickText(".quiz-setup-check", "Vocabulaire");
await listenZu(page);   // Listen-Auswahl zu → Quiz-Optionen sichtbar
await page.evaluate(() => document.querySelector("[data-umfang]")?.click()); await sleep(300);
await page.click('[data-umfang-wahl="5"]'); await sleep(500);

// Start-Knopf: Abfrageart und Farbe
ok(await startText() === "Übersetzung starten", `Start-Knopf „Übersetzung starten“ (${await startText()})`);
const farben = await page.evaluate(() => { const v = n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim(); return { haupt: v("haupt"), start: v("start"), aufStart: v("auf-start"), gruen: v("bestaetigen") }; });
console.log("     Farben:", JSON.stringify(farben));
const startBg = await bg("[data-start-knopf]"), nameBg = await bg("[data-slot-kopf-name]");
const andererBg = await page.evaluate(() => { const b = [...document.querySelectorAll(".btn-primary")].find(x => !x.matches("[data-start-knopf]") && x.offsetParent); return b ? getComputedStyle(b).backgroundColor : null; });
console.log("     Start:", startBg, " Liste:", nameBg, " anderer Knopf:", andererBg);
const gruenBg = await page.evaluate(f => { const d = document.createElement("div"); d.style.background = f; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; }, farben.gruen);
ok(startBg === gruenBg, `134: Start-Knopf in der Farbe „Auswahl / Bestätigen“ (${startBg} = ${gruenBg})`);
ok(!andererBg || andererBg !== startBg, "andere Knöpfe bleiben in der Hauptfarbe");
await page.screenshot({ path: "uebersicht_farbe.png", clip: { x: 0, y: 0, width: 390, height: 900 } });
await page.evaluate(() => document.querySelector('[data-quiz-art="diktat"]')?.click()); await sleep(400);
if (await page.$('[data-quiz-art="diktat"]')) ok(await startText() === "Diktat starten", `Diktat: „Diktat starten“ (${await startText()})`);
await page.evaluate(() => document.querySelector('[data-quiz-art="uebersetzung"]')?.click()); await sleep(400);

// Paket 1 (5 von 7) → Rest 2
const kopf = () => page.evaluate(() => document.querySelector("[data-slot-kopf]")?.dataset.slotKopf);
const reihenfolgeOffen = () => page.evaluate(() => !!document.querySelector("[data-reihenfolge]")?.classList.contains("offen"));
const oeffneReihenfolge = async () => { if (!(await reihenfolgeOffen())) { await page.click("[data-reihenfolge]"); await sleep(300); } };
// mit offenem Bereich gibt es keinen Start-Knopf (Fokus): Reihenfolge öffnen, prüfen, wieder zu
await oeffneReihenfolge();
ok(await reihenfolgeOffen() && !(await page.$("[data-start-knopf]")), "Reihenfolge offen: Start ausgeblendet (Fokus)");
await page.click("[data-reihenfolge]"); await sleep(300);
await page.click("[data-start-knopf]"); await sleep(500);
await paket(5);
const knopf = await page.evaluate(() => document.querySelector("[data-naechstes-paket]")?.textContent.trim());
ok(knopf === "Letzte 2 Vokabeln", `Paket-Ende: „Letzte 2 Vokabeln“ (${knopf})`);
ok(!(await page.$("[data-paket-groessen]")), "keine Paketgrößen-Auswahl, da alle Größen ≥ Rest");

// Pause: Übersicht wie vorher
await page.click("[data-pause]"); await sleep(500);
ok(await page.$("[data-start-knopf]") && !(await reihenfolgeOffen()), "Pause: Übersicht wie vorher (kein Bereich offen, Start sichtbar)");

// letzte 2 → Auswertung → Zur Übersicht: eingeklappt
await page.click("[data-start-knopf]"); await sleep(500);
await paket(2);
await page.evaluate(() => document.querySelector("[data-zur-auswertung]")?.click()); await sleep(400);
await page.evaluate(() => window.scrollTo(0, 400));
await clickText("button", "Zur Übersicht"); await sleep(500);
const nachher = await page.evaluate(() => ({ listen: [...document.querySelectorAll(".quiz-setup-check")].filter(e => e.offsetParent).length,
  kopf: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, y: window.scrollY, tab: document.querySelector(".tab.aktiv, .tab.active")?.textContent }));
console.log("     nach „Zur Übersicht“:", JSON.stringify(nachher));
ok(nachher.listen === 0 && nachher.kopf === "offen" && !(await reihenfolgeOffen()) && nachher.y === 0, "Zur Übersicht: Bereiche eingeklappt, Session-Auswahl offen (190), oben");
await auswahlZu(page);

// Beenden während der Abfrage (ohne Antwort) → eingeklappt, Session-Auswahl offen
await page.click("[data-start-knopf]"); await sleep(500);
await clickText("button", "Beenden", true); await sleep(500);
const nachBeenden = await page.evaluate(() => document.querySelector("[data-slot-kopf]")?.dataset.slotKopf);
await auswahlZu(page);
ok(!(await reihenfolgeOffen()) && nachBeenden === "offen" && await page.$("[data-start-knopf]"), `Beenden: Übersicht mit eingeklappten Bereichen, Session-Auswahl offen (${nachBeenden})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
