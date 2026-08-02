const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPostLoginRedirect,
  validateCustomerPayload,
  getSubscriptionWindow,
} = require('../helpers/businessRules');

test('login redirect uses the delivery page for delivery guys', () => {
  assert.equal(getPostLoginRedirect('Delivery-Guy'), '/delivery');
});

test('login redirect uses the dashboard for staff roles', () => {
  assert.equal(getPostLoginRedirect('Manager'), '/dashboard');
});

test('valid customer payload passes validation', () => {
  const result = validateCustomerPayload({
    customers_name: 'Awais',
    phone_number: '03001234567',
    location: 'Lahore',
    diet_preference: 'Veg',
    active_till: '2026-08-31',
    meal_time: ['Lunch'],
    delivery_guy: 'delivery'
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('invalid active-for-days is rejected', () => {
  const result = validateCustomerPayload({
    customers_name: 'Awais',
    phone_number: '03001234567',
    location: 'Lahore',
    diet_preference: 'Veg',
    active_till: '2026-07-01',
    meal_time: ['Lunch'],
    delivery_guy: 'delivery'
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /active_till/i);
});

test('subscription window falls back to active-for-days when stop date is missing', () => {
  const startDate = new Date('2026-07-10T00:00:00.000Z');
  const result = getSubscriptionWindow({
    start_date: new Date('2026-07-01T00:00:00.000Z'),
    stop_date: null,
    active_for_days: 20
  }, startDate);

  assert.equal(result.startDate.toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(result.stopDate.toISOString(), '2026-07-21T00:00:00.000Z');
  assert.equal(result.isActive, true);
});
