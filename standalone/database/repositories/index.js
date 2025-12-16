const bookingsRepo = require('./bookings');
const couponsRepo = require('./coupons');
const pricingConfigRepo = require('./pricing-config');
const spaRepo = require('./spa');
const extrasRepo = require('./extras');
const settingsRepo = require('./settings');
const usersRepo = require('./users');

module.exports = {
  bookings: bookingsRepo,
  coupons: couponsRepo,
  pricingConfig: pricingConfigRepo,
  spa: spaRepo,
  extras: extrasRepo,
  settings: settingsRepo,
  users: usersRepo
};
