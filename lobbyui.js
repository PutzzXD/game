// ============================================================
//  LOBBYUI.JS — tema tombol & HUD lobby
//  Arah desain: "sticker arcade" ala game party (Stumble/Fall Guys):
//  warna solid (tanpa gradasi/neon/glow), garis tepi tebal gelap,
//  bayangan keras di bawah (tombol terasa bisa ditekan), font bulat tebal,
//  ikon SVG garis (bukan emoji), tiap tombol punya warna identitas sendiri.
//
//  Cara pasang: di main.js cukup `import './lobbyui.js';`
//  File ini TIDAK mengubah posisi/ukuran tombol dari index.html — hanya
//  tampilan (warna, bentuk, ikon, font), jadi layout lama tetap aman.
// ============================================================

const INK = '#1b1233';   // warna garis tepi & bayangan keras

// ---------- Ikon SVG (24x24, garis, mengikuti warna teks) ----------
const P = (d) => `<path d="${d}"/>`;
const ICONS = {
  shop: P('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z') + P('M3 6h18') + P('M16 10a4 4 0 0 1-8 0'),
  shirt: P('M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z'),
  music: P('M9 18V5l12-2v13') + '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  exit: P('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4') + P('m16 17 5-5-5-5') + P('M21 12H9'),
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  user: P('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2') + '<circle cx="12" cy="7" r="4"/>',
  users: P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2') + '<circle cx="9" cy="7" r="4"/>' + P('M22 21v-2a4 4 0 0 0-3-3.87') + P('M16 3.13a4 4 0 0 1 0 7.75'),
  push: P('m6 17 5-5-5-5') + P('m13 17 5-5-5-5'),
  snow: P('M2 12h20') + P('M12 2v20') + P('m20 16-4-4 4-4') + P('m4 8 4 4-4 4') + P('m16 4-4 4-4-4') + P('m8 20 4-4 4 4'),
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/>' + P('m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7')
};
const svg = (name) => `<svg class="ui-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// id tombol -> { ikon, warna latar, warna teks }
const SPEC = {
  'btn-start-game':  { ic: 'play',   bg: '#ffc21a', fg: INK,       big: true },
  'btn-shop':        { ic: 'shop',   bg: '#3ddc84', fg: INK },
  'btn-vault':       { ic: 'shirt',  bg: '#4da3ff', fg: INK },
  'btn-music':       { ic: 'music',  bg: '#ff6b9a', fg: INK },
  'btn-exit-lobby':  { ic: 'exit',   bg: '#ff5a4d', fg: '#fff' },
  'btn-leave-group': { ic: 'exit',   bg: '#ff5a4d', fg: '#fff' },
  'btn-missions':    { ic: 'target', bg: '#ffb347', fg: INK },
  'btn-push':        { ic: 'push',   bg: '#ff9f1a', fg: INK },
  'btn-notif':       { bg: '#ffffff', fg: INK },                 // ikon lonceng sudah SVG
  'btn-freeze':      { bg: '#7fd6ff', fg: INK, keepImage: true }, // pakai gambar es
  'ps-launcher':     { ic: 'users',  bg: '#8ad7ff', fg: INK },
  'ps-invite-launcher': { ic: 'mail', bg: '#c6f06b', fg: INK }
};

function buildCss() {
  let css = `
:root{--ui-ink:${INK};--ui-cream:#fff4d6}
/* dasar semua tombol bertema */
html body .ui-btn{
  background-image:none !important; background-color:var(--ui-bg) !important; color:var(--ui-fg) !important;
  border:3px solid var(--ui-ink) !important; border-radius:14px !important;
  box-shadow:0 5px 0 var(--ui-ink), inset 0 3px 0 rgba(255,255,255,.38) !important;
  text-shadow:none !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important;
  font-family:'Baloo 2','Trebuchet MS',system-ui,sans-serif !important; font-weight:800 !important;
  letter-spacing:.04em; text-transform:uppercase; font-synthesis:none;
  transition:transform .07s ease, box-shadow .07s ease !important; -webkit-tap-highlight-color:transparent;
  animation:none !important; cursor:pointer;
}
html body .ui-btn:active{transform:translateY(4px) !important; box-shadow:0 1px 0 var(--ui-ink), inset 0 2px 0 rgba(255,255,255,.3) !important}
html body .ui-btn.ui-has-ic{display:inline-flex; align-items:center; justify-content:center; gap:.45em}
html body .ui-btn .ui-ic{width:1.25em; height:1.25em; flex:none; stroke-width:2.8}
html body .ui-btn.ui-icon-only{padding:0 !important}
html body .ui-btn.ui-icon-only .ui-ic{width:22px; height:22px}
html body #btn-music.ui-btn{min-width:44px; min-height:44px}
html body #btn-notif .ui-ic,html body #btn-missions .ui-ic,html body #btn-leave-group .ui-ic{width:18px; height:18px}
html body .ui-btn.ui-big{font-size:clamp(20px,5.2vw,28px) !important; letter-spacing:.06em}
html body .ui-btn.ui-big .ui-ic{width:1.1em; height:1.1em}
html body .ui-btn[disabled]{filter:grayscale(.85) brightness(.9); opacity:.75}

/* tombol bulat kecil (HUD): jadi kotak tumpul biar tidak seragam "bulat semua" */
html body #btn-notif,html body #btn-missions,html body #btn-leave-group{border-radius:11px !important}
html body #btn-freeze,html body #btn-push{border-radius:50% !important}
html body #btn-freeze{background-size:cover !important; background-position:center !important}
html body #btn-notif svg{width:18px;height:18px;stroke-width:2.6}

/* kartu profil: kartu krem, teks gelap */
html body #btn-profile{
  background-image:none !important; background-color:var(--ui-cream) !important; color:var(--ui-ink) !important;
  border:3px solid var(--ui-ink) !important; border-radius:14px !important;
  box-shadow:0 4px 0 var(--ui-ink) !important; text-shadow:none !important;
  backdrop-filter:none !important; -webkit-backdrop-filter:none !important;
  font-family:'Baloo 2','Trebuchet MS',system-ui,sans-serif !important; font-weight:800 !important;
}
html body #btn-profile *{color:var(--ui-ink) !important; text-shadow:none !important}

/* tombol-tombol umum di toko, lemari, panel room */
html body .shop-buy-btn,html body #rp-start,html body #rp-qstart{
  background-image:none !important; background-color:#3ddc84 !important; color:var(--ui-ink) !important;
  border:3px solid var(--ui-ink) !important; border-radius:12px !important;
  box-shadow:0 4px 0 var(--ui-ink), inset 0 3px 0 rgba(255,255,255,.35) !important; text-shadow:none !important;
  font-family:'Baloo 2','Trebuchet MS',system-ui,sans-serif !important; font-weight:800 !important; text-transform:uppercase; letter-spacing:.03em;
}
html body .shop-buy-btn:active,html body #rp-start:active,html body #rp-qstart:active{transform:translateY(3px); box-shadow:0 1px 0 var(--ui-ink) !important}
html body .shop-buy-btn:disabled{background-color:#b9b4c9 !important; opacity:.85}
html body .shop-tab-btn,html body .vault-tab-btn{
  background-image:none !important; background-color:#efe6ff !important; color:var(--ui-ink) !important;
  border:2px solid var(--ui-ink) !important; border-radius:10px !important; box-shadow:0 3px 0 var(--ui-ink) !important; text-shadow:none !important;
  font-family:'Baloo 2','Trebuchet MS',system-ui,sans-serif !important; font-weight:800 !important;
}
html body .shop-tab-btn.active,html body .vault-tab-btn.active{background-color:#ffc21a !important; transform:translateY(2px); box-shadow:0 1px 0 var(--ui-ink) !important}
`;
  // warna identitas per tombol
  for (const [id, s] of Object.entries(SPEC)) {
    css += `html body #${id}.ui-btn{--ui-bg:${s.bg};--ui-fg:${s.fg}}\n`;
  }
  return css;
}

function stripEmoji(t) { return String(t || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim(); }

function styleButton(el, spec) {
  if (!el || el.dataset.uiDone === '1') return;
  el.dataset.uiDone = '1';
  el.classList.add('ui-btn');
  if (spec.big) el.classList.add('ui-big');
  if (spec.ic) {
    const label = stripEmoji(el.textContent);
    el.textContent = '';
    el.insertAdjacentHTML('beforeend', svg(spec.ic));
    if (label) { const sp = document.createElement('span'); sp.className = 'ui-lb'; sp.textContent = label; el.appendChild(sp); }
    else el.classList.add('ui-icon-only');
    el.classList.add('ui-has-ic');
  }
}

function applyAll() {
  for (const [id, spec] of Object.entries(SPEC)) styleButton(document.getElementById(id), spec);
  // avatar profil: ganti emoji orang dengan ikon
  const av = document.getElementById('profile-avatar-crown');
  if (av && av.dataset.uiDone !== '1') { av.dataset.uiDone = '1'; av.innerHTML = svg('user'); av.style.cssText += ';display:inline-flex;width:1.3em;height:1.3em'; }
}

function init() {
  if (window.__lobbyUiInit) return; window.__lobbyUiInit = true;
  const font = document.createElement('link');
  font.rel = 'stylesheet'; font.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&display=swap';
  document.head.appendChild(font);
  const st = document.createElement('style'); st.id = 'lobby-ui-css'; st.textContent = buildCss(); document.head.appendChild(st);
  applyAll();
  // Tombol yang dibuat belakangan (bel, misi, keluar grup, dorong, freeze) ikut ditema otomatis.
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; applyAll(); }); })
    .observe(document.body, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}
