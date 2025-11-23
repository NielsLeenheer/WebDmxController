/**
 * CSS Sampler
 *
 * Samples CSS computed styles from device elements and converts them to DMX channel values
 */

import { DEVICE_TYPES } from '../outputs/devices.js';
import { CSS_TO_DMX_MAPPING } from './mapping/cssToDmxMapping.js';
import { CONTROL_CSS_MAPPING } from './mapping/controlToCssMapping.js';

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

		// Sample CSS properties based on device controls
		const channels = this.sampleCSSProperties(computed, deviceType.controls, deviceType.components);

		// Store current values for next comparison
		this.previousValues.set(device.id, { ...channels });

		return channels;
	}

	/**
	 * Sample CSS properties based on device controls and convert to DMX component values
	 * This is the inverse of generateCSSProperties - it reads CSS and produces DMX values
	 *
	 * @param {CSSStyleDeclaration} computed - Computed style from getComputedStyle()
	 * @param {Array} controls - Array of control definitions from device type
	 * @param {Array} components - Array of component definitions (with name and channel)
	 * @returns {Object} Map of component names to DMX values (e.g., {Red: 255, Green: 128, Blue: 0})
	 */
	sampleCSSProperties(computed, controls, components) {
		const result = {};

		// Process each control
		for (const control of controls) {
			const controlType = control.type.type; // Get string type from ControlType instance
			const mapping = CONTROL_CSS_MAPPING[controlType];
			if (!mapping) continue;

			if (controlType === 'xypad' || controlType === 'xypad16') {
				// XY Pad control (e.g., Pan/Tilt)
				const xComponent = components[control.components.x];
				const yComponent = components[control.components.y];

				// Sample X property (pan)
				const xValue = computed.getPropertyValue(mapping.properties.x.name);
				if (xValue) {
					const xMapping = CSS_TO_DMX_MAPPING[mapping.properties.x.name];
					if (xMapping) {
						const sampledX = xMapping.sample(xValue);
						Object.assign(result, sampledX);
					}
				}

				// Sample Y property (tilt)
				const yValue = computed.getPropertyValue(mapping.properties.y.name);
				if (yValue) {
					const yMapping = CSS_TO_DMX_MAPPING[mapping.properties.y.name];
					if (yMapping) {
						const sampledY = yMapping.sample(yValue);
						Object.assign(result, sampledY);
					}
				}

			} else if (controlType === 'rgb' || controlType === 'rgba') {
				// RGB Color control - sample the color property
				const colorValue = computed.color;
				if (colorValue) {
					const colorMapping = CSS_TO_DMX_MAPPING['color'];
					const sampledColor = colorMapping.sample(colorValue);
					Object.assign(result, sampledColor);
				}

			} else if (controlType === 'slider') {
				// Slider control (Dimmer, Intensity, White, Amber, etc.)
				const component = components[control.components.value];
				const propName = mapping.properties.value.getName(control.name);

				let cssValue = computed.getPropertyValue(propName);

				// For intensity/dimmer, also check opacity as fallback
				if (!cssValue && (control.name === 'Dimmer' || control.name === 'Intensity')) {
					cssValue = computed.opacity;
					if (cssValue) {
						const opacityMapping = CSS_TO_DMX_MAPPING['opacity'];
						const sampledOpacity = opacityMapping.sample(cssValue);
						result[component.name] = sampledOpacity.Intensity || sampledOpacity.Dimmer;
					}
				} else if (cssValue) {
					const cssMapping = CSS_TO_DMX_MAPPING[propName];
					if (cssMapping) {
						const sampledValue = cssMapping.sample(cssValue);
						// Map to the actual component name
						Object.assign(result, sampledValue);
					}
				}

			} else if (controlType === 'toggle') {
				// Toggle control (Safety, etc.)
				const component = components[control.components.value];
				const propName = mapping.properties.value.getName(control.name);
				const cssValue = computed.getPropertyValue(propName);

				if (cssValue) {
					const cssMapping = CSS_TO_DMX_MAPPING[propName];
					if (cssMapping) {
						const sampledValue = cssMapping.sample(cssValue);
						Object.assign(result, sampledValue);
					}
				}
			}
		}

		return result;
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
