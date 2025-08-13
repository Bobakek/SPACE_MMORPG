const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');

const usersFile = path.join(__dirname, '..', 'server', 'users.json');

beforeEach(() => {
  fs.writeFileSync(usersFile, '[]');
});

const registerAndLogin = async () => {
  await request(app)
    .post('/auth/register')
    .send({ username: 'captain', password: 'pass' })
    .expect(200);
  const res = await request(app)
    .post('/auth/login')
    .send({ username: 'captain', password: 'pass' })
    .expect(200);
  return res.body.token;
};

describe('/ship/update', () => {
  test('acknowledges ship updates', async () => {
    const token = await registerAndLogin();
    const payload = {
      playerId: 'captain',
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 0, y: 0, z: 0 }
    };
    const res = await request(app)
      .post('/ship/update')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(200);
    expect(res.body).toMatchObject({ acknowledged: true, ...payload });
  });
});
