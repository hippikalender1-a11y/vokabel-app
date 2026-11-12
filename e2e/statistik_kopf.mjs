import puppeteer from "puppeteer-core";

// Statistik-Kopf: Texte in der Kopfzeilen-Schrift, Fortschrittsbalken mit eigenen Rollen – unabhängig vom Kreisdiagramm
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
const farbe = sel => page.evaluate(sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).color : null; }, sel);
const variable = n => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim(), n);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_e", JSON.stringify({ id:"l_e", name:"Englisch 6", sprache:"en", spalten: sp, naechste_id: 6,
    vokabeln: Array.from({length:5},(_, i) => ({ id: i+1, E1: { wert: "w"+i, falsch: [] }, D1: { wert: "d"+i, falsch: [] }, ...(i < 2 ? { fortschritt: { score: 4 } } : {}) })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_e", name:"Englisch 6", sprache:"en", platz:{z:0,s:0} }]));
  const basis = { haupt: "#2d6a4f", "haupt-hell": "#52b788", "auf-haupt": "#fff", hintergrund: "#f7f5f0", karte: "#fff", flaeche: "#f0ede8", "text-stark": "#1a1a1a", text: "#3b3832",
    text2: "#6b6560", text3: "#9b9590", rahmen: "#e0dbd2", richtig: "#2d6a4f", falsch: "#c0392b", gelb: "#f9a825", orange: "#e67e22", info: "#6a1b9a",
    gelernt: "#2d6a4f", arbeit: "#e9c46a", nie: "#d6d2cb", negativ: "#e57373", kopfzeile: "#335544", "kopf-schrift": "#ffffff", "kopf-schrift-leise": "#ddeedd", "fortschritt-gelernt": "#ff00aa" };
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], gelerntSchwelle: 3, sprache: "alle", farbschema: "e1", eigeneSchemata: [{ id: "e1", name: "Test", basis: "natur", farben: basis, elemente: {} }] }));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Statistik")).click()); await sleep(500);
await page.evaluate(() => { const c = [...document.querySelectorAll(".quiz-setup-check, .karte-zeile")].find(e => e.textContent.includes("Englisch 6")); c?.click(); }); await sleep(400);
console.log("     Kopf:", await farbe("[data-statistik-kopf-titel]"), await farbe("[data-statistik-kopf-zahl]"), await farbe("[data-statistik-kopf-prozent]"));
ok(await farbe("[data-statistik-kopf-titel]") === "rgb(255, 255, 255)" && await farbe("[data-statistik-kopf-prozent]") === "rgb(255, 255, 255)", "„Lernfortschritt“ und Prozent in der Kopfzeilen-Schrift (weiß)");
ok(await farbe("[data-statistik-kopf-zahl]") === "rgb(221, 238, 221)", "„x / y gelernt“ in der leisen Kopfzeilen-Schrift");
const balken = await page.evaluate(() => [...document.querySelectorAll("[data-statistik-kopf-balken] > div")].map(d => getComputedStyle(d).backgroundColor));
console.log("     Balken:", balken.join(", "));
ok(balken.includes("rgb(255, 0, 170)"), "Fortschrittsbalken: eigene Farbe für Gelernt");
ok(await variable("gelernt") === "#2d6a4f", "Kreisdiagramm-Farbe Gelernt bleibt unabhängig");
const diagrammText = await page.evaluate(() => { const t = [...document.querySelectorAll("svg text, .sektion div, .sektion span")].find(e => /Nie abgefragt|In Arbeit|Gelernt/.test(e.textContent) && !e.closest("[data-statistik-kopf-balken]")); return t ? getComputedStyle(t).color : null; });
ok(diagrammText && diagrammText !== "rgb(255, 255, 255)", `Texte am Kreisdiagramm nicht in der Kopf-Schrift (${diagrammText})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
