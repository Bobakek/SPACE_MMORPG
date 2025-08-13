const socket = io();
let playerId;
socket.on('connect', () => { playerId = socket.id; });

const hud = document.getElementById('hud');
const hudText = document.getElementById('hudText');
const healthFill = document.getElementById('healthFill');
const menu = document.getElementById('menu');
const menuToggle = document.getElementById('menuToggle');
const shipInfo = document.getElementById('ship-info');
const galacticMap = document.getElementById('galactic-map');
const market = document.getElementById('market');
const targets = document.getElementById('targets');

const mapCanvas = document.createElement('canvas');
mapCanvas.width = 200;
mapCanvas.height = 200;
galacticMap.appendChild(mapCanvas);
const mapCtx = mapCanvas.getContext('2d');

let health = 100;
function updateHealth(){
  healthFill.style.width = health + '%';
}
updateHealth();

function toggleMenu(){
  menu.classList.toggle('hidden');
  if(!menu.classList.contains('hidden')){
    document.exitPointerLock();
    loadMarket();
  }else{
    renderer.domElement.requestPointerLock();
  }
}
menuToggle.addEventListener('click', toggleMenu);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// generate starfield
const starGeometry = new THREE.BufferGeometry();
const starCount = 1000;
const starVertices = [];
for (let i = 0; i < starCount; i++) {
  const x = THREE.MathUtils.randFloatSpread(200);
  const y = THREE.MathUtils.randFloatSpread(200);
  const z = THREE.MathUtils.randFloatSpread(200);
  starVertices.push(x, y, z);
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// optional starfield background
new THREE.TextureLoader().load(
  'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/galaxy_starfield.png',
  texture => {
    scene.background = texture;
  }
);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
const cameraOffset = new THREE.Vector3(0, 3, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0x404040);
scene.add(ambient);
const directional = new THREE.DirectionalLight(0xffffff, 1);
directional.position.set(10, 10, 10);
scene.add(directional);

const geometry = new THREE.BoxGeometry(2,1,4);
const material = new THREE.MeshStandardMaterial({color:0x2194ce});
const ship = new THREE.Mesh(geometry, material);
scene.add(ship);

const otherShips = {};
function addOtherShip(id, state){
  const mesh = new THREE.Mesh(geometry.clone(), new THREE.MeshStandardMaterial({color:0xff0000}));
  scene.add(mesh);
  otherShips[id] = mesh;
  if(state){
    mesh.position.set(state.position.x, state.position.y, state.position.z);
    mesh.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
  }
}

socket.on('players', (players) => {
  Object.keys(players).forEach(id => {
    if(id === playerId) return;
    addOtherShip(id, players[id]);
  });
});
socket.on('playerJoined', ({id, state}) => {
  if(id !== playerId) addOtherShip(id, state);
});
socket.on('playerState', ({id, state}) => {
  if(id === playerId) return;
  if(!otherShips[id]) addOtherShip(id, state);
  const mesh = otherShips[id];
  mesh.position.set(state.position.x, state.position.y, state.position.z);
  mesh.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
});
socket.on('playerLeft', (id) => {
  const mesh = otherShips[id];
  if(mesh){
    scene.remove(mesh);
    delete otherShips[id];
  }
});

const keys = {};
document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if(e.key === ' '){
    health = Math.max(0, health - 10);
    updateHealth();
  }
  if(e.key.toLowerCase() === 'm'){
    toggleMenu();
  }
});
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

let yaw = 0;
let pitch = 0;
document.addEventListener('mousemove', (e) => {
  yaw -= e.movementX * 0.002;
  pitch -= e.movementY * 0.002;
});
renderer.domElement.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  hud.style.width = window.innerWidth + 'px';
  hud.style.height = window.innerHeight + 'px';
});

const MAP_SCALE = 0.5;

function updateShipInfo(){
  shipInfo.innerHTML = `Health: ${health.toFixed(0)}<br>` +
    `Position: (${ship.position.x.toFixed(1)}, ${ship.position.y.toFixed(1)}, ${ship.position.z.toFixed(1)})<br>` +
    `Rotation: (${ship.rotation.x.toFixed(2)}, ${ship.rotation.y.toFixed(2)}, ${ship.rotation.z.toFixed(2)})`;
}

function drawGalacticMap(){
  mapCtx.fillStyle = 'rgba(0,0,0,0.9)';
  mapCtx.fillRect(0,0,mapCanvas.width,mapCanvas.height);
  mapCtx.fillStyle = '#fff';
  for(let i=0;i<starVertices.length;i+=3){
    const x = mapCanvas.width/2 + starVertices[i]*MAP_SCALE;
    const z = mapCanvas.height/2 + starVertices[i+2]*MAP_SCALE;
    mapCtx.fillRect(x,z,1,1);
  }
  mapCtx.fillStyle = '#0f0';
  mapCtx.fillRect(mapCanvas.width/2 + ship.position.x*MAP_SCALE -1, mapCanvas.height/2 + ship.position.z*MAP_SCALE -1,2,2);
  mapCtx.fillStyle = '#f00';
  Object.values(otherShips).forEach(o => {
    mapCtx.fillRect(mapCanvas.width/2 + o.position.x*MAP_SCALE -1, mapCanvas.height/2 + o.position.z*MAP_SCALE -1,2,2);
  });
}

async function loadMarket(){
  const token = localStorage.getItem('token');
  if(!token){
    market.textContent = 'Login to view market';
    return;
  }
  try{
    const res = await fetch(`/inventory/get?playerId=${encodeURIComponent(playerId)}`,{
      headers:{'Authorization':`Bearer ${token}`}
    });
    if(res.ok){
      const data = await res.json();
      market.innerHTML = data.inventory.map(item => `${item.itemId}: ${item.quantity}`).join('<br>');
    }else{
      market.textContent = 'Failed to load market';
    }
  }catch(err){
    market.textContent = 'Error loading market';
  }
}

function updateTargets(){
  const list = Object.entries(otherShips).map(([id, mesh]) => {
    const dx = mesh.position.x - ship.position.x;
    const dy = mesh.position.y - ship.position.y;
    const dz = mesh.position.z - ship.position.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    return {id, dist};
  }).sort((a,b) => a.dist - b.dist).slice(0,5);
  if(list.length === 0){
    targets.textContent = 'No targets';
  } else {
    targets.innerHTML = list.map(t => `${t.id}: ${t.dist.toFixed(1)}`).join('<br>');
  }
}

function animate(){
  requestAnimationFrame(animate);
  const speed = 0.2;

  if(health < 100){
    health = Math.min(100, health + 0.05);
    updateHealth();
  }

  if (keys['w'] || keys['arrowup']) ship.translateZ(-speed);
  if (keys['s'] || keys['arrowdown']) ship.translateZ(speed);
  if (keys['a'] || keys['arrowleft']) ship.translateX(-speed);
  if (keys['d'] || keys['arrowright']) ship.translateX(speed);

  ship.rotation.y = yaw;
  ship.rotation.x = pitch;

  const relativeOffset = cameraOffset.clone().applyQuaternion(ship.quaternion);
  camera.position.copy(ship.position).add(relativeOffset);
  camera.lookAt(ship.position);

  hudText.textContent = `x: ${ship.position.x.toFixed(1)} y: ${ship.position.y.toFixed(1)} z: ${ship.position.z.toFixed(1)} | speed: ${speed.toFixed(1)}`;
  if(!menu.classList.contains('hidden')){
    updateShipInfo();
    drawGalacticMap();
    updateTargets();
  }
  renderer.render(scene, camera);
}
animate();

setInterval(() => {
  socket.emit('state', {
    position: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
    rotation: { x: ship.rotation.x, y: ship.rotation.y, z: ship.rotation.z }
  });
}, 100);
