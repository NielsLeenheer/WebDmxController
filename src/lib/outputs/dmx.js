/**
 * DMX Output System
 *
 * Provides abstraction for different DMX USB controllers via WebUSB.
 * Each controller type has its own driver that implements the DMXDriver interface.
 */

// Import driver classes (used internally only)
import { EnttecDMXUSBProDriver } from './dmx/EnttecDMXUSBProDriver.js';
import { FT232RDriver } from './dmx/FT232RDriver.js';
import { uDMXDriver } from './dmx/uDMXDriver.js';
import { DEVICE_TYPES } from './devices.js';
import { controlValuesToDMX } from './controls.js';

/**
 * DMX Output Manager
 * Manages DMX controller drivers and device connections
 */
class DMXOutputManager {
	constructor() {
		this.drivers = new Map(); // driverName -> DMXDriver instance
		this.activeDriver = null;
		this.listeners = new Map();

		// Register built-in drivers
		// Note: Both FT232R and ENTTEC use 0x0403:0x6001 (same USB IDs!)
		// They differ only in protocol (FTDI serial vs ENTTEC proprietary)
		// If both match, findDriverForDevice() prefers ENTTEC
		this.registerDriver(new FT232RDriver());
		this.registerDriver(new EnttecDMXUSBProDriver());
		this.registerDriver(new uDMXDriver());
	}

	/**
	 * Register a DMX driver
	 * @param {DMXDriver} driver - Driver instance to register
	 */
	registerDriver(driver) {
		this.drivers.set(driver.name, driver);

		// Forward driver events
		driver.on('connected', (data) => this._emit('connected', data));
		driver.on('disconnected', (data) => this._emit('disconnected', data));
		driver.on('error', (data) => this._emit('error', data));
	}

	/**
	 * Get all registered drivers
	 * @returns {DMXDriver[]}
	 */
	getDrivers() {
		return Array.from(this.drivers.values());
	}

	/**
	 * Get USB filters for all registered drivers
	 * @returns {Array} WebUSB filter array
	 */
	getUSBFilters() {
		const filters = [];
		for (const driver of this.drivers.values()) {
			filters.push(...driver.vendorFilters);
		}
		return filters;
	}

	/**
	 * Find a compatible driver for a USB device
	 * @param {USBDevice} device
	 * @returns {DMXDriver|null}
	 */
	findDriverForDevice(device) {
		// Collect all drivers that match the USB IDs
		const matchingDrivers = [];
		for (const driver of this.drivers.values()) {
			if (driver.supportsDevice(device)) {
				matchingDrivers.push(driver);
			}
		}

		if (matchingDrivers.length === 0) {
			return null;
		}

		// If only one driver matches, return it
		if (matchingDrivers.length === 1) {
			return matchingDrivers[0];
		}

		// Multiple drivers match (e.g., ENTTEC and FT232R both match 0x0403:0x6001)
		// Use the device name and manufacturer to differentiate between them
		console.log(`Multiple drivers match device "${device.manufacturerName}" "${device.productName}" (0x${device.vendorId.toString(16)}:0x${device.productId.toString(16)})`);

		// Check manufacturer and product name for ENTTEC identification
		// Checking manufacturer is more reliable than product name (clones might copy the product name)
		if (device.manufacturerName && device.manufacturerName.toUpperCase().includes('ENTTEC')) {
			const enttecDriver = matchingDrivers.find(d => d.name === 'ENTTEC DMX USB Pro');
			if (enttecDriver) {
				console.log('Manufacturer is ENTTEC - using ENTTEC driver');
				return enttecDriver;
			}
		}

		// Fallback: Check product name for ENTTEC (in case manufacturer string is different)
		if (device.productName && device.productName.includes('DMX USB PRO')) {
			const enttecDriver = matchingDrivers.find(d => d.name === 'ENTTEC DMX USB Pro');
			if (enttecDriver) {
				console.log('Product name matches "DMX USB PRO" - using ENTTEC driver');
				return enttecDriver;
			}
		}

		// Check device name for FT232R identification
		if (device.productName && device.productName.includes('FT232R')) {
			const ft232rDriver = matchingDrivers.find(d => d.name === 'FT232R USB-DMX');
			if (ft232rDriver) {
				console.log('Product name matches "FT232R" - using FT232R driver');
				return ft232rDriver;
			}
		}

		// Fallback: prefer ENTTEC over FT232R if we couldn't determine from name
		const enttecDriver = matchingDrivers.find(d => d.name === 'ENTTEC DMX USB Pro');
		if (enttecDriver) {
			console.log('Could not determine from device name - defaulting to ENTTEC driver');
			return enttecDriver;
		}

		// Otherwise, return the first matching driver
		return matchingDrivers[0];
	}

	/**
	 * Request a DMX controller device from the user
	 * @returns {Promise<DMXDriver>}
	 */
	async requestDevice() {
		if (!('usb' in navigator)) {
			throw new Error('WebUSB is not supported in this browser');
		}

		const filters = this.getUSBFilters();

		try {
			const device = await navigator.usb.requestDevice({ filters });
			const driver = this.findDriverForDevice(device);

			if (!driver) {
				throw new Error('No compatible driver found for this device');
			}

			await driver.connect(device);
			this.activeDriver = driver;

			return driver;
		} catch (error) {
			console.error('Failed to request DMX device:', error);
			throw error;
		}
	}

	/**
	 * Get the currently active driver
	 * @returns {DMXDriver|null}
	 */
	getActiveDriver() {
		return this.activeDriver;
	}

	/**
	 * Disconnect the active driver
	 */
	disconnect() {
		if (this.activeDriver) {
			this.activeDriver.disconnect();
			this.activeDriver = null;
		}
	}

	/**
	 * Event handling
	 */
	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event).push(callback);
	}

	off(event, callback) {
		if (!this.listeners.has(event)) return;
		const callbacks = this.listeners.get(event);
		const index = callbacks.indexOf(callback);
		if (index !== -1) {
			callbacks.splice(index, 1);
		}
	}

	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		const callbacks = this.listeners.get(event);
		for (const callback of callbacks) {
			callback(data);
		}
	}
}

/**
 * DMX Controller
 * Main interface for controlling DMX output
 * Maintains backward compatibility with existing code
 */
export class DMXController {
	constructor() {
		this.universe = new Uint8Array(512).fill(0);
		this.manager = new DMXOutputManager();
		this.driver = null;
		this.connected = false;

		// Forward manager events
		this.manager.on('connected', ({ driver }) => {
			this.driver = driver;
			this.connected = true;
			// Start continuous output for the driver
			if (typeof driver.startOutput === 'function') {
				driver.startOutput(this.universe);
			}
		});

		this.manager.on('disconnected', () => {
			this.driver = null;
			this.connected = false;
		});
	}

	async connect() {
		await this.manager.requestDevice();
		return true;
	}

	disconnect() {
		this.manager.disconnect();
	}

	setChannel(channel, value) {
		if (channel >= 0 && channel < 512) {
			this.universe[channel] = Math.max(0, Math.min(255, value));
		}
	}

	getChannel(channel) {
		return this.universe[channel] || 0;
	}

	setChannels(startChannel, values) {
		values.forEach((value, index) => {
			this.setChannel(startChannel + index, value);
		});
	}

	getUniverse() {
		return this.universe;
	}

	clearUniverse() {
		this.universe.fill(0);
	}

	/**
	 * Update DMX channels from a device's control values
	 * @param {Object} device - Device object with type, startChannel, and defaultValues
	 */
	updateDevice(device) {
		const deviceType = DEVICE_TYPES[device.type];
		if (!deviceType) return;

		// Convert control values to DMX array
		const dmxArray = controlValuesToDMX(deviceType, device.defaultValues);

		// Write DMX array to universe
		this.setChannels(device.startChannel, dmxArray);
	}

	/**
	 * Manually send universe (for drivers that don't auto-send)
	 */
	sendUniverse() {
		if (this.driver && this.connected) {
			this.driver.sendUniverse(this.universe);
		}
	}

	/**
	 * Get the active driver
	 * @returns {DMXDriver|null}
	 */
	getDriver() {
		return this.driver;
	}
}
