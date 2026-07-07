'use strict';
/* =========================================================
   CARD3D — visor 3D del modelo de carta DIAMOND (three.js)
   ---------------------------------------------------------
   En el inspector, las cartas DIAMOND se muestran con este
   modelo 3D (assets/3D/diamond_card.glb) en vez de la imagen
   plana: gira con el puntero (mismo rango que la carta 2D) y
   luce el relieve y el brillo del diamante. Todo auto-alojado
   (three.js en js/lib), funciona offline. Si WebGL/three no
   están, el inspector sigue mostrando la carta plana.
   ========================================================= */
const Card3D = (() => {
  let renderer, scene, camera, pivot, canvas;
  let ready = false, loading = false, active = false, rafId = null;
  let pending = [];
  let tRX = 0, tRY = 0, cRX = 0, cRY = 0, idle = 0;
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
    if ('toneMapping' in renderer) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 0.72, 0.1, 100);
    camera.position.set(0, 0, 6);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3550, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(2.5, 3, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0x99ccff, 1.1); fill.position.set(-3, -1.5, 2.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.5); rim.position.set(0, 2, -4); scene.add(rim);

    /* mapa de entorno para los reflejos del diamante */
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
      const model = gltf.scene;
      /* ajusta el material para que el diamante BRILLE (el glb viene con
         roughness 1 = mate; lo bajamos y damos reflejos del entorno) */
      model.traverse(o => {
        if (o.isMesh && o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
            if ('metalness' in m) m.metalness = 0.55;
            if ('roughness' in m) m.roughness = 0.3;
            if ('envMapIntensity' in m) m.envMapIntensity = 1.5;
            m.needsUpdate = true;
          });
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);                       // centrado en el origen
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar(3.9 / maxDim);              // tamaño estándar en escena
      pivot = new THREE.Group();
      pivot.add(model);
      scene.add(pivot);
      ready = true; loading = false;
      pending.forEach(f => f()); pending = [];
    }, undefined, () => { loading = false; pending = []; });
  }

  function resize() {
    if (!renderer || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function loop() {
    if (!active) { rafId = null; return; }
    rafId = requestAnimationFrame(loop);
    /* se auto-corrige el tamaño si el canvas cambia (p.ej. al hacer
       visible la pestaña o redimensionar la ventana) */
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      if (r.width && (Math.abs(r.width - lastW) > 1 || Math.abs(r.height - lastH) > 1)) resize();
    }
    idle += 0.012;
    cRX += (tRX - cRX) * 0.12;
    cRY += (tRY - cRY) * 0.12;
    if (pivot) {
      pivot.rotation.x = cRX + Math.sin(idle) * 0.05;
      pivot.rotation.y = cRY + Math.cos(idle * 0.7) * 0.06;
    }
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
    /* mismo rango que la carta 2D: cx,cy ∈ [-0.65,0.65] */
    setTilt(cx, cy) { tRY = cx * 0.95; tRX = -cy * 0.75; },
    resize
  };
})();
