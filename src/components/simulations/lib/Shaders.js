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
        float armCount = 6.0;
        float twist = 16.0;
        float patternSpeed = 0.05; 

        // Current Angle of the rotating arm structure
        float angle = atan(pos.z, pos.x);
        float domainAngle = angle - (uTime * patternSpeed);
        
        float mathR = max(r, 0.5);
        float spiralPhase = domainAngle * armCount + twist * log(mathR);
        
        float armProximity = 0.5 + 0.5 * cos(spiralPhase);
        armProximity = pow(armProximity, 3.0); 

        // Core Fix
        float coreRadius = 2.5;
        float coreFade = smoothstep(0.0, coreRadius, r); 
        float effectiveProximity = mix(1.0, armProximity, coreFade);

        // ============================================
        // 2) PHYSICS & INDIVIDUAL VARIANCE
        // ============================================
        
        // Base Flow (Density Wave Logic)
        float armRelSpeed = 0.06; 
        float voidRelSpeed = 0.1; 
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