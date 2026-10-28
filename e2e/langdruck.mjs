import puppeteer from "puppeteer-core";

// Lang-Druck per Touch auf gespeicherte Konfiguration: nur Name in der Erklärung, Menü-Knöpfe frei schwebend,
// Lang-Druck + Ziehen → Menü weg, Verschieben-Modus, Eintrag auf neuen Platz; Fenster oben (Tastatur)
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
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
  await sleep(250);
};
const mitte = k => page.evaluate(k => { const r = document.querySelector(`[data-raster-zelle="${k}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, k);
const plaetze = () => page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.map(x => [x.name, `${x.platz.z}|${x.platz.s}`])));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Wörter", sprache:"fr", spalten: sp, naechste_id:3, vokabeln: [{ id:1, E1:{wert:"chat",falsch:[]}, D1:{wert:"Katze",falsch:[]} }] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
  const k = { listenIds:["l_fr"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizSpalteModus:{E1:"karte"}, quizModus:"sequenziell" };
  const e = (id, name, platz) => ({ id, name, timestamp:1, konfiguration:k, sessionFortschritte:{}, platz });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    e("g1", "Unregelmäßige Verben Kapitel 3 – Wiederholung", {z:0,s:0}), e("g2", "0 bis 20", {z:0,s:1}) ] }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await sleep(300);

// 1) Lang-Druck: Erklärung = voller Name, Knöpfe getrennt von der Blase
let p = await mitte("0|0");
await page.touchscreen.touchStart(p.x, p.y);
await sleep(700);
await page.touchscreen.touchEnd();
await sleep(500);
const blase = await page.evaluate(() => document.querySelector('[role="status"]')?.innerText.split("\n")[0]);
const getrennt = await page.evaluate(() => { const m = document.querySelector("[data-info-menue]"); const b = document.querySelector('[role="status"]'); return !!m && !!b && !b.contains(m); });
console.log("     Erklärung:", blase);
ok(blase === "Unregelmäßige Verben Kapitel 3 – Wiederholung", "Lang-Druck zeigt den vollen Namen");
ok(getrennt, "Menü-Knöpfe schweben getrennt von der Erklärung");
// Tipp daneben schließt
await page.touchscreen.tap(200, 780); await sleep(300);
ok(!(await page.$('[role="status"]')) && !(await page.$("[data-info-menue]")), "Tipp daneben schließt Erklärung und Menü");
ok(Object.keys(await plaetze()).length === 2 && !(await page.evaluate(() => document.body.innerText.includes("Jetzt den Zielplatz"))), "Nichts geladen oder verschoben");

// 2) Lang-Druck + Ziehen auf freien Platz 2|1 → Menü weg, Verschieben-Modus, Eintrag verschoben
p = await mitte("0|0");
await page.touchscreen.touchStart(p.x, p.y);
await sleep(700);
ok(!!(await page.$("[data-info-menue]")), "Nach dem Halten: Menü sichtbar");
await page.touchscreen.touchMove(p.x + 15, p.y + 20);
await sleep(150);
ok(!(await page.$('[role="status"]')) && !(await page.$("[data-info-menue]")), "Sobald gezogen wird: Erklärung und Menü sofort weg");
ok(await page.evaluate(() => /Fertig/.test(document.querySelector(".slot-kopf-knoepfe")?.innerText || "")), "… und Verschieben-Modus an");
const ziel = await mitte("2|1");
for (let i = 1; i <= 8; i++) { await page.touchscreen.touchMove(p.x + (ziel.x - p.x) * i / 8, p.y + (ziel.y - p.y) * i / 8); await sleep(40); }
await page.touchscreen.touchEnd();
await sleep(300);
const pl = await plaetze();
console.log("     Plätze:", JSON.stringify(pl));
ok(pl["Unregelmäßige Verben Kapitel 3 – Wiederholung"] === "2|1", "Lang-Druck + Ziehen: Eintrag auf den neuen Platz verschoben");

// 3) Fenster oben (Umbenennen über das Menü)
await clickText(".slot-kopf-knoepfe button", "Fertig", true);
p = await mitte("0|1");
await page.touchscreen.touchStart(p.x, p.y);
await sleep(700);
await page.touchscreen.touchEnd();
await sleep(500);
await page.evaluate(() => document.querySelector('[data-info-aktion="✎ Umbenennen"]').click());
await sleep(300);
const oben = await page.evaluate(() => document.querySelector(".modal").getBoundingClientRect().top);
console.log("     Umbenennen-Fenster oben bei", Math.round(oben), "px von", 844);
ok(oben < 844 * 0.15, "Umbenennen-Fenster sitzt oben (nicht von der Tastatur verdeckt)");
await page.screenshot({ path: "langdruck_fenster.png" });
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
