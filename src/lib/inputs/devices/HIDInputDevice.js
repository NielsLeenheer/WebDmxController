import { InputDevice } from './InputDevice.js';

/**
 * Generic HID Input Device (game controllers, button boxes, etc)
 * Uses bit-packed button state handling for generic devices
 */
export class HIDInputDevice extends InputDevice {
	constructor(hidDevice, config = {}) {
		super(hidDevice.productId.toString(), config.name || 'HID Device', 'hid');
		this.hidDevice = hidDevice;
		this.config = config; // Device-specific config (button count, layout, etc)
		this.buttonStates = new Map(); // Track button states
		this.hidDevice.oninputreport = this._handleInputReport.bind(this);
	}

	/**
	 * Override _trigger to include HID-specific metadata
	 */
	_trigger(controlId, velocity = 1) {
		this._emit('trigger', {
			controlId,
			velocity,
			type: 'button',
			colorSupport: 'none',
			friendlyName: null
		});
	}

	_handleInputReport(event) {
		const { data, reportId } = event;
		const bytes = new Uint8Array(data.buffer);

		// Generic bit-packed button handling
		for (let i = 0; i < bytes.length; i++) {
			const byte = bytes[i];
			for (let bit = 0; bit < 8; bit++) {
				const buttonIndex = i * 8 + bit;
				const pressed = (byte >> bit) & 1;
				const controlId = `button-${buttonIndex}`;
				const wasPressed = this.buttonStates.get(controlId) || false;

				if (pressed && !wasPressed) {
					this.buttonStates.set(controlId, true);
					this._trigger(controlId, 127);
				} else if (!pressed && wasPressed) {
					this.buttonStates.set(controlId, false);
					this._emit('release', { controlId });
				}
			}
		}
	}

	/**
	 * Send output report (e.g., to update button LEDs)
	 */
	async sendOutput(reportId, data) {
		if (this.hidDevice && this.hidDevice.opened) {
			await this.hidDevice.sendReport(reportId, data);
		}
	}

	disconnect() {
		if (this.hidDevice) {
			this.hidDevice.oninputreport = null;
			this.hidDevice.close();
		}
		this.buttonStates.clear();
	}
}
