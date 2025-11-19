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
