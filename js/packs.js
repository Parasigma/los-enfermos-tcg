'use strict';
/* =========================================================
   SISTEMA DE SOBRES
   ---------------------------------------------------------
   - 2 sobres GRATIS al día (se reinician con la fecha) o
     sobres extra por 1000 💊.
   - Cada sobre: 5 cartas al azar de TODO el juego (repetidas
     o totalmente nuevas), con garantía de al menos una rara+.
   - Versiones especiales MUY raras por carta:
     ✨ brillante · 🏆 dorada · 🌀 alterada · 🌈 foil
   - Apertura: se corta el precinto arrastrando de lado a lado
     y las 5 cartas salen boca abajo para irlas girando.
   ========================================================= */

const PACK_PRICE = 1000;
const PACK_SIZE = 5;

/* MODO PRUEBA: sobres gratis ILIMITADOS para testear.
   En true solo para desarrollo; en el juego real va en false:
   2 sobres gratis al día y los demás a PACK_PRICE 💊. */
const PACKS_TEST_MODE = true;

/* probabilidad de rareza por hueco del sobre (en %) */
const PACK_RARITY_ODDS = [
  ['común', 68],
  ['rara', 20],
  ['épica', 9],
  ['legendaria', 3]
];

/* GRADOS especiales de carta, de MÁS raro a menos (en % por carta).
   Jerarquía: normal < foil < alterada < dorada < DIAMOND (el más raro). */
/* En modo test las DIAMOND salen muchísimo (60%) para poder probarlas;
   con PACKS_TEST_MODE = false vuelven a su rareza real (0.15%). */
const VARIANT_ODDS = [
  ['diamond', PACKS_TEST_MODE ? 60 : 0.15],
  ['dorada', 0.8],
  ['alterada', 2.0],
  ['foil', 4.0]
];

const VARIANT_INFO = {
  brillante: { rank: 1, label: '✨ BRILLANTE' },   // legado: ya no se reparte
  foil:      { rank: 2, label: '🌈 FOIL' },
  alterada:  { rank: 3, label: '🌀 ALTERADA' },
  dorada:    { rank: 4, label: '🏆 DORADA' },
  diamond:   { rank: 5, label: '💎 DIAMANTE' }
};

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/* mejor versión especial que posees de una carta (para pintarla) */
function cardVariant(id) {
  return (Save.cardVariants && Save.cardVariants[id]) || null;
}

/* ---------- generación del sobre ---------- */

function packPoolByRarity() {
  const pool = {};
  for (const key of Object.keys(SETS)) {
    for (const id of SETS[key].cards) {
      const r = CARDS[id].rarity;
      (pool[r] = pool[r] || []).push(id);
    }
  }
  return pool;
}

function rollRarity(odds) {
  let roll = Math.random() * 100;
  for (const [rarity, pct] of odds) {
    if (roll < pct) return rarity;
    roll -= pct;
  }
  return odds[0][0];
}

function rollVariant() {
  let roll = Math.random() * 100;
  for (const [variant, pct] of VARIANT_ODDS) {
    if (roll < pct) return variant;
    roll -= pct;
  }
  return null;
}

function generatePack() {
  const pool = packPoolByRarity();
  const pick = rarity => {
    const list = pool[rarity] && pool[rarity].length ? pool[rarity] : pool['común'];
    return list[Math.floor(Math.random() * list.length)];
  };
  const cards = [];
  for (let i = 0; i < PACK_SIZE; i++) {
    cards.push({ id: pick(rollRarity(PACK_RARITY_ODDS)), variant: rollVariant() });
  }
  /* garantía: al menos una rara o mejor */
  if (cards.every(c => CARDS[c.id].rarity === 'común')) {
    cards[PACK_SIZE - 1].id = pick(rollRarity([['rara', 70], ['épica', 25], ['legendaria', 5]]));
  }
  /* marca las totalmente nuevas ANTES de añadirlas a la colección */
  for (const c of cards) {
    c.isNew = !setOwnedCard(c.id) && !((Save.cardCollection && Save.cardCollection[c.id]) > 0);
  }
  return cards;
}

function applyPack(cards) {
  Save.cardCollection = Save.cardCollection || {};
  Save.cardVariants = Save.cardVariants || {};
  for (const c of cards) {
    Save.cardCollection[c.id] = (Save.cardCollection[c.id] || 0) + 1;
    if (c.variant) {
      const prev = Save.cardVariants[c.id];
      if (!prev || VARIANT_INFO[c.variant].rank > VARIANT_INFO[prev].rank) {
        Save.cardVariants[c.id] = c.variant;
      }
    }
  }
  persistSave();
}

/* ---------- pantalla de sobres ---------- */

let packCards = null;
let packRevealed = 0;
let cutState = null;

/* cambia entre las pestañas de la tienda: mazos ↔ sobres */
function shopShowTab(tab) {
  const packs = tab === 'packs';
  document.getElementById('tab-decks').classList.toggle('active', !packs);
  document.getElementById('tab-packs').classList.toggle('active', packs);
  document.getElementById('shop-packs-panel').classList.toggle('hidden', !packs);
  document.getElementById('shop-art').style.display = packs ? 'none' : '';
  document.getElementById('shop-ui').style.display = packs ? 'none' : '';
  document.getElementById('shop-pager').style.visibility = packs ? 'hidden' : '';
  if (packs) renderPacksScreen();
}

function renderPacksScreen() {
  packCards = null;
  packRevealed = 0;
  cutState = null;
  const panel = document.getElementById('shop-packs-panel');
  panel.classList.remove('cutting');
  const area = document.getElementById('pack-area');
  area.innerHTML = '';

  const canFree = PACKS_TEST_MODE || Save.packsFreeLeft > 0;
  const canPaid = Save.coins >= PACK_PRICE;
  const info = document.getElementById('pack-info');
  info.textContent = PACKS_TEST_MODE
    ? '🧪 MODO PRUEBA: sobres ilimitados. Toca el sobre para abrirlo.'
    : canFree
      ? `Te quedan ${Save.packsFreeLeft} sobres GRATIS hoy. Toca el sobre para abrirlo.`
      : canPaid
        ? `Sin sobres gratis hoy: abrir otro cuesta ${PACK_PRICE} 💊 (tienes ${Save.coins}). Toca el sobre.`
        : `Sin sobres gratis y sin pastillas (necesitas ${PACK_PRICE} 💊). ¡Vuelve mañana!`;

  /* el sobre flotando: rebaba arriba + cuerpo (misma imagen, partida) */
  const pack = document.createElement('div');
  pack.className = 'pack2' + (!canFree && !canPaid ? ' dimmed' : '');
  pack.innerHTML = `
    <div class="sobre-body"></div>
    <div class="sobre-strip"></div>`;
  area.appendChild(pack);
  if (canFree || canPaid) {
    pack.addEventListener('click', () => startCutStage(pack, canFree), { once: true });
  }
}

/* ---------- compra + zoom + corte ---------- */

function startCutStage(pack, free) {
  if (packCards !== null) return;

  /* la "compra" (aunque sea el gratis) ocurre al tocar el sobre */
  if (free) {
    if (!PACKS_TEST_MODE) { Save.packsFreeLeft--; persistSave(); }
  } else {
    if (Save.coins < PACK_PRICE) return;
    Save.coins -= PACK_PRICE;
    persistSave();
    const sc = document.getElementById('shop-coins');
    if (sc) sc.textContent = Save.coins;
  }
  /* el contenido se genera y se guarda YA: lo comprado es tuyo
     aunque cierres a mitad del corte */
  packCards = generatePack();
  applyPack(packCards);
  Sfx.play('draw');

  /* el sobre se acerca a la cámara y los textos se van */
  document.getElementById('shop-packs-panel').classList.add('cutting');
  pack.classList.add('zoomed');

  /* al terminar el zoom aparece la línea de corte brillante */
  setTimeout(() => {
    const glow = document.createElement('div');
    glow.className = 'cut-glow';
    const done = document.createElement('div');
    done.className = 'cut-done';
    pack.appendChild(glow);
    pack.appendChild(done);
    wireCut2(pack, done);
  }, 520);
}

function wireCut2(pack, doneEl) {
  let progress = 0;
  let cutting = false;
  let lastSpark = 0;

  const finish = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    pack.removeEventListener('pointerdown', onDown);
    tearOff(pack);
  };

  const update = e => {
    const r = pack.getBoundingClientRect();
    const p = Math.min(1, Math.max(progress, (e.clientX - r.left) / r.width));
    if (p > progress) {
      progress = p;
      doneEl.style.width = (progress * 100) + '%';
      /* chispas siguiendo el corte */
      const now = performance.now();
      if (now - lastSpark > 70) {
        lastSpark = now;
        vfxParticle(e.clientX, r.top + r.height * 0.091, '✨', {
          dx: (Math.random() - 0.5) * 18,
          dy: -(10 + Math.random() * 22),
          dur: 0.4, size: 15
        });
      }
      if (progress >= 0.93) finish();
    }
  };

  const onDown = e => { e.preventDefault(); cutting = true; update(e); };
  const onMove = e => { if (cutting) update(e); };
  const onUp = () => { cutting = false; };

  pack.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

/* la rebaba se separa y el sobre revienta en luz */
function tearOff(pack) {
  pack.querySelectorAll('.cut-glow, .cut-done').forEach(x => x.remove());
  pack.querySelector('.sobre-strip').classList.add('torn');
  Sfx.play('attack');
  const r = pack.getBoundingClientRect();
  setTimeout(() => {
    vfxBurst(r.left + r.width / 2, r.top + r.height / 4, ['✨', '💥'], 10, { dist: 90 });
    vfxFlash('rgba(255, 220, 120, .3)');
    Sfx.play('magic');
    setTimeout(() => showPackReveal(), 420);
  }, 360);
}

function showPackReveal() {
  /* blindaje: si algo re-renderizó la pantalla entre medias, no revientes */
  if (!Array.isArray(packCards) || !packCards.length) return;
  const area = document.getElementById('pack-area');
  area.innerHTML = '';
  packRevealed = 0;
  document.getElementById('shop-packs-panel').classList.remove('cutting');
  document.getElementById('pack-info').textContent =
    'Haz clic en cada carta para girarla...';

  const row = document.createElement('div');
  row.className = 'pack-reveal';
  area.appendChild(row);

  packCards.forEach((c, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'pack-card';
    wrap.style.setProperty('--i', i);
    const fake = { def: CARDS[c.id], id: c.id, costMod: 0, uid: 'pack_' + i };
    const face = cardEl(fake);
    face.classList.remove('hand-card');
    /* fuerza la versión especial que ha salido en ESTE sobre */
    face.classList.remove('v-brillante', 'v-dorada', 'v-alterada', 'v-foil', 'v-diamond');
    if (c.variant) face.classList.add('v-' + c.variant);
    /* las DORADAS/DIAMANTE asoman ya con su reverso especial: pura tentación */
    const backCls = c.variant === 'dorada' ? ' gold' : c.variant === 'diamond' ? ' diamond' : '';
    wrap.innerHTML = `
      <div class="flip3d">
        <div class="flip-inner">
          <div class="flip-back card-reverse${backCls}"></div>
          <div class="flip-front"></div>
        </div>
      </div>
      <div class="pack-tag"></div>`;
    wrap.querySelector('.flip-front').appendChild(face);

    /* pulsación larga (móvil): inspecciona si ya está girada */
    addLongPress(wrap, () => {
      if (wrap.querySelector('.flip-inner').classList.contains('flipped')) {
        openCardInspector(fake, c.variant || null);
      }
    });
    wrap.addEventListener('click', () => {
      if (wrap.__lpFired) { wrap.__lpFired = false; return; }
      const inner = wrap.querySelector('.flip-inner');
      /* ya girada: clic para disfrutarla en grande (con SU versión) */
      if (inner.classList.contains('flipped')) {
        openCardInspector(fake, c.variant || null);
        return;
      }
      inner.classList.add('flipped');
      packRevealed++;
      revealFx(wrap, c);
      if (packRevealed >= packCards.length) {
        setTimeout(() => {
          document.getElementById('pack-info').textContent = '¡Cartas añadidas a tu colección!';
          const done = document.createElement('button');
          done.className = 'img-btn';
          done.textContent = '✔️ Continuar';
          done.addEventListener('click', renderPacksScreen);
          area.appendChild(done);
        }, 600);
      }
    });
    row.appendChild(wrap);
    wrap.addEventListener('mouseenter', () => {
      if (wrap.querySelector('.flip-inner').classList.contains('flipped')) showPreviewCard(fake);
    });
    wrap.addEventListener('mouseleave', hidePreview);
  });
}

/* efectos al girar cada carta según su rareza y versión */
function revealFx(wrap, c) {
  const r = wrap.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const rarity = CARDS[c.id].rarity;
  const tag = wrap.querySelector('.pack-tag');

  const bits = [];
  if (c.isNew) bits.push('<span class="tag-new">¡NUEVA!</span>');
  if (c.variant) bits.push(`<span class="tag-variant tv-${c.variant}">${VARIANT_INFO[c.variant].label}</span>`);
  tag.innerHTML = bits.join(' ');

  if (c.variant === 'diamond') {
    vfxBurst(x, y, ['💎', '✨', '💫', '🌈'], 18, { dist: 120 });
    vfxRise(x, y, ['💎', '✨'], 10);
    vfxFlash('rgba(150, 225, 255, .4)');
    if (typeof VFX !== 'undefined') { VFX.magic(x, y, VFX.COL.white, { big: true }); VFX.magic(x, y, '150,225,255', { big: true }); }
    Sfx.play('win');
  } else if (c.variant === 'foil') {
    vfxBurst(x, y, ['🌈', '✨', '💫'], 14, { dist: 100 });
    vfxFlash('rgba(180, 120, 255, .35)');
    Sfx.play('win');
  } else if (c.variant === 'alterada') {
    vfxBurst(x, y, ['🌀', '✨'], 10, { dist: 80 });
    Sfx.play('magic');
  } else if (c.variant === 'dorada') {
    vfxRise(x, y, ['🏆', '✨'], 9);
    Sfx.play('win');
  } else if (c.variant === 'brillante') {
    vfxRise(x, y, ['✨'], 7);
    Sfx.play('magic');
  } else if (rarity === 'legendaria') {
    vfxBurst(x, y, ['⭐', '✨'], 12, { dist: 90 });
    vfxFlash('rgba(255, 180, 40, .3)');
    Sfx.play('win');
  } else if (rarity === 'épica' || rarity === 'rara') {
    vfxRise(x, y, ['✨'], 6);
    Sfx.play('magic');
  } else {
    Sfx.play('play');
  }
}
