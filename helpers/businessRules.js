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

  if (!['Trial', 'Weekly', 'Monthly'].includes(payload?.plan)) {
    errors.push('plan must be Trial, Weekly, or Monthly');
  }

  const parsedActiveForDays = Number(payload?.active_for_days);
  if (![7, 20, 30].includes(parsedActiveForDays)) {
    errors.push('active_for_days must be one of 7, 20, or 30');
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
    parsedActiveForDays,
  };
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
};
