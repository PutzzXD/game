import * as THREE from 'three';

export function buatLabirin(scene, platforms, startX, startY, startZ) {
  // 1. Bikin Lantai Dasar Labirin
  const lantaiMat = new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.9 });
  const baseGeo = new THREE.BoxGeometry(20, 0.5, 30);
  const baseMesh = new THREE.Mesh(baseGeo, lantaiMat);
  baseMesh.position.set(startX, startY - 0.25, startZ - 15);
  baseMesh.receiveShadow = true;
  scene.add(baseMesh);
  
  // Daftarkan lantai agar bisa diinjak
  platforms.push({ 
    mesh: baseMesh, width: 20, depth: 30, type: 'static', 
    startX: startX, startY: startY - 0.25, startZ: startZ - 15, 
    isFallen: false, dx: 0, r: 0 
  });

  // 2. Fungsi Bikin Dinding Labirin
  const dindingMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.8 });
  function addDinding(x, z, w, d) {
    const geo = new THREE.BoxGeometry(w, 4, d);
    const mesh = new THREE.Mesh(geo, dindingMat);
    mesh.position.set(x, startY + 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    
    // Daftarkan dinding agar pemain tidak bisa nembus
    platforms.push({ 
      mesh: mesh, width: w, depth: d, type: 'static', 
      startX: x, startY: startY + 2, startZ: z, 
      isFallen: false, dx: 0, r: 0 
    });
  }

  // 3. Susun Dindingnya (Bikin jalur belok-belok)
  // Dinding Luar
  addDinding(startX - 9.5, startZ - 15, 1, 30); // Kiri
  addDinding(startX + 9.5, startZ - 15, 1, 30); // Kanan
  addDinding(startX, startZ - 29.5, 20, 1);     // Belakang

  // Dinding Dalam (Bikin pemain harus muter)
  addDinding(startX + 4, startZ - 5, 10, 1);
  addDinding(startX - 4, startZ - 12, 1, 14);
  addDinding(startX + 5, startZ - 20, 8, 1);
  addDinding(startX - 2, startZ - 24, 1, 8);

  // 4. Bikin Papan Finis di Ujung Labirin
  const finisZ = startZ - 27;
  const finisLine = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.1, 6), 
    new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1 })
  );
  finisLine.position.set(startX, startY + 0.1, finisZ); 
  scene.add(finisLine);

  // Teks Finis
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 15; ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = '#00ff00'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SELAMAT KELUAR LABIRIN!', canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide }));
  board.position.set(startX, startY + 4, finisZ); 
  scene.add(board);

  // 5. Kembalikan Posisi Finis agar Main.js tahu
  return { x: startX, y: startY, z: finisZ };
}