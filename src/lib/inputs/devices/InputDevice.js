/**
 * Base class for all input devices
 */
export class InputDevice {
	constructor(id, name, type) {
		this.id = id;
		this.name = name;
		this.type = type; // 'midi', 'hid', 'keyboard', 'virtual', 'bluetooth'
		this.controls = new Map(); // controlId -> { type, value, min, max }
		this.listeners = new Map(); // event -> callback[]
	}

	/**
	 * Get control value (0-1 normalized)
	 */
	getValue(controlId) {
		const control = this.controls.get(controlId);
		return control ? control.value : 0;
	}

	/**
	 * Set control value (internal)
	 */
	_setValue(controlId, value, min = 0, max = 1) {
		if (!this.controls.has(controlId)) {
			this.controls.set(controlId, { type: 'value', value: 0, min, max });
		}

		const control = this.controls.get(controlId);
		control.value = value;
		control.min = min;
		control.max = max;

		this._emit('change', { controlId, value, control });
	}

	/**
	 * Trigger a control (for buttons/notes)
	 */
	_trigger(controlId, velocity = 1) {
		this._emit('trigger', { controlId, velocity });
	}

	/**
	 * Add event listener
	 */
	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event).push(callback);
	}

	/**
	 * Remove event listener
	 */
	off(event, callback) {
		if (!this.listeners.has(event)) return;
		const callbacks = this.listeners.get(event);
		const index = callbacks.indexOf(callback);
		if (index !== -1) {
			callbacks.splice(index, 1);
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
	 * Disconnect the device
	 */
	disconnect() {
		// Override in subclasses
	}

	/**
	 * Get all control IDs
	 */
	getControlIds() {
		return Array.from(this.controls.keys());
	}

	/**
	 * Set color for a control (button/pad/LED)
	 * Override in subclasses to implement device-specific color handling
	 * @param {string} controlId - Control identifier (e.g., 'button-0', 'note-36')
	 * @param {string} color - Palette color name
	 */
	async setColor(controlId, color) {
		// Base implementation does nothing - override in subclasses
	}
}
