/**
 * CSS Generator
 *
 * Generates a complete CSS stylesheet from animations, mappings, and devices
 */

import { DEVICE_TYPES } from '../outputs/devices.js';
import { generateCSSProperties } from './controlCssMapping.js';

export class CSSGenerator {
	constructor(animationLibrary, mappingLibrary) {
		this.animationLibrary = animationLibrary;
		this.mappingLibrary = mappingLibrary;
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

		// Input mappings (trigger mode)
		const mappingsCSS = this.mappingLibrary.toCSS(devices);
		if (mappingsCSS) {
			parts.push('/* Triggers ================== */');
			parts.push('');
			parts.push(mappingsCSS);
			parts.push('');
		}

		// Custom properties for direct mode (documentation)
		const directMappings = this.mappingLibrary.getDirectMappings();
		if (directMappings.length > 0) {
			parts.push('/* Custom Properties ================== */');
			parts.push(':root {');

			for (const mapping of directMappings) {
				const propName = mapping.getPropertyName();
				const defaultValue = mapping.mapValue(0);
				parts.push(`  ${propName}: ${defaultValue}; /* ${mapping.name} */`);
			}

			parts.push('}\n');
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

		// Use shared control-to-CSS mapping
		const properties = generateCSSProperties(
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
}
