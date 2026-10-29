import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const URL = "http://localhost:4199/vokabel-app/";
const DL = path.resolve("downloads");
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL });
// navigator.share abschalten → Datei-Download-Weg
await page.evaluateOnNewDocument(() => { try { delete Navigator.prototype.share; } catch {} });

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
const warteAufDatei = async (endung, vorher) => {
  for (let i = 0; i < 40; i++) {
    const neu = fs.readdirSync(DL).filter(f => f.endsWith(endung) && !vorher.includes(f));
    if (neu.length) return path.join(DL, neu[0]);
    await sleep(250);
  }
  return null;
};
const leeren = async () => { await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(500); };
const lese = () => page.evaluate(() => {
  const idx = JSON.parse(localStorage.getItem("vokabel_listen_index") || "[]");
  return idx.map(e => ({ index: e, liste: JSON.parse(localStorage.getItem("vokabel_liste_" + e.id)) }));
});

// ── Ausgangsdaten: drei Sprachen, Verben mit E3, Fortschritt ──
await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = (akt) => Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: akt[t] || "", aktiv: !!akt[t] }]));
  const listen = [
    { id:"l_en", name:"Irregular Verbs", sprache:"en", spalten: sp({E1:"Infinitive",E2:"Simple Past",E3:"Past Participle",D1:"Deutsch"}),
      naechste_id:3, vokabeln:[
        { id:1, E1:{wert:"go",falsch:["goed"]}, E2:{wert:"went",falsch:[]}, E3:{wert:"gone",falsch:[]}, D1:{wert:"gehen",falsch:[]},
          fortschritt:{score:4,streak:2,aufgedecktStreak:0,letzteAbfrage:"2026-10-20T10:00:00.000Z"} },
        { id:2, E1:{wert:"see",falsch:[]}, E2:{wert:"saw",falsch:[]}, E3:{wert:"seen",falsch:[]}, D1:{wert:"sehen",falsch:[]} } ] },
    { id:"l_fr", name:"Unité 1", sprache:"fr", spalten: sp({E1:"Français",D1:"Deutsch"}),
      naechste_id:3, vokabeln:[
        { id:1, E1:{wert:"l'été",falsch:["l'éte"]}, D1:{wert:"der Sommer",falsch:[]}, fortschritt:{score:-2,streak:0,aufgedecktStreak:1,letzteAbfrage:"2026-10-21T10:00:00.000Z"} },
        { id:2, E1:{wert:"le garçon",falsch:[]}, D1:{wert:"der Junge",falsch:[]} } ] },
    { id:"l_es", name:"Unidad 1", sprache:"es", spalten: sp({E1:"Español",D1:"Deutsch"}),
      naechste_id:2, vokabeln:[ { id:1, E1:{wert:"el niño",falsch:[]}, D1:{wert:"das Kind",falsch:[]} } ] },
  ];
  listen.forEach(l => localStorage.setItem("vokabel_liste_" + l.id, JSON.stringify(l)));
  localStorage.setItem("vokabel_listen_index", JSON.stringify(listen.map(l => ({ id:l.id, name:l.name, sprache:l.sprache }))));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");

// ── Export 1: alle drei als TXT ──
await clickText("button", "Exportieren", true);
for (const n of ["Irregular Verbs", "Unité 1", "Unidad 1"]) await clickText(".karte-zeile", n);
let vorher = fs.readdirSync(DL);
await clickText(".quiz-action-bar button", "TXT", true);
const txtAlle = await warteAufDatei(" - TXT.txt", vorher);
ok(!!txtAlle && path.basename(txtAlle) === "3 Listen - TXT.txt", `TXT (alle) heruntergeladen: ${txtAlle && path.basename(txtAlle)}`);
const txtInhalt = txtAlle ? fs.readFileSync(txtAlle, "utf8") : "";
console.log("---- TXT-Inhalt ----\n" + txtInhalt + "\n--------------------");
ok(txtInhalt.includes("# Unité 1 {fr}") && txtInhalt.includes("# Unidad 1 {es}") && txtInhalt.includes("# Irregular Verbs\n"), "TXT enthält Sprach-Kennungen");

// ── Export 2: alle drei als JSON ──
vorher = fs.readdirSync(DL);
ok(await page.evaluate(() => [...document.querySelectorAll(".quiz-action-bar button")].map(b => b.textContent.trim()).join("|")) === "JSON|TXT|📋 Kopieren",
  "Export-Leiste: JSON · TXT · Kopieren");
await clickText(".quiz-action-bar button", "JSON", true);
await clickText(".modal button", "Exportieren", true);
const jsonAlle = await warteAufDatei(" - JSON.txt", vorher);
ok(!!jsonAlle && path.basename(jsonAlle) === "3 Listen - JSON.txt", `JSON (alle) heruntergeladen: ${jsonAlle && path.basename(jsonAlle)}`);
const jsonDaten = jsonAlle ? JSON.parse(fs.readFileSync(jsonAlle, "utf8")) : [];
ok(jsonDaten.map(l => l.sprache).join(",") === "en,fr,es", `JSON enthält Sprachen: ${jsonDaten.map(l => l.sprache)}`);

// ── Export 3: einzelne französische Liste als TXT ──
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Unité 1");
await page.evaluate(() => [...document.querySelectorAll(".btn-toggle")].find(b => /Aktionen/.test(b.getAttribute("title") || ""))?.click());
await sleep(300);
vorher = fs.readdirSync(DL);
await clickText("button", "TXT", true);
const txtFr = await warteAufDatei(" - TXT.txt", vorher);
ok(!!txtFr && path.basename(txtFr) === "Unité 1 - TXT.txt", `TXT (Unité 1) heruntergeladen: ${txtFr && path.basename(txtFr)}`);

// ── Import A: TXT mit allen drei Listen ──
await leeren();
await clickText(".tab", "Listen");
await clickText("button", "Neu");
let input = await page.$('input[type="file"]');
await input.uploadFile(txtAlle);
await sleep(500);
await clickText("button", "Analysieren");
let t = await page.evaluate(() => document.body.innerText);
ok(t.includes("3 Listen erkannt"), "Import A: 3 Listen erkannt");
await clickText("button", "Alle importieren");
let daten = await lese();
ok(daten.length === 3, `Import A: ${daten.length} Listen angelegt`);
ok(daten.map(d => d.index.sprache).join(",") === "en,fr,es" && daten.every(d => d.liste.sprache === d.index.sprache),
  `Import A: Sprachen ${daten.map(d => d.index.sprache)}`);
const verbs = daten.find(d => d.index.name === "Irregular Verbs")?.liste;
ok(verbs && verbs.spalten.E3.aktiv && verbs.spalten.E3.name === "Past Participle" && verbs.vokabeln[0].E3?.wert === "gone",
  `Import A: E3 (Past Participle) erhalten`);
ok(daten.find(d => d.index.name === "Unité 1")?.liste.vokabeln[0].E1.falsch?.[0] === "l'éte", "Import A: falsche Antworten + Akzente erhalten");

// ── Import B: JSON-Backup ──
await leeren();
await clickText(".tab", "Listen");
await clickText("button", "Neu");
input = await page.$('input[type="file"]');
await input.uploadFile(jsonAlle);
await sleep(500);
t = await page.evaluate(() => document.body.innerText);
ok(t.includes("JSON-Backup erkannt"), "Import B: JSON erkannt");
await clickText("button", "Alle importieren");
daten = await lese();
ok(daten.map(d => d.index.sprache).join(",") === "en,fr,es", `Import B: Sprachen ${daten.map(d => d.index.sprache)}`);
ok(daten[0].liste.vokabeln[0].fortschritt?.score === 4 && daten[1].liste.vokabeln[0].fortschritt?.score === -2, "Import B: Fortschritt erhalten");
ok(daten[0].liste.spalten.E3.aktiv, "Import B: E3 erhalten");

// ── Import C: einzelne französische TXT ──
await leeren();
await clickText(".tab", "Listen");
await clickText("button", "Neu");
input = await page.$('input[type="file"]');
await input.uploadFile(txtFr);
await sleep(500);
await clickText("button", "Analysieren");
const aktiv = await page.evaluate(() => [...document.querySelectorAll(".typ-btn.aktiv")].map(b => b.textContent.trim()));
ok(aktiv.some(a => a.includes("Französisch")), `Import C: Französisch vorausgewählt (${aktiv.join(" | ")})`);
const nameVal = await page.$eval('input[placeholder="z.B. Irregular Verbs"]', e => e.value);
ok(nameVal === "Unité 1", `Import C: Name ohne Kennung übernommen: "${nameVal}"`);
const zugewiesen = await page.evaluate(() => document.querySelector(".import-zaehler")?.textContent);
console.log("     Import C: Spalten zugewiesen:", zugewiesen);
await page.evaluate(() => {
  const z = document.querySelectorAll(".spalten-zuweisung");
  const set = (i, typ) => { const b = [...z[i].querySelectorAll("button")].find(b => b.textContent.trim() === typ); if (b && !b.classList.contains("aktiv")) b.click(); };
  set(0, "E1"); set(1, "D1");
});
await sleep(300);
await clickText("button", "Importieren (");
daten = await lese();
ok(daten.length === 1 && daten[0].index.sprache === "fr" && daten[0].liste.sprache === "fr", `Import C: Liste als Französisch`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
