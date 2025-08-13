const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

app.post('/auth/login', (req, res) => {
  const { username = 'pilot' } = req.body;
  res.json({ token: 'placeholder-token', playerId: username });
});

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

app.get('/inventory/get', (req, res) => {
  const { playerId } = req.query;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId required' });
  }
  const inventory = readInventory().filter((item) => item.playerId === playerId);
  res.json({ inventory });
});

app.post('/inventory/update', (req, res) => {
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

app.post('/ship/update', (req, res) => {
  const { playerId, position, velocity } = req.body;
  res.json({ acknowledged: true, playerId, position, velocity });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
