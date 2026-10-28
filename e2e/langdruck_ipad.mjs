import puppeteer from "puppeteer-core";

// iPad: Lang-Druck öffnet das Menü; der Klick, den iOS beim Loslassen nachschickt, schließt es nicht wieder
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
// Nachzügler-Klick wie bei iOS: Klick-Ereignis an der Fingerstelle
const geisterKlick = (x, y) => page.evaluate((x, y) => document.elementFromPoint(x, y).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y })), x, y);
const menueOffen = () => page.evaluate(() => document.querySelectorAll("[data-info-aktion]").length);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" });
  const l = { id:"l_a", name:"Verbes", sprache:"fr", spalten: sp, naechste_id: 4, vokabeln: [["aller","gehen",-2],["venir","kommen",-1],["partir","abfahren",4]]
    .map(([e, d, sc], i) => ({ id:i+1, E1:{wert:e,falsch:[]}, D1:{wert:d,falsch:[]}, fortschritt: f(sc) })) };
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Statistik").click()); await sleep(400);

const { x, y } = await page.evaluate(() => { const r = document.querySelector('[data-legende="negativ"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await finger("touchStart", x, y); await sleep(800);
ok(await menueOffen() > 0, "Lang-Druck: Menü geht auf, solange der Finger liegt");
await finger("touchMove", x + 2, y + 1); await sleep(100);
await finger("touchEnd"); await geisterKlick(x, y); await sleep(100);
ok(await menueOffen() > 0, "Finger loslassen (mit Nachzügler-Klick): Menü bleibt offen");
await sleep(150); await geisterKlick(x, y); await sleep(100);
ok(await menueOffen() > 0, "verspäteter Nachzügler-Klick: Menü bleibt offen");
await sleep(600);
await page.evaluate(() => document.querySelector(".topbar, body").click()); await sleep(200);
ok(await menueOffen() === 0, "danach: Antippen daneben schließt das Menü");

// Menü-Knopf funktioniert nach dem Loslassen normal
await finger("touchStart", x, y); await sleep(800); await finger("touchEnd"); await sleep(900);
await page.evaluate(() => document.querySelector("[data-info-aktion]").click()); await sleep(300);
ok(await page.$("[data-gruppen-quiz]"), "Menü-Knopf antippen: Aktion wird ausgeführt");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
