import * as THREE from 'three';

/**
 * Creates a factory payload compatible with prepareScene's cameraFactory option.
 * Useful for top-down orthographic scenes that need consistent resizing logic.
 *
 * @param {Object} params
 * @param {number|(() => number)} [params.extent=30] - Half-width of the viewable area or a function returning it.
 * @param {number} [params.height=60] - Camera height above the orbital plane.
 * @param {number} [params.margin=1.2] - Multiplier applied to the extent to create breathing room.
 * @param {THREE.Vector3|Array<number>} [params.lookAt=[0,0,0]]
 * @param {THREE.Vector3|Array<number>} [params.up=[0,0,-1]]
 * @param {Array<number>} [params.nearFar=[0.1, 400]]
 * @returns {{ camera: THREE.OrthographicCamera, onResize: ({width:number,height:number,dpr:number}) => void }}
 */
export function createOrthoTopDownCamera({
  extent = 30,
  height = 60,
  margin = 1.2,
  lookAt = [0, 0, 0],
  up = [0, 0, -1],
  nearFar = [0.1, 400],
} = {}) {
  const getExtent = typeof extent === 'function' ? extent : () => extent;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, nearFar[0] ?? 0.1, nearFar[1] ?? 400);
  camera.position.set(0, height, 0);
  const upVec = up instanceof THREE.Vector3 ? up : new THREE.Vector3(up[0] ?? 0, up[1] ?? 0, up[2] ?? -1);
  camera.up.copy(upVec);
  const lookAtVec =
    lookAt instanceof THREE.Vector3 ? lookAt : new THREE.Vector3(lookAt[0] ?? 0, lookAt[1] ?? 0, lookAt[2] ?? 0);
  camera.lookAt(lookAtVec);

  const onResize = ({ width = 1, height: h = 1 }) => {
    const baseExtent = getExtent();
    const frustum = baseExtent * margin;
    const aspect = width / h || 1;
    camera.left = -frustum * aspect;
    camera.right = frustum * aspect;
    camera.top = frustum;
    camera.bottom = -frustum;
    camera.updateProjectionMatrix();
  };

  return { camera, onResize };
}

/**
 * Builds a circular orbit ring as a THREE.LineLoop.
 *
 * @param {Object} params
 * @param {number} params.radius
 * @param {number} [params.segments=128]
 * @param {boolean} [params.dashed=true]
 * @param {number} [params.color=0xffffff]
 * @param {number} [params.opacity=0.45]
 * @param {number} [params.dashSize=1]
 * @param {number} [params.gapSize=0.8]
 * @returns {{ line: THREE.LineLoop, geometry: THREE.BufferGeometry, material: THREE.Material }}
 */
export function createOrbitRing({
  radius,
  segments = 128,
  dashed = true,
  color = 0xffffff,
  opacity = 0.45,
  dashSize = 1,
  gapSize = 0.8,
} = {}) {
  const positions = new Float32Array(Math.max(segments, 16) * 3);
  const segCount = positions.length / 3;
  for (let i = 0; i < segCount; i += 1) {
    const t = (i / segCount) * Math.PI * 2;
    positions[i * 3] = Math.cos(t) * radius;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(t) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize, gapSize, transparent: true, opacity })
    : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });

  const line = new THREE.LineLoop(geometry, material);
  if (dashed && line.computeLineDistances) line.computeLineDistances();

  return { line, geometry, material };
}

/**
 * Creates an elliptical orbit line (LineLoop) plus reusable position data.
 */
export function createEllipticalOrbit({
  semiMajor,
  semiMinor,
  segments = 256,
  offsetX = 0,
  offsetZ = 0,
  dashed = true,
  color = 0xffffff,
  opacity = 0.7,
  dashSize = 1.2,
  gapSize = 0.8,
} = {}) {
  const positions = new Float32Array(Math.max(segments, 32) * 3);
  const segCount = positions.length / 3;
  for (let i = 0; i < segCount; i += 1) {
    const t = (i / segCount) * Math.PI * 2;
    positions[i * 3] = Math.cos(t) * semiMajor + offsetX;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(t) * semiMinor + offsetZ;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize, gapSize, transparent: true, opacity })
    : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  const line = new THREE.LineLoop(geometry, material);
  if (dashed && line.computeLineDistances) line.computeLineDistances();
  return { line, geometry, material, positions };
}

/**
 * Creates a glowing star mesh with an embedded point light.
 */
export function createStar({
  radius = 1.2,
  color = 0xffffff,
  glowStrength = 1.6,
  intensity = 12,
  position = [0, 0, 0],
  roughness = 0.35,
  metalness = 0,
} = {}) {
  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: glowStrength,
    roughness,
    metalness,
  });
  const mesh = new THREE.Mesh(geometry, material);
  if (Array.isArray(position)) {
    mesh.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
  } else {
    mesh.position.copy(position);
  }

  const light = new THREE.PointLight(color, intensity, 0, 2);
  mesh.add(light);

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { mesh, light, dispose };
}

/**
 * Builds the faint circumbinary disc for visual reference.
 */
export function createBarycentricDisc({
  inner = 0,
  outer,
  color = 0xffffff,
  opacity = 0.06,
} = {}) {
  const radiusOuter = Math.max(inner + 0.001, outer);
  const geometry = new THREE.RingGeometry(Math.max(0.001, inner), radiusOuter, 128, 1);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  return { mesh, geometry, material };
}

/**
 * Simple additive atmosphere wrapper for planets.
 */
export function createAtmosphereShell({
  radius,
  color = 0x74d2ff,
  opacity = 0.18,
  intensity = 1,
} = {}) {
  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: opacity * intensity,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, geometry, material };
}

/**
 * Computes binary star positions in the orbital plane given a shared angle.
 */
export function computeBinaryPositions({ angle, radiusA, radiusB }) {
  const cosB = Math.cos(angle);
  const sinB = Math.sin(angle);
  return {
    starA: new THREE.Vector3(cosB * radiusA, 0, sinB * radiusA),
    starB: new THREE.Vector3(-cosB * radiusB, 0, -sinB * radiusB),
  };
}

/**
 * Returns the (x,z) coordinates for a body on an ellipse with optional focus offset.
 */
export function computeEllipticalPosition({ angle, semiMajor, semiMinor, focusOffset = 0 }) {
  return {
    x: Math.cos(angle) * semiMajor - focusOffset,
    z: Math.sin(angle) * semiMinor,
  };
}
