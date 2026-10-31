import puppeteer from "puppeteer-core";

// Klammerhinweise: nicht vorlesen, nicht verlangen, dezent anzeigen; Aufräum-Werkzeug „( ) → Info“ mit Vorschau
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
await page.evaluateOnNewDocument(() => {
  window.__gesprochen = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, "speechSynthesis", { value: { getVoices: () => [], cancel() {}, addEventListener() {}, speak(u) { window.__gesprochen.push(u.text); } } });
});
const liste = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_en")));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const w = [["point (= Punkt)", "Punkt; Komma (bei Zahlenangaben)"], ["(un)lucky", "(un)glücklich"], ["house", "Haus"]];
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify({ id:"l_en", name:"Words", sprache:"en", spalten: sp, naechste_id: 4,
    vokabeln: w.map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_en", name:"Words", sprache:"en" }]));
  const k = { listenIds:["l_en"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"tippen"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"Words", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ autoplay: true, vorlesen: ["E1", "D1"], gelerntSchwelle: 3, sprache: "alle" }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300);
await clickText(".slot-chip", "Words");
await clickText("button", "Quiz starten (");
await sleep(500);

// Frage „Punkt; Komma (bei Zahlenangaben)“: Hinweis dezent, vorgelesen ohne Klammer
const frage = await page.evaluate(() => ({ text: document.querySelector(".quiz-frage-text").textContent, hinweis: document.querySelector(".quiz-frage-text .klammer-hinweis")?.textContent }));
console.log("     Frage:", JSON.stringify(frage), "| gesprochen:", JSON.stringify(await page.evaluate(() => window.__gesprochen)));
ok(frage.hinweis === "(bei Zahlenangaben)", "Anzeige: Klammerhinweis dezent (eigene, kleine Schrift)");
ok(await page.evaluate(() => window.__gesprochen.includes("Punkt; Komma")), "Vorlesen ohne Klammerhinweis: „Punkt; Komma“");
// Antwort „point“ ohne Klammer → richtig
await page.type("input.inp", "point"); await page.keyboard.press("Enter"); await sleep(400);
ok(await page.evaluate(() => document.querySelector(".quiz-antwort-box")?.className.includes("richtig")), "Antwort „point“ (ohne „(= Punkt)“) gilt als richtig");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Weiter"))?.click()); await sleep(500);
// (un)lucky bleibt ein Wort
await page.type("input.inp", "unlucky"); await page.keyboard.press("Enter"); await sleep(400);
ok(await page.evaluate(() => document.querySelector(".quiz-antwort-box")?.className.includes("richtig")), "angehängte Klammer „(un)lucky“: „unlucky“ richtig wie bisher");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Beenden")?.click()); await sleep(400);
await page.evaluate(() => document.querySelector("[data-zur-auswertung]")?.click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Zur Übersicht")?.click()); await sleep(400);

// Aufräum-Werkzeug
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Words");
await page.evaluate(() => { if (!document.querySelector("[data-klammern-werkzeug]")) [...document.querySelectorAll("button")].find(b => /▼|▲/.test(b.textContent) && b.closest(".liste-detail-header"))?.click(); });
await sleep(300);
if (!(await page.$("[data-klammern-werkzeug]"))) await page.evaluate(() => [...document.querySelectorAll("button, span, div")].find(x => x.title?.includes("Aktionen") || /Aktionen/.test(x.getAttribute?.("data-info") || ""))?.click());
await sleep(300);
await page.evaluate(() => document.querySelector("[data-klammern-werkzeug]").click()); await sleep(300);
const vorschau = await page.evaluate(() => ({ anzahl: document.querySelector("[data-klammer-anzahl]")?.dataset.klammerAnzahl, text: document.querySelector("[data-klammern-modal]")?.innerText.replace(/\s+/g, " ") }));
console.log("     Vorschau:", vorschau.text.slice(0, 260));
ok(vorschau.anzahl === "1" && /point \(= Punkt\) → point/.test(vorschau.text) && /Info: = Punkt; bei Zahlenangaben/.test(vorschau.text), "Vorschau: 1 Vokabel, „point“ + Info „= Punkt; bei Zahlenangaben“ ((un)lucky bleibt)");
await page.click("[data-klammer-verschieben]"); await sleep(400);
const l = await liste();
ok(l.vokabeln[0].E1.wert === "point" && l.vokabeln[0].D1.wert === "Punkt; Komma" && l.vokabeln[0].i1.wert === "= Punkt; bei Zahlenangaben" && l.spalten.i1.aktiv && l.spalten.i1.name === "Hinweis",
  "verschoben: Wort-Spalten ohne Klammer, Info-Spalte „Hinweis“ eingeschaltet und gefüllt");
ok(l.vokabeln[1].E1.wert === "(un)lucky" && !l.vokabeln[1].i1, "(un)lucky unverändert");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
