import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
const ok = (cond, msg) => console.log(cond ? "OK  " : "FAIL", msg);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, text) => {
  const done = await page.evaluate((sel, text) => {
    const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text);
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(250);
};
const bodyText = () => page.evaluate(() => document.body.innerText);

// 1) Alte englische Liste (ohne sprache, ohne E3) direkt in localStorage
await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const liste = { id: "liste_alt", name: "Englisch Unit 1",
    spalten: { E1:{name:"Englisch",aktiv:true}, E2:{name:"",aktiv:false}, D1:{name:"Deutsch",aktiv:true},
               D2:{name:"",aktiv:false}, i1:{name:"",aktiv:false}, i2:{name:"",aktiv:false} },
    naechste_id: 3, vokabeln: [{ id:1, E1:{wert:"go",falsch:[]}, D1:{wert:"gehen",falsch:[]} },
                               { id:2, E1:{wert:"see",falsch:[]}, D1:{wert:"sehen",falsch:[]} }] };
  localStorage.setItem("vokabel_liste_liste_alt", JSON.stringify(liste));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"liste_alt", name:"Englisch Unit 1" }]));
  // Vorlesen protokollieren
});
await page.evaluateOnNewDocument(() => {
  window.__gesprochen = [];
  if (window.speechSynthesis) window.speechSynthesis.speak = u => window.__gesprochen.push({ text: u.text, lang: u.lang });
});
await page.reload(); await sleep(500);
const idx = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_listen_index")));
ok(idx[0].sprache === "en", `Migration Index-Sprache: ${JSON.stringify(idx)}`);

// 2) Französische Liste importieren
await clickText(".tab", "Listen");
await clickText("button", "Neu");
await page.type("textarea.inp", "Französisch // Deutsch\nl'été // der Sommer\nl'école // die Schule\nle garçon // der Junge");
await clickText("button", "Analysieren");
let t = await bodyText();
ok(/Fremdsprache \(Spalten E1–E3\)/.test(t), "Sprachauswahl im Import sichtbar");
const aktiveSprache = await page.evaluate(() => [...document.querySelectorAll(".typ-btn.aktiv")].map(b => b.textContent.trim()));
ok(aktiveSprache.some(s => s.includes("Französisch")), `Französisch automatisch erkannt: ${aktiveSprache}`);
// Spalten zuweisen: Spalte 0 → E1, Spalte 1 → D1
await page.evaluate(() => {
  const z = document.querySelectorAll(".spalten-zuweisung");
  [...z[0].querySelectorAll("button")].find(b => b.textContent.trim() === "E1")?.click();
});
await sleep(150);
await page.evaluate(() => {
  const z = document.querySelectorAll(".spalten-zuweisung");
  [...z[1].querySelectorAll("button")].find(b => b.textContent.trim() === "D1")?.click();
});
await sleep(150);
const nameInp = await page.$('input[placeholder="z.B. Irregular Verbs"]');
await nameInp.type("Unité 1");
await clickText("button", "Importieren (3)");
const listeFr = await page.evaluate(() => {
  const i = JSON.parse(localStorage.getItem("vokabel_listen_index"));
  const e = i.find(l => l.name === "Unité 1");
  return { index: e, liste: e && JSON.parse(localStorage.getItem("vokabel_liste_" + e.id)) };
});
ok(listeFr.index?.sprache === "fr" && listeFr.liste?.sprache === "fr", `Liste als Französisch gespeichert`);

// 3) Sprach-Chip in Kopfzeile + Filter
t = await bodyText();
ok(t.includes("🇬🇧 Englisch Unit 1") && t.includes("🇫🇷 Unité 1"), "Flaggen in Übersicht bei 'Alle'");
await clickText(".topbar button", "▾");
t = await bodyText();
ok(t.includes("Alle Sprachen") && t.includes("Französisch") && t.includes("Englisch"), "Sprachmenü geöffnet");
await clickText(".karte-zeile", "Französisch");
t = await bodyText();
ok(t.includes("Unité 1") && !t.includes("Englisch Unit 1"), "Filter Französisch: nur französische Liste");
const einst = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).sprache);
ok(einst === "fr", "Sprachwahl gespeichert");

// Quiz-Tab: Listenauswahl zeigt nur französische Liste
await clickText(".tab", "Quiz");
t = await bodyText();
ok(!t.includes("Englisch Unit 1"), "Quiz-Tab zeigt keine englische Liste");
await clickText(".tab", "Statistik");
t = await bodyText();
ok(!t.includes("Englisch Unit 1"), "Statistik zeigt keine englische Liste");

// 3b) KI-Prompt mit Französisch vorausgewählt
await clickText(".tab", "Listen");
await clickText("button", "Neu");
await clickText("button", "Prompt generieren");
const prompt = await page.evaluate(() => [...document.querySelectorAll("textarea")].map(t => t.value).join(" "));
ok(prompt.includes("Französisch // Deutsch") && prompt.includes("aller"), "KI-Prompt auf Französisch");
await page.goto(URL); await sleep(500);

// 4) Vorlesen in Liste-Detail mit fr-FR
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Unité 1");
t = await bodyText();
ok(/fremdsprache/i.test(t), "Sprachauswahl in Liste-Detail");
// Vokabeln aufklappen und ersten Lautsprecher drücken
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find(b => /Vokabeln/.test(b.textContent) && b.closest(".sektion-header, .liste-detail-header, div"));
});
const gesprochen = await page.evaluate(async () => {
  // alle Vorlesen-Buttons (title=Vorlesen) suchen, ggf. Vokabeln aufklappen
  let btn = document.querySelector('button[title="Vorlesen"]');
  if (!btn) {
    const tg = [...document.querySelectorAll(".btn-toggle")];
    window.__dbg = tg.map(b => b.getAttribute("title") || b.parentElement.textContent.trim().slice(0,30));
    tg.find(b => /Vokabeln/.test(b.parentElement.textContent))?.click();
    await new Promise(r => setTimeout(r, 400));
    btn = document.querySelector('button[title="Vorlesen"]');
  }
  window.__dbg2 = !!btn;
  btn?.click();
  return [window.__gesprochen, window.__dbg, window.__dbg2, typeof window.speechSynthesis];
});
ok(gesprochen?.[0]?.[0]?.lang === "fr-FR", `Vorlesen fr-FR: ${JSON.stringify(gesprochen)}`);

// 5) Sprache der Liste wechseln → Filter folgt
await clickText(".typ-btn", "Spanisch");
const nachher = await page.evaluate(() => ({
  einst: JSON.parse(localStorage.getItem("vokabel_einstellungen")).sprache,
  idx: JSON.parse(localStorage.getItem("vokabel_listen_index")).find(l => l.name === "Unité 1").sprache }));
ok(nachher.idx === "es" && nachher.einst === "es", `Listensprache geändert, Filter folgt: ${JSON.stringify(nachher)}`);
await clickText(".typ-btn", "Französisch");

// 6) Zurück auf Alle
await clickText(".topbar button", "▾");
await clickText(".karte-zeile", "Alle Sprachen");
await clickText(".tab", "Listen");
t = await bodyText();
ok(t.includes("Englisch Unit 1") && t.includes("Unité 1"), "Alle Sprachen: beide Listen");

// 7) TXT-Export mit Sprach-Kennung
const txt = await page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem("vokabel_liste_" + JSON.parse(localStorage.getItem("vokabel_listen_index")).find(l => l.name === "Unité 1").id));
  return l.spalten.E3 ? "E3 vorhanden" : "E3 fehlt";
});
ok(txt === "E3 vorhanden", "Neue Liste hat Spalte E3");

await page.screenshot({ path: "uebersicht.png" });
await clickText(".topbar button", "▾");
await page.screenshot({ path: "menu.png" });
await browser.close();
