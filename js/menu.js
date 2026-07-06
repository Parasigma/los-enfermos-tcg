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
  settings: { sound: true, fastAI: false, showLog: true }
};

/* héroes jugables: se desbloquean comprando su set */
const PLAYABLE_HEROES = [
  { id: 'director', set: 'sanatorio' },
  { id: 'kevin', set: 'mofeta' },
  { id: 'marioHero', set: 'fuga' }
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
   las de sobres, tantas como hayas conseguido (hasta el máximo) */
function availableCopies(id) {
  if (setOwnedCard(id)) return maxCopies(id);
  return Math.min(maxCopies(id), (Save.cardCollection && Save.cardCollection[id]) || 0);
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

/* ---------- ajustes aplicados al juego ---------- */

function applySettings() {
  Sfx.enabled = Save.settings.sound;
  AIH.delay = ms => new Promise(r => setTimeout(r, Save.settings.fastAI ? ms * 0.35 : ms));
  const logPanel = document.getElementById('log-panel');
  const logToggle = document.getElementById('log-toggle');
  if (logPanel) logPanel.style.display = Save.settings.showLog ? '' : 'none';
  if (logToggle) logToggle.style.display = Save.settings.showLog ? '' : 'none';
}

/* ---------- navegación entre pantallas ---------- */

const SCREENS = ['register-screen', 'main-menu', 'story-screen', 'deck-screen', 'shop-screen', 'settings-screen', 'online-screen', 'end-overlay'];

function showScreen(id) {
  for (const s of SCREENS) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  }
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

function storyEnemies() {
  return (typeof HISTORIA !== 'undefined' && HISTORIA.capitulo1)
    ? HISTORIA.capitulo1.enemigos : [];
}

/* sets que SOLO se consiguen jugando la historia (no en la tienda) */
function storyUnlockSets() {
  const set = new Set();
  for (const e of storyEnemies()) if (e.desbloquea) set.add(e.desbloquea);
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
  const en = storyEnemies();
  if (en.length && en[0].id === id) return true;
  return Save.story.defeated.includes(id) || Save.story.revealed.includes(id);
}

/* marcar un enemigo como derrotado y desbloquear su mazo */
function storyDefeat(id) {
  if (!Save.story.defeated.includes(id)) Save.story.defeated.push(id);
  const e = storyEnemies().find(x => x.id === id);
  if (e && e.desbloquea && !Save.ownedSets.includes(e.desbloquea)) {
    Save.ownedSets.push(e.desbloquea);
  }
  persistSave();
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
    const isCurrent = i === curIdx;
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
    if (!storySets.has(item.set)) entries.push({ type: 'buy', item });
  }
  const lockedMazos = [...storySets].some(s => !Save.ownedSets.includes(s));
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
        <div class="ss-desc">Los mazos de los pacientes no están a la venta. <b>Juega al Modo Historia</b> y véncelos para quedarte con su mazo.</div>`;
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
