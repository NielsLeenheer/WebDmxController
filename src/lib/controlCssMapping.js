/**
 * Control to CSS Mapping Configuration
 *
 * This module defines bidirectional mapping between DMX controls and CSS properties.
 * Used across animations, triggers, device defaults, and CSS sampling to ensure
 * consistent conversion in both directions.
 */

import { getDeviceColor } from './colorUtils.js';

/**
 * CSS to DMX mapping configuration (reverse direction)
 * Maps CSS property names to component names and conversion functions
 */
export const CSS_TO_DMX_MAPPING = {
	// Color property → RGB components
	'color': {
		// Parse RGB color and return multiple component values
		sample: (cssValue) => {
			const match = cssValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
			if (!match) return {};

			return {
				'Red': parseInt(match[1]),
				'Green': parseInt(match[2]),
				'Blue': parseInt(match[3])
			};
		},
		requiredComponents: ['Red', 'Green', 'Blue']
	},

	// Pan custom property
	'--pan': {
		// Convert -50% to +50% → 0-255 DMX (0% = center = 127.5)
		sample: (cssValue) => {
			const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(-50, Math.min(50, percent));
			const dmxValue = Math.round(((clamped + 50) / 100) * 255);

			return { 'Pan': dmxValue };
		},
		requiredComponents: ['Pan']
	},

	// Tilt custom property
	'--tilt': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'Tilt': dmxValue };
		},
		requiredComponents: ['Tilt']
	},

	// Intensity (opacity or --intensity)
	'--intensity': {
		// Convert 0.0-1.0 → 0-255 DMX
		sample: (cssValue) => {
			const value = parseFloat(cssValue) || 0;
			const clamped = Math.max(0, Math.min(1, value));
			const dmxValue = Math.round(clamped * 255);

			return { 'Intensity': dmxValue, 'Dimmer': dmxValue };
		},
		requiredComponents: [] // Can be either Intensity or Dimmer
	},

	// Opacity (alternative for intensity/dimmer)
	'opacity': {
		// Convert 0.0-1.0 → 0-255 DMX
		sample: (cssValue) => {
			const value = parseFloat(cssValue) || 1;
			const clamped = Math.max(0, Math.min(1, value));
			const dmxValue = Math.round(clamped * 255);

			return { 'Intensity': dmxValue, 'Dimmer': dmxValue };
		},
		requiredComponents: [] // Can be either Intensity or Dimmer
	},

	// White custom property
	'--white': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'White': dmxValue };
		},
		requiredComponents: ['White']
	},

	// Amber custom property
	'--amber': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'Amber': dmxValue };
		},
		requiredComponents: ['Amber']
	},

	// Smoke/Output custom property
	'--smoke': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'Output': dmxValue };
		},
		requiredComponents: ['Output']
	},

	// Fuel custom property
	'--fuel': {
		// Convert 0% to 100% → 0-255 DMX
		sample: (cssValue) => {
			const match = cssValue.match(/(\d+(?:\.\d+)?)/);
			const percent = match ? parseFloat(match[1]) : 0;
			const clamped = Math.max(0, Math.min(100, percent));
			const dmxValue = Math.round((clamped / 100) * 255);

			return { 'Fuel': dmxValue };
		},
		requiredComponents: ['Fuel']
	},

	// Safety custom property (special case)
	'--safety': {
		// Convert "none" or "probably" → 0 or 125 DMX
		sample: (cssValue) => {
			const value = cssValue.trim().toLowerCase();
			const dmxValue = value === 'probably' ? 125 : 0;

			return { 'Safety': dmxValue };
		},
		requiredComponents: ['Safety']
	}
};

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

/**
 * Sample CSS properties and convert to DMX component values
 * Only samples properties that the device supports
 *
 * @param {CSSStyleDeclaration} computed - Computed style from getComputedStyle()
 * @param {Array} components - Array of component definitions (with name and channel)
 * @returns {Object} Map of component names to DMX values
 */
export function sampleCSSProperties(computed, components) {
	const result = {};

	// Build set of available component names for quick lookup
	const availableComponents = new Set(components.map(c => c.name));

	// Helper to check if device has component(s)
	const hasComponent = (componentName) => availableComponents.has(componentName);
	const hasAllComponents = (componentNames) => componentNames.every(hasComponent);

	// Sample each CSS property
	for (const [propertyName, mapping] of Object.entries(CSS_TO_DMX_MAPPING)) {
		// Skip if device doesn't have required components
		if (mapping.requiredComponents.length > 0 && !hasAllComponents(mapping.requiredComponents)) {
			continue;
		}

		// Get the CSS value
		let cssValue;
		if (propertyName.startsWith('--')) {
			// Custom property
			cssValue = computed.getPropertyValue(propertyName);
			if (!cssValue) continue; // Property not set
		} else {
			// Standard property
			cssValue = computed[propertyName];
		}

		// Sample and convert to DMX values
		const sampledValues = mapping.sample(cssValue);

		// Only include components that this device actually has
		for (const [componentName, dmxValue] of Object.entries(sampledValues)) {
			if (hasComponent(componentName)) {
				result[componentName] = dmxValue;
			}
		}
	}

	return result;
}
