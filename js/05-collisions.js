"use strict";
// ---------- 4. Collisions ----------
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const lerp = (a, b, k) => a + (b - a) * k;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function rectSolid(x, y, w, h) {
  const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.01) / T), r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.01) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(tile(c, r))) return true;
  return false;
}
function touchingSpikes(b) {
  const c0 = Math.floor(b.x / T), c1 = Math.floor((b.x + b.w - 0.01) / T), r0 = Math.floor(b.y / T), r1 = Math.floor((b.y + b.h - 0.01) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++)
    if (tile(c, r) === "^" && overlap(b, { x: c * T + 1, y: r * T + 7, w: T - 2, h: 9 })) return true;
  return false;
}
function moveX(b, dx) {
  b.x += dx;
  const r0 = Math.floor(b.y / T), r1 = Math.floor((b.y + b.h - 0.01) / T);
  if (dx > 0) {
    const c = Math.floor((b.x + b.w - 0.01) / T);
    for (let r = r0; r <= r1; r++) if (solidFor(b, tile(c, r))) { b.x = c * T - b.w; b.vx = 0; b.hitWall = true; return; }
  } else if (dx < 0) {
    const c = Math.floor(b.x / T);
    for (let r = r0; r <= r1; r++) if (solidFor(b, tile(c, r))) { b.x = (c + 1) * T; b.vx = 0; b.hitWall = true; return; }
  }
}
// Le corps chevauche-t-il un obstacle (grilles comprises) ?
function bodyStuck(b) {
  const c0 = Math.floor(b.x / T), c1 = Math.floor((b.x + b.w - 0.01) / T), r0 = Math.floor(b.y / T), r1 = Math.floor((b.y + b.h - 0.01) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solidFor(null, tile(c, r))) return true;
  return false;
}
// Ligne de vue entre deux points (les grilles laissent passer le regard et le grappin)
function lineClear(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5);
  for (let i = 1; i < n; i++) if (solid(tile(Math.floor(lerp(x0, x1, i / n) / T), Math.floor(lerp(y0, y1, i / n) / T)))) return false;
  return true;
}
function moveY(b, dy) {
  const prevBottom = b.y + b.h; b.y += dy; b.onGround = false; b.onPlat = null;
  const c0 = Math.floor(b.x / T), c1 = Math.floor((b.x + b.w - 0.01) / T);
  if (dy > 0) {
    const r = Math.floor((b.y + b.h - 0.01) / T);
    for (let c = c0; c <= c1; c++) {
      const t = tile(c, r), top = r * T;
      if (solidFor(b, t) || (t === "-" && !b.fly && !(b.dropTimer > 0) && prevBottom <= top + 0.5)) {
        b.y = top - b.h; b.vy = 0; b.onGround = true; return;
      }
    }
    if (b.plats && !(b.dropTimer > 0)) for (const pl of buckets) {
      if (b.x + b.w > pl.x && b.x < pl.x + pl.w && prevBottom <= pl.y + 0.5 && b.y + b.h >= pl.y) {
        b.y = pl.y - b.h; b.vy = 0; b.onGround = true; b.onPlat = pl; return;
      }
    }
  } else if (dy < 0) {
    const r = Math.floor(b.y / T);
    for (let c = c0; c <= c1; c++) if (solidFor(b, tile(c, r))) {
      if (b.cornerFix) for (let n = 1; n <= 5; n++) for (const s of [-1, 1]) {
        if (!rectSolid(b.x + s * n, b.y, b.w, b.h)) { b.x += s * n; return; }
      }
      b.y = (r + 1) * T; b.vy = 0; b.bonk = true; return;
    }
  }
}
