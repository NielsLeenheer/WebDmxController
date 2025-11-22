/**
 * CSS Generation for Device Outputs
 *
 * Functions for converting DMX channel values to CSS properties
 */

import { getDeviceColor } from './devices.js';
import { CONTROL_CSS_MAPPING } from '../css/mapping/controlToCssMapping.js';

/**
 * Generate CSS properties from DMX values for a set of controls
 *
 * @param {Array} controls - Array of control definitions
 * @param {Array} components - Array of component definitions
 * @param {Array} values - DMX values (0-255)
 * @param {string} deviceType - Device type (for color generation)
 * @returns {Object} CSS properties object
 */
export function generateCSSProperties(controls, components, values, deviceType) {
	const properties = {};

	for (const control of controls) {
		const mapping = CONTROL_CSS_MAPPING[control.type];
		if (!mapping) continue;

		if (control.type === 'xypad') {
			// XY Pad control (e.g., Pan/Tilt)
			const xChannel = components[control.components.x].channel;
			const yChannel = components[control.components.y].channel;
			const xValue = values[xChannel] || 0;
			const yValue = values[yChannel] || 0;

			properties[mapping.properties.x.name] = mapping.properties.x.convert(xValue);
			properties[mapping.properties.y.name] = mapping.properties.y.convert(yValue);

		} else if (control.type === 'rgb') {
			// RGB Color control - uses getDeviceColor
			properties.color = getDeviceColor(deviceType, values);

		} else if (control.type === 'slider') {
			// Slider control (Dimmer, Intensity, White, Amber, etc.)
			const channel = components[control.components.value].channel;
			const value = values[channel] || 0;

			const propName = mapping.properties.value.getName(control.name);
			const propValue = mapping.properties.value.convert(value, control.name);
			properties[propName] = propValue;

		} else if (control.type === 'toggle') {
			// Toggle control (Safety, etc.)
			const channel = components[control.components.value].channel;
			const value = values[channel] || 0;

			const propName = mapping.properties.value.getName(control.name);
			const propValue = mapping.properties.value.convert(value, control.name, control);
			properties[propName] = propValue;
		}
	}

	return properties;
}
