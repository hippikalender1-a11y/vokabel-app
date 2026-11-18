import puppeteer from "puppeteer-core";
import { listeOeffnen, menueShim, auswahlEnde } from "./hilfen.mjs";
import { zuListen } from "./hilfen.mjs";

// 287: Ordner auf dem iPhone halten (Nachklick) – vorher: Gesten im Quiz- und Listen-Raster: Lang-Druck öffnet die Auswahl-Tafel (unten, bleibt offen; weitere antippen
// wählt mit aus; nur die Tafel beendet), Lang-Druck auf freie Stelle + ziehen sammelt ein, beim Ziehen 1,2 s über
// eines Quiz halten bildet eine Gruppe, auf „← Alle Quiz“ ziehen nimmt heraus, Gruppe mit eines Quiz löst sich auf
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const kachel = id => `[data-slot-id="${id}"]`;
const mitte = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, sel);
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
// Auswahl-Tafel ohne schwarze Box (147): offen = Menü-Knöpfe da; der Name der Auswahl steht oben in der Info-Fläche
const tafel = () => page.evaluate(() => document.querySelector("[data-auswahl-tafel]") ? (document.querySelector("[data-slot-info-name]")?.innerText.trim() || "") : null);
const tafelZu = async () => { await auswahlEnde(page); await sleep(100); };
const menue = () => page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion));
const gewaehlt = () => page.evaluate(() => [...document.querySelectorAll("[data-multi-nr]")].map(b => b.dataset.slotId).join(","));
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(300);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"fr", spalten: sp, naechste_id: 41,
    vokabeln: Array.from({length:40},(_, i) => ({ id: i+1, E1: { wert: "mot"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] } })) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify(liste("l_a", "Unité 1")));
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify(liste("l_b", "Unité 2")));
  localStorage.setItem("vokabel_liste_l_c", JSON.stringify(liste("l_c", "Unité 3")));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} },
    { id:"l_b", name:"Unité 2", sprache:"fr", platz:{z:1,s:0} }, { id:"l_c", name:"Unité 3", sprache:"fr", platz:{z:3,s:0} }]));
  const k = (von, bis) => ({ listenIds:["l_a"], vokabelAuswahl: Array.from({length: bis - von + 1}, (_, i) => `l_a__${von + i}`), bereichTyp:"bereich", quizBereichTyp:"bereich",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert: [1, 2, 3, 4].map(i =>
    ({ id:"s"+i, name:"Teil "+i, timestamp:i, konfiguration:k(i * 10 - 9, i * 10), sessionFortschritt:null, platz:{z:i - 1,s:0} })) }));
});
await page.reload(); await sleep(700);

await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("vokabel_slots"));
  d.ordner = [{ id: "o1", name: "Mappe", platz: { z: 2, s: 1 } }];
  d.gespeichert.find(x => x.id === "s4").ordner = "o1"; d.gespeichert.find(x => x.id === "s4").platz = { z: 0, s: 0 };
  localStorage.setItem("vokabel_slots", JSON.stringify(d)); });
await page.reload(); await sleep(800);
// 287: iPhone – nach dem Halten kommt trotzdem ein Klick; auf einem Ordner darf er die Tafel nicht schließen (Ordner öffnen)
const h = await mitte('[data-ordner-id="o1"]');
await finger("touchStart", h.x, h.y); await sleep(450); await finger("touchEnd");
await page.evaluate(() => document.querySelector('[data-ordner-id="o1"]').click()); await sleep(500);
ok((await tafel())?.startsWith("📁 Mappe") && await gewaehlt() === "o1" && !(await page.$('[data-slot-id="s4"]')), `287: Ordner halten + Nachklick – Tafel bleibt offen, Ordner ausgewählt (${await tafel()})`);
ok(await page.evaluate(() => [...document.querySelectorAll("[data-info-gruppe]")].some(b => b.dataset.infoGruppe.includes("📤 Ordner auflösen"))), "287: in der Ablage: Ordner auflösen");
await tafelZu(); await sleep(800);
await page.evaluate(() => document.querySelector('[data-ordner-id="o1"]').click()); await sleep(500);
ok(!!(await page.$('[data-slot-id="s4"]')), "287: normales Antippen öffnet den Ordner weiterhin");
await browser.close();
console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
process.exit(fehler ? 1 : 0);
