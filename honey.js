// honey.js — Map "Honey Drop" (gaya Stumble Guys), khusus multiplayer.
// Tile madu yang diinjak hilang 1 detik kemudian. Yang jatuh duluan kalah.
//
// Dipakai main.js:
//   honeyWorld = buildHoneyWorld(THREE, scene, { onTileStep: (i) => ... });
//   honeyWorld.platforms  -> dipakai collision game (checkGroundCollision / checkWallCollision)
//   honeyWorld.update(dt, character.position)   tiap frame saat PLAYING
//   honeyWorld.syncRemote(players, myUid, serverNow, startAt)  dari snapshot room
//   honeyWorld.reset()    saat ronde baru

export function buildHoneyWorld(THREE, scene, api = {}) {
  const SIZE = 1.6;            // jari-jari tile (sudut ke pusat)
  const VISUAL = 0.93;         // skala visual tile (celah kecil antar tile)
  const THICK = 0.7;           // tebal tile
  const HH = THICK / 2;        // setengah tebal -> dipakai collision (p.hh)
  const RADIUS = 8;            // ukuran arena (jumlah cincin hex)
  const VANISH_DELAY = 1.0;    // detik dari diinjak sampai tile hilang
  const SINK_TIME = 0.35;      // animasi tenggelam setelah hilang (hanya visual)
  const FALL_Y = -8;           // lebih rendah dari ini = jatuh = kalah (dipakai main.js)

  const group = new THREE.Group();
  group.name = 'HONEY_DROP';
  scene.add(group);

  // ---------- cahaya & langit (di dalam group, jadi ikut tersembunyi di map lain) ----------
  group.add(new THREE.HemisphereLight(0xffffff, 0xffd27a, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(30, 60, 20);
  group.add(sun);

  // ---------- grid hexagon (pointy-top) ----------
  const W = Math.sqrt(3) * SIZE;                         // jarak antar pusat tile
  const hexXZ = (q, r) => [W * (q + r / 2), SIZE * 1.5 * r];
  const coords = [];
  for (let q = -RADIUS; q <= RADIUS; q++) {
    for (let r = -RADIUS; r <= RADIUS; r++) {
      if (Math.abs(q + r) > RADIUS) continue;
      coords.push([q, r]);
    }
  }
  const N = coords.length;
  const indexOf = new Map(coords.map(([q, r], i) => [q + ',' + r, i]));

  // Satu InstancedMesh = 1 draw call untuk semua tile (ringan di HP).
  const geo = new THREE.CylinderGeometry(SIZE * VISUAL, SIZE * VISUAL, THICK, 6);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const inst = new THREE.InstancedMesh(geo, mat, N);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.frustumCulled = false;
  group.add(inst);

  const C_A = new THREE.Color(0xffc53a), C_B = new THREE.Color(0xffb020), C_WARN = new THREE.Color(0xff5a14);
  const dummy = new THREE.Object3D();

  // Tile: y selalu SAMA untuk semua (rata) supaya karakter tidak nyangkut di undakan.
  // platforms = bentuk yang dipahami collision main.js (mesh.position, r, hh).
  const tiles = coords.map(([q, r], i) => {
    const [x, z] = hexXZ(q, r);
    const pos = new THREE.Vector3(x, 0, z);
    return {
      i, x, z, state: 0, t: 0,
      base: (q + r) % 2 === 0 ? C_A : C_B,
      // r = SIZE (lingkaran luar hex) supaya TIDAK ada retakan di antara tile yang bikin kaki jatuh/nyangkut.
      platform: { mesh: { position: pos, visible: true }, width: SIZE * 2, depth: SIZE * 2, r: SIZE, hh: HH, type: 'honey', isFallen: false, revealTimer: 0, dx: 0 },
    };
  });
  const platforms = tiles.map(t => t.platform);

  function drawTile(t, yOff, scale, shake) {
    dummy.position.set(t.x + shake, yOff, t.z);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    inst.setMatrixAt(t.i, dummy.matrix);
  }
  function paintAll() {
    tiles.forEach(t => { drawTile(t, 0, 1, 0); inst.setColorAt(t.i, t.base); });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }
  paintAll();

  // ---------- dekorasi: lapisan sarang di bawah (tidak bisa diinjak) ----------
  const decoMat = new THREE.MeshLambertMaterial({ color: 0xe8a020 });
  [-14, -28].forEach((y, k) => {
    const rad = 7 - k, list = [];
    for (let q = -rad; q <= rad; q++) for (let r = -rad; r <= rad; r++) if (Math.abs(q + r) <= rad) list.push(hexXZ(q, r));
    const d = new THREE.InstancedMesh(geo, decoMat, list.length);
    list.forEach(([x, z], i) => { dummy.position.set(x, y, z); dummy.scale.setScalar(1); dummy.updateMatrix(); d.setMatrixAt(i, dummy.matrix); });
    d.frustumCulled = false;
    group.add(d);
  });

  // ---------- ranting penyangga & awan (dekorasi) ----------
  const branchMat = new THREE.MeshLambertMaterial({ color: 0x8a5a36 });
  const bGeo = new THREE.CylinderGeometry(0.35, 0.5, 44, 6);
  [[-15, -10], [15, -9], [-14, 11], [15, 12]].forEach(([x, z]) => {
    const b = new THREE.Mesh(bGeo, branchMat);
    b.position.set(x, -14, z);
    group.add(b);
  });
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const cGeo = new THREE.SphereGeometry(1, 8, 6);
  const clouds = [];
  for (let k = 0; k < 8; k++) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) { const s = new THREE.Mesh(cGeo, cloudMat); s.scale.set(4 + j, 2, 3); s.position.set(j * 3, 0, 0); c.add(s); }
    c.position.set((Math.random() - 0.5) * 150, -30 + Math.random() * 45, -45 - Math.random() * 60);
    group.add(c); clouds.push(c);
  }

  // ---------- logika tile ----------
  function trigger(t, elapsed) {            // elapsed = detik yang sudah lewat sejak diinjak
    if (t.state !== 0) return;
    t.state = 1; t.t = Math.max(0, elapsed || 0);
    inst.setColorAt(t.i, C_WARN);
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }

  // Tile di bawah kaki: dihitung langsung dari koordinat (tanpa loop semua tile).
  function tileAt(x, z) {
    const fr = (2 / 3 * z) / SIZE;                                  // r pecahan
    const fq = (x / W) - fr / 2;                                    // q pecahan
    let q = Math.round(fq), r = Math.round(fr), s = Math.round(-fq - fr);
    const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s + fq + fr);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    const idx = indexOf.get(q + ',' + r);
    return idx === undefined ? null : tiles[idx];
  }

  let dirty = false;
  function update(dt, p) {
    clouds.forEach(c => { c.position.x += dt * 0.8; if (c.position.x > 100) c.position.x = -100; });

    // Pemain menginjak tile? (kaki di permukaan, bukan sedang melompat tinggi)
    if (p) {
      const t = tileAt(p.x, p.z);
      if (t && t.state === 0 && p.y <= HH + 0.35 && p.y >= HH - 0.4) {
        trigger(t, 0);
        if (api.onTileStep) { try { api.onTileStep(t.i); } catch (e) { /* abaikan */ } }
      }
    }

    for (const t of tiles) {
      if (t.state === 1) {
        t.t += dt;
        drawTile(t, 0, 1, Math.sin(t.t * 45) * 0.04);                // getar (hanya visual)
        dirty = true;
        if (t.t >= VANISH_DELAY) { t.state = 2; t.t = 0; t.platform.isFallen = true; }   // collision mati tepat 1 detik
      } else if (t.state === 2) {
        t.t += dt;
        const k = Math.min(t.t / SINK_TIME, 1);
        drawTile(t, -k * 3, 1 - k, 0);
        dirty = true;
        if (k >= 1) { t.state = 3; drawTile(t, -999, 0.0001, 0); }
      }
    }
    if (dirty) { inst.instanceMatrix.needsUpdate = true; dirty = false; }
  }

  // Tile yang diinjak pemain LAIN (dibaca dari data room: players[id].ht = { t<index>: waktuServer }).
  function syncRemote(players, myUid, nowMs, startAt) {
    if (!players) return;
    for (const id in players) {
      if (id === myUid) continue;
      const ht = players[id] && players[id].ht;
      if (!ht) continue;
      for (const key in ht) {
        const ts = Number(ht[key]);
        if (!ts || (startAt && ts < startAt - 500)) continue;        // abaikan sisa ronde lama
        const t = tiles[Number(String(key).slice(1))];
        if (t && t.state === 0) trigger(t, (nowMs - ts) / 1000);
      }
    }
  }

  function reset() {
    tiles.forEach(t => { t.state = 0; t.t = 0; t.platform.isFallen = false; });
    paintAll();
  }

  // Titik muncul: di atas tile tengah.
  const spawn = new THREE.Vector3(0, HH + 1.5, 0);

  return {
    group, platforms, hazards: [], guards: [], laserBeam: null,
    FIN_Y: FALL_Y, WIN: { x: 0, y: FALL_Y, z: 0 }, MAZE_H: 0, MAZE_Z: 0,
    spawn, tiles, update, reset, syncRemote,
  };
}
