// /public/p5/jupyter.js
// Fast: single shaded sphere + Perlin flow trails with Jupiter band colors

export const jupiterSketch = (p) => {
  // ---- Config ----
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  let W = 900, H = 520;
  let R = 180;                     // sphere radius (computed in setup)
  const NUM_PARTICLES = 1100;      // fast on mobile; tweak if needed
  const TRAIL_LEN = 6;             // short trails for speed
  const SHELL_FACTOR = 1.07;       // particle shell radius multiplier

  // Controls (hooked to your existing sliders if present)
  let rotSpeed = 0.5;              // deg/frame
  let storminess = 0.8;            // 0..1.5
  let paused = false;

  // State
  let phase = 0;                   // planet rotation (deg)
  let t = 0;                       // time (for noise)
  let particles = [];

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

    // subtle frame fade for motion-trail effect (cheap)
    p.push();
    p.resetMatrix();
    p.noStroke();
    p.fill(0, 0, 0, 42);
    p.rect(-W/2, -H/2, W, H);
    p.pop();

    // time & rotation
    t += 0.006;
    phase = (phase + rotSpeed) % 360;

    // simple lighting + sphere
    p.ambientLight(60);
    p.directionalLight(255, 255, 255, -0.4, -0.3, 0.8);
    p.specularMaterial(215);
    p.shininess(20);

    p.push();
    p.noStroke();
    p.rotateY(p.radians(phase));
    p.sphere(R, 64, 48);
    p.pop();

    // particle shell
    const shellR = R * SHELL_FACTOR;
    p.strokeWeight(1.3);

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const s = particles[i];

      // --- Perlin-driven zonal flow in lat/lon ---
      const latRad = p.radians(s.lat);
      const jetDir = Math.sign(Math.sin(latRad * 3.3));                // alternate by latitude
      const baseLonStep = (0.35 + 0.25 * jetDir) * (0.7 + 0.6 * Math.cos(latRad));

      const ns = 0.015;
      const u = p.noise(s.lat * ns, s.lon * ns, t * 0.7) - 0.5;        // lon perturb
      const v = p.noise(s.lon * ns, s.lat * ns, t * 0.9) - 0.5;        // lat perturb

      s.lon = (s.lon + baseLonStep + u * (1.6 * storminess)) % 360;
      s.lat = p.constrain(s.lat + v * (0.9 * storminess), -80, 80);

      // convert to 3D
      const pos = sphToCart(shellR, s.lat, s.lon);

      // push to short trail ring buffer
      s.hist[s.hi] = pos;
      s.hi = (s.hi + 1) % TRAIL_LEN;

      // Jupiter band color by latitude (+ tiny lon/time variation)
      const col = bandColorJupiter(s.lat, s.lon, t);

      // trail (older->newer)
      p.noFill();
      p.stroke(col.r, col.g, col.b, 180);
      p.beginShape();
      for (let k = 0; k < TRAIL_LEN; k++) {
        const idx = (s.hi + k) % TRAIL_LEN;
        const pt = s.hist[idx];
        if (pt) p.vertex(pt.x, pt.y, pt.z);
      }
      p.endShape();

      // bright head “spark”
      p.stroke(
        Math.min(255, Math.floor(col.r * 1.12)),
        Math.min(255, Math.floor(col.g * 1.12)),
        Math.min(255, Math.floor(col.b * 1.12)),
        220
      );
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
      particles.push({ lat, lon, hist: new Array(TRAIL_LEN), hi: 0 });
    }
  }

  function sphToCart(radius, latDeg, lonDeg) {
    const lat = p.radians(latDeg), lon = p.radians(lonDeg);
    const cl = Math.cos(lat), sl = Math.sin(lat);
    return { x: radius * cl * Math.cos(lon), y: radius * sl, z: radius * cl * Math.sin(lon) };
  }

  // Jupiter-ish band palette: belts (tan/brown), zones (creamy), darker bluish poles
  function bandColorJupiter(latDeg, lonDeg, time) {
    const lat = p.radians(latDeg);
    const absLat = Math.abs(latDeg);

    // Alternate belts/zones across latitude
    const k = 9.0;                                // number of bands
    const wave = Math.sin(lat * k);               // -1..1
    const beltAmt = 0.5 * (wave + 1);             // 0..1 (1=belt, 0=zone)

    // Base colors
    const BELT  = [177, 124, 74];                 // brownish
    const ZONE  = [238, 224, 199];                // creamy
    const EQUAT = [245, 230, 205];                // slightly lighter equatorial zone
    const POLAR = [120, 140, 170];                // bluish-gray dark poles

    // Equatorial boost and polar darkening
    const eqBoost = smoothstep(0.0, 18.0, 18.0 - absLat);     // 0..1 near equator
    const polAmt  = smoothstep(55.0, 80.0, absLat);           // 0..1 near poles

    // Mix belt/zone
    let base = mixRGB(ZONE, BELT, beltAmt);

    // Equator: blend a bit toward EQUAT
    base = mixRGB(base, EQUAT, 0.35 * eqBoost);

    // Poles: blend toward POLAR & dim slightly
    base = mixRGB(base, POLAR, 0.55 * polAmt);
    const dim = 1.0 - 0.25 * polAmt;
    base = [ base[0]*dim, base[1]*dim, base[2]*dim ];

    // Tiny longitudinal/time variation to avoid flat stripes
    const jitter = 0.04 * (p.noise(0.03 * lonDeg, time * 0.4) - 0.5);
    base = [ base[0] * (1 + jitter), base[1] * (1 + jitter), base[2] * (1 + jitter) ];

    // clamp
    return { r: clamp(Math.floor(base[0]), 0, 255),
             g: clamp(Math.floor(base[1]), 0, 255),
             b: clamp(Math.floor(base[2]), 0, 255) };
  }

  function mixRGB(a, b, t) {
    return [ a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t ];
  }
  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

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
    // Full viewport width, height clamped (keeps it fast and pretty)
    const w = Math.max(320, Math.min((parent && parent.clientWidth) || window.innerWidth, 1920));
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