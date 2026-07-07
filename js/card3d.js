'use strict';
/* =========================================================
   CARD3D — fondo/marco 3D de las cartas DIAMOND
   ---------------------------------------------------------
   El modelo (assets/3D/diamond_card.glb) ES el fondo de la
   carta: marco de diamante opaco con el HUECO recortado para
   la ilustración. Se monta así, de atrás a delante:
     · la ILUSTRACIÓN va como plano dentro de la escena 3D,
       detrás del marco, y asoma por el hueco (rota con el
       modelo, siempre encajada).
     · el MARCO 3D (el glb) por encima, opaco.
     · el TEXTO (nombre, coste, ataque, vida, descripción) va
       DELANTE en HTML (capa #ci-card), sincronizado con el
       giro del modelo.
   No se usa el marco/fondo plano de diamante: lo pone el 3D.
   three.js autoalojado (offline). Sin WebGL, carta plana.
   ========================================================= */
const Card3D = (() => {
  let renderer, scene, camera, pivot, holder, model, illo, illoMat, canvas;
  let rawSize = null;
  const CAM_Z = 6, FOV = 30;
  /* ventana del arte (mismos % que .card .art) para colocar la
     ilustración justo en el hueco del modelo */
  const ART = { l: 0.13, r: 0.845, t: 0.085, b: 0.383, pad: 1.08 };
  let ready = false, loading = false, active = false, rafId = null;
  let pending = [];
  let pendingArt = null;
  let tRX = 0, tRY = 0, cRX = 0, cRY = 0;
  let lastW = 0, lastH = 0;

  function supported() {
    return typeof THREE !== 'undefined' && typeof THREE.GLTFLoader === 'function'
      && !!window.WebGLRenderingContext;
  }

  function init() {
    if (renderer) return;
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
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);           // centrado dentro de su grupo
      holder = new THREE.Group();
      holder.add(model);                    // el holder se escala (mantiene el centrado)

      /* plano de la ilustración (detrás del marco, asoma por el hueco) */
      illoMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false });
      illo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), illoMat);

      pivot = new THREE.Group();
      pivot.add(holder);
      pivot.add(illo);
      scene.add(pivot);
      ready = true; loading = false;
      fit();
      pending.forEach(f => f()); pending = [];
    }, undefined, () => { loading = false; pending = []; });
  }

  function loadArt(url, fallback) {
    if (!illoMat) return;
    const tl = new THREE.TextureLoader();
    const apply = tex => {
      if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
      else if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
      illoMat.map = tex; illoMat.opacity = 1; illoMat.needsUpdate = true;
    };
    illoMat.opacity = 0;                    // oculta mientras carga
    tl.load(url, apply, undefined, () => {  // si no existe el webp, cae al png base
      if (fallback) tl.load(fallback, apply, undefined, () => {});
    });
  }

  /* escala el modelo para que el marco llene el canvas (encaje con el
     texto/ilustración) y coloca la ilustración en el hueco. Se recalcula
     al redimensionar porque depende del aspecto del canvas. */
  function fit() {
    if (!model || !rawSize) return;
    const vFov = FOV * Math.PI / 180;
    const visH = 2 * Math.tan(vFov / 2) * CAM_Z;
    const visW = visH * (camera.aspect || 0.72);
    const f = 0.995;
    const cardW = visW * f, cardH = visH * f;
    holder.scale.set(cardW / rawSize.x, cardH / rawSize.y, cardH / rawSize.y);
    if (illo) {
      const cx = ((ART.l + ART.r) / 2 - 0.5) * cardW;
      const cy = (0.5 - (ART.t + ART.b) / 2) * cardH;
      illo.position.set(cx, cy, 0);         // a media profundidad: asoma por el hueco
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
    cRX += (tRX - cRX) * 0.14;
    cRY += (tRY - cRY) * 0.14;
    if (pivot) { pivot.rotation.x = cRX; pivot.rotation.y = cRY; }
    renderer.render(scene, camera);
  }

  return {
    supported,
    /* art = { url, fallback } ilustración a mostrar por el hueco */
    open(container, art) {
      if (!supported()) return false;
      active = true;
      pendingArt = art || null;
      loadModel(() => {
        if (!active) return;
        container.appendChild(canvas);
        if (pendingArt) loadArt(pendingArt.url, pendingArt.fallback);
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
      tRX = tRY = cRX = cRY = 0;
    },
    /* mismos ángulos que la carta 2D (rotateY cx*44°, rotateX -cy*34°) */
    setTilt(cx, cy) { tRY = cx * 0.767; tRX = -cy * 0.593; },
    resize
  };
})();
