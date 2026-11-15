// ===== MAP SURVIVAL: LAVA LAND (gaya Stumble Guys) =====
// Arena ubin hexagon biru di atas lautan lava. LAVA TERUS NAIK. Ubin yang diinjak akan berubah pink sebentar lalu TUMBUH
// ke atas (satu per satu, waktunya acak per ubin tapi sama di semua pemain) jadi pilar; pemain harus lompat ke batu yang
// lebih tinggi supaya tidak kena lava. Pemain terakhir yang bertahan menang. Waktu dihitung dari awal ronde (detik);
// ubin yang diinjak pemain lain disinkronkan lewat Firebase (lt/t<index> = waktu server, mirip ht/ di Honey Drop).
export function buildLavaLandWorld(THREE, scene, opts = {}) {
  const group = new THREE.Group(); scene.add(group);
  const RINGS = 7, S = 1.2, R = 1.08, LAVA_Y = -1.6;
  // ---- Pengaturan lava naik & batu tumbuh (ubah di sini kalau mau lebih mudah/sulit) ----
  const LAVA_DELAY = 6;      // detik sebelum lava mulai naik
  const LAVA_RATE = 0.14;    // kecepatan naik lava (unit/detik)
  const LAVA_MAX_RISE = 9.2; // batas naik lava (lebih tinggi dari pilar tertinggi, jadi akhirnya semua tenggelam)
  const LAVA_KILL = 0.5;     // pemain mati kalau kakinya lebih dalam dari ini di bawah permukaan lava
  const STEP = 0.9;          // tinggi tiap kali batu tumbuh (masih bisa dilompati)
  const GROW_T = 0.5;        // lama animasi tumbuh (detik)
  const WARN = 0.9;          // ubin berkedip pink sebelum tumbuh (detik)
  const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  let lavaY = LAVA_Y;
  const platforms = [], tiles = [], bubbles = [];
  const tmpCol = new THREE.Color(), whiteCol = new THREE.Color(0xffffff);
  const mkTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t; };

  // Tekstur batu ubin
  const stone = mkTex(128, 128, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(0,30,90,.28)'; x.lineWidth = 2;
    for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(Math.random() * w, Math.random() * h); x.lineTo(Math.random() * w, Math.random() * h); x.stroke(); }
    for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.1 + Math.random() * 0.2) + ')'; x.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 8, 2 + Math.random() * 4); }
  });

  // Ubin hexagon (susunan koordinat aksial, ujung runcing menghadap sumbu Z)
  const baseCol = new THREE.Color(0x4f86e8), warnCol = new THREE.Color(0xff5fa8);
  const geo = new THREE.CylinderGeometry(R, R * 0.97, 0.5, 6);
  let idx = 0;
  for (let q = -RINGS; q <= RINGS; q++) for (let r = Math.max(-RINGS, -q - RINGS); r <= Math.min(RINGS, -q + RINGS); r++) {
    const x = S * Math.sqrt(3) * (q + r / 2), z = S * 1.5 * r;
    const topMat = new THREE.MeshStandardMaterial({ color: baseCol.clone(), map: stone, roughness: 0.55, metalness: 0.05 });
    const sideMat = new THREE.MeshStandardMaterial({ color: baseCol.clone().multiplyScalar(0.62), roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, [sideMat, topMat, sideMat]);
    mesh.position.set(x, 0, z); mesh.receiveShadow = true; group.add(mesh);
    const plat = { mesh, width: R * 2, depth: R * 2, type: 'static', startX: x, startY: 0, startZ: z, range: 0, speed: 0, phase: 0, isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: 1.0 };
    platforms.push(plat);
    // tiap ubin punya jadwal tumbuh acak (deterministik dari nomor ubin -> sama di semua pemain)
    tiles.push({ plat, mesh, topMat, sideMat, i: idx, stepAt: null, h: 0, maxLv: 3 + Math.floor(hash(idx, 1) * 5), t0: 1.0 + hash(idx, 2) * 2.5, period: 2.4 + hash(idx, 3) * 2.4 });
    idx++;
  }

  // Lautan lava bermotif sel merah-oranye
  const lavaTex = mkTex(512, 512, (x, w, h) => {
    x.fillStyle = '#ff5a1c'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const px = Math.random() * w, py = Math.random() * h, pr = 22 + Math.random() * 54, ry = pr * (0.6 + Math.random() * 0.4), rot = Math.random() * 3;
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        x.beginPath(); x.ellipse(px + ox, py + oy, pr, ry, rot, 0, Math.PI * 2);
        x.fillStyle = '#e63a14'; x.fill(); x.lineWidth = 6; x.strokeStyle = '#ff9a3c'; x.stroke();
      }
    }
  });
  lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping; lavaTex.repeat.set(24, 24);
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: lavaTex }));
  lava.rotation.x = -Math.PI / 2; lava.position.y = LAVA_Y; group.add(lava);

  // Gelembung lava yang naik-turun
  const bubMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, d = 16 + Math.random() * 28;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.3, 12, 10), bubMat);
    b.position.set(Math.cos(a) * d, LAVA_Y, Math.sin(a) * d); b.userData.ph = Math.random() * 6; group.add(b); bubbles.push(b);
  }

  // Rambu peringatan berbentuk belah ketupat di kejauhan (seperti di Stumble Guys)
  const signTex = mkTex(128, 128, (x, w, h) => {
    x.fillStyle = '#b8407e'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1b1030'; x.beginPath(); x.arc(64, 56, 24, 0, Math.PI * 2); x.fill(); x.fillRect(50, 72, 28, 22);
    x.fillStyle = '#b8407e'; x.beginPath(); x.arc(55, 54, 6, 0, Math.PI * 2); x.arc(73, 54, 6, 0, Math.PI * 2); x.fill(); x.fillRect(60, 66, 8, 8);
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 0.1), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.rotation.z = Math.PI / 4; sign.position.set(-9, 2.2, -19); group.add(sign);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 10), new THREE.MeshStandardMaterial({ color: 0x2a5fb0 }));
  pole.position.set(-9, 0.5, -19); group.add(pole);

  let clock = 0;
  function setHeight(tl, h, shake) { // batu tumbuh ke atas, dasar tetap di bawah
    tl.h = h; tl.plat.hh = 0.25 + h / 2; // dipakai tabrakan di main.js: puncak = mesh.y + hh
    tl.mesh.scale.y = (0.5 + h) / 0.5; tl.mesh.position.y = h / 2 + shake;
  }
  function update(delta, pos, t) {
    clock = typeof t === 'number' ? t : clock + delta;
    // lava naik pelan-pelan setelah LAVA_DELAY detik
    lavaY = LAVA_Y + Math.min(LAVA_MAX_RISE, Math.max(0, clock - LAVA_DELAY) * LAVA_RATE);
    lava.position.y = lavaY;
    lavaTex.offset.x += delta * 0.012; lavaTex.offset.y += delta * 0.006;
    for (const b of bubbles) b.position.y = lavaY + 0.1 + Math.sin(clock * 1.5 + b.userData.ph) * 0.15;
    for (const tl of tiles) {
      const p = tl.plat;
      if (tl.stepAt == null) { // diinjak pertama kali (hanya setelah ronde dimulai)
        if (clock >= 0 && pos && Math.abs(pos.y - 0.25) < 0.14 && Math.hypot(pos.x - p.startX, pos.z - p.startZ) < p.r) {
          tl.stepAt = clock; if (opts.onTileStep) opts.onTileStep(tl.i);
        }
        continue;
      }
      const age = clock - tl.stepAt;
      // n = berapa kali batu ini sudah mulai tumbuh
      const n = age < tl.t0 ? 0 : Math.min(tl.maxLv, Math.floor((age - tl.t0) / tl.period) + 1);
      let h = 0;
      if (n > 0) { const e = Math.min(1, (age - (tl.t0 + (n - 1) * tl.period)) / GROW_T); h = STEP * ((n - 1) + (1 - Math.pow(1 - e, 3))); }
      // kedip pink sebentar sebelum tumbuh lagi
      let warnK = 0;
      if (n < tl.maxLv) { const until = tl.t0 + n * tl.period - age; if (until < WARN) warnK = 1 - Math.max(0, until) / WARN; }
      tmpCol.copy(baseCol).lerp(whiteCol, Math.min(0.3, (h / STEP) * 0.05)).lerp(warnCol, warnK); // makin tinggi makin terang
      tl.topMat.color.copy(tmpCol); tl.sideMat.color.copy(tmpCol).multiplyScalar(0.62);
      setHeight(tl, h, warnK > 0 ? Math.sin(clock * 60 + tl.i) * 0.015 * warnK : 0);
    }
  }
  function syncRemote(players, myUid, nowMs, startMs) {
    for (const id in players) {
      if (id === myUid) continue;
      const lt = players[id] && players[id].lt; if (!lt) continue;
      for (const k in lt) {
        const i = +String(k).slice(1), T = Number(lt[k]);
        if (!tiles[i] || !(T >= startMs - 1000)) continue; // abaikan data ronde lama
        const at = (T - startMs) / 1000;
        if (tiles[i].stepAt == null || at < tiles[i].stepAt) tiles[i].stepAt = at;
      }
    }
  }
  function reset() {
    clock = 0; lavaY = LAVA_Y; lava.position.y = LAVA_Y;
    for (const tl of tiles) {
      tl.stepAt = null; tl.plat.isFallen = false; tl.mesh.visible = true;
      tl.mesh.rotation.set(0, 0, 0); tl.mesh.position.x = tl.plat.startX; tl.mesh.position.z = tl.plat.startZ; setHeight(tl, 0, 0);
      tl.topMat.color.copy(baseCol); tl.sideMat.color.copy(baseCol).multiplyScalar(0.62);
    }
  }
  function applyEnvironment(sc) { sc.background = new THREE.Color(0xff9a58); sc.fog = new THREE.Fog(0xff9a58, 45, 170); }

  return { group, platforms, hazards: [], guards: [], laserBeam: null, FIN_Y: 1000, WIN: { x: 0, y: 1000, z: 0 }, MAZE_H: 0, MAZE_Z: 0,
    spawn: new THREE.Vector3(0, 0.25, 0), get fallLimit() { return lavaY - LAVA_KILL; }, applyEnvironment, reset, update, syncRemote };
}

// Banner pembuka ala Stumble Guys: papan putih "LAVA LAND" + pita merah "LAVA IS RISING!"
let lavaLandIntroTimer = null;
export function showLavaLandIntro() {
  if (!document.getElementById('ll-intro-style')) {
    const st = document.createElement('style'); st.id = 'll-intro-style';
    st.textContent = '#ll-intro{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:68;pointer-events:none;text-align:center;opacity:0;display:none}#ll-intro.show{display:block;animation:llIntro 3.4s ease-out forwards}#ll-intro .t{background:#fff;color:#2a2a2a;font:900 30px sans-serif;letter-spacing:1px;padding:6px 28px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,.35)}#ll-intro .s{display:inline-block;margin-top:-4px;background:#d6304a;color:#2a0d12;font:900 16px sans-serif;padding:5px 22px;border-radius:6px;transform:rotate(-1.5deg);box-shadow:0 3px 8px rgba(0,0,0,.35)}@keyframes llIntro{0%{opacity:0;transform:translate(-50%,-30px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-10px)}}';
    document.head.appendChild(st);
  }
  let el = document.getElementById('ll-intro');
  if (!el) { el = document.createElement('div'); el.id = 'll-intro'; el.innerHTML = '<div class="t">LAVA LAND</div><div class="s">LAVA IS RISING!</div>'; document.body.appendChild(el); }
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(lavaLandIntroTimer); lavaLandIntroTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

