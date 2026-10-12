/* 01 — Particle Organism: generative soundscape (Web Audio, no samples).
   Warm detuned pads on a wobbling tape, FM bells, a broken music box, vinyl dust,
   and a bit-crushed drill-break that only appears when the organism is provoked.
   SBL.organismSound(A, hooks) -> { update(state), events..., stop() } */
SBL.organismSound = function (A, hooks) {
  'use strict';
  var ctx = A.ctx, alive = true, live = [];
  function T() { return ctx.currentTime; }
  function ok() { return alive && ctx.state === 'running'; }
  function track(n) { live.push(n); return n; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function panner(v) { if (!ctx.createStereoPanner) return ctx.createGain(); var p = ctx.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; }

  // ---------- master chain: everything -> tone (lowpass) -> comp -> duck -> bus -> shell out ----------
  var bus = ctx.createGain(); bus.gain.value = 0; bus.connect(A.out);
  bus.gain.setTargetAtTime(.9, T(), 1.8);
  var duck = ctx.createGain(); duck.connect(bus);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .35; comp.connect(duck);
  var tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 7000; tone.Q.value = .4; tone.connect(comp);

  function impulse(sec) {
    var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), lp = 0; for (var i = 0; i < n; i++) { var k = i / n, a = .3 + .62 * k; lp = lp * a + (Math.random() * 2 - 1) * (1 - a); d[i] = lp * Math.pow(1 - k, 2.4) * 2.2; } }
    return b;
  }
  var verb = ctx.createConvolver(); verb.buffer = impulse(4.6);
  var verbIn = ctx.createGain(), verbOut = ctx.createGain(); verbOut.gain.value = .6;
  verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(tone);

  // ---------- tape: every oscillator's detune listens to this bus ----------
  var pitch = ctx.createGain();
  var tapeSleep = null, tapeFx = null;
  if (ctx.createConstantSource) {
    tapeSleep = track(ctx.createConstantSource()); tapeSleep.offset.value = 0; tapeSleep.connect(pitch); tapeSleep.start();
    tapeFx = track(ctx.createConstantSource()); tapeFx.offset.value = 0; tapeFx.connect(pitch); tapeFx.start();
  }
  function lfo(f, depth, dest) { var o = track(ctx.createOscillator()), g = ctx.createGain(); o.frequency.value = f; g.gain.value = depth; o.connect(g); g.connect(dest); o.start(); return g; }
  var wowDepth = lfo(.19, 8, pitch); lfo(5.1, 2.2, pitch);
  function osc(type, f, det) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det || 0; pitch.connect(o.detune); return o; }
  function free(o) { try { pitch.disconnect(o.detune); } catch (e) {} }

  var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  (function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; })(noiseBuf.getChannelData(0));
  var dustBuf = ctx.createBuffer(1, ctx.sampleRate * 5, ctx.sampleRate);
  (function (d, sr) { for (var k = 0; k < 70; k++) { var p = Math.floor(Math.random() * (d.length - 40)), a = Math.pow(Math.random(), 3) * (Math.random() < .5 ? -1 : 1); for (var j = 0; j < 24; j++) d[p + j] += a * Math.exp(-j / 4) * (j % 2 ? -1 : 1); } })(dustBuf.getChannelData(0), ctx.sampleRate);

  // ---------- harmony ----------
  var CH = [
    { b: 38, v: [50, 57, 61, 64] }, // D  maj9 colour
    { b: 35, v: [50, 54, 59, 61] }, // Bm add9
    { b: 43, v: [55, 59, 62, 66] }, // G  maj7
    { b: 40, v: [52, 55, 59, 62] }, // Em7
    { b: 45, v: [49, 52, 57, 64] }  // A over C#
  ];
  var ODD = { b: 46, v: [53, 58, 62, 65] }; // the wrong turn: borrowed bVI
  var ci = 0, chord = CH[0], nextChord = T() + 18;

  // ---------- pads ----------
  var padBus = ctx.createGain();
  var padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 900; padF.Q.value = .9;
  padBus.connect(padF); padF.connect(tone);
  var padSend = ctx.createGain(); padSend.gain.value = .75; padF.connect(padSend); padSend.connect(verbIn);
  lfo(.031, 260, padF.frequency);
  var pads = chord.v.map(function (m, i) {
    var g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(.05, T(), 2.5 + i * 1.2);
    var a = track(osc('sawtooth', mtof(m), -6)), b = track(osc('triangle', mtof(m), 7));
    var ag = ctx.createGain(); ag.gain.value = .45; a.connect(ag); ag.connect(g); b.connect(g);
    lfo(rnd(.04, .11), .02, g.gain);
    var base = (i - 1.5) * .3, p = panner(base); g.connect(p); p.connect(padBus);
    a.start(); b.start();
    return { a: a, b: b, p: p, base: base };
  });
  var sub = track(osc('sine', mtof(chord.b))), subG = ctx.createGain(); subG.gain.value = 0; subG.gain.setTargetAtTime(.13, T(), 4);
  sub.connect(subG); subG.connect(tone); sub.start();

  // ---------- air + vinyl dust ----------
  var air = track(ctx.createBufferSource()); air.buffer = noiseBuf; air.loop = true;
  var airF = ctx.createBiquadFilter(); airF.type = 'bandpass'; airF.frequency.value = 700; airF.Q.value = .7;
  var airG = ctx.createGain(); airG.gain.value = .016; air.connect(airF); airF.connect(airG); airG.connect(tone); air.start();
  var dust = track(ctx.createBufferSource()); dust.buffer = dustBuf; dust.loop = true;
  var dustF = ctx.createBiquadFilter(); dustF.type = 'highpass'; dustF.frequency.value = 1400;
  var dustG = ctx.createGain(); dustG.gain.value = .08; dust.connect(dustF); dustF.connect(dustG); dustG.connect(comp); dust.start();

  // ---------- the stare: two beating sines ----------
  var eyeG = ctx.createGain(); eyeG.gain.value = 0; eyeG.connect(tone); eyeG.connect(verbIn);
  var e1 = track(osc('sine', mtof(chord.v[3] + 24))), e2 = track(osc('sine', mtof(chord.v[3] + 24) + 2.7));
  e1.connect(eyeG); e2.connect(eyeG); e1.start(); e2.start();

  function setChord(c, tau) {
    chord = c; var t = T();
    pads.forEach(function (p, i) { var f = mtof(c.v[i]); p.a.frequency.setTargetAtTime(f, t, tau); p.b.frequency.setTargetAtTime(f, t, tau * 1.3); });
    sub.frequency.setTargetAtTime(mtof(c.b), t, tau * 1.5);
    var top = mtof(c.v[3] + 24); e1.frequency.setTargetAtTime(top, t, tau); e2.frequency.setTargetAtTime(top + 2.7, t, tau);
  }

  // ---------- bells / music box (2-op FM) ----------
  function bell(m, v, pan, t, o) {
    o = o || {}; t = Math.max(t || 0, T());
    var f = mtof(m), c = osc('sine', f, o.det != null ? o.det : rnd(-8, 8)), mo = osc('sine', f * (o.ratio || pick([2, 3.5, 2.01, 4]))), mg = ctx.createGain(), g = ctx.createGain();
    var dec = o.dec || rnd(1.6, 3.4), atk = o.atk || .004, end;
    mg.gain.setValueAtTime(f * (o.idx || rnd(.6, 2.2)), t); mg.gain.exponentialRampToValueAtTime(f * .01 + .01, t + atk + dec * .6);
    mo.connect(mg); mg.connect(c.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + atk);
    if (o.rev) { g.gain.linearRampToValueAtTime(0, t + atk + .03); end = t + atk + .1; }
    else { g.gain.exponentialRampToValueAtTime(.0001, t + atk + dec); end = t + atk + dec + .05; }
    var p = panner(pan); c.connect(g); g.connect(p); p.connect(tone);
    var s = ctx.createGain(); s.gain.value = o.wet || .8; p.connect(s); s.connect(verbIn);
    c.start(t); mo.start(t); c.stop(end); mo.stop(end);
    c.onended = function () { free(c); free(mo); p.disconnect(); s.disconnect(); };
  }
  function box(m, v, pan, t) { bell(m, v, pan, t, { ratio: 5.01, idx: .35, dec: 1.3, det: rnd(-14, 14), wet: .6 }); }
  function tones() { var r = []; chord.v.forEach(function (m) { r.push(m + 12, m + 24); }); return r; }
  function phrase(seed, n, t0) {
    var r = mulberry(seed), tt = tones(), t = (t0 || T()) + .05, step = .21;
    for (var i = 0; i < n; i++) { box(tt[Math.floor(r() * tt.length)] + (r() < .2 ? 12 : 0), .06, (r() - .5) * .9, t); t += step * (1 + i * .07) + (r() - .5) * .04; }
  }

  // ---------- drill: kick, snare, hats into a bit crusher ----------
  var drill = ctx.createGain(), crush = ctx.createWaveShaper(), drillOut = ctx.createGain(); drillOut.gain.value = .55;
  crush.curve = (function (L) { var n = 2048, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.round(x * L) / L; } return c; })(10);
  drill.connect(crush); crush.connect(drillOut); drillOut.connect(tone);
  var dSend = ctx.createGain(); dSend.gain.value = .15; drillOut.connect(dSend); dSend.connect(verbIn);
  function kick(t, v, dest) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(42, t + .11); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .34); o.connect(g); g.connect(dest || drill); o.start(t); o.stop(t + .36); }
  function snare(t, v, pr) {
    pr = pr || 1;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = pr;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700 * pr; f.Q.value = .7;
    var g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .15);
    s.connect(f); f.connect(g); g.connect(drill); s.start(t, Math.random()); s.stop(t + .17);
    var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(210 * pr, t); o.frequency.exponentialRampToValueAtTime(150 * pr, t + .06);
    var og = ctx.createGain(); og.gain.setValueAtTime(v * .5, t); og.gain.exponentialRampToValueAtTime(.001, t + .08); o.connect(og); og.connect(drill); o.start(t); o.stop(t + .1);
  }
  function hat(t, v) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    var g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .035);
    s.connect(f); f.connect(g); g.connect(drill); s.start(t, Math.random()); s.stop(t + .05);
  }
  var dOn = false, dNext = 0, dStep = 0, bar = null, SX = 60 / 172 / 4;
  function genBar() {
    var p = [];
    for (var s = 0; s < 16; s++) {
      var e = { k: 0, sn: 0, h: 1, r: 1, up: 0 };
      if (s === 0 || (s === 10 && Math.random() < .7) || Math.random() < .12) e.k = 1;
      if (s === 4 || s === 12 || Math.random() < .16) e.sn = 1;
      if (e.sn && Math.random() < .35) { e.r = 2 + Math.floor(Math.random() * 3); e.up = Math.random() < .6 ? 1 : -.5; }
      if (s >= 12 && Math.random() < .5) { e.sn = 1; e.r = 3 + Math.floor(Math.random() * 4); e.up = 1; }
      if (Math.random() < .07) { e.k = e.sn = e.h = 0; }
      p.push(e);
    }
    return p;
  }
  function runDrill(intensity) {
    var t = T();
    if (!dOn) { dOn = true; dNext = t + .03; dStep = 0; bar = genBar(); }
    while (dNext < t + .12) {
      var e = bar[dStep % 16], w = dNext;
      if (e.k) { kick(w, .9); hooks.kick(w - t); }
      if (e.sn) for (var r = 0; r < e.r; r++) snare(w + r * SX / e.r, .5 * intensity * (r ? .75 : 1), 1 + r * .13 * e.up);
      if (e.h && Math.random() < .45 + intensity * .5) hat(w + (dStep % 2 ? SX * .09 : 0), .1 + .1 * Math.random());
      dNext += SX; dStep++;
      if (dStep % 16 === 0) bar = genBar();
    }
  }

  // ---------- wells: each holds a tone; heavier wells sink in pitch ----------
  var wellV = [];
  function wellOn(w) {
    var m = pick(chord.v) - 12 + (Math.random() < .5 ? 12 : 0), f = mtof(m);
    var o = osc('sine', f), o2 = osc('triangle', f * 2.003), g = ctx.createGain(), g2 = ctx.createGain(), p = panner(0);
    g.gain.value = 0; g2.gain.value = .22; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(p); p.connect(tone);
    var s = ctx.createGain(); s.gain.value = .5; p.connect(s); s.connect(verbIn);
    o.start(); o2.start();
    w.snd = { o: o, o2: o2, g: g, p: p, s: s, f: f, rel: false }; wellV.push(w);
    var t = T(), b = ctx.createOscillator(), bg = ctx.createGain();
    b.frequency.setValueAtTime(120, t); b.frequency.exponentialRampToValueAtTime(36, t + .55);
    bg.gain.setValueAtTime(.32, t); bg.gain.exponentialRampToValueAtTime(.001, t + 1.2);
    b.connect(bg); bg.connect(tone); bg.connect(verbIn); b.start(t); b.stop(t + 1.25);
  }
  function wellOff(w, tau) {
    var s = w.snd; if (!s || s.rel) return; s.rel = true; tau = tau || .6;
    var t = T(); s.g.gain.cancelScheduledValues(t); s.g.gain.setTargetAtTime(0, t, tau);
    setTimeout(function () { try { s.o.stop(); s.o2.stop(); } catch (e) {} free(s.o); free(s.o2); s.p.disconnect(); s.s.disconnect(); }, tau * 6000 + 100);
  }

  // ---------- one-off gestures ----------
  var lastZip = 0;
  function zip(xn) {
    var t = T(); if (t - lastZip < .45) return; lastZip = t;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(220, t + .32);
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .38);
    var p = panner(xn * 2 - 1); s.connect(f); f.connect(g); g.connect(p); p.connect(tone); p.connect(verbIn); s.start(t, Math.random()); s.stop(t + .4);
  }
  function chirp(t, a, b, v) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square';
    o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + .13);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(g); g.connect(drill); o.start(t); o.stop(t + .18);
  }
  function skip() { // a CD skipping: the output stutters and the tape jumps
    var t = T(), n = 9, st = .065;
    for (var i = 0; i < n; i++) { duck.gain.setValueAtTime(i % 2 ? .05 : 1, t + i * st); if (tapeFx) tapeFx.offset.setValueAtTime(i % 2 ? 0 : rnd(-260, 120), t + i * st); }
    duck.gain.setValueAtTime(1, t + n * st); if (tapeFx) tapeFx.offset.setValueAtTime(0, t + n * st);
    hooks.found('skip');
  }
  function reverseLine() { var tt = tones(), t = T() + .1; for (var i = 0; i < 5; i++) bell(pick(tt), .07, rnd(-.6, .6), t + i * 1.1, { atk: rnd(.8, 1.3), rev: true, ratio: 2, idx: 1.2 }); }

  var nextSurprise = T() + rnd(75, 140), oddUntil = 0, uT = 0, prevMode = 0;

  // ---------- public ----------
  return {
    update: function (s) {
      if (!ok()) return;
      var t = T();
      if (s.agit > .3 && !s.sleep) runDrill(Math.min(1, s.agit));
      else if (dOn && (s.agit < .15 || s.sleep)) dOn = false;
      if (s.mode === 2 && prevMode !== 2) zip(s.mx);
      prevMode = s.mode;

      // bells drift in at a rate set by how much is happening
      if (!s.sleep && !dOn) {
        var rate = .09 + Math.min(.6, s.activity * .6) + (s.mode === 1 ? .22 : 0) + s.wells * .05;
        if (Math.random() < rate * s.dt) {
          var tt = tones(), m = pick(tt);
          bell(m, rnd(.03, .07), s.mode === 1 ? s.mx * 1.6 - .8 : rnd(-.7, .7), 0, { det: Math.random() < .14 ? rnd(-38, 38) : rnd(-6, 6) });
        }
      }
      if (t > nextChord && t > oddUntil) {
        ci = (ci + 1 + (Math.random() < .25 ? 1 : 0)) % CH.length; setChord(CH[ci], 1.3); nextChord = t + rnd(14, 22);
      }
      if (t > nextSurprise && !s.sleep && !dOn) {
        var r = Math.random();
        if (r < .4) skip();
        else if (r < .7) { setChord(ODD, 2); oddUntil = t + 12; nextChord = t + 12; }
        else reverseLine();
        nextSurprise = t + rnd(80, 170);
      }

      // wells
      var set = s.wellList;
      for (var i = 0; i < set.length; i++) {
        var w = set[i]; if (!w.snd) wellOn(w);
        var sn = w.snd; if (sn.rel) continue;
        sn.g.gain.setTargetAtTime(.032 * Math.max(0, w.f || 0), t, .12);
        sn.o.detune.setTargetAtTime(-(w.m - 1) * 140, t, .2); sn.o2.detune.setTargetAtTime(-(w.m - 1) * 140, t, .2);
        if (sn.p.pan) sn.p.pan.setTargetAtTime(clamp(w.x / s.W * 2 - 1, -1, 1), t, .2);
      }
      for (var j = wellV.length - 1; j >= 0; j--) if (set.indexOf(wellV[j]) < 0) { wellOff(wellV[j]); wellV.splice(j, 1); }

      // continuous controls, ~20 times a second
      if (t - uT < .05) return; uT = t;
      tone.frequency.setTargetAtTime(7000 - 6400 * s.sleepK, t, .3);
      padF.frequency.setTargetAtTime((520 + (s.mode === 1 ? 1900 * (1 - s.my) : 500) + 1400 * s.agit + 900 * s.shape) * (1 - .55 * s.sleepK), t, .4);
      airF.frequency.setTargetAtTime(260 + 2600 * (1 - s.my), t, .3);
      airG.gain.setTargetAtTime(.012 + .03 * s.agit, t, .3);
      eyeG.gain.setTargetAtTime(s.mode === 4 ? .016 : 0, t, s.mode === 4 ? 1.6 : .25);
      padBus.gain.setTargetAtTime(dOn ? .35 : 1, t, dOn ? .08 : .9);
      wowDepth.gain.setTargetAtTime(8 + 30 * s.sleepK + 14 * s.split, t, .5);
      pads.forEach(function (p, i) {
        var side = i % 2 ? 1 : -1;
        if (p.p.pan) p.p.pan.setTargetAtTime(p.base * (1 - s.split) + side * .85 * s.split, t, .5);
        p.b.detune.setTargetAtTime(7 + (side > 0 ? 50 * s.split : 0), t, .6);   // the two cells drift a quarter tone apart
        p.a.detune.setTargetAtTime(-6 + (side > 0 ? 50 * s.split : 0), t, .6);
      });
    },
    sleep: function () { if (!tapeSleep) return; tapeSleep.offset.cancelScheduledValues(T()); tapeSleep.offset.setTargetAtTime(-320, T(), 3.5); },
    wake: function () {
      if (tapeSleep) { tapeSleep.offset.cancelScheduledValues(T()); tapeSleep.offset.setTargetAtTime(0, T(), .12); }
      if (ok()) { var t = T(); kick(t, .5, tone); bell(chord.v[0] + 24, .08, 0, t + .1, { dec: 3 }); }
    },
    pop: function (w) { if (!ok()) return; var t = T(); chirp(t, 160, 2600, .3); chirp(t + .05, 2600, 300, .15); wellOff(w, .04); },
    merge: function (w, o) {
      if (!ok()) return;
      if (w.snd && o.snd) { var t = T(); w.snd.o.frequency.setTargetAtTime(o.snd.f, t, .12); w.snd.o2.frequency.setTargetAtTime(o.snd.f * 2.003, t, .12); wellOff(w, .5); bell(Math.round(69 + 12 * Math.log2(o.snd.f / 440)) + 24, .08, 0, t, { dec: 2.5 }); }
    },
    nova: function () {
      if (!ok()) return;
      var t = T();
      kick(t, 1, tone);
      chord.v.forEach(function (m) { bell(m + 12, .1, rnd(-.8, .8), t, { dec: 5, idx: 3 }); });
      var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(9000, t); f.frequency.exponentialRampToValueAtTime(180, t + 1.8);
      var g = ctx.createGain(); g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.001, t + 2);
      s.connect(f); f.connect(g); g.connect(tone); g.connect(verbIn); s.start(t); s.stop(t + 2.1);
      // the tape runs down, everything stops, then it spins back up
      if (tapeFx) { tapeFx.offset.cancelScheduledValues(t); tapeFx.offset.setValueAtTime(0, t + .35); tapeFx.offset.linearRampToValueAtTime(-2400, t + 1.5); tapeFx.offset.setValueAtTime(-1400, t + 3.3); tapeFx.offset.setTargetAtTime(0, t + 3.3, .22); }
      duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(1, t + 1); duck.gain.linearRampToValueAtTime(0, t + 1.5); duck.gain.setValueAtTime(0, t + 3.3); duck.gain.linearRampToValueAtTime(1, t + 3.8);
    },
    key: function (ch) {
      if (!ok()) return;
      var tt = tones().concat(chord.v.map(function (m) { return m + 36; })), c = ch.charCodeAt(0), m = tt[c % tt.length];
      if (ch >= '0' && ch <= '9') { var t = T(); kick(t, .6); snare(t + SX, .4, 1 + (c - 48) * .1); return; }
      if (ch !== ch.toLowerCase()) bell(m, .08, ((c % 7) - 3) / 4, 0, { atk: .6, rev: true, ratio: 2 });
      else box(m, .08, ((c % 7) - 3) / 4, 0);
    },
    pulse: function () { if (!ok()) return; var t = T(); kick(t, .55, tone); kick(t + .2, .35, tone); },
    shape: function (idx) { if (!ok()) return; setChord(CH[idx % CH.length], .9); nextChord = T() + 16; phrase(idx * 977 + 13, 7 + idx % 3); },
    stop: function () {
      alive = false; var t = T();
      bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, .12);
      wellV.forEach(function (w) { wellOff(w, .05); });
      setTimeout(function () { live.forEach(function (n) { try { n.stop(); } catch (e) {} }); try { bus.disconnect(); pitch.disconnect(); } catch (e) {} }, 700);
    }
  };
};
