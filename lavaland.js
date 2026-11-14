// ===== MAP SURVIVAL: LAVA LAND (gaya Stumble Guys) =====
// Arena ubin hexagon biru di atas lautan lava. Ubin yang diinjak berubah pink lalu runtuh ke lava; pemain terakhir yang
// bertahan menang. Waktu ubin dihitung dari awal ronde (detik) sehingga sama di semua pemain; ubin yang diinjak pemain lain
// disinkronkan lewat Firebase (lt/t<index> = waktu server, mirip ht/ di Honey Drop).
export function buildLavaLandWorld(THREE, scene, opts = {}) {
  const group = new THREE.Group(); scene.add(group);
  const RINGS = 7, S = 1.2, R = 1.08, LAVA_Y = -1.6, WARN = 0.9, FALL = 1.1;
  const platforms = [], tiles = [], bubbles = [];
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
    platforms.push(plat); tiles.push({ plat, topMat, sideMat, i: idx++, stepAt: null, vy: 0 });
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
  function update(delta, pos, t) {
    clock = typeof t === 'number' ? t : clock + delta;
    lavaTex.offset.x += delta * 0.012; lavaTex.offset.y += delta * 0.006;
    for (const b of bubbles) b.position.y = LAVA_Y + 0.1 + Math.sin(clock * 1.5 + b.userData.ph) * 0.15;
    for (const tl of tiles) {
      const p = tl.plat;
      if (tl.stepAt == null) { // diinjak pertama kali (hanya setelah ronde dimulai)
        if (clock >= 0 && pos && !p.isFallen && Math.abs(pos.y - 0.25) < 0.14 && Math.hypot(pos.x - p.startX, pos.z - p.startZ) < p.r) {
          tl.stepAt = clock; if (opts.onTileStep) opts.onTileStep(tl.i);
        }
        continue;
      }
      const age = clock - tl.stepAt;
      if (age < FALL) { // biru -> pink sambil bergetar
        const k = Math.min(1, Math.max(0, age) / WARN);
        tl.topMat.color.copy(baseCol).lerp(warnCol, k);
        tl.sideMat.color.copy(tl.topMat.color).multiplyScalar(0.62);
        p.mesh.position.y = Math.sin(clock * 60 + tl.i) * 0.015 * k;
      } else { // runtuh ke lava
        if (!p.isFallen) { p.isFallen = true; tl.vy = 0; tl.topMat.transparent = tl.sideMat.transparent = true; }
        tl.vy += 14 * delta; p.mesh.position.y -= tl.vy * delta;
        p.mesh.rotation.x += delta * 0.8 * (tl.i % 2 ? 1 : -1);
        const op = Math.max(0, 1 - (age - FALL) / 1.0);
        tl.topMat.opacity = tl.sideMat.opacity = op;
        if (op <= 0 || p.mesh.position.y < LAVA_Y - 0.5) p.mesh.visible = false;
      }
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
    clock = 0;
    for (const tl of tiles) {
      const p = tl.plat; tl.stepAt = null; tl.vy = 0; p.isFallen = false;
      p.mesh.visible = true; p.mesh.position.set(p.startX, 0, p.startZ); p.mesh.rotation.set(0, 0, 0);
      tl.topMat.color.copy(baseCol); tl.sideMat.color.copy(baseCol).multiplyScalar(0.62);
      tl.topMat.transparent = tl.sideMat.transparent = false; tl.topMat.opacity = tl.sideMat.opacity = 1;
    }
  }
  function applyEnvironment(sc) { sc.background = new THREE.Color(0xff9a58); sc.fog = new THREE.Fog(0xff9a58, 45, 170); }

  return { group, platforms, hazards: [], guards: [], laserBeam: null, FIN_Y: 1000, WIN: { x: 0, y: 1000, z: 0 }, MAZE_H: 0, MAZE_Z: 0,
    spawn: new THREE.Vector3(0, 0.25, 0), fallLimit: -2.4, applyEnvironment, reset, update, syncRemote };
}

// Banner pembuka ala Stumble Guys: papan putih "LAVA LAND" + pita merah "DON'T FALL!"
let lavaLandIntroTimer = null;
export function showLavaLandIntro() {
  if (!document.getElementById('ll-intro-style')) {
    const st = document.createElement('style'); st.id = 'll-intro-style';
    st.textContent = '#ll-intro{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:68;pointer-events:none;text-align:center;opacity:0;display:none}#ll-intro.show{display:block;animation:llIntro 3.4s ease-out forwards}#ll-intro .t{background:#fff;color:#2a2a2a;font:900 30px sans-serif;letter-spacing:1px;padding:6px 28px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,.35)}#ll-intro .s{display:inline-block;margin-top:-4px;background:#d6304a;color:#2a0d12;font:900 16px sans-serif;padding:5px 22px;border-radius:6px;transform:rotate(-1.5deg);box-shadow:0 3px 8px rgba(0,0,0,.35)}@keyframes llIntro{0%{opacity:0;transform:translate(-50%,-30px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-10px)}}';
    document.head.appendChild(st);
  }
  let el = document.getElementById('ll-intro');
  if (!el) { el = document.createElement('div'); el.id = 'll-intro'; el.innerHTML = '<div class="t">LAVA LAND</div><div class="s">DON\'T FALL!</div>'; document.body.appendChild(el); }
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(lavaLandIntroTimer); lavaLandIntroTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

