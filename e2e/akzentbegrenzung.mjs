import puppeteer from "puppeteer-core";

// Akzente mit Wörtern ohne Akzent: höchstens Faktor × so viele wie mit Akzent (je Stufe einstellbar),
// bevorzugt schwächster / kein Akzent-Score, gleichmäßig verteilt
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
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const artWaehlen = async a => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") k.querySelector("button.zeile-rechts")?.click(); });
  await sleep(300);
  await page.click(`[data-quiz-art="${a}"]`); await sleep(300);
};
const anzeige = () => page.evaluate(() => ({
  akzent: document.querySelector('[data-anzahl="akzent"]')?.textContent.trim(),
  start: [...document.querySelectorAll("button")].map(b => b.textContent.trim()).find(x => /^Quiz starten/.test(x)),
}));
const setzeAnteil = async (st, wert) => {
  await page.evaluate(() => { if (!document.querySelector("[data-akzent-ohne-anteil]")) [...document.querySelectorAll("button")].find(b => /^(Einfach|Schwer)$/.test(b.textContent.trim()) && b.closest("div[style*='sticky']"))?.click(); });
  await sleep(300);
  await page.select(`[data-akzent-ohne-anteil="${st}"]`, wert); await sleep(300);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const mit = [["élève","Schüler"],["cœur","Herz"],["garçon","Junge"],["été","Sommer"]];
  const ohne = Array.from({ length: 12 }, (_, i) => ["mot" + (i + 1), "o" + (i + 1)]);
  const voks = [...mit, ...ohne].map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] },
    // o1–o6 haben schon einen guten Akzent-Score (werden zuletzt gewählt), o7–o12 nie abgefragt
    ...(i >= 4 && i < 10 ? { akzentFortschritt: { score: 3 } } : {}) }));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id: "l_fr", name: "Akzente", sprache: "fr", spalten: sp, naechste_id: 17, vokabeln: voks }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id: "l_fr", name: "Akzente", sprache: "fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus: "schwer", gelerntSchwelle: 6, sprache: "alle",
    stufen: { schwer: { akzentOhneMischen: true } } }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Akzente");
await artWaehlen("akzente");

let z = await anzeige();
console.log("     1×:", JSON.stringify(z));
ok(z.akzent === "(4 mit Akzent + 4 ohne)" && /\(8 Vokabeln\)/.test(z.start), "Standard 1×: 4 mit Akzent + 4 ohne → 8 Vokabeln");
await setzeAnteil("schwer", "0.5");
z = await anzeige();
ok(z.akzent === "(4 mit Akzent + 2 ohne)" && /\(6 Vokabeln\)/.test(z.start), `½×: + 2 ohne → 6 (${z.akzent} ${z.start})`);
await setzeAnteil("schwer", "alle");
z = await anzeige();
ok(z.akzent === "(4 mit Akzent + 6 ohne)", `∞: alle ohne Akzent, die die Reihenfolge-Grenze (Score < 3) erlaubt: 6 (${z.akzent})`);
await setzeAnteil("schwer", "1");
ok(await page.evaluate(() => document.querySelector('[data-akzent-ohne-anteil="einfach"]').disabled), "Stufe Einfach: Regel aus → Auswahl gesperrt");

// Quiz: 8 Wörter, ohne Akzent nur o7–o12 (nie abgefragt), gleichmäßig verteilt
await clickText("button", "Quiz starten (");
await sleep(300);
const folge = [];
for (let i = 0; i < 8; i++) {
  const f = await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
  if (!f) break;
  folge.push(f);
  await clickText("button", "Lösung anzeigen");
  await clickText("button", "Weiter →");
}
console.log("     Folge:", folge.join(" "));
const ohneGefragt = folge.filter(f => /^o\d+$/.test(f));
ok(folge.length === 8 && ohneGefragt.length === 4, "8 Fragen: 4 mit, 4 ohne Akzent");
ok(ohneGefragt.every(f => +f.slice(1) >= 7), "ohne Akzent: bevorzugt noch nie abgefragte (o7–o12)");
let maxFolge = 0, lauf = 0;
folge.forEach(f => { lauf = /^o\d+$/.test(f) ? lauf + 1 : 0; maxFolge = Math.max(maxFolge, lauf); });
ok(maxFolge <= 1, `gleichmäßig verteilt: nie zwei ohne Akzent hintereinander (${maxFolge})`);

// Auswertung: bezieht sich nur auf die Wörter mit Akzent (100 % = alle Wörter mit Akzent)
// „Lösung anzeigen“ = nicht gewusst → Wiederholung; die hier überspringen
if (await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.includes("Wiederholung abbrechen")))) await clickText("button", "Wiederholung abbrechen");
await page.evaluate(() => document.querySelector("[data-zur-auswertung]")?.click()); await sleep(400);
const ausw = await page.evaluate(() => document.querySelector("[data-session-auswertung]")?.innerText.replace(/\s+/g, " ") || "");
console.log("     Auswertung:", ausw);
ok(/4 Wörter mit Akzent/i.test(ausw) && /Dazu geübt ohne Akzent 4 \(zählen nicht mit\)/.test(ausw), "Auswertung: 4 Wörter mit Akzent, 4 ohne nur geübt");
const segStart = await page.evaluate(() => [...document.querySelectorAll('[data-balken="Start"] [data-segment]')].map(x => x.dataset.segment + ":" + x.textContent.trim()).join(","));
ok(segStart === "nie:4", `Balken Start: nur die 4 Wörter mit Akzent (${segStart})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
