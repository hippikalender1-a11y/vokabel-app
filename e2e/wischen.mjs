import puppeteer from "puppeteer-core";

// 132: Tabs per seitlichem Wischen wechseln (Gleiten), nicht vom Rand, nicht bei senkrechtem Wischen, nicht auf Eingabefeldern
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const wische = async (x1, y1, x2, y2, warte = 350) => {
  await finger("touchStart", x1, y1);
  for (let i = 1; i <= 6; i++) { await finger("touchMove", x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6); await sleep(20); }
  await finger("touchEnd"); await sleep(warte);
};
const tab = () => page.evaluate(() => document.querySelector(".tab.aktiv")?.textContent.trim());

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 3,
    vokabeln: [{ id:1, E1:{wert:"one",falsch:[]}, D1:{wert:"eins",falsch:[]} }, { id:2, E1:{wert:"two",falsch:[]}, D1:{wert:"zwei",falsch:[]} }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(700);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
ok(await tab() === "Quiz", "Start: Quiz");

await wische(300, 600, 100, 610, 60);
ok(await tab() === "Einstellungen" && !(await page.$("[data-tab-gleiten]")), "152: sofort gewechselt, ohne Gleiten");
await sleep(300);
ok(await tab() === "Einstellungen", `nach links wischen: Einstellungen (${await tab()})`);
await sleep(400);
await wische(100, 600, 300, 600);
ok(await tab() === "Quiz", `nach rechts wischen: Quiz (${await tab()})`);
await sleep(400);
await wische(100, 600, 300, 600);
ok(await tab() === "Statistik", `nochmal nach rechts: Statistik (${await tab()})`);
await sleep(400);
await wische(100, 600, 300, 600);
ok(await tab() === "Statistik", "ganz links: bleibt Statistik");
await wische(8, 600, 250, 600);
ok(await tab() === "Statistik", "vom Rand aus: kein Wechsel (Zurück-Geste des Systems)");
await wische(300, 700, 220, 300);
ok(await tab() === "Statistik", "eher senkrecht: kein Wechsel (scrollen)");
await wische(300, 600, 270, 600);
ok(await tab() === "Statistik", "zu kurz: kein Wechsel");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
