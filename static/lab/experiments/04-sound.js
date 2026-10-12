/* 04 — Infinite Composition: generative score.
   The composition is the score. A sweep passes each shape and plays it:
   shape family picks the instrument, distance from the centre picks the pitch, size picks the octave.
   Symmetry therefore becomes rhythm, and entropy becomes looseness.
   SBL.compositionSound(A) -> { note, hover, compose, grid, scatter, rewind, turn, freeze, setMood, setKey, setEntropy, stop } */
SBL.compositionSound = function (A) {
  'use strict';
  var ctx = A.ctx, alive = true, voices = 0, live = [];
  function T() { return ctx.currentTime; }
  function ok() { return alive && ctx.state === 'running'; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function panner(v) { if (!ctx.createStereoPanner) return ctx.createGain(); var p = ctx.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; }

  // ---------- moods ----------
  var MOODS = {
    glass:  { bar: 9.6, scale: [0, 2, 4, 7, 9], oct: 0, wet: .75, drone: [{ i: -24, w: 'sine', g: .05 }, { i: -17, w: 'sine', g: .03 }], v: { circle: 'bell', line: 'pluck', arc: 'pad', poly: 'bell2', dots: 'tick' } },
    pulse:  { bar: 3.2, scale: [0, 2, 3, 5, 7, 9, 10], oct: 0, wet: .28, drone: [{ i: -24, w: 'triangle', g: .035 }], grid: true, v: { circle: 'marimba', line: 'marimba', arc: 'bass', poly: 'click', dots: 'tick' } },
    drift:  { bar: 16, scale: [0, 2, 4, 6, 7, 9, 11], oct: -12, wet: .92, drone: [{ i: -24, w: 'sawtooth', g: .022 }, { i: -17, w: 'sawtooth', g: .016 }, { i: -10, w: 'triangle', g: .018 }], v: { circle: 'swell', line: 'swell', arc: 'swell', poly: 'shimmer', dots: 'shimmer' } },
    static: { bar: 4.8, scale: [0, 1, 5, 6, 10], oct: 12, wet: .35, drone: [], dust: true, grid: true, v: { circle: 'ping', line: 'burst', arc: 'zap', poly: 'click', dots: 'click' } }
  };
  var mood = MOODS.glass, moodKey = 'glass', root = 60, ent = .3;

  // ---------- master chain ----------
  var bus = ctx.createGain(); bus.gain.value = 0; bus.connect(A.out); bus.gain.setTargetAtTime(.85, T(), 1);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(bus);
  var tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 12000; tone.Q.value = .3; tone.connect(comp);
  var dry = ctx.createGain(); dry.connect(tone);
  var verb = ctx.createConvolver(); verb.buffer = (function (sec) {
    var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), lp = 0; for (var i = 0; i < n; i++) { var k = i / n, a = .25 + .6 * k; lp = lp * a + (Math.random() * 2 - 1) * (1 - a); d[i] = lp * Math.pow(1 - k, 2.2) * 2; } }
    return b;
  })(3.8);
  var wet = ctx.createGain(); wet.gain.value = mood.wet; wet.connect(verb); verb.connect(tone);
  var crush = ctx.createWaveShaper(); crush.curve = (function (L) { var n = 2048, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.round(x * L) / L; } return c; })(9);
  var crushIn = ctx.createGain(); crushIn.connect(crush); crush.connect(dry); var crushWet = ctx.createGain(); crushWet.gain.value = .25; crush.connect(crushWet); crushWet.connect(wet);

  var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  (function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; })(noiseBuf.getChannelData(0));

  // spin wind
  var wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true; live.push(wind);
  var windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.Q.value = 1.4; windF.frequency.value = 400;
  var windG = ctx.createGain(); windG.gain.value = 0; wind.connect(windF); windF.connect(windG); windG.connect(dry); windG.connect(wet); wind.start();

  // ---------- drone ----------
  var drone = null;
  function makeDrone() {
    var old = drone, t = T();
    if (old) { old.g.gain.cancelScheduledValues(t); old.g.gain.setTargetAtTime(0, t, .8); setTimeout(function () { old.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); old.g.disconnect(); }, 5000); }
    var g = ctx.createGain(); g.gain.value = 0; var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = moodKey === 'drift' ? 700 : 1400;
    g.connect(f); f.connect(dry); f.connect(wet);
    var nodes = [], oscs = [];
    mood.drone.forEach(function (d, k) {
      var o = ctx.createOscillator(); o.type = d.w; o.frequency.value = mtof(root + d.i); o.detune.value = rnd(-5, 5);
      var og = ctx.createGain(); og.gain.value = d.g; o.connect(og); og.connect(g); o.start(); nodes.push(o); oscs.push({ o: o, i: d.i });
      var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rnd(.05, .13); lg.gain.value = d.g * .5; l.connect(lg); lg.connect(og.gain); l.start(); nodes.push(l);
    });
    if (mood.dust) {
      var db = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), dd = db.getChannelData(0);
      for (var k = 0; k < 90; k++) { var p = Math.floor(Math.random() * (dd.length - 30)), a = Math.pow(Math.random(), 2.5); for (var j = 0; j < 20; j++) dd[p + j] += a * (j % 2 ? -1 : 1) * Math.exp(-j / 3); }
      var ds = ctx.createBufferSource(); ds.buffer = db; ds.loop = true; var dg = ctx.createGain(); dg.gain.value = .12; ds.connect(dg); dg.connect(g); ds.start(); nodes.push(ds);
    }
    g.gain.setTargetAtTime(1, t, 1.2);
    drone = { g: g, nodes: nodes, oscs: oscs };
  }
  makeDrone();

  // ---------- instruments ----------
  function env(g, t, v, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return t + a + d + .05; }
  function out(node, pan, sendAmt, toCrush) {
    var p = panner(pan); node.connect(p);
    if (toCrush) p.connect(crushIn); else { p.connect(dry); var s = ctx.createGain(); s.gain.value = sendAmt; p.connect(s); s.connect(wet); }
    return p;
  }
  function done(o, end, extra) { voices++; o.stop(end); o.onended = function () { voices--; if (extra) extra.forEach(function (n) { try { n.disconnect(); } catch (e) {} }); }; }
  function osc(type, f) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }

  var INST = {
    bell: function (f, v, pan, t, ratio) {
      var c = osc('sine', f), m = osc('sine', f * (ratio || 3.5)), mg = ctx.createGain(), g = ctx.createGain();
      mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * .02, t + 1.6); m.connect(mg); mg.connect(c.frequency);
      var end = env(g, t, v, .005, 2.6); c.connect(g); var p = out(g, pan, .9);
      c.start(t); m.start(t); m.stop(end); done(c, end, [g, p]);
    },
    bell2: function (f, v, pan, t) { INST.bell(f, v * .8, pan, t, 2.01); },
    pluck: function (f, v, pan, t) {
      var a = osc('triangle', f), b = osc('sawtooth', f * 1.002), bg = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      bg.gain.value = .3; lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(500, t + .35);
      a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g); var end = env(g, t, v, .003, .9); var p = out(g, pan, .6);
      a.start(t); b.start(t); b.stop(end); done(a, end, [g, p]);
    },
    pad: function (f, v, pan, t) {
      var a = osc('sawtooth', f), b = osc('sawtooth', f); a.detune.value = -9; b.detune.value = 9;
      var lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1100;
      a.connect(lp); b.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .45, t + .7); g.gain.setTargetAtTime(0, t + 1.4, .7); var end = t + 5;
      var p = out(g, pan, 1); a.start(t); b.start(t); b.stop(end); done(a, end, [g, p]);
    },
    marimba: function (f, v, pan, t) {
      var a = osc('sine', f), b = osc('sine', f * 3.98), bg = ctx.createGain(), g = ctx.createGain();
      bg.gain.setValueAtTime(.35, t); bg.gain.exponentialRampToValueAtTime(.001, t + .12);
      a.connect(g); b.connect(bg); bg.connect(g); var end = env(g, t, v, .002, .5); var p = out(g, pan, .3);
      a.start(t); b.start(t); b.stop(end); done(a, end, [g, p]);
    },
    bass: function (f, v, pan, t) {
      var a = osc('sine', f / 2), b = osc('triangle', f / 2), g = ctx.createGain(), bg = ctx.createGain(); bg.gain.value = .4;
      a.connect(g); b.connect(bg); bg.connect(g); var end = env(g, t, v * 1.3, .004, .9); var p = out(g, pan * .3, .15);
      a.start(t); b.start(t); b.stop(end); done(a, end, [g, p]);
    },
    click: function (f, v, pan, t) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf; var hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = clamp(f * 6, 1500, 9000); hp.Q.value = 3;
      var g = ctx.createGain(); s.connect(hp); hp.connect(g); var end = env(g, t, v * 1.6, .001, .03); var p = out(g, pan, .3, moodKey === 'static');
      s.start(t, Math.random()); done(s, end, [g, p]);
    },
    tick: function (f, v, pan, t) {
      var a = osc('sine', clamp(f * 8, 2000, 6000)), g = ctx.createGain(); a.connect(g); var end = env(g, t, v * .6, .001, .025); var p = out(g, pan, .5);
      a.start(t); done(a, end, [g, p]);
    },
    swell: function (f, v, pan, t) {
      var a = osc('sine', f), b = osc('triangle', f * 2.002), bg = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      bg.gain.value = .18; lp.type = 'lowpass'; lp.frequency.value = 1600; a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .8, t + 1.8); g.gain.setTargetAtTime(0, t + 2.2, 1.2); var end = t + 8;
      var p = out(g, pan, 1); a.start(t); b.start(t); b.stop(end); done(a, end, [g, p]);
    },
    shimmer: function (f, v, pan, t) {
      var a = osc('sine', f * 2), b = osc('sine', f * 2 * 1.004), g = ctx.createGain(); a.connect(g); b.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .35, t + .9); g.gain.exponentialRampToValueAtTime(.0001, t + 4.5); var end = t + 4.6;
      var p = out(g, pan, 1); a.start(t); b.start(t); b.stop(end); done(a, end, [g, p]);
    },
    ping: function (f, v, pan, t) {
      var a = osc('sine', f * 2 * Math.pow(2, rnd(-.3, .3) * ent)), g = ctx.createGain(); a.connect(g); var end = env(g, t, v, .001, .22); var p = out(g, pan, .3, true);
      a.start(t); done(a, end, [g, p]);
    },
    burst: function (f, v, pan, t) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf; var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = clamp(f * 4, 300, 8000); bp.Q.value = 9;
      var g = ctx.createGain(); s.connect(bp); bp.connect(g); var end = env(g, t, v * 2.5, .001, .12); var p = out(g, pan, .2, true);
      s.start(t, Math.random()); done(s, end, [g, p]);
    },
    zap: function (f, v, pan, t) {
      var a = osc('square', f * 4), g = ctx.createGain(); a.frequency.setValueAtTime(f * 4, t); a.frequency.exponentialRampToValueAtTime(f / 2, t + .16);
      a.connect(g); var end = env(g, t, v * .5, .001, .18); var p = out(g, pan, .2, true); a.start(t); done(a, end, [g, p]);
    }
  };

  function pitch(rad, tier) {
    var sc = mood.scale, span = sc.length * 2, d = Math.floor(clamp(1 - rad / 1.25, 0, .999) * span);
    var m = root + mood.oct + [-12, 0, 12][tier] + sc[d % sc.length] + 12 * Math.floor(d / sc.length);
    if (Math.random() < ent * .22) m += pick([-1, 1]);
    return m;
  }
  function play(cls, rad, tier, vel, pan, delay) {
    if (!ok() || voices > 30) return;
    var inst = mood.v[cls] || 'bell', t = T() + .035 + Math.max(-.03, delay || 0) + (Math.random() - .5) * ent * .04;
    var f = mtof(pitch(rad, tier)) * Math.pow(2, rnd(-1, 1) * ent * 30 / 1200);
    INST[inst](f, vel, pan, t);
  }

  var wT = 0;
  return {
    note: function (cls, rad, tier, vel, pan, delay) { play(cls, rad, tier, vel, pan, delay); },
    hover: function (cls, rad, tier, pan) { play(cls, rad, tier, .09, pan, 0); },
    grid: function (step, delay) {
      if (!ok() || !mood.grid) return; var t = T() + .035 + Math.max(-.03, delay || 0);
      if (moodKey === 'pulse') {
        if (step % 2 === 0) INST.click(1400, step % 4 === 2 ? .05 : .025, step % 8 < 4 ? -.3 : .3, t);
        if (step === 0 || step === 10) INST.bass(mtof(root - 12), .16, 0, t);
      } else if (Math.random() < .18 + ent * .4) INST.click(rnd(400, 1600), .04, rnd(-.8, .8), t);
    },
    compose: function (golden) {
      if (!ok()) return; var t = T() + .05, sc = mood.scale;
      if (golden) { [0, 4, 7, 11, 14, 19].forEach(function (s, i) { INST.bell(mtof(root + s), .07, (i - 2.5) / 3, t + i * .09); }); return; }
      for (var i = 0; i < 4; i++) INST.bell(mtof(root + 12 + sc[(i * 2) % sc.length] + (i > 2 ? 12 : 0)), .05, (i - 1.5) / 2, t + i * .07, 3.5);
    },
    scatter: function () {
      if (!ok()) return; var t = T();
      var s = ctx.createBufferSource(); s.buffer = noiseBuf; var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(5000, t + .4);
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + .05); g.gain.exponentialRampToValueAtTime(.001, t + .7);
      s.connect(bp); bp.connect(g); g.connect(dry); g.connect(wet); s.start(t); s.stop(t + .75);
      for (var i = 0; i < 6; i++) INST.pluck(mtof(root + 24 - i * 3 + mood.scale[i % mood.scale.length]), .05, rnd(-.9, .9), t + .3 + i * .08);
    },
    rewind: function () {
      if (!ok()) return; var t = T(), f = mtof(root + 12), a = osc('sine', f), g = ctx.createGain(); a.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .45); g.gain.linearRampToValueAtTime(0, t + .48);
      var p = out(g, 0, 1); a.start(t); done(a, t + .5, [g, p]);
    },
    turn: function (v) {
      var t = T(), a = clamp(Math.abs(v) / 6, 0, 1);
      windG.gain.setTargetAtTime(a * .09, t, .1); windF.frequency.setTargetAtTime(250 + a * 2600, t, .1);
    },
    freeze: function (on) { var t = T(); tone.frequency.cancelScheduledValues(t); tone.frequency.setTargetAtTime(on ? 650 : 12000, t, on ? .25 : .6); },
    setMood: function (k) {
      if (!MOODS[k] || k === moodKey) return; moodKey = k; mood = MOODS[k];
      wet.gain.setTargetAtTime(mood.wet, T(), .5); makeDrone();
    },
    setKey: function (r) {
      if (r === root) return; root = r; var t = T();
      if (drone) drone.oscs.forEach(function (d) { d.o.frequency.setTargetAtTime(mtof(root + d.i), t, .9); });
    },
    setEntropy: function (e) { ent = e; },
    bar: function () { return mood.bar; },
    stop: function () {
      alive = false; var t = T(); bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, .1);
      setTimeout(function () { live.forEach(function (n) { try { n.stop(); } catch (e) {} }); if (drone) drone.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); try { bus.disconnect(); } catch (e) {} }, 600);
    }
  };
};
