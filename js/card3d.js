'use strict';
/* =========================================================
   CARD3D — fondo/marco 3D de las cartas DIAMOND
   ---------------------------------------------------------
   El modelo (assets/3D/diamond_card.glb) ES el fondo de la
   carta: marco de diamante opaco con el HUECO para la
   ilustración. Se monta de atrás a delante:
     · ILUSTRACIÓN: plano dentro de la escena 3D, detrás del
       marco; asoma por el hueco y rota con el modelo. Si la
       carta no tiene imagen real, se genera con su emoji
       sobre el fondo base (igual que la carta plana).
     · MARCO 3D (el glb) por encima, opaco.
     · TEXTO en HTML por delante (#ci-card): el bucle de
       render mueve el texto con EXACTAMENTE el mismo giro
       que el modelo, así van pegados.
   three.js autoalojado (offline). Sin WebGL, carta plana.
   ========================================================= */
const Card3D = (() => {
  let renderer, scene, camera, pivot, holder, model, illo, illoMat, canvas;
  let rawSize = null;
  let textEl = null;                       // capa de texto que giramos en sincronía
  let bgImg = null, bgReady = false;       // fondo base para cartas sin imagen
  const CAM_Z = 6, FOV = 30, RAD2DEG = 180 / Math.PI;
  const ART = { l: 0.13, r: 0.845, t: 0.085, b: 0.383, pad: 1.08 };
  let ready = false, loading = false, active = false, rafId = null;
  let pending = [], pendingArt = null;
  let tRX = 0, tRY = 0, cRX = 0, cRY = 0;
  let lastW = 0, lastH = 0;

  function supported() {
    return typeof THREE !== 'undefined' && typeof THREE.GLTFLoader === 'function'
      && !!window.WebGLRenderingContext;
  }

  function ensureBg() {
    if (bgImg) return;
    bgImg = new Image();
    bgImg.onload = () => { bgReady = true; };
    bgImg.src = 'assets/cartas_fondo_basic.jpg';
  }

  function init() {
    if (renderer) return;
    ensureBg();
    canvas = document.createElement('canvas');
    canvas.id = 'card3d-canvas';
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (e) { renderer = null; return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    if ('toneMapping' in renderer) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9; }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(FOV, 0.72, 0.1, 100);
    camera.position.set(0, 0, CAM_Z);

    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x20304a, 0.4));
    const key = new THREE.DirectionalLight(0xffffff, 0.95); key.position.set(2.2, 2.6, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fbcff, 0.35); fill.position.set(-3, -1.5, 2.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(0, 2, -4); scene.add(rim);

    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    } catch (e) {}
  }

  function loadModel(cb) {
    if (ready) { cb(); return; }
    if (cb) pending.push(cb);
    if (loading) return;
    loading = true;
    init();
    if (!renderer) { loading = false; pending = []; return; }
    new THREE.GLTFLoader().load('assets/3D/diamond_card.glb', gltf => {
      model = gltf.scene;
      model.traverse(o => {
        if (o.isMesh && o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
            if ('metalness' in m) m.metalness = 0.5;
            if ('roughness' in m) m.roughness = 0.38;
            if ('envMapIntensity' in m) m.envMapIntensity = 0.75;
            m.needsUpdate = true;
          });
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      rawSize = box.getSize(new THREE.Vector3());
      model.position.sub(box.getCenter(new THREE.Vector3()));
      holder = new THREE.Group();
      holder.add(model);

      illoMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false });
      illo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), illoMat);

      pivot = new THREE.Group();
      pivot.add(holder); pivot.add(illo);
      scene.add(pivot);
      ready = true; loading = false;
      fit();
      pending.forEach(f => f()); pending = [];
    }, undefined, () => { loading = false; pending = []; });
  }

  function setTex(tex) {
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    illoMat.map = tex; illoMat.opacity = 1; illoMat.needsUpdate = true;
  }

  /* textura de reserva: emoji sobre el fondo base (cartas sin imagen real,
     como en la ventana de arte de la carta plana) */
  function emojiTexture(emoji) {
    const w = 512, h = 303;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    if (bgReady) {
      const s = Math.max(w / bgImg.width, h / bgImg.height);
      const dw = bgImg.width * s, dh = bgImg.height * s;
      cx.drawImage(bgImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else { cx.fillStyle = '#2e2620'; cx.fillRect(0, 0, w, h); }
    cx.font = Math.round(h * 0.72) + 'px serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(emoji || '❓', w / 2, h * 0.54);
    return new THREE.CanvasTexture(cv);
  }

  function loadArt(art) {
    if (!illoMat || !art) return;
    illoMat.opacity = 0;
    const tl = new THREE.TextureLoader();
    const useEmoji = () => setTex(emojiTexture(art.emoji));
    tl.load(art.url, setTex, undefined, () => {
      if (art.fallback) tl.load(art.fallback, setTex, undefined, useEmoji);
      else useEmoji();
    });
  }

  /* escala el marco para llenar el canvas y coloca la ilustración en el
     hueco. Se recalcula al redimensionar (depende del aspecto). */
  function fit() {
    if (!model || !rawSize) return;
    const vFov = FOV * Math.PI / 180;
    const visH = 2 * Math.tan(vFov / 2) * CAM_Z;
    const visW = visH * (camera.aspect || 0.72);
    const f = 0.995;
    const cardW = visW * f, cardH = visH * f;
    holder.scale.set(cardW / rawSize.x, cardH / rawSize.y, cardH / rawSize.y);
    if (illo) {
      illo.position.set(((ART.l + ART.r) / 2 - 0.5) * cardW, (0.5 - (ART.t + ART.b) / 2) * cardH, 0);
      illo.scale.set((ART.r - ART.l) * cardW * ART.pad, (ART.b - ART.t) * cardH * ART.pad, 1);
    }
  }

  function resize() {
    if (!renderer || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    fit();
  }

  function loop() {
    if (!active) { rafId = null; return; }
    rafId = requestAnimationFrame(loop);
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      if (r.width && (Math.abs(r.width - lastW) > 1 || Math.abs(r.height - lastH) > 1)) resize();
    }
    cRX += (tRX - cRX) * 0.16;
    cRY += (tRY - cRY) * 0.16;
    if (pivot) { pivot.rotation.x = cRX; pivot.rotation.y = cRY; }
    /* mueve el texto con EXACTAMENTE el mismo giro que el modelo */
    if (textEl) textEl.style.transform = 'rotateY(' + (cRY * RAD2DEG) + 'deg) rotateX(' + (cRX * RAD2DEG) + 'deg)';
    renderer.render(scene, camera);
  }

  return {
    supported,
    /* art = { url, fallback, emoji }; text = capa de texto a sincronizar */
    open(container, art, text) {
      if (!supported()) return false;
      active = true;
      pendingArt = art || null;
      textEl = text || null;
      loadModel(() => {
        if (!active) return;
        container.appendChild(canvas);
        if (pendingArt) loadArt(pendingArt);
        resize();
        if (!rafId) loop();
      });
      return true;
    },
    close() {
      active = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (canvas && canvas.parentElement) canvas.parentElement.removeChild(canvas);
      if (illoMat) { illoMat.opacity = 0; if (illoMat.map) { illoMat.map.dispose(); illoMat.map = null; } }
      if (textEl) { textEl.style.transform = ''; textEl = null; }
      tRX = tRY = cRX = cRY = 0;
    },
    /* giro algo restringido para que texto y 3D no canten al inclinar
       (rotateY ~35°, rotateX ~27° a tope) */
    setTilt(cx, cy) { tRY = cx * 0.62; tRX = -cy * 0.48; },
    resize
  };
})();
