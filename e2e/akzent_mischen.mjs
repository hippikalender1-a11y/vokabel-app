import puppeteer from "puppeteer-core";

// Akzent-Spalte + weitere Antwortspalte: Wörter ohne Akzent lassen nur die Akzent-Spalte aus
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
const kopf = () => page.evaluate(() => document.querySelector("[data-abfragemodus]")?.textContent.trim());
const anzahl = async () => (await text()).match(/Quiz starten \((\d+) Vokabeln\)/)?.[1];

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  // frühere Standard-Haken der Stufen (Test prüft sie ausdrücklich)
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", autoplay:false, vorlesen:["E1"], gelerntSchwelle:0, sprache:"alle",
    stufen: { schwer: { akzenteTolerant:false, aufdeckenAbzug:true, akzentOhneMischen:true, akzentHervorheben:false, akzentZaehler:false, akzentAutoUebernahme:false } } }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",E2:"Plural",D1:"Deutsch"}[t] || "", aktiv: ["E1","E2","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Mischen", sprache:"fr", spalten: sp, naechste_id:4, vokabeln: [
    { id:1, E1:{wert:"élève",falsch:[]}, E2:{wert:"élèves",falsch:[]}, D1:{wert:"Schüler",falsch:[]} },
    { id:2, E1:{wert:"chat",falsch:[]},  E2:{wert:"chats",falsch:[]},  D1:{wert:"Katze",falsch:[]} },
    { id:3, E1:{wert:"cœur",falsch:[]},  E2:{wert:"cœurs",falsch:[]},  D1:{wert:"Herz",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Mischen");
console.log("     Kopfzeile Standard:", await kopf());
ok(await kopf() === "Karte", "Zeile „Abfrage-Modus“ zeigt die Art der Abfrage: Karte");
if (!(await text()).includes("Spalten auswählen")) await page.click("[data-abfragemodus]");
await sleep(300);
// Spalte "Plural" dazunehmen und als 2. Antwort setzen
const rolle = async (name, knopf) => page.evaluate((name, knopf) => {
  const zeile = [...document.querySelectorAll("div")].find(d => d.style.padding === "10px 16px" && d.querySelector(".checkbox") && d.querySelector("div[style*=\"font-weight: 600\"]")?.textContent === name);
  const b = [...zeile.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(knopf));
  if (b) { b.click(); return true; }
  zeile.firstElementChild.click(); return false;
}, name, knopf);
if (!(await rolle("Plural", "Antwort"))) { await sleep(250); await rolle("Plural", "Antwort"); }
await sleep(250);
// Französisch → Akzente (erste Akzente-Schaltfläche gehört zu E1)
await page.evaluate(() => {
  const zeile = [...document.querySelectorAll("div")].find(d => d.style.padding === "10px 16px" && d.querySelector(".checkbox") && d.querySelector("div[style*=\"font-weight: 600\"]")?.textContent === "Französisch");
  [...zeile.querySelectorAll(".spalten-modus-btn")].find(b => b.textContent.trim() === "Akzente").click();
});
await sleep(250);
console.log("     Kopfzeile:", await kopf(), "| Anzahl:", await anzahl());
ok(await kopf() === "Akzente + Karte", "Zeile „Abfrage-Modus“: „Akzente + Karte“");
ok(await anzahl() === "3", "Stufe „Schwer“: 3 Vokabeln");
// Regel "auch Wörter ohne Akzent" für Schwer ausschalten
await page.evaluate(() => [...document.querySelectorAll("button.toggle-opt")].find(b => /^(Einfach|Schwer)$/.test(b.textContent.trim()) && b.closest("div[style*='sticky']"))?.click());
await sleep(300);
await page.evaluate(() => {
  const zeile = [...document.querySelectorAll("div")].find(d => d.textContent.trim() === "Akzent-Modus: auch Wörter ohne Akzent abfragen");
  zeile.parentElement.nextElementSibling.nextElementSibling.click();
});
await sleep(250);
ok(await anzahl() === "3", "Ohne Wörter ohne Akzent: trotzdem 3 – chat wird über „Plural“ abgefragt (größte Anzahl je Spalte)");
ok(await page.evaluate(() => document.querySelector("[data-sessionanzahl]")?.textContent.trim()) === "(3 V.)", "Session-Zeile: 3 V.");

await clickText("button", "Quiz starten (");
await sleep(400);
const ablauf = [];
for (let k = 0; k < 12; k++) {
  const t = await text();
  if (/Durchlauf abgeschlossen|Auswertung|Paket fertig/.test(t)) break;
  if (t.includes("Weiter zur Wiederholung")) { await clickText("button", "Weiter zur Wiederholung"); continue; }
  const frage = ["Schüler", "Katze", "Herz"].find(w => t.includes(w));
  const istAkzent = await page.evaluate(() => document.querySelectorAll(".akzent-kachel").length > 0);
  ablauf.push(`${frage}:${istAkzent ? "Akzente" : "Karte"}`);
  if (istAkzent) {
    await clickText("button", "Lösung anzeigen");
    await clickText("button", "Weiter →");
  } else {
    await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
    await sleep(250);
    await clickText(".karte-btn", "Gewusst");
    await sleep(1300);
  }
}
console.log("     Ablauf:", ablauf.join(" → "));
const erste = ablauf.slice(0, 5);
ok(erste.includes("Katze:Karte") && !erste.includes("Katze:Akzente"), "chat: Akzent-Spalte ausgelassen, nur „Plural“ als Karte");
ok(erste.includes("Schüler:Akzente") && erste.includes("Schüler:Karte") && erste.includes("Herz:Akzente") && erste.includes("Herz:Karte"),
  "Wörter mit Akzent: beide Spalten");
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
