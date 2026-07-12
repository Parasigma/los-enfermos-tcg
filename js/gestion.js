'use strict';
/* =========================================================
   GESTIÓN DEL MANICOMIO — minijuego de farmeo pasivo
   ---------------------------------------------------------
   Mapa cenital del Sanatorio (assets/fondo_gestion.png, 1920x1080).
   - Asignas una CELDA (15) a cada paciente DERROTADO en la historia:
     su nombre aparece en la placa pintada y pasa a «vivir» dentro.
   - Los residentes hacen vida en TIEMPO REAL estilo SIMS: pasean
     entre salas, hacen cosas (bocadillo bajo el token), charlan si
     coinciden... y a veces la lían (quejas, peleas, robos).
   - Cada SALA tiene una TAREA con duración real (minutos u horas,
     sigue corriendo con el juego cerrado) que farmea PASTILLAS al
     completarse. Con requisitos: bonus por paciente (lore), pacientes
     vetados y horarios concretos.
   - NPCs (celador, médico, enfermera) rondan e interactúan.
   Estado en Save.gestion = { celdas, tareas, total, created }.
   ========================================================= */

/* ---------- LAS 15 CELDAS (placas medidas del PNG) ----------
   px,py = placa del nombre · tx,ty = donde se planta el token */
const GCELDAS = (() => {
  const xs = [598, 668, 736, 804, 872];
  const out = [];
  for (const x of xs) out.push({ px: x, py: 466, tx: x + 21, ty: 435 });   // pasillo A, fila de arriba
  for (const x of xs) out.push({ px: x, py: 556, tx: x + 21, ty: 600 });   // pasillo A, fila de abajo
  for (const x of [1032, 1102, 1170, 1236, 1306]) out.push({ px: x, py: 556, tx: x + 21, ty: 600 }); // pasillo B
  return out;
})();

/* ---------- SALAS: puntos de paseo + TAREA de cada una ---------- */
const GSALAS = {
  patio: {
    nombre: 'Patio Recreativo', anchors: [[960, 200], [700, 170], [1240, 170], [880, 245]],
    tarea: {
      nombre: 'Hora de patio', dur: 30, base: 25, horario: [8, 21],
      bonus: { paquito: 2 }, banned: [],
      notas: { paquito: 'rompe camisas haciendo dominadas: ×2' }
    }
  },
  tratamiento: {
    nombre: 'Salas de Tratamiento', anchors: [[1130, 430], [1310, 430], [1480, 410]],
    tarea: {
      nombre: 'Sesión de terapia', dur: 60, base: 60,
      bonus: { rabasco: 2 }, banned: ['mario'],
      notas: { rabasco: 'le liman el pico(r): ×2', mario: 'acaba psicoanalizando ÉL al médico' }
    }
  },
  comedor: {
    nombre: 'Comedor', anchors: [[480, 690]],
    tarea: {
      nombre: 'Turno de cocina', dur: 45, base: 40,
      bonus: { kevin: 2 }, banned: ['paquito'],
      notas: { kevin: 'kebabs para toda la sala: ×2', paquito: 'se come las reservas del mes' }
    }
  },
  despacho: {
    nombre: 'Despacho', anchors: [[700, 690], [800, 660]],
    tarea: {
      nombre: 'Ordenar expedientes', dur: 120, base: 90,
      bonus: { mario: 2 }, banned: ['victor'],
      notas: { mario: 'conoce TODOS los expedientes: ×2', victor: 'lo que ordena, lo estropea' }
    }
  },
  salaestar: {
    nombre: 'Sala de Estar', anchors: [[1180, 690], [1290, 660]],
    tarea: {
      nombre: 'Tarde de tele y vicio', dur: 30, base: 20, horario: [16, 24],
      bonus: { nikuman: 2 }, banned: [],
      notas: { nikuman: 'TOP 1 del ranking de la sala: ×2' }
    }
  },
  personal: {
    nombre: 'Sala de Personal', anchors: [[1480, 600]],
    tarea: {
      nombre: 'Ayudar al personal', dur: 90, base: 70,
      bonus: { jorge: 2 }, banned: ['mario'],
      notas: { jorge: 'imprime repuestos en 3D: ×2', mario: 'manipula al personal' }
    }
  },
  hall: {
    nombre: 'Hall y Recepción', anchors: [[960, 655], [920, 730]],
    tarea: {
      nombre: 'Recibir visitas', dur: 60, base: 45,
      bonus: { victor: 2 }, banned: [],
      notas: { victor: 'batallitas de motos sin parar: ×2' }
    }
  }
};

/* puntos de paseo generales (pasillos, sofás, fuente...) */
const GPASEOS = [
  [740, 510], [1190, 510], [960, 480], [960, 590], [440, 420], [440, 250],
  ...GSALAS.patio.anchors, ...GSALAS.hall.anchors, [1180, 690], [480, 690]
];

/* ---------- VIDA: frases estilo SIMS (por paciente + genéricas) ---------- */
const GFRASES = {
  _generic: ['pasea tranquilamente', 'mira por la ventana', 'cuenta las baldosas', 'tararea una canción',
    'se queja del menú', 'busca la salida (otra vez)', 'hace estiramientos', 'observa la fuente'],
  nikuman: ['se queja del yogur de piña', 'pulla a un celador', 'busca wifi desesperado', 'echa de menos a sus 5 gatos', 'está TOP 1 en quejarse'],
  kevin: ['huele a kebab lejano', 'suelta un pedete sorpresa', 'sueña con dürüms', 'pregunta si hay cena doble'],
  jorge: ['imprime algo sospechoso', 'pedo silencioso... pero mortal', 'habla de WoW Classic a la pared', 'echa de menos a Peter'],
  victor: ['«arregla» un enchufe (ya no funciona)', 'echa de menos su moto', 'se aburre de su afición nueva', 'culpa a la electricidad estática'],
  rabasco: ['se pica él solo', 'afila el cuerno contra la pared', 'está ENCANADO por algo', 'reta a todos con la mirada'],
  paquito: ['hace flexiones con una mano', 'rompe una camisa al estirarse', 'levanta un sofá para limpiar debajo', 'dobla una cuchara sin querer'],
  mario: ['susurra un rumor nuevo', 'se recoloca el injerto', 'culpa a Fiti de algo', 'mueve los hilos desde su celda']
};
/* travesuras (lo que sale mal) */
const GLIOS = ['se queja FORMALMENTE', 'intenta amotinar la sala', 'roba pastillas del carrito 💊',
  'discute por el mando de la tele', 'pinta un mote en la pared'];
/* charlas entre dos residentes que coinciden */
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
let gTimer = null;
let gTokens = {};        // pid -> { el, bubble, x, y, nextMove, nextBubble }
let gAsignando = null;   // paciente pendiente de celda
const G_MIN = 60000;

function gPacientes() {
  /* pacientes disponibles: enemigos de la historia DERROTADOS */
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

/* ---------- recompensas: tareas que terminan (también offline) ---------- */
function gTareaReward(pid, salaKey) {
  const t = GSALAS[salaKey].tarea;
  const m = t.bonus && t.bonus[pid] ? t.bonus[pid] : 1;
  return Math.round(t.base * m);
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

/* aviso flotante dentro de la pantalla de gestión */
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
  if (!gTimer) gTimer = setInterval(gestionTick, 2000);
}
function closeGestion() {
  if (gTimer) { clearInterval(gTimer); gTimer = null; }
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

  /* placas de las celdas (nombre + zona clicable) */
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

  /* tokens: residentes con celda + NPCs */
  const tokensBox = document.getElementById('g-tokens');
  tokensBox.innerHTML = '';
  gTokens = {};
  for (const e of pacientes) {
    const celda = gCeldaDe(e.id);
    if (celda < 0) continue;
    gTokens[e.id] = gMakeToken(tokensBox, {
      id: e.id, nombre: gNombreCorto(e), foto: e.foto, emoji: e.emoji,
      x: GCELDAS[celda].tx, y: GCELDAS[celda].ty
    });
    gTokens[e.id].el.addEventListener('click', () => openTaskChooser(e.id));
    /* si está de tarea, plántalo en su sala */
    const t = Save.gestion.tareas[e.id];
    if (t && GSALAS[t.sala]) {
      const a = GSALAS[t.sala].anchors[0];
      gMoveToken(e.id, a[0], a[1], true);
    }
  }
  for (const n of GNPCS) {
    gTokens['npc_' + n.id] = gMakeToken(tokensBox, {
      id: 'npc_' + n.id, nombre: n.nombre, emoji: n.emoji, npc: true,
      x: GPASEOS[Math.floor(Math.random() * GPASEOS.length)][0],
      y: GPASEOS[Math.floor(Math.random() * GPASEOS.length)][1]
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
  return { el, x: o.x, y: o.y, nextMove: Date.now() + 2000 + Math.random() * 6000, nextBubble: Date.now() + 1000 + Math.random() * 5000, npc: !!o.npc };
}

function gMoveToken(id, x, y, instant) {
  const t = gTokens[id];
  if (!t) return;
  if (instant) t.el.style.transition = 'none';
  else t.el.style.transition = 'left 3.5s linear, top 3.5s linear';
  t.el.style.left = x + 'px';
  t.el.style.top = y + 'px';
  t.x = x; t.y = y;
  if (instant) void t.el.offsetWidth;
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

/* ---------- el tick: vida en tiempo real ---------- */
function gestionTick() {
  const now = Date.now();
  payDueTasks();
  const pacientes = gPacientes();

  for (const e of pacientes) {
    const tk = gTokens[e.id];
    if (!tk) continue;
    const tarea = Save.gestion.tareas[e.id];
    if (tarea) {
      /* trabajando: quieto en su sala, con el progreso en el bocadillo */
      if (now > tk.nextBubble) {
        gBubble(e.id, `⏳ ${GSALAS[tarea.sala].tarea.nombre} · ${gTiempoRestante(tarea)}`);
        tk.nextBubble = now + 9000 + Math.random() * 5000;
      }
      continue;
    }
    /* tiempo libre: pasear y hacer cosas */
    if (now > tk.nextMove) {
      const p = GPASEOS[Math.floor(Math.random() * GPASEOS.length)];
      gMoveToken(e.id, p[0] + (Math.random() * 40 - 20), p[1] + (Math.random() * 24 - 12));
      tk.nextMove = now + 9000 + Math.random() * 14000;
    }
    if (now > tk.nextBubble) {
      /* ¿charla con alguien cerca? */
      const otro = pacientes.find(o => o.id !== e.id && gTokens[o.id] && !Save.gestion.tareas[o.id] &&
        Math.hypot(gTokens[o.id].x - tk.x, gTokens[o.id].y - tk.y) < 120);
      if (otro && Math.random() < 0.5) {
        const ch = GCHARLAS[Math.floor(Math.random() * GCHARLAS.length)];
        gBubble(e.id, ch[0].replace('{a}', gNombreCorto(e)).replace('{b}', gNombreCorto(otro)));
        gBubble(otro.id, ch[1].replace('{a}', gNombreCorto(e)).replace('{b}', gNombreCorto(otro)));
        gTokens[otro.id].nextBubble = now + 12000;
      } else if (Math.random() < 0.14) {
        gBubble(e.id, GLIOS[Math.floor(Math.random() * GLIOS.length)], true);
      } else {
        const pool = [...(GFRASES[e.id] || []), ...GFRASES._generic];
        gBubble(e.id, pool[Math.floor(Math.random() * pool.length)]);
      }
      tk.nextBubble = now + 8000 + Math.random() * 10000;
    }
  }

  /* NPCs: rondan e interactúan */
  for (const n of GNPCS) {
    const tk = gTokens['npc_' + n.id];
    if (!tk) continue;
    if (now > tk.nextMove) {
      const p = GPASEOS[Math.floor(Math.random() * GPASEOS.length)];
      gMoveToken('npc_' + n.id, p[0] + (Math.random() * 40 - 20), p[1] + (Math.random() * 24 - 12));
      tk.nextMove = now + 8000 + Math.random() * 12000;
    }
    if (now > tk.nextBubble) {
      const cerca = pacientes.find(o => gTokens[o.id] &&
        Math.hypot(gTokens[o.id].x - tk.x, gTokens[o.id].y - tk.y) < 130);
      if (cerca && Math.random() < 0.5) {
        const f = GNPC_INTER[Math.floor(Math.random() * GNPC_INTER.length)];
        gBubble('npc_' + n.id, f.replace('{n}', n.nombre.toLowerCase()).replace('{a}', gNombreCorto(cerca)));
      } else {
        gBubble('npc_' + n.id, n.frases[Math.floor(Math.random() * n.frases.length)]);
      }
      tk.nextBubble = now + 10000 + Math.random() * 12000;
    }
  }

  updateGestionPanels();
  /* el roster muestra tiempos: refresco ligero de estados */
  document.querySelectorAll('#g-roster .g-pestado').forEach((el, i) => {
    const e = pacientes[i];
    if (!e) return;
    const celda = gCeldaDe(e.id);
    const t = Save.gestion.tareas[e.id];
    el.textContent = celda < 0 ? 'Asignar celda...'
      : t ? `⏳ ${GSALAS[t.sala].tarea.nombre} (${gTiempoRestante(t)})`
      : `Celda ${celda + 1} · libre`;
  });
}

function gTiempoRestante(t) {
  const ms = Math.max(0, t.start + t.dur * G_MIN - Date.now());
  const m = Math.ceil(ms / G_MIN);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function updateGestionPanels() {
  const g = Save.gestion;
  /* tiempo transcurrido desde la apertura del manicomio */
  const el1 = document.getElementById('g-reloj');
  if (el1 && g.created) {
    const min = Math.floor((Date.now() - g.created) / G_MIN);
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60);
    el1.textContent = d > 0 ? `${d}d ${h}h` : `${h}h ${min % 60}m`;
  }
  /* siguiente pago: la tarea que antes termine */
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

/* ---------- elegir tarea (ventana con la UI del juego) ---------- */
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
    const a = GSALAS[sala].anchors[0];
    gMoveToken(pid, a[0], a[1]);
    gBubble(pid, `va a: ${GSALAS[sala].tarea.nombre}`);
    renderGestion();
    if (typeof Sfx !== 'undefined') Sfx.play('play');
  }));
  const cancel = body.querySelector('#gtask-cancel');
  if (cancel) cancel.addEventListener('click', () => {
    delete Save.gestion.tareas[pid];
    persistSave();
    ov.classList.add('hidden');
    renderGestion();
  });
  ov.classList.remove('hidden');
  if (typeof fitOverlays === 'function') fitOverlays();
}

function initGestion() {
  document.getElementById('btn-gestion').addEventListener('click', () => showScreen('gestion-screen'));
  document.getElementById('gtask-close').addEventListener('click', () =>
    document.getElementById('gtask-overlay').classList.add('hidden'));
  /* recogida offline: si hay tareas terminadas al arrancar, se pagan */
  payDueTasks();
}
