/* 03 — Sonic Architecture. Three.js scene driven by FFT analysis of the music (03-sound.js).
   Bass builds large forms (a breathing core, rising floor frames, wide columns at the spiral's heart);
   mids turn the orbiting lattice; highs light the fine detail (thin outer columns, cables, sparks). */
SBL.register('03', {
  mount: function (stage, api) {
    'use strict';
    var ac = new AbortController(), sig = { signal: ac.signal };
    var W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, 2), small = Math.min(W, H) < 600;
    var TAU = Math.PI * 2;
    function lerp(a, b, k) { return a + (b - a) * k; }
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function rnd(a, b) { return a + Math.random() * (b - a); }

    var canvas = document.createElement('canvas');
    canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none'; canvas.setAttribute('aria-label', 'A city of geometric structures that the music builds');
    stage.appendChild(canvas);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(DPR);
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, W / H, .1, 300);
    scene.fog = new THREE.FogExp2(0x000000, .024);
    var pivot = new THREE.Group(); pivot.position.y = 6; scene.add(pivot);
    var world = new THREE.Group(); world.position.y = -6; pivot.add(world);
    var disposables = [];
    function keep(x) { disposables.push(x); return x; }

    // ---------- palettes: one per mood, plus the blueprint surprise ----------
    var MOODS = [
      { k: 'brutalist', name: 'Brutalist', bg: '#0c0c0d', base: '#252422', struct: '#b9b4aa', accent: '#ff5a1f', fine: '#f3efe6', grid: '#34322f' },
      { k: 'glasshouse', name: 'Glasshouse', bg: '#030912', base: '#0a1f2e', struct: '#3fd3d6', accent: '#a294ff', fine: '#e6fbff', grid: '#10303f' },
      { k: 'neon', name: 'Neon Cathedral', bg: '#08030e', base: '#1b0928', struct: '#c33cff', accent: '#ffcf3a', fine: '#ff73b6', grid: '#2a1238' },
      { k: 'ruins', name: 'Ruins', bg: '#13100c', base: '#2a2118', struct: '#d6a979', accent: '#c9572f', fine: '#f0e5cd', grid: '#3a2e22' }
    ];
    var BLUEPRINT = { bg: '#0b2a6b', base: '#0e3383', struct: '#e8f0ff', accent: '#ffffff', fine: '#bcd3ff', grid: '#3a64b8' };
    var ROLES = ['bg', 'base', 'struct', 'accent', 'fine', 'grid'];
    var C = {}; ROLES.forEach(function (r) { C[r] = new THREE.Color(); });
    function moodOf(k) { for (var i = 0; i < MOODS.length; i++) if (MOODS[i].k === k) return MOODS[i]; return MOODS[0]; }
    var P = { mood: 'brutalist', react: 1, memory: .5 };
    try { var sv = JSON.parse(localStorage.getItem('sbl-03') || 'null'); if (sv) { if (MOODS.some(function (m) { return m.k === sv.mood; })) P.mood = sv.mood; if (typeof sv.react === 'number') P.react = clamp(sv.react, .4, 1.8); if (typeof sv.memory === 'number') P.memory = clamp(sv.memory, 0, 1); } } catch (e) {}
    function save() { try { localStorage.setItem('sbl-03', JSON.stringify(P)); } catch (e) {} }
    var blueUntil = -1;
    function palette() { return t < blueUntil ? BLUEPRINT : moodOf(P.mood); }
    (function () { var p = moodOf(P.mood); ROLES.forEach(function (r) { C[r].set(p[r]); }); })();
    var tmpC = new THREE.Color();

    // ---------- discoveries ----------
    var FINDS = { pluck: 'a column sings', build: 'you built something', shatter: 'the core breaks', play: 'you are playing it', drop: 'the drop', blueprint: 'blueprint', invert: 'the city hangs', dilate: 'time thickens', track: 'your music, your city', orbit: 'it has another side' };
    if (api.touch) { FINDS.twist = 'the tower twists'; FINDS.sink = 'the city sinks'; FINDS.ring = 'a circle of voices'; FINDS.scratch = 'scratch'; FINDS.tempo = 'the city keeps your time'; FINDS.away = 'it kept building'; }
    var KEYS = Object.keys(FINDS), found = {};
    api.pips(KEYS.length);
    function find(k) { if (found[k]) return; found[k] = 1; api.light(KEYS.indexOf(k)); api.whisper(FINDS[k]); }

    // ---------- ground ----------
    var gp = [], GS = 60;
    for (var g = -GS; g <= GS; g += 2) gp.push(-GS, 0, g, GS, 0, g, g, 0, -GS, g, 0, GS);
    var gridGeo = keep(new THREE.BufferGeometry()); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    var gridMat = keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 }));
    world.add(new THREE.LineSegments(gridGeo, gridMat));
    var ringMat = keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35 }));
    function circleGeo(r, n) { var a = []; for (var i = 0; i < n; i++) { var q = i / n * TAU; a.push(Math.cos(q) * r, 0, Math.sin(q) * r); } var gg = keep(new THREE.BufferGeometry()); gg.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return gg; }
    [6, 12, 20].forEach(function (r) { var l = new THREE.LineLoop(circleGeo(r, 128), ringMat); l.position.y = .01; world.add(l); });

    // ---------- the spiral city: one column per FFT band, bass at the heart ----------
    var N = small ? 72 : 96;
    var colGeo = keep(new THREE.BoxGeometry(1, 1, 1)); colGeo.translate(0, .5, 0);
    var aLevel = new Float32Array(N), aT = new Float32Array(N), aFlash = new Float32Array(N);
    var levelAttr = new THREE.InstancedBufferAttribute(aLevel, 1), flashAttr = new THREE.InstancedBufferAttribute(aFlash, 1);
    levelAttr.setUsage(THREE.DynamicDrawUsage); flashAttr.setUsage(THREE.DynamicDrawUsage);
    colGeo.setAttribute('aLevel', levelAttr); colGeo.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 1)); colGeo.setAttribute('aFlash', flashAttr);
    var colMat = keep(new THREE.ShaderMaterial({
      extensions: { derivatives: true },
      uniforms: { uBase: { value: C.base }, uStruct: { value: C.struct }, uAccent: { value: C.accent }, uFog: { value: C.bg }, uFogD: { value: .024 } },
      vertexShader: [
        'attribute float aLevel;attribute float aT;attribute float aFlash;',
        'varying vec2 vUv;varying float vL;varying float vF;varying float vTop;varying float vDepth;varying float vWY;',
        'void main(){vUv=uv;vL=aLevel;vF=aFlash;vTop=step(.5,normal.y);',
        ' vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.);vWY=wp.y;',
        ' vec4 mv=viewMatrix*wp;vDepth=-mv.z;gl_Position=projectionMatrix*mv;}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uBase,uStruct,uAccent,uFog;uniform float uFogD;',
        'varying vec2 vUv;varying float vL;varying float vF;varying float vTop;varying float vDepth;varying float vWY;',
        'void main(){',
        ' vec2 fw=max(fwidth(vUv),vec2(1e-4));vec2 d=min(vUv,1.-vUv)/fw;float e=1.-smoothstep(.5,1.6,min(d.x,d.y));',
        ' float L=clamp(vL,0.,1.);',
        ' vec3 fill=mix(uBase,uStruct,.06+.2*L+.22*vTop);',
        ' float fl=(1.-vTop)*(1.-smoothstep(.0,.08,abs(fract(vWY*1.25)-.5)-.42));',   // floor lines
        ' fill+=uStruct*fl*(.08+.45*L);',
        ' vec3 edge=mix(uStruct,uAccent,clamp(L*L*1.4+vF,0.,1.));',
        ' vec3 col=mix(fill,edge,e)+uAccent*vF*.3;',
        ' float fog=1.-exp(-uFogD*uFogD*vDepth*vDepth);',
        ' gl_FragColor=vec4(mix(col,uFog,clamp(fog,0.,1.)),1.);}'
      ].join('\n')
    }));
    var cols = new THREE.InstancedMesh(colGeo, colMat, N); cols.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cols.frustumCulled = false; world.add(cols);
    var CI = [];
    for (var i = 0; i < N; i++) {
      var tt = i / (N - 1), ang = i * .5, rad = 3.6 + tt * 16;
      CI.push({ x: Math.cos(ang) * rad, z: Math.sin(ang) * rad, ang: ang, w: lerp(1.7, .16, Math.pow(tt, .6)), hMax: lerp(11, 5.5, tt), h: .1, lv: 0, kick: 0 });
      aT[i] = tt;
    }
    var dummy = new THREE.Object3D();

    // ---------- the core: bass made solid ----------
    var core = new THREE.Group(); core.position.y = 5.6; world.add(core);
    var icoGeo = keep(new THREE.IcosahedronGeometry(2.3, 0));
    var coreMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    var coreSolid = new THREE.Mesh(icoGeo, coreMat); core.add(coreSolid);
    var coreEdgeMat = keep(new THREE.LineBasicMaterial({ color: 0xffffff }));
    var coreEdges = new THREE.LineSegments(keep(new THREE.EdgesGeometry(icoGeo)), coreEdgeMat); core.add(coreEdges);
    var innerMat = keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 }));
    var inner = new THREE.LineSegments(keep(new THREE.EdgesGeometry(keep(new THREE.DodecahedronGeometry(1.15, 0)))), innerMat); core.add(inner);
    var haloMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6 }));
    var halos = [0, 1].map(function (k) { var m = new THREE.Mesh(keep(new THREE.TorusGeometry(3.4 + k * .7, .018, 4, 128)), haloMat); m.rotation.x = Math.PI / 2 + (k ? .5 : -.35); core.add(m); return m; });
    // shards for the shatter
    var shards = new THREE.Group(); shards.visible = false; core.add(shards);
    var shardList = [], ip = icoGeo.attributes.position;
    for (var f = 0; f < ip.count / 3; f++) {
      var c = new THREE.Vector3(), vs = [];
      for (var v = 0; v < 3; v++) { var pv = new THREE.Vector3().fromBufferAttribute(ip, f * 3 + v); vs.push(pv); c.add(pv); }
      c.multiplyScalar(1 / 3);
      var arr = []; vs.forEach(function (pv) { arr.push(pv.x - c.x, pv.y - c.y, pv.z - c.z); });
      var sg = keep(new THREE.BufferGeometry()); sg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      var sh = new THREE.Group(); sh.add(new THREE.Mesh(sg, coreMat)); sh.add(new THREE.LineLoop(sg, coreEdgeMat));
      sh.position.copy(c); shards.add(sh);
      shardList.push({ o: sh, home: c.clone(), vel: new THREE.Vector3(), spin: new THREE.Vector3() });
    }
    var shatter = { on: false, t0: 0 };

    // ---------- floors and portals: one per bass hit ----------
    var ARCH = {
      brutalist: keep(new THREE.TorusGeometry(1, .02, 4, 4)),
      glasshouse: keep(new THREE.TorusGeometry(1, .012, 6, 96)),
      neon: keep(new THREE.TorusGeometry(1, .016, 4, 3)),
      ruins: keep(new THREE.TorusGeometry(1, .024, 6, 48, Math.PI))
    };
    var arches = [];
    for (i = 0; i < 18; i++) { var am = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); var mesh = new THREE.Mesh(ARCH.brutalist, am); mesh.visible = false; world.add(mesh); arches.push({ m: mesh, mat: am, life: 0, age: 9, kind: 0, s0: 1, grow: 1, vy: 0, accent: 0 }); }
    var archN = 0, beatCount = 0;
    function spawnArch(power, portal) {
      var a = arches[archN++ % arches.length], mk = P.mood, m = a.m;
      m.geometry = ARCH[mk]; a.age = 0; a.life = lerp(3, 13, P.memory) * (portal ? .7 : 1); a.accent = power; m.visible = true;
      m.rotation.set(0, 0, 0); m.position.set(0, 0, 0);
      if (mk === 'ruins' && !portal) { // arches standing on the ground in a colonnade
        var yaw = beatCount * 2.39996; m.position.set(Math.cos(yaw) * 4.5, 0, Math.sin(yaw) * 4.5); m.rotation.y = -yaw + Math.PI / 2;
        a.s0 = 1.6 + power * 1.8; a.grow = .25; a.vy = 0;
      } else if (portal) { // vertical gates around the core
        m.position.y = 5.6; m.rotation.y = Math.random() * TAU; a.s0 = 3; a.grow = 2.4; a.vy = 0;
      } else { // horizontal floors that rise and twist into a tower
        m.rotation.x = Math.PI / 2; m.rotation.z = beatCount * (.13 + twist) + (mk === 'brutalist' ? Math.PI / 4 : 0); m.position.y = .15;
        a.s0 = 3.2 + power * 3.5; a.grow = .12; a.vy = 1.1 + power * .6;
      }
      beatCount++;
    }

    // ---------- mid lattice ----------
    var octGeo = keep(new THREE.EdgesGeometry(keep(new THREE.OctahedronGeometry(1, 0))));
    var lattice = new THREE.Group(); world.add(lattice);
    var LAT = [];
    for (i = 0; i < 10; i++) {
      var lm = keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 })), lo = new THREE.LineSegments(octGeo, lm), la = i / 10 * TAU;
      lo.position.set(Math.cos(la) * 9, 3.2 + (i % 3) * 1.7, Math.sin(la) * 9); lattice.add(lo);
      LAT.push({ o: lo, mat: lm, f: 400 * Math.pow(2600 / 400, i / 9), v: 0, hit: 0 });
    }

    // ---------- fine detail: dust, sparks and cables ----------
    var NP = small ? 1400 : 2600, pPos = new Float32Array(NP * 3), PD = [];
    for (i = 0; i < NP; i++) { var pr = 2 + Math.sqrt(Math.random()) * 22, pa = Math.random() * TAU, py = Math.random() * 16; PD.push({ r: pr, a: pa, y: py, sp: rnd(.6, 1.4), mode: 0, vx: 0, vy: 0, vz: 0, life: 0 }); }
    var pGeo = keep(new THREE.BufferGeometry()); var pAttr = new THREE.BufferAttribute(pPos, 3); pAttr.setUsage(THREE.DynamicDrawUsage); pGeo.setAttribute('position', pAttr);
    var pMat = keep(new THREE.PointsMaterial({ color: 0xffffff, size: small ? .12 : .09, sizeAttenuation: true, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
    var points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; world.add(points);
    var PAIRS = []; for (i = 0; i < N; i++) { if (i + 13 < N) PAIRS.push([i, i + 13]); if (i + 1 < N && i % 2 === 0) PAIRS.push([i, i + 1]); }
    var cPos = new Float32Array(PAIRS.length * 6), cGeo = keep(new THREE.BufferGeometry()), cAttr = new THREE.BufferAttribute(cPos, 3); cAttr.setUsage(THREE.DynamicDrawUsage); cGeo.setAttribute('position', cAttr);
    var cMat = keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    var cables = new THREE.LineSegments(cGeo, cMat); cables.frustumCulled = false; world.add(cables);
    function sparks(n, fromCore) {
      for (var k = 0; k < n; k++) {
        var d = PD[Math.floor(Math.random() * NP)], ci = CI[Math.floor(Math.random() * N * .7)];
        var sx = fromCore ? 0 : ci.x, sz = fromCore ? 0 : ci.z, sy = fromCore ? 5.6 : ci.h;
        d.mode = 1; d.life = rnd(.8, 1.8); d.px = sx; d.py = sy; d.pz = sz;
        var dir = fromCore ? new THREE.Vector3(rnd(-1, 1), rnd(-.4, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(4, 10)) : new THREE.Vector3(rnd(-1, 1), rnd(3, 7), rnd(-1, 1));
        d.vx = dir.x; d.vy = dir.y; d.vz = dir.z;
      }
    }

    // ---------- resonators placed by the visitor ----------
    var resList = [], resId = 0, ringGeo = circleGeo(1, 48), resPulseGeo = circleGeo(1, 64);
    var towerGeo = keep(new THREE.BoxGeometry(.2, 1, .2)); towerGeo.translate(0, .5, 0);
    function addRes(x, z) {
      if (resList.length >= 8) removeRes(resList[0]);
      var g2 = new THREE.Group(); g2.position.set(x, 0, z); world.add(g2);
      var rm = keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 }));
      var ring = new THREE.LineLoop(ringGeo, rm); ring.position.y = .02; ring.scale.setScalar(.8); g2.add(ring);
      var tm = keep(new THREE.MeshBasicMaterial({ color: 0xffffff })); var tw = new THREE.Mesh(towerGeo, tm); tw.scale.y = .01; g2.add(tw);
      var pulses = [0, 1, 2].map(function () { var pm = keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); var pl = new THREE.LineLoop(resPulseGeo, pm); pl.position.y = .03; g2.add(pl); return { o: pl, m: pm, age: 9 }; });
      var r = { id: ++resId, g: g2, ring: rm, tm: tm, tw: tw, pulses: pulses, pi: 0, hit: 0, h: 0, x: x, z: z };
      resList.push(r); S('addResonator', r.id, Math.floor(Math.hypot(x, z) / 2.5)); find('build');
    }
    function removeRes(r) { world.remove(r.g); resList = resList.filter(function (q) { return q !== r; }); S('removeResonator', r.id); }

    // ---------- sound ----------
    var snd = null, A = null;
    try { A = api.audio && api.audio(); if (A && SBL.sonicSound) snd = SBL.sonicSound(A); } catch (e) { snd = null; }
    function S(name) { if (!snd) return; try { return snd[name].apply(snd, [].slice.call(arguments, 1)); } catch (e) {} }
    var freq = snd ? new Uint8Array(snd.analyser.frequencyBinCount) : new Uint8Array(1024);
    var binHz = (A ? A.ctx.sampleRate : 48000) / 2048;
    var BINS = [];
    for (i = 0; i < N; i++) { var f0 = 32 * Math.pow(14000 / 32, i / N), f1 = 32 * Math.pow(14000 / 32, (i + 1) / N), b0 = Math.floor(f0 / binHz); BINS.push([b0, Math.max(b0 + 1, Math.ceil(f1 / binHz))]); }
    var spec = new Float32Array(freq.length);
    function band(fa, fb) { var a = Math.max(0, Math.floor(fa / binHz)), b = Math.min(spec.length, Math.ceil(fb / binHz)), s = 0; for (var k = a; k < b; k++) s += spec[k]; return b > a ? s / (b - a) : 0; }
    S('setMood', P.mood);
    var shake = 0, coreKick = 0, giant = 0, flipT = 0, flipUntil = -1, dropFlash = 0;
    if (snd) snd.on(function (type, data) {
      if (type === 'section') sectionName = data;
      if (type === 'drop') onDrop();
      else if (type === 'section' && data === 'break' && t > 20) {
        var r = Math.random();
        if (r < .28 && t > blueUntil + 30) { blueUntil = t + 14; find('blueprint'); }
        else if (r < .5 && t > flipUntil + 30) { flipUntil = t + 16; find('invert'); }
      }
      else if (type === 'res') { resList.forEach(function (q) { if (q.id === data) { q.hit = 1; var pu = q.pulses[q.pi++ % 3]; pu.age = 0; } }); }
    });
    var sectionName = 'intro';
    function onDrop() {
      shake = 1; dropFlash = 1; coreKick = 1; find('drop');
      for (var k = 0; k < 5; k++) spawnArch(1, true);
      sparks(220, true); CI.forEach(function (ci) { ci.kick = 1; });
      if (Math.random() < .3) giant = 1;
    }

    // ---------- camera ----------
    var cam = { th: .7, ph: 1.12, r: small ? 34 : 27, tTh: .7, tPh: 1.12, tR: small ? 34 : 27, target: new THREE.Vector3(0, 3.6, 0) };
    var lastDrag = -9, horizonHold = 0;

    // ---------- input ----------
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
    var pointers = {}, drag = null, pinch = null, pendingClick = 0, holdCore = null, dilating = false, mx = -1, my = -1, hoverT = 0;
    function setRay(x, y) { ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, camera); }
    function pickCore() { var h = ray.intersectObject(coreSolid, false); return h.length > 0 && !shatter.on; }
    function pickCol() { var h = ray.intersectObject(cols, false); return h.length ? h[0].instanceId : -1; }
    function pickGround() { if (flipT > .05) return null; return ray.ray.intersectPlane(plane, hitP) ? hitP.clone() : null; }
    canvas.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(pointers).length >= 2) multiSeen = true;
      if (Object.keys(pointers).length >= 3) { drag = null; pinch = null; return; }
      try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
      var ids = Object.keys(pointers);
      if (ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: cam.tR }; drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
      setRay(e.clientX, e.clientY);
      if (pickCore()) holdCore = setTimeout(function () { holdCore = null; if (drag && !drag.moved) { dilating = true; S('dilate', true); find('dilate'); } }, 800);
    }, sig);
    canvas.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch) { var ids = Object.keys(pointers); if (ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]]; cam.tR = clamp(pinch.r * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 9, 60); } return; }
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; canvas.style.cursor = 'grabbing'; if (holdCore) { clearTimeout(holdCore); holdCore = null; } }
      if (drag.moved) { cam.tTh += dx * .006; cam.tPh = clamp(cam.tPh - dy * .005, .22, 1.5); lastDrag = t; if (Math.abs(cam.tTh - .7) > 2.6) find('orbit'); }
    }, sig);
    function release(e) {
      delete pointers[e.pointerId];
      if (multiSeen) { if (!Object.keys(pointers).length) multiSeen = false; pinch = null; drag = null; return; }
      if (pinch) { if (Object.keys(pointers).length < 2) pinch = null; drag = null; return; }
      if (holdCore) { clearTimeout(holdCore); holdCore = null; }
      if (dilating) { dilating = false; S('dilate', false); drag = null; return; }
      var d = drag; drag = null; canvas.style.cursor = 'grab';
      if (!d || d.moved || e.type === 'pointercancel') return;
      var x = e.clientX, y = e.clientY;
      if (pendingClick) { clearTimeout(pendingClick); pendingClick = 0; blueUntil = t < blueUntil ? t : t + 14; if (t < blueUntil) find('blueprint'); return; }
      pendingClick = setTimeout(function () { pendingClick = 0; if (!ac.signal.aborted) click(x, y); }, 230);
    }
    canvas.addEventListener('pointerup', release, sig); canvas.addEventListener('pointercancel', release, sig);
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); cam.tR = clamp(cam.tR * (1 + e.deltaY * .0012), 9, 60); }, { passive: false, signal: ac.signal });
    function click(x, y) {
      setRay(x, y);
      if (pickCore()) { doShatter(); return; }
      var id = pickCol();
      if (id >= 0) { var fc = 32 * Math.pow(14000 / 32, (id + .5) / N); S('pluck', fc, CI[id].x / 20); CI[id].kick = 1; aFlash[id] = 1; find('pluck'); return; }
      var gpt = pickGround();
      if (gpt && Math.hypot(gpt.x, gpt.z) < 40) {
        for (var k = 0; k < resList.length; k++) if (Math.hypot(resList[k].x - gpt.x, resList[k].z - gpt.z) < 1.4) { removeRes(resList[k]); return; }
        addRes(gpt.x, gpt.z);
      }
    }
    function doShatter() {
      shatter.on = true; shatter.t0 = t; coreSolid.visible = false; coreEdges.visible = false; inner.visible = false; shards.visible = true;
      shardList.forEach(function (s) { s.o.position.copy(s.home); s.o.rotation.set(0, 0, 0); s.vel.copy(s.home).normalize().multiplyScalar(rnd(5, 11)); s.vel.y += rnd(0, 4); s.spin.set(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)); });
      shake = Math.max(shake, .6); sparks(120, true); S('shatter'); find('shatter');
    }
    // ---------- touch gestures ----------
    var multiSeen = false, twist = 0, sinkUntil = -1, scratchT = 0;
    var G = api.gestures ? api.gestures(canvas, function (type, d) {
      switch (type) {
        case 'rotate': world.rotation.y += d.delta; twist = clamp(twist + d.delta * .25, -.6, .6); if (Math.abs(twist) > .2) find('twist'); break;
        case 'twoswipe':
          if (d.dir === 'up') { if (snd) S('drop'); else onDrop(); api.buzz(20); }
          else { sinkUntil = t + 6; S('muffle', 5); find('sink'); }
          break;
        case 'threetap': blueUntil = t < blueUntil ? t : t + 14; if (t < blueUntil) find('blueprint'); api.buzz(10); break;
        case 'swipe':
          if (d.edge) { var mi = MOODS.map(function (m) { return m.k; }).indexOf(P.mood); setMood(MOODS[(mi + (d.edge === 'left' ? 1 : MOODS.length - 1)) % MOODS.length].k); api.whisper(moodOf(P.mood).name.toLowerCase()); api.buzz(10); }
          break;
        case 'circle':
          for (var k = 0; k < 6; k++) { var a = k / 6 * TAU; setRay(d.x + Math.cos(a) * d.r, d.y + Math.sin(a) * d.r); var gp2 = pickGround(); if (gp2 && Math.hypot(gp2.x, gp2.z) < 40) addRes(gp2.x, gp2.z); }
          find('ring'); api.buzz(15); break;
        case 'rubbing':
          if (t - scratchT < .09) break; scratchT = t; S('scratch', d.level); shake = Math.max(shake, .08 * d.level);
          for (var q = 0; q < 6; q++) CI[Math.floor(Math.random() * N)].kick = .5 + d.level * .5; find('scratch'); break;
        case 'tempo': S('setTempo', d.bpm); api.whisper(Math.round(clamp(d.bpm, 60, 180)) + ' bpm'); find('tempo'); break;
        case 'orient': flipUntil = t + 14; find('invert'); break;
        case 'return': for (var r2 = 0; r2 < 10; r2++) spawnArch(.4 + Math.random() * .6, r2 % 3 === 0); CI.forEach(function (c2) { c2.kick = Math.random(); }); api.whisper('it kept building'); find('away'); break;
      }
    }) : null;
    var LEAD = 'asdfghjkl', LOW = 'zxcvbnm';
    addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName))) return;
      var k = e.key.toLowerCase(), li = LEAD.indexOf(k), lo = LOW.indexOf(k);
      if (li >= 0) { S('key', li, false); sparks(18, true); find('play'); }
      else if (lo >= 0) { S('key', lo, true); spawnArch(.7, false); coreKick = Math.max(coreKick, .6); find('play'); }
      else if (e.key === ' ') { e.preventDefault(); if (snd) S('drop'); else onDrop(); }
      else if (/^[1-4]$/.test(e.key)) setMood(MOODS[+e.key - 1].k);
    }, sig);
    // drop an audio file anywhere on the stage
    var dropOverlay = document.createElement('div');
    dropOverlay.style.cssText = 'position:absolute;inset:14px;border:1px dashed rgba(255,255,255,.35);border-radius:18px;display:grid;place-items:center;pointer-events:none;font:11px/1 var(--mono);letter-spacing:.22em;color:rgba(255,255,255,.7);opacity:0;transition:opacity .2s';
    dropOverlay.textContent = 'DROP AUDIO TO BUILD WITH IT'; stage.appendChild(dropOverlay);
    stage.addEventListener('dragover', function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); dropOverlay.style.opacity = 1; } }, sig);
    stage.addEventListener('dragleave', function () { dropOverlay.style.opacity = 0; }, sig);
    stage.addEventListener('drop', function (e) { e.preventDefault(); dropOverlay.style.opacity = 0; var fl = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (fl) loadFile(fl); }, sig);

    var trackName = '';
    function loadFile(file) {
      if (!snd) { api.caption('Sound is unavailable in this browser.'); return; }
      if (!/^audio\//.test(file.type) && !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) { api.caption('That file is not audio. Try an MP3, WAV, OGG or M4A.'); return; }
      api.caption('Loading ' + file.name + '…');
      snd.useTrack(file).then(function () { trackName = file.name; api.caption('▶ ' + file.name); find('track'); syncPanel(); }, function () { api.caption('That file could not be decoded. Try an MP3, WAV, OGG or M4A.'); });
    }

    // ---------- panel ----------
    var slot = api.slot && api.slot(), panel = null, ctl = {}, panelOpen = false;
    function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
    if (slot) {
      var wrap = el('div', 'icpick'), btn = el('button', 'hudbtn'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(el('span', 'icglyph')); btn.appendChild(el('span', null, 'PARAMS'));
      panel = el('div', 'icpanel'); panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Sonic Architecture settings');
      var r1 = el('div', 'icrow'); r1.appendChild(el('span', 'iclab', 'Mood')); var chips = el('div', 'icsw'); r1.appendChild(chips); panel.appendChild(r1);
      ctl.chips = MOODS.map(function (m) {
        var b = el('button', 'icchip'); b.type = 'button'; b.title = m.name; b.setAttribute('aria-label', m.name);
        b.style.background = 'linear-gradient(135deg,' + m.bg + ' 0 38%,' + m.struct + ' 38% 62%,' + m.accent + ' 62% 82%,' + m.fine + ' 82%)';
        b.addEventListener('click', function () { setMood(m.k); }); chips.appendChild(b); return b;
      });
      var r1b = el('div', 'icrow'); r1b.appendChild(el('span', 'iclab', '')); ctl.moodName = el('span', 'icval'); ctl.moodName.style.gridColumn = '2 / 4'; ctl.moodName.style.textAlign = 'left'; r1b.appendChild(ctl.moodName); panel.appendChild(r1b);
      var r2 = el('div', 'icrow'); r2.appendChild(el('span', 'iclab', 'Source')); var seg = el('div', 'icseg'); r2.appendChild(seg); panel.appendChild(r2);
      var fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'audio/*'; fileIn.id = 'sa-file'; fileIn.hidden = true; panel.appendChild(fileIn);
      fileIn.addEventListener('change', function () { if (fileIn.files && fileIn.files[0]) loadFile(fileIn.files[0]); fileIn.value = ''; });
      ctl.gen = el('button', null, 'Generative'); ctl.gen.type = 'button'; ctl.trk = el('button', null, 'Your track'); ctl.trk.type = 'button';
      ctl.gen.addEventListener('click', function () { S('useGenerative'); trackName = trackName && snd && snd.hasTrack() ? trackName : ''; api.caption(''); srcTrack = false; syncPanel(); });
      ctl.trk.addEventListener('click', function () { if (snd && snd.hasTrack() && !srcTrack) { snd.resumeTrack(); api.caption('▶ ' + trackName); srcTrack = true; syncPanel(); } else fileIn.click(); });
      seg.appendChild(ctl.gen); seg.appendChild(ctl.trk);
      function slider(label, id, min, max, stepv, val, fmt, onin) {
        var r = el('div', 'icrow'), l = el('label', 'iclab', label); l.htmlFor = id; r.appendChild(l);
        var inp = el('input'); inp.type = 'range'; inp.id = id; inp.min = min; inp.max = max; inp.step = stepv; inp.value = val; var vv = el('span', 'icval', fmt(val));
        r.appendChild(inp); r.appendChild(vv); panel.appendChild(r);
        inp.addEventListener('input', function () { onin(+inp.value); vv.textContent = fmt(+inp.value); }); inp.addEventListener('change', save);
      }
      slider('Reactivity', 'sa-react', .4, 1.8, .05, P.react, function (v) { return '×' + v.toFixed(1); }, function (v) { P.react = v; });
      slider('Memory', 'sa-mem', 0, 1, .01, P.memory, function (v) { return Math.round(v * 100); }, function (v) { P.memory = v; });
      var foot = el('div', 'icfoot'); ctl.status = el('span', 'icseed'); ctl.status.style.textAlign = 'left'; foot.appendChild(ctl.status);
      ctl.upl = el('button', 'iccopy', 'LOAD AUDIO'); ctl.upl.type = 'button'; ctl.upl.addEventListener('click', function () { fileIn.click(); }); foot.appendChild(ctl.upl);
      panel.appendChild(foot);
      wrap.appendChild(btn); wrap.appendChild(panel); slot.appendChild(wrap); ctl.btn = btn;
      btn.addEventListener('click', function () { openPanel(panel.hidden); });
      document.addEventListener('pointerdown', function (e) { if (panelOpen && !wrap.contains(e.target)) openPanel(false); }, sig);
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { openPanel(false); btn.focus(); e.stopPropagation(); } }, { capture: true, signal: ac.signal });
    }
    var srcTrack = false;
    function openPanel(o) { if (!panel) return; panelOpen = o; panel.hidden = !o; ctl.btn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    function syncPanel() {
      if (!panel) return;
      if (trackName && snd && snd.section() === 'track') srcTrack = true;
      ctl.chips.forEach(function (b, n) { b.setAttribute('aria-pressed', MOODS[n].k === P.mood ? 'true' : 'false'); });
      ctl.moodName.textContent = moodOf(P.mood).name;
      ctl.gen.setAttribute('aria-pressed', srcTrack ? 'false' : 'true'); ctl.trk.setAttribute('aria-pressed', srcTrack ? 'true' : 'false');
      ctl.trk.textContent = trackName ? (trackName.length > 16 ? trackName.slice(0, 15) + '…' : trackName) : 'Your track';
    }
    function setMood(k) { P.mood = k; save(); S('setMood', k); if (srcTrack && snd) { /* keep the track; palette still changes */ } syncPanel(); }
    syncPanel();

    // ---------- resize ----------
    function resize() { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); canvas.style.width = '100%'; canvas.style.height = '100%'; camera.aspect = W / H; camera.updateProjectionMatrix(); }
    addEventListener('resize', resize, sig); resize();

    // ---------- frame ----------
    var t = 0, last = performance.now(), raf = 0, bassAvg = .2, midAvg = .2, hiAvg = .1, lastBeat = 0, lastMid = 0, lastHi = 0, energy = 0, statusT = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var rdt = Math.min(.05, (now - last) / 1000); last = now; if (rdt <= 0) return;
      var dt = rdt * (dilating ? .35 : 1); t += rdt;

      // spectrum
      var live = snd && A.ctx.state === 'running' && !A.muted();
      if (live) { snd.analyser.getByteFrequencyData(freq); for (var k = 0; k < spec.length; k++) spec[k] = freq[k] / 255; }
      else for (k = 0; k < spec.length; k++) spec[k] *= .92;
      var sub = band(25, 60), bass = band(40, 160), mid = band(400, 2500), hiMid = band(2500, 6000), hi = band(6000, 13000);
      energy = lerp(energy, (bass + mid + hi) / 3, rdt * 3);
      bassAvg = lerp(bassAvg, bass, rdt * 2); midAvg = lerp(midAvg, mid, rdt * 2); hiAvg = lerp(hiAvg, hi, rdt * 2);
      if (bass > bassAvg * 1.18 + .05 && bass > .3 && t - lastBeat > .22) { lastBeat = t; var pw = clamp((bass - bassAvg) * 3, .2, 1); spawnArch(pw, false); coreKick = Math.max(coreKick, pw); shake = Math.max(shake, pw * .12); }
      if (mid > midAvg * 1.2 + .04 && mid > .2 && t - lastMid > .15) { lastMid = t; LAT[Math.floor(Math.random() * LAT.length)].hit = 1; }
      if (hi > hiAvg * 1.25 + .03 && hi > .08 && t - lastHi > .1) { lastHi = t; sparks(small ? 12 : 24, false); }

      // colours
      var pal = palette(), ck = 1 - Math.exp(-rdt * 2.5);
      ROLES.forEach(function (r) { tmpC.set(pal[r]); C[r].lerp(tmpC, ck); });
      if (dropFlash > 0) { C.bg.lerp(C.accent, dropFlash * .25); dropFlash = Math.max(0, dropFlash - rdt * 2.2); }
      renderer.setClearColor(C.bg, 1); scene.fog.color.copy(C.bg);
      gridMat.color.copy(C.grid); ringMat.color.copy(C.grid); gridMat.opacity = t < blueUntil ? .9 : .55;
      coreMat.color.copy(C.base); coreEdgeMat.color.copy(C.struct).lerp(C.accent, clamp(coreKick, 0, 1)); innerMat.color.copy(C.accent); haloMat.color.copy(C.struct); haloMat.opacity = .25 + mid * .7;
      pMat.color.copy(C.fine); cMat.color.copy(C.fine);

      // columns
      var react = P.react, rel = lerp(9, 1.4, P.memory);
      for (i = 0; i < N; i++) {
        var ci = CI[i], b = BINS[i], raw = 0;
        for (var q = b[0]; q < b[1] && q < spec.length; q++) if (spec[q] > raw) raw = spec[q];
        var tl = aT[i], v = clamp((raw * (1 + tl * .8) - .28) / .72, 0, 1); v = Math.pow(v, 1.25) * react;
        v = Math.max(v, .03 + .025 * Math.sin(t * .8 + i * .37));
        ci.lv += (v - ci.lv) * Math.min(1, dt * (v > ci.lv ? 28 : rel));
        ci.kick = Math.max(0, ci.kick - dt * 1.8);
        var h = (.12 + ci.lv * ci.hMax + ci.kick * 3.5) * (t < sinkUntil ? .22 + .78 * clamp((t - sinkUntil + 1.2) / 1.2, 0, 1) : 1);
        ci.h = h; aLevel[i] = clamp(ci.lv, 0, 1.2); aFlash[i] = Math.max(0, aFlash[i] - dt * 2.2, ci.kick * .8);
        dummy.position.set(ci.x, 0, ci.z); dummy.rotation.set(0, -ci.ang, 0); dummy.scale.set(ci.w, h, ci.w); dummy.updateMatrix(); cols.setMatrixAt(i, dummy.matrix);
      }
      cols.instanceMatrix.needsUpdate = true; levelAttr.needsUpdate = true; flashAttr.needsUpdate = true;

      // core
      coreKick = Math.max(0, coreKick - dt * 2.5); giant = Math.max(0, giant - dt * .06);
      var cs = (1 + sub * .5 * react + coreKick * .22) * (1 + giant * 1.8);
      core.scale.setScalar(lerp(core.scale.x, cs, Math.min(1, dt * 12)));
      core.rotation.y += dt * (.15 + bass * .8); core.rotation.x += dt * .05;
      inner.rotation.y -= dt * (.4 + mid * 2); inner.rotation.z += dt * .2; inner.scale.setScalar(1 + hiMid * .8);
      halos[0].rotation.z += dt * (.2 + mid); halos[1].rotation.z -= dt * (.15 + hiMid * 1.4);
      if (shatter.on) {
        var st = t - shatter.t0;
        shardList.forEach(function (s) {
          if (st < 2.2) { s.o.position.addScaledVector(s.vel, dt); s.vel.multiplyScalar(Math.pow(.25, dt)); s.o.rotation.x += s.spin.x * dt; s.o.rotation.y += s.spin.y * dt; s.o.rotation.z += s.spin.z * dt; }
          else { var kk = Math.min(1, dt * 4); s.o.position.lerp(s.home, kk); s.o.rotation.x *= 1 - kk; s.o.rotation.y *= 1 - kk; s.o.rotation.z *= 1 - kk; }
        });
        if (st > 3.6) { shatter.on = false; shards.visible = false; coreSolid.visible = coreEdges.visible = inner.visible = true; coreKick = 1; }
      }

      // arches
      arches.forEach(function (a) {
        if (!a.m.visible) return; a.age += dt; var k2 = a.age / a.life;
        if (k2 >= 1) { a.m.visible = false; return; }
        a.m.scale.setScalar(a.s0 * (1 + a.grow * k2 * 3)); a.m.position.y += a.vy * dt;
        a.mat.color.copy(C.struct).lerp(C.accent, a.accent * (1 - k2));
        a.mat.opacity = Math.min(1, a.age * 8) * (1 - Math.pow(k2, 2)) * .9;
      });

      // lattice (mids)
      lattice.rotation.y -= dt * (.05 + mid * .3);
      LAT.forEach(function (L) {
        var v2 = band(L.f * .8, L.f * 1.25) * react; L.v = lerp(L.v, v2, Math.min(1, dt * 10)); L.hit = Math.max(0, L.hit - dt * 3);
        L.o.scale.setScalar(.3 + L.v * 1.7 + L.hit * .5); L.o.rotation.x += dt * (.3 + L.v * 3); L.o.rotation.y += dt * (.2 + L.v * 2);
        L.mat.color.copy(C.struct).lerp(C.accent, clamp(L.v * 1.2 + L.hit, 0, 1)); L.mat.opacity = .35 + L.v * .65;
      });

      // particles (highs)
      var swirl = .05 + hi * .9, rise = .12 + hiMid * 1.3;
      for (i = 0; i < NP; i++) {
        var d = PD[i], j = i * 3;
        if (d.mode === 1) {
          d.vy -= 6 * dt; d.px += d.vx * dt; d.py += d.vy * dt; d.pz += d.vz * dt; d.life -= dt;
          if (d.life <= 0 || d.py < 0) { d.mode = 0; d.r = Math.max(2, Math.hypot(d.px, d.pz)); d.a = Math.atan2(d.pz, d.px); d.y = clamp(d.py, 0, 16); }
          pPos[j] = d.px; pPos[j + 1] = d.py; pPos[j + 2] = d.pz;
        } else {
          d.a += dt * swirl * d.sp * 3 / Math.sqrt(d.r); d.y += dt * rise * d.sp; if (d.y > 16) d.y = 0;
          pPos[j] = Math.cos(d.a) * d.r; pPos[j + 1] = d.y; pPos[j + 2] = Math.sin(d.a) * d.r;
        }
      }
      pAttr.needsUpdate = true; pMat.opacity = clamp(.18 + hi * 1.6 + hiMid * .5, 0, 1); pMat.size = (small ? .12 : .09) * (1 + hi * 1.5);
      for (i = 0; i < PAIRS.length; i++) { var A1 = CI[PAIRS[i][0]], B1 = CI[PAIRS[i][1]], o6 = i * 6; cPos[o6] = A1.x; cPos[o6 + 1] = A1.h; cPos[o6 + 2] = A1.z; cPos[o6 + 3] = B1.x; cPos[o6 + 4] = B1.h; cPos[o6 + 5] = B1.z; }
      cAttr.needsUpdate = true; cMat.opacity = clamp((hiMid - .08) * 2.2 * react, 0, .7);

      // resonators
      resList.forEach(function (r) {
        r.hit = Math.max(0, r.hit - dt * 2); r.h = lerp(r.h, 1.5 + r.hit * 3 + band(200, 2000) * 2, Math.min(1, dt * 6));
        r.tw.scale.y = r.h; r.tm.color.copy(C.struct).lerp(C.accent, r.hit); r.ring.color.copy(C.accent);
        r.pulses.forEach(function (p2) { if (p2.age > 1.2) { p2.m.opacity = 0; return; } p2.age += dt; p2.o.scale.setScalar(.8 + p2.age * 5); p2.m.opacity = (1 - p2.age / 1.2) * .9; p2.m.color.copy(C.accent); });
      });

      // the city hangs
      var wantFlip = t < flipUntil ? 1 : 0; flipT += (wantFlip - flipT) * Math.min(1, rdt * .9);
      pivot.rotation.z = flipT * Math.PI;

      // camera
      if (t - lastDrag > 2.5 && !drag) cam.tTh += rdt * (.035 + energy * .12) * (dilating ? .3 : 1);
      if (drag && drag.moved && cam.tPh >= 1.49) { horizonHold += rdt; if (horizonHold > 1.5 && t > flipUntil + 4) { flipUntil = t + 14; find('invert'); horizonHold = 0; } } else horizonHold = 0;
      cam.th += (cam.tTh - cam.th) * Math.min(1, rdt * 5); cam.ph += (cam.tPh - cam.ph) * Math.min(1, rdt * 5); cam.r += (cam.tR - cam.r) * Math.min(1, rdt * 4);
      var sr = cam.r * (sectionName === 'build' ? .9 : 1);
      camera.position.set(cam.target.x + sr * Math.sin(cam.ph) * Math.cos(cam.th), cam.target.y + sr * Math.cos(cam.ph), cam.target.z + sr * Math.sin(cam.ph) * Math.sin(cam.th));
      shake = Math.max(0, shake - rdt * 1.6);
      if (shake > 0) camera.position.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(shake * .6));
      camera.lookAt(cam.target);
      colMat.uniforms.uFogD.value = scene.fog.density = lerp(.024, .016, Math.min(1, (cam.r - 20) / 30));

      // hover cursor
      if (!drag && mx >= 0 && t - hoverT > .12) { hoverT = t; setRay(mx, my); canvas.style.cursor = (pickCore() || pickCol() >= 0) ? 'pointer' : 'grab'; }
      if (t - statusT > .5 && ctl.status) { statusT = t; ctl.status.textContent = snd ? (snd.section() === 'track' ? 'TRACK' : snd.section().toUpperCase() + ' · ' + Math.round(snd.bpm()) + ' BPM') : 'NO SOUND'; }

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);

    return function unmount() {
      cancelAnimationFrame(raf); ac.abort(); if (pendingClick) clearTimeout(pendingClick); if (holdCore) clearTimeout(holdCore);
      if (G) G(); S('stop'); api.caption('');
      disposables.forEach(function (d) { try { d.dispose(); } catch (e) {} });
      renderer.dispose();
    };
  }
});
