'use strict';
/* =========================================================
   JUEGO ONLINE 1v1 — HOST AUTORITATIVO
   ---------------------------------------------------------
   - El host levanta un relé WebSocket local (Electron, :8688).
   - El motor SOLO corre en el host. El invitado recibe una
     vista espejada del estado (él siempre es el jugador 0 de
     su vista, y NUNCA ve la mano ni el mazo del rival) y envía
     acciones que el host valida con el motor real.
   - El invitado puede unirse desde la app o desde un navegador.
   ========================================================= */

const MP_PORT = 8688;

/* ================= SERIALIZACIÓN (pura, sin DOM) ================= */

/* estado visible para un asiento concreto (viewer = 0|1 real) */
function serializeFor(g, viewer) {
  const mapPlayer = (p, own) => ({
    hero: {
      id: p.hero.def.id, hp: p.hero.hp, maxHp: p.hero.maxHp,
      powerUsed: p.hero.powerUsed, attacksThisTurn: p.hero.attacksThisTurn,
      weapon: p.hero.weapon
        ? { id: p.hero.weapon.def.id, attack: p.hero.weapon.attack, durability: p.hero.weapon.durability }
        : null
    },
    board: p.board.map(m => ({
      id: m.id, uid: m.uid, attack: m.attack, health: m.health, maxHealth: m.maxHealth,
      taunt: m.taunt, charge: m.charge, sick: m.sick, attacksThisTurn: m.attacksThisTurn,
      stench: !!m.stench, mochila: !!m.mochila
    })),
    hand: own ? p.hand.map(c => ({ id: c.id, uid: c.uid, costMod: c.costMod })) : p.hand.length,
    deckCount: p.deck.length,
    mana: p.mana, maxMana: p.maxMana,
    cardsPlayedThisTurn: p.cardsPlayedThisTurn, fatigue: p.fatigue
  });
  const me = g.players[viewer], opp = g.players[1 - viewer];
  return {
    turn: g.turn, over: g.over,
    current: g.current === viewer ? 0 : 1,
    winner: g.winner == null ? null : (g.winner === -1 ? -1 : (g.winner === viewer ? 0 : 1)),
    players: [mapPlayer(me, true), mapPlayer(opp, false)]
  };
}

/* reconstruye un objeto de juego renderizable a partir de la vista */
function stateToGame(s) {
  const mkHero = (h, owner) => ({
    isHero: true, owner, def: HEROES[h.id],
    hp: h.hp, maxHp: h.maxHp, powerUsed: h.powerUsed,
    attacksThisTurn: h.attacksThisTurn, dead: false,
    weapon: h.weapon
      ? { def: CARDS[h.weapon.id], attack: h.weapon.attack, durability: h.weapon.durability }
      : null
  });
  const mkMinion = (m, owner) => Object.assign({}, m, { def: CARDS[m.id], owner, dead: false });
  const mkPlayer = (p, idx) => ({
    idx, deckId: 'online',
    hero: mkHero(p.hero, idx),
    board: p.board.map(m => mkMinion(m, idx)),
    hand: Array.isArray(p.hand)
      ? p.hand.map(c => ({ id: c.id, uid: c.uid, costMod: c.costMod, def: CARDS[c.id] }))
      : new Array(p.hand).fill(null),
    deck: new Array(p.deckCount).fill(null),
    mana: p.mana, maxMana: p.maxMana,
    cardsPlayedThisTurn: p.cardsPlayedThisTurn, fatigue: p.fatigue
  });
  return {
    players: [mkPlayer(s.players[0], 0), mkPlayer(s.players[1], 1)],
    current: s.current, turn: s.turn, over: s.over, winner: s.winner, log: []
  };
}

/* evento visual → forma serializable, con los índices girados para el viewer */
function mpSerializeEvent(type, data, viewer) {
  const flip = i => (i === viewer ? 0 : 1);
  const ref = e => (e ? (e.isHero ? { h: flip(e.owner) } : { m: e.uid }) : null);
  switch (type) {
    case 'damage':
    case 'heal': return { type, target: ref(data.target), amount: data.amount };
    case 'death':
    case 'summon': return { type, uid: data.minion.uid, owner: flip(data.owner) };
    case 'attack': return { type, attacker: ref(data.attacker), target: ref(data.target) };
    case 'play': return { type, cardId: data.card.id, owner: flip(data.owner) };
    case 'spell': return { type, cardId: data.card.id, owner: flip(data.owner), target: ref(data.target) };
    case 'power': return { type, hero: data.hero, owner: flip(data.owner), target: ref(data.target) };
    case 'stench': return { type, uid: data.minion.uid };
    case 'equip':
    case 'encane':
    case 'draw':
    case 'burn':
    case 'discard': return { type, owner: flip(data.owner) };
  }
  return null;
}

/* ================= CLIENTE / PROTOCOLO ================= */

const MP = {
  active: false,      // partida online en curso
  role: null,         // 'host' | 'guest'
  sock: null,
  events: [],         // eventos visuales pendientes de enviar (host)
  logs: [],           // líneas de crónica pendientes (host)
  teesInstalled: false,
  ended: false,

  /* --- conexión --- */

  connect(ip, role) {
    this.role = role;
    const s = new WebSocket(`ws://${ip}:${MP_PORT}`);
    this.sock = s;
    s.onopen = () => {
      s.send(JSON.stringify({ t: 'hello', role }));
      if (role === 'guest') {
        const play = activePlay();
        s.send(JSON.stringify({ t: 'join', deck: play.cards, hero: play.hero }));
        mpSetStatus('join-status', 'Conectado. Esperando a que el host arranque la partida...');
      }
    };
    s.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      this.onMsg(msg);
    };
    s.onerror = () => {
      mpSetStatus(role === 'host' ? 'host-status' : 'join-status',
        '❌ No se pudo conectar. Revisa la IP y que el host tenga la partida creada.');
    };
    s.onclose = () => {
      if (this.active && !this.ended) {
        banner('❌ Conexión perdida');
        setTimeout(() => mpLeave(), 1500);
      }
    };
  },

  /* --- mensajes --- */

  onMsg(msg) {
    if (this.role === 'host') {
      if (msg.t === 'join') this.startHostedGame(msg);
      else if (msg.t === 'action') this.onGuestAction(msg.a);
      else if (msg.t === 'peer-left') this.onPeerLeft();
    } else {
      if (msg.t === 'state') this.applyState(msg);
      else if (msg.t === 'peer-left') this.onPeerLeft();
    }
  },

  onPeerLeft() {
    if (this.active && !this.ended) {
      banner('❌ Tu rival se ha desconectado');
      setTimeout(() => mpLeave(), 1600);
    } else {
      mpSetStatus('host-status', 'El rival se ha desconectado. Esperando a otro...');
    }
  },

  /* --- HOST: partida y autoridad --- */

  startHostedGame(join) {
    const play = activePlay();
    const guestDeck = isValidDeck(join.deck) ? join.deck : DECKS.sanatorio;
    const guestHero = HEROES[join.hero] ? join.hero : 'director';
    this.installTees();
    this.active = true;
    this.ended = false;
    busy = false;
    hideAllScreens();
    document.getElementById('log').innerHTML = '';
    G = newGame(play.cards, play.hero, guestDeck, guestHero);
    render();
    banner('🌐 ¡Rival conectado! Empiezas tú');
    this.broadcast();
  },

  /* referencias de la vista del invitado → entidades reales del host */
  resolveGuestRef(t) {
    if (!t) return null;
    if (t.h != null) return G.players[t.h === 0 ? 1 : 0].hero;
    for (const p of G.players) {
      const m = p.board.find(x => x.uid === t.m);
      if (m) return m;
    }
    return null;
  },

  onGuestAction(a) {
    if (!this.active || !G || G.over || G.current !== 1) { this.broadcast(); return; }
    const p = G.players[1];
    if (a.t === 'end') {
      endTurn(G);
      if (!G.over && G.current === 0) banner('¡Tu turno! 🌐');
    } else if (a.t === 'play') {
      playCard(G, p, a.uid, this.resolveGuestRef(a.target));
    } else if (a.t === 'attack') {
      const att = a.attacker.h != null ? p.hero : p.board.find(m => m.uid === a.attacker.m);
      const tgt = this.resolveGuestRef(a.target);
      if (att && tgt) doAttack(G, att, tgt);
    } else if (a.t === 'power') {
      usePower(G, p, this.resolveGuestRef(a.target));
    }
    render();
    this.broadcast();
  },

  /* envía el estado (vista del invitado) + eventos + crónica */
  broadcast() {
    if (!this.active || this.role !== 'host') return;
    if (!this.sock || this.sock.readyState !== 1) return;
    this.sock.send(JSON.stringify({
      t: 'state',
      s: serializeFor(G, 1),
      ev: this.events.splice(0),
      log: this.logs.splice(0)
    }));
  },

  /* llamado por la UI del host tras cada acción local */
  afterLocalAction() {
    if (this.active && this.role === 'host') this.broadcast();
  },

  /* intercepta los hooks del motor para capturar eventos y revelar
     las cartas que juega el rival (en el host, el asiento 1) */
  installTees() {
    if (this.teesInstalled) return;
    this.teesInstalled = true;
    const baseFx = Hooks.fx, baseLog = Hooks.log;
    Hooks.fx = (type, data) => {
      baseFx(type, data);
      if (MP.active && MP.role === 'host') {
        const ev = mpSerializeEvent(type, data, 1);
        if (ev) MP.events.push(ev);
        if (type === 'play' && data.owner === 1) {
          AIH.reveal({ def: CARDS[data.card.id], id: data.card.id, costMod: 0 });
        }
      }
    };
    Hooks.log = msg => {
      baseLog(msg);
      if (MP.active && MP.role === 'host') MP.logs.push(msg);
    };
  },

  /* --- INVITADO: aplicar estado y reproducir eventos --- */

  findEnt(ref) {
    if (!ref || !G) return null;
    if (ref.h != null) return G.players[ref.h].hero;
    for (const p of G.players) {
      const m = p.board.find(x => x.uid === ref.m);
      if (m) return m;
    }
    return null;
  },

  async applyState(msg) {
    const first = !this.active;
    const prevCurrent = G && this.active ? G.current : 1;
    this.active = true;
    if (first) {
      hideAllScreens();
      document.getElementById('log').innerHTML = '';
    }

    /* revela la carta que acaba de jugar el rival (con giro) */
    for (const ev of msg.ev || []) {
      if (ev.type === 'play' && ev.owner === 1) {
        await AIH.reveal({ def: CARDS[ev.cardId], id: ev.cardId, costMod: 0 });
      }
    }

    G = stateToGame(msg.s);
    busy = false;
    render();

    /* reproduce los efectos visuales sobre el estado nuevo */
    for (const ev of msg.ev || []) {
      const d = ev;
      switch (d.type) {
        case 'damage': fxQueue.push({ type: 'damage', data: { target: this.findEnt(d.target), amount: d.amount } }); break;
        case 'heal': fxQueue.push({ type: 'heal', data: { target: this.findEnt(d.target), amount: d.amount } }); break;
        case 'death': Sfx.play('death'); break;
        case 'summon': fxQueue.push({ type: 'summon', data: { minion: this.findEnt({ m: d.uid }) || { uid: d.uid }, owner: d.owner } }); break;
        case 'attack': fxQueue.push({ type: 'attack', data: { attacker: this.findEnt(d.attacker) || {}, target: this.findEnt(d.target) || {} } }); break;
        case 'spell': fxQueue.push({ type: 'spell', data: { card: { id: d.cardId }, owner: d.owner, target: this.findEnt(d.target) } }); break;
        case 'power': fxQueue.push({ type: 'power', data: { hero: d.hero, owner: d.owner, target: this.findEnt(d.target) } }); break;
        case 'stench': { const m = this.findEnt({ m: d.uid }); if (m) fxQueue.push({ type: 'stench', data: { minion: m } }); break; }
        case 'equip': fxQueue.push({ type: 'equip', data: { owner: d.owner } }); break;
        case 'encane': fxQueue.push({ type: 'encane', data: { owner: d.owner } }); break;
        case 'draw': Sfx.play('draw'); break;
      }
    }
    flushFx();

    /* crónica */
    for (const line of msg.log || []) {
      if (Hooks.log) Hooks.log(line);
    }

    /* avisos de turno y final */
    if (first) banner('🌐 ¡Partida online! ' + (G.current === 0 ? 'Empiezas tú' : 'Empieza el rival'));
    else if (G.current === 0 && prevCurrent !== 0 && !G.over) banner('¡Tu turno! 🌐');

    if (G.over && !this.ended) {
      this.ended = true;
      setTimeout(() => showEnd(G.winner), 900);
    }
  },

  /* --- INVITADO: enviar acciones --- */

  sendAction(a) {
    if (this.sock && this.sock.readyState === 1) {
      this.sock.send(JSON.stringify({ t: 'action', a }));
    }
  },

  refFor(ent) { return ent.isHero ? { h: ent.owner } : { m: ent.uid }; }
};

/* ================= INTERCEPTORES PARA LA UI =================
   Devuelven true si la acción se envió al host (modo invitado):
   la UI no debe aplicarla localmente. */

function mpGuestPlay(card, target) {
  if (!MP.active || MP.role !== 'guest') return false;
  MP.sendAction({ t: 'play', uid: card.uid, target: target ? MP.refFor(target) : null });
  busy = true;
  render();
  return true;
}

function mpGuestAttack(attacker, target) {
  if (!MP.active || MP.role !== 'guest') return false;
  MP.sendAction({ t: 'attack', attacker: MP.refFor(attacker), target: MP.refFor(target) });
  busy = true;
  render();
  return true;
}

function mpGuestPower(target) {
  if (!MP.active || MP.role !== 'guest') return false;
  MP.sendAction({ t: 'power', target: MP.refFor(target) });
  busy = true;
  render();
  return true;
}

function mpGuestEnd() {
  if (!MP.active || MP.role !== 'guest') return false;
  MP.sendAction({ t: 'end' });
  busy = true;
  render();
  return true;
}

/* ================= UI DE LA PANTALLA ONLINE ================= */

function mpSetStatus(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* copia texto al portapapeles con confirmación visual en el botón */
async function mpCopy(text, btn) {
  let ok = false;
  /* en la app, portapapeles nativo de Electron (infalible) */
  if (window.electronMP && window.electronMP.copy) {
    try { ok = window.electronMP.copy(text); } catch (e) {}
  }
  try {
    if (!ok) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (e) {
    /* respaldo para contextos sin clipboard API */
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (e2) {}
  }
  if (btn) {
    btn.textContent = ok ? '✔ copiada' : '❌';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '📋 copiar'; btn.classList.remove('copied'); }, 1400);
  }
}

/* pinta tus IPs como chips con botón de copiar (las de red local primero) */
function mpRenderIPs(ips) {
  const box = document.getElementById('host-ips');
  box.innerHTML = '';
  if (!ips || !ips.length) return;
  const sorted = [...ips].sort((a, b) => {
    const score = ip => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
    return score(a) - score(b);
  });
  const label = document.createElement('div');
  label.className = 'ip-label';
  label.textContent = 'Tu IP (pásasela a tu rival):';
  box.appendChild(label);
  for (const ip of sorted) {
    const chip = document.createElement('span');
    chip.className = 'ip-chip';
    chip.innerHTML = `<code>${ip}</code><button class="ip-copy">📋 copiar</button>`;
    chip.querySelector('.ip-copy').addEventListener('click', e => mpCopy(ip, e.target));
    box.appendChild(chip);
  }
}

function mpUpdateOnlineUI() {
  const isApp = !!window.electronMP;
  document.getElementById('btn-host').disabled = !isApp;
  document.getElementById('host-ips').innerHTML = '';
  mpSetStatus('host-status', isApp
    ? 'Crea la partida y comparte tu IP con tu rival.'
    : 'Crear partida requiere la aplicación de escritorio (npm start). Desde el navegador solo puedes unirte.');
  mpSetStatus('join-status', '');
  /* en la app, muestra tus IPs desde el principio */
  if (isApp && window.electronMP.ips) {
    window.electronMP.ips().then(info => mpRenderIPs(info.ips)).catch(() => {});
  }
}

async function mpHostStart() {
  if (!window.electronMP) return;
  try {
    const info = await window.electronMP.host();
    mpRenderIPs(info.ips);
    mpSetStatus('host-status',
      '✅ Partida creada. Copia tu IP, pásasela a tu rival y que le dé a «Unirse». Esperando rival...');
    MP.connect('127.0.0.1', 'host');
  } catch (e) {
    mpSetStatus('host-status', '❌ No se pudo crear el servidor: ' + e.message);
  }
}

function mpJoin(ip) {
  if (!ip) { mpSetStatus('join-status', 'Escribe la IP del host (ej: 192.168.1.30).'); return; }
  mpSetStatus('join-status', 'Conectando con ' + ip + '...');
  MP.connect(ip, 'guest');
}

/* salir del modo online y volver al menú */
function mpLeave() {
  MP.active = false;
  MP.ended = false;
  MP.role = null;
  if (MP.sock) {
    try { MP.sock.close(); } catch (e) {}
    MP.sock = null;
  }
  if (window.electronMP) window.electronMP.stop();
  busy = false;
  showScreen('main-menu');
}
