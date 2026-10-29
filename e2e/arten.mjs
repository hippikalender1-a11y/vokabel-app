import puppeteer from "puppeteer-core";

// Abfragearten getrennt: Ü|D|A-Umschalter im Quiz-Tab, je Art eigene Einstellungen (bleiben beim Umschalten
// erhalten und werden mit der Konfiguration gespeichert); Akzente nur noch als eigene Art (kein Mischen)
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, text, exact = false) => {
  const done = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text, exact);
  // Ende eines Durchlaufs: „Weiter →“ führt zur Session-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const art = () => page.evaluate(() => document.querySelector("[data-quiz-art].aktiv")?.dataset.quizArt);
const modusName = () => page.evaluate(() => document.querySelector("[data-abfragemodus]")?.textContent.trim());
const reihenfolge = () => page.evaluate(() => [...document.querySelectorAll(".toggle-opt.aktiv, button.aktiv")].map(b => b.textContent.trim()).find(x => ["Zufällig", "Schlechteste", "Listen-Nr."].includes(x)));
const waehleArt = async a => { await artWaehlen(a); await sleep(300); };
const gespeichert = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots") || "{}").gespeichert || []);

// Ü|D|A sitzt in der zugeklappten Kopfzeile der Session-Auswahl
const artWaehlen = async a => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") k.querySelector("button.zeile-rechts")?.click(); });
  await new Promise(r => setTimeout(r, 300));
  await page.click(`[data-quiz-art="${a}"]`);
};
await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",E2:"Plural",D1:"Deutsch"}[t] || "", aktiv: ["E1","E2","D1"].includes(t) }]));
  const w = [["élève","élèves","Schüler"],["cœur","cœurs","Herz"],["chat","chats","Katze"]];
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Nomen", sprache:"fr", spalten: sp, naechste_id: 4,
    vokabeln: w.map(([a, b, d], i) => ({ id: i + 1, E1: { wert: a, falsch: [] }, E2: { wert: b, falsch: [] }, D1: { wert: d, falsch: [] } })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Nomen", sprache:"fr" }]));
  // alte Konfiguration mit gemischten Antworten (E1 Akzente + E2 Karte) → Übersetzung, ohne Akzente
  const k = { listenIds:["l_fr"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1","E2"], quizFrageTyp:"D1",
    quizAntwortTypenGeordnet:["E1","E2"], quizInfoTypenSession:[], quizSpalteModus:{E1:"akzent", E2:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"Alt gemischt", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300);
await clickText(".slot-chip", "Alt gemischt");

ok(await page.evaluate(() => [...document.querySelectorAll("[data-quiz-art]")].map(b => b.textContent.trim()).join("|")) === "Ü|D|A", "Umschalter Ü | D | A im Quiz-Tab");
if (process.env.SHOT) { await page.evaluate(() => { const b = document.querySelector("[data-slot-kopf] button.toggle-opt.aktiv"); b.textContent = "Unregelmäßige Verben Kapitel 3 – Wiederholung (21 - 40)"; }); await page.screenshot({ path: "lang_shot.png", clip: { x: 0, y: 0, width: 390, height: 160 } }); }
ok(await art() === "uebersetzung", "alte gemischte Konfiguration lädt als Übersetzung");
console.log("     Modus Ü:", await modusName());
ok(!/Akzente/.test(await modusName()), "Übersetzung ohne Akzente-Modus (gemischte Akzent-Spalte → Karte)");

// Ü: Reihenfolge ändern
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => ["Zufällig", "Schlechteste", "Listen-Nr."].includes(b.textContent.trim()) && b.closest("div[style*='sticky']"))?.click()); await sleep(300);
await clickText(".toggle-opt", "Zufällig", true);
ok(await reihenfolge() === "Zufällig", "Übersetzung: Reihenfolge auf Zufällig gestellt");

// D: eigene Einstellungen (Standard), Diktat-Konfiguration
await waehleArt("diktat");
console.log("     Modus D:", await modusName());
ok(await art() === "diktat" && await modusName() === "Diktat", "D: Diktat");
ok(await reihenfolge() === "Schlechteste", `D: eigene Reihenfolge (Standard Schlechteste, ist ${await reihenfolge()})`);
if (!(await page.evaluate(() => /Diktat-Spalte/.test(document.body.innerText)))) await page.click("[data-abfragemodus]");
await sleep(300);
ok(await page.evaluate(() => /Diktat-Spalte/.test(document.body.innerText) && ![...document.querySelectorAll(".toggle-opt")].some(b => b.textContent.trim() === "Frage – Antwort")), "D: Diktat-Konfiguration, kein Frage–Antwort-Schalter");

// A: nur Fremdsprachen-Spalten als Antwort, Modus fest Akzente
await waehleArt("akzente");
console.log("     Modus A:", await modusName());
ok(await art() === "akzente" && /Akzente/.test(await modusName()), "A: Akzente");
const rollen = await page.evaluate(() => [...document.querySelectorAll(".spalten-rolle-btn")].map(b => b.textContent.trim()));
console.log("     Rollen A:", rollen.join(" | "));
ok(await page.evaluate(() => [...document.querySelectorAll(".spalten-modus-btn")].every(b => b.textContent.trim() === "Akzente")), "A: Antwort-Modus nur Akzente");

// zurück zu Ü: Zufällig noch da
await waehleArt("uebersetzung");
ok(await reihenfolge() === "Zufällig", "zurück zu Ü: eigene Einstellung (Zufällig) erhalten");

// speichern: alle drei Arten in der Konfiguration
await waehleArt("diktat");
await clickText("button", "Speichern", true);
await page.evaluate(() => { const i = document.querySelector(".modal input"); if (i) { i.value = ""; } });
await page.type(".modal input", "Drei Arten");
await page.evaluate(() => [...document.querySelectorAll(".modal .btn-primary")].pop()?.click()); await sleep(400);
const neu = (await gespeichert()).find(x => x.name.includes("Drei Arten"));
console.log("     gespeichert:", neu?.name, neu?.konfiguration?.art, Object.keys(neu?.konfiguration?.arten || {}).join(","));
ok(neu && neu.konfiguration.art === "diktat" && neu.konfiguration.arten.uebersetzung?.quizReihenfolge === "zufall"
  && neu.konfiguration.arten.diktat?.quizModus === "diktat" && neu.konfiguration.arten.akzente?.quizSpalteModus?.E1 === "akzent", "gespeichert: Art + Einstellungen aller drei Arten");

// neu laden: Konfiguration öffnet in Diktat, Ü behält Zufällig
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300);
await clickText(".slot-chip", "Drei Arten");
ok(await art() === "diktat", "geladen: zuletzt gewählte Art (Diktat)");
await waehleArt("uebersetzung");
ok(await reihenfolge() === "Zufällig", "geladen → Ü: Zufällig gespeichert");

// Mini-Kreise Ü/D/A in den Kacheln: Lernfortschritt je Art, antippen lädt in dieser Art
const kreise = name => page.evaluate(n => {
  const chip = [...document.querySelectorAll(".raster-chip")].find(c => c.querySelector(".raster-name")?.textContent.trim() === n);
  return chip ? [...chip.querySelectorAll("[data-mini-kreis]")].map(k => `${k.dataset.miniKreis}:${k.dataset.pct}:${k.textContent.trim()}`).join(",") : null;
}, name);
await page.evaluate(() => { const l = JSON.parse(localStorage.getItem("vokabel_liste_l_fr")); l.vokabeln[0].fortschritt = { score: 3 }; l.vokabeln[1].akzentFortschritt = { score: 3 }; localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l)); });
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300);
const kr = await kreise("Alt gemischt");
console.log("     Mini-Kreise:", kr);
if (process.env.SHOT) await page.screenshot({ path: "kreise_shot.png" });
ok(kr === "uebersetzung:33:Ü,diktat:0:D,akzente:50:A", "Kachel: Ü 33 %, D 0 %, A 50 % (nur Wörter mit Akzent)");
await page.evaluate(() => [...document.querySelectorAll(".raster-chip")].find(c => c.textContent.includes("Alt gemischt")).querySelector('[data-mini-kreis="diktat"]').click()); await sleep(400);
ok(await art() === "diktat" && await page.evaluate(() => document.querySelector("[data-slot-kopf] button.toggle-opt.aktiv")?.textContent.trim()) === "Alt gemischt", "Kreis D antippen: „Alt gemischt“ in Diktat geladen");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300);
ok(await page.evaluate(() => { const c = [...document.querySelectorAll(".raster-chip")].find(c => c.textContent.includes("Alt gemischt")); return c.querySelector('[data-mini-kreis="diktat"] circle').getAttribute("fill") === "#2d6a4f"; }), "aktive Art der geladenen Konfiguration hervorgehoben");
// Statistik: Kreis A lädt die Statistik in Akzente
await clickText(".tab", "Statistik"); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv, button.toggle-opt")?.click(); }); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".raster-chip")].find(c => c.textContent.includes("Alt gemischt"))?.querySelector('[data-mini-kreis="akzente"]').click()); await sleep(400);
ok(await page.evaluate(() => document.querySelector("[data-kreismitte]")?.textContent.replace("⇄", "").trim()) === "Akzente", "Statistik: Kreis A zeigt die Akzente-Statistik");
await clickText(".tab", "Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300);
await clickText(".slot-chip", "Drei Arten");

// Quiz in A: Akzent-Abfrage
await waehleArt("akzente");
if (process.env.SHOT) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: "arten_shot.png" }); }
await clickText("button", "Quiz starten (");
ok(await page.evaluate(() => !!document.querySelector("[data-akzent-kachel], .akzent-kachel, .akzent-kacheln")) || await page.evaluate(() => /Akzente/.test(document.querySelector(".quiz-fortschritt")?.textContent || "")), "A: Quiz fragt Akzente ab");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
