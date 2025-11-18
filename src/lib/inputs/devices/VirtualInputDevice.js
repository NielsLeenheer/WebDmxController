import { InputDevice } from './InputDevice.js';

/**
 * Virtual Input Device (on-screen buttons)
 */
export class VirtualInputDevice extends InputDevice {
	constructor(name = 'Virtual') {
		super(`virtual-${Date.now()}`, name, 'virtual');
	}

	/**
	 * Manually trigger a control (called from UI)
	 */
	trigger(controlId, velocity = 1) {
		this._trigger(controlId, velocity);
	}

	/**
	 * Manually set a value (called from UI)
	 */
	setValue(controlId, value) {
		this._setValue(controlId, value, 0, 1);
	}

	/**
	 * Add a virtual button control
	 */
	addButton(id, label) {
		this.controls.set(id, { type: 'button', value: 0, label });
	}

	/**
	 * Add a virtual knob/slider control
	 */
	addKnob(id, label, defaultValue = 0) {
		this.controls.set(id, { type: 'knob', value: defaultValue, label, min: 0, max: 1 });
	}
}
