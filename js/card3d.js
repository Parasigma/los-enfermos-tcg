'use strict';
/* =========================================================
   CARD3D — capa de BRILLO/RELIEVE 3D para cartas DIAMOND
   ---------------------------------------------------------
   El modelo (assets/3D/diamond_card.glb) es una carta de
   diamante opaca (sin arte ni texto). Por eso NO sustituye a
   la carta: se dibuja ENCIMA con blending (soft-light) como
   una lámina de diamante con relieve y reflejos que se mueve
   junto a la carta. Debajo sigue la carta normal con su arte,
   texto y números, perfectamente legible.
   three.js va autoalojado en js/lib (funciona offline). Si no
   hay WebGL/three, el inspector muestra la carta plana sin más.
   ========================================================= */
const Card3D = (() => {
  let renderer, scene, camera, pivot, model, canvas;
  let rawSize = null;                 // tamaño del modelo sin escalar
  const CAM_Z = 6, FOV = 30;
  let ready = false, loading = false, active = false, rafId = null;
  let pending = [];
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
    if ('toneMapping' in renderer) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82; }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(FOV, 0.72, 0.1, 100);
    camera.position.set(0, 0, CAM_Z);

    /* luz contenida: antes salía todo blanco quemado */
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x20304a, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 0.85); key.position.set(2.2, 2.6, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fbcff, 0.3); fill.position.set(-3, -1.5, 2.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.55); rim.position.set(0, 2, -4); scene.add(rim);

    /* mapa de entorno para los reflejos/brillo del diamante */
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
      /* material: brillo metálico del diamante sin quemarse en blanco */
      model.traverse(o => {
        if (o.isMesh && o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
            if ('metalness' in m) m.metalness = 0.5;
            if ('roughness' in m) m.roughness = 0.38;
            if ('envMapIntensity' in m) m.envMapIntensity = 0.7;
            m.needsUpdate = true;
          });
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      rawSize = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);                       // centrado en el origen
      pivot = new THREE.Group();
      pivot.add(model);
      scene.add(pivot);
      ready = true; loading = false;
      fit();
      pending.forEach(f => f()); pending = [];
    }, undefined, () => { loading = false; pending = []; });
  }

  /* escala el modelo para que la carta ENTERA quepa en el canvas
     (antes se salía por los lados). Se recalcula al redimensionar. */
  function fit() {
    if (!model || !rawSize) return;
    const vFov = FOV * Math.PI / 180;
    const visH = 2 * Math.tan(vFov / 2) * CAM_Z;
    const visW = visH * (camera.aspect || 0.72);
    const s = Math.min(visH / rawSize.y, visW / rawSize.x) * 0.98;
    model.scale.setScalar(s);
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
    open(container) {
      if (!supported()) return false;
      active = true;
      loadModel(() => {
        if (!active) return;
        container.appendChild(canvas);
        resize();
        if (!rafId) loop();
      });
      return true;
    },
    close() {
      active = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (canvas && canvas.parentElement) canvas.parentElement.removeChild(canvas);
      tRX = tRY = cRX = cRY = 0;
    },
    /* mismos ángulos que la carta 2D (rotateY cx*44°, rotateX -cy*34°)
       para que el brillo 3D quede pegado al contenido */
    setTilt(cx, cy) { tRY = cx * 0.767; tRX = -cy * 0.593; },
    resize
  };
})();
