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
  // Ende eines Durchlaufs: „Weiter →“ führt zur Session-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const startText = () => page.evaluate(() =>
  document.querySelector("[data-start-knopf]")?.dataset.startAnzahl || "(kein Start-Button)");
// Rolle-Button in der Spaltenzeile mit diesem Namen
const rolle = async (spaltenName, rollenText) => {
  const done = await page.evaluate((n, r) => {
    const zeile = [...document.querySelectorAll("div")].find(d => d.style.padding === "10px 16px" && d.textContent.includes(n));
    const b = zeile && [...zeile.querySelectorAll("button")].find(b => b.textContent.trim().startsWith(r));
    b?.click(); return !!b;
  }, spaltenName, rollenText);
  if (!done) throw new Error(`Rolle nicht gefunden: ${spaltenName} ${rollenText}`);
  await sleep(250);
};
const spalteAnklicken = async (name) => {
  await page.evaluate(n => {
    const zeile = [...document.querySelectorAll("div")].find(d => d.style.padding === "10px 16px" && d.textContent.includes(n));
    zeile?.firstElementChild?.click();
  }, name);
  await sleep(250);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = (akt) => Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: akt[t] || "", aktiv: !!akt[t] }]));
  const fr = Array.from({ length: 195 }, (_, i) => ({ id: i + 1, E1: { wert: "mot" + i, falsch: [] }, D1: { wert: "Wort" + i, falsch: [] } }));
  const listen = [
    { id:"l_en", name:"Irregular Verbs", sprache:"en", spalten: sp({E1:"Infinitive",E2:"Simple Past",E3:"Past Participle",D1:"Deutsch"}),
      naechste_id:3, vokabeln:[
        { id:1, E1:{wert:"go",falsch:[]}, E2:{wert:"went",falsch:[]}, E3:{wert:"gone",falsch:[]}, D1:{wert:"gehen",falsch:[]} },
        { id:2, E1:{wert:"see",falsch:[]}, E2:{wert:"saw",falsch:[]}, E3:{wert:"seen",falsch:[]}, D1:{wert:"sehen",falsch:[]} } ] },
    { id:"l_fr", name:"Vocabulaire", sprache:"fr", spalten: sp({E1:"Französisch",D1:"Deutsch"}), naechste_id:196, vokabeln: fr },
  ];
  listen.forEach(l => localStorage.setItem("vokabel_liste_" + l.id, JSON.stringify(l)));
  localStorage.setItem("vokabel_listen_index", JSON.stringify(listen.map(l => ({ id:l.id, name:l.name, sprache:l.sprache }))));
});
await page.reload(); await sleep(500);

// Verben über Liste-Detail "Quiz starten" (setzt Standard D1 → E1)
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Irregular Verbs");
await clickText("button", "Quiz starten", true);
// Abfrage-Modus öffnen, E2 + E3 als weitere Antworten
await page.click("[data-abfragemodus]"); await sleep(300);
await spalteAnklicken("Simple Past");
await rolle("Simple Past", "Antwort");
await spalteAnklicken("Past Participle");
await rolle("Past Participle", "Antwort");
console.log("     Verben:", await startText());

// Zur französischen Liste wechseln (über Listen-Auswahl im Quiz-Tab)
await page.evaluate(() => window.scrollTo(0, 0));
await clickText("button", "Irregular Verbs");          // Listen-Chip öffnet Auswahl
await clickText(".quiz-setup-check", "Irregular Verbs"); // abwählen
await clickText(".quiz-setup-check", "Vocabulaire");     // anwählen
await page.evaluate(async () => { const u = document.querySelector("[data-umfang]"); if (!u) return; u.click(); await new Promise(r => setTimeout(r, 200)); document.querySelector('[data-umfang-wahl="alle"]')?.click(); }); await sleep(300);
await sleep(400);
const nachWechsel = await startText();
console.log("     Französisch:", nachWechsel);
ok(nachWechsel === "195", "Nach Wechsel zur französischen Liste: 195 Vokabeln abfragbar");

await clickText("[data-start-knopf]", "");
await sleep(500);
const frage = await page.evaluate(() => document.body.innerText);
ok(/Wort\d+/.test(frage), "Quiz gestartet, französische Vokabel wird abgefragt");
await browser.close();
process.exit(fehler ? 1 : 0);
