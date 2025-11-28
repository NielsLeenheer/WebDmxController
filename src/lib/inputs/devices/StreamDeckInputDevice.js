import { InputDevice } from './InputDevice.js';

/**
 * Stream Deck Input Device (Elgato Stream Deck via WebHID)
 */
export class StreamDeckInputDevice extends InputDevice {
	constructor(streamDeck, serialNumber, model, streamDeckManager) {
		super(serialNumber, model || 'Stream Deck', 'hid');
		this.streamDeck = streamDeck;
		this.serialNumber = serialNumber;
		this.model = model;
		this.streamDeckManager = streamDeckManager;
	}

	/**
	 * Get friendly name for a button
	 * @param {string} controlId - Control identifier (e.g., 'button-0')
	 * @returns {string} Friendly name (e.g., 'Button 1')
	 */
	_getFriendlyName(controlId) {
		if (controlId.startsWith('button-')) {
			const buttonIndex = parseInt(controlId.replace('button-', ''));
			if (!isNaN(buttonIndex)) {
				// Display 1-based button numbers to users
				return `Button ${buttonIndex + 1}`;
			}
		}
		return null;
	}

	/**
	 * Override _trigger to include Stream Deck-specific metadata
	 */
	_trigger(controlId, velocity = 1) {
		this._emit('trigger', {
			controlId,
			velocity,
			type: 'button',
			colorSupport: 'rgb',
			friendlyName: this._getFriendlyName(controlId)
		});
	}

	/**
	 * Set color for a control (button)
	 * @param {string} controlId - Control identifier (e.g., 'button-0')
	 * @param {string} color - Palette color name
	 */
	async setColor(controlId, color) {
		if (controlId.startsWith('button-') && this.streamDeckManager) {
			const buttonIndex = parseInt(controlId.replace('button-', ''));
			if (!isNaN(buttonIndex) && buttonIndex >= 0) {
				await this.streamDeckManager.setButtonColor(this.serialNumber, buttonIndex, color);
			}
		}
	}

	disconnect() {
		// Stream Deck disconnection is handled by StreamDeckManager
	}
}
