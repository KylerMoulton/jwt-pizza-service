const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let testUser;
let testUserAuthToken;
let testUserId;

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  await DB.addUser(user);
  return user;
}

beforeAll(async () => {
  testUser = {
    name: randomName(),
    email: randomName() + '@test.com',
    password: 'a',
  };
  
  // Register the test user
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;

  // Create an admin user for testing admin-only routes
  const adminUser = await createAdminUser();
  // eslint-disable-next-line no-unused-vars
  const loginRes = await request(app).put('/api/auth').send({
    email: adminUser.email,
    password: 'toomanysecrets',
  });
});
  
// Test for user registration
test('user registration - success', async () => {
  const newUser = {
    name: randomName(),
    email: randomName() + '@test.com',
    password: 'password123',
  };
  
  const res = await request(app).post('/api/auth').send(newUser);
  
  expect(res.status).toBe(200);
  expect(res.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  expect(res.body.user).toMatchObject({ name: newUser.name, email: newUser.email, roles: [{ role: 'diner' }] });
});

// Test for missing fields in registration
test('user registration - missing fields', async () => {
  const res = await request(app).post('/api/auth').send({ name: randomName() });
  
  expect(res.status).toBe(400);
  expect(res.body.message).toBe('name, email, and password are required');
});

// Test for login
test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  // eslint-disable-next-line no-unused-vars
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(loginRes.body.user).toMatchObject(user);
});

// Test for updating user
test('update user - success', async () => {
  const updatedData = { email: randomName() + '@test.com', password: 'newpassword' };
  const res = await request(app)
    .put(`/api/auth/${testUserId}`)
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(updatedData);

  expect(res.status).toBe(200);
  expect(res.body.email).toBe(updatedData.email);
});

// Test for unauthorized update attempt
test('update user - unauthorized', async () => {
  const updatedData = { email: randomName() + '@test.com' };
  const res = await request(app)
    .put(`/api/auth/${testUserId + 1}`) // Try to update a different user
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(updatedData);

  expect(res.status).toBe(403);
  expect(res.body.message).toBe('unauthorized');
});

// Test for logout
test('logout - success', async () => {
  const res = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${testUserAuthToken}`);

  expect(res.status).toBe(200);
  expect(res.body.message).toBe('logout successful');
});

// Test for logout without token
test('logout - unauthorized', async () => {
  const res = await request(app).delete('/api/auth');
  
  expect(res.status).toBe(401);
  expect(res.body.message).toBe('unauthorized');
});