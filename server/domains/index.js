/**
 * Domain Action Module Loader
 *
 * Loads all 23 super-lens domain modules and exports them as an array.
 * Each module exports a function: (registerLensAction) => void
 *
 * Usage in server.js:
 *   const domainModules = require('./domains');
 *   domainModules.forEach(mod => mod(registerLensAction));
 */

module.exports = [
  require('./healthcare'),
  require('./trades'),
  require('./food'),
  require('./retail'),
  require('./household'),
  require('./accounting'),
  require('./agriculture'),
  require('./logistics'),
  require('./education'),
  require('./legal'),
  require('./nonprofit'),
  require('./realestate'),
  require('./fitness'),
  require('./creative'),
  require('./manufacturing'),
  require('./environment'),
  require('./government'),
  require('./aviation'),
  require('./events'),
  require('./science'),
  require('./security'),
  require('./services'),
  require('./insurance'),
];
