/**
 * Stream Deck WebHID Helper Library
 *
 * Provides easy integration with Elgato Stream Deck devices via WebHID API.
 */

import { requestStreamDecks, getStreamDecks } from '@elgato-stream-deck/webhid';

/**
 * Check if a HID device is a Stream Deck
 */
export function isStreamDeck(hidDevice) {
	return hidDevice.vendorId === 0x0fd9; // Elgato vendor ID
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

			// Generate a consistent serial number for this device
			// Use PRODUCT_NAME + MODEL to create a stable identifier across reloads
			// This ensures saved inputs can be matched to the same device after reload
			const serialNumber = streamDeck.serialNumber
				|| streamDeck.SERIAL_NUMBER
				|| `${streamDeck.PRODUCT_NAME || 'StreamDeck'}-${streamDeck.MODEL || streamDeck.PRODUCT_ID || 'unknown'}`.replace(/\s+/g, '-').toLowerCase();

			console.log('Stream Deck serial number:', serialNumber, 'Product:', streamDeck.PRODUCT_NAME, 'Model:', streamDeck.MODEL);

			// Initialize button states
			this.buttonStates.set(serialNumber, new Map());

			// Set up button event listeners
			streamDeck.on('down', (keyIndex) => {
				// Extract button index from the event parameter
				// The library passes an object with properties: {type, row, column, index, hidIndex, ...}
				let buttonIndex;

				if (typeof keyIndex === 'number') {
					buttonIndex = keyIndex;
				} else if (typeof keyIndex === 'object' && keyIndex !== null) {
					// Use the 'index' property from the event object
					buttonIndex = keyIndex.index;
				} else if (typeof keyIndex === 'string') {
					buttonIndex = parseInt(keyIndex);
				}

				// Skip if we couldn't extract a valid button index
				if (typeof buttonIndex !== 'number' || isNaN(buttonIndex)) {
					console.warn('Could not extract button index from Stream Deck event:', keyIndex);
					return;
				}

				const buttonStates = this.buttonStates.get(serialNumber);
				if (buttonStates && typeof buttonIndex === 'number') {
					buttonStates.set(buttonIndex, true);
				}

				this._emit('buttondown', {
					device: streamDeck,
					serialNumber,
					button: buttonIndex,
					model: streamDeck.PRODUCT_NAME || 'Stream Deck'
				});
			});

			streamDeck.on('up', (keyIndex) => {
				// Extract button index from the event parameter
				let buttonIndex;

				if (typeof keyIndex === 'number') {
					buttonIndex = keyIndex;
				} else if (typeof keyIndex === 'object' && keyIndex !== null) {
					// Use the 'index' property from the event object
					buttonIndex = keyIndex.index;
				} else if (typeof keyIndex === 'string') {
					buttonIndex = parseInt(keyIndex);
				}

				// Skip if we couldn't extract a valid button index
				if (typeof buttonIndex !== 'number' || isNaN(buttonIndex)) {
					return;
				}

				const buttonStates = this.buttonStates.get(serialNumber);
				if (buttonStates && typeof buttonIndex === 'number') {
					buttonStates.set(buttonIndex, false);
				}

				this._emit('buttonup', {
					device: streamDeck,
					serialNumber,
					button: buttonIndex,
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
		if (!streamDeck) {
			// Device not connected
			return false;
		}

		// Validate button index is within range for this device
		const buttonCount = streamDeck.NUM_KEYS || 15;
		if (buttonIndex < 0 || buttonIndex >= buttonCount) {
			// Button index out of range for this device
			return false;
		}

		try {
			// Parse color to RGB
			const rgb = this._parseColor(color);
			if (!rgb) return false;

			// Use the library's fillKeyColor method
			await streamDeck.fillKeyColor(buttonIndex, rgb.r, rgb.g, rgb.b);
			return true;
		} catch (error) {
			console.error(`Failed to set button ${buttonIndex} color on ${serialNumber}:`, error);
			return false;
		}
	}

	/**
	 * Clear button color (set to black) on a Stream Deck device
	 */
	async clearButtonColor(serialNumber, buttonIndex) {
		return await this.setButtonColor(serialNumber, buttonIndex, '#000000');
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
