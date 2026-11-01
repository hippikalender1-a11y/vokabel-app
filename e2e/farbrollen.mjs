import puppeteer from "puppeteer-core";

// Farbrollen nach Funktion getrennt (App-Kopf, Bereichs-Kopfzeilen, Abfrage-Karten, Dialoge, Knöpfe & Felder,
// Info-Kästen, Ausgewählt); „🎨 Farbe ändern“ in jedem Lang-Druck-Menü startet den Farbmodus an dieser Stelle
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
const tab = async name => { await page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n)).click(), name); await sleep(400); };
const variable = n => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim(), n);
const bg = sel => page.evaluate(sel => getComputedStyle(document.querySelector(sel)).backgroundColor, sel);
const rgb = hex => { const h = hex.replace("#", ""); const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h; return `rgb(${[0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)).join(", ")})`; };
const langDruck = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + r.height / 2 })); }, sel);
  await sleep(300);
};
const feldZeilen = () => page.evaluate(() => [...document.querySelectorAll("[data-farbfeld-zeile]")].map(z => z.dataset.farbfeldZeile));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 2, vokabeln: [{ id: 1, E1: { wert: "mot", falsch: [] }, D1: { wert: "Wort", falsch: [] } }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ gelerntSchwelle: 3, sprache: "alle" }));
});
await page.reload(); await sleep(500);

// ── neue Rollen: eigene Variablen, Standard aus den bisherigen Farben ──
const v = {};
for (const n of ["karte", "hintergrund", "app-kopf", "kopfzeile", "abfrage-karte", "dialog", "knopf", "info-kasten", "haupt-flaeche"]) v[n] = await variable(n);
console.log("     Natur:", JSON.stringify(v));
ok(v["app-kopf"] === v.karte && v["abfrage-karte"] === v.karte && v.dialog === v.karte, "App-Kopf, Abfrage-Karten, Dialoge: wie Karten");
ok(v.knopf === v.hintergrund, "Knöpfe & Felder: wie bisher (Hintergrund)");
ok(v.kopfzeile !== v.karte && v["info-kasten"] !== v.hintergrund && v["info-kasten"] !== v.karte, "Bereichs-Kopfzeilen und Info-Kästen: eigener Hauch der Hauptfarbe");

// Listenauswahl: Kopfzeile und Listen-Kacheln unterscheiden sich
await tab("Listen");
const kopfBg = await bg(".liste-detail-header"), kachelBg = await bg('[data-liste-id="l_a"]');
ok(kopfBg === rgb(v.kopfzeile) && kachelBg === rgb(v.karte) && kopfBg !== kachelBg, `Listen-Tab: Kopfzeile (${kopfBg}) ≠ Liste (${kachelBg})`);
ok(await bg(".topbar") === rgb(v["app-kopf"]) && await bg(".tabs") === rgb(v["app-kopf"]), "Titel- und Tab-Leiste: App-Kopf");

// Seiten-Hintergrund ändern → Knöpfe/Felder und Info-Kästen bleiben
await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("vokabel_einstellungen"));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ ...e, farbschema: "eigen_t", eigeneSchemata: [{ id: "eigen_t", name: "Test", basis: "natur",
    farben: { haupt: "#2d6a4f", "haupt-hell": "#52b788", "auf-haupt": "#fff", hintergrund: "#ff0000", karte: "#fff", flaeche: "#f0ede8", knopf: "#f7f5f0",
      "text-stark": "#1a1a1a", text: "#3b3832", text2: "#6b6560", text3: "#9b9590", rahmen: "#e0dbd2", richtig: "#2d6a4f", falsch: "#c0392b",
      gelb: "#f9a825", orange: "#e67e22", info: "#6a1b9a", gelernt: "#2d6a4f", arbeit: "#e9c46a", nie: "#d6d2cb", negativ: "#e57373" } }] })); });
await page.reload(); await sleep(500);
ok(await bg("body") === "rgb(255, 0, 0)" && await variable("knopf") === "#f7f5f0", "Seite rot, Knöpfe & Felder behalten ihre eigene Farbe");
await tab("Einstellungen");
await page.click('[data-einst-kopf="info"]'); await sleep(300);
ok(await page.evaluate(() => [...document.querySelectorAll("div")].some(d => d.style.background === "var(--info-kasten)")), "Info-Übersicht nutzt die Rolle Info-Kästen");

// ── „🎨 Farbe ändern“ im Lang-Druck-Menü ──
await tab("Listen");
await langDruck('[data-liste-id="l_a"]');
ok(await page.$("[data-info-farbe]") && !(await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].some(b => /Farbe/.test(b.textContent)))),
  "Lang-Druck auf eine Liste: „🎨 Farbe ändern“ unter den Aktionen");
await page.evaluate(() => document.querySelector("[data-info-farbe]").click()); await sleep(500);
let zeilen = await feldZeilen();
console.log("     Farbfeld Liste:", zeilen.join(" | "));
ok(await page.$("[data-farbmodus-uebernehmen]") && zeilen.includes("karte"), "Farbmodus läuft, Farbfeld der Liste zeigt „Karten“");
await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld] button")].find(b => b.textContent.trim() === "Schließen").click()); await sleep(300);
// im Farbmodus: Lang-Druck auf die Kopfzeile → Bereichs-Kopfzeilen
const kopf = await page.evaluate(() => { const r = document.querySelector(".liste-detail-header").getBoundingClientRect(); return { x: r.x + 120, y: r.y + r.height / 2 }; });
await page.evaluate((x, y) => document.elementFromPoint(x, y).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y })), kopf.x, kopf.y); await sleep(300);
zeilen = await feldZeilen();
console.log("     Farbfeld Kopfzeile:", zeilen.join(" | "));
ok(zeilen.includes("kopfzeile") && !zeilen.includes("karte"), "Kopfzeile der Listen: eigene Rolle „Bereichs-Kopfzeilen“");
ok(/Bereichs-Kopfzeilen/.test(await page.evaluate(() => document.querySelector('[data-farbfeld-zeile="kopfzeile"]')?.innerText || "")), "Name im Farbfeld: „Bereichs-Kopfzeilen“");
await page.evaluate(() => document.querySelector("[data-farbmodus-zuruecksetzen]").click()); await sleep(300);

// Eintrag ausschaltbar
await tab("Einstellungen");
await page.click('[data-einst-kopf="farben"]'); await sleep(300);
await page.click("[data-farbe-im-menue]"); await sleep(200);
await tab("Listen");
await langDruck('[data-liste-id="l_a"]');
ok(!(await page.$("[data-info-farbe]")) && await page.$("[data-info-aktion]"), "ausgeschaltet: kein „🎨 Farbe ändern“, übrige Aktionen bleiben");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
