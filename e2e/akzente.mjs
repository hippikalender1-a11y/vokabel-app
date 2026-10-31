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
  // Ende eines Durchlaufs: „Weiter →“ führt zur Session-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
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

// Ü|D|A sitzt in der zugeklappten Kopfzeile der Session-Auswahl
const artWaehlen = async a => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") k.querySelector("button.zeile-rechts")?.click(); });
  await new Promise(r => setTimeout(r, 300));
  await page.click(`[data-quiz-art="${a}"]`);
};
await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  // frühere Standard-Haken der Stufen (Test prüft sie ausdrücklich)
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", autoplay:false, vorlesen:["E1"], gelerntSchwelle:0, sprache:"alle",
    stufen: { schwer: { akzenteTolerant:false, aufdeckenAbzug:true, akzentOhneMischen:true, akzentHervorheben:false, akzentZaehler:false, akzentAutoUebernahme:false } } }));
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
if (!(await page.$(".spalten-modus-btn"))) await page.click("[data-abfragemodus]");
await sleep(300);
const knoepfe = await page.evaluate(() => [...document.querySelectorAll(".spalten-modus-btn")].map(b => b.textContent.trim()));
console.log("     Modus-Knöpfe Ü:", knoepfe.join(" | "));
ok(!knoepfe.includes("Akzente"), "Übersetzung: kein Akzente-Modus in den Spalten (eigene Art)");
await artWaehlen("akzente"); await sleep(300);
const knoepfeA = await page.evaluate(() => [...document.querySelectorAll(".spalten-modus-btn")].map(b => b.textContent.trim()));
console.log("     Modus Akzente:", knoepfeA.join(" | "));
ok(knoepfeA.join("|") === "Akzente", "Akzente (A): Antwortspalte fest auf Akzente, keine anderen Modi");
const startAnzahl = () => page.evaluate(() => document.querySelector("[data-start-knopf]")?.dataset.startAnzahl);
let t = await text();
ok(await startAnzahl() === "4", "Stufe „Schwer“ (Standard): auch Wörter ohne Akzent → 4 Wörter");
// Regel in der Schwierigkeits-Tabelle für "Schwer" ausschalten (Lang-Druck auf Leicht/Schwer)
await page.evaluate(() => { const el = document.querySelector("[data-stufe]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }); await sleep(250); await page.evaluate(() => document.querySelector('[data-info-aktion="⚙ Regeln Leicht / Schwer"]').click());
await sleep(300);
await page.evaluate(() => {
  const zeile = [...document.querySelectorAll("div")].find(d => d.textContent.trim() === "Akzent-Modus: auch Wörter ohne Akzent abfragen");
  zeile.parentElement.nextElementSibling.nextElementSibling.click();
});
await sleep(200);
await page.evaluate(() => document.querySelector("[data-stufen-regeln]")?.closest(".overlay")?.click()); await sleep(200);
ok(await startAnzahl() === "3", "Regel aus: nur 3 Wörter mit Akzent (chat fehlt)");
const kette = await page.evaluate(() => ["auswahl", "akzent"].map(k => document.querySelector(`[data-anzahl="${k}"]`)?.textContent.trim()));
kette.push(await startAnzahl());
console.log("     Anzahl-Kette:", kette.join(" → "));
ok(kette.join(" → ") === "(4 V.) → (3 mit Akzent) → 3", "Zeilen: Auswahl 4 → mit Akzent 3 → Start 3");

await clickText("[data-start-knopf]", "");
await sleep(400);
const gesehen = [];
const klassen = () => page.evaluate(() => [...document.querySelectorAll(".akzent-kachel")].map(b => b.className.replace("akzent-kachel", "").trim()));
const tippe = async i => { await page.evaluate(i => document.querySelectorAll(".akzent-kachel")[i].click(), i); await sleep(120); };
const kartenFarbe = () => page.evaluate(() => document.querySelector(".quiz-antwort-box")?.className || "");
for (let k = 0; k < 10; k++) {
  t = await text();
  if (/Durchlauf abgeschlossen|Auswertung|Paket fertig/.test(t)) break;
  if (t.includes("Weiter zur Wiederholung")) { gesehen.push("[W]"); await clickText("button", "Weiter zur Wiederholung"); continue; }
  const frage = ["Schüler", "Herz", "Junge"].find(w => t.includes(w));
  const mal = gesehen.filter(x => x === frage).length + 1;
  gesehen.push(frage);
  if (frage === "Schüler") {
    const vorher = await kacheln();
    ok(vorher.join(" ") === "e* l* e* v* e*", `élève startet ohne Akzente, alle Kacheln gleich antippbar: ${vorher.join(" ")}`);
    await setze(2, "è");
    ok((await klassen())[2] === "ok", "Richtig gesetzter Akzent wird sofort grün");
    await setze(0, "é");
    ok((await text()).includes("Prüfen") && !(await text()).includes("Weiter →"), "Stufe „Schwer“: alle Akzente richtig, aber „Prüfen“ nötig");
    await clickText("button", "Prüfen", true);
    ok((await kartenFarbe()).includes("richtig"), "Nach Prüfen: ganze Karte grün");
  } else if (frage === "Herz" && mal === 1) {
    await tippe(0);
    ok((await klassen())[0] === "blink", "Buchstabe ohne Akzent (c) leuchtet rot auf");
    ok(!(await page.$(".akzent-leiste")), "… und öffnet keine Variantenleiste");
    await sleep(700);
    ok((await klassen())[0] === "", "Rotes Aufleuchten verschwindet wieder");
    await setze(1, "ô");
    ok((await kacheln())[1] === "o*" && (await klassen())[1] === "blink", "Falsche Variante: leuchtet rot, Buchstabe bleibt o");
    await setze(1, "œ");
    const nach = await kacheln();
    t = await text();
    ok(nach.map(x => x.replace("*", "")).join("") === "cœur", `œ ersetzt o + e: ${nach.join(" ")}`);
    await clickText("button", "Prüfen", true);
    t = await text();
    const fb = await page.evaluate(() => document.querySelector(".quiz-feedback")?.className || "");
    ok(t.includes("nicht gewusst") && fb.includes("nein") && (await kartenFarbe()).includes("richtig"), "Mit Fehlgriff richtig gelöst: Karte grün, Hinweis rot (zählt als nicht gewusst)");
  } else if (frage === "Herz" && mal >= 3) {
    await setze(1, "œ");
  } else if (frage === "Herz") {
    await clickText("button", "Prüfen", true);   // ohne œ geprüft
    await clickText("button", "Lösung anzeigen");
    t = await text();
    const loes = await page.evaluate(() => ({
      wort: [...document.querySelectorAll(".akzent-kachel")].map(b => b.textContent).join(""),
      gelb: [...document.querySelectorAll(".akzent-kachel.loesung")].map(b => b.textContent).join(""),
    }));
    console.log("     Lösung als Kacheln:", JSON.stringify(loes));
    ok(loes.wort === "cœur" && loes.gelb === "œ" && t.includes("Weiter →"),
      "Nach Prüfen mit Fehler: „Lösung anzeigen“ lässt die Kacheln stehen (cœur), œ grün auf gelb");
  } else if (frage === "Junge" && mal === 1) {
    await clickText("button", "Prüfen", true);   // ohne ç geprüft
    t = await text();
    ok(await page.evaluate(() => document.querySelectorAll(".akzent-kachel.falsch").length === 1) && t.includes("korrigieren") && !t.includes("Weiter →"),
      "Prüfen mit Fehler: fehlender Buchstabe rot, Korrektur noch möglich");
    await setze(3, "ç");
    t = await text();
    await clickText("button", "Prüfen", true);
    t = await text();
    ok((await klassen())[3] === "ok" && t.includes("Weiter →") && t.includes("nicht gewusst"),
      "Korrigiert: ç grün, Antwort übernommen, zählt aber als nicht gewusst");
  } else if (frage === "Junge") {
    await setze(3, "ç");
  }
  await sleep(150);
  if (!(await text()).includes("Weiter →")) await clickText("button", "Prüfen", true);
  await clickText("button", "Weiter →");
  await sleep(300);
}
console.log("     Abfolge:", gesehen.join(" → "));
ok(gesehen.includes("[W]") && gesehen.filter(x => x === "Junge").length === 2 && gesehen.filter(x => x === "Herz").length === 3, "Falsch beantwortete Wörter kommen nach der Wiederholungs-Karte erneut");
t = await text();
ok(/1 von 3 richtig/.test(t), "Auswertung: 1 von 3 richtig");
const st = await page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.map(v => [v.E1.wert, [v.akzentFortschritt?.score ?? null, v.fortschritt?.score ?? null]])));
console.log("     [Akzent-Score, normaler Score]:", JSON.stringify(st));
ok(st["élève"][0] === 1 && st["cœur"][0] === -1 && st["garçon"][0] === -1, "Eigener Akzent-Score: richtig +1, falsch −1 (nur erste Antwort)");
ok(Object.values(st).every(([, n]) => n === null), "Normaler Score bleibt unverändert");
ok(st["chat"][0] === null, "chat wurde nicht abgefragt");

// Statistik: Tap in die Kreismitte wechselt Übersetzung → Diktat → Akzente
await clickText("button", "Zur Übersicht");
await clickText(".tab", "Statistik");
await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check, div")].find(e => e.textContent.trim() === "Akzente")?.click());
await sleep(300);
const mitte = () => page.evaluate(() => document.querySelector("[data-kreismitte] text")?.textContent);
const gesamt = async () => (await text()).match(/Gesamt (\d+)/)?.[1];
const legende = () => page.evaluate(() => [...document.querySelectorAll("[data-legende]")].map(b => b.textContent.trim()).join(" | "));
ok(await mitte() === "Übersetzung" && await gesamt() === "4", `Start: Übersetzung, Gesamt ${await gesamt()} (${await legende()})`);
await page.evaluate(() => document.querySelector("[data-kreismitte]").dispatchEvent(new MouseEvent("click", { bubbles: true })));
await sleep(250);
ok(await mitte() === "Diktat", "1. Tap: Diktat");
await page.evaluate(() => document.querySelector("[data-kreismitte]").dispatchEvent(new MouseEvent("click", { bubbles: true })));
await sleep(250);
const leg = await legende();
ok(await mitte() === "Akzente" && await gesamt() === "3" && /Negativ 2/.test(leg) && /In Arbeit 1/.test(leg),
  `2. Tap: Akzente – nur Wörter mit Akzent, Gruppen nach Akzent-Score (Gesamt ${await gesamt()}: ${leg})`);
ok((await text()).includes("Akzente") && /Lernfortschritt|Ø Score/.test(await text()), "Kopfzeile nennt die ausgewertete Art");
await page.evaluate(() => document.querySelector("[data-kreismitte]").dispatchEvent(new MouseEvent("click", { bubbles: true })));
await sleep(250);
ok(await mitte() === "Übersetzung", "3. Tap: zurück zu Übersetzung");

// Schwierigkeitsgrad: Hervorheben gilt standardmäßig nur in "Einfach"; per Haken änderbar
await clickText(".tab", "Quiz");
await sleep(300);
const markiert = () => page.evaluate(() => document.querySelectorAll(".akzent-kachel.markiert").length);
let zaehlerDa = null;
const starteUndZaehle = async () => {
  await page.evaluate(() => document.querySelector("[data-stufen-regeln]")?.closest(".overlay")?.click()); await sleep(200);
  await clickText("[data-start-knopf]", "");
  await sleep(400);
  if ((await text()).includes("Weiter zur Wiederholung")) await clickText("button", "Weiter zur Wiederholung");
  const n = await markiert();
  zaehlerDa = !!(await page.$(".akzent-zaehler"));
  await clickText("button", "Beenden", true);
  await sleep(300);
  if (/Zur Übersicht/.test(await text())) await clickText("button", "Zur Übersicht");
  await sleep(300);
  return n;
};
ok(await starteUndZaehle() === 0, "Stufe „Schwer“ (Standard): Akzent-Buchstaben nicht hervorgehoben");
ok(zaehlerDa === false, "Stufe „Schwer“: kein Akzent-Zähler");
const oeffneEinst = async () => {
  if (!(await text()).includes("Was gilt als leicht / schwer?")) { await page.evaluate(() => { const el = document.querySelector("[data-stufe]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }); await sleep(250); await page.evaluate(() => document.querySelector('[data-info-aktion="⚙ Regeln Leicht / Schwer"]').click()); }
  await sleep(300);
};
await oeffneEinst();
ok((await text()).includes("Was gilt als leicht / schwer?"), "Lang-Druck auf die Stufe zeigt die Tabelle „Was gilt als leicht / schwer?“");
await clickText("[data-stufen-regeln] .toggle-opt", "Leicht", true);
ok(await starteUndZaehle() > 0, "Stufe „Einfach“: Buchstaben mit Akzent hervorgehoben");
// Einfach: richtige Akzente werden automatisch übernommen
await page.evaluate(() => document.querySelector("[data-stufen-regeln]")?.closest(".overlay")?.click()); await sleep(200);
await clickText("[data-start-knopf]", "");
await sleep(400);
{
  const tt0 = await text();
  const loesung = { "Schüler": [[2, "è"], [0, "é"]], "Herz": [[1, "œ"]], "Junge": [[3, "ç"]] };
  const schritte = loesung[Object.keys(loesung).find(w => tt0.includes(w))];
  const zaehler = () => page.evaluate(() => document.querySelector(".akzent-zaehler")?.textContent.trim());
  ok(await zaehler() === `Akzente 0 / ${schritte.length}`, `Stufe „Einfach“: Zähler „${await zaehler()}“`);
  // Fehlgriff auf Buchstaben ohne Akzent: leuchtet rot, zählt bei Hervorhebung aber nicht als Fehler
  await page.evaluate(i => document.querySelectorAll(".akzent-kachel")[i].click(), tt0.includes("Schüler") ? 1 : 0);
  await sleep(100);
  ok(await page.evaluate(() => document.querySelectorAll(".akzent-kachel.blink").length === 1), "Stufe „Einfach“: Fehlgriff leuchtet rot auf");
  await sleep(700);
  if (schritte.length > 1) { await setze(...schritte[0]); ok(await zaehler() === `Akzente 1 / ${schritte.length}`, "Zähler steigt nach richtigem Akzent"); schritte.shift(); }
  for (const [i, v] of schritte) await setze(i, v);
  ok((await text()).includes("Weiter →") && (await kartenFarbe()).includes("richtig"), "Stufe „Einfach“: alle Akzente richtig → automatisch übernommen");
  ok(!(await text()).includes("Nicht fehlerfrei"), "Stufe „Einfach“ (hervorgehoben): Fehlgriff zählt nicht als Fehler");
  await clickText("button", "Beenden", true);
  await sleep(300);
  if (/Zur Übersicht/.test(await text())) await clickText("button", "Zur Übersicht");
  await sleep(300);
}
// Haken "hervorheben" in Spalte Einfach entfernen
await oeffneEinst();
await page.evaluate(() => {
  const zeile = [...document.querySelectorAll("div")].find(d => d.textContent.trim() === "Akzent-Modus: Buchstaben mit Akzent hervorheben");
  zeile.parentElement.nextElementSibling.click();
});
await sleep(200);
const einst = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}"));
console.log("     gespeicherte Stufen:", JSON.stringify(einst.stufen));
ok(einst.stufen?.einfach?.akzentHervorheben === false, "Haken wird gespeichert");
ok(await starteUndZaehle() === 0, "Ohne Haken: auch in „Einfach“ keine Hervorhebung");
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
