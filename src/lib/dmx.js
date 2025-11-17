/**
 * DMX Output System
 *
 * Provides abstraction for different DMX USB controllers via WebUSB.
 * Each controller type has its own driver that implements the DMXDriver interface.
 */

/**
 * Base class for DMX controller drivers
 * All DMX controller drivers should extend this class
 */
export class DMXDriver {
	constructor(name, vendorFilters = []) {
		this.name = name;
		this.vendorFilters = vendorFilters; // WebUSB filter array
		this.device = null;
		this.connected = false;
		this.listeners = new Map();
	}

	/**
	 * Connect to a USB device
	 * @param {USBDevice} device - WebUSB device object
	 * @returns {Promise<boolean>}
	 */
	async connect(device) {
		throw new Error('connect() must be implemented by driver');
	}

	/**
	 * Disconnect from the device
	 */
	disconnect() {
		throw new Error('disconnect() must be implemented by driver');
	}

	/**
	 * Send DMX universe data to the device
	 * @param {Uint8Array} universeData - 512-byte DMX universe
	 */
	async sendUniverse(universeData) {
		throw new Error('sendUniverse() must be implemented by driver');
	}

	/**
	 * Check if this driver supports a given USB device
	 * @param {USBDevice} device - WebUSB device to check
	 * @returns {boolean}
	 */
	supportsDevice(device) {
		return this.vendorFilters.some(filter => {
			if (filter.vendorId && device.vendorId !== filter.vendorId) return false;
			if (filter.productId && device.productId !== filter.productId) return false;
			return true;
		});
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
 * ENTTEC DMX USB Pro Driver
 * Supports ENTTEC DMX USB Pro and compatible devices
 */
export class EnttecDMXUSBProDriver extends DMXDriver {
	// Protocol constants
	static DMX_STARTCODE = 0x00;
	static START_OF_MSG = 0x7e;
	static END_OF_MSG = 0xe7;
	static SEND_DMX_RQ = 0x06;

	constructor() {
		super('ENTTEC DMX USB Pro', [
			{ vendorId: 0x0403 } // FTDI chipset used by ENTTEC
		]);
		this.updateRate = 1000 / 60; // 60 fps
		this.interval = null;
		this.universeData = null;
	}

	async connect(device) {
		try {
			this.device = device;

			if (!this.device.opened) {
				await this.device.open();
			}

			await this.device.claimInterface(0);

			// Set control transfer
			await this.device.controlTransferOut({
				requestType: 'class',
				recipient: 'interface',
				request: 0x22,
				value: 0x01,
				index: 0x00
			});

			this.connected = true;
			this._emit('connected', { driver: this });

			return true;
		} catch (error) {
			console.error('ENTTEC: Failed to connect:', error);
			this._emit('error', { error, driver: this });
			throw error;
		}
	}

	disconnect() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}

		if (this.device) {
			try {
				this.device.close();
			} catch (error) {
				console.warn('ENTTEC: Error closing device:', error);
			}
			this.device = null;
		}

		this.connected = false;
		this.universeData = null;
		this._emit('disconnected', { driver: this });
	}

	/**
	 * Start continuous DMX output
	 * @param {Uint8Array} universeData - Reference to the 512-byte universe array
	 */
	startOutput(universeData) {
		this.universeData = universeData;

		if (this.interval) {
			clearInterval(this.interval);
		}

		// Start sending DMX data at regular intervals
		this.interval = setInterval(() => {
			this.sendUniverse(this.universeData);
		}, this.updateRate);
	}

	/**
	 * Stop continuous DMX output
	 */
	stopOutput() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	async sendUniverse(universeData) {
		if (!this.device || !this.connected || !universeData) return;

		const message = Uint8Array.from([
			EnttecDMXUSBProDriver.DMX_STARTCODE,
			...universeData
		]);

		const packet = Uint8Array.from([
			EnttecDMXUSBProDriver.START_OF_MSG,
			EnttecDMXUSBProDriver.SEND_DMX_RQ,
			message.length & 0xff,
			(message.length >> 8) & 0xff,
			...message,
			EnttecDMXUSBProDriver.END_OF_MSG
		]);

		try {
			await this.device.transferOut(2, packet);
		} catch (error) {
			console.error('ENTTEC: Failed to send DMX data:', error);
			this._emit('error', { error, driver: this });
		}
	}
}

/**
 * uDMX Driver (Anyma uDMX)
 * Supports uDMX USB to wireless DMX controllers
 * Uses USB control transfers instead of bulk transfers
 */
export class uDMXDriver extends DMXDriver {
	// USB control transfer constants
	static REQUEST_TYPE = 0x40; // USB_TYPE_VENDOR | USB_RECIP_DEVICE | USB_ENDPOINT_OUT
	static CMD_SET_SINGLE_CHANNEL = 1;
	static CMD_SET_CHANNEL_RANGE = 2;

	constructor() {
		super('uDMX (Anyma)', [
			{ vendorId: 0x16c0, productId: 0x05dc } // Anyma uDMX
		]);
		this.updateRate = 1000 / 44; // ~44 Hz (uDMX is slower than ENTTEC)
		this.interval = null;
		this.universeData = null;
	}

	async connect(device) {
		try {
			this.device = device;

			if (!this.device.opened) {
				await this.device.open();
			}

			// uDMX uses configuration 1, interface 0
			if (this.device.configuration === null) {
				await this.device.selectConfiguration(1);
			}

			await this.device.claimInterface(0);

			this.connected = true;
			this._emit('connected', { driver: this });

			return true;
		} catch (error) {
			console.error('uDMX: Failed to connect:', error);
			this._emit('error', { error, driver: this });
			throw error;
		}
	}

	disconnect() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}

		if (this.device) {
			try {
				this.device.close();
			} catch (error) {
				console.warn('uDMX: Error closing device:', error);
			}
			this.device = null;
		}

		this.connected = false;
		this.universeData = null;
		this._emit('disconnected', { driver: this });
	}

	/**
	 * Start continuous DMX output
	 * @param {Uint8Array} universeData - Reference to the 512-byte universe array
	 */
	startOutput(universeData) {
		this.universeData = universeData;

		if (this.interval) {
			clearInterval(this.interval);
		}

		// Start sending DMX data at regular intervals
		this.interval = setInterval(() => {
			this.sendUniverse(this.universeData);
		}, this.updateRate);
	}

	/**
	 * Stop continuous DMX output
	 */
	stopOutput() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	async sendUniverse(universeData) {
		if (!this.device || !this.connected || !universeData) return;

		try {
			// uDMX uses control transfers to send DMX data
			// Command: SetChannelRange (2)
			// wValue: number of channels (512)
			// wIndex: starting channel (0)
			// data: channel values (512 bytes)
			await this.device.controlTransferOut({
				requestType: 'vendor',
				recipient: 'device',
				request: uDMXDriver.CMD_SET_CHANNEL_RANGE,
				value: 512, // number of channels
				index: 0    // starting at channel 0
			}, universeData);
		} catch (error) {
			// uDMX can occasionally have overflow errors, but we don't want to spam the console
			if (error.name !== 'NetworkError') {
				console.error('uDMX: Failed to send DMX data:', error);
				this._emit('error', { error, driver: this });
			}
		}
	}
}

/**
 * DMX Output Manager
 * Manages DMX controller drivers and device connections
 */
export class DMXOutputManager {
	constructor() {
		this.drivers = new Map(); // driverName -> DMXDriver instance
		this.activeDriver = null;
		this.listeners = new Map();

		// Register built-in drivers
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
		for (const driver of this.drivers.values()) {
			if (driver.supportsDevice(device)) {
				return driver;
			}
		}
		return null;
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
	 * Manually send universe (for drivers that don't auto-send)
	 */
	sendUniverse() {
		if (this.driver && this.connected) {
			this.driver.sendUniverse(this.universe);
		}
	}

	/**
	 * Get the output manager (for advanced usage)
	 * @returns {DMXOutputManager}
	 */
	getManager() {
		return this.manager;
	}

	/**
	 * Get the active driver
	 * @returns {DMXDriver|null}
	 */
	getDriver() {
		return this.driver;
	}
}
