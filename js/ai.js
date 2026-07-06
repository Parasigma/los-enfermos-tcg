'use strict';
/* =========================================================
   IA ENEMIGA — juega el turno del jugador actual.
   Heurística: curva de maná, objetivos sensatos, trades
   gratis, presión a la cara. Los detalles por carta viven
   en cards.js (aiWants / aiTarget).
   ========================================================= */

const AIH = {
  delay: ms => new Promise(r => setTimeout(r, ms)),
  render: () => {},
  reveal: async card => {},   // la UI muestra la carta jugada por la IA
  notify: text => {}          // avisos (poder de héroe, etc.)
};

function aiWantsToPlay(g, p, c) {
  if (c.def.aiWants) return c.def.aiWants(g, p);
  return true;
}

function aiPickTarget(g, p, c) {
  if (!c.def.target) return null;
  if (c.def.aiTarget) return c.def.aiTarget(g, p);
  // genérico: primer objetivo válido
  const valid = validTargetsFor(g, p, c.def.target);
  return valid[0] || null;
}

async function aiTakeTurn(g) {
  const p = g.players[g.current];
  const opp = g.players[1 - g.current];
  await AIH.delay(1100);

  /* --- fase 1: jugar cartas --- */
  const skipped = new Set();
  let safety = 0;
  while (!g.over && safety++ < 40) {
    // moneda: solo si desbloquea una jugada
    const coin = p.hand.find(c => c.id === 'cerveza');
    if (coin && !skipped.has(coin.uid)) {
      const enables = p.hand.some(c =>
        c.id !== 'cerveza' && cardCost(c) === p.mana + 1 &&
        aiWantsToPlay(g, p, c)
      );
      if (enables) {
        await AIH.reveal(coin);
        playCard(g, p, coin.uid, null);
        AIH.render();
        await AIH.delay(600);
        continue;
      }
      skipped.add(coin.uid);
    }

    const playable = p.hand
      .filter(c => c.id !== 'cerveza' && !skipped.has(c.uid) &&
        canPlay(g, p, c) && aiWantsToPlay(g, p, c))
      .sort((a, b) => cardCost(b) - cardCost(a));
    if (!playable.length) break;

    const c = playable[0];
    const t = aiPickTarget(g, p, c);
    if (c.def.target && !t) { skipped.add(c.uid); continue; }
    await AIH.reveal(c);
    if (!playCard(g, p, c.uid, t)) { skipped.add(c.uid); continue; }
    AIH.render();
    await AIH.delay(900);
  }

  /* --- fase 2: ataques de esbirros --- */
  for (const m of [...p.board]) {
    if (g.over) break;
    if (!canAttackEntity(g, m)) continue;
    const targets = attackTargets(g, p.idx);
    if (!targets.length) break;
    let t = null;
    const mustHitTaunt = targets.every(x => !x.isHero);
    // trade gratis: mata y sobrevive
    const freeKills = targets.filter(x => !x.isHero && x.health <= m.attack && x.attack < m.health)
      .sort((a, b) => (b.attack + b.health) - (a.attack + a.health));
    if (freeKills.length) t = freeKills[0];
    else if (mustHitTaunt) t = targets.sort((a, b) => a.health - b.health)[0];
    else t = opp.hero; // agresivo: a la cara
    doAttack(g, m, t);
    AIH.render();
    await AIH.delay(1050);
  }

  /* --- fase 3: ataque del héroe con arma --- */
  if (!g.over && canAttackEntity(g, p.hero)) {
    const targets = attackTargets(g, p.idx);
    const taunts = targets.filter(x => !x.isHero);
    const t = targets.includes(opp.hero) ? opp.hero : (taunts[0] || null);
    if (t) {
      doAttack(g, p.hero, t);
      AIH.render();
      await AIH.delay(1050);
    }
  }

  /* --- fase 4: poder de héroe --- */
  if (!g.over && canUsePower(g, p)) {
    const pow = p.hero.def.power;
    let usar = true;
    let t = null;
    if (!pow.target) {
      /* poderes sin objetivo (Trapicheo, Ventosidad AoE): que el propio
         poder decida si merece la pena (aiWants) */
      usar = pow.aiWants ? pow.aiWants(g, p) : p.hand.length > 0;
    } else if (pow.aiTarget) {
      /* objetivo elegido por el propio poder según su lógica */
      t = pow.aiTarget(g, p);
      usar = !!t;
    } else {
      /* red de seguridad: apuntar al esbirro enemigo más peligroso o a la cara */
      const kill = opp.board.filter(m => m.health === 1).sort((a, b) => b.attack - a.attack);
      t = kill[0] || opp.hero;
    }
    if (usar) {
      AIH.notify(`${pow.icon} ${p.hero.def.name.split(',')[0]} usa «${pow.name}»`);
      await AIH.delay(900);
      usePower(g, p, t);
      AIH.render();
      await AIH.delay(800);
    }
  }

  if (!g.over) endTurn(g);
  AIH.render();
}
