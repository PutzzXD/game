import * as THREE from 'three';
import { buildSnowWorld } from './snow.js';
import { buildAngkasaWorld } from './angkasa.js';
import { buildMountainWorld } from './mountain.js';
import { buildHoneyWorld } from './honey.js';
import { buildLaserWorld } from './laser.js';
import { buildLavaLandWorld, showLavaLandIntro } from './lavaland.js';
import './lobbyui.js'; // tema tombol & HUD lobby
import { buildLavaMap, updateLavaMap } from './lava.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getDatabase, ref, set, get, update, onValue, onDisconnect, remove } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';

// Firebase multiplayer: memakai project PARKOUR 3D yang sudah terdaftar.
const firebaseConfig = {
  apiKey: 'AIzaSyB7ue_o-x-QSc92vR6Zu5sCEAJiGt6QUeU',
  authDomain: 'game3d-66134.firebaseapp.com',
  databaseURL: 'https://game3d-66134-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'game3d-66134',
  storageBucket: 'game3d-66134.firebasestorage.app',
  messagingSenderId: '229970848153',
  appId: '1:229970848153:web:13c9626e65a84c6c300b08'
};
const firebaseApp = initializeApp(firebaseConfig);
const multiplayerAuth = getAuth(firebaseApp);
const multiplayerDb = getDatabase(firebaseApp);

// ===== Helper aman: tidak crash kalau elemen tidak ada di HTML =====
function setElDisplay(id, value) { const el = document.getElementById(id); if (el) el.style.display = value; }
function hideStartupSplash() {
  const s = document.getElementById('startup-loading');
  if (!s) return;
  s.classList.add('is-hidden');
  s.style.pointerEvents = 'none';
  setTimeout(() => { try { s.remove(); } catch (e) { s.style.display = 'none'; } }, 500);
}
// Pengaman terakhir: apa pun yang terjadi, splash awal pasti hilang maksimal 15 detik.
setTimeout(hideStartupSplash, 15000);


// ============ EFEK SUARA (WEB AUDIO API) ============
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function ensureAudioContext() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playJumpSound() {
  try {
    ensureAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {}
}

function playStepSound() {
  try {
    ensureAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.07);
  } catch (e) {}
}

// ============ BACKGROUND MUSIC + VAULT MUSIC SELECTOR ============
const vaultMusicTracks = {
  amatekam: './putzzdev.mp3',
  luklukluk: './putzzdev2.mp3'
};
let selectedVaultMusic = 'amatekam';
const backgroundMusic = new Audio(vaultMusicTracks[selectedVaultMusic]);
backgroundMusic.loop = true;
backgroundMusic.preload = 'auto';
backgroundMusic.volume = 0.35;

let backgroundMusicStarted = false;
let userPausedMusic = false;
function startBackgroundMusic() {
  if (userPausedMusic || !backgroundMusic.paused) return;
  const playAttempt = backgroundMusic.play();
  if (playAttempt && typeof playAttempt.then === 'function') {
    playAttempt.then(() => {
      backgroundMusicStarted = true;
    }).catch(() => {
      // Autoplay mungkin diblokir sampai ada interaksi pemain.
    });
  }
}

window.getSelectedVaultMusic = function() {
  return selectedVaultMusic;
};
window.isVaultMusicPlaying = function() {
  return !backgroundMusic.paused;
};
window.toggleVaultMusic = function() {
  if (backgroundMusic.paused) {
    userPausedMusic = false;
    const p = backgroundMusic.play();
    if (p && typeof p.then === 'function') p.then(() => { backgroundMusicStarted = true; }).catch(() => {});
  } else {
    userPausedMusic = true;
    backgroundMusic.pause();
  }
  if (document.getElementById('music-modal')?.style.display === 'block') renderStandaloneMusic();
};
window.getVaultMusicVolume = function() { return backgroundMusic.volume; };
window.setVaultMusicVolume = function(v) { backgroundMusic.volume = Math.max(0, Math.min(1, Number(v) || 0)); };
window.selectVaultMusic = function(trackId) {
  if (!Object.prototype.hasOwnProperty.call(vaultMusicTracks, trackId)) return;
  const shouldPlay = true;
  userPausedMusic = false;
  selectedVaultMusic = trackId;
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  backgroundMusic.src = vaultMusicTracks[trackId];
  backgroundMusic.load();
  backgroundMusicStarted = false;
  if (shouldPlay) {
    const playAttempt = backgroundMusic.play();
    if (playAttempt && typeof playAttempt.then === 'function') {
      playAttempt.then(() => {
        backgroundMusicStarted = true;
      }).catch(() => {
        // Browser dapat memblokir autoplay; interaksi berikutnya akan mencoba lagi.
      });
    }
  }
  const activeTab = document.querySelector('.vault-tab-btn.active');
  if (document.getElementById('music-modal')?.style.display === 'block') renderStandaloneMusic();
  if (typeof showToast === 'function') {
    showToast('🎵 Memutar ' + (trackId === 'amatekam' ? 'Amatekam' : 'Luk Luk Luk'));
  }
};

document.addEventListener('DOMContentLoaded', startBackgroundMusic, { once: true });
document.addEventListener('pointerdown', startBackgroundMusic, { capture: true });
document.addEventListener('keydown', startBackgroundMusic, { capture: true });

// ============ 1. KONFIGURASI FIREBASE ============
const FIREBASE_URL = "https://game3d-66134-default-rtdb.asia-southeast1.firebasedatabase.app/";
const DEV_USERNAME = "putzzdev";
const ADMIN_PLAYER_ID = "123456";
// Nilai mahkota akun admin dibuat konsisten antara profil dan leaderboard.
const ADMIN_FIXED_CROWNS = 9999999;

// ID dibuat oleh sistem, bukan dari input pemain.
async function createUniquePlayerId() {
  const res = await fetch(`${FIREBASE_URL}players.json`);
  if (!res.ok) throw new Error('Tidak bisa memeriksa ID pemain');
  const players = await res.json() || {};
  const used = new Set(Object.values(players).map(p => String(p?.playerId || '')).filter(Boolean));
  for (let i = 0; i < 80; i++) {
    const id = String(Math.floor(100000 + Math.random() * 900000));
    if (id !== ADMIN_PLAYER_ID && !used.has(id)) return id;
  }
  throw new Error('Gagal membuat ID unik. Coba lagi.');
}

async function ensurePlayerId(userKey, data) {
  const isAdmin = userKey === DEV_USERNAME;
  const playerId = isAdmin ? ADMIN_PLAYER_ID : (!data.playerId || String(data.playerId) === ADMIN_PLAYER_ID ? await createUniquePlayerId() : String(data.playerId));
  if (String(data.playerId || '') !== playerId || !!data.isDev !== isAdmin) {
    await fetch(`${FIREBASE_URL}players/${userKey}.json`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, isDev: isAdmin })
    });
  }
  return { ...data, playerId, isDev: isAdmin };
} 

let playerData = { 
  username: "", 
  isDev: false, 
  coins: 0,
  crowns: 0,
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
    { id: 'baju_spiderman', name: 'Kostum Spiderman', price: 1500, color: 0xd91e2b, web: true },
    { id: 'baju_batman', name: 'Kostum Batman', price: 1600, color: 0x2b2f3a, bat: true, suit: 'bat' },
    { id: 'baju_ironman', name: 'Kostum Ironman', price: 8000, color: 0xb01020, iron: true },
    { id: 'baju_thor', name: 'Kostum Thor', price: 3000, color: 0x3b4252, thor: true, suit: 'mail' },
    { id: 'baju_hulk', name: 'Kostum Hulk', price: 3500, color: 0x57b84a, hulk: true },
    { id: 'baju_ultraman', name: 'Kostum Ultraman', price: 4500, color: 0xd9e0e8, ultra: true, suit: 'mail' },
    { id: 'baju_godzilla', name: 'Kostum Godzilla', price: 5000, color: 0x315b42, godzilla: true },
    { id: 'baju_ramenraider', name: 'Kostum Ramen Raider', price: 4000, color: 0xd98a32, ramen: true },
    { id: 'baju_saitama', name: 'Kostum Saitama — One Punch Man', price: 12000, color: 0xffd21a, saitama: true },
    { id: 'baju_greenlantern', name: 'Kostum Green Lantern', price: 6500, color: 0x087d3b, greenlantern: true },
    { id: 'baju_sonic', name: 'Kostum Sonic', price: 7500, color: 0x1d5fd1, sonic: true },
    { id: 'baju_venom', name: 'Kostum Venom', price: 10000, color: 0x0a0c14, venom: true },
    { id: 'baju_flash', name: 'Kostum The Flash', price: 10000, color: 0xc1121f, flash: true },
    { id: 'baju_ghost', name: 'Kostum Ghost Rider', price: 25000, color: 0x131318, ghost: true, suit: 'leather' },
    { id: 'baju_naruto', name: 'Kostum Naruto', price: 30000, color: 0xe8761a, naruto: true },
    { id: 'baju_luffy', name: 'Kostum Luffy', price: 35000, color: 0xd8262e, luffy: true },
    { id: 'baju_gojo', name: 'Kostum Gojo Satoru', price: 45000, color: 0x1c2238, gojo: true },
    { id: 'baju_developer', name: 'DEVELOPER — Eksklusif Admin', price: 0, color: 0x101b35, dev: true, suit: 'mail' }
  ],
  celana: [
    { id: 'celana_default', name: 'Celana Hitam', price: 0, color: 0x1a1a1c },
    { id: 'celana_biru', name: 'Celana Jeans', price: 150, color: 0x1e3a8a },
    { id: 'celana_putih', name: 'Celana Putih', price: 150, color: 0xffffff },
    { id: 'celana_spiderman', name: 'Celana Spiderman', price: 250, color: 0x1d3f9a, web: true },
    { id: 'celana_batman', name: 'Celana Batman', price: 250, color: 0x23252e }
  ],
  sepatu: [
    { id: 'sepatu_default', name: 'Sepatu Merah', price: 0, color: 0xa61c2b },
    { id: 'sepatu_neon', name: 'Sepatu Neon', price: 200, color: 0x00ffcc },
    { id: 'sepatu_emas', name: 'Sepatu Emas', price: 400, color: 0xffd700 },
    { id: 'sepatu_spiderman', name: 'Sepatu Spiderman', price: 250, color: 0xc4122f },
    { id: 'sepatu_batman', name: 'Sepatu Batman', price: 250, color: 0x0f0f13 }
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
    { id: 'aks_topeng_batman', name: 'Topeng Batman', price: 400 },
    { id: 'aks_kacamata', name: 'Kacamata Hitam', price: 150 },
    { id: 'aks_topi', name: 'Topi Merah', price: 200 },
    { id: 'aks_mahkota', name: 'Mahkota Emas', price: 500 },
    { id: 'aks_jubah', name: 'Jubah Merah', price: 350 }
  ],
  gamepass: [
    { id: 'gp_dorong', name: 'Gamepass Dorong Teman', price: 10000000, gamepass: true, desc: 'Dorong teman saat balapan (tombol🫸' },
    { id: 'gp_vip', name: 'Gamepass VIP', price: 800000, gamepass: true, emoji: '👑', desc: 'Nama khusus VIP, tag VIP di chat, dan aura emas eksklusif' },
    { id: 'gp_2xcoin', name: 'Gamepass 2x Koin', price: 900000, gamepass: true, emoji: '🪙', desc: 'Koin hadiah saat bermain & menang jadi 2 kali lipat' },
    { id: 'gp_winfx', name: 'Gamepass Animasi Menang', price: 1200000, gamepass: true, emoji: '🏆', desc: 'Mahkota emas, kembang api & confetti saat menang, dilihat semua pemain' },
    { id: 'gp_freeze', name: 'Gamepass Freeze Player', price: 15000000, gamepass: true, icon: './ice_cube.jpg', emoji: '🧊', desc: 'Lempar es ke pemain terdekat: membeku 7 detik. Cooldown 5 detik' }
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
        div.innerHTML = `${msg.vip ? '<span style="background:linear-gradient(#ffe27a,#ff9f1c);color:#3a2300;border-radius:6px;padding:0 5px;margin-right:4px;font-size:11px;font-weight:800">VIP</span>' : ''}<span class="name ${msg.isDev ? 'dev' : ''}"${msg.vip && !msg.isDev ? ' style="color:#ffd166"' : ''}>${msg.name}: </span><span class="text">${msg.text}</span>`;
        chatMessages.appendChild(div);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (e) {
    console.log("Gagal mengambil chat:", e);
  }
}

// ============ 2. FUNGSI NOTIFIKASI CUSTOM (TOAST) ============
let toastTimer = null;
function showToast(message, duration = 2000) {
  const toast = document.getElementById('custom-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, duration); 
}

// ============ 3. SETUP DOM & EVENT LISTENER ============
window.addEventListener('DOMContentLoaded', () => {
  const loginMsg = document.getElementById('login-msg');
  const regMsg = document.getElementById('reg-msg');
  const profileModal = document.getElementById('profile-modal');
  const shopModal = document.getElementById('shop-modal');
  const vaultModal = document.getElementById('vault-modal');
  
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
    const payload = { name: playerData.username, isDev: playerData.isDev, vip: hasVip(), text: text, time: Date.now() };
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
    if (firstTab && !document.querySelector('.shop-tab-btn[data-cat="gamepass"]')) {
      const gb = firstTab.cloneNode(true); gb.dataset.cat = 'gamepass'; gb.textContent = '🎫 Gamepass'; gb.classList.remove('active');
      gb.addEventListener('click', (e) => { document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active'); renderShopTab('gamepass'); });
      firstTab.parentNode.appendChild(gb);
    }
    renderShopTab('baju'); 
  });
  document.getElementById('close-shop').addEventListener('click', () => { shopModal.style.display = 'none'; });
  document.getElementById('btn-vault').addEventListener('click', () => { vaultModal.style.display = 'flex'; renderVaultTab('baju'); });
  document.getElementById('close-vault').addEventListener('click', () => { vaultModal.style.display = 'none'; });
  const musicModal = document.getElementById('music-modal');
  const btnMusic = document.getElementById('btn-music');
  if (btnMusic && musicModal) btnMusic.addEventListener('click', () => { renderStandaloneMusic(); musicModal.style.display = 'block'; });
  const closeMusic = document.getElementById('close-music');
  if (closeMusic && musicModal) closeMusic.addEventListener('click', () => { musicModal.style.display = 'none'; });
  document.querySelectorAll('.vault-tab-btn').forEach(btn => btn.addEventListener('click', (e) => {
    document.querySelectorAll('.vault-tab-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active'); renderVaultTab(e.currentTarget.dataset.cat);
  }));

  document.querySelectorAll('.shop-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderShopTab(e.target.dataset.cat);
    });
  });

  document.getElementById('btn-start-game').addEventListener('click', () => {
    // Di room, tombol ini hanya meminta host memulai. Semua pemain baru mulai
    // setelah startAt tersinkron dari Firebase.
    if (roomCode && !roomStartAt) {
      if (roomMeta && roomMeta.host === mpUid) hostStart().catch(e => showToast(mpErr(e)));
      else showToast('Menunggu pembuat room memulai permainan.');
      return;
    }
    if (gachaBusy || loadingActive) return;
    requestFullscreenAndLock();
    document.getElementById('btn-start-game').style.display = 'none';
    document.getElementById('btn-shop').style.display = 'none';
    document.getElementById('btn-vault').style.display = 'none';
    setElDisplay('btn-music', 'none');
    document.getElementById('in-game-controls').style.display = 'block'; setLobbyOnlyHud(false);
    chatBox.style.display = 'none'; 
    chatToggle.textContent = '💬 Chat Global';
    profileModal.style.display = 'none';
    shopModal.style.display = 'none';
    // GACHA MAP: room memakai hasil gacha host (tersimpan di meta.map) agar semua pemain satu map.
    const roomMap = roomMeta && roomMeta.map;
    const pickedMap = (roomCode && roomStartAt) ? ((roomMap === 'snow' && snowWorld) ? 'snow' : (roomMap === 'angkasa' && angkasaWorld) ? 'angkasa' : (roomMap === 'mountain' && mountainWorld) ? 'mountain' : (roomMap === 'honey' && honeyWorld) ? 'honey' : (roomMap === 'laser' && laserWorld) ? 'laser' : (roomMap === 'lavaland' && lavaLandWorld) ? 'lavaland' : 'lava') : rollMap();
    gachaBusy = true;
    playMapGacha(pickedMap, roomCode ? 900 : 1500, () => {
      gachaBusy = false;
      showLoadingScreen(() => {
        applyMap(pickedMap);
        isGameStarted = true;
        onGameBegin();
        setElDisplay('btn-exit-lobby', 'flex');
        camera.position.set(0, 4, 8);
        controls.target.set(0, 1.5, 0);
      });
    });
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
      { const ar = await fetch(`${FIREBASE_URL}usernames/${encodeURIComponent(userKey)}.json`, { cache: 'no-store' }); // nama yang sudah dipakai lewat ganti nama
        if (ar.ok && await ar.json()) { regMsg.textContent = "Username sudah dipakai!"; regMsg.className = "msg error"; document.getElementById('btn-register').disabled = false; return; } }
      const playerId = userKey === DEV_USERNAME ? ADMIN_PLAYER_ID : await createUniquePlayerId();
      const newPlayerData = { username, pin, playerId, isDev: (userKey === DEV_USERNAME), coins: 0, inventory: playerData.inventory, equipped: playerData.equipped };
      const saveRes = await fetch(firebaseUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPlayerData) });
      if (!saveRes.ok) throw new Error('Gagal menyimpan akun');

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

    let userKey = username.toLowerCase();

    try {
      userKey = await resolveUserKey(username); // bisa login dengan nama lama maupun nama baru
      const res = await fetch(`${FIREBASE_URL}players/${userKey}.json`);
      const data = await res.json();
      if (!data) {
        loginMsg.textContent = "Akun tidak ditemukan. Silakan Daftar."; loginMsg.className = "msg error";
        document.getElementById('btn-login').disabled = false; return;
      }
      if (data.pin !== pin) {
        loginMsg.textContent = "PIN salah! Coba lagi."; loginMsg.className = "msg error";
        document.getElementById('btn-login').disabled = false; return;
      }
      const verifiedData = await ensurePlayerId(userKey, data);
      playerData = { ...playerData, ...verifiedData, inventory: verifiedData.inventory || playerData.inventory, equipped: verifiedData.equipped || playerData.equipped };
      playerData.userKey = userKey; // kunci akun permanen
      localStorage.setItem('parkour_user', JSON.stringify({ username: userKey, isDev: data.isDev }));
      tryAutoLandscape();
      startLobby();
    } catch(e) {
      loginMsg.textContent = "Gagal konek ke server."; loginMsg.className = "msg error";
      document.getElementById('btn-login').disabled = false;
    }
  });

  // AUTO LOGIN + SPLASH AWAL (durasi 10 detik)
  const SPLASH_DURATION = 10000; // 10 detik
  const splash = document.getElementById('startup-loading');
  const splashBar = document.getElementById('startup-bar');
  const splashStatus = document.getElementById('startup-status');
  const splashStartedAt = performance.now();
  let splashDone = false;

  // Progress bar berjalan sesuai waktu, penuh tepat di 10 detik.
  const splashTimer = splash ? setInterval(() => {
    const f = Math.min(1, (performance.now() - splashStartedAt) / SPLASH_DURATION);
    if (splashBar) splashBar.style.width = Math.max(8, f * 100).toFixed(0) + '%';
    if (splashStatus && !splashDone) {
      splashStatus.textContent = f < 0.35 ? 'Menyiapkan permainan...'
        : f < 0.7 ? 'Memeriksa akun dan menyiapkan lobby...'
        : 'Hampir selesai...';
    }
  }, 100) : null;

  // Jalankan callback setelah splash minimal tampil 10 detik, lalu sembunyikan splash.
  function finishSplash(afterWait) {
    const wait = Math.max(0, SPLASH_DURATION - (performance.now() - splashStartedAt));
    setTimeout(() => {
      splashDone = true;
      clearInterval(splashTimer);
      if (splashBar) splashBar.style.width = '100%';
      try { if (afterWait) afterWait(); }
      catch (err) { console.error('Gagal membuka lobby/login setelah splash:', err); setElDisplay('auth-container', 'flex'); }
      finally { hideStartupSplash(); }
    }, wait);
  }

  const savedSession = localStorage.getItem('parkour_user');
  if (savedSession) {
    let session = null;
    try { session = JSON.parse(savedSession); }
    catch (e) { localStorage.removeItem('parkour_user'); }

    if (session && session.username) {
      const sessAbort = new AbortController();
      const sessTimeout = setTimeout(() => sessAbort.abort(), 8000);
      fetch(`${FIREBASE_URL}players/${String(session.username).toLowerCase()}.json`, { signal: sessAbort.signal })
        .then(res => {
          clearTimeout(sessTimeout);
          if (!res.ok) throw new Error('Gagal memeriksa sesi akun');
          return res.json();
        })
        .then(async data => {
          if (!data) {
            localStorage.removeItem('parkour_user');
            finishSplash(() => { document.getElementById('auth-container').style.display = 'flex'; });
            return;
          }
          const verifiedData = await ensurePlayerId(String(session.username).toLowerCase(), data);
          playerData = { ...playerData, ...verifiedData, inventory: verifiedData.inventory || playerData.inventory, equipped: verifiedData.equipped || playerData.equipped };
          playerData.userKey = String(session.username).toLowerCase(); // kunci akun permanen
          if (splashStatus) splashStatus.textContent = 'Lobby siap! Memasuki permainan...';
          finishSplash(() => { startLobby(); });
        })
        .catch(err => {
          console.warn('Auto-login gagal:', err);
          finishSplash(() => { document.getElementById('auth-container').style.display = 'flex'; });
        });
    } else {
      finishSplash(() => { document.getElementById('auth-container').style.display = 'flex'; });
    }
  } else {
    finishSplash(() => { document.getElementById('auth-container').style.display = 'flex'; });
  }
});

// ============ KELUAR KE LOBBY (tombol kecil kanan atas saat bermain) ============
async function returnToLobby() {
  if (gameState === 'LOBBY') return;
  const inGroup = !!roomCode, leftRound = roomStartAt;
  gameState = 'LOBBY';
  if (inGroup) { // TETAP di grup (kode room sama, tidak buat room baru); hanya keluar dari ronde
    roomStarted = false; roomStartAt = null;
    if (myRef) update(myRef, { status: 'LOBBY', out: leftRound || null, deadAt: null, push: null, x: null, y: null, z: null }).catch(() => {});
  }
  flyMode = false; flyUp = flyDown = false;
  const fc = document.getElementById('fly-ctrl'); if (fc) fc.style.display = 'none';
  const adFly = document.getElementById('ad-fly'); if (adFly) { adFly.classList.remove('on'); adFly.textContent = '✈️ Terbang: OFF (F)'; }
  finishMs = null; deathFrozenMs = null; roomRunReset = 0; honeyRoundEnded = false; honeyWinAwarded = false; soloStart = 0;
  { const rb = document.getElementById('btn-restart'); if (rb) rb.style.display = ''; }
  hideWinUi();
  try { guards.forEach(gd => gd.reset()); } catch (e) {}
  if (character) { character.visible = true; character.position.set(0, 0.25, 0); character.rotation.y = 0; }
  if (physics) physics.velocityY = 0;
  moveVel.set(0, 0); knock.set(0, 0);
  checkpoint = { p: null, set: false, x: 0, y: 0.25, z: 0 };
  ['overlay', 'countdown', 'race-timer'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  document.getElementById('in-game-controls').style.display = 'none';
  setElDisplay('btn-exit-lobby', 'none');
  document.getElementById('btn-start-game').style.display = 'flex';
  document.getElementById('btn-shop').style.display = 'flex';
  document.getElementById('btn-vault').style.display = 'flex';
  setElDisplay('btn-music', 'flex');
  document.getElementById('chat-container').style.display = 'flex';
  setLobbyOnlyHud(true);
  if (parkourWorldGroup) parkourWorldGroup.visible = false;
  if (snowWorldGroup) snowWorldGroup.visible = false;
  if (angkasaWorldGroup) angkasaWorldGroup.visible = false;
  if (mountainWorldGroup) mountainWorldGroup.visible = false;
  if (honeyWorldGroup) honeyWorldGroup.visible = false;
  if (laserWorldGroup) laserWorldGroup.visible = false;
  if (lavaLandWorldGroup) lavaLandWorldGroup.visible = false;
  if (angkasaController) angkasaController.reset(physics);
  if (lobbyWorldGroup) lobbyWorldGroup.visible = true;
  if (scene) { scene.background = new THREE.Color(LOBBY_BG); scene.fog = new THREE.Fog(LOBBY_BG, 45, 110); }
  if (camera && controls) { camera.position.set(0, 3.8, 9.5); controls.target.set(0, 1.45, 0); }
  updateRoomUI();
}
window.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btn-exit-lobby');
  if (b) b.addEventListener('click', () => { returnToLobby(); });
});

// ============ LOADING SCREEN (saat tekan MULAI) ============
let loadingActive = false;
function showLoadingScreen(done) {
  if (loadingActive) return; loadingActive = true;
  let el = document.getElementById('loading-screen');
  if (!el) {
    const css = document.createElement('style');
    css.textContent = '#loading-screen{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(circle at 50% 40%,#2a2f55,#0d0f1f);color:#fff;font-family:sans-serif;transition:opacity .35s}#ls-title{font:900 clamp(28px,8vw,52px) sans-serif;letter-spacing:2px;text-shadow:0 0 24px #3b6cf6}#ls-spin{width:54px;height:54px;border-radius:50%;border:6px solid rgba(255,255,255,.18);border-top-color:#00e0a0;animation:lsspin 0.9s linear infinite}@keyframes lsspin{to{transform:rotate(360deg)}}#ls-barwrap{width:min(78vw,420px);height:16px;border-radius:10px;background:rgba(255,255,255,.14);overflow:hidden}#ls-bar{height:100%;width:0;border-radius:10px;background:linear-gradient(90deg,#3b6cf6,#00e0a0);transition:width .1s linear}#ls-text{font-size:14px;opacity:.9}#ls-tip{max-width:80vw;text-align:center;font-size:13px;color:#ffd166;min-height:34px}';
    document.head.appendChild(css);
    el = document.createElement('div'); el.id = 'loading-screen';
    el.innerHTML = '<div id="ls-title">🏃 PARKOUR 3D</div><div id="ls-spin"></div><div id="ls-barwrap"><div id="ls-bar"></div></div><div id="ls-text"></div><div id="ls-tip"></div>';
    document.body.appendChild(el);
  }
  const bar = document.getElementById('ls-bar'), txt = document.getElementById('ls-text'), tip = document.getElementById('ls-tip');
  const steps = ['Menyiapkan arena...', 'Memasang jebakan...', 'Mengunci laser & penjaga...', 'Membangun labirin...', 'Menyiapkan karakter...', 'Siap!'];
  const tips = ['💡 Kotak yang berkedip aneh biasanya palsu, jangan percaya!', '💡 Lompat dua kali untuk jarak lebih jauh.', '💡 Di labirin, salah lorong = ditembak NPC.', '💡 Checkpoint hijau menyimpan progresmu.', '💡 Jatuh ke lava? Badanmu hancur, semua pemain bisa lihat 😹'];
  tip.textContent = tips[Math.floor(Math.random() * tips.length)];
  el.style.opacity = '1'; el.style.display = 'flex';
  try { if (renderer && scene && camera) renderer.compile(scene, camera); } catch (e) { /* abaikan */ }
  const t0 = performance.now(), DUR = 2200; let finished = false;
  const tick = () => {
    const f = Math.min(1, (performance.now() - t0) / DUR), e = 1 - Math.pow(1 - f, 2);
    bar.style.width = (e * 100).toFixed(0) + '%';
    txt.textContent = steps[Math.min(steps.length - 1, Math.floor(f * steps.length))] + ' ' + (e * 100).toFixed(0) + '%';
    if (f < 1) { requestAnimationFrame(tick); return; }
    if (finished) return; finished = true;
    setTimeout(() => {
      try { done(); }
      catch (err) { console.error('Gagal memulai game:', err); }
      finally { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; loadingActive = false; }, 380); }
    }, 150);
  };
  tick();
}

// Elemen profil, saldo, dan tombol zoom hanya tampil di lobby.
function setLobbyOnlyHud(show) {
  const display = show ? '' : 'none';
  const profile = document.getElementById('btn-profile');
  if (profile) profile.style.display = display;
  const coins = document.getElementById('coin-amount');
  if (coins) {
    let coinWrap = coins.closest('#coin-box, .coin-box, .hud-coins, .coin-display, [data-hud="coins"]') || coins.parentElement;
    if (coinWrap) coinWrap.style.display = display;
  }
  const zoom = document.getElementById('zoom-ctrl');
  if (zoom) zoom.remove();
  const friendLaunch = document.getElementById('ps-launcher');
  const inviteLaunch = document.getElementById('ps-invite-launcher');
  if (friendLaunch) friendLaunch.style.display = show ? 'flex' : 'none';
  const notifBell = document.getElementById('btn-notif');
  if (notifBell) notifBell.style.display = show ? 'flex' : 'none';
  if (!show) { const np = document.getElementById('notif-panel'); if (np) np.style.display = 'none'; }
  if (inviteLaunch) inviteLaunch.style.display = show ? 'flex' : 'none';
}

// ===== MAHKOTA KEMENANGAN =====
const DEFAULT_LEADERBOARD_MIN_CROWNS = 3;
let leaderboardMinCrowns = DEFAULT_LEADERBOARD_MIN_CROWNS;
function ensureCrownProfileUI() {
  const btn = document.getElementById('btn-profile');
  if (btn && !document.getElementById('profile-avatar-crown')) {
    const avatar = document.createElement('span'); avatar.id = 'profile-avatar-crown'; avatar.textContent = '👤';
    btn.insertBefore(avatar, btn.firstChild);
  }
  if (btn && !document.getElementById('hud-crowns')) {
    const crowns = document.createElement('span'); crowns.id = 'hud-crowns';
    crowns.style.cssText = 'display:inline-flex;align-items:center;gap:2px;margin-left:3px;font-size:12px;white-space:nowrap';
    btn.appendChild(crowns);
  }
  const modal = document.getElementById('profile-modal');
  if (modal && !document.getElementById('modal-crowns')) {
    const row = document.createElement('p'); row.id = 'modal-crowns'; row.style.cssText = 'color:#ffd76a;font-weight:700';
    const status = document.getElementById('modal-status')?.parentElement;
    if (status) status.insertAdjacentElement('afterend', row); else modal.appendChild(row);
  }
  if (!document.getElementById('crown-profile-style')) {
    const style = document.createElement('style'); style.id = 'crown-profile-style';
    style.textContent = '#profile-avatar-crown{width:30px;height:30px;flex:0 0 30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#34466c,#151b2d);border:2px solid #ffd76a;font-size:17px;position:relative}#hud-crowns{color:#ffd76a;text-shadow:0 1px 4px #000}#modal-crowns{font-size:15px!important;color:#ffd76a!important}';
    document.head.appendChild(style);
  }
}
function updateCrownProfileUI() {
  ensureCrownProfileUI();
  const count = accountKey() === DEV_USERNAME ? ADMIN_FIXED_CROWNS : Math.max(0, Math.floor(Number(playerData.crowns) || 0));
  const hud = document.getElementById('hud-crowns');
  if (hud) hud.textContent = `👑 ${count}`;
  const modal = document.getElementById('modal-crowns');
  if (modal) modal.textContent = `Mahkota kemenangan: ${'👑'.repeat(Math.min(count, 8))}${count > 8 ? ` ×${count}` : ''} (${count})`;
}
async function loadCrownSettings() {
  try {
    const value = await socialGet('settings/leaderboardMinCrowns');
    leaderboardMinCrowns = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : DEFAULT_LEADERBOARD_MIN_CROWNS;
  } catch (_) { leaderboardMinCrowns = DEFAULT_LEADERBOARD_MIN_CROWNS; }
}
async function awardWinCrown() {
  const key = myPlayerKey();
  if (!key) return;
  if (key === DEV_USERNAME) {
    playerData.crowns = ADMIN_FIXED_CROWNS;
    await socialPatch(`players/${key}`, { crowns: ADMIN_FIXED_CROWNS, lastWinAt: Date.now() });
    await socialPatch(`leaderboard/${key}`, { crowns: ADMIN_FIXED_CROWNS }).catch(() => {});
    updateCrownProfileUI();
    refreshSoloLeaderboard(true).catch(() => {});
    showToast(`🏆 Akun admin: ${ADMIN_FIXED_CROWNS.toLocaleString('id-ID')} mahkota`, 2800);
    return;
  }
  // Baca nilai terbaru agar mahkota yang sudah diatur admin tidak tertimpa data lama.
  const latest = await socialGet(`players/${key}`).catch(() => null) || {};
  const next = Math.max(0, Math.floor(Number(latest.crowns ?? playerData.crowns) || 0)) + 1;
  await socialPatch(`players/${key}`, { crowns: next, lastWinAt: Date.now() });
  playerData.crowns = next;
  updateCrownProfileUI();
  // Simpan juga salinan di node leaderboard supaya penyaringan dan tampilan selalu sinkron.
  await socialPatch(`leaderboard/${key}`, { crowns: next, username: String(playerData.username || key).slice(0, 18), playerId: String(playerData.playerId || ''), isDev: !!playerData.isDev, equipped: myEquipped() }).catch(() => {});
  refreshSoloLeaderboard(true).catch(() => {});
  showToast(`MENANG! Kamu mendapat 1 mahkota (${next})`, 2800);
}

// ============ 4. FUNGSI LOBI & SHOP ============
function startLobby() {
  tryAutoLandscape();
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('game-ui').style.display = 'block';
  gameState = 'LOBBY'; 
  if (!playerData.inventory.includes('aks_none')) playerData.inventory.push('aks_none');
  const isOwnerAccount = accountKey() === DEV_USERNAME;
  if (isOwnerAccount && !playerData.inventory.includes('baju_developer')) {
    playerData.inventory.push('baju_developer');
    updatePlayerFirebase().catch(err => console.warn('Gagal menyimpan kostum Developer ke Vault:', err));
  }
  if (!playerData.equipped.aksesoris) playerData.equipped.aksesoris = 'aks_none';
  document.getElementById('hud-username').textContent = playerData.username;
  updateCrownProfileUI();
  if (accountKey() === DEV_USERNAME) {
    playerData.crowns = ADMIN_FIXED_CROWNS;
    socialPatch(`players/${DEV_USERNAME}`, { crowns: ADMIN_FIXED_CROWNS, crownsUpdatedAt: Date.now() }).catch(() => {});
    socialPatch(`leaderboard/${DEV_USERNAME}`, { crowns: ADMIN_FIXED_CROWNS }).catch(() => {});
    updateCrownProfileUI();
  }
  loadCrownSettings().then(() => refreshSoloLeaderboard(true)).catch(() => {});
  document.getElementById('coin-amount').textContent = playerData.coins || 0;
  document.getElementById('modal-username').textContent = `${playerData.username} · ID ${playerData.playerId || (playerData.isDev ? ADMIN_PLAYER_ID : 'belum tersedia')}`;
  ensureRenameProfileUI();
  
  if (playerData.isDev) {
    document.getElementById('hud-verified').style.display = 'flex';
    document.getElementById('modal-status').textContent = "Developer ✔";
  } else {
    document.getElementById('modal-status').textContent = "Player Biasa";
    document.getElementById('modal-status').style.color = "#ccc";
  }
  document.getElementById('btn-start-game').style.display = 'flex';
  document.getElementById('btn-shop').style.display = 'flex';
  document.getElementById('btn-vault').style.display = 'flex';
  setElDisplay('btn-music', 'flex');
  document.getElementById('in-game-controls').style.display = 'none'; setLobbyOnlyHud(true);
  document.getElementById('chat-container').style.display = 'flex';
  initNotificationCenter();

  fetchGlobalChat();
  setInterval(fetchGlobalChat, 3000);

  init3DGame();
  if (parkourWorldGroup) parkourWorldGroup.visible = false;
  if (lobbyWorldGroup) lobbyWorldGroup.visible = true;
  scene.fog = new THREE.Fog(LOBBY_BG, 45, 110);
  character.position.set(0, 0.25, 0); character.rotation.y = 0;
  camera.position.set(0, 3.8, 9.5);
  controls.target.set(0, 1.45, 0);
  buildRoomUI();
  setLobbyOnlyHud(true);
}

function renderShopTab(category) {
  const container = document.getElementById('shop-items-container');
  container.innerHTML = '';
  
  let visibleCount = 0;
  if (category === 'gamepass') {
    SHOP_ITEMS.gamepass.forEach(item => {
      const owned = playerData.inventory.includes(item.id);
      const div = document.createElement('div'); div.className = 'shop-item';
      div.innerHTML = `<div class="color-preview" style="background:#2a2f45;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:44px">${item.icon ? `<img src="${item.icon}" alt="" style="width:76px;height:76px;object-fit:contain;border-radius:12px" onerror="this.outerHTML='${item.emoji || '🎫'}'">` : (item.emoji || '🫸')}</div><div class="item-name">${item.name}</div><div class="item-price" style="font-size:11px">${item.desc}</div>${owned ? '<div class="item-price owned-label">SUDAH DIMILIKI</div><button class="shop-buy-btn" disabled>AKTIF</button>' : `<div class="item-price">🪙 ${item.price}</div><button class="shop-buy-btn" onclick="buyItem('gamepass', '${item.id}', ${item.price})">BELI (${item.price})</button>`}`;
      container.appendChild(div);
    });
    return;
  }
  SHOP_ITEMS[category].forEach(item => {
    if (item.adminOnly || item.id === 'baju_developer') return;
    const isOwned = playerData.inventory.includes(item.id);
    if (isOwned) return; // item yang sudah dibeli pindah ke Vault
    const isEquipped = Object.values(playerData.equipped).includes(item.id);
    visibleCount++;
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
  if (!visibleCount) container.innerHTML = '<div class="inventory-empty">Semua item kategori ini sudah kamu miliki. Cek Vault!</div>';
}

function renderStandaloneMusic() {
  const container = document.getElementById('music-track-list');
  if (!container) return;
  const tracks = [
    { id: 'amatekam', name: 'Amatekam', file: 'putzzdev.mp3' },
    { id: 'luklukluk', name: 'Luk Luk Luk', file: 'putzzdev2.mp3' }
  ];
  const selected = window.getSelectedVaultMusic ? window.getSelectedVaultMusic() : 'amatekam';
  const playing = window.isVaultMusicPlaying && window.isVaultMusicPlaying();
  const vol = window.getVaultMusicVolume ? Math.round(window.getVaultMusicVolume() * 100) : 35;
  const controls = `
    <div style="background:#1b2640;border:1px solid #42516b;border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <button type="button" class="shop-buy-btn" style="width:auto;min-width:110px" onclick="toggleVaultMusic()">${playing ? '⏸ JEDA' : '▶ LANJUT'}</button>
      <label style="flex:1;min-width:120px;font-size:12px;color:#aab7cc">🔊 Volume
        <input type="range" min="0" max="100" value="${vol}" style="width:100%" oninput="setVaultMusicVolume(this.value/100)">
      </label>
    </div>`;
  container.innerHTML = controls + tracks.map(track => `
    <div style="background:#222b40;border:1px solid #42516b;border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div><div style="font-weight:bold;font-size:16px">🎵 ${track.name}</div><div style="font-size:11px;color:#aab7cc;margin-top:4px">${track.file}</div></div>
      <button type="button" class="shop-buy-btn" style="width:auto;min-width:118px" onclick="selectVaultMusic('${track.id}');renderStandaloneMusic()">${selected === track.id && playing ? 'SEDANG DIPUTAR' : 'PUTAR LAGU'}</button>
    </div>`).join('');
}

function renderVaultTab(category) {
  const container = document.getElementById('vault-items-container');
  if (!container) return;
  container.innerHTML = '';



  let visibleCount = 0;
  (SHOP_ITEMS[category] || []).forEach(item => {
    if (!playerData.inventory.includes(item.id)) return;
    visibleCount++;
    const isEquipped = Object.values(playerData.equipped).includes(item.id);
    const div = document.createElement('div'); div.className = 'shop-item';
    const previewHTML = `<div class="color-preview" style="background:#2a2f45;border-radius:14px;display:flex;align-items:center;justify-content:center">${itemIcon(category, item)}</div>`;
    const btnHTML = isEquipped
      ? '<button class="shop-buy-btn" disabled>DIPAKAI</button>'
      : `<button class="shop-buy-btn" onclick="equipItem('${category}', '${item.id}')">PAKAI</button>`;
    div.innerHTML = `${previewHTML}<div class="item-name">${item.name}</div><div class="item-price owned-label">SUDAH DIMILIKI</div>${btnHTML}`;
    container.appendChild(div);
  });
  if (!visibleCount) container.innerHTML = '<div class="inventory-empty">Belum ada item di kategori ini.</div>';
}

window.buyItem = async function(category, itemId, price) {
  if (itemId === 'baju_developer') { showToast('🔒 Kostum Developer tidak dijual'); return; }
  if (playerData.inventory.includes(itemId)) { showToast('Sudah dimiliki'); return; }
  if (playerData.coins < price) { showToast("❌ Koin kamu tidak cukup!"); return; }
  playerData.coins -= price;
  playerData.inventory.push(itemId);
  if (itemId === 'gp_vip') { try { updateCharacterNameSprite(playerData.username, playerData.isDev); } catch (e) {} }
  await updatePlayerFirebase();
  document.getElementById('coin-amount').textContent = playerData.coins;
  renderShopTab(category);
  if (document.getElementById('vault-modal').style.display === 'flex') renderVaultTab(category);
  showToast("Berhasil dibeli!");
};

window.equipItem = async function(category, itemId) {
  if (itemId === 'baju_developer' && accountKey() !== DEV_USERNAME) {
    showToast('Kostum Developer khusus akun admin');
    return;
  }
  let equipKey = category;
  if (category === 'efek') equipKey = itemId.includes('lari') ? 'efek_lari' : 'efek_lompat';
  
  playerData.equipped[equipKey] = itemId;
  await updatePlayerFirebase();
  updateCharacterVisuals();
  renderShopTab(category);
  if (document.getElementById('vault-modal').style.display === 'flex') renderVaultTab(category);
  showToast("Item berhasil dipakai!");
};

async function updatePlayerFirebase() {
  const userKey = accountKey(); // kunci akun permanen (bukan nama tampilan)
  const firebaseUrl = `${FIREBASE_URL}players/${userKey}.json`;
  await fetch(firebaseUrl, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coins: playerData.coins, inventory: playerData.inventory, equipped: playerData.equipped, savedCheckpoint: playerData.savedCheckpoint || null, savedCheckpointSnow: playerData.savedCheckpointSnow || null, savedCheckpointMountain: playerData.savedCheckpointMountain || null, dailyMissions: playerData.dailyMissions || null })
  });
}

// ============ 5. UPDATE VISUAL KARAKTER ============
const webTexCache = {};
function getWebTex(hex) {
  if (webTexCache[hex]) return webTexCache[hex];
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.scale(2, 2);
  x.fillStyle = '#' + hex.toString(16).padStart(6, '0'); x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); }
  for (let j = 0; j < 256; j += 32) for (let i = 0; i < 256; i += 64) { x.beginPath(); x.moveTo(i, j); x.quadraticCurveTo(i + 32, j + 10, i + 64, j); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
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
  const lt = new THREE.CanvasTexture(c); lt.colorSpace = THREE.SRGBColorSpace; lt.anisotropy = 8; return lt;
}

function makeBatLogoTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f5c400'; x.beginPath(); x.ellipse(64, 64, 60, 38, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#111'; x.lineWidth = 5; x.stroke();
  x.fillStyle = '#111'; x.beginPath();
  x.moveTo(64, 42); x.lineTo(70, 36); x.lineTo(72, 44); x.quadraticCurveTo(92, 40, 110, 54); x.quadraticCurveTo(100, 58, 96, 72);
  x.quadraticCurveTo(90, 64, 82, 68); x.quadraticCurveTo(76, 68, 72, 82); x.lineTo(64, 72); x.lineTo(56, 82);
  x.quadraticCurveTo(52, 68, 46, 68); x.quadraticCurveTo(38, 64, 32, 72); x.quadraticCurveTo(28, 58, 18, 54);
  x.quadraticCurveTo(36, 40, 56, 44); x.lineTo(58, 36); x.closePath(); x.fill();
  const lt = new THREE.CanvasTexture(c); lt.colorSpace = THREE.SRGBColorSpace; lt.anisotropy = 8; return lt;
}

// ===== HD: tekstur kain/rantai, environment map untuk logam, helper kostum =====
let envTex = null;
const suitTexCache = {};
function getSuitTex(kind, hex) {
  const key = kind + hex; if (suitTexCache[key]) return suitTexCache[key];
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#' + hex.toString(16).padStart(6, '0'); x.fillRect(0, 0, S, S);
  if (kind === 'mail') { // zirah rantai
    for (let j = 0; j < S; j += 14) for (let i = (j / 14 % 2) * 7; i < S; i += 14) {
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 2.5; x.beginPath(); x.arc(i + 7, j + 7, 6, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1; x.beginPath(); x.arc(i + 6, j + 6, 5, Math.PI, Math.PI * 1.6); x.stroke();
    }
  } else if (kind === 'leather') { // kulit hitam: butiran halus + lipatan
    for (let n = 0; n < 5200; n++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.18)'; x.fillRect(Math.random() * S, Math.random() * S, 1.6, 1.6); }
    x.lineWidth = 1.6;
    for (let n = 0; n < 34; n++) { const y0 = Math.random() * S; x.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.28)'; x.beginPath(); x.moveTo(0, y0); x.bezierCurveTo(S * 0.3, y0 + Math.random() * 30 - 15, S * 0.7, y0 + Math.random() * 30 - 15, S, y0 + Math.random() * 24 - 12); x.stroke(); }
  } else { // jahitan otot ala armor kain
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 3;
    for (let j = 0; j < S; j += 56) { x.beginPath(); x.moveTo(0, j); x.quadraticCurveTo(S / 2, j + 16, S, j); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 2;
    for (let j = 8; j < S; j += 56) { x.beginPath(); x.moveTo(0, j); x.quadraticCurveTo(S / 2, j + 16, S, j); x.stroke(); }
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 2;
    for (let i = 0; i < S; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (suitTexCache[key] = t);
}
function applyItemMat(m, it) {
  const tex = it.web ? getWebTex(it.color) : it.suit ? getSuitTex(it.suit, it.color) : null;
  const metal = it.dev ? 0.82 : it.iron ? 0.75 : it.thor ? 0.55 : 0;
  m.map = tex; m.color.setHex(tex ? 0xffffff : it.color);
  m.bumpMap = tex; m.bumpScale = 0.6;
  m.metalness = metal; m.roughness = it.iron ? 0.28 : it.thor ? 0.4 : (it.suit === 'leather' ? 0.38 : (tex ? 0.55 : 0.7));
  m.envMap = (metal || tex) && envTex ? envTex : null; m.envMapIntensity = it.iron ? 1.1 : it.thor ? 0.9 : (it.suit === 'leather' ? 0.55 : 0.3);
  m.needsUpdate = true;
}
function pickCostume(eq) {
  const pick = (cat, def) => SHOP_ITEMS[cat].find(i => i.id === eq[cat]) || SHOP_ITEMS[cat].find(i => i.id === def);
  const baju = pick('baju', 'baju_default'), iron = !!baju.iron, thor = !!baju.thor, hulk = !!baju.hulk;
  const pac = !!baju.pac, saitama = !!baju.saitama, greenlantern = !!baju.greenlantern, sonic = !!baju.sonic, venom = !!baju.venom, flash = !!baju.flash, ghost = !!baju.ghost;
  const luffy = !!baju.luffy, gojo = !!baju.gojo, naruto = !!baju.naruto;
  const celana = luffy ? { color: 0x2f6fe0 } : gojo ? { color: 0x181d30 } : naruto ? { color: 0xe0782f } : ghost ? { color: 0x101014, suit: 'leather' } : flash ? { color: 0xb30f1c } : venom ? { color: 0x0a0c14 } : sonic ? { color: 0x1d5fd1 } : greenlantern ? { color: 0x10151a } : saitama ? { color: 0xc92532, iron: false } : pac ? { color: 0xffd800 } : iron ? { color: 0xb01020, iron: true } : thor ? { color: 0x2a2d33 } : hulk ? { color: 0x6b3fa0 } : pick('celana', 'celana_default');
  const sepatu = luffy ? { color: 0x6b4a2b } : gojo ? { color: 0x0d0d10 } : naruto ? { color: 0x30343c } : ghost ? { color: 0x14110f } : flash ? { color: 0xb30f1c } : venom ? { color: 0x0a0c14 } : sonic ? { color: 0xd7263d } : greenlantern ? { color: 0x087d3b } : saitama ? { color: 0xc92532 } : pac ? { color: 0x1a1a8c } : iron ? { color: 0xd4a017, iron: true } : thor ? { color: 0x4a3320 } : hulk ? { color: 0x57b84a } : pick('sepatu', 'sepatu_default');
  return { baju, celana, sepatu, iron, thor, hulk, saitama, greenlantern, sonic, venom, flash, ghost, luffy, gojo, naruto };
}
const costumeParts = { spider: [], bat: [], iron: [], thor: [], hulk: [], ultra: [], godzilla: [], ramen: [], pac: [], saitama: [], greenlantern: [], sonic: [], venom: [], flash: [], ghost: [], naruto: [], luffy: [], gojo: [] };
// ===== KOSTUM GHOST RIDER: helper api kepala (dianimasikan lewat userData.fire, jadi ikut ke semua klon avatar) =====
let localFire = [];
let ghostFireAssets = null;
function getGhostFireAssets() {
  if (ghostFireAssets) return ghostFireAssets;
  const mkGeo = (cols) => {
    const prof = [[0, 0], [0.09, 0.015], [0.145, 0.1], [0.152, 0.22], [0.125, 0.38], [0.085, 0.55], [0.045, 0.72], [0.018, 0.87], [0, 1]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 12);
    const pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i);
      pos.setX(i, pos.getX(i) + 0.2 * y * y); // ujung api melengkung
      const lo = y < 0.5, a = lo ? cols[0] : cols[1], b = lo ? cols[1] : cols[2], k = lo ? y / 0.5 : (y - 0.5) / 0.5;
      for (let c = 0; c < 4; c++) col[i * 4 + c] = a[c] + (b[c] - a[c]) * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    return g;
  };
  // Empat lapis dari luar ke dalam: merah-oranye, oranye, kuning, putih-kuning (alpha memudar ke ujung).
  const layers = [
    { cols: [[1.0, 0.25, 0.02, 0.92], [1.0, 0.36, 0.03, 0.80], [0.95, 0.10, 0.0, 0.0]], wS: 1.0, hS: 1.0, ring: 10, center: 3, rad: 0.20 },
    { cols: [[1.0, 0.55, 0.05, 0.95], [1.0, 0.60, 0.08, 0.88], [1.0, 0.38, 0.03, 0.0]], wS: 0.74, hS: 0.80, ring: 7, center: 3, rad: 0.17 },
    { cols: [[1.0, 0.90, 0.35, 1.0], [1.0, 0.84, 0.25, 0.92], [1.0, 0.58, 0.10, 0.0]], wS: 0.50, hS: 0.60, ring: 5, center: 2, rad: 0.13 },
    { cols: [[1.0, 1.0, 0.86, 1.0], [1.0, 0.96, 0.58, 0.90], [1.0, 0.78, 0.20, 0.0]], wS: 0.30, hS: 0.40, ring: 0, center: 2, rad: 0.08 }
  ];
  layers.forEach(l => {
    l.geo = mkGeo(l.cols);
    l.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  });
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,190,70,0.95)'); gr.addColorStop(0.35, 'rgba(255,100,10,0.45)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  ghostFireAssets = {
    layers,
    glowTex: new THREE.CanvasTexture(c),
    emberGeo: new THREE.SphereGeometry(0.022, 6, 5),
    emberMat: new THREE.MeshBasicMaterial({ color: 0xffb020, fog: false, toneMapped: false })
  };
  return ghostFireAssets;
}
function buildGhostFire(parent) {
  const A = getGhostFireAssets();
  const rnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const root = new THREE.Group(); root.position.set(0, 0.12, 0); parent.add(root);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.8 }));
  glow.position.set(0, 0.45, 0); glow.scale.set(1.9, 1.9, 1); glow.renderOrder = 19;
  glow.userData.fire = { k: 'g', w: 1.9, p: 0 };
  root.add(glow);

  A.layers.forEach((L, li) => {
    const tongue = (px, py, pz, yaw, h, w, lean, seed) => {
      const pivot = new THREE.Group(); pivot.position.set(px, py, pz); pivot.rotation.y = yaw; root.add(pivot);
      const m = new THREE.Mesh(L.geo, L.mat);
      m.renderOrder = 20 + li; m.frustumCulled = false;
      const d = { k: 't', w, h, lx: lean, lz: 0, p: rnd(seed * 7 + 1) * 6.283, s: 7 + 5 * rnd(seed + 3) };
      m.userData.fire = d;
      m.scale.set(w, h, w); m.rotation.x = lean;
      pivot.add(m);
    };
    for (let i = 0; i < L.ring; i++) {
      const a = (i / L.ring) * Math.PI * 2 + li * 0.4, sd = i + li * 17;
      const back = Math.cos(a) < 0 ? 0.14 : 0;            // api bagian belakang lebih miring (tertiup)
      tongue(Math.sin(a) * L.rad, 0.18 - li * 0.02, Math.cos(a) * L.rad, a,
        (0.55 + 0.4 * rnd(sd)) * L.hS, (0.75 + 0.45 * rnd(sd * 3)) * L.wS, 0.22 + 0.2 * rnd(sd + 5) + back, sd);
    }
    for (let k = 0; k < L.center; k++) {
      const a = (k / L.center) * Math.PI * 2 + li, sd = 50 + k + li * 9;
      tongue(Math.sin(a) * L.rad * 0.35, 0.2 - li * 0.02, Math.cos(a) * L.rad * 0.35, a,
        (0.92 + 0.2 * rnd(sd)) * L.hS, (0.85 + 0.3 * rnd(sd * 2)) * L.wS, 0.06 + 0.1 * rnd(sd + 2), sd);
    }
  });

  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(A.emberGeo, A.emberMat); m.renderOrder = 30; m.frustumCulled = false;
    const d = { k: 'e', x: (rnd(i + 90) - 0.5) * 0.35, y: 0.3, z: (rnd(i + 120) - 0.5) * 0.3, v: 0.35 + 0.3 * rnd(i + 5), p: rnd(i + 33), r: 1.3, z0: 0.6 + 0.9 * rnd(i + 60) };
    m.userData.fire = d; m.position.set(d.x, d.y, d.z);
    root.add(m);
  }
  return root;
}
function collectFire(root) {
  const out = [];
  root.traverse(o => { if (o.userData && o.userData.fire) out.push(o); });
  return out;
}
function animateFireList(list, t) {
  for (const f of list) {
    const d = f.userData.fire; if (!d) continue;
    if (d.k === 't') {
      const fl = 0.82 + 0.18 * Math.sin(t * d.s + d.p) + 0.07 * Math.sin(t * d.s * 2.3 + d.p * 1.7);
      const wd = 0.94 + 0.10 * Math.sin(t * d.s * 0.8 + d.p * 2.1);
      f.scale.set(d.w * wd, d.h * fl, d.w * wd);
      f.rotation.z = d.lz + 0.09 * Math.sin(t * 2.6 + d.p * 3);
      f.rotation.x = d.lx + 0.07 * Math.sin(t * 2.1 + d.p * 5);
    } else if (d.k === 'e') {
      const life = (t * d.v + d.p) % 1;
      f.position.set(d.x + Math.sin(t * 2.2 + d.p * 9) * 0.05, d.y + life * d.r, d.z + Math.cos(t * 1.9 + d.p * 7) * 0.04);
      f.scale.setScalar(Math.max(0.001, (1 - life) * d.z0));
    } else if (d.k === 'g') {
      const k = 1 + 0.08 * Math.sin(t * 5 + d.p);
      f.scale.set(d.w * k, d.w * k, 1);
    }
  }
}
function tickGhostFire() {
  const t = performance.now() / 1000;
  if (localFire.length) animateFireList(localFire, t);
  remotePlayers.forEach(g => { const l = g.userData && g.userData.fire; if (l && l.length) animateFireList(l, t); });
  lobbyLeaderboardAvatars.forEach(a => { const l = a.userData && a.userData.fire; if (l && l.length) animateFireList(l, t); });
}

function setCostumeVis(baju, get) {
  const on = { saitama: !!baju.saitama, spider: baju.id === 'baju_spiderman', bat: baju.id === 'baju_batman', iron: !!baju.iron, thor: !!baju.thor, hulk: !!baju.hulk, ultra: !!baju.ultra, godzilla: !!baju.godzilla, ramen: !!baju.ramen, pac: !!baju.pac, greenlantern: !!baju.greenlantern, sonic: !!baju.sonic, venom: !!baju.venom, flash: !!baju.flash, ghost: !!baju.ghost, naruto: !!baju.naruto, luffy: !!baju.luffy, gojo: !!baju.gojo };
  for (const k in costumeParts) costumeParts[k].forEach(o => { const n = get(o); if (n) n.visible = on[k]; });
}

// tubuh Hulk: kulit hijau, otot besar (badan/lengan/kaki melebar), tangan besar
// Warna rambut khusus kostum karakter anime (null = warna rambut bawaan)
function costumeHairHex(baju) { return baju.luffy ? 0x15151a : baju.gojo ? 0xf4f6ff : baju.naruto ? 0xf5d142 : 0; }
function applyBodyType(root, P, hulk, skinHex, hairHex) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const t = o.userData.type;
    if (t === 'kulit') { o.material.color.setHex(hulk ? 0x57b84a : (skinHex || 0xffd1b3)); if (o.userData.hand) o.scale.setScalar(hulk ? 1.7 : 1); }
    else if (t === 'rambut') o.material.color.setHex(hulk ? 0x141a12 : (hairHex || 0xd1d1d6));
    else if (t === 'baju') o.scale.set(hulk ? 1.4 : 1, 1, hulk ? 1.4 : 1);
    else if (t === 'celana') o.scale.set(hulk ? 1.3 : 1, 1, hulk ? 1.3 : 1);
  });
  P.armL.position.x = hulk ? -0.58 : -0.4; P.armR.position.x = hulk ? 0.58 : 0.4;
  P.legL.position.x = hulk ? -0.2 : -0.15; P.legR.position.x = hulk ? 0.2 : 0.15;
}

const ACC_ICONS = {
  aks_topeng_batman: '<path d="M14 56V26Q14 12 32 12Q50 12 50 26V56Q42 46 32 46Q22 46 14 56Z" fill="#15151c"/><path d="M14 26L10 4L27 13ZM50 26L54 4L37 13Z" fill="#15151c"/><path d="M19 30L29 34L19 37Z" fill="#fff"/><path d="M45 30L35 34L45 37Z" fill="#fff"/>',
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
  if (it.id === 'baju_developer') {
    inner = '<path d="M20 8L8 16L13 28L19 24V56H45V24L51 28L56 16L44 8Q32 16 20 8Z" fill="#101b35" stroke="#54dfff" stroke-width="2"/><path d="M32 17L35 25L44 26L37 32L39 41L32 36L25 41L27 32L20 26L29 25Z" fill="#ffd76a"/><path d="M18 48H46" stroke="#54dfff" stroke-width="3"/><text x="32" y="57" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff">DEV</text>';
    return `<svg viewBox="0 0 64 64" style="width:80%;height:80%">${inner}</svg>`;
  }
  if (SHAPES[cat]) {
    const col = '#' + it.color.toString(16).padStart(6, '0'), d = SHAPES[cat];
    inner = `<defs><clipPath id="cp-${it.id}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${col}" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-linejoin="round"/>`;
    if (it.web) inner += `<g clip-path="url(#cp-${it.id})" stroke="rgba(0,0,0,.5)" stroke-width=".8" fill="none"><path d="M32 4V60M20 4V60M44 4V60M8 4V60M56 4V60M4 16Q32 24 60 16M4 28Q32 36 60 28M4 40Q32 48 60 40M4 52Q32 60 60 52"/></g>`;
    if (it.iron && cat === 'baju') inner += '<path d="M20 8L8 16L13 27L19 24Z" fill="#d4a017"/><path d="M44 8L56 16L51 27L45 24Z" fill="#d4a017"/><circle cx="32" cy="30" r="5" fill="#9ff3ff" stroke="#d4a017" stroke-width="2"/><rect x="19" y="46" width="26" height="4" fill="#d4a017"/>';
    if (it.hulk && cat === 'baju') inner += '<path d="M24 24Q32 34 40 24" stroke="#2c6b27" stroke-width="2" fill="none"/><circle cx="25" cy="28" r="5" fill="#6fd35f"/><circle cx="39" cy="28" r="5" fill="#6fd35f"/><path d="M32 32V46M26 38H38M27 44H37" stroke="#2c6b27" stroke-width="1.5"/><rect x="19" y="47" width="26" height="5" fill="#6b3fa0"/>';
    if (it.thor && cat === 'baju') inner += '<path d="M20 8L8 16L13 27L19 24Z" fill="#c9d1d9"/><path d="M44 8L56 16L51 27L45 24Z" fill="#c9d1d9"/><circle cx="25" cy="29" r="5.5" fill="#dfe6ec" stroke="#7b8794" stroke-width="1.5"/><circle cx="39" cy="29" r="5.5" fill="#dfe6ec" stroke="#7b8794" stroke-width="1.5"/><rect x="19" y="46" width="26" height="4" fill="#4a2f1b"/><rect x="28" y="38" width="8" height="5" rx="1" fill="#6b7480"/><path d="M33 33L29 38H32L30 43L36 36H33Z" fill="#4aa8ff"/>';
    if (it.bat && cat === 'baju') inner += '<rect x="19" y="47" width="26" height="4" fill="#f5c400"/><ellipse cx="32" cy="30" rx="8" ry="5" fill="#f5c400" stroke="#111"/><path d="M32 26L33 25L33.5 26.5Q38 26 40 28Q38 28.5 37 31Q35 30 34 31L32 33L30 31Q29 30 27 31Q26 28.5 24 28Q26 26 30.5 26.5L31 25Z" fill="#111"/>';
    if (it.ultra && cat === 'baju') inner += '<path d="M20 8L32 18L44 8L39 56H25Z" fill="#d52c3a"/><circle cx="32" cy="34" r="5" fill="#5cecff" stroke="#fff" stroke-width="2"/>';
    if (it.godzilla && cat === 'baju') inner += '<path d="M32 8L24 20L29 19L22 31L29 28L25 44L39 44L35 28L42 31L35 19L40 20Z" fill="#a8d96a" stroke="#183d2b" stroke-width="1.5"/>';
    if (it.greenlantern && cat === 'baju') inner += '<path d="M32 15L43 20V31Q43 42 32 49Q21 42 21 31V20Z" fill="#062a19" stroke="#7dffad" stroke-width="2"/><circle cx="32" cy="31" r="9" fill="#eafff1" stroke="#19b85a" stroke-width="3"/><path d="M24 31H40M27 27H37M27 35H37" stroke="#087d3b" stroke-width="2"/>';
    if (it.ghost && cat === 'baju') inner += '<path d="M32 14Q38 21 35 27Q41 25 40 31Q45 25 42 19Q50 29 43 36H21Q14 28 22 19Q22 25 27 27Q24 20 32 14Z" fill="#ff7a00"/><path d="M32 22Q36 27 34 31H29Q28 26 32 22Z" fill="#ffd23f"/><ellipse cx="32" cy="39" rx="7" ry="6.5" fill="#efe6cf"/><circle cx="29.3" cy="38" r="1.9" fill="#111"/><circle cx="34.7" cy="38" r="1.9" fill="#111"/><path d="M32 40.5L31 42.6H33Z" fill="#111"/><rect x="28" y="44" width="8" height="2.4" fill="#efe6cf"/>';
    if (it.flash && cat === 'baju') inner += '<circle cx="32" cy="31" r="10" fill="#fff" stroke="#f2b705" stroke-width="2"/><path d="M35 22L27 32.5H32L29 41L37 29.5H32.5Z" fill="#f2b705"/><rect x="19" y="47" width="26" height="4" fill="#f2b705"/>';
    if (it.venom && cat === 'baju') inner += '<path d="M32 18Q38 24 36 32Q40 40 32 50Q24 40 28 32Q26 24 32 18Z" fill="#fff"/><path d="M31 24L12 14M31 28L10 28M31 32L12 44M33 24L52 14M33 28L54 28M33 32L52 44" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>';
    if (it.sonic && cat === 'baju') inner += '<ellipse cx="32" cy="35" rx="9" ry="12" fill="#f5c9a0"/><circle cx="11" cy="27" r="5" fill="#fff"/><circle cx="53" cy="27" r="5" fill="#fff"/><rect x="19" y="47" width="26" height="5" fill="#d7263d"/><rect x="19" y="47" width="26" height="1.6" fill="#fff"/>';
    if (it.pac && cat === 'baju') inner += '<circle cx="32" cy="32" r="11" fill="#111"/><path d="M32 32L42 27.5A11 11 0 1 0 42 36.5Z" fill="#ffd800"/><circle cx="34" cy="26.5" r="1.5" fill="#111"/><circle cx="46" cy="32" r="1.6" fill="#ffd800"/>';
    if (it.ramen && cat === 'baju') inner += '<path d="M17 25Q32 34 47 25L43 48Q32 55 21 48Z" fill="#f2c56c" stroke="#7d3c1c" stroke-width="2"/><path d="M19 24Q32 14 45 24" fill="none" stroke="#fff0bd" stroke-width="3"/><path d="M25 20L37 11M29 21L41 12" stroke="#8b5528" stroke-width="2"/>';
    if (it.naruto && cat === 'baju') inner += '<path d="M20 8L8 16L13 27L19 24V34H45V24L51 27L56 16L44 8Q32 16 20 8Z" fill="#3b3d48"/><path d="M32 14V56" stroke="#111" stroke-width="2"/><rect x="19" y="46" width="26" height="4" fill="#111"/><rect x="26" y="20" width="12" height="7" rx="1.5" fill="#c9d1d9" stroke="#1c2a56" stroke-width="2"/><circle cx="32" cy="23.5" r="2" fill="none" stroke="#1c2a56" stroke-width="1"/>';
    if (it.luffy && cat === 'baju') inner += '<path d="M24 28H40L38 46H26Z" fill="#ffd1b3"/><path d="M28 31L36 41M36 31L28 41" stroke="#b5654f" stroke-width="1.6"/><circle cx="21.5" cy="32" r="1.6" fill="#d4a017"/><circle cx="21.5" cy="38" r="1.6" fill="#d4a017"/><rect x="19" y="46" width="26" height="5" fill="#f7c81f"/><path d="M32 12Q22 12 22 19H42Q42 12 32 12Z" fill="#e8c15a"/><ellipse cx="32" cy="20" rx="17" ry="3.6" fill="#d9a93f"/><rect x="22" y="17.5" width="20" height="2.4" fill="#c0271f"/>';
    if (it.gojo && cat === 'baju') inner += '<path d="M26 8H38V17H26Z" fill="#10142a"/><circle cx="26.5" cy="25" r="5" fill="#2a3fb0" stroke="#0b0b10" stroke-width="2"/><circle cx="37.5" cy="25" r="5" fill="#2a3fb0" stroke="#0b0b10" stroke-width="2"/><path d="M31.5 25H32.5" stroke="#0b0b10" stroke-width="2"/><path d="M41 20L36 46" stroke="#0a0f1c" stroke-width="1.6"/><circle cx="41" cy="22" r="1.8" fill="#e0b84a"/><circle cx="32" cy="40" r="4.5" fill="#7fd0ff" stroke="#c9ecff" stroke-width="1.5"/>';
    if (it.web && cat === 'baju') inner += '<g stroke="#111" stroke-width="1.6" fill="#111" stroke-linecap="round"><ellipse cx="32" cy="35" rx="2.6" ry="5"/><circle cx="32" cy="28.5" r="1.8"/><path fill="none" d="M32 33L24 28M32 35L23 35M32 37L24 42M32 38L25 46M32 33L40 28M32 35L41 35M32 37L40 42M32 38L39 46"/></g>';
  } else if (cat === 'aksesoris') inner = ACC_ICONS[it.id] || '';
  else inner = `<text x="32" y="44" font-size="34" text-anchor="middle">${it.id.includes('api') ? '🔥' : (it.id.includes('_es') ? '❄️' : '✨')}</text>`;
  return `<svg viewBox="0 0 64 64" style="width:80%;height:80%">${inner}</svg>`;
}

function updateCharacterVisuals() {
  if (!character) return;
  const ap = (child, item) => applyItemMat(child.material, item);
  const { baju, iron, thor, celana: celanaV, sepatu: sepatuV } = pickCostume(playerData.equipped);
  character.traverse((child) => {
    if (!child.isMesh) return;
    if (child.userData.type === 'baju') ap(child, baju);
    if (child.userData.type === 'celana') ap(child, celanaV);
    if (child.userData.type === 'sepatu') ap(child, sepatuV);
  });
  setCostumeVis(baju, o => o);
  localFire = baju.ghost ? collectFire(character) : [];
  character.traverse(o => { if (o.isMesh && o.userData.type === 'rambut') o.visible = !(baju.saitama || baju.sonic || baju.venom || baju.flash || baju.ghost); });
  applyBodyType(character, { armL: leftArmPivot, armR: rightArmPivot, legL: leftLegPivot, legR: rightLegPivot }, baju.hulk, baju.sonic ? 0x1d5fd1 : baju.venom ? 0x0b0d16 : 0, costumeHairHex(baju));
  const a = playerData.equipped.aksesoris || 'aks_none';
  Object.keys(acc).forEach(id => { acc[id].visible = !(iron || thor) && id === a; });
  if (nameSprite) updateCharacterNameSprite(playerData.username, playerData.isDev);
  mpSyncEquipped();
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
// ===== LOBBY 3D: plaza siang hari bergaya mainan (matte, palet hangat, tanpa neon) =====
const LOBBY_BG = 0xbfe0f2;
function buildLobbyPlaza(root) {
  const rng = (() => { let sd = 20241; return () => (sd = (sd * 16807) % 2147483647) / 2147483647; })();
  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.92, metalness: 0, flatShading: true }, extra || {}));
  const put = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); (parent || root).add(o); return o; };
  const srgb = (t) => { if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const WOOD = 0x8a5a35, TERRA = 0xc0674a, CREAM = 0xf3e6c8, TEAL = 0x4f8f8b, LEAF = [0x5f9f4a, 0x4f8a47, 0x78b255];
  const PALETTE = [0xe8633a, 0xf2b84b, 0x4f9d8f, 0x5b7fd6];

  // Cahaya siang hari yang hangat
  root.add(new THREE.HemisphereLight(0xfff4e0, 0x93a85c, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.7); sun.position.set(-7, 14, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); sun.shadow.camera.updateProjectionMatrix();
  root.add(sun);

  // Tekstur paving batu bata krem
  const paving = (rep) => {
    const size = 256, c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); g.fillStyle = '#b9a47f'; g.fillRect(0, 0, size, size);
    const rows = 4, h = size / rows, w = size / 2;
    for (let r = 0; r < rows; r++) for (let k = -1; k <= 2; k++) {
      const j = Math.floor((rng() - 0.5) * 16), x = k * w + (r % 2) * w / 2;
      g.fillStyle = 'rgb(' + (230 + j) + ',' + (216 + j) + ',' + (188 + j) + ')';
      g.fillRect(x + 3, r * h + 3, w - 6, h - 6);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return srgb(t);
  };

  // Tanah rumput di sekeliling plaza
  const ground = put(new THREE.CircleGeometry(90, 48), mat(0x9ac46b), 0, -0.6, 0);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;

  // Plaza: lingkaran luar & dalam berpaving, tepi terakota membulat
  const sideTerra = mat(0xb5593f);
  const outer = put(new THREE.CylinderGeometry(19, 19, 0.7, 64), [sideTerra, mat(0xffffff, { map: paving(7), flatShading: false }), sideTerra], 0, -0.38, 0);
  outer.receiveShadow = true;
  const sideCream = mat(0xdcc9a2);
  const inner = put(new THREE.CylinderGeometry(12, 12, 0.12, 64), [sideCream, mat(0xffffff, { map: paving(4), flatShading: false }), sideCream], 0, 0.02, 0);
  inner.receiveShadow = true;
  const curbPts = [[18.6, -0.03], [18.6, 0.28], [18.85, 0.38], [19.2, 0.38], [19.45, 0.28], [19.45, -0.7]].map(p => new THREE.Vector2(p[0], p[1]));
  const curb = put(new THREE.LatheGeometry(curbPts, 64), mat(TERRA, { side: THREE.DoubleSide }), 0, 0, 0);
  curb.receiveShadow = true;

  // Lingkaran start di tengah + cincin penanda berputar pelan dari potongan warna-warni
  const startDisc = put(new THREE.CircleGeometry(3.0, 48), mat(CREAM), 0, 0.095, 0); startDisc.rotation.x = -Math.PI / 2; startDisc.receiveShadow = true;
  const startRing = put(new THREE.RingGeometry(3.0, 3.3, 64), mat(TERRA), 0, 0.1, 0); startRing.rotation.x = -Math.PI / 2;
  lobbyAccentRing = new THREE.Group(); lobbyAccentRing.rotation.x = -Math.PI / 2; lobbyAccentRing.position.set(0, 0.13, 0);
  const dashGeo = new THREE.BoxGeometry(0.5, 0.14, 0.06), dashMats = PALETTE.map(c => mat(c));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, d = new THREE.Mesh(dashGeo, dashMats[i % PALETTE.length]);
    d.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0); d.rotation.z = a + Math.PI / 2; lobbyAccentRing.add(d);
  }
  root.add(lobbyAccentRing);

  // Dinding belakang: bagian bawah teal, atas krem, ada rel dan atap kayu
  const wallW = 14;
  put(new THREE.BoxGeometry(wallW, 3.4, 0.8), mat(TEAL), 0, 1.3, -10).receiveShadow = true;
  put(new THREE.BoxGeometry(wallW, 6.0, 0.8), mat(0xe8d9b8), 0, 6.0, -10);
  put(new THREE.BoxGeometry(wallW + 0.4, 0.22, 1.0), mat(WOOD), 0, 3.0, -10);
  put(new THREE.BoxGeometry(wallW + 0.8, 0.3, 1.2), mat(WOOD), 0, 9.1, -10);

  // Papan nama bercat tangan (di atas papan leaderboard)
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 256;
  const sg = sc.getContext('2d');
  sg.fillStyle = '#6b4a2f'; sg.beginPath(); sg.roundRect(0, 0, 1024, 256, 36); sg.fill();
  sg.fillStyle = '#f4e7c8'; sg.beginPath(); sg.roundRect(14, 14, 996, 228, 26); sg.fill();
  sg.textAlign = 'center'; sg.textBaseline = 'middle';
  sg.font = '900 112px "Trebuchet MS", sans-serif'; sg.fillStyle = '#5a3a22'; sg.fillText('PARKOUR 3D', 512, 108);
  sg.font = 'bold 36px "Trebuchet MS", sans-serif'; sg.fillStyle = '#c0563a'; sg.fillText('L O B B Y', 512, 188);
  [0xe8633a, 0xf2b84b, 0x4f9d8f, 0x5b7fd6].forEach((c, i) => { sg.fillStyle = '#' + c.toString(16).padStart(6, '0'); sg.fillRect(330 + i * 90, 222, 70, 8); });
  const signTex = srgb(new THREE.CanvasTexture(sc));
  put(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }), 0, 6.7, -9.55);

  // Tiang kayu di tepi dinding + bendera segitiga warna-warni di antaranya
  const postGeo = new THREE.CylinderGeometry(0.24, 0.3, 9.1, 10);
  for (const sd of [-1, 1]) {
    put(postGeo, mat(WOOD), sd * 7.6, 4.45, -9.2);
    put(new THREE.SphereGeometry(0.34, 10, 8), mat(TERRA), sd * 7.6, 9.2, -9.2);
  }
  const bunt = (x) => [x, 8.9 - 0.6 * (1 - Math.pow(x / 7.6, 2)), -9.2];
  const curve = new THREE.CatmullRomCurve3([-7.6, -3.8, 0, 3.8, 7.6].map(x => new THREE.Vector3(...bunt(x))));
  put(new THREE.TubeGeometry(curve, 24, 0.025, 4), mat(0x5a3a22), 0, 0, 0);
  const N = 14, pos = [], col = [], cc = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const x0 = -7.4 + (i + 0.15) * (14.8 / N), x1 = -7.4 + (i + 0.85) * (14.8 / N), xm = (x0 + x1) / 2;
    const p0 = bunt(x0), p1 = bunt(x1), pm = bunt(xm); pm[1] -= 0.55;
    pos.push(...p0, ...p1, ...pm); cc.setHex(PALETTE[i % PALETTE.length]); for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b);
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  put(bg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0, 0, 0);

  // Pagar tanaman rendah di kiri-kanan dinding
  const hedgeMat = mat(0x5a9a46), hedgeGeo = new THREE.BoxGeometry(9.2, 1.3, 1.3);
  for (const sd of [-1, 1]) { const hg = put(hedgeGeo, hedgeMat, sd * 12.4, 0.35, -10); hg.castShadow = true; }

  // Pot batu berisi semak di kiri-kanan area start
  const potGeo = new THREE.CylinderGeometry(1.1, 0.95, 0.55, 14), bushGeo = new THREE.IcosahedronGeometry(0.95, 0), potMat = mat(0xc9b79a), bushMat = mat(LEAF[0]);
  for (const sd of [-1, 1]) {
    const pot = put(potGeo, potMat, sd * 5.3, 0.3, -1.2); pot.castShadow = true;
    const bush = put(bushGeo, bushMat, sd * 5.3, 1.05, -1.2); bush.castShadow = true;
  }

  // Pohon-pohon di luar plaza (pinus & bulat), kecuali sisi depan dekat kamera
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 1.8, 7), trunkMat = mat(0x7a5a3a);
  const coneGeo = new THREE.ConeGeometry(1.7, 3.2, 7), ballGeo = new THREE.IcosahedronGeometry(2.0, 0);
  const leafMats = LEAF.map(c => mat(c));
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2 + rng() * 0.25;
    if (Math.sin(ang) > 0.55) continue;                         // sisi depan dibiarkan terbuka
    const r = 25 + rng() * 10, x = Math.cos(ang) * r, z = Math.sin(ang) * r, sc2 = 0.9 + rng() * 0.7;
    const tree = new THREE.Group(); tree.position.set(x, -0.55, z); tree.scale.setScalar(sc2);
    put(trunkGeo, trunkMat, 0, 0.9, 0, tree);
    const lm = leafMats[i % leafMats.length];
    if (i % 2) { put(coneGeo, lm, 0, 3.0, 0, tree); put(coneGeo, lm, 0, 4.6, 0, tree).scale.setScalar(0.72); }
    else put(ballGeo, lm, 0, 3.2, 0, tree);
    root.add(tree);
  }

  // Awan datar di kejauhan
  const cloudGeo = new THREE.IcosahedronGeometry(1, 1), cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (const [cx, cy, cz, k] of [[-34, 30, -62, 1.3], [28, 36, -72, 1.6], [52, 28, -40, 1.1]]) {
    const cl = new THREE.Group(); cl.position.set(cx, cy, cz); cl.scale.setScalar(k * 3.2);
    for (const [ox, oy, sx] of [[0, 0, 1.3], [1.3, -0.15, 1.0], [-1.3, -0.2, 0.95], [0.5, 0.45, 0.85]]) { const p = new THREE.Mesh(cloudGeo, cloudMat); p.position.set(ox, oy, 0); p.scale.set(sx, sx * 0.62, sx * 0.8); cl.add(p); }
    root.add(cl);
  }
}
let parkourWorldGroup = null, lobbyWorldGroup = null, lobbyAccentRing = null;
let platforms = [], physics, lavaMat;
let leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, headGroup;
let joystickVector = new THREE.Vector2(0, 0);
let isRunning = false;
let trailParticles = [], jumpParticles = [];
let laserBeam = null; // Objek Laser NPC
let rig, leftElbow, rightElbow, leftKnee, rightKnee;
let lavaMapVisuals = null;
// Efek visual dan kamera khusus map Lava; tidak menyentuh sistem kostum/mahkota.

let sq = { x: 0, v: 0 }, moveVel = new THREE.Vector2(0, 0), wasGrounded = true, laserState = 'off';
const LASER_Z = -44, LASER_Y = 9.3;
let FIN_Y = 1e9, checkpoint = { p: null, set: false, x: 0, y: 0.25, z: 0 };
let usedCheckpointMat = null;
let activatedCheckpoints = new WeakSet(); // Setiap platform checkpoint hanya aktif sekali per putaran
let hazards = [], hitCD = 0, capePivot, spiderLogoGrp, acc = {};
const knock = new THREE.Vector2();
let batGrp, capeB, ironHelm, ironBody, thorHelm, thorBody, capeT;
let MAZE_H = 12, MAZE_Z = -101;
let zoomDir = 0, guards = [], mazeHinted = false, WIN = { x: 0, y: 0, z: -77 };
// Sistem multi-map (gacha): map aktif + dunia tiap map. Lihat blok SNOW-MODULE.
let lavaLandWorld = null, lavaLandWorldGroup = null;
let currentMap = 'lava', lavaWorld = null, snowWorld = null, snowWorldGroup = null, snowController = null, angkasaWorld = null, angkasaWorldGroup = null, angkasaController = null, mountainWorld = null, mountainWorldGroup = null, honeyWorld = null, honeyWorldGroup = null, laserWorld = null, laserWorldGroup = null, curGroundPlat = null, gachaBusy = false;
const ROASTS = {
  hit: ['Wah, pemain PALING BERUNTUNG hari ini... beruntung kena bola berduri 🍀😹', 'Beruntung banget ya, dilempar sejauh itu. Gratis lho 🚀😹', 'Selamat! Kamu terpilih jadi korban palang berputar 🏆💀', 'Keberuntungan kamu emang nggak ada obat, ketabrak mulu 🍀🤣'],
  fall: ['Beruntung banget jatuh ke lava, hangat kan? 🔥😹', 'Pemain paling beruntung sedunia: jatuh dari tempat yang sama lagi 🍀💀', 'Mantap, rekor jatuh terbaru! Lava bangga sama kamu 🏅🔥'],
  fake: ['Beruntung banget ketipu kotak palsu, yang asli malah kamu lewatin 😹🍀', 'Kotak palsu aja kamu percaya, pantes paling beruntung 🤣👻', 'Insting kamu emang paling beruntung... beruntung salah terus 🍀👻'],
  laser: ['Lasernya nyala sebentar, kamu tetap kena. Bakat langka 🍀💥', 'Kena laser lagi? Rekor kesialan paling beruntung 🏅💥', 'Tinggal lompat doang lho, beruntung banget kamu 😹⚡'],
  snowshot: ['Ditembak NPC salju! Harusnya ngumpet di balik dinding es 🧊🔫', 'NPC: "waktu habis, sayang" ❄️🔫', 'Berdiri di tempat terbuka pas NPC nembak? Dingin banget 🥶💥', 'Dinding esnya ada buat dipakai, bukan dipandang 🧊😹'],
  shot: ['Ditembak NPC gara-gara salah belok. Beruntung banget kamu 🍀🔫', 'Peta nggak bisa dibaca, tapi pistolnya akurat. Beruntung kamu 😹🔫', 'NPC: "makasih udah nyasar ke sini" 🔫💀', 'Satu lorong benar, kamu pilih yang salah. Pecah rekor 🏅🔫']
};
const isAdminUser = () => !!(playerData && (playerData.isDev === true || accountKey() === DEV_USERNAME));
// Pemain biasa di-roasting; admin/dev tidak (admin cuma dapat pesan biasa)
function roast(kind, plain) {
  if (isAdminUser()) { if (plain) showToast(plain); return; }
  const arr = ROASTS[kind];
  showToast(arr[Math.floor(Math.random() * arr.length)]);
}
let flyMode = false, godMode = false, flyUp = false, flyDown = false, flySpeed = 14;

function respawn() {
  resetRunTimer();
  if (typeof clearLocalFreeze === 'function' && localFreezeUntil) clearLocalFreeze();
  reviveLocal();
  character.position.set(checkpoint.x, checkpoint.y + 0.3, checkpoint.z);
  physics.velocityY = 0; moveVel.set(0, 0); knock.set(0, 0); guards.forEach(gd => gd.reset()); gameState = 'PLAYING';
  document.getElementById('overlay').style.display = 'none';
}

// ===== ADMIN PANEL (khusus Putzzdev) =====
function setupAdminPanel() {
  // Gunakan flag admin dari akun ATAU username pemilik; trim/case-insensitive agar panel tidak hilang karena format data.
  if (!isAdminUser() || document.getElementById('admin-btn')) return;
  const css = document.createElement('style');
  css.textContent = '#admin-wrap{position:fixed;top:54px;right:10px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:sans-serif}#admin-btn{padding:8px 12px;border:0;border-radius:10px;background:#ff3366;color:#fff;font-weight:700;cursor:grab;touch-action:none}#admin-panel{width:220px;padding:12px;border-radius:12px;background:rgba(15,15,25,.92);color:#fff;display:none;flex-direction:column;gap:8px;font-size:13px}#admin-title{cursor:grab;padding:4px 0;touch-action:none;user-select:none}#admin-panel button{padding:8px;border:0;border-radius:8px;background:#2d3550;color:#fff}#admin-panel button.on{background:#00b86b}#admin-roast{font-size:12px;color:#ffd166}#fly-ctrl{position:fixed;z-index:9999;right:14px;top:45%;display:none;flex-direction:column;gap:10px}#fly-ctrl button{width:56px;height:56px;border-radius:50%;border:0;background:rgba(255,255,255,.25);color:#fff;font-size:24px}';
  document.head.appendChild(css);
  const wrap = document.createElement('div'); wrap.id = 'admin-wrap';
  const btn = document.createElement('button'); btn.id = 'admin-btn'; btn.textContent = '🛠️ Admin';
  const panel = document.createElement('div'); panel.id = 'admin-panel';
  panel.innerHTML = '<b id="admin-title">☰ Admin Panel - Putzzdev (geser)</b><button id="ad-fly">✈️ Terbang: OFF (F)</button><label>Kecepatan: <span id="ad-spd">14</span><input id="ad-speed" type="range" min="5" max="40" value="14" style="width:100%"></label><button id="ad-god">🛡️ Anti-mati: OFF</button><button data-tp="start">📍 Ke Start</button><button data-tp="hub">📍 Ke Hub Tower</button><button data-tp="top">🏁 Ke Puncak Tower</button><button data-tp="maze">🧩 Ke Labirin</button><button data-tp="finish">🎉 Ke Finish</button><button id="ad-coin">🪙 +1000 Koin</button><hr style="width:100%;border-color:#46516b"><b>👑 PENGATURAN MAHKOTA</b><label>Batas masuk leaderboard<input id="ad-crown-min" type="number" min="0" max="999999" value="3" style="width:100%;padding:7px;border-radius:6px"></label><button id="ad-crown-save-min">Simpan batas ke Firebase</button><label>Username pemain<input id="ad-crown-user" type="text" placeholder="username" style="width:100%;padding:7px;border-radius:6px"></label><label>Jumlah mahkota<input id="ad-crown-count" type="number" min="0" max="999999" value="0" style="width:100%;padding:7px;border-radius:6px"></label><button id="ad-crown-set">Atur mahkota pemain</button>';
  const fc = document.createElement('div'); fc.id = 'fly-ctrl';
  fc.innerHTML = '<button id="fly-up">▲</button><button id="fly-down">▼</button>';
  wrap.append(btn, panel); document.body.append(wrap, fc);
  setupAdminAnnouncementComposer(panel);

  // Geser panel: tahan & seret tombol Admin atau judul panel
  let moved = false;
  const makeDrag = (handle) => handle.addEventListener('pointerdown', (e) => {
    const r = wrap.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top, sx = e.clientX, sy = e.clientY;
    moved = false; wrap.style.right = 'auto'; wrap.style.left = r.left + 'px'; wrap.style.top = r.top + 'px';
    handle.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) moved = true;
      if (!moved) return;
      wrap.style.left = Math.max(0, Math.min(innerWidth - wrap.offsetWidth, ev.clientX - ox)) + 'px';
      wrap.style.top = Math.max(0, Math.min(innerHeight - wrap.offsetHeight, ev.clientY - oy)) + 'px';
    };
    const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
    handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
  makeDrag(btn); makeDrag(document.getElementById('admin-title'));
  btn.onclick = () => { if (moved) { moved = false; return; } panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; };
  const setFly = (v) => {
    flyMode = v; fc.style.display = v ? 'flex' : 'none'; flyUp = flyDown = false; physics.velocityY = 0;
    const b = document.getElementById('ad-fly'); b.classList.toggle('on', v); b.textContent = '✈️ Terbang: ' + (v ? 'ON' : 'OFF') + ' (F)';
  };
  document.getElementById('ad-fly').onclick = () => setFly(!flyMode);
  document.getElementById('ad-speed').oninput = (e) => { flySpeed = +e.target.value; document.getElementById('ad-spd').textContent = flySpeed; };
  document.getElementById('ad-god').onclick = (e) => { godMode = !godMode; e.target.classList.toggle('on', godMode); e.target.textContent = '🛡️ Anti-mati: ' + (godMode ? 'ON' : 'OFF'); };
  panel.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => {
    const d = (currentMap === 'snow' && snowWorld ? snowWorld.tp : (currentMap === 'mountain' && mountainWorld ? mountainWorld.tp : { start: [0, 0.25, 0], hub: [0, 13.75, -68], top: [0, FIN_Y, -77], maze: [-2, FIN_Y, -85], finish: [WIN.x, FIN_Y, WIN.z] }))[b.dataset.tp];
    character.position.set(...d); physics.velocityY = 0; moveVel.set(0, 0);
    if (gameState === 'GAMEOVER') { resetRunTimer(); reviveLocal(); gameState = 'PLAYING'; document.getElementById('overlay').style.display = 'none'; }
  });
  document.getElementById('ad-coin').onclick = () => {
    playerData.coins = (playerData.coins || 0) + 1000; updatePlayerFirebase();
    document.getElementById('coin-amount').textContent = playerData.coins; showToast('🪙 +1000 koin');
  };
  document.getElementById('ad-crown-min').value = String(leaderboardMinCrowns);
  document.getElementById('ad-crown-save-min').onclick = async () => {
    const value = Math.max(0, Math.floor(Number(document.getElementById('ad-crown-min').value) || 0));
    try {
      await socialPatch('settings', { leaderboardMinCrowns: value });
      leaderboardMinCrowns = value;
      await refreshSoloLeaderboard(true);
      showToast(`✅ Minimal leaderboard: ${value} mahkota`);
    } catch (e) { showToast('Gagal menyimpan pengaturan mahkota'); }
  };
  document.getElementById('ad-crown-set').onclick = async () => {
    const key = document.getElementById('ad-crown-user').value.trim().toLowerCase();
    const count = Math.max(0, Math.floor(Number(document.getElementById('ad-crown-count').value) || 0));
    if (!/^[a-z0-9_]{3,15}$/.test(key)) { showToast('Masukkan username yang valid'); return; }
    try {
      const exists = await socialGet(`players/${key}`);
      if (!exists) { showToast('Username tidak ditemukan'); return; }
      await socialPatch(`players/${key}`, { crowns: count, crownsUpdatedAt: Date.now() });
      await socialPatch(`leaderboard/${key}`, { crowns: count });
      if (key === myPlayerKey()) { playerData.crowns = count; updateCrownProfileUI(); }
      await refreshSoloLeaderboard(true);
      showToast(`👑 Mahkota ${key} diatur menjadi ${count}`);
    } catch (e) { showToast('Gagal mengatur mahkota di Firebase'); }
  };
  const hold = (id, up) => {
    const el = document.getElementById(id), set = (v) => { if (up) flyUp = v; else flyDown = v; };
    el.onpointerdown = () => set(true);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => set(false)));
  };
  hold('fly-up', true); hold('fly-down', false);
  window.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
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

// ===== BADAN HANCUR (jatuh ke lava) — ikut tampil di layar pemain lain =====
const shardGeos = [new THREE.BoxGeometry(1, 1, 1), new THREE.CapsuleGeometry(0.4, 0.5, 2, 6), new THREE.TetrahedronGeometry(0.8), new THREE.SphereGeometry(0.5, 8, 6)];
const debris = [];
function spawnShatter(pos, eq) {
  if (!scene) return;
  const c = pickCostume(eq || {}), metal = c.baju.iron ? 0.75 : c.baju.thor ? 0.55 : 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const px = pos.x, py = pos.y, pz = pos.z;
  const groups = [ // [warna, jumlah, y0, y1, sebaran x, ukuran, logam]
    [c.hulk ? 0x57b84a : 0xffd1b3, 6, 2.0, 2.4, 0.15, 0.2, 0], [c.hulk ? 0x141a12 : 0xd1d1d6, 4, 2.3, 2.5, 0.15, 0.14, 0],
    [c.baju.color, 10, 1.0, 1.9, 0.3, 0.26, metal], [c.baju.color, 6, 1.2, 1.9, 0.55, 0.2, metal],
    [c.hulk ? 0x57b84a : 0xffd1b3, 2, 1.0, 1.4, 0.55, 0.16, 0], [c.celana.color, 8, 0.3, 0.9, 0.2, 0.22, 0], [c.sepatu.color, 4, 0.05, 0.3, 0.25, 0.2, 0]
  ];
  if (c.iron) groups.push([0xd4a017, 6, 1.0, 2.2, 0.4, 0.15, 0.8]);
  if (c.thor) groups.push([0xc9d1d9, 6, 1.0, 2.4, 0.4, 0.15, 0.85], [0xc0132b, 4, 1.2, 2.0, 0.4, 0.22, 0]);
  for (const [color, n, y0, y1, sx, size, mt] of groups) for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: mt, transparent: true, opacity: 1, envMap: mt && envTex ? envTex : null });
    const m = new THREE.Mesh(shardGeos[Math.floor(Math.random() * shardGeos.length)], mat), sc = size * rnd(0.7, 1.3);
    m.scale.set(sc * rnd(0.7, 1.3), sc * rnd(0.7, 1.3), sc * rnd(0.7, 1.3));
    m.position.set(px + rnd(-sx, sx), py + rnd(y0, y1), pz + rnd(-0.25, 0.25));
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    scene.add(m);
    debris.push({ mesh: m, vx: (m.position.x - px) * 9 + rnd(-2, 2), vy: rnd(3, 10), vz: (m.position.z - pz) * 9 + rnd(-2, 2), rx: rnd(-12, 12), ry: rnd(-12, 12), rz: rnd(-12, 12), life: 1, sink: false });
  }
  while (debris.length > 160) { const o = debris.shift(); scene.remove(o.mesh); o.mesh.material.dispose(); }
  for (let i = 0; i < 14; i++) { // percikan lava
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff7722 : 0xffcc33, transparent: true, opacity: 1 }));
    m.position.set(px, py + rnd(0, 1.5), pz);
    const ang = Math.random() * Math.PI * 2, sp = rnd(1.5, 5);
    m.userData = { vx: Math.cos(ang) * sp, vy: rnd(2, 7), vz: Math.sin(ang) * sp };
    scene.add(m); jumpParticles.push({ mesh: m, life: 1 });
  }
}
function updateDebris(delta) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i], m = d.mesh;
    if (d.sink) { m.position.y -= delta * 0.6; d.life -= delta * 1.6; }
    else {
      d.vy -= 22 * delta;
      m.position.x += d.vx * delta; m.position.y += d.vy * delta; m.position.z += d.vz * delta;
      m.rotation.x += d.rx * delta; m.rotation.y += d.ry * delta; m.rotation.z += d.rz * delta;
      if (m.position.y < -7.6) { m.position.y = -7.6; d.sink = true; }
      d.life -= delta * 0.35;
    }
    m.material.opacity = Math.min(1, d.life * 1.2);
    if (d.life <= 0) { scene.remove(m); m.material.dispose(); debris.splice(i, 1); }
  }
}
function shatterLocal() {
  if (!character || !character.visible) return;
  spawnShatter(character.position, myEquipped());
  character.visible = false;
  if (myRef) update(myRef, { deadAt: serverNow() }).catch(() => {});
}
function reviveLocal() {
  if (character) character.visible = true;
  if (myRef) update(myRef, { deadAt: null }).catch(() => {});
}

function tryAutoLandscape() {
  // Penguncian orientasi dicoba otomatis; browser tertentu hanya mengizinkannya
  // setelah interaksi pengguna atau saat mode fullscreen.
  try {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      const result = screen.orientation.lock('landscape');
      if (result && typeof result.catch === 'function') result.catch(() => {});
    }
  } catch (e) { /* orientasi otomatis tidak didukung browser */ }
}

function requestFullscreenAndLock() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().then(() => {
      tryAutoLandscape();
    }).catch(e => console.log(e));
  } else {
    tryAutoLandscape();
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
  try { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch (e) { console.warn('Env map gagal:', e); }
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 50, 10);
  sun.castShadow = true;
  scene.add(sun);

  // Map Lava visual dipisah ke lava.js agar modul map mudah dirawat.
  lavaMapVisuals = buildLavaMap(scene);
  lavaMat = lavaMapVisuals.lavaMat;

  const platformMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.8 });
  const breakableMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
  const movingMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.7 });
  const trapMat = new THREE.MeshStandardMaterial({ color: 0xff0055, roughness: 0.5 }); // Warna platform jebakan

  function createPlatform(x, y, z, width, depth, type = 'static', tell = 0, shape = 'box') {
    const height = 0.5;
    const geo = shape === 'box' ? new THREE.BoxGeometry(width, height, depth) : new THREE.CylinderGeometry(width / 2, width / 2, height, shape === 'hex' ? 6 : 32);
    const base = shape === 'round' ? roundMat : (shape === 'hex' ? hexMat : platformMat);
    let mat = base;
    if (type.includes('moving')) mat = movingMat;
    if (type === 'fake') {
      // Kotak palsu memakai tampilan material yang sama seperti kotak asli.
      // Tidak ada transparansi atau efek berkedip sebelum pemain mendekat.
      mat = base.clone();
      mat.transparent = false;
      mat.opacity = 1;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true; mesh.castShadow = true;
    scene.add(mesh);

    platforms.push({ 
      mesh, width, depth, type, 
      startX: x, startY: y, startZ: z, 
      range: 2.5, speed: 1.5, phase: (platforms.length * 2.39996) % (Math.PI * 2), 
      isFallen: false, tell, revealTimer: 0, dx: 0, r: shape === 'round' ? width / 2 : (shape === 'hex' ? width * 0.45 : 0) 
    });
  }

  const roundMat = new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.6 });
  const hexMat = new THREE.MeshStandardMaterial({ color: 0x5a3a7a, roughness: 0.6 });
  const hazMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xe02030, emissive: 0x551018, roughness: 0.5 });

  // Palang berputar: lompati atau terpental
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

  // Bola berduri berayun
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

  // ============ JALUR PARKOUR DENGAN JEBAKAN KIRI/KANAN & LASER NPC ============
  createPlatform(0, 0, 0, 8, 8, 'static');         // Start
  createPlatform(0, 1.5, -8, 5, 5, 'static', 0, 'round'); addPendulum(0, 1.5, -8, 'x');
  
  // Jebakan Kiri / Kanan Pertama (Kiri jebakan jatuh, Kanan aman)
  createPlatform(-2.5, 3, -15, 3.5, 3.5, 'fake', 0.9);  // KOTAK PALSU (jelas)
  createPlatform(2.5, 3, -15, 3.5, 3.5, 'static');       // AMAN

  createPlatform(0, 4.5, -22, 6, 6, 'moving_x', 0, 'hex'); addPendulum(0, 4.5, -22, 'z');

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

  createPlatform(0, 10.5, -52, 5, 5, 'moving_y', 0, 'round');
  // Jembatan kaca: tiap baris 1 asli, 1 palsu (hampir tak terlihat, cuma sesekali berkedip)
  createPlatform(-2, 12, -58, 3.2, 2.5, 'static'); createPlatform(2, 12, -58, 3.2, 2.5, 'fake', 0.15);
  createPlatform(-2, 12, -61.5, 3.2, 2.5, 'fake', 0.05); createPlatform(2, 12, -61.5, 3.2, 2.5, 'static');
  createPlatform(0, 13.5, -68, 8, 8, 'static');
  const checkMat = new THREE.MeshStandardMaterial({ color: 0x22aa55, emissive: 0x22aa55, emissiveIntensity: 0.4 });
  usedCheckpointMat = new THREE.MeshStandardMaterial({ color: 0x666677, emissive: 0x222233, emissiveIntensity: 0.12, roughness: 0.85 });
  const markCheckpoint = () => { const c = platforms[platforms.length - 1]; c.checkpoint = true; c.checkpointActivated = false; c.checkpointReadyMaterial = checkMat; c.mesh.material = checkMat; };
  markCheckpoint(); // Hub = checkpoint

  // ===== TOWER SPIRAL ala obby Roblox: muter naik ke atas =====
  const TC = { x: 0, z: -77 }, TR = 9, TN = 58, TDY = 1.1, TDA = 0.55;
  let ty = 13.5, ta = Math.PI / 2;
  const SH = ['box', 'round', 'hex'];
  const tHash = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
  for (let i = 1; i <= TN; i++) {
    ta += TDA; ty += TDY;
    const rx = Math.cos(ta), rz = Math.sin(ta), cx = TC.x + rx * TR, cz = TC.z + rz * TR;
    const hard = i > 29; // paruh atas: kotak palsu nyaris identik, pilihan 3 jalur, bola berduri, kotak asli yang ikut berkedip (pengecoh)
    const tell = hard ? 0.02 : Math.max(0.05, 0.5 - i * 0.015);
    const sh = SH[i % 3], w = sh === 'box' ? 3.2 : 3.6;
    const choice = (n, gap) => {
      const real = Math.floor(tHash(i) * n); // posisi kotak asli acak tapi tetap (bisa dihafal)
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * gap;
        createPlatform(TC.x + rx * (TR + off), ty, TC.z + rz * (TR + off), w, w, k === real ? 'static' : 'fake', tell, sh);
      }
    };
    if (i % 5 === 0) {
      choice(hard ? 3 : 2, hard ? 3.8 : 5.6);
    } else if (i % 8 === 0) {
      createPlatform(cx, ty, cz, 4, 4, 'static', 0, 'round'); markCheckpoint();
    } else if (i % 11 === 6) {
      createPlatform(cx, ty, cz, 5.4, 5.4, 'static', 0, 'round'); addSweeper(cx, ty, cz, 4.6, 1.5 + i * 0.02);
    } else if (hard && i % 9 === 4) {
      createPlatform(cx, ty, cz, 4.4, 4.4, 'static', 0, 'round'); addPendulum(cx, ty, cz, i % 2 ? 'x' : 'z');
    } else if (hard && i % 7 === 2) {
      choice(2, 5.6);
    } else if (i % 7 === 3) {
      createPlatform(cx, ty, cz, w, w, 'moving_y', 0, sh); platforms[platforms.length - 1].range = hard ? 1.4 : 0.9;
    } else {
      createPlatform(cx, ty, cz, w, w, 'static', 0, sh);
      if (hard && i % 3 === 1) {
        const d = platforms[platforms.length - 1];
        d.decoy = true;
        d.mesh.material = d.mesh.material.clone();
        d.mesh.material.transparent = false;
        d.mesh.material.opacity = 1;
      }
    }
  }
  createPlatform(TC.x + Math.cos(ta) * 6.3, ty + 0.55, TC.z + Math.sin(ta) * 6.3, 3, 3, 'static'); // penghubung
  const FY = ty + 1.1; FIN_Y = FY + 0.25;
  createPlatform(TC.x, FY, TC.z, 8, 8, 'static'); // PUNCAK / FINISH
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, FY - 12.25, 16), new THREE.MeshStandardMaterial({ color: 0x2a2a3a }));
  pillar.position.set(TC.x, (12 + FY - 0.25) / 2, TC.z); scene.add(pillar);
  { const tp = platforms.find(pl => Math.abs(pl.mesh.position.x - TC.x) < 0.01 && Math.abs(pl.mesh.position.z - TC.z) < 0.01 && Math.abs(pl.mesh.position.y - FY) < 0.01); if (tp) { tp.checkpoint = true; tp.checkpointActivated = false; tp.checkpointReadyMaterial = checkMat; tp.mesh.material = checkMat; } }

  // ===== LABIRIN DI ATAS TOWER (salah lorong = ditembak NPC) =====
  const MN = 12, CS = 4, mcx = 0, MH = MN * CS / 2, mcz = -89 - MH, wallH = 7, floorTop = FY + 0.25, EC = Math.floor(MN / 2) - 1;
  MAZE_H = MH; MAZE_Z = mcz;
  WIN = { x: mcx - MH + CS / 2 + CS * (EC + 1), y: FY, z: mcz - MH - 4 };
  createPlatform(mcx - MH + CS / 2 + CS * EC, FY, -85, 4, 8, 'static'); markCheckpoint(); // jembatan = checkpoint
  createPlatform(mcx, FY, mcz, 2 * MH, 2 * MH, 'static');   // lantai labirin
  createPlatform(WIN.x, FY, WIN.z, 8, 8, 'static'); // area finish setelah labirin

  const cells = [];
  for (let r = 0; r < MN; r++) { cells[r] = []; for (let c = 0; c < MN; c++) cells[r][c] = { n: true, e: true, s: true, w: true, v: false }; }
  let seed = 13; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const stack = [[0, EC]]; cells[0][EC].v = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1], nb = [];
    if (r > 0 && !cells[r - 1][c].v) nb.push([r - 1, c, 'n', 's']);
    if (r < MN - 1 && !cells[r + 1][c].v) nb.push([r + 1, c, 's', 'n']);
    if (c > 0 && !cells[r][c - 1].v) nb.push([r, c - 1, 'w', 'e']);
    if (c < MN - 1 && !cells[r][c + 1].v) nb.push([r, c + 1, 'e', 'w']);
    if (!nb.length) { stack.pop(); continue; }
    const [nr, nc, d1, d2] = nb[Math.floor(rnd() * nb.length)];
    cells[r][c][d1] = false; cells[nr][nc][d2] = false; cells[nr][nc].v = true; stack.push([nr, nc]);
  }
  cells[0][EC].n = false; cells[MN - 1][EC + 1].s = false; // pintu masuk & keluar

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5b6180, roughness: 0.8 });
  const addWall = (x, z, w, d) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    mesh.position.set(x, floorTop + wallH / 2, z); scene.add(mesh);
    platforms.push({ mesh, width: w, depth: d, type: 'wall', hh: wallH / 2, startX: x, startY: mesh.position.y, startZ: z, range: 0, speed: 0, phase: 0, isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: 0 });
  };
  const cxOf = (c) => mcx - MH + CS / 2 + CS * c, czOf = (r) => mcz + MH - CS / 2 - CS * r;
  for (let r = 0; r < MN; r++) for (let c = 0; c < MN; c++) {
    const k = cells[r][c], x = cxOf(c), z = czOf(r);
    if (r === 0 && k.n) addWall(x, z + 2, CS + 0.6, 0.6);
    if (c === 0 && k.w) addWall(x - 2, z, 0.6, CS + 0.6);
    if (k.s) addWall(x, z - 2, CS + 0.6, 0.6);
    if (k.e) addWall(x + 2, z, 0.6, CS + 0.6);
  }

  // Atap labirin menutup pandangan dari luar, tetapi tidak mengubah jalur/collision maze.
  const mazeRoof = new THREE.Mesh(
    new THREE.BoxGeometry(2 * MH + 1.2, 0.55, 2 * MH + 1.2),
    new THREE.MeshStandardMaterial({ color: 0x241b22, roughness: 0.92, metalness: 0.12 })
  );
  mazeRoof.position.set(mcx, floorTop + wallH + 0.3, mcz);
  mazeRoof.receiveShadow = true; mazeRoof.castShadow = true; scene.add(mazeRoof);
  const roofGlow = new THREE.Mesh(
    new THREE.BoxGeometry(2 * MH - 1.5, 0.08, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xff4b12 })
  );
  roofGlow.position.set(mcx, floorTop + wallH + 0.02, mcz);
  scene.add(roofGlow);

  // jalur benar (BFS pintu masuk -> keluar); semua sel di luar jalur = lorong salah
  const key = (r, c) => r + ',' + c;
  const nbrs = (r, c) => { const o = [], k = cells[r][c]; if (!k.n && r > 0) o.push([r - 1, c]); if (!k.s && r < MN - 1) o.push([r + 1, c]); if (!k.w && c > 0) o.push([r, c - 1]); if (!k.e && c < MN - 1) o.push([r, c + 1]); return o; };
  const prev = { [key(0, EC)]: null }, bq = [[0, EC]];
  while (bq.length) { const [r, c] = bq.shift(); for (const [nr, nc] of nbrs(r, c)) if (!(key(nr, nc) in prev)) { prev[key(nr, nc)] = [r, c]; bq.push([nr, nc]); } }
  const onPath = new Set(); for (let cur = [MN - 1, EC + 1]; cur; cur = prev[key(cur[0], cur[1])]) onPath.add(key(cur[0], cur[1]));
  // checkpoint di tengah labirin (1/3 dan 2/3 jalur benar) supaya tidak mulai dari awal terus
  const pathArr = [...onPath].map(sk => sk.split(',').map(Number)).reverse();
  [Math.floor(pathArr.length / 3), Math.floor(pathArr.length * 2 / 3)].forEach(ix => {
    const [pr, pc] = pathArr[ix];
    createPlatform(cxOf(pc), FY + 0.01, czOf(pr), 2.4, 2.4, 'static', 0, 'round');
    const pd = platforms.pop(); platforms.unshift(pd); pd.checkpoint = true; pd.checkpointActivated = false; pd.checkpointReadyMaterial = checkMat; pd.mesh.material = checkMat;
  });

  // NPC penembak berdiri di ujung buntu tiap cabang lorong salah
  const AIM_TIME = 1.1;
  function makeGuard(gx, gz, set) {
    const g = new THREE.Group(); g.position.set(gx, floorTop, gz); scene.add(g);
    const armor = new THREE.MeshStandardMaterial({ color: 0x1f2740, metalness: 0.5, roughness: 0.4 });
    const add = (geo, mat, x, y, z, par = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
    add(new THREE.CapsuleGeometry(0.3, 0.8, 4, 12), armor, 0, 1.4, 0);
    add(new THREE.SphereGeometry(0.28, 20, 16), new THREE.MeshStandardMaterial({ color: 0x2a2a35, metalness: 0.4 }), 0, 2.4, 0);
    add(new THREE.BoxGeometry(0.4, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2200 }), 0, 2.42, 0.22);
    for (const sd of [-1, 1]) add(new THREE.CapsuleGeometry(0.12, 0.45, 4, 8), armor, sd * 0.15, 0.5, 0);
    add(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), armor, -0.42, 1.55, 0);
    const armR = new THREE.Group(); armR.position.set(0.4, 1.95, 0); armR.rotation.x = -1.45; g.add(armR);
    add(new THREE.CapsuleGeometry(0.09, 0.45, 4, 8), armor, 0, -0.35, 0, armR);
    add(new THREE.BoxGeometry(0.13, 0.36, 0.16), new THREE.MeshStandardMaterial({ color: 0x111118, metalness: 0.7 }), 0, -0.82, 0, armR);
    const muzzle = add(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0x66f6ff }), 0, -1.02, 0, armR);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.9 }));
    beam.visible = false; scene.add(beam);
    const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const setBeam = (pp, rad) => { muzzle.getWorldPosition(A); B.set(pp.x, pp.y + 1.2, pp.z); D.subVectors(B, A); const len = D.length() || 0.01; beam.position.copy(A).addScaledVector(D, 0.5); beam.scale.set(rad, len, rad); beam.quaternion.setFromUnitVectors(UP, D.normalize()); };
    let state = 'idle', timer = 0;
    return {
      reset() { state = 'idle'; timer = 0; beam.visible = false; },
      update(delta, pp, t, canKill) {
        const col = Math.floor((pp.x - (mcx - MH)) / CS), row = Math.floor(((mcz + MH) - pp.z) / CS);
        const inside = pp.y > FY - 1 && pp.y < FY + 4 && set.has(key(row, col));
        if (state === 'idle') {
          g.rotation.y = Math.sin(t * 0.8 + gx) * 0.5;
          if (inside) { // salah jalan: NPC langsung menembak, tanpa jeda bidik
            g.rotation.y = Math.atan2(pp.x - gx, pp.z - gz);
            state = 'fire'; timer = 0; setBeam(pp, 0.12); beam.material.color.setHex(0x66f6ff); beam.visible = true;
            showToast('🔫 Salah lorong!');
            return canKill;
          }
          return false;
        }
        let df = Math.atan2(pp.x - gx, pp.z - gz) - g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
        g.rotation.y += df * (1 - Math.exp(-delta * 10));
        timer += delta;
        if (state === 'aim') {
          if (!inside) { this.reset(); return false; }
          setBeam(pp, 0.03); beam.material.color.setHex(0xff2200); beam.visible = Math.sin(timer * 30) > -0.3;
          if (timer >= AIM_TIME) { state = 'fire'; timer = 0; setBeam(pp, 0.12); beam.material.color.setHex(0x66f6ff); beam.visible = true; return canKill; }
        } else if (state === 'fire') {
          setBeam(pp, 0.12);
          if (timer > 0.35) this.reset();
        }
        return false;
      }
    };
  }
  const seen = new Set();
  for (const pk of onPath) {
    const [pr, pc] = pk.split(',').map(Number);
    for (const [r0, c0] of nbrs(pr, pc)) {
      if (onPath.has(key(r0, c0)) || seen.has(key(r0, c0))) continue;
      const set = new Set([key(r0, c0)]), dq = [[r0, c0, 0]]; let deep = [r0, c0, 0]; seen.add(key(r0, c0));
      while (dq.length) {
        const [r, c, d] = dq.shift(); if (d > deep[2]) deep = [r, c, d];
        for (const [nr, nc] of nbrs(r, c)) if (!onPath.has(key(nr, nc)) && !set.has(key(nr, nc))) { set.add(key(nr, nc)); seen.add(key(nr, nc)); dq.push([nr, nc, d + 1]); }
      }
      guards.push(makeGuard(cxOf(deep[1]), czOf(deep[0]), set));
    }
  }
      // Puncak / Finish

  // FINISH LINE
  const finishLine = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 7), new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1 }));
  finishLine.position.set(WIN.x, FY + 0.3, WIN.z); scene.add(finishLine);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const leftPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), poleMat); leftPole.position.set(WIN.x - 4, FY + 3, WIN.z); scene.add(leftPole);
  const rightPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), poleMat); rightPole.position.set(WIN.x + 4, FY + 3, WIN.z); scene.add(rightPole);

  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 15; ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = '#00ff00'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PUTZZDEV MENGAKUI', canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = 'bold 90px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('KAMU JAGO!', canvas.width / 2, canvas.height / 2 + 50);

  const texture = new THREE.CanvasTexture(canvas); texture.needsUpdate = true;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, emissive: 0x00ff00, emissiveIntensity: 0.2 }));
  board.position.set(WIN.x, FY + 4, WIN.z); scene.add(board);

  // Pisahkan arena parkour dari area lobby. Seluruh logika arena tetap utuh;
  // hanya visibilitas grup yang berganti saat pemain menekan MULAI.
  parkourWorldGroup = new THREE.Group();
  parkourWorldGroup.name = 'PARKOUR_WORLD';
  [...scene.children].forEach(obj => { scene.remove(obj); parkourWorldGroup.add(obj); });
  scene.add(parkourWorldGroup);
  parkourWorldGroup.visible = false;
  lavaWorld = { platforms, hazards, guards, laserBeam, FIN_Y, WIN, MAZE_H, MAZE_Z };
  try { const builtSnow = buildSnowWorld(THREE, scene, { runElapsedMs, insidePlat, showToast }); snowWorld = builtSnow.world; snowWorldGroup = builtSnow.group; snowController = builtSnow.controller; } catch (e) { console.error('Map Salju gagal dibuat, hanya Lava yang aktif:', e); snowWorld = null; snowController = null; if (snowWorldGroup) { scene.remove(snowWorldGroup); snowWorldGroup = null; } }
  try { const builtAngkasa = buildAngkasaWorld(THREE, scene, { showToast }); angkasaWorld = builtAngkasa.world; angkasaWorldGroup = builtAngkasa.group; angkasaController = builtAngkasa.controller; } catch (e) { console.error('Map Angkasa gagal dibuat:', e); angkasaWorld = null; angkasaController = null; if (angkasaWorldGroup) { scene.remove(angkasaWorldGroup); angkasaWorldGroup = null; } }
  try { const builtMountain = buildMountainWorld(THREE, scene, { showToast }); mountainWorld = builtMountain.world; mountainWorldGroup = builtMountain.group; } catch (e) { console.error('Map Gunung gagal dibuat:', e); mountainWorld = null; if (mountainWorldGroup) { scene.remove(mountainWorldGroup); mountainWorldGroup = null; } }
  try { honeyWorld = buildHoneyWorld(THREE, scene, { onTileStep: (i) => { if (myRef) update(myRef, { ['ht/t' + i]: serverNow() }).catch(() => {}); } }); honeyWorldGroup = honeyWorld.group; honeyWorldGroup.visible = false; }
  catch (e) { console.error('Map Honey gagal dibuat:', e); honeyWorld = null; }
  try { laserWorld = buildLaserWorld(THREE, scene); laserWorldGroup = laserWorld.group; laserWorldGroup.visible = false; }
  catch (e) { console.error('Map Laser gagal dibuat:', e); laserWorld = null; laserWorldGroup = null; }
  try { lavaLandWorld = buildLavaLandWorld(THREE, scene, { onTileStep: (i) => { if (myRef) update(myRef, { ['lt/t' + i]: serverNow() }).catch(() => {}); } }); lavaLandWorldGroup = lavaLandWorld.group; lavaLandWorldGroup.visible = false; }
  catch (e) { console.error('Map Lava Land gagal dibuat:', e); lavaLandWorld = null; lavaLandWorldGroup = null; }

  lobbyWorldGroup = new THREE.Group();
  lobbyWorldGroup.name = 'LOBBY_PLAZA';
  scene.add(lobbyWorldGroup);
  buildLobbyPlaza(lobbyWorldGroup);
  lobbyWorldGroup.visible = true;
  scene.background = new THREE.Color(LOBBY_BG); scene.fog = new THREE.Fog(LOBBY_BG, 45, 110);

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

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 16, 48), matShirt); torso.position.y = 1.4; torso.castShadow = true; torso.userData.type = 'baju'; character.add(torso);
  headGroup = new THREE.Group(); headGroup.position.y = 2.2; character.add(headGroup);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), matSkin); head.userData.type = 'kulit'; head.castShadow = true; headGroup.add(head);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matEyeWhite); leftEye.position.set(-0.1, 0.05, 0.27); headGroup.add(leftEye);
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matPupil); leftPupil.position.set(-0.1, 0.05, 0.31); headGroup.add(leftPupil);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matEyeWhite); rightEye.position.set(0.1, 0.05, 0.27); headGroup.add(rightEye);
  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matPupil); rightPupil.position.set(0.1, 0.05, 0.31); headGroup.add(rightPupil);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 16), matSkin); nose.userData.type = 'kulit'; nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.02, 0.3); headGroup.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), matPupil); mouth.position.set(0, -0.12, 0.28); headGroup.add(mouth);

  const hairGroup = new THREE.Group(); headGroup.add(hairGroup);
  const baseHair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.6), matHair); baseHair.position.y = 0.02; baseHair.castShadow = true; hairGroup.add(baseHair);
  const bangGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
  const bangLeft = new THREE.Mesh(bangGeo, matHair); bangLeft.position.set(-0.15, 0.15, 0.24); bangLeft.rotation.set(0.2, 0, -0.3); hairGroup.add(bangLeft);
  const bangCenter = new THREE.Mesh(bangGeo, matHair); bangCenter.position.set(0, 0.2, 0.27); bangCenter.rotation.set(0.1, 0, 0); bangCenter.scale.set(1.2, 1, 1.2); hairGroup.add(bangCenter);
  const bangRight = new THREE.Mesh(bangGeo, matHair); bangRight.position.set(0.15, 0.15, 0.24); bangRight.rotation.set(0.2, 0, 0.3); hairGroup.add(bangRight);
  hairGroup.traverse(o => { if (o.isMesh) o.userData.type = 'rambut'; });

  const makeArm = (x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.8, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.25, 10, 28), matShirt); up.position.y = -0.22; up.castShadow = true; up.userData.type = 'baju'; pivot.add(up);
    const elbow = new THREE.Group(); elbow.position.y = -0.42; pivot.add(elbow);
    const low = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.25, 10, 28), matShirt); low.position.y = -0.2; low.castShadow = true; low.userData.type = 'baju'; elbow.add(low);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 24), matSkin); hand.userData.type = 'kulit'; hand.userData.hand = true; hand.position.y = -0.43; elbow.add(hand);
    return { pivot, elbow };
  };
  const makeLeg = (x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.9, 0);
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.21, 10, 28), matPants); th.position.y = -0.2; th.castShadow = true; th.userData.type = 'celana'; pivot.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.4; pivot.add(knee);
    const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 10, 28), matPants); sh.position.y = -0.2; sh.castShadow = true; sh.userData.type = 'celana'; knee.add(sh);
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

  // ===== AKSESORIS & KOSTUM SPIDERMAN =====
  const accMat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const mk = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const A = (id, parent) => { const g = new THREE.Group(); g.visible = false; parent.add(g); acc[id] = g; return g; };

  const mask = A('aks_topeng_spider', headGroup);
  mk(new THREE.SphereGeometry(0.36, 32, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, map: getWebTex(0xd91e2b), roughness: 0.6 }), 0, 0.02, -0.01, mask);
  for (const s of [-1, 1]) {
    const o = mk(new THREE.SphereGeometry(0.1, 16, 12), accMat(0x111111), s * 0.13, 0.07, 0.335, mask); o.scale.set(1.5, 1, 0.35); o.rotation.z = -s * 0.4;
    const l = mk(new THREE.SphereGeometry(0.085, 16, 12), accMat(0xffffff, { emissive: 0x444444 }), s * 0.13, 0.07, 0.35, mask); l.scale.set(1.35, 0.85, 0.35); l.rotation.z = -s * 0.4;
  }
  const gl = A('aks_kacamata', headGroup);
  for (const s of [-1, 1]) mk(new THREE.BoxGeometry(0.16, 0.09, 0.03), accMat(0x111111), s * 0.1, 0.05, 0.335, gl);
  mk(new THREE.BoxGeometry(0.06, 0.02, 0.03), accMat(0x111111), 0, 0.07, 0.335, gl);

  const cap = A('aks_topi', headGroup);
  mk(new THREE.SphereGeometry(0.335, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), accMat(0xe53935), 0, 0.04, 0, cap);
  const brim = mk(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), accMat(0xb71c1c), 0, 0.12, 0.28, cap); brim.scale.set(1, 1, 0.8);

  const crown = A('aks_mahkota', headGroup), gold = accMat(0xffd700, { metalness: 0.7, roughness: 0.3 });
  mk(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 20), gold, 0, 0.38, 0, crown);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mk(new THREE.ConeGeometry(0.05, 0.16, 8), gold, Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2, crown); }

  capePivot = A('aks_jubah', rig); capePivot.position.set(0, 1.95, -0.3);
  mk(new THREE.BoxGeometry(0.7, 1.1, 0.05), accMat(0xc0132b, { side: THREE.DoubleSide }), 0, -0.55, 0, capePivot);

  spiderLogoGrp = new THREE.Group(); spiderLogoGrp.visible = false; rig.add(spiderLogoGrp);
  const logoMat = new THREE.MeshBasicMaterial({ map: makeSpiderLogoTex(), transparent: true, depthWrite: false });
  const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), logoMat); lf.position.set(0, 1.62, 0.305); spiderLogoGrp.add(lf);
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), logoMat); lb.position.set(0, 1.62, -0.305); lb.rotation.y = Math.PI; spiderLogoGrp.add(lb);

  // ===== BATMAN =====
  const cowl = A('aks_topeng_batman', headGroup), cowlMat = accMat(0x15151c, { roughness: 0.5 });
  mk(new THREE.SphereGeometry(0.35, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.58), cowlMat, 0, 0.02, -0.01, cowl);
  for (const sd of [-1, 1]) {
    const ear = mk(new THREE.ConeGeometry(0.07, 0.3, 8), cowlMat, sd * 0.17, 0.4, 0, cowl); ear.rotation.z = -sd * 0.15;
    const eye = mk(new THREE.SphereGeometry(0.07, 12, 8), accMat(0xffffff, { emissive: 0xaaaaaa }), sd * 0.12, 0.07, 0.34, cowl); eye.scale.set(1.5, 0.6, 0.3); eye.rotation.z = sd * 0.35;
  }
  batGrp = new THREE.Group(); batGrp.visible = false; rig.add(batGrp);
  const yel = accMat(0xf5c400, { metalness: 0.3 });
  mk(new THREE.CylinderGeometry(0.315, 0.315, 0.09, 24), yel, 0, 1.05, 0, batGrp);
  mk(new THREE.BoxGeometry(0.1, 0.1, 0.03), yel, 0, 1.05, 0.32, batGrp);
  const bl = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), new THREE.MeshBasicMaterial({ map: makeBatLogoTex(), transparent: true, depthWrite: false }));
  bl.position.set(0, 1.62, 0.305); batGrp.add(bl);
  capeB = new THREE.Group(); capeB.position.set(0, 1.95, -0.3); batGrp.add(capeB);
  mk(new THREE.BoxGeometry(0.7, 1.15, 0.05), accMat(0x15151c, { side: THREE.DoubleSide }), 0, -0.575, 0, capeB);

  // ===== IRONMAN (armor penuh: helm, reaktor arc, bahu emas) =====
  const ironRed = accMat(0xb01020, { metalness: 0.75, roughness: 0.28 }), ironGold = accMat(0xd4a017, { metalness: 0.8, roughness: 0.25 });
  ironHelm = new THREE.Group(); ironHelm.visible = false; headGroup.add(ironHelm);
  mk(new THREE.SphereGeometry(0.36, 32, 24), ironRed, 0, 0.02, -0.01, ironHelm);
  const ifc = mk(new THREE.SphereGeometry(0.3, 24, 18), ironGold, 0, -0.02, 0.25, ironHelm); ifc.scale.set(0.78, 0.95, 0.45);
  for (const sd of [-1, 1]) { const ey = mk(new THREE.BoxGeometry(0.11, 0.03, 0.02), accMat(0xffffff, { emissive: 0xbfefff, emissiveIntensity: 1 }), sd * 0.1, 0.06, 0.372, ironHelm); ey.rotation.z = sd * 0.2; }
  ironBody = new THREE.Group(); ironBody.visible = false; rig.add(ironBody);
  const reactor = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshBasicMaterial({ color: 0x9ff3ff })); reactor.position.set(0, 1.62, 0.31); ironBody.add(reactor);
  const rg = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 8, 24), ironGold); rg.position.set(0, 1.62, 0.31); ironBody.add(rg);
  for (const sd of [-1, 1]) mk(new THREE.SphereGeometry(0.13, 16, 12), ironGold, sd * 0.4, 1.95, 0, ironBody);
  mk(new THREE.CylinderGeometry(0.315, 0.315, 0.08, 24), ironGold, 0, 1.05, 0, ironBody);

  // ===== HD: detail tambahan semua kostum + THOR =====
  ironRed.envMap = envTex; ironGold.envMap = envTex; yel.envMap = envTex; ironRed.envMapIntensity = ironGold.envMapIntensity = 1.1;
  costumeParts.spider.push(spiderLogoGrp); costumeParts.bat.push(batGrp); costumeParts.iron.push(ironHelm, ironBody);
  const grp = (parent, list) => { const g = new THREE.Group(); g.visible = false; parent.add(g); list.push(g); return g; };
  const steel = accMat(0xc9d1d9, { metalness: 0.9, roughness: 0.22, envMap: envTex, envMapIntensity: 1 });
  const darkSteel = accMat(0x4b525c, { metalness: 0.85, roughness: 0.35, envMap: envTex, envMapIntensity: 0.9 });
  const leather = accMat(0x4a2f1b, { roughness: 0.8 });
  const blackSuit = accMat(0x101016, { roughness: 0.55 });
  const glowBlue = accMat(0x4aa8ff, { emissive: 0x4aa8ff, emissiveIntensity: 1.6 });

  for (const [el, sd] of [[leftElbow, -1], [rightElbow, 1]]) {
    // Spiderman: web-shooter di pergelangan
    const ws = grp(el, costumeParts.spider);
    mk(new THREE.CylinderGeometry(0.092, 0.092, 0.1, 20), accMat(0x2b2b33, { metalness: 0.5 }), 0, -0.33, 0, ws);
    mk(new THREE.SphereGeometry(0.03, 10, 8), accMat(0xffffff, { emissive: 0xaaddff, emissiveIntensity: 0.8 }), 0, -0.33, 0.085, ws);
    // Ironman: sarung tangan emas + repulsor
    const ig = grp(el, costumeParts.iron);
    mk(new THREE.CylinderGeometry(0.098, 0.088, 0.3, 28), ironGold, 0, -0.22, 0, ig);
    mk(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 28), ironRed, 0, -0.06, 0, ig);
    mk(new THREE.CircleGeometry(0.045, 20), new THREE.MeshBasicMaterial({ color: 0x9ff3ff }), 0, -0.47, 0.088, ig);
    // Batman: gauntlet + sirip
    const bg = grp(el, costumeParts.bat);
    mk(new THREE.CylinderGeometry(0.095, 0.09, 0.3, 24), blackSuit, 0, -0.22, 0, bg);
    for (let i = 0; i < 3; i++) { const fin = mk(new THREE.BoxGeometry(0.015, 0.07, 0.12), blackSuit, 0, -0.14 - i * 0.07, -0.13, bg); fin.rotation.x = 0.4; }
    // Thor: bracer baja
    const tg = grp(el, costumeParts.thor);
    mk(new THREE.CylinderGeometry(0.1, 0.09, 0.24, 28), steel, 0, -0.26, 0, tg);
    const br = mk(new THREE.TorusGeometry(0.1, 0.012, 8, 28), darkSteel, 0, -0.14, 0, tg); br.rotation.x = Math.PI / 2;
  }
  // Batman: kantong sabuk utilitas
  for (let i = -2; i <= 2; i++) { const a = i * 0.32, p = mk(new THREE.BoxGeometry(0.1, 0.1, 0.07), yel, Math.sin(a) * 0.335, 1.05, Math.cos(a) * 0.335, batGrp); p.rotation.y = a; }
  // Ironman: pelat perut
  for (let i = 0; i < 3; i++) mk(new THREE.BoxGeometry(0.26 - i * 0.03, 0.05, 0.04), ironGold, 0, 1.38 - i * 0.1, 0.285, ironBody);

  // THOR: helm bersayap
  thorHelm = grp(headGroup, costumeParts.thor);
  mk(new THREE.SphereGeometry(0.36, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.4), steel, 0, 0.02, -0.01, thorHelm);
  const hrim = mk(new THREE.TorusGeometry(0.342, 0.022, 10, 48), darkSteel, 0, 0.131, -0.01, thorHelm); hrim.rotation.x = Math.PI / 2;
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
    const w = mk(new THREE.ConeGeometry(0.055, 0.42 - i * 0.06, 8), steel, sd * (0.4 + i * 0.01), 0.2 + i * 0.045, -0.02, thorHelm);
    w.rotation.z = -sd * (1.15 + i * 0.22); w.scale.z = 0.35;
  }
  // THOR: zirah dada, bahu, sabuk
  thorBody = grp(rig, costumeParts.thor);
  for (const sd of [-1, 1]) {
    const disc = mk(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 32), steel, sd * 0.125, 1.7, 0.285, thorBody); disc.rotation.x = Math.PI / 2;
    const dr = mk(new THREE.TorusGeometry(0.095, 0.012, 8, 32), darkSteel, sd * 0.125, 1.7, 0.3, thorBody);
    const pd = mk(new THREE.SphereGeometry(0.135, 24, 16), steel, sd * 0.4, 1.95, 0, thorBody); pd.scale.set(1, 0.8, 1.1);
  }
  const emb = mk(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24), darkSteel, 0, 1.52, 0.285, thorBody); emb.rotation.x = Math.PI / 2;
  mk(new THREE.CylinderGeometry(0.315, 0.315, 0.1, 32), leather, 0, 1.05, 0, thorBody);
  mk(new THREE.BoxGeometry(0.1, 0.09, 0.03), steel, 0, 1.05, 0.318, thorBody);
  // THOR: jubah merah
  capeT = new THREE.Group(); capeT.visible = false; capeT.position.set(0, 1.95, -0.3); rig.add(capeT); costumeParts.thor.push(capeT);
  mk(new THREE.BoxGeometry(0.78, 1.3, 0.05), accMat(0xc0132b, { side: THREE.DoubleSide, roughness: 0.85 }), 0, -0.65, 0, capeT);
  // THOR: palu Mjolnir di tangan kanan
  const hammer = grp(rightElbow, costumeParts.thor); hammer.position.set(0, -0.43, 0.04); hammer.rotation.x = -0.25;
  mk(new THREE.CylinderGeometry(0.026, 0.026, 0.66, 14), leather, 0, 0.2, 0, hammer);
  for (let i = 0; i < 5; i++) mk(new THREE.CylinderGeometry(0.031, 0.031, 0.012, 14), blackSuit, 0, -0.05 + i * 0.045, 0, hammer);
  mk(new THREE.SphereGeometry(0.04, 12, 8), steel, 0, -0.13, 0, hammer);
  const lp = mk(new THREE.TorusGeometry(0.04, 0.008, 8, 16), leather, 0, -0.17, 0, hammer); lp.rotation.y = Math.PI / 2;
  mk(new THREE.BoxGeometry(0.4, 0.2, 0.2), darkSteel, 0, 0.58, 0, hammer);
  for (const sd of [-1, 1]) mk(new THREE.BoxGeometry(0.045, 0.23, 0.23), steel, sd * 0.2225, 0.58, 0, hammer);
  for (const dy of [-0.06, 0.06]) mk(new THREE.BoxGeometry(0.3, 0.03, 0.205), steel, 0, 0.58 + dy, 0, hammer);
  mk(new THREE.BoxGeometry(0.31, 0.012, 0.206), glowBlue, 0, 0.58, 0, hammer);

  // HULK: otot, pinggang celana ungu, alis marah
  const hulkSkin = accMat(0x57b84a, { roughness: 0.55 }), hulkDark = accMat(0x2c6b27, { roughness: 0.6 }), hulkPurple = accMat(0x6b3fa0, { roughness: 0.8 });
  const hulkBody = grp(rig, costumeParts.hulk);
  for (const sd of [-1, 1]) {
    const pec = mk(new THREE.SphereGeometry(0.17, 24, 16), hulkSkin, sd * 0.15, 1.68, 0.3, hulkBody); pec.scale.set(1, 0.8, 0.7);
    const trap = mk(new THREE.SphereGeometry(0.17, 20, 14), hulkSkin, sd * 0.3, 1.98, -0.02, hulkBody); trap.scale.set(1, 0.7, 1);
    mk(new THREE.SphereGeometry(0.2, 24, 16), hulkSkin, sd * 0.58, 1.9, 0, hulkBody);
    for (let i = 0; i < 3; i++) { const ab = mk(new THREE.SphereGeometry(0.09, 16, 12), hulkSkin, sd * 0.1, 1.45 - i * 0.14, 0.38, hulkBody); ab.scale.set(1, 0.8, 0.5); }
  }
  mk(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 40), hulkPurple, 0, 1.0, 0, hulkBody);
  const hulkHead = grp(headGroup, costumeParts.hulk);
  for (const sd of [-1, 1]) { const brow = mk(new THREE.BoxGeometry(0.16, 0.05, 0.08), hulkDark, sd * 0.09, 0.13, 0.275, hulkHead); brow.rotation.z = sd * 0.3; }

  // ===== KOSTUM ULTRAMAN: helm perak, mata bercahaya, color timer, garis merah =====
  const ultraSilver = accMat(0xcbd5df, { metalness: 0.82, roughness: 0.24, envMap: envTex, envMapIntensity: 1.15 });
  const ultraRed = accMat(0xb92335, { metalness: 0.38, roughness: 0.34 });
  const ultraGlow = new THREE.MeshStandardMaterial({ color: 0x8ff6ff, emissive: 0x28cfff, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.22 });
  const ultraHead = grp(headGroup, costumeParts.ultra);
  mk(new THREE.SphereGeometry(0.355, 36, 28), ultraSilver, 0, 0.015, -0.015, ultraHead);
  for (const sd of [-1, 1]) {
    const eye = mk(new THREE.SphereGeometry(0.09, 20, 14), ultraGlow, sd * 0.135, 0.055, 0.318, ultraHead); eye.scale.set(1.15, 0.62, 0.34);
    const brow = mk(new THREE.BoxGeometry(0.055, 0.25, 0.055), ultraSilver, sd * 0.19, 0.29, 0.02, ultraHead); brow.rotation.z = -sd * 0.24;
  }
  const ultraCrest = mk(new THREE.ConeGeometry(0.055, 0.23, 8), ultraSilver, 0, 0.36, 0.02, ultraHead); ultraCrest.rotation.z = Math.PI;
  const ultraChest = grp(rig, costumeParts.ultra);
  mk(new THREE.SphereGeometry(0.09, 24, 16), ultraGlow, 0, 1.62, 0.31, ultraChest).scale.set(0.8, 1.2, 0.35);
  mk(new THREE.TorusGeometry(0.115, 0.018, 10, 32), ultraRed, 0, 1.62, 0.31, ultraChest);
  for (const sd of [-1, 1]) {
    const stripe = mk(new THREE.BoxGeometry(0.11, 0.65, 0.035), ultraRed, sd * 0.22, 1.48, 0.285, ultraChest); stripe.rotation.z = -sd * 0.22;
    const shoulder = mk(new THREE.SphereGeometry(0.145, 20, 14), ultraSilver, sd * 0.4, 1.93, 0, ultraChest); shoulder.scale.set(1.1, 0.65, 1);
    const bracer = grp(sd < 0 ? leftElbow : rightElbow, costumeParts.ultra);
    mk(new THREE.CylinderGeometry(0.105, 0.095, 0.26, 24), ultraSilver, 0, -0.23, 0, bracer);
    mk(new THREE.TorusGeometry(0.098, 0.014, 8, 24), ultraRed, 0, -0.12, 0, bracer).rotation.x = Math.PI / 2;
  }

  // ===== KOSTUM GODZILLA HD: armor bersisik dari kepala sampai kaki =====
  // Semua bagian berada di group terpisah agar hanya muncul saat kostum Godzilla dipakai.
  const godSkin = accMat(0x252a2c, { roughness: 0.9 });
  const godScale = accMat(0x343b3d, { roughness: 0.82 });
  const godDark = accMat(0x171c1e, { roughness: 0.94 });
  const godClaw = accMat(0x0d1113, { roughness: 0.58, metalness: 0.12 });
  const godGlow = accMat(0x087d83, {
    color: 0x159da0, emissive: 0x087e91, emissiveIntensity: 0.72,
    roughness: 0.38, metalness: 0.12
  });
  const godSpine = accMat(0x1b777b, {
    color: 0x29aeb1, emissive: 0x087e91, emissiveIntensity: 0.85,
    roughness: 0.36, metalness: 0.16
  });

  // Tekstur mikro-sisik untuk memberi permukaan kulit reptil yang lebih kaya.
  const godTexCanvas = document.createElement('canvas');
  godTexCanvas.width = godTexCanvas.height = 512;
  const gtx = godTexCanvas.getContext('2d');
  gtx.fillStyle = '#303638'; gtx.fillRect(0, 0, 512, 512);
  for (let gy = -12; gy < 540; gy += 18) {
    for (let gx = -12 + ((Math.floor(gy / 18) % 2) * 9); gx < 540; gx += 18) {
      gtx.fillStyle = 'rgba(5,10,12,0.34)';
      gtx.beginPath(); gtx.ellipse(gx, gy, 7, 5.2, 0, 0, Math.PI * 2); gtx.fill();
      gtx.strokeStyle = 'rgba(145,160,157,0.17)'; gtx.lineWidth = 1.5;
      gtx.beginPath(); gtx.arc(gx - 1, gy - 1, 5.4, Math.PI * 1.05, Math.PI * 1.9); gtx.stroke();
    }
  }
  const godTex = new THREE.CanvasTexture(godTexCanvas);
  godTex.wrapS = godTex.wrapT = THREE.RepeatWrapping;
  godTex.repeat.set(2, 2); godTex.colorSpace = THREE.SRGBColorSpace;
  godTex.anisotropy = 8;
  godSkin.map = godTex; godSkin.bumpMap = godTex; godSkin.bumpScale = 0.075;
  godSkin.needsUpdate = true;
  godScale.map = godTex; godScale.bumpMap = godTex; godScale.bumpScale = 0.055;
  godScale.needsUpdate = true;

  const godHead = grp(headGroup, costumeParts.godzilla);
  // Kubah kepala menutupi rambut dan kepala avatar, dengan moncong reptil lebar.
  const skull = mk(new THREE.SphereGeometry(0.365, 48, 32), godSkin, 0, 0.015, 0.005, godHead);
  skull.scale.set(1.12, 0.96, 1.08);
  const jaw = mk(new THREE.SphereGeometry(0.255, 36, 24), godDark, 0, -0.17, 0.12, godHead);
  jaw.scale.set(1.18, 0.42, 1.15);
  const snout = mk(new THREE.SphereGeometry(0.225, 40, 28), godScale, 0, -0.105, 0.255, godHead);
  snout.scale.set(1.25, 0.58, 1.2);
  const mouthLine = mk(new THREE.BoxGeometry(0.36, 0.018, 0.025), godClaw, 0, -0.205, 0.43, godHead);
  for (const sd of [-1, 1]) {
    const cheek = mk(new THREE.SphereGeometry(0.145, 24, 18), godScale, sd * 0.245, -0.075, 0.12, godHead);
    cheek.scale.set(0.72, 0.78, 0.82);
    const eyeSocket = mk(new THREE.SphereGeometry(0.075, 24, 16), godDark, sd * 0.145, 0.075, 0.292, godHead);
    eyeSocket.scale.set(1.22, 0.72, 0.42);
    const eye = mk(new THREE.SphereGeometry(0.035, 20, 14), accMat(0xd7b75a, { emissive: 0x6e4b12, emissiveIntensity: 0.45 }), sd * 0.145, 0.075, 0.323, godHead);
    eye.scale.set(1.25, 0.55, 0.35);
    for (let j = 0; j < 2; j++) {
      const nostril = mk(new THREE.SphereGeometry(0.018, 12, 8), godDark, sd * (0.07 + j * 0.055), -0.115, 0.49, godHead);
      nostril.scale.set(1, 0.6, 0.5);
    }
    const brow = mk(new THREE.BoxGeometry(0.19, 0.075, 0.11), godSkin, sd * 0.15, 0.16, 0.29, godHead);
    brow.rotation.z = -sd * 0.16;
    // Tonjolan kecil di sisi kepala.
    const temple = mk(new THREE.ConeGeometry(0.07, 0.19, 8), godDark, sd * 0.29, 0.12, -0.03, godHead);
    temple.rotation.z = -sd * 0.95;
  }

  // Leher dan armor dada/perut menutup baju avatar.
  const godTorso = grp(rig, costumeParts.godzilla);
  const neck = mk(new THREE.CylinderGeometry(0.23, 0.29, 0.42, 32), godSkin, 0, 1.94, 0, godTorso);
  neck.rotation.x = -0.08;
  const chest = mk(new THREE.SphereGeometry(0.43, 40, 28), godSkin, 0, 1.62, 0.015, godTorso);
  chest.scale.set(1.08, 0.9, 0.83);
  const belly = mk(new THREE.SphereGeometry(0.35, 36, 24), godScale, 0, 1.27, 0.025, godTorso);
  belly.scale.set(1.03, 0.95, 0.8);
  for (let row = 0; row < 4; row++) {
    const rib = mk(new THREE.TorusGeometry(0.275 - row * 0.012, 0.012, 8, 32, Math.PI), godDark, 0, 1.48 - row * 0.105, 0.23, godTorso);
    rib.rotation.x = Math.PI / 2;
    rib.scale.set(1.05, 0.72, 1);
  }
  for (const sd of [-1, 1]) {
    const shoulder = mk(new THREE.SphereGeometry(0.22, 32, 22), godScale, sd * 0.43, 1.88, 0, godTorso);
    shoulder.scale.set(1.12, 0.78, 1.08);
    // Segmen armor lengan atas dan bawah.
    const upperArmor = grp(sd < 0 ? leftArmPivot : rightArmPivot, costumeParts.godzilla);
    const upper = mk(new THREE.CapsuleGeometry(0.135, 0.27, 8, 24), godSkin, 0, -0.22, 0, upperArmor);
    upper.scale.set(1.14, 1.04, 1.1);
    const elbowArmor = grp(sd < 0 ? leftElbow : rightElbow, costumeParts.godzilla);
    const fore = mk(new THREE.CapsuleGeometry(0.12, 0.26, 8, 24), godScale, 0, -0.2, 0, elbowArmor);
    fore.scale.set(1.13, 1.04, 1.12);
    const wrist = mk(new THREE.TorusGeometry(0.105, 0.025, 10, 28), godDark, 0, -0.36, 0, elbowArmor);
    wrist.rotation.x = Math.PI / 2;
    // Cakar tiga jari yang mengarah ke depan.
    for (let k = -1; k <= 1; k++) {
      const finger = mk(new THREE.CapsuleGeometry(0.025, 0.105, 5, 12), godSkin, k * 0.055, -0.435, 0.035, elbowArmor);
      finger.rotation.z = k * -0.18;
      const nail = mk(new THREE.ConeGeometry(0.026, 0.105, 9), godClaw, k * 0.055, -0.49, 0.09, elbowArmor);
      nail.rotation.x = Math.PI;
    }
    // Armor paha, tulang kering, dan kaki/cakar.
    const legPivot = sd < 0 ? leftLegPivot : rightLegPivot;
    const kneePivot = sd < 0 ? leftKnee : rightKnee;
    const thigh = grp(legPivot, costumeParts.godzilla);
    const thighPlate = mk(new THREE.CapsuleGeometry(0.155, 0.25, 8, 24), godSkin, 0, -0.2, 0, thigh);
    thighPlate.scale.set(1.18, 1.08, 1.12);
    const shin = grp(kneePivot, costumeParts.godzilla);
    const shinPlate = mk(new THREE.CapsuleGeometry(0.135, 0.24, 8, 24), godScale, 0, -0.2, 0, shin);
    shinPlate.scale.set(1.2, 1.08, 1.12);
    const foot = mk(new THREE.SphereGeometry(0.16, 28, 18), godSkin, 0, -0.405, 0.1, shin);
    foot.scale.set(1.25, 0.58, 1.5);
    for (let toe = -1; toe <= 1; toe++) {
      const talon = mk(new THREE.ConeGeometry(0.035, 0.15, 9), godClaw, toe * 0.085, -0.425, 0.255, shin);
      talon.rotation.x = Math.PI / 2;
      talon.rotation.z = toe * 0.16;
    }
    // Sisik kecil berlapis di sisi bahu dan paha.
    for (let n = 0; n < 3; n++) {
      const scale = mk(new THREE.ConeGeometry(0.075, 0.13, 6), godDark, sd * (0.48 + n * 0.025), 1.78 - n * 0.13, 0.06, godTorso);
      scale.rotation.z = -sd * 0.7;
    }
  }

  // Ekor tebal beruas, melengkung ke belakang, lengkap dengan sirip di bagian atas.
  const godTail = new THREE.Group();
  godTail.position.set(0, 1.02, -0.22);
  godTorso.add(godTail);
  const tailSections = [
    { z: -0.23, r: 0.235, len: 0.48 },
    { z: -0.61, r: 0.19, len: 0.48 },
    { z: -0.98, r: 0.145, len: 0.43 },
    { z: -1.31, r: 0.095, len: 0.34 },
    { z: -1.57, r: 0.045, len: 0.22 }
  ];
  tailSections.forEach((part, i) => {
    const section = mk(new THREE.SphereGeometry(part.r, 28, 20), godSkin, 0, -0.035 - i * 0.025, part.z, godTail);
    section.scale.set(1, 0.88, part.len / (part.r * 2));
    if (i < 4) {
      const ridge = mk(new THREE.ConeGeometry(part.r * 0.72, 0.13 - i * 0.018, 7), godScale, 0, part.r * 0.72, part.z, godTail);
      ridge.rotation.x = -0.12;
    }
  });
  const tailTip = mk(new THREE.ConeGeometry(0.055, 0.28, 9), godDark, 0, -0.02, -1.78, godTail);
  tailTip.rotation.x = -Math.PI / 2;

  // Sirip punggung besar seperti Godzilla pada foto, dari tengkuk sampai ujung ekor.
  const dorsal = grp(rig, costumeParts.godzilla);
  const dorsalRows = [
    { y: 2.12, z: -0.16, w: 0.105, h: 0.28 },
    { y: 1.91, z: -0.19, w: 0.15, h: 0.38 },
    { y: 1.68, z: -0.2, w: 0.19, h: 0.43 },
    { y: 1.43, z: -0.2, w: 0.18, h: 0.38 },
    { y: 1.2, z: -0.2, w: 0.15, h: 0.32 },
    { y: 0.99, z: -0.22, w: 0.12, h: 0.25 }
  ];
  dorsalRows.forEach((d, i) => {
    const plate = mk(new THREE.ConeGeometry(d.w, d.h, 5), godSpine, 0, d.y, d.z, dorsal);
    plate.rotation.x = -0.18; plate.rotation.z = Math.PI;
    plate.scale.set(1.15, 1, 0.58);
    const inner = mk(new THREE.ConeGeometry(d.w * 0.58, d.h * 0.68, 5), godGlow, 0, d.y + 0.015, d.z + 0.035, dorsal);
    inner.rotation.x = -0.18; inner.rotation.z = Math.PI;
    inner.scale.set(1.08, 1, 0.42);
  });
  // Deretan sirip kecil melanjutkan punggung hingga ekor.
  for (let i = 0; i < 5; i++) {
    const z = -0.48 - i * 0.25;
    const fin = mk(new THREE.ConeGeometry(0.095 - i * 0.012, 0.22 - i * 0.025, 5), godSpine, 0, 1.02 - i * 0.025, z, godTail);
    fin.rotation.z = Math.PI; fin.rotation.x = -0.15;
  }
  // ===== KOSTUM RAMEN RAIDER: helm mangkuk ramen, mie, sumpit dan emblem =====
  const ramenBowl = accMat(0xd94a32, { roughness: 0.42, metalness: 0.12 });
  const ramenCream = accMat(0xffe3a3, { roughness: 0.68 });
  const ramenNoodle = accMat(0xe9b84f, { roughness: 0.8 });
  const ramenDark = accMat(0x66351f, { roughness: 0.7 });
  const ramenHead = grp(headGroup, costumeParts.ramen);
  mk(new THREE.CylinderGeometry(0.27, 0.22, 0.22, 32), ramenBowl, 0, 0.18, 0, ramenHead);
  mk(new THREE.TorusGeometry(0.255, 0.025, 8, 32), ramenCream, 0, 0.295, 0, ramenHead);
  const broth = mk(new THREE.CircleGeometry(0.235, 32), ramenCream, 0, 0.302, 0, ramenHead); broth.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const noodle = mk(new THREE.TorusGeometry(0.065 + (i % 2) * 0.012, 0.012, 6, 18), ramenNoodle, Math.cos(i * 1.25) * 0.105, 0.325, Math.sin(i * 1.25) * 0.105, ramenHead); noodle.rotation.x = Math.PI / 2;
  }
  const chopstick1 = mk(new THREE.CylinderGeometry(0.012, 0.018, 0.52, 8), ramenDark, -0.12, 0.48, -0.02, ramenHead);
  const chopstick2 = mk(new THREE.CylinderGeometry(0.012, 0.018, 0.52, 8), ramenDark, -0.02, 0.48, -0.02, ramenHead);
  chopstick1.rotation.z = -0.42; chopstick2.rotation.z = -0.24;
  const ramenChest = grp(rig, costumeParts.ramen);
  const emblem = mk(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 32), ramenCream, 0, 1.62, 0.3, ramenChest); emblem.rotation.x = Math.PI / 2;
  mk(new THREE.TorusGeometry(0.075, 0.012, 8, 24), ramenBowl, 0, 1.62, 0.325, ramenChest);
  mk(new THREE.TorusGeometry(0.045, 0.012, 8, 20), ramenNoodle, 0, 1.62, 0.34, ramenChest);
  for (const sd of [-1, 1]) {
    const shoulder = mk(new THREE.SphereGeometry(0.15, 18, 12), ramenBowl, sd * 0.4, 1.9, 0, ramenChest); shoulder.scale.set(1.2, 0.7, 1);
    const wrist = grp(sd < 0 ? leftElbow : rightElbow, costumeParts.ramen);
    mk(new THREE.CylinderGeometry(0.1, 0.09, 0.24, 20), ramenCream, 0, -0.23, 0, wrist);
    mk(new THREE.TorusGeometry(0.095, 0.012, 8, 20), ramenBowl, 0, -0.12, 0, wrist).rotation.x = Math.PI / 2;
  }
  const ramenScarf = grp(rig, costumeParts.ramen);
  const scarf = mk(new THREE.BoxGeometry(0.62, 0.13, 0.12), ramenCream, 0, 2.02, 0.02, ramenScarf); scarf.rotation.z = 0.04;
  const scarfTail = mk(new THREE.BoxGeometry(0.13, 0.42, 0.07), ramenCream, 0.32, 1.79, -0.02, ramenScarf); scarfTail.rotation.z = -0.18;

  // ===== KOSTUM PACMAN: helm bola kuning dengan mulut terbuka, mata, emblem dada, dan titik makanan =====
  const pacYellow = accMat(0xffd800, { roughness: 0.4, emissive: 0x332a00, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const pacBlack = accMat(0x0b0b12, { roughness: 0.5 });
  const pacHead = grp(headGroup, costumeParts.pac);
  mk(new THREE.SphereGeometry(0.37, 32, 24, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1), pacYellow, 0, 0.02, 0, pacHead);
  mk(new THREE.SphereGeometry(0.045, 12, 10), pacBlack, 0.213, 0.213, 0.234, pacHead);
  mk(new THREE.SphereGeometry(0.045, 12, 10), pacBlack, -0.213, 0.213, 0.234, pacHead);
  const pacChest = grp(rig, costumeParts.pac);
  const pacDisc = mk(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 32), pacBlack, 0, 1.62, 0.3, pacChest); pacDisc.rotation.x = Math.PI / 2;
  const pacMouth = mk(new THREE.CylinderGeometry(0.115, 0.115, 0.04, 32, 1, false, Math.PI / 2 + 0.5, Math.PI * 2 - 1.0), pacYellow, 0, 1.62, 0.322, pacChest); pacMouth.rotation.x = Math.PI / 2;

  // ===== SAITAMA / ONE PUNCH MAN: jumpsuit kuning, sarung tangan & sepatu merah, jubah putih =====
  const saitamaYellow = accMat(0xffd21a, { roughness: 0.48 });
  const saitamaRed = accMat(0xc92532, { roughness: 0.42 });
  const saitamaWhite = accMat(0xf3f5f7, { roughness: 0.78, side: THREE.DoubleSide });
  const saitamaDark = accMat(0x252832, { metalness: 0.35, roughness: 0.55 });
  const saitamaSuit = grp(rig, costumeParts.saitama);
  const suitTorso = mk(new THREE.CylinderGeometry(0.285, 0.31, 0.72, 24), saitamaYellow, 0, 1.62, 0, saitamaSuit);
  suitTorso.scale.set(1.05, 1, 0.78);
  mk(new THREE.SphereGeometry(0.30, 20, 14), saitamaYellow, 0, 1.96, 0, saitamaSuit).scale.set(1.05, 0.52, 0.78);
  // Garis resleting dan sabuk khas kostum Saitama
  mk(new THREE.BoxGeometry(0.025, 0.43, 0.012), saitamaDark, 0, 1.66, 0.247, saitamaSuit);
  mk(new THREE.BoxGeometry(0.58, 0.075, 0.035), saitamaDark, 0, 1.28, 0.02, saitamaSuit);
  mk(new THREE.BoxGeometry(0.12, 0.10, 0.04), saitamaWhite, 0, 1.28, 0.045, saitamaSuit);
  // Kerah putih dan dua kancing kecil
  const collar = mk(new THREE.TorusGeometry(0.19, 0.035, 8, 24), saitamaWhite, 0, 2.00, 0, saitamaSuit);
  collar.rotation.x = Math.PI / 2;
  for (const yy of [1.78, 1.62, 1.46]) mk(new THREE.SphereGeometry(0.018, 8, 8), saitamaWhite, 0.045, yy, 0.255, saitamaSuit);
  // Sarung tangan merah menempel ke pivot lengan agar ikut animasi
  for (const [arm, side] of [[leftArmPivot,-1],[rightArmPivot,1]]) {
    const gloveGroup = grp(arm, costumeParts.saitama);
    const glove = mk(new THREE.SphereGeometry(0.125, 16, 12), saitamaRed, 0, -0.48, 0, gloveGroup);
    glove.scale.set(1, 1.15, 0.9);
    mk(new THREE.CylinderGeometry(0.105, 0.105, 0.11, 16), saitamaWhite, 0, -0.34, 0, gloveGroup);
    const shoulder = mk(new THREE.SphereGeometry(0.16, 16, 12), saitamaYellow, side * -0.02, -0.02, 0, gloveGroup);
    shoulder.scale.set(1.18, 0.72, 0.9);
  }
  // Sepatu bot merah dan pelindung kaki kuning pada kedua kaki
  for (const leg of [leftLegPivot, rightLegPivot]) {
    const bootGroup = grp(leg, costumeParts.saitama);
    mk(new THREE.CylinderGeometry(0.13, 0.14, 0.28, 18), saitamaRed, 0, -0.43, 0.025, bootGroup);
    mk(new THREE.BoxGeometry(0.23, 0.10, 0.30), saitamaRed, 0, -0.57, 0.07, bootGroup);
    mk(new THREE.CylinderGeometry(0.115, 0.12, 0.12, 16), saitamaYellow, 0, -0.23, 0, bootGroup);
  }
  // Jubah putih lebar dari bahu sampai betis, berada di belakang karakter
  const saitamaCape = grp(rig, costumeParts.saitama);
  saitamaCape.position.set(0, 1.98, -0.22);
  const capeShape = new THREE.Shape();
  capeShape.moveTo(-0.22, 0.02); capeShape.quadraticCurveTo(-0.42, -0.35, -0.38, -1.15);
  capeShape.quadraticCurveTo(0, -1.28, 0.38, -1.15); capeShape.quadraticCurveTo(0.42, -0.35, 0.22, 0.02);
  capeShape.closePath();
  const capeMesh = new THREE.Mesh(new THREE.ShapeGeometry(capeShape, 12), saitamaWhite);
  capeMesh.position.z = -0.035; saitamaCape.add(capeMesh);
  mk(new THREE.SphereGeometry(0.11, 16, 12), saitamaWhite, -0.25, -0.02, 0.02, saitamaCape);
  mk(new THREE.SphereGeometry(0.11, 16, 12), saitamaWhite, 0.25, -0.02, 0.02, saitamaCape);


  // ===== GREEN LANTERN: kostum superhero hijau-hitam, topeng, logo, sarung tangan & sepatu bot =====
  const glGreen = accMat(0x087d3b, { roughness: 0.42, metalness: 0.18, envMap: envTex, envMapIntensity: 0.65 });
  const glBright = accMat(0x21d66b, { roughness: 0.34, metalness: 0.12, emissive: 0x087d3b, emissiveIntensity: 0.32 });
  const glDark = accMat(0x10151a, { roughness: 0.48, metalness: 0.22, envMap: envTex, envMapIntensity: 0.55 });
  const glWhite = accMat(0xeafff1, { roughness: 0.28, metalness: 0.08, emissive: 0x75ffad, emissiveIntensity: 0.22 });
  const glParts = costumeParts.greenlantern;

  // Topeng hijau menutup area mata; rambut dan bentuk kepala avatar tetap terlihat.
  const glMask = grp(headGroup, glParts);
  const maskBand = mk(new THREE.SphereGeometry(0.345, 40, 24), glGreen, 0, 0.045, 0.012, glMask);
  maskBand.scale.set(1.04, 0.43, 1.015);
  const maskFront = mk(new THREE.BoxGeometry(0.49, 0.105, 0.035), glGreen, 0, 0.045, 0.319, glMask);
  maskFront.scale.set(1, 1, 0.65);
  for (const sd of [-1, 1]) {
    const lens = mk(new THREE.SphereGeometry(0.083, 24, 16), glDark, sd * 0.115, 0.045, 0.337, glMask);
    lens.scale.set(1.28, 0.55, 0.3);
    const lensGlow = mk(new THREE.SphereGeometry(0.054, 20, 12), glWhite, sd * 0.115, 0.048, 0.35, glMask);
    lensGlow.scale.set(1.2, 0.42, 0.22);
  }
  const maskBridge = mk(new THREE.BoxGeometry(0.09, 0.075, 0.035), glGreen, 0, 0.05, 0.338, glMask);

  // Panel dada hijau berbentuk armor dan emblem Green Lantern yang jelas terlihat.
  const glChest = grp(rig, glParts);
  const chestPanel = mk(new THREE.SphereGeometry(0.355, 40, 28), glGreen, 0, 1.66, 0.02, glChest);
  chestPanel.scale.set(1.02, 0.86, 0.82);
  const upperPanel = mk(new THREE.BoxGeometry(0.57, 0.18, 0.045), glGreen, 0, 1.91, 0.205, glChest);
  upperPanel.scale.set(1, 1, 0.7);
  const centerBadge = mk(new THREE.CylinderGeometry(0.145, 0.145, 0.045, 48), glWhite, 0, 1.68, 0.315, glChest);
  centerBadge.rotation.x = Math.PI / 2;
  const badgeRing = mk(new THREE.TorusGeometry(0.145, 0.024, 10, 48), glBright, 0, 1.68, 0.344, glChest);
  badgeRing.rotation.x = Math.PI / 2;
  // Simbol lentera sederhana di tengah emblem.
  mk(new THREE.BoxGeometry(0.12, 0.055, 0.018), glGreen, 0, 1.68, 0.352, glChest);
  mk(new THREE.BoxGeometry(0.075, 0.105, 0.018), glGreen, 0, 1.68, 0.354, glChest);
  mk(new THREE.BoxGeometry(0.15, 0.018, 0.018), glGreen, 0, 1.735, 0.354, glChest);
  mk(new THREE.BoxGeometry(0.15, 0.018, 0.018), glGreen, 0, 1.625, 0.354, glChest);

  // Panel perut hijau bersegmen di atas undersuit hitam.
  const abdomen = mk(new THREE.SphereGeometry(0.255, 32, 22), glGreen, 0, 1.34, 0.06, glChest);
  abdomen.scale.set(1.03, 0.92, 0.77);
  for (let row = 0; row < 3; row++) {
    const seam = mk(new THREE.BoxGeometry(0.34 - row * 0.025, 0.018, 0.012), glDark, 0, 1.49 - row * 0.105, 0.258, glChest);
    seam.scale.z = 0.7;
  }
  // Garis panel bahu hijau dan sisi dada hitam.
  for (const sd of [-1, 1]) {
    const shoulder = mk(new THREE.SphereGeometry(0.17, 28, 18), glGreen, sd * 0.405, 1.9, 0.005, glChest);
    shoulder.scale.set(1.18, 0.7, 0.9);
    const sideStripe = mk(new THREE.BoxGeometry(0.095, 0.55, 0.025), glDark, sd * 0.285, 1.57, 0.235, glChest);
    sideStripe.rotation.z = -sd * 0.12;
  }

  // Sarung tangan hijau metalik mengikuti pivot lengan dan pergelangan.
  for (const arm of [leftElbow, rightElbow]) {
    const glove = grp(arm, glParts);
    mk(new THREE.CylinderGeometry(0.105, 0.095, 0.29, 28), glGreen, 0, -0.235, 0, glove);
    mk(new THREE.TorusGeometry(0.098, 0.018, 8, 28), glBright, 0, -0.09, 0, glove).rotation.x = Math.PI / 2;
    const fist = mk(new THREE.SphereGeometry(0.105, 24, 16), glGreen, 0, -0.43, 0.035, glove);
    fist.scale.set(1.08, 0.82, 1.12);
    mk(new THREE.BoxGeometry(0.105, 0.035, 0.035), glWhite, 0, -0.43, 0.132, glove);
  }

  // Sepatu bot hijau tinggi dengan sol dan garis armor.
  for (const leg of [leftKnee, rightKnee]) {
    const boot = grp(leg, glParts);
    const shaft = mk(new THREE.CylinderGeometry(0.135, 0.15, 0.43, 32), glGreen, 0, -0.29, 0.015, boot);
    shaft.scale.set(1.02, 1, 0.9);
    mk(new THREE.TorusGeometry(0.132, 0.018, 8, 28), glBright, 0, -0.075, 0.015, boot).rotation.x = Math.PI / 2;
    const toe = mk(new THREE.SphereGeometry(0.14, 24, 16), glGreen, 0, -0.49, 0.11, boot);
    toe.scale.set(1.15, 0.55, 1.35);
    mk(new THREE.BoxGeometry(0.22, 0.035, 0.29), glDark, 0, -0.56, 0.09, boot);
  }

  // Sabuk hitam-hijau sebagai pemisah armor dada dan celana.
  const glBelt = grp(rig, glParts);
  mk(new THREE.BoxGeometry(0.49, 0.075, 0.48), glDark, 0, 1.12, 0, glBelt);
  mk(new THREE.BoxGeometry(0.105, 0.085, 0.035), glBright, 0, 1.12, 0.25, glBelt);

  // ===== KOSTUM SONIC: badan biru, kuping, duri kepala, muka, sarung tangan putih & sepatu merah =====
  {
    const snBlue = accMat(0x1d5fd1, { roughness: 0.5, metalness: 0.05 });
    const snPeach = accMat(0xf5c9a0, { roughness: 0.7 });
    const snWhite = accMat(0xffffff, { roughness: 0.55 });
    const snGreen = accMat(0x2fbf5a, { roughness: 0.4 });
    const snBlack = accMat(0x0b0b10, { roughness: 0.4 });
    const snRed = accMat(0xd7263d, { roughness: 0.4, metalness: 0.1 });
    const snGold = accMat(0xf2c230, { roughness: 0.3, metalness: 0.6 });
    const snParts = costumeParts.sonic;

    // Kepala: kuping, duri ke belakang, moncong, mata besar, hidung & senyum.
    const snHead = grp(headGroup, snParts);
    for (const sd of [-1, 1]) {
      const ear = mk(new THREE.ConeGeometry(0.085, 0.24, 4), snBlue, sd * 0.15, 0.34, -0.02, snHead); ear.rotation.z = -sd * 0.3;
      const earIn = mk(new THREE.ConeGeometry(0.045, 0.15, 4), snPeach, sd * 0.15, 0.31, 0.02, snHead); earIn.rotation.z = -sd * 0.3;
    }
    const quill = (y, yaw, tilt, len, r) => { // duri: pangkal di belakang kepala, mengarah ke belakang
      const g = new THREE.Group(); g.position.set(0, y, -0.2); g.rotation.order = 'YXZ'; g.rotation.set(tilt, yaw, 0); snHead.add(g);
      const c = mk(new THREE.ConeGeometry(r, len, 8), snBlue, 0, 0, -len / 2, g); c.rotation.x = -Math.PI / 2;
    };
    quill(0.2, 0, -0.2, 0.66, 0.13);
    quill(0.3, 0.38, 0.05, 0.5, 0.105); quill(0.3, -0.38, 0.05, 0.5, 0.105);
    quill(0.12, 0.55, -0.45, 0.55, 0.11); quill(0.12, -0.55, -0.45, 0.55, 0.11);
    quill(0.02, 0, -0.75, 0.48, 0.1);
    const muzzle = mk(new THREE.SphereGeometry(0.17, 24, 16), snPeach, 0, -0.07, 0.2, snHead); muzzle.scale.set(1.15, 0.85, 0.9);
    for (const sd of [-1, 1]) {
      const eye = mk(new THREE.SphereGeometry(0.09, 20, 14), snWhite, sd * 0.09, 0.08, 0.3, snHead); eye.scale.set(0.95, 1.25, 0.6);
      const iris = mk(new THREE.SphereGeometry(0.045, 14, 10), snGreen, sd * 0.085, 0.075, 0.335, snHead); iris.scale.set(1, 1.2, 0.5);
      mk(new THREE.SphereGeometry(0.022, 10, 8), snBlack, sd * 0.08, 0.075, 0.347, snHead);
    }
    mk(new THREE.SphereGeometry(0.04, 12, 10), snBlack, 0, 0.0, 0.345, snHead);
    const smile = mk(new THREE.TorusGeometry(0.06, 0.008, 6, 16, Math.PI), snBlack, 0, -0.095, 0.346, snHead); smile.rotation.z = Math.PI;

    // Dada: area perut krem.
    const snChest = grp(rig, snParts);
    const belly = mk(new THREE.SphereGeometry(0.2, 24, 16), snPeach, 0, 1.55, 0.19, snChest); belly.scale.set(1, 1.3, 0.45);

    // Sarung tangan putih di kedua tangan.
    for (const arm of [leftElbow, rightElbow]) {
      const glove = grp(arm, snParts);
      mk(new THREE.CylinderGeometry(0.105, 0.115, 0.13, 20), snWhite, 0, -0.3, 0, glove);
      const fist = mk(new THREE.SphereGeometry(0.125, 20, 14), snWhite, 0, -0.43, 0.025, glove); fist.scale.set(1.05, 0.9, 1.1);
    }

    // Sepatu merah besar dengan tali putih dan gesper emas.
    for (const leg of [leftKnee, rightKnee]) {
      const shoe = grp(leg, snParts);
      mk(new THREE.CylinderGeometry(0.14, 0.155, 0.1, 20), snWhite, 0, -0.1, 0.01, shoe);
      mk(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 24), snRed, 0, -0.3, 0.015, shoe);
      const toe = mk(new THREE.SphereGeometry(0.15, 22, 14), snRed, 0, -0.49, 0.12, shoe); toe.scale.set(1.1, 0.6, 1.5);
      mk(new THREE.TorusGeometry(0.165, 0.025, 8, 24), snWhite, 0, -0.4, 0.015, shoe).rotation.x = Math.PI / 2;
      mk(new THREE.BoxGeometry(0.07, 0.07, 0.03), snGold, 0, -0.4, 0.185, shoe);
      mk(new THREE.BoxGeometry(0.25, 0.035, 0.34), snWhite, 0, -0.57, 0.1, shoe);
    }
  }

  // ===== KOSTUM VENOM: seluruh badan hitam mengkilap, mata putih miring, mulut penuh gigi, lidah & lambang laba-laba putih =====
  {
    const vnBlack = accMat(0x0a0c14, { roughness: 0.22, metalness: 0.25 });
    const vnWhite = accMat(0xf4f4f4, { roughness: 0.35, side: THREE.DoubleSide });
    const vnMouth = accMat(0x3a0a12, { roughness: 0.6, side: THREE.DoubleSide });
    const vnTongue = accMat(0xc2283a, { roughness: 0.45 });
    const vnClaw = accMat(0x1c1f2b, { roughness: 0.3, metalness: 0.4 });
    const vnParts = costumeParts.venom;

    // Kepala: cangkang hitam lebih besar menutup wajah asli, lalu mata, mulut, gigi & lidah.
    const vnHead = grp(headGroup, vnParts);
    const shell = mk(new THREE.SphereGeometry(0.36, 28, 20), vnBlack, 0, 0.0, 0.0, vnHead); shell.scale.set(1.05, 1.1, 1.0);
    const eyeShape = new THREE.Shape();
    eyeShape.moveTo(-0.14, 0.075); eyeShape.lineTo(-0.02, -0.05); eyeShape.lineTo(0.02, -0.02); eyeShape.lineTo(-0.065, 0.085); eyeShape.closePath();
    for (const sd of [-1, 1]) {
      const eye = mk(new THREE.ShapeGeometry(eyeShape), vnWhite, sd * 0.125, 0.115, 0.352, vnHead);
      eye.scale.set(sd * 1.5, 1.5, 1);
    }
    // Mulut lebar menyeringai: separuh lingkaran merah gelap + deretan gigi runcing + lidah.
    const mouthR = 0.15, mouthY = -0.03, mouthZ = 0.342;
    const cav = mk(new THREE.CircleGeometry(mouthR, 28, Math.PI, Math.PI), vnMouth, 0, mouthY, mouthZ, vnHead);
    for (let i = 0; i < 11; i++) {
      const th = Math.PI + 0.22 + (i / 10) * (Math.PI - 0.44);       // posisi sepanjang busur bawah
      const px = mouthR * Math.cos(th) * 0.93, py = mouthY + mouthR * Math.sin(th) * 0.93;
      const big = i % 2 === 0;
      const tooth = mk(new THREE.ConeGeometry(big ? 0.017 : 0.012, big ? 0.065 : 0.045, 4), vnWhite, px, py, mouthZ + 0.006, vnHead);
      tooth.rotation.z = Math.atan2(Math.cos(th), -Math.sin(th));    // ujung gigi mengarah ke tengah mulut
    }
    const tongue = mk(new THREE.CylinderGeometry(0.02, 0.012, 0.2, 8), vnTongue, 0, -0.17, 0.352, vnHead); tongue.rotation.x = -0.25;

    // Badan: lambang laba-laba putih di dada dengan kaki memanjang ke bahu.
    const vnChest = grp(rig, vnParts);
    const spBody = mk(new THREE.SphereGeometry(0.14, 20, 14), vnWhite, 0, 1.62, 0.3, vnChest); spBody.scale.set(0.85, 1.55, 0.3);
    mk(new THREE.SphereGeometry(0.06, 14, 10), vnWhite, 0, 1.86, 0.29, vnChest).scale.set(1, 1, 0.4);
    for (const sd of [-1, 1]) {
      for (const ang of [0.55, 0.15, -0.35, -0.85]) {
        const leg = new THREE.Group(); leg.position.set(sd * 0.04, 1.7, 0.305); leg.rotation.z = sd > 0 ? ang : Math.PI - ang; vnChest.add(leg);
        mk(new THREE.BoxGeometry(0.34, 0.032, 0.02), vnWhite, 0.17, 0, 0, leg);
      }
      // bahu besar & lengan berotot
      const shoulder = mk(new THREE.SphereGeometry(0.19, 22, 16), vnBlack, sd * 0.4, 1.9, 0.005, vnChest); shoulder.scale.set(1.15, 0.8, 0.95);
    }

    // Tangan hitam bercakar putih-gelap.
    for (const arm of [leftElbow, rightElbow]) {
      const hand = grp(arm, vnParts);
      const fist = mk(new THREE.SphereGeometry(0.12, 18, 12), vnBlack, 0, -0.43, 0.03, hand); fist.scale.set(1.1, 1.0, 1.1);
      for (const dx of [-0.05, 0, 0.05]) {
        const claw = mk(new THREE.ConeGeometry(0.018, 0.14, 6), vnClaw, dx, -0.49, 0.13, hand); claw.rotation.x = Math.PI / 2 + 0.35;
      }
    }
  }

  // ===== KOSTUM THE FLASH: kostum merah, tudung dengan sayap petir emas, emblem petir di dada, sabuk & sepatu emas =====
  {
    const flRed = accMat(0xc1121f, { roughness: 0.38, metalness: 0.2 });
    const flDarkRed = accMat(0x8f0b16, { roughness: 0.45, metalness: 0.15 });
    const flGold = accMat(0xf2b705, { roughness: 0.25, metalness: 0.7, emissive: 0x6b4a00, emissiveIntensity: 0.35, side: THREE.DoubleSide });
    const flWhite = accMat(0xffffff, { roughness: 0.4 });
    const flParts = costumeParts.flash;
    const bolt = new THREE.Shape(); // bentuk petir
    [[0.045, 0.13], [-0.06, -0.005], [-0.012, -0.005], [-0.05, -0.13], [0.06, 0.02], [0.012, 0.02]].forEach(([x, y], i) => i ? bolt.lineTo(x, y) : bolt.moveTo(x, y));
    bolt.closePath();
    const boltGeo = new THREE.ShapeGeometry(bolt);

    // Tudung: menutup kepala, wajah tetap terlihat.
    const flHead = grp(headGroup, flParts);
    mk(new THREE.SphereGeometry(0.328, 28, 18, Math.PI / 2 + 0.78, Math.PI * 2 - 1.56, 0, Math.PI * 0.74), flRed, 0, 0.0, 0, flHead);   // belakang & samping
    mk(new THREE.SphereGeometry(0.33, 28, 14, 0, Math.PI * 2, 0, 0.98), flRed, 0, 0.0, 0, flHead);                                      // penutup dahi
    mk(new THREE.CylinderGeometry(0.13, 0.16, 0.18, 20), flRed, 0, -0.27, 0, flHead);                                                    // leher
    for (const sd of [-1, 1]) {
      const wing = mk(new THREE.ConeGeometry(0.055, 0.28, 4), flGold, sd * 0.325, 0.1, -0.06, flHead); wing.rotation.set(-Math.PI / 2 + 0.25, 0, sd * 0.2);
      const wing2 = mk(new THREE.ConeGeometry(0.04, 0.2, 4), flGold, sd * 0.33, 0.16, -0.02, flHead); wing2.rotation.set(-Math.PI / 2 + 0.55, 0, sd * 0.25);
      const brow = mk(new THREE.BoxGeometry(0.13, 0.03, 0.04), flDarkRed, sd * 0.1, 0.17, 0.3, flHead); brow.rotation.z = -sd * 0.18;
    }

    // Dada: lingkaran putih berbingkai emas dengan petir emas.
    const flChest = grp(rig, flParts);
    const disc = mk(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 40), flWhite, 0, 1.68, 0.318, flChest); disc.rotation.x = Math.PI / 2;
    const ring = mk(new THREE.TorusGeometry(0.15, 0.022, 10, 40), flGold, 0, 1.68, 0.34, flChest);
    const b1 = mk(boltGeo, flGold, 0, 1.68, 0.345, flChest); b1.scale.setScalar(1.05);
    // Garis emas di perut, sabuk emas, dan bahu merah.
    for (const sd of [-1, 1]) {
      const stripe = mk(new THREE.BoxGeometry(0.03, 0.46, 0.02), flGold, sd * 0.21, 1.46, 0.25, flChest); stripe.rotation.z = sd * 0.12;
      const shoulder = mk(new THREE.SphereGeometry(0.17, 22, 16), flRed, sd * 0.4, 1.9, 0.005, flChest); shoulder.scale.set(1.15, 0.75, 0.92);
      const sb = mk(boltGeo, flGold, sd * 0.44, 1.93, 0.1, flChest); sb.scale.setScalar(0.7); sb.rotation.y = sd * 1.05;
    }
    const belt = grp(rig, flParts);
    mk(new THREE.BoxGeometry(0.5, 0.075, 0.49), flGold, 0, 1.12, 0, belt);
    mk(new THREE.BoxGeometry(0.1, 0.09, 0.03), flRed, 0, 1.12, 0.255, belt);

    // Sarung tangan merah dengan gelang emas.
    for (const arm of [leftElbow, rightElbow]) {
      const glove = grp(arm, flParts);
      mk(new THREE.CylinderGeometry(0.1, 0.09, 0.14, 20), flRed, 0, -0.33, 0, glove);
      mk(new THREE.TorusGeometry(0.098, 0.02, 8, 24), flGold, 0, -0.27, 0, glove).rotation.x = Math.PI / 2;
      const fist = mk(new THREE.SphereGeometry(0.113, 20, 14), flRed, 0, -0.43, 0.03, glove); fist.scale.set(1.05, 0.9, 1.08);
    }
    // Sepatu bot merah dengan bibir emas dan petir di sisi.
    for (const leg of [leftKnee, rightKnee]) {
      const boot = grp(leg, flParts);
      mk(new THREE.CylinderGeometry(0.135, 0.15, 0.43, 28), flRed, 0, -0.29, 0.015, boot);
      mk(new THREE.TorusGeometry(0.14, 0.02, 8, 28), flGold, 0, -0.08, 0.015, boot).rotation.x = Math.PI / 2;
      const toe = mk(new THREE.SphereGeometry(0.14, 22, 14), flRed, 0, -0.49, 0.11, boot); toe.scale.set(1.15, 0.55, 1.35);
      mk(new THREE.BoxGeometry(0.22, 0.035, 0.29), flGold, 0, -0.56, 0.09, boot);
      for (const sd of [-1, 1]) { const bb = mk(boltGeo, flGold, sd * 0.152, -0.27, 0.02, boot); bb.scale.setScalar(0.75); bb.rotation.y = sd * Math.PI / 2; }
    }
  }

  // ===== KOSTUM GHOST RIDER: tengkorak berapi, jaket kulit hitam berpaku dengan duri di bahu, sabuk, sarung tangan & bot kulit =====
  {
    const ghLeather = accMat(0x16161b, { roughness: 0.38, metalness: 0.12, envMap: envTex, envMapIntensity: 0.55 });
    const ghLeatherLt = accMat(0x24242b, { roughness: 0.34, metalness: 0.15, envMap: envTex, envMapIntensity: 0.6 });
    const ghBootMat = accMat(0x14110f, { roughness: 0.45, metalness: 0.1, envMap: envTex, envMapIntensity: 0.45 });
    const ghSole = accMat(0x070707, { roughness: 0.8 });
    const ghSteel = accMat(0xd3d9e2, { roughness: 0.2, metalness: 0.95, envMap: envTex, envMapIntensity: 1.2 });
    const ghBone = accMat(0xeae0c8, { roughness: 0.55 });
    const ghVoid = accMat(0x070303, { roughness: 0.9, side: THREE.DoubleSide });
    const ghEmber = new THREE.MeshBasicMaterial({ color: 0xff6a10, fog: false });
    const ghParts = costumeParts.ghost;
    const inst = (geo, mat, parent, items) => {
      const im = new THREE.InstancedMesh(geo, mat, items.length), d = new THREE.Object3D();
      items.forEach((it, i) => {
        d.position.set(...it.p); d.rotation.set(...(it.r || [0, 0, 0]));
        const s = it.s == null ? 1 : it.s; if (Array.isArray(s)) d.scale.set(...s); else d.scale.setScalar(s);
        d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      });
      im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; parent.add(im); return im;
    };

    // Kepala: tengkorak tulang dengan rongga mata membara, hidung, gigi, dan api berlapis di atasnya.
    const ghHead = grp(headGroup, ghParts);
    const skull = mk(new THREE.SphereGeometry(0.345, 30, 22), ghBone, 0, 0.04, -0.01, ghHead); skull.scale.set(1.0, 1.08, 1.02);
    mk(new THREE.CylinderGeometry(0.12, 0.15, 0.2, 18), ghLeather, 0, -0.3, 0, ghHead);                       // leher hitam
    for (const sd of [-1, 1]) {
      const sock = mk(new THREE.SphereGeometry(0.09, 18, 14), ghVoid, sd * 0.125, 0.085, 0.285, ghHead); sock.scale.set(1.0, 1.15, 0.55);
      mk(new THREE.SphereGeometry(0.026, 12, 10), ghEmber, sd * 0.125, 0.075, 0.322, ghHead);                  // bara di mata
      const cheek = mk(new THREE.SphereGeometry(0.06, 14, 10), ghBone, sd * 0.2, -0.07, 0.25, ghHead); cheek.scale.set(1, 0.8, 0.8);
    }
    const noseShape = new THREE.Shape(); noseShape.moveTo(-0.04, 0.03); noseShape.lineTo(0.04, 0.03); noseShape.lineTo(0, -0.045); noseShape.closePath();
    mk(new THREE.ShapeGeometry(noseShape), ghVoid, 0, -0.03, 0.338, ghHead);
    const jaw = mk(new THREE.SphereGeometry(0.21, 22, 14), ghBone, 0, -0.24, 0.07, ghHead); jaw.scale.set(1.02, 0.55, 0.95);
    for (let i = 0; i < 9; i++) {
      const a = -0.8 + (i / 8) * 1.6, px = 0.215 * Math.sin(a), pz = 0.085 + 0.215 * Math.cos(a);
      const up = mk(new THREE.BoxGeometry(0.034, 0.055, 0.03), ghBone, px, -0.165, pz, ghHead); up.rotation.y = a;
      const lo = mk(new THREE.BoxGeometry(0.032, 0.05, 0.03), ghBone, px, -0.235, pz, ghHead); lo.rotation.y = a;
    }
    buildGhostFire(ghHead);

    // Badan: kerah, ritsleting, paku, sabuk, dan duri baja di kedua bahu.
    const ghBody = grp(rig, ghParts);
    for (const sd of [-1, 1]) {
      const lap = mk(new THREE.BoxGeometry(0.17, 0.26, 0.045), ghLeatherLt, sd * 0.105, 1.9, 0.275, ghBody); lap.rotation.set(0.2, 0, -sd * 0.45);
      const pad = mk(new THREE.SphereGeometry(0.19, 22, 16), ghLeatherLt, sd * 0.4, 1.95, 0.005, ghBody); pad.scale.set(1.2, 0.55, 1.0);
    }
    const zip = mk(new THREE.BoxGeometry(0.022, 0.62, 0.018), ghSteel, 0.04, 1.45, 0.31, ghBody); zip.rotation.z = -0.12;
    const pocket = mk(new THREE.BoxGeometry(0.14, 0.016, 0.016), ghSteel, 0.13, 1.74, 0.31, ghBody); pocket.rotation.z = 0.35;
    const spikes = [], studs = [];
    for (const sd of [-1, 1]) {
      for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
        const h = (0.24 - 0.025 * i) * (row ? 0.8 : 1);
        spikes.push({ p: [sd * (0.3 + i * 0.07), 2.045 + h * 0.4, row ? -0.08 : 0.07], r: [0, 0, -sd * (0.25 + 0.14 * i)], s: [1 - i * 0.12, h / 0.2, 1 - i * 0.12] });
      }
      for (let i = 0; i < 7; i++) studs.push({ p: [sd * (0.09 + 0.03 * i), 1.82 - 0.075 * i, 0.31] });
    }
    for (let i = 0; i < 12; i++) studs.push({ p: [-0.2 + i * 0.036, 1.155, 0.252] });
    inst(new THREE.ConeGeometry(0.035, 0.2, 8), ghSteel, ghBody, spikes);
    inst(new THREE.SphereGeometry(0.013, 8, 6), ghSteel, ghBody, studs);
    const belt = grp(rig, ghParts);
    mk(new THREE.BoxGeometry(0.52, 0.085, 0.5), ghLeather, 0, 1.12, 0, belt);
    mk(new THREE.BoxGeometry(0.11, 0.075, 0.03), ghSteel, 0, 1.12, 0.262, belt);
    mk(new THREE.BoxGeometry(0.06, 0.04, 0.034), ghLeather, 0, 1.12, 0.264, belt);

    // Sarung tangan kulit dengan manset berpaku.
    for (const arm of [leftElbow, rightElbow]) {
      const glove = grp(arm, ghParts);
      mk(new THREE.CylinderGeometry(0.108, 0.098, 0.15, 20), ghLeather, 0, -0.33, 0, glove);
      mk(new THREE.TorusGeometry(0.105, 0.016, 8, 24), ghLeatherLt, 0, -0.26, 0, glove).rotation.x = Math.PI / 2;
      const fist = mk(new THREE.SphereGeometry(0.115, 20, 14), ghLeather, 0, -0.43, 0.03, glove); fist.scale.set(1.05, 0.9, 1.08);
      const ring = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; ring.push({ p: [Math.sin(a) * 0.109, -0.285, Math.cos(a) * 0.109] }); }
      inst(new THREE.SphereGeometry(0.012, 8, 6), ghSteel, glove, ring);
    }
    // Bot kulit hitam dengan tali & gesper.
    for (const leg of [leftKnee, rightKnee]) {
      const boot = grp(leg, ghParts);
      mk(new THREE.CylinderGeometry(0.138, 0.152, 0.45, 28), ghBootMat, 0, -0.29, 0.015, boot);
      mk(new THREE.TorusGeometry(0.142, 0.022, 8, 28), ghLeatherLt, 0, -0.07, 0.015, boot).rotation.x = Math.PI / 2;
      const toe = mk(new THREE.SphereGeometry(0.145, 22, 14), ghBootMat, 0, -0.49, 0.11, boot); toe.scale.set(1.15, 0.55, 1.35);
      mk(new THREE.BoxGeometry(0.23, 0.04, 0.31), ghSole, 0, -0.565, 0.09, boot);
      mk(new THREE.TorusGeometry(0.152, 0.018, 8, 28), ghLeatherLt, 0, -0.4, 0.015, boot).rotation.x = Math.PI / 2;
      mk(new THREE.BoxGeometry(0.06, 0.05, 0.02), ghSteel, 0, -0.4, 0.168, boot);
      mk(new THREE.TorusGeometry(0.144, 0.016, 8, 28), ghLeatherLt, 0, -0.17, 0.015, boot).rotation.x = Math.PI / 2;
      mk(new THREE.BoxGeometry(0.05, 0.045, 0.02), ghSteel, 0, -0.17, 0.162, boot);
    }
  }

  // ===== KOSTUM NARUTO: ikat kepala Konoha, rambut jabrik kuning, kumis kucing, jaket oranye-hitam, kantong kaki berpita =====
  {
    const nrDark = accMat(0x3a3b46, { roughness: 0.6 });
    const nrBlack = accMat(0x111116, { roughness: 0.55 });
    const nrNavy = accMat(0x1c2a56, { roughness: 0.5, side: THREE.DoubleSide });
    const nrSteel = accMat(0xc9d1d9, { metalness: 0.85, roughness: 0.25, envMap: envTex, envMapIntensity: 1 });
    const nrWhite = accMat(0xf1f1f1, { roughness: 0.7 });
    const nrSpike = accMat(0xf5d142, { roughness: 0.55 });
    const nrBlue = accMat(0x2f7fe0, { roughness: 0.3 });
    const nrMark = accMat(0x3a2418, { roughness: 0.9 });
    const nrParts = costumeParts.naruto;

    // Kepala: ikat kepala biru dengan pelat logam, pita hitam, rambut jabrik, mata biru & tiga kumis di tiap pipi.
    const nrHead = grp(headGroup, nrParts);
    const band = mk(new THREE.CylinderGeometry(0.306, 0.306, 0.09, 32, 1, true), nrNavy, 0, 0.15, 0, nrHead); band.rotation.x = -0.06;
    mk(new THREE.BoxGeometry(0.24, 0.09, 0.02), nrSteel, 0, 0.15, 0.308, nrHead);
    const leaf = mk(new THREE.TorusGeometry(0.022, 0.006, 8, 16), nrBlack, 0, 0.15, 0.32, nrHead);
    mk(new THREE.BoxGeometry(0.022, 0.006, 0.006), nrBlack, 0.02, 0.135, 0.322, nrHead).rotation.z = 0.6;
    for (const sd of [-1, 1]) {
      const tail = mk(new THREE.BoxGeometry(0.045, 0.34, 0.01), nrBlack, sd * 0.2, 0.0, -0.27, nrHead); tail.rotation.set(0.25, 0, sd * 0.35);
      mk(new THREE.SphereGeometry(0.04, 16, 12), nrBlue, sd * 0.1, 0.05, 0.295, nrHead); // iris biru
      for (let i = 0; i < 3; i++) {
        const y = -0.05 + (i - 1) * 0.034, x = sd * 0.2;
        const z = Math.sqrt(Math.max(0.0001, 0.09 - x * x - y * y)) + 0.004;
        const w = mk(new THREE.BoxGeometry(0.1, 0.012, 0.012), nrMark, x, y, z, nrHead);
        w.rotation.set(0, sd * Math.atan2(Math.abs(x), z), sd * (i - 1) * 0.22);
      }
    }
    [[0, 0.9, 0.45], [0.5, 0.85, 0.3], [-0.5, 0.85, 0.3], [0.8, 0.6, 0], [-0.8, 0.6, 0], [0.55, 0.75, -0.4], [-0.55, 0.75, -0.4], [0, 0.75, -0.65], [0.95, 0.1, 0.1], [-0.95, 0.1, 0.1]].forEach(([x, y, z]) => {
      const v = new THREE.Vector3(x, y, z).normalize();
      const c = mk(new THREE.ConeGeometry(0.075, 0.28, 6), nrSpike, v.x * 0.29, 0.02 + v.y * 0.29, v.z * 0.29, nrHead);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    });

    // Badan: bagian atas jaket abu-hitam, bawah oranye (warna dasar), ritsleting, kerah tinggi, ikat pinggang.
    const nrBody = grp(rig, nrParts);
    mk(new THREE.CylinderGeometry(0.31, 0.31, 0.34, 28), nrDark, 0, 1.63, 0, nrBody);
    mk(new THREE.SphereGeometry(0.305, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), nrDark, 0, 1.8, 0, nrBody);
    mk(new THREE.BoxGeometry(0.02, 0.62, 0.012), nrBlack, 0, 1.5, 0.304, nrBody);
    mk(new THREE.CylinderGeometry(0.17, 0.2, 0.14, 24), nrBlack, 0, 1.95, 0, nrBody);
    mk(new THREE.CylinderGeometry(0.315, 0.315, 0.09, 28), nrBlack, 0, 1.17, 0, nrBody);
    for (const [piv, el] of [[leftArmPivot, leftElbow], [rightArmPivot, rightElbow]]) {
      const up = grp(piv, nrParts); mk(new THREE.CapsuleGeometry(0.108, 0.25, 10, 24), nrDark, 0, -0.22, 0, up);
      const lo = grp(el, nrParts);
      mk(new THREE.CapsuleGeometry(0.093, 0.25, 10, 24), nrDark, 0, -0.2, 0, lo);
      mk(new THREE.CylinderGeometry(0.098, 0.098, 0.06, 20), nrBlack, 0, -0.33, 0, lo);
    }
    // Kantong senjata di paha kiri (sisi kiri layar) + perban putih bergaris biru.
    const pouch = grp(leftLegPivot, nrParts);
    mk(new THREE.BoxGeometry(0.1, 0.17, 0.12), nrNavy, -0.17, -0.17, 0, pouch);
    mk(new THREE.CylinderGeometry(0.13, 0.13, 0.11, 24), nrWhite, 0, -0.2, 0, pouch);
    mk(new THREE.CylinderGeometry(0.133, 0.133, 0.035, 24), nrNavy, 0, -0.2, 0, pouch);
    // Sandal shinobi: bot abu-hitam setinggi mata kaki.
    for (const leg of [leftKnee, rightKnee]) {
      const boot = grp(leg, nrParts);
      mk(new THREE.CylinderGeometry(0.108, 0.116, 0.2, 20), nrDark, 0, -0.33, 0, boot);
      mk(new THREE.TorusGeometry(0.112, 0.014, 8, 20), nrBlack, 0, -0.26, 0, boot).rotation.x = Math.PI / 2;
    }
  }

  // ===== KOSTUM LUFFY: topi jerami, rompi merah terbuka dengan bekas luka X, sabuk kuning, celana biru berbulu, sandal =====
  {
    const lfSkin = accMat(0xffd1b3, { roughness: 0.7, side: THREE.DoubleSide });
    const lfRed = accMat(0xd8262e, { roughness: 0.6 });
    const lfYellow = accMat(0xf7c81f, { roughness: 0.65, side: THREE.DoubleSide });
    const lfStraw = accMat(0xe8c15a, { roughness: 0.9 });
    const lfStrawDk = accMat(0xc99b3a, { roughness: 0.9 });
    const lfBand = accMat(0xc0271f, { roughness: 0.6 });
    const lfScar = accMat(0xc57d78, { roughness: 0.8 });
    const lfFur = accMat(0xeef0f2, { roughness: 1 });
    const lfGold = accMat(0xd4a017, { metalness: 0.8, roughness: 0.3 });
    const lfBlack = accMat(0x141416, { roughness: 0.7 });
    const lfStrap = accMat(0x4a2f1b, { roughness: 0.8 });
    const lfParts = costumeParts.luffy;

    // Kepala: topi jerami lebar dengan pita merah, poni & cambang hitam, bekas luka di bawah mata.
    const lfHead = grp(headGroup, lfParts);
    mk(new THREE.SphereGeometry(0.335, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lfStraw, 0, 0.12, 0, lfHead).scale.set(1, 1.05, 1.05);
    const brim = mk(new THREE.CylinderGeometry(0.58, 0.58, 0.035, 40), lfStraw, 0, 0.12, 0, lfHead); brim.rotation.x = -0.08;
    const edge = mk(new THREE.TorusGeometry(0.58, 0.016, 8, 48), lfStrawDk, 0, 0.12, 0, lfHead); edge.rotation.x = Math.PI / 2 - 0.08;
    for (const r of [0.42, 0.5]) { const ring = mk(new THREE.TorusGeometry(r, 0.006, 6, 48), lfStrawDk, 0, 0.14, 0, lfHead); ring.rotation.x = Math.PI / 2 - 0.08; }
    mk(new THREE.TorusGeometry(0.338, 0.03, 10, 40), lfBand, 0, 0.17, 0, lfHead).rotation.x = Math.PI / 2;
    for (const sd of [-1, 1]) mk(new THREE.BoxGeometry(0.05, 0.14, 0.1), lfBlack, sd * 0.265, -0.02, 0.1, lfHead);
    for (const x of [-0.12, 0, 0.12]) { const b = mk(new THREE.ConeGeometry(0.05, 0.14, 5), lfBlack, x, 0.09, 0.27, lfHead); b.rotation.x = Math.PI; }
    const scar = mk(new THREE.BoxGeometry(0.07, 0.012, 0.012), lfScar, 0.11, -0.04, 0.28, lfHead); scar.rotation.set(0, 0.38, 0.5);
    for (const o of [-0.022, 0.022]) mk(new THREE.BoxGeometry(0.012, 0.03, 0.01), lfScar, 0.11 + o, -0.04 - o * 0.5, 0.282, lfHead).rotation.set(0, 0.38, 0.5);

    // Badan: dada terbuka dengan bekas luka X, kancing emas di rompi, sabuk kuning dengan ujung menjuntai.
    const lfBody = grp(rig, lfParts);
    mk(new THREE.CylinderGeometry(0.305, 0.305, 0.58, 20, 1, true, -0.36, 0.72), lfSkin, 0, 1.5, 0, lfBody);
    for (const sg of [-1, 1]) mk(new THREE.BoxGeometry(0.15, 0.012, 0.01), lfScar, 0, 1.62, 0.308, lfBody).rotation.z = sg * 0.75;
    for (const y of [1.75, 1.6, 1.45]) mk(new THREE.SphereGeometry(0.022, 10, 8), lfGold, -0.2, y, 0.228, lfBody);
    mk(new THREE.TorusGeometry(0.325, 0.055, 10, 32), lfYellow, 0, 1.14, 0, lfBody).rotation.x = Math.PI / 2;
    const tail = mk(new THREE.BoxGeometry(0.17, 0.44, 0.03), lfYellow, 0.26, 0.96, 0.2, lfBody); tail.rotation.set(0.12, 0, -0.08);
    mk(new THREE.SphereGeometry(0.07, 12, 10), lfYellow, 0.24, 1.14, 0.28, lfBody).scale.set(1.3, 1, 0.8);
    // Ujung lengan rompi melebar.
    for (const el of [leftElbow, rightElbow]) {
      const cuff = grp(el, lfParts);
      mk(new THREE.CylinderGeometry(0.125, 0.095, 0.1, 20), lfRed, 0, -0.33, 0, cuff);
    }
    // Celana pendek biru berbulu putih di ujungnya; betis & kaki telanjang, sandal bertali.
    for (const leg of [leftLegPivot, rightLegPivot]) {
      const fur = grp(leg, lfParts);
      mk(new THREE.TorusGeometry(0.117, 0.04, 10, 24), lfFur, 0, -0.37, 0, fur).rotation.x = Math.PI / 2;
    }
    for (const leg of [leftKnee, rightKnee]) {
      const g = grp(leg, lfParts);
      mk(new THREE.CapsuleGeometry(0.106, 0.2, 8, 20), lfSkin, 0, -0.2, 0, g);
      mk(new THREE.BoxGeometry(0.17, 0.09, 0.28), lfSkin, 0, -0.33, 0.06, g);
      mk(new THREE.BoxGeometry(0.19, 0.02, 0.05), lfStrap, 0, -0.3, 0.1, g);
    }
  }

  // ===== KOSTUM GOJO SATORU: seragam biru tua berkerah tinggi, kacamata bulat, rambut putih jabrik, bola energi biru =====
  {
    const gjNavy = accMat(0x1c2238, { roughness: 0.55, side: THREE.DoubleSide });
    const gjNavyDk = accMat(0x10142a, { roughness: 0.6 });
    const gjGold = accMat(0xe0b84a, { metalness: 0.8, roughness: 0.3 });
    const gjLens = accMat(0x2a3fb0, { roughness: 0.1, metalness: 0.3, emissive: 0x0d1a66, emissiveIntensity: 0.4 });
    const gjRim = accMat(0x0b0b10, { roughness: 0.3, metalness: 0.6 });
    const gjHair = accMat(0xf4f6ff, { roughness: 0.55 });
    const gjBlue = new THREE.MeshBasicMaterial({ color: 0x7fd0ff });
    const gjAura = new THREE.MeshBasicMaterial({ color: 0x3d8bff, transparent: true, opacity: 0.35, depthWrite: false });
    const gjParts = costumeParts.gojo;

    // Kepala: kacamata bulat berlensa biru, rambut putih jabrik dengan poni jatuh.
    const gjHead = grp(headGroup, gjParts);
    for (const sd of [-1, 1]) {
      mk(new THREE.CylinderGeometry(0.068, 0.068, 0.012, 24), gjLens, sd * 0.1, 0.05, 0.352, gjHead).rotation.x = Math.PI / 2;
      mk(new THREE.TorusGeometry(0.07, 0.01, 8, 24), gjRim, sd * 0.1, 0.05, 0.352, gjHead);
      mk(new THREE.BoxGeometry(0.012, 0.012, 0.27), gjRim, sd * 0.235, 0.05, 0.22, gjHead).rotation.y = sd * 2.678;
    }
    mk(new THREE.BoxGeometry(0.04, 0.012, 0.012), gjRim, 0, 0.06, 0.352, gjHead);
    [[0, 1, 0.2], [0.45, 0.95, 0.1], [-0.45, 0.95, 0.1], [0.7, 0.75, -0.1], [-0.7, 0.75, -0.1], [0.3, 0.9, -0.5], [-0.3, 0.9, -0.5], [0, 0.8, -0.7], [0.2, 0.9, 0.5], [-0.2, 0.9, 0.5]].forEach(([x, y, z]) => {
      const v = new THREE.Vector3(x, y, z).normalize();
      const c = mk(new THREE.ConeGeometry(0.07, 0.3, 6), gjHair, v.x * 0.29, 0.02 + v.y * 0.29, v.z * 0.29, gjHead);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    });
    for (const x of [-0.18, -0.09, 0, 0.09, 0.18]) { const b = mk(new THREE.ConeGeometry(0.045, 0.2, 5), gjHair, x, 0.2, 0.27 - Math.abs(x) * 0.5, gjHead); b.rotation.x = Math.PI - 0.15; }

    // Badan: kerah berdiri, kancing emas, garis penutup miring, kelim bawah.
    const gjBody = grp(rig, gjParts);
    mk(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 24, 1, true), gjNavy, 0, 1.93, 0, gjBody);
    mk(new THREE.BoxGeometry(0.015, 0.6, 0.01), gjNavyDk, 0.06, 1.51, 0.3, gjBody).rotation.z = 0.19;
    mk(new THREE.SphereGeometry(0.022, 10, 8), gjGold, 0.13, 1.78, 0.272, gjBody);
    mk(new THREE.TorusGeometry(0.31, 0.02, 8, 32), gjNavyDk, 0, 1.0, 0, gjBody).rotation.x = Math.PI / 2;
    for (const el of [leftElbow, rightElbow]) {
      const cuff = grp(el, gjParts);
      mk(new THREE.CylinderGeometry(0.096, 0.096, 0.05, 20), gjNavyDk, 0, -0.33, 0, cuff);
    }
    // Bola energi biru melayang di depan tangan kanan.
    const orb = grp(rightElbow, gjParts);
    mk(new THREE.SphereGeometry(0.07, 20, 16), gjBlue, 0, -0.5, 0.2, orb);
    mk(new THREE.SphereGeometry(0.115, 20, 16), gjAura, 0, -0.5, 0.2, orb);
    mk(new THREE.TorusGeometry(0.13, 0.008, 8, 32), gjBlue, 0, -0.5, 0.2, orb).rotation.x = Math.PI / 2.3;
  }

  updateCharacterVisuals();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.minDistance = 1.0; controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.enableZoom = true; controls.zoomSpeed = 1.8; controls.rotateSpeed = 0.9;
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }; // 1 jari = putar kamera, 2 jari = cubit zoom

  // Kamera dapat diputar dengan geser satu jari dan di-zoom dengan cubit dua jari.
  // Tidak ada tombol zoom +/- agar layar permainan lebih bersih.

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

  // Analog hanya mengikuti JARINYA SENDIRI (identifier), jadi geser layar dengan jari lain tidak mengganggu
  let joyId = null;
  const findTouch = (list) => { for (const tc of list) if (tc.identifier === joyId) return tc; return null; };
  const moveKnobTo = (cx, cy) => { const rect = joystickArea.getBoundingClientRect(); updateKnob(cx - (rect.left + rect.width / 2), cy - (rect.top + rect.height / 2)); };
  const handleEnd = () => { joystickActive = false; joyId = null; joystickVector.set(0, 0); joystickKnob.style.transform = 'translate(-50%, -50%)'; };

  joystickArea.addEventListener('touchstart', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (joyId !== null) return;
    const tc = e.changedTouches[0]; joyId = tc.identifier; joystickActive = true; moveKnobTo(tc.clientX, tc.clientY);
  }, { passive: false });
  joystickArea.addEventListener('touchmove', (e) => { const tc = findTouch(e.changedTouches); if (!tc) return; e.preventDefault(); moveKnobTo(tc.clientX, tc.clientY); }, { passive: false });
  const endTouch = (e) => { if (findTouch(e.changedTouches)) handleEnd(); };
  joystickArea.addEventListener('touchend', endTouch);
  joystickArea.addEventListener('touchcancel', endTouch);

  let mouseJoy = false; // desktop
  joystickArea.addEventListener('mousedown', (e) => { e.preventDefault(); mouseJoy = true; moveKnobTo(e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (mouseJoy) moveKnobTo(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (mouseJoy) { mouseJoy = false; handleEnd(); } });

  // Sistem lompatan 2 tahap: satu lompatan dari tanah + satu lompatan di udara.
  // Hitungan tidak di-reset saat karakter masih naik, supaya double jump konsisten di HP maupun PC.
  const triggerPlayerJump = () => {
    if (gameState !== 'PLAYING' || flyMode || !physics || isFrozenLocal()) return;
    const maxJumps = Math.max(2, Number(physics.maxJumps) || 2);
    let usedJumps = Math.max(0, Number(physics.jumpCount) || 0);
    if (physics.isGrounded) usedJumps = 0;
    if (usedJumps >= maxJumps) return;
    physics.jumpCount = usedJumps + 1;
    physics.velocityY = physics.jumpForce;
    physics.isGrounded = false;
    playJumpSound(); sq.v = 6;
    if (physics.jumpCount === 1) spawnDust(5);
    createJumpEffect();
  };
  const jumpButton = document.getElementById('btn-jump');
  jumpButton.style.touchAction = 'none';
  jumpButton.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    triggerPlayerJump();
  });

  const btnRun = document.getElementById('btn-run');
  btnRun.addEventListener('touchstart', (e) => { e.preventDefault(); isRunning = true; });
  btnRun.addEventListener('touchend', (e) => { e.preventDefault(); isRunning = false; });
  btnRun.addEventListener('pointerdown', (e) => { isRunning = true; });
  btnRun.addEventListener('pointerup', (e) => { isRunning = false; });
  btnRun.addEventListener('pointerleave', (e) => { isRunning = false; });

  document.getElementById('btn-restart').addEventListener('click', () => { if (gameState === 'WIN') location.reload(); else respawn(); });
  document.getElementById('overlay').style.display = 'none';

  updateCharacterNameSprite(playerData.username, playerData.isDev);
  buildLobbyLeaderboard();
  updateLobbyLeaderboard();
  refreshSoloLeaderboard(true).catch(() => {});
  if (!window.__soloLeaderboardTimer) window.__soloLeaderboardTimer = setInterval(() => { if (!roomCode) refreshSoloLeaderboard(); }, 10000);
  setupAdminPanel();
  animate();
}

function insidePlat(p, x, z, pad) {
  const m = p.mesh.position;
  if (p.r) return Math.hypot(x - m.x, z - m.z) < p.r + pad;
  return x + pad > m.x - p.width / 2 && x - pad < m.x + p.width / 2 && z + pad > m.z - p.depth / 2 && z - pad < m.z + p.depth / 2;
}

function checkGroundCollision(x, z, y) {
  const feetY = y; const tolerance = 0.3;
  for (let p of platforms) {
    if (p.isFallen || p.type === 'fake') continue;
    if (insidePlat(p, x, z, 0)) {
      const topY = p.mesh.position.y + (p.hh || 0.25);
      if (feetY >= topY - tolerance && feetY <= topY + 0.5) return { y: topY, platform: p };
    }
  }
  return null;
}

function checkWallCollision(x, z, y) {
  const radius = 0.35; const feetY = y;
  for (let p of platforms) {
    if (p.isFallen || p.type === 'fake') continue;
    const hh = p.hh || 0.25, topY = p.mesh.position.y + hh, bottomY = p.mesh.position.y - hh;
    if (feetY < topY - 0.1 && feetY > bottomY - 1 && insidePlat(p, x, z, radius)) return true;
  }
  return false;
}

// Layar menang: tulisan kecil di atas (langsung muncul), tombol "Kembali Lobby" di kanan bawah setelah 5 detik
// supaya animasi menang masih terlihat jelas (tidak tertutup overlay besar).
let winUiTimer = null;
function hideWinUi() {
  if (winUiTimer) { clearTimeout(winUiTimer); winUiTimer = null; }
  const b = document.getElementById('win-banner'); if (b) b.style.display = 'none';
  const l = document.getElementById('btn-win-lobby'); if (l) l.style.display = 'none';
}
function showWinBanner(detail) {
  const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'none';
  if (!document.getElementById('win-ui-style')) {
    const st = document.createElement('style'); st.id = 'win-ui-style';
    st.textContent = '#win-banner{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:70;padding:6px 16px;border-radius:14px;background:rgba(0,0,0,.6);border:2px solid #ffd166;color:#ffd166;font:800 15px sans-serif;text-align:center;pointer-events:none;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;animation:winBannerIn .4s ease-out}#win-banner small{display:block;color:#fff;font:600 12px sans-serif;margin-top:1px}@keyframes winBannerIn{from{opacity:0;transform:translate(-50%,-14px)}to{opacity:1;transform:translate(-50%,0)}}#btn-win-lobby{position:fixed;right:16px;bottom:16px;z-index:80;padding:12px 18px;border-radius:14px;border:2px solid #ffd166;background:linear-gradient(#ffe27a,#ff9f1c);color:#3a2300;font:800 15px sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.4);touch-action:manipulation;-webkit-tap-highlight-color:transparent;display:none}#btn-win-lobby:active{transform:scale(.95)}';
    document.head.appendChild(st);
  }
  let b = document.getElementById('win-banner');
  if (!b) { b = document.createElement('div'); b.id = 'win-banner'; document.body.appendChild(b); }
  b.innerHTML = '🏆 ANDA MENANG' + (detail ? '<small></small>' : '');
  if (detail) b.querySelector('small').textContent = detail;
  b.style.display = 'block'; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  let l = document.getElementById('btn-win-lobby');
  if (!l) {
    l = document.createElement('button'); l.id = 'btn-win-lobby'; l.type = 'button'; l.textContent = 'Kembali Lobby';
    l.addEventListener('click', () => { hideWinUi(); if (roomCode) returnToLobby(); else location.reload(); });
    document.body.appendChild(l);
  }
  l.style.display = 'none';
  if (winUiTimer) clearTimeout(winUiTimer);
  winUiTimer = setTimeout(() => { winUiTimer = null; if (gameState === 'WIN') l.style.display = 'block'; }, 5000);
}

function showOverlay(title, desc, color) {
  const t = document.getElementById('overlay-title');
  t.textContent = title; t.style.color = color; t.style.fontSize = ''; t.style.maxWidth = ''; t.style.textAlign = ''; t.style.lineHeight = '';
  document.getElementById('overlay-desc').textContent = desc;
  document.getElementById('overlay').style.display = 'flex';
}

// Pengganti tulisan GAME OVER: kalimat roasting, lalu "Coba lagi" di bawahnya (admin/dev tidak di-roasting)
function showGameOver(kind) {
  const arr = ROASTS[kind];
  const msg = isAdminUser() ? '💥 Kena!' : arr[Math.floor(Math.random() * arr.length)];
  showOverlay(msg, 'Coba lagi 👇', '#ff3333');
  const t = document.getElementById('overlay-title');
  t.style.fontSize = 'clamp(22px, 6vw, 34px)'; t.style.maxWidth = '90vw'; t.style.textAlign = 'center'; t.style.lineHeight = '1.3';
}

function updateCharacterNameSprite(username, isDev) {
  if (!character) return;
  if (nameSprite) { character.remove(nameSprite); scene.remove(nameSprite); nameSprite.material.map.dispose(); nameSprite.material.dispose(); }
  const bj = SHOP_ITEMS.baju.find(i => i.id === playerData.equipped.baju);
  const label = bj ? (bj.web ? '🕸️ ' : bj.bat ? '🦇 ' : bj.iron ? '🤖 ' : bj.thor ? '⚡ ' : bj.hulk ? '💚 ' : '👕 ') + bj.name : '';
  const canvasName = document.createElement('canvas');
  canvasName.width = 512; canvasName.height = 176;
  const ctxName = canvasName.getContext('2d');
  ctxName.clearRect(0, 0, 512, 176);
  ctxName.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctxName.beginPath(); ctxName.roundRect(10, 10, 492, 88, 20); ctxName.fill();
  ctxName.font = 'bold 50px sans-serif'; ctxName.fillStyle = '#ffffff'; ctxName.textAlign = 'center'; ctxName.textBaseline = 'middle';
  if (hasVip()) paintVipName(ctxName, username, 50, isDev); else ctxName.fillText(username, 256, 54);
  if (isDev) {
    ctxName.beginPath(); ctxName.arc(430, 54, 28, 0, Math.PI * 2); ctxName.fillStyle = '#1DA1F2'; ctxName.fill();
    ctxName.strokeStyle = '#ffffff'; ctxName.lineWidth = 4; ctxName.stroke();
    ctxName.beginPath(); ctxName.moveTo(418, 54); ctxName.lineTo(426, 64); ctxName.lineTo(444, 44); ctxName.strokeStyle = '#ffffff'; ctxName.lineWidth = 6; ctxName.lineCap = 'round'; ctxName.lineJoin = 'round'; ctxName.stroke();
  }
  if (label) {
    ctxName.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctxName.beginPath(); ctxName.roundRect(60, 106, 392, 56, 16); ctxName.fill();
    ctxName.font = 'bold 30px sans-serif'; ctxName.fillStyle = '#ffd166'; ctxName.fillText(label, 256, 135);
  }
  const textureName = new THREE.CanvasTexture(canvasName);
  nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureName, depthTest: false, depthWrite: false }));
  nameSprite.position.set(0, 3.3, 0);
  nameSprite.scale.set(2, 0.6875, 1);
  character.add(nameSprite);
}

// ============ MULTIPLAYER ROOM: kode lobby, host yang memulai, waktu sinkron ============
const MAX_PLAYERS = 8, ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LOBBY_SLOTS = [[-1.7, 0], [1.7, 0], [-3.4, 0], [3.4, 0], [0, 2], [-1.7, 2], [1.7, 2], [-3.4, 2], [3.4, 2]];
const SPAWN = [[0, 0], [-1.5, 0], [1.5, 0], [-3, 0], [3, 0], [-1.5, 1.5], [1.5, 1.5], [0, 1.5]];
let mpUid = null, mpReady = false, mpOffset = 0;
let roomCode = null, roomMeta = null, roomPlayers = {}, roomUnsub = null, roomStartAt = null, roomStarted = false;
let lastRoundStartAt = null; // startAt ronde yang sudah/pernah dijalankan di klien ini (grup tetap utuh antar ronde)
let lobbyLeaderboardGroup = null, lobbyLeaderboardTexture = null, lobbyLeaderboardCanvas = null, lobbyLeaderboardCtx = null, lobbyLeaderboardLastKey = '';
const lobbyLeaderboardAvatars = new Map();
let deathFrozenMs = null, roomRunReset = 0;
let honeyRoundEnded = false, honeyWinAwarded = false;
const isSurvivalMap = () => currentMap === 'honey' || currentMap === 'laser' || currentMap === 'lavaland'; // bertahan terakhir menang (Honey & Laser)
// Waktu berjalan sejak mulai/respawn terakhir
function rawElapsedMs() {
  return roomStartAt ? Math.max(0, serverNow() - Math.max(roomStartAt, roomRunReset)) : Math.max(0, performance.now() - soloStart);
}
// Saat mati (GAMEOVER) timer dibekukan, tidak lanjut jalan
function runElapsedMs() {
  if (finishMs != null) return finishMs;
  if (gameState === 'GAMEOVER') { if (deathFrozenMs == null) deathFrozenMs = rawElapsedMs(); return deathFrozenMs; }
  return rawElapsedMs();
}
// Timer ikut di-reset ke 00:00.0 setiap karakter di-reset/respawn
function resetRunTimer() {
  deathFrozenMs = null;
  if (roomStartAt) roomRunReset = serverNow(); else soloStart = performance.now();
}
let myRef = null, myJoinedAt = 0, mpLastSend = 0, mpEquipTimer = null, soloStart = 0, finishMs = null, lastLobbyCount = -1, rpCollapsed = false;
let soloLeaderboardEntries = [], soloLeaderboardLoading = false, soloLeaderboardLastFetch = 0;
let personalRunScore = 0;
const remotePlayers = new Map(), announcedFinish = new Set(), tmpV = new THREE.Vector3();
const serverNow = () => Date.now() + mpOffset;
const genCode = () => Array.from({ length: 5 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join('');
const sortedIds = () => Object.keys(roomPlayers).sort((a, b) => ((roomPlayers[a].joinedAt || 0) - (roomPlayers[b].joinedAt || 0)) || a.localeCompare(b));
const myEquipped = () => ({ baju: playerData.equipped.baju, celana: playerData.equipped.celana, sepatu: playerData.equipped.sepatu, aksesoris: playerData.equipped.aksesoris || 'aks_none' });
function mpErr(e) { const m = String((e && (e.code || e.message)) || e); return /permission/i.test(m) ? 'Izin ditolak Firebase. Cek Rules (lihat README).' : m.replace(/^Error: /, ''); }

async function ensureMp() {
  if (mpReady) return;
  try { mpUid = (await signInAnonymously(multiplayerAuth)).user.uid; }
  catch (e) { console.warn('Anonymous auth gagal, lanjut tanpa auth:', e); mpUid = 'g' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  onValue(ref(multiplayerDb, '.info/serverTimeOffset'), (sn) => { mpOffset = sn.val() || 0; });
  mpReady = true;
}

async function createRoom() {
  await ensureMp();
  let code = null;
  for (let i = 0; i < 6; i++) { const c = genCode(); if (!(await get(ref(multiplayerDb, `rooms/${c}/meta`))).exists()) { code = c; break; } }
  if (!code) throw new Error('Gagal membuat kode, coba lagi');
  await set(ref(multiplayerDb, `rooms/${code}/meta`), { host: mpUid, hostName: String(playerData.username).slice(0, 18), createdAt: Date.now() });
  await enterRoom(code);
}

async function joinRoom(code) {
  await ensureMp();
  const meta = await get(ref(multiplayerDb, `rooms/${code}/meta`));
  if (!meta.exists()) throw new Error('Kode room tidak ditemukan');
  if (Date.now() - (meta.val().createdAt || 0) > 6 * 3600 * 1000) throw new Error('Room sudah kedaluwarsa');
  const ps = await get(ref(multiplayerDb, `rooms/${code}/players`));
  if (ps.exists() && Object.keys(ps.val()).length >= MAX_PLAYERS) throw new Error('Room penuh (maks ' + MAX_PLAYERS + ')');
  await enterRoom(code);
}

async function enterRoom(code) {
  roomCode = code; roomStarted = false; roomStartAt = null; lastRoundStartAt = null; announcedFinish.clear();
  myRef = ref(multiplayerDb, `rooms/${code}/players/${mpUid}`);
  await onDisconnect(myRef).remove();
  myJoinedAt = Date.now();
  await set(myRef, { vip: hasVip(), username: String(playerData.username).slice(0, 18), userKey: accountKey(), playerId: String(playerData.playerId || (playerData.isDev ? ADMIN_PLAYER_ID : '')), isDev: !!playerData.isDev, equipped: myEquipped(), status: 'LOBBY', joinedAt: myJoinedAt, updatedAt: Date.now() });
  roomUnsub = onValue(ref(multiplayerDb, `rooms/${code}`), onRoomSnapshot, (err) => { console.error(err); setRoomMsg(mpErr(err)); });
  rpCollapsed = true; // setelah masuk room, panel langsung mengecil
  updateRoomUI();
}

// Ronde dianggap sedang berjalan jika startAt baru saja ditetapkan atau masih ada pemain yang belum kembali ke lobby.
function roomRoundBusy() {
  if (!roomMeta || !roomMeta.startAt) return false;
  if (serverNow() < roomMeta.startAt + 8000) return true;
  return Object.values(roomPlayers || {}).some(p => p && p.status && String(p.status).toUpperCase() !== 'LOBBY');
}

function onRoomSnapshot(sn) {
  const room = sn.val();
  if (!room || !room.meta) { if (roomCode && !roomStarted) { leaveRoom(true); setRoomMsg('Room ditutup'); } return; }
  roomMeta = room.meta; roomPlayers = room.players || {};
  if (!roomPlayers[roomMeta.host]) { // host keluar: pemain paling lama jadi host baru
    const ids = sortedIds();
    if (ids[0] === mpUid) update(ref(multiplayerDb, `rooms/${roomCode}/meta`), { host: mpUid, hostName: String(playerData.username).slice(0, 18) }).catch(() => {});
  }
  updateRoomUI(); updateRemoteAvatars();
  if (currentMap === 'honey' && honeyWorld && roomStartAt) honeyWorld.syncRemote(roomPlayers, mpUid, serverNow(), roomStartAt);
  if (currentMap === 'lavaland' && lavaLandWorld && roomStartAt) lavaLandWorld.syncRemote(roomPlayers, mpUid, serverNow(), roomStartAt);
  if (isSurvivalMap() && roomMeta.startAt) checkHoneyLastPlayer();
  if (roomMeta.startAt && !roomStarted && roomMeta.startAt !== lastRoundStartAt && roomRoundBusy()) { // host menekan MULAI (atau kamu gabung saat game sudah jalan)
    roomStarted = true; roomStartAt = roomMeta.startAt; lastRoundStartAt = roomMeta.startAt;
    document.getElementById('btn-start-game').click();
  }
}

async function hostStart() {
  if (!roomCode || !roomMeta || roomMeta.host !== mpUid) return;
  if (roomRoundBusy()) { showToast('Tunggu semua teman kembali ke lobby dulu.'); return; }
  if (Object.keys(roomPlayers || {}).length < 2) {
    showToast('Tunggu teman menerima undangan dan masuk lobby dulu.');
    return;
  }
  await update(ref(multiplayerDb, `rooms/${roomCode}/meta`), { startAt: serverNow() + 4500, map: rollMap(true) });
}

async function leaveRoom(silent) {
  const code = roomCode; if (!code) return;
  const alone = Object.keys(roomPlayers).length <= 1;
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  try {
    if (myRef) { await onDisconnect(myRef).cancel(); await remove(myRef); }
    if (alone && !silent) await remove(ref(multiplayerDb, `rooms/${code}`));
  } catch (e) { console.warn(e); }
  for (const id of [...remotePlayers.keys()]) disposeAvatar(id);
  roomCode = null; roomMeta = null; roomPlayers = {}; myRef = null; roomStartAt = null; roomStarted = false; lastRoundStartAt = null; lastLobbyCount = -1; rpCollapsed = false;
  if (camera && controls) { camera.position.set(0, 3.8, 9.5); controls.target.set(0, 1.45, 0); }
  updateRoomUI();
}

function mpSyncEquipped() {
  if (!myRef) return;
  clearTimeout(mpEquipTimer);
  mpEquipTimer = setTimeout(() => update(myRef, { equipped: myEquipped() }).catch(() => {}), 400);
}

// dipanggil tombol start (solo) ATAU saat host memulai room
function onGameBegin() {
  setLobbyOnlyHud(false);
  // Tampilkan tepat SATU map aktif. Sebelumnya parkourWorldGroup ikut
  // dinyalakan untuk Angkasa sehingga lantai/lava map lama terlihat menembus.
  if (parkourWorldGroup) parkourWorldGroup.visible = currentMap === 'lava';
  if (snowWorldGroup) snowWorldGroup.visible = currentMap === 'snow';
  if (angkasaWorldGroup) angkasaWorldGroup.visible = currentMap === 'angkasa';
  if (mountainWorldGroup) mountainWorldGroup.visible = currentMap === 'mountain';
  if (honeyWorldGroup) honeyWorldGroup.visible = currentMap === 'honey';
  if (laserWorldGroup) laserWorldGroup.visible = currentMap === 'laser';
  if (lavaLandWorldGroup) lavaLandWorldGroup.visible = currentMap === 'lavaland';
  if (lobbyWorldGroup) lobbyWorldGroup.visible = false;
  if (scene) {
    if (currentMap === 'snow') {
      scene.background = new THREE.Color(0xbcd8ee);
      scene.fog = new THREE.Fog(0xbcd8ee, 30, 190);
    } else if (currentMap === 'angkasa') {
      if (angkasaController && angkasaController.enter) angkasaController.enter(scene);
      else { scene.background = new THREE.Color(0x000000); scene.fog = null; }
    } else if (currentMap === 'mountain') {
      scene.background = new THREE.Color(0x9fc8e8);
      scene.fog = new THREE.Fog(0x9fc8e8, 45, 230);
    } else if (currentMap === 'honey') {
      scene.background = new THREE.Color(0x58b8f0); scene.fog = new THREE.Fog(0x9fd8ff, 60, 160);
    } else if (currentMap === 'laser' && laserWorld) {
      laserWorld.applyEnvironment(scene);
    } else if (currentMap === 'lavaland' && lavaLandWorld) {
      lavaLandWorld.applyEnvironment(scene);
    } else {
      scene.background = new THREE.Color(0x1a1a24);
      scene.fog = new THREE.Fog(0x1a1a24, 20, 150);
    }
  }
  const rp = document.getElementById('room-panel'); if (rp) rp.style.display = 'none';
  finishMs = null; deathFrozenMs = null; roomRunReset = 0; honeyRoundEnded = false; honeyWinAwarded = false;
  { const rb = document.getElementById('btn-restart'); if (rb) rb.style.display = ''; }
  hideWinUi();
  personalRunScore = 0;
  activatedCheckpoints = new WeakSet();
  // Reset warna/status checkpoint hanya saat putaran baru dimulai. Respawn tidak meresetnya.
  platforms.forEach(pl => { if (pl.checkpoint) { pl.checkpointActivated = false; if (pl.checkpointReadyMaterial) pl.mesh.material = pl.checkpointReadyMaterial; } });
  checkpoint = { p: null, set: false, x: 0, y: 0.25, z: 0 };
  if (camera && controls) { camera.position.set(0, 4, 8); controls.target.set(0, 1.5, 0); }
  if (currentMap === 'honey' && honeyWorld) honeyWorld.reset();
  if (currentMap === 'laser' && laserWorld) laserWorld.reset();
  if (currentMap === 'lavaland' && lavaLandWorld) { lavaLandWorld.reset(); showLavaLandIntro(); }
  if (roomCode && roomStartAt) {
    const idx = Math.max(0, sortedIds().indexOf(mpUid)), sp = SPAWN[idx % SPAWN.length];
    if (currentMap === 'honey') character.position.set(sp[0], honeyWorld.spawn.y, sp[1]); else if (currentMap === 'laser') character.position.set(sp[0], laserWorld.spawn.y, sp[1]); else if (currentMap === 'lavaland') character.position.set(sp[0], lavaLandWorld.spawn.y, sp[1]); else character.position.set(sp[0], 0.25, sp[1]); checkpoint.x = character.position.x; checkpoint.z = character.position.z;
    gameState = serverNow() < roomStartAt ? 'COUNTDOWN' : 'PLAYING';
    update(myRef, { status: 'PLAYING', deadAt: null, ht: null, lt: null, out: null, finishMs: null, score: null, eliminatedAt: null, wonAt: null }).catch(() => {});
  } else {
    soloStart = performance.now(); gameState = 'PLAYING'; if (currentMap === 'honey') character.position.copy(honeyWorld.spawn); else character.position.set(0, 0.25, 0); checkpoint.x = character.position.x; checkpoint.z = character.position.z;
    restoreSavedCheckpoint();
  }
}
// Pulihkan checkpoint terakhir (mode solo): karakter muncul di checkpoint tersimpan, bukan di awal.
function restoreSavedCheckpoint() {
  const sc = currentMap === 'snow' ? playerData.savedCheckpointSnow : (currentMap === 'mountain' ? playerData.savedCheckpointMountain : playerData.savedCheckpoint); // checkpoint tiap map terpisah
  if (!sc || roomCode) return;
  const pl = platforms.find(p => p.checkpoint && Math.abs(p.mesh.position.x - sc.px) < 0.06 && Math.abs(p.mesh.position.y - sc.py) < 0.06 && Math.abs(p.mesh.position.z - sc.pz) < 0.06);
  if (!pl) return;
  pl.checkpointActivated = true; activatedCheckpoints.add(pl);
  if (usedCheckpointMat) pl.mesh.material = usedCheckpointMat;
  checkpoint = { p: pl, set: true, x: pl.mesh.position.x, y: sc.y, z: pl.mesh.position.z };
  character.position.set(checkpoint.x, checkpoint.y + 0.3, checkpoint.z);
  physics.velocityY = 0; moveVel.set(0, 0); knock.set(0, 0);
  if (camera && controls) { controls.target.set(checkpoint.x, checkpoint.y + 1.5, checkpoint.z); camera.position.set(checkpoint.x, checkpoint.y + 4, checkpoint.z + 8); }
  showToast('📍 Lanjut dari checkpoint terakhir');
}

function scoreFromTime(ms) {
  // Semakin cepat menyelesaikan parkour, semakin tinggi skor.
  return Math.max(0, 100000 - Math.floor(Math.max(0, ms) / 100));
}

async function savePersonalBest(score, timeMs) {
  const key = accountKey();
  if (!key) return;
  const latestRes = await fetch(`${FIREBASE_URL}leaderboard/${key}.json`, { cache: 'no-store' });
  if (!latestRes.ok) throw new Error('Gagal membaca rekor sebelumnya');
  const latestProfile = await latestRes.json() || {};
  const oldScore = Number(latestProfile.bestScore) || 0;
  // Rekor hanya diganti jika skor baru lebih tinggi; skor lebih rendah tidak menimpa rekor.
  if (score <= oldScore) {
    playerData.bestScore = oldScore;
    playerData.bestTimeMs = Number(latestProfile.bestTimeMs) || 0;
    return;
  }
  playerData.bestScore = score;
  playerData.bestTimeMs = Math.round(timeMs);
  const res = await fetch(`${FIREBASE_URL}leaderboard/${key}.json`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: String(playerData.username || key).slice(0, 18), playerId: String(playerData.playerId || ''), isDev: !!playerData.isDev, equipped: myEquipped(), crowns: Math.max(0, Number(playerData.crowns) || 0), bestScore: score, bestTimeMs: Math.round(timeMs), updatedAt: Date.now() })
  });
  if (!res.ok) throw new Error('Gagal menyimpan rekor leaderboard');
  refreshSoloLeaderboard(true).catch(() => {});
}

function onFinish() {
  if (finishMs != null) return;
  finishMs = rawElapsedMs();
  personalRunScore = scoreFromTime(finishMs);
  if (myRef) update(myRef, { finishMs: Math.round(finishMs), score: personalRunScore }).catch(() => {});
  awardWinCrown().catch(e => { console.warn('Mahkota kemenangan gagal disimpan:', e); showToast('⚠️ Mahkota gagal disimpan ke Firebase'); });
  if (currentMap === 'lava') savePersonalBest(personalRunScore, finishMs).catch(e => console.warn('Simpan rekor gagal:', e)); // leaderboard lama khusus map Lava
  updateLobbyLeaderboard();
  triggerWinFx();
}
function finishSummary() {
  if (!roomCode) return '';
  return ' • Peringkat #' + (Object.entries(roomPlayers).filter(([id, p]) => id !== mpUid && p.finishMs != null && p.finishMs < finishMs).length + 1);
}

function honeyEliminateLocal(reason) {
  if (honeyRoundEnded || gameState !== 'PLAYING') return;
  honeyRoundEnded = true; gameState = 'GAMEOVER'; shatterLocal();
  if (myRef) update(myRef, { status: 'ELIMINATED', eliminatedAt: serverNow() }).catch(() => {});
  showOverlay('YOU LOSE', reason === 'laser' ? 'Kamu kena laser lebih dulu! 🔴' : (currentMap === 'laser' ? 'Kamu jatuh ke slime lebih dulu! 🟢' : currentMap === 'lavaland' ? 'Kamu jatuh ke lava lebih dulu! 🌋' : 'Kamu jatuh lebih dulu! 🍯'), '#ff4242');
  { const rb = document.getElementById('btn-restart'); if (rb) rb.style.display = 'none'; } // tanpa tombol coba lagi
  setTimeout(() => { if (gameState === 'GAMEOVER' && isSurvivalMap()) returnToLobby(); }, 1800);
}
function honeyDeclareWin() {
  if (honeyWinAwarded || honeyRoundEnded) return;
  honeyWinAwarded = true; honeyRoundEnded = true; gameState = 'WIN';
  if (myRef) update(myRef, { status: 'WIN', wonAt: serverNow() }).catch(() => {});
  triggerWinFx();
  awardWinCrown().catch(e => { console.warn('Gagal memberi mahkota:', e); showToast('⚠️ Mahkota gagal disimpan'); });
  showWinBanner('Pemain terakhir bertahan  +1 👑');
  { const rb = document.getElementById('btn-restart'); if (rb) rb.style.display = 'none'; }
}
function checkHoneyLastPlayer() {
  if (!roomCode || !roomPlayers || honeyRoundEnded || gameState !== 'PLAYING') return;
  const active = Object.entries(roomPlayers).filter(([id, p]) =>
    id === mpUid ? gameState === 'PLAYING' :
    !(['ELIMINATED', 'WIN', 'LEFT'].includes(String(p.status || '').toUpperCase()) || (p.out && p.out === roomStartAt)));
  if (active.length === 1 && active[0][0] === mpUid) honeyDeclareWin();
}
function tickMultiplayer() {
  if (gameState === 'COUNTDOWN' && roomStartAt) {
    const left = roomStartAt - serverNow(), el = document.getElementById('countdown');
    if (left <= 0) { gameState = 'PLAYING'; if (el) el.style.display = 'none'; showToast('🏁 MULAI!'); }
    else if (el) { el.style.display = 'flex'; el.textContent = Math.ceil(left / 1000); }
  }
  if (!roomCode || !myRef || !character || !(gameState === 'PLAYING' || gameState === 'GAMEOVER' || gameState === 'WIN')) return;
  const now = performance.now(); if (now - mpLastSend < 100) return; mpLastSend = now;
  update(myRef, { vip: hasVip(), x: +character.position.x.toFixed(2), y: +character.position.y.toFixed(2), z: +character.position.z.toFixed(2), rot: +character.rotation.y.toFixed(2), status: (isSurvivalMap() && (gameState === 'GAMEOVER' || gameState === 'WIN')) ? (gameState === 'WIN' ? 'WIN' : 'ELIMINATED') : 'PLAYING', username: String(playerData.username).slice(0, 18), userKey: accountKey(), playerId: String(playerData.playerId || (playerData.isDev ? ADMIN_PLAYER_ID : '')), isDev: !!playerData.isDev, joinedAt: myJoinedAt, updatedAt: Date.now() }).catch(() => {});
}

// ----- avatar pemain lain (kostum ikut dipakai) -----
function disposeAvatar(id) {
  const av = remotePlayers.get(id); if (!av) return;
  scene.remove(av);
  const u = av.userData;
  (u.mats || []).forEach(m => m.dispose());
  if (u.label) { u.label.material.map.dispose(); u.label.material.dispose(); }
  remotePlayers.delete(id);
}
function makeLabelSprite(o) { // o: { name, owner, host, costume }
  const c = document.createElement('canvas'); c.width = 512; c.height = 176; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.roundRect(10, 10, 492, 88, 20); x.fill();
  x.textBaseline = 'middle'; x.textAlign = 'left';
  const prefix = o.host ? '👑 ' : '';
  x.font = 'bold 46px sans-serif'; const w1 = x.measureText(prefix + o.name).width;
  let w2 = 0, w3 = 0;
  if (o.owner) { x.font = 'bold 30px sans-serif'; w2 = x.measureText(' owner').width; w3 = 62; }
  let cx = 256 - (w1 + w2 + w3) / 2;
  if (o.vip && !o.owner) paintVipName(x, prefix + o.name, 46, false); else { x.font = 'bold 46px sans-serif'; x.fillStyle = '#ffffff'; x.fillText(prefix + o.name, cx, 56); }
  cx += w1;
  if (o.owner) {
    x.font = 'bold 30px sans-serif'; x.fillStyle = '#ffd166'; x.fillText(' owner', cx, 58); cx += w2 + 8;
    // centang biru digambar langsung (bukan emoji) supaya tampil di semua HP
    x.beginPath(); x.arc(cx + 22, 54, 24, 0, Math.PI * 2); x.fillStyle = '#1DA1F2'; x.fill(); x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.stroke();
    x.beginPath(); x.moveTo(cx + 11, 54); x.lineTo(cx + 19, 63); x.lineTo(cx + 34, 44); x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke();
  }
  if (o.costume) {
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.roundRect(60, 106, 392, 56, 16); x.fill();
    x.font = 'bold 30px sans-serif'; x.fillStyle = '#ffd166'; x.textAlign = 'center'; x.fillText(o.costume, 256, 135);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false }));
  sp.position.y = 3.3; sp.scale.set(2, 0.6875, 1); return sp;
}
function applyRemoteCostume(u, eq) {
  const { baju, iron, thor, celana: cV, sepatu: sV } = pickCostume(eq);
  const ap = applyItemMat;
  u.model.traverse((o) => {
    if (!o.isMesh) return;
    const t = o.userData.type;
    if (t === 'baju') ap(o.material, baju); else if (t === 'celana') ap(o.material, cV); else if (t === 'sepatu') ap(o.material, sV);
  });
  const vis = (orig, v) => { const c = u.map.get(orig); if (c) c.visible = v; };
  setCostumeVis(baju, o => u.map.get(o));
  u.model.traverse(o => { if (o.isMesh && o.userData.type === 'rambut') o.visible = !(baju.saitama || baju.sonic || baju.venom || baju.flash || baju.ghost); });
  applyBodyType(u.model, u.parts, baju.hulk, baju.sonic ? 0x1d5fd1 : baju.venom ? 0x0b0d16 : 0, costumeHairHex(baju));
  const a = eq.aksesoris || 'aks_none';
  Object.keys(acc).forEach(id => vis(acc[id], !(iron || thor) && id === a));
  u.fire = baju.ghost ? collectFire(u.model) : null;
  u.costumeName = baju.name;
}
function makeRemotePlayer(uid, data) {
  const eq = data.equipped || {};
  const model = character.clone(true), map = new Map();
  const walk = (a, b) => { map.set(a, b); a.children.forEach((ch, i) => { if (b.children[i]) walk(ch, b.children[i]); }); };
  walk(character, model);
  const ns = map.get(nameSprite); if (ns) model.remove(ns); // label karakter lokal tidak ikut
  const mm = new Map(), mats = [];
  model.traverse((o) => { if (o.material) { if (!mm.has(o.material)) { const c = o.material.clone(); mm.set(o.material, c); mats.push(c); } o.material = mm.get(o.material); } });
  model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.scale.set(1, 1, 1);
  const P = (o) => map.get(o);
  const parts = { rig: P(rig), head: P(headGroup), armL: P(leftArmPivot), armR: P(rightArmPivot), legL: P(leftLegPivot), legR: P(rightLegPivot), elL: P(leftElbow), elR: P(rightElbow), knL: P(leftKnee), knR: P(rightKnee), capes: [P(capePivot), P(capeB), P(capeT)].filter(Boolean) };
  [parts.rig, parts.head, parts.armL, parts.armR, parts.legL, parts.legR, parts.elL, parts.elR, parts.knL, parts.knR, ...parts.capes].forEach(o => o && o.rotation.set(0, 0, 0));
  parts.rig.position.set(0, 0, 0); parts.rig.scale.set(1, 1, 1);
  const g = new THREE.Group(); g.add(model);
  Object.assign(g.userData, { eqKey: JSON.stringify(eq), model, map, mats, parts, ph: Math.random() * 6, spd: 0, last: new THREE.Vector3(), lastY: 0, d: data, slot: [0, 0], spawn: [0, 0], first: true });
  applyRemoteCostume(g.userData, eq);
  scene.add(g); remotePlayers.set(uid, g); return g;
}
function updateRemoteAvatars() {
  if (!scene || !character) return;
  const ids = sortedIds(), others = ids.filter(id => id !== mpUid), alive = new Set(others);
  others.forEach((id, i) => {
    const d = roomPlayers[id]; if (!d) return;
    let av = remotePlayers.get(id);
    if (av && av.userData.eqKey !== JSON.stringify(d.equipped || {})) { disposeAvatar(id); av = null; }
    let fresh = false;
    if (!av) { av = makeRemotePlayer(id, d); fresh = true; av.userData.deadAt = d.deadAt || null; av.visible = !d.deadAt; }
    const u = av.userData; u.d = d;
    if (!fresh) {
      if (d.deadAt && u.deadAt !== d.deadAt) { // pemain lain jatuh ke lava: badannya hancur di layar kita juga
        u.deadAt = d.deadAt;
        if (serverNow() - d.deadAt < 6000) spawnShatter(d.x != null ? tmpV.set(Number(d.x) || 0, Number(d.y) || 0, Number(d.z) || 0) : av.position, d.equipped);
        av.visible = false;
      } else if (!d.deadAt && u.deadAt) { u.deadAt = null; av.visible = true; u.first = true; }
    } u.slot = LOBBY_SLOTS[i % LOBBY_SLOTS.length]; u.spawn = SPAWN[ids.indexOf(id) % SPAWN.length];
    const lbl = { name: String(d.username || 'Pemain').slice(0, 14), owner: !!d.isDev, host: !!(roomMeta && roomMeta.host === id), costume: u.costumeName, vip: !!d.vip };
    const text = JSON.stringify(lbl);
    if (u.labelText !== text) {
      if (u.label) { av.remove(u.label); u.label.material.map.dispose(); u.label.material.dispose(); }
      u.label = makeLabelSprite(lbl); u.labelText = text; av.add(u.label);
    }
    if (d.finishMs != null && !announcedFinish.has(id + ':' + d.finishMs)) { announcedFinish.add(id + ':' + d.finishMs); showToast('🏁 ' + String(d.username || 'Pemain') + ' berhasil finish!'); }
  });
  for (const id of [...remotePlayers.keys()]) if (!alive.has(id)) disposeAvatar(id);
  if (gameState === 'LOBBY' && remotePlayers.size !== lastLobbyCount && camera) { // zoom out otomatis supaya semua pemain kelihatan
    lastLobbyCount = remotePlayers.size;
    camera.position.set(0, 3.8 + 0.2 * lastLobbyCount, 9.5 + 1.2 * lastLobbyCount); controls.target.set(0, 1.45, 0.35 * lastLobbyCount);
  }
}
function animateRemotePlayers(delta) {
  if (!remotePlayers.size) return;
  const blend = 1 - Math.exp(-delta * 12), now = performance.now() / 1000, inGame = !!roomStartAt;
  for (const av of remotePlayers.values()) {
    const u = av.userData, d = u.d || {};
    { const away = inGame && String(d.status || '').toUpperCase() === 'LOBBY'; av.visible = !away && !u.deadAt; if (away) continue; }
    let rot;
    if (inGame && d.status === 'PLAYING' && d.x != null) { tmpV.set(Number(d.x) || 0, Number(d.y) || 0, Number(d.z) || 0); rot = Number(d.rot) || 0; }
    else if (inGame) { tmpV.set(u.spawn[0], 0.25, u.spawn[1]); rot = 0; }
    else { tmpV.set(u.slot[0], 0.25, u.slot[1]); rot = character ? character.rotation.y : 0; }
    if (u.first || av.position.distanceTo(tmpV) > 14) { av.position.copy(tmpV); u.first = false; u.last.copy(tmpV); u.lastY = tmpV.y; }
    else av.position.lerp(tmpV, blend);
    av.rotation.y += Math.atan2(Math.sin(rot - av.rotation.y), Math.cos(rot - av.rotation.y)) * blend;
    const dt = Math.max(delta, 1e-3), hv = Math.hypot(av.position.x - u.last.x, av.position.z - u.last.z) / dt, vy = (av.position.y - u.lastY) / dt;
    u.last.copy(av.position); u.lastY = av.position.y; u.spd += (hv - u.spd) * 0.2;
    const air = Math.abs(vy) > 2.5, k = 1 - Math.exp(-delta * 14), P = u.parts;
    u.ph += delta * u.spd * 1.7;
    const moving = u.spd > 0.4, runK = Math.min(1, Math.max(0, (u.spd - 5) / 4));
    let lH = 0, rH = 0, lK = 0, rK = 0, lA = 0, rA = 0, lE = -0.15, rE = -0.15, armZ = 0.1, bob = 0, lean = 0, twist = 0, headY = 0;
    if (air) { lH = -0.5; rH = 0.4; lK = 0.6; rK = 0.5; lA = rA = -1.4; lE = rE = -0.5; armZ = 0.6; lean = 0.1; }
    else if (moving) {
      const sn = Math.sin(u.ph), cs = Math.cos(u.ph), amp = 0.55 + runK * 0.4;
      lH = sn * amp; rH = -sn * amp; lK = Math.max(0, -cs) * (0.7 + runK * 0.8) + 0.08; rK = Math.max(0, cs) * (0.7 + runK * 0.8) + 0.08;
      lA = -sn * amp * 0.9; rA = sn * amp * 0.9; lE = -(0.25 + runK * 0.9) - Math.max(0, sn) * 0.3; rE = -(0.25 + runK * 0.9) - Math.max(0, -sn) * 0.3;
      bob = Math.abs(sn) * (0.05 + runK * 0.05); lean = 0.06 + runK * 0.2; twist = -sn * (0.12 + runK * 0.1); armZ = 0.12;
    } else {
      const br = Math.sin(now * 2.2 + u.ph);
      bob = br * 0.008; lA = Math.sin(now * 1.3 + u.ph) * 0.04; rA = -lA; armZ = 0.1 + br * 0.015; lE = rE = -0.12; headY = Math.sin(now * 0.5 + u.ph) * 0.35;
    }
    { // teman lain terlihat mendorong: dibaca dari data push di node pemain
      const pu = d.push;
      if (pu && pu.seq !== u.pushSeen) { u.pushSeen = pu.seq; if (Math.abs(Date.now() - (Number(pu.t) || 0)) < 3000) u.pushStart = now; }
      if (u.pushStart != null) { const pp = (now - u.pushStart) / (PUSH_ANIM_MS / 1000);
        if (pp >= 0 && pp < 1) { const Q = pushPose(pp); lA = rA = Q.arm; lE = rE = Q.el; armZ = Q.armZ; lean = Q.lean; bob = Q.bob; } }
    }
    const dm = (o, key, v) => { if (o) o[key] += (v - o[key]) * k; };
    dm(P.legL.rotation, 'x', lH); dm(P.legR.rotation, 'x', rH); dm(P.knL.rotation, 'x', lK); dm(P.knR.rotation, 'x', rK);
    dm(P.armL.rotation, 'x', lA); dm(P.armR.rotation, 'x', rA); dm(P.elL.rotation, 'x', lE); dm(P.elR.rotation, 'x', rE);
    dm(P.armL.rotation, 'z', -armZ); dm(P.armR.rotation, 'z', armZ); dm(P.head.rotation, 'y', headY);
    dm(P.rig.position, 'y', bob); dm(P.rig.rotation, 'x', lean); dm(P.rig.rotation, 'y', twist);
    const capeX = 0.08 + u.spd * 0.05 + (air ? 0.4 : 0);
    P.capes.forEach(cp => dm(cp.rotation, 'x', capeX));
  }
}


// ----- Papan leaderboard 3D di belakang karakter (sinkron per-room) -----
function buildLobbyLeaderboard() {
  if (lobbyLeaderboardGroup || !lobbyWorldGroup || !character) return;

  lobbyLeaderboardGroup = new THREE.Group();
  lobbyLeaderboardGroup.name = 'LOBBY_ONLINE_LEADERBOARD';
  // Di belakang karakter utama, tepat di belakang area START dan menghadap pemain.
  lobbyLeaderboardGroup.position.set(0, 0, -6.35);
  lobbyLeaderboardGroup.rotation.y = 0;
  lobbyWorldGroup.add(lobbyLeaderboardGroup);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, metalness: 0.05, roughness: 0.85 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.55, 5.55), frameMat);
  frame.position.set(0, 2.78, -0.06);
  frame.castShadow = true;
  frame.receiveShadow = true;
  lobbyLeaderboardGroup.add(frame);

  lobbyLeaderboardCanvas = document.createElement('canvas');
  lobbyLeaderboardCanvas.width = 1024;
  lobbyLeaderboardCanvas.height = 1024;
  lobbyLeaderboardCtx = lobbyLeaderboardCanvas.getContext('2d');
  lobbyLeaderboardTexture = new THREE.CanvasTexture(lobbyLeaderboardCanvas);
  lobbyLeaderboardTexture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(5.35, 5.35),
    new THREE.MeshBasicMaterial({ map: lobbyLeaderboardTexture, transparent: false, side: THREE.DoubleSide })
  );
  panel.position.set(0, 2.78, 0.075);
  lobbyLeaderboardGroup.add(panel);

  // Lampu tepi agar papan mudah terlihat di lobby.
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf2b84b });
  for (const [x, y, z, w, h, d] of [
    [0, 5.48, 0.12, 5.4, 0.045, 0.05],
    [0, 0.08, 0.12, 5.4, 0.045, 0.05],
    [-2.68, 2.78, 0.12, 0.045, 5.4, 0.05],
    [2.68, 2.78, 0.12, 0.045, 5.4, 0.05]
  ]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), edgeMat);
    edge.position.set(x, y, z);
    lobbyLeaderboardGroup.add(edge);
  }
}

function createLeaderboardAvatar(data) {
  const eq = data.equipped || {};
  const model = character.clone(true);
  const map = new Map();
  const walk = (a, b) => {
    map.set(a, b);
    a.children.forEach((ch, i) => { if (b.children[i]) walk(ch, b.children[i]); });
  };
  walk(character, model);

  const ns = map.get(nameSprite);
  if (ns) model.remove(ns);

  const materialMap = new Map(), mats = [];
  model.traverse((obj) => {
    if (!obj.material) return;
    if (!materialMap.has(obj.material)) {
      const cloned = obj.material.clone();
      materialMap.set(obj.material, cloned);
      mats.push(cloned);
    }
    obj.material = materialMap.get(obj.material);
  });

  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);

  const P = (obj) => map.get(obj);
  const parts = {
    rig: P(rig), head: P(headGroup),
    armL: P(leftArmPivot), armR: P(rightArmPivot),
    legL: P(leftLegPivot), legR: P(rightLegPivot),
    elL: P(leftElbow), elR: P(rightElbow),
    knL: P(leftKnee), knR: P(rightKnee),
    capes: [P(capePivot), P(capeB), P(capeT)].filter(Boolean)
  };
  [parts.rig, parts.head, parts.armL, parts.armR, parts.legL, parts.legR,
    parts.elL, parts.elR, parts.knL, parts.knR, ...parts.capes]
    .forEach(obj => obj && obj.rotation.set(0, 0, 0));

  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(0.16);
  holder.userData = { model, map, mats, parts, eqKey: JSON.stringify(eq) };
  applyRemoteCostume(holder.userData, eq);
  return holder;
}

function disposeLeaderboardAvatar(id) {
  const avatar = lobbyLeaderboardAvatars.get(id);
  if (!avatar) return;
  if (lobbyLeaderboardGroup) lobbyLeaderboardGroup.remove(avatar);
  (avatar.userData.mats || []).forEach(mat => mat.dispose());
  lobbyLeaderboardAvatars.delete(id);
}

async function refreshSoloLeaderboard(force = false) {
  if (soloLeaderboardLoading || ( !force && Date.now() - soloLeaderboardLastFetch < 10000)) return;
  soloLeaderboardLoading = true;
  try {
    const [data, profiles] = await Promise.all([
      socialGet('leaderboard').catch(() => ({})),
      socialGet('players').catch(() => ({}))
    ]);
    await loadCrownSettings();
    // Sumber data = gabungan node `leaderboard` + `players` (profil). Dulu hanya node `leaderboard` yang dibaca dan
    // wajib punya bestScore > 0 (rekor Lava), sehingga pemain yang mahkotanya didapat dari map lain (Salju, Angkasa,
    // Gunung, Honey, Laser) tidak pernah masuk walau mahkotanya sudah tersimpan di DB. Sekarang cukup mahkota >= minimal.
    const lb = data || {}, pf = profiles || {};
    const keys = new Set([...Object.keys(lb), ...Object.keys(pf)]);
    const rows = [];
    for (const key of keys) {
      const p = lb[key] || {}, prof = pf[key] || {};
      if (!p || typeof p !== 'object' || !prof || typeof prof !== 'object') continue;
      const crowns = key === DEV_USERNAME ? ADMIN_FIXED_CROWNS : Math.max(0, Math.floor(Number(prof.crowns ?? p.crowns) || 0));
      if (crowns <= 0 || crowns < leaderboardMinCrowns) continue;
      rows.push({
        id: key, username: String(prof.username || p.username || key).slice(0, 18),
        playerId: String(prof.playerId || p.playerId || (key === DEV_USERNAME ? ADMIN_PLAYER_ID : '------')),
        isDev: !!(prof.isDev ?? p.isDev), equipped: prof.equipped || p.equipped || {}, crowns,
        bestScore: Number(p.bestScore) || 0, bestTimeMs: Number(p.bestTimeMs) || 0,
        finishMs: Number(p.bestTimeMs) || null
      });
    }
    soloLeaderboardEntries = rows
      .sort((a, b) => b.crowns - a.crowns || String(a.username).localeCompare(String(b.username)))
      .slice(0, MAX_PLAYERS);
    soloLeaderboardLastFetch = Date.now();
    if (!roomCode) updateLobbyLeaderboard();
  } catch (e) { console.warn('Leaderboard solo belum dapat dimuat:', e); }
  finally { soloLeaderboardLoading = false; }
}

function updateLobbyLeaderboard() {
  if (!lobbyLeaderboardGroup || !lobbyLeaderboardCtx || !lobbyLeaderboardTexture) return;

  const sourcePlayers = roomCode ? (roomPlayers || {}) : Object.fromEntries(soloLeaderboardEntries.map(p => [p.id, p]));
  const ids = Object.keys(sourcePlayers).sort((a, b) => {
    const pa = sourcePlayers[a] || {}, pb = sourcePlayers[b] || {};
    if (!roomCode) return (Number(pb.crowns) || 0) - (Number(pa.crowns) || 0) || String(pa.username || '').localeCompare(String(pb.username || ''));
    const af = Number.isFinite(Number(pa.finishMs)) && pa.finishMs != null;
    const bf = Number.isFinite(Number(pb.finishMs)) && pb.finishMs != null;
    if (af && bf) return Number(pb.score || 0) - Number(pa.score || 0) || Number(pa.finishMs) - Number(pb.finishMs);
    if (af !== bf) return af ? -1 : 1;
    return (pa.joinedAt || 0) - (pb.joinedAt || 0);
  }).slice(0, MAX_PLAYERS);

  const entries = ids.map((id, index) => {
    const p = sourcePlayers[id] || {};
    const finished = roomCode ? (p.finishMs != null && Number.isFinite(Number(p.finishMs))) : Number(p.bestScore) > 0;
    const score = roomCode ? (Number(p.score) || 0) : (Number(p.bestScore) || 0);
    const timeMs = roomCode ? (Number(p.finishMs) || 0) : (Number(p.bestTimeMs) || 0);
    return {
      id, index, name: String(p.username || 'Pemain').slice(0, 18),
      crowns: Math.max(0, Math.floor(Number(p.crowns) || 0)), finished, score, timeMs,
      host: !!(roomMeta && roomMeta.host === id),
      isMe: roomCode ? id === mpUid : id === accountKey(),
      eqKey: JSON.stringify(p.equipped || {})
    };
  });
  const key = JSON.stringify({ roomCode, entries: entries.map(e => [e.id, e.name, e.finished, e.score, e.timeMs, e.host, e.isMe, e.eqKey, e.crowns]) });
  if (key === lobbyLeaderboardLastKey) return;
  lobbyLeaderboardLastKey = key;

  // Gambar ulang panel papan.
  const c = lobbyLeaderboardCanvas, x = lobbyLeaderboardCtx;
  x.clearRect(0, 0, c.width, c.height);
  const grad = x.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#f6ead0'); grad.addColorStop(1, '#ecd9b2');
  x.fillStyle = grad; x.fillRect(0, 0, 1024, 1024);
  x.strokeStyle = '#6b4a2f'; x.lineWidth = 12; x.strokeRect(12, 12, 1000, 1000);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '900 76px sans-serif'; x.fillStyle = '#4a2f1b';
  x.fillText('LEADERBOARD', 512, 82);
  x.font = 'bold 30px sans-serif'; x.fillStyle = '#b5513a';
  x.fillText(roomCode ? `GRUP TEMAN  •  ${entries.length}/${MAX_PLAYERS} PEMAIN` : `JUMLAH MAHKOTA • MIN. ${leaderboardMinCrowns} 👑`, 512, 142);
  x.strokeStyle = 'rgba(107,74,47,.55)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(55, 188); x.lineTo(969, 188); x.stroke();

  if (!entries.length) {
    x.fillStyle = '#5c4630'; x.font = 'bold 38px sans-serif';
    x.fillText(roomCode ? 'MENUNGGU PEMAIN' : 'BELUM ADA REKOR', 512, 470);
    x.font = '28px sans-serif'; x.fillStyle = '#8a7355';
    x.fillText(roomCode ? 'Mulai lomba untuk melihat peringkat' : 'Selesaikan parkour untuk masuk leaderboard', 512, 525);
  } else {
    entries.forEach((e, i) => {
      const top = 205 + i * 99;
      x.fillStyle = e.isMe ? 'rgba(224,99,58,.22)' : (i % 2 ? 'rgba(74,47,27,.07)' : 'rgba(74,47,27,.13)');
      x.beginPath(); x.roundRect(42, top, 940, 88, 18); x.fill();
      x.fillStyle = i === 0 && e.finished ? '#c98a10' : '#b5513a';
      x.font = '900 42px sans-serif'; x.textAlign = 'left';
      x.fillText(String(i + 1).padStart(2, '0'), 72, top + 44);
      x.fillStyle = '#3b2616'; x.font = 'bold 36px sans-serif';
      const name = (e.host ? '👑 ' : '') + e.name + (e.isMe ? ' (KAMU)' : '');
      x.fillText(name, 178, top + 34, 500);
      x.textAlign = 'left'; x.font = '22px sans-serif'; x.fillStyle = '#8a7355';
      x.fillText('ID ' + String((sourcePlayers[e.id] || {}).playerId || (e.name.toLowerCase() === DEV_USERNAME ? ADMIN_PLAYER_ID : '------')), 180, top + 67, 460);
      x.textAlign = 'right'; x.font = '900 30px sans-serif';
      x.fillStyle = '#b87400';
      x.fillText('👑 ' + String(e.crowns), 950, top + 44);
    });
  }
  lobbyLeaderboardTexture.needsUpdate = true;

  // Miniatur karakter 3D asli (termasuk wajah dan kostum) ditampilkan di depan tiap baris.
  const alive = new Set(entries.map(e => e.id));
  for (const id of [...lobbyLeaderboardAvatars.keys()]) if (!alive.has(id)) disposeLeaderboardAvatar(id);
  entries.forEach((e, i) => {
    const p = sourcePlayers[e.id] || {};
    let avatar = lobbyLeaderboardAvatars.get(e.id);
    if (avatar && avatar.userData.eqKey !== e.eqKey) {
      disposeLeaderboardAvatar(e.id);
      avatar = null;
    }
    if (!avatar) {
      avatar = createLeaderboardAvatar(p);
      lobbyLeaderboardAvatars.set(e.id, avatar);
      lobbyLeaderboardGroup.add(avatar);
    }
    // Board group diputar menghadap tengah lobby; posisi ini berada sedikit di depan permukaan papan.
    avatar.position.set(-1.95, 4.62 - i * 0.495, 0.22);
    avatar.rotation.y = 0;
    avatar.visible = true;
  });
}

// ----- SISTEM TEMAN, PENCARIAN, DAN UNDANGAN -----
let playerSearchBusy = false;
let socialPollTimer = null;
let socialPollBusy = false;
let activeInviteKey = '';
let lastInviteToastStamp = '', lastRequestSig = null;
const myPlayerKey = () => accountKey();
const socialUrl = path => `${FIREBASE_URL}${path}.json`;

async function socialGet(path) {
  const res = await fetch(socialUrl(path), { cache: 'no-store' });
  if (!res.ok) throw new Error('Firebase tidak merespons');
  return await res.json();
}
async function socialPatch(path, data) {
  const res = await fetch(socialUrl(path), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Gagal menyimpan data sosial');
  return res;
}
function safeSocialText(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ===== GANTI NAMA PROFIL =====
// Akun punya dua hal: KUNCI AKUN (permanen: dipakai pertemanan, leaderboard, presence, undangan, inventory, koin)
// dan NAMA TAMPILAN (bisa diganti). Ganti nama hanya mengubah nama tampilan -> semua data & pertemanan tetap utuh.
// Nama baru juga bisa dipakai untuk login (indeks `usernames/<nama>` -> kunci akun); nama lama tetap bisa dipakai login.
// Ganti nama pertama GRATIS, kedua dan seterusnya 10.000 koin.
const RENAME_COST = 10000, NAME_MIN = 3, NAME_MAX = 18;
function accountKey() { return String((playerData && (playerData.userKey || playerData.username)) || '').trim().toLowerCase(); }
async function resolveUserKey(name) { // nama (asli atau hasil ganti nama) -> kunci akun
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return lower;
  try {
    const r = await fetch(`${FIREBASE_URL}usernames/${encodeURIComponent(lower)}.json`, { cache: 'no-store' });
    if (r.ok) { const k = await r.json(); if (typeof k === 'string' && k) return k; }
  } catch (e) { /* offline: pakai nama apa adanya */ }
  return lower;
}
const fmtCoins = (n) => Number(n || 0).toLocaleString('id-ID');
const renameCount = () => Math.max(0, Math.floor(Number(playerData.nameChanges) || 0));
const nextRenameCost = () => renameCount() === 0 ? 0 : RENAME_COST;
function validateNewName(raw) {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN) return { ok: false, msg: `Nama minimal ${NAME_MIN} karakter` };
  if (name.length > NAME_MAX) return { ok: false, msg: `Nama maksimal ${NAME_MAX} karakter` };
  if (!/^[A-Za-z0-9_ -]+$/.test(name)) return { ok: false, msg: 'Hanya huruf, angka, spasi, _ dan -' };
  const key = name.toLowerCase();
  if (key.replace(/[ _-]/g, '').includes(DEV_USERNAME)) return { ok: false, msg: 'Nama itu tidak boleh dipakai' };
  return { ok: true, name, key };
}
let renameBusy = false;
async function changeDisplayName(rawName) {
  if (renameBusy) return { ok: false, msg: 'Sedang memproses…' };
  const v = validateNewName(rawName);
  if (!v.ok) return v;
  const me = accountKey();
  if (!me) return { ok: false, msg: 'Akun tidak valid' };
  if (me === DEV_USERNAME || playerData.isDev) return { ok: false, msg: 'Akun admin tidak bisa mengganti nama' };
  if (v.name === String(playerData.username || '')) return { ok: false, msg: 'Itu sudah jadi namamu sekarang' };
  const cost = nextRenameCost(), coins = Math.floor(Number(playerData.coins) || 0);
  if (coins < cost) return { ok: false, msg: `❌ Koin tidak cukup (butuh 🪙 ${fmtCoins(cost)})` };
  renameBusy = true;
  const enc = encodeURIComponent, oldName = String(playerData.username || ''), oldNameKey = oldName.trim().toLowerCase();
  const json = { 'Content-Type': 'application/json' };
  let claimed = false;
  try {
    if (v.key !== me) { // nama harus belum dipakai akun lain (kunci akun maupun nama hasil ganti nama)
      const [acc, alias] = await Promise.all([socialGet(`players/${enc(v.key)}`), socialGet(`usernames/${enc(v.key)}`)]);
      if (acc || (alias && alias !== me)) return { ok: false, msg: 'Nama itu sudah dipakai pemain lain' };
      const put = await fetch(socialUrl(`usernames/${enc(v.key)}`), { method: 'PUT', headers: json, body: JSON.stringify(me) });
      if (!put.ok) throw new Error('Gagal memesan nama');
      claimed = alias !== me;                                  // jika sebelumnya sudah milik sendiri, jangan dihapus saat batal
      if ((await socialGet(`usernames/${enc(v.key)}`)) !== me) { claimed = false; return { ok: false, msg: 'Nama itu baru saja diambil pemain lain' }; }
    }
    const newCoins = coins - cost, newCount = renameCount() + 1;
    const res = await fetch(socialUrl(`players/${enc(me)}`), { method: 'PATCH', headers: json, body: JSON.stringify({ username: v.name, coins: newCoins, nameChanges: newCount, nameChangedAt: Date.now() }) });
    if (!res.ok) throw new Error('Gagal menyimpan nama baru');
    claimed = false;                                           // berhasil: pemesanan nama dipertahankan
    playerData.username = v.name; playerData.coins = newCoins; playerData.nameChanges = newCount;
    refreshNameUI();
    propagateNewName(me, v.name, oldNameKey, v.key).catch(e => console.warn('Sebar nama baru sebagian gagal:', e));
    return { ok: true, name: v.name, cost };
  } catch (e) {
    if (claimed) fetch(socialUrl(`usernames/${enc(v.key)}`), { method: 'DELETE' }).catch(() => {});
    return { ok: false, msg: e.message || 'Gagal mengganti nama' };
  } finally { renameBusy = false; }
}
function refreshNameUI() { // perbarui semua tampilan nama milik sendiri
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('hud-username', playerData.username);
  set('modal-username', `${playerData.username} · ID ${playerData.playerId || (playerData.isDev ? ADMIN_PLAYER_ID : 'belum tersedia')}`);
  set('coin-amount', playerData.coins || 0);
  try { if (nameSprite) updateCharacterNameSprite(playerData.username, playerData.isDev); } catch (e) {}
  ensureRenameProfileUI();
}
async function propagateNewName(me, name, oldNameKey, newKey) { // nama baru tampil di teman, leaderboard, presence, room
  const enc = encodeURIComponent, json = { 'Content-Type': 'application/json' }, tasks = [];
  if (oldNameKey && oldNameKey !== me && oldNameKey !== newKey) { // lepas nama lama hasil ganti nama sebelumnya
    tasks.push(socialGet(`usernames/${enc(oldNameKey)}`).then(cur => cur === me ? fetch(socialUrl(`usernames/${enc(oldNameKey)}`), { method: 'DELETE' }) : null));
  }
  const friends = await socialGet(`friends/${enc(me)}`).catch(() => null);
  for (const fk of Object.keys(friends || {})) { // catatan "temanku" di sisi teman, hanya jika masih ada (tidak menghidupkan lagi pertemanan yang sudah dihapus)
    tasks.push(socialGet(`friends/${enc(fk)}/${enc(me)}`).then(e => e ? socialPatch(`friends/${enc(fk)}/${enc(me)}`, { username: name }) : null));
  }
  tasks.push(socialGet(`leaderboard/${enc(me)}`).then(e => e ? socialPatch(`leaderboard/${enc(me)}`, { username: name.slice(0, 18) }) : null));
  tasks.push(socialPatch(`presence/${enc(me)}`, { username: name }));
  try { // sedang di room: nama baru langsung terlihat pemain lain
    if (typeof roomCode !== 'undefined' && roomCode && myRef) {
      update(myRef, { username: name.slice(0, 18) }).catch(() => {});
      if (typeof roomMeta !== 'undefined' && roomMeta && roomMeta.host === mpUid) update(ref(multiplayerDb, `rooms/${roomCode}/meta`), { hostName: name.slice(0, 18) }).catch(() => {});
    }
  } catch (e) {}
  await Promise.allSettled(tasks);
  try { refreshSoloLeaderboard(true).catch(() => {}); } catch (e) {}
}
function ensureRenameProfileUI() {
  const anchor = document.getElementById('modal-username');
  if (!anchor) return;
  let row = document.getElementById('rename-row');
  if (!row) {
    row = document.createElement('div'); row.id = 'rename-row';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 10px';
    const btn = document.createElement('button'); btn.id = 'btn-rename'; btn.type = 'button'; btn.textContent = '✏️ Ganti Nama';
    btn.style.cssText = 'padding:7px 12px;border:0;border-radius:10px;background:linear-gradient(135deg,#3aa0ff,#7a5cff);color:#fff;font-weight:700;cursor:pointer';
    btn.onclick = openRenameDialog;
    const hint = document.createElement('small'); hint.id = 'rename-hint'; hint.style.cssText = 'opacity:.85;font-size:12px';
    row.append(btn, hint);
    anchor.insertAdjacentElement('afterend', row);
  }
  const locked = !!(playerData.isDev || accountKey() === DEV_USERNAME);
  document.getElementById('btn-rename').disabled = locked;
  document.getElementById('btn-rename').style.opacity = locked ? '0.5' : '1';
  document.getElementById('rename-hint').textContent = locked ? 'Akun admin tidak bisa ganti nama' : (nextRenameCost() === 0 ? 'Gratis untuk pertama kali' : `Biaya 🪙 ${fmtCoins(RENAME_COST)}`);
}
function openRenameDialog() {
  let ov = document.getElementById('rename-overlay');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'rename-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10040;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72)';
    ov.innerHTML = '<section style="width:min(360px,100%);background:#141a2e;border:2px solid #7fd6ff;border-radius:16px;padding:18px;color:#fff;font-family:sans-serif;box-sizing:border-box">'
      + '<div style="font-size:18px;font-weight:800;margin-bottom:6px">✏️ Ganti Nama</div>'
      + '<div id="rn-cur" style="font-size:13px;opacity:.85;margin-bottom:10px"></div>'
      + '<input id="rn-input" type="text" maxlength="' + NAME_MAX + '" autocomplete="off" placeholder="Nama baru (3-' + NAME_MAX + ' karakter)" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:2px solid #3b4a78;background:#0d1224;color:#fff;font-size:16px;outline:none">'
      + '<div id="rn-cost" style="margin:10px 0 4px;font-weight:700;color:#ffd76a"></div>'
      + '<div id="rn-msg" style="min-height:18px;font-size:13px;color:#ff8a8a;margin-bottom:8px"></div>'
      + '<div style="display:flex;gap:8px"><button id="rn-cancel" type="button" style="flex:1;padding:10px;border:0;border-radius:10px;background:#2a3354;color:#fff;font-weight:700;cursor:pointer">Batal</button>'
      + '<button id="rn-ok" type="button" style="flex:1;padding:10px;border:0;border-radius:10px;background:linear-gradient(135deg,#3aa0ff,#7a5cff);color:#fff;font-weight:700;cursor:pointer">Ganti</button></div>'
      + '<div style="margin-top:10px;font-size:11px;opacity:.7">Teman, koin, kostum, dan rekor tetap aman. Nama lama tetap bisa dipakai untuk login.</div></section>';
    document.body.appendChild(ov);
    const input = ov.querySelector('#rn-input'), msg = ov.querySelector('#rn-msg'), ok = ov.querySelector('#rn-ok');
    ['keydown', 'keyup', 'keypress'].forEach(ev => input.addEventListener(ev, e => e.stopPropagation()));
    ov.querySelector('#rn-cancel').onclick = () => { ov.style.display = 'none'; };
    const submit = async () => {
      if (ok.disabled) return;
      ok.disabled = true; msg.style.color = '#9ad7ff'; msg.textContent = 'Memproses…';
      const r = await changeDisplayName(input.value);
      ok.disabled = false;
      if (!r.ok) { msg.style.color = '#ff8a8a'; msg.textContent = r.msg || 'Gagal'; return; }
      ov.style.display = 'none';
      showToast(`✅ Nama diganti menjadi ${r.name}` + (r.cost ? ` (−${fmtCoins(r.cost)} koin)` : ' (gratis)'));
    };
    ok.onclick = submit;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }
  const cost = nextRenameCost();
  ov.querySelector('#rn-cur').textContent = `Nama sekarang: ${playerData.username}`;
  ov.querySelector('#rn-cost').textContent = cost === 0 ? '🎁 Ganti nama pertama: GRATIS' : `Biaya: 🪙 ${fmtCoins(cost)} (koinmu: ${fmtCoins(playerData.coins)})`;
  ov.querySelector('#rn-msg').textContent = ''; ov.querySelector('#rn-input').value = '';
  ov.style.display = 'flex';
  setTimeout(() => ov.querySelector('#rn-input').focus(), 50);
}
// ===== END GANTI NAMA =====

async function loadMyFriends() {
  const key = myPlayerKey();
  if (!key) return {};
  return await socialGet(`friends/${key}`) || {};
}
async function addFriend(targetKey, targetName) {
  const me = myPlayerKey();
  if (!me || !targetKey || targetKey === me) return;
  const friends = await loadMyFriends();
  if (friends[targetKey]) { showToast('Kalian sudah berteman'); return; }
  const existing = await socialGet(`friendRequests/${targetKey}/${me}`).catch(() => null);
  if (existing?.status === 'pending') { showToast('Permintaan teman sudah dikirim'); return; }
  const stamp = Date.now();
  await socialPatch(`friendRequests/${targetKey}`, { [me]: { from: me, fromName: playerData.username, to: targetKey, toName: targetName, sentAt: stamp, status: 'pending' } });
  showToast(`Permintaan pertemanan dikirim ke ${targetName}`);
  const q = document.getElementById('ps-query'); if (q?.value) searchGlobalPlayers(q.value);
}
async function respondFriendRequest(requestKey, accept) {
  const me = myPlayerKey();
  const req = await socialGet(`friendRequests/${me}/${requestKey}`).catch(() => null);
  if (!req || req.status !== 'pending') return;
  if (accept) {
    const stamp = Date.now();
    await Promise.all([
      socialPatch(`friends/${me}`, { [requestKey]: { username: req.fromName || requestKey, addedAt: stamp } }),
      socialPatch(`friends/${requestKey}`, { [me]: { username: playerData.username, addedAt: stamp } })
    ]);
  }
  await socialPatch(`friendRequests/${me}/${requestKey}`, { status: accept ? 'accepted' : 'declined', respondedAt: Date.now() });
  showToast(accept ? `✓ ${req.fromName || requestKey} sekarang temanmu` : 'Permintaan pertemanan ditolak');
  await renderFriendsList();
  await renderIncomingFriendRequests();
}
async function renderIncomingFriendRequests() {
  const list = document.getElementById('ps-requests');
  if (!list) return;
  const requests = await socialGet(`friendRequests/${myPlayerKey()}`).catch(() => ({}));
  const pending = Object.entries(requests || {}).filter(([, r]) => r?.status === 'pending');
  list.replaceChildren();
  if (!pending.length) { list.textContent = 'Tidak ada permintaan pertemanan.'; return; }
  pending.forEach(([key, req]) => {
    const row = document.createElement('div'); row.className = 'ps-result';
    const info = document.createElement('div'); info.className = 'ps-info';
    const name = document.createElement('b'); name.textContent = req.fromName || key;
    socialGet(`players/${encodeURIComponent(key)}/username`).then(n => { if (n) name.textContent = n; }).catch(() => {}); // nama terbaru pengirim
    const meta = document.createElement('small'); meta.textContent = 'Ingin berteman denganmu'; info.append(name, meta);
    const actions = document.createElement('div'); actions.className = 'ps-friend-actions';
    const yes = document.createElement('button'); yes.className = 'ps-action'; yes.textContent = '✓'; yes.title = 'Terima';
    yes.onclick = () => respondFriendRequest(key, true).catch(e => showToast(e.message));
    const no = document.createElement('button'); no.className = 'ps-remove'; no.textContent = '×'; no.title = 'Tolak';
    no.onclick = () => respondFriendRequest(key, false).catch(e => showToast(e.message));
    actions.append(yes, no); row.append(info, actions); list.append(row);
  });
}
async function removeFriend(targetKey) {
  const me = myPlayerKey();
  await Promise.all([
    fetch(socialUrl(`friends/${me}/${targetKey}`), { method: 'DELETE' }),
    fetch(socialUrl(`friends/${targetKey}/${me}`), { method: 'DELETE' })
  ]);
  showToast('Teman dihapus');
  await renderFriendsList();
}
async function sendGameInvite(targetKey, targetName) {
  if (roomCode && roomMeta && roomMeta.host !== mpUid) {
    showToast('Hanya pembuat room yang bisa mengundang teman.');
    return;
  }
  if (roomCode && (roomStarted || roomRoundBusy())) {
    showToast('Permainan sudah dimulai. Selesaikan dulu sebelum mengundang.');
    return;
  }
  if (!roomCode) {
    showToast('Menyiapkan lobby untuk undangan…');
    await createRoom();
  }
  const invite = { from: myPlayerKey(), fromName: playerData.username, to: targetKey, roomCode, sentAt: Date.now(), status: 'pending' };
  await socialPatch(`gameInvites/${targetKey}`, { [myPlayerKey()]: invite });
  showToast(`Undangan dikirim ke ${targetName}`);
}

// ----- PROFIL PUBLIK PEMAIN (fitur periksa akun / stalking) -----
function ensurePublicProfileModal() {
  if (document.getElementById('public-player-profile')) return;
  const css = document.createElement('style');
  css.id = 'public-player-profile-style';
  css.textContent = `#public-player-profile{position:fixed;inset:0;z-index:10030;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);font-family:sans-serif}#public-player-card{width:min(360px,100%);max-height:82vh;overflow:auto;padding:20px;border:1px solid rgba(66,217,255,.7);border-radius:18px;background:linear-gradient(145deg,#172a49,#080f20);box-shadow:0 12px 40px #0009;color:#fff}#pp-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:15px}#pp-title{font-size:18px;font-weight:900;color:#42d9ff}#pp-close{border:0;border-radius:8px;background:#34435c;color:#fff;width:32px;height:32px;font-size:20px}#pp-avatar{width:64px;height:64px;margin:0 auto 10px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#355b87,#141c30);border:2px solid #ffd76a;font-size:30px}#pp-name{text-align:center;font-size:21px;font-weight:900;overflow-wrap:anywhere}#pp-role{text-align:center;color:#a9c9ff;font-size:12px;margin:5px 0 15px}#pp-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}#pp-stats .pp-stat{padding:11px;border-radius:10px;background:rgba(255,255,255,.07);text-align:center}#pp-stats b{display:block;font-size:19px;color:#ffd76a}#pp-stats small{color:#aab9d0}#pp-outfit{margin-top:12px;padding:11px;border-radius:10px;background:rgba(255,255,255,.06);font-size:13px;line-height:1.7}#pp-status{text-align:center;margin-top:12px;color:#8fffc1;font-size:12px}`;
  css.textContent += '#pp-avatar{width:100%;height:min(230px,38vh);margin:0 0 12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:radial-gradient(circle at 50% 35%,#2b4a75 0%,#0d1526 78%);overflow:hidden}#pp-avatar canvas{display:block;width:100%;height:100%;cursor:grab}';
  document.head.appendChild(css);
  const overlay = document.createElement('div'); overlay.id = 'public-player-profile';
  overlay.innerHTML = `<section id="public-player-card"><div id="pp-head"><span id="pp-title">👤 PROFIL PEMAIN</span><button id="pp-close" type="button">×</button></div><div id="pp-avatar"></div><div id="pp-name">Pemain</div><div id="pp-role">PLAYER</div><div id="pp-stats"><div class="pp-stat"><b id="pp-crowns">👑 0</b><small>Mahkota</small></div><div class="pp-stat"><b id="pp-coins">🪙 0</b><small>Koin</small></div><div class="pp-stat"><b id="pp-items">0</b><small>Item dimiliki</small></div><div class="pp-stat"><b id="pp-id">------</b><small>ID pemain</small></div></div><div id="pp-outfit">Kostum: -</div><div id="pp-status">Data profil publik</div></section>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
  document.getElementById('pp-close').onclick = () => { overlay.style.display = 'none'; };
}
function getEquippedPublicNames(profile) {
  const eq = profile?.equipped || {};
  const categories = [['baju','baju'],['celana','celana'],['sepatu','sepatu'],['aksesoris','aksesoris']];
  return categories.map(([key, cat]) => {
    const id = eq[key];
    const item = (SHOP_ITEMS[cat] || []).find(x => x.id === id);
    return item ? item.name : (id ? String(id).replace(/^(baju|celana|sepatu|aks_)/,'').replaceAll('_',' ') : 'Default');
  }).join(' · ');
}
// ----- PRATINJAU KARAKTER 3D di profil pemain -----
// Memakai model & kostum yang sama dengan avatar leaderboard, dirender di canvas kecil terpisah.
let ppPreview = null;
function stopProfilePreview() {
  if (!ppPreview) return;
  const p = ppPreview; ppPreview = null;
  cancelAnimationFrame(p.raf);
  (p.holder?.userData?.mats || []).forEach(m => m.dispose());
  try { p.env && p.env.dispose(); } catch (e) {}
  try { p.renderer.dispose(); p.renderer.forceContextLoss(); } catch (e) {}
}
function showProfilePreview(equipped) {
  stopProfilePreview();
  const host = document.getElementById('pp-avatar');
  if (!host) return;
  host.textContent = '';
  if (!character) return;
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { host.textContent = ''; return; }
  const W = Math.max(120, host.clientWidth || 300), H = Math.max(120, host.clientHeight || 230);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  const sc = new THREE.Scene();
  let env = null;
  try { const pm = new THREE.PMREMGenerator(renderer); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch (e) {}
  sc.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(3, 6, 5); sc.add(sun);

  const holder = createLeaderboardAvatar({ equipped: equipped || {} });
  holder.scale.setScalar(1);
  // envMap milik renderer utama tidak bisa dipakai di renderer ini -> ganti dengan milik sendiri.
  (holder.userData.mats || []).forEach(m => { if (m.envMap) { m.envMap = env; m.needsUpdate = true; } });
  const pivot = new THREE.Group(); pivot.add(holder); sc.add(pivot);
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const fov = 28, half = THREE.MathUtils.degToRad(fov / 2);
  const cam = new THREE.PerspectiveCamera(fov, W / H, 0.1, 100);
  const dist = Math.max((size.y / 2) / Math.tan(half), (Math.max(size.x, size.z) / 2) / (Math.tan(half) * (W / H))) * 1.2;
  cam.position.set(ctr.x, ctr.y, ctr.z + dist); cam.lookAt(ctr);

  let dragging = false, lastX = 0;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; pivot.rotation.y += (e.clientX - lastX) * 0.012; lastX = e.clientX; });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

  ppPreview = { renderer, holder, env, raf: 0 };
  const clock = new THREE.Clock();
  const loop = () => {
    if (!ppPreview) return;
    const overlay = document.getElementById('public-player-profile');
    if (!overlay || overlay.style.display === 'none') { stopProfilePreview(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!dragging) pivot.rotation.y += dt * 0.6;
    if (holder.userData.fire) animateFireList(holder.userData.fire, performance.now() / 1000);
    renderer.render(sc, cam);
    ppPreview.raf = requestAnimationFrame(loop);
  };
  loop();
}

async function inspectPlayerAccount(playerKey, fallbackName = '') {
  const key = String(playerKey || '').trim().toLowerCase();
  if (!key || key === myPlayerKey()) { showToast('Itu akun kamu sendiri'); return; }
  ensurePublicProfileModal();
  const overlay = document.getElementById('public-player-profile');
  overlay.style.display = 'flex';
  stopProfilePreview();
  { const av = document.getElementById('pp-avatar'); if (av) av.textContent = ''; }
  document.getElementById('pp-name').textContent = fallbackName || key;
  document.getElementById('pp-role').textContent = 'Memuat profil…';
  document.getElementById('pp-status').textContent = 'Mengambil data publik dari Firebase…';
  try {
    const profile = await socialGet(`players/${key}`);
    if (!profile) throw new Error('Akun tidak ditemukan');
    const username = String(profile.username || fallbackName || key).slice(0, 24);
    const crowns = Math.max(0, Math.floor(Number(profile.crowns) || 0));
    const coins = Math.max(0, Math.floor(Number(profile.coins) || 0));
    const inventory = Array.isArray(profile.inventory) ? profile.inventory : [];
    document.getElementById('pp-name').textContent = username;
    document.getElementById('pp-role').textContent = profile.isDev ? 'DEVELOPER ✔' : 'PLAYER';
    document.getElementById('pp-crowns').textContent = `👑 ${crowns}`;
    document.getElementById('pp-coins').textContent = `🪙 ${coins.toLocaleString('id-ID')}`;
    document.getElementById('pp-items').textContent = String(inventory.length);
    document.getElementById('pp-id').textContent = String(profile.playerId || (key === DEV_USERNAME ? ADMIN_PLAYER_ID : '------'));
    document.getElementById('pp-outfit').textContent = `Kostum dipakai: ${getEquippedPublicNames(profile)}`;
    try { showProfilePreview(profile.equipped || {}); } catch (e) { console.warn('Pratinjau karakter gagal:', e); }
    document.getElementById('pp-status').textContent = 'Profil publik · PIN dan data login tidak ditampilkan';
  } catch (e) {
    document.getElementById('pp-role').textContent = 'PROFIL TIDAK TERSEDIA';
    document.getElementById('pp-status').textContent = e.message || 'Gagal memuat profil';
  }
}

async function searchGlobalPlayers(query) {
  const q = String(query || '').trim().toLowerCase();
  const result = document.getElementById('player-search-results');
  if (!result) return;
  if (!q) { result.textContent = 'Masukkan username atau ID pemain.'; return; }
  if (playerSearchBusy) return;
  playerSearchBusy = true;
  result.textContent = 'Mencari pemain…';
  try {
    const [players, friends] = await Promise.all([socialGet('players'), loadMyFriends()]);
    const matches = Object.entries(players || {}).filter(([key, pl]) => {
      const name = String(pl?.username || key).toLowerCase();
      const id = String(pl?.playerId || (key === DEV_USERNAME ? ADMIN_PLAYER_ID : ''));
      return key !== myPlayerKey() && (name.includes(q) || (q.length === 6 && id === q));
    }).slice(0, 8);
    result.replaceChildren();
    if (!matches.length) { result.textContent = 'Pemain tidak ditemukan.'; return; }
    for (const [key, pl] of matches) {
      const outgoing = await socialGet(`friendRequests/${key}/${myPlayerKey()}`).catch(() => null);
      const row = document.createElement('div'); row.className = 'ps-result';
      const info = document.createElement('div'); info.className = 'ps-info';
      const name = document.createElement('b'); name.textContent = String(pl.username || key);
      const meta = document.createElement('small'); meta.textContent = `ID: ${String(pl.playerId || (key === DEV_USERNAME ? ADMIN_PLAYER_ID : '------'))} · ${key === DEV_USERNAME || pl.isDev ? 'ADMIN' : 'PLAYER'}`;
      info.append(name, meta);
      const actions = document.createElement('div'); actions.className = 'ps-friend-actions';
      const inspect = document.createElement('button'); inspect.className = 'ps-action'; inspect.textContent = '👁'; inspect.title = 'Periksa akun';
      inspect.onclick = () => inspectPlayerAccount(key, String(pl.username || key)).catch(e => showToast(e.message));
      actions.appendChild(inspect);
      const action = document.createElement('button'); action.className = 'ps-action ps-add'; action.title = friends[key] ? 'Sudah berteman' : 'Tambah teman';
      if (friends[key]) { action.textContent = '✓'; action.disabled = true; action.title = 'Sudah berteman'; }
      else if (outgoing?.status === 'pending') { action.textContent = '⌛'; action.disabled = true; action.title = 'Menunggu diterima'; }
      else { action.textContent = '+'; action.title = 'Kirim permintaan teman'; action.onclick = () => { action.disabled = true; action.textContent = '…'; addFriend(key, String(pl.username || key)).then(() => { action.textContent = '⌛'; action.title = 'Menunggu diterima'; }).catch(e => { action.disabled = false; action.textContent = '+'; showToast(e.message); }); }; }
      actions.appendChild(action); row.append(info, actions); result.appendChild(row);
    }
  } catch (e) {
    result.textContent = 'Gagal mencari. Periksa koneksi Firebase.';
    console.warn('Pencarian pemain gagal:', e);
  } finally { playerSearchBusy = false; }
}

async function renderFriendsList() {
  const list = document.getElementById('ps-friends');
  if (!list) return;
  try {
    const friends = await loadMyFriends();
    list.replaceChildren();
    const entries = Object.entries(friends);
    if (!entries.length) { list.textContent = 'Belum ada teman. Terima permintaan dari menu cari teman.'; return; }
    for (const [key, saved] of entries) {
      const profile = await socialGet(`players/${key}`).catch(() => null);
      if (!profile) continue;
      const row = document.createElement('div'); row.className = 'ps-result';
      const info = document.createElement('div'); info.className = 'ps-info';
      row.dataset.friendKey = key;
      const name = document.createElement('b'); name.textContent = String(profile.username || saved.username || key);
      const dot = document.createElement('span'); dot.className = 'ps-dot'; dot.dataset.key = key; name.prepend(dot);
      const meta = document.createElement('small'); meta.textContent = `ID: ${String(profile.playerId || '------')}`;
      info.append(name, meta);
      const inspect = document.createElement('button'); inspect.className = 'ps-action'; inspect.textContent = '👁'; inspect.title = 'Periksa akun';
      inspect.onclick = () => inspectPlayerAccount(key, String(profile.username || key)).catch(e => showToast(e.message));
      const invite = document.createElement('button'); invite.className = 'ps-action ps-invite'; invite.textContent = '+'; invite.title = 'Undang ke room';
      invite.onclick = () => sendGameInvite(key, String(profile.username || key)).catch(e => showToast(e.message));
      const removeBtn = document.createElement('button'); removeBtn.className = 'ps-remove'; removeBtn.textContent = '×'; removeBtn.title = 'Hapus teman';
      removeBtn.onclick = () => removeFriend(key).catch(e => showToast(e.message));
      const actions = document.createElement('div'); actions.className = 'ps-friend-actions'; actions.append(inspect, invite, removeBtn);
      row.append(info, actions); list.append(row);
    }
    friendKeysCache = new Set(entries.map(([k]) => k));
    applyFriendPresence();
  } catch (e) { list.textContent = 'Gagal memuat daftar teman.'; }
}

function showGameInvite(inviteKey, invite) {
  const overlay = document.getElementById('social-invite-overlay');
  if (!overlay || !invite || invite.status !== 'pending') return;
  activeInviteKey = inviteKey;
  document.getElementById('social-invite-name').textContent = `${invite.fromName || inviteKey} mengundangmu bermain!`;
  { const rEl = document.getElementById('social-invite-room'); if (rEl) { rEl.textContent = ''; rEl.style.display = 'none'; } } // kode room disembunyikan (tetap tersimpan di dataset untuk gabung)
  overlay.style.display = 'flex';
  overlay.dataset.inviter = inviteKey;
  overlay.dataset.room = String(invite.roomCode || '');
}
async function pollSocialNotifications() {
  if (socialPollBusy || !myPlayerKey() || gameState === 'LOGIN') return;
  socialPollBusy = true;
  try {
    const [invites, requests] = await Promise.all([
      socialGet(`gameInvites/${myPlayerKey()}`).catch(() => ({})),
      socialGet(`friendRequests/${myPlayerKey()}`).catch(() => ({}))
    ]);
    const pendingInvite = Object.entries(invites || {}).find(([, v]) => v?.status === 'pending');
    if (pendingInvite) {
      const stamp = pendingInvite[0] + ':' + (pendingInvite[1].sentAt || '');
      if (stamp !== lastInviteToastStamp) { lastInviteToastStamp = stamp; showToast(`📨 ${pendingInvite[1].fromName || pendingInvite[0]} mengundangmu main!`, 1000); }
      showGameInvite(pendingInvite[0], pendingInvite[1]);
    }
    const pendingRequests = Object.entries(requests || {}).filter(([, v]) => v?.status === 'pending');
    const reqSig = pendingRequests.map(([k]) => k).sort().join(',');
    if (reqSig !== lastRequestSig) { lastRequestSig = reqSig; await renderIncomingFriendRequests(); }
    const badge = document.getElementById('ps-notif-count');
    if (badge) { badge.textContent = String(pendingRequests.length); badge.style.display = pendingRequests.length ? 'inline-flex' : 'none'; }
  } catch (e) { console.warn('Polling notifikasi:', e); }
  finally { socialPollBusy = false; }
}
async function respondGameInvite(accept) {
  const overlay = document.getElementById('social-invite-overlay');
  if (!overlay) return;
  const from = overlay.dataset.inviter, code = overlay.dataset.room;
  overlay.style.display = 'none';
  await socialPatch(`gameInvites/${myPlayerKey()}/${from}`, { status: accept ? 'accepted' : 'declined', respondedAt: Date.now() });
  if (accept) {
    if (!code) { showToast('Kode room tidak valid'); return; }
    try {
      if (roomCode) await leaveRoom(true);
      await joinRoom(code);
      showToast('Berhasil masuk lobby! Tunggu host memulai permainan.');
    }
    catch (e) { showToast('Tidak bisa bergabung: ' + e.message); }
  }
}

function buildPlayerSearchUI() {
  if (document.getElementById('player-search')) { renderFriendsList(); return; }
  const css = document.createElement('style');
  css.textContent = `#player-search{position:fixed;top:58px;right:58px;left:auto;z-index:58;width:min(310px,calc(100vw - 24px));max-height:75vh;overflow:auto;padding:10px;background:rgba(9,16,31,.95);border:1px solid rgba(66,217,255,.55);border-radius:13px;color:#fff;font:13px sans-serif;box-shadow:0 8px 28px #0006;backdrop-filter:blur(8px);display:none}#ps-head{display:flex;align-items:center;justify-content:space-between;font-weight:900;color:#42d9ff;margin-bottom:7px}#ps-close{border:0;background:#263a59;color:#fff;border-radius:7px;width:27px;height:27px;font-size:17px}#ps-launcher{position:fixed;top:16px;right:16px;left:auto;z-index:59;width:34px;height:34px;border:1px solid rgba(66,217,255,.75);border-radius:50%;background:rgba(9,16,31,.92);color:#42d9ff;font-size:18px;font-weight:900;box-shadow:0 3px 12px #0008;display:flex;align-items:center;justify-content:center}#ps-launcher:active{transform:scale(.94)}#ps-invite-launcher{position:fixed;top:58px;right:16px;z-index:59;width:34px;height:34px;border:1px solid rgba(255,190,80,.8);border-radius:50%;background:rgba(28,20,10,.92);color:#ffd166;font-size:16px;box-shadow:0 3px 12px #0008;display:flex;align-items:center;justify-content:center}#player-friends{position:fixed;top:58px;right:58px;left:auto;z-index:58;width:min(310px,calc(100vw - 24px));max-height:75vh;overflow:auto;padding:10px;background:rgba(9,16,31,.96);border:1px solid rgba(255,190,80,.55);border-radius:13px;color:#fff;font:13px sans-serif;box-shadow:0 8px 28px #0006;display:none}#pf-head{display:flex;justify-content:space-between;align-items:center;color:#ffd166;font-weight:900;margin-bottom:8px}#pf-close{border:0;background:#263a59;color:#fff;border-radius:7px;width:27px;height:27px;font-size:17px}#ps-controls{display:flex;gap:6px}#ps-query{min-width:0;flex:1;padding:9px;border-radius:8px;border:1px solid #52627d;background:#101b30;color:#fff;outline:none}#ps-submit,.ps-action{border:0;border-radius:8px;padding:7px 10px;background:#167bd4;color:#fff;font-weight:800;font-size:11px}.ps-action:disabled{background:#176b51;color:#b8ffe3}.ps-add{width:27px;height:27px;min-width:27px!important;padding:0!important;border-radius:50%!important;font-size:17px!important;line-height:27px}.ps-result{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:8px;background:rgba(255,255,255,.07)}.ps-info{display:flex;flex-direction:column;gap:3px;min-width:0}.ps-info b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ps-info small{color:#9fb4d5}#player-search-results,#ps-friends{display:flex;flex-direction:column;gap:5px;margin-top:7px;max-height:170px;overflow:auto}.ps-empty{padding:9px;color:#aab9d0;text-align:center}.ps-section{display:flex;align-items:center;justify-content:space-between;color:#42d9ff;font-weight:900;margin-top:12px;margin-bottom:5px}.ps-friend-actions{display:flex;gap:4px}.ps-invite{font-size:18px;min-width:32px;padding:3px}.ps-remove{border:0;border-radius:7px;background:#632d3c;color:#fff;font-size:18px;min-width:28px}.ps-notif{background:#e23c55;color:#fff;border-radius:50%;padding:2px 6px;font-size:10px}#social-invite-overlay{position:fixed;inset:0;z-index:10020;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.68);backdrop-filter:blur(5px);padding:18px}#social-invite-card{width:min(360px,100%);padding:24px;border:1px solid #42d9ff;border-radius:20px;background:linear-gradient(145deg,#142747,#080f20);box-shadow:0 0 35px #168bd766;color:#fff;text-align:center;font-family:sans-serif}#social-invite-card h2{margin:0 0 12px;color:#42d9ff}#social-invite-name{font-size:16px;font-weight:800}#social-invite-room{margin:15px 0;color:#a9c9ff;font-weight:900;letter-spacing:3px}.social-invite-actions{display:flex;gap:9px}.social-invite-actions button{flex:1;border:0;border-radius:10px;padding:12px;color:white;font-weight:900}.si-accept{background:#078b61}.si-decline{background:#713447}`;
  document.head.appendChild(css);
  const launcher = document.createElement('button'); launcher.id = 'ps-launcher'; launcher.type = 'button'; launcher.title = 'Cari teman'; launcher.textContent = '👤';
  const box = document.createElement('section'); box.id = 'player-search';
  box.innerHTML = `<div id="ps-head"><span>🔎 CARI TEMAN <span id="ps-notif-count" class="ps-notif" style="display:none">0</span></span><button id="ps-close" title="Tutup">×</button></div><div id="ps-controls"><input id="ps-query" maxlength="30" placeholder="Username / ID 6 digit" autocomplete="off"><button id="ps-submit">CARI</button></div><div id="player-search-results"><div class="ps-empty">Cari pemain lalu kirim permintaan teman.</div></div><div class="ps-section">PERMINTAAN MASUK</div><div id="ps-requests">Memuat permintaan…</div>`;
  const inviteLauncher = document.createElement('button'); inviteLauncher.id = 'ps-invite-launcher'; inviteLauncher.type = 'button'; inviteLauncher.title = 'Teman saya & undang bermain'; inviteLauncher.textContent = '👥';
  const friendsBox = document.createElement('section'); friendsBox.id = 'player-friends';
  friendsBox.innerHTML = `<div id="pf-head"><span>✉ TEMAN SAYA · UNDANG MAIN</span><button id="pf-close" title="Tutup">×</button></div><div id="ps-friends">Memuat teman…</div>`;
  document.body.append(launcher, inviteLauncher, box, friendsBox);
  inviteLauncher.onclick = () => { const open = friendsBox.style.display !== 'block'; friendsBox.style.display = open ? 'block' : 'none'; if (open) renderFriendsList(); };
  launcher.onclick = () => { const open = box.style.display !== 'block'; box.style.display = open ? 'block' : 'none'; if (open) renderIncomingFriendRequests(); };
  document.getElementById('ps-close').onclick = () => { box.style.display = 'none'; };
  document.getElementById('pf-close').onclick = () => { friendsBox.style.display = 'none'; };
  const overlay = document.createElement('div'); overlay.id = 'social-invite-overlay';
  overlay.innerHTML = `<div id="social-invite-card"><h2>🎮 UNDANGAN MAIN</h2><div id="social-invite-name">Pemain mengundangmu</div><div id="social-invite-room">ROOM -----</div><div class="social-invite-actions"><button class="si-decline" id="social-invite-no">TOLAK</button><button class="si-accept" id="social-invite-yes">GABUNG</button></div></div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById('ps-query');
  document.getElementById('ps-submit').onclick = () => searchGlobalPlayers(input.value);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') searchGlobalPlayers(input.value); });
  document.getElementById('social-invite-no').onclick = () => respondGameInvite(false).catch(e => showToast(e.message));
  document.getElementById('social-invite-yes').onclick = () => respondGameInvite(true).catch(e => showToast(e.message));
  renderFriendsList();
  pollSocialNotifications();
  if (socialPollTimer) clearInterval(socialPollTimer);
  socialPollTimer = setInterval(pollSocialNotifications, 1000); // cek server tiap 1 detik
  startPresenceSystem();
}

// ----- STATUS ONLINE TEMAN (dicek ke server tiap 1 detik) -----
let friendKeysCache = new Set(), presenceTimer = null, presenceBeat = 0, presenceBusy = false;
const presenceSeen = new Map(); // key -> { v: nilai lastSeen terakhir, at: waktu lokal saat berubah }
const PRESENCE_TIMEOUT = 7000;
function isFriendOnline(key) { const p = presenceSeen.get(key); return !!p && p.v > 0 && (performance.now() - p.at) < PRESENCE_TIMEOUT; }
function applyFriendPresence() {
  document.querySelectorAll('.ps-dot').forEach(dot => {
    const on = isFriendOnline(dot.dataset.key);
    dot.classList.toggle('on', on); dot.title = on ? 'Online' : 'Offline';
    const small = dot.closest('.ps-info')?.querySelector('small');
    if (small) small.dataset.online = on ? '1' : '0';
  });
}
async function presenceTick() {
  if (presenceBusy || !myPlayerKey() || gameState === 'LOGIN') return;
  presenceBusy = true;
  try {
    presenceBeat++;
    if (presenceBeat % 2 === 0) socialPatch(`presence/${myPlayerKey()}`, { lastSeen: Date.now(), username: playerData.username }).catch(() => {});
    const box = document.getElementById('player-friends');
    if (box && box.style.display === 'block') {
      const all = await socialGet('presence').catch(() => null);
      if (all) for (const key of friendKeysCache) {
        const v = Number(all[key]?.lastSeen) || 0, prev = presenceSeen.get(key);
        if (!prev || prev.v !== v) presenceSeen.set(key, { v, at: performance.now() });
      }
      applyFriendPresence();
    }
  } finally { presenceBusy = false; }
}
function startPresenceSystem() {
  if (!document.getElementById('presence-css')) {
    const st = document.createElement('style'); st.id = 'presence-css';
    st.textContent = `.ps-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#6b7280;margin-right:6px;box-shadow:0 0 0 1px #0006}.ps-dot.on{background:#22e27a;box-shadow:0 0 7px #22e27a}#btn-push{position:fixed;right:22px;bottom:150px;z-index:60;width:62px;height:62px;border-radius:50%;border:2px solid #ffd166;background:rgba(28,20,10,.85);color:#ffd166;font-size:28px;display:none;align-items:center;justify-content:center;touch-action:manipulation;-webkit-tap-highlight-color:transparent}#btn-push:active{transform:scale(.92)}#btn-push.cd{opacity:.4}`;
    document.head.appendChild(st);
  }
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(presenceTick, 1000);
  presenceTick();
  window.addEventListener('pagehide', () => { try { fetch(socialUrl(`presence/${myPlayerKey()}`), { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastSeen: 0 }) }); } catch (e) {} });
  buildPushButton();
  buildFreezeButton();
}

// ----- GAMEPASS DORONG TEMAN -----
// Dorongan dikirim lewat node pemain sendiri (rooms/<kode>/players/<uid>/push), lalu korban
// yang membaca dan menerapkan hentakan di sisinya (memakai vektor 'knock' yang sudah ada).
const PUSH_RANGE = 3.2, PUSH_COOLDOWN = 1500, PUSH_FORCE = 30;
// Animasi dorong: tangan ditarik ke belakang (ancang-ancang), lalu dihentakkan lurus ke depan.
const PUSH_ANIM_MS = 520;
let pushAnimStart = -1e9;
function pushPose(p) { // p = 0..1 progres animasi
  const ease = (x) => x * x * (3 - 2 * x);
  if (p < 0.25) { const w = ease(p / 0.25); return { arm: 0.7 * w, el: -1.3 * w, armZ: 0.12, lean: -0.1 * w, bob: -0.02 * w }; }
  const w = ease(Math.min(1, (p - 0.25) / 0.3));
  return { arm: 0.7 - 2.3 * w, el: -1.3 + 1.25 * w, armZ: 0.12, lean: -0.1 + 0.52 * w, bob: 0.03 * w };
}
let pushSeq = 0, lastPushAt = 0;
const handledPush = new Map(); // uid pendorong -> seq terakhir
const hasPushPass = () => playerData.inventory.includes('gp_dorong');
function tryPushNearestFriend() {
  if (!hasPushPass()) return;
  if (!roomCode || !myRef || gameState !== 'PLAYING') return;
  const now = performance.now();
  if (now - lastPushAt < PUSH_COOLDOWN) return;
  let best = null, bestD = PUSH_RANGE;
  for (const [id, av] of remotePlayers) {
    const d = roomPlayers[id]; if (!d || d.deadAt || !av.visible) continue;
    if (!friendKeysCache.has(String(d.userKey || d.username || '').trim().toLowerCase())) continue;
    const dist = Math.hypot(av.position.x - character.position.x, av.position.z - character.position.z);
    if (dist < bestD && Math.abs(av.position.y - character.position.y) < 2.5) { best = id; bestD = dist; }
  }
  if (!best) return;
  lastPushAt = now; pushSeq++;
  { const tav = remotePlayers.get(best); // hadap ke teman lalu mainkan animasi dorong
    if (tav) character.rotation.y = Math.atan2(tav.position.x - character.position.x, tav.position.z - character.position.z);
    pushAnimStart = performance.now(); }
  const btn = document.getElementById('btn-push'); if (btn) { btn.classList.add('cd'); setTimeout(() => btn.classList.remove('cd'), PUSH_COOLDOWN); }
  update(myRef, { push: { target: best, seq: pushSeq, t: Date.now() } }).catch(() => {});
}
function applyIncomingPushes() {
  if (!roomCode || !character || gameState !== 'PLAYING' || godMode || flyMode) return;
  for (const [id, d] of Object.entries(roomPlayers)) {
    if (id === mpUid || !d || !d.push || d.push.target !== mpUid) continue;
    if (handledPush.get(id) === d.push.seq) continue;
    handledPush.set(id, d.push.seq);
    if (Math.abs(Date.now() - (d.push.t || 0)) > 5000) continue; // dorongan basi diabaikan
    if (d.x == null) continue;
    let dx = character.position.x - Number(d.x), dz = character.position.z - Number(d.z);
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    knock.set(dx * PUSH_FORCE, dz * PUSH_FORCE); physics.velocityY = 7; physics.isGrounded = false; sq.v = -4;
  }
}
function buildPushButton() {
  if (document.getElementById('btn-push')) return;
  const b = document.createElement('button'); b.id = 'btn-push'; b.type = 'button'; b.textContent = '🫸'; b.title = 'Dorong teman';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); tryPushNearestFriend(); });
  document.body.appendChild(b);
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) tryPushNearestFriend(); });
  setInterval(() => { b.style.display = (hasPushPass() && roomCode && gameState === 'PLAYING') ? 'flex' : 'none'; applyIncomingPushes(); }, 120);
}

// ----- GAMEPASS VIP / 2X KOIN / ANIMASI MENANG -----
const hasGp = (id) => !!(playerData && playerData.inventory && playerData.inventory.includes(id));
const hasVip = () => hasGp('gp_vip');
const hasCoin2x = () => hasGp('gp_2xcoin');
const hasWinFx = () => hasGp('gp_winfx');
const coinX = (n) => hasCoin2x() ? n * 2 : n; // semua koin yang didapat dikali 2 kalau punya gamepass 2x

// Nama VIP di label 3D: lencana "VIP" emas + nama bergradasi emas + bingkai emas.
function paintVipName(x, text, size, isDev) {
  const maxW = isDev ? 280 : 380, cx = isDev ? 255 : 304;
  x.save();
  x.strokeStyle = '#ffd166'; x.lineWidth = 4; x.beginPath(); x.roundRect(12, 12, 488, 84, 20); x.stroke();
  const pg = x.createLinearGradient(0, 32, 0, 76); pg.addColorStop(0, '#ffe27a'); pg.addColorStop(1, '#ff9f1c');
  x.fillStyle = pg; x.beginPath(); x.roundRect(24, 32, 76, 44, 12); x.fill();
  x.font = 'bold 30px sans-serif'; x.fillStyle = '#3a2300'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('VIP', 62, 56);
  let fs = size; x.font = 'bold ' + fs + 'px sans-serif';
  while (fs > 24 && x.measureText(text).width > maxW) { fs -= 2; x.font = 'bold ' + fs + 'px sans-serif'; }
  const ng = x.createLinearGradient(0, 28, 0, 82); ng.addColorStop(0, '#fff6c2'); ng.addColorStop(1, '#ffc93c');
  x.fillStyle = ng; x.shadowColor = '#ff9f1c'; x.shadowBlur = 8; x.fillText(text, cx, 56);
  x.restore();
}

// Aura emas eksklusif VIP (cincin berputar, selubung bercahaya, percikan naik). Hidup di scene agar tidak ikut ter-clone ke avatar lain.
const vipAuras = new Map();
let vipAuraAssets = null;
function makeVipAura() {
  const A = vipAuraAssets || (vipAuraAssets = {
    ring1: new THREE.TorusGeometry(0.8, 0.035, 8, 48), ring2: new THREE.TorusGeometry(1.0, 0.02, 8, 48),
    shell: new THREE.CylinderGeometry(0.62, 0.78, 2.7, 28, 1, true), spark: new THREE.OctahedronGeometry(0.06),
    gold: new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffb62e, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  });
  const g = new THREE.Group();
  const r1 = new THREE.Mesh(A.ring1, A.gold), r2 = new THREE.Mesh(A.ring2, A.gold), shell = new THREE.Mesh(A.shell, A.glow);
  r1.rotation.x = r2.rotation.x = Math.PI / 2; r1.position.y = r2.position.y = 0.08; shell.position.y = 1.35;
  g.add(r1, r2, shell);
  const sparks = [];
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(A.spark, A.gold); g.add(s); sparks.push(s); }
  g.userData = { r1, r2, shell, sparks, t: Math.random() * 10 };
  return g;
}
function updateVipAuras(delta) {
  if (!scene) return;
  const want = new Map();
  if (character && character.visible && hasVip()) want.set('me', character);
  for (const [id, av] of remotePlayers) { const d = roomPlayers[id]; if (d && d.vip && av.visible) want.set(id, av); }
  for (const [k, g] of vipAuras) if (!want.has(k)) { scene.remove(g); vipAuras.delete(k); }
  for (const [k, obj] of want) {
    let g = vipAuras.get(k); if (!g) { g = makeVipAura(); scene.add(g); vipAuras.set(k, g); }
    g.position.set(obj.position.x, obj.position.y, obj.position.z);
    const u = g.userData; u.t += delta;
    u.r1.rotation.z += delta * 1.8; u.r2.rotation.z -= delta * 1.2;
    const pulse = 1 + Math.sin(u.t * 3) * 0.06; u.shell.scale.set(pulse, 1, pulse);
    u.sparks.forEach((s, i) => {
      const a = u.t * 1.6 + i * Math.PI / 4, h = (u.t * 0.5 + i / 8) % 1;
      s.position.set(Math.cos(a) * 0.75, h * 2.6, Math.sin(a) * 0.75); s.rotation.y += delta * 4; s.scale.setScalar(Math.max(0.05, 1 - Math.abs(h - 0.5) * 1.6));
    });
  }
}

// Animasi menang khusus: mahkota emas melayang, pilar cahaya, gelombang cincin, kembang api & confetti.
// Pemenang menulis winFx ke node-nya; semua pemain di room ikut melihat efeknya di atas avatar pemenang.
const winFxList = [], handledWinFx = new Map();
function makeCrown() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.9, roughness: 0.25, emissive: 0xffa800, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const gem = new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff1f4a, emissiveIntensity: 0.8 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.16, 20, 1, true), gold));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 8), gold);
    c.position.set(Math.cos(a) * 0.28, 0.2, Math.sin(a) * 0.28); g.add(c);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), gem); s.position.set(Math.cos(a) * 0.28, 0.36, Math.sin(a) * 0.28); g.add(s);
  }
  return g;
}
function winBurst(pos, n, colors, speed, life, size) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size * 0.4), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 1 }));
    m.position.copy(pos);
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = speed * (0.5 + Math.random() * 0.6);
    m.userData = { vx: Math.sin(ph) * Math.cos(th) * sp, vy: Math.cos(ph) * sp + 2, vz: Math.sin(ph) * Math.sin(th) * sp };
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0); scene.add(m); jumpParticles.push({ mesh: m, life });
  }
}
function playWinFx(obj) {
  if (!scene || !obj) return;
  const g = new THREE.Group(); scene.add(g);
  const crown = makeCrown(); g.add(crown);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 40, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  pillar.position.y = 20; g.add(pillar);
  const rings = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    r.rotation.x = Math.PI / 2; g.add(r); return r;
  });
  winFxList.push({ g, obj, crown, pillar, rings, t: 0, life: 4.5, nextBurst: 0.3 });
  const base = new THREE.Vector3(obj.position.x, obj.position.y + 1.5, obj.position.z);
  winBurst(base, 70, [0xff4d6d, 0xffd166, 0x4cc9f0, 0x80ed99, 0xf72585], 7, 2.4, 0.13); // confetti
}
function triggerWinFx() {
  if (!hasWinFx() || !character) return;
  playWinFx(character);
  if (myRef) update(myRef, { winFx: serverNow() }).catch(() => {});
}
function updateWinFx(delta) {
  if (!scene) return;
  for (const [id, d] of Object.entries(roomPlayers)) {
    if (id === mpUid || !d || !d.winFx || handledWinFx.get(id) === d.winFx) continue;
    handledWinFx.set(id, d.winFx);
    if (Math.abs(serverNow() - d.winFx) < 6000) playWinFx(remotePlayers.get(id));
  }
  for (let i = winFxList.length - 1; i >= 0; i--) {
    const f = winFxList[i]; f.t += delta;
    const p = f.obj.position, k = Math.min(1, f.t / f.life);
    f.g.position.set(p.x, p.y, p.z);
    f.crown.position.y = 3.2 + Math.sin(f.t * 4) * 0.1; f.crown.rotation.y += delta * 3; f.crown.scale.setScalar(Math.min(1, f.t * 4));
    f.pillar.material.opacity = 0.35 * (1 - k);
    f.rings.forEach((r, j) => { const q = (f.t * 0.7 + j / 3) % 1; r.scale.setScalar(0.6 + q * 4.5); r.position.y = 0.1 + q * 0.3; r.material.opacity = 0.9 * (1 - q) * (1 - k); });
    if (f.t >= f.nextBurst && f.t < f.life - 1.2) { // kembang api di atas pemenang
      f.nextBurst += 0.45;
      const c = [[0xffd166, 0xfff1a8], [0xff4d6d, 0xffb3c1], [0x4cc9f0, 0xcaf0f8], [0x80ed99, 0xd8f3dc]][Math.floor(Math.random() * 4)];
      winBurst(new THREE.Vector3(p.x + (Math.random() - 0.5) * 5, p.y + 5 + Math.random() * 3, p.z + (Math.random() - 0.5) * 5), 36, c, 5.5, 1.3, 0.1);
    }
    if (f.t >= f.life) {
      f.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      scene.remove(f.g); winFxList.splice(i, 1);
    }
  }
}

// ----- GAMEPASS FREEZE PLAYER -----
// Pelempar menulis event ke node pemain sendiri (rooms/<kode>/players/<uid>/ice). Semua klien melihat
// kubus es terbang dari pelempar ke target; hanya korban yang benar-benar membeku di sisinya, lalu
// menulis frozenUntil agar semua orang melihat balok es di sekeliling korban.
const FREEZE_DURATION = 7000, FREEZE_COOLDOWN = 5000, FREEZE_RANGE = 30, FREEZE_IMMUNE = 1000, ICE_FLIGHT_MS = 380;
let lastIceAt = -1e9, localFreezeUntil = 0, freezeImmuneUntil = 0;
const handledIce = new Map();   // uid pelempar -> seq terakhir yang sudah diproses
const iceProjectiles = [];      // kubus es yang sedang terbang
const iceBlocks = new Map();    // 'me' / uid -> balok es pembeku
let iceAssets = null;
const hasFreezePass = () => playerData.inventory.includes('gp_freeze');
function isFrozenLocal() { return performance.now() < localFreezeUntil; }
function getIceAssets() {
  if (iceAssets) return iceAssets;
  const blockGeo = new THREE.BoxGeometry(1.25, 2.8, 1.25);
  iceAssets = {
    blockGeo,
    edgeGeo: new THREE.EdgesGeometry(blockGeo),
    blockMat: new THREE.MeshStandardMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.5, roughness: 0.08, metalness: 0.1, emissive: 0x2a8fd0, emissiveIntensity: 0.35, depthWrite: false }),
    edgeMat: new THREE.LineBasicMaterial({ color: 0xeafaff }),
    cubeGeo: new THREE.BoxGeometry(0.46, 0.46, 0.46),
    cubeMat: new THREE.MeshStandardMaterial({ color: 0xa9e8ff, transparent: true, opacity: 0.85, roughness: 0.1, emissive: 0x3aa8e8, emissiveIntensity: 0.6 })
  };
  return iceAssets;
}
function makeIceBlock() {
  const A = getIceAssets(), g = new THREE.Group();
  const body = new THREE.Mesh(A.blockGeo, A.blockMat); body.position.y = 1.3; g.add(body);
  const edges = new THREE.LineSegments(A.edgeGeo, A.edgeMat); edges.position.y = 1.3; g.add(edges);
  return g;
}
function iceShards(pos, n, size) { // pecahan es: memakai loop jumpParticles yang sudah ada
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial({ color: 0xbdeeff, emissive: 0x3aa8e8, emissiveIntensity: 0.5, transparent: true, opacity: 1 }));
    m.position.copy(pos); m.position.y += Math.random() * 1.6;
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3;
    m.userData = { vx: Math.cos(a) * sp, vy: 1 + Math.random() * 3, vz: Math.sin(a) * sp };
    scene.add(m); jumpParticles.push({ mesh: m, life: 0.9 });
  }
}
function spawnIceProjectile(fromObj, toObj, onHit) {
  if (!scene || !fromObj || !toObj) return;
  const A = getIceAssets(), mesh = new THREE.Mesh(A.cubeGeo, A.cubeMat);
  mesh.position.copy(fromObj.position); mesh.position.y += 1.6; scene.add(mesh);
  iceProjectiles.push({ mesh, from: new THREE.Vector3(fromObj.position.x, fromObj.position.y + 1.6, fromObj.position.z), toObj, t0: performance.now(), onHit });
}
function applyLocalFreeze() {
  if (!character || godMode || flyMode || gameState !== 'PLAYING') return;
  const now = performance.now();
  if (isFrozenLocal() || now < freezeImmuneUntil) return;
  localFreezeUntil = now + FREEZE_DURATION; freezeImmuneUntil = localFreezeUntil + FREEZE_IMMUNE;
  moveVel.set(0, 0); knock.set(0, 0); isRunning = false;
  if (myRef) update(myRef, { frozenUntil: serverNow() + FREEZE_DURATION }).catch(() => {});
}
function clearLocalFreeze() { localFreezeUntil = 0; if (myRef) update(myRef, { frozenUntil: null }).catch(() => {}); }
function tryFreezeNearest() {
  if (!hasFreezePass()) return;
  if (!roomCode || !myRef || gameState !== 'PLAYING' || isFrozenLocal()) return;
  const now = performance.now(), left = FREEZE_COOLDOWN - (now - lastIceAt);
  if (left > 0) return;
  let best = null, bestD = FREEZE_RANGE;
  for (const [id, av] of remotePlayers) {
    const d = roomPlayers[id]; if (!d || d.deadAt || !av.visible) continue;
    if (Number(d.frozenUntil) > serverNow()) continue; // sudah beku
    const dist = Math.hypot(av.position.x - character.position.x, av.position.z - character.position.z);
    if (dist < bestD && Math.abs(av.position.y - character.position.y) < 12) { best = id; bestD = dist; }
  }
  if (!best) return;
  lastIceAt = now;
  const tav = remotePlayers.get(best);
  if (tav) { character.rotation.y = Math.atan2(tav.position.x - character.position.x, tav.position.z - character.position.z); pushAnimStart = performance.now(); } // animasi melempar
  spawnIceProjectile(character, tav, null);
  update(myRef, { ice: { target: best, seq: Date.now(), t: serverNow() } }).catch(() => {});
}
function applyIncomingIce() {
  if (!roomCode || !character) return;
  for (const [id, d] of Object.entries(roomPlayers)) {
    if (id === mpUid || !d || !d.ice) continue;
    if (handledIce.get(id) === d.ice.seq) continue;
    handledIce.set(id, d.ice.seq);
    if (Math.abs(serverNow() - (d.ice.t || 0)) > 4000) continue; // event basi diabaikan
    const from = remotePlayers.get(id), toMe = d.ice.target === mpUid, to = toMe ? character : remotePlayers.get(d.ice.target);
    if (!from || !to) continue;
    spawnIceProjectile(from, to, toMe ? () => applyLocalFreeze() : null);
  }
}
function updateFreezeVisuals(delta) {
  if (!scene) return;
  const now = performance.now();
  // Kubus es terbang (melengkung) menuju target, lalu pecah saat tiba.
  for (let i = iceProjectiles.length - 1; i >= 0; i--) {
    const p = iceProjectiles[i], k = Math.min(1, (now - p.t0) / ICE_FLIGHT_MS), tp = p.toObj.position;
    p.mesh.position.set(p.from.x + (tp.x - p.from.x) * k, p.from.y + (tp.y + 1.3 - p.from.y) * k + Math.sin(Math.PI * k) * 1.2, p.from.z + (tp.z - p.from.z) * k);
    p.mesh.rotation.x += delta * 14; p.mesh.rotation.y += delta * 11;
    if (Math.random() < 0.7) { // jejak serpihan es
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xcdf3ff, transparent: true, opacity: 1 }));
      s.position.copy(p.mesh.position); scene.add(s); trailParticles.push({ mesh: s, life: 0.4 });
    }
    if (k >= 1) { scene.remove(p.mesh); iceShards(p.mesh.position, 10, 0.14); iceProjectiles.splice(i, 1); if (p.onHit) p.onHit(); }
  }
  // Pembekuan: pulihkan otomatis, dan lepas jika permainan tidak berjalan.
  if (localFreezeUntil && (now >= localFreezeUntil || gameState !== 'PLAYING')) clearLocalFreeze();
  // Balok es di sekeliling pemain yang sedang beku (lokal & pemain lain).
  const want = new Map();
  if (character && isFrozenLocal() && gameState === 'PLAYING') want.set('me', character);
  for (const [id, av] of remotePlayers) { const d = roomPlayers[id]; if (d && av.visible && Number(d.frozenUntil) > serverNow()) want.set(id, av); }
  for (const [key, blk] of iceBlocks) {
    if (!want.has(key)) { iceShards(blk.position, 14, 0.18); scene.remove(blk); iceBlocks.delete(key); }
  }
  for (const [key, obj] of want) {
    let blk = iceBlocks.get(key);
    if (!blk) { blk = makeIceBlock(); scene.add(blk); iceBlocks.set(key, blk); iceShards(obj.position, 8, 0.12); }
    blk.position.set(obj.position.x, obj.position.y, obj.position.z);
  }
}
function buildFreezeButton() {
  if (document.getElementById('btn-freeze')) return;
  const st = document.createElement('style');
  st.textContent = '#btn-freeze{position:fixed;right:22px;bottom:222px;z-index:60;width:62px;height:62px;border-radius:50%;border:2px solid #7fd6ff;background:#0b1a2b center/cover no-repeat;color:#fff;font:700 11px sans-serif;text-shadow:0 0 4px #000,0 0 2px #000;display:none;align-items:flex-start;justify-content:center;touch-action:manipulation;-webkit-tap-highlight-color:transparent;padding:3px 0 0;box-shadow:0 0 14px #3aa8e8aa}#btn-freeze:active{transform:scale(.92)}#btn-freeze.cd{filter:brightness(.45) saturate(.6)}';
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'btn-freeze'; b.type = 'button'; b.title = 'Freeze Player (Q)';
  const probe = new Image(); probe.onload = () => { b.style.backgroundImage = 'url(./ice_cube.jpg)'; }; probe.onerror = () => { b.textContent = '🧊'; }; probe.src = './ice_cube.jpg';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); tryFreezeNearest(); });
  document.body.appendChild(b);
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && !e.repeat && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) tryFreezeNearest(); });
  setInterval(() => {
    b.style.display = (hasFreezePass() && roomCode && gameState === 'PLAYING') ? 'flex' : 'none';
    const rem = Math.max(0, FREEZE_COOLDOWN - (performance.now() - lastIceAt));
    b.classList.toggle('cd', rem > 0);
    const txt = rem > 0 ? String(Math.ceil(rem / 1000)) : '';
    if (b.dataset.cdtxt !== txt) { b.dataset.cdtxt = txt; if (b.style.backgroundImage || txt) b.textContent = txt; }
    applyIncomingIce();
  }, 120);
}

// ----- UI room -----
function setRoomMsg(m) { const el = document.getElementById('rp-msg'); if (el) el.textContent = m || ''; }
function updateRoomUI() {
  updateLobbyLeaderboard();
  const inLobby = gameState === 'LOBBY';
  const startButton = document.getElementById('btn-start-game');
  if (startButton && inLobby) {
    const hostCanStart = !!roomCode && !!roomMeta && roomMeta.host === mpUid && !roomRoundBusy();
    startButton.style.display = roomCode ? (hostCanStart ? 'flex' : 'none') : 'flex';
    startButton.title = roomCode ? (hostCanStart ? 'Mulai permainan bersama teman di lobby' : 'Menunggu pembuat room') : 'Mulai permainan solo';
  }
  const panel = document.getElementById('room-panel'); if (!panel) return;
  panel.style.display = inLobby ? 'flex' : 'none';
  panel.classList.toggle('rp-collapsed', rpCollapsed);
  document.getElementById('rp-min').textContent = rpCollapsed ? '▢' : '—';
  document.getElementById('rp-qstart').style.display = (rpCollapsed && roomCode && roomMeta && roomMeta.host === mpUid && !roomMeta.startAt) ? 'block' : 'none';
  document.getElementById('rp-title').textContent = roomCode ? '🎮 Grup · ' + Object.keys(roomPlayers).length + ' pemain' : '🎮 Mabar';
  document.getElementById('rp-menu').style.display = roomCode ? 'none' : 'flex';
  document.getElementById('rp-room').style.display = roomCode ? 'flex' : 'none';
  if (!roomCode) return;
  { const ce = document.getElementById('rp-codetext'); if (ce) ce.textContent = ''; }
  const list = document.getElementById('rp-list'); list.innerHTML = '';
  const ids = sortedIds();
  ids.forEach(id => {
    const p = roomPlayers[id], row = document.createElement('div'); row.className = 'rp-player';
    row.textContent = (roomMeta && roomMeta.host === id ? '👑 ' : '🧍 ') + String(p.username || 'Pemain') + (p.isDev ? ' ✔' : '') + (id === mpUid ? ' (kamu)' : '');
    list.appendChild(row);
  });
  const isHost = !!roomMeta && roomMeta.host === mpUid;
  const st = document.getElementById('rp-start'); st.style.display = isHost ? 'block' : 'none'; st.textContent = '▶ MULAI (' + ids.length + ' pemain)';
  document.getElementById('rp-wait').style.display = isHost ? 'none' : 'flex';
}
function buildLeaveGroupButton() {
  if (document.getElementById('btn-leave-group')) return;
  const st = document.createElement('style');
  st.textContent = '#btn-leave-group{position:fixed;top:100px;right:16px;z-index:59;width:34px;height:34px;border:1px solid rgba(255,90,90,.85);border-radius:50%;background:rgba(32,10,10,.92);color:#ff8a8a;font-size:16px;box-shadow:0 3px 12px #0008;display:none;align-items:center;justify-content:center;padding:0}#btn-leave-group:active{transform:scale(.92)}';
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'btn-leave-group'; b.type = 'button'; b.textContent = '🚪'; b.title = 'Keluar dari grup';
  let busy = false;
  b.addEventListener('click', async () => {
    if (busy || !roomCode) return; busy = true;
    try { await leaveRoom(false); showToast('Kamu keluar dari grup'); }
    catch (e) { showToast('Gagal keluar grup: ' + (e && e.message || e)); }
    busy = false;
  });
  document.body.appendChild(b);
  // Tampil hanya saat berada di grup, di lobby, dan permainan belum dimulai.
  setInterval(() => { b.style.display = (roomCode && gameState === 'LOBBY' && !roomStartAt) ? 'flex' : 'none'; }, 250);
}
function buildRoomUI() {
  buildLeaveGroupButton();
  buildMissionsUI();
  // UI room/mabar disembunyikan. Room dibuat otomatis saat pemain mengundang teman.
  buildPlayerSearchUI();
  if (document.getElementById('countdown')) return;
  const css = document.createElement('style');
  css.textContent = `#countdown{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;font:900 140px sans-serif;color:#fff;text-shadow:0 0 30px #3b6cf6;pointer-events:none}
`;
  document.head.appendChild(css);
  const cd = document.createElement('div'); cd.id = 'countdown';
  document.body.append(cd);
}

window.addEventListener('pagehide', () => { if (myRef) remove(myRef).catch(() => {}); });

// ===== SNOW-MODULE-BEGIN =====
// =====================================================================
// SISTEM GACHA MAP + MAP SALJU
// Modul tambahan: map Lava lama tidak diubah. Setiap map punya dunia sendiri
// (grup 3D, daftar platform, checkpoint, NPC). applyMap() hanya menukar
// variabel aktif (platforms, guards, hazards, FIN_Y, WIN) sesuai hasil gacha,
// sehingga seluruh sistem lama (kontrol, kamera, respawn, multiplayer) tetap
// memakai kode yang sama.
// =====================================================================
const MAP_LABELS = { lava: { icon: '🌋', name: 'MAP LAVA', color: '#ff6a2a' }, snow: { icon: '❄️', name: 'MAP SALJU', color: '#7fd6ff' }, angkasa: { icon: '🚀', name: 'MAP ANGKASA', color: '#a78bfa' }, mountain: { icon: '🏔️', name: 'MAP GUNUNG', color: '#65c987' }, honey: { icon: '🍯', name: 'HONEY DROP', color: '#ffc53a' }, laser: { icon: '🔴', name: 'LASER LAB', color: '#ff3a8a' }, lavaland: { icon: '🌋', name: 'LAVA LAND', color: '#ff5a2a' } };

// Gacha: hanya memilih map yang benar-benar tersedia.
function rollMap(multi) { const available = ['lava']; if (snowWorld) available.push('snow'); if (angkasaWorld) available.push('angkasa'); if (mountainWorld) available.push('mountain'); if (honeyWorld && multi) available.push('honey'); if (laserWorld && multi) available.push('laser'); if (lavaLandWorld && multi) available.push('lavaland'); /* Honey Drop: hanya room 2+ pemain */ return available[Math.floor(Math.random() * available.length)]; }

// Animasi gacha horizontal: kartu map bergeser dari kanan ke kiri lalu berhenti tepat di hasil.
function playMapGacha(result, spinMs, done) {
  let finished = false;
  let fallbackTimer = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    try { if (typeof done === 'function') done(); } catch (e) { console.error(e); }
  };

  try {
    // Hanya masukkan map yang sudah selesai dibuat/dimuat.
    const keys = ['lava'];
    if (snowWorld) keys.push('snow');
    if (angkasaWorld) keys.push('angkasa');
    if (mountainWorld) keys.push('mountain');
    // Honey harus ikut daftar kartu roulette, bukan hanya daftar rollMap().
    if (honeyWorld && roomCode) keys.push('honey'); // kartu Honey hanya muncul di room multiplayer
    if (laserWorld && roomCode) keys.push('laser'); // kartu Laser hanya muncul di room multiplayer
    if (lavaLandWorld && roomCode) keys.push('lavaland'); // kartu Lava Land hanya muncul di room multiplayer
    const chosen = keys.includes(result) ? result : 'lava';
    const winnerIndex = 30;

    // Perbarui CSS setiap kali agar tidak memakai style gacha versi lama.
    let css = document.getElementById('gacha-css');
    if (!css) {
      css = document.createElement('style');
      css.id = 'gacha-css';
      document.head.appendChild(css);
    }
    css.textContent = `
      #map-gacha{position:fixed;inset:0;z-index:999999;display:none;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:20px 10px;box-sizing:border-box;overflow:hidden;background:radial-gradient(ellipse at 50% 45%,#153b66 0%,#091629 48%,#030711 100%);color:#fff;font-family:Arial,sans-serif;text-align:center;isolation:isolate}
      #map-gacha:before,#map-gacha:after{content:"";position:absolute;width:min(85vw,560px);aspect-ratio:1;border:1px solid #39baff22;border-radius:50%;box-shadow:0 0 65px #168cff18,inset 0 0 55px #168cff12;z-index:-1;animation:gc-orbit 16s linear infinite;pointer-events:none}
      #map-gacha:after{width:min(115vw,760px);animation-direction:reverse;opacity:.55}
      @keyframes gc-orbit{to{transform:rotate(360deg)}}
      #gc-title{font-size:clamp(24px,6vw,38px);font-weight:1000;letter-spacing:3px;text-shadow:0 0 24px #159cff}
      #gc-caption{font-size:11px;letter-spacing:2.5px;color:#9fc7ed}
      #gc-reel-wrap{position:relative;width:min(94vw,760px);height:190px;box-sizing:border-box;overflow:hidden;padding:8px 0;border-top:1px solid #62c5ff55;border-bottom:1px solid #62c5ff55;background:linear-gradient(90deg,transparent,#173b61aa 18%,#173b61aa 82%,transparent);}
      #gc-reel-wrap:before{content:"";position:absolute;z-index:5;left:50%;top:0;bottom:0;width:4px;transform:translateX(-50%);border-radius:6px;background:#63e5ff;box-shadow:0 0 10px #35cfff,0 0 26px #168cff;pointer-events:none}
      #gc-reel{height:100%;display:flex;align-items:center;gap:14px;width:max-content;transform:translate3d(0,0,0);will-change:transform}
      .gc-card{flex:0 0 150px;height:160px;box-sizing:border-box;border:1px solid #a6c9ed44;border-radius:16px;background:linear-gradient(155deg,#213b5c,#0b172a);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;opacity:.72;transform:scale(.88);transition:opacity .3s,transform .3s,border-color .3s,box-shadow .3s}
      .gc-card-icon{font-size:49px;line-height:1}
      .gc-card-name{font-size:12px;font-weight:900;letter-spacing:1px;color:#eaf6ff}
      .gc-card-tag{font-size:9px;letter-spacing:2px;color:#91b8df}
      .gc-card.winner{opacity:1;transform:scale(1.05);border:2px solid var(--map-color);box-shadow:0 0 22px var(--map-color),inset 0 0 20px #ffffff18}
      #gc-result{min-height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}
      #gc-result-name{font-size:clamp(19px,5vw,27px);font-weight:1000;letter-spacing:1px}
      #gc-sub{font-size:12px;color:#a9c3df}
      #gc-result.reveal{animation:gc-reveal .55s cubic-bezier(.2,1.5,.4,1) both}
      @keyframes gc-reveal{from{opacity:0;transform:translateY(14px) scale(.75)}to{opacity:1;transform:translateY(0) scale(1)}}
      #gc-loading{width:min(220px,65vw);height:4px;border-radius:9px;background:#1a3450;overflow:hidden}
      #gc-loading i{display:block;width:35%;height:100%;background:#52dcff;box-shadow:0 0 12px #52dcff;animation:gc-progress .7s ease-in-out infinite alternate}
      @keyframes gc-progress{to{transform:translateX(190%)}}
      @media(max-width:430px){#gc-reel-wrap{height:174px}.gc-card{flex-basis:132px;height:146px}.gc-card-icon{font-size:43px}#gc-reel{gap:11px}}
      @media(prefers-reduced-motion:reduce){#map-gacha:before,#map-gacha:after,#gc-loading i{animation:none!important}}
    `;

    let el = document.getElementById('map-gacha');
    if (!el) {
      el = document.createElement('div');
      el.id = 'map-gacha';
      document.body.appendChild(el);
    }
    // Selalu bangun ulang isi overlay supaya sisa elemen versi lama tidak terbawa.
    el.innerHTML = `
      <div id="gc-title">MAP GACHA</div>
      <div id="gc-caption">HORIZONTAL MAP ROULETTE</div>
      <div id="gc-reel-wrap"><div id="gc-reel"></div></div>
      <div id="gc-result"><div id="gc-result-name">MENGACAK MAP...</div><div id="gc-sub">Tunggu sampai roulette berhenti</div></div>
      <div id="gc-loading"><i></i></div>
    `;

    const reel = el.querySelector('#gc-reel');
    const wrap = el.querySelector('#gc-reel-wrap');
    const resultBox = el.querySelector('#gc-result');
    const resultName = el.querySelector('#gc-result-name');
    const sub = el.querySelector('#gc-sub');
    const loading = el.querySelector('#gc-loading');
    const cardHTML = (key, index) => {
      const m = MAP_LABELS[key] || MAP_LABELS.lava;
      const tag = key === 'honey' ? '🍯 HONEY PARKOUR' : (key === 'laser' ? '🔴 LASER SURVIVAL' : (key === 'lavaland' ? '🌋 HEX SURVIVAL' : 'PARKOUR WORLD'));
      return `<div class="gc-card" data-map="${key}" data-index="${index}" style="--map-color:${m.color}"><div class="gc-card-icon">${m.icon}</div><div class="gc-card-name">${m.name}</div><div class="gc-card-tag">${tag}</div></div>`;
    };

    // Buat deretan kartu panjang; kartu pemenang ditaruh jauh di kanan.
    const sequence = Array.from({length:winnerIndex + 1}, () => keys[Math.floor(Math.random() * keys.length)]);
    sequence[winnerIndex] = chosen;
    reel.innerHTML = sequence.map(cardHTML).join('');

    el.style.display = 'flex';
    el.style.opacity = '1';
    el.style.transform = 'none';
    resultBox.classList.remove('reveal');
    resultName.textContent = 'MENGACAK MAP...';
    resultName.style.color = '#ffffff';
    sub.textContent = 'Roulette sedang bergerak...';
    loading.style.display = 'block';

    const winner = reel.querySelector(`[data-index="${winnerIndex}"]`);
    // Ukur setelah elemen tampil. Selisih bounding-rect lebih akurat daripada offsetLeft
    // yang bisa berbeda tergantung offsetParent dan ukuran layar.
    reel.style.transition = 'none';
    reel.style.transform = 'translate3d(0px,0,0)';
    void reel.offsetWidth;
    const wrapRect = wrap.getBoundingClientRect();
    const winnerRect = winner.getBoundingClientRect();
    const targetX = (winnerRect.left + winnerRect.width / 2) - (wrapRect.left + wrapRect.width / 2);
    const duration = Math.max(4200, Number(spinMs) || 0);
    let revealed = false;
    const revealWinner = () => {
      if (revealed || finished) return;
      revealed = true;
      winner.classList.add('winner');
      loading.style.display = 'none';
      const m = MAP_LABELS[chosen] || MAP_LABELS.lava;
      resultName.textContent = `${m.icon} ${m.name}`;
      resultName.style.color = m.color;
      sub.textContent = 'MAP BERHASIL DIDAPATKAN!';
      resultBox.classList.add('reveal');
      setTimeout(() => {
        el.style.transition = 'opacity .3s ease';
        el.style.opacity = '0';
        setTimeout(() => {
          el.style.display = 'none';
          el.style.opacity = '1';
          el.style.transition = '';
          finish();
        }, 320);
      }, 1000);
    };

    requestAnimationFrame(() => {
      // Mulai dari posisi awal lalu geser horizontal hingga tepat di tengah marker.
      reel.style.transition = `transform ${duration}ms cubic-bezier(.10,.72,.12,1)`;
      reel.style.transform = `translate3d(${-targetX}px,0,0)`;
    });
    reel.addEventListener('transitionend', (event) => {
      if (event.propertyName === 'transform') revealWinner();
    }, {once:true});
    // Fallback jika transitionend tidak terpanggil pada browser tertentu.
    fallbackTimer = setTimeout(revealWinner, duration + 250);
  } catch (e) {
    console.warn('Animasi gacha map gagal:', e);
    finish();
  }
}

// Menukar dunia aktif. Dipanggil tepat sebelum onGameBegin().
function applyMap(id) {
  if (id === 'snow' && !snowWorld) id = 'lava';
  if (id === 'angkasa' && !angkasaWorld) id = 'lava';
  if (id === 'mountain' && !mountainWorld) id = 'lava';
  if (id === 'honey' && !honeyWorld) id = 'lava';
  if (id === 'laser' && !laserWorld) id = 'lava';
  if (id === 'lavaland' && !lavaLandWorld) id = 'lava';
  const w = id === 'lavaland' ? lavaLandWorld : id === 'laser' ? laserWorld : id === 'honey' ? honeyWorld : (id === 'snow' ? snowWorld : (id === 'angkasa' ? angkasaWorld : (id === 'mountain' ? mountainWorld : lavaWorld)));
  if (!w) return;
  currentMap = id;

  // Fitur lari (sprint) dimatikan khusus di map Angkasa.
  // Map Lava dan Salju tetap memakai tombol lari seperti biasa.
  const runButton = document.getElementById('btn-run');
  if (runButton) runButton.style.display = id === 'angkasa' ? 'none' : '';
  isRunning = false;

  platforms = w.platforms || []; hazards = w.hazards || []; guards = w.guards || []; laserBeam = w.laserBeam || null;
  FIN_Y = w.FIN_Y; WIN = w.WIN || { x: 0, y: FIN_Y, z: 0 }; MAZE_H = w.MAZE_H || 0; MAZE_Z = w.MAZE_Z || 0;
  laserState = 'off'; curGroundPlat = null;
  if (parkourWorldGroup) parkourWorldGroup.visible = id === 'lava';
  if (snowWorldGroup) snowWorldGroup.visible = id === 'snow';
  if (angkasaWorldGroup) angkasaWorldGroup.visible = id === 'angkasa';
  if (mountainWorldGroup) mountainWorldGroup.visible = id === 'mountain';
  if (honeyWorldGroup) honeyWorldGroup.visible = id === 'honey';
  if (laserWorldGroup) laserWorldGroup.visible = id === 'laser';
  if (lavaLandWorldGroup) lavaLandWorldGroup.visible = id === 'lavaland';
  if (id === 'snow' && snowController) snowController.reset();
  if (angkasaController) angkasaController.reset(physics);
  if (id === 'angkasa' && scene) {
    if (angkasaController && angkasaController.enter) angkasaController.enter(scene);
    else { scene.background = new THREE.Color(0x000000); scene.fog = null; }
  } else if (id === 'mountain' && scene) {
    scene.background = new THREE.Color(0x9fc8e8);
    scene.fog = new THREE.Fog(0x9fc8e8, 45, 230);
  } else if (id === 'honey' && scene) {
    scene.background = new THREE.Color(0x58b8f0); scene.fog = new THREE.Fog(0x9fd8ff, 60, 160);
  } else if (id === 'laser' && scene) {
    laserWorld.applyEnvironment(scene);
  } else if (id === 'lavaland' && scene) {
    lavaLandWorld.applyEnvironment(scene);
  } else if (scene) {
    // Kembalikan latar default game untuk Lava/Snow; efek khusus map tetap
    // dikelola oleh modul map masing-masing.
    scene.background = new THREE.Color(0x1a1a24);
    scene.fog = new THREE.Fog(0x1a1a24, 20, 150);
  }
  try { guards.forEach(gd => gd.reset()); } catch (e) {}
}
// ===== ICE MAP BUILDER MOVED TO snow.js =====

const clock = new THREE.Clock();
let walkTime = 0;

// ===== MISI HARIAN (reset setiap pukul 00.00 sesuai jam perangkat) =====
const DAILY_MISSIONS = [
  // Login beruntun: progres = jumlah hari login berturut-turut (siklus 5 hari), hadiah otomatis masuk saat login.
  { id: 'login1', group: 'Login Beruntun (siklus 5 hari)', login: 1, icon: '📅', title: 'Login hari ke-1',          desc: 'Buka game hari ini',                         reward: 300,  goal: 1 },
  { id: 'login2', login: 2, icon: '📅', title: 'Login 2 hari berturut-turut', desc: 'Buka game 2 hari tanpa terlewat',            reward: 600,  goal: 2 },
  { id: 'login3', login: 3, icon: '📅', title: 'Login 3 hari berturut-turut', desc: 'Buka game 3 hari tanpa terlewat',            reward: 800,  goal: 3 },
  { id: 'login5', login: 5, icon: '🗓️', title: 'Login 5 hari berturut-turut', desc: 'Buka game 5 hari tanpa terlewat',            reward: 1000, goal: 5 },
  // Main match: tiap match dihitung sekali jika main minimal 15 detik.
  { id: 'match',  group: 'Main Match', icon: '🎮', title: 'Bermain 1 match',        desc: 'Main minimal 15 detik di satu match',          reward: 200,    goal: 1 },
  { id: 'match2', track: 'match', icon: '🎮', title: 'Bermain 2 match',        desc: 'Selesaikan 2 match hari ini (min. 15 detik)',  reward: 500,    goal: 2 },
  { id: 'match3', track: 'match', icon: '🎮', title: 'Bermain 3 match',        desc: 'Selesaikan 3 match hari ini (min. 15 detik)',  reward: 800,    goal: 3 },
  { id: 'friend', group: 'Misi Lainnya', icon: '👥', title: 'Bermain bersama teman',  desc: 'Main match di grup bersama minimal 1 teman',   reward: 300,    goal: 1 },
  { id: 'time',   icon: '⏱️', title: 'Bermain selama 30 menit', desc: 'Total waktu bermain aktif hari ini',            reward: 1000,   goal: 1800 },
];
const MISSION_MIN_ROUND_SEC = 15;
const LOGIN_CYCLE = 5;
let missionRoundSec = 0, missionRoundCounted = false, missionLastPos = null, missionLastMoveAt = 0, missionDirty = false, missionSaveAt = 0;

function missionDayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
// Hitung streak login untuk hari ini dari data streak terakhir.
function nextLoginStreak(old, day) {
  if (!old || !old.last) return { count: 1, last: day, claimed: {} };
  if (old.last === day) return old;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const prev = Number(old.count) || 0;
  if (old.last === missionDayKey(y)) {
    if (prev >= LOGIN_CYCLE) return { count: 1, last: day, claimed: {} };          // siklus 5 hari selesai -> mulai lagi
    return { count: prev + 1, last: day, claimed: old.claimed || {} };
  }
  return { count: 1, last: day, claimed: {} };                                      // ada hari yang terlewat -> mulai dari awal
}
function grantLoginRewards(m) {
  if (!m || !m.streak) return;
  if (!m.streak.claimed) m.streak.claimed = {};
  let total = 0; const got = [];
  for (const def of DAILY_MISSIONS) {
    if (!def.login || m.streak.claimed[def.id] || (Number(m.streak.count) || 0) < def.login) continue;
    m.streak.claimed[def.id] = true; total += def.reward; got.push(def);
  }
  if (!total) return;
  playerData.coins = Math.floor(Number(playerData.coins) || 0) + total;
  const ce = document.getElementById('coin-amount'); if (ce) ce.textContent = playerData.coins;
  missionFlush();
  showToast('📅 ' + got[got.length - 1].title + '  +' + total.toLocaleString('id-ID') + ' 🪙', 3500);
  refreshMissionsModal();
}
function ensureMissions() {
  if (!playerData || !playerData.username) return null;
  const day = missionDayKey();
  let m = playerData.dailyMissions, fresh = false;
  if (!m || m.day !== day) {                                                         // hari baru -> reset misi harian, streak login dilanjutkan
    m = playerData.dailyMissions = { day, prog: {}, done: {}, streak: nextLoginStreak(m && m.streak, day) };
    missionDirty = true; fresh = true;
  }
  if (!m.prog) m.prog = {}; if (!m.done) m.done = {};
  if (!m.streak) { m.streak = nextLoginStreak(null, day); missionDirty = true; fresh = true; }   // data lama tanpa streak
  if (fresh) grantLoginRewards(m);
  return m;
}
function missionFlush() { missionDirty = false; missionSaveAt = performance.now(); updatePlayerFirebase().catch(e => console.warn('Gagal menyimpan misi:', e)); }
function completeMission(id) {
  const m = ensureMissions(), def = DAILY_MISSIONS.find(x => x.id === id);
  if (!m || !def || m.done[id]) return;
  m.done[id] = true; m.prog[id] = def.goal;
  playerData.coins = Math.floor(Number(playerData.coins) || 0) + def.reward;
  const ce = document.getElementById('coin-amount'); if (ce) ce.textContent = playerData.coins;
  missionFlush();
  showToast('🎯 Misi selesai: ' + def.title + '  +' + def.reward.toLocaleString('id-ID') + ' 🪙', 3500);
  refreshMissionsModal();
}
function missionAdd(id, amount) {
  const m = ensureMissions(), def = DAILY_MISSIONS.find(x => x.id === id);
  if (!m || !def || def.login || m.done[id]) return;
  m.prog[id] = Math.min(def.goal, (Number(m.prog[id]) || 0) + amount); missionDirty = true;
  if (m.prog[id] >= def.goal) completeMission(id);
}
// Tambah progres ke semua misi yang melacak hal yang sama (mis. 'match' -> misi 1, 2, dan 3 match).
function missionTrack(track, amount) {
  for (const def of DAILY_MISSIONS) if (!def.login && (def.track || def.id) === track) missionAdd(def.id, amount);
}
function missionTick(dt) {
  const m = ensureMissions(); if (!m || !character) return;
  if (gameState === 'LOBBY') { missionRoundSec = 0; missionRoundCounted = false; missionLastPos = null; if (missionDirty) missionFlush(); return; }
  if (gameState !== 'PLAYING' || document.hidden) return;
  const now = performance.now(), p = character.position;
  if (!missionLastPos || Math.hypot(p.x - missionLastPos.x, p.y - missionLastPos.y, p.z - missionLastPos.z) > 0.05) { missionLastMoveAt = now; missionLastPos = p.clone(); }
  if (now - missionLastMoveAt > 15000) return;            // diam/AFK lebih dari 15 detik tidak dihitung
  missionRoundSec += dt;
  missionTrack('time', dt);
  if (missionRoundSec >= MISSION_MIN_ROUND_SEC && !missionRoundCounted) {   // satu match dihitung satu kali
    missionRoundCounted = true;
    missionTrack('match', 1);
    if (roomCode && roomStartAt && Object.keys(roomPlayers || {}).length >= 2) missionTrack('friend', 1);
  }
  if (missionDirty && now - missionSaveAt > 30000) missionFlush();   // simpan berkala
}

function missionResetText() {
  const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), ms = Math.max(0, next - n);
  const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60;
  return 'Reset dalam ' + String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') + ':' + String(se).padStart(2, '0');
}
function refreshMissionsModal() {
  const box = document.getElementById('missions-modal'); if (!box || box.style.display === 'none') return;
  const m = ensureMissions(); if (!m) return;
  document.getElementById('missions-reset').textContent = missionResetText();
  const list = document.getElementById('missions-list'); list.innerHTML = '';
  for (const def of DAILY_MISSIONS) {
    if (def.group) { const h = document.createElement('div'); h.className = 'mi-h'; h.textContent = def.group; list.appendChild(h); }
    let done, prog, txt;
    if (def.login) {
      const st = m.streak || { count: 0, claimed: {} };
      done = !!(st.claimed && st.claimed[def.id]); prog = done ? def.goal : Math.min(def.goal, Number(st.count) || 0); txt = prog + ' / ' + def.goal + ' hari';
    } else {
      done = !!m.done[def.id]; prog = done ? def.goal : Math.min(def.goal, Number(m.prog[def.id]) || 0);
      txt = def.id === 'time' ? Math.floor(prog / 60) + ' / ' + Math.floor(def.goal / 60) + ' menit' : prog + ' / ' + def.goal;
    }
    const pct = Math.round(prog / def.goal * 100);
    const row = document.createElement('div'); row.className = 'mi-row' + (done ? ' mi-done' : '');
    row.innerHTML = '<div class="mi-ic">' + def.icon + '</div><div class="mi-body"><b>' + def.title + '</b><small>' + def.desc + '</small>' +
      '<div class="mi-bar"><i style="width:' + pct + '%"></i></div><small>' + (done ? '✅ Selesai' : txt) + '</small></div>' +
      '<div class="mi-rw">+' + def.reward.toLocaleString('id-ID') + '<br>🪙</div>';
    list.appendChild(row);
  }
}
function buildMissionsUI() {
  if (document.getElementById('btn-missions')) return;
  const st = document.createElement('style');
  st.textContent = '#btn-missions{position:fixed;top:142px;right:16px;z-index:59;width:34px;height:34px;border:1px solid rgba(120,255,160,.8);border-radius:50%;background:rgba(10,28,16,.92);color:#8dffb0;font-size:16px;box-shadow:0 3px 12px #0008;display:none;align-items:center;justify-content:center;padding:0}#btn-missions:active{transform:scale(.92)}' +
    '#missions-modal{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}' +
    '#missions-card{width:min(380px,calc(100vw - 24px));max-height:82vh;overflow:auto;padding:14px;border-radius:16px;background:rgba(9,16,31,.97);border:1px solid rgba(120,255,160,.6);color:#fff;font-family:sans-serif;box-shadow:0 10px 40px #000a}' +
    '#missions-card h3{margin:0 0 2px;font-size:18px}#missions-reset{font-size:12px;color:#8dffb0;margin-bottom:10px}' +
    '.mi-h{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8dffb0;margin:12px 2px 6px}.mi-row{display:flex;gap:10px;align-items:center;padding:9px;margin-bottom:8px;border-radius:12px;background:rgba(255,255,255,.06)}.mi-row.mi-done{opacity:.65}' +
    '.mi-ic{font-size:24px;width:32px;text-align:center}.mi-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.mi-body small{color:#aab4c8;font-size:11px}' +
    '.mi-bar{height:6px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden;margin:3px 0}.mi-bar i{display:block;height:100%;background:linear-gradient(90deg,#34d17a,#8dffb0)}' +
    '.mi-rw{font-weight:800;color:#ffd166;text-align:center;font-size:13px;line-height:1.2}#missions-close{width:100%;margin-top:4px;padding:10px;border:0;border-radius:10px;background:#1e2a44;color:#fff;font-weight:700}';
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'btn-missions'; b.type = 'button'; b.textContent = '🎯'; b.title = 'Misi Harian';
  const box = document.createElement('div'); box.id = 'missions-modal';
  box.innerHTML = '<div id="missions-card"><h3>🎯 Misi Harian</h3><div id="missions-reset"></div><div id="missions-list"></div><button id="missions-close" type="button">Tutup</button></div>';
  const close = () => { box.style.display = 'none'; };
  b.addEventListener('click', () => { box.style.display = 'flex'; refreshMissionsModal(); });
  box.addEventListener('click', e => { if (e.target === box) close(); });
  box.querySelector('#missions-close').addEventListener('click', close);
  document.body.appendChild(b); document.body.appendChild(box);
  setInterval(() => { b.style.display = (gameState === 'LOBBY' && playerData && playerData.username) ? 'flex' : 'none'; if (gameState !== 'LOBBY') close(); else refreshMissionsModal(); }, 1000);
}

function animate() {
  requestAnimationFrame(animate);
  if (!renderer) return;
  const delta = Math.min(clock.getDelta(), 0.1);
  const t = roomStartAt ? Math.max(0, (serverNow() - roomStartAt) / 1000) : clock.getElapsedTime();
  // Timer visual di HUD dihapus: progres kemenangan menggunakan mahkota.
  tickMultiplayer();
  if (snowController) snowController.updateHud({ currentMap, gameState });
  animateRemotePlayers(delta);
  tickGhostFire();
  updateFreezeVisuals(delta);
  updateVipAuras(delta);
  updateWinFx(delta);
  missionTick(delta);
  if (lobbyAccentRing && gameState === 'LOBBY') lobbyAccentRing.rotation.z += delta * 0.12;
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

  updateDebris(delta);
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

  const speed = flyMode ? flySpeed : (isRunning ? 9 : 5);
  let isMoving = false;

  platforms.forEach(p => {
    if (p.type === 'moving_x') { const nx = p.startX + Math.sin(t * p.speed + p.phase) * p.range; p.dx = nx - p.mesh.position.x; p.mesh.position.x = nx; }
    else if (p.type === 'moving_y') p.mesh.position.y = p.startY + Math.sin(t * p.speed + p.phase) * p.range;
    else if (p.type === 'fake') {
      // Setelah terpicu, kotak menghilang tepat 2 detik lalu muncul kembali.
      p.revealTimer = Math.max(0, p.revealTimer - delta);
      p.mesh.visible = p.revealTimer <= 0;
    }
    else if (p.decoy) {
      // Kotak asli pengecoh juga tetap stabil, tanpa efek berkedip.
      p.mesh.visible = true;
      p.mesh.material.opacity = 1;
    }
  });

  hazards.forEach(h => h.update(t));
  if (currentMap === 'snow' && snowController) snowController.update(delta, {
    curGroundPlat, physics, character, godMode, flyMode, hitCD, knock
  });
  if (currentMap === 'mountain' && mountainWorld?.swingPlanks) mountainWorld.swingPlanks.forEach(p => { p.mesh.rotation.z = Math.sin(t * p.speed + p.phase) * 0.08; });
  if (currentMap === 'honey' && honeyWorld) honeyWorld.update(delta, character.position);
  if (currentMap === 'lavaland' && lavaLandWorld) lavaLandWorld.update(delta, character.position, roomStartAt ? (serverNow() - roomStartAt) / 1000 : undefined);
  if (currentMap === 'laser' && laserWorld) { // waktu laser = detik sejak ronde mulai (sama di semua pemain room)
    const laserHit = laserWorld.update(delta, character.position, roomStartAt ? (serverNow() - roomStartAt) / 1000 : undefined);
    if (laserHit && !godMode && !flyMode && gameState === 'PLAYING') honeyEliminateLocal('laser');
  }
  if (currentMap === 'angkasa' && angkasaController) angkasaController.update(delta, {
    curGroundPlat, physics, character, godMode, flyMode, hitCD, knock
  });
  if (!mazeHinted && character.position.y > FIN_Y - 1 && Math.abs(character.position.x) < MAZE_H && character.position.z < -89 && character.position.z > MAZE_Z - MAZE_H) { mazeHinted = true; showToast('🧩 SALAH BEGO,MAMPUS'); }
  for (const gd of guards) { if (gd.update(delta, character.position, t, !godMode && !flyMode)) { gameState = 'GAMEOVER'; showGameOver(currentMap === 'snow' ? 'snowshot' : 'shot'); break; } }
  hitCD = Math.max(0, hitCD - delta); knock.multiplyScalar(Math.exp(-delta * 2.5));
  if (hitCD <= 0 && !godMode && !flyMode) for (const h of hazards) {
    const n = h.test(character.position);
    if (n) { knock.set(n.x * 26, n.z * 26); physics.velocityY = 13; physics.isGrounded = false; hitCD = 1.2; sq.v = -5; break; }
  }
  const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

  const preVy = physics.velocityY;
  let nextX = character.position.x; let nextZ = character.position.z;
  let desX = 0, desZ = 0;
  if (!isFrozenLocal() && (Math.abs(joystickVector.x) > 0.1 || Math.abs(joystickVector.y) > 0.1)) {
    const moveX = forward.x * joystickVector.y + right.x * joystickVector.x;
    const moveZ = forward.z * joystickVector.y + right.z * joystickVector.x;
    const len = Math.sqrt(moveX*moveX + moveZ*moveZ);
    desX = (moveX / len) * speed; desZ = (moveZ / len) * speed;
    let diff = Math.atan2(moveX, moveZ) - character.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    character.rotation.y += diff * (1 - Math.exp(-delta * 16));
    if (isRunning && Math.random() < 0.3) createTrailEffect();
  }
  // Map Salju: permukaan es licin = percepatan/pengereman lebih kecil. Map Lava tidak terpengaruh (gp = null).
  const gp = (currentMap === 'snow' && !flyMode && physics.isGrounded && curGroundPlat && curGroundPlat.grip) ? curGroundPlat.grip : null;
  const accel = 1 - Math.exp(-delta * ((desX || desZ) ? 11 * (gp ? gp[0] : 1) : 14 * (gp ? gp[1] : 1)));
  moveVel.x += (desX - moveVel.x) * accel; moveVel.y += (desZ - moveVel.y) * accel;
  if (isFrozenLocal()) { moveVel.set(0, 0); knock.set(0, 0); }
  const hSpeed = moveVel.length();
  isMoving = hSpeed > 0.4;
  nextX += (moveVel.x + knock.x) * delta; nextZ += (moveVel.y + knock.y) * delta;

  if (flyMode || !checkWallCollision(nextX, character.position.z, character.position.y)) character.position.x = nextX;
  if (flyMode || !checkWallCollision(character.position.x, nextZ, character.position.y)) character.position.z = nextZ;

  const groundData = flyMode ? null : checkGroundCollision(character.position.x, character.position.z, character.position.y);
  curGroundPlat = groundData ? groundData.platform : null;
  if (groundData && physics.velocityY <= 0) {
    character.position.y = groundData.y;
    physics.velocityY = 0; physics.isGrounded = true; physics.jumpCount = 0;
    if (groundData.platform.type === 'moving_x') character.position.x += groundData.platform.dx;
    if (groundData.platform.checkpoint && !groundData.platform.checkpointActivated && !activatedCheckpoints.has(groundData.platform)) {
      // Tandai platform secara permanen untuk putaran ini agar tidak aktif ulang setelah pemain jatuh/respawn.
      groundData.platform.checkpointActivated = true;
      activatedCheckpoints.add(groundData.platform);
      const m = groundData.platform.mesh.position;
      checkpoint = { p: groundData.platform, set: true, x: m.x, y: groundData.y, z: m.z };
      if (usedCheckpointMat) groundData.platform.mesh.material = usedCheckpointMat;
      showToast('✅ Checkpoint tersimpan!');
      if (!roomCode) { // mode solo: posisi checkpoint disimpan ke akun, jadi tetap di sini walau keluar game
        const sv = { px: +m.x.toFixed(3), py: +m.y.toFixed(3), pz: +m.z.toFixed(3), y: +groundData.y.toFixed(3) };
        if (currentMap === 'snow') playerData.savedCheckpointSnow = sv; else if (currentMap === 'mountain') playerData.savedCheckpointMountain = sv; else playerData.savedCheckpoint = sv; // checkpoint tiap map terpisah
        updatePlayerFirebase().catch(() => {});
      }
    }
  } else {
    physics.isGrounded = false;
  }

  if (flyMode) {
    physics.velocityY = 0;
    character.position.y += ((flyUp ? 1 : 0) - (flyDown ? 1 : 0)) * flySpeed * 0.8 * delta;
  } else if (!physics.isGrounded) {
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

  // Kotak palsu: menghilang saat pemain sedang turun dan hampir mendarat.
  // Pemicu berada sedikit di atas permukaan agar kotak hilang sebelum diinjak.
  platforms.forEach(p => {
    if (p.type !== 'fake' || p.revealTimer > 0 || !p.mesh.visible) return;

    const m = p.mesh.position;
    const topY = m.y + (p.hh || 0.25);
    const insideX = Math.abs(character.position.x - m.x) < p.width / 2 - 0.08;
    const insideZ = Math.abs(character.position.z - m.z) < p.depth / 2 - 0.08;
    const approachingLanding =
      physics.velocityY <= 0 &&
      character.position.y >= topY - 0.1 &&
      character.position.y <= topY + 1.35;

    if (insideX && insideZ && approachingLanding) {
      p.revealTimer = 2.0;
      p.mesh.visible = false;
      roast('fake', ' Kotak palsu!');
    }
  });

  // Laser hanya mengenai jika sedang menembak & kamu tidak melompatinya
  if (!godMode && !flyMode && laserState === 'fire' && Math.abs(character.position.z - LASER_Z) < 0.5 && Math.abs(character.position.x) < 3.5 && character.position.y > 8 && character.position.y < LASER_Y + 0.25) {
    gameState = 'GAMEOVER';
    showGameOver('laser');
  }

  // JIKA JATUH KE LAVA
  if (godMode && character.position.y < -3) { character.position.set(checkpoint.x, checkpoint.y + 0.3, checkpoint.z); physics.velocityY = 0; }
  const fallLimit = currentMap === 'honey' ? honeyWorld.FIN_Y : (currentMap === 'laser' ? laserWorld.fallLimit : (currentMap === 'lavaland' ? lavaLandWorld.fallLimit : -3));
  if (!godMode && !flyMode && character.position.y < fallLimit) {
    if (isSurvivalMap()) honeyEliminateLocal('fall');
    else { gameState = 'GAMEOVER'; shatterLocal(); setTimeout(() => { if (gameState === 'GAMEOVER') showGameOver('fall'); }, 900); }
  }

  // KONDISI MENANG DI PUNCAK
  if (!isSurvivalMap() && character.position.y > FIN_Y - 0.5 && Math.abs(character.position.x - WIN.x) < 4.5 && Math.abs(character.position.z - WIN.z) < 4.5) {
    gameState = 'WIN'; 
    const winCoins = coinX(1000);
    playerData.coins = (playerData.coins || 0) + winCoins;
    if (currentMap === 'snow') playerData.savedCheckpointSnow = null; else if (currentMap === 'mountain') playerData.savedCheckpointMountain = null; else playerData.savedCheckpoint = null; // selesai: progres checkpoint map ini direset
    updatePlayerFirebase();
    document.getElementById('coin-amount').textContent = playerData.coins;
    onFinish();
    showWinBanner('+' + winCoins + ' 🪙' + finishSummary());
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
  { const pp = (performance.now() - pushAnimStart) / PUSH_ANIM_MS; // animasi dorong (menimpa pose jalan/idle)
    if (pp >= 0 && pp < 1) { const Q = pushPose(pp); lA = rA = Q.arm; lE = rE = Q.el; armZ = Q.armZ; lean = Q.lean; bob = Q.bob; } }
  damp(leftLegPivot.rotation, 'x', lH); damp(rightLegPivot.rotation, 'x', rH);
  damp(leftKnee.rotation, 'x', lK); damp(rightKnee.rotation, 'x', rK);
  damp(leftArmPivot.rotation, 'x', lA); damp(rightArmPivot.rotation, 'x', rA);
  damp(leftElbow.rotation, 'x', lE); damp(rightElbow.rotation, 'x', rE);
  damp(leftArmPivot.rotation, 'z', -armZ); damp(rightArmPivot.rotation, 'z', armZ);
  damp(headGroup.rotation, 'y', headY);
  damp(rig.position, 'y', bob); damp(rig.rotation, 'x', lean); damp(rig.rotation, 'y', twist); damp(rig.rotation, 'z', sway);
  for (const cp of [capePivot, capeB, capeT]) if (cp && cp.visible) damp(cp.rotation, 'x', 0.08 + hSpeed * 0.05 + (physics.isGrounded ? 0 : 0.4) + Math.sin(t * 7) * (isMoving ? 0.05 : 0.01));
  const air = physics.isGrounded ? 0 : THREE.MathUtils.clamp(physics.velocityY / 13, -1, 1) * 0.1;
  const st = THREE.MathUtils.clamp(sq.x + air, -0.35, 0.35);
  rig.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5);
  camera.fov += ((60 + runK * 8) - camera.fov) * k * 0.5; camera.updateProjectionMatrix();
  updateLavaMap(lavaMapVisuals, delta, t, currentMap === 'lava');

  const targetPos = character.position.clone(); targetPos.y += 1.5;
  const prevT = controls.target.clone();
  controls.target.lerp(targetPos, 1 - Math.exp(-delta * 8));
  camera.position.add(controls.target.clone().sub(prevT)); // kamera ikut bergerak bersama pemain

  // Kamera tetap bebas dikontrol dan di-zoom, termasuk ketika berada di labirin.
  // Tidak ada kamera paksa yang menimpa jarak zoom pemain.
  if (zoomDir) {
    const off = camera.position.clone().sub(controls.target);
    const nextDistance = THREE.MathUtils.clamp(
      off.length() * (1 + zoomDir * 1.2 * delta),
      controls.minDistance,
      controls.maxDistance
    );
    off.setLength(nextDistance);
    camera.position.copy(controls.target).add(off);
  }
  controls.update();
}

window.addEventListener('resize', () => {
  if (camera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});

// ============ SISTEM NOTIFIKASI & INFORMASI ADMIN ============
// Alur: admin mengetik informasi di Admin Panel -> disimpan di Firebase `announcements`.
// Pemain melihatnya sebagai (1) banner di atas layar, (2) lonceng di kanan atas lobi,
// (3) notifikasi sistem browser bila diizinkan dan tab sedang di latar belakang.
// Catatan: tanpa server push (FCM), notifikasi sistem hanya muncul selama website masih terbuka.
const NOTIF_POLL_MS = 8000;
const NOTIF_MAX = 20;
const NOTIF_BELL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
let notifItems = [];
let notifKnownIds = null;   // null = polling pertama belum selesai
let notifSeenAt = 0;
let notifPollBusy = false;
let notifBannerQueue = [];
let notifBannerBusy = false;
let notifBannerTimer = null;
const notifSeenKey = () => 'parkour_notif_seen_v1_' + (accountKey() || 'guest');
const notifSupported = () => 'Notification' in window;

function injectNotifStyles() {
  if (document.getElementById('notif-css')) return;
  const st = document.createElement('style'); st.id = 'notif-css';
  st.textContent = `
#btn-notif{position:fixed;top:16px;right:58px;z-index:59;width:34px;height:34px;padding:0;border:1px solid rgba(130,87,230,.85);border-radius:50%;background:rgba(19,19,26,.92);color:#d9ccff;box-shadow:0 3px 12px #0008;display:none;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation}
#btn-notif svg{width:18px;height:18px}
#btn-notif:active{transform:scale(.94)}
#btn-notif.has-unread svg{animation:notifRing 1.6s ease 1;transform-origin:50% 10%}
@keyframes notifRing{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-12deg)}45%{transform:rotate(8deg)}60%{transform:rotate(-5deg)}75%{transform:rotate(0)}}
#notif-badge{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#ef4444;color:#fff;font:700 10px/17px -apple-system,'Segoe UI',Roboto,sans-serif;text-align:center;display:none;box-sizing:border-box}
#notif-panel{position:fixed;top:58px;right:58px;z-index:60;width:min(320px,calc(100vw - 24px));max-height:min(70vh,420px);display:none;flex-direction:column;background:rgba(19,19,26,.97);border:1px solid #2a2a38;border-radius:14px;color:#ececf1;font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.5);overflow:hidden;user-select:text;-webkit-user-select:text}
@media (max-width:420px){#notif-panel{right:12px;left:12px;width:auto}}
#notif-panel .np-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #262632;font-size:14px;font-weight:600}
#notif-panel .np-close{width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:#8b8b9a;font-size:20px;line-height:1;cursor:pointer}
#notif-panel .np-close:hover{background:rgba(255,255,255,.06);color:#ececf1}
#np-perm{padding:10px 14px;border-bottom:1px solid #262632;font-size:12px;color:#8b8b9a;line-height:1.45;display:flex;align-items:center;justify-content:space-between;gap:10px}
#np-perm:empty{display:none}
#np-perm button{flex:none;padding:6px 12px;border:0;border-radius:8px;background:#8257e6;color:#fff;font:600 12px 'Inter',sans-serif;cursor:pointer}
#np-list{overflow-y:auto;-webkit-overflow-scrolling:touch}
.np-empty{padding:28px 14px;text-align:center;font-size:13px;color:#8b8b9a}
.np-item{position:relative;padding:12px 14px 12px 16px;border-bottom:1px solid #20202a}
.np-item:last-child{border-bottom:0}
.np-item.unread::before{content:"";position:absolute;left:6px;top:18px;width:6px;height:6px;border-radius:50%;background:#8257e6}
.np-title{font-size:13px;font-weight:600;margin-bottom:3px}
.np-text{font-size:13px;line-height:1.5;color:#c9c9d4;white-space:pre-wrap;word-break:break-word}
.np-meta{margin-top:6px;font-size:11px;color:#6f6f7e;display:flex;align-items:center;justify-content:space-between;gap:8px}
.np-del{padding:3px 8px;border:1px solid #3a2a2e;border-radius:6px;background:transparent;color:#f87171;font:500 11px 'Inter',sans-serif;cursor:pointer}
#notif-banner{position:fixed;top:max(10px,env(safe-area-inset-top));left:50%;z-index:100000;width:min(440px,calc(100vw - 20px));display:flex;align-items:flex-start;gap:12px;padding:12px 8px 12px 14px;background:rgba(19,19,26,.97);border:1px solid #2f2f40;border-left:3px solid #8257e6;border-radius:12px;color:#ececf1;font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);transform:translate(-50%,-160%);opacity:0;pointer-events:none;transition:transform .32s cubic-bezier(.2,.8,.2,1),opacity .25s;cursor:pointer;box-sizing:border-box}
#notif-banner.show{transform:translate(-50%,0);opacity:1;pointer-events:auto}
#notif-banner .nb-icon{flex:none;width:32px;height:32px;border-radius:8px;background:rgba(130,87,230,.18);color:#c8b6ff;display:flex;align-items:center;justify-content:center}
#notif-banner .nb-icon svg{width:18px;height:18px}
#notif-banner .nb-body{flex:1;min-width:0}
#notif-banner .nb-title{font-size:13px;font-weight:600;margin-bottom:2px}
#notif-banner .nb-text{font-size:13px;line-height:1.45;color:#c9c9d4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
#notif-banner .nb-close{flex:none;width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:#8b8b9a;font-size:20px;line-height:1;cursor:pointer}
#notif-permit{position:fixed;inset:0;z-index:100002;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif}
#notif-permit .np-card{width:min(360px,calc(100vw - 32px));padding:22px;background:#13131a;border:1px solid #262632;border-radius:16px;color:#ececf1}
#notif-permit h3{margin:0 0 6px;font-size:17px;font-weight:600}
#notif-permit p{margin:0 0 18px;font-size:13px;line-height:1.55;color:#9a9aa8}
#notif-permit .np-actions{display:flex;gap:10px}
#notif-permit button{flex:1;height:42px;border-radius:10px;font:600 14px 'Inter',sans-serif;cursor:pointer}
#notif-permit .np-allow{border:0;background:#8257e6;color:#fff}
#notif-permit .np-later{border:1px solid #2f2f40;background:transparent;color:#c9c9d4}
#admin-panel{max-height:calc(100vh - 70px);overflow-y:auto}
`;
  document.head.appendChild(st);
}

function notifTimeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'baru saja';
  if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
  if (s < 7 * 86400) return Math.floor(s / 86400) + ' hari lalu';
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function playNotifTone() {
  try {
    ensureAudioContext();
    const t = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1175, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.3);
  } catch (e) {}
}

// ----- Banner di atas layar -----
function queueNotifBanner(item) {
  notifBannerQueue.push(item);
  if (!notifBannerBusy) showNextNotifBanner();
}
function showNextNotifBanner() {
  const el = document.getElementById('notif-banner');
  const item = notifBannerQueue.shift();
  if (!el || !item) { notifBannerBusy = false; return; }
  notifBannerBusy = true;
  el.querySelector('.nb-title').textContent = item.title || 'Informasi dari admin';
  el.querySelector('.nb-text').textContent = item.text;
  el.classList.add('show');
  playNotifTone();
  clearTimeout(notifBannerTimer);
  notifBannerTimer = setTimeout(hideNotifBanner, 6500);
}
function hideNotifBanner() {
  clearTimeout(notifBannerTimer);
  const el = document.getElementById('notif-banner');
  if (el) el.classList.remove('show');
  setTimeout(showNextNotifBanner, 380);
}

// ----- Notifikasi sistem browser -----
async function showSystemNotification(item) {
  if (!notifSupported() || Notification.permission !== 'granted') return;
  const title = item.title || 'Parkour 3D';
  const opts = { body: item.text, tag: 'parkour-info-' + item.id };
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg && reg.active && reg.showNotification) { await reg.showNotification(title, opts); return; }
  } catch (e) {}
  try { new Notification(title, opts); } catch (e) {}
}
async function requestNotifPermission() {
  if (!notifSupported()) { showToast('Browser ini belum mendukung notifikasi sistem', 2800); return 'unsupported'; }
  let result;
  try { result = await Notification.requestPermission(); } catch (e) { result = Notification.permission; }
  renderNotifPermRow();
  if (result === 'granted') showToast('Notifikasi diaktifkan', 2200);
  else if (result === 'denied') showToast('Notifikasi diblokir. Izinkan lewat pengaturan situs di browser.', 3800);
  return result;
}
function maybeAskNotifPermission() {
  if (!notifSupported() || Notification.permission !== 'default' || window.__notifAsked) return;
  window.__notifAsked = true;
  const d = document.getElementById('notif-permit');
  if (d) d.style.display = 'flex';
}
function renderNotifPermRow() {
  const row = document.getElementById('np-perm');
  if (!row) return;
  row.textContent = '';
  if (!notifSupported()) { row.textContent = 'Browser ini belum mendukung notifikasi sistem. Informasi tetap muncul di dalam game.'; return; }
  const p = Notification.permission;
  if (p === 'granted') { row.textContent = 'Notifikasi sistem aktif.'; return; }
  if (p === 'denied') { row.textContent = 'Notifikasi diblokir di browser. Buka pengaturan situs untuk mengizinkannya.'; return; }
  const span = document.createElement('span'); span.textContent = 'Notifikasi sistem belum aktif.';
  const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Aktifkan';
  btn.addEventListener('click', () => requestNotifPermission());
  row.append(span, btn);
}

// ----- Panel lonceng -----
function updateNotifBadge() {
  const unread = notifItems.filter(i => i.createdAt > notifSeenAt).length;
  const badge = document.getElementById('notif-badge'), bell = document.getElementById('btn-notif');
  if (badge) { badge.textContent = unread > 9 ? '9+' : String(unread); badge.style.display = unread ? 'block' : 'none'; }
  if (bell) {
    const had = bell.classList.contains('has-unread');
    bell.classList.toggle('has-unread', unread > 0);
    if (unread > 0 && !had) { void bell.offsetWidth; }
  }
}
function notifMarkRead() {
  const latest = notifItems.reduce((m, i) => Math.max(m, i.createdAt || 0), 0);
  if (latest > notifSeenAt) {
    notifSeenAt = latest;
    try { localStorage.setItem(notifSeenKey(), String(latest)); } catch (e) {}
  }
  updateNotifBadge();
}
function renderNotifList(prevSeenAt) {
  const list = document.getElementById('np-list');
  if (!list) return;
  list.textContent = '';
  if (!notifItems.length) {
    const e = document.createElement('div'); e.className = 'np-empty'; e.textContent = 'Belum ada informasi.';
    list.appendChild(e); return;
  }
  const admin = isAdminUser();
  notifItems.forEach(it => {
    const row = document.createElement('article');
    row.className = 'np-item' + (it.createdAt > prevSeenAt ? ' unread' : '');
    if (it.title) { const t = document.createElement('div'); t.className = 'np-title'; t.textContent = it.title; row.appendChild(t); }
    const tx = document.createElement('div'); tx.className = 'np-text'; tx.textContent = it.text; row.appendChild(tx);
    const meta = document.createElement('div'); meta.className = 'np-meta';
    const who = document.createElement('span'); who.textContent = it.from + ' \u00b7 ' + notifTimeAgo(it.createdAt); meta.appendChild(who);
    if (admin) {
      const del = document.createElement('button'); del.type = 'button'; del.className = 'np-del'; del.textContent = 'Hapus';
      del.addEventListener('click', async () => {
        del.disabled = true;
        try {
          const res = await fetch(`${FIREBASE_URL}announcements/${it.id}.json`, { method: 'DELETE' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          notifItems = notifItems.filter(x => x.id !== it.id);
          renderNotifList(notifSeenAt); updateNotifBadge();
          showToast('Informasi dihapus', 1800);
        } catch (e) { del.disabled = false; showToast('Gagal menghapus informasi', 2200); }
      });
      meta.appendChild(del);
    }
    row.appendChild(meta);
    list.appendChild(row);
  });
}
function toggleNotifPanel(force) {
  const p = document.getElementById('notif-panel');
  if (!p) return;
  const open = typeof force === 'boolean' ? force : p.style.display !== 'flex';
  if (open) {
    const prev = notifSeenAt;
    renderNotifPermRow(); renderNotifList(prev);
    p.style.display = 'flex';
    notifMarkRead();
  } else p.style.display = 'none';
}

// ----- Ambil informasi dari Firebase -----
async function pollAnnouncements() {
  if (notifPollBusy || !accountKey()) return;
  notifPollBusy = true;
  try {
    const res = await fetch(`${FIREBASE_URL}announcements.json?orderBy="$key"&limitToLast=${NOTIF_MAX}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json() || {};
    const items = Object.entries(data)
      .filter(([, v]) => v && typeof v.text === 'string' && v.text.trim())
      .map(([id, v]) => ({ id, title: String(v.title || ''), text: String(v.text), from: String(v.from || 'Admin'), createdAt: Number(v.createdAt) || 0 }))
      .sort((a, b) => b.createdAt - a.createdAt);
    const first = notifKnownIds === null;
    if (first) {
      let stored = null;
      try { stored = localStorage.getItem(notifSeenKey()); } catch (e) {}
      if (stored === null) {
        // Akun baru di perangkat ini: informasi lama dianggap sudah dibaca.
        notifSeenAt = items.length ? items[0].createdAt : 0;
        try { localStorage.setItem(notifSeenKey(), String(notifSeenAt)); } catch (e) {}
      } else notifSeenAt = Number(stored) || 0;
      notifKnownIds = new Set();
    }
    const fresh = items.filter(i => !notifKnownIds.has(i.id));
    items.forEach(i => notifKnownIds.add(i.id));
    notifItems = items;
    const panelOpen = document.getElementById('notif-panel')?.style.display === 'flex';
    if (first) {
      const unread = items.find(i => i.createdAt > notifSeenAt);
      if (unread && !panelOpen) queueNotifBanner(unread);
    } else {
      fresh.sort((a, b) => a.createdAt - b.createdAt).forEach(i => {
        if (!panelOpen) queueNotifBanner(i);
        if (document.hidden) showSystemNotification(i);
      });
    }
    if (panelOpen) { renderNotifList(notifSeenAt); notifMarkRead(); }
    else updateNotifBadge();
  } catch (e) { console.warn('Polling informasi:', e); }
  finally { notifPollBusy = false; }
}

function initNotificationCenter() {
  if (window.__notifInit) return;
  window.__notifInit = true;
  injectNotifStyles();

  const bell = document.createElement('button');
  bell.id = 'btn-notif'; bell.type = 'button'; bell.title = 'Informasi'; bell.setAttribute('aria-label', 'Informasi');
  bell.innerHTML = NOTIF_BELL_SVG + '<span id="notif-badge"></span>';
  bell.style.display = 'flex';
  bell.addEventListener('click', () => toggleNotifPanel());

  const panel = document.createElement('section'); panel.id = 'notif-panel';
  panel.innerHTML = '<div class="np-head"><span>Informasi</span><button type="button" class="np-close" aria-label="Tutup">&times;</button></div><div id="np-perm"></div><div id="np-list"></div>';
  panel.querySelector('.np-close').addEventListener('click', () => toggleNotifPanel(false));

  const banner = document.createElement('div'); banner.id = 'notif-banner';
  banner.innerHTML = '<div class="nb-icon">' + NOTIF_BELL_SVG + '</div><div class="nb-body"><div class="nb-title"></div><div class="nb-text"></div></div><button type="button" class="nb-close" aria-label="Tutup">&times;</button>';
  banner.addEventListener('click', (e) => {
    hideNotifBanner();
    if (!e.target.closest('.nb-close')) toggleNotifPanel(true);
  });

  const permit = document.createElement('div'); permit.id = 'notif-permit';
  permit.innerHTML = '<div class="np-card"><h3>Aktifkan notifikasi</h3><p>Izinkan notifikasi agar kamu tidak ketinggalan informasi dan pengumuman dari admin.</p><div class="np-actions"><button type="button" class="np-later">Nanti</button><button type="button" class="np-allow">Izinkan</button></div></div>';
  permit.querySelector('.np-later').addEventListener('click', () => { permit.style.display = 'none'; });
  permit.querySelector('.np-allow').addEventListener('click', async () => { permit.style.display = 'none'; await requestNotifPermission(); });

  document.body.append(bell, panel, banner, permit);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

  pollAnnouncements();
  setInterval(pollAnnouncements, NOTIF_POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollAnnouncements(); });
  setTimeout(maybeAskNotifPermission, 1500);
}

// ----- Form admin: ketik & kirim informasi -----
function setupAdminAnnouncementComposer(panel) {
  injectNotifStyles();
  panel.insertAdjacentHTML('beforeend',
    '<hr style="width:100%;border-color:#46516b"><b>INFORMASI UNTUK PEMAIN</b>' +
    '<label>Judul (opsional)<input id="ad-info-title" type="text" maxlength="40" placeholder="Contoh: Update baru" autocomplete="off" style="width:100%;padding:7px;border-radius:6px"></label>' +
    '<label>Isi informasi<textarea id="ad-info-text" rows="3" maxlength="200" placeholder="Ketik informasi untuk semua pemain" style="width:100%;padding:7px;border-radius:6px;resize:vertical;font-family:inherit"></textarea></label>' +
    '<div id="ad-info-count" style="font-size:11px;color:#9aa4bd;text-align:right">0/200</div>' +
    '<button id="ad-info-send" type="button">Kirim informasi</button>');
  const textEl = document.getElementById('ad-info-text');
  textEl.addEventListener('input', () => { document.getElementById('ad-info-count').textContent = textEl.value.length + '/200'; });
  document.getElementById('ad-info-send').addEventListener('click', sendAdminAnnouncement);
}
async function sendAdminAnnouncement() {
  if (!isAdminUser()) return;
  const titleEl = document.getElementById('ad-info-title'), textEl = document.getElementById('ad-info-text'), btn = document.getElementById('ad-info-send');
  const title = titleEl.value.trim().slice(0, 40), text = textEl.value.trim().slice(0, 200);
  if (!text) { showToast('Isi informasi tidak boleh kosong', 2000); return; }
  btn.disabled = true;
  try {
    const res = await fetch(`${FIREBASE_URL}announcements.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, text, from: String(playerData.username || 'Admin'), createdAt: { '.sv': 'timestamp' } })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    titleEl.value = ''; textEl.value = '';
    document.getElementById('ad-info-count').textContent = '0/200';
    showToast('Informasi terkirim ke semua pemain', 2200);
    pollAnnouncements();
  } catch (e) { showToast('Gagal mengirim informasi. Cek Rules Firebase.', 3000); }
  finally { btn.disabled = false; }
}
