// /public/p5/bootstrap-jupiter.js
// Bootstraps the Jupiter sim. No optional-chaining or nullish coalescing.

(function () {
  var startBtn   = document.getElementById('start-jupiter-sim');
  var rotInput   = document.getElementById('js-speed');
  var stormInput = document.getElementById('js-storm');
  var starsInput = document.getElementById('js-stars');

  var outRot   = document.getElementById('out-rot');
  var outStorm = document.getElementById('out-storm');
  var outStars = document.getElementById('out-stars');

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
    if (outRot)   outRot.textContent   = fmt(val(rotInput, 0.6), 2);
    if (outStorm) outStorm.textContent = fmt(val(stormInput, 0.75), 2);
    if (outStars) outStars.textContent = fmt(val(starsInput, 0.8), 2);
  }

  if (rotInput)   rotInput.addEventListener('input', syncOutputs);
  if (stormInput) stormInput.addEventListener('input', syncOutputs);
  if (starsInput) starsInput.addEventListener('input', syncOutputs);
  syncOutputs();

  var started = false;

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

  // Prefetch p5 when the stage is near viewport
  var stageEl = document.querySelector('.sim-stage');
  if (stageEl && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (started) return;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { loadP5(); io.disconnect(); break; }
      }
    }, { rootMargin: '200px' });
    io.observe(stageEl);
  }

  if (startBtn) startBtn.addEventListener('click', function () {
    if (started) return;
    started = true;
    startBtn.remove();

    loadP5().then(function () {
      import('/p5/jupyter.js').then(function (mod) {
        new window.p5(mod.jupiterSketch, 'jupiter-sim');
      });
    });
  });
})();