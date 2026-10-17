"use strict";
// ---------- 31. Bruitages 16-bits (Web Audio, générés en direct) ----------
/* Tous les sons sont synthétisés : pas de fichier à charger.
   Ils partagent le contexte audio de la musique mais ont leur propre volume et leur propre interrupteur (Options).
   Ils se branchent sur les fonctions du jeu sans les réécrire : chaque fonction est « enveloppée »
   (on appelle l'originale puis on joue le son), et quelques sons sont détectés image par image (dash, phase, tirs ennemis).
   Pour régler un son : modifier sa recette dans SFX_RECIPES. */

const SFX = (() => {
  let ac = null, out = null, noiseBuf = null, on = true;
  try { on = localStorage.getItem("lepuits.sfx") !== "off"; } catch (e) {}
  const VOLUME = 0.32;
  const last = {};                                    // anti-mitraillage : un même son pas plus d'une fois par X ms
  const counts = {}, errors = {};                                  // combien de fois chaque son a été demandé (pour les tests)

  function ready() {
    if (out) return ac.state === "running";
    if (typeof MUSIC === "undefined" || !MUSIC.ctx) return false;
    ac = MUSIC.ctx(); if (!ac) return false;
    out = ac.createGain(); out.gain.value = VOLUME;
    // petit compresseur : beaucoup de sons en même temps ne saturent pas
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.12;
    out.connect(comp); comp.connect(ac.destination);
    return ac.state === "running";
  }
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // ----- Briques de base -----
  // tone : une note qui peut glisser (f → to), avec une enveloppe courte
  function tone(t, { f, to, dur = 0.1, type = "square", vol = 0.2, attack = 0.004, vib = 0, delay = 0 }) {
    t += delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    if (vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = vib; lg.gain.value = f * 0.06; l.connect(lg); lg.connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // hiss : un souffle de bruit filtré (coups, explosions, pas, eau…)
  function hiss(t, { dur = 0.1, type = "bandpass", f = 1200, to, q = 1, vol = 0.2, attack = 0.003, delay = 0 }) {
    t += delay;
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise();
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  // arpège : une suite de notes (ramassage, relique, fanfare)
  const arp = (t, notes, step, o) => notes.forEach((f, i) => tone(t, { ...o, f, delay: (o.delay || 0) + i * step }));

  // ----- Les recettes (v = variation de 0.8 à 1.2 donnée par le jeu : taille du monstre, coup critique…) -----
  const R = {
    // Le héros
    swing:    (t, v) => hiss(t, { type: "highpass", f: 2600 * v, to: 900, dur: 0.09, vol: 0.14 }),
    swingHeavy: t => { hiss(t, { type: "bandpass", f: 500, to: 2200, dur: 0.22, vol: 0.2, q: 0.7 }); tone(t, { f: 90, to: 60, dur: 0.2, type: "sawtooth", vol: 0.08 }); },
    jump:     t => tone(t, { f: 240, to: 520, dur: 0.09, type: "square", vol: 0.06 }),
    airJump:  t => { tone(t, { f: 420, to: 950, dur: 0.12, type: "triangle", vol: 0.12 }); hiss(t, { type: "highpass", f: 5000, dur: 0.1, vol: 0.05 }); },
    land:     (t, v) => hiss(t, { type: "lowpass", f: 320 + 200 * v, dur: 0.05 + 0.05 * v, vol: 0.07 + 0.08 * v }),
    dash:     t => { hiss(t, { type: "bandpass", f: 700, to: 3800, dur: 0.16, vol: 0.18, q: 1.4 }); tone(t, { f: 180, to: 90, dur: 0.12, type: "sawtooth", vol: 0.04 }); },
    phase:    t => { tone(t, { f: 980, to: 260, dur: 0.28, type: "sine", vol: 0.14, vib: 22 }); tone(t, { f: 1470, to: 390, dur: 0.24, type: "triangle", vol: 0.05 }); },
    grapple:  t => { tone(t, { f: 1500, to: 320, dur: 0.11, type: "square", vol: 0.06 }); hiss(t, { type: "highpass", f: 3000, dur: 0.08, vol: 0.06 }); },
    grappleHit: t => { tone(t, { f: 1900, dur: 0.05, type: "square", vol: 0.07 }); tone(t, { f: 2850, dur: 0.07, type: "triangle", vol: 0.05, delay: 0.02 }); },
    bolt:     t => { tone(t, { f: 700, to: 1700, dur: 0.13, type: "sine", vol: 0.14 }); tone(t, { f: 1400, to: 2600, dur: 0.1, type: "triangle", vol: 0.05 }); },
    hurt:     t => { tone(t, { f: 360, to: 120, dur: 0.2, type: "square", vol: 0.16 }); hiss(t, { type: "bandpass", f: 900, dur: 0.12, vol: 0.14 }); },
    death:    t => { arp(t, [392, 330, 262, 196, 131], 0.13, { dur: 0.22, type: "triangle", vol: 0.16 }); hiss(t, { type: "lowpass", f: 600, to: 120, dur: 0.9, vol: 0.12 }); },
    heal:     t => arp(t, [523, 659, 784], 0.05, { dur: 0.14, type: "triangle", vol: 0.12 }),
    // L'épée et les monstres
    hit:      (t, v) => { tone(t, { f: 230 * v, to: 110 * v, dur: 0.07, type: "square", vol: 0.13 }); hiss(t, { type: "bandpass", f: 1500 * v, dur: 0.05, vol: 0.14 }); },
    crit:     t => { tone(t, { f: 300, to: 120, dur: 0.09, type: "square", vol: 0.15 }); tone(t, { f: 1760, dur: 0.12, type: "triangle", vol: 0.08 }); hiss(t, { type: "bandpass", f: 2200, dur: 0.07, vol: 0.16 }); },
    kill:     (t, v) => { hiss(t, { type: "lowpass", f: 1100 * v, to: 200, dur: 0.22, vol: 0.18 }); tone(t, { f: 320 * v, to: 55, dur: 0.18, type: "sine", vol: 0.16 }); },
    killBig:  t => { hiss(t, { type: "lowpass", f: 700, to: 90, dur: 0.5, vol: 0.26 }); tone(t, { f: 140, to: 36, dur: 0.45, type: "sine", vol: 0.24 }); },
    enemyShot: t => tone(t, { f: 640, to: 260, dur: 0.08, type: "square", vol: 0.045 }),
    // Les monstres (seulement s'ils sont à l'écran)
    golemGrowl: t => { tone(t, { f: 70, to: 55, dur: 0.45, type: "sawtooth", vol: 0.12, vib: 11 }); hiss(t, { type: "lowpass", f: 300, dur: 0.4, vol: 0.08 }); },
    golemCharge: t => { tone(t, { f: 55, to: 90, dur: 0.35, type: "square", vol: 0.08 }); hiss(t, { type: "lowpass", f: 500, dur: 0.3, vol: 0.12 }); },
    golemBonk: t => { tone(t, { f: 95, to: 40, dur: 0.3, type: "sine", vol: 0.24 }); hiss(t, { type: "bandpass", f: 700, dur: 0.15, vol: 0.18 }); },
    batScreech: t => { tone(t, { f: 2600, to: 3400, dur: 0.07, type: "square", vol: 0.04 }); tone(t, { f: 3200, to: 2200, dur: 0.08, type: "square", vol: 0.04, delay: 0.07 }); },
    spitGurgle: t => { tone(t, { f: 180, to: 320, dur: 0.3, type: "triangle", vol: 0.08, vib: 25 }); },
    hop:       t => tone(t, { f: 200, to: 480, dur: 0.12, type: "sine", vol: 0.1 }),
    hopLand:   t => hiss(t, { type: "lowpass", f: 350, dur: 0.08, vol: 0.09 }),
    boneThrow: t => { for (let i = 0; i < 3; i++) tone(t, { f: 900 + i * 220, dur: 0.035, type: "square", vol: 0.05, delay: i * 0.05 }); },
    rodeurHiss: t => hiss(t, { type: "highpass", f: 3500, to: 1800, dur: 0.35, vol: 0.09 }),
    lunge:     t => hiss(t, { type: "bandpass", f: 900, to: 2400, dur: 0.15, vol: 0.12 }),
    mimicWake: t => { tone(t, { f: 140, to: 90, dur: 0.2, type: "sawtooth", vol: 0.12 }); for (let i = 0; i < 4; i++) tone(t, { f: 620 - i * 60, dur: 0.04, type: "square", vol: 0.06, delay: 0.12 + i * 0.06 }); },
    // Le monde
    wallBreak: t => { hiss(t, { type: "lowpass", f: 900, to: 150, dur: 0.4, vol: 0.28 }); tone(t, { f: 110, to: 45, dur: 0.3, type: "sine", vol: 0.2 }); },
    dive:     t => { hiss(t, { type: "bandpass", f: 3200, to: 600, dur: 0.3, vol: 0.16, q: 1.2 }); tone(t, { f: 700, to: 180, dur: 0.25, type: "sawtooth", vol: 0.04 }); },
    slam:     (t, v) => { tone(t, { f: 150, to: 34, dur: 0.28 + 0.15 * v, type: "sine", vol: 0.26 + 0.06 * v }); hiss(t, { type: "lowpass", f: 900 + 500 * v, to: 120, dur: 0.3 + 0.12 * v, vol: 0.24 }); hiss(t, { type: "highpass", f: 2500, dur: 0.06, vol: 0.1 }); },
    quake:    t => { tone(t, { f: 120, to: 38, dur: 0.3, type: "sine", vol: 0.24 }); hiss(t, { type: "lowpass", f: 500, dur: 0.25, vol: 0.16 }); },
    pot:      t => { hiss(t, { type: "highpass", f: 2200, dur: 0.12, vol: 0.14 }); hiss(t, { type: "bandpass", f: 900, dur: 0.08, vol: 0.1, delay: 0.03 }); },
    chest:    t => { tone(t, { f: 160, to: 120, dur: 0.12, type: "sawtooth", vol: 0.07 }); arp(t, [523, 659, 784, 1047], 0.06, { dur: 0.16, type: "square", vol: 0.07, delay: 0.1 }); },
    lever:    t => { tone(t, { f: 220, dur: 0.05, type: "square", vol: 0.1 }); hiss(t, { type: "bandpass", f: 3000, dur: 0.04, vol: 0.1, delay: 0.05 }); },
    keyDoor:  t => { tone(t, { f: 1200, dur: 0.04, type: "square", vol: 0.08 }); tone(t, { f: 130, to: 95, dur: 0.35, type: "sawtooth", vol: 0.06, delay: 0.06 }); },
    crumble:  t => hiss(t, { type: "lowpass", f: 380, dur: 0.18, vol: 0.08 }),
    campfire: t => { hiss(t, { type: "bandpass", f: 900, dur: 0.6, vol: 0.06, q: 0.6 }); arp(t, [392, 494, 587, 784], 0.09, { dur: 0.3, type: "triangle", vol: 0.08 }); },
    darkTick: t => { tone(t, { f: 74, to: 62, dur: 0.6, type: "sine", vol: 0.16 }); tone(t, { f: 622, to: 587, dur: 0.5, type: "sine", vol: 0.03, vib: 6 }); },
    // Ramassage
    coin:     t => { tone(t, { f: 988, dur: 0.05, type: "square", vol: 0.06 }); tone(t, { f: 1319, dur: 0.12, type: "square", vol: 0.06, delay: 0.05 }); },
    gem:      t => arp(t, [1175, 1568, 2093], 0.04, { dur: 0.12, type: "triangle", vol: 0.09 }),
    key:      t => { tone(t, { f: 1568, dur: 0.18, type: "sine", vol: 0.1 }); tone(t, { f: 2349, dur: 0.22, type: "sine", vol: 0.06, delay: 0.05 }); },
    buy:      t => { hiss(t, { type: "highpass", f: 4000, dur: 0.06, vol: 0.08 }); arp(t, [1319, 988], 0.06, { dur: 0.1, type: "square", vol: 0.06 }); },
    item:     t => arp(t, [523, 659, 784, 1047, 1319], 0.055, { dur: 0.2, type: "triangle", vol: 0.11 }),
    relic:    t => { arp(t, [392, 523, 659, 784, 1047], 0.08, { dur: 0.35, type: "square", vol: 0.07 }); tone(t, { f: 2093, dur: 0.9, type: "sine", vol: 0.08, delay: 0.42, vib: 5 }); hiss(t, { type: "highpass", f: 6000, dur: 0.8, vol: 0.03, delay: 0.4 }); },
    // Gardiens
    miniSpawn: t => { tone(t, { f: 110, to: 62, dur: 0.7, type: "sawtooth", vol: 0.14, vib: 9 }); hiss(t, { type: "lowpass", f: 800, to: 200, dur: 0.6, vol: 0.18 }); },
    seal:     t => { tone(t, { f: 540, dur: 0.25, type: "square", vol: 0.07 }); tone(t, { f: 830, dur: 0.25, type: "sawtooth", vol: 0.05 }); hiss(t, { type: "lowpass", f: 400, dur: 0.2, vol: 0.18 }); },
    unseal:   t => { arp(t, [415, 554, 830], 0.06, { dur: 0.2, type: "square", vol: 0.06 }); },
    warn:     t => { tone(t, { f: 880, dur: 0.06, type: "triangle", vol: 0.06 }); tone(t, { f: 880, dur: 0.06, type: "triangle", vol: 0.06, delay: 0.1 }); },
    enrage:   t => { tone(t, { f: 160, to: 90, dur: 0.6, type: "sawtooth", vol: 0.15, vib: 14 }); tone(t, { f: 240, to: 130, dur: 0.6, type: "square", vol: 0.06, vib: 14 }); },
    miniBeat: t => { hiss(t, { type: "lowpass", f: 900, to: 100, dur: 0.6, vol: 0.2 }); arp(t, [523, 659, 784, 1047], 0.1, { dur: 0.3, type: "square", vol: 0.08, delay: 0.25 }); },
    rock:     t => hiss(t, { type: "lowpass", f: 500, to: 160, dur: 0.18, vol: 0.12 }),
    // Le Gardien du puits
    bossEnter: t => { tone(t, { f: 55, to: 41, dur: 1.4, type: "sawtooth", vol: 0.14, vib: 4 }); hiss(t, { type: "lowpass", f: 300, dur: 1.2, vol: 0.14 }); },
    bossBoom: t => { tone(t, { f: 90, to: 30, dur: 0.5, type: "sine", vol: 0.28 }); hiss(t, { type: "lowpass", f: 700, to: 100, dur: 0.45, vol: 0.2 }); },
    bossDeath: t => { hiss(t, { type: "lowpass", f: 1200, to: 60, dur: 1.6, vol: 0.28 }); arp(t, [262, 330, 392, 523, 659, 784, 1047], 0.12, { dur: 0.5, type: "triangle", vol: 0.1, delay: 0.5 }); },
    // Économie et nouvelles créatures (0.22)
    wheel:    t => { for (let i = 0; i < 9; i++) tone(t, { f: 1400 - i * 60, dur: 0.03, type: "square", vol: 0.04, delay: i * (0.05 + i * 0.012) }); },
    dice:     t => { for (let i = 0; i < 5; i++) hiss(t, { type: "bandpass", f: 2400 + Math.random() * 1500, q: 4, dur: 0.03, vol: 0.12, delay: i * 0.08 + Math.random() * 0.03 }); },
    steal:    t => { arp(t, [784, 622, 523, 392], 0.06, { dur: 0.15, type: "square", vol: 0.07 }); tone(t, { f: 110, to: 70, dur: 0.5, type: "sawtooth", vol: 0.1, delay: 0.25 }); },
    freed:    t => { hiss(t, { type: "highpass", f: 3000, dur: 0.2, vol: 0.06 }); arp(t, [392, 494, 587, 784], 0.07, { dur: 0.25, type: "triangle", vol: 0.1 }); },
    clang:    t => { tone(t, { f: 1800, dur: 0.18, type: "square", vol: 0.06 }); tone(t, { f: 2650, dur: 0.14, type: "triangle", vol: 0.06 }); hiss(t, { type: "highpass", f: 4000, dur: 0.06, vol: 0.1 }); },
    bell:     t => { tone(t, { f: 523, dur: 1.2, type: "sine", vol: 0.14, vib: 3 }); tone(t, { f: 1250, dur: 0.8, type: "triangle", vol: 0.05 }); tone(t, { f: 262, dur: 1.4, type: "sine", vol: 0.08 }); },
    gaze:     t => { tone(t, { f: 300, to: 900, dur: 0.6, type: "sine", vol: 0.08, vib: 7 }); tone(t, { f: 450, to: 1350, dur: 0.6, type: "triangle", vol: 0.04, vib: 7 }); },
    petrify:  t => { hiss(t, { type: "lowpass", f: 900, to: 150, dur: 0.4, vol: 0.2 }); tone(t, { f: 160, to: 80, dur: 0.35, type: "square", vol: 0.08 }); },
    burrow:   t => hiss(t, { type: "lowpass", f: 400, to: 150, dur: 0.35, vol: 0.14 }),
    erupt:    t => { hiss(t, { type: "lowpass", f: 300, to: 1200, dur: 0.25, vol: 0.2 }); tone(t, { f: 120, to: 260, dur: 0.2, type: "sawtooth", vol: 0.08 }); },
    necroRaise: t => { tone(t, { f: 180, to: 360, dur: 0.7, type: "sawtooth", vol: 0.07, vib: 11 }); hiss(t, { type: "bandpass", f: 700, to: 1800, dur: 0.6, vol: 0.06 }); },
    // Menus
    menu:     t => tone(t, { f: 1250, dur: 0.035, type: "triangle", vol: 0.05 }),
  };
  // Intervalle minimum entre deux mêmes sons (ms)
  const GAP = { golemGrowl: 300, batScreech: 200, hop: 120, hopLand: 120, boneThrow: 200, rodeurHiss: 300, spitGurgle: 250, coin: 45, gem: 60, hit: 35, kill: 50, enemyShot: 90, land: 120, warn: 120, rock: 70, crumble: 150, swing: 50, darkTick: 500 };

  function play(name, v = 1) {
    if (!on || !R[name]) return;
    counts[name] = (counts[name] || 0) + 1;
    if (!ready()) return;
    const now = ac.currentTime * 1000, gap = GAP[name] ?? 30;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    try { R[name](ac.currentTime + 0.005, v); } catch (e) { errors[name] = e.message; }
  }
  function toggle() {
    on = !on;
    try { localStorage.setItem("lepuits.sfx", on ? "on" : "off"); } catch (e) {}
    if (on) play("menu");
    return on;
  }
  return { play, toggle, isOn: () => on, names: () => Object.keys(R), counts: () => ({ ...counts }), errors: () => ({ ...errors }) };
})();

// ----- Branchement sur le jeu -----
(() => {
  // Enveloppe une fonction globale : après(args, résultat, avant) est appelé après l'originale
  const wrap = (name, before, after) => {
    let orig; try { orig = eval(name); } catch (e) { return; }                // la fonction n'existe pas : rien à brancher
    if (typeof orig !== "function") return;
    const w = function (...a) {
      const st = before ? before(...a) : null;
      const r = orig.apply(this, a);
      try { after(a, r, st); } catch (e) {}                                     // un son raté ne casse jamais le jeu
      return r;
    };
    try { eval(`${name} = w`); } catch (e) {}
  };
  const near = (x, y) => { const p = player; return !p || Math.abs(x - p.x) < VW * 0.75 && Math.abs(y - p.y) < VH * 0.75; };
  const S = SFX.play;

  // Le héros
  wrap("onSwing", null, ([p]) => S(p.atkDir === "heavy" ? "swingHeavy" : "swing", 0.9 + Math.random() * 0.25));
  wrap("doJump", null, ([air]) => S(air ? "airJump" : "jump"));
  wrap("land", () => player.y - player.fallStartY, (a, r, fall) => { if (fall > 24) S("land", Math.min(1.2, fall / 120)); });
  wrap("startGrapple", null, () => S("grapple"));
  wrap("arriveGrapple", null, () => S("grappleHit"));
  wrap("fireBolt", null, () => S("bolt"));
  wrap("hurtPlayer", () => player.hp, (a, r, hp) => { if (player.hp < hp) S(player.hp <= 0 ? "death" : "hurt"); });
  // Les coups qui portent
  wrap("hitEnemy", (e) => [e.dead || e.hidden, e.hp], ([e, dmg, dirX, o], r, [skip]) => {
    if (skip || (o && o.freeze === 0)) return;                                   // pas de son pour les dégâts sur la durée
    const v = Math.max(0.7, Math.min(1.25, 14 / Math.max(8, e.w)));             // gros monstre = son plus grave
    if (e.dead) {
      if (e.boss) S("bossDeath");
      else if (e.mini || e.type === "golem") S("killBig");
      else S("kill", v);
    } else S("hit", v);
  });
  wrap("onSwordHit", null, ([e, crit]) => { if (crit && !e.dead) S("crit"); });
  const cracks = box => { let n = 0; for (let r = Math.floor(box.y / T); r <= Math.floor((box.y + box.h) / T); r++) for (let c = Math.floor(box.x / T); c <= Math.floor((box.x + box.w) / T); c++) if (tile(c, r) === "x") n++; return n; };
  wrap("breakWalls", box => cracks(box), ([box], r, n) => { if (n && cracks(box) < n) S("wallBreak"); });
  wrap("startDive", null, () => S("dive"));
  wrap("diveSlam", () => player.y - player.diveStartY, (a, r, fall) => S("slam", Math.max(0, Math.min(1, fall / (7 * T)))));
  wrap("onHeavyStrike", null, () => { if (has("seisme") && player.onGround) S("quake"); });

  // Le monde et le butin
  wrap("breakPot", null, () => S("pot"));
  wrap("openChest", null, () => S("chest"));
  wrap("pullLever", null, () => S("lever"));
  wrap("openKeyDoor", null, () => S("keyDoor"));
  wrap("collectLoot", null, ([l]) => S(l.kind === "heart" ? "heal" : l.kind === "key" ? "key" : l.kind === "gem" ? "gem" : "coin"));
  wrap("addCoins", null, ([n]) => { if (n < 0) S("buy"); });
  wrap("grantSkill", null, () => { if (screen === "play") S("relic"); });
  wrap("addItem", null, () => { if (screen === "play") S("item"); });
  wrap("campfireSave", null, () => S("campfire"));

  // Les gardiens et le Gardien du puits
  wrap("spawnMini", null, () => { S("miniSpawn"); setTimeout(() => S("seal"), 250); });
  wrap("beatMini", null, () => S("miniBeat"));
  wrap("unsealRoom", (m) => !!(m && m.seal), (a, r, had) => { if (had) S("unseal"); });
  wrap("warn", null, ([x, y, w, kind]) => { if (kind !== "none") S("warn"); });
  wrap("enterArena", null, () => S("bossEnter"));
  wrap("bossShockwave", null, () => S("bossBoom"));
  wrap("menuAction", null, ([act]) => { if (act !== "music" && act !== "sfx") S("menu"); });

  // Détection image par image : dash, phase, tirs ennemis, pertes de lumière, rage des gardiens, sol qui s'effrite
  let was = { dash: 0, phase: 0, shots: 0, rocks: 0, tick: 0, crumbles: 0, enraged: new Set() };
  // Ce que dit un monstre quand il change d'état : [type, nouvel état] → son
  const VOICE = {
    "golem:wind": "golemGrowl", "golem:charge": "golemCharge",
    "bat:wind": "batScreech", "spitter:wind": "spitGurgle",
    "champi:air": "hop", "squelette:throw": "boneThrow",
    "rodeur:wind": "rodeurHiss", "rodeur:lunge": "lunge", "mimic:air": "hop",
    "fouisseur:dig": "burrow", "fouisseur:erupt": "erupt", "templier:wind": "golemGrowl", "templier:thrust": "lunge",
    "gorgone:wind": "gaze", "sonneur:ring": "bell", "necro:cast": "spitGurgle", "reflet:slash": "swing",
  };
  wrap("updateWorld", null, () => {
    const p = player; if (!p) return;
    for (const e of enemies) {
      if (e.dead || e.mini) { e._ps = e.state; continue; }
      if (e._ps === undefined) e._ps = "walk";                                  // tous les monstres naissent « en marche »
      if (e.state !== e._ps && near(e.x, e.y)) {
        const v = VOICE[e.type + ":" + e.state];
        if (e.type === "mimic" && !e._woke && e.state !== "sleep" && e.state !== "walk") { e._woke = true; S("mimicWake"); }   // le coffre ouvre la gueule
        else if (v) S(v);
        else if ((e.type === "champi" || e.type === "mimic") && e._ps === "air") S("hopLand");
        else if (e.type === "golem" && e._ps === "charge" && e.daze > 1) S("golemBonk");     // a percuté un mur
      }
      e._ps = e.state;
    }
    if (p.dashTimer > 0 && !(was.dash > 0)) S("dash");
    if (p.phaseTimer > 0 && !(was.phase > 0)) S("phase");
    was.dash = p.dashTimer; was.phase = p.phaseTimer;
    if (typeof shots !== "undefined") {
      if (shots.length > was.shots) {
        const s = shots[shots.length - 1];
        if (s && near(s.x, s.y)) S(s.kind === "rock" ? "rock" : "enemyShot");
      }
      was.shots = shots.length;
    }
    if (typeof darkTickFx !== "undefined") { if (darkTickFx > was.tick + 0.5) S("darkTick"); was.tick = darkTickFx; }
    if (typeof crumbling !== "undefined") { if (crumbling.size > was.crumbles) S("crumble"); was.crumbles = crumbling.size; }
    for (const e of enemies) if (e.mini && e.enraged && !was.enraged.has(e)) { was.enraged.add(e); S("enrage"); }
  });
})();
