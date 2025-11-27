/**
 * CSS Generation for Device Outputs
 *
 * Functions for converting control values to CSS properties
 * Uses control metadata (getValueMetadata) for property names and value conversion
 */

import { DEVICE_TYPES } from './devices.js';

/**
 * Convert a DMX value to CSS value using control metadata
 * @param {number} dmxValue - DMX value (0-255 or 0-65535)
 * @param {Object} meta - Value metadata from getValueMetadata()
 * @returns {string} CSS value with unit
 */
function dmxToCssValue(dmxValue, meta) {
	const dmxRange = meta.dmxMax - meta.dmxMin;
	const cssRange = meta.max - meta.min;
	const normalized = (dmxValue - meta.dmxMin) / dmxRange;
	const cssValue = normalized * cssRange + meta.min;

	// Format based on unit
	if (meta.unit === '%') {
		return `${cssValue.toFixed(1)}%`;
	} else if (meta.unit === '') {
		// Unitless - check if it should be integer or decimal
		if (Number.isInteger(meta.min) && Number.isInteger(meta.max) && meta.max > 1) {
			return Math.round(cssValue).toString();
		}
		return cssValue.toFixed(3);
	}
	return cssValue.toString();
}

/**
 * Get CSS properties from control values
 *
 * @param {Object} controlValues - Control values object { "Color": { r, g, b }, "Dimmer": 255, ... }
 * @param {Array} controls - Array of control definitions from device type
 * @param {Object} options - Optional settings
 * @param {boolean} options.includeColorProperty - Include combined color property (only for device defaults)
 * @returns {Object} CSS properties object
 */
export function getProperties(controlValues, controls, options = {}) {
	const properties = {};
	const { includeColorProperty = false } = options;

	for (const control of controls) {
		const controlValue = controlValues[control.id];
		if (controlValue === undefined) continue;

		const meta = control.type.getValueMetadata?.();
		if (!meta) continue;

		if (control.type.type === 'xypad' || control.type.type === 'xypad16') {
			// XY Pad control (e.g., Pan/Tilt) - has multiple values
			const panValue = controlValue.pan ?? 128;
			const tiltValue = controlValue.tilt ?? 128;

			if (meta.values) {
				const panMeta = meta.values[0];
				const tiltMeta = meta.values[1];
				properties[panMeta.cssProperty] = dmxToCssValue(panValue, panMeta);
				properties[tiltMeta.cssProperty] = dmxToCssValue(tiltValue, tiltMeta);
			}

		} else if (control.type.type === 'rgb') {
			// RGB Color control - has multiple values
			const r = controlValue.red ?? 0;
			const g = controlValue.green ?? 0;
			const b = controlValue.blue ?? 0;

			if (meta.values) {
				const rMeta = meta.values[0];
				const gMeta = meta.values[1];
				const bMeta = meta.values[2];
				const colorMeta = meta.values[3];
				properties[rMeta.cssProperty] = dmxToCssValue(r, rMeta);
				properties[gMeta.cssProperty] = dmxToCssValue(g, gMeta);
				properties[bMeta.cssProperty] = dmxToCssValue(b, bMeta);

				// Only include combined color property for device defaults
				if (includeColorProperty && colorMeta) {
					properties[colorMeta.cssProperty] = colorMeta.value;
				}
			}

		} else if (control.type.type === 'toggle') {
			// Toggle control
			const value = controlValue ?? control.type.offValue;
			const toggleMeta = meta.values?.[0] || meta;
			const isOn = value >= toggleMeta.dmxOn;
			properties[toggleMeta.cssProperty] = isOn ? toggleMeta.on : toggleMeta.off;

		} else if (control.type.type === 'slider') {
			// Slider control (Dimmer, Intensity, White, Amber, etc.)
			const value = controlValue ?? 0;
			const sliderMeta = meta.values?.[0] || meta;
			properties[sliderMeta.cssProperty] = dmxToCssValue(value, sliderMeta);
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

	// Generate CSS properties from control values (include color property for device defaults)
	const properties = getProperties(controlValues, deviceType.controls, { includeColorProperty: true });

	if (Object.keys(properties).length === 0) return null;

	// Convert properties object to CSS string
	const props = Object.entries(properties)
		.map(([prop, value]) => `  ${prop}: ${value};`)
		.join('\n');

	return `#${device.cssId} {\n${props}\n}`;
}
