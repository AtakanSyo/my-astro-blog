// True field of view: how much actual sky an eyepiece shows, not how
// much it magnifies. Two ways to get there:
//
//   1. The simple method, from the eyepiece's published apparent field:
//
//        TFOV ≈ AFOV / M          where M = telescope focal length
//                                        / eyepiece focal length
//
//      Fast, and fine for most eyepieces — but AFOV as printed on a spec
//      sheet is often a rounded, sometimes marketing-inflated number,
//      and for wide-angle designs with real optical distortion it can
//      diverge non-trivially from what the eyepiece's own hardware
//      actually admits.
//
//   2. The field-stop method, from a physical measurement inside the
//      eyepiece barrel — the field stop, a fixed aperture that defines
//      the edge of the view independent of any manufacturer spec:
//
//        TFOV = 57.2958 × field stop (mm) / telescope focal length (mm)
//
//      57.2958 = 180/π, converting the small-angle relation
//      (field stop / F, in radians) to degrees. This is the one to
//      trust when it's available.
//
// Both are exposed here so the calculator can show whichever inputs are
// known, and the gap between them when both are.

export const RAD_TO_DEG = 180 / Math.PI;

/** Magnification M = F/f. Both in the same length unit (mm here). */
export function magnification(F_mm, f_mm) {
  if (!(F_mm > 0) || !(f_mm > 0)) return null;
  return F_mm / f_mm;
}

/** True field (degrees) from the eyepiece's apparent field and magnification. */
export function tfovSimpleDeg(AFOV_deg, M) {
  if (!(AFOV_deg > 0) || !(M > 0)) return null;
  return AFOV_deg / M;
}

/** True field (degrees) from the eyepiece's physical field stop and the telescope's focal length. */
export function tfovFieldStopDeg(fieldStop_mm, F_mm) {
  if (!(fieldStop_mm > 0) || !(F_mm > 0)) return null;
  return RAD_TO_DEG * (fieldStop_mm / F_mm);
}

export function degToArcmin(deg) {
  return deg * 60;
}

// Well-established apparent angular sizes for a handful of classic
// naked-eye/small-telescope targets, used to draw the "does it fit"
// overlay. These are catalog/commonly-cited full extents, not the
// (usually smaller) brightest visible core — see each object's note.
// Sources: NASA/JPL (Moon), NED/RC3 and Messier catalog compilations
// (M31, M42, M45), and standard open-cluster references (NGC 869/884).
export const DEEP_SKY_OBJECTS = [
  {
    key: "moon",
    label: "The Moon",
    color: "#d8d8d8",
    shape: "circle",
    diameterDeg: 0.518,
    note: "average apparent diameter",
  },
  {
    key: "pleiades",
    label: "Pleiades (M45)",
    color: "#8fd0ff",
    shape: "circle",
    diameterDeg: 1.83,
    note: "full naked-eye cluster extent (≈110′)",
  },
  {
    key: "orion",
    label: "Orion Nebula (M42)",
    color: "#ff9ecf",
    shape: "ellipse",
    majorDeg: 1.083,
    minorDeg: 1.0,
    note: "bright nebulosity extent (≈65′×60′)",
  },
  {
    key: "andromeda",
    label: "Andromeda Galaxy (M31)",
    color: "#ffcf7f",
    shape: "ellipse",
    majorDeg: 3.167,
    minorDeg: 1.0,
    note: "full cataloged extent (≈190′×60′) — the bright core alone looks much smaller",
  },
  {
    key: "doublecluster",
    label: "Double Cluster (NGC 869/884)",
    color: "#b5ff9e",
    shape: "double",
    diameterDeg: 0.5,
    separationDeg: 0.5,
    note: "each cluster ≈30′ across, centers ≈30′ apart",
  },
];
