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

const HISTORIA = {};

/* =========================================================
   CAPÍTULO 1 — «INGRESO EN EL MANICOMIO»
   ---------------------------------------------------------
   Rafael recorre la ciudad OBLIGANDO, uno a uno, a los
   enfermos del grupo a ingresar en el Sanatorio San José.

   Cada enemigo se enfrenta EN ORDEN. Al vencerlo:
   - queda marcado como DERROTADO
   - si tiene `desbloquea`, ese mazo se añade a tu colección
   - se revela el SIGUIENTE enemigo (hasta entonces es un ???)

   Campos de cada enemigo:
   - id:        identificador interno (no repetir)
   - nombre:    se muestra al revelarlo / derrotarlo
   - hero:      id del héroe rival (de HEROES en cards.js)
   - deck:      id del mazo que juega (de DECKS en cards.js)
   - desbloquea:id del set que te llevas al vencerlo (o null)
   - emoji:     icono de reserva si no hay ilustración
   - foto:      ilustración del retrato (opcional)
   - jefe:      true en el boss final del capítulo
   - reto:      frase corta en la ficha del enemigo
   - intro:     diálogo antes de la partida (mismo formato de
                siempre: {quien:'yo'|'rival', espera, duracion, texto}).
                Opcional en cada línea: audio: 'nombre' para locutar la
                frase (el fichero va en assets/sounds/historia/nombre.m4a).
   - victoria:  texto que aparece al ganarle
   ========================================================= */

HISTORIA.capitulo1 = {
  id: 'ingreso',
  numero: 'CAPÍTULO 1',
  nombre: 'Ingreso en el Manicomio',
  lema: 'Rafael sale a la calle a meter a los enfermos, uno a uno, en el sanatorio.',
  enemigos: [
    {
      id: 'nikuman', nombre: 'Nikuman «La Mano Negra»',
      hero: 'nikuman', deck: 'manonegra', desbloquea: 'manonegra',
      emoji: '🤓', foto: 'assets/ilustraciones/nikuman.png',
      reto: 'El pullador del TOP 1. Ojo con el yogur de piña.',
      intro: [
        { quien: 'rival', espera: 1.2, duracion: 4.5, texto: '¿Otra vez tú, <b>Fiti</b>? Tu manicomio de juguete no puede conmigo. Lo dice el <b>TOP 1 del ranking</b>.' },
        { quien: 'yo', espera: 0.7, duracion: 4.5, audio: 'fiti1', texto: 'Nikuman... tu habitación está lista. Acolchada, tranquila, y con visita de tus cinco gatos los domingos.' },
        { quien: 'rival', espera: 0.7, duracion: 5, texto: 'Ni se te ocurra servir <b>yogur de piña</b> en ese antro... ¿EH? ¿POR QUÉ SONRÍES? ¡Ya me he encanado!' },
        { quien: 'yo', espera: 0.6, duracion: 3.5, audio:'fiti2', texto: 'Celadores, preparen el ingreso. <i>Esto se resuelve con cartas.</i>' }
      ],
      victoria: 'El Director firma el ingreso de Nikuman. Un paciente nuevo... y sus 5 gatos de visita los domingos.'
    },
    {
      id: 'kevin', nombre: 'Kevin «El Mofeta»',
      hero: 'kevin', deck: 'mofeta', desbloquea: 'mofeta',
      emoji: '🦨', foto: 'assets/ilustraciones/keykebab.png',
      reto: 'Huele a mofeta con gastroenteritis. Trae mascarilla.',
      intro: [
        { quien: 'rival', espera: 1, duracion: 4.5, texto: '¿Ingresar YO? Acabo de pedir <b>tres kebabs</b>. Es un NO rotundo, cacho lacón.' },
        { quien: 'yo', espera: 0.7, duracion: 4.5, audio: 'fiti_kevin_1', texto: 'Kevin tío, que te has cagado mientras hablabas... En el manicomio pienso prohibir los pedos.' },
        { quien: 'rival', espera: 0.7, duracion: 4.5, texto: 'Te voy a soltar un <b>pedo proteico</b> que te manda al turno 10. <i>*PFFFFFF*</i>' },
        { quien: 'yo', espera: 0.6, duracion: 3.5, texto: 'Celadores, MASCARILLAS. Vamos a por él.' }
      ],
      victoria: 'Kevin entra en el sanatorio dejando una estela aromática inolvidable.'
    },
    {
      id: 'jorge', nombre: 'Jorge Monzo «El Impresor»',
      hero: 'jorgeHero', deck: 'monzo', desbloquea: 'monzo',
      emoji: '🖨️', foto: 'assets/ilustraciones/monzo.png',
      reto: 'Calvo, pedorro y con una impresora 3D que no para.',
      intro: [
        { quien: 'rival', espera: 1, duracion: 4.5, texto: 'Monzo presente. Mis cuescos ya han hecho saltar <b>tres alarmas de incendios</b>.' },
        { quien: 'yo', espera: 0.7, duracion: 4, texto: 'Por eso mismo tengo lista una sala insonorizada para ti, Jorge.' }
      ],
      victoria: 'Jorge Monzo ingresa. La sala insonorizada ya vibra por dentro.'
    },
    {
      id: 'victor', nombre: 'Víctor Lamas «El Motero»',
      hero: 'victorHero', deck: 'manonegra', desbloquea: null,
      emoji: '🏍️', foto: 'assets/ilustraciones/victor.png',
      reto: 'Calvo, escurridizo y con la moto siempre en marcha.',
      intro: [
        { quien: 'rival', espera: 1, duracion: 4.5, texto: '¿Encerrarme? Me piro en la <b>moto</b> antes de que parpadees, Fiti.' },
        { quien: 'yo', espera: 0.7, duracion: 4, texto: 'He puesto un badén en la puerta y un casco con correa. Baja de ahí, Víctor.' }
      ],
      victoria: 'Víctor pierde las llaves de la moto en recepción. Ingreso completado.'
    },
    {
      id: 'rabasco', nombre: 'Rabasco «El Cornudo»',
      hero: 'rabascoHero', deck: 'manonegra', desbloquea: null,
      emoji: '🐏', foto: 'assets/ilustraciones/rabasco.png',
      reto: 'Picadísimo y con el cuerno de la frente bien afilado.',
      intro: [
        { quien: 'rival', espera: 1, duracion: 4.5, texto: 'Estoy muy <b>picado</b>, Fiti. Y con el cuerno bien afilado. No me toques.' },
        { quien: 'yo', espera: 0.7, duracion: 4, texto: 'Un cuerno se lima en un momento. Pasa por recepción, Rabasco.' }
      ],
      victoria: 'A Rabasco le liman el cuerno en admisiones. Adentro con él.'
    },
    {
      id: 'mario', nombre: 'Mario Matas «El Cabecilla»',
      hero: 'marioHero', deck: 'fuga', desbloquea: 'fuga',
      emoji: '🎭', foto: 'assets/ilustraciones/mario.png', jefe: true,
      reto: 'BOSS FINAL. El cerebro de la fuga. El ingreso más difícil.',
      intro: [
        { quien: 'rival', espera: 1.2, duracion: 5, texto: 'Así que has llegado hasta mí. Yo organicé la <b>fuga</b>, y yo decido quién ingresa aquí.' },
        { quien: 'yo', espera: 0.7, duracion: 4.5, texto: 'Mario Matas. El cabecilla. Contigo se cierra el capítulo del ingreso.' },
        { quien: 'rival', espera: 0.7, duracion: 4.5, texto: '¿Capítulo? Esto es una <b>FUGA</b> en marcha: trapicheo, movilidad y puro caos.' },
        { quien: 'yo', espera: 0.6, duracion: 3.5, texto: 'Traed la camisa de fuerza grande. Esta la firmo yo mismo.' }
      ],
      victoria: 'Mario Matas, el cabecilla, cae. El capítulo «Ingreso en el Manicomio» queda cerrado.'
    }
  ]
};

/* enemigo que se va a enfrentar ahora mismo (lo fija el mapa de historia) */
let activeStoryEnemy = null;

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

/* locución de los personajes: reproduce el audio de una línea del guion
   (assets/sounds/historia/<nombre>.m4a). Respeta el ajuste de sonido. */
let currentVoice = null;
const VOICE_GAIN = 3.4;   // amplifica la voz muy por encima del 100% (ajustable)
function stopVoice() {
  if (typeof Music !== 'undefined') Music.duck(false);       // restaura la música
  if (currentVoice) { try { currentVoice.pause(); } catch (e) {} currentVoice = null; }
}
function playVoice(name) {
  stopVoice();
  if (typeof Save !== 'undefined' && Save.settings && !Save.settings.sound) return;
  try {
    const file = name.includes('.') ? name : name + '.m4a';
    const a = new Audio('assets/sounds/historia/' + file);
    a.volume = 1;
    currentVoice = a;
    /* sube MUCHO el volumen de la voz con WebAudio: ganancia + limitador
       (el limitador evita que sature/distorsione al amplificar tanto) */
    try {
      const ctx = (typeof Sfx !== 'undefined') ? Sfx.ctx : null;
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx && ctx.state === 'running') {
        const src = ctx.createMediaElementSource(a);
        const g = ctx.createGain(); g.gain.value = VOICE_GAIN;
        const lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -3; lim.knee.value = 3; lim.ratio.value = 20;
        lim.attack.value = 0.003; lim.release.value = 0.1;
        src.connect(g); g.connect(lim); lim.connect(ctx.destination);
      }
    } catch (e) {}
    a.play().catch(() => {});
    if (typeof Music !== 'undefined') Music.duck(true);        // baja la música mientras habla
  } catch (e) {}
}

/* espera a que la locución termine, para que el bocadillo dure lo que la
   voz. Si el fichero falla/no carga, espera al menos minMs (la 'duracion'
   del guion). Se corta con el botón de saltar o un tope de seguridad. */
function waitVoiceEnd(minMs, maxMs) {
  return new Promise(res => {
    const a = currentVoice;
    if (!a) return res();
    let done = false, failed = false;
    const t0 = performance.now();
    const finish = () => { if (done) return; done = true; clearInterval(iv); res(); };
    a.addEventListener('ended', finish, { once: true });
    a.addEventListener('error', () => { failed = true; }, { once: true });
    const iv = setInterval(() => {
      const el = performance.now() - t0;
      if (introSkip || a.ended || el >= maxMs) return finish();
      if (failed && el >= minMs) return finish();
    }, 80);
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
    stopVoice();
    const b = showBubble(paso.quien, paso.texto);
    if (paso.audio) playVoice(paso.audio);
    /* con locución, el bocadillo dura lo que dure la voz; si no (o con el
       sonido apagado), la 'duracion' fijada a mano en el guion */
    if (paso.audio && currentVoice) {
      await waitVoiceEnd((paso.duracion || 4) * 1000, 30000);
      if (!introSkip) await introWait(400);
    } else {
      await introWait((paso.duracion || 4) * 1000);
    }
    hideBubble(b);
    await introWait(300);
  }
  /* limpieza por si se saltó con bocadillos en pantalla */
  stopVoice();
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
async function runIntro(pasos) {
  introActive = true;
  introSkip = false;
  busy = true;
  render();
  fadeInGame();
  const skipBtn = document.getElementById('intro-skip');
  skipBtn.classList.remove('hidden');
  await introWait(1100);
  await playHistoria(pasos || []);
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
