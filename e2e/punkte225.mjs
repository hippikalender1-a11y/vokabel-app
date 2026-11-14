import puppeteer from "puppeteer-core";
import { zuListen } from "./hilfen.mjs";

// 225: Listen nur noch im Quiz-Tab (Einstellungen › Listen entfällt, „Sicherung“ eigener Bereich);
// 226: Mehrfach-Auswahl der Listen wie bei den Quiz – grüner Kopf übernimmt mehrere Listen als neues, ungespeichertes Quiz;
// 227: langer Lang-Druck in der Mehrfach-Auswahl ohne Funktion; 228: bewusst gewählte Kachel bleibt Nr. 1 (geladenes Quiz zählt nicht)
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
const tippe = async sel => { await page.evaluate(s => document.querySelector(s)?.click(), sel); await sleep(500); };
const wahl = () => page.evaluate(() => [...document.querySelectorAll(".listen-raster [data-liste-id]")].map(e => [e.dataset.listeId, e.querySelector("[data-wahl-nr]")?.dataset.wahlNr])
  .filter(x => x[1]).sort((a, b) => a[1] - b[1]).map(x => x[0]).join(","));
const gewaehlt = () => page.evaluate(() => [...document.querySelectorAll(".listen-raster [data-liste-id].kachel-gewaehlt")].map(e => e.dataset.listeId).join(","));
const kopf = () => page.evaluate(() => ({ zustand: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, text: document.querySelector("[data-slot-kopf-name]")?.innerText.replace(/\s+/g, " ").trim() }));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 4, vokabeln: [1, 2, 3].map(i => ({ id: i, E1: { wert: id + "w" + i, falsch: [] }, D1: { wert: "W" + i, falsch: [] } })) });
  const L = [["l_a", "Unit A"], ["l_b", "Unit B"], ["l_c", "Unit C"]];
  L.forEach(([id, n]) => localStorage.setItem("vokabel_liste_" + id, JSON.stringify(liste(id, n))));
  localStorage.setItem("vokabel_listen_index", JSON.stringify(L.map(([id, name], i) => ({ id, name, sprache:"en", platz:{ z:i, s:0 } }))));
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf: [], gespeichert: [] }));
});
await page.reload(); await sleep(800);

// ── 225: Einstellungen ohne Listen ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
ok(!(await page.$('[data-einst-kopf="listen"]')) && await page.$('[data-einst-kopf="sicherung"]'), "225: Einstellungen ohne „Listen“, mit „Sicherung“");

// ── 228: kurz gehaltene Liste bleibt als Nr. 1 drin ──
await zuListen(page);
await halte('[data-liste-id="l_a"]', 450);
ok(await gewaehlt() === "l_a" && await wahl() === "", `kurz halten wählt „Unit A“ (ohne Mehrfach-Auswahl) (${await gewaehlt()})`);
await halte('[data-liste-id="l_b"]', 1500);
ok(await wahl() === "l_a,l_b", `228: lang halten startet die Mehrfach-Auswahl, „Unit A“ Nr. 1, „Unit B“ Nr. 2 (${await wahl()})`);
ok(/☑ 2 Listen ausgewählt/.test((await kopf()).text || ""), `226: grüner Kopf „2 Listen ausgewählt“ (${(await kopf()).text})`);
await halte('[data-liste-id="l_c"]', 450);
ok(await wahl() === "l_a,l_b,l_c", `226: darin kurz halten nimmt „Unit C“ dazu (${await wahl()})`);
await halte('[data-liste-id="l_b"]', 450);
ok(await wahl() === "l_a,l_c", `kurz halten auf eine gewählte nimmt sie heraus (${await wahl()})`);
await halte('[data-liste-id="l_b"]', 450);

// ── 227: langer Lang-Druck in der Mehrfach-Auswahl tut nichts ──
await halte('[data-liste-id="l_c"]', 1500);
ok(await wahl() === "l_a,l_c,l_b" && (await kopf()).zustand === "offen", `227: lang halten auf eine gewählte: keine Funktion (${await wahl()})`);
await halte('[data-liste-id="l_b"]', 450);
await halte('[data-liste-id="l_b"]', 1500);
ok(await wahl() === "l_a,l_c" && (await kopf()).zustand === "offen", `227: lang halten auf eine nicht gewählte: keine Funktion (${await wahl()})`);

// ── 226: grüner Kopf übernimmt → neues, ungespeichertes Quiz aus den Listen ──
await tippe("[data-wahl-fertig]");
const k = await kopf();
ok(k.zustand !== "offen" && /nicht gespeichert/.test(k.text) && !(await page.$("[data-listen-wahl-kopf]")), `226: übernommen als ungespeichertes Quiz (${JSON.stringify(k)})`);
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.length) === 0, "226: nichts gespeichert");
const info = await page.evaluate(() => document.querySelector("[data-slot-kopf]")?.parentElement?.innerText.replace(/\s+/g, " ") || "");
console.log("     Info:", info.slice(0, 200));
ok(/6 Vokabeln/.test(info) && !/Listen-Auswahl/.test(info), "226/230: das Quiz enthält die zwei Listen (6 Vokabeln), ohne Listen-Auswahl (festes Paket)");

// ── 228: das bloß geladene Quiz zählt nicht ──
await zuListen(page);
await tippe('[data-liste-id="l_a"]');   // antippen: lädt „Unit A“ als Quiz
await zuListen(page);
ok(await gewaehlt() === "l_a", `geladene „Unit A“ ist markiert (${await gewaehlt()})`);
await halte('[data-liste-id="l_b"]', 1500);
ok(await wahl() === "l_b", `228: das geladene Quiz kommt nicht mit (nur „Unit B“) (${await wahl()})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
