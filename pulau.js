// Map PULAU: geometri Three.js + konfigurasi lintasan dari Lua (Fengari).
// Jika runtime Lua tidak tersedia, map tetap dibuat dari konfigurasi cadangan.

const FALLBACK = {
  platforms: [
    {x:0,y:0,z:-4,w:9,d:8,kind:'start'},
    {x:0,y:.4,z:-13,w:5,d:5},{x:-3,y:.8,z:-21,w:4,d:4},{x:2,y:1.2,z:-29,w:4,d:4},
    {x:5,y:1.7,z:-37,w:3.5,d:4},{x:1,y:2.2,z:-45,w:3.5,d:3.5,checkpoint:true},
    {x:-4,y:2.8,z:-53,w:3.5,d:3.5},{x:-5,y:3.4,z:-61,w:3,d:4},{x:0,y:4,z:-69,w:3.5,d:3.5},
    {x:5,y:4.7,z:-77,w:3.5,d:3.5,checkpoint:true},{x:4,y:5.4,z:-85,w:3,d:3.5},
    {x:-1,y:6.1,z:-93,w:3.5,d:3.5},{x:-4,y:6.8,z:-101,w:3.5,d:3.5},
    {x:0,y:7.5,z:-109,w:4,d:4},{x:0,y:8,z:-118,w:10,d:9,kind:'finish'}
  ],
  islands: [
    {x:0,y:-4.9,z:-18,sx:12,sy:3.5,sz:13},{x:4,y:-5.2,z:-47,sx:10,sy:3.2,sz:12},
    {x:-2,y:-5.1,z:-79,sx:11,sy:3.5,sz:13},{x:0,y:-5.3,z:-112,sx:13,sy:3.8,sz:12},
    {x:-34,y:-5.8,z:-35,sx:8,sy:2.6,sz:9},{x:35,y:-5.8,z:-88,sx:9,sy:2.8,sz:10}
  ],
  palms: [[-10,-4.8,-12,1],[9,-4.8,-20,1.1],[-8,-4.8,-34,.9],[12,-4.8,-48,1.1],[-12,-4.8,-57,1],[8,-4.8,-72,1.1],[-11,-4.8,-84,1],[10,-4.8,-98,.9],[-8,-4.8,-112,1.1],[-34,-5,-35,1.2],[35,-5,-88,1.2]]
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.fengari?.load) return resolve(window.fengari);
    const existing = document.querySelector('script[data-pulau-fengari]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.fengari), {once:true});
      existing.addEventListener('error', reject, {once:true});
      return;
    }
    const script = document.createElement('script');
    script.src = src; script.async = true; script.dataset.pulauFengari = '1';
    script.onload = () => window.fengari?.load ? resolve(window.fengari) : reject(new Error('Fengari tidak tersedia'));
    script.onerror = () => reject(new Error('Gagal memuat runtime Lua'));
    document.head.appendChild(script);
  });
}

function luaField(table, key, fallback = undefined) {
  try { return table && typeof table.get === 'function' && table.has(key) ? table.get(key) : fallback; }
  catch (_) { return fallback; }
}
function luaArray(table, convert) {
  const out = [];
  if (!table || typeof table.has !== 'function') return out;
  for (let i = 1; i <= 256 && table.has(i); i++) out.push(convert(table.get(i)));
  return out;
}
function luaObject(table, keys) {
  const out = {};
  for (const key of keys) out[key] = luaField(table, key);
  return out;
}
function parseLuaConfig(luaTable) {
  const platforms = luaArray(luaField(luaTable, 'platforms'), t => luaObject(t, ['x','y','z','w','d','kind','checkpoint']));
  const islands = luaArray(luaField(luaTable, 'islands'), t => luaObject(t, ['x','y','z','sx','sy','sz']));
  const palms = luaArray(luaField(luaTable, 'palms'), t => luaArray(t, v => v));
  if (!platforms.length) throw new Error('pulau.lua tidak memiliki platforms');
  return { platforms, islands, palms };
}
async function readLuaConfig() {
  const fengari = await loadScript('https://cdn.jsdelivr.net/npm/fengari-web@0.1.4/dist/fengari-web.js');
  const response = await fetch(new URL('./pulau.lua', import.meta.url));
  if (!response.ok) throw new Error('pulau.lua tidak dapat dibaca');
  const source = await response.text();
  const luaChunk = fengari.load(source, '@pulau.lua');
  if (typeof luaChunk !== 'function') throw new Error('Lua gagal dikompilasi');
  return parseLuaConfig(luaChunk());
}

export function buildPulauWorld(THREE, scene) {
  const group = new THREE.Group(); group.name = 'PULAU_WORLD'; group.visible = false; scene.add(group);
  const world = { group, platforms: [], hazards: [], guards: [], FIN_Y: 8.25, WIN: {x:0,y:8.25,z:-118}, fallLimit: -9, water: null, update: null,
    applyEnvironment(target) { target.background = new THREE.Color(0x78c9ef); target.fog = new THREE.Fog(0x9bdcf0, 85, 260); },
    reset() { for (const p of this.platforms) { p.isFallen = false; p.mesh.visible = true; p.checkpointActivated = false; } }
  };
  const mats = {
    sand: new THREE.MeshStandardMaterial({color:0xe8cf91, roughness:1}),
    grass: new THREE.MeshStandardMaterial({color:0x4d9b52, roughness:1}),
    rock: new THREE.MeshStandardMaterial({color:0x68736d, roughness:1}),
    path: new THREE.MeshStandardMaterial({color:0x9b754a, roughness:.9}),
    start: new THREE.MeshStandardMaterial({color:0x35c9a0, emissive:0x075c43, emissiveIntensity:.35}),
    checkpoint: new THREE.MeshStandardMaterial({color:0x25e0a0, emissive:0x087f56, emissiveIntensity:.5}),
    finish: new THREE.MeshStandardMaterial({color:0xffd34f, emissive:0x8a4d00, emissiveIntensity:.35}),
    palm: new THREE.MeshStandardMaterial({color:0x8c5a31, roughness:1}),
    leaf: new THREE.MeshStandardMaterial({color:0x238b4a, roughness:.9}),
    foam: new THREE.MeshStandardMaterial({color:0xd7fbff, roughness:.3, transparent:true, opacity:.72})
  };
  const oceanGeo = new THREE.PlaneGeometry(420, 420, 1, 1);
  const oceanMat = new THREE.MeshStandardMaterial({color:0x20a9c7, roughness:.24, metalness:.12, transparent:true, opacity:.92});
  const ocean = new THREE.Mesh(oceanGeo, oceanMat); ocean.rotation.x = -Math.PI/2; ocean.position.set(0,-7.2,-58); ocean.receiveShadow = true; group.add(ocean); world.water = ocean;
  const addMesh = (geo, mat, x,y,z, parent=group) => { const m = new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const addPalm = (x,y,z,scale=1) => {
    const palm = new THREE.Group(); palm.position.set(x,y,z); palm.scale.setScalar(scale); group.add(palm);
    const trunk = addMesh(new THREE.CylinderGeometry(.22,.34,5.1,7), mats.palm, 0,2.55,0,palm); trunk.rotation.z = -.12;
    const crown = new THREE.Group(); crown.position.set(-.28,5.0,0); palm.add(crown);
    for (let i=0;i<7;i++) { const leaf = addMesh(new THREE.ConeGeometry(.42,4.4,5), mats.leaf, 0,-1.7,0,crown); leaf.rotation.z = Math.PI/2 + i*Math.PI*2/7; leaf.rotation.x = Math.sin(i*2.3)*.45; leaf.scale.set(1,1,.48); }
    addMesh(new THREE.SphereGeometry(.48,8,6), mats.leaf, 0,0,0,crown);
  };
  const buildDecor = config => {
    // Bersihkan objek map lama, lalu bangun ulang dari tabel Lua.
    while (group.children.length) group.remove(group.children[0]);
    world.platforms.length = 0;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(420,420), oceanMat); water.rotation.x=-Math.PI/2; water.position.set(0,-7.2,-58); group.add(water); world.water=water;
    // Pulau-pulau kecil di bawah lintasan.
    for (const island of config.islands || FALLBACK.islands) {
      const rock = addMesh(new THREE.SphereGeometry(1,12,8), mats.rock, island.x,island.y,island.z);
      rock.scale.set(island.sx,island.sy,island.sz);
      const sand = addMesh(new THREE.SphereGeometry(1,16,10), mats.sand, island.x,island.y+island.sy*.48,island.z);
      sand.scale.set(island.sx*.92,island.sy*.36,island.sz*.92);
      const grass = addMesh(new THREE.SphereGeometry(1,14,8), mats.grass, island.x,island.y+island.sy*.68,island.z);
      grass.scale.set(island.sx*.78,island.sy*.18,island.sz*.78);
    }
    // Dekorasi pantai dan pohon kelapa.
    for (const palm of config.palms || FALLBACK.palms) addPalm(Number(palm[0]),Number(palm[1]),Number(palm[2]),Number(palm[3]||1));
    // Platform lintasan dibaca dari pulau.lua dan didaftarkan ke collision utama.
    for (const data of config.platforms) {
      const width=Number(data.w)||3, depth=Number(data.d)||3, y=Number(data.y)||0;
      const mat = data.kind==='start' ? mats.start : data.kind==='finish' ? mats.finish : data.checkpoint ? mats.checkpoint : mats.path;
      const mesh = addMesh(new THREE.BoxGeometry(width,.5,depth),mat,Number(data.x)||0,y,Number(data.z)||0);
      mesh.userData.pulauPlatform = true;
      world.platforms.push({mesh,width,depth,hh:.25,type:'static',startX:mesh.position.x,startY:y,startZ:mesh.position.z,range:0,speed:0,phase:0,isFallen:false,checkpoint:!!data.checkpoint,checkpointActivated:false});
      if (data.kind==='start') {
        const sign = addMesh(new THREE.BoxGeometry(width*.72,1.1,.16), mats.start, 0,y+1.0,mesh.position.z-depth*.42);
        sign.material = new THREE.MeshStandardMaterial({color:0x073c34,emissive:0x0a7a61,emissiveIntensity:.25});
      }
      if (data.kind==='finish') {
        const poleMat = new THREE.MeshStandardMaterial({color:0xf7f4dc,metalness:.25,roughness:.4});
        addMesh(new THREE.CylinderGeometry(.09,.09,5,8),poleMat,-width*.43,y+2.5,mesh.position.z);
        addMesh(new THREE.CylinderGeometry(.09,.09,5,8),poleMat,width*.43,y+2.5,mesh.position.z);
        const banner = addMesh(new THREE.BoxGeometry(width*.9,1.2,.12),mats.finish,0,y+4.2,mesh.position.z);
        banner.userData.finishBanner = true;
      }
    }
    // Batu karang dekoratif di sisi arena.
    for (let i=0;i<24;i++) { const z=-7-i*4.7, side=i%2?1:-1, x=side*(12+(i%3)*2); const b=addMesh(new THREE.DodecahedronGeometry(1,0),mats.rock,x,-5.4,z); b.scale.set(1.3,1.1,1.6); }
  };
  buildDecor(FALLBACK);
  world.ready = readLuaConfig().then(config => { buildDecor(config); return true; }).catch(error => { console.warn('[PULAU] Lua tidak dimuat, memakai konfigurasi cadangan:',error); return false; });
  world.update = (time) => { if (world.water) world.water.position.y = -7.2 + Math.sin(time*.75)*.08; };
  world.applyEnvironment(scene);
  return world;
}
