// honey.js — Map "Honey Drop" (gaya Stumble Guys)
// Tile sarang lebah: diinjak -> oranye -> jatuh/hilang. Bertahan sampai lapisan paling bawah.
// Pakai: const honey = buildHoneyWorld(THREE, scene, api);
//        di loop game: honey.update(dt, player.position);  (player = mesh/objek posisi pemain)

export function buildHoneyWorld(THREE, scene, api = {}) {
  const SIZE = 1.6;          // jari-jari tile
  const GAP = 0.93;          // celah antar tile
  const LAYERS = [ { y: 0, R: 8 }, { y: -14, R: 8 }, { y: -28, R: 7 } ];
  const WARN_TIME = 0.55;    // detik oranye sebelum jatuh
  const FALL_TIME = 0.6;     // durasi animasi jatuh/mengecil
  const FIN_Y = -45;         // di bawah ini = jatuh (samakan dengan FIN_Y game kamu)

  // ---------- langit & cahaya ----------
  scene.background = new THREE.Color(0x58b8f0);
  scene.fog = new THREE.Fog(0x9fd8ff, 60, 160);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffd27a, 0.9);
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(30, 60, 20);
  scene.add(hemi, sun);

  // ---------- material & geometri (dipakai bersama, ringan untuk HP) ----------
  const geo = new THREE.CylinderGeometry(SIZE * GAP, SIZE * GAP, 0.7, 6);
  const matA = new THREE.MeshLambertMaterial({ color: 0xffc53a });
  const matB = new THREE.MeshLambertMaterial({ color: 0xffb020 });
  const matWarn = new THREE.MeshLambertMaterial({ color: 0xff6a1a });

  const tiles = [];
  const group = new THREE.Group();
  scene.add(group);

  // ---------- bangun grid hexagon ----------
  LAYERS.forEach((L, li) => {
    for (let q = -L.R; q <= L.R; q++) {
      for (let r = -L.R; r <= L.R; r++) {
        if (Math.abs(q + r) > L.R) continue;
        // lubang acak kecil supaya mirip gambar
        if (li > 0 && Math.random() < 0.06) continue;
        const x = SIZE * Math.sqrt(3) * (q + r / 2);
        const z = SIZE * 1.5 * r;
        const base = (q + r) % 2 === 0 ? matA : matB;
        const m = new THREE.Mesh(geo, base);
        m.position.set(x, L.y + (Math.random() < 0.15 ? 0.25 : 0), z);
        group.add(m);
        tiles.push({ mesh: m, base, state: 0, t: 0, x, z, top: m.position.y + 0.35, y0: m.position.y,
          width: SIZE * 1.72, depth: SIZE * 1.72, hh: 0.35, r: SIZE * 0.9,
          type: 'honey', isFallen: false });
      }
    }
  });

  // ---------- pohon/ranting penyangga (dekorasi) ----------
  const branchMat = new THREE.MeshLambertMaterial({ color: 0x8a5a36 });
  const bGeo = new THREE.CylinderGeometry(0.35, 0.5, 40, 6);
  [[-11, -9], [11, -8], [-10, 10], [10, 11]].forEach(([x, z]) => {
    const b = new THREE.Mesh(bGeo, branchMat);
    b.position.set(x, -12, z);
    group.add(b);
  });

  // ---------- awan dekorasi ----------
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const cGeo = new THREE.SphereGeometry(1, 8, 6);
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Mesh(cGeo, cloudMat);
      s.scale.set(4 + k, 2, 3);
      s.position.set(k * 3, 0, 0);
      c.add(s);
    }
    c.position.set((Math.random() - 0.5) * 140, -35 + Math.random() * 50, -40 - Math.random() * 60);
    group.add(c);
    clouds.push(c);
  }

  // ---------- titik spawn & finish ----------
  const spawn = new THREE.Vector3(0, 2, 0);
  const fin = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.8, 24),
    new THREE.MeshLambertMaterial({ color: 0x3a8dff })
  );
  fin.position.set(0, -38, 0);
  group.add(fin);

  // daftarkan collider jika game kamu menyediakannya
  const reg = api.addCollider || api.addPlatform || null;
  if (reg) { tiles.forEach(t => reg(t.mesh)); reg(fin); }

  // ---------- update (panggil tiap frame) ----------
  function update(dt, p) {
    clouds.forEach(c => { c.position.x += dt * 0.8; if (c.position.x > 90) c.position.x = -90; });

    for (const t of tiles) {
      if (t.state === 0 && p) {
        // pemain berdiri di atas tile ini?
        const dx = p.x - t.x, dz = p.z - t.z;
        if (dx * dx + dz * dz < (SIZE * 0.85) ** 2 && p.y >= t.top - 0.3 && p.y <= t.top + 2.2) {
          t.state = 1; t.t = 0; t.mesh.material = matWarn;
        }
      } else if (t.state === 1) {
        t.t += dt;
        t.mesh.position.y = t.y0 + Math.sin(t.t * 40) * 0.04; // bergetar
        if (t.t >= WARN_TIME) { t.state = 2; t.t = 0; }
      } else if (t.state === 2) {
        t.t += dt;
        const k = Math.min(t.t / FALL_TIME, 1);
        t.mesh.position.y = t.y0 - k * k * 6;
        t.mesh.scale.setScalar(1 - k);
        if (k >= 1) { t.state = 3; t.isFallen = true; t.mesh.visible = false; t.mesh.position.y = -999; }
      }
    }
  }

  function reset() {
    tiles.forEach(t => {
      t.state = 0; t.t = 0; t.isFallen = false; t.mesh.visible = true;
      t.mesh.material = t.base; t.mesh.scale.setScalar(1); t.mesh.position.y = t.y0;
    });
  }

  const platforms = tiles;
  const WIN = { x: 0, y: -38, z: 0 };
  return { update, reset, spawn, FIN_Y, WIN, tiles, platforms, group };
}
