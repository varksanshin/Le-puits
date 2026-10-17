"use strict";
// ---------- 11. HUD et atelier ----------
const $ = id => document.getElementById(id);
const skillsEl = $("skills"), heartsEl = $("hearts"), padEl = $("pad"), padWrap = $("padWrap");
const killsEl = $("kills"), itemCountEl = $("itemCount"), toastEl = $("toast");
function renderSkills() {
  skillsEl.innerHTML = SKILLS.map(s => `<div class="skill${skills[s.id] ? " on" : ""}" title="${s.name}${skills[s.id] ? "" : " (verrouillé)"}">${s.label}</div>`).join("");
}
function renderHearts() {
  if (!player) return;
  let h = "";
  for (let i = 0; i < stats.maxHp; i++) h += `<div class="heart${i < player.hp ? "" : " empty"}"></div>`;
  heartsEl.innerHTML = h;
}
function renderKills() { killsEl.textContent = `Ennemis vaincus : ${kills}/${enemySpawns.length}`; }
function renderItems() { itemCountEl.textContent = `Objets : ${items.size}`; renderAtelier(); }
let toastTimer;
function toast(msg, ms, html) {
  if (html) toastEl.innerHTML = msg; else toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
}

const skillBtns = $("skillBtns"), itemGroups = $("itemGroups");
function buildAtelier() {
  skillBtns.innerHTML = SKILLS.map(s => `<button class="btn" data-skill="${s.id}" ${s.ready ? "" : "disabled"} title="${s.ready ? "" : "Pas encore codé"}">${s.name}${s.ready ? "" : " · bientôt"}</button>`).join("");
  const groups = SKILLS.map(s => ({ title: s.name, list: ITEMS.filter(i => i.skill === s.id) }));
  groups.push({ title: "Armes", list: ITEMS.filter(i => i.cat === "lame") });
  groups.push({ title: "Butin et passifs", list: ITEMS.filter(i => i.cat === "passif") });
  groups.push({ title: "Objets mystères", list: ITEMS.filter(i => i.mystery) });
  itemGroups.innerHTML = groups.map(g => `
    <div class="group"><h3>${g.title}</h3>
      ${g.list.map(i => `<button class="btn item${i.mystery ? " mystery" : ""}" data-item="${i.id}" ${i.soon ? "disabled" : ""}>
        <strong>${i.name}${i.soon ? " · bientôt" : ""}</strong><small>${i.desc}</small></button>`).join("")}
    </div>`).join("");
  skillBtns.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    const id = b.dataset.skill;
    runTainted = true;                         // une run testée à l'atelier n'enregistre pas de record
    if (skills[id]) { skills[id] = false; for (const it of ITEMS) if (it.skill === id) removeItem(it.id); if (id === "doubleJump") player.airJumps = 0; }
    else grantSkill(id);
    computeStats(); renderSkills(); renderAtelier(); refocus(b);
  });
  itemGroups.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    const it = ITEM[b.dataset.item];
    runTainted = true;
    if (items.has(it.id)) removeItem(it.id);
    else {
      if (it.skill && !skills[it.skill]) grantSkill(it.skill);
      addItem(it.id); itemToast(it, "", true);
    }
    renderAtelier(); refocus(b);
  });
  $("clearItems").addEventListener("click", e => { for (const id of [...items]) removeItem(id); refocus(e.currentTarget); });
  $("newRun").addEventListener("click", e => { resetRun(); refocus(e.currentTarget); });
}
function renderAtelier() {
  for (const b of skillBtns.children) b.classList.toggle("on", !!skills[b.dataset.skill]);
  for (const b of itemGroups.querySelectorAll("[data-item]")) b.classList.toggle("on", items.has(b.dataset.item));
}
function refocus(b) { if (b && b.blur) b.blur(); if (running) cv.focus({ preventScroll: true }); }

const slidersEl = $("sliders"), presetsEl = $("presets"), jsonEl = $("json");
function applyTuning() {
  computeStats();
  jsonEl.textContent = JSON.stringify(tuning);
  for (const b of presetsEl.children) b.classList.toggle("on", Object.keys(PRESETS[b.dataset.p]).every(k => PRESETS[b.dataset.p][k] === tuning[k]));
  try { localStorage.setItem(STORE_KEY, JSON.stringify(tuning)); } catch (e) {}
}
function buildTuner() {
  slidersEl.innerHTML = TUNING_DEFS.map(d => `
    <div class="slider">
      <label for="t-${d.key}">${d.label}</label><output id="o-${d.key}"></output>
      <input type="range" id="t-${d.key}" min="${d.min}" max="${d.max}" step="${d.step}">
      <small>${d.hint}</small>
    </div>`).join("");
  presetsEl.innerHTML = Object.keys(PRESETS).map(n => `<button class="btn" data-p="${n}">${n}</button>`).join("");
  for (const d of TUNING_DEFS) {
    const inp = $("t-" + d.key), out = $("o-" + d.key);
    inp.addEventListener("input", () => { tuning[d.key] = +inp.value; out.textContent = d.fmt(+inp.value); applyTuning(); });
    inp.addEventListener("change", () => refocus(inp));
  }
  presetsEl.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    tuning = { ...PRESETS[b.dataset.p] }; syncSliders(); applyTuning(); refocus(b);
    toast(`Préréglage ${b.dataset.p}`, 1400);
  });
  $("copy").addEventListener("click", e => copyText(jsonEl.textContent, e.currentTarget, "Copier les valeurs", jsonEl));
  syncSliders();
}
function syncSliders() {
  for (const d of TUNING_DEFS) { $("t-" + d.key).value = tuning[d.key]; $("o-" + d.key).textContent = d.fmt(tuning[d.key]); }
}
function copyText(text, btn, label, selectEl) {
  const fallback = () => {
    if (selectEl.select) { selectEl.focus(); selectEl.select(); return; }
    const r = document.createRange(); r.selectNodeContents(selectEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  };
  try {
    navigator.clipboard.writeText(text)
      .then(() => { btn.textContent = "Copié"; setTimeout(() => btn.textContent = label, 1500); })
      .catch(fallback);
  } catch (e) { fallback(); }
}
