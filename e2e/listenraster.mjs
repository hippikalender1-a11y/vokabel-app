import puppeteer from "puppeteer-core";

// Listen-Tab als Raster: Lang-Druck → Menü (Umbenennen, Duplizieren, Verschieben, Löschen),
// Lang-Druck + Ziehen verschiebt (belegt → tauschen), Größe unter Einstellungen → Listen, Sprachfilter rückt zusammen
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
const clickText = async (sel, text, exact = false) => {
  const done = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text, exact);
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const mitte = key => page.evaluate(k => { const r = document.querySelector(`[data-raster-zelle="${k}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, key);
const plaetze = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-liste-id]")].map(d => [d.querySelector(".karte-zeile-name").textContent.trim().replace(/^[^\p{L}]+/u, ""), d.dataset.rasterZelle || "-"])));
const indexNamen = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_listen_index")).map(l => l.name).join(","));
const menue = async name => {
  await page.evaluate(n => {
    const el = [...document.querySelectorAll("[data-liste-id]")].find(d => d.querySelector(".karte-zeile-name").textContent.trim().replace(/^[^\p{L}]+/u, "") === n);
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 20 }));
  }, name);
  await sleep(250);
};
const aktionen = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.textContent.trim()));
const aktion = async label => { await page.evaluate(l => document.querySelector(`[data-info-aktion="${l}"]`).click(), label); await sleep(300); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Fremd",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const listen = [["l_a","Alpha","fr"],["l_b","Beta","fr"],["l_c","Gamma","en"]];
  listen.forEach(([id, name, sprache], i) => localStorage.setItem("vokabel_liste_" + id, JSON.stringify({ id, name, sprache, spalten: sp, naechste_id: 2,
    vokabeln: [{ id:1, E1:{wert:"mot"+i,falsch:[]}, D1:{wert:"Wort"+i,falsch:[]}, fortschritt:{ score: i, streak: 0, aufgedecktStreak: 0 } }] })));
  // alter Index ohne Plätze
  localStorage.setItem("vokabel_listen_index", JSON.stringify(listen.map(([id, name, sprache]) => ({ id, name, sprache }))));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");

let pl = await plaetze();
console.log("     Start:", JSON.stringify(pl));
ok(pl.Alpha === "0|0" && pl.Beta === "1|0" && pl.Gamma === "2|0", "alte Listen bekommen Plätze in bisheriger Reihenfolge (1 Spalte)");

// Lang-Druck + Ziehen: Gamma auf Platz von Alpha → tauschen
let p = await mitte("2|0"); const ziel = await mitte("0|0");
await finger("touchStart", p.x, p.y); await sleep(700);
ok((await aktionen()).join("|") === "✎ Umbenennen|⧉ Duplizieren|⇄ Verschieben|▦ In Sessions aufteilen|↺ Lernstand zurücksetzen|🗑 Löschen", "Lang-Druck: Menü Umbenennen, Duplizieren, Verschieben, Zurücksetzen, Löschen");
for (let i = 1; i <= 8; i++) { await finger("touchMove", p.x, p.y + (ziel.y - p.y) * i / 8); await sleep(40); }
ok((await aktionen()).length === 0 && await page.$("[data-listen-fertig]"), "beim Ziehen: Menü weg, Verschieben-Modus");
await finger("touchEnd"); await sleep(300);
pl = await plaetze();
console.log("     nach Ziehen:", JSON.stringify(pl));
ok(pl.Gamma === "0|0" && pl.Alpha === "2|0" && pl.Beta === "1|0", "Gamma auf Alphas Platz gezogen: die beiden tauschen");
ok(await indexNamen() === "Gamma,Beta,Alpha", "Reihenfolge gespeichert (Index folgt dem Raster)");

// Verschieben-Modus: antippen, dann freien Platz antippen
await sleep(500);   // der Klick direkt nach dem Ziehen wird verschluckt
await page.evaluate(() => [...document.querySelectorAll("[data-liste-id]")].find(d => d.textContent.includes("Beta")).click()); await sleep(200);
await page.evaluate(() => document.querySelector('[data-raster-zelle="5|0"]').click()); await sleep(300);
pl = await plaetze();
ok(pl.Beta === "5|0", `Antippen + freien Platz antippen: Beta auf 5|0 (${pl.Beta})`);
await page.click("[data-listen-fertig]"); await sleep(300);
ok(!(await page.$("[data-listen-fertig]")), "„Fertig“ beendet das Verschieben");

// Reihenfolge auch im Quiz-Tab
await clickText(".tab", "Quiz"); await sleep(300);
const quizReihe = await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].map(d => d.textContent.trim()).filter(t => /Alpha|Beta|Gamma/.test(t)).map(t => t.match(/Alpha|Beta|Gamma/)[0]).join(","));
ok(quizReihe === "Gamma,Alpha,Beta", `Quiz-Tab zeigt die Listen in Raster-Reihenfolge (${quizReihe})`);
await clickText(".tab", "Listen");

// Umbenennen über das Menü
await menue("Alpha"); await aktion("✎ Umbenennen");
await page.evaluate(() => { const i = document.querySelector(".modal input"); i.select(); });
await page.keyboard.type("Alpha neu"); await clickText(".modal button", "Speichern", true);
pl = await plaetze();
ok(pl["Alpha neu"] === "2|0" && !pl.Alpha, "Umbenennen aus dem Menü: Name geändert, Platz bleibt");

// Duplizieren
await menue("Gamma"); await aktion("⧉ Duplizieren");
ok(await page.evaluate(() => document.querySelector(".modal input").value) === "Gamma (Kopie)", "Duplizieren: Vorschlag „Gamma (Kopie)“");
await clickText(".modal button", "Duplizieren", true);
pl = await plaetze();
console.log("     nach Duplizieren:", JSON.stringify(pl));
const kopie = await page.evaluate(() => { const idx = JSON.parse(localStorage.getItem("vokabel_listen_index")); const k = idx.find(l => l.name === "Gamma (Kopie)"); const l = JSON.parse(localStorage.getItem("vokabel_liste_" + k.id)); const orig = JSON.parse(localStorage.getItem("vokabel_liste_l_c")); return { origScore: orig.vokabeln[0].fortschritt?.score, id: k.id, n: l.vokabeln.length, score: l.vokabeln[0].fortschritt?.score, sprache: l.sprache }; });
ok(pl["Gamma (Kopie)"] === "1|0" && kopie.id !== "l_c" && kopie.n === 1 && kopie.score === undefined && kopie.sprache === "en", "Kopie auf erstem freien Platz, mit Vokabeln, Lernstand neu");
ok(kopie.origScore === 2, "Original behält seinen Lernstand");

// Lernstand zurücksetzen: nur Übersetzung, Diktat bleibt
await page.evaluate(() => { const l = JSON.parse(localStorage.getItem("vokabel_liste_l_b")); l.vokabeln[0].diktatFortschritt = { score: 3 }; localStorage.setItem("vokabel_liste_l_b", JSON.stringify(l)); });
await menue("Beta"); await aktion("↺ Lernstand zurücksetzen");
const rf = await page.evaluate(() => document.querySelector("[data-zuruecksetzen]")?.innerText.replace(/\s+/g, " "));
console.log("     Rückfrage:", rf);
ok(/„Beta“/.test(rf || "") && /Übersetzung 1 Vokabel mit Score/.test(rf || "") && /Diktat 1 Vokabel mit Score/.test(rf || ""), "Rückfrage nennt Liste und Vokabeln mit Score je Art");
await page.click('[data-zuruecksetzen-art="diktat"]'); await sleep(150);
await clickText(".modal .btn-danger", "Zurücksetzen", true);
const beta = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_b")).vokabeln[0]);
ok(!beta.fortschritt && beta.diktatFortschritt?.score === 3 && beta.E1.wert === "mot1", "Übersetzungs-Score gelöscht, Diktat-Score und Vokabel bleiben");
await menue("Beta"); await aktion("↺ Lernstand zurücksetzen");
await page.click('[data-zuruecksetzen-art="uebersetzung"]'); await page.click('[data-zuruecksetzen-art="diktat"]'); await page.click('[data-zuruecksetzen-art="akzente"]'); await sleep(150);
ok(await page.evaluate(() => document.querySelector(".modal .btn-danger").disabled), "nichts gewählt: „Zurücksetzen“ gesperrt");
await clickText(".modal button", "Abbrechen", true);

// Löschen
await menue("Gamma (Kopie)"); await aktion("🗑 Löschen");
ok(/„Gamma \(Kopie\)“ wird dauerhaft gelöscht/.test(await page.evaluate(() => document.querySelector(".modal").innerText)), "Löschen: Rückfrage nennt die Liste");
await clickText(".modal .btn-danger", "Löschen", true);
pl = await plaetze();
ok(!pl["Gamma (Kopie)"] && pl.Gamma === "0|0" && await page.evaluate(() => !localStorage.getItem("vokabel_liste_" + JSON.parse(localStorage.getItem("vokabel_listen_index")).find(l => l.name === "Gamma (Kopie)")?.id)), "gelöscht, andere bleiben auf ihren Plätzen");

// Antippen öffnet die Liste
await page.evaluate(() => [...document.querySelectorAll("[data-liste-id]")].find(d => d.textContent.includes("Gamma")).click()); await sleep(300);
console.log("     geöffnet:", await page.evaluate(() => document.querySelector(".topbar")?.innerText.replace(/\s+/g, " ")));
ok(await page.evaluate(() => /Gamma/.test(document.body.innerText) && !document.querySelector("[data-liste-id]")), "Antippen öffnet die Liste");
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(300);

// Einstellungen → Listen: 2 Spalten
await clickText(".tab", "Einstellungen");
await page.evaluate(() => document.querySelector('[data-listen-raster-spalten="2"]').click()); await sleep(200);
ok(await page.evaluate(() => document.querySelector("[data-listen-raster-zeilen]").textContent.trim()) === "10", "Einstellungen → Listen: Raster 10 Zeilen");
await clickText(".tab", "Listen");
pl = await plaetze();
const spalten = await page.evaluate(() => getComputedStyle(document.querySelector(".listen-raster")).gridTemplateColumns.split(" ").length);
console.log("     2 Spalten:", JSON.stringify(pl));
ok(spalten === 2 && pl.Gamma === "0|0", "Raster mit 2 Spalten, Plätze bleiben");
ok(await page.evaluate(() => /1 Vokabel$/.test(document.querySelector("[data-liste-id] .karte-zeile-sub").textContent.trim())), "Kachel: Flagge, Name, Anzahl");

// Sprachfilter: rückt zusammen, kein Verschieben
await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}"); e.sprache = "fr"; localStorage.setItem("vokabel_einstellungen", JSON.stringify(e)); });
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");
pl = await plaetze();
console.log("     Filter fr:", JSON.stringify(pl));
ok(Object.keys(pl).join(",") === "Alpha neu,Beta" && Object.values(pl).every(v => v === "-"), "Sprachfilter: nur französische Listen, zusammengerückt");
await menue("Beta");
ok(!(await aktionen()).includes("⇄ Verschieben"), "mit Sprachfilter kein „Verschieben“ im Menü");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
