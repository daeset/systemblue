/* 06 — The Room That Remembers: room tones, footsteps and the sounds of the building changing.
   SBL.roomSound(A) -> engine */
SBL.roomSound = function (A) {
  'use strict';
  var ctx = A.ctx, alive = true;
  function T() { return ctx.currentTime; }
  function ok() { return alive && ctx.state === 'running'; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function panner(v) { if (!ctx.createStereoPanner) return ctx.createGain(); var p = ctx.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; }

  var out = ctx.createGain(); out.gain.value = 0; out.connect(A.out); out.gain.setTargetAtTime(.9, T(), 1.5);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(out);
  var tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 9000; tone.connect(comp);
  var dry = ctx.createGain(); dry.connect(tone);
  function ir(sec, dark) {
    var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), l = 0; for (var i = 0; i < n; i++) { var k = i / n, a = dark + (1 - dark) * .6 * k; l = l * a + (Math.random() * 2 - 1) * (1 - a); d[i] = l * Math.pow(1 - k, 2) * 2.2; } }
    return b;
  }
  var small = ctx.createConvolver(); small.buffer = ir(1.2, .2); var smallIn = ctx.createGain(); smallIn.gain.value = .4; smallIn.connect(small); small.connect(tone);
  var big = ctx.createConvolver(); big.buffer = ir(6, .35); var bigIn = ctx.createGain(); bigIn.gain.value = .4; bigIn.connect(big); big.connect(tone);
  // corridor echo: delay time follows corridor length
  var echo = ctx.createDelay(2), echoFb = ctx.createGain(), echoF = ctx.createBiquadFilter(), echoIn = ctx.createGain();
  echoF.type = 'lowpass'; echoF.frequency.value = 2200; echoFb.gain.value = 0; echoIn.gain.value = 0;
  echoIn.connect(echo); echo.connect(echoF); echoF.connect(echoFb); echoFb.connect(echo); echoF.connect(dry);
  var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  (function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; })(noiseBuf.getChannelData(0));
  function noise(t, dur) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.start(t, Math.random()); s.stop(t + dur); return s; }
  function env(g, t, v, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return t + a + d + .02; }
  function send(node, wetBig, wetSmall) { node.connect(dry); if (wetBig) { var g = ctx.createGain(); g.gain.value = wetBig; node.connect(g); g.connect(bigIn); } if (wetSmall) { var h = ctx.createGain(); h.gain.value = wetSmall; node.connect(h); h.connect(smallIn); } }
  function bell(m, v, pan, t, rev) {
    t = t || T(); var f = mtof(m), c = ctx.createOscillator(), mo = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), p = panner(pan);
    c.frequency.value = f; mo.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(f * .02, t + 1.4);
    mo.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(p); send(p, .9, 0);
    var end;
    if (rev) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 1.1); g.gain.linearRampToValueAtTime(0, t + 1.14); end = t + 1.2; }
    else end = env(g, t, v, .004, 2.4);
    c.start(t); mo.start(t); c.stop(end); mo.stop(end);
  }

  // ---------- room tones ----------
  var ROOMS = [
    { notes: [50, 57, 62, 66], wave: 'sine', lp: 1100, wet: .35 },          // Vestibule: warm, close
    { notes: [45, 52, 57, 64], wave: 'triangle', lp: 800, wet: .7, air: .02 }, // Gallery: long and airy
    { notes: [38, 45, 50, 57], wave: 'sine', lp: 520, wet: 1, drips: true }, // Well: deep, wet
    { shepard: true, wet: .55, notes: [57] },                                   // Stair: a tone that rises forever
    { notes: [43, 50, 55, 62], wave: 'triangle', lp: 700, wet: .25, pages: true }, // Library: dry, close, paper
    { notes: [62, 69, 74, 81], wave: 'sine', lp: 3200, wet: .9, twinkle: true },   // Observatory: high and wide
    { notes: [41, 48], wave: 'sine', lp: 420, wet: 1, echoRoom: true },            // Echo: almost nothing, repeated
    { notes: [48, 55, 60, 64, 67], wave: 'triangle', lp: 1600, wet: .45, birds: true } // Atrium: bright, alive
  ];
  var drone = null, room = 0, dripT = 0, shep = null, shepPhase = 0, shepRate = 1 / 14, detuneSwoop = 0;
  function stopDrone(d) { if (!d) return; var t = T(); d.g.gain.cancelScheduledValues(t); d.g.gain.setTargetAtTime(0, t, .6); setTimeout(function () { d.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); try { d.g.disconnect(); } catch (e) {} }, 4000); }
  function startDrone(id, grow) {
    var R = ROOMS[id], g = ctx.createGain(), f = ctx.createBiquadFilter(), nodes = [], oscs = [];
    g.gain.value = 0; f.type = 'lowpass'; f.frequency.value = R.lp || 1500; f.connect(g); send(g, R.wet * (1 + grow * .5), .3);
    if (R.shepard) {
      for (var k = 0; k < 8; k++) { var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; og.gain.value = 0; o.connect(og); og.connect(f); o.start(); nodes.push(o); oscs.push({ o: o, g: og, k: k }); }
      shep = oscs;
    } else {
      R.notes.forEach(function (m, i) {
        [-4, 4].forEach(function (dt) { var o = ctx.createOscillator(), og = ctx.createGain(); o.type = R.wave; o.frequency.value = mtof(m - 12 * (grow > .4 ? 1 : 0) * (i === 0 ? 1 : 0)); o.detune.value = dt; og.gain.value = .022 / (1 + i * .3); o.connect(og); og.connect(f); o.start(); nodes.push(o); oscs.push({ o: o }); });
        var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rnd(.04, .12); lg.gain.value = .012; l.connect(lg); lg.connect(g.gain); l.start(); nodes.push(l);
      });
      if (R.air) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; var af = ctx.createBiquadFilter(); af.type = 'bandpass'; af.frequency.value = 900; af.Q.value = .5; var ag = ctx.createGain(); ag.gain.value = R.air; s.connect(af); af.connect(ag); ag.connect(f); s.start(); nodes.push(s); }
      shep = null;
    }
    g.gain.setTargetAtTime(1, T(), 1.4);
    return { g: g, nodes: nodes, oscs: oscs };
  }
  var timer = setInterval(function () {
    if (!ok()) return; var t = T();
    if (shep) {
      shepPhase = (shepPhase + .05 * shepRate) % 1;
      shep.forEach(function (s) {
        var oct = (s.k + shepPhase * 1) % 8, f = 32 * Math.pow(2, oct + shepPhase * 0), amp = Math.exp(-Math.pow(oct - 4, 2) / (2 * 1.5 * 1.5)) * .03;
        if (s.last != null && oct < s.last) s.o.frequency.setValueAtTime(f, t); else s.o.frequency.setTargetAtTime(f, t, .04);
        s.last = oct; s.g.gain.setTargetAtTime(amp, t, .05);
      });
    }
    var RR = ROOMS[room];
    if (RR.pages && t > dripT) { dripT = t + rnd(2, 6); var ps = noise(t, .12), pf = ctx.createBiquadFilter(), pg = ctx.createGain(); pf.type = 'highpass'; pf.frequency.value = 2500; ps.connect(pf); pf.connect(pg); pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(.05, t + .05); pg.gain.exponentialRampToValueAtTime(.001, t + .12); send(pg, .2, .5); }
    if (RR.twinkle && t > dripT) { dripT = t + rnd(.6, 2.2); bell(RR.notes[Math.floor(Math.random() * 4)] + 12, .025, rnd(-.9, .9), t); }
    if (RR.birds && t > dripT) { dripT = t + rnd(1.2, 4); for (var bi = 0, nb = 2 + Math.floor(Math.random() * 4); bi < nb; bi++) { var bo = ctx.createOscillator(), bgn = ctx.createGain(), bp = panner(rnd(-1, 1)), bt = t + bi * .09, bf = rnd(2200, 4200); bo.frequency.setValueAtTime(bf, bt); bo.frequency.exponentialRampToValueAtTime(bf * rnd(1.2, 1.6), bt + .06); bo.connect(bgn); bgn.connect(bp); send(bp, .3, 0); var be = env(bgn, bt, .025, .005, .07); bo.start(bt); bo.stop(be); } }
    if (RR.drips && t > dripT) {
      dripT = t + rnd(.8, 3.2); var o = ctx.createOscillator(), g = ctx.createGain(), p = panner(rnd(-.8, .8)), f0 = rnd(900, 1600);
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * .45, t + .07); o.connect(g); g.connect(p); send(p, 1.2, 0);
      var e = env(g, t, .05, .002, .12); o.start(t); o.stop(e);
    }
  }, 50);

  // calls from neglected rooms, one hum per door
  var calls = {};
  function setCalls(list) {
    var keep = {};
    list.forEach(function (c) {
      keep[c.key] = 1; var h = calls[c.key];
      if (!h) {
        var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain(), p = panner(0);
        o.frequency.value = mtof(c.note); o2.frequency.value = mtof(c.note + 7) * 1.003; g.gain.value = 0; trem.frequency.value = 3.2; tg.gain.value = .012;
        trem.connect(tg); tg.connect(g.gain); o.connect(g); o2.connect(g); g.connect(p); send(p, .6, 0);
        o.start(); o2.start(); trem.start(); g.gain.setTargetAtTime(.02, T(), 1);
        h = calls[c.key] = { o: o, o2: o2, trem: trem, g: g, p: p };
      }
      if (h.p.pan) h.p.pan.setTargetAtTime(clamp(c.pan, -1, 1), T(), .1);
      h.g.gain.setTargetAtTime(.02 * (c.gain == null ? 1 : c.gain), T(), .2);
    });
    Object.keys(calls).forEach(function (k) { if (!keep[k]) { var h = calls[k]; delete calls[k]; h.g.gain.cancelScheduledValues(T()); h.g.gain.setTargetAtTime(0, T(), .4); setTimeout(function () { [h.o, h.o2, h.trem].forEach(function (n) { try { n.stop(); } catch (e) {} }); }, 2500); } });
  }

  function roomEcho() { var t = T(), on = !!ROOMS[room].echoRoom; echoIn.gain.setTargetAtTime(on ? .7 : 0, t, .3); echoFb.gain.setTargetAtTime(on ? .62 : 0, t, .3); echo.delayTime.setTargetAtTime(on ? .42 : .2, t, .1); }
  var ghostN = null;
  return {
    setRoom: function (id, grow) {
      room = id; stopDrone(drone); drone = startDrone(id, grow || 0); shepRate = 1 / 14;
      var w = ROOMS[id].wet * (1 + (grow || 0) * .6); bigIn.gain.setTargetAtTime(.25 + w * .5, T(), .5); smallIn.gain.setTargetAtTime(.5 - w * .25, T(), .5);
      roomEcho(); dripT = 0;
    },
    corridor: function (on, L, narrow) {
      var t = T();
      if (!on) { roomEcho(); tone.frequency.setTargetAtTime(9000, t, .5); return; }
      echoIn.gain.setTargetAtTime(on ? .5 : 0, t, .3); echoFb.gain.setTargetAtTime(on ? clamp(.25 + L / 40, 0, .6) : 0, t, .3);
      echo.delayTime.setTargetAtTime(clamp(L / 34 * 2, .06, 1.6), t, .1);
      tone.frequency.setTargetAtTime(on ? 9000 - narrow * 6000 : 9000, t, .5);
    },
    step: function (narrow) {
      if (!ok()) return; var t = T(), s = noise(t, .08), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = rnd(260, 520) * (1 + (narrow || 0)); f.Q.value = 1.5 + (narrow || 0) * 8;
      s.connect(f); f.connect(g); env(g, t, .12, .003, .07); send(g, .35, .5); var e2 = ctx.createGain(); e2.gain.value = .8; g.connect(e2); e2.connect(echoIn);
    },
    hover: function (target) { if (!ok()) return; var R = ROOMS[target]; bell(R.notes[0] + 24, .03, 0); },
    tap: function () { if (!ok()) return; var t = T(), o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(700, t + .05); o.connect(g); var e = env(g, t, .04, .002, .06); send(g, .2, .3); var e2 = ctx.createGain(); e2.gain.value = .8; g.connect(e2); e2.connect(echoIn); o.start(t); o.stop(e); },
    books: function () { if (!ok()) return; var t = T(); for (var i = 0; i < 3; i++) { var s = noise(t + i * .07, .05), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = 900; s.connect(f); f.connect(g); env(g, t + i * .07, .1, .002, .04); send(g, .1, .5); } },
    setCalls: setCalls,
    seal: function () {
      if (!ok()) return; var t = T(), s = noise(t, 2), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 140; f.Q.value = 3;
      s.connect(f); f.connect(g); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.6, t + .4); g.gain.exponentialRampToValueAtTime(.001, t + 1.9); send(g, .8, 0);
      var o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(48, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.6); o.connect(og); var e = env(og, t, .35, .1, 1.5); send(og, .5, 0); o.start(t); o.stop(e);
    },
    open: function () { if (!ok()) return; var t = T(); [62, 66, 69, 74, 78].forEach(function (m, i) { bell(m, .05, (i - 2) / 3, t + i * .11); }); },
    rewire: function () {
      if (!ok()) return; var t = T();
      [0, .09].forEach(function (d) { var s = noise(t + d, .02), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 2500; s.connect(f); f.connect(g); env(g, t + d, .3, .001, .015); send(g, .3, .4); });
      if (drone) drone.oscs.forEach(function (o) { if (o.o.detune) { o.o.detune.cancelScheduledValues(t); o.o.detune.setValueAtTime(o.o.detune.value, t); o.o.detune.linearRampToValueAtTime(-90, t + .5); o.o.detune.linearRampToValueAtTime(0, t + 2.5); } });
    },
    crack: function (k) { if (!ok()) return; var t = T(), s = noise(t, .05), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = 1800 + k * 900; f.Q.value = 2; s.connect(f); f.connect(g); env(g, t, .3, .001, .05); send(g, .4, .4); },
    ghost: function (on) {
      if (on && !ghostN && ok()) {
        var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; var f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
        f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 7; l.frequency.value = .7; lg.gain.value = 700; l.connect(lg); lg.connect(f.frequency);
        g.gain.value = 0; s.connect(f); f.connect(g); send(g, 1, 0); s.start(); l.start(); g.gain.setTargetAtTime(.05, T(), 1);
        ghostN = { s: s, l: l, g: g }; bell(74, .05, 0, T(), true);
      } else if (!on && ghostN) { var h = ghostN; ghostN = null; h.g.gain.setTargetAtTime(0, T(), .5); setTimeout(function () { try { h.s.stop(); h.l.stop(); } catch (e) {} }, 3000); }
    },
    grow: function () { if (!ok()) return; var t = T(); [38, 45, 50].forEach(function (m, i) { bell(m + 12, .05, 0, t + i * .2, true); }); },
    stair: function (on) { shepRate = on ? 1 / 3 : 1 / 14; },
    splash: function () { if (!ok()) return; var t = T(), s = noise(t, .4), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = .8; s.connect(f); f.connect(g); env(g, t, .12, .01, .35); send(g, 1, 0); },
    portrait: function () { if (!ok()) return; bell(69, .04, -.3); bell(76, .04, .3, T() + .15); },
    stop: function () {
      alive = false; clearInterval(timer); setCalls([]); var t = T(); out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, .1);
      setTimeout(function () { if (drone) drone.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); if (ghostN) try { ghostN.s.stop(); ghostN.l.stop(); } catch (e) {} try { out.disconnect(); } catch (e) {} }, 600);
    }
  };
};
