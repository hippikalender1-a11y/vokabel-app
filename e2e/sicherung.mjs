import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

// Gesamtsicherung: Erinnerung im Listen-Tab, „Alles sichern“ (eine Datei mit allem),
// Datenverlust nachstellen, Wiederherstellen über Einstellungen und über den Import
const URL = "http://localhost:4199/vokabel-app/";
const DL = path.resolve("downloads_sicherung");
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL });
await page.evaluateOnNewDocument(() => { try { delete Navigator.prototype.share; } catch {} });
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Einstellungen: Bereich aufklappen (immer nur einer offen)
const oeffneEinst = async key => { await page.evaluate(k => { const b = document.querySelector(`[data-einst-kopf="${k}"]`); if (b && b.dataset.offen !== "ja") b.click(); }, key); await new Promise(r => setTimeout(r, 250)); };
const tab = async name => { await page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n)).click(), name); await sleep(400); };
const TAG = 24 * 3600 * 1000;
const setze = (k, v) => page.evaluate((k, v) => localStorage.setItem(k, JSON.stringify(v)), k, v);
const erinnerung = () => page.evaluate(() => document.querySelector("[data-sicherung-erinnerung]")?.textContent || null);
const warteAufDatei = async () => {
  for (let i = 0; i < 40; i++) {
    const f = fs.readdirSync(DL).filter(x => x.endsWith(".txt"));
    if (f.length) { await sleep(300); return path.join(DL, f[0]); }
    await sleep(250);
  }
  return null;
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = n => Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:n,D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const L = (id, n, s, w) => ({ id, name: n, sprache: s, spalten: sp(n), naechste_id: w.length + 1,
    vokabeln: w.map(([e, d, sc], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, fortschritt: { score: sc, streak: 0 } })) });
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(L("l_fr", "Unité 1", "fr", [["été","Sommer",4],["café","Kaffee",-2]])));
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify(L("l_en", "Verbs", "en", [["go","gehen",1]])));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }, { id:"l_en", name:"Verbs", sprache:"en", platz:{z:1,s:0} }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus: "einfach", gelerntSchwelle: 5, sprache: "alle", farbschema: "freudig" }));
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf: [], gespeichert: [{ id: "g1", name: "Mein Quiz", timestamp: 1, konfiguration: { listenIds: ["l_fr"] }, sessionFortschritt: null, platz: { z: 0, s: 0 } }] }));
});
await page.reload(); await sleep(600);

// Erste Start: Erinnerung zählt ab jetzt → noch keine
ok(await page.evaluate(() => !!localStorage.getItem("vokabel_sicherung_basis")), "Start: Beginn der Erinnerungs-Frist gemerkt");
await tab("Listen");
ok(await erinnerung() === null, "frisch: keine Erinnerung");
console.log("     Speicher dauerhaft:", await page.evaluate(() => navigator.storage?.persisted ? navigator.storage.persisted() : "n/a"));

// 8 Tage ohne Sicherung → Erinnerung
await setze("vokabel_sicherung_basis", Date.now() - 8 * TAG);
await page.reload(); await sleep(600); await tab("Listen");
ok(/Noch keine Sicherung/.test(await erinnerung() || ""), `nach 8 Tagen: Erinnerung „Noch keine Sicherung“ (${await erinnerung()})`);

// Jetzt sichern → Datei, Erinnerung weg
await page.click("[data-sicherung-jetzt]"); await sleep(300);
ok(/^Vokabel-App Sicherung \d{4}-\d{2}-\d{2}$/.test(await page.evaluate(() => document.querySelector('[data-datei-export="sicherung"] [data-export-name]')?.value) || ""),
  "Fenster „Alles sichern“ mit Dateiname, Vorschlag „Vokabel-App Sicherung Datum“");
await page.click("[data-datei-export-ok]");
const datei = await warteAufDatei();
ok(datei && /^Vokabel-App Sicherung \d{4}-\d{2}-\d{2}\.txt$/.test(path.basename(datei)), `Datei „Vokabel-App Sicherung Datum.txt“ (${datei && path.basename(datei)})`);
const sich = JSON.parse(fs.readFileSync(datei, "utf8"));
ok(sich.vokabelAppSicherung === 1 && sich.daten.vokabel_liste_l_fr && sich.daten.vokabel_einstellungen?.farbschema === "freudig" && sich.daten.vokabel_slots?.gespeichert?.length === 1,
  "Datei enthält Listen, Einstellungen mit Farbschema, gespeicherte Quiz");
ok(!("vokabel_sicherung_basis" in sich.daten) && !("vokabel_letzte_sicherung" in sich.daten), "Erinnerungs-Daten nicht in der Datei");
await sleep(300);
ok(await erinnerung() === null, "nach dem Sichern: Erinnerung weg");
await tab("Einstellungen"); await oeffneEinst("daten");
ok(/zuletzt am \d\d\.\d\d\.\d{4}/.test(await page.evaluate(() => document.querySelector("[data-letzte-sicherung]").textContent)), "Einstellungen: „zuletzt am …“");
// eigener Name für die Sicherung
await page.click("[data-alles-sichern]"); await sleep(300);
await page.click("[data-export-name]", { clickCount: 3 }); await page.keyboard.press("Backspace");
await page.type("[data-export-name]", "Backup Handy");
await page.click("[data-datei-export-ok]");
let eigen = false;
for (let i = 0; i < 40 && !eigen; i++) { eigen = fs.existsSync(path.join(DL, "Backup Handy.txt")); if (!eigen) await sleep(250); }
ok(eigen, "Sicherung mit eigenem Namen „Backup Handy.txt“");

// Datenverlust nachstellen
await page.evaluate(() => localStorage.clear());
await page.reload(); await sleep(600);
ok(await page.evaluate(() => !localStorage.getItem("vokabel_listen_index")), "alles gelöscht (wie vom Browser aufgeräumt)");

// Wiederherstellen über Einstellungen
await tab("Einstellungen"); await oeffneEinst("daten");
await (await page.$("[data-sicherung-datei]")).uploadFile(datei); await sleep(600);
ok(/2 Listen/.test(await page.evaluate(() => document.querySelector("[data-sicherung-bestaetigen]")?.textContent || "")), "Nachfrage: Sicherung mit 2 Listen");
await Promise.all([page.waitForNavigation(), page.click("[data-wiederherstellen-ok]")]); await sleep(700);
const st = await page.evaluate(() => ({
  idx: JSON.parse(localStorage.getItem("vokabel_listen_index") || "[]").map(l => l.name).join(","),
  sc: JSON.parse(localStorage.getItem("vokabel_liste_l_fr") || "{}").vokabeln?.map(v => v.fortschritt.score).join(","),
  e: JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}"),
  slots: JSON.parse(localStorage.getItem("vokabel_slots") || "{}").gespeichert?.map(g => g.name).join(","),
  letzte: !!localStorage.getItem("vokabel_letzte_sicherung"),
}));
console.log("     Wiederhergestellt:", JSON.stringify({ ...st, e: st.e.farbschema }));
ok(st.idx === "Unité 1,Verbs" && st.sc === "4,-2", "Listen mit Scores wieder da");
ok(st.e.farbschema === "freudig" && st.e.modus === "einfach" && st.e.gelerntSchwelle === 5, "Farben und Einstellungen wieder da");
ok(st.slots === "Mein Quiz", "gespeicherte Quiz wieder da");
ok(st.letzte, "Zeitpunkt der Sicherung übernommen");
await tab("Listen");
ok(await page.evaluate(() => document.body.innerText.includes("Unité 1") && document.body.innerText.includes("Verbs")), "Listen-Tab zeigt beide Listen");

// Keine Gesamtsicherung → Hinweis
const fremd = path.join(DL, "liste.json"); fs.writeFileSync(fremd, JSON.stringify([{ name: "x", vokabeln: [] }]));
await tab("Einstellungen"); await oeffneEinst("daten");
await (await page.$("[data-sicherung-datei]")).uploadFile(fremd); await sleep(500);
ok(await page.evaluate(() => /keine Gesamtsicherung/.test(document.querySelector("[data-sicherung]").textContent)), "andere Datei: Hinweis „keine Gesamtsicherung“");

// Import-Ansicht erkennt die Gesamtsicherung
await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(600);
await tab("Listen");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim().includes("Neu")).click()); await sleep(300);
await (await page.$('input[type="file"]')).uploadFile(datei); await sleep(600);
ok(/Gesamtsicherung vom/.test(await page.evaluate(() => document.body.innerText)), "Import: „Gesamtsicherung vom … erkannt“");
await Promise.all([page.waitForNavigation(), page.click("[data-alles-wiederherstellen]")]); await sleep(700);
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}").farbschema === "freudig"
  && JSON.parse(localStorage.getItem("vokabel_listen_index") || "[]").length === 2), "Import → „Alles wiederherstellen“: Listen und Farben wieder da");

// Letzte Sicherung 10 Tage alt → Erinnerung; „Später“ → einen Tag still
await setze("vokabel_letzte_sicherung", Date.now() - 10 * TAG);
await page.reload(); await sleep(600); await tab("Listen");
ok(/vor 10 Tagen/.test(await erinnerung() || ""), `Erinnerung „Letzte Sicherung vor 10 Tagen“ (${await erinnerung()})`);
await page.click("[data-sicherung-spaeter]"); await sleep(300);
ok(await erinnerung() === null, "„Später“: Erinnerung weg");
await page.reload(); await sleep(600); await tab("Listen");
ok(await erinnerung() === null, "„Später“ gilt auch nach dem Neuladen");
await setze("vokabel_sicherung_spaeter", Date.now() - 2 * TAG);
await page.reload(); await sleep(600); await tab("Listen");
ok(await erinnerung() !== null, "nach einem Tag: Erinnerung wieder da");

// Erinnerung aus / 14 Tage
await tab("Einstellungen"); await oeffneEinst("daten");
await page.click('[data-sicherung-tage-wahl="14"]'); await sleep(200);
await tab("Listen");
ok(await erinnerung() === null, "Erinnerung 14 Tage: bei 10 Tagen noch still");
await tab("Einstellungen"); await oeffneEinst("daten");
await page.click('[data-sicherung-tage-wahl="0"]'); await sleep(200);
await setze("vokabel_letzte_sicherung", Date.now() - 100 * TAG);
await page.reload(); await sleep(600); await tab("Listen");
ok(await erinnerung() === null, "Erinnerung aus: keine Erinnerung");

await browser.close();
fs.rmSync(DL, { recursive: true, force: true });
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
