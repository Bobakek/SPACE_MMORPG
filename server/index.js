const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
