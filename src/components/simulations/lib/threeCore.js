import * as THREE from 'three';

/**
 * Creates a renderer, scene, and camera trio with consistent defaults.
 * Handles resize/DPR management and exposes control over the animation loop.
 *
 * @param {Object} params
 * @param {HTMLCanvasElement} params.canvas - Target canvas element.
 * @param {HTMLElement} [params.container] - Element used for sizing (defaults to canvas parent).
 * @param {number|THREE.Color|null} [params.background=0x000000] - Scene background. Set to null to keep transparent.
 * @param {Object} [params.cameraConfig] - Optional camera overrides.
 * @param {number} [params.cameraConfig.fov=60]
 * @param {number} [params.cameraConfig.near=0.1]
 * @param {number} [params.cameraConfig.far=2000]
 * @param {Array|Object} [params.cameraConfig.position={x:0,y:0,z:5}]
 * @param {Array|Object} [params.cameraConfig.lookAt]
 * @param {() => {camera: THREE.Camera, onResize?: ({width:number,height:number,dpr:number}) => void}} [params.cameraFactory]
 * @param {number} [params.dprCap=1.5] - Maximum device pixel ratio to render at.
 * @param {boolean} [params.alpha=true] - Whether the renderer should preserve alpha.
 * @param {boolean} [params.antialias=true] - Whether to enable antialiasing.
 * @returns {{
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   renderer: THREE.WebGLRenderer,
 *   textureLoader: THREE.TextureLoader,
 *   start: (cb?: (delta: number, elapsed: number) => void) => void,
 *   stop: () => void,
 *   renderOnce: () => void,
 *   updateSize: () => void,
 *   dispose: () => void,
 *   clock: THREE.Clock,
 * }}
 */
export function prepareScene({
  canvas,
  container,
  background = 0x000000,
  cameraConfig = {},
  dprCap = 1.5,
  alpha = true,
  antialias = true,
  cameraFactory,
} = {}) {
  if (!canvas) {
    throw new Error('prepareScene requires a canvas element.');
  }

  const sizingElement = container ?? canvas.parentElement ?? canvas;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias,
    alpha,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.physicallyCorrectLights = true;

  const scene = new THREE.Scene();
  if (background !== null && background !== undefined) {
    scene.background =
      background instanceof THREE.Color ? background : new THREE.Color(background);
  }

  let camera;
  let customResize;

  if (typeof cameraFactory === 'function') {
    const result = cameraFactory();
    if (!result || !result.camera) {
      throw new Error('cameraFactory must return an object with a camera property.');
    }
    camera = result.camera;
    customResize = result.onResize;
  } else {
    camera = new THREE.PerspectiveCamera(
      cameraConfig.fov ?? 60,
      1,
      cameraConfig.near ?? 0.1,
      cameraConfig.far ?? 2000,
    );

    const cameraPos = cameraConfig.position ?? { x: 0, y: 0, z: 5 };
    if (Array.isArray(cameraPos)) {
      camera.position.set(cameraPos[0] ?? 0, cameraPos[1] ?? 0, cameraPos[2] ?? 5);
    } else {
      camera.position.set(
        cameraPos.x ?? 0,
        cameraPos.y ?? 0,
        cameraPos.z ?? 5,
      );
    }

    if (cameraConfig.lookAt) {
      const lookTarget = Array.isArray(cameraConfig.lookAt)
        ? new THREE.Vector3(
            cameraConfig.lookAt[0] ?? 0,
            cameraConfig.lookAt[1] ?? 0,
            cameraConfig.lookAt[2] ?? 0,
          )
        : new THREE.Vector3(
            cameraConfig.lookAt.x ?? 0,
            cameraConfig.lookAt.y ?? 0,
            cameraConfig.lookAt.z ?? 0,
          );
      camera.lookAt(lookTarget);
    }
  }

  const textureLoader = new THREE.TextureLoader();
  let resizeObserver;

  const updateSize = () => {
    if (!sizingElement) return;
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    const width = Math.max(1, sizingElement.clientWidth);
    const height = Math.max(1, sizingElement.clientHeight);
    renderer.setSize(width, height, false);
    if (customResize) {
      customResize({ width, height, dpr });
    } else {
      camera.aspect = width / height || 1;
      camera.updateProjectionMatrix();
    }
  };

  if (typeof ResizeObserver !== 'undefined' && sizingElement) {
    resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(sizingElement);
  }

  window.addEventListener('resize', updateSize, { passive: true });
  requestAnimationFrame(updateSize);

  const clock = new THREE.Clock();
  let rafId = 0;
  let running = false;
  let frameCallback =
    /** @type {(delta: number, elapsed: number) => void | undefined} */ (undefined);

  const loop = () => {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;
    if (frameCallback) frameCallback(delta, elapsed);
    renderer.render(scene, camera);
  };

  const start = (cb) => {
    frameCallback = cb ?? frameCallback;
    if (running) return;
    running = true;
    clock.getDelta(); // reset delta to avoid jump
    rafId = requestAnimationFrame(loop);
  };

  const stop = () => {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const renderOnce = () => {
    renderer.render(scene, camera);
  };

  const dispose = () => {
    stop();
    window.removeEventListener('resize', updateSize);
    try {
      resizeObserver?.disconnect();
    } catch {
      // ignore
    }
    renderer.dispose();
  };

  return {
    scene,
    camera,
    renderer,
    textureLoader,
    start,
    stop,
    renderOnce,
    updateSize,
    dispose,
    clock,
  };
}

/**
 * Convenience factory for a top-down orthographic camera that plugs into prepareScene's cameraFactory.
 * @param {Object} params
 * @param {number|(() => number)} [params.extent=20] - Half-width of the visible area or dynamic getter.
 * @param {number} [params.height=50] - Camera height above the plane (y-axis).
 * @param {number} [params.margin=1.1] - Multiplier applied to extent to give framing padding.
 * @param {Array|THREE.Vector3} [params.lookAt=[0,0,0]]
 * @param {Array|THREE.Vector3} [params.up=[0,0,-1]]
 * @param {number} [params.near=0.1]
 * @param {number} [params.far=500]
 * @returns {{camera: THREE.OrthographicCamera, onResize: ({width:number,height:number,dpr:number}) => void}}
 */
export function createTopDownOrthoCamera({
  extent = 20,
  height = 50,
  margin = 1.1,
  lookAt = [0, 0, 0],
  up = [0, 0, -1],
  near = 0.1,
  far = 500,
  position,
} = {}) {
  const getExtent = typeof extent === 'function' ? extent : () => extent;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, near, far);
  if (position) {
    if (position instanceof THREE.Vector3) {
      camera.position.copy(position);
    } else if (Array.isArray(position)) {
      camera.position.set(position[0] ?? 0, position[1] ?? height, position[2] ?? 0);
    } else {
      camera.position.set(position.x ?? 0, position.y ?? height, position.z ?? 0);
    }
  } else {
    camera.position.set(0, height, 0);
  }
  const upVec = up instanceof THREE.Vector3 ? up : new THREE.Vector3(up[0] ?? 0, up[1] ?? 0, up[2] ?? -1);
  camera.up.copy(upVec);
  const lookAtVec =
    lookAt instanceof THREE.Vector3 ? lookAt : new THREE.Vector3(lookAt[0] ?? 0, lookAt[1] ?? 0, lookAt[2] ?? 0);
  camera.lookAt(lookAtVec);

  const onResize = ({ width = 1, height: h = 1 }) => {
    const base = getExtent();
    const frustum = base * margin;
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
 * Adds a textured sphere to the scene and returns helpers to animate & clean it up.
 *
 * @param {THREE.Scene} scene - Scene to attach the planet to.
 * @param {Object} params
 * @param {string} params.textureUrl - Texture path (e.g. from public/).
 * @param {Array|Object} [params.position=[0,0,0]] - Position of the sphere.
 * @param {number} [params.radius=1] - Sphere radius.
 * @param {number} [params.spinSpeed=0.3] - Spin speed in radians per second.
 * @param {Array|THREE.Vector3} [params.spinAxis=[0,1,0]] - Axis to rotate around.
 * @param {number} [params.tiltDeg=0] - Optional axial tilt to apply (degrees).
 * @param {number} [params.segments=64] - Sphere segment detail.
 * @param {Object} [params.materialOptions] - Extra MeshStandardMaterial options.
 * @param {THREE.TextureLoader} [params.textureLoader] - Loader instance (defaults to new loader).
 * @param {THREE.WebGLRenderer} [params.renderer] - Renderer for querying anisotropy.
 * @returns {{
 *   mesh: THREE.Mesh,
 *   update: (delta: number) => void,
 *   dispose: () => void,
 *   texture: THREE.Texture,
 *   material: THREE.Material,
 * }}
 */
export function addSpinningPlanet(
  scene,
  {
    textureUrl,
    color = '#ffffff',
    luminosity = 1.2,
    position = [0, 0, 0],
    radius = 1,
    spinSpeed = 0.3,
    spinAxis = [0, 1, 0],
    tiltDeg = 0,
    segments = 64,
    materialOptions = {},
    textureLoader,
    renderer,
  } = {},
) {
  if (!scene) {
    throw new Error('addSpinningPlanet requires a THREE.Scene instance.');
  }
  const loader = textureLoader ?? new THREE.TextureLoader();
  let texture;
  let material;

  if (textureUrl) {
    texture = loader.load(textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (renderer?.capabilities?.getMaxAnisotropy) {
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
      ...materialOptions,
    });
  } else {
    const emissiveCol = new THREE.Color(color);
    const baseColor = emissiveCol.clone().multiplyScalar(0.35);
    material = new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: emissiveCol,
      emissiveIntensity: luminosity,
      roughness: 0.1,
      metalness: 0,
      ...materialOptions,
    });
  }

  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  const mesh = new THREE.Mesh(geometry, material);

  if (Array.isArray(position)) {
    mesh.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
  } else {
    mesh.position.set(
      position.x ?? 0,
      position.y ?? 0,
      position.z ?? 0,
    );
  }

  if (tiltDeg) {
    mesh.rotation.z = THREE.MathUtils.degToRad(tiltDeg);
  }

  scene.add(mesh);

  const axis = spinAxis instanceof THREE.Vector3
    ? spinAxis.clone().normalize()
    : new THREE.Vector3(
        Array.isArray(spinAxis) ? spinAxis[0] ?? 0 : spinAxis.x ?? 0,
        Array.isArray(spinAxis) ? spinAxis[1] ?? 1 : spinAxis.y ?? 1,
        Array.isArray(spinAxis) ? spinAxis[2] ?? 0 : spinAxis.z ?? 0,
      ).normalize();

  const update = (delta) => {
    if (!delta) return;
    const angle = spinSpeed * delta;
    if (angle !== 0) {
      mesh.rotateOnAxis(axis, angle);
    }
  };

  const dispose = () => {
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
    texture?.dispose?.();
  };

  return {
    mesh,
    update,
    dispose,
    texture,
    material,
  };
}

/**
 * Adds Saturn with ring geometry and returns helpers to animate & clean it up.
 *
 * @param {THREE.Scene} scene
 * @param {Object} params
 * @param {string} params.textureUrl - Planet texture.
 * @param {string} params.ringTextureUrl - Ring texture with alpha.
 * @param {Array|Object} [params.position=[0,0,0]] - Planet position.
 * @param {number} [params.radius=1] - Planet radius.
 * @param {number} [params.spinSpeed=0.3] - Planet spin in radians per second.
 * @param {Array|THREE.Vector3} [params.spinAxis=[0,1,0]] - Rotation axis.
 * @param {number} [params.tiltDeg=26.7] - Axial tilt to apply to both planet and rings.
 * @param {number} [params.ringInnerScale=1.2] - Inner radius multiplier relative to planet radius.
 * @param {number} [params.ringOuterScale=2.3] - Outer radius multiplier relative to planet radius.
 * @param {number} [params.ringAngle=0] - Initial ring angle in degrees around the spin axis.
 * @param {number} [params.segments=64] - Sphere resolution.
 * @param {Object} [params.materialOptions] - Planet material overrides.
 * @param {Object} [params.ringMaterialOptions] - Ring material overrides.
 * @param {THREE.TextureLoader} [params.textureLoader]
 * @param {THREE.WebGLRenderer} [params.renderer]
 * @returns {{
 *   planetMesh: THREE.Mesh,
 *   ringMesh: THREE.Mesh,
 *   update: (delta: number) => void,
 *   dispose: () => void,
 *   planetTexture: THREE.Texture,
 *   ringTexture: THREE.Texture,
 *   planetMaterial: THREE.Material,
 *   ringMaterial: THREE.Material,
 * }}
 */
export function addSaturn(
  scene,
  {
    textureUrl,
    ringTextureUrl,
    position = [0, 0, 0],
    radius = 1,
    spinSpeed = 0.3,
    spinAxis = [0, 1, 0],
    tiltDeg = [0, 0, 26.7],
    ringInnerScale = 1.2,
    ringOuterScale = 2.3,
    ringAngle = 0,
    ringsSpin = false,
    segments = 64,
    materialOptions = {},
    ringMaterialOptions = {},
    textureLoader,
    renderer,
  } = {},
) {
  if (!scene) throw new Error('addSaturn requires a THREE.Scene instance.');
  if (!textureUrl) throw new Error('addSaturn requires a planet textureUrl.');
  if (!ringTextureUrl) throw new Error('addSaturn requires a ringTextureUrl.');

  const loader = textureLoader ?? new THREE.TextureLoader();

  const planetTexture = loader.load(textureUrl);
  planetTexture.colorSpace = THREE.SRGBColorSpace;
  planetTexture.flipY = false;
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy
    ? renderer.capabilities.getMaxAnisotropy()
    : 1;
  planetTexture.anisotropy = maxAniso;
  planetTexture.minFilter = THREE.LinearMipmapLinearFilter;
  planetTexture.magFilter = THREE.LinearFilter;

  const ringTexture = loader.load(ringTextureUrl);
  ringTexture.colorSpace = THREE.SRGBColorSpace;
  ringTexture.flipY = false;
  ringTexture.anisotropy = maxAniso;
  ringTexture.wrapS = ringTexture.wrapT = THREE.ClampToEdgeWrapping;
  ringTexture.minFilter = THREE.LinearMipmapLinearFilter;
  ringTexture.magFilter = THREE.LinearFilter;
  ringTexture.generateMipmaps = true;

  const planetMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture,
    roughness: 1,
    metalness: 0,
    ...materialOptions,
  });

  const planetGeometry = new THREE.SphereGeometry(radius, segments, segments);
  const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);

  if (Array.isArray(position)) {
    planetMesh.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
  } else {
    planetMesh.position.set(position.x ?? 0, position.y ?? 0, position.z ?? 0);
  }

  const ringGeometry = new THREE.RingGeometry(
    radius * ringInnerScale,
    radius * ringOuterScale,
    128,
    1,
  );
  const uvAttr = ringGeometry.getAttribute('uv');
  const posAttr = ringGeometry.getAttribute('position');
  const innerRadius = radius * ringInnerScale;
  const outerRadius = radius * ringOuterScale;
  const radiusRange = Math.max(outerRadius - innerRadius, 1e-6);
  if (uvAttr && posAttr) {
    for (let i = 0; i < uvAttr.count; i += 1) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const r = Math.sqrt(x * x + y * y);
      const radial = THREE.MathUtils.clamp((r - innerRadius) / radiusRange, 0, 1);
      uvAttr.setX(i, radial);
      uvAttr.setY(i, 0.5);
    }
    uvAttr.needsUpdate = true;
  }
  const ringMaterial = new THREE.MeshBasicMaterial({
    map: ringTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    ...ringMaterialOptions,
  });
  const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);

  ringMesh.position.copy(planetMesh.position);
  ringMesh.rotation.x = Math.PI / 2;

  if (tiltDeg !== undefined && tiltDeg !== null) {
    let tiltEuler;
    if (tiltDeg instanceof THREE.Euler) {
      tiltEuler = tiltDeg.clone();
    } else if (Array.isArray(tiltDeg)) {
      tiltEuler = new THREE.Euler(
        THREE.MathUtils.degToRad(tiltDeg[0] ?? 0),
        THREE.MathUtils.degToRad(tiltDeg[1] ?? 0),
        THREE.MathUtils.degToRad(tiltDeg[2] ?? 0),
      );
    } else if (tiltDeg instanceof THREE.Vector3) {
      tiltEuler = new THREE.Euler(
        THREE.MathUtils.degToRad(tiltDeg.x ?? 0),
        THREE.MathUtils.degToRad(tiltDeg.y ?? 0),
        THREE.MathUtils.degToRad(tiltDeg.z ?? 0),
      );
    } else if (typeof tiltDeg === 'object') {
      tiltEuler = new THREE.Euler(
        THREE.MathUtils.degToRad(tiltDeg.x ?? 0),
        THREE.MathUtils.degToRad(tiltDeg.y ?? 0),
        THREE.MathUtils.degToRad(tiltDeg.z ?? 0),
      );
    } else if (typeof tiltDeg === 'number') {
      tiltEuler = new THREE.Euler(0, 0, THREE.MathUtils.degToRad(tiltDeg));
    }

    if (tiltEuler) {
      const tiltQuat = new THREE.Quaternion().setFromEuler(tiltEuler);
      planetMesh.applyQuaternion(tiltQuat);
      ringMesh.applyQuaternion(tiltQuat);
    }
  }

  scene.add(planetMesh);
  scene.add(ringMesh);

  const axis = spinAxis instanceof THREE.Vector3
    ? spinAxis.clone().normalize()
    : new THREE.Vector3(
        Array.isArray(spinAxis) ? spinAxis[0] ?? 0 : spinAxis.x ?? 0,
        Array.isArray(spinAxis) ? spinAxis[1] ?? 1 : spinAxis.y ?? 1,
        Array.isArray(spinAxis) ? spinAxis[2] ?? 0 : spinAxis.z ?? 0,
      ).normalize();

  if (ringAngle) {
    const angleRad = THREE.MathUtils.degToRad(ringAngle);
    planetMesh.rotateOnAxis(axis, angleRad);
    ringMesh.rotateOnAxis(axis, angleRad);
  }

  const update = (delta) => {
    if (!delta) return;
    const angle = spinSpeed * delta;
    if (angle !== 0) {
      planetMesh.rotateOnAxis(axis, angle);
      // Rings intentionally stay locked; spin only affects the planet body.
    }
  };

  const dispose = () => {
    scene.remove(planetMesh);
    scene.remove(ringMesh);
    planetGeometry.dispose();
    ringGeometry.dispose();
    planetMaterial.dispose();
    ringMaterial.dispose();
    planetTexture?.dispose?.();
    ringTexture?.dispose?.();
  };

  return {
    planetMesh,
    ringMesh,
    update,
    dispose,
    planetTexture,
    ringTexture,
    planetMaterial,
    ringMaterial,
  };
}

/**
 * Creates a particle burst whose kinematics follow named stellar-explosion profiles.
 *
 * @param {THREE.Scene} scene
 * @param {Object} params
 * @param {number} [params.count=400]
 * @param {Array|THREE.Vector3} [params.initialSpread=[0.4,0.4,0.4]]
 * @param {[number, number]} [params.lifeRange=[1.5, 3.0]]
 * @param {number} [params.size=0.08]
 * @param {THREE.Color|string|number} [params.color=0xffaa88]
 * @param {number} [params.opacity=0.9]
 * @param {string} [params.explosionType='typeIa']
 * @param {number} [params.decayRate=1.4] - Only used for the 'custom' type.
 * @param {number} [params.horizontalBias=0.3] - Reduces vertical launch speeds (0-1).
 * @param {[number, number]} [params.speedRange=[1.5, 3.5]] - Used when explosionType='custom'.
 * @returns {{
 *   points: THREE.Points,
 *   update: (delta: number) => void,
 *   dispose: () => void,
 * }}
 */
export function createParticleBurst(
  scene,
  {
    count = 400,
    initialSpread = [0.4, 0.4, 0.4],
    lifeRange = [1.5, 3.0],
    size = 0.08,
    color = 0xffaa88,
    opacity = 0.9,
    explosionType = 'typeIa',
    decayRate = 1.4,
    horizontalBias = 0.3,
    speedRange = [1.5, 3.5],
  } = {},
) {
  if (!scene) throw new Error('createParticleBurst requires a THREE.Scene instance.');

  // Supported explosionType values:
  //   'typeIa', 'typeII', 'hypernova', 'pairInstability', 'electronCapture',
  //   'lbv' (aliases: 'lbvGiantEruption', 'giant'), 'kilonova', 'custom'

  const typeKey = (explosionType ?? 'typeIa').toLowerCase().replace(/[\s_-]/g, '');
  const useCustom = typeKey === 'custom';

  const spreadVector = Array.isArray(initialSpread)
    ? new THREE.Vector3(initialSpread[0] ?? 0.4, initialSpread[1] ?? 0.4, initialSpread[2] ?? 0.4)
    : initialSpread.clone();

  const paletteMap = {
    typeia: {
      start: ['#BFD9FF', '#E9F2FF'],
      mid: ['#FFFFFF', '#FFF4E0'],
      late: ['#FFE6B3', '#FFD38A'],
    },
    typeii: {
      start: ['#CBE2FF', '#F2F7FF'],
      mid: ['#FFFFFF', '#FFEBD1'],
      late: ['#FF4D4D', '#FF7A3D', '#B34DFF'],
    },
    hypernova: {
      start: ['#A8C5FF', '#BBA7FF'],
      mid: ['#EAF2FF', '#FFFFFF'],
      late: ['#FFE8C7', '#FFD6A1'],
    },
    pairinstability: {
      start: ['#D3E5FF', '#FFFFFF'],
      mid: ['#FFF7E8', '#FFEFCF'],
      late: ['#FFD48C', '#FFC166'],
    },
    electroncapture: {
      start: ['#F7FBFF'],
      mid: ['#FFE9B8', '#FFD394'],
      late: ['#FF9B66', '#FF6B5E'],
    },
    lbvgianteruption: {
      start: ['#FFF0C9'],
      mid: ['#FFD080', '#FFB363'],
      late: ['#FF8A58', '#CC6A4C'],
    },
    lbv: {
      start: ['#FFF0C9'],
      mid: ['#FFD080', '#FFB363'],
      late: ['#FF8A58', '#CC6A4C'],
    },
    giant: {
      start: ['#FFF0C9'],
      mid: ['#FFD080', '#FFB363'],
      late: ['#FF8A58', '#CC6A4C'],
    },
    kilonova: {
      start: ['#BFD6FF', '#E5EEFF'],
      mid: ['#FFB5A1', '#FF9A86'],
      late: ['#B31A1A', '#7A0018'],
    },
  };

  const randBetween = (min, max) => {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.random() * (hi - lo) + lo;
  };

  const gaussian = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const randomNormal = (mean, std, floor) => {
    const value = mean + std * gaussian();
    return Math.max(value, floor);
  };

  const randomPowerLaw = (min, max, alpha) => {
    const lo = Math.max(min, 1e-6);
    const hi = Math.max(max, lo);
    if (Math.abs(alpha - 1) < 1e-6) {
      return lo * Math.pow(hi / lo, Math.random());
    }
    const exponent = 1 - alpha;
    const minPow = Math.pow(lo, exponent);
    const maxPow = Math.pow(hi, exponent);
    const rnd = minPow + (maxPow - minPow) * Math.random();
    return Math.pow(rnd, 1 / exponent);
  };

  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const ages = new Float32Array(count);
  const lifetimes = new Float32Array(count);
  const baseSpeeds = new Float32Array(count);
  const paramsA = new Float32Array(count);
  const colorsStart = new Float32Array(count * 3);
  const colorsMid = new Float32Array(count * 3);
  const colorsLate = new Float32Array(count * 3);

  const direction = new THREE.Vector3();
  const jetAxis = new THREE.Vector3(0, 1, 0);
  const jetExponent = 7;
  const biasMin = THREE.MathUtils.clamp(horizontalBias, 0, 1);

  const VELOCITY_SCALE = (1 / 5000) * 0.5; // convert km/s -> scene units per second (half-speed)
  const LIGHT_SPEED_KM = 299792;
  const MIN_SPEED_UNITS = 1e-4;
  const MIN_SPEED_KM = MIN_SPEED_UNITS / VELOCITY_SCALE;

  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    positions[idx] = (Math.random() - 0.5) * spreadVector.x;
    positions[idx + 1] = (Math.random() - 0.5) * spreadVector.y;
    positions[idx + 2] = (Math.random() - 0.5) * spreadVector.z;

    direction.randomDirection().normalize();
    directions[idx] = direction.x;
    directions[idx + 1] = direction.y;
    directions[idx + 2] = direction.z;

    let speedUnits;
    let paramValue = 0;

    if (useCustom) {
      speedUnits = randBetween(speedRange[0], speedRange[1]);
      paramValue = decayRate;
    } else {
      let speedKm;
      switch (typeKey) {
        case 'typeii': {
          const vMax = 15000;
          speedKm = Math.max(vMax * Math.random(), MIN_SPEED_KM);
          break;
        }
        case 'hypernova': {
          const base = 10000;
          const jetBoost = 70000;
          const cosTheta = Math.abs(direction.dot(jetAxis));
          speedKm = Math.max(base + jetBoost * Math.pow(cosTheta, jetExponent), MIN_SPEED_KM);
          paramValue = THREE.MathUtils.lerp(0.4, 1.2, Math.random());
          break;
        }
        case 'pairinstability': {
          speedKm = randomPowerLaw(5000, 25000, 2);
          paramValue = THREE.MathUtils.lerp(0.15, 0.4, Math.random());
          break;
        }
        case 'electroncapture': {
          speedKm = randomNormal(3000, 1000, MIN_SPEED_KM);
          paramValue = THREE.MathUtils.lerp(0.6, 1.4, Math.random());
          break;
        }
        case 'lbvgianteruption':
        case 'lbv':
        case 'giant': {
          speedKm = randomNormal(300, 100, MIN_SPEED_KM);
          paramValue = THREE.MathUtils.lerp(0.2, 0.6, Math.random());
          break;
        }
        case 'kilonova': {
          speedKm = Math.max(
            THREE.MathUtils.lerp(0.1, 0.3, Math.random()) * LIGHT_SPEED_KM,
            MIN_SPEED_KM,
          );
          paramValue = THREE.MathUtils.lerp(0.8, 1.6, Math.random());
          break;
        }
        case 'typeia':
        default:
          speedKm = randomNormal(10000, 2000, MIN_SPEED_KM);
          break;
      }

      speedUnits = Math.max(MIN_SPEED_UNITS, speedKm * VELOCITY_SCALE);
    }

    const bias = THREE.MathUtils.lerp(biasMin, 1, Math.abs(direction.x));
    speedUnits = Math.max(MIN_SPEED_UNITS, speedUnits * bias);

    baseSpeeds[i] = speedUnits;
    paramsA[i] = paramValue;

    ages[i] = 0;
    lifetimes[i] = randBetween(lifeRange[0], lifeRange[1]);

    const palette = paletteMap[typeKey] ?? null;
    const pickColor = (arr, fallback) => {
      const source = Array.isArray(arr) && arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : fallback;
      const col = new THREE.Color(source ?? color);
      return [col.r, col.g, col.b];
    };
    const defaultColor = new THREE.Color(color);
    const startCol = palette ? pickColor(palette.start, defaultColor) : pickColor(null, defaultColor);
    const midCol = palette ? pickColor(palette.mid, defaultColor) : startCol;
    const lateCol = palette ? pickColor(palette.late, defaultColor) : startCol;

    colorsStart[idx] = startCol[0];
    colorsStart[idx + 1] = startCol[1];
    colorsStart[idx + 2] = startCol[2];

    colorsMid[idx] = midCol[0];
    colorsMid[idx + 1] = midCol[1];
    colorsMid[idx + 2] = midCol[2];

    colorsLate[idx] = lateCol[0];
    colorsLate[idx + 1] = lateCol[1];
    colorsLate[idx + 2] = lateCol[2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('direction', new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute('age', new THREE.BufferAttribute(ages, 1));
  geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
  const colorAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  geometry.setAttribute('color', colorAttr);
  colorAttr.array.set(colorsStart);

  const material = new THREE.PointsMaterial({
    size,
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    vertexColors: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `
      #include <clipping_planes_fragment>
      vec2 centered = gl_PointCoord - 0.5;
      float distSq = dot(centered, centered);
      if (distSq > 0.25) discard;
      `
    );
  };
  material.needsUpdate = true;

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const distanceDelta = (prevAge, nextAge, speed, param) => {
    const deltaTime = nextAge - prevAge;
    switch (typeKey) {
      case 'typeii':
      case 'typeia':
        return speed * deltaTime;
      case 'hypernova':
      case 'electroncapture':
      case 'kilonova': {
        const gamma = Math.max(param, 1e-6);
        const expPrev = Math.exp(-gamma * prevAge);
        const expNext = Math.exp(-gamma * nextAge);
        return (speed / gamma) * (expPrev - expNext);
      }
      case 'pairinstability': {
        const tau = Math.max(param, 1e-6);
        const expPrev = Math.exp(-prevAge / tau);
        const expNext = Math.exp(-nextAge / tau);
        return speed * (deltaTime + tau * (expNext - expPrev));
      }
      case 'lbvgianteruption':
      case 'lbv':
      case 'giant': {
        const beta = Math.max(param, 1e-6);
        const ratio = (1 + beta * nextAge) / (1 + beta * prevAge);
        return (speed / beta) * Math.log(Math.max(ratio, 1e-6));
      }
      case 'custom': {
        const rate = Math.max(param, 0);
        if (rate < 1e-6) return speed * deltaTime;
        const expPrev = Math.exp(-rate * prevAge);
        const expNext = Math.exp(-rate * nextAge);
        return (speed / rate) * (expPrev - expNext);
      }
      default:
        return speed * deltaTime;
    }
  };

  const update = (delta) => {
    const posAttr = geometry.getAttribute('position');
    const dirAttr = geometry.getAttribute('direction');
    const ageAttr = geometry.getAttribute('age');
    const lifeAttr = geometry.getAttribute('lifetime');
    const colAttr = geometry.getAttribute('color');

    for (let i = 0; i < count; i += 1) {
      const idx = i * 3;
      const prevAge = ageAttr.array[i];
      const targetAge = prevAge + delta;
      const life = lifeAttr.array[i];

      if (prevAge >= life) {
        continue;
      }

      const nextAge = Math.min(targetAge, life);
      ageAttr.array[i] = nextAge;

      const speed = baseSpeeds[i];
      if (!Number.isFinite(speed) || speed <= 0) continue;
      const param = paramsA[i];

      const dist = distanceDelta(prevAge, nextAge, speed, param);

      posAttr.array[idx] += dirAttr.array[idx] * dist;
      posAttr.array[idx + 1] += dirAttr.array[idx + 1] * dist;
      posAttr.array[idx + 2] += dirAttr.array[idx + 2] * dist;

      const totalLife = lifeAttr.array[i];
      const t = totalLife <= 0 ? 1 : Math.min(1, ageAttr.array[i] / totalLife);
      let r;
      let g;
      let b;
      if (t <= 0.5) {
        const f = t / 0.5;
        r = colorsStart[idx] * (1 - f) + colorsMid[idx] * f;
        g = colorsStart[idx + 1] * (1 - f) + colorsMid[idx + 1] * f;
        b = colorsStart[idx + 2] * (1 - f) + colorsMid[idx + 2] * f;
      } else {
        const f = (t - 0.5) / 0.5;
        r = colorsMid[idx] * (1 - f) + colorsLate[idx] * f;
        g = colorsMid[idx + 1] * (1 - f) + colorsLate[idx + 1] * f;
        b = colorsMid[idx + 2] * (1 - f) + colorsLate[idx + 2] * f;
      }
      colAttr.array[idx] = r;
      colAttr.array[idx + 1] = g;
      colAttr.array[idx + 2] = b;
    }

    posAttr.needsUpdate = true;
    ageAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  const dispose = () => {
    scene.remove(points);
    geometry.dispose();
    material.dispose();
  };

  return { points, update, dispose };
}
