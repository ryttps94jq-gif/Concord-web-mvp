/**
 * Existential OS — Module Exports
 *
 * Entry point for the qualia subsystem.
 * Import this to access the registry, engine, and hooks.
 */

import { existentialOS, getExistentialOS, groupExistentialOSByCategory } from "./registry.js";
import { QualiaEngine } from "./engine.js";
import * as hooks from "./hooks.js";

export {
  existentialOS,
  getExistentialOS,
  groupExistentialOSByCategory,
  QualiaEngine,
  hooks,
};
