import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const URL = "http://localhost:4199/vokabel-app/";
const DIR = path.resolve("importdateien");
fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR);

const backup = JSON.stringify([{ id: "x", name: "Unité 1", sprache: "fr",
  spalten: { E1:{name:"Französisch",aktiv:true}, E2:{name:"",aktiv:false}, E3:{name:"",aktiv:false}, D1:{name:"Deutsch",aktiv:true}, D2:{name:"",aktiv:false}, i1:{name:"",aktiv:false}, i2:{name:"",aktiv:false} },
  naechste_id: 3, vokabeln: [{ id:1, E1:{wert:"l'été",falsch:[]}, D1:{wert:"der Sommer",falsch:[]} }, { id:2, E1:{wert:"le garçon",falsch:[]}, D1:{wert:"der Junge",falsch:[]} }] }], null, 2);
const txt = "Französisch // Deutsch\nl'été // der Sommer\nle garçon // der Junge\n";
const datei = (name, buf) => { const p = path.join(DIR, name); fs.writeFileSync(p, buf); return p; };
const utf16 = s => Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(s, "utf16le")]);
const F = {
  jsonUtf8:   datei("backup.json", Buffer.from(backup, "utf8")),
  jsonUtf16:  datei("backup_utf16.txt", utf16(backup)),
  jsonPrefix: datei("mail.txt", Buffer.from("Hier ist mein Backup:\n\n" + backup + "\n\nGruß", "utf8")),
  txt1252:    datei("liste_ansi.txt", Buffer.from(txt, "latin1")),
  txtUtf8Bom: datei("liste_bom.txt", Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(txt, "utf8")])),
  leer:       datei("leer.txt", Buffer.alloc(0)),
  binaer:     datei("bild.dat", Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array.from({ length: 300 }, (_, i) => (i * 37) % 256)])),
};

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function importiere(datei) {
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await sleep(400);
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Listen").click()); await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim().endsWith("Neu"))?.click()); await sleep(300);
  const inp = await page.$('input[type="file"]');
  const accept = await page.evaluate(() => document.querySelector('input[type="file"]').getAttribute("accept"));
  await inp.uploadFile(datei);
  await sleep(600);
  return page.evaluate(() => ({
    text: document.body.innerText,
    textarea: document.querySelector("textarea")?.value || "",
  })).then(x => ({ ...x, accept }));
}

let r = await importiere(F.jsonUtf8);
ok(r.accept === null, "Dateiauswahl ohne Typ-Einschränkung");
ok(/JSON-Backup erkannt/.test(r.text) && /Unité 1/.test(r.text), "JSON UTF-8: erkannt");
r = await importiere(F.jsonUtf16);
ok(/JSON-Backup erkannt/.test(r.text) && /Unité 1/.test(r.text), "JSON UTF-16 (als .txt): erkannt, Akzente korrekt");
r = await importiere(F.jsonPrefix);
ok(/JSON-Backup erkannt/.test(r.text), "JSON mit Text davor/danach (z. B. aus Mail): erkannt");
r = await importiere(F.txt1252);
ok(r.textarea.includes("l'été") && r.textarea.includes("garçon") && r.textarea.includes("Französisch"), "TXT Windows-1252: Akzente korrekt");
r = await importiere(F.txtUtf8Bom);
ok(r.textarea.startsWith("Französisch"), "TXT UTF-8 mit BOM: korrekt");
r = await importiere(F.leer);
console.log("     leer:", (r.text.match(/Datei „leer.txt“[^\n]*/) || [""])[0]);
ok(/leer\.txt“ \(0 Bytes\) ist leer/.test(r.text), "Leere Datei: verständliche Meldung mit Größe");
r = await importiere(F.binaer);
console.log("     binär:", (r.text.match(/Datei „bild.dat“[^\n]*/) || [""])[0]);
ok(/bild\.dat“ \(\d+ Bytes\) ist keine Textdatei/.test(r.text), "Binärdatei: Meldung „keine Textdatei“ mit Dateiname und Größe");

// JSON aus UTF-16 wirklich importieren
r = await importiere(F.jsonUtf16);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Alle importieren/.test(b.textContent))?.click()); await sleep(400);
const liste = await page.evaluate(() => { const i = JSON.parse(localStorage.getItem("vokabel_listen_index")); return JSON.parse(localStorage.getItem("vokabel_liste_" + i[0].id)); });
ok(liste?.vokabeln?.[0]?.E1?.wert === "l'été", "UTF-16-Backup importiert, „l'été“ korrekt gespeichert");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
