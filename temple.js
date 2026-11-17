// temple.js — Map PARKOUR "LOST TEMPLE" (solo + multiplayer race to finish)
// Format sama dengan map lava/snow/mountain: platforms[], hazards[] (update/test), FIN_Y, WIN, tp.
// Semua animasi memakai waktu t dari main.js (deterministik), jadi sinkron antar pemain di room.

export function buildTempleWorld(THREE, scene, opts = {}) {
  const group = new THREE.Group();
  group.name = 'TEMPLE_WORLD';
  scene.add(group);
  // Lampu milik map ini: lampu scene utama ikut tersembunyi di dalam grup map Lava, makanya map sebelumnya gelap.
  group.add(new THREE.AmbientLight(0xffffff, 0.9));
  group.add(new THREE.HemisphereLight(0xdff3ff, 0xf0c090, 1.1));
  { const sun = new THREE.DirectionalLight(0xfff3dc, 1.6); sun.position.set(40, 80, 30); group.add(sun); }

  const platforms = [];
  const hazards = [];

  const M = (c, e = 0.32) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.8, flatShading: true });
  const mSand = M(0xe8b088), mLight = M(0xf7d2ab), mDark = M(0xc98558), mRed = M(0xe8532b);
  const mGrey = M(0xeaf1f8, 0.45), mGreen = M(0x4fd03c, 0.4), mWood = M(0xc98545), mHole = M(0x3a2418, 0.15);
  const mYellow = M(0xffd23a, 0.55), mWhite = M(0xffffff, 0.5);
  const checkMat = new THREE.MeshStandardMaterial({ color: 0x35d07f, emissive: 0x0f5a33, emissiveIntensity: 0.5, roughness: 0.6 });

  const Y0 = 0.25; // tinggi permukaan start (sama seperti map lain)

  function add(geo, mat, x, y, z, parent = group) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // Platform padat (format main.js): top = tinggi permukaan
  function plat(x, top, z, w, d, o = {}) {
    const thick = o.thick ?? 3, type = o.type || 'static';
    const mesh = add(new THREE.BoxGeometry(w, thick, d), o.mat || mSand, x, top - thick / 2, z);
    if (o.cap !== false) add(new THREE.BoxGeometry(w + 0.1, 0.3, d + 0.1), o.capMat || mLight, 0, thick / 2 - 0.15, 0, mesh);
    if (o.cap !== false && type === 'static' && thick >= 2 && w >= 4 && d >= 3) { // lis tepi merah-oranye
      const ry = thick / 2 + 0.03, rt = 0.3;
      add(new THREE.BoxGeometry(w + 0.1, 0.12, rt), mRed, 0, ry, d / 2 - rt / 2 + 0.05, mesh);
      add(new THREE.BoxGeometry(w + 0.1, 0.12, rt), mRed, 0, ry, -d / 2 + rt / 2 - 0.05, mesh);
      add(new THREE.BoxGeometry(rt, 0.12, d - rt * 2), mRed, w / 2 - rt / 2 + 0.05, ry, 0, mesh);
      add(new THREE.BoxGeometry(rt, 0.12, d - rt * 2), mRed, -w / 2 + rt / 2 - 0.05, ry, 0, mesh);
    }
    const p = {
      mesh, width: w, depth: d, type, hh: thick / 2,
      startX: x, startY: mesh.position.y, startZ: z,
      range: o.range || 0, speed: o.speed || 0, phase: o.phase || 0,
      isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: 0,
    };
    platforms.push(p);
    return p;
  }

  // Pad checkpoint (dibuat SEBELUM platform di bawahnya supaya terdeteksi duluan)
  function checkpoint(x, top, z) {
    const p = plat(x, top + 0.02, z, 4, 4, { thick: 0.5, mat: checkMat, cap: false });
    p.checkpoint = true; p.checkpointActivated = false; p.checkpointReadyMaterial = checkMat;
    return p;
  }

  // Tanjakan halus. Penyebab "nyangkut": badan pemain punya radius, jadi saat berdiri di satu anak tangga
  // ia juga menyentuh 2-3 anak tangga di depannya. Dengan rise 0.09 / run 0.4 anak tangga ke-2 sudah
  // 0.18 lebih tinggi (> ambang tembok 0.1) sehingga dianggap tembok. Sekarang rise 0.04 / run 0.45:
  // sampai radius ~1.3 pun, anak tangga terjauh yang tersentuh cuma 0.08 lebih tinggi (< 0.1).
  const RISE = 0.04, RUN = 0.45;
  function ramp(x, zStart, y0, width, n, run = RUN, rise = RISE) {
    for (let i = 0; i < n; i++) {
      const top = y0 + rise * (i + 1);
      const mesh = new THREE.Object3D(); // hanya untuk tabrakan
      mesh.position.set(x, top - 1.5, zStart - run * (i + 0.5));
      platforms.push({
        mesh, width, depth: run + 0.02, type: 'static', hh: 1.5,
        startX: x, startY: mesh.position.y, startZ: mesh.position.z,
        range: 0, speed: 0, phase: 0, isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: 0,
      });
    }
    const totalRun = run * n, total = rise * n, th = Math.atan2(total, totalRun);
    const len = Math.hypot(totalRun, total);
    const slope = add(new THREE.BoxGeometry(width, 0.5, len), mSand, x, y0 + total / 2 + 0.045 - 0.3, zStart - totalRun / 2);
    slope.rotation.x = th;
    for (let i = 0; i < n; i += 10) { // garis anak tangga sebagai hiasan
      add(new THREE.BoxGeometry(width, 0.06, 0.12), mLight, x, y0 + rise * (i + 1) + 0.02, zStart - run * (i + 0.5));
    }
    return { end: zStart - totalRun, top: y0 + total };
  }

  function decor(x, y0, z, w, h, d, mat = mSand) { return add(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z); }

  function palm(x, y, z, s = 1, lean = 0.15) {
    const g = new THREE.Group(); g.position.set(x, y, z); group.add(g);
    const trunk = add(new THREE.CylinderGeometry(0.18 * s, 0.3 * s, 3.4 * s, 6), mWood, 0, 1.7 * s, 0, g);
    trunk.rotation.z = lean;
    for (let i = 0; i < 7; i++) {
      const leafGeo = new THREE.BoxGeometry(2.4 * s, 0.1, 0.7 * s); leafGeo.translate(1.2 * s, 0, 0);
      const leaf = add(leafGeo, mGreen, -lean * 1.6 * s, 3.4 * s, 0, g);
      leaf.rotation.y = (i / 7) * Math.PI * 2; leaf.rotation.z = -0.35;
    }
  }

  // ===================== LAYOUT =====================
  // 1) START
  plat(0, Y0, 0, 18, 14);
  decor(-10.5, Y0 - 5, 0, 3, 5, 14, mDark); decor(10.5, Y0 - 5, 0, 3, 5, 14, mDark);
  palm(-7.5, Y0, 3, 1.1, 0.2); palm(7.5, Y0, 3.5, 1, -0.2);

  // 2) BATU LONCATAN
  [-3, 3, -2, 3.5, 0].forEach((x, i) => plat(x, Y0, -11 - i * 6.5, 5, 4));

  // 3) KORIDOR PAKU
  const corrD = 26, corrZ = -41.5 - corrD / 2;
  checkpoint(0, Y0, corrZ - corrD / 2 + 3);
  plat(0, Y0, corrZ, 12, corrD);
  decor(-7.5, Y0 - 6, corrZ, 3, 6, corrD, mDark); decor(7.5, Y0 - 6, corrZ, 3, 6, corrD, mDark);
  const spikes = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 3; c++) {
      const x = (c - 1) * 3.6, z = corrZ - corrD / 2 + 7 + r * 2.9;
      add(new THREE.CylinderGeometry(0.62, 0.72, 0.14, 8), mRed, x, Y0 + 0.07, z);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 8), mHole, x, Y0 + 0.07, z);
      const cone = add(new THREE.ConeGeometry(0.34, 1.4, 6), mGrey, x, Y0 - 0.7, z);
      spikes.push({ x, z, cone, phase: ((r * 3 + c * 5) % 7) * 0.45, period: 3.2, h: 0 });
    }
  }
  const smooth = (x) => x * x * (3 - 2 * x);
  hazards.push({
    update(t) {
      for (const s of spikes) {
        const tt = ((t + s.phase) % s.period) / s.period;
        let h;
        if (tt < 0.1) h = smooth(tt / 0.1);
        else if (tt < 0.4) h = 1;
        else if (tt < 0.5) h = 1 - smooth((tt - 0.4) / 0.1);
        else if (tt > 0.88) h = 0.18; // peringatan: ujung paku mengintip
        else h = 0;
        s.h = h; s.cone.position.y = Y0 - 0.7 + h * 1.25;
      }
    },
    test(pp) {
      for (const s of spikes) {
        if (s.h < 0.55) continue;
        const dx = pp.x - s.x, dz = pp.z - s.z;
        if (dx * dx + dz * dz < 0.9 * 0.9 && pp.y < Y0 + 1.3 * s.h) {
          const l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l };
        }
      }
      return null;
    },
  });

  // 4) TANJAKAN 1
  const r1 = ramp(0, corrZ - corrD / 2, Y0, 12, 106, RUN); // tinggi total ~4.24 (sama seperti sebelumnya)
  const upTop = r1.top;

  // 5) PLATFORM ATAS
  const upZ = r1.end - 6;
  checkpoint(0, upTop, upZ);
  plat(0, upTop, upZ, 14, 12);
  palm(-6, upTop, upZ + 2, 1, 0.2);

  // 6) JALUR BALOK PEMUKUL BERPUTAR
  const barD = 20, barZ = upZ - 6 - barD / 2;
  plat(0, upTop, barZ, 12, barD);
  decor(-7.5, upTop - 6, barZ, 3, 6, barD, mDark); decor(7.5, upTop - 6, barZ, 3, 6, barD, mDark);
  [[barZ + 4, 1.4], [barZ - 4, -1.7]].forEach(([z, sp]) => {
    const barY = upTop + 0.9, len = 11;
    const g = new THREE.Group(); g.position.set(0, barY, z); group.add(g);
    add(new THREE.CylinderGeometry(0.6, 0.8, 1.0, 10), mDark, 0, -0.45, 0, g);
    for (let k = 0; k < 11; k++) { const seg = add(new THREE.CylinderGeometry(0.3, 0.3, len / 11, 10), k % 2 ? mYellow : mRed, -len / 2 + (k + 0.5) * len / 11, 0, 0, g); seg.rotation.z = Math.PI / 2; }
    for (const sd of [-1, 1]) add(new THREE.SphereGeometry(0.5, 10, 10), mWhite, sd * len / 2, 0, 0, g);
    let a = 0;
    hazards.push({
      update(t) { a = t * sp; g.rotation.y = -a; },
      test(pp) {
        const dx = pp.x, dz = pp.z - z, c = Math.cos(a), sn = Math.sin(a);
        const along = dx * c + dz * sn, perp = -dx * sn + dz * c;
        if (Math.abs(along) < len / 2 + 0.2 && Math.abs(perp) < 0.55 && pp.y < barY + 0.25 && pp.y + 1.9 > barY - 0.25) {
          const sg = perp >= 0 ? 1 : -1; return { x: -sn * sg, z: c * sg };
        }
        return null;
      },
    });
  });

  // 7) LUBANG PAKU + PLATFORM BERGERAK
  const pitStart = barZ - barD / 2;
  [[-4, 5, 1.1, 0], [-11, 5.5, 1.4, 2], [-18, 5, 1.0, 4]].forEach(([dz, range, speed, phase]) => {
    const p = plat(0, upTop, pitStart + dz - 2, 5, 4, { thick: 1.2, type: 'moving_x', range, speed, phase, mat: mDark, capMat: mRed });
    p.mesh.position.x = Math.sin(phase) * range; // posisi awal; main.js yang menganimasikan
  });
  for (let i = 0; i < 40; i++) { // paku dasar lubang (visual)
    add(new THREE.ConeGeometry(0.4, 1.6, 6), mGrey, -10 + (i % 8) * 2.9 + (Math.floor(i / 8) % 2) * 1.3, -4.5, pitStart - 3 - Math.floor(i / 8) * 4.5);
  }
  decor(0, -6, pitStart - 12, 26, 1, 26, mDark);

  // 8) PLATFORM ISTIRAHAT
  const restD = 12, restZ = pitStart - 22 - restD / 2 - 3;
  checkpoint(0, upTop, restZ);
  plat(0, upTop, restZ, 16, restD);
  palm(-7, upTop, restZ + 2, 1.2, -0.2); palm(7, upTop, restZ - 2, 1, 0.2);

  // 8b) PERLUASAN: titian sempit -> platform bergerak -> koridor 3 pemukul -> istirahat kedua
  let zc = restZ - restD / 2; // tepi depan platform istirahat pertama
  [[0, 0], [-2.5, 1], [2.5, 2], [0, 3]].forEach(([bx]) => { // titian sempit (lompat antar balok)
    const c = zc - 2.8 - 4;
    plat(bx, upTop, c, 2.4, 8, { thick: 1.5, mat: mDark, capMat: mRed });
    zc = c - 4;
  });
  const mvStart = zc;
  [[1.2, 0], [1.6, 2], [1.0, 4], [1.8, 1]].forEach(([speed, phase], i) => {
    const p = plat(0, upTop, mvStart - 5 - i * 6.5, 5, 4, { thick: 1.2, type: 'moving_x', range: 6, speed, phase, mat: mDark, capMat: mRed });
    p.mesh.position.x = Math.sin(phase) * 6; // posisi awal; main.js yang menganimasikan
  });
  const mvEnd = mvStart - 5 - 3 * 6.5 - 2;
  for (let i = 0; i < 48; i++) { // paku dasar lubang (visual)
    add(new THREE.ConeGeometry(0.4, 1.6, 6), mGrey, -10 + (i % 8) * 2.9 + (Math.floor(i / 8) % 2) * 1.3, -4.5, mvStart - 2 - Math.floor(i / 8) * 4.6);
  }
  decor(0, -6, (mvStart + mvEnd) / 2, 26, 1, Math.abs(mvStart - mvEnd) + 6, mDark);

  // koridor 3 pemukul berputar (lebih rapat dan lebih cepat)
  const bar2D = 30, bar2Front = mvEnd - 3, bar2Z = bar2Front - bar2D / 2;
  checkpoint(0, upTop, bar2Front - 3);
  plat(0, upTop, bar2Z, 12, bar2D);
  decor(-7.5, upTop - 6, bar2Z, 3, 6, bar2D, mDark); decor(7.5, upTop - 6, bar2Z, 3, 6, bar2D, mDark);
  [[bar2Z + 10, 1.5], [bar2Z, -1.9], [bar2Z - 10, 2.3]].forEach(([z, sp]) => {
    const barY = upTop + 0.9, len = 11;
    const g = new THREE.Group(); g.position.set(0, barY, z); group.add(g);
    add(new THREE.CylinderGeometry(0.6, 0.8, 1.0, 10), mDark, 0, -0.45, 0, g);
    for (let k = 0; k < 11; k++) { const seg = add(new THREE.CylinderGeometry(0.3, 0.3, len / 11, 10), k % 2 ? mYellow : mRed, -len / 2 + (k + 0.5) * len / 11, 0, 0, g); seg.rotation.z = Math.PI / 2; }
    for (const sd of [-1, 1]) add(new THREE.SphereGeometry(0.5, 10, 10), mWhite, sd * len / 2, 0, 0, g);
    let a = 0;
    hazards.push({
      update(t) { a = t * sp; g.rotation.y = -a; },
      test(pp) {
        const dx = pp.x, dz = pp.z - z, c = Math.cos(a), sn = Math.sin(a);
        const along = dx * c + dz * sn, perp = -dx * sn + dz * c;
        if (Math.abs(along) < len / 2 + 0.2 && Math.abs(perp) < 0.55 && pp.y < barY + 0.25 && pp.y + 1.9 > barY - 0.25) {
          const sg = perp >= 0 ? 1 : -1; return { x: -sn * sg, z: c * sg };
        }
        return null;
      },
    });
  });

  // platform istirahat kedua (langsung di ujung koridor pemukul)
  const rest2D = 14, rest2Z = bar2Front - bar2D - rest2D / 2;
  checkpoint(0, upTop, rest2Z);
  plat(0, upTop, rest2Z, 16, rest2D);
  palm(-7, upTop, rest2Z + 2, 1.2, -0.2); palm(7, upTop, rest2Z - 2, 1, 0.2);
  add(new THREE.BoxGeometry(0.28, 0.3, rest2D), mRed, -8.05, upTop + 0.18, rest2Z);
  add(new THREE.BoxGeometry(0.28, 0.3, rest2D), mRed, 8.05, upTop + 0.18, rest2Z);

  // 9) TANJAKAN PIRAMIDA (240 langkah) + BATANG KAYU MENGGELINDING
  const r2z0 = rest2Z - rest2D / 2;
  const r2 = ramp(0, r2z0, upTop, 12, 240, RUN); // tinggi total ~9.6 (sama seperti sebelumnya)
  const FIN_Y = r2.top;
  const rampLen = r2z0 - r2.end;
  decor(-8.5, -4, (r2z0 + r2.end) / 2, 5, FIN_Y + 4, rampLen + 2, mDark);
  decor(8.5, -4, (r2z0 + r2.end) / 2, 5, FIN_Y + 4, rampLen + 2, mDark);

  const lanes = [-3.5, 0, 3.5, -1.8, 2.2];
  const speedZ = 8, travel = rampLen / speedZ, cycle = travel + 2.0;
  for (let i = 0; i < 4; i++) {
    const off = i * (cycle / 4);
    const lg = new THREE.Group(); group.add(lg);
    const cyl = add(new THREE.CylinderGeometry(0.9, 0.9, 5, 14), mWood, 0, 0, 0, lg); cyl.rotation.z = Math.PI / 2;
    add(new THREE.BoxGeometry(5.1, 0.25, 0.25), mDark, 0, 0, 0.9, lg);
    let active = false, lx = 0, lz = 0, ly = 0;
    hazards.push({
      update(t) {
        const u = Math.max(0, t) + off, idx = Math.floor(u / cycle), local = u - idx * cycle;
        if (local <= travel) {
          const p = local / travel;
          active = true; lx = lanes[(idx * 4 + i) % lanes.length];
          lz = r2.end + p * rampLen; ly = FIN_Y - p * (FIN_Y - upTop) + 1.0;
          lg.visible = true; lg.position.set(lx, ly, lz); lg.rotation.x = (p * rampLen) / 0.9;
        } else { active = false; lg.visible = false; }
      },
      test(pp) {
        if (!active) return null;
        if (Math.abs(pp.x - lx) < 2.5 + 0.35 && Math.abs(pp.z - lz) < 0.9 + 0.35 && pp.y < ly + 0.9 && pp.y + 1.9 > ly - 0.9) return { x: 0, z: 1 };
        return null;
      },
    });
    lg.visible = false;
  }

  // 10) FINISH
  const finZ = r2.end - 7;
  plat(0, FIN_Y, finZ, 16, 14);
  palm(-6.5, FIN_Y, finZ - 2, 1.2, 0.2); palm(6.5, FIN_Y, finZ - 2, 1.2, -0.2);
  add(new THREE.BoxGeometry(1.2, 7, 1.2), mRed, -5.5, FIN_Y + 3.5, finZ + 2);
  add(new THREE.BoxGeometry(1.2, 7, 1.2), mRed, 5.5, FIN_Y + 3.5, finZ + 2);
  add(new THREE.BoxGeometry(12.5, 1.4, 1.4), mRed, 0, FIN_Y + 7.3, finZ + 2);
  add(new THREE.BoxGeometry(8, 1.0, 0.4), mLight, 0, FIN_Y + 7.3, finZ + 2.8);
  add(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), M(0xdddddd), 0, FIN_Y + 2.5, finZ - 4);
  add(new THREE.BoxGeometry(2.4, 1.4, 0.1), M(0xff3b30), 1.2, FIN_Y + 4.4, finZ - 4);
  for (let i = 0; i < 10; i++) { // piramida latar belakang
    const s = 44 - i * 4;
    decor(0, FIN_Y - 10 + i * 2.4, finZ - 38, s, 2.4, s, i % 2 ? mSand : mLight);
  }

  // ===================== DEKOR =====================
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 72; i++) {
    const side = i % 2 ? 1 : -1, z = 10 - i * 7.5;
    const w = 6 + rnd() * 8, h = 6 + rnd() * 16, d = 6 + rnd() * 6;
    decor(side * (24 + rnd() * 14), -16, z, w, h + 8, d, rnd() > 0.5 ? mSand : mLight);
  }
  add(new THREE.BoxGeometry(500, 2, 1000), mSand, 0, -17, -250);


  // ===================== LOST TEMPLE VISUAL UPGRADE =====================
  // Detail tambahan ini bersifat dekoratif agar siluet map lebih dekat
  // dengan arena "Lost Temple": batu pasir, lis merah-oranye, jembatan,
  // reruntuhan, pilar, dan gerbang kuil. Collision gameplay tetap memakai
  // platforms[] dan hazards[] yang sudah didefinisikan di atas.

  const trimBox = (x, y, z, w, h, d, mat = mRed) =>
    add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

  function templePillar(x, baseY, z, height = 5, radius = 0.65) {
    add(new THREE.CylinderGeometry(radius * 0.82, radius, height, 6), mDark,
      x, baseY + height / 2, z);
    add(new THREE.CylinderGeometry(radius * 1.22, radius * 1.22, 0.38, 6),
      mLight, x, baseY + 0.19, z);
    add(new THREE.CylinderGeometry(radius * 1.18, radius * 1.18, 0.34, 6),
      mDark, x, baseY + height - 0.17, z);
    add(new THREE.BoxGeometry(radius * 2.8, 0.42, radius * 2.8),
      mLight, x, baseY + height + 0.18, z);
  }

  function ruinBlock(x, y, z, w, h, d, mat = mSand) {
    const b = add(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z);
    b.rotation.y = (rnd() - 0.5) * 0.08;
    return b;
  }

  // Lis merah-oranye di tepi area utama, seperti jalur tepi pada referensi.
  trimBox(0, Y0 + 0.2, 7.05, 18.2, 0.34, 0.34, mRed);
  trimBox(-9.05, Y0 + 0.2, 0, 0.34, 0.34, 14, mRed);
  trimBox(9.05, Y0 + 0.2, 0, 0.34, 0.34, 14, mRed);

  // Batu pijakan kecil dan pecahan reruntuhan di sekitar jalur awal.
  [
    [-7.2, Y0, -7.5, 2.2, 0.7, 2.0],
    [7.1, Y0, -8.8, 2.0, 0.9, 2.2],
    [-6.2, Y0, -19.0, 2.4, 0.8, 2.0],
    [6.4, Y0, -24.0, 2.1, 0.7, 2.0],
  ].forEach(([x, y, z, w, h, d]) => ruinBlock(x, y, z, w, h, d, mLight));

  // Dinding benteng rendah dan lis merah di sisi jalur koridor paku.
  trimBox(-6.25, Y0 + 1.35, corrZ, 0.55, 2.7, corrD + 0.4, mDark);
  trimBox(6.25, Y0 + 1.35, corrZ, 0.55, 2.7, corrD + 0.4, mDark);
  trimBox(-6.25, Y0 + 2.75, corrZ, 0.72, 0.22, corrD + 0.55, mRed);
  trimBox(6.25, Y0 + 2.75, corrZ, 0.72, 0.22, corrD + 0.55, mRed);

  // Jembatan batu-kayu di area transisi menuju teras atas.
  const bridgeZ = corrZ - corrD / 2 - 2.2;
  for (let i = 0; i < 7; i++) {
    const z = bridgeZ - i * 1.05;
    trimBox(-3.8, upTop - 0.55, z, 3.0, 0.22, 0.86, mWood);
    trimBox(3.8, upTop - 0.55, z, 3.0, 0.22, 0.86, mWood);
  }
  [-5.4, 5.4].forEach((x) => {
    templePillar(x, upTop - 3.2, bridgeZ - 2.5, 3.2, 0.42);
    templePillar(x, upTop - 3.2, bridgeZ - 8.0, 3.2, 0.42);
  });

  // Pilar-pilar dan reruntuhan pada teras atas.
  [
    [-8.0, upTop, upZ + 3.0], [8.0, upTop, upZ + 3.0],
    [-8.0, upTop, upZ - 4.0], [8.0, upTop, upZ - 4.0],
  ].forEach(([x, y, z]) => templePillar(x, y - 0.1, z, 4.4, 0.55));

  ruinBlock(-5.1, upTop, upZ - 1.2, 2.4, 1.4, 2.0, mDark);
  ruinBlock(5.2, upTop, upZ - 2.0, 2.8, 1.1, 2.1, mLight);
  ruinBlock(-3.7, upTop, barZ + 7.8, 1.8, 0.8, 1.6, mLight);
  ruinBlock(4.0, upTop, barZ - 7.8, 2.0, 0.9, 1.8, mDark);

  // Lis merah pada tepi platform istirahat dan beberapa batu pijakan.
  trimBox(-8.05, upTop + 0.18, restZ, 0.28, 0.3, restD, mRed);
  trimBox(8.05, upTop + 0.18, restZ, 0.28, 0.3, restD, mRed);
  [
    [-5.0, upTop, restZ - 7.0, 2.4, 0.8, 2.0],
    [5.0, upTop, restZ - 7.5, 2.4, 0.8, 2.0],
  ].forEach(([x, y, z, w, h, d]) => ruinBlock(x, y, z, w, h, d, mLight));

  // Deretan pilar di sisi tanjakan piramida untuk memberi kesan kompleks kuil.
  for (let i = 0; i < 20; i++) {
    const z = r2z0 - 3.5 - i * ((rampLen - 7) / 19);
    const y = upTop + ((r2z0 - z) / rampLen) * (FIN_Y - upTop);
    templePillar(-7.7, y - 2.8, z, 2.8, 0.42);
    templePillar(7.7, y - 2.8, z, 2.8, 0.42);
  }

  // Gerbang kuil besar di area finish.
  const gateZ = finZ - 1.0;
  templePillar(-6.0, FIN_Y, gateZ, 7.0, 0.8);
  templePillar(6.0, FIN_Y, gateZ, 7.0, 0.8);
  trimBox(0, FIN_Y + 7.15, gateZ, 13.5, 1.0, 1.5, mDark);
  trimBox(0, FIN_Y + 7.75, gateZ, 12.8, 0.32, 1.8, mRed);
  trimBox(0, FIN_Y + 6.35, gateZ + 0.82, 8.8, 0.24, 0.18, mLight);

  // Batu-batu besar dan reruntuhan latar agar arena terasa seperti lembah kuil.
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1;
    const z = 8 - i * 9.5;
    const x = side * (18 + rnd() * 13);
    const w = 5 + rnd() * 8, h = 5 + rnd() * 13, d = 5 + rnd() * 8;
    ruinBlock(x, -12, z, w, h, d, rnd() > 0.5 ? mSand : mDark);
  }

  // Obor dekoratif di dekat gerbang (tanpa efek gameplay).
  for (const x of [-4.8, 4.8]) {
    add(new THREE.CylinderGeometry(0.09, 0.13, 2.2, 6), mWood,
      x, FIN_Y + 1.1, gateZ + 1.2);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffa52b, emissive: 0xff5a12, emissiveIntensity: 0.8,
      roughness: 0.5, flatShading: true
    });
    add(new THREE.ConeGeometry(0.28, 0.75, 6), flameMat,
      x, FIN_Y + 2.55, gateZ + 1.2);
  }

  // Awan putih ala kartun
  const mCloud = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 24; i++) {
    const cx = (rnd() - 0.5) * 260, cy = 30 + rnd() * 40, cz = 40 - rnd() * 600;
    const cg = new THREE.Group(); cg.position.set(cx, cy, cz); group.add(cg);
    for (let k = 0; k < 4; k++) add(new THREE.SphereGeometry(5 + rnd() * 5, 10, 8), mCloud, (k - 1.5) * 7, rnd() * 3, rnd() * 3, cg);
  }

  // ===================== WORLD =====================
  const WIN = { x: 0, y: FIN_Y, z: finZ };
  const world = {
    group, platforms, hazards, guards: [], FIN_Y, WIN, MAZE_H: 0, MAZE_Z: 0,
    tp: {
      start: [0, Y0, 0],
      hub: [0, upTop, upZ],
      top: [0, upTop, rest2Z],
      maze: [0, upTop, barZ],
      finish: [WIN.x, FIN_Y, WIN.z],
    },
    applyEnvironment(sc) {
      sc.background = new THREE.Color(0x62d8f4);
      sc.fog = new THREE.Fog(0xbfeafa, 160, 520);
    },
  };
  return { world, group };
}

export default buildTempleWorld;
