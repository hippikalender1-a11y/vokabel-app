import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1400 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fund = new Map();   // text → Set(Screens)

async function pruefe(screen) {
  const liste = await page.evaluate(() => {
    const raus = [];
    const alle = [...document.querySelectorAll("button, input, select, textarea, [role=button], div, span, label, svg, g")];
    for (const el of alle) {
      if (el.closest("[data-info]") || el.closest("[data-info-schalter]")) continue;
      const cs = getComputedStyle(el);
      const klickbar = ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) || cs.cursor === "pointer";
      if (!klickbar) continue;
      if (el.parentElement && getComputedStyle(el.parentElement).cursor === "pointer" && !["BUTTON","INPUT","SELECT","TEXTAREA"].includes(el.tagName)) continue; // nur äußerstes
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const text = (el.getAttribute("placeholder") || el.textContent || el.getAttribute("title") || el.tagName).replace(/\s+/g, " ").trim().slice(0, 60);
      raus.push(`${el.tagName.toLowerCase()}${el.type ? "[" + el.type + "]" : ""} „${text}“`);
    }
    return raus;
  });
  for (const x of liste) { if (!fund.has(x)) fund.set(x, new Set()); fund.get(x).add(screen); }
}
const klick = async (sel, text, exact = false) => {
  const ok = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    el?.click(); return !!el;
  }, sel, text, exact);
  await sleep(350); return ok;
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",E2:"Simple Past",D1:"Deutsch",i1:"Beispiel"}[t] || "", aktiv: ["E1","E2","D1","i1"].includes(t) }]));
  const mk = (id, name, spr) => ({ id, name, sprache: spr, spalten: sp, naechste_id: 4, vokabeln: [
    { id:1, E1:{wert:"go",falsch:["goes"]}, E2:{wert:"went",falsch:[]}, D1:{wert:"gehen",falsch:[]}, i1:{wert:"I go home.",falsch:[]}, fortschritt:{score:3,streak:3,aufgedecktStreak:0,letzteAbfrage:"2026-10-20T10:00:00.000Z"}, diktatFortschritt:{score:1} },
    { id:2, E1:{wert:"see",falsch:[]}, E2:{wert:"saw",falsch:[]}, D1:{wert:"sehen",falsch:[]}, i1:{wert:"I see.",falsch:[]}, fortschritt:{score:-1,streak:0,aufgedecktStreak:0,letzteAbfrage:"2026-10-21T10:00:00.000Z"} },
    { id:3, E1:{wert:"come",falsch:[]}, E2:{wert:"came",falsch:[]}, D1:{wert:"kommen",falsch:[]}, i1:{wert:"Come!",falsch:[]} } ] });
  const l1 = mk("l_en", "Verbs", "en"), l2 = mk("l_fr", "Verbes", "fr");
  [l1, l2].forEach(l => localStorage.setItem("vokabel_liste_" + l.id, JSON.stringify(l)));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_en", name:"Verbs", sprache:"en" }, { id:"l_fr", name:"Verbes", sprache:"fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"einfach", autoplay:true, vorlesen:["E1"], gelerntSchwelle:3, sprache:"alle" }));
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[{ id:"v_1", name:"25.10.2026, 10:00", timestamp:1, konfiguration:{ listenIds:["l_en"], vokabelAuswahl:[], bereichTyp:"alle" }, sessionFortschritt:null }],
    gespeichert:[{ id:"g_1", name:"Englisch 25.10.2026", timestamp:1, konfiguration:{ listenIds:["l_en"], vokabelAuswahl:[], bereichTyp:"alle" }, sessionFortschritt:null }, { id:"g_2", name:"Test 2", timestamp:2, konfiguration:{ listenIds:["l_en"], vokabelAuswahl:[], bereichTyp:"alle" }, sessionFortschritt:null }] }));
});
await page.reload(); await sleep(600);

// Kopf + Sprachmenü
await pruefe("Kopf");
await klick(".topbar button", "▾"); await pruefe("Sprachmenü"); await page.mouse.click(5, 700); await sleep(200);

// Listen
await klick(".tab", "Listen"); await pruefe("Listen-Übersicht");
await klick("button", "Exportieren", true); await klick(".karte-zeile", "Verbs"); await pruefe("Export-Auswahl");
await klick("button", "Abbrechen", true);
await klick(".karte-zeile", "Verbs"); await pruefe("Liste-Detail");
await page.evaluate(() => [...document.querySelectorAll(".btn-toggle")].forEach(b => b.click())); await sleep(300); await pruefe("Liste-Detail offen");
await klick("button", "Neu"); await pruefe("Import");
await klick("button", "Prompt generieren"); await pruefe("KI-Prompt");
await page.goto(URL); await sleep(500);
await klick(".tab", "Listen"); await klick("button", "Neu");
await page.evaluate(() => { const ta = document.querySelector("textarea"); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, "Englisch // Deutsch\ngo // gehen"); ta.dispatchEvent(new Event("input", { bubbles: true })); });
await klick("button", "Analysieren", true); await pruefe("Import-Zuordnung");

// Quiz-Tab mit allen Bereichen
await page.goto(URL); await sleep(500);
await klick(".tab", "Quiz");
await pruefe("Quiz-Tab");
await klick(".quiz-setup-check", "Verbs"); await pruefe("Quiz-Tab Liste");
for (const b of ["Bereich", "Frage – Antwort", "Zufällig", "Einfach", "10 V."]) { await klick("button", b, true); await pruefe("Quiz-Bereich " + b); }
await klick("button", "Speichern", true); await pruefe("Speichern-Modal"); await klick(".modal button", "Abbrechen"); await page.keyboard.press("Escape"); await page.mouse.click(5, 5); await sleep(200);

// Quiz läuft (Karte)
await page.goto(URL); await sleep(500);
await klick(".tab", "Quiz"); await klick(".quiz-setup-check", "Verbs");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^Quiz starten \(/.test(b.textContent.trim()))?.click()); await sleep(500);
await pruefe("Quiz Karte Frage");
await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(300); await pruefe("Quiz Karte aufgedeckt");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^Beenden$/.test(b.textContent.trim()))?.click()); await sleep(400);
await pruefe("Quiz abgebrochen/Auswertung");

// Statistik
await page.goto(URL); await sleep(500);
await klick(".tab", "Statistik"); await pruefe("Statistik");
await page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].forEach(b => { if (/Alle|Verbs/.test(b.textContent)) b.click(); })); await sleep(300); await pruefe("Statistik offen");

// Einstellungen
await klick(".tab", "Einstellungen"); await pruefe("Einstellungen");
await klick("button", "Konzept", true); await pruefe("Einstellungen Konzept");

await browser.close();
const sortiert = [...fund.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`OHNE ERKLÄRTEXT: ${sortiert.length}`);
for (const [t, s] of sortiert) console.log(`- ${t}   [${[...s].slice(0, 3).join(", ")}${s.size > 3 ? ", …" : ""}]`);
