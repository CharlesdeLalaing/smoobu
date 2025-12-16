const authRoutes = require('./auth');
const bookingsRoutes = require('./bookings');
const couponsRoutes = require('./coupons');
const pricingConfigRoutes = require('./pricing-config');
const spaRoutes = require('./spa');
const extrasRoutes = require('./extras');
const settingsRoutes = require('./settings');
const smoobuRoutes = require('./smoobu');
const paymentsRoutes = require('./payments');

module.exports = {
  auth: authRoutes,
  bookings: bookingsRoutes,
  coupons: couponsRoutes,
  pricingConfig: pricingConfigRoutes,
  spa: spaRoutes,
  extras: extrasRoutes,
  settings: settingsRoutes,
  smoobu: smoobuRoutes,
  payments: paymentsRoutes
};
