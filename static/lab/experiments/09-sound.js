/* 09 - The Collective: interactive audio.
   Each group in the collective has a voice. United, the voices sit inside one chord; as the collective fragments,
   each group drifts toward its own key and the harmony comes apart. When the groups reunite, it resolves.
   A murmuration bed follows speed and order. The viewer has a voice too (pitch follows the pointer): when the
   collective follows, a fifth opens above it; when it refuses, the call is answered with a semitone.
   SBL.collectiveSound(A) -> engine */
SBL.collectiveSound = function (A) {
  'use strict';
  var ctx = A.ctx, alive = true;
  function T() { return ctx.currentTime; }
  function ok() { return alive && ctx.state === 'running'; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function panner(v) { if (!ctx.createStereoPanner) return ctx.createGain(); var p = ctx.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; }

  var master = ctx.createGain(); master.gain.value = 0; master.connect(A.out); master.gain.setTargetAtTime(1.2, T(), .6);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.connect(master);
  var dry = ctx.createGain(); dry.connect(comp);
  var verb = ctx.createConvolver(); verb.buffer = (function () { var n = Math.floor(ctx.sampleRate * 3.4), b = ctx.createBuffer(2, n, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), l = 0; for (var i = 0; i < n; i++) { var k = i / n; l = l * .6 + (Math.random() * 2 - 1) * .4; d[i] = l * Math.pow(1 - k, 2) * 2; } } return b; })();
  var wet = ctx.createGain(); wet.gain.value = .55; wet.connect(verb); verb.connect(comp);
  var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); (function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; })(noiseBuf.getChannelData(0));
  function env(g, t, v, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return t + a + d + .05; }
  function out(node, pan, w) { var p = panner(pan); node.connect(p); p.connect(dry); var s = ctx.createGain(); s.gain.value = w == null ? .5 : w; p.connect(s); s.connect(wet); return p; }
  function tone(type, f, t, v, a, d, pan, w) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.connect(g); var e = env(g, t, v, a, d); out(g, pan, w); o.start(t); o.stop(e); return o; }
  function burst(t, v, f, q, d, pan) { var s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; s.connect(bp); bp.connect(g); var e = env(g, t, v, .002, d); out(g, pan, .3); s.start(t, Math.random()); s.stop(e); }

  var ROOT = 50, CHORD = [0, 7, 12, 16, 19, 24, 28, 31], SCALE = [0, 2, 4, 7, 9];
  // ---- group voices ----
  var voices = [];
  for (var i = 0; i < 8; i++) {
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = panner(0);
    o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = mtof(ROOT + CHORD[i]); o2.frequency.value = mtof(ROOT + CHORD[i] + 12); o2.detune.value = 4;
    lp.type = 'lowpass'; lp.frequency.value = 900; g.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(p); p.connect(dry); var s = ctx.createGain(); s.gain.value = .8; p.connect(s); s.connect(wet);
    o1.start(); o2.start(); voices.push({ o1: o1, o2: o2, lp: lp, g: g, p: p });
  }
  // ---- murmuration bed ----
  var bed = ctx.createBufferSource(); bed.buffer = noiseBuf; bed.loop = true; var bbp = ctx.createBiquadFilter(); bbp.type = 'bandpass'; bbp.Q.value = 1.2; bbp.frequency.value = 600; var bg = ctx.createGain(); bg.gain.value = 0; bed.connect(bbp); bbp.connect(bg); out(bg, 0, .6); bed.start();
  // ---- the viewer's call ----
  var call = { o: ctx.createOscillator(), o5: ctx.createOscillator(), g: ctx.createGain(), g5: ctx.createGain(), vib: ctx.createOscillator(), vg: ctx.createGain(), p: null };
  call.o.type = 'sine'; call.o5.type = 'sine'; call.vib.frequency.value = 5; call.vg.gain.value = 8; call.vib.connect(call.vg); call.vg.connect(call.o.detune); call.vg.connect(call.o5.detune);
  call.g.gain.value = 0; call.g5.gain.value = 0; call.o.connect(call.g); call.o5.connect(call.g5); call.g5.connect(call.g); call.p = out(call.g, 0, .6); call.o.start(); call.o5.start(); call.vib.start();
  // ---- pressure ----
  var pr = { s: ctx.createBufferSource(), f: ctx.createBiquadFilter(), g: ctx.createGain(), o: ctx.createOscillator(), og: ctx.createGain(), sh: ctx.createWaveShaper() };
  pr.s.buffer = noiseBuf; pr.s.loop = true; pr.f.type = 'lowpass'; pr.f.frequency.value = 200; pr.g.gain.value = 0; pr.s.connect(pr.f); pr.f.connect(pr.g); pr.g.connect(dry); pr.s.start();
  pr.sh.curve = (function () { var n = 1024, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / n * 2 - 1; c[i] = Math.tanh(x * 4); } return c; })();
  pr.o.type = 'sawtooth'; pr.o.frequency.value = mtof(ROOT - 24); pr.og.gain.value = 0; pr.o.connect(pr.sh); pr.sh.connect(pr.og); var plp = ctx.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 500; pr.og.connect(plp); plp.connect(dry); pr.o.start();

  var lastClicks = 0;
  return {
    // groups: [{n, x, y}] sorted by size; frag 0..1; speed 0..1; order 0..1 (polarisation); hush 0..1 (exodus)
    update: function (groups, frag, speed, order, total, away) {
      if (!ok()) return; var t = T(); away = away || 0;
      voices.forEach(function (v, i) {
        var gr = groups[i], on = !!gr && gr.n > total * .02;
        var chordM = ROOT + CHORD[i % CHORD.length], own = gr ? ROOT + 12 + SCALE[Math.floor((1 - gr.y) * 9) % 5] + 12 * Math.floor((1 - gr.y) * 9 / 5) + [0, 1, 6, 11, 3, 8, 10, 5][i] : chordM;
        var m = chordM + (own - chordM) * clamp(frag, 0, 1);
        v.o1.frequency.setTargetAtTime(mtof(m), t, .6); v.o2.frequency.setTargetAtTime(mtof(m + 12), t, .6); v.o2.detune.setTargetAtTime(4 + frag * 30, t, .5);
        v.g.gain.setTargetAtTime(on ? (.012 + .045 * Math.sqrt(gr.n / total)) * (1 - away) : 0, t, .5);
        v.lp.frequency.setTargetAtTime(500 + speed * 2500 + frag * 1500, t, .3); if (v.p.pan && gr) v.p.pan.setTargetAtTime(clamp(gr.x * 2 - 1, -1, 1), t, .4);
      });
      bbp.frequency.setTargetAtTime(300 + speed * 2600, t, .2); bg.gain.setTargetAtTime((.01 + speed * .05 + order * .03) * (1 - away), t, .3);
    },
    call: function (y, x, moving, follow) {
      if (!ok()) return; var t = T(), f = mtof(ROOT + 12 + Math.round((1 - clamp(y, 0, 1)) * 24));
      call.o.frequency.setTargetAtTime(f, t, .06); call.o5.frequency.setTargetAtTime(f * (follow > .35 ? 1.5 : Math.pow(2, 1 / 12)), t, .15);
      call.g.gain.setTargetAtTime(moving ? .03 + moving * .04 : 0, t, moving ? .05 : .4); call.g5.gain.setTargetAtTime(moving ? .6 : 0, t, .2);
      if (call.p.pan) call.p.pan.setTargetAtTime(clamp(x * 2 - 1, -1, 1), t, .1);
    },
    pressure: function (level) { if (!ok()) return; var t = T(); level = clamp(level, 0, 1); pr.g.gain.setTargetAtTime(level * .12, t, .1); pr.f.frequency.setTargetAtTime(200 + level * 3000, t, .1); pr.og.gain.setTargetAtTime(level * level * .06, t, .2); pr.o.frequency.setTargetAtTime(mtof(ROOT - 24 + level * 7), t, .3); },
    leader: function (x, y) { if (!ok()) return; var t = T(), m = ROOT + 24 + SCALE[Math.floor((1 - y) * 5) % 5]; [1, 2.76, 5.4].forEach(function (r, i) { tone('sine', mtof(m) * r, t, .05 / (i + 1), .003, 2.2 / (i + 1), x * 2 - 1, .8); }); },
    answer: function (n, x, y) { if (!ok()) return; var t = T() + .25, m = ROOT + 24 + SCALE[Math.floor((1 - y) * 5) % 5]; for (var i = 0; i < Math.min(14, n); i++) tone('triangle', mtof(m + SCALE[i % 5] + (i > 4 ? 12 : 0)), t + i * .045 + Math.random() * .03, .015, .002, .25, x * 2 - 1 + (Math.random() - .5) * .6, .6); },
    ignored: function (x) { if (!ok()) return; var t = T(); tone('sine', mtof(ROOT + 25), t + .2, .02, .01, .4, x * 2 - 1, .5); },
    mutiny: function () { if (!ok()) return; var t = T(); for (var i = 0; i < 40; i++) burst(t + Math.random() * .8, .04, 400 + Math.random() * 3000, 3, .05, Math.random() * 2 - 1); tone('sawtooth', mtof(ROOT - 12), t, .05, .01, 1, 0, .2); tone('sawtooth', mtof(ROOT - 11), t, .05, .01, 1, 0, .2); },
    fragment: function () { if (!ok()) return; var t = T(); [0, 1, 6, 11].forEach(function (iv, i) { tone('triangle', mtof(ROOT + 12 + iv), t + i * .02, .03, .005, .8, (i - 1.5) / 2, .5); }); },
    reunite: function () { if (!ok()) return; var t = T(); [0, 7, 12, 16, 19, 24].forEach(function (iv, i) { tone('sine', mtof(ROOT + iv), t + i * .12, .035, .4, 3.5, (i % 2 ? .4 : -.4), .9); }); },
    lure: function () { if (!ok()) return; var t = T(); [24, 31, 36].forEach(function (iv, i) { tone('sine', mtof(ROOT + iv), t + i * .3, .02, .5, 2.5, 0, 1); }); },
    elected: function (x) { if (!ok()) return; var t = T(); tone('sawtooth', mtof(ROOT + 7), t, .02, .6, 2.5, x * 2 - 1, .9); tone('sawtooth', mtof(ROOT + 14), t + .4, .015, .6, 2.5, x * 2 - 1, .9); },
    exodus: function () { if (!ok()) return; var t = T(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(150, t + 2.5); s.connect(f); f.connect(g); var e = env(g, t, .14, .05, 2.6); out(g, 0, .6); s.start(t); s.stop(e); },
    returned: function () { if (!ok()) return; var t = T(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(150, t); f.frequency.exponentialRampToValueAtTime(2400, t + 2.5); s.connect(f); f.connect(g); var e = env(g, t, .1, 1.5, 1.2); out(g, 0, .6); s.start(t); s.stop(e); },
    mill: function () { if (!ok()) return; var t = T(); for (var i = 0; i < 16; i++) tone('triangle', mtof(ROOT + 12 + SCALE[i % 5] + 12 * Math.floor(i / 5)), t + i * .08, .02, .005, .4, Math.sin(i * .8), .7); },
    dissent: function (x) { if (!ok()) return; var t = T(); for (var i = 0; i < 4; i++) tone('square', mtof(ROOT + 13 + i * 6), t + i * .11 + .05, .012, .002, .07, x * 2 - 1, .3); },
    startle: function (x, d) { if (!ok()) return; var t = T(); for (var i = 0; i < 18 + d * 20; i++) burst(t + Math.random() * .35, .03, 2000 + Math.random() * 5000, 4, .03, x * 2 - 1 + (Math.random() - .5) * .8); var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(4000, t + .5); s.connect(f); f.connect(g); var e = env(g, t, .1, .02, .6); out(g, x * 2 - 1, .4); s.start(t); s.stop(e); },
    seed: function (y, x) { if (!ok()) return; var t = T(), m = ROOT + 24 + SCALE[Math.floor((1 - y) * 5) % 5]; [0, 7, 12].forEach(function (iv, i) { tone('sine', mtof(m + iv), t + i * .35, .03, .2, 2, x * 2 - 1, .9); }); },
    convert: function (x, n) { if (!ok()) return; var t = T(); [0, 3, 6, 10].forEach(function (iv, i) { tone('square', mtof(ROOT + 12 + iv), t + i * .05, .015, .003, .3, x * 2 - 1, .4); }); [10, 6, 3, 0].forEach(function (iv, i) { tone('triangle', mtof(ROOT + 24 + iv), t + .3 + i * .05, .02, .003, .4, -(x * 2 - 1), .4); }); },
    dethrone: function (x) { if (!ok()) return; var t = T(), o = tone('sawtooth', mtof(ROOT + 19), t, .05, .01, 1.4, x * 2 - 1, .6); o.frequency.setValueAtTime(mtof(ROOT + 19), t); o.frequency.exponentialRampToValueAtTime(mtof(ROOT - 5), t + 1.3); burst(t, .1, 300, 2, .3, 0); },
    schism: function (x) { if (!ok()) return; var t = T(); var a = tone('sine', mtof(ROOT + 24), t, .04, .01, 1.5, -.7, .8), b = tone('sine', mtof(ROOT + 24), t, .04, .01, 1.5, .7, .8); a.frequency.exponentialRampToValueAtTime(mtof(ROOT + 31), t + 1.2); b.frequency.exponentialRampToValueAtTime(mtof(ROOT + 17), t + 1.2); },
    echo: function (x) { if (!ok()) return; var t = T(); for (var i = 0; i < 8; i++) tone('triangle', mtof(ROOT + 24 + SCALE[(7 - i) % 5] + (i < 3 ? 12 : 0)), t + i * .09, .025 * (1 - i / 10), .003, .5, x * 2 - 1, .9); },
    beat: function (s, x) { if (!ok()) return; var t = T(), o = tone('sine', 110 * s, t, .14 * s, .002, .25, x * 2 - 1, .3); o.frequency.setValueAtTime(160 * s, t); o.frequency.exponentialRampToValueAtTime(50, t + .2); burst(t, .05 * s, 5000, 3, .03, x * 2 - 1); },
    scout: function (x) { if (!ok()) return; var t = T(); tone('sine', mtof(ROOT + 36), t, .04, .02, 1.2, x * 2 - 1, .9); tone('sine', mtof(ROOT + 43), t + .3, .03, .02, 1.6, x * 2 - 1, .9); },
    implode: function (x) { if (!ok()) return; var t = T(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(120, t + .6); s.connect(f); f.connect(g); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .55); g.gain.linearRampToValueAtTime(0, t + .66); out(g, x * 2 - 1, .3); s.start(t); s.stop(t + .7); },
    burst: function (x) { if (!ok()) return; var t = T(); for (var i = 0; i < 30; i++) tone('triangle', mtof(ROOT + 24 + SCALE[i % 5] + 12 * (i % 3)), t + Math.random() * .25, .018, .002, .5 + Math.random(), Math.random() * 2 - 1, .8); burst(t, .15, 1200, .7, .5, 0); },
    hunt: function (x) { if (!ok()) return; var t = T(); for (var i = 0; i < 6; i++) tone('sawtooth', mtof(ROOT - 12 + (i % 2) * 1), t + i * .16, .035, .005, .14, x * 2 - 1, .2); },
    caught: function (x) { if (!ok()) return; var t = T(); for (var i = 0; i < 20; i++) burst(t + Math.random() * .2, .06, 500 + Math.random() * 4000, 2, .05, x * 2 - 1); tone('sine', mtof(ROOT), t, .08, .005, 1.5, x * 2 - 1, .6); },
    vortex: function (k) { if (!ok()) return; var t = T(); for (var i = 0; i < 12; i++) tone('triangle', mtof(ROOT + 12 + SCALE[i % 5] + 12 * Math.floor(i / 5)), t + i * .06, .018, .003, .35, Math.sin(i * .9) * (k > 0 ? 1 : -1), .8); },
    temper: function (dir) { if (!ok()) return; var t = T(), iv = dir > 0 ? [0, 4, 7, 12] : dir < 0 ? [0, 1, 6, 11] : [0, 7]; iv.forEach(function (v, i) { tone('triangle', mtof(ROOT + 12 + v), t + i * .07, .03, .01, 1.2, 0, .8); }); },
    shake: function () { if (!ok()) return; var t = T(); for (var i = 0; i < 26; i++) burst(t + i * .025, .07, 2500 + Math.random() * 3000, 6, .02, Math.random() * 2 - 1); },
    gust: function (x, dx) { if (!ok()) return; var t = T(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = panner(clamp(x * 2 - 1, -1, 1)); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(800, t); f.frequency.exponentialRampToValueAtTime(2600, t + .3); f.frequency.exponentialRampToValueAtTime(400, t + .9); s.connect(f); f.connect(g); g.connect(p); p.connect(dry); var e = env(g, t, .14, .05, .9); if (p.pan) p.pan.linearRampToValueAtTime(clamp(x * 2 - 1 + dx * 2, -1, 1), t + .8); s.start(t); s.stop(e); },
    warm: function (x) { if (!ok()) return; var t = T(); [0, 4, 7, 11, 14].forEach(function (iv, i) { tone('sine', mtof(ROOT + iv), t + i * .1, .03, .6, 3, x * 2 - 1, .9); }); },
    lasso: function (n) { if (!ok()) return; var t = T(), o = tone('sawtooth', 200, t, .03, .005, .35, 0, .2); o.frequency.exponentialRampToValueAtTime(1600, t + .3); [0, 7, 12].forEach(function (iv, i) { tone('sine', mtof(ROOT + 12 + iv), t + .3 + i * .04, .03, .02, 2, 0, .8); }); },
    defect: function (x) { if (!ok()) return; var t = T(); for (var i = 0; i < 10; i++) tone('triangle', mtof(ROOT + 24 + [0, 1, 6, 11][i % 4]), t + i * .05, .015, .002, .2, Math.random() * 2 - 1, .5); },
    turn: function () { if (!ok()) return; var t = T(); [0, 5, 10, 15].forEach(function (iv, i) { tone('triangle', mtof(ROOT + 12 + iv), t + i * .08, .025, .01, .8, i % 2 ? .5 : -.5, .7); }); },
    stop: function () { alive = false; var t = T(); master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(0, t, .1); setTimeout(function () { try { voices.forEach(function (v) { v.o1.stop(); v.o2.stop(); }); bed.stop(); call.o.stop(); call.o5.stop(); call.vib.stop(); pr.s.stop(); pr.o.stop(); master.disconnect(); } catch (e) {} }, 700); }
  };
};
