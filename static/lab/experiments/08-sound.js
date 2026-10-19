/* 08 - The Unreliable Alphabet: interpretive audio.
   Every word gets its own voice, and the voice contradicts the word in the same way its letters do.
   Seven relationships, each with two poles:
     tremor  STABLE trembles (beating tremolo)        / SHAKE won't move (one dead-still sine)
     noise   SILENCE erupts (crackle, bursts)         / NOISE makes no sound at all
     vanish  PERMANENT fades (a bell, quieter each time) / FLEETING stays (a drone that thickens)
     scale   BIG shrinks (tiny glass chirps)          / SMALL swells (sub and thump)
     unity   TOGETHER comes apart (a chord detuning, panning apart) / APART clings (a beating unison)
     tempo   FAST drags (one slow note at a time)     / SLOW twitches (rapid ticks)
     order   CLEAR scrambles (an arpeggio out of order) / CHAOS falls in line (a plain rising scale)
   Touching a letter speaks it: vowels get formants, consonants get a burst.
   SBL.alphabetSound(A) -> engine */
SBL.alphabetSound = function (A) {
  'use strict';
  var ctx = A.ctx, alive = true;
  function T() { return ctx.currentTime; }
  function ok() { return alive && ctx.state === 'running'; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function panner(v) { if (!ctx.createStereoPanner) return ctx.createGain(); var p = ctx.createStereoPanner(); p.pan.value = clamp(v || 0, -1, 1); return p; }

  var master = ctx.createGain(); master.gain.value = 0; master.connect(A.out); master.gain.setTargetAtTime(1.3, T(), .4);
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(master);
  var dry = ctx.createGain(); dry.connect(comp);
  var verb = ctx.createConvolver(); verb.buffer = (function () { var n = Math.floor(ctx.sampleRate * 2.6), b = ctx.createBuffer(2, n, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.4); } return b; })();
  var wet = ctx.createGain(); wet.gain.value = .4; wet.connect(verb); verb.connect(comp);
  var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); (function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; })(noiseBuf.getChannelData(0));
  function env(g, t, v, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return t + a + d + .05; }
  function out(node, pan, w) { var p = panner(pan); node.connect(p); p.connect(dry); var s = ctx.createGain(); s.gain.value = w == null ? .4 : w; p.connect(s); s.connect(wet); return p; }
  function tone(type, f, t, v, a, d, pan, w, dest) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.connect(g); var e = env(g, t, v, a, d); if (dest) g.connect(dest); else out(g, pan, w); o.start(t); o.stop(e); return o; }
  function burst(t, v, f, q, d, pan, dest) { var s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; s.connect(bp); bp.connect(g); var e = env(g, t, v, .001, d); if (dest) g.connect(dest); else out(g, pan, .3); s.start(t, Math.random()); s.stop(e); }

  var SC = [0, 2, 3, 5, 7, 8, 10], MAJ = [0, 2, 4, 7, 9];
  var ROOT = { tremor: 57, noise: 60, vanish: 69, scale: 72, unity: 60, tempo: 64, order: 62 };
  function letterNote(ch, base, sc) { var c = (ch.toUpperCase().charCodeAt(0) - 65); if (c < 0 || c > 25) c = 7; sc = sc || SC; return base + sc[c % sc.length] + 12 * Math.floor(c / sc.length / 2); }
  var FORM = { A: [800, 1150], E: [400, 2000], I: [300, 2300], O: [450, 800], U: [325, 700], Y: [300, 2100] };
  function speak(ch, m, t, v, dest, wave) { // a letter, said briefly
    ch = (ch || 'A').toUpperCase(); var f = FORM[ch];
    if (f) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = wave || 'sawtooth'; o.frequency.value = mtof(m);
      f.forEach(function (ff, i) { var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 8; o.connect(bp); bp.connect(g); });
      var e = env(g, t, v * 1.6, .015, .28); g.connect(dest); o.start(t); o.stop(e);
    } else {
      burst(t, v * (/[SZXCFH]/.test(ch) ? 1.2 : .6), /[SZXC]/.test(ch) ? 6000 : 2500, 2, /[SZXCFH]/.test(ch) ? .12 : .03, 0, dest);
      tone(wave === 'sine' ? 'sine' : 'triangle', mtof(m), t + .01, v * .7, .004, .16, 0, 0, dest);
    }
  }

  function voice(rel, pol, seed, word) {
    var bus = ctx.createGain(), p = out(bus, 0, .5), V = { rel: rel, pol: pol }, nodes = [], next = T() + .3, I = .35, att = 0, gone = 0, scaleK = 1, step = 0, held = 0;
    bus.gain.value = 0; bus.gain.setTargetAtTime(1, T(), .3);
    var root = ROOT[rel] + [0, 2, 5, 7, -5][seed % 5];
    function keep(n) { nodes.push(n); return n; }
    // continuous parts
    var c = {};
    if (rel === 'tremor') {
      c.o1 = keep(ctx.createOscillator()); c.o2 = keep(ctx.createOscillator()); c.am = ctx.createGain(); c.lfo = keep(ctx.createOscillator()); c.lg = ctx.createGain(); c.g = ctx.createGain();
      c.o1.frequency.value = mtof(root - 12); c.o2.frequency.value = mtof(root - 12); c.o1.type = 'sine'; c.o2.type = pol > 0 ? 'triangle' : 'sine';
      c.am.gain.value = 1; c.lfo.frequency.value = 6; c.lg.gain.value = 0; c.lfo.connect(c.lg); c.lg.connect(c.am.gain);
      c.o1.connect(c.am); c.o2.connect(c.am); c.am.connect(c.g); c.g.gain.value = .03; c.g.connect(bus);
      [c.o1, c.o2, c.lfo].forEach(function (o) { o.start(); });
    } else if (rel === 'noise' && pol > 0) {
      c.s = keep(ctx.createBufferSource()); c.s.buffer = noiseBuf; c.s.loop = true; c.bp = ctx.createBiquadFilter(); c.bp.type = 'bandpass'; c.bp.frequency.value = 1200; c.bp.Q.value = .8; c.g = ctx.createGain(); c.g.gain.value = 0;
      c.s.connect(c.bp); c.bp.connect(c.g); c.g.connect(bus); c.s.start();
    } else if (rel === 'vanish' && pol < 0) {
      c.g = ctx.createGain(); c.g.gain.value = 0; c.lp = ctx.createBiquadFilter(); c.lp.type = 'lowpass'; c.lp.frequency.value = 400; c.lp.connect(c.g); c.g.connect(bus); c.os = [];
      [0, 7, 12, 16, 19].forEach(function (iv, i) { var o = keep(ctx.createOscillator()), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(root - 24 + iv); o.detune.value = (i - 2) * 5; g.gain.value = 0; o.connect(g); g.connect(c.lp); o.start(); c.os.push(g); });
    } else if (rel === 'scale' && pol < 0) {
      c.o = keep(ctx.createOscillator()); c.o.type = 'sine'; c.o.frequency.value = mtof(root - 48); c.o2 = keep(ctx.createOscillator()); c.o2.type = 'triangle'; c.o2.frequency.value = mtof(root - 36); c.g = ctx.createGain(); c.g.gain.value = 0; c.o.connect(c.g); c.o2.connect(c.g); c.g.connect(bus); c.o.start(); c.o2.start();
    } else if (rel === 'unity') {
      c.g = ctx.createGain(); c.g.gain.value = .022; c.g.connect(bus); c.v = [];
      [0, 4, 7].forEach(function (iv, i) { var o = keep(ctx.createOscillator()), pn = panner(0); o.type = 'triangle'; o.frequency.value = mtof(root + iv - 12); o.connect(pn); pn.connect(c.g); o.start(); c.v.push({ o: o, p: pn, iv: iv, i: i }); });
    }
    V.update = function (inst, attention, x, y, extra) {
      if (!alive) return; var t = T(); I = inst; att = attention; extra = extra || {}; if (p.pan) p.pan.setTargetAtTime(clamp(x * 2 - 1, -1, 1), t, .1);
      if (extra.gone != null) gone = extra.gone; if (extra.scale != null) scaleK = extra.scale; if (extra.held != null) held = extra.held;
      if (rel === 'tremor') {
        if (pol > 0) { c.lfo.frequency.setTargetAtTime(3 + I * 22, t, .1); c.lg.gain.setTargetAtTime(clamp(I, 0, 1), t, .1); c.o2.detune.setTargetAtTime(I * 45 + att * 30, t, .1); c.g.gain.setTargetAtTime(.02 + att * .05 + I * .02, t, .2); }
        else { c.lg.gain.setTargetAtTime(0, t, .05); c.o2.detune.setTargetAtTime(0, t, .05); c.g.gain.setTargetAtTime(.012 + att * .015, t, .3); }
      } else if (rel === 'noise' && pol > 0) {
        c.g.gain.setTargetAtTime(Math.max(0, I - .3) * .08 + att * .1, t, .08); c.bp.frequency.setTargetAtTime(600 + I * 3000 + att * 2000, t, .1);
      } else if (rel === 'vanish' && pol < 0) {
        var k = clamp(extra.weight || 0, 0, 1); c.g.gain.setTargetAtTime(.02 + k * .05, t, .5); c.lp.frequency.setTargetAtTime(300 + k * 2400, t, .5); c.os.forEach(function (g, i) { g.gain.setTargetAtTime(i <= k * 5 ? .3 : 0, t, .6); });
      } else if (rel === 'scale' && pol < 0) {
        c.g.gain.setTargetAtTime(clamp((scaleK - 1) * .08, 0, .16), t, .3);
      } else if (rel === 'unity') {
        var spread = pol > 0 ? I * (1 - held) : 0;
        c.v.forEach(function (v) { v.o.detune.setTargetAtTime(pol > 0 ? (v.i - 1) * spread * 70 : (v.i - 1) * 8 - v.iv * 100 * (1 - held * .8), t, .25); if (v.p.pan) v.p.pan.setTargetAtTime(pol > 0 ? (v.i - 1) * spread : 0, t, .2); });
        c.g.gain.setTargetAtTime(.015 + att * .03, t, .2);
      }
    };
    V.tick = function () { // scheduled events
      if (!ok()) return; var t = T(); if (t < next) return;
      if (rel === 'noise' && pol > 0) { if (Math.random() < I * .5 + att) for (var i = 0; i < 2 + I * 8; i++) burst(t + Math.random() * .2, .05 + att * .1, 400 + Math.random() * 7000, 3, .02, 0, bus); next = t + .12 + (1 - I) * .4; }
      else if (rel === 'vanish' && pol > 0) { var v = .07 * Math.pow(1 - gone, 1.5); if (v > .002) { var o = tone('sine', mtof(root), t, v, .003, 2.2, 0, 0, bus); tone('sine', mtof(root) * 2.76, t, v * .3, .003, 1, 0, 0, bus); } next = t + 2.4; }
      else if (rel === 'vanish' && pol < 0) { tone('sine', mtof(root - 12), t, .03, .4, 3, 0, 0, bus); next = t + 4; }
      else if (rel === 'scale' && pol > 0) { var f = mtof(root + 24 + [0, 7, 12, 19][step++ % 4]) * (1 + (1 - scaleK) * .5); tone('sine', f, t, .025 * Math.max(.2, scaleK), .002, .12, 0, 0, bus); next = t + .5 + Math.random() * .6; }
      else if (rel === 'tempo') { if (pol > 0) { tone('triangle', mtof(root - 12 + MAJ[step++ % 5]), t, .05, .5 + I, 2.2, 0, 0, bus); next = t + 1.6 + I * 3; } else { burst(t, .04 + att * .04, 3000 + (step % 3) * 1500, 6, .015, 0, bus); tone('square', mtof(root + 12 + MAJ[step++ % 5]), t, .012, .001, .04, 0, 0, bus); next = t + 1 / (7 + I * 14); } }
      else if (rel === 'order') {
        var idx = step % 7; if (pol > 0 && Math.random() < I) idx = Math.floor(Math.random() * 7); step++;
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(bus);
        tone(pol > 0 ? 'square' : 'triangle', mtof(root + SC[idx] + (pol > 0 && Math.random() < I * .4 ? 12 : 0)), t, .025, .004, .2, 0, 0, lp);
        if (pol > 0 && Math.random() < I * .3) { tone('square', mtof(root + SC[idx]), t + .06, .02, .002, .06, 0, 0, lp); tone('square', mtof(root + SC[idx]), t + .09, .015, .002, .05, 0, 0, lp); }
        next = t + (pol > 0 ? .17 + Math.random() * .1 * I : .22);
      } else next = t + 1;
    };
    V.touch = function (i, ch) {
      if (!ok()) return; var t = T(), m = letterNote(ch, root, rel === 'unity' ? MAJ : SC);
      if (rel === 'noise' && pol < 0) { burst(t, .01, 9000, 1, .01, 0, bus); return; } // NOISE: almost nothing
      if (rel === 'noise') { for (var k = 0; k < 6; k++) burst(t + k * .02, .1, 500 + Math.random() * 6000, 2, .05, 0, bus); }
      if (rel === 'scale') { if (pol > 0) { tone('sine', mtof(m + 24), t, .03, .001, .08, 0, 0, bus); return; } var o = tone('sine', 90, t, .3, .002, .5, 0, 0, bus); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .3); }
      speak(ch, rel === 'tremor' && pol > 0 ? m - 12 : m, t, .05, bus, rel === 'tremor' && pol < 0 ? 'sine' : rel === 'order' ? 'square' : 'sawtooth');
      if (rel === 'tremor' && pol > 0) for (var j = 1; j < 5; j++) speak(ch, m - 12 + (Math.random() - .5) * I, t + j * .04, .03 / j, bus);
      if (rel === 'vanish' && pol > 0) tone('sine', mtof(m + 12), t + .02, .03 * (1 - gone), .002, 1.5, 0, 0, bus);
    };
    V.drag = function (amt) { if (!ok()) return; if (rel === 'tremor' && pol < 0) return; if (Math.random() < .25) burst(T(), .015 + amt * .03, 600 + amt * 3000, 4, .04, 0, bus); };
    V.gather = function () { if (!ok()) return; var t = T(); [0, 4, 7].forEach(function (iv, i) { tone('triangle', mtof(root + iv), t + i * .03, .04, .01, 1.2, 0, 0, bus); }); };
    V.burst = function (lv) { if (!ok()) return; var t = T(); for (var k = 0; k < 10 + lv * 20; k++) burst(t + Math.random() * .4, .06 * lv + .02, 300 + Math.random() * 8000, 2, .04 + Math.random() * .1, 0, bus); };
    V.stop = function () { var t = T(); bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, .2); setTimeout(function () { nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); try { bus.disconnect(); } catch (e) {} }, 1200); };
    return V;
  }

  var hushG = 1;
  return {
    voice: voice,
    key: function (ch) { if (!ok()) return; var t = T(); burst(t, .05, 2200 + (ch.charCodeAt(0) % 26) * 120, 5, .025, (Math.random() - .5) * .4); tone('sine', mtof(letterNote(ch, 72)), t, .015, .001, .08, 0, .2); },
    erase: function () { if (!ok()) return; var t = T(); burst(t, .05, 900, 3, .06, 0); },
    hush: function (on) { var t = T(); hushG = on ? 0 : 1; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(on ? 0 : 1.3, t, on ? 1.2 : .15); },
    tear: function () { if (!ok()) return; var t = T(); for (var i = 0; i < 12; i++) burst(t + i * .015, .08, 2000 + Math.random() * 5000, 1.5, .03, (Math.random() - .5)); var o = tone('triangle', 300, t, .05, .002, .6, 0); o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(60, t + .6); },
    gone: function () { if (!ok()) return; var t = T(); tone('sine', mtof(81), t, .03, .5, 4, 0, 1); },
    pair: function () { if (!ok()) return; var t = T(); [0, 5, 7, 12].forEach(function (iv, i) { tone('triangle', mtof(60 + iv), t + i * .09, .04, .01, .9, i % 2 ? .6 : -.6, .7); tone('triangle', mtof(72 - iv), t + i * .09, .04, .01, .9, i % 2 ? -.6 : .6, .7); }); },
    reliable: function () { if (!ok()) return; var t = T(); tone('sine', mtof(60), t, .06, .02, 2.2, 0, .5); tone('sine', mtof(67), t, .05, .02, 2.2, 0, .5); },
    unreliable: function () { if (!ok()) return; var t = T(); for (var i = 0; i < 24; i++) tone('square', mtof(48 + Math.random() * 36), t + i * .03, .02, .002, .08, Math.random() * 2 - 1, .3); },
    kept: function () { if (!ok()) return; var t = T(); [0, 7, 12].forEach(function (iv, i) { tone('sine', mtof(57 + iv), t + i * .25, .04, .3, 3, 0, .8); }); },
    thrown: function (x) { if (!ok()) return; var t = T(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3000, t + .25); s.connect(f); f.connect(g); var e = env(g, t, .1, .02, .35); out(g, x * 2 - 1, .3); s.start(t); s.stop(e); },
    bump: function (x) { if (!ok()) return; var t = T(); burst(t, .08, 900, 4, .04, x * 2 - 1); tone('sine', 120, t, .08, .002, .15, x * 2 - 1, .2); },
    collide: function (x) { if (!ok()) return; var t = T(); burst(t, .14, 2500, 3, .05, x * 2 - 1); tone('square', mtof(76), t, .02, .002, .15, -.5, .3); tone('square', mtof(71), t + .05, .02, .002, .15, .5, .3); },
    swap: function () { if (!ok()) return; var t = T(); [0, 7].forEach(function (iv, i) { tone('triangle', mtof(67 + iv), t + i * .12, .04, .01, .7, i ? .6 : -.6, .6); tone('triangle', mtof(74 - iv), t + .3 + i * .12, .04, .01, .7, i ? -.6 : .6, .6); }); },
    split: function () { if (!ok()) return; var t = T(); burst(t, .15, 4000, 2, .06, 0); var a = tone('sine', mtof(72), t, .04, .005, .8, -.8, .6), b = tone('sine', mtof(72), t, .04, .005, .8, .8, .6); a.frequency.exponentialRampToValueAtTime(mtof(65), t + .6); b.frequency.exponentialRampToValueAtTime(mtof(79), t + .6); },
    reverse: function () { if (!ok()) return; var t = T(); [0, 4, 7, 12, 16].forEach(function (iv, i) { var o = tone('triangle', mtof(60 + iv), t + .5 - i * .1, .03, .3, .05, 0, .7); }); },
    quake: function () { if (!ok()) return; var t = T(), o = tone('sawtooth', 50, t, .12, .02, 1.6, 0, .2); o.frequency.exponentialRampToValueAtTime(30, t + 1.5); for (var i = 0; i < 30; i++) burst(t + .4 + Math.random() * .7, .05, 1500 + Math.random() * 4000, 6, .02, Math.random() * 2 - 1); },
    question: function () { if (!ok()) return; var t = T(); [0, 2, 4, 7, 11].forEach(function (iv, i) { tone('sine', mtof(64 + iv), t + i * .08, .03, .005, .5, 0, .7); }); },
    sentence: function (n) { if (!ok()) return; var t = T(), prog = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7, 12]]; for (var i = 0; i < Math.min(4, n); i++) prog[i].forEach(function (iv) { tone('triangle', mtof(55 + iv), t + i * .45, .025, .02, 1, 0, .8); }); },
    undo: function () { if (!ok()) return; var t = T(), o = tone('sawtooth', mtof(84), t, .03, .01, .5, 0, .4); o.frequency.exponentialRampToValueAtTime(mtof(48), t + .45); },
    shout: function () { if (!ok()) return; var t = T(); burst(t, .2, 1200, .8, .3, 0); tone('square', mtof(55), t, .05, .005, .3, 0, .3); },
    palindrome: function () { if (!ok()) return; var t = T(); [0, 7, 12, 7, 0].forEach(function (iv, i) { tone('sine', mtof(60 + iv), t + i * .14, .035, .01, .8, (i - 2) / 2, .8); }); },
    anagram: function () { if (!ok()) return; var t = T(); for (var i = 0; i < 10; i++) tone('triangle', mtof(64 + [0, 5, 2, 7, 4, 9][i % 6]), t + i * .06, .025, .002, .12, Math.sin(i), .4); },
    echo: function () { if (!ok()) return; var t = T(); for (var i = 0; i < 4; i++) tone('sine', mtof(67), t + i * .22, .04 / (i + 1), .005, .4, i % 2 ? .5 : -.5, .9); },
    pick: function () { if (!ok()) return; tone('sine', mtof(79), T(), .02, .002, .08, 0, .2); },
    select: function (x) { if (!ok()) return; tone('triangle', mtof(72), T(), .02, .002, .1, x * 2 - 1, .3); },
    stop: function () { alive = false; var t = T(); master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(0, t, .1); setTimeout(function () { try { master.disconnect(); } catch (e) {} }, 800); }
  };
};
