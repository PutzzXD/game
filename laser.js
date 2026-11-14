// ============================================================
//  LASER.JS  —  Map "Laser Lab" (terinspirasi Stumble Guys)
//  Arena bundar berlantai ubin biru-abu, dikelilingi cincin hazard
//  kuning-hitam, kolam slime hijau, dek ungu, layar monitor & tabung.
//  Laser merah-muda JALAN LURUS menyapu arena (tidak berputar).
//  5 detik pertama aman; laser pertama muncul di detik ke-5, lalu makin
//  lama makin sering & makin cepat, datang dari arah yang berbeda-beda.
//  Kena laser / jatuh ke slime = tereliminasi.
//
//  Pemakaian (mirip buildHoneyWorld):
//    import { buildLaserWorld } from './laser.js';
//    laserWorld = buildLaserWorld(THREE, scene, { onHit: () => {...} });
//    laserWorld.group.visible = false;
//
//    // saat map dipilih  : laserWorld.group.visible = true; laserWorld.applyEnvironment(scene);
//    // saat ronde mulai  : laserWorld.reset(); character.position.copy(laserWorld.spawn);
//    // tiap frame        : const hit = laserWorld.update(delta, character.position, elapsedDetik?);
//    //                     if (hit) -> eliminasi pemain (sama seperti jatuh)
//    // batas jatuh       : laserWorld.fallLimit
//
//  elapsedDetik (opsional) = detik sejak ronde dimulai. Di multiplayer isi dengan
//  (serverNow() - roomStartAt) / 1000 agar laser SAMA persis di semua pemain
//  (semua gerakan laser dihitung deterministik dari waktu, tanpa random).
// ============================================================

export function buildLaserWorld(THREE, scene, opts = {}) {
  const FLOOR_TOP = 0.25;            // tinggi permukaan lantai (sama dgn spawn map lain)
  const ARENA_R = 9;                 // radius lantai yang bisa diinjak
  const HAZARD_OUT = 10.4;           // radius luar cincin hazard
  const RAIL_R = 11.0;               // radius jalur emitter laser
  const SLIME_Y = -1.2;
  const BEAM_Y = FLOOR_TOP + 0.62;   // tinggi tengah laser dari dasar
  const BEAM_R = 0.07;               // tebal inti laser
  const BEAM_HIT_TOP = BEAM_Y + 0.12;// kaki pemain di bawah ini = kena laser
  const PLAYER_R = 0.38;

  const FIRST_DELAY = opts.firstDelay ?? 5;     // detik laser pertama MUNCUL (masa aman awal)
  const WARN = 0.9;                             // detik kedip di tepi arena sebelum laser mulai jalan
  const START_GAP = opts.interval || 3.2;       // jeda antar laser di awal (detik)
  const MIN_GAP = opts.minGap || 0.8;           // jeda tercepat antar laser
  const GAP_DECAY = 0.95;                       // tiap laser baru, jeda dikali ini (makin rapat)
  const SPEED_START = 3.4, SPEED_MAX = 7.2;     // kecepatan jalan laser (unit/detik)
  const TRAVEL = ARENA_R + 1.5;                 // laser jalan dari -TRAVEL ke +TRAVEL
  const MAX_DUR = (TRAVEL * 2) / SPEED_START + WARN;
  const POOL = Math.ceil(MAX_DUR / MIN_GAP) + 2; // jumlah mesh laser yang didaur ulang

  const group = new THREE.Group();
  group.name = 'laser-world';
  scene.add(group);

  const hasDoc = typeof document !== 'undefined';
  function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
    if (!hasDoc) return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---------- Tekstur ----------
  // Ubin lantai biru-abu dengan garis sambungan & baut kecil.
  const tileTex = canvasTex(256, 256, (g, w, h) => {
    const shades = ['#a9bde0', '#9fb4da', '#b4c6e6', '#a3b8de'];
    const n = 2, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = shades[(i * 2 + j) % shades.length];
      g.fillRect(i * s, j * s, s, s);
      g.strokeStyle = '#6f84ad'; g.lineWidth = 4; g.strokeRect(i * s + 2, j * s + 2, s - 4, s - 4);
      g.fillStyle = '#7d92bb';
      [[10, 10], [s - 10, 10], [10, s - 10], [s - 10, s - 10]].forEach(([bx, by]) => { g.beginPath(); g.arc(i * s + bx, j * s + by, 3, 0, 7); g.fill(); });
    }
  }, 5, 5);

  // Garis miring kuning-hitam untuk cincin hazard.
  const hazardTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f5c400'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1b1b';
    for (let k = -2; k < 5; k++) {
      g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 + 16, 0); g.lineTo(k * 32 + 16 + h, h); g.lineTo(k * 32 + h, h); g.fill();
    }
  }, 28, 1);

  // Layar monitor hijau berpola grid.
  const screenTex = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#2bd94a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7dff95'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#0d5a1c'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  });

  // ---------- Material ----------
  const metalDark = new THREE.MeshStandardMaterial({ color: 0x2b2f3d, roughness: 0.55, metalness: 0.6 });
  const metalLight = new THREE.MeshStandardMaterial({ color: 0x9aa3b8, roughness: 0.4, metalness: 0.7 });
  const floorTop = new THREE.MeshStandardMaterial({ color: tileTex ? 0xffffff : 0xa9bde0, map: tileTex || null, roughness: 0.55, metalness: 0.1 });
  const floorSide = new THREE.MeshStandardMaterial({ color: 0x3a3f55, roughness: 0.6, metalness: 0.4 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: tileTex ? 0xffffff : 0xf5c400, map: hazardTex || null, roughness: 0.6 });
  const slimeMat = new THREE.MeshStandardMaterial({ color: 0x30e04a, emissive: 0x22ff3c, emissiveIntensity: 0.9, roughness: 0.25 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x6d4fb0, roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide });
  const deckDark = new THREE.MeshStandardMaterial({ color: 0x4a3480, roughness: 0.7, metalness: 0.2 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: screenTex || null, emissive: 0x20c040, emissiveMap: screenTex || null, emissiveIntensity: 0.9, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x43e85a, emissive: 0x1fd23a, emissiveIntensity: 0.7, transparent: true, opacity: 0.78, roughness: 0.15 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5, metalness: 0.2 });

  // ---------- Lantai arena (satu-satunya yang bisa diinjak) ----------
  const floorGeo = new THREE.CylinderGeometry(ARENA_R, ARENA_R, 1, 64);
  const floorMesh = new THREE.Mesh(floorGeo, [floorSide, floorTop, floorSide]);
  floorMesh.position.set(0, FLOOR_TOP - 0.5, 0);
  floorMesh.receiveShadow = true; floorMesh.castShadow = true;
  group.add(floorMesh);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 3, 24), metalDark);
  pedestal.position.set(0, FLOOR_TOP - 1 - 1.5, 0);
  group.add(pedestal);

  // Format platform sama dgn map lain agar fisika game (lantai & jatuh) langsung jalan.
  const platforms = [{
    mesh: floorMesh, width: ARENA_R * 2, depth: ARENA_R * 2, type: 'static', hh: 0.5,
    startX: 0, startY: floorMesh.position.y, startZ: 0, range: 0, speed: 0, phase: 0,
    isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: ARENA_R
  }];

  // ---------- Cincin hazard kuning-hitam ----------
  const hazardPts = [new THREE.Vector2(ARENA_R, FLOOR_TOP - 0.3), new THREE.Vector2(ARENA_R, FLOOR_TOP - 0.05), new THREE.Vector2(HAZARD_OUT, FLOOR_TOP - 0.05), new THREE.Vector2(HAZARD_OUT, FLOOR_TOP - 0.5)];
  const hazardRing = new THREE.Mesh(new THREE.LatheGeometry(hazardPts, 72), hazardMat);
  hazardRing.material.side = THREE.DoubleSide;
  group.add(hazardRing);

  // ---------- Kolam slime hijau ----------
  const slime = new THREE.Mesh(new THREE.RingGeometry(HAZARD_OUT - 0.4, 13.2, 72, 1), slimeMat);
  slime.rotation.x = -Math.PI / 2; slime.position.y = SLIME_Y;
  group.add(slime);
  const slimeCore = new THREE.Mesh(new THREE.CircleGeometry(HAZARD_OUT, 48), slimeMat);
  slimeCore.rotation.x = -Math.PI / 2; slimeCore.position.y = SLIME_Y - 0.6;
  group.add(slimeCore);

  // ---------- Dek ungu di luar kolam ----------
  const deckPts = [new THREE.Vector2(13, -1.6), new THREE.Vector2(13, 0.0), new THREE.Vector2(26, 0.0), new THREE.Vector2(26, -1.6)];
  const deck = new THREE.Mesh(new THREE.LatheGeometry(deckPts, 72), deckMat);
  deck.receiveShadow = true; group.add(deck);
  const deckLip = new THREE.Mesh(new THREE.TorusGeometry(13.1, 0.22, 8, 72), yellowMat);
  deckLip.rotation.x = Math.PI / 2; deckLip.position.y = 0.05;
  group.add(deckLip);
  // Baut/silinder kecil di dek
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), deckDark);
    bolt.position.set(Math.cos(a) * 14.6, 0.08, Math.sin(a) * 14.6); group.add(bolt);
  }

  // Rel jalur emitter laser (mengambang di atas slime)
  const rail = new THREE.Mesh(new THREE.TorusGeometry(RAIL_R, 0.09, 8, 96), metalLight);
  rail.rotation.x = Math.PI / 2; rail.position.y = BEAM_Y - 0.15;
  group.add(rail);

  // ---------- Dekorasi: layar monitor di lengan robot ----------
  const screens = [];
  [[-0.9, 5.2, 4.2], [0.35, 5.8, 4.8], [1.5, 5.0, 4.0], [2.9, 5.6, 4.4], [4.4, 5.2, 4.2]].forEach(([ang, y, w], i) => {
    const R = 21.5 + (i % 2) * 1.5, ax = Math.cos(ang) * R, az = Math.sin(ang) * R;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, y, 10), metalDark);
    pole.position.set(ax, y / 2, az); group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.4), yellowMat);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, w * 0.62 + 0.5, 0.45), metalDark);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.62), screenMat.clone());
    const holder = new THREE.Group();
    holder.position.set(ax, y + 1.4, az);
    frame.position.z = 0; scr.position.z = 0.24; holder.add(frame, scr);
    holder.lookAt(0, 3, 0);
    group.add(holder); arm.position.set(ax, y, az); arm.lookAt(0, y, 0); group.add(arm);
    screens.push(scr);
  });

  // Tabung kaca slime hijau besar di kiri belakang (seperti di gambar)
  const vat = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 6.5, 24), glassMat);
  vat.position.set(-19, 3.25, -13); group.add(vat);
  const vatCap = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.6, 24), yellowMat);
  vatCap.position.set(-19, 6.8, -13); group.add(vatCap);
  const vatBase = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3, 0.8, 24), metalDark);
  vatBase.position.set(-19, 0.4, -13); group.add(vatBase);
  // Pipa penghubung tabung -> kolam
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 10), yellowMat);
  pipe.rotation.z = Math.PI / 2; pipe.rotation.y = 0.6; pipe.position.set(-15.5, 1.2, -9.5); group.add(pipe);

  // ---------- Laser ----------
  // Tiap laser = garis lurus (chord) yang berputar mengelilingi pusat arena.
  // Emitter di kedua ujung meluncur di rel. Semua posisi = fungsi waktu (deterministik).
  const beamCoreMat = (op) => new THREE.MeshBasicMaterial({ color: 0xffe3ef, transparent: true, opacity: op, fog: false });
  const beamGlowMat = (op) => new THREE.MeshBasicMaterial({ color: 0xff2e7e, transparent: true, opacity: op, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const emitterGeo = new THREE.CylinderGeometry(0.32, 0.42, 1, 12);
  const emitterBulbGeo = new THREE.SphereGeometry(0.34, 14, 10);
  const floorGlowGeo = new THREE.PlaneGeometry(1, 1);

  // Setiap laser = garis lurus (chord) yang JALAN menyeberangi arena, bukan berputar.
  // Laser ke-k muncul di T(k), arah datangnya beda-beda (golden angle),
  // jeda antar laser makin pendek & kecepatan makin tinggi. Semua deterministik dari waktu.
  const lasers = [];
  for (let i = 0; i < POOL; i++) {
    const core = new THREE.Mesh(unitCyl, beamCoreMat(1)); core.scale.set(BEAM_R, 1, BEAM_R);
    const glow = new THREE.Mesh(unitCyl, beamGlowMat(0.38)); glow.scale.set(0.2, 1, 0.2);
    const floorGlow = new THREE.Mesh(floorGlowGeo, new THREE.MeshBasicMaterial({ color: 0xff2e7e, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    floorGlow.rotation.x = -Math.PI / 2;
    const ems = [0, 1].map(() => {
      const g = new THREE.Group();
      const post = new THREE.Mesh(emitterGeo, metalDark);
      const postH = BEAM_Y - SLIME_Y + 0.3; post.scale.y = postH; post.position.y = -postH / 2 + 0.3;
      const bulb = new THREE.Mesh(emitterBulbGeo, new THREE.MeshBasicMaterial({ color: 0xff4d94, fog: false }));
      g.add(post, bulb); g.position.y = BEAM_Y; return g;
    });
    const holder = new THREE.Group(); holder.visible = false;
    holder.add(core, glow, floorGlow, ems[0], ems[1]);
    group.add(holder);
    lasers.push({ i, holder, core, glow, floorGlow, ems });
  }

  // Waktu muncul laser ke-k (di-cache; dihitung kumulatif dari jeda yang makin pendek).
  const spawnTimes = [FIRST_DELAY];
  function spawnTime(k) {
    while (spawnTimes.length <= k) {
      const n = spawnTimes.length;
      const gap = Math.max(MIN_GAP, START_GAP * Math.pow(GAP_DECAY, n - 1));
      spawnTimes.push(spawnTimes[n - 1] + gap);
    }
    return spawnTimes[k];
  }
  const speedOf = (k) => Math.min(SPEED_MAX, SPEED_START + 0.04 * (spawnTime(k) - FIRST_DELAY));
  const angleOf = (k) => k * 2.399963 + 0.4;         // arah datang laser (rad), selalu berganti-ganti

  // ---------- State ----------
  let elapsed = 0, hitFlag = false, activeCount = 0;

  // pos = posisi laser sepanjang arah jalannya (-TRAVEL .. +TRAVEL), a = arah jalan.
  function placeLaser(L, k, t, pos, moving) {
    const a = angleOf(k), na = Math.cos(a), nb = Math.sin(a);
    const th = a + Math.PI / 2;                         // arah garis laser (tegak lurus arah jalan)
    const c = Math.cos(th), s = Math.sin(th);
    const half = Math.sqrt(Math.max(0.01, RAIL_R * RAIL_R - pos * pos));
    const h = L.holder;
    h.position.set(na * pos, 0, nb * pos);
    const rot = new THREE.Euler(0, -th, Math.PI / 2);
    L.core.rotation.copy(rot); L.glow.rotation.copy(rot);
    L.core.position.y = BEAM_Y; L.glow.position.y = BEAM_Y;
    L.core.scale.y = half * 2; L.glow.scale.y = half * 2;
    L.floorGlow.scale.set(half * 2, 0.5, 1); L.floorGlow.position.y = FLOOR_TOP + 0.02;
    L.floorGlow.rotation.set(-Math.PI / 2, 0, -th, 'XYZ');
    L.ems[0].position.set(c * half, BEAM_Y, s * half);
    L.ems[1].position.set(-c * half, BEAM_Y, -s * half);
    if (!moving) {                                      // baru muncul: berkedip di tepi arena
      const blink = (Math.sin(t * 22) > 0) ? 0.6 : 0.15;
      L.core.material.opacity = blink * 0.7; L.glow.material.opacity = blink * 0.5; L.floorGlow.material.opacity = blink * 0.25;
      L.core.scale.x = L.core.scale.z = BEAM_R * 0.6;
    } else {                                            // jalan: terang & berdenyut
      const pulse = 0.9 + 0.1 * Math.sin(t * 30 + k);
      L.core.material.opacity = 1; L.glow.material.opacity = 0.34 * pulse + 0.06; L.floorGlow.material.opacity = 0.22;
      L.core.scale.x = L.core.scale.z = BEAM_R; L.glow.scale.x = L.glow.scale.z = 0.19 + 0.03 * pulse;
    }
    h.visible = true;
  }

  function reset() {
    elapsed = 0; hitFlag = false; activeCount = 0;
    lasers.forEach(L => { L.holder.visible = false; });
  }

  // Dipanggil tiap frame. Mengembalikan true jika pemain terkena laser.
  function update(delta, playerPos, elapsedOverride) {
    elapsed = (typeof elapsedOverride === 'number') ? elapsedOverride : elapsed + delta;
    const t = Math.max(0, elapsed);
    let hit = false; activeCount = 0;
    lasers.forEach(L => { L.holder.visible = false; });

    // Cari laser yang sedang tampil: k terbesar yang sudah muncul, mundur sampai yang sudah selesai.
    let kMax = 0;
    while (spawnTime(kMax + 1) <= t) kMax++;
    if (t >= FIRST_DELAY) {
      for (let k = kMax; k >= 0 && k > kMax - POOL; k--) {
        const age = t - spawnTime(k);
        const sp = speedOf(k);
        const moveTime = age - WARN;
        if (moveTime > (TRAVEL * 2) / sp) continue;       // sudah lewat arena
        const L = lasers[k % POOL];
        if (moveTime < 0) { placeLaser(L, k, t, -TRAVEL, false); continue; }
        const pos = -TRAVEL + sp * moveTime;
        placeLaser(L, k, t, pos, true);
        activeCount++;
        if (!hit && playerPos) {
          const a = angleOf(k), na = Math.cos(a), nb = Math.sin(a);
          const along = playerPos.x * na + playerPos.z * nb;        // posisi pemain searah jalan laser
          const across = -playerPos.x * nb + playerPos.z * na;      // posisi pemain sepanjang garis laser
          const half = Math.sqrt(Math.max(0, RAIL_R * RAIL_R - pos * pos));
          const onFloor = Math.hypot(playerPos.x, playerPos.z) < RAIL_R;
          if (onFloor && Math.abs(across) < half && Math.abs(along - pos) < PLAYER_R + BEAM_R &&
              playerPos.y < BEAM_HIT_TOP && playerPos.y > FLOOR_TOP - 1.5) hit = true;
        }
      }
    }

    // Animasi dekor: slime berdenyut, layar berkedip halus
    slimeMat.emissiveIntensity = 0.8 + 0.2 * Math.sin(t * 2.2);
    screens.forEach((s, i) => { s.material.emissiveIntensity = 0.8 + 0.15 * Math.sin(t * 3 + i * 1.7); });

    if (hit && !hitFlag) { hitFlag = true; if (typeof opts.onHit === 'function') { try { opts.onHit(); } catch (e) {} } }
    return hit;
  }

  // Latar & kabut khas map ini (panggil saat map aktif).
  function applyEnvironment(sc) {
    const s = sc || scene;
    s.background = new THREE.Color(0x2b2057);
    s.fog = new THREE.Fog(0x2b2057, 45, 140);
  }

  const SPAWN_POINTS = [[0, 0], [-1.5, 0], [1.5, 0], [-3, 0], [3, 0], [-1.5, 1.5], [1.5, 1.5], [0, 1.5]];

  reset();
  return {
    group, platforms, hazards: [], guards: [], laserBeam: null,
    FIN_Y: SLIME_Y - 6, WIN: { x: 9999, y: -7, z: 9999 }, MAZE_H: 0, MAZE_Z: 0, // WIN dibuat jauh: map ini bertahan terakhir, bukan finis
    spawn: new THREE.Vector3(0, FLOOR_TOP, 0),
    spawnPoints: SPAWN_POINTS,
    fallLimit: SLIME_Y - 0.6,         // y di bawah ini = jatuh ke slime = tereliminasi
    floorY: FLOOR_TOP, arenaRadius: ARENA_R,
    reset, update, applyEnvironment,
    getLaserCount: () => activeCount,
    getElapsed: () => elapsed
  };
}
