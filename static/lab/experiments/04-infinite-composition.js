/* 04 — Infinite Composition. p5.js (instance mode) renders; every composition is pure data
   built from a seed, so the same seed + settings always yields the same arrangement,
   and the same data serialises to SVG. Sound from 04-sound.js. */
SBL.register('04', {
  mount: function (stage, api) {
    'use strict';
    var TAU = Math.PI * 2, PI = Math.PI;
    var ac = new AbortController(), sig = { signal: ac.signal };

    // ---------- seeded randomness ----------
    function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function hash(n) { n = Math.imul(n ^ n >>> 16, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return (n ^ n >>> 16) >>> 0; }
    function hex(s) { return ('000000' + s.toString(16).toUpperCase()).slice(-6); }
    function newSeed() { return Math.floor(Math.random() * 16777216); }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

    // ---------- palettes (ground + ink + accents) and settings ----------
    var PALS = [
      { k: 'ink', name: 'Ink', bg: '#ebe7de', ink: '#16181d', acc: ['#3d6bff', '#16181d', '#a09c93'], tone: 'light', root: 60 },
      { k: 'bauhaus', name: 'Bauhaus', bg: '#eee7d8', ink: '#1a1a1a', acc: ['#d6402b', '#efb22e', '#1f4fbf', '#1a1a1a'], tone: 'light', root: 62 },
      { k: 'night', name: 'Night', bg: '#0a0d18', ink: '#e6eaf2', acc: ['#7fa2ff', '#ff7a90', '#e6eaf2'], tone: 'dark', root: 65 },
      { k: 'tetrad', name: 'Tetrad', bg: '#11141d', ink: '#c9cfdb', acc: ['#5b77b8', '#a3639a', '#c49a52', '#6f9a6a'], tone: 'dark', root: 57 },
      { k: 'phosphor', name: 'Phosphor', bg: '#040805', ink: '#39ff88', acc: ['#39ff88', '#3de0ff', '#1d7a45'], tone: 'dark', root: 64 }
    ];
    var GOLD = { k: 'gold', name: 'Golden', bg: '#0c0a06', ink: '#efe2b8', acc: ['#d4af37', '#efe2b8', '#8a6d1f'], tone: 'dark', root: 61 };
    var SYMS = [{ n: 1, label: 'None' }, { n: 2, label: 'Mirror' }, { n: 4, label: 'Quad' }, { n: 6, label: 'Hex' }, { n: 8, label: 'Kaleido' }];
    var MOODS = [{ k: 'glass', label: 'Glass', bar: 9.6 }, { k: 'pulse', label: 'Pulse', bar: 3.2 }, { k: 'drift', label: 'Drift', bar: 16 }, { k: 'static', label: 'Static', bar: 4.8 }];
    var P = { complexity: .45, sym: 1, entropy: .25, pal: 1, mood: 'glass' };
    try { var sv = JSON.parse(localStorage.getItem('sbl-04') || 'null'); if (sv) for (var key in P) if (sv[key] != null && typeof sv[key] === typeof P[key]) P[key] = sv[key]; } catch (e) {}
    P.sym = clamp(P.sym | 0, 0, 4); P.pal = clamp(P.pal | 0, 0, PALS.length - 1); P.complexity = clamp(P.complexity, 0, 1); P.entropy = clamp(P.entropy, 0, 1);
    if (!MOODS.some(function (m) { return m.k === P.mood; })) P.mood = 'glass';
    function save() { try { localStorage.setItem('sbl-04', JSON.stringify(P)); } catch (e) {} }
    function moodOf(k) { for (var i = 0; i < MOODS.length; i++) if (MOODS[i].k === k) return MOODS[i]; return MOODS[0]; }

    function copiesOf(n) {
      if (n === 1) return [{ a: 0, m: false }];
      if (n === 2) return [{ a: 0, m: false }, { a: 0, m: true }];
      if (n === 4) return [{ a: 0, m: false }, { a: 0, m: true }, { a: PI, m: false }, { a: PI, m: true }];
      if (n === 6) return [0, 1, 2, 3, 4, 5].map(function (j) { return { a: j * PI / 3, m: false }; });
      var r = []; for (var j = 0; j < 4; j++) { r.push({ a: j * PI / 2, m: false }); r.push({ a: j * PI / 2, m: true }); } return r;
    }

    // ---------- discoveries ----------
    var FINDS = { fresh: 'a new order', sing: 'it sings back', back: 'it remembers', turn: 'it turns', scatter: 'it scatters', drift: 'it rearranges itself', chaos: 'chaos', order: 'perfect order', golden: 'a golden one', hold: 'held' };
    var KEYS = Object.keys(FINDS), found = {};
    api.pips(KEYS.length);
    function find(k) { if (found[k]) return; found[k] = 1; api.light(KEYS.indexOf(k)); api.whisper(FINDS[k]); }

    // ---------- geometry: every element is a list of primitives in unit space ----------
    // c = circle {x,y,r}, a = arc {x,y,r,a0,a1,pie}, p = polyline {pts,closed}; style: st (stroke colour) / fl (fill colour)
    var SCALE = [.5, .31, .19, .118, .073, .045, .028];
    function wpick(r, list) { var tot = 0, i; for (i = 0; i < list.length; i++) tot += list[i][1]; var x = r() * tot; for (i = 0; i < list.length; i++) { x -= list[i][1]; if (x <= 0) return list[i][0]; } return list[0][0]; }
    function shape(type, r, e, col, ink, bg) {
      var pr = [], i, n;
      var stroke = function (o) { o.st = col; return o; }, fill = function (o) { o.fl = col; return o; };
      switch (type) {
        case 'disc': pr.push(fill({ k: 'c', x: 0, y: 0, r: 1 })); if (r() < .35) pr.push({ k: 'c', x: 0, y: 0, r: .45, fl: bg }); break;
        case 'ring': n = 1 + Math.floor(r() * (1 + 3 * (1 - e))); for (i = 0; i < n; i++) pr.push(stroke({ k: 'c', x: 0, y: 0, r: 1 - i * .2 })); break;
        case 'arc': var sp = r() < e ? lerp(.4, 1.6, r()) * PI : [.5, 1, 1.5][Math.floor(r() * 3)] * PI; pr.push(stroke({ k: 'a', x: 0, y: 0, r: 1, a0: 0, a1: sp, bold: 1 })); break;
        case 'semi': pr.push(fill({ k: 'a', x: 0, y: 0, r: 1, a0: 0, a1: PI, pie: 1 })); break;
        case 'line': pr.push(stroke({ k: 'p', pts: [[-1, 0], [1, 0]] })); if (r() < .4) { pr.push({ k: 'c', x: -1, y: 0, r: .06, fl: col }); pr.push({ k: 'c', x: 1, y: 0, r: .06, fl: col }); } break;
        case 'cross': pr.push(stroke({ k: 'p', pts: [[-1, 0], [1, 0]] })); pr.push(stroke({ k: 'p', pts: [[0, -1], [0, 1]] })); break;
        case 'curve':
          var y1 = (r() * 2 - 1) * .9, y2 = -y1 * lerp(1, r() * 2 - 1, e), pts = [];
          for (i = 0; i <= 24; i++) { var u = i / 24, v = 1 - u; pts.push([v * v * v * -1 + 3 * v * v * u * -.35 + 3 * v * u * u * .35 + u * u * u, 3 * v * v * u * y1 + 3 * v * u * u * y2]); }
          pr.push(stroke({ k: 'p', pts: pts })); break;
        case 'poly':
          n = [3, 4, 6, 5][Math.floor(r() * (e > .5 ? 4 : 3))]; var pp = [];
          for (i = 0; i < n; i++) pp.push([Math.cos(i / n * TAU - PI / 2), Math.sin(i / n * TAU - PI / 2)]);
          pr.push(r() < .5 ? fill({ k: 'p', pts: pp, closed: 1 }) : stroke({ k: 'p', pts: pp, closed: 1 })); break;
        case 'dots': n = 3 + Math.floor(r() * 3); for (i = 0; i < n * n; i++) pr.push({ k: 'c', x: (i % n) / (n - 1) * 2 - 1, y: Math.floor(i / n) / (n - 1) * 2 - 1, r: .09, fl: col }); break;
        case 'hatch': n = 5 + Math.floor(r() * 6); for (i = 0; i < n; i++) { var hy = i / (n - 1) * 2 - 1; pr.push(stroke({ k: 'p', pts: [[-1, hy], [1, hy]] })); } break;
        case 'wave': var cy = 2 + Math.floor(r() * 3), wp = []; for (i = 0; i <= 48; i++) wp.push([i / 24 - 1, Math.sin(i / 48 * cy * TAU) * .28]); pr.push(stroke({ k: 'p', pts: wp })); break;
        case 'spiral': var sp2 = []; for (i = 0; i <= 80; i++) { var aa = i / 80 * 3 * TAU, rr = i / 80; sp2.push([Math.cos(aa) * rr, Math.sin(aa) * rr]); } pr.push(stroke({ k: 'p', pts: sp2 })); break;
        case 'scribble': var x = -1, y = 0, sc = [[x, y]]; for (i = 0; i < 18; i++) { x += .11 + r() * .03; y = clamp(y + (r() - .5) * .7, -1, 1); sc.push([x, y]); } pr.push(stroke({ k: 'p', pts: sc })); break;
      }
      return pr;
    }
    var CLS = { disc: 'circle', ring: 'circle', arc: 'arc', semi: 'arc', curve: 'arc', wave: 'arc', spiral: 'arc', scribble: 'arc', line: 'line', cross: 'line', hatch: 'line', poly: 'poly', dots: 'dots' };

    function element(r, i, n, ctx) {
      var e = ctx.e, tier = i < ctx.anchors ? 0 : i < n * .32 ? 1 : 2, x, y;
      if (ctx.ncopy === 1) {
        x = (r() * 2 - 1) * ctx.asp * .86; y = (r() * 2 - 1) * .86;
        if (r() > e) { x = Math.round(x * 6) / 6; y = Math.round(y * 6) / 6; }
        if (tier === 0) { x *= .5; y *= .5; }
      } else {
        var rad = tier === 0 ? r() * .4 : Math.sqrt(r()) * 1.08, th = ctx.a0 + r() * ctx.wedge;
        if (r() > e) { rad = Math.round(rad * 6) / 6; th = ctx.a0 + Math.round((th - ctx.a0) / (ctx.wedge / 4)) * (ctx.wedge / 4); }
        x = Math.cos(th) * rad; y = Math.sin(th) * rad;
      }
      x += (r() - .5) * e * .22; y += (r() - .5) * e * .22;
      var si = tier === 0 ? Math.floor(r() * 2) : tier === 1 ? 2 + Math.floor(r() * 2) : 4 + Math.floor(r() * 3);
      var s = lerp(SCALE[si], SCALE[si] * (.4 + r() * 1.4), e);
      var rot = r() < e ? r() * TAU : Math.floor(r() * 8) * PI / 4;
      var pool = tier === 0 ? [['disc', 3], ['ring', 2], ['arc', 3], ['semi', 2], ['poly', 1.5]]
        : tier === 1 ? [['ring', 2], ['arc', 2], ['line', 2], ['curve', 2], ['poly', 1.5], ['semi', 1], ['hatch', 1.2], ['dots', 1], ['wave', 1], ['disc', 1.5]]
          : [['disc', 3], ['line', 2.5], ['cross', 1.2], ['dots', .8], ['poly', 1.2], ['ring', 1.5], ['curve', 1], ['wave', .6]];
      pool = pool.concat([['spiral', e * 1.6], ['scribble', e * 2.2]]);
      var type = wpick(r, pool), pal = ctx.pal, col;
      if (tier === 0) col = r() < .75 ? pal.acc[Math.floor(r() * pal.acc.length)] : pal.ink;
      else col = r() < .55 - e * .2 ? pal.ink : pal.acc[Math.floor(r() * pal.acc.length)];
      var sw = type === 'arc' ? s * (.12 + r() * .14) : tier === 0 ? .006 : tier === 1 ? .0045 : .0032;
      return {
        type: type, cls: CLS[type], tier: tier, x: x, y: y, s: s, rot: rot, sw: sw, prims: shape(type, r, e, col, pal.ink, pal.bg),
        voiced: tier < 2 || r() < .4, wph: r() * TAU, wsp: .25 + r() * .6, wamp: e * .22, jit: (r() - .5) * e * .03,
        born: 0, life: 1, dying: false, dx: 0, dy: 0, vx: 0, vy: 0, fl: null, pos: null, lastHover: -9
      };
    }

    function compose(seed) {
      var r = mulberry(seed ^ 0x9e3779b9), golden = hash(seed) % 29 === 0;
      var e = golden ? P.entropy * .5 : P.entropy, sym = SYMS[P.sym].n, copies = copiesOf(sym), ncopy = copies.length;
      var pal = golden ? GOLD : PALS[P.pal];
      var ctx = { e: e, ncopy: ncopy, asp: W / H, wedge: TAU / ncopy, a0: sym === 2 ? -PI / 2 : 0, pal: pal, anchors: 1 + (r() < .5 ? 1 : 0) };
      var total = 8 + P.complexity * 70, n = Math.max(4, Math.round(total / ncopy * (ncopy > 1 ? 1.5 : 1)));
      var els = [];
      for (var i = 0; i < n; i++) els.push(element(r, i, n, ctx));
      return { seed: seed, golden: golden, pal: pal, copies: copies, sym: sym, e: e, els: els, mrng: mulberry(seed * 7 + 11), ctx: ctx };
    }
    function place(el, comp) { // sweep positions for each symmetric copy
      el.cps = comp.copies; el.fl = comp.copies.map(function () { return 0; });
      el.pos = comp.copies.map(function (cp) {
        var x = cp.m ? -el.x : el.x, y = el.y, ca = Math.cos(cp.a), sa = Math.sin(cp.a), px = x * ca - y * sa, py = x * sa + y * ca;
        var p = comp.sym === 1 ? (px / comp.ctx.asp + 1) / 2 : (Math.atan2(py, px) + PI / 2) / TAU;
        return ((p + el.jit) % 1 + 1) % 1;
      });
      el.rad = Math.hypot(el.x, el.y);
    }

    // ---------- state ----------
    var W = innerWidth, H = innerHeight, R = Math.min(W, H) * .46;
    var history = [], hi = -1, cur = null, dying = [], t = 0, gRot = 0, rotVel = 0, phase = 0, frozen = false;
    var lastInput = 0, nextMut = 6, interacted = false;
    var bgCol = [0, 0, 0], mx = -9999, my = -9999;
    function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

    var snd = null;
    try { var A = api.audio && api.audio(); if (A && SBL.compositionSound) snd = SBL.compositionSound(A); } catch (e) { snd = null; }
    function S(name) { if (!snd) return; try { return snd[name].apply(snd, [].slice.call(arguments, 1)); } catch (e) {} }

    function show(seed, how) {
      if (cur) cur.els.forEach(function (el, i) { el.dying = true; el.dieAt = t + (i % 12) * .025; dying.push(el); });
      cur = compose(seed);
      cur.els.forEach(function (el, i) { el.born = t + .15 + (el.tier === 0 ? 0 : el.tier === 1 ? .25 : .5) + i * .012; place(el, cur); });
      bgTarget = rgb(cur.pal.bg);
      api.tone && api.tone(cur.pal.tone);
      S('setKey', cur.pal.root); S('setEntropy', cur.e);
      if (how !== 'quiet') S('compose', cur.golden);
      if (cur.golden) find('golden');
      if (P.entropy >= .95) find('chaos');
      if (P.entropy <= .02 && SYMS[P.sym].n === 8) find('order');
      nextMut = t + lerp(9, 3, P.entropy);
      syncPanel();
    }
    function fresh() { var s = newSeed(); history = history.slice(0, hi + 1); history.push(s); if (history.length > 200) history.shift(); hi = history.length - 1; show(s); }
    function step(d) {
      if (d < 0 && hi > 0) { hi--; show(history[hi], 'quiet'); S('rewind'); find('back'); }
      else if (d > 0) { if (hi < history.length - 1) { hi++; show(history[hi], 'quiet'); S('rewind'); } else fresh(); }
    }
    function regenerate() { if (cur) show(cur.seed, 'quiet'); }
    var bgTarget = [0, 0, 0];

    function mutate() { // one element is quietly replaced, deterministically from the seed
      if (!cur || !cur.els.length) return;
      var r = cur.mrng, i = Math.floor(r() * cur.els.length), old = cur.els[i];
      var el = element(r, Math.max(i, cur.ctx.anchors), cur.els.length, cur.ctx);
      el.born = t; place(el, cur); old.dying = true; old.dieAt = t; dying.push(old); cur.els[i] = el;
    }

    // ---------- p5 ----------
    var sketch = function (p) {
      p.setup = function () {
        var c = p.createCanvas(W, H); c.parent(stage); p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
        p.strokeCap(p.ROUND); p.strokeJoin(p.ROUND);
        c.elt.style.cursor = 'crosshair'; c.elt.style.touchAction = 'none'; c.elt.setAttribute('aria-label', 'A generative composition of lines, curves, circles and shapes');
        bindInput(c.elt);
      };
      p.windowResized = function () { W = innerWidth; H = innerHeight; R = Math.min(W, H) * .46; p.resizeCanvas(W, H); if (cur && cur.sym === 1) regenerate(); };
      p.draw = function () {
        var dt = Math.min(.05, p.deltaTime / 1000 || .016); t += dt;
        for (var k = 0; k < 3; k++) bgCol[k] = lerp(bgCol[k], bgTarget[k], 1 - Math.exp(-dt * 5));
        p.background(bgCol[0], bgCol[1], bgCol[2]);
        if (!cur) return;

        // motion
        if (!frozen) {
          gRot += rotVel * dt + (cur.sym > 1 ? dt * .012 * (1 + cur.e * 2) : 0);
          if (!drag) rotVel *= Math.pow(.25, dt);
          var bar = moodOf(P.mood).bar, prev = phase; phase += dt / bar;
          triggers(prev, phase, bar);
          if (phase >= 1) phase -= 1;
          if (t > nextMut) { mutate(); nextMut = t + lerp(9, 3, cur.e) * (.6 + Math.random() * .8); }
          if (t - lastInput > 32 && interacted) { lastInput = t; fresh(); find('drift'); }
        }
        if (drag) S('turn', rotVel); else S('turn', rotVel * .5);

        // draw
        p.push(); p.translate(W / 2, H / 2); p.rotate(gRot);
        var ctx2 = p.drawingContext;
        for (var d = dying.length - 1; d >= 0; d--) { var de = dying[d], dk = clamp((t - de.dieAt) / .55, 0, 1); if (dk >= 1) { dying.splice(d, 1); continue; } drawEl(p, ctx2, de, 1, 1 - dk, 1 - dk * .35, dt); }
        for (var i = 0; i < cur.els.length; i++) { var el = cur.els[i], bk = clamp((t - el.born) / .7, 0, 1); if (bk <= 0) continue; drawEl(p, ctx2, el, bk, 1, ease(bk), dt); }
        p.pop();

        // sweep: a faint playhead, visible only while sound is on
        if (snd && api.audio && !A.muted() && A.ctx.state === 'running') {
          p.push(); p.stroke(cur.pal.ink); p.strokeWeight(1); ctx2.globalAlpha = .1;
          if (cur.sym === 1) { var sx = phase * W; p.line(sx, 0, sx, H); }
          else { p.translate(W / 2, H / 2); p.rotate(gRot + phase * TAU - PI / 2); p.line(0, 0, Math.max(W, H), 0); }
          p.pop();
        }
        hoverCheck();
      };
    };
    function ease(k) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); } // back-out

    function drawEl(p, ctx2, el, prog, alpha, grow, dt) {
      // scatter spring
      el.vx += (-30 * el.dx - 5 * el.vx) * dt; el.vy += (-30 * el.dy - 5 * el.vy) * dt; el.dx += el.vx * dt; el.dy += el.vy * dt;
      var w = frozen ? 0 : el.wamp * Math.sin(t * el.wsp + el.wph), copies = el.cps;
      for (var j = 0; j < copies.length; j++) {
        var cp = copies[j], f = el.fl[j]; el.fl[j] = Math.max(0, f - dt * 2.5);
        var sc = el.s * R * grow * (1 + f * .18);
        if (sc < .05) continue;
        p.push(); p.rotate(cp.a); if (cp.m) p.scale(-1, 1);
        p.translate((el.x + el.dx) * R, (el.y + el.dy) * R); p.rotate(el.rot + w); p.scale(sc);
        ctx2.globalAlpha = alpha;
        prims(p, el, prog, Math.max(1, el.sw * R) * (1 + f * .8) / sc);
        p.pop();
      }
    }
    function prims(p, el, prog, sw) {
      for (var i = 0; i < el.prims.length; i++) {
        var q = el.prims[i];
        if (q.fl) { p.fill(q.fl); p.noStroke(); } else { p.noFill(); p.stroke(q.st); p.strokeWeight(q.bold ? Math.max(sw, el.sw / el.s) : sw); }
        var k = q.fl ? 1 : prog;
        if (q.k === 'c') {
          var rr = q.r * (q.fl ? Math.min(1, prog * 1.15) : 1);
          if (q.fl || k >= 1) p.circle(q.x, q.y, rr * 2);
          else p.arc(q.x, q.y, rr * 2, rr * 2, -PI / 2, -PI / 2 + k * TAU);
        } else if (q.k === 'a') {
          if (q.pie) p.arc(q.x, q.y, q.r * 2 * Math.min(1, prog * 1.1), q.r * 2 * Math.min(1, prog * 1.1), q.a0, q.a1, p.PIE);
          else p.arc(q.x, q.y, q.r * 2, q.r * 2, q.a0, q.a0 + (q.a1 - q.a0) * Math.max(.001, k));
        } else {
          var pts = q.pts, n = pts.length;
          if (k >= 1 || q.fl) {
            p.beginShape(); for (var m = 0; m < n; m++) p.vertex(pts[m][0], pts[m][1]); q.closed ? p.endShape(p.CLOSE) : p.endShape();
          } else {
            var segs = q.closed ? n : n - 1, upto = k * segs;
            p.beginShape();
            for (var s2 = 0; s2 <= Math.floor(upto) && s2 <= segs; s2++) { var a = pts[s2 % n]; p.vertex(a[0], a[1]); }
            var fi = Math.floor(upto); if (fi < segs) { var a1 = pts[fi % n], b1 = pts[(fi + 1) % n], u = upto - fi; p.vertex(lerp(a1[0], b1[0], u), lerp(a1[1], b1[1], u)); }
            p.endShape();
          }
        }
      }
    }

    // ---------- score ----------
    function triggers(prev, now, bar) {
      var q = P.mood === 'pulse' ? 16 : P.mood === 'static' ? 32 : 0;
      for (var g = 0; g < 16; g++) { var gp = g / 16; if (crossed(prev, now, gp)) S('grid', g, -(fracAfter(now, gp)) * bar); }
      for (var i = 0; i < cur.els.length; i++) {
        var el = cur.els[i]; if (!el.voiced || t < el.born) continue;
        for (var j = 0; j < el.pos.length; j++) {
          var ps = q ? (Math.round(el.pos[j] * q) / q) % 1 : el.pos[j];
          if (crossed(prev, now, ps)) {
            el.fl[j] = 1;
            if (P.entropy > .02 && Math.random() < P.entropy * .25) continue;
            var pan = cur.sym === 1 ? ps * 2 - 1 : Math.sin(ps * TAU) * .8;
            S('note', el.cls, el.rad, el.tier, [.09, .065, .045][el.tier], pan, -(fracAfter(now, ps)) * bar);
          }
        }
      }
    }
    function crossed(a, b, x) { return (a <= x && x < b) || (b > 1 && a <= x + 1 && x + 1 < b); }
    function fracAfter(now, x) { var d = now - x; if (d < 0) d += 1; return d; }

    // ---------- input ----------
    var drag = null, clickT = 0, pendingClick = 0, wheelAcc = 0, panelOpen = false;
    function screenCenter(el, j) {
      var cp = cur.copies[j] || cur.copies[0], x = (cp.m ? -(el.x + el.dx) : (el.x + el.dx)) * R, y = (el.y + el.dy) * R, a = cp.a + gRot, ca = Math.cos(a), sa = Math.sin(a);
      return [W / 2 + x * ca - y * sa, H / 2 + x * sa + y * ca];
    }
    var lastMove = 0;
    function hoverCheck() {
      if (!cur || mx < -999 || t - lastMove > .2 || drag) return;
      for (var i = cur.els.length - 1; i >= 0; i--) {
        var el = cur.els[i]; if (t < el.born || t - el.lastHover < .45) continue;
        for (var j = 0; j < el.fl.length; j++) {
          var c = screenCenter(el, j), rr = el.s * R * (el.type === 'line' || el.type === 'hatch' ? .5 : 1) + 4;
          if ((mx - c[0]) * (mx - c[0]) + (my - c[1]) * (my - c[1]) < rr * rr) {
            el.lastHover = t; el.fl[j] = 1; S('hover', el.cls, el.rad, el.tier, (c[0] / W) * 2 - 1); find('sing'); return;
          }
        }
      }
    }
    function touch() { lastInput = t; interacted = true; }
    function bindInput(cv) {
      cv.addEventListener('pointermove', function (e) {
        mx = e.clientX; my = e.clientY; lastMove = t; touch();
        if (drag) {
          var a = Math.atan2(my - H / 2, mx - W / 2), da = a - drag.a; if (da > PI) da -= TAU; if (da < -PI) da += TAU;
          if (!drag.moved && Math.hypot(mx - drag.x, my - drag.y) > 7) { drag.moved = true; find('turn'); }
          if (drag.moved) { gRot += da; var now = performance.now(), ddt = Math.max(8, now - drag.tm) / 1000; rotVel = lerp(rotVel, da / ddt, .5); drag.tm = now; }
          drag.a = a;
        }
      }, sig);
      cv.addEventListener('pointerleave', function () { mx = my = -9999; }, sig);
      cv.addEventListener('pointerdown', function (e) {
        touch(); mx = e.clientX; my = e.clientY;
        if (panelOpen) { openPanel(false); drag = null; return; }
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        drag = { x: mx, y: my, a: Math.atan2(my - H / 2, mx - W / 2), moved: false, tm: performance.now() };
      }, sig);
      cv.addEventListener('pointerup', function () {
        if (!drag) return; var wasMove = drag.moved; drag = null;
        if (wasMove) return;
        if (pendingClick) { clearTimeout(pendingClick); pendingClick = 0; scatter(); return; }
        pendingClick = setTimeout(function () { pendingClick = 0; if (!ac.signal.aborted) { fresh(); find('fresh'); } }, 230);
      }, sig);
      cv.addEventListener('pointercancel', function () { drag = null; }, sig);
      cv.addEventListener('wheel', function (e) {
        e.preventDefault(); touch(); wheelAcc += e.deltaY;
        if (Math.abs(wheelAcc) > 80) { step(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
      }, { passive: false, signal: ac.signal });
    }
    function scatter() {
      if (!cur) return; find('scatter'); S('scatter');
      cur.els.forEach(function (el) { var a = Math.atan2(el.y, el.x) + (Math.random() - .5), f = .9 + Math.random() * 1.6; el.vx += Math.cos(a) * f; el.vy += Math.sin(a) * f; });
    }
    addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName))) return;
      touch();
      if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
      else if (e.key === ' ') { e.preventDefault(); frozen = !frozen; S('freeze', frozen); if (frozen) find('hold'); }
      else if (/^[1-5]$/.test(e.key)) { P.sym = +e.key - 1; save(); regenerate(); }
    }, sig);

    // ---------- control panel (lives in the HUD) ----------
    var slot = api.slot && api.slot(), panel = null, ctl = {};
    function svgExport() {
      if (!cur) return '';
      var f = function (v) { return Math.round(v * 1000) / 1000; }, o = [];
      o.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">');
      o.push('<!-- Systemblue Lab 04 Infinite Composition · seed ' + hex(cur.seed) + ' · ' + SYMS[P.sym].label + ' · complexity ' + P.complexity.toFixed(2) + ' · entropy ' + P.entropy.toFixed(2) + ' -->');
      o.push('<rect width="100%" height="100%" fill="' + cur.pal.bg + '"/>');
      o.push('<g transform="translate(' + f(W / 2) + ' ' + f(H / 2) + ') rotate(' + f(gRot * 180 / PI) + ')" stroke-linecap="round" stroke-linejoin="round">');
      cur.els.forEach(function (el) {
        cur.copies.forEach(function (cp) {
          var sc = el.s * R, sw = Math.max(1, el.sw * R);
          o.push('<g transform="rotate(' + f(cp.a * 180 / PI) + ')' + (cp.m ? ' scale(-1 1)' : '') + ' translate(' + f(el.x * R) + ' ' + f(el.y * R) + ') rotate(' + f(el.rot * 180 / PI) + ') scale(' + f(sc) + ')">');
          el.prims.forEach(function (q) {
            var st = q.fl ? 'fill="' + q.fl + '"' : 'fill="none" stroke="' + q.st + '" stroke-width="' + f((q.bold ? Math.max(sw, el.sw * R) : sw) / sc) + '"';
            if (q.k === 'c') o.push('<circle cx="' + f(q.x) + '" cy="' + f(q.y) + '" r="' + f(q.r) + '" ' + st + '/>');
            else if (q.k === 'a') {
              var x0 = q.x + Math.cos(q.a0) * q.r, y0 = q.y + Math.sin(q.a0) * q.r, x1 = q.x + Math.cos(q.a1) * q.r, y1 = q.y + Math.sin(q.a1) * q.r, lg = q.a1 - q.a0 > PI ? 1 : 0;
              o.push('<path d="' + (q.pie ? 'M' + f(q.x) + ' ' + f(q.y) + 'L' : 'M') + f(x0) + ' ' + f(y0) + 'A' + f(q.r) + ' ' + f(q.r) + ' 0 ' + lg + ' 1 ' + f(x1) + ' ' + f(y1) + (q.pie ? 'Z' : '') + '" ' + st + '/>');
            } else o.push('<' + (q.closed ? 'polygon' : 'polyline') + ' points="' + q.pts.map(function (a) { return f(a[0]) + ',' + f(a[1]); }).join(' ') + '" ' + st + '/>');
          });
          o.push('</g>');
        });
      });
      o.push('</g></svg>');
      return o.join('\n');
    }
    function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
    if (slot) {
      var wrap = el('div', 'icpick');
      var btn = el('button', 'hudbtn'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(el('span', 'icglyph')); btn.appendChild(el('span', null, 'PARAMS'));
      panel = el('div', 'icpanel'); panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Composition settings');
      function row(label, id) { var r = el('div', 'icrow'), l = el('label', 'iclab', label); l.htmlFor = id; r.appendChild(l); panel.appendChild(r); return r; }
      function slider(label, id, min, max, stepv, val, onin) {
        var r = row(label, id), i = el('input'); i.type = 'range'; i.id = id; i.min = min; i.max = max; i.step = stepv; i.value = val;
        var v = el('span', 'icval'); r.appendChild(i); r.appendChild(v);
        i.addEventListener('input', function () { onin(+i.value); }); i.addEventListener('change', function () { save(); }); return { i: i, v: v };
      }
      ctl.cx = slider('Complexity', 'ic-cx', 0, 1, .01, P.complexity, function (v) { P.complexity = v; regenerate(); });
      ctl.sy = slider('Symmetry', 'ic-sy', 0, 4, 1, P.sym, function (v) { P.sym = v; regenerate(); });
      ctl.en = slider('Entropy', 'ic-en', 0, 1, .01, P.entropy, function (v) { P.entropy = v; regenerate(); });
      var cr = el('div', 'icrow'); cr.appendChild(el('span', 'iclab', 'Color')); var sws = el('div', 'icsw'); cr.appendChild(sws); panel.appendChild(cr);
      ctl.pals = PALS.map(function (pl, n) {
        var b = el('button', 'icchip'); b.type = 'button'; b.title = pl.name; b.setAttribute('aria-label', pl.name);
        b.style.background = 'linear-gradient(135deg,' + pl.bg + ' 0 46%,' + pl.acc[0] + ' 46% 70%,' + (pl.acc[1] || pl.ink) + ' 70% 86%,' + pl.ink + ' 86%)';
        b.addEventListener('click', function () { P.pal = n; save(); regenerate(); }); sws.appendChild(b); return b;
      });
      var mr = el('div', 'icrow'); mr.appendChild(el('span', 'iclab', 'Mood')); var seg = el('div', 'icseg'); mr.appendChild(seg); panel.appendChild(mr);
      ctl.moods = MOODS.map(function (m) {
        var b = el('button', null, m.label); b.type = 'button';
        b.addEventListener('click', function () { P.mood = m.k; save(); S('setMood', m.k); syncPanel(); }); seg.appendChild(b); return b;
      });
      var fr = el('div', 'icfoot');
      var prevB = el('button', 'icnav', '‹'); prevB.type = 'button'; prevB.setAttribute('aria-label', 'Previous composition');
      var seedL = el('span', 'icseed'); var nextB = el('button', 'icnav', '›'); nextB.type = 'button'; nextB.setAttribute('aria-label', 'Next composition');
      var copyB = el('button', 'iccopy', 'COPY SVG'); copyB.type = 'button';
      prevB.addEventListener('click', function () { step(-1); }); nextB.addEventListener('click', function () { step(1); });
      var ta = el('textarea', 'icta'); ta.hidden = true; ta.readOnly = true; ta.setAttribute('aria-label', 'SVG markup'); ta.id = 'ic-svg';
      copyB.addEventListener('click', function () {
        var s = svgExport(); ta.value = s;
        function fallback() { ta.hidden = false; ta.focus(); ta.select(); copyB.textContent = 'SELECTED'; setTimeout(function () { copyB.textContent = 'COPY SVG'; }, 1800); }
        try { navigator.clipboard.writeText(s).then(function () { ta.hidden = true; copyB.textContent = 'COPIED'; setTimeout(function () { copyB.textContent = 'COPY SVG'; }, 1500); }, fallback); } catch (er) { fallback(); }
      });
      fr.appendChild(prevB); fr.appendChild(seedL); fr.appendChild(nextB); fr.appendChild(copyB); panel.appendChild(fr); panel.appendChild(ta);
      ctl.seed = seedL;
      wrap.appendChild(btn); wrap.appendChild(panel); slot.appendChild(wrap);
      btn.addEventListener('click', function () { openPanel(panel.hidden); });
      document.addEventListener('pointerdown', function (e) { if (panelOpen && !wrap.contains(e.target) && e.target.tagName !== 'CANVAS') openPanel(false); }, sig);
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { openPanel(false); btn.focus(); e.stopPropagation(); } }, { capture: true, signal: ac.signal });
      ctl.btn = btn;
    }
    function openPanel(o) { if (!panel) return; panelOpen = o; panel.hidden = !o; ctl.btn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    function syncPanel() {
      if (!panel) return;
      ctl.cx.i.value = P.complexity; ctl.cx.v.textContent = Math.round(P.complexity * 100);
      ctl.sy.i.value = P.sym; ctl.sy.v.textContent = SYMS[P.sym].label;
      ctl.en.i.value = P.entropy; ctl.en.v.textContent = Math.round(P.entropy * 100);
      ctl.pals.forEach(function (b, n) { b.setAttribute('aria-pressed', n === P.pal ? 'true' : 'false'); });
      ctl.moods.forEach(function (b, n) { b.setAttribute('aria-pressed', MOODS[n].k === P.mood ? 'true' : 'false'); });
      if (cur) ctl.seed.textContent = (cur.golden ? '★ ' : '') + hex(cur.seed);
    }

    // ---------- go ----------
    S('setMood', P.mood);
    var p5i = new p5(sketch);
    fresh();

    return function unmount() {
      ac.abort(); if (pendingClick) clearTimeout(pendingClick);
      try { p5i.remove(); } catch (e) {}
      S('stop');
    };
  }
});
