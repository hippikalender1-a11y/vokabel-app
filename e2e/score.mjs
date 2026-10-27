import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100 });
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
const zeile = async (spaltenName, buttonText) => {
  const done = await page.evaluate((n, b) => {
    const z = [...document.querySelectorAll("div")].find(d => d.style.padding === "10px 16px" && d.textContent.includes(n) && d.querySelector(".checkbox"));
    if (!z) return "zeile";
    if (b === "__check") { z.firstElementChild.click(); return true; }
    const btn = [...z.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(b));
    btn?.click(); return !!btn;
  }, spaltenName, buttonText);
  if (done !== true) throw new Error(`Spaltenzeile: ${spaltenName} ${buttonText} (${done})`);
  await sleep(250);
};
const scores = () => page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem("vokabel_liste_l_en"));
  return Object.fromEntries(l.vokabeln.map(v => [v.D1.wert, v.fortschritt?.score ?? 0]));
});
const text = () => page.evaluate(() => document.body.innerText);
const aktuelleFrage = async () => { const t = await text(); return t.includes("gehen") ? "gehen" : t.includes("sehen") ? "sehen" : null; };

async function vorbereiten(modus) {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.clear();
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Infinitive",E2:"Simple Past",E3:"Past Participle",D1:"Deutsch"}[t] || "", aktiv: ["E1","E2","E3","D1"].includes(t) }]));
    const l = { id:"l_en", name:"Irregular Verbs", sprache:"en", spalten: sp, naechste_id:3, vokabeln:[
      { id:1, E1:{wert:"go",falsch:[]}, E2:{wert:"went",falsch:[]}, E3:{wert:"gone",falsch:[]}, D1:{wert:"gehen",falsch:[]} },
      { id:2, E1:{wert:"see",falsch:[]}, E2:{wert:"saw",falsch:[]}, E3:{wert:"seen",falsch:[]}, D1:{wert:"sehen",falsch:[]},
        fortschritt:{ score:-5, streak:0, aufgedecktStreak:0, letzteAbfrage:null } } ] };
    localStorage.setItem("vokabel_liste_l_en", JSON.stringify(l));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_en", name:l.name, sprache:"en" }]));
  });
  await page.reload(); await sleep(500);
  await clickText(".tab", "Listen");
  await clickText(".karte-zeile", "Irregular Verbs");
  await clickText("button", "Quiz starten", true);
  await page.click("[data-abfragemodus]"); await sleep(300);
  await zeile("Simple Past", "__check"); await zeile("Simple Past", "Antwort");
  await zeile("Past Participle", "__check"); await zeile("Past Participle", "Antwort");
  for (const n of ["Infinitive", "Simple Past", "Past Participle"]) await zeile(n, modus);
  // Abfrage-Ziel "Anzahl" (ein Durchgang) – dieser Test prüft die Punkte eines einzelnen Durchgangs
  if (!(await page.evaluate(() => [...document.querySelectorAll(".typ-btn")].some(b => b.textContent.trim() === "Anzahl"))))
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^(Pakete|\d+ V\.)$/.test(b.textContent.trim()))?.click());
  await sleep(300);
  await clickText(".typ-btn", "Anzahl", true);
  await clickText("button", "Quiz starten (2");
  await sleep(500);
}

// ── Szenario 1: Karte ──
await vorbereiten("Karte");
const plan1 = { gehen: [true, true, true], sehen: [true, false, true] };
const gefragt1 = { gehen: 0, sehen: 0 };
for (let schritt = 0; schritt < 6; schritt++) {
  const v = await aktuelleFrage();
  const gewusst = plan1[v][gefragt1[v]++];
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
  await sleep(300);
  await clickText(".karte-btn", gewusst ? "Gewusst" : "Nicht gewusst");
  await sleep(1300);
}
let sc = await scores();
ok(gefragt1.gehen === 3 && gefragt1.sehen === 3, `Karte: alle 3 Spalten je Vokabel abgefragt (${JSON.stringify(gefragt1)})`);
ok(sc.gehen === 1, `Karte: alle 3 gewusst → 0 auf +1 (ist ${sc.gehen})`);
ok(sc.sehen === -6, `Karte: 1 von 3 falsch → −5 auf −6 (ist ${sc.sehen})`);
let t = await text();
console.log("     Auswertung:", t.split("\n").filter(z => /richtig|%/.test(z)).slice(0, 3).join(" | "));
ok(/1\s*(von|\/)\s*2/.test(t), "Karte: Auswertung zählt nur vollständig gewusste Vokabel (1 von 2)");

// ── Szenario 2: Tippen, nach Fehler werden restliche Spalten trotzdem abgefragt ──
await vorbereiten("Tastatur");
const antworten = { gehen: ["go", "went", "gone"], sehen: ["see", "saw", "seen"] };
const falschBei = { gehen: 1, sehen: -1 };   // gehen: Spalte 2 dreimal falsch
const gefragt2 = { gehen: 0, sehen: 0 };
for (let schritt = 0; schritt < 6; schritt++) {
  const v = await aktuelleFrage();
  const i = gefragt2[v]++;
  if (i === falschBei[v]) {
    for (let k = 0; k < 3; k++) {
      await page.type("input.inp", "xyz"); await clickText("button", "Prüfen", true); await sleep(200);
    }
  } else {
    await page.type("input.inp", antworten[v][i]); await clickText("button", "Prüfen", true);
  }
  await sleep(300);
  await clickText("button", "Weiter");
  await sleep(400);
}
sc = await scores();
ok(gefragt2.gehen === 3 && gefragt2.sehen === 3, `Tippen: nach Fehler in Spalte 2 wurde Spalte 3 trotzdem abgefragt (${JSON.stringify(gefragt2)})`);
ok(sc.gehen === -1, `Tippen: eine Spalte falsch → 0 auf −1 (ist ${sc.gehen})`);
ok(sc.sehen === -4, `Tippen: alle richtig → −5 auf −4 (ist ${sc.sehen})`);
t = await text();
ok(/1\s*(von|\/)\s*2/.test(t), "Tippen: Auswertung 1 von 2");

// ── Szenario 3: Multiple Choice – Fehlklick, weitersuchen, zählt als nicht gewusst ──
await vorbereiten("MC");
const mcAntw = { gehen: ["go", "went", "gone"], sehen: ["see", "saw", "seen"] };
const gefragt3 = { gehen: 0, sehen: 0 };
let hinweisGesehen = false;
const klickMC = async (wert) => {
  const done = await page.evaluate(w => {
    const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === w && x.parentElement.style.flexWrap === "wrap");
    b?.click(); return !!b;
  }, wert);
  if (!done) throw new Error("MC-Knopf fehlt: " + wert);
  await sleep(650);
};
for (let schritt = 0; schritt < 6; schritt++) {
  const v = await aktuelleFrage();
  const i = gefragt3[v]++;
  const anderes = v === "gehen" ? mcAntw.sehen[i] : mcAntw.gehen[i];
  if (v === "gehen" && i === 1) await klickMC(anderes);   // Fehlklick
  await klickMC(mcAntw[v][i]);
  if (v === "gehen" && i === 1) hinweisGesehen = (await text()).includes("Nicht auf Anhieb");
  await clickText("button", "Weiter");
  await sleep(400);
}
sc = await scores();
ok(gefragt3.gehen === 3 && gefragt3.sehen === 3, `MC: alle Spalten abgefragt (${JSON.stringify(gefragt3)})`);
ok(hinweisGesehen, "MC: Hinweis „Nicht auf Anhieb gefunden“ nach Fehlklick");
ok(sc.gehen === -1, `MC: Fehlklick in Spalte 2 → 0 auf −1 (ist ${sc.gehen})`);
ok(sc.sehen === -4, `MC: alles auf Anhieb → −5 auf −4 (ist ${sc.sehen})`);
t = await text();
ok(/1\s*(von|\/)\s*2/.test(t), "MC: Auswertung 1 von 2");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
