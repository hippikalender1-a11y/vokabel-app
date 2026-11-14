import { F } from "./farben.js";
import { umbruch } from "./quiz.jsx";


export let CSS = "";
export function setzeCSS(wert) { CSS = wert; }   // die Komponente setzt den Wert neu
export const CSS_BASIS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--hintergrund);font-family:system-ui,sans-serif;color:var(--text-stark);}
  /* Kein Text-Markieren per Lang-Druck (kollidiert mit den Info-Texten); Eingabefelder bleiben markierbar */
  body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
  input,textarea,[contenteditable="true"]{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default;}
  .app{max-width:600px;margin:0 auto;padding:0 0 80px;}

  .topbar{background:var(--app-kopf);color:var(--app-kopf-schrift);border-bottom:1px solid var(--rahmen);padding:14px 16px;display:flex;align-items:center;gap:12px;}
  .topbar-title{font-size:1.05rem;font-weight:700;flex:1;text-align:center;}
  .klammer-hinweis{font-size:0.7em;font-weight:500;color:var(--text3);}
  .mc-raster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;}
  .mc-raster > button{min-height:72px;width:100%;overflow-wrap:anywhere;line-height:1.25;}
  .kopf-balken{display:block;height:5px;margin:5px auto 0;width:min(150px,80%);background:var(--flaeche);border-radius:3px;overflow:hidden;}
  .kopf-balken > span{display:block;height:100%;background:var(--haupt-hell);border-radius:3px;transition:width .3s;}
  .info-schalter{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;border:1.5px solid var(--haupt);background:var(--app-kopf);color:var(--haupt);font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-family:inherit;}
  body.info-modus .info-schalter{background:var(--haupt);color:var(--auf-haupt);}
  body.info-modus [data-info]{outline:1.5px dashed var(--haupt-hell) !important;outline-offset:2px;}
  @media (max-width:480px){.sprach-chip-name{display:none;}}
  .topbar-back{background:var(--haupt);color:var(--auf-haupt);font-size:0.88rem;font-weight:600;cursor:pointer;border:none;padding:8px 12px;border-radius:10px;font-family:inherit;transition:opacity .15s;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;}
  .topbar-back:active{opacity:.8;}
  .tabs{display:flex;background:var(--app-kopf);border-bottom:1px solid var(--rahmen);}
  .statistik-listen-header{background:var(--kopfzeile);color:var(--kopf-schrift);border-bottom:1px solid var(--rahmen);padding:10px 16px;display:flex;align-items:center;gap:8px;position:sticky;z-index:8;}
  :root{--liste-ecke:3px;}   /* 221: alles, was Listen betrifft, eckig; Quiz abgerundet */
  .eckig{border-radius:var(--liste-ecke) !important;}
  .liste-detail-header{background:var(--kopfzeile);color:var(--kopf-schrift);border-bottom:1px solid var(--rahmen);padding:12px 16px;display:flex;align-items:center;gap:10px;position:sticky;z-index:9;}
  .tab{flex:1;padding:12px 4px;font-size:0.82rem;font-weight:600;color:var(--app-kopf-schrift-leise);background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;}
  .tab.aktiv{color:var(--tab-aktiv);border-bottom-color:var(--tab-aktiv);}
  .sektion{padding:20px 16px 0;}
  .sektion-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .sektion-label{font-size:0.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text2);}
  .karte{background:var(--karte);border:1px solid var(--rahmen);border-radius:12px;overflow:hidden;margin-bottom:16px;}
  .karte-zeile{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--rahmen);gap:12px;}
  .karte-zeile:last-child{border-bottom:none;}
  .karte-zeile-info{flex:1;min-width:0;}
  .karte-zeile-name{font-weight:600;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .karte-zeile-sub{font-size:0.78rem;color:var(--text2);margin-top:2px;}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 18px;border-radius:10px;font-size:0.88rem;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s;}
  .btn:active{opacity:.8;}
  .btn-primary{background:var(--haupt);color:var(--auf-haupt);border:1.5px solid transparent;}
  .btn-primary.start-knopf{background:var(--bestaetigen);color:var(--auf-bestaetigen);border-color:var(--bestaetigen);}
  .btn-ghost{background:transparent;color:var(--haupt);border:1.5px solid var(--haupt);}
  .btn-ghost-filled{background:var(--knopf);color:var(--haupt);border:1.5px solid var(--haupt);}
  .btn-sm{padding:6px 12px;font-size:0.8rem;min-height:30px;}
  .btn-danger{background:transparent;color:var(--falsch);border:1.5px solid var(--falsch);}
  .btn-icon{background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;color:var(--text2);font-size:0.82rem;font-weight:600;}
  .btn-icon:hover{background:var(--flaeche);}
  .inp{width:100%;background:var(--knopf);border:1.5px solid var(--rahmen);border-radius:10px;padding:11px 14px;font-size:0.95rem;color:var(--text-stark);outline:none;font-family:inherit;}
  .inp:focus{border-color:var(--haupt);background:var(--karte);}
  .inp::placeholder{color:var(--text4);}
  @media (pointer:coarse){input,textarea,select{font-size:16px !important;}}
  textarea.inp{resize:vertical;font-family:monospace;font-size:0.82rem;line-height:1.5;}
  select.inp{cursor:pointer;}
  .inp-label{font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;display:block;}
  /* Fenster oben anzeigen, damit die Bildschirmtastatur sie nicht verdeckt */
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;z-index:100;padding:max(16px, env(safe-area-inset-top)) 16px 16px;overflow-y:auto;}
  .modal{background:var(--dialog);color:var(--dialog-schrift);border-radius:16px;width:100%;max-width:500px;padding:24px;margin-top:4vh;box-sizing:border-box;}
  .modal-titel{font-size:1.1rem;font-weight:700;margin-bottom:16px;}
  .modal-actions{display:flex;gap:10px;margin-top:20px;justify-content:flex-end;}
  .leer{text-align:center;padding:48px 24px;color:var(--text2);}
  .leer-text{font-size:0.9rem;line-height:1.5;margin-top:8px;}
  .jubel{text-align:center;padding:4px 0 18px;}
  .jubel-titel{font-size:2rem;font-weight:800;color:var(--haupt);line-height:1.2;animation:jubelPop .55s cubic-bezier(.2,1.6,.4,1) both;}
  .jubel-emoji{font-size:2.2rem;display:block;animation:jubelPop .55s .1s cubic-bezier(.2,1.6,.4,1) both;}
  .jubel-sub{font-size:0.9rem;color:var(--text2);margin-top:4px;}
  @keyframes jubelPop{0%{transform:scale(.3);opacity:0;}100%{transform:scale(1);opacity:1;}}
  .spalten-badge{font-size:0.68rem;font-weight:700;padding:1px 6px;border-radius:4px;background:var(--flaeche);color:var(--text3);margin-right:3px;}
  .spalten-badge.aktiv{background:var(--haupt-flaeche);color:var(--haupt);}
  .typ-btn{font-size:0.78rem;font-weight:600;padding:5px 10px;border-radius:6px;border:1.5px solid var(--rahmen);background:var(--knopf);color:var(--text2);cursor:pointer;font-family:inherit;}
  .typ-btn.aktiv{background:var(--haupt);color:var(--auf-haupt);border-color:var(--haupt);}
  .typ-btn:disabled{opacity:0.3;cursor:not-allowed;}
  .toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;}
  .toggle-row > :first-child:not(.toggle-btn){flex:1 1 auto;min-width:0;}
  .toggle-row > .toggle-btn{flex-shrink:0;}
  .toggle-row > .toggle-btn .toggle-opt{min-height:40px;padding:8px 16px;font-size:0.9rem;}
  .toggle-label{font-weight:600;font-size:0.9rem;}
  .toggle-sub{font-size:0.78rem;color:var(--text2);margin-top:2px;}
  .toggle-btn{display:flex;border-radius:8px;overflow:hidden;border:1.5px solid var(--rahmen);}
  .toggle-opt{padding:6px 14px;font-size:0.82rem;font-weight:600;background:none;border:none;cursor:pointer;color:var(--text2);font-family:inherit;}
  .toggle-opt.aktiv{background:var(--haupt);color:var(--auf-haupt);}
  /* Rechte Spalte der Kopfzeilen (Quiz/Statistik): alle Knöpfe so breit und hoch wie der Alle/Bereich-Schalter */
  .zeile-rechts{width:124px;height:31px;box-sizing:border-box;flex-shrink:0;}
  button.zeile-rechts{display:inline-block;padding:0 8px;line-height:31px;font-size:0.82rem;border-radius:8px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .toggle-btn.zeile-rechts .toggle-opt{flex:1 1 0;padding:0 4px;min-width:0;}
  .meldung-info{background:var(--info-flaeche);color:var(--info);border:1px solid var(--info-flaeche);padding:12px 16px;border-radius:10px;font-size:0.85rem;margin-bottom:16px;line-height:1.6;}
  .fehler{color:var(--falsch);font-size:0.82rem;margin-top:8px;margin-bottom:8px;}
  .fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:28px;background:var(--haupt);color:var(--auf-haupt);font-size:1.6rem;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:20;}
  .spalten-zuweisung{padding:14px 16px;border-bottom:1px solid var(--rahmen);}
  .spalten-zuweisung:last-child{border-bottom:none;}
  .typ-buttons{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}
  .import-kompakt{display:flex;align-items:center;gap:8px;margin-top:6px;}
  .import-beispiel{font-size:0.78rem;color:var(--text2);margin-top:3px;}
  .import-zaehler{font-size:0.82rem;color:var(--text2);margin-bottom:12px;}
  .import-zaehler strong{color:var(--haupt);}
  .slot-chip{padding:7px 13px;border-radius:8px;border:1.5px solid var(--rahmen);background:var(--knopf);font-size:0.78rem;font-weight:600;color:var(--text2);cursor:pointer;font-family:inherit;white-space:nowrap;}
  .slot-chip.belegt{background:var(--haupt-flaeche);border-color:var(--haupt);color:var(--haupt);}
  .slot-chip.verlauf{background:var(--karte);border-style:dashed;border-color:var(--text4);color:var(--text2);font-weight:500;}
  .slot-chip.zuletzt{background:var(--gelb-flaeche);border-color:var(--gelb);color:var(--orange);}
  .slot-chip.leer{opacity:0.35;cursor:default;}
  .slot-raster{display:grid;gap:6px;}
  .quiz-zeile{position:sticky;z-index:7;display:flex;gap:8px;background:var(--karte);border-bottom:1px solid var(--rahmen);padding:10px 16px;margin:0 -16px;}
  .quiz-zeile-zelle{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
  .quiz-zeile-zelle.schmal{flex:0 0 auto;}
  .quiz-zeile-label{font-size:0.66rem;font-weight:600;color:var(--text3);padding-left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.2px;}
  .quiz-zeile-knopf{flex:1 1 auto;min-height:40px;width:100%;min-width:0;padding:9px 6px;border-radius:10px;border:1.5px solid var(--haupt);background:var(--haupt);color:var(--auf-haupt);font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .quiz-zeile-knopf.zweizeilig{padding:4px 6px;line-height:1.2;}
  .quiz-zeile-knopf.umbruch{white-space:normal;line-height:1.2;padding:4px 6px;}
  .quiz-zeile-knopf .zeile1,.quiz-zeile-knopf .zeile2{display:block;overflow:hidden;text-overflow:ellipsis;}
  .quiz-zeile-knopf .zeile2{font-size:0.72rem;font-weight:600;opacity:0.85;}
  .quiz-zeile-knopf.offen{background:var(--bestaetigen);color:var(--auf-bestaetigen);border-color:var(--bestaetigen);font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.22);}
  .bestaetigen-knopf,.toggle-opt.bestaetigen-knopf,.quiz-zeile-knopf.bestaetigen-knopf{background:var(--bestaetigen);color:var(--auf-bestaetigen);border-color:var(--bestaetigen);font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.22);}
  .bestaetigen-knopf::before{content:"✓ ";}
  .leuchten,.toggle-opt.leuchten,.quiz-zeile-knopf.leuchten,.slot-chip.leuchten{background:var(--bestaetigen) !important;color:var(--auf-bestaetigen) !important;border-color:var(--bestaetigen) !important;}
  .leuchten .raster-name,.quiz-setup-check.leuchten > div > div,.leuchten .karte-zeile-name,.leuchten .karte-zeile-sub{color:inherit !important;}
  .quiz-zeile-knopf.zweizeilig.bestaetigen-knopf::before{content:none;}
  [data-modus-gruppen].mehrfach .spalten-modus-btn,.spalten-rolle-btn.mehrfach{border-style:dashed;}
  .wahl-hinweis{display:inline-block;padding:2px 6px;margin-left:-6px;border-radius:6px;}
  .nach-oben{position:fixed;right:max(16px, calc(50vw - 284px));bottom:calc(20px + env(safe-area-inset-bottom, 0px));z-index:30;width:46px;height:46px;border-radius:50%;border:none;background:var(--haupt);color:var(--auf-haupt);font-size:1.3rem;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,0.25);opacity:0.92;}
  .quiz-zeile-knopf[data-gelernte],.quiz-zeile-knopf[data-heute]{background:var(--haupt-flaeche);color:var(--haupt);border-color:var(--haupt);flex:0 0 auto;padding-left:12px;padding-right:12px;}
  .quiz-zeile-knopf[data-gelernte].an,.quiz-zeile-knopf[data-heute].an{background:var(--haupt);color:var(--auf-haupt);}
  .quiz-zeile-hinweis{font-size:0.75rem;color:var(--text3);text-align:center;padding:6px 0 0;}
  .umfang-raster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px;}
  .umfang-raster .typ-btn{min-height:48px;font-size:1.1rem;font-weight:800;}
  .start-arten{display:flex;justify-content:center;align-items:flex-start;gap:20px;margin:0 0 12px;}
  .start-art{background:none;border:none;padding:0;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-family:inherit;border-radius:50%;}
  .start-art:not(.aktiv){margin-top:19px;}
  .start-art.aktiv{cursor:default;border-radius:12px;}
  .start-art-name{font-size:0.75rem;font-weight:600;color:var(--text2);white-space:nowrap;}
  .start-titel{font-size:1.25rem;font-weight:800;color:var(--text-stark);text-align:center;margin:0 0 10px;}
  .start-bereich{background:var(--karte);padding:14px 16px;margin:0 -16px 8px;border-bottom:1px solid var(--rahmen);}
  .start-fortschritt{flex:0 0 auto;min-width:86px;border-radius:12px;border:1.5px solid var(--haupt-zart);background:var(--haupt-flaeche);color:var(--haupt);font-family:inherit;font-weight:800;font-size:1rem;cursor:pointer;}
  .start-fortschritt:disabled{cursor:default;opacity:0.7;}
  .btn-primary.start-knopf.leer{background:var(--haupt-flaeche);color:var(--haupt);border:1.5px solid var(--haupt-zart);box-shadow:none;}   /* 188: nichts abzufragen */
  .start-hinweis{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:31px;font-size:0.82rem;margin-top:10px;color:var(--text);}
  .start-knopf{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:10px 12px;min-height:58px;}
  .start-knopf b{font-size:1.1rem;font-weight:800;}
  .start-knopf span{font-size:0.85rem;font-weight:400;opacity:0.95;}
  .slot-kopf{position:sticky;z-index:9;background:var(--kopfzeile);color:var(--kopf-schrift);border-bottom:1px solid var(--rahmen);padding:10px 16px;}
  .slot-kopf.gruen{background:var(--haupt);border-bottom-color:var(--haupt);}
  .slot-kopf-name{flex:1;min-width:0;padding:7px 12px;font-size:0.95rem;border-radius:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;}
  .slot-kopf-name.toggle-opt.aktiv{background:var(--start);color:var(--auf-start);}
  .slot-kopf.gruen .slot-kopf-name{border:1.5px solid rgba(255,255,255,0.45);}
  .slot-kopf-name.toggle-opt.aktiv.bestaetigen-knopf{background:var(--bestaetigen);color:var(--auf-bestaetigen);}
  .slot-kopf-info{font-size:0.75rem;color:var(--kopf-schrift-leise);text-align:center;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .slot-kopf.gruen .slot-kopf-info{color:var(--auf-haupt);opacity:0.85;}
  .farbmodus-leiste{position:fixed;right:12px;bottom:12px;z-index:10002;display:flex;gap:6px;padding:6px 8px;background:var(--karte);border:1.5px solid var(--rahmen);border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:system-ui,sans-serif;}
  .farbfeld-hintergrund{position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,0.15);display:flex;align-items:flex-end;justify-content:center;}
  .farbfeld-hintergrund.oben{align-items:flex-start;}
  .farbfeld-hintergrund.oben .farbfeld{border-radius:0 0 16px 16px;padding:14px 16px 16px;box-shadow:0 6px 24px rgba(0,0,0,0.25);}
  .farbfeld{width:100%;max-width:520px;max-height:48vh;overflow-y:auto;background:var(--karte);border-radius:16px 16px 0 0;padding:14px 16px 70px;box-shadow:0 -6px 24px rgba(0,0,0,0.25);font-family:system-ui,sans-serif;box-sizing:border-box;}
  .farb-raster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
  .einst-kopf{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;margin:0 0 8px;background:var(--kopfzeile);border:1px solid var(--rahmen);border-radius:12px;font-family:inherit;font-size:0.95rem;font-weight:700;color:var(--kopf-schrift);cursor:pointer;text-align:left;}
  .einst-kopf.offen{background:var(--kopf-offen);border-color:var(--haupt-zart);color:var(--kopf-offen-schrift);}
  .einst-kopf-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
  .einst-kopf-sub{font-size:0.75rem;font-weight:400;color:var(--kopf-schrift-leise);}
  .einst-kopf-pfeil{font-size:0.9rem;color:var(--kopf-schrift-leise);flex:0 0 auto;}
  .einst-kopf.offen .einst-kopf-pfeil{color:var(--kopf-offen-schrift);}
  .einst-kopf.offen .einst-kopf-sub{color:var(--kopf-offen-schrift);opacity:0.8;}
  .einst-inhalt{margin-bottom:14px;}
  .ordner-kachel{border-width:2px;border-style:solid;margin:0 8px 8px 0;box-shadow:4px 4px 0 -2px var(--haupt-flaeche), 4px 4px 0 0 var(--haupt), 8px 8px 0 -2px var(--haupt-flaeche), 8px 8px 0 0 color-mix(in srgb, var(--haupt) 55%, transparent);}
  /* Ring über der Kachel (nicht unter dem Finger) */
  .gruppen-ring{position:absolute;left:50%;bottom:calc(100% + 4px);transform:translateX(-50%);width:46px;height:46px;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3));}
  [data-angehoben]{transform:scale(1.05);box-shadow:0 6px 16px rgba(0,0,0,0.25);z-index:4;transition:transform 0.12s, box-shadow 0.12s;}
  .gruppen-ring svg{width:46px;height:46px;transform:rotate(-90deg);}
  .gruppen-ring circle{fill:var(--karte);stroke:var(--haupt);stroke-width:3;stroke-dasharray:94.25;stroke-dashoffset:94.25;animation:gruppenRing 1.2s linear forwards;}
  .gruppen-ring.fertig circle{animation:none;stroke-dashoffset:0;fill:var(--haupt-flaeche);}
  .gruppen-ring span{position:absolute;font-size:1.05rem;opacity:0.35;}
  .gruppen-ring.fertig span{opacity:1;}
  @keyframes gruppenRing{to{stroke-dashoffset:0;}}
  .ordner-kachel.ordner-aktiv{outline:2px solid var(--haupt);outline-offset:1px;}
  .ordner-anzahl{font-weight:500;opacity:0.7;}
  .neue-session-knopf{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:12px;}
  .neue-session-wahl{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;border:1.5px solid var(--rahmen);border-radius:12px;background:var(--knopf);color:var(--text-stark);font-family:inherit;cursor:pointer;}
  .neue-session-wahl b{font-size:0.98rem;}
  .neue-session-wahl span{font-size:0.78rem;color:var(--text2);}
  .neue-session-wahl:hover{border-color:var(--haupt);}
  .einst-unterkopf{margin:18px 0 8px;}
  .einst-inhalt > .einst-unterkopf:first-child{margin-top:4px;}
  .einst-titel-knopf{background:none;border:none;padding:0;font-family:inherit;font-weight:700;font-size:0.88rem;color:var(--haupt);cursor:pointer;}
  .farb-kachel{display:flex;flex-direction:column;gap:6px;padding:6px;border:1.5px solid var(--rahmen);border-radius:10px;background:var(--karte);cursor:pointer;font-family:inherit;min-width:0;}
  .farb-kachel.aktiv{border-color:var(--haupt);box-shadow:0 0 0 2px var(--haupt);}
  .farb-streifen{display:flex;gap:3px;padding:5px;border-radius:7px;height:30px;box-sizing:border-box;}
  .farb-streifen > span{flex:1;border-radius:4px;border:1px solid rgba(0,0,0,0.08);}
  .farb-name{font-size:0.78rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .farb-zeile{display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--flaeche);cursor:pointer;}
  .farb-tupfer{width:42px;height:32px;border:1px solid var(--rahmen);border-radius:8px;flex-shrink:0;box-shadow:inset 0 0 0 2px var(--karte);}
  /* Farb-Werkzeuge (Farbmodus-Leiste, Farbfeld, Farbwähler, Namensfenster): feste Farben, unabhängig vom Schema – immer lesbar */
  [data-farbmodus-ui]{--karte:#ffffff;--dialog:#ffffff;--hintergrund:#f6f6f4;--flaeche:#eeeeec;--flaeche-hell:#f6f6f4;--knopf:#f4f4f2;--rahmen:#d2d2cc;--text-stark:#1a1a1a;--text:#2b2b2b;--text2:#5c5c58;--text3:#8a8a85;--text4:#b0b0aa;--dialog-schrift:#1a1a1a;--kopf-schrift:#1a1a1a;--haupt:#2d6a4f;--haupt-hell:#52b788;--auf-haupt:#ffffff;--haupt-flaeche:#e6f2ec;--haupt-zart:#a9d6c0;--falsch:#c0392b;--auf-falsch:#ffffff;--gelb:#f9a825;--gelb-flaeche:#fdf3d8;--info:#6a1b9a;color:#1a1a1a;}
  [data-farbmodus-ui] .btn.btn-primary{background:#2d6a4f !important;color:#fff !important;border-color:transparent !important;}
  [data-farbmodus-ui] .btn.btn-ghost{background:#fff !important;color:#2d6a4f !important;border-color:#2d6a4f !important;}
  [data-farbmodus-ui] .btn.btn-ghost-filled{background:#f4f4f2 !important;color:#2d6a4f !important;border-color:#2d6a4f !important;}
  [data-farbmodus-ui] .farbmodus-leiste,[data-farbmodus-ui] .farbfeld,[data-farbmodus-ui] .farbrad{background:#fff !important;color:#1a1a1a !important;}
  .farbrad-rahmen{position:fixed;left:0;right:0;bottom:0;z-index:10006;display:flex;justify-content:center;pointer-events:none;}
  .farbrad-rahmen.oben{bottom:auto;top:0;}
  .farbrad{pointer-events:auto;width:100%;max-width:520px;background:var(--karte);border-radius:16px 16px 0 0;padding:10px 14px 12px;box-shadow:0 -4px 22px rgba(0,0,0,0.28);font-family:system-ui,sans-serif;box-sizing:border-box;}
  .farbrad-rahmen.oben .farbrad{border-radius:0 0 16px 16px;box-shadow:0 4px 22px rgba(0,0,0,0.28);}
  .farbrad input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid rgba(0,0,0,0.5);box-shadow:0 1px 4px rgba(0,0,0,0.3);}
  .farb-zeile input[type=color]{width:42px;height:32px;border:1px solid var(--rahmen);border-radius:8px;padding:2px;background:var(--karte);flex-shrink:0;}
  .gelernt-blitz{animation:gelerntBlitz .4s ease-out;position:relative;}
  @keyframes gelerntBlitz{0%,40%{background:var(--gelernt-effekt);border-color:var(--gelernt-effekt);box-shadow:0 0 0 4px var(--gelernt-effekt),0 0 22px var(--gelernt-effekt);}100%{box-shadow:0 0 0 0 transparent;}}
  .gelernt-sterne{position:absolute;inset:0;pointer-events:none;z-index:3;}
  .gelernt-sterne .stern{position:absolute;left:50%;top:50%;color:var(--gelb);font-size:1.2rem;line-height:1;opacity:0;text-shadow:0 0 6px var(--gelernt-effekt);animation:sternFlug .75s ease-out forwards;animation-delay:var(--v);}
  @keyframes sternFlug{0%{opacity:1;transform:translate(-50%,-50%) rotate(var(--w)) translateX(40px) rotate(calc(-1 * var(--w))) scale(.5);}65%{opacity:1;}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--w)) translateX(var(--r)) rotate(calc(-1 * var(--w))) scale(1.15);}}
  .lernen-karte{position:relative;display:flex;flex-direction:column;justify-content:center;min-height:280px;padding:24px 16px;cursor:pointer;}
  .lernen-inhalt{display:flex;flex-direction:column;gap:8px;}
  .lernen-teil{opacity:0;transition:opacity .5s ease-out;}
  .lernen-teil.sichtbar{opacity:1;}
  .lernen-ein{animation:lernEin .5s ease-out;}
  @keyframes lernEin{from{opacity:0;}to{opacity:1;}}
  .lernen-pausiert{position:absolute;top:10px;right:14px;color:var(--text3);font-size:1.1rem;}
  .lernen-nochmal{position:absolute;top:10px;right:10px;width:38px;height:38px;border-radius:9px;border:1.5px solid var(--rahmen);background:var(--karte);font-size:1.15rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}
  .lernen-tippen{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:0.72rem;color:var(--text3);}
  .lernen-einst-knopf{display:block;margin:12px auto 0;padding:6px 14px;border:none;background:none;font-family:inherit;font-size:0.82rem;font-weight:700;color:var(--text2);cursor:pointer;}
  .lernen-vorlesen{display:flex;gap:6px;flex-wrap:wrap;}
  .lernen-vorlesen .typ-btn{padding:5px 10px;font-size:0.8rem;}
  .lernen-label{display:block;font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;text-align:center;}
  .lernen-wort{font-size:1.9rem;font-weight:800;color:var(--text);text-align:center;line-height:1.25;overflow-wrap:anywhere;}
  .lernen-uebersetzung .lernen-wort{color:var(--haupt);}
  .lernen-info{font-size:0.95rem;color:var(--text2);text-align:center;line-height:1.4;}
  .lernen-info .lernen-label{margin-bottom:2px;}
  .lernen-trenner{height:1px;background:var(--rahmen);margin:8px 0;}
  .lernen-trenner.duenn{margin:8px 32px;opacity:.7;}
  .lernen-warte{text-align:center;color:var(--text3);font-size:1.6rem;letter-spacing:0.2em;min-height:2.4rem;}
  .lernen-steuerung{display:flex;gap:10px;margin-top:14px;}
  .lernen-steuerung .btn{flex:1;min-height:56px;font-size:1.4rem;}
  .lernen-regler{margin-top:14px;display:flex;flex-direction:column;gap:10px;}
  .lernen-regler-zeile{display:flex;align-items:center;gap:10px;font-size:0.85rem;font-weight:600;color:var(--text2);}
  .lernen-regler-zeile > span{min-width:96px;}
  .lernen-regler-zeile input[type=range]{flex:1;accent-color:var(--haupt);}
  .lernen-regler-zeile b{min-width:52px;text-align:right;color:var(--haupt);}
  .auswahl-nr{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;border-radius:10px;background:var(--bestaetigen);color:var(--auf-bestaetigen);font-size:0.72rem;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;box-sizing:border-box;z-index:2;}
  .listen-raster{display:grid;gap:6px;margin-bottom:16px;}
  .listen-raster .karte-zeile{background:var(--karte);border:1px solid var(--rahmen);border-radius:var(--liste-ecke);min-width:0;}
  .listen-raster .karte-zeile:last-child{border-bottom:1px solid var(--rahmen);}
  .listen-raster.eng .karte-zeile{padding:10px 12px;gap:8px;}
  .listen-raster .raster-leer{min-height:56px;}
  .listen-raster.auswahl .quiz-setup-check{background:var(--karte);border:1px solid var(--rahmen);border-radius:var(--liste-ecke);min-width:0;}
  .listen-raster.auswahl .quiz-setup-check:last-child{border-bottom:1px solid var(--rahmen);}
  .listen-raster.auswahl.eng .quiz-setup-check{padding:8px 10px !important;gap:8px;}
  .listen-raster.auswahl .quiz-setup-check > div:last-child{min-width:0;}
  .listen-raster.auswahl .raster-leer{min-height:0;}
  .raster-chip{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;min-height:44px;min-width:0;text-align:left;padding:6px 10px;}
  .slot-raster.schmal .raster-chip{padding:6px 6px;font-size:0.78rem;}   /* 196: 4–5 Spalten */
  .listen-raster.schmal .karte-zeile{padding:8px 6px !important;font-size:0.8rem;}
  .listen-raster.schmal .karte-zeile-name{font-size:0.8rem;}
  .listen-raster.schmal .karte-zeile-info{min-width:0;width:100%;}
  .listen-raster.schmal .karte-zeile-sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.72rem;}
  .listen-raster.schmal .mini-kreise{gap:2px !important;}
  .raster-name{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .raster-kopf{display:flex;align-items:baseline;gap:6px;width:100%;min-width:0;}
  .raster-kopf .raster-name{flex:1;min-width:0;}
  .raster-anz{flex-shrink:0;font-size:0.72em;font-weight:500;opacity:0.7;white-space:nowrap;}   /* 210 */
  .raster-fortschritt{font-size:0.68rem;font-weight:600;opacity:0.8;}
  .raster-fuss{display:flex;align-items:center;gap:6px;width:100%;margin-top:6px;min-height:14px;}
  .kachel-balken{flex:1;height:6px;border-radius:3px;background:var(--rahmen);overflow:hidden;}
  .kachel-balken > span{display:block;height:100%;background:var(--haupt);border-radius:3px;}   /* 181: Fortschritt immer dunkel */
  .kachel-balken.voll > span{background:var(--gelernt);}
  .kachel-voll{font-size:0.7rem;font-weight:900;color:var(--auf-gelernt);background:var(--gelernt);border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .raster-chip{--heute-farbe:color-mix(in srgb, var(--haupt) 26%, transparent);}   /* 181/183: heute geübt – abgeschwächte Füllung */
  .raster-chip.kachel-gewaehlt{--heute-farbe:color-mix(in srgb, var(--bestaetigen) 42%, transparent);}   /* 182: auf der gewählten Kachel grün */
  .mini-kreise{display:flex;gap:3px;}
  .mini-kreise > span{border-radius:50%;}
  .kopf-kreise{position:absolute;right:12px;gap:4px;}
  .raster-leer{min-height:44px;border:1.5px solid var(--rahmen);border-radius:8px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
  .slot-kopf-knoepfe .slot-chip{padding:2px 9px;font-size:0.7rem;}
  .score-badge{font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:10px;}
  .score-pos{background:var(--haupt-flaeche);color:var(--haupt);}
  .score-neg{background:var(--falsch-flaeche);color:var(--falsch);}
  .score-null{background:var(--rahmen);color:var(--text2);}
  .quiz-frage-box{background:var(--abfrage-karte);color:var(--abfrage-schrift);border:1px solid var(--rahmen);border-radius:14px;padding:20px;margin-bottom:14px;}
  .akzent-rahmen{container-type:inline-size;}
  .akzent-wort{--k:min(48px, calc((100cqw - (var(--n) - 1) * 4px) / var(--n)));display:flex;flex-wrap:wrap;justify-content:center;column-gap:calc(var(--k) * 0.6);row-gap:8px;margin-top:8px;}
  .akzent-wortgruppe{display:flex;gap:4px;}
  .akzent-kachel{box-sizing:border-box;width:var(--k);height:calc(var(--k) * 1.3);padding:0;border-radius:calc(var(--k) * 0.2);border:1.5px solid var(--text4);background:var(--karte);font-family:inherit;font-size:calc(var(--k) * 0.68);font-weight:700;color:var(--text-stark);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,border-color .15s;}
  .akzent-zaehler{text-align:center;font-size:0.85rem;font-weight:700;color:var(--text2);margin-top:2px;}
  .akzent-kachel.markiert{background:var(--gelb-flaeche);border-color:var(--gelb);}
  .akzent-kachel.aktiv{border:2.5px solid var(--text);background:var(--flaeche);}
  .akzent-kachel.ok{background:var(--haupt-zart);border-color:var(--haupt);color:var(--richtig-dunkel);}
  .akzent-kachel.falsch{background:var(--falsch-flaeche);border-color:var(--falsch);color:var(--falsch);}
  .akzent-kachel.loesung{background:var(--gelb-flaeche);border-color:var(--gelb);color:var(--haupt);}
  .akzent-kachel.blink{background:var(--falsch);border-color:var(--falsch);color:var(--auf-falsch);}
  .akzent-aktionen{width:100%;display:flex;flex-direction:column;align-items:center;gap:10px;}
  .akzent-pruefen{min-width:60%;padding:14px 28px;font-size:1.15rem;}
  .akzent-leiste{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:12px;padding:10px 6px;background:var(--haupt-flaeche);border-radius:12px;}
  .akzent-variante{min-width:48px;height:58px;border-radius:10px;border:1.5px solid var(--haupt);background:var(--karte);font-family:inherit;font-size:1.9rem;font-weight:700;color:var(--text-stark);cursor:pointer;}
  .wiederholung-karte{background:var(--gelb-flaeche);border:2px dashed var(--orange);text-align:center;}
  .wiederholung-marke{color:var(--orange);font-size:0.85rem;font-weight:700;}
  .quiz-label{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--abfrage-schrift-leise);margin-bottom:6px;}
  .quiz-frage-text{font-size:1.5rem;font-weight:700;line-height:1.3;overflow-wrap:anywhere;}
  .quiz-antwort-box,.quiz-vorig,.rueck-karte{overflow-wrap:anywhere;min-width:0;}
  .quiz-info-text{font-size:0.85rem;color:var(--text2);margin-top:6px;}
  .quiz-antwort-box{background:var(--abfrage-karte);color:var(--abfrage-schrift);border:1.5px solid var(--rahmen);border-radius:14px;padding:18px;margin-bottom:14px;transition:border-color .2s,background .2s;min-height:120px;}
  .quiz-antwort-box.richtig{border-color:var(--haupt);background:var(--haupt-flaeche);}
  .quiz-antwort-box.falsch{border-color:var(--falsch);background:var(--falsch-flaeche);}
  .quiz-antwort-box.aufgedeckt{background:var(--gelb-flaeche);border-color:var(--gelb);}
  .quiz-antwort-box.weitere{border-color:var(--info);background:var(--info-flaeche);}
  .quiz-antwort-box.spalte-ok{border-color:var(--haupt);background:var(--haupt-flaeche);}
  .quiz-loesung-text{font-size:1.15rem;font-weight:600;margin-top:8px;}
  .quiz-feedback{font-size:0.88rem;font-weight:600;margin-top:6px;}
  .quiz-feedback.ok{color:var(--richtig-dunkel);}
  .quiz-feedback.nein{color:var(--falsch-dunkel);}
  .quiz-feedback.info{color:var(--info);}
  .quiz-fortschritt{font-size:0.82rem;color:var(--text2);}
  .quiz-aktionen{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;}
  .quiz-action-bar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:600px;background:var(--karte);border-top:1px solid var(--rahmen);padding:12px 16px 20px;display:flex;gap:10px;flex-wrap:wrap;z-index:20;}
  .quiz-liste-sticky{position:sticky;top:57px;background:var(--kopfzeile);color:var(--kopf-schrift);border-bottom:1px solid var(--rahmen);padding:8px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;z-index:9;}
  .vok-zeile{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--flaeche);cursor:pointer;}
  .vok-zeile:last-child{border-bottom:none;}
  .vok-zeile:active{background:var(--knopf);}
  .vok-nr{font-size:0.72rem;color:var(--text2);min-width:28px;text-align:right;flex-shrink:0;}
  .spalten-rolle-btn{font-size:0.72rem;font-weight:700;padding:4px 8px;border-radius:6px;border:1.5px solid var(--rahmen);background:var(--knopf);color:var(--text2);cursor:pointer;font-family:inherit;}
  .spalten-rolle-btn.frage{background:var(--haupt);color:var(--auf-haupt);border-color:var(--haupt);}
  .spalten-rolle-btn.antwort{background:var(--haupt);color:var(--auf-haupt);border-color:var(--haupt);}
  .spalten-rolle-btn.info{background:var(--gelb);color:var(--auf-gelb);border-color:var(--gelb);}
  .spalten-modus-btn{font-size:0.72rem;font-weight:700;padding:4px 8px;border-radius:6px;border:1.5px solid var(--rahmen);background:var(--knopf);color:var(--text2);cursor:pointer;font-family:inherit;}
  .spalten-modus-btn.aktiv{background:var(--haupt-hell);color:var(--auf-haupt-hell);border-color:var(--haupt-hell);}
  .quiz-vorig{background:var(--haupt-flaeche);border:1px solid var(--haupt-zart);border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:0.88rem;color:var(--haupt);}
  .quiz-vorig-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--haupt);margin-bottom:3px;}
  .quiz-vorig.nicht{background:var(--falsch-flaeche);border-color:var(--falsch-zart);color:var(--falsch-dunkel);}
  .quiz-vorig.nicht .quiz-vorig-label{color:var(--falsch);}
  .quiz-setup-check{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--rahmen);cursor:pointer;}
  .quiz-setup-check:last-child{border-bottom:none;}
  .checkbox{width:20px;height:20px;border-radius:5px;border:2px solid var(--rahmen);display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--knopf);}
  .checkbox.checked{background:var(--haupt);border-color:var(--haupt);color:var(--auf-haupt);}
  .liste-detail-header-name{flex:1;font-size:0.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .btn-toggle{background:var(--haupt);color:var(--auf-haupt);border:none;cursor:pointer;padding:6px 9px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
  .btn-toggle:active{opacity:.8;}
  .btn-toggle-ghost{background:var(--knopf);color:var(--haupt);border:1.5px solid var(--haupt);cursor:pointer;padding:5px 8px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
  .btn-toggle-ghost:active{opacity:.8;}
  .diktat-hint{font-size:1.8rem;font-weight:700;letter-spacing:0.2em;color:var(--haupt);margin:10px 0 6px;font-family:monospace;}
  .diktat-uebersetzung{font-size:0.85rem;color:var(--text2);margin-top:4px;}
  .diktat-play-btn{background:none;border:none;font-size:3rem;cursor:pointer;display:block;margin:8px auto;line-height:1;}
  .diktat-summary-zeile{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--flaeche);}
  .karte-bewertung{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;}
  .karte-btn{padding:22px 16px;border-radius:14px;font-size:1.05rem;font-weight:700;border:none;cursor:pointer;font-family:inherit;transition:opacity .15s;width:100%;}
  .karte-btn:active{opacity:.8;}
  .karte-btn-ja{background:var(--haupt);color:var(--auf-haupt);}
  .karte-btn-nein{background:var(--falsch);color:var(--auf-falsch);}
  .karte-aufdecken{text-align:center;padding:20px 0;color:var(--text3);font-size:0.9rem;font-style:italic;}
  .karten-kopf{display:flex;align-items:center;gap:8px;margin-bottom:6px;min-height:40px;}
  .karten-kopf .quiz-label,.karten-kopf .quiz-vorig-label{margin-bottom:0;flex:1;min-width:0;}
  .karten-knoepfe{display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:auto;}
  .karten-knopf{min-width:40px;height:40px;border-radius:20px;border:1.5px solid var(--rahmen);background:var(--karte);color:var(--text2);display:flex;align-items:center;justify-content:center;padding:0 10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;line-height:1;}
  .karten-knopf.laut.an{color:var(--haupt);border-color:var(--haupt-zart);}
  .karten-knopf.gedimmt{opacity:.5;}
  .quiz-vorig{cursor:pointer;}
  .quiz-vorig.offen{background:var(--karte);border-color:var(--rahmen);color:var(--text-stark);}
  .quiz-vorig.offen .quiz-vorig-label{color:var(--abfrage-schrift-leise);}
  .syn-chip{background:var(--karte);border:1px solid var(--haupt-zart);border-radius:14px;padding:3px 10px;font-size:0.88rem;color:var(--text-stark);}
  html,body{overscroll-behavior-x:none;}   /* seitliches Wischen wechselt die Tabs – nicht „Zurück“ im Browser */
  @keyframes tabReinLinks{from{transform:translateX(40%);opacity:0;}to{transform:none;opacity:1;}}
  @keyframes tabReinRechts{from{transform:translateX(-40%);opacity:0;}to{transform:none;opacity:1;}}
  .app.gleiten-links > :not(:first-child){animation:tabReinLinks .28s ease-out;}
  .app.gleiten-rechts > :not(:first-child){animation:tabReinRechts .28s ease-out;}
  .wahl-leiste{display:flex;gap:8px;margin-bottom:6px;}
  .wahl-leiste .btn{flex:1;}
  .slot-info{position:sticky;z-index:8;background:var(--karte);background:color-mix(in srgb, var(--bestaetigen) 11%, var(--karte));border-bottom:1px solid var(--rahmen);padding:10px 16px;box-shadow:0 4px 8px -6px rgba(0,0,0,0.25);}
  .slot-info-pfeil{flex-shrink:0;width:34px;height:30px;border-radius:15px;border:1.5px solid var(--rahmen);background:var(--karte);color:var(--text2);cursor:pointer;font-size:0.75rem;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;}
  .slot-kopf-name{position:relative;}
  .kopf-balken{position:absolute;left:14px;right:14px;bottom:4px;height:4px;border-radius:2px;background:rgba(0,0,0,0.18);overflow:hidden;}
  .kopf-balken > span{display:block;height:100%;background:currentColor;opacity:0.85;}
  .score-symbole{display:inline-flex;align-items:center;gap:4px;margin-right:4px;}
  .score-symbole .sym{width:10px;height:10px;box-sizing:border-box;border:1.6px solid var(--bestaetigen);display:inline-block;}
  .score-symbole .sym.kreis{border-radius:50%;}
  .score-symbole .sym.raute{width:8px;height:8px;transform:rotate(45deg);margin:0 1px;}
  .score-symbole .sym.voll{background:var(--bestaetigen);}
  .score-symbole .sym.negativ{border-color:var(--falsch);}
  .score-symbole .sym.negativ.voll{background:var(--falsch);}
  .rueck-wahl.andere{opacity:.4;}
  .rueck-wahl.gewaehlt{box-shadow:0 0 0 3px var(--bestaetigen);}
  .rueck-eingabe{margin-top:6px;font-size:0.82rem;color:var(--text2);text-align:center;}
  .rueck-geaendert{margin-top:10px;text-align:center;font-size:0.85rem;font-weight:700;color:var(--bestaetigen);}
  .score-symbole.klein{gap:3px;}
  .score-symbole.klein .sym{width:7px;height:7px;border-width:1.3px;}
  .score-symbole.klein .sym.raute{width:6px;height:6px;}
  .stufen-punkte{font-size:0.62rem;letter-spacing:1px;color:var(--gelernt);margin-right:4px;white-space:nowrap;}
  .info-zeile-klein{display:flex;justify-content:space-between;gap:8px;font-size:0.75rem;color:var(--text2);white-space:nowrap;}
  .info-gruppen{min-width:0;overflow:hidden;text-overflow:ellipsis;text-align:right;}
  .gruppen-punkt{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px;vertical-align:0;}
  .slot-info{cursor:pointer;}
  .info-klapp-zeile{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:0.85rem;font-weight:600;color:var(--text-stark);cursor:pointer;}
  [data-wahl-bereich] .toggle-opt.aktiv,[data-wahl-bereich] .typ-btn.aktiv,[data-wahl-bereich].toggle-btn .toggle-opt.aktiv{background:var(--bestaetigen) !important;color:var(--auf-bestaetigen) !important;border-color:var(--bestaetigen) !important;}
  .kachel-gewaehlt{box-shadow:0 0 0 2px var(--karte),0 0 0 5px var(--bestaetigen) !important;}
  .kachel-gewaehlt:not(.leuchten){background-color:var(--karte) !important;background-color:color-mix(in srgb, var(--bestaetigen) 22%, var(--karte)) !important;border-color:var(--bestaetigen) !important;}
  .vorschau-zeile{display:flex;align-items:baseline;gap:8px;padding:5px 2px;border-bottom:1px solid var(--rahmen);font-size:0.85rem;}
  .vorschau-nr{min-width:28px;text-align:right;color:var(--text3);font-variant-numeric:tabular-nums;font-size:0.75rem;}
  .vorschau-wort{font-weight:700;}
  .vorschau-de{flex:1;color:var(--text2);min-width:0;}
  .vorschau-luecke{text-align:center;font-size:0.72rem;color:var(--text3);padding:4px 0;border-bottom:1px dashed var(--rahmen);}
  .auch-hinweis{font-size:0.62em;font-weight:500;opacity:.75;}
  .stimme-wechsel{position:absolute;top:6px;right:6px;z-index:2;border:1.5px solid var(--rahmen);background:var(--karte);border-radius:16px;padding:2px 8px;font-size:0.9rem;cursor:pointer;line-height:1.4;}
  .stimme-zeile{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.88rem;}
  .antwort-status{display:inline-flex;align-items:center;justify-content:center;width:1.6em;height:1.6em;border-radius:50%;margin-right:8px;font-size:0.95rem;font-weight:900;letter-spacing:0;line-height:1;}
  .antwort-status.richtig{background:var(--richtig);color:#fff;}
  .antwort-status.falsch{background:var(--falsch);color:#fff;}
  .antwort-status.aufgedeckt{background:var(--flaeche);font-size:0.85rem;}
  .satz-band{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;border-radius:12px;background:var(--flaeche);padding:10px;margin:4px 0 8px;max-width:100%;box-sizing:border-box;}
  .satz-wort{min-width:2.6em;max-width:100%;overflow-wrap:anywhere;border:1.5px solid var(--rahmen);background:var(--karte);border-radius:10px;padding:8px 10px;font-family:inherit;font-size:1.05rem;font-weight:700;color:var(--text-stark);cursor:pointer;}
  .satz-text{font-size:1.1rem;line-height:1.6;text-align:center;color:var(--abfrage-schrift, var(--text-stark));}
  .satz-gebaut{min-height:2.2em;border-bottom:2px solid var(--rahmen);margin-bottom:10px;}
  .satz-luecke{color:var(--haupt);font-weight:800;letter-spacing:1px;}
  .satz-ueb{text-align:center;font-size:0.85rem;color:var(--text2);margin-top:4px;}
  .satz-kachel{font-size:0.95rem;padding:0 10px;}
  .artikel-wort{text-align:center;font-size:1.5rem;font-weight:800;margin:4px 0 12px;color:var(--abfrage-schrift, var(--text-stark));}
  .hoer-symbol{font-size:2.6rem;line-height:1;display:inline-block;padding:6px 0;}
  .puzzle-zeile{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin:4px 0 10px;}
  .puzzle-feld{min-width:24px;height:34px;border-bottom:2.5px solid var(--haupt);display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:700;color:var(--abfrage-schrift, var(--text-stark));}
  .puzzle-feld.frei{border-bottom-color:var(--rahmen);}
  .puzzle-feld.fest{border-bottom-color:transparent;}
  .puzzle-feld.luecke-leer{min-width:12px;border-bottom-color:transparent;}
  .puzzle-kacheln{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;}
  .puzzle-kachel{min-width:40px;height:44px;border-radius:10px;border:1.5px solid var(--haupt);background:var(--knopf);color:var(--text-stark);font-family:inherit;font-size:1.15rem;font-weight:700;cursor:pointer;}
  .puzzle-kachel:disabled{opacity:0.25;cursor:default;}
  .zuo-zeit{height:8px;border-radius:4px;background:var(--flaeche);overflow:hidden;margin:4px 0 12px;}
  .zuo-zeit[data-zuo-zeit="aus"]{visibility:hidden;}
  .zuo-zeit-balken{height:100%;width:100%;transform-origin:left;animation-name:zuoZeit;animation-timing-function:linear;animation-fill-mode:forwards;}
  @keyframes zuoZeit{0%{transform:scaleX(1);background:var(--richtig);}60%{background:var(--richtig);}80%{background:var(--orange);}100%{transform:scaleX(0);background:var(--falsch);}}
  .zuo-raster{display:grid;gap:8px;}
  .memory-raster{display:grid;gap:8px;}
  .memory-karte{position:relative;min-height:64px;padding:6px;border-radius:12px;border:2px solid var(--haupt);background:var(--haupt);color:var(--auf-haupt);font-family:inherit;font-weight:700;line-height:1.2;overflow-wrap:anywhere;cursor:pointer;transition:background .2s,color .2s;}
  .memory-karte.auf{background:var(--abfrage-karte, var(--karte));color:var(--abfrage-schrift, var(--text-stark));border-color:var(--rahmen);}
  .memory-karte.falsch{border-color:var(--falsch);}
  .memory-rueck{font-size:1.4rem;opacity:0.7;}
  .zuo-ergebnis{display:flex;flex-direction:column;gap:8px;}
  .zuo-reihe{position:relative;border:2px solid var(--rahmen);border-radius:12px;padding:6px;animation:zuoEin .35s ease-out;}
  .zuo-reihe.richtig{border-color:var(--richtig);}
  .zuo-reihe.falsch{border-color:var(--falsch);background:var(--falsch-flaeche, transparent);}
  .zuo-reihe.offen{border-style:dashed;}
  .zuo-reihe .zuo-karte{min-height:40px;}
  .zuo-wahl{font-size:0.75rem;color:var(--falsch-dunkel, var(--falsch));margin:4px 4px 0;font-weight:600;}
  @keyframes zuoEin{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}
  .zuo-kopf{font-size:0.72rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .zuo-karte{position:relative;min-height:46px;padding:6px 6px;border-radius:10px;border:2px solid var(--rahmen);background:var(--abfrage-karte, var(--karte));color:var(--abfrage-schrift, var(--text));
    font-family:inherit;font-weight:600;line-height:1.2;overflow-wrap:anywhere;cursor:pointer;transition:background .15s,border-color .15s,opacity .3s;}
  .zuo-karte.wahl{border-color:var(--haupt);background:var(--haupt-flaeche);}
  .zuo-karte.ok,.zuo-karte.falsch-erl{cursor:default;}
  .zuo-karte.offen-geblieben{opacity:0.5;border-style:dashed;}
  .zuo-karte.blink{animation:zuoBlink .6s;}
  @keyframes zuoBlink{0%,100%{border-color:var(--rahmen);}30%,70%{border-color:var(--falsch);background:var(--falsch-zart, #fde2e2);}}
  .zuo-nr{position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;border-radius:9px;color:#fff;font-size:0.68rem;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;}
  .score-slider{-webkit-appearance:none;appearance:none;width:100%;height:30px;background:transparent;outline:none;cursor:pointer;}
  .score-slider::-webkit-slider-runnable-track{height:4px;background:var(--rahmen);border-radius:2px;}
  .score-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;background:var(--haupt);border-radius:6px;cursor:pointer;margin-top:-12px;}
  .score-slider::-moz-range-track{height:4px;background:var(--rahmen);border-radius:2px;}
  .score-slider::-moz-range-thumb{width:28px;height:28px;background:var(--haupt);border-radius:6px;cursor:pointer;border:none;}
  /* 224: breite Bildschirme (iPad, Querformat) – Leistenfarben nach links und rechts bis zum Rand fortführen
     (Schatten mit großer Ausbreitung, oben/unten abgeschnitten: ändert das Layout nicht) */
  @media (min-width:601px){
    .vb-kopf,.tabs,.slot-kopf,.liste-detail-header,.quiz-zeile,.slot-info,.quiz-action-bar,[style*="background: var(--kopfzeile)"]{clip-path:inset(0 -100vmax);}
    .vb-kopf,.tabs{box-shadow:0 0 0 100vmax var(--app-kopf);}
    .slot-kopf,.liste-detail-header,[style*="background: var(--kopfzeile)"]{box-shadow:0 0 0 100vmax var(--kopfzeile);}
    .slot-kopf.gruen{box-shadow:0 0 0 100vmax var(--haupt);}
    .quiz-zeile,.quiz-action-bar{box-shadow:0 0 0 100vmax var(--karte);}
    .slot-info{box-shadow:0 0 0 100vmax color-mix(in srgb, var(--bestaetigen) 11%, var(--karte));}
  }
`;
