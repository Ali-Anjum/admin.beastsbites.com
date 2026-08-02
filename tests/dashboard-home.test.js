const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');

function loadDashboardRoute({ role, username, deliveryCount = 4, customerCount = 2, userCount = 0 }) {
  const routePath = require.resolve('../routes/dashboardHome');
  const dependencyPaths = [
    '../middleware/MustAuth',
    '../middleware/logManagerAction',
    '../middleware/roleAuth',
    '../Models/DeliverSchema',
    '../Models/customersSchema',
    '../Models/UserSchema',
    '../Models/LogSchema',
    '../Models/SubscriptionSchema'
  ].map((dependency) => require.resolve(dependency));

  delete require.cache[routePath];
  for (const dependencyPath of dependencyPaths) {
    delete require.cache[dependencyPath];
  }

  const originalLoad = Module._load;

  const mockModels = {
    '../middleware/MustAuth': (req, res, next) => {
      req.user = { role, username };
      next();
    },
    '../middleware/logManagerAction': () => (req, res, next) => next(),
    '../middleware/roleAuth': {
      allowRoles: () => (req, res, next) => next(),
      hasRole: () => true
    },
    '../Models/DeliverSchema': {
      countDocuments: async () => deliveryCount,
      find: () => ({ sort: () => ({ skip: () => ({ limit: async () => [] }) }) })
    },
    '../Models/customersSchema': {
      countDocuments: async () => customerCount,
      find: () => ({ sort: () => ({ select: () => ({ lean: async () => [] }) }) })
    },
    '../Models/UserSchema': {
      countDocuments: async () => userCount,
      find: () => ({ sort: () => ({ select: () => ({ lean: async () => [] }) }) })
    },
    '../Models/LogSchema': {
      find: () => ({ sort: () => ({ lean: async () => [] }) }),
      create: async () => undefined
    },
    '../Models/SubscriptionSchema': {
      find: () => ({ sort: () => ({ lean: async () => [] }) }),
      create: async () => undefined
    }
  };

  Module._load = function mockedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mockModels, request)) {
      return mockModels[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const route = require('../routes/dashboardHome');
    delete require.cache[routePath];
    return route;
  } finally {
    Module._load = originalLoad;
  }
}

function buildApp(route) {
  const app = express();
  app.use(express.json());
  app.use('/dashboard', route);
  return app;
}

test('dashboard data includes users for manager roles', async () => {
  const route = loadDashboardRoute({
    role: 'Manager',
    username: 'manager1',
    userCount: 1
  });

  const app = buildApp(route);
  const res = await request(app).get('/dashboard/data');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.counts.users, 1);
  assert.equal(res.body.capabilities.canViewUsers, true);
  assert.equal(res.body.capabilities.canViewLogs, false);
  assert.equal(res.body.capabilities.canBackup, true);
  assert.equal(res.body.users, undefined);
});

test('dashboard data hides users for delivery guys', async () => {
  const route = loadDashboardRoute({
    role: 'Delivery-Guy',
    username: 'delivery1',
    userCount: 0
  });

  const app = buildApp(route);
  const res = await request(app).get('/dashboard/data');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.counts.users, 0);
  assert.equal(res.body.capabilities.canViewUsers, false);
  assert.equal(res.body.users, undefined);
});