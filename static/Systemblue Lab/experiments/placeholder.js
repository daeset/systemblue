/* Shared stand-in for experiments that are not built yet: plays the entry's motif fullscreen. */
SBL.register('placeholder', {
  mount: function (stage, api, entry) {
    var c = document.createElement('canvas'), x = c.getContext('2d'), raf, t0 = performance.now();
    stage.appendChild(c);
    var col = { fg: '#e9eef2', ac: '#3d6bff' };
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var d = Math.min(devicePixelRatio || 1, 2), w = stage.clientWidth, h = stage.clientHeight;
      if (c.width !== w * d || c.height !== h * d) { c.width = w * d; c.height = h * d; }
      x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h); x.globalAlpha = 1;
      (SBL.motifs[entry.motif] || SBL.motifs.lines)(x, w, h, (now - t0) / 1000, col);
    }
    raf = requestAnimationFrame(frame);
    api.caption(entry.title + ' is in development.');
    return function () { cancelAnimationFrame(raf); };
  }
});
