import puppeteer from "puppeteer-core";

// Mehrere Antworten: jede Antwort (gewusst ✓ oder nicht ✗) bleibt oben untereinander stehen,
// zwischen den Antworten keine Verzögerung; die Pause vor der nächsten Vokabel endet mit einem Antippen
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
  // Ende eines Durchlaufs: „Weiter →“ führt zur Session-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const stapel = () => page.evaluate(() => [...document.querySelectorAll("[data-vorig]")].map(d => d.dataset.vorig + ":" + d.querySelector("strong").textContent.trim()));
const frage = () => page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
const aufdecken = async () => { await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(150); };
const karte = async ja => { await page.click(ja ? ".karte-btn-ja" : ".karte-btn-nein"); await sleep(80); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const namen = { E1:"Wort", E2:"Plural", E3:"Genus", D1:"Deutsch" };
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: namen[t] || "", aktiv: !!namen[t] }]));
  const w = [["cheval","chevaux","m","Pferd"], ["table","tables","f","Tisch"]];
  const l = { id:"l_fr", name:"Nomen", sprache:"fr", spalten: sp, naechste_id:3,
    vokabeln: w.map(([a, b, c, d], i) => ({ id:i+1, E1:{wert:a,falsch:[]}, E2:{wert:b,falsch:[]}, E3:{wert:c,falsch:[]}, D1:{wert:d,falsch:[]} })) };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
  const k = { listenIds:["l_fr"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1","E2","E3"], quizFrageTyp:"D1",
    quizAntwortTypenGeordnet:["E1","E2","E3"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte", E2:"karte", E3:"karte"}, quizZeigeInfo:{},
    quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"Drei Antworten", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300);
await clickText(".slot-chip", "Drei Antworten");
await clickText("[data-start-knopf]", "");
await sleep(300);

ok(await frage() === "Pferd", "erste Frage: Pferd");
await aufdecken(); await karte(false);
let st = await stapel();
console.log("     nach Nicht gewusst:", JSON.stringify(st));
ok(JSON.stringify(st) === '["falsch:cheval"]', "nicht gewusste Antwort bleibt stehen (✗) – sofort weiter, ohne Pause");
ok(await page.$(".karte-aufdecken"), "nächste Antwort (Plural) wird sofort abgefragt");
await aufdecken(); await karte(true);
st = await stapel();
console.log("     nach Gewusst:", JSON.stringify(st));
ok(JSON.stringify(st) === '["falsch:cheval","richtig:chevaux"]', "Antworten untereinander: ✗ cheval, ✓ chevaux");
ok(await page.evaluate(() => document.querySelector("[data-vorig=falsch] .quiz-vorig-label").textContent.startsWith("✗")), "nicht gewusst mit ✗ markiert");

// letzte Antwort: Pause vor der nächsten Vokabel, Antippen beendet sie
await aufdecken(); await karte(true);
ok(await frage() === "Pferd", "nach der letzten Antwort kurze Pause (noch Pferd)");
await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(100);
ok(await frage() === "Tisch", `Antippen: sofort nächste Vokabel (${await frage()})`);
ok((await stapel()).length === 0, "neue Vokabel: Liste leer");

// Nicht gewusst bei letzter Antwort: Pause ebenfalls per Antippen beendbar
for (const ja of [true, true]) { await aufdecken(); await karte(ja); }
await aufdecken(); await karte(false);
ok(await page.evaluate(() => document.querySelector(".antwort-box, .sektion")?.innerText.includes("Tisch")), "letzte Antwort nicht gewusst: kurze Pause");
await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(200);
const t = await page.evaluate(() => document.querySelector(".topbar-title")?.textContent.trim());
ok(!/^2 \/ 2$/.test(t || ""), `Antippen: sofort weiter (${t})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
