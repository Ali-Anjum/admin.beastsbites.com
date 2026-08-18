const Delivery = require('../Models/DeliverSchema');
const Customer = require('../Models/customersSchema');
const Subscription = require('../Models/SubscriptionSchema');
const User = require('../Models/UserSchema');
const { getSubscriptionWindow } = require('./businessRules');

function toDubaiTime(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
}

function getTodayStart() {
  const now = new Date();
  const dubaiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  dubaiNow.setHours(0, 0, 0, 0);
  return dubaiNow;
}

function getTodayEnd() {
  const now = new Date();
  const dubaiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  dubaiNow.setHours(23, 59, 59, 999);
  return dubaiNow;
}

function getDubaiDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

async function syncCustomerStatuses() {
  const todayKey = getDubaiDateKey(new Date());

  await Customer.updateMany(
    { active_till: { $lt: todayKey }, status: { $ne: 'Expired' } },
    { $set: { status: 'Expired' } }
  );

  await Customer.updateMany(
    { active_till: { $gte: todayKey }, status: { $ne: 'Active' } },
    { $set: { status: 'Active' } }
  );
}

async function generateDailyDeliveries() {
  try {
    await syncCustomerStatuses();

    const timeSetting =  '2:31';
    const [hour, minute] = timeSetting.split(':').map(Number);
    const now = new Date();
    const dubaiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
    const shouldRun = dubaiNow.getHours() === hour && dubaiNow.getMinutes() === minute;

    if (!shouldRun) {
      return;
    }

    const startDate = getTodayStart();
    const endDate = getTodayEnd();

    const subscriptions = await Subscription.find({ status: 'Active' });

    for (const subscription of subscriptions) {
      const { startDate: subscriptionStartDate, stopDate: subscriptionStopDate, isActive } = getSubscriptionWindow(subscription, startDate);

      if (!isActive || subscriptionStartDate > endDate || subscriptionStopDate < startDate) {
        continue;
      }

      const customer = await Customer.findOne({ customers_id: subscription.client_id });
      if (!customer) continue;

      const existing = await Delivery.findOne({
        customer_id: customer.customers_id,
        delivery_date: {
          $gte: startDate,
          $lte: endDate
        }
      });

      if (existing) continue;

      const deliveryGuy = await User.findOne({ username: customer.delivery_guy, role: 'Delivery-Guy', is_active: true });
      if (!deliveryGuy) continue;

      const delivery = await Delivery.create({
        delivery_id: Math.floor(100000 + Math.random() * 900000),
        subscription_id: subscription.subscription_id,
        customer_id: customer.customers_id,
        assigned_to_user_id: deliveryGuy.user_id,
        assigned_to_username: deliveryGuy.username,
        delivery_date: new Date(),
        food: 'Combined Meal',
        meal_time: customer.meal_time || [],
        delivery_status: 'Pending'
      });

      console.log(`Generated delivery ${delivery.delivery_id} for ${customer.customers_name}`);
    }
  } catch (err) {
    console.error('Daily delivery generation error:', err);
  }
}

function startScheduler() {
  const timeSetting = process.env.DAILY_DELIVERY_TIME || '00:00';
  const [hour, minute] = timeSetting.split(':').map(Number);

  setInterval(async () => {
    const now = new Date();
    const dubaiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
    await syncCustomerStatuses();
    if (dubaiNow.getHours() === hour && dubaiNow.getMinutes() === minute) {
      await generateDailyDeliveries();
    }
  }, 60000);
}

module.exports = { startScheduler, generateDailyDeliveries, syncCustomerStatuses };