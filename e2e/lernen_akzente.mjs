import puppeteer from "puppeteer-core";
import { slotLaden } from "./hilfen.mjs";

// Lernen in der Abfrageart Akzente: das Quiz danach nutzt die Regeln der unter „Lernen einstellen“ gewählten Stufe
// (Standard „Ohne Hilfen“: Akzent-Buchstaben nicht hervorgehoben, kein Zähler); „Wie Leicht“: hervorgehoben
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
await page.evaluateOnNewDocument(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, "speechSynthesis", { value: { getVoices: () => [], cancel() {}, addEventListener() {}, speaking: false, speak() {} } });
});

// Lernen bis zum Paket-Ende, dann „Quiz mit diesen …“; liefert Hervorhebung/Zähler der ersten Akzent-Frage
const lernenUndQuiz = async quizStufe => {
  await page.goto(URL);
  await page.evaluate(quizStufe => {
    localStorage.clear();
    localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", gelerntSchwelle:6, sprache:"alle", lernen: { aktiv: true, halte: 1, ...(quizStufe ? { quizStufe } : {}) } }));
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const w = [["élève","Schüler"],["café","Kaffee"],["été","Sommer"]];
    localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Akzente", sprache:"fr", spalten: sp, naechste_id: 4,
      vokabeln: w.map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } })) }));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Akzente", sprache:"fr" }]));
    const art = { quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"akzent"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
    const k = { listenIds:["l_fr"], vokabelAuswahl:[], bereichTyp:"alle", ...art, art:"akzente", arten:{ akzente: art } };
    localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"Akzente", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
  }, quizStufe);
  await page.reload(); await sleep(500);
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300);
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll(".slot-chip")].find(c => c.textContent.includes("Akzente")).click()); await sleep(600); await slotLaden(page);
  const art = await page.evaluate(() => document.querySelector("[data-start-arten] [data-quiz-art].aktiv")?.dataset.quizArt);
  await page.click("[data-start-knopf]"); await sleep(250);
  await page.click("[data-lernen-pause]"); await sleep(100);
  for (let i = 0; i < 10 && !(await page.$("[data-lernen-fertig]")); i++) { await page.click("[data-lernen-karte]"); await sleep(120); }
  await page.click("[data-lernen-quiz]"); await sleep(500);
  const r = await page.evaluate(() => ({ kacheln: document.querySelectorAll(".akzent-kachel").length, markiert: document.querySelectorAll(".akzent-kachel.markiert").length, zaehler: !!document.querySelector(".akzent-zaehler") }));
  return { art, ...r };
};

let r = await lernenUndQuiz();
console.log("     Standard:", JSON.stringify(r));
ok(r.art === "akzente" && r.kacheln > 0, "Akzente: Lernen, danach Akzent-Quiz");
ok(r.markiert === 0 && !r.zaehler, "Standard (Ohne Hilfen): keine Hervorhebung, kein Akzent-Zähler");
r = await lernenUndQuiz("einfach");
console.log("     Leicht:", JSON.stringify(r));
ok(r.markiert > 0, "„Wie Leicht“ gewählt: Akzent-Buchstaben hervorgehoben");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
