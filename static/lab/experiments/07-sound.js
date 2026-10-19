/* 07 \u2014 The Negotiation: interpretive audio.
   Your stroke sounds while you draw it (pitch follows height, brightness follows speed).
   When you lift, it is played back to you as you drew it \u2014 then the machine answers with its own version,
   quantised to the palette's scale: a line is an interval, an arc a glide, a loop a chord, a polygon an arpeggio
   with one note per side, a wave a stutter. Agreement, refusal and insistence each have a voice.
   SBL.negotiationSound(A) -> engine */
SBL.negotiationSound = function (A) {
  'use strict';
  var ctx = A.ctx, alive = true;
  function T() { return ctx.currentTime; }
  function ok() { return alive && ctx.state === 'running'; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function panner(v) { if (!ctx.createStereoPanner) return ctx.createGain(); var p = ctx.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; }
  var SCALES = { bauhaus: [0, 2, 4, 7, 9], constructivist: [0, 1, 3, 5, 7, 8, 10], riso: [0, 2, 4, 6, 7, 9, 11], night: [0, 2, 3, 5, 7, 9, 10], garden: [0, 3, 5, 7, 10] };
  var ROOTS = { bauhaus: 60, constructivist: 57, riso: 62, night: 55, garden: 58 };
  var scale = SCALES.riso, root = 62;

  var out = ctx.createGain(); out.gain.value = 0; out.connect(A.out); out.gain.setTargetAtTime(1.6, T(), .3);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(out);
  var dry = ctx.createGain(); dry.connect(comp);
  var verb = ctx.createConvolver(); verb.buffer = (function () { var n = Math.floor(ctx.sampleRate * 2.2), b = ctx.createBuffer(2, n, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), l = 0; for (var i = 0; i < n; i++) { var k = i / n, a = .3 + .6 * k; l = l * a + (Math.random() * 2 - 1) * (1 - a); d[i] = l * Math.pow(1 - k, 2.2) * 2; } } return b; })();
  var wet = ctx.createGain(); wet.gain.value = .35; wet.connect(verb); verb.connect(comp);
  var noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); (function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; })(noiseBuf.getChannelData(0));
  function env(g, t, v, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return t + a + d + .02; }
  function route(g, pan, w) { var p = panner(pan); g.connect(p); p.connect(dry); var s = ctx.createGain(); s.gain.value = w == null ? .6 : w; p.connect(s); s.connect(wet); }
  function q(y01, oct) { // height (0 top .. 1 bottom) \u2192 a scale note
    var steps = scale.length * 2, d = Math.round((1 - clamp(y01, 0, 1)) * (steps - 1));
    return root + (oct || 0) + scale[d % scale.length] + 12 * Math.floor(d / scale.length);
  }
  // the machine's voice: a clean, slightly glassy FM tone
  function mach(m, t, v, dur, pan) {
    var c = ctx.createOscillator(), mo = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), f = mtof(m);
    c.frequency.value = f; mo.frequency.value = f * 2; mg.gain.setValueAtTime(f * .8, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + dur);
    mo.connect(mg); mg.connect(c.frequency); c.connect(g); var e = env(g, t, v, .006, dur); route(g, pan, .7); c.start(t); mo.start(t); c.stop(e); mo.stop(e);
  }
  // your voice, played back: a soft triangle with a little breath
  function yours(m, t, v, dur, pan) {
    var o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = mtof(m); lp.type = 'lowpass'; lp.frequency.value = 2200;
    o.connect(lp); lp.connect(g); var e = env(g, t, v, .01, dur); route(g, pan, .3); o.start(t); o.stop(e);
  }

  // live drawing tone
  var live = null;
  function drawStart(y, x) {
    if (!ok() || live) return; var o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = panner(x * 2 - 1);
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = mtof(root + 24 * (1 - y)); o2.frequency.value = o.frequency.value * 2.003; lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(p); p.connect(dry); var s = ctx.createGain(); s.gain.value = .3; p.connect(s); s.connect(wet);
    g.gain.value = 0; g.gain.setTargetAtTime(.06, T(), .03); o.start(); o2.start(); live = { o: o, o2: o2, lp: lp, g: g, p: p };
  }
  function drawMove(y, x, speed) {
    if (!live) return; var t = T(), f = mtof(root + 24 * (1 - clamp(y, 0, 1)));
    live.o.frequency.setTargetAtTime(f, t, .03); live.o2.frequency.setTargetAtTime(f * 2.003, t, .03); live.lp.frequency.setTargetAtTime(500 + Math.min(4000, speed * 3), t, .05);
    live.g.gain.setTargetAtTime(.03 + Math.min(.06, speed / 30000), t, .05); if (live.p.pan) live.p.pan.setTargetAtTime(clamp(x * 2 - 1, -1, 1), t, .05);
  }
  function drawEnd() { if (!live) return; var l = live; live = null; var t = T(); l.g.gain.cancelScheduledValues(t); l.g.gain.setTargetAtTime(0, t, .05); setTimeout(function () { try { l.o.stop(); l.o2.stop(); } catch (e) {} }, 400); }

  return {
    setPalette: function (k) { scale = SCALES[k] || SCALES.riso; root = ROOTS[k] || 62; },
    drawStart: drawStart, drawMove: drawMove, drawEnd: drawEnd,
    // call: your contour played back fast; response: the machine's reading
    exchange: function (contour, reply) {
      if (!ok()) return 0; var t = T() + .05, n = contour.length, i;
      for (i = 0; i < n; i++) yours(q(contour[i][1]), t + i * .045, .05, .12, contour[i][0] * 2 - 1);
      var t2 = t + n * .045 + .18, pan = reply.x * 2 - 1, y = reply.y, ty = reply.type, k = reply.n || 1;
      if (ty === 'line') { mach(q(reply.y0), t2, .08, .5, pan); mach(q(reply.y1), t2 + .16, .08, .7, pan); }
      else if (ty === 'arc') { for (i = 0; i < 3; i++) mach(q(y) + [0, 4, 7][i] - 12 * (i === 0 ? 0 : 0), t2 + i * .08, .06, .6, pan); }
      else if (ty === 'loop') { [0, 4, 7, 12].slice(0, 2 + Math.min(2, k)).forEach(function (iv) { mach(q(y) + iv, t2, .045, 1.4, pan); }); }
      else if (ty === 'polygon') { for (i = 0; i < k; i++) mach(q(y) + scale[i % scale.length] + 12 * Math.floor(i / scale.length), t2 + i * .09, .065, .5, pan); }
      else if (ty === 'wave') { for (i = 0; i < Math.min(10, 3 + k); i++) mach(q(y) + (i % 2 ? 12 : 0), t2 + i * .06, .05, .12, pan); }
      else if (ty === 'raw') yours(q(y), t2, .08, .8, pan);
      return t2 - T() + .4;
    },
    agree: function () { if (!ok()) return; var t = T() + .05; mach(root + 12, t, .06, .5, 0); mach(root + 19, t + .1, .06, .7, 0); },
    disagree: function () { if (!ok()) return; var t = T() + .05; mach(root + 12, t, .05, .5, -.3); mach(root + 13, t + .12, .05, .7, .3); },
    approve: function () { if (!ok()) return; var t = T(); [0, 4, 7, 12].forEach(function (iv, i) { mach(root + 24 + iv, t + i * .05, .05, .8, (i - 1.5) / 2); }); },
    reject: function () {
      if (!ok()) return; var t = T();
      for (var i = 0; i < 6; i++) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = 800 + Math.random() * 3000; f.Q.value = 2; s.connect(f); f.connect(g); env(g, t + i * .035, .12, .002, .05); route(g, Math.random() * 2 - 1, .1); s.start(t + i * .035, Math.random() * .5); s.stop(t + i * .035 + .08); }
      mach(root - 5, t + .15, .05, .6, 0);
    },
    insist: function () { if (!ok()) return; var t = T(); yours(root + 7, t, .08, .35, 0); yours(root + 2, t + .28, .08, .7, 0); },
    undo: function () { if (!ok()) return; var t = T(); mach(root + 19, t, .04, .2, 0); mach(root + 12, t + .07, .04, .4, 0); },
    // the drawing read as a score, left to right
    score: function (notes, dur) {
      if (!ok()) return; var t = T() + .1;
      notes.forEach(function (nt) {
        var at = t + nt.x * dur, m = q(nt.y);
        if (nt.type === 'loop') [0, 4, 7].forEach(function (iv) { mach(m + iv, at, .035, 1.2, nt.x * 2 - 1); });
        else if (nt.type === 'polygon') for (var i = 0; i < Math.min(nt.n, 8); i++) mach(m + scale[i % scale.length], at + i * .05, .04, .3, nt.x * 2 - 1);
        else if (nt.type === 'wave') for (var j = 0; j < 4; j++) mach(m + (j % 2 ? 7 : 0), at + j * .05, .035, .1, nt.x * 2 - 1);
        else if (nt.type === 'raw') yours(m, at, .06, .6, nt.x * 2 - 1);
        else mach(m, at, .05, nt.type === 'arc' ? .9 : .5, nt.x * 2 - 1);
      });
    },
    stop: function () { alive = false; drawEnd(); var t = T(); out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, .08); setTimeout(function () { try { out.disconnect(); } catch (e) {} }, 500); }
  };
};
