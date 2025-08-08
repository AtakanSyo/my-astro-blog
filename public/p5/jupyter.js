// /public/p5/jupyter.js
// Fast Jupiter: single shaded sphere + Perlin flow trails around it.

export const jupiterSketch = (p) => {
  // ---- Config (tweak freely) ----
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  let W = 900, H = 520;
  let R = 180;                     // sphere radius in px (computed in setup)
  const NUM_PARTICLES = 1100;      // keep lean
  const TRAIL_LEN = 6;             // points kept per particle for short trails
  const SHELL_FACTOR = 1.07;       // particle shell: radius = R * SHELL_FACTOR
  let rotSpeed = 0.5;              // deg/frame, planet spin (hooked to #js-speed if present)
  let storminess = 0.8;            // 0..1.5 amplitude (hooked to #js-storm if present)

  // State
  let phase = 0;                   // planet Y-rotation (deg)
  let t = 0;                       // time for noise
  let particles = [];
  let paused = false;

  p.setup = () => {
    const parent = document.getElementById('jupiter-sim');
    [W, H] = chooseCanvasSize(parent);
    p.pixelDensity(DPR);
    p.createCanvas(W, H, p.WEBGL);
    p.frameRate(60);

    R = Math.min(W, H) * 0.33;

    initParticles();
    hookControls();
  };

  p.windowResized = () => {
    const parent = document.getElementById('jupiter-sim');
    [W, H] = chooseCanvasSize(parent);
    p.resizeCanvas(W, H);
    R = Math.min(W, H) * 0.33;
  };

  p.draw = () => {
    if (paused) return;

    // fade the previous frame slightly to give soft motion blur to trails
    p.push();
    p.resetMatrix();
    p.noStroke();
    p.fill(0, 0, 0, 42);              // ~16% black; adjust for longer/shorter tails
    p.rect(-W/2, -H/2, W, H);
    p.pop();

    // time & rotation
    t += 0.006;
    phase = (phase + rotSpeed) % 360;

    // lighting
    p.ambientLight(60);
    p.directionalLight(255, 255, 255, -0.4, -0.3, 0.8);
    p.specularMaterial(215);          // simple shaded look
    p.shininess(20);

    // draw the sphere
    p.push();
    p.noStroke();
    p.rotateY(p.radians(phase));
    p.sphere(R, 64, 48);
    p.pop();

    // update + draw particle trails (3D, depth-correct)
    const shellR = R * SHELL_FACTOR;
    p.strokeWeight(1.3);
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const s = particles[i];

      // --- flow field in lat/lon space ---
      // base zonal flow: alternating jets by latitude (cheap & pretty)
      const latRad = p.radians(s.lat);
      const jetDir = Math.sign(Math.sin(latRad * 3.3));         // flip with latitude bands
      const baseLonStep = (0.35 + 0.25 * jetDir) * (0.7 + 0.6 * Math.cos(latRad));

      // Perlin perturbations
      const ns = 0.015;  // noise scale
      const u = p.noise(s.lat * ns, s.lon * ns, t * 0.7) - 0.5; // lon perturb
      const v = p.noise(s.lon * ns, s.lat * ns, t * 0.9) - 0.5; // lat perturb

      s.lon = (s.lon + baseLonStep + u * (1.6 * storminess)) % 360;
      s.lat = p.constrain(s.lat + v * (0.9 * storminess), -80, 80);

      // convert to 3D
      const pos = sphToCart(shellR, s.lat, s.lon);

      // push to history (short trail)
      s.hist[s.hi] = pos;
      s.hi = (s.hi + 1) % TRAIL_LEN;

      // color by latitude band (subtle warm/cool tint)
      const warm = 200 + 40 * (0.5 + 0.5 * Math.sin(latRad * 2.0));
      const cool = 220 + 25 * (0.5 - 0.5 * Math.sin(latRad * 2.0));
      p.stroke(warm, cool, 255, 170);

      // draw trail as a polyline (depth-correct, cheap)
      p.noFill();
      p.beginShape();
      for (let k = 0; k < TRAIL_LEN; k++) {
        // oldest->newest in ring buffer
        const idx = (s.hi + k) % TRAIL_LEN;
        const pt = s.hist[idx];
        if (pt) p.vertex(pt.x, pt.y, pt.z);
      }
      p.endShape();

      // draw the head brighter
      p.stroke(255, 240, 220, 220);
      p.point(pos.x, pos.y, pos.z);
    }
  };

  // ---- helpers ----
  function initParticles() {
    particles = [];
    const rng = mulberry32(1337);
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const lat = p.lerp(-75, 75, rng());
      const lon = rng() * 360;
      particles.push({
        lat,
        lon,
        hist: new Array(TRAIL_LEN),
        hi: 0
      });
    }
  }

  function sphToCart(radius, latDeg, lonDeg) {
    const lat = p.radians(latDeg);
    const lon = p.radians(lonDeg);
    const cl = Math.cos(lat), sl = Math.sin(lat);
    return {
      x: radius * cl * Math.cos(lon),
      y: radius * sl,
      z: radius * cl * Math.sin(lon)
    };
  }

  function hookControls() {
    const speed = document.getElementById('js-speed');
    const storm = document.getElementById('js-storm');
    const pauseBtn = document.getElementById('js-pause');

    if (speed) speed.addEventListener('input', (e) => { rotSpeed = +e.target.value; });
    if (storm) storm.addEventListener('input', (e) => { storminess = +e.target.value; });
    if (pauseBtn) pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      if (!paused) p.loop();
    });
  }

  function chooseCanvasSize(parent) {
    // full-bleed width, controlled height (fast to draw)
    const w = Math.max(320, Math.min((parent?.clientWidth || window.innerWidth), 1920));
    const hByWidth = Math.round(w * 0.55);
    const hMax = Math.floor(window.innerHeight * 0.75);
    const h = Math.max(300, Math.min(hByWidth, hMax, 560));
    return [w, h];
  }

  // tiny PRNG for stable seeding
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }
};