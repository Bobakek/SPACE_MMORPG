const socket = io();
let playerId;
socket.on('connect', () => { playerId = socket.id; });

const hud = document.getElementById('hud');
const hudText = document.getElementById('hudText');

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
document.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
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

function animate(){
  requestAnimationFrame(animate);
  const speed = 0.2;

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
  renderer.render(scene, camera);
}
animate();

setInterval(() => {
  socket.emit('state', {
    position: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
    rotation: { x: ship.rotation.x, y: ship.rotation.y, z: ship.rotation.z }
  });
}, 100);
