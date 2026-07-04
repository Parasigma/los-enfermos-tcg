'use strict';
/* =========================================================
   MODO HISTORIA — GUION DE LAS PARTIDAS DE 1 JUGADOR
   =========================================================

   ✍️ AQUÍ SE ESCRIBE LO QUE DICEN LOS PERSONAJES.

   Cada paso del guion es una línea así:

     { quien: 'rival', espera: 1, duracion: 4, texto: 'Lo que dice' },

   - quien:    'yo' (tu héroe, bocadillo abajo-izquierda)
               'rival' (el enemigo, bocadillo arriba)
   - espera:   segundos de pausa ANTES de que aparezca el bocadillo
   - duracion: segundos que el bocadillo permanece en pantalla
   - texto:    lo que dice (admite <b>negritas</b> y <i>cursivas</i>)

   Los pasos se reproducen EN ORDEN. Cuando termina el último,
   empieza la partida: se reparten las cartas y juegas normal.
   El jugador siempre puede saltarse la intro con el botón ⏭.

   Para partidas futuras de la historia: añade más guiones aquí
   (p.ej. HISTORIA.mision2 = [...]) y ya los iremos conectando.
   ========================================================= */

const HISTORIA = {

  intro: [
    {
      quien: 'rival', espera: 1.2, duracion: 4.5,
      texto: '¿Otra vez tú, <b>Fiti</b>? Tu manicomio de juguete no puede conmigo. Lo dice el <b>TOP 1 del ranking</b>.'
    },
    {
      quien: 'yo', espera: 0.7, duracion: 4.5,
      texto: 'Nikuman... tu habitación está lista. Acolchada, tranquila, y con visita de tus cinco gatos los domingos.'
    },
    {
      quien: 'rival', espera: 0.7, duracion: 5,
      texto: 'Ni se te ocurra servir <b>yogur de piña</b> en ese antro... ¿EH? ¿POR QUÉ SONRÍES? ¡Ya me he encanado!'
    },
    {
      quien: 'yo', espera: 0.6, duracion: 3.5,
      texto: 'Celadores, preparen el ingreso. <i>Esto se resuelve con cartas.</i>'
    }
  ]

};

/* =========================================================
   MOTOR DEL MODO HISTORIA (no hace falta tocar nada de aquí)
   ========================================================= */

let introActive = false;
let introSkip = false;

/* espera que se puede interrumpir con el botón de saltar */
function introWait(ms) {
  return new Promise(res => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      if (introSkip || performance.now() - t0 >= ms) {
        clearInterval(iv);
        res();
      }
    }, 50);
  });
}

/* bocadillo de texto junto al retrato del que habla */
function showBubble(quien, texto) {
  const b = document.createElement('div');
  b.className = 'speech-bubble ' + (quien === 'rival' ? 'sb-rival' : 'sb-yo');
  const t = document.createElement('div');
  t.className = 'sb-text';
  t.innerHTML = texto;
  b.appendChild(t);
  const tail = document.createElement('div');
  tail.className = 'sb-tail';
  b.appendChild(tail);
  box9(b);
  document.getElementById('stage').appendChild(b);
  requestAnimationFrame(() => b.classList.add('show'));
  Sfx.play('draw');
  return b;
}

function hideBubble(b) {
  if (!b) return;
  b.classList.remove('show');
  b.classList.add('hide');
  setTimeout(() => b.remove(), 340);
}

/* reproduce un guion paso a paso */
async function playHistoria(pasos) {
  for (const paso of pasos) {
    if (introSkip) break;
    await introWait((paso.espera || 0.5) * 1000);
    if (introSkip) break;
    const b = showBubble(paso.quien, paso.texto);
    await introWait((paso.duracion || 4) * 1000);
    hideBubble(b);
    await introWait(300);
  }
  /* limpieza por si se saltó con bocadillos en pantalla */
  document.querySelectorAll('.speech-bubble').forEach(b => b.remove());
}

/* fundido de entrada suave al cargar la partida */
function fadeInGame() {
  const f = document.getElementById('fade-layer');
  if (!f) return;
  f.style.transition = 'none';
  f.style.opacity = '1';
  void f.offsetWidth;
  f.style.transition = 'opacity 1.5s ease';
  f.style.opacity = '0';
}

/* intro completa: fundido + diálogos + reparto de cartas */
async function runIntro() {
  introActive = true;
  introSkip = false;
  busy = true;
  render();
  fadeInGame();
  const skipBtn = document.getElementById('intro-skip');
  skipBtn.classList.remove('hidden');
  await introWait(1100);
  await playHistoria(HISTORIA.intro);
  skipBtn.classList.add('hidden');
  introActive = false;
  busy = false;
  /* reparto animado: tus cartas salen del mazo (abajo-dcha) y se
     giran una a una, en orden, como en Hearthstone */
  if (G) {
    for (const c of G.players[0].hand) hiddenDraws.add(c.uid);
  }
  render();
  if (G) {
    for (const c of G.players[0].hand) queueDrawFlight(c.uid, 0);
  }
  banner('¡Tu turno! ' + (currentHero() === 'kevin' ? '🦨' : currentHero() === 'marioHero' ? '🎭' : '🏥'));
}
