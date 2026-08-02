const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');

function loadUsersRoute({ role, username, users = [], findOneResult = null, updateSpy = null, createSpy = null }) {
  const routePath = require.resolve('../routes/users');
  const dependencyPaths = [
    '../middleware/MustAuth',
    '../middleware/logManagerAction',
    '../middleware/roleAuth',
    '../Models/UserSchema'
  ].map((dependency) => require.resolve(dependency));

  delete require.cache[routePath];
  for (const dependencyPath of dependencyPaths) {
    delete require.cache[dependencyPath];
  }

  const originalLoad = Module._load;

  const mockUserModel = {
    find: () => ({
      sort: () => ({
        select: () => ({
          lean: async () => users
        })
      })
    }),
    findOne: async () => findOneResult,
    updateOne: async (...args) => {
      if (updateSpy) updateSpy(...args);
      return undefined;
    },
    create: async (payload) => {
      if (createSpy) createSpy(payload);
      return { ...payload, _id: 'created-id' };
    }
  };

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
    '../Models/UserSchema': mockUserModel
  };

  Module._load = function mockedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mockModels, request)) {
      return mockModels[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require('../routes/users');
  } finally {
    Module._load = originalLoad;
  }
}

function buildApp(route) {
  const app = express();
  app.use(express.json());
  app.use('/dashboard/users', route);
  return app;
}

test('users page is served', async () => {
  const route = loadUsersRoute({ role: 'Manager', username: 'manager1' });
  const app = buildApp(route);

  const res = await request(app).get('/dashboard/users');
  assert.equal(res.status, 200);
});

test('users data returns a list for manager roles', async () => {
  const users = [{ username: 'alice', role: 'Manager', is_active: true }];
  const route = loadUsersRoute({ role: 'Manager', username: 'manager1', users });
  const app = buildApp(route);

  const res = await request(app).get('/dashboard/users/data');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.users, users);
  assert.equal(res.body.capabilities.canManageUsers, false);
});

test('owner can change a user password from users page', async () => {
  const updateCalls = [];
  const route = loadUsersRoute({
    role: 'Owner',
    username: 'owner1',
    findOneResult: { _id: 'user123', username: 'alice' },
    updateSpy: (...args) => updateCalls.push(args)
  });
  const app = buildApp(route);

  const res = await request(app)
    .post('/dashboard/users/password')
    .send({ username: 'alice', password: 'newsecret' });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0][0]._id, 'user123');
});