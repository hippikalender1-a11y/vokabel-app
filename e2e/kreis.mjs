import puppeteer from "puppeteer-core";
import { menueShim } from "./hilfen.mjs";

// 269: Statistik als Balken (ersetzt das Kreisdiagramm) – Lernstand Negativ · Kurzzeit · Gelernt (Rahmen = 100 %, von unten
// gefüllt, abgestuft), Langzeit je Raute (100 % = gelernte, fällige schraffiert), Gesamtübersicht, „Nie abgefragte
// ausblenden“ (Kopf zählt weiter alle), Antippen blendet in der Liste aus, Vollbild
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.setViewport({ width: 820, height: 1300 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// scores: null = nie abgefragt; faellig: Indizes mit alter Abfrage (Wartezeit 3 Tage abgelaufen)
async function lade(scores, faellig = []) {
  await page.goto(URL);
  await page.evaluate((scores, faellig) => {
    localStorage.clear();
    localStorage.setItem("vokabel_stufen_v1", "1");
    localStorage.setItem("vokabel_statistik_liste_zu", "false");
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const jetzt = new Date().toISOString(), alt = "2026-01-01T10:00:00.000Z";
    const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id: scores.length + 1,
      vokabeln: scores.map((sc, i) => ({ id: i + 1, E1:{wert:"w" + i,falsch:[]}, D1:{wert:"W" + i,falsch:[]},
        ...(sc === null ? {} : { fortschritt: { score: sc, streak: 0, aufgedecktStreak: 0, letzteAbfrage: faellig.includes(i) ? alt : jetzt, stufeSeit: faellig.includes(i) ? alt : jetzt } }) })) };
    localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
    localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", autoplay:false, vorlesen:["E1"], gelerntSchwelle:3, sprache:"alle" }));
  }, scores, faellig);
  await page.reload(); await sleep(500); await page.evaluate(() => { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); }); await sleep(300);   // 289: Start mit Listen-Auswahl → Quiz
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Statistik").click());
  await sleep(500);
}
// Höhe je Balken-Teil in % des Rahmens
const balken = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-st-balken], [data-st-raute]")].map(b => [b.dataset.stBalken || "r" + b.dataset.stRaute,
  { teile: Object.fromEntries([...b.querySelectorAll("[data-st-teil]")].map(t => [t.dataset.stTeil, Math.round(parseFloat(t.style.height))])),
    unten: [...b.querySelectorAll("[data-st-teil]")].map(t => t.dataset.stTeil).join(","), zahl: __txt(b.closest(".st-spalte").querySelector(".st-zahl")).trim(),
    aus: b.closest(".st-spalte").style.opacity < 1 }])));
const kopf = () => page.evaluate(() => document.querySelector("[data-statistik-kopf-zahl]")?.textContent);
const zeilen = () => page.evaluate(() => document.querySelectorAll("[data-statistik-vok]").length);

// 10 Vokabeln: −5, −2 | 0, 1, 2, 2 | 3 (fällig), 4, 6 | nie
await lade([-5, -2, 0, 1, 2, 2, 3, 4, 6, null], [6]);
let b = await balken();
console.log("     ", JSON.stringify(b));
ok(!(await page.$('svg[viewBox="0 0 400 230"]')) && !!(await page.$("[data-statistik-balken]")), "Balken statt Kreisdiagramm");
ok(b.negativ.teile["-2"] === 10 && b.negativ.teile["-1"] === 10 && b.negativ.unten === "-2,-1" && b.negativ.zahl === "2 · 20 %",
  "Negativ: −2 dunkel unten, −1 hell darüber, 2 · 20 %");
ok(b.arbeit.teile["2"] === 20 && b.arbeit.teile["1"] === 10 && b.arbeit.teile["0"] === 10 && b.arbeit.zahl === "4 · 40 %", "Kurzzeit: ●●○ 2, ●○○ 1, ○○○ 1 (Score 0 zählt hierher) – 4 · 40 %");
ok(b.gelernt.teile["3"] === 30 && b.gelernt.zahl === "3 · 30 %", "Gelernt: 3 · 30 % (Rahmen = alle 10)");
ok(b.r3.teile.f === 33 && b.r3.zahl === "1 · 🔁 1" && b.r4.teile.r === 33 && b.r6.teile.r === 33 && !b.r5.unten,
  "Langzeit (100 % = 3 gelernte): ◇◇◇ fällig, ◆◇◇ und ◆◆◆ je ein Drittel, ◆◆◇ leer");
// 285: fällige hohl – Rand in Balkenfarbe, innen Hintergrund, unten
const hohl = await page.evaluate(() => { const t = document.querySelector('[data-st-raute="3"] [data-st-teil="f"]'), cs = getComputedStyle(t), r = getComputedStyle(document.querySelector('[data-st-raute="4"] [data-st-teil="r"]'));
  return { rand: parseFloat(cs.borderTopWidth), randFarbe: cs.borderTopColor, voll: r.backgroundColor, innen: cs.backgroundColor, bar: getComputedStyle(t.parentElement).backgroundColor, bild: cs.backgroundImage, unten: t.style.bottom }; });
ok(hohl.rand >= 3 && hohl.randFarbe === hohl.voll && hohl.innen === hohl.bar && hohl.bild === "none" && hohl.unten === "0%", `285: fällige hohl statt schraffiert (${JSON.stringify(hohl)})`);
// 284: Farben überblendet – Auf einem guten Weg unten 0 (gelb) → oben 2 (Richtung türkis), Negativ unten −2 → oben −1 (Richtung gelb)
const farben = await page.evaluate(() => Object.fromEntries(["-2", "-1", "0", "1", "2"].map(k => [k, getComputedStyle(document.querySelector(`[data-st-lernstand] [data-st-teil="${k}"]`)).backgroundColor])));
ok(b.arbeit.unten === "0,1,2" && b.negativ.unten === "-2,-1" && new Set(Object.values(farben)).size === 5, `284: Reihenfolge 0,1,2 von unten, fünf verschiedene Farben (${JSON.stringify(farben)})`);
// 286: Gesamtübersicht in den Balken – Nie-Balken, Gesamtzahl in der Überschrift, gelernt/fällig über den Langzeit-Balken
const g = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-st-kachel]")].map(k => [k.dataset.stKachel, k.querySelector("b").textContent])));
ok(g.gesamt === "10" && b.nie.zahl === "1 · 10 %" && b.nie.teile.nie === 10 && g.gelernt === "3" && g.faellig === "1" && !(await page.$(".st-kacheln")) && !(await page.$('input[type="checkbox"][data-nie-aus]')),
  `286: Lernstand · 10 Vokabeln, Nie-Balken 1, Langzeit 3 gelernte · 🔁 1 fällig, keine Kacheln/Schalter mehr (${JSON.stringify(g)}, ${b.nie.zahl})`);
ok(await page.evaluate(() => document.querySelector("[data-st-abgefragt]")?.dataset.stAbgefragt === "9" && __txt(document.querySelector(".st-klammer")).trim() === "9 abgefragt"), "286: Klammer „9 abgefragt“ unter den drei Balken");
await page.screenshot({ path: "balken.png" });

// Nie abgefragte ausblenden → 100 % = 9 abgefragte; Kopf zählt weiter alle 10
const kopfVorher = await kopf();
await page.click("[data-nie-aus]"); await sleep(300);
b = await balken();
ok(b.gelernt.zahl === "3 · 33 %" && b.negativ.zahl === "2 · 22 %", `ohne nie abgefragte: Balken auf 9 bezogen (${b.gelernt.zahl}, ${b.negativ.zahl})`);
ok(await kopf() === kopfVorher && /3 \/ 10 gelernt/.test(await kopf()), `Kopf zählt weiter alle (${await kopf()})`);
ok(b.nie.aus && /9 abgefragt = 100 %/.test(await page.evaluate(() => document.querySelector(".st-klammer").textContent)) && await zeilen() === 9, "Nie-Balken angetippt: blass, Klammer „9 abgefragt = 100 %“, Liste ohne die nie abgefragte");
await page.click("[data-nie-aus]"); await sleep(300);

// Balken antippen: Gruppe in der Liste ausblenden (blass); „Vokabeln“ blendet alles wieder ein
await page.click('[data-st-balken="gelernt"]'); await sleep(300);
b = await balken();
ok(b.gelernt.aus && await zeilen() === 7 && b.gelernt.teile["3"] === 30, "Gelernt angetippt: blass, Liste ohne Gelernte, Balken bleibt");
await page.click('[data-st-kachel="gesamt"]'); await sleep(300);
ok(!(await balken()).gelernt.aus && await zeilen() === 10, "„Vokabeln“ antippen: alles wieder eingeblendet");

// Diktat: keine Langzeit-Balken, keine Fällig-Kachel
await page.click("[data-kreismitte]"); await sleep(300);
ok(await page.evaluate(() => document.querySelector("[data-kreismitte]").textContent.includes("Diktat")) && !(await page.$("[data-st-langzeit]")) && !(await page.$('[data-st-kachel="faellig"]')),
  "Diktat: ohne Langzeit-Balken und Fällig-Kachel");
for (let i = 0; i < 3 && !(await page.evaluate(() => document.querySelector("[data-kreismitte]").textContent.includes("Übersetzung"))); i++) { await page.click("[data-kreismitte]"); await sleep(300); }

// Vollbild
await page.evaluate(() => [...document.querySelectorAll("[data-statistik-balken] button")].find(x => x.querySelector("svg") && !x.textContent.trim())?.click()); await sleep(300);
ok(await page.evaluate(() => !document.querySelector(".tabs") && !!document.querySelector("[data-st-balken]")), "Vollbild: Tabs ausgeblendet, Balken bleiben");

// nur nie abgefragte: Balken leer, nichts kaputt
await lade([null, null, null]);
b = await balken();
ok(b.negativ.zahl === "0 · 0 %" && b.gelernt.zahl === "0 · 0 %" && !b.gelernt.unten, "nur nie abgefragte: leere Balken mit 0 %");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
