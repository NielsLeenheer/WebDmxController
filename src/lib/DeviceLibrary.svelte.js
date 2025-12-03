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
import { createDefaultControlValues, mirrorPanTilt } from './outputs/controls.js';
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
	 * @param {string} type - Device type (rgb, moving-head, etc.)
	 * @returns {Object} The created device
	 */
	create(type) {
		const deviceType = DEVICE_TYPES[type];
		const name = this._generateUniqueName(deviceType.name);

		const device = {
			// id and order will be auto-set by base class
			type,
			startChannel: this.getNextFreeChannel(),
			name,
			defaultValues: createDefaultControlValues(deviceType),
			linkedTo: null,
			syncedControls: null,
			mirrorPan: false,
			cssIdentifier: toCSSIdentifier(name)
		};

		return this.add(device);
	}

	/**
	 * Get the next free DMX channel after all existing devices
	 * @returns {number} Next available channel (0-indexed), or 0 if over 512
	 */
	getNextFreeChannel() {
		if (this.items.length === 0) return 0;

		// Find the highest used channel
		let maxChannel = 0;
		for (const device of this.items) {
			const deviceType = DEVICE_TYPES[device.type];
			if (deviceType) {
				const deviceEndChannel = device.startChannel + deviceType.channels;
				if (deviceEndChannel > maxChannel) {
					maxChannel = deviceEndChannel;
				}
			}
		}

		// Return next free channel, or wrap to 0 if over 512
		return maxChannel >= 512 ? 0 : maxChannel;
	}

	/**
	 * Generate a unique name for a device
	 * First device of a type gets the base name (e.g., "RGB Light")
	 * Subsequent devices get numbered names (e.g., "RGB Light 2", "RGB Light 3")
	 * @param {string} baseName - Base name from device type
	 * @returns {string} Unique device name
	 */
	_generateUniqueName(baseName) {
		// Get all existing names
		const existingNames = new Set(this.items.map(d => d.name));

		// If base name is available, use it
		if (!existingNames.has(baseName)) {
			return baseName;
		}

		// Find the next available number
		let number = 2;
		while (existingNames.has(`${baseName} ${number}`)) {
			number++;
		}

		return `${baseName} ${number}`;
	}

	/**
	 * Update device control value and propagate to linked devices
	 * @param {string} deviceId - Device ID
	 * @param {string} controlId - Control type id (e.g., 'color', 'dimmer', 'pantilt')
	 * @param {*} value - New control value (object, number, etc.)
	 */
	updateValue(deviceId, controlId, value) {
		const device = this.get(deviceId);
		if (!device) return;

		// Update control value (reactivity handled by $state)
		// Deep copy if object to avoid reference sharing
		if (typeof value === 'object' && value !== null) {
			device.defaultValues[controlId] = { ...value };
		} else {
			device.defaultValues[controlId] = value;
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
			updates.cssIdentifier = toCSSIdentifier(updates.name);
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
						id => id in device.defaultValues
					);

				// Merge control values from source to target
				for (const controlId of controlsToSync) {
					let value = sourceDevice.defaultValues[controlId];

					// Apply pan mirroring if enabled and this is a Pan/Tilt control
					if (device.mirrorPan && controlId === 'pantilt') {
						value = mirrorPanTilt(value);
					}

					// Update control value (reactivity handled by $state)
					if (typeof value === 'object' && value !== null) {
						device.defaultValues[controlId] = { ...value };
					} else {
						device.defaultValues[controlId] = value;
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
		// Deep copy control values
		const defaultValues = {};
		for (const [key, value] of Object.entries(deviceData.defaultValues || {})) {
			if (typeof value === 'object' && value !== null) {
				defaultValues[key] = { ...value };
			} else {
				defaultValues[key] = value;
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
			cssIdentifier: deviceData.cssIdentifier || deviceData.cssId,
			order: deviceData.order !== undefined ? deviceData.order : index
		};
	}

	/**
	 * Migrate old device type IDs to new format
	 * Call this manually to update devices stored with old UPPERCASE_WITH_UNDERSCORE IDs
	 * to new lowercase-with-dash format
	 * 
	 * Usage: deviceLibrary.migrateDeviceTypeIds()
	 */
	migrateDeviceTypeIds() {
		const typeIdMap = {
			'RGB': 'rgb',
			'RGBA': 'rgba',
			'RGBW': 'rgbw',
			'DIMMER': 'dimmer',
			'SMOKE': 'smoke',
			'MOVING_HEAD': 'moving-head',
			'MOVING_HEAD_11CH': 'moving-head-11ch',
			'FLAMETHROWER': 'flamethrower'
		};

		let migratedCount = 0;

		for (const device of this.items) {
			if (typeIdMap[device.type]) {
				console.log(`Migrating device "${device.name}": ${device.type} → ${typeIdMap[device.type]}`);
				device.type = typeIdMap[device.type];
				migratedCount++;
			}
		}

		if (migratedCount > 0) {
			this.save();
			console.log(`Migration complete. ${migratedCount} device(s) updated.`);
		} else {
			console.log('No devices needed migration.');
		}

		return migratedCount;
	}
}
