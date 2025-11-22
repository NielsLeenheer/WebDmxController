/**
 * Device Library with built-in Svelte reactivity
 *
 * Manages the collection of DMX devices with:
 * - Automatic reactivity using $state
 * - UUID-based device IDs
 * - Automatic linked device propagation
 * - CSS flexbox order for visual sorting
 */

import { Library } from './Library.svelte.js';
import { DEVICE_TYPES } from './outputs/devices.js';
import { applyLinkedValues } from './outputs/sync.js';
import { toCSSIdentifier } from './css/utils.js';
import { generateCSSBlock } from './outputs/css.js';

/**
 * Manages the collection of devices with built-in reactivity
 */
export class DeviceLibrary extends Library {
	constructor() {
		super('dmx-devices');
	}

	/**
	 * Create a new device
	 * @param {string} type - Device type (RGB, MOVING_HEAD, etc.)
	 * @param {number} startChannel - Starting DMX channel
	 * @param {string} name - Device name
	 * @param {string|null} linkedTo - ID of device to link to
	 * @param {string|null} cssId - CSS-safe ID
	 * @param {Array|null} syncedControls - Controls to sync when linked
	 * @param {boolean} mirrorPan - Mirror pan values for linked devices
	 * @returns {Object} The created device
	 */
	create(type, startChannel, name = '', linkedTo = null, cssId = null, syncedControls = null, mirrorPan = false) {
		const deviceName = name || `${DEVICE_TYPES[type].name} ${this.items.length + 1}`;

		const device = {
			// id and order will be auto-set by base class
			type,
			startChannel,
			name: deviceName,
			defaultValues: [...DEVICE_TYPES[type].getDefaultValues()],
			linkedTo,
			syncedControls,
			mirrorPan,
			cssId: cssId || toCSSIdentifier(deviceName)
		};

		return this.add(device);
	}

	/**
	 * Update device value and propagate to linked devices
	 * @param {string} deviceId - Device ID
	 * @param {number} channelIndex - Channel index to update
	 * @param {number} value - New value
	 */
	updateValue(deviceId, channelIndex, value) {
		const device = this.get(deviceId);
		if (!device) return;

		// Update value (reactivity handled by $state)
		device.defaultValues[channelIndex] = value;

		// Propagate to linked devices
		this.propagateToLinkedDevices(device);

		this.save();
	}

	/**
	 * Update device properties (name, startChannel, etc.)
	 * @param {string} deviceId - Device ID
	 * @param {Object} updates - Properties to update
	 * @returns {boolean} Success status
	 */
	update(deviceId, updates) {
		// Update CSS ID if name changed
		if (updates.name) {
			updates.cssId = toCSSIdentifier(updates.name);
		}

		return super.update(deviceId, updates);
	}

	/**
	 * Remove a device and unlink any devices that were linked to it
	 * @param {string} deviceId - Device ID to remove
	 */
	remove(deviceId) {
		// Unlink any devices that were linked to this device
		for (const device of this.items) {
			if (device.linkedTo === deviceId) {
				device.linkedTo = null;
			}
		}

		// Call parent remove method
		super.remove(deviceId);
	}

	/**
	 * Propagate value changes to all linked devices
	 * @param {Object} sourceDevice - Source device that changed
	 */
	propagateToLinkedDevices(sourceDevice) {
		// Find all devices linked to this source device
		for (const device of this.items) {
			if (device.linkedTo === sourceDevice.id) {
				// Apply linked values with selective syncing and pan mirroring
				const newValues = applyLinkedValues(
					sourceDevice.type,
					device.type,
					sourceDevice.defaultValues,
					device.defaultValues,
					device.syncedControls,
					device.mirrorPan
				);

				// Update values (reactivity handled by $state)
				newValues.forEach((value, index) => {
					device.defaultValues[index] = value;
				});
			}
		}
	}

	/**
	 * Clear all device values (reset to defaults)
	 */
	clearAllValues() {
		for (const device of this.items) {
			const defaultValues = DEVICE_TYPES[device.type].getDefaultValues();
			defaultValues.forEach((value, index) => {
				device.defaultValues[index] = value;
			});
		}
	}

	/**
	 * Generate CSS for device default values
	 * @returns {string} CSS string
	 */
	toCSS() {
		const blocks = this.getAll()
			.map(device => generateCSSBlock(device))
			.filter(block => block !== null);

		return blocks.join('\n\n');
	}

	/**
	 * Deserialize device from localStorage
	 * @param {Object} deviceData - Raw device data from storage
	 * @param {number} index - Index in array
	 * @returns {Object} Deserialized device
	 */
	deserializeItem(deviceData, index) {
		return {
			id: deviceData.id,
			type: deviceData.type,
			startChannel: deviceData.startChannel,
			name: deviceData.name,
			defaultValues: [...deviceData.defaultValues],
			linkedTo: deviceData.linkedTo || null,
			syncedControls: deviceData.syncedControls || null,
			mirrorPan: deviceData.mirrorPan || false,
			cssId: deviceData.cssId,
			order: deviceData.order !== undefined ? deviceData.order : index
		};
	}
}
