const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const usersFile = path.join(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const readUsers = () => {
  try {
    return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  } catch {
    return [];
  }
};

const writeUsers = (users) => {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

const hashPassword = (password) =>
  crypto.createHash('sha256').update(password).digest('hex');

const createToken = (username) =>
  jwt.sign({ id: username }, JWT_SECRET, { expiresIn: '1h' });

const register = (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  const users = readUsers();
  if (users.find((u) => u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  users.push({ username, password: hashPassword(password) });
  writeUsers(users);
  const token = createToken(username);
  res.json({ token, playerId: username });
};

const login = (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  const users = readUsers();
  const user = users.find((u) => u.username === username);
  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = createToken(username);
  res.json({ token, playerId: username });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.sendStatus(401);
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.sendStatus(403);
  }
};

const verifySocketToken = (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
};

module.exports = { register, login, authenticateToken, verifySocketToken };
