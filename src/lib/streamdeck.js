/**
 * Stream Deck WebHID Helper Library
 *
 * Provides easy integration with Elgato Stream Deck devices via WebHID API.
 */

/**
 * Stream Deck device information
 */
export const STREAM_DECK_DEVICES = {
	// Elgato vendor ID
	VENDOR_ID: 0x0fd9,

	// Product IDs for different Stream Deck models
	PRODUCTS: {
		ORIGINAL: 0x0060,
		ORIGINAL_V2: 0x006d,
		MINI: 0x0063,
		MINI_V2: 0x0090,
		XL: 0x006c,
		XL_V2: 0x008f,
		MK2: 0x0080,
		PLUS: 0x0084,
		PEDAL: 0x0086,
		NEO: 0x009a
	},

	// Button counts for each model
	BUTTON_COUNTS: {
		0x0060: 15, // Original
		0x006d: 15, // Original V2
		0x0063: 6,  // Mini
		0x0090: 6,  // Mini V2
		0x006c: 32, // XL
		0x008f: 32, // XL V2
		0x0080: 15, // MK2
		0x0084: 8,  // Plus (LCD keys only)
		0x0086: 3,  // Pedal
		0x009a: 8   // Neo
	}
};

/**
 * Get WebHID filters for all Stream Deck devices
 */
export function getStreamDeckFilters() {
	return [{
		vendorId: STREAM_DECK_DEVICES.VENDOR_ID
	}];
}

/**
 * Check if a HID device is a Stream Deck
 */
export function isStreamDeck(hidDevice) {
	return hidDevice.vendorId === STREAM_DECK_DEVICES.VENDOR_ID;
}

/**
 * Get the model name of a Stream Deck device
 */
export function getStreamDeckModel(hidDevice) {
	if (!isStreamDeck(hidDevice)) return null;

	const productName = hidDevice.productName || '';

	// Try to extract model from product name
	if (productName.includes('Mini')) return 'Stream Deck Mini';
	if (productName.includes('XL')) return 'Stream Deck XL';
	if (productName.includes('MK.2')) return 'Stream Deck MK.2';
	if (productName.includes('Plus')) return 'Stream Deck Plus';
	if (productName.includes('Pedal')) return 'Stream Deck Pedal';
	if (productName.includes('Neo')) return 'Stream Deck Neo';

	return 'Stream Deck';
}

/**
 * Get the number of buttons for a Stream Deck device
 */
export function getStreamDeckButtonCount(hidDevice) {
	if (!isStreamDeck(hidDevice)) return 0;
	return STREAM_DECK_DEVICES.BUTTON_COUNTS[hidDevice.productId] || 15;
}

/**
 * Stream Deck Manager
 * Handles auto-reconnect and device management
 */
export class StreamDeckManager {
	constructor() {
		this.connectedDevices = new Map(); // serialNumber -> HIDDevice
		this.listeners = new Map(); // event -> Set of callbacks
		this.buttonStates = new Map(); // serialNumber -> Map<buttonIndex, boolean>
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
	 * Request user to select a Stream Deck device
	 */
	async requestDevice() {
		if (!navigator.hid) {
			throw new Error('WebHID not supported in this browser');
		}

		try {
			const devices = await navigator.hid.requestDevice({
				filters: getStreamDeckFilters()
			});

			for (const device of devices) {
				await this.connectDevice(device);
			}

			return devices[0] || null;
		} catch (error) {
			if (error.name === 'NotAllowedError') {
				throw new Error('Failed to open Stream Deck. Please close the Elgato Stream Deck software and try again.');
			}
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
			const streamDecks = devices.filter(isStreamDeck);

			const reconnected = [];
			for (const device of streamDecks) {
				try {
					await this.connectDevice(device);
					reconnected.push(device);
				} catch (error) {
					console.warn('Failed to reconnect to Stream Deck:', error);
				}
			}

			return reconnected;
		} catch (error) {
			console.error('Failed to auto-reconnect Stream Deck devices:', error);
			return [];
		}
	}

	/**
	 * Connect to a specific HID device
	 */
	async connectDevice(hidDevice) {
		if (!isStreamDeck(hidDevice)) {
			throw new Error('Not a Stream Deck device');
		}

		// Open device if not already open
		if (!hidDevice.opened) {
			try {
				await hidDevice.open();
			} catch (error) {
				throw new Error(`Cannot open Stream Deck. Make sure it's not being used by another application. ${error.message}`);
			}
		}

		const serialNumber = hidDevice.serialNumber || `streamdeck-${hidDevice.productId}`;

		// Initialize button states
		this.buttonStates.set(serialNumber, new Map());

		// Set up input report handler
		hidDevice.oninputreport = (event) => {
			this._handleInputReport(hidDevice, event);
		};

		this.connectedDevices.set(serialNumber, hidDevice);

		this._emit('connected', {
			device: hidDevice,
			serialNumber,
			model: getStreamDeckModel(hidDevice),
			buttonCount: getStreamDeckButtonCount(hidDevice)
		});

		return hidDevice;
	}

	/**
	 * Disconnect a device
	 */
	async disconnectDevice(serialNumber) {
		const device = this.connectedDevices.get(serialNumber);
		if (!device) return;

		if (device.opened) {
			await device.close();
		}

		this.connectedDevices.delete(serialNumber);
		this.buttonStates.delete(serialNumber);

		this._emit('disconnected', { serialNumber });
	}

	/**
	 * Handle input report from Stream Deck
	 */
	_handleInputReport(hidDevice, event) {
		const { data, reportId } = event;
		const bytes = new Uint8Array(data.buffer);
		const serialNumber = hidDevice.serialNumber || `streamdeck-${hidDevice.productId}`;
		const buttonStates = this.buttonStates.get(serialNumber);

		if (!buttonStates) return;

		// Stream Deck sends button states as bytes
		// Each byte represents a button (1 = pressed, 0 = released)
		for (let i = 0; i < bytes.length; i++) {
			const buttonPressed = bytes[i] === 1;
			const wasPressed = buttonStates.get(i) || false;

			if (buttonPressed && !wasPressed) {
				// Button pressed
				buttonStates.set(i, true);
				this._emit('buttondown', {
					device: hidDevice,
					serialNumber,
					button: i,
					model: getStreamDeckModel(hidDevice)
				});
			} else if (!buttonPressed && wasPressed) {
				// Button released
				buttonStates.set(i, false);
				this._emit('buttonup', {
					device: hidDevice,
					serialNumber,
					button: i,
					model: getStreamDeckModel(hidDevice)
				});
			}
		}
	}

	/**
	 * Get all connected Stream Deck devices
	 */
	getConnectedDevices() {
		return Array.from(this.connectedDevices.values());
	}

	/**
	 * Disconnect all devices
	 */
	async disconnectAll() {
		const serialNumbers = Array.from(this.connectedDevices.keys());
		for (const serialNumber of serialNumbers) {
			await this.disconnectDevice(serialNumber);
		}
	}
}
