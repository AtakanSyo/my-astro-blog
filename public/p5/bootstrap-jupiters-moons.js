// /public/p5/bootstrap-jupiter.js
// Bootstraps the Jupiter + Galilean moons sim. External file so MDX won't parse it.

(function () {
  var startBtn  = document.getElementById('start-jupiter-sim');
  var stageEl   = document.querySelector('.sim-stage');
  var speedIn   = document.getElementById('js-speed');
  var tiltIn    = document.getElementById('js-tilt');
  var pauseBtn  = document.getElementById('js-pause');

  var outRot  = document.getElementById('out-rot');
  var outTilt = document.getElementById('out-tilt');

  var started = false;

  function fmt(x, n) {
    if (typeof n !== 'number') n = 2;
    var p = Math.pow(10, n);
    return (Math.round(x * p) / p).toFixed(n);
  }
  function val(el, fallback) {
    if (!el || el.value === undefined || el.value === null || el.value === '') return fallback;
    var num = parseFloat(el.value);
    return isNaN(num) ? fallback : num;
  }
  function syncOutputs() {
    if (outRot)  outRot.textContent  = fmt(val(speedIn, 0.60), 2);
    if (outTilt) outTilt.textContent = fmt(val(tiltIn, 3), 0);
  }
  if (speedIn) speedIn.addEventListener('input', syncOutputs);
  if (tiltIn)  tiltIn.addEventListener('input',  syncOutputs);
  syncOutputs();

  function loadP5() {
    return new Promise(function (resolve) {
      if (window.p5) return resolve();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/p5@1.9.3/lib/p5.min.js';
      s.defer = true;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  // Prefetch p5 when the sim is near viewport so Start feels instant
  if (stageEl && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (started) return;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { loadP5(); io.disconnect(); break; }
      }
    }, { rootMargin: '200px' });
    io.observe(stageEl);
  }

  // Start the sim
  if (startBtn) startBtn.addEventListener('click', function () {
    if (started) return;
    started = true;
    startBtn.remove();

    loadP5().then(function () {
      return import('/p5/jupiter-moons.js');
    }).then(function (mod) {
      // Mount into #jupiter-sim
      new window.p5(mod.jupiterSketch, 'jupiter-sim');
    });
  });

  // Note: pause button is handled by the sketch's own hookControls().
  // We don't touch it here to avoid double-listening.
})();