import { describe, it, expect } from "vitest";
import {
  C,
  velocityClassical,
  velocityRelativistic,
  observedWavelengthClassical,
  observedWavelengthRelativistic,
  ratioClassical,
  ratioRelativistic,
} from "./doppler";

describe("doppler-radial-velocity-calculator", () => {
  it("round-trips rest+observed -> velocity -> observed (classical)", () => {
    const lamRest = 656.28; // H-alpha, nm
    const lamObs = 656.9;
    const v = velocityClassical(lamRest, lamObs);
    expect(observedWavelengthClassical(lamRest, v)).toBeCloseTo(lamObs, 9);
  });

  it("round-trips rest+observed -> velocity -> observed (relativistic)", () => {
    const lamRest = 656.28;
    const lamObs = 700; // large enough shift that relativistic and classical noticeably diverge
    const v = velocityRelativistic(lamRest, lamObs);
    expect(observedWavelengthRelativistic(lamRest, v)).toBeCloseTo(lamObs, 6);
  });

  it("classical and relativistic velocities agree for a small shift (v << c)", () => {
    const lamRest = 500;
    const lamObs = 500.01; // Δλ/λ ~ 2e-5, deep in the low-velocity regime
    const vClassical = velocityClassical(lamRest, lamObs);
    const vRel = velocityRelativistic(lamRest, lamObs);
    expect(vRel).toBeCloseTo(vClassical, 0); // within ~1 m/s at this shift
  });

  it("redshift (receding) gives positive velocity, blueshift (approaching) gives negative", () => {
    expect(velocityClassical(500, 501)).toBeGreaterThan(0);
    expect(velocityClassical(500, 499)).toBeLessThan(0);
  });

  it("ratio functions agree with the wavelength functions for the same beta", () => {
    const beta = 0.1;
    const v = beta * C;
    const lamRest = 500;
    expect(observedWavelengthRelativistic(lamRest, v) / lamRest).toBeCloseTo(ratioRelativistic(beta), 12);
    expect(observedWavelengthClassical(lamRest, v) / lamRest).toBeCloseTo(ratioClassical(beta), 12);
  });

  it("relativistic functions refuse to exceed the speed of light", () => {
    expect(observedWavelengthRelativistic(500, C)).toBeNull();
    expect(observedWavelengthRelativistic(500, 1.5 * C)).toBeNull();
    expect(ratioRelativistic(1)).toBeNull();
  });

  it("zero velocity means no shift at all", () => {
    expect(observedWavelengthClassical(500, 0)).toBe(500);
    expect(observedWavelengthRelativistic(500, 0)).toBeCloseTo(500, 12);
  });
});
