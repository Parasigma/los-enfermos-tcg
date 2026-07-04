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
  coins: 150,
  ownedSets: ['sanatorio'],
  customDecks: [],              // [{id, name, hero, cards[], archetype:false}]
  activeDeckId: 'arch_sanatorio',
  /* sobres: cartas sueltas conseguidas y versiones especiales */
  packsFreeLeft: 2,
  packsDay: '',
  cardCollection: {},           // { cardId: copias conseguidas en sobres }
  cardVariants: {},             // { cardId: 'brillante'|'dorada'|'alterada'|'foil' }
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
      if (typeof s.coins === 'number') Save.coins = s.coins;
      if (Array.isArray(s.ownedSets)) Save.ownedSets = s.ownedSets;
      if (Array.isArray(s.customDecks)) Save.customDecks = s.customDecks;
      if (typeof s.activeDeckId === 'string') Save.activeDeckId = s.activeDeckId;
      if (typeof s.packsFreeLeft === 'number') Save.packsFreeLeft = s.packsFreeLeft;
      if (typeof s.packsDay === 'string') Save.packsDay = s.packsDay;
      if (s.cardCollection && typeof s.cardCollection === 'object') Save.cardCollection = s.cardCollection;
      if (s.cardVariants && typeof s.cardVariants === 'object') Save.cardVariants = s.cardVariants;
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

const SCREENS = ['main-menu', 'deck-screen', 'shop-screen', 'settings-screen', 'online-screen', 'end-overlay'];

function showScreen(id) {
  for (const s of SCREENS) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  }
  if (id === 'main-menu') document.getElementById('menu-coins').textContent = Save.coins;
  if (id === 'shop-screen') {
    renderShop();
    if (typeof shopShowTab === 'function') shopShowTab('decks');
  }
  if (id === 'deck-screen') openDeckEditor();
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

  /* cartas de barajas NO compradas (y no conseguidas en sobres):
     boca abajo, giran con el ratón */
  const owned = new Set(collectionIds());
  const locked = [];
  for (const key of Object.keys(SETS)) {
    if (!Save.ownedSets.includes(key)) {
      for (const id of SETS[key].cards) {
        if (!owned.has(id)) locked.push({ id, set: key });
      }
    }
  }
  locked.sort((a, b) =>
    (CARDS[a.id].cost - CARDS[b.id].cost) || CARDS[a.id].name.localeCompare(CARDS[b.id].name));
  for (const { id, set } of locked) {
    const wrap = document.createElement('div');
    wrap.className = 'col-card locked';
    wrap.title = `Carta de «${SETS[set].name}» — cómprala en la tienda`;
    const fake = { def: CARDS[id], id, costMod: 0, uid: 'lock_' + id };
    const face = cardEl(fake);
    face.classList.remove('hand-card');
    wrap.innerHTML = `
      <div class="flip3d">
        <div class="flip-inner">
          <div class="flip-back card-reverse"></div>
          <div class="flip-front"></div>
        </div>
      </div>
      <div class="col-count">🔒 ${SETS[set].name}</div>`;
    wrap.querySelector('.flip-front').appendChild(face);
    /* clic: a la tienda · doble clic o pulsación larga: inspeccionar */
    let lockTimer = null;
    wrap.addEventListener('click', () => {
      if (wrap.__lpFired) { wrap.__lpFired = false; return; }
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; return; }
      lockTimer = setTimeout(() => {
        lockTimer = null;
        hidePreview();
        showScreen('shop-screen');
      }, 230);
    });
    wrap.addEventListener('dblclick', () => {
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
      openCardInspector(fake);
    });
    addLongPress(wrap, () => openCardInspector(fake));
    wrap.addEventListener('mouseenter', () => showPreviewCard(fake));
    wrap.addEventListener('mouseleave', hidePreview);
    col.appendChild(wrap);
  }

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

function renderShop() {
  document.getElementById('shop-coins').textContent = Save.coins;

  const pages = Math.max(1, Math.ceil(SHOP_ITEMS.length / 3));
  shopPage = Math.min(shopPage, pages - 1);
  document.getElementById('shop-pager').style.display = pages > 1 ? '' : 'none';
  document.getElementById('shop-page').textContent = `${shopPage + 1}/${pages}`;
  document.getElementById('shop-prev').disabled = shopPage === 0;
  document.getElementById('shop-next').disabled = shopPage >= pages - 1;

  const art = document.getElementById('shop-art');
  const ui = document.getElementById('shop-ui');
  art.innerHTML = '';
  ui.innerHTML = '';

  const items = SHOP_ITEMS.slice(shopPage * 3, shopPage * 3 + 3);
  items.forEach((item, i) => {
    const y = SHOP_SLOT_Y[i];
    const owned = Save.ownedSets.includes(item.set);
    const canBuy = !owned && Save.coins >= item.price;

    const a = document.createElement('div');
    a.className = 'shop-slot-art' + (owned ? ' owned' : '');
    a.style.top = y + 'px';
    a.innerHTML = item.img
      ? `<img src="${item.img}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'slot-emoji',textContent:'${item.emoji}'}))">`
      : `<span class="slot-emoji">${item.emoji}</span>`;
    art.appendChild(a);

    const t = document.createElement('div');
    t.className = 'shop-slot-text';
    t.style.top = y + 'px';
    t.innerHTML = `
      <div class="ss-name">${item.name} <span class="ss-cards">· ${SETS[item.set].cards.length} cartas</span></div>
      <div class="ss-desc">${item.desc}</div>`;
    ui.appendChild(t);

    const b = document.createElement('button');
    b.className = 'painted-btn shop-buy' + (owned ? ' owned' : '');
    b.style.top = (y + 59) + 'px';
    b.disabled = owned || !canBuy;
    b.textContent = owned ? '✔ COMPRADO' : item.price;
    b.title = owned ? 'Ya tienes esta baraja'
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
}

function toggleSetting(key) {
  Save.settings[key] = !Save.settings[key];
  persistSave();
  applySettings();
  renderSettings();
}

function resetSave() {
  if (!confirm('¿Borrar TODO el progreso? Perderás tus 💊, mazos comprados y tus mazos personalizados.')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  Save.coins = 150;
  Save.ownedSets = ['sanatorio'];
  Save.customDecks = [];
  Save.activeDeckId = 'arch_sanatorio';
  Save.packsFreeLeft = 2;
  Save.packsDay = typeof todayStr === 'function' ? todayStr() : '';
  Save.cardCollection = {};
  Save.cardVariants = {};
  Save.settings = { sound: true, fastAI: false, showLog: true };
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
