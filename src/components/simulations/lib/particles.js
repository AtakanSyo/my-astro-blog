import * as THREE from "three";
import { renderVertexShader, renderFragmentShader } from "./shaders.js";

export function createParticlePoints(WIDTH = 256) {
    const PARTICLES = WIDTH * WIDTH;

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
