/**
 * Generic HID Device Helper Library
 *
 * Provides support for generic HID devices (game controllers, button boxes, etc.)
 * using the WebHID API with bit-packed button state handling.
 */

/**
 * Generic HID Device Manager
 * Handles generic HID devices with bit-packed button reports
 */
export class HIDDeviceManager {
	constructor() {
		this.connectedDevices = new Map(); // deviceId -> HIDDevice instance
		this.listeners = new Map(); // event -> Set of callbacks
		this.buttonStates = new Map(); // deviceId -> Map<buttonIndex, boolean>
	}

	/**
	 * Add event listener
	 */
	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event).add(callback);
	}

	/**
	 * Remove event listener
	 */
	off(event, callback) {
		if (this.listeners.has(event)) {
			this.listeners.get(event).delete(callback);
		}
	}

	/**
	 * Emit event
	 */
	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		const callbacks = this.listeners.get(event);
		for (const callback of callbacks) {
			callback(data);
		}
	}

	/**
	 * Request user to select a HID device
	 */
	async requestDevice(filters = []) {
		if (!navigator.hid) {
			throw new Error('WebHID not supported in this browser');
		}

		try {
			const devices = await navigator.hid.requestDevice({ filters });

			for (const hidDevice of devices) {
				// Check if device is already open
				if (!hidDevice.opened) {
					try {
						await hidDevice.open();
					} catch (openError) {
						console.error('Failed to open HID device:', openError);
						throw new Error(`Cannot open device. Make sure it's not being used by another application. Error: ${openError.message}`);
					}
				}

				await this._setupHIDDevice(hidDevice);
			}

			return devices[0] || null;
		} catch (error) {
			console.error('Failed to request HID device:', error);
			throw error;
		}
	}

	/**
	 * Auto-reconnect to previously authorized devices
	 */
	async autoReconnect() {
		if (!navigator.hid) {
			console.warn('WebHID not supported');
			return [];
		}

		try {
			const devices = await navigator.hid.getDevices();
			const reconnected = [];

			for (const hidDevice of devices) {
				try {
					if (!hidDevice.opened) {
						await hidDevice.open();
					}
					await this._setupHIDDevice(hidDevice);
					reconnected.push(hidDevice);
				} catch (error) {
					console.warn('Failed to reconnect to HID device:', error);
				}
			}

			return reconnected;
		} catch (error) {
			console.error('Failed to auto-reconnect HID devices:', error);
			return [];
		}
	}

	/**
	 * Setup a HID device instance
	 */
	async _setupHIDDevice(hidDevice) {
		const deviceId = hidDevice.productId.toString();

		// Initialize button states
		this.buttonStates.set(deviceId, new Map());

		// Set up input report listener
		hidDevice.oninputreport = (event) => {
			this._handleInputReport(deviceId, hidDevice, event);
		};

		this.connectedDevices.set(deviceId, hidDevice);

		this._emit('connected', {
			device: hidDevice,
			deviceId,
			name: hidDevice.productName || 'HID Device'
		});

		return hidDevice;
	}

	/**
	 * Handle HID input report with generic bit-packed button handling
	 */
	_handleInputReport(deviceId, hidDevice, event) {
		const { data, reportId } = event;
		const bytes = new Uint8Array(data.buffer);
		const buttonStates = this.buttonStates.get(deviceId);

		if (!buttonStates) return;

		// Generic button handling: treat each bit as a button
		for (let i = 0; i < bytes.length; i++) {
			const byte = bytes[i];
			for (let bit = 0; bit < 8; bit++) {
				const buttonIndex = i * 8 + bit;
				const pressed = (byte >> bit) & 1;
				const wasPressed = buttonStates.get(buttonIndex) || false;

				if (pressed && !wasPressed) {
					// Button pressed
					buttonStates.set(buttonIndex, true);
					this._emit('buttondown', {
						device: hidDevice,
						deviceId,
						button: buttonIndex
					});
				} else if (!pressed && wasPressed) {
					// Button released
					buttonStates.set(buttonIndex, false);
					this._emit('buttonup', {
						device: hidDevice,
						deviceId,
						button: buttonIndex
					});
				}
			}
		}
	}

	/**
	 * Disconnect a device
	 */
	async disconnectDevice(deviceId) {
		const hidDevice = this.connectedDevices.get(deviceId);
		if (!hidDevice) return;

		hidDevice.oninputreport = null;
		await hidDevice.close();

		this.connectedDevices.delete(deviceId);
		this.buttonStates.delete(deviceId);

		this._emit('disconnected', { deviceId });
	}

	/**
	 * Get all connected HID devices
	 */
	getConnectedDevices() {
		return Array.from(this.connectedDevices.values());
	}

	/**
	 * Disconnect all devices
	 */
	async disconnectAll() {
		const deviceIds = Array.from(this.connectedDevices.keys());
		for (const deviceId of deviceIds) {
			await this.disconnectDevice(deviceId);
		}
	}
}
