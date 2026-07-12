'use strict';
/* =========================================================
   GESTIÓN DEL MANICOMIO — minijuego de farmeo pasivo
   ---------------------------------------------------------
   Mapa cenital del Sanatorio (assets/fondo_gestion.png, 1920x1080).
   - Asignas una CELDA (15) a cada paciente DERROTADO: su nombre
     aparece en la placa pintada y pasa a «vivir» dentro.
   - MOVIMIENTO REAL: los personajes SOLO andan por los caminos
     que marcó el usuario (grafo GNODES/GEDGES calcado de sus
     trazos rojos: patio, espina central, pasillos de celdas,
     corredor inferior...). Para ir de A a B se calcula la ruta
     (BFS) y se recorre a pie, con pausas y velocidades variables
     (estilo hormiguero). En cada CELDA solo entra su inquilino
     (y el celador).
   - RUTINA REAL: duermen en su celda de 23:00 a 07:00, comen a
     las 14:00 y a las 21:00... y las TAREAS duran tiempo real
     (1-3 horas), siguen corriendo con el juego cerrado y pagan
     PASTILLAS al completarse (bonus/vetos/horarios por lore).
   Estado en Save.gestion = { celdas, tareas, total, created }.
   ========================================================= */

/* ---------- LAS 15 CELDAS (placas medidas del PNG) ---------- */
const GCELDAS = (() => {
  const xs = [598, 668, 736, 804, 872];
  const out = [];
  for (const x of xs) out.push({ px: x, py: 466, tx: x + 21, ty: 432, nodo: 'ct' + x });      // fila arriba (pasillo A)
  for (const x of xs) out.push({ px: x, py: 556, tx: x + 21, ty: 602, nodo: 'cb' + x });      // fila abajo (pasillo A)
  for (const x of [1032, 1102, 1170, 1236, 1306]) out.push({ px: x, py: 556, tx: x + 21, ty: 602, nodo: 'cb' + x }); // pasillo B
  return out;
})();

/* ---------- GRAFO DE CAMINOS (calcado de los trazos del usuario) ---------- */
const GNODES = {
  /* patio (pasarela horizontal + fuente) */
  p1: [500, 205], p2: [640, 205], p3: [790, 205], pf: [960, 205], p4: [1120, 205], p5: [1250, 205], p6: [1350, 205],
  /* espina central (vertical que baja del patio al hall y la entrada) */
  s1: [960, 300], s2: [960, 390], s3: [960, 470], s4: [960, 510], s5: [960, 585], s6: [960, 655], s7: [960, 730], s8: [960, 800],
  /* vertical izquierda + sofás + comedor */
  lv1: [520, 390], lv2: [520, 510], lv3: [520, 610], lv4: [520, 690],
  lw: [448, 420], co: [480, 700],
  /* pasillo A (entre las dos filas de celdas) */
  aw: [560, 510],
  ac598: [619, 510], ac668: [689, 510], ac736: [757, 510], ac804: [825, 510], ac872: [893, 510],
  /* entradas de celda A (arriba y abajo) */
  ct598: [619, 432], ct668: [689, 432], ct736: [757, 432], ct804: [825, 432], ct872: [893, 432],
  cb598: [619, 602], cb668: [689, 602], cb736: [757, 602], cb804: [825, 602], cb872: [893, 602],
  /* pasillo B + celdas B */
  bw: [1000, 510],
  bc1032: [1053, 510], bc1102: [1123, 510], bc1170: [1191, 510], bc1236: [1257, 510], bc1306: [1327, 510],
  cb1032: [1053, 602], cb1102: [1123, 602], cb1170: [1191, 602], cb1236: [1257, 602], cb1306: [1327, 602],
  /* salas de tratamiento (entradas desde el pasillo B) */
  t1: [1130, 430], t2: [1310, 430], rv0: [1450, 470], t3: [1480, 418],
  /* lateral derecho (personal y despachos de la derecha) */
  be: [1385, 510], rv2: [1450, 560], per: [1482, 600], bo5: [1440, 695],
  /* corredor inferior (comedor - despacho - hall - sala de estar) */
  bo1: [560, 695], dp: [700, 695], dp2: [810, 668], bo2: [870, 695],
  bo3: [1060, 695], se: [1180, 695], se2: [1290, 665], bo4: [1370, 695]
};
const GEDGES = [
  ['p1', 'p2'], ['p2', 'p3'], ['p3', 'pf'], ['pf', 'p4'], ['p4', 'p5'], ['p5', 'p6'],
  ['pf', 's1'], ['s1', 's2'], ['s2', 's3'], ['s3', 's4'], ['s4', 's5'], ['s5', 's6'], ['s6', 's7'], ['s7', 's8'],
  ['lv1', 'lv2'], ['lv2', 'lv3'], ['lv3', 'lv4'], ['lw', 'lv1'], ['lv4', 'co'], ['lv4', 'bo1'],
  ['lv2', 'aw'], ['aw', 'ac598'], ['ac598', 'ac668'], ['ac668', 'ac736'], ['ac736', 'ac804'], ['ac804', 'ac872'], ['ac872', 's4'],
  ['ct598', 'ac598'], ['ct668', 'ac668'], ['ct736', 'ac736'], ['ct804', 'ac804'], ['ct872', 'ac872'],
  ['cb598', 'ac598'], ['cb668', 'ac668'], ['cb736', 'ac736'], ['cb804', 'ac804'], ['cb872', 'ac872'],
  ['s4', 'bw'], ['bw', 'bc1032'], ['bc1032', 'bc1102'], ['bc1102', 'bc1170'], ['bc1170', 'bc1236'], ['bc1236', 'bc1306'], ['bc1306', 'be'],
  ['cb1032', 'bc1032'], ['cb1102', 'bc1102'], ['cb1170', 'bc1170'], ['cb1236', 'bc1236'], ['cb1306', 'bc1306'],
  ['t1', 'bc1102'], ['t2', 'bc1306'], ['be', 'rv0'], ['rv0', 't3'],
  ['be', 'rv2'], ['rv2', 'per'], ['rv2', 'bo5'],
  ['bo1', 'dp'], ['dp', 'dp2'], ['dp', 'bo2'], ['bo2', 's7'],
  ['s7', 'bo3'], ['bo3', 'se'], ['se', 'se2'], ['se', 'bo4'], ['bo4', 'bo5']
];
const GVECINOS = (() => {
  const v = {};
  for (const [a, b] of GEDGES) {
    (v[a] = v[a] || []).push(b);
    (v[b] = v[b] || []).push(a);
  }
  return v;
})();

/* nodos de celda: solo puede pisarlos su inquilino (o el celador) */
const GNODOS_CELDA = new Set(GCELDAS.map(c => c.nodo));
function gDuenoDeNodo(nodo) {
  const i = GCELDAS.findIndex(c => c.nodo === nodo);
  return i >= 0 ? (Save.gestion.celdas[i] || null) : null;
}

/* ruta BFS de nodo a nodo, respetando las celdas ajenas */
function gRuta(desde, hasta, quien) {
  if (desde === hasta) return [hasta];
  const permitido = n => {
    if (!GNODOS_CELDA.has(n) || n === hasta || n === desde) return true;
    return false;   // las celdas no son de paso: solo origen o destino
  };
  const prev = { [desde]: null };
  const cola = [desde];
  while (cola.length) {
    const n = cola.shift();
    for (const m of (GVECINOS[n] || [])) {
      if (m in prev || !permitido(m)) continue;
      prev[m] = n;
      if (m === hasta) {
        const ruta = [m];
        let c = n;
        while (c) { ruta.unshift(c); c = prev[c]; }
        return ruta;
      }
      cola.push(m);
    }
  }
  return null;
}
function gNodoCercano(x, y) {
  let best = null, bd = 1e9;
  for (const [id, p] of Object.entries(GNODES)) {
    if (GNODOS_CELDA.has(id)) continue;
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

/* ---------- SALAS: nodo de trabajo + TAREA (duraciones REALES) ---------- */
const GSALAS = {
  patio: {
    nombre: 'Patio Recreativo', nodo: 'pf', paseo: ['p1', 'p2', 'p3', 'pf', 'p4', 'p5', 'p6'],
    tarea: { nombre: 'Hora de patio', dur: 60, base: 40, horario: [8, 21],
      bonus: { paquito: 2 }, banned: [],
      notas: { paquito: 'rompe camisas haciendo dominadas: ×2' } }
  },
  tratamiento: {
    nombre: 'Salas de Tratamiento', nodo: 't1', paseo: ['t1', 't2', 't3'],
    tarea: { nombre: 'Sesión de terapia', dur: 60, base: 60,
      bonus: { rabasco: 2 }, banned: ['mario'],
      notas: { rabasco: 'le liman el pico(r): ×2', mario: 'acaba psicoanalizando ÉL al médico' } }
  },
  comedor: {
    nombre: 'Comedor', nodo: 'co', paseo: ['co'],
    tarea: { nombre: 'Turno de cocina', dur: 120, base: 85,
      bonus: { kevin: 2 }, banned: ['paquito'],
      notas: { kevin: 'kebabs para toda la sala: ×2', paquito: 'se come las reservas del mes' } }
  },
  despacho: {
    nombre: 'Despacho', nodo: 'dp2', paseo: ['dp', 'dp2'],
    tarea: { nombre: 'Ordenar expedientes', dur: 180, base: 130,
      bonus: { mario: 2 }, banned: ['victor'],
      notas: { mario: 'conoce TODOS los expedientes: ×2', victor: 'lo que ordena, lo estropea' } }
  },
  salaestar: {
    nombre: 'Sala de Estar', nodo: 'se2', paseo: ['se', 'se2'],
    tarea: { nombre: 'Tarde de tele y vicio', dur: 120, base: 70, horario: [16, 24],
      bonus: { nikuman: 2 }, banned: [],
      notas: { nikuman: 'TOP 1 del ranking de la sala: ×2' } }
  },
  personal: {
    nombre: 'Sala de Personal', nodo: 'per', paseo: ['per'],
    tarea: { nombre: 'Ayudar al personal', dur: 180, base: 120,
      bonus: { jorge: 2 }, banned: ['mario'],
      notas: { jorge: 'imprime repuestos en 3D: ×2', mario: 'manipula al personal' } }
  },
  hall: {
    nombre: 'Hall y Recepción', nodo: 's7', paseo: ['s6', 's7'],
    tarea: { nombre: 'Recibir visitas', dur: 60, base: 45,
      bonus: { victor: 2 }, banned: [],
      notas: { victor: 'batallitas de motos sin parar: ×2' } }
  }
};

/* destinos de tiempo libre (con pesos: patio y zonas comunes, lo normal) */
const GPASEO_LIBRE = ['pf', 'p2', 'p3', 'p4', 'p5', 'lw', 's6', 's7', 'se', 'se2', 'co', 'dp',
  'pf', 'p3', 'p4', 's6', 'se', 'lw'];

/* ---------- VIDA: frases estilo SIMS ---------- */
const GFRASES = {
  _generic: ['pasea tranquilamente', 'mira por la ventana', 'cuenta las baldosas', 'tararea una canción',
    'se queja del menú', 'busca la salida (otra vez)', 'hace estiramientos', 'observa la fuente'],
  nikuman: ['se queja del yogur de piña', 'pulla a un celador', 'busca wifi desesperado', 'echa de menos a sus 5 gatos'],
  kevin: ['huele a kebab lejano', 'suelta un pedete sorpresa', 'sueña con dürüms', 'pregunta si hay cena doble'],
  jorge: ['imprime algo sospechoso', 'pedo silencioso... pero mortal', 'habla de WoW Classic a la pared', 'echa de menos a Peter'],
  victor: ['«arregla» un enchufe (ya no funciona)', 'echa de menos su moto', 'se aburre de su afición nueva'],
  rabasco: ['se pica él solo', 'afila el cuerno contra la pared', 'está ENCANADO por algo'],
  paquito: ['hace flexiones con una mano', 'rompe una camisa al estirarse', 'levanta un sofá para limpiar debajo'],
  mario: ['susurra un rumor nuevo', 'se recoloca el injerto', 'culpa a Fiti de algo', 'mueve los hilos desde su celda']
};
const GLIOS = ['se queja FORMALMENTE', 'intenta amotinar la sala', 'roba pastillas del carrito 💊',
  'discute por el mando de la tele', 'pinta un mote en la pared'];
const GCHARLAS = [
  ['{a} pulla a {b}', '{b} finge no oírlo'],
  ['{a} y {b} traman algo', 'mejor no preguntar'],
  ['{a} le cuenta su lore a {b}', '{b} se arrepiente de preguntar'],
  ['{a} reta a {b} al parchís', 'apuestan pastillas (prohibido)']
];

/* ---------- NPCs ---------- */
const GNPCS = [
  { id: 'celador', nombre: 'Celador', emoji: '👮', frases: ['hace la ronda', 'confisca una litrona', 'suspira profundamente'] },
  { id: 'medico', nombre: 'Médico', emoji: '👨‍⚕️', frases: ['revisa historiales', 'receta reposo', 'busca a Mario (mal asunto)'] },
  { id: 'enfermera', nombre: 'Enfermera', emoji: '👩‍⚕️', frases: ['reparte la medicación', 'regaña a alguien con cariño', 'esconde el yogur de piña'] }
];
const GNPC_INTER = ['El {n} regaña a {a}', 'La {n} le toma la tensión a {a}', 'El {n} vigila de cerca a {a}'];

/* ---------- estado en vivo ---------- */
let gBrainTimer = null, gMoveTimer = null, gLastMove = 0;
let gTokens = {};
let gAsignando = null;
const G_MIN = 60000;
const G_VEL = 30;          // velocidad de paseo (px/seg del mapa)

function gPacientes() {
  return (typeof storyEnemies === 'function' ? storyEnemies() : [])
    .filter(e => Save.story.defeated.includes(e.id));
}
function gCeldaDe(pid) {
  for (const k of Object.keys(Save.gestion.celdas)) {
    if (Save.gestion.celdas[k] === pid) return +k;
  }
  return -1;
}
function gNombreCorto(e) { return e.nombre.split(' ')[0].replace(',', ''); }

/* ---------- rutina diaria (tiempo REAL) ---------- */
function gRutina() {
  const d = new Date();
  const h = d.getHours(), m = d.getMinutes();
  if (h >= 23 || h < 7) return 'dormir';
  if ((h === 14 || h === 21) && m < 30) return 'comer';
  return null;
}

/* ---------- recompensas: tareas que terminan (también offline) ---------- */
function gTareaReward(pid, salaKey) {
  const t = GSALAS[salaKey].tarea;
  const mult = t.bonus && t.bonus[pid] ? t.bonus[pid] : 1;
  return Math.round(t.base * mult);
}
function payDueTasks() {
  const now = Date.now();
  const hechas = [];
  for (const pid of Object.keys(Save.gestion.tareas)) {
    const t = Save.gestion.tareas[pid];
    if (!GSALAS[t.sala]) { delete Save.gestion.tareas[pid]; continue; }
    if (now >= t.start + t.dur * G_MIN) {
      const premio = gTareaReward(pid, t.sala);
      Save.coins += premio;
      Save.gestion.total += premio;
      delete Save.gestion.tareas[pid];
      const e = gPacientes().find(x => x.id === pid);
      hechas.push(`${e ? gNombreCorto(e) : pid} · ${GSALAS[t.sala].tarea.nombre}: +${premio} 💊`);
    }
  }
  if (hechas.length) {
    persistSave();
    gAviso('✅ Tareas completadas:<br>' + hechas.join('<br>'));
    if (typeof Sfx !== 'undefined') Sfx.play('win');
  }
  return hechas;
}

let gAvisoTimer = null;
function gAviso(html, ms) {
  const el = document.getElementById('g-aviso');
  if (!el) return;
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(gAvisoTimer);
  gAvisoTimer = setTimeout(() => el.classList.remove('show'), ms || 4500);
}

/* ---------- ciclo de vida de la pantalla ---------- */
function openGestion() {
  if (!Save.gestion.created) { Save.gestion.created = Date.now(); persistSave(); }
  payDueTasks();
  renderGestion();
  if (!gBrainTimer) gBrainTimer = setInterval(gestionBrain, 2000);
  if (!gMoveTimer) { gLastMove = performance.now(); gMoveTimer = setInterval(gestionMove, 90); }
}
function closeGestion() {
  if (gBrainTimer) { clearInterval(gBrainTimer); gBrainTimer = null; }
  if (gMoveTimer) { clearInterval(gMoveTimer); gMoveTimer = null; }
  gAsignando = null;
}

/* ---------- render principal ---------- */
function renderGestion() {
  const pacientes = gPacientes();

  /* roster izquierdo */
  const roster = document.getElementById('g-roster');
  roster.innerHTML = pacientes.length ? '' :
    '<div class="g-empty">Vence pacientes en el Modo Historia para poder ingresarlos aquí.</div>';
  for (const e of pacientes) {
    const celda = gCeldaDe(e.id);
    const tarea = Save.gestion.tareas[e.id];
    const row = document.createElement('div');
    row.className = 'g-pac' + (celda < 0 ? ' sin-celda' : '') + (gAsignando === e.id ? ' eligiendo' : '');
    const foto = e.foto
      ? `<img src="${e.foto}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'g-pemoji',textContent:'${e.emoji}'}))">`
      : `<span class="g-pemoji">${e.emoji}</span>`;
    const estado = celda < 0 ? 'Asignar celda...'
      : tarea ? `⏳ ${GSALAS[tarea.sala].tarea.nombre} (${gTiempoRestante(tarea)})`
      : `Celda ${celda + 1} · libre`;
    row.innerHTML = `<span class="g-pfoto">${foto}</span>
      <span class="g-pinfo"><b>${gNombreCorto(e)}</b><br><span class="g-pestado">${estado}</span></span>`;
    row.addEventListener('click', () => {
      if (gCeldaDe(e.id) < 0) {
        gAsignando = gAsignando === e.id ? null : e.id;
        renderGestion();
        if (gAsignando) gAviso(`🛏️ Elige una celda libre para <b>${gNombreCorto(e)}</b> (parpadean en el plano).`);
      } else {
        openTaskChooser(e.id);
      }
    });
    roster.appendChild(row);
  }

  /* placas de las celdas */
  const celdasBox = document.getElementById('g-celdas');
  celdasBox.innerHTML = '';
  GCELDAS.forEach((c, i) => {
    const pid = Save.gestion.celdas[i];
    const d = document.createElement('div');
    d.className = 'g-celda' + (pid ? ' ocupada' : '') + (gAsignando && !pid ? ' libre-flash' : '');
    d.style.left = (c.px - 4) + 'px';
    d.style.top = (c.py - 4) + 'px';
    if (pid) {
      const e = gPacientes().find(x => x.id === pid);
      d.textContent = e ? gNombreCorto(e) : pid;
    }
    d.addEventListener('click', () => {
      if (!gAsignando || pid) return;
      Save.gestion.celdas[i] = gAsignando;
      const e = gPacientes().find(x => x.id === gAsignando);
      gAviso(`🛏️ <b>${e ? gNombreCorto(e) : ''}</b> ya vive en la celda ${i + 1}.`);
      gAsignando = null;
      persistSave();
      renderGestion();
      if (typeof Sfx !== 'undefined') Sfx.play('play');
    });
    celdasBox.appendChild(d);
  });

  /* tokens */
  const tokensBox = document.getElementById('g-tokens');
  tokensBox.innerHTML = '';
  gTokens = {};
  for (const e of pacientes) {
    const celda = gCeldaDe(e.id);
    if (celda < 0) continue;
    const c = GCELDAS[celda];
    gTokens[e.id] = gMakeToken(tokensBox, {
      id: e.id, nombre: gNombreCorto(e), foto: e.foto, emoji: e.emoji,
      x: c.tx, y: c.ty, nodo: c.nodo
    });
    gTokens[e.id].el.querySelector('.g-circ').addEventListener('click', () => openTaskChooser(e.id));
    /* si está de tarea, ya en su sala (sin animar la vuelta) */
    const t = Save.gestion.tareas[e.id];
    if (t && GSALAS[t.sala]) gTeleport(e.id, GSALAS[t.sala].nodo);
  }
  for (const n of GNPCS) {
    const nodo = GPASEO_LIBRE[Math.floor(Math.random() * GPASEO_LIBRE.length)];
    gTokens['npc_' + n.id] = gMakeToken(tokensBox, {
      id: 'npc_' + n.id, nombre: n.nombre, emoji: n.emoji, npc: true,
      x: GNODES[nodo][0], y: GNODES[nodo][1], nodo
    });
  }
  updateGestionPanels();
}

function gMakeToken(box, o) {
  const el = document.createElement('div');
  el.className = 'g-token' + (o.npc ? ' g-npc' : '');
  el.style.left = o.x + 'px';
  el.style.top = o.y + 'px';
  el.innerHTML = `
    <div class="g-circ">${o.foto
      ? `<img src="${o.foto}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'g-temoji',textContent:'${o.emoji}'}))">`
      : `<span class="g-temoji">${o.emoji}</span>`}</div>
    <div class="g-tname">${o.nombre}</div>
    <div class="g-bubble"></div>`;
  box.appendChild(el);
  return {
    el, x: o.x, y: o.y, nodo: o.nodo,             // nodo actual (o el último pisado)
    ruta: [],                                      // [{x,y,nodo}] pendientes
    vel: G_VEL * (0.85 + Math.random() * 0.35),    // cada uno con su paso
    pausaHasta: 0,
    fase: Math.random() * Math.PI * 2,             // vaivén del caminar
    nextPlan: Date.now() + 1500 + Math.random() * 5000,
    nextBubble: Date.now() + 1500 + Math.random() * 6000,
    npc: !!o.npc
  };
}

function gTeleport(id, nodo) {
  const tk = gTokens[id];
  if (!tk || !GNODES[nodo]) return;
  tk.x = GNODES[nodo][0]; tk.y = GNODES[nodo][1];
  tk.nodo = nodo; tk.ruta = [];
  tk.el.style.left = tk.x + 'px';
  tk.el.style.top = tk.y + 'px';
}

/* mandar a alguien a un nodo POR LOS CAMINOS */
function gIrA(id, nodoDestino) {
  const tk = gTokens[id];
  if (!tk) return false;
  const desde = tk.ruta.length ? tk.ruta[tk.ruta.length - 1].nodo : (tk.nodo || gNodoCercano(tk.x, tk.y));
  const ruta = gRuta(desde, nodoDestino, id);
  if (!ruta) return false;
  tk.ruta = ruta.slice(ruta[0] === desde ? 1 : 0).map(n => ({ x: GNODES[n][0], y: GNODES[n][1], nodo: n }));
  return true;
}

/* ---------- MOTOR DE MOVIMIENTO (90ms): andar por los caminos ---------- */
function gestionMove() {
  const now = performance.now();
  const dt = Math.min(0.25, (now - gLastMove) / 1000);
  gLastMove = now;
  for (const id of Object.keys(gTokens)) {
    const tk = gTokens[id];
    if (!tk.ruta.length || Date.now() < tk.pausaHasta) continue;
    const obj = tk.ruta[0];
    const dx = obj.x - tk.x, dy = obj.y - tk.y;
    const dist = Math.hypot(dx, dy);
    const paso = tk.vel * dt;
    if (dist <= paso) {
      tk.x = obj.x; tk.y = obj.y; tk.nodo = obj.nodo;
      tk.ruta.shift();
      /* pausa de hormiga: a veces se detiene un momento en el cruce */
      if (tk.ruta.length && Math.random() < 0.22) tk.pausaHasta = Date.now() + 400 + Math.random() * 1600;
    } else {
      tk.x += (dx / dist) * paso;
      tk.y += (dy / dist) * paso;
    }
    /* vaivén sutil al caminar (perpendicular al avance) */
    tk.fase += dt * 6;
    const wob = tk.ruta.length ? Math.sin(tk.fase) * 1.6 : 0;
    const px = dist > 0.01 ? -dy / Math.max(dist, 0.01) : 0;
    const py = dist > 0.01 ? dx / Math.max(dist, 0.01) : 0;
    tk.el.style.left = (tk.x + px * wob) + 'px';
    tk.el.style.top = (tk.y + py * wob) + 'px';
    tk.el.classList.toggle('andando', tk.ruta.length > 0);
  }
}

/* ---------- CEREBRO (2s): decidir qué hace cada uno ---------- */
function gestionBrain() {
  const now = Date.now();
  payDueTasks();
  const pacientes = gPacientes();
  const rutina = gRutina();

  for (const e of pacientes) {
    const tk = gTokens[e.id];
    if (!tk) continue;
    const tarea = Save.gestion.tareas[e.id];
    const celda = gCeldaDe(e.id);

    if (tarea) {
      /* trabajando: ir (si no está) y quedarse, mostrando el progreso */
      const nodoSala = GSALAS[tarea.sala].nodo;
      if (!tk.ruta.length && tk.nodo !== nodoSala) gIrA(e.id, nodoSala);
      if (now > tk.nextBubble && tk.nodo === nodoSala) {
        gBubble(e.id, `⏳ ${GSALAS[tarea.sala].tarea.nombre} · ${gTiempoRestante(tarea)}`);
        tk.nextBubble = now + 10000 + Math.random() * 6000;
      }
      continue;
    }

    if (rutina === 'dormir' && celda >= 0) {
      const nodoCelda = GCELDAS[celda].nodo;
      if (!tk.ruta.length && tk.nodo !== nodoCelda) gIrA(e.id, nodoCelda);
      if (now > tk.nextBubble) {
        gBubble(e.id, tk.nodo === nodoCelda ? '😴 Zzz...' : 'se va a dormir');
        tk.nextBubble = now + 12000 + Math.random() * 8000;
      }
      continue;
    }
    if (rutina === 'comer') {
      if (!tk.ruta.length && tk.nodo !== 'co') gIrA(e.id, 'co');
      if (now > tk.nextBubble) {
        gBubble(e.id, tk.nodo === 'co' ? '🍽️ comiendo' : 'va a comer');
        tk.nextBubble = now + 10000 + Math.random() * 6000;
      }
      continue;
    }

    /* tiempo libre: pasear POR LOS CAMINOS con calma de hormiga */
    if (!tk.ruta.length && now > tk.nextPlan) {
      let destino;
      const r = Math.random();
      if (r < 0.12 && celda >= 0) destino = GCELDAS[celda].nodo;        // un rato en su celda
      else if (r < 0.3) {
        const libres = Object.keys(GNODES).filter(n => !GNODOS_CELDA.has(n));
        destino = libres[Math.floor(Math.random() * libres.length)];   // cualquier cruce
      }
      else destino = GPASEO_LIBRE[Math.floor(Math.random() * GPASEO_LIBRE.length)];
      if (destino && GNODES[destino]) gIrA(e.id, destino);
      tk.nextPlan = now + 12000 + Math.random() * 25000;   // luego, un buen rato quieto
    }
    if (now > tk.nextBubble) {
      const otro = pacientes.find(o => o.id !== e.id && gTokens[o.id] && !Save.gestion.tareas[o.id] &&
        Math.hypot(gTokens[o.id].x - tk.x, gTokens[o.id].y - tk.y) < 90);
      if (otro && Math.random() < 0.5) {
        const ch = GCHARLAS[Math.floor(Math.random() * GCHARLAS.length)];
        gBubble(e.id, ch[0].replace('{a}', gNombreCorto(e)).replace('{b}', gNombreCorto(otro)));
        gBubble(otro.id, ch[1].replace('{a}', gNombreCorto(e)).replace('{b}', gNombreCorto(otro)));
        gTokens[otro.id].nextBubble = now + 14000;
      } else if (Math.random() < 0.14) {
        gBubble(e.id, GLIOS[Math.floor(Math.random() * GLIOS.length)], true);
      } else {
        const pool = [...(GFRASES[e.id] || []), ...GFRASES._generic];
        gBubble(e.id, pool[Math.floor(Math.random() * pool.length)]);
      }
      tk.nextBubble = now + 9000 + Math.random() * 12000;
    }
  }

  /* NPCs: rondas por los caminos (el celador puede asomarse a las celdas) */
  for (const n of GNPCS) {
    const id = 'npc_' + n.id;
    const tk = gTokens[id];
    if (!tk) continue;
    if (!tk.ruta.length && now > tk.nextPlan) {
      let destino = GPASEO_LIBRE[Math.floor(Math.random() * GPASEO_LIBRE.length)];
      if (n.id === 'celador' && Math.random() < 0.25) {
        /* ronda de celdas: se asoma a una ocupada */
        const ocupadas = Object.keys(Save.gestion.celdas).map(Number);
        if (ocupadas.length) destino = GCELDAS[ocupadas[Math.floor(Math.random() * ocupadas.length)]].nodo;
      }
      gIrA(id, destino);
      tk.nextPlan = now + 10000 + Math.random() * 20000;
    }
    if (now > tk.nextBubble) {
      const cerca = pacientes.find(o => gTokens[o.id] &&
        Math.hypot(gTokens[o.id].x - tk.x, gTokens[o.id].y - tk.y) < 100);
      if (cerca && Math.random() < 0.5) {
        const f = GNPC_INTER[Math.floor(Math.random() * GNPC_INTER.length)];
        gBubble(id, f.replace('{n}', n.nombre.toLowerCase()).replace('{a}', gNombreCorto(cerca)));
      } else {
        gBubble(id, n.frases[Math.floor(Math.random() * n.frases.length)]);
      }
      tk.nextBubble = now + 11000 + Math.random() * 12000;
    }
  }

  updateGestionPanels();
  const rows = document.querySelectorAll('#g-roster .g-pestado');
  pacientes.forEach((e, i) => {
    const el = rows[i];
    if (!el) return;
    const celda = gCeldaDe(e.id);
    const t = Save.gestion.tareas[e.id];
    el.textContent = celda < 0 ? 'Asignar celda...'
      : t ? `⏳ ${GSALAS[t.sala].tarea.nombre} (${gTiempoRestante(t)})`
      : `Celda ${celda + 1} · libre`;
  });
}

function gBubble(id, txt, lio) {
  const t = gTokens[id];
  if (!t) return;
  const b = t.el.querySelector('.g-bubble');
  b.textContent = txt;
  b.classList.toggle('lio', !!lio);
  b.classList.add('show');
  setTimeout(() => b.classList.remove('show'), 5200);
}

function gTiempoRestante(t) {
  const ms = Math.max(0, t.start + t.dur * G_MIN - Date.now());
  const m = Math.ceil(ms / G_MIN);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function updateGestionPanels() {
  const g = Save.gestion;
  const el1 = document.getElementById('g-reloj');
  if (el1 && g.created) {
    const min = Math.floor((Date.now() - g.created) / G_MIN);
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60);
    el1.textContent = d > 0 ? `${d}d ${h}h` : `${h}h ${min % 60}m`;
  }
  const el2 = document.getElementById('g-pago');
  if (el2) {
    const ts = Object.values(g.tareas);
    el2.textContent = ts.length
      ? gTiempoRestante(ts.slice().sort((a, b) => (a.start + a.dur * G_MIN) - (b.start + b.dur * G_MIN))[0])
      : '—';
  }
  const el3 = document.getElementById('g-puntos');
  if (el3) el3.textContent = `${g.total} 💊`;
}

/* ---------- elegir tarea ---------- */
function openTaskChooser(pid) {
  const e = gPacientes().find(x => x.id === pid);
  if (!e) return;
  const ov = document.getElementById('gtask-overlay');
  const body = document.getElementById('gtask-body');
  const actual = Save.gestion.tareas[pid];
  const hora = new Date().getHours();
  const ocupadas = {};
  for (const [opid, t] of Object.entries(Save.gestion.tareas)) {
    if (opid !== pid) ocupadas[t.sala] = opid;
  }
  document.getElementById('gtask-title').textContent = `📋 Tareas para ${gNombreCorto(e)}`;
  body.innerHTML = (actual
    ? `<p class="lore">Ahora mismo: <b>${GSALAS[actual.sala].tarea.nombre}</b> (${gTiempoRestante(actual)} restantes).</p>
       <button class="small-btn danger" id="gtask-cancel">✖ Cancelar tarea (sin recompensa)</button><hr class="g-hr">`
    : '') +
    Object.entries(GSALAS).map(([key, s]) => {
      const t = s.tarea;
      const vetado = t.banned.includes(pid);
      const fueraHorario = t.horario && !(hora >= t.horario[0] && hora < t.horario[1]);
      const ocupada = ocupadas[key];
      const premio = gTareaReward(pid, key);
      const bonus = t.bonus && t.bonus[pid];
      let estado = '';
      if (vetado) estado = `🚫 ${t.notas[pid] || 'No puede hacer esta tarea'}`;
      else if (fueraHorario) estado = `🕐 Solo de ${t.horario[0]}:00 a ${t.horario[1]}:00`;
      else if (ocupada) {
        const oe = gPacientes().find(x => x.id === ocupada);
        estado = `⏳ Ocupada por ${oe ? gNombreCorto(oe) : 'otro paciente'}`;
      }
      const ok = !vetado && !fueraHorario && !ocupada;
      return `<div class="gtask-row ${ok ? '' : 'off'}">
        <div class="gt-info"><b>${s.nombre}</b> — ${t.nombre}<br>
          <span class="gt-meta">${t.dur >= 60 ? `${t.dur / 60}h` : `${t.dur}m`} ·
            <b class="gt-premio">${premio} 💊</b>${bonus ? ` <span class="gt-bonus">★ ${t.notas[pid]}</span>` : ''}</span>
          ${estado ? `<br><span class="gt-off">${estado}</span>` : ''}
        </div>
        ${ok ? `<button class="small-btn gt-go" data-sala="${key}">Asignar</button>` : ''}
      </div>`;
    }).join('');

  body.querySelectorAll('.gt-go').forEach(b => b.addEventListener('click', () => {
    const sala = b.dataset.sala;
    Save.gestion.tareas[pid] = { sala, start: Date.now(), dur: GSALAS[sala].tarea.dur };
    persistSave();
    ov.classList.add('hidden');
    gIrA(pid, GSALAS[sala].nodo);   // va andando por los pasillos
    gBubble(pid, `va a: ${GSALAS[sala].tarea.nombre}`);
    if (typeof Sfx !== 'undefined') Sfx.play('play');
  }));
  const cancel = body.querySelector('#gtask-cancel');
  if (cancel) cancel.addEventListener('click', () => {
    delete Save.gestion.tareas[pid];
    persistSave();
    ov.classList.add('hidden');
  });
  ov.classList.remove('hidden');
  if (typeof fitOverlays === 'function') fitOverlays();
}

function initGestion() {
  document.getElementById('btn-gestion').addEventListener('click', () => showScreen('gestion-screen'));
  document.getElementById('gtask-close').addEventListener('click', () =>
    document.getElementById('gtask-overlay').classList.add('hidden'));
  payDueTasks();
}
