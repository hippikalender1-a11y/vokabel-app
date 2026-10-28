import puppeteer from "puppeteer-core";

// Listenansicht: angezeigte Spalten wählbar (je Liste gemerkt); Statistik: Vokabelliste einklappbar
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 1200 });
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
const text = () => page.evaluate(() => document.body.innerText);
const knopf = typ => page.$eval(`[data-ansicht-spalte="${typ}"]`, b => b.classList.contains("aktiv"));
const oeffneListe = async () => {
  await clickText(".tab", "Listen");
  await clickText(".karte-zeile", "Verbes");
  await clickText(".sektion-label", "Vokabeln (");
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch",i1:"Notiz"}[t] || "", aktiv: ["E1","D1","i1"].includes(t) }]));
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:3, vokabeln: [
    { id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]}, i1:{wert:"unregelmäßig",falsch:[]} },
    { id:2, E1:{wert:"venir",falsch:[]}, D1:{wert:"kommen",falsch:[]}, i1:{wert:"être-Verb",falsch:[]} },
  ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);

await oeffneListe();
let t = await text();
ok(/gehen/.test(t) && /unregelmäßig/.test(t), "Listenansicht: alle Spalten sichtbar");
ok(await knopf("E1") && await knopf("D1") && await knopf("i1"), "Anzeigen-Knöpfe: alle aktiv");

await page.click('[data-ansicht-spalte="i1"]'); await sleep(200);
await page.click('[data-ansicht-spalte="D1"]'); await sleep(200);
t = await text();
ok(/aller/.test(t) && !/gehen/.test(t) && !/unregelmäßig/.test(t), "Deutsch und Notiz ausgeblendet");
await page.screenshot({ path: "spaltenansicht.png" });

await page.click('[data-ansicht-spalte="E1"]'); await sleep(200);
ok(await knopf("E1") && /aller/.test(await text()), "letzte sichtbare Spalte lässt sich nicht ausblenden");

await page.reload(); await sleep(500);
await oeffneListe();
t = await text();
ok(/aller/.test(t) && !/gehen/.test(t) && !await knopf("i1"), "Auswahl bleibt nach Neuladen gemerkt");
await page.click('[data-ansicht-spalte="D1"]'); await sleep(200);
ok(/gehen/.test(await text()), "Deutsch wieder eingeblendet");

// Statistik: Vokabelliste einklappen
await clickText(".tab", "Statistik"); await sleep(300);
const zeile = () => page.evaluate(() => /aller – gehen/.test(document.body.innerText));
ok(await zeile(), "Statistik: Vokabelliste offen");
await page.click("[data-statistik-liste-kopf]"); await sleep(200);
ok(!await zeile() && /2 Vokabeln/i.test(await text()), "Statistik: Vokabelliste eingeklappt, Anzahl bleibt sichtbar");
await page.reload(); await sleep(500);
await clickText(".tab", "Statistik"); await sleep(300);
ok(!await zeile(), "Eingeklappt bleibt nach Neuladen");
await page.click("[data-statistik-liste-kopf]"); await sleep(200);
ok(await zeile(), "Statistik: wieder ausgeklappt");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
