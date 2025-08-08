// /public/p5/bootstrap-nebula.js
// Bootstraps the Nebula (SNR) sim and AUTO-STARTS when the sim enters the viewport.

(function () {
  var startBtn = document.getElementById('start-nebula-sim');
  var stageEl  = document.querySelector('.sim-stage');

  // Inputs (for output syncing if you show them)
  var speedIn  = document.getElementById('js-neb-speed');
  var ageIn    = document.getElementById('js-neb-age');
  var eIn      = document.getElementById('js-neb-e');
  var n0In     = document.getElementById('js-neb-n0');
  var anisoIn  = document.getElementById('js-neb-aniso');

  // Outputs
  var outAge   = document.getElementById('out-age');
  var outE     = document.getElementById('out-e');
  var outN0    = document.getElementById('out-n0');
  var outAniso = document.getElementById('out-aniso');
  var outSpd   = document.getElementById('out-speed');

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
    if (outAge)   outAge.textContent   = fmt(val(ageIn,   1), 0);
    if (outE)     outE.textContent     = fmt(val(eIn,     1.00), 2);
    if (outN0)    outN0.textContent    = fmt(val(n0In,    1.00), 2);
    if (outAniso) outAniso.textContent = fmt(val(anisoIn, 0.25), 2);
    if (outSpd)   outSpd.textContent   = fmt(val(speedIn, 73.3), 1); // years/sec
  }
  if (speedIn) speedIn.addEventListener('input', syncOutputs);
  if (ageIn)   ageIn.addEventListener('input',   syncOutputs);
  if (eIn)     eIn.addEventListener('input',     syncOutputs);
  if (n0In)    n0In.addEventListener('input',    syncOutputs);
  if (anisoIn) anisoIn.addEventListener('input', syncOutputs);
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

  function begin() {
    if (started) return;
    started = true;
    if (startBtn) startBtn.remove();
    loadP5().then(function () {
      return import('/p5/nebula.js');
    }).then(function (mod) {
      new window.p5(mod.nebulaSketch, 'nebula-sim');
    });
  }

  // Prefetch AND auto-start when near viewport
  if (stageEl && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (started) return;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { begin(); io.disconnect(); break; }
      }
    }, { rootMargin: '200px' });
    io.observe(stageEl);
  }

  // Fallback: manual start button if needed
  if (startBtn) startBtn.addEventListener('click', begin);
})();