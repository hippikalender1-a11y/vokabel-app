import puppeteer from "puppeteer-core";

// 180: heute schon abgefragte Vokabeln kommen nicht noch einmal (Knopf „Heute“ schließt sie vorübergehend ein)
// 181: Session-Kachel füllt sich mit dem Anteil der heute abgefragten (ganz = dunkel); gelernt = Haken; gelernte ausblenden
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const klick = async sel => { await page.evaluate(s => document.querySelector(s)?.click(), sel); await sleep(300); };
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(300);
};
const aktion = async label => { await page.evaluate(l => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(400); };
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300); };
const laden = async id => { await auswahlAuf(); await klick(`[data-slot-id="${id}"]`); await klick("[data-slot-laden]"); await sleep(300); };
const anzahl = () => page.evaluate(() => document.querySelector("[data-start-knopf]")?.dataset.startAnzahl);
const kachel = id => page.evaluate(i => { const k = document.querySelector(`[data-slot-id="${i}"]`); return k ? { dunkel: k.classList.contains("aktiv-kachel"), heute: k.dataset.heute, bild: k.style.backgroundImage, haken: !!k.querySelector(".kachel-voll") } : null; }, id);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], modus: "schwer" }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const jetzt = new Date().toISOString(), gestern = new Date(Date.now() - 86400000 * 1.5).toISOString(), alt = new Date(Date.now() - 86400000 * 10).toISOString();
  const w = (id, e, d, f) => ({ id, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, ...(f ? { fortschritt: f } : {}) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 5, vokabeln: [
    w(1, "one", "eins", { score: 1, letzteAbfrage: jetzt }),
    w(2, "two", "zwei", { score: 1, letzteAbfrage: gestern }),
    w(3, "three", "drei"),
    w(4, "four", "vier", { score: 3, letzteAbfrage: alt, stufeSeit: alt })] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }]));
  const k = ids => ({ listenIds:["l_a"], vokabelAuswahl: ids.map(i => `l_a__${i}`), bereichTyp:"bereich", quizBereichTyp:"bereich", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1",
    quizAntwortTypenGeordnet:["E1"], quizSpalteModus:{ E1:"karte" }, quizInfoTypenSession:[], quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_a", name:"Halb heute", timestamp:1, platz:{z:0,s:0}, sessionFortschritt:null, konfiguration:k([1, 2]) },
    { id:"g_b", name:"Gelernt", timestamp:2, platz:{z:1,s:0}, sessionFortschritt:null, konfiguration:k([4]) },
    { id:"g_c", name:"Ganz heute", timestamp:3, platz:{z:2,s:0}, sessionFortschritt:null, konfiguration:k([1]) }] }));
});
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await auswahlAuf();

// ── 181: Kacheln ──
let a = await kachel("g_a"), b = await kachel("g_b"), c = await kachel("g_c");
ok(!c.dunkel && c.heute === "100" && /100%/.test(c.bild), `183: alle heute abgefragt: ganz abgeschwächt gefüllt, nicht dunkel (${JSON.stringify(c)})`);
ok(!a.dunkel && a.heute === "50" && /linear-gradient/.test(a.bild) && /50%/.test(a.bild), `zur Hälfte heute: abgeschwächt bis 50 % gefüllt (${JSON.stringify(a)})`);
ok(!b.dunkel && b.haken && b.heute === "0", `komplett gelernt, heute nicht geübt: hell mit Haken (${JSON.stringify(b)})`);
await kontext("[data-alle-sessions]");
ok(await page.$('[data-info-aktion="🙈 Gelernte ausblenden"]'), "„Alle Sessions“ lang drücken: „🙈 Gelernte ausblenden“");
await aktion("🙈 Gelernte ausblenden");
ok(!(await kachel("g_b")) && await kachel("g_a") && await kachel("g_c"), "gelernte Kachel ausgeblendet, die übrigen bleiben");
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).gelernteAusblenden) === true, "Einstellung gespeichert");
await kontext("[data-alle-sessions]");
await aktion("👁 Gelernte einblenden");
ok(await kachel("g_b"), "„👁 Gelernte einblenden“: wieder da");

// ── 182: gewählte Kachel zeigt den Tagesstand in Grün ──
await klick('[data-slot-id="g_a"]'); await sleep(400);
const gew = await page.evaluate(() => { const k = document.querySelector('[data-slot-id="g_a"]'); const s = getComputedStyle(k);
  return { gewaehlt: k.classList.contains("kachel-gewaehlt"), bild: s.backgroundImage, farbe: s.getPropertyValue("--heute-farbe") }; });
ok(gew.gewaehlt && /linear-gradient/.test(gew.bild) && /bestaetigen|color-mix/.test(gew.farbe) && !/haupt\)/.test(gew.farbe), `182: gewählte Kachel: Füllung sichtbar, grün (${JSON.stringify(gew)})`);
// ── 184–186: Info der gewählten Session ──
await page.evaluate(() => { if (document.querySelector("[data-slot-info-zu]")) document.querySelector("[data-slot-info]").click(); }); await sleep(250);
ok(await page.evaluate(() => document.querySelector("[data-vorschau-zuletzt]")?.innerText.trim()) === "Zuletzt abgefragt: Heute (50 %)", `184: „Zuletzt abgefragt: Heute (50 %)“ (${await page.evaluate(() => document.querySelector("[data-vorschau-zuletzt]")?.innerText.trim())})`);
const punkte = await page.evaluate(() => [...document.querySelectorAll("[data-vorschau-gruppen] [data-gruppe-text]")].map(s => s.dataset.gruppeText + ":" + (getComputedStyle(s.querySelector(".gruppen-punkt")).backgroundColor === getComputedStyle(document.querySelector(`[data-vorschau-balken] [data-gruppe="${s.dataset.gruppeText}"]`)).backgroundColor)));
ok(punkte.length === 1 && punkte.every(p => p.endsWith(":true")), `185: Punkt vor jedem Wert in der Farbe des Balken-Abschnitts (${punkte})`);
const zeile = await page.evaluate(() => ({ klapp: document.querySelector("[data-vorschau-vokabeln]")?.innerText.trim(), alt: /Vokabeln ansehen/.test(document.querySelector("[data-slot-info]").innerText) }));
ok(/Unit 1 · Nr\. 1–2/.test(zeile.klapp) && !/[()]/.test(zeile.klapp) && !zeile.alt, `186: Inhaltsangabe ohne Klammern statt „Vokabeln ansehen“ (${JSON.stringify(zeile)})`);
await page.evaluate(() => document.querySelector("[data-slot-info]").click()); await sleep(200);

// ── 180: heute abgefragte nicht noch einmal ──
await laden("g_a");
ok(await anzahl() === "1", `„Halb heute“: nur die gestern abgefragte zählt (${await anzahl()})`);
ok(await page.evaluate(() => document.querySelector("[data-heute]:not([data-slot-id])")?.textContent.trim()) === "1 heute", "Knopf „1 heute“ neben „Gelernte“");
await klick("[data-heute]:not([data-slot-id])");
ok(await anzahl() === "2" && await page.evaluate(() => document.querySelector("[data-heute]:not([data-slot-id])")?.dataset.heute) === "an", `„+ 1 heute“: beide zählen (${await anzahl()})`);
await laden("g_c");
ok(await anzahl() === "0", `„Ganz heute“: alles heute schon abgefragt → 0 (${await anzahl()})`);
const leer = await page.evaluate(() => { const k = document.querySelector("[data-start-knopf]"), f = document.querySelector(".start-fortschritt");
  return { leer: k.classList.contains("leer"), gleich: !f || getComputedStyle(k).backgroundColor === getComputedStyle(f).backgroundColor, frei: !k.disabled,
    titel: document.querySelector("[data-start-titel]")?.textContent.trim(), heuteKnopf: getComputedStyle(document.querySelector(".quiz-zeile-knopf[data-heute]")).backgroundColor,
    gelKnopf: getComputedStyle(document.querySelector(".quiz-zeile-knopf[data-gelernte]") || document.body).backgroundColor }; });
ok(leer.leer && leer.gleich && leer.frei && leer.titel === "Quiz mit 0 Vokabeln", `188: Titel „Quiz mit 0 Vokabeln“, Start-Knopf in der Farbe des Fortschritt-Feldes (${JSON.stringify(leer)})`);
ok(!(await page.$("[data-start-hinweis]")), "188: Hinweis erst beim Antippen");
await klick("[data-start-knopf]");
ok(await page.evaluate(() => document.querySelector("[data-start-hinweis]")?.textContent.trim()) === "1 heute schon abgefragt – oben bei „Heute“ dazunehmen" && await page.evaluate(() => !document.querySelector(".quiz-frage-text")),
  `188: Antippen zeigt unter den Knöpfen „1 heute schon abgefragt – oben bei „Heute“ dazunehmen“, kein Quiz (${await page.evaluate(() => document.querySelector("[data-start-hinweis]")?.textContent.trim())})`);
ok(await page.evaluate(() => { const h = document.querySelector("[data-start-hinweis]"), k = document.querySelector("[data-start-knopf]"); return h.getBoundingClientRect().top > k.getBoundingClientRect().bottom; }), "188: Hinweis unterhalb des Knopfes");
const aus = await page.evaluate(() => getComputedStyle(document.querySelector(".quiz-zeile-knopf[data-heute]")).backgroundColor);
await klick(".quiz-zeile-knopf[data-heute]");
const an = await page.evaluate(() => getComputedStyle(document.querySelector(".quiz-zeile-knopf[data-heute]")).backgroundColor);
ok(aus !== an && !(await page.$("[data-start-hinweis]")) && !(await page.$("[data-start-knopf].leer")), `187: „Heute“ aus hell, an gefüllt (${aus} → ${an}); Hinweis weg, Knopf wieder grün`);
await laden("g_a");
ok(await anzahl() === "1" && await page.evaluate(() => document.querySelector("[data-heute]:not([data-slot-id])")?.dataset.heute) === "aus", "andere Session geladen: „Heute“ wieder aus");
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);
ok(await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim()) === "zwei", "Abfrage: nur „zwei“ (nicht das heute schon abgefragte „eins“)");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
