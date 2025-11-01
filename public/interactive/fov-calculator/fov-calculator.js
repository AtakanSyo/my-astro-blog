// public/visual-fov.js
// Beginner Visual FOV Calculator (visual observing)
// Inputs: telescope FL (mm), telescope aperture (mm), eyepiece FL (mm), eyepiece AFOV (deg)
// Outputs: Magnification, True FOV (deg), Exit Pupil (mm), Max Magnification (×)

(function () {
  const $ = (id) => document.getElementById(id);

  const telFL = $("vfov-telescope-fl-mm");
  const telAp = $("vfov-telescope-ap-mm");
  const epFL  = $("vfov-eyepiece-fl-mm");
  const epAF  = $("vfov-eyepiece-afov-deg");

  const outMag    = $("vfov-out-mag");
  const outTFOV   = $("vfov-out-tfov");
  const outExit   = $("vfov-out-exit");
  const outMaxMag = $("vfov-out-maxmag"); // NEW
  const outNote   = $("vfov-note");
  const btnReset  = $("vfov-reset");

  function n(el) {
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : null;
  }

  function compute() {
  const tfl = n(telFL);   // telescope focal length
  const tap = n(telAp);   // telescope aperture
  const efl = n(epFL);    // eyepiece focal length
  const afv = n(epAF);    // eyepiece AFOV

  outNote.textContent = "";

  // ✅ Max magnification now depends ONLY on aperture
  if (tap) {
    const maxMag = Math.min(2.5 * tap, 350);  // Rule of thumb, capped
    outMaxMag.textContent = `${Math.round(maxMag)}×`;
  } else {
    outMaxMag.textContent = "—";
  }

  // If no FL or eyepiece FL, still calculate max mag, but skip other results
  if (!tfl || !efl) {
    outMag.textContent  = "—";
    outTFOV.textContent = "—";
    outExit.textContent = "—";

    if (!tap) {
      outNote.textContent = "Enter your telescope aperture (mm) to see max magnification.";
    } else {
      outNote.textContent = "Add focal length + eyepiece focal length to compute magnification and TFOV.";
    }

    return;
  }

  // Magnification (needs telescope FL + eyepiece FL)
  const mag = tfl / efl;
  outMag.textContent = mag.toFixed(1);

  // True FOV (needs AFOV)
  const tfov = afv ? (afv / mag) : null;
  outTFOV.textContent = tfov ? `${tfov.toFixed(2)}°` : "—";

  // Exit pupil (needs aperture)
  const exit = tap ? (tap / mag) : null;
  outExit.textContent = exit ? `${exit.toFixed(1)} mm` : "—";

  // Context note
  if (!afv) outNote.textContent = "Add eyepiece AFOV to see True Field of View.";
  if (!tap) outNote.textContent += " Add aperture to see exit pupil.";
}

  function renderEmpty() {
    outMag.textContent    = "—";
    outTFOV.textContent   = "—";
    outExit.textContent   = "—";
    outMaxMag.textContent = "—";
  }

  [telFL, telAp, epFL, epAF].forEach((el) => el && el.addEventListener("input", compute));

  if (btnReset) {
    btnReset.addEventListener("click", () => {
      [telFL, telAp, epFL, epAF].forEach((el) => (el.value = ""));
      compute();
    });
  }

  // Initial run
  compute();
})();