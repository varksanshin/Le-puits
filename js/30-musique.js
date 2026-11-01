"use strict";
// ---------- 30. Musique 16-bits procédurale (Web Audio API) — 0.29 ----------
/* Chaque thème est un vrai morceau d'environ 1 min 30 à 2 min avant de boucler :
   une intro, puis des parties A / B / C (couplet, refrain, pont) jouées dans un ordre (« form »),
   reprises avec des variations (« A+ » : plus fort, harmonie à la tierce, cymbale).
   L'écriture est en degrés de la gamme : la mélodie suit l'accord, et l'accompagnement
   (nappe, arpège, basse, batterie) est fabriqué à partir des accords.

   Mélodie : 8 cases par mesure (croches). « 5 » = 5e degré, « 5' » une octave plus haut, « 5, » plus bas,
   « #4 » / « b3 » altérés, « - » tient la note, « . » silence, « 5+4 » deux doubles-croches.
   Accords : un par mesure, « 1 », « 6 », « 5M » (forcé majeur), « 2m », « 7d » (diminué), « 4s » (sus4),
   « 1|5 » deux accords dans la mesure.
   Une partie de 8 mesures : les mesures 5 à 7 reprennent la mélodie des mesures 1 à 3, la 8e est « end ». */

const MUSIC = (() => {
  let ac = null, master = null, comp = null, delay = null, rev = null, buses = null;
  let playing = false, currentTrack = null, step = 0, nextTime = 0, timerId = null, fadeUntil = 0;
  // niveau : 2 = normal, 1 = doux, 0 = coupé
  let level = 2;
  try { const v = localStorage.getItem("lepuits.music"); level = v === "off" ? 0 : v === "soft" ? 1 : 2; } catch (e) {}
  const LEVEL_GAIN = [0, 0.32, 0.6];

  const m2f = n => 440 * Math.pow(2, (n - 69) / 12);
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], mixo: [0, 2, 4, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], phrygdom: [0, 1, 4, 5, 7, 8, 10]
  };

  // ===== Motifs d'accompagnement (16 doubles-croches par mesure) =====
  // arpèges : indices dans l'accord (0 fond, 1 tierce, 2 quinte, 3 fond +8ve, 4 tierce +8ve), « . » silence
  const ARP = {
    harp:   "0.1.2.3.4.3.2.1.",
    up8:    "0.1.2.3.2.1.0.1.",
    up16:   "0123432101234321",
    alb:    "0212021202120212",
    pulse:  "3.2.3.2.3.2.3.2.",
    sparse: "0...2...4...2...",
    roll:   "0123012301230123",
    off:    "..2...3...2...4."
  };
  // basses : 0 fondamentale, 5 quinte, 8 octave, « - » tenue, « . » silence
  const BASS = {
    drone:  "0---------------",
    half:   "0-------5-------",
    root8:  "0.0.0.0.0.0.0.0.",
    oct8:   "0.8.0.8.0.8.0.8.",
    drive:  "0080008000800080",
    gallop: "0.000.000.000.00",
    walk:   "0-.05-.58-.85-.5",
    march:  "0...5...0...5.0.",
    pump:   "0.0.8.0.0.0.8.0."
  };
  // batterie : k grosse caisse, s caisse claire, r caisse douce, h charleston, o charleston ouvert,
  // t / T toms grave / aigu, c cymbale, m enclume
  const DRUM = {
    half:   "k.......s.......",
    soft:   "k...h...r...h...",
    pop:    "k.h.s.h.k.h.s.hh",
    drive:  "k.h.s.hkk.h.s.h.",
    march:  "k.r.s.r.k.rrs.r.",
    gallop: "k.hks.hkk.hks.h.",
    tribal: "k..t.T..k..T.tt.",
    metal:  "k.h.m.hkk.h.m.h.",
    rock:   "k.s.k.s.k.s.k.ss",
    jig:    "k..h.hs..hk.h.s.",
    heavy:  "k...s..kk...s.t."
  };
  const FILL = "k.h.s.h.s.sTsTtt";

  // ===== LES THÈMES =====
  const TRACKS = {
    // ÉCRAN TITRE — Crépuscule sur le puits (ré mineur, doux)
    title: { bpm: 86, key: 62, scale: "minor", lead: "flute", alt: "bell", arpI: "harp", padI: "strings", bassI: "warm", kit: "soft",
      arp: "harp", bass: "half", drum: "soft",
      S: {
        i: { ch: "1 6 3 7", lvl: 0 },
        A: { ch: "1 6 3 7 1 6 3 5M", lvl: 1, mel: ["5 - - 4 3 - 2 -", "3 - - - 1 - - -", "1 - 3 - 5 - 3 -", "4 - - - - - . ."], end: "#7, - - - 2 - - -" },
        B: { ch: "4 1 6 7 4 1 6 5M", lvl: 2, mel: ["1' - 7 - 6 - 5 -", "4 - 5 - 3 - - -", "3 - 4 - 5 - 6 -", "7 - - - 5 - 4 -"], end: "5 - - - #7 - - -" },
        C: { ch: "6 7 1 1 6 7 1 5M", lvl: 0, lead: "bell", arp: "sparse", mel: ["3' - - - 2' - - -", "1' - - - 7 - - -", "1' - - - 5 - - -", "- - - - . . . ."], end: "#7 - - - - - . ." }
      }, form: "i A B C A+ B+" },

    // L'ENTRÉE — Ruines de Puits-Clair (la dorien, aventureux)
    entree: { bpm: 108, key: 69, scale: "dorian", lead: "flute", alt: "pulse", arpI: "harp", padI: "strings", bassI: "warm", kit: "pop",
      arp: "up8", bass: "oct8", drum: "pop",
      S: {
        i: { ch: "1 1 4 4", lvl: 0 },
        A: { ch: "1 4 7 1 1 4 7 5", lvl: 1, mel: ["1 - 2 - 3 - 5 -", "4 - - 3 4 - 6 -", "5 - - - 4 - 2 -", "1 - - - . . 5, -"], end: "7, - 1 - 5, - - -" },
        B: { ch: "3 4 1 7 3 4 1 5", lvl: 2, mel: ["3 - 5 - 1' - 7 -", "6 - 5 - 4 - - -", "3 - 2 - 1 - 2 -", "2 - - - 7, - - -"], end: "5, - 7, - 2 - - -" },
        C: { ch: "4 4 1 1 4 4 1 5", lvl: 0, lead: "bell", arp: "harp", mel: ["6 - - - 5 - - -", "4 - - - - - - -", "3 - - - 2 - - -", "1 - - - - - - -"], end: "2 - - - 7, - - -" }
      }, form: "i A B A+ C B+" },

    // LES MINES — Prison du Roi (mi phrygien, métallique)
    mines: { bpm: 120, key: 64, scale: "phrygian", lead: "brass", alt: "pulse", arpI: "pluck", padI: "strings", bassI: "fm", kit: "metal",
      arp: "off", bass: "drive", drum: "metal", drum1: "half",
      S: {
        i: { ch: "1 1 2 1", lvl: 1, bass: "root8" },
        A: { ch: "1 2 1 7 1 2 1 2", lvl: 1, mel: ["1 - . 1 3 - 1 -", "2 - 3 - 4 - 3 -", "1 - - - 5, - 7, -", "6, - 7, - 1 - - -"], end: "4 - 3 - 2 - - -" },
        B: { ch: "4 6 2 1 4 6 2 1", lvl: 2, arp: "up8", mel: ["5 - 4 - 3 - 4 -", "5 - - 6 5 - 3 -", "4 - 3 - 2 - - -", "1 - - - - - . ."], end: "1 - 3 - 1 - 7, -" },
        C: { ch: "1 1 2 2 1 1 2 2", lvl: 1, drum1: "metal", arp: "sparse", mel: ["1 . 1 . 2 . 1 .", "- - - - . . . .", "2 . 2 . 3 . 2 .", "- - - - . . . ."], end: "3 - 2 - 1 - 7, -" }
      }, form: "i A B C A+ B+" },

    // LA ZONE NOYÉE — Brume-sous-Terre (do mineur, lent, cloches)
    noyee: { bpm: 80, key: 72, scale: "minor", lead: "bell", alt: "choir", arpI: "harp", padI: "choir", bassI: "sub", kit: "soft",
      arp: "harp", bass: "drone", drum: "soft", drum1: "half",
      S: {
        i: { ch: "1 6 1 6", lvl: 0 },
        A: { ch: "1 6 3 7 1 6 3 5M", lvl: 1, mel: ["5 - - 4 3 - - -", "1 - - - - - 3 -", "2 - 3 - 5 - - -", "4 - - - 2 - - -"], end: "#7, - - - 2 - - -" },
        B: { ch: "4 1 6 5 4 1 6 5M", lvl: 2, bass: "half", mel: ["6 - 5 - 4 - - -", "3 - 2 - 1 - - -", "1 - 3 - 6 - 5 -", "5 - - - 4 - 2 -"], end: "2 - - - #7, - - -" },
        C: { ch: "6 6 7 7 6 6 5M 5M", lvl: 0, lead: "choir", arp: "sparse", mel: ["3 - - - 1 - - -", "- - - - . . . .", "2 - - - 4 - - -", "- - - - . . . ."], end: "2 - - - - - - -" }
      }, form: "i A B C A+ B" },

    // LES PROFONDEURS — Jardin de la Mère-Spore (fa# dorien, hypnotique)
    spores: { bpm: 112, key: 66, scale: "dorian", lead: "organ", alt: "bell", arpI: "marimba", padI: "strings", bassI: "fm", kit: "pop",
      arp: "alb", bass: "pump", drum: "drive", drum1: "soft",
      S: {
        i: { ch: "1 4 1 4", lvl: 0 },
        A: { ch: "1 4 1 4 1 4 1 7", lvl: 1, mel: ["1 . 3 . 5 . 6 5", "4 - 3 - 4 - . .", "3 . 5 . 1' . 7 5", "6 - - - 4 - - -"], end: "7, - 2 - 4 - - -" },
        B: { ch: "3 7 4 1 3 7 4 5", lvl: 2, mel: ["3 - 5 - 1' - - -", "7 - - 6 5 - - -", "6 - 5 - 4 - 6 -", "5 - - - - - . ."], end: "5 - 7 - 2' - - -" },
        C: { ch: "2 2 1 1 2 2 1 1", lvl: 1, lead: "bell", arp: "sparse", mel: ["2 - - - 4 - - -", "5 - - - 4 - 2 -", "1 - - - 3 - - -", "- - - - . . . ."], end: "1 - - - - - . ." }
      }, form: "i A B C A+ B+" },

    // L'ANTRE — Là où le puits a faim (do mineur harmonique, tendu)
    antre: { bpm: 96, key: 60, scale: "harmonic", lead: "brass", alt: "choir", arpI: "pluck", padI: "choir", bassI: "sub", kit: "heavy",
      arp: "off", bass: "march", drum: "heavy", drum1: "tribal",
      S: {
        i: { ch: "1 1 6 5", lvl: 1 },
        A: { ch: "1 6 4 5 1 6 4 5", lvl: 1, mel: ["1 - - 2 3 - - -", "3 - 2 - 1 - - -", "4 - 3 - 4 - 6 -", "5 - - - 7, - - -"], end: "2 - 7, - 5, - - -" },
        B: { ch: "4 1 6 7 4 1 6 5", lvl: 2, mel: ["1' - - - 6 - 4 -", "5 - - - 3 - - -", "6 - 5 - 3 - 1 -", "7, - 2 - 4 - - -"], end: "5 - 4 - 2 - 7, -" },
        C: { ch: "1 1 2d 2d 1 1 5 5", lvl: 0, lead: "choir", arp: "sparse", mel: ["1 - - - . . . .", "3 - - 2 1 - - -", "2 - - - - - 4 -", "- - - - . . . ."], end: "7, - - - - - . ." }
      }, form: "i A B C A+ B+" },

    // LE ROYAUME CÉLESTE (sol lydien, lumineux)
    ciel: { bpm: 100, key: 67, scale: "lydian", lead: "bell", alt: "flute", arpI: "harp", padI: "choir", bassI: "warm", kit: "soft",
      arp: "up16", bass: "half", drum: "pop", drum1: "soft",
      S: {
        i: { ch: "1 2 1 2", lvl: 0 },
        A: { ch: "1 2 6 5 1 2 6 2", lvl: 1, mel: ["5 - 3 - 1 - 3 -", "2 - 4 - 6 - 4 -", "6 - 5 - 3 - - -", "2 - - - - - . ."], end: "4 - 3 - 2 - - -" },
        B: { ch: "6 3 2 5 6 3 2 5", lvl: 2, lead: "flute", mel: ["1' - 7 - 6 - 5 -", "7 - - 6 5 - 3 -", "4 - 3 - 2 - 4 -", "5 - - - - - . ."], end: "5 - 6 - 7 - 6 -" },
        C: { ch: "1 1 3 3 1 1 3 2", lvl: 0, arp: "harp", mel: ["5 - - - - - - -", "3 - - - 4 - - -", "5 - - - 3 - - -", "- - - - . . . ."], end: "4 - - - - - . ." }
      }, form: "i A B C A+ B+" },

    // LE ROYAUME INFERNAL (ré phrygien dominant, lourd)
    enfer: { bpm: 90, key: 62, scale: "phrygdom", lead: "choir", alt: "brass", arpI: "pluck", padI: "strings", bassI: "fm", kit: "heavy",
      arp: "off", bass: "drive", drum: "heavy", drum1: "tribal",
      S: {
        i: { ch: "1 2 1 2", lvl: 1, bass: "half" },
        A: { ch: "1 2 7 1 1 2 7 2", lvl: 1, mel: ["1 - - 2+1 3 - - -", "2 - - - 1 - 7, -", "7, - 1 - 2 - 7, -", "1 - - - - - . ."], end: "4 - 3 - 2 - - -" },
        B: { ch: "4 7 2 1 4 7 2 1", lvl: 2, lead: "brass", mel: ["4 - 5 - 6 - 5 -", "7 - - - 6 - 4 -", "6 - 5 - 4 - 2 -", "1 - - - 3 - - -"], end: "5 - 3 - 1 - - -" },
        C: { ch: "1 1 2 2 1 1 2 2", lvl: 1, drum1: "tribal", mel: ["1, - 1, - 3, - 1, -", "5, - - - - - . .", "2, - 2, - 1, - 2, -", "- - - - . . . ."], end: "1 - - - - - . ." }
      }, form: "i A B C A+ B+" },

    // MINI-BOSS — Gardiens des reliques (la mineur, nerveux)
    miniboss: { bpm: 150, key: 69, scale: "minor", lead: "pulse", alt: "brass", arpI: "pluck", padI: "strings", bassI: "fm", kit: "rock",
      arp: "up16", bass: "drive", drum: "rock",
      S: {
        i: { ch: "1 1", lvl: 2 },
        A: { ch: "1 6 7 1 1 6 7 5M", lvl: 2, mel: ["1 . 3 1 5 - 3 -", "6 - 5 - 3 - 1 -", "7 - 6 - 5 - 4 -", "3 - 1 - - - . ."], end: "#7, - 2 - 5 - #7 -" },
        B: { ch: "4 1 6 5M 4 1 6 5M", lvl: 2, mel: ["4 - 6 - 1' - 6 -", "5 - 3 - 1 - 3 -", "6 - 1' - 3' - 1' -", "#7 - - - 5 - - -"], end: "2' - - - #7 - - -" },
        C: { ch: "6 7 1 1 6 7 1 5M", lvl: 1, lead: "brass", drum1: "drive", mel: ["1' - 7 - 6 - 5 -", "4 - 5 - 7 - - -", "1' - - - 5 - - -", "- - - - . . . ."], end: "#7 - - - 2' - - -" }
      }, form: "i A B A+ C B+" },

    // BOSS FINAL — Le Gardien du Puits (ré mineur, épique)
    boss: { bpm: 160, key: 62, scale: "minor", lead: "pulse", alt: "brass", arpI: "pluck", padI: "choir", bassI: "fm", kit: "rock",
      arp: "up16", bass: "gallop", drum: "rock",
      S: {
        i: { ch: "1 1", lvl: 2 },
        A: { ch: "1 6 4 5M 1 6 4 5M", lvl: 2, mel: ["1 - 3 1 5 - 1' -", "6 - 5 - 3 - 1 -", "4 - 6 - 1' - 6 -", "#7 - 2' - 5 - - -"], end: "5 - #7 - 2' - #7 -" },
        B: { ch: "6 3 7 1 6 3 7 5M", lvl: 2, lead: "brass", mel: ["3' - 1' - 6 - 3' -", "5 - 3 - 1' - 3' -", "7 - 2' - 4' - 2' -", "1' - - - 5 - - -"], end: "#7 - - - 5 - - -" },
        C: { ch: "4 4 1 1 4 4 5M 5M", lvl: 1, mel: ["1' - 6 - 4 - 6 -", "1' - - - 2' - - -", "5 - - - - - - -", "- - - - . . . ."], end: "#7 - 2' - 5' - - -" }
      }, form: "i A B A+ C B+" },

    // ===== MODE HORDE =====
    // Prélude 1 — La cour du château (ré mixolydien, martial)
    h_chateau: { bpm: 116, key: 62, scale: "mixo", lead: "brass", alt: "flute", arpI: "pluck", padI: "strings", bassI: "warm", kit: "march",
      arp: "up8", bass: "march", drum: "march", drum1: "half",
      S: {
        i: { ch: "1 7 1 7", lvl: 1, arp: "sparse" },
        A: { ch: "1 4 7 1 1 4 7 7", lvl: 1, mel: ["1 - - 1 3 - 5 -", "4 - 3 - 2 - 1 -", "7, - 2 - 4 - 2 -", "1 - - - - - . 5,"], end: "4 - 2 - 7, - - -" },
        B: { ch: "4 1 2 5 4 1 2 7", lvl: 2, mel: ["5 - 6 - 5 - 2 -", "6 - 5 - 3 - - -", "5 - 4 - 2 - 1 -", "2 - - - 5, - - -"], end: "7, - 2 - 4 - 5 -" },
        C: { ch: "1 1 4 4 1 1 7 7", lvl: 0, lead: "flute", arp: "harp", mel: ["5 - - - 1' - - -", "5 - - - - - . .", "4 - - - - - - -", "- - - - . . . ."], end: "2 - - - - - . ." }
      }, form: "i A B C A+ B+" },

    // Prélude 2 et Siège libre — Le village de Valcendre (la mineur, gigue)
    h_village: { bpm: 124, key: 69, scale: "minor", lead: "flute", alt: "pulse", arpI: "pluck", padI: "strings", bassI: "warm", kit: "pop",
      arp: "up8", bass: "oct8", drum: "jig", drum1: "soft",
      S: {
        i: { ch: "1 1 7 7", lvl: 0 },
        A: { ch: "1 7 6 5 1 7 6 5M", lvl: 1, mel: ["5 - 3 - 1 . 3 5", "4 - 2 - 7, - 2 4", "3 - 1 - 6, - 1 3", "2 - - - 7, - - -"], end: "#7, - 2 - 5 - - -" },
        B: { ch: "6 7 1 1 6 7 1 5M", lvl: 2, mel: ["1' - 7 - 6 - 5 -", "7 - 6 - 5 - 4 -", "3 - 5 - 1' - 5 -", "1' - - - - - . ."], end: "#7 - 5 - 2 - - -" },
        C: { ch: "4 4 1 1 4 4 5M 5M", lvl: 1, lead: "pulse", drum1: "jig", mel: ["4 . 4 . 6 . 4 .", "1' - - - 6 - - -", "5 - - - - - - -", "- - - - . . . ."], end: "#7 - - - - - . ." }
      }, form: "i A B C A+ B+ A+" },

    // Prélude 3 — La forêt de Brumesombre (mi dorien, mystérieux, tambours)
    h_foret: { bpm: 100, key: 64, scale: "dorian", lead: "flute", alt: "choir", arpI: "marimba", padI: "choir", bassI: "sub", kit: "tribal",
      arp: "alb", bass: "half", drum: "tribal", drum1: "tribal",
      S: {
        i: { ch: "1 4 1 4", lvl: 1, arp: "sparse" },
        A: { ch: "1 4 3 7 1 4 3 5", lvl: 1, mel: ["1 - - 2 3 - 5 -", "6 - 5 - 4 - - -", "3 - 5 - 1' - 7 -", "7 - - - 4 - - -"], end: "5 - 4 - 2 - - -" },
        B: { ch: "3 7 1 1 3 7 1 4", lvl: 2, bass: "walk", mel: ["5 - 3 - 5 - 1' -", "7 - 6 - 4 - - -", "5 - 3 - 2 - 1 -", "1 - - - - - . ."], end: "4 - 6 - 1' - - -" },
        C: { ch: "1 1 2 2 1 1 2 4", lvl: 0, lead: "choir", arp: "sparse", mel: ["5 - - - - - - -", "4 - - 3 - - - -", "2 - - - - - - -", "- - - - . . . ."], end: "6 - - - - - . ." }
      }, form: "i A B C A+ B+" },

    // Prélude 4 — Le vieux Puits (si mineur, épique)
    h_puits: { bpm: 132, key: 71, scale: "minor", lead: "choir", alt: "brass", arpI: "harp", padI: "strings", bassI: "fm", kit: "rock",
      arp: "up16", bass: "drive", drum: "drive", drum1: "half",
      S: {
        i: { ch: "1 6 1 6", lvl: 1, arp: "harp" },
        A: { ch: "1 6 3 7 1 6 3 5M", lvl: 1, mel: ["1 - 2 - 3 - 5 -", "4 - - - 3 - - -", "3 - 5 - 1' - 7 -", "6 - 5 - 4 - 2 -"], end: "#7, - 2 - 5 - - -" },
        B: { ch: "4 1 6 7 4 1 6 5M", lvl: 2, lead: "brass", mel: ["4 - 5 - 6 - 7 -", "1' - - - 5 - - -", "6 - 5 - 3 - 1 -", "2 - - - 7, - - -"], end: "5 - #7 - 2' - - -" },
        C: { ch: "6 7 1 1 6 7 1 5M", lvl: 0, mel: ["3 - - - 2 - - -", "1 - - - 7, - - -", "1 - - - 5 - - -", "- - - - . . . ."], end: "#7, - - - - - . ." }
      }, form: "i A B C A+ B+ A+" },

    // Les boss de la horde (mi mineur harmonique, tambours de guerre)
    h_boss: { bpm: 156, key: 64, scale: "harmonic", lead: "brass", alt: "pulse", arpI: "pluck", padI: "choir", bassI: "fm", kit: "rock",
      arp: "up16", bass: "gallop", drum: "rock",
      S: {
        i: { ch: "1 1", lvl: 2, drum: "tribal" },
        A: { ch: "1 6 4 5 1 6 4 5", lvl: 2, mel: ["1 - 1 3 5 - 3 -", "6 - 5 - 3 - 1 -", "4 - 6 - 1' - 6 -", "7 - 2' - 5 - - -"], end: "5 - 7 - 2' - 7 -" },
        B: { ch: "4 1 6 5 4 1 6 5", lvl: 2, lead: "pulse", mel: ["1' - 6 - 4 - 6 -", "5 - 3 - 1 - 3 -", "6 - 1' - 3' - 1' -", "7 - - - 5 - - -"], end: "2' - - - 7 - - -" },
        C: { ch: "1 1 6 6 1 1 5 5", lvl: 1, drum1: "tribal", mel: ["1 - - - . . 1 -", "3 - - - 2 - - -", "5 - - - - - - -", "- - - - . . . ."], end: "7 - - - - - . ." }
      }, form: "i A B A+ C B+" }
  };

  // ===== Compilation d'un thème en partition (une liste d'événements par double-croche) =====
  const PAD_LO = 53, ARP_LO = 55, BASS_LO = 36;
  const place = (semi, lo) => { let n = semi; while (n < lo) n += 12; while (n >= lo + 12) n -= 12; return n; };
  function compile(name) {
    const T = TRACKS[name]; if (!T) return null;
    if (T._score) return T._score;
    const sc = SCALES[T.scale] || SCALES.minor;
    const degSemi = i => sc[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);           // i : degré à partir de 0
    const chord = tok => {
      const m = /^(\d)([Mmds]?)(7?)$/.exec(tok) || [0, "1", "", ""];
      const d = +m[1] - 1, r = degSemi(d);
      let t3 = degSemi(d + 2) - r, t5 = degSemi(d + 4) - r;
      if (m[2] === "M") { t3 = 4; t5 = 7; } else if (m[2] === "m") { t3 = 3; t5 = 7; } else if (m[2] === "d") { t3 = 3; t5 = 6; } else if (m[2] === "s") { t3 = 5; t5 = 7; }
      const tones = [r, r + t3, r + t5]; if (m[3]) tones.push(degSemi(d + 6));
      return tones.map(x => x + T.key);
    };
    const note = (tok, harm) => {
      const m = /^([#b]?)(\d)([',]*)$/.exec(tok); if (!m) return null;
      let d = +m[2] - 1, oct = 0; for (const c of m[3]) oct += c === "'" ? 1 : -1;
      let acc = m[1] === "#" ? 1 : m[1] === "b" ? -1 : 0;
      if (harm) { d -= 2; acc = 0; }
      return T.key + degSemi(d) + 12 * oct + acc;
    };
    const ev = [];
    const at = (s, e) => { (ev[s] || (ev[s] = [])).push(e); };
    let s0 = 0;
    for (const entry of T.form.split(/\s+/)) {
      const plus = entry.endsWith("+"), S = T.S[entry.replace(/\+$/, "")]; if (!S) continue;
      const chords = S.ch.split(/\s+/), lvl = Math.min(3, (S.lvl || 0) + (plus ? 1 : 0));
      const lead = S.lead || T.lead, arpP = ARP[S.arp || T.arp] || ARP.up8, bassP = BASS[lvl === 0 ? (S.bass || "drone") : (S.bass || T.bass)] || BASS.half;
      const drumP = lvl === 0 ? null : DRUM[lvl === 1 ? (S.drum1 || T.drum1 || S.drum || T.drum) : (S.drum || T.drum)] || null;
      chords.forEach((ctok, bar) => {
        const b0 = s0 + bar * 16, halves = ctok.split("|");
        halves.forEach((h, hi) => {
          const len = 16 / halves.length, st = b0 + hi * len, tones = chord(h);
          // nappe : l'accord tenu
          if (T.padI) for (const t of tones.slice(0, 3)) at(st, { b: "pad", i: T.padI, n: place(t, PAD_LO), d: len, v: lvl === 0 ? 1 : 0.8 });
          // arpège
          const ar = tones.slice(0, 3).map(t => place(t, ARP_LO)).sort((a, b) => a - b), seq = [ar[0], ar[1], ar[2], ar[0] + 12, ar[1] + 12];
          for (let k = 0; k < len; k++) { const c = arpP[(hi * len + k) % 16]; if (c && c !== ".") at(st + k, { b: "arp", i: T.arpI, n: seq[+c] || seq[0], d: 1.6, v: lvl === 0 ? 0.75 : 1 }); }
          // basse
          const root = place(tones[0], BASS_LO);
          for (let k = 0; k < len; k++) {
            const c = bassP[(hi * len + k) % 16]; if (!c || c === "." || c === "-") continue;
            let hold = 1; while (k + hold < len && bassP[(hi * len + k + hold) % 16] === "-") hold++;
            const n = c === "5" ? root + (tones[2] - tones[0]) : c === "8" ? root + 12 : root;
            at(st + k, { b: "bass", i: T.bassI, n, d: Math.max(1, hold * 0.9), v: 1 });
          }
        });
        // batterie (avec un roulement toutes les 4 mesures, une cymbale en début de partie forte)
        if (drumP) {
          const fill = lvl >= 1 && chords.length >= 4 && bar === chords.length - 1;
          const pat = fill ? FILL : drumP;
          for (let k = 0; k < 16; k++) { const c = pat[k]; if (c && c !== ".") at(b0 + k, { b: "drum", k: c, v: fill ? 0.9 : 1 }); }
          if (bar === 0 && lvl >= 2) at(b0, { b: "drum", k: "c", v: 1 });
        }
        // mélodie (et harmonie à la tierce dans les reprises « + »)
        if (S.mel) {
          const bt = bar === chords.length - 1 && chords.length === 8 && S.end ? S.end : S.mel[bar % 4];
          const toks = (bt || "").trim().split(/\s+/);
          for (let k = 0; k < toks.length && k < 8; k++) {
            const tok = toks[k]; if (tok === "-" || tok === ".") continue;
            const parts = tok.split("+"), sub = 2 / parts.length;
            parts.forEach((p, pi) => {
              let d = sub; if (pi === parts.length - 1) { let j = k + 1; while (j < toks.length && toks[j] === "-") { d += 2; j++; } }
              const n = note(p, false); if (n == null) return;
              const st = b0 + k * 2 + pi * sub, vel = lvl === 0 ? 0.8 : 1;
              at(st, { b: "lead", i: plus && T.alt && entry === "B+" ? T.alt : lead, n, d, v: vel });
              if (plus) { const h = note(p, true); if (h != null) at(st, { b: "harm", i: lead, n: h, d, v: 0.75 }); }
            });
          }
        }
      });
      s0 += chords.length * 16;
    }
    T._score = { ev, len: s0 };
    return T._score;
  }

  // ===== Le son : bus par instrument, réverbération, écho, compresseur =====
  function initAudio() {
    if (ac) return;
    const AudioCtx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return;
    ac = new AudioCtx();
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    master = ac.createGain(); master.gain.value = 0;
    master.connect(comp); comp.connect(ac.destination);
    // réverbération : réponse impulsionnelle générée (bruit qui décroît, adouci)
    rev = ac.createConvolver();
    const len = Math.floor(ac.sampleRate * 2.3), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45; d[i] = lp * Math.pow(1 - i / len, 2.6); } }
    rev.buffer = ir;
    const revOut = ac.createGain(); revOut.gain.value = 0.42; rev.connect(revOut); revOut.connect(master);
    // écho (style puce son de console : filtré, qui se répète)
    delay = ac.createDelay(1); delay.delayTime.value = 0.3;
    const fb = ac.createGain(); fb.gain.value = 0.28; const df = ac.createBiquadFilter(); df.type = "lowpass"; df.frequency.value = 1700;
    const dOut = ac.createGain(); dOut.gain.value = 0.22;
    delay.connect(df); df.connect(fb); fb.connect(delay); df.connect(dOut); dOut.connect(master);
    const mk = (gain, pan, revS, delS) => {
      const g = ac.createGain(); g.gain.value = gain;
      let node = g;
      if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
      node.connect(master);
      if (revS) { const s = ac.createGain(); s.gain.value = revS; node.connect(s); s.connect(rev); }
      if (delS) { const s = ac.createGain(); s.gain.value = delS; node.connect(s); s.connect(delay); }
      return { g, base: gain };
    };
    buses = {
      lead: mk(0.62, 0.05, 0.35, 0.25), harm: mk(0.34, -0.3, 0.4, 0.1), arp: mk(0.3, -0.22, 0.3, 0.15),
      pad: mk(0.2, 0.15, 0.55, 0), bass: mk(0.55, 0, 0.06, 0), drum: mk(0.5, 0, 0.12, 0)
    };
  }

  // ----- Les instruments -----
  function env(g, t, a, peak, sus, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, Math.max(0.03, dur * 0.35));
    g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur), rel / 3);
  }
  function osc(type, f, t, end, detune) { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.setValueAtTime(detune, t); o.start(t); o.stop(end); return o; }
  function vibrato(o, t, end, depth, delayS) {
    const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delayS + 0.2);
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end);
  }
  function playNote(inst, midi, t, dur, vel, bus) {
    if (!ac || !midi || !buses) return;
    const f = m2f(midi), out = buses[bus].g, g = ac.createGain(), end = t + dur + 0.9;
    g.connect(out);
    const lp = (freq, q) => { const b = ac.createBiquadFilter(); b.type = "lowpass"; b.frequency.setValueAtTime(freq, t); if (q) b.Q.value = q; b.connect(g); return b; };
    switch (inst) {
      case "flute": {
        const fl = lp(2400), o = osc("triangle", f, t, end), o2 = osc("sine", f * 2, t, end), g2 = ac.createGain(); g2.gain.value = 0.18;
        o.connect(fl); o2.connect(g2); g2.connect(fl); vibrato(o, t, end, f * 0.006, 0.18);
        env(g, t, 0.045, 0.3 * vel, 0.8, dur, 0.18); break;
      }
      case "pulse": {
        const fl = lp(2600), a = osc("square", f, t, end, -7), b = osc("square", f, t, end, 7);
        a.connect(fl); b.connect(fl); vibrato(a, t, end, f * 0.005, 0.22);
        env(g, t, 0.01, 0.12 * vel, 0.7, dur, 0.12); break;
      }
      case "brass": {
        const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 1.5; fl.connect(g);
        fl.frequency.setValueAtTime(500, t); fl.frequency.linearRampToValueAtTime(2300, t + 0.06); fl.frequency.setTargetAtTime(1300, t + 0.06, 0.2);
        const a = osc("sawtooth", f, t, end, -6), b = osc("sawtooth", f, t, end, 6); a.connect(fl); b.connect(fl); vibrato(a, t, end, f * 0.004, 0.25);
        env(g, t, 0.03, 0.15 * vel, 0.75, dur, 0.14); break;
      }
      case "organ": {
        const fl = lp(3000);
        [[1, 0.5], [2, 0.3], [3, 0.14]].forEach(([k, a]) => { const o = osc("sine", f * k, t, end), gg = ac.createGain(); gg.gain.value = a; o.connect(gg); gg.connect(fl); });
        env(g, t, 0.02, 0.32 * vel, 0.85, dur, 0.1); break;
      }
      case "choir": {
        const a = osc("sawtooth", f, t, end, -9), b = osc("sawtooth", f, t, end, 9), mix = ac.createGain(); a.connect(mix); b.connect(mix);
        for (const [fq, q, amp] of [[650, 6, 1], [1080, 7, 0.6], [2600, 8, 0.2]]) { const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fq; bp.Q.value = q; const gg = ac.createGain(); gg.gain.value = amp; mix.connect(bp); bp.connect(gg); gg.connect(g); }
        vibrato(a, t, end, f * 0.005, 0.3);
        env(g, t, 0.14, 0.42 * vel * (bus === "pad" ? 0.7 : 1), 0.85, dur, 0.4); break;
      }
      case "strings": {
        const fl = lp(1500);
        for (const d of [-10, 0, 10]) osc("sawtooth", f, t, end + 0.6, d).connect(fl);
        env(g, t, 0.32, 0.075 * vel, 0.9, dur, 0.55); break;
      }
      case "bell": {
        const o = osc("sine", f, t, end + 0.6), mod = osc("sine", f * 3.5, t, end + 0.6), mg = ac.createGain();
        mg.gain.setValueAtTime(f * 1.6, t); mg.gain.setTargetAtTime(f * 0.1, t, 0.25); mod.connect(mg); mg.connect(o.frequency);
        o.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.26 * vel, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.01, Math.max(0.25, dur * 0.45)); break;
      }
      case "harp": case "pluck": case "marimba": {
        const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.connect(g);
        fl.frequency.setValueAtTime(inst === "pluck" ? 2800 : 3600, t); fl.frequency.setTargetAtTime(600, t, 0.12);
        const o = osc(inst === "pluck" ? "square" : inst === "harp" ? "triangle" : "sine", f, t, end); o.connect(fl);
        if (inst === "marimba") { const o4 = osc("sine", f * 4, t, end), g4 = ac.createGain(); g4.gain.setValueAtTime(0.4, t); g4.gain.setTargetAtTime(0.0001, t, 0.03); o4.connect(g4); g4.connect(fl); }
        const pk = (inst === "pluck" ? 0.1 : inst === "marimba" ? 0.3 : 0.22) * vel;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.005, inst === "harp" ? 0.28 : 0.13); break;
      }
      case "fm": {
        const fl = lp(1200), o = osc("sawtooth", f, t, end), mod = osc("square", f * 2, t, end), mg = ac.createGain();
        mg.gain.setValueAtTime(f * 1.8, t); mg.gain.setTargetAtTime(f * 0.15, t, 0.08); mod.connect(mg); mg.connect(o.frequency); o.connect(fl);
        env(g, t, 0.006, 0.34 * vel, 0.6, dur, 0.06); break;
      }
      case "sub": {
        const fl = lp(700), o = osc("triangle", f, t, end), o2 = osc("sine", f / 2, t, end), g2 = ac.createGain(); g2.gain.value = 0.5; o.connect(fl); o2.connect(g2); g2.connect(fl);
        env(g, t, 0.01, 0.55 * vel, 0.8, dur, 0.1); break;
      }
      default: { // "warm"
        const fl = lp(650, 2), o = osc("sawtooth", f, t, end), o2 = osc("square", f / 2, t, end), g2 = ac.createGain(); g2.gain.value = 0.25; o.connect(fl); o2.connect(g2); g2.connect(fl);
        env(g, t, 0.008, 0.36 * vel, 0.7, dur, 0.08);
      }
    }
  }

  // ----- Percussions -----
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 1.2), ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  const KITS = { soft: 0.6, pop: 0.85, march: 0.9, metal: 0.9, heavy: 1, rock: 1, tribal: 0.95 };
  function playDrum(k, t, vel, kit) {
    if (!ac || !buses) return;
    const out = buses.drum.g, v = vel * (KITS[kit] || 0.85), g = ac.createGain(); g.connect(out);
    const nz = (type, fq, q, peak, decay, dur) => {
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(); s.buffer = noise(); fl.type = type; fl.frequency.value = fq; if (q) fl.Q.value = q;
      s.connect(fl); fl.connect(g); g.gain.setValueAtTime(peak * v, t); g.gain.setTargetAtTime(0.0001, t + 0.002, decay); s.start(t); s.stop(t + dur);
    };
    if (k === "k") {
      const o = osc("sine", 140, t, t + 0.3); o.frequency.setTargetAtTime(42, t, 0.03); o.connect(g);
      g.gain.setValueAtTime(0.9 * v, t); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.07);
    } else if (k === "s") nz("bandpass", 1500, 0.8, 0.55, 0.05, 0.3);
    else if (k === "r") nz("bandpass", 2200, 1.2, 0.22, 0.03, 0.15);
    else if (k === "h") nz("highpass", 7500, 0, 0.12, 0.012, 0.08);
    else if (k === "o") nz("highpass", 6500, 0, 0.12, 0.07, 0.3);
    else if (k === "c") nz("highpass", 5000, 0, 0.2, 0.35, 1.2);
    else if (k === "t" || k === "T") {
      const o = osc("sine", k === "t" ? 95 : 150, t, t + 0.4); o.frequency.setTargetAtTime(k === "t" ? 60 : 95, t, 0.08); o.connect(g);
      g.gain.setValueAtTime(0.6 * v, t); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.1);
    } else if (k === "m") {
      const a = osc("square", 540, t, t + 0.4), b = osc("square", 815, t, t + 0.4), fl = ac.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 1800; fl.Q.value = 2;
      a.connect(fl); b.connect(fl); fl.connect(g); g.gain.setValueAtTime(0.18 * v, t); g.gain.setTargetAtTime(0.0001, t + 0.003, 0.06);
    }
  }

  // ----- Séquenceur (lookahead) -----
  let calm = false;
  function schedule() {
    if (!playing || !ac || !currentTrack) return;
    const T = TRACKS[currentTrack], P = compile(currentTrack); if (!T || !P) return;
    let bpm = T.bpm, tr = 0;
    if (currentTrack === "boss" && typeof bossFight !== "undefined" && bossFight) {
      if (bossFight.tier === "pure") { bpm = 172; tr = 2; } else if (bossFight.tier === "abyss") { bpm = 148; tr = -3; }
    }
    if (screen === "pause") bpm *= 0.9;
    const sd = 60 / bpm / 4;
    if (nextTime < ac.currentTime - 0.25) nextTime = ac.currentTime + 0.05;
    while (nextTime < ac.currentTime + 0.15) {
      const list = P.ev[step % P.len];
      if (list) for (const e of list) {
        if (e.b === "drum") { if (screen !== "pause") playDrum(e.k, nextTime, e.v, T.kit); }
        else playNote(e.i, e.n + tr, nextTime, e.d * sd * 0.95, e.v, e.b);
      }
      nextTime += sd; step++;
    }
  }

  // ----- Quel thème jouer -----
  function hordeTrack() {
    if (typeof siege === "undefined" || !siege || (screen !== "play" && screen !== "siegemenu" && screen !== "pause")) return undefined;
    if (siege.over && !siege.ending) return siege.over.win ? "title" : null;
    if (siege.enemies && typeof SG_ENEMIES !== "undefined" && siege.enemies.some(e => SG_ENEMIES[e.type] && SG_ENEMIES[e.type].lord && !e.dead)) return "h_boss";
    const th = (siege.map && siege.map.theme) || "village";
    return TRACKS["h_" + th] ? "h_" + th : "h_village";
  }
  let forced = null;
  function desiredTrack() {
    if (forced) return forced;
    if (typeof mode !== "undefined" && mode === "edit") return null;
    if (screen === "title" || screen === "intro") return "title";
    if (screen === "outro") return typeof outroMusic === "string" ? outroMusic : "title";
    const h = hordeTrack(); if (h !== undefined) return h;
    if (screen === "end" || (typeof player !== "undefined" && player && player.dead)) return null;
    if (typeof bossFight !== "undefined" && bossFight && bossFight.boss && !bossFight.boss.dead) return "boss";
    if (typeof miniActive !== "undefined" && miniActive && miniActive.enemy && !miniActive.enemy.dead) return "miniboss";
    if (typeof biomeShown === "string" && TRACKS[biomeShown]) return biomeShown;
    return "entree";
  }

  function update() {
    if (!ac) return;
    const want = desiredTrack();
    if (want !== currentTrack) {
      const fromSilence = !currentTrack;
      currentTrack = want; step = 0;
      nextTime = ac.currentTime + (fromSilence ? 0.05 : 0.45);
      fadeUntil = fromSilence ? 0 : ac.currentTime + 0.4;
    }
    // le répit entre deux vagues : sans batterie, plus calme
    const nowCalm = !!(typeof siege !== "undefined" && siege && siege.phase === "prep" && currentTrack && currentTrack.startsWith("h_") && currentTrack !== "h_boss");
    if (buses && nowCalm !== calm) {
      calm = nowCalm;
      buses.drum.g.gain.setTargetAtTime(calm ? 0.06 : buses.drum.base, ac.currentTime, 0.6);
      buses.lead.g.gain.setTargetAtTime(buses.lead.base * (calm ? 0.7 : 1), ac.currentTime, 0.6);
    }
    if (master) {
      const fading = ac.currentTime < fadeUntil;
      const lv = forced ? (level || 2) : level;      // la bande-son du menu joue même si la musique du jeu est coupée
      const target = (!lv || !want || fading) ? 0 : LEVEL_GAIN[lv] * (screen === "pause" || screen === "siegemenu" ? 0.5 : 1);
      master.gain.setTargetAtTime(target, ac.currentTime, fading ? 0.08 : 0.15);
    }
  }

  function unlock() {
    initAudio();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    if (!playing) { playing = true; nextTime = ac.currentTime + 0.05; timerId = setInterval(() => { update(); schedule(); }, 40); }
  }

  // Options → Musique : Activée → Douce → Coupée → Activée
  function cycle() {
    unlock();
    level = (level + 2) % 3;
    try { localStorage.setItem("lepuits.music", level === 0 ? "off" : level === 1 ? "soft" : "on"); } catch (e) {}
    update();
    return level > 0;
  }

  if (typeof addEventListener === "function")
    for (const ev of ["keydown", "pointerdown", "touchstart"]) addEventListener(ev, unlock, { passive: true });
  // une manette seule (sans clavier ni souris) déverrouille aussi le son au premier bouton
  if (typeof addEventListener === "function") addEventListener("gamepadconnected", () => {
    const poll = () => { if (playing) return; const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(g => g && g.buttons.some(b => b.pressed)); if (gp) unlock(); else setTimeout(poll, 200); };
    poll();
  });

  return {
    toggleMute: cycle, cycle, isOn: () => level > 0,
    label: () => ["Coupée", "Douce", "Activée"][level],
    track: () => currentTrack, ctx: () => { initAudio(); return ac; },
    // pour les tests
    _tracks: TRACKS, _want: () => desiredTrack(), _force: n => { forced = n; },
    // la bande-son (menu) : jouer un thème depuis le début, l'arrêter, savoir où on en est
    play: n => { unlock(); forced = n; currentTrack = null; update(); },
    stop: () => { forced = null; },
    playing: () => forced,
    pos: () => { const T = currentTrack && TRACKS[currentTrack], P = T && compile(currentTrack); if (!P) return null; const sd = 60 / T.bpm / 4; return { t: (step % P.len) * sd, len: P.len * sd }; }, _compile: compile, _length: n => { const P = compile(n), T = TRACKS[n]; return P ? P.len * 60 / T.bpm / 4 : 0; }
  };
})();
// Le bouton « Musique » est dans Options (index.html, data-act="music") : il passe par menuAction,
// comme les autres, pour marcher aussi au clavier et à la manette.
