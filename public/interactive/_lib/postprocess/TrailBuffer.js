import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';
import { fullscreen } from '../core.js';

export class TrailBuffer {
  constructor(renderer, decay = 0.92) {
    this.r = renderer; this.decay = decay;
    this.rtA = this.rtB = null; this.w = this.h = 0;
    const { geo, cam } = fullscreen();
    this.geo = geo; this.cam = cam;

    this.fadeMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { uTex:{ value:null }, uDecay:{ value: this.decay } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader:`precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uDecay;
                      void main(){ vec4 c=texture2D(uTex,vUv); gl_FragColor=vec4(c.rgb*uDecay, c.a*uDecay); }`
    });
    this.fsQuad = new THREE.Mesh(this.geo, this.fadeMat);
    this.scene = new THREE.Scene();
    this.scene.add(this.fsQuad);
  }

  ensure() {
    const w = this.r.domElement.width, h = this.r.domElement.height;
    if (this.rtA && this.rtB && w === this.w && h === this.h) return;
    this.w=w; this.h=h;
    this.rtA?.dispose(); this.rtB?.dispose();
    const params = { depthBuffer:true, stencilBuffer:false };
    this.rtA = new THREE.WebGLRenderTarget(w, h, params);
    this.rtB = new THREE.WebGLRenderTarget(w, h, params);
    this.r.setRenderTarget(this.rtA);
    this.r.clear(true, true, true);
    this.r.setRenderTarget(null);
  }

  fade() {
    this.r.setRenderTarget(this.rtB);
    this.fadeMat.uniforms.uTex.value = this.rtA.texture;
    this.r.render(this.scene, this.cam);
  }

  depth(sceneDepth, camera) {
    this.r.clearDepth();
    this.r.render(sceneDepth, camera);
  }

  draw(scene, camera) {
    this.r.render(scene, camera);
    const t = this.rtA; this.rtA = this.rtB; this.rtB = t;
  }

  texture() { return this.rtA.texture; }
}