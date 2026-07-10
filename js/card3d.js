'use strict';
/* =========================================================
   CARD3D — fondo/marco 3D de las cartas DIAMOND
   ---------------------------------------------------------
   El modelo (assets/3D/diamond_card.glb) ES el fondo de la
   carta. Se monta todo DENTRO de la escena 3D, así que gira
   como un objeto único (nada flota):
     · ILUSTRACIÓN: plano al fondo, asoma por el hueco. Si hay
       assets/ilustraciones/<id>.webm se reproduce en bucle.
     · MARCO 3D: el glb opaco.
     · TEXTO: se pinta en canvas (misma fuente, tamaños y
       posiciones que la carta plana) y se sube como texturas
       pegadas a la superficie del modelo. La altura de cada
       zona se mide con raycast: los números quedan APOYADOS
       sobre el relieve de sus gemas y el texto sobre la placa.
   three.js autoalojado (offline). Sin WebGL, carta plana.
   ========================================================= */
const Card3D = (() => {
  let renderer, scene, camera, pivot, holder, model, illo, illoMat, canvas;
  let rawSize = null, illoSrc = null, illoVideo = null, maxAniso = 1;
  let textGroup = null, textPlanes = [];
  let bgImg = null, bgReady = false;
  const CAM_Z = 6, FOV = 30;
  /* hueco real del modelo, medido sobre el render (fracciones de la carta) */
  const ART = { l: 0.125, r: 0.8714, t: 0.093, b: 0.3794 };
  const ILLO_MARGIN = 1.10;
  /* el canvas se dibuja un 28% más grande que la carta para que las
     esquinas no se corten al inclinar (la carta ocupa 1/1.28 del alto) */
  const OVERSCAN = 1.28;
  /* estilos de la carta grande (280x398) — calcados del CSS */
  const CARD_W = 280, CARD_H = 398, TEX_SCALE = 2.5;
  const FONT = "'Merriweather', Georgia, serif";
  const INK = '#2b1d0e';
  let ready = false, loading = false, active = false, rafId = null;
  let pending = [], pendingArt = null, pendingData = null;
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

      textGroup = new THREE.Group();

      pivot = new THREE.Group();
      pivot.add(holder); pivot.add(illo); pivot.add(textGroup);
      scene.add(pivot);
      ready = true; loading = false;
      fit();
      pending.forEach(f => f()); pending = [];
    }, undefined, () => { loading = false; pending = []; });
  }

  /* ---------- ilustración (hueco) ---------- */

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
    const hw = (ART.r - ART.l), hh = (ART.b - ART.t);
    applyCover(tex, w, h, (hw * CARD_W) / (hh * CARD_H));
  }

  function emojiTexture(emoji) {
    const w = 512, h = 279;
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

  /* ---------- texto en 3D ---------- */

  /* altura (z) de la superficie del modelo en un punto de la carta, en
     coordenadas locales sin escalar: así el texto se APOYA en el relieve */
  const _rc = supported() ? new THREE.Raycaster() : null;
  function surfaceZ(fx, fy, fallback) {
    if (!_rc || !model || !rawSize) return fallback;
    const ox = (fx - 0.5) * rawSize.x, oy = (0.5 - fy) * rawSize.y;
    _rc.set(new THREE.Vector3(ox, oy, rawSize.z * 3), new THREE.Vector3(0, 0, -1));
    const hits = _rc.intersectObject(model, true);
    return hits.length ? hits[0].point.z : fallback;
  }

  /* mini-parser del texto de carta: <b>/<i> en línea, <br> = salto,
     el resto de etiquetas fuera */
  function parseRich(html) {
    const out = [];
    let b = 0, i = 0;
    String(html).split(/(<[^>]*>)/).forEach(tk => {
      if (!tk) return;
      if (tk[0] === '<') {
        const t = tk.toLowerCase();
        if (t === '<b>' || t === '<strong>') b++;
        else if (t === '</b>' || t === '</strong>') b = Math.max(0, b - 1);
        else if (t === '<i>' || t === '<em>') i++;
        else if (t === '</i>' || t === '</em>') i = Math.max(0, i - 1);
        else if (t === '<br>' || t === '<br/>' || t === '<br />') out.push({ br: true });
        return;
      }
      tk.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').split(/\s+/).forEach(w => {
        if (w) out.push({ w, b: b > 0, i: i > 0 });
      });
    });
    return out;
  }

  function fontStr(px, bold, italic) {
    return (italic ? 'italic ' : '') + (bold ? 'bold ' : '') + px + 'px ' + FONT;
  }

  /* pinta un párrafo centrado con ajuste de línea; si no cabe en alto,
     reduce la fuente. (cx en px de textura) */
  function drawPara(cx, tokens, zone, basePx, lineH, color, valign) {
    for (let px = basePx; px >= 9; px--) {
      const lines = [[]];
      let wLine = 0;
      const space = (f) => { cx.font = f; return cx.measureText(' ').width; };
      for (const tk of tokens) {
        if (tk.br) { lines.push([]); wLine = 0; continue; }
        cx.font = fontStr(px, tk.b, tk.i);
        const ww = cx.measureText(tk.w).width;
        const add = wLine ? space(cx.font) + ww : ww;
        if (wLine + add > zone.w && wLine) { lines.push([tk]); wLine = ww; }
        else { lines[lines.length - 1].push(tk); wLine += add; }
      }
      const lh = px * lineH;
      if (lines.length * lh > zone.h && px > 9) continue;
      const total = lines.length * lh;
      let y = valign === 'bottom' ? zone.y + zone.h - total + lh / 2
            : zone.y + (zone.h - total) / 2 + lh / 2;
      cx.textAlign = 'left'; cx.textBaseline = 'middle';
      for (const ln of lines) {
        let lw = 0;
        const parts = ln.map(tk => {
          cx.font = fontStr(px, tk.b, tk.i);
          const ww = cx.measureText(tk.w).width, sp = lw ? cx.measureText(' ').width : 0;
          lw += sp + ww;
          return { tk, ww, sp };
        });
        let x = zone.x + (zone.w - lw) / 2;
        for (const p of parts) {
          x += p.sp;
          cx.font = fontStr(px, p.tk.b, p.tk.i);
          cx.fillStyle = color;
          cx.fillText(p.tk.w, x, y);
          x += p.ww;
        }
        y += lh;
      }
      return;
    }
  }

  /* número de gema (coste / ataque / vida): canvas pequeño con sombra */
  function gemCanvas(txt, px, color, weaponBg) {
    const S = TEX_SCALE, w = Math.round(0.24 * CARD_W * S), h = Math.round(0.17 * CARD_H * S);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    if (weaponBg) {  // los artefactos llevan su propia gema pintada
      const r = Math.min(w, h) / 2 - 2;
      const g = cx.createRadialGradient(w * 0.42, h * 0.36, r * 0.1, w / 2, h / 2, r);
      if (weaponBg === 'atk') { g.addColorStop(0, '#ffd54f'); g.addColorStop(0.6, '#f5a623'); g.addColorStop(1, '#a5680a'); }
      else { g.addColorStop(0, '#90a4ae'); g.addColorStop(0.6, '#546e7a'); g.addColorStop(1, '#263238'); }
      cx.beginPath(); cx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      cx.fillStyle = g; cx.fill();
      cx.lineWidth = 4; cx.strokeStyle = 'rgba(0,0,0,.5)'; cx.stroke();
    }
    cx.font = 'bold ' + Math.round(px * TEX_SCALE) + 'px ' + FONT;
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = 'rgba(0,0,0,.85)'; cx.shadowBlur = 3 * TEX_SCALE; cx.shadowOffsetY = 2 * TEX_SCALE;
    cx.fillStyle = color;
    cx.fillText(String(txt), w / 2, h * 0.54);
    return cv;
  }

  function planeFromCanvas(cv, fx, fy, fw, fh, zRaw) {
    const tex = new THREE.CanvasTexture(cv);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = maxAniso;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.userData.frac = { fx, fy, fw, fh, zRaw };
    textGroup.add(mesh);
    textPlanes.push(mesh);
    return mesh;
  }

  function clearText() {
    for (const p of textPlanes) {
      textGroup.remove(p);
      if (p.material.map) p.material.map.dispose();
      p.material.dispose(); p.geometry.dispose();
    }
    textPlanes = [];
  }

  /* construye las texturas de texto de la carta (mismos estilos que el CSS
     de .card.big) y las apoya sobre el relieve medido del modelo */
  function buildText(data) {
    if (!textGroup || !data) return;
    clearText();
    const S = TEX_SCALE, W = CARD_W * S, H = CARD_H * S;
    const eps = 0.012;
    const minion = data.type === 'minion';

    /* --- placa central: nombre + texto + flavor + set --- */
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');

    const nameZone = minion
      ? { x: 0.11 * W, y: 0.40 * H, w: 0.78 * W, h: 0.125 * H }
      : { x: 0.11 * W, y: 0.42 * H, w: 0.78 * W, h: 0.09 * H };
    if (!minion) { cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = 2 * S; cx.shadowOffsetY = S; }
    drawPara(cx, parseRich('<b>' + data.name + '</b>'), nameZone, Math.round(18 * S), 1.1,
      minion ? INK : '#f2ecd8', 'middle');
    cx.shadowColor = 'transparent'; cx.shadowBlur = 0; cx.shadowOffsetY = 0;

    const textZone = minion
      ? { x: 0.09 * W, y: 0.57 * H, w: 0.82 * W, h: 0.26 * H }
      : { x: 0.09 * W, y: 0.625 * H, w: 0.82 * W, h: 0.23 * H };
    drawPara(cx, parseRich(data.text), textZone, Math.round(14.5 * S), 1.25, INK, 'middle');

    if (data.flavor) {
      const fz = minion
        ? { x: 0.26 * W, y: H - 0.035 * H - 0.075 * H, w: 0.48 * W, h: 0.075 * H }
        : { x: 0.12 * W, y: H - 0.11 * H - 0.075 * H, w: 0.76 * W, h: 0.075 * H };
      drawPara(cx, parseRich('<i>' + data.flavor + '</i>'), fz,
        Math.round((minion ? 8.5 : 11) * S), 1.2, '#6a5432', 'bottom');
    }

    if (data.set) {
      const px = 10 * S;
      cx.font = 'bold ' + px + 'px ' + FONT;
      const tw = cx.measureText(data.set.tag).width;
      const padX = 10 * S, ph = px * 1.5;
      const bx = W / 2 - tw / 2 - padX, by = H - 0.014 * H - ph, bw = tw + padX * 2;
      cx.fillStyle = 'rgba(18,13,7,.8)';
      if (cx.roundRect) { cx.beginPath(); cx.roundRect(bx, by, bw, ph, ph / 2); cx.fill(); }
      else cx.fillRect(bx, by, bw, ph);
      const cols = { basica: '#a8c2bb', mazo: '#e2c06a', expansion: '#b995e8', ficha: '#8fa5a0' };
      cx.fillStyle = cols[data.set.kind] || '#cbb98a';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(data.set.tag, W / 2, by + ph / 2 + S);
    }
    /* la placa central se apoya en la superficie plana del marco */
    planeFromCanvas(cv, 0.5, 0.5, 1, 1, surfaceZ(0.5, 0.72, 0.03) + eps);

    /* --- gemas: coste arriba-izda; stats abajo (apoyados en SU relieve) --- */
    const gemW = 0.24, gemH = 0.17;
    const costFx = 0.14, costFy = 0.0975;
    planeFromCanvas(gemCanvas(data.cost, 34, data.discounted ? '#8dff9d' : '#fff'),
      costFx, costFy, gemW, gemH, surfaceZ(costFx, costFy, 0.06) + eps);

    if (data.stats) {
      const weapon = data.stats.kind === 'weapon';
      const aFx = weapon ? 0.155 : 0.14, aFy = weapon ? 0.865 : 0.88;
      const bFx = weapon ? 0.845 : 0.835, bFy = weapon ? 0.865 : 0.885;
      const px = weapon ? 25 : 30;
      planeFromCanvas(gemCanvas(data.stats.a, px, '#fff', weapon ? 'atk' : null),
        aFx, aFy, gemW, gemH, surfaceZ(aFx, aFy, 0.06) + eps);
      planeFromCanvas(gemCanvas(data.stats.b, px, '#fff', weapon ? 'dur' : null),
        bFx, bFy, gemW, gemH, surfaceZ(bFx, bFy, 0.06) + eps);
    }
    fit();
  }

  /* ---------- encuadre ---------- */

  function fit() {
    if (!model || !rawSize) return;
    const vFov = FOV * Math.PI / 180;
    const visH = 2 * Math.tan(vFov / 2) * CAM_Z;
    const visW = visH * (camera.aspect || 0.72);
    /* la carta ocupa 1/OVERSCAN del canvas: margen para girar sin cortes */
    const f = 0.995 / OVERSCAN;
    const cardW = visW * f, cardH = visH * f;
    const sY = cardH / rawSize.y;
    holder.scale.set(cardW / rawSize.x, sY, sY);
    if (illo) {
      const depth = rawSize.z * sY;
      const zIllo = -depth / 2;
      const k = (CAM_Z - zIllo) / CAM_Z;
      const hw = (ART.r - ART.l) * cardW, hh = (ART.b - ART.t) * cardH;
      illo.position.set(((ART.l + ART.r) / 2 - 0.5) * cardW * k, (0.5 - (ART.t + ART.b) / 2) * cardH * k, zIllo);
      illo.scale.set(hw * k * ILLO_MARGIN, hh * k * ILLO_MARGIN, 1);
      if (illoSrc && illoMat.map) {
        applyCover(illoMat.map, illoSrc.w, illoSrc.h, (hw * CARD_W) / (hh * CARD_H) * (cardW / CARD_W) / (cardH / CARD_H));
      }
    }
    /* texto: misma posición en pantalla que la carta plana, compensando
       la perspectiva del relieve donde se apoya */
    for (const p of textPlanes) {
      const fr = p.userData.frac;
      const zW = fr.zRaw * sY;
      const k = (CAM_Z - zW) / CAM_Z;
      p.position.set((fr.fx - 0.5) * cardW * k, (0.5 - fr.fy) * cardH * k, zW);
      p.scale.set(fr.fw * cardW * k, fr.fh * cardH * k, 1);
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
    if (illoVideo && illoMat.map && illoMat.map.isVideoTexture && illoVideo.readyState >= 2) {
      illoMat.map.needsUpdate = true;
    }
    cRX += (tRX - cRX) * 0.16;
    cRY += (tRY - cRY) * 0.16;
    if (pivot) { pivot.rotation.x = cRX; pivot.rotation.y = cRY; }
    renderer.render(scene, camera);
  }

  return {
    supported,
    /* art = { video, url, fallback, emoji }
       data = { type, cost, discounted, name, text, flavor, stats, set } */
    open(container, art, data) {
      if (!supported()) return false;
      active = true;
      pendingArt = art || null;
      pendingData = data || null;
      loadModel(() => {
        if (!active) return;
        container.appendChild(canvas);
        if (pendingArt) loadArt(pendingArt);
        buildText(pendingData);
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
      clearText();
      tRX = tRY = cRX = cRY = 0;
    },
    setTilt(cx, cy) { tRY = cx * 0.62; tRX = -cy * 0.48; },
    resize
  };
})();
