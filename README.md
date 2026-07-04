# 🏥 LOS ENFERMOS: El TCG del Manicomio

Un juego de cartas 1 vs 1 al estilo Hearthstone con la temática de **Los Enfermos**.
Tú eres **Rafael Rovira «El Director»** defendiendo el Sanatorio San José contra
**Nikuman «La Mano Negra»** y el plan de ciborgización de Cauntu.

## 🌍 Jugar online desde cualquier dispositivo

**https://parasigma.github.io/los-enfermos-tcg/**

Funciona en cualquier navegador: PC, Android, iPhone/iPad... En el móvil,
gira a horizontal. En iPhone: Safari → Compartir → **Añadir a pantalla de
inicio** para jugarlo a pantalla completa como una app. El progreso se
guarda en cada dispositivo.

Nota: en la versión web pública el modo «Jugar Online» por IP no está
disponible (el navegador bloquea conexiones locales desde páginas https);
para el 1v1 online usa la app de escritorio, la APK o el navegador en
`http://` local.

Repositorio: https://github.com/Parasigma/los-enfermos-tcg

## ▶️ Cómo jugar

**Como aplicación de escritorio (recomendado):**
1. Instala [Node.js](https://nodejs.org) si no lo tienes.
2. En la carpeta del juego: `npm install` (solo la primera vez).
3. `npm start` — se abre la ventana del juego.

Para generar un `.exe` portable: `npm run dist` (sale en la carpeta `dist/`).

**En el navegador** (sin online como host): abre `index.html` con doble clic,
o con servidor local `npx http-server -p 8687` → `http://localhost:8687`.

**En el móvil (Android):** instala `dist/Los-Enfermos-TCG.apk` — cópiala al
móvil (WhatsApp/USB/Drive), tócala y acepta instalar de origen desconocido.
La app va en horizontal, a pantalla completa y con controles táctiles
(arrastra cartas, corta sobres y navega igual que con el ratón). Para unirte
a partidas online desde el móvil: misma wifi que el host y su IP.
Para regenerar la APK tras cambios: `npm run apk`
(requiere Android Studio instalado; la APK sale en
`android/app/build/outputs/apk/debug/app-debug.apk`).

## 🌐 Jugar online (1 vs 1)

- **El host** (necesita la aplicación de escritorio): Menú → *Jugar Online* →
  *Crear partida*. El juego levanta un servidor local en el **puerto 8688** y
  te muestra tu IP para compartirla.
- **El invitado** (vale la app o el navegador): *Jugar Online* → escribe la IP
  del host → *Unirse*. En la misma red local (wifi) funciona directo; por
  internet, el host debe abrir/redirigir el puerto 8688 en su router.
- Cada jugador usa su **mazo activo** (el del gestor de mazos). El motor corre
  solo en el host: el invitado nunca ve tu mano ni el orden de tu mazo.

## 🎮 Controles

| Acción | Cómo |
|---|---|
| Jugar carta | Arrástrala desde tu mano al tablero |
| Hechizo con objetivo | Arrastra la carta directamente sobre el objetivo (flecha azul) |
| Atacar | Arrastra tu esbirro (brillo verde) sobre un enemigo (flecha roja) |
| Poder de héroe | Clic en el botón redondo junto a tu retrato y clic en el objetivo |
| Atacar con artefacto | Arrastra tu retrato sobre el enemigo |
| Cancelar | Clic derecho |
| Pasar turno | Botón dorado «FIN DEL TURNO» |

## 📜 Reglas

- Cada héroe empieza con **30 de vida**. Gana quien deje al rival a 0.
- El maná empieza en 1 y sube +1 por turno (máximo 10).
- Robas 1 carta por turno. Sin cartas en la baraja → daño creciente por **fatiga**.
- Mano máxima de 10 cartas (las robadas de más se queman).
- Máximo 7 esbirros en el tablero.
- Los esbirros recién invocados no pueden atacar ese turno (salvo **Embestida**).
- El segundo jugador recibe una carta extra y una **Cerveza Gratis** (+1 maná temporal).

### Palabras clave

- **Provocar** — Los enemigos deben atacar a este esbirro primero.
- **Embestida** — Puede atacar el mismo turno en que se invoca.
- **Grito de Batalla** — Efecto al jugarlo desde la mano.
- **Última Voluntad** — Efecto al morir.
- **Combo** — Efecto mejorado si ya jugaste otra carta este turno.
- **Descarte** — Algunos efectos poderosos descartan cartas de tu mano.

## 🃏 Las barajas

### 🏥 El Sanatorio San José (tú) — Control
Terapias, camisas de fuerza, ingresos forzosos y curación. Aguanta el asalto
inicial y remonta con **Mario Matas, el Liante** (roba y abarata cartas),
**Jorge Monzo** y sus pedos sónicos, **Victor Lamas** a toda velocidad y
**Montreal** curándote cada turno. Poder de héroe: *Terapia Intensiva* (cura 3).

### 🖤 La Mano Negra (IA) — Agresiva/Combo
Pullas, quejas, gatos y kebabs. Presión constante con **Kevin, el Mofeta** y su
nube tóxica, **Los 5 Gatos**, robo masivo con *Viciada de 14 Horas* y el combo
estrella: **Cauntu, Científico Loco** genera la **Ciborgización**, que transforma
un gato 1/1 en el **Niku-Borg 9000** (8/8 con Provocar). Poder de héroe:
*Pulla Certera* (1 de daño).

## 🗂️ Estructura del código

- `js/cards.js` — Base de datos de héroes, cartas, barajas y sets (añade cartas aquí).
- `js/game.js` — Motor de reglas puro (turnos, combate, maná, muertes, fatiga).
- `js/ai.js` — La IA enemiga (heurísticas de juego y de objetivos).
- `js/ui.js` — Renderizado, drag & drop, flecha de objetivo, animaciones y sonido.
- `js/menu.js` — Menú principal, mazos (arquetipos y propios), tienda y ajustes.
- `js/online.js` — Multijugador: serialización, protocolo y cliente host/invitado.
- `js/ilustraciones.js` — Mapa carta → imagen (edítalo al añadir ilustraciones).
- `js/main.js` — Arranque y cableado de botones.
- `electron/main.js` — Ventana de la app y arranque del servidor online.
- `electron/relay.js` — Relé WebSocket que conecta a los dos jugadores.
- `css/style.css` — Todo el estilo visual.

Para crear una carta nueva: añade su definición en `CARDS` (con `battlecry`,
`spell`, `deathrattle`, `endTurn`, `aiWants`, `aiTarget` según necesite) y mete
su id en una lista de `DECKS`. El motor y la UI la reconocen automáticamente.
