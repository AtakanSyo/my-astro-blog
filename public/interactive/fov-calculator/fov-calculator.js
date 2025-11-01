// public/fov-calc.js
// Simple Telescope Field of View (FOV) calculator
// Formulas:
//   FOV_w_deg = 57.2957795 * (sensor_w_mm / focal_len_mm)
//   FOV_h_deg = 57.2957795 * (sensor_h_mm / focal_len_mm)
//   FOV_d_deg = 57.2957795 * (sqrt(w^2 + h^2) / focal_len_mm)
//   pixel_scale_arcsec_per_px = 206.265 * (pixel_size_um / focal_len_mm)
// If pixel_size_um is empty but you provide sensor_w_mm and res_w_px,
//   pixel_size_um = (sensor_w_mm * 1000) / res_w_px

(function () {
  const $ = (id) => document.getElementById(id);

  const focalEl   = $("fov-focal-mm");
  const swEl      = $("fov-sensor-w-mm");
  const shEl      = $("fov-sensor-h-mm");
  const pxSizeEl  = $("fov-pixel-size-um");
  const resWEl    = $("fov-res-w-px");

  const outWDeg   = $("fov-out-w-deg");
  const outHDeg   = $("fov-out-h-deg");
  const outDDeg   = $("fov-out-d-deg");
  const outWMin   = $("fov-out-w-min");
  const outHMin   = $("fov-out-h-min");
  const outDMin   = $("fov-out-d-min");
  const outScale  = $("fov-out-scale");
  const outNote   = $("fov-note");

  function parseNum(el) {
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : null;
  }

  function compute() {
    const focal = parseNum(focalEl);
    const sw    = parseNum(swEl);
    const sh    = parseNum(shEl);
    let   pxum  = parseNum(pxSizeEl);
    const resW  = parseNum(resWEl);

    outNote.textContent = "";

    if (!focal || !sw || !sh) {
      renderEmpty();
      outNote.textContent = "Enter focal length and sensor size to compute FOV.";
      return;
    }

    const toDeg = (mm) => 57.2957795 * (mm / focal);

    const wDeg = toDeg(sw);
    const hDeg = toDeg(sh);
    const dDeg = toDeg(Math.hypot(sw, sh));

    outWDeg.textContent = wDeg.toFixed(2);
    outHDeg.textContent = hDeg.toFixed(2);
    outDDeg.textContent = dDeg.toFixed(2);

    outWMin.textContent = (wDeg * 60).toFixed(0);
    outHMin.textContent = (hDeg * 60).toFixed(0);
    outDMin.textContent = (dDeg * 60).toFixed(0);

    // Pixel scale
    if (!pxum && resW && sw) {
      pxum = (sw * 1000) / resW; // µm
      outNote.textContent = "Pixel size inferred from sensor width and resolution.";
    }

    if (pxum && focal) {
      const scale = 206.265 * (pxum / focal); // arcsec/pixel
      outScale.textContent = scale.toFixed(2);
    } else {
      outScale.textContent = "—";
      if (!outNote.textContent) {
        outNote.textContent = "Enter pixel size (µm) or resolution width to get pixel scale.";
      }
    }
  }

  function renderEmpty() {
    outWDeg.textContent = "—";
    outHDeg.textContent = "—";
    outDDeg.textContent = "—";
    outWMin.textContent = "—";
    outHMin.textContent = "—";
    outDMin.textContent = "—";
    outScale.textContent = "—";
  }

  // Wire up events
  [focalEl, swEl, shEl, pxSizeEl, resWEl].forEach((el) => {
    el && el.addEventListener("input", compute);
  });

  // Initial compute (in case you preload defaults)
  compute();
})();