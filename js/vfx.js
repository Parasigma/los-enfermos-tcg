'use strict';
/* =========================================================
   VFX — MOTOR DE PARTÍCULAS EN CANVAS (efectos espectaculares)
   ---------------------------------------------------------
   Humo realista, llamaradas, electricidad y magia (verde de
   cura, morada, roja, pedos...). Usa mezcla ADITIVA para el
   brillo, como los juegos de verdad. Coordenadas de VENTANA
   en px (igual que el resto de efectos de ui.js). Si algo
   falla, no rompe el juego (todo va en try/catch ligero).
   Intensidad ajustable: cantidades y vidas de cada receta.
   ========================================================= */

const VFX = (() => {
  let canvas, ctx, dpr = 1, running = false, last = 0;
  const parts = [];   // partículas (humo / brillos / chispas)
  const bolts = [];   // rayos de electricidad

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];

  /* colores base en "r,g,b" para poder añadir alfa dinámico */
  const COL = {
    white: '255,255,255', warm: '255,240,200',
    fireA: '255,225,130', fireB: '255,140,45', fireC: '235,70,30', ember: '255,175,80',
    smoke: '155,155,160', smokeDark: '60,60,66',
    green: '90,255,130', greenSoft: '175,255,190',
    purple: '190,120,255', purpleSoft: '220,175,255',
    teal: '110,240,220', red: '255,80,60', redDark: '200,40,30',
    elec: '150,210,255', elecW: '235,245,255',
    fart: '175,220,95', fartB: '140,200,70', gold: '255,210,90'
  };
  const CLAZZ = {
    sanatorio: COL.teal, manonegra: COL.red, mofeta: COL.fartB,
    fuga: COL.fireB, monzo: COL.purple, recuerdos: COL.gold,
    impreso: COL.purpleSoft, token: COL.gold, neutral: COL.teal
  };
  function clazzOf(id) { return (typeof CARDS !== 'undefined' && CARDS[id]) ? CARDS[id].clazz : null; }
  function colorsFor(id) { return CLAZZ[clazzOf(id)] || CLAZZ.neutral; }

  /* ---------- canvas + bucle ---------- */
  function init() {
    if (canvas || !document.body) return;
    canvas = document.createElement('canvas');
    canvas.id = 'vfx-canvas';
    Object.assign(canvas.style, {
      position: 'fixed', left: '0', top: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '385'
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }
  function ensure() {
    if (!canvas) init();
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frame(dt);
    if (parts.length || bolts.length) requestAnimationFrame(loop);
    else running = false;
  }

  function frame(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    /* 1) humo, mezcla normal (debe verse denso, no sumado) */
    ctx.globalCompositeOperation = 'source-over';
    for (const p of parts) if (p.kind === 'smoke') drawSmoke(p);

    /* 2) brillos y chispas, mezcla ADITIVA (fuego/magia/rayos brillan) */
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) if (p.kind !== 'smoke') drawGlow(p);
    for (const b of bolts) drawBolt(b);

    ctx.globalCompositeOperation = 'source-over';

    /* update + cull */
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      bolts[i].life -= dt;
      if (bolts[i].life <= 0) bolts.splice(i, 1);
    }
  }

  function drawSmoke(p) {
    const t = 1 - p.life / p.max;
    const r = p.r0 + (p.r1 - p.r0) * t;
    const a = p.a0 * Math.sin(Math.max(0, Math.min(1, t)) * Math.PI); // entra y sale suave
    if (a <= 0.002 || r <= 0) return;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, `rgba(${p.c},${a})`);
    g.addColorStop(0.55, `rgba(${p.c},${a * 0.5})`);
    g.addColorStop(1, `rgba(${p.c},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
  }

  function drawGlow(p) {
    const t = 1 - p.life / p.max;
    const r = p.r0 + (p.r1 - p.r0) * t;
    if (!(r > 0) || !isFinite(p.x) || !isFinite(p.y)) return;
    let a = p.a0 * (1 - t);
    if (p.flicker) a *= 0.65 + Math.random() * 0.35;
    if (a <= 0.002 || r <= 0) return;
    if (p.streak) {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const lx = p.x - p.vx / sp * r * 3, ly = p.y - p.vy / sp * r * 3;
      const g = ctx.createLinearGradient(lx, ly, p.x, p.y);
      g.addColorStop(0, `rgba(${p.c},0)`);
      g.addColorStop(1, `rgba(${p.c},${a})`);
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, r); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke();
    } else {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(${p.c},${a})`);
      g.addColorStop(0.35, `rgba(${p.c},${a * 0.65})`);
      g.addColorStop(1, `rgba(${p.c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
    }
  }

  function drawBolt(b) {
    const a = (b.life / b.max) * (0.7 + Math.random() * 0.3);
    ctx.strokeStyle = `rgba(${b.c},${a})`;
    ctx.lineWidth = b.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = `rgba(${COL.elec},${a})`; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(b.pts[0][0], b.pts[0][1]);
    for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ---------- helpers de emisión ---------- */
  function P(o) {
    o.max = o.life;
    if (o.drag == null) o.drag = 0.92;
    o.vx = o.vx || 0; o.vy = o.vy || 0;
    o.ax = o.ax || 0; o.ay = o.ay || 0;
    if (o.r1 == null) o.r1 = o.r0;
    if (o.a0 == null) o.a0 = 0.9;
    parts.push(o);
  }
  function spark(x, y, vx, vy, c, life) {
    P({ kind: 'glow', streak: true, x, y, vx, vy, ay: rnd(80, 220), drag: 0.9, r0: rnd(2, 3.6), r1: 0.5, a0: 0.95, c, life });
  }
  function boltPath(x1, y1, x2, y2, segs, jit) {
    const pts = [[x1, y1]];
    const nx = -(y2 - y1), ny = (x2 - x1), nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < segs; i++) {
      const t = i / segs, bx = x1 + (x2 - x1) * t, by = y1 + (y2 - y1) * t;
      const off = (Math.random() - 0.5) * jit * (1 - Math.abs(t - 0.5));
      pts.push([bx + nx / nl * off, by + ny / nl * off]);
    }
    pts.push([x2, y2]);
    return pts;
  }

  /* ===================== RECETAS ===================== */

  /* HUMO realista: nubes grises que suben, se expanden y se disipan */
  function smoke(x, y, o) {
    o = o || {};
    const c = o.tint || COL.smoke, n = o.n || 7, sz = o.size || 11;
    for (let i = 0; i < n; i++) {
      P({
        kind: 'smoke', x: x + rnd(-9, 9), y: y + rnd(-6, 6),
        vx: rnd(-16, 16) + (o.driftX || 0), vy: -(o.rise || 30) - rnd(0, 26),
        ay: rnd(6, 14), drag: 0.93,
        r0: sz * rnd(0.7, 1.1), r1: sz * rnd(4.2, 6.2),
        a0: o.alpha || 0.36, c, life: o.life || rnd(1.0, 1.35)
      });
    }
    ensure();
  }

  /* LLAMARADA: lenguas de fuego que suben y se encogen + brasas */
  function fire(x, y, o) {
    o = o || {}; const n = o.n || 16;
    P({ kind: 'glow', x, y, vy: -30, r0: o.core || 24, r1: 3, a0: 0.8, c: COL.fireA, life: 0.32, drag: 0.9 });
    for (let i = 0; i < n; i++) {
      P({
        kind: 'glow', x: x + rnd(-12, 12), y: y + rnd(-4, 8),
        vx: rnd(-30, 30), vy: -(45 + rnd(0, 95)), ay: -25, drag: 0.95,
        r0: 6 + rnd(0, 11), r1: 0, a0: 0.92, flicker: true,
        c: pick([COL.fireA, COL.fireB, COL.ember, COL.fireC]), life: 0.35 + rnd(0, 0.4)
      });
    }
    for (let i = 0; i < 6; i++) spark(x + rnd(-8, 8), y, rnd(-40, 40), -(120 + rnd(0, 160)), COL.ember, 0.4 + rnd(0, 0.3));
    if (o.big) smoke(x, y - 10, { tint: COL.smokeDark, n: 5, rise: 40, size: 13, alpha: 0.25 });
    ensure();
  }

  /* IMPACTO de ataque: destello + chispas radiales afiladas */
  function impact(x, y, o) {
    o = o || {}; const c = o.c || COL.warm;
    P({ kind: 'glow', x, y, r0: 8, r1: 40, a0: 0.85, c: COL.white, life: 0.2, drag: 1 });
    P({ kind: 'glow', x, y, r0: 5, r1: 26, a0: 0.7, c, life: 0.28, drag: 1 });
    const n = o.n || 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rnd(180, 400);
      spark(x, y, Math.cos(a) * s, Math.sin(a) * s, pick([COL.white, COL.warm, c]), 0.22 + rnd(0, 0.18));
    }
    ensure();
  }

  /* golpe pequeño (daño suelto) */
  function hit(x, y, c) {
    c = c || COL.warm;
    P({ kind: 'glow', x, y, r0: 4, r1: 20, a0: 0.7, c, life: 0.22, drag: 1 });
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.283, s = rnd(120, 260); spark(x, y, Math.cos(a) * s, Math.sin(a) * s, c, 0.2); }
    ensure();
  }

  /* MAGIA: núcleo que florece + orbes que salen girando + chispitas */
  function magic(x, y, color, o) {
    o = o || {}; const c = color || COL.teal, big = o.big;
    P({ kind: 'glow', x, y, r0: 10, r1: big ? 90 : 58, a0: 0.68, c, life: big ? 0.55 : 0.42, drag: 1 });
    const n = (o.n || 14) * (big ? 1.7 : 1);
    for (let i = 0; i < n; i++) {
      const a = (6.283 * i) / n + rnd(-0.3, 0.3), s = rnd(70, big ? 230 : 160);
      P({
        kind: 'glow', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, ay: 60, drag: 0.9,
        r0: rnd(5, 11), r1: 1, a0: 0.92, flicker: true,
        c: pick([c, c, COL.white]), life: 0.5 + rnd(0, 0.5)
      });
    }
    for (let i = 0; i < 9; i++) P({ kind: 'glow', x: x + rnd(-40, 40), y: y + rnd(-40, 40), vx: rnd(-10, 10), vy: -(20 + rnd(0, 40)), r0: rnd(1.5, 3), r1: 0.5, a0: 0.95, flicker: true, c: pick([COL.white, c]), life: 0.4 + rnd(0, 0.4) });
    ensure();
  }

  /* ELECTRICIDAD: rayos quebrados + chispas azules + destello */
  function electric(x, y, o) {
    o = o || {}; const n = o.n || 3;
    for (let k = 0; k < n; k++) {
      const sx = x + rnd(-45, 45), sy = y - rnd(85, 150);
      const life = rnd(0.09, 0.17);
      bolts.push({ pts: boltPath(sx, sy, x, y, 8, 46), c: COL.elecW, w: rnd(1.6, 2.8), life, max: life });
      if (Math.random() < 0.6) { // ramita
        const mid = Math.random() < 0.5 ? 3 : 5, [mx, my] = boltPath(sx, sy, x, y, 8, 46)[mid];
        const l2 = life * 0.7;
        bolts.push({ pts: boltPath(mx, my, mx + rnd(-40, 40), my + rnd(-30, 30), 4, 30), c: COL.elec, w: 1.4, life: l2, max: l2 });
      }
    }
    P({ kind: 'glow', x, y, r0: 6, r1: 42, a0: 0.7, c: COL.elec, life: 0.18, drag: 1 });
    for (let i = 0; i < 12; i++) { const a = Math.random() * 6.283, s = rnd(140, 340); spark(x, y, Math.cos(a) * s, Math.sin(a) * s, COL.elecW, 0.22); }
    ensure();
  }

  /* CURA: aura verde que se expande + destellos verdes que suben */
  function heal(x, y) {
    P({ kind: 'glow', x, y, r0: 12, r1: 72, a0: 0.5, c: COL.green, life: 0.6, drag: 1 });
    for (let i = 0; i < 14; i++) {
      P({
        kind: 'glow', x: x + rnd(-28, 28), y: y + rnd(0, 14),
        vx: rnd(-14, 14), vy: -(45 + rnd(0, 65)), drag: 0.95,
        r0: rnd(3, 7), r1: 1, a0: 0.9, flicker: true,
        c: pick([COL.green, COL.greenSoft, COL.white]), life: 0.7 + rnd(0, 0.5)
      });
    }
    ensure();
  }

  /* MUERTE: bocanada oscura + esquirlas rojizas que se dispersan */
  function death(x, y) {
    smoke(x, y, { tint: COL.smokeDark, n: 6, rise: 18, size: 12, alpha: 0.42, life: 1.0 });
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * 6.283, s = rnd(60, 200);
      P({ kind: 'glow', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, ay: 320, drag: 0.9, r0: rnd(2.5, 5), r1: 0.5, a0: 0.85, c: pick([COL.red, COL.ember, COL.smoke]), life: 0.4 + rnd(0, 0.35) });
    }
    ensure();
  }

  /* PEDO: nube verdosa densa que sube (mazo del Mofeta) */
  function fart(x, y, o) {
    o = o || {};
    smoke(x, y, { tint: pick([COL.fart, COL.fartB]), n: o.big ? 12 : 8, rise: 24, size: o.big ? 15 : 12, alpha: 0.36, life: o.big ? 1.35 : 1.15, driftX: rnd(-8, 8) });
    for (let i = 0; i < (o.big ? 8 : 4); i++) P({ kind: 'glow', x: x + rnd(-16, 16), y: y + rnd(-8, 8), vx: rnd(-14, 14), vy: -(20 + rnd(0, 40)), r0: rnd(3, 6), r1: 0.5, a0: 0.55, c: COL.fart, life: 0.6 + rnd(0, 0.4) });
    ensure();
  }

  /* despacha el efecto de un hechizo según la carta (clase o especial) */
  const SPECIAL = {
    terapiaChoque: (x, y) => electric(x, y, { n: 4 }),
    ciborg: (x, y) => electric(x, y),
    cauntuHacker: (x, y) => electric(x, y),
    mandoGamer: (x, y) => electric(x, y, { n: 2 }),
    odioFiti: (x, y) => fire(x, y, { n: 22, big: true }),
    gritoEncane: (x, y) => fire(x, y, { n: 18 }),
    rageQuit: (x, y) => fire(x, y, { n: 16 }),
    brote: (x, y) => magic(x, y, COL.purple, { big: true }),
    pedoDefinitivo: (x, y) => fart(x, y, { big: true }),
    pedoAtomico: (x, y) => fart(x, y, { big: true }),
    pedoCaotico: (x, y) => fart(x, y, { big: true }),
    festivalRandom: (x, y) => { fire(x, y, { n: 10 }); magic(x, y, COL.purple); },
    jugarClassic: (x, y) => magic(x, y, COL.gold, { big: true })
  };
  function spell(x, y, id, big) {
    if (SPECIAL[id]) return SPECIAL[id](x, y);
    const cl = clazzOf(id);
    if (cl === 'mofeta') return fart(x, y, { big });
    if (cl === 'fuga') return fire(x, y, { n: big ? 20 : 14, big });
    if (cl === 'manonegra') return magic(x, y, COL.red, { big });
    if (cl === 'monzo' || cl === 'impreso') return magic(x, y, COL.purple, { big });
    return magic(x, y, colorsFor(id), { big });
  }

  if (typeof document !== 'undefined') {
    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);
  }

  return {
    smoke, fire, impact, hit, magic, electric, heal, death, fart, spell,
    finisher: (x, y, c) => magic(x, y, c, { big: true }),
    colorsFor, clazzColors: CLAZZ, COL
  };
})();
