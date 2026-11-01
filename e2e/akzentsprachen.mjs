import puppeteer from "puppeteer-core";

// Akzente je Sprache (Einstellungen): Standard nur Französisch. Aus → keine Abfrageart „A“,
// fehlende Akzente beim Tippen gelten als richtig; an → „A“ da, Akzente müssen stimmen
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
// Einstellungen: Bereich aufklappen (immer nur einer offen)
const oeffneEinst = async key => { await page.evaluate(k => { const b = document.querySelector(`[data-einst-kopf="${k}"]`); if (b && b.dataset.offen !== "ja") b.click(); }, key); await new Promise(r => setTimeout(r, 250)); };
const tab = async name => { await page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n)).click(), name); await sleep(400); };
const arten = () => page.evaluate(() => [...document.querySelectorAll("[data-start-arten] [data-quiz-art]")].map(b => b.dataset.quizArt).join(","));
const ladeSlot = async name => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
  await page.evaluate(n => [...document.querySelectorAll(".slot-chip")].find(c => c.textContent.includes(n)).click(), name); await sleep(700);
};
// Tastatur-Runde: „esta“ statt „está“ tippen → richtig?
const tippeOhneAkzent = async () => {
  await page.click("[data-start-knopf]"); await sleep(400);
  const frage = await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
  const ohne = { "ist": "esta", "morgen": "manana", "Haus": "casa" }[frage];
  await page.type(".quiz-aktionen input.inp, input.inp", ohne); await page.keyboard.press("Enter"); await sleep(500);
  const r = await page.evaluate(() => ({ richtig: (document.querySelector(".quiz-antwort-box")?.className || "").includes("richtig") }));
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Beenden")?.click()); await sleep(400);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(400);
  return { frage, ...r };
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus: "schwer", gelerntSchwelle: 3, sprache: "alle" }));
  const sp = name => Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:name,D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name, sprache, w) => ({ id, name, sprache, spalten: sp(name), naechste_id: w.length + 1,
    vokabeln: w.map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } })) });
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(liste("l_fr", "Französisch", "fr", [["élève","Schüler"],["café","Kaffee"]])));
  localStorage.setItem("vokabel_liste_l_es", JSON.stringify(liste("l_es", "Spanisch", "es", [["está","ist"],["mañana","morgen"]])));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Französisch", sprache:"fr" }, { id:"l_es", name:"Spanisch", sprache:"es" }]));
  const k = (id, art) => ({ listenIds:[id], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"tippen"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_fr", name:"Franz", timestamp:1, konfiguration:k("l_fr"), sessionFortschritt:null, platz:{z:0,s:0} },
    { id:"g_es", name:"Span", timestamp:2, konfiguration:k("l_es"), sessionFortschritt:null, platz:{z:0,s:1} } ] }));
});
await page.reload(); await sleep(500);

// Einstellungen: Französisch an, Spanisch aus
await tab("Einstellungen"); await oeffneEinst("akzente");
const stand = () => page.evaluate(() => [...document.querySelectorAll("[data-akzent-sprache].aktiv")].map(b => b.dataset.akzentSprache).join(","));
console.log("     Akzente:", await stand());
ok(/fr:an/.test(await stand()) && /es:aus/.test(await stand()), "Einstellungen → Akzente: Französisch an, Spanisch aus (Standard)");

// Quiz: Spanisch ohne „A“, Französisch mit
await tab("Quiz");
await ladeSlot("Span");
ok(await arten() === "uebersetzung,diktat", `Spanisch (Akzente aus): nur Ü und D (${await arten()})`);
let r = await tippeOhneAkzent();
console.log("     Spanisch aus:", JSON.stringify(r));
ok(r.richtig, `Akzente aus: „${r.frage}“ ohne Akzent getippt gilt als richtig`);
await ladeSlot("Franz");
ok(await arten() === "uebersetzung,diktat,akzente", `Französisch (Akzente an): Ü, D und A (${await arten()})`);

// Spanisch einschalten → „A“ da, Akzente müssen stimmen (Stufe Schwer)
await tab("Einstellungen"); await oeffneEinst("akzente");
await page.click('[data-akzent-sprache="es:an"]'); await sleep(200);
ok(/es:an/.test(await stand()), "Spanisch eingeschaltet");
await tab("Quiz");
await ladeSlot("Span");
ok(await arten() === "uebersetzung,diktat,akzente", `Spanisch (Akzente an): Ü, D und A (${await arten()})`);
r = await tippeOhneAkzent();
console.log("     Spanisch an:", JSON.stringify(r));
ok(!r.richtig, `Akzente an (Schwer): „${r.frage}“ ohne Akzent gilt nicht als richtig`);

// in A wechseln, dann Spanisch wieder ausschalten → zurück zu Übersetzung
await page.click('[data-start-arten] [data-quiz-art="akzente"]'); await sleep(300);
await tab("Einstellungen"); await oeffneEinst("akzente");
await page.click('[data-akzent-sprache="es:aus"]'); await sleep(200);
await tab("Quiz");
ok(await page.evaluate(() => document.querySelector("[data-start-arten] [data-quiz-art].aktiv")?.dataset.quizArt) === "uebersetzung", "Akzente wieder aus, während „A“ gewählt war: zurück zu Übersetzung");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
