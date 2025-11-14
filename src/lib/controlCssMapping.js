/**
 * Control to CSS Mapping Configuration
 *
 * This module defines how DMX control types map to CSS properties and values.
 * Used across animations, triggers, and device defaults to ensure consistent
 * CSS generation from DMX values.
 */

import { getDeviceColor } from './colorUtils.js';

/**
 * Control to CSS mapping configuration
 * Defines how each control type maps to CSS properties and how values are converted
 */
export const CONTROL_CSS_MAPPING = {
	// XY Pad controls (Pan/Tilt for moving heads)
	xypad: {
		properties: {
			x: {
				name: '--pan',
				// Convert DMX 0-255 to -50% to +50%
				convert: (value) => `${((value / 255) * 100 - 50).toFixed(1)}%`
			},
			y: {
				name: '--tilt',
				// Convert DMX 0-255 to 0% to 100%
				convert: (value) => `${((value / 255) * 100).toFixed(1)}%`
			}
		}
	},
	// RGB Color controls
	rgb: {
		properties: {
			// Uses all RGB values together to generate color
			color: {
				name: 'color',
				// Special case: uses getDeviceColor with all values
				convert: 'color'
			}
		}
	},
	// Slider controls (Dimmer, Intensity, White, Amber, etc.)
	slider: {
		properties: {
			value: {
				// Property name depends on control name
				getName: (controlName) => {
					if (controlName === 'Dimmer' || controlName === 'Intensity') {
						return '--intensity';
					}
					if (controlName === 'White') {
						return '--white';
					}
					if (controlName === 'Amber') {
						return '--amber';
					}
					// Default for other sliders
					return `--${controlName.toLowerCase().replace(/\s+/g, '-')}`;
				},
				// Convert DMX 0-255 based on control type
				convert: (value, controlName) => {
					if (controlName === 'Dimmer' || controlName === 'Intensity') {
						// Convert to 0.0-1.0 for intensity
						return (value / 255).toFixed(3);
					}
					if (controlName === 'White' || controlName === 'Amber') {
						// Convert to percentage 0% to 100%
						return `${((value / 255) * 100).toFixed(1)}%`;
					}
					// For other sliders, use raw DMX value
					return value.toString();
				}
			}
		}
	}
};

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
		}
	}

	return properties;
}
