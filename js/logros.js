'use strict';
/* =========================================================
   SISTEMA DE LOGROS
   ---------------------------------------------------------
   - Rangos por dificultad: bronce < plata < oro < platino <
     diamante.
   - SIEMPRE OCULTOS: solo se ven cuando se completan (la
     pantalla muestra cuántos quedan por descubrir).
   - La mayoría no dan nada; algunos medios/difíciles
     desbloquean REVERSOS, CARTAS ESPECIALES fuera del meta o
     VERSIONES especiales de cartas míticas (reward).
   - checkLogros() se llama tras cada suceso relevante
     (fin de partida, sobres, intercambios, historia).
   ========================================================= */

const LOGRO_TIERS = {
  bronce:   { name: 'Bronce',   medal: '🥉', color: '#cd7f32' },
  plata:    { name: 'Plata',    medal: '🥈', color: '#c8c8c8' },
  oro:      { name: 'Oro',      medal: '🥇', color: '#ffd257' },
  platino:  { name: 'Platino',  medal: '🏆', color: '#e5e4e2' },
  diamante: { name: 'Diamante', medal: '💎', color: '#7fd8ff' }
};

const LOGROS = [
  /* --- bronce: los primeros pasos --- */
  { id: 'primer_ingreso', tier: 'bronce', name: 'Primer ingreso',
    desc: 'Gana tu primera partida.',
    cond: () => Save.stats.wins >= 1 },
  { id: 'primer_sobre', tier: 'bronce', name: 'Huele a cartón nuevo',
    desc: 'Abre tu primer sobre.',
    cond: () => Save.counters.packsOpened >= 1 },
  { id: 'cae_nikuman', tier: 'bronce', name: 'La Mano Negra, ingresada',
    desc: 'Vence a Nikuman en el Modo Historia.',
    cond: () => Save.story.defeated.includes('nikuman') },
  { id: 'veterano', tier: 'bronce', name: 'Celador veterano',
    desc: 'Gana 10 partidas.',
    cond: () => Save.stats.wins >= 10 },

  /* --- plata --- */
  { id: 'medio_manicomio', tier: 'plata', name: 'Medio manicomio lleno',
    desc: 'Vence a 4 pacientes de la historia.',
    cond: () => Save.story.defeated.length >= 4 },
  { id: 'en_racha', tier: 'plata', name: 'Encaneo total',
    desc: 'Consigue una racha de 3 victorias seguidas.',
    cond: () => Save.stats.bestStreak >= 3 },
  { id: 'trapicheo', tier: 'plata', name: 'Trapicheo consumado',
    desc: 'Completa un intercambio de cartas con un amigo.',
    cond: () => Save.counters.trades >= 1 },
  { id: 'vicio_carton', tier: 'plata', name: 'Vicio al cartón',
    desc: 'Abre 10 sobres.',
    cond: () => Save.counters.packsOpened >= 10 },

  /* --- oro (con recompensa) --- */
  { id: 'capitulo1', tier: 'oro', name: 'El manicomio, al completo',
    desc: 'Completa el capítulo 1: ingresa a todos los pacientes.',
    cond: () => typeof storyEnemies === 'function' && storyEnemies().length > 0 &&
      storyEnemies().every(e => Save.story.defeated.includes(e.id)),
    reward: { type: 'card', id: 'trofeoManicomio' },
    rewardDesc: 'Carta especial «Trofeo del Manicomio»' },
  { id: 'diamante_sobre', tier: 'oro', name: 'Brilla en la oscuridad',
    desc: 'Saca una carta DIAMOND de un sobre.',
    cond: () => Save.counters.diamondsPulled >= 1,
    reward: { type: 'back', id: 'diamante' },
    rewardDesc: 'Reverso de carta «Diamante»' },

  /* --- platino (con recompensa) --- */
  { id: 'boss_caido', tier: 'platino', name: 'El verdadero enfermo',
    desc: 'Derrota a Mario, el Paciente Supremo.',
    cond: () => Save.story.defeated.includes('mario'),
    reward: { type: 'variant', id: 'marioSupremoCard', variant: 'dorada' },
    rewardDesc: 'Versión DORADA de «Mario, el Paciente Supremo»' },
  { id: 'top_ranking', tier: 'platino', name: 'TOP 1 del ranking',
    desc: 'Alcanza 1200 de ELO.',
    cond: () => Save.stats.elo >= 1200 },

  /* --- diamante --- */
  { id: 'leyenda', tier: 'diamante', name: 'Leyenda del manicomio',
    desc: 'Gana 50 partidas.',
    cond: () => Save.stats.wins >= 50 },
  { id: 'coleccion_total', tier: 'diamante', name: 'La colección suprema',
    desc: 'Consigue todas las cartas coleccionables del juego.',
    cond: () => Object.keys(SETS).every(k =>
      SETS[k].cards.every(id => setOwnedCard(id) || (Save.cardCollection[id] || 0) > 0)) }
];

function grantLogroReward(r) {
  if (!r) return;
  if (r.type === 'card' && CARDS[r.id]) {
    Save.cardCollection[r.id] = (Save.cardCollection[r.id] || 0) + 1;
  } else if (r.type === 'back') {
    if (!Save.cardBacksOwned.includes(r.id)) Save.cardBacksOwned.push(r.id);
  } else if (r.type === 'variant' && CARDS[r.id]) {
    const prev = Save.cardVariants[r.id];
    if (!prev || (typeof VARIANT_INFO !== 'undefined' &&
        VARIANT_INFO[r.variant] && (!VARIANT_INFO[prev] || VARIANT_INFO[r.variant].rank > VARIANT_INFO[prev].rank))) {
      Save.cardVariants[r.id] = r.variant;
    }
  }
}

/* aviso flotante al desbloquear (por encima de cualquier pantalla) */
function showLogroToast(l) {
  const t = LOGRO_TIERS[l.tier];
  const d = document.createElement('div');
  d.className = 'logro-toast';
  d.style.setProperty('--lt-color', t.color);
  d.innerHTML = `<span class="lg-medal">${t.medal}</span>
    <span class="lg-body"><b>¡LOGRO DESBLOQUEADO!</b><br>${l.name}${l.rewardDesc ? `<br><i>🎁 ${l.rewardDesc}</i>` : ''}</span>`;
  document.body.appendChild(d);
  requestAnimationFrame(() => d.classList.add('show'));
  if (typeof Sfx !== 'undefined') Sfx.play('win');
  setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 500); }, 4200);
}

function checkLogros() {
  if (typeof Save === 'undefined' || !Array.isArray(Save.logros)) return;
  const nuevos = [];
  for (const l of LOGROS) {
    if (Save.logros.includes(l.id)) continue;
    let ok = false;
    try { ok = !!l.cond(); } catch (e) {}
    if (!ok) continue;
    Save.logros.push(l.id);
    grantLogroReward(l.reward);
    nuevos.push(l);
  }
  if (nuevos.length) {
    persistSave();
    /* escalonados para que no se pisen */
    nuevos.forEach((l, i) => setTimeout(() => showLogroToast(l), i * 900));
  }
}

/* pantalla de logros: SOLO los completados; el resto, en misterio */
function renderLogros() {
  const el = document.getElementById('logros-body');
  if (!el) return;
  const hechos = LOGROS.filter(l => Save.logros.includes(l.id));
  const ocultos = LOGROS.length - hechos.length;
  el.innerHTML = `
    <p class="lore" style="margin:4px 0 12px">Completados: <b>${hechos.length}</b> de ${LOGROS.length}.
      Los logros permanecen <b>ocultos</b> hasta que los consigues.</p>
    <div class="logros-list">
      ${hechos.map(l => {
        const t = LOGRO_TIERS[l.tier];
        return `<div class="lg-row" style="--lt-color:${t.color}">
          <span class="lg-medal">${t.medal}</span>
          <span class="lg-info"><b>${l.name}</b> <span class="lg-tier">${t.name}</span><br>
            <span class="lg-desc">${l.desc}</span>
            ${l.rewardDesc ? `<br><span class="lg-reward">🎁 ${l.rewardDesc}</span>` : ''}</span>
        </div>`;
      }).join('')}
      ${ocultos > 0 ? `<div class="lg-row lg-hidden"><span class="lg-medal">🔒</span>
        <span class="lg-info"><b>${ocultos} logro${ocultos === 1 ? '' : 's'} oculto${ocultos === 1 ? '' : 's'}</b><br>
        <span class="lg-desc">Sigue jugando para descubrirlos...</span></span></div>` : ''}
    </div>`;
}
