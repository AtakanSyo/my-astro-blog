// /public/p5/saturn.js
// Saturn: central sphere + Perlin-swirling ring particles (fast)
// Now with a lightweight procedural globe texture + rim glow.

export const saturnSketch = (p) => {
  // ---- Config ----
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  let W = 900, H = 520;
  let R = 180;                  // planet radius (set in setup)
  let rotSpeed = 0.35;          // deg/frame (hook to #js-speed if present)
  let ringTiltDeg = 18;         // deg (hook to #js-tilt if present)
  let paused = false;

  // Globe texture (built once; cheap)
  let globeTex, globeW = 768, globeH = 384;

  // Ring geometry (relative to planet radius), approx real values
  const R_INNER  = 1.23;
  const R_C_END  = 1.52;
  const R_B_END  = 1.95;
  const R_CASS_0 = 1.95;
  const R_CASS_1 = 2.02;
  const R_A_END  = 2.27;
  const R_ENCKE  = 2.26;

  // Particles
  const NUM_PARTICLES = 1500;
  const TRAIL_LEN = 6;
  const RAD_JITTER = 0.35;
  const ANG_NOISE  = 0.6;
  let particles = [];

  // Light direction
  const LIGHT = norm3(-0.4, -0.25, 0.85);

  // State
  let phase = 0; // planet rotation (deg)
  let t = 0;     // time

  p.setup = () => {
    const parent = document.getElementById('saturn-sim') || document.body;
    const size = chooseCanvasSize(parent);
    W = size[0]; H = size[1];

    p.pixelDensity(DPR);
    p.createCanvas(W, H, p.WEBGL);
    p.frameRate(60);

    R = Math.min(W, H) * 0.33;

    globeTex = p.createGraphics(globeW, globeH);
    globeTex.pixelDensity(1);
    buildGlobeTexture(globeTex);

    initParticles();
    hookControls();
  };

  p.windowResized = () => {
    const parent = document.getElementById('saturn-sim') || document.body;
    const size = chooseCanvasSize(parent);
    W = size[0]; H = size[1];
    p.resizeCanvas(W, H);
    R = Math.min(W, H) * 0.33;

    globeTex = p.createGraphics(globeW, globeH);
    globeTex.pixelDensity(1);
    buildGlobeTexture(globeTex);
  };

  p.draw = () => {
    if (paused) return;

    p.background(8, 10, 16);

    // Time + rotation
    t += 0.006;
    phase = (phase + rotSpeed) % 360;

    // ---- Globe (textured + lights) ----
    p.ambientLight(70);
    p.directionalLight(255, 255, 255, LIGHT.x, LIGHT.y, LIGHT.z);
    p.shininess(12);

    p.push();
    p.noStroke();
    p.rotateY(p.radians(phase));
    p.texture(globeTex);
    p.sphere(R, 72, 56);
    p.pop();

    // Subtle rim glow (very cheap)
    p.push();
    p.noStroke();
    p.rotateY(p.radians(phase));
    p.fill(255, 255, 255, 12);
    p.sphere(R * 1.01, 40, 30);
    p.pop();

    // ---- Ring particles (in ring plane coords, then transform) ----
    const inner = R * R_INNER;
    const outer = R * R_A_END;

    p.push();
    p.rotateY(p.radians(phase));      // co-rotate with planet
    p.rotateX(p.radians(ringTiltDeg));// tilt the plane

    // Soft planet shadow across ring
    drawRingShadow(outer, R);

    // Draw/update particles
    p.strokeWeight(1.25);
    for (let i = 0; i < particles.length; i++) {
      const s = particles[i];

      // Kepler-ish base speed + Perlin swirl
      const rRel = s.rRel;
      const baseAng = 0.70 / Math.pow(rRel, 1.5);
      const ns = 0.0038;
      const angN = (p.noise(s.theta * ns, s.r * ns, t * 0.8) - 0.5) * ANG_NOISE;
      const radN = (p.noise(s.r * ns, s.theta * ns + 100, t * 0.65) - 0.5) * RAD_JITTER;

      s.theta = (s.theta + baseAng + angN) % 360;

      let rNew = s.r + radN;
      const rr = rNew / R;
      if (rr > R_CASS_0 && rr < R_CASS_1) rNew += (rr < (R_CASS_0 + R_CASS_1)/2 ? -1 : 1) * 0.8;
      if (Math.abs(rr - R_ENCKE) < 0.01)   rNew += (rr < R_ENCKE ? -1 : 1) * 0.6;
      s.r = clamp(rNew, inner, outer);

      // Position in ring plane
      const th = p.radians(s.theta);
      const pos = { x: s.r * Math.cos(th), y: 0, z: s.r * Math.sin(th) };

      // Trail history
      s.hist[s.hi] = pos;
      s.hi = (s.hi + 1) % TRAIL_LEN;

      // Color by ring region
      const col = colorForRadius(s.r / R, s.tint, t, s.theta);

      // Trail
      p.noFill();
      p.stroke(col.r, col.g, col.b, col.aTrail);
      p.beginShape();
      for (let k = 0; k < TRAIL_LEN; k++) {
        const idx = (s.hi + k) % TRAIL_LEN;
        const pt = s.hist[idx];
        if (pt) p.vertex(pt.x, pt.y, pt.z);
      }
      p.endShape();

      // Head spark
      p.stroke(col.rHead, col.gHead, col.bHead, col.aHead);
      p.point(pos.x, pos.y, pos.z);
    }

    p.pop();

    // Vignette
    drawVignette();
  };

  // ---------- Procedural globe texture (built once) ----------
  function buildGlobeTexture(g) {
    g.push();
    g.clear();
    g.noStroke();

    // Subtle belts (creams/browns), faint polar bluish tint, equatorial brightening
    for (let y = 0; y < globeH; y++) {
      const v = y / (globeH - 1);
      const lat = p.PI * (v - 0.5);                   // -pi/2..pi/2
      const absLatDeg = Math.abs(p.degrees(lat));

      // base creamy tone
      let r = 232, gg = 220, b = 196;

      // belts via sinusoids
      const w1 = Math.sin(lat * 8.7) * 0.28;
      const w2 = Math.sin(lat * 4.1 + 0.7) * 0.18;
      const band = w1 + w2;
      r -= 18 * band; gg -= 22 * band; b -= 12 * band;

      // equatorial brightening
      const eq = 1.0 - Math.min(1, Math.abs(v - 0.5) / 0.35);
      r += 6 * eq; gg += 6 * eq; b += 6 * eq;

      // polar cool tint
      const pol = smoothstep(58, 82, absLatDeg);
      r = r * (1 - 0.08 * pol) + 120 * 0.08 * pol;
      gg = gg * (1 - 0.10 * pol) + 140 * 0.10 * pol;
      b = b * (1 - 0.16 * pol) + 170 * 0.16 * pol;

      // tiny noise for grain
      const n = (p.noise(0.0, v * 3.1) - 0.5) * 6;
      g.fill(r + n, gg + n, b + n);
      g.rect(0, y, globeW, 1);
    }

    // faint north-pole hexagon
    const hexLatDeg = 78;
    const cy = Math.floor((1 - ((p.radians(hexLatDeg) + p.HALF_PI) / p.PI)) * globeH);
    g.push();
    g.translate(globeW / 2, cy);
    g.stroke(200, 210, 230, 40);
    g.noFill();
    const rad = Math.round(globeW * 0.075);
    g.beginShape();
    for (let i = 0; i < 6; i++) {
      const a = (p.TWO_PI * i) / 6 + 0.2;
      g.vertex(Math.cos(a) * rad, Math.sin(a) * rad * 0.62);
    }
    g.endShape(p.CLOSE);
    g.pop();

    // gentle "ring light" band near equator (subtle)
    g.push();
    g.noStroke();
    const bandY = Math.round(globeH * 0.5);
    for (let dy = -4; dy <= 4; dy++) {
      const a = 16 - Math.abs(dy) * 2.2;
      g.fill(255, 245, 230, a);
      g.rect(0, bandY + dy, globeW, 1);
    }
    g.pop();

    g.pop();
  }

  // ---------- Particles ----------
  function initParticles() {
    particles = [];
    const rng = mulberry32(20250808);

    const inner = R * R_INNER;
    const outer = R * R_A_END;

    function regionWeight(rr) {
      if (rr < R_C_END) return 0.35;    // C (faint)
      if (rr < R_B_END) return 1.0;     // B (dense)
      if (rr < R_CASS_1) return 0.04;   // Cassini (sparse)
      const base = 0.65;                // A
      const gap  = Math.max(0, 1 - (Math.abs(rr - R_ENCKE) / 0.008));
      return base * Math.max(0.1, 1 - gap);
    }

    let tries = 0;
    while (particles.length < NUM_PARTICLES && tries < NUM_PARTICLES * 50) {
      tries++;
      const rr = lerp(R_INNER, R_A_END, rng());
      const w  = regionWeight(rr);
      if (rng() > w) continue;

      const r   = rr * R;
      const th  = rng() * 360;
      const tin = (rng() - 0.5) * 0.06;

      particles.push({
        r, rRel: rr,
        theta: th,
        tint: tin,
        hist: new Array(TRAIL_LEN),
        hi: 0
      });
    }
  }

  // ---------- Colors ----------
  function colorForRadius(rr, tint, time, theta) {
    const Ccol  = [210, 205, 195];
    const Bcol  = [238, 230, 215];
    const Acol  = [225, 220, 205];
    const Dcol  = [90,  90,  95];

    let base = Acol, aTrail = 140, aHead = 220;

    if (rr < R_C_END) {          // C
      base = mixRGB(Ccol, Bcol, 0.2);
      aTrail = 80; aHead = 160;
    } else if (rr < R_B_END) {   // B
      base = Bcol;
      aTrail = 200; aHead = 255;
    } else if (rr < R_CASS_1) {  // Cassini Div
      base = Dcol;
      aTrail = 45;  aHead = 90;
    } else {                     // A
      base = Acol;
      aTrail = 140; aHead = 220;
      const d = Math.abs(rr - R_ENCKE);
      if (d < 0.02) {
        const f = 1 - (0.02 - d) / 0.02;
        aTrail *= f; aHead *= f;
      }
    }

    const jitter = 0.035 * (p.noise(0.025 * theta, time * 0.4) - 0.5);
    const r = clamp((base[0] * (1 + tint + jitter)) | 0, 0, 255);
    const g = clamp((base[1] * (1 + tint + jitter)) | 0, 0, 255);
    const b = clamp((base[2] * (1 + tint + jitter)) | 0, 0, 255);

    const rHead = clamp((r * 1.10) | 0, 0, 255);
    const gHead = clamp((g * 1.10) | 0, 0, 255);
    const bHead = clamp((b * 1.10) | 0, 0, 255);

    return { r, g, b, aTrail, rHead, gHead, bHead, aHead };
  }

  // ---------- UI ----------
  function hookControls() {
    const speed   = document.getElementById('js-speed');
    const tilt    = document.getElementById('js-tilt');
    const pauseBtn= document.getElementById('js-pause');

    if (speed) speed.addEventListener('input', function (e) { rotSpeed = +e.target.value; });
    if (tilt)  tilt.addEventListener('input',  function (e) { ringTiltDeg = +e.target.value; });

    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      if (!paused) p.loop();
    });
  }

  // ---------- Visual flourishes ----------
  function drawRingShadow(outer, planetR) {
    p.push();
    p.noStroke();
    const offX = planetR * 0.45 * (LIGHT.x);
    const offZ = planetR * -0.25 * (LIGHT.z);
    const rx = planetR * 1.7;
    const rz = planetR * 0.9;

    for (let i = 0; i < 6; i++) {
      const a = 22 - i * 3;
      p.fill(0, 0, 0, a);
      p.push(); p.translate(offX, 0, offZ); p.ellipse(0, 0, rx, rz); p.pop();
    }
    p.pop();
  }

  function drawVignette() {
    p.push();
    p.resetMatrix();
    p.noStroke();
    for (let i = 0; i < 6; i++) {
      const a = 22 - i * 4;
      p.fill(0, 0, 0, a);
      p.rect(-W/2, -H/2, W, H, 24);
    }
    p.pop();
  }

  // ---------- Utils ----------
  function chooseCanvasSize(parent) {
    const w = Math.max(320, Math.min((parent && parent.clientWidth) || window.innerWidth, 1920));
    const hByWidth = Math.round(w * 0.55);
    const hMax = Math.floor(window.innerHeight * 0.75);
    const h = Math.max(300, Math.min(hByWidth, hMax, 560));
    return [w, h];
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function mixRGB(a, b, t) { return [a[0] + (b[0]-a[0]) * t, a[1] + (b[1]-a[1]) * t, a[2] + (b[2]-a[2]) * t]; }
  function norm3(x, y, z) { const m = Math.sqrt(x*x + y*y + z*z) || 1; return { x:x/m, y:y/m, z:z/m }; }
  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / Math.max(1e-6, e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function mulberry32(a) { return function() { let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7, t|61); return ((t^t>>>14)>>>0)/4294967296; } }
};