import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import { createInitialPositionTexture, createInitialPositionTextureSpiral, createPyramidPathTexture } from "./textures.js";

// ==========================================================
// 4. INIT GPU COMPUTE SYSTEM
// ==========================================================
export function initCompute(renderer, positionShader, initParticlePosIndex, WIDTH = 256) {
    const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

    let dtPosition;

    if (initParticlePosIndex === 0) {
        dtPosition = createInitialPositionTexture(gpuCompute);
    } 
    else if (initParticlePosIndex === 1) {
        dtPosition = createInitialPositionTextureSpiral(gpuCompute);
    } 
    else if (initParticlePosIndex === 2) {
        dtPosition = createPyramidPathTexture(gpuCompute);
    } 
    else {
        throw new Error(`Invalid initParticlePosIndex: ${initParticlePosIndex}`);
    }
    const posVar = gpuCompute.addVariable("texturePosition", positionShader, dtPosition);

    gpuCompute.setVariableDependencies(posVar, [posVar]);

    const err = gpuCompute.init();
    if (err) console.error(err);

    return { gpuCompute, posVar };
}

