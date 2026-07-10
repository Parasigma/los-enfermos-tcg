'use strict';
/* Auditoría de equilibrio: partidas IA vs IA headless con el motor real.
   Uso: node scripts/sim-balance.js [partidas_por_cruce=200]
   Imprime: winrate de cada rival de la historia contra los mazos del
   jugador, round-robin global de todos los mazos y ventaja de asiento. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, Date, performance: { now: () => Date.now() } };
vm.createContext(ctx);
for (const f of ['js/cards.js', 'js/game.js', 'js/ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
  AIH.delay = () => Promise.resolve();
  AIH.render = () => {};
  AIH.reveal = async () => {};
  AIH.notify = () => {};
  async function simMatch(deckA, heroA, deckB, heroB, hpB) {
    const g = newGame(DECKS[deckA], heroA, DECKS[deckB], heroB);
    if (hpB) { g.players[1].hero.hp = g.players[1].hero.maxHp = hpB; }
    let guard = 0;
    while (!g.over && guard++ < 300) { await aiTakeTurn(g); }
    return g.over ? g.winner : -1;   // -1 = empate/atasco
  }
  async function simSeries(deckA, heroA, deckB, heroB, n, hpB) {
    let a = 0, b = 0, d = 0;
    for (let i = 0; i < n; i++) {
      const w = await simMatch(deckA, heroA, deckB, heroB, hpB);
      if (w === 0) a++; else if (w === 1) b++; else d++;
    }
    return { a, b, d };
  }
`, ctx, { filename: 'harness' });

const HERO_OF = {
  sanatorio: 'director', manonegra: 'nikuman', mofeta: 'kevin', fuga: 'marioHero',
  monzo: 'jorgeHero', motero: 'victorHero', picado: 'rabascoHero',
  mudanzas: 'paquitoHero', supremo: 'marioSupremo'
};

(async () => {
  const simSeries = ctx.simSeries;
  const N = Number(process.argv[2] || 200);

  console.log('=== 1) HISTORIA: enemigo (asiento IA rival) vs mazos del jugador ===');
  console.log('   (winrate del ENEMIGO; el jugador humano juega mejor que la IA,');
  console.log('    así que 45-65% es zona sana; >70% = muro, <35% = paseo)');
  const story = [
    ['nikuman', 'manonegra', null],
    ['kevin', 'mofeta', null],
    ['jorge', 'monzo', null],
    ['victor', 'motero', null],
    ['rabasco', 'picado', null],
    ['paquito', 'mudanzas', null],
    ['MARIO BOSS', 'supremo', 32]
  ];
  /* mazos plausibles del jugador en ese punto de la campaña */
  const playerAt = {
    manonegra: ['sanatorio'],
    mofeta: ['sanatorio', 'manonegra'],
    monzo: ['sanatorio', 'manonegra', 'mofeta'],
    motero: ['sanatorio', 'mofeta', 'monzo'],
    picado: ['sanatorio', 'monzo', 'motero'],
    mudanzas: ['sanatorio', 'monzo', 'picado_player'],
    supremo: ['sanatorio', 'monzo', 'mudanzas', 'motero']
  };
  for (const [name, deck, hp] of story) {
    const opts = playerAt[deck] || ['sanatorio'];
    const rows = [];
    for (const pd of opts) {
      const pdeck = pd === 'picado_player' ? 'picado' : pd;
      const r = await simSeries(pdeck, HERO_OF[pdeck], deck, HERO_OF[deck], N, hp);
      const wr = (100 * r.b / (r.a + r.b + r.d)).toFixed(0);
      rows.push(`${pdeck}:${wr}%`);
    }
    console.log(`  ${name.padEnd(11)} [${deck.padEnd(9)}${hp ? ' hp' + hp : ''}]  gana al jugador con -> ${rows.join('  ')}`);
  }

  console.log('\n=== 2) ROUND-ROBIN de todos los mazos (poder global, % victorias) ===');
  const decks = Object.keys(HERO_OF);
  const wins = {}, games = {};
  decks.forEach(d => { wins[d] = 0; games[d] = 0; });
  const M = Math.max(60, Math.floor(N / 3));
  for (let i = 0; i < decks.length; i++) {
    for (let j = i + 1; j < decks.length; j++) {
      const A = decks[i], B = decks[j];
      /* dos orientaciones para anular la ventaja de asiento */
      const r1 = await simSeries(A, HERO_OF[A], B, HERO_OF[B], M);
      const r2 = await simSeries(B, HERO_OF[B], A, HERO_OF[A], M);
      wins[A] += r1.a + r2.b; wins[B] += r1.b + r2.a;
      games[A] += 2 * M; games[B] += 2 * M;
    }
  }
  decks.map(d => [d, 100 * wins[d] / games[d]])
    .sort((x, y) => y[1] - x[1])
    .forEach(([d, w]) => console.log(`  ${d.padEnd(10)} ${w.toFixed(1)}%`));

  console.log('\n=== 3) Ventaja de asiento (sanatorio espejo) ===');
  const mir = await simSeries('sanatorio', 'director', 'sanatorio', 'director', N);
  console.log(`  1º jugador ${(100 * mir.a / (mir.a + mir.b + mir.d)).toFixed(0)}% · 2º ${(100 * mir.b / (mir.a + mir.b + mir.d)).toFixed(0)}% · empates ${mir.d}`);
})().catch(e => { console.error('ERROR SIM:', e); process.exit(1); });
