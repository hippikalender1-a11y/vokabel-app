import puppeteer from "puppeteer-core";
import { zuListen } from "./hilfen.mjs";

// Gesten im Session- und Listen-Raster: Lang-Druck öffnet die Auswahl-Tafel (unten, bleibt offen; weitere antippen
// wählt mit aus; nur die Tafel beendet), Lang-Druck auf freie Stelle + ziehen sammelt ein, beim Ziehen 1,2 s über
// einer Session halten bildet eine Gruppe, auf „← Alle Sessions“ ziehen nimmt heraus, Gruppe mit einer Session löst sich auf
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const kachel = id => `[data-slot-id="${id}"]`;
const mitte = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, sel);
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const tafel = () => page.evaluate(() => { const t = document.querySelector("[data-auswahl-tafel]"); return t ? t.querySelector("[data-info-blase]").textContent : null; });
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const gewaehlt = () => page.evaluate(() => [...document.querySelectorAll("[data-multi-nr]")].map(b => b.dataset.slotId).join(","));
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(300);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"fr", spalten: sp, naechste_id: 41,
    vokabeln: Array.from({length:40},(_, i) => ({ id: i+1, E1: { wert: "mot"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] } })) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify(liste("l_a", "Unité 1")));
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify(liste("l_b", "Unité 2")));
  localStorage.setItem("vokabel_liste_l_c", JSON.stringify(liste("l_c", "Unité 3")));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} },
    { id:"l_b", name:"Unité 2", sprache:"fr", platz:{z:1,s:0} }, { id:"l_c", name:"Unité 3", sprache:"fr", platz:{z:3,s:0} }]));
  const k = (von, bis) => ({ listenIds:["l_a"], vokabelAuswahl: Array.from({length: bis - von + 1}, (_, i) => `l_a__${von + i}`), bereichTyp:"bereich", quizBereichTyp:"bereich",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert: [1, 2, 3, 4].map(i =>
    ({ id:"s"+i, name:"Teil "+i, timestamp:i, konfiguration:k(i * 10 - 9, i * 10), sessionFortschritt:null, platz:{z:i - 1,s:0} })) }));
});
await page.reload(); await sleep(700);

// ── Auswahl-Tafel ──
await kontext(kachel("s1"));
ok((await tafel())?.startsWith("Teil 1"), `Lang-Druck: Auswahl-Tafel unten mit „Teil 1“ (${await tafel()})`);
ok((await menue()).includes("✎ Umbenennen") && (await menue()).includes("☑ Auswählen"), "eine Session: ihr Menü (Umbenennen … Auswählen bleibt)");
ok(await gewaehlt() === "s1", "Teil 1 ist ausgewählt");
await page.click(kachel("s2")); await sleep(300);
ok(/^2 ausgewählt/.test(await tafel() || ""), `Antippen von Teil 2: „2 ausgewählt“ (${await tafel()})`);
ok((await menue()).some(m => m.startsWith("🧩 Multiquiz starten (2)")), "Tafel zeigt Aktionen für die Auswahl");
ok(await gewaehlt() === "s1,s2", "Teil 1 + 2 ausgewählt");
await page.click(kachel("s2")); await sleep(300);
ok(await gewaehlt() === "s1" && (await tafel())?.startsWith("Teil 1"), "nochmal antippen wählt ab");
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(b => /Statistik/.test(b.textContent))?.click()); await sleep(300);
ok(await tafel() && await page.$("[data-slot-id]"), "Tippen daneben (Statistik-Tab) bewirkt nichts, Tafel bleibt");
await page.click("[data-info-blase]"); await sleep(300);
ok(!(await tafel()) && await gewaehlt() === "", "Tippen auf die Tafel beendet die Auswahl");
// „☑ Auswählen“: Tafel zu, Auswahl-Modus bleibt
await kontext(kachel("s1"));
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "☑ Auswählen").click()); await sleep(300);
ok(!(await tafel()) && await gewaehlt() === "s1" && await page.$("[data-wahl-fertig]"), "„☑ Auswählen“: Tafel zu, Auswahl-Modus bleibt (Fertig)");
await page.click("[data-wahl-fertig]"); await sleep(300);

// ── Einsammeln: Lang-Druck auf freie Stelle, dann über Kacheln ziehen ──
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
const a1 = await mitte(kachel("s1")), a3 = await mitte(kachel("s3"));
const frei = { x: a1.x + a1.w + 6, y: a1.y };
await finger("touchStart", frei.x, frei.y); await sleep(700);
for (let i = 1; i <= 4; i++) { await finger("touchMove", frei.x - (frei.x - a1.x) * i / 4, frei.y); await sleep(40); }
for (let i = 1; i <= 8; i++) { await finger("touchMove", a1.x, a1.y + (a3.y - a1.y) * i / 8); await sleep(40); }
await finger("touchEnd"); await sleep(400);
ok(await gewaehlt() === "s1,s2,s3", `Einsammeln: Teil 1–3 ausgewählt (${await gewaehlt()})`);
ok(/^3 ausgewählt/.test(await tafel() || ""), `danach Auswahl-Tafel „3 ausgewählt“ (${await tafel()})`);
await page.click("[data-info-blase]"); await sleep(300);

// ── Haltestufen auf einer Kachel ──
// sofort wischen: nichts (Seite scrollt)
let h = await mitte(kachel("s1"));
await finger("touchStart", h.x, h.y); await sleep(80);
for (let i = 1; i <= 4; i++) { await finger("touchMove", h.x, h.y + i * 15); await sleep(30); }
await finger("touchEnd"); await sleep(400);
ok(!(await tafel()) && await gewaehlt() === "" && !(await page.$("[data-wahl-fertig]")) && !(await page.$(".slot-kopf-knoepfe .typ-btn.aktiv")), "sofort gewischt: weder verschoben noch ausgewählt");
// lang halten und über weitere Kacheln fahren: auswählen
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
h = await mitte(kachel("s1")); const h3 = await mitte(kachel("s3"));
await finger("touchStart", h.x, h.y); await sleep(350);
ok(await page.$(`[data-angehoben][data-slot-id="s1"]`), "nach 0,25 s: Kachel angehoben");
await sleep(400);
ok(!(await page.$("[data-angehoben]")), "nach 0,6 s: ausgewählt statt angehoben");
for (let i = 1; i <= 8; i++) { await finger("touchMove", h.x, h.y + (h3.y - h.y) * i / 8); await sleep(40); }
await finger("touchEnd"); await sleep(400);
ok(await gewaehlt() === "s1,s2,s3", `lang halten + fahren: Teil 1–3 ausgewählt (${await gewaehlt()})`);
ok(/^3 ausgewählt/.test(await tafel() || ""), "danach Auswahl-Tafel „3 ausgewählt“");
ok(!(await page.$(".slot-kopf-knoepfe .typ-btn.aktiv")) || await page.$("[data-wahl-fertig]"), "kein Verschieben-Modus");
await page.click("[data-info-blase]"); await sleep(300);
// lang halten, loslassen: Tafel mit dem Menü der Kachel
await finger("touchStart", h.x, h.y); await sleep(750); await finger("touchEnd"); await sleep(400);
ok((await tafel())?.startsWith("Teil 1") && await gewaehlt() === "s1", `lang halten + loslassen: Tafel „Teil 1“, nur Teil 1 ausgewählt (${await gewaehlt()})`);
ok(await page.evaluate(() => !document.querySelector("[data-slot-kopf-name]") || document.querySelector("[data-slot-kopf-name]").textContent.trim() !== "Teil 1"), "lang halten lädt die Session nicht");
await page.click("[data-info-blase]"); await sleep(300);

// ── Ziehen + verweilen: Gruppe ──
// schnell loslassen tauscht (keine Gruppe)
const ziehe = async (von, nach, warten) => {
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  const p = await mitte(von);
  await finger("touchStart", p.x, p.y); await sleep(400);   // kurz halten: angehoben
  await finger("touchMove", p.x + 12, p.y + 12); await sleep(300);   // Ziehen beginnt (Verschieben-Modus: Raster kann sich verschieben)
  const q = await mitte(nach);
  for (let i = 1; i <= 8; i++) { await finger("touchMove", p.x + (q.x - p.x) * i / 8, p.y + (q.y - p.y) * i / 8); await sleep(40); }
  if (warten) await sleep(warten);
  const ring = await page.evaluate(() => document.querySelector("[data-gruppen-ring]")?.dataset.gruppenRing || null);
  await finger("touchEnd"); await sleep(400);
  return ring;
};
let ring = await ziehe(kachel("s3"), kachel("s4"), 0);
let d = await slots();
ok(ring === "laeuft", "beim Darüberziehen läuft der Ring");
ok(!(d.ordner || []).length && d.gespeichert.find(x => x.id === "s3").platz.z === 3, "schnell losgelassen: getauscht, keine Gruppe");
ring = await ziehe(kachel("s3"), kachel("s4"), 2800);
d = await slots();
const g = (d.ordner || [])[0];
ok(ring === "fertig", "nach 1,2 s: Ring voll (📁)");
ok(g && g.name === "Teil" && ["s3", "s4"].every(id => d.gespeichert.find(x => x.id === id).ordner === g.id), `verweilt: Gruppe „${g?.name}“ aus Teil 3 + 4`);
ok(g?.platz?.z === 2 && g?.platz?.s === 0, "Gruppe steht am Platz der Ziel-Session");
const schatten = await page.evaluate(id => getComputedStyle(document.querySelector(`[data-ordner-id="${id}"]`)).boxShadow, g.id);
ok((schatten.match(/rgb/g) || []).length >= 4, "Gruppen-Kachel als Stapel (zwei Kartenkanten)");
await page.evaluate(() => [...document.querySelectorAll(".typ-btn.aktiv")].find(b => b.textContent.trim() === "Fertig")?.click()); await sleep(200);
// Teil 2 auf die Gruppe: verweilen → hinein
await ziehe(kachel("s2"), `[data-ordner-id="${g.id}"]`, 2800);
d = await slots();
ok(d.gespeichert.find(x => x.id === "s2").ordner === g.id, "Session auf der Gruppe verweilt → in der Gruppe");
await page.evaluate(() => [...document.querySelectorAll(".typ-btn.aktiv")].find(b => b.textContent.trim() === "Fertig")?.click()); await sleep(200);

// ── aus der Gruppe ziehen, Auflösen bei einer Session ──
await page.click(`[data-ordner-id="${g.id}"]`); await sleep(300);
await ziehe(kachel("s2"), "[data-ordner-zurueck]", 0);
d = await slots();
ok(!d.gespeichert.find(x => x.id === "s2").ordner, "auf „← Alle Sessions“ gezogen: Teil 2 aus der Gruppe");
await ziehe(kachel("s3"), "[data-ordner-zurueck]", 0);
d = await slots();
ok(!(d.ordner || []).length && d.gespeichert.every(x => !x.ordner), "nur noch eine Session: Gruppe hat sich aufgelöst");
ok(d.gespeichert.find(x => x.id === "s4").platz?.z === 2, "die verbliebene Session steht am Platz der Gruppe");
ok(!(await page.$("[data-ordner-zurueck]")), "aufgelöste Gruppe: zurück auf der obersten Ebene");

// ── Listen-Raster: dieselbe Auswahl-Tafel ──
await page.evaluate(() => [...document.querySelectorAll(".typ-btn.aktiv")].find(b => b.textContent.trim() === "Fertig")?.click()); await sleep(200);
await zuListen(page);
await kontext('[data-liste-id="l_a"]');
ok((await tafel())?.startsWith("Unité 1") && (await menue()).includes("▦ In Sessions aufteilen"), "Listen: Lang-Druck → Tafel mit dem Listen-Menü");
await page.click('[data-liste-id="l_c"]'); await sleep(300);
ok(/^2 ausgewählt/.test(await tafel() || "") && (await menue()).includes("JSON exportieren"), `Listen: Antippen wählt mit aus (${await tafel()})`);
ok(await page.evaluate(() => !document.querySelector("[data-vokabel-liste], .liste-detail-header")), "Listen: Antippen öffnet die Liste nicht");
await page.click("[data-info-blase]"); await sleep(300);
ok(!(await tafel()) && !(await page.$("[data-wahl-nr]")), "Listen: Tafel beendet die Auswahl");
const b1 = await mitte('[data-liste-id="l_a"]'), b3 = await mitte('[data-liste-id="l_c"]');
// Einsammeln im Listen-Raster: Lang-Druck auf das leere Feld zwischen Unité 2 und 3, hoch bis Unité 1, dann runter zu Unité 3
const leer = await page.evaluate(() => { const a = document.querySelector('[data-liste-id="l_b"]').getBoundingClientRect(), b = document.querySelector('[data-liste-id="l_c"]').getBoundingClientRect(); return { x: a.x + a.width / 2, y: (a.bottom + b.top) / 2 }; });
await finger("touchStart", leer.x, leer.y); await sleep(700);
for (let i = 1; i <= 8; i++) { await finger("touchMove", leer.x, leer.y + (b1.y - leer.y) * i / 8); await sleep(40); }
for (let i = 1; i <= 10; i++) { await finger("touchMove", leer.x, b1.y + (b3.y - b1.y) * i / 10); await sleep(40); }
await finger("touchEnd"); await sleep(400);
const lw = await page.evaluate(() => [...document.querySelectorAll("[data-wahl-nr]")].map(e => e.closest("[data-liste-id]").dataset.listeId).join(","));
ok(lw === "l_a,l_b,l_c", `Listen: Einsammeln vom leeren Feld aus (${lw})`);
ok(/^3 ausgewählt/.test(await tafel() || ""), "Listen: danach Auswahl-Tafel „3 ausgewählt“");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
