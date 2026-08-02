function getPostLoginRedirect(role) {
  return role === 'Delivery-Guy' ? '/delivery' : '/dashboard';
}

function validateCustomerPayload(payload) {
  const errors = [];

  if (!payload?.customers_name || String(payload.customers_name).trim() === '') {
    errors.push('customers_name is required');
  }

  if (!payload?.phone_number || String(payload.phone_number).trim() === '') {
    errors.push('phone_number is required');
  }

  if (!payload?.location || String(payload.location).trim() === '') {
    errors.push('location is required');
  }

  if (!['Veg', 'Non-Veg'].includes(payload?.diet_preference)) {
    errors.push('diet_preference must be Veg or Non-Veg');
  }

  const normalizedActiveTill = normalizeDubaiDateKey(payload?.active_till);
  if (!normalizedActiveTill) {
    errors.push('active_till is required and must be a valid date');
  }

  if (normalizedActiveTill) {
    const todayKey = getDubaiDateKey(new Date());
    if (normalizedActiveTill < todayKey) {
      errors.push('active_till must be today or a future date');
    }
  }

  if (!Array.isArray(payload?.meal_time) || payload.meal_time.length === 0) {
    errors.push('meal_time must contain at least one entry');
  }

  if (!payload?.delivery_guy || String(payload.delivery_guy).trim() === '') {
    errors.push('delivery_guy is required');
  }

  return {
    valid: errors.length === 0,
    errors,
    activeTill: normalizedActiveTill,
  };
}

function getDubaiDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function normalizeDubaiDateKey(value) {
  return getDubaiDateKey(value);
}

function getCustomerStatus(activeTill, referenceDate = new Date()) {
  const activeTillKey = normalizeDubaiDateKey(activeTill);
  if (!activeTillKey) {
    return 'Expired';
  }

  const referenceKey = getDubaiDateKey(referenceDate);
  return activeTillKey < referenceKey ? 'Expired' : 'Active';
}

function buildNextDateOptions(daysAhead = 30, referenceDate = new Date()) {
  const options = [];
  const baseDate = new Date(referenceDate);
  baseDate.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + offset);
    options.push(getDubaiDateKey(nextDate));
  }

  return options;
}

function getSubscriptionWindow(subscription, referenceDate) {
  const startDate = subscription?.start_date ? new Date(subscription.start_date) : new Date(referenceDate);
  const stopDate = subscription?.stop_date
    ? new Date(subscription.stop_date)
    : (() => {
        const fallbackStopDate = new Date(startDate);
        const activeForDays = Number(subscription?.active_for_days || 30);
        fallbackStopDate.setDate(fallbackStopDate.getDate() + activeForDays);
        return fallbackStopDate;
      })();

  const isActive = startDate <= stopDate;

  return {
    startDate,
    stopDate,
    isActive,
  };
}

module.exports = {
  getPostLoginRedirect,
  validateCustomerPayload,
  getSubscriptionWindow,
  getDubaiDateKey,
  normalizeDubaiDateKey,
  getCustomerStatus,
  buildNextDateOptions,
};
