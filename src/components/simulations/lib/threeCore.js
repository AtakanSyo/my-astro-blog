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

  const camera = new THREE.PerspectiveCamera(
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

  const textureLoader = new THREE.TextureLoader();
  let resizeObserver;

  const updateSize = () => {
    if (!sizingElement) return;
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    const width = Math.max(1, sizingElement.clientWidth);
    const height = Math.max(1, sizingElement.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height || 1;
    camera.updateProjectionMatrix();
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
  if (!textureUrl) {
    throw new Error('addSpinningPlanet requires a textureUrl.');
  }

  const loader = textureLoader ?? new THREE.TextureLoader();
  const texture = loader.load(textureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer?.capabilities?.getMaxAnisotropy) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    metalness: 0,
    ...materialOptions,
  });

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
