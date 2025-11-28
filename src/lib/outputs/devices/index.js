/**
 * Device Type Registry
 *
 * Central registry of all device type definitions.
 * Device types are singleton class instances keyed by string ID (lowercase with dashes).
 *
 * Example usage:
 *   const device = { type: "rgb", ... }
 *   const deviceType = DEVICE_TYPES[device.type]
 *   const dmx = controlValuesToDMX(deviceType, device.defaultValues)
 */

import { RGBDeviceType } from './RGBDeviceType.js';
import { RGBADeviceType } from './RGBADeviceType.js';
import { RGBWDeviceType } from './RGBWDeviceType.js';
import { DimmerDeviceType } from './DimmerDeviceType.js';
import { SmokeDeviceType } from './SmokeDeviceType.js';
import { MovingHeadDeviceType } from './MovingHeadDeviceType.js';
import { MovingHead11CHDeviceType } from './MovingHead11CHDeviceType.js';
import { FlamethrowerDeviceType } from './FlamethrowerDeviceType.js';

export const DEVICE_TYPES = {
    'rgb': new RGBDeviceType(),
    'rgba': new RGBADeviceType(),
    'rgbw': new RGBWDeviceType(),
    'dimmer': new DimmerDeviceType(),
    'smoke': new SmokeDeviceType(),
    'moving-head': new MovingHeadDeviceType(),
    'moving-head-11ch': new MovingHead11CHDeviceType(),
    'flamethrower': new FlamethrowerDeviceType()
};
