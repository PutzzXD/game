// Map Angkasa - module mandiri untuk PARKOUR 3D.
// API sengaja mengikuti pola buildSnowWorld(THREE, scene, deps):
// mengembalikan { world, group, controller }.
export function buildAngkasaWorld(THREE, scene, deps = {}) {
  const group = new THREE.Group();
  group.name = 'ANGKASA_WORLD';
  group.visible = false;
  scene.add(group);

  const platforms = [];
  const hazards = [];
  const guards = [];
  const materials = {
    deck: new THREE.MeshStandardMaterial({ color: 0x26365f, metalness: 0.72, roughness: 0.3 }),
    deckAlt: new THREE.MeshStandardMaterial({ color: 0x3b2c70, metalness: 0.65, roughness: 0.32 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x152c55, emissive: 0x168cff, emissiveIntensity: 0.65, metalness: 0.55, roughness: 0.28 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xff4b83, emissive: 0xa50049, emissiveIntensity: 1.1, metalness: 0.35, roughness: 0.3 }),
    meteor: new THREE.MeshStandardMaterial({ color: 0x9b7865, emissive: 0x3b1a12, emissiveIntensity: 0.35, roughness: 0.9 }),
    checkpoint: new THREE.MeshStandardMaterial({ color: 0x23d69a, emissive: 0x087d62, emissiveIntensity: 0.9 })
  };

  const add = (geo, mat, x, y, z, parent = group) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Bintang-bintang jauh sebagai satu objek Points agar ringan di Android.
  const starPositions = [];
  let seed = 9173;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 900; i++) {
    starPositions.push((rand() - 0.5) * 260, rand() * 110 - 12, -rand() * 250 - 12);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xd9e8ff, size: 0.42, sizeAttenuation: true, transparent: true, opacity: 0.9
  })));

  // Planet besar sebagai dekorasi latar, bukan collider.
  const planet = add(new THREE.SphereGeometry(13, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0x5743a8, roughness: 0.85, emissive: 0x17104a, emissiveIntensity: 0.4 }),
    -34, 24, -83);
  const ring = add(new THREE.TorusGeometry(18, 0.55, 8, 72),
    new THREE.MeshBasicMaterial({ color: 0x6edbff, transparent: true, opacity: 0.65 }),
    -34, 24, -83);
  ring.rotation.x = 0.9;
  const bluePlanet = add(new THREE.SphereGeometry(7, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0x1a9bba, roughness: 0.7, emissive: 0x073b5a, emissiveIntensity: 0.4 }),
    34, 16, -145);

  const createPlatform = (x, y, z, width, depth, type = 'static', shape = 'box', options = {}) => {
    const h = options.height || 0.5;
    let geo;
    if (shape === 'round') geo = new THREE.CylinderGeometry(width / 2, width / 2, h, 24);
    else if (shape === 'hex') geo = new THREE.CylinderGeometry(width * 0.48, width * 0.48, h, 6);
    else geo = new THREE.BoxGeometry(width, h, depth);
    const mat = options.material || ((platforms.length % 2) ? materials.deck : materials.deckAlt);
    const mesh = add(geo, mat, x, y, z);
    if (options.glow !== false) {
      const rimGeo = shape === 'box'
        ? new THREE.BoxGeometry(width * 0.98, 0.07, depth * 0.98)
        : new THREE.CylinderGeometry(width * 0.49, width * 0.49, 0.07, shape === 'hex' ? 6 : 24);
      const rim = add(rimGeo, materials.glow, 0, h * 0.5 + 0.025, 0, mesh);
      rim.userData.isDecoration = true;
    }
    const p = {
      mesh, width, depth, type,
      startX: x, startY: y, startZ: z,
      range: options.range ?? 1.6,
      speed: options.speed ?? 1.25,
      phase: rand() * Math.PI * 2,
      isFallen: false, tell: 0, revealTimer: 0, dx: 0,
      r: shape === 'round' ? width / 2 : (shape === 'hex' ? width * 0.45 : 0),
      hh: h / 2
    };
    if (options.checkpoint) {
      p.checkpoint = true;
      p.checkpointActivated = false;
      p.checkpointReadyMaterial = materials.checkpoint;
      mesh.material = materials.checkpoint;
    }
    platforms.push(p);
    return p;
  };

  // Start + lintasan utama panjang dengan variasi ketinggian dan jalur.
  createPlatform(0, 0, 0, 9, 9, 'static', 'box', { glow: true });
  const route = [
    [0, 0.4, -7, 5, 5, 'round'],
    [-2.4, 0.8, -14, 4.2, 4.2, 'hex'],
    [2.4, 1.2, -21, 4.2, 4.2, 'round'],
    [0, 1.6, -28, 5.2, 4.8, 'moving_x'],
    [-2.8, 2.0, -35, 4.2, 4.2, 'box'],
    [0, 2.4, -42, 5.5, 5.5, 'round'],
    [2.8, 2.8, -49, 4.2, 4.2, 'hex'],
    [0, 3.2, -56, 5.5, 5.5, 'box'],
    [-2.5, 3.6, -63, 4.2, 4.2, 'moving_x'],
    [0, 4.0, -70, 5.5, 5.5, 'round'],
    [2.5, 4.4, -77, 4.2, 4.2, 'fake'],
    [0, 4.8, -84, 6, 6, 'box'],
    [-2.6, 5.2, -91, 4.2, 4.2, 'round'],
    [0, 5.6, -98, 5.5, 5.5, 'moving_y'],
    [2.6, 6.0, -105, 4.2, 4.2, 'hex'],
    [0, 6.4, -112, 6, 6, 'box'],
    [-2.5, 6.8, -119, 4.2, 4.2, 'moving_x'],
    [0, 7.2, -126, 5.5, 5.5, 'round'],
    [2.5, 7.6, -133, 4.2, 4.2, 'fake'],
    [0, 8.0, -140, 6, 6, 'box'],
    [-2.5, 8.2, -147, 4.2, 4.2, 'round'],
    [0, 8.4, -154, 5.5, 5.5, 'moving_y'],
    [0, 8.5, -162, 8, 8, 'box']
  ];
  route.forEach((v, i) => {
    const [x, y, z, w, d, type] = v;
    const shape = type === 'round' ? 'round' : type === 'hex' ? 'hex' : 'box';
    const p = createPlatform(x, y, z, w, d, type === 'moving_x' || type === 'moving_y' || type === 'fake' ? type : 'static', shape, {
      range: i > 12 ? 2.0 : 1.45,
      speed: 1.1 + i * 0.025,
      checkpoint: [5, 11, 17].includes(i)
    });
    if (type === 'fake') p.tell = 0.25;
  });

  // Jalur alternatif kiri/kanan yang kembali ke jalur utama.
  createPlatform(-7, 2.1, -35, 3.4, 3.4, 'static', 'round');
  createPlatform(-9, 2.5, -41, 3.4, 3.4, 'static', 'hex');
  createPlatform(-6, 3.0, -47, 3.4, 3.4, 'static', 'round');
  createPlatform(7, 5.7, -104, 3.4, 3.4, 'static', 'round');
  createPlatform(9, 6.2, -110, 3.4, 3.4, 'static', 'hex');
  createPlatform(6, 6.7, -116, 3.4, 3.4, 'static', 'round');

  // Jembatan sempit bercahaya untuk bagian lintasan yang lebih teknis.
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x1d4b79, emissive: 0x075080, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.3 });
  const bridge1 = add(new THREE.BoxGeometry(1.7, 0.22, 12), bridgeMat, 0, 2.0, -37.5);
  bridge1.userData.isDecoration = true;
  const bridge2 = add(new THREE.BoxGeometry(1.7, 0.22, 12), bridgeMat, 0, 6.2, -108.5);
  bridge2.userData.isDecoration = true;

  // Meteor bergerak melintasi lintasan; tabrakan memberi knockback melalui hazards.test.
  const meteorA = add(new THREE.IcosahedronGeometry(1.15, 1), materials.meteor, -5, 3.2, -55);
  const meteorB = add(new THREE.IcosahedronGeometry(1.35, 1), materials.meteor, 5, 6.7, -122);
  const meteorHazard = (mesh, baseX, baseY, baseZ, amplitude, speed, phase) => {
    let x = baseX, z = baseZ;
    hazards.push({
      update(t) {
        x = baseX + Math.sin(t * speed + phase) * amplitude;
        z = baseZ + Math.cos(t * speed * 0.7 + phase) * 1.2;
        mesh.position.set(x, baseY + Math.sin(t * speed * 1.4 + phase) * 0.7, z);
        mesh.rotation.x += 0.025;
        mesh.rotation.y += 0.035;
      },
      test(pp) {
        const dx = pp.x - x, dz = pp.z - z, dy = (pp.y + 0.8) - mesh.position.y;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1.65) {
          const len = Math.hypot(dx, dz) || 1;
          return { x: dx / len, z: dz / len };
        }
        return null;
      }
    });
  };
  meteorHazard(meteorA, -5, 3.2, -55, 4.2, 1.15, 0.4);
  meteorHazard(meteorB, 5, 6.7, -122, 4.8, 1.35, 2.1);

  // Palang berputar di atas platform.
  const makeSweeper = (x, y, z, length, speed) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y + 1.0, z);
    group.add(pivot);
    add(new THREE.CylinderGeometry(0.25, 0.3, 0.55, 12), materials.deck, 0, -0.28, 0, pivot);
    const bar = add(new THREE.BoxGeometry(length, 0.32, 0.38), materials.hazard, 0, 0, 0, pivot);
    let angle = 0;
    hazards.push({
      update(t) { angle = t * speed; pivot.rotation.y = angle; },
      test(pp) {
        const dx = pp.x - x, dz = pp.z - z;
        const c = Math.cos(angle), sn = Math.sin(angle);
        const along = dx * c + dz * sn;
        const across = -dx * sn + dz * c;
        if (Math.abs(along) < length / 2 + 0.35 && Math.abs(across) < 0.65 &&
            pp.y < y + 1.8 && pp.y + 1.7 > y + 0.45) {
          return { x: -sn * (across >= 0 ? 1 : -1), z: c * (across >= 0 ? 1 : -1) };
        }
        return null;
      }
    });
  };
  makeSweeper(0, 4.8, -84, 5.8, 1.55);
  makeSweeper(0, 8.0, -140, 6.0, 1.9);

  // Gerbang laser berdenyut dengan collider sederhana.
  const laserGroup = new THREE.Group();
  laserGroup.position.set(0, 6.0, -112);
  group.add(laserGroup);
  const laserBeam = add(new THREE.BoxGeometry(7.8, 0.18, 0.18), materials.hazard, 0, 1.3, 0, laserGroup);
  for (const side of [-1, 1]) {
    const emitter = add(new THREE.CylinderGeometry(0.38, 0.38, 1.0, 12),
      new THREE.MeshStandardMaterial({ color: 0x17213e, emissive: 0x267dff, emissiveIntensity: 1.2 }),
      side * 3.9, 1.3, 0, laserGroup);
  }
  hazards.push({
    update(t) {
      const active = Math.sin(t * 2.1) > -0.15;
      laserBeam.visible = active;
      laserBeam.material.emissiveIntensity = active ? 1.8 : 0.25;
    },
    test(pp) {
      if (!laserBeam.visible) return null;
      if (Math.abs(pp.z + 112) < 0.48 && Math.abs(pp.x) < 3.75 &&
          pp.y < 7.6 && pp.y + 1.5 > 7.05) {
        const side = pp.x >= 0 ? 1 : -1;
        return { x: side, z: 0.25 };
      }
      return null;
    }
  });

  // Asteroid kecil dekoratif mengambang di sepanjang lintasan.
  for (let i = 0; i < 26; i++) {
    const x = (rand() - 0.5) * 34;
    const y = 2 + rand() * 17;
    const z = -rand() * 165 - 5;
    const size = 0.35 + rand() * 1.0;
    const rock = add(new THREE.IcosahedronGeometry(size, 0), materials.meteor, x, y, z);
    rock.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
  }

  // Finish pad dan gerbang finish.
  const finishY = 8.5, finishZ = -162;
  const finishPad = platforms.find(p => Math.abs(p.mesh.position.z - finishZ) < 0.01);
  if (finishPad) {
    finishPad.checkpoint = true;
    finishPad.checkpointActivated = false;
    finishPad.checkpointReadyMaterial = materials.checkpoint;
    finishPad.mesh.material = materials.checkpoint;
  }
  const finishArchMat = new THREE.MeshStandardMaterial({ color: 0x37f5c2, emissive: 0x0b9b7b, emissiveIntensity: 1.1 });
  add(new THREE.BoxGeometry(0.35, 4.2, 0.35), finishArchMat, -3.8, finishY + 2.1, finishZ);
  add(new THREE.BoxGeometry(0.35, 4.2, 0.35), finishArchMat, 3.8, finishY + 2.1, finishZ);
  add(new THREE.BoxGeometry(7.9, 0.35, 0.35), finishArchMat, 0, finishY + 4.1, finishZ);

  const controller = {
    reset(physics) {
      // Gravitasi default game dipulihkan sebelum map lain/lobby aktif.
      if (physics) physics.gravity = -32;
      this.lowGravity = false;
    },
    update(delta, state = {}) {
      if (!state.physics || !state.character) return;
      // Zona gravitasi rendah di bagian tengah map.
      const z = state.character.position.z;
      const inLowGravity = z < -91 && z > -121 && !state.flyMode;
      state.physics.gravity = inLowGravity ? -17 : -32;
      this.lowGravity = inLowGravity;
    },
    updateHud() {}
  };

  const world = {
    platforms, hazards, guards, laserBeam: null,
    FIN_Y: finishY + 0.25,
    WIN: { x: 0, y: finishY, z: finishZ },
    MAZE_H: 0,
    MAZE_Z: 0
  };

  return { world, group, controller };
}
