const express = require('express');
const path = require('path');
const { register, login, authenticateToken, verifySocketToken } = require('./auth');
const { MongoClient } = require('mongodb');

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

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const client = new MongoClient(uri);
let inventoryCollection;

async function initDb() {
  try {
    await client.connect();
    const db = client.db('space_mmorpg');
    inventoryCollection = db.collection('inventory');
  } catch (err) {
    console.error('Database connection failed', err);
  }
}
initDb();

const readInventory = async (playerId) => {
  return inventoryCollection.find({ playerId }).toArray();
};

const writeInventory = async (playerId, itemId, quantityChange) => {
  const entry = await inventoryCollection.findOne({ playerId, itemId });
  if (!entry) {
    if (quantityChange < 0) {
      throw new Error('Quantity cannot be negative');
    }
    await inventoryCollection.insertOne({ playerId, itemId, quantity: quantityChange });
  } else {
    const newQuantity = entry.quantity + quantityChange;
    if (newQuantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    await inventoryCollection.updateOne(
      { playerId, itemId },
      { $set: { quantity: newQuantity } }
    );
  }
  return readInventory(playerId);
};

app.get('/inventory/get', authenticateToken, async (req, res) => {
  const { playerId } = req.query;
  if (typeof playerId !== 'string' || !playerId.trim()) {
    return res.status(400).json({ error: 'playerId required' });
  }
  try {
    const inventory = await readInventory(playerId);
    res.json({ inventory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

app.post('/inventory/update', authenticateToken, async (req, res) => {
  const { playerId, itemId, quantityChange } = req.body;
  if (
    typeof playerId !== 'string' ||
    typeof itemId !== 'string' ||
    typeof quantityChange !== 'number'
  ) {
    return res.status(400).json({
      error: 'playerId and itemId must be strings and quantityChange must be a number'
    });
  }

  try {
    const inventory = await writeInventory(playerId, itemId, quantityChange);
    res.json({ success: true, inventory });
  } catch (err) {
    if (err.message === 'Quantity cannot be negative') {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

app.post('/ship/update', authenticateToken, (req, res) => {
  const { playerId, position, velocity } = req.body;
  res.json({ acknowledged: true, playerId, position, velocity });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
