/**
 * CSS Generation for Device Outputs
 *
 * Functions for converting control values to CSS properties
 * NEW ARCHITECTURE: Works with control-based values instead of DMX arrays
 */

import { DEVICE_TYPES } from './devices.js';
import { CONTROL_CSS_MAPPING } from '../css/mapping/controlToCssMapping.js';

/**
 * Get CSS properties from control values
 *
 * NEW: Accepts control values object instead of DMX array
 *
 * @param {Object} controlValues - Control values object { "Color": { r, g, b }, "Dimmer": 255, ... }
 * @param {Array} controls - Array of control definitions from device type
 * @returns {Object} CSS properties object
 */
export function getProperties(controlValues, controls) {
	const properties = {};

	for (const control of controls) {
		const controlValue = controlValues[control.name];
		if (controlValue === undefined) continue;

		const mapping = CONTROL_CSS_MAPPING[control.type.type];  // control.type is ControlType instance
		if (!mapping) continue;

		if (control.type.type === 'xypad') {
			// XY Pad control (e.g., Pan/Tilt)
			const xValue = controlValue.x ?? 128;
			const yValue = controlValue.y ?? 128;

			properties[mapping.properties.x.name] = mapping.properties.x.convert(xValue);
			properties[mapping.properties.y.name] = mapping.properties.y.convert(yValue);

		} else if (control.type.type === 'rgb' || control.type.type === 'rgba') {
			// RGB/RGBA Color control
			const r = controlValue.r ?? 0;
			const g = controlValue.g ?? 0;
			const b = controlValue.b ?? 0;
			properties.color = `rgb(${r}, ${g}, ${b})`;

		} else if (control.type.type === 'slider') {
			// Slider control (Dimmer, Intensity, White, Amber, etc.)
			const value = controlValue ?? 0;

			const propName = mapping.properties.value.getName(control.name);
			const propValue = mapping.properties.value.convert(value, control.name);
			properties[propName] = propValue;
		}
	}

	return properties;
}

/**
 * Generate CSS block for a single device's default values
 *
 * NEW: Works with control-based values
 *
 * @param {Object} device - Device object with type, defaultValues (control values), cssId, linkedTo
 * @returns {string|null} CSS block string or null if no CSS should be generated
 */
export function generateCSSBlock(device) {
	const deviceType = DEVICE_TYPES[device.type];
	if (!deviceType) return null;

	// Skip default values for linked devices
	if (device.linkedTo !== null) return null;

	// Get control values from device (NEW: control values object, not DMX array)
	const controlValues = device.defaultValues || {};

	// Generate CSS properties from control values
	const properties = getProperties(controlValues, deviceType.controls);

	if (Object.keys(properties).length === 0) return null;

	// Convert properties object to CSS string
	const props = Object.entries(properties)
		.map(([prop, value]) => `  ${prop}: ${value};`)
		.join('\n');

	return `#${device.cssId} {\n${props}\n}`;
}
