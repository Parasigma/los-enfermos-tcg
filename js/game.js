'use strict';
/* =========================================================
   MOTOR DEL JUEGO — reglas puras, sin DOM.
   La UI se engancha a través del objeto Hooks.
   ========================================================= */

let UID = 1;

const Hooks = {
  fx: null,       // (tipo, datos) -> animaciones
  log: null,      // (msg) -> crónica
  gameOver: null  // (winner) -> pantalla final
};

/* log(g, msg, meta): meta opcional describe QUIÉN hace QUÉ para la
   crónica visual — { k: tipo, a: {c:cardId}|{h:heroId}, b: ídem } */
function log(g, msg, meta) {
  g.log.push(msg);
  if (Hooks.log) Hooks.log(msg, meta);
}
function fx(type, data) {
  if (Hooks.fx) Hooks.fx(type, data);
}

/* ---------- construcción ---------- */

function makeCardInstance(id) {
  return { id, def: CARDS[id], costMod: 0, uid: UID++ };
}

function cardCost(c) {
  return Math.max(0, c.def.cost + c.costMod);
}

function makeMinion(id, owner) {
  const d = CARDS[id];
  return {
    id, def: d, owner, uid: UID++,
    attack: d.attack, health: d.health, maxHealth: d.health,
    taunt: !!d.taunt, charge: !!d.charge,
    sick: true, attacksThisTurn: 0, dead: false
  };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makePlayer(heroId, deckList, idx) {
  const deck = deckList.map(makeCardInstance);
  shuffle(deck);
  const deckIds = {
    director: 'sanatorio', nikuman: 'manonegra', kevin: 'mofeta', marioHero: 'fuga',
    jorgeHero: 'monzo', victorHero: 'motero', rabascoHero: 'picado',
    paquitoHero: 'mudanzas', marioSupremo: 'supremo'
  };
  return {
    idx, deckId: deckIds[heroId] || 'sanatorio',
    hero: {
      isHero: true, owner: idx, def: HEROES[heroId],
      hp: 30, maxHp: 30, weapon: null,
      attacksThisTurn: 0, powerUsed: false, dead: false
    },
    deck, hand: [], board: [],
    mana: 0, maxMana: 0, fatigue: 0, cardsPlayedThisTurn: 0,
    discardedThisTurn: 0, discardsTotal: 0
  };
}

/* oppDeckIds/oppHeroId: en multijugador el asiento 1 es el invitado;
   sin ellos, el asiento 1 es la IA con Nikuman y su baraja */
function newGame(playerDeckIds, playerHeroId, oppDeckIds, oppHeroId) {
  UID = 1;
  const g = {
    players: [
      makePlayer(playerHeroId || 'director', playerDeckIds || DECKS.sanatorio, 0),
      makePlayer(oppHeroId || 'nikuman', oppDeckIds || DECKS.manonegra, 1)
    ],
    current: 0, turn: 0, over: false, winner: null, log: [],
    env: null   // ENTORNO activo: { def, owner, turnsLeft } (capítulo 2)
  };
  drawCards(g, g.players[0], 3);
  drawCards(g, g.players[1], 4);
  /* la Cerveza Gratis (moneda del 2º jugador) solo la llevan los mazos
     fiesteros a los que les pega por lore: Kevin, Jorge y Paquito */
  const CERVEZA_DECKS = ['mofeta', 'monzo', 'mudanzas'];
  if (CERVEZA_DECKS.includes(g.players[1].deckId)) {
    g.players[1].hand.push(makeCardInstance('cerveza'));
  }
  log(g, '🔔 ¡Empieza la batalla por el Sanatorio San José!');
  startTurn(g, 0);
  return g;
}

/* ---------- nombres ---------- */

function heroName(p) { return p.hero.def.name; }
function entName(e) { return e.def.name; }

/* ---------- robo, descarte, fatiga ---------- */

function drawCards(g, p, n) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (p.deck.length === 0) {
      p.fatigue++;
      log(g, `😵 ${heroName(p)} no tiene cartas: ${p.fatigue} de daño por fatiga.`);
      dealDamage(g, p.hero, p.fatigue);
      continue;
    }
    const c = p.deck.pop();
    if (p.hand.length >= 10) {
      log(g, `🔥 ¡Mano llena! Se quema «${c.def.name}».`);
      fx('burn', { card: c, owner: p.idx });
    } else {
      p.hand.push(c);
      drawn.push(c);
      fx('draw', { owner: p.idx, uid: c.uid });
      /* IMPRIMIR «al robar»: cartas en tu mano (salvo la recién robada)
         que se activan cuando robas (mecánica de Jorge Monzo) */
      for (const h of [...p.hand]) {
        if (h !== c && h.def.onDraw) h.def.onDraw(g, p, h);
      }
    }
  }
  return drawn;
}

function discardRandom(g, p, n) {
  for (let i = 0; i < n; i++) {
    if (!p.hand.length) return;
    const j = Math.floor(Math.random() * p.hand.length);
    const c = p.hand.splice(j, 1)[0];
    p.discardedThisTurn++;
    p.discardsTotal++;
    log(g, `🗑️ ${heroName(p)} descarta «${c.def.name}».`, { k: 'discard', a: { c: c.id } });
    fx('discard', { card: c, owner: p.idx });
    /* ENCANE: la carta se activa al ser descartada */
    if (c.def.encane) {
      log(g, `🔥 ¡ENCANE! «${c.def.name}» se activa al ser descartada.`);
      fx('encane', { owner: p.idx });
      c.def.encane(g, p, c);
      checkDeaths(g);
      checkGameOver(g);
    }
    /* IMPRIMIR «al descartarse» */
    if (c.def.onDiscard) {
      c.def.onDiscard(g, p, c);
      checkDeaths(g);
      checkGameOver(g);
    }
  }
}

/* devuelve un esbirro a la mano de su dueño (mecánica de movilidad);
   costDelta ajusta el coste de la carta y def.onReturn se dispara al volver */
function returnToHand(g, m, costDelta = 0) {
  const p = g.players[m.owner];
  const i = p.board.indexOf(m);
  if (i < 0 || m.dead) return false;
  p.board.splice(i, 1);
  if (p.hand.length >= 10) {
    log(g, `🔥 ${m.def.name} no cabe en la mano: destruido.`);
    return true;
  }
  const c = makeCardInstance(m.id);
  c.costMod += costDelta;
  p.hand.push(c);
  log(g, `↩️ ${m.def.name} vuelve a la mano${costDelta ? ` (coste ${costDelta > 0 ? '+' : ''}${costDelta})` : ''}.`, { k: 'return', a: { c: m.id } });
  if (m.def.onReturn) m.def.onReturn(g, p, c);
  return true;
}

/* ---------- daño, curación, muertes ---------- */

function dealDamage(g, ent, n) {
  if (n <= 0 || !ent || ent.dead) return;
  if (ent.isHero) {
    ent.hp -= n;
    ent.tookDamage = true;   // para el logro «sin perder ni un punto de vida»
    fx('damage', { target: ent, amount: n });
    checkGameOver(g);
  } else {
    ent.health -= n;
    fx('damage', { target: ent, amount: n });
    notifyDamaged(g, ent);
    checkDeaths(g);
  }
}

/* «PICADO» (mecánica de Rabasco): si un esbirro sobrevive a un daño,
   se pica — def.onDamaged se dispara (una embestida de rabia, +ataque...) */
function notifyDamaged(g, m) {
  if (!m || m.isHero || m.dead || m.health <= 0) return;
  if (m.def.onDamaged) m.def.onDamaged(g, g.players[m.owner], m);
}

function heal(g, ent, n) {
  if (n <= 0 || !ent || ent.dead) return;
  let healed = 0;
  if (ent.isHero) {
    const before = ent.hp;
    ent.hp = Math.min(ent.maxHp, ent.hp + n);
    healed = ent.hp - before;
  } else {
    const before = ent.health;
    ent.health = Math.min(ent.maxHealth, ent.health + n);
    healed = ent.health - before;
  }
  if (healed > 0) fx('heal', { target: ent, amount: healed });
}

function checkDeaths(g) {
  let died = true;
  while (died) {
    died = false;
    for (const p of g.players) {
      const dead = p.board.filter(m => m.health <= 0 && !m.dead);
      for (const m of dead) {
        m.dead = true;
        died = true;
        const i = p.board.indexOf(m);
        if (i >= 0) p.board.splice(i, 1);
        fx('death', { minion: m, owner: p.idx });
        log(g, `💀 Muere ${m.def.name}.`, { k: 'death', a: { c: m.id } });
        if (m.def.deathrattle) m.def.deathrattle(g, p, m);
        if (m.mochila) {
          log(g, `🎒 ¡El pedo de mochila de ${m.def.name} estalla!`);
          const opp = g.players[1 - p.idx];
          for (const x of [...opp.board]) dealDamage(g, x, 1);
        }
      }
    }
  }
}

/* «Olor a Peo»: el esbirro apestado recibe 1 de daño al final
   de cada turno de su dueño (mecánica de la baraja del Mofeta) */
function applyStench(g, m) {
  if (!m || m.isHero || m.dead || m.stench) return;
  m.stench = true;
  log(g, `💨 ${m.def.name} queda impregnado de Olor a Peo.`, { k: 'stench', a: { c: m.id } });
  fx('stench', { minion: m });
}

function summon(g, p, id) {
  if (p.board.length >= 7) return null;
  const m = makeMinion(id, p.idx);
  p.board.push(m);
  fx('summon', { minion: m, owner: p.idx });
  return m;
}

/* CONTROL MENTAL (mazo del Paciente Supremo): un esbirro enemigo cambia
   de bando — cruza el tablero convencido de que la culpa es de Fiti */
function takeControl(g, p, m) {
  const opp = g.players[1 - p.idx];
  const i = opp.board.indexOf(m);
  if (i < 0 || m.dead || p.board.length >= 7) return false;
  opp.board.splice(i, 1);
  m.owner = p.idx;
  m.sick = true;
  m.attacksThisTurn = 0;
  p.board.push(m);
  log(g, `🎩 ${m.def.name} cambia de bando. «Ha sido cosa de Fiti», murmura.`, { k: 'control', a: { c: m.id } });
  fx('summon', { minion: m, owner: p.idx });
  return true;
}

/* ---------- IMPRIMIR (mazo de Jorge Monzo) ----------
   Genera una carta «impresa en 3D» (ficha monocroma morada, floja pero
   útil) en la mano. Distintas cartas la disparan en distintos momentos
   (al jugarse, al final del turno, al atacar, al robar...). */
const IMPRESOS = ['impFigura', 'impCubo', 'impGafas', 'impHerramienta'];

function imprimir(g, p, id) {
  if (p.hand.length >= 10) {
    log(g, `🖨️ La impresora se atasca: no cabe «${CARDS[id].name}» en la mano.`);
    return null;
  }
  const c = makeCardInstance(id);
  p.hand.push(c);
  log(g, `🖨️ ${heroName(p)} imprime en 3D: «${c.def.name}».`);
  fx('print', { owner: p.idx, uid: c.uid });
  return c;
}

function imprimirRandom(g, p) {
  return imprimir(g, p, IMPRESOS[Math.floor(Math.random() * IMPRESOS.length)]);
}

/* ---------- objetivos ---------- */

function validTargetsFor(g, p, kind) {
  const me = p, opp = g.players[1 - p.idx];
  switch (kind) {
    case 'any': return [me.hero, opp.hero, ...me.board, ...opp.board];
    case 'minion': return [...me.board, ...opp.board];
    case 'friendlyMinion': return [...me.board];
    case 'enemyMinion': return [...opp.board];
    case 'enemy': return [opp.hero, ...opp.board];
  }
  return [];
}

/* ---------- jugar cartas ---------- */

function canPlay(g, p, c) {
  if (g.over) return false;
  if (cardCost(c) > p.mana) return false;
  if (c.def.type === 'minion' && p.board.length >= 7) return false;
  if (c.def.target && validTargetsFor(g, p, c.def.target).length === 0) return false;
  return true;
}

function playCard(g, p, uid, target) {
  const i = p.hand.findIndex(c => c.uid === uid);
  if (i < 0) return false;
  const c = p.hand[i];
  if (!canPlay(g, p, c)) return false;
  if (c.def.target) {
    if (!target || !validTargetsFor(g, p, c.def.target).includes(target)) return false;
  }

  p.mana -= cardCost(c);
  p.hand.splice(i, 1);
  const combo = p.cardsPlayedThisTurn > 0;
  p.cardsPlayedThisTurn++;
  log(g, `🎴 ${heroName(p)} juega «${c.def.name}».`,
    { k: 'play', a: { c: c.id }, b: target ? (target.isHero ? { h: target.def.id } : { c: target.id }) : undefined });
  fx('play', { card: c, owner: p.idx });

  if (c.def.type === 'minion') {
    const m = makeMinion(c.id, p.idx);
    p.board.push(m);
    fx('summon', { minion: m, owner: p.idx });
    if (c.def.battlecry) c.def.battlecry(g, p, m, target, combo);
    checkDeaths(g);
  } else if (c.def.type === 'spell') {
    fx('spell', { card: c, owner: p.idx, target });
    c.def.spell(g, p, target, combo);
    checkDeaths(g);
  } else if (c.def.type === 'weapon') {
    p.hero.weapon = { def: c.def, attack: c.def.attack, durability: c.def.durability };
    fx('equip', { owner: p.idx });
  } else if (c.def.type === 'entorno') {
    setEnvironment(g, p, c.def);
  }

  checkGameOver(g);
  return true;
}

/* ---------- ENTORNO (capítulo 2) ----------
   Cartas que transforman el tablero y las reglas mientras están activas
   (la «expansión de dominio» del manicomio). Cada mazo tendrá la suya.
   La carta define:
   - duracion:  turnos del dueño que permanece (por defecto 3)
   - envStart(g, p):        al desplegarse
   - envTurn(g, pDueño, pTurno): al empezar CADA turno mientras dura
   - envEnd(g):             al agotarse o ser sustituido por otro entorno
   Solo puede haber UN entorno activo: el nuevo expulsa al anterior. */

function setEnvironment(g, p, def) {
  if (g.env && g.env.def.envEnd) g.env.def.envEnd(g);
  g.env = { def, owner: p.idx, turnsLeft: def.duracion || 3 };
  log(g, `🌐 ${heroName(p)} despliega su dominio: «${def.name}».`, { k: 'env', a: { c: def.id } });
  fx('env', { id: def.id, owner: p.idx });
  if (def.envStart) def.envStart(g, p);
  checkDeaths(g);
  checkGameOver(g);
}

function clearEnvironment(g) {
  if (!g.env) return;
  log(g, `🌫️ El entorno «${g.env.def.name}» se desvanece.`);
  if (g.env.def.envEnd) g.env.def.envEnd(g);
  g.env = null;
  fx('envEnd', {});
}

/* ---------- combate ---------- */

function canAttackEntity(g, ent) {
  if (g.over || ent.dead) return false;
  if (ent.isHero) {
    return !!ent.weapon && ent.weapon.attack > 0 && ent.attacksThisTurn === 0;
  }
  return ent.attack > 0 && ent.attacksThisTurn === 0 && (!ent.sick || ent.charge);
}

function attackTargets(g, pIdx) {
  const opp = g.players[1 - pIdx];
  const taunts = opp.board.filter(m => m.taunt);
  return taunts.length ? taunts : [opp.hero, ...opp.board];
}

function doAttack(g, attacker, target) {
  if (!canAttackEntity(g, attacker)) return false;
  if (!attackTargets(g, attacker.owner).includes(target)) return false;

  attacker.attacksThisTurn++;
  const atkVal = attacker.isHero ? attacker.weapon.attack : attacker.attack;
  const retVal = target.isHero ? 0 : target.attack;
  log(g, `⚔️ ${entName(attacker)} ataca a ${entName(target)}.`, {
    k: 'attack',
    a: attacker.isHero ? { h: attacker.def.id } : { c: attacker.id },
    b: target.isHero ? { h: target.def.id } : { c: target.id }
  });
  fx('attack', { attacker, target });

  if (target.isHero) {
    target.hp -= atkVal;
    target.tookDamage = true;
    fx('damage', { target, amount: atkVal });
  } else {
    target.health -= atkVal;
    fx('damage', { target, amount: atkVal });
    notifyDamaged(g, target);
  }
  if (retVal > 0) {
    if (attacker.isHero) { attacker.hp -= retVal; attacker.tookDamage = true; }
    else {
      attacker.health -= retVal;
      notifyDamaged(g, attacker);
    }
    fx('damage', { target: attacker, amount: retVal });
  }

  if (attacker.isHero && attacker.weapon) {
    attacker.weapon.durability--;
    if (attacker.weapon.durability <= 0) {
      log(g, `🔨 Se rompe «${attacker.weapon.def.name}».`);
      attacker.weapon = null;
    }
  }

  /* IMPRIMIR «al atacar» (esbirros de Jorge Monzo) */
  if (attacker.def && attacker.def.onAttack && !attacker.dead) {
    attacker.def.onAttack(g, g.players[attacker.owner], attacker, target);
  }

  checkDeaths(g);
  checkGameOver(g);
  return true;
}

/* ---------- poder de héroe ---------- */

function canUsePower(g, p) {
  return !g.over && !p.hero.powerUsed && p.mana >= p.hero.def.power.cost;
}

function usePower(g, p, target) {
  if (!canUsePower(g, p)) return false;
  const pow = p.hero.def.power;
  if (pow.target) {
    if (!target || !validTargetsFor(g, p, pow.target).includes(target)) return false;
  }
  p.mana -= pow.cost;
  p.hero.powerUsed = true;
  log(g, `✨ ${heroName(p)} usa «${pow.name}».`,
    { k: 'power', a: { h: p.hero.def.id }, b: target ? (target.isHero ? { h: target.def.id } : { c: target.id }) : undefined });
  fx('power', { hero: p.hero.def.id, owner: p.idx, target });
  pow.use(g, p, target);
  checkDeaths(g);
  checkGameOver(g);
  return true;
}

/* ---------- turnos ---------- */

function startTurn(g, pIdx) {
  g.current = pIdx;
  g.turn++;
  const p = g.players[pIdx];
  p.maxMana = Math.min(10, p.maxMana + 1);
  p.mana = p.maxMana;
  p.cardsPlayedThisTurn = 0;
  p.discardedThisTurn = 0;
  p.hero.powerUsed = false;
  p.hero.attacksThisTurn = 0;
  for (const m of p.board) { m.sick = false; m.attacksThisTurn = 0; }
  log(g, `— 🕰️ Turno de ${heroName(p)} (${p.maxMana} de maná) —`);
  drawCards(g, p, 1);
  /* el ENTORNO activo actúa al empezar cada turno */
  if (g.env && g.env.def.envTurn) {
    g.env.def.envTurn(g, g.players[g.env.owner], p);
    checkDeaths(g);
    checkGameOver(g);
  }
}

function endTurn(g) {
  const p = g.players[g.current];
  for (const m of [...p.board]) {
    if (m.def.endTurn && !m.dead) m.def.endTurn(g, p, m);
  }
  /* el Olor a Peo pasa factura al final del turno del dueño */
  for (const m of [...p.board]) {
    if (m.stench && !m.dead) {
      log(g, `💨 ${m.def.name} sufre 1 de daño por el Olor a Peo.`);
      dealDamage(g, m, 1);
    }
  }
  checkDeaths(g);
  checkGameOver(g);
  /* el ENTORNO se consume al final de cada turno de su dueño */
  if (g.env && g.env.owner === g.current) {
    g.env.turnsLeft--;
    if (g.env.turnsLeft <= 0) clearEnvironment(g);
  }
  if (!g.over) startTurn(g, 1 - g.current);
}

/* ---------- fin de partida ---------- */

function checkGameOver(g) {
  if (g.over) return;
  const dead0 = g.players[0].hero.hp <= 0;
  const dead1 = g.players[1].hero.hp <= 0;
  if (dead0 || dead1) {
    g.over = true;
    g.winner = (dead0 && dead1) ? -1 : (dead0 ? 1 : 0);
    if (g.winner === 0) log(g, '🏆 ¡VICTORIA del Sanatorio San José!');
    else if (g.winner === 1) log(g, '💀 La Mano Negra se impone...');
    else log(g, '🤯 ¡Doble K.O.! El manicomio se queda sin director y sin pullador.');
    if (Hooks.gameOver) Hooks.gameOver(g.winner);
  }
}
