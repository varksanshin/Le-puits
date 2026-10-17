"use strict";
// ---------- 30. Musique 16-bits procédurale (Web Audio API) ----------
/* Séquenceur multi-pistes 16-bits avec écho stéréo, vibrato et changement de piste fluide.
   4 pistes par thème : Lead (mélodie), Arp (accords/arpèges), Bass (basse 16-bit), Drum (percussions). */

const MUSIC = (() => {
  let ac = null, master = null, delay = null, wet = null;
  let playing = false, muted = false, currentTrack = null, step = 0, nextTime = 0, timerId = null, fadeUntil = 0;
  try { muted = localStorage.getItem("lepuits.music") === "off"; } catch (e) {}

  // Convertit une note MIDI (ex: 60 = Do4) en fréquence Hz
  const m2f = n => 440 * Math.pow(2, (n - 69) / 12);

  // Notes de référence : C3=48, D3=50, E3=52, F3=53, G3=55, A3=57, B3=59 | C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71 | C5=72
  const _ = 0; // silence

  // ===== LES 8 PARTITIONS 16-BITS (Boucles de 32 ou 64 pas) =====
  const TRACKS = {
    // 1. ÉCRAN TITRE — Crépuscule en forêt (Ré mineur, doux et mystérieux)
    title: {
      bpm: 96,
      leadInst: "flute", arpInst: "harp", bassInst: "warm",
      lead: [
        69,_,72,_, 74,_,_,_, 77,_,76,_, 74,_,72,_, 69,_,_,_, 67,_,65,_, 64,_,_,_, _,_,_,_,
        62,_,65,_, 69,_,_,_, 72,_,74,_, 69,_,_,_, 67,_,65,_, 64,_,62,_, 62,_,_,_, _,_,_,_
      ],
      arp: [
        50,57,62,65, 50,57,62,65, 48,55,60,64, 48,55,60,64, 46,53,58,62, 46,53,58,62, 45,52,57,61, 45,52,57,61,
        50,57,62,65, 50,57,62,65, 53,60,65,69, 53,60,65,69, 46,53,58,62, 45,52,57,61, 50,57,62,65, 50,_,_,_
      ],
      bass: [
        38,_,_,_, _,_,38,_, 36,_,_,_, _,_,36,_, 34,_,_,_, _,_,34,_, 33,_,_,_, _,_,33,_,
        38,_,_,_, _,_,38,_, 41,_,_,_, _,_,41,_, 34,_,_,_, 33,_,_,_, 38,_,_,_, _,_,_,_
      ],
      drum: [
        "k",_,_,_, _,_,"h",_, "k",_,"h",_, "s",_,_,_, "k",_,_,_, _,_,"h",_, "k",_,"h",_, "s",_,"h",_
      ]
    },

    // 2. L'ENTRÉE LUMINEUSE — Ruines de Puits-Clair (La mineur, cristallin et aventureux)
    entree: {
      bpm: 112,
      leadInst: "flute", arpInst: "harp", bassInst: "warm",
      lead: [
        69,_,71,_, 72,_,76,_, 74,_,72,_, 71,_,_,_, 69,_,67,_, 64,_,67,_, 69,_,_,_, _,_,_,_,
        72,_,74,_, 76,_,79,_, 77,_,76,_, 74,_,72,_, 71,_,69,_, 67,_,71,_, 69,_,_,_, _,_,_,_
      ],
      arp: [
        57,64,69,64, 57,64,69,64, 55,62,67,62, 55,62,67,62, 53,60,65,60, 53,60,65,60, 52,59,64,59, 52,59,64,59,
        57,64,69,64, 55,62,67,62, 53,60,65,60, 50,57,62,57, 52,59,64,59, 52,59,64,59, 57,64,69,64, 57,64,69,_
      ],
      bass: [
        45,_,_,45, _,_,45,_, 43,_,_,43, _,_,43,_, 41,_,_,41, _,_,41,_, 40,_,_,40, _,_,40,_,
        45,_,_,_, 43,_,_,_, 41,_,_,_, 38,_,_,_, 40,_,_,40, _,_,40,_, 45,_,_,45, _,_,_,_
      ],
      drum: [
        "k",_,"h",_, "s",_,"h",_, "k",_,"h","k", "s",_,"h",_, "k",_,"h",_, "s",_,"h",_, "k",_,"h",_, "s",_,"h","h"
      ]
    },

    // 3. LES MINES ABANDONNÉES — Prison du Roi (Mi phrygien, métallique et rythmé)
    mines: {
      bpm: 122,
      leadInst: "brass", arpInst: "pluck", bassInst: "fm",
      lead: [
        64,_,65,_, 64,_,62,_, 64,_,_,_, 59,_,_,_, 64,_,65,_, 67,_,65,_, 64,_,_,_, _,_,_,_,
        69,_,67,_, 65,_,64,_, 62,_,64,_, 65,_,_,_, 64,_,62,_, 60,_,59,_, 64,_,_,_, _,_,_,_
      ],
      arp: [
        52,_,59,_, 52,_,60,_, 52,_,59,_, 52,_,55,_, 52,_,59,_, 53,_,60,_, 52,_,59,_, 52,_,_,_,
        57,_,64,_, 55,_,62,_, 53,_,60,_, 50,_,57,_, 52,_,59,_, 48,_,55,_, 52,_,59,_, 52,_,_,_
      ],
      bass: [
        28,_,28,40, _,28,29,_, 28,_,28,40, _,28,26,_, 28,_,28,40, _,29,_,29, 28,_,28,40, _,28,_,_,
        33,_,33,45, 31,_,31,43, 29,_,29,41, 26,_,26,38, 28,_,28,40, 24,_,24,36, 28,_,28,40, _,28,_,_
      ],
      drum: [
        "k",_,"h",_, "m",_,"h",_, "k","k","h",_, "s",_,"m",_, "k",_,"h",_, "m",_,"h",_, "k",_,"m","k", "s",_,"h",_
      ]
    },

    // 4. LA ZONE NOYÉE — Brume-sous-Terre (Do mineur, lent, éthéré et englouti)
    noyee: {
      bpm: 88,
      leadInst: "bell", arpInst: "harp", bassInst: "sub",
      lead: [
        72,_,_,74, 75,_,_,_, 79,_,_,77, 75,_,74,_, 72,_,_,_, 68,_,_,70, 67,_,_,_, _,_,_,_,
        68,_,_,70, 72,_,_,_, 74,_,_,75, 77,_,74,_, 75,_,_,72, 70,_,_,68, 72,_,_,_, _,_,_,_
      ],
      arp: [
        60,63,67,72, 75,72,67,63, 58,62,67,70, 74,70,67,62, 56,60,63,68, 72,68,63,60, 55,59,62,67, 71,67,62,59,
        56,60,63,68, 72,68,63,60, 58,62,65,70, 74,70,65,62, 55,60,63,67, 55,59,62,67, 60,63,67,72, 60,_,_,_
      ],
      bass: [
        36,_,_,_, _,_,_,_, 34,_,_,_, _,_,_,_, 32,_,_,_, _,_,_,_, 31,_,_,_, _,_,35,_,
        32,_,_,_, _,_,_,_, 34,_,_,_, _,_,_,_, 36,_,_,_, 31,_,_,_, 36,_,_,_, _,_,_,_
      ],
      drum: [
        "k",_,_,_, _,_,"h",_, _,_,"k",_, "s",_,_,_, "k",_,_,_, _,_,"h",_, _,_,_,_, "s",_,"h",_
      ]
    },

    // 5. LES PROFONDEURS ORGANIQUES — Jardin de la Mère-Spore (Hypnotique et bioluminescent)
    spores: {
      bpm: 118,
      leadInst: "organ", arpInst: "bell", bassInst: "fm",
      lead: [
        66,_,69,_, 70,_,73,_, 70,_,69,_, 66,_,_,_, 64,_,67,_, 70,_,69,_, 66,_,_,_, _,_,_,_,
        73,_,74,_, 73,_,70,_, 69,_,70,_, 66,_,_,_, 64,_,66,_, 67,_,64,_, 66,_,_,_, _,_,_,_
      ],
      arp: [
        54,61,64,61, 54,61,66,61, 55,62,67,62, 55,62,67,62, 52,59,64,59, 52,59,64,59, 54,61,66,61, 54,58,61,66,
        54,61,64,61, 54,61,66,61, 55,62,67,62, 52,59,64,59, 54,61,66,61, 52,58,61,58, 54,61,66,61, 54,_,_,_
      ],
      bass: [
        30,_,42,_, 30,_,42,30, 31,_,43,_, 31,_,43,31, 28,_,40,_, 28,_,40,28, 30,_,42,_, 34,_,37,_,
        30,_,42,_, 30,_,42,_, 31,_,43,_, 28,_,40,_, 30,_,42,_, 28,_,34,_, 30,_,42,_, 30,_,_,_
      ],
      drum: [
        "k",_,"h","k", _,_,"h",_, "k",_,"s",_, "h","k","h",_, "k",_,"h","k", _,_,"h",_, "k","k","s",_, "h",_,"h",_
      ]
    },

    // 6. L'ANTRE CORROMPU — Là où le puits a faim (Tension abyssale, quintes diminuées)
    antre: {
      bpm: 104,
      leadInst: "brass", arpInst: "pluck", bassInst: "sub",
      lead: [
        60,_,_,61, 66,_,_,_, 65,_,_,61, 60,_,_,_, 59,_,_,60, 63,_,_,62, 60,_,_,_, _,_,_,_,
        67,_,_,66, 61,_,_,_, 63,_,_,62, 56,_,_,_, 60,_,_,61, 59,_,_,55, 60,_,_,_, _,_,_,_
      ],
      arp: [
        48,_,54,_, 55,_,54,_, 48,_,54,_, 53,_,54,_, 47,_,53,_, 54,_,53,_, 48,_,54,_, 55,_,_,_,
        48,_,54,_, 56,_,54,_, 47,_,53,_, 56,_,53,_, 48,_,54,_, 47,_,53,_, 48,_,54,_, 48,_,_,_
      ],
      bass: [
        24,_,24,_, _,_,_,_, 25,_,25,_, _,_,_,_, 23,_,23,_, _,_,_,_, 24,_,24,_, _,_,30,_,
        24,_,24,_, 30,_,_,_, 23,_,23,_, 29,_,_,_, 24,_,25,_, 23,_,19,_, 24,_,24,_, _,_,_,_
      ],
      drum: [
        "k",_,_,"k", _,_,_,_, "m",_,_,_, "s",_,_,_, "k",_,_,"k", _,_,_,_, "m",_,_,"k", "s",_,_,"m"
      ]
    },

    // 7. MINI-BOSS — Gardiens des Reliques (150 BPM, nerveux et héroïque)
    miniboss: {
      bpm: 150,
      leadInst: "lead", arpInst: "pluck", bassInst: "fm",
      lead: [
        69,_,72,69, 74,_,72,_, 76,_,74,72, 71,_,72,_, 69,_,72,69, 77,_,76,_, 74,_,72,71, 69,_,_,_,
        72,_,76,72, 77,_,76,_, 79,_,77,76, 74,_,76,_, 81,_,79,77, 76,_,74,72, 71,_,74,71, 69,_,_,_
      ],
      arp: [
        57,64,69,64, 57,64,69,64, 55,62,67,62, 55,62,67,62, 53,60,65,60, 53,60,65,60, 52,59,64,59, 52,59,64,59,
        60,67,72,67, 60,67,72,67, 55,62,67,62, 55,62,67,62, 53,60,65,60, 50,57,62,57, 52,59,64,59, 52,56,59,64
      ],
      bass: [
        33,33,45,33, 33,33,45,33, 31,31,43,31, 31,31,43,31, 29,29,41,29, 29,29,41,29, 28,28,40,28, 28,40,38,35,
        36,36,48,36, 36,36,48,36, 31,31,43,31, 31,31,43,31, 29,29,41,29, 26,26,38,26, 28,28,40,28, 28,35,40,44
      ],
      drum: [
        "k","h","s","h", "k","k","s","h", "k","h","s","h", "k","k","s","h",
        "k","h","s","h", "k","k","s","h", "k","h","s","k", "s","s","m","s"
      ]
    },

    // 8. BOSS FINAL — Le Gardien du Puits (168 BPM, épique et implacable)
    boss: {
      bpm: 168,
      leadInst: "lead", arpInst: "brass", bassInst: "fm",
      lead: [
        62,_,65,62, 69,_,68,_, 69,_,72,69, 74,_,69,_, 70,_,69,67, 65,_,67,_, 69,_,65,64, 62,_,_,_,
        74,_,77,74, 81,_,80,_, 81,_,84,81, 86,_,81,_, 82,_,81,79, 77,_,76,74, 73,_,76,73, 74,_,_,_
      ],
      arp: [
        50,57,62,57, 50,56,62,56, 50,57,62,57, 50,58,62,58, 46,53,58,53, 43,50,55,50, 45,52,57,52, 45,49,52,57,
        62,69,74,69, 62,68,74,68, 62,69,74,69, 60,66,72,66, 58,65,70,65, 55,62,67,62, 57,61,64,69, 62,_,_,_
      ],
      bass: [
        26,26,38,26, 26,26,38,26, 26,26,38,26, 26,26,38,26, 34,34,46,34, 31,31,43,31, 33,33,45,33, 33,37,40,45,
        26,26,38,26, 32,32,44,32, 26,26,38,26, 30,30,42,30, 34,34,46,34, 31,31,43,31, 33,33,45,33, 26,_,26,_
      ],
      drum: [
        "k","h","s","h", "k","k","s","h", "k","h","s","h", "k","k","s","m",
        "k","h","s","h", "k","k","s","h", "k","k","s","k", "s","m","s","m"
      ]
    }
  };

  function initAudio() {
    if (ac) return;
    const AudioCtx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return;
    ac = new AudioCtx();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.22;

    // Écho 16-bits (Delay + Feedback + Filtre passe-bas type SNES DSP)
    delay = ac.createDelay();
    delay.delayTime.value = 0.26;
    const fb = ac.createGain(); fb.gain.value = 0.32;
    const df = ac.createBiquadFilter(); df.type = "lowpass"; df.frequency.value = 1800;
    wet = ac.createGain(); wet.gain.value = 0.28;

    delay.connect(df); df.connect(fb); fb.connect(delay);
    df.connect(wet); wet.connect(master);
    master.connect(ac.destination);
  }

  // ----- Synthétiseurs d'instruments 16-bits -----
  function playNote(inst, midi, t, dur) {
    if (!ac || !midi || muted) return;
    const freq = m2f(midi);

    if (inst === "flute" || inst === "lead" || inst === "brass" || inst === "organ") {
      const o1 = ac.createOscillator(), o2 = ac.createOscillator();
      const flt = ac.createBiquadFilter(), g = ac.createGain();
      // Deux oscillateurs légèrement désaccordés pour le grain 16-bits (Chorus/PWM)
      o1.type = inst === "flute" ? "triangle" : inst === "organ" ? "sine" : "sawtooth";
      o2.type = inst === "lead" ? "square" : "sawtooth";
      o1.frequency.setValueAtTime(freq, t);
      o2.frequency.setValueAtTime(freq * (inst === "organ" ? 2.0 : 1.004), t);

      // Vibrato léger sur les notes tenues
      const lfo = ac.createOscillator(), lfoG = ac.createGain();
      lfo.frequency.value = 5.5; lfoG.gain.value = inst === "flute" ? 2.5 : 1.8;
      lfo.connect(lfoG); lfoG.connect(o1.frequency);

      flt.type = "lowpass";
      flt.frequency.setValueAtTime(inst === "flute" ? 1600 : inst === "brass" ? 1900 : 2800, t);
      flt.Q.value = inst === "lead" ? 3 : 1;

      const peak = inst === "lead" ? 0.22 : 0.17;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(peak, t + (inst === "flute" ? 0.035 : 0.012));
      g.gain.exponentialRampToValueAtTime(peak * 0.65, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);

      o1.connect(flt); o2.connect(flt); flt.connect(g);
      g.connect(master); g.connect(delay);
      o1.start(t); o2.start(t); lfo.start(t);
      o1.stop(t + dur + 0.07); o2.stop(t + dur + 0.07); lfo.stop(t + dur + 0.07);
    }
    else if (inst === "harp" || inst === "pluck" || inst === "bell") {
      const o = ac.createOscillator(), flt = ac.createBiquadFilter(), g = ac.createGain();
      o.type = inst === "bell" ? "sine" : inst === "harp" ? "triangle" : "square";
      o.frequency.setValueAtTime(freq, t);

      if (inst === "bell") {
        // Modulation FM cristalline pour les cloches et la zone noyée
        const mod = ac.createOscillator(), modG = ac.createGain();
        mod.frequency.setValueAtTime(freq * 3.5, t);
        modG.gain.setValueAtTime(freq * 1.4, t);
        modG.gain.exponentialRampToValueAtTime(0.1, t + dur);
        mod.connect(modG); modG.connect(o.frequency);
        mod.start(t); mod.stop(t + dur + 0.15);
      }

      flt.type = "lowpass";
      flt.frequency.setValueAtTime(inst === "pluck" ? 2600 : 3400, t);
      flt.frequency.exponentialRampToValueAtTime(500, t + dur * 1.2);

      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.13, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.25);

      o.connect(flt); flt.connect(g);
      g.connect(master); g.connect(delay);
      o.start(t); o.stop(t + dur * 1.3);
    }
    else if (inst === "fm" || inst === "warm" || inst === "sub") {
      // Basse 16-bits (FM style Mega Drive ou Sub profond)
      const o = ac.createOscillator(), flt = ac.createBiquadFilter(), g = ac.createGain();
      o.type = inst === "sub" ? "triangle" : "sawtooth";
      o.frequency.setValueAtTime(freq, t);

      if (inst === "fm") {
        const mod = ac.createOscillator(), modG = ac.createGain();
        mod.type = "square"; mod.frequency.setValueAtTime(freq * 2, t);
        modG.gain.setValueAtTime(freq * 2.2, t);
        modG.gain.exponentialRampToValueAtTime(freq * 0.2, t + dur * 0.8);
        mod.connect(modG); modG.connect(o.frequency);
        mod.start(t); mod.stop(t + dur + 0.04);
      }

      flt.type = "lowpass";
      flt.frequency.setValueAtTime(inst === "fm" ? 1100 : 520, t);
      flt.frequency.exponentialRampToValueAtTime(160, t + dur);

      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.26, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);

      o.connect(flt); flt.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.04);
    }
  }

  // ----- Percussions 16-bits (Kick, Snare, Hi-Hat, Enclume métallique) -----
  let noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function playDrum(kind, t) {
    if (!ac || !kind || muted) return;
    if (kind === "k") { // Kick punchy
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(135, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 0.11);
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.15);
    } else if (kind === "s" || kind === "h") { // Snare & Hi-hat
      const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = getNoise();
      flt.type = kind === "h" ? "highpass" : "bandpass";
      flt.frequency.setValueAtTime(kind === "h" ? 6500 : 1400, t);
      const dur = kind === "h" ? 0.045 : 0.15;
      g.gain.setValueAtTime(kind === "h" ? 0.07 : 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(flt); flt.connect(g); g.connect(master);
      if (kind === "s") g.connect(delay);
      src.start(t); src.stop(t + dur + 0.01);
    } else if (kind === "m") { // Percussion d'enclume / métal (Mines & Antre)
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
      o1.type = "square"; o2.type = "sawtooth";
      o1.frequency.setValueAtTime(540, t); o2.frequency.setValueAtTime(830, t);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o1.connect(g); o2.connect(g); g.connect(delay); g.connect(master);
      o1.start(t); o2.start(t); o1.stop(t + 0.19); o2.stop(t + 0.19);
    }
  }

  // ----- Séquenceur temps-réel (Lookahead Scheduler) -----
  function schedule() {
    if (!playing || !ac || !currentTrack) return;
    const tr = TRACKS[currentTrack];
    if (!tr) return;

    // Adaptation dynamique de la musique du Boss final selon la jauge de Lumière/Ténèbres
    let bpm = tr.bpm, transpose = 0;
    if (currentTrack === "boss" && typeof bossFight !== "undefined" && bossFight) {
      if (bossFight.tier === "pure") { bpm = 182; transpose = 2; }       // Gardien enragé : plus rapide et brillant
      else if (bossFight.tier === "abyss") { bpm = 154; transpose = -3; } // Gardien dévoré : plus lourd et grave
    } else if (currentTrack === "antre" && typeof biomeShown !== "undefined" && biomeShown === "enfer") {
      bpm *= 0.9; transpose = -3;
    } else if (currentTrack === "noyee" && typeof biomeShown !== "undefined" && biomeShown === "ciel") {
      bpm *= 1.1; transpose = 7;
    } else if (screen === "pause") {
      bpm *= 0.85; // Ralentit légèrement en pause
    }

    const stepDur = (60 / bpm) / 4; // 1 double-croche (1/16)
    // Onglet en arrière-plan : le navigateur ralentit le minuteur. Au retour, on repart de maintenant
    // au lieu de jouer d'un coup toutes les notes en retard.
    if (nextTime < ac.currentTime - 0.25) nextTime = ac.currentTime + 0.05;

    while (nextTime < ac.currentTime + 0.12) {
      const i = step % tr.lead.length;
      const nLead = tr.lead[i];
      if (nLead) {
        // Calcule la durée de la note tant que les pas suivants sont vides (_)
        let hold = 1;
        while (hold < 8 && tr.lead[(i + hold) % tr.lead.length] === _) hold++;
        playNote(tr.leadInst, nLead + transpose, nextTime, stepDur * hold * 0.92);
      }
      const nArp = tr.arp[step % tr.arp.length];
      if (nArp) playNote(tr.arpInst, nArp + transpose, nextTime, stepDur * 1.4);

      const nBass = tr.bass[step % tr.bass.length];
      if (nBass) playNote(tr.bassInst, nBass + transpose, nextTime, stepDur * 1.7);

      const nDrum = tr.drum[step % tr.drum.length];
      if (nDrum && screen !== "pause") playDrum(nDrum, nextTime);

      nextTime += stepDur;
      step++;
    }
  }

  // Détecte automatiquement quelle piste jouer selon la situation dans le jeu
  function desiredTrack() {
    if (mode === "edit") return null;
    if (screen === "title" || screen === "intro") return "title";
    if (screen === "outro") return typeof outroMusic === "string" ? outroMusic : "title";
    if (screen === "end" || (player && player.dead)) return null;
    if (typeof bossFight !== "undefined" && bossFight && !bossFight.boss.dead) return "boss";
    if (typeof miniActive !== "undefined" && miniActive && !miniActive.enemy.dead) return "miniboss";
    if (biomeShown === "enfer") return "antre";                        // le royaume infernal : l'antre, plus grave et plus lent
    if (biomeShown === "ciel") return "noyee";                         // le royaume céleste : les cloches de la zone noyée, plus haut
    return (typeof biomeShown === "string" && TRACKS[biomeShown]) ? biomeShown : "entree";
  }

  function update() {
    if (!ac) return;
    const want = desiredTrack();
    if (want !== currentTrack) {
      // Changement de piste fluide : l'ancienne s'éteint en fondu, la nouvelle démarre juste après
      const fromSilence = !currentTrack;
      currentTrack = want;
      step = 0;
      nextTime = ac.currentTime + (fromSilence ? 0.05 : 0.35);
      fadeUntil = fromSilence ? 0 : ac.currentTime + 0.3;
    }
    if (master) {
      const fading = ac.currentTime < fadeUntil;
      const targetGain = (muted || !want || fading) ? 0 : (screen === "pause" ? 0.09 : 0.22);
      master.gain.setTargetAtTime(targetGain, ac.currentTime, fading ? 0.06 : 0.08);
    }
  }

  function unlock() {
    initAudio();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    if (!playing) {
      playing = true;
      nextTime = ac.currentTime + 0.05;
      timerId = setInterval(() => { update(); schedule(); }, 35);
    }
  }

  function toggleMute() {
    unlock();
    muted = !muted;
    try { localStorage.setItem("lepuits.music", muted ? "off" : "on"); } catch (e) {}
    update();
    return !muted;
  }

  // Déverrouille l'audio dès la première touche ou clic du joueur
  if (typeof addEventListener === "function")
    for (const ev of ["keydown", "pointerdown", "touchstart"]) addEventListener(ev, unlock, { passive: true });

  // ctx() : le même contexte audio sert aussi aux bruitages (js/31-sons.js)
  return { toggleMute, isOn: () => !muted, track: () => currentTrack, ctx: () => { initAudio(); return ac; } };
})();
// Le bouton « Musique » est dans Options (index.html, data-act="music") : il passe par menuAction,
// comme les autres, pour marcher aussi au clavier et à la manette.
