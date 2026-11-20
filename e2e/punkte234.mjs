import puppeteer from "puppeteer-core";
import { zuListen, menueShim } from "./hilfen.mjs";

// 234: neue Kachel-Bedienung – kurz halten wählt aus (dazu/heraus, weiterfahren sammelt ein), lang halten verschiebt;
// antippen in der Auswahl beginnt sie neu; Ordner auswählbar (zählen mit Inhalt), Ordner öffnen hebt die Auswahl auf; 231: Randspalte
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
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
const menue = () => page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion));
const aktion = async label => { await page.evaluate(l => [...__aktionen()].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(400); };
const ordnerAnlegen = async name => {
  await page.evaluate(n => { const f = document.querySelector("[data-in-gruppe-dialog] [data-ordner-name-feld]");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, n); f.dispatchEvent(new Event("input", { bubbles: true })); }, name);
  await sleep(150);
  await page.evaluate(() => document.querySelector("[data-ordner-neu]")?.click()); await sleep(400);
};
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const kopf = () => page.evaluate(() => ({ zustand: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, name: document.querySelector("[data-slot-kopf-name]")?.textContent.trim(),
  laden: document.querySelector("[data-slot-laden]")?.dataset.slotLaden || null, multi: [...document.querySelectorAll("[data-multi-nr]")].sort((a, b) => a.dataset.multiNr - b.dataset.multiNr).map(b => b.dataset.slotId).join(",") }));
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400); };

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
await page.reload(); await sleep(800); await page.evaluate(() => { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); }); await sleep(300);   // 289: Start mit Listen-Auswahl → Quiz
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await auswahlAuf();
await page.evaluate(() => { window._vib = []; navigator.vibrate = m => { window._vib.push(JSON.stringify(m)); return true; }; });
const kopfText = () => page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.innerText.replace(/\s+/g, " ").trim());
const aktionen = () => page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion).join("|"));

// ── Quiz: kurz halten beginnt die Auswahl ──
await halte('[data-slot-id="s1"]', 450);
let k = await kopf();
ok(k.multi === "s1" && /Teil 1 laden/.test(await kopfText()), `kurz halten: Auswahl mit „Teil 1“, Kopf „Teil 1 laden“ (${k.multi} | ${await kopfText()})`);
ok(/Umbenennen/.test(await aktionen()), "Menü der Kachel nach dem kurzen Halten");
ok(await page.evaluate(() => window._vib.length) === 0, "kurz halten: keine Vibration");
await halte('[data-slot-id="s2"]', 450);
k = await kopf();
ok(k.multi === "s1,s2" && /2 ausgewählt/.test(await kopfText()), `weiteres kurz halten nimmt dazu (${k.multi} | ${await kopfText()})`);
await halte('[data-slot-id="s2"]', 450);
ok((await kopf()).multi === "s1", `kurz halten auf eine gewählte nimmt sie heraus (${(await kopf()).multi})`);
// antippen in der Auswahl: beginnt neu mit dieser Kachel
await halte('[data-slot-id="s3"]', 60);
k = await kopf();
ok(k.multi === "s3" && k.zustand === "offen", `antippen in der Auswahl: neu mit „Teil 3“ (${k.multi})`);
await halte('[data-slot-id="s3"]', 450);
ok((await kopf()).multi === "" && !(await page.$("[data-wahl-fertig]")), "letzte herausgenommen: Auswahl endet");

// ── einsammeln: kurz halten und weiterfahren ──
let a = await mitte('[data-slot-id="s1"]'), b = await mitte('[data-slot-id="s3"]');
await sleep(150);
await finger("touchStart", a.x, a.y); await sleep(400);
for (let i = 1; i <= 8; i++) { await finger("touchMove", a.x, a.y + (b.y - a.y) * i / 8); await sleep(40); }
await finger("touchEnd"); await sleep(500);
ok((await kopf()).multi === "s1,s2,s3", `kurz halten + weiterfahren sammelt ein (${(await kopf()).multi})`);

// ── 236: lang halten ohne Bewegung: angehoben, Doppel-Tipp, beim Loslassen heraus (wie kurz halten) ──
a = await mitte('[data-slot-id="s2"]'); await sleep(150);
await finger("touchStart", a.x, a.y); await sleep(1250);
ok(await page.$('[data-slot-id="s2"][data-angehoben]'), "lang halten (1,0 s): Kachel angehoben");
await finger("touchEnd"); await sleep(450);
ok((await kopf()).multi === "s1,s3" && await page.evaluate(() => window._vib.join(" ")) === "[8,70,8]", `236: lang halten ohne Bewegung: „Teil 2“ heraus, Doppel-Tipp (${(await kopf()).multi}, ${await page.evaluate(() => window._vib.join(" "))})`);

// ── Ordner auswählen: zählt mit seinem ganzen Inhalt ──
await halte('[data-slot-id="s3"]', 60);   // neu mit Teil 3
await halte('[data-slot-id="o1"]', 450);
k = await kopf();
ok(k.multi === "s3,o1" && /2 ausgewählt · 4 Vokabeln/.test(await kopfText()), `Ordner kurz halten: kommt in die Auswahl, zählt mit Inhalt (${k.multi} | ${await kopfText()})`);
await halte('[data-slot-id="s3"]', 450);
ok(/📁 Mappe laden/.test(await kopfText()) && /Öffnen/.test(await aktionen()), `nur der Ordner: Kopf „📁 Mappe laden“, Ordner-Menü (${await kopfText()})`);
await halte('[data-slot-id="s1"]', 450);
await page.evaluate(() => document.querySelector("[data-wahl-fertig]")?.click()); await sleep(700);
const v = (await slots()).verlauf[0];
ok(v?.multi?.map(t => t.id).join(",") === "s4,s1", `übernehmen: Multiquiz aus Ordner-Inhalt + Teil 1 (${v?.multi?.map(t => t.id).join(",")})`);

// ── in einen Ordner gehen hebt die Auswahl auf ──
await auswahlAuf();
await halte('[data-slot-id="s1"]', 450);
ok((await kopf()).multi === "s1", "Auswahl mit Teil 1");
await halte('[data-slot-id="o1"]', 60); await sleep(300);
ok((await kopf()).multi === "" && await page.$('[data-slot-id="s4"]'), `Ordner antippen: geöffnet, Auswahl aufgehoben (${(await kopf()).multi})`);

// ── Listen: dasselbe ──
await zuListen(page);
const lwahl = () => page.evaluate(() => [...document.querySelectorAll(".listen-raster [data-wahl-nr]")].sort((a, b) => a.dataset.wahlNr - b.dataset.wahlNr)
  .map(e => e.closest("[data-liste-id], [data-lordner-id]")).map(e => e.dataset.listeId || e.dataset.lordnerId).join(","));
await halte('[data-liste-id="l_a"]', 450);
ok(await lwahl() === "l_a" && /^Unit 1 laden/.test(await kopfText()), `Liste kurz halten: Auswahl, Kopf „📋 Unit 1 laden“ (${await lwahl()} | ${await kopfText()})`);
await halte('[data-lordner-id="lo1"]', 450);
ok(await lwahl() === "l_a,lo1" && /^2 ausgewählt · 20 Vokabeln/.test(await kopfText()), `Listen-Ordner kommt in die Auswahl (${await lwahl()} | ${await kopfText()})`);
await halte('[data-liste-id="l_b"]', 60);
ok(await lwahl() === "l_b", `antippen in der Auswahl: neu mit „Unit 2“ (${await lwahl()})`);
await halte('[data-lordner-id="lo1"]', 450);
await page.evaluate(() => document.querySelector("[data-wahl-fertig]")?.click()); await sleep(700);
const info = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
ok(/(^|\D)(\d+\/)?20 Vokabeln/.test(info), `übernehmen: Unit 2 + Ordner-Inhalt (Unit 3) = 20 Vokabeln (${(info.match(/[\d\/]+ Vokabeln/) || [""])[0]})`);

// ── 231: beim Verschieben keine leere Spalte, solange der Finger nicht am rechten Rand ist ──
await zuListen(page);
const spalten = () => page.evaluate(() => document.querySelector(".listen-raster")?.dataset.rasterSpaltenAnz);
a = await mitte('[data-liste-id="l_b"]'); await sleep(150);
await finger("touchStart", a.x, a.y); await sleep(1250);
for (let i = 1; i <= 5; i++) { await finger("touchMove", a.x - 10, a.y - 20 * i); await sleep(50); }
ok(await spalten() === "1", `231: ziehen in der Mitte – keine zusätzliche Spalte (${await spalten()})`);
const rechts = await page.evaluate(() => document.querySelector(".listen-raster").getBoundingClientRect().right);
for (let i = 1; i <= 4; i++) { await finger("touchMove", rechts - 5, a.y - 100 + i); await sleep(60); }
ok(await spalten() === "2", `231: am rechten Rand – freie Spalte dazu (${await spalten()})`);
await finger("touchEnd"); await sleep(500);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
