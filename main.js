import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buatLabirin } from './dunia.js'; // IMPORT FILE LABIRIN

// ============ 1. KONFIGURASI FIREBASE ============
const FIREBASE_URL = "https://game3d-66134-default-rtdb.asia-southeast1.firebasedatabase.app/";
const DEV_USERNAME = "putzzdev"; 

let playerData = { 
  username: "", 
  isDev: false, 
  coins: 0, 
  inventory: ['baju_default', 'celana_default', 'sepatu_default', 'efek_lari_default', 'efek_lompat_default', 'aks_none'],
  equipped: {
    baju: 'baju_default',
    celana: 'celana_default',
    sepatu: 'sepatu_default',
    efek_lari: 'efek_lari_default',
    efek_lompat: 'efek_lompat_default',
    aksesoris: 'aks_none'
  }
};

let gameState = 'LOGIN'; 
let isGameStarted = false; 

const SHOP_ITEMS = {
  baju: [
    { id: 'baju_default', name: 'Baju Biru Tua', price: 0, color: 0x2c3e50 },
    { id: 'baju_merah', name: 'Baju Merah', price: 150, color: 0xff0000 },
    { id: 'baju_hijau', name: 'Baju Hijau', price: 150, color: 0x00ff00 },
    { id: 'baju_emas', name: 'Baju Emas', price: 300, color: 0xffd700 },
    { id: 'baju_spiderman', name: 'Kostum Spiderman', price: 500, color: 0xd91e2b, web: true }
  ],
  celana: [
    { id: 'celana_default', name: 'Celana Hitam', price: 0, color: 0x1a1a1c },
    { id: 'celana_biru', name: 'Celana Jeans', price: 150, color: 0x1e3a8a },
    { id: 'celana_putih', name: 'Celana Putih', price: 150, color: 0xffffff },
    { id: 'celana_spiderman', name: 'Celana Spiderman', price: 250, color: 0x1d3f9a, web: true }
  ],
  sepatu: [
    { id: 'sepatu_default', name: 'Sepatu Merah', price: 0, color: 0xa61c2b },
    { id: 'sepatu_neon', name: 'Sepatu Neon', price: 200, color: 0x00ffcc },
    { id: 'sepatu_emas', name: 'Sepatu Emas', price: 400, color: 0xffd700 },
    { id: 'sepatu_spiderman', name: 'Sepatu Spiderman', price: 250, color: 0xc4122f }
  ],
  efek: [
    { id: 'efek_lari_default', name: 'Tanpa Efek Lari', price: 0, type: 'lari' },
    { id: 'efek_lari_api', name: 'Jejak Api', price: 300, type: 'lari', color: 0xff3300 },
    { id: 'efek_lompat_default', name: 'Tanpa Efek Lompat', price: 0, type: 'lompat' },
    { id: 'efek_lompat_es', name: 'Ledakan Es', price: 300, type: 'lompat', color: 0x00ffff }
  ],
  aksesoris: [
    { id: 'aks_none', name: 'Tanpa Aksesoris', price: 0 },
    { id: 'aks_topeng_spider', name: 'Topeng Spiderman', price: 400 },
    { id: 'aks_kacamata', name: 'Kacamata Hitam', price: 150 },
    { id: 'aks_topi', name: 'Topi Merah', price: 200 },
    { id: 'aks_mahkota', name: 'Mahkota Emas', price: 500 },
    { id: 'aks_jubah', name: 'Jubah Merah', price: 350 }
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
    const firstTab = document.querySelector('.shop-tab-btn');
    if (firstTab && !document.querySelector('.shop-tab-btn[data-cat="aksesoris"]')) {
      const tb = firstTab.cloneNode(true); tb.dataset.cat = 'aksesoris'; tb.textContent = '🎩 Aksesoris'; tb.classList.remove('active');
      tb.addEventListener('click', (e) => { document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active'); renderShopTab('aksesoris'); });
      firstTab.parentNode.appendChild(tb);
    }
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
  if (!playerData.inventory.includes('aks_none')) playerData.inventory.push('aks_none');
  if (!playerData.equipped.aksesoris) playerData.equipped.aksesoris = 'aks_none';
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
    
    const previewHTML = `<div class="color-preview" style="background:#2a2f45;border-radius:14px;display:flex;align-items:center;justify-content:center">${itemIcon(category, item)}</div>`;

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
const webTexCache = {};
function getWebTex(hex) {
  if (webTexCache[hex]) return webTexCache[hex];
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#' + hex.toString(16).padStart(6, '0'); x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); }
  for (let j = 0; j < 256; j += 32) for (let i = 0; i < 256; i += 64) { x.beginPath(); x.moveTo(i, j); x.quadraticCurveTo(i + 32, j + 10, i + 64, j); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return (webTexCache[hex] = t);
}

function makeSpiderLogoTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.strokeStyle = '#111'; x.fillStyle = '#111'; x.lineWidth = 6; x.lineCap = 'round';
  for (const s of [-1, 1]) for (const [ex, ey] of [[48, -44], [58, -14], [58, 16], [46, 46]]) {
    x.beginPath(); x.moveTo(64, 66); x.quadraticCurveTo(64 + s * ex * 0.5, 66 + ey - 14, 64 + s * ex, 66 + ey); x.stroke();
  }
  x.beginPath(); x.ellipse(64, 74, 11, 22, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(64, 46, 8, 0, Math.PI * 2); x.fill();
  return new THREE.CanvasTexture(c);
}

const ACC_ICONS = {
  aks_none: '<circle cx="32" cy="32" r="20" fill="none" stroke="#888" stroke-width="4"/><path d="M18 46L46 18" stroke="#888" stroke-width="4"/>',
  aks_topeng_spider: '<circle cx="32" cy="32" r="24" fill="#d91e2b"/><path d="M32 8V56M9 32H55M14 16Q32 24 50 16M14 48Q32 40 50 48" stroke="rgba(0,0,0,.45)" stroke-width="1" fill="none"/><path d="M13 27Q21 19 29 31Q20 37 13 27Z" fill="#fff" stroke="#111" stroke-width="2"/><path d="M51 27Q43 19 35 31Q44 37 51 27Z" fill="#fff" stroke="#111" stroke-width="2"/>',
  aks_kacamata: '<rect x="6" y="24" width="22" height="14" rx="4" fill="#111"/><rect x="36" y="24" width="22" height="14" rx="4" fill="#111"/><path d="M28 29H36" stroke="#111" stroke-width="3"/>',
  aks_topi: '<path d="M12 40Q12 14 34 14Q54 14 54 40Z" fill="#e53935"/><path d="M30 40H62Q62 47 50 47H30Z" fill="#b71c1c"/>',
  aks_mahkota: '<path d="M8 48L12 18L24 32L32 14L40 32L52 18L56 48Z" fill="#ffd700" stroke="#b8860b" stroke-width="2" stroke-linejoin="round"/>',
  aks_jubah: '<path d="M20 8H44L54 56Q32 48 10 56Z" fill="#c0132b" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>'
};
const SHAPES = {
  baju: 'M20 8 L8 16 L13 27 L19 24 L19 56 L45 56 L45 24 L51 27 L56 16 L44 8 Q32 16 20 8 Z',
  celana: 'M18 8 H46 L50 56 H35 L32 28 L29 56 H14 Z',
  sepatu: 'M8 34 H27 L33 26 H42 L44 34 Q58 36 58 46 V52 H8 Z'
};
function itemIcon(cat, it) {
  let inner = '';
  if (SHAPES[cat]) {
    const col = '#' + it.color.toString(16).padStart(6, '0'), d = SHAPES[cat];
    inner = `<defs><clipPath id="cp-${it.id}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${col}" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-linejoin="round"/>`;
    if (it.web) inner += `<g clip-path="url(#cp-${it.id})" stroke="rgba(0,0,0,.5)" stroke-width=".8" fill="none"><path d="M32 4V60M20 4V60M44 4V60M8 4V60M56 4V60M4 16Q32 24 60 16M4 28Q32 36 60 28M4 40Q32 48 60 40M4 52Q32 60 60 52"/></g>`;
    if (it.web && cat === 'baju') inner += '<g stroke="#111" stroke-width="1.6" fill="#111" stroke-linecap="round"><ellipse cx="32" cy="35" rx="2.6" ry="5"/><circle cx="32" cy="28.5" r="1.8"/><path fill="none" d="M32 33L24 28M32 35L23 35M32 37L24 42M32 38L25 46M32 33L40 28M32 35L41 35M32 37L40 42M32 38L39 46"/></g>';
  } else if (cat === 'aksesoris') inner = ACC_ICONS[it.id] || '';
  else inner = `<text x="32" y="44" font-size="34" text-anchor="middle">${it.id.includes('api') ? '🔥' : (it.id.includes('_es') ? '❄️' : '✨')}</text>`;
  return `<svg viewBox="0 0 64 64" style="width:80%;height:80%">${inner}</svg>`;
}

function updateCharacterVisuals() {
  if (!character) return;
  const pick = (cat, def) => SHOP_ITEMS[cat].find(i => i.id === playerData.equipped[cat]) || SHOP_ITEMS[cat].find(i => i.id === def);
  const ap = (child, item) => { const m = child.material; m.map = item.web ? getWebTex(item.color) : null; m.color.setHex(item.web ? 0xffffff : item.color); m.needsUpdate = true; };
  const baju = pick('baju', 'baju_default'), celana = pick('celana', 'celana_default'), sepatu = pick('sepatu', 'sepatu_default');
  character.traverse((child) => {
    if (!child.isMesh) return;
    if (child.userData.type === 'baju') ap(child, baju);
    if (child.userData.type === 'celana') ap(child, celana);
    if (child.userData.type === 'sepatu') ap(child, sepatu);
  });
  if (spiderLogoGrp) spiderLogoGrp.visible = baju.id === 'baju_spiderman';
  const a = playerData.equipped.aksesoris || 'aks_none';
  Object.keys(acc).forEach(id => { acc[id].visible = id === a; });
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
let laserBeam = null; 
let rig, leftElbow, rightElbow, leftKnee, rightKnee, embers;
let sq = { x: 0, v: 0 }, moveVel = new THREE.Vector2(0, 0), wasGrounded = true, laserState = 'off';
const LASER_Z = -44, LASER_Y = 9.3;
let FIN_Y = 1e9, FINISH_Z = -100, checkpoint = { p: null, set: false, x: 0, y: 0.25, z: 0 };
let hazards = [], hitCD = 0, capePivot, spiderLogoGrp, acc = {};
const knock = new THREE.Vector2();
let flyMode = false, godMode = false, flyUp = false, flyDown = false, flySpeed = 14;

function respawn() {
  character.position.set(checkpoint.x, checkpoint.y + 0.3, checkpoint.z);
  physics.velocityY = 0; moveVel.set(0, 0); knock.set(0, 0); gameState = 'PLAYING';
  document.getElementById('overlay').style.display = 'none';
}

// ===== ADMIN PANEL =====
function setupAdminPanel() {
  if (playerData.username.toLowerCase() !== DEV_USERNAME || document.getElementById('admin-btn')) return;
  const css = document.createElement('style');
  css.textContent = '#admin-btn,#admin-panel,#fly-ctrl{position:fixed;z-index:9999;font-family:sans-serif}#admin-btn{top:10px;right:10px;padding:8px 12px;border:0;border-radius:10px;background:#ff3366;color:#fff;font-weight:700}#admin-panel{top:52px;right:10px;width:210px;padding:12px;border-radius:12px;background:rgba(15,15,25,.92);color:#fff;display:none;flex-direction:column;gap:8px;font-size:13px}#admin-panel button{padding:8px;border:0;border-radius:8px;background:#2d3550;color:#fff}#admin-panel button.on{background:#00b86b}#fly-ctrl{right:14px;top:45%;display:none;flex-direction:column;gap:10px}#fly-ctrl button{width:56px;height:56px;border-radius:50%;border:0;background:rgba(255,255,255,.25);color:#fff;font-size:24px}';
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'admin-btn'; btn.textContent = '🛠️ Admin';
  const panel = document.createElement('div'); panel.id = 'admin-panel';
  panel.innerHTML = '<b>Admin Panel - Putzzdev</b><button id="ad-fly">✈️ Terbang: OFF (F)</button><label>Kecepatan: <span id="ad-spd">14</span><input id="ad-speed" type="range" min="5" max="40" value="14" style="width:100%"></label><button id="ad-god">🛡️ Anti-mati: OFF</button><button data-tp="start">📍 Ke Start</button><button data-tp="hub">📍 Ke Hub Tower</button><button data-tp="labirin">📍 Ke Labirin</button><button id="ad-coin">🪙 +1000 Koin</button>';
  const fc = document.createElement('div'); fc.id = 'fly-ctrl';
  fc.innerHTML = '<button id="fly-up">▲</button><button id="fly-down">▼</button>';
  document.body.append(btn, panel, fc);

  btn.onclick = () => { panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; };
  const setFly = (v) => {
    flyMode = v; fc.style.display = v ? 'flex' : 'none'; flyUp = flyDown = false; physics.velocityY = 0;
    const b = document.getElementById('ad-fly'); b.classList.toggle('on', v); b.textContent = '✈️ Terbang: ' + (v ? 'ON' : 'OFF') + ' (F)';
  };
  document.getElementById('ad-fly').onclick = () => setFly(!flyMode);
  document.getElementById('ad-speed').oninput = (e) => { flySpeed = +e.target.value; document.getElementById('ad-spd').textContent = flySpeed; };
  document.getElementById('ad-god').onclick = (e) => { godMode = !godMode; e.target.classList.toggle('on', godMode); e.target.textContent = '🛡️ Anti-mati: ' + (godMode ? 'ON' : 'OFF'); };
  panel.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => {
    const tp = b.dataset.tp;
    if (tp === 'start') character.position.set(0, 0.25, 0);
    if (tp === 'hub') character.position.set(0, 13.75, -68);
    if (tp === 'labirin') character.position.set(0, 25, -85); // Ketinggian puncak tower
    physics.velocityY = 0; moveVel.set(0, 0);
    if (gameState === 'GAMEOVER') { gameState = 'PLAYING'; document.getElementById('overlay').style.display = 'none'; }
  });
  document.getElementById('ad-coin').onclick = () => {
    playerData.coins = (playerData.coins || 0) + 1000; updatePlayerFirebase();
    document.getElementById('coin-amount').textContent = playerData.coins; showToast('🪙 +1000 koin');
  };
  const hold = (id, up) => {
    const el = document.getElementById(id), set = (v) => { if (up) flyUp = v; else flyDown = v; };
    el.onpointerdown = () => set(true);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => set(false)));
  };
  hold('fly-up', true); hold('fly-down', false);
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyF' && gameState === 'PLAYING') setFly(!flyMode);
    if (e.code === 'Space') flyUp = true;
    if (e.code.startsWith('Shift')) flyDown = true;
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') flyUp = false; if (e.code.startsWith('Shift')) flyDown = false; });
}

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
  const trapMat = new THREE.MeshStandardMaterial({ color: 0xff0055, roughness: 0.5 });

  function createPlatform(x, y, z, width, depth, type = 'static', tell = 0, shape = 'box') {
    const height = 0.5;
    const geo = shape === 'box' ? new THREE.BoxGeometry(width, height, depth) : new THREE.CylinderGeometry(width / 2, width / 2, height, shape === 'hex' ? 6 : 32);
    const base = shape === 'round' ? roundMat : (shape === 'hex' ? hexMat : platformMat);
    let mat = base;
    if (type.includes('moving')) mat = movingMat;
    if (type === 'fake') { mat = base.clone(); mat.transparent = true; }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true; mesh.castShadow = true;
    scene.add(mesh);

    platforms.push({ 
      mesh, width, depth, type, 
      startX: x, startY: y, startZ: z, 
      range: 2.5, speed: 1.5, phase: Math.random() * Math.PI * 2, 
      isFallen: false, tell, revealTimer: 0, dx: 0, r: shape === 'round' ? width / 2 : (shape === 'hex' ? width * 0.45 : 0) 
    });
  }

  const roundMat = new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.6 });
  const hexMat = new THREE.MeshStandardMaterial({ color: 0x5a3a7a, roughness: 0.6 });
  const hazMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xe02030, emissive: 0x551018, roughness: 0.5 });

  // Palang berputar
  function addSweeper(cx, py, cz, len, speed) {
    const barY = py + 0.25 + 0.65;
    const g = new THREE.Group(); g.position.set(cx, barY, cz); scene.add(g);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.65, 16), hazMat); post.position.y = -0.325; g.add(post);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, len, 12), redMat); bar.rotation.z = Math.PI / 2; g.add(bar);
    for (const sd of [-1, 1]) { const capE = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), hazMat); capE.position.x = sd * len / 2; g.add(capE); }
    let a = 0;
    hazards.push({
      update(t) { a = t * speed; g.rotation.y = -a; },
      test(pp) {
        const dx = pp.x - cx, dz = pp.z - cz, c = Math.cos(a), sn = Math.sin(a);
        const along = dx * c + dz * sn, perp = -dx * sn + dz * c;
        if (Math.abs(along) < len / 2 + 0.2 && Math.abs(perp) < 0.5 && pp.y < barY + 0.2 && pp.y + 1.9 > barY - 0.2) { const sg = perp >= 0 ? 1 : -1; return { x: -sn * sg, z: c * sg }; }
        return null;
      }
    });
  }

  // Bola berduri
  function addPendulum(px, py, pz, axis, L = 4.4) {
    const pivotY = py + 0.25 + L + 0.8;
    const g = new THREE.Group(); g.position.set(px, pivotY, pz); scene.add(g);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, L, 6), hazMat); rope.position.y = -L / 2; g.add(rope);
    const ball = new THREE.Group(); ball.position.y = -L; g.add(ball);
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.6, roughness: 0.4 })));
    for (let i = 0; i < 14; i++) {
      const yy = 1 - (i / 13) * 2, rr = Math.sqrt(1 - yy * yy), ang = i * 2.399963;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 8), redMat);
      const dir = new THREE.Vector3(Math.cos(ang) * rr, yy, Math.sin(ang) * rr);
      sp.position.copy(dir).multiplyScalar(0.72); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); ball.add(sp);
    }
    let th = 0;
    hazards.push({
      update(t) { th = 0.85 * Math.sin(t * 1.6 + px); if (axis === 'x') g.rotation.z = th; else g.rotation.x = -th; },
      test(pp) {
        const bx = px + (axis === 'x' ? L * Math.sin(th) : 0), by = pivotY - L * Math.cos(th), bz = pz + (axis === 'z' ? L * Math.sin(th) : 0);
        const cy = Math.min(Math.max(by, pp.y + 0.2), pp.y + 1.7);
        if (Math.hypot(pp.x - bx, cy - by, pp.z - bz) < 1.0) { const hx = pp.x - bx, hz = pp.z - bz, l = Math.hypot(hx, hz) || 1; return { x: hx / l, z: hz / l }; }
        return null;
      }
    });
  }

  // ============ JALUR PARKOUR ============
  createPlatform(0, 0, 0, 8, 8, 'static');         
  createPlatform(0, 1.5, -8, 5, 5, 'static', 0, 'round'); addPendulum(0, 1.5, -8, 'x');
  
  createPlatform(-2.5, 3, -15, 3.5, 3.5, 'fake', 0.9);  
  createPlatform(2.5, 3, -15, 3.5, 3.5, 'static');       

  createPlatform(0, 4.5, -22, 6, 6, 'moving_x', 0, 'hex'); addPendulum(0, 4.5, -22, 'z');

  createPlatform(-2.5, 6, -29, 3.5, 3.5, 'static');      
  createPlatform(2.5, 6, -29, 3.5, 3.5, 'fake', 0.6); 

  createPlatform(-3.5, 7.5, -36, 3, 5, 'static');
  createPlatform(0, 7.5, -36, 3, 5, 'fake', 0.4);
  createPlatform(3.5, 7.5, -36, 3, 5, 'fake', 0.4);
  
  createPlatform(0, 9, -44, 6, 6, 'static');
  
  const laserGeo = new THREE.BoxGeometry(7, 0.2, 0.2);
  const laserMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  laserBeam = new THREE.Mesh(laserGeo, laserMat);
  laserBeam.position.set(0, 9.3, -44);
  scene.add(laserBeam);
  [-3.6, 3.6].forEach(ex => {
    const em = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x222233, emissive: 0x00ffff, emissiveIntensity: 0.6 }));
    em.position.set(ex, 9.6, LASER_Z); scene.add(em);
  });

  createPlatform(0, 10.5, -52, 5, 5, 'moving_y', 0, 'round');
  createPlatform(-2, 12, -58, 3.2, 2.5, 'static'); createPlatform(2, 12, -58, 3.2, 2.5, 'fake', 0.15);
  createPlatform(-2, 12, -61.5, 3.2, 2.5, 'fake', 0.05); createPlatform(2, 12, -61.5, 3.2, 2.5, 'static');
  createPlatform(0, 13.5, -68, 8, 8, 'static');
  const checkMat = new THREE.MeshStandardMaterial({ color: 0x22aa55, emissive: 0x22aa55, emissiveIntensity: 0.4 });
  const markCheckpoint = () => { const c = platforms[platforms.length - 1]; c.checkpoint = true; c.mesh.material = checkMat; };
  markCheckpoint(); 

  // ===== TOWER SPIRAL =====
  const TC = { x: 0, z: -77 }, TR = 9, TN = 29, TDY = 1.1, TDA = 0.55;
  let ty = 13.5, ta = Math.PI / 2;
  const SH = ['box', 'round', 'hex'];
  for (let i = 1; i <= TN; i++) {
    ta += TDA; ty += TDY;
    const rx = Math.cos(ta), rz = Math.sin(ta), cx = TC.x + rx * TR, cz = TC.z + rz * TR;
    const tell = Math.max(0.05, 0.5 - i * 0.015);
    const sh = SH[i % 3], w = sh === 'box' ? 3.2 : 3.6;
    if (i % 5 === 0) {
      const realOut = (i / 5) % 2 === 0;
      createPlatform(TC.x + rx * (TR + 2.8), ty, TC.z + rz * (TR + 2.8), w, w, realOut ? 'static' : 'fake', tell, sh);
      createPlatform(TC.x + rx * (TR - 2.8), ty, TC.z + rz * (TR - 2.8), w, w, realOut ? 'fake' : 'static', tell, sh);
    } else if (i % 8 === 0) {
      createPlatform(cx, ty, cz, 4, 4, 'static', 0, 'round'); markCheckpoint();
    } else if (i % 11 === 6) {
      createPlatform(cx, ty, cz, 5.4, 5.4, 'static', 0, 'round'); addSweeper(cx, ty, cz, 4.6, 1.5 + i * 0.01);
    } else if (i % 7 === 3) {
      createPlatform(cx, ty, cz, w, w, 'moving_y', 0, sh); platforms[platforms.length - 1].range = 0.9;
    } else {
      createPlatform(cx, ty, cz, w, w, 'static', 0, sh);
    }
  }
  createPlatform(TC.x + Math.cos(ta) * 6.3, ty + 0.55, TC.z + Math.sin(ta) * 6.3, 3, 3, 'static'); // penghubung
  
  const FY = ty + 1.1; 
  createPlatform(TC.x, FY, TC.z, 8, 8, 'static'); // PUNCAK TOWER
  
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, FY - 12.25, 16), new THREE.MeshStandardMaterial({ color: 0x2a2a3a }));
  pillar.position.set(TC.x, (12 + FY - 0.25) / 2, TC.z); scene.add(pillar);

  // ============ PANGGIL LABIRIN DI SINI ============
  // Titik start labirin ada di depan puncak tower
  const finisLabirin = buatLabirin(scene, platforms, TC.x, FY + 0.25, TC.z - 4);
  
  // Timpa FIN_Y dan FINISH_Z agar main.js tahu batas kemenangannya
  FIN_Y = finisLabirin.y;
  FINISH_Z = finisLabirin.z;

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

  // (Sisa pembuatan karakter 3D, animasi, dan kamera tetap SAMA seperti kode asli kamu)
  // ...
  
  // Karena ini kode panjang, sisa kode di bawah ini sama persis dengan yang kamu punya
  // dari pembuatan lengan, kaki, rig, aksesoris, updateCharacterVisuals(), controls, joystick,
  // dan fungsi animate().

  // TAPI, pastikan di dalam animate() kamu menambahkan logika cek menang:
  // if (character.position.y > FIN_Y - 0.5 && Math.abs(character.position.z - FINISH_Z) < 4.5) { ... }
}