import puppeteer from "puppeteer-core";
import { zuListen, neueEineSession } from "./hilfen.mjs";

// Vokabel-Suche: Einzelauswahl (Quiz + Statistik), Aufteilen (🔍 bei Von/Bis), Listenansicht.
// Nur Fremdsprache + Deutsch, „enthält“, Groß/klein + Akzente egal, Wortanfang zuerst; springen ‹ › oder „nur Treffer“
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tippe = async (sel, text) => {
  await page.evaluate((sel, text) => { const i = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, text); i.dispatchEvent(new Event("input", { bubbles: true })); }, sel, text);
  await sleep(500);
};
const klickText = async (sel, text) => { const ok = await page.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim() === text); el?.click(); return !!el; }, sel, text); await sleep(400); return ok; };
const anzahl = art => page.evaluate(a => document.querySelector(`[data-suchleiste="${a}"] [data-such-anzahl]`)?.dataset.suchAnzahl ?? null, art);
const zaehler = art => page.evaluate(a => document.querySelector(`[data-suchleiste="${a}"] [data-such-anzahl]`)?.textContent ?? null, art);
// aktueller Treffer: Zeile mit kräftigem Rahmen; sichtbar im Fenster?
const aktuell = art => page.evaluate(a => {
  const z = [...document.querySelectorAll(`[data-such-ziel="${a}"]`)].find(e => /outline:/.test(e.getAttribute("style") || ""));
  if (!z) return null;
  const r = z.getBoundingClientRect();
  return { text: z.textContent, sichtbar: r.top >= 0 && r.bottom <= innerHeight };
}, art);
const zeilen = art => page.evaluate(a => document.querySelectorAll(`[data-such-ziel="${a}"]`).length, art);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch",i1:"Info"}[t] || "", aktiv: ["E1","D1","i1"].includes(t) }]));
  const besonders = { 12: ["la maison", "das Haus"], 45: ["l'école", "die Schule"], 50: ["la petite maison", "das kleine Haus"], 70: ["le chat", "die Katze"] };
  const vokabeln = Array.from({ length: 80 }, (_, i) => {
    const n = i + 1, [e, d] = besonders[n] || [`mot${n}`, `Wort${n}`];
    return { id: n, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, i1: { wert: n === 3 ? "maison de campagne" : "", falsch: [] } };
  });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 81, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(800);

// ── Quiz: Einzelauswahl ──
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(400);
await klickText(".toggle-opt", "Bereich"); await sleep(400);
// ── Lang-Druck auf eine Vokabel startet Von–Bis ──
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const tafel = () => page.evaluate(() => document.querySelector("[data-auswahl-tafel] [data-info-blase]")?.textContent ?? null);
const zeile = (art, nr) => `[data-such-ziel="${art}"][data-such-id="${nr}"], [data-such-ziel="${art}"][data-such-id$="__${nr}"]`;
const gelb = (art, nr) => page.evaluate(s => /→/.test(document.querySelector(s)?.textContent || ""), zeile(art, nr));
const auswahlText = () => page.evaluate(() => document.querySelector('[data-anzahl="auswahl"]')?.textContent);
const tipp = (art, nr) => page.evaluate(s => document.querySelector(s).click(), zeile(art, nr)).then(() => sleep(400));

await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: "center" }), zeile("quiz", 5)); await sleep(400);
let r = await page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x + 80, y: b.y + b.height / 2 }; }, zeile("quiz", 5));
await finger("touchStart", r.x, r.y); await sleep(800); await finger("touchEnd"); await sleep(500);
ok(await gelb("quiz", 5), "Lang-Druck auf Nr. 5: ist Anfang (→)");
const t = await tafel();
ok(/Anfang ist Nr\. 5 · mot5 – Wort5/.test(t || ""), `Tafel unten: Anfang + Hinweis (${t})`);
ok(await page.evaluate(() => document.querySelectorAll('[data-such-ziel="quiz"] .checkbox.checked').length) === 1, "Loslassen wählt nichts aus (nur der Anfang ist markiert)");
ok(/letzte Vokabel antippen · hier antippen: abbrechen/.test(t || ""), "Tafel-Hinweis passt zu Von–Bis");
// Suche bleibt bedienbar, Ende über die Suche finden
await tippe('[data-suchleiste="quiz"] [data-such-feld]', "chat");
ok(await anzahl("quiz") === "1" && await tafel(), "Suche während Von–Bis: Treffer, Tafel bleibt");
await page.click('[data-suchleiste="quiz"] [data-nur-treffer]'); await sleep(300);
ok(await zeilen("quiz") === 1 && await tafel(), "„nur Treffer“ geht während Von–Bis");
await tipp("quiz", 70);
ok(/\(66 V\.\)/.test(await auswahlText() || ""), `Ende Nr. 70 antippen: Bereich 5–70 gewählt (${await auswahlText()})`);
ok(!(await tafel()) && !(await page.$("[data-info-blase]")), "Tafel nach dem Ende zu");
await page.click('[data-suchleiste="quiz"] [data-nur-treffer]'); await sleep(300);
await page.click('[data-suchleiste="quiz"] [data-such-leeren]'); await sleep(300);
// Abbrechen über die Tafel
await page.evaluate(s => { const el = document.querySelector(s); const b = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 10 })); }, zeile("quiz", 2)); await sleep(400);
ok(await gelb("quiz", 2) && await tafel(), "Rechtsklick (= Lang-Druck) auf Nr. 2: Anfang");
await page.evaluate(() => document.querySelector('[data-info-aktion="✕ Von–Bis abbrechen"]').click()); await sleep(400);
ok(!(await gelb("quiz", 2)) && !(await tafel()) && /\(66 V\.\)/.test(await auswahlText() || ""), "✕ Von–Bis abbrechen: Anfang weg, Auswahl unverändert");
// Antippen außerhalb wird verschluckt, Tippen auf die Tafel bricht ab
await page.evaluate(s => { const el = document.querySelector(s); const b = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 10 })); }, zeile("quiz", 3)); await sleep(400);
await page.evaluate(() => document.querySelector("[data-auswahl-tafel] [data-info-blase]").click()); await sleep(400);
ok(!(await gelb("quiz", 3)) && !(await tafel()), "Tippen auf die Tafel bricht ab");

// ── Statistik ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => /Statistik/.test(t.textContent)).click()); await sleep(500);
if (!(await page.$('[data-suchleiste="statistik"]'))) { await klickText(".toggle-opt", "Bereich"); await sleep(400); }
const statZahl = () => page.evaluate(() => document.querySelectorAll('[data-such-ziel="statistik"] .checkbox.checked').length);
const vorher = await statZahl();
await page.evaluate(s => { const el = document.querySelector(s); el.scrollIntoView({ block: "center" }); const b = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 10 })); }, zeile("statistik", 1)); await sleep(500);
ok(await gelb("statistik", 1) && /Anfang ist Nr\. 1 /.test(await tafel() || ""), "Statistik: Lang-Druck auf Nr. 1 ist Anfang");
await tipp("statistik", 4);
ok(await statZahl() - vorher === 4 && !(await tafel()), `Statistik: Ende Nr. 4 → 4 Vokabeln dazu, Tafel zu (${vorher} → ${await statZahl()})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
