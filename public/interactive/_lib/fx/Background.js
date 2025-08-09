import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';
import { fullscreen } from '../core.js';  // ✅ correct relative path

export function addGradientBackground(scene, col1 = 0x0a0f16, col2 = 0x11202a) {
  const { geo } = fullscreen();
  const c1 = new THREE.Color(col1), c2 = new THREE.Color(col2);
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader: `
      precision mediump float; varying vec2 vUv;
      void main(){
        vec2 p=vUv*2.0-1.0; float r=length(p);
        vec3 a=vec3(${c1.r},${c1.g},${c1.b});
        vec3 b=vec3(${c2.r},${c2.g},${c2.b});
        gl_FragColor=vec4(mix(a,b,smoothstep(0.1,1.1,r)),1.0);
      }`
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  scene.add(mesh);
  return mesh;
}

export function addVignette(scene, strength = 0.22) {
  const { geo } = fullscreen();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader: `
      precision mediump float; varying vec2 vUv; uniform float uS; 
      void main(){ vec2 p=vUv*2.-1.; float a=smoothstep(1.,0.2,length(p))*uS; gl_FragColor=vec4(0,0,0,a); }`,
    uniforms: { uS: { value: strength } }
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 20;
  scene.add(mesh);
  return mesh;
}