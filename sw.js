// ==========================================
// SERVICE WORKER - PARKOUR 3D
// ==========================================

// ⚠️ PENTING: Naikkan angka versi ini (v1 -> v2 -> v3) SETIAP KALI kamu update game!
const CACHE_NAME = 'parkour-3d-v1'; 

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './manifest.json',
  'https://unpkg.com/three@0.160.0/build/three.module.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js'
];

// 1. INSTALL: Simpan file ke cache & paksa langsung aktif
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Paksa Service Worker baru mengambil alih seketika
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. ACTIVATE: Hapus cache versi lama yang bikin game jadi basi
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Menghapus cache lama:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim(); // Ambil kendali semua tab yang sedang terbuka
});

// 3. FETCH: Strategi "Network First" (Cek internet dulu, baru cache)
self.addEventListener('fetch', (e) => {
  // Abaikan request ke Firebase atau API luar agar tidak error
  if (e.request.url.includes('firebasedatabase.app') || e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Jika ada internet, ambil versi terbaru dan simpan ke cache
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Jika tidak ada internet (offline), ambil dari cache HP
        return caches.match(e.request);
      })
  );
});