/**
 * Device Library with built-in Svelte reactivity
 *
 * Manages the collection of DMX devices with:
 * - Automatic reactivity using $state
 * - UUID-based device IDs
 * - Automatic linked device propagation
 * - CSS flexbox order for visual sorting
 * - Control-based value storage (NEW ARCHITECTURE)
 */

import { Library } from './Library.svelte.js';
import { DEVICE_TYPES } from './outputs/devices.js';
import { createDefaultControlValues, mergeControlValues, mirrorPanTilt } from './outputs/controls.js';
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
	 * @param {Array<string>|null} syncedControls - Control names to sync when linked
	 * @param {boolean} mirrorPan - Mirror pan values for linked devices
	 * @returns {Object} The created device
	 */
	create(type, startChannel, name = '', linkedTo = null, cssId = null, syncedControls = null, mirrorPan = false) {
		const deviceType = DEVICE_TYPES[type];
		const deviceName = name || `${deviceType.name} ${this.items.length + 1}`;

		const device = {
			// id and order will be auto-set by base class
			type,
			startChannel,
			name: deviceName,
			// NEW: Control-based values instead of DMX arrays
			defaultValues: createDefaultControlValues(deviceType),
			linkedTo,
			syncedControls,
			mirrorPan,
			cssId: cssId || toCSSIdentifier(deviceName)
		};

		return this.add(device);
	}

	/**
	 * Update device control value and propagate to linked devices
	 * @param {string} deviceId - Device ID
	 * @param {string} controlName - Control name (e.g., 'Color', 'Dimmer', 'Pan/Tilt')
	 * @param {*} value - New control value (object, number, etc.)
	 */
	updateValue(deviceId, controlName, value) {
		const device = this.get(deviceId);
		if (!device) return;

		// Update control value (reactivity handled by $state)
		// Deep copy if object to avoid reference sharing
		if (typeof value === 'object' && value !== null) {
			device.defaultValues[controlName] = { ...value };
		} else {
			device.defaultValues[controlName] = value;
		}

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
				// Determine which controls to sync
				// If syncedControls is specified, use that list
				// Otherwise, sync all common controls
				const controlsToSync = device.syncedControls ||
					Object.keys(sourceDevice.defaultValues).filter(
						name => name in device.defaultValues
					);

				// Merge control values from source to target
				for (const controlName of controlsToSync) {
					let value = sourceDevice.defaultValues[controlName];

					// Apply pan mirroring if enabled and this is a Pan/Tilt control
					if (device.mirrorPan && controlName === 'Pan/Tilt') {
						value = mirrorPanTilt(value);
					}

					// Update control value (reactivity handled by $state)
					if (typeof value === 'object' && value !== null) {
						device.defaultValues[controlName] = { ...value };
					} else {
						device.defaultValues[controlName] = value;
					}
				}
			}
		}
	}

	/**
	 * Clear all device values (reset to defaults)
	 */
	clearAllValues() {
		for (const device of this.items) {
			const deviceType = DEVICE_TYPES[device.type];
			// Reset to default control values
			device.defaultValues = createDefaultControlValues(deviceType);
		}
		this.save();
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
		// Check if defaultValues is an array (old format) or object (new format)
		let defaultValues;
		if (Array.isArray(deviceData.defaultValues)) {
			// OLD FORMAT: DMX array - convert to control values
			// For now, just reset to defaults (no users to migrate)
			const deviceType = DEVICE_TYPES[deviceData.type];
			defaultValues = createDefaultControlValues(deviceType);
			console.log(`Migrated device "${deviceData.name}" from DMX array to control values`);
		} else {
			// NEW FORMAT: Control-based values - deep copy
			defaultValues = {};
			for (const [key, value] of Object.entries(deviceData.defaultValues)) {
				if (typeof value === 'object' && value !== null) {
					defaultValues[key] = { ...value };
				} else {
					defaultValues[key] = value;
				}
			}
		}

		return {
			id: deviceData.id,
			type: deviceData.type,
			startChannel: deviceData.startChannel,
			name: deviceData.name,
			defaultValues,
			linkedTo: deviceData.linkedTo || null,
			syncedControls: deviceData.syncedControls || null,
			mirrorPan: deviceData.mirrorPan || false,
			cssId: deviceData.cssId,
			order: deviceData.order !== undefined ? deviceData.order : index
		};
	}
}
