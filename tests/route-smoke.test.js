const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const loginRouter = require('../routes/login');

const app = express();
app.use(express.json());
app.use('/login', loginRouter);

test('login page is served', async () => {
  const res = await request(app).get('/login');
  assert.equal(res.status, 200);
});

test('logout clears auth cookie', async () => {
  const res = await request(app).post('/login/logout');
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /\/login/i);
});
