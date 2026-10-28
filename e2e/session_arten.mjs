import puppeteer from "puppeteer-core";

// Gespeicherte Session: eigener Paket-Fortschritt je Abfrageart (Übersetzung / Akzente), Zurücksetzen,
// Kopfzeile grün + zentriert, Liste klappt nach Auswahl zu
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1200 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
page.on("dialog", d => { console.log("FAIL Browser-Fenster erschienen:", d.message()); d.dismiss(); });
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
const text = () => page.evaluate(() => document.body.innerText);
const fortschritt = () => page.evaluate(() => document.querySelector('[data-anzahl="fortschritt"]')?.textContent.trim() || null);
const kopf = () => page.evaluate(() => document.querySelector("[data-slot-kopf]")?.getAttribute("data-slot-kopf"));
const anzahl = async () => (await text()).match(/Quiz starten \((\d+) Vokabeln\)/)?.[1];

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const w = [["élève","Schüler"],["café","Kaffee"],["été","Sommer"],["forêt","Wald"],["où","wo"],["déjà","schon"],["chat","Katze"],["chien","Hund"],
    ["maison","Haus"],["livre","Buch"],["table","Tisch"],["porte","Tür"],["fenêtre","Fenster"],["arbre","Baum"]];
  const l = { id:"l_fr", name:"Wörter", sprache:"fr", spalten: sp, naechste_id:20, vokabeln: w.map(([e, d], i) => ({ id:i+1, E1:{wert:e,falsch:[]}, D1:{wert:d,falsch:[]} })) };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
  const k = { listenIds:["l_fr"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"Mein Paket", timestamp:1, konfiguration:k, sessionFortschritt:null }] }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
if (!(await text()).includes("Mein Paket")) await page.evaluate(() => document.querySelector("[data-slot-kopf] button.toggle-opt.aktiv")?.click());
await sleep(300);
ok((await text()).includes("Verlauf & Gespeichert"), "Aufgeklappt: Überschrift „Verlauf & Gespeichert“ sichtbar");
await clickText(".slot-chip", "Mein Paket");
await sleep(300);
const t0 = await text();
ok(await kopf() === "gruen" && !t0.includes("Verlauf & Gespeichert") && !t0.includes("📌 Gespeichert"),
  "Nach Auswahl: Liste zu, Überschrift weg, Kopfzeile grün");
ok(await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); const b = k.querySelector("button.toggle-opt.aktiv");
  const r = k.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs((rb.left + rb.right) / 2 - (r.left + r.right) / 2) < 3; }),
  "Knopf mit dem Namen sitzt mittig");

// Paket mit 10 Vokabeln (Übersetzung, Karte), alles gewusst
if (!(await page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].some(b => b.textContent.trim() === "10 V." && b.classList.contains("aktiv")))))
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^(Pakete|\d+ V\.)$/.test(b.textContent.trim()))?.click());
await sleep(200);
await clickText("button", "Quiz starten (");
await sleep(400);
for (let k = 0; k < 14; k++) {
  if (/Paket fertig|Durchlauf abgeschlossen/.test(await text())) break;
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
  await sleep(200);
  await clickText(".karte-btn", "Gewusst");
  await sleep(1300);
}
await clickText("button", "Pause", true);
await sleep(400);
console.log("     Übersetzung:", await fortschritt());
ok(await fortschritt() === "10 / 14", "Übersetzung: Fortschritt 10 / 14");
ok((await text()).includes("Fortschritt Übersetzung"), "Fortschrittszeile nennt die Abfrageart");

// Wechsel zu Akzente: eigener (noch leerer) Fortschritt
if (!(await page.$(".spalten-modus-btn"))) await page.click("[data-abfragemodus]");
await sleep(300);
await clickText(".spalten-modus-btn", "Akzente", true);
await sleep(300);
console.log("     Akzente:", await fortschritt(), "| Start:", await anzahl());
ok(await fortschritt() === null, "Akzente: kein Fortschritt vom Übersetzungs-Stand übernommen");
// Akzente-Paket: 2 Wörter (Lösung anzeigen)
await clickText(".typ-btn", "5", true).catch(() => {});
await clickText("button", "Quiz starten (");
await sleep(400);
for (let k = 0; k < 2; k++) {
  await clickText("button", "Lösung anzeigen");
  await clickText("button", "Weiter →");
  await sleep(300);
}
await clickText("button", "Beenden", true);
await sleep(400);
if ((await text()).includes("Wiederholung abbrechen")) await clickText("button", "Wiederholung abbrechen");
if (/Zur Übersicht/.test(await text())) await clickText("button", "Zur Übersicht");
await sleep(400);
const akz = await fortschritt();
console.log("     Akzente nach Abbruch:", akz);
ok(/^2 \/ \d+$/.test(akz || ""), "Akzente: eigener Fortschritt 2 / …");

// zurück zu Übersetzung → alter Stand wieder da
if (!(await page.$(".spalten-modus-btn"))) await page.click("[data-abfragemodus]");
await sleep(300);
await clickText(".spalten-modus-btn", "Karte", true);
await sleep(300);
ok(await fortschritt() === "10 / 14", "Zurück zu Übersetzung: wieder 10 / 14");
// und wieder Akzente → 2 / …
await clickText(".spalten-modus-btn", "Akzente", true);
await sleep(300);
ok(await fortschritt() === akz, "Wieder Akzente: Stand 2 / … bleibt erhalten");

// Zurücksetzen löscht nur den Akzente-Fortschritt
await page.click("[data-session-zuruecksetzen]");
await sleep(200);
ok(await page.$("[data-reset-frage]") && /Abgefragt-Stand löschen\?/.test(await text()) && await fortschritt() === null, "Zurücksetzen: Rückfrage in der App statt Browser-Fenster");
await clickText("button", "Nein", true);
ok(/^2 \/ \d+$/.test(await fortschritt() || ""), "„Nein“: Stand bleibt");
await page.click("[data-session-zuruecksetzen]");
await sleep(200);
await page.click("[data-reset-ja]");
await sleep(300);
ok(await fortschritt() === null, "Zurücksetzen: Akzente-Fortschritt weg, neue Session");
await clickText(".spalten-modus-btn", "Karte", true);
await sleep(300);
ok(await fortschritt() === "10 / 14", "Übersetzungs-Fortschritt bleibt nach dem Zurücksetzen von Akzente");

// nach Neuladen bleibt alles erhalten
await page.reload(); await sleep(600);
await clickText(".tab", "Quiz");
await sleep(300);
ok(await kopf() === "gruen" && (await text()).includes("Mein Paket") && await fortschritt() === "10 / 14",
  "Nach Neuladen: gespeicherte Session automatisch geladen (grüne Kopfzeile, Übersetzung 10 / 14)");
// Statistik: Kopfzeile verhält sich wie im Quiz
await clickText(".tab", "Statistik");
await sleep(400);
ok(await kopf() === "gruen" && !(await text()).includes("Verlauf & Gespeichert"), "Statistik: gespeicherte Konfiguration → Kopfzeile grün, ohne Überschrift");
await page.evaluate(() => document.querySelector("[data-slot-kopf] button.toggle-opt.aktiv")?.click());
await sleep(300);
ok(await kopf() === "offen" && (await text()).includes("Verlauf & Gespeichert"), "Statistik: Antippen öffnet die Auswahl");
await clickText(".slot-chip", "Mein Paket");
await sleep(300);
ok(await kopf() === "gruen" && !(await page.$(".slot-raster")), "Statistik: nach Auswahl wieder zu und grün");
await page.screenshot({ path: "statistik_kopf.png", clip: { x: 0, y: 0, width: 820, height: 300 } });
await clickText(".tab", "Quiz");
await sleep(300);
// „Neu“ → beim nächsten Start nichts automatisch laden
await page.evaluate(() => document.querySelector("[data-slot-kopf] button.toggle-opt.aktiv")?.click());
await sleep(300);
await clickText(".slot-chip", "Neu", true);
await page.reload(); await sleep(600);
await clickText(".tab", "Quiz");
await sleep(300);
ok(await kopf() !== "gruen" && await fortschritt() === null, "Nach „Neu“ und Neuladen: keine Session automatisch geladen");
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
