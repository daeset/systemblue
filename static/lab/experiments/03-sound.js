/* 03 — Sonic Architecture: the music.
   A four-mood generative track (arranged in sections: intro, groove, break, build, drop),
   or the visitor's own audio file. Everything passes through one AnalyserNode that the
   visuals read as FFT data. Interaction sounds (plucks, keys, resonators) feed the same
   analyser, so playing the space also builds it.
   SBL.sonicSound(A) -> engine */
SBL.sonicSound = function (A) {
  'use strict';
  var ctx = A.ctx, alive = true, listener = null;
  function T() { return ctx.currentTime; }
  function ok() { return alive && ctx.state === 'running'; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function emit(type, data, at) { if (!listener) return; var d = Math.max(0, ((at || T()) - T()) * 1000); setTimeout(function () { if (alive && listener) listener(type, data); }, d); }
  function panner(v) { if (!ctx.createStereoPanner) return ctx.createGain(); var p = ctx.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; }

  // ---------- moods ----------
  var MOODS = {
    brutalist: { bpm: 94, root: 41, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3], seventh: true,
      kick: '1000000010100000', snare: '0000100000001000', hat: '0010001000100011', ohat: '0000000000000000',
      bass: [[0, 0, 0], [3, 0, 0], [10, 0, 0], [11, 7, 0]], stab: '0010000000100000', pad: false, arp: 0, lead: 'knock', snareType: 'rim', delayFb: .55 },
    glasshouse: { bpm: 112, root: 50, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 1, 5, 4], seventh: true,
      kick: '1000000010000000', snare: '0000100000001000', hat: '1111111111111111', ohat: '0000000000000000',
      bass: [[0, 0, 0], [6, 0, 0], [8, 0, 1], [14, 4, 0]], stab: '0000000000000000', pad: true, arp: 16, lead: 'bell', snareType: 'clap', delayFb: .35 },
    neon: { bpm: 124, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], seventh: false,
      kick: '1000100010001000', snare: '0000100000001000', hat: '1010101010101010', ohat: '0010001000100010',
      bass: [[2, 0, 0], [6, 0, 0], [10, 0, 0], [14, 0, 1]], stab: '1000001000100000', pad: false, arp: 16, lead: 'saw', snareType: 'clap', delayFb: .3 },
    ruins: { bpm: 78, root: 43, scale: [0, 3, 5, 7, 10], prog: [0, 0, 3, 2], seventh: false,
      kick: '1000000000100000', snare: '0010010000100101', hat: '1111111111111111', ohat: '0000000000000000',
      bass: [[0, 0, 0], [7, 0, 0], [10, 1, 0]], stab: '1000000000100000', pad: false, arp: 0, lead: 'flute', snareType: 'tom', delayFb: .4 }
  };
  var moodKey = 'brutalist', M = MOODS[moodKey];

  // ---------- graph ----------
  var out = ctx.createGain(); out.gain.value = 0; out.connect(A.out); out.gain.setTargetAtTime(.9, T(), .8);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .2; comp.connect(out);
  var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000; lp.Q.value = .5; lp.connect(comp);
  var analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .7; analyser.minDecibels = -96; analyser.maxDecibels = -18;
  comp.connect(analyser);
  var mix = ctx.createGain(); mix.connect(lp);
  var musicBus = ctx.createGain(); musicBus.connect(mix);
  var trackBus = ctx.createGain(); trackBus.connect(mix);
  var fxBus = ctx.createGain(); fxBus.gain.value = .9; fxBus.connect(mix);
  var sectionLP = ctx.createBiquadFilter(); sectionLP.type = 'lowpass'; sectionLP.frequency.value = 18000; sectionLP.connect(musicBus);
  var drums = ctx.createGain(); drums.connect(sectionLP);
  var inst = ctx.createGain(); inst.connect(sectionLP);
  var verb = ctx.createConvolver(); verb.buffer = (function (sec) {
    var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), l = 0; for (var i = 0; i < n; i++) { var k = i / n, a = .3 + .6 * k; l = l * a + (Math.random() * 2 - 1) * (1 - a); d[i] = l * Math.pow(1 - k, 2.3) * 2; } }
    return b;
  })(3.4);
  var verbIn = ctx.createGain(); verbIn.gain.value = .5; verbIn.connect(verb); verb.connect(mix);
  var dly = ctx.createDelay(2), dlyFb = ctx.createGain(), dlyF = ctx.createBiquadFilter(), dlyIn = ctx.createGain();
  dlyF.type = 'bandpass'; dlyF.frequency.value = 1200; dlyF.Q.value = .6; dlyFb.gain.value = M.delayFb;
  dlyIn.connect(dly); dly.connect(dlyF); dlyF.connect(dlyFb); dlyFb.connect(dly); dlyF.connect(inst);
  var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  (function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; })(noiseBuf.getChannelData(0));

  // ---------- voices ----------
  function env(g, t, v, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return t + a + d + .02; }
  function osc(type, f, det) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; return o; }
  function noise(t, dur) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.start(t, Math.random()); s.stop(t + dur); return s; }
  function route(g, dest, pan, wet) { var p = panner(pan); g.connect(p); p.connect(dest); if (wet) { var s = ctx.createGain(); s.gain.value = wet; p.connect(s); s.connect(verbIn); } return p; }

  var KICK = { brutalist: [120, 36, .5, 1.1], glasshouse: [110, 50, .3, .7], neon: [150, 44, .32, 1], ruins: [90, 46, .4, .8] };
  function kick(t, v) {
    var k = KICK[moodKey], o = osc('sine', k[0]), g = ctx.createGain();
    o.frequency.setValueAtTime(k[0], t); o.frequency.exponentialRampToValueAtTime(k[1], t + .1);
    o.connect(g); var end = env(g, t, k[3] * v, .002, k[2]); route(g, drums, 0); o.start(t); o.stop(end);
    emit('kick', v, t);
  }
  function snare(t, v) {
    var type = M.snareType;
    if (type === 'tom') {
      var o = osc('sine', 0), g = ctx.createGain(), f = [196, 147, 220, 165][Math.floor(Math.random() * 4)];
      o.frequency.setValueAtTime(f * 1.4, t); o.frequency.exponentialRampToValueAtTime(f, t + .04);
      o.connect(g); var e1 = env(g, t, .45 * v, .002, .32); route(g, drums, rnd(-.4, .4), .2); o.start(t); o.stop(e1); return;
    }
    var bursts = type === 'clap' ? 3 : 1;
    for (var b = 0; b < bursts; b++) {
      var tb = t + b * .011, s = noise(tb, .25), f2 = ctx.createBiquadFilter(), g2 = ctx.createGain();
      f2.type = 'bandpass'; f2.frequency.value = type === 'rim' ? 2600 : 1500; f2.Q.value = type === 'rim' ? 3 : .9;
      s.connect(f2); f2.connect(g2); env(g2, tb, (b === bursts - 1 ? .5 : .3) * v, .001, type === 'rim' ? .05 : b === bursts - 1 ? .18 : .02);
      route(g2, drums, 0, type === 'rim' ? 0 : .25);
    }
    if (type === 'rim') { var r = osc('triangle', 420), rg = ctx.createGain(); r.connect(rg); var er = env(rg, t, .25 * v, .001, .04); route(rg, drums, .15); r.start(t); r.stop(er); dlyIn.gain.value = 1; var ds = ctx.createGain(); ds.gain.value = .25; rg.connect(ds); ds.connect(dlyIn); }
  }
  function hat(t, v, open) {
    var s = noise(t, open ? .4 : .08), f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (moodKey === 'ruins') { f.type = 'bandpass'; f.frequency.value = 6500; f.Q.value = 1.2; } else { f.type = 'highpass'; f.frequency.value = 7500; }
    s.connect(f); f.connect(g);
    if (moodKey === 'ruins') { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12 * v, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + .07); }
    else env(g, t, (open ? .14 : .1) * v, .001, open ? .3 : .035);
    route(g, drums, rnd(-.3, .3));
    if (v > .6) emit('hat', v, t);
  }
  function bass(t, m, v, dur) {
    var f = mtof(m), g = ctx.createGain(), o, end;
    if (moodKey === 'neon') {
      o = osc('sawtooth', f); var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 9;
      fl.frequency.setValueAtTime(2400, t); fl.frequency.exponentialRampToValueAtTime(180, t + .18);
      o.connect(fl); fl.connect(g); end = env(g, t, .32 * v, .003, dur * .9);
    } else if (moodKey === 'glasshouse') {
      o = osc('triangle', f); o.connect(g); end = env(g, t, .42 * v, .004, dur * 1.3);
    } else {
      o = osc('sine', f); var o2 = osc(moodKey === 'brutalist' ? 'square' : 'triangle', f), g2 = ctx.createGain(), fl2 = ctx.createBiquadFilter();
      fl2.type = 'lowpass'; fl2.frequency.value = 260; g2.gain.value = .25; o2.connect(fl2); fl2.connect(g2); g2.connect(g); o.connect(g);
      end = env(g, t, .55 * v, .006, dur * 1.6); o2.start(t); o2.stop(end);
    }
    route(g, inst, 0); o.start(t); o.stop(end);
    emit('bass', m, t);
  }
  function chordTones(deg, oct) {
    var sc = M.scale, n = sc.length, r = [], k = M.seventh ? 4 : 3;
    for (var i = 0; i < k; i++) { var d = deg + i * 2; r.push(M.root + 12 * oct + sc[d % n] + 12 * Math.floor(d / n)); }
    return r;
  }
  function stab(t, deg, v) {
    var tones = chordTones(deg, 1), g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass';
    if (moodKey === 'ruins') { // rhodes-ish
      tones.forEach(function (m, i) { var c = osc('sine', mtof(m)), md = osc('sine', mtof(m)), mg = ctx.createGain(); mg.gain.setValueAtTime(mtof(m) * .9, t); mg.gain.exponentialRampToValueAtTime(1, t + 1); md.connect(mg); mg.connect(c.frequency); c.connect(g); c.start(t + i * .012); c.stop(t + 2.2); md.start(t); md.stop(t + 2.2); });
      env(g, t, .09 * v, .006, 1.8); route(g, inst, 0, .45); return;
    }
    fl.frequency.setValueAtTime(moodKey === 'brutalist' ? 1100 : 3200, t); fl.frequency.exponentialRampToValueAtTime(moodKey === 'brutalist' ? 380 : 900, t + .25); fl.Q.value = 2;
    tones.forEach(function (m) { [-12, 0, 12].slice(0, moodKey === 'neon' ? 3 : 2).forEach(function (dt) { var o = osc('sawtooth', mtof(m), dt); o.connect(fl); o.start(t); o.stop(t + .5); }); });
    fl.connect(g); env(g, t, (moodKey === 'neon' ? .05 : .07) * v, .004, moodKey === 'brutalist' ? .22 : .3);
    route(g, inst, 0, .3); var ds = ctx.createGain(); ds.gain.value = moodKey === 'brutalist' ? .9 : .4; g.connect(ds); ds.connect(dlyIn);
    emit('stab', v, t);
  }
  var padNodes = null;
  function pad(t, deg, dur) {
    var tones = chordTones(deg, 1), g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1300;
    tones.forEach(function (m) { [-8, 8].forEach(function (d) { var o = osc('sawtooth', mtof(m), d); o.connect(fl); o.start(t); o.stop(t + dur + 1.5); }); });
    fl.connect(g); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .6); g.gain.setTargetAtTime(0, t + dur, .5);
    route(g, inst, 0, .6);
  }
  function lead(t, m, v, type, dest) {
    var f = mtof(m), g = ctx.createGain(), end;
    type = type || M.lead; dest = dest || inst;
    if (type === 'bell') {
      var c = osc('sine', f), md = osc('sine', f * 3.5), mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * .02, t + 1);
      md.connect(mg); mg.connect(c.frequency); c.connect(g); end = env(g, t, .08 * v, .003, 1.4); md.start(t); md.stop(end); c.start(t); c.stop(end);
    } else if (type === 'saw') {
      var s = osc('sawtooth', f), s2 = osc('square', f * 1.003), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(5000, t); fl.frequency.exponentialRampToValueAtTime(900, t + .15);
      s.connect(fl); s2.connect(fl); fl.connect(g); end = env(g, t, .05 * v, .002, .22); s.start(t); s2.start(t); s.stop(end); s2.stop(end);
    } else if (type === 'flute') {
      var fo = osc('sine', f), vib = osc('sine', 5.2), vg = ctx.createGain(); vg.gain.value = f * .012; vib.connect(vg); vg.connect(fo.frequency);
      var br = noise(t, .8), bf = ctx.createBiquadFilter(), bg = ctx.createGain(); bf.type = 'bandpass'; bf.frequency.value = f * 2; bf.Q.value = 4; bg.gain.value = .25; br.connect(bf); bf.connect(bg); bg.connect(g);
      fo.connect(g); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09 * v, t + .08); g.gain.setTargetAtTime(0, t + .45, .15); end = t + 1.2; fo.start(t); vib.start(t); fo.stop(end); vib.stop(end);
    } else { // knock: concrete FM thud
      var k = osc('sine', f), km = osc('sine', f * 1.41), kg = ctx.createGain(); kg.gain.setValueAtTime(f * 3, t); kg.gain.exponentialRampToValueAtTime(1, t + .25);
      km.connect(kg); kg.connect(k.frequency); k.connect(g); end = env(g, t, .14 * v, .002, .6); km.start(t); km.stop(end); k.start(t); k.stop(end);
      var ds = ctx.createGain(); ds.gain.value = .5; g.connect(ds); ds.connect(dlyIn);
    }
    route(g, dest, rnd(-.5, .5), .4);
  }
  function crash(t) {
    var s = noise(t, 2.2), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 4000;
    s.connect(f); f.connect(g); env(g, t, .16, .002, 2); route(g, drums, 0, .5);
    var o = osc('sine', 60), og = ctx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.4); o.connect(og); var e = env(og, t, .8, .003, 1.5); route(og, drums, 0); o.start(t); o.stop(e);
  }
  function riser(t, dur) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; var f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + dur); g.gain.setValueAtTime(0, t + dur + .01);
    s.connect(f); f.connect(g); route(g, inst, 0, .3); s.start(t); s.stop(t + dur + .05);
  }

  // ---------- arrangement ----------
  var SECTIONS = { intro: 4, groove: 16, break: 8, build: 4, drop: 16 };
  var section = 'intro', barsLeft = SECTIONS.intro, bar = 0, step = 0, nextTime = 0, playing = true, tempoMul = 1, tempoTarget = 1;
  var gens = 0, ghost = [], kickExtra = -1, arpPat = [];
  function vary() { // every 4 bars, small mutations
    ghost = []; for (var i = 0; i < 16; i++) ghost.push(Math.random() < .12);
    kickExtra = Math.random() < .3 ? [3, 7, 11, 14][Math.floor(Math.random() * 4)] : -1;
    arpPat = []; for (var j = 0; j < 16; j++) arpPat.push(Math.random() < .82 ? [0, 1, 2, 3, 2, 1][j % 6] : -1);
  }
  vary();
  function nextSection() {
    var s = section;
    if (s === 'intro') section = 'groove';
    else if (s === 'groove') section = 'break';
    else if (s === 'break') section = Math.random() < .65 ? 'build' : 'groove';
    else if (s === 'build') section = 'drop';
    else section = 'break';
    barsLeft = section === 'groove' && s === 'break' ? 8 : SECTIONS[section];
  }
  var userBpm = 0;
  function stepDur() { return 60 / (userBpm || M.bpm) / 4 / tempoMul; }
  function schedule(st, t) {
    var sd = stepDur(), deg = M.prog[Math.floor(bar / 1) % M.prog.length], sec = section, on = function (pat) { return pat.charAt(st) === '1'; };
    if (st === 0) {
      emit('bar', { bar: bar, section: sec }, t);
      if (sec === 'drop' && barsLeft === SECTIONS.drop) { crash(t); emit('drop', null, t); }
      if (sec === 'build' && barsLeft === SECTIONS.build) { riser(t, sd * 16 * barsLeft); emit('build', null, t); }
      if (sec === 'build' && barsLeft === 2 && pendingDrop) { riser(t, sd * 32); emit('build', null, t); }
      if (barsLeft === SECTIONS[sec] || st === 0 && bar % 4 === 0) emit('section', sec, t);
      if (M.pad && sec !== 'build') pad(t, deg, sd * 16);
      sectionLP.frequency.setTargetAtTime(sec === 'break' ? 1400 : sec === 'intro' ? 2200 : sec === 'build' ? 2000 : 18000, t, sec === 'build' ? 2 : .4);
      if (sec === 'build') sectionLP.frequency.setTargetAtTime(16000, t + sd * 16 * (barsLeft - 1), sd * 8);
    }
    var full = sec === 'groove' || sec === 'drop';
    // drums
    if ((full || (sec === 'build' && st % 4 === 0 && barsLeft === 1)) && (on(M.kick) || st === kickExtra && sec === 'drop')) kick(t, sec === 'drop' ? 1 : .9);
    if (sec === 'build') { var roll = barsLeft > 2 ? st % 4 === 0 : barsLeft === 2 ? st % 2 === 0 : true; if (roll) snare(t, .35 + .5 * (1 - barsLeft / SECTIONS.build) + (st / 32)); }
    else if (full && (on(M.snare) || (ghost[st] && moodKey === 'ruins'))) snare(t, on(M.snare) ? 1 : .4);
    if (sec !== 'build') {
      if (on(M.hat)) { var hv = moodKey === 'glasshouse' ? (st % 4 === 2 ? .7 : .35) : moodKey === 'ruins' ? (st % 2 ? .4 : .8) : .8; if (sec !== 'intro' || st % 2 === 0) hat(t + (moodKey === 'ruins' && st % 2 ? sd * .18 : 0), hv * (sec === 'break' ? .6 : 1), false); }
      if (full && on(M.ohat)) hat(t, .9, true);
      if (full && ghost[st] && moodKey !== 'ruins') hat(t, .3, false);
    }
    // bass
    if (sec !== 'intro' && sec !== 'build') M.bass.forEach(function (b) { if (b[0] === st) bass(t, M.root + chordTones(deg, 0)[0] - M.root + b[1] + 12 * b[2], sec === 'break' ? .5 : 1, sd * (moodKey === 'ruins' ? 4 : 2)); });
    // harmony
    if (sec !== 'build' && on(M.stab)) stab(t, deg, sec === 'intro' ? .6 : 1);
    if (M.arp && (sec === 'drop' || sec === 'break' || (sec === 'groove' && moodKey === 'glasshouse')) && arpPat[st] >= 0 && st % (16 / M.arp) === 0) {
      var tones = chordTones(deg, moodKey === 'neon' ? 2 : 2); lead(t, tones[arpPat[st] % tones.length], sec === 'break' ? .7 : 1);
    }
    if (moodKey === 'ruins' && (sec === 'groove' || sec === 'drop' || sec === 'break') && st % 2 === 0 && bar % 2 === 1 && Math.random() < .35) lead(t, chordTones(deg, 2)[Math.floor(Math.random() * 3)], .9);
    if (moodKey === 'brutalist' && sec === 'drop' && st === 6 && Math.random() < .5) lead(t, M.root + 24 + M.scale[Math.floor(Math.random() * 7)], 1);
    // resonators: each pulses on its own polyrhythm
    if (st % 2 === 0) resonators.forEach(function (r, i) { var e8 = (bar * 8 + st / 2); if ((e8 + r.off) % r.every === 0) { lead(t, r.note, .9, 'bell', fxBus); emit('res', r.id, t); } });
  }
  var pendingDrop = false;
  function tick() {
    if (!ok()) return;
    tempoMul += (tempoTarget - tempoMul) * .08;
    if (nextTime < T()) nextTime = T() + .05;
    while (nextTime < T() + .14) {
      if (playing) schedule(step, nextTime);
      nextTime += stepDur(); step++;
      if (step === 16) {
        step = 0; bar++; barsLeft--; if (bar % 4 === 0) vary();
        if (barsLeft <= 0) { nextSection(); pendingDrop = false; }
      }
    }
  }
  var timer = setInterval(tick, 25);

  // ---------- the visitor's own track ----------
  var track = null, trackBuf = null, trackRate = 1;
  function startTrack() {
    if (track) { try { track.stop(); } catch (e) {} }
    track = ctx.createBufferSource(); track.buffer = trackBuf; track.loop = true; track.playbackRate.value = trackRate; track.connect(trackBus); track.start();
  }

  // ---------- interaction ----------
  var resonators = [];
  function quantize(f) { var m = 69 + 12 * Math.log2(f / 440), best = m, bd = 99; for (var o = -2; o < 8; o++) M.scale.forEach(function (s) { var c = M.root + s + 12 * o; if (Math.abs(c - m) < bd) { bd = Math.abs(c - m); best = c; } }); return best; }
  function degreeNote(d, oct) { var n = M.scale.length; return M.root + 12 * oct + M.scale[((d % n) + n) % n] + 12 * Math.floor(d / n); }

  return {
    analyser: analyser,
    on: function (fn) { listener = fn; },
    moods: Object.keys(MOODS),
    setMood: function (k) { if (!MOODS[k] || k === moodKey) return; moodKey = k; M = MOODS[k]; userBpm = 0; dlyFb.gain.setTargetAtTime(M.delayFb, T(), .2); dly.delayTime.setTargetAtTime(60 / M.bpm * .75, T(), .1); vary(); section = 'intro'; barsLeft = 2; },
    useTrack: function (file) {
      return file.arrayBuffer().then(function (ab) { return new Promise(function (res, rej) { var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); })
        .then(function (buf) { trackBuf = buf; startTrack(); playing = false; musicBus.gain.setTargetAtTime(0, T(), .3); trackBus.gain.setTargetAtTime(1, T(), .1); return buf.duration; });
    },
    useGenerative: function () { playing = true; musicBus.gain.setTargetAtTime(1, T(), .3); trackBus.gain.setTargetAtTime(0, T(), .2); var tr = track; setTimeout(function () { if (tr && tr === track && playing) { try { tr.stop(); } catch (e) {} track = null; } }, 900); },
    hasTrack: function () { return !!trackBuf; },
    resumeTrack: function () { if (trackBuf) { startTrack(); playing = false; musicBus.gain.setTargetAtTime(0, T(), .3); trackBus.gain.setTargetAtTime(1, T(), .1); } },
    pluck: function (freq, pan) { if (!ok()) return; var m = quantize(freq), t = T() + .01; lead(t, m, 1.2, M.lead === 'knock' ? 'knock' : M.lead === 'flute' ? 'bell' : M.lead, fxBus); return m; },
    key: function (d, low) { if (!ok()) return; var t = T() + .005; if (low) bass(t, degreeNote(d, 0), 1, .5); else lead(t, degreeNote(d, 2), 1.3, null, fxBus); },
    addResonator: function (id, ringIdx) { var n = M.scale.length; resonators.push({ id: id, note: degreeNote(ringIdx + 7, 1), every: 3 + (resonators.length % 3), off: resonators.length * 2 }); if (resonators.length > 8) resonators.shift(); },
    removeResonator: function (id) { resonators = resonators.filter(function (r) { return r.id !== id; }); },
    shatter: function () {
      if (!ok()) return; var t = T();
      crash(t); for (var i = 0; i < 6; i++) lead(t + i * .03, degreeNote(i * 2, 3), 1, 'bell', fxBus);
    },
    dilate: function (on) {
      tempoTarget = on ? .5 : 1; trackRate = on ? .62 : 1;
      if (track) track.playbackRate.setTargetAtTime(trackRate, T(), on ? .6 : .25);
      lp.frequency.setTargetAtTime(on ? 1100 : 18000, T(), on ? .5 : .3); verbIn.gain.setTargetAtTime(on ? 1.2 : .5, T(), .5);
    },
    drop: function () {
      if (!ok()) return 'no';
      if (playing) { if (section === 'build' || section === 'drop') return 'busy'; section = 'build'; barsLeft = 3; pendingDrop = true; return 'build'; }
      var t = T(); riser(t, 2.5); setTimeout(function () { if (alive) { crash(T()); emit('drop', null); } }, 2500); emit('build', null); return 'build';
    },
    section: function () { return playing ? section : 'track'; },
    bpm: function () { return (userBpm || M.bpm) * tempoMul; },
    setTempo: function (b) { userBpm = clamp(b, 60, 180); dly.delayTime.setTargetAtTime(60 / userBpm * .75, T(), .1); },
    muffle: function (sec) { var t = T(); lp.frequency.cancelScheduledValues(t); lp.frequency.setTargetAtTime(480, t, .3); lp.frequency.setTargetAtTime(18000, t + sec, .7); },
    scratch: function (level) {
      if (!ok()) return; var t = T(), up = Math.random() < .5;
      var s = noise(t, .14), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(up ? 380 : 2600, t); f.frequency.exponentialRampToValueAtTime(up ? 2600 : 380, t + .09);
      env(g, t, .1 + .25 * level, .004, .1); s.connect(f); f.connect(g); g.connect(fxBus);
      musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(playing ? .2 : 0, t); musicBus.gain.setTargetAtTime(playing ? 1 : 0, t + .07, .04);
      if (track) { track.playbackRate.cancelScheduledValues(t); track.playbackRate.setValueAtTime(up ? 1.7 : .45, t); track.playbackRate.setTargetAtTime(trackRate, t + .07, .05); }
    },
    stop: function () {
      alive = false; clearInterval(timer); var t = T(); out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, .08);
      setTimeout(function () { if (track) try { track.stop(); } catch (e) {} try { out.disconnect(); } catch (e) {} }, 500);
    }
  };
};
