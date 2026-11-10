// Map Angkasa v2 - module mandiri untuk PARKOUR 3D.
// API tetap sama dengan versi sebelumnya (mengikuti pola buildSnowWorld):
//   const { world, group, controller } = buildAngkasaWorld(THREE, scene, deps);
//   world      -> { platforms, hazards, guards, laserBeam, FIN_Y, WIN, MAZE_H, MAZE_Z }
//   controller -> { reset(physics), update(delta, { physics, character, flyMode }), updateHud(), enter(scene), exit(scene) }
//
// Isi map:
//  - Ruang angkasa pekat: langit hitam penuh bintang (juga di BAWAH), nebula, planet batu berkawah,
//    planet bercincin, sabuk asteroid. Tidak ada lantai/air/kabut di bawah jalur -> jurang hitam total.
//  - Gravitasi rendah saat melompat (default -15, zona Nol-G -7) -> lompatan melayang ala astronot.
//  - Rintangan ala Stumble Guys: palang berputar, bandul raksasa, honeycomb (ubin jebakan),
//    dinding pendorong, trampolin pantul, laser gate, meteor.
//  - 5 checkpoint + finish.
export function buildAngkasaWorld(THREE, scene, deps = {}) {
  const NORMAL_GRAVITY = -32;                       // gravitasi default game (dipulihkan saat keluar map)
  const BASE_GRAVITY = deps.baseGravity ?? -15;     // gravitasi map Angkasa (lompatan melayang)
  const ZERO_G = deps.zeroGravity ?? -7;            // zona Nol-G
  const ZERO_G_RANGE = { zNear: -250, zFar: -300 }; // zona Nol-G: z antara zFar dan zNear
  const BOUNCE_VELOCITY = 19;                       // kecepatan lontar trampolin

  const group = new THREE.Group();
  group.name = 'ANGKASA_WORLD';
  group.visible = false;
  scene.add(group);

  const platforms = [];
  const hazards = [];
  const guards = [];
  const bouncePads = [];
  const route = [];

  // ---------- util ----------
  let seed = 9173;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const M = {
    deck: new THREE.MeshStandardMaterial({ color: 0x1c2550, metalness: 0.75, roughness: 0.32 }),
    deckAlt: new THREE.MeshStandardMaterial({ color: 0x2b2160, metalness: 0.7, roughness: 0.34 }),
    deckDark: new THREE.MeshStandardMaterial({ color: 0x0e1230, metalness: 0.8, roughness: 0.4 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x0c2a55, emissive: 0x19b4ff, emissiveIntensity: 0.95, metalness: 0.5, roughness: 0.3 }),
    magenta: new THREE.MeshStandardMaterial({ color: 0x3a0f45, emissive: 0xd23cff, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3 }),
    lime: new THREE.MeshStandardMaterial({ color: 0x103a2a, emissive: 0x2dffa0, emissiveIntensity: 0.85, metalness: 0.5, roughness: 0.3 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xff4b83, emissive: 0xc0004f, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.35 }),
    hazardAlt: new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xb07a00, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.4 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe8f0ff, emissive: 0x6a86c8, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.4 }),
    bounce: new THREE.MeshStandardMaterial({ color: 0x063a4a, emissive: 0x00e5ff, emissiveIntensity: 1.3, metalness: 0.4, roughness: 0.25 }),
    checkpoint: new THREE.MeshStandardMaterial({ color: 0x23d69a, emissive: 0x087d62, emissiveIntensity: 0.9 }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.02 }),
    rockFar: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, emissive: 0x120c0a, emissiveIntensity: 0.5, fog: false }),
    neon: (c) => new THREE.MeshBasicMaterial({ color: c, fog: false })
  };

  const add = (geo, mat, x, y, z, parent = group, shadow = false) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    parent.add(mesh);
    return mesh;
  };

  // ---------- pencahayaan (ruang angkasa: gelap, cahaya matahari tegas) ----------
  group.add(new THREE.HemisphereLight(0x8fa8ff, 0x0b0620, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.3);
  sun.position.set(60, 90, 40);
  group.add(sun);
  const rim = new THREE.DirectionalLight(0x6a4dff, 0.8);   // cahaya ungu dari bawah agar sisi bawah platform terlihat
  rim.position.set(-40, -60, -30);
  group.add(rim);

  // ---------- langit hitam + bintang (mengikuti pemain, ada di semua arah termasuk bawah) ----------
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(300, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  skyDome.renderOrder = -10;
  skyDome.frustumCulled = false;
  group.add(skyDome);

  const starGroup = new THREE.Group();
  const makeStars = (count, rMin, rMax, size, palette) => {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = rMin + rand() * (rMax - rMin);
      pos[i * 3] = Math.cos(a) * s * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = Math.sin(a) * s * r;
      const c = palette[Math.floor(rand() * palette.length)], k = 0.55 + rand() * 0.45;
      col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.95, fog: false, depthWrite: false }));
    pts.frustumCulled = false;
    starGroup.add(pts);
    return pts;
  };
  const WHITE = [1, 1, 1], BLUE = [0.7, 0.82, 1], WARM = [1, 0.88, 0.7];
  makeStars(1700, 120, 280, 1.6, [WHITE, WHITE, BLUE, WARM]);
  const brightStars = makeStars(260, 110, 270, 3.0, [WHITE, BLUE, [1, 0.8, 0.9]]);
  group.add(starGroup);

  // nebula (sprite gradien lembut) di kejauhan
  const nebulaTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  })();
  const nebula = (x, y, z, size, color, opacity) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.position.set(x, y, z); sp.scale.set(size, size * 0.7, 1); group.add(sp); return sp;
  };
  nebula(-70, 40, -90, 190, 0x5a2cff, 0.32);
  nebula(90, 20, -170, 210, 0xff2a8a, 0.22);
  nebula(-60, -20, -260, 230, 0x1a7bff, 0.28);
  nebula(70, 50, -340, 200, 0x7b2cff, 0.26);

  // ---------- planet & batuan ----------
  // Geometri batu berkawah: noise + kawah dengan warna lebih gelap di dasar kawah.
  function rockGeometry(radius, detail, craterCount, palette) {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const pos = geo.attributes.position, n = pos.count, colors = new Float32Array(n * 3);
    const craters = [];
    for (let i = 0; i < craterCount; i++) {
      const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      craters.push({ x: Math.cos(a) * s, y: u, z: Math.sin(a) * s, ang: 0.16 + rand() * 0.3, depth: 0.07 + rand() * 0.1 });
    }
    const ph = rand() * 6;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), l = Math.hypot(x, y, z) || 1;
      const nx = x / l, ny = y / l, nz = z / l;
      let h = 1 + Math.sin(nx * 4.3 + ph) * Math.sin(ny * 3.7 + ph * 0.7) * Math.sin(nz * 5.1 + 1.3) * 0.09 + Math.sin(nx * 11 + ny * 8 + ph) * 0.02;
      let dark = 0;
      for (const c of craters) {
        const d = Math.acos(clamp(nx * c.x + ny * c.y + nz * c.z, -1, 1));
        if (d < c.ang) { const k = 1 - d / c.ang; h -= c.depth * k * k * (3 - 2 * k); dark = Math.max(dark, k); }
        else if (d < c.ang * 1.25) h += c.depth * 0.35 * (1 - (d - c.ang) / (c.ang * 0.25));
      }
      pos.setXYZ(i, nx * radius * h, ny * radius * h, nz * radius * h);
      const band = (Math.sin(ny * 6 + nx * 2 + ph) + 1) / 2, c0 = palette[0], c1 = palette[1], f = 1 - dark * 0.5;
      colors[i * 3] = (c0[0] + (c1[0] - c0[0]) * band) * f;
      colors[i * 3 + 1] = (c0[1] + (c1[1] - c0[1]) * band) * f;
      colors[i * 3 + 2] = (c0[2] + (c1[2] - c0[2]) * band) * f;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }

  const spinners = []; // objek dekorasi yang berputar pelan
  const planet = (x, y, z, radius, palette, craters, spin, mat = M.rockFar) => {
    const mesh = add(rockGeometry(radius, 3, craters, palette), mat, x, y, z);
    mesh.castShadow = false; spinners.push({ mesh, spin });
    return mesh;
  };
  // planet batu besar (merah-oranye), bulan abu-abu, planet batu biru-kehijauan
  planet(-70, 12, -110, 26, [[0.62, 0.32, 0.2], [0.8, 0.5, 0.3]], 14, 0.01);
  planet(52, 34, -70, 10, [[0.5, 0.5, 0.52], [0.72, 0.72, 0.74]], 12, 0.02);
  planet(60, -6, -210, 18, [[0.3, 0.38, 0.42], [0.45, 0.6, 0.58]], 12, -0.012);
  planet(-48, 40, -235, 8, [[0.55, 0.4, 0.3], [0.7, 0.58, 0.44]], 9, 0.03);
  planet(40, 22, -300, 7, [[0.45, 0.4, 0.5], [0.65, 0.6, 0.72]], 8, -0.025);
  // planet bercincin raksasa di belakang garis finish
  const giant = add(new THREE.SphereGeometry(34, 40, 28), new THREE.MeshStandardMaterial({ color: 0x8a5cff, emissive: 0x2a1470, emissiveIntensity: 0.55, roughness: 0.8, fog: false }), -22, 26, -440);
  const giantRing = add(new THREE.TorusGeometry(54, 2.4, 6, 90), new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.55, fog: false }), -22, 26, -440);
  giantRing.rotation.x = 1.15; giantRing.rotation.y = 0.2;
  spinners.push({ mesh: giant, spin: 0.01 });
  const sunDisc = add(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff1c4, fog: false }), 110, 120, 30);

  // sabuk asteroid (InstancedMesh: ringan untuk perangkat mobile)
  const belts = [];
  const asteroidBelt = (cx, cy, cz, count, spreadX, spreadY, spreadZ) => {
    const geo = rockGeometry(1, 1, 3, [[0.45, 0.38, 0.33], [0.62, 0.52, 0.45]]);
    const inst = new THREE.InstancedMesh(geo, M.rock, count), dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set((rand() - 0.5) * spreadX, (rand() - 0.5) * spreadY, (rand() - 0.5) * spreadZ);
      const s = 0.4 + rand() * 1.8; dummy.scale.set(s, s * (0.7 + rand() * 0.5), s);
      dummy.rotation.set(rand() * 6, rand() * 6, rand() * 6); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    const holder = new THREE.Group(); holder.position.set(cx, cy, cz); holder.add(inst); group.add(holder);
    belts.push({ holder, spin: (rand() - 0.5) * 0.02 });
  };
  asteroidBelt(-26, 6, -60, 40, 20, 24, 60);
  asteroidBelt(26, 12, -140, 40, 20, 30, 80);
  asteroidBelt(-24, 20, -250, 40, 22, 30, 90);
  asteroidBelt(26, 24, -330, 36, 20, 30, 70);

  // ---------- platform ----------
  const underGeos = [rockGeometry(1, 1, 3, [[0.34, 0.3, 0.38], [0.5, 0.42, 0.5]]), rockGeometry(1, 1, 4, [[0.32, 0.26, 0.3], [0.48, 0.4, 0.42]])];
  let platformCount = 0;
  const createPlatform = (x, y, z, width, depth, type = 'static', shape = 'box', options = {}) => {
    const h = options.height || 0.5;
    let geo;
    if (shape === 'round') geo = new THREE.CylinderGeometry(width / 2, width / 2, h, 28);
    else if (shape === 'hex') geo = new THREE.CylinderGeometry(width * 0.48, width * 0.48, h, 6);
    else geo = new THREE.BoxGeometry(width, h, depth);
    const mat = options.material || ((platformCount++ % 2) ? M.deck : M.deckAlt);
    const mesh = add(geo, mat, x, y, z, group, true);
    const glow = options.glow || M.cyan;
    if (options.glow !== false) {
      const rimGeo = shape === 'box'
        ? new THREE.BoxGeometry(width * 0.98, 0.07, depth * 0.98)
        : new THREE.CylinderGeometry(width * (shape === 'hex' ? 0.47 : 0.49), width * (shape === 'hex' ? 0.47 : 0.49), 0.07, shape === 'hex' ? 6 : 28);
      const r = add(rimGeo, glow, 0, h * 0.5 + 0.025, 0, mesh);
      r.userData.isDecoration = true;
    }
    if (options.under !== false && type !== 'fake') { // dasar batu melayang di bawah platform
      const w = shape === 'box' ? width * 0.42 : width * 0.46, d = shape === 'box' ? depth * 0.42 : width * 0.46;
      const rock = add(underGeos[platformCount % 2], M.rock, 0, -h / 2 - Math.min(width, depth) * 0.42, 0, mesh);
      rock.scale.set(w, Math.min(width, depth) * 0.5, d);
      rock.rotation.y = rand() * 6;
      rock.userData.isDecoration = true;
    }
    const p = {
      mesh, width, depth, type,
      startX: x, startY: y, startZ: z,
      range: options.range ?? 1.6,
      speed: options.speed ?? 1.25,
      phase: options.phase ?? rand() * Math.PI * 2,
      isFallen: false, tell: options.tell ?? 0, revealTimer: 0, dx: 0,
      r: shape === 'round' ? width / 2 : (shape === 'hex' ? width * 0.45 : 0),
      hh: h / 2
    };
    if (options.checkpoint) {
      p.checkpoint = true; p.checkpointActivated = false; p.checkpointReadyMaterial = M.checkpoint; mesh.material = M.checkpoint;
    }
    if (options.route) route.push(p);
    platforms.push(p);
    return p;
  };
  const gate = (z, y, color, radius = 7) => { // gerbang cincin neon penanda bagian
    const ring = add(new THREE.TorusGeometry(radius, 0.14, 8, 56), M.neon(color), 0, y + radius * 0.55, z);
    ring.userData.isDecoration = true; return ring;
  };

  // ===== 0. DECK LUNCUR (start) =====
  createPlatform(0, 0, 0, 13, 13, 'static', 'hex', { glow: M.cyan, route: true, under: true });
  gate(-4, 0, 0x30d5ff, 6);
  {
    const ring = add(new THREE.TorusGeometry(8.4, 0.1, 6, 64), M.neon(0x30d5ff), 0, 0.05, 0);
    ring.rotation.x = Math.PI / 2;
  }

  // ===== 1. PLANETOID HOP (lompatan melayang, pemanasan) =====
  const hops = [[0, 0.8, -11], [-4, 1.6, -22], [4, 2.4, -33], [-3, 3.2, -44], [0, 4.0, -55]];
  hops.forEach(([x, y, z], i) => createPlatform(x, y, z, 6, 6, 'static', 'round', { glow: i % 2 ? M.magenta : M.cyan, route: true }));
  createPlatform(0, 4.8, -65, 11, 10, 'static', 'box', { checkpoint: true, route: true });   // CP1
  gate(-58, 4.0, 0xd23cff);

  // ===== 2. ARENA PALANG BERPUTAR (ala Stumble Guys) =====
  const ARENA = { x: 0, y: 5.6, z: -84 };
  createPlatform(ARENA.x, ARENA.y, ARENA.z, 21, 21, 'static', 'round', { glow: M.magenta, route: true });
  {
    const ring = add(new THREE.TorusGeometry(10.1, 0.12, 6, 64), M.neon(0xff4b83), ARENA.x, ARENA.y + 0.3, ARENA.z);
    ring.rotation.x = Math.PI / 2;
  }
  createPlatform(0, 6.4, -100, 8, 7, 'static', 'box', { checkpoint: true, route: true });    // CP2

  // Palang berputar rendah: harus dilompati. Collider mengikuti arah visual (rotation.y = angle).
  const makeSweeper = (cx, floorTop, cz, length, speed, phase, mat) => {
    const pivot = new THREE.Group();
    pivot.position.set(cx, floorTop, cz);
    group.add(pivot);
    add(new THREE.CylinderGeometry(0.6, 0.8, 1.0, 16), M.deckDark, 0, 0.5, 0, pivot);
    const bar = add(new THREE.BoxGeometry(length, 0.55, 0.7), mat, 0, 0.62, 0, pivot);
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.55, 12, 10), M.white, s * length / 2, 0.62, 0, pivot);
    let angle = phase;
    hazards.push({
      update(t) { angle = phase + t * speed; pivot.rotation.y = angle; },
      test(pp) {
        const dx = pp.x - cx, dz = pp.z - cz, c = Math.cos(angle), s = Math.sin(angle);
        const along = dx * c - dz * s;      // sumbu lokal-x palang di dunia = (cos a, 0, -sin a)
        const across = dx * s + dz * c;
        if (Math.abs(along) < length / 2 + 0.4 && Math.abs(across) < 0.75 && pp.y < floorTop + 0.95 && pp.y + 1.7 > floorTop + 0.1) {
          const sgn = across >= 0 ? 1 : -1;
          return { x: s * sgn, z: c * sgn };  // dorong tegak lurus palang
        }
        return null;
      }
    });
    return bar;
  };
  makeSweeper(ARENA.x, ARENA.y + 0.25, ARENA.z, 17, 1.25, 0, M.hazard);
  makeSweeper(ARENA.x, ARENA.y + 0.25, ARENA.z, 17, -1.7, 1.2, M.hazardAlt);

  // ===== 3. LORONG BANDUL RAKSASA =====
  const HALL = { y: 6.4, z0: -107, z1: -137 };
  createPlatform(0, HALL.y, (HALL.z0 + HALL.z1) / 2, 9.5, HALL.z0 - HALL.z1, 'static', 'box', { glow: M.cyan, route: true, under: true });
  const makePendulum = (z, speed, phase) => {
    const floorTop = HALL.y + 0.25, L = 7.2, R = 1.3, pivotY = floorTop + 1.2 + L;
    const pivot = new THREE.Group(); pivot.position.set(0, pivotY, z); group.add(pivot);
    add(new THREE.CylinderGeometry(0.08, 0.08, L, 8), M.white, 0, -L / 2, 0, pivot);
    const ball = add(new THREE.IcosahedronGeometry(R, 1), M.rock, 0, -L, 0, pivot);
    add(new THREE.TorusGeometry(R * 1.02, 0.1, 6, 24), M.hazard, 0, -L, 0, pivot).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.4, pivotY - floorTop + 0.6, 0.4), M.deckAlt, s * 5.4, (pivotY + floorTop - 0.6) / 2 + 0.3, z);
    add(new THREE.BoxGeometry(11.2, 0.4, 0.5), M.deckAlt, 0, pivotY + 0.5, z);
    let bx = 0, by = floorTop + 1.2;
    hazards.push({
      update(t) {
        const th = Math.sin(t * speed + phase) * 0.52;
        pivot.rotation.z = th;
        bx = Math.sin(th) * L; by = pivotY - Math.cos(th) * L;
        ball.rotation.x += 0.03;
      },
      test(pp) {
        const dx = pp.x - bx, dy = (pp.y + 0.9) - by, dz = pp.z - z;
        if (Math.hypot(dx, dy, dz) < R + 0.55) { const l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: (dz || 0.2) / l }; }
        return null;
      }
    });
  };
  makePendulum(-114, 1.7, 0); makePendulum(-122, 2.1, 2.0); makePendulum(-130, 1.9, 4.1);
  gate(-106, HALL.y, 0xff4b83);

  // ===== 4. HONEYCOMB RUSH (ubin hex jebakan: yang palsu hilang saat diinjak) =====
  const HC = { y: 7.2, z0: -143.5, dz: 4.8, dx: 5.5 };
  const safeX = [0, -2.75, -5.5, -2.75, 0, 2.75];      // jalur ubin asli
  for (let row = 0; row < 6; row++) {
    const xs = row % 2 === 0 ? [-HC.dx, 0, HC.dx] : [-HC.dx / 2, HC.dx / 2];
    for (const x of xs) {
      const real = Math.abs(x - safeX[row]) < 0.01;
      createPlatform(x, HC.y, HC.z0 - row * HC.dz, 5.4, 5.4, real ? 'static' : 'fake', 'hex', {
        glow: row % 2 ? M.magenta : M.cyan, tell: Math.max(0.12, 0.55 - row * 0.07), route: real, under: false
      });
    }
  }
  createPlatform(0, 7.2, -177, 10, 9, 'static', 'box', { checkpoint: true, route: true });  // CP3
  gate(-141, HC.y, 0x2dffa0);

  // ===== 5. DINDING PENDORONG (blok geser) =====
  const SL = { y: 7.8, z0: -185, z1: -213 };
  createPlatform(0, SL.y, (SL.z0 + SL.z1) / 2, 10, SL.z0 - SL.z1, 'static', 'box', { glow: M.magenta, route: true, under: true });
  const makeSlider = (z, amp, speed, phase) => {
    const floorTop = SL.y + 0.25, W = 5.2, H = 3.0, D = 1.3;
    const block = new THREE.Group(); block.position.set(0, floorTop, z); group.add(block);
    add(new THREE.BoxGeometry(W, H, D), M.hazard, 0, H / 2, 0, block, true);
    add(new THREE.BoxGeometry(W + 0.1, 0.35, D + 0.1), M.white, 0, H * 0.35, 0, block);
    add(new THREE.BoxGeometry(W + 0.1, 0.35, D + 0.1), M.white, 0, H * 0.8, 0, block);
    let bx = 0;
    hazards.push({
      update(t) { bx = Math.sin(t * speed + phase) * amp; block.position.x = bx; },
      test(pp) {
        const dx = pp.x - bx, dz = pp.z - z, ox = W / 2 + 0.4 - Math.abs(dx), oz = D / 2 + 0.45 - Math.abs(dz);
        if (ox > 0 && oz > 0 && pp.y < floorTop + H && pp.y + 1.7 > floorTop) {
          return ox < oz ? { x: dx >= 0 ? 1 : -1, z: 0 } : { x: 0, z: dz >= 0 ? 1 : -1 };
        }
        return null;
      }
    });
  };
  makeSlider(-191, 7.2, 1.35, 0); makeSlider(-199, 7.2, 1.55, 2.2); makeSlider(-207, 7.2, 1.75, 4.4);
  createPlatform(0, 8.0, -219, 9, 8, 'static', 'box', { checkpoint: true, route: true });  // CP4
  gate(-184, SL.y, 0xffd23a);

  // ===== 6. TRAMPOLIN PANTUL =====
  const addBouncePad = (x, y, z, r) => {
    const base = add(new THREE.CylinderGeometry(r, r * 1.15, 0.5, 24), M.deckDark, x, y, z, group, true);
    const top = add(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.22, 24), M.bounce, 0, 0.36, 0, base);
    add(new THREE.TorusGeometry(r * 0.88, 0.1, 6, 28), M.neon(0x7ff6ff), 0, 0.48, 0, base).rotation.x = Math.PI / 2;
    const p = { mesh: base, width: r * 2, depth: r * 2, type: 'static', startX: x, startY: y, startZ: z, range: 0, speed: 0, phase: 0,
      isFallen: false, tell: 0, revealTimer: 0, dx: 0, r, hh: 0.25 };
    platforms.push(p); route.push(p);
    bouncePads.push({ x, z, r, top: y + 0.25, squash: 0, topMesh: top });
    return p;
  };
  addBouncePad(0, 8.4, -228, 2.6);                                   // lontar ke platform tinggi
  createPlatform(0, 14.6, -240, 9, 8, 'static', 'box', { glow: M.lime, route: true, under: true });
  gate(-226, 9, 0x7ff6ff, 5);

  // ===== 7. ZONA NOL-G (batu planetoid melayang) =====
  const rocks = [
    [0, 15.4, -253, 6.5, 'static'], [-5, 16.4, -263, 5.5, 'moving_y'], [4, 17.2, -273, 5.2, 'static'],
    [-4, 18.0, -283, 5.0, 'moving_x'], [3, 17.2, -293, 5.4, 'static']
  ];
  rocks.forEach(([x, y, z, w, type], i) => createPlatform(x, y, z, w, w, type, 'round', {
    glow: i % 2 ? M.magenta : M.lime, range: type === 'moving_x' ? 2.6 : 1.4, speed: 1.0 + i * 0.1, route: true
  }));
  createPlatform(0, 17.6, -303, 10, 9, 'static', 'box', { checkpoint: true, route: true });  // CP5
  gate(-248, 15, 0x2dffa0);

  // Meteor bergerak di zona Nol-G dan di bagian tengah.
  const meteorHazard = (baseX, baseY, baseZ, amplitude, speed, phase, radius) => {
    const mesh = add(rockGeometry(radius, 1, 4, [[0.5, 0.36, 0.28], [0.7, 0.5, 0.36]]), M.rock, baseX, baseY, baseZ);
    let x = baseX, z = baseZ;
    hazards.push({
      update(t) {
        x = baseX + Math.sin(t * speed + phase) * amplitude; z = baseZ + Math.cos(t * speed * 0.7 + phase) * 1.4;
        mesh.position.set(x, baseY + Math.sin(t * speed * 1.4 + phase) * 0.8, z); mesh.rotation.x += 0.025; mesh.rotation.y += 0.035;
      },
      test(pp) {
        const dx = pp.x - x, dz = pp.z - z, dy = (pp.y + 0.8) - mesh.position.y;
        if (Math.hypot(dx, dy, dz) < radius + 0.7) { const l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; }
        return null;
      }
    });
  };
  meteorHazard(0, 5.4, -38.5, 6, 1.15, 0.4, 1.3);
  meteorHazard(1, 19.2, -268, 5.5, 1.3, 2.1, 1.5);
  meteorHazard(-1, 19.4, -288, 5.5, 1.1, 4.0, 1.5);

  // ===== 8. LASER GATE + SPRINT FINAL =====
  const FIN = { y: 17.6, z: -353 };
  createPlatform(0, 17.6, -328, 9, 36, 'static', 'box', { glow: M.hazard, route: true, under: true });
  const makeLaser = (z, speed, phase) => {
    const floorTop = 17.85, grp = new THREE.Group(); grp.position.set(0, floorTop, z); group.add(grp);
    const beam = add(new THREE.BoxGeometry(8.4, 0.2, 0.2), M.hazard.clone(), 0, 0.75, 0, grp);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.4, 0.45, 1.5, 12), M.deckAlt, s * 4.5, 0.75, 0, grp);
    hazards.push({
      update(t) { const on = Math.sin(t * speed + phase) > -0.1; beam.visible = on; beam.material.emissiveIntensity = on ? 1.9 : 0.2; },
      test(pp) {
        if (!beam.visible) return null;
        if (Math.abs(pp.z - z) < 0.5 && Math.abs(pp.x) < 4.4 && pp.y < floorTop + 1.0 && pp.y + 1.6 > floorTop + 0.3) return { x: 0, z: pp.z >= z ? 1 : -1 };
        return null;
      }
    });
  };
  makeLaser(-315, 2.4, 0); makeLaser(-323, 2.0, 1.7); makeLaser(-331, 2.7, 3.4); makeLaser(-339, 2.2, 5.0);

  const finishPad = createPlatform(0, FIN.y, FIN.z, 12, 11, 'static', 'box', { glow: M.lime, route: true, checkpoint: true });
  const archMat = new THREE.MeshStandardMaterial({ color: 0x37f5c2, emissive: 0x0b9b7b, emissiveIntensity: 1.2 });
  add(new THREE.BoxGeometry(0.4, 5, 0.4), archMat, -4.6, FIN.y + 2.5, FIN.z);
  add(new THREE.BoxGeometry(0.4, 5, 0.4), archMat, 4.6, FIN.y + 2.5, FIN.z);
  add(new THREE.BoxGeometry(9.6, 0.4, 0.4), archMat, 0, FIN.y + 5, FIN.z);
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#05081a'; cx.fillRect(0, 0, 512, 128); cx.strokeStyle = '#37f5c2'; cx.lineWidth = 8; cx.strokeRect(6, 6, 500, 116);
    cx.font = 'bold 64px sans-serif'; cx.fillStyle = '#ffffff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('FINISH', 256, 66);
    add(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }), 0, FIN.y + 3.4, FIN.z);
  }

  // ---------- dekorasi hidup (planet berputar, sabuk asteroid, bintang terang berkedip) ----------
  hazards.push({
    update(t) {
      for (const s of spinners) s.mesh.rotation.y = t * s.spin;
      for (const b of belts) b.holder.rotation.z = t * b.spin;
      brightStars.material.opacity = 0.75 + Math.sin(t * 1.7) * 0.2;
    },
    test() { return null; }
  });

  // ---------- controller: gravitasi, trampolin, langit mengikuti pemain ----------
  const controller = {
    lowGravity: true,
    zeroG: false,
    bounceCooldown: 0,
    hudText: '',
    reset(physics) {
      if (physics) physics.gravity = NORMAL_GRAVITY;   // pulihkan gravitasi default untuk map lain/lobby
      this.lowGravity = false; this.zeroG = false; this.bounceCooldown = 0;
    },
    enter(sc) {                                        // opsional: dipanggil saat map aktif -> latar hitam pekat tanpa kabut
      const s = sc || scene;
      s.background = new THREE.Color(0x000000);
      s.fog = null;
    },
    exit() {},
    update(delta, state = {}) {
      const { physics, character, flyMode } = state;
      if (!physics || !character) return;
      const pos = character.position;
      starGroup.position.set(pos.x, pos.y, pos.z);     // bintang & langit selalu mengelilingi pemain
      skyDome.position.set(pos.x, pos.y, pos.z);
      this.zeroG = pos.z < ZERO_G_RANGE.zNear && pos.z > ZERO_G_RANGE.zFar;
      this.lowGravity = !flyMode;
      physics.gravity = flyMode ? NORMAL_GRAVITY : (this.zeroG ? ZERO_G : BASE_GRAVITY);
      this.hudText = flyMode ? '' : (this.zeroG ? '🌌 Zona Nol-G' : '🪐 Gravitasi Rendah');

      // trampolin
      this.bounceCooldown = Math.max(0, this.bounceCooldown - delta);
      for (const b of bouncePads) {
        b.squash = Math.max(0, b.squash - delta);
        b.topMesh.scale.y = 1 - Math.sin(Math.min(1, b.squash / 0.35) * Math.PI) * 0.45;
        if (!flyMode && this.bounceCooldown <= 0 && Math.hypot(pos.x - b.x, pos.z - b.z) < b.r &&
            Math.abs(pos.y - b.top) < 0.7 && physics.velocityY <= 0.5) {
          physics.velocityY = BOUNCE_VELOCITY; physics.isGrounded = false; physics.jumpCount = 1;
          this.bounceCooldown = 0.5; b.squash = 0.35;
        }
      }
    },
    updateHud() {}
  };

  const world = {
    platforms, hazards, guards, laserBeam: null,
    FIN_Y: FIN.y + 0.25,
    WIN: { x: 0, y: FIN.y, z: FIN.z },
    MAZE_H: 0,
    MAZE_Z: 0,
    route,
    gravity: { base: BASE_GRAVITY, zero: ZERO_G, zeroRange: ZERO_G_RANGE, bounce: BOUNCE_VELOCITY }
  };

  return { world, group, controller };
}
