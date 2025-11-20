/**
 * CSS Generator
 *
 * Generates a complete CSS stylesheet from animations, inputs, triggers, and devices
 */

import { getDeviceColor } from '../colorUtils.js';
import { DEVICE_TYPES } from '../outputs/devices.js';
import { CONTROL_CSS_MAPPING } from './mapping/controlToCssMapping.js';

export class CSSGenerator {
	constructor(animationLibrary, inputLibrary, triggerLibrary) {
		this.animationLibrary = animationLibrary;
		this.inputLibrary = inputLibrary;
		this.triggerLibrary = triggerLibrary;
	}

	/**
	 * Generate complete CSS stylesheet
	 */
	generate(devices = []) {
		const parts = [];

		// Default device values
		if (devices.length > 0) {
			parts.push('/* Default values ================== */');
			parts.push('');

			for (const device of devices) {
				const deviceDefaults = this._generateDeviceDefaults(device);
				if (deviceDefaults) {
					parts.push(deviceDefaults);
				}
			}

			parts.push('');
		}

		// Animations (@keyframes)
		const animationsCSS = this.animationLibrary.toCSS();
		if (animationsCSS) {
			parts.push('/* Animations ================== */');
			parts.push('');
			parts.push(animationsCSS);
			parts.push('');
		}

		// Triggers
		const triggersCSS = this.triggerLibrary.toCSS(devices);
		if (triggersCSS) {
			parts.push('/* Triggers ================== */');
			parts.push('');
			parts.push(triggersCSS);
			parts.push('');
		}

		// User customization section
		parts.push('/* Add your custom CSS below to override device defaults and apply animations */');
		return parts.join('\n');
	}

	/**
	 * Generate default CSS for a single device
	 */
	_generateDeviceDefaults(device) {
		const deviceType = DEVICE_TYPES[device.type];
		if (!deviceType) return null;

		// Skip default values for linked devices
		if (device.isLinked && device.isLinked()) {
			return null;
		}

		// Get default values from device
		const defaultValues = device.defaultValues || [];

		// Generate CSS properties from DMX values
		const properties = CSSGenerator.generateCSSProperties(
			deviceType.controls,
			deviceType.components,
			defaultValues,
			device.type
		);

		if (Object.keys(properties).length === 0) return null;

		// Convert properties object to CSS string
		const props = Object.entries(properties).map(([prop, value]) => `  ${prop}: ${value};`);

		return `#${device.cssId} {\n${props.join('\n')}\n}`;
	}

	/**
	 * Generate CSS properties from DMX values for a set of controls
	 *
	 * @param {Array} controls - Array of control definitions
	 * @param {Array} components - Array of component definitions
	 * @param {Array} values - DMX values (0-255)
	 * @param {string} deviceType - Device type (for color generation)
	 * @returns {Object} CSS properties object
	 */
	static generateCSSProperties(controls, components, values, deviceType) {
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
}

// Export standalone function for backward compatibility
export const generateCSSProperties = CSSGenerator.generateCSSProperties;
