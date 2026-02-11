/**
 * Domain Action Module Loader
 *
 * Loads all 23 super-lens domain modules and exports them as an array.
 * Each module exports a default function: (registerLensAction) => void
 *
 * Usage in server.js:
 *   import domainModules from './domains/index.js';
 *   domainModules.forEach(mod => mod(registerLensAction));
 */

import healthcare from './healthcare.js';
import trades from './trades.js';
import food from './food.js';
import retail from './retail.js';
import household from './household.js';
import accounting from './accounting.js';
import agriculture from './agriculture.js';
import logistics from './logistics.js';
import education from './education.js';
import legal from './legal.js';
import nonprofit from './nonprofit.js';
import realestate from './realestate.js';
import fitness from './fitness.js';
import creative from './creative.js';
import manufacturing from './manufacturing.js';
import environment from './environment.js';
import government from './government.js';
import aviation from './aviation.js';
import events from './events.js';
import science from './science.js';
import security from './security.js';
import services from './services.js';
import insurance from './insurance.js';

export default [
  healthcare,
  trades,
  food,
  retail,
  household,
  accounting,
  agriculture,
  logistics,
  education,
  legal,
  nonprofit,
  realestate,
  fitness,
  creative,
  manufacturing,
  environment,
  government,
  aviation,
  events,
  science,
  security,
  services,
  insurance,
];
