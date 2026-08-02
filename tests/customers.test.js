const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');

function loadCustomersRoute({ userExists = true, customerExists = null, createdCustomers = [], createdSubscriptions = [], customMocks = {} } = {}) {
  const routePath = require.resolve('../routes/customers');
  const dependencyPaths = [
    '../middleware/MustAuth',
    '../middleware/logManagerAction',
    '../middleware/roleAuth',
    '../Models/customersSchema',
    '../Models/DeliverSchema',
    '../Models/SubscriptionSchema',
    '../Models/UserSchema',
    '../helpers/deliveryScheduler'
  ].map((dependency) => require.resolve(dependency));

  delete require.cache[routePath];
  for (const dependencyPath of dependencyPaths) {
    delete require.cache[dependencyPath];
  }

  const originalLoad = Module._load;

  const mockModels = {
    '../middleware/MustAuth': (req, res, next) => {
      req.user = { role: 'Owner', username: 'owner1' };
      next();
    },
    '../middleware/logManagerAction': () => (req, res, next) => next(),
    '../middleware/roleAuth': {
      allowRoles: () => (req, res, next) => next(),
      hasRole: () => true
    },
    '../Models/customersSchema': {
      find: () => ({ sort: () => ({ skip: () => ({ limit: async () => [] }) }) }),
      countDocuments: async () => 0,
      findOne: async () => customerExists,
      create: async (payload) => {
        createdCustomers.push(payload);
        return { ...payload, customers_id: 123456 };
      },
      findOneAndUpdate: async () => null
    },
    '../Models/DeliverSchema': {
      find: () => ({ sort: () => [] })
    },
    '../Models/SubscriptionSchema': {
      findOne: async () => null,
      create: async (payload) => {
        createdSubscriptions.push(payload);
        return { ...payload, subscription_id: 654321 };
      },
      findOneAndUpdate: async () => null
    },
    '../Models/UserSchema': {
      find: () => ({ sort: () => ({ select: () => ({ lean: async () => [] }) }) }),
      exists: async () => userExists,
      findOne: async () => userExists ? { username: 'delivery1' } : null
    },
    '../helpers/deliveryScheduler': {
      syncCustomerStatuses: async () => undefined
    }
  };

  Object.assign(mockModels, customMocks);

  Module._load = function mockedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mockModels, request)) {
      return mockModels[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require('../routes/customers');
  } finally {
    Module._load = originalLoad;
  }
}

function buildApp(route) {
  const app = express();
  app.use(express.json());
  app.use('/dashboard/customers', route);
  return app;
}

test('add customer works with active_till', async () => {
  const createdCustomers = [];
  const createdSubscriptions = [];
  const route = loadCustomersRoute({ createdCustomers, createdSubscriptions });
  const app = buildApp(route);

  const res = await request(app)
    .post('/dashboard/customers/add')
    .send({
      customers_name: 'Test Customer',
      phone_number: '03001234567',
      location: 'Lahore',
      diet_preference: 'Veg',
      active_till: '2026-08-31',
      meal_time: ['Lunch'],
      delivery_guy: 'delivery1',
      comments: 'Note only'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(createdCustomers.length, 1);
  assert.equal(createdCustomers[0].active_till, '2026-08-31');
  assert.equal(createdCustomers[0].status, 'Active');
  assert.equal(createdSubscriptions.length, 1);
  assert.equal(createdSubscriptions[0].status, 'Active');
});

test('add customer rejects missing active_till', async () => {
  const route = loadCustomersRoute();
  const app = buildApp(route);

  const res = await request(app)
    .post('/dashboard/customers/add')
    .send({
      customers_name: 'Test Customer',
      phone_number: '03001234567',
      location: 'Lahore',
      diet_preference: 'Veg',
      meal_time: ['Lunch'],
      delivery_guy: 'delivery1',
      comments: 'Note only'
    });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /active_till/i);
});

test('customer search strips special characters before querying the database', async () => {
  let capturedCountQuery = null;
  let capturedFindQuery = null;

  const route = loadCustomersRoute({
    customMocks: {
      '../Models/customersSchema': {
        find: (query) => {
          capturedFindQuery = query;
          return { sort: () => ({ skip: () => ({ limit: async () => [] }) }) };
        },
        countDocuments: async (query) => {
          capturedCountQuery = query;
          return 0;
        },
        findOne: async () => null,
        create: async () => null,
        findOneAndUpdate: async () => null
      }
    }
  });

  const app = buildApp(route);
  const res = await request(app)
    .get('/dashboard/customers/data?page=1&search=abc!@#$123')
    .send();

  assert.equal(res.status, 200);
  assert.ok(capturedCountQuery);
  assert.equal(capturedCountQuery.$or[0].customers_name.$regex.source, 'abc123');
  assert.equal(capturedCountQuery.$or[1].phone_number.$regex.source, 'abc123');
  assert.equal(capturedCountQuery.$or[2].location.$regex.source, 'abc123');
  assert.equal(capturedFindQuery.$or[0].customers_name.$regex.source, 'abc123');
  assert.equal(capturedFindQuery.$or[1].phone_number.$regex.source, 'abc123');
  assert.equal(capturedFindQuery.$or[2].location.$regex.source, 'abc123');
});