import * as THREE from "three";

export function createPyramidPathTexture(gpuCompute) {
    const tex = gpuCompute.createTexture();
    const data = tex.image.data;
    
    // Pyramid Dimensions
    const w = 15.0; // Base half-width
    const h = 25.0; // Height

    // Keyframes: The corners of the pyramid
    const corners = [
        new THREE.Vector3(-w, 0, -w), // Base 1
        new THREE.Vector3( 0, h,  0), // Apex
        new THREE.Vector3( w, 0, -w), // Base 2
        new THREE.Vector3( w, 0,  w), // Base 3
        new THREE.Vector3( 0, h,  0), // Apex (Again)
        new THREE.Vector3(-w, 0,  w), // Base 4
        new THREE.Vector3(-w, 0, -w)  // Back to Base 1 (Loop Closed)
    ];

    // Total pixels available in the texture
    const totalPixels = data.length / 4;
    
    // Helper to get point on the path
    // We treat the 'corners' array as a sequence of connected lines
    function getPointOnPath(t) {
        // t is 0.0 to 1.0
        const totalSegments = corners.length - 1;
        const scaledT = t * totalSegments;
        const index = Math.floor(scaledT);
        const segmentT = scaledT - index; // Progress on current line segment (0..1)
        
        const start = corners[index];
        const end = corners[min(index + 1, totalSegments)]; // Safety clamp
        
        return new THREE.Vector3().lerpVectors(start, end, segmentT);
    }
    
    // Safety min function since JS Math.min doesn't handle objects well
    function min(a, b) { return a < b ? a : b; }

    for (let i = 0; i < totalPixels; i++) {
        const i4 = i * 4;
        
        // Calculate progress (0.0 to 1.0) along the ENTIRE texture
        const progress = i / totalPixels;
        
        const pos = getPointOnPath(progress);

        data[i4]     = pos.x;
        data[i4 + 1] = pos.y;
        data[i4 + 2] = pos.z;
        data[i4 + 3] = 1.0; // W
    }
    
    return tex;
}

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

    const armCount = 12.0;
    const twist = 16.0;
    const maxRadius = 25.0;

    for (let i = 0; i < data.length; i += 4) {
        const r = (Math.random() * Math.random() * Math.random()) * maxRadius + 0.5;

        const logR = Math.log(r);
        const spiralAngle = -(twist * logR) / armCount;

        // Pick one of 6 arms: k = 0..5
        const armIndex = Math.floor(Math.random() * armCount); // 0,1,2,3,4,5
        const baseArmAngle = (2.0 * Math.PI * armIndex) / armCount;

        let angleOffset;

        if (Math.random() < 0.7) {
            // ARM: tight spread
            const armSpread = (Math.random() - 0.5) * 0.6; // tweak for sharpness
            angleOffset = armSpread;
        } else {
            // VOID: put them between arms
            const voidSpread = (Math.random() - 0.5) * 1.0;
            // halfway between this arm and the next one
            angleOffset = voidSpread + (Math.PI / armCount);
        }

        const finalAngle = spiralAngle + baseArmAngle + angleOffset;

        const bulgeFade = Math.exp(-r * 0.7);
        const diskHeight = 0.05 + (0.02 * r);
        const limitY = diskHeight + (1.5 * bulgeFade);

        const y = (Math.random() - 0.5) * limitY * 0.5;

        data[i]     = r * Math.cos(finalAngle);
        data[i + 1] = y;
        data[i + 2] = r * Math.sin(finalAngle);
        data[i + 3] = 1.0;
    }
    return tex;
}

