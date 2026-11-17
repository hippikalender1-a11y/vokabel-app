import puppeteer from "puppeteer-core";
import { zuListen, menueShim } from "./hilfen.mjs";

// 251–253: Listen-Paket bleibt nach der Pause als Auswahl aktiv, Rauten ab „gelernt“ mit Highlight, „▶ Fortsetzen“ statt „Schließen“
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
const seite = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const session = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_session_aktiv")));
const symbole = () => page.evaluate(() => { const s = document.querySelector("[data-karte-antwort] .score-symbole"); if (!s) return null;
  return { score: +s.dataset.scoreSymbole, k: [...s.querySelectorAll(".sym")].map(e => (e.classList.contains("raute") ? "r" : "k") + (e.classList.contains("voll") ? "1" : "0")).join(""),
    puls: [...s.querySelectorAll(".sym")].map((e, i) => e.classList.contains("puls") ? i : null).filter(i => i !== null).join("") }; });
const gewusst = async () => {
  await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll(".karte-btn-ja")].find(b => /Gewusst/.test(b.textContent))?.click());
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name, score) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 7,
    vokabeln: Array.from({length:6},(_, i) => ({ id: i+1, E1: { wert: id+"w"+i, falsch: [] }, D1: { wert: name+" Wort"+i, falsch: [] },
      fortschritt: { score, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-01-01T10:00:00.000Z", stufeSeit: "2026-01-01T10:00:00.000Z" } })) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify(liste("l_a", "Unit 1", 2)));   // 2 → 3: Kreise werden leere Rauten
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify(liste("l_b", "Unit 2", 3)));   // 3 (fällig) → 4: eine Raute füllt sich
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} }]));
});
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
await zuListen(page);
await halte('[data-liste-id="l_a"]', 450); await halte('[data-liste-id="l_b"]', 450);
await page.evaluate(() => document.querySelector("[data-wahl-fertig]")?.click()); await sleep(700);
await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /starten/.test(b.textContent))?.click()); await sleep(900);

// ── 252: Symbole auf der Karte – Score 3 = drei leere Rauten, das geänderte Symbol pulsiert ──
const gesehen = {};
for (let i = 0; i < 10 && !(gesehen.a && gesehen.b); i++) {
  const vor = await symbole();
  if (!vor) break;
  await gewusst(); await sleep(120);
  const nach = await symbole();
  if (vor.score === 2 && !gesehen.a) gesehen.a = { vor, nach };
  if (vor.score === 3 && !gesehen.b) gesehen.b = { vor, nach };
  await sleep(1300);
}
console.log("     ", JSON.stringify(gesehen));
ok(gesehen.a?.vor.k === "k1k1k0" && gesehen.a?.nach.score === 3 && gesehen.a?.nach.k === "r0r0r0" && gesehen.a?.nach.puls === "012",
  "252: 2 → 3: aus zwei vollen Kreisen werden drei LEERE Rauten, alle drei pulsieren");
ok(gesehen.b?.vor.k === "r0r0r0" && gesehen.b?.nach.score === 4 && gesehen.b?.nach.k === "r1r0r0" && gesehen.b?.nach.puls === "0",
  "252: 3 → 4 (fällig, gewusst): eine Raute füllt sich und nur sie pulsiert");

// ── 253: Pausieren → „Pausiert“ mit „▶ Fortsetzen“; Fortsetzen macht dort weiter ──
const vorPause = await session();
const frageVor = await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
await page.evaluate(() => document.querySelector("[data-quiz-pause]")?.click()); await sleep(700);
const t = await seite();
const topbar = await page.evaluate(() => document.querySelector(".topbar .topbar-back")?.textContent.trim());
ok(/Pausiert/.test(t) && /Bis zur Pause/i.test(t) && !/Abgebrochen/.test(t), "253: Titel „Pausiert“, Ergebnis „Bis zur Pause“");
ok(topbar === "▶ Fortsetzen", `253: oben „▶ Fortsetzen“ statt „Schließen“ (${topbar})`);
const inPause = await session();
await page.evaluate(() => document.querySelector("[data-quiz-fortsetzen]")?.click()); await sleep(600);
const frageNach = await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
const nachFort = await session();
ok(frageNach && frageNach === frageVor, `253: Fortsetzen – weiter bei derselben Vokabel (${frageVor} / ${frageNach})`);
ok((nachFort?.pakete ?? 0) === (vorPause?.pakete ?? 0), `253: Paket nicht doppelt gezählt (vor ${vorPause?.pakete}, Pause ${inPause?.pakete}, danach ${nachFort?.pakete})`);

// ── 251: Pausieren → Zur Übersicht: die Listen des Pakets sind wieder ausgewählt; übernehmen behält den Fortschritt ──
await gewusst(); await sleep(1300);
await page.evaluate(() => document.querySelector("[data-quiz-pause]")?.click()); await sleep(700);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Zur Übersicht")?.click()); await sleep(900);
const wahl = () => page.evaluate(() => [...document.querySelectorAll("[data-wahl-nr]")].map(e => e.closest("[data-liste-id]")?.dataset.listeId + ":" + e.dataset.wahlNr).sort().join(","));
ok(await page.evaluate(() => document.querySelector("[data-auswahl-umschalter]")?.dataset.auswahlUmschalter) === "listen", "251: zurück in der Listen-Auswahl");
ok(await wahl() === "l_a:1,l_b:2", `251: Listen des pausierten Quiz wieder ausgewählt, Reihenfolge wie vorher (${await wahl()})`);
const abgefragt = (await session())?.abgefragt?.length || 0;
await page.evaluate(() => document.querySelector("[data-wahl-fertig]")?.click()); await sleep(800);
const s2 = await session();
ok(s2 && (s2.abgefragt || []).length === abgefragt && abgefragt > 0, `251: dieselben Listen übernehmen – Fortschritt bleibt (${abgefragt} → ${(s2?.abgefragt || []).length})`);
ok(/📋 Engl · 2 Listen/.test(await page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.innerText || "")), "251: weiter das Paket „📋 2 Listen“");

// ── 254: App neu laden (auch ohne gemerktes letztes Quiz) – das pausierte Paket kommt samt Listen und Einstellungen zurück ──
await page.evaluate(() => localStorage.removeItem("vokabel_letzter_slot"));
await page.reload(); await sleep(1000);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(400);
await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(600);
const nachStart = await page.evaluate(() => ({ kopf: document.querySelector("[data-slot-kopf-name]")?.innerText || "", start: !![...document.querySelectorAll("button")].find(b => /starten/.test(b.textContent)) }));
ok(/📋 Engl · 2 Listen/.test(nachStart.kopf) && nachStart.start, `254: nach dem Neuladen Paket mit Einstellungen und Start-Knopf (${JSON.stringify(nachStart)})`);
ok(((await session())?.abgefragt || []).length === abgefragt, "254: Fortschritt bleibt beim Neuladen");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
