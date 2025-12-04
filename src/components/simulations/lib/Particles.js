import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";

// ==========================================================
// 1. CONFIG
// ==========================================================
export const WIDTH = 512;
export const PARTICLES = WIDTH * WIDTH;

// ==========================================================
// 2. SHADERS
// ==========================================================
export const computeShaderPosition = `
    vec2 rotate(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c) * v;
    }

    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 tmpPos = texture2D(texturePosition, uv);
        vec3 position = tmpPos.xyz;

        float radius = length(position.xz);
        float speed = (3.0 / (radius + 0.1)) * 0.05;
        position.xz = rotate(position.xz, speed);

        vec3 inwardDir = normalize(-position);
        position += inwardDir * 0.08;

        if (radius < 1.0) {
            float theta = rand(uv + position.xy) * 6.28318;
            float r = 25.0 + rand(uv + position.yz) * 5.0;

            position.x = r * cos(theta);
            position.z = r * sin(theta);
            position.y = (rand(uv) - 0.5) * 2.0;
        }

        gl_FragColor = vec4(position, 1.0);
    }
`;

export const renderVertexShader = /* glsl */`
    uniform sampler2D uPositionTexture;
    attribute vec2 reference;
    
    varying float vRadius;
    varying float vRandom; // We need to pass uniqueness to the fragment shader

    // Pseudo-random function
    float rand(vec2 co){
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
        vec3 pos = texture2D(uPositionTexture, reference).xyz;
        vRadius = length(pos);

        // Generate a stable random number for this specific particle
        // We use the reference (UV) so it stays the same for the particle's life
        vRandom = rand(reference * 100.0);

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        gl_PointSize = 120.0 / -mvPosition.z;
    }
`;

export const renderFragmentShader = /* glsl */`
    varying float vRadius;
    varying float vRandom;

    void main() {
        // 1. CIRCLE SHAPE
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = pow(1.0 - (dist * 2.0), 1.5);

        // 2. BASE COLORS
        vec3 colorCore = vec3(1.0, 0.9, 0.7); // Warm Yellow/White
        vec3 colorArm  = vec3(0.3, 0.6, 1.0); // Blueish
        vec3 colorH2   = vec3(1.0, 0.2, 0.4); // The "Sprinkles" (Pinkish Red)

        // 3. MIXING LOGIC
        // Map radius to a 0.0 -> 1.0 gradient
        float t = smoothstep(2.0, 25.0, vRadius); 
        
        vec3 baseColor = mix(colorCore, colorArm, t);

        // 4. ADD THE RED SPRINKLES
        // Logic: If we are in the "Arm Zone" (t > 0.5) 
        // AND this particle is lucky (vRandom > 0.9), turn it red.
        
        // We multiply 't' so red stars don't appear in the yellow core
        float redProbability = vRandom * t; 
        
        // If probability is high, mix in the red color
        // Threshold 0.8 means roughly 20% of outer stars will have a red tint
        float redMix = smoothstep(0.1, 0.95, redProbability);
        
        vec3 finalColor = mix(baseColor, colorH2, redMix);

        // Boost the brightness of red particles slightly so they pop
        if (redMix > 0.5) {
            finalColor *= 1.5;
        }

        gl_FragColor = vec4(finalColor, alpha);
    }
`;

// ==========================================================
// 3. CREATE INITIAL POSITION TEXTURE
// ==========================================================
export function createInitialPositionTexture(gpuCompute) {
    const tex = gpuCompute.createTexture();
    const data = tex.image.data;

    for (let i = 0; i < data.length; i += 4) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0 + Math.random() * 20;

        data[i] = radius * Math.cos(angle);  // X
        data[i + 1] = (Math.random() - 0.5) * 2;  // Y
        data[i + 2] = radius * Math.sin(angle);   // Z
        data[i + 3] = 1.0;
    }
    return tex;
}

export function createInitialPositionTextureSpiral(gpuCompute) {
    const tex = gpuCompute.createTexture();
    const data = tex.image.data;

    // CONSTANTS: MUST MATCH SHADER EXACTLY
    const armCount = 10.0;
    const twist = 32.0; // Updated from 6.0 to match the 'spiralGalaxy' shader code provided earlier
    const maxRadius = 35.0; // Slightly larger to match shader fade-out

    for (let i = 0; i < data.length; i += 4) {
        
        // 1. RADIAL DISTRIBUTION
        // Power of 3 creates the dense core. 
        // We clamp min radius to 0.5 to avoid singularity at the black hole.
        const r = (Math.random() * Math.random() * Math.random()) * maxRadius + 0.5;

        // 2. ANGLE CALCULATION
        // We calculate where the spiral arm CENTER is at this radius.
        const logR = Math.log(r);
        const spiralAngle = -(twist * logR) / armCount;

        // 3. ARM VS. VOID DISTRIBUTION (The Fix)
        // In a density wave, particles are everywhere, just denser in the arms.
        // We use a weighted random choice to decide if this particle spawns in an ARM or a VOID.
        
        let angleOffset;
        
        // 70% chance to spawn in an Arm (High Density)
        // 30% chance to spawn in the Void (Low Density)
        if (Math.random() < 0.7) {
            // ARM SPAWN: Tight spread around the spiral center
            const armSpread = (Math.random() - 0.5) * 0.8; 
            angleOffset = armSpread;
        } else {
            // VOID SPAWN: Wide spread (anywhere else)
            // We push them roughly pi/2 away from the arm center
            const voidSpread = (Math.random() - 0.5) * 0.5; 
            angleOffset = voidSpread + (Math.PI / armCount);
        }

        // Arm Selector (Arm 1 or Arm 2)
        const whichArm = (Math.random() > 0.5) ? 0 : Math.PI;
        
        // Combine
        const finalAngle = spiralAngle + whichArm + angleOffset;

        // 4. VERTICAL STRUCTURE
        // Matches the shader: Sphere in center, thin disk at edges.
        const bulgeFade = Math.exp(-r * 0.7);
        const diskHeight = 0.05 + (0.02 * r); 
        const limitY = diskHeight + (1.5 * bulgeFade); // Lerp-like logic
        
        const y = (Math.random() - 0.5) * limitY * 0.5;

        // 5. ASSIGN DATA
        data[i] = r * Math.cos(finalAngle); // X
        data[i + 1] = y;                    // Y
        data[i + 2] = r * Math.sin(finalAngle); // Z
        data[i + 3] = 1.0;                  // W
    }
    return tex;
}

// ==========================================================
// 4. INIT GPU COMPUTE SYSTEM
// ==========================================================
export function initCompute(renderer, positionShader = computeShaderPosition) {
    const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

    const dtPosition = createInitialPositionTextureSpiral(gpuCompute);
    const posVar = gpuCompute.addVariable("texturePosition", positionShader, dtPosition);

    gpuCompute.setVariableDependencies(posVar, [posVar]);

    const err = gpuCompute.init();
    if (err) console.error(err);

    return { gpuCompute, posVar };
}

// ==========================================================
// 5. CREATE PARTICLE MESH
// ==========================================================
export function createParticlePoints() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLES * 3);
    const references = new Float32Array(PARTICLES * 2);

    for (let i = 0; i < PARTICLES; i++) {
        const x = (i % WIDTH) / WIDTH;
        const y = Math.floor(i / WIDTH) / WIDTH;

        references[i * 2] = x;
        references[i * 2 + 1] = y;

        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("reference", new THREE.BufferAttribute(references, 2));

    const material = new THREE.ShaderMaterial({
        uniforms: { uPositionTexture: { value: null } },
        vertexShader: renderVertexShader,
        fragmentShader: renderFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;

    return { points, material };
}

// ==========================================================
// 6. SETUP SCENE
// ==========================================================
export function createScene() {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 20, 40);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    return { scene, camera, renderer };
}

// ==========================================================
// 7. MAIN LOOP
// ==========================================================
export function startSimulation({ scene, camera, renderer, gpuCompute, posVar, points, material }) {
    function animate() {
        requestAnimationFrame(animate);

        gpuCompute.compute();
        material.uniforms.uPositionTexture.value =
            gpuCompute.getCurrentRenderTarget(posVar).texture;

        renderer.render(scene, camera);
    }

    animate();
}

// ==========================================================
// 8. COMPLETE BOOTSTRAP FUNCTION
// ==========================================================
export function runVortexSimulation(container = document.body) {
    const { scene, camera, renderer } = createScene();
    container.appendChild(renderer.domElement);

    const { gpuCompute, posVar } = initCompute(renderer, computeShaderPosition);
    const { points, material } = createParticlePoints();

    scene.add(points);

    startSimulation({ scene, camera, renderer, gpuCompute, posVar, points, material });

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, gpuCompute };
}
