import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kopf = () => page.evaluate(() => document.querySelector(".topbar")?.innerText.replace(/\n/g, " | "));
const legende = g => page.evaluate(g => document.querySelector(`[data-legende="${g}"]`)?.click(), g);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const w = [["aller","gehen",3],["venir","kommen",4],["partir","abfahren",2],["sortir","ausgehen",null],["voir","sehen",-2]];
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:6,
    vokabeln: w.map(([e, d, sc], i) => ({ id: i + 1, E1:{wert:e,falsch:[]}, D1:{wert:d,falsch:[]},
      ...(sc === null ? {} : { fortschritt: { score: sc, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" } }) })) };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", autoplay:false, vorlesen:["E1"], gelerntSchwelle:3, sprache:"alle" }));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Statistik").click());
await sleep(400);
ok(/Vokabel-Trainer/.test(await kopf()), "Normal: Kopfzeile „Vokabel-Trainer“");

// Vollbild
await page.evaluate(() => {
  const box = document.querySelector('svg[viewBox="0 0 400 230"]').closest('div[style*="border-radius: 12px"]');
  [...box.querySelectorAll("button")].find(b => b.querySelector("svg") && !b.textContent.trim())?.click();
});
await sleep(400);
let k = await kopf();
console.log("     Vollbild:", k);
ok(!/Vokabel-Trainer/.test(k) && /53 %/.test(k) && /2 \/ 5 gelernt/.test(k), "Vollbild: Kopfzeile zeigt 53 %, 2 / 5 gelernt");

await legende("nie"); await sleep(300);
k = await kopf();
console.log("     ohne Nie:", k);
// (100 + 100 + 67 + 0) / 4 = 67 %
ok(/67 %/.test(k) && /2 \/ 4 gelernt/.test(k), "„Nie abgefragt“ aus: 67 %, 2 / 4 gelernt");

await legende("gelernt"); await sleep(300);
k = await kopf();
console.log("     ohne Nie + Gelernt:", k);
// partir 67 %, voir 0 % → 33 %
ok(/33 %/.test(k) && /0 \/ 2 gelernt/.test(k), "Zusätzlich „Gelernt“ aus: 33 %, 0 / 2 gelernt");
await page.screenshot({ path: "vollbild_kopf.png" });

// Vollbild verlassen
await page.evaluate(() => [...document.querySelectorAll(".topbar button")].pop()?.click());
await sleep(300);
k = await kopf();
ok(/Vokabel-Trainer/.test(k), "Vollbild verlassen: wieder „Vokabel-Trainer“");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
