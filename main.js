import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============ 1. KONFIGURASI FIREBASE ============
const FIREBASE_URL = "https://game3d-66134-default-rtdb.asia-southeast1.firebasedatabase.app/";
const DEV_USERNAME = "putzzdev"; 

let playerData = { 
  username: "", 
  isDev: false, 
  coins: 0, 
  inventory: ['baju_default', 'celana_default', 'sepatu_default', 'efek_lari_default', 'efek_lompat_default'],
  equipped: {
    baju: 'baju_default',
    celana: 'celana_default',
    sepatu: 'sepatu_default',
    efek_lari: 'efek_lari_default',
    efek_lompat: 'efek_lompat_default'
  }
};

let gameState = 'LOGIN'; 
let isGameStarted = false; 

const SHOP_ITEMS = {
  baju: [
    { id: 'baju_default', name: 'Baju Biru Tua', price: 0, color: 0x2c3e50 },
    { id: 'baju_merah', name: 'Baju Merah', price: 150, color: 0xff0000 },
    { id: 'baju_hijau', name: 'Baju Hijau', price: 150, color: 0x00ff00 },
    { id: 'baju_emas', name: 'Baju Emas', price: 300, color: 0xffd700 }
  ],
  celana: [
    { id: 'celana_default', name: 'Celana Hitam', price: 0, color: 0x1a1a1c },
    { id: 'celana_biru', name: 'Celana Jeans', price: 150, color: 0x1e3a8a },
    { id: 'celana_putih', name: 'Celana Putih', price: 150, color: 0xffffff }
  ],
  sepatu: [
    { id: 'sepatu_default', name: 'Sepatu Merah', price: 0, color: 0xa61c2b },
    { id: 'sepatu_neon', name: 'Sepatu Neon', price: 200, color: 0x00ffcc },
    { id: 'sepatu_emas', name: 'Sepatu Emas', price: 400, color: 0xffd700 }
  ],
  efek: [
    { id: 'efek_lari_default', name: 'Tanpa Efek Lari', price: 0, type: 'lari' },
    { id: 'efek_lari_api', name: 'Jejak Api', price: 300, type: 'lari', color: 0xff3300 },
    { id: 'efek_lompat_default', name: 'Tanpa Efek Lompat', price: 0, type: 'lompat' },
    { id: 'efek_lompat_es', name: 'Ledakan Es', price: 300, type: 'lompat', color: 0x00ffff }
  ]
};

// ============ FUNGSI FETCH GLOBAL CHAT ============
async function fetchGlobalChat() {
  try {
    const res = await fetch(`${FIREBASE_URL}chats.json?orderBy="$key"&limitToLast=20`);
    const data = await res.json();
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    
    if (data) {
      Object.values(data).forEach(msg => {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `<span class="name ${msg.isDev ? 'dev' : ''}">${msg.name}: </span><span class="text">${msg.text}</span>`;
        chatMessages.appendChild(div);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (e) {
    console.log("Gagal mengambil chat:", e);
  }
}

// ============ 2. FUNGSI NOTIFIKASI CUSTOM (TOAST) ============
function showToast(message) {
  const toast = document.getElementById('custom-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 2000); 
}

// ============ 3. SETUP DOM & EVENT LISTENER ============
window.addEventListener('DOMContentLoaded', () => {
  const loginMsg = document.getElementById('login-msg');
  const regMsg = document.getElementById('reg-msg');
  const profileModal = document.getElementById('profile-modal');
  const shopModal = document.getElementById('shop-modal');
  
  const chatBox = document.getElementById('chat-box');
  const chatToggle = document.getElementById('chat-toggle');
  
  chatToggle.addEventListener('click', () => {
    const isHidden = chatBox.style.display === 'none' || chatBox.style.display === '';
    chatBox.style.display = isHidden ? 'flex' : 'none';
    chatToggle.textContent = isHidden ? '❌ Tutup Chat' : '💬 Chat Global';
  });

  document.getElementById('chat-send').addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text.length === 0) return;
    const payload = { name: playerData.username, isDev: playerData.isDev, text: text, time: Date.now() };
    fetch(`${FIREBASE_URL}chats.json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    input.value = '';
  });

  document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('chat-send').click(); });

  document.getElementById('btn-profile').addEventListener('click', () => {
    profileModal.style.display = profileModal.style.display === 'block' ? 'none' : 'block';
  });
  document.getElementById('close-modal').addEventListener('click', () => { profileModal.style.display = 'none'; });
  document.getElementById('btn-logout').addEventListener('click', () => { localStorage.removeItem('parkour_user'); location.reload(); });

  document.getElementById('btn-shop').addEventListener('click', () => {
    shopModal.style.display = 'flex';
    renderShopTab('baju'); 
  });
  document.getElementById('close-shop').addEventListener('click', () => { shopModal.style.display = 'none'; });

  document.querySelectorAll('.shop-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderShopTab(e.target.dataset.cat);
    });
  });

  document.getElementById('btn-start-game').addEventListener('click', () => {
    requestFullscreenAndLock();
    document.getElementById('btn-start-game').style.display = 'none';
    document.getElementById('btn-shop').style.display = 'none';
    document.getElementById('in-game-controls').style.display = 'block';
    chatBox.style.display = 'none'; 
    chatToggle.textContent = '💬 Chat Global';
    isGameStarted = true;
    gameState = 'PLAYING';
    profileModal.style.display = 'none';
    shopModal.style.display = 'none';
    camera.position.set(0, 4, 8);
    controls.target.set(0, 1.5, 0);
  });

  // --- PROSES REGISTRASI & LOGIN ---
  document.getElementById('btn-register').addEventListener('click', async () => {
    const username = document.getElementById('reg-username').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();
    const pinConfirm = document.getElementById('reg-pin-confirm').value.trim();

    if (username.length < 3) { regMsg.textContent = "Username minimal 3 karakter!"; regMsg.className = "msg error"; return; }
    if (pin.length !== 6 || isNaN(pin)) { regMsg.textContent = "PIN harus 6 angka!"; regMsg.className = "msg error"; return; }
    if (pin !== pinConfirm) { regMsg.textContent = "PIN tidak cocok!"; regMsg.className = "msg error"; return; }

    regMsg.textContent = "Mendaftarkan..."; regMsg.className = "msg";
    document.getElementById('btn-register').disabled = true;

    const userKey = username.toLowerCase();
    const firebaseUrl = `${FIREBASE_URL}players/${userKey}.json`;

    try {
      const checkRes = await fetch(firebaseUrl);
      const existing = await checkRes.json();
      if (existing) {
        regMsg.textContent = "Username sudah dipakai!"; regMsg.className = "msg error";
        document.getElementById('btn-register').disabled = false; return;
      }
      const newPlayerData = { username, pin, isDev: (userKey === DEV_USERNAME), coins: 0, inventory: playerData.inventory, equipped: playerData.equipped };
      await fetch(firebaseUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPlayerData) });

      regMsg.textContent = "Registrasi berhasil! Silakan Masuk."; regMsg.className = "msg success";
      document.getElementById('reg-username').value = '';
      document.getElementById('reg-pin').value = '';
      document.getElementById('reg-pin-confirm').value = '';
      setTimeout(() => { document.getElementById('tab1').checked = true; }, 1500);
    } catch(e) {
      regMsg.textContent = "Gagal daftar. Cek koneksi."; regMsg.className = "msg error";
    }
    document.getElementById('btn-register').disabled = false;
  });

  document.getElementById('btn-login').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const pin = document.getElementById('login-pin').value.trim();

    if (username.length < 3) { loginMsg.textContent = "Username minimal 3 karakter!"; loginMsg.className = "msg error"; return; }
    if (pin.length !== 6 || isNaN(pin)) { loginMsg.textContent = "PIN harus 6 angka!"; loginMsg.className = "msg error"; return; }

    loginMsg.textContent = "Memproses..."; loginMsg.className = "msg";
    document.getElementById('btn-login').disabled = true;

    const userKey = username.toLowerCase();
    const firebaseUrl = `${FIREBASE_URL}players/${userKey}.json`;

    try {
      const res = await fetch(firebaseUrl);
      const data = await res.json();
      if (!data) {
        loginMsg.textContent = "Akun tidak ditemukan. Silakan Daftar."; loginMsg.className = "msg error";
        document.getElementById('btn-login').disabled = false; return;
      }
      if (data.pin !== pin) {
        loginMsg.textContent = "PIN salah! Coba lagi."; loginMsg.className = "msg error";
        document.getElementById('btn-login').disabled = false; return;
      }
      
      playerData = { ...playerData, ...data, inventory: data.inventory || playerData.inventory, equipped: data.equipped || playerData.equipped };
      localStorage.setItem('parkour_user', JSON.stringify({ username, isDev: data.isDev }));
      startLobby();
    } catch(e) {
      loginMsg.textContent = "Gagal konek ke server."; loginMsg.className = "msg error";
      document.getElementById('btn-login').disabled = false;
    }
  });

  // AUTO LOGIN
  const savedSession = localStorage.getItem('parkour_user');
  if (savedSession) {
    try {
      const session = JSON.parse(savedSession);
      fetch(`${FIREBASE_URL}players/${session.username.toLowerCase()}.json`)
        .then(res => res.json())
        .then(data => {
          if (data) {
            playerData = { ...playerData, ...data, inventory: data.inventory || playerData.inventory, equipped: data.equipped || playerData.equipped };
            startLobby();
          } else { localStorage.removeItem('parkour_user'); }
        });
    } catch(e) { localStorage.removeItem('parkour_user'); }
  }
});

// ============ 4. FUNGSI LOBI & SHOP ============
function startLobby() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('game-ui').style.display = 'block';
  gameState = 'LOBBY'; 
  document.getElementById('hud-username').textContent = playerData.username;
  document.getElementById('coin-amount').textContent = playerData.coins || 0;
  document.getElementById('modal-username').textContent = playerData.username;
  
  if (playerData.isDev) {
    document.getElementById('hud-verified').style.display = 'flex';
    document.getElementById('modal-status').textContent = "Developer ✔";
  } else {
    document.getElementById('modal-status').textContent = "Player Biasa";
    document.getElementById('modal-status').style.color = "#ccc";
  }
  document.getElementById('btn-start-game').style.display = 'flex';
  document.getElementById('btn-shop').style.display = 'flex';
  document.getElementById('in-game-controls').style.display = 'none';
  document.getElementById('chat-container').style.display = 'flex';

  fetchGlobalChat();
  setInterval(fetchGlobalChat, 3000);

  init3DGame();
  camera.position.set(0, 3, -5);
  controls.target.set(0, 1.5, 0);
}

function renderShopTab(category) {
  const container = document.getElementById('shop-items-container');
  container.innerHTML = '';
  
  SHOP_ITEMS[category].forEach(item => {
    const isOwned = playerData.inventory.includes(item.id);
    const isEquipped = Object.values(playerData.equipped).includes(item.id);
    const div = document.createElement('div');
    div.className = 'shop-item';
    
    let previewHTML = '';
    if (item.color) {
      previewHTML = `<div class="color-preview" style="background: #${item.color.toString(16).padStart(6, '0')}"></div>`;
    } else {
      previewHTML = `<div class="color-preview" style="background: #444; display: flex; align-items: center; justify-content: center; font-size: 24px;">✨</div>`;
    }

    let btnHTML = '';
    if (isEquipped) {
      btnHTML = `<button class="shop-buy-btn" disabled>DIPAKAI</button>`;
    } else if (isOwned) {
      btnHTML = `<button class="shop-buy-btn" onclick="equipItem('${category}', '${item.id}')">PAKAI</button>`;
    } else {
      btnHTML = `<button class="shop-buy-btn" onclick="buyItem('${category}', '${item.id}', ${item.price})">BELI (${item.price})</button>`;
    }

    div.innerHTML = `${previewHTML}<div class="item-name">${item.name}</div>${item.price > 0 ? `<div class="item-price">🪙 ${item.price}</div>` : '<div class="item-price">GRATIS</div>'}${btnHTML}`;
    container.appendChild(div);
  });
}

window.buyItem = async function(category, itemId, price) {
  if (playerData.coins < price) { showToast("❌ Koin kamu tidak cukup!"); return; }
  playerData.coins -= price;
  playerData.inventory.push(itemId);
  await updatePlayerFirebase();
  document.getElementById('coin-amount').textContent = playerData.coins;
  renderShopTab(category);
  showToast("✅ Berhasil dibeli!");
};

window.equipItem = async function(category, itemId) {
  let equipKey = category;
  if (category === 'efek') equipKey = itemId.includes('lari') ? 'efek_lari' : 'efek_lompat';
  
  playerData.equipped[equipKey] = itemId;
  await updatePlayerFirebase();
  updateCharacterVisuals();
  renderShopTab(category);
  showToast("✅ Item berhasil dipakai!");
};

async function updatePlayerFirebase() {
  const userKey = playerData.username.toLowerCase();
  const firebaseUrl = `${FIREBASE_URL}players/${userKey}.json`;
  await fetch(firebaseUrl, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coins: playerData.coins, inventory: playerData.inventory, equipped: playerData.equipped })
  });
}

// ============ 5. UPDATE VISUAL KARAKTER ============
function updateCharacterVisuals() {
  if (!character) return;
  const getColor = (cat, id, defaultColor) => {
    const item = SHOP_ITEMS[cat].find(i => i.id === id);
    return item && item.color ? item.color : defaultColor;
  };
  const bajuColor = getColor('baju', playerData.equipped.baju, 0x2c3e50);
  const celanaColor = getColor('celana', playerData.equipped.celana, 0x1a1a1c);
  const sepatuColor = getColor('sepatu', playerData.equipped.sepatu, 0xa61c2b);
  
  character.traverse((child) => {
    if (child.isMesh) {
      if (child.userData.type === 'baju') child.material.color.setHex(bajuColor);
      if (child.userData.type === 'celana') child.material.color.setHex(celanaColor);
      if (child.userData.type === 'sepatu') child.material.color.setHex(sepatuColor);
    }
  });
}

// ============ 6. EFEK PARTIKEL ============
function createTrailEffect() {
  if (playerData.equipped.efek_lari === 'efek_lari_default') return;
  const item = SHOP_ITEMS.efek.find(i => i.id === playerData.equipped.efek_lari);
  if (!item || !item.color) return;
  
  const geo = new THREE.SphereGeometry(0.12, 8, 8);
  const mat = new THREE.MeshStandardMaterial({ color: item.color, emissive: item.color, emissiveIntensity: 2, transparent: true, opacity: 1 });
  const particle = new THREE.Mesh(geo, mat);
  
  particle.position.copy(character.position);
  particle.position.y += 0.3;
  particle.position.x += (Math.random() - 0.5) * 0.4;
  particle.position.z += (Math.random() - 0.5) * 0.4;
  
  scene.add(particle);
  trailParticles.push({ mesh: particle, life: 0.6, startColor: new THREE.Color(0xffff00), endColor: new THREE.Color(0xff0000) });
}

function createJumpEffect() {
  if (playerData.equipped.efek_lompat === 'efek_lompat_default') return;
  const item = SHOP_ITEMS.efek.find(i => i.id === playerData.equipped.efek_lompat);
  if (!item || !item.color) return;
  
  for(let i=0; i<20; i++) {
    const geo = new THREE.SphereGeometry(0.15, 6, 6);
    const mat = new THREE.MeshStandardMaterial({ color: item.color, emissive: item.color, emissiveIntensity: 3, transparent: true, opacity: 1 });
    const particle = new THREE.Mesh(geo, mat);
    
    particle.position.copy(character.position);
    particle.position.y += 0.2;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1.5;
    
    particle.userData = { vx: Math.cos(angle) * speed, vy: Math.random() * 2 + 0.5, vz: Math.sin(angle) * speed };
    scene.add(particle);
    jumpParticles.push({ mesh: particle, life: 0.8 });
  }
}

// ============ 7. SETUP 3D & GAME LOOP ============
let scene, camera, renderer, character, nameSprite, controls;
let platforms = [], physics, lavaMat;
let leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, headGroup;
let joystickVector = new THREE.Vector2(0, 0);
let isRunning = false;
let trailParticles = [], jumpParticles = [];
let laserBeam = null; // Objek Laser NPC
let rig, leftElbow, rightElbow, leftKnee, rightKnee, embers;
let sq = { x: 0, v: 0 }, moveVel = new THREE.Vector2(0, 0), wasGrounded = true, laserState = 'off';
const LASER_Z = -44, LASER_Y = 9.3;

function spawnDust(n) {
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.7 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), mat);
    m.position.copy(character.position); m.position.y += 0.1;
    m.position.x += (Math.random() - 0.5) * 0.7; m.position.z += (Math.random() - 0.5) * 0.7;
    scene.add(m); trailParticles.push({ mesh: m, life: 0.5 });
  }
}

function requestFullscreenAndLock() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(e => console.log(e));
    }).catch(e => console.log(e));
  }
}

function init3DGame() {
  if (renderer) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a24);
  scene.fog = new THREE.Fog(0x1a1a24, 20, 150);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 50, 10);
  sun.castShadow = true;
  scene.add(sun);

  lavaMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), lavaMat);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = -8;
  scene.add(lava);
  const emberPos = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) { emberPos[i*3] = (Math.random()-0.5)*90; emberPos[i*3+1] = -8 + Math.random()*30; emberPos[i*3+2] = -35 + (Math.random()-0.5)*100; }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff7722, size: 0.25, transparent: true, opacity: 0.8 }));
  scene.add(embers);

  const platformMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.8 });
  const breakableMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
  const movingMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.7 });
  const trapMat = new THREE.MeshStandardMaterial({ color: 0xff0055, roughness: 0.5 }); // Warna platform jebakan

  function createPlatform(x, y, z, width, depth, type = 'static', tell = 0) {
    const height = 0.5;
    const geo = new THREE.BoxGeometry(width, height, depth);
    let mat = platformMat;
    if (type.includes('moving')) mat = movingMat;
    if (type === 'fake') { mat = platformMat.clone(); mat.transparent = true; }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true; mesh.castShadow = true;
    scene.add(mesh);

    platforms.push({ 
      mesh, width, depth, type, 
      startX: x, startY: y, startZ: z, 
      range: 2.5, speed: 1.5, phase: Math.random() * Math.PI * 2, 
      isFallen: false, tell, revealTimer: 0, dx: 0 
    });
  }

  // ============ JALUR PARKOUR DENGAN JEBAKAN KIRI/KANAN & LASER NPC ============
  createPlatform(0, 0, 0, 8, 8, 'static');         // Start
  createPlatform(0, 1.5, -8, 5, 5, 'static');
  
  // Jebakan Kiri / Kanan Pertama (Kiri jebakan jatuh, Kanan aman)
  createPlatform(-2.5, 3, -15, 3.5, 3.5, 'fake', 0.9);  // KOTAK PALSU (jelas)
  createPlatform(2.5, 3, -15, 3.5, 3.5, 'static');       // AMAN

  createPlatform(0, 4.5, -22, 6, 6, 'moving_x');

  // Jebakan Tebak-tebakan Kedua (Kiri aman, Kanan jebakan jatuh)
  createPlatform(-2.5, 6, -29, 3.5, 3.5, 'static');      // AMAN
  createPlatform(2.5, 6, -29, 3.5, 3.5, 'fake', 0.6); // KOTAK PALSU (sedang)

  // 3 kotak: hanya kiri yang asli
  createPlatform(-3.5, 7.5, -36, 3, 5, 'static');
  createPlatform(0, 7.5, -36, 3, 5, 'fake', 0.4);
  createPlatform(3.5, 7.5, -36, 3, 5, 'fake', 0.4);
  
  // Area Laser NPC Tembak Otomatis
  createPlatform(0, 9, -44, 6, 6, 'static');
  
  // Buat Visual Laser Beam NPC
  const laserGeo = new THREE.BoxGeometry(7, 0.2, 0.2);
  const laserMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  laserBeam = new THREE.Mesh(laserGeo, laserMat);
  laserBeam.position.set(0, 9.3, -44);
  scene.add(laserBeam);
  [-3.6, 3.6].forEach(ex => {
    const em = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x222233, emissive: 0x00ffff, emissiveIntensity: 0.6 }));
    em.position.set(ex, 9.6, LASER_Z); scene.add(em);
  });

  createPlatform(0, 10.5, -52, 5, 5, 'moving_y');
  // Jembatan kaca: tiap baris 1 asli, 1 palsu (hampir tak terlihat, cuma sesekali berkedip)
  createPlatform(-2, 12, -58, 3.2, 2.5, 'static'); createPlatform(2, 12, -58, 3.2, 2.5, 'fake', 0.15);
  createPlatform(-2, 12, -61.5, 3.2, 2.5, 'fake', 0.05); createPlatform(2, 12, -61.5, 3.2, 2.5, 'static');
  createPlatform(0, 13.5, -68, 8, 8, 'static');    // Puncak / Finish

  // FINISH LINE
  const finishLine = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 7), new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1 }));
  finishLine.position.set(0, 13.8, -68); scene.add(finishLine);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const leftPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), poleMat); leftPole.position.set(-4, 16.5, -68); scene.add(leftPole);
  const rightPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), poleMat); rightPole.position.set(4, 16.5, -68); scene.add(rightPole);

  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 15; ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = '#00ff00'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PUTZZDEV MENGAKUI', canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = 'bold 90px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('KAMU JAGO!', canvas.width / 2, canvas.height / 2 + 50);

  const texture = new THREE.CanvasTexture(canvas); texture.needsUpdate = true;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, emissive: 0x00ff00, emissiveIntensity: 0.2 }));
  board.position.set(0, 17.5, -68); scene.add(board);

  character = new THREE.Group();
  character.position.set(0, 0.25, 0);
  scene.add(character);

  physics = { velocityY: 0, isGrounded: true, gravity: -32, jumpForce: 13, coyoteTime: 0, jumpCount: 0, maxJumps: 2 };

  const matSkin = new THREE.MeshStandardMaterial({ color: 0xffd1b3 });
  const matShirt = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
  const matPants = new THREE.MeshStandardMaterial({ color: 0x1a1a1c });
  const matShoe = new THREE.MeshStandardMaterial({ color: 0xa61c2b });
  const matEyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const matPupil = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const matHair = new THREE.MeshStandardMaterial({ color: 0xd1d1d6, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 4, 16), matShirt); torso.position.y = 1.4; torso.castShadow = true; torso.userData.type = 'baju'; character.add(torso);
  headGroup = new THREE.Group(); headGroup.position.y = 2.2; character.add(headGroup);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), matSkin); head.castShadow = true; headGroup.add(head);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matEyeWhite); leftEye.position.set(-0.1, 0.05, 0.27); headGroup.add(leftEye);
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matPupil); leftPupil.position.set(-0.1, 0.05, 0.31); headGroup.add(leftPupil);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matEyeWhite); rightEye.position.set(0.1, 0.05, 0.27); headGroup.add(rightEye);
  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matPupil); rightPupil.position.set(0.1, 0.05, 0.31); headGroup.add(rightPupil);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 16), matSkin); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.02, 0.3); headGroup.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), matPupil); mouth.position.set(0, -0.12, 0.28); headGroup.add(mouth);

  const hairGroup = new THREE.Group(); headGroup.add(hairGroup);
  const baseHair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.6), matHair); baseHair.position.y = 0.02; baseHair.castShadow = true; hairGroup.add(baseHair);
  const bangGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
  const bangLeft = new THREE.Mesh(bangGeo, matHair); bangLeft.position.set(-0.15, 0.15, 0.24); bangLeft.rotation.set(0.2, 0, -0.3); hairGroup.add(bangLeft);
  const bangCenter = new THREE.Mesh(bangGeo, matHair); bangCenter.position.set(0, 0.2, 0.27); bangCenter.rotation.set(0.1, 0, 0); bangCenter.scale.set(1.2, 1, 1.2); hairGroup.add(bangCenter);
  const bangRight = new THREE.Mesh(bangGeo, matHair); bangRight.position.set(0.15, 0.15, 0.24); bangRight.rotation.set(0.2, 0, 0.3); hairGroup.add(bangRight);

  const makeArm = (x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.8, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.25, 4, 8), matShirt); up.position.y = -0.22; up.castShadow = true; up.userData.type = 'baju'; pivot.add(up);
    const elbow = new THREE.Group(); elbow.position.y = -0.42; pivot.add(elbow);
    const low = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.25, 4, 8), matShirt); low.position.y = -0.2; low.castShadow = true; low.userData.type = 'baju'; elbow.add(low);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), matSkin); hand.position.y = -0.43; elbow.add(hand);
    return { pivot, elbow };
  };
  const makeLeg = (x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.9, 0);
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.21, 4, 8), matPants); th.position.y = -0.2; th.castShadow = true; th.userData.type = 'celana'; pivot.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.4; pivot.add(knee);
    const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 4, 8), matPants); sh.position.y = -0.2; sh.castShadow = true; sh.userData.type = 'celana'; knee.add(sh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.35), matShoe); shoe.position.set(0, -0.41, 0.05); shoe.userData.type = 'sepatu'; knee.add(shoe);
    return { pivot, knee };
  };
  const la = makeArm(-0.4), ra = makeArm(0.4), ll = makeLeg(-0.15), rl = makeLeg(0.15);
  leftArmPivot = la.pivot; leftElbow = la.elbow; rightArmPivot = ra.pivot; rightElbow = ra.elbow;
  leftLegPivot = ll.pivot; leftKnee = ll.knee; rightLegPivot = rl.pivot; rightKnee = rl.knee;

  // "rig" membungkus badan: bisa miring, memantul & squash tanpa mengubah posisi kaki/collision
  rig = new THREE.Group();
  [torso, headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot].forEach(o => rig.add(o));
  character.add(rig);

  updateCharacterVisuals();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.minDistance = 3; controls.maxDistance = 15;
  controls.maxPolarAngle = Math.PI / 2 - 0.1;

  controls.domElement.addEventListener('pointerdown', function(e) {
    if (!isGameStarted) return;
    const x = e.clientX, y = e.clientY;
    const w = window.innerWidth, h = window.innerHeight;
    if ((x < 180 && y > h - 180) || (x > w - 220 && y > h - 160)) e.stopImmediatePropagation();
  }, { capture: true });

  const joystickArea = document.getElementById('joystick-area');
  const joystickKnob = document.getElementById('joystick-knob');
  let joystickActive = false;
  const maxDist = 40;

  function updateKnob(x, y) {
    const dist = Math.sqrt(x*x + y*y);
    if (dist > maxDist) { x = (x / dist) * maxDist; y = (y / dist) * maxDist; }
    joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    joystickVector.x = x / maxDist; joystickVector.y = -y / maxDist;
  }

  const handleStart = (e) => { e.preventDefault(); joystickActive = true; handleMove(e); };
  const handleMove = (e) => {
    if (!joystickActive) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const rect = joystickArea.getBoundingClientRect();
    updateKnob(touch.clientX - (rect.left + rect.width/2), touch.clientY - (rect.top + rect.height/2));
  };
  const handleEnd = () => { joystickActive = false; joystickVector.set(0,0); joystickKnob.style.transform = `translate(-50%, -50%)`; };

  joystickArea.addEventListener('touchstart', handleStart, { passive: false });
  joystickArea.addEventListener('touchmove', handleMove, { passive: false });
  joystickArea.addEventListener('touchend', handleEnd);
  joystickArea.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);

  document.getElementById('btn-jump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (physics.isGrounded) {
      physics.jumpCount = 1; physics.velocityY = physics.jumpForce; physics.isGrounded = false; sq.v = 6; spawnDust(5);
      createJumpEffect();
    } else if (physics.jumpCount < physics.maxJumps) {
      physics.jumpCount++; physics.velocityY = physics.jumpForce; sq.v = 6;
      createJumpEffect();
    }
  });

  const btnRun = document.getElementById('btn-run');
  btnRun.addEventListener('touchstart', (e) => { e.preventDefault(); isRunning = true; });
  btnRun.addEventListener('touchend', (e) => { e.preventDefault(); isRunning = false; });
  btnRun.addEventListener('pointerdown', (e) => { isRunning = true; });
  btnRun.addEventListener('pointerup', (e) => { isRunning = false; });
  btnRun.addEventListener('pointerleave', (e) => { isRunning = false; });

  document.getElementById('btn-restart').addEventListener('click', () => { location.reload(); });
  document.getElementById('overlay').style.display = 'none';

  updateCharacterNameSprite(playerData.username, playerData.isDev);
  animate();
}

function checkGroundCollision(x, z, y) {
  const feetY = y; const tolerance = 0.3;
  for (let p of platforms) {
    if (p.isFallen || p.type === 'fake') continue;
    if (x > p.mesh.position.x - p.width/2 && x < p.mesh.position.x + p.width/2 &&
        z > p.mesh.position.z - p.depth/2 && z < p.mesh.position.z + p.depth/2) {
      const topY = p.mesh.position.y + 0.25;
      if (feetY >= topY - tolerance && feetY <= topY + 0.5) return { y: topY, platform: p };
    }
  }
  return null;
}

function checkWallCollision(x, z, y) {
  const radius = 0.35; const feetY = y;
  for (let p of platforms) {
    if (p.isFallen || p.type === 'fake') continue;
    const topY = p.mesh.position.y + 0.25;
    const bottomY = p.mesh.position.y - 0.25;
    if (feetY < topY - 0.1 && feetY > bottomY - 1) {
      if (x + radius > p.mesh.position.x - p.width/2 && x - radius < p.mesh.position.x + p.width/2 &&
          z + radius > p.mesh.position.z - p.depth/2 && z - radius < p.mesh.position.z + p.depth/2) return true;
    }
  }
  return false;
}

function showOverlay(title, desc, color) {
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-title').style.color = color;
  document.getElementById('overlay-desc').textContent = desc;
  document.getElementById('overlay').style.display = 'flex';
}

function updateCharacterNameSprite(username, isDev) {
  if (nameSprite) { scene.remove(nameSprite); nameSprite.material.map.dispose(); nameSprite.material.dispose(); }
  const canvasName = document.createElement('canvas');
  canvasName.width = 512; canvasName.height = 128;
  const ctxName = canvasName.getContext('2d');
  ctxName.clearRect(0, 0, canvasName.width, canvasName.height);
  ctxName.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctxName.beginPath(); ctxName.roundRect(10, 20, 492, 88, 20); ctxName.fill();
  ctxName.font = 'bold 50px sans-serif'; ctxName.fillStyle = '#ffffff'; ctxName.textAlign = 'center'; ctxName.textBaseline = 'middle';
  ctxName.fillText(username, 256, 64);
  if (isDev) {
    ctxName.beginPath(); ctxName.arc(430, 64, 28, 0, Math.PI * 2); ctxName.fillStyle = '#1DA1F2'; ctxName.fill();
    ctxName.strokeStyle = '#ffffff'; ctxName.lineWidth = 4; ctxName.stroke();
    ctxName.beginPath(); ctxName.moveTo(418, 64); ctxName.lineTo(426, 74); ctxName.lineTo(444, 54); ctxName.strokeStyle = '#ffffff'; ctxName.lineWidth = 6; ctxName.lineCap = 'round'; ctxName.lineJoin = 'round'; ctxName.stroke();
  }
  const textureName = new THREE.CanvasTexture(canvasName);
  textureName.needsUpdate = true;
  nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureName, depthTest: false, depthWrite: false }));
  nameSprite.position.set(0, 3.2, 0);
  nameSprite.scale.set(2, 0.5, 1);
  character.add(nameSprite);
}

const clock = new THREE.Clock();
let walkTime = 0;

function animate() {
  requestAnimationFrame(animate);
  if (!renderer) return;
  const delta = Math.min(clock.getDelta(), 0.1);
  const t = clock.getElapsedTime();
  if (scene && camera) renderer.render(scene, camera);

  // Animasi Berkedip pada Laser NPC
  if (laserBeam) {
    const lc = t % 2.9; // 1.2s mati -> 0.8s peringatan (garis oranye) -> 0.9s menembak
    laserState = lc < 1.2 ? 'off' : (lc < 2.0 ? 'warn' : 'fire');
    laserBeam.visible = laserState !== 'off' && !(laserState === 'warn' && Math.sin(t * 40) > 0.4);
    laserBeam.material.color.setHex(laserState === 'fire' ? 0x00ffff : 0xff5500);
    const th = laserState === 'fire' ? 1 : 0.2;
    laserBeam.scale.set(1, th, th);
  }

  for (let i = trailParticles.length - 1; i >= 0; i--) {
    let p = trailParticles[i];
    p.life -= delta;
    p.mesh.scale.multiplyScalar(1 - delta * 3);
    p.mesh.material.opacity = p.life * 1.5;
    if (p.startColor && p.endColor) {
      p.mesh.material.color.lerpColors(p.startColor, p.endColor, 1 - (p.life / 0.6));
    }
    p.mesh.position.y += delta * 1.5;
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); trailParticles.splice(i, 1); }
  }

  for (let i = jumpParticles.length - 1; i >= 0; i--) {
    let p = jumpParticles[i];
    p.life -= delta;
    p.mesh.position.x += p.mesh.userData.vx * delta;
    p.mesh.position.y += p.mesh.userData.vy * delta;
    p.mesh.position.z += p.mesh.userData.vz * delta;
    p.mesh.userData.vy -= 6 * delta;
    p.mesh.material.opacity = p.life * 1.5;
    p.mesh.scale.multiplyScalar(1 - delta * 1.5);
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); jumpParticles.splice(i, 1); }
  }

  if (gameState === 'LOBBY') {
    character.position.y = 0.25 + Math.sin(t * 2) * 0.02;
    headGroup.rotation.y = Math.sin(t * 0.5) * 0.3;
    controls.update();
    return;
  }

  if (gameState !== 'PLAYING') return;

  const speed = isRunning ? 9 : 5;
  let isMoving = false;

  platforms.forEach(p => {
    if (p.type === 'moving_x') { const nx = p.startX + Math.sin(t * p.speed + p.phase) * p.range; p.dx = nx - p.mesh.position.x; p.mesh.position.x = nx; }
    else if (p.type === 'moving_y') p.mesh.position.y = p.startY + Math.sin(t * p.speed + p.phase) * p.range;
    else if (p.type === 'fake') {
      const m = p.mesh.material;
      p.revealTimer = Math.max(0, p.revealTimer - delta);
      const glitch = p.revealTimer > 0 || ((t * 0.7 + p.phase) % 4) < 0.18; // semua kotak palsu sesekali berkedip
      m.opacity = glitch ? 0.2 + Math.random() * 0.25 : 1 - 0.45 * p.tell * (0.6 + 0.4 * Math.sin(t * 5 + p.phase));
      m.emissive.setHex(p.revealTimer > 0 ? 0xff0044 : (glitch ? 0x66ccff : 0x000000));
      m.emissiveIntensity = 0.7;
    }
  });

  const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

  const preVy = physics.velocityY;
  let nextX = character.position.x; let nextZ = character.position.z;
  let desX = 0, desZ = 0;
  if (Math.abs(joystickVector.x) > 0.1 || Math.abs(joystickVector.y) > 0.1) {
    const moveX = forward.x * joystickVector.y + right.x * joystickVector.x;
    const moveZ = forward.z * joystickVector.y + right.z * joystickVector.x;
    const len = Math.sqrt(moveX*moveX + moveZ*moveZ);
    desX = (moveX / len) * speed; desZ = (moveZ / len) * speed;
    let diff = Math.atan2(moveX, moveZ) - character.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    character.rotation.y += diff * (1 - Math.exp(-delta * 16));
    if (isRunning && Math.random() < 0.3) createTrailEffect();
  }
  const accel = 1 - Math.exp(-delta * ((desX || desZ) ? 11 : 14));
  moveVel.x += (desX - moveVel.x) * accel; moveVel.y += (desZ - moveVel.y) * accel;
  const hSpeed = moveVel.length();
  isMoving = hSpeed > 0.4;
  nextX += moveVel.x * delta; nextZ += moveVel.y * delta;

  if (!checkWallCollision(nextX, character.position.z, character.position.y)) character.position.x = nextX;
  if (!checkWallCollision(character.position.x, nextZ, character.position.y)) character.position.z = nextZ;

  const groundData = checkGroundCollision(character.position.x, character.position.z, character.position.y);
  if (groundData && physics.velocityY <= 0) {
    character.position.y = groundData.y;
    physics.velocityY = 0; physics.isGrounded = true; physics.jumpCount = 0;
    if (groundData.platform.type === 'moving_x') character.position.x += groundData.platform.dx;
  } else {
    physics.isGrounded = false;
  }

  if (!physics.isGrounded) {
    physics.velocityY += physics.gravity * delta;
    character.position.y += physics.velocityY * delta;
    const landingData = checkGroundCollision(character.position.x, character.position.z, character.position.y + 0.5);
    if (landingData && character.position.y <= landingData.y) {
      character.position.y = landingData.y; physics.velocityY = 0; physics.isGrounded = true; physics.jumpCount = 0;
    }
  }

  // CEK APAKAH TERKENA LASER NPC (Posisi Z sekitar -44 dan laser sedang menyala)
  if (physics.isGrounded && !wasGrounded && preVy < -4) { const imp = Math.min(1, -preVy / 22); sq.v = -imp * 8; spawnDust(4 + Math.round(imp * 6)); }
  wasGrounded = physics.isGrounded;

  // Kotak palsu: tembus lalu glitch merah
  platforms.forEach(p => {
    if (p.type !== 'fake' || p.revealTimer > 0) return;
    const m = p.mesh.position, ty = m.y + 0.25;
    if (Math.abs(character.position.x - m.x) < p.width / 2 && Math.abs(character.position.z - m.z) < p.depth / 2 && character.position.y < ty + 0.2 && character.position.y > ty - 1.2) {
      p.revealTimer = 1.5; showToast('👻 Kotak palsu!');
    }
  });

  // Laser hanya mengenai jika sedang menembak & kamu tidak melompatinya
  if (laserState === 'fire' && Math.abs(character.position.z - LASER_Z) < 0.5 && Math.abs(character.position.x) < 3.5 && character.position.y > 8 && character.position.y < LASER_Y + 0.25) {
    gameState = 'GAMEOVER';
    showOverlay('TERKENA LASER!', 'Putzzdev : "Kena tembak laser NPC, cupu! 💥"', '#ff3333');
  }

  // JIKA JATUH KE LAVA
  if (character.position.y < -3) {
    gameState = 'GAMEOVER'; 
    showOverlay('GAME OVER', 'Putzzdev : "Salah pilih jalan/jatuh ke lava wkwk! 😹"', '#ff3333');
  }

  // KONDISI MENANG DI PUNCAK
  if (character.position.z < -65 && character.position.y > 13) {
    gameState = 'WIN'; 
    playerData.coins = (playerData.coins || 0) + 100;
    updatePlayerFirebase();
    document.getElementById('coin-amount').textContent = playerData.coins;
    showOverlay('YOU WIN!', 'Putzzdev mengakui kamu jago melewati jebakan! +100 🪙', '#00ff00');
  }

  // ===== Animasi karakter: damping + squash & stretch + condong badan =====
  const k = 1 - Math.exp(-delta * 14);
  const damp = (o, key, v) => { o[key] += (v - o[key]) * k; };
  const runK = THREE.MathUtils.clamp((hSpeed - 5) / 4, 0, 1);
  sq.v += (-sq.x * 220 - sq.v * 14) * delta; sq.x += sq.v * delta;
  let bob = 0, lean = 0, twist = 0, sway = 0;
  let lH = 0, rH = 0, lK = 0, rK = 0, lA = 0, rA = 0, lE = -0.15, rE = -0.15, armZ = 0.1, headY = 0;

  if (!physics.isGrounded) {
    const up = physics.velocityY > 0;
    lH = up ? -0.9 : -0.4; rH = up ? 0.3 : 0.5; lK = up ? 1.0 : 0.4; rK = up ? 0.3 : 0.7;
    lA = rA = up ? -1.7 : -1.0; lE = rE = -0.5; armZ = up ? 0.5 : 0.8;
    lean = 0.1 + THREE.MathUtils.clamp(-physics.velocityY * 0.004, -0.1, 0.12);
  } else if (isMoving) {
    walkTime += delta * hSpeed * 1.7;
    const s = Math.sin(walkTime), c = Math.cos(walkTime), amp = 0.55 + runK * 0.4;
    lH = s * amp; rH = -s * amp;
    lK = Math.max(0, -c) * (0.7 + runK * 0.8) + 0.08; rK = Math.max(0, c) * (0.7 + runK * 0.8) + 0.08;
    lA = -s * amp * 0.9; rA = s * amp * 0.9;
    lE = -(0.25 + runK * 0.9) - Math.max(0, s) * 0.3; rE = -(0.25 + runK * 0.9) - Math.max(0, -s) * 0.3;
    bob = Math.abs(s) * (0.05 + runK * 0.05); lean = 0.06 + runK * 0.2; twist = -s * (0.12 + runK * 0.1); sway = s * 0.04; armZ = 0.12;
    headY = -twist * 0.8;
  } else {
    const br = Math.sin(t * 2.2); // idle: napas, goyang pelan, kepala melirik
    bob = br * 0.008; lA = Math.sin(t * 1.3) * 0.04; rA = -lA; armZ = 0.1 + br * 0.015;
    lE = rE = -0.12; sway = Math.sin(t * 0.8) * 0.015; headY = Math.sin(t * 0.5) * 0.35;
  }
  damp(leftLegPivot.rotation, 'x', lH); damp(rightLegPivot.rotation, 'x', rH);
  damp(leftKnee.rotation, 'x', lK); damp(rightKnee.rotation, 'x', rK);
  damp(leftArmPivot.rotation, 'x', lA); damp(rightArmPivot.rotation, 'x', rA);
  damp(leftElbow.rotation, 'x', lE); damp(rightElbow.rotation, 'x', rE);
  damp(leftArmPivot.rotation, 'z', -armZ); damp(rightArmPivot.rotation, 'z', armZ);
  damp(headGroup.rotation, 'y', headY);
  damp(rig.position, 'y', bob); damp(rig.rotation, 'x', lean); damp(rig.rotation, 'y', twist); damp(rig.rotation, 'z', sway);
  const air = physics.isGrounded ? 0 : THREE.MathUtils.clamp(physics.velocityY / 13, -1, 1) * 0.1;
  const st = THREE.MathUtils.clamp(sq.x + air, -0.35, 0.35);
  rig.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5);
  camera.fov += ((60 + runK * 8) - camera.fov) * k * 0.5; camera.updateProjectionMatrix();
  if (embers) { const ep = embers.geometry.attributes.position; for (let i = 0; i < ep.count; i++) { let y = ep.getY(i) + delta * 1.5; if (y > 22) y = -8; ep.setY(i, y); } ep.needsUpdate = true; }

  const targetPos = character.position.clone(); targetPos.y += 1.5;
  controls.target.lerp(targetPos, 0.1);
  const camDir = camera.position.clone().sub(controls.target).normalize();
  const desiredCamPos = controls.target.clone().add(camDir.multiplyScalar(8));
  if (desiredCamPos.y < character.position.y + 2) desiredCamPos.y = character.position.y + 2;
  camera.position.lerp(desiredCamPos, 0.1);
  controls.update();

  lavaMat.color.setHSL(0.03 + Math.sin(t * 2) * 0.02, 1, 0.5);
}

window.addEventListener('resize', () => {
  if (camera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});