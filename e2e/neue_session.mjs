import puppeteer from "puppeteer-core";
import { slotLaden } from "./hilfen.mjs";

// Quiz-Tab: Kopf schaltet zwischen Auswahl (Sessions, Verlauf) und Einstellungen um; „＋ Neue Session aus Listen“:
// Eine Session (Listen wählen, einstellen) oder Mehrere Sessions (Liste wählen → Aufteilen)
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
const ansicht = () => page.evaluate(() => document.querySelector("[data-quiz-ansicht]")?.dataset.quizAnsicht);
const sichtbar = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].some(e => e.offsetParent), sel);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  for (const [id, n] of [["l_a","Unité 1"],["l_b","Unité 2"]])
    localStorage.setItem("vokabel_liste_"+id, JSON.stringify({ id, name:n, sprache:"fr", spalten: sp, naechste_id: 31, vokabeln: Array.from({length:30},(_, i) => ({ id: i+1, E1: { wert: "mot"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] } })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([["l_a","Unité 1"],["l_b","Unité 2"]].map(([id,name],i) => ({ id, name, sprache:"fr", platz:{z:i,s:0} }))));
  const k = { listenIds:["l_a"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g1", name:"Mein Quiz", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], gelerntSchwelle: 3, sprache: "alle" }));
});
await page.reload(); await sleep(600);

// Start: nur die Auswahl
ok(await ansicht() === "auswahl" && await page.$("[data-neue-session]") && !(await sichtbar("[data-start-knopf]")) && !(await sichtbar(".quiz-setup-check")),
  "App-Start: Session-Auswahl ohne Einstellungen, Listen und Start-Knopf");
// Session wählen → Einstellungen
await page.evaluate(() => [...document.querySelectorAll(".slot-chip")].find(c => c.textContent.includes("Mein Quiz")).click()); await sleep(900); await slotLaden(page);
ok(await ansicht() === "einstellungen" && await sichtbar("[data-start-knopf]"), "Session gewählt: Einstellungen mit Start-Knopf");
// Kopf antippen → Auswahl, nochmal → zurück zu den Einstellungen (ohne Auswahl)
await page.click("[data-slot-kopf-name]"); await sleep(300);
ok(await ansicht() === "auswahl" && !(await sichtbar("[data-start-knopf]")), "Kopf antippen: Auswahl, Einstellungen ausgeblendet");
await page.click("[data-slot-kopf-name]"); await sleep(300);
ok(await ansicht() === "einstellungen" && await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").textContent.trim()) === "Mein Quiz", "nochmal: zurück zu den Einstellungen, Session bleibt geladen");

// Neue Session: Eine
await page.click("[data-slot-kopf-name]"); await sleep(300);
await page.click("[data-neue-session]"); await sleep(300);
ok(await page.$('[data-neue-session-dialog="art"]') && await page.$('[data-neue-session-art="eine"]') && await page.$('[data-neue-session-art="mehrere"]'), "Dialog: Eine Session / Mehrere Sessions");
await page.click('[data-neue-session-art="eine"]'); await sleep(400);
ok(await ansicht() === "einstellungen" && await sichtbar(".quiz-setup-check") && await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").textContent.trim()) === "Neues Quiznicht gespeichert",
  "Eine Session: „Neues Quiz · nicht gespeichert“ mit Listen-Auswahl");

// Neue Session: Mehrere → Liste wählen → Aufteilen
await page.click("[data-slot-kopf-name]"); await sleep(300);
await page.click("[data-neue-session]"); await sleep(300);
await page.click('[data-neue-session-art="mehrere"]'); await sleep(300);
ok(await page.$('[data-neue-session-dialog="liste"]') && await page.$('[data-aufteilen-liste="l_a"]') && await page.$('[data-aufteilen-liste="l_b"]'), "Mehrere: Listen zur Wahl");
await page.click('[data-aufteilen-liste="l_b"]'); await sleep(500);
ok(await ansicht() === "einstellungen" && /„Unité 2“ in Sessions aufteilen/.test(await page.evaluate(() => document.body.innerText)) && await page.$("[data-aufteilen-anlegen]"),
  "Liste gewählt: Aufteilen-Kasten für „Unité 2“");
await page.click("[data-aufteilen-anlegen]"); await sleep(500);
const namen = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.map(g => g.name));
ok(namen.includes("Unité 2 (1 - 20)") && namen.includes("Unité 2 (21 - 30)"), `Sessions angelegt (${namen.join(", ")})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
