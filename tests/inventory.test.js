const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');

const usersFile = path.join(__dirname, '..', 'server', 'users.json');
const inventoryFile = path.join(__dirname, '..', 'server', 'inventory.json');

beforeEach(() => {
  fs.writeFileSync(usersFile, '[]');
  fs.writeFileSync(inventoryFile, '[]');
});

const registerAndLogin = async () => {
  await request(app)
    .post('/auth/register')
    .send({ username: 'player', password: 'pass' })
    .expect(200);
  const res = await request(app)
    .post('/auth/login')
    .send({ username: 'player', password: 'pass' })
    .expect(200);
  return res.body.token;
};

describe('/inventory endpoints', () => {
  test('updates and retrieves inventory', async () => {
    const token = await registerAndLogin();
    await request(app)
      .post('/inventory/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: 'player', itemId: 'item1', quantityChange: 5 })
      .expect(200)
      .expect(res => {
        expect(res.body.inventory).toEqual([
          { playerId: 'player', itemId: 'item1', quantity: 5 }
        ]);
      });

    const resGet = await request(app)
      .get('/inventory/get')
      .set('Authorization', `Bearer ${token}`)
      .query({ playerId: 'player' })
      .expect(200);

    expect(resGet.body).toEqual({
      inventory: [{ playerId: 'player', itemId: 'item1', quantity: 5 }]
    });
  });

  test('prevents negative quantities', async () => {
    const token = await registerAndLogin();
    await request(app)
      .post('/inventory/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: 'player', itemId: 'item1', quantityChange: 5 })
      .expect(200);

    await request(app)
      .post('/inventory/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: 'player', itemId: 'item1', quantityChange: -10 })
      .expect(400);
  });
});
