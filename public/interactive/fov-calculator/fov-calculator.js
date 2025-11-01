
// ------------------------------------------------------
// Calculator logic
// ------------------------------------------------------
(function () {
  const $ = (id) => document.getElementById(id);

  const telFL = $("vfov-telescope-fl-mm");
  const telAp = $("vfov-telescope-ap-mm");
  const epFL  = $("vfov-eyepiece-fl-mm");
  const epAF  = $("vfov-eyepiece-afov-deg");

  const outMag   = $("vfov-out-mag");
  const outTFOV  = $("vfov-out-tfov");
  const outExit  = $("vfov-out-exit");
  const outNote  = $("vfov-note");
  const btnReset = $("vfov-reset");

  function n(el) {
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : null;
  }

  function compute() {
    const tfl = n(telFL);
    const tap = n(telAp);
    const efl = n(epFL);
    const afv = n(epAF);

    outNote.textContent = "";

    // Need at least telescope FL & eyepiece FL
    if (!tfl || !efl) {
      renderEmpty();
      outNote.textContent = "Enter telescope focal length and eyepiece focal length to compute magnification & TFOV.";
      return;
    }

    const mag  = tfl / efl;                 // magnification
    const tfov = afv ? (afv / mag) : null;  // degrees (if AFOV provided)
    const exit = (tap && mag) ? (tap / mag) : null; // mm (if aperture provided)

    outMag.textContent  = isFinite(mag) ? mag.toFixed(1) : "—";
    outTFOV.textContent = (tfov && isFinite(tfov)) ? tfov.toFixed(2) + "°" : "—";
    outExit.textContent = (exit && isFinite(exit)) ? exit.toFixed(1) + " mm" : "—";

    if (!afv) outNote.textContent = "Tip: Add eyepiece AFOV to see True Field of View (TFOV).";
    if (!tap) outNote.textContent = (outNote.textContent ? outNote.textContent + " " : "") + "Add telescope aperture to see exit pupil.";
  }

  function renderEmpty() {
    outMag.textContent  = "—";
    outTFOV.textContent = "—";
    outExit.textContent = "—";
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