const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');

const usersFile = path.join(__dirname, '..', 'server', 'users.json');

beforeEach(() => {
  fs.writeFileSync(usersFile, '[]');
});

describe('/auth/login', () => {
  test('returns token for valid credentials', async () => {
    await request(app)
      .post('/auth/register')
      .send({ username: 'test', password: 'pass' })
      .expect(200);

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'test', password: 'pass' })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('playerId', 'test');
  });

  test('rejects invalid credentials', async () => {
    await request(app)
      .post('/auth/register')
      .send({ username: 'user', password: 'secret' })
      .expect(200);

    await request(app)
      .post('/auth/login')
      .send({ username: 'user', password: 'wrong' })
      .expect(401);
  });
});
