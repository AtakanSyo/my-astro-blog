// Test cases for the "Tests" popup on the Cosmological Lookback Time
// Calculator. These run the calculator's real cosmology.js functions.
// See angular-size-calculator's angularSizeTests.js for the pattern this
// follows.

import { hubbleTimeGyr, lookbackTimeGyr, ageOfUniverseTodayGyr } from "./cosmology";

export const COSMOLOGY_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const COSMOLOGY_TEST_SOURCES = [
  {
    title: "Standard (Planck-like) cosmological parameters",
    text: "Ωm = 0.315, ΩΛ = 0.685, H0 = 67.4 km/s/Mpc — commonly cited round figures close to the Planck Collaboration's 2018 best-fit values, used here to check that this module's numerical age-of-the-universe integral lands near the widely cited ≈13.8 billion year figure.",
  },
];

const TOLERANCE_PCT = 0.5;

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toFixed(digits)).toString();
}

const OM = 0.315;
const OL = 0.685;
const OK = 0;
const H0 = 67.4;

function referenceRows() {
  const tH = hubbleTimeGyr(H0);
  const age = ageOfUniverseTodayGyr(OM, OL, OK, H0);
  return [
    {
      test: "Hubble time 1/H0",
      inputs: `H0 = ${H0} km/s/Mpc`,
      expected: "≈ 14.5 Gyr (the commonly cited Hubble-time figure for this H0)",
      computed: `${fmt(tH, 3)} Gyr`,
      pass: percentDiff(tH, 14.5) < 1,
    },
    {
      test: "Age of the universe today (flat ΛCDM, Planck-like parameters)",
      inputs: `Ωm=${OM}, ΩΛ=${OL}, H0=${H0} km/s/Mpc`,
      expected: "≈ 13.8 Gyr (the widely cited current age of the universe)",
      computed: `${fmt(age, 4)} Gyr`,
      pass: percentDiff(age, 13.8) < TOLERANCE_PCT,
    },
  ];
}

function identityAndMonotonicityRows() {
  const t0 = lookbackTimeGyr(0, OM, OL, OK, H0);
  const t1 = lookbackTimeGyr(1, OM, OL, OK, H0);
  const t5 = lookbackTimeGyr(5, OM, OL, OK, H0);
  const t1000 = lookbackTimeGyr(1000, OM, OL, OK, H0);
  const age = ageOfUniverseTodayGyr(OM, OL, OK, H0);

  return [
    {
      test: "Lookback time to z = 0 is exactly zero",
      inputs: "z = 0",
      expected: "0 Gyr (light received now was emitted now)",
      computed: `${fmt(t0)} Gyr`,
      pass: t0 === 0,
    },
    {
      test: "Lookback time increases monotonically with z",
      inputs: "z = 1 vs. z = 5",
      expected: "t_L(1) < t_L(5)",
      computed: `${fmt(t1)} Gyr < ${fmt(t5)} Gyr`,
      pass: t1 < t5,
    },
    {
      test: "Lookback time to very high z approaches the universe's age",
      inputs: "z = 1000 (near the CMB's redshift)",
      expected: `→ close to, but below, the age of the universe (${fmt(age, 3)} Gyr)`,
      computed: `${fmt(t1000, 4)} Gyr`,
      pass: t1000 < age && percentDiff(t1000, age) < 0.1,
    },
  ];
}

function edgeCaseRows() {
  const negativeZ = lookbackTimeGyr(-1, OM, OL, OK, H0);
  const zeroH0 = lookbackTimeGyr(1, OM, OL, OK, 0);
  return [
    {
      test: "Negative redshift",
      inputs: "z = −1",
      expected: "null (z ≥ 0 is required)",
      computed: String(negativeZ),
      pass: negativeZ === null,
    },
    {
      test: "Zero Hubble constant",
      inputs: "H0 = 0",
      expected: "null (H0 > 0 is required)",
      computed: String(zeroH0),
      pass: zeroH0 === null,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getCosmologyTestRows() {
  return [...referenceRows(), ...identityAndMonotonicityRows(), ...edgeCaseRows()];
}
