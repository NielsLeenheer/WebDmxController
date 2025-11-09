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

		// Default device values
		if (devices.length > 0) {
			parts.push('/* === Default Device Values === */');
			parts.push('/* These selectors set the default state for each device */');

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
			parts.push('/* === Animations === */');
			parts.push(animationsCSS);
			parts.push('');
		}

		// Input mappings (trigger mode)
		const mappingsCSS = this.mappingLibrary.toCSS(devices);
		if (mappingsCSS) {
			parts.push('/* === Triggers === */');
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

		// User customization section
		parts.push('/* === Custom Styles === */');
		parts.push('/* Add your custom CSS below to override device defaults and apply animations */');
		parts.push('');

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

		const props = [];

		// Get default values from device
		const defaultValues = device.defaultValues || [];

		switch (device.type) {
			case 'RGB':
				const [r, g, b] = defaultValues;
				props.push(`  color: rgb(${r || 0}, ${g || 0}, ${b || 0});`);
				break;

			case 'RGBA':
				const [r2, g2, b2, a] = defaultValues;
				props.push(`  color: rgb(${r2 || 0}, ${g2 || 0}, ${b2 || 0});`);
				props.push(`  /* Amber channel: ${a || 0} */`);
				break;

			case 'RGBW':
				const [r3, g3, b3, w] = defaultValues;
				props.push(`  color: rgb(${r3 || 0}, ${g3 || 0}, ${b3 || 0});`);
				props.push(`  /* White channel: ${w || 0} */`);
				break;

			case 'DIMMER':
				const intensity = defaultValues[0] || 0;
				props.push(`  opacity: ${(intensity / 255).toFixed(2)};`);
				break;

			case 'SMOKE':
				const output = defaultValues[0] || 0;
				props.push(`  --smoke-output: ${output};`);
				break;

			case 'MOVING_HEAD':
				const [pan, tilt, dimmer, r4, g4, b4, w2] = defaultValues;
				const panPercent = pan !== undefined ? Math.round((pan / 255) * 100 - 50) : 0;
				const tiltPercent = tilt !== undefined ? Math.round((tilt / 255) * 100 - 50) : 0;
				props.push(`  translate: ${panPercent}% ${tiltPercent}%;`);
				props.push(`  opacity: ${dimmer !== undefined ? (dimmer / 255).toFixed(2) : '1'};`);
				props.push(`  color: rgb(${r4 || 0}, ${g4 || 0}, ${b4 || 0});`);
				if (w2 !== undefined) {
					props.push(`  /* White channel: ${w2} */`);
				}
				break;

			default:
				return null;
		}

		if (props.length === 0) return null;

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

		const computed = window.getComputedStyle(element);
		const channels = {};

		// Log element info for debugging (only first sample)
		if (!this.previousValues.has(device.id)) {
			console.log(`[CSSSampler] Sampling device ${device.id} (${device.name}):`, {
				elementId: element.id,
				className: element.className,
				parentClass: element.parentElement?.className,
				computedColor: computed.color,
				computedOpacity: computed.opacity
			});
		}

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

		// Log changes for debugging
		const previous = this.previousValues.get(device.id);
		if (previous) {
			// Check if any values changed
			let hasChanges = false;
			const changes = {};

			for (const [key, value] of Object.entries(channels)) {
				if (previous[key] !== value) {
					hasChanges = true;
					changes[key] = { from: previous[key], to: value };
				}
			}

			if (hasChanges) {
				console.log(`[CSSSampler] Device ${device.id} (${device.name}) values changed:`, {
					color: computed.color,
					opacity: computed.opacity,
					changes
				});
			}
		} else {
			// First sample for this device
			console.log(`[CSSSampler] Initial sample for device ${device.id} (${device.name}):`, {
				color: computed.color,
				opacity: computed.opacity,
				channels
			});
		}

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
	 * Sample RGB channels from color property
	 */
	_sampleRGB(computed) {
		const color = this._parseComputedColor(computed.color);
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
		const color = this._parseComputedColor(computed.color);
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
		const color = this._parseComputedColor(computed.color);

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
		const color = this._parseComputedColor(computed.color);
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
	 * Parse computed CSS color (already normalized by browser to rgb/rgba format)
	 * The browser converts all color formats (hex, hsl, named, etc.) to rgb() or rgba()
	 */
	_parseComputedColor(colorString) {
		// getComputedStyle always returns colors in rgb() or rgba() format
		// Parse rgb(r, g, b) or rgba(r, g, b, a)
		const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

		if (match) {
			return {
				r: parseInt(match[1]),
				g: parseInt(match[2]),
				b: parseInt(match[3]),
				a: match[4] ? parseFloat(match[4]) : 1
			};
		}

		// Fallback to black if parsing fails
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
