// Concord Mobile — Foundation Module Barrel Export

// capture/foundation-capture
export {
  createFoundationCapture,
} from './capture/foundation-capture';
export type {
  DTUForge,
  FoundationCapture,
} from './capture/foundation-capture';

// sensors/sensor-manager
export {
  snapToGeoGrid,
  createSensorManager,
} from './sensors/sensor-manager';
export type {
  NativeWiFiModule,
  NativeBluetoothModule,
  NativeGPSModule,
  NativeBarometerModule,
  NativeMagnetometerModule,
  NativeAccelerometerModule,
  NativeAmbientLightModule,
  NativeSensorModules,
  SensorManager,
} from './sensors/sensor-manager';
