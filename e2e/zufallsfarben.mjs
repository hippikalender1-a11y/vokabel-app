import puppeteer from "puppeteer-core";

// Fünf bunte Pastell-Vorlagen (eigene Töne für Kopf, Kopfzeilen, Start …) und „🎲 Zufällige Farben“:
// jeder Tipp ersetzt das Schema „Zufall“; umbenannte Zufalls-Schemata bleiben erhalten
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
const variable = n => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim(), n);
const einst = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}"));
const zufallsSchemata = async () => ((await einst()).eigeneSchemata || []).filter(x => x.zufall);

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await page.click('[data-einst-kopf="app"]'); await sleep(300);

// Vorlagen
const neu = ["sorbet", "lagune", "blumenwiese", "nordlicht", "sommerfest"];
ok(await page.evaluate(n => n.every(id => document.querySelector(`[data-farbschema="${id}"]`)), neu), "fünf neue Vorlagen: Sorbet, Lagune, Blumenwiese, Nordlicht, Sommerfest");
await page.click('[data-farbschema="sorbet"]'); await sleep(300);
const sorbet = { kopf: await variable("app-kopf"), zeile: await variable("kopfzeile"), start: await variable("start"), haupt: await variable("haupt") };
console.log("     Sorbet:", JSON.stringify(sorbet));
ok(sorbet.kopf === "#cdeee2" && sorbet.zeile === "#e6dcf7" && sorbet.start === "#9fd8c4" && sorbet.haupt === "#d9756c", "Sorbet: App-Kopf, Kopfzeilen, Start und Hauptfarbe in eigenen Tönen");
ok(new Set(Object.values(sorbet)).size === 4, "Sorbet: vier verschiedene Töne");

// Zufall
await page.click("[data-zufall-farben]"); await sleep(300);
let z = await zufallsSchemata();
const e1 = await einst();
ok(z.length === 1 && z[0].name === "Zufall" && e1.farbschema === z[0].id, "🎲: Schema „Zufall“ angelegt und gewählt");
const h1 = await variable("haupt");
ok(/^#[0-9a-f]{6}$/.test(h1) && h1 !== sorbet.haupt, `🎲: neue Hauptfarbe (${h1})`);
await page.click("[data-zufall-farben]"); await sleep(300);
z = await zufallsSchemata();
const h2 = await variable("haupt");
ok(z.length === 1 && h2 !== h1, `erneut 🎲: dasselbe Schema „Zufall“ mit neuen Farben (${h2})`);
// umbenennen → bleibt, neuer Tipp legt ein neues „Zufall“ an
await page.evaluate(id => { const e = JSON.parse(localStorage.getItem("vokabel_einstellungen")); e.eigeneSchemata = e.eigeneSchemata.map(x => x.id === id ? { ...x, name: "Mein Zufall" } : x); localStorage.setItem("vokabel_einstellungen", JSON.stringify(e)); }, z[0].id);
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await page.click('[data-einst-kopf="app"]'); await sleep(300);
await page.click("[data-zufall-farben]"); await sleep(300);
const namen = ((await einst()).eigeneSchemata || []).map(x => x.name);
ok(namen.includes("Mein Zufall") && namen.includes("Zufall"), `umbenanntes bleibt, neues „Zufall“ (${namen.join(", ")})`);
// Lesbarkeit: dunkle Schrift auf den hellen Pastell-Knöpfen
const hell = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return (r * 299 + g * 587 + b * 114) / 1000; };
ok(hell(await variable("auf-haupt")) < 70 && hell(await variable("haupt")) > 110, "Zufall: helle Knöpfe mit dunkler Schrift");

// Farb-Werkzeuge bleiben lesbar, auch bei weißer Schrift auf weißen Knöpfen im Schema
await page.evaluate(() => {
  const e = JSON.parse(localStorage.getItem("vokabel_einstellungen"));
  const w = { haupt: "#ffffff", "auf-haupt": "#ffffff", karte: "#ffffff", "text-stark": "#ffffff", text: "#ffffff", text2: "#ffffff", hintergrund: "#ffffff", rahmen: "#ffffff" };
  e.eigeneSchemata = e.eigeneSchemata.map(x => x.name === "Zufall" ? { ...x, farben: { ...x.farben, ...w }, elemente: { ".btn.btn-primary": { "background-color": "#ffffff", color: "#ffffff" } } } : x);
  localStorage.setItem("vokabel_einstellungen", JSON.stringify(e));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await page.click('[data-einst-kopf="app"]'); await sleep(300);
await page.click("[data-farbmodus-start]"); await sleep(300);
const leiste = await page.evaluate(() => ["[data-farbmodus-uebernehmen]", "[data-farbmodus-zuruecksetzen]"].map(sel => { const c = getComputedStyle(document.querySelector(sel)); return [c.color, c.backgroundColor]; }));
console.log("     Leiste:", JSON.stringify(leiste));
ok(leiste.every(([fg, bg]) => fg !== bg) && leiste[0][1] === "rgb(45, 106, 79)" && leiste[1][0] === "rgb(45, 106, 79)", "Farbmodus-Leiste in festen, lesbaren Farben (Übernehmen grün, Zurücksetzen grün auf weiß)");
const p = await page.evaluate(() => { const k = document.querySelector('[data-einst-kopf="app"]'); k.scrollIntoView({ block: "center" }); const r = k.getBoundingClientRect(); return { x: r.x + 40, y: r.y + r.height / 2 }; });
await page.evaluate((x, y) => document.elementFromPoint(x, y).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y })), p.x, p.y); await sleep(300);
const feld = await page.evaluate(() => { const f = document.querySelector("[data-farbfeld]"); const c = getComputedStyle(f); const t = getComputedStyle(f.querySelector("[data-farbfeld-titel]") || f); return [c.backgroundColor, t.color]; });
ok(feld[0] === "rgb(255, 255, 255)" && feld[1] !== "rgb(255, 255, 255)", `Farbfeld: weiß mit dunkler Schrift (${feld.join(" / ")})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
