/* 05 — Resonant Matter. The music does not animate the sculpture, it builds it.
   Onsets are detected from band-limited spectral flux on the master output:
     kick (low analyser, < 90 Hz) → deposits a cluster of mass at a growth tip, which then advances
     snare (1.4–4.2 kHz)          → cracks the newest material, throws shards, turns the growth, sometimes forks it
     sustained energy (60–900 Hz)  → stretches and twists the whole object, draws rods out of the tip
     hats (7–14 kHz)              → a little grit on the surface
   The visitor can lean on it too: graft growth to a spot, steer it, pull material out by hand, wear it away,
   twist it, mirror it, change its material — and play it, since every piece of it sounds.
   Every event (heard or touched) is recorded, so a finished sculpture can be rebuilt exactly. */
SBL.register('05', {
  mount: function (stage, api) {
    'use strict';
    var ac = new AbortController(), sig = { signal: ac.signal };
    var TOUCH = !!api.touch, W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 2), TAU = Math.PI * 2;
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

    // ---------- plain vector maths, so growth is deterministic and testable ----------
    function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function vmul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
    function vlen(a) { return Math.hypot(a[0], a[1], a[2]); }
    function vnorm(a) { var l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
    function vcross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function qnorm(q) { var l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
    function qaxis(ax, a) { var s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; }
    function qmul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
    function qfromto(a, b) { var r = vdot(a, b) + 1; if (r < 1e-6) { var ax = Math.abs(a[0]) > Math.abs(a[2]) ? [-a[1], a[0], 0] : [0, -a[2], a[1]]; return qnorm([ax[0], ax[1], ax[2], 0]); } var c = vcross(a, b); return qnorm([c[0], c[1], c[2], r]); }
    function vrot(v, ax, a) { var c = Math.cos(a), s = Math.sin(a), d = vdot(ax, v), cr = vcross(ax, v); return [v[0] * c + cr[0] * s + ax[0] * d * (1 - c), v[1] * c + cr[1] * s + ax[1] * d * (1 - c), v[2] * c + cr[2] * s + ax[2] * d * (1 - c)]; }
    function perp(d, r) { var a = Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0], p = vnorm(vcross(d, a)); return vrot(p, d, r * TAU); }
    function compose(te, o, p, q, s) {
      var x = q[0], y = q[1], z = q[2], w = q[3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
      te[o] = (1 - (yy + zz)) * s[0]; te[o + 1] = (xy + wz) * s[0]; te[o + 2] = (xz - wy) * s[0]; te[o + 3] = 0;
      te[o + 4] = (xy - wz) * s[1]; te[o + 5] = (1 - (xx + zz)) * s[1]; te[o + 6] = (yz + wx) * s[1]; te[o + 7] = 0;
      te[o + 8] = (xz + wy) * s[2]; te[o + 9] = (yz - wx) * s[2]; te[o + 10] = (1 - (xx + yy)) * s[2]; te[o + 11] = 0;
      te[o + 12] = p[0]; te[o + 13] = p[1]; te[o + 14] = p[2]; te[o + 15] = 1;
    }
    var UP = [0, 1, 0], TWIST_H = 12;

    // ---------- shapes and the five materials ----------
    // 0 box · 1 boulder · 2 crystal · 3 rod · 4 ring · 5 prism · 6 shard · 7 grit
    var NSHAPE = 8;
    var GRAINS = [
      { name: 'Monolith', mass: [0, 0, 0, 5], shard: 5, rod: 3 },
      { name: 'Boulder', mass: [1, 1, 1, 0], shard: 6, rod: 3 },
      { name: 'Crystal', mass: [2, 2, 2, 5], shard: 2, rod: 5 },
      { name: 'Ring', mass: [4, 4, 1, 4], shard: 0, rod: 3 },
      { name: 'Spine', mass: [5, 5, 6, 5], shard: 6, rod: 3 }
    ];
    var TRACK_GRAIN = { amen: 0, halftime: 1, roller: 3, file: 2 };
    var MIRRORS = [1, 2, 3, 4, 6];

    // ---------- the sculptor: growth rules, fed only by events ----------
    function Sculptor(cap, seed, grain) {
      this.cap = cap; this.rng = mulberry(seed); this.seed = seed; this.grain = grain || 0; this.mirror = 1;
      this.buf = []; for (var s = 0; s < NSHAPE; s++) this.buf.push({ n: 0, mat: new Float32Array(cap * 16), kind: new Float32Array(cap), birth: new Float32Array(cap), crack: new Float32Array(cap), sd: new Float32Array(cap), dirty: true });
      var G = cap * NSHAPE; this.N = 0; this.gS = new Uint8Array(G); this.gL = new Uint16Array(G); this.gK = new Uint8Array(G); this.ctr = new Float32Array(G * 3); this.gR = new Float32Array(G);
      this.br = [{ p: [0, .5, 0], d: [0, 1, 0] }]; this.kicks = 0; this.snares = 0; this.stretch = 0; this.twist = 0; this.mass = 0; this.pulled = 0; this.worn = 0; this.steer = null; this.steerN = 0;
      this.minY = 0; this.maxY = 1; this.maxR = 1; this.events = [];
    }
    Sculptor.prototype.one = function (shape, kind, p, q, s, birth) {
      var B = this.buf[shape]; if (B.n >= this.cap) return -1;
      var l = B.n++, i = this.N++; compose(B.mat, l * 16, p, q, s); B.kind[l] = kind; B.birth[l] = birth; B.crack[l] = 0; B.sd[l] = this.rng(); B.dirty = true;
      this.gS[i] = shape; this.gL[i] = l; this.gK[i] = kind; this.gR[i] = Math.max(s[0], s[1], s[2]) * .5;
      this.ctr[i * 3] = p[0]; this.ctr[i * 3 + 1] = p[1]; this.ctr[i * 3 + 2] = p[2];
      this.minY = Math.min(this.minY, p[1]); this.maxY = Math.max(this.maxY, p[1]); this.maxR = Math.max(this.maxR, Math.hypot(p[0], p[2]));
      return i;
    };
    Sculptor.prototype.add = function (shape, kind, p, q, s, birth) { // with mirror symmetry around the vertical axis
      var first = -1;
      for (var m = 0; m < this.mirror; m++) {
        var a = m * TAU / this.mirror, pr = m ? vrot(p, UP, a) : p, qr = m ? qmul(qaxis(UP, a), q) : q;
        var i = this.one(shape, kind, pr, qr, s, birth); if (m === 0) first = i;
      }
      return first;
    };
    Sculptor.prototype.tip = function () { return this.br[this.kicks % this.br.length]; };
    Sculptor.prototype.contain = function (b) {
      var r = Math.hypot(b.p[0], b.p[2]);
      if (r > 4.5) { b.d[0] -= b.p[0] / r * .25; b.d[2] -= b.p[2] / r * .25; }
      if (b.p[1] < .4 && b.d[1] < .2) b.d[1] = .5;
      if (b.d[1] < -.35) b.d[1] += .3;
      b.d = vnorm(b.d);
    };
    Sculptor.prototype.kick = function (s, birth) {
      var R = this.rng, b = this.tip(), G = GRAINS[this.grain]; this.kicks++;
      var cnt = 3 + Math.floor(s * 5), base = qfromto(UP, b.d);
      for (var i = 0; i < cnt; i++) {
        var shape = G.mass[Math.floor(R() * G.mass.length)], size = (.22 + R() * .5) * (.6 + s * .9), off = vmul(vnorm([R() - .5, R() - .5, R() - .5]), R() * .35 * (.6 + s));
        var q = qmul(qaxis(b.d, R() * TAU), base), sc;
        if (shape === 2) sc = [size * .55, size * 1.7, size * .55];
        else if (shape === 4) sc = [size * 1.3, size * 1.3, size * 1.3];
        else if (shape === 5) sc = [size * .7, size * 1.5, size * .7];
        else if (shape === 1) sc = [size, size * (.8 + R() * .4), size];
        else sc = [size, size * (.6 + R() * .9), size * (.7 + R() * .5)];
        this.add(shape, 0, vadd(b.p, off), q, sc, birth);
      }
      this.mass += cnt * this.mirror;
      if (this.steer && this.steerN > 0) { this.steerN--; b.d = vnorm(vadd(vmul(b.d, .65), vmul(vnorm(vsub(this.steer, b.p)), .35))); }
      b.d = vrot(b.d, perp(b.d, R()), (R() - .5) * .25);
      b.p = vadd(b.p, vmul(b.d, .07 + s * .13));
      this.contain(b);
    };
    Sculptor.prototype.crackAt = function (i, amt, push) {
      var B = this.buf[this.gS[i]], l = this.gL[i], o = l * 16;
      B.crack[l] = Math.min(1, B.crack[l] + amt); B.mat[o + 12] += push[0]; B.mat[o + 13] += push[1]; B.mat[o + 14] += push[2]; B.dirty = true;
      this.ctr[i * 3] += push[0]; this.ctr[i * 3 + 1] += push[1]; this.ctr[i * 3 + 2] += push[2];
    };
    Sculptor.prototype.snare = function (s, birth) {
      var R = this.rng, b = this.tip(), G = GRAINS[this.grain], i; this.snares++;
      for (i = this.N - 1; i >= Math.max(0, this.N - 40 * this.mirror); i--) {
        if (this.gK[i] !== 0) continue;
        var c = [this.ctr[i * 3], this.ctr[i * 3 + 1], this.ctr[i * 3 + 2]], dv = vsub(c, b.p), dl = vlen(dv);
        if (dl > 1.5 && this.mirror === 1) continue;
        if (dl > 1.5) { // mirrored copies crack too
          var rr = Math.hypot(b.p[0], b.p[2]), cr = Math.hypot(c[0], c[2]); if (Math.abs(rr - cr) > 1.5 || Math.abs(b.p[1] - c[1]) > 1.5) continue; dl = Math.max(.1, Math.abs(rr - cr) + Math.abs(b.p[1] - c[1]) * .5); dv = [c[0], 0, c[2]];
        }
        this.crackAt(i, .5 + s * .5, vmul(vnorm(dv), (.05 + s * .16) * Math.max(0, 1 - dl / 1.6)));
      }
      var m = 3 + Math.floor(s * 4);
      for (i = 0; i < m; i++) {
        var dir = vnorm(vadd(perp(b.d, R()), vmul(b.d, (R() - .3) * .8))), len = (.5 + R() * .9) * (.6 + s), sh = G.shard;
        var sc = sh === 0 ? [.07, len, .07] : sh === 2 ? [.12, len, .12] : sh === 5 ? [.09, len, .09] : [.1, len, .1];
        this.add(sh, 1, vadd(b.p, vmul(dir, len * .5)), qfromto(UP, dir), sc, birth);
      }
      var axis = perp(b.d, R()), ang = (.35 + .7 * s) * (R() < .5 ? -1 : 1);
      if (s > .55 && this.br.length < 7 && R() < .45) this.br.push({ p: b.p.slice(), d: vnorm(vrot(b.d, axis, -ang * 1.6)) });
      b.d = vnorm(vrot(b.d, axis, ang)); this.contain(b);
    };
    Sculptor.prototype.sustain = function (lvl, dt, birth) {
      this.stretch = Math.min(1.4, this.stretch + lvl * dt * .02); this.twist = Math.min(9, this.twist + lvl * dt * .11);
      if (lvl > .3) {
        var b = this.tip(), len = .6 + lvl * 1.6, rs = GRAINS[this.grain].rod, w = rs === 5 ? .06 : .035;
        this.add(rs, 2, vadd(b.p, vmul(b.d, len * .5)), qfromto(UP, b.d), [w, len, w], birth);
        b.p = vadd(b.p, vmul(b.d, .05 * lvl)); this.contain(b);
      }
      this.buf[0].dirty = true;
    };
    Sculptor.prototype.grit = function (birth) {
      var R = this.rng; if (this.N < 4) return; var j = Math.floor(R() * this.N); if (this.gK[j] !== 0) return;
      var c = [this.ctr[j * 3], this.ctr[j * 3 + 1], this.ctr[j * 3 + 2]], o = vmul(vnorm([R() - .5, R() - .5, R() - .5]), this.gR[j] + .05);
      this.one(7, 3, vadd(c, o), qaxis(vnorm([R(), R(), R()]), R() * TAU), [.12, .12, .12], birth);
    };
    Sculptor.prototype.graft = function (j) { var b = this.tip(); b.p = [this.ctr[j * 3], this.ctr[j * 3 + 1], this.ctr[j * 3 + 2]]; b.d = vnorm([b.p[0], .6, b.p[2]]); this.contain(b); };
    Sculptor.prototype.pull = function (a, c, birth) { // a strand drawn out by hand, with a knot at the end
      var d = vsub(c, a), len = vlen(d); if (len < .05) return; var dir = vmul(d, 1 / len);
      this.add(3, 4, vmul(vadd(a, c), .5), qfromto(UP, dir), [.05, len, .05], birth);
      this.add(1, 4, c, qaxis(dir, this.rng() * TAU), [.16, .16, .16], birth); this.pulled++;
    };
    Sculptor.prototype.erode = function (j) {
      if (j >= this.N) return; var B = this.buf[this.gS[j]], l = this.gL[j], o = l * 16, k = .72;
      for (var c = 0; c < 3; c++) { B.mat[o + c * 4] *= k; B.mat[o + c * 4 + 1] *= k; B.mat[o + c * 4 + 2] *= k; }
      this.gR[j] *= k; B.dirty = true; this.worn++;
    };
    Sculptor.prototype.halo = function (y, r, cw, birth) { // a ring of material drawn around the sculpture by a circling finger
      var R = this.rng, n = 12 + Math.floor(r * 2), off = R() * TAU;
      for (var i = 0; i < n; i++) {
        var a = off + (cw ? 1 : -1) * i / n * TAU, p = [Math.cos(a) * r, y + Math.sin(i * 1.7) * .15, Math.sin(a) * r], tan = [-Math.sin(a), 0, Math.cos(a)];
        this.one(i % 3 ? 4 : 1, 4, p, qfromto(UP, tan), i % 3 ? [.42, .42, .42] : [.22, .22, .22], birth);
      }
      this.one(3, 4, [0, y, 0], qfromto(UP, [1, 0, 0]), [.03, r * 2, .03], birth); this.one(3, 4, [0, y, 0], qfromto(UP, [0, 0, 1]), [.03, r * 2, .03], birth);
      this.maxR = Math.max(this.maxR, r); this.halos = (this.halos || 0) + 1;
    };
    Sculptor.prototype.ev = function (e, birth) {
      var k = e[0];
      if (k === 'K') this.kick(e[1], birth); else if (k === 'S') this.snare(e[1], birth); else if (k === 'U') this.sustain(e[1], .25, birth);
      else if (k === 'H') this.grit(birth); else if (k === 'T') { this.steer = [e[1], e[2], e[3]]; this.steerN = 6; }
      else if (k === 'G') { if (e[1] < this.N) this.graft(e[1]); }
      else if (k === 'P') this.pull([e[1], e[2], e[3]], [e[4], e[5], e[6]], birth);
      else if (k === 'E') this.erode(e[1]);
      else if (k === 'W') this.twist = clamp(this.twist + e[1], -9, 9);
      else if (k === 'M') this.mirror = e[1];
      else if (k === 'R') this.grain = e[1];
      else if (k === 'Y') this.stretch = clamp(this.stretch + e[1], 0, 1.6);
      else if (k === 'O') this.halo(e[1], e[2], e[3], birth);
      this.buf[0].dirty = true;
    };
    Sculptor.prototype.record = function (e, birth) { this.events.push(e); this.ev(e, birth); };
    function deformY(s, y) { return y * (1 + s.stretch); }
    function deform(s, x, y, z) { var yy = deformY(s, y), a = s.twist * yy / TWIST_H, c = Math.cos(a), si = Math.sin(a); return [c * x - si * z, yy, si * x + c * z]; }
    function undeform(s, x, y, z) { var a = -s.twist * y / TWIST_H, c = Math.cos(a), si = Math.sin(a); return [c * x - si * z, y / (1 + s.stretch), si * x + c * z]; }

    // ---------- palettes, one per track ----------
    var PAL = {
      amen: { mass: '#2b2b30', shard: '#ff4a1c', rod: '#8a8f99', grit: '#2b2b30', hand: '#ff4a1c', accent: '#ff4a1c' },
      roller: { mass: '#1f3fbf', shard: '#00c8ff', rod: '#9fb6ff', grit: '#1f3fbf', hand: '#00c8ff', accent: '#00c8ff' },
      halftime: { mass: '#3a3a2e', shard: '#c8f000', rod: '#7d7d63', grit: '#3a3a2e', hand: '#b8e000', accent: '#b8e000' },
      file: { mass: '#6b2d5c', shard: '#ffb000', rod: '#c79ab8', grit: '#6b2d5c', hand: '#ffb000', accent: '#ffb000' }
    };
    var BG = '#ebe8e2', NIGHT_BG = '#121117', night = false;

    // ---------- discoveries ----------
    var FINDS = { mass: 'each kick adds mass', fracture: 'the snare breaks it', twist: 'held notes twist it', drop: 'the drop', steer: 'it leans toward you', graft: 'it grows from where you touch', ring: 'it rings', strum: 'it plays like an instrument', pull: 'you can draw it out', erode: 'it wears away', turn: 'you turned it', mirror: 'it mirrors itself', grain: 'a new material', hold: 'it stretches under your hand', bend: 'the tone bends', explode: 'exploded view', complete: 'a finished object', archive: 'it keeps what it made', yours: 'your music, your sculpture' };
    if (api.touch) { FINDS.rise = 'it rises'; FINDS.settle = 'it settles'; FINDS.halo = 'a halo'; FINDS.drum = 'you drummed on it'; FINDS.jump = 'you moved the music'; FINDS.night = 'after hours'; FINDS.lay = 'it leans with you'; FINDS.wait = 'it waited for the music'; }
    var KEYS = Object.keys(FINDS), found = {};
    api.pips(KEYS.length);
    function find(k) { if (found[k]) return; found[k] = 1; api.light(KEYS.indexOf(k)); api.whisper(FINDS[k]); }

    // ---------- persistence ----------
    var KEY = 'sbl-05', store;
    try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { store = null; }
    if (!store || store.v !== 2) store = { v: 2, track: (store && store.track) || 'amen', archive: [] };
    function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { if (store.archive.length > 1) { store.archive.shift(); save(); } } }

    // ---------- sound ----------
    var snd = null, A = null;
    try { A = api.audio && api.audio(); if (A && SBL.matterSound) snd = SBL.matterSound(A); } catch (e) { snd = null; }
    function S(name) { if (!snd) return; try { return snd[name].apply(snd, [].slice.call(arguments, 1)); } catch (e) {} }

    // ---------- scene ----------
    var canvas = document.createElement('canvas');
    canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none'; canvas.setAttribute('aria-label', 'A sculpture built by the music as it plays');
    stage.appendChild(canvas);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !TOUCH, powerPreference: 'high-performance' });
    renderer.setPixelRatio(DPR); renderer.setClearColor(BG, 1);
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, W / H, .1, 300);
    scene.fog = new THREE.Fog(BG, 40, 110);
    api.tone && api.tone('light');
    var disposables = [];
    function keep(x) { disposables.push(x); return x; }
    var groundMat = keep(new THREE.MeshBasicMaterial({ color: '#dedad2' })), plinthMats = [], plinthLines = [];
    var ground = new THREE.Mesh(keep(new THREE.CircleGeometry(120, 64)), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -.62; scene.add(ground);
    function plinth(w, hgt, x, z) {
      var g = new THREE.Group(), bx = keep(new THREE.BoxGeometry(w, hgt, w));
      var pm = keep(new THREE.MeshBasicMaterial({ color: night ? '#1c1b22' : '#f6f4f0' })), lm = keep(new THREE.LineBasicMaterial({ color: night ? '#3a3846' : '#c6c0b6' }));
      plinthMats.push(pm); plinthLines.push(lm); g.add(new THREE.Mesh(bx, pm)); g.add(new THREE.LineSegments(keep(new THREE.EdgesGeometry(bx)), lm));
      g.position.set(x, -hgt / 2, z); scene.add(g); return g;
    }
    plinth(7.5, 1.2, 0, 0).position.y = -.6;
    var shadowTex = keep((function () { var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(40,36,30,.35)'); gr.addColorStop(1, 'rgba(40,36,30,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })());
    var shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }))); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .005; scene.add(shadow);

    var SHAPE_GEO = [
      keep(new THREE.BoxGeometry(1, 1, 1)), keep(new THREE.IcosahedronGeometry(.62, 0)), keep(new THREE.OctahedronGeometry(.62, 0)), keep(new THREE.CylinderGeometry(.5, .5, 1, 8)),
      keep(new THREE.TorusGeometry(.42, .12, 8, 22)), keep(new THREE.CylinderGeometry(.58, .58, 1, 3)), keep(new THREE.TetrahedronGeometry(.68, 0)), keep(new THREE.IcosahedronGeometry(.5, 0))
    ];
    var VS = [
      'attribute float aKind;attribute float aBirth;attribute float aCrack;attribute float aSeed;',
      'uniform float uTime,uTwist,uStretch,uExplode,uH,uMid,uRingT,uGlowT;uniform vec3 uRingP,uGlowP;',
      'varying vec3 vW;varying float vKind;varying float vCrack;varying float vAge;varying vec3 vLocal;varying float vGlow;',
      'vec3 deform(vec3 p){p.y*=1.+uStretch;float a=uTwist*p.y/uH;float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.z,p.y,s*p.x+c*p.z);}',
      'void main(){',
      ' vec3 ctr=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vec4 wp=instanceMatrix*vec4(position,1.);',
      ' float age=uTime-aBirth;float g=clamp(age*5.,0.,1.);g=1.-pow(1.-g,3.);',
      ' wp.xyz=ctr+(wp.xyz-ctr)*g;',
      ' vec3 ed=normalize(ctr-vec3(0.,uMid,0.)+vec3(.0001));wp.xyz+=ed*uExplode*(1.2+aSeed*3.);',
      ' float rt=uTime-uRingT;float d=distance(ctr,uRingP);float ring=exp(-pow(d-rt*7.,2.)*1.2)*exp(-rt*1.4);wp.xyz+=normalize(ctr-uRingP+vec3(.0001))*ring*.28;',
      ' float gt=uTime-uGlowT;float glow=exp(-pow(distance(ctr,uGlowP),2.)*3.)*exp(-gt*5.);wp.xyz+=normalize(ctr-uGlowP+vec3(.0001))*glow*.06;',
      ' vec3 p=deform(wp.xyz);vW=p;vKind=aKind;vCrack=aCrack+ring*.6;vAge=age;vLocal=position;vGlow=glow;',
      ' gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(p,1.);}'
    ].join('\n');
    var FS = [
      'uniform vec3 uMass,uShard,uRod,uGrit,uHand,uAccent,uBg,uL;uniform float uBox;',
      'varying vec3 vW;varying float vKind;varying float vCrack;varying float vAge;varying vec3 vLocal;varying float vGlow;',
      'void main(){',
      ' vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));',
      ' float lit=.48+.52*max(dot(n,normalize(uL)),0.)+.14*max(n.y,0.)-.14*max(-n.y,0.);',
      ' vec3 base=vKind<.5?uMass:vKind<1.5?uShard:vKind<2.5?uRod:vKind<3.5?uGrit:uHand;',
      ' vec3 col=base*lit;float cr=clamp(vCrack,0.,1.);',
      ' if(uBox>.5){vec3 q=abs(vLocal)*2.;vec3 fw=max(fwidth(vLocal)*2.,vec3(1e-4));vec3 e3=smoothstep(1.-fw*2.2,vec3(1.),q);',
      '  float edge=max(max(min(e3.x,e3.y),min(e3.y,e3.z)),min(e3.x,e3.z));col=mix(col,col*.45,edge*.85);col=mix(col,uAccent,cr*edge);}',
      ' else{float st=step(.82,fract(dot(vW,vec3(2.1,3.7,1.3))));col=mix(col,uAccent,cr*st);}',
      ' col+=uAccent*cr*.12+uAccent*vGlow*.7;',
      ' col+=vec3(1.)*max(0.,.3-vAge)*1.4;',
      ' float fog=smoothstep(40.,110.,length(vW-cameraPosition));',
      ' gl_FragColor=vec4(mix(col,uBg,fog),1.);}'
    ].join('\n');
    function makeUniforms(pal) {
      return {
        uTime: { value: 0 }, uTwist: { value: 0 }, uStretch: { value: 0 }, uExplode: { value: 0 }, uH: { value: TWIST_H }, uMid: { value: 2 }, uRingT: { value: -99 }, uRingP: { value: new THREE.Vector3() }, uGlowT: { value: -99 }, uGlowP: { value: new THREE.Vector3() },
        uMass: { value: new THREE.Color(pal.mass) }, uShard: { value: new THREE.Color(pal.shard) }, uRod: { value: new THREE.Color(pal.rod) }, uGrit: { value: new THREE.Color(pal.grit) }, uHand: { value: new THREE.Color(pal.hand) }, uAccent: { value: new THREE.Color(pal.accent) },
        uBg: { value: new THREE.Color(BG) }, uL: { value: new THREE.Vector3(.5, .8, .35) }
      };
    }
    function viewFor(sc, pal) { // one instanced mesh per shape, all sharing one set of uniforms
      var U = makeUniforms(pal), group = new THREE.Group(), meshes = [];
      for (var s = 0; s < NSHAPE; s++) {
        var uni = {}; for (var k in U) uni[k] = U[k]; uni.uBox = { value: s === 0 ? 1 : 0 };
        var mat = new THREE.ShaderMaterial({ extensions: { derivatives: true }, vertexShader: VS, fragmentShader: FS, uniforms: uni });
        var B = sc.buf[s], geo = SHAPE_GEO[s].clone(), mesh = new THREE.InstancedMesh(geo, mat, sc.cap);
        mesh.instanceMatrix = new THREE.InstancedBufferAttribute(B.mat, 16); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        [['aKind', B.kind], ['aBirth', B.birth], ['aCrack', B.crack], ['aSeed', B.sd]].forEach(function (a) { var at = new THREE.InstancedBufferAttribute(a[1], 1); at.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(a[0], at); });
        mesh.count = B.n; mesh.frustumCulled = false; group.add(mesh); meshes.push(mesh);
      }
      return { group: group, meshes: meshes, U: U };
    }
    function sync(v, sc) {
      for (var s = 0; s < NSHAPE; s++) {
        var B = sc.buf[s]; if (!B.dirty) continue; B.dirty = false; var m = v.meshes[s]; m.count = B.n;
        m.instanceMatrix.needsUpdate = true; ['aKind', 'aBirth', 'aCrack', 'aSeed'].forEach(function (k) { m.geometry.attributes[k].needsUpdate = true; });
      }
      v.U.uTwist.value = sc.twist; v.U.uStretch.value = sc.stretch; v.U.uMid.value = (sc.minY + sc.maxY) / 2;
    }
    function dropView(v) { if (!v) return; scene.remove(v.group); v.meshes.forEach(function (m) { m.geometry.dispose(); m.material.dispose(); }); }

    // ---------- the archive: finished sculptures, rebuilt from their events ----------
    var archive = [];
    function buildArchive() {
      archive.forEach(function (a) { dropView(a.v); scene.remove(a.pl); }); archive = [];
      store.archive.forEach(function (rec, i) {
        var s2 = new Sculptor(3000, rec.seed, TRACK_GRAIN[rec.track] || 0); rec.ev.forEach(function (e) { s2.ev(e, -99); });
        var v = viewFor(s2, PAL[rec.track] || PAL.amen); sync(v, s2);
        var ang = Math.PI * .75 + (i - (store.archive.length - 1) / 2) * .42, r = 24, sx = Math.cos(ang) * r, sz = Math.sin(ang) * r;
        var pl = plinth(2.6, 1.6, sx, sz); pl.position.y = -.6;
        v.group.scale.setScalar(.32); v.group.position.set(sx, .2, sz); scene.add(v.group);
        archive.push({ v: v, pl: pl });
      });
      if (store.archive.length) setTimeout(function () { find('archive'); }, 4000);
    }
    buildArchive();

    // ---------- the live sculpture ----------
    var sc = null, view = null, trackKey = store.track || 'amen', complete = false, t = 0, startT = 0;
    function begin(k) {
      dropView(view); hideLabel(); complete = false; if (typeof cam !== 'undefined') cam.auto = .05;
      sc = new Sculptor(3000, (Math.random() * 1e9) | 0, TRACK_GRAIN[k] || 0); trackKey = k; view = viewFor(sc, PAL[k] || PAL.amen); scene.add(view.group); startT = t;
      if (night) view.U.uBg.value.set(NIGHT_BG);
      lastK = lastS = lastH = 0; susAcc = 0; kAvg = sAvg = hAvg = .05; prev.fill(0); lowPrev.fill(0);
      if (k !== 'file') { store.track = k; save(); S('play', k); }
      syncPanel();
    }

    // ---------- listening ----------
    var freq = snd ? new Uint8Array(snd.analyser.frequencyBinCount) : new Uint8Array(1024), prev = new Float32Array(freq.length), cur = new Float32Array(freq.length), lowF = new Uint8Array(freq.length), lowPrev = new Float32Array(freq.length);
    var binHz = (A ? A.ctx.sampleRate : 48000) / 2048, kAvg = .05, sAvg = .05, hAvg = .05, susSlow = 0, midFluxAvg = 0, lastK = 0, lastS = 0, lastH = 0, susAcc = 0, silentT = 0;
    function flux(a, b) { var i0 = Math.max(1, Math.floor(a / binHz)), i1 = Math.min(cur.length, Math.ceil(b / binHz)), f = 0; for (var i = i0; i < i1; i++) { var d = cur[i] - prev[i]; if (d > 0) f += d; } return f / Math.max(1, i1 - i0); }
    function energy(a, b) { var i0 = Math.max(1, Math.floor(a / binHz)), i1 = Math.min(cur.length, Math.ceil(b / binHz)), e = 0; for (var i = i0; i < i1; i++) e += cur[i]; return e / Math.max(1, i1 - i0); }
    function listen(dt) {
      if (!snd || complete || !sc) return;
      var live = A.ctx.state === 'running' && !A.muted() && snd.playing();
      if (!live) { silentT += dt; if (silentT > 2.5 && (A.muted() || A.ctx.state !== 'running')) api.caption('The sculpture grows from sound. Turn sound on and it will continue.'); return; }
      if (silentT > 2.5) api.caption(trackKey === 'file' ? '▶ ' + fileName : ''); silentT = 0;
      snd.analyser.getByteFrequencyData(freq);
      for (var i = 0; i < freq.length; i++) cur[i] = freq[i] / 255;
      snd.lowAnalyser.getByteFrequencyData(lowF);
      var kf = 0, k1 = Math.ceil(90 / binHz); for (var q = 1; q < k1; q++) { var lv = lowF[q] / 255, dd = lv - lowPrev[q]; if (dd > 0) kf += dd; lowPrev[q] = lv; } kf /= (k1 - 1);
      var sf = flux(1400, 4200), hf = flux(7000, 14000), mf = flux(60, 900), me = energy(60, 900);
      kAvg = lerp(kAvg, kf, Math.min(1, dt * 3)); sAvg = lerp(sAvg, sf, Math.min(1, dt * 3)); hAvg = lerp(hAvg, hf, Math.min(1, dt * 3));
      midFluxAvg = lerp(midFluxAvg, mf, Math.min(1, dt * 4)); susSlow = lerp(susSlow, me, Math.min(1, dt * 1.5));
      if (kf > Math.max(.07, kAvg * 3) && t - lastK > .1) { lastK = t; sc.record(['K', +clamp((kf - kAvg) / .3, .15, 1).toFixed(2)], t); if (sc.kicks === 12) find('mass'); }
      if (sf > Math.max(.07, sAvg * 2.3) && t - lastS > .09) { lastS = t; sc.record(['S', +clamp((sf - sAvg) / .22, .15, 1).toFixed(2)], t); if (sc.snares === 6) find('fracture'); }
      if (hf > Math.max(.025, hAvg * 2.3) && t - lastH > .12) { lastH = t; sc.record(['H'], t); }
      susAcc += dt;
      if (susAcc >= .25) { susAcc -= .25; var lvl = clamp((susSlow - .14) / .3, 0, 1) * clamp(1 - midFluxAvg * 8, 0, 1); sc.record(['U', +lvl.toFixed(2)], t); if (sc.twist > .6) find('twist'); }
      var tmp = prev; prev = cur; cur = tmp;
    }

    // ---------- completion ----------
    var label = document.createElement('div');
    label.style.cssText = 'position:absolute;right:var(--gutter);bottom:calc(var(--gutter) + env(safe-area-inset-bottom,0px));max-width:min(330px,calc(100vw - 32px));padding:16px 18px;background:#f8f6f2;color:#1a1916;box-shadow:0 1px 0 #c9c3b8,0 10px 30px -18px rgba(0,0,0,.4);font:12px/1.5 var(--body);display:flex;flex-direction:column;gap:8px;opacity:0;transform:translateY(8px);transition:opacity .6s,transform .6s;pointer-events:none';
    stage.appendChild(label);
    var fileName = '', fileObj = null;
    function hideLabel() { label.style.opacity = 0; label.style.transform = 'translateY(8px)'; label.style.pointerEvents = 'none'; }
    function showLabel() {
      var tname = trackKey === 'file' ? fileName.replace(/\.[^.]+$/, '') : snd.tracks[trackKey].name, secs = Math.round(t - startT);
      label.innerHTML = '';
      var h = document.createElement('div'); h.style.cssText = 'font:italic 600 17px/1.2 var(--display);letter-spacing:-.01em'; h.textContent = 'Untitled (' + tname + '), 2026'; label.appendChild(h);
      var m = document.createElement('div'); m.style.cssText = 'font:10px/1.7 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:#6a665e';
      m.textContent = 'Sound on ' + GRAINS[sc.grain].name.toLowerCase() + ' · ' + sc.mass + ' masses · ' + sc.snares + ' fractures · ' + sc.br.length + ' branches · ' + (Math.abs(sc.twist) / TAU).toFixed(1) + ' turns' + (sc.pulled ? ' · ' + sc.pulled + ' drawn by hand' : '') + (sc.worn ? ' · ' + sc.worn + ' worn' : '') + (sc.mirror > 1 ? ' · ' + sc.mirror + '-fold' : '') + ' · ' + Math.floor(secs / 60) + ':' + ('0' + secs % 60).slice(-2);
      label.appendChild(m);
      var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Begin again'; b.style.cssText = 'align-self:flex-start;margin-top:4px;font:10px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;background:#1a1916;color:#f8f6f2;border:0;border-radius:999px;padding:9px 14px;cursor:pointer';
      b.addEventListener('click', function () { if (trackKey === 'file' && fileObj) loadFile(fileObj); else begin(trackKey === 'file' ? 'amen' : trackKey); });
      label.appendChild(b);
      label.style.opacity = 1; label.style.transform = 'none'; label.style.pointerEvents = 'auto';
    }
    function finish() {
      if (complete || !sc || sc.N < 20) return; complete = true; find('complete'); endHold();
      store.archive.push({ seed: sc.seed, track: trackKey, ev: sc.events }); while (store.archive.length > 5) store.archive.shift(); save();
      showLabel(); buildArchive(); cam.auto = .12;
    }
    if (snd) snd.on(function (type) {
      if (type === 'end') finish();
      else if (type === 'drop') { find('drop'); shake = .6; if (view) { view.U.uRingP.value.set(0, sc ? sc.minY : 0, 0); view.U.uRingT.value = t; } }
    });

    // ---------- the visitor's file ----------
    function loadFile(file) {
      if (!snd) return;
      if (!/^audio\//.test(file.type) && !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) { api.caption('That file is not audio. Try an MP3, WAV, OGG or M4A.'); return; }
      api.caption('Loading ' + file.name + '…');
      snd.playFile(file).then(function () { fileObj = file; fileName = file.name; begin('file'); api.caption('▶ ' + file.name); find('yours'); }, function () { api.caption('That file could not be decoded. Try an MP3, WAV, OGG or M4A.'); });
    }
    stage.addEventListener('dragover', function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault(); }, sig);
    stage.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); }, sig);

    // ---------- influence ----------
    function setGrain(g) { if (!sc || complete || g === sc.grain) return; sc.record(['R', g], t); S('grain', g); find('grain'); api.whisper(GRAINS[g].name.toLowerCase()); syncPanel(); }
    function setMirror(n) { if (!sc || complete || n === sc.mirror) return; sc.record(['M', n], t); S('mirror', n); find('mirror'); syncPanel(); }
    function nextMirror() { if (!sc) return; setMirror(MIRRORS[(MIRRORS.indexOf(sc.mirror) + 1) % MIRRORS.length]); }

    // ---------- panel: the tracks, and two quiet levers ----------
    var slot = api.slot && api.slot(), panel = null, ctl = {}, panelOpen = false;
    function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
    if (slot && snd) {
      var wrap = el('div', 'icpick'), btn = el('button', 'hudbtn'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(el('span', 'icglyph')); btn.appendChild(el('span', null, 'TRACK'));
      panel = el('div', 'icpanel'); panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Choose a track');
      ctl.rows = Object.keys(snd.tracks).map(function (k) {
        var tr = snd.tracks[k], b = el('button'); b.type = 'button'; b.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:12px;width:100%;background:none;border:0;border-bottom:1px solid var(--p-line);padding:8px 0;color:var(--p-fg);cursor:pointer;text-align:left;font:inherit;letter-spacing:inherit;text-transform:inherit';
        var n = el('span', null, tr.name), d = el('span', 'iclab', tr.desc); d.style.textTransform = 'none'; d.style.letterSpacing = '0'; d.style.fontSize = '11px';
        b.appendChild(n); b.appendChild(d); b.addEventListener('click', function () { begin(k); openPanel(false); }); panel.appendChild(b); return { k: k, b: b };
      });
      var r1 = el('div', 'icrow'); r1.appendChild(el('span', 'iclab', 'Material')); var seg = el('div', 'icseg'); r1.appendChild(seg); panel.appendChild(r1);
      ctl.grains = GRAINS.map(function (g, i) { var b = el('button', null, g.name); b.type = 'button'; b.addEventListener('click', function () { setGrain(i); }); seg.appendChild(b); return b; });
      var r2 = el('div', 'icrow'); r2.appendChild(el('span', 'iclab', 'Symmetry')); var seg2 = el('div', 'icseg'); r2.appendChild(seg2); panel.appendChild(r2);
      ctl.mirrors = MIRRORS.map(function (n) { var b = el('button', null, n === 1 ? 'None' : n + '×'); b.type = 'button'; b.addEventListener('click', function () { setMirror(n); }); seg2.appendChild(b); return b; });
      var fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'audio/*'; fileIn.id = 'rm-file'; fileIn.hidden = true; panel.appendChild(fileIn);
      fileIn.addEventListener('change', function () { if (fileIn.files && fileIn.files[0]) loadFile(fileIn.files[0]); fileIn.value = ''; openPanel(false); });
      var foot = el('div', 'icfoot'); var yours = el('button', 'iccopy', 'YOUR TRACK'); yours.type = 'button'; yours.style.marginLeft = '0'; yours.addEventListener('click', function () { fileIn.click(); });
      var again = el('button', 'iccopy', 'BEGIN AGAIN'); again.type = 'button'; again.addEventListener('click', function () { if (trackKey === 'file' && fileObj) loadFile(fileObj); else begin(trackKey); openPanel(false); });
      foot.appendChild(yours); foot.appendChild(again); panel.appendChild(foot);
      wrap.appendChild(btn); wrap.appendChild(panel); slot.appendChild(wrap); ctl.btn = btn;
      btn.addEventListener('click', function () { openPanel(panel.hidden); });
      document.addEventListener('pointerdown', function (e) { if (panelOpen && !wrap.contains(e.target)) openPanel(false); }, sig);
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { openPanel(false); btn.focus(); e.stopPropagation(); } }, { capture: true, signal: ac.signal });
    }
    function openPanel(o) { if (!panel) return; panelOpen = o; panel.hidden = !o; ctl.btn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    function syncPanel() {
      if (!panel || !sc) return;
      ctl.rows.forEach(function (r) { r.b.setAttribute('aria-pressed', r.k === trackKey ? 'true' : 'false'); r.b.style.color = r.k === trackKey ? 'var(--p-fg)' : 'var(--p-dim)'; });
      ctl.grains.forEach(function (b, i) { b.setAttribute('aria-pressed', i === sc.grain ? 'true' : 'false'); });
      ctl.mirrors.forEach(function (b, i) { b.setAttribute('aria-pressed', MIRRORS[i] === sc.mirror ? 'true' : 'false'); });
    }

    // ---------- camera ----------
    var cam = { th: .8, ph: 1.18, r: TOUCH ? 19 : 16, tTh: .8, tPh: 1.18, tR: TOUCH ? 19 : 16, ty: 2, auto: .05 }, shake = 0, lastDrag = -9;

    // ---------- input ----------
    // tap the sculpture: strike + graft · tap space: steer · press-and-hold the sculpture, then drag: pull a strand
    // press-and-hold space: a held tone (drag up/down to bend it) · drag: orbit · shift-drag / two-finger twist: turn it
    // alt-drag / rub: wear it away · hover (desktop): play it · double-tap: exploded view · 1–5: material · M / two-finger tap: symmetry
    var pd = null, multi = false, pendingClick = 0, holdT = 0, holding = false, holdY = 0, pulling = null, explodeT = -9, pv = new THREE.Vector3(), lastStrum = -1, strumT = 0, hoverT = 0, twistAcc = 0;
    function pickElement(x, y, radius) {
      if (!sc || !sc.N) return -1; var best = -1, r = radius || (TOUCH ? 34 : 22), bd = r * r;
      for (var i = 0; i < sc.N; i++) {
        if (sc.gR[i] < .02) continue;
        var d = deform(sc, sc.ctr[i * 3], sc.ctr[i * 3 + 1], sc.ctr[i * 3 + 2]); pv.set(d[0], d[1], d[2]).project(camera);
        if (pv.z > 1) continue; var sx = (pv.x + 1) / 2 * W, sy = (1 - pv.y) / 2 * H, dd = (sx - x) * (sx - x) + (sy - y) * (sy - y);
        if (dd < bd) { bd = dd; best = i; }
      }
      return best;
    }
    function pickNear(x, y, radius, max) {
      var out = []; if (!sc) return out; var r2 = radius * radius;
      for (var i = sc.N - 1; i >= 0 && out.length < max; i--) {
        if (sc.gR[i] < .05) continue;
        var d = deform(sc, sc.ctr[i * 3], sc.ctr[i * 3 + 1], sc.ctr[i * 3 + 2]); pv.set(d[0], d[1], d[2]).project(camera);
        if (pv.z > 1) continue; var sx = (pv.x + 1) / 2 * W, sy = (1 - pv.y) / 2 * H; if ((sx - x) * (sx - x) + (sy - y) * (sy - y) < r2) out.push(i);
      }
      return out;
    }
    function aimAt(x, y, through) {
      var ndc = new THREE.Vector2(x / W * 2 - 1, -(y / H) * 2 + 1), ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      var n = new THREE.Vector3(); camera.getWorldDirection(n); var pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, through || new THREE.Vector3(0, cam.ty, 0)), hit = new THREE.Vector3();
      return ray.ray.intersectPlane(pl, hit) ? hit : null;
    }
    function glowAt(i) { if (!view || i < 0) return; view.U.uGlowP.value.set(sc.ctr[i * 3], sc.ctr[i * 3 + 1], sc.ctr[i * 3 + 2]); view.U.uGlowT.value = t; }
    function strumAt(i) { var d = deform(sc, sc.ctr[i * 3], sc.ctr[i * 3 + 1], sc.ctr[i * 3 + 2]); S('strum', sc.gS[i], clamp(d[1], 0, 14), clamp(d[0] / 6, -1, 1)); glowAt(i); find('strum'); }
    function tap(x, y) {
      if (!sc) return;
      var j = pickElement(x, y);
      if (complete) { if (j >= 0) { strumAt(j); S('strike', sc.mass, 0); } else explode(); return; }
      if (j >= 0) {
        sc.record(['G', j], t); var d = deform(sc, sc.ctr[j * 3], sc.ctr[j * 3 + 1], sc.ctr[j * 3 + 2]);
        view.U.uRingP.value.set(sc.ctr[j * 3], sc.ctr[j * 3 + 1], sc.ctr[j * 3 + 2]); view.U.uRingT.value = t;
        S('strike', sc.mass, clamp(d[0] / 6, -1, 1)); find('ring'); find('graft'); return;
      }
      var p = aimAt(x, y); if (!p) return; var ud = undeform(sc, p.x, p.y, p.z);
      sc.record(['T', +ud[0].toFixed(2), +ud[1].toFixed(2), +ud[2].toFixed(2)], t); find('steer'); marker(p);
    }
    function explode() { explodeT = t; S('whoosh'); find('explode'); }
    function setNight(on) {
      night = on; var bg = on ? NIGHT_BG : BG; renderer.setClearColor(bg, 1); scene.fog.color.set(bg); groundMat.color.set(on ? '#17161d' : '#dedad2');
      plinthMats.forEach(function (m) { m.color.set(on ? '#1c1b22' : '#f6f4f0'); }); plinthLines.forEach(function (m) { m.color.set(on ? '#3a3846' : '#c6c0b6'); });
      [view].concat(archive.map(function (a) { return a.v; })).forEach(function (v) { if (v) { v.U.uBg.value.set(bg); v.U.uL.value.set(on ? -.3 : .5, on ? .4 : .8, on ? .7 : .35); } });
      api.tone && api.tone(on ? 'dark' : 'light'); label.style.background = on ? '#1c1b22' : '#f8f6f2'; label.style.color = on ? '#ece8e0' : '#1a1916';
      S('night', on); if (on) find('night');
    }
    function startHold(y) { if (holding || !sc || complete) return; holding = true; holdY = y || 0; S('hold', true); find('hold'); }
    function endHold() { if (!holding) return; holding = false; S('hold', false); }
    function bend(y) { if (!holding) return; var semi = clamp(-(y - holdY) / 18, -12, 12); S('holdPitch', semi); if (Math.abs(semi) > 2) find('bend'); }
    function startPull(j) { if (complete) return false; var a = [sc.ctr[j * 3], sc.ctr[j * 3 + 1], sc.ctr[j * 3 + 2]], d = deform(sc, a[0], a[1], a[2]); pulling = { last: a, n: 0, through: new THREE.Vector3(d[0], d[1], d[2]) }; glowAt(j); S('pull', 0); canvas.style.cursor = 'crosshair'; return true; }
    function pullTo(x, y) {
      if (!pulling || pulling.n > 24) return; var p = aimAt(x, y, pulling.through); if (!p) return;
      var ud = undeform(sc, p.x, p.y, p.z), dl = vlen(vsub(ud, pulling.last)); if (dl < .32) return;
      var nx = vadd(pulling.last, vmul(vnorm(vsub(ud, pulling.last)), Math.min(dl, .7)));
      sc.record(['P', +pulling.last[0].toFixed(3), +pulling.last[1].toFixed(3), +pulling.last[2].toFixed(3), +nx[0].toFixed(3), +nx[1].toFixed(3), +nx[2].toFixed(3)], t);
      pulling.last = nx; pulling.n++; S('pull', pulling.n); find('pull');
    }
    function erodeAt(x, y) { if (!sc || complete) return; var hits = pickNear(x, y, TOUCH ? 48 : 36, 4); if (!hits.length) return; hits.forEach(function (j) { sc.record(['E', j], t); }); glowAt(hits[0]); S('erode'); find('erode'); }
    function twistBy(v) { if (!sc || complete) return; twistAcc += v; if (Math.abs(twistAcc) > .06) { sc.record(['W', +twistAcc.toFixed(3)], t); twistAcc = 0; find('turn'); } S('twist', v); }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && G && G.count() > 1) { multi = true; pd = null; clearTimeout(holdT); return; }
      pd = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, touch: e.pointerType === 'touch', shift: e.shiftKey, alt: e.altKey || e.button === 2 };
      try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
      if (!pd.touch && !pd.shift && !pd.alt) holdT = setTimeout(function () { if (!pd || pd.moved) return; var j = pickElement(pd.x, pd.y); if (j >= 0) startPull(j); else startHold(pd.y); }, 380);
    }, sig);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); }, sig);
    canvas.addEventListener('pointermove', function (e) {
      if (!pd) { // hovering plays the sculpture
        if (!TOUCH && sc && t - hoverT > .035) { hoverT = t; var j = pickElement(e.clientX, e.clientY, 16); if (j >= 0 && j !== lastStrum && t - strumT > .06) { lastStrum = j; strumT = t; strumAt(j); } else if (j < 0) lastStrum = -1; canvas.style.cursor = j >= 0 ? 'pointer' : 'grab'; }
        return;
      }
      if (multi || (G && G.count() > 1)) return;
      var dx = e.clientX - pd.x, dy = e.clientY - pd.y; pd.x = e.clientX; pd.y = e.clientY;
      if (pulling) { pullTo(e.clientX, e.clientY); return; }
      if (holding) { bend(e.clientY); return; }
      if (!pd.moved && Math.hypot(e.clientX - pd.sx, e.clientY - pd.sy) > (pd.touch ? 14 : 5)) { pd.moved = true; clearTimeout(holdT); canvas.style.cursor = 'grabbing'; }
      if (!pd.moved) return;
      if (pd.alt) { erodeAt(e.clientX, e.clientY); return; }
      if (pd.shift) { twistBy(dx * .005); return; }
      if (pd.touch && t - rubT < .35) return;
      cam.tTh += dx * (pd.touch ? .008 : .006); cam.tPh = clamp(cam.tPh - dy * .005, .25, 1.52); lastDrag = t;
    }, sig);
    function up(e) {
      clearTimeout(holdT); var p0 = pd; pd = null; canvas.style.cursor = 'grab';
      if (multi) { if (!G || G.count() === 0) multi = false; return; }
      if (pulling) { pulling = null; return; }
      if (holding) { endHold(); return; }
      if (!p0 || e.type === 'pointercancel' || p0.alt || p0.shift) return;
      var quick = p0.touch && performance.now() - p0.t0 < 260 && Math.hypot(e.clientX - p0.sx, e.clientY - p0.sy) < 28;
      if (p0.moved && !quick) return;
      var x = e.clientX, y = e.clientY;
      if (pendingClick) { clearTimeout(pendingClick); pendingClick = 0; explode(); return; }
      pendingClick = setTimeout(function () { pendingClick = 0; if (!ac.signal.aborted) tap(x, y); }, 240);
    }
    canvas.addEventListener('pointerup', up, sig); canvas.addEventListener('pointercancel', up, sig);
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); if (e.shiftKey) twistBy((e.deltaY || e.deltaX) * .002); else cam.tR = clamp(cam.tR * (1 + e.deltaY * .0012), 6, 60); }, { passive: false, signal: ac.signal });
    addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName))) return;
      if (e.key === ' ') { e.preventDefault(); if (!e.repeat) startHold(H / 2); }
      else if (/^[1-5]$/.test(e.key)) setGrain(+e.key - 1);
      else if (e.key.toLowerCase() === 'm') nextMirror();
      else if (e.key.toLowerCase() === 'x') explode();
      else if (e.key === 'ArrowUp' && holding) { holdY += 18; bend(H / 2); }
      else if (e.key === 'ArrowDown' && holding) { holdY -= 18; bend(H / 2); }
    }, sig);
    addEventListener('keyup', function (e) { if (e.key === ' ') endHold(); }, sig);
    var pinch0 = 16, rubT = 0, spin = 0, drum = null;
    var G = api.gestures ? api.gestures(canvas, function (type, d) {
      switch (type) {
        case 'multistart': multi = true; pd = null; clearTimeout(holdT); pinch0 = cam.tR; break;
        case 'pinch': cam.tR = clamp(pinch0 / d.scale, 6, 60); break;
        case 'rotate': twistBy(d.delta); break;
        case 'twotap': nextMirror(); break;
        case 'threetap': if (sc) setGrain((sc.grain + 1) % GRAINS.length); break;
        case 'longpress': { var j = pickElement(d.x, d.y); if (j >= 0) startPull(j); else startHold(d.y); } break;
        case 'longmove': if (pulling) pullTo(d.x, d.y); else bend(d.y); break;
        case 'longend': pulling = null; endHold(); break;
        case 'rubbing': if (t - rubT > .1) { rubT = t; erodeAt(d.x, d.y); } break;
        // ---- the second layer of mobile inputs ----
        case 'swipe':
          if (d.edge) { setNight(!night); break; }                                   // swipe in from an edge: lights down / up
          if (!sc || complete) break;
          if (d.dir === 'up' && d.v > .5) { sc.record(['Y', .15], t); S('rise', true); find('rise'); spin = 0; }        // flick up: it rises
          else if (d.dir === 'down' && d.v > .5) { sc.record(['Y', -.15], t); S('rise', false); find('settle'); shake = .25; } // flick down: it settles
          else if (d.dir === 'left' || d.dir === 'right') { spin += (d.dir === 'left' ? -1 : 1) * Math.min(3, d.v) * .9; S('whoosh'); } // flick sideways: set it spinning
          break;
        case 'circle': { // draw a circle around it: a halo at that height
          if (!sc || complete) break; var c0 = aimAt(d.x, d.y), c1 = aimAt(d.x + d.r, d.y); if (!c0 || !c1) break;
          var u0 = undeform(sc, c0.x, c0.y, c0.z), rr = clamp(c0.distanceTo(c1) / Math.max(.5, 1 + sc.stretch * .3), 1.2, 6);
          sc.record(['O', +clamp(u0[1], .3, sc.maxY + 1).toFixed(2), +rr.toFixed(2), d.cw ? 1 : 0], t); S('halo', d.cw); find('halo'); break; }
        case 'tempo': // tap a steady rhythm: it keeps drumming at your tempo, and the sculpture hears every beat
          drum = { iv: 60 / clamp(d.bpm, 60, 200), next: t, left: 8 }; find('drum'); break;
        case 'twoswipe': // two fingers up: to the drop · down: into the break
          if (S('jump', d.dir === 'up' ? 'build' : 'break')) { find('jump'); api.whisper(d.dir === 'up' ? 'up to the drop' : 'down into the break'); }
          else api.whisper(trackKey === 'file' ? 'your track plays as it is' : 'not now');
          break;
        case 'orient': // turn the phone: the growth leans the way the phone went
          if (!sc || complete) break; var tip = sc.tip(), side = d.portrait ? 0 : 1;
          sc.record(['T', side ? 7 : 0, +(tip.p[1] + (side ? 0 : 6)).toFixed(2), side ? 0 : .01], t); S('rise', !side); find('lay'); break;
        case 'return': api.whisper('it waited for the music'); find('wait'); if (view) { view.U.uRingP.value.set(0, sc ? sc.minY : 0, 0); view.U.uRingT.value = t; } break;
      }
    }) : null;

    // tap marker
    var mk = new THREE.Mesh(keep(new THREE.RingGeometry(.18, .26, 32)), keep(new THREE.MeshBasicMaterial({ color: '#1a1916', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }))), mkAge = 9;
    scene.add(mk);
    function marker(p) { mk.position.copy(p); mk.lookAt(camera.position); mkAge = 0; }

    function resize() { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); canvas.style.width = '100%'; canvas.style.height = '100%'; camera.aspect = W / H; camera.updateProjectionMatrix(); }
    addEventListener('resize', resize, sig); resize();

    // ---------- go ----------
    if (!snd) api.caption('This piece is built from sound, which this browser cannot play.');
    begin(store.track && PAL[store.track] && store.track !== 'file' ? store.track : 'amen');
    var last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(.05, (now - last) / 1000); last = now; if (dt <= 0) return; t += dt;
      listen(dt);
      if (view && sc) {
        sync(view, sc); view.U.uTime.value = t;
        var ek = clamp(1 - Math.abs((t - explodeT) - 1.4) / 1.4, 0, 1); view.U.uExplode.value = ek * ek * (3 - 2 * ek);
        var top = deformY(sc, sc.maxY), mid = (deformY(sc, sc.minY) + top) / 2, size = Math.max(4, top - deformY(sc, sc.minY), sc.maxR * 2.2);
        cam.ty = lerp(cam.ty, Math.max(1.5, mid), Math.min(1, dt * .8));
        if (t - lastDrag > 6) cam.tR = lerp(cam.tR, clamp(size * 1.9 + 6, 12, 60), Math.min(1, dt * .25));
        var sh = Math.max(3, sc.maxR * 2.4) * (1 + sc.stretch * .2); shadow.scale.set(sh * 1.6, sh * 1.6, 1);
      }
      archive.forEach(function (a) { a.v.U.uTime.value = t; a.v.group.rotation.y += dt * .05; });
      mkAge += dt; mk.material.opacity = Math.max(0, .9 - mkAge * 1.2); mk.scale.setScalar(1 + mkAge * 1.5);
      if (t - lastDrag > 2.5 && !pd) cam.tTh += dt * cam.auto;
      if (Math.abs(spin) > .001) { cam.tTh += spin * dt; spin *= Math.pow(.35, dt); }
      if (drum && t >= drum.next) { S('thump', .9); if (view && sc) { view.U.uGlowP.value.set(sc.tip().p[0], sc.tip().p[1], sc.tip().p[2]); view.U.uGlowT.value = t; } drum.next += drum.iv; if (--drum.left <= 0) drum = null; }
      cam.th += (cam.tTh - cam.th) * Math.min(1, dt * 5); cam.ph += (cam.tPh - cam.ph) * Math.min(1, dt * 5); cam.r += (cam.tR - cam.r) * Math.min(1, dt * 3);
      camera.position.set(cam.r * Math.sin(cam.ph) * Math.cos(cam.th), cam.ty + cam.r * Math.cos(cam.ph), cam.r * Math.sin(cam.ph) * Math.sin(cam.th));
      shake = Math.max(0, shake - dt * 1.5); if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5) * shake, (Math.random() - .5) * shake, (Math.random() - .5) * shake));
      camera.lookAt(0, cam.ty, 0);
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
    if (SBL.debug) SBL._05 = { sc: function () { return sc; }, finish: finish, complete: function () { return complete; }, Sculptor: Sculptor, archive: function () { return store.archive; }, setGrain: setGrain, setMirror: setMirror, twistBy: twistBy, record: function (e) { sc.record(e, t); } };

    return function unmount() {
      cancelAnimationFrame(raf); ac.abort(); clearTimeout(holdT); if (pendingClick) clearTimeout(pendingClick); if (G) G(); endHold(); S('stop'); api.caption('');
      dropView(view); archive.forEach(function (a) { dropView(a.v); });
      disposables.forEach(function (d) { try { d.dispose(); } catch (e) {} }); renderer.dispose();
    };
  }
});
