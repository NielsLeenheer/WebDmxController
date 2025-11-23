/**
 * Control Type Definitions
 *
 * This module exports all control type classes and a registry of singleton instances.
 *
 * Control types provide:
 * - Reusable control patterns (RGB, Slider, XYPad, etc.)
 * - Conversion between control values and DMX arrays
 * - Default values for each control type
 */

export { ControlType } from './ControlType.js';
export { RGBControl } from './RGBControl.js';
export { SliderControl } from './SliderControl.js';
export { ToggleControl } from './ToggleControl.js';
export { XYPadControl } from './XYPadControl.js';
export { XYPad16Control } from './XYPad16Control.js';

import { RGBControl } from './RGBControl.js';
import { SliderControl } from './SliderControl.js';
import { ToggleControl } from './ToggleControl.js';
import { XYPadControl } from './XYPadControl.js';
import { XYPad16Control } from './XYPad16Control.js';

/**
 * Control Type Registry
 * Singleton instances of all control types
 * These are the ONLY instances - used for lookups throughout the app
 */
export const CONTROL_TYPES = {
	// Color controls
	RGB: new RGBControl(),

	// Single-channel controls
	Dimmer: new SliderControl('dimmer', 'Dimmer'),
	Strobe: new SliderControl('strobe', 'Strobe'),
	Speed: new SliderControl('speed', 'Speed'),
	White: new SliderControl('white', 'White'),
	Amber: new SliderControl('amber', 'Amber'),
	Volume: new SliderControl('volume', 'Volume'),
	Fan: new SliderControl('fan', 'Fan'),
	Flame: new SliderControl('flame', 'Flame'),

	// Toggle controls
	Safety: new ToggleControl('safety', 'Safety', 0, 255),

	// Position controls
	PanTilt: new XYPadControl('pantilt', 'Pan/Tilt'),
	PanTilt16: new XYPad16Control('pantilt16', 'Pan/Tilt')
};
