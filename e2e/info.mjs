import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100, hasTouch: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tafel = () => page.evaluate(() => {
  const t = [...document.querySelectorAll('[role="status"]')].find(d => /Antippen zum Schließen/.test(d.textContent));
  if (!t) return null;
  const r = t.getBoundingClientRect();
  return { text: t.firstElementChild.textContent, oben: r.top < innerHeight / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
});
const mitte = sel => page.evaluate(sel => { const r = (typeof sel === "string" ? document.querySelector(sel) : null)?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, sel);
const knopfMitte = text => page.evaluate(t => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === t); const r = b?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, text);
const cdp = await page.createCDPSession();
const langDruecken = async (p) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
  await sleep(700);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(500);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:4, vokabeln: [
    { id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]} }, { id:2, E1:{wert:"venir",falsch:[]}, D1:{wert:"kommen",falsch:[]} },
    { id:3, E1:{wert:"voir",falsch:[]}, D1:{wert:"sehen",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Quiz").click()); await sleep(200);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(d => d.textContent.includes("Verbes")).click()); await sleep(300);

// 1) Langes Drücken (oben) → Tafel unten, bleibt nach dem Loslassen
const bereich = await knopfMitte("Bereich");
await langDruecken(bereich);
let t = await tafel();
console.log("     Tafel:", JSON.stringify(t));
const amFinger = (t, p) => t && p.x >= t.left - 2 && p.x <= t.right + 2 &&
  (p.y > 150 ? Math.abs(t.bottom - (p.y - 14)) < 3 : Math.abs(t.top - (p.y + 14)) < 3);
ok(t && /Einzelne Vokabeln|Bereich/.test(t.text) && amFinger(t, bereich), "Lang drücken: Sprechblase direkt am Finger, bleibt nach dem Loslassen");
const bereichAktiv = await page.evaluate(() => [...document.querySelectorAll(".aktiv")].some(b => b.textContent.trim() === "Bereich"));
ok(!bereichAktiv, "Lang drücken führt die Aktion nicht aus");
await page.mouse.click(400, 600); await sleep(300);
ok(!(await tafel()), "Antippen irgendwo schließt die Tafel");

// 2) Info-Modus
await page.evaluate(() => document.querySelector(".info-schalter").click()); await sleep(300);
ok(await page.evaluate(() => document.body.classList.contains("info-modus")), "ⓘ schaltet den Info-Modus ein");
const markiert = await page.evaluate(() => getComputedStyle(document.querySelector("[data-info]")).outlineStyle);
ok(markiert === "dashed", "Erklärbare Elemente sind gestrichelt markiert");
await page.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Bereich").click()); await sleep(300);
t = await tafel();
ok(t && !(await page.evaluate(() => [...document.querySelectorAll(".aktiv")].some(b => b.textContent.trim() === "Bereich"))), "Info-Modus: Antippen erklärt statt auszuführen");
await page.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Alle" && x.getAttribute("data-info"))?.click()); await sleep(300);
const t2 = await tafel();
ok(t2 && t2.text !== t.text, "Info-Modus: anderes Element antippen zeigt dessen Erklärung");
await page.screenshot({ path: "info_modus.png" });
await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /Info-Modus beenden/.test(x.textContent)).click()); await sleep(300);
ok(!(await page.evaluate(() => document.body.classList.contains("info-modus"))) && !(await tafel()), "„Info-Modus beenden“: Modus aus, Tafel weg");
await page.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Bereich").click()); await sleep(300);
ok(await page.evaluate(() => [...document.querySelectorAll(".aktiv")].some(b => b.textContent.trim() === "Bereich")), "Danach funktionieren Knöpfe wieder normal");

// 3) Im Quiz (bisher keine Erklärung möglich): Lang drücken unten → Tafel OBEN
await page.evaluate(() => [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Alle" && x.getAttribute("data-info"))?.click()); await sleep(200);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^Quiz starten \(/.test(b.textContent.trim())).click()); await sleep(500);
await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(300);
const gewusst = await page.evaluate(() => { const b = [...document.querySelectorAll(".karte-btn")].find(x => /Gewusst/.test(x.textContent) && !/Nicht/.test(x.textContent)); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
const g2 = await page.evaluate(() => { const b = [...document.querySelectorAll(".karte-btn")].find(x => /Gewusst/.test(x.textContent) && !/Nicht/.test(x.textContent)); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: innerHeight }; });
await langDruecken(g2);
t = await tafel();
console.log("     Quiz-Tafel:", JSON.stringify(t), "Knopf y", Math.round(g2.y), "von", g2.h);
ok(t && /richtig/i.test(t.text) && amFinger(t, g2), "Im Quiz: Erklärung erscheint direkt am Finger");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
