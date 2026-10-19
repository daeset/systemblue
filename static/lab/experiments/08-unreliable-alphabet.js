/* 08 - The Unreliable Alphabet. Language with physical properties, deliberately unreliable.
   Not a dictionary of gimmicks: seven relationships between meaning and motion, each with two poles.
   A word moves against what it means, and its opposite does the opposite:
     Stillness / tremor       STABLE trembles      SHAKE won't move
     Silence / noise          SILENCE erupts       NOISE makes no sound
     Permanence / vanishing   PERMANENT fades      FLEETING stays (and is still here next visit)
     Size / inversion         BIG shrinks          SMALL swells
     Unity / dispersal        TOGETHER comes apart APART clings
     Speed / delay            FAST drags           SLOW twitches
     Clarity / scramble       CLEAR scrambles      CHAOS falls in line
   The viewer is responsible: attention (hovering, staring, touching) raises a word's instability; leaving it alone
   lets it settle. Words it does not know are given a relationship anyway.
   HTML letters with variable-font axes (wght, wdth, slnt, opsz), an SVG displacement filter, GSAP tweens,
   and a Canvas layer for particle disintegration. */
SBL.register('08', {
  mount: function (stage, api) {
    'use strict';
    var ac = new AbortController(), sig = { signal: ac.signal }, TOUCH = !!api.touch;
    var W = innerWidth, H = innerHeight;
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

    // ---------- tweening: GSAP when present, a small stand-in otherwise ----------
    var Tw = (function () {
      if (window.gsap) return { to: function (o, v) { if (!v.overwrite) v.overwrite = 'auto'; return gsap.to(o, v); }, kill: function (o) { gsap.killTweensOf(o); } };
      var list = [];
      function ease(n) {
        n = n || 'power2.out';
        if (n === 'none') return function (k) { return k; };
        if (n.indexOf('elastic') === 0) return function (k) { return k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - .75) * (2 * Math.PI / 3)) + 1; };
        if (n.indexOf('back') === 0) return function (k) { var c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
        if (n.indexOf('inOut') > 0) return function (k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
        if (n.indexOf('.in') > 0) return function (k) { return k * k * k; };
        return function (k) { return 1 - Math.pow(1 - k, 3); };
      }
      function run(now) { for (var i = list.length - 1; i >= 0; i--) { var t = list[i], k = (now - t.t0) / t.d; if (k < 0) continue; if (!t.started) { t.started = true; for (var p in t.to) t.from[p] = t.o[p]; } k = Math.min(1, k); var e = t.e(k); for (var q in t.to) t.o[q] = t.from[q] + (t.to[q] - t.from[q]) * e; if (k >= 1) { list.splice(i, 1); if (t.cb) t.cb(); } } }
      return {
        to: function (o, v) { var to = {}, d = (v.duration == null ? .5 : v.duration) * 1000; for (var k in v) if (typeof v[k] === 'number' && k !== 'duration' && k !== 'delay') to[k] = v[k]; list = list.filter(function (t) { if (t.o !== o) return true; for (var q in to) delete t.to[q]; return Object.keys(t.to).length > 0; }); list.push({ o: o, to: to, from: {}, t0: performance.now() + (v.delay || 0) * 1000, d: Math.max(1, d), e: ease(v.ease), cb: v.onComplete }); },
        kill: function (o) { list = list.filter(function (t) { return t.o !== o; }); },
        tick: run
      };
    })();

    // ---------- the lexicon: seven relationships ----------
    var RELS = {
      tremor: { name: 'Stillness', pos: 'trembles', neg: 'won\u2019t move', color: '#ff5a36', words: ['STABLE', 'STILL', 'CALM', 'STEADY', 'SOLID', 'BALANCE', 'ANCHOR', 'FIXED', 'CERTAIN', 'SURE', 'REST', 'RELIABLE', 'TRUST'], opp: ['SHAKE', 'TREMBLE', 'NERVOUS', 'RESTLESS', 'PANIC', 'QUAKE', 'SHIVER'] },
      noise: { name: 'Silence', pos: 'erupts', neg: 'makes no sound', color: '#3d7bff', words: ['SILENCE', 'QUIET', 'HUSH', 'WHISPER', 'MUTE', 'PEACE', 'NOTHING', 'SOFT', 'GENTLE', 'SILENT', 'LISTEN'], opp: ['NOISE', 'LOUD', 'SCREAM', 'SHOUT', 'ROAR', 'CRASH', 'BANG'] },
      vanish: { name: 'Permanence', pos: 'fades', neg: 'stays', color: '#d8cfbd', words: ['PERMANENT', 'FOREVER', 'ETERNAL', 'ALWAYS', 'REMEMBER', 'MONUMENT', 'STONE', 'CONSTANT', 'LEGACY', 'HISTORY'], opp: ['FLEETING', 'MOMENT', 'BRIEF', 'FORGET', 'TEMPORARY', 'GHOST', 'EPHEMERAL', 'GONE'] },
      scale: { name: 'Size', pos: 'shrinks', neg: 'swells', color: '#ffc21a', words: ['BIG', 'HUGE', 'GIANT', 'VAST', 'ENORMOUS', 'POWER', 'MORE', 'GRAND', 'LARGE'], opp: ['SMALL', 'TINY', 'LITTLE', 'LESS', 'HUMBLE', 'MINOR', 'FEW', 'MODEST'] },
      unity: { name: 'Unity', pos: 'comes apart', neg: 'clings', color: '#ff5fa8', words: ['TOGETHER', 'UNITY', 'WHOLE', 'CONNECT', 'HOLD', 'EMBRACE', 'LOVE', 'WE', 'ONE', 'BOND'], opp: ['APART', 'ALONE', 'DIVIDE', 'SEPARATE', 'BREAK', 'LONELY', 'SPLIT'] },
      tempo: { name: 'Speed', pos: 'drags', neg: 'twitches', color: '#1fd18b', words: ['FAST', 'QUICK', 'RUSH', 'NOW', 'URGENT', 'HURRY', 'RUN', 'INSTANT', 'RAPID'], opp: ['SLOW', 'WAIT', 'PATIENCE', 'LATER', 'PAUSE', 'LINGER', 'DRIFT'] },
      order: { name: 'Clarity', pos: 'scrambles', neg: 'falls in line', color: '#9b6bff', words: ['ORDER', 'CLEAR', 'TRUTH', 'READ', 'SIMPLE', 'LEGIBLE', 'MEANING', 'PLAIN', 'STRAIGHT', 'LANGUAGE', 'WORD'], opp: ['CHAOS', 'MESS', 'RANDOM', 'JUMBLE', 'BLUR', 'CONFUSION'] }
    };
    var REL_KEYS = Object.keys(RELS), LEX = {}, CURATED = [];
    REL_KEYS.forEach(function (k) { RELS[k].words.forEach(function (w) { LEX[w] = [k, 1]; }); RELS[k].opp.forEach(function (w) { LEX[w] = [k, -1]; }); CURATED.push(RELS[k].words[0], RELS[k].opp[0]); });
    function classify(text) {
      var t = text.toUpperCase(); if (LEX[t]) return { rel: LEX[t][0], pol: LEX[t][1], known: true };
      if (/ING$/.test(t)) { var st = t.slice(0, -3), st2 = st.slice(0, -1), st3 = st + 'E'; var hit = LEX[st] ? st : (st.length > 2 && st[st.length - 1] === st[st.length - 2] && LEX[st2]) ? st2 : LEX[st3] ? st3 : null; if (hit) return { rel: LEX[hit][0], pol: LEX[hit][1], known: true }; }
      if (/(LY|ED|S)$/.test(t)) { var b = t.replace(/(LY|ED|S)$/, ''); if (LEX[b]) return { rel: LEX[b][0], pol: LEX[b][1], known: true }; }
      if (/^(UN|IN|NON|DIS)/.test(t)) { var r = t.replace(/^(UN|IN|NON|DIS)/, ''); if (LEX[r]) return { rel: LEX[r][0], pol: -LEX[r][1], known: true, negated: true }; }
      var h = hash(t); return { rel: REL_KEYS[h % REL_KEYS.length], pol: (h >>> 8) % 5 === 0 ? -1 : 1, known: false };
    }

    // ---------- palettes ----------
    var PALS = { night: { name: 'Night', bg: '#0b0b0d', ink: '#f1ede4', dim: '#6c6a66', dark: true }, paper: { name: 'Paper', bg: '#ece7dc', ink: '#121212', dim: '#8a857b', dark: false }, signal: { name: 'Signal', bg: '#151515', ink: '#e8ff3a', dim: '#5e6630', dark: true } };
    var PAL_KEYS = Object.keys(PALS);

    // ---------- state ----------
    var store = {}; try { store = JSON.parse(localStorage.getItem('sbl-08') || '{}') || {}; } catch (e) {}
    var inst = store.inst != null ? store.inst : .35, palKey = PALS[store.pal] ? store.pal : 'night', labels = store.labels !== false, kept = store.kept || [], visits = (store.visits || 0) + 1;
    function persist() { try { localStorage.setItem('sbl-08', JSON.stringify({ inst: inst, pal: palKey, labels: labels, kept: kept, visits: visits })); } catch (e) {} }
    persist();

    // ---------- discoveries ----------
    var FINDS = { spoken: 'it says itself, wrongly', thrown: 'thrown', collide: 'they traded a letter', swap: 'they traded meanings', split: 'stretched until it split', mirror: 'read backwards', quake: 'everything fell', lean: 'the page tilts', question: 'asked, it answers with its opposite', sentence: 'a sentence, briefly', undo: 'it remembers itself slightly wrong', shout: 'shouted', palindrome: 'the same both ways: it cannot be moved', anagram: 'the same letters, a different meaning', echo: 'said twice, it means less', attention: 'the closer you read, the less it says', settle: 'left alone, it settles', yours: 'your word', unknown: 'it decided what your word means', opposite: 'its opposite does the opposite', pair: 'opposites trade places', tear: 'a letter came loose', respell: 'one letter less, a different word', gone: 'permanent, briefly', kept: 'fleeting, but it stayed', reliable: 'nothing here is reliable', quiet: 'you let it be quiet', negate: 'un- turns it inside out' };
    var KEYS = Object.keys(FINDS), found = {};
    api.pips(KEYS.length);
    function find(k) { if (found[k]) return; found[k] = 1; api.light(KEYS.indexOf(k)); api.whisper(FINDS[k]); }

    // ---------- sound ----------
    var snd = null;
    try { var A = api.audio && api.audio(); if (A && SBL.alphabetSound) snd = SBL.alphabetSound(A); } catch (e) { snd = null; }
    function S(name) { if (!snd) return; try { return snd[name].apply(snd, [].slice.call(arguments, 1)); } catch (e) {} }
    function VS(w, name) { if (!w.voice) return; try { return w.voice[name].apply(w.voice, [].slice.call(arguments, 2)); } catch (e) {} }

    // ---------- font ----------
    var FONT = '"Roboto Flex", "Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif';
    if (!document.getElementById('sbl-roboto-flex')) { var lk = document.createElement('link'); lk.id = 'sbl-roboto-flex'; lk.rel = 'stylesheet'; lk.href = 'https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,slnt,wdth,wght@8..144,-10..0,25..151,100..1000&display=swap'; document.head.appendChild(lk); }

    // ---------- layers ----------
    var root = document.createElement('div'); root.style.cssText = 'position:absolute;inset:0;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;cursor:default';
    var svgNS = 'http://www.w3.org/2000/svg', fsvg = document.createElementNS(svgNS, 'svg'); fsvg.setAttribute('width', '0'); fsvg.setAttribute('height', '0'); fsvg.style.position = 'absolute';
    root.appendChild(fsvg);
    var wordsEl = document.createElement('div'); wordsEl.style.cssText = 'position:absolute;inset:0'; root.appendChild(wordsEl);
    var cv = document.createElement('canvas'), c = cv.getContext('2d'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; root.appendChild(cv);
    var input = document.createElement('input'); input.type = 'text'; input.autocapitalize = 'characters'; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('aria-label', 'Type a word');
    input.style.cssText = 'position:absolute;left:-9999px;top:50%;opacity:0;width:10px;height:10px;font-size:16px'; root.appendChild(input);
    var label = document.createElement('div'); label.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;font:11px/1.2 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;opacity:0;transition:opacity .6s'; root.appendChild(label);
    stage.appendChild(root); root.tabIndex = -1; root.style.outline = 'none'; setTimeout(function () { try { if (!document.activeElement || document.activeElement === document.body || document.activeElement.tagName === 'BUTTON') root.focus({ preventScroll: true }); } catch (e) {} }, 60);
    var DPR = Math.min(2, devicePixelRatio || 1);
    function size() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; c.setTransform(DPR, 0, 0, DPR, 0, 0); }
    size();

    // ---------- particles ----------
    var parts = [], MAXP = TOUCH ? 2500 : 6000, glyphCv = document.createElement('canvas'), gc = glyphCv.getContext('2d', { willReadFrequently: true });
    function sampleLetter(L, step) {
      var r = L.el.getBoundingClientRect(); if (r.width < 1) return [];
      var cs = getComputedStyle(L.el), fs = parseFloat(cs.fontSize), w = Math.ceil(r.width + fs * .4), h = Math.ceil(fs * 1.4); glyphCv.width = w; glyphCv.height = h;
      gc.clearRect(0, 0, w, h); gc.fillStyle = '#fff'; gc.textBaseline = 'middle'; gc.textAlign = 'center'; gc.font = Math.round(L.wght) + ' ' + fs + 'px ' + FONT; gc.fillText(L.ch, w / 2, h / 2);
      var d = gc.getImageData(0, 0, w, h).data, out = [], cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      step = step || Math.max(2, Math.round(fs / 34));
      for (var y = 0; y < h; y += step) for (var x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] > 120) out.push([cx + x - w / 2, cy + y - h / 2]);
      return out;
    }
    function emit(L, mode, word) { // mode: 'explode' | 'fall' | 'dust' | 'dissolve'
      var pts = sampleLetter(L, mode === 'dust' ? 0 : 0); if (mode === 'dust') pts = pts.filter(function () { return Math.random() < .05; });
      var col = PALS[palKey].ink;
      pts.forEach(function (p) {
        if (parts.length > MAXP) parts.shift();
        var a = Math.random() * Math.PI * 2, sp = mode === 'explode' ? 80 + Math.random() * 420 : mode === 'dissolve' ? 20 + Math.random() * 120 : mode === 'dust' ? 6 + Math.random() * 20 : 10 + Math.random() * 60;
        parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (mode === 'dust' ? 20 : 0), g: mode === 'fall' ? 700 : mode === 'dust' ? -12 : mode === 'dissolve' ? -30 : 0, life: 1, decay: mode === 'explode' ? .9 + Math.random() * .6 : mode === 'dust' ? .25 + Math.random() * .3 : .5 + Math.random() * .5, s: mode === 'dust' ? 1.2 : 1.6 + Math.random(), col: mode === 'explode' && word ? (Math.random() < .25 ? RELS[word.rel].color : col) : col, drag: mode === 'explode' ? 2.2 : .4 });
      });
    }
    function stepParts(dt) {
      c.clearRect(0, 0, W, H); if (!parts.length) return;
      var byCol = {};
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
        if (p.life <= 0 || p.y > H + 20) { parts.splice(i, 1); continue; }
        (byCol[p.col] = byCol[p.col] || []).push(p);
      }
      for (var col in byCol) { c.fillStyle = col; var arr = byCol[col]; for (var j = 0; j < arr.length; j++) { var q = arr[j]; c.globalAlpha = Math.min(1, q.life * 1.3); c.fillRect(q.x, q.y, q.s, q.s); } }
      c.globalAlpha = 1;
    }

    // ---------- words ----------
    var tilt = { x: 0, y: 0, on: false }, removed = [], selected = null, sentenceOn = null, quakeT = 0, words = [], cur = null, nextId = 1, freeze = 1, freezeUntil = 0, unrelUntil = 0, pointer = { x: -9999, y: -9999, active: false }, lastInput = performance.now(), hushed = false;
    function makeFilter(id) {
      var f = document.createElementNS(svgNS, 'filter'); f.id = 'ua-f' + id; f.setAttribute('x', '-20%'); f.setAttribute('y', '-40%'); f.setAttribute('width', '140%'); f.setAttribute('height', '180%');
      var t = document.createElementNS(svgNS, 'feTurbulence'); t.setAttribute('type', 'fractalNoise'); t.setAttribute('baseFrequency', '0.02 0.4'); t.setAttribute('numOctaves', '1'); t.setAttribute('seed', String(id));
      var d = document.createElementNS(svgNS, 'feDisplacementMap'); d.setAttribute('in', 'SourceGraphic'); d.setAttribute('scale', '0'); d.setAttribute('xChannelSelector', 'R'); d.setAttribute('yChannelSelector', 'G');
      f.appendChild(t); f.appendChild(d); fsvg.appendChild(f); return { f: f, t: t, d: d };
    }
    function bigSize(text) { var n = Math.max(2, text.length); return clamp(Math.min(W * .86 / (n * .62), H * .3), 28, 240); }
    function newWord(text, x, y, sizePx, opts) {
      opts = opts || {}; var cl = classify(text), w = { id: nextId++, text: text.toUpperCase(), rel: cl.rel, pol: cl.pol, known: cl.known, negated: cl.negated, x: x, y: y, size: sizePx, attn: 0, peakAttn: 0, gone: 0, weight: 0, born: performance.now(), letters: [], rng: mulberry(hash(text) || 1), scrambleT: 0, gather: 0, held: 0, kept: !!opts.kept, g: { x: 0, y: 0, s: 1, o: 0 }, scaleK: 1, rot: 0, stretch: 1, vx: 0, vy: 0, lx: 0, ly: 0 };
      w.el = document.createElement('div'); w.el.style.cssText = 'position:absolute;left:0;top:0;display:flex;align-items:center;white-space:nowrap;line-height:1;will-change:transform;font-family:' + FONT;
      w.el.setAttribute('role', 'img'); w.el.setAttribute('aria-label', w.text);
      w.flt = makeFilter(w.id); wordsEl.appendChild(w.el);
      for (var i = 0; i < w.text.length; i++) addLetter(w, w.text[i], i, opts.instant);
      w.voice = snd ? snd.voice(w.rel, w.pol, hash(w.text) % 97, w.text) : null;
      Tw.to(w.g, { o: 1, duration: w.rel === 'tempo' && w.pol > 0 ? 2.4 : .6, ease: 'power2.out' });
      words.push(w); return w;
    }
    function addLetter(w, ch, i, instant) {
      var s = document.createElement('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true'); s.style.cssText = 'display:inline-block;will-change:transform;transform-origin:50% 60%';
      var L = { el: s, ch: ch, g: { x: 0, y: instant ? 0 : w.size * .35, r: 0, s: 1, o: instant ? 1 : 0, sx: 1 }, wght: 500, wdth: 100, slnt: 0, ox: 0, oy: 0, jx: 0, jy: 0, jr: 0, nextHop: 0, fade: 0, cx: 0, cy: 0, sub: null, home: 0 };
      if (i >= w.letters.length) { w.el.appendChild(s); w.letters.push(L); } else { w.el.insertBefore(s, w.letters[i].el); w.letters.splice(i, 0, L); }
      if (!instant) { var slow = w.rel === 'tempo' && w.pol > 0; Tw.to(L.g, { y: 0, o: 1, duration: slow ? 1.6 : .55, delay: (slow ? .5 : .04) * i, ease: slow ? 'power3.inOut' : 'back.out(2)' }); }
      return L;
    }
    function reclassify(w) {
      var cl = w.override ? { rel: w.override.rel, pol: w.override.pol, known: true } : classify(w.text), changed = cl.rel !== w.rel || cl.pol !== w.pol; w.known = cl.known; w.negated = cl.negated; w.el.setAttribute('aria-label', w.text);
      if (changed) { w.rel = cl.rel; w.pol = cl.pol; VS(w, 'stop'); w.voice = snd ? snd.voice(w.rel, w.pol, hash(w.text) % 97, w.text) : null; w.gone = 0; w.weight = 0; resetLetters(w); }
      return changed;
    }
    function resetLetters(w) { w.letters.forEach(function (L) { L.sub = null; L.el.textContent = L.ch; L.fade = 0; Tw.to(L.g, { x: 0, y: 0, r: 0, s: 1, duration: .5, ease: 'power2.out' }); }); w.letters.forEach(function (L, i) { L.home = i; }); }
    function removeWord(w, how) {
      var i = words.indexOf(w); if (i < 0) return; words.splice(i, 1); if (cur === w) cur = null; if (selected === w) selected = null;
      if (how !== 'silent' || w.goneDone) { removed.push({ text: w.text, x: w.x, y: w.y, size: w.size }); if (removed.length > 12) removed.shift(); }
      if (how !== 'silent') w.letters.forEach(function (L) { if (L.g.o > .1) emit(L, how || 'dissolve', w); });
      VS(w, 'stop'); w.el.remove(); w.flt.f.remove();
    }
    function measure() { words.forEach(function (w) { w.letters.forEach(function (L) { var r = L.el.getBoundingClientRect(); L.cx = r.left + r.width / 2 - L.ox; L.cy = r.top + r.height / 2 - L.oy; L.w = r.width; }); var r2 = w.el.getBoundingClientRect(); w.rect = r2; }); }

    // slots for words that have been set aside
    var SLOTS = [[.2, .2], [.78, .22], [.22, .8], [.8, .8], [.5, .14], [.5, .88], [.12, .5], [.88, .5]];
    function freeSlot() {
      var best = 0, bd = -1; SLOTS.forEach(function (s, i) { var d = 1e9; words.forEach(function (w) { if (w === cur) return; d = Math.min(d, Math.hypot(w.x / W - s[0], w.y / H - s[1])); }); if (d > bd) { bd = d; best = i; } });
      return SLOTS[best];
    }
    function setAside(w) {
      if (!w) return; var s = freeSlot(); w.typing = false; Tw.to(w, { x: s[0] * W, y: s[1] * H, size: clamp(w.size * .4, 22, 72), duration: 1.1, ease: 'power3.inOut' });
      if (words.length > (W < 600 ? 4 : 6)) { var old = words.filter(function (o) { return o !== w && o !== cur; })[0]; if (old) removeWord(old); }
    }
    function checkPair(w) {
      var other = words.filter(function (o) { return o !== w && o.rel === w.rel && o.pol === -w.pol; })[0]; if (!other) return;
      var ax = w.x, ay = w.y, as = w.size; Tw.to(w, { x: other.x, y: other.y, size: other.size, duration: 1.4, ease: 'power3.inOut' }); Tw.to(other, { x: ax, y: ay, size: as, duration: 1.4, ease: 'power3.inOut' });
      S('pair'); find('pair');
    }
    function placeWord(text, opts) {
      opts = opts || {}; if (cur) setAside(cur);
      var w = newWord(text, W / 2, H / 2, bigSize(text), opts); cur = w; afterNew(w, opts); return w;
    }
    function afterNew(w, opts) {
      var cap = W < 600 ? 5 : 7; while (words.length > cap) { var old = words.filter(function (o) { return o !== w && o !== cur && !o.held2; })[0]; if (!old) break; removeWord(old); }
      if (!w.known && w.text.length > 1) find('unknown'); if (w.pol < 0 && w.known) find('opposite'); if (w.negated) find('negate');
      if (opts.typed) find('yours');
      if (w.text.length >= 3 && w.text === w.text.split('').reverse().join('')) { w.palin = true; resetLetters(w); S('palindrome'); find('palindrome'); }
      if (opts.typed) {
        var twin = words.filter(function (o) { return o !== w && o.text === w.text && !o.ghostOf; })[0];
        if (twin) { w.ghostOf = twin; S('echo'); find('echo'); }
        else { var key = w.text.split('').sort().join(''), ana = words.filter(function (o) { return o !== w && o.text !== w.text && o.text.length === w.text.length && o.text.split('').sort().join('') === key; })[0]; if (ana) setTimeout(function () { if (words.indexOf(ana) >= 0) rearrange(ana, w.text); }, 700); }
      }
      if (w.text === 'RELIABLE' || w.text === 'RELIABILITY' || w.text === 'TRUST') reliable();
      if (w.text === 'UNRELIABLE') unreliable();
      if (w.rel === 'vanish' && w.pol < 0 && opts.typed && kept.indexOf(w.text) < 0) { kept.push(w.text); if (kept.length > 3) kept.shift(); persist(); }
      setTimeout(function () { if (words.indexOf(w) >= 0) checkPair(w); }, 1300);
      showLabel(w);
    }
    function reliable() { freeze = 0; freezeUntil = performance.now() + 2600; S('reliable'); api.whisper('reliable'); setTimeout(function () { if (ac.signal.aborted) return; unrelUntil = performance.now() + 4500; S('unreliable'); find('reliable'); }, 2600); }
    function unreliable() { unrelUntil = performance.now() + 6000; S('unreliable'); words.forEach(function (w) { w.letters.forEach(function (L) { Tw.to(L.g, { r: (Math.random() - .5) * 60, duration: .3 }); }); }); find('reliable'); }

    // ---------- the label: what the word does, once the viewer is involved ----------
    var involved = false, labelFor = null;
    function showLabel(w) { labelFor = w; }
    function relText(w) { var R = RELS[w.rel]; return w.text + (w.asking ? '?' : '') + ' \u2014 ' + (w.palin ? 'cannot be moved' : (w.pol > 0 ? R.pos : R.neg)) + (w.override ? ' (borrowed)' : w.known ? '' : ' (unlisted)') + (w.ghostOf ? ' (again)' : '') + ' \u00b7 ' + Math.round(effI(w) * 100) + '%'; }
    function effI(w) { if (w.palin) return 0; return clamp(inst + w.attn * .65 + (w.shout ? .3 : 0), 0, 1.6) * freeze * (performance.now() < unrelUntil ? 2 : 1); }

    // ---------- per-frame behaviour ----------
    var frame = 0, lastT = performance.now(), raf = 0, sndTick = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop); var dt = Math.min(.05, (now - lastT) / 1000); lastT = now; frame++; if (Tw.tick) Tw.tick(now);
      if (freeze < 1 && now > freezeUntil) freeze = Math.min(1, freeze + dt * 2);
      if (frame % 4 === 1) measure();
      var pal = PALS[palKey], idle = now - lastInput;
      // hush: when nothing is touched for a while and something is meant to be silent, everything is
      var wantHush = idle > 9000 && words.some(function (w) { return w.rel === 'noise' && w.pol > 0; }) && words.every(function (w) { return w.attn < .05; });
      if (wantHush !== hushed) { hushed = wantHush; S('hush', hushed); if (hushed) find('quiet'); }
      words.forEach(function (w) { stepWord(w, dt, now, pal); });
      stepParts(dt);
      if (now - sndTick > 50) { sndTick = now; words.forEach(function (w) { if (hushed) return; VS(w, 'update', effI(w), w.attn, w.x / W, w.y / H, { gone: w.gone, scale: w.scaleK, held: w.gather, weight: w.weight }); VS(w, 'tick'); }); }
      // label
      if (labels && involved && labelFor && words.indexOf(labelFor) >= 0 && labelFor.rect) {
        var r = labelFor.rect; label.textContent = relText(labelFor); label.style.color = RELS[labelFor.rel].color; label.style.opacity = labelFor === cur ? '.9' : '.6';
        var lx = clamp(labelFor.x - label.offsetWidth / 2, 12, W - label.offsetWidth - 12), ly = clamp(r.bottom + 14, 70, H - 30); label.style.transform = 'translate(' + lx + 'px,' + ly + 'px)';
      } else label.style.opacity = '0';
    }
    function stepWord(w, dt, now, pal) {
      var I = effI(w), R = w.rel, P = w.pol, t = now / 1000, n = w.letters.length, rng = Math.random;
      // attention: the pointer near a word is reading it
      var near = w.rect && pointer.active && pointer.x > w.rect.left - 30 && pointer.x < w.rect.right + 30 && pointer.y > w.rect.top - 30 && pointer.y < w.rect.bottom + 30;
      w.attn = clamp(w.attn + (near ? dt * (w.stare ? .9 : .3) : -dt * .18), 0, 1);
      if (w.attn > .6) find('attention'); if (w.attn > w.peakAttn) w.peakAttn = w.attn; if (w.peakAttn > .6 && w.attn < .08) { find('settle'); w.peakAttn = 0; }
      w.gather = Math.max(0, w.gather - dt * .35);
      var fsz = w.size, base = { wght: 500, wdth: 100, slnt: 0 }, wordFilter = 0, letterSpacing = 0;
      // the word as a whole
      if (R === 'scale') { var target = P > 0 ? clamp(1 - .85 * I * (near ? 1.3 : 1), .12, 1) : clamp(1 + 1.6 * I + w.attn * .8, 1, 3.2); target = Math.min(target, W * 1.25 / (Math.max(2, n) * .6) / w.size); w.scaleK = lerp(w.scaleK, target, dt * 1.5); fsz = w.size * w.scaleK; base.wdth = P > 0 ? lerp(100, 25, clamp(I, 0, 1)) : lerp(100, 151, clamp(I, 0, 1)); base.wght = P > 0 ? 400 : lerp(600, 1000, clamp(I, 0, 1)); }
      if (R === 'vanish') {
        if (P > 0) { w.gone = clamp(w.gone + dt * .012 * (I + .1) * (1 + w.attn * 4), 0, 1); base.wght = lerp(500, 100, w.gone); if (frame % 6 === 0 && w.gone > .05 && w.gone < 1) { var Ld = w.letters[Math.floor(rng() * n)]; if (Ld.g.o > .2) emit(Ld, 'dust', w); } if (w.gone >= 1 && !w.goneDone) { w.goneDone = true; S('gone'); find('gone'); setTimeout(function () { removeWord(w, 'silent'); }, 600); } }
        else { w.weight = clamp(w.weight + dt * .02 * (.4 + I), 0, 1); base.wght = lerp(500, 1000, w.weight); base.wdth = lerp(100, 120, w.weight); }
      }
      if (R === 'noise' && P > 0) wordFilter = (I > .3 ? (I - .3) * 30 : 0) + w.attn * 30 + (rng() < I * .04 ? 40 : 0);
      if (R === 'noise' && P < 0) { base.wght = 120; letterSpacing = -.02; }
      if (R === 'order' && P < 0) { base.wdth = 100; base.wght = 400; }
      if (R === 'tremor' && P < 0) { base.wght = 900; base.wdth = 112; }
      w.flt.d.setAttribute('scale', wordFilter.toFixed(1)); w.el.style.filter = wordFilter > .5 ? 'url(#ua-f' + w.id + ')' : 'none';
      w.el.style.fontSize = fsz.toFixed(1) + 'px'; w.el.style.color = pal.ink; if (w.ghostOf) w.g.o = Math.min(w.g.o, .35); if (w.palin) { base.wght = 600; base.wdth = 100; }
      if (w.vx || w.vy) stepThrown(w, dt);
      if (w.ghostOf) { var gO = w.ghostOf; if (words.indexOf(gO) < 0) { w.ghostOf = null; } else { w.x = lerp(w.x, gO.x + gO.size * .18, dt * 1.5); w.y = lerp(w.y, gO.y + gO.size * .22, dt * 1.5); w.size = lerp(w.size, gO.size * .9, dt); } }
      if (w !== cur && w.rect && w.rect.width < W - 24 && !w.vx && !w.held2) { var hw = w.rect.width / 2 + 12; w.x = lerp(w.x, clamp(w.x, hw, W - hw), dt * 3); }
      w.lx = lerp(w.lx || 0, tilt.x * 70, dt * 2); w.ly = lerp(w.ly || 0, tilt.y * 50, dt * 2);
      if (w.stretch && w.stretch !== 1) { letterSpacing += (w.stretch - 1) * .35; base.wdth = clamp(base.wdth * w.stretch, 25, 151); }
      w.el.style.letterSpacing = letterSpacing.toFixed(3) + 'em';
      w.el.style.transform = 'translate(' + (w.x + w.g.x + w.lx).toFixed(1) + 'px,' + (w.y + w.g.y + w.ly).toFixed(1) + 'px) translate(-50%,-50%) rotate(' + ((w.rot || 0) * 57.3).toFixed(1) + 'deg)'; w.el.style.opacity = w.g.o.toFixed(3);
      // scramble: letters trade places
      if (R === 'order' && P > 0 && n > 1) {
        w.scrambleT -= dt * (I * 3 + w.attn * 4) * freeze; if (w.scrambleT < 0) { w.scrambleT = 1; var a = Math.floor(rng() * n), b = Math.floor(rng() * n); if (a !== b && w.letters[a].w) { var La = w.letters[a], Lb = w.letters[b], dx = Lb.cx - La.cx; Tw.to(La.g, { x: La.g.x + dx, duration: .35, ease: 'power3.inOut' }); Tw.to(Lb.g, { x: Lb.g.x - dx, duration: .35, ease: 'power3.inOut' }); } }
        if (rng() < I * .02 * freeze) { var Ls = w.letters[Math.floor(rng() * n)], SUB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#&?\u00c6\u00d8\u0152'; Ls.sub = SUB[Math.floor(rng() * SUB.length)]; Ls.el.textContent = Ls.sub; Ls.subT = now + 400 + rng() * 900; }
      }
      // each letter
      for (var i = 0; i < n; i++) {
        var L = w.letters[i], bx = 0, by = 0, br = 0, bs = 1, wght = base.wght, wdth = base.wdth, slnt = 0, op = 1;
        var pd = Math.hypot(pointer.x - L.cx, pointer.y - L.cy), prox = pointer.active ? clamp(1 - pd / (fsz * 1.6), 0, 1) : 0;
        if (L.sub && now > L.subT) { L.sub = null; L.el.textContent = L.ch; }
        if (R === 'tremor') {
          if (P > 0) { var A = fsz * .05 * Math.pow(I, 1.4) * (1 + prox * 2.5) * freeze; bx = (rng() - .5) * A; by = (rng() - .5) * A; br = (rng() - .5) * A * .6; wght = 500 + (rng() - .5) * 500 * I * freeze; slnt = -10 * clamp(I, 0, 1) * Math.abs(Math.sin(t * .7 + i)); }
          else { bx = 0; by = 0; }
        } else if (R === 'noise' && P > 0) {
          if (rng() < (I - .25) * .012 * freeze + prox * .01 && L.g.o > .9 && !L.blown) { L.blown = true; emit(L, 'explode', w); VS(w, 'burst', clamp(I, .2, 1)); L.g.o = 0; Tw.to(L.g, { o: 1, duration: 1.4, delay: .5 + rng(), ease: 'power2.in', onComplete: (function (LL) { return function () { LL.blown = false; }; })(L) }); }
          by = Math.sin(t * 40 + i) * I * 2 * freeze; wght = 400 + I * 400;
        } else if (R === 'noise' && P < 0) { op = .55; }
        else if (R === 'vanish' && P > 0) { var order = (hash(w.text + i) % 1000) / 1000, k = clamp((w.gone * 1.4 - order * .4), 0, 1); op = 1 - k; by = -k * fsz * .1; }
        else if (R === 'unity') {
          if (P > 0) { var spread = clamp(I, 0, 1.4) * (1 - w.gather) * freeze, dir = i - (n - 1) / 2, ang = (hash(w.text + i) % 628) / 100; bx = dir * fsz * .35 * spread + Math.cos(ang + t * .2) * fsz * .5 * spread * spread; by = Math.sin(ang + t * .25) * fsz * .45 * spread * spread; if (prox > 0) { bx += (L.cx - pointer.x) / (pd + 1) * prox * fsz * .8; by += (L.cy - pointer.y) / (pd + 1) * prox * fsz * .8; } br = Math.sin(ang + t * .3) * 20 * spread; }
          else { var dir2 = i - (n - 1) / 2; bx = -dir2 * fsz * .32 * clamp(I, 0, 1); br = dir2 * 2 * I; op = .85; }
        } else if (R === 'tempo') {
          if (P > 0) { var lagT = t - i * .6 * (1 + I); by = Math.sin(lagT * .5) * fsz * .06 * I; br = Math.sin(lagT * .4) * 3 * I; wdth = lerp(100, 140, clamp(I, 0, 1)); slnt = 0; }
          else { if (now > L.nextHop) { L.nextHop = now + 40 + rng() * 120 / (1 + I); L.jx = (rng() - .5) * fsz * .08 * I * freeze; L.jy = (rng() - .5) * fsz * .14 * I * freeze; L.jr = (rng() - .5) * 18 * I * freeze; } bx = L.jx; by = L.jy; br = L.jr; wdth = lerp(100, 60, clamp(I, 0, 1)); }
        } else if (R === 'order') {
          if (P > 0) { br = (Math.round(Math.sin(i * 7.1 + Math.floor(t * I)) * 1.4) * 90 * clamp(I - .5, 0, 1)) * freeze; by = Math.sin(i * 3.3 + t * I) * fsz * .08 * I * freeze; if (prox > .3) br += (rng() - .5) * 40 * prox; }
          else { wdth = 100; }
        }
        if (performance.now() < unrelUntil && R !== 'tremor') { bx += (rng() - .5) * fsz * .06; by += (rng() - .5) * fsz * .06; }
        if (w.palin) { bx = 0; by = 0; br = 0; }
        L.ox = L.g.x + bx; L.oy = L.g.y + by;
        L.el.style.transform = 'translate(' + L.ox.toFixed(1) + 'px,' + L.oy.toFixed(1) + 'px) rotate(' + (L.g.r + br).toFixed(1) + 'deg) scale(' + (L.g.s * bs * L.g.sx).toFixed(3) + ',' + (L.g.s * bs / Math.sqrt(L.g.sx)).toFixed(3) + ')';
        if (tilt.on) slnt = clamp(slnt - Math.abs(tilt.x) * 10, -10, 0);
        L.el.style.fontVariationSettings = '"wght" ' + Math.round(clamp(wght, 100, 1000)) + ', "wdth" ' + Math.round(clamp(wdth, 25, 151)) + ', "slnt" ' + slnt.toFixed(1) + ', "opsz" ' + Math.round(clamp(fsz, 8, 144));
        L.el.style.fontWeight = Math.round(clamp(wght, 100, 900)); L.el.style.opacity = (op * L.g.o).toFixed(3); L.wght = wght;
      }
    }

    // ---------- input: typing ----------
    var typeT = 0;
    function typeChar(ch) {
      involved = true; lastInput = performance.now();
      if (!cur || !cur.typing) { var w = placeWord(ch, { typed: true }); w.typing = true; S('key', ch); return; }
      if (cur.text.length >= 14) return;
      cur.text += ch; addLetter(cur, ch, cur.letters.length); cur.size = bigSize(cur.text); S('key', ch);
      if (reclassify(cur)) { /* the word became something else */ }
      clearTimeout(typeT); typeT = setTimeout(commitTyping, 2600);
    }
    function backspace() {
      lastInput = performance.now(); if (!cur) return;
      if (cur.typing && cur.text.length > 1) { cur.text = cur.text.slice(0, -1); var L = cur.letters.pop(); emit(L, 'dissolve', cur); L.el.remove(); cur.size = bigSize(cur.text); reclassify(cur); S('erase'); }
      else { removeWord(cur, 'dissolve'); S('erase'); var last = words[words.length - 1]; if (last) { cur = last; Tw.to(last, { x: W / 2, y: H / 2, size: bigSize(last.text), duration: .9, ease: 'power3.inOut' }); showLabel(last); } }
    }
    function commitTyping() { clearTimeout(typeT); if (!cur || !cur.typing) return; cur.typing = false; afterNew(cur, { typed: true }); }
    input.addEventListener('input', function () { var v = input.value.toUpperCase().replace(/[^A-Z]/g, ''); input.value = ''; for (var i = 0; i < v.length; i++) typeChar(v[i]); }, sig);
    addEventListener('keydown', function (e) {
      var tg = e.target, onBtn = tg && tg.tagName === 'BUTTON'; if (tg && (tg.tagName === 'TEXTAREA' || (tg.tagName === 'INPUT' && tg !== input))) return; if (panelOpen && panel && panel.contains(tg)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoRemove(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return; var k = e.key; if (onBtn && (k === 'Enter' || k === ' ')) return;
      var sel = selected && words.indexOf(selected) >= 0 ? selected : cur;
      if (/^[0-9]$/.test(k)) { e.preventDefault(); setInst(+k / 9); return; }
      if (k === 'Tab') { e.preventDefault(); if (!words.length) return; var si = (words.indexOf(sel) + (e.shiftKey ? words.length - 1 : 1)) % words.length; selected = words[si]; showLabel(selected); involved = true; S('select', selected.x / W); return; }
      if (e.shiftKey && /^Arrow/.test(k) && sel) { e.preventDefault(); var st = 40; sel.x = clamp(sel.x + (k === 'ArrowRight' ? st : k === 'ArrowLeft' ? -st : 0), 20, W - 20); sel.y = clamp(sel.y + (k === 'ArrowDown' ? st : k === 'ArrowUp' ? -st : 0), 60, H - 20); return; }
      if (k === 'Delete' && sel) { e.preventDefault(); removeWord(sel, 'dissolve'); S('erase'); return; }
      if (k === '/' ) { e.preventDefault(); reverseWord(sel); return; }
      if (k === '?') { e.preventDefault(); ask(sel); return; }
      if (k === '.') { e.preventDefault(); sentence(); return; }
      if (k === '!') { e.preventDefault(); quake(); return; }
      if (k === '*') { e.preventDefault(); if (sel) say(sel.text, null, sel); return; }
      if (k === ',') { e.preventDefault(); shuffleAll(); return; }
      if (k === 'Escape') { selected = null; commitTyping(); return; }
      if (/^[a-zA-Z]$/.test(k) && e.shiftKey && e.target !== input) { e.preventDefault(); typeChar(k.toUpperCase()); if (cur && !cur.shout) { cur.shout = true; cur.size *= 1.18; S('shout'); find('shout'); } return; }
      if (/^[a-zA-Z]$/.test(k) && e.target !== input) { e.preventDefault(); typeChar(k.toUpperCase()); }
      else if (k === 'Backspace') { e.preventDefault(); backspace(); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); commitTyping(); if (cur) cur.typing = false; }
      else if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); cycle(k === 'ArrowRight' ? 1 : -1); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); setInst(inst + (k === 'ArrowUp' ? .05 : -.05)); }
    }, sig);
    var curatedI = 0;
    function cycle(d) {
      involved = true; lastInput = performance.now(); curatedI = (curatedI + d + CURATED.length) % CURATED.length; var t = CURATED[curatedI];
      if (cur) { removeWord(cur, 'dissolve'); }
      var w = newWord(t, W / 2, H / 2, bigSize(t)); cur = w; afterNew(w, {});
    }
    function setInst(v, quiet) { inst = clamp(Math.round(v * 100) / 100, 0, 1); persist(); if (!quiet) api.whisper('instability ' + Math.round(inst * 100) + '%'); syncPanel(); }

    // ---------- input: pointer ----------
    var drag = null, downAt = null, dragEnd = 0, touchN = 0, mTarget = null, mStarted = false, lastTapW = { w: null, t: 0 }, holdT2 = 0, scrib = [];
    function letterAt(x, y) {
      for (var i = words.length - 1; i >= 0; i--) { var w = words[i]; for (var j = 0; j < w.letters.length; j++) { var L = w.letters[j], r = L.el.getBoundingClientRect(); if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top && y <= r.bottom) return { w: w, L: L, i: j }; } }
      return null;
    }
    function wordAt(x, y) { for (var i = words.length - 1; i >= 0; i--) { var r = words[i].rect; if (r && x > r.left - 20 && x < r.right + 20 && y > r.top - 20 && y < r.bottom + 20) return words[i]; } return null; }
    root.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; if (e.pointerType === 'mouse') lastInput = performance.now();
      if (!drag) {
        if (e.pointerType === 'mouse') { var hit = wordAt(e.clientX, e.clientY); if (hit) { involved = true; showLabel(hit); }
          // a frantic scribble with the mouse shakes the page
          var nw = performance.now(); scrib.push([e.clientX, nw]); scrib = scrib.filter(function (q) { return nw - q[1] < 700; }); var rv = 0, ld = 0; for (var si = 1; si < scrib.length; si++) { var dd = scrib[si][0] - scrib[si - 1][0]; if (Math.abs(dd) > 6) { var sg = dd > 0 ? 1 : -1; if (ld && sg !== ld) rv++; ld = sg; } } if (rv >= 7) { scrib = []; quake(); } }
        return;
      }
      var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0, d = Math.hypot(dx, dy), w = drag.w, L = drag.L; lastInput = performance.now();
      drag.hist.push([e.clientX, e.clientY, performance.now()]); if (drag.hist.length > 6) drag.hist.shift();
      if (drag.wordMode) { w.x = drag.wx + dx; w.y = drag.wy + dy; w.held2 = true; return; }
      if (w.rel === 'tremor' && w.pol < 0) { L.g.x = dx * .04; L.g.y = dy * .04; if (d > 40 && !drag.refused) { drag.refused = true; api.whisper('it won\u2019t move'); } return; } // SHAKE refuses
      L.g.x = dx; L.g.y = dy; L.g.sx = 1 + Math.min(1.6, d / (w.size * 1.4)); L.g.r = Math.atan2(dy, dx) * 180 / Math.PI * .15; VS(w, 'drag', Math.min(1, d / 200));
      if (d > Math.max(140, w.size * 1.8)) {
        if (performance.now() - drag.t0 < 300 && !(w.rel === 'tremor' && w.pol < 0)) { var h0 = drag.hist[0], h1 = drag.hist[drag.hist.length - 1], dtv = Math.max(16, h1[2] - h0[2]); Tw.to(L.g, { x: 0, y: 0, sx: 1, r: 0, duration: .8, ease: 'elastic.out(1, 0.35)' }); drag = null; dragEnd = performance.now() + 300; throwWord(w, (h1[0] - h0[0]) / dtv * 1000, (h1[1] - h0[1]) / dtv * 1000); }
        else tear(w, L);
      }
    }, sig);
    root.addEventListener('pointerdown', function (e) {
      lastInput = performance.now(); involved = true; pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; if (document.activeElement !== input) try { root.focus({ preventScroll: true }); } catch (er) {}
      if (e.pointerType === 'touch') { touchN++; if (touchN > 1) { if (drag) { Tw.to(drag.L.g, { x: 0, y: 0, sx: 1, r: 0, duration: .6, ease: 'elastic.out(1, 0.35)' }); drag = null; dragEnd = performance.now(); } downAt = null; return; } }
      var h = letterAt(e.clientX, e.clientY); downAt = { x: e.clientX, y: e.clientY, t: performance.now(), hit: h };
      if (h) {
        drag = { w: h.w, L: h.L, x0: e.clientX, y0: e.clientY, t0: performance.now(), hist: [[e.clientX, e.clientY, performance.now()]], wordMode: e.shiftKey || e.altKey, wx: h.w.x, wy: h.w.y }; Tw.kill(h.L.g); try { root.setPointerCapture(e.pointerId); } catch (er) {} showLabel(h.w); selected = h.w;
        clearTimeout(holdT2); holdT2 = setTimeout(function () { if (drag && Math.hypot(pointer.x - drag.x0, pointer.y - drag.y0) < 10 && !(drag.w.rel === 'tremor' && drag.w.pol < 0)) { drag.wordMode = true; Tw.to(drag.L.g, { x: 0, y: 0, sx: 1, r: 0, duration: .3 }); drag.w.held2 = true; Tw.to(drag.w.g, { s: 1.06, duration: .2 }); S('pick'); } }, 420);
      }
    }, sig);
    function release(e) {
      if (e.pointerType === 'touch') touchN = Math.max(0, touchN - 1);
      if (e.pointerType !== 'mouse') pointer.active = false;
      var d0 = downAt; downAt = null;
      if (drag) {
        var dr = drag, w = drag.w, L = drag.L, moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0); drag = null; dragEnd = performance.now(); clearTimeout(holdT2);
        Tw.to(L.g, { x: 0, y: 0, sx: 1, r: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)' }); Tw.to(w.g, { s: 1, duration: .3 });
        var h0 = dr.hist[0], h1 = dr.hist[dr.hist.length - 1], dtv = Math.max(16, h1[2] - h0[2]), fvx = (h1[0] - h0[0]) / dtv * 1000, fvy = (h1[1] - h0[1]) / dtv * 1000, fsp = Math.hypot(fvx, fvy);
        if (fsp > 900 && (dr.wordMode || performance.now() - dr.t0 < 260) && !(w.rel === 'tremor' && w.pol < 0)) { w.held2 = false; throwWord(w, fvx, fvy); return; }
        if (dr.wordMode) { w.held2 = false; var tgt = words.filter(function (o) { return o !== w && o.rect && w.x > o.rect.left && w.x < o.rect.right && w.y > o.rect.top - 10 && w.y < o.rect.bottom + 10; })[0]; if (tgt) swapMeanings(w, tgt); return; }
        if (moved < 8) { var nowT = performance.now(); if (lastTapW.w === w && nowT - lastTapW.t < 340) { lastTapW.w = null; say(w.text, null, w); } else { lastTapW = { w: w, t: nowT }; touchLetter(w, L); } }
        return;
      }
      if (d0 && !d0.hit && performance.now() - d0.t < 300 && Math.hypot(e.clientX - d0.x, e.clientY - d0.y) < 10 && !TOUCH) { /* click on empty space: nothing, just attention */ }
    }
    root.addEventListener('pointerup', release, sig); root.addEventListener('pointercancel', release, sig);
    root.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') pointer.active = false; }, sig);
    root.addEventListener('wheel', function (e) { e.preventDefault(); setInst(inst - Math.sign(e.deltaY) * .03); }, { passive: false, signal: ac.signal });
    function touchLetter(w, L) {
      w.attn = clamp(w.attn + .22, 0, 1); VS(w, 'touch', w.letters.indexOf(L), L.ch); showLabel(w);
      if (w.rel === 'unity' && w.pol > 0) { w.gather = 1; VS(w, 'gather'); }
      else if (w.rel === 'noise' && w.pol > 0 && !L.blown) { L.blown = true; emit(L, 'explode', w); L.g.o = 0; Tw.to(L.g, { o: 1, duration: 1.2, delay: .6, ease: 'power2.in', onComplete: function () { L.blown = false; } }); }
      else if (w.rel === 'scale') { Tw.to(L.g, { s: w.pol > 0 ? .6 : 1.5, duration: .15, ease: 'power2.out', onComplete: function () { Tw.to(L.g, { s: 1, duration: .8, ease: 'elastic.out(1, 0.3)' }); } }); }
      else { Tw.to(L.g, { y: -w.size * .12, duration: .12, ease: 'power2.out', onComplete: function () { Tw.to(L.g, { y: 0, duration: .9, ease: 'elastic.out(1, 0.3)' }); } }); }
      if (w.rel === 'vanish' && w.pol > 0) w.gone = clamp(w.gone + .04, 0, 1);
    }
    function tear(w, L) {
      var i = w.letters.indexOf(L); if (i < 0) return; drag = null; dragEnd = performance.now() + 400;
      emit(L, 'fall', w); S('tear'); find('tear');
      // FLIP: remember where the others were so the gap closes smoothly
      var before = w.letters.map(function (o) { return o.el.getBoundingClientRect().left; });
      w.letters.splice(i, 1); L.el.remove(); w.text = w.text.slice(0, i) + w.text.slice(i + 1);
      if (!w.text.length) { removeWord(w, 'silent'); return; }
      w.letters.forEach(function (o, j) { var bi = j < i ? j : j + 1, after = o.el.getBoundingClientRect().left; o.g.x += before[bi] - after; Tw.to(o.g, { x: 0, duration: .6, ease: 'power3.out' }); });
      var oldRel = w.rel, oldPol = w.pol; reclassify(w); w.size = w === cur ? bigSize(w.text) : w.size;
      if (LEX[w.text] && (w.rel !== oldRel || w.pol !== oldPol || true)) find('respell');
      showLabel(w); api.whisper(w.text.toLowerCase());
    }
    // ---------- words as objects: thrown, dropped, stretched, turned, reversed ----------
    function stepThrown(w, dt) {
      w.x += w.vx * dt; w.y += w.vy * dt; var fr = Math.pow(.18, dt); w.vx *= fr; w.vy *= fr;
      var hw = w.rect ? w.rect.width / 2 : 40, hh = w.rect ? w.rect.height / 2 : 20;
      if (w.x < hw) { w.x = hw; w.vx = Math.abs(w.vx) * .7; S('bump', 0); } if (w.x > W - hw) { w.x = W - hw; w.vx = -Math.abs(w.vx) * .7; S('bump', 1); }
      if (w.y < hh + 50) { w.y = hh + 50; w.vy = Math.abs(w.vy) * .7; S('bump', w.x / W); } if (w.y > H - hh) { w.y = H - hh; w.vy = -Math.abs(w.vy) * .7; S('bump', w.x / W); }
      if (Math.hypot(w.vx, w.vy) < 20) { w.vx = 0; w.vy = 0; w.hitSet = null; return; }
      words.forEach(function (o) { if (o === w || !o.rect || !w.rect || w.hitDone || (w.hitSet && w.hitSet[o.id])) return; var r = o.rect; if (w.x > r.left && w.x < r.right && w.y > r.top - 10 && w.y < r.bottom + 10) { (w.hitSet = w.hitSet || {})[o.id] = 1; w.hitDone = true; transplant(w, o); w.vx *= -.5; w.vy *= -.5; } });
    }
    function throwWord(w, vx, vy) { var sp = Math.hypot(vx, vy), mx = 2600; if (sp > mx) { vx *= mx / sp; vy *= mx / sp; } w.vx = vx * .9; w.vy = vy * .9; w.hitSet = null; w.hitDone = false; S('thrown', w.x / W); find('thrown'); }
    function setChar(w, i, ch) { var L = w.letters[i]; L.ch = ch; L.sub = null; L.el.textContent = ch; w.text = w.text.slice(0, i) + ch + w.text.slice(i + 1); }
    function transplant(a, b) { // a collision: one letter each way
      var i = Math.floor(Math.random() * a.letters.length), j = Math.floor(Math.random() * b.letters.length), ca = a.text[i], cb = b.text[j]; if (ca === cb) return;
      emit(a.letters[i], 'explode', a); emit(b.letters[j], 'explode', b); setChar(a, i, cb); setChar(b, j, ca);
      [a.letters[i], b.letters[j]].forEach(function (L) { L.g.s = 1.8; Tw.to(L.g, { s: 1, duration: .8, ease: 'elastic.out(1, 0.3)' }); });
      a.override = null; b.override = null; reclassify(a); reclassify(b); S('collide', a.x / W); find('collide'); showLabel(b); api.whisper(a.text.toLowerCase() + ' \u00b7 ' + b.text.toLowerCase());
    }
    function swapMeanings(a, b) {
      var ra = { rel: a.rel, pol: a.pol }, rb = { rel: b.rel, pol: b.pol }; a.override = rb; b.override = ra; reclassify(a); reclassify(b);
      var ax = a.x, ay = a.y; Tw.to(a, { x: b.x + (ax - b.x) * .35, y: b.y + (ay - b.y) * .35, duration: .7, ease: 'power3.out' }); S('swap'); find('swap'); showLabel(a);
    }
    function flip(w, order) { // reorder letters by index list, animating each to its new place
      var before = w.letters.map(function (L) { return L.el.getBoundingClientRect().left; }), nl = order.map(function (k) { return w.letters[k]; });
      nl.forEach(function (L) { w.el.appendChild(L.el); }); w.letters = nl; w.text = nl.map(function (L) { return L.ch; }).join('');
      nl.forEach(function (L, j) { var after = L.el.getBoundingClientRect().left; L.g.x = before[order[j]] - after + (L.g.x || 0) * 0; L.g.y = (j % 2 ? -1 : 1) * w.size * .25; Tw.to(L.g, { x: 0, y: 0, duration: .9, delay: j * .03, ease: 'power3.inOut' }); });
    }
    function reverseWord(w) { if (!w || w.text.length < 2) return; var ord = w.letters.map(function (_, i) { return w.letters.length - 1 - i; }); flip(w, ord); w.override = null; reclassify(w); w.palin = w.text.length >= 3 && w.text === w.text.split('').reverse().join(''); S('reverse'); find('mirror'); showLabel(w); api.whisper(w.text.toLowerCase()); }
    function rearrange(w, target) { var used = {}, ord = target.split('').map(function (ch) { for (var i = 0; i < w.letters.length; i++) if (!used[i] && w.letters[i].ch === ch) { used[i] = 1; return i; } return 0; }); flip(w, ord); w.override = null; reclassify(w); S('anagram'); find('anagram'); showLabel(w); }
    function splitWord(w) {
      if (w.text.length < 2) return; var k = Math.ceil(w.text.length / 2), a = w.text.slice(0, k), b = w.text.slice(k), off = (w.rect ? w.rect.width : 200) * .35, sz = clamp(w.size * .8, 22, 160);
      var wasCur = w === cur; removeWord(w, 'silent'); var wa = newWord(a, w.x - off, w.y, sz, { instant: true }), wb = newWord(b, w.x + off, w.y, sz, { instant: true }); wa.g.o = wb.g.o = 1;
      wa.vx = -260; wb.vx = 260; if (wasCur) cur = wa; S('split'); find('split'); afterNew(wa, {}); afterNew(wb, {}); showLabel(wb);
    }
    function ask(w) {
      if (!w || w.asking) return; w.asking = true; showLabel(w); S('question'); w.letters.forEach(function (L, i) { Tw.to(L.g, { y: -w.size * .25 * Math.sin((i + 1) / w.letters.length * Math.PI / 2), duration: .5, delay: i * .05, ease: 'power2.out', onComplete: function () { Tw.to(L.g, { y: 0, duration: 1, delay: .6, ease: 'elastic.out(1, 0.4)' }); } }); });
      setTimeout(function () {
        if (ac.signal.aborted) return; w.asking = false; var Rr = RELS[w.rel], list = w.pol > 0 ? Rr.opp : Rr.words, ans = list[Math.floor(Math.random() * list.length)];
        var ax = clamp(w.x + (w.x < W / 2 ? 1 : -1) * W * .28, 80, W - 80), ay = clamp(w.y + (w.y < H / 2 ? 1 : -1) * H * .2, 90, H - 60), a2 = newWord(ans, ax, ay, clamp(w.size * .55, 24, 110)); afterNew(a2, {}); find('question');
      }, 1500);
    }
    function sentence() {
      if (sentenceOn || words.length < 2) return; var order = words.slice().sort(function (a, b) { return (a.y - b.y) * .3 + (a.x - b.x); }), total = 0, sz = 0;
      order.forEach(function (w) { total += w.text.length + 1; }); sz = clamp(W * .9 / (total * .6), 18, 90); var xx = W / 2 - total * sz * .6 / 2;
      sentenceOn = order.map(function (w) { var home = { x: w.x, y: w.y, size: w.size }; var cx = xx + w.text.length * sz * .6 / 2; xx += (w.text.length + 1) * sz * .6; Tw.to(w, { x: cx, y: H / 2, size: sz, duration: .9, ease: 'power3.inOut' }); w.held2 = true; return { w: w, home: home }; });
      S('sentence', order.length); find('sentence'); say(order.map(function (w) { return w.text; }).join(' '), 'sentence');
      setTimeout(function () { if (!sentenceOn) return; sentenceOn.forEach(function (o) { o.w.held2 = false; if (words.indexOf(o.w) >= 0) Tw.to(o.w, { x: o.home.x, y: o.home.y, size: o.home.size, duration: 1.2, ease: 'power3.inOut' }); }); sentenceOn = null; }, 4800);
    }
    function shuffleAll() { words.forEach(function (w) { if (w === cur) return; var s2 = SLOTS[Math.floor(Math.random() * SLOTS.length)]; Tw.to(w, { x: s2[0] * W, y: s2[1] * H, duration: 1, ease: 'power3.inOut' }); }); S('swap'); }
    function quake() {
      var now = performance.now(); if (now - quakeT < 3500) return; quakeT = now; S('quake'); find('quake');
      words.forEach(function (w) {
        if (w.rel === 'tremor' && w.pol < 0) return; // SHAKE won't move, even now
        w.letters.forEach(function (L, i) { var lh = (w.size * (w.scaleK || 1)) * .42, floor = H - 10 - lh - (L.cy || w.y) - Math.random() * 14; Tw.to(L.g, { y: floor, r: (Math.random() - .5) * 140, duration: .55 + Math.random() * .3, ease: 'power2.in', onComplete: function () { Tw.to(L.g, { y: 0, r: 0, duration: 1.6, delay: 1.4 + i * .07 + Math.random() * .4, ease: 'elastic.out(1, 0.5)' }); } }); });
      });
    }
    function undoRemove() {
      var r = removed.pop(); if (!r) return; var t = r.text, i = Math.floor(Math.random() * t.length), mode = Math.random();
      if (t.length > 2 && mode < .4) { var j = Math.min(t.length - 1, i + 1); t = t.slice(0, i) + t[j] + t[i] + t.slice(j + 1); } else { var c2 = String.fromCharCode(65 + ((t.charCodeAt(i) - 65 + (Math.random() < .5 ? 1 : 25)) % 26)); t = t.slice(0, i) + c2 + t.slice(i + 1); }
      var w = newWord(t, r.x, r.y, r.size); afterNew(w, {}); S('undo'); find('undo'); api.whisper(r.text.toLowerCase() + '? ' + t.toLowerCase());
    }
    // speaking: the voice contradicts the word in the same way the letters do
    var A2 = null; try { A2 = api.audio && api.audio(); } catch (e) {}
    function say(text, kind, w) {
      if (!window.speechSynthesis || (A2 && A2.muted && A2.muted())) return; try { speechSynthesis.cancel(); } catch (e) {}
      function u(t, o) { var x = new SpeechSynthesisUtterance(t.toLowerCase()); x.rate = o.rate || 1; x.pitch = o.pitch == null ? 1 : o.pitch; x.volume = o.volume == null ? 1 : o.volume; speechSynthesis.speak(x); }
      if (kind === 'sentence' || !w) { u(text, { rate: .9 }); return; }
      var R2 = w.rel, P2 = w.pol, t2 = w.text;
      if (w.palin) u(t2, { rate: 1, pitch: 1 });
      else if (R2 === 'tremor') { if (P2 > 0) { u(t2[0] + '. ' + t2[0] + '. ' + t2.slice(0, 2), { rate: 1.4, pitch: .6 + Math.random() }); u(t2, { rate: .8, pitch: 1.6 }); } else u(t2, { rate: .8, pitch: 1 }); }
      else if (R2 === 'noise') { if (P2 > 0) u(t2 + '!', { rate: 1.3, pitch: 1.9, volume: 1 }); else u(t2, { rate: .6, pitch: .8, volume: .06 }); }
      else if (R2 === 'vanish') { var v = P2 > 0 ? [1, .45, .12] : [.15, .5, 1]; v.forEach(function (vol) { u(t2, { volume: vol, rate: .9 }); }); }
      else if (R2 === 'scale') u(t2, P2 > 0 ? { pitch: 2, rate: 1.6 } : { pitch: 0, rate: .55 });
      else if (R2 === 'unity') u(P2 > 0 ? t2.split('').join(', ') : t2, P2 > 0 ? { rate: .8 } : { rate: 2 });
      else if (R2 === 'tempo') u(t2, P2 > 0 ? { rate: .3 } : { rate: 3 });
      else if (R2 === 'order') u(P2 > 0 ? w.letters.map(function (L) { return L.ch; }).sort(function () { return Math.random() - .5; }).join('') : t2, { rate: 1 });
      find('spoken');
    }
    var G2 = api.gestures ? api.gestures(root, function (type, d) {
      switch (type) {
        case 'longpress': { var w = wordAt(d.x, d.y); if (w && !drag) { w.stare = true; showLabel(w); } else if (!w && !drag) ask(selected || cur); } break;
        case 'longend': words.forEach(function (w) { w.stare = false; }); break;
        case 'swipe': if (d.edge) { var i = PAL_KEYS.indexOf(palKey); setPal(PAL_KEYS[(i + 1) % PAL_KEYS.length]); api.whisper(PALS[palKey].name.toLowerCase()); } else if (performance.now() - dragEnd > 150 && !drag) { if (d.dir === 'left' || d.dir === 'right') cycle(d.dir === 'left' ? 1 : -1); } break;
        case 'multistart': mTarget = wordAt(d.x != null ? d.x : pointer.x, d.y != null ? d.y : pointer.y); mStarted = false; break;
        case 'pinch': if (!mStarted) { mStarted = true; mTarget = wordAt(d.x, d.y); } if (mTarget && words.indexOf(mTarget) >= 0) { mTarget.stretch = clamp((mTarget.stretch || 1) * d.delta, .5, 3); if (mTarget.stretch > 2.4) { var tw2 = mTarget; mTarget = 'done'; splitWord(tw2); } } else if (d.delta && mTarget !== 'done') setInst(inst + (d.delta - 1) * .3, true); break;
        case 'rotate': if (mTarget && mTarget !== 'done' && words.indexOf(mTarget) >= 0) { mTarget.rot = d.angle; if (Math.abs(d.angle) > 2.6 && !mTarget.flipped) { mTarget.flipped = true; reverseWord(mTarget); } } break;
        case 'multiend': if (mTarget && mTarget !== 'done' && words.indexOf(mTarget) >= 0) { mTarget.flipped = false; Tw.to(mTarget, { rot: 0, stretch: 1, duration: 1, ease: 'elastic.out(1, 0.4)' }); } else if (mTarget !== 'done' && Math.abs(d.scale - 1) > .1) api.whisper('instability ' + Math.round(inst * 100) + '%'); mTarget = null; break;
        case 'twoswipe': if (d.dir === 'up') sentence(); else shuffleAll(); break;
        case 'twotap': words.filter(function (w) { return w !== cur; }).forEach(function (w) { removeWord(w, 'dissolve'); }); break;
        case 'threetap': { var t = CURATED[Math.floor(Math.random() * CURATED.length)], s = freeSlot(), w2 = newWord(t, s[0] * W, s[1] * H, clamp(bigSize(t) * .4, 22, 72)); afterNew(w2, {}); } break;
      }
    }) : null;
    var motionAsked = false, tiltSeen = 0, lastShake = 0;
    root.addEventListener('pointerdown', function () { if (motionAsked) return; motionAsked = true; try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().catch(function () {}); } catch (e) {} try { if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().catch(function () {}); } catch (e) {} }, sig);
    addEventListener('deviceorientation', function (e) { if (e.gamma == null || !TOUCH) return; var gx = clamp(e.gamma / 35, -1, 1), gy = clamp((e.beta - 40) / 35, -1, 1); tilt.on = Math.hypot(gx, gy) > .15; tilt.x = tilt.on ? gx : 0; tilt.y = tilt.on ? gy : 0; if (Math.abs(gx) > .5) { if (++tiltSeen > 40) find('lean'); } }, sig);
    addEventListener('devicemotion', function (e) { var a = e.accelerationIncludingGravity || e.acceleration; if (!a || a.x == null) return; var m = Math.hypot(a.x, a.y, a.z || 0), now = performance.now(); if (Math.abs(m - 9.8) > 14 && now - lastShake > 1500) { lastShake = now; quake(); } }, sig);
    root.addEventListener('dblclick', function (e) { var lh = letterAt(e.clientX, e.clientY); if (!lh) { openKeyboard(); } }, sig);
    function openKeyboard() { input.style.left = '50%'; input.focus({ preventScroll: true }); setTimeout(function () { input.style.left = '-9999px'; }, 50); }

    // ---------- panel ----------
    var slot = api.slot && api.slot(), panel = null, ctl = {}, panelOpen = false;
    function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
    if (slot) {
      if (TOUCH) { var kb = el('button', 'hudbtn', 'TYPE'); kb.type = 'button'; kb.setAttribute('aria-label', 'Type a word'); kb.addEventListener('click', function () { input.focus({ preventScroll: true }); }); slot.appendChild(kb); }
      var wrap = el('div', 'icpick'), btn = el('button', 'hudbtn'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(el('span', 'icglyph')); btn.appendChild(el('span', null, 'LEXICON'));
      panel = el('div', 'icpanel'); panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Lexicon and instability');
      var r0 = el('div', 'icrow'), rng0 = el('input'); rng0.type = 'range'; rng0.min = 0; rng0.max = 100; rng0.step = 1; rng0.setAttribute('aria-label', 'Instability'); ctl.instV = el('span', 'icval');
      r0.appendChild(el('span', 'iclab', 'Instability')); r0.appendChild(rng0); r0.appendChild(ctl.instV); panel.appendChild(r0); ctl.inst = rng0;
      rng0.addEventListener('input', function () { setInst(+rng0.value / 100, true); }, sig);
      var r1 = el('div', 'icrow'); r1.appendChild(el('span', 'iclab', 'Palette')); var sw = el('div', 'icsw'); r1.appendChild(sw); panel.appendChild(r1);
      ctl.pals = PAL_KEYS.map(function (k) { var p = PALS[k], b = el('button', 'icchip'); b.type = 'button'; b.title = p.name; b.setAttribute('aria-label', p.name); b.style.background = 'linear-gradient(135deg,' + p.bg + ' 0 55%,' + p.ink + ' 55%)'; b.addEventListener('click', function () { setPal(k); }); sw.appendChild(b); return b; });
      var r2 = el('div', 'icrow'), sg = el('div', 'icseg'); r2.appendChild(el('span', 'iclab', 'Labels')); r2.appendChild(sg); panel.appendChild(r2);
      ctl.lab = ['On', 'Off'].map(function (n, i) { var b = el('button', null, n); b.type = 'button'; b.addEventListener('click', function () { labels = i === 0; persist(); syncPanel(); }); sg.appendChild(b); return b; });
      var lx = el('div'); lx.style.cssText = 'display:grid;gap:2px;margin-top:6px'; panel.appendChild(lx);
      REL_KEYS.forEach(function (k) {
        var R = RELS[k], row = el('div'); row.style.cssText = 'display:grid;grid-template-columns:84px 1fr 1fr;gap:8px;align-items:baseline;padding:4px 0;border-top:1px solid var(--p-line)';
        var nm = el('span', 'iclab', R.name); nm.style.color = R.color; row.appendChild(nm);
        [[R.words[0], R.pos], [R.opp[0], R.neg]].forEach(function (pr) { var b = el('button'); b.type = 'button'; b.style.cssText = 'background:none;border:0;padding:0;text-align:left;cursor:pointer;color:var(--p-fg);font:inherit;letter-spacing:inherit'; b.innerHTML = ''; b.appendChild(el('span', null, pr[0])); var s2 = el('span', null, ' ' + pr[1]); s2.style.cssText = 'color:var(--p-dim);text-transform:none;letter-spacing:0;font-size:11px'; b.appendChild(s2); b.addEventListener('click', function () { involved = true; var w = placeWord(pr[0]); openPanel(false); }); row.appendChild(b); });
        lx.appendChild(row);
      });
      var foot = el('div', 'icfoot');
      [['TYPE A WORD', function () { openPanel(false); input.focus({ preventScroll: true }); }], ['SENTENCE', function () { openPanel(false); sentence(); }], ['UNDO', function () { undoRemove(); }], ['CLEAR', function () { words.slice().forEach(function (w) { removeWord(w, 'dissolve'); }); placeWord('STABLE'); }]].forEach(function (a, i) { var b = el('button', 'iccopy', a[0]); b.type = 'button'; if (!i) b.style.marginLeft = '0'; b.addEventListener('click', a[1]); foot.appendChild(b); });
      panel.appendChild(foot);
      wrap.appendChild(btn); wrap.appendChild(panel); slot.appendChild(wrap); ctl.btn = btn;
      btn.addEventListener('click', function () { openPanel(panel.hidden); });
      document.addEventListener('pointerdown', function (e) { if (panelOpen && !wrap.contains(e.target)) openPanel(false); }, sig);
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { openPanel(false); btn.focus(); e.stopPropagation(); } }, { capture: true, signal: ac.signal });
    }
    function openPanel(o) { if (!panel) return; panelOpen = o; panel.hidden = !o; ctl.btn.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) syncPanel(); }
    function syncPanel() {
      if (!panel) return; ctl.inst.value = Math.round(inst * 100); ctl.instV.textContent = Math.round(inst * 100) + '%';
      ctl.pals.forEach(function (b, i) { b.setAttribute('aria-pressed', PAL_KEYS[i] === palKey ? 'true' : 'false'); });
      ctl.lab.forEach(function (b, i) { b.setAttribute('aria-pressed', (i === 0) === labels ? 'true' : 'false'); });
    }
    function setPal(k) { if (!PALS[k]) return; palKey = k; persist(); root.style.background = PALS[k].bg; api.tone(PALS[k].dark ? 'dark' : 'light'); syncPanel(); }

    // ---------- start ----------
    setPal(palKey); syncPanel();
    placeWord('STABLE');
    if (kept.length) setTimeout(function () { if (ac.signal.aborted) return; kept.forEach(function (t) { var s = freeSlot(), w = newWord(t, s[0] * W, s[1] * H, clamp(bigSize(t) * .4, 22, 72), { kept: true }); w.weight = .6; }); S('kept'); find('kept'); }, 1800);
    if (document.fonts && document.fonts.load) document.fonts.load('500 100px "Roboto Flex"').then(function () { measure(); }, function () {});
    addEventListener('resize', function () { var ow = W, oh = H; size(); words.forEach(function (w) { w.x = w.x / ow * W; w.y = w.y / oh * H; if (w === cur) w.size = bigSize(w.text); }); }, sig);
    raf = requestAnimationFrame(loop);
    if (SBL.debug) SBL._08 = { ask: ask, sentence: sentence, quake: quake, reverse: reverseWord, split: splitWord, swap: swapMeanings, transplant: transplant, undo: undoRemove, say: say, cur: function () { return cur; }, tilt: tilt, removed: function () { return removed; }, words: function () { return words; }, classify: classify, type: function (s) { for (var i = 0; i < s.length; i++) typeChar(s[i]); commitTyping(); }, tear: function (w, i) { tear(w, w.letters[i]); }, setInst: setInst, found: found, parts: function () { return parts.length; }, cycle: cycle, hushed: function () { return hushed; } };

    return function unmount() { ac.abort(); cancelAnimationFrame(raf); clearTimeout(typeT); words.slice().forEach(function (w) { VS(w, 'stop'); }); if (G2) G2(); S('stop'); };
  }
});
