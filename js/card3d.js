'use strict';
/* =========================================================
   CARD3D — fondo/marco 3D de las cartas DIAMOND
   ---------------------------------------------------------
   El modelo (assets/3D/diamond_card.glb) ES el fondo de la
   carta: marco de diamante opaco con el HUECO para la
   ilustración. Se monta de atrás a delante:
     · ILUSTRACIÓN: plano dentro de la escena 3D, justo detrás
       del hueco. Si existe assets/ilustraciones/<id>.webm se
       reproduce EN BUCLE (animada); si no, la imagen fija, y
       si tampoco, el emoji sobre el fondo base.
       Se recorta tipo «object-fit: cover» (no se deforma).
     · MARCO 3D (el glb) por encima, opaco.
     · TEXTO en HTML por delante (#ci-card), movido por el
       bucle de render con el mismo giro exacto del modelo.
   three.js autoalojado (offline). Sin WebGL, carta plana.
   ========================================================= */
const Card3D = (() => {
  let renderer, scene, camera, pivot, holder, model, illo, illoMat, canvas;
  let rawSize = null, illoSrc = null, illoVideo = null, maxAniso = 1;
  let textEl = null;
  let bgImg = null, bgReady = false;
  const CAM_Z = 6, FOV = 30, RAD2DEG = 180 / Math.PI;
  /* hueco real del modelo, medido sobre el render (fracciones de la carta) */
  const ART = { l: 0.125, r: 0.8714, t: 0.093, b: 0.3794 };
  /* La ilustración va al FONDO del modelo (z = -grosor/2): así queda siempre
     DETRÁS del relieve y el hueco se ve con su forma real (arco con las dos
     esquinas de abajo). Si se acerca más, el plano asoma por delante del
     marco y tapa esas esquinas. 1.10 cubre el hueco entero al girar. */
  const ILLO_MARGIN = 1.10;
  let planeAspect = 1.833;
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
    try { maxAniso = renderer.capabilities.getMaxAnisotropy() || 1; } catch (e) { maxAniso = 1; }

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

  /* recorte tipo «object-fit: cover» con encuadre alto (object-position 50% 18%,
     igual que la carta plana): la ilustración no se deforma nunca */
  function applyCover(tex, iw, ih, pa) {
    if (!tex || !iw || !ih) return;
    const ia = iw / ih;
    if (ia > pa) { const r = pa / ia; tex.repeat.set(r, 1); tex.offset.set((1 - r) / 2, 0); }
    else { const r = ia / pa; tex.repeat.set(1, r); tex.offset.set(0, 0.82 * (1 - r)); }
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
  }

  function setTex(tex, w, h) {
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = maxAniso;
    illoSrc = { w: w, h: h };
    if (illoMat.map && illoMat.map !== tex) illoMat.map.dispose();
    illoMat.map = tex; illoMat.opacity = 1; illoMat.needsUpdate = true;
    applyCover(tex, w, h, planeAspect);
  }

  function emojiTexture(emoji) {
    const w = 512, h = 279;                       // mismo aspecto que el hueco
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    if (bgReady) {
      const s = Math.max(w / bgImg.width, h / bgImg.height);
      const dw = bgImg.width * s, dh = bgImg.height * s;
      cx.drawImage(bgImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else { cx.fillStyle = '#2e2620'; cx.fillRect(0, 0, w, h); }
    cx.font = Math.round(h * 0.78) + 'px serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(emoji || '❓', w / 2, h * 0.54);
    return new THREE.CanvasTexture(cv);
  }

  function stopVideo() {
    if (!illoVideo) return;
    try { illoVideo.pause(); illoVideo.removeAttribute('src'); illoVideo.load(); } catch (e) {}
    illoVideo = null;
  }

  /* ilustración animada: se reproduce sola y EN BUCLE (silenciada, que es
     lo que permiten los navegadores sin gesto del usuario) */
  function loadVideo(url, onOk, onFail) {
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.loop = true;
    v.autoplay = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('loop', '');
    let done = false;
    v.addEventListener('loadeddata', () => {
      if (done) return; done = true;
      const p = v.play(); if (p && p.catch) p.catch(() => {});
      onOk(v);
    });
    v.addEventListener('error', () => { if (done) return; done = true; onFail(); });
    v.src = url; v.load();
  }

  function loadArt(art) {
    if (!illoMat || !art) return;
    illoMat.opacity = 0;
    stopVideo();
    const tl = new THREE.TextureLoader();
    const useEmoji = () => setTex(emojiTexture(art.emoji), 512, 279);
    const useImg = (url, next) => tl.load(url,
      t => setTex(t, t.image.width, t.image.height), undefined, next);
    const tryImgs = () => {
      if (art.url) useImg(art.url, () => art.fallback ? useImg(art.fallback, useEmoji) : useEmoji());
      else if (art.fallback) useImg(art.fallback, useEmoji);
      else useEmoji();
    };
    if (art.video) {
      loadVideo(art.video, v => {
        illoVideo = v;
        setTex(new THREE.VideoTexture(v), v.videoWidth, v.videoHeight);
      }, tryImgs);
    } else tryImgs();
  }

  /* escala el marco para llenar el canvas y encaja la ilustración en el hueco.
     El plano va algo hundido, así que se compensa la perspectiva (k) para que
     su proyección cubra la boca del hueco entera (incluidas las esquinas). */
  function fit() {
    if (!model || !rawSize) return;
    const vFov = FOV * Math.PI / 180;
    const visH = 2 * Math.tan(vFov / 2) * CAM_Z;
    const visW = visH * (camera.aspect || 0.72);
    const f = 0.995, cardW = visW * f, cardH = visH * f;
    const sY = cardH / rawSize.y;
    holder.scale.set(cardW / rawSize.x, sY, sY);
    if (!illo) return;
    const depth = rawSize.z * sY;
    const zIllo = -depth / 2;                   // al fondo: siempre detrás del marco
    const k = (CAM_Z - zIllo) / CAM_Z;          // compensa la perspectiva del hundido
    const hw = (ART.r - ART.l) * cardW, hh = (ART.b - ART.t) * cardH;
    illo.position.set(((ART.l + ART.r) / 2 - 0.5) * cardW * k, (0.5 - (ART.t + ART.b) / 2) * cardH * k, zIllo);
    illo.scale.set(hw * k * ILLO_MARGIN, hh * k * ILLO_MARGIN, 1);
    planeAspect = hw / hh;
    if (illoSrc && illoMat.map) applyCover(illoMat.map, illoSrc.w, illoSrc.h, planeAspect);
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
    /* sube el fotograma nuevo del vídeo a la textura */
    if (illoVideo && illoMat.map && illoMat.map.isVideoTexture && illoVideo.readyState >= 2) {
      illoMat.map.needsUpdate = true;
    }
    cRX += (tRX - cRX) * 0.16;
    cRY += (tRY - cRY) * 0.16;
    if (pivot) { pivot.rotation.x = cRX; pivot.rotation.y = cRY; }
    if (textEl) textEl.style.transform = 'rotateY(' + (cRY * RAD2DEG) + 'deg) rotateX(' + (cRX * RAD2DEG) + 'deg)';
    renderer.render(scene, camera);
  }

  return {
    supported,
    /* art = { video, url, fallback, emoji }; text = capa de texto a sincronizar */
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
      stopVideo();
      if (illoMat) { illoMat.opacity = 0; if (illoMat.map) { illoMat.map.dispose(); illoMat.map = null; } }
      illoSrc = null;
      if (textEl) { textEl.style.transform = ''; textEl = null; }
      tRX = tRY = cRX = cRY = 0;
    },
    setTilt(cx, cy) { tRY = cx * 0.62; tRX = -cy * 0.48; },
    resize
  };
})();
