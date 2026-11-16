import puppeteer from "puppeteer-core";
import { zuListen, auswahlEnde } from "./hilfen.mjs";

// 235: Menüs gruppiert – „Name ›“ ersetzt das Menü durch die Unterpunkte, oben „‹ zurück“; Gruppen mit einem Punkt direkt
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const mitte = sel => page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const halte = async (sel, ms) => { const p = await mitte(sel); await sleep(150); await finger("touchStart", p.x, p.y); await sleep(ms); await finger("touchEnd"); await sleep(450); };
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(350);
};
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const aktion = async label => { await page.evaluate(l => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(400); };
const ordnerAnlegen = async name => {
  await page.evaluate(n => { const f = document.querySelector("[data-in-gruppe-dialog] [data-ordner-name-feld]");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, n); f.dispatchEvent(new Event("input", { bubbles: true })); }, name);
  await sleep(150);
  await page.evaluate(() => document.querySelector("[data-ordner-neu]")?.click()); await sleep(400);
};
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const kopf = () => page.evaluate(() => ({ zustand: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, name: document.querySelector("[data-slot-kopf-name]")?.textContent.trim(),
  laden: document.querySelector("[data-slot-laden]")?.dataset.slotLaden || null, multi: [...document.querySelectorAll("[data-multi-nr]")].sort((a, b) => a.dataset.multiNr - b.dataset.multiNr).map(b => b.dataset.slotId).join(",") }));
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400); };

await page.goto(URL);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 11,
    vokabeln: Array.from({length:10},(_, i) => ({ id: i+1, E1: { wert: id+"w"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] } })) });
  ["l_a","l_b","l_c"].forEach((id, i) => localStorage.setItem("vokabel_liste_" + id, JSON.stringify(liste(id, "Unit " + (i + 1)))));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} },
    { id:"l_c", name:"Unit 3", sprache:"en", ordner:"lo1", platz:{z:0,s:0} }]));
  localStorage.setItem("vokabel_listen_ordner", JSON.stringify([{ id:"lo1", name:"Kiste", platz:{z:2,s:0} }]));
  const k = (von, bis) => ({ listenIds:["l_a"], vokabelAuswahl: Array.from({length: bis - von + 1}, (_, i) => `l_a__${von + i}`), bereichTyp:"bereich", quizBereichTyp:"bereich",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[{ id:"o1", name:"Mappe", platz:{z:3,s:0} }], gespeichert: [1, 2, 3, 4].map(i =>
    ({ id:"s"+i, name:"Teil "+i, timestamp:i, konfiguration:k(i * 2 - 1, i * 2), sessionFortschritt:null, ...(i === 4 ? { ordner:"o1", platz:{z:0,s:0} } : { platz:{z:i - 1,s:0} }) })) }));
});
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await auswahlAuf();
await page.evaluate(() => { window._vib = []; navigator.vibrate = m => { window._vib.push(JSON.stringify(m)); return true; }; });
const kopfText = () => page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.innerText.replace(/\s+/g, " ").trim());
const tafelZu = async () => { await auswahlEnde(page); };
const gruppeOffen = () => page.evaluate(() => document.querySelector("[data-info-menue]")?.dataset.infoGruppeOffen || null);

// ── ein Quiz: Fällige und Listen/Vokabeln ändern direkt, Ablage als Gruppe ──
await halte('[data-slot-id="s1"]', 450);
let m = await menue();
ok(m.join("|") === "🔁 Keine fälligen Vokabeln|📝 Listen/Vokabeln ändern|🗂 Ablage ›|↔ Von–Bis", `Quiz: Hauptebene (${m.join(" | ")})`);
await aktion("🗂 Ablage ›");
m = await menue();
ok(await gruppeOffen() === "🗂 Ablage ›" && m.join("|") === "‹ zurück|✎ Umbenennen|⧉ Duplizieren|⇄ Verschieben|📁 In Ordner…|🗑 Löschen|☑ Alle auswählen", `Ablage ersetzt das Menü, oben „‹ zurück“ (${m.join(" | ")})`);
ok((await kopf()).multi === "s1", "Gruppe öffnen lässt die Auswahl stehen");
await aktion("‹ zurück");
ok(!(await gruppeOffen()) && (await menue())[2] === "🗂 Ablage ›", "‹ zurück: wieder die Hauptebene");
await aktion("🗂 Ablage ›"); await aktion("✎ Umbenennen");
ok(await page.$(".modal") && !(await page.$("[data-info-menue]")), "Punkt aus der Gruppe führt aus (Umbenennen-Fenster), Tafel zu");
await page.keyboard.press("Escape"); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => /Abbrechen/.test(b.textContent))?.click()); await sleep(300);

// ── andere Kachel: Gruppe ist wieder zu ──
await auswahlAuf();
await halte('[data-slot-id="s2"]', 450);
await aktion("🗂 Ablage ›");
await halte('[data-slot-id="s3"]', 60);   // antippen: Auswahl neu mit „Teil 3“
ok(!(await gruppeOffen()) && (await menue()).includes("🗂 Ablage ›"), `andere Kachel: Hauptebene (${(await menue()).join(" | ")})`);

// ── mehrere Quiz: Multiquiz, Fällige direkt, Ablage-Gruppe ──
await halte('[data-slot-id="s1"]', 450);
m = await menue();
ok(m.join("|") === "🧩 Multiquiz starten (2)|🔁 Keine fälligen Vokabeln|🗂 Ablage ›|↔ Von–Bis", `mehrere Quiz: Hauptebene (${m.join(" | ")})`);
await aktion("🗂 Ablage ›");
ok((await menue()).join("|") === "‹ zurück|⇄ Verschieben|📁 In Ordner… (2)|🗑 Löschen (2)|☑ Alle auswählen", `mehrere: Ablage (${(await menue()).join(" | ")})`);
await aktion("‹ zurück"); await tafelZu();

// ── Quiz-Ordner: Öffnen direkt, Ablage-Gruppe ──
await halte('[data-slot-id="o1"]', 450);
m = await menue();
ok(m.join("|") === "📂 Öffnen|🗂 Ablage ›", `Ordner: Hauptebene (${m.join(" | ")})`);
await aktion("🗂 Ablage ›");
ok((await menue()).join("|") === "‹ zurück|✎ Umbenennen|⇄ Verschieben|📁 In Ordner…|📁 Neuer Ordner darin|📤 Ordner auflösen|☑ Alle auswählen", `Ordner: Ablage (${(await menue()).join(" | ")})`);
await aktion("‹ zurück"); await tafelZu();

// ── eine Liste: Öffnen, Lernen / Ablage / Inhalt ──
await zuListen(page);
await halte('[data-liste-id="l_a"]', 450);
m = await menue();
ok(m.join("|") === "📂 Liste öffnen|📊 Lernen ›|🗂 Ablage ›|📚 Inhalt ›|↔ Von–Bis", `Liste: Hauptebene (${m.join(" | ")})`);
await aktion("📊 Lernen ›");
ok((await menue()).join("|") === "‹ zurück|🔁 Keine fälligen Vokabeln|↺ Lernstand zurücksetzen", `Liste: Lernen (${(await menue()).join(" | ")})`);
await aktion("‹ zurück"); await aktion("🗂 Ablage ›");
ok((await menue()).join("|") === "‹ zurück|✎ Umbenennen|⧉ Duplizieren|⇄ Verschieben|📁 In Ordner…|🗑 Löschen|☑ Alle auswählen", `Liste: Ablage (${(await menue()).join(" | ")})`);
await aktion("‹ zurück"); await aktion("📚 Inhalt ›");
ok((await menue()).join("|") === "‹ zurück|＋ Vokabeln importieren|📤 Exportieren|✨ Beispielsätze ergänzen|≈ Synonyme ergänzen|( ) → Info|▦ In mehrere Quiz aufteilen", `Liste: Inhalt (${(await menue()).join(" | ")})`);
await aktion("‹ zurück");

// ── mehrere Listen: Export, Fällige direkt, Ablage-Gruppe ──
await halte('[data-liste-id="l_b"]', 450);
m = await menue();
ok(m.join("|") === "📤 Exportieren (2)|🔁 Keine fälligen Vokabeln|🗂 Ablage ›|↔ Von–Bis", `mehrere Listen: Hauptebene (${m.join(" | ")})`);
await aktion("🗂 Ablage ›");
ok((await menue()).join("|") === "‹ zurück|⇄ Verschieben|📁 In Ordner… (2)|🗑 Löschen (2)|☑ Alle auswählen", `mehrere Listen: Ablage (${(await menue()).join(" | ")})`);
await aktion("‹ zurück"); await tafelZu();

// ── Listen-Ordner ──
await halte('[data-lordner-id="lo1"]', 450);
m = await menue();
ok(m.join("|") === "📂 Öffnen|🗂 Ablage ›", `Listen-Ordner: Hauptebene (${m.join(" | ")})`);
await tafelZu();

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
