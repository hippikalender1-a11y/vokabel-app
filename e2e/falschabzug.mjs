import puppeteer from "puppeteer-core";

// Regel „Nicht gewusst zieht 1 Punkt ab“ je Stufe: an → immer genau −1 (keine Staffelung mehr), aus → Score bleibt gleich
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
const scores = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.map(v => v.fortschritt?.score ?? null));

// Runde: alle Karten „Nicht gewusst“, Wiederholungen abbrechen
const runde = async (modus, regel) => {
  await page.goto(URL);
  await page.evaluate((modus, regel) => {
    localStorage.clear();
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" });
    localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id: 3,
      vokabeln: [{ id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]}, fortschritt: f(0) }, { id:2, E1:{wert:"venir",falsch:[]}, D1:{wert:"kommen",falsch:[]}, fortschritt: f(2) }] }));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Verbes", sprache:"fr" }]));
    localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus, gelerntSchwelle: 6, sprache: "alle", ...(regel === undefined ? {} : { stufen: { [modus]: { falschAbzug: regel } } }) }));
  }, modus, regel);
  await page.reload(); await sleep(500);
  await clickText(".tab", "Listen");
  await clickText(".karte-zeile", "Verbes");
  await clickText("button", "Quiz starten", true);
  await clickText("[data-start-knopf]", "");
  await sleep(300);
  // jede Vokabel mehrfach „nicht gewusst“ (auch in der Wiederholung) – früher gestaffelt −1/−2/−3
  for (let i = 0; i < 10; i++) {
    if (await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.includes("Wiederholung starten") || b.textContent.includes("Weiter zur Wiederholung"))))
      await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Wiederholung starten|Weiter zur Wiederholung/.test(b.textContent))?.click());
    if (!(await page.$(".karte-aufdecken"))) break;
    await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(150);
    await page.click(".karte-btn-nein"); await sleep(150);
    await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(300);
  }
  return scores();
};

let sc = await runde("schwer");
console.log("     Schwer (Standard):", JSON.stringify(sc));
ok(sc[0] === -1 && sc[1] === 1, "Schwer (Standard: Abzug an): genau −1 je Vokabel, keine Staffelung");
sc = await runde("einfach");
console.log("     Einfach (Standard):", JSON.stringify(sc));
ok(sc[0] === 0 && sc[1] === 2, "Einfach (Standard: kein Abzug): Score bleibt gleich");
sc = await runde("einfach", true);
ok(sc[0] === -1 && sc[1] === 1, "Einfach mit eingeschalteter Regel: −1");
sc = await runde("schwer", false);
ok(sc[0] === 0 && sc[1] === 2, "Schwer mit ausgeschalteter Regel: Score bleibt gleich");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
