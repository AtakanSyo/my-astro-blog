// Small helpers to build simple instanced meshes for particles/ribbons.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

// Quad for instanced sprites/ribbons (two triangles)
export function makeInstancedQuads(instanceCount){
  const geo = new THREE.InstancedBufferGeometry();
  const base = new Float32Array([
    -1,-1,0,  1,-1,0,  1, 1,0,
    -1,-1,0,  1, 1,0, -1, 1,0
  ]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(base, 3));
  geo.instanceCount = instanceCount;
  return geo;
}

// Attach or update a float InstancedBufferAttribute
export function setInstancedAttr(geometry, name, array, itemSize=1){
  const attr = geometry.getAttribute(name);
  if (attr && attr.array.length === array.length) {
    attr.array.set(array);
    attr.needsUpdate = true;
  } else {
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, itemSize));
  }
}