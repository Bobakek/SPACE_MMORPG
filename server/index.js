const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

const server = http.createServer(app);
const io = new Server(server);

const players = {};

io.on('connection', (socket) => {
  players[socket.id] = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  };

  socket.emit('players', players);
  socket.broadcast.emit('playerJoined', { id: socket.id, state: players[socket.id] });

  socket.on('state', (state) => {
    players[socket.id] = state;
    socket.broadcast.emit('playerState', { id: socket.id, state });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    socket.broadcast.emit('playerLeft', socket.id);
  });
});

app.post('/auth/login', (req, res) => {
  const { username = 'pilot' } = req.body;
  res.json({ token: 'placeholder-token', playerId: username });
});

app.post('/inventory/update', (req, res) => {
  const { itemId, quantityChange } = req.body;
  res.json({ success: true, inventory: { [itemId]: quantityChange } });
});

app.post('/ship/update', (req, res) => {
  const { playerId, position, velocity } = req.body;
  res.json({ acknowledged: true, playerId, position, velocity });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
