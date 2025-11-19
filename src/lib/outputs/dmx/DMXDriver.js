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
