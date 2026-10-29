import puppeteer from "puppeteer-core";

// Mehrere Antworten in einer Frage-Runde: immer E1, dann E2, dann E3 – egal in welcher Reihenfolge gewählt, egal welcher Modus
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
const noch = () => page.evaluate(() => (document.body.innerText.match(/Noch: (.*)/) || [])[1]?.trim() || "");

for (const modus of ["karte", "tippen"]) {
  await page.goto(URL);
  await page.evaluate(modus => {
    localStorage.clear();
    const namen = { E1:"Wort", E2:"Plural", E3:"Genus", D1:"Deutsch" };
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: namen[t] || "", aktiv: !!namen[t] }]));
    const l = { id:"l_de", name:"Nomen", sprache:"fr", spalten: sp, naechste_id:2, vokabeln: [
      { id:1, E1:{wert:"cheval",falsch:[]}, E2:{wert:"chevaux",falsch:[]}, E3:{wert:"m",falsch:[]}, D1:{wert:"Pferd",falsch:[]} } ] };
    localStorage.setItem("vokabel_liste_l_de", JSON.stringify(l));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_de", name:l.name, sprache:"fr" }]));
    // Antworten absichtlich in der Reihenfolge E3, E1, E2 gewählt
    const k = { listenIds:["l_de"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E3","E1","E2"], quizFrageTyp:"D1",
      quizAntwortTypenGeordnet:["E3","E1","E2"], quizInfoTypenSession:[], quizSpalteModus:{E1:modus, E2:modus, E3:modus}, quizZeigeInfo:{}, quizModus:"sequenziell" };
    localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"Drei Antworten", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
  }, modus);
  await page.reload(); await sleep(500);
  await clickText(".tab", "Quiz");
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300);
  await clickText(".slot-chip", "Drei Antworten");
  await clickText("button", "Quiz starten (");
  await sleep(300);
  const folge = [await noch()];
  if (modus === "karte") {
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(250);
      await clickText(".karte-btn-ja", "Gewusst"); await sleep(1200);
      folge.push(await noch());
    }
  } else {
    for (const w of ["cheval", "chevaux"]) {
      await page.type(".quiz-aktionen input.inp, input.inp", w); await page.keyboard.press("Enter"); await sleep(600);
      await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Weiter"))?.click()); await sleep(500);
      folge.push(await noch());
    }
  }
  console.log(`     ${modus}:`, JSON.stringify(folge));
  ok(folge[0] === "Plural → Genus" && folge[1] === "Genus", `${modus}: Abfrage in der Reihenfolge Wort → Plural → Genus`);
}

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
