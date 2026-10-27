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
let garconFalsch = false, rotGesehen = false, ligaturOk = false;
for (let k = 0; k < 8; k++) {
  t = await text();
  if (/Durchlauf abgeschlossen|Auswertung|Paket fertig/.test(t)) break;
  if (t.includes("Weiter zur Wiederholung")) { gesehen.push("[W]"); await clickText("button", "Weiter zur Wiederholung"); continue; }
  const frage = ["Schüler", "Herz", "Junge"].find(w => t.includes(w));
  gesehen.push(frage);
  const vorher = await kacheln();
  if (frage === "Schüler") {
    ok(vorher.join(" ") === "e* l e* v e*", `élève startet ohne Akzente: ${vorher.join(" ")}`);
    await setze(2, "è"); await setze(0, "é");
  } else if (frage === "Herz") {
    await setze(1, "œ");
    const nach = await kacheln();
    ligaturOk = nach.map(x => x.replace("*", "")).join("") === "cœur";
    ok(ligaturOk, `œ ersetzt o + e: ${nach.join(" ")}`);
  } else if (frage === "Junge") {
    if (!garconFalsch) { garconFalsch = true; }   // erst falsch: c bleibt ohne Cedille
    else await setze(3, "ç");
  }
  await clickText("button", "Prüfen", true);
  await sleep(200);
  t = await text();
  if (frage === "Junge" && gesehen.filter(x => x === "Junge").length === 1) {
    rotGesehen = await page.evaluate(() => document.querySelectorAll(".akzent-kachel.falsch").length === 1) && t.includes("rot markierte");
    ok(rotGesehen, "Falscher Buchstabe wird rot markiert, Lösung „garçon“ angezeigt");
    ok(t.includes("garçon"), "Lösung sichtbar");
  }
  await clickText("button", "Weiter →");
  await sleep(300);
}
console.log("     Abfolge:", gesehen.join(" → "));
ok(gesehen.includes("[W]") && gesehen.filter(x => x === "Junge").length === 2, "Falsch beantwortetes garçon kommt nach der Wiederholungs-Karte erneut");
t = await text();
ok(/2 von 3 richtig/.test(t), "Auswertung: 2 von 3 richtig");
const st = await page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.map(v => [v.E1.wert, [v.akzentFortschritt?.score ?? null, v.fortschritt?.score ?? null]])));
console.log("     [Akzent-Score, normaler Score]:", JSON.stringify(st));
ok(st["élève"][0] === 1 && st["cœur"][0] === 1 && st["garçon"][0] === -1, "Eigener Akzent-Score: richtig +1, falsch −1 (nur erste Antwort)");
ok(Object.values(st).every(([, n]) => n === null), "Normaler Score bleibt unverändert");
ok(st["chat"][0] === null, "chat wurde nicht abgefragt");

// Statistik zeigt Akzent-Fortschritt
await clickText("button", "Zur Übersicht");
await clickText(".tab", "Statistik");
await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check, div")].find(e => e.textContent.trim() === "Akzente")?.click());
await sleep(300);
ok(/Akzente (\d+ %|[+−-]?\d)/.test(await text()), "Statistik-Kopf zeigt den Akzent-Fortschritt");
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
