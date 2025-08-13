const express = require('express');
const path = require('path');
const fs = require('fs');
const { register, login, authenticateToken, verifySocketToken } = require('./auth');

const http = require('http');
const { Server } = require('socket.io');


const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

const server = http.createServer(app);
const io = new Server(server);
io.use(verifySocketToken);

const players = {};

const MAX_SPEED = 15; // units per second
const WORLD_BOUND = 1000;

const withinBounds = ({ x, y, z }) =>
  Math.abs(x) <= WORLD_BOUND &&
  Math.abs(y) <= WORLD_BOUND &&
  Math.abs(z) <= WORLD_BOUND;

const publicState = ({ position, rotation }) => ({ position, rotation });

const getPublicPlayers = () => {
  const result = {};
  for (const [id, state] of Object.entries(players)) {
    result[id] = publicState(state);
  }
  return result;
};

io.on('connection', (socket) => {
  players[socket.id] = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    lastUpdate: Date.now()
  };

  socket.emit('players', getPublicPlayers());
  socket.broadcast.emit('playerJoined', { id: socket.id, state: publicState(players[socket.id]) });

  socket.on('state', (state) => {
    const player = players[socket.id];
    if (!player) return;
    const now = Date.now();
    const dt = (now - player.lastUpdate) / 1000;
    const { position, rotation } = state;

    if (!position || !rotation || dt <= 0) return;

    const dx = position.x - player.position.x;
    const dy = position.y - player.position.y;
    const dz = position.z - player.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const speed = dist / dt;

    if (speed > MAX_SPEED || !withinBounds(position)) return;

    players[socket.id] = { position, rotation, lastUpdate: now };
    socket.broadcast.emit('playerState', { id: socket.id, state: { position, rotation } });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    socket.broadcast.emit('playerLeft', socket.id);
  });
});

app.post('/auth/register', register);
app.post('/auth/login', login);

const inventoryFile = path.join(__dirname, 'inventory.json');

const readInventory = () => {
  try {
    return JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
  } catch {
    return [];
  }
};

const writeInventory = (data) => {
  fs.writeFileSync(inventoryFile, JSON.stringify(data, null, 2));
};

app.get('/inventory/get', authenticateToken, (req, res) => {
  const { playerId } = req.query;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId required' });
  }
  const inventory = readInventory().filter((item) => item.playerId === playerId);
  res.json({ inventory });
});

app.post('/inventory/update', authenticateToken, (req, res) => {
  const { playerId, itemId, quantityChange } = req.body;
  if (!playerId || !itemId || typeof quantityChange !== 'number') {
    return res.status(400).json({ error: 'playerId, itemId and quantityChange required' });
  }

  const data = readInventory();
  let entry = data.find(
    (i) => i.playerId === playerId && i.itemId === itemId
  );

  if (!entry) {
    if (quantityChange < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }
    entry = { playerId, itemId, quantity: quantityChange };
    data.push(entry);
  } else {
    const newQuantity = entry.quantity + quantityChange;
    if (newQuantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }
    entry.quantity = newQuantity;
  }

  writeInventory(data);
  const inventory = data.filter((i) => i.playerId === playerId);
  res.json({ success: true, inventory });
});

app.post('/ship/update', authenticateToken, (req, res) => {
  const { playerId, position, velocity } = req.body;
  res.json({ acknowledged: true, playerId, position, velocity });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
