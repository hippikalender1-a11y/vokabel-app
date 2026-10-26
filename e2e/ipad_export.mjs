import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
await page.setViewport({ width: 820, height: 1100 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
// Teilen-Menü simulieren: geteilte Datei aufzeichnen
await page.evaluateOnNewDocument(() => {
  window.__geteilt = [];
  Navigator.prototype.canShare = () => true;
  Navigator.prototype.share = async (data) => {
    for (const f of data.files || []) window.__geteilt.push({ name: f.name, typ: f.type, inhalt: await f.text() });
  };
});
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, text, exact = false) => {
  const done = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    if (el) el.click(); return !!el;
  }, sel, text, exact);
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_en", name:"Englisch Buch 5. Klasse", sprache:"en", spalten: sp, naechste_id:3, vokabeln: [
    { id:1, E1:{wert:"go",falsch:[]}, D1:{wert:"gehen",falsch:[]} }, { id:2, E1:{wert:"see",falsch:[]}, D1:{wert:"sehen",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_en", name:l.name, sprache:"en" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Englisch Buch 5. Klasse");
await page.evaluate(() => [...document.querySelectorAll(".btn-toggle")].find(b => /Aktionen/.test(b.getAttribute("title") || ""))?.click());
await sleep(300);
await clickText("button", "JSON", true);           // "💾 JSON"-Weg (bisher Download)
await clickText(".modal button", "Exportieren", true);
await sleep(500);
const g = await page.evaluate(() => window.__geteilt);
console.log("     geteilt:", JSON.stringify(g.map(x => ({ name: x.name, typ: x.typ, bytes: x.inhalt.length }))));
ok(g.length === 1 && g[0].name === "Englisch Buch 5. Klasse.txt", "iPad: JSON-Export öffnet das Teilen-Menü statt Download (Name ohne „.json.txt“)");
ok(g[0] && JSON.parse(g[0].inhalt)[0].vokabeln.length === 2, "Geteilte Datei enthält die vollständige Liste");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
