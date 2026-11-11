// SUPER SLIDE - map parkour waterpark tropis untuk game Three.js.
// API sengaja mengikuti pola buildSnowWorld(THREE, scene, api).
// Catatan integrasi: main.js tetap perlu mendaftarkan map ini, memanggil updateSuperSlideWorld
// setiap frame, dan menyediakan input/pose crawl-slide jika kontrol manual diinginkan.
export function buildSuperSlideWorld(THREE, scene, api = {}) {
  const group = new THREE.Group();
  group.name = 'SUPER_SLIDE_WORLD';
  group.visible = false;
  scene.add(group);

  const platforms = [], checkpoints = [], rotators = [], movers = [], splashParticles = [];
  const slideSegments = [];
  const route = [];
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

  group.add(new THREE.HemisphereLight(0xc9f5ff, 0x12617c, 1.35));
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.7);
  sun.position.set(-45, 90, 35);
  group.add(sun);

  const seaMat = new THREE.MeshStandardMaterial({ color: 0x078fc0, roughness: 0.22, metalness: 0.18, transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(650, 650, 48, 48), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -8, -72);
  group.add(sea);
  const seaPositions = sea.geometry.attributes.position;
  const seaBase = new Float32Array(seaPositions.array);

  const slideMat = new THREE.MeshStandardMaterial({ color: 0x12c9e8, roughness: 0.16, metalness: 0.24, emissive: 0x064d68, emissiveIntensity: 0.32, side: THREE.DoubleSide });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf4ffff, roughness: 0.2, metalness: 0.15 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x078bb5, roughness: 0.24, metalness: 0.18 });
  const coralMat = new THREE.MeshStandardMaterial({ color: 0xff8b65, roughness: 0.65 });
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x76502d, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x19a66b, roughness: 0.8, side: THREE.DoubleSide });
  const cpMat = new THREE.MeshStandardMaterial({ color: 0x39ffba, emissive: 0x18b982, emissiveIntensity: 0.7 });
  const obstacleMat = new THREE.MeshStandardMaterial({ color: 0xffa52f, roughness: 0.3, metalness: 0.15, emissive: 0x743300, emissiveIntensity: 0.25 });

  function addPlatform(x, y, z, w, d, opts = {}) {
    const h = opts.h || 0.55;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.checkpoint ? cpMat : (opts.material || deckMat));
    mesh.position.set(x, y - h / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
    const p = { mesh, width: w, depth: d, hh: h / 2, type: opts.type || 'static', isFallen: false, dx: 0,
      startX: x, startY: mesh.position.y, startZ: z, grip: opts.grip || [0.42, 0.28] };
    if (opts.checkpoint) {
      p.checkpoint = true; p.checkpointActivated = false; checkpoints.push(p);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 10), edgeMat);
      pole.position.set(x + w * 0.34, y + 1.6, z); group.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.85), cpMat);
      flag.position.set(x + w * 0.34 + 0.7, y + 2.55, z); group.add(flag);
    }
    platforms.push(p); if (opts.route !== false) route.push(p);
    return p;
  }

  function addSlideSegment(a, b, width = 7.2) {
    const mid = v3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const length = Math.hypot(dx, dy, dz);
    const direction = v3(dx, dy, dz).normalize();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.28, length + 1.4), slideMat);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(v3(0, 0, 1), direction);
    group.add(mesh);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, length + 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x4bcfff, emissiveIntensity: 0.28, roughness: 0.22 }));
    stripe.position.set(0, 0.17, 0); mesh.add(stripe);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.72, length + 1.4), edgeMat);
      rail.position.set(side * (width / 2 - 0.17), 0.38, 0);
      mesh.add(rail);
    }
    // Collider mengikuti bidang prosotan yang miring, bukan kotak datar.
    // Karakter hanya dianggap menginjak prosotan saat benar-benar berada di atas mesh ini.
    slideSegments.push({ a: v3(a.x, a.y, a.z), b: v3(b.x, b.y, b.z), width, slideDir: direction,
      slideSpeed: 19 + Math.min(5, Math.abs(dy) * 0.35), type: 'slide', grip: [0.12, 0.08], mesh });
  }

  // Pulau tropis dekoratif dan pohon palem ringan.
  function island(x, z, radius, height) {
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.18, height, 24), new THREE.MeshStandardMaterial({ color: 0xe9d49a, roughness: 1 }));
    sand.position.set(x, -7.1 + height / 2, z); group.add(sand);
    const green = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, 0.5, 24), new THREE.MeshStandardMaterial({ color: 0x269b61, roughness: 1 }));
    green.position.set(x, -7.1 + height + 0.2, z); group.add(green);
    for (let i = 0; i < 3; i++) {
      const px = x + Math.cos(i * 2.1) * radius * 0.3, pz = z + Math.sin(i * 2.1) * radius * 0.3;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 4.2, 7), palmMat);
      trunk.position.set(px, -4.4 + height, pz); trunk.rotation.z = (i - 1) * 0.12; group.add(trunk);
      const crown = new THREE.Group(); crown.position.set(px, -2.3 + height, pz); group.add(crown);
      for (let j = 0; j < 6; j++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.32, 3.2, 5), leafMat);
        leaf.position.y = -0.15; leaf.rotation.z = Math.PI / 2.6; leaf.rotation.y = j * Math.PI / 3; crown.add(leaf);
      }
    }
  }
  island(-48, -28, 13, 3.2); island(55, -86, 17, 3.8); island(-58, -142, 12, 2.8); island(62, -190, 15, 3.1);

  // Menara start dan tangga naik.
  addPlatform(0, 32, 8, 14, 14, { material: deckMat });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 7, 27, 24), new THREE.MeshStandardMaterial({ color: 0x11a9c8, roughness: 0.3, metalness: 0.2 }));
  tower.position.set(0, 17, 8); group.add(tower);
  for (let i = 0; i < 12; i++) addPlatform(0, 5 + i * 2.15, 19 - i * 0.95, 5.5, 3.2, { material: i % 2 ? deckMat : slideMat });
  const startSign = new THREE.Mesh(new THREE.BoxGeometry(8, 2.4, 0.25), obstacleMat);
  startSign.position.set(0, 35, 1); group.add(startSign);

  // Jalur panjang: zig-zag, spiral besar, tanjakan pendek, terowongan, dan drop terakhir.
  const pts = [
    {x:0,y:30,z:-1},{x:10,y:26,z:-13},{x:22,y:22,z:-25},{x:20,y:18,z:-40},
    {x:7,y:14,z:-51},{x:-9,y:10,z:-59},{x:-22,y:7,z:-73},{x:-20,y:5,z:-90},
    {x:-5,y:3,z:-101},{x:12,y:1,z:-112},{x:20,y:-1,z:-128},{x:12,y:-3,z:-143},
    {x:-5,y:-5,z:-151},{x:-19,y:-7,z:-165},{x:-15,y:-9,z:-181},{x:2,y:-11,z:-190},
    {x:18,y:-13,z:-204},{x:8,y:-15,z:-218},{x:-8,y:-17,z:-231},{x:0,y:-19,z:-246}
  ];
  for (let i = 0; i < pts.length - 1; i++) addSlideSegment(pts[i], pts[i + 1], i % 5 === 2 ? 6.0 : 7.2);

  // Checkpoint menjadi penanda pada permukaan prosotan, bukan balok/platform tambahan.
  const cpIndices = [3, 8, 13, 17];
  cpIndices.forEach((index) => {
    const seg = slideSegments[index];
    if (seg) { seg.checkpoint = true; seg.checkpointActivated = false; checkpoints.push(seg); }
  });

  // Rintangan: palang rendah (visual), gerbang, baling-baling, dan dinding zig-zag.
  function lowBar(x, y, z, width = 5.8) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.45, 0.55), obstacleMat);
    bar.position.set(x, y + 1.05, z); group.add(bar);
    const legs = [-1, 1].map(s => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.1, 0.45), edgeMat); leg.position.set(x + s * (width / 2 - 0.2), y + 0.05, z); group.add(leg); return leg; });
  }
  lowBar(20, 18, -39); lowBar(-20, 4.8, -89); lowBar(12, -2, -142); lowBar(-15, -8, -180);

  function gate(x, y, z, width = 6.2, height = 3.5) {
    const postMat = new THREE.MeshStandardMaterial({ color: 0xff6f61, roughness: 0.4 });
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, height, 0.55), postMat); post.position.set(x + s * width / 2, y + height / 2, z); group.add(post); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.5, 0.65), postMat); top.position.set(x, y + height, z); group.add(top);
  }
  gate(7, 12, -51); gate(-5, -4, -151); gate(8, -14, -218);

  function spinner(x, y, z, length, speed) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); group.add(pivot);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.8, 16), obstacleMat); hub.rotation.x = Math.PI / 2; pivot.add(hub);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(length, 0.28, 0.42), obstacleMat);
      arm.position.x = length * 0.43; arm.rotation.y = i * Math.PI * 2 / 3; pivot.add(arm);
    }
    rotators.push({ mesh: pivot, speed, radius: length * 0.55 });
  }
  spinner(20, 18, -40, 5.2, 1.8); spinner(-20, 5, -90, 5.0, -1.55); spinner(12, -2, -143, 5.5, 1.9);

  // Terowongan pendek dan bagian jalur bergelombang sebagai elemen visual.
  function tunnel(x, y, z, width = 7, length = 8) {
    const archMat = new THREE.MeshStandardMaterial({ color: 0x087eaa, roughness: 0.22, metalness: 0.25 });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(width * 0.47, 0.42, 10, 28, Math.PI), archMat);
    arch.position.set(x, y + 1.1, z); arch.rotation.z = Math.PI; group.add(arch);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, 0.38, length), archMat); roof.position.set(x, y + 2.5, z); group.add(roof);
  }
  tunnel(-9, 9, -59, 6.4, 7); tunnel(-19, -8, -165, 6.4, 7);

  // Pagar pinggir dan dekorasi pelampung.
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const mid = v3((a.x+b.x)/2, (a.y+b.y)/2 + 1.0, (a.z+b.z)/2);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, Math.hypot(b.x-a.x, b.z-a.z)), edgeMat);
    rail.position.copy(mid); rail.rotation.y = Math.atan2(b.x-a.x, b.z-a.z); group.add(rail);
  }
  for (let i = 0; i < 18; i++) {
    const buoy = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.22, 8, 18), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff6b6b : 0xffdf5d, roughness: 0.4 }));
    buoy.position.set(Math.sin(i * 2.4) * 48, -6.5, -15 - i * 13); buoy.rotation.x = Math.PI / 2; group.add(buoy);
  }

  // Dekorasi waterpark tambahan: pilar penyangga, cincin bonus, papan arah, dan pancuran.
  const supportMat = new THREE.MeshStandardMaterial({ color: 0x087b9d, roughness: 0.35, metalness: 0.25 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffdf59, emissive: 0x9a5d00, emissiveIntensity: 0.35, metalness: 0.45, roughness: 0.2 });
  pts.forEach((p, i) => {
    if (i % 2 === 0) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, Math.max(2, p.y + 8), 8), supportMat);
      pillar.position.set(p.x, (p.y - 8) / 2, p.z); group.add(pillar);
    }
    if (i > 1 && i < pts.length - 2 && i % 3 === 0) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.22, 10, 28), ringMat);
      ring.position.set(p.x, p.y + 2.2, p.z); ring.rotation.x = Math.PI / 2; group.add(ring);
    }
  });
  // Air mancur di sisi lintasan sebagai landmark visual.
  for (let i = 0; i < 7; i++) {
    const z = -22 - i * 31;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 0.7, 16), coralMat);
    base.position.set(i % 2 ? 33 : -34, -5.5, z); group.add(base);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.42, 4.5, 10), new THREE.MeshStandardMaterial({ color: 0x9df5ff, transparent: true, opacity: 0.72, emissive: 0x28bfff, emissiveIntensity: 0.45 }));
    jet.position.set(i % 2 ? 33 : -34, -2.8, z); group.add(jet);
  }
  // Papan petunjuk di start dan menjelang finish.
  function sign(text, x, y, z, color = '#ffffff') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#075b80'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = color; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, emissive: 0x123344, emissiveIntensity: 0.25 }));
    board.position.set(x, y, z); group.add(board);
  }
  sign('GET READY!', 0, 38, 0, '#ffe66d');
  sign('SLIDE TO WIN!', 0, -10, -238, '#ffffff');

  // Area finish dan papan kemenangan.
  const finish = { x: 0, y: -19.1, z: -246 };
  addPlatform(finish.x, finish.y, finish.z, 15, 15, { material: cpMat, grip: [0.7, 0.6] });
  const finishArch = new THREE.Mesh(new THREE.TorusGeometry(5, 0.38, 10, 32), cpMat);
  finishArch.position.set(finish.x, finish.y + 4.0, finish.z); group.add(finishArch);
  const finishBoard = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 0.35), obstacleMat);
  finishBoard.position.set(0, finish.y + 7, finish.z); group.add(finishBoard);

  // Efek partikel cipratan di permukaan laut (dekoratif, ringan).
  const splashGeo = new THREE.BufferGeometry();
  const splashCount = 90, splashPos = new Float32Array(splashCount * 3);
  for (let i = 0; i < splashCount; i++) { splashPos[i*3] = (Math.random()-0.5)*120; splashPos[i*3+1] = -6.8 + Math.random()*0.5; splashPos[i*3+2] = -Math.random()*260; }
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
  const splashes = new THREE.Points(splashGeo, new THREE.PointsMaterial({ color: 0xd8ffff, size: 0.38, transparent: true, opacity: 0.7 }));
  group.add(splashes);

  const start = [0, 32.3, 8];
  const tp = p => [p.x, p.y + 0.4, p.z];
  function update(delta, elapsed = performance.now() * 0.001) {
    // Gelombang laut procedural.
    for (let i = 0; i < seaPositions.count; i++) {
      const x = seaBase[i*3], z = seaBase[i*3+2];
      seaPositions.array[i*3+1] = seaBase[i*3+1] + Math.sin(x*0.035 + elapsed*1.2) * 0.22 + Math.cos(z*0.028 + elapsed*0.85) * 0.16;
    }
    seaPositions.needsUpdate = true; sea.geometry.computeVertexNormals();
    for (const r of rotators) r.mesh.rotation.y += r.speed * delta;
    splashes.rotation.y = Math.sin(elapsed * 0.15) * 0.025;
  }

  function getSlideGround(x, z, feetY) {
    let best = null;
    for (const seg of slideSegments) {
      const dx = seg.b.x - seg.a.x, dz = seg.b.z - seg.a.z;
      const len2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - seg.a.x) * dx + (z - seg.a.z) * dz) / len2));
      const px = seg.a.x + dx * t, pz = seg.a.z + dz * t;
      const lateral = Math.hypot(x - px, z - pz);
      if (lateral > seg.width * 0.5 - 0.22) continue;
      const surfaceY = seg.a.y + (seg.b.y - seg.a.y) * t + 0.14;
      const difference = feetY - surfaceY;
      if (difference < -0.9 || difference > 1.35) continue;
      if (!best || Math.abs(difference) < Math.abs(best.y - feetY)) best = { y: surfaceY, platform: seg };
    }
    return best;
  }

  const world = {
    platforms, slideSegments, getSlideGround, hazards: [], guards: [], laserBeam: null, FIN_Y: finish.y, WIN: finish, MAZE_H: 0, MAZE_Z: 0,
    cover: [], cracks: [], snowfall: null, route, npcs: [], cps: checkpoints, vanish: [], rotators, slidePlatforms: slideSegments,
    snowballs: [], windZones: [], swingPlanks: [], glowCrystals: [],
    tp: { start, hub: checkpoints[0] ? tp(cpSpecs[0]) : start, top: checkpoints[1] ? tp(cpSpecs[1]) : start,
      maze: checkpoints[2] ? tp(cpSpecs[2]) : start, finish: [finish.x, finish.y + 0.4, finish.z] },
    update
  };
  return { world, group, update };
}

// Helper opsional untuk pemanggil yang ingin pola update terpisah.
export function updateSuperSlideWorld(world, delta, elapsed) {
  if (world && typeof world.update === 'function') world.update(delta, elapsed);
}
