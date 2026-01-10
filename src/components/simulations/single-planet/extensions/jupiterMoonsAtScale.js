export function jupiterMoonsAtScaleExtension({
  // Multiplier applied to real moon distances (in Jupiter radii).
  distanceScale = 1,
  // Multiplier applied to moon radii relative to Jupiter.
  sizeScale = 1,
  // 'line' places moons along +X; 'orbit' distributes on a ring at their scaled distance.
  layout = 'line',
  // Number of moons to show (default: the 4 Galilean moons).
  moons = ['io', 'europa', 'ganymede', 'callisto'],
  opacity = 1,
} = {}) {
  return ({ THREE, scene, planetKey, radius: planetRadiusScene }) => {
    if (planetKey !== 'jupiter') return null;

    // Mean radii (km) and semi-major axes (km) from Jupiter center.
    // Source: commonly cited NASA fact sheets / standard astronomical references.
    const JUPITER_RADIUS_KM = 69911;
    const MOONS = {
      io: { name: 'Io', radiusKm: 1821.6, aKm: 421700, color: 0xf2d16b },
      europa: { name: 'Europa', radiusKm: 1560.8, aKm: 671034, color: 0xcfd8e6 },
      ganymede: { name: 'Ganymede', radiusKm: 2634.1, aKm: 1070400, color: 0xb9b0a3 },
      callisto: { name: 'Callisto', radiusKm: 2410.3, aKm: 1882700, color: 0x7f6d5c },
    };

    const group = new THREE.Group();
    group.name = 'jupiter-moons';

    const geometries = [];
    const materials = [];
    const meshes = [];

    const ids = Array.isArray(moons) ? moons : [];
    for (let i = 0; i < ids.length; i += 1) {
      const id = String(ids[i] ?? '').toLowerCase();
      const data = MOONS[id];
      if (!data) continue;

      const moonRadiusScene =
        planetRadiusScene * (data.radiusKm / JUPITER_RADIUS_KM) * sizeScale;
      const aScene =
        planetRadiusScene * (data.aKm / JUPITER_RADIUS_KM) * distanceScale;

      const geometry = new THREE.SphereGeometry(moonRadiusScene, 32, 32);
      geometries.push(geometry);

      const material = new THREE.MeshStandardMaterial({
        color: data.color,
        roughness: 1,
        metalness: 0,
        transparent: opacity < 1,
        opacity,
      });
      materials.push(material);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `moon-${id}`;

      if (layout === 'orbit') {
        const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
        mesh.position.set(Math.cos(angle) * aScene, 0, Math.sin(angle) * aScene);
      } else {
        mesh.position.set(aScene, 0, 0);
      }

      meshes.push(mesh);
      group.add(mesh);
    }

    scene.add(group);

    return {
      dispose() {
        scene.remove(group);
        for (const m of meshes) group.remove(m);
        for (const g of geometries) g.dispose();
        for (const mat of materials) mat.dispose();
      },
    };
  };
}

