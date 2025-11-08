/**
 * CSS Engine
 *
 * Generates CSS from animations and mappings, and samples CSS
 * computed styles to extract DMX values.
 */

import { DEVICE_TYPES } from './devices.js';

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

		// Header comment
		parts.push('/* DMX Controller - Generated CSS */');
		parts.push('/* This stylesheet is auto-generated from your animations and input mappings */');
		parts.push('/* You can edit this CSS and the changes will be reflected in the interface */\n');

		// Animations (@keyframes)
		const animationsCSS = this.animationLibrary.toCSS();
		if (animationsCSS) {
			parts.push('/* === Animations === */');
			parts.push(animationsCSS);
			parts.push('');
		}

		// Input mappings (trigger mode)
		const mappingsCSS = this.mappingLibrary.toCSS(devices);
		if (mappingsCSS) {
			parts.push('/* === Input Mappings === */');
			parts.push(mappingsCSS);
			parts.push('');
		}

		// Custom properties for direct mode (documentation)
		const directMappings = this.mappingLibrary.getDirectMappings();
		if (directMappings.length > 0) {
			parts.push('/* === Custom Properties (Direct Control) === */');
			parts.push('/* These properties are updated live via JavaScript */');
			parts.push(':root {');

			for (const mapping of directMappings) {
				const propName = mapping.getPropertyName();
				const defaultValue = mapping.mapValue(0);
				parts.push(`  ${propName}: ${defaultValue}; /* ${mapping.name} */`);
			}

			parts.push('}\n');
		}

		return parts.join('\n');
	}
}

/**
 * Samples CSS computed styles from device elements
 */
export class CSSSampler {
	constructor() {
		this.deviceElements = new Map(); // deviceId -> HTMLElement
		this.container = null;
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

			if (!element) {
				element = document.createElement('div');
				element.id = `device-${device.id}`;
				element.className = 'dmx-device';
				element.dataset.deviceType = device.type;
				this.container.appendChild(element);
				this.deviceElements.set(device.id, element);
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
		if (!element) return null;

		const computed = window.getComputedStyle(element);
		const channels = {};

		switch (device.type) {
			case DEVICE_TYPES.RGB:
				Object.assign(channels, this._sampleRGB(computed));
				break;

			case DEVICE_TYPES.RGBA:
				Object.assign(channels, this._sampleRGBA(computed));
				break;

			case DEVICE_TYPES.RGBW:
				Object.assign(channels, this._sampleRGBW(computed));
				break;

			case DEVICE_TYPES.DIMMER:
				Object.assign(channels, this._sampleDimmer(computed));
				break;

			case DEVICE_TYPES.SMOKE:
				Object.assign(channels, this._sampleSmoke(computed));
				break;

			case DEVICE_TYPES.MOVING_HEAD:
				Object.assign(channels, this._sampleMovingHead(computed));
				break;
		}

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
	 * Sample RGB channels from color property
	 */
	_sampleRGB(computed) {
		const color = this._parseColor(computed.color);
		return {
			Red: color.r,
			Green: color.g,
			Blue: color.b
		};
	}

	/**
	 * Sample RGBA channels
	 */
	_sampleRGBA(computed) {
		const color = this._parseColor(computed.color);
		return {
			Red: color.r,
			Green: color.g,
			Blue: color.b,
			Amber: color.a * 255 // Use alpha for amber
		};
	}

	/**
	 * Sample RGBW channels
	 */
	_sampleRGBW(computed) {
		const color = this._parseColor(computed.color);

		// Calculate white channel from RGB (use minimum value)
		const white = Math.min(color.r, color.g, color.b);

		return {
			Red: color.r,
			Green: color.g,
			Blue: color.b,
			White: white
		};
	}

	/**
	 * Sample dimmer from opacity
	 */
	_sampleDimmer(computed) {
		const opacity = parseFloat(computed.opacity) || 1;
		return {
			Intensity: Math.round(opacity * 255)
		};
	}

	/**
	 * Sample smoke machine from custom property
	 */
	_sampleSmoke(computed) {
		const output = computed.getPropertyValue('--smoke-output') || '0';
		const value = parseFloat(output);

		return {
			Output: Math.round(Math.max(0, Math.min(255, value)))
		};
	}

	/**
	 * Sample moving head (pan/tilt from translate, colors, dimmer)
	 */
	_sampleMovingHead(computed) {
		const color = this._parseColor(computed.color);
		const opacity = parseFloat(computed.opacity) || 1;

		// Parse translate for pan/tilt
		const translate = this._parseTranslate(computed.translate);

		return {
			Pan: translate.x,
			Tilt: translate.y,
			Dimmer: Math.round(opacity * 255),
			Red: color.r,
			Green: color.g,
			Blue: color.b,
			White: Math.min(color.r, color.g, color.b)
		};
	}

	/**
	 * Parse CSS color to RGB values (0-255)
	 */
	_parseColor(colorString) {
		// Handle rgb(), rgba(), hex, named colors
		const div = document.createElement('div');
		div.style.color = colorString;
		document.body.appendChild(div);
		const computed = window.getComputedStyle(div).color;
		document.body.removeChild(div);

		// Parse rgb(r, g, b) or rgba(r, g, b, a)
		const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

		if (match) {
			return {
				r: parseInt(match[1]),
				g: parseInt(match[2]),
				b: parseInt(match[3]),
				a: match[4] ? parseFloat(match[4]) : 1
			};
		}

		return { r: 0, g: 0, b: 0, a: 1 };
	}

	/**
	 * Parse CSS translate property to pan/tilt values (0-255)
	 */
	_parseTranslate(translateString) {
		if (!translateString || translateString === 'none') {
			return { x: 127, y: 127 }; // Default to center
		}

		// Parse translate(x, y) or translate(x y)
		const match = translateString.match(/translate\(([^,)]+)(?:,?\s+([^)]+))?\)/);

		if (match) {
			const x = this._parsePercentage(match[1]);
			const y = match[2] ? this._parsePercentage(match[2]) : x;

			return {
				x: Math.round(x * 255 / 100),
				y: Math.round(y * 255 / 100)
			};
		}

		return { x: 127, y: 127 };
	}

	/**
	 * Parse percentage value
	 */
	_parsePercentage(value) {
		const num = parseFloat(value);

		if (value.includes('%')) {
			return Math.max(0, Math.min(100, num));
		}

		// If not percentage, assume 0-255 range
		return Math.max(0, Math.min(100, (num / 255) * 100));
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
