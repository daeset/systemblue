/* 07 \u2014 The Negotiation. You draw; the machine redraws.
   Each stroke is classified into one of five gestures (line, arc, loop, polygon, zigzag) and rebuilt by a grammar:
   angles snap to its preferred step, sizes to its grid, polygons lean toward the number of sides it believes in,
   and some gestures it habitually misreads. All of it is seeded by the stroke itself, so the same stroke under the
   same grammar always gives the same drawing \u2014 the logic can be learned.
   Corrections are evidence. Drawing over its version teaches it, but every correction also moves one other thing,
   in a fixed cycle; the whole unlocked drawing is then re-derived under the new grammar. Tap to agree (locks a shape),
   scribble to refuse, long-press or right-click to insist on your own line. */
SBL.register('07', {
  mount: function (stage, api) {
    'use strict';
    var ac = new AbortController(), sig = { signal: ac.signal }, NS = 'http://www.w3.org/2000/svg';
    var TOUCH = !!api.touch, W = innerWidth, H = innerHeight, TAU = Math.PI * 2;
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function f1(v) { return Math.round(v * 10) / 10; }

    // ---------- palettes (limited, by design) and their scales ----------
    var PALS = {
      riso: { name: 'Riso', paper: '#f6f1e7', ink: '#2b2b6f', colors: ['#ff48b0', '#00a9a5', '#ffd400', '#2b2b6f'], dark: false },
      bauhaus: { name: 'Bauhaus', paper: '#f1ebdf', ink: '#1b1b1b', colors: ['#d6402b', '#efb22e', '#1f4fbf', '#1b1b1b'], dark: false },
      constructivist: { name: 'Constructivist', paper: '#ede3d1', ink: '#161616', colors: ['#c8102e', '#161616', '#8f8a80'], dark: false },
      garden: { name: 'Garden', paper: '#eef0e4', ink: '#1f2a1d', colors: ['#3c8d4a', '#a7c957', '#c8553d', '#1f2a1d'], dark: false },
      night: { name: 'Night', paper: '#0f1115', ink: '#e9e6df', colors: ['#3de0ff', '#ff7a1a', '#e9e6df'], dark: true }
    };
    var PAL_KEYS = Object.keys(PALS);
    var CATS = ['line', 'arc', 'loop', 'polygon', 'zigzag'], CATI = { line: 0, arc: 1, loop: 2, polygon: 3, zigzag: 4, wave: 4, raw: 5 };
    var ANGLE_CYCLE = [180, 90, 45, 30, 15, 0];
    var SIDE_NAMES = ['', '', '', 'triangle', 'square', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'nonagon', 'decagon', 'hendecagon', 'dodecagon'];
    var MIRROR_NAMES = ['no symmetry', 'mirrored', 'four-fold'];
    function grammar(o) {
      var G = { angle: 45, sides: 5, echo: 1, mirror: 0, grid: 24, fill: .35, stubborn: .6, rot: 0, colorShift: 0, version: 0, corrections: 0,
        mis: { line: .08, arc: .2, loop: .35, polygon: .25, zigzag: .15 }, conf: { line: 'arc', arc: 'line', loop: 'polygon', polygon: 'loop', zigzag: 'wave' } };
      for (var k in o) { if (k === 'mis' || k === 'conf') { for (var j in o[k]) G[k][j] = o[k][j]; } else G[k] = o[k]; }
      return G;
    }

    // ---------- reading a gesture ----------
    function resample(raw, n) {
      var L = 0, i; for (i = 1; i < raw.length; i++) L += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
      if (L < 1e-6) return { pts: raw.slice(0, 1), L: 0 };
      var step = L / (n - 1), out = [raw[0].slice()], acc = 0, prev = raw[0].slice();
      for (i = 1; i < raw.length; i++) {
        var p = raw[i], d = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        while (acc + d >= step && d > 0) { var k = (step - acc) / d, q = [prev[0] + (p[0] - prev[0]) * k, prev[1] + (p[1] - prev[1]) * k]; out.push(q); prev = q; d = Math.hypot(p[0] - prev[0], p[1] - prev[1]); acc = 0; }
        acc += d; prev = p;
      }
      while (out.length < n) out.push(raw[raw.length - 1].slice());
      return { pts: out.slice(0, n), L: L };
    }
    function classify(raw) {
      var R = resample(raw, 48), pts = R.pts, L = R.L, n = pts.length, i;
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, cx = 0, cy = 0;
      pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); cx += p[0]; cy += p[1]; }); cx /= n; cy /= n;
      var hash = 2166136261; pts.forEach(function (p) { hash = Math.imul(hash ^ Math.round(p[0] / 3), 16777619); hash = Math.imul(hash ^ Math.round(p[1] / 3), 16777619); });
      var F = { L: L, x0: x0, y0: y0, x1: x1, y1: y1, cx: cx, cy: cy, size: Math.max(x1 - x0, y1 - y0) };
      if (L < 14) return { cat: 'tap', pts: pts, f: F, hash: hash >>> 0 };
      var chord = Math.hypot(pts[n - 1][0] - pts[0][0], pts[n - 1][1] - pts[0][1]), closed = L > 60 && chord < Math.max(22, L * .18);
      function at(j) { return closed ? pts[(j + n) % n] : pts[clamp(j, 0, n - 1)]; }
      var turns = [];
      for (i = 0; i < n; i++) {
        if (!closed && (i < 2 || i > n - 3)) { turns.push(0); continue; }
        var a = at(i - 2), b = at(i), c = at(i + 2), a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]), d = a2 - a1;
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; turns.push(d);
      }
      var corners = [], rev = 0;
      for (i = 0; i < n; i++) {
        var tv = Math.abs(turns[i]); if (tv > 2.1) rev++;
        if (tv > .62 && tv >= Math.abs(turns[(i + n - 1) % n]) && tv >= Math.abs(turns[(i + 1) % n])) { if (!corners.length || i - corners[corners.length - 1] > 3) corners.push(i); }
      }
      if (closed && corners.length > 1 && corners[0] + n - corners[corners.length - 1] <= 3) corners.pop();
      var rs = pts.map(function (p) { return Math.hypot(p[0] - cx, p[1] - cy); }), rm = rs.reduce(function (s, v) { return s + v; }, 0) / n;
      var circ = Math.sqrt(rs.reduce(function (s, v) { return s + (v - rm) * (v - rm); }, 0) / n) / (rm || 1);
      F.closed = closed; F.straight = chord / L; F.corners = corners.length; F.rev = rev; F.circ = circ; F.r = rm;
      F.angle = Math.atan2(pts[n - 1][1] - pts[0][1], pts[n - 1][0] - pts[0][0]);
      F.cornerAng = corners.length ? Math.atan2(pts[corners[0]][1] - cy, pts[corners[0]][0] - cx) : 0;
      var alt = 0; for (i = 1; i < corners.length; i++) if (turns[corners[i]] * turns[corners[i - 1]] < 0) alt++;
      var cat;
      if (!closed && (rev >= 3 || (corners.length >= 4 && F.straight < .6) || (corners.length >= 3 && alt >= corners.length - 1 && F.straight < .8))) cat = 'zigzag';
      else if (closed) cat = corners.length >= 3 && circ > .07 ? 'polygon' : 'loop';
      else if (F.straight > .9) cat = 'line';
      else cat = 'arc';
      F.sides = clamp(corners.length, 3, 8);
      return { cat: cat, pts: pts, f: F, hash: hash >>> 0 };
    }

    // ---------- the machine's reading ----------
    function snapper(G) {
      var g = G.grid;
      return {
        v: function (v) { return Math.round(v / g) * g; },
        len: function (v) { return Math.max(g, Math.round(v / g) * g); },
        ang: function (a) { if (!G.angle) return a; var s = G.angle * Math.PI / 180, r = G.rot * Math.PI / 180; return Math.round((a - r) / s) * s + r; }
      };
    }
    function circle3(a, b, c) {
      var d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-3) return null;
      var ux = ((a[0] * a[0] + a[1] * a[1]) * (b[1] - c[1]) + (b[0] * b[0] + b[1] * b[1]) * (c[1] - a[1]) + (c[0] * c[0] + c[1] * c[1]) * (a[1] - b[1])) / d;
      var uy = ((a[0] * a[0] + a[1] * a[1]) * (c[0] - b[0]) + (b[0] * b[0] + b[1] * b[1]) * (a[0] - c[0]) + (c[0] * c[0] + c[1] * c[1]) * (b[0] - a[0])) / d;
      return [ux, uy, Math.hypot(a[0] - ux, a[1] - uy)];
    }
    function interpret(src, G, pal) {
      var rng = mulberry((src.hash ^ Math.imul(G.version + 1, 2654435761)) >>> 0), F = src.f, S = snapper(G), read = src.cat, cat = read, misread = false;
      if (read !== 'tap' && rng() < (G.mis[read] || 0)) { cat = G.conf[read]; misread = true; }
      if (cat === 'zigzag') cat = 'wave';
      var shapes = [], n = 1, type = cat, p = src.pts, N = p.length;
      if (cat === 'line') {
        var len = S.len(Math.hypot(p[N - 1][0] - p[0][0], p[N - 1][1] - p[0][1])), a = S.ang(F.angle), mx = S.v((p[0][0] + p[N - 1][0]) / 2), my = S.v((p[0][1] + p[N - 1][1]) / 2);
        for (var e = 0; e < G.echo; e++) { var off = (e - (G.echo - 1) / 2) * G.grid * .75, ox = -Math.sin(a) * off, oy = Math.cos(a) * off; shapes.push({ k: 'line', a: [mx - Math.cos(a) * len / 2 + ox, my - Math.sin(a) * len / 2 + oy], b: [mx + Math.cos(a) * len / 2 + ox, my + Math.sin(a) * len / 2 + oy] }); }
      } else if (cat === 'arc') {
        var c3 = circle3(p[0], p[N >> 1], p[N - 1]);
        if (!c3 || c3[2] > 4000) { // reads as a straight line after all
          type = 'line'; var a2 = S.ang(F.angle), L2 = S.len(Math.hypot(p[N - 1][0] - p[0][0], p[N - 1][1] - p[0][1])); shapes.push({ k: 'line', a: [S.v(p[0][0]), S.v(p[0][1])], b: [S.v(p[0][0]) + Math.cos(a2) * L2, S.v(p[0][1]) + Math.sin(a2) * L2] });
        } else {
          var r = S.len(c3[2]), cxx = S.v(c3[0]), cyy = S.v(c3[1]), st = 15 * Math.PI / 180, aa0 = Math.atan2(p[0][1] - c3[1], p[0][0] - c3[0]), aa1 = Math.atan2(p[N - 1][1] - c3[1], p[N - 1][0] - c3[0]), am = Math.atan2(p[N >> 1][1] - c3[1], p[N >> 1][0] - c3[0]);
          var sweep = ((aa1 - aa0) % TAU + TAU) % TAU, mid = ((am - aa0) % TAU + TAU) % TAU, cw = mid < sweep; if (!cw) sweep = TAU - sweep;
          var s0 = G.angle ? S.ang(aa0) : Math.round(aa0 / st) * st, sw = Math.max(st * 2, Math.round(sweep / (G.angle ? G.angle * Math.PI / 180 : st)) * (G.angle ? G.angle * Math.PI / 180 : st));
          for (var e2 = 0; e2 < G.echo; e2++) shapes.push({ k: 'arc', c: [cxx, cyy], r: Math.max(6, r - e2 * G.grid * .5), a0: s0, sw: Math.min(sw, TAU * .999), cw: cw });
        }
      } else if (cat === 'loop' || cat === 'polygon') {
        var rr = Math.max(G.grid / 2, S.v(F.r || F.size / 2)), cx = S.v(F.cx), cy = S.v(F.cy);
        if (cat === 'polygon') {
          var obs = read === 'polygon' ? F.sides : G.sides; n = clamp(Math.round(lerp(obs, G.sides, G.stubborn)), 3, 12);
          var rot = S.ang(read === 'polygon' ? F.cornerAng : -Math.PI / 2);
          for (var e3 = 0; e3 < G.echo; e3++) shapes.push({ k: 'poly', c: [cx, cy], r: Math.max(6, rr - e3 * G.grid * .5), n: n, rot: rot });
        } else for (var e4 = 0; e4 < G.echo; e4++) shapes.push({ k: 'circle', c: [cx, cy], r: Math.max(6, rr - e4 * G.grid * .5) });
      } else if (cat === 'wave') {
        var ang = S.ang(F.angle), len2 = S.len(Math.hypot(p[N - 1][0] - p[0][0], p[N - 1][1] - p[0][1]) || F.size), amp = Math.max(G.grid / 3, S.v(Math.min(F.size, len2) * .18)), wl = G.grid, cnt = Math.max(2, Math.round(len2 / wl)), pts = [];
        var sx = S.v(F.cx) - Math.cos(ang) * len2 / 2, sy = S.v(F.cy) - Math.sin(ang) * len2 / 2;
        for (var i = 0; i <= cnt * 2; i++) { var u = i / (cnt * 2) * len2, h = (i % 2 ? 1 : -1) * amp; pts.push([sx + Math.cos(ang) * u - Math.sin(ang) * h, sy + Math.sin(ang) * u + Math.cos(ang) * h]); }
        shapes.push({ k: 'path', pts: pts }); n = cnt;
      }
      var cols = pal.colors, closed = type === 'loop' || type === 'polygon';
      var color = cols[(CATI[type] * 2 + G.colorShift + (src.hash & 1)) % cols.length], fill = closed && rng() < G.fill;
      return { type: type, read: read, misread: misread, n: n, shapes: shapes, color: color, fill: fill };
    }
    // geometry \u2192 points (for hit testing, mirroring and the score)
    function shapePts(s) {
      var out = [], i;
      if (s.k === 'line') return [s.a, s.b];
      if (s.k === 'circle') { for (i = 0; i <= 40; i++) out.push([s.c[0] + Math.cos(i / 40 * TAU) * s.r, s.c[1] + Math.sin(i / 40 * TAU) * s.r]); return out; }
      if (s.k === 'poly') { for (i = 0; i <= s.n; i++) { var a = s.rot + i / s.n * TAU; out.push([s.c[0] + Math.cos(a) * s.r, s.c[1] + Math.sin(a) * s.r]); } return out; }
      if (s.k === 'arc') { for (i = 0; i <= 24; i++) { var b = s.a0 + (s.cw ? 1 : -1) * s.sw * i / 24; out.push([s.c[0] + Math.cos(b) * s.r, s.c[1] + Math.sin(b) * s.r]); } return out; }
      return s.pts;
    }
    function svgShape(s, attrs) {
      if (s.k === 'line') return '<line x1="' + f1(s.a[0]) + '" y1="' + f1(s.a[1]) + '" x2="' + f1(s.b[0]) + '" y2="' + f1(s.b[1]) + '"' + attrs + '/>';
      if (s.k === 'circle') return '<circle cx="' + f1(s.c[0]) + '" cy="' + f1(s.c[1]) + '" r="' + f1(s.r) + '"' + attrs + '/>';
      var p = shapePts(s), d = 'M' + p.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L');
      return '<path d="' + d + (s.k === 'poly' ? 'Z' : '') + '"' + attrs + '/>';
    }

    // ---------- state ----------
    var KEY = 'sbl-07', saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    var palKey = saved && PALS[saved.pal] ? saved.pal : 'riso', G = grammar({}), els = [], nextId = 1, history = [], renderVer = {};
    function persist() { try { localStorage.setItem(KEY, JSON.stringify({ pal: palKey })); } catch (e) {} }
    function snapshot() { history.push(JSON.stringify({ G: G, els: els, pal: palKey })); if (history.length > 40) history.shift(); }
    function rederive() { els.forEach(function (el) { if (!el.locked && !el.insisted) { el.view = interpret(el.src, G, PALS[palKey]); el.ver = (el.ver || 0) + 1; } }); }

    // ---------- discoveries ----------
    var FINDS = { read: 'it read you', misread: 'it misread you', correct: 'it took the correction', drift: 'it changed something else too', agree: 'agreed', refuse: 'refused', insist: 'you insisted', sides: 'it counts sides differently now', mirror: 'it found symmetry', score: 'it reads the drawing as music', undo: 'it forgets', template: 'a borrowed beginning', far: 'far from what you meant' };
    var KEYS = Object.keys(FINDS), found = {};
    api.pips(KEYS.length);
    function find(k) { if (found[k]) return; found[k] = 1; api.light(KEYS.indexOf(k)); api.whisper(FINDS[k]); }

    // ---------- sound ----------
    var snd = null;
    try { var A = api.audio && api.audio(); if (A && SBL.negotiationSound) snd = SBL.negotiationSound(A); } catch (e) { snd = null; }
    function S(name) { if (!snd) return; try { return snd[name].apply(snd, [].slice.call(arguments, 1)); } catch (e) {} }

    // ---------- the page ----------
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.style.cssText = 'position:absolute;inset:0;display:block;touch-action:none;cursor:crosshair';
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'A drawing you make together with a machine that redraws every stroke');
    var style = document.createElementNS(NS, 'style');
    style.textContent = '.fresh{stroke-dasharray:1;stroke-dashoffset:1;animation:ng-draw .7s cubic-bezier(.4,0,.2,1) forwards}.fresh.filled{fill-opacity:0;animation:ng-draw .7s cubic-bezier(.4,0,.2,1) forwards,ng-fill .5s .5s forwards}' +
      '@keyframes ng-draw{to{stroke-dashoffset:0}}@keyframes ng-fill{to{fill-opacity:1}}.note{font:11px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.06em;opacity:0;animation:ng-note 5s ease forwards}' +
      '@keyframes ng-note{0%{opacity:0;transform:translateY(4px)}10%,75%{opacity:.85;transform:none}100%{opacity:0}}.ghost{opacity:.22}@media(prefers-reduced-motion:reduce){.fresh,.fresh.filled{animation:none;stroke-dashoffset:0;fill-opacity:1}}';
    svg.appendChild(style);
    var defs = document.createElementNS(NS, 'defs'); svg.appendChild(defs);
    var bg = document.createElementNS(NS, 'rect'); bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); svg.appendChild(bg);
    var gridG = document.createElementNS(NS, 'g'), ghostG = document.createElementNS(NS, 'g'), elG = document.createElementNS(NS, 'g'), liveP = document.createElementNS(NS, 'path'), noteG = document.createElementNS(NS, 'g');
    ghostG.setAttribute('class', 'ghost'); [gridG, ghostG, elG, liveP, noteG].forEach(function (n) { svg.appendChild(n); });
    liveP.setAttribute('fill', 'none'); liveP.setAttribute('stroke-width', '2.5'); liveP.setAttribute('stroke-linecap', 'round'); liveP.setAttribute('stroke-linejoin', 'round'); liveP.setAttribute('opacity', '.55');
    stage.appendChild(svg);
    var showGhosts = false;

    function render() {
      var pal = PALS[palKey], ink = pal.ink, out = [], ghosts = [];
      bg.setAttribute('fill', pal.paper); liveP.setAttribute('stroke', ink);
      // the grid it believes in, made faintly visible
      var gs = G.grid, gp = 'gp' + gs;
      defs.innerHTML = '<pattern id="' + gp + '" width="' + gs + '" height="' + gs + '" patternUnits="userSpaceOnUse"><circle cx="' + gs / 2 + '" cy="' + gs / 2 + '" r="1" fill="' + ink + '" fill-opacity="' + (pal.dark ? .18 : .14) + '"/></pattern>';
      gridG.innerHTML = '<rect width="100%" height="100%" fill="url(#' + gp + ')"/>';
      els.forEach(function (el) {
        var v = el.view, fresh = renderVer[el.id] !== el.ver; renderVer[el.id] = el.ver;
        var base = ' stroke-linecap="round" stroke-linejoin="round" pathLength="1"';
        if (el.insisted) {
          var d = 'M' + el.src.pts.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L');
          out.push('<path d="' + d + '" fill="none" stroke="' + ink + '" stroke-width="3"' + base + (fresh ? ' class="fresh"' : '') + '/>');
          return;
        }
        var copies = mirrorFns(); var sw = el.locked ? 5 : 3.2;
        v.shapes.forEach(function (s) {
          copies.forEach(function (fn, ci) {
            var s2 = fn(s), closedS = s.k === 'circle' || s.k === 'poly';
            var a = ' fill="' + (v.fill && closedS ? v.color : 'none') + '" stroke="' + (v.fill && closedS ? ink : v.color) + '" stroke-width="' + sw + '"' + base + (fresh ? ' class="fresh' + (v.fill && closedS ? ' filled' : '') + '"' : '') + (ci ? ' opacity=".85"' : '');
            out.push(svgShape(s2, a));
          });
        });
        if (el.locked) { var c = centerOf(el); out.push('<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="3.5" fill="' + ink + '"/>'); }
        if (showGhosts) ghosts.push('<path d="M' + el.src.pts.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + '" fill="none" stroke="' + ink + '" stroke-width="1.5" stroke-dasharray="3 4"/>');
      });
      elG.innerHTML = out.join(''); ghostG.innerHTML = ghosts.join('');
      api.tone && api.tone(pal.dark ? 'dark' : 'light');
      syncPanel();
    }
    function mirrorFns() {
      var id = function (s) { return s; };
      function mx(s) { return xform(s, function (p) { return [W - p[0], p[1]]; }, true); }
      function my(s) { return xform(s, function (p) { return [p[0], H - p[1]]; }, true); }
      if (G.mirror === 1) return [id, mx];
      if (G.mirror === 2) return [id, mx, my, function (s) { return my(mx(s)); }];
      return [id];
    }
    function xform(s, f, flip) {
      if (s.k === 'line') return { k: 'line', a: f(s.a), b: f(s.b) };
      if (s.k === 'circle') return { k: 'circle', c: f(s.c), r: s.r };
      return { k: 'path', pts: shapePts(s).map(f), closed: s.k === 'poly' };
    }
    function centerOf(el) { if (el.insisted) return [el.src.f.cx, el.src.f.cy]; var s = el.view.shapes[0]; if (!s) return [el.src.f.cx, el.src.f.cy]; if (s.c) return s.c; var p = shapePts(s), x = 0, y = 0; p.forEach(function (q) { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; }
    function elPts(el) { if (el.insisted) return el.src.pts; var all = []; el.view.shapes.forEach(function (s) { all = all.concat(shapePts(s)); }); return all; }
    function bbox(pts) { var b = [1e9, 1e9, -1e9, -1e9]; pts.forEach(function (q) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); }); return b; }
    function segDist(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, u = l ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l, 0, 1) : 0; return Math.hypot(p[0] - a[0] - dx * u, p[1] - a[1] - dy * u); }
    function inPoly(p, poly) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
    function hitEl(p) {
      for (var i = els.length - 1; i >= 0; i--) {
        var el = els[i], pts = elPts(el), d = 1e9;
        for (var k = 1; k < pts.length; k++) d = Math.min(d, segDist(p, pts[k - 1], pts[k]));
        if (d < (TOUCH ? 28 : 12)) return el;
        if (!el.insisted && el.view.shapes.some(function (s) { return (s.k === 'circle' || s.k === 'poly') && inPoly(p, shapePts(s)); })) return el;
      }
      return null;
    }
    function overlapEl(src) {
      var sb = [src.f.x0, src.f.y0, src.f.x1, src.f.y1], best = null, bestS = 0;
      els.forEach(function (el) {
        var b = bbox(elPts(el)), ix = Math.max(0, Math.min(sb[2], b[2]) - Math.max(sb[0], b[0])), iy = Math.max(0, Math.min(sb[3], b[3]) - Math.max(sb[1], b[1]));
        var inter = ix * iy, uni = Math.max(1, (sb[2] - sb[0]) * (sb[3] - sb[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter), iou = inter / uni;
        var cIn = src.f.cx > b[0] - 8 && src.f.cx < b[2] + 8 && src.f.cy > b[1] - 8 && src.f.cy < b[3] + 8, sizeR = (src.f.size + 1) / (Math.max(b[2] - b[0], b[3] - b[1]) + 1);
        var score = iou > .3 ? iou : cIn && sizeR > .35 && sizeR < 2.8 ? .3 : 0;
        if (score > bestS) { bestS = score; best = el; }
      });
      return best;
    }
    function distance() { // how far the drawing has drifted from what you drew, as a share of the page diagonal
      if (!els.length) return 0; var diag = Math.hypot(W, H), tot = 0;
      els.forEach(function (el) {
        var vp = elPts(el), d = 0; el.src.pts.forEach(function (q) { var m = 1e9; for (var k = 1; k < vp.length; k++) m = Math.min(m, segDist(q, vp[k - 1], vp[k])); if (vp.length === 1) m = Math.hypot(q[0] - vp[0][0], q[1] - vp[0][1]); d += m; });
        tot += d / el.src.pts.length;
      });
      return tot / els.length / diag * 100 * 6;
    }

    // ---------- notes in the margin: the machine's own account ----------
    function note(text, x, y) {
      var pal = PALS[palKey], tx = clamp(x, 16, Math.max(16, W - 7 * text.length - 16)), ty = clamp(y, 84, H - 90);
      [].slice.call(noteG.childNodes).forEach(function (o) { if (Math.abs(+o.getAttribute('y') - ty) < 16 && Math.abs(+o.getAttribute('x') - tx) < 240) o.remove(); });
      var n = document.createElementNS(NS, 'text'); n.setAttribute('x', tx); n.setAttribute('y', ty); n.setAttribute('class', 'note'); n.setAttribute('fill', pal.ink); n.textContent = text;
      var parts = text.split(' \u00b7 ');
      if (7 * text.length > W - 32 && parts.length > 1) { n.textContent = ''; n.setAttribute('x', 16); parts.forEach(function (t, i) { var ts = document.createElementNS(NS, 'tspan'); ts.setAttribute('x', 16); ts.setAttribute('dy', i ? '1.5em' : '0'); ts.textContent = t; n.appendChild(ts); }); }
      noteG.appendChild(n); setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 5200);
    }
    function nameOf(v) { return v.type === 'polygon' ? (SIDE_NAMES[v.n] || v.n + '-gon') : v.type === 'loop' ? 'circle' : v.type === 'wave' ? 'wave' : v.type; }

    // ---------- the negotiation ----------
    function contourOf(src) { var c = []; for (var i = 0; i < src.pts.length; i += 4) c.push([src.pts[i][0] / W, src.pts[i][1] / H]); return c; }
    function reply(el) {
      var v = el.view, c = centerOf(el), p = elPts(el);
      return { type: el.insisted ? 'raw' : v.type, n: v.n * (v.type === 'loop' ? G.echo : 1), x: c[0] / W, y: c[1] / H, y0: p[0][1] / H, y1: p[p.length - 1][1] / H };
    }
    function addStroke(src) {
      snapshot();
      var el = { id: nextId++, src: src, locked: false, insisted: false, ver: 1 };
      el.view = interpret(src, G, PALS[palKey]); els.push(el); render();
      S('exchange', contourOf(src), reply(el));
      var c = centerOf(el); note('read ' + src.cat + ' \u00b7 wrote ' + nameOf(el.view) + (el.view.misread ? ' (it looked like one)' : ''), c[0] + 18, c[1] - 18);
      find('read'); if (el.view.misread) find('misread');
    }
    function correct(el, src) {
      snapshot();
      var old = el.view, vCat = src.cat, mType = old.type, notes = [], sidesBefore = G.sides, mirrorBefore = G.mirror;
      if (vCat === 'loop' && mType === 'polygon') { G.mis.loop = Math.max(.02, G.mis.loop * .55); G.sides = Math.min(12, G.sides + 1 + (G.corrections % 2)); notes.push('rounder \u2192 ' + G.sides + ' sides'); }
      else if (vCat === 'polygon' && mType === 'loop') { G.mis.polygon = Math.max(.02, G.mis.polygon * .55); G.sides = clamp(Math.round((G.sides + src.f.sides) / 2) + Math.sign(src.f.sides - G.sides), 3, 12); notes.push('corners \u2192 ' + G.sides + ' sides'); }
      else if (vCat === 'polygon' && mType === 'polygon') { if (src.f.sides !== old.n) { G.stubborn = Math.max(.1, G.stubborn - .15); G.sides = clamp(src.f.sides + Math.sign(src.f.sides - G.sides), 3, 12); notes.push('listening more \u00b7 ' + G.sides + ' sides'); } else notes.push('the same shape, again'); }
      else if (vCat === 'line' && mType === 'arc') { G.mis.line = Math.max(.01, G.mis.line * .5); notes.push('straighter'); }
      else if (vCat === 'arc' && mType === 'line') { G.mis.arc = Math.max(.02, G.mis.arc * .5); notes.push('curvier'); }
      else if (vCat === 'line' && mType === 'line') {
        var raw = src.f.angle * 180 / Math.PI, step = G.angle || 1, off = Math.abs(((raw % step) + step) % step); off = Math.min(off, step - off);
        if (G.angle && off > 5) { G.angle = ANGLE_CYCLE[(ANGLE_CYCLE.indexOf(G.angle) + 1) % ANGLE_CYCLE.length]; notes.push('angles \u2192 ' + (G.angle ? G.angle + '\u00b0' : 'free')); }
        else { G.grid = clamp(Math.round(G.grid * Math.sqrt((src.f.L + 1) / (Math.hypot(old.shapes[0].b[0] - old.shapes[0].a[0], old.shapes[0].b[1] - old.shapes[0].a[1]) + 1)) / 4) * 4, 8, 64); notes.push('grid \u2192 ' + G.grid); }
      }
      else if (vCat === mType || (vCat === 'zigzag' && mType === 'wave')) { var ms = Math.max(1, bboxSize(elPts(el))); G.grid = clamp(Math.round(G.grid * Math.sqrt((src.f.size + 1) / ms) / 4) * 4, 8, 64); notes.push('grid \u2192 ' + G.grid); }
      else { G.mis[vCat] = Math.max(.02, (G.mis[vCat] || .2) * .7); notes.push('noted: ' + vCat); }
      // the imperfection: every correction moves one more thing, always in the same order
      var drift = G.corrections % 5, dn; G.corrections++;
      if (drift === 0) { G.echo = G.echo % 3 + 1; dn = 'echo \u00d7' + G.echo; }
      else if (drift === 1) { G.mirror = (G.mirror + 1) % 3; dn = MIRROR_NAMES[G.mirror]; }
      else if (drift === 2) { G.colorShift++; dn = 'colours turn'; }
      else if (drift === 3) { G.rot = (G.rot + (G.angle || 30) / 2) % 180; dn = 'tilted ' + Math.round(G.rot) + '\u00b0'; }
      else { G.fill = G.fill > .5 ? .2 : .85; dn = G.fill > .5 ? 'fills more' : 'fills less'; }
      notes.push('and: ' + dn);
      G.version++; el.src = src; rederive(); render();
      var agreeNow = el.view.type === vCat || (vCat === 'zigzag' && el.view.type === 'wave') || (vCat === 'polygon' && el.view.type === 'polygon' && el.view.n === src.f.sides);
      S('exchange', contourOf(src), reply(el)); setTimeout(function () { S(agreeNow ? 'agree' : 'disagree'); }, 900);
      var c = centerOf(el); note(notes.join(' \u00b7 '), c[0] + 18, c[1] - 18);
      find('correct'); find('drift'); if (G.sides !== sidesBefore) find('sides'); if (G.mirror && !mirrorBefore) find('mirror');
      if (distance() > 35) find('far');
    }
    function bboxSize(p) { var b = bbox(p); return Math.max(b[2] - b[0], b[3] - b[1]); }
    function agree(el) {
      if (el.locked) return; snapshot(); el.locked = true; el.ver++; G.mis[el.src.cat] = Math.max(.02, (G.mis[el.src.cat] || .2) * .8); G.version++; rederive(); render();
      S('approve'); var c = centerOf(el); note('kept', c[0] + 14, c[1] - 14); find('agree');
    }
    function refuse(el) {
      snapshot(); els = els.filter(function (e) { return e !== el; }); G.mis[el.src.cat] = Math.min(.6, (G.mis[el.src.cat] || .2) + .08); G.echo = Math.max(1, G.echo - 1); G.version++; rederive(); render();
      S('reject'); var c = centerOf(el); note('erased \u00b7 I will doubt that next time', c[0] + 14, c[1] - 14); find('refuse');
    }
    function insist(el) {
      if (el.insisted) return; snapshot(); el.insisted = true; el.ver++; G.stubborn = Math.max(.05, G.stubborn - .12); G.version++; rederive(); render();
      S('insist'); var c = centerOf(el); note('yours, then', c[0] + 14, c[1] - 14); find('insist');
    }
    function undo() {
      var s = history.pop(); if (!s) return; var o = JSON.parse(s); G = o.G; els = o.els; palKey = o.pal; renderVer = {}; render(); S('undo'); find('undo');
    }
    function clearPage() { snapshot(); els = []; render(); noteG.innerHTML = ''; note('the page is clear \u00b7 the grammar remains', 24, 84); }
    function playScore() {
      if (!els.length) return; var dur = 4;
      var notes = els.map(function (el) { var c = centerOf(el); return { x: clamp(c[0] / W, 0, 1), y: clamp(c[1] / H, 0, 1), type: el.insisted ? 'raw' : el.view.type, n: el.view.n }; });
      S('score', notes, dur); sweep(dur); find('score');
    }
    var sweepEl = null;
    function sweep(dur) {
      if (sweepEl) sweepEl.remove();
      sweepEl = document.createElementNS(NS, 'line'); sweepEl.setAttribute('y1', 0); sweepEl.setAttribute('y2', H); sweepEl.setAttribute('stroke', PALS[palKey].ink); sweepEl.setAttribute('stroke-opacity', '.35');
      svg.appendChild(sweepEl); var t0 = performance.now(), me = sweepEl;
      (function step() { var k = (performance.now() - t0) / (dur * 1000); if (k > 1 || me !== sweepEl) { me.remove(); return; } me.setAttribute('x1', k * W); me.setAttribute('x2', k * W); requestAnimationFrame(step); })();
    }
    function setPalette(k) { if (!PALS[k] || k === palKey) return; snapshot(); palKey = k; persist(); S('setPalette', k); G.version++; rederive(); render(); }

    // ---------- starting templates: drawn as strokes, so the machine reads them too ----------
    function wob(seed) { var r = mulberry(seed); return function (a) { return (r() - .5) * a; }; }
    function circleS(cx, cy, r, sd) { var w = wob(sd), p = []; for (var i = 0; i <= 40; i++) { var a = i / 40 * TAU * 1.02 - .3; p.push([cx + Math.cos(a) * (r + w(r * .08)), cy + Math.sin(a) * (r + w(r * .08))]); } return p; }
    function polyS(cx, cy, r, n, rot, sd) { var w = wob(sd), p = []; for (var i = 0; i <= n; i++) { var a0 = rot + i / n * TAU, a1 = rot + (i + 1) / n * TAU; for (var k = 0; k < 8 && i < n; k++) { var u = k / 8; p.push([cx + lerp(Math.cos(a0), Math.cos(a1), u) * r + w(3), cy + lerp(Math.sin(a0), Math.sin(a1), u) * r + w(3)]); } } p.push(p[0].slice()); return p; }
    function lineS(x0, y0, x1, y1, sd) { var w = wob(sd), p = []; for (var i = 0; i <= 20; i++) { var u = i / 20; p.push([lerp(x0, x1, u) + w(2), lerp(y0, y1, u) + w(2)]); } return p; }
    function arcS(cx, cy, r, a0, a1) { var p = []; for (var i = 0; i <= 24; i++) { var a = lerp(a0, a1, i / 24); p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
    function zigS(x0, y0, x1, n, amp) { var p = []; for (var i = 0; i <= n; i++) p.push([lerp(x0, x1, i / n), y0 + (i % 2 ? amp : -amp)]); return p; }
    var TEMPLATES = {
      blank: { name: 'Blank page', desc: 'an untrained grammar', pal: null, g: {}, strokes: function () { return []; } },
      bauhaus: { name: 'Bauhaus primer', desc: 'right angles, four sides, full colour', pal: 'bauhaus', g: { angle: 90, sides: 4, grid: 32, fill: .75, mis: { loop: .15 } },
        strokes: function (w, h, m) { return [circleS(w * .3, h * .46, m * .11, 1), polyS(w * .5, h * .46, m * .11, 4, Math.PI / 4, 2), polyS(w * .7, h * .48, m * .12, 3, -Math.PI / 2, 3), lineS(w * .2, h * .7, w * .8, h * .7, 4)]; } },
      constructivist: { name: 'Constructivist', desc: 'diagonals, thirty degrees, triangles', pal: 'constructivist', g: { angle: 30, sides: 3, echo: 2, fill: .5 },
        strokes: function (w, h, m) { return [lineS(w * .2, h * .78, w * .72, h * .26, 5), polyS(w * .66, h * .62, m * .1, 3, 0, 6), arcS(w * .36, h * .42, m * .14, Math.PI, Math.PI * 1.8), zigS(w * .3, h * .86, w * .62, 8, Math.max(16, w * .03))]; } },
      garden: { name: 'Garden', desc: 'curves, mirrored, eight-sided', pal: 'garden', g: { angle: 15, sides: 8, mirror: 1, fill: .6, conf: { arc: 'loop' } },
        strokes: function (w, h, m) { return [arcS(w * .32, h * .55, m * .16, Math.PI * .9, Math.PI * 1.9), circleS(w * .3, h * .36, m * .06, 7), circleS(w * .4, h * .62, m * .045, 8), arcS(w * .2, h * .7, m * .1, -Math.PI * .2, Math.PI * .7), lineS(w * .36, h * .82, w * .36, h * .56, 9)]; } },
      score: { name: 'Score', desc: 'horizontal only, staves and noteheads', pal: 'night', g: { angle: 180, sides: 6, echo: 3, grid: 16, fill: .9 },
        strokes: function (w, h, m) { return [lineS(w * .12, h * .5, w * .88, h * .5, 10), circleS(w * .28, h * .42, 12, 11), circleS(w * .42, h * .56, 12, 12), circleS(w * .56, h * .46, 12, 13), circleS(w * .7, h * .52, 12, 14)]; } }
    };
    function useTemplate(k, quiet) {
      var T = TEMPLATES[k]; if (!T) return; snapshot();
      G = grammar(T.g); if (T.pal) { palKey = T.pal; persist(); S('setPalette', palKey); }
      els = []; renderVer = {}; noteG.innerHTML = ''; var m = Math.min(W, H);
      T.strokes(W, H, m).forEach(function (raw) { var src = classify(raw); if (src.cat === 'tap') return; var el = { id: nextId++, src: src, locked: false, insisted: false, ver: 1 }; el.view = interpret(src, G, PALS[palKey]); els.push(el); });
      render(); if (!quiet) { find('template'); note(T.name.toLowerCase() + ' \u00b7 ' + T.desc, 24, 84); }
    }

    // ---------- input ----------
    var stroke = null, lastTapT = 0, multiSeen = false, longFired = false;
    function pt(e) { var r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    svg.addEventListener('pointerdown', function (e) {
      if (e.button === 2) return;
      if (e.pointerType === 'touch' && G2 && G2.count() > 1) { multiSeen = true; cancelStroke(); return; }
      if (e.isPrimary) multiSeen = false;
      if (panelOpen) { openPanel(false); return; }
      try { svg.setPointerCapture(e.pointerId); } catch (er) {}
      var p = pt(e); stroke = { raw: [p], t0: performance.now(), lt: performance.now() }; longFired = false; liveP.setAttribute('d', 'M' + p[0] + ' ' + p[1]);
      S('drawStart', p[1] / H, p[0] / W);
    }, sig);
    svg.addEventListener('pointermove', function (e) {
      if (!stroke) return; if (G2 && G2.count() > 1) { cancelStroke(); return; }
      var p = pt(e), l = stroke.raw[stroke.raw.length - 1], d = Math.hypot(p[0] - l[0], p[1] - l[1]); if (d < 2) return;
      var now = performance.now(), sp = d / Math.max(1, now - stroke.lt) * 1000; stroke.lt = now; stroke.raw.push(p);
      liveP.setAttribute('d', liveP.getAttribute('d') + 'L' + f1(p[0]) + ' ' + f1(p[1])); S('drawMove', p[1] / H, p[0] / W, sp);
    }, sig);
    function cancelStroke() { if (stroke) { stroke = null; liveP.setAttribute('d', ''); S('drawEnd'); } }
    function up(e) {
      if (multiSeen) { if (!G2 || G2.count() === 0) multiSeen = false; cancelStroke(); return; }
      if (!stroke) return; var st = stroke; stroke = null; liveP.setAttribute('d', ''); S('drawEnd');
      if (e.type === 'pointercancel' || longFired) return;
      var raw = st.raw, dur = performance.now() - st.t0, x0 = raw[0][0];
      // a quick swipe in from a screen edge changes the palette instead of drawing
      if (dur < 450 && raw.length > 3 && (x0 < 26 || x0 > W - 26) && Math.abs(raw[raw.length - 1][0] - x0) > 70) { var i = PAL_KEYS.indexOf(palKey); setPalette(PAL_KEYS[(i + (x0 < 26 ? 1 : PAL_KEYS.length - 1)) % PAL_KEYS.length]); api.whisper(PALS[palKey].name.toLowerCase()); return; }
      var src = classify(raw);
      if (src.cat === 'tap') {
        var hit = hitEl(raw[0]), now = performance.now();
        if (hit) agree(hit);
        else if (now - lastTapT < 320) { playScore(); lastTapT = 0; }
        else lastTapT = now;
        return;
      }
      var over = overlapEl(src);
      if (src.cat === 'zigzag' && over) { refuse(over); return; }
      if (over && !over.locked && !over.insisted) { correct(over, src); return; }
      addStroke(src);
    }
    svg.addEventListener('pointerup', up, sig); svg.addEventListener('pointercancel', up, sig);
    svg.addEventListener('contextmenu', function (e) { e.preventDefault(); var h = hitEl(pt(e)); if (h) insist(h); }, sig);
    addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName)) return;
      var k = e.key.toLowerCase();
      if ((k === 'z' && !e.shiftKey) || (k === 'z' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); undo(); }
      else if (k === ' ') { e.preventDefault(); playScore(); }
      else if (k === 'backspace' || k === 'delete') { e.preventDefault(); clearPage(); }
      else if (k === 'p') { var i = PAL_KEYS.indexOf(palKey); setPalette(PAL_KEYS[(i + 1) % PAL_KEYS.length]); api.whisper(PALS[palKey].name.toLowerCase()); }
      else if (k === 'g') { showGhosts = !showGhosts; render(); }
    }, sig);
    var G2 = api.gestures ? api.gestures(svg, function (type, d) {
      switch (type) {
        case 'multistart': multiSeen = true; cancelStroke(); break;
        case 'longpress': { var h = hitEl(pt({ clientX: d.x, clientY: d.y })); if (h) { longFired = true; insist(h); } } break;
        case 'twotap': undo(); break;
        case 'threetap': clearPage(); break;
        case 'pinch': if (d.scale < .7 && !showGhosts) { showGhosts = true; render(); } else if (d.scale > 1.3 && showGhosts) { showGhosts = false; render(); } break;
      }
    }) : null;

    // ---------- panel: the grammar, laid bare ----------
    var slot = api.slot && api.slot(), panel = null, ctl = {}, panelOpen = false;
    function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
    if (slot) {
      var wrap = el('div', 'icpick'), btn = el('button', 'hudbtn'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(el('span', 'icglyph')); btn.appendChild(el('span', null, 'GRAMMAR'));
      panel = el('div', 'icpanel'); panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'The machine\u2019s grammar');
      ctl.card = el('div'); ctl.card.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-variant-numeric:tabular-nums'; panel.appendChild(ctl.card);
      var r1 = el('div', 'icrow'); r1.appendChild(el('span', 'iclab', 'Palette')); var sw = el('div', 'icsw'); r1.appendChild(sw); panel.appendChild(r1);
      ctl.pals = PAL_KEYS.map(function (k) { var p = PALS[k], b = el('button', 'icchip'); b.type = 'button'; b.title = p.name; b.setAttribute('aria-label', p.name); b.style.background = 'linear-gradient(135deg,' + p.paper + ' 0 45%,' + p.colors[0] + ' 45% 65%,' + p.colors[1] + ' 65% 82%,' + p.ink + ' 82%)'; b.addEventListener('click', function () { setPalette(k); }); sw.appendChild(b); return b; });
      var tl = el('div', 'iclab', 'Begin from'); tl.style.marginTop = '4px'; panel.appendChild(tl);
      Object.keys(TEMPLATES).forEach(function (k) {
        var T = TEMPLATES[k], b = el('button'); b.type = 'button'; b.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:12px;width:100%;background:none;border:0;border-bottom:1px solid var(--p-line);padding:7px 0;color:var(--p-fg);cursor:pointer;text-align:left;font:inherit;letter-spacing:inherit;text-transform:inherit';
        var d = el('span', 'iclab', T.desc); d.style.textTransform = 'none'; d.style.letterSpacing = '0'; d.style.fontSize = '11px'; b.appendChild(el('span', null, T.name)); b.appendChild(d);
        b.addEventListener('click', function () { useTemplate(k); openPanel(false); }); panel.appendChild(b);
      });
      var foot = el('div', 'icfoot');
      [['PLAY', playScore], ['UNDO', undo], ['CLEAR', clearPage]].forEach(function (a, i) { var b = el('button', 'iccopy', a[0]); b.type = 'button'; if (i === 0) b.style.marginLeft = '0'; b.addEventListener('click', a[1]); foot.appendChild(b); });
      ctl.copy = el('button', 'iccopy', 'COPY SVG'); ctl.copy.type = 'button'; foot.appendChild(ctl.copy); panel.appendChild(foot);
      var ta = el('textarea', 'icta'); ta.hidden = true; ta.readOnly = true; ta.id = 'ng-svg'; ta.setAttribute('aria-label', 'SVG markup'); panel.appendChild(ta);
      ctl.copy.addEventListener('click', function () {
        var c = svg.cloneNode(true); c.setAttribute('xmlns', NS); c.setAttribute('viewBox', '0 0 ' + W + ' ' + H); c.setAttribute('width', W); c.setAttribute('height', H); c.removeAttribute('style'); c.querySelectorAll('.note').forEach(function (n) { n.remove(); });
        c.querySelectorAll('.fresh').forEach(function (n) { n.removeAttribute('class'); }); var s = c.outerHTML; ta.value = s;
        function fb() { ta.hidden = false; ta.focus(); ta.select(); ctl.copy.textContent = 'SELECTED'; setTimeout(function () { ctl.copy.textContent = 'COPY SVG'; }, 1800); }
        try { navigator.clipboard.writeText(s).then(function () { ta.hidden = true; ctl.copy.textContent = 'COPIED'; setTimeout(function () { ctl.copy.textContent = 'COPY SVG'; }, 1500); }, fb); } catch (er) { fb(); }
      });
      wrap.appendChild(btn); wrap.appendChild(panel); slot.appendChild(wrap); ctl.btn = btn;
      btn.addEventListener('click', function () { openPanel(panel.hidden); });
      document.addEventListener('pointerdown', function (e) { if (panelOpen && !wrap.contains(e.target) && e.target !== svg && !svg.contains(e.target)) openPanel(false); }, sig);
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { openPanel(false); btn.focus(); e.stopPropagation(); } }, { capture: true, signal: ac.signal });
    }
    function openPanel(o) { if (!panel) return; panelOpen = o; panel.hidden = !o; ctl.btn.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) syncPanel(); }
    function syncPanel() {
      if (!panel || !panelOpen) return;
      var worst = CATS.slice().sort(function (a, b) { return (G.mis[b] || 0) - (G.mis[a] || 0); })[0];
      var rows = [['Angles', G.angle === 180 ? 'horizontal only' : G.angle ? 'every ' + G.angle + '\u00b0' + (G.rot ? ', tilted ' + Math.round(G.rot) + '\u00b0' : '') : 'free'], ['Believes in', G.sides + ' sides'], ['Echo', '\u00d7' + G.echo], ['Symmetry', MIRROR_NAMES[G.mirror]], ['Grid', G.grid + ' px'],
        ['Often misreads', worst + ' as ' + (G.conf[worst] === 'wave' ? 'wave' : G.conf[worst]) + ' (' + Math.round(G.mis[worst] * 100) + '%)'], ['Listens', Math.round((1 - G.stubborn) * 100) + '%'], ['Corrections', String(G.corrections)], ['Distance from you', Math.round(distance()) + '%']];
      ctl.card.innerHTML = ''; rows.forEach(function (r) { var a = el('span', 'iclab', r[0]), b = el('span', null, r[1]); b.style.textTransform = 'none'; b.style.letterSpacing = '.02em'; ctl.card.appendChild(a); ctl.card.appendChild(b); });
      ctl.pals.forEach(function (b, i) { b.setAttribute('aria-pressed', PAL_KEYS[i] === palKey ? 'true' : 'false'); });
    }

    // ---------- start ----------
    S('setPalette', palKey);
    render();
    addEventListener('resize', function () { W = innerWidth; H = innerHeight; render(); }, sig);
    if (SBL.debug) SBL._07 = { classify: classify, interpret: interpret, G: function () { return G; }, els: function () { return els; }, stroke: function (raw) { up({ type: 'pointerup' }); stroke = { raw: raw, t0: performance.now() - 1000, lt: 0 }; up({ type: 'pointerup' }); }, template: useTemplate, distance: distance, PALS: PALS };

    return function unmount() { ac.abort(); if (G2) G2(); S('stop'); };
  }
});
