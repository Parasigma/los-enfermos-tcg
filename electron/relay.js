'use strict';
/* =========================================================
   SERVIDOR RELÉ WEBSOCKET (corre en el host)
   No entiende de reglas: solo reenvía mensajes entre los dos
   asientos ('host' y 'guest'). El motor del juego corre en el
   renderer del host, que es la autoridad.
   ========================================================= */

const { WebSocketServer } = require('ws');

function startRelay(port = 8688) {
  const wss = new WebSocketServer({ port });
  const peers = { host: null, guest: null };
  /* mensajes enviados cuando el destinatario aún no está: se
     entregan en cuanto se conecte (máx. 50) */
  const buffer = { host: [], guest: [] };

  const other = role => (role === 'host' ? 'guest' : 'host');

  wss.on('connection', sock => {
    let role = null;

    sock.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }

      if (msg.t === 'hello') {
        role = msg.role === 'host' ? 'host' : 'guest';
        if (peers[role] && peers[role] !== sock) {
          try { peers[role].close(); } catch (e) {}
        }
        peers[role] = sock;
        /* entrega lo que le esperaba */
        for (const pending of buffer[role].splice(0)) {
          if (sock.readyState === 1) sock.send(pending);
        }
        /* avisa al contrario de que ya hay pareja */
        const o = peers[other(role)];
        if (o && o.readyState === 1) o.send(JSON.stringify({ t: 'peer-joined' }));
        return;
      }

      if (!role) return;
      const dest = peers[other(role)];
      const data = raw.toString();
      if (dest && dest.readyState === 1) dest.send(data);
      else if (buffer[other(role)].length < 50) buffer[other(role)].push(data);
    });

    sock.on('close', () => {
      if (role && peers[role] === sock) {
        peers[role] = null;
        const o = peers[other(role)];
        if (o && o.readyState === 1) o.send(JSON.stringify({ t: 'peer-left' }));
      }
    });
  });

  return {
    port,
    close() {
      try {
        for (const r of ['host', 'guest']) {
          if (peers[r]) peers[r].close();
        }
        wss.close();
      } catch (e) {}
    }
  };
}

module.exports = { startRelay };
