import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1200 });
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
  await sleep(250);
};
const text = () => page.evaluate(() => document.body.innerText);
const kacheln = () => page.evaluate(() => [...document.querySelectorAll(".akzent-kachel")].map(b => b.textContent + (b.disabled ? "" : "*")));
// Kachel i antippen, Variante v wählen
const setze = async (i, v) => {
  await page.evaluate(i => document.querySelectorAll(".akzent-kachel")[i].click(), i);
  await sleep(150);
  await clickText(".akzent-variante", v, true);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Akzente", sprache:"fr", spalten: sp, naechste_id:5, vokabeln: [
    { id:1, E1:{wert:"élève",falsch:[]},  D1:{wert:"Schüler",falsch:[]} },
    { id:2, E1:{wert:"cœur",falsch:[]},   D1:{wert:"Herz",falsch:[]} },
    { id:3, E1:{wert:"chat",falsch:[]},   D1:{wert:"Katze",falsch:[]} },
    { id:4, E1:{wert:"garçon",falsch:[]}, D1:{wert:"Junge",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Akzente");
// Spalten-Bereich ggf. aufklappen
if (!(await page.evaluate(() => [...document.querySelectorAll(".spalten-modus-btn")].some(b => b.textContent.trim() === "Akzente"))))
  await page.evaluate(() => [...document.querySelectorAll("button, div")].find(b => /^Frage.?–.?Antwort/.test(b.textContent.trim()) && b.onclick !== undefined)?.click());
await sleep(300);
const knoepfe = await page.evaluate(() => [...document.querySelectorAll(".spalten-modus-btn")].map(b => b.textContent.trim()));
console.log("     Modus-Knöpfe:", knoepfe.join(" | "));
ok(knoepfe.filter(k => k === "Akzente").length === 1, "Knopf „Akzente“ nur bei der Fremdsprachen-Antwortspalte");
await clickText(".spalten-modus-btn", "Akzente", true);
let t = await text();
ok(t.includes("Akzente: auch Wörter ohne Akzent"), "Schalter „auch Wörter ohne Akzent“ erscheint");
ok(/Quiz starten \(3 Vokabeln\)/.test(t), "Ohne Mischen: nur 3 Wörter mit Akzent (chat fehlt)");
await clickText(".quiz-setup-check", "auch Wörter ohne Akzent");
ok(/Quiz starten \(4 Vokabeln\)/.test(await text()), "Mit Mischen: 4 Wörter");
await clickText(".quiz-setup-check", "auch Wörter ohne Akzent");

await clickText("button", "Quiz starten (");
await sleep(400);
const gesehen = [];
const klassen = () => page.evaluate(() => [...document.querySelectorAll(".akzent-kachel")].map(b => b.className.replace("akzent-kachel", "").trim()));
const tippe = async i => { await page.evaluate(i => document.querySelectorAll(".akzent-kachel")[i].click(), i); await sleep(120); };
const kartenFarbe = () => page.evaluate(() => document.querySelector(".quiz-antwort-box")?.className || "");
for (let k = 0; k < 10; k++) {
  t = await text();
  if (/Durchlauf abgeschlossen|Auswertung|Paket fertig/.test(t)) break;
  if (t.includes("Weiter zur Wiederholung")) { gesehen.push("[W]"); await clickText("button", "Weiter zur Wiederholung"); continue; }
  const frage = ["Schüler", "Herz", "Junge"].find(w => t.includes(w));
  const mal = gesehen.filter(x => x === frage).length + 1;
  gesehen.push(frage);
  if (frage === "Schüler") {
    const vorher = await kacheln();
    ok(vorher.join(" ") === "e* l* e* v* e*", `élève startet ohne Akzente, alle Kacheln gleich antippbar: ${vorher.join(" ")}`);
    await setze(2, "è");
    ok((await klassen())[2] === "ok", "Richtig gesetzter Akzent wird sofort grün");
    await setze(0, "é");
    ok(!(await text()).includes("Prüfen"), "Alle Akzente richtig → automatisch übernommen (ohne Prüfen)");
    ok((await kartenFarbe()).includes("richtig"), "Ganze Karte wird grün");
  } else if (frage === "Herz" && mal === 1) {
    await tippe(0);
    ok((await klassen())[0] === "blink", "Buchstabe ohne Akzent (c) leuchtet rot auf");
    ok(!(await page.$(".akzent-leiste")), "… und öffnet keine Variantenleiste");
    await sleep(700);
    ok((await klassen())[0] === "", "Rotes Aufleuchten verschwindet wieder");
    await setze(1, "ô");
    ok((await kacheln())[1] === "o*" && (await klassen())[1] === "blink", "Falsche Variante: leuchtet rot, Buchstabe bleibt o");
    await setze(1, "œ");
    const nach = await kacheln();
    t = await text();
    ok(nach.map(x => x.replace("*", "")).join("") === "cœur", `œ ersetzt o + e: ${nach.join(" ")}`);
    ok(t.includes("Fehlgriff") && !(await kartenFarbe()).includes("richtig"), "Mit Fehlgriff: zählt als nicht gewusst, Karte nicht grün");
  } else if (frage === "Herz") {
    await setze(1, "œ");
  } else if (frage === "Junge" && mal === 1) {
    await clickText("button", "Prüfen", true);   // ohne ç geprüft
    t = await text();
    ok(await page.evaluate(() => document.querySelectorAll(".akzent-kachel.falsch").length === 1) && t.includes("garçon"),
      "Prüfen ohne Akzent: fehlender Buchstabe rot, Lösung „garçon“ angezeigt");
  } else if (frage === "Junge") {
    await setze(3, "ç");
  }
  await sleep(150);
  await clickText("button", "Weiter →");
  await sleep(300);
}
console.log("     Abfolge:", gesehen.join(" → "));
ok(gesehen.includes("[W]") && gesehen.filter(x => x === "Junge").length === 2 && gesehen.filter(x => x === "Herz").length === 2, "Falsch beantwortete Wörter kommen nach der Wiederholungs-Karte erneut");
t = await text();
ok(/1 von 3 richtig/.test(t), "Auswertung: 1 von 3 richtig");
const st = await page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.map(v => [v.E1.wert, [v.akzentFortschritt?.score ?? null, v.fortschritt?.score ?? null]])));
console.log("     [Akzent-Score, normaler Score]:", JSON.stringify(st));
ok(st["élève"][0] === 1 && st["cœur"][0] === -1 && st["garçon"][0] === -1, "Eigener Akzent-Score: richtig +1, falsch −1 (nur erste Antwort)");
ok(Object.values(st).every(([, n]) => n === null), "Normaler Score bleibt unverändert");
ok(st["chat"][0] === null, "chat wurde nicht abgefragt");

// Statistik zeigt Akzent-Fortschritt
await clickText("button", "Zur Übersicht");
await clickText(".tab", "Statistik");
await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check, div")].find(e => e.textContent.trim() === "Akzente")?.click());
await sleep(300);
ok(/Akzente (\d+ %|[+−-]?\d)/.test(await text()), "Statistik-Kopf zeigt den Akzent-Fortschritt");

// Schwierigkeitsgrad: Hervorheben gilt standardmäßig nur in "Einfach"; per Haken änderbar
await clickText(".tab", "Quiz");
await sleep(300);
const markiert = () => page.evaluate(() => document.querySelectorAll(".akzent-kachel.markiert").length);
const starteUndZaehle = async () => {
  await clickText("button", "Quiz starten (");
  await sleep(400);
  if ((await text()).includes("Weiter zur Wiederholung")) await clickText("button", "Weiter zur Wiederholung");
  const n = await markiert();
  await clickText("button", "Beenden", true);
  await sleep(300);
  if (/Zur Übersicht/.test(await text())) await clickText("button", "Zur Übersicht");
  await sleep(300);
  return n;
};
ok(await starteUndZaehle() === 0, "Stufe „Schwer“ (Standard): Akzent-Buchstaben nicht hervorgehoben");
const oeffneEinst = async () => {
  if (!(await text()).includes("Was gilt als einfach / schwer?")) await page.evaluate(() => [...document.querySelectorAll("button.toggle-opt")].find(b => /^(Einfach|Schwer)$/.test(b.textContent.trim()) && b.closest("div[style*='sticky']"))?.click());
  await sleep(300);
};
await oeffneEinst();
ok((await text()).includes("Was gilt als einfach / schwer?"), "Einstellungen zeigen die Tabelle „Was gilt als einfach / schwer?“");
await clickText(".toggle-opt", "Einfach", true);
ok(await starteUndZaehle() > 0, "Stufe „Einfach“: Buchstaben mit Akzent hervorgehoben");
// Haken "hervorheben" in Spalte Einfach entfernen
await oeffneEinst();
await page.evaluate(() => {
  const zeile = [...document.querySelectorAll("div")].find(d => d.textContent.trim() === "Akzent-Modus: Buchstaben mit Akzent hervorheben");
  zeile.parentElement.nextElementSibling.click();
});
await sleep(200);
const einst = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}"));
console.log("     gespeicherte Stufen:", JSON.stringify(einst.stufen));
ok(einst.stufen?.einfach?.akzentHervorheben === false, "Haken wird gespeichert");
ok(await starteUndZaehle() === 0, "Ohne Haken: auch in „Einfach“ keine Hervorhebung");
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
