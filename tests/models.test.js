const test = require('node:test');
const assert = require('node:assert/strict');

const mongoose = require('mongoose');
const User = require('../Models/UserSchema');
const Delivery = require('../Models/DeliverSchema');
const Customer = require('../Models/customersSchema');
const Subscription = require('../Models/SubscriptionSchema');

test('auto-assigns user_id when missing on validate', async () => {
  const u = new User({ username: 'tempuser', password: 'pass', role: 'Manager' });
  await u.validate();
  assert.ok(u.user_id && typeof u.user_id === 'number');
  assert.match(String(u.user_id), /^[0-9]{6}$/);
});

test('delivery-guy without user_id gets assigned id', async () => {
  const u = new User({ username: 'dgguy', password: 'pass', role: 'Delivery-Guy' });
  await u.validate();
  assert.ok(u.user_id && typeof u.user_id === 'number');
  assert.match(String(u.user_id), /^[0-9]{6}$/);
});

test('delivery default delivery_id generated', async () => {
  const d = new Delivery({ assigned_to_user_id: 123456, assigned_to_username: 'dgguy', delivery_date: new Date() });
  await d.validate();
  assert.ok(d.delivery_id && typeof d.delivery_id === 'number');
  assert.match(String(d.delivery_id), /^[0-9]{6}$/);
});

test('customer accepts active_till and status values', async () => {
  const c = new Customer({ customers_name: 'C', phone_number: '0123', location: 'X', diet_preference: 'Veg', active_till: '2026-08-31', status: 'Active', meal_time: ['Lunch'], delivery_guy: 'dgguy' });
  const err = await c.validate().then(() => undefined).catch(e => e);
  assert.equal(err, undefined);
});

test('subscription accepts allowed active_for_days', async () => {
  const s = new Subscription({ subscription_id: 1, client_id: 1, start_date: new Date(), stop_date: new Date(Date.now()+86400000), subscription_type: 'Weekly', active_for_days: 12, food_preference: 'Veg' });
  const err = await s.validate().then(() => undefined).catch(e => e);
  assert.equal(err, undefined);
});
