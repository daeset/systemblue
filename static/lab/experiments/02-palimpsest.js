/* 02 - Palimpsest. A drawing surface that remembers what you forget.
   Present: the line you are drawing, luminous and immediate.
   Memory: older lines fade from the surface, but every one of them was written into a low-resolution vector field
           (direction of travel, depth of use, and scars where something was erased).
   Consequence: new lines are displaced by that field - carried along old currents, pushed around deep ground,
                swirled by erasures. Erasing clears the surface but writes into the field: erasure is inscription.
   The field persists in IndexedDB between visits. */
SBL.register('02', {
  mount: function (stage, api) {
    'use strict';
    var ac = new AbortController(), sig = { signal: ac.signal }, TOUCH = !!api.touch;
    var W = innerWidth, H = innerHeight, DPR = Math.min(window.devicePixelRatio || 1, TOUCH ? 1.75 : 2);
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function hex(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }

    // ---------- palettes and moods: few, on purpose ----------
    var PALS = {
      ember: { name: 'Ember', bg: '#0e0b09', present: '#ffb04a', hot: '#fff0d2', memory: '#b0562c', field: '#ff8a4c', dark: true },
      lumen: { name: 'Lumen', bg: '#070a12', present: '#79e2ff', hot: '#effdff', memory: '#4060e0', field: '#6bd4ff', dark: true },
      verdigris: { name: 'Verdigris', bg: '#0a1411', present: '#7ff0c4', hot: '#eafff6', memory: '#b8743a', field: '#52d3a6', dark: true },
      vellum: { name: 'Vellum', bg: '#efe5d1', present: '#1e1914', hot: '#c2361f', memory: '#8d6b47', field: '#a2482a', dark: false }
    };
    var PAL_KEYS = Object.keys(PALS), MOODS = { choir: 'Choir', glass: 'Glass', tape: 'Tape' }, MOOD_KEYS = Object.keys(MOODS);
    var WEIGHTS = { light: .5, heavy: 1, absolute: 1.9 }, WEIGHT_KEYS = Object.keys(WEIGHTS);

    // ---------- the hidden field (normalised grid, independent of screen size) ----------
    var GX = 64, GY = 64, N = GX * GY;
    var vx = new Float32Array(N), vy = new Float32Array(N), mem = new Float32Array(N), scar = new Float32Array(N);
    var tmp = { x: 0, y: 0, m: 0, s: 0 };
    function sample(x, y, o) {
      o = o || tmp; var fx = clamp(x / W * GX - .5, 0, GX - 1.001), fy = clamp(y / H * GY - .5, 0, GY - 1.001), i = fx | 0, j = fy | 0, u = fx - i, v = fy - j;
      var a = j * GX + i, b = a + 1, c = a + GX, d = c + 1, wa = (1 - u) * (1 - v), wb = u * (1 - v), wc = (1 - u) * v, wd = u * v;
      o.x = vx[a] * wa + vx[b] * wb + vx[c] * wc + vx[d] * wd; o.y = vy[a] * wa + vy[b] * wb + vy[c] * wc + vy[d] * wd;
      o.m = mem[a] * wa + mem[b] * wb + mem[c] * wc + mem[d] * wd; o.s = scar[a] * wa + scar[b] * wb + scar[c] * wc + scar[d] * wd; return o;
    }
    var sA = {}, sB = {};
    function grad(x, y, key) { var hx = W / GX, hy = H / GY; sample(x + hx, y, sA); sample(x - hx, y, sB); var gx = (sA[key] - sB[key]) / 2; sample(x, y + hy, sA); sample(x, y - hy, sB); return [gx, (sA[key] - sB[key]) / 2]; }
    function deposit(x, y, dx, dy, w, kind) { // kind: 'ink' | 'erase' | 'stone'
      var cx = x / W * GX - .5, cy = y / H * GY - .5, R = kind === 'erase' ? 2.4 : kind === 'stone' ? 2.2 : 1.6, r2 = R * R;
      for (var j = Math.max(0, Math.floor(cy - R)); j <= Math.min(GY - 1, Math.ceil(cy + R)); j++) for (var i = Math.max(0, Math.floor(cx - R)); i <= Math.min(GX - 1, Math.ceil(cx + R)); i++) {
        var ddx = i - cx, ddy = j - cy, d2 = ddx * ddx + ddy * ddy; if (d2 > r2) continue; var k = Math.exp(-d2 / (r2 * .45)) * w, id = j * GX + i;
        if (kind === 'ink') { vx[id] += dx * k * .5; vy[id] += dy * k * .5; mem[id] = Math.min(4, mem[id] + k * .09); }
        else if (kind === 'erase') { vx[id] += -dy * k * .35; vy[id] += dx * k * .35; scar[id] = Math.min(3, scar[id] + k * .16); mem[id] = Math.min(4, mem[id] + k * .03); }
        else { var dl = Math.sqrt(d2) || 1; vx[id] += ddx / dl * k * .7; vy[id] += ddy / dl * k * .7; mem[id] = Math.min(4, mem[id] + k * .35); }
        var mg = Math.hypot(vx[id], vy[id]); if (mg > 1.6) { vx[id] *= 1.6 / mg; vy[id] *= 1.6 / mg; }
      }
    }
    var tvx = new Float32Array(N), tvy = new Float32Array(N);
    function diffuse(k) { // currents spread very slowly into their neighbours
      for (var j = 0; j < GY; j++) for (var i = 0; i < GX; i++) { var id = j * GX + i, sx = 0, sy = 0, n = 0; if (i > 0) { sx += vx[id - 1]; sy += vy[id - 1]; n++; } if (i < GX - 1) { sx += vx[id + 1]; sy += vy[id + 1]; n++; } if (j > 0) { sx += vx[id - GX]; sy += vy[id - GX]; n++; } if (j < GY - 1) { sx += vx[id + GX]; sy += vy[id + GX]; n++; } tvx[id] = vx[id] + (sx / n - vx[id]) * k; tvy[id] = vy[id] + (sy / n - vy[id]) * k; }
      vx.set(tvx); vy.set(tvy);
    }
    function depth() { var s = 0, sc = 0; for (var i = 0; i < N; i++) { s += Math.min(1, mem[i]); sc += Math.min(1, scar[i]); } return { mem: s / N, scar: sc / N }; }

    // ---------- state ----------
    var pref = {}; try { pref = JSON.parse(localStorage.getItem('sbl-02') || '{}') || {}; } catch (e) {}
    var palKey = PALS[pref.pal] ? pref.pal : 'ember', moodKey = MOODS[pref.mood] ? pref.mood : 'choir', weightKey = WEIGHTS[pref.weight] ? pref.weight : 'heavy';
    var stats = { strokes: 0, erasures: 0, sessions: 1, since: Date.now() };
    function savePref() { try { localStorage.setItem('sbl-02', JSON.stringify({ pal: palKey, mood: moodKey, weight: weightKey })); } catch (e) {} }

    // ---------- discoveries ----------
    var FINDS = { present: 'present', memory: 'it fades, but it is not gone', consequence: 'your line bent around an older one', current: 'you drew with an old current', against: 'you drew against it', erase: 'erasing is also writing', inscription: 'the erasure pushed back', stone: 'a tap is a stone in the stream', engrave: 'slow lines cut deeper', reveal: 'what lies underneath', dream: 'it rehearses your old gestures', scrape: 'the surface is clean. the page is not', ret: 'it remembers what you forgot', whirl: 'a closed line becomes a whirlpool', bell: 'you circled a stone and it rang', cut: 'against the grain, the page tears', pool: 'ink pools where you hesitate', bloom: 'the erasure writes back', pastself: 'your past self is still drawing' };
    var KEYS = Object.keys(FINDS), found = {};
    api.pips(KEYS.length);
    function find(k) { if (found[k]) return; found[k] = 1; api.light(KEYS.indexOf(k)); api.whisper(FINDS[k]); }

    // ---------- sound ----------
    var snd = null;
    try { var A = api.audio && api.audio(); if (A && SBL.palimpsestSound) snd = SBL.palimpsestSound(A); } catch (e) { snd = null; }
    function S(name) { if (!snd) return; try { return snd[name].apply(snd, [].slice.call(arguments, 1)); } catch (e) {} }
    S('setMood', moodKey);

    // ---------- canvases ----------
    var cv = document.createElement('canvas'), c = cv.getContext('2d');
    var mcv = document.createElement('canvas'), mc = mcv.getContext('2d'); // the memory layer
    var tcv = document.createElement('canvas'), tc = tcv.getContext('2d'); // trails of the field
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'A drawing surface that keeps a hidden history of every line');
    stage.appendChild(cv);
    function size() {
      var oldM = null; if (mcv.width) { oldM = document.createElement('canvas'); oldM.width = mcv.width; oldM.height = mcv.height; oldM.getContext('2d').drawImage(mcv, 0, 0); }
      W = innerWidth; H = innerHeight; cv.width = mcv.width = Math.round(W * DPR); cv.height = mcv.height = Math.round(H * DPR);
      tcv.width = Math.round(W * Math.min(DPR, 1.25)); tcv.height = Math.round(H * Math.min(DPR, 1.25)); tc.setTransform(tcv.width / W, 0, 0, tcv.height / H, 0, 0); tc.lineCap = 'round';
      c.setTransform(DPR, 0, 0, DPR, 0, 0); mc.setTransform(DPR, 0, 0, DPR, 0, 0); c.lineCap = mc.lineCap = 'round'; c.lineJoin = mc.lineJoin = 'round';
      if (oldM) { mc.save(); mc.setTransform(1, 0, 0, 1, 0, 0); mc.drawImage(oldM, 0, 0, mcv.width, mcv.height); mc.restore(); }
    }
    size();

    // ---------- particles: the field made faintly visible ----------
    var PN = TOUCH ? 700 : 1500, px = new Float32Array(PN), py = new Float32Array(PN), pl = new Float32Array(PN);
    function spawn(i) { for (var t = 0; t < 5; t++) { px[i] = Math.random() * W; py[i] = Math.random() * H; var id = clamp(Math.floor(py[i] / H * GY), 0, GY - 1) * GX + clamp(Math.floor(px[i] / W * GX), 0, GX - 1); if (mem[id] + scar[id] > .04) break; } pl[i] = 40 + Math.random() * 140; }
    for (var pi = 0; pi < PN; pi++) spawn(pi);

    // ---------- strokes ----------
    var strokes = [], cur = null, showField = false, reveal = 0, revealHold = false, lastInput = performance.now(), dreamer = null, scrapeT = -1, pulse = 0;
    var HOLD = 2.2, FADE = 6, stones = [], seams = [], sprouts = [], lastBloom = 0;
    function newStroke(x, y, ghost) {
      var s = { pts: [[x, y, 0]], raw: [x, y], disp: [0, 0], born: performance.now(), end: 0, ghost: !!ghost, queue: [], alignSum: 0, alignN: 0, bendMax: 0, res: false, len: 0, slow: 0, width: TOUCH ? 3 : 2.4, wind: 0, lastA: null, against: 0, lastMove: performance.now(), pool: 0 };
      strokes.push(s); return s;
    }
    function inkTo(s, x, y, pressure, dt) {
      var dx = x - s.raw[0], dy = y - s.raw[1], l = Math.hypot(dx, dy); if (l < 1.5) return;
      var ux = dx / l, uy = dy / l, last = s.pts[s.pts.length - 1], qx = last[0], qy = last[1], Wt = WEIGHTS[weightKey];
      var F = sample(qx, qy, {}), fm = Math.hypot(F.x, F.y), align = fm > .05 ? (ux * F.x + uy * F.y) / fm * Math.min(1, fm * 1.4) : 0;
      var g = grad(qx, qy, 'm'), gs = grad(qx, qy, 's');
      var push = [-g[0], -g[1]], pd = push[0] * ux + push[1] * uy; push[0] -= ux * pd; push[1] -= uy * pd;      // around deep ground, sideways only
      var curl = [-gs[1] - gs[0] * .4, gs[0] - gs[1] * .4];                                                      // erasures swirl
      var k = l / 20 * Wt;
      s.disp[0] += (F.x * 22 + push[0] * 80 + curl[0] * 90) * k; s.disp[1] += (F.y * 22 + push[1] * 80 + curl[1] * 90) * k;
      var decay = Math.pow(.94, l / 8); s.disp[0] *= decay; s.disp[1] *= decay;
      var dm = Math.hypot(s.disp[0], s.disp[1]), cap = 150 * Wt; if (dm > cap) { s.disp[0] *= cap / dm; s.disp[1] *= cap / dm; dm = cap; }
      s.raw[0] = x; s.raw[1] = y;
      var nx = x + s.disp[0], ny = y + s.disp[1], ddx = nx - qx, ddy = ny - qy, dl = Math.hypot(ddx, ddy) || 1, speed = l / Math.max(1, dt) * 1000;
      var wdt = clamp((pressure && pressure !== .5 ? pressure * 2 : 1) * (1.5 - Math.min(1, speed / 2200) * .9), .5, 2.2);
      s.pts.push([nx, ny, wdt]); s.len += dl; if (speed < 260) s.slow += dl;
      // deposits are held until the line is finished, so a line never pushes itself
      var dw = clamp(1.4 - speed / 1600, .35, 1.4); s.queue.push([nx, ny, ddx / dl, ddy / dl, dw * Math.min(1, dl / 6)]);
      s.alignSum += align; s.alignN++; s.bendMax = Math.max(s.bendMax, dm); s.lastMove = performance.now();
      var ang = Math.atan2(ddy, ddx); if (s.lastA !== null && dl > 1) { var da = ang - s.lastA; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; s.wind += da; } if (dl > 1) s.lastA = ang;
      s.against = align < -.5 && fm > .35 ? s.against + 1 : Math.max(0, s.against - 2); if (s.against > 22 && !s.cut && !s.ghost) { s.cut = true; S('cut'); }
      if (!s.ghost) {
        S('drawMove', nx / W, ny / H, speed, align, dm);
        if (F.m > .7 && Math.abs(align) < .5) S('touchPast', ny / H, Math.min(1, F.m / 3), nx / W);
        if (dm > 45) find('consequence');
        if (F.s > .35 && dm > 25) find('inscription');
        if (F.m > .1 || fm > .1) find('present');
        var av = s.alignSum / s.alignN;
        if (s.alignN > 30 && av > .45 && !s.res) { s.res = true; S('resonance', ny / H); find('current'); }
        if (s.alignN > 30 && av < -.4) find('against');
      }
    }
    function finish(s) {
      s.end = performance.now();
      if (s.ghost) { if (s.writes) s.queue.forEach(function (q) { deposit(q[0], q[1], q[2], q[3], q[4], 'ink'); }); s.queue = []; return; }
      var P0 = s.pts[0], PL = s.pts[s.pts.length - 1];
      if (s.pool > .4) { // a hesitation leaves a pool: a heavy stone
        for (var k = 0; k < 1 + s.pool * 1.5; k++) deposit(PL[0], PL[1], 0, 0, 1, 'stone'); stones.push([PL[0], PL[1]]); find('pool');
      }
      if (s.pts.length < 3 && s.len < 6) { // a tap: a stone in the stream
        deposit(P0[0], P0[1], 0, 0, 1, 'stone'); s.stone = true; stones.push([P0[0], P0[1]]); if (stones.length > 60) stones.shift(); find('stone'); S('touchPast', P0[1] / H, 1, P0[0] / W);
      } else if (s.cut) { // against the grain: the current along this line is severed, and the page keeps a seam
        s.queue.forEach(function (q) { var cx = clamp(Math.floor(q[0] / W * GX), 0, GX - 1), cy = clamp(Math.floor(q[1] / H * GY), 0, GY - 1), id = cy * GX + cx; vx[id] *= .1; vy[id] *= .1; scar[id] = Math.min(3, scar[id] + .25); });
        var seam = []; for (var i = 0; i < s.pts.length; i += 2) if (!s.pts[i][3]) seam.push([s.pts[i][0] / W, s.pts[i][1] / H]); if (seam.length > 2) { seams.push(seam); if (seams.length > 40) seams.shift(); }
        find('cut');
      } else {
        s.queue.forEach(function (q) { deposit(q[0], q[1], q[2], q[3], q[4], 'ink'); });
        var chord = Math.hypot(PL[0] - P0[0], PL[1] - P0[1]);
        if (Math.abs(s.wind) > 5.2 && chord < Math.max(50, s.len * .12) && s.len > 160) whirl(s);
      }
      s.queue = []; stats.strokes++;
      if (s.slow > 240) find('engrave');
      S('drawEnd'); scheduleSave();
    }
    function whirl(s) { // a closed line turns into a vortex inside itself
      var cx = 0, cy = 0, n = s.pts.length; s.pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= n; cy /= n;
      var r = 0; s.pts.forEach(function (p) { r += Math.hypot(p[0] - cx, p[1] - cy); }); r /= n; var dir = s.wind > 0 ? 1 : -1;
      for (var j = 0; j < GY; j++) for (var i = 0; i < GX; i++) {
        var x = (i + .5) / GX * W, y = (j + .5) / GY * H, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d > r * 1.15 || d < 1) continue;
        var id = j * GX + i, k = Math.sin(Math.PI * Math.min(1, d / r)) * .9; vx[id] += -dy / d * k * dir; vy[id] += dx / d * k * dir; mem[id] = Math.min(4, mem[id] + .05);
        var mg = Math.hypot(vx[id], vy[id]); if (mg > 1.6) { vx[id] *= 1.6 / mg; vy[id] *= 1.6 / mg; }
      }
      pulse = Math.max(pulse, .6); S('whirl', dir, cy / H); find('whirl');
      var inside = stones.filter(function (st) { return Math.hypot(st[0] - cx, st[1] - cy) < r * .9; });
      if (inside.length) { inside.forEach(function (st, i) { setTimeout(function () { S('bell', st[1] / H, st[0] / W, i); }, 350 + i * 260); }); find('bell'); }
    }
    function bloom() { // after a heavy erasure, the scars grow lines of their own
      var cand = []; for (var id = 0; id < N; id++) if (scar[id] > .5) cand.push(id);
      if (cand.length < 3) return; cand.sort(function (a, b) { return scar[b] - scar[a]; });
      var n = Math.min(6, 3 + (cand.length / 40 | 0));
      for (var k = 0; k < n; k++) { var id2 = cand[Math.floor(Math.pow(Math.random(), 2) * Math.min(cand.length, 80))]; var x = ((id2 % GX) + Math.random()) / GX * W, y = ((id2 / GX | 0) + Math.random()) / GY * H, st = newStroke(x, y, true); st.writes = true; st.sprout = true; sprouts.push({ s: st, n: 0, a: Math.random() * Math.PI * 2, spin: (Math.random() < .5 ? -1 : 1) * (.05 + Math.random() * .08), delay: k * 18 }); }
      S('bloom'); find('bloom'); lastBloom = performance.now();
    }
    function sproutStep() {
      for (var i = sprouts.length - 1; i >= 0; i--) {
        var sp = sprouts[i]; if (sp.delay-- > 0) continue; var s = sp.s, l = s.pts[s.pts.length - 1], F = sample(l[0], l[1], {});
        sp.a += sp.spin + (F.s > .1 ? .02 : 0); var dx = Math.cos(sp.a) * 3 + F.x * 2, dy = Math.sin(sp.a) * 3 + F.y * 2, dl = Math.hypot(dx, dy) || 1, nx = l[0] + dx / dl * 4, ny = l[1] + dy / dl * 4;
        s.pts.push([nx, ny, .7 - sp.n / 260]); s.queue.push([nx, ny, dx / dl, dy / dl, .5]); s.len += 4;
        if (sp.n % 24 === 0) S('dream', ny / H, nx / W);
        if (++sp.n > 90 || nx < 0 || ny < 0 || nx > W || ny > H) { finish(s); sprouts.splice(i, 1); }
      }
    }
    function erase(x, y, r, dx, dy, speed) {
      mc.save(); mc.globalCompositeOperation = 'destination-out'; mc.beginPath(); mc.arc(x, y, r, 0, Math.PI * 2); mc.fill(); mc.restore();
      var r2 = r * r; strokes.forEach(function (s) { s.pts.forEach(function (p) { if ((p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y) < r2) p[3] = 1; }); });
      var l = Math.hypot(dx, dy) || 1; deposit(x, y, dx / l, dy / l, clamp(r / 50, .4, 1.6) * Math.min(1, l / 8 + .2), 'erase');
      S('eraseMove', x / W, speed); find('erase'); eraseAmt += r / 40;
    }
    var eraseAmt = 0;

    // ---------- render ----------
    function drawStroke(ctx2, s, alpha, col, wmul) {
      if (alpha <= .002) return; var P = s.pts; ctx2.strokeStyle = col; ctx2.globalAlpha = alpha;
      ctx2.beginPath(); var pen = false, wsum = 0;
      for (var i = 0; i < P.length; i++) { var p = P[i]; if (p[3]) { pen = false; continue; } if (!pen) { ctx2.moveTo(p[0], p[1]); pen = true; if (P.length === 1 || (i === P.length - 1)) ctx2.lineTo(p[0] + .1, p[1]); } else ctx2.lineTo(p[0], p[1]); wsum += p[2] || 1; }
      ctx2.lineWidth = s.width * (wsum / Math.max(1, P.length)) * wmul; ctx2.stroke();
    }
    function commit(s) { var pal = PALS[palKey]; mc.save(); mc.globalCompositeOperation = 'source-over'; drawStroke(mc, s, s.writes ? .22 : s.ghost ? .1 : s.stone ? .5 : .32, pal.memory, s.stone ? 3 : 1.2); if (s.pool > .05) { var L = s.pts[s.pts.length - 1]; mc.globalAlpha = .45; mc.fillStyle = pal.memory; mc.beginPath(); mc.arc(L[0], L[1], 3 + s.pool * 9, 0, Math.PI * 2); mc.fill(); } mc.restore(); }
    var frame = 0, lastFade = performance.now(), raf = 0, lastT = performance.now(), committedOnce = false;
    function loop(now) {
      raf = requestAnimationFrame(loop); var dt = Math.min(.05, (now - lastT) / 1000); lastT = now; frame++;
      var pal = PALS[palKey], dark = pal.dark;
      reveal += ((revealHold || showField ? 1 : 0) - reveal) * Math.min(1, dt * 4); pulse = Math.max(0, pulse - dt * .5);
      if (frame % 30 === 0) diffuse(.02);
      // memory slowly fades from the surface - down to a residue it never loses
      if (now - lastFade > 1500) { lastFade = now; mc.save(); mc.setTransform(1, 0, 0, 1, 0, 0); mc.globalCompositeOperation = 'destination-out'; mc.fillStyle = 'rgba(0,0,0,.025)'; mc.fillRect(0, 0, mcv.width, mcv.height); mc.restore(); }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = pal.bg; c.fillRect(0, 0, W, H);
      // memory layer
      c.globalAlpha = 1 - reveal * .55; c.drawImage(mcv, 0, 0, W, H);
      // the field: particles carried by it leave short trails; brighter where the surface was scraped away
      var vis = .32 + reveal * .68 + pulse * .6, speedK = 60 * dt * 2.4;
      tc.save(); tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'destination-out'; tc.fillStyle = 'rgba(0,0,0,' + (reveal > .5 ? .035 : .07) + ')'; tc.fillRect(0, 0, tcv.width, tcv.height); tc.restore();
      tc.globalCompositeOperation = 'source-over'; tc.strokeStyle = pal.field; tc.lineWidth = TOUCH ? 1.2 : 1.1;
      var B = [[], [], []], f = {};
      for (var i = 0; i < PN; i++) {
        sample(px[i], py[i], f); var m = Math.hypot(f.x, f.y), x0 = px[i], y0 = py[i];
        px[i] += (f.x * 2.2 + (f.s > .05 ? -f.y * f.s * 1.5 : 0)) * speedK; py[i] += (f.y * 2.2 + (f.s > .05 ? f.x * f.s * 1.5 : 0)) * speedK; pl[i] -= 1;
        if (pl[i] < 0 || px[i] < 0 || px[i] > W || py[i] < 0 || py[i] > H || (m < .02 && f.s < .02 && pl[i] % 9 < 1)) { spawn(i); continue; }
        var lvl = Math.min(1, m * .8 + f.s * .7 + f.m * .08); if (lvl < .03) continue;
        B[lvl > .45 ? 2 : lvl > .18 ? 1 : 0].push(x0, y0, px[i], py[i]);
      }
      [.12, .3, .6].forEach(function (a, bi) { var arr = B[bi]; if (!arr.length) return; tc.globalAlpha = a; tc.beginPath(); for (var k = 0; k < arr.length; k += 4) { tc.moveTo(arr[k], arr[k + 1]); tc.lineTo(arr[k + 2] + .01, arr[k + 3]); } tc.stroke(); });
      tc.globalAlpha = 1;
      c.globalCompositeOperation = dark ? 'lighter' : 'multiply'; c.globalAlpha = Math.min(1, vis); c.drawImage(tcv, 0, 0, W, H);
      // present
      for (var si = strokes.length - 1; si >= 0; si--) {
        var s = strokes[si], age = s.end ? (now - s.end) / 1000 : 0, a = s.end ? clamp(1 - (age - HOLD) / FADE, 0, 1) : 1;
        if (s.ghost) a *= s.writes ? .8 : .55;
        if (s.end && a <= 0) { commit(s); strokes.splice(si, 1); if (!s.ghost && !committedOnce) { committedOnce = true; find('memory'); } continue; }
        var fadeIn = 1 - a;
        c.globalCompositeOperation = 'source-over'; drawStroke(c, s, fadeIn * .3, pal.memory, 1.2);
        c.globalCompositeOperation = dark ? 'lighter' : 'source-over';
        drawStroke(c, s, a * (dark ? .12 : .08), s.res ? pal.hot : pal.present, s.stone ? 9 : 5);
        drawStroke(c, s, a * (1 - reveal * .5), (s.res || s.cut || s.self) && dark ? pal.hot : s.cut ? pal.hot : pal.present, s.stone ? 3.5 : s.res ? 1.5 : s.sprout ? .7 : 1);
        if (dark && !s.end) drawStroke(c, s, .7, pal.hot, .35);
      }
      // pools and seams
      strokes.forEach(function (s2) { if (s2.pool > .05) { var L = s2.pts[s2.pts.length - 1], a2 = s2.end ? clamp(1 - ((now - s2.end) / 1000 - HOLD) / FADE, 0, 1) : 1, r = 3 + s2.pool * 9 + Math.sin(now / 300) * (s2.end ? 0 : 1.2); c.globalCompositeOperation = 'source-over'; c.globalAlpha = .85 * a2; c.fillStyle = pal.present; c.beginPath(); c.arc(L[0], L[1], r, 0, Math.PI * 2); c.fill(); c.globalAlpha = .15 * a2; c.beginPath(); c.arc(L[0], L[1], r * 2.2, 0, Math.PI * 2); c.fill(); } });
      if (seams.length) { c.globalCompositeOperation = dark ? 'lighter' : 'source-over'; c.strokeStyle = pal.hot; [[5, .07], [1.1, .55 + .15 * Math.sin(now / 900)]].forEach(function (pass) { c.lineWidth = pass[0]; c.globalAlpha = pass[1]; c.beginPath(); seams.forEach(function (sm) { sm.forEach(function (q, qi) { qi ? c.lineTo(q[0] * W, q[1] * H) : c.moveTo(q[0] * W, q[1] * H); }); }); c.stroke(); }); }
      // the scrape wipe
      if (scrapeT >= 0) { var u = (now - scrapeT) / 900; if (u > 1) scrapeT = -1; else { c.globalCompositeOperation = 'source-over'; c.globalAlpha = (1 - u) * .5; c.fillStyle = pal.bg; c.fillRect(0, 0, W * u, H); c.globalAlpha = .6 * (1 - u); c.fillStyle = pal.field; c.fillRect(W * u - 2, 0, 2, H); } }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      dreamStep(now); sproutStep();
      if (cur && !cur.ghost && cur.len > 20 && now - cur.lastMove > 700) { // stillness mid-line: ink pools
        var was = cur.pool; cur.pool = Math.min(4, cur.pool + dt * .8); if (Math.floor(was * 3) !== Math.floor(cur.pool * 3)) S('pool', cur.pool / 4, cur.pts[cur.pts.length - 1][1] / H);
      }
      if (frame % 30 === 0) { var D = depth(); S('bed', Math.min(1, D.mem * 3), Math.min(1, D.scar * 6)); }
    }

    // ---------- the dream: when left alone, it retraces its strongest currents ----------
    function dreamStep(now) {
      if (dreamer) {
        var s = dreamer.s; for (var k = 0; k < 2; k++) {
          var l = s.pts[s.pts.length - 1], F = sample(l[0], l[1], {}), m = Math.hypot(F.x, F.y);
          if (m < .06 || dreamer.n++ > 110) { finish(s); dreamer = null; return; }
          var wob = s.self ? Math.sin(dreamer.n * .21) * .5 : 0, ax = F.x / m, ay = F.y / m, nx = l[0] + (ax - ay * wob) * 6, ny = l[1] + (ay + ax * wob) * 6; s.pts.push([nx, ny, .8]); s.raw = [nx, ny]; if (s.writes) s.queue.push([nx, ny, ax, ay, .45]);
          if (dreamer.n % 14 === 0) S('dream', ny / H, nx / W);
        }
        return;
      }
      var idle = now - lastInput;
      if (idle > (stats.sessions > 1 ? 9000 : 16000) && !cur && !document.hidden && Math.random() < .01) { startDream(.35); lastInput = now - 4000; }
    }
    function startDream(min) {
      var best = -1, bi = 0; for (var id = 0; id < N; id++) { var m2 = Math.hypot(vx[id], vy[id]) * (1 + mem[id]) * (.6 + Math.random() * .8); if (m2 > best) { best = m2; bi = id; } }
      if (best < min) return false;
      var x = ((bi % GX) + .5) / GX * W, y = ((bi / GX | 0) + .5) / GY * H; dreamer = { s: newStroke(x, y, true), n: 0 }; if (stats.sessions >= 3) { dreamer.s.writes = true; dreamer.s.self = true; find('pastself'); } else find('dream'); return true;
    }

    // ---------- input ----------
    var touches = {}, erasing = null, lastTap = { t: 0, x: 0, y: 0 }, eraserMode = false;
    function tcount() { return Object.keys(touches).length; }
    function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function startErase(x, y) { endStroke(true); erasing = { x: x, y: y, t: performance.now() }; eraseAmt = 0; S('eraseStart', x / W); stats.erasures++; }
    function moveErase(x, y, r) { if (!erasing) return; var now = performance.now(), dx = x - erasing.x, dy = y - erasing.y, sp = Math.hypot(dx, dy) / Math.max(1, now - erasing.t) * 1000, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r * .4))); for (var i = 1; i <= steps; i++) erase(erasing.x + dx * i / steps, erasing.y + dy * i / steps, r, dx, dy, sp); erasing.x = x; erasing.y = y; erasing.t = now; lastInput = now; }
    function endErase() { if (!erasing) return; erasing = null; S('eraseEnd', Math.min(1, eraseAmt / 30)); if (eraseAmt > 70 && performance.now() - lastBloom > 15000) setTimeout(function () { if (!ac.signal.aborted) bloom(); }, 1400); scheduleSave(); }
    function endStroke(cancel) { if (!cur) return; var s = cur; cur = null; if (cancel && s.pts.length < 4) { strokes.splice(strokes.indexOf(s), 1); S('drawEnd'); return; } finish(s); }
    cv.addEventListener('pointerdown', function (e) {
      lastInput = performance.now(); if (panelOpen) { openPanel(false); }
      var p = pos(e);
      if (e.pointerType === 'touch') { touches[e.pointerId] = p; if (tcount() >= 2) { var m = mid(); startErase(m[0], m[1]); return; } }
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      if (e.button === 2 || eraserMode || (e.pointerType === 'pen' && e.button === 5)) { startErase(p[0], p[1]); return; }
      if (dreamer) { finish(dreamer.s); dreamer = null; }
      cur = newStroke(p[0], p[1]); cur.t = performance.now(); cur.x0 = p[0]; cur.y0 = p[1]; S('drawStart', p[0] / W, p[1] / H);
    }, sig);
    function mid() { var k = Object.keys(touches), a = touches[k[0]], b = touches[k[1]]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(a[0] - b[0], a[1] - b[1])]; }
    cv.addEventListener('pointermove', function (e) {
      var p = pos(e);
      if (e.pointerType === 'touch' && touches[e.pointerId]) { touches[e.pointerId] = p; if (tcount() >= 2) { var m = mid(); moveErase(m[0], m[1], clamp(m[2] * .35, 22, 110)); return; } }
      if (erasing) { moveErase(p[0], p[1], e.shiftKey ? 80 : 36); return; }
      if (!cur) return; lastInput = performance.now();
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];
      evs.forEach(function (ev) { var q = pos(ev), now = performance.now(); inkTo(cur, q[0], q[1], ev.pressure, now - (cur.t || now) || 16); cur.t = now; });
    }, sig);
    function up(e) {
      if (e.pointerType === 'touch') { delete touches[e.pointerId]; if (erasing) { if (tcount() === 0) endErase(); return; } }
      if (erasing) { endErase(); return; }
      if (!cur) return; var s = cur, p = pos(e), quick = performance.now() - s.born < 420;
      // a quick swipe in from a side edge turns the palette instead of drawing
      if (quick && (s.x0 < 24 || s.x0 > W - 24) && Math.abs(p[0] - s.x0) > 70) { cur = null; strokes.splice(strokes.indexOf(s), 1); S('drawEnd'); var i = PAL_KEYS.indexOf(palKey); setPal(PAL_KEYS[(i + (s.x0 < 24 ? 1 : PAL_KEYS.length - 1)) % PAL_KEYS.length]); api.whisper(PALS[palKey].name.toLowerCase()); return; }
      var tapLike = s.len < 6 && s.pts.length < 4, now = performance.now();
      if (tapLike && now - lastTap.t < 320 && Math.hypot(p[0] - lastTap.x, p[1] - lastTap.y) < 40) { cur = null; strokes.splice(strokes.indexOf(s), 1); S('drawEnd'); lastTap.t = 0; scrape(); return; }
      if (tapLike) lastTap = { t: now, x: p[0], y: p[1] };
      endStroke(e.type === 'pointercancel');
    }
    cv.addEventListener('pointerup', up, sig); cv.addEventListener('pointercancel', up, sig);
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); }, sig);
    addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName)) return; var k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); if (!revealHold) { revealHold = true; S('reveal'); find('reveal'); } }
      else if (k === 'e') { eraserMode = !eraserMode; cv.style.cursor = eraserMode ? 'cell' : 'crosshair'; api.whisper(eraserMode ? 'eraser' : 'pen'); }
      else if (k === 'f') { showField = !showField; if (showField) find('reveal'); syncPanel(); }
      else if (k === 'p') { var i = PAL_KEYS.indexOf(palKey); setPal(PAL_KEYS[(i + 1) % PAL_KEYS.length]); api.whisper(PALS[palKey].name.toLowerCase()); }
      else if (k === 'm') { var j = MOOD_KEYS.indexOf(moodKey); setMood(MOOD_KEYS[(j + 1) % MOOD_KEYS.length]); api.whisper(MOODS[moodKey].toLowerCase()); }
      else if (k === 'backspace' || k === 'delete') { e.preventDefault(); scrape(); }
    }, sig);
    addEventListener('keyup', function (e) { if (e.key === ' ') revealHold = false; }, sig);
    cv.addEventListener('dblclick', function (e) { e.preventDefault(); }, sig);
    var G2 = api.gestures ? api.gestures(cv, function (type, d) {
      switch (type) {
        case 'longpress': endStroke(true); revealHold = true; S('reveal'); find('reveal'); break;
        case 'longend': revealHold = false; break;
        case 'threetap': endErase(); if (!dreamer && !startDream(.08)) api.whisper('nothing to dream yet'); break;
        case 'twotap': pulse = 1; S('reveal'); find('reveal'); break;
      }
    }) : null;

    function scrape() {
      strokes.forEach(function (s) { if (s !== cur) s.end = s.end || performance.now(); s.pts.forEach(function (p) { p[3] = 1; }); }); strokes = strokes.filter(function (s) { return s === cur; });
      mc.save(); mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, mcv.width, mcv.height); mc.restore();
      scrapeT = performance.now(); pulse = 1; S('scrape'); find('scrape'); scheduleSave();
    }
    function setPal(k) { if (!PALS[k]) return; palKey = k; savePref(); api.tone(PALS[k].dark ? 'dark' : 'light'); syncPanel(); }
    function setMood(k) { if (!MOODS[k]) return; moodKey = k; savePref(); S('setMood', k); syncPanel(); }

    // ---------- persistence: IndexedDB for the field and the surface ----------
    var db = null, saveT = 0, dirty = false, lastImg = null;
    function openDB(cb) { try { var r = indexedDB.open('systemblue-lab', 1); r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function () { db = r.result; cb(); }; r.onerror = function () { cb(); }; } catch (e) { cb(); } }
    function scheduleSave() { dirty = true; clearTimeout(saveT); saveT = setTimeout(save, 2500); }
    function save(sync) {
      if (!db || !dirty) return; dirty = false;
      var rec = { v: 1, GX: GX, GY: GY, vx: vx.slice(), vy: vy.slice(), mem: mem.slice(), scar: scar.slice(), stats: stats, seams: seams, img: lastImg };
      function put() { try { db.transaction('kv', 'readwrite').objectStore('kv').put(rec, '02'); } catch (e) {} }
      if (sync) { put(); return; }
      try {
        var sc = Math.min(1, 900 / mcv.width), t = document.createElement('canvas'); t.width = Math.round(mcv.width * sc); t.height = Math.round(mcv.height * sc); t.getContext('2d').drawImage(mcv, 0, 0, t.width, t.height);
        t.toBlob(function (b) { if (b) { rec.img = lastImg = b; } put(); }, 'image/png');
      } catch (e) { put(); }
    }
    function forget() {
      vx.fill(0); vy.fill(0); mem.fill(0); scar.fill(0); stats = { strokes: 0, erasures: 0, sessions: 1, since: Date.now() };
      strokes = []; seams = []; stones = []; sprouts = []; cur = null; dreamer = null; tc.save(); tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, tcv.width, tcv.height); tc.restore(); mc.save(); mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, mcv.width, mcv.height); mc.restore();
      lastImg = null; try { if (db) db.transaction('kv', 'readwrite').objectStore('kv').delete('02'); } catch (e) {}
      api.whisper('forgotten'); syncPanel();
    }
    openDB(function () {
      if (!db) return;
      try {
        var g = db.transaction('kv').objectStore('kv').get('02');
        g.onsuccess = function () {
          var r = g.result; if (!r || r.GX !== GX || ac.signal.aborted) return;
          // anything drawn before the record arrived is merged on top of it
          for (var i = 0; i < N; i++) { vx[i] += r.vx[i]; vy[i] += r.vy[i]; mem[i] = Math.min(4, mem[i] + r.mem[i]); scar[i] = Math.min(3, scar[i] + r.scar[i]); }
          lastImg = r.img || null; seams = (r.seams || []).concat(seams); stats = r.stats || stats; stats.sessions = (stats.sessions || 1) + 1;
          if (r.img) { var u = URL.createObjectURL(r.img), im = new Image(); im.onload = function () { mc.save(); mc.globalCompositeOperation = 'destination-over'; mc.globalAlpha = .8; mc.drawImage(im, 0, 0, W, H); mc.restore(); URL.revokeObjectURL(u); }; im.src = u; }
          if (depth().mem > .002) { setTimeout(function () { if (!ac.signal.aborted) { pulse = 1; find('ret'); } }, 1600); }
          dirty = true; save(true); syncPanel();
        };
      } catch (e) {}
    });
    addEventListener('pagehide', function () { save(true); }, sig);

    // ---------- panel ----------
    var slot = api.slot && api.slot(), panel = null, ctl = {}, panelOpen = false;
    function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
    function seg(label, keys, names, get, set) {
      var r = el('div', 'icrow'), sg = el('div', 'icseg'); r.appendChild(el('span', 'iclab', label)); r.appendChild(sg);
      var bs = keys.map(function (k) { var b = el('button', null, names[k]); b.type = 'button'; b.addEventListener('click', function () { set(k); }); sg.appendChild(b); return b; });
      panel.appendChild(r); return function () { bs.forEach(function (b, i) { b.setAttribute('aria-pressed', keys[i] === get() ? 'true' : 'false'); }); };
    }
    if (slot) {
      var wrap = el('div', 'icpick'), btn = el('button', 'hudbtn'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(el('span', 'icglyph')); btn.appendChild(el('span', null, 'LAYERS'));
      panel = el('div', 'icpanel'); panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Layers and history');
      ctl.card = el('div'); ctl.card.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-variant-numeric:tabular-nums;margin-bottom:4px'; panel.appendChild(ctl.card);
      var r1 = el('div', 'icrow'); r1.appendChild(el('span', 'iclab', 'Palette')); var sw = el('div', 'icsw'); r1.appendChild(sw); panel.appendChild(r1);
      ctl.pals = PAL_KEYS.map(function (k) { var p = PALS[k], b = el('button', 'icchip'); b.type = 'button'; b.title = p.name; b.setAttribute('aria-label', p.name); b.style.background = 'linear-gradient(135deg,' + p.bg + ' 0 50%,' + p.present + ' 50% 72%,' + p.memory + ' 72%)'; b.addEventListener('click', function () { setPal(k); }); sw.appendChild(b); return b; });
      ctl.sMood = seg('Sound', MOOD_KEYS, MOODS, function () { return moodKey; }, setMood);
      ctl.sWeight = seg('History', WEIGHT_KEYS, { light: 'Light', heavy: 'Heavy', absolute: 'Absolute' }, function () { return weightKey; }, function (k) { weightKey = k; savePref(); syncPanel(); });
      ctl.sField = seg('Field', ['hidden', 'shown'], { hidden: 'Hidden', shown: 'Shown' }, function () { return showField ? 'shown' : 'hidden'; }, function (k) { showField = k === 'shown'; if (showField) find('reveal'); syncPanel(); });
      ctl.sTool = seg('Tool', ['pen', 'eraser'], { pen: 'Pen', eraser: 'Eraser' }, function () { return eraserMode ? 'eraser' : 'pen'; }, function (k) { eraserMode = k === 'eraser'; cv.style.cursor = eraserMode ? 'cell' : 'crosshair'; syncPanel(); });
      var foot = el('div', 'icfoot');
      ctl.scrape = el('button', 'iccopy', 'SCRAPE SURFACE'); ctl.scrape.style.marginLeft = '0'; ctl.scrape.type = 'button'; ctl.scrape.addEventListener('click', function () { scrape(); openPanel(false); }); foot.appendChild(ctl.scrape);
      ctl.png = el('button', 'iccopy', 'SAVE PNG'); ctl.png.type = 'button'; ctl.png.addEventListener('click', function () { try { cv.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'palimpsest.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); }); } catch (er) {} }); foot.appendChild(ctl.png);
      ctl.forget = el('button', 'iccopy', 'FORGET'); ctl.forget.type = 'button'; var armed = 0;
      ctl.forget.addEventListener('click', function () { if (!armed) { armed = setTimeout(function () { armed = 0; ctl.forget.textContent = 'FORGET'; }, 3000); ctl.forget.textContent = 'FORGET ALL?'; return; } clearTimeout(armed); armed = 0; ctl.forget.textContent = 'FORGET'; forget(); }); foot.appendChild(ctl.forget);
      panel.appendChild(foot);
      wrap.appendChild(btn); wrap.appendChild(panel); slot.appendChild(wrap); ctl.btn = btn;
      btn.addEventListener('click', function () { openPanel(panel.hidden); });
      document.addEventListener('pointerdown', function (e) { if (panelOpen && !wrap.contains(e.target) && e.target !== cv) openPanel(false); }, sig);
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { openPanel(false); btn.focus(); e.stopPropagation(); } }, { capture: true, signal: ac.signal });
    }
    function openPanel(o) { if (!panel) return; panelOpen = o; panel.hidden = !o; ctl.btn.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) syncPanel(); }
    function syncPanel() {
      if (!panel || !panelOpen) return; var D = depth();
      var since = new Date(stats.since || Date.now()), rows = [['Lines', String(stats.strokes)], ['Erasures', String(stats.erasures)], ['Field depth', Math.round(Math.min(1, D.mem * 3) * 100) + '%'], ['Scarred', Math.round(Math.min(1, D.scar * 6) * 100) + '%'], ['Visits', String(stats.sessions)], ['First line', since.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })]];
      ctl.card.innerHTML = ''; rows.forEach(function (r) { var a = el('span', 'iclab', r[0]), b = el('span', null, r[1]); ctl.card.appendChild(a); ctl.card.appendChild(b); });
      ctl.pals.forEach(function (b, i) { b.setAttribute('aria-pressed', PAL_KEYS[i] === palKey ? 'true' : 'false'); });
      ctl.sMood(); ctl.sWeight(); ctl.sField(); ctl.sTool();
    }
    var panelTick = setInterval(function () { if (panelOpen) syncPanel(); }, 1000);

    // ---------- start ----------
    api.tone(PALS[palKey].dark ? 'dark' : 'light');
    addEventListener('resize', function () { size(); }, sig);
    raf = requestAnimationFrame(loop);
    if (SBL.debug) SBL._02 = { sample: sample, depth: depth, stats: function () { return stats; }, strokes: function () { return strokes; }, field: { vx: vx, vy: vy, mem: mem, scar: scar }, draw: function (pts) { cur = newStroke(pts[0][0], pts[0][1]); cur.x0 = pts[0][0]; cur.t = performance.now(); for (var i = 1; i < pts.length; i++) inkTo(cur, pts[i][0], pts[i][1], .5, 16); var s = cur; endStroke(false); return s; }, erase: function (pts, r) { startErase(pts[0][0], pts[0][1]); pts.forEach(function (p) { moveErase(p[0], p[1], r || 40); }); endErase(); }, save: function () { dirty = true; save(true); }, found: found };

    return function unmount() {
      if (cur) endStroke(false); strokes.forEach(commit); dirty = true; save(false);
      ac.abort(); cancelAnimationFrame(raf); clearInterval(panelTick); clearTimeout(saveT); if (G2) G2(); S('stop');
    };
  }
});
