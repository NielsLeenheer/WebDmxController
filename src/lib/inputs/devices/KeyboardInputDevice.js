import { InputDevice } from './InputDevice.js';

/**
 * Keyboard Input Device
 */
export class KeyboardInputDevice extends InputDevice {
	constructor() {
		super('keyboard', 'Keyboard', 'keyboard');
		this.pressedKeys = new Set();
		this._boundKeyDown = this._handleKeyDown.bind(this);
		this._boundKeyUp = this._handleKeyUp.bind(this);

		window.addEventListener('keydown', this._boundKeyDown);
		window.addEventListener('keyup', this._boundKeyUp);
	}

	/**
	 * Override _trigger to include keyboard-specific metadata
	 */
	_trigger(controlId, velocity = 1) {
		this._emit('trigger', {
			controlId,
			velocity,
			type: 'button',
			supportsColor: false,
			friendlyName: null
		});
	}

	/**
	 * Override _setValue to include keyboard-specific metadata
	 */
	_setValue(controlId, value, min = 0, max = 1) {
		if (!this.controls.has(controlId)) {
			this.controls.set(controlId, { type: 'value', value: 0, min, max });
		}

		const control = this.controls.get(controlId);
		control.value = value;
		control.min = min;
		control.max = max;

		this._emit('change', {
			controlId,
			value,
			control,
			type: 'button',
			supportsColor: false,
			friendlyName: null
		});
	}

	_handleKeyDown(event) {
		// Ignore if typing in input/textarea
		if (event.target.matches('input, textarea')) return;

		const controlId = `key-${event.code}`;

		if (!this.pressedKeys.has(event.code)) {
			this.pressedKeys.add(event.code);
			this._trigger(controlId);
			this._setValue(controlId, 1, 0, 1);
		}
	}

	_handleKeyUp(event) {
		const controlId = `key-${event.code}`;

		if (this.pressedKeys.has(event.code)) {
			this.pressedKeys.delete(event.code);
			this._emit('release', { controlId });
			this._setValue(controlId, 0, 0, 1);
		}
	}

	disconnect() {
		window.removeEventListener('keydown', this._boundKeyDown);
		window.removeEventListener('keyup', this._boundKeyUp);
		this.pressedKeys.clear();
	}
}
