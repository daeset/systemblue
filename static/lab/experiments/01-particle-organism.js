/* 01 — Particle Organism. Three.js for drawing, custom CPU particle physics, sound from 01-sound.js. */
SBL.register('01', {
  mount: function (stage, api) {
    'use strict';
    var canvas = document.createElement('canvas');
    canvas.style.cursor = 'crosshair'; canvas.style.touchAction = 'none';
    stage.appendChild(canvas);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    var ac = new AbortController(), sig = { signal: ac.signal }, raf = 0;

    var W = innerWidth, H = innerHeight;
    var small = Math.min(W, H) < 600;
    var N = small ? 7000 : 16000;
    var DPR = Math.min(devicePixelRatio || 1, 2);
    var BG = new THREE.Color(0x04060c);
    renderer.setPixelRatio(DPR); renderer.autoClear = false; renderer.setClearColor(BG, 1);

    var cam = new THREE.OrthographicCamera(0, W, 0, H, -1, 1);
    var scene = new THREE.Scene();
    var fadeScene = new THREE.Scene(), fadeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // Background layer. Drawn every frame at low alpha, so particle trails fade into it.
    // Static: one muted colour. Flow: four muted tetradic hues, domain-warped, with quirks.
    var wellU = []; for (i = 0; i < 7; i++) wellU.push(new THREE.Vector3());
    var fadeMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        uAlpha: { value: .2 }, uMode: { value: 0 }, uColor: { value: BG.clone() },
        uC0: { value: new THREE.Color() }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() },
        uTime: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uMouse: { value: new THREE.Vector3(-9999, -9999, 0) },
        uW: { value: wellU }, uWN: { value: 0 }, uBand: { value: 0 }, uSleep: { value: 0 }, uFlash: { value: 0 }
      },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: [
        'uniform float uAlpha,uMode,uTime,uWN,uBand,uSleep,uFlash;uniform vec3 uColor,uC0,uC1,uC2,uC3,uMouse;uniform vec2 uRes;uniform vec3 uW[7];varying vec2 vUv;',
        'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}',
        'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*noise(p);p=p*2.03+7.1;a*=.5;}return s/.875;}',
        'void main(){',
        ' vec3 col=uColor;',
        ' if(uMode>.5){',
        '  vec2 px=vec2(vUv.x*uRes.x,(1.-vUv.y)*uRes.y);',
        '  for(int i=0;i<7;i++){if(float(i)>=uWN)break;vec2 d=px-uW[i].xy;float r2=dot(d,d);px-=d*uW[i].z*.55*14000./(r2+14000.);}',  // wells pinch the field
        '  vec2 dm=uMouse.xy-px;px+=dm*uMouse.z*exp(-length(dm)/260.);',                                                     // cursor drags it a little
        '  vec2 p=px/uRes.y;',
        '  vec2 q=vec2(fbm(p*1.25+vec2(0.,uTime*.035)),fbm(p*1.25+vec2(5.2,1.3)-uTime*.028));',
        '  float f=fbm(p*1.5+2.2*q+uTime*.02);',
        '  col=mix(uC0,uC1,smoothstep(.25,.75,q.x));',
        '  col=mix(col,uC2,smoothstep(.4,.8,f));',
        '  col=mix(col,uC3,smoothstep(.45,.85,q.y)*.9);',
        '  for(int i=0;i<7;i++){if(float(i)>=uWN)break;float r=length(px-uW[i].xy);col*=max(.15,1.-.55*uW[i].z/(1.+r*r/900.));}',  // a dark eye at each well
        '  vec2 uv=vUv-.5;col*=1.-.55*dot(uv,uv);',
        '  float g=dot(col,vec3(.3,.59,.11));col=mix(col,vec3(g),uSleep*.85)*(1.-.3*uSleep);',
        '  if(uBand>.01){float lv=mix(40.,4.,uBand);float dz=hash(floor(px/2.)+floor(uTime*12.))-.5;col=floor(col*lv+.5+dz*uBand)/lv;col*=1.-uBand*.22*step(.5,fract(px.y/3.));}',  // 8-bit banding + dither + scanlines
        '  col+=uFlash*.05;',
        ' }',
        ' gl_FragColor=vec4(col,uAlpha);',
        '}'
      ].join('\n')
    });
    var BU = fadeMat.uniforms;
    var fadeGeo = new THREE.PlaneGeometry(2, 2);
    fadeScene.add(new THREE.Mesh(fadeGeo, fadeMat));

    var pos = new Float32Array(N * 3), heat = new Float32Array(N), seed = new Float32Array(N);
    var vx = new Float32Array(N), vy = new Float32Array(N), tx = new Float32Array(N), ty = new Float32Array(N);
    var rad = new Float32Array(N), dir = new Float32Array(N), i;
    for (i = 0; i < N; i++) {
      seed[i] = Math.random();
      rad[i] = Math.pow(Math.random(), .6) + .05;
      dir[i] = Math.random() < .82 ? 1 : -1;
      var a0 = Math.random() * 6.283, r0 = Math.random() * Math.max(W, H) * .7;
      pos[i * 3] = W / 2 + Math.cos(a0) * r0; pos[i * 3 + 1] = H / 2 + Math.sin(a0) * r0;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aHeat', new THREE.BufferAttribute(heat, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    var mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: (small ? 2.4 : 2.1) * DPR }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uAlpha: { value: .55 }, uTime: { value: 0 } },
      vertexShader: 'attribute float aHeat;attribute float aSeed;uniform float uSize;uniform float uTime;varying float vH;varying float vS;void main(){vH=aHeat;vS=aSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=uSize*(.55+aSeed*1.3)*(1.+aHeat*1.2)*(1.+.25*sin(uTime*2.+aSeed*40.));}',
      fragmentShader: 'uniform vec3 uA;uniform vec3 uB;uniform float uAlpha;varying float vH;varying float vS;void main(){float d=length(gl_PointCoord-.5);float f=smoothstep(.5,.05,d);vec3 c=mix(uA,uB,clamp(vH*1.1+vS*.15,0.,1.));gl_FragColor=vec4(c,f*uAlpha*(.6+vH*.6));}'
    });
    var points = new THREE.Points(geo, mat); points.frustumCulled = false; scene.add(points);

    function resize() {
      W = innerWidth; H = innerHeight;
      renderer.setSize(W, H, false); canvas.style.width = '100%'; canvas.style.height = '100%';
      cam.right = W; cam.bottom = H; cam.updateProjectionMatrix();
      renderer.setClearColor(BGS && bgKey !== 'flow' ? bgOf(bgKey).c : BG, 1); renderer.clear();
      if (typeof BU !== 'undefined') BU.uRes.value.set(W, H);
    }
    addEventListener('resize', resize, sig); resize();

    // ---------- discoveries ----------
    var FINDS = { near: 'it leans toward you', flee: 'it startles', shake: 'it seethes', well: 'a well opens', pop: 'the well inverts', merge: 'two wells become one', nova: 'collapse', eye: 'it is watching you', wake: 'it was asleep', spell: 'it listens', pulse: 'a heartbeat', mitosis: 'it divides', drill: 'it loses its temper', skip: 'it skips' };
    FINDS.palette = 'the palette turns';
    var KEYS = Object.keys(FINDS), found = {};
    api.pips(KEYS.length);
    function find(k) { if (found[k]) return; found[k] = 1; api.light(KEYS.indexOf(k)); api.whisper(FINDS[k]); }

    // ---------- state ----------
    var t = 0, last = performance.now();
    var M = { x: W / 2, y: H / 2, on: false, speed: 0, shake: 0, lastMove: 0, pdx: 0, pdy: 0, pt: 0, slow: 0, down: false };
    var wells = [], holdWell = null;
    var lastTouch = 0, asleep = false, sleepK = 0, agit = 0;
    var shape = { k: 0, on: false, until: 0, next: 18 + Math.random() * 14 };
    var lobes = { k: 3, amp: .18, tk: 3, ta: .18, next: 12 };
    var split = 0, splitT = 0, splitUntil = 0, nextSplit = 70 + Math.random() * 60;
    var pulseAt = -9, typed = '', typedAt = 0;
    var cx = W / 2, cy = H / 2, cA = new THREE.Color(), cB = new THREE.Color(), hue = .5;

    // ---------- background: muted tetradic palette ----------
    var H0 = 222; // systemblue; the tetrad is H0, +90, +180, +270
    var BGS = [
      { k: 'void', name: 'Void', c: BG.clone() },
      { k: 'slate', name: 'Slate', c: new THREE.Color().setHSL(H0 / 360, .26, .12) },
      { k: 'plum', name: 'Plum', c: new THREE.Color().setHSL(((H0 + 90) % 360) / 360, .22, .12) },
      { k: 'ochre', name: 'Ochre', c: new THREE.Color().setHSL(((H0 + 180) % 360) / 360, .3, .11) },
      { k: 'moss', name: 'Moss', c: new THREE.Color().setHSL(((H0 + 270) % 360) / 360, .2, .11) },
      { k: 'flow', name: 'Flow', c: BG.clone() }
    ];
    var bgKey = 'void';
    try { var sv = localStorage.getItem('sbl-01-bg'); if (BGS.some(function (b) { return b.k === sv; })) bgKey = sv; } catch (e) {}
    function bgOf(k) { for (var n = 0; n < BGS.length; n++) if (BGS[n].k === k) return BGS[n]; return BGS[0]; }
    BU.uColor.value.copy(bgOf(bgKey).c);
    var hueDrift = 0, hueOff = 0, hueOffCur = 0, roll = 0, glitch = 0, bgFlash = 0, nextSwap = 70 + Math.random() * 60;
    var SL = [.2, .15, .18, .13], SS = [.42, .34, .4, .3];
    function bgGlitch() { roll = (roll + 1) % 4; glitch = 1; }
    function cssHex(c) { return '#' + c.getHexString(); }
    function flowCss() { var c = [0, 1, 2, 3].map(function (k) { return cssHex(new THREE.Color().setHSL(((H0 + 90 * k) % 360) / 360, SS[k] + .1, SL[k] + .12)); }); return 'conic-gradient(' + c.join(',') + ',' + c[0] + ')'; }

    var slot = api.slot && api.slot(), bgBtn = null, bgMenu = null, bgDot = null;
    if (slot) {
      var wrap = document.createElement('div'); wrap.className = 'bgpick';
      bgBtn = document.createElement('button'); bgBtn.type = 'button'; bgBtn.className = 'hudbtn';
      bgBtn.setAttribute('aria-haspopup', 'true'); bgBtn.setAttribute('aria-expanded', 'false');
      bgDot = document.createElement('i'); bgDot.className = 'sw sm';
      var lbl = document.createElement('span'); lbl.textContent = 'BG';
      bgBtn.appendChild(bgDot); bgBtn.appendChild(lbl);
      bgMenu = document.createElement('div'); bgMenu.className = 'bgmenu'; bgMenu.hidden = true; bgMenu.setAttribute('role', 'group'); bgMenu.setAttribute('aria-label', 'Background');
      BGS.forEach(function (b, n) {
        if (n === BGS.length - 1) { var sep = document.createElement('span'); sep.className = 'bgsep'; bgMenu.appendChild(sep); }
        var o = document.createElement('button'); o.type = 'button'; o.className = 'sw'; o.dataset.k = b.k;
        o.title = b.k === 'flow' ? 'Flow (moving gradient)' : b.name; o.setAttribute('aria-label', o.title);
        o.style.background = b.k === 'flow' ? flowCss() : cssHex(b.c);
        o.addEventListener('click', function () { setBg(b.k); });
        bgMenu.appendChild(o);
      });
      wrap.appendChild(bgBtn); wrap.appendChild(bgMenu); slot.appendChild(wrap);
      bgBtn.addEventListener('click', function () { menu(bgMenu.hidden); }, sig);
      document.addEventListener('pointerdown', function (e) { if (!wrap.contains(e.target)) menu(false); }, sig);
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bgMenu.hidden) { menu(false); bgBtn.focus(); e.stopPropagation(); } }, { capture: true, signal: ac.signal });
    }
    function menu(open) { if (!bgMenu) return; bgMenu.hidden = !open; bgBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    function setBg(k) {
      bgKey = k; try { localStorage.setItem('sbl-01-bg', k); } catch (e) {}
      if (bgMenu) [].forEach.call(bgMenu.children, function (o) { if (o.dataset && o.dataset.k) o.setAttribute('aria-pressed', o.dataset.k === k ? 'true' : 'false'); });
      if (bgDot) bgDot.style.background = k === 'flow' ? flowCss() : cssHex(bgOf(k).c);
      bgBtn && bgBtn.setAttribute('aria-label', 'Background: ' + bgOf(k).name);
    }
    setBg(bgKey);

    // ---------- sound ----------
    var snd = null, kickTimers = [];
    try {
      var A = api.audio && api.audio();
      if (A && SBL.organismSound) snd = SBL.organismSound(A, {
        kick: function (delay) { kickTimers.push(setTimeout(function () { burst(M.on ? M.x : cx, M.on ? M.y : cy, 110, Math.min(W, H) * .32); bgFlash = 1; }, Math.max(0, delay * 1000))); if (kickTimers.length > 40) kickTimers.shift(); },
        found: function (k) { if (k === 'skip') bgGlitch(); find(k); }
      });
    } catch (e) { snd = null; }
    function S(name) { if (!snd) return; try { snd[name].apply(snd, [].slice.call(arguments, 1)); } catch (e) {} }

    // ---------- shapes (rasterised, then sampled) ----------
    var sc = document.createElement('canvas'), sx = sc.getContext('2d');
    function sample(w, h, draw) {
      sc.width = w; sc.height = h; sx.clearRect(0, 0, w, h); sx.fillStyle = '#fff'; sx.strokeStyle = '#fff'; sx.lineCap = 'round'; sx.lineJoin = 'round';
      draw(sx, w, h);
      var d = sx.getImageData(0, 0, w, h).data, pts = [];
      for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 120) pts.push(x, y);
      if (pts.length < 4) return false;
      var s = Math.min(W * .82 / w, H * .62 / h), ox = W / 2 - w * s / 2, oy = H / 2 - h * s / 2, n = pts.length / 2;
      for (var i = 0; i < N; i++) { var j = ((i * 7919) % n) * 2; tx[i] = ox + (pts[j] + Math.random() * 2) * s; ty[i] = oy + (pts[j + 1] + Math.random() * 2) * s; }
      return true;
    }
    var SHAPES = [
      function (c) { c.beginPath(); for (var a = 0; a < 6.3; a += .02) { var x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); c.lineTo(128 + x * 6.6, 118 - y * 6.6); } c.lineWidth = 16; c.stroke(); },
      function (c) { c.lineWidth = 9; c.beginPath(); c.moveTo(14, 128); c.quadraticCurveTo(128, 22, 242, 128); c.quadraticCurveTo(128, 234, 14, 128); c.stroke(); c.beginPath(); c.arc(128, 128, 44, 0, 7); c.stroke(); c.beginPath(); c.arc(128, 128, 17, 0, 7); c.fill(); },
      function (c) { c.lineWidth = 9; c.beginPath(); for (var a = 0; a < 22; a += .05) { var r = 4 + a * 5.2; c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } c.stroke(); },
      function (c) { c.beginPath(); c.arc(120, 128, 100, 0, 7); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(162, 104, 86, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; },
      function (c) { c.lineWidth = 13; c.beginPath(); c.arc(128, 48, 24, 0, 7); c.stroke(); c.beginPath(); c.moveTo(128, 74); c.lineTo(128, 160); c.lineTo(88, 240); c.moveTo(128, 160); c.lineTo(168, 240); c.moveTo(60, 84); c.lineTo(128, 108); c.lineTo(196, 84); c.stroke(); },
      function (c) { c.lineWidth = 14; c.beginPath(); for (var a = 0; a < 6.3; a += .02) { var d = 1 + Math.sin(a) * Math.sin(a); c.lineTo(128 + 112 * Math.cos(a) / d, 128 + 150 * Math.sin(a) * Math.cos(a) / d); } c.closePath(); c.stroke(); },
      function (c) { c.lineWidth = 10; c.beginPath(); for (var k = 0; k <= 10; k++) { var r = k % 2 ? 46 : 116, a = -1.5708 + k * .6283; c.lineTo(128 + Math.cos(a) * r, 132 + Math.sin(a) * r); } c.closePath(); c.stroke(); },
      function (c) { c.beginPath(); c.ellipse(128, 180, 52, 56, 0, 0, 7); c.fill(); c.lineWidth = 22; [[-46, -.5, 70], [-24, -.2, 104], [0, 0, 116], [24, .2, 104]].forEach(function (f) { c.beginPath(); c.moveTo(128 + f[0], 160); c.lineTo(128 + f[0] + Math.sin(f[1]) * f[2], 160 - Math.cos(f[1]) * f[2]); c.stroke(); }); c.beginPath(); c.moveTo(168, 190); c.lineTo(226, 140); c.stroke(); }
    ];
    var shapeIdx = Math.floor(Math.random() * SHAPES.length);
    function formShape() {
      shapeIdx = (shapeIdx + 1 + Math.floor(Math.random() * (SHAPES.length - 1))) % SHAPES.length;
      if (sample(256, 256, SHAPES[shapeIdx])) { shape.on = true; shape.until = t + 7.5; S('shape', shapeIdx); }
    }
    function formText(s) {
      var ok = sample(640, 180, function (c, w, h) { c.font = '700 120px Georgia,serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; var m = c.measureText(s).width; if (m > w - 20) c.font = '700 ' + Math.floor(120 * (w - 20) / m) + 'px Georgia,serif'; c.fillText(s, w / 2, h / 2); });
      if (ok) { shape.on = true; shape.until = t + 4.5; }
    }
    function dissolve() { if (!shape.on) return; shape.on = false; shape.next = t + 24 + Math.random() * 22; burst(W / 2, H / 2, 160, Math.max(W, H)); }
    function burst(x, y, p, R) {
      var R2 = R * R;
      for (var i = 0; i < N; i++) { var dx = pos[i * 3] - x, dy = pos[i * 3 + 1] - y, d2 = dx * dx + dy * dy; if (d2 < R2) { var d = Math.sqrt(d2) + 1, f = p * (1 - d / R) * (.5 + seed[i]); vx[i] += dx / d * f; vy[i] += dy / d * f; heat[i] = 1; } }
    }

    // ---------- input ----------
    function touch() { lastTouch = t; if (asleep) { asleep = false; burst(M.x, M.y, 420, Math.max(W, H) * .6); find('wake'); S('wake'); } }
    canvas.addEventListener('pointermove', function (e) {
      var now = performance.now(), dt = Math.max(1, now - M.pt) / 1000, dx = e.clientX - M.x, dy = e.clientY - M.y, sp = Math.hypot(dx, dy) / dt;
      if (M.on) {
        M.speed += (sp - M.speed) * .35;
        if (sp > 350 && dx * M.pdx + dy * M.pdy < -.3 * Math.hypot(dx, dy) * Math.hypot(M.pdx, M.pdy)) M.shake = Math.min(8, M.shake + 1);
        if (Math.hypot(dx, dy) > 2) { M.pdx = dx; M.pdy = dy; }
      }
      M.x = e.clientX; M.y = e.clientY; M.pt = now; M.on = true;
      if (Math.hypot(dx, dy) > 3) M.lastMove = t;
      touch();
    }, sig);
    canvas.addEventListener('pointerleave', function () { M.on = false; }, sig);
    canvas.addEventListener('pointerdown', function (e) {
      M.x = e.clientX; M.y = e.clientY; M.on = true; M.down = true; M.lastMove = t; M.pt = performance.now(); touch();
      if (shape.on) dissolve();
      for (var i = 0; i < wells.length; i++) { var w = wells[i]; if (Math.hypot(w.x - M.x, w.y - M.y) < 46) { wells.splice(i, 1); S('pop', w); burst(w.x, w.y, 700 * w.m, 360); find('pop'); return; } }
      if (wells.length >= 7) wells.shift();
      holdWell = { x: M.x, y: M.y, m: 1, born: t, life: 14, f: 0 }; wells.push(holdWell); find('well');
    }, sig);
    addEventListener('pointerup', function (e) { M.down = false; holdWell = null; if (e.pointerType === 'touch') M.on = false; }, sig);
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') { e.preventDefault(); touch(); pulseAt = t; burst(cx, cy, 340, Math.min(W, H) * .6); find('pulse'); S('pulse'); return; }
      if (e.key === 'Backspace') typed = typed.slice(0, -1);
      else if (e.key.length === 1) { if (t - typedAt > 3) typed = ''; typed = (typed + e.key).slice(-10); S('key', e.key); }
      else return;
      typedAt = t; touch();
      if (typed.trim()) { formText(typed); find('spell'); }
    }, sig);

    // ---------- simulation ----------
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(.033, (now - last) / 1000); last = now; if (dt <= 0) return; t += dt;

      M.speed *= Math.pow(.02, dt); M.shake = Math.max(0, M.shake - 1.6 * dt);
      var still = M.on && (t - M.lastMove > 2.2) && !M.down;
      var mode = 0; // 1 attract · 2 repel · 3 agitate · 4 eye
      if (M.on) mode = M.shake > 3 ? 3 : (M.speed > 1100 ? 2 : (still ? 4 : 1));
      if (mode === 1) { M.slow += dt; if (M.slow > 2.5) find('near'); }
      if (mode === 2) find('flee'); if (mode === 3) find('shake');
      if (mode === 4 && t - M.lastMove > 4.5) find('eye');
      agit += ((mode === 3 ? 1 : 0) - agit) * dt * 2;
      if (agit > .85) find('drill');

      if (!asleep && t - lastTouch > 28 && !wells.length && !shape.on) { asleep = true; S('sleep'); }
      sleepK += ((asleep ? 1 : 0) - sleepK) * dt * .6;

      if (t > lobes.next) { lobes.tk = 2 + Math.floor(Math.random() * 6); lobes.ta = .08 + Math.random() * .3; lobes.next = t + 14 + Math.random() * 16; }
      lobes.k += (lobes.tk - lobes.k) * dt * .25; lobes.amp += (lobes.ta - lobes.amp) * dt * .4;
      if (t > nextSplit && !asleep && !shape.on) { splitUntil = t + 12; nextSplit = t + 80 + Math.random() * 80; find('mitosis'); }
      splitT = t < splitUntil ? Math.min(W, H) * .24 : 0; split += (splitT - split) * dt * .8;

      if (!shape.on && t > shape.next && !asleep && !wells.length) formShape();
      if (shape.on && t > shape.until) dissolve();
      shape.k += ((shape.on ? 1 : 0) - shape.k) * dt * (shape.on ? 1.6 : 5);

      var m = Math.min(W, H), gx = W / 2 + Math.sin(t * .13) * W * .14 + Math.sin(t * .31) * W * .05, gy = H / 2 + Math.cos(t * .17) * H * .12;
      if (mode === 1) { gx += (M.x - gx) * .35; gy += (M.y - gy) * .35; }
      cx += (gx - cx) * dt * .9; cy += (gy - cy) * dt * .9;
      var beat = Math.exp(-(t - pulseAt) * 3) * .25;
      var breath = 1 + (.1 - .04 * sleepK) * Math.sin(t * (.9 - .5 * sleepK)) + beat;
      var R = m * .3 * breath * (1 - .45 * sleepK);
      var flowF = 46 * (1 - .7 * sleepK) * (1 + agit * 2), swirl = 34 * (1 - .6 * sleepK);
      var damp = Math.pow(shape.k > .5 ? .02 : .07, dt);
      var Rc = m * (mode === 3 ? .34 : .28), Rc2 = Rc * Rc, sh = shape.k, lk = Math.round(lobes.k), la = lobes.amp, ph = t * .5;

      for (var a = wells.length - 1; a >= 0; a--) {
        var w = wells[a]; if (w === holdWell && M.down) { w.m = Math.min(2.6, w.m + dt * .8); w.life = Math.max(w.life, t - w.born + 10); }
        if (t - w.born > w.life) { wells.splice(a, 1); continue; }
        w.f = w.m * Math.min(1, (w.life - (t - w.born)) / 3) * Math.min(1, (t - w.born) * 3);
        for (var b = a - 1; b >= 0; b--) {
          var o = wells[b], ddx = o.x - w.x, ddy = o.y - w.y, dd = Math.hypot(ddx, ddy) + 1;
          if (dd < 34) {
            S('merge', w, o); o.x = (o.x + w.x) / 2; o.y = (o.y + w.y) / 2; o.m += w.m; o.life = t - o.born + 14; wells.splice(a, 1); find('merge'); burst(o.x, o.y, 220, 220);
            if (o.m >= 3.4) { S('pop', o); S('nova'); hueOff += 90; glitch = Math.max(glitch, .5); if (bgKey === 'flow') find('palette'); wells.splice(b, 1); burst(o.x, o.y, 1500, Math.max(W, H)); find('nova'); shape.next = t + 1.2; }
            break;
          }
          var pull = dt * 41600 / (dd * dd + 4000); w.x += ddx / dd * pull * o.m; w.y += ddy / dd * pull * o.m; o.x -= ddx / dd * pull * w.m; o.y -= ddy / dd * pull * w.m;
        }
      }
      var nw = wells.length;

      for (var i = 0; i < N; i++) {
        var j = i * 3, x = pos[j], y = pos[j + 1], s = seed[i];
        var ox = cx + ((i & 1) ? split : -split), dx = x - ox, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) + .001, nx = dx / d, ny = dy / d;
        var ang = Math.atan2(dy, dx);
        var rt = R * rad[i] * (1 + la * Math.sin(lk * ang + ph + s * .6));
        var fr = (rt - d) * 2.2, sw = swirl * dir[i] * (.4 + s);
        var fa = (Math.sin(x * .0042 + t * .31 + s) + Math.cos(y * .0051 - t * .27)) * 3.1416;
        var ax = nx * fr - ny * sw + Math.cos(fa) * flowF, ay = ny * fr + nx * sw + Math.sin(fa) * flowF;
        if (sh > .01) { var k = sh * sh; ax = ax * (1 - k) + (tx[i] - x) * 9 * k; ay = ay * (1 - k) + (ty[i] - y) * 9 * k; }
        if (mode) {
          var mx = M.x - x, my = M.y - y, m2 = mx * mx + my * my;
          if (m2 < Rc2) {
            var dm = Math.sqrt(m2) + .01, q = 1 - dm / Rc, ux = mx / dm, uy = my / dm;
            if (mode === 1) { ax += ux * 300 * q - uy * 90 * q; ay += uy * 300 * q + ux * 90 * q; }
            else if (mode === 2) { ax -= ux * 2600 * q; ay -= uy * 2600 * q; }
            else if (mode === 3) { vx[i] += (Math.random() - .5) * 7200 * q * dt; vy[i] += (Math.random() - .5) * 7200 * q * dt; }
            else { var ring = (s < .25 ? 18 : m * .085), e = (dm - ring) * 9 * q; ax += ux * e - uy * 160 * q * dir[i]; ay += uy * e + ux * 160 * q * dir[i]; }
          }
        }
        for (var a2 = 0; a2 < nw; a2++) {
          var wl = wells[a2], wx = wl.x - x, wy = wl.y - y, r2 = wx * wx + wy * wy + 900, inv = wl.f * 3e6 / (r2 * Math.sqrt(r2));
          ax += wx * inv - wy * inv * .55; ay += wy * inv + wx * inv * .55;
        }
        var nvx = (vx[i] + ax * dt) * damp, nvy = (vy[i] + ay * dt) * damp;
        vx[i] = nvx; vy[i] = nvy; pos[j] = x + nvx * dt; pos[j + 1] = y + nvy * dt;
        var hh = Math.sqrt(nvx * nvx + nvy * nvy) * .0022; if (hh > 1) hh = 1; heat[i] += (hh - heat[i]) * .12;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aHeat.needsUpdate = true;

      var th = .5 + .1 * Math.sin(t * .021) + Math.floor(t / 95) * .17; th = th - Math.floor(th);
      if (agit > .05) th += (.9 - th) * agit; th += (.72 - th) * sleepK;
      hue += (th - hue) * dt * .8;
      cA.setHSL(hue, .72, .52 - .12 * sleepK); cB.setHSL((hue + .52) % 1, .95, .78);
      mat.uniforms.uA.value.copy(cA); mat.uniforms.uB.value.copy(cB);
      mat.uniforms.uAlpha.value = (small ? .6 : .5) * (1 - .45 * sleepK); mat.uniforms.uTime.value = t;
      BU.uAlpha.value = .24 - .12 * Math.min(1, agit + sh * .3) + .1 * sleepK;
      var flow = bgKey === 'flow';
      BU.uMode.value = flow ? 1 : 0;
      if (!flow) BU.uColor.value.lerp(bgOf(bgKey).c, 1 - Math.exp(-dt * 5));
      else {
        hueDrift += dt * .5; hueOffCur += (hueOff - hueOffCur) * dt * 1.4;
        if (t > nextSwap) { bgGlitch(); nextSwap = t + 70 + Math.random() * 70; }
        var hb = H0 + hueDrift + hueOffCur, cs = [BU.uC0.value, BU.uC1.value, BU.uC2.value, BU.uC3.value];
        for (var q = 0; q < 4; q++) { var kq = (q + roll) % 4; cs[q].setHSL((((hb + 90 * kq) % 360) + 360) % 360 / 360, SS[kq], SL[kq]); }
        BU.uTime.value = t;
        BU.uMouse.value.set(M.on ? M.x : -9999, M.on ? M.y : -9999, mode === 1 ? .12 : mode === 4 ? -.08 : .04);
        BU.uWN.value = nw;
        for (var wq = 0; wq < 7; wq++) { if (wq < nw) wellU[wq].set(wells[wq].x, wells[wq].y, Math.max(0, wells[wq].f || 0) * .5); }
        BU.uBand.value = Math.min(1, Math.max(agit * 1.1, glitch));
        BU.uSleep.value = sleepK;
        BU.uFlash.value = bgFlash;
      }
      glitch = Math.max(0, glitch - dt * 1.6); bgFlash = Math.max(0, bgFlash - dt * 6);

      S('update', { dt: dt, mode: mode, mx: M.x / W, my: M.y / H, agit: agit, sleep: asleep, sleepK: sleepK, split: split / (Math.min(W, H) * .24), shape: sh, wells: nw, wellList: wells, W: W, activity: Math.min(1, M.speed / 900) });

      renderer.render(fadeScene, fadeCam);
      renderer.render(scene, cam);
    }
    raf = requestAnimationFrame(frame);

    return function unmount() {
      cancelAnimationFrame(raf); ac.abort(); kickTimers.forEach(clearTimeout); S('stop');
      geo.dispose(); mat.dispose(); fadeGeo.dispose(); fadeMat.dispose(); renderer.dispose();
    };
  }
});
