import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100 });
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
const infos = () => page.evaluate(() => {
  const t = document.body.innerText;
  return {
    start: [...document.querySelectorAll("button")].map(b => b.textContent.trim()).find(x => /^(Quiz|Diktat) starten/.test(x)) || "",
    hinweis: (t.match(/\d+ gelernte (ausgeblendet|eingeschlossen)/) || [""])[0],
  };
});

// Ü|D|A sitzt in der zugeklappten Kopfzeile der Session-Auswahl
const artWaehlen = async a => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") k.querySelector("button.zeile-rechts")?.click(); });
  await new Promise(r => setTimeout(r, 300));
  await page.click(`[data-quiz-art="${a}"]`);
};
await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: null });
  const l = { id:"l_fr", name:"Vocabulaire", sprache:"fr", spalten: sp, naechste_id:4, vokabeln: [
    { id:1, E1:{wert:"un",falsch:[]}, D1:{wert:"eins",falsch:[]}, fortschritt: f(8) },                       // Quiz gelernt, Diktat nie
    { id:2, E1:{wert:"deux",falsch:[]}, D1:{wert:"zwei",falsch:[]}, fortschritt: f(0), diktatFortschritt: f(8) }, // nur Diktat gelernt
    { id:3, E1:{wert:"trois",falsch:[]}, D1:{wert:"drei",falsch:[]} },                                         // nichts
  ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", autoplay:false, vorlesen:["E1"], gelerntSchwelle:6, sprache:"alle" }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Vocabulaire");
await sleep(300);
let i = await infos();
console.log("     Frage–Antwort:", JSON.stringify(i));
ok(/\(2 /.test(i.start) && i.hinweis === "1 gelernte ausgeblendet", "Quiz: Vokabel mit Quiz-Score 8 ausgeblendet (2 abfragbar)");

await artWaehlen("diktat");
await sleep(300);
i = await infos();
console.log("     Diktat:", JSON.stringify(i));
ok(/\(2 /.test(i.start) && i.hinweis === "1 gelernte ausgeblendet", "Diktat: nur Vokabel mit Diktat-Score 8 ausgeblendet (2 abfragbar)");

// Diktat starten: „deux“ (Diktat gelernt) darf nicht vorkommen, „un“ schon
await page.evaluateOnNewDocument(() => {});
const gesprochen = [];
await page.exposeFunction("__sprich", t => gesprochen.push(t));
await page.evaluate(() => { window.speechSynthesis.speak = u => window.__sprich(u.text); });
await clickText("button", "starten (");
await sleep(600);
const woerter = await page.evaluate(() => {
  // Diktat-Vokabeln aus dem React-State sind nicht direkt lesbar → über Lösung-anzeigen durchklicken
  return null;
});
const gefunden = new Set();
for (let k = 0; k < 2; k++) {
  await clickText("button", "Lösung anzeigen");
  await sleep(300);
  const t = await page.evaluate(() => document.body.innerText);
  for (const w of ["un", "deux", "trois"]) if (new RegExp(`(^|\\n)${w} –`).test(t)) gefunden.add(w);
  const weiter = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes("Weiter")); b?.click(); return !!b; });
  await sleep(400);
  if (!weiter) break;
}
console.log("     Diktat fragte ab:", [...gefunden].join(", "));
ok(gefunden.has("un") && gefunden.has("trois") && !gefunden.has("deux"), "Diktat fragt un + trois ab, nicht deux");

await browser.close();
process.exit(fehler ? 1 : 0);
