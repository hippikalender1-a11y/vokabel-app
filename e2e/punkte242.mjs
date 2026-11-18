import puppeteer from "puppeteer-core";
import { zuListen, auswahlEnde, menueShim } from "./hilfen.mjs";

// 242: Verschieben auf einen belegten Platz – die übrigen rücken in der Spalte nach unten (statt zu tauschen); 243: Von–Bis – Ende antippen
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const mitte = sel => page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const halte = async (sel, ms) => { const p = await mitte(sel); await sleep(150); await finger("touchStart", p.x, p.y); await sleep(ms); await finger("touchEnd"); await sleep(450); };
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(350);
};
const menue = () => page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion));
const aktion = async label => { await page.evaluate(l => [...__aktionen()].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(400); };
const ordnerAnlegen = async name => {
  await page.evaluate(n => { const f = document.querySelector("[data-in-gruppe-dialog] [data-ordner-name-feld]");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, n); f.dispatchEvent(new Event("input", { bubbles: true })); }, name);
  await sleep(150);
  await page.evaluate(() => document.querySelector("[data-ordner-neu]")?.click()); await sleep(400);
};
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const kopf = () => page.evaluate(() => ({ zustand: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, name: document.querySelector("[data-slot-kopf-name]")?.textContent.trim(),
  laden: document.querySelector("[data-slot-laden]")?.dataset.slotLaden || null, multi: [...document.querySelectorAll("[data-multi-nr]")].sort((a, b) => a.dataset.multiNr - b.dataset.multiNr).map(b => b.dataset.slotId).join(",") }));
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400); };

await page.goto(URL);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 11,
    vokabeln: Array.from({length:10},(_, i) => ({ id: i+1, E1: { wert: id+"w"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] } })) });
  ["l_a","l_b","l_c"].forEach((id, i) => localStorage.setItem("vokabel_liste_" + id, JSON.stringify(liste(id, "Unit " + (i + 1)))));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} },
    { id:"l_c", name:"Unit 3", sprache:"en", ordner:"lo1", platz:{z:0,s:0} }]));
  localStorage.setItem("vokabel_listen_ordner", JSON.stringify([{ id:"lo1", name:"Kiste", platz:{z:2,s:0} }]));
  const k = (von, bis) => ({ listenIds:["l_a"], vokabelAuswahl: Array.from({length: bis - von + 1}, (_, i) => `l_a__${von + i}`), bereichTyp:"bereich", quizBereichTyp:"bereich",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[{ id:"o1", name:"Mappe", platz:{z:3,s:0} }], gespeichert: [1, 2, 3, 4].map(i =>
    ({ id:"s"+i, name:"Teil "+i, timestamp:i, konfiguration:k(i * 2 - 1, i * 2), sessionFortschritt:null, ...(i === 4 ? { ordner:"o1", platz:{z:0,s:0} } : { platz:{z:i - 1,s:0} }) })) }));
});
await page.reload(); await sleep(800); await page.evaluate(() => { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); }); await sleep(300);   // 289: Start mit Listen-Auswahl → Quiz
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await auswahlAuf();
await page.evaluate(() => { window._vib = []; navigator.vibrate = m => { window._vib.push(JSON.stringify(m)); return true; }; });
const kopfText = () => page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.innerText.replace(/\s+/g, " ").trim());
const pl = async () => Object.fromEntries((await slots()).gespeichert.filter(x => !x.ordner).map(x => [x.id, `${x.platz.z}|${x.platz.s}`]));
const zieh = async (von, nach) => {
  const h = await mitte(von);
  await finger("touchStart", h.x, h.y); await sleep(1300);
  for (let i = 1; i <= 3; i++) { await finger("touchMove", h.x + 5 * i, h.y + 4 * i); await sleep(40); }
  const z = await mitte(nach);
  for (let i = 1; i <= 8; i++) { await finger("touchMove", h.x + (z.x - h.x) * i / 8, h.y + (z.y - h.y) * i / 8); await sleep(40); }
  await sleep(150); await finger("touchEnd"); await sleep(600);
};
// Ausgang: Teil 1–3 in Spalte 0 (Zeilen 0–2), Mappe in Zeile 3
console.log("     Start", JSON.stringify(await pl()));

// ── einzeln: Teil 3 auf Teil 1 → Teil 1 und 2 rücken nach unten (kein Tausch) ──
await zieh('[data-slot-id="s3"]', '[data-slot-id="s1"]');
let p = await pl();
ok(p.s3 === "0|0" && p.s1 === "1|0" && p.s2 === "2|0", `Teil 3 oben, Teil 1 und 2 eine Zeile tiefer (${JSON.stringify(p)})`);
let o = (await slots()).ordner.find(x => x.id === "o1").platz;
ok(o.z === 3 && o.s === 0, `Mappe bleibt (Platz frei geworden, nichts muss weiter rücken) (${JSON.stringify(o)})`);

// ── mehrere: Teil 1 + 2 auf Teil 3 → Teil 3 und die Mappe rücken so weit wie nötig ──
await halte('[data-slot-id="s1"]', 450); await halte('[data-slot-id="s2"]', 450);
await zieh('[data-slot-id="s1"]', '[data-slot-id="s3"]');
p = await pl(); o = (await slots()).ordner.find(x => x.id === "o1").platz;
ok(p.s1 === "0|0" && p.s2 === "1|0" && p.s3 === "2|0" && o.z === 3, `Teil 1+2 ab Zeile 0, Teil 3 rückt auf Zeile 2, Mappe bleibt auf 3 (${JSON.stringify(p)}, Mappe ${JSON.stringify(o)})`);
await auswahlEnde(page);

// ── Rand: nach unten rücken braucht eine neue Zeile ──
await zieh('[data-slot-id="s3"]', '[data-slot-id="s1"]');   // s3 0, s1 1, s2 2, Mappe 3
await halte('[data-slot-id="s1"]', 450); await halte('[data-slot-id="s2"]', 450);
await zieh('[data-slot-id="s2"]', '[data-slot-id="o1"]');   // Teil 1+2 auf die Mappe (Zeile 3) → Mappe rückt auf Zeile 5
p = await pl(); o = (await slots()).ordner.find(x => x.id === "o1").platz;
ok(p.s1 === "3|0" && p.s2 === "4|0" && o.z === 5 && o.s === 0, `Mappe rückt unter die beiden (neue Zeilen) (${JSON.stringify(p)}, Mappe ${JSON.stringify(o)})`);
await auswahlEnde(page);

// ── 243: Von–Bis – nach „↔ Von–Bis“ genügt ein Tipp auf das Ende ──
await halte('[data-slot-id="s3"]', 450);   // Auswahl mit Teil 3 (Zeile 0)
await aktion("↔ Von–Bis");
ok(/Von–Bis: Ende antippen/.test(await kopfText()), `Kopf „Von–Bis: Ende antippen“ (${await kopfText()})`);
await page.evaluate(() => document.querySelector('[data-slot-id="s2"]').click()); await sleep(500);
ok((await kopf()).multi === "s3,s1,s2", `ein Tipp auf Teil 2 wählt Teil 3 bis Teil 2 (${(await kopf()).multi})`);
await auswahlEnde(page);

// ── Listen: Von–Bis per Tipp ──
await zuListen(page);
await halte('[data-liste-id="l_a"]', 450);
await aktion("↔ Von–Bis");
await page.evaluate(() => document.querySelector('[data-liste-id="l_b"]').click()); await sleep(500);
const lw = await page.evaluate(() => [...document.querySelectorAll("[data-wahl-nr]")].sort((a, b) => a.dataset.wahlNr - b.dataset.wahlNr).map(e => e.closest("[data-liste-id]")?.dataset.listeId).join(","));
ok(lw === "l_a,l_b", `Listen: ein Tipp wählt den Bereich (${lw})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
