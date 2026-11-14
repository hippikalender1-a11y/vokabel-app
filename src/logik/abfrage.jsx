import { AKZENTE_FUER_LISTE, AKZENT_HINWEIS, LIGATUR_TEILE, MC_FEHLKLICK_HINWEIS, REKORDE_KEY, STANDARD_ANTWORT_MODUS, ZUORDNUNG_FARBEN, ZUORDNUNG_ZEITFAKTOR, akzentKacheln, akzentOhneAnteil, antwortSpaltenFuer, berechneDiktatScore, berechneNeuenScore, ersteAlt, generiereButtons, gewichtetWaehlen, hatAkzente, istMC, istRichtigeAntwort, istRichtigeEinzeln, istRunde, loeseSpaltenModusAuf, modiVon, ohneHinweis, speichereAkzentScore, speichereDiktatScore, speichereScore } from "../quiz.jsx";
import { aeusserung, aktiveStimmen, gewaehlteStimme, sprich, stimmenFuerSprache } from "../sprache.js";
import { TYPEN } from "../speicher.js";
import { istSynonymSpalte, synonymeAus } from "../saetze.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

// ── Zuordnung: nächste Runde aus der Warteschlange (nicht beantwortete kommen vorne wieder hinein) ──
export function zuordnungRunde(app, q) {
  const { zuordnungRundeAus } = app;
    const z = q.zuordnung;
    if (!z.queue.length) return { ...q, phase: "fertig" };
    const art = gewichtetWaehlen(z.arten?.length ? z.arten : ["zuordnung"]);
    const k = Math.min(art === "memory" ? Math.min(z.paare, 8) : z.paare, z.queue.length);
    return zuordnungRundeAus({ ...q, zuordnung: { ...z, queue: z.queue.slice(k) } }, z.queue.slice(0, k), art);
  }

export function zuordnungRundeAus(app, q, ids, art = "zuordnung") {
  const { zuordnungZeitBis } = app;
    const z = q.zuordnung, k = ids.length;
    const alleSpalten = z.alleSpalten || z.spalten;
    const fremdSp = alleSpalten.find(t => t.startsWith("E"));
    const spalten = art !== "memory" ? alleSpalten : !fremdSp || alleSpalten.slice(0, 2).includes(fremdSp) ? alleSpalten.slice(0, 2) : [alleSpalten[0], fremdSp];
    const vok = id => q.vokabeln.find(v => v.id === id);
    const mische = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    // „wechselnd“: je Zeile zufällig, welche Spalte links steht (bei zwei Spalten: Seiten getauscht oder nicht)
    const n = spalten.length, dreh = Object.fromEntries(ids.map(id => [id, z.wechselnd ? Math.floor(Math.random() * n) : 0]));
    const karten = spalten.map((_, sp) => mische(ids.map(id => { const t = spalten[(sp + dreh[id]) % n]; return { id, typ: t, text: vok(id)?.[t]?.wert || "" }; })));
    // Memory: je Vokabel zwei verdeckte Karten (Frage und Antwort), gemischt
    const mKarten = art === "memory" ? mische(ids.flatMap(id => spalten.map((t, seite) => ({ id, seite, text: vok(id)?.[t]?.wert || "" })))) : null;
    return { ...q, phase: "zuordnung", zuordnung: { ...z, art, alleSpalten, spalten, ids, karten, mKarten, mOffen: [], mZuege: 0, runde: z.runde + 1,
      erledigt: {}, fehler: {}, offen: null, gruppen: [], offeneGruppe: null, blink: null, anzeige: null, zeitBis: art === "memory" ? null : zuordnungZeitBis({ ...z, spalten }, k) } };
  }

// Memory: zwei Karten aufdecken; Frage + Antwort derselben Vokabel → Paar gefunden (+1), sonst nach kurzer Zeit wieder zu
export function memoryTippe(app, i) {
  const { einstellungen, quiz, setQuiz, vokLang, zuordnungRundeEnde, zuordnungWerte } = app;
    const q = quiz, z = q?.zuordnung;
    if (!z || z.art !== "memory" || z.anzeige || z.mOffen.length >= 2) return;
    const k = z.mKarten[i];
    if (k.id in z.erledigt || z.mOffen.includes(i)) return;
    if (einstellungen.autoplay && z.spalten[k.seite].startsWith("E")) { const v = q.vokabeln.find(x => x.id === k.id); sprich(k.text, vokLang(v, z.spalten[k.seite])); }
    const offen = [...z.mOffen, i];
    if (offen.length < 2) { setQuiz({ ...q, zuordnung: { ...z, mOffen: offen } }); return; }
    const [a, b] = offen.map(x => z.mKarten[x]);
    if (a.id === b.id && a.seite !== b.seite) {
      let neu = zuordnungWerte({ ...q, zuordnung: { ...z, mOffen: [], mZuege: z.mZuege + 1, paarFarbe: { ...(z.paarFarbe || {}), [a.id]: Object.keys(z.paarFarbe || {}).length % ZUORDNUNG_FARBEN.length } } }, a.id, "richtig");
      if (neu.zuordnung.ids.every(id => id in neu.zuordnung.erledigt)) neu = zuordnungRundeEnde(neu);
      setQuiz(neu);
      return;
    }
    setQuiz({ ...q, zuordnung: { ...z, mOffen: offen, mZuege: z.mZuege + 1 } });
    setTimeout(() => setQuiz(prev => prev?.zuordnung?.mOffen?.length === 2 && prev.zuordnung.mOffen[1] === i ? { ...prev, zuordnung: { ...prev.zuordnung, mOffen: [] } } : prev), 1100);
  }

export function mitZuordnungMix(app, q) {
  const { zuordnungRundeAus } = app;
    if (!q?.zuordnungMix || q.phase !== "eingabe") return q;
    const typen = q.antwortTypen || [];
    const art = typen.map(t => q.spalteModus?.[t]).find(istRunde);
    if (!art) return q;
    const rest = q.vokabeln.length - q.index;
    if (rest < 3) {   // zu wenige für eine Runde: eine andere angehakte Art ziehen
      const sp = { ...q.spalteModus };
      typen.forEach(t => { if (!istRunde(sp[t])) return; const andere = modiVon(q.spalteModusBasis?.[t]).filter(x => !istRunde(x) && x !== "akzent"); sp[t] = andere.length ? gewichtetWaehlen(andere) : STANDARD_ANTWORT_MODUS; });
      const mc = istMC(sp[typen[0]]) ? generiereButtons(q.vokabeln, q.vokabeln[q.index], typen[0], sp[typen[0]]) : null;
      return { ...q, spalteModus: sp, ...(mc ? { mcButtons: mc.buttons, mcRichtig: mc.richtig } : {}) };
    }
    const k = Math.min(art === "memory" ? Math.min(q.zuordnungMix.paare, 8) : q.zuordnungMix.paare, rest);
    const ids = q.vokabeln.slice(q.index, q.index + k).map(v => v.id);
    const spalten = q.zuordnungMix.wechselnd ? q.zuordnungMix.spalten : [q.frageTyp, ...typen].slice(0, 4);
    return zuordnungRundeAus({ ...q, zuordnung: { ...q.zuordnungMix, spalten, alleSpalten: spalten, mix: { start: q.index, ende: q.index + k }, queue: [],
      beantwortet: q.vokabeln.slice(0, q.index).map(v => v.id) } }, ids, art);
  }

// gemischt, Runde zu Ende: Beantwortete bleiben an ihrer Stelle, offen Gebliebene kommen ans Ende; weiter mit der nächsten Frage
export function zuordnungMixWeiter(app, q) {
  const { naechsteVokabelState } = app;
    const z = q.zuordnung, { start, ende } = z.mix;
    const runde = q.vokabeln.slice(start, ende);
    const fertig = runde.filter(v => v.id in z.erledigt), offen = runde.filter(v => !(v.id in z.erledigt));
    const vokabeln = [...q.vokabeln.slice(0, start), ...fertig, ...q.vokabeln.slice(ende), ...offen];
    return naechsteVokabelState({ ...q, vokabeln, index: start + fertig.length - 1, zuordnung: null, phase: "eingabe", vokErgebnis: null, erstbewertung: false });
  }

export function zuordnungZeitBis(app, z, k) {
  const {  } = app;
    if (z.zeit === "aus") return null;
    const proVok = z.sek * (ZUORDNUNG_ZEITFAKTOR[z.spalten.length] || 1) * 1000;
    return Date.now() + (z.amEnde ? proVok * k : proVok);
  }

// Ergebnis einer Vokabel speichern (nur vollständig Beantwortetes): richtig +1, falsch nach Regel −1
export function zuordnungWerte(app, q, id, ergebnis) {
  const { quizRegeln } = app;
    const lv = q.liste.vokabeln.find(v => v.id === id) || q.vokabeln.find(v => v.id === id);
    const r = quizRegeln();
    const neu = berechneNeuenScore(lv?.fortschritt, ergebnis, r.aufdeckenAbzug ? "schwer" : "einfach", q.zuordnung.abzug);
    const erst = !(id in (q.gewertet || {}));
    return { ...q, liste: speichereScore(q.liste, id, neu),
      gewertet: erst ? { ...(q.gewertet || {}), [id]: ergebnis } : q.gewertet,
      ...(ergebnis === "richtig" ? { richtigMap: { ...(q.richtigMap || {}), [id]: ((q.richtigMap || {})[id] || 0) + 1 } } : {}),
      ...(q.spielZaehler != null && ergebnis === "richtig" ? { spielZaehler: q.spielZaehler + 1 } : {}),
      quizRichtigAnzahl: (q.quizRichtigAnzahl || 0) + (erst && ergebnis === "richtig" ? 1 : 0),
      quizFalschAnzahl: (q.quizFalschAnzahl || 0) + (erst && ergebnis !== "richtig" ? 1 : 0),
      zuordnung: { ...q.zuordnung, erledigt: { ...q.zuordnung.erledigt, [id]: ergebnis }, beantwortet: [...q.zuordnung.beantwortet, id] } };
  }

// Rundenende: das Ergebnis bleibt stehen (✓ / ✗ je Paar), weiter mit „Weiter →“; „Lösung zeigen“ färbt die richtigen Paare.
// Nicht Beantwortete kommen in der nächsten Runde wieder
export function zuordnungRundeEnde(app, q) {
  const {  } = app;
    const z = q.zuordnung;
    const offen = z.ids.filter(id => !(id in z.erledigt));
    return { ...q, zuordnung: { ...z, queue: [...offen, ...z.queue], zeitBis: null, offen: null, offeneGruppe: null, anzeige: "ergebnis" } };
  }

export function zuordnungTippe(app, s, i) {
  const { einstellungen, quiz, setQuiz, vokLang, zuordnungGruppeTippe, zuordnungPruefe, zuordnungRundeEnde, zuordnungWerte, zuordnungZeitBis } = app;
    const q = quiz, z = q?.zuordnung;
    if (!z || q.phase !== "zuordnung" || z.anzeige) return;
    const karte = z.karten[s][i];
    if (karte.id in z.erledigt) return;
    const kt = karte.typ || z.spalten[s];
    if (einstellungen.autoplay && kt.startsWith("E")) { const v = q.vokabeln.find(x => x.id === karte.id); sprich(karte.text, vokLang(v, kt)); }
    if (z.amEnde) {
      const nz = zuordnungGruppeTippe(z, s, i);
      const alles = nz.gruppen.length === nz.ids.length && nz.gruppen.every(g => Object.keys(g.wahl).length === nz.spalten.length);
      setQuiz(alles ? zuordnungPruefe({ ...q, zuordnung: nz }) : { ...q, zuordnung: nz });
      return;
    }
    const o = z.offen;
    if (!o) { setQuiz({ ...q, zuordnung: { ...z, offen: { id: karte.id, wahl: { [s]: i }, erst: s } } }); return; }
    if (o.wahl[s] === i) {   // dieselbe Karte nochmal: erste → Gruppe aufheben, sonst nur diese abwählen
      if (s === o.erst) { setQuiz({ ...q, zuordnung: { ...z, offen: null } }); return; }
      const wahl = { ...o.wahl }; delete wahl[s];
      setQuiz({ ...q, zuordnung: { ...z, offen: { ...o, wahl } } }); return;
    }
    if (s === o.erst && Object.keys(o.wahl).length === 1) {   // andere Karte in der Spalte der ersten: neu anfangen, kein Fehlgriff
      setQuiz({ ...q, zuordnung: { ...z, offen: { id: karte.id, wahl: { [s]: i }, erst: s } } }); return;
    }
    if (karte.id !== o.id) {   // Fehlgriff: zählt für die Vokabel der zuerst angetippten Karte
      setQuiz({ ...q, zuordnung: { ...z, fehler: { ...z.fehler, [o.id]: true }, blink: { s, i, t: Date.now() } } });
      setTimeout(() => setQuiz(prev => prev?.zuordnung?.blink?.s === s && prev.zuordnung.blink.i === i ? { ...prev, zuordnung: { ...prev.zuordnung, blink: null } } : prev), 650);
      return;
    }
    const wahl = { ...o.wahl, [s]: i };
    if (Object.keys(wahl).length < z.spalten.length) { setQuiz({ ...q, zuordnung: { ...z, offen: { ...o, wahl } } }); return; }
    // Gruppe vollständig
    let neu = zuordnungWerte({ ...q, zuordnung: { ...z, offen: null, paarFarbe: { ...(z.paarFarbe || {}), [o.id]: Object.keys(z.paarFarbe || {}).length % ZUORDNUNG_FARBEN.length } } },
      o.id, z.fehler[o.id] ? "falsch" : "richtig");
    if (z.zeit !== "aus") neu = { ...neu, zuordnung: { ...neu.zuordnung, zeitBis: zuordnungZeitBis(z, 1) } };
    if (neu.zuordnung.ids.every(id => id in neu.zuordnung.erledigt)) neu = zuordnungRundeEnde(neu);
    setQuiz(neu);
  }

// „am Ende“: Karten bilden farbige Gruppen in Tipp-Reihenfolge; eingefärbte Karte antippen nimmt sie heraus
export function zuordnungGruppeTippe(app, z, s, i) {
  const {  } = app;
    let gruppen = z.gruppen.map(g => ({ ...g, wahl: { ...g.wahl } }));
    let offen = z.offeneGruppe;
    const gi = gruppen.findIndex(g => g.wahl[s] === i);
    if (gi >= 0) {
      delete gruppen[gi].wahl[s];
      if (!Object.keys(gruppen[gi].wahl).length) { gruppen.splice(gi, 1); offen = offen === gi ? null : offen != null && offen > gi ? offen - 1 : offen; }
      else { if (gruppen[gi].erst === s) gruppen[gi].erst = Number(Object.keys(gruppen[gi].wahl)[0]); offen = gi; }
      return { ...z, gruppen, offeneGruppe: offen };
    }
    if (offen != null && gruppen[offen]) {
      gruppen[offen].wahl[s] = i;
      const voll = Object.keys(gruppen[offen].wahl).length === z.spalten.length;
      return { ...z, gruppen, offeneGruppe: voll ? null : offen };
    }
    const belegt = new Set(gruppen.map(g => g.farbe));
    const farbe = ZUORDNUNG_FARBEN.findIndex((_, k) => !belegt.has(k));
    gruppen.push({ wahl: { [s]: i }, erst: s, farbe: farbe < 0 ? gruppen.length % ZUORDNUNG_FARBEN.length : farbe });
    return { ...z, gruppen, offeneGruppe: gruppen.length - 1 };
  }

// „Prüfen“ (oder Zeit abgelaufen bei „am Ende“): nur vollständige Gruppen zählen
export function zuordnungPruefe(app, q) {
  const { zuordnungRundeEnde, zuordnungWerte } = app;
    const z = q.zuordnung;
    let neu = q;
    const ergebnis = {};
    z.gruppen.forEach((g, gi) => {
      if (Object.keys(g.wahl).length !== z.spalten.length) return;
      const ids = Object.entries(g.wahl).map(([sp, k]) => z.karten[sp][k].id);
      const erstId = z.karten[g.erst][g.wahl[g.erst]].id;
      const richtig = ids.every(id => id === ids[0]);
      ergebnis[gi] = richtig;
      if (!(erstId in neu.zuordnung.erledigt)) neu = zuordnungWerte(neu, erstId, richtig ? "richtig" : "falsch");
    });
    neu = { ...neu, zuordnung: { ...neu.zuordnung, geprueft: ergebnis } };
    return zuordnungRundeEnde(neu);
  }

// eslint-disable-line react-hooks/exhaustive-deps
export function getAktVok(app) {
  const { quiz } = app;
    if (!quiz) return null;
    const vokId = quiz.vokabeln[quiz.index].id;
    return quiz.liste.vokabeln.find(v => v.id === vokId) || quiz.vokabeln[quiz.index];
  }

// Berechnet den nächsten Vokabel-State als reines Objekt (kein setQuiz)
// 175: abgeschlossene Vokabel in den Rückblick (ganze Runde; Zuordnung nicht)
export function mitRueckblick(app, prev) {
  const {  } = app;
    const v = prev.vokabeln[prev.index];
    const rb = prev.rueckblick || [];
    if (!v || !prev.vokErgebnis || prev.phase === "zuordnung") return { ...prev, letzteWertung: null, versuche: {}, rueckIdx: null };
    const sp = t => prev.liste.spalten[t]?.name || t;
    const eintrag = { art: "quiz", vokId: v.id, frage: { typ: prev.frageTyp, label: sp(prev.frageTyp), wert: v[prev.frageTyp]?.wert || "" },
      antworten: (prev.vorigeAntworten || []).map(a => ({ ...a })), ergebnis: prev.vokErgebnis === "richtig" ? "richtig" : "falsch",
      wertung: prev.letzteWertung || null, zaehlt: prev.erstbewertung !== false };
    return { ...prev, rueckblick: [...rb, eintrag], letzteWertung: null, versuche: {}, rueckIdx: null };
  }

export function naechsteVokabelState(app, prev) {
  const { mitRueckblick, mitZuordnungMix, naechsteVokabelState0, spielBeenden } = app;
    prev = mitRueckblick(prev);
    const sp = prev?.abfrageZiel?.modus, spiel = sp === "blitz" || sp === "serie";
    if (spiel && prev.vokErgebnis) {
      const richtig = prev.vokErgebnis === "richtig", id = prev.vokabeln[prev.index]?.id;
      prev = { ...prev, spielZaehler: (prev.spielZaehler || 0) + (richtig ? 1 : 0), spielBeantwortet: [...new Set([...(prev.spielBeantwortet || []), id])] };
      if (sp === "serie" && !richtig) return spielBeenden(prev);
    }
    if (spiel && prev.index + 1 >= prev.vokabeln.length) {
      const basis = prev.spielBasis || prev.vokabeln, b = [...basis];
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      prev = { ...prev, vokabeln: [...prev.vokabeln, ...b] };
    }
    return mitZuordnungMix(naechsteVokabelState0(prev));
  }

// Blitzrunde / Serie zu Ende: Rekord je Art und Quiz (bzw. Liste) festhalten
export function spielBeenden(app, q) {
  const { aktiverSlot } = app;
    const art = q.abfrageZiel?.modus, n = q.spielZaehler || 0;
    const key = `${art}|${aktiverSlot?.typ === "gespeichert" ? aktiverSlot.id : (q.liste?.id || "liste")}`;
    let rekorde = {};
    try { rekorde = JSON.parse(localStorage.getItem(REKORDE_KEY)) || {}; } catch { /* leer */ }
    const alt = rekorde[key] || 0;
    if (n > alt) { rekorde[key] = n; try { localStorage.setItem(REKORDE_KEY, JSON.stringify(rekorde)); } catch { /* egal */ } }
    return { ...q, phase: "spielEnde", spielRekord: { alt, neu: n > alt },
      ...(q.istSessionModus ? { sessionVokIds: q.spielBeantwortet || [] } : {}) };
  }

// eslint-disable-line react-hooks/exhaustive-deps
export function naechsteVokabelState0(app, prev) {
  const {  } = app;
    const naechsterIdx = prev.index + 1;
    const aktVokId = prev.vokabeln[prev.index]?.id;
    const warRichtig = prev.vokErgebnis === "richtig";
    const richtigMap = (prev.abfrageZiel?.modus === "wiederholung" && aktVokId && warRichtig)
      ? { ...(prev.richtigMap || {}), [aktVokId]: ((prev.richtigMap || {})[aktVokId] || 0) + 1 }
      : (prev.richtigMap || {});
    // Auswertung zählt jede Vokabel einmal (erste Bewertung der Runde); Wiederholungen nicht
    const zaehlt = prev.erstbewertung !== false;
    const quizRichtigAnzahl = (prev.quizRichtigAnzahl || 0) + (zaehlt && warRichtig ? 1 : 0);
    const quizFalschAnzahl = (prev.quizFalschAnzahl || 0) + (zaehlt && !warRichtig ? 1 : 0);

    function getFA(voks, idx) {
      const basis = prev.basisFA || { frageTyp: prev.frageTyp, antwortTypen: prev.antwortTypen };
      let fa = { frageTyp: basis.frageTyp, antwortTypen: basis.antwortTypen };
      if (prev.modus === "rotierend") {
        const alle = prev.basisFA ? [basis.frageTyp, ...basis.antwortTypen] : [...basis.antwortTypen, basis.frageTyp];   // = Reihenfolge wie beim Start
        const ft = alle[idx % alle.length];
        fa = { frageTyp: ft, antwortTypen: alle.filter(t => t !== ft) };
      }
      return { frageTyp: fa.frageTyp, antwortTypen: antwortSpaltenFuer(voks[idx], fa.antwortTypen, prev.spalteModusBasis || prev.spalteModus, prev.akzentOhneAuslassen, true) };
    }

    // Baut den State für vokabeln[idx] innerhalb von voks auf
    function starteVokabel(voks, idx, extra = {}) {
      const { frageTyp, antwortTypen } = getFA(voks, idx);
      const vok = voks[idx];
      const teile = vok[antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
      const sp = prev.spalteModusBasis ? loeseSpaltenModusAuf(prev.spalteModusBasis, vok, frageTyp) : prev.spalteModus;
      const mc = istMC(sp[antwortTypen[0]] || STANDARD_ANTWORT_MODUS) ? generiereButtons(voks, vok, antwortTypen[0], sp[antwortTypen[0]]) : null;
      return { ...prev, richtigMap, quizRichtigAnzahl, quizFalschAnzahl, spaltenErgebnisse: {}, vokErgebnis: null, erstbewertung: null, flash: false, index: idx,
        vokabeln: voks, frageTyp, antwortTypen, antwortTypIndex: 0,
        phase: "eingabe", eingabe: "", antwortTeile: teile, weitereIndices: [], weiterePos: 0,
        mcButtons: mc?.buttons || [], mcRichtig: mc?.richtig || [],
        vorigeAntworten: [], infoSichtbar: false, synSichtbar: false, infoSeite: 0, feedback: "",
        spalteModus: sp, mcWechsel: false, aktuelleFehlversuche: 0, falschFlash: false,
        sessionFalsch: {}, ...extra };
    }

    if (naechsterIdx >= prev.vokabeln.length) {
      if (prev.abfrageZiel) {
        const ziel = prev.abfrageZiel;
        // Vor jedem Wiederholungs-Durchgang eine Zwischenkarte "Wiederholung" zeigen
        const wiederholungsStart = () => ({ phase: "wiederholungHinweis", wiederholungDurchgang: (prev.wiederholungDurchgang || 0) + 1 });
        if (ziel.modus === "anzahl" && ziel.runde < ziel.anzahl - 1) {
          const neuVoks = [...prev.vokabeln].sort(() => Math.random() - 0.5);
          return starteVokabel(neuVoks, 0, { abfrageZiel: { ...ziel, runde: ziel.runde + 1 } });
        }
        if (ziel.modus === "wiederholung") {
          const restVoks = prev.vokabeln.filter(v => (richtigMap[v.id] || 0) < ziel.wiederholung);
          if (restVoks.length > 0) {
            const neuVoks = [...restVoks].sort(() => Math.random() - 0.5);
            return starteVokabel(neuVoks, 0, wiederholungsStart());
          }
        }
        if (ziel.modus === "score" && ziel.scoreTyp === "session") {
          const restVoks = prev.vokabeln.filter(v => {
            const liveVok = prev.liste.vokabeln.find(lv => lv.id === v.id);
            const score = liveVok?.[prev.scoreFeld || "fortschritt"]?.score ?? 0;
            if (ziel.scoreTyp === "session") {
              const startScore = (ziel.startScoresZiel || {})[v.id] ?? 0;
              return (score - startScore) < ziel.score;
            }
            return score < ziel.score;
          });
          if (restVoks.length > 0) {
            const neuVoks = [...restVoks].sort(() => Math.random() - 0.5);
            return starteVokabel(neuVoks, 0, wiederholungsStart());
          }
        }
      }
      return {...prev, richtigMap, quizRichtigAnzahl, quizFalschAnzahl, spaltenErgebnisse: {}, vokErgebnis: null, erstbewertung: null, flash: false, phase: "fertig"};
    }

    const { frageTyp, antwortTypen } = getFA(prev.vokabeln, naechsterIdx);
    const naechsteVok = prev.vokabeln[naechsterIdx];
    const teile = naechsteVok[antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
    // je Vokabel neu auflösen (setzt auch einen MC-Wechsel der vorigen Frage zurück)
    const spalteModus = prev.spalteModusBasis ? loeseSpaltenModusAuf(prev.spalteModusBasis, naechsteVok, frageTyp)
      : prev.mcWechsel ? {...prev.spalteModus, [antwortTypen[0]]: "tippen"} : prev.spalteModus;
    const modusTyp0 = spalteModus[antwortTypen[0]] || STANDARD_ANTWORT_MODUS;
    const mc = istMC(modusTyp0) ? generiereButtons(prev.vokabeln, naechsteVok, antwortTypen[0], modusTyp0) : null;
    return {...prev, richtigMap, quizRichtigAnzahl, quizFalschAnzahl, spaltenErgebnisse: {}, vokErgebnis: null, erstbewertung: null, flash: false, index: naechsterIdx, frageTyp, antwortTypen, antwortTypIndex: 0,
      phase: "eingabe", eingabe: "", antwortTeile: teile, weitereIndices: [], weiterePos: 0,
      mcButtons: mc?.buttons || prev.mcButtons, mcRichtig: mc?.richtig || prev.mcRichtig,
      vorigeAntworten: [], infoSichtbar: false, synSichtbar: false, infoSeite: 0, feedback: "",
      spalteModus, mcWechsel: false, aktuelleFehlversuche: 0, falschFlash: false};
  }

// Setzt flash, wartet 500ms, führt dann advanceFn aus
// Kurze Verzögerung vor der nächsten Vokabel; zwischen mehreren Antworten derselben Frage geht es sofort weiter
export function mitVerzoegerung(app, quizUpdates, advanceFn, ms) {
  const { beendeVerzoegerung, flashTimerRef, flashWeiterRef, quiz, setQuiz, sofortWeiter } = app;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (sofortWeiter(quiz)) {
      flashWeiterRef.current = null;
      setQuiz(prev => advanceFn({...prev, ...quizUpdates, flash: false, karteNeinFlash: false}));
      return;
    }
    flashWeiterRef.current = advanceFn;
    setQuiz(prev => ({...prev, ...quizUpdates}));
    flashTimerRef.current = setTimeout(beendeVerzoegerung, ms);
  }

export function mitFlash(app, quizUpdates, advanceFn) {
  const { mitVerzoegerung } = app;
    mitVerzoegerung({...quizUpdates, flash: true, eingabe: ""}, advanceFn, 1000);
  }

// Antippen während der Verzögerung: sofort weiter
export function beendeVerzoegerung(app) {
  const { flashTimerRef, flashWeiterRef, setQuiz } = app;
    const fn = flashWeiterRef.current;
    if (!fn) return;
    flashWeiterRef.current = null;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => prev && (prev.flash || prev.karteNeinFlash) ? fn({...prev, flash: false, karteNeinFlash: false}) : prev);
  }

// Aktuelle Spalte abschließen: Antwort (gewusst oder nicht) bleibt oben stehen, dann nächste Spalte bzw. Vokabel
export function weiterNachSpalte(app, prev, richtig) {
  const { naechsteVokabelState } = app;
    const typ = prev.antwortTypen[prev.antwortTypIndex];
    const vorigeAntworten = [...prev.vorigeAntworten, {
      typ, wert: prev.antwortTeile.join(" / "), label: prev.liste.spalten[typ]?.name || typ, richtig, eingaben: prev.versuche?.[prev.antwortTypIndex] || [],
    }];
    const naechsterIdx = prev.antwortTypIndex + 1;
    if (naechsterIdx >= prev.antwortTypen.length) return naechsteVokabelState({...prev, vorigeAntworten, richtigAufgedeckt: false});
    const nt = prev.antwortTypen[naechsterIdx];
    const teile = prev.vokabeln[prev.index][nt]?.wert.split('/').map(s => s.trim()) || [];
    const ntModus = prev.mcWechsel ? "mc" : (prev.spalteModus?.[nt] || STANDARD_ANTWORT_MODUS);
    const mc = istMC(ntModus) ? generiereButtons(prev.vokabeln, prev.vokabeln[prev.index], nt, ntModus) : null;
    return {...prev, flash: false, karteNeinFlash: false, phase: "eingabe", eingabe: "", antwortTypIndex: naechsterIdx,
      antwortTeile: teile, mcButtons: mc?.buttons || prev.mcButtons, mcRichtig: mc?.richtig || prev.mcRichtig,
      weitereIndices: [], weiterePos: 0, infoSichtbar: false, richtigAufgedeckt: false,
      aktuelleFehlversuche: 0, falschFlash: false, feedback: "", vorigeAntworten};
  }

// Score einmal pro Vokabel: Ergebnis je Antwort-Spalte sammeln, nach der letzten
// Spalte auswerten (alle richtig → richtig, sonst falsch bzw. aufgedeckt)
// Karten-Spalten, die per „Weiter“ übersprungen wurden, stehen auf „karte“: am Ende gilt ein gemeinsames Urteil (karteUrteil);
// ist eine andere Spalte schon nicht gewusst, steht das Ergebnis fest; sonst fragt die letzte Spalte „Gewusst / Nicht gewusst“ (karteBewertungOffen)
export function spaltenAbschluss(app, ergebnis, karteUrteil = null) {
  const { blitzKey, einstellungen, getAktVok, quiz, quizRegeln } = app;
    const spaltenErgebnisse = { ...(quiz.spaltenErgebnisse || {}), [quiz.antwortTypIndex]: ergebnis };
    const letzte = quiz.antwortTypIndex >= quiz.antwortTypen.length - 1;
    if (!letzte || quiz.vokErgebnis) return { spaltenErgebnisse };
    const offen = Object.keys(spaltenErgebnisse).filter(i => spaltenErgebnisse[i] === "karte");
    if (offen.length) {
      if (karteUrteil) offen.forEach(i => { spaltenErgebnisse[i] = karteUrteil; });
      else if (quiz.antwortTypen.every((_, i) => spaltenErgebnisse[i] === "richtig" || spaltenErgebnisse[i] === "karte")) return { spaltenErgebnisse, karteBewertungOffen: true };
      else offen.forEach(i => { spaltenErgebnisse[i] = "richtig"; });
    }
    const alle = quiz.antwortTypen.map((_, i) => spaltenErgebnisse[i] || "aufgedeckt");
    const gesamt = liste => liste.every(e => e === "richtig") ? "richtig" : liste.includes("falsch") ? "falsch" : "aufgedeckt";
    const vokErgebnis = gesamt(alle);
    // Akzent-Spalten zählen nur für den eigenen Akzent-Score – gemischt gezogene Akzente zählen für die Übersetzung
    const istAkzent = i => { const t = quiz.antwortTypen[i]; return quiz.spalteModus?.[t] === "akzent" && !Array.isArray(quiz.spalteModusBasis?.[t]); };
    const normal = alle.filter((_, i) => !istAkzent(i));
    const akzent = alle.filter((_, i) => istAkzent(i));
    const aktVok = getAktVok();
    // Pro Vokabel und Runde zählt nur die erste Bewertung (Wiederholungen sind reines Üben).
    // Ausnahme Abfrage-Ziel "Score": dort muss jede Antwort zählen, sonst endet die Runde nie.
    const erstbewertung = !(aktVok.id in (quiz.gewertet || {}));
    const gewertet = erstbewertung ? { ...(quiz.gewertet || {}), [aktVok.id]: vokErgebnis } : quiz.gewertet;
    if (!erstbewertung && quiz.abfrageZiel?.modus !== "score") return { spaltenErgebnisse, vokErgebnis, erstbewertung, gewertet, karteBewertungOffen: false };
    let liste = quiz.liste, sessionFalsch = quiz.sessionFalsch, gelerntBlitz = null;
    // 175: Stand vor der Antwort + Ergebnis je Teil – für das nachträgliche Umwerten
    const letzteWertung = { vorher: { fortschritt: aktVok.fortschritt, akzentFortschritt: aktVok.akzentFortschritt },
      normal: normal.length ? gesamt(normal) : null, akzent: akzent.length ? (gesamt(akzent) === "richtig" ? "richtig" : "aufgedeckt") : null,
      modus: quizRegeln().aufdeckenAbzug ? "schwer" : "einfach", falschAbzug: quizRegeln().falschAbzug };
    // Vokabel erreicht mit dieser Antwort die Gelernt-Schwelle → Karte leuchtet kurz auf (Farbe „Gelernt-Effekt“) + Sternenregen
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    const erreicht = (vorher, nachher) => schwelle > 0 && (vorher?.score ?? -Infinity) < schwelle && (nachher?.score ?? -Infinity) >= schwelle;
    if (normal.length > 0) {
      const erg = gesamt(normal);
      const neuerCount = erg === "falsch" ? (quiz.sessionFalsch[aktVok.id] || 0) + 1 : 0;
      const neu = berechneNeuenScore(aktVok.fortschritt, erg, quizRegeln().aufdeckenAbzug ? "schwer" : "einfach", quizRegeln().falschAbzug);
      liste = speichereScore(liste, aktVok.id, neu);
      if (erreicht(aktVok.fortschritt, neu)) gelerntBlitz = blitzKey(quiz);
      if (erg === "falsch") sessionFalsch = { ...quiz.sessionFalsch, [aktVok.id]: neuerCount };
    }
    if (akzent.length > 0) {
      const neu = berechneDiktatScore(aktVok.akzentFortschritt, gesamt(akzent) === "richtig" ? "richtig" : "aufgedeckt", quizRegeln().falschAbzug);
      liste = speichereAkzentScore(liste, aktVok.id, neu);
      if (erreicht(aktVok.akzentFortschritt, neu)) gelerntBlitz = blitzKey(quiz);
    }
    return { spaltenErgebnisse, vokErgebnis, erstbewertung, gewertet, liste, sessionFalsch, karteBewertungOffen: false, letzteWertung, ...(gelerntBlitz ? { gelerntBlitz } : {}) };
  }

// Akzent-Abfrage mit Wörtern ohne Akzent: nur so viele ohne Akzent wie eingestellt (Faktor × mit Akzent);
// bevorzugt die mit schwächstem bzw. noch keinem Akzent-Score, bei Gleichstand zufällig.
// festeIds: laufende Quiz – dann bleiben genau die Wörter ohne Akzent vom Quiz-Start
export function begrenzeOhneAkzent(app, voks, antwortTypen, festeIds = null) {
  const { einstellungen, quizRegeln } = app;
    const anteil = akzentOhneAnteil(einstellungen);
    if (!quizRegeln().akzentOhneMischen || anteil == null) return voks;
    const mitAkz = v => antwortTypen.some(t => hatAkzente(v[t]?.wert));
    const mit = voks.filter(mitAkz);
    const ohne = voks.filter(v => !mitAkz(v));
    const max = Math.round(mit.length * anteil);
    const kandidaten = festeIds ? ohne.filter(v => festeIds.has(v.id))
      : ohne.map(v => [v, Math.random()]).sort((a, b) => ((a[0].akzentFortschritt?.score ?? -Infinity) - (b[0].akzentFortschritt?.score ?? -Infinity)) || a[1] - b[1]).map(x => x[0]);
    const behalten = new Set(kandidaten.slice(0, max).map(v => v.id));
    return voks.filter(v => mitAkz(v) || behalten.has(v.id));
  }

// Wörter ohne Akzent gleichmäßig zwischen die mit Akzent verteilen (Reihenfolge innerhalb bleibt)
export function verteileOhneAkzent(app, voks, antwortTypen) {
  const {  } = app;
    const mitAkz = v => antwortTypen.some(t => hatAkzente(v[t]?.wert));
    const mit = voks.filter(mitAkz), ohne = voks.filter(v => !mitAkz(v));
    if (!mit.length || !ohne.length) return voks;
    const n = voks.length, erg = [];
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      if (b < ohne.length && (a >= mit.length || b < Math.round((i + 1) * ohne.length / n))) erg.push(ohne[b++]);
      else erg.push(mit[a++]);
    }
    return erg;
  }

export function pruefeAntwort(app, eingabeArg) {
  const { aktiveListeId, flashTimerRef, quiz, quizRegeln, setQuiz, sofortWeiter, spaltenAbschluss, weiterNachSpalte } = app;
    const eingabe = (typeof eingabeArg === "string" ? eingabeArg : quiz?.eingabe || "").trim();
    if (!quiz || !eingabe) return;
    setQuiz(prev => prev ? { ...prev, versuche: { ...(prev.versuche || {}), [prev.antwortTypIndex]: [...(prev.versuche?.[prev.antwortTypIndex] || []), eingabe] } } : prev);   // 175

    // Modus "Einfach": fehlende/falsche Akzente zählen als richtig (mit Hinweis); ebenso, wenn die Akzente der Sprache aus sind
    const vokJetzt = quiz.vokabeln[quiz.index], spalteJetzt = quiz.antwortTypen[quiz.antwortTypIndex];
    const tolerant = quizRegeln().akzenteTolerant || (spalteJetzt?.startsWith("E") && !AKZENTE_FUER_LISTE(vokJetzt?._listeId ?? aktiveListeId));
    let akzentHinweis = false;

    function setzeRichtigAufgedeckt(updates) {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (sofortWeiter(quiz) && !akzentHinweis) { setQuiz(prev => weiterNachSpalte({...prev, ...updates}, true)); return; }
      setQuiz(prev => ({...prev, eingabe: "", phase: "aufgedeckt", flash: false,
        richtigAufgedeckt: true, feedback: akzentHinweis ? AKZENT_HINWEIS : "", falschFlash: false, aktuelleFehlversuche: 0, ...updates}));
    }

    if (quiz.phase === "weitere") {
      const erwartet = quiz.antwortTeile[quiz.weitereIndices[quiz.weiterePos]];
      const treffer = istRichtigeAntwort(eingabe, erwartet, tolerant);
      if (treffer) {
        if (treffer === "akzent") akzentHinweis = true;
        const naechstePos = quiz.weiterePos + 1;
        if (naechstePos >= quiz.weitereIndices.length) {
          // Alle "weitere" erledigt → Lösung zeigen, warten
          setzeRichtigAufgedeckt({});
        } else {
          // Nächstes "weitere" ohne Flash
          setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: akzentHinweis ? AKZENT_HINWEIS : ""}));
        }
      } else {
        setQuiz(prev => ({...prev, eingabe: "", phase: "weitere", feedback: "Nicht ganz – versuch nochmal."}));
      }
      return;
    }

    let matchIdx = quiz.antwortTeile.findIndex(t => istRichtigeAntwort(eingabe, t) === true);
    if (matchIdx === -1 && tolerant) {
      matchIdx = quiz.antwortTeile.findIndex(t => istRichtigeAntwort(eingabe, t, true));
      if (matchIdx !== -1) akzentHinweis = true;
    }

    if (matchIdx !== -1) {
      const abschluss = { ...spaltenAbschluss("richtig"), treffer: { k: `${quiz.index}|${quiz.antwortTypIndex}`, e: eingabe } };
      const restIndices = quiz.antwortTeile.map((_, i) => i).filter(i => i !== matchIdx);

      if (restIndices.length > 0) {
        // Mehrere Teile (was/were): direkt zu "weitere", Spalte gilt bereits als richtig
        setQuiz(prev => ({...prev, ...abschluss, eingabe: "", phase: "weitere", weitereIndices: restIndices, weiterePos: 0, feedback: akzentHinweis ? AKZENT_HINWEIS : ""}));
      } else {
        // Spalte fertig → Lösung zeigen, warten
        setzeRichtigAufgedeckt(abschluss);
      }
    } else {
      // Synonym statt des gesuchten Worts: kein Fehler, nochmal versuchen
      const synonyme = TYPEN.filter(x => x.startsWith("i") && istSynonymSpalte(quiz.liste.spalten[x])).flatMap(x => synonymeAus(vokJetzt?.[x]?.wert));
      if (synonyme.some(s => istRichtigeEinzeln(eingabe, s, true))) {
        setQuiz(prev => ({...prev, eingabe: "", feedback: "Synonym – gesucht ist ein anderes Wort. Nochmal versuchen."}));
        return;
      }
      const neueFehlversuche = (quiz.aktuelleFehlversuche || 0) + 1;
      if (neueFehlversuche >= 3) {
        // 3. Fehlversuch: Spalte falsch, Lösung automatisch anzeigen
        const abschluss = spaltenAbschluss("falsch");
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setQuiz(prev => ({...prev, ...abschluss, eingabe: "", phase: "aufgedeckt", flash: false,
          feedback: "", falschFlash: false, aktuelleFehlversuche: 0}));
      } else {
        // 1. oder 2. Fehlversuch: kurz rot aufleuchten, dann zurück
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setQuiz(prev => ({...prev, eingabe: "", falschFlash: true,
          feedback: "Nicht richtig.", aktuelleFehlversuche: neueFehlversuche}));
        flashTimerRef.current = setTimeout(() => {
          setQuiz(prev => ({...prev, falschFlash: false, feedback: ""}));
        }, 1500);
      }
    }
  }

export function klickeButton(app, idx) {
  const { quiz, setQuiz, sofortWeiter, spaltenAbschluss, weiterNachSpalte } = app;
    if (!quiz || quiz.flash) return;
    const btn = quiz.mcButtons[idx];
    if (!btn || btn.status === "richtig") return;

    if (btn.korrekt) {
      const neueButtons = quiz.mcButtons.map((b, i) => i === idx ? {...b, status: "richtig"} : b);
      const alleGefunden = neueButtons.filter(b => b.korrekt).every(b => b.status === "richtig");

      if (alleGefunden) {
        // Nach einem Fehlklick darf weitergesucht werden – die Spalte zählt aber als nicht gewusst
        const fehlklick = quiz.spaltenErgebnisse?.[quiz.antwortTypIndex] === "falsch";
        const abschluss = spaltenAbschluss(fehlklick ? "falsch" : "richtig");
        if (!fehlklick && sofortWeiter(quiz)) { setQuiz(prev => weiterNachSpalte({...prev, ...abschluss, mcButtons: neueButtons}, true)); return; }
        setQuiz(prev => ({
          ...prev, ...abschluss, mcButtons: neueButtons,
          phase: "aufgedeckt", flash: false, richtigAufgedeckt: !fehlklick,
          feedback: fehlklick ? MC_FEHLKLICK_HINWEIS : "",
        }));
      } else {
        setQuiz(prev => ({...prev, mcButtons: neueButtons}));
      }
    } else {
      setQuiz(prev => ({...prev,
        versuche: { ...(prev.versuche || {}), [prev.antwortTypIndex]: [...(prev.versuche?.[prev.antwortTypIndex] || []), btn.text] },   // 175
        spaltenErgebnisse: { ...(prev.spaltenErgebnisse || {}), [prev.antwortTypIndex]: "falsch" },
        mcButtons: prev.mcButtons.map((b, i) => i === idx ? {...b, status: "falsch"} : b)}));
      setTimeout(() => {
        setQuiz(prev => ({...prev, mcButtons: prev.mcButtons.map((b, i) => i === idx ? {...b, status: "neutral"} : b)}));
      }, 500);
    }
  }

export function zeigeLosung(app) {
  const { flashTimerRef, quiz, setQuiz, spaltenAbschluss } = app;
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // Fehlklick bei Multiple Choice bleibt "falsch", auch wenn danach die Lösung angezeigt wird
    const schonFalsch = quiz.spaltenErgebnisse?.[quiz.antwortTypIndex] === "falsch";
    const abschluss = spaltenAbschluss(schonFalsch ? "falsch" : "aufgedeckt");
    const aktModus = quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] || STANDARD_ANTWORT_MODUS;
    const mcUpd = istMC(aktModus)
      ? { mcButtons: quiz.mcButtons.map(b => b.korrekt ? {...b, status: "richtig"} : b) }
      : {};
    setQuiz(prev => ({...prev, ...abschluss, eingabe: "", flash: false, phase: "aufgedeckt",
      feedback: "", falschFlash: false, aktuelleFehlversuche: 0, ...mcUpd}));
  }

export function ueberspringeWeitere(app) {
  const { mitFlash, quiz, setQuiz, weiterNachSpalte } = app;
    const naechstePos = quiz.weiterePos + 1;
    if (naechstePos >= quiz.weitereIndices.length) {
      mitFlash({}, prev => weiterNachSpalte(prev, true));
    } else {
      setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: ""}));
    }
  }

export function wechsleZuMC(app) {
  const { quiz, setQuiz } = app;
    const typ = quiz?.antwortTypen?.[quiz.antwortTypIndex];
    const aktuellerModus = quiz?.spalteModus?.[typ] || STANDARD_ANTWORT_MODUS;
    if (!quiz || !typ || aktuellerModus !== "tippen") return;
    const mc = generiereButtons(quiz.liste.vokabeln, quiz.vokabeln[quiz.index], typ);
    setQuiz(prev => ({
      ...prev, antwortModus: "mc", mcWechsel: true,
      spalteModus: {...prev.spalteModus, [typ]: "mc"},
      mcButtons: mc.buttons, mcRichtig: mc.richtig,
      phase: "eingabe", eingabe: "", feedback: "",
    }));
  }

// 175: Bewertung einer früheren Karte der Runde ändern (nur richtig ↔ falsch). Score: Stand vor der Antwort wiederherstellen
// und alle späteren Wertungen derselben Vokabel neu rechnen; Rundenzählung, Wiederholungs-Zähler und Diktat-Ergebnis mitziehen
export function umwerten(app, i) {
  const { setQuiz } = app;
    setQuiz(prev => {
      const rb = [...(prev?.rueckblick || [])], e = rb[i];
      if (!e) return prev;
      const neu = e.ergebnis === "richtig" ? "falsch" : "richtig", ja = neu === "richtig";
      const w0 = e.wertung;
      rb[i] = { ...e, ergebnis: neu, umgewertet: !e.umgewertet,
        antworten: e.antworten.map(a => ({ ...a, richtig: ja })),
        wertung: w0 ? { ...w0, ...(w0.normal != null ? { normal: ja ? "richtig" : "falsch" } : {}), ...(w0.akzent != null ? { akzent: ja ? "richtig" : "aufgedeckt" } : {}),
          ...(w0.diktat != null ? { diktat: ja ? "richtig" : "aufgedeckt" } : {}) } : null };
      let liste = prev.liste, extra = {};
      if (w0) {
        const stand = { ...w0.vorher };
        for (let j = i; j < rb.length; j++) {
          const x = rb[j];
          if (x.vokId !== e.vokId || !x.wertung) continue;
          const w = { ...x.wertung, vorher: { ...x.wertung.vorher, ...stand } };
          rb[j] = { ...x, wertung: w };
          if (w.normal != null) stand.fortschritt = berechneNeuenScore(w.vorher.fortschritt, w.normal, w.modus, w.falschAbzug);
          if (w.akzent != null) stand.akzentFortschritt = berechneDiktatScore(w.vorher.akzentFortschritt, w.akzent, w.falschAbzug);
          if (w.diktat != null) stand.diktatFortschritt = berechneDiktatScore(w.vorher.diktatFortschritt, w.diktat, w.falschAbzug);
        }
        if (w0.normal != null) liste = speichereScore(liste, e.vokId, stand.fortschritt);
        if (w0.akzent != null) liste = speichereAkzentScore(liste, e.vokId, stand.akzentFortschritt);
        if (w0.diktat != null) liste = speichereDiktatScore(liste, e.vokId, stand.diktatFortschritt);
      }
      if (e.zaehlt && e.art === "quiz") {
        extra.quizRichtigAnzahl = Math.max(0, (prev.quizRichtigAnzahl || 0) + (ja ? 1 : -1));
        extra.quizFalschAnzahl = Math.max(0, (prev.quizFalschAnzahl || 0) + (ja ? -1 : 1));
        extra.gewertet = { ...(prev.gewertet || {}), [e.vokId]: neu };
      }
      if (e.art === "diktat" && e.diktatIdx != null && prev.diktatErgebnisse?.[e.diktatIdx])
        extra.diktatErgebnisse = prev.diktatErgebnisse.map((d, k) => k === e.diktatIdx ? { ...d, richtig: ja } : d);
      let vokabeln = prev.vokabeln;
      if (prev.abfrageZiel?.modus === "wiederholung") {
        const rm = { ...(prev.richtigMap || {}) };
        rm[e.vokId] = Math.max(0, (rm[e.vokId] || 0) + (ja ? 1 : -1));
        extra.richtigMap = rm;
        // falsch → richtig: eine noch geplante Wiederholung dieser Vokabel im laufenden Durchgang entfällt
        if (ja && rm[e.vokId] >= prev.abfrageZiel.wiederholung) vokabeln = vokabeln.filter((v, k) => k <= prev.index || v.id !== e.vokId);
      }
      return { ...prev, ...extra, liste, vokabeln, rueckblick: rb };
    });
  }

// Wischen im Quiz: nach rechts = eine Karte zurück, nach links = vorwärts bis zur aktuellen
export function rueckblickWischen(app, richtung) {
  const { setQuiz } = app;
    setQuiz(prev => {
      const n = prev?.rueckblick?.length || 0;
      if (!n || !["eingabe", "aufgedeckt", "weitere", "richtig"].includes(prev.phase) || prev.flash || prev.karteNeinFlash) return prev;
      const akt = prev.rueckIdx ?? n, ziel = Math.max(0, Math.min(n, akt + richtung));
      return ziel === akt ? prev : { ...prev, rueckIdx: ziel >= n ? null : ziel };
    });
  }

export function naechsteVokabel(app) {
  const { flashTimerRef, flashWeiterRef, naechsteVokabelState, quiz, setQuiz, weiterNachSpalte } = app;
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // Auch nach falscher/aufgedeckter Spalte die restlichen Spalten abfragen
    flashWeiterRef.current = null;
    if (quiz.phase === "aufgedeckt") {
      setQuiz(prev => weiterNachSpalte(prev, !!prev.richtigAufgedeckt));
    } else {
      setQuiz(prev => naechsteVokabelState(prev));
    }
  }

// Zwischenkarte "Wiederholung": weiter zu den zu wiederholenden Vokabeln oder direkt zur Auswertung
export function starteWiederholung(app) {
  const { mitZuordnungMix, setQuiz } = app;
    setQuiz(prev => prev?.phase === "wiederholungHinweis" ? mitZuordnungMix({...prev, phase: "eingabe"}) : prev);
  }

export function brecheWiederholungAb(app) {
  const { flashTimerRef, setQuiz } = app;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => prev?.phase === "wiederholungHinweis" || prev?.wiederholungDurchgang
      ? {...prev, phase: "fertig", flash: false} : prev);
  }

// Akzent-Modus: Auswahl gehört zu genau einer Vokabel-Spalte (Schlüssel), sonst Neustart mit Grundbuchstaben
export function akzentStand(app, q) {
  const {  } = app;
    const typ = q.antwortTypen[q.antwortTypIndex];
    const vok = q.vokabeln[q.index];
    const key = `${vok?.id}|${q.antwortTypIndex}|${q.abfrageZiel?.runde || 0}|${q.wiederholungDurchgang || 0}`;
    const kacheln = akzentKacheln(ersteAlt(ohneHinweis(vok?.[typ]?.wert || "")));
    const a = q.akzent?.key === key ? q.akzent : null;
    return { key, typ, kacheln, wahl: a ? a.wahl : kacheln.map(k => k.basis), aktiv: a ? a.aktiv : null,
      geprueft: !!a?.geprueft, fehler: !!a?.fehler, blink: a ? a.blink : null, pruefFehler: !!a?.pruefFehler };
  }

// Fehlgriff: Kachel kurz rot aufleuchten lassen; zählt wie ein Fehlklick bei MC (Vokabel gilt als nicht gewusst)
export function akzentFehlgriff(app, s, i, extra = {}) {
  const { akzentBlinkRef, setQuiz } = app;
    if (akzentBlinkRef.current) clearTimeout(akzentBlinkRef.current);
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl: s.wahl, aktiv: null, fehler: true, blink: i, pruefFehler: s.pruefFehler, ...extra }}));
    akzentBlinkRef.current = setTimeout(() => {
      setQuiz(prev => prev?.akzent?.key === s.key ? {...prev, akzent: {...prev.akzent, blink: null}} : prev);
    }, 600);
  }

export function waehleAkzentKachel(app, i) {
  const { akzentFehlgriff, akzentStand, kachelMitAkzent, quiz, quizRegeln, setQuiz } = app;
    if (!quiz || quiz.phase !== "eingabe") return;
    const s = akzentStand(quiz);
    const k = s.kacheln[i];
    if (s.wahl[i] === k.richtig && kachelMitAkzent(k)) return;   // schon richtig gesetzt
    // Akzent-Buchstaben hervorgehoben → Fehlgriff nur anzeigen, nicht als Fehler werten
    if (!kachelMitAkzent(k)) { akzentFehlgriff(s, i, quizRegeln().akzentHervorheben ? { fehler: s.fehler } : {}); return; }
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl: s.wahl, fehler: s.fehler, blink: null, pruefFehler: s.pruefFehler, aktiv: s.aktiv === i ? null : i }}));
  }

export function setzeAkzentVariante(app, v) {
  const { akzentFehlgriff, akzentStand, quiz, quizRegeln, schliesseAkzenteAb, setQuiz } = app;
    if (!quiz || quiz.phase !== "eingabe") return;
    const s = akzentStand(quiz);
    const i = s.aktiv;
    if (i == null) return;
    if (v !== s.kacheln[i].richtig) { akzentFehlgriff(s, i); return; }
    const wahl = [...s.wahl];
    wahl[i] = v;
    if (LIGATUR_TEILE[v]) wahl[i + 1] = "";
    // Alle Akzente gefunden → automatisch als Antwort übernehmen (falls in der Stufe eingestellt)
    if (quizRegeln().akzentAutoUebernahme && s.kacheln.every((k, j) => wahl[j] === k.richtig)) { schliesseAkzenteAb({ ...s, wahl }); return; }
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl, aktiv: null, fehler: s.fehler, blink: null, pruefFehler: s.pruefFehler }}));
  }

export function schliesseAkzenteAb(app, s) {
  const { flashTimerRef, quiz, setQuiz, sofortWeiter, spaltenAbschluss, weiterNachSpalte } = app;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const komplett = s.kacheln.every((k, i) => s.wahl[i] === k.richtig);
    const richtig = komplett && !s.fehler;
    const abschluss = spaltenAbschluss(richtig ? "richtig" : "falsch");
    if (richtig && sofortWeiter(quiz)) { setQuiz(prev => weiterNachSpalte({...prev, ...abschluss}, true)); return; }
    setQuiz(prev => ({...prev, ...abschluss, akzent: { key: s.key, wahl: s.wahl, aktiv: null, geprueft: true, fehler: s.fehler, blink: null },
      // richtig gelöst → Karte grün, auch nach Fehlgriff (zählt dann trotzdem als nicht gewusst, Hinweis rot)
      eingabe: "", phase: "aufgedeckt", flash: false, richtigAufgedeckt: komplett,
      feedback: richtig ? "" : komplett ? "Nicht fehlerfrei – richtig gelöst, zählt aber als nicht gewusst."
        : "Nicht ganz – rot markierte Buchstaben fehlen noch.", falschFlash: false, aktuelleFehlversuche: 0}));
  }

// Prüfen: vollständig → abschließen; sonst fehlende Akzente rot markieren, korrigieren oder Lösung anzeigen
export function pruefeAkzente(app) {
  const { akzentStand, quiz, schliesseAkzenteAb, setQuiz } = app;
    if (!quiz || quiz.phase !== "eingabe") return;
    const s = akzentStand(quiz);
    if (s.kacheln.every((k, i) => s.wahl[i] === k.richtig)) { schliesseAkzenteAb(s); return; }
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl: s.wahl, aktiv: null, fehler: true, blink: null, pruefFehler: true },
      feedback: "Nicht ganz – rot markierte Buchstaben korrigieren oder „Lösung anzeigen“."}));
  }

export function deckeKarteAuf(app) {
  const { quiz, setQuiz } = app;
    if (!quiz || quiz.phase !== "eingabe") return;
    const typ = quiz.antwortTypen?.[quiz.antwortTypIndex];
    if ((quiz.spalteModus?.[typ] || STANDARD_ANTWORT_MODUS) !== "karte") return;
    setQuiz(prev => ({...prev, phase: "aufgedeckt", eingabe: "", flash: false, feedback: ""}));
  }

// Mehrere Spalten: aufgedeckte Karte (nicht die letzte) → „Weiter“ ohne Pause; die nächste Karten-Spalte erscheint gleich aufgedeckt
export function karteWeiter(app) {
  const { flashTimerRef, flashWeiterRef, quiz, setQuiz, weiterNachSpalte } = app;
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashWeiterRef.current = null;
    setQuiz(prev => {
      const n = weiterNachSpalte({ ...prev, spaltenErgebnisse: { ...(prev.spaltenErgebnisse || {}), [prev.antwortTypIndex]: "karte" } }, null);
      const nt = n.antwortTypen?.[n.antwortTypIndex];
      return n.index === prev.index && n.antwortTypIndex === prev.antwortTypIndex + 1 && (n.spalteModus?.[nt] || STANDARD_ANTWORT_MODUS) === "karte"
        ? { ...n, phase: "aufgedeckt" } : n;
    });
  }

export function bewerteKarte(app, gewusst) {
  const { flashTimerRef, mitFlash, mitVerzoegerung, quiz, setQuiz, spaltenAbschluss, weiterNachSpalte } = app;
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const urteil = gewusst ? "richtig" : "falsch";
    if (quiz.karteBewertungOffen) {   // letzte Spalte schon beantwortet (z. B. Tastatur): das Urteil gilt für die Karten-Spalten
      const abschluss = spaltenAbschluss(quiz.spaltenErgebnisse?.[quiz.antwortTypIndex] || "richtig", urteil);
      setQuiz(prev => weiterNachSpalte({ ...prev, ...abschluss }, !!prev.richtigAufgedeckt));
      return;
    }
    const abschluss = spaltenAbschluss(urteil, urteil);

    if (gewusst) mitFlash(abschluss, prev => weiterNachSpalte(prev, true));
    else mitVerzoegerung({...abschluss, karteNeinFlash: true}, prev => weiterNachSpalte(prev, false), 800);
  }

export function pruefeDiktatAntwort(app) {
  const { aktiveListeId, blitzKey, einstellungen, quiz, quizRegeln, setQuiz } = app;
    if (!quiz || !quiz.eingabe.trim()) return;
    const aktVok = quiz.vokabeln[quiz.index];
    const wort = aktVok[quiz.diktatSpalte]?.wert || "";
    const treffer = istRichtigeAntwort(quiz.eingabe.trim(), wort, quizRegeln().akzenteTolerant || (quiz.diktatSpalte?.startsWith("E") && !AKZENTE_FUER_LISTE(aktVok._listeId ?? aktiveListeId)));
    const diktatVersuche = [...(quiz.diktatVersuche || []), quiz.eingabe.trim()];   // 175
    const diktatWertung = { vorher: { diktatFortschritt: aktVok.diktatFortschritt }, falschAbzug: true };
    if (treffer) {
      const neuFortschritt = berechneDiktatScore(aktVok.diktatFortschritt, "richtig");
      const neueListe = speichereDiktatScore(quiz.liste, aktVok.id, neuFortschritt);
      const schwelle = einstellungen.gelerntSchwelle ?? 0;
      const gelerntBlitz = schwelle > 0 && (aktVok.diktatFortschritt?.score ?? -Infinity) < schwelle && neuFortschritt.score >= schwelle ? blitzKey(quiz) : null;
      const ergebnis = { vokId: aktVok.id, wort, uebersetzung: aktVok[quiz.diktatUeberspalte]?.wert, richtig: true };
      setQuiz(prev => ({
        ...prev, liste: neueListe, eingabe: "", phase: "richtig", flash: false, ...(gelerntBlitz ? { gelerntBlitz } : {}),
        diktatVersuche, diktatWertung: { ...diktatWertung, diktat: "richtig" }, diktatIdx: prev.diktatErgebnisse.length,
        diktatErgebnisse: [...prev.diktatErgebnisse, ergebnis], feedback: treffer === "akzent" ? AKZENT_HINWEIS : "",
      }));
    } else {
      setQuiz(prev => ({
        ...prev, eingabe: "", diktatVersuche,
        diktatAufgedeckt: Math.min((prev.diktatAufgedeckt || 0) + 1, ohneHinweis(wort).length),
        feedback: "Nicht richtig – ein Buchstabe mehr aufgedeckt.",
      }));
    }
  }

export function zeigeDiktatLoesung(app) {
  const { flashTimerRef, quiz, quizRegeln, setQuiz } = app;
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const aktVok = quiz.vokabeln[quiz.index];
    const neuFortschritt = berechneDiktatScore(aktVok.diktatFortschritt, "aufgedeckt", quizRegeln().falschAbzug);
    const neueListe = speichereDiktatScore(quiz.liste, aktVok.id, neuFortschritt);
    const wort = aktVok[quiz.diktatSpalte]?.wert || "";
    const diktatWertung = { vorher: { diktatFortschritt: aktVok.diktatFortschritt }, falschAbzug: quizRegeln().falschAbzug, diktat: "aufgedeckt" };   // 175
    const ergebnis = { vokId: aktVok.id, wort, uebersetzung: aktVok[quiz.diktatUeberspalte]?.wert, richtig: false };
    setQuiz(prev => ({
      ...prev, liste: neueListe, eingabe: "", phase: "aufgedeckt", flash: false,
      diktatAufgedeckt: ohneHinweis(wort).length, diktatWertung, diktatIdx: prev.diktatErgebnisse.length,
      diktatErgebnisse: [...prev.diktatErgebnisse, ergebnis],
      feedback: "",
    }));
  }

export function naechsteDiktatVokabel(app) {
  const { diktatPlayCountRef, flashTimerRef, quiz, setDiktatManualPlays, setQuiz } = app;
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    diktatPlayCountRef.current = 0;
    setDiktatManualPlays(0);
    setQuiz(prev0 => {
      // 175: beantwortete Diktat-Vokabel in den Rückblick
      const v = prev0.vokabeln[prev0.index], w = prev0.diktatWertung;
      const sp = t => prev0.liste.spalten[t]?.name || t;
      const prev = { ...prev0, diktatWertung: null, diktatVersuche: [], rueckIdx: null,
        rueckblick: v && w ? [...(prev0.rueckblick || []), { art: "diktat", vokId: v.id, diktatIdx: prev0.diktatIdx,
          frage: { typ: prev0.diktatUeberspalte, label: sp(prev0.diktatUeberspalte), wert: v[prev0.diktatUeberspalte]?.wert || "" },
          antworten: [{ typ: prev0.diktatSpalte, label: sp(prev0.diktatSpalte), wert: v[prev0.diktatSpalte]?.wert || "", richtig: w.diktat === "richtig", eingaben: prev0.diktatVersuche || [] }],
          ergebnis: w.diktat === "richtig" ? "richtig" : "falsch", wertung: w, zaehlt: true }] : (prev0.rueckblick || []) };
      const naechsterIdx = prev.index + 1;
      if (naechsterIdx >= prev.vokabeln.length) return { ...prev, phase: "fertig" };
      return { ...prev, index: naechsterIdx, eingabe: "", diktatAufgedeckt: 0, phase: "eingabe", feedback: "" };
    });
  }

export function sprichDiktatNochmal(app, text, lang) {
  const { diktatPlayCountRef, setDiktatManualPlays } = app;
    if (!window.speechSynthesis) return;
    const langCode = lang.split('-')[0].toLowerCase();
    // Novelty/effects Stimmen aussortieren (iOS/macOS); die gewählte Stimme kommt zuerst
    const alle = aktiveStimmen(langCode).length ? aktiveStimmen(langCode) : stimmenFuerSprache(langCode), gew = gewaehlteStimme(langCode);
    const voices = gew ? [gew, ...alle.filter(v => v !== gew)] : alle;
    diktatPlayCountRef.current += 1;
    setDiktatManualPlays(p => p + 1);
    window.speechSynthesis.cancel();
    // Stimme wechselt alle 2 Plays: 0,0,1,1,2,2,… – immer eine Stimme der richtigen Sprache
    const stimme = voices.length > 1 ? voices[Math.floor(diktatPlayCountRef.current / 2) % voices.length] : null;
    window.speechSynthesis.speak(aeusserung(text.split('/')[0].trim(), lang, stimme));
  }

export function geheZurueck(app) {
  const { flashTimerRef, quiz, setQuiz } = app;
    if (!quiz || quiz.antwortTypIndex <= 0) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => {
      const naechsterIdx = prev.antwortTypIndex - 1;
      const nt = prev.antwortTypen[naechsterIdx];
      const teile = prev.vokabeln[prev.index][nt]?.wert.split('/').map(s => s.trim()) || [];
      const mc = prev.antwortModus === "mc"
        ? generiereButtons(prev.vokabeln, prev.vokabeln[prev.index], nt) : null;
      return {
        ...prev, flash: false, phase: "eingabe", eingabe: "",
        antwortTypIndex: naechsterIdx, antwortTeile: teile,
        weitereIndices: [], weiterePos: 0,
        vorigeAntworten: prev.vorigeAntworten.slice(0, -1),
        mcButtons: mc?.buttons || prev.mcButtons,
        mcRichtig: mc?.richtig || prev.mcRichtig,
        feedback: "",
      };
    });
  }
