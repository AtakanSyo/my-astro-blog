import { createThree, planetRadiusWorld } from '../_lib/core.js';
import { addGradientBackground, addVignette } from '../_lib/fx/Background.js';
import { TrailBuffer } from '../_lib/postprocess/TrailBuffer.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

export async function run(canvas, { pausedRef, options = {} } = {}) {
  // ---------- Boot ----------
  const MOBILE = matchMedia('(pointer:coarse)').matches || innerWidth < 768;
  const three = createThree(canvas, { dprCap: options.dprCap ?? 1.5, fov: 32, z: 6, clear: 0x0a0f16 });
  const { renderer, scene, camera, THREE: T } = three;

  addGradientBackground(scene, 0x0a0f16, 0x0e1a22);
  addVignette(scene, 0.24);

  // ---------- Globe (soft bands) ----------
  const globeGeo = new T.SphereGeometry(1, 96, 72);
  const globeMat = new T.ShaderMaterial({
    uniforms: {
      uTime:{ value:0 }, uSpin:{ value:0 }, uLight:{ value: new T.Vector3(-0.35,-0.25,0.9).normalize() }, uGamma:{ value:2.2 }
    },
    vertexShader:`varying vec3 vN; void main(){ vN=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      precision highp float; varying vec3 vN; uniform vec3 uLight; uniform float uSpin, uTime, uGamma;
      float fbm(vec2 p){ float v=0., a=0.5; for(int i=0;i<5;i++){ p*=2.03; v+=a*(fract(sin(dot(floor(p),vec2(127.1,311.7)))*43758.5453)); a*=0.55; } return v; }
      void main(){
        vec3 N=normalize(vN); float lat=asin(N.y); float lon=atan(N.z,N.x)+uSpin;
        float belts=0.5+0.5*sin(lat*8.7); 
        vec3 belt=vec3(0.70,0.52,0.36), zone=vec3(0.94,0.89,0.81);
        vec3 col=mix(zone,belt,belts); 
        col *= 0.92 + 0.08 * (fbm(vec2(lon*1.7,lat*3.1)+uTime*0.02));
        float diff=max(0., dot(N, normalize(uLight)));
        float rim=pow(1.0-max(0., dot(N, vec3(0,0,1))), 2.4)*0.35;
        col = col*(diff*1.05+0.10)+rim*vec3(0.22,0.25,0.30);
        col = pow(col, vec3(1.0/uGamma));
        gl_FragColor=vec4(col,1.0);
      }`
  });
  const globe = new T.Mesh(globeGeo, globeMat);
  scene.add(globe);

  // depth-only copy for trails occlusion
  const globeDepthMat = globeMat.clone(); globeDepthMat.colorWrite = false;
  const globeDepth = new T.Mesh(globeGeo, globeDepthMat);

  // ---------- Ribbons (non-crossing lanes, pretty) ----------
  const NUM     = options.numParticles ?? (MOBILE ? 6000 : 12000);
  const LANES   = MOBILE ? 22 : 28;
  const LAT_MIN = -70, LAT_MAX = 70, AMP_FRAC = 0.42, FREQ = 2.1;
  const SHELL   = 1.055;
  const LEN_R   = MOBILE ? 0.060 : 0.075;   // longer = creamier trails
  const WID_R   = MOBILE ? 0.008 : 0.0065;  // slightly thinner

  const quad = new Float32Array([-1,-1,0, 1,-1,0, 1, 1,0,  -1,-1,0, 1, 1,0, -1, 1,0]);
  const windGeo = new T.InstancedBufferGeometry();
  windGeo.setAttribute('position', new T.Float32BufferAttribute(quad, 3));

  const PER = Math.floor(NUM / LANES), COUNT = PER * LANES;
  windGeo.instanceCount = COUNT;

  const iLane = new Float32Array(COUNT);
  const iLon0 = new Float32Array(COUNT);
  const iSeed = new Float32Array(COUNT);
  const rng = mulberry32(0xC0FFEE);
  for (let i=0, lane=0; lane<LANES; lane++) {
    for (let j=0; j<PER; j++, i++) {
      iLane[i] = lane;
      iLon0[i] = rng() * 360;
      iSeed[i] = rng() * 1000;
    }
  }
  windGeo.setAttribute('iLane', new T.InstancedBufferAttribute(iLane, 1));
  windGeo.setAttribute('iLon0', new T.InstancedBufferAttribute(iLon0, 1));
  windGeo.setAttribute('iSeed', new T.InstancedBufferAttribute(iSeed, 1));

  const windMat = new T.ShaderMaterial({
    transparent:true, depthTest:true, depthWrite:false, blending:T.AdditiveBlending,
    uniforms: {
      uTime:{ value:0 }, uRes:{ value:new T.Vector2(1,1) }, uR:{ value:1.0 }, uShell:{ value:SHELL },
      uLenR:{ value:LEN_R }, uWidR:{ value:WID_R }, uSpin:{ value:0.0 },
      uLanes:{ value:LANES }, uLatMin:{ value:LAT_MIN }, uLatMax:{ value:LAT_MAX },
      uAmpFrac:{ value:AMP_FRAC }, uFreq:{ value:FREQ }
    },
    vertexShader: `
      precision highp float;
      attribute float iLane, iLon0, iSeed;
      uniform float uTime, uR, uShell, uLenR, uWidR, uSpin;
      uniform float uLanes, uLatMin, uLatMax, uAmpFrac, uFreq;
      varying float vLat, vHue, vT; varying vec2 vCorner;

      vec3 sph(float rad, float latD, float lonD){
        float la=radians(latD), lo=radians(lonD);
        float cl=cos(la), sl=sin(la);
        return vec3(rad*cl*cos(lo), rad*sl, rad*cl*sin(lo));
      }
      void basis(float latD, float lonD, out vec3 E, out vec3 N, out vec3 U){
        float la=radians(latD), lo=radians(lonD);
        float cl=cos(la), sl=sin(la), co=cos(lo), si=sin(lo);
        U=normalize(vec3(cl*co, sl, cl*si)); E=normalize(vec3(-cl*si, 0.0, cl*co)); N=normalize(vec3(-sl*co, cl, -sl*si));
      }
      float omegaLane(float latD){ float s=sign(sin(radians(latD)*3.4)); return (0.12+0.18*s)*(0.85+0.45*cos(radians(latD))); }

      void main(){
        float spacing=(uLatMax-uLatMin)/max(1.0,uLanes);
        float lat0 = mix(uLatMin, uLatMax, (iLane+0.5)/uLanes);
        float amp  = min(8.0, spacing*uAmpFrac);
        float lon  = iLon0 + omegaLane(lat0) * uTime * 60.0;
        float lat  = lat0 + amp * sin(radians(lon)*uFreq + iLane*1.23);

        float R=uR, Rs=uR*uShell;
        vec3 P = sph(Rs, lat, lon);

        vec3 E,N,U; basis(lat,lon,E,N,U);
        vec3 tangent=E, binorm=normalize(cross(U,tangent));
        float len = uLenR*R*(1.0 + 0.2*abs(sin(radians(lat))));
        float wid = uWidR*R*(1.0 + 0.12*(fract(iSeed*17.0)-0.5));

        vec3 off = tangent*(position.x*len) + binorm*(position.y*wid);

        float s=sin(uSpin), c=cos(uSpin);
        mat3 Ry = mat3( c,0.,s,  0.,1.,0.,  -s,0.,c );
        vec3 Pw = Ry*P, Ow = Ry*off;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(Pw+Ow, 1.0);

        vLat=lat; vHue=(fract(iSeed*13.7)-0.5)*0.06; vT=clamp(position.x*0.5+0.5,0.,1.); vCorner=position.xy;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vLat, vHue, vT; varying vec2 vCorner;
      float capsule(vec2 p,float h,float r){ p.x=abs(p.x)-h; return length(max(p,0.0))+min(0.0,max(p.x,p.y))-r; }
      vec3 palette(float lat){
        float k=0.5+0.5*sin(radians(lat)*9.0);
        vec3 BELT=vec3(0.70,0.52,0.36), ZONE=vec3(0.94,0.89,0.81);
        vec3 POL =vec3(0.45,0.55,0.68);
        float pol=smoothstep(radians(55.),radians(80.),abs(radians(lat)));
        vec3 c=mix(ZONE,BELT,k); c=mix(c,POL,0.45*pol); c*= (1.0-0.18*pol);
        return c;
      }
      void main(){
        vec2 p=vCorner*vec2(1.0,0.62);
        float d=capsule(p,1.0,0.86);
        float mask=smoothstep(0.02,-0.22,d);
        float head=smoothstep(0.75,0.05,vT);
        float tail=smoothstep(0.00,0.90,vT);
        float axis=mix(head,tail,0.35);
        vec3 col=palette(vLat)*(1.0+vHue);
        col=mix(col, vec3(1.0,0.96,0.92), 0.12*head);
        float a=mask*(0.20+0.80*axis);
        gl_FragColor=vec4(col*a,a);
      }`
  });
  const wind = new T.Mesh(windGeo, windMat);
  wind.frustumCulled = false;

  // ---------- Trails (accumulation buffer) ----------
  const trails = new TrailBuffer(renderer, MOBILE ? 0.90 : 0.93);
  const trailsVisMat = new T.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uTex:{ value: null } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader:`precision mediump float; varying vec2 vUv; uniform sampler2D uTex; void main(){ gl_FragColor=texture2D(uTex,vUv); }`
  });
  const fsQuad = new T.Mesh(new T.PlaneGeometry(2,2), trailsVisMat);
  fsQuad.renderOrder = 15; // over globe, under vignette
  scene.add(fsQuad);

  // ---------- Loop ----------
  const start = performance.now();
  renderer.setAnimationLoop(tick);

  function tick(now) {
    if (pausedRef && pausedRef()) return;

    trails.ensure();

    const t = (now - start) / 1000;
    const w = renderer.domElement.width, h = renderer.domElement.height;
    const Rw = planetRadiusWorld(renderer, camera, 0.33);
    const spin = THREE.MathUtils.degToRad((options.rotSpeedDeg ?? 0.35) * 60.0 * t);

    // globe
    globe.scale.set(Rw,Rw,Rw);
    globe.rotation.set(0, spin, 0);
    globeMat.uniforms.uTime.value = t;
    globeMat.uniforms.uSpin.value = spin;

    globeDepth.scale.copy(globe.scale);
    globeDepth.rotation.copy(globe.rotation);

    // ribbons
    windMat.uniforms.uTime.value = t;
    windMat.uniforms.uR.value = Rw;
    windMat.uniforms.uSpin.value = spin;

    // trails pass (fade → depth → ribbons)
    trails.fade();
    trails.depth(globeDepth, camera);
    trails.draw(wind, camera);

    renderer.setRenderTarget(null);

    // composite: bg + globe + trails + vignette
    trailsVisMat.uniforms.uTex.value = trails.texture();
    renderer.render(scene, camera);
  }

  function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
}