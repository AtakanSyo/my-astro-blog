import { describe, it, expect } from "vitest";
import { transitProbability, starRadiusToMeters, distanceToMeters } from "./transitProbability";

describe("exoplanet-transit-probability-calculator", () => {
  it("matches Earth-Sun's known geometric transit probability (~0.47%)", () => {
    const rStar = starRadiusToMeters(1, "rsun");
    const a = distanceToMeters(1, "au");
    const p = transitProbability(rStar, 0, a); // planet radius negligible next to the Sun
    expect(p).toBeCloseTo(0.00465, 4);
  });

  it("eccentricity factor reduces to the circular-orbit formula at e=0", () => {
    const rStar = starRadiusToMeters(1, "rsun");
    const a = distanceToMeters(1, "au");
    const circular = transitProbability(rStar, 0, a);
    const eccentricAtZero = transitProbability(rStar, 0, a, 0, 1.2);
    expect(eccentricAtZero).toBeCloseTo(circular, 12);
  });

  it("probability falls off as 1/a", () => {
    const rStar = starRadiusToMeters(1, "rsun");
    const near = transitProbability(rStar, 0, distanceToMeters(1, "au"));
    const far = transitProbability(rStar, 0, distanceToMeters(2, "au"));
    expect(near / far).toBeCloseTo(2, 9);
  });

  it("including the planet's own radius raises the probability slightly", () => {
    const rStar = starRadiusToMeters(1, "rsun");
    const rPlanet = starRadiusToMeters(0.1, "rsun");
    const a = distanceToMeters(1, "au");
    const withoutPlanet = transitProbability(rStar, 0, a);
    const withPlanet = transitProbability(rStar, rPlanet, a);
    expect(withPlanet).toBeGreaterThan(withoutPlanet);
  });

  it("a planet transiting near periapsis (omega = 90deg) is more likely than at apoapsis", () => {
    const rStar = starRadiusToMeters(1, "rsun");
    const a = distanceToMeters(1, "au");
    const e = 0.5;
    const nearPeriapsis = transitProbability(rStar, 0, a, e, Math.PI / 2);
    const nearApoapsis = transitProbability(rStar, 0, a, e, -Math.PI / 2);
    expect(nearPeriapsis).toBeGreaterThan(nearApoapsis);
  });
});
