import puppeteer from "puppeteer-core";

// Multiple Choice: immer genau 4 Antworten im 2×2-Raster; mehrere richtige Teile (was / were) → alle richtigen + falsche bis 4
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

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const w = [["was / were","war"],["go","gehen"],["see","sehen"],["come","kommen"],["make","machen"],["take","nehmen"],["give","geben"]];
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify({ id:"l_en", name:"Verbs", sprache:"en", spalten: sp, naechste_id: 8,
    vokabeln: w.map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_en", name:"Verbs", sprache:"en" }]));
  const k = { listenIds:["l_en"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"mc"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"MC", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300);
await clickText(".slot-chip", "MC");
await clickText("button", "Quiz starten (");
await sleep(300);

for (let i = 0; i < 3; i++) {
  const r = await page.evaluate(() => {
    const raster = document.querySelector("[data-mc-raster]");
    const knoepfe = [...raster.querySelectorAll("[data-mc-knopf]")];
    const rs = knoepfe.map(b => b.getBoundingClientRect());
    return { frage: document.querySelector(".quiz-frage-text").textContent.trim(), texte: knoepfe.map(b => b.textContent.trim()),
      spalten: getComputedStyle(raster).gridTemplateColumns.split(" ").length, gleich: rs.every(x => Math.abs(x.width - rs[0].width) < 1) };
  });
  console.log("     ", r.frage, "→", r.texte.join(" | "));
  ok(r.texte.length === 4 && r.spalten === 2 && r.gleich, `${r.frage}: genau 4 gleich große Antworten im 2×2-Raster`);
  if (r.frage === "war") ok(r.texte.includes("was") && r.texte.includes("were"), "war: beide richtigen Teile (was, were) + 2 falsche");
  // richtige Antwort(en) wählen
  const richtig = { war: ["was", "were"], gehen: ["go"], sehen: ["see"] }[r.frage] || [];
  for (const t of richtig) await page.evaluate(t => [...document.querySelectorAll("[data-mc-knopf]")].find(b => b.textContent.trim() === t)?.click(), t);
  await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Weiter"))?.click());
  await sleep(1300);
}

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
