/**
 * Device Library with built-in Svelte reactivity
 *
 * Manages the collection of DMX devices with:
 * - Automatic reactivity using $state
 * - UUID-based device IDs
 * - Automatic linked device propagation
 * - CSS flexbox order for visual sorting
 */

import { Library } from '../Library.svelte.js';
import { DEVICE_TYPES } from './devices.js';
import { applyLinkedValues } from '../channelMapping.js';

/**
 * Manages the collection of devices with built-in reactivity
 */
export class DeviceLibrary extends Library {
	constructor() {
		super('dmx-devices');
	}

	/**
	 * Create a new device with auto-generated UUID
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
		const id = crypto.randomUUID();

		const device = {
			id,
			type,
			startChannel,
			name: name || `${DEVICE_TYPES[type].name} ${this.items.length + 1}`,
			defaultValues: [...DEVICE_TYPES[type].getDefaultValues()],
			linkedTo,
			syncedControls,
			mirrorPan,
			cssId: cssId || this.generateCssId(name || `${DEVICE_TYPES[type].name} ${this.items.length + 1}`),
			order: this.items.length // Order based on position in array
		};

		this.add(device);
		return device;
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
	 */
	updateDevice(deviceId, updates) {
		const device = this.get(deviceId);
		if (!device) return;

		// Apply updates
		Object.assign(device, updates);

		// Update CSS ID if name changed
		if (updates.name) {
			device.cssId = this.generateCssId(updates.name);
		}

		this.save();
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
		this.save();
	}

	/**
	 * Generate CSS-safe ID from device name
	 * @param {string} name - Device name
	 * @returns {string} CSS-safe ID
	 */
	generateCssId(name) {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '_')
			.replace(/_+/g, '_')
			.replace(/^_|_$/g, '');
	}

	/**
	 * Load from localStorage
	 * Items are automatically reactive since this.items is wrapped in $state
	 */
	load() {
		try {
			const data = localStorage.getItem(this.storageKey);
			if (data) {
				const parsed = JSON.parse(data);
				this.items = parsed.map((deviceData, index) => ({
					id: deviceData.id || crypto.randomUUID(), // Migrate old numeric IDs to UUIDs
					type: deviceData.type,
					startChannel: deviceData.startChannel,
					name: deviceData.name,
					defaultValues: [...(deviceData.defaultValues || DEVICE_TYPES[deviceData.type].getDefaultValues())],
					linkedTo: deviceData.linkedTo || null,
					syncedControls: deviceData.syncedControls || null,
					mirrorPan: deviceData.mirrorPan || false,
					cssId: deviceData.cssId || this.generateCssId(deviceData.name),
					order: deviceData.order !== undefined ? deviceData.order : index
				}));
			}
		} catch (error) {
			console.error('Failed to load devices:', error);
			this.items = [];
		}
	}

	/**
	 * Save to localStorage
	 */
	save() {
		try {
			const data = this.items.map(device => ({
				id: device.id,
				type: device.type,
				startChannel: device.startChannel,
				name: device.name,
				defaultValues: [...device.defaultValues],
				linkedTo: device.linkedTo,
				syncedControls: device.syncedControls,
				mirrorPan: device.mirrorPan,
				cssId: device.cssId,
				order: device.order
			}));
			localStorage.setItem(this.storageKey, JSON.stringify(data));
		} catch (error) {
			console.error('Failed to save devices:', error);
		}
	}
}
