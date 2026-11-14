import puppeteer from "puppeteer-core";
import { slotLaden, auswahlZu } from "./hilfen.mjs";
import { stufeWaehlen } from "./hilfen.mjs";

// Lernen pausieren: Schließen merkt den Lernstand je Konfiguration (getrennt vom Abfrage-Fortschritt);
// „Weiter lernen“ macht an derselben Stelle weiter – auch nach einer anderen Liste; alles angesehen → von vorn;
// Lernstand-Knopf fragt nach und löscht den Stand
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
const ladeSlot = async name => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
  await page.evaluate(n => [...document.querySelectorAll(".slot-chip")].find(c => c.textContent.includes(n)).click(), name); await sleep(700); await slotLaden(page);
};
const knopf = () => page.evaluate(() => { const b = document.querySelector("[data-start-knopf]"); return { art: b?.dataset.lernenStart, text: b?.textContent.trim(), stand: document.querySelector('[data-anzahl="lernstand"]')?.textContent.trim() || null }; });
const lernStand = () => page.evaluate(() => ({ stand: document.querySelector("[data-lernen-stand]")?.textContent.replace(/\s/g, ""), wort: document.querySelector("[data-lernen-wort] .lernen-wort")?.textContent.trim() }));
const vor = async n => { for (let i = 0; i < n; i++) { await page.click("[data-lernen-vor]"); await sleep(150); } };
const schliessen = async () => { await page.click("[data-lernen-beenden]"); await sleep(500); await auswahlZu(page); };   // 190: Quiz-Auswahl ist danach offen
const slotDaten = id => page.evaluate(id => JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.find(g => g.id === id), id);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const L = (id, name, w) => ({ id, name, sprache:"fr", spalten: sp, naechste_id: w.length + 1, vokabeln: w.map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } })) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify(L("l_a", "Verbes", [["aller","gehen"],["venir","kommen"],["voir","sehen"],["faire","machen"],["dire","sagen"],["prendre","nehmen"],["mettre","legen"]])));
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify(L("l_b", "Couleurs", [["rouge","rot"],["bleu","blau"],["vert","grün"]])));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Verbes", sprache:"fr" }, { id:"l_b", name:"Couleurs", sprache:"fr" }]));
  const k = id => ({ listenIds:[id], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_a", name:"Verben", timestamp:1, konfiguration:k("l_a"), sessionFortschritt:null, platz:{z:0,s:0} },
    { id:"g_b", name:"Farben", timestamp:2, konfiguration:k("l_b"), sessionFortschritt:null, platz:{z:0,s:1} } ] }));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], modus:"schwer", gelerntSchwelle:6, sprache:"alle", lernen: { pauseWort: 10, pauseUeb: 10, pauseInfo: 10 } }));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300);
await ladeSlot("Verben");
await page.click("[data-umfang]"); await sleep(200); await page.click('[data-umfang-wahl="5"]'); await sleep(300);
await stufeWaehlen(page, "lernen");   // Schwer → Lernen
ok((await knopf()).art === "neu", "Verben: „Lernen starten“");

// lernen, zwei weiter, schließen
await page.click("[data-start-knopf]"); await sleep(400);
await vor(2);
ok((await lernStand()).stand === "3/7", `beim Lernen: 3 / 7 (${(await lernStand()).stand})`);
await schliessen();
let k = await knopf();
console.log("     Knopf:", JSON.stringify(k));
ok(k.art === "weiter" && /Weiter lernen/.test(k.text) && /2 von 7 angesehen/.test(k.text) && k.stand === "2/7", "nach dem Schließen: „Weiter lernen · 2 von 7 angesehen“, Lernstand 2/7");
let g = await slotDaten("g_a");
ok(g.lernStaende?.uebersetzung?.index === 2 && !Object.keys(g.sessionFortschritte || {}).length && !g.sessionFortschritt, "Lernstand im Slot gespeichert, Abfrage-Fortschritt unberührt");

// andere Liste: eigener Lernstand
await ladeSlot("Farben");
ok((await knopf()).art === "neu", "Farben: eigener Lernstand – „Lernen starten“");
await page.click("[data-start-knopf]"); await sleep(400);
await vor(1);
await schliessen();
ok((await knopf()).stand === "1/3", "Farben: Lernstand 1/3");

// zurück zu Verben: weiter an derselben Stelle
await ladeSlot("Verben");
k = await knopf();
ok(k.art === "weiter" && k.stand === "2/7", `Verben: weiterhin 2/7 (${k.stand})`);
await page.click("[data-start-knopf]"); await sleep(400);
let st = await lernStand();
ok(st.stand === "3/7" && st.wort === "voir", `„Weiter lernen“: an derselben Stelle (3 / 7, „voir“) (${JSON.stringify(st)})`);

// Paketende → nächstes Paket → schließen → weiter im zweiten Paket
await vor(3);
ok(await page.$("[data-lernen-fertig]"), "Paket 1 angesehen");
await schliessen();
ok((await knopf()).stand === "5/7", "Paketende gemerkt: 5/7");
await page.click("[data-start-knopf]"); await sleep(400);
ok(await page.$("[data-lernen-fertig]") && await page.$("[data-lernen-weiter]"), "wieder am Paketende mit „Weiter lernen: nächste 2“");
await page.click("[data-lernen-weiter]"); await sleep(400);
await schliessen();
await page.click("[data-start-knopf]"); await sleep(400);
ok((await lernStand()).stand === "6/7", "zweites Paket: weiter bei 6 / 7");

// alles angesehen → Lernstand weg, nächstes Mal von vorn
await vor(2);
ok(await page.$("[data-lernen-fertig]") && /Alle 7 Vokabeln angesehen/.test(await page.evaluate(() => document.querySelector("[data-lernen-fertig]").textContent)), "alle angesehen");
await schliessen();
ok((await knopf()).art === "neu" && !(await page.$("[data-lernstand]")), "danach: wieder „Lernen starten“, kein Lernstand");

// Lernstand-Knopf: nachfragen und löschen
await page.click("[data-start-knopf]"); await sleep(400);
await vor(1);
await schliessen();
ok((await knopf()).stand === "1/7", "Lernstand 1/7");
await page.click("[data-lernstand]"); await sleep(200);
ok(await page.$("[data-lern-reset-frage]"), "antippen: Rückfrage „Lernstand löschen?“");
await page.click("[data-lern-reset-ja]"); await sleep(300);
ok((await knopf()).art === "neu" && !(await slotDaten("g_a")).lernStaende?.uebersetzung, "„Ja, von vorn“: Lernstand gelöscht");

// Farben-Stand blieb
await ladeSlot("Farben");
ok((await knopf()).stand === "1/3", "Farben: Lernstand 1/3 bleibt");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
