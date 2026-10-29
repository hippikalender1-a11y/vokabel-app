import puppeteer from "puppeteer-core";

// Karten-Modus: gelber Info-Kasten unter der Antwort (eingeklappt „Info“), Pinnadel hält ihn offen,
// „i“ in der Kopfzeile blendet ihn aus – beides dauerhaft gespeichert
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
const kasten = () => page.evaluate(() => {
  const k = document.querySelector("[data-karte-info]");
  return k ? { zustand: k.dataset.karteInfo, text: k.innerText.replace(/\s+/g, " ").trim() } : null;
});
const schalter = () => page.evaluate(() => document.querySelector("[data-karte-info-schalter]")?.dataset.karteInfoSchalter || null);
const einst = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}"));
const starte = async () => {
  await clickText(".tab", "Listen");
  await clickText(".karte-zeile", "Verbes");
  await clickText("button", "Quiz starten", true);
  await clickText("button", "Quiz starten (");
  await sleep(300);
};
const gewusst = async () => {
  await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(300);
  await clickText(".karte-btn-ja", "Gewusst"); await sleep(1200);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch",i1:"Beispiel"}[t] || "", aktiv: ["E1","D1","i1"].includes(t) }]));
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:4, vokabeln: [
    { id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]}, i1:{wert:"Je vais à Paris.",falsch:[]} },
    { id:2, E1:{wert:"venir",falsch:[]}, D1:{wert:"kommen",falsch:[]}, i1:{wert:"Il vient demain.",falsch:[]} },
    { id:3, E1:{wert:"voir",falsch:[]},  D1:{wert:"sehen",falsch:[]},  i1:{wert:"On se voit.",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await starte();

let k = await kasten();
console.log("     Kasten:", JSON.stringify(k));
ok(k?.zustand === "zu" && /^Info/i.test(k.text) && !/Paris|demain|voit/.test(k.text), "Karte: Info-Kasten eingeklappt, nur „Info“");
ok(await schalter() === "an", "Kopfzeile: „i“-Knopf vorhanden (an)");
ok(await page.evaluate(() => document.querySelector(".karte-aufdecken") !== null), "Antippen des Kastens deckt die Karte nicht auf");

await page.click("[data-karte-info]"); await sleep(200);
k = await kasten();
ok(k?.zustand === "offen" && /Paris|demain|voit/.test(k.text), "Antippen: Kasten aufgeklappt mit Info-Text");
ok(await page.evaluate(() => document.querySelector(".karte-aufdecken") !== null), "Karte bleibt verdeckt");
await page.screenshot({ path: "karteninfo_offen.png" });
await page.click("[data-karte-info]"); await sleep(200);
ok((await kasten())?.zustand === "zu", "nochmal antippen: wieder eingeklappt");

// Aufdecken: Kasten verschwindet, Bewertungs-Knöpfe stehen an seiner Stelle
const vorher = await page.evaluate(() => document.querySelector("[data-karte-info]").getBoundingClientRect().top);
await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(300);
const lage = await page.evaluate(() => ({ kasten: !!document.querySelector("[data-karte-info]"), knoepfe: document.querySelector(".karte-bewertung")?.getBoundingClientRect().top }));
console.log("     Kasten oben vorher:", Math.round(vorher), "Knöpfe oben:", Math.round(lage.knoepfe));
ok(!lage.kasten && Math.abs(lage.knoepfe - vorher) < 12, "aufgedeckt: Kasten weg, Gewusst/Nicht gewusst an seiner Stelle");
await page.screenshot({ path: "karteninfo_aufgedeckt.png" });
await clickText(".karte-btn-ja", "Gewusst"); await sleep(1200);
ok((await kasten())?.zustand === "zu", "nächste Karte: Kasten wieder eingeklappt");

// Pinnadel: dauerhaft offen
await page.click("[data-karte-info]"); await sleep(200);
await page.click("[data-karte-info-pin]"); await sleep(200);
ok((await einst()).karteInfoPin === true, "Pinnadel gespeichert");
await gewusst();
ok((await kasten())?.zustand === "offen", "angeheftet: nächste Karte gleich aufgeklappt");
await page.click("[data-karte-info]"); await sleep(200);
ok((await kasten())?.zustand === "offen", "angeheftet: Antippen klappt nicht zu");

// „i“: Kasten aus, dauerhaft
await page.click("[data-karte-info-schalter]"); await sleep(200);
ok(!(await kasten()) && await schalter() === "aus" && (await einst()).karteInfo === false, "„i“ aus: Kasten weg, gespeichert");
await clickText(".topbar-back", "Beenden"); await sleep(500);
await page.reload(); await sleep(500);
await starte();
ok(!(await kasten()) && await schalter() === "aus", "nach Neustart: Info bleibt aus");
await page.click("[data-karte-info-schalter]"); await sleep(200);
ok((await kasten())?.zustand === "offen", "„i“ an: Kasten wieder da, Pinnadel gilt weiter");
await page.click("[data-karte-info-pin]"); await sleep(200);
ok((await einst()).karteInfoPin === false && (await kasten())?.zustand === "offen", "Pinnadel gelöst: bleibt für diese Karte offen");

// Vokabeln ohne Info-Text: Kasten bleibt, Hinweis „Keine Zusatzinfo vorhanden“
await clickText(".topbar-back", "Beenden"); await sleep(500);
await page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem("vokabel_liste_l_fr"));
  l.vokabeln.forEach(v => { delete v.i1; });
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
});
await page.reload(); await sleep(500);
await starte();
k = await kasten();
console.log("     ohne Info-Text:", JSON.stringify(k));
ok(await schalter() === "an" && k?.zustand === "zu", "ohne Info-Text: „i“ und eingeklappter Kasten da");
await page.click("[data-karte-info]"); await sleep(200);
ok(/Keine Zusatzinfo vorhanden/.test((await kasten())?.text || ""), "aufgeklappt: „Keine Zusatzinfo vorhanden“");

// Liste ohne Info-Spalte: kein „i“, kein Kasten
await clickText(".topbar-back", "Beenden"); await sleep(500);
await page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem("vokabel_liste_l_fr"));
  l.spalten.i1.aktiv = false;
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
});
await page.reload(); await sleep(500);
await starte();
ok(!(await schalter()) && !(await kasten()), "ohne Info-Spalte: kein „i“, kein Kasten");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
