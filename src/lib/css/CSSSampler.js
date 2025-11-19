/**
 * CSS Sampler
 *
 * Samples CSS computed styles from device elements and converts them to DMX channel values
 */

import { DEVICE_TYPES } from '../outputs/devices.js';
import { sampleCSSPropertiesFromControls } from './mapping/index.js';

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
