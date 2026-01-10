import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { prepareScene, addSpinningPlanet } from '../lib/threeCore';
import SimStage from '../lib/simStage.jsx';

export default function SupernovaSim({
  id = 'supernova-core',
  aspect = '16 / 9',
  dprCap = 1.5,
  radius = 1.2,
  color = '#ffb46a',
  luminosity = 2.4,
  spinDegPerSec = 6,
  shellColor = '#86c5ff',
  shellMaxRadius = 30,
  shellExpansionPerSec = 8,
  showPause = true,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);
  const madeVisibleRef = useRef(false);
  const shellRadiusRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) return;

    // --- simple grayscale noise texture ---
    const noiseSize = 128;
    const noiseData = new Uint8Array(noiseSize * noiseSize * 4);
    for (let i = 0; i < noiseData.length; i += 4) {
      const v = Math.floor(Math.random() * 256);
      noiseData[i] = v;
      noiseData[i + 1] = v;
      noiseData[i + 2] = v;
      noiseData[i + 3] = 255;
    }
    const noiseTex = new THREE.DataTexture(
      noiseData,
      noiseSize,
      noiseSize,
      THREE.RGBAFormat,
    );
    noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
    noiseTex.minFilter = THREE.LinearFilter;
    noiseTex.magFilter = THREE.LinearFilter;
    noiseTex.generateMipmaps = false;
    noiseTex.needsUpdate = true;

    const {
      scene,
      renderer,
      textureLoader,
      start,
      stop,
      dispose,
    } = prepareScene({
      canvas,
      container,
      dprCap,
      background: 0x04040a,
      cameraConfig: {
        position: { x: 0, y: 0, z: 90 },
      },
    });

    // optional: extra glow if you control renderer here
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.6;
    }

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    const keyLight = new THREE.PointLight(0xffe0b3, 2.2, 12);
    keyLight.position.set(2, 1, 3);
    const rimLight = new THREE.PointLight(0x88b7ff, 0.8, 10);
    rimLight.position.set(-3, -1, -2);
    scene.add(ambient, keyLight, rimLight);

    const shellGeometry = new THREE.SphereGeometry(1, 96, 96);

    const shellMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime:    { value: 0.0 },
        uNoiseTex:{ value: noiseTex },
        uColor1:  { value: new THREE.Color(0xffcc66) },   // warm yellow
        uColor2:  { value: new THREE.Color(0xff4444) },   // warm red
        uColor3:  { value: new THREE.Color(shellColor) }, // cool blue/cyan
        uRadius:  { value: 0.001 },
        uOpacity: { value: 1.0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vLocalPos;
        varying vec3 vNormalView;

        void main() {
          // local-space position of the vertex on the unit sphere
          vLocalPos   = position;

          // view-space normal for Fresnel / rim lighting
          vNormalView = normalize(normalMatrix * normal);

          vec4 wp = modelMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uNoiseTex;
        uniform float uTime;
        uniform float uRadius;   // still used to know "expansion", but not for centering
        uniform float uOpacity;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

        varying vec3 vLocalPos;
        varying vec3 vNormalView;

        void main() {
          // local position on the unit sphere: centered at mesh origin
          vec3 pos = vLocalPos;

          // r ~ 1.0 on the shell, independent of world position
          float r = length(pos);
          vec3 n  = normalize(pos);

          // spherical UVs from local direction
          float u = atan(n.z, n.x) / (2.0 * 3.14159265) + 0.5;
          float v = asin(n.y) / 3.14159265 + 0.5;
          vec2 uv = vec2(u, v);

          // --- low-frequency base noise (soft clouds) ---
          vec2 uvBase1 = uv * 2.5;
          vec2 uvBase2 = uv * 4.5;
          float b1 = texture2D(uNoiseTex, uvBase1).r;
          float b2 = texture2D(uNoiseTex, uvBase2).r;
          float baseNoise = b1 * 0.6 + b2 * 0.4;

          // --- thicker, less-dense filament arcs ---
          vec2 uvFil = vec2(uv.x * 0.02, uv.y * 1.0);
          float f1 = texture2D(uNoiseTex, uvFil).r;
          float f2 = texture2D(uNoiseTex, uvFil * 1.35).r;
          float filNoise = f1 * 0.55 + f2 * 0.45;

          float ridge = 1.0 - abs(filNoise * 2.0 - 1.0);
          ridge = pow(ridge, 1.2);                // thicker ridges
          float filaments = smoothstep(0.72, 0.9, ridge); // fewer, fatter filaments

          // shell band around r ~ 1 (in local space)
          float inner = smoothstep(0.78, 1.00, r);
          float outer = smoothstep(1.00, 1.30, r);
          float shellBand = inner - outer;

          // limb-brightening from view-space normal
          float fresnel = pow(1.0 - abs(vNormalView.z), 3.0);

          float cavities = smoothstep(0.25, 0.7, baseNoise);
          float radial  = 1.0 - smoothstep(0.0, 0.6, abs(r - 1.0));

          float raw = shellBand * radial * (0.2 + 1.7 * filaments);
          raw *= (0.7 + 2.0 * fresnel);
          raw = max(raw - 0.07, 0.0);

          float glow = pow(raw, 0.6);

          vec3 warm = mix(uColor1, uColor2, clamp(baseNoise * 1.2, 0.0, 1.0));
          vec3 cool = uColor3;
          float warmMix = clamp(0.35 * filaments + 1.6 * fresnel, 0.0, 1.0);
          vec3 col = mix(cool, warm, warmMix);

          vec3 rgb = col * (0.3 + 3.4 * glow);

          float alpha = clamp(glow * 3.0, 0.0, 1.0) * uOpacity;
          if (alpha < 0.02) discard;

          gl_FragColor = vec4(rgb, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    shell.scale.setScalar(0.001);
    
    scene.add(shell);

    const core = addSpinningPlanet(scene, {
      color,
      luminosity,
      radius,
      spinSpeed: THREE.MathUtils.degToRad(spinDegPerSec),
      renderer,
      textureLoader,
      materialOptions: {
        roughness: 0.05,
        metalness: 0,
      },
    });

    start((delta, elapsed) => {
      if (pausedRef.current) return;

      core.update(delta);
      shellMaterial.uniforms.uTime.value = elapsed;

      if (shellRadiusRef.current < shellMaxRadius) {
        shellRadiusRef.current = Math.min(
          shellRadiusRef.current + shellExpansionPerSec * delta,
          shellMaxRadius,
        );

        const scale = Math.max(shellRadiusRef.current, 0.001);
        shell.scale.setScalar(scale);
        shellMaterial.uniforms.uRadius.value = scale;

        const fade = 1 - shellRadiusRef.current / shellMaxRadius;
        // keep it fairly visible; you can tweak these
        shellMaterial.uniforms.uOpacity.value = 0.55 + fade * 0.35;
      }

      keyLight.intensity = 2.0 + Math.sin(elapsed * 1.6) * 0.35;
      rimLight.intensity = 0.7 + Math.sin(elapsed * 0.9 + Math.PI * 0.25) * 0.2;
    });

    return () => {
      stop();
      core.dispose();
      scene.remove(ambient, keyLight, rimLight);
      scene.remove(shell);
      shellGeometry.dispose();
      shellMaterial.dispose();
      noiseTex.dispose();
      dispose();
    };
  }, [
    color,
    dprCap,
    luminosity,
    radius,
    shellColor,
    shellExpansionPerSec,
    shellMaxRadius,
    spinDegPerSec,
  ]);

  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    const nowPaused = pausedRef.current;
    setPaused(nowPaused);

    if (!nowPaused && !madeVisibleRef.current) {
      madeVisibleRef.current = true;
      const el =
        containerRef.current?.closest('.sim-stage') ?? containerRef.current;
      if (el && !el.classList.contains('is-visible')) {
        el.classList.add('is-visible');
      }
    }
  };

  return (
    <SimStage
      id={id}
      aspect={aspect}
      containerRef={containerRef}
      canvasRef={canvasRef}
      paused={paused}
      onToggle={onToggle}
      showPause={showPause}
    />
  );
}
