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

describe('Order API Tests', () => {
  // Test for fetching the pizza menu
  test('GET /api/order/menu - success', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('price');
  });

  // Test for adding a new menu item (admin-only route)
  test('PUT /api/order/menu - admin success', async () => {
    const newMenuItem = {
      title: 'Student Special',
      description: 'No toppings, just dough',
      image: 'pizza9.png',
      price: 0.0001,
    };

    const res = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${adminUserToken}`)
      .send(newMenuItem);

    expect(res.status).toBe(200);
    expect(res.body.some((item) => item.title === newMenuItem.title)).toBe(true);
  });

  // Test for unauthorized menu item addition
  test('PUT /api/order/menu - unauthorized', async () => {
    const newMenuItem = {
      title: 'Unauthorized Pizza',
      description: 'You should not add this',
      image: 'pizza10.png',
      price: 0.01,
    };

    const res = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(newMenuItem);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unable to add menu item');
  });

  // Test for fetching user orders
  test('GET /api/order - user orders success', async () => {
    const res = await request(app)
      .get('/api/order')
      .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  // Test for creating an order
//   test('POST /api/order - success', async () => {
//     const newOrder = {
//       franchiseId: 1,
//       storeId: 1,
//       items: [
//         {
//           menuId: 1,
//           description: 'Veggie',
//           price: 0.05,
//         },
//       ],
//     };
//     console.log("AUTHTOKEN" + testUserAuthToken)
//     const res = await request(app)
//       .post('/api/order')
//       .set('Authorization', `Bearer ${testUserAuthToken}`)
//       .send(newOrder);
//     console.log(JSON.stringify(res.body, null, 2));  // Log response properly
//     expect(res.status).toBe(200);
//     expect(res.body).toHaveProperty('order');
//     expect(res.body.order.items[0].description).toBe('Veggie');
//   });

  // Test for unauthorized order creation
  test('POST /api/order - unauthorized', async () => {
    const newOrder = {
      franchiseId: 1,
      storeId: 1,
      items: [
        {
          menuId: 1,
          description: 'Unauthorized Order',
          price: 0.05,
        },
      ],
    };

    // No auth token sent
    const res = await request(app).post('/api/order').send(newOrder);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('unauthorized');
  });
});
