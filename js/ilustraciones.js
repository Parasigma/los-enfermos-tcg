'use strict';
/* =========================================================
   ILUSTRACIONES DE LAS CARTAS
   ---------------------------------------------------------
   AQUÍ SE CAMBIA LA IMAGEN DE CADA CARTA.
   Deja tus imágenes en assets/ilustraciones/ y pon aquí la
   ruta. Si el archivo no existe todavía, no pasa nada: la
   carta muestra su emoji hasta que la ilustración aparezca.
   Vale .png, .jpg o .webp — solo cambia la extensión.
   ========================================================= */

const ILUSTRACIONES = {

  /* ========== EL SANATORIO SAN JOSÉ (tu baraja) ========== */
  celador:        'assets/ilustraciones/celador.png',        // Enfermero Celador
  moteNuevo:      'assets/ilustraciones/moteNuevo.png',      // Mote Nuevo
  chus:           'assets/ilustraciones/chus.png',           // Chus, el Chusti Wild
  paquito:        'assets/ilustraciones/paquito.png',        // Paquito Serna Quesada
  sePonePelo:     'assets/ilustraciones/sePonePelo.png',     // Se Pone Pelo
  camisaFuerza:   'assets/ilustraciones/camisafuerza.jpg',   // Camisa de Fuerza
  rabasco:        'assets/ilustraciones/rabasco.png',        // Rabasco, el Picado
  terapiaChoque:  'assets/ilustraciones/terapiaChoque.png',  // Terapia de Choque
  ordenIngreso:   'assets/ilustraciones/ordenIngreso.png',   // Orden de Ingreso
  montreal:       'assets/ilustraciones/montreal.jpg',       // Montreal
  victor:         'assets/ilustraciones/victor.png',         // Victor Lamas, Calvo Veloz
  monzo:          'assets/ilustraciones/monzo.png',          // Jorge Monzo, el Ventoso
  medicacion:     'assets/ilustraciones/medicacion.png',     // Medicación Doble
  furgoneta:      'assets/ilustraciones/furgoneta.png',      // La Furgoneta del Sanatorio
  brote:          'assets/ilustraciones/brote.png',          // Brote Psicótico
  mario:          'assets/ilustraciones/mario.png',          // Mario Matas, el Liante

  /* ========== LA MANO NEGRA (baraja rival) ========== */
  quejaFormal:    'assets/ilustraciones/quejaFormal.png',    // Queja Formal
  peucadorNovato: 'assets/ilustraciones/peucadorNovato.png', // Peucador Novato
  elizabeth:      'assets/ilustraciones/elizabeth.png',      // Elizabeth, la Santa
  kebab:          'assets/ilustraciones/kebab.png',          // Kebab Doble Carne
  peucada:        'assets/ilustraciones/peucada.png',        // Peucada Maestra
  mandoGamer:     'assets/ilustraciones/mandoGamer.png',     // Mando Pro Gamer
  rageQuit:       'assets/ilustraciones/rageQuit.png',       // Rage Quit
  gatoCiber:      'assets/ilustraciones/gatoCiber.png',      // Gato Cibernético
  viciada:        'assets/ilustraciones/viciada.png',        // Viciada de 14 Horas
  odioFiti:       'assets/ilustraciones/odioFiti.png',       // Odio Eterno a Fiti
  cauntu:         'assets/ilustraciones/cauntu.png',         // Cauntu, Científico Loco
  pedoAtomico:    'assets/ilustraciones/pedoAtomico.png',    // Pedo Atómico
  cincoGatos:     'assets/ilustraciones/cincoGatos.png',     // Los 5 Gatos
  kevin:          'assets/ilustraciones/kevin.png',          // Kevin, el Mofeta
  ciborg:         'assets/ilustraciones/ciborg.png',         // Ciborgización
  nikumanCard:    'assets/ilustraciones/nikuman.png',        // Nikuman, la Mano Negra
  top1:           'assets/ilustraciones/top1.png',           // Top 1 del Ranking

  /* ========== EXPANSIÓN: RECUERDOS DEL PARQUE ========== */
  litrona:        'assets/ilustraciones/litrona.png',        // Litrona del Parque
  vecinoCabreado: 'assets/ilustraciones/vecinoCabreado.png', // Vecino Cabreado
  pandilla:       'assets/ilustraciones/pandilla.png',       // La Pandilla al Completo
  cocheEmpresa:   'assets/ilustraciones/cocheEmpresa.png',   // El Coche de Empresa
  moteDefinitivo: 'assets/ilustraciones/moteDefinitivo.png', // El Mote Definitivo
  colega:         'assets/ilustraciones/colega.png',         // Colega del Parque (ficha)

  /* ========== BARAJA: EL MOFETA ========== */
  mofetaJr:         'assets/ilustraciones/mofetaJr.png',         // Mofeta Júnior
  cuescoVolador:    'assets/ilustraciones/cuescoVolador.png',    // Cuesco Teledirigido
  cuescoAndante:    'assets/ilustraciones/cuescoAndante.png',    // Cuesco con Patas
  mochilaPedo:      'assets/ilustraciones/mochilaPedo.png',      // Pedo de Mochila
  pedoProteico:     'assets/ilustraciones/pedoProteico.png',     // Pedo Proteico
  hamburguesaDoble: 'assets/ilustraciones/hamburguesaDoble.png', // Hamburguesa Doble con Extra
  kebabMadrugada:   'assets/ilustraciones/kebabMadrugada.png',   // Kebab de Madrugada
  tupperSobras:     'assets/ilustraciones/tupperSobras.png',     // Tupper de Sobras
  cuescoExpulsor:   'assets/ilustraciones/cuescoExpulsor.png',   // Cuesco Expulsor
  reyKebab:         'assets/ilustraciones/keykebab.png',         // Kevin, el Rey del Kebab
  pedoCaotico:      'assets/ilustraciones/pedoCaotico.png',      // El Pedo del Caos
  pedoDefinitivo:   'assets/ilustraciones/pedoDefinitivo.png',   // EL PEDO DEFINITIVO

  /* ========== EXPANSIÓN: FUGA DEL MANICOMIO ========== */
  yogurPina:          'assets/ilustraciones/yogurPina.png',          // El Yogur de Piña
  rabascoEncanado:    'assets/ilustraciones/rabascoEncanado.png',    // Rabasco Encanado
  gritoEncane:        'assets/ilustraciones/gritoEncane.png',        // ¡BARBARIDAD!
  planDeFuga:         'assets/ilustraciones/planDeFuga.png',         // Plan de Fuga
  tunelCuchara:       'assets/ilustraciones/tunelCuchara.png',       // Túnel con Cuchara
  gafasAfiladas:      'assets/ilustraciones/gafasAfiladas.png',      // Gafas Afiladas
  celadorEnvenenado:  'assets/ilustraciones/celadorEnvenenado.png',  // Celador Envenenado
  tatuajesManicomio:  'assets/ilustraciones/tatuajesManicomio.png',  // Tatuajes del Manicomio
  cauntuHacker:       'assets/ilustraciones/cauntuHacker.png',       // Cauntu Hackea el Sistema
  despachoDirector:   'assets/ilustraciones/despachoDirector.png',   // Saqueo del Despacho
  celadoresPersiguen: 'assets/ilustraciones/celadoresPersiguen.png', // ¡Que Se Escapan!
  chusFugado:         'assets/ilustraciones/chusFugado.png',         // Chus, Fugado Profesional
  eduardoSeguridad:   'assets/ilustraciones/eduardoSeguridad.png',   // Eduardo, «Seguridad»
  fugado:             'assets/ilustraciones/fugado.png',             // Enfermo Fugado (ficha)

  /* ========== MAZO: LA IMPRESORA 3D (Jorge Monzo) ========== */
  impresora3d:    'assets/ilustraciones/impresora3d.png',    // La Impresora 3D
  calvoReluciente:'assets/ilustraciones/calvoReluciente.png',// Cabeza Reluciente
  exSemipro:      'assets/ilustraciones/exSemipro.png',      // Ex-Semipro de CS
  peterGato:      'assets/ilustraciones/peterGato.png',      // Peter, el Gato Gordo
  manualImpresora:'assets/ilustraciones/manualImpresora.png',// Manual de la Impresora
  quedarseCalvo:  'assets/ilustraciones/quedarseCalvo.png',  // Quedarse Calvo
  pedoSilencioso: 'assets/ilustraciones/pedoSilencioso.png', // Pedo Silencioso pero Mortal
  ataquePeter:    'assets/ilustraciones/ataquePeter.png',    // Ataque de Peter
  echarDeathmatch:'assets/ilustraciones/echarDeathmatch.png',// Echar unos Deathmatch
  festivalRandom: 'assets/ilustraciones/festivalRandom.png', // Festival Random
  viajeTurquia:   'assets/ilustraciones/viajeTurquia.png',   // Viaje a Turquía
  jugarClassic:   'assets/ilustraciones/jugarClassic.png',   // Jugar a Classic
  /* cartas impresas en 3D (fichas) */
  impFigura:      'assets/ilustraciones/impFigura.png',      // Figura del Manicomio
  impCubo:        'assets/ilustraciones/impCubo.png',        // Cubo de Calibración
  impGafas:       'assets/ilustraciones/impGafas.png',       // Gafas de Nikuman (impresas)
  impHerramienta: 'assets/ilustraciones/impHerramienta.png', // Herramienta Impresa

  /* ========== FICHAS Y ESPECIALES ========== */
  gato:           'assets/ilustraciones/gato.png',           // Gato de Nikuman (ficha)
  nikuborg:       'assets/ilustraciones/nikuborg.png',       // Niku-Borg 9000 (ficha)
  cerveza:        'assets/ilustraciones/cerveza.png',        // Cerveza Gratis (moneda)

  /* ========== RETRATOS DE HÉROE (círculo del tablero) ==========
     Cada héroe rival del modo historia usa la ilustración de su
     personaje (la carta legendaria / cabecilla de su mazo). */
  hero_director:    'assets/ilustraciones/rafael.png',    // Rafael Rovira, tu héroe (abajo)
  hero_nikuman:     'assets/ilustraciones/nikuman.png',   // Nikuman, La Mano Negra
  hero_kevin:       'assets/ilustraciones/keykebab.png',  // Kevin, el Mofeta (Rey del Kebab)
  hero_marioHero:   'assets/ilustraciones/mario.png',     // Mario Matas, el Cabecilla
  hero_jorgeHero:   'assets/ilustraciones/monzo.png',     // Jorge Monzo, el Ventosero
  hero_victorHero:  'assets/ilustraciones/victor.png',    // Víctor Lamas, el Motero
  hero_rabascoHero: 'assets/ilustraciones/rabasco.png',   // Rabasco, el Picado Maestro
  hero_paquitoHero: 'assets/ilustraciones/paquito.png',   // Paquito Serna, la Bestia
  hero_marioSupremo: 'assets/ilustraciones/mario.png'     // Mario, el Paciente Supremo (boss)
};
