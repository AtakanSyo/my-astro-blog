// Collection of reusable GLSL shader snippets for simulations.
// Each export is a string that can be passed into GPUComputationRenderer
// or other Three.js shader entry points.

export const aLoopLike = /* glsl */`
    // Spiral galaxy–style vortex integrator

    vec2 rotate(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c) * v;
    }

    float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 texel = texture2D(texturePosition, uv);
        vec3 position = texel.xyz;

        // Radius in the disk plane (x–z plane)
        float r   = length(position.xz);
        float eps = 0.1;
        r = max(r, eps);

        // ================================
        // 1) Slow differential rotation
        // ================================
        // Roughly "flat" rotation curve: Ω ~ r^{-0.6}
        float omega0 = 0.03;          // global rotation scale (slow)
        float omega  = omega0 * pow(r, -0.6);
        position.xz  = rotate(position.xz, omega);

        // Tiny inward drift to very slowly wind the arms
        float drift = 0.999;
        position.xz *= drift;

        // ================================
        // 2) Vertical structure (thin flared disk)
        // ================================
        // Slight settling toward midplane + small flaring with radius
        float flare = clamp((r - 2.0) / 20.0, 0.0, 1.0);
        float targetScaleHeight = mix(0.1, 0.6, flare);

        // Damped vertical motion
        position.y *= 0.985;
        // Small stochastic vertical kick to keep some thickness
        position.y += (rand(uv + position.xy) - 0.5) * 0.02 * targetScaleHeight;

        // ================================
        // 3) Spiral arms (density wave–like)
        // ================================
        float theta  = atan(position.z, position.x);
        float m      = 2.5;      // between 2 and 3 arms
        float pitch  = 0.35;     // controls how tightly wound
        float phase  = m * theta + pitch * r;

        // Radial envelope: arms strongest in mid–disk
        float armInner = 4.0;
        float armPeak  = 14.0;
        float armOuter = 28.0;

        float wIn   = smoothstep(armInner, armPeak, r);
        float wOut  = 1.0 - smoothstep(armPeak, armOuter, r);
        float armWeight = clamp(wIn * wOut, 0.0, 1.0);

        float armAmplitude = 0.12;
        float armDensity   = sin(phase);  // arm vs inter-arm
        vec2 radialDir     = normalize(position.xz);
        position.xz       += radialDir * armAmplitude * armDensity * armWeight;

        // ================================
        // 4) Small planar diffusion
        // ================================
        vec2 planarNoise = vec2(
            rand(uv + position.zy) - 0.5,
            rand(uv + position.xz) - 0.5
        ) * 0.02;
        position.xz += planarNoise;

        // ================================
        // 5) Core sink + outer respawn ring
        // ================================
        float coreRadius = 1.5;
        float maxRadius  = 35.0;
        r = length(position.xz);

        if (r < coreRadius || r > maxRadius) {
            // Re-inject star in an outer ring
            float theta0 = rand(uv + position.xy) * 6.28318;
            float r0     = 12.0 + rand(uv + position.yz) * 12.0;

            position.x = r0 * cos(theta0);
            position.z = r0 * sin(theta0);

            // Give it some vertical spread, but still thin
            float h0 = 0.3 * r0;
            position.y = (rand(uv + position.zx) - 0.5) * 0.1 * h0;
        }

        gl_FragColor = vec4(position, 1.0);
    }
`;

export const vortexShader = /* glsl */`
    vec2 rotate(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c) * v;
    }

    float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 tmpPos = texture2D(texturePosition, uv);
        vec3 position = tmpPos.xyz;

        // Radius in the x–z plane
        float radius = length(position.xz);
        float eps    = 0.1;
        radius = max(radius, eps);

        // --- Kepler-like rotation ---
        float keplerOmega = 0.15 * pow(radius, -1.5);
        position.xz = rotate(position.xz, keplerOmega);

        // --- Radial in-spiral ---
        float radialDrift = 0.997;
        position.xz *= radialDrift;

        // --- Vertical settling ---
        float settle = 0.99;
        position.y *= settle;

        // ================================
        // Spiral arms a bit further out
        // ================================
        float angle = atan(position.z, position.x);
        float m     = 2.0;
        float phase = m * angle + 0.2 * radius;
        float armPattern = sin(phase);

        // Radial envelope: make spirals strongest in a mid–disk band
        // Tune these three to move the spiral "sweet spot":
        float armInner  = 14.0;   // where arms start to appear
        float armPeak   = 24.0;  // roughly where they are strongest
        float armOuter  = 32.0;  // where they fade out

        // Smooth dome-shaped weight in radius
        float wIn   = smoothstep(armInner, armPeak, radius);
        float wOut  = 1.0 - smoothstep(armPeak, armOuter, radius);
        float armRadialWeight = clamp(wIn * wOut, 0.0, 1.0);

        float armStrength = 0.35; // base strength
        vec2 radialDir = normalize(position.xz);
        position.xz += radialDir * armStrength * armPattern * armRadialWeight * 0.06;

        // --- Inner sink + respawn ring ---
        float innerRadius = 1.5;
        float outerMin    = 18.0;
        float outerMax    = 26.0;

        radius = length(position.xz);

        if (radius < innerRadius) {
            float theta = rand(uv + position.xy) * 6.28318;
            float r     = outerMin + rand(uv + position.yz) * (outerMax - outerMin);

            position.x = r * cos(theta);
            position.z = r * sin(theta);

            float h = 0.15 * r;
            position.y = (rand(uv) - 0.5) * h;
        }

        // Tiny stochastic kick
        vec3 noiseKick = vec3(
            rand(uv + position.xy) - 0.5,
            rand(uv + position.yz) - 0.5,
            rand(uv + position.zx) - 0.5
        ) * 0.01;
        position += noiseKick;

        gl_FragColor = vec4(position, 1.0);
    }
`;

export const spiralGalaxy = /* glsl */`
    // "Organic" Spiral Galaxy Integrator
    // Concept: Coherent Density Wave + Individual Particle Personality

    uniform float uTime;

    vec2 rotate(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c) * v;
    }

    float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 texel = texture2D(texturePosition, uv);
        vec3 pos = texel.xyz;

        float r = length(pos.xz);
        
        // ============================================
        // 1) STRUCTURE DEFINITION
        // ============================================
        float armCount = 4.0;
        float twist = 12.0;
        float patternSpeed = 0.05; 

        // Current Angle of the rotating arm structure
        float angle = atan(pos.z, pos.x);
        float domainAngle = angle - (uTime * patternSpeed);
        
        float mathR = max(r, 0.5);
        
        float spiralPhase = domainAngle * armCount + twist * log(mathR);
        
        float armProximity = 0.5 + 0.5 * cos(spiralPhase);
        armProximity = pow(armProximity, 1.0); 

        // Core Fix
        float coreRadius = 1.2;
        float coreFade = smoothstep(0.0, coreRadius, r); 
        float effectiveProximity = mix(1.0, armProximity, coreFade);

        // ============================================
        // 2) PHYSICS & INDIVIDUAL VARIANCE
        // ============================================
        
        // Base Flow (Density Wave Logic)
        float armRelSpeed = 0.03; 
        float voidRelSpeed = 0.07; 
        float relativeSpeed = mix(voidRelSpeed, armRelSpeed, effectiveProximity);
        
        float baseOmega = patternSpeed * relativeSpeed;

        // --- NEW: INDIVIDUAL VARIANCE ---
        // We generate a random factor (-1.0 to 1.0) specific to this particle
        // using 'uv' as the seed ensures this particle stays fast or slow forever.
        float speedPersonality = (rand(uv + vec2(10.0, 42.0)) - 0.5) * 2.0;
        
        // The user requested a variance range of roughly +/- 0.01
        // We add this on top of the calculated flow speed.
        // Some particles will rush ahead, some will lag behind.
        float randomSpeedOffset = speedPersonality * 0.002; // Range: -0.005 to +0.005

        // Combine
        float finalOmega = baseOmega + randomSpeedOffset;

        // Apply Rotation
        pos.xz = rotate(pos.xz, finalOmega);

        // ============================================
        // 3) VERTICAL OSCILLATION
        // ============================================
        float bulge = exp(-r * 0.7);
        float diskHeight = 0.05 + (0.02 * r); 
        float limitY = mix(diskHeight, 1.5, bulge);

        float verticalFreq = 0.05 / (1.0 + r * 0.1); 
        float rnd = rand(uv);
        float osc = sin(verticalFreq * 1000.0 + rnd * 6.28); 
        
        pos.y = mix(pos.y, osc * limitY * 0.5, 0.01);

        gl_FragColor = vec4(pos, 1.0);
    }
`;


export const pyramidTrainShader = /* glsl */`
    uniform float uTime;
    
    // This is the static texture we created in JS (The Track)
    uniform sampler2D texturePath; 

    // Helper to convert a 1D progress (0..1) into 2D Texture UVs
    vec2 getUVFromProgress(float t) {
        // We assume the texture is square (WIDTH x WIDTH)
        // You need to hardcode WIDTH here or pass it as uniform, 
        // but typically 1024.0 or similar.
        float width = resolution.x; // GPGPU renderer provides 'resolution'
        
        // Calculate total index
        float totalPixels = width * width;
        float index = t * totalPixels;
        
        // Map to X, Y
        float x = mod(index, width);
        float y = floor(index / width);
        
        // Normalize to 0..1 UV space
        return vec2((x + 0.5) / width, (y + 0.5) / width);
    }

    float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        
        // 1. Determine "Seat Number"
        // Each particle has a fixed random offset on the track
        float particleOffset = rand(uv); 
        
        // 2. Drive the Train
        float speed = 0.05; // Loops the track every 20 seconds
        float globalProgress = uTime * speed;
        
        // 3. Calculate current track position (0.0 to 1.0)
        // fract() ensures it loops 0 -> 1 -> 0
        float currentProgress = fract(globalProgress + particleOffset);
        
        // 4. Look up the XYZ coordinate from the Path Texture
        vec2 trackUV = getUVFromProgress(currentProgress);
        vec3 trackPos = texture2D(texturePath, trackUV).xyz;
        
        // 5. Add some "Jitter" (Optional)
        // Makes the line look like a fuzzy glowing beam instead of a laser
        vec3 jitter = vec3(
            rand(uv + uTime) - 0.5,
            rand(uv - uTime) - 0.5,
            rand(uv * 2.0) - 0.5
        ) * 0.2; // 0.2 width

        gl_FragColor = vec4(trackPos + jitter, 1.0);
    }
`

// ==========================================================
// 2. SHADERS
// ==========================================================
export const computeShaderPosition = /*glsl*/`
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
        
        gl_PointSize = 120.0 / -mvPosition.z; // adjusting point size.
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
        float t = 1.0 - exp(-vRadius * 0.5);
        
        vec3 baseColor = mix(colorCore, colorArm, t);

        // 4. ADD THE RED SPRINKLES
        // Logic: If we are in the "Arm Zone" (t > 0.5) 
        // AND this particle is lucky (vRandom > 0.9), turn it red.
        
        // We multiply 't' so red stars don't appear in the yellow core
        float redProbability = vRandom * t; 
        
        // If probability is high, mix in the red color
        // Threshold 0.8 means roughly 20% of outer stars will have a red tint
        float redMix = smoothstep(0.3, 0.95, redProbability);
        
        vec3 finalColor = mix(baseColor, colorH2, redMix);

        // Boost the brightness of red particles slightly so they pop
        if (redMix > 0.5) {
            finalColor *= 1.5;
        }

        gl_FragColor = vec4(finalColor, alpha);
    }
`;

// shadersSwarm.js (or just inline it next to your other shaders)
export const computeShaderSwarm = /* glsl */`
    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    vec2 rotate(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c) * v;
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 tmpPos = texture2D(texturePosition, uv);
        vec3 position = tmpPos.xyz;

        float r = length(position.xz) + 1e-6;

        // ---------------------------------
        // 1. Base orbital motion (simple rotation)
        // ---------------------------------
        float angularSpeed = 0.1;          // overall rotation speed
        float angleStep    = angularSpeed * 0.03;
        position.xz = rotate(position.xz, angleStep);

        // ---------------------------------
        // 2. Gentle radial wandering (random in/out)
        // ---------------------------------
        float noise = rand(uv + position.xz);
        float radialJitter = (noise - 0.5) * 0.05;
        vec2 radialDir = normalize(position.xz);
        position.xz += radialDir * radialJitter;

        // ---------------------------------
        // 3. Small vertical noise
        // ---------------------------------
        float yNoise = rand(uv + position.yz);
        position.y += (yNoise - 0.5) * 0.03;

        // ---------------------------------
        // 4. Respawn if too far or too close
        // ---------------------------------
        if (r < 2.0 || r > 30.0) {
            float baseR = 10.0 + rand(uv) * 8.0;               // ring between 10–18
            float theta = rand(uv + vec2(0.7, 0.3)) * 6.28318;  // random angle

            position.x = baseR * cos(theta);
            position.z = baseR * sin(theta);
            position.y = (rand(uv + vec2(1.3, 2.1)) - 0.5) * 1.0;
        }

        gl_FragColor = vec4(position, 1.0);
    }
`;


export const computeShaderMagnetic = /* glsl */`
    // ---------------------------------------------
    // Random helper
    // ---------------------------------------------
    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    // ---------------------------------------------
    // Magnetic dipole field B(x)
    // m = dipole moment vector (constant)
    // ---------------------------------------------
    vec3 dipoleField(vec3 pos, vec3 m) {
        float r = length(pos) + 1e-6;
        float r2 = r * r;
        float r3 = r2 * r;
        float r5 = r3 * r2;

        float mdotr = dot(m, pos);

        // B = 3 (m·r) r / r^5  -  m / r^3
        vec3 term1 = 3.0 * mdotr * pos / r5;
        vec3 term2 = m / r3;

        return term1 - term2;
    }

    // ---------------------------------------------
    // Main integration
    // ---------------------------------------------
    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;

        vec4 tmp = texture2D(texturePosition, uv);
        vec3 pos = tmp.xyz;

        // Dipole moment (change this for different field shapes)
        vec3 m = normalize(vec3(0.0, 2.0, 0.2));

        // Scale controls speed of flow along field lines
        float dt = 4.5;

        // -----------------------------------------
        // Compute magnetic field at position
        // -----------------------------------------
        vec3 B = dipoleField(pos, m);

        // -----------------------------------------
        // Integrate: move particle along field lines
        // -----------------------------------------
        pos += B * dt;

        // -----------------------------------------
        // Add small, controlled diffusion to break symmetry
        // -----------------------------------------
        float jitter = (rand(uv + pos.xy) - 0.5) * 0.03;
        pos += jitter * normalize(B + vec3(0.01));

        // -----------------------------------------
        // Respawn rule (if particle escapes too far)
        // -----------------------------------------
        float r = length(pos);
        if (r > 40.0 || r < 0.4) {
            float theta = rand(uv + pos.xy) * 6.28318;
            float phi   = rand(uv + pos.yz) * 3.14159;

            float baseR = 8.0 + rand(uv + pos.zx) * 10.0;

            pos.x = baseR * sin(phi) * cos(theta);
            pos.y = baseR * cos(phi);
            pos.z = baseR * sin(phi) * sin(theta);
        }

        gl_FragColor = vec4(pos, 1.0);
    }
`;