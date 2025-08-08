// /public/p5/nebula.js
// Nebula (Crab-mode, stable rim): synchrotron haze + coherent filaments + torus & jets
// Fixes: static radial jitter (no TV-static) + depth-test disabled for particles

export const nebulaSketch = (p) => {
  // ---- Canvas / Perf ----
  let W = 900, H = 520;
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);

  // ---- Autoplay (hands-off 30s) ----
  const AGE_START_YR = 1;
  const AGE_END_YR   = 2200;
  const AUTO_SPEED_YPS = (AGE_END_YR - AGE_START_YR) / 30; // years/sec

  // Controls / Params
  let paused   = false;
  let ageYr    = AGE_START_YR;
  let speedYPS = AUTO_SPEED_YPS;
  let E51      = 1.0;
  let n0       = 1.0;
  let aniso    = 0.22;

  // Shell + motion
  const SHELL_THICK = 0.10;
  const ROT_RATE    = 0.0018;
  const GROW_YR     = 200;
  const MORPH_YR    = 360;
  const TRAIL_LEN   = 2;

  // Particle pool (adaptive)
  const POOL_SIZE   = 5200;
  let   activeCount = 3200;
  const MIN_COUNT   = 1600, MAX_COUNT = 4200;

  // Roles (Crab-ish)
  const FRACT_TORUS = 0.22; // equatorial donut
  const FRACT_JETS  = 0.06; // polar cones

  // Curl-noise advection (coherence)
  const CURL_FREQ  = 0.55;
  const CURL_GAIN  = 0.55;
  const CURL_TIME  = 0.08;

  // Synchrotron haze buffer (cheap "volume")
  let haze;
  const HAZE_RES    = 360;
  const HAZE_FADE   = 0.92;
  const HAZE_COUNT  = 520;
  const HAZE_SPEED  = 0.9;

  // State / perf
  let pts = [];
  let yaw = 0, pitch = 0, tsec = 0;
  let dtEMA = 16.7, frameCounter = 0;
  let starfield;

  p.setup = () => {
    const parent = document.getElementById('nebula-sim') || document.body;
    const size = chooseCanvasSize(parent); W = size[0]; H = size[1];

    p.pixelDensity(DPR);
    p.createCanvas(W, H, p.WEBGL);
    p.frameRate(60);

    haze = p.createGraphics(HAZE_RES, HAZE_RES);
    haze.pixelDensity(1);
    haze.background(0, 0);

    initPool();
    initHazeSeeds();
    starfield = makeStarfield(W, H, 420);
    hookControls();
  };

  p.windowResized = () => {
    const parent = document.getElementById('nebula-sim') || document.body;
    const size = chooseCanvasSize(parent); W = size[0]; H = size[1];
    p.resizeCanvas(W, H);
    starfield = makeStarfield(W, H, 420);
  };

  // ---------- Haze seeds ----------
  let hazePts = [];
  function initHazeSeeds() {
    hazePts = [];
    const rng = mulberry32(0xC0FFEE ^ 20250808);
    for (let i = 0; i < HAZE_COUNT; i++) {
      const r = (0.1 + 0.5 * Math.sqrt(rng())) * 0.48; // mostly inner half
      const th = rng() * p.TWO_PI;
      hazePts.push({ x: 0.5 + r * Math.cos(th), y: 0.5 + r * Math.sin(th), life: 200 + Math.floor(rng() * 300) });
    }
  }

  // ---------- Main draw ----------
  p.draw = () => {
    if (paused) return;

    const dt = p.deltaTime;
    tsec += dt / 1000;

    // Timeline
    ageYr = Math.min(AGE_END_YR, ageYr + speedYPS * (dt / 1000));
    if (ageYr >= AGE_END_YR) { ageYr = AGE_END_YR; paused = true; }

    // Perf autotune
    dtEMA = dtEMA * 0.9 + dt * 0.1;
    if (++frameCounter % 30 === 0) {
      if (dtEMA > 26 && activeCount > MIN_COUNT) activeCount = Math.max(MIN_COUNT, Math.floor(activeCount * 0.88));
      else if (dtEMA < 18 && activeCount < MAX_COUNT) activeCount = Math.min(MAX_COUNT, Math.floor(activeCount * 1.08));
    }

    // Backdrop
    p.background(4, 6, 10);
    drawStarfield(starfield, W, H);

    // World drift (manual rotation)
    yaw   += ROT_RATE * 0.9;
    pitch += ROT_RATE * 0.5;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = Math.cos(pitch), sx = Math.sin(pitch);

    // Sedov shell radius
    const Rpx   = sedovRadiusPx(ageYr, E51, n0, Math.min(W, H));
    const grow  = easeOutCubic(clamp((ageYr - AGE_START_YR) / GROW_YR, 0, 1));
    const morph = easeInOutSine(clamp((ageYr - AGE_START_YR) / MORPH_YR, 0, 1));

    // --- HAZE update & composite (ADD) ---
    advectHaze(haze, tsec);
    if (p.blendMode) p.blendMode(p.ADD);
    drawHazeToMain(haze, Rpx * 0.96);

    // Central ignition flash at very early times
    if (grow < 0.15) drawCoreFlash(grow);

    // Before drawing particles:
    const gl = p.drawingContext; // robust in p5 WEBGL
    if (gl && gl.disable) {
      gl.disable(gl.DEPTH_TEST);
      if (gl.depthMask) gl.depthMask(false);
    }


    p.noStroke();

    for (let i = 0; i < activeCount; i++) {
      const f = pts[i];

      // Curl-noise drift in object space, tangential only
      const c = curl3(f.dx, f.dy, f.dz, tsec * CURL_TIME, CURL_FREQ);
      const dotRC = f.dx * c.x + f.dy * c.y + f.dz * c.z;
      let tx = c.x - dotRC * f.dx, ty = c.y - dotRC * f.dy, tz = c.z - dotRC * f.dz;
      const mag = Math.hypot(tx, ty, tz) || 1; tx/=mag; ty/=mag; tz/=mag;
      let gain = CURL_GAIN * morph;     // fade in with time
      if (f.role === 1) gain *= 0.8;    // torus calmer
      if (f.role === 2) gain *= 0.5;    // jets more axial
      f.dx += gain * tx * (dt / 16);
      f.dy += gain * ty * (dt / 16);
      f.dz += gain * tz * (dt / 16);
      const invn = 1 / (Math.hypot(f.dx, f.dy, f.dz) || 1);
      f.dx *= invn; f.dy *= invn; f.dz *= invn;

      // Local anisotropy
      const cosTh = f.dy;
      const P2 = 0.5 * (3 * cosTh * cosTh - 1);
      const Rloc = Rpx * clamp(1 + (aniso * morph) * P2, 0.7, 1.6);

      // ---------- Shell position ----------
      // STATIC radial jitter (no time): fixes "lights turning on/off".
      const shellJitter = morph * f.rJit;        // precomputed at spawn
      const thickAmt    = SHELL_THICK * morph;

      // rFrac: 0 at inner edge, 1 at outer rim
      const rFrac   = clamp(1.0 - thickAmt * f.radU + shellJitter, 0, 1);
      const radius0 = Rloc * (0.65 + 0.35 * rFrac);
      const radius  = radius0 * grow;

      // Rotate to world (manual yaw then pitch)
      const x1 = f.dx * cy + f.dz * sy;
      const y1 = f.dy;
      const z1 = -f.dx * sy + f.dz * cy;
      const xw = x1;
      const yw = y1 * cx - z1 * sx;
      const zw = y1 * sx + z1 * cx;

      const px = radius * xw;
      const py = radius * yw;
      const pz = radius * zw;

      // trail (store last 2 positions)
      f.hx1 = f.hx0; f.hy1 = f.hy0; f.hz1 = f.hz0;
      f.hx0 = px;    f.hy0 = py;    f.hz0 = pz;

      const col = crabColor(f, radius0 / (Rpx + 1e-6), f.role);

      // ---------- Stable alpha profile (no time noise) ----------
      const e = rFrac; // 0 inner edge .. 1 outer rim
      const inner = Math.exp(-Math.pow(e / 0.22, 2));         // narrow inner lift
      const outer = Math.exp(-Math.pow((1 - e) / 0.40, 2));   // broad, gentle outer (wider, calmer)
      let alphaRaw = 34 + 200 * inner + 90 * outer;           // slightly stronger inner, gentler outer
      alphaRaw *= f.cl * f.cl;                                // static clump density
      alphaRaw = clamp(alphaRaw, 8, 255);

      // Slow smoothing only (no breathing/flicker)
      f.a = (f.a === undefined) ? alphaRaw : lerp(f.a, alphaRaw, 0.10);
      const alpha = f.a;

      const sz = 1.2 + 2.1 * f.len * (0.6 + 0.6 * e);

      // draw main sprite
      drawBillboard(px, py, pz, col.r, col.g, col.b, alpha, sz);
      // faint trail ghosts
      if (TRAIL_LEN >= 1 && f.hx1 !== undefined) {
        drawBillboard(f.hx1, f.hy1, f.hz1, col.r, col.g, col.b, alpha * 0.22, sz * 0.85);
      }
    }
    // After drawing particles:
    if (gl && gl.enable) {
      if (gl.depthMask) gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
    }

    // Subtle inner ring cue (readability)
    drawInnerRingOverlay(Rpx, grow);

    if (p.blendMode) p.blendMode(p.BLEND);
    drawVignette(W, H);
  };

  // ---------- Inner ring overlay ----------
  function drawInnerRingOverlay(Rpx, grow) {
    const Rin = Rpx * (1 - SHELL_THICK) * grow;
    if (Rin < 2) return;
    p.push();
    p.noFill();
    p.stroke(140, 240, 255, 22);
    p.strokeWeight(1.1);
    p.ellipse(0, 0, Rin * 2.02, Rin * 2.02);
    p.stroke(120, 220, 255, 12);
    p.ellipse(0, 0, Rin * 2.16, Rin * 2.16);
    p.pop();
  }

  // ---------- Billboard helper ----------
  function drawBillboard(x, y, z, r, g, b, a, s) {
    p.push();
    p.translate(x, y, z);
    p.fill(r, g, b, a);
    p.circle(0, 0, s);
    p.pop();
  }

  // ---------- Particle pool ----------
  function initPool() {
    pts = [];
    const rng = mulberry32(0xBEEFAB ^ 20250808);

    const nTorus = Math.floor(POOL_SIZE * FRACT_TORUS);
    const nJets  = Math.floor(POOL_SIZE * FRACT_JETS);
    const nShell = POOL_SIZE - nTorus - nJets;

    // Torus: around equator (y ~ 0)
    for (let i = 0; i < nTorus; i++) {
      const a = rng() * p.TWO_PI;
      const y = (rng() - 0.5) * 0.18;
      const x = Math.cos(a) * Math.sqrt(1 - y * y);
      const z = Math.sin(a) * Math.sqrt(1 - y * y);
      pushParticle({x, y, z}, 1, rng);
    }
    // Jets: two cones around ±Y
    for (let i = 0; i < nJets; i++) {
      const up = (i % 2 === 0) ? 1 : -1;
      const theta = Math.acos(clamp(up * (0.86 + 0.12 * rng()), -1, 1));
      const phi = rng() * p.TWO_PI;
      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.cos(theta);
      const z = Math.sin(theta) * Math.sin(phi);
      pushParticle({x, y, z}, 2, rng);
    }
    // Isotropic shell
    for (let i = 0; i < nShell; i++) {
      const s = sampleSphere(rng);
      pushParticle(s, 0, rng);
    }
  }

  function pushParticle(dir, role, rng) {
    const inv = 1 / (Math.hypot(dir.x, dir.y, dir.z) || 1);
    const dx = dir.x * inv, dy = dir.y * inv, dz = dir.z * inv;

    let baseHue = ((Math.atan2(dz, dx) / (2 * Math.PI)) + 0.5) * 360;
    baseHue += (rng() - 0.5) * 18;

    // random seeds for stable per-particle offsets
    const u = rng() * 10, v = rng() * 10;
    // STATIC clump density (no time dependency)
    const cl = 0.7 + 1.0 * p.noise(u * 0.8, v * 0.8, 1.23);
    // STATIC radial jitter (no time) — stops outer rim blinking
    const rJit = (p.noise(u * 0.6, v * 0.6, 0.5) - 0.5) * (SHELL_THICK * 0.45);

    pts.push({
      dx, dy, dz,
      role,
      radU: rng(),
      len: Math.pow(rng(), 0.8),
      u, v,
      hue: baseHue,
      cl,
      rJit,               // <— static
      hx0: 0, hy0: 0, hz0: 0,
      hx1: undefined, hy1: undefined, hz1: undefined,
      a: undefined
    });
  }

  // ---------- Synchrotron haze ----------
  function advectHaze(g, time) {
    g.push();
    g.noStroke();
    g.fill(0, 0, 0, (1 - HAZE_FADE) * 255);
    g.rect(0, 0, g.width, g.height);
    g.pop();

    g.push();
    g.strokeWeight(1);
    for (let i = 0; i < hazePts.length; i++) {
      const pnt = hazePts[i];
      const fx = p.noise((pnt.x + time * 0.05) * 3.2, (pnt.y - time * 0.05) * 3.2);
      const fy = p.noise((pnt.x - time * 0.05) * 3.2 + 100, (pnt.y + time * 0.05) * 3.2 + 100);
      const vx =  (fy - 0.5);
      const vy = -(fx - 0.5);

      const x0 = pnt.x * g.width, y0 = pnt.y * g.height;
      pnt.x += vx * (HAZE_SPEED / g.width);
      pnt.y += vy * (HAZE_SPEED / g.height);

      if (--pnt.life <= 0 || pnt.x < -0.1 || pnt.x > 1.1 || pnt.y < -0.1 || pnt.y > 1.1) {
        pnt.life = 200 + Math.floor(Math.random() * 300);
        const r = 0.05 + 0.25 * Math.sqrt(Math.random());
        const th = Math.random() * Math.PI * 2;
        pnt.x = 0.5 + r * Math.cos(th);
        pnt.y = 0.5 + r * Math.sin(th);
      }

      const x1 = pnt.x * g.width, y1 = pnt.y * g.height;
      g.stroke(120, 230 + Math.floor(25 * Math.sin(time + i)), 255, 40);
      g.line(x0, y0, x1, y1);
    }
    g.pop();
  }

  function drawHazeToMain(g, radiusPx) {
    p.push();
    p.resetMatrix();
    p.imageMode(p.CENTER);
    const s = radiusPx * 1.44;
    p.image(g, 0, 0, s, s);
    p.pop();
  }

  // ---------- Color (Crab-ish: cyan core -> copper filaments) ----------
  function crabColor(f, rNorm, role) {
    let coolBias = (role === 1 || role === 2) ? 0.15 : 0.0;
    const cool = [90, 230, 255];
    const warm = [255, 160,  80];
    const t = clamp(rNorm * 1.1 - 0.05 - coolBias, 0, 1);
    const r = Math.round(lerp(cool[0], warm[0], t));
    const g = Math.round(lerp(cool[1], warm[1], t));
    const b = Math.round(lerp(cool[2], warm[2], t));
    return { r, g, b };
  }

  // ---------- Curl noise in 3D ----------
  function curl3(x, y, z, t, freq) {
    const e = 0.1;
    const n = (a,b,c)=> p.noise((a + t) * freq, (b - t) * freq, (c + 0.37 * t) * freq);
    const dFy_dx = (n(x+e,y,z) - n(x-e,y,z)) / (2*e);
    const dFy_dz = (n(x,y,z+e) - n(x,y,z-e)) / (2*e);
    const dFz_dx = (n(z+e,x,y) - n(z-e,x,y)) / (2*e);
    const dFz_dy = (n(z,x+e,y) - n(z,x-e,y)) / (2*e);
    const dFx_dy = (n(y,x,z+e) - n(y,x,z-e)) / (2*e);
    const dFx_dz = (n(y,x+e,z) - n(y,x-e,z)) / (2*e);
    return { x: dFz_dy - dFy_dz, y: dFx_dz - dFz_dx, z: dFy_dx - dFx_dy };
  }

  // ---------- Starfield ----------
  function makeStarfield(w, h, seed) {
    const g = p.createGraphics(w, h);
    g.pixelDensity(1);
    g.background(6, 8, 12);
    const rng = mulberry32(seed);
    const N = Math.floor(420 + 240 * (w * h) / (1200 * 700));
    g.noStroke();
    for (let i = 0; i < N; i++) {
      const x = rng() * w, y = rng() * h, m = Math.pow(rng(), 3.2);
      const r = 120 + 135 * rng(), gg = 120 + 135 * rng(), b = 180 + 75 * rng(), a = 90 + 165 * m;
      g.fill(r, gg, b, a);
      const s = 0.6 + 2.8 * m;
      g.ellipse(x, y, s, s);
      if (m > 0.9) {
        g.fill(220, 220, 255, 50 + 80 * m);
        g.rect(x - s*1.2, y - 0.3, s*2.4, 0.6, 0.3);
        g.rect(x - 0.3,   y - s*1.2, 0.6, s*2.4, 0.3);
      }
    }
    return g;
  }
  function drawStarfield(g, w, h) {
    p.push(); p.resetMatrix(); p.imageMode(p.CORNER); p.image(g, -w/2, -h/2, w, h); p.pop();
  }

  function drawCoreFlash(grow) {
    p.push();
    p.noStroke();
    const s = 6 + 90 * grow * grow;
    for (let i = 0; i < 5; i++) {
      const k = 1 - i / 5;
      const a = 220 * k * (0.6 + 0.4 * Math.random()); // <- no extra ')'
      p.fill(235, 250, 255, a);
      p.ellipse(0, 0, s * (1 + i*0.6), s * (1 + i*0.6));
    }
    p.pop();
  }

  // ---------- Sedov scaling ----------
  function sedovRadiusPx(ageYears, E51, n0, base) {
    const t_kyr = Math.max(0.001, ageYears / 1000.0);
    const scale = 0.33 * base;
    const R = Math.pow(Math.max(1e-6, E51 / Math.max(1e-3, n0)), 0.2) * Math.pow(t_kyr, 0.4);
    return clamp(R * scale, 10, base * 0.50);
  }

  // ---------- UI ----------
  function hookControls() {
    const spd   = el('#js-neb-speed'); // years/sec
    const age   = el('#js-neb-age');   // years
    const e     = el('#js-neb-e');
    const dens  = el('#js-neb-n0');
    const ani   = el('#js-neb-aniso');
    const pauseBtn = el('#js-neb-pause');
    const reset = el('#js-neb-reset');

    if (spd)  spd.addEventListener('input', e => speedYPS = Math.max(0, +e.target.value));
    if (age)  age.addEventListener('input', e => { ageYr = clamp(+e.target.value, AGE_START_YR, AGE_END_YR); paused = false; });
    if (e)    e.addEventListener('input',   e => E51     = Math.max(0.05, +e.target.value));
    if (dens) dens.addEventListener('input',e => n0      = Math.max(0.05, +e.target.value));
    if (ani)  ani.addEventListener('input', e => aniso   = clamp(+e.target.value, 0, 0.8));

    if (pauseBtn) pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      if (!paused) p.loop();
    });

    if (reset) reset.addEventListener('click', () => {
      ageYr = AGE_START_YR; speedYPS = AUTO_SPEED_YPS; E51 = 1.0; n0 = 1.0; aniso = 0.22; paused = false;
      activeCount = 3200; dtEMA = 16.7; initPool(); initHazeSeeds();
      haze.clear();
    });
  }

  // ---------- Utils ----------
  function drawVignette(w, h) {
    p.push();
    p.resetMatrix();
    p.noStroke();
    for (let i = 0; i < 6; i++) {
      const a = 22 - i * 3.5;
      p.fill(0, 0, 0, a);
      p.rect(-w/2, -h/2, w, h, 22);
    }
    p.pop();
  }

  function chooseCanvasSize(parent){ return parent ? [parent.clientWidth, parent.clientHeight] : [window.innerWidth, window.innerHeight]; }
  function el(q){ return document.querySelector(q); }
  function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
  function easeInOutSine(x){ return -(Math.cos(Math.PI * x) - 1) / 2; }
  function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function sampleSphere(rng){
    let u=0,v=0,s=2; while(s>=1||s===0){ u=rng()*2-1; v=rng()*2-1; s=u*u+v*v; }
    const k=Math.sqrt(1-s); return { x:2*u*k, y:1-2*s, z:2*v*k };
  }
};