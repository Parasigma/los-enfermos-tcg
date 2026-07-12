'use strict';
/* =========================================================
   MENÚ PRINCIPAL, PROGRESO Y PANTALLAS
   ---------------------------------------------------------
   Sistema de mazos:
   - ARQUETIPOS: mazos de serie, fijos e inmutables. Aparecen
     al comprar su baraja (Sanatorio siempre; Mofeta al comprarla).
   - MAZOS PROPIOS: copias editables de un arquetipo o mazos
     creados de cero. Solo estos se pueden modificar.
   - El desplegable del nombre cambia el MAZO ACTIVO, que es
     con el que se juega (héroe + cartas van juntos).
   ========================================================= */

const SAVE_KEY = 'enfermos_tcg_save_v1';

const Save = {
  profile: null,                // { name, id, created } — ficha de ingreso del paciente
  coins: 150,
  ownedSets: ['sanatorio'],
  customDecks: [],              // [{id, name, hero, cards[], archetype:false}]
  activeDeckId: 'arch_sanatorio',
  /* sobres: cartas sueltas conseguidas y versiones especiales */
  packsFreeLeft: 2,
  packsDay: '',
  cardCollection: {},           // { cardId: copias conseguidas en sobres }
  cardVariants: {},             // { cardId: 'brillante'|'dorada'|'alterada'|'foil' }
  story: { defeated: [], revealed: [] }, // modo historia: enemigos vencidos / revelados
  /* ficha del paciente: historial de batallas y ELO interno */
  stats: { games: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, elo: 1000, log: [] },
  tradeOut: [],                 // envíos en depósito pendientes (regalos/intercambios)
  cardMinus: {},                // cartas ENVIADAS a amigos: descuentan de tus copias
  settings: { sound: true, fastAI: false, showLog: true }
};

/* héroes jugables: se desbloquean comprando su set */
const PLAYABLE_HEROES = [
  { id: 'director', set: 'sanatorio' },
  { id: 'kevin', set: 'mofeta' },
  { id: 'marioHero', set: 'fuga' },
  { id: 'jorgeHero', set: 'monzo' },
  { id: 'victorHero', set: 'motero' },
  { id: 'paquitoHero', set: 'mudanzas' },
  { id: 'marioSupremo', set: 'supremo' }
];

/* ---------- mazos: arquetipos + propios ---------- */

function archetypes() {
  const list = [{
    id: 'arch_sanatorio', archetype: true, hero: 'director',
    name: 'El Sanatorio San José', cards: DECKS.sanatorio
  }];
  if (Save.ownedSets.includes('mofeta')) {
    list.push({
      id: 'arch_mofeta', archetype: true, hero: 'kevin',
      name: 'El Mofeta', cards: DECKS.mofeta
    });
  }
  if (Save.ownedSets.includes('fuga')) {
    list.push({
      id: 'arch_fuga', archetype: true, hero: 'marioHero',
      name: 'Fuga del Manicomio', cards: DECKS.fuga
    });
  }
  if (Save.ownedSets.includes('monzo')) {
    list.push({
      id: 'arch_monzo', archetype: true, hero: 'jorgeHero',
      name: 'La Impresora 3D', cards: DECKS.monzo
    });
  }
  if (Save.ownedSets.includes('motero')) {
    list.push({
      id: 'arch_motero', archetype: true, hero: 'victorHero',
      name: 'El Taller del Motero', cards: DECKS.motero
    });
  }
  if (Save.ownedSets.includes('mudanzas')) {
    list.push({
      id: 'arch_mudanzas', archetype: true, hero: 'paquitoHero',
      name: 'Mudanzas Serna', cards: DECKS.mudanzas
    });
  }
  if (Save.ownedSets.includes('supremo')) {
    list.push({
      id: 'arch_supremo', archetype: true, hero: 'marioSupremo',
      name: 'El Paciente Supremo', cards: DECKS.supremo
    });
  }
  return list;
}

function allDecks() { return [...archetypes(), ...Save.customDecks]; }

function activeDeck() {
  return allDecks().find(d => d.id === Save.activeDeckId) || archetypes()[0];
}

/* héroe y cartas con los que se juega (con red de seguridad) */
function activePlay() {
  const d = activeDeck();
  const heroOwned = PLAYABLE_HEROES.some(h => h.id === d.hero && Save.ownedSets.includes(h.set));
  return {
    hero: heroOwned ? d.hero : 'director',
    cards: isValidDeck(d.cards) ? d.cards : DECKS.sanatorio
  };
}

function currentHero() { return activePlay().hero; }

/* ---------- artículos de la tienda ---------- */

const SHOP_ITEMS = [
  {
    set: 'manonegra', emoji: '🖤', price: 400,
    img: 'assets/ilustraciones/nikuman.png',
    name: 'Baraja: La Mano Negra',
    desc: 'Las cartas de Nikuman, Cauntu, Kevin el Mofeta, los 5 gatos y la Ciborgización, disponibles para tus mazos.'
  },
  {
    set: 'recuerdos', emoji: '🍾', price: 250,
    img: null,
    name: 'Expansión: Recuerdos del Parque',
    desc: '5 cartas nuevas de la vieja época: la Litrona, el Vecino Cabreado, la Pandilla, el Coche de Empresa y el Mote Definitivo.'
  },
  {
    set: 'mofeta', emoji: '🦨', price: 500,
    img: 'assets/ilustraciones/keykebab.png',
    name: 'Baraja: El Mofeta',
    desc: 'Desbloquea a KEVIN COMO HÉROE JUGABLE (poder: Pedete Sorpresa) y 12 cartas de pedos, kebabs y caos gaseoso, con el estado «Olor a Peo».'
  },
  {
    set: 'fuga', emoji: '🚪', price: 600,
    img: 'assets/ilustraciones/mario.png',
    name: 'Expansión: Fuga del Manicomio',
    desc: 'MARIO MATAS como héroe jugable (poder: Trapicheo) y 13 cartas de pura movilidad: el ENCANE (cartas que se activan al descartarse), planes de fuga que devuelven esbirros con descuento, el Yogur de Piña, túneles y Eduardo de «seguridad».'
  },
  {
    set: 'monzo', emoji: '🖨️', price: 700,
    img: 'assets/ilustraciones/monzo.png',
    name: 'Mazo: La Impresora 3D',
    desc: 'JORGE MONZO como héroe jugable (poder: Imprimir en 3D) y 12 cartas con la mecánica IMPRIMIR (generan fichas impresas), pedos, calvicie, Counter-Strike, WoW Classic y Peter el gato gordo.'
  },
  {
    set: 'motero', emoji: '🏍️', price: 700,
    img: 'assets/ilustraciones/victor.png',
    name: 'Mazo: El Taller del Motero',
    desc: 'VÍCTOR LAMAS como héroe jugable (poder: Acelerón) y 12 cartas de velocidad pura: motos con Embestida, «arreglos» que rompen lo que tocan y reclamaciones al seguro.'
  },
  {
    set: 'picado', emoji: '💢', price: 350,
    img: 'assets/ilustraciones/rabasco.png',
    name: 'Expansión: Los Picados',
    desc: '6 cartas con la mecánica PICADO de Rabasco: esbirros que se encanan y ganan ataque cada vez que sobreviven a un golpe. Cuanto más les pegas, peor para ti.'
  },
  {
    set: 'mudanzas', emoji: '💪', price: 700,
    img: 'assets/ilustraciones/paquito.png',
    name: 'Mazo: Mudanzas Serna',
    desc: 'PAQUITO LA BESTIA como héroe jugable (poder: A Pulso) y 11 cartas de fuerza bruta: muros con Provocar, lavadoras lanzadas a un quinto piso y la sala de adamantium. Nosotros no necesitamos grúa.'
  },
  {
    set: 'supremo', emoji: '🧠', price: 900,
    img: 'assets/ilustraciones/mario.png',
    name: 'Mazo: El Paciente Supremo',
    desc: 'MARIO SUPREMO como héroe jugable (poder: Mover los Hilos, roba ideas de la mano rival) y 12 cartas de control mental: motes que hunden, engaños entre esbirros y el CONTROL MENTAL definitivo.'
  }
];

const SHOP_SLOT_Y = [191, 422, 665];
let shopPage = 0;

/* ---------- guardado ---------- */

function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(Save)); } catch (e) {}
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.profile && typeof s.profile.id === 'string' && typeof s.profile.name === 'string') {
        Save.profile = s.profile;
      }
      if (typeof s.coins === 'number') Save.coins = s.coins;
      if (Array.isArray(s.ownedSets)) Save.ownedSets = s.ownedSets;
      if (Array.isArray(s.customDecks)) Save.customDecks = s.customDecks;
      if (typeof s.activeDeckId === 'string') Save.activeDeckId = s.activeDeckId;
      if (typeof s.packsFreeLeft === 'number') Save.packsFreeLeft = s.packsFreeLeft;
      if (typeof s.packsDay === 'string') Save.packsDay = s.packsDay;
      if (s.cardCollection && typeof s.cardCollection === 'object') Save.cardCollection = s.cardCollection;
      if (s.cardVariants && typeof s.cardVariants === 'object') Save.cardVariants = s.cardVariants;
      if (s.story && Array.isArray(s.story.defeated) && Array.isArray(s.story.revealed)) {
        Save.story = { defeated: s.story.defeated.slice(), revealed: s.story.revealed.slice() };
      }
      if (s.settings) Object.assign(Save.settings, s.settings);
      if (s.stats && typeof s.stats === 'object') Object.assign(Save.stats, s.stats);
      if (Array.isArray(s.tradeOut)) Save.tradeOut = s.tradeOut;
      if (s.cardMinus && typeof s.cardMinus === 'object') Save.cardMinus = s.cardMinus;

      /* migración de guardados antiguos (mazo único o mazo por héroe) */
      if (!Array.isArray(s.customDecks)) {
        const olds = s.decks || (Array.isArray(s.deck) ? { director: s.deck } : {});
        for (const heroId of Object.keys(olds)) {
          const cards = olds[heroId];
          const base = heroId === 'kevin' ? DECKS.mofeta : DECKS.sanatorio;
          if (isValidDeck(cards) && cards.slice().sort().join() !== base.slice().sort().join()) {
            Save.customDecks.push({
              id: 'custom_mig_' + heroId, archetype: false, hero: heroId,
              name: 'Mi mazo de ' + (heroId === 'kevin' ? 'Kevin' : 'Rafa'),
              cards
            });
          }
        }
        if (s.hero === 'kevin') {
          Save.activeDeckId = Save.customDecks.some(d => d.id === 'custom_mig_kevin')
            ? 'custom_mig_kevin' : 'arch_mofeta';
        }
      }
    }
  } catch (e) {}
  if (!allDecks().some(d => d.id === Save.activeDeckId)) Save.activeDeckId = 'arch_sanatorio';
  /* reinicio diario de sobres gratis */
  if (typeof todayStr === 'function' && Save.packsDay !== todayStr()) {
    Save.packsDay = todayStr();
    Save.packsFreeLeft = 2;
    persistSave();
  }
  applySettings();
}

/* ---------- perfil: ficha de ingreso del paciente ----------
   La primera vez se registra un nombre y el juego asigna un ID
   permanente (ENF-XXXX-XXXX). El progreso vive ligado a esa ficha
   y puede llevarse a otro dispositivo con el código de progreso. */

function makeUserId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I: se dictan sin errores
  const bytes = new Uint8Array(8);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[bytes[i] % chars.length];
  return 'ENF-' + s.slice(0, 4) + '-' + s.slice(4);
}

function registerUser(name) {
  Save.profile = {
    name: name.trim().slice(0, 16),
    id: makeUserId(),
    created: typeof todayStr === 'function' ? todayStr() : ''
  };
  persistSave();
  return Save.profile;
}

/* código de progreso: todo el guardado en base64 para copiarlo
   y pegarlo en otro dispositivo (misma ficha, mismo ID) */
function exportProgressCode() {
  return btoa(unescape(encodeURIComponent(JSON.stringify(Save))));
}

function importProgressCode(code) {
  try {
    const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!s || typeof s !== 'object' || typeof s.coins !== 'number' ||
        !s.profile || typeof s.profile.id !== 'string') return false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch (e) { return false; }
}

function maxCopies(id) { return CARDS[id].rarity === 'legendaria' ? 1 : 2; }

function isValidDeck(list) {
  if (!Array.isArray(list) || list.length !== 30) return false;
  const counts = {};
  for (const id of list) {
    if (!CARDS[id] || CARDS[id].token) return false;
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > maxCopies(id)) return false;
  }
  return true;
}

/* ¿la carta viene con alguna baraja comprada? */
function setOwnedCard(id) {
  return Save.ownedSets.some(s => SETS[s] && SETS[s].cards.includes(id));
}

/* copias utilizables en mazos: las de los sets dan el máximo;
   las de sobres, tantas como hayas conseguido (hasta el máximo).
   Las cartas ENVIADAS a amigos (cardMinus) se descuentan. */
function availableCopies(id) {
  const base = setOwnedCard(id) ? maxCopies(id)
    : Math.min(maxCopies(id), (Save.cardCollection && Save.cardCollection[id]) || 0);
  const minus = (Save.cardMinus && Save.cardMinus[id]) || 0;
  return Math.max(0, base - minus);
}

/* cartas coleccionables que posee el jugador (sets + sobres) */
function collectionIds() {
  const ids = new Set();
  for (const set of Save.ownedSets) {
    if (SETS[set]) SETS[set].cards.forEach(id => ids.add(id));
  }
  for (const id of Object.keys(Save.cardCollection || {})) {
    if ((Save.cardCollection[id] || 0) > 0 && CARDS[id]) ids.add(id);
  }
  return [...ids].sort((a, b) =>
    (CARDS[a].cost - CARDS[b].cost) || CARDS[a].name.localeCompare(CARDS[b].name));
}

/* =========================================================
   COMPARTIR CARTAS — por código (sin servidor: el código
   viaja por WhatsApp; funciona en web, APK y Electron).
   INTERCAMBIO DE VERDAD: la carta que envías SALE de tu
   colección (queda «en depósito») y la de tu amigo entra.
   Nadie te puede robar: tú eliges qué mandas y qué aceptas.
   - REGALO: la carta sale de tu colección al generar el
     código; tu amigo la acepta (o caduca y la recuperas).
   - INTERCAMBIO: ofreces una carta (sale a depósito); tu
     amigo acepta respondiendo con una suya del MISMO VALOR
     (rareza) — la suya sale de su colección y la tuya entra
     en la de él; con su código de respuesta recibes la suya.
   - CADUCIDAD: los códigos valen 6 HORAS. Si nadie acepta a
     tiempo, el envío se cancela y tu carta vuelve sola.
   - Requisito para RECIBIR: mazo de la carta desbloqueado
     (paciente vencido en la historia o set comprado).
   ========================================================= */

const TRADE_TAG = 'ENFCARTA2.';
const TRADE_EXPIRY_MS = 6 * 60 * 60 * 1000;   // 6 horas

function tradeExpired(t) { return Date.now() - t > TRADE_EXPIRY_MS; }

/* una carta SALE de tu colección (enviada a un amigo) */
function removeCardCopy(id) {
  const col = (Save.cardCollection && Save.cardCollection[id]) || 0;
  if (col > 0) Save.cardCollection[id] = col - 1;
  else {
    Save.cardMinus = Save.cardMinus || {};
    Save.cardMinus[id] = (Save.cardMinus[id] || 0) + 1;
  }
  persistSave();
}

/* caducidad: los INTERCAMBIOS vencidos se cancelan solos y la carta
   vuelve; los REGALOS vencidos se recuperan a mano (con aviso) */
function checkTradeExpiry() {
  const vencidos = Save.tradeOut.filter(x => x.kind === 'offer' && tradeExpired(x.t));
  if (!vencidos.length) return [];
  Save.tradeOut = Save.tradeOut.filter(x => !vencidos.includes(x));
  for (const v of vencidos) addSharedCard(v.c);
  persistSave();
  return vencidos.map(v => CARDS[v.c].name);
}

function tradeEncode(obj) {
  return TRADE_TAG + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function tradeDecode(str) {
  try {
    str = String(str || '').trim();
    if (!str.startsWith(TRADE_TAG)) return null;
    const o = JSON.parse(decodeURIComponent(escape(atob(str.slice(TRADE_TAG.length)))));
    return (o && CARDS[o.c] && ['gift', 'offer', 'ans'].includes(o.k)) ? o : null;
  } catch (e) { return null; }
}

/* ¿puede este jugador RECIBIR la carta? (mazo desbloqueado) */
function canReceiveCard(id) {
  const d = CARDS[id];
  if (!d || d.token) return { ok: false, why: 'Esa carta es una ficha: no se puede compartir.' };
  const si = cardSetInfo(id);
  if (si.kind === 'basica') return { ok: true };
  if (si.key && (Save.ownedSets.includes(si.key) || deckPurchaseUnlocked(si.key))) return { ok: true };
  return {
    ok: false,
    why: `Para recibir esta carta necesitas desbloquear «${si.name}»: vence a su paciente en el Modo Historia.`
  };
}

function addSharedCard(id) {
  /* primero cancela deudas de envío; después suma copias */
  const minus = (Save.cardMinus && Save.cardMinus[id]) || 0;
  if (minus > 0) Save.cardMinus[id] = minus - 1;
  else Save.cardCollection[id] = (Save.cardCollection[id] || 0) + 1;
  persistSave();
}

/* cartas propias que se pueden ENVIAR: sin fichas y con copias libres */
function tradeableIds() {
  return collectionIds().filter(id => !CARDS[id].token && availableCopies(id) > 0);
}

function renderTradeScreen() {
  const sel = document.getElementById('trade-card');
  if (!sel) return;
  /* intercambios caducados: se cancelan y la carta vuelve sola */
  const vueltas = checkTradeExpiry();
  sel.innerHTML = tradeableIds().map(id =>
    `<option value="${id}">${CARDS[id].name} · ${CARDS[id].rarity}</option>`).join('');
  document.getElementById('trade-out').value = '';
  document.getElementById('trade-in').value = '';
  const box = document.getElementById('trade-result');
  box.innerHTML = vueltas.length
    ? `<p class="lore" style="margin:8px 0">⏳ Intercambio caducado: <b>${vueltas.join('</b>, <b>')}</b> ha vuelto a tu colección.</p>`
    : '';
  renderTradePending();
}

/* envíos en depósito: qué cartas tuyas están fuera esperando respuesta */
function renderTradePending() {
  let pend = document.getElementById('trade-pending');
  if (!pend) return;
  if (!Save.tradeOut.length) { pend.innerHTML = ''; return; }
  pend.innerHTML = '<h3>📦 En depósito</h3>' + Save.tradeOut.map((x, i) => {
    const mins = Math.max(0, Math.round((x.t + TRADE_EXPIRY_MS - Date.now()) / 60000));
    const caducado = tradeExpired(x.t);
    const tipo = x.kind === 'gift' ? '🎁' : '🔁';
    return `<div class="tp-row">${tipo} <b>${CARDS[x.c].name}</b> · ${caducado ? 'CADUCADO' : `caduca en ${Math.floor(mins / 60)}h ${mins % 60}m`}
      ${x.kind === 'gift' && caducado ? `<button class="small-btn tp-recover" data-i="${i}">Recuperar</button>` : ''}</div>`;
  }).join('');
  pend.querySelectorAll('.tp-recover').forEach(b => b.addEventListener('click', () => {
    const x = Save.tradeOut[+b.dataset.i];
    if (!x) return;
    if (!confirm(`¿Recuperar «${CARDS[x.c].name}»? OJO: si tu amigo ya aceptó el regalo, recuperarla sería duplicarla (y eso es trampa).`)) return;
    Save.tradeOut = Save.tradeOut.filter(y => y !== x);
    addSharedCard(x.c);
    persistSave();
    renderTradeScreen();
  }));
}

function tradeGenerate() {
  const id = document.getElementById('trade-card').value;
  const kind = document.querySelector('input[name="trade-kind"]:checked').value;
  if (!id || !CARDS[id] || !Save.profile) return;
  if (availableCopies(id) <= 0) return;
  const obj = {
    k: kind === 'offer' ? 'offer' : 'gift',
    c: id, r: CARDS[id].rarity,
    f: { i: Save.profile.id, n: Save.profile.name }, t: Date.now()
  };
  /* la carta SALE de tu colección y queda en depósito */
  removeCardCopy(id);
  Save.tradeOut.unshift({ c: id, t: obj.t, kind: obj.k });
  if (Save.tradeOut.length > 10) {
    const sobrante = Save.tradeOut.pop();
    addSharedCard(sobrante.c);   // no se pierde: vuelve si se desborda la lista
  }
  persistSave();
  document.getElementById('trade-out').value = tradeEncode(obj);
  renderTradePending();
}

function tradeCopy() {
  const ta = document.getElementById('trade-out');
  if (!ta.value) return;
  ta.select();
  try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
  flashOk(document.getElementById('btn-trade-copy'));
}

function tradeRead() {
  const box = document.getElementById('trade-result');
  const obj = tradeDecode(document.getElementById('trade-in').value);
  box.innerHTML = '';
  const note = (html) => { box.innerHTML = `<p class="lore" style="margin:8px 0">${html}</p>`; };
  if (!obj) return note('❌ Ese código no es válido.');
  if (Save.profile && obj.f && obj.f.i === Save.profile.id) return note('😅 Ese código lo generaste tú mismo.');
  const card = CARDS[obj.c];
  const de = obj.f ? ` de <b>${obj.f.n}</b> (${obj.f.i})` : '';

  if (obj.k === 'gift') {
    if (tradeExpired(obj.t)) return note('⏳ Este regalo ha CADUCADO (los códigos valen 6 horas). Pídele otro.');
    const chk = canReceiveCard(obj.c);
    if (!chk.ok) return note('🔒 ' + chk.why);
    note(`🎁 Regalo${de}: <b>${card.name}</b> (${card.rarity}).`);
    const b1 = document.createElement('button');
    b1.className = 'small-btn'; b1.textContent = '✅ Aceptar carta';
    b1.onclick = () => { addSharedCard(obj.c); note(`🎉 <b>${card.name}</b> añadida a tu colección.`); Sfx.play('win'); };
    const b2 = document.createElement('button');
    b2.className = 'small-btn danger'; b2.textContent = '✖ Rechazar';
    b2.onclick = () => note('Regalo rechazado: cuando caduque, la carta volverá a tu amigo.');
    box.append(b1, b2);
    return;
  }

  if (obj.k === 'offer') {
    if (tradeExpired(obj.t)) return note('⏳ Esta oferta ha CADUCADO (los códigos valen 6 horas): el intercambio queda cancelado y su carta vuelve a tu amigo.');
    const chk = canReceiveCard(obj.c);
    if (!chk.ok) return note('🔒 ' + chk.why);
    const mias = tradeableIds().filter(id => CARDS[id].rarity === obj.r && id !== obj.c);
    if (!mias.length) return note(`⚖️ Te ofrecen <b>${card.name}</b> (${card.rarity}), pero no tienes ninguna carta libre de ese valor para intercambiar.`);
    note(`🔁 Intercambio${de}: te ofrece <b>${card.name}</b> (${card.rarity}). Elige la carta tuya del MISMO valor que le darás a cambio (SALDRÁ de tu colección):`);
    const sel = document.createElement('select');
    sel.innerHTML = mias.map(id => `<option value="${id}">${CARDS[id].name} · ${CARDS[id].rarity}</option>`).join('');
    const b1 = document.createElement('button');
    b1.className = 'small-btn'; b1.textContent = '✅ Aceptar e intercambiar';
    b1.onclick = () => {
      const mia = sel.value;
      if (availableCopies(mia) <= 0) return note('❌ Ya no tienes copias libres de esa carta.');
      removeCardCopy(mia);          // tu carta SALE hacia tu amigo
      addSharedCard(obj.c);         // la suya ENTRA en tu colección
      const ans = { k: 'ans', c: mia, o: obj.c, r: obj.r, f: { i: Save.profile.id, n: Save.profile.name }, t: Date.now() };
      document.getElementById('trade-out').value = tradeEncode(ans);
      note(`🎉 <b>${card.name}</b> es tuya y tu <b>${CARDS[mia].name}</b> ha salido hacia tu amigo. Envíale el código de respuesta (arriba) para que la reciba.`);
      Sfx.play('win');
      renderTradePending();
    };
    const b2 = document.createElement('button');
    b2.className = 'small-btn danger'; b2.textContent = '✖ Rechazar';
    b2.onclick = () => note('Intercambio rechazado: cuando caduque, la carta volverá a tu amigo.');
    box.append(sel, b1, b2);
    return;
  }

  /* respuesta a un intercambio que TÚ ofreciste: recibes su carta */
  if (obj.k === 'ans') {
    const mine = Save.tradeOut.find(x => x.c === obj.o && x.kind === 'offer');
    if (!mine) return note('🤔 Esa respuesta no corresponde a ningún intercambio tuyo pendiente (¿caducó y tu carta ya volvió?).');
    if (CARDS[obj.c].rarity !== CARDS[obj.o].rarity) return note('⚖️ Ese intercambio no es del mismo valor. Código rechazado.');
    const chk = canReceiveCard(obj.c);
    if (!chk.ok) return note('🔒 ' + chk.why);
    note(`🔁 ${obj.f ? `<b>${obj.f.n}</b>` : 'Tu amigo'} ha aceptado: tu <b>${CARDS[obj.o].name}</b> ya es suya y te envía <b>${card.name}</b> (${card.rarity}).`);
    const b1 = document.createElement('button');
    b1.className = 'small-btn'; b1.textContent = '✅ Completar intercambio';
    b1.onclick = () => {
      addSharedCard(obj.c);                                // su carta entra
      Save.tradeOut = Save.tradeOut.filter(x => x !== mine); // la tuya ya no vuelve
      persistSave();
      note(`🎉 <b>${card.name}</b> añadida a tu colección. Intercambio completado.`);
      Sfx.play('win');
      renderTradePending();
    };
    box.append(b1);
  }
}

/* ---------- ajustes aplicados al juego ---------- */

function applySettings() {
  Sfx.enabled = Save.settings.sound;
  if (typeof Music !== 'undefined') Music.refresh();
  AIH.delay = ms => new Promise(r => setTimeout(r, Save.settings.fastAI ? ms * 0.35 : ms));
  const logPanel = document.getElementById('log-panel');
  const logToggle = document.getElementById('log-toggle');
  if (logPanel) logPanel.style.display = Save.settings.showLog ? '' : 'none';
  if (logToggle) logToggle.style.display = Save.settings.showLog ? '' : 'none';
}

/* ---------- FICHA DEL PACIENTE: historial de batallas y ELO ----------
   El ELO es interno (K=32, arranque 1000). Los rivales de la historia
   tienen rating fijo según su dificultad; IA libre y online = 1000. */
const STORY_ELO = { nikuman: 950, kevin: 980, jorge: 1120, victor: 1060, rabasco: 1060, paquito: 1120, mario: 1250 };

function recordBattle(winner) {
  if (winner !== 0 && winner !== 1) return;   // el doble K.O. no puntúa
  const st = Save.stats;
  const mp = typeof MP !== 'undefined' && (MP.active || MP.role);
  const enemy = (!mp && typeof activeStoryEnemy !== 'undefined' && activeStoryEnemy) ? activeStoryEnemy : null;
  const mode = mp ? 'online' : (enemy ? 'historia' : 'libre');
  const vs = (typeof G !== 'undefined' && G) ? G.players[1].hero.def.name.split(' «')[0] : 'Rival';
  const oppElo = enemy ? (STORY_ELO[enemy.id] || 1000) : 1000;
  const win = winner === 0;
  st.games++;
  if (win) st.wins++; else st.losses++;
  st.streak = win ? (st.streak > 0 ? st.streak + 1 : 1) : 0;
  if (st.streak > st.bestStreak) st.bestStreak = st.streak;
  const esperado = 1 / (1 + Math.pow(10, (oppElo - st.elo) / 400));
  st.elo = Math.max(0, Math.round(st.elo + 32 * ((win ? 1 : 0) - esperado)));
  st.log.unshift({ vs, mode, win, elo: st.elo, t: Date.now() });
  if (st.log.length > 30) st.log.length = 30;
  persistSave();
}

function renderProfile() {
  const st = Save.stats;
  const el = document.getElementById('profile-body');
  if (!el) return;
  const wr = st.games ? Math.round(100 * st.wins / st.games) : 0;
  const fmt = t => new Date(t).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  el.innerHTML = `
    <p class="lore" style="margin:6px 0 12px">${Save.profile
      ? `Paciente <b>${Save.profile.name}</b> · Expediente <b>${Save.profile.id}</b>` : 'Sin ficha de ingreso'}</p>
    <div class="profile-stats">
      <div class="ps-box"><b>${st.elo}</b><span>ELO</span></div>
      <div class="ps-box"><b>${st.games}</b><span>Partidas</span></div>
      <div class="ps-box"><b>${st.wins}</b><span>Victorias</span></div>
      <div class="ps-box"><b>${st.losses}</b><span>Derrotas</span></div>
      <div class="ps-box"><b>${wr}%</b><span>Winrate</span></div>
      <div class="ps-box"><b>${st.bestStreak}</b><span>Mejor racha</span></div>
    </div>
    <div class="battle-log">
      ${st.log.length
        ? st.log.map(l => `
          <div class="bl-row ${l.win ? 'w' : 'l'}">
            <span class="bl-res">${l.win ? '🏆' : '💀'}</span>
            <span class="bl-vs">${l.vs}</span>
            <span class="bl-mode">${l.mode}</span>
            <span class="bl-elo">${l.elo}</span>
            <span class="bl-date">${fmt(l.t)}</span>
          </div>`).join('')
        : '<p class="hint">Aún no hay batallas en el expediente. ¡Al tablero!</p>'}
    </div>`;
}

/* ---------- navegación entre pantallas ---------- */

const SCREENS = ['register-screen', 'main-menu', 'story-screen', 'deck-screen', 'shop-screen', 'settings-screen', 'online-screen', 'profile-screen', 'trade-screen', 'end-overlay'];

function showScreen(id) {
  for (const s of SCREENS) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  }
  /* en cualquier pantalla de menú suena la música de menús */
  if (typeof Music !== 'undefined') Music.set('menus');
  if (id === 'main-menu') {
    document.getElementById('menu-coins').textContent = Save.coins;
    const pb = document.getElementById('menu-profile');
    if (pb) pb.textContent = Save.profile
      ? `🧑‍⚕️ ${Save.profile.name} · ${Save.profile.id}` : '';
  }
  if (id === 'shop-screen') {
    renderShop();
    if (typeof shopShowTab === 'function') shopShowTab('decks');
  }
  if (id === 'deck-screen') openDeckEditor();
  if (id === 'story-screen') renderStoryScreen();
  if (id === 'settings-screen') renderSettings();
  if (id === 'profile-screen') renderProfile();
  if (id === 'trade-screen') renderTradeScreen();
  if (typeof fitOverlays === 'function') fitOverlays();
}

function hideAllScreens() {
  for (const s of SCREENS) document.getElementById(s).classList.add('hidden');
}

/* ---------- gestor de mazos ---------- */

let workingDeck = [];

function openDeckEditor() {
  workingDeck = [...activeDeck().cards];
  closeDeckDropdown();
  renderDeckEditor();
}

/* guarda en silencio los cambios del mazo propio activo (se admiten
   borradores incompletos: la etiqueta del desplegable muestra su estado).
   Los arquetipos nunca se tocan. */
function autoSaveWorking() {
  const d = activeDeck();
  if (d.archetype) return true;
  d.cards = [...workingDeck];
  persistSave();
  return true;
}

/* editar un arquetipo crea automáticamente una copia propia y pasa a ella */
function forkIfArchetype() {
  const d = activeDeck();
  if (!d.archetype) return false;
  const copy = {
    id: 'custom_' + Date.now(), archetype: false, hero: d.hero,
    name: `${d.name} (copia)`,
    cards: [...workingDeck]
  };
  Save.customDecks.push(copy);
  Save.activeDeckId = copy.id;
  persistSave();
  banner('✏️ Creado «' + copy.name + '» — editando tu copia');
  return true;
}

function selectDeck(id) {
  if (!autoSaveWorking()) return;
  Save.activeDeckId = id;
  persistSave();
  Sfx.play('play');
  workingDeck = [...activeDeck().cards];
  closeDeckDropdown();
  renderDeckEditor();
  banner('Mazo activo: ' + activeDeck().name);
}

function createNewDeck() {
  if (!autoSaveWorking()) return;
  const deck = {
    id: 'custom_' + Date.now(), archetype: false,
    hero: activeDeck().hero,
    name: 'Mazo nuevo ' + (Save.customDecks.length + 1),
    cards: []
  };
  Save.customDecks.push(deck);
  Save.activeDeckId = deck.id;
  persistSave();
  workingDeck = [];
  closeDeckDropdown();
  renderDeckEditor();
  banner('Creado «' + deck.name + '» — añade 30 cartas');
}

function deleteDeck(id) {
  const d = Save.customDecks.find(x => x.id === id);
  if (!d) return;
  if (!confirm(`¿Borrar el mazo «${d.name}»?`)) return;
  Save.customDecks = Save.customDecks.filter(x => x.id !== id);
  if (Save.activeDeckId === id) Save.activeDeckId = 'arch_sanatorio';
  persistSave();
  workingDeck = [...activeDeck().cards];
  renderDeckDropdown();
  renderDeckEditor();
}

function renameActiveDeck() {
  const d = activeDeck();
  if (d.archetype) return;
  const name = prompt('Nombre del mazo:', d.name);
  if (name && name.trim()) {
    d.name = name.trim().slice(0, 40);
    persistSave();
    renderDeckEditor();
  }
}

/* el candado o la foto: cambia el héroe del mazo propio activo */
function cycleHero() {
  const d = activeDeck();
  if (d.archetype) return;
  const owned = PLAYABLE_HEROES.filter(x => Save.ownedSets.includes(x.set));
  if (owned.length < 2) return;
  const i = owned.findIndex(x => x.id === d.hero);
  d.hero = owned[(i + 1) % owned.length].id;
  persistSave();
  Sfx.play('play');
  renderDeckEditor();
}

/* ---------- desplegable de mazos ---------- */

function toggleDeckDropdown() {
  const dd = document.getElementById('deck-dropdown');
  if (dd.classList.contains('hidden')) {
    renderDeckDropdown();
    dd.classList.remove('hidden');
  } else {
    dd.classList.add('hidden');
  }
}

function closeDeckDropdown() {
  document.getElementById('deck-dropdown').classList.add('hidden');
}

function renderDeckDropdown() {
  const dd = document.getElementById('deck-dropdown');
  /* scroll interno: los bordes del marco quedan fijos */
  dd.innerHTML = '<div class="dd-scroll"></div>';
  const scroll = dd.querySelector('.dd-scroll');
  for (const d of allDecks()) {
    const h = HEROES[d.hero];
    const row = document.createElement('div');
    row.className = 'dd-row' + (d.id === Save.activeDeckId ? ' active' : '');
    row.innerHTML = `
      <span class="dd-hero">${h ? h.portrait : '❓'}</span>
      <span class="dd-name">${d.name}</span>
      <span class="dd-tag">${d.archetype ? 'ARQUETIPO' : (isValidDeck(d.cards) ? '30/30' : d.cards.length + '/30')}</span>
      ${d.archetype ? '' : '<span class="dd-del" title="Borrar este mazo">🗑</span>'}`;
    row.addEventListener('click', e => {
      if (e.target.classList.contains('dd-del')) {
        e.stopPropagation();
        deleteDeck(d.id);
        return;
      }
      selectDeck(d.id);
    });
    scroll.appendChild(row);
  }
  const actions = document.createElement('div');
  actions.className = 'dd-actions';
  const esArquetipo = activeDeck().archetype;
  actions.innerHTML = `
    ${esArquetipo ? '<button class="small-btn" id="dd-copy">✏️ Editar (crear copia)</button>' : ''}
    <button class="small-btn gold" id="dd-new">➕ Nuevo mazo de 0</button>`;
  const copyBtn = actions.querySelector('#dd-copy');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    forkIfArchetype();
    closeDeckDropdown();
    renderDeckEditor();
  });
  actions.querySelector('#dd-new').addEventListener('click', createNewDeck);
  scroll.appendChild(actions);
  box9(dd);
}

/* ---------- editor ---------- */

function deckCounts() {
  const counts = {};
  for (const id of workingDeck) counts[id] = (counts[id] || 0) + 1;
  return counts;
}

function renderDeckEditor() {
  const counts = deckCounts();
  const d = activeDeck();
  const h = HEROES[d.hero];

  /* cabecera: nombre del mazo (desplegable), héroe y candado */
  const title = document.getElementById('deck-title');
  title.innerHTML = `<span class="dt-name">${d.name}</span><span class="dt-caret">▾</span>`;
  title.title = d.archetype
    ? 'Mazo ARQUETIPO (clic para cambiar de mazo; al editar sus cartas se creará una copia tuya)'
    : 'Clic para cambiar de mazo · doble clic para renombrar este mazo';

  const win = document.getElementById('deck-hero-window');
  const art = (typeof ILUSTRACIONES !== 'undefined' && ILUSTRACIONES['hero_' + d.hero]) || null;
  win.innerHTML = art
    ? `<img src="${art}" alt="" onerror="this.replaceWith('${h.portrait}')">`
    : h.portrait;
  win.title = `${h.name} — ${h.power.name}: ${h.power.desc}`
    + (d.archetype ? '' : ' · clic para cambiar el héroe de este mazo');

  const ownedHeroes = PLAYABLE_HEROES.filter(x => Save.ownedSets.includes(x.set));
  const lockBtn = document.getElementById('btn-hero-cycle');
  lockBtn.disabled = d.archetype || ownedHeroes.length < 2;
  lockBtn.title = d.archetype
    ? 'Los arquetipos tienen héroe fijo: crea una copia para cambiarlo'
    : (ownedHeroes.length < 2
      ? 'Compra más barajas en la tienda para desbloquear héroes nuevos'
      : 'Cambiar el héroe de este mazo');

  /* colección (izquierda): tus cartas, clic para añadir */
  const col = document.getElementById('collection');
  col.innerHTML = '';
  for (const id of collectionIds()) {
    const inDeck = counts[id] || 0;
    const avail = availableCopies(id);
    const free = avail - inDeck;
    const wrap = document.createElement('div');
    wrap.className = 'col-card' + (free <= 0 ? ' maxed' : '');
    const fake = { def: CARDS[id], id, costMod: 0, uid: 'col_' + id };
    const el = cardEl(fake);
    el.classList.remove('hand-card');
    wrap.appendChild(el);
    const badge = document.createElement('div');
    badge.className = 'col-count';
    badge.textContent = inDeck > 0 ? `${inDeck}/${avail} en el mazo` : `x${avail} disponibles`;
    wrap.appendChild(badge);
    /* clic: añadir al mazo (con retardo corto) · doble clic o
       pulsación larga (móvil): inspeccionar */
    let clickTimer = null;
    wrap.addEventListener('click', () => {
      if (wrap.__lpFired) { wrap.__lpFired = false; return; }
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
      clickTimer = setTimeout(() => {
        clickTimer = null;
        if (workingDeck.length >= 30 || free <= 0) return;
        forkIfArchetype();
        workingDeck.push(id);
        Sfx.play('draw');
        renderDeckEditor();
      }, 230);
    });
    wrap.addEventListener('dblclick', () => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      openCardInspector(fake);
    });
    addLongPress(wrap, () => openCardInspector(fake));
    wrap.addEventListener('mouseenter', () => showPreviewCard(fake));
    wrap.addEventListener('mouseleave', hidePreview);
    col.appendChild(wrap);
  }

  /* Las cartas de mazos/expansiones que aún no tienes NO se muestran:
     así se mantiene el misterio de la historia. Aparecen en tu
     colección solo cuando desbloqueas ese mazo (o lo sacas en sobre). */

  /* mazo (derecha): filas agrupadas, clic para quitar */
  const list = document.getElementById('deck-list');
  list.innerHTML = '';
  const ids = Object.keys(counts).sort((a, b) =>
    (CARDS[a].cost - CARDS[b].cost) || CARDS[a].name.localeCompare(CARDS[b].name));
  for (const id of ids) {
    const cd = CARDS[id];
    const row = document.createElement('div');
    row.className = `deck-row r-${cd.rarity}`;
    row.innerHTML = `
      <span class="dr-cost">${cd.cost}</span>
      <span class="dr-name">${cd.name}</span>
      <span class="dr-n">${counts[id] > 1 ? 'x' + counts[id] : ''}</span>`;
    row.addEventListener('click', () => {
      forkIfArchetype();
      workingDeck.splice(workingDeck.indexOf(id), 1);
      Sfx.play('damage');
      renderDeckEditor();
    });
    row.addEventListener('mouseenter', () => showPreviewCard({ def: cd, id, costMod: 0 }));
    row.addEventListener('mouseleave', hidePreview);
    list.appendChild(row);
  }

  /* contador, info y botón guardar */
  const count = document.getElementById('deck-count');
  count.textContent = `${workingDeck.length}/30`;
  count.classList.toggle('bad', workingDeck.length !== 30);
  document.getElementById('btn-deck-save').disabled = d.archetype || workingDeck.length !== 30;
  document.getElementById('collection-info').textContent = d.archetype
    ? 'ARQUETIPO · al editar se crea una copia'
    : `${collectionIds().length} cartas en tu colección`;
}

function autoCompleteDeck() {
  forkIfArchetype();
  const counts = deckCounts();
  const pool = collectionIds();
  let i = 0, safety = 0;
  while (workingDeck.length < 30 && safety++ < 500) {
    const id = pool[i % pool.length];
    i++;
    if ((counts[id] || 0) < maxCopies(id)) {
      counts[id] = (counts[id] || 0) + 1;
      workingDeck.push(id);
    }
  }
  renderDeckEditor();
}

function saveDeck() {
  const d = activeDeck();
  if (d.archetype || !isValidDeck(workingDeck)) return;
  d.cards = [...workingDeck];
  persistSave();
  Sfx.play('turn');
  const btn = document.getElementById('btn-deck-save');
  btn.classList.remove('flash-ok');
  void btn.offsetWidth;
  btn.classList.add('flash-ok');
}

/* ---------- tienda ---------- */

/* =========================================================
   MODO HISTORIA — MAPA DE ENEMIGOS DEL CAPÍTULO
   ========================================================= */

/* MODO TEST DE HISTORIA: con true, TODOS los enemigos están revelados y
   se puede luchar contra cualquiera (para probar mazos y diálogos).
   Poner a false para la progresión real (vencer en orden). */
const STORY_TEST_MODE = true;

function storyEnemies() {
  return (typeof HISTORIA !== 'undefined' && HISTORIA.capitulo1)
    ? HISTORIA.capitulo1.enemigos : [];
}

/* sets que SOLO se consiguen jugando la historia (no en la tienda);
   `desbloquea` puede ser un set o una lista (el boss suelta varios) */
function enemyUnlocks(e) {
  return !e.desbloquea ? [] : (Array.isArray(e.desbloquea) ? e.desbloquea : [e.desbloquea]);
}
function storyUnlockSets() {
  const set = new Set();
  for (const e of storyEnemies()) for (const s of enemyUnlocks(e)) set.add(s);
  return set;
}

/* índice del enemigo que toca ahora (el primero no derrotado); -1 si acabado */
function storyCurrentIndex() {
  const en = storyEnemies();
  for (let i = 0; i < en.length; i++) {
    if (!Save.story.defeated.includes(en[i].id)) return i;
  }
  return -1;
}

function storyChapterComplete() { return storyCurrentIndex() === -1; }

/* ¿conocemos ya la identidad de este enemigo? (el 1º siempre; los
   derrotados y los ya revelados también) */
function storyIsRevealed(id) {
  if (STORY_TEST_MODE) return true;
  const en = storyEnemies();
  if (en.length && en[0].id === id) return true;
  return Save.story.defeated.includes(id) || Save.story.revealed.includes(id);
}

/* marcar un enemigo como derrotado y desbloquear su mazo */
function storyDefeat(id) {
  if (!Save.story.defeated.includes(id)) Save.story.defeated.push(id);
  /* vencer NO regala el mazo: desbloquea su COMPRA en la tienda (deriva de
     los enemigos derrotados, ver deckPurchaseUnlocked) */
  persistSave();
}

/* ¿se puede COMPRAR ya el mazo de este set? (su paciente está derrotado) */
function deckPurchaseUnlocked(set) {
  return storyEnemies().some(e => enemyUnlocks(e).includes(set) && Save.story.defeated.includes(e.id));
}

/* empezar la batalla contra un enemigo concreto */
function startStoryBattle(id) {
  const e = storyEnemies().find(x => x.id === id);
  if (!e) return;
  activeStoryEnemy = e;
  startGame();
}

function renderStoryScreen() {
  const cap = (typeof HISTORIA !== 'undefined' && HISTORIA.capitulo1) ? HISTORIA.capitulo1 : null;
  const list = document.getElementById('story-list');
  if (!cap || !list) return;

  /* el título va PINTADO en el marco; aquí la pastilla con el nº de
     capítulo y, debajo, el lema en la placa de pergamino */
  const chapEl = document.getElementById('story-chapter');
  if (chapEl) chapEl.textContent = cap.numero || '';
  const lemaEl = document.getElementById('story-lema');
  if (lemaEl) lemaEl.textContent = cap.lema;

  const enemies = cap.enemigos;
  const curIdx = storyCurrentIndex();
  list.innerHTML = '';

  enemies.forEach((e, i) => {
    const defeated = Save.story.defeated.includes(e.id);
    /* en modo test todos cuentan como «actual»: revelados y luchables */
    const isCurrent = i === curIdx || (STORY_TEST_MODE && !defeated);
    const known = defeated || isCurrent;           // solo el actual y los vencidos se conocen
    const revealed = storyIsRevealed(e.id);

    const tile = document.createElement('div');
    tile.className = 'story-enemy' + (defeated ? ' beaten' : isCurrent ? ' current' : ' locked-enemy');
    tile.dataset.idx = i;

    /* retrato dentro del recuadro recortado del plato; ??? si no lo conocemos */
    const portrait = known
      ? (e.foto
          ? `<img src="${e.foto}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'se-emoji',textContent:'${e.emoji}'}))">`
          : `<span class="se-emoji">${e.emoji}</span>`)
      : `<span class="se-emoji">❓</span>`;
    const name = known ? e.nombre : '??? Paciente sin identificar';
    const reto = known ? e.reto : 'Vence al paciente anterior para descubrir quién es el siguiente en ingresar...';
    const bossTag = (known && e.jefe) ? '<span class="se-boss">BOSS FINAL</span>' : '';

    /* botón de acción sobre el recuadro verde (espadas) del plato */
    let fightBtn = '';
    let stamp = '';
    if (defeated) {
      fightBtn = `<button class="se-fight rematch" data-fight="${e.id}" title="Repetir el combate"><span class="se-fl">REPETIR</span></button>`;
      stamp = '<div class="se-stamp">DERROTADO</div>';
    } else if (isCurrent) {
      fightBtn = `<button class="se-fight active" data-fight="${e.id}" title="¡Obligar a ingresar!"><span class="se-fl">LUCHAR</span></button>`;
    }

    tile.innerHTML = `
      <div class="se-flip">
        <div class="se-face se-front">
          <div class="se-portrait">${portrait}</div>
          <div class="se-info">
            <div class="se-name">${name} ${bossTag}</div>
            <div class="se-reto">${reto}</div>
          </div>
          ${fightBtn}
          ${stamp}
        </div>
        <div class="se-face se-back">
          <span class="se-qmark">❓</span>
          <span class="se-num">Paciente nº ${i + 1}</span>
        </div>
      </div>`;

    /* enemigos aún no revelados: la ficha se ve por el dorso (misterio) */
    if (!revealed) tile.querySelector('.se-flip').classList.add('flipped');

    list.appendChild(tile);
  });

  /* botones de luchar / repetir */
  list.querySelectorAll('.se-fight').forEach(b =>
    b.addEventListener('click', () => startStoryBattle(b.dataset.fight)));

  /* si el enemigo ACTUAL aún no se ha revelado: animación «girar y mostrar» */
  if (curIdx >= 0 && !storyIsRevealed(enemies[curIdx].id)) {
    const cur = enemies[curIdx];
    const tile = list.querySelector(`.story-enemy[data-idx="${curIdx}"]`);
    const flip = tile.querySelector('.se-flip');
    tile.classList.add('revealing');
    if (typeof Sfx !== 'undefined') Sfx.play('draw');
    setTimeout(() => {
      flip.classList.remove('flipped');   // gira a la cara frontal
      if (typeof Sfx !== 'undefined') Sfx.play('win');
      if (typeof vfxBurst === 'function') {
        const r = tile.getBoundingClientRect();
        vfxBurst(r.left + r.width / 2, r.top + r.height / 2, ['✨', '⭐', '💫'], 12, { dist: 90 });
      }
      Save.story.revealed.push(cur.id);
      persistSave();
      setTimeout(() => tile.classList.remove('revealing'), 800);
    }, 650);
  }

  if (typeof fitOverlays === 'function') fitOverlays();
}

function renderShop() {
  document.getElementById('shop-coins').textContent = Save.coins;

  /* los MAZOS de los pacientes no se compran: se desbloquean en la
     historia. En la tienda solo se venden EXPANSIONES; los mazos
     bloqueados se agrupan en una única ficha misteriosa. */
  const storySets = storyUnlockSets();
  const entries = [];
  for (const item of SHOP_ITEMS) {
    if (!storySets.has(item.set)) { entries.push({ type: 'buy', item }); continue; } // expansiones: siempre
    /* mazo de historia: comprable solo si venciste a su paciente y no lo tienes */
    if (Save.ownedSets.includes(item.set)) continue;
    if (deckPurchaseUnlocked(item.set)) entries.push({ type: 'buy', item });
  }
  /* misterio: queda algún mazo de historia por desbloquear (paciente sin vencer) */
  const lockedMazos = [...storySets].some(s => !Save.ownedSets.includes(s) && !deckPurchaseUnlocked(s));
  if (lockedMazos) entries.push({ type: 'locked' });

  const pages = Math.max(1, Math.ceil(entries.length / 3));
  shopPage = Math.min(shopPage, pages - 1);
  document.getElementById('shop-pager').style.display = pages > 1 ? '' : 'none';
  document.getElementById('shop-page').textContent = `${shopPage + 1}/${pages}`;
  document.getElementById('shop-prev').disabled = shopPage === 0;
  document.getElementById('shop-next').disabled = shopPage >= pages - 1;

  const art = document.getElementById('shop-art');
  const ui = document.getElementById('shop-ui');
  art.innerHTML = '';
  ui.innerHTML = '';

  const shown = entries.slice(shopPage * 3, shopPage * 3 + 3);
  shown.forEach((entry, i) => {
    const y = SHOP_SLOT_Y[i];
    const a = document.createElement('div');
    a.style.top = y + 'px';
    const t = document.createElement('div');
    t.className = 'shop-slot-text';
    t.style.top = y + 'px';
    const b = document.createElement('button');
    b.className = 'painted-btn shop-buy';
    b.style.top = (y + 59) + 'px';

    if (entry.type === 'locked') {
      /* ficha misteriosa: no revela ni cuántos mazos ni cuáles */
      a.className = 'shop-slot-art locked';
      a.innerHTML = `<span class="slot-emoji">🔒</span>`;
      t.innerHTML = `
        <div class="ss-name">🔒 MAZOS BLOQUEADOS</div>
        <div class="ss-desc">Vence a los pacientes en el <b>Modo Historia</b> para desbloquear la <b>compra</b> de sus mazos aquí.</div>`;
      /* el botón verde pintado del fondo se deja vacío (sin precio) */
      b.classList.add('blocked');
      b.textContent = '';
      b.title = 'Se desbloquea venciendo a los pacientes en el Modo Historia';
    } else {
      const item = entry.item;
      const owned = Save.ownedSets.includes(item.set);
      const canBuy = !owned && Save.coins >= item.price;
      a.className = 'shop-slot-art' + (owned ? ' owned' : '');
      a.innerHTML = item.img
        ? `<img src="${item.img}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'slot-emoji',textContent:'${item.emoji}'}))">`
        : `<span class="slot-emoji">${item.emoji}</span>`;
      t.innerHTML = `
        <div class="ss-name">${item.name} <span class="ss-cards">· ${SETS[item.set].cards.length} cartas</span></div>
        <div class="ss-desc">${item.desc}</div>`;
      b.classList.toggle('owned', owned);
      b.disabled = owned || !canBuy;
      b.textContent = owned ? '✔ COMPRADO' : item.price;
      b.title = owned ? 'Ya tienes esta expansión'
        : canBuy ? `Comprar por ${item.price} 💊`
        : `Necesitas ${item.price} 💊 (tienes ${Save.coins})`;
      b.addEventListener('click', () => {
        if (owned || Save.coins < item.price) return;
        Save.coins -= item.price;
        Save.ownedSets.push(item.set);
        persistSave();
        Sfx.play('win');
        renderShop();
      });
    }
    art.appendChild(a);
    ui.appendChild(t);
    ui.appendChild(b);
  });
}

/* ---------- ajustes ---------- */

function renderSettings() {
  const setTog = (id, val) => {
    const b = document.getElementById(id);
    b.textContent = val ? 'SÍ' : 'NO';
    b.classList.toggle('on', val);
  };
  setTog('set-sound', Save.settings.sound);
  setTog('set-fast', Save.settings.fastAI);
  setTog('set-log', Save.settings.showLog);
  const sp = document.getElementById('settings-profile');
  if (sp) sp.textContent = Save.profile
    ? `Ficha del paciente: ${Save.profile.name} · ${Save.profile.id} (ingreso: ${Save.profile.created})`
    : '';
}

function toggleSetting(key) {
  Save.settings[key] = !Save.settings[key];
  persistSave();
  applySettings();
  renderSettings();
}

function resetSave() {
  if (!confirm('¿Borrar TODO el progreso? Perderás tus 💊, mazos comprados y tus mazos personalizados. (Tu ficha de paciente y tu ID se conservan.)')) return;
  Save.coins = 150;
  Save.ownedSets = ['sanatorio'];
  Save.customDecks = [];
  Save.activeDeckId = 'arch_sanatorio';
  Save.packsFreeLeft = 2;
  Save.packsDay = typeof todayStr === 'function' ? todayStr() : '';
  Save.cardCollection = {};
  Save.cardVariants = {};
  Save.story = { defeated: [], revealed: [] };
  Save.settings = { sound: true, fastAI: false, showLog: true };
  persistSave();
  applySettings();
  renderSettings();
  showScreen('main-menu');
}

/* ---------- recompensas de partida ---------- */

function awardCoins(winner) {
  const reward = winner === 0 ? 100 : 30;
  Save.coins += reward;
  persistSave();
  return reward;
}
