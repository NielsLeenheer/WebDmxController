/**
 * CSS Sampler
 *
 * Samples CSS computed styles from device elements and converts them to DMX channel values
 * Uses control metadata (getSamplingConfig) for conversions
 */

import { DEVICE_TYPES } from '../outputs/devices.js';

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
			const newCssIdentifier = device.cssIdentifier;

			if (!element) {
				element = document.createElement('div');
				element.id = newCssIdentifier;
				element.className = 'dmx-device';
				element.dataset.deviceType = device.type;
				this.container.appendChild(element);
				this.deviceElements.set(device.id, element);
			} else {
				// Update element ID if CSS ID changed
				if (element.id !== newCssIdentifier) {
					element.id = newCssIdentifier;
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

		// Sample CSS properties based on device controls (NEW: no components)
		const channels = this.sampleCSSProperties(computed, deviceType.controls);

		// Store current values for next comparison
		this.previousValues.set(device.id, { ...channels });

		return channels;
	}

	/**
	 * Sample CSS properties based on device controls and convert to control values
	 * Uses control metadata (getSamplingConfig) for conversions
	 *
	 * @param {CSSStyleDeclaration} computed - Computed style from getComputedStyle()
	 * @param {Array} controls - Array of control definitions from device type
	 * @returns {Object} Control values object keyed by device control id
	 */
	sampleCSSProperties(computed, controls) {
		const result = {};

		for (const control of controls) {
			const samplingConfig = control.type.getSamplingConfig?.();
			if (!samplingConfig) continue;

			// Handle multi-property controls (XY pads)
			if (samplingConfig.properties) {
				const controlValue = {};
				for (const propConfig of samplingConfig.properties) {
					const cssValue = computed.getPropertyValue(propConfig.cssProperty);
					if (cssValue) {
						const sampled = propConfig.parse(cssValue);
						if (sampled !== null && sampled !== undefined) {
							// Merge component values (e.g., {pan: 128}, {tilt: 128})
							Object.assign(controlValue, sampled);
						}
					}
				}
				if (Object.keys(controlValue).length > 0) {
					result[control.id] = controlValue;
				}
			}
			// Handle single-property controls (sliders, toggles, RGB)
			else if (samplingConfig.cssProperty) {
				// Get CSS value
				let cssValue;
				if (samplingConfig.cssProperty.startsWith('--')) {
					cssValue = computed.getPropertyValue(samplingConfig.cssProperty);
				} else {
					// Standard CSS property (e.g., 'color')
					cssValue = computed[samplingConfig.cssProperty];
				}

				if (cssValue) {
					const sampled = samplingConfig.parse(cssValue);
					if (sampled !== null && sampled !== undefined) {
						// For single-property controls, store the value under the control id
						// Note: sampled can be 0 which is valid, so we check !== null/undefined
						result[control.id] = sampled;
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
