/* 09 - The Collective. An artwork about the limits of control.
   1,000-5,000 autonomous agents (boids: separation, alignment, cohesion) with four temperaments:
   gregarious (seek proximity), solitary (prefer isolation), imitators (copy neighbours), contrarians (move against the majority).
   The viewer can move (a direction), click (a temporary leader) and hold (pressure). The collective decides whether to follow:
   persuasion spreads between neighbours, and every agent tires of being pushed. Aggressive control raises a global pressure
   that splits the collective into independent groups (nested clans, so splits and reunions are clean); left alone, they reunite.
   Spatial hashing keeps neighbour lookup cheap. */
SBL.register('09', {
  mount: function (stage, api) {
    'use strict';
    var ac = new AbortController(), sig = { signal: ac.signal }, TOUCH = !!api.touch;
    var W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 2);
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

    // ---------- settings ----------
    var store = {}; try { store = JSON.parse(localStorage.getItem('sbl-09') || '{}') || {}; } catch (e) {}
    var POPS = { few: TOUCH ? 800 : 1000, many: TOUCH ? 1600 : 2500, swarm: TOUCH ? 2800 : 5000 }, POP_KEYS = Object.keys(POPS);
    var MIXES = { balanced: [.4, .15, .35, .1], conformist: [.46, .05, .46, .03], dissenting: [.25, .3, .2, .25] }, MIX_KEYS = Object.keys(MIXES);
    var PALS = {
      murmur: { name: 'Murmur', bg: '#07080c', ink: '#dfe6f2', acc: '#ff6a3d', lead: '#ffffff', clans: ['#7aa2ff', '#ff7a59', '#5fe0b5', '#ffd166', '#c792ff', '#ff5fa2', '#4fd1ff', '#b8f35b'], dark: true },
      dusk: { name: 'Dusk', bg: '#160f1c', ink: '#ffd9c2', acc: '#5ef0ff', lead: '#fff4ea', clans: ['#ff9a76', '#ffd36e', '#e86fa7', '#a06cff', '#ff6b6b', '#f9a8d4', '#fbbf24', '#fb7185'], dark: true },
      paper: { name: 'Paper', bg: '#eeeae2', ink: '#1a1a1a', acc: '#e0301e', lead: '#000000', clans: ['#1f4fbf', '#d6402b', '#2f8f5b', '#c9971a', '#7b3fbf', '#c2367a', '#1b8fb0', '#5d7a12'], dark: false }
    };
    var PAL_KEYS = Object.keys(PALS);
    var popKey = POPS[store.pop] ? store.pop : 'many', mixKey = MIXES[store.mix] ? store.mix : 'balanced', palKey = PALS[store.pal] ? store.pal : 'murmur', trails = store.trails !== false;
    var visits = (store.visits || 0) + 1, lastTrust = store.trust == null ? 1 : store.trust;
    function persist(trust) { try { localStorage.setItem('sbl-09', JSON.stringify({ pop: popKey, mix: mixKey, pal: palKey, trails: trails, visits: visits, trust: trust == null ? lastTrust : trust })); } catch (e) {} }
    persist();

    // ---------- temperaments: [separation, alignment, cohesion, personal space, response to the viewer, speed] ----------
    var TEMP = [[1.4, .9, 1.1, 1, 1, 2.3], [2.4, .25, .08, 1.9, .25, 1.9], [1.2, 1.7, .7, 1, 1.25, 2.5], [1.3, -.55, .45, 1, -.85, 2.7]];
    var TNAME = ['gregarious', 'solitary', 'imitator', 'contrarian'];

    // ---------- agents ----------
    var MAXN = 5000, N = 0;
    var x = new Float32Array(MAXN), y = new Float32Array(MAXN), vx = new Float32Array(MAXN), vy = new Float32Array(MAXN), ax = new Float32Array(MAXN), ay = new Float32Array(MAXN);
    var tag = new Uint8Array(MAXN), type = new Uint8Array(MAXN), clan = new Uint8Array(MAXN), resp = new Float32Array(MAXN), pers = new Float32Array(MAXN), npers = new Float32Array(MAXN);
    function populate(n, keep) {
      var mix = MIXES[mixKey], start = keep ? Math.min(N, n) : 0;
      for (var i = start; i < n; i++) {
        var a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Math.min(W, H) * .32;
        x[i] = W / 2 + Math.cos(a) * r; y[i] = H / 2 + Math.sin(a) * r; var h = Math.random() * Math.PI * 2; vx[i] = Math.cos(h) * 1.5; vy[i] = Math.sin(h) * 1.5;
        clan[i] = Math.floor(Math.random() * 8); resp[i] = clamp(lastTrust + (Math.random() - .5) * .1, .05, 1); pers[i] = 0;
      }
      N = n; retype();
    }
    function retype() { var mix = MIXES[mixKey]; for (var i = 0; i < N; i++) { var u = ((i * 2654435761) >>> 0) / 4294967296, acc = 0, t = 0; for (; t < 3; t++) { acc += mix[t]; if (u < acc) break; } type[i] = t; } }

    // ---------- spatial hash ----------
    var R = 38, GW, GH, cellStart, cellCount, sorted = new Int32Array(MAXN), cellOf = new Int32Array(MAXN);
    function grid() { GW = Math.ceil(W / R) + 1; GH = Math.ceil(H / R) + 1; cellStart = new Int32Array(GW * GH + 1); cellCount = new Int32Array(GW * GH); }
    function hashAll() {
      cellCount.fill(0);
      for (var i = 0; i < N; i++) { var cx = clamp((x[i] / R) | 0, 0, GW - 1), cy = clamp((y[i] / R) | 0, 0, GH - 1), c = cy * GW + cx; cellOf[i] = c; cellCount[c]++; }
      var s = 0; for (var k = 0; k < GW * GH; k++) { cellStart[k] = s; s += cellCount[k]; } cellStart[GW * GH] = s;
      var fill = new Int32Array(GW * GH); for (var j = 0; j < N; j++) { var c2 = cellOf[j]; sorted[cellStart[c2] + fill[c2]++] = j; }
    }

    // ---------- the viewer, and the collective's state ----------
    var P = { x: W / 2, y: H / 2, vx: 0, vy: 0, inside: false, down: false, downT: 0, stillT: 0, lastMove: 0, moved: 0 };
    var dirX = 0, dirY = 0, dirK = 0;            // the direction the viewer is proposing (decays)
    var pressure = 0;                             // aggression, 0..1+
    var level = 0;                                // fragmentation level 0..3 -> 1, 2, 4, 8 groups
    var leaders = [], clicks = [], elected = -1, electedT = 0, exodus = 0, exodusOn = false, lure = 0, lastInput = performance.now();
    var stats = { follow: 0, trust: 1, groups: 1, order: 0, speed: 0 };
    // momentary disturbances, each a different kind of answer to a tap
    var ripples = [], seeds = [], warms = [], vortex = { x: 0, y: 0, k: 0 }, tilt = { x: 0, y: 0, on: false }, implode = null, rhythm = { on: false, period: 0, next: 0, left: 0, phase: 0 }, taps = [], lastPath = [], claimT = 0, scoutT = 0, lassoFlash = null, beatFlash = 0;

    // ---------- discoveries ----------
    var FINDS = { startle: 'startled: a wave goes through them', seed: 'one alone becomes a meeting place', convert: 'a contrarian convinced its neighbours', dethrone: 'you knocked over their leader', schism: 'a leader, divided', echo: 'they repeat what you did', rhythm: 'they keep your time', scout: 'one came back to look', implode: 'drawn in, then flung out', hunt: 'a stranger, and they hunted it', vortex: 'you turned the whole sky', temper: 'their temper changed', tilt: 'downhill, mostly', shake: 'shaking them never works', gust: 'a gust', warm: 'rubbing warms them; they huddle', lasso: 'claimed, briefly', turn: 'they turned with you', follow: 'it followed you', refuse: 'it is tired of being told', leader: 'a leader, for now', mutiny: 'they chose no one', fragment: 'too much control, and it splits', reunite: 'left alone, it becomes one again', dissent: 'someone always disagrees', lure: 'it comes when you stop calling', elected: 'it chose its own', mill: 'a mill: going nowhere, together', exodus: 'they left', memory: 'it remembers how you treated it' };
    var KEYS = Object.keys(FINDS), found = {};
    api.pips(KEYS.length);
    function find(k) { if (found[k]) return; found[k] = 1; api.light(KEYS.indexOf(k)); api.whisper(FINDS[k]); }

    // ---------- sound ----------
    var snd = null;
    try { var A = api.audio && api.audio(); if (A && SBL.collectiveSound) snd = SBL.collectiveSound(A); } catch (e) { snd = null; }
    function S(name) { if (!snd) return; try { return snd[name].apply(snd, [].slice.call(arguments, 1)); } catch (e) {} }

    // ---------- canvas ----------
    var cv = document.createElement('canvas'), c = cv.getContext('2d', { alpha: false });
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'A field of autonomous agents that may or may not follow you');
    stage.appendChild(cv);
    function size() { var ow = W, oh = H; W = innerWidth; H = innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); c.setTransform(DPR, 0, 0, DPR, 0, 0); grid(); if (ow !== W || oh !== H) for (var i = 0; i < N; i++) { x[i] = x[i] / ow * W; y[i] = y[i] / oh * H; } c.fillStyle = PALS[palKey].bg; c.fillRect(0, 0, W, H); }
    size(); populate(POPS[popKey]);
    if (lastTrust < .55 && visits > 1) setTimeout(function () { if (!ac.signal.aborted) find('memory'); }, 2500);

    // ---------- simulation ----------
    function groupOf(i) { return clan[i] >> (3 - level); }
    var drX = new Float32Array(8), drY = new Float32Array(8), gCount = new Float32Array(8), gX = new Float32Array(8), gY = new Float32Array(8), tmpTX = new Float32Array(8), tmpTY = new Float32Array(8);
    function step(dt) {
      hashAll();
      // group centroids (the groups as wholes): members are drawn to their own, and pushed from the others
      var ng = 1 << level; gCount.fill(0); gX.fill(0); gY.fill(0);
      for (var gi = 0; gi < N; gi += 2) { if (x[gi] < -60 || x[gi] > W + 60 || y[gi] < -60 || y[gi] > H + 60) continue; var gg = groupOf(gi); gCount[gg]++; gX[gg] += x[gi]; gY[gg] += y[gi]; }
      for (var gk = 0; gk < ng; gk++) if (gCount[gk]) { gX[gk] /= gCount[gk]; gY[gk] /= gCount[gk]; }
      // where each group would like to be: one wandering home when united, separate territories when split
      var tsec = performance.now() / 1000, gTX = tmpTX, gTY = tmpTY, F0 = clamp(pressure, 0, 1.2);
      for (var gt = 0; gt < ng; gt++) {
        // (drift: each group is carried toward its territory as a whole)
 var th = gt / ng * 6.283 + tsec * .05, sp2 = Math.min(W, H) * .3 * Math.min(1, F0 * 1.2) * (ng > 1 ? 1 : 0); var wv = 1 - Math.min(1, F0) * .7; gTX[gt] = W / 2 + Math.cos(th) * sp2 * 1.3 + Math.sin(tsec * .13 + gt) * W * .14 * wv; gTY[gt] = H / 2 + Math.sin(th) * sp2 + Math.cos(tsec * .11 + gt * 1.7) * H * .12 * wv; var dk = gCount[gt] ? (ng > 1 ? .006 * Math.min(1, F0 * 1.4) : .0015) : 0; drX[gt] = clamp((gTX[gt] - gX[gt]) * dk, -1.6, 1.6); drY[gt] = clamp((gTY[gt] - gY[gt]) * dk, -1.6, 1.6); }
      var now = performance.now(), F = clamp(pressure, 0, 1.2), cross = clamp(1 - F * 1.6, .02, 1), interSep = 1 + F * 1.4, k60 = dt * 60;
      var pmoving = Math.hypot(P.vx, P.vy), dmag = Math.hypot(dirX, dirY) || 1, dnx = dirX / dmag, dny = dirY / dmag;
      var holdR = 90 + Math.min(260, (now - P.downT) * .12), avgP = 0, avgR = 0, polX = 0, polY = 0, spd = 0, Lf = leaders.length;
      var exodusK = exodusOn ? 1 : 0, lureOn = lure > .2;
      for (var i = 0; i < N; i++) {
        var t = type[i], TP = TEMP[t], px = x[i], py = y[i], pvx = vx[i], pvy = vy[i], g = groupOf(i);
        var sepX = 0, sepY = 0, aliX = 0, aliY = 0, cohX = 0, cohY = 0, wsum = 0, n = 0, pSum = 0, pN = 0, sd = 9 * TP[3], sd2 = sd * sd;
        var gx = (px / R) | 0, gy = (py / R) | 0;
        // sample neighbours evenly across the 3x3 cells, so a crowded cell does not hide the others
        var tot = 0, c0 = 0; for (var oy = -1; oy <= 1; oy++) { var cy0 = gy + oy; if (cy0 < 0 || cy0 >= GH) continue; for (var ox = -1; ox <= 1; ox++) { var cx0 = gx + ox; if (cx0 < 0 || cx0 >= GW) continue; var ce = cy0 * GW + cx0; tot += cellStart[ce + 1] - cellStart[ce]; } }
        var stride = Math.max(1, Math.ceil(tot / 26)), off = i % stride, cnt = 0;
        for (var oy2 = -1; oy2 <= 1; oy2++) {
          var cyy = gy + oy2; if (cyy < 0 || cyy >= GH) continue;
          for (var ox2 = -1; ox2 <= 1; ox2++) {
            var cxx = gx + ox2; if (cxx < 0 || cxx >= GW) continue; var cell = cyy * GW + cxx;
            for (var k = cellStart[cell], e = cellStart[cell + 1]; k < e; k++) {
              if ((cnt++ % stride) !== off) continue;
              var j = sorted[k]; if (j === i) continue; var dx = px - x[j], dy = py - y[j], d2 = dx * dx + dy * dy; if (d2 > R * R) continue;
              n++; var same = groupOf(j) === g, w = same ? 1 : cross;
              if (d2 < sd2 * (same ? 1 : interSep * interSep)) { var inv = stride / (d2 + 1); sepX += dx * inv * (same ? 1 : interSep); sepY += dy * inv * (same ? 1 : interSep); }
              aliX += vx[j] * w; aliY += vy[j] * w; cohX += x[j] * w; cohY += y[j] * w; wsum += w; pSum += pers[j]; pN++;
            }
          }
        }
        var fx = sepX * TP[0] * 9, fy = sepY * TP[0] * 9;
        if (wsum > 0) {
          aliX /= wsum; aliY /= wsum; fx += (aliX - pvx) * TP[1] * .08; fy += (aliY - pvy) * TP[1] * .08;
          cohX = cohX / wsum - px; cohY = cohY / wsum - py; fx += cohX * TP[2] * .006; fy += cohY * TP[2] * .006;
        }
        if (gCount[g]) { var gdx = gX[g] - px, gdy = gY[g] - py; var gk2 = .0006 * (1 + F * 4) * (TP[2] + .15); fx += gdx * gk2; fy += gdy * gk2; }
        if (level > 0) for (var og = 0; og < ng; og++) { if (og === g || !gCount[og]) continue; var odx = px - gX[og], ody = py - gY[og], od = Math.sqrt(odx * odx + ody * ody); if (od < 340) { var rep = (1 - od / 340) * .07 * F; fx += odx / (od + 1) * rep; fy += ody / (od + 1) * rep; } }
        // persuasion: exposure to the viewer, and contagion between neighbours
        var pdx = px - P.x, pdy = py - P.y, pd = Math.sqrt(pdx * pdx + pdy * pdy), expo = 0;
        if (pmoving > .35 && P.inside && pd < 260) expo = (1 - pd / 260) * Math.min(1, pmoving / 4);
        var neigh = pN ? pSum / pN : 0, conform = t === 2 ? 1.6 : t === 0 ? 1 : t === 1 ? .2 : .6;
        var dp = neigh - pers[i]; pers[i] = clamp(pers[i] + dt * (expo * resp[i] * 3 * (1 - Math.min(1, F) * .7) + (dp > 0 ? dp * 2.2 * conform * (1 - Math.min(1, F) * .85) : dp * .25) - .045 - (1 - resp[i]) * .1 - Math.min(1, F) * .45), 0, 1);
        if (expo > 0) resp[i] = Math.max(.03, resp[i] - expo * dt * (.12 + F * .45)); else resp[i] = Math.min(1, resp[i] + dt * .006 * (now - lastInput > 3000 ? 3 : 1));
        if (dirK > .02) { var inf = pers[i] * TP[4] * dirK * .09; fx += dnx * inf; fy += dny * inf; }
        // leaders
        for (var L = 0; L < Lf; L++) {
          var ld = leaders[L], ldx = ld.x - px, ldy = ld.y - py, ldd = Math.sqrt(ldx * ldx + ldy * ldy);
          if (ldd < ld.reach) { var lw = (ld.mob || ld.prey ? 2.2 : (t === 3 ? -.6 : t === 1 ? .15 : t === 2 ? 1.3 : 1) * resp[i]) * ld.life; fx += ldx / (ldd + 1) * lw * .09 + (ld.vx - pvx) * lw * .02; fy += ldy / (ldd + 1) * lw * .09 + (ld.vy - pvy) * lw * .02; }
        }
        if (elected >= 0 && i !== elected) { var edx = x[elected] - px, edy = y[elected] - py, ed = Math.sqrt(edx * edx + edy * edy); if (ed < 260 && t !== 3) { fx += edx / (ed + 1) * .025 + (vx[elected] - pvx) * .015; fy += edy / (ed + 1) * .025 + (vy[elected] - pvy) * .015; } }
        // pressure: holding pushes outward and crowds the edge of the ring
        if (P.down && pd < holdR) { var pk = (1 - pd / holdR) * .9; fx += pdx / (pd + 1) * pk; fy += pdy / (pd + 1) * pk; }
        // the lure: stillness draws them into an orbit
        if (lureOn && pd < 480 && t !== 1) { var want = 70, rr = (pd - want) / 120, lk = lure * resp[i] * (t === 3 ? .3 : 1); fx += (-pdx / (pd + 1) * rr * .25 - pdy / (pd + 1) * .12) * lk; fy += (-pdy / (pd + 1) * rr * .25 + pdx / (pd + 1) * .12) * lk; }
        // exodus: under sustained pressure they leave
        if (exodusK && tag[i] !== 2) { var ex = px - P.x, ey = py - P.y, el = Math.sqrt(ex * ex + ey * ey) + 1; fx += ex / el * .35; fy += ey / el * .35; }
        // edges: turn back softly (unless leaving), come home if outside
        var m = 50;
        if (!exodusK || tag[i] === 2) { if (px < m) fx += (m - px) * .006; if (px > W - m) fx -= (px - W + m) * .006; if (py < m) fy += (m - py) * .006; if (py > H - m) fy -= (py - H + m) * .006; if (px < -40 || px > W + 40 || py < -40 || py > H + 40) { fx += (W / 2 - px) * .0006; fy += (H / 2 - py) * .0006; } }
        // ripples (startle waves and bursts)
        for (var rq = 0; rq < ripples.length; rq++) { var rp = ripples[rq], rdx = px - rp.x, rdy = py - rp.y, rd = Math.sqrt(rdx * rdx + rdy * rdy), band = Math.abs(rd - rp.r); if (band < 34) { var rk = (1 - band / 34) * rp.s; fx += rdx / (rd + 1) * rk; fy += rdy / (rd + 1) * rk; } }
        // seeds: an isolated agent becomes a meeting place
        for (var sq = 0; sq < seeds.length; sq++) { var sd0 = seeds[sq], sdx = sd0.x - px, sdy = sd0.y - py, sdd = Math.sqrt(sdx * sdx + sdy * sdy); if (sdd < 340 && t !== 1) { var sk = sd0.life * (t === 3 ? -.4 : 1) * .07; fx += sdx / (sdd + 1) * sk + (-sdy / (sdd + 1)) * sk * .5; fy += sdy / (sdd + 1) * sk + (sdx / (sdd + 1)) * sk * .5; } }
        // warmth: they slow down and huddle
        for (var wq = 0; wq < warms.length; wq++) { var wm = warms[wq], wdx = wm.x - px, wdy = wm.y - py, wd = Math.sqrt(wdx * wdx + wdy * wdy); if (wd < 160) { var wk = wm.life * (1 - wd / 160); fx += wdx * .004 * wk - pvx * .08 * wk; fy += wdy * .004 * wk - pvy * .08 * wk; } }
        // a vortex (two fingers turning, or the wheel)
        if (vortex.k) { var vdx = px - vortex.x, vdy = py - vortex.y, vd = Math.sqrt(vdx * vdx + vdy * vdy) + 30; fx += -vdy / vd * vortex.k * .5 - vdx / vd * Math.abs(vortex.k) * .05; fy += vdx / vd * vortex.k * .5 - vdy / vd * Math.abs(vortex.k) * .05; }
        // tilt: downhill for most; contrarians climb
        if (tilt.on) { var tk = t === 3 ? -.6 : t === 1 ? .4 : 1; fx += tilt.x * tk; fy += tilt.y * tk; }
        // implosion: drawn in, then flung out
        if (implode) { var idx = implode.x - px, idy = implode.y - py, idd = Math.sqrt(idx * idx + idy * idy); if (idd < 360) { fx += idx / (idd + 1) * .5; fy += idy / (idd + 1) * .5; } }
        // claimed by a lasso: follow the hand, until they don't
        if (tag[i] === 1) { var cdx = P.x - px, cdy = P.y - py, cd = Math.sqrt(cdx * cdx + cdy * cdy); fx += cdx / (cd + 1) * .35 - pvx * .03; fy += cdy / (cd + 1) * .35 - pvy * .03; }
        // a little restlessness
        fx += (Math.random() - .5) * .05; fy += (Math.random() - .5) * .05;
        ax[i] = fx; ay[i] = fy; npers[i] = neigh;
        avgP += pers[i]; avgR += resp[i];
      }
      for (var q = 0; q < N; q++) {
        var tp = TEMP[type[q]], nvx = vx[q] + ax[q] * k60, nvy = vy[q] + ay[q] * k60, sp = Math.sqrt(nvx * nvx + nvy * nvy), mx = tp[5] * (1 + F * .35) * (exodusOn ? 1.8 : 1), mn = .6;
        if (sp > mx) { nvx *= mx / sp; nvy *= mx / sp; sp = mx; } else if (sp < mn) { nvx *= mn / (sp + .001); nvy *= mn / (sp + .001); sp = mn; }
        vx[q] = nvx; vy[q] = nvy; var gq = groupOf(q), dsol = type[q] === 1 ? .3 : 1; x[q] += (nvx + drX[gq] * dsol) * k60; y[q] += (nvy + drY[gq] * dsol) * k60; polX += nvx / (sp + .001); polY += nvy / (sp + .001); spd += sp;
      }
      stats.follow = avgP / N; stats.trust = avgR / N; stats.order = Math.hypot(polX, polY) / N; stats.speed = clamp(spd / N / 3.5, 0, 1);
    }

    // ---------- leaders ----------
    function addLeader(px, py) {
      var now = performance.now(); clicks = clicks.filter(function (t) { return now - t < 5000; }); clicks.push(now); pressure = Math.min(1.3, pressure + .07);
      var h = Math.hypot(P.vx, P.vy) > 1 ? Math.atan2(P.vy, P.vx) : Math.random() * Math.PI * 2;
      var L = { x: px, y: py, vx: Math.cos(h) * 2.4, vy: Math.sin(h) * 2.4, life: 1, reach: 170, age: 0, mob: false, h: h };
      if (clicks.length >= 4) { leaders.forEach(function (o) { o.mob = true; o.reach = 400; }); L.mob = true; L.reach = 400; S('mutiny'); find('mutiny'); }
      leaders.push(L); if (leaders.length > 5) leaders.shift();
      S('leader', px / W, py / H); find('leader');
      setTimeout(function () { if (ac.signal.aborted) return; var n = 0; for (var i = 0; i < N; i += 4) if (Math.hypot(x[i] - L.x, y[i] - L.y) < 120) n++; if (n > 12) S('answer', n, L.x / W, L.y / H); else S('ignored', L.x / W); }, 1400);
    }
    function stepLeaders(dt) {
      for (var i = leaders.length - 1; i >= 0; i--) {
        var L = leaders[i]; L.age += dt;
        if (L.path) { // an echo: it walks your last gesture
          L.pi = (L.pi || 0) + dt * 40; var pk = Math.floor(L.pi); if (pk >= L.path.length - 1) { L.life = 0; } else { var a = L.path[pk], b = L.path[pk + 1], u = L.pi - pk; var nx = a[0] + (b[0] - a[0]) * u, ny = a[1] + (b[1] - a[1]) * u; L.vx = (nx - L.x) / Math.max(dt * 60, .1); L.vy = (ny - L.y) / Math.max(dt * 60, .1); L.x = nx; L.y = ny; }
          L.life -= dt * .02; if (L.life <= 0) leaders.splice(i, 1); continue;
        }
        if (L.prey) { // a stranger: it flees whoever is nearest, until caught
          var near = 0, fxp = 0, fyp = 0; for (var q = 0; q < N; q += 3) { var dx = x[q] - L.x, dy = y[q] - L.y, d2 = dx * dx + dy * dy; if (d2 < 3600) { fxp -= dx / (d2 + 1) * 40; fyp -= dy / (d2 + 1) * 40; if (d2 < 400) near++; } }
          L.vx += fxp * .05; L.vy += fyp * .05; if (near * 3 > 26) { L.life = 0; ripples.push({ x: L.x, y: L.y, r: 4, v: 260, s: .6, life: 1 }); S('caught', L.x / W); }
        }
        L.h += (Math.random() - .5) * .25; L.vx += Math.cos(L.h) * .08; L.vy += Math.sin(L.h) * .08; var s = Math.hypot(L.vx, L.vy), ms = L.prey ? 3.2 : 2.6; if (s > ms) { L.vx *= ms / s; L.vy *= ms / s; }
        L.x += L.vx * dt * 60; L.y += L.vy * dt * 60; if (L.x < 40 || L.x > W - 40) { L.vx *= -1; L.h = Math.PI - L.h; } if (L.y < 40 || L.y > H - 40) { L.vy *= -1; L.h = -L.h; }
        L.life -= dt * (L.mob ? .45 : L.prey ? .05 : .12); if (L.life <= 0) leaders.splice(i, 1);
      }
    }

    // ---------- render ----------
    var frame = 0, raf = 0, lastT = performance.now(), dissentShown = 0, groupsHist = 1, millT = 0, prevLevel = 0;
    function render(now) {
      var pal = PALS[palKey], F = clamp(pressure, 0, 1);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = trails ? (pal.dark ? .26 : .32) : 1; c.fillStyle = pal.bg; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
      var showClans = level > 0, showDissent = stats.follow > .45, buckets = {};
      for (var i = 0; i < N; i++) {
        var key = showDissent && type[i] === 3 ? 'd' : showClans ? 'g' + groupOf(i) : 'i';
        (buckets[key] = buckets[key] || []).push(i);
      }
      c.lineCap = 'round'; c.lineWidth = TOUCH ? 1.5 : 1.3;
      for (var key in buckets) {
        var arr = buckets[key], col = key === 'd' ? pal.acc : key === 'i' ? pal.ink : pal.clans[(+key.slice(1) * (8 >> level)) % 8];
        c.strokeStyle = col; c.globalAlpha = key === 'i' ? .85 : .95; c.beginPath();
        for (var k = 0; k < arr.length; k++) { var j = arr[k], len = 2.6; c.moveTo(x[j], y[j]); c.lineTo(x[j] - vx[j] * len, y[j] - vy[j] * len); }
        c.stroke();
      }
      c.globalAlpha = 1;
      // leaders
      leaders.forEach(function (L) { if (L.prey) return; c.fillStyle = L.mob ? pal.acc : pal.lead; c.globalAlpha = L.life; c.beginPath(); c.arc(L.x, L.y, 3.5, 0, 6.283); c.fill(); c.globalAlpha = L.life * .25; c.strokeStyle = c.fillStyle; c.lineWidth = 1; c.beginPath(); c.arc(L.x, L.y, 12 + (1 - L.life) * 40, 0, 6.283); c.stroke(); });
      if (elected >= 0) { var ex = x[elected], ey = y[elected]; c.globalAlpha = .9; c.fillStyle = pal.lead; c.beginPath(); c.arc(ex, ey, 3, 0, 6.283); c.fill(); c.globalAlpha = .18 + .1 * Math.sin(now / 200); c.beginPath(); c.arc(ex, ey, 14, 0, 6.283); c.fill(); }
      // ripples, seeds, warmth, lasso, beats
      ripples.forEach(function (rp) { c.globalAlpha = Math.max(0, rp.life) * .35; c.strokeStyle = rp.burst ? pal.acc : pal.ink; c.lineWidth = 1; c.beginPath(); c.arc(rp.x, rp.y, rp.r, 0, 6.283); c.stroke(); });
      seeds.forEach(function (sd) { c.globalAlpha = sd.life * (.5 + .3 * Math.sin(now / 160)); c.fillStyle = pal.lead; c.beginPath(); c.arc(sd.x, sd.y, 2.5 + sd.life * 2, 0, 6.283); c.fill(); });
      warms.forEach(function (wm) { var gr = c.createRadialGradient(wm.x, wm.y, 0, wm.x, wm.y, 150); gr.addColorStop(0, pal.acc); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = wm.life * .16; c.fillStyle = gr; c.fillRect(wm.x - 150, wm.y - 150, 300, 300); });
      if (lassoFlash) { c.globalAlpha = lassoFlash.life * .5; c.strokeStyle = pal.lead; c.lineWidth = 1; c.setLineDash([3, 4]); c.beginPath(); lassoFlash.pts.forEach(function (q, qi) { qi ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.stroke(); c.setLineDash([]); }
      if (claimT > now || scoutT > now) { c.strokeStyle = pal.lead; c.globalAlpha = .95; c.lineWidth = 1.8; c.beginPath(); for (var ci = 0; ci < N; ci++) if (tag[ci]) { c.moveTo(x[ci], y[ci]); c.lineTo(x[ci] - vx[ci] * 3, y[ci] - vy[ci] * 3); } c.stroke(); }
      if (beatFlash > 0) { c.globalAlpha = beatFlash * .25; c.strokeStyle = pal.acc; c.lineWidth = 2; c.beginPath(); c.arc(rhythm.cx || W / 2, rhythm.cy || H / 2, 40 + (1 - beatFlash) * 160, 0, 6.283); c.stroke(); }
      leaders.forEach(function (L) { if (!L.prey) return; c.globalAlpha = L.life; c.strokeStyle = pal.acc; c.lineWidth = 1.5; var a = Math.atan2(L.vy, L.vx); c.beginPath(); c.moveTo(L.x + Math.cos(a) * 9, L.y + Math.sin(a) * 9); c.lineTo(L.x + Math.cos(a + 2.5) * 7, L.y + Math.sin(a + 2.5) * 7); c.lineTo(L.x + Math.cos(a - 2.5) * 7, L.y + Math.sin(a - 2.5) * 7); c.closePath(); c.stroke(); });
      // pressure ring
      if (P.down) { var hr = 90 + Math.min(260, (now - P.downT) * .12); c.globalAlpha = .35; c.strokeStyle = pal.acc; c.lineWidth = 1; c.setLineDash([2, 5]); c.beginPath(); c.arc(P.x, P.y, hr, 0, 6.283); c.stroke(); c.setLineDash([]); }
      if (lure > .2) { c.globalAlpha = lure * .25; c.strokeStyle = pal.ink; c.lineWidth = 1; c.beginPath(); c.arc(P.x, P.y, 70, 0, 6.283); c.stroke(); }
      c.globalAlpha = 1;
    }
    function groupsInfo() {
      gCount.fill(0); gX.fill(0); gY.fill(0); var ng = 1 << level;
      for (var i = 0; i < N; i += 2) { var g = groupOf(i); if (x[i] < -20 || x[i] > W + 20 || y[i] < -20 || y[i] > H + 20) continue; gCount[g]++; gX[g] += x[i]; gY[g] += y[i]; }
      var out = []; for (var k = 0; k < ng; k++) if (gCount[k]) out.push({ n: gCount[k] * 2, x: gX[k] / gCount[k] / W, y: gY[k] / gCount[k] / H }); out.sort(function (a, b) { return b.n - a.n; }); return out;
    }
    function loop(now) {
      raf = requestAnimationFrame(loop); var dt = Math.min(.033, (now - lastT) / 1000); lastT = now; frame++;
      var idle = now - lastInput;
      // the viewer's proposal decays; pressure rises with force and falls with patience
      dirK = Math.max(0, dirK - dt * .35);
      var pm = Math.hypot(P.vx, P.vy); P.vx *= .85; P.vy *= .85;
      pressure += dt * (Math.max(0, pm - 6) * .012 + (P.down ? .16 : 0)); pressure -= dt * (idle > 2500 ? .05 : .012); pressure = clamp(pressure, 0, 1.3);
      // fragmentation level with hysteresis
      var up = [.25, .5, .78], nl = level; if (level < 3 && pressure > up[level]) nl = level + 1; if (level > 0 && pressure < up[level - 1] - .1) nl = level - 1;
      if (nl !== level) { if (nl > level) { S('fragment'); if (nl >= 2) find('fragment'); } else if (nl === 0 && groupsHist >= 4) { S('reunite'); find('reunite'); } level = nl; groupsHist = Math.max(groupsHist, 1 << level); if (level === 0) groupsHist = 1; }
      // stillness inside the collective becomes a lure
      var stillOK = hadTouch ? (touches === 0) : (P.inside && !P.down && pm < .4); if (stillOK && idle > 1200 && idle < 60000) P.stillT += dt; else P.stillT = 0;
      lure += ((P.stillT > 3 ? 1 : 0) - lure) * dt * .8; if (lure > .6 && frame % 20 === 0) { var near = 0; for (var li = 0; li < N; li += 5) if (Math.hypot(x[li] - P.x, y[li] - P.y) < 150) near++; if (near * 5 > N * .06) { if (!found.lure) S('lure'); find('lure'); } }
      // sustained pressure: exodus
      if (P.down && now - P.downT > 5500 && !exodusOn) { exodusOn = true; exodus = 1; S('exodus'); find('exodus'); }
      if (exodusOn && !P.down && idle > 3500) { exodusOn = false; S('returned'); }
      // an elected leader, when left alone and whole
      if (elected < 0 && idle > 15000 && level === 0 && !leaders.length && Math.random() < .005) elect();
      if (elected >= 0 && (now - electedT > 14000 || idle < 200)) elected = -1;
      stepEffects(dt, now);
      stepLeaders(dt); step(dt); render(now);
      // dissent and mill
      if (stats.follow > .45) { if (!dissentShown) { dissentShown = 1; S('dissent', P.x / W); find('dissent'); } } else if (stats.follow < .2) dissentShown = 0;
      if (stats.follow > .4) find('follow');
      if (stats.trust < .45 && pm > 4) find('refuse');
      if (frame % 30 === 0) { var mill = millness(); if (mill > .45) { millT += .5; if (millT > 2) { S('mill'); find('mill'); millT = -20; } } else millT = Math.max(0, millT - .5); }
      if (frame % 6 === 0) { var gi = groupsInfo(); var away = exodusOn ? clamp(1 - gi.reduce(function (s, g) { return s + g.n; }, 0) / N, 0, 1) : 0; S('update', gi, level / 3, stats.speed, stats.order, N, away); S('call', P.y / H, P.x / W, P.inside && pm > 1 ? Math.min(1, pm / 20) : 0, stats.follow); S('pressure', P.down ? Math.min(1, (now - P.downT) / 5000) : 0); stats.groups = gi.filter(function (g) { return g.n > N * .03; }).length; }
      if (frame % 60 === 0 && panelOpen) syncPanel();
    }
    function millness() { var cx = 0, cy = 0, n = 0; for (var i = 0; i < N; i += 3) { cx += x[i]; cy += y[i]; n++; } cx /= n; cy /= n; var L = 0, M = 0; for (var j = 0; j < N; j += 3) { var rx = x[j] - cx, ry = y[j] - cy, cr = rx * vy[j] - ry * vx[j]; L += cr; M += Math.sqrt(rx * rx + ry * ry) * Math.hypot(vx[j], vy[j]); } return Math.abs(L) / (M || 1); }
    function elect() {
      var cx = 0, cy = 0, mvx = 0, mvy = 0; for (var i = 0; i < N; i += 3) { cx += x[i]; cy += y[i]; mvx += vx[i]; mvy += vy[i]; } var n = Math.ceil(N / 3); cx /= n; cy /= n;
      var best = -1e9, bi = -1; for (var j = 0; j < N; j += 2) { if (type[j] === 3) continue; var s = (x[j] - cx) * mvx + (y[j] - cy) * mvy; if (s > best) { best = s; bi = j; } }
      if (bi >= 0) { elected = bi; electedT = performance.now(); S('elected', x[bi] / W); find('elected'); }
    }

    // ---------- effects ----------
    function stepEffects(dt, now) {
      for (var i = ripples.length - 1; i >= 0; i--) { var r = ripples[i]; r.r += r.v * dt; r.life -= dt * .7; if (r.life <= 0) ripples.splice(i, 1); }
      for (var j = seeds.length - 1; j >= 0; j--) { seeds[j].life -= dt * .09; if (seeds[j].life <= 0) seeds.splice(j, 1); }
      for (var k = warms.length - 1; k >= 0; k--) { warms[k].life -= dt * .12; if (warms[k].life <= 0) warms.splice(k, 1); }
      vortex.k *= Math.pow(.6, dt); if (Math.abs(vortex.k) < .01) vortex.k = 0;
      if (implode && now - implode.t0 > 650) { ripples.push({ x: implode.x, y: implode.y, r: 6, v: 420, s: 1.6, life: 1, burst: true }); S('burst', implode.x / W); pressure = Math.min(1.3, pressure + .1); implode = null; }
      if (lassoFlash) { lassoFlash.life -= dt * .8; if (lassoFlash.life <= 0) lassoFlash = null; }
      if (claimT && now > claimT) { claimT = 0; var n = 0; for (var q = 0; q < N; q++) if (tag[q] === 1) { tag[q] = 0; var a = Math.random() * 6.283; vx[q] += Math.cos(a) * 3; vy[q] += Math.sin(a) * 3; n++; } if (n) S('defect', P.x / W); }
      if (scoutT && now > scoutT) { scoutT = 0; for (var s2 = 0; s2 < N; s2++) if (tag[s2] === 2) tag[s2] = 0; }
      beatFlash = Math.max(0, beatFlash - dt * 2.5);
      if (rhythm.on && now >= rhythm.next) {
        // a beat: the collective breathes out, then in
        var cx = 0, cy = 0, m = 0; for (var b = 0; b < N; b += 4) { cx += x[b]; cy += y[b]; m++; } cx /= m; cy /= m; rhythm.cx = cx; rhythm.cy = cy;
        var out = rhythm.phase++ % 2 === 0 ? 1 : -1; for (var a2 = 0; a2 < N; a2++) { var dx = x[a2] - cx, dy = y[a2] - cy, dl = Math.sqrt(dx * dx + dy * dy) + 1; vx[a2] += dx / dl * 1.6 * out; vy[a2] += dy / dl * 1.6 * out; }
        beatFlash = 1; S('beat', out > 0 ? 1 : .6, cx / W); rhythm.next += rhythm.period; if (--rhythm.left <= 0) rhythm.on = false;
      }
    }
    function nearestAgent(px, py, maxD) { var best = -1, bd = maxD * maxD; for (var i = 0; i < N; i++) { var dx = x[i] - px, dy = y[i] - py, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = i; } } return best; }
    function countNear(px, py, r) { var n = 0, r2 = r * r; for (var i = 0; i < N; i++) { var dx = x[i] - px, dy = y[i] - py; if (dx * dx + dy * dy < r2) n++; } return n; }
    // one tap, many possible answers, depending on where and when it lands
    function tap(px, py) {
      var now = performance.now(); lastInput = now;
      taps = taps.filter(function (t) { return now - t.t < 4000; }); taps.push({ t: now, x: px, y: py });
      // rhythm: three even intervals start a beat that outlasts you
      if (taps.length >= 4) { var iv = [], n = taps.length; for (var k = n - 3; k < n; k++) iv.push(taps[k].t - taps[k - 1].t); var mean = (iv[0] + iv[1] + iv[2]) / 3; if (mean > 240 && mean < 1100 && iv.every(function (v) { return Math.abs(v - mean) < mean * .2; })) { rhythm.on = true; rhythm.period = mean; rhythm.next = now + mean; rhythm.left = 8; find('rhythm'); return; } }
      if (rhythm.on) { rhythm.left = 8; return; }
      // a double tap: they repeat your last gesture
      var prev = taps[taps.length - 2]; if (prev && now - prev.t < 320 && Math.hypot(prev.x - px, prev.y - py) < 40 && lastPath.length > 8) { leaders.push({ x: lastPath[0][0], y: lastPath[0][1], vx: 0, vy: 0, life: 1, reach: 220, age: 0, mob: false, h: 0, path: lastPath.slice() }); S('echo', px / W); find('echo'); return; }
      if (exodusOn) { scout(px, py); return; }
      if (elected >= 0 && Math.hypot(x[elected] - px, y[elected] - py) < 34) { dethrone(px, py); return; }
      for (var l = 0; l < leaders.length; l++) { var L = leaders[l]; if (!L.prey && !L.path && Math.hypot(L.x - px, L.y - py) < 30) { schism(L); return; } }
      if (lure > .5 && Math.hypot(P.x - px, P.y - py) < 90) { implode = { x: px, y: py, t0: now }; S('implode', px / W); find('implode'); lure = 0; P.stillT = 0; return; }
      var dense = countNear(px, py, 40), ni = nearestAgent(px, py, 18);
      if (ni >= 0 && type[ni] === 3) { convert(ni); return; }
      if (dense >= 12) { ripples.push({ x: px, y: py, r: 4, v: 300, s: .9, life: 1 }); pressure = Math.min(1.3, pressure + .05); S('startle', px / W, dense / 40); find('startle'); return; }
      var lone = nearestAgent(px, py, 50); if (lone >= 0 && countNear(x[lone], y[lone], 45) <= 3) { seeds.push({ x: x[lone], y: y[lone], life: 1 }); tag[lone] = 2; scoutT = now + 6000; S('seed', y[lone] / H, x[lone] / W); find('seed'); return; }
      if (Math.random() < .14 && N) { hunt(px, py); return; }
      addLeader(px, py);
    }
    function scout(px, py) {
      var best = -1, bd = 1e9; for (var i = 0; i < N; i++) { var off = Math.max(-x[i], x[i] - W, -y[i], y[i] - H); if (off > 0 && off < bd) { bd = off; best = i; } }
      if (best < 0) best = Math.floor(Math.random() * N); var ang = Math.atan2(py - H / 2, px - W / 2); x[best] = W / 2 + Math.cos(ang) * W * .6; y[best] = H / 2 + Math.sin(ang) * H * .6; var dl = Math.hypot(px - x[best], py - y[best]) || 1; vx[best] = (px - x[best]) / dl * 3; vy[best] = (py - y[best]) / dl * 3;
      tag[best] = 2; scoutT = performance.now() + 5000; S('scout', px / W); find('scout');
    }
    function dethrone(px, py) {
      var ex = x[elected], ey = y[elected], hx = vx[elected], hy = vy[elected], hl = Math.hypot(hx, hy) || 1; elected = -1;
      for (var i = 0; i < N; i++) { var side = ((x[i] - ex) * -hy + (y[i] - ey) * hx) / hl > 0 ? 1 : -1; vx[i] += -hy / hl * side * 2.2; vy[i] += hx / hl * side * 2.2; }
      pressure = Math.max(pressure, .32); S('dethrone', px / W); find('dethrone');
    }
    function schism(L) { var a = Math.atan2(L.vy, L.vx); L.vx = Math.cos(a + 1.3) * 2.6; L.vy = Math.sin(a + 1.3) * 2.6; L.h = a + 1.3; leaders.push({ x: L.x, y: L.y, vx: Math.cos(a - 1.3) * 2.6, vy: Math.sin(a - 1.3) * 2.6, life: L.life, reach: L.reach, age: 0, mob: false, h: a - 1.3 }); S('schism', L.x / W); find('schism'); }
    function convert(ci) {
      var cx = x[ci], cy = y[ci], hx = -vx[ci], hy = -vy[ci], n = 0; for (var i = 0; i < N; i++) { var dx = x[i] - cx, dy = y[i] - cy; if (dx * dx + dy * dy < 120 * 120) { vx[i] = hx + (Math.random() - .5) * .6; vy[i] = hy + (Math.random() - .5) * .6; pers[i] = 0; n++; } }
      ripples.push({ x: cx, y: cy, r: 4, v: 160, s: .2, life: .8, burst: true }); S('convert', cx / W, n); find('convert');
    }
    function hunt(px, py) { var a = Math.random() * 6.283; leaders.push({ x: px, y: py, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 1, reach: 360, age: 0, mob: false, prey: true, h: a }); S('hunt', px / W); find('hunt'); }
    function lasso(pts) {
      var n = 0; for (var i = 0; i < N; i++) { var px = x[i], py = y[i], inside = false; for (var a = 0, b = pts.length - 1; a < pts.length; b = a++) { var A2 = pts[a], B2 = pts[b]; if ((A2[1] > py) !== (B2[1] > py) && px < (B2[0] - A2[0]) * (py - A2[1]) / (B2[1] - A2[1]) + A2[0]) inside = !inside; } if (inside) { tag[i] = 1; n++; } }
      lassoFlash = { pts: pts, life: 1 }; if (n > 4) { claimT = performance.now() + 4500 + Math.min(4000, n * 10); S('lasso', n); find('lasso'); }
    }
    function gust(x0, y0, x1, y1) {
      var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      for (var i = 0; i < N; i++) { var rx = x[i] - x0, ry = y[i] - y0, u = clamp((rx * ux + ry * uy) / L, 0, 1), qx = x0 + ux * L * u - x[i], qy = y0 + uy * L * u - y[i], d = Math.hypot(qx, qy); if (d < 140) { var k = (1 - d / 140) * 5; vx[i] += ux * k; vy[i] += uy * k; } }
      pressure = Math.min(1.3, pressure + .06); S('gust', x0 / W, (x1 - x0) / W); find('gust');
    }
    function setTemper(k, quiet) { if (!MIXES[k] || k === mixKey) return; mixKey = k; persist(); retype(); syncPanel(); S('temper', k === 'conformist' ? 1 : k === 'dissenting' ? -1 : 0); if (!quiet) { api.whisper(k); find('temper'); } }

    // ---------- input ----------
    function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    var lastPT = 0, downAt = null, touches = 0, hadTouch = false, path = [];
    function propose(nx, ny, t) {
      var dtm = Math.max(8, t - lastPT); lastPT = t; var dvx = (nx - P.x) / dtm * 16, dvy = (ny - P.y) / dtm * 16;
      P.vx = P.vx * .6 + dvx * .4; P.vy = P.vy * .6 + dvy * .4; P.x = nx; P.y = ny;
      var m = Math.hypot(P.vx, P.vy); if (m > 1.2) { dirX = dirX * .8 + P.vx / m * .2; dirY = dirY * .8 + P.vy / m * .2; dirK = Math.min(1, dirK + m * .01); P.stillT = 0; lure = Math.min(lure, .3); }
    }
    cv.addEventListener('pointermove', function (e) {
      var p = pos(e), now = performance.now(); P.inside = true; if (e.pointerType !== 'touch') { propose(p[0], p[1], now); } if (Math.hypot(P.vx, P.vy) > .5) lastInput = now;
      if (downAt && Math.hypot(p[0] - downAt.x, p[1] - downAt.y) > 12) downAt.moved = true;
      if (downAt && touches <= 1) { var lp = path[path.length - 1]; if (!lp || Math.hypot(p[0] - lp[0], p[1] - lp[1]) > 4) path.push([p[0], p[1], now]); if (path.length > 600) path.shift(); }
    }, sig);
    cv.addEventListener('pointerdown', function (e) {
      if (panelOpen) openPanel(false); if (e.pointerType === 'touch') { touches++; if (touches > 1) { P.down = false; downAt = null; return; } }
      var p = pos(e), now = performance.now(); lastInput = now; P.x = p[0]; P.y = p[1]; P.inside = true; lastPT = now; downAt = { x: p[0], y: p[1], t: now, moved: false }; path = [[p[0], p[1], now]]; askMotion();
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      holdT = setTimeout(function () { if (downAt && !downAt.moved) { P.down = true; P.downT = performance.now(); } }, 260);
    }, sig);
    var holdT = 0;
    function up(e) {
      if (e.pointerType === 'touch') touches = Math.max(0, touches - 1);
      clearTimeout(holdT); var d = downAt; downAt = null; lastInput = performance.now();
      if (d && !d.moved && !P.down && performance.now() - d.t < 260 && e.type === 'pointerup') tap(d.x, d.y);
      else if (d && d.moved && e.type === 'pointerup' && path.length > 3) gesture(path, performance.now() - d.t);
      P.down = false; if (e.pointerType === 'touch') { hadTouch = true; }
    }
    function gesture(pts, dur) {
      var L = 0, rev = 0, lastDir = 0; for (var i = 1; i < pts.length; i++) { var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1]; L += Math.hypot(dx, dy); var ax = Math.abs(dx) > Math.abs(dy) ? dx : dy, dir = ax > 0 ? 1 : -1; if (Math.abs(ax) > 3) { if (lastDir && dir !== lastDir) rev++; lastDir = dir; } }
      var a = pts[0], b = pts[pts.length - 1], chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
      lastPath = pts.map(function (q) { return [q[0], q[1]]; });
      if (dur < 330 && chord > 70 && chord / dur > .35 && L < chord * 1.4) { gust(a[0], a[1], b[0], b[1]); return; }
      if (rev >= 5 && L / Math.max(1, chord) > 3) { warms.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, life: 1 }); pressure = Math.max(0, pressure - .15); S('warm', a[0] / W); find('warm'); return; }
      if (L > 240 && chord < Math.max(50, L * .15)) { lasso(pts); return; }
    }
    cv.addEventListener('pointerup', up, sig); cv.addEventListener('pointercancel', up, sig);
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { P.inside = false; P.down = false; } }, sig);
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); var p = pos(e); ripples.push({ x: p[0], y: p[1], r: 4, v: 300, s: .9, life: 1 }); S('startle', p[0] / W, .6); find('startle'); }, sig);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); var p = pos(e); vortex.x = p[0]; vortex.y = p[1]; vortex.k = clamp(vortex.k + Math.sign(e.deltaY) * .25, -2.5, 2.5); lastInput = performance.now(); if (Math.abs(vortex.k) > 1) { find('vortex'); S('vortex', vortex.k); } }, { passive: false, signal: ac.signal });
    addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName)) return; var k = e.key.toLowerCase();
      if (k === 'p') { cyclePal(); } else if (k === 't') { trails = !trails; persist(); syncPanel(); } else if (k === 'r') { reset(); } else if (k === ' ') { e.preventDefault(); scatter(); } else if (k === 'arrowup') { e.preventDefault(); setTemper(mixKey === 'dissenting' ? 'balanced' : 'conformist'); } else if (k === 'arrowdown') { e.preventDefault(); setTemper(mixKey === 'conformist' ? 'balanced' : 'dissenting'); }
    }, sig);
    function scatter() { for (var i = 0; i < N; i++) { var a = Math.random() * 6.283; vx[i] += Math.cos(a) * 3; vy[i] += Math.sin(a) * 3; } pressure = Math.min(1.3, pressure + .25); lastInput = performance.now(); }
    function reset() { lastTrust = 1; for (var i = 0; i < N; i++) { resp[i] = 1; pers[i] = 0; } persist(1); api.whisper('trust restored'); }
    function cyclePal() { setPal(PAL_KEYS[(PAL_KEYS.indexOf(palKey) + 1) % PAL_KEYS.length]); api.whisper(PALS[palKey].name.toLowerCase()); }
    var G2 = api.gestures ? api.gestures(cv, function (type, d) {
      switch (type) {
        case 'swipe': if (d.edge) cyclePal(); break;
        case 'twotap': scatter(); break;
        case 'threetap': reset(); break;
        case 'pinch': if (d.delta) { var spread = (d.delta - 1) * 2; for (var i = 0; i < N; i++) { var dx = x[i] - d.x, dy = y[i] - d.y, dl = Math.hypot(dx, dy) + 1; if (dl < 300) { vx[i] += dx / dl * spread; vy[i] += dy / dl * spread; } } pressure = Math.min(1.3, pressure + Math.abs(d.delta - 1) * .2); lastInput = performance.now(); } break;
        case 'orient': for (var o = 0; o < N; o++) { var t0 = vx[o]; vx[o] = -vy[o]; vy[o] = t0; } S('turn'); find('turn'); break;
        case 'rotate': vortex.x = d.x; vortex.y = d.y; vortex.k = clamp(vortex.k + d.delta * 4, -2.5, 2.5); if (Math.abs(vortex.k) > 1) { find('vortex'); if (!vortex.snd) { vortex.snd = 1; S('vortex', vortex.k); setTimeout(function () { vortex.snd = 0; }, 1500); } } lastInput = performance.now(); break;
        case 'twoswipe': setTemper(d.dir === 'up' ? (mixKey === 'dissenting' ? 'balanced' : 'conformist') : (mixKey === 'conformist' ? 'balanced' : 'dissenting')); break;
      }
    }) : null;
    // the phone itself: tilt pours them downhill, a shake panics them
    var motionAsked = false, lastShake = 0, tiltSeen = 0;
    function askMotion() {
      if (motionAsked) return; motionAsked = true;
      try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().catch(function () {}); } catch (e) {}
      try { if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().catch(function () {}); } catch (e) {}
    }
    addEventListener('deviceorientation', function (e) {
      if (e.gamma == null || !TOUCH) return; var gx = clamp(e.gamma / 35, -1, 1), gy = clamp((e.beta - 40) / 35, -1, 1), mag = Math.hypot(gx, gy);
      tilt.on = mag > .2; tilt.x = gx * .05; tilt.y = gy * .05; if (mag > .6) { tiltSeen += 1; if (tiltSeen > 40) find('tilt'); } else tiltSeen = Math.max(0, tiltSeen - 1);
    }, sig);
    addEventListener('devicemotion', function (e) {
      var a = e.accelerationIncludingGravity || e.acceleration; if (!a || a.x == null) return; var m = Math.hypot(a.x, a.y, a.z || 0), now = performance.now();
      if (Math.abs(m - 9.8) > 14 && now - lastShake > 1200) { lastShake = now; scatter(); pressure = Math.min(1.3, pressure + .2); S('shake'); find('shake'); }
    }, sig);
    // touch: a still finger drawn across the screen is also a proposal
    cv.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch' && touches === 1) { var p = pos(e); propose(p[0], p[1], performance.now()); } }, sig);

    // ---------- panel ----------
    var slot = api.slot && api.slot(), panel = null, ctl = {}, panelOpen = false;
    function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
    function seg(label, keys, names, get, set) { var r = el('div', 'icrow'), sg = el('div', 'icseg'); r.appendChild(el('span', 'iclab', label)); r.appendChild(sg); var bs = keys.map(function (k) { var b = el('button', null, names[k]); b.type = 'button'; b.addEventListener('click', function () { set(k); }); sg.appendChild(b); return b; }); panel.appendChild(r); return function () { bs.forEach(function (b, i) { b.setAttribute('aria-pressed', keys[i] === get() ? 'true' : 'false'); }); }; }
    if (slot) {
      var wrap = el('div', 'icpick'), btn = el('button', 'hudbtn'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(el('span', 'icglyph')); btn.appendChild(el('span', null, 'COLLECTIVE'));
      panel = el('div', 'icpanel'); panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'The collective');
      ctl.card = el('div'); ctl.card.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-variant-numeric:tabular-nums;margin-bottom:4px'; panel.appendChild(ctl.card);
      var r1 = el('div', 'icrow'); r1.appendChild(el('span', 'iclab', 'Palette')); var sw = el('div', 'icsw'); r1.appendChild(sw); panel.appendChild(r1);
      ctl.pals = PAL_KEYS.map(function (k) { var p = PALS[k], b = el('button', 'icchip'); b.type = 'button'; b.title = p.name; b.setAttribute('aria-label', p.name); b.style.background = 'linear-gradient(135deg,' + p.bg + ' 0 50%,' + p.clans[0] + ' 50% 70%,' + p.clans[1] + ' 70%)'; b.addEventListener('click', function () { setPal(k); }); sw.appendChild(b); return b; });
      ctl.sPop = seg('Agents', POP_KEYS, { few: POPS.few.toLocaleString(), many: POPS.many.toLocaleString(), swarm: POPS.swarm.toLocaleString() }, function () { return popKey; }, function (k) { popKey = k; persist(); populate(POPS[k], true); syncPanel(); });
      ctl.sMix = seg('Temper', MIX_KEYS, { balanced: 'Balanced', conformist: 'Conformist', dissenting: 'Dissenting' }, function () { return mixKey; }, function (k) { mixKey = k; persist(); retype(); syncPanel(); });
      ctl.sTr = seg('Trails', ['on', 'off'], { on: 'On', off: 'Off' }, function () { return trails ? 'on' : 'off'; }, function (k) { trails = k === 'on'; persist(); syncPanel(); });
      var foot = el('div', 'icfoot');
      [['SCATTER', scatter], ['RESTORE TRUST', reset]].forEach(function (a, i) { var b = el('button', 'iccopy', a[0]); b.type = 'button'; if (!i) b.style.marginLeft = '0'; b.addEventListener('click', a[1]); foot.appendChild(b); });
      panel.appendChild(foot);
      wrap.appendChild(btn); wrap.appendChild(panel); slot.appendChild(wrap); ctl.btn = btn;
      btn.addEventListener('click', function () { openPanel(panel.hidden); });
      document.addEventListener('pointerdown', function (e) { if (panelOpen && !wrap.contains(e.target) && e.target !== cv) openPanel(false); }, sig);
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { openPanel(false); btn.focus(); e.stopPropagation(); } }, { capture: true, signal: ac.signal });
    }
    function openPanel(o) { if (!panel) return; panelOpen = o; panel.hidden = !o; ctl.btn.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) syncPanel(); }
    function syncPanel() {
      if (!panel || !panelOpen) return; var counts = [0, 0, 0, 0]; for (var i = 0; i < N; i++) counts[type[i]]++;
      var rows = [['Agents', N.toLocaleString()], ['Groups', String(Math.max(1, stats.groups))], ['Following you', Math.round(stats.follow * 100) + '%'], ['Trust', Math.round(stats.trust * 100) + '%'], ['Pressure', Math.round(clamp(pressure, 0, 1) * 100) + '%'], ['Temperaments', counts.map(function (n, i) { return Math.round(n / N * 100) + '% ' + TNAME[i]; }).join(' \u00b7 ')]];
      ctl.card.innerHTML = ''; rows.forEach(function (r) { var a = el('span', 'iclab', r[0]), b = el('span', null, r[1]); if (r[0] === 'Temperaments') { b.style.textTransform = 'none'; b.style.letterSpacing = '0'; b.style.fontSize = '11px'; } ctl.card.appendChild(a); ctl.card.appendChild(b); });
      ctl.pals.forEach(function (b, i) { b.setAttribute('aria-pressed', PAL_KEYS[i] === palKey ? 'true' : 'false'); }); ctl.sPop(); ctl.sMix(); ctl.sTr();
    }
    function setPal(k) { if (!PALS[k]) return; palKey = k; persist(); api.tone(PALS[k].dark ? 'dark' : 'light'); c.fillStyle = PALS[k].bg; c.fillRect(0, 0, W, H); syncPanel(); }

    // ---------- start ----------
    setPal(palKey);
    addEventListener('resize', size, sig);
    raf = requestAnimationFrame(loop);
    var trustT = setInterval(function () { lastTrust = stats.trust; persist(stats.trust); }, 4000);
    if (SBL.debug) SBL._09 = { tap: tap, gesture: gesture, fx: function () { return { ripples: ripples.length, seeds: seeds.length, warms: warms.length, vortex: vortex.k, rhythm: rhythm.on, claimed: (function () { var n = 0; for (var i = 0; i < N; i++) if (tag[i] === 1) n++; return n; })(), leaders: leaders.map(function (l) { return l.prey ? 'prey' : l.path ? 'echo' : 'L'; }).join(','), implode: !!implode }; }, setElected: function (i) { elected = i; electedT = performance.now(); }, agent: function (i) { return [x[i], y[i], type[i]]; }, findType: function (t) { for (var i = 0; i < N; i++) if (type[i] === t) return i; return -1; }, cents: function () { var o = []; for (var k = 0; k < (1 << level); k++) o.push([Math.round(gX[k]), Math.round(gY[k]), gCount[k] | 0, Math.round(tmpTX[k]), Math.round(tmpTY[k])]); return o; }, pers: pers, resp: resp, stats: function () { return { follow: stats.follow, trust: stats.trust, order: stats.order, groups: stats.groups, level: level, pressure: pressure, N: N, leaders: leaders.length, exodus: exodusOn, lure: lure, elected: elected }; }, found: found, elect: elect, millness: millness, P: P };

    return function unmount() { persist(stats.trust); ac.abort(); cancelAnimationFrame(raf); clearInterval(trustT); clearTimeout(holdT); if (G2) G2(); S('stop'); };
  }
});
