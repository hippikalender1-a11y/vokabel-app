import puppeteer from "puppeteer-core";

// Liste in Sessions aufteilen: Lang-Druck → „In Sessions aufteilen“ → Quiz-Tab mit gelbem Kasten
// (Name, Gruppengröße, Bereich, Rest, Vorschau) → „n Sessions anlegen“ → gespeicherte Konfigurationen „Name (21 - 40)“
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
const setzeFeld = async (sel, wert) => {
  await page.click(sel, { clickCount: 3 }); await page.keyboard.press("Backspace");
  await page.type(sel, String(wert)); await sleep(200);
};
const vorschau = () => page.evaluate(() => [...document.querySelectorAll("[data-aufteilen-vorschau] > span")].map(s => s.textContent.trim()));
const gespeichert = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots") || "{}").gespeichert || []);
const anlegenText = () => page.evaluate(() => document.querySelector("[data-aufteilen-anlegen]")?.textContent.trim());

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const voks = Array.from({ length: 87 }, (_, i) => ({ id: i + 1, E1: { wert: "mot" + (i + 1), falsch: [] }, D1: { wert: "Wort" + (i + 1), falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id: "l_fr", name: "Verbes", sprache: "fr", spalten: sp, naechste_id: 88, vokabeln: voks }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id: "l_fr", name: "Verbes", sprache: "fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");
await page.evaluate(() => { const el = document.querySelector("[data-liste-id]"); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 20 })); });
await sleep(250);
ok(await page.$('[data-info-aktion="▦ In Sessions aufteilen"]'), "Lang-Druck-Menü: „In Sessions aufteilen“");
await page.evaluate(() => document.querySelector('[data-info-aktion="▦ In Sessions aufteilen"]').click()); await sleep(500);

ok(await page.evaluate(() => document.querySelector(".tab.aktiv")?.textContent.trim()) === "Quiz" && await page.$("[data-aufteilen]"), "Quiz-Tab mit gelbem Aufteilen-Kasten");
let v = await vorschau();
console.log("     Vorschau 20:", v.join(" | "));
ok(v.length === 5 && v[0] === "Verbes (1 - 20)" && v[4] === "Verbes (81 - 87)", "Standard 20: Verbes (1 - 20) … Verbes (81 - 87)");
ok(await anlegenText() === "▦ 5 Sessions anlegen", `Knopf „5 Sessions anlegen“ statt Quiz starten (${await anlegenText()})`);
ok(!(await page.evaluate(() => [...document.querySelectorAll("button")].some(b => /Quiz starten/.test(b.textContent)))), "kein „Quiz starten“ während des Aufteilens");

// Rest anhängen
await page.click('[data-aufteilen-rest="anhaengen"]'); await sleep(200);
v = await vorschau();
ok(v.length === 4 && v[3] === "Verbes (61 - 87)", `Rest an letzte anhängen: ${v[3]}`);
await page.click('[data-aufteilen-rest="eigen"]'); await sleep(200);

// Größen 75/100 und eigene Zahl
for (const n of [75, 100]) ok(await page.$(`[data-aufteilen-groesse="${n}"]`), `Schnellwahl ${n} vorhanden`);
await setzeFeld("[data-aufteilen-eigene]", 30);
v = await vorschau();
ok(v.length === 3 && v[1] === "Verbes (31 - 60)", `eigene Größe 30: ${v.join(" | ")}`);

// Bereich 20–60, Größe 10, eigener Name
await page.click('[data-aufteilen-groesse="10"]'); await sleep(200);
await setzeFeld("[data-aufteilen-von]", 21);
await setzeFeld("[data-aufteilen-bis]", 60);
await setzeFeld("[data-aufteilen-name]", "Verben Teil 2");
v = await vorschau();
console.log("     Vorschau:", v.join(" | "));
ok(v.length === 4 && v[0] === "Verben Teil 2 (21 - 30)" && v[3] === "Verben Teil 2 (51 - 60)", "Bereich 21–60 in Zehnern, eigener Name + Nummern");

// Einstellung wählen (Reihenfolge Zufällig), dann anlegen
await clickText("button", "Schlechteste", true);
await clickText(".toggle-opt", "Zufällig", true);
await page.evaluate(() => document.querySelector("[data-aufteilen-anlegen]").click()); await sleep(500);
let g = await gespeichert();
console.log("     angelegt:", g.map(x => `${x.name}@${x.platz.z}|${x.platz.s}`).join(", "));
ok(g.length === 4 && g.map(x => x.name).join(",") === "Verben Teil 2 (21 - 30),Verben Teil 2 (31 - 40),Verben Teil 2 (41 - 50),Verben Teil 2 (51 - 60)", "4 gespeicherte Konfigurationen angelegt");
const k = g[1].konfiguration;
ok(k.listenIds.join() === "l_fr" && k.bereichTyp === "bereich" && k.vokabelAuswahl.length === 10 && k.vokabelAuswahl[0] === "l_fr__31" && k.vokabelAuswahl[9] === "l_fr__40", "zweite Gruppe: Vokabeln Nr. 31–40");
ok(k.quizReihenfolge === "zufall", `Einstellungen übernommen (Reihenfolge ${k.quizReihenfolge})`);
ok(g.every((x, i) => x.platz.z === i && x.platz.s === 0), "zusammen im Raster, untereinander in der ersten Spalte");
ok(!(await page.$("[data-aufteilen]")), "Kasten nach dem Anlegen weg");

// Laden einer Gruppe: Quiz mit genau diesen 10
await clickText(".slot-chip", "Verben Teil 2 (31 - 40)");
await clickText("button", "Quiz starten (");
ok(await page.evaluate(() => document.querySelector(".topbar-title")?.textContent.trim()) === "1 / 10", "geladene Gruppe: Quiz mit 10 Vokabeln");
await clickText(".topbar-back", "Beenden"); await sleep(400);
if (await page.evaluate(() => /Zur Übersicht/.test(document.body.innerText))) await clickText("button", "Zur Übersicht");

// erneut aufteilen: vorhandene Namen werden übersprungen
await clickText(".tab", "Listen");
await page.evaluate(() => { const el = document.querySelector("[data-liste-id]"); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 20 })); });
await sleep(250);
await page.evaluate(() => document.querySelector('[data-info-aktion="▦ In Sessions aufteilen"]').click()); await sleep(500);
await page.click('[data-aufteilen-groesse="10"]'); await sleep(200);
await setzeFeld("[data-aufteilen-name]", "Verben Teil 2");
await setzeFeld("[data-aufteilen-bis]", 70);
ok(await anlegenText() === "▦ 3 Sessions anlegen", `vorhandene übersprungen: ${await anlegenText()} (1-10, 11-20, 61-70)`);
await page.click("[data-aufteilen-abbrechen]"); await sleep(300);
ok(!(await page.$("[data-aufteilen]")) && (await gespeichert()).length === 4, "Abbrechen: nichts angelegt");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
