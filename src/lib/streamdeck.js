/**
 * Stream Deck WebHID Helper Library
 *
 * Provides easy integration with Elgato Stream Deck devices via WebHID API.
 */

import { requestStreamDecks, getStreamDecks } from '@elgato-stream-deck/webhid';

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
		this.connectedDevices = new Map(); // serialNumber -> StreamDeck instance
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
			const devices = await requestStreamDecks();

			for (const streamDeck of devices) {
				await this._setupStreamDeck(streamDeck);
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
			const streamDecks = await getStreamDecks();

			const reconnected = [];
			for (const streamDeck of streamDecks) {
				try {
					await this._setupStreamDeck(streamDeck);
					reconnected.push(streamDeck);
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
	 * Setup a Stream Deck instance from the library
	 */
	async _setupStreamDeck(streamDeck) {
		try {
			// Note: requestStreamDecks() and getStreamDecks() return already-opened devices
			// so we don't need to call streamDeck.open()

			const serialNumber = streamDeck.serialNumber || `streamdeck-${streamDeck.PRODUCT_ID}`;

			// Initialize button states
			this.buttonStates.set(serialNumber, new Map());

			// Set up button event listeners
			streamDeck.on('down', (keyIndex) => {
				const buttonStates = this.buttonStates.get(serialNumber);
				if (buttonStates) {
					buttonStates.set(keyIndex, true);
				}

				this._emit('buttondown', {
					device: streamDeck,
					serialNumber,
					button: keyIndex,
					model: streamDeck.PRODUCT_NAME || 'Stream Deck'
				});
			});

			streamDeck.on('up', (keyIndex) => {
				const buttonStates = this.buttonStates.get(serialNumber);
				if (buttonStates) {
					buttonStates.set(keyIndex, false);
				}

				this._emit('buttonup', {
					device: streamDeck,
					serialNumber,
					button: keyIndex,
					model: streamDeck.PRODUCT_NAME || 'Stream Deck'
				});
			});

			// Set brightness to max
			await streamDeck.setBrightness(100);

			// Clear all buttons
			await streamDeck.clearPanel();

			this.connectedDevices.set(serialNumber, streamDeck);

			this._emit('connected', {
				device: streamDeck,
				serialNumber,
				model: streamDeck.PRODUCT_NAME || 'Stream Deck',
				buttonCount: streamDeck.NUM_KEYS
			});

			return streamDeck;
		} catch (error) {
			console.error('Failed to setup Stream Deck:', error);
			throw error;
		}
	}

	/**
	 * Disconnect a device
	 */
	async disconnectDevice(serialNumber) {
		const streamDeck = this.connectedDevices.get(serialNumber);
		if (!streamDeck) return;

		await streamDeck.close();

		this.connectedDevices.delete(serialNumber);
		this.buttonStates.delete(serialNumber);

		this._emit('disconnected', { serialNumber });
	}

	/**
	 * Set button color on a Stream Deck device
	 */
	async setButtonColor(serialNumber, buttonIndex, color) {
		const streamDeck = this.connectedDevices.get(serialNumber);
		if (!streamDeck) return false;

		try {
			// Parse color to RGB
			const rgb = this._parseColor(color);
			if (!rgb) return false;

			// Use the library's fillKeyColor method
			await streamDeck.fillKeyColor(buttonIndex, rgb.r, rgb.g, rgb.b);
			return true;
		} catch (error) {
			console.error('Failed to set button color:', error);
			return false;
		}
	}

	/**
	 * Parse CSS color string to RGB object
	 */
	_parseColor(colorStr) {
		// Create temporary element to compute color
		const div = document.createElement('div');
		div.style.color = colorStr;
		document.body.appendChild(div);
		const computed = window.getComputedStyle(div).color;
		document.body.removeChild(div);

		// Parse rgb(r, g, b) or rgba(r, g, b, a)
		const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (!match) return null;

		return {
			r: parseInt(match[1]),
			g: parseInt(match[2]),
			b: parseInt(match[3])
		};
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
