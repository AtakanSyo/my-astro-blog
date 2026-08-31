import { describe, it, expect } from "vitest";
import {
  H,
  C,
  EV_TO_J,
  wavelengthToFrequency,
  wavelengthToEnergyJ,
  frequencyToWavelength,
  frequencyToEnergyJ,
  energyJToWavelength,
  energyJToFrequency,
  toBase,
  fromBase,
  ENERGY_UNITS,
  classifyBand,
} from "./physics";

describe("photon-energy-wavelength-frequency-converter", () => {
  it("matches the well-known ~2.48 eV energy of 500 nm (green) light", () => {
    const energyJ = wavelengthToEnergyJ(500e-9);
    const energyEV = fromBase(energyJ, ENERGY_UNITS, "eV");
    expect(energyEV).toBeCloseTo(2.48, 2);
  });

  it("round-trips wavelength -> frequency -> wavelength", () => {
    const lambda = 632.8e-9; // HeNe laser line
    const f = wavelengthToFrequency(lambda);
    expect(frequencyToWavelength(f)).toBeCloseTo(lambda, 15);
  });

  it("round-trips wavelength -> energy -> wavelength", () => {
    const lambda = 21.1e-2; // 21cm hydrogen line
    const e = wavelengthToEnergyJ(lambda);
    expect(energyJToWavelength(e)).toBeCloseTo(lambda, 10);
  });

  it("frequency and energy agree via E = hf regardless of path taken", () => {
    const lambda = 500e-9;
    const viaFreq = frequencyToEnergyJ(wavelengthToFrequency(lambda));
    const direct = wavelengthToEnergyJ(lambda);
    expect(viaFreq).toBeCloseTo(direct, 30);
    expect(energyJToFrequency(direct)).toBeCloseTo(wavelengthToFrequency(lambda), 6);
  });

  it("c = f * lambda holds for any wavelength", () => {
    const lambda = 1e-6;
    expect(wavelengthToFrequency(lambda) * lambda).toBeCloseTo(C, 0);
  });

  it("energy unit conversions round-trip (eV/keV/MeV)", () => {
    const j = toBase(1, ENERGY_UNITS, "MeV");
    expect(j / EV_TO_J).toBeCloseTo(1e6, 3);
    expect(fromBase(j, ENERGY_UNITS, "keV")).toBeCloseTo(1e3, 3);
  });

  it("classifies visible light and X-rays into their correct bands", () => {
    expect(classifyBand(500e-9).name).toBe("Visible");
    expect(classifyBand(1e-10).name).toBe("X-ray");
    expect(classifyBand(1e-2).name).toBe("Microwave");
    expect(classifyBand(10).name).toBe("Radio");
  });
});
