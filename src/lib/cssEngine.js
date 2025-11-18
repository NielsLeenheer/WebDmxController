/**
 * CSS Engine
 *
 * Generates CSS from animations and mappings, and samples CSS
 * computed styles to extract DMX values.
 */

import { DEVICE_TYPES } from './devices.js';
import { generateCSSProperties, sampleCSSProperties, sampleCSSPropertiesFromControls } from './controlCssMapping.js';

/**
 * Generates a complete CSS stylesheet from animations and mappings
 */
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

/**
 * Samples CSS computed styles from device elements
 */
export class CSSSampler {
	constructor() {
		this.deviceElements = new Map(); // deviceId -> HTMLElement
		this.container = null;
		this.previousValues = new Map(); // deviceId -> previous channel values (for change detection)
	}

	/**
	 * Initialize with a container element
	 */
	initialize(container) {
		this.container = container;
	}

	/**
	 * Create or update device elements
	 */
	updateDevices(devices) {
		if (!this.container) return;

		// Remove elements for deleted devices
		for (const [deviceId, element] of this.deviceElements) {
			if (!devices.find(d => d.id === deviceId)) {
				element.remove();
				this.deviceElements.delete(deviceId);
			}
		}

		// Create/update elements for current devices
		for (const device of devices) {
			let element = this.deviceElements.get(device.id);
			const newCssId = device.cssId;

			if (!element) {
				element = document.createElement('div');
				element.id = newCssId;
				element.className = 'dmx-device';
				element.dataset.deviceType = device.type;
				this.container.appendChild(element);
				this.deviceElements.set(device.id, element);
			} else {
				// Update element ID if CSS ID changed
				if (element.id !== newCssId) {
					element.id = newCssId;
				}
			}

			// Update data attributes
			element.dataset.deviceName = device.name;
			element.dataset.deviceType = device.type;
		}
	}

	/**
	 * Sample CSS values for a device and convert to DMX channels
	 */
	sampleDevice(device) {
		const element = this.deviceElements.get(device.id);
		if (!element) {
			console.warn(`[CSSSampler] No element found for device ${device.id}`);
			return null;
		}

		const deviceType = DEVICE_TYPES[device.type];
		if (!deviceType) {
			console.warn(`[CSSSampler] Unknown device type: ${device.type}`);
			return null;
		}

		// Force reflow to ensure getComputedStyle picks up changes
		element.offsetHeight; // Reading offsetHeight forces a reflow

		const computed = window.getComputedStyle(element);

		// Use control-based sampling function for accurate CSS-to-DMX conversion
		const channels = sampleCSSPropertiesFromControls(computed, deviceType.controls, deviceType.components);

		// Store current values for next comparison
		this.previousValues.set(device.id, { ...channels });

		return channels;
	}

	/**
	 * Sample all devices and return channel values
	 */
	sampleAll(devices) {
		const results = new Map(); // deviceId -> channels

		for (const device of devices) {
			const channels = this.sampleDevice(device);
			if (channels) {
				results.set(device.id, channels);
			}
		}

		return results;
	}

	/**
	 * Get device element
	 */
	getElement(deviceId) {
		return this.deviceElements.get(deviceId);
	}

	/**
	 * Clear all device elements
	 */
	clear() {
		for (const element of this.deviceElements.values()) {
			element.remove();
		}
		this.deviceElements.clear();
	}
}

/**
 * Manages custom CSS properties for direct mode mappings
 */
export class CustomPropertyManager {
	constructor() {
		this.properties = new Map(); // propertyName -> value
		this.styleElement = null;
	}

	/**
	 * Initialize by creating a style element
	 */
	initialize() {
		this.styleElement = document.createElement('style');
		this.styleElement.id = 'dmx-custom-properties';
		document.head.appendChild(this.styleElement);
		this._updateStyle();
	}

	/**
	 * Set a custom property value
	 */
	setProperty(name, value) {
		if (!name.startsWith('--')) {
			name = `--${name}`;
		}

		this.properties.set(name, value);
		this._updateStyle();
	}

	/**
	 * Get a custom property value
	 */
	getProperty(name) {
		if (!name.startsWith('--')) {
			name = `--${name}`;
		}

		return this.properties.get(name);
	}

	/**
	 * Update the style element
	 */
	_updateStyle() {
		if (!this.styleElement) return;

		const props = Array.from(this.properties.entries())
			.map(([name, value]) => `  ${name}: ${value};`)
			.join('\n');

		this.styleElement.textContent = `:root {\n${props}\n}`;
	}

	/**
	 * Get all properties
	 */
	getAll() {
		return Array.from(this.properties.entries()).map(([name, value]) => ({ name, value }));
	}

	/**
	 * Clear all properties
	 */
	clear() {
		this.properties.clear();
		this._updateStyle();
	}

	/**
	 * Cleanup
	 */
	destroy() {
		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = null;
		}
		this.properties.clear();
	}
}
