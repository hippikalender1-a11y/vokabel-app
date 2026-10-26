import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const backup = JSON.stringify([{ id: "x", name: "Unité 1", sprache: "fr",
  spalten: { E1:{name:"Französisch",aktiv:true}, E2:{name:"",aktiv:false}, E3:{name:"",aktiv:false}, D1:{name:"Deutsch",aktiv:true}, D2:{name:"",aktiv:false}, i1:{name:"",aktiv:false}, i2:{name:"",aktiv:false} },
  naechste_id: 2, vokabeln: [{ id:1, E1:{wert:"l'été",falsch:[]}, D1:{wert:"der Sommer",falsch:[]} }] }]);   // einzeilig (minifiziert)

async function einfuegen(text) {
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await sleep(400);
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Listen").click()); await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim().endsWith("Neu"))?.click()); await sleep(300);
  await page.evaluate(t => {
    const ta = document.querySelector("textarea");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, t);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
  await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Analysieren")?.click());
  await sleep(400);
  return page.evaluate(() => document.body.innerText);
}

let t = await einfuegen(backup);
ok(/JSON-Backup erkannt/.test(t) && /Unité 1/.test(t), "Eingefügtes (einzeiliges) JSON-Backup wird als Backup erkannt");
t = await einfuegen("content://com.android.providers.downloads/document/123");
const m = (t.match(/Nur 1 Zeile erkannt[^\n]*/) || [""])[0];
console.log("     Meldung:", m);
ok(/Nur 1 Zeile erkannt/.test(m) && /content:\/\//.test(m) && /📄 Datei/.test(m), "Einzeiliger Text: Meldung mit Zeilenzahl, Anfang und Hinweis auf „📄 Datei“");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
