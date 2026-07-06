'use strict';
/* =========================================================
   LOS ENFERMOS: EL TCG DEL MANICOMIO
   Base de datos de héroes, cartas y barajas.
   Sin dependencias del DOM: también se usa en tests.
   ========================================================= */

/* ---------- HÉROES ---------- */
const HEROES = {
  director: {
    id: 'director',
    name: 'Rafael Rovira «El Director»',
    title: 'Fundador del Sanatorio San José',
    portrait: '🧑‍⚕️',
    power: {
      /* el médico: cura y estabiliza a sus pacientes */
      name: 'Terapia Intensiva', cost: 2, icon: '💊', target: 'any',
      desc: 'Restaura 3 de salud a cualquier objetivo.',
      use(g, p, t) { heal(g, t, 3); },
      aiTarget(g, p) { return p.hero; }
    }
  },
  nikuman: {
    id: 'nikuman',
    name: 'Nikuman «La Mano Negra»',
    title: 'El Pullador Absoluto (Kuroi Te)',
    portrait: '🤓',
    power: {
      /* el pullador: no ataca, DESMORALIZA — baja al que destaca */
      name: 'Kuroi Te', cost: 2, icon: '🖤', target: 'enemyMinion',
      desc: 'La Mano Negra pulla a un esbirro enemigo: le resta 2 de ataque (mínimo 0).',
      use(g, p, t) { if (t && !t.isHero) t.attack = Math.max(0, t.attack - 2); },
      aiTarget(g, p) {
        const opp = g.players[1 - p.idx];
        return opp.board.slice().sort((a, b) => b.attack - a.attack)[0] || null;
      }
    }
  },
  kevin: {
    id: 'kevin',
    name: 'Kevin «El Mofeta»',
    title: 'El Devorador de Kebabs',
    portrait: '🦨',
    power: {
      /* el mofeta: impregna de Olor a Peo (daño por turno) */
      name: 'Pedete Sorpresa', cost: 2, icon: '💨', target: 'any',
      desc: 'Inflige 1 de daño. Si es un esbirro, le aplica Olor a Peo (recibe 1 de daño al final de cada turno de su dueño).',
      use(g, p, t) { dealDamage(g, t, 1); if (!t.isHero) applyStench(g, t); },
      aiTarget(g, p) {
        const opp = g.players[1 - p.idx];
        const sano = opp.board.filter(m => !m.stench).sort((a, b) => b.health - a.health);
        return sano[0] || opp.hero;
      }
    }
  },
  marioHero: {
    id: 'marioHero',
    name: 'Mario Matas «El Cabecilla»',
    title: 'Cerebro de la Fuga del Manicomio',
    portrait: '🎭',
    power: {
      /* el liante: trapichea cartas (roba y descarta para los Encanes) */
      name: 'Trapicheo', cost: 2, icon: '🎭', target: null,
      desc: 'Roba una carta y luego descarta una al azar (alimenta los Encanes).',
      use(g, p) { drawCards(g, p, 1); discardRandom(g, p, 1); },
      aiWants(g, p) { return p.hand.length > 0; }
    }
  },
  /* --- héroes RIVALES del modo historia (aún sin mazo propio: usan
         mazos existentes como placeholder hasta que se diseñen) --- */
  jorgeHero: {
    id: 'jorgeHero',
    name: 'Jorge Monzo «El Impresor»',
    title: 'Calvo, pedorro y semi-pro retirado',
    portrait: '🖨️',
    power: {
      /* su seña de identidad: la impresora 3D siempre echando humo */
      name: 'Imprimir en 3D', cost: 2, icon: '🖨️', target: null,
      desc: 'IMPRIME una carta al azar: una ficha monocroma «impresa en 3D» (floja pero útil) en tu mano.',
      use(g, p) { imprimirRandom(g, p); },
      aiWants(g, p) { return p.hand.length < 9; }
    }
  },
  victorHero: {
    id: 'victorHero',
    name: 'Víctor Lamas «El Motero»',
    title: 'Calvo, pero con dos ruedas',
    portrait: '🏍️',
    power: {
      /* arranca la moto: acelera a un aliado (le da caña) */
      name: 'Acelerón', cost: 2, icon: '🏍️', target: 'friendlyMinion',
      desc: 'Arranca la moto: un esbirro aliado gana +2 de ataque de forma permanente.',
      use(g, p, t) { if (t && !t.isHero) { t.attack += 2; fx('buff', { minion: t }); } },
      aiTarget(g, p) { return p.board.slice().sort((a, b) => b.attack - a.attack)[0] || null; }
    }
  },
  rabascoHero: {
    id: 'rabascoHero',
    name: 'Rabasco «El Cornudo»',
    title: 'Picado y con el cuerno afilado',
    portrait: '🐏',
    power: {
      /* embiste con el cuerno: golpe fuerte a un solo objetivo */
      name: 'Cornada', cost: 2, icon: '🐏', target: 'enemyMinion',
      desc: 'Embiste con el cuerno afilado: inflige 3 de daño a un esbirro enemigo.',
      use(g, p, t) { dealDamage(g, t, 3); },
      aiTarget(g, p) {
        const opp = g.players[1 - p.idx];
        const b = opp.board.slice();
        const remata = b.filter(m => m.health <= 3).sort((a, b) => b.attack - a.attack);
        return remata[0] || b.sort((a, b) => b.attack - a.attack)[0] || null;
      }
    }
  }
};

/* ---------- CARTAS ----------
   type: 'minion' | 'spell' | 'weapon'
   target: null | 'any' | 'minion' | 'friendlyMinion' | 'enemyMinion'
   clazz: 'sanatorio' | 'manonegra' | 'token' | 'neutral'
   aiWants(g,p) -> bool     (opcional: si la IA debería jugarla ahora)
   aiTarget(g,p) -> entidad (opcional: objetivo elegido por la IA)
*/
const CARDS = {

  /* ============ BARAJA: EL SANATORIO SAN JOSÉ (control) ============ */

  celador: {
    id: 'celador', clazz: 'sanatorio', type: 'minion', rarity: 'común',
    name: 'Enfermero Celador', cost: 1, attack: 1, health: 2, emoji: '🧑‍🦽',
    taunt: true,
    text: '<b>Provocar</b>.',
    flavor: 'Nadie sale del San José sin firmar el parte.'
  },

  moteNuevo: {
    id: 'moteNuevo', clazz: 'sanatorio', type: 'spell', rarity: 'común',
    name: 'Mote Nuevo', cost: 1, emoji: '🏷️',
    text: 'Roba una carta.<br><b>Combo:</b> roba 2 en su lugar.',
    flavor: 'Mario ya te ha rebautizado. Ahora eres «El Croqueta».',
    spell(g, p, t, combo) { drawCards(g, p, combo ? 2 : 1); }
  },

  chus: {
    id: 'chus', clazz: 'sanatorio', type: 'minion', rarity: 'rara',
    name: 'Chus, el Chusti Wild', cost: 2, attack: 2, health: 1, emoji: '🕺',
    text: '<b>Combo:</b> gana +1/+1 y <b>Embestida</b>.',
    flavor: 'Viene directo de una fiesta. Nadie sabe de cuál.',
    battlecry(g, p, m, t, combo) {
      if (combo) { m.attack += 1; m.health += 1; m.maxHealth += 1; m.charge = true; log(g, '🎉 ¡Chus llega motivado de la fiesta!'); }
    }
  },

  paquito: {
    id: 'paquito', clazz: 'sanatorio', type: 'minion', rarity: 'común',
    name: 'Paquito Serna Quesada', cost: 2, attack: 2, health: 3, emoji: '🛡️',
    taunt: true,
    text: '<b>Provocar</b>.',
    flavor: '«Tranquilo, tranquilo... que estoy yo aquí.»'
  },

  sePonePelo: {
    id: 'sePonePelo', clazz: 'sanatorio', type: 'spell', rarity: 'común',
    name: 'Se Pone Pelo', cost: 2, emoji: '💇‍♂️',
    target: 'friendlyMinion',
    text: 'Otorga <b>+2/+2</b> a un esbirro aliado.',
    flavor: 'El injerto de Mario: confianza +100, humildad -100.',
    spell(g, p, t) { t.attack += 2; t.health += 2; t.maxHealth += 2; },
    aiWants(g, p) { return p.board.length > 0; },
    aiTarget(g, p) { return p.board.slice().sort((a, b) => b.attack - a.attack)[0] || null; }
  },

  camisaFuerza: {
    id: 'camisaFuerza', clazz: 'sanatorio', type: 'spell', rarity: 'rara',
    name: 'Camisa de Fuerza', cost: 2, emoji: '🥼',
    target: 'enemyMinion',
    text: 'Cambia el Ataque de un esbirro enemigo a <b>1</b>.',
    flavor: 'Talla única. No se pregunta.',
    spell(g, p, t) { t.attack = 1; log(g, `🥼 ${t.def.name} queda bien atadito.`); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      const big = opp.board.filter(m => m.attack >= 3).sort((a, b) => b.attack - a.attack);
      return big[0] || null;
    }
  },

  rabasco: {
    id: 'rabasco', clazz: 'sanatorio', type: 'minion', rarity: 'rara',
    name: 'Rabasco, el Picado', cost: 3, attack: 3, health: 2, emoji: '🦏',
    charge: true,
    text: '<b>Embestida</b>. El cuerno de la frente no es decorativo.',
    flavor: 'Le dijeron «cálmate» y se le puso el cuerno incandescente.'
  },

  terapiaChoque: {
    id: 'terapiaChoque', clazz: 'sanatorio', type: 'spell', rarity: 'común',
    name: 'Terapia de Choque', cost: 3, emoji: '⚡',
    target: 'any',
    text: 'Inflige <b>3</b> de daño.',
    flavor: 'Aprobada por el comité ético del Director (él mismo).',
    spell(g, p, t) { dealDamage(g, t, 3); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      const kill = opp.board.filter(m => m.health <= 3).sort((a, b) => b.attack - a.attack);
      return kill[0] || opp.hero;
    }
  },

  ordenIngreso: {
    id: 'ordenIngreso', clazz: 'sanatorio', type: 'spell', rarity: 'épica',
    name: 'Orden de Ingreso', cost: 3, emoji: '📋',
    target: 'enemyMinion',
    text: 'Devuelve un esbirro enemigo a la mano de su dueño.',
    flavor: 'Firmado: El Director. Habitación 13, sin tele.',
    spell(g, p, t) {
      log(g, `📋 Orden firmada: ${t.def.name} queda ingresado en el San José.`);
      returnToHand(g, t, 0);
    },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      return opp.board.slice().sort((a, b) => (b.attack + b.health) - (a.attack + a.health))[0] || null;
    }
  },

  montreal: {
    id: 'montreal', clazz: 'sanatorio', type: 'minion', rarity: 'rara',
    name: 'Montreal', cost: 3, attack: 2, health: 4, emoji: '🛒',
    text: 'Al final de tu turno, restaura <b>2</b> de salud a tu héroe (picoteo y birra constantes).',
    flavor: 'Eduardo Florido, 36 años, seguridad del Carrefour. Vigila los pasillos pensando en One Piece mientras su gato egipcio domina la casa.',
    endTurn(g, p, m) { heal(g, p.hero, 2); }
  },

  victor: {
    id: 'victor', clazz: 'sanatorio', type: 'minion', rarity: 'rara',
    name: 'Victor Lamas, Calvo Veloz', cost: 4, attack: 4, health: 3, emoji: '🏍️',
    charge: true,
    text: '<b>Embestida</b>. La calva reduce la resistencia al viento.',
    flavor: 'Cero pelo, cero miedo, doscientos por hora.'
  },

  monzo: {
    id: 'monzo', clazz: 'sanatorio', type: 'minion', rarity: 'épica',
    name: 'Jorge Monzo, el Ventoso', cost: 4, attack: 3, health: 3, emoji: '💨',
    text: '<b>Grito de Batalla:</b> inflige 1 de daño a todos los demás esbirros.',
    flavor: 'El pedo se oyó en tres provincias. Hubo réplicas.',
    battlecry(g, p, m) {
      const all = [...g.players[0].board, ...g.players[1].board].filter(x => x !== m);
      for (const x of all) dealDamage(g, x, 1);
      log(g, '💨 ¡Pedo sónico de Monzo! Daño colateral en todo el tablero.');
    }
  },

  medicacion: {
    id: 'medicacion', clazz: 'sanatorio', type: 'spell', rarity: 'común',
    name: 'Medicación Doble', cost: 4, emoji: '💉',
    text: 'Restaura <b>5</b> de salud a tu héroe y roba una carta.',
    flavor: 'Si con una pastilla no se calla, con dos tampoco, pero se duerme.',
    spell(g, p) { heal(g, p.hero, 5); drawCards(g, p, 1); },
    aiWants(g, p) { return p.hero.hp <= 25; }
  },

  furgoneta: {
    id: 'furgoneta', clazz: 'sanatorio', type: 'weapon', rarity: 'épica',
    name: 'La Furgoneta del Sanatorio', cost: 4, attack: 3, durability: 2, emoji: '🚐',
    text: 'Artefacto <b>3/2</b>. Tu héroe puede atacar.',
    flavor: 'Pasa a recogerte. Siempre. Estés donde estés.'
  },

  brote: {
    id: 'brote', clazz: 'sanatorio', type: 'spell', rarity: 'épica',
    name: 'Brote Psicótico', cost: 5, emoji: '🌀',
    text: 'Inflige <b>2</b> de daño a todos los esbirros enemigos.',
    flavor: 'Empezó discutiendo por el pádel y acabó así.',
    spell(g, p) {
      const opp = g.players[1 - p.idx];
      for (const m of [...opp.board]) dealDamage(g, m, 2);
    },
    aiWants(g, p) { return g.players[1 - p.idx].board.length >= 2; }
  },

  mario: {
    id: 'mario', clazz: 'sanatorio', type: 'minion', rarity: 'legendaria',
    name: 'Mario Matas, el Liante', cost: 5, attack: 4, health: 5, emoji: '🎭',
    text: '<b>Grito de Batalla:</b> roba una carta y reduce su coste en (2). De paso, le pone un mote a alguien.',
    flavor: 'Futuro paciente estrella del San José. Se puso pelo y moto el mismo mes.',
    battlecry(g, p, m) {
      const drawn = drawCards(g, p, 1);
      for (const c of drawn) c.costMod -= 2;
      if (drawn.length) log(g, `🎭 Mario lía a alguien: «${drawn[0].def.name}» ahora cuesta (2) menos.`);
    }
  },

  /* ============ BARAJA: LA MANO NEGRA (agresiva/combo) ============ */

  quejaFormal: {
    id: 'quejaFormal', clazz: 'manonegra', type: 'spell', rarity: 'común',
    name: 'Queja Formal', cost: 1, emoji: '📢',
    target: 'any',
    text: 'Inflige <b>1</b> de daño.<br><b>Combo:</b> inflige 3 en su lugar.',
    flavor: '«Es que, a ver, es que no. Es que es todo mal.»',
    spell(g, p, t, combo) { dealDamage(g, t, combo ? 3 : 1); },
    aiTarget(g, p) {
      const dmg = p.cardsPlayedThisTurn > 0 ? 3 : 1;
      const opp = g.players[1 - p.idx];
      const kill = opp.board.filter(m => m.health <= dmg).sort((a, b) => b.attack - a.attack);
      return kill[0] || opp.hero;
    }
  },

  peucadorNovato: {
    id: 'peucadorNovato', clazz: 'manonegra', type: 'minion', rarity: 'común',
    name: 'Peucador Novato', cost: 1, attack: 2, health: 1, emoji: '🦶',
    text: '<b>Grito de Batalla:</b> inflige 1 de daño a tu propio héroe. El asco es real.',
    flavor: 'Aprendió del maestro: pies desnudos encima de TU mesa.',
    battlecry(g, p, m) { dealDamage(g, p.hero, 1); }
  },

  elizabeth: {
    id: 'elizabeth', clazz: 'manonegra', type: 'minion', rarity: 'rara',
    name: 'Elizabeth, la Santa', cost: 2, attack: 2, health: 3, emoji: '😇',
    text: '<b>Grito de Batalla:</b> restaura 3 de salud a tu héroe.',
    flavor: 'Aguanta a Nikuman, a Cauntu Y a los cinco gatos. Canonización pendiente.',
    battlecry(g, p, m) { heal(g, p.hero, 3); }
  },

  kebab: {
    id: 'kebab', clazz: 'manonegra', type: 'spell', rarity: 'común',
    name: 'Kebab Doble Carne', cost: 2, emoji: '🥙',
    target: 'friendlyMinion',
    text: 'Otorga <b>+2/+2</b> a un esbirro aliado.',
    flavor: '«Con todo, jefe. Y salsa extra.» — Kevin, cada madrugada.',
    spell(g, p, t) { t.attack += 2; t.health += 2; t.maxHealth += 2; },
    aiWants(g, p) { return p.board.length > 0; },
    aiTarget(g, p) { return p.board.slice().sort((a, b) => b.attack - a.attack)[0] || null; }
  },

  peucada: {
    id: 'peucada', clazz: 'manonegra', type: 'spell', rarity: 'rara',
    name: 'Peucada Maestra', cost: 2, emoji: '🐾',
    target: 'any',
    text: 'Inflige <b>3</b> de daño. <b>Descarta</b> una carta aleatoria.',
    flavor: 'Nikuman apoya los pies descalzos en tu salud mental.',
    spell(g, p, t) { dealDamage(g, t, 3); discardRandom(g, p, 1); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      const kill = opp.board.filter(m => m.health <= 3).sort((a, b) => b.attack - a.attack);
      return kill[0] || opp.hero;
    }
  },

  mandoGamer: {
    id: 'mandoGamer', clazz: 'manonegra', type: 'weapon', rarity: 'rara',
    name: 'Mando Pro Gamer', cost: 2, attack: 2, durability: 2, emoji: '🎮',
    text: 'Artefacto <b>2/2</b>. Tu héroe puede atacar.',
    flavor: 'Nikuman ya va 3-0 contra ti y contra tu autoestima.',
    aiWants(g, p) { return !p.hero.weapon; }
  },

  rageQuit: {
    id: 'rageQuit', clazz: 'manonegra', type: 'spell', rarity: 'rara',
    name: 'Rage Quit', cost: 2, emoji: '🤬',
    target: 'friendlyMinion',
    text: '<b>Destruye</b> un esbirro aliado y roba 2 cartas.',
    flavor: 'Desinstala el juego. Lo reinstala a los diez minutos.',
    spell(g, p, t) { t.health = 0; checkDeaths(g); drawCards(g, p, 2); },
    aiWants(g, p) { return p.board.some(m => m.health <= 1 || m.attack <= 1); },
    aiTarget(g, p) {
      return p.board.slice().sort((a, b) => (a.attack + a.health) - (b.attack + b.health))[0] || null;
    }
  },

  gatoCiber: {
    id: 'gatoCiber', clazz: 'manonegra', type: 'minion', rarity: 'rara',
    name: 'Gato Cibernético', cost: 3, attack: 3, health: 2, emoji: '🐱‍👤',
    text: '<b>Última Voluntad:</b> invoca un Gato de Nikuman 1/1.',
    flavor: 'Prototipo v0.1 de Cauntu. Aún araña el sofá, pero con láser.',
    deathrattle(g, p, m) { summon(g, p, 'gato'); }
  },

  viciada: {
    id: 'viciada', clazz: 'manonegra', type: 'spell', rarity: 'común',
    name: 'Viciada de 14 Horas', cost: 3, emoji: '🖥️',
    text: 'Roba <b>2</b> cartas.',
    flavor: '«Una mazmorra más y lo dejo.» — Nikuman, hace 14 horas, en el PoE2.',
    spell(g, p) { drawCards(g, p, 2); }
  },

  odioFiti: {
    id: 'odioFiti', clazz: 'manonegra', type: 'spell', rarity: 'épica',
    name: 'Odio Eterno a Fiti', cost: 3, emoji: '☄️',
    text: 'Inflige <b>4</b> de daño al héroe enemigo.',
    flavor: 'Cauntu no perdona. Cauntu no olvida. Cauntu apunta a Rafael Rovira.',
    spell(g, p) { dealDamage(g, g.players[1 - p.idx].hero, 4); }
  },

  cauntu: {
    id: 'cauntu', clazz: 'manonegra', type: 'minion', rarity: 'legendaria',
    name: 'Cauntu, Científico Loco', cost: 4, attack: 3, health: 4, emoji: '🧪',
    text: '<b>Grito de Batalla:</b> añade una «Ciborgización» a tu mano.',
    flavor: 'Rubén García Onandia. Su tesis doctoral: convertir a su hermano en arma.',
    battlecry(g, p, m) {
      if (p.hand.length < 10) {
        p.hand.push(makeCardInstance('ciborg'));
        log(g, '🧪 Cauntu garabatea los planos de la Ciborgización...');
      }
    }
  },

  pedoAtomico: {
    id: 'pedoAtomico', clazz: 'manonegra', type: 'spell', rarity: 'épica',
    name: 'Pedo Atómico', cost: 4, emoji: '☢️',
    text: 'Inflige <b>2</b> de daño a TODOS los esbirros.',
    flavor: 'Kevin comió tres kebabs y un dürüm. Que Dios nos pille confesados.',
    spell(g, p) {
      const all = [...g.players[0].board, ...g.players[1].board];
      for (const m of all) dealDamage(g, m, 2);
    },
    aiWants(g, p) {
      const opp = g.players[1 - p.idx];
      return opp.board.length >= 2 && opp.board.length > p.board.filter(m => m.health <= 2).length;
    }
  },

  cincoGatos: {
    id: 'cincoGatos', clazz: 'manonegra', type: 'spell', rarity: 'épica',
    name: 'Los 5 Gatos', cost: 5, emoji: '🐈‍⬛',
    text: 'Invoca <b>cinco</b> Gatos de Nikuman 1/1.',
    flavor: 'El piso es de ellos. Nikuman y Elizabeth solo pagan el alquiler.',
    spell(g, p) { for (let i = 0; i < 5; i++) summon(g, p, 'gato'); },
    aiWants(g, p) { return p.board.length <= 4; }
  },

  kevin: {
    id: 'kevin', clazz: 'manonegra', type: 'minion', rarity: 'legendaria',
    name: 'Kevin, el Mofeta', cost: 5, attack: 4, health: 4, emoji: '🦨',
    text: '<b>Grito de Batalla:</b> inflige 2 de daño a todos los esbirros enemigos. Nube tóxica de kebab.',
    flavor: 'Xteal. Cacho lacón con grelos. Su estela huele a döner y a peligro.',
    battlecry(g, p, m) {
      const opp = g.players[1 - p.idx];
      for (const x of [...opp.board]) dealDamage(g, x, 2);
      log(g, '🦨 ¡Kevin libera la nube tóxica!');
    }
  },

  ciborg: {
    id: 'ciborg', clazz: 'manonegra', type: 'spell', rarity: 'legendaria',
    name: 'Ciborgización', cost: 5, emoji: '🤖',
    target: 'friendlyMinion',
    text: 'Transforma un esbirro aliado en <b>Niku-Borg 9000</b> (8/8 con <b>Provocar</b>).',
    flavor: 'Fase final del plan de Cauntu. Nikuman firmó sin leer.',
    spell(g, p, t) {
      const i = p.board.indexOf(t);
      if (i >= 0) {
        const borg = makeMinion('nikuborg', p.idx);
        p.board[i] = borg;
        log(g, `🤖 ¡${t.def.name} es CIBORGIZADO! Nace el Niku-Borg 9000.`);
      }
    },
    aiWants(g, p) { return p.board.length > 0; },
    aiTarget(g, p) {
      return p.board.filter(m => m.id !== 'nikuborg')
        .sort((a, b) => (a.attack + a.health) - (b.attack + b.health))[0] || null;
    }
  },

  nikumanCard: {
    id: 'nikumanCard', clazz: 'manonegra', type: 'minion', rarity: 'legendaria',
    name: 'Nikuman, la Mano Negra', cost: 6, attack: 5, health: 5, emoji: '🖐🏿',
    text: '<b>Grito de Batalla:</b> inflige 1 de daño a todos los enemigos. Una pulla para cada uno.',
    flavor: 'Ismael García Onandia. Tiene una pega preparada para tu lápida.',
    battlecry(g, p, m) {
      const opp = g.players[1 - p.idx];
      dealDamage(g, opp.hero, 1);
      for (const x of [...opp.board]) dealDamage(g, x, 1);
      log(g, '🖐🏿 ¡Ronda de pullas de la Mano Negra!');
    }
  },

  top1: {
    id: 'top1', clazz: 'manonegra', type: 'spell', rarity: 'épica',
    name: 'Top 1 del Ranking', cost: 6, emoji: '🏆',
    text: 'Otorga <b>+2/+2</b> a todos tus esbirros.',
    flavor: 'Tiene que ser el mejor en el WoW, en el PoE2 y en quejarse.',
    spell(g, p) {
      for (const m of p.board) { m.attack += 2; m.health += 2; m.maxHealth += 2; }
    },
    aiWants(g, p) { return p.board.length >= 2; }
  },

  /* ============ EXPANSIÓN: RECUERDOS DEL PARQUE (se compra en la tienda) ============ */

  litrona: {
    id: 'litrona', clazz: 'neutral', type: 'spell', rarity: 'común',
    name: 'Litrona del Parque', cost: 1, emoji: '🍾',
    text: 'Restaura <b>4</b> de salud a tu héroe.',
    flavor: 'Caliente a las 3 de la mañana, pero nadie se queja. Bueno, Nikuman sí.',
    spell(g, p) { heal(g, p.hero, 4); },
    aiWants(g, p) { return p.hero.hp <= 26; }
  },

  vecinoCabreado: {
    id: 'vecinoCabreado', clazz: 'neutral', type: 'minion', rarity: 'común',
    name: 'Vecino Cabreado', cost: 2, attack: 2, health: 3, emoji: '😡',
    taunt: true,
    text: '<b>Provocar</b>.',
    flavor: '«¡La una de la mañana y con la litrona en el banco! ¡POLICÍA!»'
  },

  pandilla: {
    id: 'pandilla', clazz: 'neutral', type: 'spell', rarity: 'rara',
    name: 'La Pandilla al Completo', cost: 3, emoji: '👬',
    text: 'Invoca dos <b>Colegas del Parque</b> 1/1 con <b>Embestida</b>.',
    flavor: 'Nunca se sabe quién viene, pero siempre vienen.',
    spell(g, p) { summon(g, p, 'colega'); summon(g, p, 'colega'); }
  },

  cocheEmpresa: {
    id: 'cocheEmpresa', clazz: 'neutral', type: 'weapon', rarity: 'rara',
    name: 'El Coche de Empresa', cost: 3, attack: 2, durability: 3, emoji: '🚗',
    text: 'Artefacto <b>2/3</b>. Tu héroe puede atacar.',
    flavor: 'Huele a tabaco de 2009 y a gloria.',
    aiWants(g, p) { return !p.hero.weapon; }
  },

  moteDefinitivo: {
    id: 'moteDefinitivo', clazz: 'neutral', type: 'spell', rarity: 'épica',
    name: 'El Mote Definitivo', cost: 4, emoji: '🎯',
    target: 'any',
    text: 'Inflige <b>3</b> de daño y roba una carta.',
    flavor: 'Cuando Mario acierta, el mote te acompaña hasta la tumba.',
    spell(g, p, t) { dealDamage(g, t, 3); drawCards(g, p, 1); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      const kill = opp.board.filter(m => m.health <= 3).sort((a, b) => b.attack - a.attack);
      return kill[0] || opp.hero;
    }
  },

  colega: {
    id: 'colega', clazz: 'token', type: 'minion', rarity: 'común', token: true,
    name: 'Colega del Parque', cost: 1, attack: 1, health: 1, emoji: '🧢',
    charge: true,
    text: '<b>Embestida</b>.',
    flavor: 'Ha venido en cuanto ha leído el WhatsApp.'
  },

  /* ============ BARAJA: EL MOFETA (se compra en la tienda) ============
     Mecánica propia: «Olor a Peo» — el esbirro apestado recibe 1 de daño
     al final de cada turno de su dueño. */

  mofetaJr: {
    id: 'mofetaJr', clazz: 'mofeta', type: 'minion', rarity: 'común',
    name: 'Mofeta Júnior', cost: 1, attack: 1, health: 2, emoji: '🦨',
    text: '<b>Grito de Batalla:</b> aplica <b>Olor a Peo</b> a un esbirro enemigo aleatorio.',
    flavor: 'Aprendiz de Kevin. Aún huele a rosas... comparado con el maestro.',
    battlecry(g, p, m) {
      const opp = g.players[1 - p.idx];
      if (opp.board.length) applyStench(g, opp.board[Math.floor(Math.random() * opp.board.length)]);
    }
  },

  cuescoVolador: {
    id: 'cuescoVolador', clazz: 'mofeta', type: 'spell', rarity: 'común',
    name: 'Cuesco Teledirigido', cost: 1, emoji: '💨',
    target: 'any',
    text: 'Inflige <b>1</b> de daño. Si es un esbirro, le aplica <b>Olor a Peo</b>.',
    flavor: 'Kevin apunta con el culo. Kevin nunca falla.',
    spell(g, p, t) { dealDamage(g, t, 1); if (!t.isHero) applyStench(g, t); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      return opp.board.sort((a, b) => b.attack - a.attack)[0] || opp.hero;
    }
  },

  cuescoAndante: {
    id: 'cuescoAndante', clazz: 'mofeta', type: 'minion', rarity: 'común',
    name: 'Cuesco con Patas', cost: 2, attack: 3, health: 2, emoji: '🟢',
    text: '<b>Última Voluntad:</b> aplica <b>Olor a Peo</b> a un esbirro enemigo aleatorio.',
    flavor: 'Se escapó del cuerpo de Kevin en 2019. Sigue suelto.',
    deathrattle(g, p, m) {
      const opp = g.players[1 - p.idx];
      if (opp.board.length) applyStench(g, opp.board[Math.floor(Math.random() * opp.board.length)]);
    }
  },

  mochilaPedo: {
    id: 'mochilaPedo', clazz: 'mofeta', type: 'spell', rarity: 'rara',
    name: 'Pedo de Mochila', cost: 2, emoji: '🎒',
    target: 'friendlyMinion',
    text: 'Pega un pedo a un esbirro aliado: gana <b>+2/+2</b> y, cuando muera, el pedo estalla: <b>1</b> de daño a todos los esbirros enemigos.',
    flavor: 'Va contigo a todas partes. Literalmente pegado.',
    spell(g, p, t) {
      t.attack += 2; t.health += 2; t.maxHealth += 2; t.mochila = true;
      log(g, `🎒 ${t.def.name} carga con un pedo de mochila.`);
    },
    aiWants(g, p) { return p.board.length > 0; },
    aiTarget(g, p) { return p.board.slice().sort((a, b) => b.attack - a.attack)[0] || null; }
  },

  pedoProteico: {
    id: 'pedoProteico', clazz: 'mofeta', type: 'spell', rarity: 'común',
    name: 'Pedo Proteico', cost: 2, emoji: '💪',
    target: 'friendlyMinion',
    text: 'Otorga <b>+3/+2</b> a un esbirro aliado... pero le aplica <b>Olor a Peo</b>.',
    flavor: 'Gases de gimnasio. Te hacen fuerte. Te hacen apestar.',
    spell(g, p, t) { t.attack += 3; t.health += 2; t.maxHealth += 2; applyStench(g, t); },
    aiWants(g, p) { return p.board.some(m => m.health >= 3); },
    aiTarget(g, p) { return p.board.filter(m => m.health >= 3).sort((a, b) => b.attack - a.attack)[0] || p.board[0] || null; }
  },

  hamburguesaDoble: {
    id: 'hamburguesaDoble', clazz: 'mofeta', type: 'spell', rarity: 'rara',
    name: 'Hamburguesa Doble con Extra', cost: 2, emoji: '🍔',
    text: 'Aumenta la salud máxima de tu héroe en <b>3</b> y restaura <b>3</b> de salud.',
    flavor: 'Doble carne, doble queso, doble bacon. La ensalada es decorativa.',
    spell(g, p) { p.hero.maxHp += 3; heal(g, p.hero, 3); }
  },

  kebabMadrugada: {
    id: 'kebabMadrugada', clazz: 'mofeta', type: 'spell', rarity: 'común',
    name: 'Kebab de Madrugada', cost: 3, emoji: '🥙',
    text: 'Restaura <b>4</b> de salud a tu héroe y roba una carta.',
    flavor: 'A las 4:30 AM todo kebab es una decisión correcta.',
    spell(g, p) { heal(g, p.hero, 4); drawCards(g, p, 1); },
    aiWants(g, p) { return p.hero.hp <= 27; }
  },

  tupperSobras: {
    id: 'tupperSobras', clazz: 'mofeta', type: 'weapon', rarity: 'rara',
    name: 'Tupper de Sobras', cost: 3, attack: 2, durability: 3, emoji: '🍱',
    text: 'Artefacto <b>2/3</b>. Tu héroe puede atacar.',
    flavor: 'Lleva fermentando en la mochila desde el martes. Arma biológica.',
    aiWants(g, p) { return !p.hero.weapon; }
  },

  cuescoExpulsor: {
    id: 'cuescoExpulsor', clazz: 'mofeta', type: 'spell', rarity: 'épica',
    name: 'Cuesco Expulsor', cost: 3, emoji: '🌪️',
    target: 'enemyMinion',
    text: 'Devuelve un esbirro enemigo a la mano de su dueño. Huele tan mal que costará <b>(1)</b> más.',
    flavor: 'No murió. Simplemente no pudo quedarse.',
    spell(g, p, t) {
      log(g, `🌪️ ${t.def.name} sale disparado por los aires, impregnado de olor.`);
      returnToHand(g, t, 1);
    },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      return opp.board.slice().sort((a, b) => (b.attack + b.health) - (a.attack + a.health))[0] || null;
    }
  },

  reyKebab: {
    id: 'reyKebab', clazz: 'mofeta', type: 'minion', rarity: 'legendaria',
    name: 'Kevin, el Rey del Kebab', cost: 4, attack: 4, health: 5, emoji: '👑',
    text: '<b>Grito de Batalla:</b> añade dos «Kebab de Madrugada» a tu mano.',
    flavor: 'Dieta oficial de la Sala 15: verdura ✗, fruta ✗, ensalada ✗, KEBAB ✓.',
    battlecry(g, p, m) {
      for (let i = 0; i < 2; i++) {
        if (p.hand.length < 10) p.hand.push(makeCardInstance('kebabMadrugada'));
      }
      log(g, '👑 Kevin pide «lo de siempre, dos veces».');
    }
  },

  pedoCaotico: {
    id: 'pedoCaotico', clazz: 'mofeta', type: 'spell', rarity: 'épica',
    name: 'El Pedo del Caos', cost: 5, emoji: '🌀',
    text: 'Baraja TODOS los esbirros del tablero y los reparte al azar entre los dos jugadores.',
    flavor: 'La onda expansiva fue tal que nadie recordaba de qué bando era.',
    spell(g, p) {
      const all = [...g.players[0].board, ...g.players[1].board];
      if (!all.length) return;
      g.players[0].board = [];
      g.players[1].board = [];
      shuffle(all);
      for (const m of all) {
        let side = Math.random() < 0.5 ? 0 : 1;
        if (g.players[side].board.length >= 7) side = 1 - side;
        m.owner = side;
        m.sick = true;
        m.attacksThisTurn = 0;
        g.players[side].board.push(m);
      }
      log(g, '🌀 ¡EL PEDO DEL CAOS! El tablero entero cambia de manos.');
    },
    aiWants(g, p) {
      const opp = g.players[1 - p.idx];
      return opp.board.length >= p.board.length + 2;
    }
  },

  pedoDefinitivo: {
    id: 'pedoDefinitivo', clazz: 'mofeta', type: 'spell', rarity: 'legendaria',
    name: 'EL PEDO DEFINITIVO', cost: 6, emoji: '☁️',
    text: 'Inflige <b>3</b> de daño a todos los esbirros enemigos y aplica <b>Olor a Peo</b> a los supervivientes.',
    flavor: 'Kebab + pizza + hamburguesa + bravas. Kevin lo llamó «el combo». Los forenses, «zona cero».',
    spell(g, p) {
      const opp = g.players[1 - p.idx];
      for (const m of [...opp.board]) dealDamage(g, m, 3);
      for (const m of [...opp.board]) if (!m.dead) applyStench(g, m);
    },
    aiWants(g, p) { return g.players[1 - p.idx].board.length >= 2; }
  },

  /* ============ EXPANSIÓN: FUGA DEL MANICOMIO (tienda) ============
     Meta de MOVILIDAD: descartes con ENCANE (la carta se activa al
     ser descartada), esbirros que entran y salen de la mano con
     descuentos, y payoffs por descartar. */

  yogurPina: {
    id: 'yogurPina', clazz: 'fuga', type: 'spell', rarity: 'épica',
    name: 'El Yogur de Piña', cost: 1, emoji: '🍍',
    target: 'minion',
    text: 'Inflige <b>3</b> de daño a un esbirro. <b>Descarta</b> una carta al azar.',
    flavor: 'Nikuman lo vio en la bandeja de la cena y perdió la cabeza. Literal.',
    spell(g, p, t) { dealDamage(g, t, 3); discardRandom(g, p, 1); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      const kill = opp.board.filter(m => m.health <= 3).sort((a, b) => b.attack - a.attack);
      return kill[0] || opp.board[0] || null;
    }
  },

  rabascoEncanado: {
    id: 'rabascoEncanado', clazz: 'fuga', type: 'minion', rarity: 'común',
    name: 'Rabasco Encanado', cost: 3, attack: 4, health: 3, emoji: '🔥',
    text: '<b>Encane:</b> si se descarta, ¡se invoca encanado directamente en el tablero!',
    flavor: 'Le dijeron que se calmara. Error garrafal.',
    encane(g, p, c) { summon(g, p, 'rabascoEncanado'); }
  },

  gritoEncane: {
    id: 'gritoEncane', clazz: 'fuga', type: 'spell', rarity: 'rara',
    name: '¡BARBARIDAD!', cost: 2, emoji: '💢',
    text: 'Roba <b>2</b> cartas y luego <b>descarta</b> 1 al azar.',
    flavor: 'Alguien dijo que el yogur de piña estaba rico. La sala entera se encanó.',
    spell(g, p) { drawCards(g, p, 2); discardRandom(g, p, 1); }
  },

  planDeFuga: {
    id: 'planDeFuga', clazz: 'fuga', type: 'spell', rarity: 'rara',
    name: 'Plan de Fuga', cost: 2, emoji: '🗺️',
    target: 'friendlyMinion',
    text: 'Devuelve un esbirro aliado a tu mano: costará <b>(2)</b> menos.',
    flavor: 'Paso 1: salir. Paso 2: ya veremos.',
    spell(g, p, t) { returnToHand(g, t, -2); },
    aiWants(g, p) { return p.board.some(m => m.def.battlecry && m.health < m.maxHealth); },
    aiTarget(g, p) {
      return p.board.filter(m => m.def.battlecry).sort((a, b) => b.def.cost - a.def.cost)[0] || p.board[0] || null;
    }
  },

  tunelCuchara: {
    id: 'tunelCuchara', clazz: 'fuga', type: 'spell', rarity: 'épica',
    name: 'Túnel con Cuchara', cost: 4, emoji: '🥄',
    text: '¡Todos fuera! Devuelve TODOS tus esbirros a tu mano: costarán <b>(1)</b> menos.',
    flavor: 'Tres años cavando. La salida daba a la cocina.',
    spell(g, p) { for (const m of [...p.board]) returnToHand(g, m, -1); },
    aiWants(g, p) {
      /* la IA solo lo usa para rescatar tablero dañado */
      return p.board.filter(m => m.health < m.maxHealth).length >= 2 && p.hand.length <= 5;
    }
  },

  gafasAfiladas: {
    id: 'gafasAfiladas', clazz: 'fuga', type: 'weapon', rarity: 'rara',
    name: 'Gafas Afiladas', cost: 2, attack: 2, durability: 2, emoji: '👓',
    text: 'Artefacto <b>2/2</b>. <b>Encane:</b> si se descarta, tu héroe la equipa gratis.',
    flavor: 'Las gafas de Nikuman, afiladas a escondidas contra el borde de la litera.',
    aiWants(g, p) { return !p.hero.weapon; },
    encane(g, p, c) {
      p.hero.weapon = { def: c.def, attack: c.def.attack, durability: c.def.durability };
      log(g, '👓 ¡Las Gafas Afiladas se equipan solas!');
      fx('equip', { owner: p.idx });
    }
  },

  celadorEnvenenado: {
    id: 'celadorEnvenenado', clazz: 'fuga', type: 'minion', rarity: 'común',
    name: 'Celador Envenenado', cost: 2, attack: 2, health: 3, emoji: '🤢',
    text: '<b>Grito de Batalla:</b> si has descartado una carta este turno, gana <b>+2/+2</b>.',
    flavor: 'El puré llevaba «vitaminas». Ahora vota a favor de la fuga.',
    battlecry(g, p, m) {
      if (p.discardedThisTurn > 0) {
        m.attack += 2; m.health += 2; m.maxHealth += 2;
        log(g, '🤢 El celador nota las «vitaminas»: +2/+2.');
      }
    }
  },

  tatuajesManicomio: {
    id: 'tatuajesManicomio', clazz: 'fuga', type: 'spell', rarity: 'común',
    name: 'Tatuajes del Manicomio', cost: 1, emoji: '✒️',
    target: 'friendlyMinion',
    text: 'Otorga <b>+2/+1</b> a un esbirro aliado. <b>Encane:</b> si se descarta, tatúa a un aliado al azar.',
    flavor: '«SALA 15» en el pecho. «Mamá» en el brazo. «Yogur no» en los nudillos.',
    spell(g, p, t) { t.attack += 2; t.health += 1; t.maxHealth += 1; },
    encane(g, p, c) {
      if (p.board.length) {
        const m = p.board[Math.floor(Math.random() * p.board.length)];
        m.attack += 2; m.health += 1; m.maxHealth += 1;
        log(g, `✒️ ${m.def.name} estrena tatuaje: +2/+1.`);
      }
    },
    aiWants(g, p) { return p.board.length > 0; },
    aiTarget(g, p) { return p.board.slice().sort((a, b) => b.attack - a.attack)[0] || null; }
  },

  cauntuHacker: {
    id: 'cauntuHacker', clazz: 'fuga', type: 'spell', rarity: 'épica',
    name: 'Cauntu Hackea el Sistema', cost: 3, emoji: '💻',
    target: 'enemyMinion',
    text: 'Las puertas se abren solas: devuelve un esbirro enemigo a la mano de su dueño y roba una carta.',
    flavor: 'Contraseña del manicomio: 1234. Cauntu tardó tres segundos y se ofendió.',
    spell(g, p, t) { returnToHand(g, t, 0); drawCards(g, p, 1); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      return opp.board.slice().sort((a, b) => (b.attack + b.health) - (a.attack + a.health))[0] || null;
    }
  },

  despachoDirector: {
    id: 'despachoDirector', clazz: 'fuga', type: 'spell', rarity: 'épica',
    name: 'Saqueo del Despacho', cost: 4, emoji: '🗄️',
    text: 'Roba <b>3</b> cartas del despacho del Director, luego <b>descarta</b> 1 al azar.',
    flavor: 'Los expedientes de todos... y una foto del Director con peluca.',
    spell(g, p) { drawCards(g, p, 3); discardRandom(g, p, 1); }
  },

  celadoresPersiguen: {
    id: 'celadoresPersiguen', clazz: 'fuga', type: 'spell', rarity: 'rara',
    name: '¡Que Se Escapan!', cost: 3, emoji: '🚨',
    text: 'Invoca dos <b>Enfermos Fugados</b> 2/1 con <b>Embestida</b>. <b>Encane:</b> si se descarta, invoca uno.',
    flavor: 'La alarma sonó a las 3:07. A las 3:09 ya estaban en el bar de Paco.',
    spell(g, p) { summon(g, p, 'fugado'); summon(g, p, 'fugado'); },
    encane(g, p, c) { summon(g, p, 'fugado'); }
  },

  chusFugado: {
    id: 'chusFugado', clazz: 'fuga', type: 'minion', rarity: 'rara',
    name: 'Chus, Fugado Profesional', cost: 3, attack: 3, health: 4, emoji: '🏃',
    text: 'Siempre que vuelva a tu mano, costará <b>(0)</b>.',
    flavor: 'Se ha fugado de tres manicomios, dos bodas y una mili.',
    onReturn(g, p, c) {
      c.costMod = -c.def.cost;
      log(g, '🏃 Chus ya conoce el camino: costará (0).');
    }
  },

  eduardoSeguridad: {
    id: 'eduardoSeguridad', clazz: 'fuga', type: 'minion', rarity: 'legendaria',
    name: 'Eduardo, «Seguridad»', cost: 4, attack: 4, health: 6, emoji: '🦺',
    taunt: true,
    text: '<b>Provocar</b>. <b>Grito de Batalla:</b> gana <b>+1/+1</b> por cada carta que hayas descartado esta partida.',
    flavor: 'Se compró el uniforme en AliExpress. Nadie se atreve a decirle que aquí no trabaja.',
    battlecry(g, p, m) {
      const n = p.discardsTotal || 0;
      if (n > 0) {
        m.attack += n; m.health += n; m.maxHealth += n;
        log(g, `🦺 Eduardo se viene arriba con ${n} descartes: +${n}/+${n}.`);
      }
    }
  },

  fugado: {
    id: 'fugado', clazz: 'token', type: 'minion', rarity: 'común', token: true,
    name: 'Enfermo Fugado', cost: 1, attack: 2, health: 1, emoji: '🏃',
    charge: true,
    text: '<b>Embestida</b>.',
    flavor: 'Corre en pijama y zapatillas del manicomio. Nadie lo alcanza.'
  },

  /* ============ MAZO: LA IMPRESORA 3D (Jorge Monzo) ============
     Mecánica propia: IMPRIMIR — genera cartas «impresas en 3D» (fichas
     monocromas moradas, flojas pero útiles) que se activan en distintos
     momentos: al jugarse, al final del turno, al atacar, al robar...
     Tema: pedos (distintos a Kevin), calvicie, impresora 3D, Counter-
     Strike y WoW Classic, y Peter (su gato gordo de 9 kilos). */

  impresora3d: {
    id: 'impresora3d', clazz: 'monzo', type: 'minion', rarity: 'rara',
    name: 'La Impresora 3D', cost: 3, attack: 2, health: 4, emoji: '🖨️',
    text: 'Al final de tu turno, <b>IMPRIME</b> una carta al azar.',
    flavor: 'Lleva imprimiendo la misma figurita desde el martes. Va por el intento 14.',
    endTurn(g, p, m) { imprimirRandom(g, p); }
  },

  calvoReluciente: {
    id: 'calvoReluciente', clazz: 'monzo', type: 'minion', rarity: 'común',
    name: 'Cabeza Reluciente', cost: 3, attack: 3, health: 3, emoji: '🧑‍🦲',
    text: '<b>Grito de Batalla:</b> <b>IMPRIME</b> unas «Gafas de Nikuman».',
    flavor: 'Su calva refleja el flexo. Media sala juega con gafas de sol.',
    battlecry(g, p, m) { imprimir(g, p, 'impGafas'); }
  },

  exSemipro: {
    id: 'exSemipro', clazz: 'monzo', type: 'minion', rarity: 'rara',
    name: 'Ex-Semipro de CS', cost: 3, attack: 3, health: 3, emoji: '🔫',
    charge: true,
    text: '<b>Embestida.</b> Cuando ataca, <b>IMPRIME</b> una «Herramienta».',
    flavor: 'Llegó a semi-pro. Hoy hace clutches en la ranked de los martes.',
    onAttack(g, p, m, t) { imprimir(g, p, 'impHerramienta'); }
  },

  peterGato: {
    id: 'peterGato', clazz: 'monzo', type: 'minion', rarity: 'legendaria',
    name: 'Peter, el Gato Gordo', cost: 6, attack: 5, health: 6, emoji: '🐈',
    taunt: true,
    text: '<b>Provocar.</b> Cuando ataca, <b>IMPRIME</b> una «Figura del Manicomio».',
    flavor: 'Nueve kilos de gato. Se sienta en el teclado en plena ranked y nadie se lo impide.',
    onAttack(g, p, m, t) { imprimir(g, p, 'impFigura'); }
  },

  manualImpresora: {
    id: 'manualImpresora', clazz: 'monzo', type: 'spell', rarity: 'épica',
    name: 'Manual de la Impresora', cost: 2, emoji: '📘',
    text: '<b>IMPRIME</b> 2 cartas. Mientras esté en tu mano, <b>IMPRIME</b> una cada vez que robas.',
    flavor: '350 páginas. Nadie lo ha leído. Todos lo tienen abierto por el capítulo de la cama caliente.',
    spell(g, p) { imprimirRandom(g, p); imprimirRandom(g, p); },
    onDraw(g, p, c) { imprimirRandom(g, p); }
  },

  quedarseCalvo: {
    id: 'quedarseCalvo', clazz: 'monzo', type: 'spell', rarity: 'común',
    name: 'Quedarse Calvo', cost: 1, emoji: '🧴',
    target: 'enemyMinion',
    text: 'Un esbirro enemigo pierde <b>3</b> de ataque.',
    flavor: 'Un día tienes flequillo; al siguiente, entradas hasta la nuca.',
    spell(g, p, t) { if (t && !t.isHero) t.attack = Math.max(0, t.attack - 3); },
    aiTarget(g, p) { return g.players[1 - p.idx].board.slice().sort((a, b) => b.attack - a.attack)[0] || null; },
    aiWants(g, p) { return g.players[1 - p.idx].board.some(m => m.attack >= 2); }
  },

  pedoSilencioso: {
    id: 'pedoSilencioso', clazz: 'monzo', type: 'spell', rarity: 'común',
    name: 'Pedo Silencioso pero Mortal', cost: 3, emoji: '😶‍🌫️',
    target: 'minion',
    text: 'Inflige <b>4</b> de daño a un esbirro. Sin ruido. Sin piedad.',
    flavor: 'Kevin apesta y se le nota. Jorge apesta y no lo sabrás hasta que sea tarde.',
    spell(g, p, t) { dealDamage(g, t, 4); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      const k = opp.board.filter(m => m.health <= 4).sort((a, b) => b.attack - a.attack);
      return k[0] || opp.board.slice().sort((a, b) => b.attack - a.attack)[0] || null;
    }
  },

  ataquePeter: {
    id: 'ataquePeter', clazz: 'monzo', type: 'spell', rarity: 'común',
    name: 'Ataque de Peter', cost: 2, emoji: '🐾',
    target: 'enemyMinion',
    text: 'Inflige <b>2</b> de daño a un esbirro enemigo e <b>IMPRIME</b> una «Figura».',
    flavor: 'Peter no ataca por hambre. Ataca porque le has mirado mal.',
    spell(g, p, t) { dealDamage(g, t, 2); imprimir(g, p, 'impFigura'); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      const k = opp.board.filter(m => m.health <= 2).sort((a, b) => b.attack - a.attack);
      return k[0] || opp.board[0] || null;
    },
    aiWants(g, p) { return g.players[1 - p.idx].board.length > 0; }
  },

  echarDeathmatch: {
    id: 'echarDeathmatch', clazz: 'monzo', type: 'spell', rarity: 'común',
    name: 'Echar unos Deathmatch', cost: 3, emoji: '🎯',
    text: 'Inflige <b>2</b> de daño a <b>2</b> enemigos al azar.',
    flavor: '«Solo una y a dormir», dijo. Eran las 4 AM e iba por la número 30.',
    spell(g, p) {
      const opp = g.players[1 - p.idx];
      for (let i = 0; i < 2; i++) {
        const tg = [opp.hero, ...opp.board.filter(m => !m.dead)];
        if (tg.length) dealDamage(g, tg[Math.floor(Math.random() * tg.length)], 2);
      }
    }
  },

  festivalRandom: {
    id: 'festivalRandom', clazz: 'monzo', type: 'spell', rarity: 'épica',
    name: 'Festival Random', cost: 3, emoji: '🎪',
    text: 'Reparte <b>3</b> de daño al azar entre los enemigos.',
    flavor: 'Paola eligió el cartel. Jorge solo quería el bocata de panceta y una sombra.',
    spell(g, p) {
      const opp = g.players[1 - p.idx];
      for (let i = 0; i < 3; i++) {
        const tg = [opp.hero, ...opp.board.filter(m => !m.dead)];
        if (!tg.length) break;
        dealDamage(g, tg[Math.floor(Math.random() * tg.length)], 1);
      }
    }
  },

  viajeTurquia: {
    id: 'viajeTurquia', clazz: 'monzo', type: 'spell', rarity: 'rara',
    name: 'Viaje a Turquía', cost: 3, emoji: '✈️',
    text: 'Restaura <b>3</b> de salud a tu héroe e <b>IMPRIME</b> una carta.',
    flavor: 'Se fue calvo. Volvió con flequillo, 4000 folículos nuevos y una factura de escándalo.',
    spell(g, p) { heal(g, p.hero, 3); imprimirRandom(g, p); },
    aiWants(g, p) { return p.hero.hp <= 26; }
  },

  jugarClassic: {
    id: 'jugarClassic', clazz: 'monzo', type: 'spell', rarity: 'épica',
    name: 'Jugar a Classic', cost: 5, emoji: '🗡️',
    text: 'Roba <b>3</b> cartas. La nostalgia es grindear lo mismo otra vez.',
    flavor: 'El mismo WoW de hace 15 años, las mismas 40 horas de farmeo, la misma felicidad.',
    spell(g, p) { drawCards(g, p, 3); },
    aiWants(g, p) { return p.hand.length <= 6; }
  },

  /* ============ FICHAS Y ESPECIALES ============ */

  /* --- cartas IMPRESAS en 3D (fichas monocromas del mazo de Jorge) --- */
  impFigura: {
    id: 'impFigura', clazz: 'impreso', type: 'minion', rarity: 'común', token: true, impreso: true,
    name: 'Figura del Manicomio', cost: 1, attack: 2, health: 1, emoji: '🗿',
    text: 'Impresa en 3D.',
    flavor: 'Una miniatura de Nikuman con las gafas torcidas. Pincha si la coges mal.'
  },
  impCubo: {
    id: 'impCubo', clazz: 'impreso', type: 'minion', rarity: 'común', token: true, impreso: true,
    name: 'Cubo de Calibración', cost: 1, attack: 0, health: 3, emoji: '🧊',
    taunt: true,
    text: '<b>Provocar.</b> Impreso en 3D.',
    flavor: 'La primera pieza que imprime todo el mundo. La única que sale bien a la primera.'
  },
  impGafas: {
    id: 'impGafas', clazz: 'impreso', type: 'spell', rarity: 'común', token: true, impreso: true,
    name: 'Gafas de Nikuman', cost: 1, emoji: '👓',
    target: 'friendlyMinion',
    text: 'Un esbirro aliado gana <b>+2</b> de ataque. Impresas en 3D.',
    flavor: 'Ven mejor los headshots. También lo cerca que estás de perder.',
    spell(g, p, t) { if (t && !t.isHero) t.attack += 2; },
    aiTarget(g, p) { return p.board.slice().sort((a, b) => b.attack - a.attack)[0] || null; },
    aiWants(g, p) { return p.board.length > 0; }
  },
  impHerramienta: {
    id: 'impHerramienta', clazz: 'impreso', type: 'spell', rarity: 'común', token: true, impreso: true,
    name: 'Herramienta Impresa', cost: 1, emoji: '🔧',
    target: 'minion',
    text: 'Inflige <b>2</b> de daño a un esbirro. Impresa en 3D.',
    flavor: 'Una llave inglesa de PLA. Aguanta exactamente un golpe.',
    spell(g, p, t) { dealDamage(g, t, 2); },
    aiTarget(g, p) {
      const opp = g.players[1 - p.idx];
      const k = opp.board.filter(m => m.health <= 2).sort((a, b) => b.attack - a.attack);
      return k[0] || opp.board[0] || null;
    },
    aiWants(g, p) { return g.players[1 - p.idx].board.length > 0; }
  },

  gato: {
    id: 'gato', clazz: 'token', type: 'minion', rarity: 'común', token: true,
    name: 'Gato de Nikuman', cost: 1, attack: 1, health: 1, emoji: '🐈‍⬛',
    text: '',
    flavor: 'Miau. Pelo negro en toda tu ropa.'
  },

  nikuborg: {
    id: 'nikuborg', clazz: 'token', type: 'minion', rarity: 'legendaria', token: true,
    name: 'Niku-Borg 9000', cost: 8, attack: 8, health: 8, emoji: '🤖',
    taunt: true,
    text: '<b>Provocar</b>. Mitad hombre, mitad máquina, 100% pullas.',
    flavor: 'La creación definitiva de Cauntu. Odia a Fiti a nivel de firmware.'
  },

  cerveza: {
    id: 'cerveza', clazz: 'neutral', type: 'spell', rarity: 'común', token: true,
    name: 'Cerveza Gratis', cost: 0, emoji: '🍺',
    text: 'Gana un cristal de maná solo durante este turno.',
    flavor: 'La ronda la paga el que llegó tarde. Como siempre.',
    spell(g, p) { p.mana += 1; }
  }
};

/* ---------- SETS COLECCIONABLES ----------
   kind: 'basica' (cartas iniciales) | 'mazo' (temática + arquetipo +
   héroe propios) | 'expansion' (serie de cartas que amplía el pool).
   tag: etiqueta corta que se muestra al pie de cada carta. */
const SETS = {
  sanatorio: {
    name: 'Cartas Básicas', kind: 'basica', tag: 'BÁSICA',
    cards: ['celador', 'moteNuevo', 'chus', 'paquito', 'sePonePelo', 'camisaFuerza', 'rabasco',
      'terapiaChoque', 'ordenIngreso', 'montreal', 'victor', 'monzo', 'medicacion', 'furgoneta',
      'brote', 'mario']
  },
  manonegra: {
    name: 'La Mano Negra', kind: 'mazo', tag: 'MAZO · MANO NEGRA',
    cards: ['quejaFormal', 'peucadorNovato', 'elizabeth', 'kebab', 'peucada', 'mandoGamer',
      'rageQuit', 'gatoCiber', 'viciada', 'odioFiti', 'cauntu', 'pedoAtomico', 'cincoGatos',
      'kevin', 'ciborg', 'nikumanCard', 'top1']
  },
  recuerdos: {
    name: 'Recuerdos del Parque', kind: 'expansion', tag: 'EXP · RECUERDOS',
    cards: ['litrona', 'vecinoCabreado', 'pandilla', 'cocheEmpresa', 'moteDefinitivo']
  },
  mofeta: {
    name: 'El Mofeta', kind: 'mazo', tag: 'MAZO · MOFETA',
    cards: ['mofetaJr', 'cuescoVolador', 'cuescoAndante', 'mochilaPedo', 'pedoProteico',
      'hamburguesaDoble', 'kebabMadrugada', 'tupperSobras', 'cuescoExpulsor', 'reyKebab',
      'pedoCaotico', 'pedoDefinitivo']
  },
  monzo: {
    name: 'La Impresora 3D', kind: 'mazo', tag: 'MAZO · IMPRESORA',
    cards: ['impresora3d', 'calvoReluciente', 'exSemipro', 'peterGato', 'manualImpresora',
      'quedarseCalvo', 'pedoSilencioso', 'ataquePeter', 'echarDeathmatch', 'festivalRandom',
      'viajeTurquia', 'jugarClassic']
  },
  fuga: {
    name: 'Fuga del Manicomio', kind: 'expansion', tag: 'EXP · FUGA',
    cards: ['yogurPina', 'rabascoEncanado', 'gritoEncane', 'planDeFuga', 'tunelCuchara',
      'gafasAfiladas', 'celadorEnvenenado', 'tatuajesManicomio', 'cauntuHacker',
      'despachoDirector', 'celadoresPersiguen', 'chusFugado', 'eduardoSeguridad']
  }
};

/* clasificación de una carta: a qué mazo / expansión pertenece */
function cardSetInfo(id) {
  for (const key of Object.keys(SETS)) {
    if (SETS[key].cards.includes(id)) {
      const s = SETS[key];
      const desc = s.kind === 'basica' ? 'Carta básica inicial'
        : s.kind === 'mazo' ? 'Mazo: ' + s.name
        : 'Expansión: ' + s.name;
      return { key, kind: s.kind, name: s.name, tag: s.tag, desc };
    }
  }
  if (CARDS[id] && CARDS[id].token) {
    return { key: null, kind: 'ficha', name: 'Ficha', tag: 'FICHA', desc: 'Ficha invocada por otra carta' };
  }
  return { key: null, kind: 'especial', name: 'Especial', tag: 'ESPECIAL', desc: 'Carta especial' };
}

/* ---------- BARAJAS (30 cartas) ---------- */
function x2(id) { return [id, id]; }

const DECKS = {
  sanatorio: [
    ...x2('celador'), ...x2('moteNuevo'), ...x2('chus'), ...x2('paquito'),
    ...x2('sePonePelo'), ...x2('camisaFuerza'), ...x2('rabasco'), ...x2('terapiaChoque'),
    ...x2('ordenIngreso'), ...x2('montreal'), ...x2('victor'), ...x2('monzo'),
    ...x2('medicacion'), ...x2('brote'),
    'furgoneta', 'mario'
  ],
  /* mazo por defecto del héroe Kevin: todo el set Mofeta + básicas del Sanatorio */
  mofeta: [
    ...x2('mofetaJr'), ...x2('cuescoVolador'), ...x2('cuescoAndante'), ...x2('mochilaPedo'),
    ...x2('pedoProteico'), ...x2('hamburguesaDoble'), ...x2('kebabMadrugada'), ...x2('tupperSobras'),
    ...x2('cuescoExpulsor'), ...x2('pedoCaotico'),
    'reyKebab', 'pedoDefinitivo',
    ...x2('celador'), ...x2('paquito'), ...x2('victor'), ...x2('terapiaChoque')
  ],
  /* mazo por defecto del héroe Mario: movilidad y encanes + básicas */
  fuga: [
    ...x2('yogurPina'), ...x2('rabascoEncanado'), ...x2('gritoEncane'), ...x2('planDeFuga'),
    ...x2('tunelCuchara'), ...x2('gafasAfiladas'), ...x2('celadorEnvenenado'), ...x2('tatuajesManicomio'),
    ...x2('cauntuHacker'), ...x2('despachoDirector'), ...x2('celadoresPersiguen'), ...x2('chusFugado'),
    'eduardoSeguridad',
    ...x2('celador'), ...x2('paquito'), 'terapiaChoque'
  ],
  manonegra: [
    ...x2('quejaFormal'), ...x2('peucadorNovato'), ...x2('elizabeth'), ...x2('kebab'),
    ...x2('peucada'), ...x2('mandoGamer'), ...x2('rageQuit'), ...x2('gatoCiber'),
    ...x2('viciada'), ...x2('odioFiti'), ...x2('pedoAtomico'), ...x2('cincoGatos'),
    ...x2('top1'),
    'cauntu', 'kevin', 'ciborg', 'nikumanCard'
  ],
  /* mazo por defecto del héroe Jorge Monzo: motor de IMPRIMIR + básicas */
  monzo: [
    ...x2('impresora3d'), ...x2('calvoReluciente'), ...x2('exSemipro'), ...x2('manualImpresora'),
    ...x2('quedarseCalvo'), ...x2('pedoSilencioso'), ...x2('ataquePeter'), ...x2('viajeTurquia'),
    'echarDeathmatch', 'festivalRandom', 'peterGato', 'jugarClassic',
    ...x2('celador'), ...x2('paquito'), ...x2('victor'), ...x2('montreal'), ...x2('terapiaChoque')
  ]
};
