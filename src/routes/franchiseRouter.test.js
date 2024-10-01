const request = require('supertest');
const app = require('../service'); // Adjust the import to your actual app entry point
const { Role, DB } = require('../database/database.js');

let testUser;
let testUserAuthToken;
let adminUserToken;
let testFranchiseId;

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  const user = {
    password: 'toomanysecrets',
    roles: [{ role: Role.Admin }],
    name: randomName(),
    email: `${randomName()}@admin.com`,
  };
  await DB.addUser(user);
  return user;
}

beforeAll(async () => {
  testUser = {
    name: randomName(),
    email: `${randomName()}@test.com`,
    password: 'a',
  };

  // Register the test user
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;

  // Create an admin user for testing admin-only routes
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({
    email: adminUser.email,
    password: 'toomanysecrets',
  });
  adminUserToken = loginRes.body.token;
});

describe('Franchise API Tests', () => {
  // Test for listing all franchises
  test('GET /api/franchise - success', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Test for listing a user's franchises
  test('GET /api/franchise/:userId - success', async () => {
    const res = await request(app)
      .get(`/api/franchise/${testUserAuthToken}`)
      .set('Authorization', `Bearer ${adminUserToken}`); // Using admin token to get franchises

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Test for creating a new franchise
  test('POST /api/franchise - success', async () => {
    let adminUser = await createAdminUser();
    const newFranchise = {
      name: 'pizzaPocket',
      admins: [{ email: adminUser.email }],
    };

    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminUserToken}`)
      .send(newFranchise);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(newFranchise);
    testFranchiseId = res.body.id; // Store the created franchise ID for further tests
  });

  // Test for unauthorized franchise creation
  test('POST /api/franchise - unauthorized', async () => {
    const newFranchise = {
      name: 'pizzaPocket',
      admins: [{ email: 'user@example.com' }],
    };

    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${testUserAuthToken}`) // Send the correct non-admin token
      .send(newFranchise);

    expect(res.status).toBe(403); // Expect 403 Forbidden due to lack of admin privileges
    expect(res.body.message).toBe('unable to create a franchise');
  });

  // Test for deleting a franchise
  test('DELETE /api/franchise/:franchiseId - success', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${testFranchiseId}`)
      .set('Authorization', `Bearer ${adminUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('franchise deleted');
  });

  // Test for unauthorized franchise deletion
  test('DELETE /api/franchise/:franchiseId - unauthorized', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${testFranchiseId}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unable to delete a franchise');
  });

  // Test for creating a store in a franchise
  test('POST /api/franchise/:franchiseId/store - success', async () => {
    const storeData = { name: 'SLC' };
    let adminUser = await createAdminUser();
    const newFranchise = {
      name: randomName(),
      admins: [{ email: adminUser.email }],
    };

    const resFrancise = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminUserToken}`)
      .send(newFranchise);
    let franchiseID = resFrancise.body.id
    const res = await request(app)
      .post(`/api/franchise/${franchiseID}/store`)
      .set('Authorization', `Bearer ${adminUserToken}`)
      .send(storeData);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(storeData.name);
  });

  // Test for unauthorized store creation
  test('POST /api/franchise/:franchiseId/store - unauthorized', async () => {
    const storeData = { name: 'SLC' };

    const res = await request(app)
      .post(`/api/franchise/${testFranchiseId}/store`)
      .set('Authorization', `Bearer ${testUserAuthToken}`) // Non-admin token
      .send(storeData);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unable to create a store');
  });

  // Test for deleting a store
  test('DELETE /api/franchise/:franchiseId/store/:storeId - success', async () => {
    const storeId = 1; // Replace with the actual created store ID

    const res = await request(app)
      .delete(`/api/franchise/${testFranchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${adminUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('store deleted');
  });

  // Test for unauthorized store deletion
  test('DELETE /api/franchise/:franchiseId/store/:storeId - unauthorized', async () => {
    const storeId = 1; // Use the same store ID for testing

    const res = await request(app)
      .delete(`/api/franchise/${testFranchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`); // Non-admin token

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unable to delete a store');
  });
});
