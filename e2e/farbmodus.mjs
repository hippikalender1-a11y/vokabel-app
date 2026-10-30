import puppeteer from "puppeteer-core";

// Farbmodus: in den Einstellungen starten, normal durch die App gehen, langer Druck auf ein Element →
// Farbfeld mit den Farbrollen im Umkreis (auch kleine Mini-Kreise); Änderung live;
// „Zurücksetzen“ verwirft und beendet, „Farben übernehmen“ speichert (Vorlage → Kopie mit Namen) und beendet
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900, hasTouch: true, isMobile: true });
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
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const variable = n => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim(), n);
const mitte = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const rechtsklick = async (x, y) => { await page.evaluate((x, y) => document.elementFromPoint(x, y).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y })), x, y); await sleep(300); };
const feldZeilen = () => page.evaluate(() => [...document.querySelectorAll("[data-farbfeld-zeile]")].map(z => z.innerText.trim().replace(/\s+/g, " ")));
// Farbe im Farbkreis-Dialog per Hex-Feld setzen (live) und anwenden
const farbradHex = async (wert, anwenden = true) => {
  await page.evaluate(w => { const i = document.querySelector("[data-farbrad-hex]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, w); i.dispatchEvent(new Event("input", { bubbles: true })); }, wert);
  await new Promise(r => setTimeout(r, 200));
  if (anwenden) { await page.click("[data-farbrad-anwenden]"); await new Promise(r => setTimeout(r, 300)); }
};
const setzeFarbe = async (rolle, wert) => { await page.evaluate(r => document.querySelector(`[data-farbfeld-zeile="${r}"]`).click(), rolle); await sleep(300); await farbradHex(wert); };
const eigene = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}").eigeneSchemata || []);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Nomen", sprache:"fr", spalten: sp, naechste_id: 3,
    vokabeln: [{ id:1, E1:{wert:"élève",falsch:[]}, D1:{wert:"Schüler",falsch:[]}, fortschritt:{ score: 2 } }, { id:2, E1:{wert:"chat",falsch:[]}, D1:{wert:"Katze",falsch:[]} }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Nomen", sprache:"fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ gelerntSchwelle: 3, sprache: "alle" }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Einstellungen");
await page.click("[data-farbmodus-start]"); await sleep(300);
ok(await page.$("[data-farbmodus-zuruecksetzen]") && await page.$("[data-farbmodus-uebernehmen]"), "Farbmodus an: unten rechts „Zurücksetzen“ und „Farben übernehmen“");

// normal navigieren
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Nomen");
ok(await page.$("[data-farbmodus-uebernehmen]"), "Navigieren im Farbmodus: Leiste bleibt");

// Rechtsklick (= langer Druck am Rechner) auf „Quiz starten“
const knopf = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /^Quiz starten/.test(x.textContent.trim())); const r = b.getBoundingClientRect(); return { x: r.x + 30, y: r.y + r.height / 2 }; });
await rechtsklick(knopf.x, knopf.y);
let zeilen = await feldZeilen();
console.log("     Farbfeld Knopf:", zeilen.join(" | "));
ok(zeilen.some(z => /Hintergrund · Hauptfarbe$/.test(z)) && zeilen.some(z => /Schrift · Schrift auf Hauptfarbe/.test(z)), "Knopf: Hintergrund Hauptfarbe, Schrift auf Hauptfarbe");
ok(!(await page.$('[role="status"]')), "keine Erklärung/kein Menü im Farbmodus");
// Farbkreis: groß, Regler Helligkeit/Sättigung, live, Abbrechen
await page.evaluate(() => document.querySelector('[data-farbfeld-zeile="haupt"]').click()); await sleep(300);
const kreisGr = await page.evaluate(() => { const c = document.querySelector("[data-farbrad-kreis]"); return c ? Math.round(c.getBoundingClientRect().width) : 0; });
ok(kreisGr >= 130 && kreisGr <= 175 && await page.$("[data-farbrad-hell]") && await page.$("[data-farbrad-saett]"), `kompakter Farbkreis (${kreisGr} px) mit Reglern Helligkeit und Sättigung`);
const lage = await page.evaluate(() => { const f = document.querySelector("[data-farbrad]").getBoundingClientRect();
  const b = [...document.querySelectorAll("button")].find(x => /^Quiz starten/.test(x.textContent.trim())).getBoundingClientRect();
  return { seite: document.querySelector("[data-farbrad]").dataset.farbradSeite, frei: f.bottom <= b.top || f.top >= b.bottom, hoehe: Math.round(f.height), feld: !!document.querySelector("[data-farbfeld]") }; });
console.log("     Farbwähler:", JSON.stringify(lage));
ok(lage.seite === "oben" && lage.frei && lage.hoehe < 330, "Farbwähler als Leiste auf der freien Seite – der Knopf bleibt sichtbar");
ok(!lage.feld, "Farbfeld „Farben hier“ ausgeblendet, solange der Farbwähler offen ist");
const kr = await page.evaluate(() => { const r = document.querySelector("[data-farbrad-kreis]").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r: r.width / 2 }; });
await page.mouse.move(kr.x + kr.r * 0.9, kr.y); await page.mouse.down(); await page.mouse.move(kr.x + kr.r * 0.9, kr.y + 2); await sleep(150);
const amRand = await variable("haupt");
await page.mouse.move(kr.x + 2, kr.y + 1); await sleep(150);
const kreisMitte = await variable("haupt");
await page.mouse.up();
console.log("     Kreis Rand/Mitte:", amRand, kreisMitte);
const satt = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, r, g, b); };
ok(amRand !== "#2d6a4f" && satt(amRand) > 0.8 && satt(kreisMitte) < 0.1, "Ziehen im Kreis: App färbt sich live um, außen kräftig, Mitte kaum gesättigt");
await page.click("[data-farbrad-abbrechen]"); await sleep(300);
ok(await variable("haupt") === "#2d6a4f" && !(await page.$("[data-farbrad]")), "Abbrechen: alte Farbe wieder da");
ok(await page.$("[data-farbfeld]"), "danach ist das Farbfeld wieder da");
await setzeFarbe("haupt", "#aa0000");
ok(await variable("haupt") === "#aa0000", "Anwenden: Hauptfarbe geändert");
await page.evaluate(() => document.querySelector('[data-farbfeld-zeile="haupt"]').click()); await sleep(300);
ok(await page.evaluate(() => [...document.querySelectorAll("[data-farbrad-verlauf] button")].map(b => b.title).join()) === "#aa0000", "Verlauf: zuletzt verwendete Farbe");
if (process.env.SHOT) await page.screenshot({ path: "farbrad_shot.png" });
await page.click("[data-farbrad-abbrechen]"); await sleep(200);
await clickText("[data-farbfeld] button", "Schließen", true);

// Mini-Kreis in der Kopfzeile per Finger: Umkreis erfasst Ring und Buchstabe
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") k.querySelector("button.zeile-rechts")?.click(); }); await sleep(300);
const kreis = await mitte('[data-quiz-art="uebersetzung"]');
await finger("touchStart", kreis.x + 6, kreis.y + 8); await sleep(700); await finger("touchEnd"); await sleep(300);
zeilen = await feldZeilen();
console.log("     Farbfeld Kreis:", zeilen.join(" | "));
ok(await page.$("[data-farbfeld]") && zeilen.some(z => /Hauptfarbe hell/.test(z)), "langer Druck neben den Mini-Kreis: Ring (Hauptfarbe hell) gefunden");
if (process.env.SHOT) await page.screenshot({ path: "farbfeld_shot.png" });
ok(await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld] .farb-zeile")].length) >= 3, "mehrere Teile im Umkreis zur Auswahl");
await page.evaluate(() => document.querySelector("[data-farbfeld-zeile]").click()); await sleep(150);
ok(await page.evaluate(() => [...document.querySelectorAll("[data-farbmodus-ui], [data-farbmodus-ui] div")].some(d => d.style.border.includes("dashed"))), "gewählte Zeile: Element wird gestrichelt hervorgehoben");
if (await page.$("[data-farbrad]")) { await page.click("[data-farbrad-abbrechen]"); await sleep(200); }
await clickText("[data-farbfeld] button", "Schließen", true);

// Zurücksetzen: verwirft und beendet
await page.click("[data-farbmodus-zuruecksetzen]"); await sleep(300);
ok(await variable("haupt") === "#2d6a4f" && !(await page.$("[data-farbmodus-uebernehmen]")) && (await eigene()).length === 0, "„Zurücksetzen“: Farben zurück, Farbmodus aus, nichts gespeichert");

// erneut: ändern und übernehmen (Vorlage Natur → Kopie mit Namen)
await clickText(".tab", "Einstellungen");
await page.click("[data-farbmodus-start]"); await sleep(300);
const sektion = await page.evaluate(() => { const r = [...document.querySelectorAll(".tab")].find(t => t.textContent === "Einstellungen").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await rechtsklick(sektion.x, sektion.y);
console.log("     Farbfeld Tab:", (await feldZeilen()).join(" | "));
await setzeFarbe("haupt", "#123456"); await sleep(200);
await clickText("[data-farbfeld] button", "Schließen", true);
await page.click("[data-farbmodus-uebernehmen]"); await sleep(300);
ok(await page.evaluate(() => document.querySelector("[data-farb-name] input")?.value) === "Natur (Kopie)", "Vorlage aktiv: Name für die Kopie vorgeschlagen");
await page.click("[data-farb-name-speichern]"); await sleep(400);
const eig = await eigene();
ok(eig.length === 1 && eig[0].farben.haupt === "#123456" && await variable("haupt") === "#123456" && !(await page.$("[data-farbmodus-uebernehmen]")),
  "„Farben übernehmen“: neues Schema „Natur (Kopie)“ gespeichert und gewählt, Farbmodus aus");
await page.reload(); await sleep(500);
ok(await variable("haupt") === "#123456", "nach Neuladen: eigene Farben bleiben");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
