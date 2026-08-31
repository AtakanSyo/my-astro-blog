import { describe, it, expect } from "vitest";
import {
  rayleighLimitRad,
  dawesLimitRad,
  apertureToMeters,
  wavelengthToMeters,
  radiansToAngle,
  RESOLUTION_LANDMARKS,
  DAWES_ARCSEC_MM,
} from "./angularResolution";

describe("telescope-angular-resolution-calculator", () => {
  it("is in the same ballpark as the site's own Hubble Space Telescope landmark (~0.056 arcsec at 550nm)", () => {
    const aperture = apertureToMeters(2.4, "m");
    const wavelength = wavelengthToMeters(550, "nm");
    const rad = rayleighLimitRad(aperture, wavelength);
    const arcsec = radiansToAngle(rad, "arcsec");
    const hubbleLandmark = RESOLUTION_LANDMARKS.find((l) => l.label.includes("Hubble")).arcsec;
    // Within 5%, not tighter: the landmark is a separately-quoted reference
    // figure, not a recomputation of this exact formula at exactly 550nm —
    // the two differ by ~3% (see conversation notes), which is expected.
    expect(Math.abs(arcsec - hubbleLandmark) / hubbleLandmark).toBeLessThan(0.05);
  });

  it("matches a known 100mm amateur scope's resolution (~1.38 arcsec at 550nm)", () => {
    const aperture = apertureToMeters(100, "mm");
    const wavelength = wavelengthToMeters(550, "nm");
    const arcsec = radiansToAngle(rayleighLimitRad(aperture, wavelength), "arcsec");
    expect(arcsec).toBeCloseTo(1.38, 2);
  });

  it("a larger aperture always resolves finer detail (smaller angle)", () => {
    const wavelength = wavelengthToMeters(550, "nm");
    const small = rayleighLimitRad(apertureToMeters(50, "mm"), wavelength);
    const large = rayleighLimitRad(apertureToMeters(500, "mm"), wavelength);
    expect(large).toBeLessThan(small);
  });

  it("Rayleigh limit scales linearly with wavelength", () => {
    const aperture = apertureToMeters(200, "mm");
    const visible = rayleighLimitRad(aperture, wavelengthToMeters(550, "nm"));
    const infrared = rayleighLimitRad(aperture, wavelengthToMeters(1100, "nm"));
    expect(infrared / visible).toBeCloseTo(2, 9);
  });

  it("matches the well-known Dawes-limit rule of thumb (~116/D(mm) arcsec)", () => {
    const dMm = 116;
    const arcsec = radiansToAngle(dawesLimitRad(apertureToMeters(dMm, "mm")), "arcsec");
    expect(arcsec).toBeCloseTo(DAWES_ARCSEC_MM / dMm, 9);
    expect(arcsec).toBeCloseTo(1, 1); // ~116mm aperture resolves ~1 arcsec, the textbook rule of thumb
  });

  it("a bigger aperture gives a finer Dawes limit too", () => {
    const small = dawesLimitRad(apertureToMeters(60, "mm"));
    const large = dawesLimitRad(apertureToMeters(600, "mm"));
    expect(large).toBeLessThan(small);
  });
});
