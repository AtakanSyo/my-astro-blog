/* FOV & Magnification Simulator (p5.js)
   - Uses field-stop TFOV if provided; else AFOV/mag
   - Optionally caps TFOV by eyepiece barrel (1.25" ~27 mm, 2" ~46 mm)
   - Brightness scales with exit pupil vs. eye pupil (extended objects & sky)
   - Star size set by diffraction (≈138/D_mm) with seeing floor (arcsec)
   - Star counts respond to aperture & sky darkness
   - Target overlay now has translucent fill + HUD inset when tiny/too-large
*/

let canvas, cx, cy, radius;
let stars = [];
let lastStarCount = 0;

let telF = 1200;     // telescope focal length (mm)
let apMM = 150;      // aperture (mm)
let epF = 25;        // eyepiece focal length (mm)
let afov = 50;       // eyepiece apparent field of view (deg)
let fieldStop = null;// eyepiece field stop (mm); null => unknown
let barrel = null;   // "1.25", "2", or null (unknown)
let target = 'Moon (0.5°)';

// Optional physical knobs (bind if inputs exist)
let eyePupil = 7.0;        // mm (dark-adapted typical)
let seeingArcsec = 2.0;    // arcsec (typical mediocre seeing)

let mag = 0;
let tfov = 0;              // deg (actual, possibly capped)
let tfovRaw = 0;           // deg (before any barrel cap)
let tfovCapped = false;    // whether TFOV was capped by barrel
let exitPupil = 0;         // mm

// Derived visual variables
let effectiveExit = 0;     // min(exitPupil, eyePupil)
let bgScale = 1;           // 0..1, sky brightness scale vs. max
let bgGray = 40;           // background gray
let starDiaPx = 2;         // pixel diameter of star PSF

const targets = {
  'Moon (0.5°)': 0.5,
  'Orion Nebula ~1°': 1.0,
  'Pleiades ~2°': 2.0,
  'Andromeda ~3°': 3.0,
  'Jupiter ~0.008°': 0.008 // ~30 arcsec average, varies
};

function setup() {
  canvas = createCanvas(windowWidth, 360);
  canvas.parent('sketch-container');
  computeGeometry();
  compute();       // compute first so seedStars can use bgScale etc.
  seedStars();     // seed with a count that reflects current physics
  bindControls();
  noLoop(); // static render; call redraw() on changes
}

function windowResized() {
  resizeCanvas(windowWidth, 360);
  computeGeometry();
  seedStars();
  redraw();
}

function computeGeometry() {
  cx = width / 2;
  cy = height / 2;
  radius = Math.min(width, height) * 0.42;
}

function desiredStarCount() {
  const base = 220;
  const apFactor = Math.pow(Math.max(apMM, 40) / 100.0, 0.7);
  const skyFactor = 0.7 + 0.8 * (1 - bgScale);
  return Math.round(constrain(base * apFactor * skyFactor, 120, 900));
}

function seedStars() {
  const count = desiredStarCount();
  stars = [];
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * radius;
    const a = Math.random() * TWO_PI;
    stars.push({
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
      b: 170 + Math.random() * 85 // 170..255
    });
  }
  lastStarCount = count;
}

function compute() {
  // --- Core optics ---
  mag = telF / epF;
  const tfovFromAFOV = afov / mag;
  const tfovFromFS   = (fieldStop && fieldStop > 0)
    ? (57.2958 * fieldStop / telF)
    : null;

  tfovRaw = (tfovFromFS != null) ? tfovFromFS : tfovFromAFOV;

  // Optional barrel cap
  tfovCapped = false;
  const fsMax = (barrel === "1.25") ? 27.0 : (barrel === "2" ? 46.0 : null);
  if (fsMax != null) {
    const tfovCap = 57.2958 * fsMax / telF;
    if (tfovRaw > tfovCap + 1e-9) {
      tfov = tfovCap;
      tfovCapped = true;
    } else {
      tfov = tfovRaw;
    }
  } else {
    tfov = tfovRaw;
  }

  exitPupil = apMM / mag;

  // --- Visual model ---
  effectiveExit = Math.min(exitPupil, eyePupil);
  bgScale = (eyePupil > 0) ? Math.pow(effectiveExit / eyePupil, 2) : 1.0;
  bgGray = Math.round(8 + 42 * constrain(bgScale, 0, 1)); // 8..50

  // Diffraction + seeing
  const thetaArcsec = Math.max(seeingArcsec, 138.0 / Math.max(apMM, 1e-6));
  const thetaDeg = thetaArcsec / 3600.0;
  starDiaPx = (tfov > 0.0) ? Math.max(1.5, (thetaDeg / tfov) * (radius * 2)) : 2.0;
  starDiaPx = Math.min(starDiaPx, 6.0);

  updateOutputs();
}

function updateOutputs() {
  const magEl  = document.getElementById('out-mag');
  const tfovEl = document.getElementById('out-tfov');
  const epEl   = document.getElementById('out-exitpupil');
  const warnEl = document.getElementById('out-warn');

  const bgEl   = document.getElementById('out-sky');
  const blurEl = document.getElementById('out-blur');
  const tgtEl  = document.getElementById('out-target');

  if (magEl)  magEl.textContent  = roundTo(mag, 1);
  if (tfovEl) tfovEl.textContent = roundTo(tfov, 2) + '°' + (tfovCapped ? ' (capped)' : '');
  if (epEl)   epEl.textContent   = roundTo(exitPupil, 1) + ' mm';
  if (bgEl)   bgEl.textContent   = `${Math.round(100 * (1 - bgScale))}% darker sky vs. max`;
  if (blurEl) blurEl.textContent = `${roundTo(Math.max(seeingArcsec, 138.0 / Math.max(apMM, 1)), 1)}″ PSF`;

  if (tgtEl && tfov > 0) {
    const tdeg = targets[target] ?? 0.5;
    const fracPct = Math.round(100 * tdeg / tfov);
    tgtEl.textContent = `${tdeg}° (${fracPct}% of TFOV)`;
  }

  if (warnEl) {
    let msg = '';
    if (exitPupil > 7) msg = 'Note: Exit pupil > ~7 mm (likely wasted aperture).';
    else if (exitPupil < 0.5) msg = 'Note: Exit pupil < ~0.5 mm (dim/diffraction-prone).';
    if (tfovCapped) msg = (msg ? msg + ' ' : '') + 'TFOV limited by selected barrel size.';
    warnEl.textContent = msg;
  }
}

function draw() {
  background(bgGray);

  // outer eyepiece circle (TFOV ring)
  noFill();
  stroke(60);
  strokeWeight(2);
  circle(cx, cy, radius * 2);

  // starfield clipped to TFOV circle
  noStroke();
  for (const s of stars) {
    const d = dist(s.x, s.y, cx, cy);
    if (d <= radius) {
      const contrastBoost = 0.85 + 0.3 * (1 - bgScale);
      const shade = Math.round(constrain(s.b * contrastBoost, 130, 255));
      fill(shade);
      circle(s.x, s.y, starDiaPx);
    }
  }

  // target overlay — stronger visuals + HUD if tiny/too-large
  const targetDeg = targets[target] ?? 0.5;
  if (tfov > 0) {
    const frac = targetDeg / tfov; // target diameter fraction of TFOV diameter
    const diamPx = radius * 2 * frac;

    if (frac <= 1) {
      // Draw true-scaled translucent disk so area difference is obvious
      stroke(200, 220, 255);
      strokeWeight(2);
      fill(180, 200, 255, 45); // translucent fill
      circle(cx, cy, Math.max(0, diamPx));

      // If the target is too tiny to see, draw a HUD inset magnified
      const pixPerDeg = (radius * 2) / tfov;
      if (diamPx < 8) {
        drawTargetHUD(targetDeg, pixPerDeg, diamPx, false);
      }
    } else {
      // doesn't fit: keep edge + label and add HUD showing how much larger
      drawingContext.setLineDash([6, 6]);
      stroke(200, 200, 255);
      strokeWeight(2);
      noFill();
      circle(cx, cy, radius * 2);
      drawingContext.setLineDash([]);
      noStroke();
      fill(255, 180, 180);
      textAlign(CENTER, BOTTOM);
      text('Target larger than your TFOV', cx, cy - 12);

      const pixPerDeg = (radius * 2) / tfov;
      drawTargetHUD(targetDeg, pixPerDeg, diamPx, true);
    }
  }

  // crosshair + label
  stroke(120);
  strokeWeight(1);
  line(cx - 10, cy, cx + 10, cy);
  line(cx, cy - 10, cx, cy + 10);
  noStroke();
  fill(230);
  textAlign(CENTER, TOP);
  textSize(14);
  text(target, cx, cy + 8);

  // legend
  noStroke();
  fill(220);
  textAlign(LEFT, TOP);
  textSize(13);
  const seeingShown = roundTo(Math.max(seeingArcsec, 138.0 / Math.max(apMM, 1)), 1);
  const tdeg = targets[target] ?? 0.5;
  const coverage = (tfov > 0) ? Math.round(100 * tdeg / tfov) : 0;
  text(
    `Magnification: ${roundTo(mag, 1)}×\n` +
    `True FOV: ${roundTo(tfov, 2)}°${tfovCapped ? ' (capped)' : ''}\n` +
    `Exit pupil: ${roundTo(exitPupil, 1)} mm\n` +
    `Sky: ${Math.round(100 * (1 - bgScale))}% darker vs. max\n` +
    `Star blur: ~${seeingShown}″\n` +
    `Target: ${tdeg}° (${coverage}% of TFOV)`,
    16, 12
  );
}

// Draws a little HUD in the top-right that magnifies the target circle
// tinyMode=false: show tiny target magnified
// tinyMode=true: show "too large" with percent overfill
function drawTargetHUD(targetDeg, pixPerDeg, diamPx, tooLarge) {
  const pad = 10;
  const boxW = 150, boxH = 100;
  const x0 = width - boxW - pad;
  const y0 = pad;

  // box
  noStroke();
  fill(0, 0, 0, 120);
  rect(x0, y0, boxW, boxH, 8);

  // title
  fill(230);
  textAlign(LEFT, TOP);
  textSize(12);
  text(tooLarge ? 'Target (too large)' : 'Target (magnified)', x0 + 8, y0 + 6);

  // content area
  const cxh = x0 + boxW/2, cyh = y0 + boxH/2 + 8;
  const maxDraw = Math.min(boxW, boxH) - 28;
  const scale = tooLarge
    ? Math.min(30, maxDraw / Math.max(10, diamPx))     // tame huge overfill
    : Math.min(30, maxDraw / Math.max(1, diamPx));     // magnify tiny target
  const shownDiam = diamPx * scale;

  // target circle
  stroke(200, 220, 255);
  strokeWeight(2);
  fill(180, 200, 255, 55);
  circle(cxh, cyh, shownDiam);

  // label
  noStroke();
  fill(220);
  textAlign(CENTER, TOP);
  textSize(11);
  if (tfov > 0) {
    const coverage = Math.round(100 * (targetDeg / tfov));
    const scaleTxt = (scale > 1.05) ? ` ×${roundTo(scale,1)}` : '';
    const label = tooLarge
      ? `${coverage}% of TFOV (over)`
      : `${coverage}% of TFOV${scaleTxt}`;
    text(label, cxh, y0 + boxH - 18);
  }
}

function bindControls() {
  const telFEl = document.getElementById('in-telF');
  const apEl   = document.getElementById('in-apMM');
  const epEl   = document.getElementById('in-epF');
  const afovEl = document.getElementById('in-afov');
  const fsEl   = document.getElementById('in-fieldstop'); // optional
  const barrelEl = document.getElementById('in-barrel');  // optional: "1.25" | "2"
  const targEl = document.getElementById('in-target');
  const eyeEl  = document.getElementById('in-eyePupil');  // optional (mm)
  const seeEl  = document.getElementById('in-seeing');     // optional (arcsec)

  const recomputeAndRedraw = (doReseed=false) => {
    compute();
    if (doReseed) seedStars();
    redraw();
  };

  if (telFEl) telFEl.addEventListener('input', (e) => { telF = clampNum(+e.target.value, 200, 4000); recomputeAndRedraw(false); });
  if (apEl)   apEl.addEventListener('input', (e) => { apMM = clampNum(+e.target.value, 40, 500);   recomputeAndRedraw(true);  });
  if (epEl)   epEl.addEventListener('input', (e) => { epF = clampNum(+e.target.value, 2, 60);      recomputeAndRedraw(true);  });
  if (afovEl) afovEl.addEventListener('input', (e) => { afov = clampNum(+e.target.value, 30, 120); recomputeAndRedraw(true);  });
  if (fsEl)   fsEl.addEventListener('input', (e) => { 
    const v = +e.target.value;
    fieldStop = (Number.isFinite(v) && v > 0) ? v : null;
    recomputeAndRedraw(false);
  });
  if (barrelEl) barrelEl.addEventListener('change', (e) => { 
    const v = e.target.value;
    barrel = (v === "1.25" || v === "2") ? v : null;
    recomputeAndRedraw(false);
  });
  if (targEl)  targEl.addEventListener('change', (e) => { target = e.target.value; redraw(); });

  if (eyeEl)   eyeEl.addEventListener('input', (e) => { eyePupil = clampNum(+e.target.value, 2, 8); recomputeAndRedraw(true); });
  if (seeEl)   seeEl.addEventListener('input', (e) => { seeingArcsec = clampNum(+e.target.value, 0.5, 5); recomputeAndRedraw(false); });

  // initialize displayed values (only if elements exist)
  if (telFEl) telFEl.value = telF;
  if (apEl)   apEl.value = apMM;
  if (epEl)   epEl.value = epF;
  if (afovEl) afovEl.value = afov;
  if (fsEl)   fsEl.value = fieldStop ?? '';
  if (barrelEl) barrelEl.value = barrel ?? '';
  if (targEl)  targEl.value = 'Moon (0.5°)';
  if (eyeEl)   eyeEl.value = eyePupil;
  if (seeEl)   seeEl.value = seeingArcsec;
}

function clampNum(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
function roundTo(x, n) {
  const p = Math.pow(10, n|0);
  return Math.round((x + Number.EPSILON) * p) / p;
}