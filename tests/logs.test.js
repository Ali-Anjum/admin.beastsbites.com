const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');

function loadLogsRoute({ role }) {
  const routePath = require.resolve('../routes/logs');
  const dependencyPaths = [
    '../middleware/MustAuth',
    '../Models/LogSchema'
  ].map((dependency) => require.resolve(dependency));

  delete require.cache[routePath];
  for (const dependencyPath of dependencyPaths) {
    delete require.cache[dependencyPath];
  }

  const originalLoad = Module._load;

  const mockModels = {
    '../middleware/MustAuth': (req, res, next) => {
      req.user = { role, username: `${role.toLowerCase()}1` };
      next();
    },
    '../Models/LogSchema': {
      countDocuments: async () => 0,
      find: () => ({
        sort: () => ({
          skip: () => ({
            limit: async () => []
          })
        })
      })
    }
  };

  Module._load = function mockedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mockModels, request)) {
      return mockModels[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require('../routes/logs');
  } finally {
    Module._load = originalLoad;
  }
}

function buildApp(route) {
  const app = express();
  app.use(express.json());
  app.use('/logs', route);
  return app;
}

test('owner can open logs page', async () => {
  const route = loadLogsRoute({ role: 'Owner' });
  const app = buildApp(route);

  const res = await request(app).get('/logs');
  assert.equal(res.status, 200);
});

test('manager cannot open logs page', async () => {
  const route = loadLogsRoute({ role: 'Manager' });
  const app = buildApp(route);

  const res = await request(app).get('/logs');
  assert.equal(res.status, 403);
});

test('manager cannot fetch logs data', async () => {
  const route = loadLogsRoute({ role: 'Manager' });
  const app = buildApp(route);

  const res = await request(app).get('/logs/data');
  assert.equal(res.status, 403);
});
