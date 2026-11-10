import puppeteer from "puppeteer-core";
import { neueEineSession, zuListen } from "./hilfen.mjs";

// Kurzes Aufleuchten in der Bestätigen-Farbe (sofort an und aus, ohne Überblendung): gewählte Listen-Kachel,
// Listen-Name im Kopf nach dem Zuklappen, „Alle | Bereich“ nach dem Bestätigen, geladene Session-Kachel und
// Session-Name nach dem Zuklappen; Beispielsätze: „📄 Prompt als Datei“ (Begleitsatz in der Zwischenablage)
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.evaluateOnNewDocument(() => {
  window.__ablage = []; window.__dateien = [];
  try { Object.defineProperty(navigator, "clipboard", { value: { writeText: t => { window.__ablage.push(t); return Promise.resolve(); }, readText: () => Promise.resolve("") } }); } catch { /* */ }
  const orig = URL.createObjectURL;
  URL.createObjectURL = b => { b.text().then(t => window.__dateien.push(t)); return orig(b); };
  HTMLAnchorElement.prototype.click = function () { window.__dateien.push("name:" + this.download); };
});
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const best = () => page.evaluate(() => { const d = document.createElement("div"); d.style.background = "var(--bestaetigen)"; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
const zustand = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? { an: e.classList.contains("leuchten"), farbe: getComputedStyle(e).backgroundColor, uebergang: getComputedStyle(e).transitionDuration } : null; }, sel);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vok = p => Array.from({ length: 4 }, (_, i) => ({ id: i + 1, E1: { wert: `${p}${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 5, vokabeln: vok("mot") }));
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify({ id:"l_b", name:"Unité 2", sprache:"fr", spalten: sp, naechste_id: 5, vokabeln: vok("chose") }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }, { id:"l_b", name:"Unité 2", sprache:"fr", platz:{z:1,s:0} }]));
  const k = { listenIds:["l_b"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g", name:"Meine Session", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
});
await page.reload(); await sleep(700);
const B = await best();

// ── Listen-Auswahl: gewählte Kachel leuchtet sofort, danach normal ──
await neueEineSession(page);
await page.click('[data-quiz-liste="l_a"]'); await sleep(80);
let z = await zustand('[data-quiz-liste="l_a"]');
ok(z?.an && z.farbe === B && z.uebergang === "0s", `Listen-Kachel gewählt: sofort Bestätigen-Farbe (${JSON.stringify(z)})`);
await sleep(800);
z = await zustand('[data-quiz-liste="l_a"]');
ok(z && !z.an && z.farbe !== B, `danach wieder normal (${z?.farbe})`);
await page.click('[data-quiz-liste="l_a"]'); await sleep(80);
ok(!(await zustand('[data-quiz-liste="l_a"]')).an, "Abwählen: kein Aufleuchten");
await page.click('[data-quiz-liste="l_a"]'); await sleep(800);

// ── Listen-Auswahl bestätigen: Name im Kopf leuchtet ──
await page.click("[data-listen-bestaetigen]"); await sleep(80);
z = await zustand("[data-listen-kopf]");
ok(z?.an && z.farbe === B, `Listen-Auswahl zu: Listen-Name leuchtet (${JSON.stringify(z)})`);
await sleep(800);
ok(!(await zustand("[data-listen-kopf]")).an, "… und hört wieder auf");

// ── Alle | Bereich: nach „Bestätigen“ leuchtet die aktive Hälfte ──
await page.click('[data-vokwahl="bereich"]'); await sleep(300);
await page.click("[data-vok-bestaetigen]"); await sleep(80);
z = await zustand('[data-vokwahl="alle"]');
ok(z?.an && z.farbe === B, `Bereich zu (nichts angehakt): „Alle“ leuchtet (${JSON.stringify(z)})`);
ok(!(await zustand('[data-vokwahl="bereich"]')).an, "„Bereich“ leuchtet nicht");
await sleep(800);
ok(!(await zustand('[data-vokwahl="alle"]')).an, "… und hört wieder auf");

// ── Sessions: geladene Kachel leuchtet, danach der Session-Name im Kopf ──
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await page.click('[data-slot-id="g"]'); await sleep(80);
z = await zustand('[data-slot-id="g"]');
ok(z?.an && z.farbe === B, `Session-Kachel geladen: leuchtet (${JSON.stringify(z)})`);
z = await zustand("[data-slot-kopf-name]");
ok(z?.an && z.farbe === B && /Meine Session/.test(await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").textContent)), `gleichzeitig: neuer Session-Name im Kopf leuchtet (${JSON.stringify(z)})`);
await sleep(450);
z = await zustand("[data-slot-kopf-name]");
ok(z?.an && z.farbe === B && /Meine Session/.test(await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").textContent)), `Übersicht zu: Session-Name leuchtet nach (${JSON.stringify(z)})`);
await sleep(800);
ok(!(await zustand("[data-slot-kopf-name]")).an, "… und hört wieder auf");

// ── Beispielsätze: Prompt als Datei ──
await zuListen(page);
await page.click('[data-liste-id="l_a"]'); await sleep(600);
await page.click("[data-saetze-ergaenzen]"); await sleep(400);
const kl = () => page.evaluate(() => ({ kopieren: document.querySelector("[data-satz-prompt-kopieren]").className, datei: document.querySelector("[data-satz-prompt-datei]")?.className }));
ok(/btn-primary/.test((await kl()).kopieren) && /btn-ghost/.test((await kl()).datei), "Weg „Antwort im Chat“: Kopieren hervorgehoben, Datei daneben");
await page.click('[data-satz-weg-wahl="datei"]'); await sleep(200);
ok(/btn-primary/.test((await kl()).datei) && /btn-ghost/.test((await kl()).kopieren), "Weg „Als Datei“: Prompt-Datei hervorgehoben");
const prompt = await page.evaluate(() => document.querySelector("[data-satz-prompt]").value);
await page.click("[data-satz-prompt-datei]"); await sleep(400);
const erg = await page.evaluate(() => ({ ablage: window.__ablage, dateien: window.__dateien, meldung: document.querySelector("[data-satz-meldung]")?.textContent }));
ok(erg.dateien.includes(prompt) && erg.dateien.some(d => d === "name:Beispielsätze – Unité 1.txt"), `Datei mit dem ganzen Prompt (${erg.dateien.filter(d => d.startsWith("name:")).join(", ")})`);
ok(erg.ablage.length === 1 && erg.ablage[0].length < 100 && /angehängten Datei/.test(erg.ablage[0]), `kurzer Begleitsatz in der Zwischenablage (${erg.ablage[0]})`);
ok(/Prompt-Datei erstellt/.test(erg.meldung || ""), "Meldung");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
