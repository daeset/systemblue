/* 02 - Palimpsest: interpretive audio.
   Three moods. A drawing voice whose pitch follows height; drawing WITH an old current makes it consonant
   (a fifth opens above it), drawing AGAINST one makes it beat and sour; being bent by history adds vibrato.
   A low bed grows richer as the hidden field fills up. Crossing old ground plucks it. Erasing scrapes,
   and the scrape leaves a low knock - the inscription. SBL.palimpsestSound(A) -> engine */
SBL.palimpsestSound = function (A) {
  'use strict';
  var ctx = A.ctx, alive = true;
  function T() { return ctx.currentTime; }
  function ok() { return alive && ctx.state === 'running'; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function panner(v) { if (!ctx.createStereoPanner) return ctx.createGain(); var p = ctx.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; }

  var MOODS = {
    choir: { scale: [0, 3, 5, 7, 10], root: 50, wave: 'sawtooth', cut: 1400, q: 6, verb: .55, pluck: 'bell', bedWave: 'sine' },
    glass: { scale: [0, 2, 4, 6, 7, 9, 11], root: 62, wave: 'sine', cut: 6000, q: 1, verb: .45, pluck: 'glass', bedWave: 'triangle' },
    tape: { scale: [0, 2, 3, 5, 7, 9, 10], root: 45, wave: 'triangle', cut: 900, q: 2, verb: .3, pluck: 'string', bedWave: 'sawtooth' }
  };
  var M = MOODS.choir;

  var out = ctx.createGain(); out.gain.value = 0; out.connect(A.out); out.gain.setTargetAtTime(1.2, T(), .4);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(out);
  // tape wobble shared by everything (depth depends on mood)
  var wob = ctx.createOscillator(), wobG = ctx.createGain(); wob.frequency.value = .7; wobG.gain.value = 0; wob.connect(wobG); wob.start();
  var dry = ctx.createGain(); dry.connect(comp);
  var verb = ctx.createConvolver(); verb.buffer = (function () { var n = Math.floor(ctx.sampleRate * 3.2), b = ctx.createBuffer(2, n, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), l = 0; for (var i = 0; i < n; i++) { var k = i / n, a = .2 + .7 * k; l = l * a + (Math.random() * 2 - 1) * (1 - a); d[i] = l * Math.pow(1 - k, 2) * 2.2; } } return b; })();
  var wet = ctx.createGain(); wet.gain.value = M.verb; wet.connect(verb); verb.connect(comp);
  var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); (function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; })(noiseBuf.getChannelData(0));
  function route(node, pan, w) { var p = panner(pan); node.connect(p); p.connect(dry); var s = ctx.createGain(); s.gain.value = w == null ? .5 : w; p.connect(s); s.connect(wet); return p; }
  function env(g, t, v, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return t + a + d + .05; }
  function note(y01, oct) { var sc = M.scale, steps = sc.length * 2, d = Math.round((1 - clamp(y01, 0, 1)) * (steps - 1)); return M.root + (oct || 0) + sc[d % sc.length] + 12 * Math.floor(d / sc.length); }

  // ---- the bed: memory made audible ----
  var bed = { g: ctx.createGain(), lp: ctx.createBiquadFilter(), osc: [], nz: null, nzG: ctx.createGain() };
  bed.lp.type = 'lowpass'; bed.lp.frequency.value = 300; bed.g.gain.value = 0; bed.lp.connect(bed.g); route(bed.g, 0, .8);
  [0, 7, 12, 15, 19].forEach(function (iv, i) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = mtof(M.root - 12 + iv); o.detune.value = (i - 2) * 4; g.gain.value = i < 2 ? .5 : 0; o.connect(g); g.connect(bed.lp); wobG.connect(o.detune); o.start(); bed.osc.push({ o: o, g: g, iv: iv }); });
  bed.nz = ctx.createBufferSource(); bed.nz.buffer = noiseBuf; bed.nz.loop = true; var nzF = ctx.createBiquadFilter(); nzF.type = 'bandpass'; nzF.frequency.value = 500; nzF.Q.value = .7; bed.nz.connect(nzF); nzF.connect(bed.nzG); bed.nzG.gain.value = 0; bed.nzG.connect(bed.lp); bed.nz.start();
  function retuneBed() { var t = T(); bed.osc.forEach(function (b) { b.o.type = M.bedWave; b.o.frequency.setTargetAtTime(mtof(M.root - 12 + b.iv), t, .8); }); }

  // ---- drawing voice ----
  var voice = null;
  function vStart(x, y) {
    if (!ok() || voice) return; var t = T();
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o5 = ctx.createOscillator(), g5 = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain(), vib = ctx.createOscillator(), vibG = ctx.createGain();
    o1.type = o2.type = M.wave; o5.type = 'sine'; f.type = M.q > 3 ? 'bandpass' : 'lowpass'; f.frequency.value = M.cut; f.Q.value = M.q;
    var fr = mtof(note(y)); o1.frequency.value = fr; o2.frequency.value = fr; o5.frequency.value = fr * 1.5; g5.gain.value = 0;
    vib.frequency.value = 5.5; vibG.gain.value = 0; vib.connect(vibG); vibG.connect(o1.detune); vibG.connect(o2.detune); wobG.connect(o1.detune);
    o1.connect(f); o2.connect(f); o5.connect(g5); g5.connect(f); f.connect(g); var p = route(g, x * 2 - 1, .55);
    g.gain.value = 0; g.gain.setTargetAtTime(M.wave === 'sawtooth' ? .05 : .09, t, .04);
    [o1, o2, o5, vib].forEach(function (o) { o.start(t); });
    voice = { o1: o1, o2: o2, o5: o5, g5: g5, f: f, g: g, vibG: vibG, p: p, all: [o1, o2, o5, vib] };
  }
  function vMove(x, y, speed, align, bend) {
    if (!voice) return; var t = T(), fr = mtof(note(y));
    voice.o1.frequency.setTargetAtTime(fr, t, .05); voice.o2.frequency.setTargetAtTime(fr, t, .05); voice.o5.frequency.setTargetAtTime(fr * 1.5, t, .08);
    voice.o2.detune.setTargetAtTime(align < 0 ? -align * 45 : 3, t, .1);        // against the current: beating
    voice.g5.gain.setTargetAtTime(align > 0 ? align * .6 : 0, t, .15);          // with it: the fifth opens
    voice.vibG.gain.setTargetAtTime(Math.min(40, bend * .5), t, .1);             // bent by history: it wavers
    voice.f.frequency.setTargetAtTime(M.cut * (.6 + Math.min(1.4, speed / 1500)), t, .08);
    if (voice.p.pan) voice.p.pan.setTargetAtTime(clamp(x * 2 - 1, -1, 1), t, .08);
  }
  function vEnd() { if (!voice) return; var v = voice; voice = null; var t = T(); v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, M.wave === 'sawtooth' ? .25 : .12); setTimeout(function () { v.all.forEach(function (o) { try { o.stop(); } catch (e) {} }); }, 1600); }

  // ---- plucks on old ground ----
  var lastPluck = 0;
  function pluck(y, strength, pan, oct) {
    if (!ok()) return; var t = T(); var m = note(y, oct == null ? 12 : oct), v = .03 + .07 * clamp(strength, 0, 1);
    if (M.pluck === 'bell') { [1, 2.76, 5.4].forEach(function (r, i) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = mtof(m) * r; o.connect(g); var e = env(g, t, v / (i + 1), .004, 1.6 / (i + 1)); route(g, pan, .7); o.start(t); o.stop(e); }); }
    else if (M.pluck === 'glass') { var c = ctx.createOscillator(), mo = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), f = mtof(m + 12); c.frequency.value = f; mo.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(f * .02, t + .8); mo.connect(mg); mg.connect(c.frequency); c.connect(g); var e2 = env(g, t, v, .002, 1.1); route(g, pan, .8); c.start(t); mo.start(t); c.stop(e2); mo.stop(e2); }
    else { var s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g3 = ctx.createGain(); s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = mtof(m); bp.Q.value = 30; s.connect(bp); bp.connect(g3); var e3 = env(g3, t, v * 6, .002, .5); route(g3, pan, .4); s.start(t, Math.random()); s.stop(e3); }
  }

  // ---- erasing ----
  var scr = null;
  function eStart(x) {
    if (!ok() || scr) return; var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.4;
    s.connect(f); f.connect(g); g.gain.value = 0; var p = route(g, x * 2 - 1, .3); s.start(); scr = { s: s, f: f, g: g, p: p };
  }
  function eMove(x, speed) { if (!scr) return; var t = T(); scr.g.gain.setTargetAtTime(Math.min(.14, speed / 9000), t, .03); scr.f.frequency.setTargetAtTime(900 + Math.min(4000, speed * 2), t, .05); if (scr.p.pan) scr.p.pan.setTargetAtTime(clamp(x * 2 - 1, -1, 1), t, .05); }
  function eEnd(amount) {
    if (scr) { var s = scr; scr = null; s.g.gain.setTargetAtTime(0, T(), .05); setTimeout(function () { try { s.s.stop(); } catch (e) {} }, 400); }
    if (!ok() || !amount) return; var t = T() + .08, o = ctx.createOscillator(), g = ctx.createGain(); // the knock: erasure written into the field
    o.type = 'sine'; o.frequency.setValueAtTime(mtof(M.root - 12) * 2, t); o.frequency.exponentialRampToValueAtTime(mtof(M.root - 12), t + .25); o.connect(g); var e = env(g, t, .12 + .1 * clamp(amount, 0, 1), .005, .9); route(g, 0, .9); o.start(t); o.stop(e);
  }

  return {
    setMood: function (k) { if (!MOODS[k]) return; M = MOODS[k]; var t = T(); wet.gain.setTargetAtTime(M.verb, t, .3); wobG.gain.setTargetAtTime(k === 'tape' ? 14 : 2, t, .3); wob.frequency.setTargetAtTime(k === 'tape' ? .55 : 3, t, .3); retuneBed(); },
    bed: function (level, scars) { // 0..1 how full the field is; 0..1 how much has been erased
      if (!ok()) return; var t = T(); level = clamp(level, 0, 1);
      bed.g.gain.setTargetAtTime(.02 + level * .12, t, 1.2); bed.lp.frequency.setTargetAtTime(220 + level * 1600, t, 1.5);
      bed.osc.forEach(function (b, i) { b.g.gain.setTargetAtTime(i < 2 ? .5 : clamp(level * 4 - (i - 1), 0, 1) * .35, t, 1.5); });
      bed.nzG.gain.setTargetAtTime(clamp(scars, 0, 1) * (M === MOODS.tape ? .35 : .15), t, 1.5);
    },
    drawStart: vStart, drawMove: vMove, drawEnd: vEnd,
    touchPast: function (y, strength, x) { var n = performance.now(); if (n - lastPluck < 110) return; lastPluck = n; pluck(y, strength, x * 2 - 1); },
    eraseStart: eStart, eraseMove: eMove, eraseEnd: eEnd,
    reveal: function () { if (!ok()) return; var t = T(); [0, 7, 12, 16, 19, 24].forEach(function (iv, i) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = mtof(M.root + 12 + iv); o.connect(g); var e = env(g, t + i * .07, .025, .4, 2.5); route(g, (i / 5) * 2 - 1, .9); o.start(t + i * .07); o.stop(e); }); },
    scrape: function () { if (!ok()) return; var t = T(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + 1.1); s.connect(f); f.connect(g); var e = env(g, t, .12, .05, 1.2); route(g, 0, .5); s.start(t); s.stop(e); },
    dream: function (y, x) { pluck(y, .4, x * 2 - 1, 0); },
    // a whirlpool: noise spun through a sweeping filter, panned around, with a chord settling underneath
    whirl: function (dir, y) {
      if (!ok()) return; var t = T(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = panner(0); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 9;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3200, t + 1.4); f.frequency.exponentialRampToValueAtTime(500, t + 2.6);
      s.connect(f); f.connect(g); g.connect(p); p.connect(dry); var w = ctx.createGain(); w.gain.value = .5; p.connect(w); w.connect(wet); var e = env(g, t, .16, .5, 2.2);
      if (p.pan) { for (var i = 0; i <= 12; i++) p.pan.setValueAtTime(Math.sin(i * .9) * dir * .9, t + i * .2); } s.start(t); s.stop(e);
      [0, 7, 12].forEach(function (iv, i) { var o = ctx.createOscillator(), g2 = ctx.createGain(); o.type = 'sine'; o.frequency.value = mtof(note(y, -12) + iv); o.connect(g2); var e2 = env(g2, t + .9 + i * .12, .04, .3, 2.4); route(g2, 0, .8); o.start(t + .9 + i * .12); o.stop(e2); });
    },
    // a stone inside a loop rings like a small bell
    bell: function (y, x, i) { if (!ok()) return; var t = T(), m = note(y, 24) + (i || 0) * 0; [1, 2.4, 3.9, 5.2].forEach(function (r, k) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = mtof(m) * r; o.connect(g); var e = env(g, t, .06 / (k + 1), .002, 2.8 / (k * .6 + 1)); route(g, x * 2 - 1, .9); o.start(t); o.stop(e); }); },
    // tearing against the grain
    cut: function () {
      if (!ok()) return; var t = T();
      for (var i = 0; i < 14; i++) { var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 1500 + Math.random() * 4000; s.connect(f); f.connect(g); var at = t + i * .022 + Math.random() * .01; env(g, at, .09 * (1 - i / 16), .001, .03); route(g, Math.random() * 1.4 - .7, .2); s.start(at, Math.random()); s.stop(at + .06); }
      var o = ctx.createOscillator(), g2 = ctx.createGain(); o.type = M.wave; o.frequency.setValueAtTime(mtof(M.root), t); o.frequency.exponentialRampToValueAtTime(mtof(M.root - 13), t + .6); var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; o.connect(lp); lp.connect(g2); var e = env(g2, t, .08, .01, .8); route(g2, 0, .4); o.start(t); o.stop(e);
    },
    // ink pooling: a slow low drip that deepens
    pool: function (level, y) { if (!ok()) return; var t = T(), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; var f0 = mtof(note(y, -12)) * (1 - level * .3); o.frequency.setValueAtTime(f0 * 1.6, t); o.frequency.exponentialRampToValueAtTime(f0, t + .12); o.connect(g); var e = env(g, t, .08 + level * .08, .003, .5 + level); route(g, 0, .7); o.start(t); o.stop(e); },
    // scars growing: a slow upward scatter of plucks
    bloom: function () { if (!ok()) return; for (var i = 0; i < 9; i++) (function (i) { setTimeout(function () { pluck(1 - i / 9, .5, Math.sin(i * 2.1) * .8, 0); }, i * 160); })(i); },
    resonance: function (y) { pluck(y, 1, 0, 24); },
    stop: function () { alive = false; vEnd(); eEnd(0); var t = T(); out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, .1); setTimeout(function () { try { bed.osc.forEach(function (b) { b.o.stop(); }); bed.nz.stop(); wob.stop(); out.disconnect(); } catch (e) {} }, 600); }
  };
};
