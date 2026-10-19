/* 06 — The Room That Remembers.
   Eight rooms on a fixed graph of thirteen possible passages. Nine start open, four are latent.
   The building keeps a memory of the visitor (in this browser) and rearranges itself:
     · a door ignored again and again is sealed (knock three times and it may come back)
     · a passage used often grows longer and narrower, and keeps a tally of every crossing
     · walking back and forth between two rooms rewires the door behind you
     · staring at a blank doorway long enough opens a latent passage
     · where you look, the walls keep a mark; where you walk, a ghost walks after you
     · a room left unvisited calls through its doors; a room you linger in grows
   Each room also keeps its own kind of record: the Gallery hangs portraits, the Library writes a book
   for every passage, the Observatory draws your route as a constellation, the Echo keeps your footprints,
   the Atrium grows a garden from the time you spend in it. */
SBL.register('06', {
  mount: function (stage, api) {
    'use strict';
    var ac = new AbortController(), sig = { signal: ac.signal };
    var TOUCH = !!api.touch, W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 2), TAU = Math.PI * 2;
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function rnd(a, b) { return a + Math.random() * (b - a); }

    var canvas = document.createElement('canvas');
    canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none'; canvas.setAttribute('aria-label', 'A building of eight rooms that changes as you explore it');
    stage.appendChild(canvas);
    var fade = document.createElement('div');
    fade.style.cssText = 'position:absolute;inset:0;background:#111;opacity:1;pointer-events:none;transition:opacity .5s ease';
    stage.appendChild(fade);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !TOUCH, powerPreference: 'high-performance' });
    renderer.setPixelRatio(DPR);
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(72, W / H, .05, 140);
    camera.rotation.order = 'YXZ';
    api.tone && api.tone('contrast');
    var INK = '#14121a';

    // ---------- the building ----------
    function square(s) { var h = s / 2; return [[-h, -h], [h, -h], [h, h], [-h, h]]; }
    function rect(w, l) { return [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]]; }
    function ngon(n, r, rot) { var p = []; for (var i = 0; i < n; i++) { var a = (rot || 0) + i * TAU / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
    var ROOMS = [
      { name: 'Vestibule', glyph: 'square', poly: square(9), h: 4.2, wall: '#ff5a36', wall2: '#ff7a5c', pat: 'stripes', floor: '#1d1a45', floor2: '#2b2766', fpat: 'checker', ceil: '#ffd23f', accent: '#00c2a8', slots: [{ w: 0, u: .5 }, { w: 1, u: .5 }, { w: 2, u: .5 }, { w: 3, u: .5 }], note: 50 },
      { name: 'Gallery', glyph: 'bars', poly: rect(6.5, 18), h: 5, wall: '#2f5bff', wall2: '#2a50e6', pat: 'plain', floor: '#ffe9d6', floor2: '#ffd9b8', fpat: 'stripes', ceil: '#ff8fc7', accent: '#ffd23f', slots: [{ w: 0, u: .5 }, { w: 2, u: .5 }, { w: 1, u: .5 }], note: 45 },
      { name: 'Well', glyph: 'circle', poly: ngon(12, 6, -Math.PI / 2 - Math.PI / 12), h: 11, wall: '#00b37e', wall2: '#00c98d', pat: 'stripes', floor: '#0e2a3a', floor2: '#133748', fpat: 'rings', ceil: '#8fe3ff', accent: '#ff5a36', slots: [{ w: 0, u: .5 }, { w: 3, u: .5 }, { w: 6, u: .5 }, { w: 9, u: .5 }], note: 38 },
      { name: 'Stair', glyph: 'stair', poly: square(9), h: 7, wall: '#ff8fc7', wall2: '#ffa6d4', pat: 'chevron', floor: '#2a1b3d', floor2: '#3a2654', fpat: 'checker', ceil: '#fff2d6', accent: '#2f5bff', slots: [{ w: 0, u: .5 }, { w: 1, u: .5 }, { w: 3, u: .5 }], note: 57 },
      { name: 'Library', glyph: 'book', poly: [[-6, -6], [6, -6], [6, 0], [0, 0], [0, 6], [-6, 6]], h: 4.6, wall: '#ffd23f', wall2: '#ffc61a', pat: 'grid', floor: '#3b1f6b', floor2: '#4a2a82', fpat: 'stripes', ceil: '#ffffff', accent: '#ff3d7f', slots: [{ w: 1, u: .5 }, { w: 4, u: .5 }, { w: 5, u: .72 }], note: 43 },
      { name: 'Observatory', glyph: 'star', poly: ngon(6, 7.5, Math.PI / 6), h: 6, wall: '#2a1d6e', wall2: '#33248a', pat: 'dots', floor: '#5b2bff', floor2: '#6b40ff', fpat: 'grid', ceil: '#0b0820', accent: '#ffd23f', slots: [{ w: 0, u: .5 }, { w: 2, u: .5 }, { w: 4, u: .5 }], note: 62 },
      { name: 'Echo', glyph: 'triangle', poly: ngon(3, 7.5, -Math.PI / 2), h: 6.5, wall: '#ff3d7f', wall2: '#ff5c94', pat: 'waves', floor: '#ffd23f', floor2: '#ffc61a', fpat: 'plain', ceil: '#2f5bff', accent: '#00e0ff', slots: [{ w: 0, u: .5 }, { w: 1, u: .5 }, { w: 2, u: .5 }], note: 41 },
      { name: 'Atrium', glyph: 'tree', poly: ngon(8, 7.5, Math.PI / 8), h: 6, wall: '#a6f24a', wall2: '#b9ff66', pat: 'dots', floor: '#ff7a1a', floor2: '#ff8f3d', fpat: 'checker', ceil: '#ffe9d6', accent: '#2f5bff', slots: [{ w: 0, u: .5 }, { w: 3, u: .5 }, { w: 5, u: .5 }], note: 48 }
    ];
    var EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 6], [6, 7], [7, 5], [5, 2], [1, 7], [4, 3], [6, 5], [0, 2]];
    var EDGE_OPEN = 9; // the first nine start open, the rest are latent
    var DOOR_W = 1.4, DOOR_H = 2.5, EYE = 1.6;
    function signedArea(p) { var a = 0; for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
    ROOMS.forEach(function (R, ri) {
      var ccw = signedArea(R.poly) > 0;
      R.walls = R.poly.map(function (p0, i) {
        var p1 = R.poly[(i + 1) % R.poly.length], dx = p1[0] - p0[0], dz = p1[1] - p0[1], len = Math.hypot(dx, dz), d = [dx / len, dz / len];
        return { p0: p0, p1: p1, d: d, n: ccw ? [-d[1], d[0]] : [d[1], -d[0]], len: len };
      });
      R.slots.forEach(function (s) { var w = R.walls[s.w]; s.p = [w.p0[0] + w.d[0] * w.len * s.u, w.p0[1] + w.d[1] * w.len * s.u]; s.n = w.n; });
      R.edges = []; EDGES.forEach(function (e, i) { if (e[0] === ri || e[1] === ri) R.edges.push(i); });
      if (R.edges.length !== R.slots.length && window.console) console.warn('room', R.name, 'slots do not match its passages');
    });
    function inPoly(p, x, z) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { var a = p[i], b = p[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
    function segDist(w, x, z) { var px = x - w.p0[0], pz = z - w.p0[1], u = clamp(px * w.d[0] + pz * w.d[1], 0, w.len); return Math.hypot(px - w.d[0] * u, pz - w.d[1] * u); }
    function inside(R, x, z, m) { if (!inPoly(R.poly, x, z)) return false; for (var i = 0; i < R.walls.length; i++) if (segDist(R.walls[i], x, z) < m) return false; return true; }

    // ---------- memory (kept in this browser) ----------
    var KEY = 'sbl-06';
    function blank(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(typeof v === 'function' ? v(i) : v); return a; }
    function fresh() {
      return {
        v: 2, sessions: 0, lastSeen: 0, current: 0, traversals: 0, rewires: 0, loopGuard: 0,
        edges: EDGES.map(function (e, i) { return { state: i < EDGE_OPEN ? 'open' : 'latent', uses: 0 }; }),
        slotMap: ROOMS.map(function (R) { return R.edges.slice(); }),
        ignored: ROOMS.map(function (R) { return blank(R.slots.length, 0); }),
        visits: blank(8, 0), lastVisit: blank(8, -1), dwell: blank(8, 0),
        gaze: blank(8, function () { return blank(24, 0); }), trail: blank(8, null), exitSlot: blank(8, -1), prints: [], history: []
      };
    }
    var M;
    try { M = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { M = null; }
    if (!M || M.v !== 2) M = fresh();
    var returning = M.sessions > 0 && Date.now() - M.lastSeen > 60000;
    M.sessions++;
    function save() { M.lastSeen = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(M)); } catch (e) {} }

    function edgeOf(r, s) { return M.slotMap[r][s]; }
    function other(e, r) { return EDGES[e][0] === r ? EDGES[e][1] : EDGES[e][0]; }
    function openCount(r) { var n = 0; M.slotMap[r].forEach(function (e) { if (M.edges[e].state === 'open') n++; }); return n; }
    function connected(skip) {
      var seen = { 0: 1 }, stack = [0], n = 1;
      while (stack.length) { var r = stack.pop(); for (var e = 0; e < EDGES.length; e++) { if (e === skip || M.edges[e].state !== 'open') continue; var a = EDGES[e][0], b = EDGES[e][1], o = a === r ? b : b === r ? a : -1; if (o >= 0 && !seen[o]) { seen[o] = 1; n++; stack.push(o); } } }
      return n === ROOMS.length;
    }
    function canSeal(e) { var a = EDGES[e][0], b = EDGES[e][1]; return openCount(a) > 1 && openCount(b) > 1 && connected(e); }
    function neglected(r) { return (M.visits[r] === 0 && M.traversals >= 5) || (M.lastVisit[r] >= 0 && M.traversals - M.lastVisit[r] >= 12); }
    function corridorOf(e) { var u = M.edges[e].uses; return { L: Math.min(22, 3 + u * 1.6), w: Math.max(.6, 1.35 - u * .09), h: Math.max(1.9, 2.5 - u * .05) }; }
    function growOf(r) { return clamp((M.dwell[r] - 45) / 120, 0, .8); }

    // ---------- discoveries ----------
    var FINDS = { seal: 'a door forgot you', long: 'the corridor stretches', rewire: 'it noticed the loop', stain: 'your gaze stays', ghost: 'someone walked here', call: 'a room calls', open: 'a door appears', reopen: 'you remembered it', grow: 'the room grew', portrait: 'a portrait of your choices', stair: 'the stair never ends', books: 'every passage is written down', sky: 'your route, in stars', prints: 'it kept your footprints', garden: 'it grows while you stay', back: 'you came back' };
    var KEYS = Object.keys(FINDS), found = {};
    api.pips(KEYS.length);
    function find(k) { if (found[k]) return; found[k] = 1; api.light(KEYS.indexOf(k)); api.whisper(FINDS[k]); }

    // ---------- sound ----------
    var snd = null, A = null;
    try { A = api.audio && api.audio(); if (A && SBL.roomSound) snd = SBL.roomSound(A); } catch (e) { snd = null; }
    function S(name) { if (!snd) return; try { return snd[name].apply(snd, [].slice.call(arguments, 1)); } catch (e) {} }

    // ---------- graphic textures ----------
    function canvasTex(w, h, draw, repeat) {
      var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); draw(x, w, h);
      var t = new THREE.CanvasTexture(c); if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
    }
    function pattern(type, a, b) {
      return canvasTex(128, 128, function (x, w, h) {
        x.fillStyle = a; x.fillRect(0, 0, w, h); x.fillStyle = b; x.strokeStyle = b;
        if (type === 'stripes') x.fillRect(0, 0, w / 2, h);
        else if (type === 'checker') { x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2); }
        else if (type === 'dots') { x.beginPath(); x.arc(w / 2, h / 2, w * .28, 0, TAU); x.fill(); }
        else if (type === 'grid') { x.lineWidth = 10; x.strokeRect(0, 0, w, h); }
        else if (type === 'chevron') { x.lineWidth = 22; x.beginPath(); x.moveTo(0, h * .75); x.lineTo(w / 2, h * .25); x.lineTo(w, h * .75); x.stroke(); }
        else if (type === 'waves') { x.lineWidth = 16; x.beginPath(); for (var i = 0; i <= w; i += 4) x.lineTo(i, h / 2 + Math.sin(i / w * TAU) * h * .22); x.stroke(); }
        else if (type === 'rings') { x.lineWidth = 12; x.beginPath(); x.arc(w / 2, h / 2, w * .3, 0, TAU); x.stroke(); }
      }, true);
    }
    function glyph(x, kind, cx, cy, s, col) {
      x.fillStyle = col; x.strokeStyle = col; x.lineWidth = s * .16; x.lineJoin = 'round'; x.beginPath();
      if (kind === 'square') x.fillRect(cx - s * .5, cy - s * .5, s, s);
      else if (kind === 'bars') { for (var i = 0; i < 3; i++) x.fillRect(cx - s * .55 + i * s * .4, cy - s * .55, s * .25, s * 1.1); }
      else if (kind === 'circle') { x.arc(cx, cy, s * .55, 0, TAU); x.fill(); }
      else if (kind === 'stair') { x.moveTo(cx - s * .6, cy + s * .55); for (var k = 0; k < 4; k++) { x.lineTo(cx - s * .6 + k * s * .3, cy + s * .55 - (k + 1) * s * .28); x.lineTo(cx - s * .3 + k * s * .3, cy + s * .55 - (k + 1) * s * .28); } x.lineTo(cx + s * .6, cy + s * .55); x.closePath(); x.fill(); }
      else if (kind === 'book') { x.fillRect(cx - s * .45, cy - s * .55, s * .9, s * 1.1); x.fillStyle = '#fff'; x.fillRect(cx - s * .3, cy - s * .35, s * .6, s * .12); }
      else if (kind === 'star') { for (var j = 0; j < 10; j++) { var r = j % 2 ? s * .25 : s * .62, a = -Math.PI / 2 + j * Math.PI / 5; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.fill(); }
      else if (kind === 'triangle') { x.moveTo(cx, cy - s * .6); x.lineTo(cx + s * .6, cy + s * .5); x.lineTo(cx - s * .6, cy + s * .5); x.closePath(); x.fill(); }
      else if (kind === 'tree') { x.moveTo(cx, cy - s * .65); x.lineTo(cx + s * .5, cy + s * .25); x.lineTo(cx - s * .5, cy + s * .25); x.closePath(); x.fill(); x.fillRect(cx - s * .1, cy + s * .2, s * .2, s * .4); }
    }
    function signTex(target, calling) {
      var T2 = ROOMS[target];
      return canvasTex(128, 128, function (x) {
        x.fillStyle = INK; x.beginPath(); x.arc(64, 64, 62, 0, TAU); x.fill();
        x.fillStyle = T2.wall; x.beginPath(); x.arc(64, 64, 54, 0, TAU); x.fill();
        glyph(x, T2.glyph, 64, 64, 50, calling ? '#fff' : INK);
      });
    }
    var ghostTex = canvasTex(64, 144, function (x) {
      x.lineWidth = 6; x.strokeStyle = INK; x.fillStyle = '#fff';
      x.beginPath(); x.arc(32, 20, 14, 0, TAU); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(12, 140); x.lineTo(14, 52); x.quadraticCurveTo(32, 38, 50, 52); x.lineTo(52, 140); x.closePath(); x.fill(); x.stroke();
    });

    // ---------- building a room ----------
    var room = null, cur = 0, built = [];
    function track(o) { built.push(o); return o; }
    function disposeRoom() { if (room) scene.remove(room); built.forEach(function (o) { try { o.dispose(); } catch (e) {} }); built = []; }
    function basic(color, opts) { var o = { color: color, side: THREE.DoubleSide }; for (var k in opts) o[k] = opts[k]; return track(new THREE.MeshBasicMaterial(o)); }
    var inkMat = new THREE.MeshBasicMaterial({ color: INK }), inkBack = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    function geo(g) { return track(g); }
    function toon(mesh, k) { var o = new THREE.Mesh(mesh.geometry, inkBack); o.scale.setScalar(k || 1.06); mesh.add(o); return mesh; }
    function bar(g, x0, y0, z0, x1, y1, z1, th, mat) { // a thick ink line as a thin box
      var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz); if (len < .001) return;
      var m = new THREE.Mesh(sharedBar, mat || inkMat); m.scale.set(th, th, len); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.quaternion.setFromUnitVectors(ZAXIS, tmpV.set(dx / len, dy / len, dz / len)); g.add(m); return m;
    }
    var sharedBar = new THREE.BoxGeometry(1, 1, 1), ZAXIS = new THREE.Vector3(0, 0, 1), tmpV = new THREE.Vector3();
    function wallPiece(g, wall, a, b, y0, y1, mat, tile) { // a plane on the wall between along a..b, height y0..y1, uv in metres
      var w = b - a, h = y1 - y0; if (w < .002 || h < .002) return;
      var pg = geo(new THREE.PlaneGeometry(w, h)), uv = pg.attributes.uv;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, (a + uv.getX(i) * w) / tile, (y0 + uv.getY(i) * h) / tile);
      var m = new THREE.Mesh(pg, mat), mid = (a + b) / 2;
      m.position.set(wall.p0[0] + wall.d[0] * mid, (y0 + y1) / 2, wall.p0[1] + wall.d[1] * mid); m.rotation.y = Math.atan2(wall.n[0], wall.n[1]);
      g.add(m); return m;
    }
    function onWall(obj, wall, along, y, off) {
      obj.position.set(wall.p0[0] + wall.d[0] * along + wall.n[0] * (off || .01), y, wall.p0[1] + wall.d[1] * along + wall.n[1] * (off || .01));
      obj.rotation.y = Math.atan2(wall.n[0], wall.n[1]); return obj;
    }
    function corridorGeo(L, w0, w1, h0, h1, cA, cB) {
      var P = [], C = [], quads = [
        [[-w0 / 2, 0, 0], [-w1 / 2, 0, L], [w1 / 2, 0, L], [w0 / 2, 0, 0]],
        [[-w0 / 2, h0, 0], [w0 / 2, h0, 0], [w1 / 2, h1, L], [-w1 / 2, h1, L]],
        [[-w0 / 2, 0, 0], [-w0 / 2, h0, 0], [-w1 / 2, h1, L], [-w1 / 2, 0, L]],
        [[w0 / 2, 0, 0], [w1 / 2, 0, L], [w1 / 2, h1, L], [w0 / 2, h0, 0]]
      ], shades = [.55, 1, .82, .82];
      quads.forEach(function (q, qi) { [[0, 1, 2], [0, 2, 3]].forEach(function (tri) { tri.forEach(function (k) { var v = q[k], c = cA.clone().lerp(cB, v[2] / L).multiplyScalar(shades[qi]); P.push(v[0], v[1], v[2]); C.push(c.r, c.g, c.b); }); }); });
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return geo(g);
    }
    function shadeFor(n) { return .78 + .22 * (.5 + .5 * (n[0] * .6 - n[1] * .8)); }

    var doorObjs = [], hitList = [], floorMesh = null, stains = [], frames = [], calling = [], stairs = null, pool = null, trees = [], sky = null, telescope = null;
    function buildRoom(r) {
      disposeRoom();
      var R = ROOMS[r], grow = growOf(r), h = R.h * (1 + grow), g = new THREE.Group();
      doorObjs = []; hitList = []; stains = []; frames = []; calling = []; stairs = null; pool = null; trees = []; sky = null; telescope = null;
      var wallTex = track(pattern(R.pat, R.wall, R.wall2)), floorTex = track(pattern(R.fpat, R.floor, R.floor2));
      floorTex.repeat.set(.5, .5);
      var scarTex = track(canvasTex(64, 64, function (x) { x.fillStyle = '#fff6ea'; x.fillRect(0, 0, 64, 64); x.strokeStyle = INK; x.lineWidth = 3; for (var i = -64; i < 64; i += 14) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 64, 0); x.stroke(); } }, true));
      var shape = new THREE.Shape(R.poly.map(function (p) { return new THREE.Vector2(p[0], -p[1]); }));
      floorMesh = new THREE.Mesh(geo(new THREE.ShapeGeometry(shape)), basic('#ffffff', { map: floorTex })); floorMesh.rotation.x = -Math.PI / 2; g.add(floorMesh);
      var ceil = new THREE.Mesh(geo(new THREE.ShapeGeometry(shape)), basic(R.ceil)); ceil.rotation.x = -Math.PI / 2; ceil.position.y = h; g.add(ceil);
      if (r === 2) ceil.visible = false;

      R.walls.forEach(function (wall, wi) {
        var mat = basic(new THREE.Color(1, 1, 1).multiplyScalar(shadeFor(wall.n)), { map: wallTex }), holes = [];
        R.slots.forEach(function (s, si) { if (s.w === wi) holes.push({ s: si, a: wall.len * s.u - DOOR_W / 2, b: wall.len * s.u + DOOR_W / 2 }); });
        holes.sort(function (x, y) { return x.a - y.a; });
        var x0 = 0;
        holes.forEach(function (ho) {
          wallPiece(g, wall, x0, ho.a, 0, h, mat, 2);
          wallPiece(g, wall, ho.a, ho.b, DOOR_H, h, mat, 2);
          var e = edgeOf(r, ho.s), st = M.edges[e].state, mid = (ho.a + ho.b) / 2;
          var D = { slot: ho.s, edge: e, state: st, target: other(e, r), wall: wall, mid: mid, stare: 0, cracks: 0, crackT: 0 };
          // a generous invisible target, wider and taller than the doorway, for fingers
          var hit = onWall(new THREE.Mesh(geo(new THREE.PlaneGeometry(DOOR_W + (TOUCH ? 1.2 : .4), DOOR_H + (TOUCH ? 1.4 : .6))), basic('#000', { transparent: true, opacity: 0, depthWrite: false })), wall, mid, DOOR_H / 2 + .2, .03);
          hit.userData.door = D; g.add(hit); hitList.push(hit); D.hit = hit;
          if (st === 'open') buildDoorway(g, r, D);
          else {
            var fill = st === 'sealed' ? basic('#ffffff', { map: scarTex }) : basic(new THREE.Color(1, 1, 1).multiplyScalar(shadeFor(wall.n)), { map: wallTex });
            wallPiece(g, wall, ho.a, ho.b, 0, DOOR_H, fill, 2);
            var lw = .045, dm = basic(st === 'sealed' ? INK : R.accent, { transparent: true, opacity: st === 'sealed' ? 1 : .25 });
            var p0 = [wall.p0[0] + wall.d[0] * ho.a + wall.n[0] * .02, wall.p0[1] + wall.d[1] * ho.a + wall.n[1] * .02], p1 = [wall.p0[0] + wall.d[0] * ho.b + wall.n[0] * .02, wall.p0[1] + wall.d[1] * ho.b + wall.n[1] * .02];
            bar(g, p0[0], 0, p0[1], p0[0], DOOR_H, p0[1], lw, dm); bar(g, p1[0], 0, p1[1], p1[0], DOOR_H, p1[1], lw, dm); bar(g, p0[0], DOOR_H, p0[1], p1[0], DOOR_H, p1[1], lw, dm);
            D.outline = dm;
            if (st === 'latent') { // staring fills the outline from the floor up
              var fm = basic(R.accent, { transparent: true, opacity: .85 }), fp = onWall(new THREE.Mesh(geo(new THREE.PlaneGeometry(DOOR_W - .1, 1)), fm), wall, mid, 0, .025);
              fp.scale.y = .001; g.add(fp); D.fillBar = fp;
            }
          }
          doorObjs.push(D); x0 = ho.b;
        });
        wallPiece(g, wall, x0, wall.len, 0, h, mat, 2);
        // ink: corners, skirting, cornice
        bar(g, wall.p0[0], 0, wall.p0[1], wall.p0[0], h, wall.p0[1], .07);
        bar(g, wall.p0[0] + wall.n[0] * .02, .02, wall.p0[1] + wall.n[1] * .02, wall.p1[0] + wall.n[0] * .02, .02, wall.p1[1] + wall.n[1] * .02, .07);
        bar(g, wall.p0[0] + wall.n[0] * .02, h - .02, wall.p0[1] + wall.n[1] * .02, wall.p1[0] + wall.n[0] * .02, h - .02, wall.p1[1] + wall.n[1] * .02, .07);
      });

      // where you looked last time: flat marks with an ink ring
      var gz = M.gaze[r], any = false;
      for (var b = 0; b < 24; b++) {
        if (gz[b] < 2.5) continue;
        var yaw0 = (b + .5) / 24 * TAU, hw = rayWall(R, 0, 0, -Math.sin(yaw0), -Math.cos(yaw0)); if (!hw) continue; any = true;
        var sz = .45 + Math.min(.9, gz[b] / 14), sm = basic(R.accent, { transparent: true, opacity: 0, depthWrite: false });
        var disc = onWall(new THREE.Mesh(geo(new THREE.CircleGeometry(sz, 40)), sm), hw.wall, hw.along, EYE, .04);
        var ring = new THREE.Mesh(geo(new THREE.RingGeometry(sz, sz + .06, 40)), basic(INK, { transparent: true, opacity: 0, depthWrite: false })); ring.position.z = .001; disc.add(ring);
        g.add(disc); stains.push({ m: sm, rm: ring.material, target: Math.min(.9, .3 + gz[b] / 20) });
      }
      if (any) setTimeout(function () { if (cur === r) find('stain'); }, 2500);

      furnish(g, r, R, h);
      scene.fog = null; renderer.setClearColor(R.ceil, 1);
      room = g; scene.add(g); cur = r;
      S('setRoom', r, grow); updateCalls();
    }
    function buildDoorway(g, r, D) {
      var R = ROOMS[r], T2 = ROOMS[D.target], wall = D.wall, cg = corridorOf(D.edge), ign = M.ignored[r][D.slot], fadeK = ign >= 2 ? .4 : 1;
      var call = neglected(D.target);
      // a thick ink frame with an accent band
      var c0 = [wall.p0[0] + wall.d[0] * (D.mid - DOOR_W / 2), wall.p0[1] + wall.d[1] * (D.mid - DOOR_W / 2)], c1 = [wall.p0[0] + wall.d[0] * (D.mid + DOOR_W / 2), wall.p0[1] + wall.d[1] * (D.mid + DOOR_W / 2)], n = wall.n;
      var band = basic(R.accent, { transparent: true, opacity: fadeK });
      [[c0, 0], [c1, 0]].forEach(function (c) { bar(g, c[0][0] + n[0] * .04, 0, c[0][1] + n[1] * .04, c[0][0] + n[0] * .04, DOOR_H + .12, c[0][1] + n[1] * .04, .2, band); });
      bar(g, c0[0] + n[0] * .04, DOOR_H + .1, c0[1] + n[1] * .04, c1[0] + n[0] * .04, DOOR_H + .1, c1[1] + n[1] * .04, .2, band);
      [[c0], [c1]].forEach(function (c) { bar(g, c[0][0] + n[0] * .16, 0, c[0][1] + n[1] * .16, c[0][0] + n[0] * .16, DOOR_H + .22, c[0][1] + n[1] * .16, .06); });
      bar(g, c0[0] + n[0] * .16, DOOR_H + .22, c0[1] + n[1] * .16, c1[0] + n[0] * .16, DOOR_H + .22, c1[1] + n[1] * .16, .06);
      // the sign: where this door leads
      var st = track(signTex(D.target, call)), sm = basic('#fff', { map: st, transparent: true, opacity: fadeK });
      var sign = onWall(new THREE.Mesh(geo(new THREE.CircleGeometry(.42, 40)), sm), wall, D.mid, DOOR_H + .75, .08); g.add(sign);
      sign.userData.door = D; hitList.push(sign);
      // the passage
      var cGroup = new THREE.Group(), out = [-n[0], -n[1]];
      cGroup.position.set(wall.p0[0] + wall.d[0] * D.mid, 0, wall.p0[1] + wall.d[1] * D.mid); cGroup.rotation.y = Math.atan2(out[0], out[1]);
      cGroup.add(new THREE.Mesh(corridorGeo(cg.L, DOOR_W, cg.w, DOOR_H, cg.h, new THREE.Color(R.wall), new THREE.Color(T2.wall)), basic('#fff', { vertexColors: true })));
      for (var z = 1.6; z < cg.L - .2; z += 1.6) { var k = z / cg.L, w = lerp(DOOR_W, cg.w, k) / 2 - .01, hh = lerp(DOOR_H, cg.h, k) - .01; bar(cGroup, -w, 0, z, -w, hh, z, .035); bar(cGroup, w, 0, z, w, hh, z, .035); bar(cGroup, -w, hh, z, w, hh, z, .035); }
      var endM = basic(T2.wall), endP = new THREE.Mesh(geo(new THREE.PlaneGeometry(cg.w, cg.h)), endM); endP.position.set(0, cg.h / 2, cg.L); cGroup.add(endP);
      var endSign = new THREE.Mesh(geo(new THREE.CircleGeometry(Math.min(.35, cg.w * .35), 32)), basic('#fff', { map: st })); endSign.position.set(0, cg.h * .55, cg.L - .02); endSign.rotation.y = Math.PI; cGroup.add(endSign);
      var uses = M.edges[D.edge].uses;
      for (var t1 = 0; t1 < Math.min(uses, 40); t1++) { var zz = .5 + Math.floor(t1 / 5) * .5 + (t1 % 5) * .07, xx = -lerp(DOOR_W, cg.w, zz / cg.L) / 2 + .03; if (t1 % 5 === 4) bar(cGroup, xx, 1.25, zz - .32, xx, 1.6, zz + .02, .025); else bar(cGroup, xx, 1.25, zz, xx, 1.6, zz, .025); }
      g.add(cGroup);
      D.corr = cg; D.band = band; D.sign = sm; D.out = out; D.fade = fadeK;
      if (call) calling.push(D);
    }
    function rayWall(R, x, z, fx, fz) {
      var best = null;
      R.walls.forEach(function (w) {
        var ex = w.p1[0] - w.p0[0], ez = w.p1[1] - w.p0[1], den = fx * ez - fz * ex; if (Math.abs(den) < 1e-6) return;
        var tx = w.p0[0] - x, tz = w.p0[1] - z, tt = (tx * ez - tz * ex) / den, uu = (tx * fz - tz * fx) / den;
        if (tt > 0 && uu >= 0 && uu <= 1 && (!best || tt < best.t)) best = { t: tt, wall: w, along: uu * w.len };
      });
      return best;
    }

    // ---------- each room's purpose ----------
    var VIVID = ['#ff5a36', '#2f5bff', '#ffd23f', '#00b37e', '#ff3d7f', '#00c2a8', '#a6f24a', '#5b2bff', '#ff8fc7', '#ff7a1a'];
    function furnish(g, r, R, h) {
      if (r === 0) { // Vestibule: a lamp and four pilasters
        var lamp = toon(new THREE.Mesh(geo(new THREE.SphereGeometry(.38, 24, 16)), basic('#fff6c2')), 1.1); lamp.position.y = h - 1.2; g.add(lamp);
        bar(g, 0, h - .8, 0, 0, h, 0, .04);
        R.poly.forEach(function (p) { var pil = toon(new THREE.Mesh(geo(new THREE.CylinderGeometry(.28, .28, h, 20)), basic(R.accent)), 1.08); pil.position.set(p[0] * .9, h / 2, p[1] * .9); g.add(pil); });
      } else if (r === 1) { // Gallery: columns and the portrait
        for (var z = -7.5; z <= 7.5; z += 3) [-2, 2].forEach(function (x) { var col = toon(new THREE.Mesh(geo(new THREE.CylinderGeometry(.18, .18, h, 16)), basic('#ffffff')), 1.18); col.position.set(x, h / 2, z); g.add(col); });
        [[3, .2], [3, .4], [3, .6], [3, .8], [1, .2], [1, .8]].forEach(function (fp, k) {
          var wall = R.walls[fp[0]], tex = track(new THREE.CanvasTexture(portrait(k % 4 + (k > 3 ? 0 : 0)))), pic = onWall(new THREE.Mesh(geo(new THREE.PlaneGeometry(1.8, 1.35)), basic('#fff', { map: tex })), wall, wall.len * fp[1], 2.1, .06);
          var fr = onWall(new THREE.Mesh(geo(new THREE.PlaneGeometry(2.05, 1.6)), basic(INK)), wall, wall.len * fp[1], 2.1, .04);
          g.add(fr); g.add(pic); var f = { look: 0 }; pic.userData.frame = f; frames.push(f); hitList.push(pic);
        });
      } else if (r === 2) { // Well: the sky, a beam, a pool
        var beam = new THREE.Mesh(geo(new THREE.CylinderGeometry(1.6, 2.4, h, 32, 1, true)), basic('#ffffff', { transparent: true, opacity: .12, depthWrite: false })); beam.position.y = h / 2; g.add(beam);
        var skyd = new THREE.Mesh(geo(new THREE.CircleGeometry(6.2, 48)), basic(R.ceil)); skyd.rotation.x = Math.PI / 2; skyd.position.y = h + .5; g.add(skyd);
        var water = new THREE.Mesh(geo(new THREE.CircleGeometry(2.2, 48)), basic('#0a1a2a')); water.rotation.x = -Math.PI / 2; water.position.y = .01; g.add(water);
        var rim = new THREE.Mesh(geo(new THREE.RingGeometry(2.2, 2.45, 48)), basic(INK)); rim.rotation.x = -Math.PI / 2; rim.position.y = .015; g.add(rim);
        pool = { rings: [] };
        for (var k2 = 0; k2 < 4; k2++) { var rm = basic(R.accent, { transparent: true, opacity: 0 }), ring = new THREE.Mesh(geo(new THREE.RingGeometry(.92, 1, 64)), rm); ring.rotation.x = -Math.PI / 2; ring.position.y = .02; g.add(ring); pool.rings.push({ m: rm, o: ring, age: 9 }); }
      } else if (r === 3) { // Stair: steps into the ceiling
        var wall2 = R.walls[2], n2 = 15, stepW = wall2.len / n2, stepH = h / n2, sg = new THREE.Group(), sb = geo(new THREE.BoxGeometry(stepW, stepH, 1.4));
        var smA = basic('#fff2d6'), smB = basic(R.accent);
        for (var i2 = -1; i2 <= n2 + 1; i2++) { var stp = toon(new THREE.Mesh(sb, i2 % 2 ? smA : smB), 1.03); stp.position.set(-wall2.len / 2 + stepW * (i2 + .5), stepH * (i2 + .5), 0); sg.add(stp); }
        var mid2 = [(wall2.p0[0] + wall2.p1[0]) / 2 + wall2.n[0] * .72, (wall2.p0[1] + wall2.p1[1]) / 2 + wall2.n[1] * .72];
        var holder = new THREE.Group(); holder.position.set(mid2[0], 0, mid2[1]); holder.rotation.y = Math.atan2(-wall2.d[1], wall2.d[0]); holder.add(sg); g.add(holder);
        stairs = { g: sg, stepW: stepW, stepH: stepH, off: 0, on: false, look: 0, until: 0, holder: holder };
      } else if (r === 4) { // Library: one book for every passage walked
        var books = Math.min(160, 12 + M.traversals * 2), shelfWalls = [0, 5], placed = 0, bgeo = geo(new THREE.BoxGeometry(1, 1, 1));
        shelfWalls.forEach(function (wi) {
          var wl = R.walls[wi];
          for (var row = 0; row < 4; row++) {
            var y = .35 + row * .95; bar(g, wl.p0[0] + wl.n[0] * .3, y, wl.p0[1] + wl.n[1] * .3, wl.p1[0] + wl.n[0] * .3, y, wl.p1[1] + wl.n[1] * .3, .06);
            var along = .4;
            while (along < wl.len - .4 && placed < books) {
              var slot0 = R.slots.some(function (s) { return s.w === wi && Math.abs(wl.len * s.u - along) < DOOR_W / 2 + .3; });
              if (slot0) { along += .3; continue; }
              var bw = rnd(.08, .16), bh = rnd(.55, .8), bk = new THREE.Mesh(bgeo, basic(VIVID[(placed * 7) % VIVID.length]));
              bk.scale.set(bw, bh, .45); onWall(bk, wl, along + bw / 2, y + bh / 2, .3); g.add(bk); along += bw + .015; placed++;
            }
          }
        });
        if (M.traversals >= 10) setTimeout(function () { if (cur === 4) { S('books'); find('books'); } }, 1500);
      } else if (r === 5) { // Observatory: stars, a telescope, your route as a constellation
        var sp = [], cl = [];
        for (var s2 = 0; s2 < 260; s2++) { var a2 = Math.random() * TAU, rr = Math.sqrt(Math.random()) * 7; sp.push(Math.cos(a2) * rr, h - .05, Math.sin(a2) * rr); }
        var sg2 = geo(new THREE.BufferGeometry()); sg2.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
        g.add(new THREE.Points(sg2, track(new THREE.PointsMaterial({ color: '#ffffff', size: .07 }))));
        var hs = M.history.slice(-40);
        for (var q = 1; q < hs.length; q++) { var A1 = NODE[hs[q - 1]], B1 = NODE[hs[q]]; if (!A1 || !B1) continue; cl.push((A1[0] - 128) / 22, h - .08, (A1[1] - 105) / 22, (B1[0] - 128) / 22, h - .08, (B1[1] - 105) / 22); }
        if (cl.length) { var cg2 = geo(new THREE.BufferGeometry()); cg2.setAttribute('position', new THREE.Float32BufferAttribute(cl, 3)); g.add(new THREE.LineSegments(cg2, track(new THREE.LineBasicMaterial({ color: R.accent })))); }
        NODE.forEach(function (p) { var st2 = new THREE.Mesh(geo(new THREE.CircleGeometry(.12, 5)), basic(R.accent)); st2.rotation.x = Math.PI / 2; st2.position.set((p[0] - 128) / 22, h - .09, (p[1] - 105) / 22); g.add(st2); });
        var tube = toon(new THREE.Mesh(geo(new THREE.CylinderGeometry(.16, .24, 2.2, 20)), basic(R.accent)), 1.1); tube.position.set(1.6, 1.9, -1.2); tube.rotation.z = .9; tube.rotation.y = .5; g.add(tube);
        [0, 1, 2].forEach(function (k) { var a3 = k / 3 * TAU; bar(g, 1.5, 1.4, -1.2, 1.5 + Math.cos(a3) * .7, 0, -1.2 + Math.sin(a3) * .7, .05); });
        sky = { look: 0 };
      } else if (r === 6) { // Echo: your footprints, all of them
        var pr = M.prints.slice(-400), pg2 = geo(new THREE.CircleGeometry(.11, 10)), pmA = basic(INK), pmB = basic(R.accent);
        pr.forEach(function (p, i) { var m2 = new THREE.Mesh(pg2, i % 2 ? pmA : pmB); m2.rotation.x = -Math.PI / 2; m2.scale.set(1, 1.7, 1); m2.rotation.z = p[2] || 0; m2.position.set(p[0], .012 + (i % 7) * .0005, p[1]); g.add(m2); });
        if (pr.length > 20) setTimeout(function () { if (cur === 6) find('prints'); }, 1600);
        R.walls.forEach(function (wl) { for (var k3 = 1; k3 < 5; k3++) { var cone = toon(new THREE.Mesh(geo(new THREE.ConeGeometry(.35, 1.1, 4)), basic(R.accent)), 1.08); onWall(cone, wl, wl.len * k3 / 5, h - 1.2, .55); cone.rotation.order = 'YXZ'; cone.rotation.x = Math.PI / 2; g.add(cone); } });
      } else if (r === 7) { // Atrium: a garden that grows from the time spent here
        var growK = clamp(M.dwell[7] / 90, 0, 1), count = Math.min(14, 3 + M.visits[7] * 2);
        for (var tI = 0; tI < count; tI++) {
          var ang = tI * 2.39996, rad = 1.6 + (tI % 5) * 1.05, tx = Math.cos(ang) * rad, tz = Math.sin(ang) * rad; if (!inside(R, tx, tz, .9)) continue;
          var tg = new THREE.Group(); tg.position.set(tx, 0, tz);
          var trunk = toon(new THREE.Mesh(geo(new THREE.CylinderGeometry(.07, .1, 1, 8)), basic('#7a3b12')), 1.25); trunk.position.y = .5; tg.add(trunk);
          var crown = toon(new THREE.Mesh(geo(tI % 2 ? new THREE.SphereGeometry(.55, 18, 12) : new THREE.ConeGeometry(.6, 1.4, 16)), basic(VIVID[(tI * 3) % VIVID.length])), 1.07); crown.position.y = 1.5; tg.add(crown);
          tg.scale.setScalar(.35); g.add(tg); trees.push({ g: tg, target: .5 + growK * 1.1 + (tI % 3) * .1 });
        }
        if (M.visits[7] >= 3 || M.dwell[7] > 30) setTimeout(function () { if (cur === 7) find('garden'); }, 1800);
      }
    }

    // ---------- the portrait (Gallery frames, panel map) ----------
    var NODE = [[70, 52], [160, 28], [222, 102], [130, 104], [40, 128], [222, 176], [72, 182], [150, 182]];
    function portrait(k) {
      var c = document.createElement('canvas'); c.width = 256; c.height = 210; var x = c.getContext('2d');
      x.fillStyle = '#fff6ea'; x.fillRect(0, 0, 256, 210); x.strokeStyle = INK; x.lineCap = 'round'; x.lineJoin = 'round';
      if (k === 0) {
        EDGES.forEach(function (e, i) { var a = NODE[e[0]], b = NODE[e[1]], st = M.edges[i].state; x.setLineDash(st === 'open' ? [] : st === 'latent' ? [2, 6] : [10, 6]); x.globalAlpha = st === 'open' ? 1 : .35; x.lineWidth = st === 'open' ? 2 + Math.min(9, M.edges[i].uses) : 2; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); });
        x.setLineDash([]); x.globalAlpha = 1;
        NODE.forEach(function (p, i) { x.lineWidth = 3; x.fillStyle = ROOMS[i].wall; x.beginPath(); x.arc(p[0], p[1], 10 + Math.min(10, M.visits[i]), 0, TAU); x.fill(); x.stroke(); glyph(x, ROOMS[i].glyph, p[0], p[1], 10, INK); });
      } else if (k === 1) {
        var hs = M.history.slice(-80); x.lineWidth = 2.5; x.strokeStyle = '#ff3d7f'; x.beginPath();
        hs.forEach(function (r, i) { var p = NODE[r]; if (!p) return; var j = (i * 37 % 23) - 11, jj = (i * 53 % 19) - 9; i ? x.lineTo(p[0] + j, p[1] + jj) : x.moveTo(p[0] + j, p[1] + jj); }); x.stroke();
        NODE.forEach(function (p, i) { x.fillStyle = ROOMS[i].wall; x.fillRect(p[0] - 5, p[1] - 5, 10, 10); x.strokeStyle = INK; x.lineWidth = 2; x.strokeRect(p[0] - 5, p[1] - 5, 10, 10); });
      } else if (k === 2) {
        NODE.forEach(function (p, r) {
          var gz = M.gaze[r], mx2 = Math.max.apply(null, gz.concat([1]));
          for (var b = 0; b < 24; b++) { var a = (b + .5) / 24 * TAU - Math.PI / 2, l = 5 + 22 * gz[b] / mx2; x.strokeStyle = ROOMS[r].wall; x.lineWidth = 4; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l); x.stroke(); }
          x.fillStyle = INK; x.beginPath(); x.arc(p[0], p[1], 3, 0, TAU); x.fill();
        });
      } else {
        ROOMS.forEach(function (R, r) {
          var sl = M.slotMap[r]; x.fillStyle = INK; x.font = '700 12px sans-serif'; x.fillText(R.name.toUpperCase(), 14, 22 + r * 24);
          sl.forEach(function (e, s) { var st = M.edges[e].state, px = 120 + s * 32, py = 10 + r * 24; x.lineWidth = 2; x.strokeStyle = INK; x.strokeRect(px, py, 24, 16); if (st === 'open') { x.fillStyle = ROOMS[other(e, r)].wall; x.fillRect(px + 2, py + 2, 20, 12); } else if (st === 'sealed') { x.beginPath(); x.moveTo(px, py); x.lineTo(px + 24, py + 16); x.moveTo(px + 24, py); x.lineTo(px, py + 16); x.stroke(); } });
        });
      }
      return c;
    }

    // ---------- the visitor ----------
    var pos = new THREE.Vector3(0, EYE, 0), yaw = 0, pitch = 0, yawVel = 0, mode = 'free', path = null, walkT = 0, stepT = 0, trailBuf = [], trailT = 0, printT = 0;
    var keys = {}, transitDoor = null, holdWalk = false, goal = null, turnTarget = null, flicker = 0, fovBack = false;
    function place(r, slot) { var s = ROOMS[r].slots[slot]; pos.set(s.p[0] + s.n[0] * 1.7, EYE, s.p[1] + s.n[1] * 1.7); yaw = Math.atan2(-s.n[0], -s.n[1]); pitch = 0; }
    function doorPoint(D) { return [D.wall.p0[0] + D.wall.d[0] * D.mid, D.wall.p0[1] + D.wall.d[1] * D.mid]; }
    function walkThrough(D) {
      if (mode !== 'free' || !D || D.state !== 'open') return;
      var w = D.wall, door = doorPoint(D);
      path = [[pos.x, pos.z], [door[0] + w.n[0] * .9, door[1] + w.n[1] * .9], door, [door[0] + D.out[0] * D.corr.L, door[1] + D.out[1] * D.corr.L]];
      path.seg = 0; mode = 'walk'; walkT = 0; transitDoor = D; goal = null;
      leave(cur, D.slot);
    }
    function leave(r, slot) {
      for (var s = 0; s < M.slotMap[r].length; s++) { if (s === slot) M.ignored[r][s] = 0; else if (M.edges[edgeOf(r, s)].state === 'open') M.ignored[r][s]++; }
      M.trail[r] = trailBuf.slice(-240); M.exitSlot[r] = slot; trailBuf = []; save();
    }
    function arrive(r, e) {
      M.edges[e].uses++; M.traversals++; M.visits[r]++; M.lastVisit[r] = M.traversals; M.history.push(r); if (M.history.length > 200) M.history.shift(); M.current = r;
      if (M.edges[e].uses >= 3) setTimeout(function () { find('long'); }, 600);
      var arrSlot = M.slotMap[r].indexOf(e); M.ignored[r][arrSlot] = 0;
      var hs = M.history, n = hs.length;
      if (n >= 4 && hs[n - 1] === hs[n - 3] && hs[n - 2] === hs[n - 4] && hs[n - 1] !== hs[n - 2] && M.traversals >= (M.loopGuard || 0)) {
        var sm = M.slotMap[r]; M.slotMap[r] = sm.slice(1).concat([sm[0]]); M.rewires++; M.loopGuard = M.traversals + 3;
        setTimeout(function () { S('rewire'); find('rewire'); flicker = 1; }, 900);
      }
      var sealed = false;
      for (var s = 0; s < M.slotMap[r].length; s++) { if (s === arrSlot) continue; var e2 = edgeOf(r, s); if (M.ignored[r][s] >= 4 && M.edges[e2].state === 'open' && canSeal(e2)) { M.edges[e2].state = 'sealed'; sealed = true; } }
      buildRoom(r); place(r, arrSlot); trailBuf = [];
      if (sealed) setTimeout(function () { S('seal'); find('seal'); }, 1200);
      maybeGhost(r); save(); syncPanel();
    }
    function goTo(x, z) { // walk to a point on the floor; near an open door, go through it
      if (!isFinite(x) || !isFinite(z)) return;
      var near = null, nd = 1.8;
      doorObjs.forEach(function (D) { if (D.state !== 'open') return; var p = doorPoint(D), d = Math.hypot(p[0] - x, p[1] - z); if (d < nd) { nd = d; near = D; } });
      if (near) { walkThrough(near); return; }
      goal = { x: x, z: z }; tapRing(x, z);
    }

    // ---------- ghost ----------
    var ghost = null;
    function clearGhost() { if (ghost) { scene.remove(ghost.obj); ghost.mat.dispose(); ghost = null; S('ghost', false); } }
    function maybeGhost(r, force) {
      clearGhost();
      var tr = M.trail[r]; if (!tr || tr.length < 8 || (Math.random() > .65 && !returning && !force)) return;
      var mat = new THREE.SpriteMaterial({ map: ghostTex, transparent: true, opacity: 0, depthWrite: false }), obj = new THREE.Sprite(mat);
      obj.scale.set(.75, 1.7, 1); obj.position.set(tr[0][0], .85, tr[0][1]); scene.add(obj);
      ghost = { obj: obj, mat: mat, tr: tr, i: 0, t0: t + 1.5, exit: M.exitSlot[r], room: r, phase: 'trail', seen: false };
    }

    // ---------- tap feedback ----------
    var tapMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    var tapMesh = new THREE.Mesh(new THREE.RingGeometry(.3, .42, 40), tapMat); tapMesh.rotation.x = -Math.PI / 2; scene.add(tapMesh); var tapAge = 9;
    var goalMesh = new THREE.Mesh(new THREE.RingGeometry(.12, .2, 24), new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide })); goalMesh.rotation.x = -Math.PI / 2; goalMesh.visible = false; scene.add(goalMesh);
    function tapRing(x, z) { tapMesh.position.set(x, .03, z); tapAge = 0; goalMesh.position.set(x, .025, z); goalMesh.visible = true; S('tap'); }

    // ---------- input ----------
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pd = null, multiSeen = false, mx = -1, my = -1, hoverT = 0, hovered = null;
    function setRay(x, y) { ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, camera); }
    function pick(x, y) { setRay(x, y); var h = ray.intersectObjects(hitList, false); return h.length ? h[0].object.userData : null; }
    function floorAt(x, y) { setRay(x, y); if (!floorMesh) return null; var h = ray.intersectObject(floorMesh, false); return h.length ? h[0].point : null; }
    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && G && G.count() > 1) { multiSeen = true; pd = null; return; }
      pd = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, touch: e.pointerType === 'touch' };
      yawVel = 0; try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
    }, sig);
    canvas.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!pd || (G && G.count() > 1)) return;
      var dx = e.clientX - pd.x, dy = e.clientY - pd.y; pd.x = e.clientX; pd.y = e.clientY;
      if (!pd.moved && Math.hypot(e.clientX - pd.sx, e.clientY - pd.sy) > (pd.touch ? 14 : 5)) { pd.moved = true; canvas.style.cursor = 'grabbing'; dx = e.clientX - pd.sx; dy = e.clientY - pd.sy; }
      if (pd.moved && mode !== 'walk' && mode !== 'fade') {
        var k = (pd.touch ? .0075 : .0045) * camera.fov / 72; yaw += dx * k; pitch = clamp(pitch + dy * k, -1.2, 1.2);
        if (pd.touch) yawVel = lerp(yawVel, dx * k * 60, .4); turnTarget = null;
      }
    }, sig);
    function up(e) {
      var p0 = pd; pd = null; canvas.style.cursor = 'grab';
      if (multiSeen) { if (!G || G.count() === 0) multiSeen = false; return; }
      if (!p0 || e.type === 'pointercancel' || holdWalk) return;
      var quick = p0.touch && performance.now() - p0.t0 < 260 && Math.hypot(e.clientX - p0.sx, e.clientY - p0.sy) < 28;
      if (p0.moved && !quick) return;
      yawVel = 0; tap(e.clientX, e.clientY);
    }
    canvas.addEventListener('pointerup', up, sig); canvas.addEventListener('pointercancel', up, sig);
    function tap(x, y) {
      if (mode !== 'free') return;
      var u = pick(x, y);
      if (u && u.door) { if (u.door.state === 'open') walkThrough(u.door); else if (u.door.state === 'sealed') knock(u.door, 1); return; }
      var f = floorAt(x, y); if (f) goTo(f.x, f.z);
    }
    function knock(D, amount) {
      if (t - D.crackT > 5) D.cracks = 0; D.crackT = t; D.cracks += amount; S('crack', Math.min(3, D.cracks)); flashDoor = { D: D, t: t };
      if (D.cracks >= 3) { M.edges[D.edge].state = 'open'; M.ignored[cur][D.slot] = 0; rebuildHere(); S('open'); find('reopen'); }
    }
    var flashDoor = null;
    function rebuildHere() { var p = pos.clone(), y0 = yaw, p0 = pitch; buildRoom(cur); pos.copy(p); yaw = y0; pitch = p0; save(); syncPanel(); }
    addEventListener('keydown', function (e) { if (e.metaKey || e.ctrlKey || e.altKey || (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName))) return; keys[e.key.toLowerCase()] = true; if (/^arrow/.test(e.key.toLowerCase())) e.preventDefault(); }, sig);
    addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; }, sig);
    addEventListener('blur', function () { keys = {}; }, sig);

    var G = api.gestures ? api.gestures(canvas, function (type, d) {
      switch (type) {
        case 'multistart': multiSeen = true; pd = null; break;
        case 'longpress': holdWalk = true; goal = null; break;
        case 'longend': holdWalk = false; break;
        case 'twotap': if (mode === 'free') turnTarget = yaw + Math.PI; break;
        case 'pinch': camera.fov = clamp(72 / Math.pow(d.scale, .6), 40, 100); camera.updateProjectionMatrix(); break;
        case 'multiend': fovBack = true; break;
        case 'circle': if (M.trail[cur] && M.trail[cur].length >= 8) maybeGhost(cur, true); break;
        case 'rubbing': var u = pick(d.x, d.y); if (u && u.door && u.door.state === 'sealed' && t - (u.door.rubT || 0) > .35) { u.door.rubT = t; knock(u.door, 1); } break;
        case 'threetap': openPanel(!panelOpen); break;
      }
    }) : null;

    // ---------- panel: the plan, as it now stands ----------
    var slot = api.slot && api.slot(), panel = null, ctl = {}, panelOpen = false;
    function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
    if (slot) {
      var wrap = el('div', 'icpick'), btn = el('button', 'hudbtn'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(el('span', 'icglyph')); btn.appendChild(el('span', null, 'MEMORY'));
      panel = el('div', 'icpanel'); panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'What the building remembers');
      ctl.map = el('div'); ctl.map.style.cssText = 'width:100%;aspect-ratio:256/210'; panel.appendChild(ctl.map);
      ctl.stats = el('div', 'iclab'); ctl.stats.style.cssText = 'line-height:1.9;text-transform:uppercase'; panel.appendChild(ctl.stats);
      var foot = el('div', 'icfoot'); foot.appendChild(el('span', 'iclab', 'Kept in this browser'));
      var forget = el('button', 'iccopy', 'FORGET'); forget.type = 'button'; foot.appendChild(forget); panel.appendChild(foot);
      var confirmRow = el('div', 'icfoot'); confirmRow.hidden = true; confirmRow.appendChild(el('span', 'iclab', 'Forget every room?'));
      var no = el('button', 'iccopy', 'KEEP'); no.type = 'button'; var yes = el('button', 'iccopy', 'FORGET'); yes.type = 'button'; yes.style.marginLeft = '8px';
      confirmRow.appendChild(no); confirmRow.appendChild(yes); panel.appendChild(confirmRow);
      no.style.marginLeft = 'auto';
      forget.addEventListener('click', function () { confirmRow.hidden = false; foot.hidden = true; });
      no.addEventListener('click', function () { confirmRow.hidden = true; foot.hidden = false; });
      yes.addEventListener('click', function () {
        confirmRow.hidden = true; foot.hidden = false; var s0 = M.sessions; M = fresh(); M.sessions = s0; save(); clearGhost();
        fade.style.opacity = 1; setTimeout(function () { buildRoom(0); pos.set(0, EYE, 0); yaw = 0; pitch = 0; trailBuf = []; fade.style.opacity = 0; syncPanel(); }, 550);
      });
      wrap.appendChild(btn); wrap.appendChild(panel); slot.appendChild(wrap); ctl.btn = btn;
      btn.addEventListener('click', function () { openPanel(panel.hidden); });
      document.addEventListener('pointerdown', function (e) { if (panelOpen && !wrap.contains(e.target)) openPanel(false); }, sig);
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { openPanel(false); btn.focus(); e.stopPropagation(); } }, { capture: true, signal: ac.signal });
    }
    function openPanel(o) { if (!panel) return; panelOpen = o; panel.hidden = !o; ctl.btn.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) syncPanel(); }
    function syncPanel() {
      if (!panel || !panelOpen) return;
      var s = '<svg viewBox="0 0 256 210" width="100%" height="100%" role="img" aria-label="Plan of the eight rooms and their passages">';
      EDGES.forEach(function (e, i) {
        var a = NODE[e[0]], b = NODE[e[1]], E = M.edges[i], dash = E.state === 'open' ? '' : E.state === 'latent' ? '2 6' : '8 6', op = E.state === 'open' ? 1 : .35, w = E.state === 'open' ? 1.4 + Math.min(7, E.uses * .7) : 1;
        s += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" style="stroke:var(--p-fg)" stroke-opacity="' + op + '" stroke-width="' + w + '" stroke-linecap="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
      });
      NODE.forEach(function (p, i) {
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (7 + Math.min(7, M.visits[i])) + '" fill="' + ROOMS[i].wall + '" fill-opacity="' + (M.visits[i] ? 1 : .25) + '" stroke="' + (i === cur ? '#fff' : ROOMS[i].wall) + '" stroke-width="' + (i === cur ? 3 : 1.5) + '"' + (neglected(i) ? ' stroke-dasharray="3 3"' : '') + '/>';
        s += '<text x="' + p[0] + '" y="' + (p[1] + (p[1] < 60 ? -16 : 24)) + '" style="fill:var(--p-dim)" font-size="8" text-anchor="middle" letter-spacing="1.2">' + ROOMS[i].name.toUpperCase() + '</text>';
      });
      ctl.map.innerHTML = s + '</svg>';
      var sealedN = M.edges.filter(function (e) { return e.state === 'sealed'; }).length, visited = M.visits.filter(function (v) { return v > 0; }).length;
      ctl.stats.textContent = 'Rooms visited ' + visited + '/8 · passages walked ' + M.traversals + ' · doors sealed ' + sealedN + (M.rewires ? ' · rewired ' + M.rewires : '');
    }

    function updateCalls() {
      S('setCalls', calling.map(function (D) { return { key: cur + ':' + D.slot, note: ROOMS[D.target].note + 12, pan: 0, gain: 1 }; }));
      if (calling.length) setTimeout(function () { find('call'); }, 2000);
    }

    // ---------- start ----------
    var t = 0, last = performance.now(), raf = 0, saveT = 0, stareT = 0;
    cur = clamp(M.current | 0, 0, ROOMS.length - 1);
    buildRoom(cur);
    if (M.visits[cur] === 0) { M.visits[cur] = 1; M.lastVisit[cur] = 0; M.history.push(cur); }
    pos.set(0, EYE, cur === 1 ? 4 : cur === 4 ? -3 : 0); yaw = 0;
    if (cur === 4) pos.x = -3;
    if (returning) { maybeGhost(cur); setTimeout(function () { find('back'); }, 1800); }
    setTimeout(function () { fade.style.opacity = 0; }, 80);
    save();

    function resize() { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); canvas.style.width = '100%'; canvas.style.height = '100%'; camera.aspect = W / H; camera.updateProjectionMatrix(); }
    addEventListener('resize', resize, sig); resize();

    // ---------- frame ----------
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(.05, (now - last) / 1000); last = now; if (dt <= 0) return; t += dt;
      var R = ROOMS[cur];

      if (mode === 'free') {
        if (!pd && Math.abs(yawVel) > .001) { yaw += yawVel * dt; yawVel *= Math.pow(.02, dt); }
        var mvF = (keys.w || keys.arrowup || holdWalk ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), mvS = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        if (keys.arrowleft) yaw += dt * 1.7; if (keys.arrowright) yaw -= dt * 1.7;
        if (mvF || mvS) goal = null;
        if (turnTarget != null) { yaw += (turnTarget - yaw) * Math.min(1, dt * 5); if (Math.abs(turnTarget - yaw) < .01) turnTarget = null; }
        var vx = 0, vz = 0, sp = 2.7;
        if (goal) {
          var gx = goal.x - pos.x, gz = goal.z - pos.z, gd = Math.hypot(gx, gz);
          if (gd < .15) { goal = null; goalMesh.visible = false; }
          else { vx = gx / gd; vz = gz / gd; if (!pd) { var ty = Math.atan2(-vx, -vz), dy = ty - yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; yaw += dy * Math.min(1, dt * 3); } }
        } else if (mvF || mvS) { vx = -Math.sin(yaw) * mvF + Math.cos(yaw) * mvS; vz = -Math.cos(yaw) * mvF - Math.sin(yaw) * mvS; }
        if (vx || vz) {
          var nx = pos.x + vx * sp * dt, nz = pos.z + vz * sp * dt, through = null;
          doorObjs.forEach(function (D) { if (D.state !== 'open') return; var w = D.wall, along = (nx - w.p0[0]) * w.d[0] + (nz - w.p0[1]) * w.d[1], dist = (nx - w.p0[0]) * w.n[0] + (nz - w.p0[1]) * w.n[1]; if (dist < .4 && dist > -1 && Math.abs(along - D.mid) < DOOR_W / 2 - .1) through = D; });
          if (through) walkThrough(through);
          else {
            var moved = false;
            if (inside(R, nx, pos.z, .4)) { pos.x = nx; moved = true; } if (inside(R, pos.x, nz, .4)) { pos.z = nz; moved = true; }
            if (cur === 1) for (var cz = -7.5; cz <= 7.5; cz += 3) [-2, 2].forEach(function (cx) { var ddx = pos.x - cx, ddz = pos.z - cz, dd = Math.hypot(ddx, ddz); if (dd < .5) { pos.x = cx + ddx / dd * .5; pos.z = cz + ddz / dd * .5; } });
            if (!moved && goal) { goal = null; goalMesh.visible = false; }
            stepT += dt; if (stepT > .48) { stepT = 0; S('step', 0); }
            printT += dt; if (printT > .55 && cur === 6) { printT = 0; M.prints.push([+pos.x.toFixed(2), +pos.z.toFixed(2), +(Math.atan2(vx, vz)).toFixed(2)]); if (M.prints.length > 600) M.prints.shift(); }
            if (cur === 2 && Math.hypot(pos.x, pos.z) < 2.2 && pool) { var rg = pool.rings[Math.floor(t * 10) % 4]; if (rg.age > .5) { rg.age = 0; rg.o.position.x = pos.x; rg.o.position.z = pos.z; S('splash'); } }
          }
        }
        trailT += dt; if (trailT > .3) { trailT = 0; trailBuf.push([+pos.x.toFixed(2), +pos.z.toFixed(2)]); if (trailBuf.length > 300) trailBuf.shift(); }
        if (pitch > -.4 && pitch < .5) { var b = Math.floor((((yaw % TAU) + TAU) % TAU) / TAU * 24) % 24; M.gaze[cur][b] += dt; }
        M.dwell[cur] += dt;
        if ((M.dwell[cur] > 45 && M.dwell[cur] - dt <= 45) || (M.dwell[cur] > 120 && M.dwell[cur] - dt <= 120)) { S('grow'); find('grow'); fade.style.opacity = .8; setTimeout(function () { rebuildHere(); fade.style.opacity = 0; }, 420); }
      } else if (mode === 'walk') {
        var seg = path.seg, a = path[seg], b2 = path[seg + 1], segLen = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || .001, inCorr = seg >= 2;
        walkT += dt * (inCorr ? 2.6 : 3) / segLen;
        var k2 = Math.min(1, walkT); pos.x = lerp(a[0], b2[0], k2); pos.z = lerp(a[1], b2[1], k2);
        var ty2 = Math.atan2(-(b2[0] - a[0]), -(b2[1] - a[1])), dy2 = ty2 - yaw; while (dy2 > Math.PI) dy2 -= TAU; while (dy2 < -Math.PI) dy2 += TAU; yaw += dy2 * Math.min(1, dt * 5); pitch += (0 - pitch) * Math.min(1, dt * 3);
        stepT += dt; if (stepT > .46) { stepT = 0; S('step', inCorr ? 1 - transitDoor.corr.w / DOOR_W : 0); }
        if (k2 >= 1) { path.seg++; walkT = 0; if (path.seg === 2) S('corridor', true, transitDoor.corr.L, 1 - transitDoor.corr.w / DOOR_W); }
        if (inCorr && segLen * (1 - k2) < 1.4) fade.style.opacity = 1;
        if (path.seg >= path.length - 1) {
          mode = 'fade'; var D = transitDoor; goalMesh.visible = false;
          setTimeout(function () { if (ac.signal.aborted) return; S('corridor', false, 0, 0); arrive(D.target, D.edge); mode = 'free'; fade.style.opacity = 0; }, 420);
        }
      }

      // the room responding while you are in it
      stains.forEach(function (s) { s.m.opacity += (s.target - s.m.opacity) * Math.min(1, dt * .8); s.rm.opacity = s.m.opacity; });
      var pulse = .5 + .5 * Math.sin(t * 5);
      calling.forEach(function (D) { if (D.band) D.band.opacity = .35 + .65 * pulse; });
      if (pool) pool.rings.forEach(function (rg) { rg.age += dt; rg.o.scale.setScalar(.2 + rg.age * 1.6); rg.m.opacity = Math.max(0, .8 - rg.age * .55); });
      trees.forEach(function (tr) { var s2 = tr.g.scale.x; tr.g.scale.setScalar(s2 + (tr.target - s2) * Math.min(1, dt * .8)); });
      if (flashDoor && t - flashDoor.t < .25 && flashDoor.D.outline) flashDoor.D.outline.color.set(Math.floor(t * 20) % 2 ? '#ffffff' : INK); else if (flashDoor && flashDoor.D.outline) { flashDoor.D.outline.color.set(INK); flashDoor = null; }
      if (flicker > 0) { flicker = Math.max(0, flicker - dt * .8); renderer.setClearColor(Math.random() < flicker * .3 ? '#000' : R.ceil, 1); if (room) room.visible = !(Math.random() < flicker * .25); } else if (room && !room.visible) room.visible = true;
      tapAge += dt; tapMat.opacity = Math.max(0, 1 - tapAge * 1.6); tapMesh.scale.setScalar(1 + tapAge * 2);
      if (fovBack && !(G && G.count() > 0)) { camera.fov += (72 - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); if (Math.abs(camera.fov - 72) < .2) { camera.fov = 72; camera.updateProjectionMatrix(); fovBack = false; } }

      // what you are looking at
      stareT += dt;
      if (stareT > .15 && mode === 'free') {
        stareT = 0; ndc.set(0, 0); ray.setFromCamera(ndc, camera); var hh = ray.intersectObjects(hitList, false), u0 = hh.length ? hh[0].object.userData : null, dist0 = hh.length ? hh[0].distance : 99;
        doorObjs.forEach(function (D) {
          if (D.state !== 'latent') return;
          if (u0 && u0.door === D && dist0 < 14) D.stare += .15; else D.stare = Math.max(0, D.stare - .08);
          if (D.fillBar) { D.fillBar.scale.y = Math.max(.001, D.stare / 5 * DOOR_H); D.fillBar.position.y = D.fillBar.scale.y / 2; }
          if (D.outline) D.outline.opacity = .25 + Math.min(.75, D.stare / 5);
          if (D.stare >= 5) { M.edges[D.edge].state = 'open'; rebuildHere(); S('open'); find('open'); }
        });
        frames.forEach(function (f) { if (u0 && u0.frame === f && dist0 < 9) { f.look += .15; if (f.look > 2 && !f.done) { f.done = true; S('portrait'); find('portrait'); } } });
        if (stairs) { var fz2 = -Math.cos(yaw), fx2 = -Math.sin(yaw), wn = R.walls[2].n; if (pitch > .25 && -(fx2 * wn[0] + fz2 * wn[1]) > .4) { stairs.look += .15; if (stairs.look > 4 && !stairs.on) { stairs.on = true; stairs.until = t + 20; S('stair', true); find('stair'); } } }
        if (sky && pitch > .7) { sky.look += .15; if (sky.look > 2.5 && !sky.done) { sky.done = true; S('portrait'); find('sky'); } }
      }
      if (stairs && stairs.on) {
        stairs.off += dt * .9; if (stairs.off > 1) stairs.off -= 1;
        stairs.g.position.set(-stairs.off * stairs.stepW, -stairs.off * stairs.stepH, 0);
        if (t > stairs.until) { stairs.on = false; stairs.look = 0; S('stair', false); }
      }
      if (!pd && !TOUCH && mx >= 0 && t - hoverT > .1 && mode === 'free') {
        hoverT = t; var hu = pick(mx, my), hd = hu && hu.door && (hu.door.state === 'open' || hu.door.state === 'sealed') ? hu.door : null;
        canvas.style.cursor = hd ? 'pointer' : 'crosshair';
        if (hd !== hovered) { if (hovered && hovered.band && calling.indexOf(hovered) < 0) hovered.band.opacity = hovered.fade; hovered = hd; if (hd && hd.state === 'open') { S('hover', hd.target); if (hd.band) hd.band.opacity = 1; } }
      }

      // ghost
      if (ghost && t > ghost.t0) {
        var gh = ghost, tr = gh.tr;
        if (gh.phase === 'trail') {
          gh.i += dt / .3; var i0 = Math.floor(gh.i);
          if (i0 >= tr.length - 1) {
            gh.phase = 'exit'; var sl = ROOMS[gh.room].slots[gh.exit] || ROOMS[gh.room].slots[0]; gh.to = [sl.p[0] + sl.n[0] * .3, sl.p[1] + sl.n[1] * .3];
            var ee = M.slotMap[gh.room][Math.max(0, gh.exit)]; gh.sealed = ee == null || M.edges[ee].state !== 'open';
          } else { var f0 = gh.i - i0, p0 = tr[i0], p1 = tr[i0 + 1]; gh.obj.position.x = lerp(p0[0], p1[0], f0); gh.obj.position.z = lerp(p0[1], p1[1], f0); }
          gh.mat.opacity = Math.min(.8, gh.mat.opacity + dt * .6);
        } else {
          var gx2 = gh.to[0] - gh.obj.position.x, gz2 = gh.to[1] - gh.obj.position.z, gd2 = Math.hypot(gx2, gz2);
          if (gd2 > .05) { gh.obj.position.x += gx2 / gd2 * Math.min(gd2, dt * 1.2); gh.obj.position.z += gz2 / gd2 * Math.min(gd2, dt * 1.2); }
          if (gd2 < 1.2) gh.mat.opacity -= dt * (gh.sealed ? .25 : .7);
          if (gh.mat.opacity <= 0) clearGhost();
        }
        if (ghost) { ghost.obj.position.y = .85 + Math.sin(t * 2) * .04; if (!ghost.seen) { var vx2 = ghost.obj.position.x - pos.x, vz2 = ghost.obj.position.z - pos.z, vd = Math.hypot(vx2, vz2), facing = (-Math.sin(yaw) * vx2 - Math.cos(yaw) * vz2) / (vd || 1); if (facing > .8 && vd < 14) { ghost.seen = true; S('ghost', true); find('ghost'); } } }
      }

      saveT += dt; if (saveT > 5) { saveT = 0; save(); }
      camera.position.set(pos.x, EYE + (mode === 'walk' || goal || holdWalk ? Math.sin(t * 9) * .025 : 0), pos.z);
      camera.rotation.set(pitch, yaw, 0);
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
    if (SBL.debug) SBL._06 = { mem: function () { return M; }, room: function () { return cur; }, mode: function () { return mode; }, doors: function () { return doorObjs.map(function (D) { return { slot: D.slot, state: D.state, target: D.target, L: D.corr && D.corr.L }; }); }, go: function (slot) { var D = doorObjs.filter(function (q) { return q.slot === slot; })[0]; walkThrough(D); return !!D; }, goTo: goTo, pos: function () { return [pos.x, pos.z]; } };

    return function unmount() {
      save(); cancelAnimationFrame(raf); ac.abort(); if (G) G(); S('stop'); clearGhost();
      disposeRoom(); [ghostTex, tapMat, inkMat, inkBack, sharedBar, tapMesh.geometry, goalMesh.geometry, goalMesh.material].forEach(function (d) { try { d.dispose(); } catch (e) {} });
      renderer.dispose();
    };
  }
});
