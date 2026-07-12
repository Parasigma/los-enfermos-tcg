'use strict';
/* =========================================================
   UI — renderizado, drag & drop, flecha de objetivo,
   animaciones y sonidos.
   ========================================================= */

let G = null;
let busy = false; // true durante el turno de la IA o animaciones bloqueantes

/* dispositivo táctil (móvil/tablet): sin vista previa de hover — el
   toque disparaba mouseenter y dejaba la carta gigante clavada a la
   derecha. En táctil se inspecciona con pulsación larga. */
const IS_TOUCH = window.matchMedia && window.matchMedia('(hover: none)').matches;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------------- SONIDO (WebAudio sintetizado) ---------------- */
const Sfx = {
  ctx: null,
  enabled: true,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return this.ctx;
  },
  tone(freq, dur, type, vol, when = 0) {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const gnode = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    gnode.gain.setValueAtTime(vol, t);
    gnode.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gnode); gnode.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  },
  play(name) {
    if (!this.enabled) return;
    switch (name) {
      case 'draw': this.tone(600, 0.08, 'triangle', 0.10); break;
      case 'play': this.tone(300, 0.12, 'triangle', 0.14); this.tone(450, 0.15, 'triangle', 0.10, 0.05); break;
      case 'attack': this.tone(150, 0.15, 'sawtooth', 0.16); this.tone(90, 0.2, 'square', 0.10, 0.03); break;
      case 'damage': this.tone(120, 0.12, 'square', 0.12); break;
      case 'heal': this.tone(500, 0.12, 'sine', 0.12); this.tone(750, 0.18, 'sine', 0.10, 0.08); break;
      case 'death': this.tone(200, 0.3, 'sawtooth', 0.10); this.tone(100, 0.4, 'sawtooth', 0.08, 0.1); break;
      case 'turn': this.tone(400, 0.12, 'triangle', 0.12); this.tone(600, 0.2, 'triangle', 0.10, 0.1); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, i * 0.15)); break;
      case 'lose': [400, 350, 300, 200].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.10, i * 0.2)); break;
      case 'equip': this.tone(250, 0.15, 'square', 0.10); this.tone(350, 0.15, 'square', 0.08, 0.08); break;
      case 'land': this.tone(85, 0.16, 'sine', 0.22); this.tone(55, 0.22, 'sine', 0.14, 0.03); break;
      case 'magic': this.tone(720, 0.12, 'sine', 0.10); this.tone(1080, 0.18, 'sine', 0.08, 0.07); break;
    }
  }
};

/* ---------------- MÚSICA DE FONDO (suave, para acompañar) ----------------
   Dos pistas en bucle: 'menus' (menús) y 'bg' (tablero). Suena bajita y
   respeta el ajuste de sonido. El navegador solo deja arrancar audio tras
   un gesto del usuario: se desbloquea con el primer clic (ver main.js). */
const Music = {
  vol: 0.3,
  unlocked: false,
  want: null,
  ducked: false,
  els: {},
  el(name) {
    if (!this.els[name]) {
      const a = new Audio('assets/sounds/music/' + name + '.mp3');
      a.loop = true; a.preload = 'auto'; a.volume = this.vol;
      this.els[name] = a;
    }
    return this.els[name];
  },
  _target() { return this.ducked ? this.vol * 0.1 : this.vol; },
  set(name) {
    this.want = name;
    if (!Sfx.enabled) { this.pauseAll(); return; }
    if (!this.unlocked) return;               // arrancará en el primer gesto
    this.pauseAll(name);
    const a = this.el(name);
    a.volume = this._target();
    if (a.paused) a.play().catch(() => {});
  },
  pauseAll(except) {
    for (const k in this.els) if (k !== except) { try { this.els[k].pause(); } catch (e) {} }
  },
  duck(on) {                                  // baja el volumen mientras habla un personaje
    this.ducked = on;
    for (const k in this.els) this.els[k].volume = this._target();
  },
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.want) this.set(this.want);
  },
  refresh() {                                 // al cambiar el ajuste de sonido
    if (!Sfx.enabled) this.pauseAll();
    else if (this.want) this.set(this.want);
  }
};

/* ---------------- EFECTOS ENCOLADOS DESDE EL MOTOR ---------------- */
const fxQueue = [];
Hooks.fx = (type, data) => fxQueue.push({ type, data });
Hooks.log = msg => {
  const el = document.createElement('div');
  el.className = 'log-line';
  el.textContent = msg;
  $('#log').appendChild(el);
  $('#log').scrollTop = $('#log').scrollHeight;
};
Hooks.gameOver = winner => {
  setTimeout(() => showEnd(winner), 900);
};

/* ---------------- CONSTRUCCIÓN DE ELEMENTOS ---------------- */

/* ilustración con respaldo: si la imagen no existe aún, se ve el emoji.
   Las cartas DIAMANTE usan una ilustración ANIMADA (webp) de
   assets/ilustraciones/diamond/<id>.webp; si no existe, cae a la normal. */
function artHTML(d, variant) {
  const base = (typeof ILUSTRACIONES !== 'undefined' && ILUSTRACIONES[d.id]) || null;
  const emoji = `<span class="art-emoji">${d.emoji}</span>`;
  if (variant === 'diamond') {
    const webp = 'assets/ilustraciones/diamond/' + d.id + '.webp';
    const onerr = base
      ? `this.onerror=function(){this.remove()};this.src='${base}'`
      : `this.remove()`;
    return `<img class="art-img" src="${webp}" alt=""
       onload="this.parentElement.classList.add('has-img')"
       onerror="${onerr}">${emoji}`;
  }
  const img = base
    ? `<img class="art-img" src="${base}" alt=""
         onload="this.parentElement.classList.add('has-img')"
         onerror="this.remove()">`
    : '';
  return `${img}${emoji}`;
}

/* partículas de energía que suben en bucle (cartas DIAMANTE) */
function diamondSparklesHTML() {
  return '<div class="dia-fx"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>';
}

function cardInnerHTML(c) {
  const d = c.def || c;
  const variant = (typeof cardVariant === 'function') ? cardVariant(c.id || d.id) : null;
  const cost = (c.def && typeof c.costMod === 'number') ? cardCost(c) : d.cost;
  const discounted = c.def && c.costMod < 0;
  let stats = '';
  if (d.type === 'minion') {
    stats = `<div class="stat atk">${d.attack}</div><div class="stat hp">${d.health}</div>`;
  } else if (d.type === 'weapon') {
    stats = `<div class="stat atk">${d.attack}</div><div class="stat dur">${d.durability}</div>`;
  }
  /* clasificación: a qué mazo/expansión pertenece la carta */
  const si = typeof cardSetInfo === 'function' ? cardSetInfo(d.id) : null;
  /* icono del TIPO de carta (esquina superior derecha) */
  const ct = typeof cardCType === 'function' ? cardCType(d) : 'otros';
  return `
    <div class="cost ${discounted ? 'discount' : ''}">${cost}</div>
    <img class="corner-type" src="assets/corner_${ct}.png" alt=""
         onerror="this.src='assets/corner_otros.png';this.onerror=function(){this.remove()}">
    <div class="art">${artHTML(d, variant)}</div>
    <div class="name">${d.name}</div>
    <div class="text">${d.text || ''}</div>
    ${stats}
    ${si ? `<div class="set-tag st-${si.kind}" title="${si.desc}">${si.tag}</div>` : ''}
    ${variant === 'diamond' ? diamondSparklesHTML() : ''}`;
}

/* hue del grado ALTERADA: aleatorio pero ESTABLE por carta (hash del id),
   así cada alterada tiene su propio color y no parpadea entre renders */
function altHue(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 40 + (h % 320);   // esquiva los tonos casi-originales (0-40)
}

function cardEl(c) {
  const el = document.createElement('div');
  const d = c.def;
  el.className = `card hand-card t-${d.type} ${d.clazz} r-${d.rarity}`;
  /* versión especial conseguida en sobres (foil, dorada...) */
  const v = typeof cardVariant === 'function' ? cardVariant(c.id) : null;
  if (v) el.classList.add('v-' + v);
  if (v === 'alterada') el.style.setProperty('--alt-hue', altHue(c.id) + 'deg');
  el.dataset.uid = c.uid;
  el.innerHTML = cardInnerHTML(c);
  return el;
}

function bigCardHTML(c) {
  const d = c.def || c;
  const v = (typeof cardVariant === 'function' && c.id) ? cardVariant(c.id) : null;
  const hue = v === 'alterada' ? ` style="--alt-hue:${altHue(d.id)}deg"` : '';
  return `<div class="card big t-${d.type} ${d.clazz} r-${d.rarity} ${v ? 'v-' + v : ''}"${hue}>${cardInnerHTML(c)}
    <div class="flavor">${d.flavor || ''}</div></div>`;
}

function minionEl(m, mine) {
  const el = document.createElement('div');
  el.className = 'minion' + (mine ? ' mine' : ' enemy') + (m.taunt ? ' taunt' : '');
  if (mine && G && G.current === 0 && !busy && canAttackEntity(G, m)) el.classList.add('can-attack');
  el.dataset.uid = m.uid;
  el.dataset.target = 'minion:' + m.uid;
  const buffedA = m.attack > m.def.attack;
  const hurt = m.health < m.maxHealth;
  const buffedH = !hurt && m.maxHealth > m.def.health;
  if (m.stench) el.classList.add('stench');
  const mv = typeof cardVariant === 'function' ? cardVariant(m.id) : null;
  if (mv) el.classList.add('v-' + mv);
  if (mv === 'alterada') el.style.setProperty('--alt-hue', altHue(m.id) + 'deg');
  /* no puede actuar: recién invocado, sin ataque o ya gastado este turno */
  const inactive = (m.sick && !m.charge) || m.attack === 0 ||
    (G && G.current === m.owner && m.attacksThisTurn > 0);
  if (inactive && !el.classList.contains('can-attack')) el.classList.add('inactive');
  el.innerHTML = `
    <div class="m-art">${artHTML(m.def, mv)}</div>
    ${m.taunt ? '<div class="m-taunt">🛡️</div>' : ''}
    ${m.stench ? '<div class="m-stench" title="Olor a Peo: recibe 1 de daño al final del turno de su dueño">💨</div>' : ''}
    <div class="stat atk ${buffedA ? 'buffed' : ''}">${m.attack}</div>
    <div class="stat hp ${hurt ? 'hurt' : ''} ${buffedH ? 'buffed' : ''}">${m.health}</div>
    ${mv === 'diamond' ? diamondSparklesHTML() : ''}`;
  el.addEventListener('mouseenter', () => showPreviewMinion(m));
  el.addEventListener('mouseleave', hidePreview);
  addLongPress(el, () => { abortDrag(); openCardInspector({ def: m.def, id: m.id, costMod: 0 }); });
  return el;
}

/* ---------------- RENDER PRINCIPAL ---------------- */

/* última posición conocida de cada esbirro (para el VFX de muerte, que se
   dispara cuando el esbirro ya no está en el DOM tras reconstruir el tablero) */
let lastMinionPos = {};
/* clon visual de cada esbirro (para dejar un «fantasma» en su sitio si
   muere: la carta no debe desaparecer hasta que el golpe la alcance) */
let lastMinionSnap = {};
function snapshotMinionPositions() {
  lastMinionSnap = {};
  document.querySelectorAll('.minion[data-uid]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width) {
      lastMinionPos[el.dataset.uid] = [r.left + r.width / 2, r.top + r.height / 2];
      lastMinionSnap[el.dataset.uid] = { rect: r, node: el.cloneNode(true) };
    }
  });
}

/* planta el fantasma del esbirro (recién retirado del DOM) en su última
   posición; se desvanece cuando el golpe hace contacto */
function spawnGhost(uid) {
  const snap = lastMinionSnap[uid];
  if (!snap) return null;
  const g = snap.node;
  g.classList.add('death-ghost');
  g.classList.remove('can-attack', 'highlight', 'landing', 'lunge');
  g.style.left = snap.rect.left + 'px';
  g.style.top = snap.rect.top + 'px';
  g.style.setProperty('--gsc', snap.rect.width / 116);
  $('#fx-layer').appendChild(g);
  return g;
}
function fadeGhost(g, delay) {
  if (!g) return;
  setTimeout(() => {
    g.classList.add('gone');
    setTimeout(() => g.remove(), 300);
  }, delay);
}

function render() {
  if (!G) return;
  snapshotMinionPositions();   // captura posiciones ANTES de reconstruir el tablero
  renderEnemyHand();
  renderHud(1);
  renderHud(0);
  renderBoard(1);
  renderBoard(0);
  renderPlayerHand();
  renderEndTurn();
  renderEnvBadge();
  flushFx();
}

/* placa del ENTORNO activo (cap. 2): nombre y turnos restantes */
function renderEnvBadge() {
  let b = document.getElementById('env-badge');
  const stage = $('#stage');
  if (!G || !G.env) {
    if (b) b.remove();
    stage.classList.remove('env-on');
    delete stage.dataset.env;
    return;
  }
  if (!b) {
    b = document.createElement('div');
    b.id = 'env-badge';
    stage.appendChild(b);
  }
  b.innerHTML = `${G.env.def.emoji || '🌐'} <b>${G.env.def.name}</b> · ${G.env.turnsLeft} ⏳`;
  b.title = G.env.def.text ? G.env.def.text.replace(/<[^>]*>/g, '') : '';
  stage.classList.add('env-on');
  stage.dataset.env = G.env.def.id;   // para skins CSS por entorno (cap. 2)
}

/* ---------------- TABLEROS Y CRÓNICA ----------------
   TABLEROS: aspecto del campo de batalla. Habrá más en el futuro:
   añadir aquí {fondo, cronica} y elegir con tableroActivo. */
const TABLEROS = {
  base: {
    id: 'base', name: 'Sanatorio San José',
    fondo: 'assets/fondo_batalla.png',
    cronica: 'assets/cronica.png'
  }
};
let tableroActivo = 'base';

function applyTablero() {
  const t = TABLEROS[tableroActivo] || TABLEROS.base;
  const bf = $('#board-frame');
  if (bf) bf.style.backgroundImage = `url('${t.fondo}')`;
  const cl = $('#cronica-layer');
  if (cl) cl.style.backgroundImage = `url('${t.cronica}')`;
}

/* crónica extraíble: OCULTAR CRÓNICA la desliza fuera; la pestaña
   #cronica-btn la devuelve. El estado se recuerda entre partidas. */
function setCronicaVisible(visible) {
  Save.settings.cronicaVisible = visible;
  if (typeof persistSave === 'function') persistSave();
  applyCronica();
}
function applyCronica() {
  const layer = $('#cronica-layer');
  const btn = $('#cronica-btn');
  if (!layer || !btn) return;
  const master = Save.settings.showLog !== false;   // ajuste global de crónica
  const visible = Save.settings.cronicaVisible !== false;
  layer.style.display = master ? '' : 'none';
  layer.classList.toggle('oculta', !visible);
  btn.classList.toggle('hidden', !master || visible);
}
function initCronica() {
  const btn = $('#cronica-btn');
  /* si faltara el arte de la pestaña, se usa una propia de reserva */
  const probe = new Image();
  probe.onerror = () => btn.classList.add('sin-imagen');
  probe.src = 'assets/boton_cronica.png';
  $('#log-toggle').addEventListener('click', () => setCronicaVisible(false));
  btn.addEventListener('click', () => setCronicaVisible(true));
  applyCronica();
}

/* ---------------- REVERSOS DE CARTA ----------------
   Coleccionables: el activo (Save.cardBack) tiñe todos los dorsos vía
   la variable CSS --card-back. Para añadir reversos nuevos: entrada
   aquí (y si se desbloquea por logro, su condición en owned()). */
const CARD_BACKS = [
  { id: 'clasico', name: 'Clásico del Manicomio', img: 'assets/reverso.png', owned: () => true }
];
function applyCardBack() {
  const cb = CARD_BACKS.find(b => b.id === Save.cardBack && b.owned()) || CARD_BACKS[0];
  document.documentElement.style.setProperty('--card-back', `url('${cb.img}')`);
}

function renderEnemyHand() {
  const box = $('#enemy-hand');
  box.innerHTML = '';
  /* modo historia: aún no se ven cartas mientras hablan los personajes */
  if (typeof introActive !== 'undefined' && introActive) return;
  const n = G.players[1].hand.length;
  for (let i = 0; i < n; i++) {
    const b = document.createElement('div');
    b.className = 'card-back';
    b.style.transform = `rotate(${(i - (n - 1) / 2) * 3}deg) translateY(${Math.abs(i - (n - 1) / 2) * 3}px)`;
    box.appendChild(b);
  }
}

function renderHud(idx) {
  const p = G.players[idx];
  const hud = idx === 0 ? $('#player-hud') : $('#enemy-hud');
  const mine = idx === 0;
  const h = p.hero;
  const powerUsable = mine && G.current === 0 && !busy && canUsePower(G, p);
  const heroCanAtk = mine && G.current === 0 && !busy && canAttackEntity(G, h);
  const gems = [];
  for (let i = 0; i < p.maxMana; i++) gems.push(`<span class="gem ${i < p.mana ? 'full' : 'empty'}"></span>`);

  /* la ilustración del héroe va en la capa DETRÁS del marco (asoma por el
     círculo transparente). Solo se reescribe cuando cambia de héroe. */
  const heroArtUrl = (typeof ILUSTRACIONES !== 'undefined' && ILUSTRACIONES['hero_' + h.def.id]) || null;
  const artEl = document.getElementById('hero-art-' + idx);
  if (artEl && artEl.dataset.url !== (heroArtUrl || '')) {
    artEl.dataset.url = heroArtUrl || '';
    artEl.innerHTML = heroArtUrl ? `<img src="${heroArtUrl}" alt="" onerror="this.remove()">` : '';
  }

  /* icono de la habilidad de héroe: imagen propia (power.iconImg) o su emoji */
  const pw = h.def.power;
  const powIco = pw.iconImg
    ? `<img class="power-ico-img" src="${pw.iconImg}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'power-ico',textContent:'${pw.icon}'}))">`
    : `<span class="power-ico">${pw.icon}</span>`;

  /* elementos superpuestos al arte del tablero (posiciones en style.css) */
  hud.innerHTML = `
    <div class="portrait ${heroCanAtk ? 'can-attack' : ''}" data-target="hero:${idx}" data-hero="${idx}"></div>
    <div class="hp-gem">${h.hp}</div>
    <div class="hero-name">${h.def.name}</div>
    <div class="power ${powerUsable ? 'usable' : ''} ${h.powerUsed ? 'used' : ''}"
         title="${pw.name} (${pw.cost}): ${pw.desc}">${powIco}</div>
    <div class="power-cost">${pw.cost}</div>
    <div class="mana-zone">
      <span class="mana-text">${p.mana}/${p.maxMana}</span>
      <span class="mana-gems">${gems.join('')}</span>
    </div>
    <div class="deck-badge" title="Cartas en la baraja">${p.deck.length}</div>
    ${h.weapon ? `<div class="weapon" title="${h.weapon.def.name}">
        <span class="w-emoji">${h.weapon.def.emoji}</span>
        <span class="w-stats">${h.weapon.attack}/${h.weapon.durability}</span>
      </div>` : ''}`;

  const portrait = hud.querySelector('.portrait');
  portrait.addEventListener('mouseenter', () => showPreviewHero(p));
  portrait.addEventListener('mouseleave', hidePreview);

  /* cartel del poder de héroe al dejar el ratón encima (tuyo y del rival) */
  const powerEl = hud.querySelector('.power');
  powerEl.addEventListener('mouseenter', () => showPowerTip(p));
  powerEl.addEventListener('mouseleave', hidePowerTip);
}

function renderBoard(idx) {
  const box = idx === 0 ? $('#player-board') : $('#enemy-board');
  box.innerHTML = '';
  for (const m of G.players[idx].board) box.appendChild(minionEl(m, idx === 0));
}

function renderPlayerHand() {
  const box = $('#player-hand');
  box.innerHTML = '';
  if (typeof introActive !== 'undefined' && introActive) return;
  const p = G.players[0];
  const n = p.hand.length;
  /* solapado dinámico: con pocas cartas apenas se pisan, con muchas se abanican más */
  const overlap = Math.min(-20, Math.round((560 / Math.max(n, 1) - 142) / 2));
  const rotStep = n > 6 ? 2.5 : 4;
  p.hand.forEach((c, i) => {
    const el = cardEl(c);
    const rot = (i - (n - 1) / 2) * rotStep;
    const ty = Math.abs(i - (n - 1) / 2) * 4;
    el.style.transform = `rotate(${rot}deg) translateY(${ty}px)`;
    el.style.marginLeft = el.style.marginRight = overlap + 'px';
    if (hiddenDraws.has(c.uid)) el.style.visibility = 'hidden'; // aún volando desde el mazo
    if (G.current === 0 && !busy && canPlay(G, p, c)) {
      el.classList.add('playable');
      /* brillo dorado: la carta ACTIVARÍA su habilidad extra ahora mismo
         (combo listo, descarte hecho...) — ayuda visual estilo Hearthstone */
      if (c.def.glowReady && c.def.glowReady(G, p)) el.classList.add('ability-ready');
    }
    el.addEventListener('mouseenter', () => showPreviewCard(c));
    el.addEventListener('mouseleave', hidePreview);
    /* mantener pulsada (móvil): inspecciona la carta y cancela el arrastre */
    addLongPress(el, () => { abortDrag(); openCardInspector(c); });
    box.appendChild(el);
  });
}

function renderEndTurn() {
  const btn = $('#end-turn');
  const myTurn = G.current === 0 && !busy && !G.over;
  btn.disabled = !myTurn;
  btn.classList.toggle('ready', myTurn);
  /* botón flotante de pausa: solo con partida en curso */
  $('#btn-pause').style.display = (G && !G.over) ? 'flex' : 'none';
}

/* ---------------- PREVIEW GRANDE ---------------- */

function showPreviewCard(c) {
  if (IS_TOUCH) return;
  $('#preview').innerHTML = bigCardHTML(c);
  $('#preview').classList.add('show');
}
function showPreviewMinion(m) {
  if (IS_TOUCH) return;
  const fake = { def: m.def };
  $('#preview').innerHTML = bigCardHTML(fake);
  $('#preview').classList.add('show');
}
function showPreviewHero(p) {
  if (IS_TOUCH) return;
  const h = p.hero;
  $('#preview').innerHTML = `
    <div class="card big t-spell hero-preview ${p.deckId}">
      <div class="art">${h.def.portrait}</div>
      <div class="name">${h.def.name}</div>
      <div class="text"><i>${h.def.title}</i><br><br><b>${h.def.power.name}</b> (${h.def.power.cost}): ${h.def.power.desc}</div>
    </div>`;
  $('#preview').classList.add('show');
}
/* cartel del poder de héroe (estilo bocadillo de la historia, fondo
   box9): SOLO lo que hace el poder. Sale junto a la habilidad. */
let powerTip = null;
function hidePowerTip() { if (powerTip) { powerTip.remove(); powerTip = null; } }
function showPowerTip(p) {
  if (IS_TOUCH) return;
  hidePowerTip();
  const pw = p.hero.def.power;
  const hud = p.idx === 0 ? $('#player-hud') : $('#enemy-hud');
  const powEl = hud && hud.querySelector('.power');
  const stage = $('#stage');
  if (!powEl || !stage) return;
  const tip = document.createElement('div');
  tip.className = 'power-tip';
  tip.innerHTML = `<div class="sb-text"><b>${pw.icon} ${pw.name}</b><br>${pw.desc}</div>`;
  box9(tip);
  stage.appendChild(tip);
  /* posición en px de diseño del stage (que va escalado) */
  const sr = stage.getBoundingClientRect();
  const scale = sr.width / 1672;
  const pr = powEl.getBoundingClientRect();
  const cx = (pr.left + pr.width / 2 - sr.left) / scale;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const x = Math.max(10, Math.min(1672 - w - 10, cx - w / 2));
  /* rival: debajo de su habilidad; jugador: encima de la suya */
  const y = p.idx === 1
    ? (pr.bottom - sr.top) / scale + 14
    : (pr.top - sr.top) / scale - h - 14;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
  powerTip = tip;
}

function hidePreview() { $('#preview').classList.remove('show'); }

/* ---------------- ANIMACIONES / FX ---------------- */

function elForEntity(ent) {
  if (!ent) return null;
  if (ent.isHero) return $(`.portrait[data-hero="${ent.owner}"]`);
  return document.querySelector(`.minion[data-uid="${ent.uid}"]`);
}

/* golpe estilo Hearthstone: la «mano invisible» levanta la carta, echa
   el peso hacia atrás y la estampa contra el objetivo; luego vuelve a
   su sitio con suavidad. El contacto cae a ~STRIKE_HIT_MS del inicio. */
const STRIKE_MS = 640, STRIKE_HIT_MS = 340;
function animStrike(el, x2, y2) {
  const [x1, y1] = centerOf(el);
  /* px de pantalla -> px de diseño (el stage va escalado) */
  const sr = $('#stage').getBoundingClientRect();
  const k = sr.width ? 1672 / sr.width : 1;
  const dx = (x2 - x1) * k, dy = (y2 - y1) * k;
  const d = Math.hypot(dx, dy) || 1;
  const gx = dx - (dx / d) * 26, gy = dy - (dy / d) * 26;  // se frena al chocar
  const bx = -(dx / d) * 26, by = -(dy / d) * 26 - 12;     // impulso atrás y arriba
  const prevZ = el.style.zIndex;
  el.style.zIndex = 80;
  const anim = el.animate([
    { transform: 'translate(0,0) scale(1)', easing: 'ease-out' },
    { transform: `translate(${bx}px,${by}px) scale(1.12)`, offset: 0.34, easing: 'ease-in' },
    { transform: `translate(${gx}px,${gy}px) scale(1.12)`, offset: 0.53, easing: 'ease-out' },
    { transform: `translate(${gx * 0.9}px,${gy * 0.9}px) scale(1.05)`, offset: 0.64, easing: 'ease-in-out' },
    { transform: 'translate(0,0) scale(1)' }
  ], { duration: STRIKE_MS, composite: 'add' });
  anim.onfinish = () => { el.style.zIndex = prevZ; };
}

/* ---------- motor de partículas (coordenadas de ventana) ---------- */

function vfxParticle(x, y, emoji, opts = {}) {
  const p = document.createElement('div');
  p.className = 'vfx-p';
  p.textContent = emoji;
  p.style.left = x + 'px';
  p.style.top = y + 'px';
  p.style.setProperty('--dx', (opts.dx || 0) + 'px');
  p.style.setProperty('--dy', (opts.dy || 0) + 'px');
  p.style.setProperty('--rot', (opts.rot || 0) + 'deg');
  p.style.setProperty('--dur', (opts.dur || 0.7) + 's');
  p.style.setProperty('--sc', opts.scale || 1.4);
  if (opts.size) p.style.fontSize = opts.size + 'px';
  $('#fx-layer').appendChild(p);
  setTimeout(() => p.remove(), (opts.dur || 0.7) * 1000 + 120);
}

/* explosión radial de emojis */
function vfxBurst(x, y, emojis, n = 8, opts = {}) {
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = (opts.dist || 58) * (0.7 + Math.random() * 0.6);
    vfxParticle(x, y, emojis[i % emojis.length], {
      dx: Math.cos(ang) * dist,
      dy: Math.sin(ang) * dist - (opts.rise || 0),
      rot: -90 + Math.random() * 180,
      dur: 0.55 + Math.random() * 0.35,
      size: opts.size || 24,
      scale: opts.scale || 1.3
    });
  }
}

/* partículas que suben flotando (curas, buffs, robos) */
function vfxRise(x, y, emojis, n = 6, opts = {}) {
  for (let i = 0; i < n; i++) {
    vfxParticle(x + (Math.random() - 0.5) * (opts.spread || 70), y + 12, emojis[i % emojis.length], {
      dx: (Math.random() - 0.5) * 24,
      dy: -(50 + Math.random() * 55),
      dur: 0.7 + Math.random() * 0.4,
      size: opts.size || 22
    });
  }
}

/* lluvia de emojis sobre un rectángulo (efectos de área) */
function vfxRain(rect, emojis, n = 10, opts = {}) {
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      vfxParticle(rect.left + Math.random() * rect.width, rect.top - 8, emojis[i % emojis.length], {
        dx: (Math.random() - 0.5) * 30,
        dy: rect.height * (0.55 + Math.random() * 0.5),
        rot: (Math.random() - 0.5) * 70,
        dur: 0.6 + Math.random() * 0.35,
        size: opts.size || 24
      });
    }, i * 45);
  }
}

/* proyectil que vuela de un punto a otro y ejecuta algo al llegar */
function vfxProjectile(x1, y1, x2, y2, emoji, done) {
  const p = document.createElement('div');
  p.className = 'vfx-proj';
  p.textContent = emoji;
  p.style.left = x1 + 'px';
  p.style.top = y1 + 'px';
  $('#fx-layer').appendChild(p);
  void p.offsetWidth; // fuerza el reflow para que la transición arranque
  p.style.left = x2 + 'px';
  p.style.top = y2 + 'px';
  setTimeout(() => { p.remove(); if (done) done(); }, 400);
}

/* destello de pantalla para hechizos gordos */
function vfxFlash(color) {
  const f = document.createElement('div');
  f.className = 'vfx-flash';
  f.style.background = color;
  $('#fx-layer').appendChild(f);
  setTimeout(() => f.remove(), 500);
}

/* humito de aterrizaje al posarse un esbirro */
function dustPuff(x, y, n = 9) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'dust';
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    const dir = i % 2 ? 1 : -1;
    d.style.setProperty('--dx', dir * (12 + Math.random() * 48) + 'px');
    d.style.setProperty('--dy', -(2 + Math.random() * 18) + 'px');
    d.style.setProperty('--dur', (0.5 + Math.random() * 0.3) + 's');
    $('#fx-layer').appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
}

/* ---------- animación de robo (estilo Hearthstone) ----------
   La carta sale BOCA ABAJO desde el mazo (abajo-derecha), vuela
   hacia su hueco en la mano y se gira por el camino. Los robos
   encadenados se reproducen en orden. */

const hiddenDraws = new Set();   // cartas de la mano aún "en vuelo"
let drawChain = Promise.resolve();

function queueDrawFlight(uid, owner) {
  if (owner === 0 && uid != null) hiddenDraws.add(uid);
  drawChain = drawChain.then(() => runDrawFlight(uid, owner)).catch(() => {});
}

function runDrawFlight(uid, owner) {
  return new Promise(res => {
    const stage = $('#stage');

    /* robo del RIVAL: un dorso vuela de su mazo a su mano */
    if (owner === 1) {
      const fly = document.createElement('div');
      fly.className = 'fly-card enemy-fly';
      fly.innerHTML = '<div class="card-reverse"></div>';
      fly.style.left = '1370px';
      fly.style.top = '120px';
      stage.appendChild(fly);
      void fly.offsetWidth;
      fly.style.left = '830px';
      fly.style.top = '4px';
      fly.style.transform = 'scale(.32) rotate(-6deg)';
      setTimeout(res, 80);                          // el siguiente ya despega
      setTimeout(() => { fly.remove(); Sfx.play('draw'); }, 300);
      return;
    }

    /* robo TUYO: reverso desde el mazo, giro en pleno vuelo.
       Aterriza EXACTAMENTE en la posición y rotación finales de la
       carta en el abanico: el relevo es invisible. */
    const handEl = document.querySelector(`#player-hand .hand-card[data-uid="${uid}"]`);
    const c = G && G.players[0].hand.find(x => x.uid === uid);
    if (!handEl || !c) {
      hiddenDraws.delete(uid);
      return res();
    }
    /* posición SIN transformar dentro del abanico + su mismo transform */
    const targetX = 570 + handEl.offsetLeft;   // #player-hand está en (570, 700)
    const targetY = 700 + handEl.offsetTop;
    const finalTf = handEl.style.transform || 'rotate(0deg)';

    const fly = document.createElement('div');
    fly.className = 'fly-card';
    fly.innerHTML = `
      <div class="flip3d fly-flip">
        <div class="flip-inner">
          <div class="flip-back card-reverse"></div>
          <div class="flip-front"></div>
        </div>
      </div>`;
    const face = cardEl(c);
    face.classList.remove('hand-card');
    fly.querySelector('.flip-front').appendChild(face);
    fly.style.left = '1470px';
    fly.style.top = '790px';
    fly.style.transform = 'scale(.45) rotate(14deg)';
    stage.appendChild(fly);
    void fly.offsetWidth;
    fly.style.left = targetX + 'px';
    fly.style.top = targetY + 'px';
    fly.style.transform = finalTf;
    setTimeout(() => fly.querySelector('.flip-inner').classList.add('flipped'), 100);
    Sfx.play('draw');
    setTimeout(res, 100);                           // cascada solapada y fluida
    setTimeout(() => {
      /* relevo en el mismo frame: aparece la real y desaparece el vuelo */
      hiddenDraws.delete(uid);
      const el2 = document.querySelector(`#player-hand .hand-card[data-uid="${uid}"]`);
      if (el2) el2.style.visibility = '';
      fly.remove();
    }, 360);
  });
}

/* ---------- puntos de referencia ---------- */

function heroPoint(idx) {
  const el = $(`.portrait[data-hero="${idx}"]`);
  return el ? centerOf(el) : [window.innerWidth / 2, window.innerHeight / 2];
}

function boardRect(idx) {
  return (idx === 0 ? $('#player-board') : $('#enemy-board')).getBoundingClientRect();
}

function targetPoint(target, owner) {
  const el = target ? elForEntity(target) : null;
  if (el) return centerOf(el);
  const r = boardRect(1 - owner); // objetivo ya muerto/ido: centro del campo rival
  return [r.left + r.width / 2, r.top + r.height / 2];
}

/* ---------- efectos temáticos por hechizo / poder ---------- */

const SPELL_VFX = {
  moteNuevo(o)     { const [x, y] = heroPoint(o.owner); vfxRise(x, y, ['🏷️', '✨'], 6); },
  sePonePelo(o)    { const [x, y] = o.pt; vfxRise(x, y, ['💇‍♂️', '✨', '💪'], 7); },
  camisaFuerza(o)  { const [x, y] = o.pt; vfxBurst(x, y, ['🥼', '⛓️'], 6, { dist: 44 }); },
  terapiaChoque(o) { const [x, y] = o.pt; vfxBurst(x, y, ['⚡'], 10, { dist: 70 }); vfxFlash('rgba(255,255,150,.25)'); },
  ordenIngreso(o)  { const [x1, y1] = heroPoint(o.owner); const [x, y] = o.pt; vfxProjectile(x1, y1, x, y, '📋', () => vfxBurst(x, y, ['📋', '🚐'], 6)); },
  medicacion(o)    { const [x, y] = heroPoint(o.owner); vfxRise(x, y, ['💊', '✚', '💉'], 8); },
  brote(o)         { vfxRain(boardRect(1 - o.owner), ['🌀', '💢'], 10); vfxFlash('rgba(160,80,255,.18)'); },
  quejaFormal(o)   { const [x1, y1] = heroPoint(o.owner); const [x, y] = o.pt; vfxProjectile(x1, y1, x, y, '📢', () => vfxBurst(x, y, ['💢', '📢'], 6)); },
  peucada(o)       { const [x, y] = o.pt; vfxParticle(x, y - 70, '🦶', { dy: 60, dur: 0.3, size: 46, scale: 1 }); setTimeout(() => vfxBurst(x, y, ['💢', '🦠'], 7), 300); },
  kebab(o)         { const [x, y] = o.pt; vfxRise(x, y, ['🥙', '✨'], 6); },
  rageQuit(o)      { const [x, y] = o.pt; vfxBurst(x, y, ['🤬', '💢', '🎮'], 8); vfxFlash('rgba(255,60,40,.18)'); },
  viciada(o)       { const [x, y] = heroPoint(o.owner); vfxRise(x, y, ['🖥️', '☕', '✨'], 7); },
  odioFiti(o)      { const [x1, y1] = heroPoint(o.owner); const [x, y] = o.pt; vfxProjectile(x1, y1, x, y, '☄️', () => { vfxBurst(x, y, ['🔥', '💥'], 10, { dist: 70 }); vfxFlash('rgba(255,120,40,.25)'); }); },
  pedoAtomico(o)   { vfxRain(boardRect(0), ['☢️', '💨'], 8); vfxRain(boardRect(1), ['☢️', '💨'], 8); vfxFlash('rgba(120,255,80,.22)'); },
  cincoGatos(o)    { vfxRain(boardRect(o.owner), ['🐈‍⬛', '🐾'], 10); },
  top1(o)          { vfxRain(boardRect(o.owner), ['🏆', '✨'], 9); },
  ciborg(o)        { const [x, y] = o.pt; vfxBurst(x, y, ['⚙️', '🔩', '🤖'], 9, { dist: 62 }); vfxFlash('rgba(120,200,255,.2)'); },
  cerveza(o)       { const [x, y] = heroPoint(o.owner); vfxBurst(x, y, ['🍺', '✨'], 6, { dist: 40 }); },
  power_director(o){ const [x, y] = o.pt; vfxRise(x, y, ['💊', '✚'], 6); },
  power_nikuman(o) { const [x1, y1] = heroPoint(o.owner); const [x, y] = o.pt; vfxProjectile(x1, y1, x, y, '🖤', () => vfxBurst(x, y, ['🖤', '💢'], 5, { dist: 40 })); },
  power_kevin(o)   { const [x1, y1] = heroPoint(o.owner); const [x, y] = o.pt; vfxProjectile(x1, y1, x, y, '💨', () => vfxBurst(x, y, ['💨', '🤢'], 5, { dist: 40 })); },
  power_marioHero(o) { const [x, y] = heroPoint(o.owner); vfxRise(x, y, ['🎭', '🔀', '✨'], 7); },
  /* expansión Fuga del Manicomio */
  yogurPina(o)         { const [x1, y1] = heroPoint(o.owner); const [x, y] = o.pt; vfxProjectile(x1, y1, x, y, '🍍', () => vfxBurst(x, y, ['🍍', '💢', '🤮'], 8, { dist: 55 })); },
  gritoEncane(o)       { const [x, y] = heroPoint(o.owner); vfxBurst(x, y, ['💢', '🔥'], 9, { dist: 65 }); vfxFlash('rgba(255, 90, 40, .2)'); },
  planDeFuga(o)        { const [x, y] = o.pt; vfxRise(x, y, ['🗺️', '🏃', '💨'], 6); },
  tunelCuchara(o)      { vfxRain(boardRect(o.owner), ['🥄', '🕳️', '💨'], 10); },
  cauntuHacker(o)      { const [x, y] = o.pt; vfxBurst(x, y, ['💻', '⚡', '🔓'], 8, { dist: 60 }); vfxFlash('rgba(80, 220, 120, .18)'); },
  despachoDirector(o)  { const [x, y] = heroPoint(o.owner); vfxRise(x, y, ['🗄️', '📂', '📸'], 8); },
  tatuajesManicomio(o) { const [x, y] = o.pt; vfxRise(x, y, ['✒️', '💪'], 6); },
  celadoresPersiguen(o){ vfxRain(boardRect(o.owner), ['🚨', '🏃'], 8); vfxFlash('rgba(255, 60, 60, .18)'); },
  /* expansión Recuerdos del Parque */
  litrona(o)        { const [x, y] = heroPoint(o.owner); vfxRise(x, y, ['🍾', '✨'], 6); },
  moteDefinitivo(o) { const [x1, y1] = heroPoint(o.owner); const [x, y] = o.pt; vfxProjectile(x1, y1, x, y, '🎯', () => vfxBurst(x, y, ['🎯', '💥'], 6)); },
  /* baraja del Mofeta */
  cuescoVolador(o)   { const [x1, y1] = heroPoint(o.owner); const [x, y] = o.pt; vfxProjectile(x1, y1, x, y, '💨', () => vfxBurst(x, y, ['💨', '🤢'], 6, { dist: 44 })); },
  mochilaPedo(o)     { const [x, y] = o.pt; vfxRise(x, y, ['🎒', '💨'], 6); },
  pedoProteico(o)    { const [x, y] = o.pt; vfxRise(x, y, ['💪', '💨'], 7); },
  hamburguesaDoble(o){ const [x, y] = heroPoint(o.owner); vfxRise(x, y, ['🍔', '🍟', '✨'], 8); },
  kebabMadrugada(o)  { const [x, y] = heroPoint(o.owner); vfxRise(x, y, ['🥙', '✨'], 6); },
  cuescoExpulsor(o)  { const [x, y] = o.pt; vfxBurst(x, y, ['🌪️', '💨'], 8, { dist: 60 }); },
  pedoCaotico(o)     { vfxRain(boardRect(0), ['🌀', '💨'], 9); vfxRain(boardRect(1), ['🌀', '💨'], 9); vfxFlash('rgba(140,220,90,.25)'); },
  pedoDefinitivo(o)  { vfxRain(boardRect(1 - o.owner), ['☁️', '💨', '🤢'], 14); vfxFlash('rgba(140,220,90,.3)'); },
  _default(o)      { const [x, y] = o.pt; vfxBurst(x, y, ['✨'], 7); }
};

function spawnSplat(el, text, cls) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const s = document.createElement('div');
  s.className = 'splat ' + cls;
  s.textContent = text;
  s.style.left = (r.left + r.width / 2) + 'px';
  s.style.top = (r.top + r.height / 2) + 'px';
  $('#fx-layer').appendChild(s);
  setTimeout(() => s.remove(), 950);
}

function flushFx() {
  /* tras un golpe, el daño y las muertes de esa tanda se retrasan al
     MOMENTO DEL CONTACTO de la animación (si no, el número sale antes) */
  let hitDelay = 0;
  while (fxQueue.length) {
    const { type, data } = fxQueue.shift();
    switch (type) {
      case 'damage': {
        const el = elForEntity(data.target);
        if (hitDelay) setTimeout(() => { spawnSplat(el, '-' + data.amount, 'dmg'); Sfx.play('damage'); }, hitDelay);
        else { spawnSplat(el, '-' + data.amount, 'dmg'); Sfx.play('damage'); }
        break;
      }
      case 'heal': {
        const hEl = elForEntity(data.target);
        spawnSplat(hEl, '+' + data.amount, 'heal');
        if (hEl && typeof VFX !== 'undefined') { const [x, y] = centerOf(hEl); VFX.heal(x, y); }
        Sfx.play('heal');
        break;
      }
      case 'death': {
        const p = lastMinionPos[data.minion && data.minion.uid];
        const boom = () => {
          if (p && typeof VFX !== 'undefined') VFX.death(p[0], p[1]);
          Sfx.play('death');
        };
        if (hitDelay) setTimeout(boom, hitDelay);
        else boom();
        break;
      }
      case 'summon': {
        const el = elForEntity(data.minion);
        if (el) {
          el.classList.add('landing');
          const [x] = centerOf(el);
          const bottom = el.getBoundingClientRect().bottom;
          setTimeout(() => {
            dustPuff(x, bottom - 10);
            if (typeof VFX !== 'undefined') VFX.smoke(x, bottom - 14);
            Sfx.play('land');
          }, 250);
        }
        break;
      }
      case 'spell': {
        const pt = targetPoint(data.target, data.owner);
        const run = SPELL_VFX[data.card.id] || SPELL_VFX._default;
        run({ owner: data.owner, pt });
        if (typeof VFX !== 'undefined') {
          const r = data.card.def ? data.card.def.rarity : (CARDS[data.card.id] || {}).rarity;
          const big = r === 'legendaria' || r === 'épica';
          setTimeout(() => VFX.spell(pt[0], pt[1], data.card.id, big), 60);
        }
        Sfx.play('magic');
        break;
      }
      case 'power': {
        const pt = targetPoint(data.target, data.owner);
        const run = SPELL_VFX['power_' + data.hero] || SPELL_VFX._default;
        run({ owner: data.owner, pt });
        if (typeof VFX !== 'undefined') setTimeout(() => VFX.magic(pt[0], pt[1], ['#ffd257', '#ffffff', '#bfeaff']), 60);
        Sfx.play('magic');
        break;
      }
      case 'stench': {
        const el = elForEntity(data.minion);
        if (el) {
          const [x, y] = centerOf(el);
          vfxBurst(x, y, ['💨', '🤢'], 4, { dist: 30, size: 18 });
        }
        break;
      }
      case 'buff': {
        const el = elForEntity(data.minion);
        if (el) {
          const [x, y] = centerOf(el);
          vfxBurst(x, y, ['⚔️', '💢'], 5, { dist: 28, size: 18 });
        }
        Sfx.play('attack');
        break;
      }
      case 'print': {
        const [x, y] = heroPoint(data.owner);
        vfxRise(x, y, ['🖨️', '🟪', '✨'], 6);
        Sfx.play('draw');
        break;
      }
      case 'encane': {
        const [x, y] = heroPoint(data.owner);
        vfxBurst(x, y, ['🔥', '💢'], 6, { dist: 45 });
        Sfx.play('attack');
        break;
      }
      case 'attack': {
        /* si atacante o víctima MURIERON en el golpe (ya no están en el
           DOM), se plantan sus FANTASMAS: nadie desaparece hasta que la
           animación llega al objetivo */
        let el = elForEntity(data.attacker);
        let ghostA = null, ghostT = null;
        if (!el && data.attacker && !data.attacker.isHero) {
          ghostA = spawnGhost(data.attacker.uid);
          el = ghostA;
        }
        let tEl = elForEntity(data.target);
        if (!tEl && data.target && !data.target.isHero) {
          ghostT = spawnGhost(data.target.uid);
          tEl = ghostT;
        }
        const tPos = tEl ? centerOf(tEl)
          : (data.target && !data.target.isHero ? lastMinionPos[data.target.uid] : null);
        /* golpe dirigido estilo Hearthstone (sin posición, saltito) */
        if (el && tPos) { animStrike(el, tPos[0], tPos[1]); hitDelay = STRIKE_HIT_MS; }
        else if (el) el.classList.add('lunge');
        /* los fantasmas se desvanecen justo cuando el golpe hace contacto */
        fadeGhost(ghostA, hitDelay || 0);
        fadeGhost(ghostT, hitDelay || 0);
        // flecha roja breve para ver quién ataca a quién
        if (el && tPos && !drag) {
          const [x1, y1] = centerOf(el);
          arrowShow(x1, y1, tPos[0], tPos[1], '#ff4b3a');
          setTimeout(() => { if (!drag) arrowHide(); }, 700);
        }
        /* chispas y sonido en el MOMENTO DEL CONTACTO del golpe */
        if (tPos && typeof VFX !== 'undefined') {
          setTimeout(() => { VFX.impact(tPos[0], tPos[1]); Sfx.play('attack'); }, el ? STRIKE_HIT_MS : 0);
        } else {
          Sfx.play('attack');
        }
        break;
      }
      case 'draw': {
        /* animación de robo (en la intro el reparto se anima aparte) */
        if (typeof introActive !== 'undefined' && introActive) break;
        if (data.owner === 0 && data.uid != null && G) queueDrawFlight(data.uid, 0);
        else if (data.owner === 1) queueDrawFlight(null, 1);
        else Sfx.play('draw');
        break;
      }
      case 'play': Sfx.play('play'); break;
      case 'equip': {
        const [x, y] = heroPoint(data.owner);
        vfxBurst(x, y, ['⚔️', '✨'], 6, { dist: 45 });
        if (typeof VFX !== 'undefined') VFX.magic(x, y, ['#d0d0d0', '#ffffff', '#ffd257']);
        Sfx.play('equip');
        break;
      }
      case 'env': {
        banner('🌐 ¡DOMINIO DESPLEGADO!');
        if (typeof VFX !== 'undefined') {
          const r = $('#stage').getBoundingClientRect();
          VFX.magic(r.left + r.width / 2, r.top + r.height / 2, ['#7fd8ff', '#ffffff', '#b980ff'], { big: true });
        }
        Sfx.play('magic');
        break;
      }
      case 'envEnd': Sfx.play('draw'); break;
      case 'burn': case 'discard': break;
    }
  }
}

function banner(text) {
  const b = $('#turn-banner');
  b.textContent = text;
  b.classList.remove('show');
  void b.offsetWidth; // reinicia la animación
  b.classList.add('show');
  Sfx.play('turn');
}

/* ---------------- DRAG & DROP + FLECHA ---------------- */

let drag = null;   // {mode:'card'|'attack', ...}
let pendingPower = false;

function arrowShow(x1, y1, x2, y2, color) {
  const svg = $('#arrow-layer');
  svg.classList.add('show');
  const line = $('#arrow-line');
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x2); line.setAttribute('y2', y2);
  line.setAttribute('stroke', color);
  const head = $('#arrow-head');
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const size = 16;
  const p = a => `${x2 - size * Math.cos(ang - a)},${y2 - size * Math.sin(ang - a)}`;
  head.setAttribute('points', `${x2},${y2} ${p(0.45)} ${p(-0.45)}`);
  head.setAttribute('fill', color);
}
function arrowHide() { $('#arrow-layer').classList.remove('show'); }

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

/* convierte coordenadas de ventana a coordenadas de diseño del escenario */
function stagePoint(x, y) {
  const r = $('#stage').getBoundingClientRect();
  const s = r.width / 1672;
  return [(x - r.left) / s, (y - r.top) / s];
}

/* monta las piezas de borde (assets/box_*) en cualquier contenedor:
   cajas de tamaño libre para paneles, desplegables y bocadillos */
function box9(el) {
  if (!el || el.querySelector(':scope > .b9')) return el;
  el.classList.add('box9');
  for (const pos of ['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br']) {
    const i = document.createElement('i');
    i.className = 'b9 b9-' + pos;
    el.appendChild(i);
  }
  return el;
}

/* escala los paneles de menú (.menu-box) para que quepan ENTEROS
   en pantallas pequeñas (móvil): pausa, ajustes, online, fin... */
function fitOverlays() {
  document.querySelectorAll('.overlay .menu-box').forEach(box => {
    box.style.transform = 'none';
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return; // panel oculto
    const s = Math.min(1,
      (window.innerHeight * 0.96) / r.height,
      (window.innerWidth * 0.96) / r.width);
    if (s < 1) box.style.transform = `scale(${s})`;
  });
}

/* escala el escenario 1672x941 y el del menú (1920x1080) para que
   quepan ENTEROS en la ventana, siempre centrados (sin recortes) */
function fitStage() {
  fitOverlays();
  const s = Math.min(window.innerWidth / 1672, window.innerHeight / 941);
  $('#stage').style.transform = `translate(-50%, -50%) scale(${s})`;
  const ms = $('#menu-stage');
  if (ms) {
    const s2 = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    ms.style.transform = `translate(-50%, -50%) scale(${s2})`;
  }
  const ds = $('#deck-stage');
  if (ds) {
    const s3 = Math.min(window.innerWidth / 1540, window.innerHeight / 1021);
    ds.style.transform = `translate(-50%, -50%) scale(${s3})`;
  }
  const ss = $('#shop-stage');
  if (ss) {
    const s4 = Math.min(window.innerWidth / 1540, window.innerHeight / 1021);
    ss.style.transform = `translate(-50%, -50%) scale(${s4})`;
  }
  const sts = $('#story-stage');
  if (sts) {
    const s5 = Math.min(window.innerWidth / 966, window.innerHeight / 1080);
    sts.style.transform = `translate(-50%, -50%) scale(${s5})`;
  }
  const ags = $('#settings-stage');
  if (ags) {
    const s6 = Math.min(window.innerWidth / 755, window.innerHeight / 917);
    ags.style.transform = `translate(-50%, -50%) scale(${s6})`;
  }
}

/* ---------------- PANTALLA COMPLETA (navegador) ---------------- */

function fsActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (fsActive()) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else if (el.requestFullscreen) {
    el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  } else {
    /* iPhone Safari no permite pantalla completa por API */
    banner('📲 En iPhone: Compartir → «Añadir a pantalla de inicio»');
  }
}

function updateFsButton() {
  const b = $('#btn-fullscreen');
  if (!b) return;
  /* en la app de escritorio y en la APK ya se va a pantalla completa */
  if (window.electronMP || window.Capacitor) { b.style.display = 'none'; return; }
  /* solo el icono (cuadrado pequeño): el texto tapaba controles en móvil */
  b.textContent = fsActive() ? '✕' : '⛶';
  b.title = fsActive() ? 'Salir de pantalla completa' : 'Pantalla completa';
}

function entityFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const t = el.closest('[data-target]');
  if (!t) return null;
  const [kind, val] = t.dataset.target.split(':');
  if (kind === 'hero') return G.players[+val].hero;
  const uid = +val;
  for (const p of G.players) {
    const m = p.board.find(m => m.uid === uid);
    if (m) return m;
  }
  return null;
}

function highlightTargets(list) {
  for (const ent of list) {
    const el = elForEntity(ent);
    if (el) el.classList.add('highlight');
  }
}
function clearHighlights() {
  $$('.highlight').forEach(el => el.classList.remove('highlight'));
  $$('.drop-hint').forEach(el => el.classList.remove('drop-hint'));
}

function startCardDrag(el, e) {
  const uid = +el.dataset.uid;
  const c = G.players[0].hand.find(x => x.uid === uid);
  if (!c) return;
  const ghost = el.cloneNode(true);
  ghost.classList.add('ghost');
  ghost.style.transform = 'none';
  $('#stage').appendChild(ghost);
  el.classList.add('drag-src');
  drag = { mode: 'card', card: c, srcEl: el, ghost, start: centerOf(el) };
  if (c.def.target) highlightTargets(validTargetsFor(G, G.players[0], c.def.target));
  else if (c.def.type === 'minion') $('#player-board').classList.add('drop-hint');
  moveDrag(e);
  hidePreview();
}

function startAttackDrag(el, ent, e) {
  drag = { mode: 'attack', attacker: ent, srcEl: el, start: centerOf(el) };
  highlightTargets(attackTargets(G, 0));
  moveDrag(e);
  hidePreview();
}

function moveDrag(e) {
  if (!drag) return;
  const x = e.clientX, y = e.clientY;
  if (drag.ghost) {
    const [sx, sy] = stagePoint(x, y);
    drag.ghost.style.left = (sx - 71) + 'px';
    drag.ghost.style.top = (sy - 101) + 'px';
  }
  const targeted = drag.mode === 'attack' || (drag.card && drag.card.def.target);
  if (targeted) {
    arrowShow(drag.start[0], drag.start[1], x, y, drag.mode === 'attack' ? '#ff4b3a' : '#39d0ff');
  }
}

function endDrag(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.ghost) d.ghost.remove();
  if (d.srcEl) d.srcEl.classList.remove('drag-src');
  arrowHide();
  clearHighlights();
  if (!G || G.over || busy || G.current !== 0) { render(); return; }

  const p = G.players[0];
  if (d.mode === 'card') {
    const c = d.card;
    let ok = false;
    if (c.def.target) {
      const ent = entityFromPoint(e.clientX, e.clientY);
      /* online-invitado: la acción viaja al host en vez de aplicarse */
      if (ent) ok = mpGuestPlay(c, ent) || playCard(G, p, c.uid, ent);
    } else {
      // soltar en la zona de juego (tablero o parte superior)
      const dropY = e.clientY;
      const handTop = $('#player-hand').getBoundingClientRect().top;
      if (dropY < handTop - 10) ok = mpGuestPlay(c, null) || playCard(G, p, c.uid, null);
    }
    if (ok) checkPlayerWin();
  } else if (d.mode === 'attack') {
    const ent = entityFromPoint(e.clientX, e.clientY);
    if (ent) {
      if (!mpGuestAttack(d.attacker, ent)) doAttack(G, d.attacker, ent); // el motor valida
    }
  }
  render();
  MP.afterLocalAction();
}

function checkPlayerWin() { /* Hooks.gameOver ya gestiona el final */ }

/* --- poder de héroe: clic + objetivo --- */

function beginPowerTargeting() {
  if (busy || !G || G.over || G.current !== 0) return;
  const p = G.players[0];
  if (!canUsePower(G, p)) return;
  /* poderes SIN objetivo (Trapicheo de Mario): se usan directamente */
  if (!p.hero.def.power.target) {
    if (!(typeof mpGuestPower === 'function' && mpGuestPower(null))) {
      usePower(G, p, null);
    }
    render();
    MP.afterLocalAction();
    return;
  }
  pendingPower = true;
  const powEl = $('#player-hud .power');
  const [x, y] = centerOf(powEl);
  drag = { mode: 'power', start: [x, y] };
  highlightTargets(validTargetsFor(G, p, p.hero.def.power.target));
  banner('Elige un objetivo para ' + p.hero.def.power.name);
}

function resolvePowerTargeting(e) {
  pendingPower = false;
  const d = drag; drag = null;
  arrowHide();
  clearHighlights();
  const ent = entityFromPoint(e.clientX, e.clientY);
  if (ent) {
    if (!mpGuestPower(ent)) usePower(G, G.players[0], ent);
  }
  render();
  MP.afterLocalAction();
}

/* ---------------- EVENTOS GLOBALES ---------------- */

document.addEventListener('pointerdown', e => {
  if (!G || G.over) return;

  if (pendingPower) { resolvePowerTargeting(e); return; }
  if (busy || G.current !== 0) return;

  const hand = e.target.closest('.hand-card.playable');
  if (hand) { e.preventDefault(); startCardDrag(hand, e); return; }

  const m = e.target.closest('.minion.mine.can-attack');
  if (m) {
    e.preventDefault();
    const ent = G.players[0].board.find(x => x.uid === +m.dataset.uid);
    if (ent) startAttackDrag(m, ent, e);
    return;
  }

  const heroP = e.target.closest('#player-hud .portrait.can-attack');
  if (heroP) { e.preventDefault(); startAttackDrag(heroP, G.players[0].hero, e); return; }

  const pow = e.target.closest('#player-hud .power.usable');
  if (pow) { e.preventDefault(); beginPowerTargeting(); return; }
});

document.addEventListener('pointermove', e => {
  if (drag && drag.mode === 'power') {
    arrowShow(drag.start[0], drag.start[1], e.clientX, e.clientY, '#ffd700');
    return;
  }
  moveDrag(e);
});

document.addEventListener('pointerup', e => {
  if (drag && drag.mode === 'power') return; // se resuelve con el siguiente pointerdown
  endDrag(e);
});

document.addEventListener('contextmenu', e => {
  if (pendingPower || drag) {
    e.preventDefault();
    pendingPower = false;
    if (drag && drag.ghost) drag.ghost.remove();
    drag = null;
    arrowHide();
    clearHighlights();
    render();
  }
});

/* ---------------- FIN DE TURNO / TURNO IA ---------------- */

async function onEndTurn() {
  if (!G || G.over || busy || G.current !== 0) return;

  /* partida online: sin IA — el turno pasa al otro jugador humano */
  if (MP.active) {
    if (MP.role === 'guest') { mpGuestEnd(); return; }
    endTurn(G);
    render();
    if (!G.over) banner('Turno de ' + G.players[1].hero.def.name + ' 🌐');
    MP.afterLocalAction();
    return;
  }

  busy = true;
  endTurn(G);
  render();
  if (!G.over) {
    banner('Turno de ' + G.players[1].hero.def.name.split(' «')[0]);
    await aiTakeTurn(G);
  }
  busy = false;
  if (!G.over) banner('¡Tu turno! 🏥');
  render();
}

AIH.render = render;

/* La IA enseña la carta que juega, como en Hearthstone:
   aparece el reverso y se gira para revelar la carta */
AIH.reveal = async card => {
  const el = $('#ai-reveal');
  el.innerHTML = `
    <div class="flip3d big">
      <div class="flip-inner">
        <div class="flip-back card-reverse"></div>
        <div class="flip-front">${bigCardHTML(card)}</div>
      </div>
    </div>`;
  el.classList.add('show');
  Sfx.play('play');
  await AIH.delay(330);
  const inner = el.querySelector('.flip-inner');
  if (inner) inner.classList.add('flipped');
  await AIH.delay(1550);
  el.classList.remove('show');
  await AIH.delay(200);
};

AIH.notify = text => banner(text);

/* ---------------- PANTALLAS ---------------- */

function showEnd(winner) {
  const box = $('#end-overlay');
  const title = $('#end-title');
  const text = $('#end-text');
  const reward = awardCoins(winner);
  $('#end-reward').innerHTML = `+${reward} 💊 &nbsp;·&nbsp; total: ${Save.coins} 💊`;
  /* anota la batalla en la ficha del paciente (historial + ELO) */
  if (typeof recordBattle === 'function') recordBattle(winner);

  const mp = typeof MP !== 'undefined' && (MP.active || MP.role);
  const enemy = (!mp && typeof activeStoryEnemy !== 'undefined' && activeStoryEnemy) ? activeStoryEnemy : null;
  const rivalName = enemy ? enemy.nombre.replace(/\s«.*»/, '') : 'Tu rival';
  const contBtn = $('#btn-continue-story');
  const restartBtn = $('#btn-restart');
  let showContinue = false;

  if (winner === 0) {
    title.textContent = '🏆 ¡VICTORIA!';
    title.className = 'logo win';
    let msg = enemy ? enemy.victoria
      : 'El Director sonríe mientras firma el ingreso de Nikuman.';
    if (enemy && typeof storyDefeat === 'function') {
      const wasNew = !Save.story.defeated.includes(enemy.id);
      storyDefeat(enemy.id);
      /* `desbloquea` puede ser un set o una lista (el boss suelta varios) */
      const unlocked = (typeof enemyUnlocks === 'function' ? enemyUnlocks(enemy) : [])
        .filter(s => SETS[s]).map(s => SETS[s].name);
      if (wasNew && unlocked.length) {
        msg += `<br><span class="unlock-note">🔓 Desbloqueada la COMPRA de <b>${unlocked.join('</b> y <b>')}</b> — en la Tienda de Mazos.</span>`;
      }
      const done = storyChapterComplete();
      if (done) {
        title.textContent = '👑 ¡CAPÍTULO COMPLETO!';
        msg += '<br><span class="unlock-note">Has completado <b>«Ingreso en el Manicomio»</b>. Todo el grupo, ingresado.</span>';
      } else {
        showContinue = true;
      }
    }
    text.innerHTML = msg;
    Sfx.play('win');
  } else if (winner === 1) {
    title.textContent = '💀 DERROTA';
    title.className = 'logo lose';
    text.innerHTML = `${rivalName} te gana la partida. El ingreso tendrá que esperar...<br>Vuelve a intentarlo cuando quieras.`;
    Sfx.play('lose');
  } else {
    title.textContent = '🤯 DOBLE K.O.';
    title.className = 'logo';
    text.innerHTML = 'Ambos caéis a la vez. El ingreso queda en tablas: repite la partida.';
  }

  if (contBtn) contBtn.style.display = showContinue ? '' : 'none';
  if (restartBtn) restartBtn.style.display = showContinue ? 'none' : '';
  box.classList.remove('hidden');
  fitOverlays();
}

/* ---------------- INSPECTOR DE CARTA (falso 3D) ----------------
   Doble clic en una carta (colección, sobres) → se abre en grande
   en el centro con el fondo difuminado; arrastrando se inclina en
   3D y un reflejo sigue al puntero (los foils lucen de verdad). */

let ciDragging = false;

/* pulsación larga (~450ms sin mover): la vía táctil para inspeccionar.
   Marca el elemento con __lpFired para que el clic posterior se ignore. */
function addLongPress(el, fn) {
  let timer = null, sx = 0, sy = 0;
  el.addEventListener('pointerdown', e => {
    sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => {
      timer = null;
      el.__lpFired = true;
      fn(e);
    }, 450);
  });
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointermove', e => {
    if (timer && (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12)) cancel();
  });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
}

/* cancela un arrastre en curso (para pasar del arrastre al inspector) */
function abortDrag() {
  if (!drag) return;
  if (drag.ghost) drag.ghost.remove();
  if (drag.srcEl) drag.srcEl.classList.remove('drag-src');
  drag = null;
  arrowHide();
  clearHighlights();
}

function openCardInspector(c, variantOverride) {
  const card = $('#ci-card');
  card.innerHTML = bigCardHTML(c)
    + '<div class="ci-fx" id="ci-holo"></div><div class="ci-fx" id="ci-sparkle"></div><div id="ci-glare"></div>';
  if (variantOverride !== undefined) {
    const el = card.querySelector('.card');
    el.classList.remove('v-brillante', 'v-dorada', 'v-alterada', 'v-foil', 'v-diamond');
    if (variantOverride) el.classList.add('v-' + variantOverride);
  }
  /* activa el foil holográfico si la carta es especial (foil/dorada/etc.) */
  const cardEl = card.querySelector('.card');
  const variant = ['v-foil', 'v-dorada', 'v-brillante', 'v-alterada', 'v-diamond'].find(v => cardEl && cardEl.classList.contains(v));
  card.classList.toggle('holo-on', !!variant);
  card.dataset.variant = variant ? variant.slice(2) : '';
  card.style.setProperty('--gx', '50%');
  card.style.setProperty('--gy', '50%');
  /* las DIAMOND se ven en 3D (modelo con relieve y brillo) en vez de plana */
  const is3d = card.dataset.variant === 'diamond' && typeof Card3D !== 'undefined' && Card3D.supported();
  card.classList.toggle('is-3d', is3d);
  if (!is3d && typeof Card3D !== 'undefined') Card3D.close();
  /* escala para que quepa con aire en cualquier pantalla */
  const s = Math.min(1.45, (window.innerHeight * 0.78) / 400, (window.innerWidth * 0.6) / 290);
  $('#ci-holder').style.transform = `scale(${Math.max(0.55, s)})`;
  card.style.transform = 'none';
  $('#card-inspector').classList.remove('hidden');
  hidePreview();
  Sfx.play('play');
  /* el fondo/marco 3D va en #ci-holder (hermano de la carta). Se le pasa
     la ilustración (para el hueco) y los DATOS del texto: Card3D lo pinta
     todo dentro de la escena 3D para que gire como un objeto único. */
  if (is3d) {
    const d = c.def || c;
    const base = (typeof ILUSTRACIONES !== 'undefined' && ILUSTRACIONES[d.id]) || null;
    const cost = (c.def && typeof c.costMod === 'number') ? cardCost(c) : d.cost;
    let stats = null;
    if (d.type === 'minion') stats = { a: d.attack, b: d.health, kind: 'minion' };
    else if (d.type === 'weapon') stats = { a: d.attack, b: d.durability, kind: 'weapon' };
    const si = typeof cardSetInfo === 'function' ? cardSetInfo(d.id) : null;
    Card3D.open($('#ci-holder'), {
      video: 'assets/ilustraciones/' + d.id + '.webm',      // ilustración animada (en bucle)
      url: 'assets/ilustraciones/diamond/' + d.id + '.webp',
      fallback: base,
      emoji: d.emoji
    }, {
      type: d.type,
      ctype: typeof cardCType === 'function' ? cardCType(d) : null,
      cost: cost,
      discounted: !!(c.def && c.costMod < 0),
      name: d.name,
      text: d.text || '',
      flavor: d.flavor || '',
      stats: stats,
      set: si ? { tag: si.tag, kind: si.kind } : null
    });
  }
}

function closeCardInspector() {
  $('#card-inspector').classList.add('hidden');
  ciDragging = false;
  if (typeof Card3D !== 'undefined') Card3D.close();
}

/* inclinación según la posición del puntero sobre la carta */
function ciTilt(e) {
  const card = $('#ci-card');
  const r = card.getBoundingClientRect();
  if (!r.width) return;
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  const cx = Math.max(-0.65, Math.min(0.65, px));
  const cy = Math.max(-0.65, Math.min(0.65, py));
  card.style.setProperty('--gx', ((cx + 0.5) * 100) + '%');
  card.style.setProperty('--gy', ((cy + 0.5) * 100) + '%');
  /* en DIAMOND solo fijamos el objetivo de giro: el bucle de render mueve
     el texto (esta capa) con el mismo ángulo exacto que el modelo 3D */
  if (card.classList.contains('is-3d')) {
    if (typeof Card3D !== 'undefined') Card3D.setTilt(cx, cy);
    return;
  }
  card.style.transform = `rotateY(${cx * 44}deg) rotateX(${-cy * 34}deg)`;
}

function initCardInspector() {
  const card = $('#ci-card');
  card.addEventListener('pointerdown', e => {
    e.preventDefault();
    ciDragging = true;
    card.classList.add('dragging');
    ciTilt(e);
  });
  document.addEventListener('pointermove', e => { if (ciDragging) ciTilt(e); });
  document.addEventListener('pointerup', () => {
    if (!ciDragging) return;
    ciDragging = false;
    card.classList.remove('dragging');
    card.style.transform = 'none'; // vuelve suave a su sitio
  });
  /* en ratón: la carta se inclina y el foil brilla al pasar por encima */
  card.addEventListener('pointermove', e => { if (!ciDragging) ciTilt(e); });
  card.addEventListener('pointerleave', () => {
    if (ciDragging) return;
    card.style.transform = 'none';
    card.style.setProperty('--gx', '50%');
    card.style.setProperty('--gy', '50%');
    if (card.classList.contains('is-3d') && typeof Card3D !== 'undefined') Card3D.setTilt(0, 0);
  });
  $('#ci-backdrop').addEventListener('click', closeCardInspector);
  $('#ci-close').addEventListener('click', closeCardInspector);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCardInspector();
  });
}

/* ---------------- MENÚ DE PAUSA ---------------- */

function renderPauseToggles() {
  const setTog = (id, val) => {
    const b = $('#' + id);
    b.textContent = val ? 'SÍ' : 'NO';
    b.classList.toggle('on', val);
  };
  setTog('p-set-sound', Save.settings.sound);
  setTog('p-set-fast', Save.settings.fastAI);
  setTog('p-set-log', Save.settings.showLog);
}

function openPause() {
  if (!G || G.over) return;
  renderPauseToggles();
  const mp = typeof MP !== 'undefined' && MP.active;
  $('#btn-restart-game').style.display = mp ? 'none' : '';
  $('#btn-surrender').textContent = mp ? '🏳️ Abandonar partida' : '🏳️ Rendirse';
  $('#pause-menu').classList.remove('hidden');
  fitOverlays();
}

function closePause() {
  $('#pause-menu').classList.add('hidden');
}

function surrenderGame() {
  if (typeof MP !== 'undefined' && MP.active) {
    if (!confirm('¿Abandonar la partida online?')) return;
    closePause();
    mpLeave();
    return;
  }
  if (!confirm('¿Rendirte? Contará como derrota.')) return;
  closePause();
  log(G, '🏳️ ' + heroName(G.players[0]) + ' se rinde. El Director firma su propio ingreso.');
  G.players[0].hero.hp = 0;
  checkGameOver(G);
  render();
}

function restartGame() {
  if (typeof MP !== 'undefined' && MP.active) return;
  if (!confirm('¿Reiniciar la partida desde cero?')) return;
  closePause();
  startGame();
}

function startGame() {
  hideAllScreens();
  if (typeof Music !== 'undefined') Music.set('bg');
  $('#log').innerHTML = '';
  busy = false;
  drag = null;
  pendingPower = false;
  const play = activePlay();
  /* rival: el enemigo del modo historia (o Nikuman por defecto) */
  const enemy = (typeof activeStoryEnemy !== 'undefined' && activeStoryEnemy) ? activeStoryEnemy : null;
  const oppDeck = enemy ? DECKS[enemy.deck] : DECKS.manonegra;
  const oppHero = enemy ? enemy.hero : 'nikuman';
  G = newGame(play.cards, play.hero, oppDeck, oppHero);
  /* los jefes de la historia pueden traer vida extra (e.vida) */
  if (enemy && enemy.vida) {
    G.players[1].hero.hp = G.players[1].hero.maxHp = enemy.vida;
  }
  /* modo historia: la intro arranca ANTES del primer render para que
     las cartas iniciales no se vean ni se animen todavía */
  const pasos = enemy ? enemy.intro : null;
  const conIntro = pasos && pasos.length > 0 && isValidDeck(activeDeck().cards);
  if (conIntro) introActive = true;
  render();
  if (!isValidDeck(activeDeck().cards)) {
    banner('⚠️ Mazo incompleto: juegas con el arquetipo del Sanatorio');
    return;
  }
  if (conIntro) {
    runIntro(pasos);
  } else {
    banner('¡Tu turno! ' + (play.hero === 'kevin' ? '🦨' : '🏥'));
  }
}
