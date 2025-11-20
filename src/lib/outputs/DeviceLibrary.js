/**
 * Device Library
 *
 * Manages the collection of DMX devices following the same pattern as
 * AnimationLibrary, InputLibrary, and TriggerLibrary
 */

import { EventEmitter } from '../EventEmitter.js';
import { Device, DEVICE_TYPES } from './devices.js';

/**
 * Manages the collection of devices
 */
export class DeviceLibrary extends EventEmitter {
	constructor() {
		super();
		this.devices = new Map(); // id -> Device
		this.storageKey = 'dmx-devices';
		this.nextId = 1;
		this.load();
	}

	/**
	 * Add a new device
	 */
	add(device) {
		this.devices.set(device.id, device);

		// Update nextId to be greater than any existing id
		if (device.id >= this.nextId) {
			this.nextId = device.id + 1;
		}

		this.save();
		this._emit('changed', { type: 'add', device });
		return device;
	}

	/**
	 * Create a new device with auto-generated ID
	 */
	create(type, startChannel, name = '', linkedTo = null, cssId = null, syncedControls = null, mirrorPan = false) {
		const device = new Device(
			this.nextId++,
			type,
			startChannel,
			name,
			linkedTo,
			cssId,
			syncedControls,
			mirrorPan,
			0 // version
		);
		return this.add(device);
	}

	/**
	 * Get a device by ID
	 */
	get(id) {
		return this.devices.get(id);
	}

	/**
	 * Get all devices as array
	 */
	getAll() {
		return Array.from(this.devices.values());
	}

	/**
	 * Update an existing device
	 */
	update(device) {
		if (this.devices.has(device.id)) {
			device.version = (device.version || 0) + 1;
			this.devices.set(device.id, device);
			this.save();
			this._emit('changed', { type: 'update', device });
		}
	}

	/**
	 * Remove a device
	 */
	remove(id) {
		const device = this.devices.get(id);
		if (device) {
			this.devices.delete(id);
			this.save();
			this._emit('changed', { type: 'remove', device });
		}
	}

	/**
	 * Reorder devices
	 */
	reorder(newOrder) {
		this.devices.clear();
		newOrder.forEach(device => {
			this.devices.set(device.id, device);
		});
		this.save();
		this._emit('changed', { type: 'reorder' });
	}

	/**
	 * Clear all device values (reset to defaults)
	 */
	clearAllValues() {
		this.devices.forEach(device => {
			device.defaultValues = DEVICE_TYPES[device.type].getDefaultValues();
			device.version++;
		});
		this.save();
		this._emit('changed', { type: 'clear_values' });
	}

	/**
	 * Save to localStorage
	 */
	save() {
		const data = {
			devices: Array.from(this.devices.values()).map(device => ({
				id: device.id,
				name: device.name,
				type: device.type,
				startChannel: device.startChannel,
				defaultValues: device.defaultValues,
				linkedTo: device.linkedTo,
				cssId: device.cssId,
				syncedControls: device.syncedControls,
				mirrorPan: device.mirrorPan,
				version: device.version
			})),
			nextId: this.nextId
		};
		localStorage.setItem(this.storageKey, JSON.stringify(data));
	}

	/**
	 * Load from localStorage
	 */
	load() {
		try {
			const data = localStorage.getItem(this.storageKey);
			if (data) {
				const parsed = JSON.parse(data);
				this.devices.clear();

				// Load devices
				if (parsed.devices) {
					parsed.devices.forEach(deviceData => {
						const device = new Device(
							deviceData.id,
							deviceData.type,
							deviceData.startChannel,
							deviceData.name,
							deviceData.linkedTo,
							deviceData.cssId,
							deviceData.syncedControls || null,
							deviceData.mirrorPan || false,
							deviceData.version || 0
						);
						device.defaultValues = deviceData.defaultValues || DEVICE_TYPES[deviceData.type].getDefaultValues();
						this.devices.set(device.id, device);
					});
				}

				// Restore nextId or calculate it
				if (parsed.nextId) {
					this.nextId = parsed.nextId;
				} else {
					const maxId = this.devices.size > 0 ? Math.max(...Array.from(this.devices.keys())) : 0;
					this.nextId = maxId + 1;
				}
			}
		} catch (error) {
			console.error('Failed to load devices:', error);
		}
	}

	/**
	 * Clear all devices
	 */
	clear() {
		this.devices.clear();
		this.nextId = 1;
		this.save();
		this._emit('changed', { type: 'clear' });
	}
}
