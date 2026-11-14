import { SPRACHEN, erkenneSprache, listeSprache } from "../sprache.js";
import { SK, TYPEN, ergaenzeSpalten, erstelleSicherung, istSicherung, leseDateiAlsText, lsGet, lsSet, neueListeObjekt, stelleSicherungWiederHer } from "../speicher.js";
import { SPALTEN_TAG, dateiVorschau, findeJsonListen, parseKopfZeile, parseZeile } from "../importexport.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

// ── Import-Aktionen ───────────────────────────────────────────────────────
export function resetImport(app) {
  const { neuListePlatzRef, setImportBestehendId, setImportDateiname, setImportFehler, setImportJsonData, setImportMapping, setImportMehrfachListen, setImportNeuName, setImportNeuerOrdner, setImportParsed, setImportText, setImportZielTyp } = app;
    setImportNeuerOrdner(null); neuListePlatzRef.current = null;
    setImportText(""); setImportDateiname(""); setImportParsed(null);
    setImportMehrfachListen(null); setImportJsonData(null); setImportMapping({});
    setImportZielTyp("neu"); setImportNeuName(""); setImportBestehendId(""); setImportFehler("");
  }

export function autoMappeKolumnen(app, headerNamen) {
  const {  } = app;
    const VALID = new Set(TYPEN);
    const mapping = {};
    const used = new Set();
    // Pass 1: extract [TYPE] tags from header names (reliable, from our own export)
    headerNamen.forEach((name, idx) => {
      const m = name.match(/\[([EDi][123])\]\s*$/);
      if (m && VALID.has(m[1]) && !used.has(m[1])) {
        mapping[idx] = m[1];
        used.add(m[1]);
      } else {
        mapping[idx] = null;
      }
    });
    // Pass 2 (fallback for files without tags): keyword detection
    if (used.size === 0) {
      const eKeys = SPRACHEN.flatMap(s => s.keys);
      const dKeys = ['deutsch', 'german'];
      let eCount = 0, dCount = 0, iCount = 0;
      headerNamen.forEach((name, idx) => {
        const low = name.toLowerCase().trim();
        if (eKeys.some(k => low.includes(k)) && eCount < 3) mapping[idx] = ['E1','E2','E3'][eCount++];
        else if (dKeys.some(k => low.includes(k)) && dCount < 2) mapping[idx] = ['D1','D2'][dCount++];
        else if (iCount < 2) mapping[idx] = ['i1','i2'][iCount++];
      });
      if (eCount === 0 && dCount === 0) {
        const pos = ['E1','D1','i1','E2','D2','i2','E3'];
        headerNamen.forEach((_, idx) => { mapping[idx] = pos[idx] ?? null; });
      }
    }
    return mapping;
  }

export function analysiereImport(app) {
  const { autoMappeKolumnen, importNeuName, importText, setImportFehler, setImportJsonData, setImportMapping, setImportMehrfachListen, setImportNeuName, setImportParsed, setImportSprache, setImportText, sprachFilter } = app;
    const normiert = importText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Eingefügtes JSON-Backup (z. B. aus der Zwischenablage) direkt als Backup übernehmen
    try {
      const listen = findeJsonListen(normiert);
      if (listen) {
        if (!listen.length) { setImportFehler("Keine Vokabellisten im JSON gefunden."); return; }
        setImportJsonData(listen); setImportText(""); setImportFehler(""); return;
      }
    } catch { setImportFehler(`JSON-Backup ist beschädigt. Anfang: ${dateiVorschau(normiert)}`); return; }
    const alleZeilen = normiert.trim().split('\n').filter(z => z.trim());
    if (alleZeilen.length < 2) {
      setImportFehler(`Nur ${alleZeilen.length} Zeile${alleZeilen.length === 1 ? "" : "n"} erkannt – nötig sind eine Kopfzeile und mindestens eine Vokabel. Anfang: ${dateiVorschau(normiert)}. Dateien bitte über „📄 Datei“ laden.`);
      return;
    }

    // Namenszeile "# Name {fr}" (eigener TXT-Export) → Sprache
    const parseNamensZeile = z => {
      const m = z.slice(2).trim().match(/^(.*?)\s*\{([a-z]{2})\}$/);
      return m && SPRACHEN.some(s => s.code === m[2]) ? { name: m[1], sprache: m[2] } : { name: z.slice(2).trim(), sprache: null };
    };
    const standardSprache = sprachFilter === "alle" ? "en" : sprachFilter;

    const hashIdx = alleZeilen.reduce((acc, z, i) => z.startsWith('# ') ? [...acc, i] : acc, []);
    if (hashIdx.length > 1) {
      const sektionen = hashIdx.map((startIdx, si) => {
        const endIdx = hashIdx[si + 1] ?? alleZeilen.length;
        const sz = alleZeilen.slice(startIdx, endIdx);
        const { name, sprache } = parseNamensZeile(sz[0]);
        const rest = sz.slice(1);
        if (rest.length < 2) return null;
        const header = parseKopfZeile(rest[0]);
        const daten = rest.slice(1).map(parseZeile);
        const mapping = autoMappeKolumnen(header.map(h => h.wert));
        return { name, header, daten, mapping, sprache: sprache || erkenneSprache(header.map(h => h.wert)) };
      }).filter(Boolean);
      if (!sektionen.length) { setImportFehler("Keine gültigen Listen gefunden."); return; }
      setImportSprache(standardSprache);
      setImportMehrfachListen(sektionen);
      setImportParsed(null);
      setImportFehler("");
      return;
    }

    setImportMehrfachListen(null);
    let zeilen = alleZeilen;
    let erkannterName = '';
    let erkannteSprache = null;
    if (zeilen[0].startsWith('# ')) {
      ({ name: erkannterName, sprache: erkannteSprache } = parseNamensZeile(zeilen[0]));
      zeilen = zeilen.slice(1);
      if (zeilen.length < 2) { setImportFehler("Mindestens 2 Zeilen erforderlich."); return; }
    }
    const header = parseKopfZeile(zeilen[0]);
    setImportSprache(erkannteSprache || erkenneSprache(header.map(h => h.wert)) || standardSprache);
    const daten = zeilen.slice(1).map(parseZeile);
    // Mit Spalten-Kennungen (eigener Export) direkt zuordnen, sonst manuell
    const hatTags = header.some(h => SPALTEN_TAG.test(h.wert));
    const mapping = hatTags ? autoMappeKolumnen(header.map(h => h.wert)) : {};
    if (!hatTags) header.forEach((_, i) => { mapping[i] = null; });
    setImportParsed({ header, daten });
    setImportMapping(mapping);
    if (erkannterName && !importNeuName) setImportNeuName(erkannterName);
    setImportFehler("");
  }

export function importiereAlleListen(app) {
  const { importMehrfachListen, importSprache, importZielOrdner, listenIndex, resetImport, setAnsicht, setListenOrdnerOffen, speichereIndex } = app;
    if (!importMehrfachListen?.length) return;
    const neuerIndex = [...listenIndex];
    const ziel = importZielOrdner();   // 195
    let n = 0;
    for (const s of importMehrfachListen) {
      const abfragbar = Object.values(s.mapping).filter(t => t && !t.startsWith('i'));
      if (abfragbar.length < 2) continue;
      const id = "liste_" + Date.now() + "_" + n;
      const liste = neueListeObjekt(id, s.name || `Import ${n + 1}`);
      liste.sprache = s.sprache || importSprache;
      s.header.forEach((h, i) => {
        const typ = s.mapping[i];
        if (typ) liste.spalten[typ] = { name: h.wert.replace(/\s*\[[EDi][123]\]\s*$/, '').trim(), aktiv: true };
      });
      s.daten.forEach(zeile => {
        const vok = { id: liste.naechste_id++ };
        Object.entries(s.mapping).forEach(([idx, typ]) => {
          if (typ && zeile[Number(idx)]) vok[typ] = { wert: zeile[Number(idx)].wert, falsch: zeile[Number(idx)].falsch };
        });
        liste.vokabeln.push(vok);
      });
      lsSet(SK.liste(id), liste);
      neuerIndex.push({ id, name: liste.name, sprache: liste.sprache, ...(ziel.id ? { ordner: ziel.id } : {}) });
      n++;
    }
    speichereIndex(neuerIndex, undefined, ziel.ordner);
    if (ziel.id) setListenOrdnerOffen(ziel.id);
    resetImport();
    setAnsicht("uebersicht");
  }

export function importiereAusJsonDaten(app) {
  const { importJsonData, importZielOrdner, listenIndex, resetImport, setAnsicht, setListenOrdnerOffen, speichereIndex } = app;
    if (!importJsonData?.length) return;
    const neuerIndex = [...listenIndex];
    const ziel = importZielOrdner();   // 195
    importJsonData.forEach((l, i) => {
      const id = "liste_" + Date.now() + "_j" + i;
      const liste = ergaenzeSpalten({ ...l, id, sprache: listeSprache(l) });
      lsSet(SK.liste(id), liste);
      neuerIndex.push({ id, name: liste.name, sprache: liste.sprache, ...(ziel.id ? { ordner: ziel.id } : {}) });
    });
    speichereIndex(neuerIndex, undefined, ziel.ordner);
    if (ziel.id) setListenOrdnerOffen(ziel.id);
    resetImport();
    setAnsicht("uebersicht");
  }

// Einstellungen: Bereiche mit Kopfzeile, immer nur einer offen; der geöffnete rückt unter die Kopfleiste, falls er oben verschwunden ist
export function schalteEinstBereich(app, key) {
  const { einstBereich, headerH, setEinstBereich, setEinstUnter, setInfoModus } = app;
    const neu = einstBereich === key ? null : key;
    setEinstBereich(neu); setEinstUnter(null);
    if (neu === "info") setInfoModus("uebersicht");
    if (neu) requestAnimationFrame(() => {
      const el = document.querySelector(`[data-einst-kopf="${neu}"]`);
      if (el && el.getBoundingClientRect().top < headerH) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerH - 8 });
    });
  }

// Gesamtsicherung als Datei (Vorschlag „Vokabel-App Sicherung JJJJ-MM-TT“, Name änderbar)
export function sichereAlles(app) {
  const { oeffneDateiExport, sicherungStandardName } = app; oeffneDateiExport({ art: "sicherung" }, sicherungStandardName()); }

export function speichereSicherung(app, dateiname) {
  const { setLetzteSicherung, teileAlsDatei } = app;
    const sich = erstelleSicherung();
    teileAlsDatei(JSON.stringify(sich), dateiname);
    lsSet(SK.letzteSicherung, sich.erstellt); setLetzteSicherung(sich.erstellt);
  }

export async function ladeSicherungsDatei(app, file) {
  const { setSicherungFehler, setSicherungLaden } = app;
    setSicherungFehler(""); setSicherungLaden(null);
    let obj = null;
    try { const t = (await leseDateiAlsText(file)).replace(/^[\uFEFF\u200B\s]+/, ""); obj = JSON.parse(t); } catch { /* unten */ }
    if (istSicherung(obj)) { setSicherungLaden(obj); return; }
    setSicherungFehler(`„${file.name}“ ist keine Gesamtsicherung. Einzelne Listen bitte über Listen → Import laden.`);
  }

export function bestaetigeWiederherstellen(app, sich) {
  const {  } = app;
    stelleSicherungWiederHer(sich);
    window.location.reload();
  }

export function exportiereAlsJson(app, ids) {
  const { exportStandardName, setExportName, setJsonExportIds, setModal } = app;
    setJsonExportIds(ids);
    setExportName(exportStandardName(ids, "JSON"));
    setModal("json-export");
  }

export function exportiereAlsJsonBestaetigt(app) {
  const { dateiName, exportName, exportStandardName, jsonExportIds, jsonExportOptionen, setJsonExportIds, setModal, teileAlsDatei } = app;
    const listen = jsonExportIds.map(id => lsGet(SK.liste(id))).filter(Boolean);
    const gefiltert = listen.map(liste => {
      const l = { ...liste };
      l.vokabeln = liste.vokabeln.map(vok => {
        const v = { ...vok };
        TYPEN.forEach(typ => {
          if (v[typ]) v[typ] = { wert: v[typ].wert, falsch: jsonExportOptionen.falsch ? (v[typ].falsch || []) : [] };
        });
        if (!jsonExportOptionen.fortschritt) delete v.fortschritt;
        if (!jsonExportOptionen.diktatFortschritt) delete v.diktatFortschritt;
        if (!jsonExportOptionen.akzentFortschritt) delete v.akzentFortschritt;
        return v;
      });
      return l;
    });
    const text = JSON.stringify(gefiltert, null, 2);
    const name = dateiName(exportName, exportStandardName(jsonExportIds, "JSON"));
    setModal(null); setJsonExportIds(null);
    teileAlsDatei(text, name);
  }

export function setzeMapping(app, colIndex, typ) {
  const { setImportMapping } = app;
    setImportMapping(prev => {
      const war = prev[colIndex];
      const neu = { ...prev };
      Object.keys(neu).forEach(k => { if (neu[k] === typ) neu[k] = null; });
      neu[colIndex] = war === typ ? null : typ;
      return neu;
    });
  }

export function getBestehendeListe(app) {
  const { importBestehendId } = app;
    if (!importBestehendId) return null;
    return lsGet(SK.liste(importBestehendId));
  }

// Gibt die Ziel-Optionen für bestehende Liste zurück:
// aktive Spalten (by name) + freie Slots (als "Neu: typ")
export function getBestehendZielOptionen(app, bl) {
  const {  } = app;
    if (!bl) return [];
    return TYPEN.map(typ => ({
      typ,
      label: bl.spalten[typ].aktiv ? bl.spalten[typ].name || typ : null,
      neu: !bl.spalten[typ].aktiv,
    }));
  }

export function fuehreImportDurch(app) {
  const { getBestehendeListe, imListenOrdner, importBestehendId, importMapping, importNeuName, importParsed, importSprache, importZielTyp, listenIndex, resetImport, setAnsicht, setImportFehler, speichereIndex } = app;
    const abfragbar = Object.values(importMapping).filter(t => t && !t.startsWith('i'));
    if (abfragbar.length < 2) { setImportFehler("Mindestens 2 abfragbare Spalten müssen zugewiesen sein."); return; }

    const istBestehend = importZielTyp === "bestehend";
    const bl = istBestehend ? getBestehendeListe() : null;

    function bauVokabeln(liste) {
      importParsed.daten.forEach(zeile => {
        const vok = { id: liste.naechste_id++ };
        Object.entries(importMapping).forEach(([idx, typ]) => {
          if (typ && zeile[Number(idx)]) vok[typ] = { wert: zeile[Number(idx)].wert, falsch: zeile[Number(idx)].falsch };
        });
        liste.vokabeln.push(vok);
      });
    }

    function aktualisiereSpaltennamen(liste) {
      Object.entries(importMapping).forEach(([idx, typ]) => {
        if (!typ) return;
        if (istBestehend && bl && bl.spalten[typ].aktiv) {
          // Bestehende Spalte: Name bleibt
          if (!liste.spalten[typ].aktiv) liste.spalten[typ] = { name: bl.spalten[typ].name, aktiv: true };
        } else {
          // Neue Spalte: Import-Header-Name
          liste.spalten[typ] = { name: importParsed.header[Number(idx)].wert.replace(/\s*\[[EDi][123]\]\s*$/, '').trim(), aktiv: true };
        }
      });
    }

    if (istBestehend) {
      if (!importBestehendId) { setImportFehler("Bitte eine Liste auswählen."); return; }
      const liste = lsGet(SK.liste(importBestehendId));
      if (!liste) { setImportFehler("Liste nicht gefunden."); return; }
      aktualisiereSpaltennamen(liste);
      bauVokabeln(liste);
      lsSet(SK.liste(importBestehendId), liste);
    } else {
      const name = importNeuName.trim();
      if (!name) { setImportFehler("Bitte einen Namen eingeben."); return; }
      if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) { setImportFehler("Name bereits vorhanden."); return; }
      const id = "liste_" + Date.now();
      const liste = { ...neueListeObjekt(id, name), sprache: importSprache };
      aktualisiereSpaltennamen(liste);
      bauVokabeln(liste);
      lsSet(SK.liste(id), liste);
      speichereIndex([...listenIndex, { id, name, sprache: importSprache, ...imListenOrdner() }]);
    }
    resetImport();
    setAnsicht("uebersicht");
  }
