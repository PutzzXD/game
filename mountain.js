// Map Pendakian Gunung PARKOUR 3D — "Realistic Mountain Adventure".
// Update: Jalur diperpanjang, Hujan ditambahkan, Jalan Santai (Rest Area), Batu bergeser dihapus.
export function buildMountainWorld(THREE, scene, api = {}) {
  const LOW = !!api.lowQuality;
  const grp = new THREE.Group();
  grp.name = 'MOUNTAIN_WORLD';
  grp.visible = false;
  scene.add(grp);

  const P = [], C = [], cpList = [], route = [];
  const hazards = [], windZones = [], swingPlanks = [], rotators = [];
  const vanish = [], cracks = [], npcs = [], glowCrystals = [];
  const anim = []; // fungsi animasi dekoratif
  const CENTER = new THREE.Vector3(0, 0, -180); // Pusat map diperpanjang

  // ====================================================================
  // UTIL: matematika, noise, canvas
  // ====================================================================
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
  function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.03, z * 2.03) * 0.3 + vnoise(x * 4.1, z * 4.1) * 0.15;
  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(cv);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ====================================================================
  // TULANG PUNGGUNG JALUR (DIPERPANJANG & BERKELOK)
  // ====================================================================
  const SPINE = [
    [0,0.25,40],[0,0.25,9],[0,0.4,-45],[0,0.6,-53],[0,1.45,-64],[4.7,2.4,-70],[9.2,3.4,-75],[13.8,4.3,-80],[17.8,4.85,-85],[17.8,4.85,-93],
    [12,5.45,-103],[4,6.35,-111],[4,7.45,-121],[0,9.05,-128],[-5,10.75,-135],[-1,12.55,-142],[5,14.35,-149],[10,16.25,-156],[14,17.45,-164],
    [14,18.75,-176],[9,20.45,-183],[4,22.25,-190],[-1,24.05,-197],[-6,25.75,-204],
    // ZONA SANTAI 1 (Lereng Landai)
    [-12,26.50,-215],[-16,27.00,-230],[-18,27.50,-245],[-14,28.00,-260],[-4,29.00,-275],
    // ZONA RINTANGAN 2 (Tebing)
    [4,30.50,-285],[10,32.50,-295],[14,34.50,-305],[12,37.00,-315],[6,39.50,-325],[-2,42.00,-335],
    // ZONA SANTAI 2 (Hutan Atas)
    [-10,43.00,-350],[-14,44.00,-365],[-10,45.00,-380],[0,46.00,-395],
    // ZONA RINTANGAN 3 (Puncak Es)
    [10,48.00,-410],[16,50.50,-420],[14,53.00,-430],[6,55.50,-440],[-2,58.00,-450],
    // ZONA FINISH
    [-10,60.00,-465],[-10,60.00,-500]
  ];

  function spineAt(z) {
    if (z >= SPINE[0][2]) return { x: SPINE[0][0], y: SPINE[0][1] };
    for (let i = 1; i < SPINE.length; i++) {
      if (z >= SPINE[i][2]) {
        const a = SPINE[i - 1], b = SPINE[i], t = (a[2] - z) / (a[2] - b[2]);
        return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t) };
      }
    }
    const e = SPINE[SPINE.length - 1];
    return { x: e[0], y: e[1] };
  }

  function hf(x, z) {
    const s = spineAt(z), dx = Math.abs(x - s.x);
    const g = smooth(clamp(-z / 480, 0, 1)); 
    const depth = 9 + 25 * g;                       
    const W = lerp(95, 35, g * g);                  
    const wall = W * (1 - Math.exp(-Math.pow(Math.max(0, dx - 6), 1.2) / 55));
    const amp = 0.4 + 28 * smooth((dx - 8) / 46);
    const n1 = (fbm(x * 0.04, z * 0.04) - 0.5) * 2 * amp;
    const n2 = (vnoise(x * 0.13, z * 0.13) - 0.5) * 7 * smooth(dx / 30);
    const back = smooth((z - 8) / 32) * 38;         
    const end = smooth((-z - 480) / 50) * 24;       
    return s.y - depth + wall + n1 + n2 + back + end;
  }

  // ====================================================================
  // MATERIAL
  // ====================================================================
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const grassMat = mat(0x3f8440), dirtMat = mat(0x7b5a3c), stoneMat = mat(0x8c9094), darkStoneMat = mat(0x555c63, { flatShading: true });
  const woodMat = mat(0x80502d), leafMat = mat(0xffffff, { roughness: 0.95 }), snowMat = mat(0xf4f8fb);
  const cpMat = mat(0x22ddaa, { emissive: 0x0b9b72, emissiveIntensity: 0.45 });
  const cliffMat = mat(0xffffff, { flatShading: true, roughness: 1 });
  const baseRockMat = mat(0x6a5f52, { flatShading: true });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x369bd0, transparent: true, opacity: 0.66, roughness: 0.22, metalness: 0.08, side: THREE.DoubleSide });
  const ropeMat = mat(0x4c3828);

  // ====================================================================
  // CAHAYA, LANGIT, MATAHARI
  // ====================================================================
  grp.add(new THREE.HemisphereLight(0xdff0ff, 0x5b6b45, 1.15));
  const sunDir = new THREE.Vector3(-110, 55, -60).normalize();
  const sun = new THREE.DirectionalLight(0xffe0b0, 1.55);
  sun.position.set(0, 10, -180).addScaledVector(sunDir, 160);
  sun.target.position.set(0, 10, -180);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -155, right: 155, top: 155, bottom: -155, near: 1, far: 450 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4;
  grp.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xa8c8ff, 0.4);
  fill.position.set(70, 30, 70); grp.add(fill);

  const R = 600;
  const skyGeo = new THREE.SphereGeometry(R, 24, 16);
  { const p = skyGeo.attributes.position, col = new Float32Array(p.count * 3);
    const cTop = new THREE.Color(0x2b78cf), cMid = new THREE.Color(0x76b8ee), cHor = new THREE.Color(0xe3eef2), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / R;
      if (t <= 0) c.copy(cHor);
      else if (t < 0.25) c.copy(cHor).lerp(cMid, t / 0.25);
      else c.copy(cMid).lerp(cTop, Math.min(1, (t - 0.25) / 0.6));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.position.copy(CENTER); sky.renderOrder = -10; sky.frustumCulled = false; grp.add(sky);

  const glowTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    const r = seeded(7);
    for (let i = 0; i < 14; i++) {
      const x = 40 + r() * 176, y = 44 + r() * 40, rad = 26 + r() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
  function glowSprite(color, size, dist) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    s.position.copy(CENTER).addScaledVector(sunDir, dist); s.scale.set(size, size, 1); s.renderOrder = -9; grp.add(s);
  }
  glowSprite(0xffd9a0, 170, R * 0.92); glowSprite(0xfff6dc, 55, R * 0.9);

  // ====================================================================
  // PLATFORM
  // ====================================================================
  const decoPlats = [], grassPlats = [], manualTrees = [], rimBoulders = [];
  function plat(x, y, z, w, d, o = {}) {
    const log = !!o.log, round = o.shape === 'round';
    const h = log ? w : (o.h || 0.5), type = o.type || 'static';
    let geometry;
    if (log) { geometry = new THREE.CylinderGeometry(w / 2, w / 2, d, 10); geometry.rotateX(Math.PI / 2); }
    else if (round) geometry = new THREE.CylinderGeometry(w / 2, w / 2, h, 14);
    else geometry = new THREE.BoxGeometry(w, h, d);
    const material = o.cp ? cpMat : (o.material || (log ? woodMat : o.kind === 'grass' ? grassMat :
      o.kind === 'wood' ? woodMat : o.kind === 'snow' ? snowMat : o.kind === 'dirt' ? dirtMat : stoneMat));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y + 0.25 - h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
    const p = {
      mesh, width: w, depth: round ? w : d, type, hh: h / 2,
      startX: mesh.position.x, startY: mesh.position.y, startZ: mesh.position.z,
      range: o.range ?? 2.2, speed: o.speed ?? 1.3,
      phase: (P.length * 2.39996) % (Math.PI * 2),
      isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: round ? w / 2 : 0,
      grip: [0.85, 0.8], kind: o.kind
    };
    if (o.cp) {
      p.checkpoint = true; p.checkpointActivated = false; p.checkpointReadyMaterial = cpMat; cpList.push(p);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 8), mat(0xd9dedf));
      pole.position.set(x + w / 2 - 0.65, y + 1.75, z + d / 2 - 0.65); grp.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.68, 0.06), new THREE.MeshBasicMaterial({ color: 0x22ddaa }));
      flag.position.set(x + w / 2, y + 2.65, z + d / 2 - 0.65); grp.add(flag);
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.7, 4), mat(0xd8652b, { flatShading: true }));
      tent.rotation.y = Math.PI / 4; tent.position.set(x - w / 2 + 2, y + 1.1, z + d / 2 - 2); tent.castShadow = true; grp.add(tent);
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xff9a2a }));
      fire.position.set(x - w / 2 + 3.9, y + 0.6, z + d / 2 - 2); grp.add(fire);
      anim.push(t => { fire.scale.y = 1 + Math.sin(t * 9 + x) * 0.25; });
    }
    if (o.route) route.push(p);
    if (type === 'static' && !log && w >= 3) decoPlats.push(p);
    if (o.kind === 'grass' && !o.cp && type === 'static') grassPlats.push(p);
    P.push(p); return p;
  }
  const top = p => p.mesh.position.y + p.hh;
  const checkpointPlatform = (x, y, z, w, d) => plat(x, y, z, w, d, { kind: 'grass', cp: true, route: 1 });
  function plinth(cx, cz, topY, rt, rb, m) {
    const H = topY - (hf(cx, cz) - 2);
    if (H < 0.6) return;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, H, 9), m || baseRockMat);
    mesh.position.set(cx, topY - H / 2, cz); mesh.rotation.y = cx * 1.7 + cz; grp.add(mesh);
  }
  function sign(text, x, y, z, ry = 0) {
    const tex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#6d4426'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8c88a'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#fff3d6'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const ls = text.split('\n'); ls.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (ls.length - 1) / 2) * 38));
    });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.3, 6), woodMat);
    post.position.set(x, y + 1.15, z); grp.add(post);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.set(x, y + 2.0, z + 0.1); board.rotation.y = ry; grp.add(board);
  }

  // ====================================================================
  // ZONA 1 — Basecamp & Hutan
  // ====================================================================
  plat(0, 0, 0, 18, 18, { kind: 'grass', route: 1 });
  plat(0, 0, -15, 12, 13, { kind: 'grass', route: 1 });
  for (const [x, z, s] of [[-7.8,-5,1.3],[7.8,-6,1.2],[-8,4,1.1],[8,5,1.4],[-5.3,-11,1.1],[5.3,-19,1.2],[-5.2,-19.5,1.0]]) manualTrees.push([x, z < -9 ? 0.25 : 0.25, z, s]);
  sign('BASECAMP\nMULAI PENDAKIAN', 3.2, 0.25, -6.5, -0.15);
  plat(-0.9, 0.15, -23.8, 2.4, 2.4, { kind: 'stone', shape: 'round', route: 1 });
  plat(0.9, 0.3, -26.6, 2.4, 2.4, { kind: 'stone', shape: 'round', route: 1 });
  plat(-0.9, 0.3, -29.4, 2.4, 2.4, { kind: 'stone', shape: 'round', route: 1 });
  plat(0, 0.15, -36, 9, 8, { kind: 'dirt', route: 1 });
  { const pond = new THREE.Mesh(new THREE.CircleGeometry(6.1, 28), waterMat);
    pond.rotation.x = -Math.PI / 2; pond.position.set(0, 0.06, -27); grp.add(pond);
    plinth(0, -27, -0.02, 6, 4.2, mat(0x6f6252, { flatShading: true }));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; if (Math.abs(Math.sin(a)) > 0.8) continue;
      rimBoulders.push([Math.cos(a) * 6.4, 0.1, -27 + Math.sin(a) * 6.2, 0.9 + (i % 3) * 0.35]); } }
  plat(0, 0.2, -43, 7, 9, { kind: 'dirt', route: 1 });
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 6.5, 9.4), darkStoneMat);
    wall.position.set(sx * 5.4, 3.7, -43); wall.castShadow = true; grp.add(wall);
  }
  { const roof = new THREE.Mesh(new THREE.BoxGeometry(14.2, 2, 9.4), darkStoneMat); roof.position.set(0, 5.8, -43); roof.castShadow = true; grp.add(roof);
    for (let i = 0; i < 5; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.42, 8, 16, Math.PI), stoneMat);
      rib.position.set(0, 0.45, -46.6 + i * 1.8); grp.add(rib); }
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    for (const sx of [-1, 1]) for (const lz of [-45.5, -40.5]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampMat); l.position.set(sx * 3.55, 3, lz); grp.add(l); }
  }
  checkpointPlatform(0, 0.35, -53, 12, 10); // CP 1

  // ====================================================================
  // ZONA 2 — Lereng, Jembatan, Longsoran
  // ====================================================================
  plat(0, 1.2, -64, 7, 7, { kind: 'stone', route: 1 });
  plat(4.7, 2.2, -70, 3.4, 3.4, { kind: 'stone', type: 'moving_y', range: 0.8, speed: 1.2, route: 1 });
  plat(9.2, 3.1, -75, 3.2, 3.2, { kind: 'stone', type: 'moving_x', range: 1.7, speed: 1.1, route: 1 });
  plat(13.8, 4.0, -80, 3.2, 3.2, { kind: 'stone', type: 'moving_y', range: 0.9, speed: 1.4, route: 1 });
  plat(17.8, 4.6, -85, 5, 5, { kind: 'stone', route: 1 });
  sign('JEMBATAN\nGANTUNG', 20.1, 4.85, -83.6, -0.3);
  plat(17.8, 4.6, -89.6, 1.3, 3.4, { log: true, kind: 'wood', route: 1 });
  
  for (let i = 0; i < 7; i++) { 
    const x = 17.8 + (i - 3) * 1.75;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 2.8), woodMat);
    plank.position.set(x, 4.85, -93); plank.castShadow = true; grp.add(plank);
    swingPlanks.push({ mesh: plank, speed: 1.1 + i * 0.06, phase: i * 0.72 });
    plat(x, 4.7, -93, 1.62, 2.8, { kind: 'wood', route: 1, h: 0.3 }); 
  }
  plat(12, 4.9, -96.7, 1.3, 4.2, { log: true, kind: 'wood', route: 1 });
  
  for (const px of [10.6, 25.0]) {
    const H = 7.7 - (hf(px, -93) - 2);
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.0, H, 7), darkStoneMat);
    pylon.position.set(px, 7.7 - H / 2, -93); pylon.castShadow = true; grp.add(pylon);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), woodMat); beam.position.set(px, 7.6, -93); grp.add(beam);
  }
  { const ropeY = x => 5.95 + 1.5 * Math.pow(2 * ((x - 10.6) / 14.4) - 1, 2), hang = [];
    for (const side of [-1, 1]) {
      const pts = []; for (let k = 0; k <= 8; k++) { const x = lerp(10.6, 25.0, k / 8); pts.push(new THREE.Vector3(x, ropeY(x), -93 + side * 1.5)); }
      grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.06, 5, false), ropeMat));
      for (let i = 0; i < 7; i++) { const x = 17.8 + (i - 3) * 1.75; hang.push(x, 4.95, -93 + side * 1.5, x, ropeY(x), -93 + side * 1.5); }
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(hang, 3));
    grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x4c3828 }))); }

  // FUNGSI rollingRock DIHAPUS TOTAL.
  
  function rockfall(x, z, topY, period, offset, hgt = 16) {
    const r = 0.95, y1 = topY + r + 0.1, y0 = topY + hgt, warnT = 1.2, fall = 0.85;
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), darkStoneMat);
    mesh.visible = false; mesh.castShadow = true; grp.add(mesh);
    const warn = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.25, 20), new THREE.MeshBasicMaterial({ color: 0xff7a3a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    warn.rotation.x = -Math.PI / 2; warn.position.set(x, topY + 0.07, z); grp.add(warn);
    let active = false;
    hazards.push({
      mesh, radius: r,
      update(t) {
        const c = (((t + offset) % period) + period) % period;
        active = false; mesh.visible = false; warn.material.opacity = 0;
        if (c < warnT) warn.material.opacity = 0.25 + 0.45 * Math.abs(Math.sin(c * 8));
        else if (c < warnT + fall) { const f = (c - warnT) / fall; mesh.position.set(x, lerp(y0, y1, f * f), z); mesh.rotation.x = c * 5; mesh.visible = true; warn.material.opacity = 0.7; active = true; }
        else if (c < warnT + fall + 0.35) { mesh.position.set(x, y1, z); mesh.visible = true; }
      },
      test(pp) {
        if (!active) return false;
        const dx = pp.x - mesh.position.x, dy = (pp.y + 0.8) - mesh.position.y, dz = pp.z - mesh.position.z;
        if (dx * dx + dy * dy + dz * dz < (r + 0.7) * (r + 0.7)) { const len = Math.hypot(dx, dz) || 1; return { x: dx / len, z: dz / len }; }
        return false;
      }
    });
  }
  const slide = plat(12, 5.2, -103, 8, 8, { kind: 'stone', route: 1 });
  sign('AWAS!\nLONGSORAN', 15.4, top(slide), -99.9, 0.25);
  for (const [rx, rz, off] of [[9.4, -101.5, 0], [12, -104.3, 1.1], [14.6, -101.8, 2.2], [10.8, -106.2, 0.6]]) rockfall(rx, rz, top(slide), 3.6, off);
  const cp2 = checkpointPlatform(4, 6.1, -111, 9, 8); // CP 2
  sign('BADAI\nBERANGIN', 7.6, top(cp2), -108.6, -0.2);

  // ====================================================================
  // ZONA 3 — Tebing & Badai
  // ====================================================================
  plat(4, 6.7, -117, 1.6, 3.2, { log: true, kind: 'wood', route: 1 });
  plat(4, 7.2, -121, 4.2, 4.2, { kind: 'stone', route: 1 });
  plat(0, 8.8, -128, 2.5, 2.5, { kind: 'stone', route: 1 });
  plat(-5, 10.5, -135, 2.3, 2.3, { kind: 'stone', route: 1 });
  plat(-3, 11.4, -138.5, 1.6, 3.4, { kind: 'stone', route: 1 });
  plat(-1, 12.3, -142, 2.2, 2.2, { kind: 'stone', type: 'moving_x', range: 1.3, speed: 1.25, route: 1 });
  plat(5, 14.1, -149, 2.2, 2.2, { kind: 'stone', route: 1 });
  plat(7.5, 15.0, -152.5, 1.8, 2, { kind: 'stone', route: 1 });
  plat(10, 16, -156, 2.1, 2.1, { kind: 'stone', type: 'moving_y', range: 0.75, speed: 1.4, route: 1 });
  const cp3 = checkpointPlatform(14, 17.2, -164, 8, 8); // CP 3
  plat(14, 17.9, -171, 1.4, 5.2, { log: true, kind: 'wood', route: 1 });
  
  windZones.push({ x: 5, z: -149, hx: 7, hz: 7, dx: -7.5, dz: 2.0, maxY: 24 });
  { const gustMat = new THREE.MeshBasicMaterial({ color: 0xbcecff, transparent: true, opacity: 0.3 });
    for (let i = 0; i < 8; i++) { const gust = new THREE.Mesh(new THREE.TorusGeometry(1.1 + i * 0.12, 0.035, 6, 20), gustMat);
      gust.position.set(2 + (i % 3) * 2, 15 + i * 0.35, -145 - i * 1.7); gust.rotation.x = Math.PI / 2; grp.add(gust); } }
  
  const pivot = new THREE.Group(); pivot.position.set(14, 22, -178); grp.add(pivot);
  { const beam = new THREE.Mesh(new THREE.BoxGeometry(0.42, 5.5, 0.42), woodMat); beam.position.y = -2.5; pivot.add(beam);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), darkStoneMat); ball.position.y = -5.2; ball.castShadow = true; pivot.add(ball);
    for (let i = 0; i < 8; i++) { const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 5), woodMat), a = i * Math.PI / 4;
      spike.position.set(Math.cos(a) * 1.1, -5.2, Math.sin(a) * 1.1); spike.rotation.z = Math.cos(a) * Math.PI / 2; spike.rotation.x = Math.sin(a) * Math.PI / 2; pivot.add(spike); } }
  rotators.push({ mesh: pivot, speed: 1.35, radius: 5.5 });
  hazards.push({
    mesh: pivot,
    update(t) { pivot.rotation.z = Math.sin(t * 1.35) * 0.82; },
    test(pp) {
      const bx = pivot.position.x + Math.sin(pivot.rotation.z) * 5.1, by = pivot.position.y - Math.cos(pivot.rotation.z) * 5.1, bz = pivot.position.z;
      const dx = pp.x - bx, dz = pp.z - bz;
      if (Math.hypot(dx, (pp.y + 0.8) - by, dz) < 1.9) { const len = Math.hypot(dx, dz) || 1; return { x: dx / len, z: dz / len }; }
      return false;
    }
  });

  // ====================================================================
  // ZONA 4 — Tanjakan Awal (Menuju Jalan Santai 1)
  // ====================================================================
  plat(14, 18.5, -176, 4, 4, { kind: 'stone', route: 1 });
  const ledge = plat(9, 20.2, -183, 2.4, 2.4, { kind: 'stone', route: 1 });
  const ledge2 = plat(4, 22, -190, 2.3, 2.3, { kind: 'snow', route: 1 });
  plat(-1, 23.8, -197, 2.3, 2.3, { kind: 'snow', type: 'moving_x', range: 1.1, speed: 1.0, route: 1 });
  rockfall(9, -183, top(ledge), 4.6, 0.0, 15);
  rockfall(4, -190, top(ledge2), 4.6, 2.3, 15);
  checkpointPlatform(-6, 25.5, -204, 12, 12); // CP 4

  // ====================================================================
  // JALAN SANTAI 1 (Panjang, Tanpa Rintangan)
  // ====================================================================
  sign('JALAN SANTAI\nNIKMATI PEMANDANGAN', -6, 25.75, -206, 0);
  plat(-8, 26, -210, 6, 8, { kind: 'dirt', route: 1 });
  plat(-12, 26.2, -218, 10, 12, { kind: 'grass', route: 1 });
  plat(-15, 26.5, -230, 8, 15, { kind: 'dirt', route: 1 });
  plat(-16, 27, -245, 12, 18, { kind: 'grass', route: 1 });
  plat(-12, 27.5, -258, 8, 14, { kind: 'dirt', route: 1 });
  plat(-4, 28.2, -268, 10, 12, { kind: 'grass', route: 1 });
  checkpointPlatform(2, 28.8, -276, 8, 8); // CP 5 (Ujung jalan santai 1)

  // ====================================================================
  // ZONA RINTANGAN 2 (Tebing Curam 2)
  // ====================================================================
  plat(6, 30, -285, 2.5, 2.5, { kind: 'stone', type: 'moving_y', range: 1.5, speed: 1.2, route: 1 });
  plat(10, 32, -295, 2, 2, { kind: 'stone', route: 1 });
  plat(14, 34, -305, 2, 2, { kind: 'stone', type: 'moving_x', range: 2, speed: 1.5, route: 1 });
  plat(12, 36.5, -315, 2.5, 2.5, { kind: 'stone', route: 1 });
  plat(6, 39, -325, 2, 2, { kind: 'stone', type: 'moving_y', range: 1.8, speed: 1.4, route: 1 });
  const cp6 = checkpointPlatform(-2, 41.5, -335, 8, 8); // CP 6

  // ====================================================================
  // JALAN SANTAI 2 (Panjang, Tanpa Rintangan)
  // ====================================================================
  plat(-6, 42, -342, 8, 10, { kind: 'dirt', route: 1 });
  plat(-12, 42.5, -355, 12, 16, { kind: 'grass', route: 1 });
  plat(-14, 43, -370, 10, 14, { kind: 'dirt', route: 1 });
  plat(-8, 43.5, -382, 12, 12, { kind: 'grass', route: 1 });
  plat(0, 44, -393, 8, 10, { kind: 'dirt', route: 1 });
  checkpointPlatform(4, 44.5, -400, 8, 8); // CP 7

  // ====================================================================
  // ZONA RINTANGAN 3 (Puncak Es)
  // ====================================================================
  sign('AWAS!\nPUNCAK ES', 4, 44.75, -402, 0);
  plat(8, 46, -408, 1.8, 1.8, { kind: 'snow', route: 1 });
  plat(12, 48, -415, 1.5, 1.5, { kind: 'snow', type: 'moving_x', range: 2.5, speed: 1.6, route: 1 });
  plat(16, 50.5, -420, 1.5, 1.5, { kind: 'snow', route: 1 });
  plat(14, 53, -430, 1.5, 1.5, { kind: 'snow', type: 'moving_y', range: 2, speed: 1.8, route: 1 });
  plat(6, 55.5, -440, 1.8, 1.8, { kind: 'snow', route: 1 });
  checkpointPlatform(-2, 58, -450, 10, 10); // CP 8

  // ====================================================================
  // JALAN MENUJU PUNCAK & FINISH
  // ====================================================================
  plat(-6, 58.5, -456, 6, 6, { kind: 'snow', route: 1 });
  const finalSummit = plat(-10, 60, -468, 24, 24, { kind: 'snow', route: 1 });
  plinth(-10, -468, 60 - 0.01, 10, 5, mat(0x7d7f80, { flatShading: true }));
  
  const WINP = { x: -10, y: top(finalSummit), z: -468 };
  { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 10, 10), mat(0xe5e5e5)); pole.position.set(-18, WINP.y + 5, -464); grp.add(pole);
    const cloth = new THREE.PlaneGeometry(3.5, 2, 12, 4), basePos = Float32Array.from(cloth.attributes.position.array);
    const flag = new THREE.Mesh(cloth, new THREE.MeshStandardMaterial({ color: 0xffcc33, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(-18 + 1.75, WINP.y + 9, -464); grp.add(flag);
    anim.push(t => { const a = cloth.attributes.position;
      for (let i = 0; i < a.count; i++) { const bx = basePos[i * 3]; a.setZ(i, Math.sin(bx * 2.2 - t * 4) * 0.25 * (bx + 1.75) / 3.5); }
      a.needsUpdate = true; });
    const canvas = canvasTex(1024, 256, (g, w, h) => {
      g.fillStyle = '#263b2b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f4d36c'; g.lineWidth = 14; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 68px sans-serif'; g.fillText('PUNCAK GUNUNG', 512, 92); g.font = 'bold 62px sans-serif'; g.fillText('TERCAPAI', 512, 177);
    });
    for (const gx of [-18, -2]) { const gp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 11, 0.4), woodMat); gp.position.set(gx, WINP.y + 5.5, -476); gp.castShadow = true; grp.add(gp); }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: canvas, side: THREE.DoubleSide }));
    board.position.set(-10, WINP.y + 6.5, -476); grp.add(board);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 3.2, 80, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(WINP.x, WINP.y + 40, WINP.z); grp.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.15, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd45a }));
    ring.rotation.x = Math.PI / 2; ring.position.set(WINP.x, WINP.y + 0.3, WINP.z); grp.add(ring);
    anim.push(t => { ring.scale.setScalar(1 + Math.sin(t * 2.5) * 0.08); beam.material.opacity = 0.16 + Math.sin(t * 1.7) * 0.05; });
    for (let i = 0; i < 5; i++) rimBoulders.push([-6 + (i % 2) * 0.4, WINP.y + 0.25 + i * 0.45, -462, 1.1 - i * 0.18]);
  }

  // ====================================================================
  // MEDAN (HEIGHTFIELD) - DIPERLUAS
  // ====================================================================
  { const GX = LOW ? 80 : 130, GZ = LOW ? 120 : 200, zc = -220;
    const tg = new THREE.PlaneGeometry(400, 600, GX, GZ); tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i) + zc; pos.setXYZ(i, x, hf(x, z), z); }
    tg.computeVertexNormals();
    const nrm = tg.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const gA = new THREE.Color(0x3f7a3a), gB = new THREE.Color(0x65994a), rock = new THREE.Color(0x7b7e7f), rockD = new THREE.Color(0x585b5d), snow = new THREE.Color(0xf2f7fb), dirt = new THREE.Color(0x7a5c3d);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = nrm.getY(i), n = vnoise(x * 0.12, z * 0.12);
      const slope = 1 - ny, snowLine = 65 + n * 15;
      if (y > snowLine && ny > 0.35) c.copy(snow);
      else if (slope > 0.3) c.copy(rock).lerp(rockD, clamp((slope - 0.3) * 2 + n * 0.4, 0, 1));
      else if (y > 26) c.copy(gA).lerp(rock, smooth((y - 26) / 14 + n * 0.3));
      else { c.copy(gA).lerp(gB, n); if (slope > 0.16) c.lerp(dirt, (slope - 0.16) * 3); }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    terrain.receiveShadow = true; terrain.frustumCulled = false; grp.add(terrain); }

  // ====================================================================
  // AIR TERJUN & SUNGAI
  // ====================================================================
  function ribbon(pts, widthFn, yOff, material, vScale) {
    const pos = [], uv = [], idx = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)];
      const tx = b[0] - a[0], tz = b[1] - a[1], len = Math.hypot(tx, tz) || 1, nx = -tz / len, nz = tx / len, w = widthFn(i / (n - 1));
      for (const sd of [-1, 1]) { const px = pts[i][0] + nx * w / 2 * sd, pz = pts[i][1] + nz * w / 2 * sd; pos.push(px, hf(px, pz) + yOff, pz); uv.push(sd < 0 ? 0 : 1, (i / (n - 1)) * vScale); }
      if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.frustumCulled = false; grp.add(m); return m;
  }
  { const pts = []; for (let z = 30; z > -490; z -= 5) pts.push([spineAt(z).x + 2.5 * Math.sin(z * 0.04), z]);
    ribbon(pts, () => 5, 0.25, waterMat, 1); }
  { const fallTex = canvasTex(64, 256, (g, w, h) => {
      g.fillStyle = '#4aa9dc'; g.fillRect(0, 0, w, h); const r = seeded(21);
      for (let i = 0; i < 46; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.25 + r() * 0.5) + ')'; g.fillRect(r() * w, r() * h, 2 + r() * 5, 14 + r() * 50); } });
    fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping;
    const wz = -82, sx = spineAt(wz).x, pts = [];
    for (let k = 0; k <= 20; k++) pts.push([sx + lerp(48, 10, k / 20), wz + Math.sin(k * 0.5) * 1.6]);
    ribbon(pts, t => lerp(2, 4.4, t), 0.35, new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), 8);
    anim.push(t => { fallTex.offset.y = -t * 0.9; });
    const ex = pts[20][0], ez = pts[20][1], foam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    foam.position.set(ex, hf(ex, ez) + 1.5, ez); foam.scale.set(11, 7, 1); grp.add(foam); }

  // ====================================================================
  // PEGUNUNGAN JAUH
  // ====================================================================
  const rockGeo = (detail, amp, seed) => {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (vnoise(x * 2.2 + seed, z * 2.2 + y * 1.7) - 0.5) * amp; p.setXYZ(i, x * n, y * n, z * n); }
    g.computeVertexNormals(); return g;
  };
  const rockV = [rockGeo(1, 0.55, 3), rockGeo(1, 0.5, 11), rockGeo(0, 0.45, 5)];
  const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, fog: false });
  function farMountain(x, z, rad, hgt, hazeT, seed) {
    const g = new THREE.ConeGeometry(rad, hgt, 8, 5, true), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    const rock = new THREE.Color(0x6d7378), forest = new THREE.Color(0x2f5d3a), snow = new THREE.Color(0xf4f8fc), haze = new THREE.Color(0xbdd4ea);
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), t = (vy + hgt / 2) / hgt, j = vnoise(vx * 0.05 + seed, vz * 0.05 + vy * 0.04) - 0.5;
      if (t < 0.98) { const f = 1 + j * 0.55 * (1 - t); p.setXYZ(i, vx * f, vy + j * hgt * 0.06, vz * f); }
      if (t < 0.22) c.copy(forest).lerp(rock, t / 0.22 * 0.5); else if (t > 0.6 + j * 0.25) c.copy(snow); else c.copy(rock).lerp(forest, 0.2 - j * 0.3);
      c.lerp(haze, hazeT);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, farMat); m.position.set(x, -40 + hgt / 2, z); m.rotation.y = seed; m.frustumCulled = false; grp.add(m);
  }
  { const rF = seeded(55), layers = [[260, 14, 100, 160, 0.18], [360, 16, 140, 210, 0.42], [460, 18, 180, 270, 0.66]];
    layers.forEach(([dist, n, h0, h1, hz], li) => {
      for (let i = 0; i < n; i++) {
        const a = ((i + rF() * 0.6) / n) * Math.PI * 2, d = dist + (rF() - 0.5) * 40;
        farMountain(CENTER.x + Math.cos(a) * d, CENTER.z + Math.sin(a) * d, 80 + rF() * 35, lerp(h0, h1, rF()), hz, li * 7 + i * 1.7);
      }
    });
    farMountain(-50, -550, 140, 350, 0.5, 91); farMountain(80, -560, 130, 300, 0.5, 93); }

  // ====================================================================
  // AWAN & KABUT
  // ====================================================================
  { const mistMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (let i = 0; i < 18; i++) {
      const z = -10 - i * 24, s = spineAt(z), m = new THREE.Mesh(new THREE.PlaneGeometry(120, 62), mistMat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = i * 0.7; m.position.set(s.x + (i % 2 ? 9 : -9), s.y - 5.5 - (i % 3) * 1.5, z); grp.add(m);
    }
    const rc = seeded(404), mats = [0.95, 0.8, 0.6].map(o => new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: o, depthWrite: false, fog: false })), clouds = [];
    const nC = LOW ? 24 : 42;
    for (let i = 0; i < nC; i++) {
      const a = rc() * Math.PI * 2, d = 150 + rc() * 300, sp = new THREE.Sprite(mats[i % 3]);
      sp.position.set(CENTER.x + Math.cos(a) * d, 70 + d * 0.25 + rc() * 50, CENTER.z + Math.sin(a) * d);
      sp.scale.set(100 + rc() * 100, 42 + rc() * 30, 1); grp.add(sp); clouds.push([sp, sp.position.x, rc() * 6]);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = 32 + (i % 3) * 10, sp = new THREE.Sprite(mats[2]);
      sp.position.set(-10 + Math.cos(a) * r, 24 + (i % 4) * 2.5, -468 + Math.sin(a) * r); sp.scale.set(40, 16, 1); grp.add(sp); clouds.push([sp, sp.position.x, i]);
    }
    anim.push(t => { for (const [sp, bx, ph] of clouds) sp.position.x = bx + Math.sin(t * 0.03 + ph) * 24; }); }

  // ====================================================================
  // EFEK HUJAN ANIMASI (DITAMBAHKAN)
  // ====================================================================
  const rainCount = LOW ? 1000 : 3000;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(rainCount * 3);
  const rainVel = new Float32Array(rainCount); // Kecepatan jatuh berbeda-beda
  
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = Math.random() * 160 - 80;     // X
    rainPos[i * 3 + 1] = Math.random() * 80;       // Y
    rainPos[i * 3 + 2] = Math.random() * 500 - 250;// Z
    rainVel[i] = 40 + Math.random() * 20;          // Kecepatan
  }
  
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  
  // Material garis tipis transparan
  const rainMat = new THREE.LineBasicMaterial({
    color: 0xaaccff,
    transparent: true,
    opacity: 0.35,
    linewidth: 1
  });
  
  // Membuat garis untuk setiap partikel
  const rainLinesGeo = new THREE.BufferGeometry();
  const rainLinesPos = new Float32Array(rainCount * 6); // 2 titik per garis
  rainLinesGeo.setAttribute('position', new THREE.BufferAttribute(rainLinesPos, 3));
  const rainMesh = new THREE.LineSegments(rainLinesGeo, rainMat);
  rainMesh.frustumCulled = false;
  grp.add(rainMesh);

  // Animasi Hujan menggunakan delta time
  let rainTime = 0;
  anim.push((t) => {
    // Gunakan delta kira-kira 0.016 untuk frame 60fps
    const dt = 0.016;
    rainTime += dt;
    
    const pos = rainGeo.attributes.position.array;
    const linesPos = rainLinesGeo.attributes.position.array;
    
    for (let i = 0; i < rainCount; i++) {
      // Jatuhkan hujan
      pos[i * 3 + 1] -= rainVel[i] * dt;
      
      // Jika menyentuh tanah, reset ke atas
      if (pos[i * 3 + 1] < -10) { 
        pos[i * 3 + 1] = 80; 
        // Reset posisi X, Z secara acak di sekitar pusat
        pos[i * 3] = CENTER.x + (Math.random() * 160 - 80);
        pos[i * 3 + 2] = CENTER.z + (Math.random() * 500 - 250);
      }
      
      // Update garis hujan
      const px = pos[i * 3];
      const py = pos[i * 3 + 1];
      const pz = pos[i * 3 + 2];
      
      // Titik awal (atas)
      linesPos[i * 6] = px;
      linesPos[i * 6 + 1] = py;
      linesPos[i * 6 + 2] = pz;
      
      // Titik akhir (bawah)
      linesPos[i * 6 + 3] = px;
      linesPos[i * 6 + 4] = py - 1.5; // Panjang garis hujan
      linesPos[i * 6 + 5] = pz;
    }
    rainGeo.attributes.position.needsUpdate = true;
    rainLinesGeo.attributes.position.needsUpdate = true;
  });

  // ====================================================================
  // VEGETASI, BATU, RUMPUT
  // ====================================================================
  const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
  function inst(geo, material, n, cast) {
    const m = new THREE.InstancedMesh(geo, material, Math.max(1, n));
    m.castShadow = !!cast; m.receiveShadow = true; m.frustumCulled = false; m.userData = { i: 0, cap: Math.max(1, n) }; m.count = 0; grp.add(m); return m;
  }
  function put(m, x, y, z, sx, sy, sz, ry, color) {
    const u = m.userData; if (u.i >= u.cap) return;
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry || 0, 0); dummy.updateMatrix();
    m.setMatrixAt(u.i, dummy.matrix); if (color && m.setColorAt) m.setColorAt(u.i, color); u.i++; m.count = u.i;
  }
  const nearPlat = (x, z, topY) => {
    for (const p of P) if (Math.abs(x - p.startX) - p.width / 2 < 3 + p.range && Math.abs(z - p.startZ) - p.depth / 2 < 3 + p.range && topY > p.startY - p.hh - 1) return true;
    return false;
  };

  { const rT = seeded(101), trees = [], want = LOW ? 500 : 1000;
    for (let tries = 0; trees.length < want && tries < want * 16; tries++) {
      const z = lerp(34, -480, rT()), s0 = spineAt(z), x = s0.x + (rT() < 0.5 ? -1 : 1) * (7 + Math.pow(rT(), 1.5) * 110), y = hf(x, z);
      if (Math.abs(x) > 155 || y > 30 + (vnoise(x * 0.05, z * 0.05) - 0.5) * 10) continue;
      if (Math.hypot(hf(x + 2, z) - hf(x - 2, z), hf(x, z + 2) - hf(x, z - 2)) > 3.5) continue;
      const s = 0.9 + rT() * 0.9; if (nearPlat(x, z, y + 8 * s)) continue;
      trees.push([x, y - 0.15, z, s]);
    }
    const all = trees.concat(manualTrees), n = all.length;
    const trunk = inst(new THREE.CylinderGeometry(0.2, 0.32, 2, 6), woodMat, n, !LOW);
    const tierDef = [[1.7, 2.6, 2.6], [1.35, 2.4, 4.0], [0.95, 2.2, 5.4]];
    const tiers = tierDef.map(([r, h]) => inst(new THREE.ConeGeometry(r, h, 8), leafMat, n, !LOW));
    for (const [x, y, z, s] of all) {
      const ry = hash2(x, z) * 6.28; put(trunk, x, y + s, z, s, s, s, ry);
      tmpC.setHSL(0.3 + hash2(z, x) * 0.06, 0.45 + hash2(x + 1, z) * 0.2, 0.16 + hash2(x, z + 1) * 0.1);
      tierDef.forEach(([r, h, cy], i) => put(tiers[i], x, y + cy * s, z, s, s, s, ry, tmpC));
    } }

  { const rC = seeded(303), A = inst(rockV[0], cliffMat, 90, !LOW), B = inst(rockV[1], cliffMat, 90, !LOW);
    for (let z = -30; z > -480; z -= LOW ? 12 : 8) for (const side of [-1, 1]) {
      const r = 5 + rC() * 6, hgt = 10 + rC() * (12 + -z * 0.12), x = spineAt(z).x + side * (r + 10 + rC() * 10), base = hf(x, z) - 4;
      tmpC.setHSL(0.08 + rC() * 0.05, 0.05 + rC() * 0.08, 0.34 + rC() * 0.1);
      put(rC() < 0.5 ? A : B, x, base + hgt * 0.4, z + rC() * 4, r, hgt * 0.55, r * 0.85, rC() * 6.28, tmpC);
    }
    const tm = new THREE.Mesh(rockV[0], darkStoneMat);
    tm.scale.set(8.5, 4.4, 7); tm.position.set(0, 7.6, -43); tm.castShadow = true; grp.add(tm); }

  { const rR = seeded(808), nB = (LOW ? 180 : 380) + rimBoulders.length + decoPlats.length * 3;
    const boulders = inst(rockV[2], cliffMat, nB, !LOW);
    for (let i = 0, k = 0; i < (LOW ? 180 : 340) && k < 6000; k++) {
      const z = lerp(34, -480, rR()), x = spineAt(z).x + (rR() < 0.5 ? -1 : 1) * (6 + Math.pow(rR(), 1.4) * 100), y = hf(x, z), s = 0.7 + Math.pow(rR(), 2) * 3.5;
      if (y > 65 || nearPlat(x, z, y + 2 * s)) continue;
      tmpC.setHSL(0.08, 0.06, 0.3 + rR() * 0.2); put(boulders, x, y + s * 0.3, z, s * 1.2, s * 0.8, s, rR() * 6.28, tmpC); i++;
    }
    for (const p of decoPlats) for (let i = 0; i < 3; i++) {
      if (p.kind === 'wood') continue;
      const sd = rR() < 0.5 ? -1 : 1, s = 0.28 + rR() * 0.3, ax = rR() < 0.5;
      const x = ax ? p.startX + sd * (p.width / 2 - 0.1) : p.startX + (rR() - 0.5) * p.width, z = ax ? p.startZ + (rR() - 0.5) * p.depth : p.startZ + sd * (p.depth / 2 - 0.1);
      tmpC.setHSL(0.08, 0.05, 0.35 + rR() * 0.15); put(boulders, x, top(p) + s * 0.1, z, s * 1.2, s * 0.8, s, rR() * 6.28, tmpC);
    }
    for (const [x, y, z, s] of rimBoulders) { tmpC.setHSL(0.09, 0.06, 0.42); put(boulders, x, y, z, s * 1.2, s * 0.8, s, hash2(x, z) * 6.28, tmpC); }
    const baseGeo = new THREE.ConeGeometry(1, 1, 6); baseGeo.rotateX(Math.PI);
    const bases = inst(baseGeo, baseRockMat, decoPlats.length + 1, !LOW);
    decoPlats.forEach((p, i) => { if (p.width >= 7) plinth(p.startX, p.startZ, p.startY - p.hh - 0.01, Math.min(p.width, p.depth) * 0.5 - 0.3, Math.min(p.width, p.depth) * 0.22);
      else put(bases, p.startX, p.startY - p.hh - 1.5 - (i % 3) * 0.5, p.startZ, p.width * 0.5, 3 + (i % 3), p.depth * 0.5, i); }); }

  { const rB = seeded(909), nBush = LOW ? 180 : 380;
    const bushes = inst(new THREE.IcosahedronGeometry(0.8, LOW ? 0 : 1), mat(0xffffff, { flatShading: true }), nBush, false);
    for (let i = 0, k = 0; i < nBush && k < 8000; k++) {
      const z = lerp(34, -480, rB()), x = spineAt(z).x + (rB() < 0.5 ? -1 : 1) * (6 + Math.pow(rB(), 1.3) * 80), y = hf(x, z), s = 0.5 + rB() * 0.9;
      if (y > 30 || nearPlat(x, z, y + 1.2 * s)) continue;
      tmpC.setHSL(0.24 + rB() * 0.1, 0.5, 0.2 + rB() * 0.12); put(bushes, x, y + 0.3 * s, z, s * 1.3, s, s * 1.2, rB() * 6.28, tmpC); i++;
    }
    const nTuft = LOW ? 360 : 750, tufts = inst(new THREE.ConeGeometry(0.09, 0.6, 4), mat(0xffffff), nTuft, false);
    const flowers = inst(new THREE.IcosahedronGeometry(0.12, 0), mat(0xffffff, { roughness: 0.6 }), 200, false);
    const fCols = [0xffffff, 0xffe14a, 0xe05fc0, 0xff8a3d];
    for (const p of grassPlats) {
      const nT = Math.min(Math.floor(p.width * p.depth * 0.6), 200), nF = Math.min(Math.floor(p.width * p.depth * 0.12), 40);
      for (let i = 0; i < nT; i++) { tmpC.setHSL(0.22 + rB() * 0.1, 0.55, 0.28 + rB() * 0.15); const s = 0.6 + rB() * 0.9;
        put(tufts, p.startX + (rB() - 0.5) * (p.width - 1), top(p) + 0.3 * s, p.startZ + (rB() - 0.5) * (p.depth - 1), s, s, s, 0, tmpC); }
      for (let i = 0; i < nF; i++) { tmpC.setHex(fCols[Math.floor(rB() * 4)]);
        put(flowers, p.startX + (rB() - 0.5) * (p.width - 1), top(p) + 0.45, p.startZ + (rB() - 0.5) * (p.depth - 1), 1, 1, 1, 0, tmpC); }
    }
    for (let i = 0, k = 0; i < (LOW ? 120 : 260) && k < 5000; k++) {
      const z = lerp(30, -250, rB()), x = spineAt(z).x + (rB() < 0.5 ? -1 : 1) * (8 + rB() * 35), y = hf(x, z);
      if (y > 24 || nearPlat(x, z, y + 1)) continue;
      tmpC.setHSL(0.2 + rB() * 0.1, 0.5, 0.25 + rB() * 0.15); const s = 1 + rB() * 1.4; put(tufts, x, y + 0.3 * s, z, s, s, s, 0, tmpC); i++;
    }
    const caps = inst(new THREE.SphereGeometry(1.1, 10, 8), snowMat, 24, false);
    for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, s = 0.9 + (i % 3) * 0.3;
      dummy.position.set(-10 + Math.cos(a) * 10.5, WINP.y + 0.15, -468 + Math.sin(a) * 10.5); dummy.scale.set(1.6 * s, 0.4 * s, 1.2 * s); dummy.rotation.set(0, a, 0); dummy.updateMatrix();
      caps.setMatrixAt(caps.userData.i++, dummy.matrix); caps.count = caps.userData.i; } }

  // ====================================================================
  // ANIMASI AMBIENT (Termasuk Hujan)
  // ====================================================================
  hazards.push({ mesh: new THREE.Object3D(), update(t) { for (const f of anim) f(t); }, test() { return false; } });

  // ====================================================================
  // KONTRAK RETURN
  // ====================================================================
  const tpOf = p => [p.mesh.position.x, top(p) + 0.05, p.mesh.position.z];
  const world = {
    platforms: P, hazards, guards: [], laserBeam: null,
    FIN_Y: top(finalSummit), WIN: WINP, MAZE_H: 0, MAZE_Z: 0,
    cover: C, cracks, route, npcs, cps: cpList, checkpoint: cpList,
    vanish, rotators, snowballs: [], windZones, swingPlanks, glowCrystals,
    tp: { start: [0, 0.25, 0], hub: tpOf(cpList[0]), top: tpOf(cpList[2]), maze: tpOf(cpList[3]), finish: [WINP.x, WINP.y, WINP.z] }
  };
  return { world, group: grp };
}