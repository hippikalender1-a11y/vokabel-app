import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, einstUnter, artenMehrfach } from "./hilfen.mjs";

// 85–87: Antwort-Arten und Rolle „Antwort“: antippen wechselt sofort (leuchtet kurz); lang drücken › „☑ Mehrere wählen“ →
// antippen schaltet dazu/weg, der Zeilen-Knopf zeigt „n Arten / ✓ Bestätigen“ und beendet die Mehrfach-Auswahl.
// 89: Einstellungen-Bereiche mit Knopfzeile (offener Knopf grün, Auswahl schließt und leuchtet, übriger Inhalt ausgeblendet)
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const klick = async sel => { await page.evaluate(s => document.querySelector(s)?.click(), sel); await sleep(150); };
const arten = typ => page.evaluate(t => [...document.querySelectorAll(`[data-modus-knopf^="${t}:"].aktiv`)].map(b => b.dataset.modusKnopf.split(":")[1]).join(","), typ);
const leuchtet = sel => page.evaluate(s => document.querySelector(s)?.classList.contains("leuchten"), sel);
const kopf = () => page.evaluate(() => document.querySelector("[data-abfragemodus]").innerText.replace(/\s+/g, " ").trim());
const lang = async sel => {
  await page.evaluate(s => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }, sel);
  await sleep(250);
};
const aktion = async label => { await page.evaluate(l => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(250); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ gelerntSchwelle: 2 }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",E2:"Plural",D1:"Deutsch"}[t] || "", aktiv: ["E1","E2","D1"].includes(t) }]));
  const vokabeln = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, E1: { wert: `word${i + 1}`, falsch: [] }, E2: { wert: `words${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 7, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(700);
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unit 1"))?.click()); await sleep(300);
await listenZu(page);
await klick("[data-abfragemodus]"); await sleep(200);

// ── 85: antippen wechselt ──
ok(await arten("E1") === "karte", `Start: Karte (${await arten("E1")})`);
await klick('[data-modus-knopf="E1:mc"]');
ok(await arten("E1") === "mc", `MC antippen: nur MC (${await arten("E1")})`);
ok(await leuchtet('[data-modus-knopf="E1:mc"]'), "… MC leuchtet kurz");
await klick('[data-modus-knopf="E1:mc"]');
ok(await arten("E1") === "mc", "gewählte Art nochmal antippen: bleibt");

// ── 86: Mehrfach-Auswahl ──
await artenMehrfach(page, "E1:tippen");
ok(await arten("E1") === "mc,tippen" && await page.$("[data-modus-gruppen][data-mehrfach]"), `lang drücken › Mehrere wählen: Tastatur dazu (${await arten("E1")})`);
ok(/2 Arten/.test(await kopf()) && /Bestätigen/.test(await kopf()), `Zeilen-Knopf: „2 Arten / Bestätigen“ (${await kopf()})`);
await klick('[data-modus-knopf="E1:karte"]');
ok(await arten("E1") === "karte,mc,tippen" && /3 Arten/.test(await kopf()), `antippen nimmt dazu (${await arten("E1")})`);
await klick('[data-modus-knopf="E1:mc"]');
ok(await arten("E1") === "karte,tippen", `antippen nimmt weg (${await arten("E1")})`);
await klick("[data-abfragemodus]"); await sleep(200);
ok(!(await page.$("[data-modus-gruppen]")), "Bestätigen: Bereich zu");
await klick("[data-abfragemodus]"); await sleep(200);
ok(!(await page.$("[data-modus-gruppen][data-mehrfach]")) && await arten("E1") === "karte,tippen", "wieder offen: Auswahl bleibt, Mehrfach-Auswahl beendet");
await klick('[data-modus-knopf="E1:puzzle"]');
ok(await arten("E1") === "puzzle", `danach normal antippen: nur die angetippte Art (${await arten("E1")})`);

// ── 87: Rolle „Antwort“ ──
await page.evaluate(() => [...document.querySelectorAll("[data-modus-gruppen]")].length);
const zeileVon = typ => `[data-rolle-antwort="${typ}"]`;
// Spalte „Plural“ (E2) anhaken
await page.evaluate(() => [...document.querySelectorAll("div")].find(d => d.style.cursor === "pointer" && d.textContent.includes("Plural") && d.textContent.includes("E2"))?.click()); await sleep(200);
const rollen = () => page.evaluate(() => [...document.querySelectorAll("[data-rolle-antwort]")].map(b => `${b.dataset.rolleAntwort}=${b.textContent.trim()}`).join(" "));
ok(/E1=Antwort 1/.test(await rollen()) && /E2=Antwort$/.test(await rollen()), `Start: E1 ist Antwort 1 (${await rollen()})`);
await klick(zeileVon("E2"));
ok(await rollen() === "E1=Antwort E2=Antwort 1", `„Antwort“ bei Plural antippen: einzige Antwort (${await rollen()})`);
ok(await leuchtet(zeileVon("E2")), "… leuchtet kurz");
await lang(zeileVon("E1")); await aktion("☑ Mehrere wählen");
ok(await rollen() === "E1=Antwort 2 E2=Antwort 1", `lang drücken › Mehrere wählen: Englisch wird Antwort 2 (Reihenfolge des Antippens) (${await rollen()})`);
ok(/2 Antworten/.test(await kopf()), `Zeilen-Knopf: „2 Antworten“ (${await kopf()})`);
await klick(zeileVon("E2"));
ok(await rollen() === "E1=Antwort 1 E2=Antwort", `antippen nimmt weg (${await rollen()})`);
await klick(zeileVon("E1"));
ok(await rollen() === "E1=Antwort 1 E2=Antwort", "die letzte Antwort bleibt");
await klick("[data-abfragemodus]"); await sleep(200);

// ── 89: Einstellungen ──
const zeile = () => page.evaluate(() => [...document.querySelectorAll("[data-einst-zeile] .quiz-zeile-zelle")].map(z => `${z.querySelector(".quiz-zeile-label").textContent}=${z.querySelector("button").innerText.trim()}`).join(" | "));
await einstUnter(page, "listen");
ok(await page.$('[data-liste-id="l_a"]') && /Sicherung=💾 nie \| Erinnerung=/.test(await zeile()), `Listen: Knopfzeile, Listen sichtbar (${await zeile()})`);
await klick('[data-einst-unter="sicherung"]');
ok(await page.$("[data-sicherung]") && !(await page.$('[data-liste-id="l_a"]')), "Sicherung offen: Listen ausgeblendet");
await klick('[data-einst-unter="erinnerung"]');
ok(await page.$("[data-sicherung-tage]") && !(await page.$("[data-sicherung]")) && /Bestätigen/.test(await zeile()), "Erinnerung offen: „Bestätigen“, nur ein Bereich offen");
await klick('[data-sicherung-tage-wahl="14"]');
ok(!(await page.$("[data-sicherung-tage]")) && /Erinnerung=nach 14 T/.test(await zeile()) && await leuchtet('[data-einst-unter="erinnerung"]'), `Wahl: übernommen, zu, leuchtet (${await zeile()})`);

await einstUnter(page, "lernen");
ok(/Arten mischen=\d+ Arten \| Gelernt ab=Score \+2 \| Akzente=/.test(await zeile()) && !(await page.$("[data-antwort-gewichte]")), `Lernen: Knopfzeile, nichts offen (${await zeile()})`);
await klick('[data-einst-unter="gelernt"]');
await klick('[data-gelernt-wahl="4"]');
ok(/Gelernt ab=Score \+4/.test(await zeile()) && !(await page.$("[data-gelernt-schwelle]")), "Gelernt-Schwelle: Wahl schließt");
await klick('[data-einst-unter="mischen"]');
ok(await page.$("[data-antwort-gewichte]") && (await zeile()).includes("▲"), "Arten mischen offen: Regler, Knopf mit ▲");

await einstUnter(page, "raster", "sessions");
await klick('[data-raster-spalten="3"]');
ok(/Sessions=3 Spalten/.test(await zeile()), `Raster: Sessions 3 Spalten (${await zeile()})`);

await einstUnter(page, "farben");
ok(await page.$("[data-farb-tabs]") && !(await page.$("[data-farbschema]")), "Farben: Knopfzeile, nichts offen");
await klick('[data-farb-tab="vorlagen"]');
ok(await page.$("[data-farbschema]"), "Vorlagen offen: Schemata sichtbar");

await einstUnter(page, "app");
ok(/Version=/.test(await zeile()) && /Info=📖 Anleitung/.test(await zeile()), `App: Knopfzeile (${await zeile()})`);
await klick("[data-info-oeffnen]"); await sleep(200);
ok(await page.evaluate(() => document.querySelector('[data-einst-kopf="info"]')?.dataset.offen === "ja"), "Info öffnet die Anleitung");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
