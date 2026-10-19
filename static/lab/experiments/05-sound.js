/* 05 — Resonant Matter: three drum & bass tracks, generated live, plus the visitor's own file.
   Each built-in track is a finite arrangement (intro, main, break, build, drop, main, outro) so the
   sculpture it builds is a record of the whole track. The visuals never read the score: they only
   hear the master output through the analyser.
   SBL.matterSound(A) -> engine */
SBL.matterSound = function (A) {
  'use strict';
  var ctx = A.ctx, alive = true, listener = null;
  function T() { return ctx.currentTime; }
  function ok() { return alive && ctx.state === 'running'; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function emit(type, data, at) { if (!listener) return; var d = Math.max(0, ((at || T()) - T()) * 1000); setTimeout(function () { if (alive && listener) listener(type, data); }, d); }
  function panner(v) { if (!ctx.createStereoPanner) return ctx.createGain(); var p = ctx.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; }

  var TRACKS = {
    amen: { name: 'Amen Fracture', desc: 'busy breakbeat, ghost snares', root: 41, kick: '1010000000110000', snare: '0000100101001001', ghost: .35, hat: '1111111111111111', ohat: '0000000000100000', reese: .7, pad: .8, prog: [0, 0, 8, 7], wobble: 0 },
    roller: { name: 'Roller', desc: 'two-step, long reese bass', root: 43, kick: '1000000000100000', snare: '0000100000001000', ghost: .08, hat: '0010001000100010', ohat: '0000001000000010', reese: 1.2, pad: 1, prog: [0, 3, 8, 7], wobble: 0 },
    halftime: { name: 'Halftime', desc: 'sparse, heavy, wobbling', root: 38, kick: '1000000000000100', snare: '0000000010000000', ghost: .04, hat: '1010101010101010', ohat: '0000000000000000', reese: .9, pad: .5, prog: [0, 0, 5, 3], wobble: 1 }
  };
  var SECTIONS = [['intro', 8], ['main', 16], ['break', 8], ['build', 4], ['drop', 16], ['main', 8], ['outro', 4]];
  var BPM = 174, SD = 60 / BPM / 4;

  // ---------- graph ----------
  var out = ctx.createGain(); out.gain.value = 0; out.connect(A.out); out.gain.setTargetAtTime(.9, T(), .3);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .12; comp.connect(out);
  var analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .35; analyser.minDecibels = -72; analyser.maxDecibels = -12;
  comp.connect(analyser);
  // a second ear for the kick: only what survives two steep low-pass filters, so hats and snares can't leak in
  var lowA = ctx.createAnalyser(); lowA.fftSize = 2048; lowA.smoothingTimeConstant = .3; lowA.minDecibels = -52; lowA.maxDecibels = -10;
  var lp1 = ctx.createBiquadFilter(), lp2 = ctx.createBiquadFilter(); lp1.type = lp2.type = 'lowpass'; lp1.frequency.value = lp2.frequency.value = 130; lp1.Q.value = lp2.Q.value = .7;
  comp.connect(lp1); lp1.connect(lp2); lp2.connect(lowA);
  var mix = ctx.createGain(); mix.connect(comp);
  var music = ctx.createGain(); music.connect(mix);
  var trackBus = ctx.createGain(); trackBus.gain.value = 0; trackBus.connect(mix);
  var fx = ctx.createGain(); fx.connect(mix);
  var secLP = ctx.createBiquadFilter(); secLP.type = 'lowpass'; secLP.frequency.value = 18000; secLP.connect(music);
  var drums = ctx.createGain(); drums.connect(secLP);
  var bassBus = ctx.createGain(); bassBus.connect(secLP);
  var verb = ctx.createConvolver(); verb.buffer = (function () { var n = Math.floor(ctx.sampleRate * 2.6), b = ctx.createBuffer(2, n, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), l = 0; for (var i = 0; i < n; i++) { var k = i / n, a = .3 + .6 * k; l = l * a + (Math.random() * 2 - 1) * (1 - a); d[i] = l * Math.pow(1 - k, 2.4) * 2; } } return b; })();
  var verbIn = ctx.createGain(); verbIn.gain.value = .35; verbIn.connect(verb); verb.connect(mix);
  var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  (function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; })(noiseBuf.getChannelData(0));
  function noise(t, dur) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.start(t, Math.random()); s.stop(t + dur); return s; }
  function env(g, t, v, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return t + a + d + .02; }
  function osc(type, f, det) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; return o; }

  // ---------- drums ----------
  function kick(t, v) {
    var o = osc('sine', 160), g = ctx.createGain(); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(46, t + .075);
    o.connect(g); var e = env(g, t, 1.1 * v, .001, .32); g.connect(drums); o.start(t); o.stop(e);
    var c = noise(t, .01), cf = ctx.createBiquadFilter(), cg = ctx.createGain(); cf.type = 'highpass'; cf.frequency.value = 3000; c.connect(cf); cf.connect(cg); env(cg, t, .25 * v, .0005, .006); cg.connect(drums);
  }
  function snare(t, v) {
    var s = noise(t, .25), f = ctx.createBiquadFilter(), g = ctx.createGain(), hp = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2100; f.Q.value = .7; hp.type = 'highpass'; hp.frequency.value = 350;
    s.connect(hp); hp.connect(f); f.connect(g); env(g, t, .55 * v, .001, .17); g.connect(drums); var sv = ctx.createGain(); sv.gain.value = .3; g.connect(sv); sv.connect(verbIn);
    var o = osc('triangle', 200), og = ctx.createGain(); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(165, t + .05); o.connect(og); var e = env(og, t, .4 * v, .001, .09); og.connect(drums); o.start(t); o.stop(e);
  }
  function hat(t, v, open) {
    var s = noise(t, open ? .3 : .06), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 8200;
    s.connect(f); f.connect(g); env(g, t, (open ? .12 : .07) * v, .0005, open ? .2 : .028); var p = panner(rnd(-.3, .3)); g.connect(p); p.connect(drums);
  }
  // ---------- sustained material: reese, sub, pad ----------
  var reese = null;
  function reeseNote(t, m, dur, amt, wob) {
    var g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
    var a = osc('sawtooth', mtof(m), -14), b = osc('sawtooth', mtof(m), 14), sub = osc('sine', mtof(m)), sg = ctx.createGain(); sg.gain.value = .5; // the sub sits at the root, above the kick's band
    a.connect(f); b.connect(f); f.connect(g); sub.connect(sg); sg.connect(g);
    var l = osc('sine', wob ? BPM / 60 / 4 : .35), lg = ctx.createGain(); lg.gain.value = wob ? 600 : 260; f.frequency.value = wob ? 700 : 520; l.connect(lg); lg.connect(f.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16 * amt, t + .06); g.gain.setValueAtTime(.16 * amt, t + dur - .08); g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(bassBus); [a, b, sub, l].forEach(function (o) { o.start(t); o.stop(t + dur + .05); });
  }
  function padChord(t, m, dur, amt) {
    var g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1300;
    [0, 3, 7, 10, 14].forEach(function (iv) { [-7, 7].forEach(function (d) { var o = osc('sawtooth', mtof(m + 12 + iv), d); o.connect(f); o.start(t); o.stop(t + dur + 1); }); });
    f.connect(g); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.022 * amt, t + .8); g.gain.setTargetAtTime(0, t + dur, .4);
    g.connect(secLP); var s = ctx.createGain(); s.gain.value = .8; g.connect(s); s.connect(verbIn);
  }
  function riser(t, dur) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; var f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + dur); g.gain.setValueAtTime(0, t + dur + .01);
    s.connect(f); f.connect(g); g.connect(mix); s.start(t); s.stop(t + dur + .05);
  }

  // ---------- arrangement ----------
  var tk = TRACKS.amen, key = 'amen', playing = false, secI = 0, barsLeft = 0, bar = 0, step = 0, nextTime = 0, ghosts = [];
  function vary() { ghosts = []; for (var i = 0; i < 16; i++) ghosts.push(Math.random() < tk.ghost); }
  function schedule(st, t) {
    var sec = SECTIONS[secI][0], on = function (p) { return p.charAt(st) === '1'; }, root = tk.root + tk.prog[bar % tk.prog.length];
    if (st === 0) {
      if (barsLeft === SECTIONS[secI][1]) { emit('section', sec, t); if (sec === 'build') riser(t, SD * 16 * 4); if (sec === 'drop') emit('drop', null, t); }
      secLP.frequency.setTargetAtTime(sec === 'intro' ? 1800 : sec === 'break' ? 2600 : sec === 'outro' ? 1200 : 18000, t, .5);
      if (sec !== 'intro' && sec !== 'build' && bar % 2 === 0 && tk.reese) reeseNote(t, root, SD * 32, (sec === 'break' ? 1.3 : 1) * tk.reese, tk.wobble && sec !== 'break');
      if ((sec === 'intro' || sec === 'break') && bar % 2 === 0) padChord(t, root, SD * 32, tk.pad);
    }
    var full = sec === 'main' || sec === 'drop';
    if ((full && on(tk.kick)) || (sec === 'outro' && st % 8 === 0) || (sec === 'drop' && st === 15 && bar % 4 === 3)) kick(t, sec === 'drop' ? 1 : .9);
    if (full && on(tk.snare)) snare(t, 1);
    else if (full && ghosts[st]) snare(t, .28);
    if (sec === 'build') { var left = barsLeft; if ((left > 2 && st % 4 === 0) || (left === 2 && st % 2 === 0) || left === 1) snare(t, .35 + (4 - left) * .15); }
    if (sec !== 'build' && sec !== 'outro' && on(tk.hat)) hat(t, (st % 4 === 2 ? .9 : .5) * (sec === 'break' ? .5 : 1), false);
    if (full && on(tk.ohat)) hat(t, .8, true);
  }
  var timer = setInterval(function () {
    if (!ok() || !playing) return;
    if (nextTime < T()) nextTime = T() + .05;
    while (nextTime < T() + .12 && playing) {
      schedule(step, nextTime); nextTime += SD; step++;
      if (step === 16) {
        step = 0; bar++; barsLeft--; if (bar % 4 === 0) vary();
        if (barsLeft <= 0) { secI++; if (secI >= SECTIONS.length) { playing = false; emit('end', key, nextTime); break; } barsLeft = SECTIONS[secI][1]; }
      }
    }
  }, 25);

  // ---------- the visitor's file ----------
  var src = null, fileBuf = null, fileName = '';
  function stopFile() { if (src) { src.onended = null; try { src.stop(); } catch (e) {} src = null; } }

  // ---------- touch: a held tone and a struck one ----------
  var hold = null, PENT = [0, 3, 5, 7, 10], TAU2 = Math.PI * 2;
  function note(h) { var d = Math.max(0, Math.floor(h * 1.6)); return tk.root + 24 + PENT[d % 5] + 12 * Math.floor(d / 5); }
  function voice(kind, f, v, pan, t) { // the sculpture's materials, as instruments
    var g = ctx.createGain(), p = panner(pan), end; g.connect(p); p.connect(fx); var sv = ctx.createGain(); sv.gain.value = .5; p.connect(sv); sv.connect(verbIn);
    if (kind === 0 || kind === 1) { // mass: marimba
      var a = osc('sine', f / 2), b = osc('sine', f * 2), bg = ctx.createGain(); bg.gain.setValueAtTime(.3, t); bg.gain.exponentialRampToValueAtTime(.001, t + .08);
      a.connect(g); b.connect(bg); bg.connect(g); end = env(g, t, v, .002, .55); a.start(t); b.start(t); a.stop(end); b.stop(end);
    } else if (kind === 2 || kind === 6) { // shards: glass
      var c = osc('sine', f * 2), m = osc('sine', f * 2 * 3.51), mg = ctx.createGain(); mg.gain.setValueAtTime(f * 3, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + .4);
      m.connect(mg); mg.connect(c.frequency); c.connect(g); end = env(g, t, v * .6, .001, .9); c.start(t); m.start(t); c.stop(end); m.stop(end);
    } else if (kind === 3 || kind === 5) { // rods: plucked string
      var s1 = osc('sawtooth', f), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(f * 8, t); lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + .3);
      s1.connect(lp); lp.connect(g); end = env(g, t, v * .5, .002, .8); s1.start(t); s1.stop(end);
    } else { // rings: bell
      [1, 2.4, 4.1].forEach(function (r2, i) { var o = osc('sine', f * r2), og = ctx.createGain(); o.connect(og); og.connect(g); var e2 = env(og, t, v / (1 + i), .002, 1.8 / (1 + i * .5)); o.start(t); o.stop(e2); }); end = t + 2;
    }
  }
  var lastTw = 0;
  return {
    strum: function (kind, h, pan) { if (!ok()) return; voice(kind, mtof(note(h)), .11, pan, T()); },
    pull: function (n) { if (!ok()) return; var t = T(), f = mtof(tk.root + 24 + PENT[n % 5] + 12 * Math.floor(n / 5) % 24); var o = osc('triangle', f * .8), g = ctx.createGain(); o.frequency.setValueAtTime(f * .8, t); o.frequency.exponentialRampToValueAtTime(f, t + .06); o.connect(g); var e = env(g, t, .08, .004, .25); var p = panner(0); g.connect(p); p.connect(fx); o.start(t); o.stop(e); },
    erode: function () { if (!ok()) return; var t = T(), s1 = noise(t, .18), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = rnd(2500, 5000); f.Q.value = 1.2; s1.connect(f); f.connect(g); env(g, t, .14, .01, .15); g.connect(fx); },
    twist: function (v) {
      if (!ok()) return; var t = T(); if (t - lastTw < .05) return; lastTw = t;
      var s1 = noise(t, .14), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 18; f.frequency.value = 180 + Math.min(1, Math.abs(v) * 8) * 500 + rnd(-20, 20);
      s1.connect(f); f.connect(g); env(g, t, .5, .02, .1); g.connect(fx);
    },
    grain: function (g) { if (!ok()) return; var t = T(); [0, 2, 4, 7].forEach(function (d, i) { voice(g === 1 ? 0 : g === 2 ? 2 : g === 3 ? 4 : g === 4 ? 3 : 0, mtof(tk.root + 24 + PENT[(d + g) % 5] + (d > 4 ? 12 : 0)), .08, (i - 1.5) / 2, t + i * .07); }); },
    mirror: function (n) { if (!ok()) return; var t = T(); for (var i = 0; i < n; i++) voice(4, mtof(tk.root + 36 + PENT[i % 5]), .05, n > 1 ? -1 + 2 * i / (n - 1) : 0, t + i * .05); },
    holdPitch: function (semi) { if (!hold) return; var t = T(), k = Math.pow(2, semi / 12); hold.o.forEach(function (o, i) { o.frequency.setTargetAtTime(hold.f[i] * k, t, .03); }); },
    analyser: analyser,
    lowAnalyser: lowA,
    tracks: TRACKS,
    on: function (fn) { listener = fn; },
    play: function (k) {
      stopFile(); trackBus.gain.setTargetAtTime(0, T(), .05); music.gain.setTargetAtTime(1, T(), .05);
      key = k; tk = TRACKS[k]; secI = 0; barsLeft = SECTIONS[0][1]; bar = 0; step = 0; nextTime = T() + .15; vary(); playing = true; emit('section', 'intro');
    },
    playFile: function (file) {
      return file.arrayBuffer().then(function (ab) { return new Promise(function (res, rej) { var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); }).then(function (buf) {
        playing = false; music.gain.setTargetAtTime(0, T(), .1); fileBuf = buf; fileName = file.name; key = 'file';
        stopFile(); src = ctx.createBufferSource(); src.buffer = buf; src.connect(trackBus); trackBus.gain.setTargetAtTime(1, T(), .05);
        var me = src; src.onended = function () { if (me === src) { src = null; emit('end', 'file'); } }; src.start(T() + .1);
        return buf.duration;
      });
    },
    stopAll: function () { playing = false; stopFile(); },
    playing: function () { return playing || !!src; },
    hold: function (on) {
      var t = T();
      if (on && !hold && ok()) {
        var g = ctx.createGain(), f = ctx.createBiquadFilter(), a = osc('sawtooth', mtof(tk.root + 12), -10), b = osc('sawtooth', mtof(tk.root + 12), 10), s = osc('sine', mtof(tk.root));
        f.type = 'lowpass'; f.frequency.value = 600; a.connect(f); b.connect(f); s.connect(g); f.connect(g); g.gain.value = 0; g.gain.setTargetAtTime(.14, t, .2); g.connect(fx);
        f.frequency.setTargetAtTime(1400, t, 1.5); [a, b, s].forEach(function (o) { o.start(t); }); hold = { g: g, o: [a, b, s], f: [a.frequency.value, b.frequency.value, s.frequency.value] };
      } else if (!on && hold) { var h = hold; hold = null; h.g.gain.cancelScheduledValues(t); h.g.gain.setTargetAtTime(0, t, .15); setTimeout(function () { h.o.forEach(function (o) { try { o.stop(); } catch (e) {} }); }, 900); }
    },
    strike: function (mass, pan) {
      if (!ok()) return; var t = T(), f = 55 * Math.pow(2, 2.5 - Math.min(2.5, Math.log2(1 + mass / 400)));
      [1, 2.76, 5.4, 8.93].forEach(function (r, i) { var o = osc('sine', f * r), g = ctx.createGain(), p = panner(pan); o.connect(g); g.connect(p); p.connect(fx); var sv = ctx.createGain(); sv.gain.value = .6; p.connect(sv); sv.connect(verbIn); var e = env(g, t, .16 / (i + 1), .002, 3.2 / (1 + i * .6)); o.start(t); o.stop(e); });
    },
    // the visitor can move the music itself: up to the drop, down into the break
    jump: function (to) {
      if (!playing) return false; var idx = -1; for (var i = secI + 1; i < SECTIONS.length; i++) if (SECTIONS[i][0] === to) { idx = i; break; }
      if (idx < 0) for (i = 0; i < SECTIONS.length; i++) if (SECTIONS[i][0] === to) { idx = i; break; }
      if (idx < 0 || idx === secI) return false; secI = idx; barsLeft = SECTIONS[idx][1]; step = 0; nextTime = Math.max(nextTime, T() + .05); return true;
    },
    thump: function (v) { if (!ok()) return; var t = T(), o = osc('sine', 150), g = ctx.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(44, t + .08); o.connect(g); var e = env(g, t, 1.1 * (v || 1), .001, .3); g.connect(fx); o.start(t); o.stop(e); },
    rise: function (up) {
      if (!ok()) return; var t = T(), o = osc('triangle', up ? 220 : 330), g = ctx.createGain(); o.frequency.setValueAtTime(up ? 180 : 360, t); o.frequency.exponentialRampToValueAtTime(up ? 720 : 70, t + .35);
      o.connect(g); var e = env(g, t, .12, .01, .4); g.connect(fx); var sv = ctx.createGain(); sv.gain.value = .5; g.connect(sv); sv.connect(verbIn); o.start(t); o.stop(e);
      if (!up) { var o2 = osc('sine', 60), g2 = ctx.createGain(); o2.frequency.setValueAtTime(70, t + .25); o2.frequency.exponentialRampToValueAtTime(35, t + .6); o2.connect(g2); var e2 = env(g2, t + .25, .5, .005, .45); g2.connect(fx); o2.start(t + .25); o2.stop(e2); }
    },
    halo: function (cw) { if (!ok()) return; var t = T(); for (var i = 0; i < 8; i++) voice(4, mtof(tk.root + 24 + PENT[(cw ? i : 7 - i) % 5] + 12 * Math.floor((cw ? i : 7 - i) / 5)), .07, Math.sin(i / 8 * TAU2), t + i * .06); },
    night: function (on) { if (!ok()) return; var t = T(); [0, 7, 12].forEach(function (d, i) { voice(on ? 2 : 4, mtof(tk.root + (on ? 36 : 24) + d), .05, (i - 1) * .5, t + i * .09); }); },
    whoosh: function () {
      if (!ok()) return; var t = T(), s = noise(t, 1.4), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 1.5;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(4000, t + .5); f.frequency.exponentialRampToValueAtTime(300, t + 1.3);
      s.connect(f); f.connect(g); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.15, t + .4); g.gain.linearRampToValueAtTime(0, t + 1.3); g.connect(fx);
    },
    stop: function () {
      alive = false; playing = false; clearInterval(timer); stopFile(); if (hold) { hold.o.forEach(function (o) { try { o.stop(); } catch (e) {} }); hold = null; }
      var t = T(); out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, .08); setTimeout(function () { try { out.disconnect(); } catch (e) {} }, 500);
    }
  };
};
