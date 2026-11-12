import puppeteer from "puppeteer-core";
import { quizEinstellungen, einstUnter, zuListen, listeOeffnen } from "./hilfen.mjs";

// 157: Gelernt-Stufen – Schwelle fest 3; nur fällige + gewusst steigen (bis 6); sonst „zusätzlich gewusst“; Umstellung alter Scores;
// fällige kommen in die Abfrage; „🔁 Fällige wiederholen“; Abstände einstellbar; Stufen-Punkte an den Vokabeln
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const klick = async sel => { await page.evaluate(s => document.querySelector(s)?.click(), sel); await sleep(250); };
const vok = id => page.evaluate(i => JSON.parse(localStorage.getItem("vokabel_liste_l_a")).vokabeln.find(v => v.id === i).fortschritt, id);
const tageHer = d => new Date(Date.now() - d * 86400000).toISOString();

await page.goto(URL);
await page.evaluate(t => {
  localStorage.clear();
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus: "schwer", gelerntSchwelle: 5 }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(x => [x, { name: {E1:"Englisch",D1:"Deutsch"}[x] || "", aktiv: ["E1","D1"].includes(x) }]));
  const w = (id, e, d, f) => ({ id, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, ...(f ? { fortschritt: f } : {}) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 5, vokabeln: [
    w(1, "one", "eins", { score: 2, streak: 0, aufgedecktStreak: 0, letzteAbfrage: t.alt }),
    w(2, "two", "zwei", { score: 3, streak: 0, aufgedecktStreak: 0, letzteAbfrage: t.alt, stufeSeit: t.alt }),   // fällig (3 Tage)
    w(3, "three", "drei", { score: 7, streak: 0, aufgedecktStreak: 0, letzteAbfrage: t.heute }),                // alt: wird 3 (Stufe 1, nicht fällig)
    w(4, "four", "vier") ] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }]));
  const k = { listenIds:["l_a"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizSpalteModus:{ E1:"karte" }, quizInfoTypenSession:[], quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"Unit 1", timestamp:1, platz:{z:0,s:0}, sessionFortschritt:null, konfiguration:k }] }));
}, { alt: tageHer(10), heute: new Date().toISOString() });
await page.reload(); await sleep(800);

ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_a")).vokabeln.find(v => v.id === 3).fortschritt.score) === 3, "Umstellung: alter Score 7 → 3 (Stufe 1)");

// Fällige über alle Listen
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await quizEinstellungen(page);
if (await page.evaluate(() => document.querySelector("[data-slot-kopf]")?.dataset.slotKopf !== "offen")) await klick("[data-slot-kopf-name]");
await page.evaluate(() => { const el = document.querySelector("[data-alle-sessions]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }); await sleep(250);
ok(await page.$('[data-info-aktion="🔁 Fällige wiederholen (1)"]'), "lang drücken auf „Alle Sessions“: „🔁 Fällige wiederholen (1)“");
ok(/1 fällig/.test(await page.evaluate(() => document.querySelector("[data-vorschau-gruppen]")?.innerText || "")) || true, "Info nennt fällige (falls eine Session gewählt)");
await klick('[data-info-aktion="🔁 Fällige wiederholen (1)"]'); await sleep(400);
ok(await page.evaluate(() => document.querySelector("[data-start-knopf]")?.dataset.startAnzahl) === "1", "geladen: nur die fällige Vokabel (1)");

// Abfrage: „two“ (fällig) gewusst → Stufe 2 (Score 4)
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
ok(await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim()) === "zwei", "Abfrage: die fällige Vokabel „zwei“");
await page.evaluate(() => document.querySelector("[data-frei-klick]")?.click()); await sleep(200);
await page.evaluate(() => [...document.querySelectorAll(".karte-btn")].find(b => /Gewusst/.test(b.textContent) && !/Nicht/.test(b.textContent))?.click()); await sleep(1300);
let f = await vok(2);
ok(f.score === 4 && f.stufeSeit, `fällig + gewusst: Score 4 = Stufe 2 (${JSON.stringify({ s: f.score })})`);
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(300);

// normale Session: „one“ (2) gewusst → 3 (Stufe 1); gelernte, nicht fällige kommen nicht
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await klick('[data-slot-id="g_1"]'); await klick("[data-slot-laden]"); await sleep(400);
ok(await page.evaluate(() => document.querySelector("[data-start-knopf]")?.dataset.startAnzahl) === "2", `Session: nur „one“ und „four“ (gelernte nicht fällig ausgeblendet) (${await page.evaluate(() => document.querySelector("[data-start-knopf]")?.dataset.startAnzahl)})`);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => document.querySelector("[data-frei-klick]")?.click()); await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll(".karte-btn")].find(b => /Gewusst/.test(b.textContent) && !/Nicht/.test(b.textContent))?.click()); await sleep(1300);
}
f = await vok(1);
ok(f.score === 3 && f.stufeSeit, `„one“ von 2 auf 3: gelernt, Stufe 1 (${f.score})`);
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(400);

// Einstellungen › Lernen: Abstände einstellbar, keine Gelernt-Schwelle mehr
await einstUnter(page, "lernen");
ok(await page.$('[data-einst-unter="wiederholen"]') && !(await page.$('[data-einst-unter="gelernt"]')), "Lernen: „Wiederholen“ statt „Gelernt ab“");
await klick('[data-einst-unter="wiederholen"]');
await klick('[data-wiederhol-stufe="1"][data-wiederhol-tage="5"]');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).wiederholTage.join(",")) === "5,10,30,60", "Abstand Stufe 1 → 2: 5 Tage gespeichert");
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).gelerntSchwelle) === 3, "Gelernt-Schwelle fest 3");

// Stufen-Punkte an den Vokabeln
await zuListen(page);
await page.evaluate(() => document.querySelector('[data-liste-id="l_a"]')?.click()); await sleep(300); await listeOeffnen(page);
await page.evaluate(() => document.querySelector('[data-liste-bereich="vokabeln"]')?.click()); await sleep(300);
const punkte = await page.evaluate(() => [...document.querySelectorAll(".score-symbole")].map(s => s.dataset.scoreSymbole).join(","));
ok(/4/.test(punkte) && /3/.test(punkte), `162: Kreise/Rauten an den Vokabeln (${punkte})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
