export function magneticDipoleFieldExtension({
  color = 0x66ccff,
  opacity = 0.7,
  rotationSpeed = 0.25,
  phiLines = 10,
  lShells = [1.6, 2.2, 3.0],
  segments = 180,
} = {}) {
  return ({ THREE, scene, simHandle, radius }) => {
    const parent =
      simHandle?.mesh ??
      simHandle?.planetMesh ??
      simHandle?.planet ??
      simHandle?.group ??
      scene;

    const group = new THREE.Group();
    group.name = 'magnetic-field';

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });

    const geometries = [];
    const lines = [];

    const addFieldLine = (L, phi) => {
      const min = Math.asin(Math.sqrt(Math.min(1, radius / L)));
      const max = Math.PI - min;
      const points = [];

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const theta = min + (max - min) * t;
        const sin = Math.sin(theta);
        const cos = Math.cos(theta);
        const r = L * sin * sin;

        const x = r * sin * Math.cos(phi);
        const y = r * cos;
        const z = r * sin * Math.sin(phi);
        points.push(new THREE.Vector3(x, y, z));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      geometries.push(geometry);
      const line = new THREE.Line(geometry, material);
      lines.push(line);
      group.add(line);
    };

    // Visual dipole field lines using L-shells: r = L * sin^2(theta)
    for (const shellMul of lShells) {
      const L = radius * shellMul;
      for (let i = 0; i < phiLines; i++) {
        const phi = (i / phiLines) * Math.PI * 2;
        addFieldLine(L, phi);
      }
    }

    parent.add(group);

    return {
      update(delta) {
        if (!delta) return;
        group.rotation.y += rotationSpeed * delta;
      },
      dispose() {
        parent.remove(group);
        for (const line of lines) group.remove(line);
        for (const g of geometries) g.dispose();
        material.dispose();
      },
    };
  };
}

