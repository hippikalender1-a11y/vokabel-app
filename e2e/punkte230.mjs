import puppeteer from "puppeteer-core";
import { zuListen } from "./hilfen.mjs";

// 230: übernommene Mehrfach-Auswahl (Multiquiz) ohne Listen-/Bereichsauswahl;
// 232: Kachel deutlich angehoben, Rückmeldung wählbar (Einstellungen › App › Halten); 234: kurz halten färbt ein/wählt aus, lang (1,0 s) hebt an
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
const mitte = sel => page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const halte = async (sel, ms) => { const p = await mitte(sel); await sleep(150); await finger("touchStart", p.x, p.y); await sleep(ms); await finger("touchEnd"); await sleep(450); };
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(350);
};
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const aktion = async label => { await page.evaluate(l => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(400); };
const ordnerAnlegen = async name => {
  await page.evaluate(n => { const f = document.querySelector("[data-in-gruppe-dialog] [data-ordner-name-feld]");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, n); f.dispatchEvent(new Event("input", { bubbles: true })); }, name);
  await sleep(150);
  await page.evaluate(() => document.querySelector("[data-ordner-neu]")?.click()); await sleep(400);
};
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const kopf = () => page.evaluate(() => ({ zustand: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, name: document.querySelector("[data-slot-kopf-name]")?.textContent.trim(),
  laden: document.querySelector("[data-slot-laden]")?.dataset.slotLaden || null, multi: [...document.querySelectorAll("[data-multi-nr]")].sort((a, b) => a.dataset.multiNr - b.dataset.multiNr).map(b => b.dataset.slotId).join(",") }));
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 11,
    vokabeln: Array.from({length:10},(_, i) => ({ id: i+1, E1: { wert: "word"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] } })) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify(liste("l_a", "Unit 1")));
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify(liste("l_b", "Unit 2")));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} }]));
  const k = (von, bis) => ({ listenIds:["l_a"], vokabelAuswahl: Array.from({length: bis - von + 1}, (_, i) => `l_a__${von + i}`), bereichTyp:"bereich", quizBereichTyp:"bereich",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert: [1, 2, 3].map(i =>
    ({ id:"s"+i, name:"Teil "+i, timestamp:i, konfiguration:k(i * 3 - 2, i * 3), sessionFortschritt:null, platz:{z:i - 1,s:0} })) }));
});
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await auswahlAuf();


// 232: Vibrationen mitschreiben (Android: navigator.vibrate)
await page.evaluate(() => { window._vib = []; navigator.vibrate = m => { window._vib.push(JSON.stringify(m)); return true; }; });
const hinter = sel => page.evaluate(s => getComputedStyle(document.querySelector(s)).backgroundColor, sel);

// ── 232/234: kurz halten färbt die Kachel ein (Auswahl), noch nicht angehoben ──
const vorher = await hinter('[data-slot-id="s2"]');
let p = await mitte('[data-slot-id="s2"]'); await sleep(150);
await finger("touchStart", p.x, p.y); await sleep(450);
const kurz = await page.evaluate(() => { const el = document.querySelector('[data-slot-id="s2"]'); return { an: el.hasAttribute("data-angehoben"), bg: getComputedStyle(el).backgroundColor }; });
ok(!kurz.an && kurz.bg !== vorher, `234: kurz gehalten – eingefärbt, nicht angehoben (${vorher} → ${kurz.bg})`);
await finger("touchEnd"); await sleep(450);
ok(await page.evaluate(() => window._vib.length) === 0, "232: kurzes Halten – keine Vibration der App");
let k = await kopf();
ok(k.multi === "s2", `234: losgelassen – „Teil 2“ ausgewählt (${k.multi})`);

// ── 232/234: lang halten (1,0 s) hebt deutlich an, Doppel-Tipp; die Auswahl bleibt ──
p = await mitte('[data-slot-id="s1"]'); await sleep(150);
await finger("touchStart", p.x, p.y); await sleep(800);
ok(!(await page.evaluate(() => window._vib.length)) && !(await page.$("[data-angehoben]")), "234: nach 0,8 s noch nicht angehoben");
await sleep(450);
const lang = await page.evaluate(() => { const el = document.querySelector('[data-slot-id="s1"]'); return { an: el.hasAttribute("data-angehoben"), tf: getComputedStyle(el).transform }; });
ok(lang.an && lang.tf !== "none", `232: nach 1,0 s sichtbar angehoben (${lang.tf})`);
await finger("touchEnd"); await sleep(450);
ok(await page.evaluate(() => window._vib.join(" ")) === "[8,70,8]", `232: Rückmeldung Doppel-Tipp (${await page.evaluate(() => window._vib.join(" "))})`);
ok((await kopf()).multi === "s2", `234: lang halten ohne Bewegung ändert die Auswahl nicht (${(await kopf()).multi})`);
await halte('[data-slot-id="s1"]', 450);
k = await kopf();
ok(k.multi === "s2,s1", `kurz halten nimmt „Teil 1“ dazu (${k.multi})`);

// ── 230: übernommene Mehrfach-Auswahl (Multiquiz) ohne Listen-/Bereichsauswahl ──
await page.evaluate(() => document.querySelector("[data-wahl-fertig]")?.click()); await sleep(700);
await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(400);
const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
ok(/Multiquiz/.test(text), "230: Multiquiz geladen");
ok(!/Listen-Auswahl/.test(text) && !(await page.$(".liste-detail-header")), "230: keine Listen-/Bereichsauswahl beim Multiquiz");

// ── 232: Einstellung „Halten“ ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await page.evaluate(() => document.querySelector('[data-einst-kopf="app"]')?.click()); await sleep(300);
await page.evaluate(() => document.querySelector('[data-einst-unter="haptik"]')?.click()); await sleep(300);
ok(await page.$('[data-haptik="tick"]'), "232: Einstellungen › App › Halten zeigt die Varianten");
await page.evaluate(() => { window._vib = []; document.querySelector('[data-haptik="tick"]')?.click(); }); await sleep(300);
ok(await page.evaluate(() => window._vib.join(" ")) === "[6]" && await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).haltenHaptik) === "tick", "232: „Tick“ gewählt – zur Probe gespürt und gespeichert");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
