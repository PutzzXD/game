// Map ice/salju PARKOUR 3D. Dipisahkan dari main.js.
export function buildSnowWorld(THREE, scene, api) {
  const { runElapsedMs, insidePlat, showToast } = api;
  const SNOW_TIMER_SEC = 60;
  const SNOW_FIRE_WINDOW_SEC = 5;
  const SNOW_CYCLE_SEC = SNOW_TIMER_SEC + SNOW_FIRE_WINDOW_SEC;
  // NPC lebih responsif: cepat mengunci sasaran, lalu memberi jeda singkat antar-tembakan.
  const SNOW_AIM_TIME = 0.45, SNOW_LOCK_TIME = 0.12, SNOW_COOL_TIME = 0.95;
  const snowTimeLeft = () => {
    const phase = (runElapsedMs() / 1000) % SNOW_CYCLE_SEC;
    return phase < SNOW_TIMER_SEC ? SNOW_TIMER_SEC - phase : 0;
  };
  const grp = new THREE.Group(); grp.name = 'SNOW_WORLD'; grp.visible = false; scene.add(grp);
  const P = [], C = [], cracks = [], npcs = [], route = [], cpList = [];
  const vanish = [], rotators = [], snowballs = [], windZones = [], swingPlanks = [], glowCrystals = [];

  grp.add(new THREE.HemisphereLight(0xe4f4ff, 0x6d88aa, 1.15));
  const sunS = new THREE.DirectionalLight(0xffffff, 1.25); sunS.position.set(-25, 70, 35); grp.add(sunS);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ color: 0x6fa8d6 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -8; grp.add(water);

  const iceMat = new THREE.MeshStandardMaterial({ color: 0x9fdcff, roughness: 0.12, metalness: 0.15, emissive: 0x16405e, emissiveIntensity: 0.35 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f9ff, roughness: 0.95 });
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0x7fcfff, roughness: 0.1, metalness: 0.2, emissive: 0x1b5a86, emissiveIntensity: 0.4 });
  const crackMat = new THREE.MeshStandardMaterial({ color: 0xd8f1ff, roughness: 0.25, emissive: 0x4a7a9c, emissiveIntensity: 0.3 });
  const cpMat = new THREE.MeshStandardMaterial({ color: 0x22ddaa, emissive: 0x22ddaa, emissiveIntensity: 0.45 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9, emissive: 0x2a5878, emissiveIntensity: 0.25 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xe9f1f8, roughness: 0.9 });
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xaed9f2, roughness: 0.3, emissive: 0x1d4663, emissiveIntensity: 0.3 });
  const ICE_GRIP = [0.22, 0.1], SNOW_GRIP = [0.6, 0.55]; // [saat ada input, saat lepas input] -> licin

  const pushColl = (p) => { P.push(p); return p; };
  // y = nilai "nominal" seperti map Lava: permukaan atas selalu y + 0.25
  function plat(x, y, z, w, d, o = {}) {
    const kind = o.kind || 'ice', shape = o.shape || 'box', type = o.type || 'static', h = o.h || 0.5, cy = y + 0.25 - h / 2;
    const geo = shape === 'round' ? new THREE.CylinderGeometry(w / 2, w / 2, h, 28) : new THREE.BoxGeometry(w, h, d);
    const mat = o.cp ? cpMat : (type === 'crack' ? crackMat : (kind === 'snow' ? snowMat : (kind === 'cube' ? cubeMat : iceMat)));
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, cy, z); grp.add(mesh);
    const p = { mesh, width: w, depth: d, type, hh: h / 2, startX: x, startY: cy, startZ: z, range: o.range != null ? o.range : 2.5, speed: o.speed != null ? o.speed : 1.5,
      phase: (P.length * 2.39996) % (Math.PI * 2), isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: shape === 'round' ? w / 2 : 0,
      grip: kind === 'snow' ? SNOW_GRIP : ICE_GRIP, crackState: 0, crackT: 0 };
    if (o.cp) {
      p.checkpoint = true; p.checkpointActivated = false; p.checkpointReadyMaterial = cpMat; cpList.push(p);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
      pole.position.set(x + w / 2 - 0.7, y + 0.25 + 1.5, z + d / 2 - 0.7); grp.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), new THREE.MeshBasicMaterial({ color: 0x22ddaa }));
      flag.position.set(x + w / 2 - 0.7 + 0.65, y + 0.25 + 2.6, z + d / 2 - 0.7); grp.add(flag);
    }
    if (type === 'crack') cracks.push(p);
    if (type === 'snow_vanish') { p.vanishState = 0; p.vanishT = 0; vanish.push(p); }
    if (o.route) route.push(p);
    return pushColl(p);
  }
  function coverEntry(mesh, w, d, hh, r) {
    const p = { mesh, width: w, depth: d, type: 'wall', hh, startX: mesh.position.x, startY: mesh.position.y, startZ: mesh.position.z, range: 0, speed: 0, phase: 0, isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: r || 0, cover: true };
    P.push(p); C.push(p); return p;
  }
  function wall(cx, floorTop, cz, w, h, d) { // dinding es / penghalang es besar (collision kotak)
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(cx, floorTop + h / 2, cz); grp.add(m);
    return coverEntry(m, w, d, h / 2, 0);
  }
  function rock(cx, floorTop, cz, rad, h) { // bongkahan batu salju (collision lingkaran)
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), rockMat); m.scale.set(rad * 1.06, h / 2, rad * 1.06); m.position.set(cx, floorTop + h / 2, cz); grp.add(m);
    return coverEntry(m, rad * 2, rad * 2, h / 2, rad);
  }
  function column(cx, cz, rad, y0, y1) { // pilar es raksasa
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.15, y1 - y0, 20), towerMat); m.position.set(cx, (y0 + y1) / 2, cz); grp.add(m);
    return coverEntry(m, rad * 2, rad * 2, (y1 - y0) / 2, rad);
  }
  function crystal(x, y, z, s) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), cubeMat); m.scale.set(s * 0.5, s, s * 0.5); m.position.set(x, y + s, z); grp.add(m); glowCrystals.push(m);
  }
  function rotatingBar(x, y, z, length, speed, color = 0x65d9ff) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); grp.add(pivot);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(length, 0.28, 0.48), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.22 }));
    bar.position.y = 0.25; pivot.add(bar);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.55, 16), cubeMat); hub.rotation.x = Math.PI / 2; hub.position.y = 0.25; pivot.add(hub);
    rotators.push({ mesh: pivot, speed, radius: length * 0.48 });
  }
  function rollingSnowball(x, y, z, axis, range, speed, phase = 0) {
    const radius = 1.35;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), new THREE.MeshStandardMaterial({ color: 0xf7fcff, roughness: 0.92 }));
    mesh.position.set(x, y + radius * 0.72, z); grp.add(mesh);
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.09, 8, 24), new THREE.MeshStandardMaterial({ color: 0x8edcff, emissive: 0x2c8eb8, emissiveIntensity: 0.4 }));
    band.rotation.x = Math.PI / 2; mesh.add(band);
    snowballs.push({ mesh, axis, center: axis === 'x' ? x : z, range, speed, phase, radius });
  }
  const top = (p) => p.mesh.position.y + p.hh;
  function snowRayBlocked(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
    const n = Math.max(2, Math.ceil(len / 0.25));
    for (let i = 1; i < n; i++) {
      const f = i / n, x = ax + dx * f, y = ay + dy * f, z = az + dz * f;
      for (const c of C) {
        const m = c.mesh.position;
        if (y < m.y - c.hh || y > m.y + c.hh) continue;
        if (insidePlat(c, x, z, 0)) return { x, y, z };
      }
    }
    return null;
  }
  function distPointSeg(px, py, pz, ax, ay, az, bx, by, bz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const l2 = abx * abx + aby * aby + abz * abz || 1e-6;
    let t = ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + abx * t), py - (ay + aby * t), pz - (az + abz * t));
  }

  // ================= ZONA 1: Camp awal + Lapangan Es (licin, zig-zag dinding) =================
  plat(0, 0, 0, 10, 10, { kind: 'snow', route: 1 });
  plat(0, 0, -16, 16, 20, { route: 1 });
  wall(-3, 0.25, -3.2, 4, 3.2, 1);
  wall(-4.5, 0.25, -12, 7, 3.2, 1);
  wall(4.5, 0.25, -18, 7, 3.2, 1);
  rock(-5.5, 0.25, -22.5, 1.7, 3.2);
  rock(5.8, 0.25, -8.2, 1.5, 3.0);
  crystal(-7, 0.25, -7, 1.6); crystal(7.2, 0.25, -24, 1.3);

  // ================= ZONA 2: Jembatan es batu melayang (bergerak, retak) =================
  plat(11.5, 0.5, -22, 3.6, 3.6, { kind: 'cube', h: 1.4, route: 1 });
  plat(16.5, 1.0, -22, 3.6, 3.6, { kind: 'cube', h: 1.4, type: 'moving_y', range: 0.9, speed: 1.4, route: 1 });
  plat(21.5, 1.5, -25, 3.6, 3.6, { kind: 'cube', h: 1.4, type: 'moving_x', range: 1.5, speed: 1.2, route: 1 });
  plat(26.5, 2.0, -28.5, 3.6, 3.6, { kind: 'cube', h: 1.4, type: 'crack', route: 1 });
  plat(31.5, 2.0, -31.5, 3.6, 3.6, { kind: 'cube', h: 1.4, route: 1 });

  // ================= ZONA 3: Teras Timur (CHECKPOINT 1) + tangga zig-zag bertingkat =================
  plat(40, 2.5, -33, 10, 10, { kind: 'snow', cp: true, route: 1 });
  wall(38.75, 2.75, -35.5, 6.5, 4, 1);
  wall(44.2, 2.75, -30.5, 1, 4, 5);
  plat(38, 4, -43, 7, 7, { route: 1 });
  plat(31.5, 5.5, -48, 7, 7, { type: 'snow_vanish', route: 1 });
  plat(25, 7, -43, 7, 7, { route: 1 });
  plat(18.5, 8.5, -48, 7, 7, { type: 'snow_vanish', route: 1 });
  plat(12, 10, -43, 7, 7, { route: 1 });
  rock(33.8, 5.75, -48.3, 1.4, 3.4);
  rock(14.4, 10.25, -44.6, 1.3, 3.4);
  plat(4.5, 11.5, -45, 8, 8, { kind: 'snow', cp: true, route: 1 });   // CHECKPOINT 2

  // ================= ZONA 4: Jembatan es sempit licin + pad perlindungan =================
  plat(-6, 11.5, -45, 10, 2.8, { route: 1 });
  plat(-17, 12, -45, 9, 9, { route: 1 });
  rock(-14.2, 12.25, -47.2, 1.6, 3.8);
  plat(-17, 12.5, -56.5, 2.8, 14, { route: 1 });
  plat(-17, 13, -69, 10, 10, { kind: 'snow', cp: true, route: 1 });   // CHECKPOINT 3
  wall(-13.2, 13.25, -69, 1, 3.8, 7);
  wall(-14.6, 13.25, -72.8, 4, 3.8, 1);

  // ================= ZONA 5: Menara spiral es (naik melingkar) =================
  const SC = { x: -17, z: -83 }, SR = 9, SN = 14, SDA = 0.62;
  column(SC.x, SC.z, 3.2, 12, 34);
  for (let i = 1; i <= SN; i++) {
    const a = Math.PI / 2 + i * SDA, o = { shape: 'round', route: 1 };
    if (i % 4 === 0) o.type = 'crack'; else if (i % 5 === 2) { o.type = 'moving_y'; o.range = 0.5; o.speed = 1.3; }
    plat(SC.x + SR * Math.cos(a), 13 + i, SC.z + SR * Math.sin(a), 3.8, 3.8, o);
  }

  // ================= FITUR TAMBAHAN: rintangan unik Map Salju =================
  // Bola salju raksasa melintasi lapangan awal; ada dinding batu sebagai tempat menghindar.
  rollingSnowball(0, 0.25, -15.5, 'x', 6.2, 1.05, 0.4);
  rollingSnowball(39.5, 2.75, -39.5, 'z', 2.8, 0.8, 2.1);

  // Tangga es bergerak tambahan untuk variasi timing sebelum checkpoint kedua.
  plat(8.5, 12.5, -49.5, 3.2, 3.2, { kind: 'cube', h: 1.0, type: 'moving_y', range: 0.65, speed: 1.25, route: 1 });
  plat(1.5, 13.5, -54.5, 3.2, 3.2, { kind: 'cube', h: 1.0, type: 'moving_y', range: 0.8, speed: 1.05, route: 1 });

  // Jembatan gantung: papan pijakan berayun ringan, tetapi collider utama tetap aman.
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 2.2), new THREE.MeshStandardMaterial({ color: 0x8bc9e8, roughness: 0.32, metalness: 0.18 }));
    plank.position.set(-6 - i * 2.1, 12.05 + (i % 2) * 0.08, -45); grp.add(plank);
    swingPlanks.push({ mesh: plank, speed: 1.4 + i * 0.08, phase: i * 0.8 });
  }
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x567f9b, roughness: 0.8 });
  for (const side of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 10.5, 8), ropeMat);
    rope.position.set(-10.2, 13.1, -45 + side * 1.65); rope.rotation.z = Math.PI / 2; grp.add(rope);
  }

  // Badai salju di jembatan sempit. Arah dorongan konsisten; pagar es memberi batas visual.
  windZones.push({ x: -17, z: -56.5, hx: 2.2, hz: 6.4, dx: 8.5, dz: 0, maxY: 18 });
  wall(-19.15, 12.75, -56.5, 0.35, 1.6, 13.5);
  wall(-14.85, 12.75, -56.5, 0.35, 1.6, 13.5);
  const gustMat = new THREE.MeshBasicMaterial({ color: 0xc9f2ff, transparent: true, opacity: 0.28 });
  for (let i = 0; i < 7; i++) {
    const gust = new THREE.Mesh(new THREE.TorusGeometry(1.0 + i * 0.12, 0.035, 6, 20), gustMat);
    gust.position.set(-17 + (i % 2) * 0.35, 14 + i * 0.12, -52 - i * 1.35); gust.rotation.x = Math.PI / 2; grp.add(gust);
  }

  // Gua es gelap dengan gerbang kristal dan stalaktit dekoratif di sekitar checkpoint 3.
  const caveMat = new THREE.MeshStandardMaterial({ color: 0x173a59, roughness: 0.28, metalness: 0.18, emissive: 0x0a2845, emissiveIntensity: 0.65 });
  const caveArch = new THREE.Mesh(new THREE.TorusGeometry(5.1, 0.65, 8, 24, Math.PI), caveMat);
  caveArch.position.set(-17, 15.7, -69.2); caveArch.rotation.z = Math.PI; grp.add(caveArch);
  for (let i = 0; i < 7; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.38 + (i % 3) * 0.12, 1.8 + (i % 2) * 0.8, 6), cubeMat);
    spike.position.set(-21.5 + i * 1.5, 17.2, -72.5 - (i % 2) * 0.6); spike.rotation.x = Math.PI; grp.add(spike);
  }
  crystal(-21.5, 13.25, -68.5, 2.0); crystal(-12.5, 13.25, -68.5, 1.7);

  // Lompatan kristal es di sisi jalur spiral: platform kecil berurutan dengan jarak terukur.
  for (let i = 0; i < 4; i++) {
    const px = -7.5 - i * 1.9, pz = -76.5 - i * 2.0, py = 14 + i * 1.15;
    const pad = plat(px, py, pz, 2.35, 2.35, { kind: 'cube', h: 0.75, route: 1 });
    crystal(px, py + 0.25, pz, 0.95);
  }

  // ================= ZONA 6: Puncak (CHECKPOINT 4) + medan terakhir =================
  plat(-27, 27.5, -97, 9, 9, { kind: 'snow', cp: true, route: 1 });   // CHECKPOINT 4
  const PF2 = plat(-27, 28, -113.5, 14, 19, { route: 1 });
  // Ekstensi jalur puncak: lompatan zig-zag, platform bergerak, lalu finish baru.
  plat(-21.5, 29.5, -128, 3.4, 3.4, { kind: 'cube', h: 0.8, route: 1 });
  plat(-27.5, 31, -133.5, 3.1, 3.1, { kind: 'cube', h: 0.8, type: 'moving_x', range: 1.0, speed: 1.0, route: 1 });
  plat(-33, 32.5, -139, 3.0, 3.0, { kind: 'crack', h: 0.75, type: 'crack', route: 1 });
  plat(-27.5, 34, -144.5, 3.2, 3.2, { kind: 'cube', h: 0.8, route: 1 });
  const PF3 = plat(-27, 34, -153, 10, 10, { kind: 'snow', route: 1 });
  wall(-31, 28.25, -106.5, 7, 3.6, 1);
  wall(-23, 28.25, -110, 7, 3.6, 1);
  rock(-32, 28.25, -116, 1.5, 3.2);
  crystal(-21.5, 28.25, -120, 1.4);
  const FY = 34, WINP = { x: -27, y: FY, z: -153 };
  const finishLine = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 7), new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1 }));
  finishLine.position.set(WINP.x, FY + 0.3, WINP.z); grp.add(finishLine);
  for (const sd of [-1, 1]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc })); pl.position.set(WINP.x + sd * 4, FY + 3, WINP.z); grp.add(pl); }
  { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const cx = cv.getContext('2d');
    cx.fillStyle = '#0d2238'; cx.fillRect(0, 0, 1024, 256); cx.strokeStyle = '#7fd6ff'; cx.lineWidth = 15; cx.strokeRect(10, 10, 1004, 236);
    cx.font = 'bold 80px sans-serif'; cx.fillStyle = '#7fd6ff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('DUNIA SALJU', 512, 100);
    cx.font = 'bold 90px sans-serif'; cx.fillStyle = '#ffffff'; cx.fillText('KAMU LOLOS!', 512, 188);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
    board.position.set(WINP.x, FY + 4, WINP.z); grp.add(board); }

  // ================= NPC penjaga (menara es) =================
  const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function makeGuard(gx, gy, gz, idx, range, yaw, zone) { // zone = [xMin,xMax,zMin,zMax,yMin,yMax] sektor jaga NPC
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.0, gy + 8, 16), towerMat); tw.position.set(gx, (gy - 8) / 2, gz); grp.add(tw);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.3, 16), snowMat); cap.position.set(gx, gy - 0.15, gz); grp.add(cap);
    const g = new THREE.Group(); g.position.set(gx, gy, gz); grp.add(g);
    const parka = new THREE.MeshStandardMaterial({ color: 0x2c4a7a, roughness: 0.7 }), fur = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.95 }), dark = new THREE.MeshStandardMaterial({ color: 0x15151c, metalness: 0.6, roughness: 0.4 });
    const add = (geo, mat, x, y, z, par = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
    add(new THREE.CapsuleGeometry(0.32, 0.8, 4, 12), parka, 0, 1.4, 0);
    add(new THREE.SphereGeometry(0.3, 16, 12), fur, 0, 2.3, 0);
    add(new THREE.BoxGeometry(0.34, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2200 }), 0, 2.32, 0.26);
    for (const sd of [-1, 1]) add(new THREE.CapsuleGeometry(0.12, 0.45, 4, 8), parka, sd * 0.16, 0.5, 0);
    add(new THREE.BoxGeometry(0.1, 0.1, 1.1), dark, 0.3, 1.6, 0.6);
    add(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), parka, 0.3, 1.5, 0.15);
    const muzzle = add(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0x66f6ff }), 0.3, 1.6, 1.2);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshBasicMaterial({ color: 0xff3322, transparent: true, opacity: 0.9 })); beam.visible = false; grp.add(beam);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); spark.visible = false; grp.add(spark);
    const drawBeam = (a, ex, ey, ez, rad) => { B.set(ex, ey, ez); D.subVectors(B, a); const len = D.length() || 0.01; beam.position.copy(a).addScaledVector(D, 0.5); beam.scale.set(rad, len, rad); beam.quaternion.setFromUnitVectors(UP, D.normalize()); };
    let state = 'wait', timer = 0, coolDur = 0;
    // Uji garis pandang ke beberapa titik tubuh. Objek cover yang memotong
    // garis tembak tetap melindungi pemain; bagian tubuh yang terlihat bisa kena.
    function visibleTarget(pp, origin) {
      const targets = [
        { x: pp.x, y: pp.y + 1.0, z: pp.z }, // dada
        { x: pp.x, y: pp.y + 1.45, z: pp.z }, // bahu
        { x: pp.x, y: pp.y + 1.8, z: pp.z }  // kepala
      ];
      for (const target of targets) {
        if (!snowRayBlocked(origin.x, origin.y, origin.z, target.x, target.y, target.z)) return target;
      }
      return null;
    }
    const npc = {
      mesh: g, x: gx, y: gy + 2.0, z: gz, range, zone,
      inZone(pp) { return !zone || (pp.x >= zone[0] && pp.x <= zone[1] && pp.z >= zone[2] && pp.z <= zone[3] && pp.y >= zone[4] && pp.y <= zone[5]); },
      reset() { state = 'wait'; timer = 0; coolDur = 0; beam.visible = false; spark.visible = false; muzzle.scale.set(1, 1, 1); },
      update(delta, pp, t, canKill) {
        if (snowTimeLeft() > 0) { // masih hitung mundur: NPC hanya berjaga
          if (state !== 'wait') this.reset();
          g.rotation.y = yaw + Math.sin(t * 0.7 + idx * 1.7) * 0.5; return false;
        }
        if (state === 'wait') { state = 'cool'; timer = 0; coolDur = 0.15 + idx * 0.12; }
        muzzle.getWorldPosition(A);
        const cx = pp.x, cz = pp.z;
        const dist = Math.hypot(cx - A.x, (pp.y + 1.0) - A.y, cz - A.z);
        timer += delta;
        let df = Math.atan2(cx - g.position.x, cz - g.position.z) - g.rotation.y;
        df = Math.atan2(Math.sin(df), Math.cos(df));
        if (state !== 'fire') g.rotation.y += df * (1 - Math.exp(-delta * 12));

        if (state === 'cool') {
          beam.visible = false;
          if (timer >= coolDur) {
            if (dist <= range && this.inZone(pp)) { state = 'aim'; timer = 0; }
            else timer = coolDur;
          }
          return false;
        }

        if (state === 'aim' || state === 'lock') {
          if (dist > range || !this.inZone(pp)) {
            state = 'cool'; timer = 0; coolDur = 0.25; beam.visible = false; return false;
          }
          // Selalu perbarui sasaran selama membidik/mengunci agar pemain yang
          // terlihat tidak lolos hanya karena bergerak sedikit.
          const target = visibleTarget(pp, A);
          if (!target) {
            state = 'cool'; timer = 0; coolDur = 0.25; beam.visible = false;
            spark.visible = false; return false;
          }
          B.set(target.x, target.y, target.z);
          D.subVectors(B, A);
          const len = D.length() || 0.01;
          const ex = target.x, ey = target.y, ez = target.z;
          drawBeam(A, ex, ey, ez, state === 'aim' ? 0.035 : 0.065);
          beam.material.color.setHex(state === 'aim' ? 0xff3322 : 0xff9900);
          beam.visible = state === 'lock' || Math.sin(timer * 34) > -0.3;

          if (state === 'aim' && timer >= SNOW_AIM_TIME) { state = 'lock'; timer = 0; }
          else if (state === 'lock' && timer >= SNOW_LOCK_TIME) {
            // Cek ulang tepat saat menembak: cover yang kini menutupi pemain
            // menghentikan tembakan, tetapi pemain yang masih terlihat kena.
            const finalTarget = visibleTarget(pp, A);
            state = 'fire'; timer = 0;
            if (finalTarget) {
              drawBeam(A, finalTarget.x, finalTarget.y, finalTarget.z, 0.14);
              beam.material.color.setHex(0x66f6ff); beam.visible = true;
              spark.position.set(finalTarget.x, finalTarget.y, finalTarget.z); spark.visible = true;
              muzzle.scale.set(3, 3, 3);
              return !!canKill;
            }
            beam.visible = false; spark.visible = false;
          }
          return false;
        }
        if (state === 'fire' && timer > 0.22) {
          beam.visible = false; spark.visible = false; muzzle.scale.set(1, 1, 1);
          state = 'cool'; timer = 0; coolDur = SNOW_COOL_TIME;
        }
        return false;
      }
    };
    g.rotation.y = yaw; npcs.push(npc); return npc;
  }
  // NPC 1: menjaga Lapangan Es | NPC 2: menjaga Teras Timur & tangga | NPC 3: jembatan & spiral bawah | NPC 4: area finish
  const guardsArr = [
    makeGuard(0, 6, -34, 0, 40, 0, [-12, 30, -34, 8, -3, 6]),                       // camp awal, lapangan es, jembatan es batu
    makeGuard(49, 8, -48, 1, 40, -Math.PI / 2, [17, 50, -52, -25, 0, 14]),           // teras timur & tangga zig-zag
    makeGuard(-2, 16, -64, 2, 40, -Math.PI / 2, [-24, 0.5, -92, -40, 10, 30]),       // jembatan es, pad, spiral
    makeGuard(-27, 38, -145, 3, 42, 0, [-36, -18, -158, -130, 30, 42])               // medan terakhir & finish
  ];

  // Salju turun
  const N = 260, sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { sp[i * 3] = (Math.random() - 0.5) * 50; sp[i * 3 + 1] = Math.random() * 30; sp[i * 3 + 2] = (Math.random() - 0.5) * 50; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snowfall = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0.9 })); snowfall.frustumCulled = false; grp.add(snowfall);

  // Posisi aman (di belakang cover) untuk pengujian & titik teleport admin
  const tpOf = (p) => [p.mesh.position.x, top(p) + 0.05, p.mesh.position.z];
  const cp = cpList;
  const world = { platforms: P, hazards: [], guards: guardsArr, laserBeam: null, FIN_Y: top(PF3), WIN: WINP, MAZE_H: 0, MAZE_Z: 0,
    cover: C, cracks, snowfall, route, npcs, cps: cp, vanish, rotators, snowballs, windZones, swingPlanks, glowCrystals,
    tp: { start: [0, 0.25, 0], hub: tpOf(cp[1]), top: tpOf(cp[2]), maze: tpOf(cp[3]), finish: [WINP.x, top(PF3), WINP.z] } };

  const snowSys = { alarmed: false, hudText: '', hudMode: '' };
  function reset() {
    cracks.forEach(p => { p.crackState = 0; p.crackT = 0; p.isFallen = false; p.mesh.visible = true; p.mesh.position.x = p.startX; });
    vanish.forEach(p => { p.vanishState = 0; p.vanishT = 0; p.isFallen = false; p.mesh.visible = true; p.mesh.material.emissiveIntensity = 0.35; });
    snowSys.alarmed = false;
  }
  function updateHud({ currentMap, gameState }) {
    let el = document.getElementById('snow-hud');
    const on = currentMap === 'snow' && ['PLAYING', 'GAMEOVER', 'WIN', 'COUNTDOWN'].includes(gameState);
    if (!on) { if (el && el.style.display !== 'none') el.style.display = 'none'; return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'snow-hud';
      el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:30;padding:6px 14px;border-radius:12px;font:700 15px sans-serif;color:#fff;background:rgba(10,30,55,.72);border:2px solid #7fd6ff;pointer-events:none;white-space:nowrap';
      document.body.appendChild(el);
    }
    const left = gameState === 'COUNTDOWN' ? SNOW_TIMER_SEC : snowTimeLeft();
    let txt, mode;
    if (gameState === 'WIN') { txt = '❄️ Map Salju selesai!'; mode = 'win'; }
    else if (left > 0) { const sec = Math.ceil(left); txt = '❄️ NPC menembak dalam ' + String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); mode = left <= 10 ? 'warn' : 'ok'; }
    else { txt = 'NPC DETECT SELAMA 5 DETIK'; mode = 'fire'; }
    if (snowSys.hudText !== txt) { el.textContent = txt; snowSys.hudText = txt; }
    if (snowSys.hudMode !== mode) {
      snowSys.hudMode = mode;
      el.style.borderColor = mode === 'fire' ? '#ff3a2a' : (mode === 'warn' ? '#ffb02a' : '#7fd6ff');
      el.style.background = mode === 'fire' ? 'rgba(120,10,10,.8)' : 'rgba(10,30,55,.72)';
    }
    el.style.display = 'block';
    if (gameState === 'PLAYING') {
      if (left <= 0 && !snowSys.alarmed) { snowSys.alarmed = true; showToast('Waktu habis! cepat berlindung'); }
      if (left > 0) snowSys.alarmed = false;
    }
  }
  function update(delta, state) {
    const { curGroundPlat, physics, character, godMode, flyMode, hitCD, knock } = state;
    for (const p of cracks) {
      if (p.crackState === 0) { if (curGroundPlat === p && physics.isGrounded) { p.crackState = 1; p.crackT = 0; } }
      else if (p.crackState === 1) {
        p.crackT += delta; p.mesh.position.x = p.startX + Math.sin(p.crackT * 70) * 0.06;
        if (p.crackT > 0.75) { p.crackState = 2; p.crackT = 0; p.isFallen = true; p.mesh.visible = false; p.mesh.position.x = p.startX; }
      } else { p.crackT += delta; if (p.crackT > 3) { p.isFallen = false; p.mesh.visible = true; p.crackState = 0; } }
    }
    for (const p of vanish) {
      if (p.vanishState === 0 && curGroundPlat === p && physics.isGrounded) { p.vanishState = 1; p.vanishT = 0; }
      else if (p.vanishState === 1) {
        p.vanishT += delta; p.mesh.material.emissiveIntensity = 0.35 + Math.sin(p.vanishT * 24) * 0.3;
        if (p.vanishT > 0.65) { p.vanishState = 2; p.vanishT = 0; p.isFallen = true; p.mesh.visible = false; }
      } else if (p.vanishState === 2) {
        p.vanishT += delta;
        if (p.vanishT > 2.1) { p.vanishState = 3; p.vanishT = 0; p.mesh.visible = true; p.mesh.material.emissiveIntensity = 0.35; }
      } else if (p.vanishState === 3) {
        p.vanishT += delta; if (p.vanishT > 0.25) { p.vanishState = 0; p.vanishT = 0; p.isFallen = false; }
      }
    }
    for (const r of rotators) {
      r.mesh.rotation.y += r.speed * delta;
      if (character && physics && !godMode && !flyMode) {
        const dx = character.position.x - r.mesh.position.x, dz = character.position.z - r.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < r.radius && Math.abs(character.position.y - r.mesh.position.y) < 1.5 && hitCD <= 0) {
          knock.set((dx / (dist || 1)) * 15, (dz / (dist || 1)) * 15);
          physics.velocityY = Math.max(physics.velocityY, 7); physics.isGrounded = false;
        }
      }
    }
    for (const b of snowballs) {
      b.mesh.position[b.axis] = b.center + Math.sin(performance.now() * 0.001 * b.speed + b.phase) * b.range;
      b.mesh.rotation.x += delta * 2.8; b.mesh.rotation.z += delta * 1.7;
      if (character && !godMode && !flyMode) {
        const dx = character.position.x - b.mesh.position.x, dz = character.position.z - b.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < b.radius + 0.55 && Math.abs((character.position.y + 0.8) - b.mesh.position.y) < 1.8 && hitCD <= 0) {
          knock.set((dx / (d || 1)) * 19, (dz / (d || 1)) * 19);
          physics.velocityY = Math.max(physics.velocityY, 9); physics.isGrounded = false;
          showToast('☃️ Tertabrak bola salju!');
        }
      }
    }
    if (character && !godMode && !flyMode) for (const z of windZones) {
      if (Math.abs(character.position.x - z.x) < z.hx && Math.abs(character.position.z - z.z) < z.hz && character.position.y < z.maxY) {
        knock.x += z.dx * delta; knock.y += z.dz * delta;
      }
    }
    for (const plank of swingPlanks) plank.mesh.rotation.z = Math.sin(performance.now() * 0.001 * plank.speed + plank.phase) * 0.09;
    for (const c of glowCrystals) c.material.emissiveIntensity = 0.45 + (Math.sin(performance.now() * 0.002 + c.userData.phase) + 1) * 0.28;
    if (snowfall && character) {
      const pos = snowfall.geometry.attributes.position;
      snowfall.position.set(character.position.x, character.position.y - 6, character.position.z);
      for (let i = 0; i < pos.count; i++) { let y = pos.getY(i) - (2 + (i % 5) * 0.5) * delta; if (y < 0) y += 30; pos.setY(i, y); }
      pos.needsUpdate = true;
    }
  }
  return { world, group: grp, controller: { reset, update, updateHud, timeLeft: snowTimeLeft, rayBlocked: snowRayBlocked } };
}
