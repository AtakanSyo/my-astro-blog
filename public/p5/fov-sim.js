/* FOV & Magnification Simulator (p5.js)
   - Uses field-stop TFOV if provided; else AFOV/mag
   - Optionally caps TFOV by eyepiece barrel (1.25" ~27 mm, 2" ~46 mm)
   - Uniform star density; warns on impractical exit pupils
   - "Doesn't fit" overlay if target > TFOV
*/

let canvas, cx, cy, radius;
let stars = [];
const STAR_COUNT = 300;

let telF = 1200;     // telescope focal length (mm)
let apMM = 150;      // aperture (mm)
let epF = 25;        // eyepiece focal length (mm)
let afov = 50;       // eyepiece apparent field of view (deg)
let fieldStop = null;// eyepiece field stop (mm); null => unknown
let barrel = null;   // "1.25", "2", or null (unknown)
let target = 'Moon (0.5°)';

let mag = 0;
let tfov = 0;            // deg (actual, possibly capped)
let tfovRaw = 0;         // deg (before any barrel cap)
let tfovCapped = false;  // whether TFOV was capped by barrel
let exitPupil = 0;       // mm

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
  seedStars();
  bindControls();
  compute();
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

function seedStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    // uniform over disk: r = R * sqrt(U)
    const r = Math.sqrt(Math.random()) * radius;
    const a = Math.random() * TWO_PI;
    stars.push({
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
      b: 180 + Math.random() * 75
    });
  }
}

function compute() {
  mag = telF / epF;                         // Magnification
  const tfovFromAFOV = afov / mag;          // Approx TFOV from AFOV
  const tfovFromFS   = (fieldStop && fieldStop > 0)
    ? (57.2958 * fieldStop / telF)          // TFOV ≈ 57.3° * FS / F_telescope
    : null;

  tfovRaw = (tfovFromFS != null) ? tfovFromFS : tfovFromAFOV;

  // Optional barrel cap if field stop unknown or too large
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

  exitPupil = apMM / mag;                   // Exit pupil (mm)
  updateOutputs();
}

function updateOutputs() {
  const magEl  = document.getElementById('out-mag');
  const tfovEl = document.getElementById('out-tfov');
  const epEl   = document.getElementById('out-exitpupil');
  const warnEl = document.getElementById('out-warn');

  if (magEl)  magEl.textContent  = roundTo(mag, 1);
  if (tfovEl) tfovEl.textContent = roundTo(tfov, 2) + '°' + (tfovCapped ? ' (capped)' : '');
  if (epEl)   epEl.textContent   = roundTo(exitPupil, 1) + ' mm';

  if (warnEl) {
    let msg = '';
    if (exitPupil > 7) msg = 'Note: Exit pupil > ~7 mm (likely wasted aperture).';
    else if (exitPupil < 0.5) msg = 'Note: Exit pupil < ~0.5 mm (dim/diffraction-prone).';
    // Warn if AFOV/mag implies a field stop beyond barrel, when we capped
    if (tfovCapped) {
      msg = (msg ? msg + ' ' : '') + 'TFOV limited by selected barrel size.';
    }
    warnEl.textContent = msg;
  }
}

function draw() {
  background(10);

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
      fill(s.b);
      circle(s.x, s.y, 2);
    }
  }

  // target overlay
  const targetDeg = targets[target] ?? 0.5;
  if (tfov > 0) {
    const frac = targetDeg / tfov; // target diameter as fraction of TFOV diameter
    if (frac <= 1) {
      // fits: draw true-scaled circle
      stroke(200, 200, 255);
      strokeWeight(2);
      noFill();
      circle(cx, cy, radius * 2 * frac);
    } else {
      // doesn't fit: indicate at edge + label
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
  text(
    `Magnification: ${roundTo(mag, 1)}×\n` +
    `True FOV: ${roundTo(tfov, 2)}°${tfovCapped ? ' (capped)' : ''}\n` +
    `Exit pupil: ${roundTo(exitPupil, 1)} mm`,
    16, 12
  );
}

function bindControls() {
  const telFEl = document.getElementById('in-telF');
  const apEl   = document.getElementById('in-apMM');
  const epEl   = document.getElementById('in-epF');
  const afovEl = document.getElementById('in-afov');
  const fsEl   = document.getElementById('in-fieldstop'); // optional
  const barrelEl = document.getElementById('in-barrel');  // optional: "1.25" | "2"
  const targEl = document.getElementById('in-target');

  if (telFEl) telFEl.addEventListener('input', (e) => { telF = clampNum(+e.target.value, 200, 4000); compute(); redraw(); });
  if (apEl)   apEl.addEventListener('input', (e) => { apMM = clampNum(+e.target.value, 40, 500); compute(); redraw(); });
  if (epEl)   epEl.addEventListener('input', (e) => { epF = clampNum(+e.target.value, 2, 60); compute(); redraw(); });
  if (afovEl) afovEl.addEventListener('input', (e) => { afov = clampNum(+e.target.value, 30, 120); compute(); redraw(); });
  if (fsEl)   fsEl.addEventListener('input', (e) => { 
    const v = +e.target.value;
    fieldStop = (Number.isFinite(v) && v > 0) ? v : null;
    compute(); redraw(); 
  });
  if (barrelEl) barrelEl.addEventListener('change', (e) => { 
    const v = e.target.value;
    barrel = (v === "1.25" || v === "2") ? v : null;
    compute(); redraw(); 
  });
  if (targEl)  targEl.addEventListener('change', (e) => { target = e.target.value; redraw(); });

  // initialize displayed values (only if elements exist)
  if (telFEl) telFEl.value = telF;
  if (apEl)   apEl.value = apMM;
  if (epEl)   epEl.value = epF;
  if (afovEl) afovEl.value = afov;
  if (fsEl)   fsEl.value = fieldStop ?? '';
  if (barrelEl) barrelEl.value = barrel ?? '';
  if (targEl)  targEl.value = 'Moon (0.5°)';
}

function clampNum(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
function roundTo(x, n) {
  const p = Math.pow(10, n|0);
  return Math.round((x + Number.EPSILON) * p) / p;
}